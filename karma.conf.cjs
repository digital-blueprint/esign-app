module.exports = async function (config) {
    // Only install browsers if they are not already installed by nix
    if (!process.env.FIREFOX_BIN || !process.env.CHROMIUM_BIN) {
        const {installBrowsersForNpmInstall, registry} = require('playwright-core/lib/server');
        await installBrowsersForNpmInstall(['firefox', 'chromium']);
        process.env.FIREFOX_BIN = registry.findExecutable('firefox').executablePath();
        process.env.CHROMIUM_BIN = registry.findExecutable('chromium').executablePath();
    }

    config.set({
        basePath: 'dist',
        frameworks: ['mocha', 'source-map-support'],
        client: {
            mocha: {
                ui: 'tdd',
                timeout: 2000 * (process.env.CI === undefined ? 1 : 10),
            },
        },
        files: [
            {pattern: './*.js', included: true, watched: true, served: true, type: 'module'},
            // XXX: nocache is required or karma serves garbage binary data for some reason
            {pattern: './**/*', included: false, watched: true, served: true, nocache: true},
        ],
        autoWatch: true,
        browsers: ['ChromiumHeadlessNoSandbox', 'FirefoxHeadless'],
        customLaunchers: {
            ChromiumHeadlessNoSandbox: {
                base: 'ChromiumHeadless',
                flags: ['--no-sandbox'],
            },
        },
        singleRun: false,
        logLevel: config.LOG_ERROR,
    });
};
