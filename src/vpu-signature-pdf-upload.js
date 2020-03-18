import $ from 'jquery';
import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import VPUSignatureLitElement from "./vpu-signature-lit-element";
import * as commonUtils from 'vpu-common/utils';
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
        this.organizationId = '';
    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
        };
    }

    $(selector) {
        return $(this._(selector));
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(()=>{
        });
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

    render() {
        const suggestionsCSS = commonUtils.getAssetURL(suggestionsCSSPath);

        return html`
            <link rel="stylesheet" href="${suggestionsCSS}">

            <form class="${classMap({hidden: !this.isLoggedIn() || !this.hasSignaturePermissions()})}">
                <div class="field">
                    <label class="label">${i18n.t('pdf-upload.label')}</label>
                    <div class="control">
                        <vpu-fileupload lang="${this.lang}" url="${this.entryPointUrl}/pdf_official_signing_actions" accept="application/pdf"
                            text="Einreichung als PDF" button-label="PDF auswählen"></vpu-fileupload>
                    </div>
                </div>

            </form>
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
