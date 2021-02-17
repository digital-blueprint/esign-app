import {createI18nInstance} from './i18n.js';
import {humanFileSize} from '@dbp-toolkit/common/i18next.js';
import {css, html} from 'lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPSignatureLitElement from "./dbp-signature-lit-element";
import {PdfPreview} from "./dbp-pdf-preview";
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Icon, MiniSpinner, Button} from '@dbp-toolkit/common';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {classMap} from 'lit-html/directives/class-map.js';
import {FileSource} from '@dbp-toolkit/file-handling';
import JSONLD from "@dbp-toolkit/common/jsonld";
import {name as pkgName} from './../package.json';

const i18n = createI18nInstance();

class SignatureVerificationFull extends ScopedElementsMixin(DBPSignatureLitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = '';
        this.nextcloudWebAppPasswordURL = "";
        this.nextcloudWebDavURL = "";
        this.nextcloudName = "";
        this.nextcloudFileURL = "";
        this.verifiedFiles = [];
        this.verifiedFilesCount = 0;
        this.errorFiles = [];
        this.errorFilesCount = 0;
        this.uploadStatusFileName = "";
        this.uploadStatusText = "";
        this.currentFile = {};
        this.currentFileName = "";
        this.currentFilePlacementMode = "";
        this.currentFileSignaturePlacement = {};
        this.verificationProcessEnabled = false;
        this.verificationProcessActive = false;
        this.previewInProgress = false;
        this.currentPreviewQueueKey = '';

        // will be set in function update
        this.verificationUrl = "";
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-file-source': FileSource,
            'dbp-pdf-preview': PdfPreview,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-button': Button,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            nextcloudWebAppPasswordURL: { type: String, attribute: 'nextcloud-web-app-password-url' },
            nextcloudWebDavURL: { type: String, attribute: 'nextcloud-webdav-url' },
            nextcloudName: { type: String, attribute: 'nextcloud-name' },
            nextcloudFileURL: { type: String, attribute: 'nextcloud-file-url' },
            verifiedFiles: { type: Array, attribute: false },
            verifiedFilesCount: { type: Number, attribute: false },
            queuedFilesCount: { type: Number, attribute: false },
            errorFiles: { type: Array, attribute: false },
            errorFilesCount: { type: Number, attribute: false },
            uploadInProgress: { type: Boolean, attribute: false },
            uploadStatusFileName: { type: String, attribute: false },
            uploadStatusText: { type: String, attribute: false },
            verificationProcessEnabled: { type: Boolean, attribute: false },
            verificationProcessActive: { type: Boolean, attribute: false },
            queueBlockEnabled: { type: Boolean, attribute: false },
            currentFile: { type: Object, attribute: false },
            currentFileName: { type: String, attribute: false },
            previewInProgress: { type: Boolean, attribute: false },
            isSignaturePlacement: { type: Boolean, attribute: false },
        };
    }

    connectedCallback() {
        super.connectedCallback();
        // needs to be called in a function to get the variable scope of "this"
        setInterval(() => { this.handleQueuedFiles(); }, 1000);
    }

    /**
     * Processes queued files
     */
    async handleQueuedFiles() {
        this.endVerificationProcessIfQueueEmpty();
        if (this.queuedFilesCount === 0) {
            // reset verificationProcessEnabled button
            this.verificationProcessEnabled = false;
            return;
        }

        if (!this.verificationProcessEnabled || this.uploadInProgress) {
            return;
        }

        this.previewInProgress = false;

        const key = Object.keys(this.queuedFiles)[0];

        // take the file off the queue
        let file = this.takeFileFromQueue(key);
        this.currentFile = file;

        this.uploadInProgress = true;
        let params = {};

        this.uploadStatusText = i18n.t('signature-verification.upload-status-file-text', {
            fileName: file.name,
            fileSize: humanFileSize(file.size, false),
        });

        await this.uploadFile(file, params);
        this.uploadInProgress = false;
    }

    /**
     * Called when preview is "canceled"
     *
     * @param event
     */
    hidePDF(event) {
        this.previewInProgress = false;
    }

    /**
     * Decides if the "beforeunload" event needs to be canceled
     *
     * @param event
     */
    onReceiveBeforeUnload(event) {
        // we don't need to stop if there are no signed files
        if (this.verifiedFilesCount === 0) {
            return;
        }

        // we need to handle custom events ourselves
        if (!event.isTrusted) {
            // note that this only works with custom event since calls of "confirm" are ignored
            // in the non-custom event, see https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
            const result = confirm(i18n.t('signature-verification.confirm-page-leave'));

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

    endVerificationProcessIfQueueEmpty() {
        if (this.queuedFilesCount === 0 && this.verificationProcessActive) {
            this.verificationProcessActive = false;
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
        this.endVerificationProcessIfQueueEmpty();

        // this doesn't seem to trigger an update() execution
        this.errorFiles[Math.floor(Math.random() * 1000000)] = file;
        // this triggers the correct update() execution
        this.errorFilesCount++;

        this.sendSetPropertyEvent('analytics-event', {
            'category': 'officiallyVerification', 'action': 'VerificationFailed', 'name': file.json["hydra:description"]});
    }

    /**
     * @param data
     */
    onFileUploadFinished(data) {
        if (data.status !== 201) {
            this.addToErrorFiles(data);
        } else if (data.json["@type"] === "https://schema.tugraz.at/ElectronicSignatureVerificationReport" ) {
            // this doesn't seem to trigger an update() execution
            this.verifiedFiles.push(data.json);
            // this triggers the correct update() execution
            this.verifiedFilesCount++;
            const entryPoint = data.json;
            this.currentFileName = entryPoint.name;
            this.endVerificationProcessIfQueueEmpty();
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
                        const apiUrlBase = jsonld.getApiUrlForEntityName("ElectronicSignatureVerificationReport");
                        this.fileSourceUrl = apiUrlBase;
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
     */
    async showPreview(key) {
        if (this.verificationProcessEnabled) {
            return;
        }

        const file = this.getQueuedFile(key);
        this.currentFile = file;
        this.currentPreviewQueueKey = key;
        console.log(file);
        // start signature placement process
        this.previewInProgress = true;
        const previewTag = this.constructor.getScopedTagName("dbp-pdf-preview");
        await this._(previewTag).showPDF(file);
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

    clearVerifiedFiles() {
        this.verifiedFiles = [];
        this.verifiedFilesCount = 0;
    }

    clearErrorFiles() {
        this.errorFiles = [];
        this.errorFilesCount = 0;
    }

    isUserInterfaceDisabled() {
        return this.previewInProgress || this.externalAuthInProgress || this.uploadInProgress;
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

            .error, #cancel-verification-process {
                color: #e4154b;
            }
            
            #cancel-verification-process:hover {
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
                grid-template-columns: auto 90px;
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

            #pdf-preview .button.is-cancel {
                color: #e4154b;
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

            #pdf-preview .box-header {
                display: flex;
                justify-content: space-between;
                align-items: start;
            }

            #pdf-preview .box-header .filename {
                overflow: hidden;
                text-overflow: ellipsis;
                margin-right: 0.5em;
            }

            table.signatures {
                margin-top: 10px;
            }

            .verified-files .file-block {
                max-width: inherit;
            }

            .verification-ok {
                background-color: #a4ffa4;
            }
            
            #grid-container{
                margin-top: 2rem;
                /*padding-top: 2rem;*/
            }
            
            .border{
                border-top: 1px solid black;
                margin-top: 2rem;
                padding-top: 2rem;
            }

            /* Handling for small displays (like mobile devices) */
            @media (max-width: 680px) {
                /* Modal preview, upload and external auth */
                div.right-container > * {
                    position: fixed;
                    z-index: 1000;
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
                            ?disabled="${this.verificationProcessEnabled}"
                            title="${i18n.t('signature-verification.remove-queued-file-button-title')}"
                            @click="${() => { this.takeFileFromQueue(id); }}">
                            <dbp-icon name="trash"></dbp-icon></button>
                    </div>
                    <div class="bottom-line">
                        <div></div>
                        <button class="button"
                            ?disabled="${this.verificationProcessEnabled}"
                            @click="${() => { this.showPreview(id); }}">${i18n.t('signature-verification.show-preview')}</button>
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
    getVerifiedFilesHtml() {
        const ids = Object.keys(this.verifiedFiles);
        let results = [];

        ids.forEach((id) => {
            const report = this.verifiedFiles[id];
            console.log("report", report);
            let signatures = [];

            report.signatures.forEach((signature) => {
                console.log("signature", signature);

                signatures.push(html`
                    <tr>
                        <td>${signature.givenName}</td>
                        <td>${signature.familyName}</td>
                        <td>${signature.nationality}</td>
                        <td>${signature.serialNumber}</td>
                        <td class="${classMap({"verification-ok": signature.valueMessage === "OK"})}">${signature.valueMessage}</td>
                    </tr>
                `);
            });

            results.push(html`
                <div class="file-block">
                    <div class="header">
                        <span class="filename"><strong>${report.name}</strong></span>
                    </div>
                    <table class="signatures ${classMap({hidden: signatures.length === 0})}">
                        <thead>
                            <th>${i18n.t('signature-verification.given-name')}</th>
                            <th>${i18n.t('signature-verification.last-name')}</th>
                            <th>${i18n.t('signature-verification.nationality')}</th>
                            <th>${i18n.t('signature-verification.serial-number')}</th>
                            <th>${i18n.t('signature-verification.value-message')}</th>
                        </thead>
                        <tbody>
                            ${signatures}
                        </tbody>
                    </table>
                    <div class="${classMap({hidden: signatures.length !== 0})}">
                        ${i18n.t('signature-verification.no-signatures-found')}
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
                                    title="${i18n.t('signature-verification.re-upload-file-button-title')}"
                                    @click="${() => {this.fileQueueingClickHandler(data.file, id);}}"><dbp-icon name="reload"></dbp-icon></button>
                            <button class="button"
                                title="${i18n.t('signature-verification.remove-failed-file-button-title')}"
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
        return this._hasSignaturePermissions('ROLE_SCOPE_OFFICIAL-SIGNATURE');
    }

    render() {
        const placeholderUrl = commonUtils.getAssetURL(pkgName, 'official-signature-placeholder.png');

        return html`
            <div class="${classMap({hidden: !this.isLoggedIn() || !this.hasSignaturePermissions() || this.isLoading()})}">
                <div class="field">
                    <h2>${i18n.t('signature-verification.upload-field-label')}</h2>
                    <div class="control">
                        <p>
                            ${i18n.t('signature-verification.sub-headline')}
                        </p>
                        <p class="border">
                            ${i18n.t('signature-verification.upload-text')}
                        </p>
                        <button @click="${() => { this._("#file-source").setAttribute("dialog-open", ""); }}"
                                ?disabled="${this.signingProcessActive}"
                                class="button is-primary">
                            ${i18n.t('signature-verification.upload-button-label')}
                        </button>
                        <dbp-file-source
                            id="file-source"
                            allowed-mime-types="application/pdf"
                            enabled-targets="local${this.showNextcloudFilePicker ? ",nextcloud" : ""}"
                            nextcloud-auth-url="${this.nextcloudWebAppPasswordURL}"
                            nextcloud-web-dav-url="${this.nextcloudWebDavURL}"
                            nextcloud-name="${this.nextcloudName}"
                            nextcloud-file-url="${this.nextcloudFileURL}"
                            decompress-zip
                            lang="${this.lang}"
                            ?disabled="${this.verificationProcessActive}"
                            context="${i18n.t('signature-verification.file-picker-context')}"
                            text="${i18n.t('signature-verification.upload-area-text')}"
                            button-label="${i18n.t('signature-verification.upload-button-label')}"
                            @dbp-file-source-file-selected="${this.onFileSelected}"
                            @dbp-file-source-switched="${this.onFileSourceSwitch}"
                            ></dbp-file-source>
                    </div>
                </div>
                <div id="grid-container">
                    <div class="left-container">
                        <div class="files-block field ${classMap({hidden: !this.queueBlockEnabled})}">
                            <!-- Queued files headline and queueing spinner -->
                            <h2 class="${classMap({"is-disabled": this.isUserInterfaceDisabled()})}">
                                ${i18n.t('signature-verification.queued-files-label')}
                            </h2>
                            <!-- Buttons to start/stop verification process and clear queue -->
                            <div class="control field">
                                <button @click="${this.clearQueuedFiles}"
                                        ?disabled="${this.queuedFilesCount === 0 || this.verificationProcessActive || this.isUserInterfaceDisabled()}"
                                        class="button ${classMap({"is-disabled": this.isUserInterfaceDisabled()})}">
                                    ${i18n.t('signature-verification.clear-all')}
                                </button>
                                <button @click="${() => { this.verificationProcessEnabled = true; this.verificationProcessActive = true; }}"
                                        ?disabled="${this.queuedFilesCount === 0}"
                                        class="button is-right is-primary ${classMap(
                                            {
                                                "is-disabled": this.isUserInterfaceDisabled(),
                                                hidden: this.verificationProcessActive
                                            })}">
                                    ${i18n.t('signature-verification.start-verification-process-button')}
                                </button>
                                <!-- -->
                                <button @click="${this.stopVerificationProcess}"
                                        ?disabled="${this.uploadInProgress}"
                                        id="cancel-verification-process"
                                        class="button is-right ${classMap({hidden: !this.verificationProcessActive})}">
                                    ${i18n.t('signature-verification.stop-verification-process-button')}
                                </button>
                                <!-- -->
                            </div>
                            <!-- List of queued files -->
                            <div class="control file-list ${classMap({"is-disabled": this.isUserInterfaceDisabled()})}">
                                ${this.getQueuedFilesHtml()}
                            </div>
                            <!-- Text "queue empty" -->
                            <div class="empty-queue control ${classMap({hidden: this.queuedFilesCount !== 0, "is-disabled": this.isUserInterfaceDisabled()})}">
                                ${i18n.t('signature-verification.queued-files-empty1')}<br />
                                ${i18n.t('signature-verification.queued-files-empty2')}
                            </div>
                        </div>
                        <!-- List of errored files -->
                        <div class="files-block error-files field ${classMap({hidden: this.errorFilesCount === 0, "is-disabled": this.isUserInterfaceDisabled()})}">
                            <h2>${i18n.t('signature-verification.error-files-label')}</h2>
                            <!-- Button to upload errored files again -->
                            <div class="field ${classMap({hidden: this.errorFilesCount === 0})}">
                                <div class="control">
                                    <button @click="${this.clearErrorFiles}"
                                            class="button">
                                        ${i18n.t('signature-verification.clear-all')}
                                    </button>
                                    <dbp-button id="re-upload-all-button"
                                                ?disabled="${this.uploadInProgress}"
                                                value="${i18n.t('signature-verification.re-upload-all-button')}"
                                                title="${i18n.t('signature-verification.re-upload-all-button-title')}"
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
                        <div id="pdf-preview" class="field ${classMap({hidden: !this.previewInProgress})}">
                            <h2>${i18n.t('signature-verification.preview-label')}</h2>
                            <div class="box-header">
                                <div class="filename">
                                    <strong>${this.currentFile.name}</strong> (${humanFileSize(this.currentFile !== undefined ? this.currentFile.size : 0)})
                                </div>
                                <button class="button is-cancel"
                                    @click="${this.hidePDF}"><dbp-icon name="close"></dbp-icon></button>
                            </div>
                            <dbp-pdf-preview lang="${this.lang}"
                                             subscribe="allow-signature-rotation:allow-signature-rotation"
                                             signature-placeholder-image-src="${placeholderUrl}"
                                             signature-width="146"
                                             signature-height="42"
                                             @dbp-pdf-preview-cancel="${this.hidePDF}"></dbp-pdf-preview>
                        </div>
                        <!-- File upload progress -->
                        <div id="upload-progress" class="field notification is-info ${classMap({hidden: !this.uploadInProgress})}">
                            <dbp-mini-spinner></dbp-mini-spinner>
                            <strong>${this.uploadStatusFileName}</strong>
                            ${this.uploadStatusText}
                        </div>
                    </div>
                </div>
                <!-- List of verified PDFs -->
                <div class="verified-files files-block field ${classMap({hidden: this.verifiedFilesCount === 0, "is-disabled": this.isUserInterfaceDisabled()})}">
                    <h2>${i18n.t('signature-verification.verified-files-label')}</h2>
                    <!-- Button to clear verified PDFs -->
                    <div class="field ${classMap({hidden: this.verifiedFilesCount === 0})}">
                        <div class="control">
                            <button @click="${this.clearVerifiedFiles}"
                                    class="button">
                                ${i18n.t('signature-verification.clear-all')}
                            </button>
                        </div>
                    </div>
                    <div class="control">
                        ${this.getVerifiedFilesHtml()}
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
        `;
    }
}

commonUtils.defineCustomElement('dbp-signature-verification-full', SignatureVerificationFull);
