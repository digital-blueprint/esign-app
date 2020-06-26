import {LitElement} from "lit-element";
import {EventBus} from 'vpu-common';

export default class VPUSignatureLitElement extends LitElement {
    constructor() {
        super();
        this.queuedFiles = [];
        this.queuedFilesCount = 0;
        this.uploadInProgress = false;
        this.queueBlockEnabled = false;
        this._queueKey = 0;

        // will be set in function update
        this.fileSourceUrl = "";
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
        url.search = new URLSearchParams(params).toString();
        let formData = new FormData();
        formData.append('file', file);

        // I got a 60s timeout in Google Chrome and found no way to increase that
        await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + window.VPUAuthToken,
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
        } catch (e) {}

        data.file = file;

        this.onFileUploadFinished(data);
    }

    /**
     * @param data
     */
    onFileUploadFinished(data) {
        console.log("Override me");
    }

    _(selector) {
        return this.shadowRoot === null ? this.querySelector(selector) : this.shadowRoot.querySelector(selector);
    }

    _hasSignaturePermissions(roleName) {
        return (window.VPUPerson && Array.isArray(window.VPUPerson.roles) && window.VPUPerson.roles.indexOf(roleName) !== -1);
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
        return (window.VPUPerson !== undefined && window.VPUPerson !== null);
    }

    isLoading() {
        if (this._loginStatus === "logged-out")
            return false;
        return (!this.isLoggedIn() && window.VPUAuthToken !== undefined);
    }

    getOrganization() {
        const organizationSelect = this._("vpu-knowledge-base-organization-select");

        if (organizationSelect) {
            const objectText = organizationSelect.getAttribute("data-object");

            if (objectText !== null) {
                return JSON.parse(objectText);
            }
        }

        return null;
    }

    getOrganizationCode() {
        const organization = this.getOrganization();

        return organization !== null ? organization.alternateName : "";
    }
}
