import {expect} from 'chai';
import StarGraphicsPrinterEncoder from '../src/star-graphics-printer-encoder.js';

/*
  The expected bytes are written out in full, so that a mistake in the encoder
  cannot hide behind the same mistake in the test.

  Job start, without a pulse in the stream:

    ESC * r R        1b 2a 72 52         initialize raster mode
    ESC * r A        1b 2a 72 41         enter raster mode
    ESC * r Q 0 NUL  1b 2a 72 51 30 00   print quality, high speed
    ESC * r P 0 NUL  1b 2a 72 50 30 00   page length, continuous
    ESC * r E 1 NUL  1b 2a 72 45 31 00   EOT mode, print without feed or cut

  Job end:

    ESC FF EOT       1b 0c 04            execute the EOT mode
    ESC * r B        1b 2a 72 42         quit raster mode
*/

const start = [
  0x1b, 0x2a, 0x72, 0x52,
  0x1b, 0x2a, 0x72, 0x41,
  0x1b, 0x2a, 0x72, 0x51, 0x30, 0x00,
  0x1b, 0x2a, 0x72, 0x50, 0x30, 0x00,
  0x1b, 0x2a, 0x72, 0x45, 0x31, 0x00,
];

const end = [
  0x1b, 0x0c, 0x04,
  0x1b, 0x2a, 0x72, 0x42,
];

/**
 * The job of a list of items, as the driver receives it
 *
 * @param  {Array}       items       The items of the job
 * @param  {object}      [options]   How the printer prints
 * @return {number[]}                Every byte of the job, in order
 */
function encode(items, options) {
  return Array.from(new StarGraphicsPrinterEncoder(options).encode(items));
}


