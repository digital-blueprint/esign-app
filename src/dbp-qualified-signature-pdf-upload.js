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

        window.addEventListener('dbp-pdf-preview-accept', this.updateTableData.bind(this));
        window.addEventListener('dbp-tabulator-table-collapsible-event', (tableEvent) => {
            this.tabulatorTableHandleCollapse(tableEvent);
        });
    }

    disconnectedCallback() {
        // remove event listeners
        window.removeEventListener('beforeunload', this._onReceiveBeforeUnload);
        window.removeEventListener('dbp-pdf-preview-accept', this.updateTableData);

        super.disconnectedCallback();
    }

    firstUpdated(changedProperties) {
        super.firstUpdated(changedProperties);
        this.tableQueuedFilesTable =  /** @type {TabulatorTable} */ (this._('#table-queued-files'));
      }

    async queueFile(file) {
        let id = await super.queueFile(file);
        await this._updateNeedsPlacementStatus(id);
        this.requestUpdate();
        return id;
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
        for (const key of Object.keys(this.queuedFiles)) {
            const isManual = this.queuedFilesPlacementModes[key] === 'manual';
            if (this.queuedFilesNeedsPlacement.get(key) && !isManual) {
                // Some have a signature but are not "manual", stop everything
                notify({
                    body: i18n.t('error-manual-positioning-missing'),
                    type: 'danger',
                    timeout: 5,
                });
                this.signingProcessEnabled = false;
                this.signingProcessActive = false;
                return;
            }
        }

        // take the file off the queue
        const key = Object.keys(this.queuedFiles)[0];
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
                    break;
                case 'entryPointUrl':
                    if (this.entryPointUrl) {
                        this.fileSourceUrl = combineURLs(this.entryPointUrl, '/esign/qualified-signing-requests');
                    }
                    break;
                case 'queuedFilesCount':
                    console.log(this.queuedFiles);
                    this.setQueuedFilesTabulatorTable();
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
     * Create tabulator table
     *
     */
    setQueuedFilesTabulatorTable() {
        console.log('getQueuedFilesTabulatorTable()');
        const ids = Object.keys(this.queuedFiles);
        const i18n = this._i18n;
        let queuedFiles = [];

        let langs  = {
            'en': {
                columns: {
                    'fileName': i18n.t('qualified-pdf-upload.table-header-file-name', {lng: 'en'}),
                    'fileSize': i18n.t('qualified-pdf-upload.table-header-file-size', {lng: 'en'}),
                    'profile': i18n.t('qualified-pdf-upload.table-header-profile', {lng: 'en'}),
                    'positioning': i18n.t('qualified-pdf-upload.table-header-positioning', {lng: 'en'}),
                    'warning': i18n.t('qualified-pdf-upload.table-header-warning', {lng: 'en'}),
                    'buttons': i18n.t('qualified-pdf-upload.table-header-buttons', {lng: 'en'}),
                },
            },
            'de': {
                columns: {
                    'fileName': i18n.t('qualified-pdf-upload.table-header-file-name', {lng: 'de'}),
                    'fileSize': i18n.t('qualified-pdf-upload.table-header-file-size', {lng: 'de'}),
                    'profile': i18n.t('qualified-pdf-upload.table-header-profile', {lng: 'de'}),
                    'positioning': i18n.t('qualified-pdf-upload.table-header-positioning', {lng: 'de'}),
                    'warning': i18n.t('qualified-pdf-upload.table-header-warning', {lng: 'de'}),
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
            columns: [
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
                    formatter: 'plaintext',
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
                {
                    title: 'profile',
                    field: 'profile',
                    sorter: false,
                    minWidth: 140,
                    hozAlign: 'center',
                    headerHozAlign: 'center',
                    formatter: 'html',
                    responsive: 2
                },
                {
                    title: 'positioning',
                    field: 'positioning',
                    minWidth: 120,
                    hozAlign: 'center',
                    headerHozAlign: 'center',
                    formatter: 'html',
                    responsive: 2
                },
                {
                    title: 'warning',
                    field: 'warning',
                    sorter: false,
                    minWidth: 140,
                    hozAlign: 'left',
                    headerHozAlign: 'center',
                    formatter: 'html',
                    responsive: 2
                },
                {
                    title: 'buttons',
                    field: 'buttons',
                    sorter: false,
                    minWidth: 140,
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

        if(this.tableQueuedFilesTable) {
            ids.forEach((id) => {
                const file = this.queuedFiles[id].file;
                const isManual = this.queuedFilesPlacementModes[id] === 'manual';
                const placementMissing = this.queuedFilesNeedsPlacement.get(id) && !isManual;
                const warning = placementMissing
                    ? html`${i18n.t('label-manual-positioning-missing')}`
                    : '';
                console.log('this.queuedFilesPlacementModes[id] ', this.queuedFilesPlacementModes[id]);
                let fileData = {
                    fileName: file.name,
                    fileSize: humanFileSize(file.size),
                    profile: 'Personal',
                    positioning: isManual ? 'manual' : 'auto',
                    warning: warning,
                    buttons: this.getActionButtonsHtml(id),
                };

                queuedFiles.push(fileData);
            });

            console.log('data', queuedFiles);

            queuedFilesOptions.data = queuedFiles;
            this.queuedFilesOptions = queuedFilesOptions;
            this.tableQueuedFilesTable.setData(queuedFiles);
        }
    }

    updateTableData() {
        console.log('updateTableData(): this.queuedFiles=', this.queuedFiles);
        const ids = Object.keys(this.queuedFiles);
        const i18n = this._i18n;
        const queuedFiles = [];

        if(this.tableQueuedFilesTable) {
            ids.forEach((id) => {
                const file = this.queuedFiles[id].file;
                const isManual = this.queuedFilesPlacementModes[id] === 'manual';
                const placementMissing = this.queuedFilesNeedsPlacement.get(id) && !isManual;
                const warning = placementMissing
                    ? html`${i18n.t('label-manual-positioning-missing')}`
                    : '';
                console.log('this.queuedFilesPlacementModes[id] ', this.queuedFilesPlacementModes[id]);
                let fileData = {
                    fileName: file.name,
                    fileSize: humanFileSize(file.size),
                    profile: 'Personal',
                    positioning: isManual ? 'manual' : 'auto',
                    warning: warning,
                    buttons: this.getActionButtonsHtml(id),
                };

                queuedFiles.push(fileData);
            });
            console.log('updateTableData(): queuedFiles=', queuedFiles);
            this.tableQueuedFilesTable.setData(queuedFiles);
        }
    }

    getActionButtonsHtml(id) {
        const i18n = this._i18n;
        let controlDiv = this.createScopedElement('div');
        controlDiv.classList.add('tabulator-icon-buttons');
        // Delete button
        const btnDelete = this.createScopedElement('dbp-icon-button');
        btnDelete.setAttribute('icon-name', 'trash');
        btnDelete.classList.add('delete-button');
        btnDelete.setAttribute('aria-label', i18n.t('qualified-pdf-upload.remove-queued-file-button-title'));
        btnDelete.setAttribute('title', i18n.t('qualified-pdf-upload.remove-queued-file-button-title'));
        btnDelete.addEventListener("click", async (event) => {
            this.takeFileFromQueue(id);
        });
        controlDiv.appendChild(btnDelete);
        // Edit signature button
        const btnEditSignature = this.createScopedElement('dbp-icon-button');
        btnEditSignature.setAttribute('icon-name', 'pencil');
        btnEditSignature.classList.add('edit-signature-button');
        btnEditSignature.setAttribute('aria-label', i18n.t('qualified-pdf-upload.edit-signature-button-title'));
        btnEditSignature.setAttribute('title', i18n.t('qualified-pdf-upload.edit-signature-button-title'));
        btnEditSignature.setAttribute('data-placement', this.queuedFilesPlacementModes[id] || 'auto');
        if(!this.signingProcessEnabled) {
            // btnEditSignature.setAttribute('disabled', 'disabled');
        }
        btnEditSignature.addEventListener("click", async (event) => {
            // const button  = /** @type {IconButton} */ (event.target);
            // const placement = button.getAttribute('data-placement');
            this.queuePlacementSwitch(id, 'manual');
        });
        controlDiv.appendChild(btnEditSignature);
        // Show preview button
        const btnPreview = this.createScopedElement('dbp-icon-button');
        btnPreview.setAttribute('icon-name', 'keyword-research');
        btnPreview.classList.add('preview-button');
        btnPreview.setAttribute('aria-label', i18n.t('qualified-pdf-upload.preview-file-button-title'));
        btnPreview.setAttribute('title', i18n.t('qualified-pdf-upload.preview-file-button-title'));
        btnPreview.addEventListener("click", async (event) => {
            this.showPreview(id);
        });
        controlDiv.appendChild(btnPreview);

        return controlDiv;
    }

    /**
     * Returns the list of queued files
     *
     * @returns {*[]} Array of html templates
     */
    // getQueuedFilesHtml() {
    //     const ids = Object.keys(this.queuedFiles);
    //     const i18n = this._i18n;
    //     let results = [];

    //     ids.forEach((id) => {
    //         const file = this.queuedFiles[id].file;
    //         const isManual = this.queuedFilesPlacementModes[id] === 'manual';
    //         const placementMissing = this.queuedFilesNeedsPlacement.get(id) && !isManual;

    //         results.push(html`
    //             <div class="file-block">
    //                 <div class="header">
    //                     <span class="filename">
    //                         <strong>${file.name}</strong>
    //                         (${humanFileSize(file.size)})
    //                     </span>
    //                     <button
    //                         class="button close is-icon"
    //                         ?disabled="${this.signingProcessEnabled}"
    //                         title="${i18n.t(
    //                             'qualified-pdf-upload.remove-queued-file-button-title'
    //                         )}"
    //                         aria-label="${i18n.t(
    //                             'qualified-pdf-upload.remove-queued-file-button-title'
    //                         )}"
    //                         @click="${() => {
    //                             this.takeFileFromQueue(id);
    //                         }}">
    //                         <dbp-icon name="trash" aria-hidden="true"></dbp-icon>
    //                     </button>
    //                 </div>
    //                 <div class="bottom-line">
    //                     <div></div>
    //                     <button
    //                         class="button"
    //                         ?disabled="${this.signingProcessEnabled}"
    //                         @click="${() => {
    //                             this.showPreview(id);
    //                         }}">
    //                         ${i18n.t('qualified-pdf-upload.show-preview')}
    //                     </button>
    //                     <span class="headline">${i18n.t('qualified-pdf-upload.positioning')}:</span>
    //                     <dbp-textswitch
    //                         name1="auto"
    //                         name2="manual"
    //                         name="${this.queuedFilesPlacementModes[id] || 'auto'}"
    //                         class="${classMap({
    //                             'placement-missing': placementMissing,
    //                             switch: true,
    //                         })}"
    //                         value1="${i18n.t('qualified-pdf-upload.positioning-automatic')}"
    //                         value2="${i18n.t('qualified-pdf-upload.positioning-manual')}"
    //                         ?disabled="${this.signingProcessEnabled}"
    //                         @change=${(e) =>
    //                             this.queuePlacementSwitch(id, e.target.name)}></dbp-textswitch>
    //                     <span class="headline ${classMap({hidden: !this.allowAnnotating})}">
    //                         ${i18n.t('qualified-pdf-upload.annotation')}:
    //                     </span>
    //                     <div class="${classMap({hidden: !this.allowAnnotating})}">
    //                         <dbp-textswitch
    //                             id="annotation-switch"
    //                             name1="no-text"
    //                             name2="text-selected"
    //                             name="${this.queuedFilesAnnotationModes[id] || 'no-text'}"
    //                             class="${classMap({switch: true})}"
    //                             value1="${i18n.t('qualified-pdf-upload.annotation-no')}"
    //                             value2="${i18n.t('qualified-pdf-upload.annotation-yes')}"
    //                             ?disabled="${this.signingProcessEnabled}"
    //                             @change=${(e) =>
    //                                 this.showAnnotationView(id, e.target.name)}></dbp-textswitch>
    //                     </div>
    //                 </div>
    //                 <div class="error-line">
    //                     ${placementMissing
    //                         ? html`
    //                               ${i18n.t('label-manual-positioning-missing')}
    //                           `
    //                         : ''}
    //                 </div>
    //             </div>
    //         `);
    //     });

    //     return results;
    // }

    /**
     * Returns the list of successfully signed files
     *
     * @returns {*[]} Array of html templates
     */
    getSignedFilesHtml() {
        const ids = Object.keys(this.signedFiles);
        const i18n = this._i18n;
        let results = [];

        ids.forEach((id) => {
            const file = this.signedFiles[id];

            results.push(html`
                <div class="file-block" id="file-block-${id}">
                    <div class="header">
                        <span class="filename">
                            <span class="bold-filename">${file.name}</span>
                            (${humanFileSize(file.contentSize)})
                        </span>
                        <button
                            class="button is-icon"
                            title="${i18n.t('qualified-pdf-upload.download-file-button-title')}"
                            aria-label="${i18n.t('qualified-pdf-upload.download-file-button-title')}"
                            @click="${() => {
                                this.downloadFileClickHandler(file, 'file-block-' + id);
                            }}">
                            <dbp-icon name="download" aria-hidden="true"></dbp-icon>
                        </button>
                    </div>
                </div>
            `);
        });

        return results;
    }

    /**
     * Returns the list of files of failed signature processes
     *
     * @returns {*[]} Array of html templates
     */
    getErrorFilesHtml() {
        const ids = Object.keys(this.errorFiles);
        const i18n = this._i18n;
        let results = [];

        ids.forEach((id) => {
            const data = this.errorFiles[id];

            if (data.file === undefined) {
                return;
            }

            results.push(html`
                <div class="file-block error">
                    <div class="header">
                        <span class="filename">
                            <strong>${data.file.name}</strong>
                            (${humanFileSize(data.file.size)})
                        </span>
                        <div class="buttons">
                            <button
                                class="button is-icon"
                                title="${i18n.t(
                                    'qualified-pdf-upload.re-upload-file-button-title'
                                )}"
                                aria-label="${i18n.t(
                                    'qualified-pdf-upload.re-upload-file-button-title'
                                )}"
                                @click="${() => {
                                    this.fileQueueingClickHandler(data.file, id);
                                }}">
                                <dbp-icon name="reload" aria-hidden="true"></dbp-icon>
                            </button>
                            <button
                                class="button is-icon"
                                title="${i18n.t(
                                    'qualified-pdf-upload.remove-failed-file-button-title'
                                )}"
                                aria-label="${i18n.t(
                                    'qualified-pdf-upload.remove-failed-file-button-title'
                                )}"
                                @click="${() => {
                                    this.takeFailedFileFromQueue(id);
                                }}">
                                <dbp-icon name="trash" aria-hidden="true"></dbp-icon>
                            </button>
                        </div>
                    </div>
                    <div class="bottom-line">
                        <strong class="error">${data.json['hydra:description']}</strong>
                    </div>
                </div>
            `);
        });

        return results;
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
                            class="button is-primary">
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
                                        class="${classMap({hidden: this.queuedFilesTableExpanded})}"
                                        ?disabled="${this.queuedFilesCount === 0 || this.queuedFilesTableCollapsible === false}"
                                        value="${i18n.t('qualified-pdf-upload.expand-all')}"
                                        @click="${() => {
                                            this.tableQueuedFilesTable.expandAll();
                                            this.queuedFilesTableExpanded = true;
                                        }}"
                                        title="${i18n.t('qualified-pdf-upload.expand-all')}"
                                        >${i18n.t('qualified-pdf-upload.expand-all')}</dbp-loading-button>

                                    <dbp-loading-button id="collapse-all-btn"
                                        class="${classMap({hidden: !this.queuedFilesTableExpanded})}"
                                        ?disabled="${this.queuedFilesCount === 0 || this.queuedFilesTableCollapsible === false}"
                                        value="${i18n.t('qualified-pdf-upload.collapse-all')}"
                                        @click="${() => {
                                            this.tableQueuedFilesTable.collapseAll();
                                            this.queuedFilesTableExpanded = false;
                                        }}"
                                        title="${i18n.t('qualified-pdf-upload.collapse-all')}"
                                        >${i18n.t('qualified-pdf-upload.collapse-all')}</dbp-loading-button>

                                    <dbp-loading-button id="select-all-btn"
                                        class="${classMap({hidden: this.queuedFilesTableAllSelected})}"
                                        ?disabled="${this.queuedFilesCount === 0}"
                                        value="${i18n.t('qualified-pdf-upload.select-all')}"
                                        @click="${() => {
                                            this.queuedFilesTableAllSelected = true;
                                            this.tableQueuedFilesTable.selectAllRows();
                                        }}"
                                        title="${i18n.t('qualified-pdf-upload.select-all')}"
                                        >${i18n.t('qualified-pdf-upload.select-all')}</dbp-loading-button>

                                    <dbp-loading-button id="deselect-all-btn"
                                        class="${classMap({hidden: !this.queuedFilesTableAllSelected})}"
                                        ?disabled="${this.queuedFilesCount === 0}"
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
                            class="files-block field ${classMap({
                                hidden: this.signedFilesCount === 0,
                                'is-disabled': this.isUserInterfaceDisabled(),
                            })}">
                            <h3>${i18n.t('qualified-pdf-upload.signed-files-label')}</h3>
                            <!-- Button to download all signed PDFs -->
                            <div class="field ${classMap({hidden: this.signedFilesCount === 0})}">
                                <div class="control">
                                    <button @click="${this.clearSignedFiles}" class="button">
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
                                        class="is-right"
                                        @click="${this.zipDownloadClickHandler}"
                                        type="is-primary"></dbp-button>
                                </div>
                            </div>
                            <div class="control">${this.getSignedFilesHtml()}</div>
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
                            <div class="control">${this.getErrorFilesHtml()}</div>
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
