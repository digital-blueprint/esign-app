import {createInstance} from './i18n.js';
import {humanFileSize} from '@dbp-toolkit/common/i18next.js';
import {css, html} from 'lit';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPSignatureLitElement from './dbp-signature-lit-element';
import {PdfPreview} from './dbp-pdf-preview';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as utils from './utils';
import {Button, Icon, IconButton, LoadingButton, MiniSpinner, combineURLs} from '@dbp-toolkit/common';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {classMap} from 'lit/directives/class-map.js';
import {FileSource} from '@dbp-toolkit/file-handling';
import {TextSwitch} from './textswitch.js';
import {FileSink} from '@dbp-toolkit/file-handling';
import {name as pkgName} from './../package.json';
import {send as notify} from '@dbp-toolkit/common/notification';
import metadata from './dbp-qualified-signature-pdf-upload.metadata.json';
import {Activity} from './activity.js';
import {PdfAnnotationView} from './dbp-pdf-annotation-view';
import {ExternalSignIFrame} from './ext-sign-iframe.js';
import * as SignatureStyles from './styles';
import {TabulatorTable} from '@dbp-toolkit/tabulator-table';

class QualifiedSignaturePdfUpload extends ScopedElementsMixin(DBPSignatureLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
        this.nextcloudWebAppPasswordURL = '';
        this.nextcloudWebDavURL = '';
        this.nextcloudName = '';
        this.nextcloudFileURL = '';
        this.nextcloudAuthInfo = '';
        this.externalAuthInProgress = false;
        this.signedFiles = [];
        this.signedFilesCount = 0;
        this.signedFilesToDownload = 0;
        this.errorFiles = [];
        this.errorFilesCount = 0;
        this.uploadStatusFileName = '';
        this.uploadStatusText = '';
        this.currentFile = {};
        this.currentFileName = '';
        this.currentFilePlacementMode = '';
        this.currentFileSignaturePlacement = {};
        this.signingProcessEnabled = false;
        this.signingProcessActive = false;
        this.signaturePlacementInProgress = false;
        this.withSigBlock = false;
        this.queuedFilesSignaturePlacements = [];
        this.queuedFilesPlacementModes = [];
        this.queuedFilesNeedsPlacement = new Map();
        this.currentPreviewQueueKey = '';
        this.allowAnnotating = false;
        this.queuedFilesAnnotations = [];
        this.queuedFilesAnnotationModes = [];
        this.queuedFilesAnnotationsCount = 0;
        this.queuedFilesAnnotationSaved = [];
        this.queuedFilesEnabledAnnotations = [];
        this.isAnnotationViewVisible = false;
        this.addAnnotationInProgress = false;
        this.activity = new Activity(metadata);
        this.fileHandlingEnabledTargets = 'local';
        this._onReceiveBeforeUnload = this.onReceiveBeforeUnload.bind(this);
        this.queuedFilesOptions = {};
        this.queuedFilesTableExpanded = false;
        this.queuedFilesTableAllSelected = false;
        this.queuedFilesTableCollapsible = false;
        this.signedFilesOptions = {};
        this.failedFilesOptions = {};
        this.selectedFiles = [];
        this.selectedFilesProcessing = false;
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-file-source': FileSource,
            'dbp-file-sink': FileSink,
            'dbp-pdf-preview': PdfPreview,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-button': Button,
            'dbp-icon-button': IconButton,
            'dbp-loading-button': LoadingButton,
            'dbp-textswitch': TextSwitch,
            'dbp-pdf-annotation-view': PdfAnnotationView,
            'external-sign-iframe': ExternalSignIFrame,
            'dbp-tabulator-table': TabulatorTable,
        };
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
            externalAuthInProgress: {type: Boolean, attribute: false},
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

    connectedCallback() {
        super.connectedCallback();
        // needs to be called in a function to get the variable scope of "this"
        setInterval(() => {
            this.handleQueuedFiles();
        }, 1000);

        // we want to be able to cancel the leaving of the page
        window.addEventListener('beforeunload', this._onReceiveBeforeUnload);
        window.addEventListener('dbp-pdf-preview-accept', this.setQueuedFilesTabulatorTable.bind(this));
        window.addEventListener('dbp-pdf-annotations-save', this.setQueuedFilesTabulatorTable.bind(this));
        window.addEventListener('dbp-tabulator-table-collapsible-event', this.tabulatorTableHandleCollapse.bind(this));
        window.addEventListener('dbp-tabulator-table-row-selection-changed-event', this.handleTableSelection.bind(this));
    }

    disconnectedCallback() {
        // remove event listeners
        window.removeEventListener('beforeunload', this._onReceiveBeforeUnload);
        window.removeEventListener('dbp-pdf-preview-accept', this.setQueuedFilesTabulatorTable);
        window.removeEventListener('dbp-pdf-annotations-save', this.setQueuedFilesTabulatorTable);
        window.removeEventListener('dbp-tabulator-table-collapsible-event', this.tabulatorTableHandleCollapse);
        window.removeEventListener('dbp-tabulator-table-row-selection-changed-event', this.handleTableSelection);
        super.disconnectedCallback();
    }

    firstUpdated(changedProperties) {
        super.firstUpdated(changedProperties);
        this.tableQueuedFilesTable =  /** @type {TabulatorTable} */ (this._('#table-queued-files'));
        this.tableSignedFilesTable =  /** @type {TabulatorTable} */ (this._('#table-signed-files'));
        this.tableFailedFilesTable =  /** @type {TabulatorTable} */ (this._('#table-failed-files'));
      }

    async queueFile(file) {
        let id = await super.queueFile(file);
        await this._updateNeedsPlacementStatus(id);
        this.setQueuedFilesTabulatorTable();
        this.requestUpdate();
        return id;
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

    /**
     * Processes queued files
     */
    async handleQueuedFiles() {
        const i18n = this._i18n;
        this.endSigningProcessIfQueueEmpty();
        if (this.queuedFilesCount === 0) {
            // reset signingProcessEnabled button
            this.signingProcessEnabled = false;
            return;
        }

        if (
            !this.signingProcessEnabled ||
            this.externalAuthInProgress ||
            this.uploadInProgress ||
            this.addAnnotationInProgress
        ) {
            return;
        }
        this.signaturePlacementInProgress = false;

        // Validate that all PDFs with a signature have manual placement
        let errorInPositioning = false;
        for (const key of Object.keys(this.queuedFiles)) {
            const isManual = this.queuedFilesPlacementModes[key] === 'manual';
            if (this.queuedFilesNeedsPlacement.get(key) && !isManual && (this.selectedFiles.length === 0 || this.fileIsSelectedFile(key))) {
                const file = this.queuedFiles[key].file;
                const fileName = file.name;
                // Some have a signature but are not "manual", stop everything
                notify({
                    summary: i18n.t('error-manual-positioning-missing-title'),
                    body: i18n.t('error-manual-positioning-missing', { file: fileName}),
                    type: 'danger',
                });
                errorInPositioning = true;
            }
        }
        if (errorInPositioning) {
            this.signingProcessEnabled = false;
            this.signingProcessActive = false;
            await this.stopSigningProcess();
            return;
        }

        let key = null;
        if (this.selectedFiles.length > 0) {
            // If we have selected files in the table use the selected file
            const selectedFile = this.selectedFiles.shift();
            key = Object.keys(this.queuedFiles).find(
                (index) => {
                    return this.queuedFiles[index].file.name.trim() === selectedFile.filename.trim();
                }
            );
            this.selectedFilesProcessing = true;
        } else {
            key = Object.keys(this.queuedFiles)[0];
        }

        // Process all queued files
        const entry = this.takeFileFromQueue(key);
        const file = entry.file;
        this.currentFile = file;

        // set placement mode and parameters to restore them when canceled
        this.currentFilePlacementMode = this.queuedFilesPlacementModes[key];
        this.currentFileSignaturePlacement = this.queuedFilesSignaturePlacements[key];
        this.uploadInProgress = true;
        let params = {};

        // prepare parameters to tell PDF-AS where and how the signature should be placed
        if (this.queuedFilesPlacementModes[key] === 'manual') {
            const data = this.queuedFilesSignaturePlacements[key];
            if (data !== undefined) {
                params = utils.fabricjs2pdfasPosition(data);
            }
        }

        params['profile'] = 'default';

        this.uploadStatusText = i18n.t('qualified-pdf-upload.upload-status-file-text', {
            fileName: file.name,
            fileSize: humanFileSize(file.size, false),
        });

        const annotationsEnabled = this.isAnnotationsEnabledForKey(key);
        const annotations = this.takeAnnotationsFromQueue(key);
        await this.uploadFile(file, params, annotationsEnabled ? annotations : []);
        this.uploadInProgress = false;
        // Stop processing if no more selected file exists
        if (this.selectedFilesProcessing && this.selectedFiles.length === 0) {
            this.signingProcessEnabled = false;
            this.signingProcessActive = false;
            this.selectedFilesProcessing = false;
            await this.stopSigningProcess();
        }
    }

    fileIsSelectedFile(key){
        return this.selectedFiles.some((file) => file.key === key);
    }

    /**
     * Decides if the "beforeunload" event needs to be canceled
     *
     * @param event
     */
    onReceiveBeforeUnload(event) {
        const i18n = this._i18n;
        // we don't need to stop if there are no signed files
        if (this.signedFilesCount === 0) {
            return;
        }

        // we need to handle custom events ourselves
        if (!event.isTrusted) {
            // note that this only works with custom event since calls of "confirm" are ignored
            // in the non-custom event, see https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
            const result = confirm(i18n.t('qualified-pdf-upload.confirm-page-leave'));

            // don't stop the page leave if the user wants to leave
            if (result) {
                return;
            }
        }

        // Cancel the event as stated by the standard
        event.preventDefault();

        // Chrome requires returnValue to be set
        event.returnValue = '';
    }

    /**
     * Parse error message for user friendly output
     *
     * @param error
     */
    parseError(error) {
        const i18n = this._i18n;
        let errorParsed = error;
        // Common Error Messages fpr pdf-as: https://www.buergerkarte.at/konzept/securitylayer/spezifikation/20140114/errorcodes/errorcodes.html
        // SecurityLayer Error: [6000] Unklassifizierter Abbruch durch den Bürger.
        if (error.includes('SecurityLayer Error: [6001]')) {
            errorParsed = i18n.t('error-cancel-message');
        }
        // SecurityLayer Error: [6001] Abbruch durch den Bürger über die Benutzerschnittstelle.
        else if (error.includes('SecurityLayer Error: [6000]')) {
            errorParsed = i18n.t('error-cancel-message');
        }
        // SecurityLayer Error: [6002] Abbruch auf Grund mangelnder Rechte zur Befehlsausführung.
        else if (error.includes('SecurityLayer Error: [6002]')) {
            errorParsed = i18n.t('error-rights-message');
        }
        return errorParsed;
    }

    _onIFrameDone(event) {
        const sessionId = event.detail.id;

        // check if sessionId is valid
        if (typeof sessionId !== 'string' || sessionId.length < 15) {
            return;
        }

        console.log('Got iframe message for sessionId ' + sessionId);
        const that = this;

        // get correct file name
        const fileName = this.currentFileName === '' ? 'mydoc.pdf' : this.currentFileName;

        let apiUrlBase = combineURLs(this.entryPointUrl, '/esign/qualifiedly-signed-documents');

        const apiUrl =
            apiUrlBase +
            '/' +
            encodeURIComponent(sessionId) +
            '?fileName=' +
            encodeURIComponent(fileName);

        fetch(apiUrl, {
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + that.auth.token,
            },
        })
        .then((result) => {
            // hide iframe
            that.externalAuthInProgress = false;
            this._('#iframe').reset();
            this.endSigningProcessIfQueueEmpty();

            if (!result.ok) throw result;

            return result.json();
        })
        .then((document) => {
            // this doesn't seem to trigger an update() execution
            that.signedFiles.push(document);
            // this triggers the correct update() execution
            that.signedFilesCount++;

            this.sendSetPropertyEvent('analytics-event', {
                category: 'QualifiedlySigning',
                action: 'DocumentSigned',
                name: document.contentSize,
            });
        })
        .catch((error) => {
            let file = this.currentFile;
            // let's override the json to inject an error message
            file.json = {'hydra:description': 'Download failed!'};

            this.addToErrorFiles(file);
        });
    }

    _onIFrameError(event) {
        let error = event.detail.message;
        let file = this.currentFile;
        file.json = {'hydra:description': this.parseError(error)};
        this.addToErrorFiles(file);
        this._('#iframe').reset();
        this.externalAuthInProgress = false;
        this.endSigningProcessIfQueueEmpty();
    }

    addToErrorFiles(file) {
        this.endSigningProcessIfQueueEmpty();

        // this doesn't seem to trigger an update() execution
        this.errorFiles[Math.floor(Math.random() * 1000000)] = file;
        // this triggers the correct update() execution
        this.errorFilesCount++;

        this.sendSetPropertyEvent('analytics-event', {
            category: 'QualifiedlySigning',
            action: 'SigningFailed',
            name: file.json['hydra:description'],
        });
    }

    /**
     * @param data
     */
    onFileUploadFinished(data) {
        if (data.status !== 201) {
            this.addToErrorFiles(data);
        } else if (data.json['@type'] === 'http://schema.org/EntryPoint') {
            // after the "real" upload we immediately start with the 2FA process

            // show the iframe and lock processing
            this.externalAuthInProgress = true;

            const entryPoint = data.json;
            this.currentFileName = entryPoint.name;

            // we need the full file to upload it again in case the download of the signed file fails
            this.currentFile = data;

            // we want to load the redirect url in the iframe
            let iframe = this._('#iframe');
            iframe.setUrl(entryPoint.url);
        }
    }

    update(changedProperties) {
        console.log('changedProperties', changedProperties);
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this._i18n.changeLanguage(this.lang);
                    this.setQueuedFilesTabulatorTable();
                    break;
                case 'entryPointUrl':
                    if (this.entryPointUrl) {
                        this.fileSourceUrl = combineURLs(this.entryPointUrl, '/esign/qualified-signing-requests');
                    }
                    break;
                case 'queuedFilesCount':
                    this.setQueuedFilesTabulatorTable();
                    break;
                case 'signedFilesCount':
                    this.setSignedFilesTabulatorTable();
                    break;
                case 'errorFilesCount':
                    this.setFailedFilesTabulatorTable();
                    break;
            }
        });
        super.update(changedProperties);
    }

    clearQueuedFiles() {
        this.queuedFilesSignaturePlacements = [];
        this.queuedFilesPlacementModes = [];
        this.queuedFilesNeedsPlacement.clear();
        // Clear Tabulator Table rows
        this.tableQueuedFilesTable.setData();
        super.clearQueuedFiles();
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getButtonCSS()}
            ${commonStyles.getNotificationCSS()}
            ${SignatureStyles.getSignatureCss()}


            #external-auth #iframe {
                margin-top: 0.5em;
            }

            #external-auth .button.is-cancel {
                color: var(--dbp-danger);
            }

            #iframe {
                width: 100%;
                height: 350px;
                /* keeps the A-Trust webpage aligned left */
                max-width: 575px;
            }
        `;
    }


    tabulatorTableHandleCollapse(event) {
        if (event.detail.isCollapsible === true) {
            this.queuedFilesTableCollapsible = true;
        } else {
            this.queuedFilesTableCollapsible = false;
        }
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
                    'fileName': i18n.t('qualified-pdf-upload.table-header-file-name', {lng: 'en'}),
                    'fileSize': i18n.t('qualified-pdf-upload.table-header-file-size', {lng: 'en'}),
                    'positioning': i18n.t('qualified-pdf-upload.table-header-positioning', {lng: 'en'}),
                    'annotation': i18n.t('qualified-pdf-upload.table-header-annotation', {lng: 'en'}),
                    'buttons': i18n.t('qualified-pdf-upload.table-header-buttons', {lng: 'en'}),
                },
            },
            'de': {
                columns: {
                    'fileName': i18n.t('qualified-pdf-upload.table-header-file-name', {lng: 'de'}),
                    'fileSize': i18n.t('qualified-pdf-upload.table-header-file-size', {lng: 'de'}),
                    'positioning': i18n.t('qualified-pdf-upload.table-header-positioning', {lng: 'de'}),
                    'annotation': i18n.t('qualified-pdf-upload.table-header-annotation', {lng: 'de'}),
                    'buttons': i18n.t('qualified-pdf-upload.table-header-buttons', {lng: 'de'}),
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
                    minWidth: 100,
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
                    minWidth: 160,
                    hozAlign: 'right',
                    headerHozAlign: 'center',
                    formatter: 'html',
                    responsive: 1
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
                    ? `<span style="border:solid 1px var(--dbp-content);border-radius: 100%;width:24px;height:24px;;"
                        title="Document has ${annotationCount} annotations"
                        aria-label="Document has ${annotationCount} annotations"
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

    getActionButtonsHtml(id) {
        const i18n = this._i18n;
        let controlDiv = this.createScopedElement('div');
        controlDiv.classList.add('tabulator-icon-buttons');

        // Edit signature button
        const btnEditSignature = this.createScopedElement('dbp-icon-button');
        btnEditSignature.setAttribute('icon-name', 'pencil');
        btnEditSignature.classList.add('edit-signature-button');
        btnEditSignature.setAttribute('aria-label', i18n.t('qualified-pdf-upload.edit-signature-button-title'));
        btnEditSignature.setAttribute('title', i18n.t('qualified-pdf-upload.edit-signature-button-title'));
        btnEditSignature.setAttribute('data-placement', this.queuedFilesPlacementModes[id] || 'auto');
        btnEditSignature.addEventListener("click", async (event) => {
            event.stopPropagation();
            const editButton = /** @type {HTMLElement} */ (event.target);
            const placement  = editButton.getAttribute('data-placement');
            if (this.queuedFilesPlacementModes[id] !== "manual") {
                this.queuePlacement(id, placement, false);
            } else {
                this.queuePlacement(id, placement);
            }

        });
        controlDiv.appendChild(btnEditSignature);

        // Add annotation button
        const btnAnnotation = this.createScopedElement('dbp-icon-button');
        btnAnnotation.setAttribute('icon-name', 'bubble');
        btnAnnotation.classList.add('annotation-button');
        btnAnnotation.setAttribute('aria-label', i18n.t('qualified-pdf-upload.annotation-button-title'));
        btnAnnotation.setAttribute('title', i18n.t('qualified-pdf-upload.annotation-button-title'));
        btnAnnotation.addEventListener("click", async (event) => {
            event.stopPropagation();
            this.showAnnotationView(id, 'text-selected');
        });
        controlDiv.appendChild(btnAnnotation);

        // Show preview button
        const btnPreview = this.createScopedElement('dbp-icon-button');
        btnPreview.setAttribute('icon-name', 'keyword-research');
        btnPreview.classList.add('preview-button');
        btnPreview.setAttribute('aria-label', i18n.t('qualified-pdf-upload.preview-file-button-title'));
        btnPreview.setAttribute('title', i18n.t('qualified-pdf-upload.preview-file-button-title'));
        btnPreview.addEventListener("click", async (event) => {
            event.stopPropagation();
            this.showPreview(id);
        });
        controlDiv.appendChild(btnPreview);

        // Delete button
        const btnDelete = this.createScopedElement('dbp-icon-button');
        btnDelete.setAttribute('icon-name', 'trash');
        btnDelete.classList.add('delete-button');
        btnDelete.setAttribute('aria-label', i18n.t('qualified-pdf-upload.remove-queued-file-button-title'));
        btnDelete.setAttribute('title', i18n.t('qualified-pdf-upload.remove-queued-file-button-title'));
        btnDelete.addEventListener("click", async (event) => {
            event.stopPropagation();
            this.takeFileFromQueue(id);
        });
        controlDiv.appendChild(btnDelete);

        return controlDiv;
    }

    /**
     * Create tabulator table for signed files
     */
    setSignedFilesTabulatorTable() {
        const i18n = this._i18n;
        let langs  = {
            'en': {
                columns: {
                    'fileName': i18n.t('qualified-pdf-upload.table-header-file-name', {lng: 'en'}),
                    'fileSize': i18n.t('qualified-pdf-upload.table-header-file-size', {lng: 'en'}),
                    'downloadButton': i18n.t('qualified-pdf-upload.table-header-download', {lng: 'en'}),
                },
            },
            'de': {
                columns: {
                    'fileName': i18n.t('qualified-pdf-upload.table-header-file-name', {lng: 'de'}),
                    'fileSize': i18n.t('qualified-pdf-upload.table-header-file-size', {lng: 'de'}),
                    'downloadButton': i18n.t('qualified-pdf-upload.table-header-download', {lng: 'de'}),
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

    getDownloadButtonHtml(id, file) {
        const i18n = this._i18n;
        let controlDiv = this.createScopedElement('div');
        controlDiv.classList.add('tabulator-download-button');
        // Download button
        const btnDownload = this.createScopedElement('dbp-icon-button');
        btnDownload.setAttribute('icon-name', 'download');
        btnDownload.classList.add('download-button');
        btnDownload.setAttribute('aria-label', i18n.t('qualified-pdf-upload.download-file-button-title'));
        btnDownload.setAttribute('title', i18n.t('qualified-pdf-upload.download-file-button-title'));
        btnDownload.addEventListener("click", async (event) => {
            event.stopPropagation();
            this.downloadFileClickHandler(file, 'file-download-' + id);
            this.tableSignedFilesTable.tabulatorTable.updateData([{
                index: id,
                fileName: `<span id="file-download-${id}">${file.name}</span>
                    <dbp-icon name="download-complete"
                        style="font-size: 24px;margin-bottom:8px;margin-left:24px;"
                        title="${i18n.t('qualified-pdf-upload.download-file-completed')}"
                        aria-label="${i18n.t('qualified-pdf-upload.download-file-completed')}">`
                }]
            );
        });
        controlDiv.appendChild(btnDownload);

        return controlDiv;
    }

    /**
     * Create tabulator table for failed files
     */
    setFailedFilesTabulatorTable() {
        const i18n = this._i18n;
        let langs  = {
            'en': {
                columns: {
                    'fileName': i18n.t('qualified-pdf-upload.table-header-file-name', {lng: 'en'}),
                    'fileSize': i18n.t('qualified-pdf-upload.table-header-file-size', {lng: 'en'}),
                    'buttons': i18n.t('qualified-pdf-upload.table-header-buttons', {lng: 'en'}),
                },
            },
            'de': {
                columns: {
                    'fileName': i18n.t('qualified-pdf-upload.table-header-file-name', {lng: 'de'}),
                    'fileSize': i18n.t('qualified-pdf-upload.table-header-file-size', {lng: 'de'}),
                    'buttons': i18n.t('qualified-pdf-upload.table-header-buttons', {lng: 'de'}),
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

    getFailedButtonsHtml(id, data) {
        const i18n = this._i18n;
        let controlDiv = this.createScopedElement('div');
        controlDiv.classList.add('tabulator-failed-buttons');
        // Re upload button
        const btnReupload = this.createScopedElement('dbp-icon-button');
        btnReupload.setAttribute('icon-name', 'reload');
        btnReupload.classList.add('re-upload-button');
        btnReupload.setAttribute('aria-label', i18n.t('qualified-pdf-upload.re-upload-file-button-title'));
        btnReupload.setAttribute('title', i18n.t('qualified-pdf-upload.re-upload-file-button-title'));
        btnReupload.addEventListener("click", async (event) => {
            event.stopPropagation();
            this.fileQueueingClickHandler(data.file, id);
        });
        controlDiv.appendChild(btnReupload);

        // Delete button
        const btnDelete = this.createScopedElement('dbp-icon-button');
        btnDelete.setAttribute('icon-name', 'trash');
        btnDelete.classList.add('delete-button');
        btnDelete.setAttribute('aria-label', i18n.t('qualified-pdf-upload.remove-failed-file-button-title'));
        btnDelete.setAttribute('title', i18n.t('qualified-pdf-upload.remove-failed-file-button-title'));
        btnDelete.addEventListener("click", async (event) => {
            event.stopPropagation();
            this.takeFailedFileFromQueue(id);
        });
        controlDiv.appendChild(btnDelete);

        return controlDiv;
    }

    hasSignaturePermissions() {
        return this._hasSignaturePermissions('ROLE_SCOPE_QUALIFIED-SIGNATURE');
    }

    async stopSigningProcess() {
        if (!this.externalAuthInProgress) {
            return;
        }

        this._('#iframe').reset();
        this.signingProcessEnabled = false;
        this.externalAuthInProgress = false;
        this.signingProcessActive = false;

        if (this.currentFile.file !== undefined) {
            const key = await this.queueFile(this.currentFile.file);

            // set placement mode and parameters, so they are restore when canceled
            this.queuedFilesPlacementModes[key] = this.currentFilePlacementMode;
            this.queuedFilesSignaturePlacements[key] = this.currentFileSignaturePlacement;
        }
    }

    render() {
        const placeholderUrl = commonUtils.getAssetURL(
            pkgName,
            'qualified-signature-placeholder.png'
        );
        const i18n = this._i18n;

        return html`
            <div
                class="${classMap({
                    hidden:
                        !this.isLoggedIn() || !this.hasSignaturePermissions() || this.isLoading(),
                })}">
                <div class="field ${classMap({'is-disabled': this.isUserInterfaceDisabled()})}">
                    <h2>${this.activity.getName(this.lang)}</h2>
                    <p class="subheadline">${this.activity.getDescription(this.lang)}</p>
                    <div class="control">
                        <p>${i18n.t('qualified-pdf-upload.upload-text')}</p>
                        <button
                            @click="${() => {
                                this._('#file-source').setAttribute('dialog-open', '');
                            }}"
                            ?disabled="${this.signingProcessActive}"
                            class="button is-primary"
                            id="upload-pdf-button">
                            ${i18n.t('qualified-pdf-upload.upload-button-label')}
                        </button>
                        <dbp-file-source
                            id="file-source"
                            subscribe="nextcloud-store-session:nextcloud-store-session"
                            context="${i18n.t('qualified-pdf-upload.file-picker-context')}"
                            allowed-mime-types="application/pdf"
                            enabled-targets="${this.fileHandlingEnabledTargets}"
                            nextcloud-auth-url="${this.nextcloudWebAppPasswordURL}"
                            nextcloud-web-dav-url="${this.nextcloudWebDavURL}"
                            nextcloud-name="${this.nextcloudName}"
                            nextcloud-auth-info="${this.nextcloudAuthInfo}"
                            nextcloud-file-url="${this.nextcloudFileURL}"
                            decompress-zip
                            max-file-size="32000"
                            lang="${this.lang}"
                            ?disabled="${this.signingProcessActive}"
                            text="${i18n.t('qualified-pdf-upload.upload-area-text')}"
                            button-label="${i18n.t('qualified-pdf-upload.upload-button-label')}"
                            @dbp-file-source-file-selected="${this.onFileSelected}"
                            @dbp-file-source-switched="${this.onFileSourceSwitch}"></dbp-file-source>
                    </div>
                </div>
                <div id="grid-container">
                    <div class="left-container">
                        <div
                            class="files-block field ${classMap({
                                hidden: !this.queueBlockEnabled,
                            })}">
                            <!-- Queued files headline and queueing spinner -->
                            <h3
                                class="${classMap({
                                    'is-disabled': this.isUserInterfaceDisabled(),
                                })}">
                                ${i18n.t('qualified-pdf-upload.queued-files-label')}
                            </h3>
                            <div class="control field tabulator-actions">
                                <div class="table-actions">
                                    <dbp-loading-button id="expand-all-btn"
                                        class="${classMap({
                                            hidden: this.queuedFilesTableExpanded,
                                            'is-disabled': this.isUserInterfaceDisabled()
                                        })}"
                                        ?disabled="${this.queuedFilesCount === 0 || this.queuedFilesTableCollapsible === false || this.isUserInterfaceDisabled()}"
                                        value="${i18n.t('qualified-pdf-upload.expand-all')}"
                                        @click="${() => {
                                            this.tableQueuedFilesTable.expandAll();
                                            this.queuedFilesTableExpanded = true;
                                        }}"
                                        title="${i18n.t('qualified-pdf-upload.expand-all')}"
                                        >${i18n.t('qualified-pdf-upload.expand-all')}</dbp-loading-button>

                                    <dbp-loading-button id="collapse-all-btn"
                                        class="${classMap({
                                            hidden: !this.queuedFilesTableExpanded,
                                            'is-disabled': this.isUserInterfaceDisabled()
                                        })}"
                                        ?disabled="${this.queuedFilesCount === 0 || this.queuedFilesTableCollapsible === false || this.isUserInterfaceDisabled()}"
                                        value="${i18n.t('qualified-pdf-upload.collapse-all')}"
                                        @click="${() => {
                                            this.tableQueuedFilesTable.collapseAll();
                                            this.queuedFilesTableExpanded = false;
                                        }}"
                                        title="${i18n.t('qualified-pdf-upload.collapse-all')}"
                                        >${i18n.t('qualified-pdf-upload.collapse-all')}</dbp-loading-button>

                                    <dbp-loading-button id="select-all-btn"
                                        class="${classMap({
                                            hidden: this.queuedFilesTableAllSelected,
                                            'is-disabled': this.isUserInterfaceDisabled()
                                        })}"
                                        ?disabled="${this.queuedFilesCount === 0 || this.isUserInterfaceDisabled()}"
                                        value="${i18n.t('qualified-pdf-upload.select-all')}"
                                        @click="${() => {
                                            this.queuedFilesTableAllSelected = true;
                                            this.tableQueuedFilesTable.selectAllRows();
                                        }}"
                                        title="${i18n.t('qualified-pdf-upload.select-all')}"
                                        >${i18n.t('qualified-pdf-upload.select-all')}</dbp-loading-button>

                                    <dbp-loading-button id="deselect-all-btn"
                                        class="${classMap({
                                            hidden: !this.queuedFilesTableAllSelected,
                                            'is-disabled': this.isUserInterfaceDisabled()
                                        })}"
                                        ?disabled="${this.queuedFilesCount === 0 || this.isUserInterfaceDisabled()}"
                                        value="${i18n.t('qualified-pdf-upload.deselect-all')}"
                                        @click="${() => {
                                            this.queuedFilesTableAllSelected = false;
                                            this.tableQueuedFilesTable.deselectAllRows();
                                        }}"
                                        title="${i18n.t('qualified-pdf-upload.deselect-all')}"
                                        >${i18n.t('qualified-pdf-upload.deselect-all')}</dbp-loading-button>
                                </div>
                                <div class="sign-actions">
                                    <!-- Buttons to start/stop signing process and clear queue -->
                                    <button
                                        id="clear-queue-button"
                                        @click="${this.clearQueuedFiles}"
                                        ?disabled="${this.queuedFilesCount === 0 ||
                                        this.signingProcessActive ||
                                        this.isUserInterfaceDisabled()}"
                                        class="button ${classMap({
                                            'is-disabled': this.isUserInterfaceDisabled(),
                                        })}">
                                        ${i18n.t('qualified-pdf-upload.clear-all')}
                                    </button>
                                    <button
                                        id="start-signing-button"
                                        @click="${() => {
                                            this.signingProcessEnabled = true;
                                            this.signingProcessActive = true;
                                        }}"
                                        ?disabled="${this.queuedFilesCount === 0}"
                                        class="button is-primary ${classMap({
                                            'is-disabled': this.isUserInterfaceDisabled(),
                                        })}">
                                        ${i18n.t('qualified-pdf-upload.start-signing-process-button')}
                                    </button>
                                </div>
                            </div>
                            <!-- List of queued files -->
                            <div
                                class="control file-list ${classMap({
                                    'is-disabled': this.isUserInterfaceDisabled(),
                                })}">
                                <dbp-tabulator-table
                                    id="table-queued-files"
                                    class="table-queued-files"
                                    lang="${this.lang}"
                                    select-rows-enabled
                                    .options="${this.queuedFilesOptions}">
                                </dbp-tabulator-table>
                            </div>
                            <!-- Text "queue empty" -->
                            <div
                                class="empty-queue control ${classMap({
                                    hidden: this.queuedFilesCount !== 0,
                                    'is-disabled': this.isUserInterfaceDisabled(),
                                })}">
                                ${i18n.t('qualified-pdf-upload.queued-files-empty1')}
                                <br />
                                ${i18n.t('qualified-pdf-upload.queued-files-empty2')}
                            </div>
                        </div>
                        <!-- List of signed PDFs -->
                        <div
                            class="files-block signed-files field ${classMap({
                                hidden: this.signedFilesCount === 0,
                                'is-disabled': this.isUserInterfaceDisabled(),
                            })}">
                            <h3>${i18n.t('qualified-pdf-upload.signed-files-label')}</h3>
                            <!-- Button to download all signed PDFs -->
                            <div class="field ${classMap({hidden: this.signedFilesCount === 0})}">
                                <div class="control">
                                    <button id="clear-signed-files"
                                        class="clear-signed-files button"
                                        @click="${this.clearSignedFiles}" class="button">
                                        ${i18n.t('qualified-pdf-upload.clear-all')}
                                    </button>
                                    <dbp-button
                                        id="zip-download-button"
                                        value="${i18n.t(
                                            'qualified-pdf-upload.download-zip-button'
                                        )}"
                                        title="${i18n.t(
                                            'qualified-pdf-upload.download-zip-button-tooltip'
                                        )}"
                                        class="zip-download-button"
                                        @click="${() => {
                                            this.zipDownloadClickHandler();
                                            let id = 0;
                                            for (const file of this.signedFiles) {
                                                this.tableSignedFilesTable.tabulatorTable.updateData([
                                                    {
                                                        index: id,
                                                        fileName: `<span id="file-download-${id}">${file.name}</span>`
                                                    }
                                                ]);
                                                id++;
                                            }
                                        }}"
                                        type="is-primary"></dbp-button>
                                </div>
                            </div>
                            <dbp-tabulator-table
                                id="table-signed-files"
                                class="table-signed-files"
                                lang="${this.lang}"
                                .options="${this.signedFilesOptions}"></dbp-tabulator-table>
                        </div>
                        <!-- List of errored files -->
                        <div
                            class="files-block error-files field ${classMap({
                                hidden: this.errorFilesCount === 0,
                                'is-disabled': this.isUserInterfaceDisabled(),
                            })}">
                            <h3>${i18n.t('qualified-pdf-upload.error-files-label')}</h3>
                            <!-- Button to upload errored files again -->
                            <div class="field ${classMap({hidden: this.errorFilesCount === 0})}">
                                <div class="control">
                                    <button @click="${this.clearErrorFiles}" class="button">
                                        ${i18n.t('qualified-pdf-upload.clear-all')}
                                    </button>
                                    <dbp-button
                                        id="re-upload-all-button"
                                        ?disabled="${this.uploadInProgress}"
                                        value="${i18n.t(
                                            'qualified-pdf-upload.re-upload-all-button'
                                        )}"
                                        title="${i18n.t(
                                            'qualified-pdf-upload.re-upload-all-button-title'
                                        )}"
                                        class="is-right"
                                        @click="${this.reUploadAllClickHandler}"
                                        type="is-primary"></dbp-button>
                                </div>
                            </div>
                            <dbp-tabulator-table
                                id="table-failed-files"
                                class="table-failed-files"
                                lang="${this.lang}"
                                .options="${this.failedFilesOptions}"></dbp-tabulator-table>
                        </div>
                    </div>
                    <div class="right-container">
                        <!-- PDF preview -->
                        <div
                            id="pdf-preview"
                            class="field ${classMap({hidden: !this.signaturePlacementInProgress})}">
                            <h3>
                                ${this.withSigBlock
                                    ? i18n.t('qualified-pdf-upload.signature-placement-label')
                                    : i18n.t('qualified-pdf-upload.preview-label')}
                            </h3>
                            <div class="box-header">
                                <div class="filename">
                                    <strong>${this.currentFile.name}</strong>
                                    (${humanFileSize(
                                        this.currentFile !== undefined ? this.currentFile.size : 0
                                    )})
                                </div>
                                <button class="is-cancel" @click="${this.hidePDF}" title="${i18n.t('button-close-text')}" aria-label="${i18n.t('button-close-text')}">
                                    <dbp-icon name="close" aria-hidden="true"></dbp-icon>
                                </button>
                            </div>
                            <dbp-pdf-preview
                                lang="${this.lang}"
                                allow-signature-rotation
                                signature-placeholder-image-src="${placeholderUrl}"
                                signature-width="80"
                                signature-height="29"
                                @dbp-pdf-preview-accept="${this.storePDFData}"
                                @dbp-pdf-preview-cancel="${this.hidePDF}"></dbp-pdf-preview>
                        </div>
                        <!-- Annotation view -->
                        <div
                            id="annotation-view"
                            class="field ${classMap({
                                hidden: !this.isAnnotationViewVisible || !this.allowAnnotating,
                            })}">
                            <h2>${i18n.t('qualified-pdf-upload.annotation-view-label')}</h2>
                            <div class="box-header">
                                <div class="filename">
                                    <strong>
                                        ${this.currentFile.file !== undefined
                                            ? this.currentFile.file.name
                                            : ''}
                                    </strong>
                                    (${humanFileSize(
                                        this.currentFile.file !== undefined
                                            ? this.currentFile.file.size
                                            : 0
                                    )})
                                </div>
                                <button
                                    class="is-cancel annotation"
                                    title="${i18n.t('button-close-text')}" aria-label="${i18n.t('button-close-text')}"
                                    @click="${this.hideAnnotationView}">
                                    <dbp-icon name="close" id="close-icon" aria-hidden="true"></dbp-icon>
                                </button>
                            </div>
                            <dbp-pdf-annotation-view
                                lang="${this.lang}"
                                @dbp-pdf-annotations-save="${this.processAnnotationEvent}"
                                @dbp-pdf-annotations-cancel="${this
                                    .processAnnotationCancelEvent}"></dbp-pdf-annotation-view>
                        </div>
                        <!-- File upload progress -->
                        <div
                            id="upload-progress"
                            class="field notification is-info ${classMap({
                                hidden: !this.uploadInProgress,
                            })}">
                            <dbp-mini-spinner></dbp-mini-spinner>
                            <strong>${this.uploadStatusFileName}</strong>
                            ${this.uploadStatusText}
                        </div>
                        <!-- External auth -->
                        <div
                            id="external-auth"
                            class="files-block field ${classMap({
                                hidden: !this.externalAuthInProgress,
                            })}">
                            <h3>${i18n.t('qualified-pdf-upload.current-signing-process-label')}</h3>
                            <div class="box">
                                <div class="box-header">
                                    <div class="filename">
                                        <strong>${this.currentFileName}</strong>
                                        (${humanFileSize(
                                            this.currentFile.file !== undefined
                                                ? this.currentFile.file.size
                                                : 0
                                        )})
                                    </div>
                                    <button
                                        class="is-cancel"
                                        title="${i18n.t(
                                            'qualified-pdf-upload.stop-signing-process-button'
                                        )}"
                                        aria-label="${i18n.t(
                                            'qualified-pdf-upload.stop-signing-process-button'
                                        )}"
                                        @click="${this.stopSigningProcess}">
                                        <dbp-icon name="close" aria-hidden="true"></dbp-icon>
                                    </button>
                                </div>
                                <external-sign-iframe
                                    id="iframe"
                                    @signature-error="${this._onIFrameError}"
                                    @signature-done="${this._onIFrameDone}"></external-sign-iframe>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div
                class="notification is-warning ${classMap({
                    hidden: this.isLoggedIn() || this.isLoading(),
                })}">
                ${i18n.t('error-login-message')}
            </div>
            <div
                class="notification is-danger ${classMap({
                    hidden:
                        this.hasSignaturePermissions() || !this.isLoggedIn() || this.isLoading(),
                })}">
                ${i18n.t('error-permission-message')}
            </div>
            <div class="${classMap({hidden: !this.isLoading()})}">
                <dbp-mini-spinner></dbp-mini-spinner>
            </div>
            <dbp-file-sink
                id="file-sink"
                context="${i18n.t('qualified-pdf-upload.save-field-label', {
                    count: this.signedFilesToDownload,
                })}"
                filename="signed-documents.zip"
                subscribe="initial-file-handling-state:initial-file-handling-state,nextcloud-store-session:nextcloud-store-session"
                enabled-targets="${this.fileHandlingEnabledTargets}"
                nextcloud-auth-url="${this.nextcloudWebAppPasswordURL}"
                nextcloud-web-dav-url="${this.nextcloudWebDavURL}"
                nextcloud-name="${this.nextcloudName}"
                nextcloud-file-url="${this.nextcloudFileURL}"
                lang="${this.lang}"></dbp-file-sink>
        `;
    }
}

commonUtils.defineCustomElement('dbp-qualified-signature-pdf-upload', QualifiedSignaturePdfUpload);
