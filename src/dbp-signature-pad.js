import {css, html} from 'lit';
import SignaturePad from 'signature_pad';
import {LangMixin} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {createInstance} from './i18n.js';

export const DEFAULT_SIGNATURE_OUTPUT = Object.freeze({
    width: 300,
    height: 100,
    padding: 6,
    strokeScale: 1,
});

/**
 * Signature Pad wrapper with separate drawing and export resolutions.
 * Cropping reads a bitmap copy to avoid slowing the live canvas. Export replays
 * scaled stroke coordinates at the requested resolution instead of enlarging pixels,
 * preserving the output aspect ratio and padding. Export retains the original
 * speed-dependent width variation, adjusted with a single multiplier.
 */
export class SignaturePadElement extends LangMixin(DBPLitElement, createInstance) {
    constructor() {
        super();
        this._empty = true;
        this.outputWidth = DEFAULT_SIGNATURE_OUTPUT.width;
        this.outputHeight = DEFAULT_SIGNATURE_OUTPUT.height;
        this.outputPadding = DEFAULT_SIGNATURE_OUTPUT.padding;
        this.outputStrokeScale = DEFAULT_SIGNATURE_OUTPUT.strokeScale;
        /** @type {SignaturePad|null} */
        this._signaturePad = null;
        /** @type {ResizeObserver|null} */
        this._resizeObserver = null;
        this._canvasWidth = 0;
        this._canvasHeight = 0;
        this._resizeCanvas = this.resizeCanvas.bind(this);
        this._handleStrokeBegin = this._handleStrokeBegin.bind(this);
        this._handleStrokeEnd = this._handleStrokeEnd.bind(this);
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

    connectedCallback() {
        super.connectedCallback();
        void this.updateComplete.then(() => {
            if (!this.isConnected) return;
            const canvas = this.canvas;
            if (!canvas) return;
            if (!this._signaturePad) {
                this._signaturePad = new SignaturePad(canvas, {minWidth: 1.875, maxWidth: 3.125});
                this._signaturePad.addEventListener('beginStroke', this._handleStrokeBegin);
                this._signaturePad.addEventListener('endStroke', this._handleStrokeEnd);
            } else {
                this._signaturePad.on();
            }
            this._resizeObserver = new ResizeObserver(this._resizeCanvas);
            this._resizeObserver.observe(canvas);
            window.addEventListener('resize', this._resizeCanvas);
            this.resizeCanvas();
        });
    }

    disconnectedCallback() {
        this._signaturePad?.off();
        this._resizeObserver?.disconnect();
        window.removeEventListener('resize', this._resizeCanvas);
        super.disconnectedCallback();
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('outputWidth') || changedProperties.has('outputHeight')) {
            this.resizeCanvas();
        }
    }

    /** Requested PNG dimensions, falling back to defaults for invalid configuration. */
    get outputSize() {
        const dimension = (value, fallback) =>
            Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : fallback;
        return {
            width: dimension(this.outputWidth, DEFAULT_SIGNATURE_OUTPUT.width),
            height: dimension(this.outputHeight, DEFAULT_SIGNATURE_OUTPUT.height),
        };
    }

    get canvas() {
        return /** @type {HTMLCanvasElement|null} */ (
            this.shadowRoot?.querySelector('canvas') ?? null
        );
    }

