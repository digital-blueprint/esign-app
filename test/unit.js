import {assert} from 'chai';

// Like in the app, the polyfill has to be loaded before any custom element gets defined
import '@webcomponents/scoped-custom-element-registry';
import '../src/dbp-official-signature-pdf-upload';
import '../src/dbp-qualified-signature-pdf-upload';
import '../src/dbp-signature.js';
import {SignatureEntry, ErrorEntry} from '../src/dbp-signature-lit-element.js';
import {
    getPDFSignatureCount,
    generateSignedFileName,
    fabricjs2pdfasPosition,
    pdfasPosition2fabricjs,
    getSignaturePositionParams,
    ANNOTATION_TYPE_IDS,
    getAnnotationType,
    getAnnotationTypes,
} from '../src/utils.js';

suite('annotation types', () => {
    test('named IDs identify the existing annotation definitions', () => {
        assert.sameMembers(Object.keys(getAnnotationTypes()), Object.values(ANNOTATION_TYPE_IDS));
        assert.equal(
            getAnnotationType(ANNOTATION_TYPE_IDS.REFERENCE_NUMBER).placeholderTextId,
            'annotation-view.reference-number-placeholder',
        );
        assert.equal(
            getAnnotationType(ANNOTATION_TYPE_IDS.INTENDED_USE).placeholderTextId,
            'annotation-view.intended-use-placeholder',
        );
        assert.equal(
            getAnnotationType(ANNOTATION_TYPE_IDS.INVOICE_NUMBER).placeholderTextId,
            'annotation-view.invoice-number-placeholder',
        );
    });
});

suite('signature position conversion', () => {
    test('pdfasPosition2fabricjs is the inverse of fabricjs2pdfasPosition', () => {
        const pageHeight = 842;
        for (const rotation of [0, 90, 180, 270]) {
            const position = {x: 100, y: 300, width: 200, rotation, page: 2};
            const placement = pdfasPosition2fabricjs(position, pageHeight, 150, 0.5);
            assert.equal(placement.currentPage, 2);
            assert.equal(placement.width, 200);
            assert.equal(placement.height, 100);
            assert.deepEqual(fabricjs2pdfasPosition(placement), position);
        }
    });

    test('pdfasPosition2fabricjs uses defaults', () => {
        const placement = pdfasPosition2fabricjs({x: 10, y: 20}, 842, 150, 0.5);
        assert.equal(placement.currentPage, 1);
        assert.equal(placement.width, 150);
        assert.equal(placement.angle, 0);
        assert.equal(placement.left, 10);
        assert.equal(placement.top, 822);
    });

    test('getSignaturePositionParams', () => {
        assert.deepEqual(getSignaturePositionParams('auto', undefined), {});
        assert.deepEqual(getSignaturePositionParams('manual', undefined), {});
        assert.deepEqual(getSignaturePositionParams('new-page', undefined), {page: 'new'});
        const placement = pdfasPosition2fabricjs({x: 10, y: 20, page: 3}, 842, 150, 0.5);
        assert.deepEqual(
            getSignaturePositionParams('manual', placement),
            fabricjs2pdfasPosition(placement),
        );
    });
});

suite('dbp-official-signature-pdf-upload basics', () => {
    let node;

    suiteSetup(async () => {
        node = document.createElement('dbp-official-signature-pdf-upload');
        document.body.appendChild(node);
        await node.updateComplete;
    });

    suiteTeardown(() => {
        node.remove();
    });

    test('should render', () => {
        assert.isNotNull(node.shadowRoot);
    });
});

