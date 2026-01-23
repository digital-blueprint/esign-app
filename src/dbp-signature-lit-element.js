import {createInstance} from './i18n.js';
import * as utils from './utils';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {BaseLitElement} from './base-element.js';
import {SignatureEntry} from './signature-entry.js';
import {getPDFSignatureCount} from './utils';
import {send} from '@dbp-toolkit/common/notification';
import {humanFileSize} from '@dbp-toolkit/common/i18next';
import {LangMixin} from '@dbp-toolkit/common';

export default class DBPSignatureLitElement extends LangMixin(BaseLitElement, createInstance) {
    constructor() {
        super();
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
        this.queuedFilesTableExpanded = false;
        this.queuedFilesTableAllSelected = false;
        this.queuedFilesTableCollapsible = false;
        this.signedFilesTableExpanded = false;
        this.signedFilesTableCollapsible = false;
        this.failedFilesTableExpanded = false;
        this.failedFilesTableCollapsible = false;
        this.currentFile = {};
        this.currentFileName = '';
        this.currentFilePlacementMode = '';
        this.currentFileSignaturePlacement = {};
        this.currentKey = '';
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
        this.signedFilesCountToReport = 0;
        this.errorFiles = [];
        this.errorFilesCount = 0;
        this.errorFilesCountToReport = 0;
        this.selectedFiles = [];
        this.selectedFilesProcessing = false;
        this.initialQueuedFilesCount = 0;
        this.anyPlacementMissing = false;
    }