    /** Resize for high-DPI screens, scaling stored strokes instead of losing them. */
    resizeCanvas() {
        const canvas = this.canvas;
        const pad = this._signaturePad;
        if (!canvas || !pad) return;
        const {width, height} = canvas.getBoundingClientRect();
        // A canvas inside a closed modal has no size. Wait until it becomes visible.
        if (width <= 0 || height <= 0) return;
        // Keep live drawing resolution independent of the requested export size.
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const pixelWidth = Math.ceil(width * ratio);
        const pixelHeight = Math.ceil(height * ratio);
        if (
            canvas.width === pixelWidth &&
            canvas.height === pixelHeight &&
            this._canvasWidth === width &&
            this._canvasHeight === height
        ) {
            return;
        }

        const scaleX = this._canvasWidth ? width / this._canvasWidth : 1;
        const scaleY = this._canvasHeight ? height / this._canvasHeight : 1;
        const data = pad.toData().map((group) => ({
            ...group,
            points: group.points.map((point) => ({
                ...point,
                x: point.x * scaleX,
                y: point.y * scaleY,
            })),
        }));
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.getContext('2d')?.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
        this._canvasWidth = width;
        this._canvasHeight = height;
        // Stop active input before replay; clear() alone leaves its drawing flag set.
        pad.off();
        pad.fromData(data);
        pad.on();
        this._empty = pad.isEmpty();
    }

    clear() {
        this._signaturePad?.clear();
        this._notifyChange();
    }

    isEmpty() {
        return this._signaturePad?.isEmpty() ?? true;
    }

    /** @returns {string|null} A transparent PNG data URL, or null for an empty canvas. */
    toDataURL() {
        if (this.isEmpty()) return null;
        this.resizeCanvas();
        const liveCanvas = this.canvas;
        if (!liveCanvas) return null;
        const prepared = this._prepareExport(liveCanvas);
        if (!prepared) return null;
        const image = this._renderExportCanvas(prepared);
        return image?.toDataURL('image/png') ?? null;
    }

    /** Collect crop bounds and output settings, then transform the stored strokes. */
    _prepareExport(liveCanvas) {
        const data = this._signaturePad?.toData().filter((group) => group.points.length > 0);
        if (!data?.length) return null;
        const bounds = this._getExportBounds(liveCanvas);
        if (!bounds) return null;
        const output = this.outputSize;
        const configuredPadding =
            Number.isFinite(this.outputPadding) && this.outputPadding >= 0
                ? Math.round(this.outputPadding)
                : DEFAULT_SIGNATURE_OUTPUT.padding;
        const padding = Math.min(
            configuredPadding,
            (Math.min(output.width, output.height) - 1) / 2,
        );
        const strokeScale =
            Number.isFinite(this.outputStrokeScale) && this.outputStrokeScale > 0
                ? this.outputStrokeScale
                : DEFAULT_SIGNATURE_OUTPUT.strokeScale;
        return this._transformExportData(data, bounds, output, padding, strokeScale);
    }

    /** Detect visible ink on a bitmap copy and convert its bounds to drawing coordinates. */
    _getExportBounds(liveCanvas) {
        // Read pixels from a copy so the live canvas can retain accelerated rendering.
        const canvas = document.createElement('canvas');
        canvas.width = liveCanvas.width;
        canvas.height = liveCanvas.height;
        const copyContext = canvas.getContext('2d', {willReadFrequently: true});
        if (!copyContext) return null;
        copyContext.drawImage(liveCanvas, 0, 0);
        const pixels = this._getInkBounds(canvas);
        if (!pixels) return null;
        // Work in drawing coordinates so points and times can use one uniform scale.
        const ratioX = canvas.width / this._canvasWidth;
        const ratioY = canvas.height / this._canvasHeight;
        return {
            x: pixels.x / ratioX,
            y: pixels.y / ratioY,
            width: pixels.width / ratioX,
            height: pixels.height / ratioY,
        };
    }

