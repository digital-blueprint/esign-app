import {createI18nInstance} from './i18n.js';
import {humanFileSize} from 'dbp-common/i18next.js';
import {css, html} from 'lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPSignatureLitElement from "./dbp-signature-lit-element";
import {PdfPreview} from "./dbp-pdf-preview";
import * as commonUtils from 'dbp-common/utils';
import * as utils from './utils';
import {Button, Icon, MiniSpinner} from 'dbp-common';
import * as commonStyles from 'dbp-common/styles';
import {classMap} from 'lit-html/directives/class-map.js';
import {FileSource} from 'dbp-file-handling';
import JSONLD from "dbp-common/jsonld";
import {TextSwitch} from './textswitch.js';
import nextcloudWebAppPasswordURL from 'consts:nextcloudWebAppPasswordURL';
import nextcloudWebDavURL from 'consts:nextcloudWebDavURL';
import nextcloudName from 'consts:nextcloudName';
import {FileSink} from "dbp-file-handling";
import FileSaver from 'file-saver';

const i18n = createI18nInstance();

class QualifiedSignaturePdfUpload extends ScopedElementsMixin(DBPSignatureLitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
        this.externalAuthInProgress = false;
        this.signedFiles = [];
        this.signedFilesCount = 0;
        this.signedFilesToDownload = 0;
        this.errorFiles = [];
        this.errorFilesCount = 0;
        this.uploadStatusFileName = "";
        this.uploadStatusText = "";
        this.currentFile = {};
        this.currentFileName = "";
        this.currentFilePlacementMode = "";
        this.currentFileSignaturePlacement = {};
        this.signingProcessEnabled = false;
        this.signingProcessActive = false;
        this.signaturePlacementInProgress = false;
        this.withSigBlock = false;
        this.queuedFilesSignaturePlacements = [];
        this.queuedFilesPlacementModes = [];
        this.currentPreviewQueueKey = '';

        this._onReceiveIframeMessage = this.onReceiveIframeMessage.bind(this);
        this._onReceiveBeforeUnload = this.onReceiveBeforeUnload.bind(this);
    }

    static get scopedElements() {
        return {
          'dbp-icon': Icon,
          'dbp-file-source': FileSource,
          'dbp-file-sink': FileSink,
          'dbp-pdf-preview': PdfPreview,
          'dbp-mini-spinner': MiniSpinner,
          'dbp-button': Button,
          'dbp-textswitch': TextSwitch,
        };
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            signedFiles: { type: Array, attribute: false },
            signedFilesCount: { type: Number, attribute: false },
            signedFilesToDownload: { type: Number, attribute: false },
            queuedFilesCount: { type: Number, attribute: false },
            errorFiles: { type: Array, attribute: false },
            errorFilesCount: { type: Number, attribute: false },
            uploadInProgress: { type: Boolean, attribute: false },
            uploadStatusFileName: { type: String, attribute: false },
            uploadStatusText: { type: String, attribute: false },
            externalAuthInProgress: { type: Boolean, attribute: false },
            signingProcessEnabled: { type: Boolean, attribute: false },
            signingProcessActive: { type: Boolean, attribute: false },
            queueBlockEnabled: { type: Boolean, attribute: false },
            currentFile: { type: Object, attribute: false },
            currentFileName: { type: String, attribute: false },
            signaturePlacementInProgress: { type: Boolean, attribute: false },
            withSigBlock: { type: Boolean, attribute: false },
            isSignaturePlacement: { type: Boolean, attribute: false },
        };
    }

    connectedCallback() {
        super.connectedCallback();
        // needs to be called in a function to get the variable scope of "this"
        setInterval(() => { this.handleQueuedFiles(); }, 1000);

        this.updateComplete.then(()=>{
            // see: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
            window.addEventListener('message', this._onReceiveIframeMessage);

            // we want to be able to cancel the leaving of the page
            window.addEventListener('beforeunload', this._onReceiveBeforeUnload);
        });
    }

    disconnectedCallback() {
        // remove event listeners
        window.removeEventListener('message', this._onReceiveIframeMessage);
        window.removeEventListener('beforeunload', this._onReceiveBeforeUnload);

        super.disconnectedCallback();
    }

    /**
     * Processes queued files
     */
    async handleQueuedFiles() {
        if (this.queuedFilesCount === 0) {
            // reset signingProcessEnabled button
            this.signingProcessEnabled = false;

            return;
        }

        if (!this.signingProcessEnabled || this.externalAuthInProgress || this.uploadInProgress) {
            return;
        }

        this.signaturePlacementInProgress = false;

        const key = Object.keys(this.queuedFiles)[0];

        // take the file off the queue
        const file = this.takeFileFromQueue(key);
        this.currentFile = file;

        // set placement mode and parameters to restore them when canceled
        this.currentFilePlacementMode = this.queuedFilesPlacementModes[key];
        this.currentFileSignaturePlacement = this.queuedFilesSignaturePlacements[key];

        this.uploadInProgress = true;
        let params = {};

        // prepare parameters to tell PDF-AS where and how the signature should be placed
        if (this.queuedFilesPlacementModes[key] === "manual") {
            const data = this.queuedFilesSignaturePlacements[key];
            if (data !== undefined) {
                params = utils.fabricjs2pdfasPosition(data);
            }
        }

        this.uploadStatusText = i18n.t('qualified-pdf-upload.upload-status-file-text', {
            fileName: file.name,
            fileSize: humanFileSize(file.size, false),
        });

        await this.uploadFile(file, params);
        this.uploadInProgress = false;
    }

    storePDFData(event) {
        this.queuedFilesSignaturePlacements[this.currentPreviewQueueKey] = event.detail;
        this.signaturePlacementInProgress = false;
    }

    /**
     * Called when preview is "canceled"
     *
     * @param event
     */
    hidePDF(event) {
        // reset placement mode to "auto" if no placement was confirmed previously
        if (this.queuedFilesSignaturePlacements[this.currentPreviewQueueKey] === undefined) {
            this.queuedFilesPlacementModes[this.currentPreviewQueueKey] = "auto";
        }

        this.signaturePlacementInProgress = false;
    }

    queuePlacementSwitch(key, name) {
        this.queuedFilesPlacementModes[key] = name;
        console.log(name);

        if (name === "manual") {
            this.showPreview(key, true);
        } else if (this.currentPreviewQueueKey === key) {
            this.signaturePlacementInProgress = false;
        }
    }

    /**
     * Decides if the "beforeunload" event needs to be canceled
     *
     * @param event
     */
    onReceiveBeforeUnload(event) {
        // we don't need to stop if there are no signed files
        if (this.signedFilesCount === 0) {
            return;
        }

        // we need to handle custom events ourselves
        if (!event.isTrusted) {
            // note that this only works with custom event since calls of "confirm" are ignored
            // in the non-custom event, see https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
            const result = confirm(i18n.t('qualified-pdf-upload.confirm-page-leave'));

            // don't stop the page leave if the user wants to leave
            if (result) {
                return;
            }
        }

        // Cancel the event as stated by the standard
        event.preventDefault();

        // Chrome requires returnValue to be set
        event.returnValue = '';
    }

    /**
     * Parse error message for user friendly output
     *
     * @param error
     */
    parseError(error) {
        let errorParsed = error;
        // Common Error Messages fpr pdf-as: https://www.buergerkarte.at/konzept/securitylayer/spezifikation/20140114/errorcodes/errorcodes.html
        // SecurityLayer Error: [6000] Unklassifizierter Abbruch durch den Bürger.
        if (error.includes('SecurityLayer Error: [6001]'))
        {
            errorParsed = i18n.t('error-cancel-message');
        }
        // SecurityLayer Error: [6001] Abbruch durch den Bürger über die Benutzerschnittstelle.
        else if (error.includes('SecurityLayer Error: [6000]'))
        {
            errorParsed = i18n.t('error-cancel-message');
        }
        // SecurityLayer Error: [6002] Abbruch auf Grund mangelnder Rechte zur Befehlsausführung.
        else if (error.includes('SecurityLayer Error: [6002]'))
        {
            errorParsed = i18n.t('error-rights-message');
        }
        return errorParsed;
    }

    onReceiveIframeMessage(event) {
        const data = event.data;

        // check if this is really a postMessage from our iframe without using event.origin
        if (data.type === 'pdf-as-error') {
            let file = this.currentFile;
            let error = data.error;
            if (data.cause) {
                error = `${error}: ${data.cause}`;
            }
            file.json = {"hydra:description" : this.parseError(error)};
            this.addToErrorFiles(file);
            this._("#iframe").src = "about:blank";
            this.externalAuthInProgress = false;
            this.endSigningProcessIfQueueEmpty();
            return;
        }

        if (data.type !== 'pdf-as-callback') {
            return;
        }

        const sessionId = data.sessionId;

        // check if sessionId is valid
        if ((typeof sessionId !== 'string') || (sessionId.length < 15)) {
            return;
        }

        console.log("Got iframe message for sessionId " + sessionId + ", origin: " + event.origin);
        const that = this;

        // get correct file name
        const fileName = this.currentFileName === "" ? "mydoc.pdf" : this.currentFileName;

        // fetch pdf from api gateway with sessionId
        JSONLD.initialize(this.entryPointUrl, (jsonld) => {
            const apiUrl = jsonld.getApiUrlForEntityName("QualifiedlySignedDocument") + '/' + sessionId + '?fileName=' +
                encodeURI(fileName);

            fetch(apiUrl, {
                headers: {
                    'Content-Type': 'application/ld+json',
                    'Authorization': 'Bearer ' + window.DBPAuthToken,
                },
            })
                .then(result => {
                    // hide iframe
                    that.externalAuthInProgress = false;
                    this._("#iframe").src = "about:blank";
                    this.endSigningProcessIfQueueEmpty();

                    if (!result.ok) throw result;

                    return result.json();
                })
                .then((document) => {
                    // PDF-AS garbles some filenames (e.g. containing a '#')
                    document.signedFilename = this.currentFileName.replace(/\.pdf$/i, '.sig.pdf');
                    // this doesn't seem to trigger an update() execution
                    that.signedFiles.push(document);
                    // this triggers the correct update() execution
                    that.signedFilesCount++;

                    if (window._paq !== undefined) {
                        window._paq.push(['trackEvent', 'QualifiedlySigning', 'DocumentSigned', document.contentSize]);
                    }
                }).catch(error => {
                    let file = this.currentFile;
                    // let's override the json to inject an error message
                    file.json = {"hydra:description" : "Download failed!"};

                    this.addToErrorFiles(file);
                });
        }, {}, that.lang);

    }

    endSigningProcessIfQueueEmpty() {
        if (this.queuedFilesCount === 0 && this.signingProcessActive) {
            this.signingProcessActive = false;
        }
    }

    /**
     * @param ev
     */
    onFileSelected(ev) {
        console.log("File was selected: ev", ev);
        this.queueFile(ev.detail.file);
    }

    addToErrorFiles(file) {
        this.endSigningProcessIfQueueEmpty();

        // this doesn't seem to trigger an update() execution
        this.errorFiles[Math.floor(Math.random() * 1000000)] = file;
        // this triggers the correct update() execution
        this.errorFilesCount++;

        if (window._paq !== undefined) {
            window._paq.push(['trackEvent', 'QualifiedlySigning', 'SigningFailed', file.json["hydra:description"]]);
        }
    }

    /**
     * @param data
     */
    onFileUploadFinished(data) {
        if (data.status !== 201) {
            this.addToErrorFiles(data);
        } else if (data.json["@type"] === "http://schema.org/EntryPoint" ) {
            // after the "real" upload we immediately start with the 2FA process

            // show the iframe and lock processing
            this.externalAuthInProgress = true;

            const entryPoint = data.json;
            this.currentFileName = entryPoint.name;

            // we need the full file to upload it again in case the download of the signed file fails
            this.currentFile = data;

            // we want to load the redirect url in the iframe
            let iframe = this._("#iframe");
            iframe.src = entryPoint.url;
        }
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "lang":
                    i18n.changeLanguage(this.lang);
                    break;
                case "entryPointUrl":
                    JSONLD.initialize(this.entryPointUrl, (jsonld) => {
                        const apiUrlBase = jsonld.getApiUrlForEntityName("QualifiedSigningRequest");
                        this.fileSourceUrl = apiUrlBase + "/create";
                    });
                    break;
            }

            // console.log(propName, oldValue);
        });

        super.update(changedProperties);
    }

    onLanguageChanged(e) {
        this.lang = e.detail.lang;
    }

    /**
     * Re-Upload all failed files
     */
    reUploadAllClickHandler() {
        const that = this;

        // we need to make a copy and reset the queue or else our queue will run crazy
        const errorFilesCopy = {...this.errorFiles};
        this.errorFiles = [];
        this.errorFilesCount = 0;

        commonUtils.asyncObjectForEach(errorFilesCopy, async (file, id) => {
            await this.fileQueueingClickHandler(file.file, id);
        });

        that._("#re-upload-all-button").stop();
    }

    /**
     * Queues a failed pdf-file again
     *
     * @param file
     * @param id
     */
    async fileQueueingClickHandler(file, id) {
        this.takeFailedFileFromQueue(id);

        return this.queueFile(file);
    }

    /**
     * Shows the preview
     *
     * @param key
     * @param withSigBlock
     */
    async showPreview(key, withSigBlock=false) {
        if (this.signingProcessEnabled) {
            return;
        }

        const file = this.getQueuedFile(key);
        this.currentFile = file;
        this.currentPreviewQueueKey = key;
        console.log(file);
        // start signature placement process
        this.signaturePlacementInProgress = true;
        this.withSigBlock = withSigBlock;

        const previewTag = this.constructor.getScopedTagName("dbp-pdf-preview");
        await this._(previewTag).showPDF(
            file,
            withSigBlock, //this.queuedFilesPlacementModes[key] === "manual",
            this.queuedFilesSignaturePlacements[key]);
    }

    /**
     * Takes a failed file off of the queue
     *
     * @param key
     */
    takeFailedFileFromQueue(key) {
        const file = this.errorFiles.splice(key, 1);
        this.errorFilesCount = Object.keys(this.errorFiles).length;

        return file;
    }

    clearQueuedFiles() {
        this.queuedFilesSignaturePlacements = [];
        this.queuedFilesPlacementModes = [];
        super.clearQueuedFiles();
    }

    clearSignedFiles() {
        this.signedFiles = [];
        this.signedFilesCount = 0;
    }

    clearErrorFiles() {
        this.errorFiles = [];
        this.errorFilesCount = 0;
    }

    isUserInterfaceDisabled() {
        return this.signaturePlacementInProgress || this.externalAuthInProgress || this.uploadInProgress;
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getButtonCSS()}
            ${commonStyles.getNotificationCSS()}

            #pdf-preview {
                min-width: 320px;
            }

            h2:first-child {
                margin-top: 0;
            }

            h2 {
                margin-bottom: 10px;
            }

            strong {
                font-weight: 600;
            }

            #pdf-preview .box-header {
                border: 1px solid #000;
                border-bottom-width: 0;
                padding: 0.5em 0.5em 0 0.5em;
            }

            .hidden {
                display: none;
            }

            #iframe {
                width: 100%;
                height: 240px;
                /* "overflow" should not be supported by browsers, but some seem to use it */
                overflow: hidden;
                border-width: 0;
                /* keeps the A-Trust webpage aligned left */
                max-width: 575px;
            }

            .files-block.field:not(:last-child) {
                margin-bottom: 40px;
            }

            .files-block .file {
                margin: 10px 0;
            }

            .error-files .file {
                display: grid;
                grid-template-columns: 40px auto;
            }

            .files-block .file .button-box {
                display: flex;
                align-items: center;
            }

            .files-block .file .info {
                display: inline-block;
                vertical-align: middle;
            }

            .file .info strong {
                font-weight: 600;
            }

            .notification dbp-mini-spinner {
                position: relative;
                top: 2px;
                margin-right: 5px;
            }

            .error, #cancel-signing-process {
                color: #e4154b;
            }

            #cancel-signing-process:hover {
                color: white;
            }

            /* using dbp-icon doesn't work */
            button > [name=close], a > [name=close] {
                font-size: 0.8em;
            }

            a > [name=close] {
                color: red;
            }

            .empty-queue {
                margin: 10px 0;
            }

            #grid-container {
                display: flex;
                flex-flow: row wrap;
            }

            #grid-container > div {
                margin-right: 20px;
            }

            #grid-container > div:last-child {
                margin-right: 0;
                flex: 1 0;
            }

            .file-block {
                max-width: 320px;
            }

            .file-block, .box {
                border: solid 1px black;
                padding: 10px;
            }

            .file-block, .box .file {
                margin-top: 0;
            }

            .file-block {
                margin-bottom: 10px;
            }

            .file-block .header {
                display: grid;
                align-items: center;
                grid-template-columns: auto 40px;
                grid-gap: 10px;
            }

            .file-block.error .header {
                grid-template-columns: auto 80px;
            }

            .file-block.error .header .buttons {
                white-space: nowrap;
            }

            .file-block div.bottom-line {
                display: grid;
                align-items: center;
                grid-template-columns: auto 190px;
                grid-gap: 10px;
                margin-top: 10px;
            }

            .file-block.error div.bottom-line {
                display: block;
            }

            .file-block div.bottom-line .headline {
                text-align: right;
            }

            .file-block .filename, .file-block div.bottom-line .headline {
                text-overflow: ellipsis;
                overflow: hidden;
            }

            .file-block .filename {
                white-space: nowrap;
            }

            #pdf-preview .button.is-cancel, #external-auth .button.is-cancel {
                color: #e4154b;
            }

            #external-auth iframe {
                margin-top: 0.5em;
            }

            .is-right {
                float: right;
            }

            .error-files .header {
                color: black;
            }

            /* prevent hovering of disabled default button */
            .button[disabled]:not(.is-primary):hover {
                background-color: inherit;
                color: inherit;
            }

            .is-disabled, .is-disabled.button[disabled] {
                opacity: 0.2;
                pointer-events: none;
            }

            #pdf-preview .box-header, #external-auth .box-header {
                display: flex;
                justify-content: space-between;
                align-items: start;
            }

            #pdf-preview .box-header .filename, #external-auth .box-header .filename {
                overflow: hidden;
                text-overflow: ellipsis;
                margin-right: 0.5em;
            }
            
            #grid-container{
                margin-top: 2rem;
                padding-top: 2rem;
            }
            
            .border{
                border-top: 1px solid black;            
            }

            /* Handling for small displays (like mobile devices) */
            @media (max-width: 680px) {
                /* Modal preview, upload and external auth */
                div.right-container > * {
                    position: fixed;
                    padding: 10px;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: white;
                    overflow-y: scroll;
                }

                /* Don't use the whole screen for the upload progress */
                #upload-progress {
                    top: 10px;
                    left: 10px;
                    right: 10px;
                    bottom: inherit;
                }

                #grid-container > div {
                    margin-right: 0;
                    width: 100%;
                }

                .file-block {
                    max-width: inherit;
                }
            }
        `;
    }

    /**
     * Returns the list of queued files
     *
     * @returns {*[]} Array of html templates
     */
    getQueuedFilesHtml() {
        const ids = Object.keys(this.queuedFiles);
        let results = [];

        ids.forEach((id) => {
            const file = this.queuedFiles[id];

            results.push(html`
                <div class="file-block">
                    <div class="header">
                        <span class="filename"><strong>${file.name}</strong> (${humanFileSize(file.size)})</span>
                        <button class="button close"
                            ?disabled="${this.signingProcessEnabled}"
                            title="${i18n.t('qualified-pdf-upload.remove-queued-file-button-title')}"
                            @click="${() => { this.takeFileFromQueue(id); }}">
                            <dbp-icon name="trash"></dbp-icon></button>
                    </div>
                    <div class="bottom-line">
                        <div></div>
                        <button class="button"
                            ?disabled="${this.signingProcessEnabled}"
                            @click="${() => { this.showPreview(id); }}">${i18n.t('qualified-pdf-upload.show-preview')}</button>
                        <span class="headline">${i18n.t('qualified-pdf-upload.positioning')}:</span>
                        <dbp-textswitch name1="auto"
                            name2="manual"
                            name="${this.queuedFilesPlacementModes[id] || "auto"}"
                            class="switch"
                            value1="${i18n.t('qualified-pdf-upload.positioning-automatic')}"
                            value2="${i18n.t('qualified-pdf-upload.positioning-manual')}"
                            ?disabled="${this.signingProcessEnabled}"
                            @change=${ (e) => this.queuePlacementSwitch(id, e.target.name) }></dbp-textswitch>
                    </div>
                </div>
            `);
        });

        return results;
    }

    /**
     * Returns the list of successfully signed files
     *
     * @returns {*[]} Array of html templates
     */
    getSignedFilesHtml() {
        const ids = Object.keys(this.signedFiles);
        let results = [];

        ids.forEach((id) => {
            const file = this.signedFiles[id];

            results.push(html`
                <div class="file-block">
                    <div class="header">
                        <span class="filename"><strong>${file.signedFilename}</strong> (${humanFileSize(file.contentSize)})</span>
                        <button class="button close"
                            title="${i18n.t('qualified-pdf-upload.download-file-button-title')}"
                            @click="${() => { this.downloadFileClickHandler(file); }}">
                            <dbp-icon name="download"></dbp-icon></button>
                    </div>
                </div>
            `);
        });

        return results;
    }

    /**
     * Returns the list of files of failed signature processes
     *
     * @returns {*[]} Array of html templates
     */
    getErrorFilesHtml() {
        const ids = Object.keys(this.errorFiles);
        let results = [];

        ids.forEach((id) => {
            const data = this.errorFiles[id];

            results.push(html`
                <div class="file-block error">
                    <div class="header">
                        <span class="filename"><strong>${data.file.name}</strong> (${humanFileSize(data.file.size)})</span>
                        <div class="buttons">
                            <button class="button"
                                    title="${i18n.t('qualified-pdf-upload.re-upload-file-button-title')}"
                                    @click="${() => {this.fileQueueingClickHandler(data.file, id);}}"><dbp-icon name="reload"></dbp-icon></button>
                            <button class="button"
                                title="${i18n.t('qualified-pdf-upload.remove-failed-file-button-title')}"
                                @click="${() => { this.takeFailedFileFromQueue(id); }}">
                                <dbp-icon name="trash"></dbp-icon></button>
                        </div>
                    </div>
                    <div class="bottom-line">
                        <strong class="error">${data.json["hydra:description"]}</strong>
                    </div>
                </div>
            `);
        });

        return results;
    }

    hasSignaturePermissions() {
        return this._hasSignaturePermissions('ROLE_SCOPE_QUALIFIED-SIGNATURE');
    }

    async stopSigningProcess() {
        if (!this.externalAuthInProgress) {
            return;
        }

        this._("#iframe").src = "about:blank";
        this.signingProcessEnabled = false;
        this.externalAuthInProgress = false;
        this.signingProcessActive = false;

        if (this.currentFile.file !== undefined) {
            const key = await this.queueFile(this.currentFile.file);

            // set placement mode and parameters so they are restore when canceled
            this.queuedFilesPlacementModes[key] = this.currentFilePlacementMode;
            this.queuedFilesSignaturePlacements[key] = this.currentFileSignaturePlacement;
        }
    }

    render() {
        const placeholderUrl = commonUtils.getAssetURL('local/dbp-signature/qualified-signature-placeholder.png');

        return html`
            <div class="${classMap({hidden: !this.isLoggedIn() || !this.hasSignaturePermissions() || this.isLoading()})}">
                <div class="field ${classMap({"is-disabled": this.isUserInterfaceDisabled()})}">
                    <h2>${i18n.t('qualified-pdf-upload.upload-field-label')}</h2>
                    <div class="control">
                        <p>
                            ${i18n.t('qualified-pdf-upload.upload-text')}
                        </p>
                        <button @click="${() => { this._("#file-source").setAttribute("dialog-open", ""); }}"
                                ?disabled="${this.signingProcessActive}"
                                class="button is-primary">
                            ${i18n.t('qualified-pdf-upload.upload-button-label')}
                        </button>

                        <dbp-file-source
                            id="file-source"
                            context="${i18n.t('qualified-pdf-upload.upload-field-label')}"
                            allowed-mime-types="application/pdf"
                            enabled-sources="local${this.showTestNextcloudFilePicker ? ",nextcloud" : ""}"
                            nextcloud-auth-url="${nextcloudWebAppPasswordURL}"
                            nextcloud-web-dav-url="${nextcloudWebDavURL}"
                            nextcloud-name="${nextcloudName}"
                            decompress-zip
                            lang="${this.lang}"
                            ?disabled="${this.signingProcessActive}"
                            text="${i18n.t('qualified-pdf-upload.upload-area-text')}"
                            button-label="${i18n.t('qualified-pdf-upload.upload-button-label')}"
                            @dbp-file-source-file-selected="${this.onFileSelected}"
                            ></dbp-file-source>
                    </div>
                </div>
                <div id="grid-container" class="${classMap({"border": this.queueBlockEnabled})}">
                    <div class="left-container">
                        <div class="files-block field ${classMap({hidden: !this.queueBlockEnabled})}">
                            <!-- Queued files headline and queueing spinner -->
                            <h2 class="${classMap({"is-disabled": this.isUserInterfaceDisabled()})}">
                                ${i18n.t('qualified-pdf-upload.queued-files-label')}
                            </h2>
                            <!-- Buttons to start/stop signing process and clear queue -->
                            <div class="control field">
                                <button @click="${this.clearQueuedFiles}"
                                        ?disabled="${this.queuedFilesCount === 0 || this.signingProcessActive || this.isUserInterfaceDisabled()}"
                                        class="button ${classMap({"is-disabled": this.isUserInterfaceDisabled()})}">
                                    ${i18n.t('qualified-pdf-upload.clear-all')}
                                </button>
                                <button @click="${() => { this.signingProcessEnabled = true; this.signingProcessActive = true; }}"
                                        ?disabled="${this.queuedFilesCount === 0}"
                                        class="button is-right is-primary ${classMap({"is-disabled": this.isUserInterfaceDisabled()})}">
                                    ${i18n.t('qualified-pdf-upload.start-signing-process-button')}
                                </button>
                                <!--
                                <button @click="${this.stopSigningProcess}"
                                        ?disabled="${this.uploadInProgress}"
                                        id="cancel-signing-process"
                                        class="button is-right ${classMap({hidden: !this.signingProcessActive})}">
                                    ${i18n.t('qualified-pdf-upload.stop-signing-process-button')}
                                </button>
                                -->
                            </div>
                            <!-- List of queued files -->
                            <div class="control file-list ${classMap({"is-disabled": this.isUserInterfaceDisabled()})}">
                                ${this.getQueuedFilesHtml()}
                            </div>
                            <!-- Text "queue empty" -->
                            <div class="empty-queue control ${classMap({hidden: this.queuedFilesCount !== 0, "is-disabled": this.isUserInterfaceDisabled()})}">
                                ${i18n.t('qualified-pdf-upload.queued-files-empty1')}<br />
                                ${i18n.t('qualified-pdf-upload.queued-files-empty2')}
                            </div>
                        </div>
                        <!-- List of signed PDFs -->
                        <div class="files-block field ${classMap({hidden: this.signedFilesCount === 0, "is-disabled": this.isUserInterfaceDisabled()})}">
                            <h2>${i18n.t('qualified-pdf-upload.signed-files-label')}</h2>
                            <!-- Button to download all signed PDFs -->
                            <div class="field ${classMap({hidden: this.signedFilesCount === 0})}">
                                <div class="control">
                                    <button @click="${this.clearSignedFiles}"
                                            class="button">
                                        ${i18n.t('qualified-pdf-upload.clear-all')}
                                    </button>
                                    <dbp-button id="zip-download-button"
                                                value="${i18n.t('qualified-pdf-upload.download-zip-button')}"
                                                title="${i18n.t('qualified-pdf-upload.download-zip-button-tooltip')}"
                                                class="is-right"
                                                @click="${this.zipDownloadClickHandler}"
                                                type="is-primary"></dbp-button>
                                </div>
                            </div>
                            <div class="control">
                                ${this.getSignedFilesHtml()}
                            </div>
                        </div>
                        <!-- List of errored files -->
                        <div class="files-block error-files field ${classMap({hidden: this.errorFilesCount === 0, "is-disabled": this.isUserInterfaceDisabled()})}">
                            <h2>${i18n.t('qualified-pdf-upload.error-files-label')}</h2>
                            <!-- Button to upload errored files again -->
                            <div class="field ${classMap({hidden: this.errorFilesCount === 0})}">
                                <div class="control">
                                    <button @click="${this.clearErrorFiles}"
                                            class="button">
                                        ${i18n.t('qualified-pdf-upload.clear-all')}
                                    </button>
                                    <dbp-button id="re-upload-all-button"
                                                ?disabled="${this.uploadInProgress}"
                                                value="${i18n.t('qualified-pdf-upload.re-upload-all-button')}"
                                                title="${i18n.t('qualified-pdf-upload.re-upload-all-button-title')}"
                                                class="is-right"
                                                @click="${this.reUploadAllClickHandler}"
                                                type="is-primary"></dbp-button>
                                </div>
                            </div>
                            <div class="control">
                                ${this.getErrorFilesHtml()}
                            </div>
                        </div>
                    </div>
                    <div class="right-container">
                        <!-- PDF preview -->
                        <div id="pdf-preview" class="field ${classMap({hidden: !this.signaturePlacementInProgress})}">
                            <h2>${this.withSigBlock ? i18n.t('qualified-pdf-upload.signature-placement-label') : i18n.t('qualified-pdf-upload.preview-label')}</h2>
                            <div class="box-header">
                                <div class="filename">
                                    <strong>${this.currentFile.name}</strong> (${humanFileSize(this.currentFile !== undefined ? this.currentFile.size : 0)})
                                </div>
                                <button class="button is-cancel"
                                    @click="${this.hidePDF}"><dbp-icon name="close"></dbp-icon></button>
                            </div>
                            <dbp-pdf-preview lang="${this.lang}"
                                             signature-placeholder-image-src="${placeholderUrl}"
                                             signature-width="80"
                                             signature-height="29"
                                             @dbp-pdf-preview-accept="${this.storePDFData}"
                                             @dbp-pdf-preview-cancel="${this.hidePDF}"></dbp-pdf-preview>
                        </div>
                        <!-- File upload progress -->
                        <div id="upload-progress" class="field notification is-info ${classMap({hidden: !this.uploadInProgress})}">
                            <dbp-mini-spinner></dbp-mini-spinner>
                            <strong>${this.uploadStatusFileName}</strong>
                            ${this.uploadStatusText}
                        </div>
                        <!-- External auth -->
                        <div id="external-auth" class="files-block field ${classMap({hidden: !this.externalAuthInProgress})}">
                            <h2>${i18n.t('qualified-pdf-upload.current-signing-process-label')}</h2>
                            <div class="box">
                                <div class="box-header">
                                    <div class="filename">
                                        <strong>${this.currentFileName}</strong> (${humanFileSize(this.currentFile.file !== undefined ? this.currentFile.file.size : 0)})
                                    </div>
                                    <button class="button is-cancel"
                                            title="${i18n.t('qualified-pdf-upload.stop-signing-process-button')}"
                                            @click="${this.stopSigningProcess}"><dbp-icon name="close"></dbp-icon></button>
                                </div>
                                <!-- "scrolling" is deprecated, but still seem to help -->
                                <iframe id="iframe" scrolling="no"></iframe>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="notification is-warning ${classMap({hidden: this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-login-message')}
            </div>
            <div class="notification is-danger ${classMap({hidden: this.hasSignaturePermissions() || !this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-permission-message')}
            </div>
            <div class="${classMap({hidden: !this.isLoading()})}">
                <dbp-mini-spinner></dbp-mini-spinner>
            </div>
            <dbp-file-sink id="file-sink"
                context="${i18n.t('qualified-pdf-upload.save-field-label', {count: this.signedFilesToDownload})}"
                filename="signed-documents.zip"
                enabled-destinations="local${this.showTestNextcloudFilePicker ? ",nextcloud" : ""}"
                nextcloud-auth-url="${nextcloudWebAppPasswordURL}"
                nextcloud-web-dav-url="${nextcloudWebDavURL}"
                nextcloud-name="${nextcloudName}"
                lang="${this.lang}"
                ></dbp-file-sink>
        `;
    }
}

commonUtils.defineCustomElement('dbp-qualified-signature-pdf-upload', QualifiedSignaturePdfUpload);