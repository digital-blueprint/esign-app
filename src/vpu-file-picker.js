import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import {classMap} from 'lit-html/directives/class-map.js';
import {live} from 'lit-html/directives/live.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import VPULitElement from 'vpu-common/vpu-lit-element';
import {MiniSpinner} from 'vpu-common';
import * as commonUtils from "vpu-common/utils";
import * as commonStyles from 'vpu-common/styles';
import pdfjs from 'pdfjs-dist';

const i18n = createI18nInstance();

/**
 * FilePicker web component
 */
export class FilePicker extends ScopedElementsMixin(VPULitElement) {
    constructor() {
        super();
        this.lang = 'de';
        this.baseUrl = '';
        this.loginWindow = null;

        this._onReceiveWindowMessage = this.onReceiveWindowMessage.bind(this);
    }

    static get scopedElements() {
        return {
            'vpu-mini-spinner': MiniSpinner,
        };
    }

    /**
     * See: https://lit-element.polymer-project.org/guide/properties#initialize
     */
    static get properties() {
        return {
            lang: { type: String },
            baseUrl: { type: String, attribute: "base-url" },
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "lang":
                    i18n.changeLanguage(this.lang);
                    break;
            }
        });

        super.update(changedProperties);
    }

    disconnectedCallback() {
        window.removeEventListener('message', this._onReceiveWindowMessage);
        super.disconnectedCallback();
      }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(()=>{
            // see: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
            window.addEventListener('message', this._onReceiveWindowMessage);
        });
    }

    openFilePicker() {
        this.loginWindow = window.open(this.baseUrl + "/apps/webapppassword/#", "Nextcloud Login",
            "width=400,height=400,menubar=no,scrollbars=no,status=no,titlebar=no,toolbar=no");
    }

    onReceiveWindowMessage(event) {
        const data = event.data;
        console.log("data", data);

        if (data.type === "webapppassword") {
            this.loginWindow.close();
            alert("Login name: " + data.loginName + "\nApp password: " + data.token);
        }
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getGeneralCSS()}
            ${commonStyles.getButtonCSS()}
        `;
    }

    render() {
        return html`
            <div>
                <button class="button"
                        title="${i18n.t('file-picker.open-file-picker')}"
                        @click="${async () => { this.openFilePicker(); } }">${i18n.t('file-picker.open')}</button>
            </div>
        `;
    }
}
