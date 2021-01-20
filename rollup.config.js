import path from 'path';
import url from 'url';
import glob from 'glob';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';
import {terser} from "rollup-plugin-terser";
import json from '@rollup/plugin-json';
import serve from 'rollup-plugin-serve';
import urlPlugin from "@rollup/plugin-url";
import consts from 'rollup-plugin-consts';
import license from 'rollup-plugin-license';
import del from 'rollup-plugin-delete';
import emitEJS from 'rollup-plugin-emit-ejs'
import {getBabelOutputPlugin} from '@rollup/plugin-babel';
import appConfig from './app.config.js';
import {getPackagePath, getBuildInfo, generateTLSConfig} from './vendor/toolkit/rollup.utils.js';

const pkg = require('./package.json');
const appEnv = (typeof process.env.APP_ENV !== 'undefined') ? process.env.APP_ENV : 'local';
const watch = process.env.ROLLUP_WATCH === 'true';
const buildFull = (!watch && appEnv !== 'test') || (process.env.FORCE_FULL !== undefined);
let useTerser = buildFull;
let useBabel = buildFull;
let checkLicenses = buildFull;
let useHTTPS = false;

console.log("APP_ENV: " + appEnv);

let config;
if (appEnv in appConfig) {
    config = appConfig[appEnv];
} else if (appEnv === 'test') {
    config = {
        basePath: '/',
        entryPointURL: 'https://test',
        keyCloakBaseURL: 'https://test',
        keyCloakClientId: '',
        matomoUrl: '',
        matomoSiteId: -1,
        nextcloudBaseURL: 'https://test',
        nextcloudName: '',
        pdfAsQualifiedlySigningServer: 'https://test'
    };
} else {
    console.error(`Unknown build environment: '${appEnv}', use one of '${Object.keys(appConfig)}'`);
    process.exit(1);
}

if (config.nextcloudBaseURL) {
    config.nextcloudFileURL = config.nextcloudBaseURL + '/index.php/apps/files/?dir=';
    config.nextcloudWebAppPasswordURL = config.nextcloudBaseURL + '/index.php/apps/webapppassword';
    config.nextcloudWebDavURL = config.nextcloudBaseURL + '/remote.php/dav/files';
} else {
    config.nextcloudFileURL = '';
    config.nextcloudWebAppPasswordURL = '';
    config.nextcloudWebDavURL = '';
}

function getOrigin(url) {
    if (url)
        return new URL(url).origin;
    return '';
}

config.CSP = `default-src 'self' 'unsafe-eval' 'unsafe-inline' \
${getOrigin(config.matomoUrl)} ${getOrigin(config.keyCloakBaseURL)} ${getOrigin(config.entryPointURL)} \
httpbin.org ${getOrigin(config.nextcloudBaseURL)} www.handy-signatur.at \
${getOrigin(config.pdfAsQualifiedlySigningServer)}; \
img-src * blob: data:`;


