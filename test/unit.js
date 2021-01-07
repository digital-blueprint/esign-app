import {assert} from 'chai';

import '../src/dbp-official-signature-pdf-upload';
import '../src/dbp-signature.js';
import {getPDFSignatureCount} from '../src/utils.js';

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
        let sig1 = "/Type\n/Sig\n/Filter\n/Adobe.PPKLite\n/SubFilter\n/ETSI.CAdES.detached";
        let sig2 = "/Type\n/Sig\n/Filter\n/Adobe.PPKLite\n/SubFilter\n/adbe.pkcs7.detached";

        assert(await getPDFSignatureCount(getPDFFile(sig1)) === 1);
        assert(await getPDFSignatureCount(getPDFFile(sig2)) === 1);
        assert(await getPDFSignatureCount(getPDFFile(sig1 + sig2)) === 2);
        assert(await getPDFSignatureCount(getPDFFile("foo" + sig1 + "bar" + sig2 + "quux")) === 2);
        assert(await getPDFSignatureCount(getPDFFile("\nfoo" + sig1 + "bar\n")) === 1);
        assert(await getPDFSignatureCount(getPDFFile("\nfoo" + sig2 + "bar\n")) === 1);

        assert(await getPDFSignatureCount(getPDFFile("foobar")) === 0);
        assert(await getPDFSignatureCount(getPDFFile("")) === 0);
    });
});
