import * as utils from './utils';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {BaseLitElement} from './base-element.js';
import {SignatureEntry} from './signature-entry.js';
import {getPDFSignatureCount} from './utils';
import { send } from '@dbp-toolkit/common/notification';

export default class DBPSignatureLitElement extends BaseLitElement {
    constructor() {
        super();
        this.queuedFiles = [];
        this.queuedFilesCount = 0;
        this.uploadInProgress = false;
        this.queueBlockEnabled = false;
        this._queueKey = 0;

        // will be set in function update
        this.fileSourceUrl = '';

        this.fileSource = '';
        this.nextcloudDefaultDir = '';
    }

    static get properties() {
        return {
            ...super.properties,
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
     * @param {*} key
     * @param {*} name
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

            const viewTag = 'dbp-pdf-annotation-view';
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

        this.queuedFilesAnnotationModes[this.currentPreviewQueueKey] = 'text-selected';
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

        this.queuedFilesAnnotationModes[this.currentPreviewQueueKey] = 'no-text';
        this.queuedFilesAnnotationSaved[this.currentPreviewQueueKey] = false;
    }

    /**
     * Hides the PdfAnnotationView
     */
    hideAnnotationView() {
        console.log('hide view - x click');

        if (
            this.queuedFilesAnnotationSaved[this.currentPreviewQueueKey] !== undefined &&
            this.queuedFilesAnnotationSaved[this.currentPreviewQueueKey]
        ) {
            this.queuedFilesAnnotationModes[this.currentPreviewQueueKey] = 'text-selected';
        } else {
            this.queuedFilesAnnotationModes[this.currentPreviewQueueKey] = 'no-text';
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
            console.log('annotation', annotation);

            const annotationType = (annotation.annotationType || '').trim();
            const value = (annotation.value || '').trim();

            if (annotationType === '' || value === '') {
                return;
            }

            const annotationTypeData = utils.getAnnotationTypes(annotationType);

            pdfFactory = await utils.addKeyValuePdfAnnotationsToAnnotationFactory(
                pdfFactory,
                activityNameDE,
                activityNameEN,
                this.auth['user-full-name'],
                annotationType,
                annotationTypeData.name.de,
                annotationTypeData.name.en,
                value
            );
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
     * @returns {boolean} true if annotations are enabled for annotation key
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

            // Also send annotations to the server so they get included in the signature block
            let userText = [];
            for (let annotation of annotations) {
                const annotationTypeData = utils.getAnnotationTypes(annotation['annotationType']);

                userText.push({
                    description: `${annotationTypeData.name.de || ''} / ${
                        annotationTypeData.name.en || ''
                    }`,
                    value: annotation['value'],
                });
            }
            formData.append('user_text', JSON.stringify(userText));
        }

        let url = new URL(this.fileSourceUrl);
        formData.append('file', file);
        for (let key in params) {
            formData.append(key, params[key]);
        }

        // I got a 60s timeout in Google Chrome and found no way to increase that
        await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + this.auth.token,
            },
            body: formData,
        })
            .then((response) => {
                /* Done. Inform the user */
                console.log(`Status: ${response.status} for file ${file.name}`);
                this.sendFinishedEvent(response, file);
            })
            .catch((response) => {
                /* Error. Inform the user */
                if (response.message) {
                    send({
                        summary: 'Error!',
                        body: response.message,
                        type: 'danger',
                        timeout: 15,
                    });
                    console.log(`Error message: ${response.message}`);
                }
                this.sendFinishedEvent(response, file);
            });

        this.uploadInProgress = false;
    }

    async sendFinishedEvent(response, file) {
        if (response === undefined) {
            return;
        }

        let data = {
            fileName: file.name,
            status: response.status,
            json: {'hydra:description': ''},
        };

        if (response.status !== 201 && response.message) {
            data.json = { 'hydra:description': response.message};
        }

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

    onFileSourceSwitch(event) {
        if (event.detail.source) {
            this.fileSource = event.detail.source;
        }
        if (event.detail.nextcloud) {
            this.nextcloudDefaultDir = event.detail.nextcloud;
        }
        event.preventDefault();
    }

    /**
     * Convert files to binary async
     */
    async convertFiles() {
        let files = [];

        for (const file of this.signedFiles) {
            const arr = utils.convertDataURIToBinary(file.contentUrl);
            const binaryFile = new File([arr], file.name, {
                type: utils.getDataURIContentType(file.contentUrl),
            });
            files.push(binaryFile);
        }
        return files;
    }

    /**
     * Open Filesink for multiple files
     */
    async zipDownloadClickHandler() {
        // add all signed pdf-files
        const files = await this.convertFiles();

        this._('#file-sink').files = [...files];
        this.signedFilesToDownload = files.length;

        this._('#zip-download-button').stop();
        // mark downloaded files buttons
        const spans = this.shadowRoot.querySelectorAll(
            '.file-block > div.header > span.filename > span.bold-filename'
        );
        spans.forEach((span) => {
            span.classList.remove('bold-filename');
        });
    }

    /**
     * @param data
     */
    onFileUploadFinished(data) {
        console.log('Override me');
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
        const binaryFile = new File([arr], file.name, {
            type: utils.getDataURIContentType(file.contentUrl),
        });
        files.push(binaryFile);
        this.signedFilesToDownload = files.length;
        this._('#file-sink').files = [...files];
        // mark downloaded files button
        const span = this.shadowRoot.querySelector(
            '#' + id + ' > div.header > span.filename > span.bold-filename'
        );
        if (span) {
            span.classList.remove('bold-filename');
        }
    }

    async _updateNeedsPlacementStatus(id) {
        let entry = this.queuedFiles[id];
        let sigCount = await getPDFSignatureCount(entry.file);
        this.queuedFilesNeedsPlacement.delete(id);
        if (sigCount > 0) this.queuedFilesNeedsPlacement.set(id, true);
    }

    storePDFData(event) {
        let placement = event.detail;
        let placementMode = placement.signaturePlacementMode;

        let key = this.currentPreviewQueueKey;
        this.queuedFilesSignaturePlacements[key] = placement;
        this.queuedFilesPlacementModes[key] = placementMode;
        this.signaturePlacementInProgress = false;
    }

    /**
     * Called when preview is "canceled"
     *
     * @param event
     */
    hidePDF(event) {
        // reset placement mode to "auto" if no placement was confirmed previously
        if (this.queuedFilesSignaturePlacements[this.currentPreviewQueueKey] === undefined) {
            this.queuedFilesPlacementModes[this.currentPreviewQueueKey] = 'auto';
        }
        this.signaturePlacementInProgress = false;
    }

    queuePlacementSwitch(key, name) {
        this.queuedFilesPlacementModes[key] = name;
        this.showPreview(key, true);
        this.requestUpdate();
    }

    queuePlacement(key, name, showSignature = true) {
        this.queuedFilesPlacementModes[key] = name;
        this.showPreview(key, showSignature);
        this.requestUpdate();
    }

    endSigningProcessIfQueueEmpty() {
        if (this.queuedFilesCount === 0 && this.signingProcessActive) {
            this.signingProcessActive = false;
        }
    }

    /**
     * @param ev
     */
    onFileSelected(ev) {
        this.queueFile(ev.detail.file);
    }

    /**
     * Re-Upload all failed files
     */
    reUploadAllClickHandler() {
        const that = this;

        // we need to make a copy and reset the queue or else our queue will run crazy
        const errorFilesCopy = {...this.errorFiles};
        this.errorFiles = [];
        this.errorFilesCount = 0;

        commonUtils.asyncObjectForEach(errorFilesCopy, async (file, id) => {
            await this.fileQueueingClickHandler(file.file, id);
        });

        that._('#re-upload-all-button').stop();
    }

    /**
     * Queues a failed pdf-file again
     *
     * @param file
     * @param id
     */
    async fileQueueingClickHandler(file, id) {
        this.takeFailedFileFromQueue(id);
        return this.queueFile(file);
    }

    /**
     * Shows the preview
     *
     * @param key
     * @param withSigBlock
     */
    async showPreview(key, withSigBlock = false) {
        if (this.signingProcessEnabled) {
            return;
        }

        const entry = this.getQueuedFile(key);
        this.currentFile = entry.file;
        this.currentPreviewQueueKey = key;
        // start signature placement process
        this.signaturePlacementInProgress = true;
        this.withSigBlock = withSigBlock;
        await this._('dbp-pdf-preview').showPDF(
            entry.file,
            withSigBlock, //this.queuedFilesPlacementModes[key] === "manual",
            this.queuedFilesSignaturePlacements[key]
        );
    }

    onLanguageChanged(e) {
        this.lang = e.detail.lang;
    }

    /**
     * Takes a failed file off of the queue
     *
     * @param key
     */
    takeFailedFileFromQueue(key) {
        const file = this.errorFiles.splice(key, 1);
        this.errorFilesCount = Object.keys(this.errorFiles).length;
        return file;
    }

    clearSignedFiles() {
        this.signedFiles = [];
        this.signedFilesCount = 0;
    }

    clearErrorFiles() {
        this.errorFiles = [];
        this.errorFilesCount = 0;
    }

    isUserInterfaceDisabled() {
        return (
            this.signaturePlacementInProgress ||
            this.externalAuthInProgress ||
            this.uploadInProgress ||
            this.addAnnotationInProgress
        );
    }
}
