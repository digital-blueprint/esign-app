# Digital Signing Application

[GitHub Repository](https://github.com/digital-blueprint/esign-app) |
[npmjs package](https://www.npmjs.com/package/@digital-blueprint/esign-app) |
[Unpkg CDN](https://unpkg.com/browse/@digital-blueprint/esign-app/) |
[Esign Bundle](https://gitlab.tugraz.at/dbp/esign/dbp-relay-esign-bundle) |
[Project documentation](https://dbp-demo.tugraz.at/site/software/esign.html)

[![Build and Test](https://github.com/digital-blueprint/esign-app/actions/workflows/build-test-publish.yml/badge.svg)](https://github.com/digital-blueprint/esign-app/actions/workflows/build-test-publish.yml)

Esign - The digital signature service at the university.

## Prerequisites

- You need the [API server](https://github.com/digital-blueprint/relay-server-template) running
- You need the [DbpRelayEsignBundle](https://github.com/digital-blueprint/relay-esign-bundle) to allow signing of PDF files
- For more information please visit the [ESign project documentation](https://handbook.digital-blueprint.org/blueprints/esign/)

## Local development

```bash
# get the source
git clone git@github.com:digital-blueprint/esign-app.git
cd esign-app
git submodule update --init

# install dependencies
npm install

# constantly build dist/bundle.js and run a local web-server on port 8001
npm run watch

# constantly build dist/bundle.js and run a local web-server on port 8001 using a custom assets directory assets_custom/
npm run watch-custom

# run tests
npm test
```

Jump to <http://localhost:8001> and you should get a Single Sign On login page.

To use the Nextcloud functionality you need a running Nextcloud server with the
[webapppassword](https://github.com/digital-blueprint/webapppassword) Nextcloud app like this
[Nextcloud Development Environment](https://github.com/digital-blueprint/webapppassword/tree/main/docker).

## Using this app as pre-built package

### Install app

If you want to install the DBP Signature App in a new folder `signature-app` with a path prefix `/` you can call:

```bash
npx @digital-blueprint/cli install-app signature signature-app /
```

Afterwards you can point your Apache web-server to `signature-app/public`.

Make sure you are allowing `.htaccess` files in your Apache configuration.

Also make sure to add all of your resources you are using (like your API and Keycloak servers) to the
`Content-Security-Policy` in your `signature-app/public/.htaccess`, so the browser allows access to those sites.

You can also use this app directly from the [Unpkg CDN](https://unpkg.com/browse/@digital-blueprint/esign-app/)
for example like this: [dbp-signature/index.html](https://github.com/digital-blueprint/esign-app/-/tree/master/examples/dbp-signature/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

### Update app

If you want to update the DBP Signature App in the current folder you can call:

```bash
npx @digital-blueprint/cli update-app signature
```

## Activities

You can find the documentation of these activities in the [esign activities documentation](https://github.com/digital-blueprint/esign-app/tree/main/src).

## Adapt app

### Functionality

You can add multiple attributes to the `<dbp-signature>` tag.

| attribute name                   | value   | Link to description                                                                                                        |
| -------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `provider-root`                  | Boolean | [app-shell](https://github.com/digital-blueprint/toolkit/tree/main/packages/app-shell#attributes)                          |
| `lang`                           | String  | [language-select](https://github.com/digital-blueprint/toolkit/tree/main/packages/language-select#attributes)              |
| `entry-point-url`                | String  | [app-shell](https://github.com/digital-blueprint/toolkit/tree/main/packages/app-shell#attributes)                          |
| `keycloak-config`                | Object  | [app-shell](https://github.com/digital-blueprint/toolkit/tree/main/packages/app-shell#attributes)                          |
| `base-path`                      | String  | [app-shell](https://github.com/digital-blueprint/toolkit/tree/main/packages/app-shell#attributes)                          |
| `src`                            | String  | [app-shell](https://github.com/digital-blueprint/toolkit/tree/main/packages/app-shell#attributes)                          |
| `html-overrides`                 | String  | [common](https://github.com/digital-blueprint/toolkit/tree/main/packages/common#overriding-slots-in-nested-web-components) |
| `themes`                         | Array   | [theme-switcher](https://github.com/digital-blueprint/toolkit/tree/main/packages/theme-switcher#themes-attribute)          |
| `darkModeThemeOverride`          | String  | [theme-switcher](https://github.com/digital-blueprint/toolkit/tree/main/packages/theme-switcher#themes-attribute)          |
| `file-handling-enabled-targets`  | String  | [file-handling](https://github.com/digital-blueprint/toolkit/tree/main/packages/file-handling#attributes)                  |
| `nextcloud-web-app-password-url` | String  | [file-handling](https://github.com/digital-blueprint/toolkit/tree/main/packages/file-handling#attributes)                  |
| `nextcloud-web-dav-url`          | String  | [file-handling](https://github.com/digital-blueprint/toolkit/tree/main/packages/file-handling#attributes)                  |
| `nextcloud-file-url`             | String  | [file-handling](https://github.com/digital-blueprint/toolkit/tree/main/packages/file-handling#attributes)                  |
| `nextcloud-auth-info`            | String  | [file-handling](https://github.com/digital-blueprint/toolkit/tree/main/packages/file-handling#attributes)                  |
| `nextcloud-name`                 | String  | [file-handling](https://github.com/digital-blueprint/toolkit/tree/main/packages/file-handling#attributes)                  |
| `allow-annotating`               | Boolean | [esign activities](https://github.com/digital-blueprint/esign-app/tree/main/src)                                           |
| `file-handling-enabled-targets`  | String  | [esign activities](https://github.com/digital-blueprint/esign-app/tree/main/src)                                           |

#### Mandatory attributes

If you are not using the `provider-root` attribute to "terminate" all provider attributes
you need to manually add these attributes so that the topic will work properly:

```html
<dbp-signature
    auth
    requested-login-status
    analytics-event
    initial-file-handling-state
    clipboard-files></dbp-signature>
```

### Design

For frontend design customizations, such as logo, colors, font, favicon, and more, take a look at the [theming documentation](https://handbook.digital-blueprint.org/frameworks/frontend/theming/).

## "dbp-signature" slots

These are common slots for the app-shell. You can find the documentation of these slots in the [app-shell documentation](https://github.com/digital-blueprint/toolkit/tree/main/packages/app-shell).
For the app specific slots take a look at the [esign activities documentation](https://github.com/digital-blueprint/esign-app/tree/main/src).
