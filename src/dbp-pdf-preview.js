import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import {classMap} from 'lit-html/directives/class-map.js';
import {live} from 'lit-html/directives/live.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {MiniSpinner, Icon} from '@dbp-toolkit/common';
import * as commonUtils from "@dbp-toolkit/common/utils";
import * as commonStyles from '@dbp-toolkit/common/styles';
import pdfjs from 'pdfjs-dist/es5/build/pdf.js';
import buildinfo from 'consts:buildinfo';
import {name as pkgName} from './../package.json';
import {readBinaryFileContent} from './utils.js';

const i18n = createI18nInstance();

/**
 * PdfPreview web component
 */
export class PdfPreview extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this.lang = 'de';
        this.pdfDoc = null;
        this.currentPage = 0;
        this.totalPages = 0;
        this.isShowPage = false;
        this.isPageLoaded = false;
        this.isPageRenderingInProgress = false;
        this.isShowPlacement = true;
        this.canvas = null;
        this.fabricCanvas = null;
        this.canvasToPdfScale = 1.0;
        this.currentPageOriginalHeight = 0;
        this.placeholder = '';
        this.signature_width = 42;
        this.signature_height = 42;
        this.border_width = 2;

        this._onWindowResize = this._onWindowResize.bind(this);
    }

    static get scopedElements() {
        return {
            'dbp-mini-spinner': MiniSpinner,
            'dbp-icon': Icon,
        };
    }

    /**
     * See: https://lit-element.polymer-project.org/guide/properties#initialize
     */
    static get properties() {
        return this.getProperties({
            lang: { type: String },
            currentPage: { type: Number, attribute: false },
            totalPages: { type: Number, attribute: false },
            isShowPage: { type: Boolean, attribute: false },
            isPageRenderingInProgress: { type: Boolean, attribute: false },
            isPageLoaded: { type: Boolean, attribute: false },
            isShowPlacement: { type: Boolean, attribute: false },
            placeholder: { type: String, attribute: 'signature-placeholder-image-src' },
            signature_width: { type: Number, attribute: 'signature-width' },
            signature_height: { type: Number, attribute: 'signature-height' },
        });
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "lang":
                    i18n.changeLanguage(this.lang);
                    break;
            }
        });

        super.update(changedProperties);
    }

    _onWindowResize() {
        this.showPage(this.currentPage);
    }

    disconnectedCallback() {
        window.removeEventListener('resize', this._onWindowResize);
        super.disconnectedCallback();
      }

    connectedCallback() {
        super.connectedCallback();
        const that = this;
        pdfjs.GlobalWorkerOptions.workerSrc = commonUtils.getAssetURL(pkgName, 'pdfjs/pdf.worker.js');

        window.addEventListener('resize', this._onWindowResize);

        this.updateComplete.then(async () => {
            const fabric = (await import('fabric')).fabric;
            that.canvas = that._('#pdf-canvas');

            // this._('#upload-pdf-input').addEventListener('change', function() {
            //     that.showPDF(this.files[0]);
            // });

            // add fabric.js canvas for signature positioning
            // , {stateful : true}
            // selection is turned off because it makes troubles on mobile devices
            this.fabricCanvas = new fabric.Canvas(this._('#fabric-canvas'), {
                selection: false,
                allowTouchScrolling: true,
            });

            // add signature image
            fabric.Image.fromURL(this.placeholder, function(image) {
                // add a red border around the signature placeholder
                image.set({stroke: "#e4154b", strokeWidth: that.border_width, strokeUniform: true, centeredRotation: true});

                // disable controls, we currently don't want resizing and do rotation with a button
                image.hasControls = false;

                // we will resize the image when the initial pdf page is loaded
                that.fabricCanvas.add(image);
            });

            this.fabricCanvas.on({
                'object:moving': function(e) {
                  e.target.opacity = 0.5;
                },
                'object:modified': function(e) {
                  e.target.opacity = 1;
                }
            });

            // this.fabricCanvas.on("object:moved", function(opt){ console.log(opt); });

            // disallow moving of signature outside of canvas boundaries
            this.fabricCanvas.on('object:moving', function (e) {
                let obj = e.target;
                obj.setCoords();
                that.enforceCanvasBoundaries(obj);
            });

            // TODO: prevent scaling the signature in a way that it is crossing the canvas boundaries
            // it's very hard to calculate the way back from obj.scaleX and obj.translateX
            // obj.getBoundingRect() will not be updated in the object:scaling event, it is only updated after the scaling is done
            // this.fabricCanvas.observe('object:scaling', function (e) {
            //     let obj = e.target;
            //
            //     console.log(obj);
            //     console.log(obj.scaleX);
            //     console.log(obj.translateX);
            // });
        });
    }

    enforceCanvasBoundaries(obj) {
        // top-left corner
        if (obj.getBoundingRect().top < 0 || obj.getBoundingRect().left < 0) {
            obj.top = Math.max(obj.top, obj.top - obj.getBoundingRect().top);
            obj.left = Math.max(obj.left, obj.left - obj.getBoundingRect().left);
        }

        // bottom-right corner
        if (obj.getBoundingRect().top + obj.getBoundingRect().height > obj.canvas.height ||
            obj.getBoundingRect().left + obj.getBoundingRect().width > obj.canvas.width) {
            obj.top = Math.min(obj.top, obj.canvas.height - obj.getBoundingRect().height + obj.top - obj.getBoundingRect().top);
            obj.left = Math.min(obj.left, obj.canvas.width - obj.getBoundingRect().width + obj.left - obj.getBoundingRect().left);
        }
    }

    async onPageNumberChanged(e) {
        let obj = e.target;
        const page_no = parseInt(obj.value);
        console.log('page_no = ', page_no);

        if (page_no > 0 && page_no <= this.totalPages) {
            await this.showPage(page_no);
        }
    }

    /**
     * Initialize and load the PDF
     *
     * @param file
     * @param isShowPlacement
     * @param placementData
     */
    async showPDF(file, isShowPlacement = false, placementData = {}) {
        let item = this.getSignatureRect();
        this.isPageLoaded = false; // prevent redisplay of previous pdf

        // move signature if placementData was set
        if (item !== undefined) {
            if (placementData["scaleX"] !== undefined) {
                item.set("scaleX", placementData["scaleX"] * this.canvasToPdfScale);
            }
            if (placementData["scaleY"] !== undefined) {
                item.set("scaleY", placementData["scaleY"] * this.canvasToPdfScale);
            }
            if (placementData["left"] !== undefined) {
                item.set("left", placementData["left"] * this.canvasToPdfScale);
            }
            if (placementData["top"] !== undefined) {
                item.set("top", placementData["top"] * this.canvasToPdfScale);
            }
            if (placementData["angle"] !== undefined) {
                item.set("angle", placementData["angle"]);
            }
        }

        this.isShowPlacement = isShowPlacement;
        this.isShowPage = true;

        const data = await readBinaryFileContent(file);

        // get handle of pdf document
        try {
            this.pdfDoc = await pdfjs.getDocument({data: data}).promise;
        } catch (error) {
            console.error(error);
            return;
        }

        // total pages in pdf
        this.totalPages = this.pdfDoc.numPages;
        const page = placementData.currentPage || 1;

        // show the first page
        // if the placementData has no values we want to initialize the signature position
        await this.showPage(page, placementData["scaleX"] === undefined);

        this.isPageLoaded = true;

        // fix width adaption after "this.isPageLoaded = true"
        await this.showPage(page);
    }

    getSignatureRect() {
        return this.fabricCanvas.item(0);
    }

    /**
     * Load and render specific page of the PDF
     *
     * @param pageNumber
     * @param initSignature
     */
    async showPage(pageNumber, initSignature = false) {
        // we need to wait until the last rendering is finished
        if (this.isPageRenderingInProgress || this.pdfDoc === null) {
            return;
        }

        const that = this;
        this.isPageRenderingInProgress = true;
        this.currentPage = pageNumber;

        try {
            // get handle of page
            await this.pdfDoc.getPage(pageNumber).then(async (page) => {
                // original width of the pdf page at scale 1
                const originalViewport = page.getViewport({ scale: 1 });
                this.currentPageOriginalHeight = originalViewport.height;

                // set the canvas width to the width of the container (minus the borders)
                this.fabricCanvas.setWidth(this._('#pdf-main-container').clientWidth - 2);
                this.canvas.width = this._('#pdf-main-container').clientWidth - 2;

                // as the canvas is of a fixed width we need to adjust the scale of the viewport where page is rendered
                const oldScale = this.canvasToPdfScale;
                this.canvasToPdfScale = this.canvas.width / originalViewport.width;

                console.log("this.canvasToPdfScale: " + this.canvasToPdfScale);

                // get viewport to render the page at required scale
                const viewport = page.getViewport({ scale: this.canvasToPdfScale });

                // set canvas height same as viewport height
                this.fabricCanvas.setHeight(viewport.height);
                this.canvas.height = viewport.height;

                // setting page loader height for smooth experience
                this._("#page-loader").style.height =  this.canvas.height + 'px';
                this._("#page-loader").style.lineHeight = this.canvas.height + 'px';

                // page is rendered on <canvas> element
                const render_context = {
                    canvasContext: this.canvas.getContext('2d'),
                    viewport: viewport
                };

                let signature = this.getSignatureRect();

                // set the initial position of the signature
                if (initSignature) {
                    const sigSizeMM = {width: this.signature_width, height: this.signature_height};
                    const sigPosMM = {top: 5, left: 5};

                    const inchPerMM = 0.03937007874;
                    const DPI = 72;
                    const pointsPerMM = inchPerMM * DPI;
                    const documentSizeMM = {
                        width: originalViewport.width / pointsPerMM,
                        height: originalViewport.height / pointsPerMM,
                    };

                    const sigSize = signature.getOriginalSize();
                    const scaleX = (this.canvas.width / sigSize.width) * (sigSizeMM.width / documentSizeMM.width);
                    const scaleY = (this.canvas.height / sigSize.height) * (sigSizeMM.height / documentSizeMM.height);
                    const offsetTop = sigPosMM.top * pointsPerMM;
                    const offsetLeft = sigPosMM.left * pointsPerMM;

                    signature.set({
                        scaleX: scaleX,
                        scaleY: scaleY,
                        angle: 0,
                        top: offsetTop,
                        left: offsetLeft,
                        lockUniScaling: true  // lock aspect ratio when resizing
                    });
                } else {
                    // adapt signature scale to new scale
                    const scaleAdapt = this.canvasToPdfScale / oldScale;

                    signature.set({
                        scaleX: signature.get("scaleX") * scaleAdapt,
                        scaleY: signature.get("scaleY") * scaleAdapt,
                        left: signature.get("left") * scaleAdapt,
                        top: signature.get("top") * scaleAdapt
                    });

                    signature.setCoords();
                }

                // render the page contents in the canvas
                try {
                    await page.render(render_context).promise.then(() => {
                        console.log('Page rendered');
                        that.isPageRenderingInProgress = false;
                    });
                } catch(error) {
                    console.error(error.message);
                    that.isPageRenderingInProgress = false;
                }
            });
        } catch(error) {
            console.error(error.message);
            that.isPageRenderingInProgress = false;
        }
    }

    sendAcceptEvent() {
        const item = this.getSignatureRect();
        let left = item.get("left");
        let top = item.get("top");
        const angle = item.get("angle");

        // fabricjs includes the stroke in the image position
        // and we have to remove it
        const border_offset = (this.border_width / 2);
        if (angle === 0) {
            left += border_offset;
            top += border_offset;
        } else if (angle === 90) {
            left -= border_offset;
            top += border_offset;
        } else if (angle === 180) {
            left -= border_offset;
            top -= border_offset;
        } else if (angle === 270) {
            left += border_offset;
            top -= border_offset;
        }

        const data = {
            "currentPage": this.currentPage,
            "scaleX": item.get("scaleX") / this.canvasToPdfScale,
            "scaleY": item.get("scaleY") / this.canvasToPdfScale,
            "width": item.get("width") * item.get("scaleX") / this.canvasToPdfScale,
            "height": item.get("height") * item.get("scaleY") / this.canvasToPdfScale,
            "left": left / this.canvasToPdfScale,
            "top": top / this.canvasToPdfScale,
            "bottom": this.currentPageOriginalHeight - (top / this.canvasToPdfScale),
            "angle": item.get("angle")
        };
        const event = new CustomEvent("dbp-pdf-preview-accept",
            { "detail": data, bubbles: true, composed: true });
        this.dispatchEvent(event);
    }

    sendCancelEvent() {
        const event = new CustomEvent("dbp-pdf-preview-cancel",
            { "detail": {}, bubbles: true, composed: true });
        this.dispatchEvent(event);
    }

    /**
     * Rotates the signature clock-wise in 90� steps
     */
    async rotateSignature() {
        let signature = this.getSignatureRect();
        let angle = (signature.get("angle") + 90) % 360;
        signature.rotate(angle);
        signature.setCoords();
        this.enforceCanvasBoundaries(signature);

        // update page to show rotated signature
        await this.showPage(this.currentPage);
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getGeneralCSS()}
            ${commonStyles.getButtonCSS()}

            #pdf-meta input[type=number]{
                max-width: 50px;
            }

            #page-loader {
                display:flex;
                align-items: center;
                justify-content: center;
            }

            /* it's too risky to adapt the height */
            /*
            #pdf-meta button, #pdf-meta input {
                max-height: 15px;
            }
            */

            #canvas-wrapper {
                position: relative;
            }

            #canvas-wrapper canvas {
                position: absolute;
                top: 0;
                left: 0;
                border: solid 1px black;
                border-top-color: #888;
            }

            .buttons {
                display: flex;
                flex-wrap: wrap;
                width: 100%;
                justify-content: center;
                align-items: center;
            }

            .nav-buttons {
                display: flex;
                justify-content: center;
                flex-grow: 1;
                flex-wrap: wrap;
            }

            .buttons .page-info {
                align-self: center;
                white-space: nowrap;
            }

            .nav-buttons > * {
                margin: 2px;
            }

            input[type=number] {
                border: 1px solid #000;
                padding: 0 0.3em;
            }

            #pdf-meta {
                border-color: #000;
                border-width: 1px;
                border-style: solid;
                padding: 0.54em;
                border-bottom-width: 0;
                border-top-width: 0;
            }

            .button.is-cancel {
                color: #e4154b;
            }
        `;
    }

    render() {
        const isRotationHidden = (buildinfo.env === 'production');

        return html`

