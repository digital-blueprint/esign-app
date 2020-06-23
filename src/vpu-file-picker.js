import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import VPULitElement from 'vpu-common/vpu-lit-element';
import {MiniSpinner} from 'vpu-common';
import * as commonUtils from 'vpu-common/utils';
import * as commonStyles from 'vpu-common/styles';
import { createClient } from "webdav/web";
import {classMap} from 'lit-html/directives/class-map.js';
import {humanFileSize} from "vpu-common/i18next";
import Tabulator from 'tabulator-tables';

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
        this.isPickerActive = false;
        this.statusText = "";
        this.directoryPath = "/";
        this.directoryContents = [];
        this.webDavClient = null;
        this.tabulatorTable = null;

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
            isPickerActive: { type: Boolean, attribute: false },
            statusText: { type: String, attribute: false },
            directoryPath: { type: String, attribute: false },
            directoryContents: { type: Array, attribute: false },
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

            this.tabulatorTable = new Tabulator(this._("#directory-content-table"), {});
        });
    }

    openFilePicker() {
        this.statusText = "Auth in progress";
        this.loginWindow = window.open(this.authUrl, "Nextcloud Login",
            "width=400,height=400,menubar=no,scrollbars=no,status=no,titlebar=no,toolbar=no");
    }

    onReceiveWindowMessage(event) {
        const data = event.data;
        console.log("data", data);

        if (data.type === "webapppassword") {
            this.loginWindow.close();
            // alert("Login name: " + data.loginName + "\nApp password: " + data.token);

            const apiUrl = this.webDavUrl + "/" + data.loginName;

            // https://github.com/perry-mitchell/webdav-client/blob/master/API.md#module_WebDAV.createClient
            this.webDavClient = createClient(
                apiUrl,
                {
                    username: data.loginName,
                    password: data.token
                }
            );

            this.loadDirectory("");
        }
    }

    /**
     * Loads the directory from WebDAV
     *
     * @param path
     */
    loadDirectory(path) {
        this.statusText = "Loading directory from Nextcloud: " + path;
        this.directoryPath = path;
        this.directoryContents = [];

        // https://github.com/perry-mitchell/webdav-client#getdirectorycontents
        this.webDavClient
            .getDirectoryContents(path)
            .then(contents => {
                console.log("contents", contents);
                this.statusText = "";
                this.directoryContents = contents;

                this.tabulatorTable.setData(contents);

                this.isPickerActive = true;
            }).catch(error => {
            console.error(error.message);
            this.statusText = error.message;
            this.isPickerActive = false;
        });
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getGeneralCSS()}
            ${commonStyles.getButtonCSS()}

            .block {
                margin-bottom: 10px;
            }
        `;
    }

    /**
     * Returns the list of files in a directory
     *
     * @returns {*[]}
     */
    getDirectoryContentsHtml() {
        let results = [];

        // this.directoryContents.forEach((content) => {
        //     results.push(html`
        //         <tr>
        //             <td><a href="#" @click="${(e) => { this.fileClicked(content, e); }}">${content.filename}</a></td>
        //             <td>${content.size}</td>
        //         </tr>
        //     `);
        // });

        return results;
    }

    fileClicked(file, event) {
        this.loadDirectory(this.directoryPath + file.filename);
        event.preventDefault();
    }

    render() {
        commonUtils.initAssetBaseURL('vpu-tabulator-table');
        const tabulatorCss = commonUtils.getAssetURL('local/vpu-signature/tabulator-tables/css/tabulator.min.css');
        console.log("tabulatorCss", tabulatorCss);

        return html`
            <link rel="stylesheet" href="${tabulatorCss}">
            <div class="block">
                <button class="button"
                        title="${i18n.t('file-picker.open-file-picker')}"
                        @click="${async () => { this.openFilePicker(); } }">${i18n.t('file-picker.open')}</button>
            </div>
            <div class="block ${classMap({hidden: this.statusText === ""})}">
                <vpu-mini-spinner style="font-size: 0.7em"></vpu-mini-spinner>
                ${this.statusText}
            </div>
            <div class="block ${classMap({hidden: !this.isPickerActive})}">
                <h2>${this.directoryPath}</h2>
                <table id="directory-content-table">
                    <thead>
                        <th>Filename</th>
                        <th>Size</th>
                    </thead>
                    <tbody>${this.getDirectoryContentsHtml()}</tbody>
                </table>
            </div>
        `;
    }
}
