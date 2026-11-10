import {assert} from 'chai';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {SignaturePadElement} from '../src/dbp-signature-pad.js';
import {SignatureDialog} from '../src/dbp-signature-dialog.js';

commonUtils.defineCustomElement('dbp-signature-pad', SignaturePadElement);
commonUtils.defineCustomElement('dbp-signature-dialog', SignatureDialog);

for (const name of ['dbp-signature-pad', 'dbp-signature-dialog']) {
    suite(`${name} basics`, () => {
        test('can be added to the DOM', async () => {
            const node = document.createElement(name);
            document.body.appendChild(node);
            try {
                await node.updateComplete;
                assert.isTrue(node.isConnected);
                assert.isNotNull(node.shadowRoot);
            } finally {
                node.remove();
            }
        });
    });
}

suite('signature pad image processing', () => {
    const stroke = {
        penColor: 'black',
        dotSize: 0,
        minWidth: 1.5,
        maxWidth: 2.5,
        velocityFilterWeight: 0.7,
        compositeOperation: 'source-over',
        points: [
            {x: 10, y: 10, time: 1000, pressure: 0.5},
            {x: 60, y: 35, time: 1020, pressure: 0.5},
            {x: 110, y: 60, time: 1040, pressure: 0.5},
        ],
    };

    test('crop bounds exclude transparency and account for screen DPI', () => {
        const node = new SignaturePadElement();
        node._canvasWidth = 100;
        node._canvasHeight = 50;
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 100;
        assert.isNull(node._getExportBounds(canvas));
        canvas.getContext('2d').fillRect(20, 30, 40, 10);
        assert.deepEqual(node._getExportBounds(canvas), {x: 10, y: 15, width: 20, height: 5});
    });

    test('scaling fits the crop and scales times and widths without changing source data', () => {
        const node = new SignaturePadElement();
        node._canvasWidth = 300;
        node._canvasHeight = 150;
        const original = structuredClone(stroke);
        const {data} = node._transformExportData(
            [stroke],
            {x: 10, y: 10, width: 100, height: 50},
            {width: 220, height: 120},
            5,
            2,
        );
        assert.deepEqual(data[0].points, [
            {x: 10, y: 10, time: 1, pressure: 0.5},
            {x: 110, y: 60, time: 41, pressure: 0.5},
            {x: 210, y: 110, time: 81, pressure: 0.5},
        ]);
        assert.equal(data[0].minWidth, 3);
        assert.equal(data[0].maxWidth, 5);
        assert.deepEqual(stroke, original);
    });

    test('export produces a transparent PNG at the requested size with padded ink', async () => {
        const node = new SignaturePadElement();
        node.style.width = '300px';
        node.outputWidth = 220;
        node.outputHeight = 120;
        node.outputPadding = 5;
        document.body.appendChild(node);
        try {
            await node.updateComplete;
            node.resizeCanvas();
            assert.isNull(node.toDataURL());
            node._signaturePad.fromData([stroke]);
            const before = node.canvas.toDataURL();
            const dataUrl = node.toDataURL();
            assert.match(dataUrl, /^data:image\/png;base64,/);
            const image = new Image();
            image.src = dataUrl;
            await image.decode();
            assert.equal(image.naturalWidth, 220);
            assert.equal(image.naturalHeight, 120);
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0);
            assert.equal(context.getImageData(0, 0, 1, 1).data[3], 0);
            const bounds = node._getInkBounds(canvas);
            assert.isNotNull(bounds);
            assert.isAtLeast(bounds.x, 5);
            assert.isAtLeast(bounds.y, 5);
            assert.isAtMost(bounds.x + bounds.width, 215);
            assert.isAtMost(bounds.y + bounds.height, 115);
            assert.equal(node.canvas.toDataURL(), before);
        } finally {
            node.remove();
        }
    });
});