    /** Fit and center the crop, preserving stroke velocities and scaling pen widths. */
    _transformExportData(data, bounds, output, padding, strokeScale) {
        const maximumRadius = data.reduce(
            (maximum, group) =>
                Math.max(maximum, group.maxWidth * strokeScale, group.dotSize * strokeScale),
            0,
        );
        // Reserve space for the exported stroke radius as well as the requested padding.
        const inset = Math.min(
            padding + maximumRadius,
            (Math.min(output.width, output.height) - 1) / 2,
        );
        const scale = Math.min(
            (output.width - 2 * inset) / bounds.width,
            (output.height - 2 * inset) / bounds.height,
        );
        const offsetX = (output.width - bounds.width * scale) / 2;
        const offsetY = (output.height - bounds.height * scale) / 2;
        // Intersect output padding with the original canvas to keep outside ink clipped.
        const left = Math.max(padding, offsetX - bounds.x * scale);
        const top = Math.max(padding, offsetY - bounds.y * scale);
        const right = Math.min(
            output.width - padding,
            offsetX + (this._canvasWidth - bounds.x) * scale,
        );
        const bottom = Math.min(
            output.height - padding,
            offsetY + (this._canvasHeight - bounds.y) * scale,
        );
        return {
            output,
            clip: {
                x: left,
                y: top,
                width: Math.max(0, right - left),
                height: Math.max(0, bottom - top),
            },
            data: data.map((group) => ({
                ...group,
                minWidth: group.minWidth * strokeScale,
                maxWidth: group.maxWidth * strokeScale,
                dotSize: group.dotSize * strokeScale,
                points: group.points.map((point) => ({
                    ...point,
                    x: offsetX + (point.x - bounds.x) * scale,
                    y: offsetY + (point.y - bounds.y) * scale,
                    // Scaling time with distance preserves the original drawing velocity.
                    // Signature Pad treats zero as a missing timestamp.
                    time: 1 + (point.time - group.points[0].time) * scale,
                })),
            })),
        };
    }

    /** Let Signature Pad draw the prepared data directly at the output resolution. */
    _renderExportCanvas({output, clip, data}) {
        const image = document.createElement('canvas');
        image.width = output.width;
        image.height = output.height;
        const context = image.getContext('2d');
        if (!context) return null;
        context.beginPath();
        context.rect(clip.x, clip.y, clip.width, clip.height);
        context.clip();
        const pad = new SignaturePad(image);
        pad.off();
        pad.fromData(data);
        return image;
    }

    /** Find visible ink in the bitmap; the canvas background and hint are CSS only. */
    _getInkBounds(canvas) {
        const context = canvas.getContext('2d');
        if (!context) return null;
        const {width, height} = canvas;
        const {data} = context.getImageData(0, 0, width, height);
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (data[(y * width + x) * 4 + 3] === 0) continue;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
        if (maxX < 0) return null;
        return {x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1};
    }

    _handleStrokeBegin() {
        this._empty = false;
    }

    _handleStrokeEnd() {
        this._notifyChange();
    }

    _notifyChange() {
        this._empty = this.isEmpty();
        this.dispatchEvent(
            new CustomEvent('dbp-signature-pad-change', {
                detail: {empty: this._empty},
                bubbles: true,
                composed: true,
            }),
        );
    }

    static get styles() {
        return css`
            :host {
                display: block;
                min-width: 0;
            }

            .canvas-wrapper {
                position: relative;
            }

            .hint {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #666;
                font-size: 1.2rem;
                pointer-events: none;
                user-select: none;
            }

            canvas {
                display: block;
                box-sizing: border-box;
                width: 100%;
                height: auto;
                box-shadow: inset 0 0 0 1px var(--dbp-content, #333);
                background: white;
                touch-action: none;
                user-select: none;
                cursor: crosshair;
            }
        `;
    }

    render() {
        const label = this._i18n.t('signature-pad.canvas-label');
        const output = this.outputSize;
        return html`
            <div class="canvas-wrapper">
                <canvas
                    style="aspect-ratio: ${output.width} / ${output.height}"
                    role="img"
                    aria-label="${label}">
                    ${label}
                </canvas>
                ${
                    this._empty
                        ? html`
                              <span class="hint" aria-hidden="true">
                                  ${this._i18n.t('signature-pad.hint')}
                              </span>
                          `
                        : ''
                }
            </div>
        `;
    }
}
