import {assert} from 'chai';

import '../src/vpu-signature-pdf-upload';
import '../src/vpu-signature.js';

suite('vpu-signature-pdf-upload basics', () => {
  let node;

  suiteSetup(async () => {
    node = document.createElement('vpu-signature-pdf-upload');
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

suite('vpu-signature-app basics', () => {
  let node;

  suiteSetup(async () => {
    node = document.createElement('vpu-app');
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

