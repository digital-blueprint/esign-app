import * as utils from "./utils";
import {AdapterLitElement} from "@dbp-toolkit/provider/src/adapter-lit-element";
import JSONLD from "@dbp-toolkit/common/jsonld";
import * as commonUtils from "@dbp-toolkit/common/utils";

export class DBPSignatureBaseLitElement extends AdapterLitElement {
    constructor() {
        super();
        this.auth = {};
    }

    static get properties() {
        return {
            ...super.properties,
            auth: { type: Object },
        };
    }

    _(selector) {
        return this.shadowRoot === null ? this.querySelector(selector) : this.shadowRoot.querySelector(selector);
    }

    _hasSignaturePermissions(roleName) {
        return (this.auth.person && Array.isArray(this.auth.person.roles) && this.auth.person.roles.indexOf(roleName) !== -1);
    }

    _updateAuth() {
        this._loginStatus = this.auth['login-status'];
        // Every time isLoggedIn()/isLoading() return something different we request a re-render
        let newLoginState = [this.isLoggedIn(), this.isLoading()];
        if (this._loginState.toString() !== newLoginState.toString()) {
            this.requestUpdate();
        }
        this._loginState = newLoginState;
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "auth":
                    this._updateAuth();
                    break;
            }
        });

        super.update(changedProperties);
    }

    connectedCallback() {
        super.connectedCallback();

        this._loginStatus = '';
        this._loginState = [];
    }

    isLoggedIn() {
        return (this.auth.person !== undefined && this.auth.person !== null);
    }

    isLoading() {
        if (this._loginStatus === "logged-out")
            return false;
        return (!this.isLoggedIn() && this.auth.token !== undefined);
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
        this.showNextcloudFilePicker = false;

        // will be set in function update
        this.fileSourceUrl = "";

        this.fileSource = '';
        this.nextcloudDefaultDir = '';
    }

    static get properties() {
        return {
            ...super.properties,
            showNextcloudFilePicker: { type: Boolean, attribute: 'show-nextcloud-file-picker' },
        };
    }

    /**
     * @param file
     * @returns key of the queued item
     */
    queueFile(file) {
        this._queueKey++;
        const key = this._queueKey;
        this.queuedFiles[key] = file;
        this.updateQueuedFilesCount();
        return String(key);
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

    /**
     * Add an annotation to a file on the queue
     *
     * @param key
     */
    addAnnotation(key) {
        if (!this.queuedFilesAnnotations[key]) {
            this.queuedFilesAnnotations[key] = [];
            this.queuedFilesAnnotationsCount = 0;
        }

        // TODO: remove key/value presets
        const number =  Math.floor((Math.random() * 1000) + 1);
        this.queuedFilesAnnotations[key].push({'key1': 'geschaeftszahl', 'value': 'my value ' + number});

        // we just need this so the UI will update
        this.queuedFilesAnnotationsCount++;
    }

    /**
     * Add multiple annotations to a PDF file
     *
     * @param file
     * @param annotations
     * @returns {File}
     */
    async addAnnotationsToFile(file, annotations) {
        // We need to work with the AnnotationFactory because the pdf file is broken if
        // we add the multiple annotations to the file itself
        let pdfFactory = await utils.getAnnotationFactoryFromFile(file);

        await commonUtils.asyncObjectForEach(annotations, async (annotation) => {
            const key1 = (annotation.key1 || '').trim();
            const key2 = (annotation.key2 || '').trim();
            const value = (annotation.value || '').trim();

            if (key1 === '' || key2 === '' || value === '') {
                return;
            }

            const annotationTypeNames = utils.getAnnotationTypes(key1);

            pdfFactory = await utils.addKeyValuePdfAnnotationsToAnnotationFactory(
                pdfFactory, 'AppNameDE', 'AppNameEN', this.auth['user-full-name'], key1,
                annotationTypeNames.de, annotationTypeNames.en, key2, value);
        });

        // output the AnnotationFactory as File again
        return utils.writeAnnotationFactoryToFile(pdfFactory, file);
    }

    /**
     * Remove an annotation of a file on the queue
     *
     * @param key
     * @param id
     */
    removeAnnotation(key, id) {
        if (this.queuedFilesAnnotations[key] && this.queuedFilesAnnotations[key][id]) {
            delete this.queuedFilesAnnotations[key][id];
            // we just need this so the UI will update
            this.queuedFilesAnnotationsCount--;
        }
    }

    /**
     * Takes the annotations of a file off of the queue
     *
     * @param key
     */
    takeAnnotationsFromQueue(key) {
        const annotations = this.queuedFilesAnnotations[key];
        delete this.queuedFilesAnnotations[key];

        return annotations;
    }

    /**
     * Update an annotation of a file on the queue
     *
     * @param key
     * @param id
     * @param annotationKey
     * @param value
     */
    updateAnnotation(key, id, annotationKey, value) {
        if (this.queuedFilesAnnotations[key] && this.queuedFilesAnnotations[key][id]) {
            this.queuedFilesAnnotations[key][id][annotationKey] = value;
        }
    }

    /**
     * Add an annotation to a file on the queue
     *
     * @param key
     */
    async addAnnotationToPDF(key) {
        const annotationKey = prompt("Please enter a key");

        if (annotationKey === null || annotationKey === "") {
            return;
        }

        const annotationValue = prompt("Please enter a value");

        if (annotationValue === null || annotationValue === "") {
            return;
        }

        let file = this.queuedFiles[key];

        // console.log("file before annotation", file);

        // annotate the pdf with the key and value
        file = await utils.addKeyValuePdfAnnotation(file, 'AppNameDE', 'AppNameEN', this.auth['user-full-name'], annotationKey, annotationValue);

        // console.log("file after annotation", file);

        // overwrite the current pdf
        this.queuedFiles[key] = file;

        return file;
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
     * @param annotations
     * @param i18n
     * @returns {Promise<void>}
     */
    async uploadFile(file, params = {}, annotations = [], i18n = {}) {
        this.uploadInProgress = true;
        this.uploadStatusFileName = file.name;
        let formData = new FormData();

        // add annotations
        if (annotations.length > 0) {
            file = await this.addAnnotationsToFile(file, annotations, i18n)
            console.log("uploadFile file", file);

            // Also send to the server so it gets included in the signature block
            let userText = [];
            for (let ann of annotations) {
                userText.push({"description": ann["key1"], "value": `${ann["value"]} (${ann["key2"]})`});
            }
            formData.append("user_text", JSON.stringify(userText));
        }

        let url = new URL(this.fileSourceUrl);
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
                'Authorization': 'Bearer ' + this.auth.token,
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

    onFileSourceSwitch(event)
    {
        if (event.detail.source) {
            this.fileSource = event.detail.source;
        }
        if (event.detail.nextcloud) {
            this.nextcloudDefaultDir = event.detail.nextcloud;
        }
        event.preventDefault();
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