describe('StarGraphicsPrinterEncoder', () => {
  describe('encode([ image, cut partial ])', () => {
    const items = [
      {type: 'image', width: 16, height: 2, data: new Uint8Array([0xff, 0x0f, 0x00, 0x00])},
      {type: 'cut', value: 'partial'},
    ];

    const expected = [
      ...start,

      /* ESC * r F 13 NUL, partial cut ends this segment */
      0x1b, 0x2a, 0x72, 0x46, 0x31, 0x33, 0x00,

      /* b 2 0 ff 0f, the first row */
      0x62, 0x02, 0x00, 0xff, 0x0f,

      /* b 1 0 00, the second row is white */
      0x62, 0x01, 0x00, 0x00,

      /* ESC FF NUL, print, feed and cut */
      0x1b, 0x0c, 0x00,

      ...end,
    ];

    it('should set the partial cut mode before the first row', () => {
      expect(encode(items)).to.deep.equal(expected);
    });

    it('should encode the same job through encodeImage() without the cut', () => {
      const encoder = new StarGraphicsPrinterEncoder();
      const image = {width: 16, height: 2, data: new Uint8Array([0xff, 0x0f, 0x00, 0x00])};

      expect(Array.from(encoder.encodeImage(image))).to.deep.equal([
        ...start,

        /* ESC * r F 1 NUL, the job ends this segment */
        0x1b, 0x2a, 0x72, 0x46, 0x31, 0x00,

        0x62, 0x02, 0x00, 0xff, 0x0f,
        0x62, 0x01, 0x00, 0x00,

        ...end,
      ]);
    });
  });

  describe('encode([ image, pulse, image, cut full ])', () => {
    const items = [
      {type: 'image', width: 8, height: 1, data: new Uint8Array([0x81])},
      {type: 'pulse', device: 0, on: 100, off: 500},
      {type: 'image', width: 8, height: 1, data: new Uint8Array([0x42])},
      {type: 'cut', value: 'full'},
    ];

    const expected = [
      ...start,

      /* ESC BEL 10 50, 100 ms on and 500 ms off */
      0x1b, 0x07, 0x0a, 0x32,

      /* ESC * r F 1 NUL, a pulse ends this segment */
      0x1b, 0x2a, 0x72, 0x46, 0x31, 0x00,

      /* b 1 0 81 */
      0x62, 0x01, 0x00, 0x81,

      /* ESC FF NUL, print the rows without cutting */
      0x1b, 0x0c, 0x00,

      /* ESC * r D 1 NUL, drive drawer 1 */
      0x1b, 0x2a, 0x72, 0x44, 0x31, 0x00,

      /* ESC * r F 9 NUL, a full cut ends this segment */
      0x1b, 0x2a, 0x72, 0x46, 0x39, 0x00,

      /* b 1 0 42 */
      0x62, 0x01, 0x00, 0x42,

      /* ESC FF NUL, print, feed and cut */
      0x1b, 0x0c, 0x00,

      ...end,
    ];

    it('should print before the drawer and change mode per segment', () => {
      expect(encode(items)).to.deep.equal(expected);
    });
  });

  describe('encode([ image, feed, image, cut partial ])', () => {
    const items = [
      {type: 'image', width: 8, height: 1, data: new Uint8Array([0x81])},
      {type: 'feed', height: 24},
      {type: 'image', width: 8, height: 1, data: new Uint8Array([0x42])},
      {type: 'feed', height: 7},
      {type: 'cut', value: 'partial'},
    ];

    const expected = [
      ...start,

      /* ESC * r F 13 NUL */
      0x1b, 0x2a, 0x72, 0x46, 0x31, 0x33, 0x00,

      /* b 1 0 81 */
      0x62, 0x01, 0x00, 0x81,

      /* ESC * r Y 24 NUL */
      0x1b, 0x2a, 0x72, 0x59, 0x32, 0x34, 0x00,

      /* b 1 0 42 */
      0x62, 0x01, 0x00, 0x42,

      /* ESC * r Y 7 NUL */
      0x1b, 0x2a, 0x72, 0x59, 0x37, 0x00,

      /* ESC FF NUL */
      0x1b, 0x0c, 0x00,

      ...end,
    ];

    it('should move the position instead of sending white rows', () => {
      expect(encode(items)).to.deep.equal(expected);
    });
  });

  describe('encode([ image with a white row, cut partial ])', () => {
    const items = [
      {type: 'image', width: 24, height: 3, data: new Uint8Array([
        0xff, 0xff, 0xff,
        0x00, 0x00, 0x00,
        0x80, 0x00, 0x00,
      ])},
      {type: 'cut', value: 'partial'},
    ];

    const expected = [
      ...start,

      /* ESC * r F 13 NUL */
      0x1b, 0x2a, 0x72, 0x46, 0x31, 0x33, 0x00,

      /* b 3 0, nothing to trim */
      0x62, 0x03, 0x00, 0xff, 0xff, 0xff,

      /* b 1 0, an all white row is one zero byte */
      0x62, 0x01, 0x00, 0x00,

      /* b 1 0, the white tail is trimmed */
      0x62, 0x01, 0x00, 0x80,

      /* ESC FF NUL */
      0x1b, 0x0c, 0x00,

      ...end,
    ];

    it('should trim the trailing white bytes of every row', () => {
      expect(encode(items)).to.deep.equal(expected);
    });
  });

  describe('encode([ image ])', () => {
    const items = [
      {type: 'image', width: 8, height: 1, data: new Uint8Array([0x81])},
    ];

    const expected = [
      ...start,

      /* ESC * r F 1 NUL, the job ends this segment */
      0x1b, 0x2a, 0x72, 0x46, 0x31, 0x00,

      /* b 1 0 81 */
      0x62, 0x01, 0x00, 0x81,

      ...end,
    ];

    it('should print the last image without cutting', () => {
      expect(encode(items)).to.deep.equal(expected);
    });
  });

  describe('encode([ pulse ])', () => {
    const items = [
      {type: 'pulse', device: 0, on: 100, off: 500},
    ];

    const expected = [
      ...start,

      /* ESC BEL 10 50 */
      0x1b, 0x07, 0x0a, 0x32,

      /* ESC * r D 1 NUL, no rows, so nothing to print first */
      0x1b, 0x2a, 0x72, 0x44, 0x31, 0x00,

      ...end,
    ];

    it('should not execute the FF mode when the segment has no rows', () => {
      expect(encode(items)).to.deep.equal(expected);
    });
  });

  describe('encode([ pulse with extreme times ])', () => {
    const items = [
      {type: 'pulse', device: 0, on: 2, off: 5000},
    ];

    const expected = [
      ...start,

      /* ESC BEL 1 127, clamped to the defined area */
      0x1b, 0x07, 0x01, 0x7f,

      /* ESC * r D 1 NUL, drive drawer 1 */
      0x1b, 0x2a, 0x72, 0x44, 0x31, 0x00,

      ...end,
    ];

    it('should clamp the pulse width between 1 and 127 units of 10 ms', () => {
      expect(encode(items)).to.deep.equal(expected);
    });
  });

  describe('encode([ pulse on device 1 ])', () => {
    const items = [
      {type: 'pulse', device: 1, on: 100, off: 500},
    ];

    const expected = [
      ...start,

      /* ESC * r D 2 NUL, drive drawer 2 */
      0x1b, 0x2a, 0x72, 0x44, 0x32, 0x00,

      ...end,
    ];

    it('should not set a pulse width, the timing of device 2 is fixed', () => {
      expect(encode(items)).to.deep.equal(expected);
    });
  });

  describe('encode([ image, pulse, feed, cut partial ])', () => {
    const items = [
      {type: 'image', width: 8, height: 1, data: new Uint8Array([0x81])},
      {type: 'pulse', device: 0, on: 100, off: 500},
      {type: 'feed', height: 48},
      {type: 'cut', value: 'partial'},
    ];

    const expected = [
      ...start,

      /* ESC BEL 10 50 */
      0x1b, 0x07, 0x0a, 0x32,

      /* ESC * r F 1 NUL, a pulse ends this segment */
      0x1b, 0x2a, 0x72, 0x46, 0x31, 0x00,

      /* b 1 0 81 */
      0x62, 0x01, 0x00, 0x81,

      /* ESC FF NUL, print the rows without cutting */
      0x1b, 0x0c, 0x00,

      /* ESC * r D 1 NUL */
      0x1b, 0x2a, 0x72, 0x44, 0x31, 0x00,

      /* ESC * r F 13 NUL, a partial cut ends this segment */
      0x1b, 0x2a, 0x72, 0x46, 0x31, 0x33, 0x00,

      /* ESC * r Y 48 NUL, the feed before the cut */
      0x1b, 0x2a, 0x72, 0x59, 0x34, 0x38, 0x00,

      /* b 1 0 00, a blank row, the cut needs a buffer */
      0x62, 0x01, 0x00, 0x00,

      /* ESC FF NUL, print, feed and cut */
      0x1b, 0x0c, 0x00,

      ...end,
    ];

    it('should give a cut after a feed something to cut through', () => {
      expect(encode(items)).to.deep.equal(expected);
    });
  });

  describe('encode([ cut partial, image ])', () => {
    const items = [
      {type: 'cut', value: 'partial'},
      {type: 'image', width: 8, height: 1, data: new Uint8Array([0x81])},
    ];

    const expected = [
      ...start,

      /* ESC * r F 13 NUL */
      0x1b, 0x2a, 0x72, 0x46, 0x31, 0x33, 0x00,

      /* b 1 0 00, a blank row */
      0x62, 0x01, 0x00, 0x00,

      /* ESC FF NUL, print, feed and cut */
      0x1b, 0x0c, 0x00,

      /* ESC * r F 1 NUL, the job ends this segment */
      0x1b, 0x2a, 0x72, 0x46, 0x31, 0x00,

      /* b 1 0 81 */
      0x62, 0x01, 0x00, 0x81,

      ...end,
    ];

    it('should cut when the job starts with a cut', () => {
      expect(encode(items)).to.deep.equal(expected);
    });
  });

  describe('encode([ image, cut partial, cut full ])', () => {
    const items = [
      {type: 'image', width: 8, height: 1, data: new Uint8Array([0x81])},
      {type: 'cut', value: 'partial'},
      {type: 'cut', value: 'full'},
    ];

    const expected = [
      ...start,

      /* ESC * r F 13 NUL */
      0x1b, 0x2a, 0x72, 0x46, 0x31, 0x33, 0x00,

      /* b 1 0 81 */
      0x62, 0x01, 0x00, 0x81,

      /* ESC FF NUL, print, feed and cut */
      0x1b, 0x0c, 0x00,

      /* ESC * r F 9 NUL, the second cut is a full one */
      0x1b, 0x2a, 0x72, 0x46, 0x39, 0x00,

      /* b 1 0 00, a blank row */
      0x62, 0x01, 0x00, 0x00,

      /* ESC FF NUL, print, feed and cut */
      0x1b, 0x0c, 0x00,

      ...end,
    ];

    it('should cut twice when two cuts follow each other', () => {
      expect(encode(items)).to.deep.equal(expected);
    });
  });

  describe('encode([ feed ])', () => {
    const items = [
      {type: 'feed', height: 24},
    ];

    const expected = [
      ...start,

      /* ESC * r F 1 NUL, the job ends this segment */
      0x1b, 0x2a, 0x72, 0x46, 0x31, 0x00,

      /* ESC * r Y 24 NUL */
      0x1b, 0x2a, 0x72, 0x59, 0x32, 0x34, 0x00,

      /* b 1 0 00, a blank row, the feed needs a buffer */
      0x62, 0x01, 0x00, 0x00,

      ...end,
    ];

    it('should advance the paper for a job of nothing but a feed', () => {
      expect(encode(items)).to.deep.equal(expected);
    });
  });

  describe('encode([ image, feed without a height, cut partial ])', () => {
    const items = [
      {type: 'image', width: 8, height: 1, data: new Uint8Array([0x81])},
      {type: 'feed'},
      {type: 'cut', value: 'partial'},
    ];

    const expected = [
      ...start,

      /* ESC * r F 13 NUL */
      0x1b, 0x2a, 0x72, 0x46, 0x31, 0x33, 0x00,

      /* b 1 0 81 */
      0x62, 0x01, 0x00, 0x81,

      /* ESC * r Y 0 NUL, not NaN */
      0x1b, 0x2a, 0x72, 0x59, 0x30, 0x00,

      /* ESC FF NUL */
      0x1b, 0x0c, 0x00,

      ...end,
    ];

    it('should send zero for a value that is not a number', () => {
      expect(encode(items)).to.deep.equal(expected);
    });
  });

  describe('encode([ image, cut full ]) with the tear bar', () => {
    const items = [
      {type: 'image', width: 8, height: 1, data: new Uint8Array([0x81])},
      {type: 'cut', value: 'full'},
    ];

    const expected = [
      ...start,

      /* ESC * r F 3 NUL, feed to the tear bar, no cut */
      0x1b, 0x2a, 0x72, 0x46, 0x33, 0x00,

      /* b 1 0 81 */
      0x62, 0x01, 0x00, 0x81,

      /* ESC FF NUL, print and feed */
      0x1b, 0x0c, 0x00,

      ...end,
    ];

    it('should feed to the tear bar instead of cutting', () => {
      expect(encode(items, {tearBar: true})).to.deep.equal(expected);
    });
  });

  describe('the quality and the page length', () => {
    const expected = [
      0x1b, 0x2a, 0x72, 0x52,
      0x1b, 0x2a, 0x72, 0x41,

      /* ESC * r Q 1 NUL */
      0x1b, 0x2a, 0x72, 0x51, 0x31, 0x00,

      /* ESC * r P 640 NUL */
      0x1b, 0x2a, 0x72, 0x50, 0x36, 0x34, 0x30, 0x00,

      0x1b, 0x2a, 0x72, 0x45, 0x31, 0x00,

      ...end,
    ];

    it('should send them as ASCII decimal digits', () => {
      expect(encode([], {quality: 1, pageLength: 640})).to.deep.equal(expected);
    });
  });
});
