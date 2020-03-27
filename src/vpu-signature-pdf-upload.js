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
        this.signingUrl = this.entryPointUrl + "/officially_signed_document/sign";
        this.signedFiles = [];
        this.signedFilesCount = 0;
        this.errorFiles = [];
        this.errorFilesCount = 0;
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            signedFiles: { type: Array, attribute: false },
            signedFilesCount: { type: Number, attribute: false },
            errorFiles: { type: Array, attribute: false },
            errorFilesCount: { type: Number, attribute: false },
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
        if (ev.detail.status !== 201) {
            console.log(ev.detail);
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
    fileUploadClickHandler(file, id) {
        this._("#file-upload").uploadFile(file);
        this.errorFiles.splice(id, 1);
        this.errorFilesCount--;
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

            .files-block .file {
                display: grid;
                grid-template-columns: 40px auto;
                margin: 10px 0;
            }

            .files-block .file .button-box {
                display: flex;
                align-items: center;
            }

            .files-block .file .info {
                display: inline-block;
                vertical-align: middle;
            }

            button.is-download {
                background-color: lightgray;
                border-color: gray;
            }

            button.is-re-upload {
                background-color: lightpink;
                border-color: lightcoral;
            }
        `;
    }

    getSignedFilesHtml() {
        return this.signedFiles.map(file => html`
            <div class="file">
                <div class="button-box">
                    <button class="button is-small is-download"
                            title="${i18n.t('pdf-upload.download-file-button-title')}"
                            @click="${() => {this.fileDownloadClickHandler(file);}}"><vpu-icon name="download"></vpu-icon></button>
                </div>
                <div class="info">
                    <strong>${file.name}</strong> (${humanFileSize(file.contentSize)})
                </div>
            </div>
        `);
    }

    getErrorFilesHtml() {
        return this.errorFiles.map((data, id) => html`
            <div class="file">
                <div class="button-box">
                    <button class="button is-small is-re-upload"
                            title="${i18n.t('pdf-upload.re-upload-file-button-title')}"
                            @click="${() => {this.fileUploadClickHandler(data.file, id);}}"><vpu-icon name="upload"></vpu-icon></button>
                </div>
                <div class="info">
                    <strong>${data.file.name}</strong> (${humanFileSize(data.file.size)})
                    ${data.json["hydra:description"]}
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
                        <vpu-fileupload id="file-upload" lang="${this.lang}" url="${this.signingUrl}" accept="application/pdf"
                            text="${i18n.t('pdf-upload.upload-area-text')}" button-label="${i18n.t('pdf-upload.upload-button-label')}"></vpu-fileupload>
                    </div>
                </div>
                <div class="files-block field ${classMap({hidden: this.signedFilesCount === 0})}">
                    <label class="label">${i18n.t('pdf-upload.signed-files-label')}</label>
                    <div class="control">
                        ${this.getSignedFilesHtml()}
                    </div>
                </div>
                <div class="field ${classMap({hidden: this.signedFilesCount === 0})}">
                    <div class="control">
                        <vpu-button id="zip-download-button" value="${i18n.t('pdf-upload.download-zip-button')}" title="${i18n.t('pdf-upload.download-zip-button-tooltip')}" @click="${this.zipDownloadClickHandler}" type="is-primary"></vpu-button>
                    </div>
                </div>
                <div class="files-block field ${classMap({hidden: this.errorFilesCount === 0})}">
                    <label class="label">${i18n.t('pdf-upload.error-files-label')}</label>
                    <div class="control">
                        ${this.getErrorFilesHtml()}
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
