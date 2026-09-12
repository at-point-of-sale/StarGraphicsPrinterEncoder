import StarGraphicsPrinterEncoder from './star-graphics-printer-encoder.js';

/*
    Entry point of the UMD build.

    The package entry has a default export and a named export, which a UMD
    bundle cannot have both of: its global would become an object with a
    `default` property instead of the class. This module exports the class
    alone, so that the global of the browser bundle is the class itself and
    `new StarGraphicsPrinterEncoder({ ... })` works from a script tag, the way
    it does for ReceiptPrinterEncoder.
*/

export default StarGraphicsPrinterEncoder;
