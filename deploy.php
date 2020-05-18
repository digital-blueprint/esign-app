<?php
namespace Deployer;

require 'recipe/common.php';
require 'recipe/rsync.php';

// Global config
set('allow_anonymous_stats', false);

// Hosts
host('demo')
    ->stage('demo')
    ->hostname('mw@mw01-dev.tugraz.at')
    ->set('deploy_path', '/home/mw/demo/deploy/apps/signature')
    -> set('rsync',[
        'exclude'      => [
            '.git',
            'deploy.php',
        ],
        'exclude-file' => false,
        'include'      => [],
        'include-file' => false,
        'filter'       => [],
        'filter-file'  => false,
        'filter-perdir'=> false,
        'flags'        => 'rz',
        'options'      => ['delete'],
        'timeout'      => 60,
    ])
    -> set('rsync_src', __DIR__ . '/dist')
    -> set('rsync_dest','{{release_path}}');

host('development')
    ->stage('development')
    ->hostname('mw@mw01-dev.tugraz.at')
    ->set('deploy_path', '/home/mw/dev/deploy/apps/signature')
    -> set('rsync',[
        'exclude'      => [
            '.git',
            'deploy.php',
        ],
        'exclude-file' => false,
        'include'      => [],
        'include-file' => false,
        'filter'       => [],
        'filter-file'  => false,
        'filter-perdir'=> false,
        'flags'        => 'rz',
        'options'      => ['delete'],
        'timeout'      => 60,
    ])
    -> set('rsync_src', __DIR__ . '/dist')
    -> set('rsync_dest','{{release_path}}');

host('production')
    ->stage('production')
    ->hostname('mw@mw01-prod.tugraz.at')
    ->set('deploy_path', '/home/mw/prod_esig/deploy')
    -> set('rsync',[
        'exclude'      => [
            '.git',
            'deploy.php',
        ],
        'exclude-file' => false,
        'include'      => [],
        'include-file' => false,
        'filter'       => [],
        'filter-file'  => false,
        'filter-perdir'=> false,
        'flags'        => 'rz',
        'options'      => ['delete'],
        'timeout'      => 60,
    ])
    -> set('rsync_src', __DIR__ . '/dist')
    -> set('rsync_dest','{{release_path}}');

// Demo build task
task('build-demo', function () {
    runLocally("npm install");
    runLocally("npm run build-demo");
})->onStage('demo');

// Demo dev task
task('build-development', function () {
    runLocally("npm install");
    runLocally("npm run build-dev");
})->onStage('development');

//Production task
task('build-production', function () {
    runLocally("npm install");
    runLocally("npm run build-prod");
})->onStage('production');

// Deploy task
task('deploy', [
    'deploy:info',
    'build-demo',
    'build-development',
    'build-production',
    'deploy:prepare',
    'deploy:lock',
    'deploy:release',
    'rsync',
    'deploy:shared',
    'deploy:symlink',
    'deploy:unlock',
    'cleanup',
    'success',
]);
after('deploy:failed', 'deploy:unlock');
