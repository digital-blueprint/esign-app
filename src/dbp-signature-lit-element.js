import * as utils from "./utils";
import * as commonUtils from "@dbp-toolkit/common/utils";
import {BaseLitElement} from './base-element.js';
import {SignatureEntry} from './signature-entry.js';

export default class DBPSignatureLitElement extends BaseLitElement {
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
     * @returns {string} key of the queued item
     */
    queueFile(file) {
        this._queueKey++;
        const key = String(this._queueKey);
        this.queuedFiles[key] = new SignatureEntry(key, file);
        this.updateQueuedFilesCount();
        return key;
    }

    /**
     * Takes a file off of the queue
     *
     * @param key
     * @returns {SignatureEntry} entry
     */
    takeFileFromQueue(key) {
        const entry = this.queuedFiles[key];
        delete this.queuedFiles[key];
        this.updateQueuedFilesCount();

        return entry;
    }

    /**
     * 
     * @param {*} key 
     * @param {*} name 
     * @returns shows PdfAnnotationView
     */
    async showAnnotationView(key, name) {

        this.queuedFilesAnnotationModes[key] = name;
        console.log(name);

        if (this.signingProcessEnabled) {
            return;
        }

        if (name === 'text-selected') {
            const file = this.getQueuedFile(key);
            this.currentFile = file;
            this.currentPreviewQueueKey = key;
            console.log(file);

            this.addAnnotationInProgress = true;

            const viewTag = this.getScopedTagName('dbp-pdf-annotation-view');
            this._(viewTag).setAttribute('key', key);
            this._(viewTag).setAnnotationRows(this.queuedFilesAnnotations[key]);

            this.isAnnotationViewVisible = true;
            this.enableAnnotationsForKey(key);
        } else {
            this.disableAnnotationsForKey(key);
            this.queuedFilesAnnotationSaved[key] = false;

            if (this.currentPreviewQueueKey === key) {
                this.isAnnotationViewVisible = false;
            }
        }
    }

    /**
     * 
     * @param {*} event 
     */
    processAnnotationEvent(event) {
        let annotationDetails = event.detail;
        let key = this.currentPreviewQueueKey;

        this.queuedFilesAnnotations[key] = annotationDetails.annotationRows;

        this.isAnnotationViewVisible = false;
        this.addAnnotationInProgress = false;

        this.queuedFilesAnnotationModes[this.currentPreviewQueueKey] = "text-selected";
        this.queuedFilesAnnotationSaved[this.currentPreviewQueueKey] = true;
    }

    /**
     * 
     * @param {*} event 
     */
    processAnnotationCancelEvent(event) {
        let key = this.currentPreviewQueueKey;

        this.queuedFilesAnnotations[key] = [];
        this.queuedFilesAnnotations[key] = undefined;
        this.disableAnnotationsForKey(key);

        this.queuedFilesAnnotationModes[this.currentPreviewQueueKey] = "no-text";
        this.queuedFilesAnnotationSaved[this.currentPreviewQueueKey] = false;
    }

    /**
     * Hides the PdfAnnotationView
     */
    hideAnnotationView() {
        console.log('hide view - x click');

        if (this.queuedFilesAnnotationSaved[this.currentPreviewQueueKey] !== undefined && this.queuedFilesAnnotationSaved[this.currentPreviewQueueKey]) {
            this.queuedFilesAnnotationModes[this.currentPreviewQueueKey] = "text-selected";
        } else {
            this.queuedFilesAnnotationModes[this.currentPreviewQueueKey] = "no-text";
        }
        this.isAnnotationViewVisible = false;
        this.addAnnotationInProgress = false;
    }

    /**
     * Add multiple annotations to a PDF file
     *
     * @param file
     * @param annotations
     * @returns {File} file given as parameter, but with annotations
     */
    async addAnnotationsToFile(file, annotations) {
        // We need to work with the AnnotationFactory because the pdf file is broken if
        // we add the multiple annotations to the file itself
        let pdfFactory = await utils.getAnnotationFactoryFromFile(file);
        const activityNameDE = this.activity.getName('de');
        const activityNameEN = this.activity.getName('en');

        await commonUtils.asyncObjectForEach(annotations, async (annotation) => {
            console.log("annotation", annotation);

            const annotationType = (annotation.annotationType || '').trim();
            const organizationNumber = (annotation.organizationNumber || '').trim();
            const value = (annotation.value || '').trim();

            if (annotationType === '' || value === '') {
                return;
            }

            const annotationTypeData = utils.getAnnotationTypes(annotationType);

            pdfFactory = await utils.addKeyValuePdfAnnotationsToAnnotationFactory(
                pdfFactory, activityNameDE, activityNameEN, this.auth['user-full-name'], annotationType,
                annotationTypeData.name.de, annotationTypeData.name.en, organizationNumber, value);
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
        this.disableAnnotationsForKey(key);

        return annotations;
    }

    /**
     * Checks if annotations are enabled for an annotation key
     *
     * @param key
     * @returns {boolean}
     */
    isAnnotationsEnabledForKey(key) {
        return this.queuedFilesEnabledAnnotations.includes(key);
    }

    /**
     * Enables annotations for an annotation key
     *
     * @param key
     */
    enableAnnotationsForKey(key) {
        if (!this.isAnnotationsEnabledForKey(key)) {
            this.queuedFilesEnabledAnnotations.push(key);
        }
    }

    /**
     * Disables annotations for an annotation key
     *
     * @param key
     */
    disableAnnotationsForKey(key) {
        let i = 0;

        // remove all occurrences of the value "key" in array this.queuedFilesEnabledAnnotations
        while (i < this.queuedFilesEnabledAnnotations.length) {
            if (this.queuedFilesEnabledAnnotations[i] === key) {
                this.queuedFilesEnabledAnnotations.splice(i, 1);
            } else {
                ++i;
            }
        }
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

    getQueuedFile(key) {
        return this.queuedFiles[key];
    }

    clearQueuedFiles() {
        this.queuedFilesAnnotations = [];
        this.queuedFilesAnnotationsCount = 0;
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

    /**
     * @param file
     * @param params
     * @param annotations
     * @returns {Promise<void>}
     */
    async uploadFile(file, params = {}, annotations = []) {
        this.uploadInProgress = true;
        this.uploadStatusFileName = file.name;
        let formData = new FormData();

        // add annotations
        if (annotations.length > 0) {
            file = await this.addAnnotationsToFile(file, annotations);
            console.log("uploadFile file", file);

            // Also send annotations to the server so they get included in the signature block
            let userText = [];
            for (let annotation of annotations) {
                const annotationTypeData = utils.getAnnotationTypes(annotation['annotationType']);
                const organizationNumberText = annotation['organizationNumber'] ? ` (${annotation['organizationNumber']})` : '';

                userText.push({
                    'description': `${annotationTypeData.name.de || ''} / ${annotationTypeData.name.en || ''}`,
                    'value': annotation['value'] + organizationNumberText
                });
            }
            formData.append('user_text', JSON.stringify(userText));
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
     * @param id of element to mark
     */
    async downloadFileClickHandler(file, id) {
        let files = [];
        const arr = utils.convertDataURIToBinary(file.contentUrl);
        const binaryFile = new File([arr], file.name, { type: utils.getDataURIContentType(file.contentUrl) });
        files.push(binaryFile);
        this.signedFilesToDownload = files.length;
        this._("#file-sink").files = files;
        const div = this.shadowRoot.querySelector('#' + id);
        div.classList.add('downloaded');
    }
}
