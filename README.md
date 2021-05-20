# Digital Signing Application

[GitLab Repository](https://gitlab.tugraz.at/dbp/esign/signature) |
[npmjs package](https://www.npmjs.com/package/@dbp-topics/signature) |
[Unpkg CDN](https://unpkg.com/browse/@dbp-topics/signature/)

## Local development

```bash
# get the source
git clone git@gitlab.tugraz.at:dbp/esign/signature.git
cd signature
git submodule update --init

# install dependencies
yarn install

# constantly build dist/bundle.js and run a local web-server on port 8001 
yarn run watch

# run tests
yarn test
```

Jump to <http://localhost:8001> and you should get a Single Sign On login page.

To use the Nextcloud functionality you need a running Nextcloud server with the
[webapppassword](https://gitlab.tugraz.at/DBP/Middleware/Nextcloud/webapppassword) Nextcloud app like this
[Nextcloud Development Environment](https://gitlab.tugraz.at/DBP/Middleware/Nextcloud/webapppassword/-/tree/master/docker).

## Using this app as pre-built package

Not only you can use this app as pre-built package installed from [npmjs](https://www.npmjs.com/package/@dbp-topics/signature) via:

```bash
npm install @dbp-topics/signature
```

But you can also use this app directly from the [Unpkg CDN](https://unpkg.com/browse/@dbp-topics/signature/)
for example like this:

```html
<!doctype html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <!-- Favicons -->
    <link rel="shortcut icon" type="image/x-icon" href="https://unpkg.com/@dbp-topics/signature@1.0.2/dist/local/@dbp-topics/signature/favicon.ico">
    <link rel="icon" type="image/svg+xml" href="https://unpkg.com/@dbp-topics/signature@1.0.2/dist/local/@dbp-topics/signature/favicon.svg" sizes="any">

    <!-- PWA manfiest file -->
    <link rel="manifest" href="https://unpkg.com/@dbp-topics/signature@1.0.2/dist/dbp-signature.manifest.json">

    <!-- PWA iphone -->
    <link rel="apple-touch-icon" sizes="180x180" href="https://unpkg.com/@dbp-topics/signature@1.0.2/dist/local/@dbp-topics/signature/icon-180x180.png">
    <link rel="icon" type="image/png" sizes="32x32" href="https://unpkg.com/@dbp-topics/signature@1.0.2/dist/local/@dbp-topics/signature/icon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="https://unpkg.com/@dbp-topics/signature@1.0.2/dist/local/@dbp-topics/signature/icon-16x16.png">

    <!-- Loading spinner -->
    <script type="module">
        import {Spinner} from 'https://unpkg.com/@dbp-topics/signature@1.0.2/dist/local/@dbp-topics/signature/spinner.js';
        customElements.define('dbp-loading-spinner', Spinner);
    </script>

    <!-- App bundles-->
    <script type="module" src="https://unpkg.com/@dbp-topics/signature@1.0.2/dist/dbp-signature.js"></script>

    <!-- Prevent Chrome/Edge from suggesting to translate the page -->
    <meta name="google" content="notranslate">

    <!-- Font related CSS -->
    <style>
        @import "https://unpkg.com/@dbp-topics/signature@1.0.2/dist/local/@dbp-topics/signature/fonts/source-sans-pro/300.css";
        @import "https://unpkg.com/@dbp-topics/signature@1.0.2/dist/local/@dbp-topics/signature/fonts/source-sans-pro/400.css";
        @import "https://unpkg.com/@dbp-topics/signature@1.0.2/dist/local/@dbp-topics/signature/fonts/source-sans-pro/600.css";

        body {
            font-family: 'Source Sans Pro', 'Calibri', 'Arial', 'sans-serif';
            font-weight: 300;
            margin: 0;
        }

        /* TU-Graz style override */
        html {
            --dbp-override-primary-bg-color: #245b78;
            --dbp-override-primary-button-border: solid 1px #245b78;
            --dbp-override-info-bg-color: #245b78;
            --dbp-override-danger-bg-color: #e4154b;
            --dbp-override-warning-bg-color: #ffe183;
            --dbp-override-warning-text-color: black;
            --dbp-override-success-bg-color: #259207;
        }
    </style>

    <!-- Preloading/Preconnecting -->
    <link rel="preconnect" href="https://mw-dev.tugraz.at">
    <link rel="preconnect" href="https://auth-dev.tugraz.at/auth">
</head>

<body>
<dbp-signature
        lang="de" entry-point-url="https://mw-dev.tugraz.at"
        show-nextcloud-file-picker
        show-clipboard
        allow-annotating
        nextcloud-web-app-password-url="http://localhost:8081/index.php/apps/webapppassword"
        nextcloud-webdav-url="http://localhost:8081/remote.php/dav/files"
        nextcloud-name="TU Graz cloud"
        nextcloud-file-url="http://localhost:8081/index.php/apps/files/?dir="
        initial-file-handling-state
        clipboard-files
        auth requested-login-status analytics-event
        src="https://unpkg.com/@dbp-topics/signature@1.0.2/dist/dbp-signature.topic.metadata.json"
        base-path="/"
        keycloak-config='{"url": "https://auth-dev.tugraz.at/auth", "realm": "tugraz", "clientId": "auth-dev-mw-frontend-local", "silentCheckSsoRedirectUri": "./silent-check-sso.html"}'
        matomo-url='https://analytics.tugraz.at/'
        matomo-site-id='131'
        env='local'
><dbp-loading-spinner></dbp-loading-spinner></dbp-signature>

<!-- Error handling for too old browsers -->
<script src="https://unpkg.com/@dbp-topics/signature@1.0.2/dist/local/@dbp-topics/signature/browser-check.js" defer></script>
<noscript>Diese Applikation benötigt Javascript / This application requires Javascript</noscript>
</body>
</html>
```

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.
