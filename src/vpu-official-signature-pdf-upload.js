import {createI18nInstance} from './i18n.js';
import {humanFileSize} from 'vpu-common/i18next.js';
import {css, html} from 'lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import VPUSignatureLitElement from "./vpu-signature-lit-element";
import * as commonUtils from 'vpu-common/utils';
import {Icon} from 'vpu-common';
import * as utils from './utils';
import JSZip from 'jszip/dist/jszip.js';
import 'file-saver';
import * as commonStyles from 'vpu-common/styles';
import {classMap} from 'lit-html/directives/class-map.js';
import {FileUpload} from 'vpu-file-upload';

const i18n = createI18nInstance();

class OfficialSignaturePdfUpload extends ScopedElementsMixin(VPUSignatureLitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
        this.signingUrl = this.entryPointUrl + "/officially_signed_documents/sign";
        this.signedFiles = [];
        this.signedFilesCount = 0;
        this.errorFiles = [];
        this.errorFilesCount = 0;
        this.uploadInProgress = false;
        this.uploadStatusFileName = "";
        this.uploadStatusText = "";
    }

    static get scopedElements() {
        return {
          'vpu-icon': Icon,
          'vpu-fileupload': FileUpload,
          // FIXME: move them to explicit exports
          'vpu-mini-spinner': customElements.get('vpu-mini-spinner'),
          'vpu-button': customElements.get('vpu-button'),
        };
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            signedFiles: { type: Array, attribute: false },
            signedFilesCount: { type: Number, attribute: false },
            errorFiles: { type: Array, attribute: false },
            errorFilesCount: { type: Number, attribute: false },
            uploadInProgress: { type: Boolean, attribute: false },
            uploadStatusFileName: { type: String, attribute: false },
            uploadStatusText: { type: String, attribute: false },
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(()=>{
            const fileUpload = this._("#file-upload");
            fileUpload.addEventListener('vpu-fileupload-all-start', this.onAllUploadStarted.bind(this));
            fileUpload.addEventListener('vpu-fileupload-file-start', this.onFileUploadStarted.bind(this));
            fileUpload.addEventListener('vpu-fileupload-file-finished', this.onFileUploadFinished.bind(this));
            fileUpload.addEventListener('vpu-fileupload-all-finished', this.onAllUploadFinished.bind(this));
        });
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
        console.log(ev);
        this.uploadStatusFileName = ev.detail.fileName;
        this.uploadStatusText = i18n.t('official-pdf-upload.upload-status-file-text', {
            fileName: ev.detail.fileName,
            fileSize: humanFileSize(ev.detail.fileSize, false),
        });
    }

    /**
     * @param ev
     */
    onFileUploadFinished(ev) {
        if (ev.detail.status !== 201) {
            // this doesn't seem to trigger an update() execution
            this.errorFiles[Math.floor(Math.random() * 1000000)] = ev.detail;
            // this triggers the correct update() execution
            this.errorFilesCount++;
        } else if (ev.detail.json["@type"] === "http://schema.org/MediaObject" ) {
            // this doesn't seem to trigger an update() execution
            this.signedFiles.push(ev.detail.json);
            // this triggers the correct update() execution
            this.signedFilesCount++;
        }
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
            if (propName === "lang") {
                i18n.changeLanguage(this.lang);
            }

            console.log(propName, oldValue);
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
        this.errorFilesCount = this.errorFiles.length;
        await this._("#file-upload").uploadFile(file);
        this.uploadInProgress = false;
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

    getSignedFilesHtml() {
        return this.signedFiles.map(file => html`
            <div class="file">
                <a class="is-download"
                    title="${i18n.t('official-pdf-upload.download-file-button-title')}"
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
                            title="${i18n.t('official-pdf-upload.re-upload-file-button-title')}"
                            @click="${() => {this.fileUploadClickHandler(data.file, id);}}"><vpu-icon name="reload"></vpu-icon></button>
                </div>
                <div class="info">
                    ${data.file.name} (${humanFileSize(data.file.size)})
                    <strong class="error">${data.json["hydra:description"]}</strong>
                </div>
            </div>
        `);
    }

    render() {
        return html`
            <div class="${classMap({hidden: !this.isLoggedIn() || !this.hasSignaturePermissions()})}">
                <div class="field">
                    <h2>${i18n.t('official-pdf-upload.upload-field-label')}</h2>
                    <div class="control">
                        <vpu-fileupload id="file-upload" lang="${this.lang}" url="${this.signingUrl}" accept="application/pdf"
                            text="${i18n.t('official-pdf-upload.upload-area-text')}" button-label="${i18n.t('official-pdf-upload.upload-button-label')}"></vpu-fileupload>
                    </div>
                </div>
                <div class="field notification is-info ${classMap({hidden: !this.uploadInProgress})}">
                    <vpu-mini-spinner></vpu-mini-spinner>
                    <strong>${this.uploadStatusFileName}</strong>
                    ${this.uploadStatusText}
                </div>
                <div class="files-block field ${classMap({hidden: this.signedFilesCount === 0})}">
                    <h2>${i18n.t('official-pdf-upload.signed-files-label')}</h2>
                    <div class="control">
                        ${this.getSignedFilesHtml()}
                    </div>
                </div>
                <div class="field ${classMap({hidden: this.signedFilesCount === 0})}">
                    <div class="control">
                        <vpu-button id="zip-download-button" value="${i18n.t('official-pdf-upload.download-zip-button')}" title="${i18n.t('official-pdf-upload.download-zip-button-tooltip')}" @click="${this.zipDownloadClickHandler}" type="is-primary"></vpu-button>
                    </div>
                </div>
                <div class="files-block error-files field ${classMap({hidden: this.errorFilesCount === 0})}">
                    <h2 class="error">${i18n.t('official-pdf-upload.error-files-label')}</h2>
                    <div class="control">
                        ${this.getErrorFilesHtml()}
                    </div>
                </div>
                <div class="field ${classMap({hidden: this.errorFilesCount === 0})}">
                    <div class="control">
                        <vpu-button id="re-upload-all-button" ?disabled="${this.uploadInProgress}" value="${i18n.t('official-pdf-upload.re-upload-all-button')}" title="${i18n.t('official-pdf-upload.re-upload-all-button-title')}" @click="${this.reUploadAllClickHandler}" type="is-primary"></vpu-button>
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

commonUtils.defineCustomElement('vpu-official-signature-pdf-upload', OfficialSignaturePdfUpload);