<!--
            <form>
                <input type="file" name="pdf" id="upload-pdf-input">
            </form>
-->
            <div id="pdf-main-container" class="${classMap({hidden: !this.isShowPage})}">
                <dbp-mini-spinner class="${classMap({hidden: this.isPageLoaded})}"></dbp-mini-spinner>
                <div class="${classMap({hidden: !this.isPageLoaded})}">
                    <div id="pdf-meta">
                        <div class="buttons ${classMap({hidden: !this.isPageLoaded})}">
                            <button class="button ${classMap({hidden: !this.isShowPlacement || isRotationHidden})}"
                                    title="${i18n.t('pdf-preview.rotate-signature')}"
                                    @click="${() => { this.rotateSignature(); } }"
                                    ?disabled="${this.isPageRenderingInProgress}">&#10227; ${i18n.t('pdf-preview.rotate')}</button>
                            <div class="nav-buttons">
                                <button class="button"
                                        title="${i18n.t('pdf-preview.first-page')}"
                                        @click="${async () => { await this.showPage(1); } }"
                                        ?disabled="${this.isPageRenderingInProgress || this.currentPage === 1}">
                                    <dbp-icon name="angle-double-left"></dbp-icon>
                                </button>
                                <button class="button"
                                        title="${i18n.t('pdf-preview.previous-page')}"
                                        @click="${async () => { if (this.currentPage > 1) await this.showPage(--this.currentPage); } }"
                                        ?disabled="${this.isPageRenderingInProgress || this.currentPage === 1}">
                                    <dbp-icon name="chevron-left"></dbp-icon>
                                </button>
                                <input type="number"
                                    min="1"
                                    max="${this.totalPages}"
                                    @input="${this.onPageNumberChanged}"
                                    .value="${live(this.currentPage)}">
                                <div class="page-info">${i18n.t('pdf-preview.page-count', {totalPages: this.totalPages, })}</div>
                                <button class="button"
                                        title="${i18n.t('pdf-preview.next-page')}"
                                        @click="${async () => { if (this.currentPage < this.totalPages) await this.showPage(++this.currentPage); } }"
                                        ?disabled="${this.isPageRenderingInProgress || this.currentPage === this.totalPages}">
                                    <dbp-icon name="chevron-right"></dbp-icon>
                                </button>
                                <button class="button"
                                        title="${i18n.t('pdf-preview.last-page')}"
                                        @click="${async () => { await this.showPage(this.totalPages); } }"
                                        ?disabled="${this.isPageRenderingInProgress || this.currentPage === this.totalPages}">
                                    <dbp-icon name="angle-double-right"></dbp-icon>
                                </button>
                            </div>
                            <button class="button is-primary ${classMap({hidden: !this.isShowPlacement})}"
                                    @click="${() => { this.sendAcceptEvent(); } }">${i18n.t('pdf-preview.continue')}</button>
                        </div>
                    </div>
                    <div id="canvas-wrapper" class="${classMap({hidden: this.isPageRenderingInProgress})}">
                        <canvas id="pdf-canvas"></canvas>
                        <canvas id="fabric-canvas" class="${classMap({hidden: !this.isShowPlacement})}"></canvas>
                    </div>
                    <div class="${classMap({hidden: !this.isPageRenderingInProgress})}"><dbp-mini-spinner id="page-loader"></dbp-mini-spinner></div>
                </div>
            </div>
        `;
    }
}
