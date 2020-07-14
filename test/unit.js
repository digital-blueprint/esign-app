import {assert} from 'chai';

import '../src/dbp-official-signature-pdf-upload';
import '../src/dbp-signature.js';

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

