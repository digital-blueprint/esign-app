import {assert} from 'chai';

import '../src/vpu-signature-pdf-upload';
import '../src/vpu-signature.js';
import {Router} from '../src/app/router.js';

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

suite('router', () => {

  test('basics', () => {
    const routes = [
      {
          name: 'foo',
          path: '',
          action: (context) => {
              return {};
          }
      },
    ];

    const router = new Router(routes, {
      routeName: 'foo',
      getState: () => { return {}; },
      setState: (state) => { },
    });

    router.setStateFromCurrentLocation();
    router.update();
    router.updateFromPathname("/");
    assert.equal(router.getPathname(), '/');
  });
});
