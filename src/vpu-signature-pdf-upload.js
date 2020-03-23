import {createI18nInstance} from './i18n.js';
import {humanFileSize} from 'vpu-common/i18next.js';
import {css, html} from 'lit-element';
import VPUSignatureLitElement from "./vpu-signature-lit-element";
import * as commonUtils from 'vpu-common/utils';
import * as utils from './utils';
import JSZip from 'jszip/dist/jszip.js';
import 'file-saver';
import * as commonStyles from 'vpu-common/styles';
import {classMap} from 'lit-html/directives/class-map.js';
import 'vpu-file-upload';

const i18n = createI18nInstance();

class SignaturePdfUpload extends VPUSignatureLitElement {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
        this.files = [];
        this.filesCount = 0;
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            files: { type: Array, attribute: false },
            filesCount: { type: Number, attribute: false },
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(()=>{
            this.shadowRoot.querySelectorAll('vpu-fileupload')
                .forEach(element => {
                    element.addEventListener('vpu-fileupload-finished', this.onUploadFinished.bind(this));
                });
        });
    }

    /**
     * @param ev
     */
    onUploadFinished(ev) {
        // TODO: check ev.detail.status to show if an error occurred
        // TODO: on ev.detail.status == 503 we need to upload the file again

        if (ev.detail.json) {
            // this doesn't seem to cause an update() execution
            this.files.push(ev.detail.json);
            // this causes the correct update() execution
            this.filesCount++;
        }
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
        this.files.forEach((file) => {
            let fileName = file.fileName;

            //
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
     * Download one signed pdf file
     *
     * @param file
     */
    fileDownloadClickHandler(file) {
        const arr = utils.convertDataURIToBinary(file.file);
        const blob = new Blob([arr], { type: utils.getDataURIContentType(file.file) });

        // see: https://github.com/eligrey/FileSaver.js
        saveAs(blob, file.fileName);
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS()}
            ${commonStyles.getButtonCSS()}
            ${commonStyles.getNotificationCSS()}

            .hidden {
                display: none;
            }

            #files-download .file {
                margin: 10px 0;
            }

            #files-download .file button {
                margin-right: 5px;
            }

            #files-download .file .info {
                display: inline-block;
                vertical-align: middle;
            }

            button.is-download {
                background-color: lightgray;
                border-color: gray;
            }
        `;
    }

    getSignedFilesHtml() {
        return this.files.map(file => html`
            <div class="file">
                <button class="button is-small is-download"
                        title="${i18n.t('pdf-upload.download-file-button-title')}"
                        @click="${() => {this.fileDownloadClickHandler(file);}}"><vpu-icon name="download"></vpu-icon></button>
                <div class="info">
                    <strong>${file.fileName}</strong> (${humanFileSize(file.fileSize)})
                </div>
            </div>
        `);
    }

    render() {
        return html`
            <div class="${classMap({hidden: !this.isLoggedIn() || !this.hasSignaturePermissions()})}">
                <div class="field">
                    <label class="label">${i18n.t('pdf-upload.upload-field-label')}</label>
                    <div class="control">
                        <vpu-fileupload lang="${this.lang}" url="${this.entryPointUrl}/pdf_official_signing_actions" accept="application/pdf"
                            text="${i18n.t('pdf-upload.upload-area-text')}" button-label="${i18n.t('pdf-upload.upload-button-label')}"></vpu-fileupload>
                    </div>
                </div>
                <div id="files-download" class="field ${classMap({hidden: this.filesCount === 0})}">
                    <label class="label">${i18n.t('pdf-upload.signed-files-label')}</label>
                    <div class="control">
                        ${this.getSignedFilesHtml()}
                    </div>
                </div>
                <div class="field ${classMap({hidden: this.filesCount === 0})}">
                    <div class="control">
                        <vpu-button id="zip-download-button" value="${i18n.t('pdf-upload.download-zip-button')}" title="${i18n.t('pdf-upload.download-zip-button-tooltip')}" @click="${this.zipDownloadClickHandler}" type="is-primary"></vpu-button>
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

commonUtils.defineCustomElement('vpu-signature-pdf-upload', SignaturePdfUpload);
