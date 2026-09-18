# StarGraphicsPrinterEncoder

Encode images to the Star Graphic raster mode commands of the Star TSP100 printer family.

- [About StarGraphicsPrinterEncoder](README.md)
- [Raster mode](#raster-mode)

<br>

> This library is part of [@point-of-sale](https://point-of-sale.dev), a collection of libraries for interfacing browsers and Node with Point of Sale devices such as receipt printers, barcode scanners and customer facing displays.

<br>

## About StarGraphicsPrinterEncoder

The Star TSP100, TSP100ECO, TSP100GT, TSP100II and TSP100III have no fonts and no barcode engine. Star's SDKs call what they do have Star Graphic mode: the printer accepts raster rows, a handful of mode settings, a cut and a drawer pulse, and nothing else. On Windows the futurePRNT driver renders receipts to raster images before sending them; without it, on macOS, ChromeOS and Linux, raster mode is all there is.

This library turns 1-bit images into those commands, and nothing else: where [ReceiptPrinterEncoder](https://github.com/at-point-of-sale/ReceiptPrinterEncoder) encodes receipts for generic thermal printers, this encodes for one specific printer.

It is normally not used directly. A printer driver such as [WebUSBReceiptPrinter](https://github.com/at-point-of-sale/WebUSBReceiptPrinter) or [NetworkReceiptPrinter](https://github.com/at-point-of-sale/NetworkReceiptPrinter) renders a receipt to images with [ReceiptPrinterRenderer](https://github.com/at-point-of-sale/ReceiptPrinterRenderer) and hands the items to this encoder, which is why `encode()` takes exactly the item stream the renderer produces.

The TSP100IV is not part of this family, it speaks StarPRNT natively and needs no raster mode.

<br>

## Installation

```
npm install @point-of-sale/star-graphics-printer-encoder
```

<br>

## Usage

```js
import StarGraphicsPrinterEncoder from '@point-of-sale/star-graphics-printer-encoder';

const encoder = new StarGraphicsPrinterEncoder();

const bytes = encoder.encode([
    {type: 'image', width: 576, height: 412, data: bitmap},
    {type: 'cut', value: 'partial'},
]);

/* bytes is one Uint8Array holding the whole job, from entering raster mode to quitting it */
```

To print a single image there is a shorthand:

```js
const bytes = encoder.encodeImage({width: 576, height: 412, data: bitmap});
```

### Options

| Option | Default | Meaning |
|---|---|---|
| `tearBar` | `false` | True for a model without a cutter, such as the TSP103 and the TSP113. A cut then feeds the paper to the tear bar instead. |
| `quality` | `0` | Print quality, `0` is high speed. |
| `pageLength` | `0` | Page length in dots, `0` is continuous. The maximum is 64000 dots, 32000 on the TSP100IIU; longer output flows over into a next page. |

### Items

`encode(items)` accepts the output of a renderer. Anything it does not understand is ignored.

| Type | Properties | Meaning |
|---|---|---|
| `image` | `width`, `height`, `data` | One bit per pixel, most significant bit first, rows padded to whole bytes, a set bit is a black dot. This is exactly the row format of the raster data command. |
| `feed` | `height` | Advance the paper by this many dot rows, without sending white rows. |
| `cut` | `value` | `full` or `partial`. |
| `pulse` | `device`, `on`, `off` | Open the cash drawer. Times in milliseconds. |

<br>

## Raster mode

The commands come from Star's [STAR Graphic Mode Command Specifications Rev. 2.32](https://starmicronics.com/support/Mannualfolder/star_graphic_cm_en.pdf), cross-checked with what Star's CUPS driver [rastertostar](https://github.com/drobban/starcupsdrv/blob/master/src/rastertostar.c) sends. The specification covers every TSP100 model: U, PU, IIU, GT, LAN, IIIW, IIILAN, IIIBI and IIIU. Digits are ASCII characters, `NUL` is `0x00`.

One rule of raster mode shapes the whole encoder: the mode setting commands, EOT mode, FF mode, page length, quality and the drawer command, are ignored while raster data is in the image buffer. So a cut type cannot be chosen at the moment of the cut. The encoder looks ahead instead: every command item ends a segment, and the FF mode for that segment is set before the first row of the segment is sent, while the buffer is still empty.

And the other way around, the execute commands are ignored when the buffer is empty, so a cut on an empty buffer would not cut at all. A segment that has to cut but has no rows is given one blank row, which is the smallest thing that makes the printer act.

### Job start, buffer empty

| Bytes | Meaning |
|---|---|
| `ESC * r R` `ESC * r A` | Initialize raster mode, enter raster mode. Entering also clears the buffer and resets the modes. |
| `ESC * r Q n NUL` | Print quality, `0` is high speed, the default. |
| `ESC * r P n NUL` | Page length, `0` is continuous. |
| `ESC * r E 1 NUL` | EOT mode `1`: print, no feed, no cut. The end of the job never cuts by itself. |
| `ESC BEL n1 n2` | Drawer pulse width, `n1` on time and `n2` off time in units of 10 ms, 1 to 127. Set once from the first pulse item, or left at the printer default of 200 ms. This setting survives a reset, and it applies to external device 1 only: the timing of device 2 is fixed in the printer. |

### Modes

The values of the FF mode and EOT mode commands, from the specification:

| n | Print | Feed to the cutter | Cut |
|---|---|---|---|
| `1` | yes | no | no |
| `2` | yes | yes | no |
| `3` | yes | tear bar position | no, tear bar models |
| `9` | yes | yes | full |
| `13` | yes | yes | partial |

The cutter modes `9` and `13` are invalid on a model with a tear bar, and mode `3` is invalid on a model with a cutter, so a cut becomes one or the other, which is what the `tearBar` option decides.

### Segments and items

| Item | Bytes |
|---|---|
| start of a segment | `ESC * r F n NUL` with `n` from the command that ends the segment: `13` for a partial cut, `9` for a full cut, `3` for a cut on a tear bar model, `1` for a pulse or the end of the job. |
| image | One `b n1 n2 d..` command per row, `n1 + n2 * 256` bytes of row data, at most 72 on 576 dots. The printer feeds one dot row after each command. Trailing white bytes are trimmed, an all white row is sent as one zero byte. |
| feed | `ESC * r Y n NUL`, with `n` the number of dot rows as ASCII decimal digits. Moves the position without sending rows. |
| cut | `ESC FF NUL`. Executes the FF mode set at the start of the segment, which prints the buffer, feeds and cuts. The buffer is empty afterwards. |
| pulse | `ESC FF NUL` if the segment has rows, which prints them without a cut because its FF mode is `1`, then `ESC * r D n NUL` with `n` `1` for drawer 1 and `2` for drawer 2. This is the raster mode drawer command and it is ignored while data is in the buffer, hence the print first. |

Job end: `ESC FF EOT`, which executes the EOT mode and prints whatever is left without cutting, then `ESC * r B` to quit raster mode.

The line mode drawer commands `BEL` and `SUB` are also listed as valid in raster mode, but `ESC * r D` is the command the specification provides for exactly this case, so this library uses that. The drawer inside raster mode, including the print before the pulse, is verified on a TSP143IIIU; Star's CUPS driver never sends a pulse inside raster mode.

### Scope

USB and network. The TSP100LAN, TSP143IIILAN and TSP143IIIW speak the same protocol over a socket with no driver in between. On Windows futurePRNT claims the USB interface and applications print through its virtual serial port instead; Android applications use the Star SDK. Neither is served by this library.

<br>

-----

<br>

This library has been created by Niels Leenheer under the [MIT license](LICENSE). Feel free to use it in your products. The development of this library is sponsored by Salonhub.

<a href="https://salonhub.nl"><img src="https://point-of-sale.dev/logo.svg" width=100></a>
