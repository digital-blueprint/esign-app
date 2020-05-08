import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import VPULitElement from 'vpu-common/vpu-lit-element';
import * as commonUtils from "vpu-common/utils";
// import * as commonStyles from 'vpu-common/styles';

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
        this._PDF_DOC = null;
        this._CURRENT_PAGE = 0;
        this._TOTAL_PAGES = 0;
        this._PAGE_RENDERING_IN_PROGRESS = 0;
        this._CANVAS = null;
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

        // commonUtils.initAssetBaseURL('vpu-person-select-src');
        // const select2CSS = commonUtils.getAssetURL(select2CSSPath);

        // TODO: use commonUtils.getAssetURL to get correct path
        pdfjs.GlobalWorkerOptions.workerSrc =
            "/dist/local/vpu-signature/pdfjs/pdf.worker.min.js";

        this.updateComplete.then(() => {
            that._CANVAS = that._('#pdf-canvas');

            this._('#upload-pdf-input').addEventListener('change', function() {
                const url = URL.createObjectURL(Array.from(this.files)[0]);
                // that.showPDF(url);
                that.showPDF(this.files[0]);
            });

            // click on the "Previous" page button
            this._("#pdf-prev").addEventListener('click', function() {
                if(that._CURRENT_PAGE !== 1)
                    that.showPage(--that._CURRENT_PAGE);
            });

            // click on the "Next" page button
            this._("#pdf-next").addEventListener('click', function() {
                if(that._CURRENT_PAGE !== that._TOTAL_PAGES)
                    that.showPage(++that._CURRENT_PAGE);
            });

            // click on the "First" page button
            this._("#pdf-first").addEventListener('click', function() {
                that.showPage(1);
            });

            // click on the "Last" page button
            this._("#pdf-last").addEventListener('click', function() {
                that.showPage(that._TOTAL_PAGES);
            });

            // change on page input
            this._("#pdf-page-no").addEventListener('input', function() {
                const page_no = parseInt(that._("#pdf-page-no").value);
                console.log('page_no = ', page_no);
                if (page_no > 0 && page_no <= that._TOTAL_PAGES) {
                    that.showPage(page_no);
                }
            });

        });
    }

    // initialize and load the PDF
    async showPDF(file) {
        let reader = new FileReader();

        reader.onload = async () => {
            const data = reader.result;
            this._("#pdf-loader").style.display = 'block';

            // try {
            //     await pdfjs.getDocument({data: pdf_url}).then((pdf) => {
            //         console.log(pdf);
            //         this._PDF_DOC = pdf;
            //
            //         // total pages in pdf
            //         this._TOTAL_PAGES = this._PDF_DOC.numPages;
            //
            //         // Hide the pdf loader and show pdf container
            //         this._("#pdf-loader").style.display = 'none';
            //         this._("#pdf-contents").style.display = 'block';
            //         this._("#pdf-total-pages").innerHTML = this._TOTAL_PAGES;
            //
            //         // show the first page
            //         this.showPage(1);
            //     });
            // }
            // catch(error) {
            //     alert(error.message);
            // }

            // get handle of pdf document
            try {
                // console.log(data);
                // this._PDF_DOC = await pdfjsLib.getDocument({ url: pdf_url });
                // this._PDF_DOC = await pdfjs.pdfjsLib.getDocument({ url: pdf_url });
                this._PDF_DOC = await pdfjs.getDocument({data: data}).promise;
                // this._PDF_DOC = await pdfjs.getDocument({ url: pdf_url });
            } catch (error) {
                alert(error);
            }

            // total pages in pdf
            this._TOTAL_PAGES = this._PDF_DOC.numPages;

            // Hide the pdf loader and show pdf container
            this._("#pdf-loader").style.display = 'none';
            this._("#pdf-contents").style.display = 'block';
            this._("#pdf-total-pages").innerHTML = this._TOTAL_PAGES;

            // show the first page
            this.showPage(1);
        };

        reader.readAsBinaryString(file);
    }

    // load and render specific page of the PDF
    async showPage(page_no) {
        const that = this;
        this._PAGE_RENDERING_IN_PROGRESS = 1;
        this._CURRENT_PAGE = page_no;

        // disable Previous & Next buttons while page is being loaded
        this._("#pdf-next").disabled = true;
        this._("#pdf-prev").disabled = true;

        // while page is being rendered hide the canvas and show a loading message
        this._("#pdf-canvas").style.display = 'none';
        this._("#page-loader").style.display = 'block';

        // update current page
        this._("#pdf-current-page").innerHTML = page_no;
        this._("#pdf-page-no").value = page_no;

        console.log(page_no);
        // get handle of page

        try {
            this._PDF_DOC.getPage(page_no).then(async (page) => {
                // you can now use *page* here
                console.log("page");
                console.log(page);

                // original width of the pdf page at scale 1
                var pdf_original_width = page.getViewport({ scale: 1 }).width;

                // as the canvas is of a fixed width we need to adjust the scale of the viewport where page is rendered
                var scale_required = this._CANVAS.width / pdf_original_width;

                // get viewport to render the page at required scale
                var viewport = page.getViewport({ scale: scale_required });

                // set canvas height same as viewport height
                this._CANVAS.height = viewport.height;

                // setting page loader height for smooth experience
                this._("#page-loader").style.height =  this._CANVAS.height + 'px';
                this._("#page-loader").style.lineHeight = this._CANVAS.height + 'px';

                // page is rendered on <canvas> element
                const render_context = {
                    canvasContext: this._CANVAS.getContext('2d'),
                    viewport: viewport
                };

                // render the page contents in the canvas
                try {
                    page.render(render_context).promise.then(() => {
                        console.log('Page rendered');
                        that._PAGE_RENDERING_IN_PROGRESS = 0;

                        // re-enable Previous & Next buttons
                        that._("#pdf-next").disabled = false;
                        that._("#pdf-prev").disabled = false;

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
                            <button id="pdf-first">First</button>
                            <button id="pdf-prev">Previous</button>
                            <input type="number" id="pdf-page-no">
                            <button id="pdf-next">Next</button>
                            <button id="pdf-last">Last</button>
                        </div>
                        <div id="page-count-container">Page <div id="pdf-current-page"></div> of <div id="pdf-total-pages"></div></div>
                    </div>
                    <canvas id="pdf-canvas" width="400"></canvas>
                    <div id="page-loader">Loading page ...</div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('vpu-pdf-preview', PdfPreview);
