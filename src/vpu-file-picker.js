import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import VPULitElement from 'vpu-common/vpu-lit-element';
import {MiniSpinner} from 'vpu-common';
import * as commonStyles from 'vpu-common/styles';
import { createClient } from "webdav/web";

const i18n = createI18nInstance();

/**
 * FilePicker web component
 */
export class FilePicker extends ScopedElementsMixin(VPULitElement) {
    constructor() {
        super();
        this.lang = 'de';
        this.authUrl = '';
        this.webDavUrl = '';
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
            authUrl: { type: String, attribute: "auth-url" },
            webDavUrl: { type: String, attribute: "web-dav-url" },
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
        this.loginWindow = window.open(this.authUrl, "Nextcloud Login",
            "width=400,height=400,menubar=no,scrollbars=no,status=no,titlebar=no,toolbar=no");
    }

    async onReceiveWindowMessage(event) {
        const data = event.data;
        console.log("data", data);

        if (data.type === "webapppassword") {
            this.loginWindow.close();
            // alert("Login name: " + data.loginName + "\nApp password: " + data.token);

            const apiUrl = this.webDavUrl + "/" + data.loginName;

            const client = createClient(
                apiUrl,
                {
                    username: data.loginName,
                    password: data.token
                }
            );

            const directoryItems = await client.getDirectoryContents("/");

            console.log("directoryItems", directoryItems);

            return;

            fetch(apiUrl, {
                method: 'PROPFIND',
                headers: {
                    'Content-Type': 'text/xml',
                    'Authorization': 'Basic ' + btoa(data.loginName + ":" + data.token),
                },
                data: "<?xml version=\"1.0\"?>" +
                "<a:propfind xmlns:a=\"DAV:\">" +
                "<a:prop><a:resourcetype />" +
                "</a:prop>" +
                "</a:propfind>"
            })
                .then(result => {
                    console.log("result", result);

                    if (!result.ok) throw result;

                    return result.text();
                })
                .then((xml) => {
                    console.log("xml", xml);
                }).catch(error => {
                    console.error("error", error);
                });
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
