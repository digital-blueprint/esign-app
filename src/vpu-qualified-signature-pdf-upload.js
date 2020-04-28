import {createI18nInstance} from './i18n.js';
import {humanFileSize} from 'vpu-common/i18next.js';
import {css, html} from 'lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import VPUSignatureLitElement from "./vpu-signature-lit-element";
import * as commonUtils from 'vpu-common/utils';
import * as utils from './utils';
import {Icon, MiniSpinner, Button} from 'vpu-common';
import JSZip from 'jszip/dist/jszip.js';
import 'file-saver';
import * as commonStyles from 'vpu-common/styles';
import {classMap} from 'lit-html/directives/class-map.js';
import {FileUpload} from 'vpu-file-upload';
import JSONLD from "vpu-common/jsonld";

const i18n = createI18nInstance();

class QualifiedSignaturePdfUpload extends ScopedElementsMixin(VPUSignatureLitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
        this.externalAuthInProgress = false;
        this.signedFiles = [];
        this.signedFilesCount = 0;
        this.errorFiles = [];
        this.errorFilesCount = 0;
        this.uploadInProgress = false;
        this.uploadStatusFileName = "";
        this.uploadStatusText = "";
        this.currentFile = {};
        this.currentFileName = "";
        this.queuedFiles = [];
        this.queuedFilesCount = 0;
        this.signingProcessEnabled = false;

        // will be set in function update
        this.signingRequestUrl = "";
        this.signingUrl = "";
    }

    static get scopedElements() {
        return {
          'vpu-icon': Icon,
          'vpu-fileupload': FileUpload,
          'vpu-mini-spinner': MiniSpinner,
          'vpu-button': Button,
        };
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            signedFiles: { type: Array, attribute: false },
            signedFilesCount: { type: Number, attribute: false },
            queuedFilesCount: { type: Number, attribute: false },
            errorFiles: { type: Array, attribute: false },
            errorFilesCount: { type: Number, attribute: false },
            uploadInProgress: { type: Boolean, attribute: false },
            uploadStatusFileName: { type: String, attribute: false },
            uploadStatusText: { type: String, attribute: false },
            externalAuthInProgress: { type: Boolean, attribute: false },
            signingProcessEnabled: { type: Boolean, attribute: false },
            currentFile: { type: Object, attribute: false },
            currentFileName: { type: String, attribute: false },
        };
    }

    connectedCallback() {
        super.connectedCallback();
        // needs to be called in a function to get the variable scope of "this"
        setInterval(() => { this.handleQueuedFiles(); }, 1000);

        this.updateComplete.then(()=>{
            const fileUpload = this._("#file-upload");
            fileUpload.addEventListener('vpu-fileupload-all-start', this.onAllUploadStarted.bind(this));
            fileUpload.addEventListener('vpu-fileupload-file-start', this.onFileUploadStarted.bind(this));
            fileUpload.addEventListener('vpu-fileupload-file-finished', this.onFileUploadFinished.bind(this));
            fileUpload.addEventListener('vpu-fileupload-all-finished', this.onAllUploadFinished.bind(this));

            // see: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
            window.addEventListener('message', this.onReceiveIframeMessage.bind(this));
        });
    }

    /**
     * Processes queued files
     */
    handleQueuedFiles() {
        if (this.queuedFilesCount === 0) {
            // reset signingProcessEnabled button
            this.signingProcessEnabled = false;

            return;
        }

        if (!this.signingProcessEnabled || this.externalAuthInProgress) {
            return;
        }

        // seems like keys are sorted, not in the order they were added
        const keys = Object.keys(this.queuedFiles);

        // get a key to process
        const key = keys.slice(0, 1);

        // show the iframe and lock processing
        this.externalAuthInProgress = true;

        // take the file off the queue
        const data = this.takeFileFromQueue(key);

        const entryPoint = data.json;
        this.currentFileName = entryPoint.name;

        // we need the full file to upload it again in case the download of the signed file fails
        this.currentFile = data;

        // we want to load the redirect url in the iframe
        let iframe = this._("#iframe");
        iframe.src = entryPoint.url;
    }

    onReceiveIframeMessage(event) {
        const data = event.data;

        // check if this is really a postMessage from our iframe without using event.origin
        if (data.type === 'pdf-as-error') {
            this.externalAuthInProgress = false;

            // TODO: handle "data.cause" and "data.error"? So far the information that is provided is pretty useless, which information should we show the user?
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

            // TODO: Improve error handling
            fetch(apiUrl, {
                headers: {
                    'Content-Type': 'application/ld+json',
                    'Authorization': 'Bearer ' + window.VPUAuthToken,
                },
            })
                .then(result => {
                    // hide iframe
                    that.externalAuthInProgress = false;

                    if (!result.ok) throw result;

                    return result.json();
                })
                .then((document) => {
                    // this doesn't seem to trigger an update() execution
                    that.signedFiles.push(document);
                    // this triggers the correct update() execution
                    that.signedFilesCount++;
                }).catch(error => {
                    let file = this.currentFile;
                    // let's override the json to inject an error message
                    file.json = {"hydra:description" : "Download failed!"};

                    this.addToErrorFiles(file);
                });
        }, {}, that.lang);

    }

    /**
     * @param ev
     */
    onAllUploadStarted(ev) {
        console.log("Start upload process!");
        this.uploadInProgress = true;
    }

    /**
     * @param ev
     */
    onFileUploadStarted(ev) {
        this.uploadStatusFileName = ev.detail.fileName;
        this.uploadStatusText = i18n.t('qualified-pdf-upload.upload-status-file-text', {
            fileName: ev.detail.fileName,
            fileSize: humanFileSize(ev.detail.fileSize, false),
        });
    }

    addToErrorFiles(file) {
        // this doesn't seem to trigger an update() execution
        this.errorFiles[Math.floor(Math.random() * 1000000)] = file;
        // this triggers the correct update() execution
        this.errorFilesCount++;
    }

    addToQueuedFiles(data) {
        this.queuedFiles[Math.floor(Math.random() * 1000000)] = data;
        this.queuedFilesCount++;
    }

    /**
     * @param ev
     */
    onFileUploadFinished(ev) {
        if (ev.detail.status !== 201) {
            this.addToErrorFiles(ev.detail);
        } else if (ev.detail.json["@type"] === "http://schema.org/EntryPoint" ) {
            this.addToQueuedFiles(ev.detail);
        }
    }

    setIframeHTML(iframe, html) {
        if (typeof iframe.srcdoc !== 'undefined') {
            iframe.srcdoc = html;
        } else {
            iframe.sandbox = 'allow-same-origin';
            iframe.contentWindow.document.open();
            iframe.contentWindow.document.write(html);
            iframe.contentWindow.document.close();
        }
    }

    /**
     * Example taken from https://stackoverflow.com/a/51167233/1581487
     *
     * @param iframeElement
     * @param newHTML
     */
    replaceIframeContent(iframeElement, newHTML) {
        // iframeElement.sandbox = 'allow-same-origin';
        // iframeElement.src = "data:text/html;charset=utf-8," + encodeURI(newHTML);

        // iframeElement.src = "about:blank";
        // only works once
        iframeElement.contentWindow.document.open();
        iframeElement.contentWindow.document.write(newHTML);
        iframeElement.contentWindow.document.close();
    }

    /**
     * @param ev
     */
    onAllUploadFinished(ev) {
        console.log("Finished upload process!");
        this.uploadInProgress = false;
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
                        this.signingRequestUrl = apiUrlBase + "/create";
                        this.signingUrl = apiUrlBase + "/sign";
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
     * Download signed pdf files as zip
     */
    zipDownloadClickHandler() {
        // see: https://stuk.github.io/jszip/
        let zip = new JSZip();
        const that = this;
        let fileNames = [];

        // add all signed pdf files
        this.signedFiles.forEach((file) => {
            let fileName = file.name;

            // add pseudo-random string on duplicate file name
            if (fileNames.indexOf(fileName) !== -1) {
                fileName = utils.baseName(fileName) + "-" + Math.random().toString(36).substring(7) + ".pdf";
            }

            fileNames.push(fileName);
            zip.file(fileName, utils.getPDFFileBase64Content(file), {base64: true});
        });

        zip.generateAsync({type:"blob"})
            .then(function(content) {
                // save with FileSaver.js
                // see: https://github.com/eligrey/FileSaver.js
                saveAs(content, "signed-documents.zip");

                that._("#zip-download-button").stop();
            });
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
            await this.fileUploadClickHandler(file.file, id);
        });

        that._("#re-upload-all-button").stop();
    }

    /**
     * Download one signed pdf file
     *
     * @param file
     */
    fileDownloadClickHandler(file) {
        const arr = utils.convertDataURIToBinary(file.contentUrl);
        const blob = new Blob([arr], { type: utils.getDataURIContentType(file.contentUrl) });

        // see: https://github.com/eligrey/FileSaver.js
        saveAs(blob, file.name);
    }

    /**
     * Uploads a failed pdf file again
     *
     * @param file
     * @param id
     */
    async fileUploadClickHandler(file, id) {
        this.uploadInProgress = true;
        this.errorFiles.splice(id, 1);
        this.errorFilesCount = Object.keys(this.errorFiles).length;
        await this._("#file-upload").uploadFile(file);
        this.uploadInProgress = false;
    }

    /**
     * Takes a file off of the queue
     *
     * @param key
     */
    takeFileFromQueue(key) {
        // splice the data of the key off the queue
        const data = this.queuedFiles.splice(key, 1)[0];
        this.queuedFilesCount = Object.keys(this.queuedFiles).length;

        return data;
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS()}
            ${commonStyles.getButtonCSS()}
            ${commonStyles.getNotificationCSS()}

            h2 {
                margin-bottom: inherit;
            }

            .hidden {
                display: none;
            }

            #iframe {
                width: 100%;
                height: 240px;
                border: none;
                /* keeps the A-Trust webpage aligned left */
                max-width: 570px;
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

            .notification vpu-mini-spinner {
                position: relative;
                top: 2px;
                margin-right: 5px;
            }

            .error {
                color: #e4154b;
            }
        `;
    }

    getQueuedFilesHtml() {
        return this.queuedFiles.map((data, id) => html`
            <div class="file">
                <a class="is-remove"
                    title="${i18n.t('qualified-pdf-upload.remove-queued-file-button-title')}"
                    @click="${() => {this.takeFileFromQueue(id);}}">
                    ${data.file.name} (${humanFileSize(data.file.size)}) <vpu-icon name="close" style="font-size: 0.7em"></vpu-icon></a>
            </div>
        `);
    }

    getSignedFilesHtml() {
        return this.signedFiles.map(file => html`
            <div class="file">
                <a class="is-download"
                    title="${i18n.t('qualified-pdf-upload.download-file-button-title')}"
                    @click="${() => {this.fileDownloadClickHandler(file);}}">
                    ${file.name} (${humanFileSize(file.contentSize)}) <vpu-icon name="download"></vpu-icon></a>
            </div>
        `);
    }

    getErrorFilesHtml() {
        return this.errorFiles.map((data, id) => html`
            <div class="file">
                <div class="button-box">
                    <button class="button is-small"
                            title="${i18n.t('qualified-pdf-upload.re-upload-file-button-title')}"
                            @click="${() => {this.fileUploadClickHandler(data.file, id);}}"><vpu-icon name="reload"></vpu-icon></button>
                </div>
                <div class="info">
                    ${data.file.name} (${humanFileSize(data.file.size)})
                    <strong class="error">${data.json["hydra:description"]}</strong>
                </div>
            </div>
        `);
    }

    hasSignaturePermissions() {
        return this._hasSignaturePermissions('ROLE_SCOPE_QUALIFIED-SIGNATURE');
    }

    render() {
        return html`
            <div class="${classMap({hidden: !this.isLoggedIn() || !this.hasSignaturePermissions()})}">
                <div class="field">
                    <h2>${i18n.t('qualified-pdf-upload.upload-field-label')}</h2>
                    <div class="control">
                        <vpu-fileupload id="file-upload" always-send-file lang="${this.lang}" url="${this.signingRequestUrl}" accept="application/pdf"
                            text="${i18n.t('qualified-pdf-upload.upload-area-text')}" button-label="${i18n.t('qualified-pdf-upload.upload-button-label')}"></vpu-fileupload>
                    </div>
                </div>
                <div class="field notification is-info ${classMap({hidden: !this.uploadInProgress})}">
                    <vpu-mini-spinner></vpu-mini-spinner>
                    <strong>${this.uploadStatusFileName}</strong>
                    ${this.uploadStatusText}
                </div>
                <div class="files-block field ${classMap({hidden: !this.externalAuthInProgress})}">
                    <h2>${i18n.t('qualified-pdf-upload.current-signing-process-label')}</h2>
                    <div class="file">
                        <a class="is-remove" title="${i18n.t('qualified-pdf-upload.remove-current-file-button-title')}"
                            @click="${() => { this.externalAuthInProgress = false; }}">
                            ${this.currentFileName} (${humanFileSize(this.currentFile.file !== undefined ? this.currentFile.file.size : 0)})
                            <vpu-icon name="close" style="font-size: 0.7em"></vpu-icon>
                        </a>
                    </div>
                    <iframe name="external_iframe" id="iframe"></iframe>
                </div>
                <div class="files-block field ${classMap({hidden: this.queuedFilesCount === 0})}">
                    <h2>${i18n.t('qualified-pdf-upload.queued-files-label')}</h2>
                    <div class="control">
                        ${this.getQueuedFilesHtml()}
                    </div>
                    <div class="control">
                        <button @click="${() => { this.signingProcessEnabled = true; }}"
                                ?disabled="${this.signingProcessEnabled}"
                                title="${this.signingProcessEnabled ? i18n.t('qualified-pdf-upload.start-signing-process-button-running-title') : ""}"
                                class="button is-primary">
                            ${i18n.t('qualified-pdf-upload.start-signing-process-button')}
                        </button>
                    </div>
                </div>
                <div class="files-block field ${classMap({hidden: this.signedFilesCount === 0})}">
                    <h2>${i18n.t('qualified-pdf-upload.signed-files-label')}</h2>
                    <div class="control">
                        ${this.getSignedFilesHtml()}
                    </div>
                </div>
                <div class="field ${classMap({hidden: this.signedFilesCount === 0})}">
                    <div class="control">
                        <vpu-button id="zip-download-button" value="${i18n.t('qualified-pdf-upload.download-zip-button')}" title="${i18n.t('qualified-pdf-upload.download-zip-button-tooltip')}" @click="${this.zipDownloadClickHandler}" type="is-primary"></vpu-button>
                    </div>
                </div>
                <div class="files-block error-files field ${classMap({hidden: this.errorFilesCount === 0})}">
                    <h2 class="error">${i18n.t('qualified-pdf-upload.error-files-label')}</h2>
                    <div class="control">
                        ${this.getErrorFilesHtml()}
                    </div>
                </div>
                <div class="field ${classMap({hidden: this.errorFilesCount === 0})}">
                    <div class="control">
                        <vpu-button id="re-upload-all-button" ?disabled="${this.uploadInProgress}" value="${i18n.t('qualified-pdf-upload.re-upload-all-button')}" title="${i18n.t('qualified-pdf-upload.re-upload-all-button-title')}" @click="${this.reUploadAllClickHandler}" type="is-primary"></vpu-button>
                    </div>
                </div>
            </div>
            <div class="notification is-warning ${classMap({hidden: this.isLoggedIn()})}">
                ${i18n.t('error-login-message')}
            </div>
            <div class="notification is-danger ${classMap({hidden: this.hasSignaturePermissions() || !this.isLoggedIn()})}">
                ${i18n.t('error-permission-message')}
            </div>
        `;
    }
}

commonUtils.defineCustomElement('vpu-qualified-signature-pdf-upload', QualifiedSignaturePdfUpload);
