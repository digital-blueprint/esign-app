# Digital Signing  activities

Here you can find the individual activities of the `esign` app. If you want to use the whole app look at [esign](https://gitlab.tugraz.at/dbp/esign/signature).

<!-- ## Usage of an activity
TODO add description how to only use an activity alone here
-->

## Activities

### Shared Attributes

These attributes are available for all activities listed here:

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
  - example `lang="de"`

### dbp-qualified-signature-pdf-upload

You can use this activity to qualifiedly sign PDF documents like this:
[dbp-qualified-signature-pdf-upload/index.html](https://gitlab.tugraz.at/dbp/esign/signature/-/tree/master/examples/dbp-qualified-signature-pdf-upload/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
    - example `entry-point-url="https://api-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider
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
- `file-handling-enabled-targets` (optional, default: `local`): Needs to be set to allow using other filehandling
  targets than local, comma seperated list
  actual supported: `local`, `clipboard`, `nextcloud`
    - example `file-handling-enabled-targets="local,nextcloud,clipboard"`
    
### dbp-official-signature-pdf-upload

You can use this activity to officially sign PDF documents like this:
[dbp-official-signature-pdf-upload/index.html](https://gitlab.tugraz.at/dbp/esign/signature/-/tree/master/examples/dbp-official-signature-pdf-upload/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
    - example `entry-point-url="https://api-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider
- `allow-annotating` (optional): Needs to be set to allow annotating the PDFs
    - example `allow-annotating`
- `file-handling-enabled-targets` (optional, default: `local`): Needs to be set to allow using other filehandling
  targets than local, comma seperated list
  actual supported: `local`, `clipboard`, `nextcloud`
    - example `file-handling-enabled-targets="local,nextcloud,clipboard"`
    
### dbp-signature-verification

This activity shows an information page where to verify signed documents, you can use it like this:
[dbp-signature-verification/index.html](https://gitlab.tugraz.at/dbp/esign/signature/-/tree/master/examples/dbp-signature-verification/index.html)

#### Attributes

See [shared attributes](#shared-attributes).

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

## Design Note

To ensure a uniform and responsive design these activities should occupy 100% width of the window when the activities' width are under 768 px.

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
