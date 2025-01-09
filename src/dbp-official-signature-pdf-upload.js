import {createInstance} from './i18n.js';
import {humanFileSize} from '@dbp-toolkit/common/i18next.js';
import {css, html} from 'lit';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import DBPSignatureLitElement from './dbp-signature-lit-element';
import {PdfPreview} from './dbp-pdf-preview';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as utils from './utils';
import {Button, Icon, IconButton, LoadingButton, MiniSpinner, combineURLs, Modal} from '@dbp-toolkit/common';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {TooltipElement} from '@dbp-toolkit/tooltip';
import {classMap} from 'lit/directives/class-map.js';
import {FileSource} from '@dbp-toolkit/file-handling';
import {FileSink} from '@dbp-toolkit/file-handling';
import {name as pkgName} from './../package.json';
import {send as notify} from '@dbp-toolkit/common/notification';
import metadata from './dbp-official-signature-pdf-upload.metadata.json';
import {Activity} from './activity.js';
import {PdfAnnotationView} from './dbp-pdf-annotation-view';
import * as SignatureStyles from './styles';
import {TabulatorTable} from '@dbp-toolkit/tabulator-table';

class OfficialSignaturePdfUpload extends ScopedElementsMixin(DBPSignatureLitElement) {
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
        this.activity = new Activity(metadata);
        this.fileHandlingEnabledTargets = 'local';
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
            'dbp-pdf-annotation-view': PdfAnnotationView,
            'dbp-tabulator-table': TabulatorTable,
            'dbp-tooltip': TooltipElement,
            'dbp-modal': Modal,
        };
    }

    static get properties() {
        return {
            ...super.properties,
        };
    }

    connectedCallback() {
        super.connectedCallback();
        // needs to be called in a function to get the variable scope of "this"
        setInterval(() => {
            this.handleQueuedFiles();
        }, 1000);

        window.addEventListener('dbp-pdf-preview-accept', this.setQueuedFilesTabulatorTable.bind(this));
        window.addEventListener('dbp-pdf-annotations-save', this.setQueuedFilesTabulatorTable.bind(this));
        window.addEventListener('dbp-pdf-annotations-cancel', this.setQueuedFilesTabulatorTable.bind(this));
        window.addEventListener('dbp-tabulator-table-collapsible-event', this.tabulatorTableHandleCollapse.bind(this));
        window.addEventListener('dbp-tabulator-table-row-selection-changed-event', this.handleTableSelection.bind(this));
        window.addEventListener('dbp-modal-closed', this.handleModalClosed.bind(this));
        window.addEventListener('dbp-pdf-preview-accept', this.handlePdfModalClosing.bind(this));
        window.addEventListener('dbp-pdf-preview-cancel', this.handlePdfModalClosing.bind(this));
        window.addEventListener('dbp-pdf-annotations-cancel', this.handleAnnotationModalClosing.bind(this));
        window.addEventListener('dbp-pdf-annotations-save', this.handleAnnotationModalClosing.bind(this));
    }

    disconnectedCallback() {
        // remove event listeners
        window.removeEventListener('dbp-pdf-preview-accept', this.setQueuedFilesTabulatorTable);
        window.removeEventListener('dbp-pdf-annotations-save', this.setQueuedFilesTabulatorTable);
        window.removeEventListener('dbp-pdf-annotations-cancel', this.setQueuedFilesTabulatorTable);
        window.removeEventListener('dbp-tabulator-table-collapsible-event', this.tabulatorTableHandleCollapse);
        window.removeEventListener('dbp-tabulator-table-row-selection-changed-event', this.handleTableSelection);
        window.removeEventListener('dbp-modal-closed', this.handleModalClosed);
        window.removeEventListener('dbp-pdf-preview-accept', this.handlePdfModalClosing);
        window.removeEventListener('dbp-pdf-preview-cancel', this.handlePdfModalClosing);
        window.removeEventListener('dbp-pdf-annotations-cancel', this.handleAnnotationModalClosing);
        window.removeEventListener('dbp-pdf-annotations-save', this.handleAnnotationModalClosing);
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

        if (!this.signingProcessEnabled ||
            this.uploadInProgress ||
            this.addAnnotationInProgress) {
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
            // Process all queued files
            key = Object.keys(this.queuedFiles)[0];
        }

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

        params['profile'] = 'official';

        this.uploadStatusText = i18n.t('official-pdf-upload.upload-status-file-text', {
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
            const result = confirm(i18n.t('official-pdf-upload.confirm-page-leave'));

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

    addToErrorFiles(file) {
        this.endSigningProcessIfQueueEmpty();

        // this doesn't seem to trigger an update() execution
        this.errorFiles[Math.floor(Math.random() * 1000000)] = file;
        // this triggers the correct update() execution
        this.errorFilesCount++;

        this.sendSetPropertyEvent('analytics-event', {
            category: 'officiallySigning',
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
        } else if (data.json['@type'] === 'http://schema.org/MediaObject') {
            // this doesn't seem to trigger an update() execution
            this.signedFiles.push(data.json);
            // this triggers the correct update() execution
            this.signedFilesCount++;
            const entryPoint = data.json;
            this.currentFileName = entryPoint.name;
            this.endSigningProcessIfQueueEmpty();
            this.sendSetPropertyEvent('analytics-event', {
                category: 'OfficialSigning',
                action: 'DocumentSigned',
                name: data.json.contentSize,
            });
        }
        this.sendReportNotification();
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this._i18n.changeLanguage(this.lang);
                    this.setQueuedFilesTabulatorTable();
                    break;
                case 'entryPointUrl':
                    if (this.entryPointUrl) {
                        this.fileSourceUrl = combineURLs(this.entryPointUrl, '/esign/advancedly-signed-documents');
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
        `;
    }

    hasSignaturePermissions() {
        return this._hasSignaturePermissions('ROLE_SCOPE_OFFICIAL-SIGNATURE');
    }

    async stopSigningProcess() {
        this.signingProcessEnabled = false;
        this.signingProcessActive = false;

        if (this.currentFile.file !== undefined) {
            const key = await this.queueFile(this.currentFile.file);

            // set placement mode and parameters so they are restore when canceled
            this.queuedFilesPlacementModes[key] = this.currentFilePlacementMode;
            this.queuedFilesSignaturePlacements[key] = this.currentFileSignaturePlacement;
        }
    }

    render() {
        const placeholderUrl = commonUtils.getAssetURL(
            pkgName,
            'official-signature-placeholder.png'
        );
        const i18n = this._i18n;

        return html`
            <div
                class="${classMap({
                    hidden:
                        !this.isLoggedIn() || !this.hasSignaturePermissions() || this.isLoading(),
                })}">
                <div class="field">
                    <h2>${this.activity.getName(this.lang)}</h2>
                    <p class="subheadline">${this.activity.getDescription(this.lang)}</p>
                    <div class="control">
                        <p>${i18n.t('official-pdf-upload.upload-text')}</p>
                        <button
                            @click="${() => {
                                this._('#file-source').setAttribute('dialog-open', '');
                            }}"
                            ?disabled="${this.signingProcessActive}"
                            class="button is-primary"
                            id="upload-pdf-button">
                            ${i18n.t('official-pdf-upload.upload-button-label')}
                        </button>
                        <dbp-file-source
                            id="file-source"
                            context="${i18n.t('official-pdf-upload.file-picker-context')}"
                            subscribe="nextcloud-store-session:nextcloud-store-session"
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
                            text="${i18n.t('official-pdf-upload.upload-area-text')}"
                            button-label="${i18n.t('official-pdf-upload.upload-button-label')}"
                            @dbp-file-source-file-selected="${this.onFileSelected}"
                            @dbp-file-source-switched="${this.onFileSourceSwitch}"></dbp-file-source>
                    </div>
                </div>
                <div id="grid-container">
                    <div class="table-container">
                        <div
                            class="files-block queued-files field ${classMap({
                                hidden: !this.queueBlockEnabled,
                            })}">
                            <!-- Queued files headline and queueing spinner -->
                            <h3 class="section-title">
                                ${i18n.t('official-pdf-upload.queued-files-label')}
                            </h3>
                            <div class="control field tabulator-actions">
                                <div class="table-actions">
                                    <dbp-loading-button id="expand-all-btn-queued-files"
                                        class="${classMap({
                                            hidden: this.queuedFilesTableExpanded
                                        })}"
                                        ?disabled="${this.queuedFilesCount === 0 || this.queuedFilesTableCollapsible === false}"
                                        value="${i18n.t('qualified-pdf-upload.expand-all')}"
                                        @click="${() => {
                                            this.tableQueuedFilesTable.expandAll();
                                            this.queuedFilesTableExpanded = true;
                                        }}"
                                        title="${i18n.t('qualified-pdf-upload.expand-all')}"
                                        >${i18n.t('qualified-pdf-upload.expand-all')}</dbp-loading-button>

                                    <dbp-loading-button id="collapse-all-btn-queued-files"
                                        class="${classMap({
                                            hidden: !this.queuedFilesTableExpanded
                                        })}"
                                        ?disabled="${this.queuedFilesCount === 0 || this.queuedFilesTableCollapsible === false}"
                                        value="${i18n.t('qualified-pdf-upload.collapse-all')}"
                                        @click="${() => {
                                            this.tableQueuedFilesTable.collapseAll();
                                            this.queuedFilesTableExpanded = false;
                                        }}"
                                        title="${i18n.t('qualified-pdf-upload.collapse-all')}"
                                        >${i18n.t('qualified-pdf-upload.collapse-all')}</dbp-loading-button>

                                    <dbp-loading-button id="select-all-btn-queued-files"
                                        class="${classMap({
                                            hidden: this.queuedFilesTableAllSelected
                                        })}"
                                        ?disabled="${this.queuedFilesCount === 0}"
                                        value="${i18n.t('qualified-pdf-upload.select-all')}"
                                        @click="${() => {
                                            this.queuedFilesTableAllSelected = true;
                                            this.tableQueuedFilesTable.selectAllRows();
                                        }}"
                                        title="${i18n.t('qualified-pdf-upload.select-all')}"
                                        >${i18n.t('qualified-pdf-upload.select-all')}</dbp-loading-button>

                                    <dbp-loading-button id="deselect-all-btn-queued-files"
                                        class="${classMap({
                                            hidden: !this.queuedFilesTableAllSelected
                                        })}"
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
                                        id="clear-queue-button-queued-files"
                                        @click="${this.clearQueuedFiles}"
                                        ?disabled="${this.queuedFilesCount === 0 ||
                                        this.signingProcessActive}"
                                        class="button">
                                        ${i18n.t('official-pdf-upload.clear-all')}
                                    </button>
                                    <button
                                        id="start-signing-button"
                                        @click="${() => {
                                            this.signingProcessEnabled = true;
                                            this.signingProcessActive = true;
                                            this.initialQueuedFilesCount = this.queuedFilesCount;
                                        }}"
                                        ?disabled="${this.queuedFilesCount === 0}"
                                        class="button is-primary ${classMap({
                                            hidden: this.signingProcessActive,
                                        })}">
                                        ${i18n.t('official-pdf-upload.start-signing-process-button')}
                                    </button>
                                    <!-- -->
                                    <button
                                        @click="${this.stopSigningProcess}"
                                        id="cancel-signing-process"
                                        class="button is-right ${classMap({
                                            hidden: !this.signingProcessActive,
                                        })}">
                                        ${i18n.t('official-pdf-upload.stop-signing-process-button')}
                                    </button>
                                </div>
                            </div>
                            <!-- List of queued files -->
                            <div
                                class="control file-list">
                                <dbp-tabulator-table
                                    id="table-queued-files"
                                    identifier="table-queued-files"
                                    class="table-queued-files"
                                    lang="${this.lang}"
                                    select-rows-enabled
                                    .options="${this.queuedFilesOptions}">
                                </dbp-tabulator-table>
                            </div>
                            <!-- Text "queue empty" -->
                            <div
                                class="empty-queue control ${classMap({
                                    hidden: this.queuedFilesCount !== 0
                                })}">
                                ${i18n.t('official-pdf-upload.queued-files-empty1')}
                                <br />
                                ${i18n.t('official-pdf-upload.queued-files-empty2')}
                            </div>
                        </div>
                        <!-- List of signed PDFs -->
                        <div
                            class="files-block signed-files field ${classMap({
                                hidden: this.signedFilesCount === 0,
                            })}">
                            <h3 class="section-title">${i18n.t('official-pdf-upload.signed-files-label')}</h3>
                            <!-- Button to download all signed PDFs -->
                            <div class="field ${classMap({hidden: this.signedFilesCount === 0})}">
                                <div class="control tabulator-actions">
                                    <div class="table-actions">
                                        <dbp-loading-button id="expand-all-btn-signed-files"
                                            class="${classMap({
                                                hidden: this.signedFilesTableExpanded
                                            })}"
                                            ?disabled="${this.signedFilesCount === 0 || this.signedFilesTableCollapsible === false}"
                                            value="${i18n.t('qualified-pdf-upload.expand-all')}"
                                            @click="${() => {
                                                this.tableSignedFilesTable.expandAll();
                                                this.signedFilesTableExpanded = true;
                                            }}"
                                            title="${i18n.t('qualified-pdf-upload.expand-all')}"
                                            >${i18n.t('qualified-pdf-upload.expand-all')}</dbp-loading-button>

                                        <dbp-loading-button id="collapse-all-btn-signed-files"
                                            class="${classMap({
                                                hidden: !this.signedFilesTableExpanded
                                            })}"
                                            ?disabled="${this.signedFilesCount === 0 || this.signedFilesTableCollapsible === false}"
                                            value="${i18n.t('qualified-pdf-upload.collapse-all')}"
                                            @click="${() => {
                                                this.tableSignedFilesTable.collapseAll();
                                                this.signedFilesTableExpanded = false;
                                            }}"
                                            title="${i18n.t('qualified-pdf-upload.collapse-all')}"
                                            >${i18n.t('qualified-pdf-upload.collapse-all')}</dbp-loading-button>
                                    </div>
                                    <div class="signed-actions">
                                        <button id="clear-signed-files-btn"
                                            class="clear-signed-files button"
                                            @click="${this.clearSignedFiles}" class="button">
                                            ${i18n.t('official-pdf-upload.clear-all')}
                                        </button>
                                        <dbp-loading-button
                                            id="zip-download-button"
                                            value="${i18n.t('official-pdf-upload.download-zip-button')}"
                                            title="${i18n.t(
                                                'official-pdf-upload.download-zip-button-tooltip'
                                            )}"
                                            class="zip-download-button"
                                            @click="${this.zipDownloadClickHandler}"
                                            type="is-primary"></dbp-loading-button>
                                    </div>
                                </div>
                            </div>
                            <dbp-tabulator-table
                                id="table-signed-files"
                                identifier="table-signed-files"
                                class="table-signed-files"
                                lang="${this.lang}"
                                .options="${this.signedFilesOptions}"></dbp-tabulator-table>
                        </div>
                        <!-- List of errored files -->
                        <div
                            class="files-block error-files field ${classMap({
                                hidden: this.errorFilesCount === 0
                            })}">
                            <h3 class="section-title">${i18n.t('official-pdf-upload.error-files-label')}</h3>
                            <!-- Button to upload errored files again -->
                            <div class="field ${classMap({hidden: this.errorFilesCount === 0})}">
                                <div class="control tabulator-actions">
                                    <div class="table-actions">
                                        <dbp-loading-button id="expand-all-btn-failed-files"
                                            class="${classMap({
                                                hidden: this.failedFilesTableExpanded
                                            })}"
                                            ?disabled="${this.errorFilesCount === 0 || this.failedFilesTableCollapsible === false}"
                                            value="${i18n.t('qualified-pdf-upload.expand-all')}"
                                            @click="${() => {
                                                this.tableFailedFilesTable.expandAll();
                                                this.failedFilesTableExpanded = true;
                                            }}"
                                            title="${i18n.t('qualified-pdf-upload.expand-all')}"
                                            >${i18n.t('qualified-pdf-upload.expand-all')}</dbp-loading-button>

                                        <dbp-loading-button id="collapse-all-btn-failed-files"
                                            class="${classMap({
                                                hidden: !this.failedFilesTableExpanded
                                            })}"
                                            ?disabled="${this.errorFilesCount === 0 || this.failedFilesTableCollapsible === false}"
                                            value="${i18n.t('qualified-pdf-upload.collapse-all')}"
                                            @click="${() => {
                                                this.tableFailedFilesTable.collapseAll();
                                                this.failedFilesTableExpanded = false;
                                            }}"
                                            title="${i18n.t('qualified-pdf-upload.collapse-all')}"
                                            >${i18n.t('qualified-pdf-upload.collapse-all')}</dbp-loading-button>
                                    </div>
                                    <div class="failed-actions">
                                        <button id="clear-error-files-btn"
                                            @click="${this.clearErrorFiles}"
                                            class="clear-signed-files button">
                                            ${i18n.t('official-pdf-upload.clear-all')}
                                        </button>
                                        <dbp-loading-button
                                            id="re-upload-all-button"
                                            ?disabled="${this.uploadInProgress}"
                                            value="${i18n.t(
                                                'official-pdf-upload.re-upload-all-button'
                                            )}"
                                            title="${i18n.t(
                                                'official-pdf-upload.re-upload-all-button-title'
                                            )}"
                                            class="is-right"
                                            @click="${this.reUploadAllClickHandler}"
                                            type="is-primary"></dbp-loading-button>
                                    </div>
                                </div>
                            </div>
                            <dbp-tabulator-table
                                id="table-failed-files"
                                identifier="table-failed-files"
                                class="table-failed-files"
                                lang="${this.lang}"
                                .options="${this.failedFilesOptions}"></dbp-tabulator-table>
                        </div>
                    </div>
                    <div class="modal-container">
                        <!-- PDF preview -->
                        <dbp-modal id="pdf-preview"
                            modal-id="pdf-preview-modal"
                            class="modal--pdf-preview"
                            title="${this.withSigBlock
                                ? i18n.t('official-pdf-upload.signature-placement-label')
                                : i18n.t('official-pdf-upload.preview-label')}">
                            <div slot="header" class="header">
                                <div class="filename">
                                    <strong>${this.currentFile.name}</strong>
                                    (${humanFileSize(
                                        this.currentFile !== undefined ? this.currentFile.size : 0
                                    )})
                                </div>
                            </div>
                            <div slot="content">
                                <dbp-pdf-preview
                                    lang="${this.lang}"
                                    allow-signature-rotation
                                    signature-placeholder-image-src="${placeholderUrl}"
                                    signature-width="162"
                                    signature-height="28"
                                    @dbp-pdf-preview-accept="${this.storePDFData}"
                                    @dbp-pdf-preview-cancel="${this.hidePDF}"></dbp-pdf-preview>
                            </div>
                        </dbp-modal>
                        <!-- Annotation view -->
                        <dbp-modal id="annotation-view"
                            modal-id="annotation-view-modal"
                            class="modal--annotation-view ${classMap({
                                hidden: !this.isAnnotationViewVisible || !this.allowAnnotating,
                            })}"
                            title="${i18n.t('official-pdf-upload.annotation-view-label')}">
                            <div slot="header" class="header">
                                <div class="modal-notification">
                                    <dbp-notification id="dbp-modal-notification-annotation" inline lang="${this.lang}"></dbp-notification>
                                </div>
                                <div class="filename">
                                    <strong>${this.currentFile.file !== undefined ? this.currentFile.file.name : ''}</strong>
                                    (${humanFileSize(
                                        this.currentFile.file !== undefined ? this.currentFile.file.size : 0
                                    )})
                                </div>
                            </div>
                            <div slot="content">
                                <dbp-pdf-annotation-view
                                    lang="${this.lang}"
                                    @dbp-pdf-annotations-save="${this.processAnnotationEvent}"
                                    @dbp-pdf-annotations-cancel="${this.processAnnotationCancelEvent}">
                                </dbp-pdf-annotation-view>
                            </div>
                        </dbp-modal>
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
                context="${i18n.t('official-pdf-upload.save-field-label', {
                    count: this.signedFilesToDownload,
                })}"
                filename="signed-documents.zip"
                subscribe="initial-file-handling-state:initial-file-handling-state,clipboard-files:clipboard-files,nextcloud-store-session:nextcloud-store-session"
                enabled-targets="${this.fileHandlingEnabledTargets}"
                nextcloud-auth-url="${this.nextcloudWebAppPasswordURL}"
                nextcloud-web-dav-url="${this.nextcloudWebDavURL}"
                nextcloud-name="${this.nextcloudName}"
                nextcloud-file-url="${this.nextcloudFileURL}"
                lang="${this.lang}"></dbp-file-sink>
        `;
    }
}

commonUtils.defineCustomElement('dbp-official-signature-pdf-upload', OfficialSignaturePdfUpload);
