module.exports = function (config) {
    config.set({
        basePath: 'dist',
        frameworks: ['mocha'],
        client: {
            mocha: {
                ui: 'tdd',
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