suite('upload activity restrictions', () => {
    for (const activity of ['official', 'qualified']) {
        for (const lang of ['de', 'en']) {
            test(`${activity} description shows the upload restrictions in ${lang}`, async () => {
                const node = document.createElement(`dbp-${activity}-signature-pdf-upload`);
                node.isLoggedIn = () => true;
                node.hasSignaturePermissions = () => true;
                node.isLoading = () => false;
                node.lang = lang;
                document.body.appendChild(node);
                try {
                    await node._i18n.changeLanguage(lang);
                    await node.updateComplete;

                    const description = node.shadowRoot.querySelector('.description').textContent;
                    const restrictions =
                        lang === 'de'
                            ? 'Es können nur PDF-Dateien von maximal 32 MB pro Datei hochgeladen werden. Der Platzbedarf der sichtbaren Signatur hängt vom gewählten Signaturprofil ab. Wir empfehlen A4 im Hochformat. Bei kleineren Seitenformaten prüfen Sie bitte die Platzierung der Signatur in der Vorschau.'
                            : 'Only PDF files up to 32 MB per file can be uploaded. The space required for the visible signature depends on the selected signature profile. We recommend A4 portrait. For smaller page sizes, please check the signature placement in the preview.';
                    assert.include(description, restrictions);
                    assert.notMatch(description, /\bA[56]\b/);
                } finally {
                    node.remove();
                }
            });
        }
    }
});

suite('signed files table', () => {
    let node;
    let downloadedFiles;

    // Tabulator reacts to size changes with a ResizeObserver, so give it some frames
    const waitForLayout = async () => {
        for (let i = 0; i < 5; i++) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        }
    };

    const getTable = () => node.tableSignedFilesTable.tabulatorTable;

    const getCellElement = (key, field) => getTable().getRow(key).getCell(field).getElement();

    const getDownloadButton = (key) =>
        getCellElement(key, 'downloadButton').querySelector('dbp-esign-download-button');

    const getFilenameLabel = (key) =>
        getCellElement(key, 'fileName').querySelector('dbp-esign-filename-label');

    const addSignedFile = async (key, name) => {
        node.addSignedFile(key, new File(['%PDF-1.4'], name, {type: 'application/pdf'}));
        await node.updateComplete;
        await waitForLayout();
    };

    setup(async () => {
        downloadedFiles = [];
        node = document.createElement('dbp-official-signature-pdf-upload');
        // Show the signing UI without a login
        node.isLoggedIn = () => true;
        node.hasSignaturePermissions = () => true;
        node.isLoading = () => false;
        // Don't open the file sink dialog
        node.downloadFileClickHandler = (file) => downloadedFiles.push(file.name);
        node.style.display = 'block';
        node.style.width = '1200px';
        document.body.appendChild(node);
        await node.updateComplete;
    });

    teardown(() => {
        node.remove();
    });

    test('shows the download button after the table was shown for the first file', async () => {
        await addSignedFile('1', 'first-sig.pdf');

        assert.isTrue(getTable().getColumn('downloadButton').isVisible());
        assert.isNotNull(getDownloadButton('1'));
        assert.equal(getFilenameLabel('1').file.name, 'first-sig.pdf');
    });

    test('keeps the download button after the column was collapsed and shown again', async () => {
        await addSignedFile('1', 'first-sig.pdf');

        node.style.width = '350px';
        await waitForLayout();
        assert.isFalse(getTable().getColumn('downloadButton').isVisible());

        node.style.width = '1200px';
        await waitForLayout();
        assert.isTrue(getTable().getColumn('downloadButton').isVisible());
        assert.isNotNull(getDownloadButton('1'));
    });

    test('marks a file as downloaded and keeps the mark when more files are signed', async () => {
        await addSignedFile('1', 'first-sig.pdf');

        getDownloadButton('1').click();
        await waitForLayout();
        assert.deepEqual(downloadedFiles, ['first-sig.pdf']);
        assert.isTrue(getFilenameLabel('1').isDownloaded);

        await addSignedFile('2', 'second-sig.pdf');
        assert.isTrue(getFilenameLabel('1').isDownloaded);
        assert.isFalse(getFilenameLabel('2').isDownloaded);
    });

    test('marks all files as downloaded with the zip download', async () => {
        await addSignedFile('1', 'first-sig.pdf');
        await addSignedFile('2', 'second-sig.pdf');

        node.zipDownloadClickHandler();
        await waitForLayout();

        assert.isTrue(getFilenameLabel('1').isDownloaded);
        assert.isTrue(getFilenameLabel('2').isDownloaded);
    });

    test('does not select the row when clicking the download button', async () => {
        await addSignedFile('1', 'first-sig.pdf');

        getDownloadButton('1').click();
        await waitForLayout();

        assert.lengthOf(getTable().getSelectedRows(), 0);
    });

    test('uses the file name for selecting and sorting', async () => {
        await addSignedFile('1', 'b-sig.pdf');
        await addSignedFile('2', 'a-sig.pdf');

        getTable().selectRow('1');
        await waitForLayout();
        assert.deepEqual(node.selectedSignedFiles, [{key: '1', filename: 'b-sig.pdf'}]);

        getTable().setSort('fileName', 'asc');
        await waitForLayout();
        assert.deepEqual(
            getTable()
                .getRows('active')
                .map((row) => row.getData().fileName),
            ['a-sig.pdf', 'b-sig.pdf'],
        );
    });
});

