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

You can use this activity to qualifiedly sign PDF documents like this:
[dbp-qualified-signature-pdf-upload/index.html](https://gitlab.tugraz.at/dbp/esign/signature/-/tree/master/examples/dbp-qualified-signature-pdf-upload/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
    - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
    - example `entry-point-url="https://mw-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider
- `show-nextcloud-file-picker` (optional): Needs to be set for the Nextcloud file picker to be shown
    - example `show-nextcloud-file-picker`
- `nextcloud-web-app-password-url` (optional): Nextcloud Auth Url to use with the Nextcloud file picker
    - example `nextcloud-web-app-password-url="http://localhost:8081/index.php/apps/webapppassword"`
    - `nextcloud-web-dav-url` also needs to be set for the Nextcloud file picker to be active
- `nextcloud-web-dav-url` (optional): Nextcloud WebDav Url to use with the Nextcloud file picker
    - example `nextcloud-web-dav-url="http://localhost:8081/remote.php/dav/files"`
    - `nextcloud-web-app-password-url` also needs to be set for the Nextcloud file picker to be active
- `nextcloud-file-url` (optional): Nextcloud File Url to use with the Nextcloud file picker
    - example `nextcloud-file-url="http://localhost:8081/apps/files/?dir="`
- `nextcloud-name` (optional): Name of the Nextcloud service
    - example `nextcloud-name="My Nextcloud"`
- `nextcloud-auth-info` (optional): Additional authentication information text that is shown in the Nextcloud file picker
    - example `nextcloud-auth-info="You need special permissions for this function"`
- `allow-annotating` (optional): Needs to be set to allow annotating the PDFs
    - example `allow-annotating`

#### Exposed CSS variables

- `--dbp-override-image-nextcloud` is used to override the cloud image on the connection screen of the Nextcloud file picker
  - example CSS: `html { --dbp-override-image-nextcloud: url(/icons/nextcloud.svg); }`

### dbp-official-signature-pdf-upload

You can use this activity to officially sign PDF documents like this:
[dbp-official-signature-pdf-upload/index.html](https://gitlab.tugraz.at/dbp/esign/signature/-/tree/master/examples/dbp-official-signature-pdf-upload/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
    - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
    - example `entry-point-url="https://mw-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider
- `show-nextcloud-file-picker` (optional): Needs to be set for the Nextcloud file picker to be shown
    - example `show-nextcloud-file-picker`
- `nextcloud-web-app-password-url` (optional): Nextcloud Auth Url to use with the Nextcloud file picker
    - example `nextcloud-web-app-password-url="http://localhost:8081/index.php/apps/webapppassword"`
    - `nextcloud-web-dav-url` also needs to be set for the Nextcloud file picker to be active
- `nextcloud-web-dav-url` (optional): Nextcloud WebDav Url to use with the Nextcloud file picker
    - example `nextcloud-web-dav-url="http://localhost:8081/remote.php/dav/files"`
    - `nextcloud-web-app-password-url` also needs to be set for the Nextcloud file picker to be active
- `nextcloud-file-url` (optional): Nextcloud File Url to use with the Nextcloud file picker
    - example `nextcloud-file-url="http://localhost:8081/apps/files/?dir="`
- `nextcloud-name` (optional): Name of the Nextcloud service
    - example `nextcloud-name="My Nextcloud"`
- `nextcloud-auth-info` (optional): Additional authentication information text that is shown in the Nextcloud file picker
    - example `nextcloud-auth-info="You need special permissions for this function"`
- `allow-annotating` (optional): Needs to be set to allow annotating the PDFs
    - example `allow-annotating`
- `show-clipboard` (optional): Needs to be set to allow using the clipboard in the file picker dialog
    - example `show-clipboard`

#### Exposed CSS variables

- `--dbp-override-image-nextcloud` is used to override the cloud image on the connection screen of the Nextcloud file picker
  - example CSS: `html { --dbp-override-image-nextcloud: url(/icons/nextcloud.svg); }`

### dbp-signature-verification

This activity shows an information page where to verify signed documents, you can use it like this:
[dbp-signature-verification/index.html](https://gitlab.tugraz.at/dbp/esign/signature/-/tree/master/examples/dbp-signature-verification/index.html)

#### Attributes

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
    - example `lang="de"`

#### Slots

You use templates tags to inject slots into the activity.
These templates will be converted to div containers when the page is loaded and will not show up before that.

##### additional-information

The content of this slot will be shown below the other text and can be used to provide
further information about the verification process. For example a link to a page with
more information about verifying a document with Adobe Reader can be provided.

Example:

```html
<dbp-signature-verification lang="de">
  <template slot="additional-information">
    <dbp-translated subscribe="lang">
      <div slot="de">
        <a target="_blank" href="#german-link">
          Weitere Information zur Verifikation mit Adobe Reader
        </a>
      </div>
      <div slot="en">
        <a target="_blank" href="#english-link">
          More information about verification with Adobe Reader
        </a>
      </div>
    </dbp-translated>
  </template>
</dbp-signature-verification>
```

## Design Notes

To ensure a uniform and responsive design the activity should occupy 100% of the window width
when the activity width is less than 768 px.

## Mandatory attributes

If you are not using the `provider-root` attribute to "terminate" all provider attributes
you need to manually add these attributes so that the topic will work properly:

```html
<dbp-signature
    auth
    requested-login-status
    analytics-event
    initial-file-handling-state
    clipboard-files
>
</dbp-signature>
```
