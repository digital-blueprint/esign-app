import {css, html} from 'lit';
import {Button, LangMixin, ScopedElementsMixin} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {createInstance} from '../i18n.js';
import {SignatureDialog} from '../dbp-signature-dialog.js';
import {DEFAULT_SIGNATURE_OUTPUT} from '../dbp-signature-pad.js';

export class EsignPlaygroundSignature extends LangMixin(
    ScopedElementsMixin(DBPLitElement),
    createInstance,
) {
    constructor() {
        super();
        this._signatureImage = '';
        this._outputWidth = DEFAULT_SIGNATURE_OUTPUT.width;
        this._outputHeight = DEFAULT_SIGNATURE_OUTPUT.height;
        this._outputPadding = DEFAULT_SIGNATURE_OUTPUT.padding;
        this._outputStrokeScale = DEFAULT_SIGNATURE_OUTPUT.strokeScale;
    }

    static get properties() {
        return {
            ...super.properties,
            _signatureImage: {state: true},
            _outputWidth: {state: true},
            _outputHeight: {state: true},
            _outputPadding: {state: true},
            _outputStrokeScale: {state: true},
        };
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
            'dbp-signature-dialog': SignatureDialog,
        };
    }

    async openSignatureDialog() {
        const form = /** @type {HTMLFormElement|null} */ (
            this.shadowRoot?.querySelector('form') ?? null
        );
        if (!form?.reportValidity()) return;
        await this.updateComplete;
        const dialog = /** @type {SignatureDialog|null} */ (
            this.shadowRoot?.querySelector('dbp-signature-dialog') ?? null
        );
        await dialog?.open();
    }

    _handleSubmit(event) {
        event.preventDefault();
        void this.openSignatureDialog();
    }

    _handleOutputSizeInput(event) {
        const input = event.currentTarget;
        if (input.name === 'width') {
            this._outputWidth = input.valueAsNumber;
        } else if (input.name === 'height') {
            this._outputHeight = input.valueAsNumber;
        } else if (input.name === 'padding') {
            this._outputPadding = input.valueAsNumber;
        } else if (input.name === 'stroke-scale') {
            this._outputStrokeScale = input.valueAsNumber;
        }
    }

    _handleSignatureSave(event) {
        this._signatureImage = event.detail.dataUrl;
    }

    static get styles() {
        return css`
            ${commonStyles.getGeneralCSS()}

            :host {
                display: block;
            }

            .output-settings {
                display: flex;
                flex-wrap: wrap;
                align-items: flex-end;
                gap: 1rem;
                margin-bottom: 1rem;
            }

            .output-settings label {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
            }

            .output-settings input {
                box-sizing: border-box;
                width: 8rem;
            }

            .signature-preview {
                display: block;
                max-width: 100%;
                background: white;
                border: 1px solid var(--dbp-content, #333);
            }
        `;
    }

    render() {
        const i18n = this._i18n;
        return html`
            <section aria-labelledby="signature-heading">
                <h2 id="signature-heading">${i18n.t('esign-playground.signature-heading')}</h2>
                <form class="output-settings" @submit="${this._handleSubmit}">
                    <label>
                        ${i18n.t('esign-playground.output-width')}
                        <input
                            class="input"
                            type="number"
                            name="width"
                            min="1"
                            step="1"
                            required
                            .value="${Number.isFinite(this._outputWidth) ? String(this._outputWidth) : ''}"
                            @input="${this._handleOutputSizeInput}" />
                    </label>
                    <label>
                        ${i18n.t('esign-playground.output-height')}
                        <input
                            class="input"
                            type="number"
                            name="height"
                            min="1"
                            step="1"
                            required
                            .value="${Number.isFinite(this._outputHeight) ? String(this._outputHeight) : ''}"
                            @input="${this._handleOutputSizeInput}" />
                    </label>
                    <label>
                        ${i18n.t('esign-playground.output-padding')}
                        <input
                            class="input"
                            type="number"
                            name="padding"
                            min="0"
                            step="1"
                            required
                            .value="${Number.isFinite(this._outputPadding) ? String(this._outputPadding) : ''}"
                            @input="${this._handleOutputSizeInput}" />
                    </label>
                    <label>
                        ${i18n.t('esign-playground.output-stroke-scale')}
                        <input
                            class="input"
                            type="number"
                            name="stroke-scale"
                            min="0.1"
                            step="0.1"
                            required
                            .value="${Number.isFinite(this._outputStrokeScale) ? String(this._outputStrokeScale) : ''}"
                            @input="${this._handleOutputSizeInput}" />
                    </label>
                    <dbp-button
                        type="is-primary"
                        no-spinner-on-click
                        @click="${this.openSignatureDialog}">
                        ${i18n.t('esign-playground.sign')}
                    </dbp-button>
                </form>
                <dbp-signature-dialog
                    lang="${this.lang}"
                    .outputWidth="${this._outputWidth}"
                    .outputHeight="${this._outputHeight}"
                    .outputPadding="${this._outputPadding}"
                    .outputStrokeScale="${this._outputStrokeScale}"
                    @dbp-signature-dialog-save="${this._handleSignatureSave}"></dbp-signature-dialog>
                <div aria-live="polite">
                    ${
                        this._signatureImage
                            ? html`
                                  <img
                                      class="signature-preview"
                                      src="${this._signatureImage}"
                                      alt="${i18n.t('esign-playground.signature-image-alt')}" />
                              `
                            : ''
                    }
                </div>
            </section>
        `;
    }
}