for (const tag of ['dbp-official-signature-pdf-upload', 'dbp-qualified-signature-pdf-upload']) {
    suite(`${tag} queued and failed file tables`, () => {
        let node;
        let entry;
        let originalConfirm;
        let previews;
        let annotations;
        let retried;

        const waitForLayout = async () => {
            await node.updateComplete;
            for (let i = 0; i < 5; i++) {
                await new Promise((resolve) => requestAnimationFrame(resolve));
            }
        };
        const queued = () => node.tableQueuedFilesTable.tabulatorTable;
        const failed = () => node.tableFailedFilesTable.tabulatorTable;
        const cell = (table, field) => table.getRow('1').getCell(field).getElement();
        const details = (table) =>
            table.getRow('1').getElement().querySelector('.tabulator-responsive-collapse');

        setup(async () => {
            node = document.createElement(tag);
            node.isLoggedIn = () => true;
            node.hasSignaturePermissions = () => true;
            node.isLoading = () => false;
            node.getInvisibilityOfSelectedProfile = () => false;
            node.allowManualPositioning = true;
            node.allowAnnotating = true;
            node.style.display = 'block';
            node.style.width = '1200px';
            previews = [];
            annotations = [];
            retried = [];
            node.showPreview = async (...args) => previews.push(args);
            node.showAnnotationView = (key) => annotations.push(key);
            node.queuePlacement = async () => {};
            node.reQueueFile = async (value) => retried.push(value);
            document.body.appendChild(node);
            await waitForLayout();
            node._('#pdf-preview').open = () => {};
            node._('#annotation-view').open = () => {};
            originalConfirm = window.confirm;
            window.confirm = () => true;
            entry = new SignatureEntry('1', new File(['pdf'], 'b.pdf'), 'auto', true, [
                {text: 'note'},
            ]);
            node.queuedFiles = new Map([['1', entry]]);
            node.errorFiles = new Map([['1', new ErrorEntry(entry, 'Signing failed')]]);
            await waitForLayout();
        });

        teardown(() => {
            window.confirm = originalConfirm;
            node.remove();
        });

        test('stores plain row values and renders placement warnings and annotations', () => {
            assert.equal(queued().getRow('1').getData().fileName, 'b.pdf');
            assert.equal(failed().getRow('1').getData().fileName, 'b.pdf');
            for (const table of [queued(), failed()]) {
                assert.isFalse(
                    Object.values(table.getRow('1').getData()).some(
                        (value) => value instanceof Node,
                    ),
                );
            }
            assert.isTrue(
                cell(queued(), 'fileName').querySelector('dbp-esign-filename-label')
                    .isPlacementMissing,
            );
            assert.deepEqual(
                cell(queued(), 'buttons').querySelector('dbp-esign-annotations-button').annotations,
                entry.annotations,
            );
        });

        test('keeps selection, positioning state and controls through repeated collapse and expansion', async () => {
            queued().selectRow('1');
            failed().selectRow('1');
            await waitForLayout();
            assert.deepEqual(node.selectedQueuedFiles, [{key: '1', filename: 'b.pdf'}]);
            assert.deepEqual(node.selectedFailedFiles, [{key: '1', filename: 'b.pdf'}]);
            for (let i = 0; i < 2; i++) {
                node.style.width = '350px';
                await waitForLayout();
                assert.isFalse(queued().getColumn('buttons').isVisible());
                assert.isFalse(failed().getColumn('buttons').isVisible());
                const toggle = details(queued()).querySelector('dbp-esign-positioning-switch');
                assert.isNotNull(toggle);
                toggle.dispatchEvent(new CustomEvent('toggle-change', {detail: {checked: true}}));
                assert.equal(entry.placementMode, 'manual');
                assert.isTrue(
                    cell(queued(), 'positioning').querySelector('dbp-esign-positioning-switch')
                        .checked,
                );
                assert.isFalse(
                    cell(queued(), 'fileName').querySelector('dbp-esign-filename-label')
                        .isPlacementMissing,
                );
                node.style.width = '1200px';
                await waitForLayout();
                assert.isNotNull(
                    cell(queued(), 'buttons').querySelector('dbp-esign-preview-button'),
                );
                assert.isNotNull(
                    cell(queued(), 'buttons').querySelector('dbp-esign-delete-button'),
                );
                assert.isNotNull(
                    cell(failed(), 'buttons').querySelector('dbp-esign-reupload-button'),
                );
                assert.isNotNull(
                    cell(failed(), 'buttons').querySelector('dbp-esign-remove-failed-file-button'),
                );
                assert.lengthOf(queued().getSelectedRows(), 1);
                assert.lengthOf(failed().getSelectedRows(), 1);
            }
            node.setQueuedFilesTabulatorTable();
            await waitForLayout();
            assert.isTrue(
                cell(queued(), 'positioning').querySelector('dbp-esign-positioning-switch').checked,
            );
        });

        test('preview and annotation buttons work in collapsed details without selecting rows', async () => {
            node.style.width = '350px';
            await waitForLayout();
            node.tableQueuedFilesTable.expandAll();
            await waitForLayout();
            details(queued()).querySelector('dbp-esign-preview-button').click();
            details(queued()).querySelector('dbp-esign-annotations-button').click();
            assert.deepEqual(previews, [['1', false, true]]);
            assert.deepEqual(annotations, ['1']);
            assert.lengthOf(queued().getSelectedRows(), 0);
            node.tableQueuedFilesTable.collapseAll();
            await waitForLayout();
            assert.equal(details(queued()).style.display, 'none');
        });

        test('automatic positioning clears placement and synchronizes both copies of the switch', async () => {
            entry.placementMode = 'manual';
            entry.signaturePlacement = {page: 1};
            node.setQueuedFilesTabulatorTable();
            await waitForLayout();
            node.style.width = '350px';
            await waitForLayout();
            const toggle = details(queued()).querySelector('dbp-esign-positioning-switch');
            toggle.dispatchEvent(new CustomEvent('toggle-change', {detail: {checked: false}}));
            assert.equal(entry.placementMode, 'auto');
            assert.isUndefined(entry.signaturePlacement);
            assert.isFalse(toggle.checked);
            assert.isFalse(
                cell(queued(), 'positioning').querySelector('dbp-esign-positioning-switch').checked,
            );
            assert.isTrue(
                cell(queued(), 'fileName').querySelector('dbp-esign-filename-label')
                    .isPlacementMissing,
            );
        });

        test('does not show annotation controls when annotations are disabled', async () => {
            node.allowAnnotating = false;
            node.setQueuedFilesTabulatorTable();
            await waitForLayout();
            assert.isNull(cell(queued(), 'buttons').querySelector('dbp-esign-annotations-button'));
            node.style.width = '350px';
            await waitForLayout();
            assert.isNull(details(queued()).querySelector('dbp-esign-annotations-button'));
            assert.isNotNull(details(queued()).querySelector('dbp-esign-preview-button'));
        });

        test('deletes queued files after the action column was collapsed and shown', async () => {
            node.style.width = '350px';
            await waitForLayout();
            node.style.width = '1200px';
            await waitForLayout();
            cell(queued(), 'buttons').querySelector('dbp-esign-delete-button').click();
            await waitForLayout();
            assert.isFalse(node.queuedFiles.has('1'));
        });

        test('retries failed files from collapsed details with the original entry', async () => {
            node.style.width = '350px';
            await waitForLayout();
            node.tableFailedFilesTable.expandAll();
            await waitForLayout();
            details(failed()).querySelector('dbp-esign-reupload-button').click();
            await waitForLayout();
            assert.strictEqual(retried[0], entry);
            assert.isFalse(node.errorFiles.has('1'));
        });

        test('deletes failed files after the action column was collapsed and shown', async () => {
            node.style.width = '350px';
            await waitForLayout();
            node.style.width = '1200px';
            await waitForLayout();
            cell(failed(), 'buttons').querySelector('dbp-esign-remove-failed-file-button').click();
            await waitForLayout();
            assert.isFalse(node.errorFiles.has('1'));
        });
    });
}

