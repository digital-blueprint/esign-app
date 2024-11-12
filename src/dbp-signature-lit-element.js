import {createInstance} from './i18n.js';
import * as utils from './utils';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {BaseLitElement} from './base-element.js';
import {SignatureEntry} from './signature-entry.js';
import {getPDFSignatureCount} from './utils';
import { send } from '@dbp-toolkit/common/notification';
import { humanFileSize } from '@dbp-toolkit/common/i18next';

export default class DBPSignatureLitElement extends BaseLitElement {
    constructor() {
        super();
        this._i18n = createInstance();
        this.queuedFiles = [];
        this.queuedFilesCount = 0;
        this.uploadInProgress = false;
        this.queueBlockEnabled = false;
        this._queueKey = 0;

        this.queuedFilesAnnotationModes = [];
        this.signingProcessEnabled = false;
        this.queuedFilesAnnotationSaved = [];
        this.queuedFilesEnabledAnnotations = [];
        this.queuedFilesNeedsPlacement = new Map();
        this.queuedFilesSignaturePlacements = [];
        this.queuedFilesPlacementModes = [];
        this.externalAuthInProgress = false;
        this.tableQueuedFilesTable = null;
        this.tableSignedFilesTable = null;
        this.tableFailedFilesTable = null;
        this.queuedFilesOptions = {};
        this.signedFilesOptions = {};
        this.failedFilesOptions = {};
        this.queuedFilesTableExpanded = false;
        this.queuedFilesTableAllSelected = false;
        this.queuedFilesTableCollapsible = false;
        this.currentFile = {};
        this.currentFileName = '';
        this.currentFilePlacementMode = '';
        this.currentFileSignaturePlacement = {};
        this.queuedFilesAnnotations = [];
        this.queuedFilesAnnotationsCount = 0;
        this.uploadStatusFileName = '';
        this.uploadStatusText = '';
        this.signingProcessActive = false;
        this.signaturePlacementInProgress = false;
        this.signedFilesToDownload = 0;
        this.withSigBlock = false;
        this.currentPreviewQueueKey = '';
        this.allowAnnotating = false;
        this.isAnnotationViewVisible = false;
        this.addAnnotationInProgress = false;
        // will be set in function update
        this.fileSourceUrl = '';
        this.fileSource = '';
        this.nextcloudDefaultDir = '';
        this.signedFiles = [];
        this.signedFilesCount = 0;
        this.errorFiles = [];
        this.errorFilesCount = 0;
        this.selectedFiles = [];
        this.selectedFilesProcessing = false;
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            nextcloudWebAppPasswordURL: {type: String, attribute: 'nextcloud-web-app-password-url'},
            nextcloudWebDavURL: {type: String, attribute: 'nextcloud-webdav-url'},
            nextcloudName: {type: String, attribute: 'nextcloud-name'},
            nextcloudFileURL: {type: String, attribute: 'nextcloud-file-url'},
            nextcloudAuthInfo: {type: String, attribute: 'nextcloud-auth-info'},
            signedFiles: {type: Array, attribute: false},
            signedFilesCount: {type: Number, attribute: false},
            signedFilesToDownload: {type: Number, attribute: false},
            queuedFilesCount: {type: Number, attribute: false},
            errorFiles: {type: Array, attribute: false},
            errorFilesCount: {type: Number, attribute: false},
            uploadInProgress: {type: Boolean, attribute: false},
            uploadStatusFileName: {type: String, attribute: false},
            uploadStatusText: {type: String, attribute: false},
            signingProcessEnabled: {type: Boolean, attribute: false},
            signingProcessActive: {type: Boolean, attribute: false},
            queueBlockEnabled: {type: Boolean, attribute: false},
            currentFile: {type: Object, attribute: false},
            currentFileName: {type: String, attribute: false},
            signaturePlacementInProgress: {type: Boolean, attribute: false},
            withSigBlock: {type: Boolean, attribute: false},
            isSignaturePlacement: {type: Boolean, attribute: false},
            allowAnnotating: {type: Boolean, attribute: 'allow-annotating'},
            isAnnotationViewVisible: {type: Boolean, attribute: false},
            queuedFilesAnnotations: {type: Array, attribute: false},
            queuedFilesAnnotationsCount: {type: Number, attribute: false},
            addAnnotationInProgress: {type: Boolean, attribute: false},
            queuedFilesAnnotationModes: {type: Array, attribute: false},
            queuedFilesAnnotationSaved: {type: Array, attribute: false},
            fileHandlingEnabledTargets: {type: String, attribute: 'file-handling-enabled-targets'},
            queuedFilesTableExpanded: {type: Boolean, attribute: false},
            queuedFilesTableAllSelected: {type: Boolean, attribute: false},
            queuedFilesTableCollapsible: {type: Boolean, attribute: false},
            selectedFiles: {type: Array, attribute: false},
        };
    }

    /**
     * @param file
     * @returns {Promise<string>} key of the queued item
     */
    async queueFile(file) {
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
     * @returns {Promise<File>} file given as parameter, but with annotations
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

    /**
     * Return true if the key of the file is in the selectedFiles
     * @param {string} key
     * @returns {boolean}
     */
    fileIsSelectedFile(key){
        return this.selectedFiles.some((file) => file.key === key);
    }

    tabulatorTableHandleCollapse(event) {
        if (event.detail.isCollapsible === true) {
            this.queuedFilesTableCollapsible = true;
        } else {
            this.queuedFilesTableCollapsible = false;
        }
    }

    /**
     * Update selectedRows on selection changes
     * @param {object} tableEvent
     */
    handleTableSelection(tableEvent) {
        const selectedRows = tableEvent.detail.selected;
        const deSelectedRows = tableEvent.detail.deselected;

        // Add selected files
        if (Array.isArray(selectedRows) && selectedRows.length > 0) {
            selectedRows.forEach(selectedRow => {
                const rowIndex = String(selectedRow.getIndex());
                const rowData = selectedRow.getData();
                const fileName = rowData.fileName;
                const existingIndex = this.selectedFiles.findIndex(row => row.key === rowIndex);
                if (existingIndex === -1) {
                    this.selectedFiles.push({
                        key: rowIndex,
                        filename: fileName
                    });
                }
            });
        }

        // Remove selected files
        if (Array.isArray(deSelectedRows) && deSelectedRows.length > 0) {
            deSelectedRows.forEach(deSelectedRow => {
                const rowIndex = String(deSelectedRow.getIndex());
                const deselectedIndex = this.selectedFiles.findIndex(row => row.key === rowIndex);
                this.selectedFiles.splice(deselectedIndex, 1);
            });
        }
    }

    getActionButtonsHtml(id) {
        const i18n = this._i18n;
        let controlDiv = document.createElement('div');
        controlDiv.classList.add('tabulator-icon-buttons');

        // Edit signature button
        const btnEditSignature = document.createElement('dbp-icon-button');
        btnEditSignature.setAttribute('icon-name', 'pencil');
        btnEditSignature.classList.add('edit-signature-button');
        btnEditSignature.setAttribute('aria-label', i18n.t('edit-signature-button-title'));
        btnEditSignature.setAttribute('title', i18n.t('edit-signature-button-title'));
        btnEditSignature.setAttribute('data-placement', this.queuedFilesPlacementModes[id] || 'auto');
        btnEditSignature.addEventListener("click", async (event) => {
            event.stopPropagation();
            const editButton = /** @type {HTMLElement} */ (event.target);
            const placement  = editButton.getAttribute('data-placement');
            this._('#pdf-preview dbp-pdf-preview').removeAttribute('don-t-show-buttons');
            if (this.queuedFilesPlacementModes[id] === "manual") {
                this.queuePlacement(id, placement);
            } else {
                // Hide signature when auto placement is active
                this.queuePlacement(id, placement, false);
            }

        });
        controlDiv.appendChild(btnEditSignature);

        // Add annotation button
        const btnAnnotation = document.createElement('dbp-icon-button');
        btnAnnotation.setAttribute('icon-name', 'bubble');
        btnAnnotation.classList.add('annotation-button');
        btnAnnotation.setAttribute('aria-label', i18n.t('annotation-button-title'));
        btnAnnotation.setAttribute('title', i18n.t('annotation-button-title'));
        btnAnnotation.addEventListener("click", async (event) => {
            event.stopPropagation();
            this.showAnnotationView(id, 'text-selected');
        });
        controlDiv.appendChild(btnAnnotation);

        // Show preview button
        const btnPreview = document.createElement('dbp-icon-button');
        btnPreview.setAttribute('icon-name', 'keyword-research');
        btnPreview.classList.add('preview-button');
        btnPreview.setAttribute('aria-label', i18n.t('preview-file-button-title'));
        btnPreview.setAttribute('title', i18n.t('preview-file-button-title'));
        btnPreview.addEventListener("click", async (event) => {
            event.stopPropagation();
            this._('#pdf-preview dbp-pdf-preview').setAttribute('don-t-show-buttons', true);
            this.showPreview(id);
        });
        controlDiv.appendChild(btnPreview);

        // Delete button
        const btnDelete = document.createElement('dbp-icon-button');
        btnDelete.setAttribute('icon-name', 'trash');
        btnDelete.classList.add('delete-button');
        btnDelete.setAttribute('aria-label', i18n.t('remove-queued-file-button-title'));
        btnDelete.setAttribute('title', i18n.t('remove-queued-file-button-title'));
        const fileName = this.queuedFiles[id].file.name;
        if (fileName) {
            btnDelete.setAttribute('data-filename', fileName);
        }
        btnDelete.addEventListener("click", async (event) => {
            event.stopPropagation();
            const editButton = /** @type {HTMLElement} */ (event.target);
            const fileName  = editButton.getAttribute('data-filename') || i18n.t('this-file');
            const result = confirm(i18n.t('confirm-delete-file', { file: fileName}));

            if (result) {
                this.takeFileFromQueue(id);
            }
        });
        controlDiv.appendChild(btnDelete);

        return controlDiv;
    }

    getDownloadButtonHtml(id, file) {
        const i18n = this._i18n;
        let controlDiv = document.createElement('div');
        controlDiv.classList.add('tabulator-download-button');
        // Download button
        const btnDownload = document.createElement('dbp-icon-button');
        btnDownload.setAttribute('icon-name', 'download');
        btnDownload.classList.add('download-button');
        btnDownload.setAttribute('aria-label', i18n.t('download-file-button-title'));
        btnDownload.setAttribute('title', i18n.t('download-file-button-title'));
        btnDownload.addEventListener("click", async (event) => {
            event.stopPropagation();
            this.downloadFileClickHandler(file, 'file-download-' + id);
            this.tableSignedFilesTable.tabulatorTable.updateData([{
                index: id,
                fileName: `<span id="file-download-${id}">${file.name}</span>
                    <dbp-icon name="download-complete"
                        style="font-size: 24px;margin-bottom:8px;margin-left:24px;"
                        title="${i18n.t('download-file-completed')}"
                        aria-label="${i18n.t('download-file-completed')}">`
                }]
            );
        });
        controlDiv.appendChild(btnDownload);

        return controlDiv;
    }

    getFailedButtonsHtml(id, data) {
        const i18n = this._i18n;
        let controlDiv = document.createElement('div');
        controlDiv.classList.add('tabulator-failed-buttons');
        // Re upload button
        const btnReupload = document.createElement('dbp-icon-button');
        btnReupload.setAttribute('icon-name', 'reload');
        btnReupload.classList.add('re-upload-button');
        btnReupload.setAttribute('aria-label', i18n.t('re-upload-file-button-title'));
        btnReupload.setAttribute('title', i18n.t('re-upload-file-button-title'));
        btnReupload.addEventListener("click", async (event) => {
            event.stopPropagation();
            this.fileQueueingClickHandler(data.file, id);
        });
        controlDiv.appendChild(btnReupload);

        // Delete button
        const btnDelete = document.createElement('dbp-icon-button');
        btnDelete.setAttribute('icon-name', 'trash');
        btnDelete.classList.add('delete-button');
        btnDelete.setAttribute('aria-label', i18n.t('remove-failed-file-button-title'));
        btnDelete.setAttribute('title', i18n.t('remove-failed-file-button-title'));
        btnDelete.addEventListener("click", async (event) => {
            event.stopPropagation();
            this.takeFailedFileFromQueue(id);
        });
        controlDiv.appendChild(btnDelete);

        return controlDiv;
    }

    /**
     * Create tabulator table for queued files
     *
     */
    setQueuedFilesTabulatorTable() {
        const i18n = this._i18n;
        let langs  = {
            'en': {
                columns: {
                    'fileName': i18n.t('table-header-file-name', {lng: 'en'}),
                    'fileSize': i18n.t('table-header-file-size', {lng: 'en'}),
                    'positioning': i18n.t('table-header-positioning', {lng: 'en'}),
                    'annotation': i18n.t('table-header-annotation', {lng: 'en'}),
                    'buttons': i18n.t('table-header-buttons', {lng: 'en'}),
                },
            },
            'de': {
                columns: {
                    'fileName': i18n.t('table-header-file-name', {lng: 'de'}),
                    'fileSize': i18n.t('table-header-file-size', {lng: 'de'}),
                    'positioning': i18n.t('table-header-positioning', {lng: 'de'}),
                    'annotation': i18n.t('table-header-annotation', {lng: 'de'}),
                    'buttons': i18n.t('table-header-buttons', {lng: 'de'}),
                },
            },
        };

        const queuedFilesOptions = {
            local: 'en',
            langs: langs,
            layout: 'fitColumns',
            responsiveLayout: 'collapse',
            responsiveLayoutCollapseStartOpen: false,
            index: 'index',
            columns: [
                {
                    title: '#',
                    field: 'index',
                    hozAlign: 'center',
                    headerHozAlign:"center",
                    width: 40,
                    visible: false
                },
                {
                    title: '',
                    field: 'toggle',
                    hozAlign: 'center',
                    width: 65,
                    formatter:"responsiveCollapse",
                    headerHozAlign:"center",
                    headerSort:false,
                    responsive: 0
                },
                {
                    title: 'fileName',
                    field: 'fileName',
                    sorter:"string",
                    minWidth: 320,
                    widthGrow: 3,
                    hozAlign: 'left',
                    formatter: 'html',
                    responsive: 0
                },
                {
                    title: 'fileSize',
                    field: 'fileSize',
                    sorter:"string",
                    width: 100,
                    hozAlign: 'right',
                    headerHozAlign: 'right',
                    formatter: 'plaintext',
                    responsive: 2
                },
                // {
                //     title: 'profile',
                //     field: 'profile',
                //     sorter: false,
                //     width: 120,
                //     hozAlign: 'center',
                //     headerHozAlign: 'center',
                //     formatter: 'html',
                //     // visible: false
                //     responsive: 2
                // },
                {
                    title: 'positioning',
                    field: 'positioning',
                    width: 100,
                    hozAlign: 'center',
                    headerHozAlign: 'center',
                    formatter: 'html',
                    responsive: 2
                },
                {
                    title: 'annotation',
                    field: 'annotation',
                    sorter: false,
                    width: 60,
                    hozAlign: 'center',
                    headerHozAlign: 'center',
                    formatter: 'html',
                    responsive: 2
                },
                {
                    title: 'buttons',
                    field: 'buttons',
                    sorter: false,
                    width: 165,
                    hozAlign: 'right',
                    headerHozAlign: 'center',
                    formatter: 'html',
                    responsive: 0
                },
            ],
            columnDefaults: {
                vertAlign: 'middle',
                resizable: false,
            },
        };

        let tableFiles = [];

        const ids = Object.keys(this.queuedFiles);
        if(this.tableQueuedFilesTable) {
            ids.forEach((id) => {
                const file = this.queuedFiles[id].file;
                const isManual = this.queuedFilesPlacementModes[id] === 'manual';
                const placementMissing = this.queuedFilesNeedsPlacement.get(id) && !isManual;
                const warning = placementMissing
                    ? `<dbp-icon name="warning-high"
                        title="${i18n.t('label-manual-positioning-missing')}"
                        aria-label="${i18n.t('label-manual-positioning-missing')}"
                        style="font-size:24px;color:red;margin-bottom:4px;margin-left:10px;"></dbp-icon>`
                    : '';
                const annotationCount = Array.isArray(this.queuedFilesAnnotations[id])
                    ? this.queuedFilesAnnotations[id].length
                    : 0;
                const annotationIcon = (annotationCount > 0)
                    ? `<span style="border:solid 1px var(--dbp-content);border-radius: 100%;width:24px;height:24px;display:block;text-align:center;"
                        title="${i18n.t('annotations-count-text', {annotationCount: annotationCount})}"
                        aria-label="${i18n.t('annotations-count-text', {annotationCount: annotationCount})}"
                        >${annotationCount}</span>`
                    : '';
                let fileData = {
                    index: id,
                    fileName: `${file.name} ${warning}`,
                    fileSize: humanFileSize(file.size),
                    // profile: 'Personal',
                    positioning: isManual ? 'manual' : 'auto',
                    annotation: annotationIcon,
                    buttons: this.getActionButtonsHtml(id),
                };

                tableFiles.push(fileData);
            });

            queuedFilesOptions.data = tableFiles;
            this.queuedFilesOptions = queuedFilesOptions;
            this.tableQueuedFilesTable.setData(tableFiles);
            // Set selected rows
            if (this.selectedFiles.length > 0) {
                let selectedRows = [];
                for (const fileObj of Object.values(this.selectedFiles)) {
                    selectedRows.push(fileObj.key);
                }
                this.tableQueuedFilesTable.tabulatorTable.selectRow(selectedRows);
            }
        }
    }

    /**
     * Create tabulator table for signed files
     */
    setSignedFilesTabulatorTable() {
        const i18n = this._i18n;
        let langs  = {
            'en': {
                columns: {
                    'fileName': i18n.t('table-header-file-name', {lng: 'en'}),
                    'fileSize': i18n.t('table-header-file-size', {lng: 'en'}),
                    'downloadButton': i18n.t('table-header-download', {lng: 'en'}),
                },
            },
            'de': {
                columns: {
                    'fileName': i18n.t('table-header-file-name', {lng: 'de'}),
                    'fileSize': i18n.t('table-header-file-size', {lng: 'de'}),
                    'downloadButton': i18n.t('table-header-download', {lng: 'de'}),
                },
            },
        };

        const signedFilesOptions = {
            local: 'en',
            langs: langs,
            layout: 'fitColumns',
            responsiveLayout: 'collapse',
            responsiveLayoutCollapseStartOpen: false,
            index: 'index',
            columns: [
                {
                    title: 'id',
                    field: 'index',
                    hozAlign: 'center',
                    headerHozAlign: 'center',
                    width: 40,
                    visible: false
                },
                {
                    title: '',
                    field: 'toggle',
                    hozAlign: 'center',
                    width: 65,
                    formatter: 'responsiveCollapse',
                    headerHozAlign: 'center',
                    headerSort: false,
                    responsive: 0
                },
                {
                    title: 'fileName',
                    field: 'fileName',
                    sorter: 'html',
                    minWidth: 200,
                    widthGrow: 3,
                    widthShrink: 1,
                    hozAlign: 'left',
                    formatter: 'html',
                    responsive: 0
                },
                {
                    title: 'fileSize',
                    field: 'fileSize',
                    sorter: 'string',
                    width: 100,
                    hozAlign: 'right',
                    headerHozAlign: 'right',
                    formatter: 'plaintext',
                    responsive: 1
                },
                {
                    title: 'download',
                    field: 'downloadButton',
                    sorter: false,
                    minWidth: 60,
                    hozAlign: 'center',
                    headerHozAlign: 'center',
                    formatter: 'html',
                    responsive: 0
                },
            ],
            columnDefaults: {
                vertAlign: 'middle',
                resizable: false,
            },
        };

        let tableFiles = [];

        const ids = Object.keys(this.signedFiles);
        if(this.tableSignedFilesTable) {
            ids.forEach((id) => {
                const file = this.signedFiles[id];
                let fileData = {
                    index: id,
                    fileName: `<span id="file-download-${id}">${file.name}</span>`,
                    fileSize: humanFileSize(file.contentSize),
                    downloadButton: this.getDownloadButtonHtml(id, file),
                };
                tableFiles.push(fileData);
            });

            signedFilesOptions.data = tableFiles;
            this.signedFilesOptions = signedFilesOptions;
            this.tableSignedFilesTable.setData(tableFiles);
        }
    }


    /**
     * Create tabulator table for failed files
     */
    setFailedFilesTabulatorTable() {
        const i18n = this._i18n;
        let langs  = {
            'en': {
                columns: {
                    'fileName': i18n.t('table-header-file-name', {lng: 'en'}),
                    'fileSize': i18n.t('table-header-file-size', {lng: 'en'}),
                    'buttons': i18n.t('table-header-buttons', {lng: 'en'}),
                },
            },
            'de': {
                columns: {
                    'fileName': i18n.t('table-header-file-name', {lng: 'de'}),
                    'fileSize': i18n.t('table-header-file-size', {lng: 'de'}),
                    'buttons': i18n.t('table-header-buttons', {lng: 'de'}),
                },
            },
        };

        const failedFilesOptions = {
            local: 'en',
            langs: langs,
            layout: 'fitColumns',
            responsiveLayout: 'collapse',
            responsiveLayoutCollapseStartOpen: false,
            index: 'index',
            columns: [
                {
                    title: 'id',
                    field: 'index',
                    hozAlign: 'center',
                    headerHozAlign:"center",
                    width: 40,
                    visible: false
                },
                {
                    title: '',
                    field: 'toggle',
                    hozAlign: 'center',
                    width: 65,
                    formatter:"responsiveCollapse",
                    headerHozAlign:"center",
                    headerSort:false,
                    responsive: 0
                },
                {
                    title: 'fileName',
                    field: 'fileName',
                    sorter:"string",
                    minWidth: 100,
                    widthGrow: 3,
                    widthShrink: 1,
                    hozAlign: 'left',
                    formatter: 'html',
                    responsive: 0
                },
                {
                    title: 'fileSize',
                    field: 'fileSize',
                    sorter:"string",
                    width: 100,
                    hozAlign: 'right',
                    headerHozAlign: 'right',
                    formatter: 'plaintext',
                    responsive: 1
                },
                {
                    title: 'Error Message',
                    field: 'errorMessage',
                    sorter:"string",
                    minWidth: 100,
                    widthGrow: 2,
                    hozAlign: 'left',
                    headerHozAlign: 'left',
                    formatter: 'plaintext',
                    responsive: 1
                },
                {
                    title: 'buttons',
                    field: 'buttons',
                    sorter: false,
                    minWidth: 90,
                    hozAlign: 'center',
                    headerHozAlign: 'center',
                    formatter: 'html',
                    responsive: 0
                },
            ],
            columnDefaults: {
                vertAlign: 'middle',
                resizable: false,
            },
        };

        let tableFiles = [];

        const ids = Object.keys(this.errorFiles);
        if(this.tableFailedFilesTable) {
            ids.forEach((id) => {
                const data = this.errorFiles[id];
                const errorMessage = data.json['hydra:description'];
                if (data.file === undefined) {
                    return;
                }
                let fileData = {
                    index: id,
                    fileName: `<span id="file-download-${id}" style="font-weight: bold;">${data.file.name}</span>`,
                    fileSize: humanFileSize(data.file.size),
                    errorMessage: errorMessage,
                    buttons: this.getFailedButtonsHtml(id, data),
                };
                tableFiles.push(fileData);
            });

            failedFilesOptions.data = tableFiles;
            this.failedFilesOptions = failedFilesOptions;
            this.tableFailedFilesTable.setData(tableFiles);
        }
    }
}
