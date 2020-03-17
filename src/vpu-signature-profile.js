import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import VPUSignatureLitElement from "./vpu-signature-lit-element";
import * as commonUtils from 'vpu-common/utils';
import * as commonStyles from 'vpu-common/styles';
import 'vpu-person-profile';

const i18n = createI18nInstance();

class SignatureProfile extends VPUSignatureLitElement {

    constructor() {
        super();
        this.lang = i18n.language;
        this._personId = window.VPUPersonId;
        this.entryPointUrl = commonUtils.getAPiUrl();

    }

    static get properties() {
        return {
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            _personId: {type: String, attribute: false},
        };
    }

    connectedCallback() {
        super.connectedCallback();

        window.addEventListener("vpu-auth-person-init", () => {
            this._personId = window.VPUPersonId;
        });
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS()}
        `;
    }

    render() {
        return html`
            <vpu-person-profile value="${this._personId}" entry-point-url="${this.entryPointUrl}"" lang="${this.lang}"></vpu-person-profile>
        `;
    }
}

commonUtils.defineCustomElement('vpu-signature-profile', SignatureProfile);
