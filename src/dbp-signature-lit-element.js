import {LitElement} from "lit-element";
import {EventBus} from '@dbp-toolkit/common';
import buildinfo from 'consts:buildinfo';
import * as utils from "./utils";

export class DBPSignatureBaseLitElement extends LitElement {
    constructor() {
        super();
    }

    _(selector) {
        return this.shadowRoot === null ? this.querySelector(selector) : this.shadowRoot.querySelector(selector);
    }

    _hasSignaturePermissions(roleName) {
        return (window.DBPPerson && Array.isArray(window.DBPPerson.roles) && window.DBPPerson.roles.indexOf(roleName) !== -1);
    }

    _updateAuth(e) {
        this._loginStatus = e.status;
        // Every time isLoggedIn()/isLoading() return something different we request a re-render
        let newLoginState = [this.isLoggedIn(), this.isLoading()];
        if (this._loginState.toString() !== newLoginState.toString()) {
            this.requestUpdate();
        }
        this._loginState = newLoginState;
    }

    connectedCallback() {
        super.connectedCallback();

        this._loginStatus = '';
        this._loginState = [];
        this._bus = new EventBus();
        this._updateAuth = this._updateAuth.bind(this);
        this._bus.subscribe('auth-update', this._updateAuth);
    }

    disconnectedCallback() {
        this._bus.close();

        super.disconnectedCallback();
    }

    isLoggedIn() {
        return (window.DBPPerson !== undefined && window.DBPPerson !== null);
    }

    isLoading() {
        if (this._loginStatus === "logged-out")
            return false;
        return (!this.isLoggedIn() && window.DBPAuthToken !== undefined);
    }
}

export default class DBPSignatureLitElement extends DBPSignatureBaseLitElement {

    constructor() {
        super();
        this.queuedFiles = [];
        this.queuedFilesCount = 0;
        this.uploadInProgress = false;
        this.queueBlockEnabled = false;
        this._queueKey = 0;

        // will be set in function update
        this.fileSourceUrl = "";

        this.showTestNextcloudFilePicker = buildinfo.env !== 'production';
    }

    /**
     * @param file
     * @returns {Promise<number>} key of the queued item
     */
    async queueFile(file) {
        this._queueKey++;
        const key = this._queueKey;
        this.queuedFiles[key] = file;
        this.updateQueuedFilesCount();

        return key;
    }

    /**
     * Takes a file off of the queue
     *
     * @param key
     */
    takeFileFromQueue(key) {
        const file = this.queuedFiles[key];
        delete this.queuedFiles[key];
        this.updateQueuedFilesCount();

        return file;
    }

    uploadOneQueuedFile() {
        const file = this.takeFileFromQueue();

        return this.uploadFile(file);
    }

    getQueuedFile(key) {
        return this.queuedFiles[key];
    }

    getQueuedFiles() {
        return this.queuedFiles;
    }

    clearQueuedFiles() {
        this.queuedFiles = [];
        this.updateQueuedFilesCount();
    }

    updateQueuedFilesCount() {
        this.queuedFilesCount = Object.keys(this.queuedFiles).length;

        if (!this.queueBlockEnabled && this.queuedFilesCount > 0) {
            this.queueBlockEnabled = true;
        }

        return this.queuedFilesCount;
    }

    getQueuedFilesCount() {
        return this.queuedFilesCount;
    }

    /**
     * @param file
     * @param params
     * @returns {Promise<void>}
     */
    async uploadFile(file, params = {}) {
        this.uploadInProgress = true;
        this.uploadStatusFileName = file.name;
        let url = new URL(this.fileSourceUrl);
        let formData = new FormData();
        formData.append('file', file);
        for (let key in params) {
            formData.append(key, params[key]);
        }

        // FIXME: We now send the parameters via the body and keep this to
        // support older backends. Remove once the backend is deployed.
        url.search = new URLSearchParams(params).toString();

        // I got a 60s timeout in Google Chrome and found no way to increase that
        await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + window.DBPAuthToken,
            },
            body: formData
        })
            .then((response) => {
                /* Done. Inform the user */
                console.log(`Status: ${response.status} for file ${file.name}`);
                this.sendFinishedEvent(response, file);
            })
            .catch((response) => {
                /* Error. Inform the user */
                console.log(`Error status: ${response.status} for file ${file.name}`);
                this.sendFinishedEvent(response, file);
            });

        this.uploadInProgress = false;
    }

    async sendFinishedEvent(response, file) {
        if (response === undefined) {
            return;
        }

        let data =  {
            fileName: file.name,
            status: response.status,
            json: {"hydra:description": ""}
        };

        try {
            await response.json().then((json) => {
                data.json = json;
            });
        } catch (e) {
            console.error(e);
        }

        data.file = file;

        this.onFileUploadFinished(data);
    }

    /**
     * Open Filesink for multiple files
     */
    async zipDownloadClickHandler() {
        let files = [];

        // add all signed pdf-files
        this.signedFiles.forEach((file) => {
            const arr = utils.convertDataURIToBinary(file.contentUrl);
            const binaryFile = new File([arr], file.name, { type: utils.getDataURIContentType(file.contentUrl) });
            files.push(binaryFile);
        });
        this.signedFilesToDownload = files.length;
        this._("#file-sink").files = files;
        this._("#zip-download-button").stop();
    }

    /**
     * @param data
     */
    onFileUploadFinished(data) {
        console.log("Override me");
    }

    /**
     * Open Filesink for a single File
     *
     * @param file
     */
    async downloadFileClickHandler(file) {
        let files = [];
        const arr = utils.convertDataURIToBinary(file.contentUrl);
        const binaryFile = new File([arr], file.name, { type: utils.getDataURIContentType(file.contentUrl) });
        files.push(binaryFile);
        this.signedFilesToDownload = files.length;
        this._("#file-sink").files = files;
    }
}
