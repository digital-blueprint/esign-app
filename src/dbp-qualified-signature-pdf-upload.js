import {humanFileSize} from '@dbp-toolkit/common/i18next.js';
import {css, html} from 'lit';
import {DBPSelect, ScopedElementsMixin} from '@dbp-toolkit/common';
import DBPSignatureLitElement, {SignedEntry} from './dbp-signature-lit-element';
import {PdfPreview} from './dbp-pdf-preview';
import {sendNotification} from '@dbp-toolkit/common/notification';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as utils from './utils';
import {Button, Icon, IconButton, LoadingButton, MiniSpinner, Modal} from '@dbp-toolkit/common';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {TooltipElement} from '@dbp-toolkit/tooltip';
import {classMap} from 'lit/directives/class-map.js';
import {FileSource} from '@dbp-toolkit/file-handling';
import {FileSink} from '@dbp-toolkit/file-handling';
import {send as notify} from '@dbp-toolkit/common/notification';
import {PdfAnnotationView} from './dbp-pdf-annotation-view';
import {ExternalSignIFrame} from './ext-sign-iframe.js';
import * as SignatureStyles from './styles';
import {CustomTabulatorTable} from './table-components.js';
import {EsignApi, EsignQualifiedBatchSigningRequestInput} from './api.js';