    static get properties() {
        return {
            ...super.properties,
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            nextcloudWebAppPasswordURL: {type: String, attribute: 'nextcloud-web-app-password-url'},
            nextcloudWebDavURL: {type: String, attribute: 'nextcloud-webdav-url'},
            nextcloudName: {type: String, attribute: 'nextcloud-name'},
            nextcloudFileURL: {type: String, attribute: 'nextcloud-file-url'},
            nextcloudAuthInfo: {type: String, attribute: 'nextcloud-auth-info'},
            signedFiles: {type: Array, attribute: false},
            signedFilesCount: {type: Number, attribute: false},
            signedFilesCountToReport: {type: Number, attribute: false},
            signedFilesToDownload: {type: Number, attribute: false},
            queuedFilesCount: {type: Number, attribute: false},
            errorFiles: {type: Array, attribute: false},
            errorFilesCount: {type: Number, attribute: false},
            errorFilesCountToReport: {type: Number, attribute: false},
            uploadInProgress: {type: Boolean, attribute: false},
            uploadStatusFileName: {type: String, attribute: false},
            uploadStatusText: {type: String, attribute: false},
            signingProcessEnabled: {type: Boolean, attribute: false},
            signingProcessActive: {type: Boolean, attribute: false},
            queueBlockEnabled: {type: Boolean, attribute: false},
            currentFile: {type: Object, attribute: false},
            currentFileName: {type: String, attribute: false},
            currentKey: {type: String, attribute: false},
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
            signedFilesTableExpanded: {type: Boolean, attribute: false},
            signedFilesTableCollapsible: {type: Boolean, attribute: false},
            failedFilesTableExpanded: {type: Boolean, attribute: false},
            failedFilesTableCollapsible: {type: Boolean, attribute: false},
            selectedFiles: {type: Array, attribute: false},
            anyPlacementMissing: {type: Boolean, state: true},
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
     * @param file
     * @returns {Promise<string>} key of the re-queued item
     */
    async reQueueFile(file) {
        const key = this.currentKey;
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
     * @param {string} key
     * @param {string} name
     */
    async showAnnotationView(key, name) {
        this.queuedFilesAnnotationModes[key] = name;

        if (this.signingProcessEnabled) {
            return;
        }

        if (name === 'text-selected') {
            const file = this.getQueuedFile(key);
            this.currentFile = file;
            this.currentPreviewQueueKey = key;

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
     * @param {CustomEvent} event
     */
    processAnnotationEvent(event) {
        let annotationDetails = event.detail;
        let key = this.currentPreviewQueueKey;

        this.queuedFilesAnnotations[key] = annotationDetails.annotationRows;

        this.isAnnotationViewVisible = false;
        this.addAnnotationInProgress = false;

        this.queuedFilesAnnotationModes[this.currentPreviewQueueKey] = 'text-selected';
        this.queuedFilesAnnotationSaved[this.currentPreviewQueueKey] = true;

        // Refresh the table to show updated annotation count
        this.setQueuedFilesTabulatorTable();
    }

    /**
     *
     * @param {CustomEvent} event
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
                this.auth['user-full-name'],
                annotationType,
                annotationTypeData.name.de,
                annotationTypeData.name.en,
                value,
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

    /**
     * Remove selected files from the file queue
     * @param {Array} filesToRemove - array of index to remove
     */
    clearQueuedFiles(filesToRemove) {
        if (!Array.isArray(filesToRemove) || filesToRemove.length < 1) return;

        for (const fileKey of filesToRemove) {
            // Remove annotation of selected rows form queuedFilesAnnotations
            this.queuedFilesAnnotations.forEach((annotation, index) => {
                if (index == fileKey) {
                    delete this.queuedFilesAnnotations[index];
                }
            });

            // Remove files of selected rows from queueFiles
            this.queuedFiles.forEach((file, index) => {
                if (index == fileKey) {
                    delete this.queuedFiles[index];
                }
            });
        }

        this.selectedFiles = [];

        this.queuedFilesAnnotationsCount = this.getRealLength(this.queuedFilesAnnotations);
        this.updateQueuedFilesCount();

        this.tableQueuedFilesTable.tabulatorTable.redraw(true);
    }

    /**
     * Get the real length of an array containing holes (sparse array)
     * @param {Array} array
     * @returns {number}
     */
    getRealLength(array) {
        return Object.keys(array).filter((key) => !isNaN(key)).length;
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
            data.json = {'hydra:description': response.message};
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

        // Mark all files in the table as downloaded
        for (let row of this.tableSignedFilesTable.getData()) {
            row['fileName'].isDownloaded = true;
        }

        this._('#zip-download-button').stop();
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
     */
    async downloadFileClickHandler(file) {
        let files = [];
        const arr = utils.convertDataURIToBinary(file.contentUrl);
        const binaryFile = new File([arr], file.name, {
            type: utils.getDataURIContentType(file.contentUrl),
        });
        files.push(binaryFile);
        this.signedFilesToDownload = files.length;
        this._('#file-sink').files = [...files];
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
        if (this.queuedFilesSignaturePlacements[this.currentPreviewQueueKey] !== undefined) {
            // If canceled when try to set to manual mode remove placement settings (auto is the default)
            if (
                this.queuedFilesSignaturePlacements[this.currentPreviewQueueKey]
                    .signaturePlacementMode === 'manual'
            ) {
                this.queuedFilesSignaturePlacements.splice(
                    parseInt(this.currentPreviewQueueKey),
                    1,
                );
                this.queuedFilesPlacementModes[this.currentPreviewQueueKey] = 'auto';
            } else {
                // If canceled when try to set automatic set back to manual
                this.queuedFilesSignaturePlacements[this.currentPreviewQueueKey]
                    .signaturePlacementMode === 'manual';
                this.queuedFilesPlacementModes[this.currentPreviewQueueKey] = 'manual';
            }
            // Re render text switch
            this.setQueuedFilesTabulatorTable();
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
     * @param viewOnly
     */
    async showPreview(key, withSigBlock = false, viewOnly = false) {
        if (this.signingProcessEnabled) {
            return;
        }

        const entry = this.getQueuedFile(key);
        this.currentFile = entry.file;
        this.currentPreviewQueueKey = key;
        this.withSigBlock = withSigBlock;
        let placementData = this.queuedFilesSignaturePlacements[key];
        if (viewOnly) {
            placementData = {};
        }
        const annotations = this.queuedFilesAnnotations[key] || [];
        await this._('dbp-pdf-preview').showPDF(
            entry.file,
            withSigBlock, //this.queuedFilesPlacementModes[key] === "manual",
            placementData,
            annotations,
        );
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

    /**
     * Return true if the key of the file is in the selectedFiles
     * @param {string} key
     * @returns {boolean}
     */
    fileIsSelectedFile(key) {
        return this.selectedFiles.some((file) => file.key === key);
    }

    tabulatorTableHandleCollapse(event) {
        if (event.detail.tableId === 'table-queued-files') {
            this.queuedFilesTableCollapsible = event.detail.isCollapsible;
            // If the table is not collapsible display the 'Expand all' button
            if (!this.queuedFilesTableCollapsible) {
                this.queuedFilesTableExpanded = false;
            }

            // Update table data when collapsing or expanding rows otherwise action buttons will not be shown
            this.setQueuedFilesTabulatorTable();
        }

        if (event.detail.tableId === 'table-signed-files') {
            this.signedFilesTableCollapsible = event.detail.isCollapsible;
        }

        if (event.detail.tableId === 'table-failed-files') {
            this.failedFilesTableCollapsible = event.detail.isCollapsible;
            // Update table data when collapsing or expanding rows
            this.setFailedFilesTabulatorTable();
        }
    }

    /**
     *  Handle Expand/Collapse-all button state
     * @param event - dbp-tabulator-table-render-complete-event
     */
    tabulatorTableHandleRenderCompleted(event) {
        const tableId = event.detail.tableId;
        const table = this._(`#${tableId}`);
        const collapsableRows = table.shadowRoot.querySelectorAll('.tabulator-responsive-collapse');
        const collapsableRowsCount = collapsableRows.length;
        let expandedColumns = 0;
        collapsableRows.forEach((row) => {
            if (window.getComputedStyle(row).display === 'block') {
                expandedColumns++;
            }
        });
        if (event.detail.tableId === 'table-queued-files') {
            expandedColumns == collapsableRowsCount
                ? (this.queuedFilesTableExpanded = true)
                : (this.queuedFilesTableExpanded = false);
        }
        if (event.detail.tableId === 'table-signed-files') {
            expandedColumns == collapsableRowsCount
                ? (this.signedFilesTableExpanded = true)
                : (this.signedFilesTableExpanded = false);
        }
        if (event.detail.tableId === 'table-failed-files') {
            expandedColumns == collapsableRowsCount
                ? (this.failedFilesTableExpanded = true)
                : (this.failedFilesTableExpanded = false);
        }
    }

    handlePdfModalClosing() {
        this._('#pdf-preview').close();
    }

    handleAnnotationModalClosing() {
        this._('#annotation-view').close();
    }

    handleModalClosed(event) {
        if (event.detail.id === 'pdf-preview-modal') {
            if (this.signaturePlacementInProgress) {
                this.hidePDF();
            }
        }

        if (event.detail.id === 'external-auth-modal') {
            this.stopSigningProcess();
        }

        if (event.detail.id === 'annotation-view-modal') {
            this.setQueuedFilesTabulatorTable();
            const annotationModal = this._('#annotation-view');
            const pdfAnnotationView = this._('dbp-pdf-annotation-view');
            // Don't allow closing the modal if the annotation is not valid
            if (!pdfAnnotationView.validateValues(true)) {
                annotationModal.open();
                pdfAnnotationView.validateValues();
            }
        }
    }

    /**
     * Update selectedRows on selection changes
     * @param {object} tableEvent
     */
    handleTableSelection(tableEvent) {
        const allSelectedRows = tableEvent.detail.allselected;
        const selectedRows = tableEvent.detail.selected;
        const deSelectedRows = tableEvent.detail.deselected;

        // Add selected files
        if (Array.isArray(selectedRows) && selectedRows.length > 0) {
            selectedRows.forEach((selectedRow) => {
                const rowIndex = String(selectedRow.getIndex());
                const rowData = selectedRow.getData();
                const fileNameCell = rowData.fileName;
                const fileKey = rowData.index;
                const fileName = fileNameCell.file.name;
                const existingIndex = this.selectedFiles.findIndex((row) => row.key === rowIndex);
                if (existingIndex === -1) {
                    this.selectedFiles = [
                        ...this.selectedFiles,
                        {
                            key: fileKey,
                            filename: fileName,
                        },
                    ];
                }
            });
        }

        // Remove selected files
        if (Array.isArray(deSelectedRows) && deSelectedRows.length > 0) {
            deSelectedRows.forEach((deSelectedRow) => {
                const rowIndex = String(deSelectedRow.getIndex());
                const deselectedIndex = this.selectedFiles.findIndex((row) => row.key === rowIndex);
                this.selectedFiles = [
                    ...this.selectedFiles.slice(0, deselectedIndex),
                    ...this.selectedFiles.slice(deselectedIndex + 1),
                ];
            });
        }

        // If all rows are selected toggle select-all button to deselect-all
        if (allSelectedRows.length === this.queuedFilesCount) {
            this.queuedFilesTableAllSelected = true;
        }
        if (selectedRows.length === 0) {
            this.queuedFilesTableAllSelected = false;
        }
    }

    getActionButtonsHtml(id, allowAnnotating = true) {
        const i18n = this._i18n;
        const fileName = this.queuedFiles[id].file.name;
        const annotations = this.queuedFilesAnnotations[id] ?? [];
        const placementMode = this.queuedFilesPlacementModes[id] || 'auto';
        const isManual = placementMode === 'manual';
        const placementMissing = this.queuedFilesNeedsPlacement.get(id) && !isManual;

        let editButton = this.tableQueuedFilesTable.createScopedElement('dbp-esign-edit-button');
        editButton.setAttribute('subscribe', 'lang');
        editButton.annotations = annotations;
        editButton.needPositioning = placementMissing;
        editButton.addEventListener('click', (event) => {
            event.stopPropagation();

            // Set placement mode if missing
            if (placementMissing || isManual) {
                this.queuedFilesPlacementModes[id] = 'manual';
                this.queuedFilesSignaturePlacements[id] = {signaturePlacementMode: 'manual'};
            }

            this._('#pdf-preview').open();
            this._('#pdf-preview dbp-pdf-preview').removeAttribute('don-t-show-buttons');
            this._('#pdf-preview dbp-pdf-preview').showSignaturePlacementDescription = false;
            this.queuePlacement(id, this.queuedFilesPlacementModes[id], true);
        });

        let previewButton = this.tableQueuedFilesTable.createScopedElement(
            'dbp-esign-preview-button',
        );
        previewButton.setAttribute('subscribe', 'lang');
        previewButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this._('#pdf-preview').open();
            this._('#pdf-preview dbp-pdf-preview').setAttribute('don-t-show-buttons', '');
            this.showPreview(id, false, true);
        });

        let deleteButton =
            this.tableQueuedFilesTable.createScopedElement('dbp-esign-delete-button');
        deleteButton.setAttribute('subscribe', 'lang');
        deleteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            const result = confirm(i18n.t('confirm-delete-file', {file: fileName}));
            if (result) {
                this.takeFileFromQueue(id);
            }
        });

        let container = document.createElement('div');
        container.style.display = 'flex';
        container.appendChild(editButton);
        container.appendChild(previewButton);
        container.appendChild(deleteButton);

        return container;
    }

    getPositioningSwitch(id, placement, needPositioning) {
        let positioningSwitch = this.tableQueuedFilesTable.createScopedElement(
            'dbp-esign-positioning-switch',
        );
        positioningSwitch.setAttribute('subscribe', 'lang');
        positioningSwitch.checked = placement === 'manual';
        positioningSwitch.needPositioning = needPositioning;
        positioningSwitch.addEventListener('toggle-change', (event) => {
            setTimeout(() => {
                let placement = positioningSwitch.checked ? 'manual' : 'auto';
                this.queuedFilesSignaturePlacements[id] = {signaturePlacementMode: placement};
                this.queuedFilesPlacementModes[id] = placement;

                if (placement === 'manual') {
                    this._('#pdf-preview').open();
                    this._('#pdf-preview dbp-pdf-preview').removeAttribute('don-t-show-buttons');
                    this._('#pdf-preview dbp-pdf-preview').showSignaturePlacementDescription =
                        false;
                    this.queuePlacement(id, placement);
                } else {
                    // Hide signature when auto placement is active
                    // this._('#pdf-preview dbp-pdf-preview').showSignaturePlacementDescription = true;
                    this.queuePlacement(id, placement, false);
                    // Auto set signature placement without showing the preview
                    const data = {
                        signaturePlacementMode: 'auto',
                    };
                    const event = new CustomEvent('dbp-pdf-preview-accept', {
                        detail: data,
                        bubbles: true,
                        composed: true,
                    });
                    this.dispatchEvent(event);
                }
            }, 400);
        });

        return positioningSwitch;
    }

    getFailedButtonsHtml(id, data) {
        let controlDiv = document.createElement('div');
        controlDiv.classList.add('tabulator-failed-buttons');

        // Re upload button
        const btnReupload = this.tableFailedFilesTable.createScopedElement(
            'dbp-esign-reupload-button',
        );
        btnReupload.setAttribute('subscribe', 'lang');
        btnReupload.addEventListener('click', async (event) => {
            event.stopPropagation();
            this.fileQueueingClickHandler(data.file, id);
        });
        controlDiv.appendChild(btnReupload);

        // Delete button
        const btnDelete = this.tableFailedFilesTable.createScopedElement(
            'dbp-esign-remove-failed-file-button',
        );
        btnDelete.setAttribute('subscribe', 'lang');
        btnDelete.addEventListener('click', async (event) => {
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
        let langs = {
            en: {
                columns: {
                    fileName: i18n.t('table-header-file-name', {lng: 'en'}),
                    fileSize: i18n.t('table-header-file-size', {lng: 'en'}),
                    buttons: i18n.t('table-header-buttons', {lng: 'en'}),
                },
            },
            de: {
                columns: {
                    fileName: i18n.t('table-header-file-name', {lng: 'de'}),
                    fileSize: i18n.t('table-header-file-size', {lng: 'de'}),
                    buttons: i18n.t('table-header-buttons', {lng: 'de'}),
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
            rowHeight: 54,
            columns: [
                {
                    title: '#',
                    field: 'index',
                    hozAlign: 'center',
                    headerHozAlign: 'center',
                    width: 40,
                    visible: false,
                },
                {
                    title: '',
                    field: 'toggle',
                    hozAlign: 'center',
                    width: 65,
                    formatter: 'responsiveCollapse',
                    headerHozAlign: 'center',
                    headerSort: false,
                    responsive: 0,
                },
                {
                    title: 'fileName',
                    field: 'fileName',
                    sorter: 'string',
                    minWidth: 250,
                    widthGrow: 3,
                    hozAlign: 'left',
                    formatter: 'html',
                    responsive: 0,
                },
                {
                    title: 'fileSize',
                    field: 'fileSize',
                    sorter: 'string',
                    minWidth: 120,
                    hozAlign: 'right',
                    headerHozAlign: 'right',
                    formatter: 'plaintext',
                    responsive: 3,
                },
                {
                    title: 'buttons',
                    field: 'buttons',
                    sorter: false,
                    headerSort: false,
                    width: 160,
                    hozAlign: 'right',
                    headerHozAlign: 'center',
                    formatter: 'html',
                    responsive: 1,
                },
            ],
            columnDefaults: {
                vertAlign: 'middle',
                resizable: false,
            },
        };

        let tableFiles = [];
        this.anyPlacementMissing = false;

        const ids = Object.keys(this.queuedFiles);
        if (this.tableQueuedFilesTable) {
            ids.forEach((id) => {
                const file = this.queuedFiles[id].file;
                const isManual = this.queuedFilesPlacementModes[id] === 'manual';
                const placementMissing = this.queuedFilesNeedsPlacement.get(id) && !isManual;
                if (placementMissing) {
                    this.anyPlacementMissing = true;
                }

                const actionButtons = this.getActionButtonsHtml(id, this.allowAnnotating);

                let filenameLabel = this.tableQueuedFilesTable.createScopedElement(
                    'dbp-esign-filename-label',
                );
                filenameLabel.setAttribute('subscribe', 'lang');
                filenameLabel.file = file;
                filenameLabel.isPlacementMissing = placementMissing;

                let fileData = {
                    index: id,
                    fileName: filenameLabel,
                    fileSize: humanFileSize(file.size),
                    buttons: actionButtons,
                };

                tableFiles.push(fileData);
            });

            queuedFilesOptions.data = tableFiles;
            this.tableQueuedFilesTable.options = queuedFilesOptions;
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
        let langs = {
            en: {
                columns: {
                    fileName: i18n.t('table-header-file-name', {lng: 'en'}),
                    fileSize: i18n.t('table-header-file-size', {lng: 'en'}),
                    downloadButton: i18n.t('table-header-download', {lng: 'en'}),
                },
            },
            de: {
                columns: {
                    fileName: i18n.t('table-header-file-name', {lng: 'de'}),
                    fileSize: i18n.t('table-header-file-size', {lng: 'de'}),
                    downloadButton: i18n.t('table-header-download', {lng: 'de'}),
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
            rowHeight: 50,
            columns: [
                {
                    title: 'id',
                    field: 'index',
                    hozAlign: 'center',
                    headerHozAlign: 'center',
                    width: 40,
                    visible: false,
                },
                {
                    title: '',
                    field: 'toggle',
                    hozAlign: 'center',
                    width: 65,
                    formatter: 'responsiveCollapse',
                    headerHozAlign: 'center',
                    headerSort: false,
                    responsive: 0,
                },
                {
                    title: 'fileName',
                    field: 'fileName',
                    sorter: 'string',
                    minWidth: 200,
                    widthGrow: 3,
                    hozAlign: 'left',
                    formatter: 'html',
                    responsive: 0,
                },
                {
                    title: 'fileSize',
                    field: 'fileSize',
                    sorter: 'string',
                    minWidth: 120,
                    hozAlign: 'right',
                    headerHozAlign: 'right',
                    formatter: 'plaintext',
                    responsive: 2,
                },
                {
                    title: 'download',
                    field: 'downloadButton',
                    sorter: false,
                    headerSort: false,
                    width: 140,
                    hozAlign: 'center',
                    headerHozAlign: 'center',
                    formatter: 'html',
                    responsive: 1,
                },
            ],
            columnDefaults: {
                vertAlign: 'middle',
                resizable: false,
            },
        };

        let tableFiles = [];

        const ids = Object.keys(this.signedFiles);
        if (this.tableSignedFilesTable) {
            ids.forEach((id) => {
                const file = this.signedFiles[id];

                let filenameLabel = this.tableSignedFilesTable.createScopedElement(
                    'dbp-esign-filename-label',
                );
                filenameLabel.setAttribute('subscribe', 'lang');
                filenameLabel.file = file;

                let downloadButton = this.tableSignedFilesTable.createScopedElement(
                    'dbp-esign-download-button',
                );
                downloadButton.setAttribute('subscribe', 'lang');
                downloadButton.file = file;

                downloadButton.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    await this.downloadFileClickHandler(file);
                    filenameLabel.isDownloaded = true;
                });

                let fileData = {
                    index: id,
                    fileName: filenameLabel,
                    fileSize: humanFileSize(file.contentSize),
                    downloadButton: downloadButton,
                };
                tableFiles.push(fileData);
            });

            signedFilesOptions.data = tableFiles;
            this.tableSignedFilesTable.options = signedFilesOptions;
            this.tableSignedFilesTable.setData(tableFiles);
        }
    }

    /**
     * Create tabulator table for failed files
     */
    setFailedFilesTabulatorTable() {
        const i18n = this._i18n;
        let langs = {
            en: {
                columns: {
                    fileName: i18n.t('table-header-file-name', {lng: 'en'}),
                    fileSize: i18n.t('table-header-file-size', {lng: 'en'}),
                    errorMessage: i18n.t('table-header-error-message', {lng: 'en'}),
                    buttons: i18n.t('table-header-buttons', {lng: 'en'}),
                },
            },
            de: {
                columns: {
                    fileName: i18n.t('table-header-file-name', {lng: 'de'}),
                    fileSize: i18n.t('table-header-file-size', {lng: 'de'}),
                    errorMessage: i18n.t('table-header-error-message', {lng: 'de'}),
                    buttons: i18n.t('table-header-buttons', {lng: 'de'}),
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
            rowHeight: 50,
            columns: [
                {
                    title: 'id',
                    field: 'index',
                    hozAlign: 'center',
                    headerHozAlign: 'center',
                    width: 40,
                    visible: false,
                },
                {
                    title: '',
                    field: 'toggle',
                    hozAlign: 'center',
                    width: 65,
                    formatter: 'responsiveCollapse',
                    headerHozAlign: 'center',
                    headerSort: false,
                    responsive: 0,
                },
                {
                    title: 'fileName',
                    field: 'fileName',
                    sorter: 'string',
                    minWidth: 200,
                    widthGrow: 3,
                    hozAlign: 'left',
                    formatter: 'html',
                    responsive: 0,
                },
                {
                    title: 'fileSize',
                    field: 'fileSize',
                    sorter: 'string',
                    minWidth: 120,
                    hozAlign: 'right',
                    headerHozAlign: 'right',
                    formatter: 'plaintext',
                    responsive: 2,
                },
                {
                    title: 'Error Message',
                    field: 'errorMessage',
                    sorter: 'string',
                    minWidth: 300,
                    widthGrow: 2,
                    hozAlign: 'left',
                    headerHozAlign: 'left',
                    formatter: 'plaintext',
                    responsive: 1,
                },
                {
                    title: 'buttons',
                    field: 'buttons',
                    sorter: false,
                    headerSort: false,
                    width: 115,
                    hozAlign: 'center',
                    headerHozAlign: 'center',
                    formatter: 'html',
                    responsive: 1,
                },
            ],
            columnDefaults: {
                vertAlign: 'middle',
                resizable: false,
            },
        };

        let tableFiles = [];

        const ids = Object.keys(this.errorFiles);
        if (this.tableFailedFilesTable) {
            ids.forEach((id) => {
                const data = this.errorFiles[id];
                const errorMessage = data.json['hydra:description'];
                if (data.file === undefined) {
                    return;
                }

                let filenameLabel = this.tableFailedFilesTable.createScopedElement(
                    'dbp-esign-filename-label',
                );
                filenameLabel.setAttribute('subscribe', 'lang');
                filenameLabel.file = data.file;

                let fileData = {
                    index: id,
                    fileName: filenameLabel,
                    fileSize: humanFileSize(data.file.size),
                    errorMessage: errorMessage,
                    buttons: this.getFailedButtonsHtml(id, data),
                };
                tableFiles.push(fileData);
            });

            failedFilesOptions.data = tableFiles;
            this.tableFailedFilesTable.options = failedFilesOptions;
            this.tableFailedFilesTable.setData(tableFiles);
        }
    }

    /**
     * Display notification when all files are processed
     */
    sendReportNotification() {
        const i18n = this._i18n;
        if (
            this.queuedFilesCount === 0 ||
            (this.selectedFilesProcessing && this.selectedFiles.length === 0)
        ) {
            this.selectedFilesProcessing = false;
            if (this.signedFilesCountToReport > 0) {
                send({
                    summary: i18n.t('report-message-title'),
                    body: i18n.t('signed-document-report-message', {
                        count: this.signedFilesCountToReport,
                    }),
                    type: 'success',
                    timeout: 20,
                });
            }
            if (this.errorFilesCountToReport > 0) {
                send({
                    summary: i18n.t('report-message-title'),
                    body: i18n.t('failed-document-report-message', {
                        count: this.errorFilesCountToReport,
                    }),
                    type: 'danger',
                    timeout: 20,
                });
            }
            this.signedFilesCountToReport = 0;
            this.errorFilesCountToReport = 0;
        }
    }
}