export default (async () => {return {
    input: (appEnv != 'test') ? [
      'src/' + pkg.name + '.js',
      'src/dbp-official-signature-pdf-upload.js',
      'src/dbp-qualified-signature-pdf-upload.js',
      'src/dbp-signature-verification.js',
      'src/dbp-signature-verification-full.js',
    ] : glob.sync('test/**/*.js'),
    output: {
      dir: 'dist',
      entryFileNames: '[name].js',
      chunkFileNames: 'shared/[name].[hash].[format].js',
      format: 'esm',
      sourcemap: true
    },
    preserveEntrySignatures: false,
    // external: ['zlib', 'http', 'fs', 'https', 'url'],
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
    plugins: [
        del({
          targets: 'dist/*'
        }),
        consts({
          environment: appEnv,
          buildinfo: getBuildInfo(appEnv),
          nextcloudBaseURL: config.nextcloudBaseURL,
        }),
        emitEJS({
          src: 'assets',
          include: ['**/*.ejs', '**/.*.ejs'],
          data: {
            getUrl: (p) => {
              return url.resolve(config.basePath, p);
            },
            getPrivateUrl: (p) => {
                return url.resolve(`${config.basePath}local/${pkg.name}/`, p);
            },
            name: pkg.name,
            entryPointURL: config.entryPointURL,
            nextcloudWebAppPasswordURL: config.nextcloudWebAppPasswordURL,
            nextcloudWebDavURL: config.nextcloudWebDavURL,
            nextcloudBaseURL: config.nextcloudBaseURL,
            nextcloudFileURL: config.nextcloudFileURL,
            nextcloudName: config.nextcloudName,
            keyCloakBaseURL: config.keyCloakBaseURL,
            keyCloakClientId: config.keyCloakClientId,
            environment: appEnv,
            CSP: config.CSP,
            matomoUrl: config.matomoUrl,
            matomoSiteId: config.matomoSiteId,
            buildInfo: getBuildInfo(appEnv)
          }
        }),
        resolve({
          // ignore node_modules from vendored packages
          moduleDirectories: [path.join(process.cwd(), 'node_modules')],
          browser: true,
          preferBuiltins: true
        }),
        checkLicenses && license({
            banner: {
                commentStyle: 'ignored',
                content: `
License: <%= pkg.license %>
Dependencies:
<% _.forEach(dependencies, function (dependency) { if (dependency.name) { %>
<%= dependency.name %>: <%= dependency.license %><% }}) %>
`},
          thirdParty: {
            allow: {
              test: '(MIT OR BSD-3-Clause OR Apache-2.0 OR LGPL-2.1-or-later)',
              failOnUnlicensed: true,
              failOnViolation: true,
            },
          },
        }),
        commonjs({
            include: 'node_modules/**',
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
        copy({
            targets: [
                {src: 'assets/silent-check-sso.html', dest:'dist'},
                {src: 'assets/htaccess-shared', dest: 'dist/shared/', rename: '.htaccess'},
                {src: 'assets/*.css', dest: 'dist/local/' + pkg.name},
                {src: 'assets/*.ico', dest: 'dist/local/' + pkg.name},
                {src: 'assets/*.svg', dest: 'dist/local/' + pkg.name},
                {
                    src: 'node_modules/pdfjs-dist/es5/build/pdf.worker.js',
                    dest: 'dist/local/' + pkg.name + '/pdfjs',
                    // enable signatures in pdf preview
                    transform: (contents) => contents.toString().replace('"Sig"', '"Sig-patched-show-anyway"')
                },
                {src: 'node_modules/pdfjs-dist/cmaps/*', dest: 'dist/local/' + pkg.name + '/pdfjs'}, // do we want all map files?
                {src: await getPackagePath('@dbp-toolkit/font-source-sans-pro', 'files/*'), dest: 'dist/local/' + pkg.name + '/fonts/source-sans-pro'},
                {src: 'node_modules/@dbp-toolkit/common/src/spinner.js', dest: 'dist/local/' + pkg.name, rename: 'spinner.js'},
                {src: 'node_modules/@dbp-toolkit/common/misc/browser-check.js', dest: 'dist/local/' + pkg.name, rename: 'browser-check.js'},
                {src: 'assets/icon-*.png', dest: 'dist/local/' + pkg.name},
                {src: 'assets/*-placeholder.png', dest: 'dist/local/' + pkg.name},
                {src: 'assets/manifest.json', dest: 'dist', rename: pkg.name + '.manifest.json'},
                {src: 'assets/*.metadata.json', dest: 'dist'},
                {src: 'node_modules/@dbp-toolkit/common/assets/icons/*.svg', dest: 'dist/local/@dbp-toolkit/common/icons'},
                {src: 'node_modules/tabulator-tables/dist/css', dest: 'dist/local/@dbp-toolkit/file-handling/tabulator-tables'},
            ],
        }),
        useBabel && getBabelOutputPlugin({
          compact: false,
          presets: [[
            '@babel/preset-env', {
              loose: true,
              shippedProposals: true,
              bugfixes: true,
              modules: false,
              targets: {
                esmodules: true
              }
            }
          ]],
        }),
        useTerser ? terser() : false,
        watch ? serve({
          contentBase: '.',
          host: '127.0.0.1',
          port: 8001,
          historyApiFallback: config.basePath + pkg.name + '.html',
          https: useHTTPS ? await generateTLSConfig() : false,
          headers: {
              'Content-Security-Policy': config.CSP
          },
        }) : false
    ]
};})();