class QualifiedSignaturePdfUpload extends ScopedElementsMixin(DBPSignatureLitElement) {
    constructor() {
        super();
        this.entryPointUrl = '';
        this.nextcloudWebAppPasswordURL = '';
        this.nextcloudWebDavURL = '';
        this.nextcloudName = '';
        this.nextcloudFileURL = '';
        this.nextcloudAuthInfo = '';
        this.fileHandlingEnabledTargets = 'local';
        this.externalAuthInProgress = false;
        this.activeSigningEntries = [];

        // Bind all event handlers
        this._onReceiveBeforeUnload = this.onReceiveBeforeUnload.bind(this);
        this._setQueuedFilesTabulatorTable = this.setQueuedFilesTabulatorTable.bind(this);
        this._tabulatorTableHandleCollapse = this.tabulatorTableHandleCollapse.bind(this);
        this._handleTableSelection = this.handleTableSelection.bind(this);
        this._tabulatorTableHandleRenderCompleted =
            this.tabulatorTableHandleRenderCompleted.bind(this);
        this._handleModalClosed = this.handleModalClosed.bind(this);
        this._handlePdfModalClosing = this.handlePdfModalClosing.bind(this);
        this._handleAnnotationModalClosing = this.handleAnnotationModalClosing.bind(this);

        this._api = new EsignApi(this);
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
            'external-sign-iframe': ExternalSignIFrame,
            'dbp-esign-tabulator-table': CustomTabulatorTable,
            'dbp-tooltip': TooltipElement,
            'dbp-modal': Modal,
            'dbp-select': DBPSelect,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            externalAuthInProgress: {type: Boolean, attribute: false},
        };
    }

    connectedCallback() {
        super.connectedCallback();
        // Add event listeners using bound methods
        window.addEventListener('beforeunload', this._onReceiveBeforeUnload);
        window.addEventListener('dbp-pdf-preview-accept', this._setQueuedFilesTabulatorTable);
        window.addEventListener('dbp-pdf-annotations-save', this._setQueuedFilesTabulatorTable);
        window.addEventListener('dbp-pdf-annotations-cancel', this._setQueuedFilesTabulatorTable);
        window.addEventListener(
            'dbp-tabulator-table-collapsible-event',
            this._tabulatorTableHandleCollapse,
        );
        window.addEventListener(
            'dbp-tabulator-table-row-selection-changed-event',
            this._handleTableSelection,
        );
        window.addEventListener(
            'dbp-tabulator-table-render-complete-event',
            this._tabulatorTableHandleRenderCompleted,
        );
        window.addEventListener('dbp-modal-closed', this._handleModalClosed);
        window.addEventListener('dbp-pdf-preview-accept', this._handlePdfModalClosing);
        window.addEventListener('dbp-pdf-preview-cancel', this._handlePdfModalClosing);
        window.addEventListener('dbp-pdf-annotations-cancel', this._handleAnnotationModalClosing);
        window.addEventListener('dbp-pdf-annotations-save', this._handleAnnotationModalClosing);
    }

    disconnectedCallback() {
        // Remove event listeners using bound methods
        window.removeEventListener('beforeunload', this._onReceiveBeforeUnload);
        window.removeEventListener('dbp-pdf-preview-accept', this._setQueuedFilesTabulatorTable);
        window.removeEventListener('dbp-pdf-annotations-save', this._setQueuedFilesTabulatorTable);
        window.removeEventListener(
            'dbp-pdf-annotations-cancel',
            this._setQueuedFilesTabulatorTable,
        );
        window.removeEventListener(
            'dbp-tabulator-table-collapsible-event',
            this._tabulatorTableHandleCollapse,
        );
        window.removeEventListener(
            'dbp-tabulator-table-render-complete-event',
            this._tabulatorTableHandleRenderCompleted,
        );
        window.removeEventListener(
            'dbp-tabulator-table-row-selection-changed-event',
            this._handleTableSelection,
        );
        window.removeEventListener('dbp-modal-closed', this._handleModalClosed);
        window.removeEventListener('dbp-pdf-preview-accept', this._handlePdfModalClosing);
        window.removeEventListener('dbp-pdf-preview-cancel', this._handlePdfModalClosing);
        window.removeEventListener(
            'dbp-pdf-annotations-cancel',
            this._handleAnnotationModalClosing,
        );
        window.removeEventListener('dbp-pdf-annotations-save', this._handleAnnotationModalClosing);

        super.disconnectedCallback();
    }

    firstUpdated(changedProperties) {
        super.firstUpdated(changedProperties);
        this.tableQueuedFilesTable = /** @type {CustomTabulatorTable} */ (
            this._('#table-queued-files')
        );
        this.tableSignedFilesTable = /** @type {CustomTabulatorTable} */ (
            this._('#table-signed-files')
        );
        this.tableFailedFilesTable = /** @type {CustomTabulatorTable} */ (
            this._('#table-failed-files')
        );
    }

    async queueFile(file) {
        let id = await super.queueFile(file);
        this.setQueuedFilesTabulatorTable();
        this.requestUpdate();
        return id;
    }

    /**
     * Returns a stable string key representing the user_text for an entry,
     * used to determine chunk boundaries. Entries with no annotations return null.
     *
     * @param {import('./dbp-signature-lit-element.js').SignatureEntry} entry
     * @returns {string|null}
     */
    _getEntryUserText(entry) {
        const annotations = entry.annotations ?? [];
        if (annotations.length === 0) return null;
        return JSON.stringify(this.getUserTextForAnnotations(annotations));
    }

    /**
     * Builds the spinner text shown while files are being prepared.
     * Consistent with the official upload: "filename (size) is currently uploading..."
     *
     * @param {import('./dbp-signature-lit-element.js').SignatureEntry[]} entries
     * @returns {string}
     */
    _buildUploadStatusText(entries) {
        const i18n = this._i18n;
        if (entries.length === 0) return '';
        const first = entries[0];
        return i18n.t('qualified-pdf-upload.upload-status-file-text', {
            fileName: first.file.name,
            fileSize: humanFileSize(first.file.size, false),
            count: entries.length,
        });
    }

    /**
     * Starts the batch signing process for all queued (or selected) files,
     * processing them in chunks where each chunk has ≤10 files with the same user_text.
     */
    async processSigningQueue() {
        const i18n = this._i18n;
        if (this.queuedFiles.size === 0) {
            this.signingProcessActive = false;
            return;
        }

        if (this.externalAuthInProgress) {
            return;
        }

        this.signingProcessActive = true;
        this.signaturePlacementInProgress = false;

        // Build ordered candidate keys — selected subset or all queued
        let candidateKeys = [];
        if (this.selectedFiles.length > 0) {
            for (const selectedFile of this.selectedFiles) {
                if (this.queuedFiles.has(selectedFile.key)) {
                    candidateKeys.push(selectedFile.key);
                }
            }
            this.selectedFilesProcessing = candidateKeys.length > 0;
        } else {
            candidateKeys = [...this.queuedFiles.keys()];
        }

        if (candidateKeys.length === 0) {
            this.signingProcessActive = false;
            return;
        }

        // Validate placement before touching the queue
        for (const key of candidateKeys) {
            const entry = this.queuedFiles.get(key);
            if (entry.needsPlacement && entry.placementMode !== 'manual') {
                notify({
                    summary: i18n.t('error-manual-positioning-missing-title'),
                    body: i18n.t('error-manual-positioning-missing'),
                    type: 'danger',
                    timeout: 5,
                });
                this.signingProcessActive = false;
                return;
            }
        }

        // Peek: determine the chunk — ≤10 files with the same user_text as the first
        const firstUserText = this._getEntryUserText(this.queuedFiles.get(candidateKeys[0]));
        const chunkKeys = [];
        for (const key of candidateKeys) {
            if (chunkKeys.length >= 10) break;
            if (this._getEntryUserText(this.queuedFiles.get(key)) !== firstUserText) break;
            chunkKeys.push(key);
        }

        // Take only the chunk entries off the queue
        const entries = chunkKeys.map((key) => this.takeFileFromQueue(key));
        this.activeSigningEntries = entries;
        this.uploadInProgress = true;
        this.uploadStatusText = this._buildUploadStatusText(entries);

        // Build batch inputs (apply annotations sequentially)
        const inputs = [];
        for (const entry of entries) {
            let file = entry.file;
            let userText = null;
            const annotations = entry.annotations ?? [];

            if (annotations.length > 0) {
                file = await this.addAnnotationsToFile(file, annotations);
                userText = this.getUserTextForAnnotations(annotations);
            }

            let params = {};
            if (entry.placementMode === 'manual' && entry.signaturePlacement !== undefined) {
                params = utils.fabricjs2pdfasPosition(entry.signaturePlacement);
            }
            params['profile'] = this.selectedProfile;

            inputs.push(new EsignQualifiedBatchSigningRequestInput(file, params, userText));
        }

        this.uploadInProgress = false;
        this._('#external-auth').open();

        let batchRequest;
        try {
            batchRequest = await this._api.createQualifiedBatchSigningRequest(inputs);
        } catch (error) {
            if (error.message) {
                sendNotification({
                    summary: 'Error!',
                    body: error.message,
                    type: 'danger',
                    timeout: 15,
                });
            }
            for (const entry of this.activeSigningEntries) {
                this.addToErrorFiles(entry, error.detail ?? error.message);
            }
            this.activeSigningEntries = [];
            this.sendReportNotification();
            this._('#external-auth').close();
            return;
        }

        this.externalAuthInProgress = true;
        this._('#iframe').setUrl(batchRequest.url, entries);
    }

    /**
     * Decides if the "beforeunload" event needs to be canceled
     *
     * @param event
     */
    onReceiveBeforeUnload(event) {
        const i18n = this._i18n;
        // we don't need to stop if there are no signed files
        if (this.signedFiles.size === 0) {
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
        } else if (error.includes('Unbekannter Fehler')) {
            errorParsed = i18n.t('error-unknown-message');
        }
        return errorParsed;
    }

    async _onIFrameDone(event) {
        const code = event.detail.code;

        try {
            const batchResult = await this._api.getQualifiedBatchSigningResult(code);

            // hide iframe
            this.externalAuthInProgress = false;
            this._('#iframe').reset();

            const signedFiles = new Map(this.signedFiles);
            for (let i = 0; i < this.activeSigningEntries.length; i++) {
                const entry = this.activeSigningEntries[i];
                const doc = batchResult.documents[i];

                const filename = utils.generateSignedFileName(entry.file.name);
                const arr = utils.convertDataURIToBinary(doc.contentUrl);
                const signedFile = new File([arr], filename, {
                    type: utils.getDataURIContentType(doc.contentUrl),
                });

                signedFiles.set(entry.key, new SignedEntry(entry.key, signedFile));
                this.signedFilesCountToReport++;

                this.sendSetPropertyEvent('analytics-event', {
                    category: 'QualifiedlySigning',
                    action: 'DocumentSigned',
                    name: signedFile.size,
                });
            }
            this.signedFiles = signedFiles;
        } catch (error) {
            console.error('Error while fetching signed batch result:', error);
            for (const entry of this.activeSigningEntries) {
                this.addToErrorFiles(entry, 'Download failed!');
            }
        } finally {
            this.activeSigningEntries = [];
            this.externalAuthInProgress = false;
            this._('#external-auth').close();

            const hasMore = this.queuedFiles.size > 0 || this.selectedFiles.length > 0;
            if (hasMore) {
                this.processSigningQueue();
            } else {
                this.signingProcessActive = false;
                this.sendReportNotification();
            }
        }
    }

    _onIFrameError(event) {
        let error = event.detail.message;
        if (this.activeSigningEntries.length === 0) {
            return;
        }
        const errorMessage = this.parseError(error);
        for (const entry of this.activeSigningEntries) {
            this.addToErrorFiles(entry, errorMessage);
        }
        this.activeSigningEntries = [];
        this._('#iframe').reset();
        this.externalAuthInProgress = false;
        this.signingProcessActive = false;
        this._('#external-auth').close();
        this.sendReportNotification();
    }

    addToErrorFiles(sigEntry, errorMessage) {
        const errorEntry = this.storeErrorFile(sigEntry, errorMessage);
        if (!errorEntry) {
            return;
        }

        this.errorFilesCountToReport++;

        this.sendSetPropertyEvent('analytics-event', {
            category: 'QualifiedlySigning',
            action: 'SigningFailed',
            name: errorMessage,
        });
    }

    update(changedProperties) {
        super.update(changedProperties);
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this.setQueuedFilesTabulatorTable();
                    break;
                case 'queuedFiles':
                    this.setQueuedFilesTabulatorTable();
                    break;
                case 'signedFiles':
                    this.setSignedFilesTabulatorTable();
                    break;
                case 'errorFiles':
                    this.setFailedFilesTabulatorTable();
                    break;
                case 'auth':
                    if (this.auth.token) {
                        this.fetchProfiles('qualified');
                    }
                    break;
            }
        });
    }

    clearQueuedFiles() {
        // Delete selected files from the queues
        if (this.selectedFiles.length) {
            let filesToRemove = this.selectedFiles.map((selectedFile) => selectedFile.key);

            super.clearQueuedFiles(filesToRemove);
        }
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

    hasSignaturePermissions() {
        return this._hasSignaturePermissions('ROLE_SCOPE_QUALIFIED-SIGNATURE');
    }

    async stopSigningProcess() {
        if (!this.externalAuthInProgress) {
            return;
        }

        this._('#iframe').reset();
        this.externalAuthInProgress = false;
        this.signingProcessActive = false;

        if (this.activeSigningEntries.length > 0) {
            for (const entry of this.activeSigningEntries) {
                await this.reQueueFile(entry);
            }
            this.activeSigningEntries = [];
            this.setQueuedFilesTabulatorTable();
        }
    }

    _onLoginClicked(e) {
        this.sendSetPropertyEvent('requested-login-status', 'logged-in');
        e.preventDefault();
    }

    render() {
        let previewUrl = '';

        if (this.selectedProfile) {
            previewUrl = this.entryPointUrl + '/esign/preview/' + this.selectedProfile;
        }

        const i18n = this._i18n;

        let profileOptions = this.getProfileOptions();

        return html`
            <div
                class="${classMap({
                    hidden:
                        !this.isLoggedIn() || !this.hasSignaturePermissions() || this.isLoading(),
                })}">
                <div class="field">
                    <div class="control">
                        <p class="description">${i18n.t('qualified-pdf-upload.upload-text')}</p>
                        <dbp-select
                            id="profile-select-dropdown"
                            label="${this.selectedProfile
                                ? this.getProfileDisplayNameInLanguage(this.selectedProfile)
                                : i18n.t('official-pdf-upload.default-dropdown-text')}"
                            .options=${profileOptions}
                            align="left"
                            @change="${this.profileSelection}"></dbp-select>
                        <br />
                        <br />
                        <button
                            @click="${() => {
                                this._('#file-source').setAttribute('dialog-open', '');
                            }}"
                            ?disabled="${this.signingProcessActive || this.selectedProfile === ''}"
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
                            @dbp-file-source-switched="${this
                                .onFileSourceSwitch}"></dbp-file-source>
                    </div>
                </div>
                <div id="grid-container">
                    <div class="table-container">
                        <div
                            class="files-block queued-files field ${classMap({
                                hidden: this.queuedFiles.size === 0,
                            })}">
                            <!-- Queued files headline and queueing spinner -->
                            <h3 class="section-title">
                                ${i18n.t('qualified-pdf-upload.queued-files-label')}
                            </h3>
                            <div class="control field tabulator-actions">
                                <div class="table-actions">
                                    <dbp-loading-button
                                        id="expand-all-btn-queued-files"
                                        class="${classMap({
                                            hidden: this.queuedFilesTableExpanded,
                                        })}"
                                        ?disabled="${this.queuedFiles.size === 0 ||
                                        this.queuedFilesTableCollapsible === false}"
                                        value="${i18n.t('qualified-pdf-upload.expand-all')}"
                                        @click="${() => {
                                            this.tableQueuedFilesTable.expandAll();
                                            this.queuedFilesTableExpanded = true;
                                        }}"
                                        title="${i18n.t('qualified-pdf-upload.expand-all')}">
                                        ${i18n.t('qualified-pdf-upload.expand-all')}
                                    </dbp-loading-button>

                                    <dbp-loading-button
                                        id="collapse-all-btn-queued-files"
                                        class="${classMap({
                                            hidden: !this.queuedFilesTableExpanded,
                                        })}"
                                        ?disabled="${this.queuedFiles.size === 0 ||
                                        this.queuedFilesTableCollapsible === false}"
                                        value="${i18n.t('qualified-pdf-upload.collapse-all')}"
                                        @click="${() => {
                                            this.tableQueuedFilesTable.collapseAll();
                                            this.queuedFilesTableExpanded = false;
                                        }}"
                                        title="${i18n.t('qualified-pdf-upload.collapse-all')}">
                                        ${i18n.t('qualified-pdf-upload.collapse-all')}
                                    </dbp-loading-button>

                                    <dbp-loading-button
                                        id="select-all-btn-queued-files"
                                        class="${classMap({
                                            hidden: this.queuedFilesTableAllSelected,
                                        })}"
                                        ?disabled="${this.queuedFiles.size === 0}"
                                        value="${i18n.t('qualified-pdf-upload.select-all')}"
                                        @click="${() => {
                                            this.queuedFilesTableAllSelected = true;
                                            this.tableQueuedFilesTable.selectAllRows();
                                        }}"
                                        title="${i18n.t('qualified-pdf-upload.select-all')}">
                                        ${i18n.t('qualified-pdf-upload.select-all')}
                                    </dbp-loading-button>

                                    <dbp-loading-button
                                        id="deselect-all-btn-queued-files"
                                        class="${classMap({
                                            hidden: !this.queuedFilesTableAllSelected,
                                        })}"
                                        ?disabled="${this.queuedFiles.size === 0}"
                                        value="${i18n.t('qualified-pdf-upload.deselect-all')}"
                                        @click="${() => {
                                            this.queuedFilesTableAllSelected = false;
                                            this.tableQueuedFilesTable.deselectAllRows();
                                        }}"
                                        title="${i18n.t('qualified-pdf-upload.deselect-all')}">
                                        ${i18n.t('qualified-pdf-upload.deselect-all')}
                                    </dbp-loading-button>
                                </div>
                                <div class="sign-actions">
                                    <!-- Buttons to start/stop signing process and clear queue -->
                                    <button
                                        id="clear-queue-button-queued-files"
                                        @click="${this.clearQueuedFiles}"
                                        ?disabled="${this.queuedFiles.size === 0 ||
                                        this.signingProcessActive ||
                                        this.selectedFiles.length < 1}"
                                        class="button">
                                        ${i18n.t('qualified-pdf-upload.clear-all')}
                                    </button>
                                    <button
                                        id="start-signing-button"
                                        @click="${() => {
                                            this.processSigningQueue();
                                        }}"
                                        ?disabled="${this.queuedFiles.size === 0}"
                                        class="button is-primary">
                                        ${i18n.t(
                                            'qualified-pdf-upload.start-signing-process-button',
                                        )}
                                    </button>
                                </div>
                            </div>
                            <!-- List of queued files -->
                            <div class="control file-list">
                                <dbp-esign-tabulator-table
                                    id="table-queued-files"
                                    identifier="table-queued-files"
                                    class="table-queued-files"
                                    lang="${this.lang}"
                                    select-rows-enabled></dbp-esign-tabulator-table>
                            </div>
                            ${this.anyPlacementMissing
                                ? html`
                                      <div class="legend">
                                          <dbp-icon
                                              name="warning-high"
                                              aria-hidden="true"></dbp-icon>
                                          <span class="legend-description">
                                              ${i18n.t('label-manual-positioning-missing')}
                                          </span>
                                      </div>
                                  `
                                : ''}
                            <!-- Text "queue empty" -->
                            <div
                                class="empty-queue control ${classMap({
                                    hidden: this.queuedFiles.size !== 0,
                                })}">
                                ${i18n.t('qualified-pdf-upload.queued-files-empty1')}
                                <br />
                                ${i18n.t('qualified-pdf-upload.queued-files-empty2')}
                            </div>
                        </div>
                        <!-- List of signed PDFs -->
                        <div
                            class="files-block signed-files field ${classMap({
                                hidden: this.signedFiles.size === 0,
                            })}">
                            <h3 class="section-title ">
                                ${i18n.t('qualified-pdf-upload.signed-files-label')}
                            </h3>
                            <!-- Button to download all signed PDFs -->
                            <div class="field ${classMap({hidden: this.signedFiles.size === 0})}">
                                <div class="control tabulator-actions">
                                    <div class="table-actions">
                                        <dbp-loading-button
                                            id="expand-all-btn-signed-files"
                                            class="${classMap({
                                                hidden: this.signedFilesTableExpanded,
                                            })}"
                                            ?disabled="${this.signedFiles.size === 0 ||
                                            this.signedFilesTableCollapsible === false}"
                                            value="${i18n.t('qualified-pdf-upload.expand-all')}"
                                            @click="${() => {
                                                this.tableSignedFilesTable.expandAll();
                                                this.signedFilesTableExpanded = true;
                                            }}"
                                            title="${i18n.t('qualified-pdf-upload.expand-all')}">
                                            ${i18n.t('qualified-pdf-upload.expand-all')}
                                        </dbp-loading-button>

                                        <dbp-loading-button
                                            id="collapse-all-btn-signed-files"
                                            class="${classMap({
                                                hidden: !this.signedFilesTableExpanded,
                                            })}"
                                            ?disabled="${this.signedFiles.size === 0 ||
                                            this.signedFilesTableCollapsible === false}"
                                            value="${i18n.t('qualified-pdf-upload.collapse-all')}"
                                            @click="${() => {
                                                this.tableSignedFilesTable.collapseAll();
                                                this.signedFilesTableExpanded = false;
                                            }}"
                                            title="${i18n.t('qualified-pdf-upload.collapse-all')}">
                                            ${i18n.t('qualified-pdf-upload.collapse-all')}
                                        </dbp-loading-button>
                                    </div>
                                    <div class="signed-actions">
                                        <button
                                            id="clear-signed-files-btn"
                                            class="clear-signed-files button"
                                            @click="${this.clearSignedFiles}"
                                            class="button">
                                            ${i18n.t('qualified-pdf-upload.clear-all')}
                                        </button>
                                        <dbp-loading-button
                                            id="zip-download-button"
                                            value="${i18n.t(
                                                'qualified-pdf-upload.download-zip-button',
                                            )}"
                                            title="${i18n.t(
                                                'qualified-pdf-upload.download-zip-button-tooltip',
                                            )}"
                                            class="zip-download-button"
                                            @click="${this.zipDownloadClickHandler}"
                                            type="is-primary"></dbp-loading-button>
                                    </div>
                                </div>
                            </div>
                            <dbp-esign-tabulator-table
                                id="table-signed-files"
                                identifier="table-signed-files"
                                class="table-signed-files"
                                lang="${this.lang}"></dbp-esign-tabulator-table>
                        </div>
                        <!-- List of errored files -->
                        <div
                            class="files-block error-files field ${classMap({
                                hidden: this.errorFiles.size === 0,
                            })}">
                            <h3 class="section-title">
                                ${i18n.t('qualified-pdf-upload.error-files-label')}
                            </h3>
                            <!-- Button to upload errored files again -->
                            <div class="field ${classMap({hidden: this.errorFiles.size === 0})}">
                                <div class="control tabulator-actions">
                                    <div class="table-actions">
                                        <dbp-loading-button
                                            id="expand-all-btn-failed-files"
                                            class="${classMap({
                                                hidden: this.failedFilesTableExpanded,
                                            })}"
                                            ?disabled="${this.errorFiles.size === 0 ||
                                            this.failedFilesTableCollapsible === false}"
                                            value="${i18n.t('qualified-pdf-upload.expand-all')}"
                                            @click="${() => {
                                                this.tableFailedFilesTable.expandAll();
                                                this.failedFilesTableExpanded = true;
                                            }}"
                                            title="${i18n.t('qualified-pdf-upload.expand-all')}">
                                            ${i18n.t('qualified-pdf-upload.expand-all')}
                                        </dbp-loading-button>

                                        <dbp-loading-button
                                            id="collapse-all-btn-failed-files"
                                            class="${classMap({
                                                hidden: !this.failedFilesTableExpanded,
                                            })}"
                                            ?disabled="${this.errorFiles.size === 0 ||
                                            this.failedFilesTableCollapsible === false}"
                                            value="${i18n.t('qualified-pdf-upload.collapse-all')}"
                                            @click="${() => {
                                                this.tableFailedFilesTable.collapseAll();
                                                this.failedFilesTableExpanded = false;
                                            }}"
                                            title="${i18n.t('qualified-pdf-upload.collapse-all')}">
                                            ${i18n.t('qualified-pdf-upload.collapse-all')}
                                        </dbp-loading-button>
                                    </div>
                                    <div class="failed-actions">
                                        <button
                                            id="clear-error-files-btn"
                                            @click="${this.clearErrorFiles}"
                                            class="clear-signed-files button">
                                            ${i18n.t('qualified-pdf-upload.clear-all')}
                                        </button>
                                        <dbp-loading-button
                                            id="re-upload-all-button"
                                            ?disabled="${this.signingProcessActive}"
                                            value="${i18n.t(
                                                'qualified-pdf-upload.re-upload-all-button',
                                            )}"
                                            title="${i18n.t(
                                                'qualified-pdf-upload.re-upload-all-button-title',
                                            )}"
                                            class="is-right"
                                            @click="${this.reUploadAllClickHandler}"
                                            type="is-primary"></dbp-loading-button>
                                    </div>
                                </div>
                            </div>
                            <dbp-esign-tabulator-table
                                id="table-failed-files"
                                identifier="table-failed-files"
                                class="table-failed-files"
                                lang="${this.lang}"></dbp-esign-tabulator-table>
                        </div>
                    </div>
                    <div class="modal-container">
                        <!-- PDF preview -->
                        <dbp-modal
                            id="pdf-preview"
                            modal-id="pdf-preview-modal"
                            class="modal--pdf-preview"
                            title="${this.withSigBlock
                                ? i18n.t('official-pdf-upload.signature-placement-label')
                                : i18n.t('official-pdf-upload.preview-label')}">
                            <div slot="header" class="header">
                                <div class="filename">
                                    <strong>${this.previewEntry?.file?.name ?? ''}</strong>
                                    (${humanFileSize(this.previewEntry?.file?.size ?? 0)})
                                </div>
                            </div>
                            <div slot="content">
                                <dbp-pdf-preview
                                    subscribe="auth"
                                    lang="${this.lang}"
                                    allow-signature-rotation
                                    signature-placeholder-image-src="${previewUrl}"
                                    preview-scale="0.375"
                                    profile-lang="${this.getLanguageOfSelectedProfile()}"
                                    ?signature-invisible="${this.getInvisibilityOfSelectedProfile()}"
                                    @dbp-pdf-preview-accept="${this.storePDFData}"
                                    @dbp-pdf-preview-cancel="${this.hidePDF}"></dbp-pdf-preview>
                            </div>
                        </dbp-modal>
                        <!-- Annotation view -->
                        <dbp-modal
                            id="annotation-view"
                            modal-id="annotation-view-modal"
                            class="modal--annotation-view ${classMap({
                                hidden: !this.isAnnotationViewVisible,
                            })}"
                            title="${i18n.t('qualified-pdf-upload.annotation-view-label')}">
                            <div slot="header" class="header">
                                <div class="modal-notification">
                                    <dbp-notification
                                        id="dbp-modal-notification-annotation"
                                        inline
                                        lang="${this.lang}"></dbp-notification>
                                </div>
                                <div class="filename">
                                    <strong>
                                        ${this.annotationEntry?.file !== undefined
                                            ? this.annotationEntry.file.name
                                            : ''}
                                    </strong>
                                    (${humanFileSize(
                                        this.annotationEntry?.file !== undefined
                                            ? this.annotationEntry.file.size
                                            : 0,
                                    )})
                                </div>
                            </div>
                            <div slot="content">
                                <dbp-pdf-annotation-view
                                    lang="${this.lang}"
                                    @dbp-pdf-annotations-save="${this.processAnnotationEvent}"
                                    @dbp-pdf-annotations-cancel="${this
                                        .processAnnotationCancelEvent}"></dbp-pdf-annotation-view>
                            </div>
                        </dbp-modal>
                        <!-- File upload progress -->
                        <div
                            id="upload-progress"
                            class="field notification is-info ${classMap({
                                hidden: !this.uploadInProgress,
                            })}">
                            <dbp-mini-spinner></dbp-mini-spinner>
                            ${this.uploadStatusText}
                        </div>
                        <!-- External auth -->
                        <dbp-modal
                            id="external-auth"
                            modal-id="external-auth-modal"
                            class="modal--external-auth ${classMap({
                                hidden: !this.externalAuthInProgress,
                            })}"
                            title="${i18n.t('qualified-pdf-upload.current-signing-process-label')}">
                            <div slot="content">
                                <external-sign-iframe
                                    id="iframe"
                                    @signature-error="${this._onIFrameError}"
                                    @signature-done="${this._onIFrameDone}"></external-sign-iframe>
                            </div>
                        </dbp-modal>
                    </div>
                </div>
            </div>
            <div
                class="notification is-warning ${classMap({
                    hidden: this.isLoggedIn() || this.isLoading(),
                })}">
                ${i18n.t('error-login-message')}
                <a href="#" @click="${this._onLoginClicked}">${i18n.t('error-login-link')}</a>
            </div>
            <div
                class="notification is-danger ${classMap({
                    hidden:
                        this.hasSignaturePermissions() || !this.isLoggedIn() || this.isLoading(),
                })}">
                ${i18n.t('error-permission-message-qualified')}
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
