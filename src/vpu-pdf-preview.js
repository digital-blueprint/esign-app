import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import {classMap} from 'lit-html/directives/class-map.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import VPULitElement from 'vpu-common/vpu-lit-element';
import {MiniSpinner} from 'vpu-common';
import * as commonUtils from "vpu-common/utils";
import * as commonStyles from 'vpu-common/styles';
import pdfjs from 'pdfjs-dist';
import {fabric} from 'fabric';

const i18n = createI18nInstance();

/**
 * PdfPreview web component
 */
export class PdfPreview extends ScopedElementsMixin(VPULitElement) {
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
    }

    static get scopedElements() {
        return {
            'vpu-mini-spinner': MiniSpinner,
        };
    }

    /**
     * See: https://lit-element.polymer-project.org/guide/properties#initialize
     */
    static get properties() {
        return {
            lang: { type: String },
            currentPage: { type: Number, attribute: false },
            totalPages: { type: Number, attribute: false },
            isShowPage: { type: Boolean, attribute: false },
            isPageRenderingInProgress: { type: Boolean, attribute: false },
            isPageLoaded: { type: Boolean, attribute: false },
            isShowPlacement: { type: Boolean, attribute: false },
        };
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

    connectedCallback() {
        super.connectedCallback();
        const that = this;
        pdfjs.GlobalWorkerOptions.workerSrc = commonUtils.getAssetURL('local/vpu-signature/pdfjs/pdf.worker.min.js');

        this.updateComplete.then(() => {
            that.canvas = that._('#pdf-canvas');

            // this._('#upload-pdf-input').addEventListener('change', function() {
            //     that.showPDF(this.files[0]);
            // });

            // change on page input
            this._("#pdf-page-no").addEventListener('input', async () => {
                const page_no = parseInt(that._("#pdf-page-no").value);
                console.log('page_no = ', page_no);

                if (page_no > 0 && page_no <= that.totalPages) {
                    await that.showPage(page_no);
                }
            });

            // redraw page if window was resized
            window.onresize = async () => {
                await that.showPage(that.currentPage);
            };

            // Safari can't use that yet
            // new ResizeObserver(async () => {
            //     await that.showPage(that.currentPage);
            // }).observe(this._('#pdf-main-container'));

            // add fabric.js canvas for signature positioning
            this.fabricCanvas = new fabric.Canvas(this._('#fabric-canvas'));
            // add signature image
            // TODO: add real image
            fabric.Image.fromURL('https://via.placeholder.com/350x120.png?text=Signature', function(image) {
                that.fabricCanvas.add(image);
            });
        });
    }

    /**
     * Initialize and load the PDF
     *
     * @param file
     * @param isShowPlacement
     */
    async showPDF(file, isShowPlacement = false) {
        this.isShowPlacement = isShowPlacement;
        this.isShowPage = true;
        let reader = new FileReader();

        reader.onload = async () => {
            this.isPageLoaded = false;
            const data = reader.result;

            // get handle of pdf document
            try {
                this.pdfDoc = await pdfjs.getDocument({data: data}).promise;
            } catch (error) {
                console.error(error);

                return;
            }

            // total pages in pdf
            this.totalPages = this.pdfDoc.numPages;

            // show the first page
            await this.showPage(1);

            this.isPageLoaded = true;

            // fix width adaption after "this.isPageLoaded = true"
            await this.showPage(1);
        };

        reader.readAsBinaryString(file);
    }

    /**
     * Load and render specific page of the PDF
     *
     * @param page_no
     */
    async showPage(page_no) {
        // we need to wait unil the last rendering is finished
        if (this.isPageRenderingInProgress) {
            return;
        }

        const that = this;
        this.isPageRenderingInProgress = true;
        this.currentPage = page_no;

        try {
            // get handle of page
            await this.pdfDoc.getPage(page_no).then(async (page) => {
                // original width of the pdf page at scale 1
                const pdf_original_width = page.getViewport({ scale: 1 }).width;

                // set the canvas width to the width of the container (minus the borders)
                this.fabricCanvas.setWidth(this._('#pdf-main-container').clientWidth - 2);
                this.canvas.width = this._('#pdf-main-container').clientWidth - 2;

                // as the canvas is of a fixed width we need to adjust the scale of the viewport where page is rendered
                // const scale_required = this.fabricCanvas.width / pdf_original_width;
                const scale_required = this.canvas.width / pdf_original_width;

                // get viewport to render the page at required scale
                const viewport = page.getViewport({ scale: scale_required });

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
        // TODO: add coordinates from this.fabricCanvas.item(0);
        const item = this.fabricCanvas.item(0);
        console.log(this.fabricCanvas.item(0));
        const data = {
            "currentPage": this.currentPage,
            "posX": item.get('translateX'),
            "posY": item.get('translateY'),
            "rotation": item.get('angle')
        };
        const event = new CustomEvent("vpu-pdf-preview-accept",
            { "detail": data, bubbles: true, composed: true });
        this.dispatchEvent(event);
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
            }

            .buttons {
                display: flex;
            }

            .buttons > * {
                margin-right: 3px;
            }
        `;
    }

    render() {
        return html`
<!--
            <form>
                <input type="file" name="pdf" id="upload-pdf-input">
            </form>
-->
            <div id="pdf-main-container" class="${classMap({hidden: !this.isShowPage})}">
                <vpu-mini-spinner class="${classMap({hidden: this.isPageLoaded})}"></vpu-mini-spinner>
                <div class="${classMap({hidden: !this.isPageLoaded})}">
                    <div id="pdf-meta">
                        <div class="buttons">
                            <button class="button"
                                    title="${i18n.t('pdf-preview.first-page')}"
                                    @click="${async () => { await this.showPage(1); } }"
                                    ?disabled="${this.isPageRenderingInProgress || this.currentPage === 1}">${i18n.t('pdf-preview.first')}</button>
                            <button class="button"
                                    title="${i18n.t('pdf-preview.previous-page')}"
                                    @click="${async () => { if (this.currentPage > 1) await this.showPage(--this.currentPage); } }"
                                    ?disabled="${this.isPageRenderingInProgress || this.currentPage === 1}">${i18n.t('pdf-preview.previous')}</button>
                            <input type="number" id="pdf-page-no" min="1" value="${this.currentPage}">
                            <button class="button"
                                    title="${i18n.t('pdf-preview.next-page')}"
                                    @click="${async () => { if (this.currentPage < this.totalPages) await this.showPage(++this.currentPage); } }"
                                    ?disabled="${this.isPageRenderingInProgress || this.currentPage === this.totalPages}">${i18n.t('pdf-preview.next')}</button>
                            <button class="button"
                                    title="${i18n.t('pdf-preview.last-page')}"
                                    @click="${async () => { await this.showPage(this.totalPages); } }"
                                    ?disabled="${this.isPageRenderingInProgress || this.currentPage === this.totalPages}">${i18n.t('pdf-preview.last')}</button>
                            <button class="button is-primary ${classMap({hidden: !this.isShowPlacement})}"
                                    @click="${() => { this.sendAcceptEvent(); } }">${i18n.t('pdf-preview.continue')}</button>
                        </div>
                        ${i18n.t('pdf-preview.page-count', {currentPage: this.currentPage, totalPages: this.totalPages, })}
                    </div>
                    <div id="canvas-wrapper" class="${classMap({hidden: this.isPageRenderingInProgress})}">
                        <canvas id="pdf-canvas"></canvas>
                        <canvas id="fabric-canvas" class="${classMap({hidden: !this.isShowPlacement})}"></canvas>
                    </div>
                    <div class="${classMap({hidden: !this.isPageRenderingInProgress})}"><vpu-mini-spinner id="page-loader"></vpu-mini-spinner></div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('vpu-pdf-preview', PdfPreview);
