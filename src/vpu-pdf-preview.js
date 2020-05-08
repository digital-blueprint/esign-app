import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import VPULitElement from 'vpu-common/vpu-lit-element';
import * as commonUtils from "vpu-common/utils";
import * as commonStyles from 'vpu-common/styles';
// import './pdfjs/pdf';
import pdfjs from 'pdfjs-dist';


//import '../assets/pdfjs/pdf';
// import pdfjsLib from './pdfjs/pdf';
// import pdfjs from '../assets/pdfjs/pdf';
// import zlib;

// import pdfjsLib from 'pdfjs-dist';
// import pdfjs from '../node_modules/pdfjs-dist/lib/pdf';
// import pdfjs from '../node_modules/pdfjs-dist/build/pdf';

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
        this.isPageRenderingInProgress = false;
        this.canvas = null;
    }

    static get scopedElements() {
        return {
            // 'vpu-icon': Icon,
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
            isPageRenderingInProgress: { type: Boolean, attribute: false },
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

            this._('#upload-pdf-input').addEventListener('change', function() {
                // const url = URL.createObjectURL(Array.from(this.files)[0]);
                // that.showPDF(url);
                that.showPDF(this.files[0]);
            });

            // change on page input
            this._("#pdf-page-no").addEventListener('input', async () => {
                const page_no = parseInt(that._("#pdf-page-no").value);
                console.log('page_no = ', page_no);

                if (page_no > 0 && page_no <= that.totalPages) {
                    await that.showPage(page_no);
                }
            });

        });
    }

    /**
     * Initialize and load the PDF
     *
     * @param file
     */
    async showPDF(file) {
        let reader = new FileReader();

        reader.onload = async () => {
            const data = reader.result;
            this._("#pdf-loader").style.display = 'block';

            // get handle of pdf document
            try {
                // console.log(data);
                // this.pdfDoc = await pdfjsLib.getDocument({ url: pdf_url });
                // this.pdfDoc = await pdfjs.pdfjsLib.getDocument({ url: pdf_url });
                this.pdfDoc = await pdfjs.getDocument({data: data}).promise;
                // this.pdfDoc = await pdfjs.getDocument({ url: pdf_url });
            } catch (error) {
                console.error(error);

                return;
            }

            // total pages in pdf
            this.totalPages = this.pdfDoc.numPages;

            // Hide the pdf loader and show pdf container
            this._("#pdf-loader").style.display = 'none';
            this._("#pdf-contents").style.display = 'block';
            this._("#pdf-total-pages").innerHTML = this.totalPages;

            // show the first page
            await this.showPage(1);
        };

        reader.readAsBinaryString(file);
    }

    // load and render specific page of the PDF
    async showPage(page_no) {
        const that = this;
        this.isPageRenderingInProgress = true;
        this.currentPage = page_no;

        // while page is being rendered hide the canvas and show a loading message
        this._("#pdf-canvas").style.display = 'none';
        this._("#page-loader").style.display = 'block';

        // update current page
        this._("#pdf-current-page").innerHTML = page_no;
        this._("#pdf-page-no").value = page_no;

        console.log(page_no);
        // get handle of page

        try {
            this.pdfDoc.getPage(page_no).then(async (page) => {
                // you can now use *page* here
                console.log("page");
                console.log(page);

                // original width of the pdf page at scale 1
                const pdf_original_width = page.getViewport({ scale: 1 }).width;

                // as the canvas is of a fixed width we need to adjust the scale of the viewport where page is rendered
                const scale_required = this.canvas.width / pdf_original_width;

                // get viewport to render the page at required scale
                const viewport = page.getViewport({ scale: scale_required });

                // set canvas height same as viewport height
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
                    page.render(render_context).promise.then(() => {
                        console.log('Page rendered');
                        that.isPageRenderingInProgress = false;

                        // show the canvas and hide the page loader
                        that._("#pdf-canvas").style.display = 'block';
                        that._("#page-loader").style.display = 'none';
                    });
                }
                catch(error) {
                    alert(error.message);
                }
            });
        }
        catch(error) {
            alert(error.message);
        }
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getButtonCSS()}

            #pdf-canvas {
                width: 100%;
            }
        `;
    }

    render() {
        return html`
            <form>
                <input type="file" name="pdf" id="upload-pdf-input">
            </form>
            <div id="pdf-main-container">
                <div id="pdf-loader">Loading document ...</div>
                <div id="pdf-contents">
                    <div id="pdf-meta">
                        <div id="pdf-buttons">
                            <button class="button is-small"
                                    @click="${async () => { await this.showPage(1); } }"
                                    ?disabled="${this.isPageRenderingInProgress}">First</button>
                            <button class="button is-small"
                                    @click="${async () => { if (this.currentPage > 1) await this.showPage(--this.currentPage); } }"
                                    ?disabled="${this.isPageRenderingInProgress}">Previous</button>
                            <input type="number" id="pdf-page-no" value="${this.currentPage}">
                            <button class="button is-small"
                                    @click="${async () => { if (this.currentPage < this.totalPages) await this.showPage(++this.currentPage); } }"
                                    ?disabled="${this.isPageRenderingInProgress}">Next</button>
                            <button class="button is-small"
                                    @click="${async () => { await this.showPage(this.totalPages); } }"
                                    ?disabled="${this.isPageRenderingInProgress}">Last</button>
                        </div>
                        <span id="page-count-container">Page <span id="pdf-current-page"></span> of <span id="pdf-total-pages"></span></span>
                    </div>
                    <canvas id="pdf-canvas"></canvas>
                    <div id="page-loader">Loading page ...</div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('vpu-pdf-preview', PdfPreview);
