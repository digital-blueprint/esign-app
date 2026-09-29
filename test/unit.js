import {assert} from 'chai';

import '../src/dbp-official-signature-pdf-upload';
import '../src/dbp-signature.js';
import {
    getPDFSignatureCount,
    generateSignedFileName,
    fabricjs2pdfasPosition,
    pdfasPosition2fabricjs,
} from '../src/utils.js';

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
        assert(node.shadowRoot !== undefined);
    });
});

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
