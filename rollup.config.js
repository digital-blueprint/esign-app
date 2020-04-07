import path from 'path';
import fs from 'fs';
import url from 'url';
import glob from 'glob';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import copy from 'rollup-plugin-copy';
import {terser} from "rollup-plugin-terser";
import json from '@rollup/plugin-json';
import replace from "@rollup/plugin-replace";
import serve from 'rollup-plugin-serve';
import urlPlugin from "@rollup/plugin-url";
import consts from 'rollup-plugin-consts';
import del from 'rollup-plugin-delete';
import emitEJS from 'rollup-plugin-emit-ejs'
import babel from 'rollup-plugin-babel'
import chai from 'chai';
import selfsigned from 'selfsigned';

// -------------------------------

// Some new web APIs are only available when HTTPS is active.
// Note that this only works with a Non-HTTPS API endpoint with Chrome,
// Firefox will emit CORS errors, see https://bugzilla.mozilla.org/show_bug.cgi?id=1488740
const USE_HTTPS = false;

// -------------------------------

const pkg = require('./package.json');
const build = (typeof process.env.BUILD !== 'undefined') ? process.env.BUILD : 'local';
console.log("build: " + build);
let basePath = '';
let entryPointURL = '';
let keyCloakServer = '';
let keyCloakBaseURL = '';
let matomoSiteId = 131;
let useTerser = true;
let useBabel = true;

switch (build) {
  case 'local':
    basePath = '/dist/';
    entryPointURL = 'http://127.0.0.1:8000';
    keyCloakServer = 'auth-dev.tugraz.at';
    keyCloakBaseURL = 'https://' + keyCloakServer + '/auth';
    useTerser = false;
    break;
  case 'development':
    basePath = '/apps/signature/';
    entryPointURL = 'https://mw-dev.tugraz.at';
    keyCloakServer = 'auth-dev.tugraz.at';
    keyCloakBaseURL = 'https://' + keyCloakServer + '/auth';
    break;
  case 'demo':
    basePath = '/apps/signature/';
    entryPointURL = 'https://signature-demo.tugraz.at';
    keyCloakServer = 'auth-test.tugraz.at';
    keyCloakBaseURL = 'https://' + keyCloakServer + '/auth';
    break;
  case 'production':
    basePath = '/';
    entryPointURL = 'https://signature.tugraz.at';
    keyCloakServer = 'auth.tugraz.at';
    keyCloakBaseURL = 'https://' + keyCloakServer + '/auth';
    matomoSiteId = 130;
    break;
  case 'test':
    basePath = '/apps/signature/';
    entryPointURL = '';
    keyCloakServer = '';
    keyCloakBaseURL = '';
    useTerser = false;
    break;
  default:
    console.error('Unknown build environment: ' + build);
    process.exit(1);
}



const CHUNK_BLACKLIST = [
  'jszip',  // jszip is a node module by default and rollup chunking is confused by that and emits warnings
  'source-sans-pro'
];

/**
 * Returns a list of chunks used for splitting up the bundle.
 * We recursively use every dependency and ever internal dev dependency (starting with 'vpu-').
 */
function getManualChunks(pkg) {
  let manualChunks = Object.keys(pkg.dependencies).reduce(function (acc, item) { acc[item] = [item]; return acc;}, {});
  const vpu = Object.keys(pkg.devDependencies).reduce(function (acc, item) { if (item.startsWith('vpu-')) acc[item] = [item]; return acc;}, {});
  for (const vpuName in vpu) {
    const subPkg = require('./node_modules/' + vpuName + '/package.json');
    manualChunks = Object.assign(manualChunks, getManualChunks(subPkg));
  }
  manualChunks = Object.assign(manualChunks, vpu);
  for(const name of CHUNK_BLACKLIST) {
    delete manualChunks[name];
  }
  return manualChunks;
}

/**
 * Creates a server certificate and caches it in the .cert directory
 */
function generateTLSConfig() {
  fs.mkdirSync('.cert', {recursive: true});

  if (!fs.existsSync('.cert/server.key') || !fs.existsSync('.cert/server.cert')) {
    const attrs = [{name: 'commonName', value: 'vpu-dev.localhost'}];
    const pems = selfsigned.generate(attrs, {algorithm: 'sha256', days: 9999});
    fs.writeFileSync('.cert/server.key', pems.private);
    fs.writeFileSync('.cert/server.cert', pems.cert);
  }

  return {
    key: fs.readFileSync('.cert/server.key'),
    cert: fs.readFileSync('.cert/server.cert')
  }
}

