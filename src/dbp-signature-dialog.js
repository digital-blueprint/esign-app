import {css, html} from 'lit';
import {Button, LangMixin, Modal, ScopedElementsMixin} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {DEFAULT_SIGNATURE_OUTPUT, SignaturePadElement} from './dbp-signature-pad.js';
import {createInstance} from './i18n.js';

/** Modal signature capture. Emits a PNG on confirmation, never on cancellation. */
export class SignatureDialog extends LangMixin(ScopedElementsMixin(DBPLitElement), createInstance) {
    constructor() {
        super();
        this._empty = true;
        this._sessionActive = false;
        this.outputWidth = DEFAULT_SIGNATURE_OUTPUT.width;
        this.outputHeight = DEFAULT_SIGNATURE_OUTPUT.height;
        this.outputPadding = DEFAULT_SIGNATURE_OUTPUT.padding;
        this.outputStrokeScale = DEFAULT_SIGNATURE_OUTPUT.strokeScale;
    }

    static get properties() {
        return {
            ...super.properties,
            _empty: {state: true},
            outputWidth: {type: Number, attribute: 'output-width'},
            outputHeight: {type: Number, attribute: 'output-height'},
            outputPadding: {type: Number, attribute: 'output-padding'},
            outputStrokeScale: {type: Number, attribute: 'output-stroke-scale'},
        };
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
            'dbp-modal': Modal,
            'dbp-signature-pad': SignaturePadElement,
        };
    }

    get modal() {
        return /** @type {Modal|null} */ (this.shadowRoot?.querySelector('dbp-modal') ?? null);
    }

    get pad() {
        return /** @type {SignaturePadElement|null} */ (
            this.shadowRoot?.querySelector('dbp-signature-pad') ?? null
        );
    }

    /** Open a fresh signing session. Safe to call before the first render finishes. */
    async open() {
        await this.updateComplete;
        const modal = this.modal;
        const pad = this.pad;
        if (!modal || !pad || !this.isConnected) return;
        await Promise.all([modal.updateComplete, pad.updateComplete]);
        if (!this.isConnected || modal.isOpen()) return;
        pad.clear();
        this._sessionActive = true;
        modal.open();
        pad.resizeCanvas();
    }

    /** Close without submitting, also used by the Cancel button. */
    close() {
        this._cancelSession();
        this.modal?.close();
    }

    clear() {
        this.pad?.clear();
    }

    confirm() {
        if (!this._sessionActive) return;
        const dataUrl = this.pad?.toDataURL();
        if (!dataUrl) return;
        this._sessionActive = false;
        this.modal?.close();
        this.dispatchEvent(
            new CustomEvent('dbp-signature-dialog-save', {
                detail: {dataUrl},
                bubbles: true,
                composed: true,
            }),
        );
    }

    _cancelSession() {
        if (!this._sessionActive) return;
        this._sessionActive = false;
        this.dispatchEvent(
            new CustomEvent('dbp-signature-dialog-cancel', {bubbles: true, composed: true}),
        );
    }

    _handleChange(event) {
        this._empty = event.detail.empty;
    }

    _handleModalClosed(event) {
        // Ignore close events from any unrelated nested modal.
        if (event.detail.id !== 'signature-capture-modal') return;
        // Native close events are queued; an immediate reopen starts a new session.
        if (this.modal?.isOpen()) return;
        this._cancelSession();
    }

    disconnectedCallback() {
        this.close();
        super.disconnectedCallback();
    }

    static get styles() {
        return css`
            ${commonStyles.getGeneralCSS()}

            dbp-modal {
                /* Leave room for the modal's horizontal padding and viewport margins. */
                --dbp-modal-max-width: min(calc(100vw - 64px), 650px);
                --dbp-modal-min-width: min(calc(100vw - 64px), 650px);
                --dbp-modal-min-height: 0;
                --dbp-modal-max-height: max(1px, calc(100dvh - 48px));
                --dbp-modal-full-height-line-display: none;
                --dbp-modal-content-min-height: 0;
                --dbp-modal-content-slot-min-height: 0;
                --dbp-modal-slotted-content-min-height: 0;
            }

            @media (max-height: 400px) {
                dbp-modal {
                    /* Fill the viewport, accounting for the modal's vertical padding. */
                    --dbp-modal-min-height: max(1px, calc(100dvh - 35px));
                    --dbp-modal-max-height: max(1px, calc(100dvh - 35px));
                    --dbp-modal-container-height: calc(100dvh - 35px);
                    --dbp-modal-content-slot-height: 100%;
                    --dbp-modal-slotted-content-height: 100%;
                    --dbp-modal-content-overflow-y: auto;
                }

                .content {
                    display: flex;
                    flex-direction: column;
                }

                .content dbp-signature-pad {
                    flex: 1;
                    min-height: 0;
                    --dbp-signature-pad-height: 100%;
                    --dbp-signature-pad-container-type: size;
                    /* Fit the output proportions into the actual remaining height. */
                    --dbp-signature-pad-max-height: 100cqh;
                }
            }

            .instructions {
                margin: 0 0 0.75rem;
            }

            dbp-signature-pad {
                /* Reserve approximate space for the title, instructions, buttons and padding. */
                --dbp-signature-pad-max-height: max(1px, calc(100dvh - 260px));
            }

            .actions {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5em;
                padding-top: 1rem;
            }

            .actions dbp-button[type='is-primary'] {
                margin-left: auto;
            }
        `;
    }

    render() {
        const i18n = this._i18n;
        return html`
            <dbp-modal
                modal-id="signature-capture-modal"
                sticky-footer
                full-height-line
                lang="${this.lang}"
                title="${i18n.t('signature-dialog.title')}"
                @dbp-modal-closed="${this._handleModalClosed}">
                <div slot="content" class="content">
                    <p class="instructions">${i18n.t('signature-dialog.instructions')}</p>
                    <dbp-signature-pad
                        lang="${this.lang}"
                        .outputWidth="${this.outputWidth}"
                        .outputHeight="${this.outputHeight}"
                        .outputPadding="${this.outputPadding}"
                        .outputStrokeScale="${this.outputStrokeScale}"
                        @dbp-signature-pad-change="${this._handleChange}"></dbp-signature-pad>
                </div>
                <div slot="footer" class="actions">
                    <dbp-button
                        type="is-secondary"
                        no-spinner-on-click
                        ?disabled="${this._empty}"
                        @click="${this.clear}">
                        ${i18n.t('signature-dialog.clear')}
                    </dbp-button>
                    <dbp-button type="is-secondary" no-spinner-on-click @click="${this.close}">
                        ${i18n.t('button-cancel-text')}
                    </dbp-button>
                    <dbp-button
                        type="is-primary"
                        no-spinner-on-click
                        ?disabled="${this._empty}"
                        @click="${this.confirm}">
                        ${i18n.t('signature-dialog.confirm')}
                    </dbp-button>
                </div>
            </dbp-modal>
        `;
    }
}
