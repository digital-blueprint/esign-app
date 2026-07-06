import {createInstance} from './i18n.js';
import * as utils from './utils';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {BaseLitElement} from './base-element.js';
import {getPDFSignatureCount} from './utils';
import {send} from '@dbp-toolkit/common/notification';
import {humanFileSize} from '@dbp-toolkit/common/i18next';
import {LangMixin} from '@dbp-toolkit/common';

export class SignatureEntry {
    constructor(
        key,
        file,
        placementMode = 'auto',
        needsPlacement = false,
        annotations = [],
        signaturePlacement = undefined,
    ) {
        this.key = key;
        this.file = file;
        this.placementMode = placementMode;
        this.needsPlacement = needsPlacement;
        this.annotations = annotations;
        this.signaturePlacement = signaturePlacement;
    }
}

export class SignedEntry {
    constructor(key, signedFile) {
        this.key = key;
        this.file = signedFile;
    }
}

export class ErrorEntry {
    constructor(sigEntry, errorMessage) {
        this.key = sigEntry.key;
        this.sigEntry = sigEntry;
        this.errorMessage = errorMessage;
    }
}

export default class DBPSignatureLitElement extends LangMixin(BaseLitElement, createInstance) {
    constructor() {
        super();
        this.queuedFiles = new Map();
        this.uploadInProgress = false;
        this._queueKey = 0;

        this.tableQueuedFilesTable = null;
        this.tableSignedFilesTable = null;
        this.tableFailedFilesTable = null;
        this.queuedFilesTableExpanded = false;
        this.queuedFilesTableAllSelected = false;
        this.queuedFilesTableCollapsible = false;
        this.signedFilesTableExpanded = false;
        this.signedFilesTableAllSelected = false;
        this.signedFilesTableCollapsible = false;
        this.failedFilesTableExpanded = false;
        this.failedFilesTableAllSelected = false;
        this.failedFilesTableCollapsible = false;
        this.previewEntry = null;
        this.annotationEntry = null;
        this.uploadStatusText = '';
        this.signingProcessActive = false;
        this.signaturePlacementInProgress = false;
        this.signedFilesToDownload = 0;
        this.withSigBlock = false;
        this.currentPreviewQueueKey = '';
        this.allowAnnotating = false;
        this.allowManualPositioning = true;
        this.isAnnotationViewVisible = false;
        // will be set in function update
        this.fileSource = '';
        this.nextcloudDefaultDir = '';
        this.signedFiles = new Map();
        this.signedFilesCountToReport = 0;
        this.errorFiles = new Map();
        this.errorFilesCountToReport = 0;
        this.selectedQueuedFiles = [];
        this.selectedSignedFiles = [];
        this.selectedFailedFiles = [];
        this.selectedFilesProcessing = false;
        this.anyPlacementMissing = false;
        this.selectedProfile = '';

        this.availableProfiles = {};
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
            signedFiles: {type: Object, attribute: false},
            signedFilesCountToReport: {type: Number, attribute: false},
            signedFilesToDownload: {type: Number, attribute: false},
            queuedFiles: {type: Object, attribute: false},
            errorFiles: {type: Object, attribute: false},
            errorFilesCountToReport: {type: Number, attribute: false},
            uploadInProgress: {type: Boolean, attribute: false},
            uploadStatusText: {type: String, attribute: false},
            signingProcessActive: {type: Boolean, attribute: false},
            previewEntry: {type: Object, attribute: false},
            annotationEntry: {type: Object, attribute: false},
            signaturePlacementInProgress: {type: Boolean, attribute: false},
            withSigBlock: {type: Boolean, attribute: false},
            isSignaturePlacement: {type: Boolean, attribute: false},
            allowAnnotating: {type: Boolean, attribute: 'allow-annotating'},
            isAnnotationViewVisible: {type: Boolean, attribute: false},
            fileHandlingEnabledTargets: {type: String, attribute: 'file-handling-enabled-targets'},
            queuedFilesTableExpanded: {type: Boolean, attribute: false},
            queuedFilesTableAllSelected: {type: Boolean, attribute: false},
            queuedFilesTableCollapsible: {type: Boolean, attribute: false},
            signedFilesTableExpanded: {type: Boolean, attribute: false},
            signedFilesTableAllSelected: {type: Boolean, attribute: false},
            signedFilesTableCollapsible: {type: Boolean, attribute: false},
            failedFilesTableExpanded: {type: Boolean, attribute: false},
            failedFilesTableAllSelected: {type: Boolean, attribute: false},
            failedFilesTableCollapsible: {type: Boolean, attribute: false},
            selectedQueuedFiles: {type: Array, attribute: false},
            selectedSignedFiles: {type: Array, attribute: false},
            selectedFailedFiles: {type: Array, attribute: false},
            anyPlacementMissing: {type: Boolean, state: true},
            selectedProfile: {type: String, attribute: 'selected-profile'},
        };
    }

    _isExpandHidden(expanded, collapsible, size) {
        return expanded || collapsible === false || size === 0;
    }

    _isCollapseHidden(expanded, collapsible, size) {
        return !expanded || collapsible === false || size === 0;
    }

    update(changedProperties) {
        super.update(changedProperties);
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'selectedProfile':
                    if (
                        this.getInvisibilityOfSelectedProfile() ||
                        !this.getAllowAnnotationsOfSelectedProfile()
                    ) {
                        this.queuedFiles.forEach((value) => {
                            delete value.annotations;
                        });
                    }
                    break;
            }
        });
    }

    fetchProfiles(type) {
        fetch(this.entryPointUrl + '/esign/profiles?type=' + encodeURIComponent(type), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.auth.token}`,
            },
        })
            .then((response) => response.json())
            .then((data) => {
                data['hydra:member'].forEach((entry) => {
                    this.availableProfiles[entry.identifier] = {
                        allowAnnotations: entry.allowAnnotations,
                        allowManualPositioning: entry.allowManualPositioning,
                        displayNameEn: entry.displayNameEn,
                        displayNameDe: entry.displayNameDe,
                        language: entry.language,
                        invisible: entry.invisible,
                    };
                });
                this.requestUpdate();
            });
    }

    getProfileDisplayNameInLanguage(profile) {
        return this.lang === 'en'
            ? this.availableProfiles[profile].displayNameEn
            : this.availableProfiles[profile].displayNameDe;
    }

    getProfileOptions() {
        let profileOptions = [];
        for (const key in this.availableProfiles) {
            profileOptions.push({
                value: key,
                label: this.getProfileDisplayNameInLanguage(key),
            });
        }
        return profileOptions;
    }

    profileSelection(e) {
        e.target.label = this.getProfileOptions().find(
            (option) => option.value === e.target.value,
        ).label;
        this.selectedProfile = e.target.value;
        this.requestUpdate();
    }

    getLanguageOfSelectedProfile() {
        return this.selectedProfile ? this.availableProfiles[this.selectedProfile].language : '';
    }

    getInvisibilityOfSelectedProfile() {
        return this.selectedProfile
            ? this.availableProfiles[this.selectedProfile].invisible
            : false;
    }

    getAllowAnnotationsOfSelectedProfile() {
        return this.selectedProfile
            ? this.availableProfiles[this.selectedProfile].allowAnnotations
            : false;
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'selectedProfile':
                    if (this.selectedProfile !== '') {
                        this.allowAnnotating = this.getAllowAnnotations();
                        this.allowManualPositioning = this.getAllowManualPositioning();

                        if (this.tableQueuedFilesTable.tabulatorTable) {
                            this.tableQueuedFilesTable.tabulatorTable.destroy();
                            this.setQueuedFilesTabulatorTable();
                            this.tableQueuedFilesTable.buildTable();
                        }
                    }
                    break;
            }
        });
    }

    getAllowAnnotations() {
        return this.availableProfiles[this.selectedProfile].allowAnnotations;
    }

    getAllowManualPositioning() {
        return this.availableProfiles[this.selectedProfile].allowManualPositioning;
    }

    /**
     * @param file
     * @returns {Promise<string>} key of the queued item
     */
    async queueFile(file) {
        this._queueKey++;
        const key = String(this._queueKey);
        const queuedFiles = new Map(this.queuedFiles);
        queuedFiles.set(key, new SignatureEntry(key, file));
        this.queuedFiles = queuedFiles;
        await this._updateNeedsPlacementStatus(key);
        return key;
    }

    /**
     * @param {SignatureEntry} entry
     * @returns {Promise<string>} key of the re-queued item
     */
    async reQueueFile(entry) {
        const key = entry.key;
        const queuedFiles = new Map(this.queuedFiles);
        queuedFiles.set(key, entry);
        this.queuedFiles = queuedFiles;

        return key;
    }

    /**
     * Takes a file off of the queue
     *
     * @param key
     * @returns {SignatureEntry} entry
     */
    takeFileFromQueue(key) {
        const entry = this.queuedFiles.get(key);

        const queuedFiles = new Map(this.queuedFiles);
        queuedFiles.delete(key);
        this.queuedFiles = queuedFiles;

        return entry;
    }

    /**
     * @param {string} key
     */
    async showAnnotationView(key) {
        if (this.signingProcessActive) {
            return;
        }

        const entry = this.queuedFiles.get(key);
        if (!entry) {
            return;
        }

        this.annotationEntry = entry;

        const viewTag = 'dbp-pdf-annotation-view';
        this._(viewTag).setAttribute('key', key);
        this._(viewTag).setAnnotationRows(entry.annotations);

        this.isAnnotationViewVisible = true;
    }

    /**
     * @param {CustomEvent} event
     */
    processAnnotationEvent(event) {
        const annotationDetails = event.detail;
        const entry = this.annotationEntry;

        if (entry) {
            entry.annotations = annotationDetails.annotationRows.map((row) => ({...row}));
        }

        this.hideAnnotationView();
    }

    /**
     *
     * @param {CustomEvent} event
     */
    processAnnotationCancelEvent(event) {
        this.hideAnnotationView();
    }

    /**
     * Hides the PdfAnnotationView
     */
    hideAnnotationView() {
        this.isAnnotationViewVisible = false;
        this.annotationEntry = null;
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
            console.error(this.getLanguageOfSelectedProfile());
            console.error(annotationTypeData);
            pdfFactory = await utils.addKeyValuePdfAnnotationsToAnnotationFactory(
                pdfFactory,
                this.auth['user-full-name'],
                annotationType,
                annotationTypeData.name[this.getLanguageOfSelectedProfile()],
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
        const entry = this.queuedFiles.get(key);
        if (entry?.annotations && entry.annotations[id]) {
            delete entry.annotations[id];
        }
    }

    /**
     * Takes the annotations of a file off of the queue
     *
     * @param key
     */
    getAnnotations(key) {
        const entry = this.queuedFiles.get(key);
        return entry?.annotations ?? [];
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
        const entry = this.queuedFiles.get(key);
        if (entry?.annotations && entry.annotations[id]) {
            entry.annotations[id][annotationKey] = value;
        }
    }

    /**
     * Remove selected files from the file queue
     * @param {Array} filesToRemove - array of index to remove
     */
    clearQueuedFiles(filesToRemove) {
        if (!Array.isArray(filesToRemove) || filesToRemove.length < 1) return;

        const queuedFiles = new Map(this.queuedFiles);
        for (const fileKey of filesToRemove) {
            // Remove files of selected rows from queueFiles
            queuedFiles.delete(fileKey);
        }
        this.queuedFiles = queuedFiles;

        this.selectedQueuedFiles = [];

        this.tableQueuedFilesTable.tabulatorTable.redraw(true);
    }

    getUserTextForAnnotations(annotations) {
        let userText = [];
        for (let annotation of annotations) {
            const annotationTypeData = utils.getAnnotationTypes(annotation['annotationType']);

            userText.push({
                description: `${annotationTypeData.name[this.getLanguageOfSelectedProfile()] || ''}`,
                value: annotation['value'],
            });
        }
        return userText;
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
     * @param {string} key
     * @param {File} file
     */
    addSignedFile(key, file) {
        const signedFiles = new Map(this.signedFiles);
        signedFiles.set(key, new SignedEntry(key, file));
        this.signedFiles = signedFiles;
    }

    /**
     * Open Filesink for multiple files
     */
    async zipDownloadClickHandler() {
        const files =
            this.selectedSignedFiles.length > 0
                ? Array.from(this.signedFiles.values()).filter((signedEntry) =>
                      this.selectedSignedFiles.some((sel) => sel.key === signedEntry.key),
                  )
                : Array.from(this.signedFiles.values()); // Otherwise use all signed files

        this._('#file-sink').files = files.map((entry) => entry.file);
        this.signedFilesToDownload = files.length;

        // Mark all downloaded files in the table as downloaded
        for (let row of this.tableSignedFilesTable.getData()) {
            if (row['index'] && files.some((file) => file.key === row['index'])) {
                row['fileName'].isDownloaded = true;
            }
        }

        this._('#zip-download-button').stop();
    }

    /**
     * Open Filesink for a single File
     *
     * @param file
     */
    async downloadFileClickHandler(file) {
        const files = [file];
        this.signedFilesToDownload = files.length;
        this._('#file-sink').files = [...files];
    }

    async _updateNeedsPlacementStatus(id) {
        let entry = this.queuedFiles.get(id);
        if (!entry) {
            return;
        }

        let sigCount = await getPDFSignatureCount(entry.file);
        entry.needsPlacement = sigCount > 0;
    }

    storePDFData(event) {
        let placement = event.detail;
        let placementMode = placement.signaturePlacementMode;
        const signaturePlacement = {...placement};
        delete signaturePlacement.signaturePlacementMode;

        let key = this.currentPreviewQueueKey;
        const entry = this.queuedFiles.get(key);
        if (entry) {
            entry.placementMode = placementMode;
            entry.signaturePlacement = placementMode === 'manual' ? signaturePlacement : undefined;
        }
        this.signaturePlacementInProgress = false;
    }

    /**
     * Called when preview is "canceled"
     *
     * @param event
     */
    hidePDF(event) {
        const entry = this.queuedFiles.get(this.currentPreviewQueueKey);
        if (entry) {
            // If canceled when try to set to manual mode remove placement settings (auto is the default)
            if (entry.placementMode === 'manual') {
                entry.signaturePlacement = undefined;
                entry.placementMode = 'auto';
            } else {
                // If canceled when try to set automatic set back to manual
                entry.placementMode = 'manual';
            }
            // Re render text switch
            this.setQueuedFilesTabulatorTable();
        }

        this.signaturePlacementInProgress = false;
        this.previewEntry = null;
    }

    queuePlacementSwitch(key, name) {
        const entry = this.queuedFiles.get(key);
        if (entry) {
            entry.placementMode = name;
        }
        this.showPreview(key, true);
        this.requestUpdate();
    }

    queuePlacement(key, name, showSignature = true) {
        const entry = this.queuedFiles.get(key);
        if (entry) {
            entry.placementMode = name;
        }
        this.signaturePlacementInProgress = true;
        this.showPreview(key, showSignature);
        this.requestUpdate();
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
    reUploadClickHandler() {
        if (this.selectedFailedFiles.length > 0) {
            // Re-queue only selected files
            const filesToRequeue = Array.from(this.errorFiles.values()).filter((errorEntry) =>
                this.selectedFailedFiles.some((sel) => sel.key === errorEntry.key),
            );
            const errorFiles = new Map(this.errorFiles);
            this.selectedFailedFiles.forEach((file) => {
                errorFiles.delete(file.key);
            });
            this.errorFiles = errorFiles;
            this.selectedFailedFiles = [];

            filesToRequeue.forEach(async (errorEntry) => {
                await this.reQueueFile(errorEntry.sigEntry);
            });
        } else {
            // Re-queue all failed files
            const errorFilesCopy = new Map(this.errorFiles);
            this.errorFiles = new Map();

            errorFilesCopy.forEach(async (errorEntry) => {
                await this.reQueueFile(errorEntry.sigEntry);
            });
        }

        this._('#re-upload-all-button').stop();
    }

    /**
     * Queues a failed pdf-file again
     *
     * @param {string} id
     */
    async fileQueueingClickHandler(id) {
        const errorEntry = this.takeFailedFileFromQueue(id);
        if (!errorEntry) {
            return null;
        }

        return this.reQueueFile(errorEntry.sigEntry);
    }

    /**
     * Shows the preview
     *
     * @param key
     * @param withSigBlock
     * @param viewOnly
     */
    async showPreview(key, withSigBlock = false, viewOnly = false) {
        if (this.signingProcessActive) {
            return;
        }

        const entry = this.queuedFiles.get(key);
        if (!entry) {
            return;
        }

        this.previewEntry = entry;
        this.currentPreviewQueueKey = key;
        this.withSigBlock = withSigBlock;
        await this._('dbp-pdf-preview').showEntry(entry, withSigBlock, viewOnly);
    }

    /**
     * Takes a failed file off of the queue
     *
     * @param key
     */
    takeFailedFileFromQueue(key) {
        const errorEntry = this.errorFiles.get(key);
        if (!errorEntry) {
            return null;
        }

        const errorFiles = new Map(this.errorFiles);
        errorFiles.delete(key);
        this.errorFiles = errorFiles;

        return errorEntry;
    }

    clearSignedFiles() {
        // Only clear the files that are selected, or all files if nothing is selected
        if (this.selectedSignedFiles.length > 0) {
            const signedFiles = new Map(this.signedFiles);
            this.selectedSignedFiles.forEach((file) => {
                signedFiles.delete(file.key);
            });
            this.signedFiles = signedFiles;
            this.selectedSignedFiles = [];
        } else {
            this.signedFiles = new Map();
        }
    }

    clearErrorFiles() {
        // Only clear the files that are selected, or all files if nothing is selected
        if (this.selectedFailedFiles.length > 0) {
            const errorFiles = new Map(this.errorFiles);
            this.selectedFailedFiles.forEach((file) => {
                errorFiles.delete(file.key);
            });
            this.errorFiles = errorFiles;
            this.selectedFailedFiles = [];
        } else {
            this.errorFiles = new Map();
        }
    }

    /**
     * @param {SignatureEntry} sigEntry
     * @param {string} errorMessage
     * @returns {ErrorEntry}
     */
    storeErrorFile(sigEntry, errorMessage) {
        const errorEntry = new ErrorEntry(sigEntry, errorMessage);
        const errorFiles = new Map(this.errorFiles);
        errorFiles.set(errorEntry.key, errorEntry);
        this.errorFiles = errorFiles;

        return errorEntry;
    }

    /**
     * Return true if the key of the file is in the selectedQueuedFiles
     * @param {string} key
     * @returns {boolean}
     */
    fileIsSelectedFile(key) {
        return this.selectedQueuedFiles.some((file) => file.key === key);
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
        this.previewEntry = null;
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
            this.hideAnnotationView();
        }
    }

    /**
     * Return the per-table selection array for the given table identifier
     * @param {string} tableId
     * @returns {Array}
     */
    _getSelectedFilesForTable(tableId) {
        switch (tableId) {
            case 'table-queued-files':
                return this.selectedQueuedFiles;
            case 'table-signed-files':
                return this.selectedSignedFiles;
            case 'table-failed-files':
                return this.selectedFailedFiles;
            default:
                return [];
        }
    }

    /**
     * Set the per-table selection array for the given table identifier
     * @param {string} tableId
     * @param {Array} files
     */
    _setSelectedFilesForTable(tableId, files) {
        switch (tableId) {
            case 'table-queued-files':
                this.selectedQueuedFiles = files;
                break;
            case 'table-signed-files':
                this.selectedSignedFiles = files;
                break;
            case 'table-failed-files':
                this.selectedFailedFiles = files;
                break;
        }
    }

    /**
     * Update selectedRows on selection changes
     * @param {object} tableEvent
     */
    handleTableSelection(tableEvent) {
        // Determine which table fired the event
        const sourceTable = tableEvent
            .composedPath()
            .find((el) => el.tagName && el.tagName.toLowerCase() === 'dbp-esign-tabulator-table');
        const tableId = sourceTable?.getAttribute('identifier') ?? '';

        const allSelectedRows = tableEvent.detail.allselected;
        const selectedRows = tableEvent.detail.selected;
        const deSelectedRows = tableEvent.detail.deselected;
        let currentSelection = this._getSelectedFilesForTable(tableId);

        // Add selected files
        if (Array.isArray(selectedRows) && selectedRows.length > 0) {
            selectedRows.forEach((selectedRow) => {
                const rowData = selectedRow.getData();
                const fileKey = String(rowData.index);
                const fileNameCell = rowData.fileName;
                const fileName = fileNameCell?.file?.name ?? '';
                const existingIndex = currentSelection.findIndex((row) => row.key === fileKey);
                if (existingIndex === -1) {
                    currentSelection = [
                        ...currentSelection,
                        {
                            key: fileKey,
                            filename: fileName,
                        },
                    ];
                }
            });
        }

        // Remove deselected files
        if (Array.isArray(deSelectedRows) && deSelectedRows.length > 0) {
            deSelectedRows.forEach((deSelectedRow) => {
                const rowData = deSelectedRow.getData();
                const fileKey = String(rowData.index);
                const deselectedIndex = currentSelection.findIndex((row) => row.key === fileKey);
                if (deselectedIndex !== -1) {
                    currentSelection = [
                        ...currentSelection.slice(0, deselectedIndex),
                        ...currentSelection.slice(deselectedIndex + 1),
                    ];
                }
            });
        }

        this._setSelectedFilesForTable(tableId, currentSelection);

        // Toggle select-all / deselect-all button state per table
        if (tableId === 'table-queued-files') {
            this.queuedFilesTableAllSelected =
                allSelectedRows.length > 0 && allSelectedRows.length === this.queuedFiles.size;
        } else if (tableId === 'table-signed-files') {
            this.signedFilesTableAllSelected =
                allSelectedRows.length > 0 && allSelectedRows.length === this.signedFiles.size;
        } else if (tableId === 'table-failed-files') {
            this.failedFilesTableAllSelected =
                allSelectedRows.length > 0 && allSelectedRows.length === this.errorFiles.size;
        }
    }

    getActionButtonsHtml(id, allowAnnotating = true) {
        const i18n = this._i18n;
        const entry = this.queuedFiles.get(id);
        const fileName = entry.file.name;
        const annotations = entry.annotations ?? [];

        let previewButton = this.tableQueuedFilesTable.createScopedElement(
            'dbp-esign-preview-button',
        );
        previewButton.setAttribute('subscribe', 'lang');
        previewButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this._('#pdf-preview').open();
            this._('#pdf-preview dbp-pdf-preview').shadowRoot.querySelector(
                '#pdf-meta',
            ).style.display = 'none';
            this.showPreview(id, false, true);
        });

        let annotationsButton = this.tableQueuedFilesTable.createScopedElement(
            'dbp-esign-annotations-button',
        );
        annotationsButton.setAttribute('subscribe', 'lang');
        annotationsButton.annotations = annotations;
        annotationsButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this._('#annotation-view').open();
            this.showAnnotationView(id);
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
        container.appendChild(previewButton);
        if (allowAnnotating) {
            container.appendChild(annotationsButton);
        }
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
                const entry = this.queuedFiles.get(id);
                if (entry) {
                    entry.placementMode = placement;
                    if (placement === 'auto') {
                        entry.signaturePlacement = undefined;
                    }
                }

                if (placement === 'manual' && !this.getInvisibilityOfSelectedProfile()) {
                    this._('#pdf-preview').open();
                    this._('#pdf-preview dbp-pdf-preview').shadowRoot.querySelector(
                        '#pdf-meta',
                    ).style.display = 'flex';
                    this._('#pdf-preview dbp-pdf-preview').showSignaturePlacementDescription =
                        false;
                    this.queuePlacement(id, placement);
                } else {
                    // Hide signature when auto placement is active
                    // this._('#pdf-preview dbp-pdf-preview').showSignaturePlacementDescription = true;
                    this.queuePlacement(id, placement, false);
                }
            }, 400);
        });

        return positioningSwitch;
    }

    getFailedButtonsHtml(id) {
        let controlDiv = document.createElement('div');
        controlDiv.classList.add('tabulator-failed-buttons');

        // Re upload button
        const btnReupload = this.tableFailedFilesTable.createScopedElement(
            'dbp-esign-reupload-button',
        );
        btnReupload.setAttribute('subscribe', 'lang');
        btnReupload.addEventListener('click', async (event) => {
            event.stopPropagation();
            this.fileQueueingClickHandler(id);
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
                    ...(this.allowManualPositioning && {
                        positioning: i18n.t('table-header-positioning', {lng: 'en'}),
                    }),
                    buttons: i18n.t('table-header-buttons', {lng: 'en'}),
                },
            },
            de: {
                columns: {
                    fileName: i18n.t('table-header-file-name', {lng: 'de'}),
                    fileSize: i18n.t('table-header-file-size', {lng: 'de'}),
                    ...(this.allowManualPositioning && {
                        positioning: i18n.t('table-header-positioning', {lng: 'de'}),
                    }),
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
                ...(this.allowManualPositioning
                    ? [
                          {
                              title: 'positioning',
                              field: 'positioning',
                              minWidth: 100,
                              hozAlign: 'center',
                              headerHozAlign: 'center',
                              headerSort: false,
                              formatter: 'html',
                              responsive: 2,
                          },
                      ]
                    : []),
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

        const ids = [...this.queuedFiles.keys()];
        if (this.tableQueuedFilesTable) {
            ids.forEach((id) => {
                const entry = this.queuedFiles.get(id);
                const file = entry.file;
                const isManual = entry.placementMode === 'manual';
                const placementMissing = entry.needsPlacement && !isManual;
                if (placementMissing) {
                    this.anyPlacementMissing = true;
                }

                const actionButtons = this.getActionButtonsHtml(id, this.allowAnnotating);

                let positioningSwitch = undefined;
                if (this.allowManualPositioning) {
                    positioningSwitch = this.getPositioningSwitch(
                        id,
                        entry.placementMode,
                        placementMissing,
                    );
                }

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
                    // profile: 'Personal',
                    positioning: positioningSwitch,
                    buttons: actionButtons,
                };

                tableFiles.push(fileData);
            });

            queuedFilesOptions.data = tableFiles;
            this.tableQueuedFilesTable.options = queuedFilesOptions;
            this.tableQueuedFilesTable.setData(tableFiles);

            // Set selected rows
            if (this.selectedQueuedFiles.length > 0) {
                let selectedRows = [];
                for (const fileObj of Object.values(this.selectedQueuedFiles)) {
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

        if (this.tableSignedFilesTable) {
            this.signedFiles.forEach((signedEntry, id) => {
                const file = signedEntry.file;

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
                    fileSize: humanFileSize(file.size),
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

        if (this.tableFailedFilesTable) {
            this.errorFiles.forEach((errorEntry, id) => {
                const file = errorEntry.sigEntry.file;

                let filenameLabel = this.tableFailedFilesTable.createScopedElement(
                    'dbp-esign-filename-label',
                );
                filenameLabel.setAttribute('subscribe', 'lang');
                filenameLabel.file = file;

                let fileData = {
                    index: id,
                    fileName: filenameLabel,
                    fileSize: humanFileSize(file.size),
                    errorMessage: errorEntry.errorMessage,
                    buttons: this.getFailedButtonsHtml(id),
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
            this.queuedFiles.size === 0 ||
            (this.selectedFilesProcessing && this.selectedQueuedFiles.length === 0)
        ) {
            this.selectedFilesProcessing = false;
            if (this.signedFilesCountToReport > 0) {
                send({
                    summary: i18n.t('report-message-title'),
                    body: i18n.t('signed-document-report-message', {
                        count: this.signedFilesCountToReport,
                    }),
                    type: 'success',
                    timeout: 5,
                });
            }
            if (this.errorFilesCountToReport > 0) {
                send({
                    summary: i18n.t('report-message-title'),
                    body: i18n.t('failed-document-report-message', {
                        count: this.errorFilesCountToReport,
                    }),
                    type: 'danger',
                    timeout: 0,
                });
            }
            this.signedFilesCountToReport = 0;
            this.errorFilesCountToReport = 0;
        }
    }
}