function getBuildInfo() {
    const child_process = require('child_process');
    const url = require('url');

    let remote = child_process.execSync('git config --get remote.origin.url').toString().trim();
    let commit = child_process.execSync('git rev-parse --short HEAD').toString().trim();

    let parsed = url.parse(remote);
    let newPath = parsed.path.slice(0, parsed.path.lastIndexOf('.'));
    let newUrl = parsed.protocol + '//' + parsed.host + newPath + '/commit/' + commit;

    return {
        info: commit,
        url: newUrl,
        time: new Date().toISOString(),
        env: build
    }
}

export default {
    input: (build != 'test') ? [
      'src/vpu-signature.js',
      'src/vpu-signature-pdf-upload.js',
      'src/vpu-signature-profile.js',
      'src/vpu-signature-welcome.js',
    ] : glob.sync('test/**/*.js'),
    output: {
      dir: 'dist',
      entryFileNames: '[name].js',
      chunkFileNames: 'shared/[name].[hash].[format].js',
      format: 'esm',
      sourcemap: true
    },
    manualChunks: getManualChunks(pkg),
    onwarn: function (warning, warn) {
        // ignore "suggestions" warning re "use strict"
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
            return;
        }
        // ignore chai warnings
        if (warning.code === 'CIRCULAR_DEPENDENCY') {
          return;
        }
        // keycloak bundled code uses eval
        if (warning.code === 'EVAL') {
          return;
        }
        warn(warning);
    },
    watch: {
      chokidar: {
        usePolling: true
      }
    },
    plugins: [
        del({
          targets: 'dist/*'
        }),
        consts({
          environment: build,
          buildinfo: getBuildInfo(),
        }),
        emitEJS({
          src: 'assets',
          include: ['**/*.ejs', '**/.*.ejs'],
          data: {
            geturl: (p) => {
              return url.resolve(basePath, p);
            },
            entryPointURL: entryPointURL,
            keyCloakServer: keyCloakServer,
            keyCloakBaseURL: keyCloakBaseURL,
            environment: build,
            matomoSiteId: matomoSiteId,
            buildinfo: getBuildInfo()
          }
        }),

        resolve({
          customResolveOptions: {
            // ignore node_modules from vendored packages
            moduleDirectory: path.join(process.cwd(), 'node_modules')
          }
        }),
        commonjs({
            include: 'node_modules/**',
            namedExports: {
              'chai': Object.keys(chai),
            }
        }),
        json(),
        urlPlugin({
          limit: 0,
          include: [
            "node_modules/suggestions/**/*.css",
            "node_modules/select2/**/*.css",
          ],
          emitFiles: true,
          fileName: 'shared/[name].[hash][extname]'
        }),
        replace({
            "process.env.BUILD": '"' + build + '"',
        }),
        useTerser ? terser({output: {comments: false}}) : false,
        copy({
            targets: [
                {src: 'assets/silent-check-sso.html', dest:'dist'},
                {src: 'assets/htaccess-shared', dest: 'dist/shared/', rename: '.htaccess'},
                {src: 'assets/*.css', dest: 'dist/local/' + pkg.name},
                {src: 'assets/*.ico', dest: 'dist/local/' + pkg.name},
                {src: 'assets/*.svg', dest: 'dist/local/' + pkg.name},
                {src: 'node_modules/source-sans-pro/WOFF2/OTF/*', dest: 'dist/local/' + pkg.name + '/fonts'},
                {src: 'node_modules/vpu-common/vpu-spinner.js', dest: 'dist/local/' + pkg.name, rename: 'spinner.js'},
                {src: 'assets/browser-check.js', dest: 'dist/local/' + pkg.name},
                {src: 'assets/icon-*.png', dest: 'dist/local/' + pkg.name},
                {src: 'assets/manifest.json', dest: 'dist', rename: pkg.name + '.manifest.json'},
                {src: 'assets/*.metadata.json', dest: 'dist'},
                {src: 'node_modules/vpu-common/assets/icons/*.svg', dest: 'dist/local/vpu-common/icons'},
            ],
        }),
        useBabel && babel({
          exclude: 'node_modules/**',
          babelHelpers: 'runtime',
          babelrc: false,
          presets: [[
            '@babel/preset-modules', {
              loose: true
            }
          ]],
          plugins: [[
            '@babel/plugin-transform-runtime', {
              corejs: 3,
              useESModules: true
            }
          ],
          '@babel/plugin-syntax-dynamic-import',
          '@babel/plugin-syntax-import-meta']
        }),
        (process.env.ROLLUP_WATCH === 'true') ? serve({
          contentBase: '.',
          host: '127.0.0.1',
          port: 8001,
          historyApiFallback: basePath + pkg.name + '.html',
          https: USE_HTTPS ? generateTLSConfig() : false,
          headers: {
              'Content-Security-Policy': `default-src 'self' 'unsafe-eval' 'unsafe-inline' analytics.tugraz.at ${keyCloakServer} ${entryPointURL}; img-src *`
          },
        }) : false
    ]
};