suite('dbp-signature-app basics', () => {
    let node;

    suiteSetup(async () => {
        node = document.createElement('dbp-app');
        document.body.appendChild(node);
        await node.updateComplete;
    });

    suiteTeardown(() => {
        node.remove();
    });

    test('should render', () => {
        assert(node.shadowRoot !== undefined);
    });
});

suite('pdf signature detection', () => {
    function getPDFFile(data) {
        return new File([new Blob([data])], 'test.pdf', {type: 'application/pdf'});
    }

    test('getPDFSignatureCount', async () => {
        // Produced via pdf-as-web
        let sig1 = '/Type\n/Sig\n/Filter\n/Adobe.PPKLite\n/SubFilter\n/ETSI.CAdES.detached';
        let sig2 = '/Type\n/Sig\n/Filter\n/Adobe.PPKLite\n/SubFilter\n/adbe.pkcs7.detached';
        // Produced via https://www.handy-signatur.at
        let sig3 =
            "/Type /Sig\n/Name (Max Meier)\n/Location ()\n/Reason ()\n/M (D:20210201154123+01'00')\n/Filter /asign.ECDSA\n/SubFilter /ETSI.CAdES.detached";

        assert((await getPDFSignatureCount(getPDFFile(sig1))) === 1);
        assert((await getPDFSignatureCount(getPDFFile(sig2))) === 1);
        assert((await getPDFSignatureCount(getPDFFile(sig3))) === 1);
        assert((await getPDFSignatureCount(getPDFFile(sig1 + sig2))) === 2);
        assert(
            (await getPDFSignatureCount(getPDFFile('foo' + sig1 + 'bar' + sig2 + 'quux'))) === 2,
        );
        assert((await getPDFSignatureCount(getPDFFile('\nfoo' + sig1 + 'bar\n'))) === 1);
        assert((await getPDFSignatureCount(getPDFFile('\nfoo' + sig2 + 'bar\n'))) === 1);

        assert((await getPDFSignatureCount(getPDFFile('foobar'))) === 0);
        assert((await getPDFSignatureCount(getPDFFile(''))) === 0);
    });

    test('getPDFSignatureCount real files', async () => {
        async function getRealPDFFile(name) {
            let url = new URL('test/' + name, import.meta.url).href;
            let resp = await fetch(url);
            assert(resp.ok);
            return getPDFFile(await resp.arrayBuffer());
        }

        assert.equal(await getPDFSignatureCount(await getRealPDFFile('QPDF-367-0.pdf')), 1);
        assert.equal(await getPDFSignatureCount(await getRealPDFFile('qual-sig-simple.pdf')), 1);
        assert.equal(
            await getPDFSignatureCount(await getRealPDFFile('qual-sig-tugraz-multiple.pdf')),
            2,
        );
    });

    test('generateSignedFileName appends -sig before the extension', () => {
        assert.equal(generateSignedFileName('foo.pdf'), 'foo-sig.pdf');
        assert.equal(generateSignedFileName('.pdf'), '-sig.pdf');
        assert.equal(generateSignedFileName('-sig.pdf'), '-sig.pdf');
        assert.equal(generateSignedFileName(''), '-sig');
        assert.equal(generateSignedFileName('foo.tar.gz'), 'foo.tar-sig.gz');
        assert.equal(generateSignedFileName('foo.sig'), 'foo-sig.sig');
    });
});
