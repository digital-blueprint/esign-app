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
for example like this: [dbp-signature/index.html](https://gitlab.tugraz.at/dbp/esign/signature/-/tree/master/examples/dbp-signature/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

## Activities

### dbp-qualified-signature-pdf-upload

You can also use a single activity directly from the [Unpkg CDN](https://unpkg.com/browse/@dbp-topics/signature/)
for example the `dbp-qualified-signature-pdf-upload` activity to qualifiedly sign PDF documents like this:
[dbp-qualified-signature-pdf-upload/index.html](https://gitlab.tugraz.at/dbp/esign/signature/-/tree/master/examples/dbp-qualified-signature-pdf-upload/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.
