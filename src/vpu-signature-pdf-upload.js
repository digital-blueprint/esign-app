import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import VPUSignatureLitElement from "./vpu-signature-lit-element";
import * as commonUtils from 'vpu-common/utils';
import JSZip from 'jszip/dist/jszip.js';
import 'file-saver';
import * as commonStyles from 'vpu-common/styles';
import suggestionsCSSPath from 'suggestions/dist/suggestions.css';
import {classMap} from 'lit-html/directives/class-map.js';
import 'vpu-file-upload';

const i18n = createI18nInstance();

class SignaturePdfUpload extends VPUSignatureLitElement {
    constructor() {
        super();
        this.lang = i18n.language;
        this.entryPointUrl = commonUtils.getAPiUrl();
        this.files = [];
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(()=>{
            this.shadowRoot.querySelectorAll('vpu-fileupload')
                .forEach(element => {
                    element.addEventListener('vpu-fileupload-finished', this.addLogEntry.bind(this));
                });
        });
    }

    /**
     * TODO: Implement real box
     *
     * @param ev
     */
    addLogEntry(ev) {
        const ul = this.shadowRoot.querySelector('#log');
        const li = document.createElement('li');
        li.innerHTML = `<b>${ev.detail.status}</b> <tt>${ev.detail.filename}</tt>`;
        console.log(ev.detail);

        if (ev.detail.json) {
            this.files.push(ev.detail.json);
        }

        ul.appendChild(li);
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            if (propName === "lang") {
                i18n.changeLanguage(this.lang);
            }
        });

        super.update(changedProperties);
    }

    onLanguageChanged(e) {
        this.lang = e.detail.lang;
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS()}
            ${commonStyles.getNotificationCSS()}

            .hidden {
                display: none;
            }

            #location-identifier-block { display: none; }

            #location-identifier-block input {
                width: 100%;
                border-radius: var(--vpu-border-radius);
            }
        `;
    }

    /**
     * Download signed pdf files
     */
    zipDownloadClickHandler() {
        let zip = new JSZip();
        const that = this;

        // add all signed pdf files
        this.files.forEach((file) => {
            console.log(file);
            zip.file(file.fileName, file.file.replace("data:application/pdf;base64,", ""), {base64: true});
        });

        zip.generateAsync({type:"blob"})
            .then(function(content) {
                console.log(zip);

                // save with FileSaver.js
                saveAs(content, "signed-documents.zip");

                that._("#zip-download-button").stop();
            });
    }

    render() {
        const suggestionsCSS = commonUtils.getAssetURL(suggestionsCSSPath);

        return html`
            <link rel="stylesheet" href="${suggestionsCSS}">

            <form class="${classMap({hidden: !this.isLoggedIn() || !this.hasSignaturePermissions()})}">
                <div class="field">
                    <label class="label">${i18n.t('pdf-upload.field-label')}</label>
                    <div class="control">
                        <vpu-fileupload lang="${this.lang}" url="${this.entryPointUrl}/pdf_official_signing_actions" accept="application/pdf"
                            text="${i18n.t('pdf-upload.upload-area-text')}" button-label="${i18n.t('pdf-upload.upload-button-label')}"></vpu-fileupload>
                    </div>
                </div>
            </form>
            <div id="log"></div>
            <div class="field">
                <div class="control">
                    <vpu-button id="zip-download-button" value="Download ZIP" @click="${this.zipDownloadClickHandler}" type="is-primary"></vpu-button>
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
