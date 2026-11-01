/**
 * Generated from src/client — do not edit. Run `npm run build:remote-web`.
 */
window.__ModuleLoader__.load({
  id: "@catyugu/dsh-remote-web",
  factory(require) {
    var module = { exports: {} }
    var exports = module.exports
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/dsh-remote-web/src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  bindSettingsForm: () => bindSettingsForm,
  inject: () => inject,
  servedEntryId: () => servedEntryId
});
module.exports = __toCommonJS(index_exports);
var import_react8 = require("react");
var import_client = require("react-dom/client");

// packages/dsh-remote-web/src/client/entry/RemoteEntry.tsx
var import_react5 = require("react");
var import_react_dom = require("react-dom");

// node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
function r(e) {
  var t, f, n = "";
  if ("string" == typeof e || "number" == typeof e) n += e;
  else if ("object" == typeof e) if (Array.isArray(e)) {
    var o = e.length;
    for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
  } else for (f in e) e[f] && (n && (n += " "), n += f);
  return n;
}
function clsx() {
  for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
  return n;
}
var clsx_default = clsx;

// packages/dsh-remote-web/src/client/panel/RemotePanel.tsx
var import_react2 = require("react");

// node_modules/.pnpm/qrcode.react@4.2.0_react@18.3.1/node_modules/qrcode.react/lib/esm/index.js
var import_react = __toESM(require("react"), 1);
var __defProp2 = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp2 = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp2.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp2.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var qrcodegen;
((qrcodegen2) => {
  const _QrCode = class _QrCode2 {
    /*-- Constructor (low level) and fields --*/
    // Creates a new QR Code with the given version number,
    // error correction level, data codeword bytes, and mask number.
    // This is a low-level API that most users should not use directly.
    // A mid-level API is the encodeSegments() function.
    constructor(version, errorCorrectionLevel, dataCodewords, msk) {
      this.version = version;
      this.errorCorrectionLevel = errorCorrectionLevel;
      this.modules = [];
      this.isFunction = [];
      if (version < _QrCode2.MIN_VERSION || version > _QrCode2.MAX_VERSION)
        throw new RangeError("Version value out of range");
      if (msk < -1 || msk > 7)
        throw new RangeError("Mask value out of range");
      this.size = version * 4 + 17;
      let row = [];
      for (let i = 0; i < this.size; i++)
        row.push(false);
      for (let i = 0; i < this.size; i++) {
        this.modules.push(row.slice());
        this.isFunction.push(row.slice());
      }
      this.drawFunctionPatterns();
      const allCodewords = this.addEccAndInterleave(dataCodewords);
      this.drawCodewords(allCodewords);
      if (msk == -1) {
        let minPenalty = 1e9;
        for (let i = 0; i < 8; i++) {
          this.applyMask(i);
          this.drawFormatBits(i);
          const penalty = this.getPenaltyScore();
          if (penalty < minPenalty) {
            msk = i;
            minPenalty = penalty;
          }
          this.applyMask(i);
        }
      }
      assert(0 <= msk && msk <= 7);
      this.mask = msk;
      this.applyMask(msk);
      this.drawFormatBits(msk);
      this.isFunction = [];
    }
    /*-- Static factory functions (high level) --*/
    // Returns a QR Code representing the given Unicode text string at the given error correction level.
    // As a conservative upper bound, this function is guaranteed to succeed for strings that have 738 or fewer
    // Unicode code points (not UTF-16 code units) if the low error correction level is used. The smallest possible
    // QR Code version is automatically chosen for the output. The ECC level of the result may be higher than the
    // ecl argument if it can be done without increasing the version.
    static encodeText(text, ecl) {
      const segs = qrcodegen2.QrSegment.makeSegments(text);
      return _QrCode2.encodeSegments(segs, ecl);
    }
    // Returns a QR Code representing the given binary data at the given error correction level.
    // This function always encodes using the binary segment mode, not any text mode. The maximum number of
    // bytes allowed is 2953. The smallest possible QR Code version is automatically chosen for the output.
    // The ECC level of the result may be higher than the ecl argument if it can be done without increasing the version.
    static encodeBinary(data, ecl) {
      const seg = qrcodegen2.QrSegment.makeBytes(data);
      return _QrCode2.encodeSegments([seg], ecl);
    }
    /*-- Static factory functions (mid level) --*/
    // Returns a QR Code representing the given segments with the given encoding parameters.
    // The smallest possible QR Code version within the given range is automatically
    // chosen for the output. Iff boostEcl is true, then the ECC level of the result
    // may be higher than the ecl argument if it can be done without increasing the
    // version. The mask number is either between 0 to 7 (inclusive) to force that
    // mask, or -1 to automatically choose an appropriate mask (which may be slow).
    // This function allows the user to create a custom sequence of segments that switches
    // between modes (such as alphanumeric and byte) to encode text in less space.
    // This is a mid-level API; the high-level API is encodeText() and encodeBinary().
    static encodeSegments(segs, ecl, minVersion = 1, maxVersion = 40, mask = -1, boostEcl = true) {
      if (!(_QrCode2.MIN_VERSION <= minVersion && minVersion <= maxVersion && maxVersion <= _QrCode2.MAX_VERSION) || mask < -1 || mask > 7)
        throw new RangeError("Invalid value");
      let version;
      let dataUsedBits;
      for (version = minVersion; ; version++) {
        const dataCapacityBits2 = _QrCode2.getNumDataCodewords(version, ecl) * 8;
        const usedBits = QrSegment.getTotalBits(segs, version);
        if (usedBits <= dataCapacityBits2) {
          dataUsedBits = usedBits;
          break;
        }
        if (version >= maxVersion)
          throw new RangeError("Data too long");
      }
      for (const newEcl of [_QrCode2.Ecc.MEDIUM, _QrCode2.Ecc.QUARTILE, _QrCode2.Ecc.HIGH]) {
        if (boostEcl && dataUsedBits <= _QrCode2.getNumDataCodewords(version, newEcl) * 8)
          ecl = newEcl;
      }
      let bb = [];
      for (const seg of segs) {
        appendBits(seg.mode.modeBits, 4, bb);
        appendBits(seg.numChars, seg.mode.numCharCountBits(version), bb);
        for (const b of seg.getData())
          bb.push(b);
      }
      assert(bb.length == dataUsedBits);
      const dataCapacityBits = _QrCode2.getNumDataCodewords(version, ecl) * 8;
      assert(bb.length <= dataCapacityBits);
      appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
      appendBits(0, (8 - bb.length % 8) % 8, bb);
      assert(bb.length % 8 == 0);
      for (let padByte = 236; bb.length < dataCapacityBits; padByte ^= 236 ^ 17)
        appendBits(padByte, 8, bb);
      let dataCodewords = [];
      while (dataCodewords.length * 8 < bb.length)
        dataCodewords.push(0);
      bb.forEach((b, i) => dataCodewords[i >>> 3] |= b << 7 - (i & 7));
      return new _QrCode2(version, ecl, dataCodewords, mask);
    }
    /*-- Accessor methods --*/
    // Returns the color of the module (pixel) at the given coordinates, which is false
    // for light or true for dark. The top left corner has the coordinates (x=0, y=0).
    // If the given coordinates are out of bounds, then false (light) is returned.
    getModule(x, y) {
      return 0 <= x && x < this.size && 0 <= y && y < this.size && this.modules[y][x];
    }
    // Modified to expose modules for easy access
    getModules() {
      return this.modules;
    }
    /*-- Private helper methods for constructor: Drawing function modules --*/
    // Reads this object's version field, and draws and marks all function modules.
    drawFunctionPatterns() {
      for (let i = 0; i < this.size; i++) {
        this.setFunctionModule(6, i, i % 2 == 0);
        this.setFunctionModule(i, 6, i % 2 == 0);
      }
      this.drawFinderPattern(3, 3);
      this.drawFinderPattern(this.size - 4, 3);
      this.drawFinderPattern(3, this.size - 4);
      const alignPatPos = this.getAlignmentPatternPositions();
      const numAlign = alignPatPos.length;
      for (let i = 0; i < numAlign; i++) {
        for (let j = 0; j < numAlign; j++) {
          if (!(i == 0 && j == 0 || i == 0 && j == numAlign - 1 || i == numAlign - 1 && j == 0))
            this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
        }
      }
      this.drawFormatBits(0);
      this.drawVersion();
    }
    // Draws two copies of the format bits (with its own error correction code)
    // based on the given mask and this object's error correction level field.
    drawFormatBits(mask) {
      const data = this.errorCorrectionLevel.formatBits << 3 | mask;
      let rem = data;
      for (let i = 0; i < 10; i++)
        rem = rem << 1 ^ (rem >>> 9) * 1335;
      const bits = (data << 10 | rem) ^ 21522;
      assert(bits >>> 15 == 0);
      for (let i = 0; i <= 5; i++)
        this.setFunctionModule(8, i, getBit(bits, i));
      this.setFunctionModule(8, 7, getBit(bits, 6));
      this.setFunctionModule(8, 8, getBit(bits, 7));
      this.setFunctionModule(7, 8, getBit(bits, 8));
      for (let i = 9; i < 15; i++)
        this.setFunctionModule(14 - i, 8, getBit(bits, i));
      for (let i = 0; i < 8; i++)
        this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
      for (let i = 8; i < 15; i++)
        this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
      this.setFunctionModule(8, this.size - 8, true);
    }
    // Draws two copies of the version bits (with its own error correction code),
    // based on this object's version field, iff 7 <= version <= 40.
    drawVersion() {
      if (this.version < 7)
        return;
      let rem = this.version;
      for (let i = 0; i < 12; i++)
        rem = rem << 1 ^ (rem >>> 11) * 7973;
      const bits = this.version << 12 | rem;
      assert(bits >>> 18 == 0);
      for (let i = 0; i < 18; i++) {
        const color = getBit(bits, i);
        const a = this.size - 11 + i % 3;
        const b = Math.floor(i / 3);
        this.setFunctionModule(a, b, color);
        this.setFunctionModule(b, a, color);
      }
    }
    // Draws a 9*9 finder pattern including the border separator,
    // with the center module at (x, y). Modules can be out of bounds.
    drawFinderPattern(x, y) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const xx = x + dx;
          const yy = y + dy;
          if (0 <= xx && xx < this.size && 0 <= yy && yy < this.size)
            this.setFunctionModule(xx, yy, dist != 2 && dist != 4);
        }
      }
    }
    // Draws a 5*5 alignment pattern, with the center module
    // at (x, y). All modules must be in bounds.
    drawAlignmentPattern(x, y) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++)
          this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
      }
    }
    // Sets the color of a module and marks it as a function module.
    // Only used by the constructor. Coordinates must be in bounds.
    setFunctionModule(x, y, isDark) {
      this.modules[y][x] = isDark;
      this.isFunction[y][x] = true;
    }
    /*-- Private helper methods for constructor: Codewords and masking --*/
    // Returns a new byte string representing the given data with the appropriate error correction
    // codewords appended to it, based on this object's version and error correction level.
    addEccAndInterleave(data) {
      const ver = this.version;
      const ecl = this.errorCorrectionLevel;
      if (data.length != _QrCode2.getNumDataCodewords(ver, ecl))
        throw new RangeError("Invalid argument");
      const numBlocks = _QrCode2.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
      const blockEccLen = _QrCode2.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
      const rawCodewords = Math.floor(_QrCode2.getNumRawDataModules(ver) / 8);
      const numShortBlocks = numBlocks - rawCodewords % numBlocks;
      const shortBlockLen = Math.floor(rawCodewords / numBlocks);
      let blocks = [];
      const rsDiv = _QrCode2.reedSolomonComputeDivisor(blockEccLen);
      for (let i = 0, k = 0; i < numBlocks; i++) {
        let dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
        k += dat.length;
        const ecc = _QrCode2.reedSolomonComputeRemainder(dat, rsDiv);
        if (i < numShortBlocks)
          dat.push(0);
        blocks.push(dat.concat(ecc));
      }
      let result = [];
      for (let i = 0; i < blocks[0].length; i++) {
        blocks.forEach((block, j) => {
          if (i != shortBlockLen - blockEccLen || j >= numShortBlocks)
            result.push(block[i]);
        });
      }
      assert(result.length == rawCodewords);
      return result;
    }
    // Draws the given sequence of 8-bit codewords (data and error correction) onto the entire
    // data area of this QR Code. Function modules need to be marked off before this is called.
    drawCodewords(data) {
      if (data.length != Math.floor(_QrCode2.getNumRawDataModules(this.version) / 8))
        throw new RangeError("Invalid argument");
      let i = 0;
      for (let right = this.size - 1; right >= 1; right -= 2) {
        if (right == 6)
          right = 5;
        for (let vert = 0; vert < this.size; vert++) {
          for (let j = 0; j < 2; j++) {
            const x = right - j;
            const upward = (right + 1 & 2) == 0;
            const y = upward ? this.size - 1 - vert : vert;
            if (!this.isFunction[y][x] && i < data.length * 8) {
              this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
              i++;
            }
          }
        }
      }
      assert(i == data.length * 8);
    }
    // XORs the codeword modules in this QR Code with the given mask pattern.
    // The function modules must be marked and the codeword bits must be drawn
    // before masking. Due to the arithmetic of XOR, calling applyMask() with
    // the same mask value a second time will undo the mask. A final well-formed
    // QR Code needs exactly one (not zero, two, etc.) mask applied.
    applyMask(mask) {
      if (mask < 0 || mask > 7)
        throw new RangeError("Mask value out of range");
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          let invert;
          switch (mask) {
            case 0:
              invert = (x + y) % 2 == 0;
              break;
            case 1:
              invert = y % 2 == 0;
              break;
            case 2:
              invert = x % 3 == 0;
              break;
            case 3:
              invert = (x + y) % 3 == 0;
              break;
            case 4:
              invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0;
              break;
            case 5:
              invert = x * y % 2 + x * y % 3 == 0;
              break;
            case 6:
              invert = (x * y % 2 + x * y % 3) % 2 == 0;
              break;
            case 7:
              invert = ((x + y) % 2 + x * y % 3) % 2 == 0;
              break;
            default:
              throw new Error("Unreachable");
          }
          if (!this.isFunction[y][x] && invert)
            this.modules[y][x] = !this.modules[y][x];
        }
      }
    }
    // Calculates and returns the penalty score based on state of this QR Code's current modules.
    // This is used by the automatic mask choice algorithm to find the mask pattern that yields the lowest score.
    getPenaltyScore() {
      let result = 0;
      for (let y = 0; y < this.size; y++) {
        let runColor = false;
        let runX = 0;
        let runHistory = [0, 0, 0, 0, 0, 0, 0];
        for (let x = 0; x < this.size; x++) {
          if (this.modules[y][x] == runColor) {
            runX++;
            if (runX == 5)
              result += _QrCode2.PENALTY_N1;
            else if (runX > 5)
              result++;
          } else {
            this.finderPenaltyAddHistory(runX, runHistory);
            if (!runColor)
              result += this.finderPenaltyCountPatterns(runHistory) * _QrCode2.PENALTY_N3;
            runColor = this.modules[y][x];
            runX = 1;
          }
        }
        result += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * _QrCode2.PENALTY_N3;
      }
      for (let x = 0; x < this.size; x++) {
        let runColor = false;
        let runY = 0;
        let runHistory = [0, 0, 0, 0, 0, 0, 0];
        for (let y = 0; y < this.size; y++) {
          if (this.modules[y][x] == runColor) {
            runY++;
            if (runY == 5)
              result += _QrCode2.PENALTY_N1;
            else if (runY > 5)
              result++;
          } else {
            this.finderPenaltyAddHistory(runY, runHistory);
            if (!runColor)
              result += this.finderPenaltyCountPatterns(runHistory) * _QrCode2.PENALTY_N3;
            runColor = this.modules[y][x];
            runY = 1;
          }
        }
        result += this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * _QrCode2.PENALTY_N3;
      }
      for (let y = 0; y < this.size - 1; y++) {
        for (let x = 0; x < this.size - 1; x++) {
          const color = this.modules[y][x];
          if (color == this.modules[y][x + 1] && color == this.modules[y + 1][x] && color == this.modules[y + 1][x + 1])
            result += _QrCode2.PENALTY_N2;
        }
      }
      let dark = 0;
      for (const row of this.modules)
        dark = row.reduce((sum, color) => sum + (color ? 1 : 0), dark);
      const total = this.size * this.size;
      const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
      assert(0 <= k && k <= 9);
      result += k * _QrCode2.PENALTY_N4;
      assert(0 <= result && result <= 2568888);
      return result;
    }
    /*-- Private helper functions --*/
    // Returns an ascending list of positions of alignment patterns for this version number.
    // Each position is in the range [0,177), and are used on both the x and y axes.
    // This could be implemented as lookup table of 40 variable-length lists of integers.
    getAlignmentPatternPositions() {
      if (this.version == 1)
        return [];
      else {
        const numAlign = Math.floor(this.version / 7) + 2;
        const step = this.version == 32 ? 26 : Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
        let result = [6];
        for (let pos = this.size - 7; result.length < numAlign; pos -= step)
          result.splice(1, 0, pos);
        return result;
      }
    }
    // Returns the number of data bits that can be stored in a QR Code of the given version number, after
    // all function modules are excluded. This includes remainder bits, so it might not be a multiple of 8.
    // The result is in the range [208, 29648]. This could be implemented as a 40-entry lookup table.
    static getNumRawDataModules(ver) {
      if (ver < _QrCode2.MIN_VERSION || ver > _QrCode2.MAX_VERSION)
        throw new RangeError("Version number out of range");
      let result = (16 * ver + 128) * ver + 64;
      if (ver >= 2) {
        const numAlign = Math.floor(ver / 7) + 2;
        result -= (25 * numAlign - 10) * numAlign - 55;
        if (ver >= 7)
          result -= 36;
      }
      assert(208 <= result && result <= 29648);
      return result;
    }
    // Returns the number of 8-bit data (i.e. not error correction) codewords contained in any
    // QR Code of the given version number and error correction level, with remainder bits discarded.
    // This stateless pure function could be implemented as a (40*4)-cell lookup table.
    static getNumDataCodewords(ver, ecl) {
      return Math.floor(_QrCode2.getNumRawDataModules(ver) / 8) - _QrCode2.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] * _QrCode2.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
    }
    // Returns a Reed-Solomon ECC generator polynomial for the given degree. This could be
    // implemented as a lookup table over all possible parameter values, instead of as an algorithm.
    static reedSolomonComputeDivisor(degree) {
      if (degree < 1 || degree > 255)
        throw new RangeError("Degree out of range");
      let result = [];
      for (let i = 0; i < degree - 1; i++)
        result.push(0);
      result.push(1);
      let root = 1;
      for (let i = 0; i < degree; i++) {
        for (let j = 0; j < result.length; j++) {
          result[j] = _QrCode2.reedSolomonMultiply(result[j], root);
          if (j + 1 < result.length)
            result[j] ^= result[j + 1];
        }
        root = _QrCode2.reedSolomonMultiply(root, 2);
      }
      return result;
    }
    // Returns the Reed-Solomon error correction codeword for the given data and divisor polynomials.
    static reedSolomonComputeRemainder(data, divisor) {
      let result = divisor.map((_) => 0);
      for (const b of data) {
        const factor = b ^ result.shift();
        result.push(0);
        divisor.forEach((coef, i) => result[i] ^= _QrCode2.reedSolomonMultiply(coef, factor));
      }
      return result;
    }
    // Returns the product of the two given field elements modulo GF(2^8/0x11D). The arguments and result
    // are unsigned 8-bit integers. This could be implemented as a lookup table of 256*256 entries of uint8.
    static reedSolomonMultiply(x, y) {
      if (x >>> 8 != 0 || y >>> 8 != 0)
        throw new RangeError("Byte out of range");
      let z = 0;
      for (let i = 7; i >= 0; i--) {
        z = z << 1 ^ (z >>> 7) * 285;
        z ^= (y >>> i & 1) * x;
      }
      assert(z >>> 8 == 0);
      return z;
    }
    // Can only be called immediately after a light run is added, and
    // returns either 0, 1, or 2. A helper function for getPenaltyScore().
    finderPenaltyCountPatterns(runHistory) {
      const n = runHistory[1];
      assert(n <= this.size * 3);
      const core = n > 0 && runHistory[2] == n && runHistory[3] == n * 3 && runHistory[4] == n && runHistory[5] == n;
      return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
    }
    // Must be called at the end of a line (row or column) of modules. A helper function for getPenaltyScore().
    finderPenaltyTerminateAndCount(currentRunColor, currentRunLength, runHistory) {
      if (currentRunColor) {
        this.finderPenaltyAddHistory(currentRunLength, runHistory);
        currentRunLength = 0;
      }
      currentRunLength += this.size;
      this.finderPenaltyAddHistory(currentRunLength, runHistory);
      return this.finderPenaltyCountPatterns(runHistory);
    }
    // Pushes the given value to the front and drops the last value. A helper function for getPenaltyScore().
    finderPenaltyAddHistory(currentRunLength, runHistory) {
      if (runHistory[0] == 0)
        currentRunLength += this.size;
      runHistory.pop();
      runHistory.unshift(currentRunLength);
    }
  };
  _QrCode.MIN_VERSION = 1;
  _QrCode.MAX_VERSION = 40;
  _QrCode.PENALTY_N1 = 3;
  _QrCode.PENALTY_N2 = 3;
  _QrCode.PENALTY_N3 = 40;
  _QrCode.PENALTY_N4 = 10;
  _QrCode.ECC_CODEWORDS_PER_BLOCK = [
    // Version: (note that index 0 is for padding, and is set to an illegal value)
    //0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    // Low
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    // Medium
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    // Quartile
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
    // High
  ];
  _QrCode.NUM_ERROR_CORRECTION_BLOCKS = [
    // Version: (note that index 0 is for padding, and is set to an illegal value)
    //0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    // Low
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    // Medium
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    // Quartile
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
    // High
  ];
  let QrCode = _QrCode;
  qrcodegen2.QrCode = _QrCode;
  function appendBits(val, len, bb) {
    if (len < 0 || len > 31 || val >>> len != 0)
      throw new RangeError("Value out of range");
    for (let i = len - 1; i >= 0; i--)
      bb.push(val >>> i & 1);
  }
  function getBit(x, i) {
    return (x >>> i & 1) != 0;
  }
  function assert(cond) {
    if (!cond)
      throw new Error("Assertion error");
  }
  const _QrSegment = class _QrSegment2 {
    /*-- Constructor (low level) and fields --*/
    // Creates a new QR Code segment with the given attributes and data.
    // The character count (numChars) must agree with the mode and the bit buffer length,
    // but the constraint isn't checked. The given bit buffer is cloned and stored.
    constructor(mode, numChars, bitData) {
      this.mode = mode;
      this.numChars = numChars;
      this.bitData = bitData;
      if (numChars < 0)
        throw new RangeError("Invalid argument");
      this.bitData = bitData.slice();
    }
    /*-- Static factory functions (mid level) --*/
    // Returns a segment representing the given binary data encoded in
    // byte mode. All input byte arrays are acceptable. Any text string
    // can be converted to UTF-8 bytes and encoded as a byte mode segment.
    static makeBytes(data) {
      let bb = [];
      for (const b of data)
        appendBits(b, 8, bb);
      return new _QrSegment2(_QrSegment2.Mode.BYTE, data.length, bb);
    }
    // Returns a segment representing the given string of decimal digits encoded in numeric mode.
    static makeNumeric(digits) {
      if (!_QrSegment2.isNumeric(digits))
        throw new RangeError("String contains non-numeric characters");
      let bb = [];
      for (let i = 0; i < digits.length; ) {
        const n = Math.min(digits.length - i, 3);
        appendBits(parseInt(digits.substring(i, i + n), 10), n * 3 + 1, bb);
        i += n;
      }
      return new _QrSegment2(_QrSegment2.Mode.NUMERIC, digits.length, bb);
    }
    // Returns a segment representing the given text string encoded in alphanumeric mode.
    // The characters allowed are: 0 to 9, A to Z (uppercase only), space,
    // dollar, percent, asterisk, plus, hyphen, period, slash, colon.
    static makeAlphanumeric(text) {
      if (!_QrSegment2.isAlphanumeric(text))
        throw new RangeError("String contains unencodable characters in alphanumeric mode");
      let bb = [];
      let i;
      for (i = 0; i + 2 <= text.length; i += 2) {
        let temp = _QrSegment2.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)) * 45;
        temp += _QrSegment2.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
        appendBits(temp, 11, bb);
      }
      if (i < text.length)
        appendBits(_QrSegment2.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6, bb);
      return new _QrSegment2(_QrSegment2.Mode.ALPHANUMERIC, text.length, bb);
    }
    // Returns a new mutable list of zero or more segments to represent the given Unicode text string.
    // The result may use various segment modes and switch modes to optimize the length of the bit stream.
    static makeSegments(text) {
      if (text == "")
        return [];
      else if (_QrSegment2.isNumeric(text))
        return [_QrSegment2.makeNumeric(text)];
      else if (_QrSegment2.isAlphanumeric(text))
        return [_QrSegment2.makeAlphanumeric(text)];
      else
        return [_QrSegment2.makeBytes(_QrSegment2.toUtf8ByteArray(text))];
    }
    // Returns a segment representing an Extended Channel Interpretation
    // (ECI) designator with the given assignment value.
    static makeEci(assignVal) {
      let bb = [];
      if (assignVal < 0)
        throw new RangeError("ECI assignment value out of range");
      else if (assignVal < 1 << 7)
        appendBits(assignVal, 8, bb);
      else if (assignVal < 1 << 14) {
        appendBits(2, 2, bb);
        appendBits(assignVal, 14, bb);
      } else if (assignVal < 1e6) {
        appendBits(6, 3, bb);
        appendBits(assignVal, 21, bb);
      } else
        throw new RangeError("ECI assignment value out of range");
      return new _QrSegment2(_QrSegment2.Mode.ECI, 0, bb);
    }
    // Tests whether the given string can be encoded as a segment in numeric mode.
    // A string is encodable iff each character is in the range 0 to 9.
    static isNumeric(text) {
      return _QrSegment2.NUMERIC_REGEX.test(text);
    }
    // Tests whether the given string can be encoded as a segment in alphanumeric mode.
    // A string is encodable iff each character is in the following set: 0 to 9, A to Z
    // (uppercase only), space, dollar, percent, asterisk, plus, hyphen, period, slash, colon.
    static isAlphanumeric(text) {
      return _QrSegment2.ALPHANUMERIC_REGEX.test(text);
    }
    /*-- Methods --*/
    // Returns a new copy of the data bits of this segment.
    getData() {
      return this.bitData.slice();
    }
    // (Package-private) Calculates and returns the number of bits needed to encode the given segments at
    // the given version. The result is infinity if a segment has too many characters to fit its length field.
    static getTotalBits(segs, version) {
      let result = 0;
      for (const seg of segs) {
        const ccbits = seg.mode.numCharCountBits(version);
        if (seg.numChars >= 1 << ccbits)
          return Infinity;
        result += 4 + ccbits + seg.bitData.length;
      }
      return result;
    }
    // Returns a new array of bytes representing the given string encoded in UTF-8.
    static toUtf8ByteArray(str) {
      str = encodeURI(str);
      let result = [];
      for (let i = 0; i < str.length; i++) {
        if (str.charAt(i) != "%")
          result.push(str.charCodeAt(i));
        else {
          result.push(parseInt(str.substring(i + 1, i + 3), 16));
          i += 2;
        }
      }
      return result;
    }
  };
  _QrSegment.NUMERIC_REGEX = /^[0-9]*$/;
  _QrSegment.ALPHANUMERIC_REGEX = /^[A-Z0-9 $%*+.\/:-]*$/;
  _QrSegment.ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
  let QrSegment = _QrSegment;
  qrcodegen2.QrSegment = _QrSegment;
})(qrcodegen || (qrcodegen = {}));
((qrcodegen2) => {
  let QrCode;
  ((QrCode2) => {
    const _Ecc = class _Ecc {
      // The QR Code can tolerate about 30% erroneous codewords
      /*-- Constructor and fields --*/
      constructor(ordinal, formatBits) {
        this.ordinal = ordinal;
        this.formatBits = formatBits;
      }
    };
    _Ecc.LOW = new _Ecc(0, 1);
    _Ecc.MEDIUM = new _Ecc(1, 0);
    _Ecc.QUARTILE = new _Ecc(2, 3);
    _Ecc.HIGH = new _Ecc(3, 2);
    let Ecc = _Ecc;
    QrCode2.Ecc = _Ecc;
  })(QrCode = qrcodegen2.QrCode || (qrcodegen2.QrCode = {}));
})(qrcodegen || (qrcodegen = {}));
((qrcodegen2) => {
  let QrSegment;
  ((QrSegment2) => {
    const _Mode = class _Mode {
      /*-- Constructor and fields --*/
      constructor(modeBits, numBitsCharCount) {
        this.modeBits = modeBits;
        this.numBitsCharCount = numBitsCharCount;
      }
      /*-- Method --*/
      // (Package-private) Returns the bit width of the character count field for a segment in
      // this mode in a QR Code at the given version number. The result is in the range [0, 16].
      numCharCountBits(ver) {
        return this.numBitsCharCount[Math.floor((ver + 7) / 17)];
      }
    };
    _Mode.NUMERIC = new _Mode(1, [10, 12, 14]);
    _Mode.ALPHANUMERIC = new _Mode(2, [9, 11, 13]);
    _Mode.BYTE = new _Mode(4, [8, 16, 16]);
    _Mode.KANJI = new _Mode(8, [8, 10, 12]);
    _Mode.ECI = new _Mode(7, [0, 0, 0]);
    let Mode = _Mode;
    QrSegment2.Mode = _Mode;
  })(QrSegment = qrcodegen2.QrSegment || (qrcodegen2.QrSegment = {}));
})(qrcodegen || (qrcodegen = {}));
var qrcodegen_default = qrcodegen;
var ERROR_LEVEL_MAP = {
  L: qrcodegen_default.QrCode.Ecc.LOW,
  M: qrcodegen_default.QrCode.Ecc.MEDIUM,
  Q: qrcodegen_default.QrCode.Ecc.QUARTILE,
  H: qrcodegen_default.QrCode.Ecc.HIGH
};
var DEFAULT_SIZE = 128;
var DEFAULT_LEVEL = "L";
var DEFAULT_BGCOLOR = "#FFFFFF";
var DEFAULT_FGCOLOR = "#000000";
var DEFAULT_INCLUDEMARGIN = false;
var DEFAULT_MINVERSION = 1;
var SPEC_MARGIN_SIZE = 4;
var DEFAULT_MARGIN_SIZE = 0;
var DEFAULT_IMG_SCALE = 0.1;
function generatePath(modules, margin = 0) {
  const ops = [];
  modules.forEach(function(row, y) {
    let start = null;
    row.forEach(function(cell, x) {
      if (!cell && start !== null) {
        ops.push(
          `M${start + margin} ${y + margin}h${x - start}v1H${start + margin}z`
        );
        start = null;
        return;
      }
      if (x === row.length - 1) {
        if (!cell) {
          return;
        }
        if (start === null) {
          ops.push(`M${x + margin},${y + margin} h1v1H${x + margin}z`);
        } else {
          ops.push(
            `M${start + margin},${y + margin} h${x + 1 - start}v1H${start + margin}z`
          );
        }
        return;
      }
      if (cell && start === null) {
        start = x;
      }
    });
  });
  return ops.join("");
}
function excavateModules(modules, excavation) {
  return modules.slice().map((row, y) => {
    if (y < excavation.y || y >= excavation.y + excavation.h) {
      return row;
    }
    return row.map((cell, x) => {
      if (x < excavation.x || x >= excavation.x + excavation.w) {
        return cell;
      }
      return false;
    });
  });
}
function getImageSettings(cells, size, margin, imageSettings) {
  if (imageSettings == null) {
    return null;
  }
  const numCells = cells.length + margin * 2;
  const defaultSize = Math.floor(size * DEFAULT_IMG_SCALE);
  const scale = numCells / size;
  const w = (imageSettings.width || defaultSize) * scale;
  const h = (imageSettings.height || defaultSize) * scale;
  const x = imageSettings.x == null ? cells.length / 2 - w / 2 : imageSettings.x * scale;
  const y = imageSettings.y == null ? cells.length / 2 - h / 2 : imageSettings.y * scale;
  const opacity = imageSettings.opacity == null ? 1 : imageSettings.opacity;
  let excavation = null;
  if (imageSettings.excavate) {
    let floorX = Math.floor(x);
    let floorY = Math.floor(y);
    let ceilW = Math.ceil(w + x - floorX);
    let ceilH = Math.ceil(h + y - floorY);
    excavation = { x: floorX, y: floorY, w: ceilW, h: ceilH };
  }
  const crossOrigin = imageSettings.crossOrigin;
  return { x, y, h, w, excavation, opacity, crossOrigin };
}
function getMarginSize(includeMargin, marginSize) {
  if (marginSize != null) {
    return Math.max(Math.floor(marginSize), 0);
  }
  return includeMargin ? SPEC_MARGIN_SIZE : DEFAULT_MARGIN_SIZE;
}
function useQRCode({
  value,
  level,
  minVersion,
  includeMargin,
  marginSize,
  imageSettings,
  size,
  boostLevel
}) {
  let qrcode = import_react.default.useMemo(() => {
    const values = Array.isArray(value) ? value : [value];
    const segments = values.reduce((accum, v) => {
      accum.push(...qrcodegen_default.QrSegment.makeSegments(v));
      return accum;
    }, []);
    return qrcodegen_default.QrCode.encodeSegments(
      segments,
      ERROR_LEVEL_MAP[level],
      minVersion,
      void 0,
      void 0,
      boostLevel
    );
  }, [value, level, minVersion, boostLevel]);
  const { cells, margin, numCells, calculatedImageSettings } = import_react.default.useMemo(() => {
    let cells2 = qrcode.getModules();
    const margin2 = getMarginSize(includeMargin, marginSize);
    const numCells2 = cells2.length + margin2 * 2;
    const calculatedImageSettings2 = getImageSettings(
      cells2,
      size,
      margin2,
      imageSettings
    );
    return {
      cells: cells2,
      margin: margin2,
      numCells: numCells2,
      calculatedImageSettings: calculatedImageSettings2
    };
  }, [qrcode, size, imageSettings, includeMargin, marginSize]);
  return {
    qrcode,
    margin,
    cells,
    numCells,
    calculatedImageSettings
  };
}
var SUPPORTS_PATH2D = (function() {
  try {
    new Path2D().addPath(new Path2D());
  } catch (e) {
    return false;
  }
  return true;
})();
var QRCodeCanvas = import_react.default.forwardRef(
  function QRCodeCanvas2(props, forwardedRef) {
    const _a = props, {
      value,
      size = DEFAULT_SIZE,
      level = DEFAULT_LEVEL,
      bgColor = DEFAULT_BGCOLOR,
      fgColor = DEFAULT_FGCOLOR,
      includeMargin = DEFAULT_INCLUDEMARGIN,
      minVersion = DEFAULT_MINVERSION,
      boostLevel,
      marginSize,
      imageSettings
    } = _a, extraProps = __objRest(_a, [
      "value",
      "size",
      "level",
      "bgColor",
      "fgColor",
      "includeMargin",
      "minVersion",
      "boostLevel",
      "marginSize",
      "imageSettings"
    ]);
    const _b = extraProps, { style } = _b, otherProps = __objRest(_b, ["style"]);
    const imgSrc = imageSettings == null ? void 0 : imageSettings.src;
    const _canvas = import_react.default.useRef(null);
    const _image = import_react.default.useRef(null);
    const setCanvasRef = import_react.default.useCallback(
      (node) => {
        _canvas.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );
    const [isImgLoaded, setIsImageLoaded] = import_react.default.useState(false);
    const { margin, cells, numCells, calculatedImageSettings } = useQRCode({
      value,
      level,
      minVersion,
      boostLevel,
      includeMargin,
      marginSize,
      imageSettings,
      size
    });
    import_react.default.useEffect(() => {
      if (_canvas.current != null) {
        const canvas = _canvas.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return;
        }
        let cellsToDraw = cells;
        const image = _image.current;
        const haveImageToRender = calculatedImageSettings != null && image !== null && image.complete && image.naturalHeight !== 0 && image.naturalWidth !== 0;
        if (haveImageToRender) {
          if (calculatedImageSettings.excavation != null) {
            cellsToDraw = excavateModules(
              cells,
              calculatedImageSettings.excavation
            );
          }
        }
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.height = canvas.width = size * pixelRatio;
        const scale = size / numCells * pixelRatio;
        ctx.scale(scale, scale);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, numCells, numCells);
        ctx.fillStyle = fgColor;
        if (SUPPORTS_PATH2D) {
          ctx.fill(new Path2D(generatePath(cellsToDraw, margin)));
        } else {
          cells.forEach(function(row, rdx) {
            row.forEach(function(cell, cdx) {
              if (cell) {
                ctx.fillRect(cdx + margin, rdx + margin, 1, 1);
              }
            });
          });
        }
        if (calculatedImageSettings) {
          ctx.globalAlpha = calculatedImageSettings.opacity;
        }
        if (haveImageToRender) {
          ctx.drawImage(
            image,
            calculatedImageSettings.x + margin,
            calculatedImageSettings.y + margin,
            calculatedImageSettings.w,
            calculatedImageSettings.h
          );
        }
      }
    });
    import_react.default.useEffect(() => {
      setIsImageLoaded(false);
    }, [imgSrc]);
    const canvasStyle = __spreadValues({ height: size, width: size }, style);
    let img = null;
    if (imgSrc != null) {
      img = /* @__PURE__ */ import_react.default.createElement(
        "img",
        {
          src: imgSrc,
          key: imgSrc,
          style: { display: "none" },
          onLoad: () => {
            setIsImageLoaded(true);
          },
          ref: _image,
          crossOrigin: calculatedImageSettings == null ? void 0 : calculatedImageSettings.crossOrigin
        }
      );
    }
    return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(
      "canvas",
      __spreadValues({
        style: canvasStyle,
        height: size,
        width: size,
        ref: setCanvasRef,
        role: "img"
      }, otherProps)
    ), img);
  }
);
QRCodeCanvas.displayName = "QRCodeCanvas";
var QRCodeSVG = import_react.default.forwardRef(
  function QRCodeSVG2(props, forwardedRef) {
    const _a = props, {
      value,
      size = DEFAULT_SIZE,
      level = DEFAULT_LEVEL,
      bgColor = DEFAULT_BGCOLOR,
      fgColor = DEFAULT_FGCOLOR,
      includeMargin = DEFAULT_INCLUDEMARGIN,
      minVersion = DEFAULT_MINVERSION,
      boostLevel,
      title,
      marginSize,
      imageSettings
    } = _a, otherProps = __objRest(_a, [
      "value",
      "size",
      "level",
      "bgColor",
      "fgColor",
      "includeMargin",
      "minVersion",
      "boostLevel",
      "title",
      "marginSize",
      "imageSettings"
    ]);
    const { margin, cells, numCells, calculatedImageSettings } = useQRCode({
      value,
      level,
      minVersion,
      boostLevel,
      includeMargin,
      marginSize,
      imageSettings,
      size
    });
    let cellsToDraw = cells;
    let image = null;
    if (imageSettings != null && calculatedImageSettings != null) {
      if (calculatedImageSettings.excavation != null) {
        cellsToDraw = excavateModules(
          cells,
          calculatedImageSettings.excavation
        );
      }
      image = /* @__PURE__ */ import_react.default.createElement(
        "image",
        {
          href: imageSettings.src,
          height: calculatedImageSettings.h,
          width: calculatedImageSettings.w,
          x: calculatedImageSettings.x + margin,
          y: calculatedImageSettings.y + margin,
          preserveAspectRatio: "none",
          opacity: calculatedImageSettings.opacity,
          crossOrigin: calculatedImageSettings.crossOrigin
        }
      );
    }
    const fgPath = generatePath(cellsToDraw, margin);
    return /* @__PURE__ */ import_react.default.createElement(
      "svg",
      __spreadValues({
        height: size,
        width: size,
        viewBox: `0 0 ${numCells} ${numCells}`,
        ref: forwardedRef,
        role: "img"
      }, otherProps),
      !!title && /* @__PURE__ */ import_react.default.createElement("title", null, title),
      /* @__PURE__ */ import_react.default.createElement(
        "path",
        {
          fill: bgColor,
          d: `M0,0 h${numCells}v${numCells}H0z`,
          shapeRendering: "crispEdges"
        }
      ),
      /* @__PURE__ */ import_react.default.createElement("path", { fill: fgColor, d: fgPath, shapeRendering: "crispEdges" }),
      image
    );
  }
);
QRCodeSVG.displayName = "QRCodeSVG";

// packages/dsh-remote-web/src/client/panel/RemotePanel.tsx
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// packages/dsh-remote-web/src/client/pair-api.ts
async function readPairFacts() {
  const response = await fetch("api/pair/status");
  if (!response.ok) throw new Error(`dsh-remote-web: status failed with ${String(response.status)}`);
  const value = await response.json();
  return { tunnelTokenStored: value.tunnelTokenStored === true };
}
async function readPairGatePolicy() {
  const response = await fetch("api/pair/status");
  if (!response.ok) throw new Error(`dsh-remote-web: status failed with ${String(response.status)}`);
  const value = await response.json();
  if (typeof value.requirePairingForLan !== "boolean") {
    throw new Error("dsh-remote-web: status omitted requirePairingForLan");
  }
  return { requirePairingForLan: value.requirePairingForLan };
}
async function issuePair(address) {
  const response = await fetch("api/pair/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...address !== void 0 ? { address } : {}
    })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => void 0);
    if (body?.code === "disabled") return { ok: false, code: "disabled" };
    if (response.status === 409) return { ok: false, code: "lan-required" };
    if (response.status === 403) return { ok: false, code: "forbidden" };
    if (response.status === 400) return { ok: false, code: "unknown-address" };
    throw new Error(`dsh-remote-web: issue failed with ${String(response.status)}`);
  }
  return await response.json();
}
async function acceptPair(token) {
  const response = await fetch("api/pair/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token })
  });
  if (response.ok) return { ok: true };
  if (response.status === 404 || response.status === 409) return { ok: false, code: "invalid" };
  return { ok: false, code: "forbidden" };
}
async function stopPair() {
  const response = await fetch("api/pair/stop", { method: "POST" });
  if (!response.ok) throw new Error(`dsh-remote-web: stop failed with ${String(response.status)}`);
}
async function revokePair(deviceId) {
  const response = await fetch("api/pair/revoke", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId })
  });
  if (response.status === 404) return;
  if (!response.ok) throw new Error(`dsh-remote-web: revoke failed with ${String(response.status)}`);
}
async function sendHeartbeat() {
  const response = await fetch("api/pair/heartbeat", { method: "POST" });
  return response.status;
}
function shouldStopHeartbeat(status) {
  return status === 401 || status === 403;
}
function readPairParams(search) {
  const params = new URLSearchParams(search);
  const pair = params.get("pair");
  return pair !== null && pair !== "" ? { pair } : {};
}
var LanBindStatusError = class extends Error {
  /**
   * @param status - the response status, or undefined when the request failed
   *   before a response (network error).
   * @param message - the diagnostic message.
   */
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "LanBindStatusError";
  }
  status;
};
async function readLanBindStatus() {
  const response = await fetch("api/pair/lan-bind");
  if (!response.ok) throw new LanBindStatusError(response.status, `dsh-remote-web: lan-bind status failed with ${String(response.status)}`);
  return await response.json();
}
function shouldStopLanBindPoll(status) {
  return status === 401 || status === 403;
}
function formatClock(epochMs) {
  const date = new Date(epochMs);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
function formatLastSeen(epochMs) {
  const date = new Date(epochMs);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day} ${formatClock(epochMs)}`;
}
async function copyText(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard !== void 0) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
    }
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

// packages/dsh-remote-web/src/client/device-name.ts
function deviceNameFromUserAgent(userAgent) {
  if (userAgent === void 0 || userAgent.trim() === "") return void 0;
  const os = /Windows NT/i.test(userAgent) ? "Windows" : /Android/i.test(userAgent) ? "Android" : /iPhone|iPad|iPod/i.test(userAgent) ? "iOS" : /Macintosh|Mac OS X/i.test(userAgent) ? "macOS" : /Linux/i.test(userAgent) ? "Linux" : void 0;
  const browser = /Edg(?:A|iOS)?\//i.test(userAgent) ? "Edge" : /(?:OPR|Opera)\//i.test(userAgent) ? "Opera" : /(?:Chrome|CriOS)\//i.test(userAgent) ? "Chrome" : /(?:Firefox|FxiOS)\//i.test(userAgent) ? "Firefox" : /Safari\//i.test(userAgent) && /Version\//i.test(userAgent) ? "Safari" : void 0;
  if (os !== void 0 && browser !== void 0) return `${os} \xB7 ${browser}`;
  return os ?? browser;
}

// packages/dsh-remote-web/src/client/panel/remote.module.css
var css = "/* Mobile remote-control seat + panel (design tokens only \u2014 no literal\n   colors). The trigger matches the settings row/rail geometry; the panel is\n   a centered modal (mask + 560px card) like the settings panel. */\n\n.overlay_2e6a1f {\n  position: fixed;\n  inset: 0;\n  z-index: 1000;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.mask_2e6a1f {\n  position: absolute;\n  inset: 0;\n  background: var(--dsw-alias-bg-mask-1);\n  backdrop-filter: var(--dsw-mask-blur);\n}\n\n/* Trigger: the 36px rail circle, or a fully rounded (pill) full-row button\n   in wide mode \u2014 both maximally rounded so the seat's occupants (this\n   trigger, the dsh-update trigger, the usage card) share one shape family\n   (#1035); the seat's owner (ui-sidebar) lays out the geometry. */\n.trigger_2e6a1f {\n  position: relative;\n  flex: none;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 36px;\n  height: 36px;\n  border: none;\n  border-radius: 50%;\n  padding: 0;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n  /* Transition + focus ring consent (box-shadow from :focus-visible). */\n  transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;\n}\n\n.trigger_2e6a1f[data-wide='wide'] {\n  flex: 1 1 auto;\n  justify-content: flex-start;\n  width: auto;\n  min-width: 0;\n  /* Pill: maximal rounding, the same shape family as the 36px rail circle\n     beside it \u2014 one consistent footer-action look (#1035). */\n  border-radius: 999px;\n  gap: 8px;\n  padding: 0 10px;\n}\n\n.trigger_2e6a1f:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.trigger_2e6a1f:active:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-active);\n}\n\n.trigger_2e6a1f:focus-visible {\n  outline: none;\n  box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary);\n}\n\n.trigger_2e6a1f:disabled {\n  opacity: 0.5;\n  cursor: default;\n}\n\n.panel_2e6a1f {\n  position: relative;\n  z-index: 1;\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n  width: 560px;\n  max-width: calc(100vw - 48px);\n  max-height: calc(100vh - 48px);\n  overflow: auto;\n  box-sizing: border-box;\n  padding: 24px;\n  border-radius: 24px;\n  background: var(--dsw-alias-bg-layer-2);\n  box-shadow: var(--dsw-shadow-lv3);\n  color: var(--dsw-alias-label-primary);\n  font-size: 14px;\n  line-height: 22px;\n}\n\n.header_2e6a1f {\n  display: flex;\n  align-items: flex-start;\n  gap: 12px;\n}\n\n.heading_2e6a1f {\n  flex: 1;\n  min-width: 0;\n}\n\n.title_2e6a1f {\n  margin: 0;\n  font-size: 18px;\n  font-weight: 600;\n  line-height: 26px;\n}\n\n.subtitle_2e6a1f {\n  margin: 4px 0 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n}\n\n.close_2e6a1f {\n  flex: none;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  border: none;\n  border-radius: 50%;\n  padding: 0;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n  transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;\n}\n\n.close_2e6a1f:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.close_2e6a1f:active:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-active);\n}\n\n.close_2e6a1f:focus-visible {\n  outline: none;\n  box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary);\n}\n\n.close_2e6a1f:disabled {\n  opacity: 0.5;\n  cursor: default;\n}\n\n.card_2e6a1f {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 12px;\n  padding: 16px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 16px;\n  background: var(--dsw-alias-bg-layer-1);\n}\n\n.cardHeader_2e6a1f {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  width: 100%;\n  gap: 12px;\n}\n\n.cardTitle_2e6a1f {\n  font-weight: 500;\n}\n\n.badge_2e6a1f {\n  display: inline-flex;\n  flex: none;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n  padding: 2px 10px;\n  border-radius: 999px;\n  font-size: 12px;\n  line-height: 18px;\n  white-space: nowrap;\n}\n\n.badge_2e6a1f::before {\n  content: '';\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;\n  background: currentColor;\n}\n\n.badge-waiting_2e6a1f {\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.badge-connected_2e6a1f {\n  color: var(--dsw-alias-state-success-primary);\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.badge-disconnected_2e6a1f {\n  color: var(--dsw-alias-state-warn-primary);\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.badge-stopped_2e6a1f {\n  color: var(--dsw-alias-state-error-primary);\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.badgePublic_2e6a1f {\n  color: var(--dsw-alias-brand-primary);\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.badges_2e6a1f {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  flex: none;\n}\n\n.qrWrap_2e6a1f {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 12px;\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-base);\n}\n\n.qr_2e6a1f {\n  display: block;\n}\n\n.expired_2e6a1f {\n  margin: 0;\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 13px;\n}\n\n.expiry_2e6a1f {\n  margin: 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n}\n\n.hint_2e6a1f {\n  margin: 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n}\n\n.link_2e6a1f {\n  display: block;\n  margin: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: var(--dsw-alias-label-caption);\n  font-family: var(--dsw-font-mono, ui-monospace, monospace);\n  font-size: 12px;\n}\n\n.pairLinks_2e6a1f {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.pairLinkRow_2e6a1f {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  min-width: 0;\n  padding: 10px 12px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-1);\n}\n\n.pairLinkText_2e6a1f {\n  min-width: 0;\n  flex: 1;\n}\n\n.pairLinkLabel_2e6a1f {\n  display: block;\n  margin-bottom: 3px;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n}\n\n.copyLink_2e6a1f {\n  display: inline-flex;\n  flex: none;\n  align-items: center;\n  gap: 5px;\n  min-height: 30px;\n  padding: 0 10px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  background: var(--dsw-alias-button-elevated-fill);\n  color: var(--dsw-alias-label-primary);\n  cursor: pointer;\n}\n\n.oneTimeHint_2e6a1f {\n  margin: 0;\n  color: var(--dsw-alias-label-caption);\n  font-size: 12px;\n}\n\n.stoppedHint_2e6a1f {\n  margin: 0;\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 13px;\n}\n\n.tunnelNote_2e6a1f {\n  margin: 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n}\n\n.tunnelFailed_2e6a1f {\n  margin: 0;\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 13px;\n}\n\n.actions_2e6a1f {\n  display: flex;\n  gap: 8px;\n}\n\n.action_2e6a1f {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  height: 34px;\n  padding: 0 14px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 10px;\n  background: var(--dsw-alias-button-elevated-fill);\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  cursor: pointer;\n  white-space: nowrap;\n  transition: background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease;\n}\n\n.action_2e6a1f:hover:not(:disabled) {\n  background: var(--dsw-alias-button-floating-hover);\n}\n\n.action_2e6a1f:active:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-active);\n}\n\n.action_2e6a1f:focus-visible {\n  outline: none;\n  box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary);\n}\n\n.action_2e6a1f:disabled {\n  opacity: 0.5;\n  cursor: default;\n}\n\n.banner_2e6a1f {\n  padding: 16px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 16px;\n  background: var(--dsw-alias-bg-layer-1);\n}\n\n.bannerTitle_2e6a1f {\n  margin: 0;\n  color: var(--dsw-alias-state-warn-primary);\n  font-weight: 500;\n}\n\n.bannerHint_2e6a1f {\n  margin: 6px 0 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n}\n\n/* Banner-local action row (the disabled notice's re-open retry). */\n.bannerActions_2e6a1f {\n  display: flex;\n  gap: 8px;\n  margin-top: 12px;\n}\n\n/* Unpaired remote desktop: opaque, blocking page above the shell. */\n.fencePage_2e6a1f {\n  position: fixed;\n  inset: 0;\n  z-index: 2000;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  overflow: auto;\n  box-sizing: border-box;\n  padding: 40px 24px;\n  background: var(--dsw-alias-bg-base);\n  text-align: center;\n}\n\n.fenceCard_2e6a1f {\n  width: min(520px, 100%);\n  margin-inline: auto;\n  box-sizing: border-box;\n  padding: 36px 40px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 20px;\n  background: var(--dsw-alias-bg-layer-1);\n  box-shadow: var(--dsw-shadow-lv3);\n  text-align: center;\n}\n\n.fenceMark_2e6a1f {\n  display: grid;\n  place-items: center;\n  width: 44px;\n  height: 44px;\n  margin-inline: auto;\n  border-radius: 50%;\n  background: var(--dsw-alias-state-error-secondary);\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 24px;\n  line-height: 1;\n}\n\n.fenceEyebrow_2e6a1f {\n  margin: 22px 0 8px;\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 13px;\n  font-weight: 600;\n}\n\n.fenceTitle_2e6a1f {\n  margin: 0;\n  color: var(--dsw-alias-label-primary);\n  font-size: 24px;\n  line-height: 1.35;\n}\n\n.fenceDetail_2e6a1f {\n  margin: 12px 0 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 14px;\n  line-height: 1.65;\n}\n\n.fenceSteps_2e6a1f {\n  margin: 24px auto 0;\n  padding: 20px 20px 20px 42px;\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 14px;\n  line-height: 1.65;\n  text-align: left;\n}\n\n.fenceSteps_2e6a1f li + li {\n  margin-top: 8px;\n}\n\n.fenceForm_2e6a1f {\n  margin-top: 20px;\n  width: 100%;\n}\n\n.fenceInputRow_2e6a1f {\n  display: flex;\n  gap: 8px;\n  width: 100%;\n}\n\n.fenceInput_2e6a1f {\n  flex: 1;\n  min-width: 0;\n  padding: 10px 14px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 13px;\n  transition: border-color 120ms ease, box-shadow 120ms ease;\n}\n\n.fenceInput_2e6a1f:focus {\n  outline: none;\n  border-color: var(--dsw-alias-brand-primary);\n  box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.15);\n}\n\n.fencePairButton_2e6a1f {\n  flex-shrink: 0;\n  padding: 10px 18px;\n  /* The matched primary-action set (contracts/primary-action-tokens-v1.md_2e6a1f):\n     brand-primary is an accent/foreground token, not a button fill \u2014 with a\n     hardcoded #fff label it rendered white-on-white in the dark theme, so the\n     pairing CTA was invisible on a phone unless a skin declared a saturated\n     brand (the \"only one skin works\" report). */\n  border: 1px solid var(--dsw-alias-button-primary-fill);\n  border-radius: 10px;\n  background: var(--dsw-alias-button-primary-fill);\n  color: var(--dsw-alias-label-primary-foreground);\n  font: inherit;\n  font-size: 13px;\n  font-weight: 500;\n  cursor: pointer;\n  transition: filter 120ms ease, opacity 120ms ease;\n}\n\n.fencePairButton_2e6a1f:hover:not(:disabled) {\n  background: var(--dsw-alias-button-primary-hover, var(--dsw-alias-button-primary-fill));\n  border-color: var(--dsw-alias-button-primary-hover, var(--dsw-alias-button-primary-fill));\n}\n\n.fencePairButton_2e6a1f:disabled {\n  opacity: 0.55;\n  cursor: not-allowed;\n}\n\n.fencePairButton_2e6a1f:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: 2px;\n}\n\n.fenceError_2e6a1f {\n  margin: 10px 0 0;\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 13px;\n  line-height: 1.4;\n  text-align: left;\n}\n\n.fenceRetry_2e6a1f {\n  width: 100%;\n  margin-top: 12px;\n  padding: 10px 16px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 10px;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font: inherit;\n  font-weight: 500;\n  cursor: pointer;\n  transition: background-color 120ms ease, color 120ms ease;\n}\n\n.fenceRetry_2e6a1f:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.fenceRetry_2e6a1f:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: 3px;\n}\n\n.fenceFootnote_2e6a1f {\n  margin: 14px 0 0;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 1.55;\n}\n\n/* Multi-homed address picker: one radio per constructible LAN literal. */\n.addresses_2e6a1f {\n  margin: 12px 0 0;\n  padding: 0;\n  border: none;\n}\n\n.addresses_2e6a1f legend {\n  padding: 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n}\n\n.address_2e6a1f {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-top: 6px;\n  padding: 4px 6px;\n  border-radius: 6px;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  font-variant-numeric: tabular-nums;\n  cursor: pointer;\n  transition: background-color 120ms ease;\n}\n\n.address_2e6a1f:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.address_2e6a1f input:focus-visible {\n  outline: none;\n  box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary);\n  border-radius: 50%;\n}\n\n.addressValue_2e6a1f {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n}\n\n.addressHint_2e6a1f {\n  margin: 6px 0 0;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n}\n\n.devices_2e6a1f {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding: 12px 16px 14px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 16px;\n  background: var(--dsw-alias-bg-layer-1);\n}\n\n.devicesTitle_2e6a1f {\n  margin: 0;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 20px;\n}\n\n.devicesEmpty_2e6a1f {\n  margin: 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n}\n\n.deviceList_2e6a1f {\n  margin: 0;\n  padding: 0;\n  list-style: none;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.deviceRow_2e6a1f {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.deviceMeta_2e6a1f {\n  min-width: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n}\n\n.deviceName_2e6a1f {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 13px;\n  font-weight: 500;\n}\n\n.devicePresence_2e6a1f {\n  font-size: 12px;\n  line-height: 18px;\n}\n\n.deviceOnline_2e6a1f {\n  color: var(--dsw-alias-state-success-primary);\n}\n\n.deviceOffline_2e6a1f {\n  color: var(--dsw-alias-label-secondary);\n}\n\n.deviceSeen_2e6a1f {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  font-variant-numeric: tabular-nums;\n}\n\n.deviceRevoke_2e6a1f {\n  flex: none;\n  border: none;\n  border-radius: 8px;\n  padding: 6px 10px;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n  cursor: pointer;\n  transition: background-color 120ms ease, color 120ms ease;\n}\n\n.deviceRevoke_2e6a1f:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.deviceRevoke_2e6a1f:focus-visible {\n  outline: none;\n  box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary);\n}\n\n/* Accessibility: collapse the interaction transitions for reduced-motion\n   users. The panel chrome is already static; this just disables the\n   hover/active/focus cross-fades added above. */\n@media (prefers-reduced-motion: reduce) {\n  .trigger_2e6a1f,\n  .close_2e6a1f,\n  .action_2e6a1f,\n  .address_2e6a1f,\n  .deviceRevoke_2e6a1f {\n    transition: none;\n  }\n}\n\n/* Footer seat row: this plugin's own occupant (the remote trigger) sits in\n   the shared sidebar.footer_2e6a1f.action_2e6a1f seat; the rail marker lets the seat stack\n   its occupants in the 56px icon column (see the rail rule below). */\n.entryRow_2e6a1f {\n  flex: none;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n}\n\n.entryRow_2e6a1f[data-rail='rail'] {\n  flex-direction: column-reverse;\n  gap: 4px;\n}\n\n/* \u2500\u2500 Wide foot row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n   The official Settings trigger owns a whole row while the footer actions\n   stack above it, so the trigger's right half sits empty. On the wide column\n   the two share one line (the Settings trigger, then the footer-action\n   occupants \u2014 this trigger, the dsh-update trigger, another plugin's control)\n   and every other foot child (the usage glance card, another plugin's block)\n   keeps a full row of its own above them. The rail (data-sidebar-collapsed on\n   the frame) keeps the shell's stacked foot, where the circles stack by\n   design. The shell owns the container classes; the semantic suffixes survive\n   its rebuilds. */\n[data-dsh-frame]:not([data-sidebar-collapsed]) [class*='footArea'] {\n  flex-direction: row;\n  flex-wrap: wrap;\n  align-items: center;\n}\n\n[data-dsh-frame]:not([data-sidebar-collapsed]) [class*='footArea'] > :not([class*='settingsArea']):not([class*='footerActions']) {\n  flex: 1 1 100%;\n  min-width: 0;\n}\n\n[data-dsh-frame]:not([data-sidebar-collapsed]) [class*='footArea'] > [class*='footerActions'] {\n  /* The seat's own slot host is already `display: contents`, so the seat's box\n     is what decided its occupants' layout. That made this plugin's rule fatal\n     to a SHARED container (issue #1710): the moment any other plugin registered\n     into `sidebar.footer_2e6a1f.action_2e6a1f` \u2014 the reporter had a 339px balance stack and a\n     context panel \u2014 the seat became a tall column, and the settings trigger,\n     which is a shell element this plugin does not own, was squeezed to 102px and\n     vertically centred inside it (`y534 = 351 + (417-50)/2`).\n     Dropping the box hands every occupant back to the foot's own wrapping\n     layout, where each one is sized on its own merits. */\n  display: contents;\n}\n\n/* A registrant that is not one of the family's own footer entries (an\n   icon-sized row) takes a full line of its own above the bottom row. This is\n   the shell's own intent for the seat, and it is what keeps a tall third-party\n   block from displacing the settings trigger. */\n[data-dsh-frame]:not([data-sidebar-collapsed]) [class*='footerActions'] > [data-slot='sidebar.footer.action'] > :not([data-dsh-part='entry']):not([class*='entryRow']) {\n  flex: 1 1 100%;\n  order: 1;\n  min-width: 0;\n}\n\n/* The family's own footer entries keep their intrinsic width and close the\n   bottom row, sharing it with the settings trigger. `data-dsh-part=\"entry\"` is\n   the family contract for these triggers (dsh-update, dsh-session-id); the\n   remote trigger marks its row with its own class. */\n[data-dsh-frame]:not([data-sidebar-collapsed]) [class*='footerActions'] > [data-slot='sidebar.footer.action'] > [data-dsh-part='entry'],\n[data-dsh-frame]:not([data-sidebar-collapsed]) [class*='footerActions'] > [data-slot='sidebar.footer.action'] > [class*='entryRow'] {\n  flex: 0 0 auto;\n  order: 4;\n  min-width: 0;\n}\n\n[data-dsh-frame]:not([data-sidebar-collapsed]) [class*='settingsArea'] {\n  order: 3;\n  /* Content-sized basis: the trigger's own width forces it onto the line after\n     a full-width sibling, then flex-shrink gives the actions their space. */\n  flex: 1 1 auto;\n  width: auto;\n  min-width: 0;\n}\n\n/* \u2500\u2500 Collapsed rail foot seat \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n   The shell renders `sidebar.footer_2e6a1f.action_2e6a1f` as a centered horizontal row\n   in both column states. In the 56px rail that row is only as wide as its\n   occupants, so a second registrar overflows the icon column on both sides:\n   with two 36px circles the seat measures 78px against a 35px column, and\n   the outer buttons land at x=-11 and x=31 while every other rail row sits\n   at x=10 (issue #1678). Stack the seat vertically whenever a rail-marked\n   occupant is inside it, so each circle keeps the 36px rail column the\n   shell uses elsewhere; the wide column never matches this rule. The anchor\n   is this plugin's own `data-rail` marker, so the rule is an equal-value\n   no-op for a shell that already stacks its foot. */\n[data-dsh-frame][data-sidebar-collapsed] [class*='footerActions']:has([data-rail='rail']) {\n  flex-direction: column;\n  align-items: center;\n  gap: 4px;\n}\n\n/* One sheet, two sections: the pairing panel and the settings form share the\n   popup, so a user configures the row where they pair a device. The stack\n   owns the modal chrome the panel used to carry alone. */\n.stack_2e6a1f {\n  position: relative;\n  z-index: 1;\n  display: flex;\n  flex-direction: column;\n  gap: 18px;\n  width: 560px;\n  max-width: calc(100vw - 48px);\n  max-height: calc(100vh - 48px);\n  overflow: auto;\n  box-sizing: border-box;\n  padding: 24px;\n  border-radius: 24px;\n  background: var(--dsw-alias-bg-layer-2);\n  box-shadow: var(--dsw-shadow-lv3);\n  color: var(--dsw-alias-label-primary);\n  font-size: 14px;\n  line-height: 22px;\n}\n\n.stack_2e6a1f > .panel_2e6a1f {\n  width: auto;\n  max-width: none;\n  max-height: none;\n  overflow: visible;\n  padding: 0;\n  border-radius: 0;\n  background: transparent;\n  box-shadow: none;\n  color: inherit;\n}\n\n.settingsSection_2e6a1f {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}";
var id = "@catyugu/dsh-remote-web/remote.module.css";
if (typeof document !== "undefined" && document.getElementById(id) === null) {
  const tag = document.createElement("style");
  tag.id = id;
  tag.dataset.plugin = "@catyugu/dsh-remote-web";
  tag.textContent = css;
  document.head.appendChild(tag);
}
var remote_default = { "overlay": "overlay_2e6a1f", "mask": "mask_2e6a1f", "trigger": "trigger_2e6a1f", "panel": "panel_2e6a1f", "header": "header_2e6a1f", "heading": "heading_2e6a1f", "title": "title_2e6a1f", "subtitle": "subtitle_2e6a1f", "close": "close_2e6a1f", "card": "card_2e6a1f", "cardHeader": "cardHeader_2e6a1f", "cardTitle": "cardTitle_2e6a1f", "badge": "badge_2e6a1f", "badge-waiting": "badge-waiting_2e6a1f", "badge-connected": "badge-connected_2e6a1f", "badge-disconnected": "badge-disconnected_2e6a1f", "badge-stopped": "badge-stopped_2e6a1f", "badgePublic": "badgePublic_2e6a1f", "badges": "badges_2e6a1f", "qrWrap": "qrWrap_2e6a1f", "qr": "qr_2e6a1f", "expired": "expired_2e6a1f", "expiry": "expiry_2e6a1f", "hint": "hint_2e6a1f", "link": "link_2e6a1f", "pairLinks": "pairLinks_2e6a1f", "pairLinkRow": "pairLinkRow_2e6a1f", "pairLinkText": "pairLinkText_2e6a1f", "pairLinkLabel": "pairLinkLabel_2e6a1f", "copyLink": "copyLink_2e6a1f", "oneTimeHint": "oneTimeHint_2e6a1f", "stoppedHint": "stoppedHint_2e6a1f", "tunnelNote": "tunnelNote_2e6a1f", "tunnelFailed": "tunnelFailed_2e6a1f", "actions": "actions_2e6a1f", "action": "action_2e6a1f", "banner": "banner_2e6a1f", "bannerTitle": "bannerTitle_2e6a1f", "bannerHint": "bannerHint_2e6a1f", "bannerActions": "bannerActions_2e6a1f", "fencePage": "fencePage_2e6a1f", "fenceCard": "fenceCard_2e6a1f", "fenceMark": "fenceMark_2e6a1f", "fenceEyebrow": "fenceEyebrow_2e6a1f", "fenceTitle": "fenceTitle_2e6a1f", "fenceDetail": "fenceDetail_2e6a1f", "fenceSteps": "fenceSteps_2e6a1f", "fenceForm": "fenceForm_2e6a1f", "fenceInputRow": "fenceInputRow_2e6a1f", "fenceInput": "fenceInput_2e6a1f", "fencePairButton": "fencePairButton_2e6a1f", "md": "md_2e6a1f", "fenceError": "fenceError_2e6a1f", "fenceRetry": "fenceRetry_2e6a1f", "fenceFootnote": "fenceFootnote_2e6a1f", "addresses": "addresses_2e6a1f", "address": "address_2e6a1f", "addressValue": "addressValue_2e6a1f", "addressHint": "addressHint_2e6a1f", "devices": "devices_2e6a1f", "devicesTitle": "devicesTitle_2e6a1f", "devicesEmpty": "devicesEmpty_2e6a1f", "deviceList": "deviceList_2e6a1f", "deviceRow": "deviceRow_2e6a1f", "deviceMeta": "deviceMeta_2e6a1f", "deviceName": "deviceName_2e6a1f", "devicePresence": "devicePresence_2e6a1f", "deviceOnline": "deviceOnline_2e6a1f", "deviceOffline": "deviceOffline_2e6a1f", "deviceSeen": "deviceSeen_2e6a1f", "deviceRevoke": "deviceRevoke_2e6a1f", "footer": "footer_2e6a1f", "entryRow": "entryRow_2e6a1f", "stack": "stack_2e6a1f", "settingsSection": "settingsSection_2e6a1f" };

// packages/dsh-remote-web/src/client/panel/RemotePanel.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var PairQrCode = (0, import_react2.memo)(function PairQrCode2({ url, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QRCodeSVG, { value: url, size: 184, level: "M", marginSize: 1, className });
});
function statusOf(t, state) {
  switch (state.phase) {
    case "connected":
      return { text: t("status.connected", { n: state.onlineCount }), tone: "connected" };
    case "disconnected":
      return { text: t("status.disconnected"), tone: "disconnected" };
    case "stopped":
      return { text: t("status.stopped"), tone: "stopped" };
    case "lan-required":
      return { text: t("status.lanRequired"), tone: "stopped" };
    case "waiting":
      return { text: t("status.waiting"), tone: "waiting" };
  }
}
function RemotePanel({
  t,
  state,
  copied,
  copiedToken,
  onClose,
  onStop,
  onRefresh,
  onCopy,
  onCopyToken,
  onPickAddress,
  onPickPublic,
  onRevoke
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.panel, role: "dialog", "aria-modal": "true", "aria-label": t("title"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.heading, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: remote_default.title, children: t("title") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.subtitle, children: t("subtitle") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: remote_default.close, "aria-label": t("close.label"), onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 }) })
    ] }),
    state.kind === "lan-required" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.banner, role: "alert", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.bannerTitle, children: t("status.lanRequired") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.bannerHint, children: t("status.lanRequiredHint") })
    ] }) : state.kind === "loopback-required" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.banner, role: "alert", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.bannerTitle, children: t("status.loopbackRequired") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.bannerHint, children: t("status.loopbackRequiredHint") })
    ] }) : state.kind === "unreachable" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.banner, role: "alert", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.bannerTitle, children: t("status.unreachable") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.bannerHint, children: t("status.unreachableHint") })
    ] }) : state.kind === "disabled" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.banner, role: "alert", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.bannerTitle, children: t("status.disabled") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.bannerHint, children: t("status.disabledHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: remote_default.bannerActions, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: remote_default.action, onClick: onRefresh, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 }),
        t("action.refresh")
      ] }) })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      state.posture !== void 0 && state.posture.hosts.some((host) => host.exposed) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.banner, role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.bannerTitle, children: t("posture.exposed") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.bannerHint, children: t("posture.exposedHint", { hosts: state.posture.hosts.filter((host) => host.exposed).map((host) => host.host).join(", ") }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.card, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.cardHeader, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: remote_default.cardTitle, children: t("card.title") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: remote_default.badges, children: [
            state.public && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: clsx_default(remote_default.badge, remote_default.badgePublic), children: t("public.badge") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: clsx_default(remote_default.badge, remote_default[`badge-${statusOf(t, state).tone}`]), children: statusOf(t, state).text })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: remote_default.qrWrap, "data-testid": "remote-qr", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PairQrCode, { url: state.url, className: remote_default.qr }) }),
        state.expired ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.expired, children: t("pair.expired") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.expiry, children: t("pair.expires", { time: formatClock(state.expiresAt) }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.hint, children: state.public ? t("pair.publicHint") : t("pair.hint") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.pairLinks, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.pairLinkRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.pairLinkText, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: remote_default.pairLinkLabel, children: t("pair.linkLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { className: remote_default.link, title: state.url, children: state.url })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: remote_default.copyLink, onClick: () => onCopy(state.url), children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 14 }),
            copied ? t("action.copied") : t("action.copyLink")
          ] })
        ] }),
        state.token !== void 0 && state.token !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.pairLinkRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.pairLinkText, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: remote_default.pairLinkLabel, children: t("pair.tokenLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { className: remote_default.link, title: state.token, children: state.token })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "button",
            {
              type: "button",
              className: remote_default.copyLink,
              onClick: () => onCopyToken ? onCopyToken(state.token) : onCopy(state.token),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 14 }),
                copiedToken ? t("action.copiedToken") : t("action.copyToken")
              ]
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: remote_default.oneTimeHint, children: [
        t("pair.oneTimeHint"),
        " ",
        t("pair.dockerHint")
      ] }),
      state.phase === "stopped" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.stoppedHint, children: t("stopped.hint") }),
      state.tunnel !== void 0 && state.tunnel.state !== "running" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: state.tunnel.state === "failed" ? remote_default.tunnelFailed : remote_default.tunnelNote, role: "status", children: state.tunnel.state === "failed" ? t("tunnel.failed", { error: state.tunnel.error ?? t("tunnel.unknownError") }) : t("tunnel.starting") }),
      state.relay?.state === "registering" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.tunnelNote, role: "status", children: t("relay.registering") }),
      state.relay?.state === "failed" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.tunnelFailed, role: "status", children: t("relay.failed", { error: state.relay.error ?? t("tunnel.unknownError") }) }),
      (state.publicBaseUrl !== void 0 || state.lanAddresses.length > 1) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { className: remote_default.addresses, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", { children: t("address.label") }),
        state.publicBaseUrl !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: remote_default.address, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "radio",
              name: "lan-address",
              "aria-label": t("address.public"),
              checked: state.public,
              onChange: onPickPublic
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("address.public") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { className: remote_default.addressValue, children: state.publicBaseUrl })
        ] }, "public"),
        state.lanAddresses.map((address) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: remote_default.address, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "radio",
              name: "lan-address",
              "aria-label": address,
              checked: !state.public && address === state.address,
              onChange: () => onPickAddress(address)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("address.lan") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { className: remote_default.addressValue, children: address })
        ] }, address)),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.addressHint, children: t("address.hint") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.actions, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: remote_default.action, onClick: onStop, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconStopFillRegular, { size: 14 }),
          t("action.stop")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: remote_default.action, onClick: onRefresh, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 }),
          t("action.refresh")
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: remote_default.devices, "data-testid": "remote-devices", "aria-label": t("devices.title"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: remote_default.devicesTitle, children: t("devices.title") }),
        state.devices.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: remote_default.devicesEmpty, children: t("devices.empty") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: remote_default.deviceList, children: state.devices.map((device) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: remote_default.deviceRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: remote_default.deviceMeta, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: remote_default.deviceName, children: deviceNameFromUserAgent(device.userAgent) ?? t("devices.unknown") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: clsx_default(remote_default.devicePresence, device.online ? remote_default.deviceOnline : remote_default.deviceOffline), children: device.online ? t("devices.online") : t("devices.offline") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: remote_default.deviceSeen, children: t("devices.lastSeen", { time: formatLastSeen(device.lastSeenAt) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: remote_default.deviceRevoke,
              "aria-label": t("devices.revoke.label"),
              onClick: () => {
                onRevoke(device.id);
              },
              children: t("devices.revoke")
            }
          )
        ] }, device.id)) })
      ] })
    ] })
  ] });
}

// packages/dsh-remote-web/src/client/settings/RemoteSettingsCard.tsx
var import_react4 = require("react");

// packages/dsh-remote-web/src/client/settings/PluginSettingsCard.tsx
var import_react3 = require("react");

// packages/dsh-remote-web/src/client/settings/settings-card.module.css
var css2 = "/* Settings card chrome + form fields.\n * Aligned with the official ui-settings-plugins PluginCard / fields CSS:\n * same semantic tokens, radius, typography and states so the card reads as a\n * sibling of the built-in Shell / Agent loop / Web search cards. */\n\n.card_839479 {\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-3);\n  border-radius: 12px;\n  list-style: none;\n  transition: border-color 0.16s, background 0.16s;\n}\n\n.card_839479:hover {\n  border-color: var(--dsw-alias-label-dimmed);\n}\n\n.cardOpen_839479 {\n  background: var(--dsw-alias-bg-layer-2);\n  border-color: var(--dsw-alias-label-dimmed);\n}\n\n.header_839479 {\n  appearance: none;\n  width: 100%;\n  /* The suite does not force a global border-box, so width:100% + padding\n     would stretch the row 32px past the card and push the trailing pending\n     badge (last flex item) outside the card border. */\n  box-sizing: border-box;\n  font: inherit;\n  color: inherit;\n  text-align: left;\n  cursor: pointer;\n  background: transparent;\n  border: 0;\n  border-radius: 12px;\n  align-items: center;\n  gap: 13px;\n  padding: 16px;\n  display: flex;\n}\n\n.header_839479:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: -2px;\n}\n\n.headerStatic_839479 {\n  width: 100%;\n  box-sizing: border-box;\n  border-radius: 12px;\n  align-items: center;\n  gap: 13px;\n  padding: 16px;\n  display: flex;\n}\n\n.headText_839479 {\n  flex-direction: column;\n  flex: 1;\n  gap: 4px;\n  min-width: 0;\n  display: flex;\n}\n\n/* Optional leading plugin mark: a quiet tile that takes the ink color on\n   hover and while the card is open, so the whole row reads as one control. */\n.mark_839479 {\n  flex: none;\n  display: grid;\n  place-items: center;\n  width: 34px;\n  height: 34px;\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-module-platform);\n  color: var(--dsw-alias-label-secondary);\n  transition: color 0.16s;\n}\n\n.header_839479:hover .mark_839479,\n.cardOpen_839479 .mark_839479 {\n  color: var(--dsw-alias-label-primary);\n}\n\n.name_839479 {\n  color: var(--dsw-alias-label-primary);\n  font-size: 15px;\n  font-weight: 600;\n  line-height: 1.4;\n}\n\n.description_839479 {\n  /* Secondary, not tertiary: skins whose tertiary token is tuned for large\n     print leave 12-13px hint text below readable contrast (orca-link #778399\n     on cream measures ~3.4:1). */\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  line-height: 1.5;\n}\n\n.pending_839479 {\n  white-space: nowrap;\n  background: var(--dsw-alias-bg-module-platform);\n  color: var(--dsw-alias-label-secondary);\n  border-radius: 999px;\n  flex: none;\n  padding: 1px 8px;\n  font-size: 11px;\n  font-weight: 500;\n  line-height: 17px;\n}\n\n.chevron_839479 {\n  color: var(--dsw-alias-label-tertiary);\n  flex: none;\n  width: 16px;\n  height: 16px;\n  transition: transform 0.16s, color 0.16s;\n}\n\n.header_839479:hover .chevron_839479 {\n  color: var(--dsw-alias-label-secondary);\n}\n\n.chevronOpen_839479 {\n  transform: rotate(180deg);\n}\n\n.body_839479 {\n  border-top: 1px solid var(--dsw-alias-border-l2);\n  margin: 0 16px;\n  padding-bottom: 8px;\n}\n\n.readOnly_839479 {\n  color: var(--dsw-alias-label-secondary);\n  margin: 12px 0 0;\n  font-size: 12px;\n  line-height: 1.5;\n}\n\n.notExposed_839479 {\n  color: var(--dsw-alias-state-warn-primary);\n  margin: 12px 0 0;\n  font-size: 12px;\n  line-height: 1.5;\n}\n\n.footer_839479 {\n  border-top: 1px solid var(--dsw-alias-border-l2);\n  justify-content: flex-end;\n  align-items: center;\n  gap: 8px;\n  padding: 12px 0 4px;\n  display: flex;\n}\n\n.failed_839479 {\n  min-width: 0;\n  /* The suite's error alias is state-error-primary; a label-error token does\n     not exist, so the var() would resolve to nothing and the message would\n     inherit the ink color, losing the failure signal. */\n  color: var(--dsw-alias-state-error-primary, #b42318);\n  flex: 1;\n  margin: 0;\n  font-size: 12px;\n  line-height: 1.5;\n  text-overflow: ellipsis;\n  overflow: hidden;\n  white-space: nowrap;\n}\n\n.discard_839479,\n.save_839479 {\n  appearance: none;\n  font: inherit;\n  cursor: pointer;\n  border: 1px solid transparent;\n  border-radius: 8px;\n  padding: 5px 14px;\n  font-size: 13px;\n  line-height: 1.5;\n}\n\n.discard_839479 {\n  border-color: var(--dsw-alias-border-l2);\n  color: var(--dsw-alias-label-secondary);\n  background: transparent;\n}\n\n.discard_839479:hover:not(:disabled) {\n  color: var(--dsw-alias-label-primary);\n  border-color: var(--dsw-alias-label-dimmed);\n}\n\n.save_839479 {\n  background: var(--dsw-alias-label-primary);\n  color: var(--dsw-alias-bg-layer-3);\n}\n\n.discard_839479:disabled,\n.save_839479:disabled {\n  opacity: 0.4;\n  cursor: default;\n}\n\n.discard_839479:focus-visible,\n.save_839479:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: 1px;\n}\n\n.field_839479 {\n  flex-direction: column;\n  gap: 6px;\n  padding: 12px 0;\n  display: flex;\n}\n\n.field_839479 + .field_839479 {\n  border-top: 1px solid var(--dsw-alias-border-l2);\n}\n\n.head_839479 {\n  align-items: center;\n  gap: 8px;\n  display: flex;\n}\n\n.label_839479 {\n  min-width: 0;\n  color: var(--dsw-alias-label-primary);\n  flex: 1;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 1.5;\n}\n\n.badges_839479 {\n  align-items: center;\n  gap: 8px;\n  display: inline-flex;\n}\n\n.badge_839479 {\n  white-space: nowrap;\n  background: var(--dsw-alias-bg-module-platform);\n  color: var(--dsw-alias-label-secondary);\n  border-radius: 999px;\n  padding: 1px 8px;\n  font-size: 11px;\n  font-weight: 500;\n  line-height: 17px;\n}\n\n.reset_839479 {\n  font: inherit;\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n  background: transparent;\n  border: none;\n  padding: 0;\n  font-size: 12px;\n  line-height: 1.5;\n}\n\n.reset_839479:hover:not(:disabled) {\n  color: var(--dsw-alias-label-primary);\n}\n\n.reset_839479:disabled {\n  cursor: default;\n}\n\n.reset_839479:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: 2px;\n}\n\n.reset_839479:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: 2px;\n}\n\n.input_839479,\n.select_839479 {\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-3);\n  height: 34px;\n  font: inherit;\n  color: var(--dsw-alias-label-primary);\n  border-radius: 8px;\n  padding: 0 12px;\n  font-size: 13px;\n  line-height: 1.5;\n}\n\n.input_839479:focus-visible,\n.select_839479:focus-visible {\n  border-color: var(--dsw-alias-brand-primary);\n  outline: none;\n}\n\n.input_839479:disabled,\n.select_839479:disabled {\n  color: var(--dsw-alias-label-tertiary);\n  cursor: default;\n}\n\n.inputInvalid_839479 {\n  border: 1px solid var(--dsw-alias-state-error-primary, #b42318);\n  background: var(--dsw-alias-bg-layer-3);\n  height: 34px;\n  font: inherit;\n  color: var(--dsw-alias-label-primary);\n  border-radius: 8px;\n  padding: 0 12px;\n  font-size: 13px;\n  line-height: 1.5;\n}\n\n.inputInvalid_839479:focus-visible {\n  outline: 2px solid var(--dsw-alias-state-error-primary, #b42318);\n  outline-offset: 1px;\n  border-color: var(--dsw-alias-state-error-primary, #b42318);\n}\n\n.selectWrap_839479 {\n  position: relative;\n}\n\n.selectButton_839479 {\n  appearance: none;\n  width: 100%;\n  text-align: left;\n  cursor: pointer;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  display: flex;\n}\n\n.selectLabel_839479 {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.selectChevron_839479 {\n  color: var(--dsw-alias-label-tertiary);\n  flex: none;\n  transition: transform 0.16s;\n}\n\n.selectChevronOpen_839479 {\n  transform: rotate(180deg);\n}\n\n.selectPopup_839479 {\n  position: absolute;\n  top: calc(100% + 4px);\n  left: 0;\n  right: 0;\n  z-index: 40;\n  flex-direction: column;\n  max-height: 240px;\n  overflow-y: auto;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-layer-3);\n  box-shadow: 0 8px 24px var(--dsw-alias-bg-mask-2);\n  padding: 4px;\n  opacity: 0;\n  transform: translateY(-4px);\n  transition: opacity 0.1s ease, transform 0.1s ease;\n  display: flex;\n}\n\n.selectPopupOpen_839479 {\n  opacity: 1;\n  transform: none;\n}\n\n.selectPopupClose_839479 {\n  opacity: 0;\n  transform: translateY(-4px);\n  pointer-events: none;\n}\n\n.selectOption_839479 {\n  /* \u5F39\u5C42\u662F max-height \u53D7\u9650\u7684 flex \u5217\uFF1A\u9009\u9879\u5FC5\u987B\u4FDD\u6301\u81EA\u7136\u884C\u9AD8\uFF0C\u8D85\u51FA\u4EA4\u7ED9\u5F39\u5C42\u6EDA\u52A8 */\n  flex-shrink: 0;\n  border-radius: 6px;\n  padding: 6px 10px;\n  font-size: 13px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n  cursor: pointer;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.selectOption_839479:hover,\n.selectOptionActive_839479 {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.selectOptionSelected_839479 {\n  color: var(--dsw-alias-brand-primary);\n  font-weight: 500;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 10%, transparent);\n}\n\n.invalid_839479 {\n  color: var(--dsw-alias-state-error-primary, #b42318);\n  margin: 0;\n  font-size: 12px;\n  line-height: 1.5;\n}\n\n.hint_839479 {\n  color: var(--dsw-alias-label-secondary);\n  margin: 0;\n  font-size: 12px;\n  line-height: 1.5;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .card_839479,\n  .header_839479,\n  .mark_839479,\n  .chevron_839479,\n  .chevronOpen_839479,\n  .discard_839479,\n  .save_839479,\n  .selectChevron_839479,\n  .selectChevronOpen_839479,\n  .selectPopup_839479 {\n    transition: none;\n  }\n}\n";
var id2 = "@catyugu/dsh-remote-web/settings-card.module.css";
if (typeof document !== "undefined" && document.getElementById(id2) === null) {
  const tag = document.createElement("style");
  tag.id = id2;
  tag.dataset.plugin = "@catyugu/dsh-remote-web";
  tag.textContent = css2;
  document.head.appendChild(tag);
}
var settings_card_default = { "card": "card_839479", "cardOpen": "cardOpen_839479", "header": "header_839479", "headerStatic": "headerStatic_839479", "headText": "headText_839479", "mark": "mark_839479", "name": "name_839479", "description": "description_839479", "pending": "pending_839479", "chevron": "chevron_839479", "chevronOpen": "chevronOpen_839479", "body": "body_839479", "readOnly": "readOnly_839479", "notExposed": "notExposed_839479", "footer": "footer_839479", "failed": "failed_839479", "discard": "discard_839479", "save": "save_839479", "field": "field_839479", "head": "head_839479", "label": "label_839479", "badges": "badges_839479", "badge": "badge_839479", "reset": "reset_839479", "input": "input_839479", "select": "select_839479", "inputInvalid": "inputInvalid_839479", "selectWrap": "selectWrap_839479", "selectButton": "selectButton_839479", "selectLabel": "selectLabel_839479", "selectChevron": "selectChevron_839479", "selectChevronOpen": "selectChevronOpen_839479", "selectPopup": "selectPopup_839479", "selectPopupOpen": "selectPopupOpen_839479", "selectPopupClose": "selectPopupClose_839479", "selectOption": "selectOption_839479", "selectOptionActive": "selectOptionActive_839479", "selectOptionSelected": "selectOptionSelected_839479", "invalid": "invalid_839479", "hint": "hint_839479" };

// packages/dsh-remote-web/src/client/settings/PluginSettingsCard.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function PluginSettingsCard(props) {
  const [open, setOpen] = (0, import_react3.useState)(props.defaultOpen ?? true);
  const { state, alwaysOpen } = props;
  if (!state.available) return null;
  const title = props.t(props.titleKey);
  const description = props.t(props.descriptionKey);
  const blocked = !state.dirty || state.invalid || state.saving;
  const expanded = alwaysOpen === true || open;
  const cardClass = expanded ? `${settings_card_default.cardOpen} ${settings_card_default.card}` : settings_card_default.card;
  const header = alwaysOpen === true ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: settings_card_default.headerStatic, children: [
    props.icon !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: settings_card_default.mark, "aria-hidden": "true", children: props.icon }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: settings_card_default.headText, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: settings_card_default.name, title, children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: settings_card_default.description, title: description, children: props.descriptionNode ?? description })
    ] }),
    state.dirty ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: settings_card_default.pending, title: props.t("settings.unsaved"), children: props.t("settings.unsaved") }) : null
  ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "button",
    {
      type: "button",
      className: settings_card_default.header,
      "aria-expanded": open,
      "aria-label": `${props.t(open ? "settings.collapse" : "settings.expand")}: ${title}`,
      onClick: () => {
        setOpen(!open);
      },
      children: [
        props.icon !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: settings_card_default.mark, "aria-hidden": "true", children: props.icon }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: settings_card_default.headText, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: settings_card_default.name, title, children: title }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: settings_card_default.description, title: description, children: props.descriptionNode ?? description })
        ] }),
        state.dirty ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: settings_card_default.pending, title: props.t("settings.unsaved"), children: props.t("settings.unsaved") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "svg",
          {
            width: "14",
            height: "14",
            viewBox: "0 0 14 14",
            fill: "none",
            xmlns: "http://www.w3.org/2000/svg",
            className: open ? `${settings_card_default.chevron} ${settings_card_default.chevronOpen}` : settings_card_default.chevron,
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "path",
              {
                d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
                fill: "currentColor"
              }
            )
          }
        )
      ]
    }
  );
  if (!state.exposed && props.renderChildrenWhenNotExposed !== true) {
    const showNotice = props.hideNotExposedNotice !== true;
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: cardClass, children: [
      header,
      expanded ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: settings_card_default.body, children: showNotice ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: settings_card_default.notExposed, role: "status", children: props.t("settings.notExposed") }) : null }) : null
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: cardClass, children: [
    header,
    expanded ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: settings_card_default.body, children: [
      !state.writable ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: settings_card_default.readOnly, role: "status", children: props.t("settings.readOnly") }) : null,
      props.children,
      props.hideFooter === true ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: settings_card_default.footer, children: [
        state.failed ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: settings_card_default.failed, role: "status", children: [
          props.t("settings.saveFailed"),
          state.failedReason ? " - " + state.failedReason : ""
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            className: settings_card_default.discard,
            disabled: !state.dirty || state.saving,
            onClick: props.onDiscard,
            children: props.t("settings.discard")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            className: settings_card_default.save,
            disabled: blocked,
            onClick: props.onSave,
            children: props.t(!state.saving ? "settings.save" : "settings.saving")
          }
        )
      ] })
    ] }) : null
  ] });
}
function ValueField(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: settings_card_default.field, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: settings_card_default.head, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { className: settings_card_default.label, htmlFor: props.id, children: props.label }),
      props.overridden ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: settings_card_default.badges, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: settings_card_default.badge, children: props.overriddenLabel }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            className: settings_card_default.reset,
            disabled: props.disabled,
            onClick: props.onReset,
            children: props.resetLabel
          }
        )
      ] }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "input",
      {
        id: props.id,
        className: props.invalid ? settings_card_default.inputInvalid : settings_card_default.input,
        type: "text",
        ...props.numeric === true ? { inputMode: "numeric" } : {},
        ...props.invalid ? { "aria-invalid": true } : {},
        value: props.text,
        placeholder: props.placeholder ?? "",
        disabled: props.disabled,
        onChange: (event) => {
          props.onEdit(event.target.value);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: props.invalid ? settings_card_default.invalid : settings_card_default.hint, children: props.invalid ? props.invalidLabel : props.hint })
  ] });
}

// packages/dsh-remote-web/src/client/settings/settings-form.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
function numberField(field, constraints = {}) {
  const { integer = false, min } = constraints;
  return {
    field,
    format: (value) => typeof value === "number" ? String(value) : "",
    parse: (text) => {
      const trimmed = text.trim();
      if (trimmed === "") return { kind: "clear" };
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return void 0;
      if (integer && !Number.isInteger(parsed)) return void 0;
      if (min !== void 0 && parsed < min) return void 0;
      return { kind: "set", value: parsed };
    }
  };
}
function textField(field) {
  return {
    field,
    format: (value) => typeof value === "string" ? value : "",
    parse: (text) => {
      const trimmed = text.trim();
      return trimmed === "" ? { kind: "clear" } : { kind: "set", value: trimmed };
    }
  };
}
function secretField(field) {
  return { ...textField(field), secret: true };
}
function booleanField(field) {
  return {
    field,
    format: (value) => typeof value === "boolean" ? String(value) : "",
    parse: (text) => {
      const trimmed = text.trim();
      if (trimmed === "") return { kind: "clear" };
      if (trimmed === "true") return { kind: "set", value: true };
      if (trimmed === "false") return { kind: "set", value: false };
      return void 0;
    }
  };
}
function choiceField(field, choices) {
  return {
    field,
    format: (value) => typeof value === "string" && choices.includes(value) ? value : "",
    parse: (text) => {
      if (text === "") return { kind: "clear" };
      return choices.includes(text) ? { kind: "set", value: text } : void 0;
    }
  };
}
var CardForm = class {
  /** @param scope - the bound configuration form for this card's namespace. */
  constructor(scope, specs) {
    this.scope = scope;
    this.specs = new Map(specs.map((spec) => [spec.field, spec]));
    this.disposeForm = scope.subscribe(() => {
      this.publish();
    });
  }
  scope;
  specs;
  staged = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  /** The form subscription installed in the constructor; released by dispose(). */
  disposeForm;
  disposed = false;
  saving = false;
  /** A save asked for while one was in flight; it runs once the first settles (#1754). */
  saveQueued = false;
  failed = false;
  failedReason;
  /**
   * Release the form subscription and every bound store listener. The card
   * must call this on teardown; later calls are no-ops.
   */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeForm();
    this.listeners.clear();
  }
  /** Publish a projection of this form, rebuilt whenever the form or a draft changes. */
  bind(project) {
    const store = (0, import_dsh_client_store.createSnapshotStore)(project());
    this.listeners.add(() => {
      store.set(project());
    });
    return store;
  }
  /** Read the card-level state: what the Host serves, and what a save would do. */
  shell() {
    const snapshot = this.scope.getSnapshot();
    const plan = this.plan();
    return {
      available: snapshot.status !== "loading",
      exposed: snapshot.status === "ready",
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some((item) => item.judge === void 0),
      saving: this.saving,
      failed: this.failed,
      ...this.failedReason === void 0 ? {} : { failedReason: this.failedReason }
    };
  }
  /** Read one field's state from the effective section and its staged draft. */
  field(field) {
    const spec = this.specOf(field);
    const staged = this.staged.get(field);
    if (staged === void 0) {
      return { text: spec.format(this.sectionValue(field)), overridden: this.stored(field), invalid: false };
    }
    const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
    return {
      text: staged.text,
      overridden: write?.kind === "set",
      invalid: write === void 0
    };
  }
  /** The actions the card's slot registration injects. */
  actions() {
    return {
      edit: (field, text) => {
        this.stage(field, { text, clear: false });
      },
      resetField: (field) => {
        this.stage(field, { text: this.specOf(field).format(this.baseValue(field)), clear: true });
      },
      save: () => {
        void this.requestSave();
      },
      discard: () => {
        if (this.staged.size === 0 && !this.failed) return;
        this.staged.clear();
        this.failed = false;
        this.failedReason = void 0;
        this.publish();
      }
    };
  }
  /**
   * Write every staged edit in one atomic form mutation, then re-seed from
   * what the Host accepted.
   *
   * The whole batch rides one mutate, so cross-field validate hooks
   * (baseURL+model) judge it as a unit: the Host either applies every write
   * or refuses the batch. The form contract answers a refusal or a skipped
   * write with `false` (it recovers with a fresh Host view instead of
   * throwing), so the outcome is judged twice: the answer itself, and then the
   * settled snapshot read back one planned write at a time. One missed write
   * fails the whole save. A transport that rejects instead (the dsh-web bridge
   * controller on a dead connection) reports through the same failure path
   * with its rejection message. A save that did not land keeps its drafts, so
   * the user can correct them instead of retyping.
   * @returns settlement after the mutation and the read-back.
   */
  /**
   * Run one save, and re-run it once if another was asked for while this one
   * was still in flight.
   *
   * A save is a Host round trip that also drives the profile reconcile, and
   * the Host runs that write inside one exclusive transaction. Answering a
   * press that arrives mid-flight by returning immediately dropped the edit
   * with no explanation, which is the "the save button stops working after a
   * few rounds" report (#1754). Serializing instead means a save pressed while
   * another is still settling runs against the settled state - which is what
   * the operator meant by pressing it again.
   * @returns settlement after the mutation and the read-back.
   */
  async requestSave() {
    if (this.saving) {
      this.saveQueued = true;
      return;
    }
    await this.save();
    if (!this.saveQueued) return;
    this.saveQueued = false;
    await this.requestSave();
  }
  async save() {
    const plan = this.plan();
    const valid = plan.filter((item) => item.judge !== void 0);
    if (plan.length === 0 || this.saving || valid.length !== plan.length) return;
    const pending = /* @__PURE__ */ new Map();
    for (const item of plan) pending.set(item.field, this.staged.get(item.field));
    this.saving = true;
    this.failed = false;
    this.failedReason = void 0;
    this.publish();
    const ops = valid.map((item) => item.op.op === "set" ? { op: "set", path: [item.field], value: item.op.value } : { op: "unset", path: [item.field] });
    let failedReason;
    let accepted = false;
    try {
      accepted = await this.scope.mutate(ops);
    } catch (error) {
      failedReason = error instanceof Error ? error.message : String(error);
    }
    const landed = accepted && failedReason === void 0 && valid.every((item) => item.judge());
    for (const [field, before] of pending) {
      if (landed && this.staged.get(field) === before) this.staged.delete(field);
    }
    this.saving = false;
    this.failed = !landed;
    this.failedReason = failedReason;
    this.publish();
  }
  /**
   * Every staged edit a save would write. An entry whose draft is not a value
   * its field accepts carries no write: the form is still dirty, and the save
   * refuses rather than dropping the edit. A staged edit that matches the
   * effective section is not a write at all.
   * @returns the planned writes, in the order the fields were staged.
   */
  plan() {
    const plan = [];
    for (const [field, staged] of this.staged) {
      const spec = this.specOf(field);
      if (staged.clear) {
        if (this.stored(field)) plan.push({ field, op: { field, op: "unset" }, judge: () => this.landedUnset(field) });
        continue;
      }
      if (staged.text === spec.format(this.sectionValue(field))) continue;
      const write = spec.parse(staged.text);
      if (write === void 0) plan.push({ field, op: { field, op: "unset" }, judge: void 0 });
      else if (write.kind === "clear") plan.push({ field, op: { field, op: "unset" }, judge: () => this.landedUnset(field) });
      else plan.push({ field, op: { field, op: "set", value: write.value }, judge: () => this.landedSet(field, write.value) });
    }
    return plan;
  }
  /**
   * Read-back judgment for a planned set: the user layer must hold the
   * intended value once the mutation has settled.
   */
  landedSet(field, value) {
    if (this.specOf(field).secret) return true;
    return this.userLayer()?.[field] === value;
  }
  /**
   * Read-back judgment for a planned unset: the field must be gone from the
   * user layer once the mutation has settled.
   */
  landedUnset(field) {
    return !this.stored(field);
  }
  stage(field, edit) {
    this.staged.set(field, edit);
    this.failed = false;
    this.failedReason = void 0;
    this.publish();
  }
  specOf(field) {
    const spec = this.specs.get(field);
    if (spec === void 0) throw new Error(`settings card has no field ${field}`);
    return spec;
  }
  snapshotOf() {
    return this.scope.getSnapshot();
  }
  sectionValue(field) {
    return this.snapshotOf().value?.[field];
  }
  baseValue(field) {
    return this.snapshotOf().base?.[field];
  }
  userLayer() {
    return this.snapshotOf().user;
  }
  stored(field) {
    const user = this.userLayer();
    return user !== void 0 && Object.hasOwn(user, field);
  }
  publish() {
    for (const listener of this.listeners) listener();
  }
};

// packages/dsh-remote-web/src/client/settings/controls.module.css
var css3 = "/* Card-local controls: a switch, a radio group, and the section frame they sit in. */\n\n.section_38a6f6 + .section_38a6f6 {\n  border-top: 1px solid var(--dsw-alias-border-l2);\n  margin-top: 4px;\n}\n\n.sectionTitle_38a6f6 {\n  margin: 16px 0 0;\n  font-size: 12px;\n  font-weight: 600;\n  letter-spacing: 0.02em;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.field_38a6f6 {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding: 12px 0;\n}\n\n.head_38a6f6 {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.label_38a6f6 {\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n}\n\n.badges_38a6f6 {\n  margin-left: auto;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.badge_38a6f6 {\n  padding: 1px 6px;\n  border-radius: 6px;\n  background: var(--dsw-alias-bg-layer-3);\n  color: var(--dsw-alias-label-secondary);\n  font-size: 11px;\n}\n\n.reset_38a6f6 {\n  padding: 0;\n  border: none;\n  background: none;\n  color: var(--dsw-alias-brand-primary);\n  font-size: 12px;\n  cursor: pointer;\n}\n\n.reset_38a6f6:disabled {\n  opacity: 0.5;\n  cursor: default;\n}\n\n.hint_38a6f6 {\n  margin: 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n  line-height: 18px;\n}\n\n.switchRow_38a6f6 {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.state_38a6f6 {\n  font-size: 13px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.switch_38a6f6 {\n  position: relative;\n  width: 38px;\n  height: 22px;\n  padding: 0;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 11px;\n  background: var(--dsw-alias-bg-layer-3);\n  cursor: pointer;\n  transition: background 150ms ease;\n}\n\n.switch_38a6f6:disabled {\n  opacity: 0.5;\n  cursor: default;\n}\n\n.switchOn_38a6f6 {\n  border-color: transparent;\n  background: var(--dsw-alias-brand-primary);\n}\n\n.knob_38a6f6 {\n  position: absolute;\n  top: 2px;\n  left: 2px;\n  width: 16px;\n  height: 16px;\n  border-radius: 50%;\n  background: var(--dsw-alias-bg-layer-1);\n  transition: transform 150ms ease;\n}\n\n.knobOn_38a6f6 {\n  transform: translateX(16px);\n}\n\n.radios_38a6f6 {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.radio_38a6f6 {\n  display: flex;\n  align-items: flex-start;\n  gap: 8px;\n  cursor: pointer;\n}\n\n.radio_38a6f6 input {\n  margin: 2px 0 0;\n  accent-color: var(--dsw-alias-brand-primary);\n}\n\n.radioText_38a6f6 {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n}\n\n.radioLabel_38a6f6 {\n  font-size: 13px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.radioDetail_38a6f6 {\n  font-size: 12px;\n  line-height: 17px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.subfield_38a6f6 {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  padding-left: 22px;\n}\n\n.other_38a6f6 {\n  margin-top: 4px;\n  padding-top: 12px;\n  border-top: 1px solid var(--dsw-alias-border-l2);\n}\n\n.otherSummary_38a6f6 {\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n}\n\n/* Live facts under the LAN decision (bind host, firewall, reachable URLs). */\n.status_38a6f6 {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  padding: 0 0 4px;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.statusLine_38a6f6 {\n  word-break: break-all;\n}\n";
var id3 = "@catyugu/dsh-remote-web/controls.module.css";
if (typeof document !== "undefined" && document.getElementById(id3) === null) {
  const tag = document.createElement("style");
  tag.id = id3;
  tag.dataset.plugin = "@catyugu/dsh-remote-web";
  tag.textContent = css3;
  document.head.appendChild(tag);
}
var controls_default = { "section": "section_38a6f6", "sectionTitle": "sectionTitle_38a6f6", "field": "field_38a6f6", "head": "head_38a6f6", "label": "label_38a6f6", "badges": "badges_38a6f6", "badge": "badge_38a6f6", "reset": "reset_38a6f6", "hint": "hint_38a6f6", "switchRow": "switchRow_38a6f6", "state": "state_38a6f6", "switch": "switch_38a6f6", "switchOn": "switchOn_38a6f6", "knob": "knob_38a6f6", "knobOn": "knobOn_38a6f6", "radios": "radios_38a6f6", "radio": "radio_38a6f6", "radioText": "radioText_38a6f6", "radioLabel": "radioLabel_38a6f6", "radioDetail": "radioDetail_38a6f6", "subfield": "subfield_38a6f6", "other": "other_38a6f6", "otherSummary": "otherSummary_38a6f6", "status": "status_38a6f6", "statusLine": "statusLine_38a6f6" };

// packages/dsh-remote-web/src/client/settings/controls.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function FieldShell(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: controls_default.field, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: controls_default.head, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: controls_default.label, htmlFor: props.htmlFor ?? props.id, children: props.label }),
      props.overridden ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: controls_default.badges, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: controls_default.badge, children: props.overriddenLabel }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: controls_default.reset, disabled: props.disabled, onClick: props.onReset, children: props.resetLabel })
      ] }) : null
    ] }),
    props.children,
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: controls_default.hint, children: props.hint })
  ] });
}
function SwitchField(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FieldShell, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: controls_default.switchRow, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: controls_default.state, children: props.on ? props.onLabel : props.offLabel }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "button",
      {
        type: "button",
        id: props.id,
        role: "switch",
        "aria-checked": props.on,
        "aria-label": props.label,
        className: props.on ? `${controls_default.switch} ${controls_default.switchOn}` : controls_default.switch,
        disabled: props.disabled,
        onClick: () => {
          props.onChange(!props.on);
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: props.on ? `${controls_default.knob} ${controls_default.knobOn}` : controls_default.knob })
      }
    )
  ] }) });
}
function RadioField(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(FieldShell, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: controls_default.radios, role: "radiogroup", "aria-labelledby": `${props.id}-label`, children: props.options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { className: controls_default.radio, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "input",
      {
        type: "radio",
        name: props.id,
        value: option.value,
        checked: option.value === props.value,
        disabled: props.disabled,
        onChange: () => {
          props.onChange(option.value);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: controls_default.radioText, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: controls_default.radioLabel, children: option.label }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: controls_default.radioDetail, children: option.detail })
    ] })
  ] }, option.value)) }) });
}

// packages/dsh-remote-web/src/client/settings/tunnel-readiness.ts
function namedTunnelProblem(inputs) {
  if (inputs.tunnel !== "named") return void 0;
  const host = inputs.host.trim();
  if (host === "") return "settings.tunnelHostMissing";
  if (!/^https?:\/\/\S+$/i.test(host)) return "settings.tunnelHostInvalid";
  if (inputs.tokenDraft.trim() === "" && !inputs.tokenStored) return "settings.tunnelTokenMissing";
  return void 0;
}

// packages/dsh-remote-web/src/client/settings/RemoteSettingsCard.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var TUNNEL_MODES = ["off", "quick", "named"];
function boolOf(text, fallback) {
  if (text === "true") return true;
  if (text === "false") return false;
  return fallback;
}
var RemoteSettingsCardController = class {
  form;
  store;
  /** @param scope - the configuration form for the `remote-web-ui` entry. */
  constructor(scope) {
    this.form = new CardForm(scope, [
      booleanField("enabled"),
      choiceField("tunnel", TUNNEL_MODES),
      textField("tunnelHost"),
      secretField("tunnelToken"),
      booleanField("lanBind"),
      booleanField("requirePairingForLan"),
      numberField("tokenTtlMs", { integer: true, min: 6e4 })
    ]);
    this.store = this.form.bind(() => this.projection());
  }
  projection() {
    return {
      ...this.form.shell(),
      enabled: this.form.field("enabled"),
      tunnel: this.form.field("tunnel"),
      tunnelHost: this.form.field("tunnelHost"),
      tunnelToken: this.form.field("tunnelToken"),
      lanBind: this.form.field("lanBind"),
      requirePairingForLan: this.form.field("requirePairingForLan"),
      tokenTtlMs: this.form.field("tokenTtlMs")
    };
  }
  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot and its form actions.
   */
  inject() {
    return { hooks: { remoteSettingsCard: this.store }, ...this.form.actions() };
  }
  /**
   * Release the card's form subscription and bound stores; the slot
   * disposer calls this on teardown.
   */
  dispose() {
    this.form.dispose();
  }
};
function RemoteSettingsCard(props) {
  const { t } = props;
  const state = props.useRemoteSettingsCard((snapshot) => snapshot);
  const disabled = !state.writable;
  const fieldProps = {
    overriddenLabel: t("settings.overridden"),
    resetLabel: t("settings.reset"),
    invalidLabel: t("settings.invalidNumber"),
    disabled
  };
  const enabledOn = boolOf(state.enabled.text, true);
  const tunnelValue = state.tunnel.text === "" ? "off" : state.tunnel.text;
  const lanValue = state.lanBind.text === "" ? "follow" : state.lanBind.text === "true" ? "on" : "off";
  const [tokenStored, setTokenStored] = (0, import_react4.useState)(false);
  (0, import_react4.useEffect)(() => {
    let alive = true;
    void readPairFacts().then((facts) => {
      if (alive) setTokenStored(facts.tunnelTokenStored);
    }).catch(() => {
    });
    return () => {
      alive = false;
    };
  }, [state.dirty, state.saving]);
  const namedProblemKey = namedTunnelProblem({
    tunnel: tunnelValue,
    host: state.tunnelHost.text,
    tokenDraft: state.tunnelToken.text,
    tokenStored
  });
  const tunnelOptions = [
    { value: "off", label: t("settings.tunnelOff"), detail: t("settings.tunnelOffDetail") },
    { value: "quick", label: t("settings.tunnelQuick"), detail: t("settings.tunnelQuickDetail") },
    { value: "named", label: t("settings.tunnelNamed"), detail: t("settings.tunnelNamedDetail") }
  ];
  const lanOptions = [
    { value: "follow", label: t("settings.lanFollow"), detail: t("settings.lanFollowDetail") },
    { value: "on", label: t("settings.lanOn"), detail: t("settings.lanOnDetail") },
    { value: "off", label: t("settings.lanOff"), detail: t("settings.lanOffDetail") }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    PluginSettingsCard,
    {
      t,
      titleKey: "settings.title",
      descriptionKey: "settings.description",
      defaultOpen: false,
      hideFooter: true,
      state,
      onSave: props.save,
      onDiscard: props.discard,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: controls_default.section, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { className: controls_default.sectionTitle, children: t("settings.sectionAccess") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            SwitchField,
            {
              id: "settings-remote-enabled",
              label: t("settings.enabled"),
              hint: t("settings.enabledHint"),
              on: enabledOn,
              onLabel: t("settings.on"),
              offLabel: t("settings.off"),
              ...fieldProps,
              ...state.enabled,
              onChange: (on) => {
                props.edit("enabled", on ? "true" : "false");
              },
              onReset: () => {
                props.resetField("enabled");
              }
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: controls_default.section, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { className: controls_default.sectionTitle, children: t("settings.sectionPublic") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            RadioField,
            {
              id: "settings-remote-tunnel",
              label: t("settings.tunnel"),
              hint: t("settings.tunnelHint"),
              value: tunnelValue,
              options: tunnelOptions,
              ...fieldProps,
              ...state.tunnel,
              onChange: (value) => {
                props.edit("tunnel", value);
              },
              onReset: () => {
                props.resetField("tunnel");
              }
            }
          ),
          tunnelValue === "named" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: controls_default.subfield, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              ValueField,
              {
                id: "settings-remote-tunnel-host",
                label: t("settings.tunnelHost"),
                hint: t("settings.tunnelHostHint"),
                placeholder: "https://dsh.example.com",
                ...fieldProps,
                ...state.tunnelHost,
                onEdit: (text) => {
                  props.edit("tunnelHost", text);
                },
                onReset: () => {
                  props.resetField("tunnelHost");
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              ValueField,
              {
                id: "settings-remote-tunnel-token",
                label: t("settings.tunnelToken"),
                hint: t("settings.tunnelTokenHint"),
                placeholder: "eyJ...",
                ...fieldProps,
                ...state.tunnelToken,
                onEdit: (text) => {
                  props.edit("tunnelToken", text);
                },
                onReset: () => {
                  props.resetField("tunnelToken");
                }
              }
            )
          ] }),
          namedProblemKey !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: settings_card_default.failed, role: "status", children: t(namedProblemKey) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: controls_default.section, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { className: controls_default.sectionTitle, children: t("settings.sectionLan") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            RadioField,
            {
              id: "settings-remote-lan-bind",
              label: t("settings.lanBind"),
              hint: t("settings.lanBindHint"),
              value: lanValue,
              options: lanOptions,
              ...fieldProps,
              ...state.lanBind,
              onChange: (value) => {
                if (value === "follow") props.resetField("lanBind");
                else props.edit("lanBind", value === "on" ? "true" : "false");
              },
              onReset: () => {
                props.resetField("lanBind");
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(LanBindStatus, { t })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("details", { className: controls_default.other, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("summary", { className: controls_default.otherSummary, children: t("settings.sectionOther") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            SwitchField,
            {
              id: "settings-remote-fence",
              label: t("settings.requirePairingForLan"),
              hint: t("settings.requirePairingForLanHint"),
              on: boolOf(state.requirePairingForLan.text, true),
              onLabel: t("settings.on"),
              offLabel: t("settings.off"),
              ...fieldProps,
              ...state.requirePairingForLan,
              onChange: (on) => {
                props.edit("requirePairingForLan", on ? "true" : "false");
              },
              onReset: () => {
                props.resetField("requirePairingForLan");
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            ValueField,
            {
              id: "settings-remote-token-ttl",
              label: t("settings.tokenTtlMs"),
              hint: t("settings.tokenTtlMsHint"),
              numeric: true,
              ...fieldProps,
              ...state.tokenTtlMs,
              onEdit: (text) => {
                props.edit("tokenTtlMs", text);
              },
              onReset: () => {
                props.resetField("tokenTtlMs");
              }
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: settings_card_default.footer, children: [
          state.failed ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: settings_card_default.failed, role: "status", children: [
            t("settings.saveFailed"),
            state.failedReason ? " - " + state.failedReason : ""
          ] }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              type: "button",
              className: settings_card_default.discard,
              disabled: !state.dirty || state.saving,
              onClick: props.discard,
              children: t("settings.discard")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              type: "button",
              className: settings_card_default.save,
              disabled: !state.dirty || state.invalid || state.saving || namedProblemKey !== void 0,
              onClick: props.save,
              children: t(state.saving ? "settings.saving" : "settings.save")
            }
          )
        ] })
      ]
    }
  );
}
function LanBindStatus({ t }) {
  const [frame, setFrame] = (0, import_react4.useState)(void 0);
  (0, import_react4.useEffect)(() => {
    let alive = true;
    const read = () => {
      void readLanBindStatus().then((value) => {
        if (alive) setFrame(value);
      }).catch((error) => {
        if (error instanceof LanBindStatusError && shouldStopLanBindPoll(error.status)) window.clearInterval(timer);
      });
    };
    const timer = window.setInterval(read, 1e4);
    read();
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);
  if (frame === void 0) return null;
  const lanOn = frame.blockHost === "0.0.0.0";
  const firewallText = frame.firewall.managed ? t(frame.firewall.ok ? "lan.firewall.ok" : "lan.firewall.bad") : t("lan.firewall.unmanaged");
  const lines = [
    t("lan.bind", { host: frame.bindHost, port: String(frame.port) }) + " \xB7 " + firewallText
  ];
  if (lanOn && frame.lanUrls.length > 0) {
    lines.push(t("lan.urls", { urls: frame.lanUrls.join("  ") }));
  }
  if (!lanOn) {
    lines.push(t("lan.off"));
  }
  if (frame.setting === null) {
    lines.push(t("lan.untouched"));
  }
  if (frame.pendingRestart === true) {
    lines.push(t("lan.pendingRestart"));
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: controls_default.status, children: lines.map((line, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: controls_default.statusLine, children: line }, index)) });
}

// packages/dsh-remote-web/src/client/settings/settings-face.ts
var published;
function publishSettingsFace(face) {
  published = face;
}
function currentSettingsFace() {
  return published;
}

// packages/dsh-remote-web/src/client/entry/PhoneIcon.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function PhoneIcon({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { width: size, height: size, className, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "path",
    {
      d: "M4.2 1.8h2.4l.9 2.4-1.5 1.1a7.4 7.4 0 0 0 4.7 4.7l1.1-1.5 2.4.9v2.4a.9.9 0 0 1-1 .9A11.4 11.4 0 0 1 3.3 2.8a.9.9 0 0 1 .9-1Z",
      stroke: "currentColor",
      strokeWidth: "1.3",
      strokeLinejoin: "round"
    }
  ) });
}

// packages/dsh-remote-web/src/client/entry/RemoteEntry.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function mergeFrame(state, frame) {
  if (state.kind === "lan-required") {
    return {
      ...state,
      ...frame.tunnel !== void 0 ? { tunnel: frame.tunnel } : {}
    };
  }
  if (state.kind !== "ready") return state;
  return {
    ...state,
    phase: frame.phase,
    deviceCount: frame.deviceCount,
    onlineCount: frame.onlineCount,
    devices: frame.devices ?? [],
    ...frame.tunnel !== void 0 ? { tunnel: frame.tunnel } : {},
    ...frame.relay !== void 0 ? { relay: frame.relay } : {},
    ...frame.posture !== void 0 ? { posture: frame.posture } : {}
  };
}
function RemoteEntry({ wide, t }) {
  const [open, setOpen] = (0, import_react5.useState)(false);
  const [state, setState] = (0, import_react5.useState)({ kind: "lan-required" });
  const stateRef = (0, import_react5.useRef)(state);
  (0, import_react5.useEffect)(() => {
    stateRef.current = state;
  }, [state]);
  const [copied, setCopied] = (0, import_react5.useState)(false);
  const [copiedToken, setCopiedToken] = (0, import_react5.useState)(false);
  const eventSource = (0, import_react5.useRef)(void 0);
  const openSeq = (0, import_react5.useRef)(0);
  const closeEventSource = (0, import_react5.useCallback)(() => {
    eventSource.current?.close();
    eventSource.current = void 0;
  }, []);
  const mint = (0, import_react5.useCallback)(async (address) => {
    let result;
    try {
      result = await issuePair(address);
    } catch {
      return { kind: "unreachable" };
    }
    if (!result.ok) {
      if (result.code === "forbidden") return { kind: "loopback-required" };
      if (result.code === "disabled") return { kind: "disabled" };
      if (result.code === "unknown-address") return { kind: "unreachable" };
      return { kind: "lan-required" };
    }
    const publicBaseUrl = result.publicBaseUrl;
    return {
      kind: "ready",
      url: result.url,
      token: result.token,
      expiresAt: result.expiresAt,
      expired: Date.now() > result.expiresAt,
      phase: "waiting",
      deviceCount: 0,
      onlineCount: 0,
      devices: [],
      // Whether this QR is built on the configured public (tunneled) base.
      public: publicBaseUrl !== void 0 && result.url.startsWith(publicBaseUrl),
      ...publicBaseUrl !== void 0 ? { publicBaseUrl } : {},
      // The issued URL names the requested (or default first) literal; the
      // public link has no LAN literal, so no radio row is selected then.
      address: address ?? result.lanAddresses[0] ?? "",
      lanAddresses: result.lanAddresses
    };
  }, []);
  const openPanel = (0, import_react5.useCallback)(async () => {
    const seq = ++openSeq.current;
    setOpen(true);
    const next = await mint();
    if (seq !== openSeq.current) return;
    setState(next);
    if (next.kind !== "ready" && next.kind !== "lan-required") return;
    const source = new EventSource("api/pair/events");
    eventSource.current = source;
    source.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        if (frame.type !== "state") return;
        const previous = stateRef.current;
        if (previous.kind === "lan-required" && frame.tunnel?.state === "running" && previous.tunnel?.state !== "running") {
          void mint().then(setState);
          return;
        }
        setState((current) => mergeFrame(current, frame));
      } catch {
      }
    };
  }, [mint]);
  const closePanel = (0, import_react5.useCallback)(() => {
    openSeq.current += 1;
    closeEventSource();
    setOpen(false);
  }, [closeEventSource]);
  (0, import_react5.useEffect)(() => {
    if (state.kind !== "ready") return;
    if (state.expired) return;
    const delay = state.expiresAt - Date.now();
    if (delay <= 0) {
      setState((previous) => previous.kind === "ready" ? { ...previous, expired: true } : previous);
      return;
    }
    const timer = window.setTimeout(() => {
      setState((previous) => previous.kind === "ready" ? { ...previous, expired: true } : previous);
    }, delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [state]);
  (0, import_react5.useEffect)(() => closeEventSource, [closeEventSource]);
  const handleStop = (0, import_react5.useCallback)(() => {
    void stopPair().then(() => {
      setState((previous) => previous.kind === "ready" ? { ...previous, phase: "stopped", devices: [] } : previous);
    }).catch(() => {
    });
  }, []);
  const handleRevoke = (0, import_react5.useCallback)((deviceId) => {
    void revokePair(deviceId).then(() => {
      setState((previous) => previous.kind === "ready" ? { ...previous, devices: previous.devices.filter((device) => device.id !== deviceId) } : previous);
    }).catch(() => {
    });
  }, []);
  const handleRefresh = (0, import_react5.useCallback)(() => {
    void mint().then(setState);
  }, [mint]);
  const handlePickAddress = (0, import_react5.useCallback)((address) => {
    void mint(address).then(setState);
  }, [mint]);
  const handlePickPublic = (0, import_react5.useCallback)(() => {
    void mint().then(setState);
  }, [mint]);
  const handleCopy = (0, import_react5.useCallback)((url) => {
    void copyText(url).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    });
  }, []);
  const handleCopyToken = (0, import_react5.useCallback)((token) => {
    void copyText(token).then((ok) => {
      if (!ok) return;
      setCopiedToken(true);
      window.setTimeout(() => {
        setCopiedToken(false);
      }, 1500);
    });
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: remote_default.entryRow, "data-rail": wide ? void 0 : "rail", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TooltipAnchor, { wide, label: t("entry.label"), onClick: openPanel, expanded: open }) }),
    open && (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: remote_default.overlay, role: "presentation", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: remote_default.mask, "aria-hidden": "true", onClick: closePanel }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: remote_default.stack, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          RemotePanel,
          {
            t,
            state,
            copied,
            copiedToken,
            onClose: closePanel,
            onStop: handleStop,
            onRefresh: handleRefresh,
            onCopy: handleCopy,
            onCopyToken: handleCopyToken,
            onPickAddress: handlePickAddress,
            onPickPublic: handlePickPublic,
            onRevoke: handleRevoke
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SettingsSection, { t })
      ] })
    ] }), document.body)
  ] });
}
function bindSelectorHook(store) {
  return function useBoundSelector(selector) {
    const snapshot = (0, import_react5.useSyncExternalStore)(
      (onChange) => store.subscribe(onChange),
      () => store.getSnapshot(),
      () => store.getSnapshot()
    );
    return selector(snapshot);
  };
}
function SettingsSection({ t }) {
  const face = currentSettingsFace();
  if (face === void 0) return null;
  const { hooks = {}, ...actions } = face;
  const hookProps = Object.fromEntries(
    Object.entries(hooks).map(([key, store]) => [
      `use${key.slice(0, 1).toUpperCase()}${key.slice(1)}`,
      bindSelectorHook(store)
    ])
  );
  const cardProps = { ...actions, ...hookProps, t };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: remote_default.settingsSection, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(RemoteSettingsCard, { ...cardProps }) });
}
function TooltipAnchor({ wide, label, onClick, expanded }) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "button",
    {
      type: "button",
      className: remote_default.trigger,
      "data-wide": wide ? "wide" : "rail",
      "aria-label": label,
      "aria-expanded": expanded,
      title: label,
      onClick,
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(PhoneIcon, { size: wide ? 16 : 18 })
    }
  );
}

// packages/dsh-remote-web/src/client/entry/FooterRemoteEntry.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function FooterRemoteEntry(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    RemoteEntry,
    {
      wide: props.wide,
      t: props.t
    }
  );
}

// packages/dsh-remote-web/src/client/panel/PairFailedNotice.tsx
var import_react6 = require("react");
var import_jsx_runtime8 = require("react/jsx-runtime");
function PairFailedNotice({ t }) {
  const [visible, setVisible] = (0, import_react6.useState)(true);
  (0, import_react6.useEffect)(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 8e3);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);
  if (!visible) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: remote_default.notice, role: "alert", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: remote_default.noticeTitle, children: t("pair.failed.title") }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: remote_default.noticeDetail, children: t("pair.failed.detail") })
  ] });
}

// packages/dsh-remote-web/src/client/locales.ts
var zh = {
  "entry.label": "\u8FDC\u7A0B\u8BBF\u95EE",
  "mobile.whale.open": "\u6253\u5F00\u4FA7\u8FB9\u680F",
  "title": "\u8FDC\u7A0B\u8BBF\u95EE",
  "subtitle": "\u901A\u8FC7\u624B\u673A\u6216\u53E6\u4E00\u53F0\u7535\u8111\u914D\u5BF9\uFF0C\u8FDC\u7A0B\u4F7F\u7528\u540C\u4E00\u4EFD Web \u754C\u9762\uFF08\u5B98\u65B9\u754C\u9762 + \u79FB\u52A8\u7AEF\u9002\u914D\uFF09",
  "card.title": "\u8BBE\u5907\u914D\u5BF9",
  "public.badge": "\u516C\u7F51",
  "status.waiting": "\u7B49\u5F85\u8BBE\u5907\u8FDE\u63A5",
  "status.connected": "\u5DF2\u8FDE\u63A5 {n} \u53F0\u8BBE\u5907",
  "status.disconnected": "\u5DF2\u914D\u5BF9\u8BBE\u5907\u79BB\u7EBF",
  "status.stopped": "\u5DF2\u505C\u6B62\u8FDC\u7A0B\u8BBF\u95EE",
  "status.lanRequired": "\u6B64\u529F\u80FD\u9700\u8981\u5C40\u57DF\u7F51\u7ED1\u5B9A\u6216\u516C\u7F51\u5730\u5740\u624D\u80FD\u4F7F\u7528",
  "status.lanRequiredHint": "\u5F53\u524D\u670D\u52A1\u4EC5\u7ED1\u5B9A\u5728 127.0.0.1 \u4E14\u672A\u914D\u7F6E\u516C\u7F51\u5730\u5740\uFF0C\u624B\u673A\u65E0\u6CD5\u8BBF\u95EE\u3002\u8BF7\u5728\u4E0B\u9762\u7684\u8BBE\u7F6E\u91CC\u6253\u5F00\u201C\u5C40\u57DF\u7F51\u8BBF\u95EE\u201D\uFF0C\u6216\u7528 dsh web --host 0.0.0.0 \u91CD\u65B0\u542F\u52A8\uFF0C\u6216\u586B\u5199\u5185\u7F51\u7A7F\u900F\u7684\u516C\u7F51\u5730\u5740\u3002",
  "status.loopbackRequired": "\u914D\u5BF9\u9762\u677F\u4EC5\u9650\u672C\u673A\u4F7F\u7528",
  "status.loopbackRequiredHint": "\u8BF7\u901A\u8FC7 http://127.0.0.1 \u6253\u5F00\u6B64\u9875\u9762\u540E\u91CD\u8BD5\uFF1B\u624B\u673A\u8BF7\u4F7F\u7528\u914D\u5BF9\u94FE\u63A5\u8BBF\u95EE\u3002",
  "status.unreachable": "\u65E0\u6CD5\u8FDE\u63A5\u914D\u5BF9\u670D\u52A1",
  "status.unreachableHint": "\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5\u3002",
  "status.disabled": "\u8FDC\u7A0B\u8BBF\u95EE\u5DF2\u5173\u95ED",
  "status.disabledHint": "\u5DF2\u914D\u5BF9\u8BBE\u5907\u5168\u90E8\u5931\u6548\uFF0C\u516C\u7F51\u96A7\u9053\u4E5F\u5DF2\u65AD\u5F00\u3002\u5728\u4E0B\u9762\u7684\u8BBE\u7F6E\u91CC\u6253\u5F00\u201C\u542F\u7528\u8FDC\u7A0B\u8BBF\u95EE\u201D\u540E\u518D\u70B9\u5237\u65B0\u3002",
  "pair.hint": "\u65E0\u6CD5\u626B\u7801\uFF1F\u53EF\u76F4\u63A5\u6253\u5F00\u4E0B\u65B9\u914D\u5BF9\u94FE\u63A5",
  "pair.publicHint": "\u516C\u7F51\u94FE\u63A5\uFF1A\u8BBE\u5907\u65E0\u9700\u4E0E\u672C\u673A\u5904\u4E8E\u540C\u4E00\u7F51\u7EDC",
  "address.label": "\u9009\u62E9\u4E8C\u7EF4\u7801\u6307\u5411\u7684\u7F51\u7EDC",
  "address.public": "\u516C\u7F51\u5730\u5740",
  "address.lan": "\u5C40\u57DF\u7F51",
  "address.hint": "\u8FDC\u7A0B\u8BBE\u5907\u4E0D\u5728\u540C\u4E00\u7F51\u7EDC\u65F6\u8BF7\u4F7F\u7528\u516C\u7F51\u5730\u5740\uFF1B\u5C40\u57DF\u7F51\u5730\u5740\u4EC5\u9650\u540C\u4E00\u7F51\u7EDC\u5185\u4F7F\u7528\u3002",
  "pair.expires": "\u4E8C\u7EF4\u7801\u6709\u6548\u81F3 {time}",
  "pair.expired": "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u5237\u65B0",
  "pair.linkLabel": "\u914D\u5BF9\u94FE\u63A5",
  "pair.tokenLabel": "\u914D\u5BF9\u4EE4\u724C",
  "pair.dockerHint": "Docker \u6216\u53CD\u5411\u4EE3\u7406\u73AF\u5883\u4E0B\uFF0C\u53EF\u76F4\u63A5\u590D\u5236\u6B64\u4EE4\u724C\u5E76\u5728\u76EE\u6807\u8BBE\u5907\u914D\u5BF9\u9875\u9762\u8F93\u5165\u3002",
  "pair.oneTimeHint": "\u94FE\u63A5\u542B\u9650\u65F6\u4EE4\u724C\uFF1B\u5728\u4EE4\u724C\u8FC7\u671F\u6216\u5237\u65B0\u4E8C\u7EF4\u7801\u4E4B\u524D\uFF0C\u540C\u4E00\u94FE\u63A5\u53EF\u4E3A\u591A\u53F0\u8BBE\u5907\u5B8C\u6210\u914D\u5BF9\uFF08\u6BCF\u6B21\u914D\u5BF9\u5404\u81EA\u751F\u6210\u72EC\u7ACB\u8BBE\u5907\u4F1A\u8BDD\uFF09\u3002",
  "pair.failed.title": "\u914D\u5BF9\u5931\u8D25",
  "pair.failed.detail": "\u94FE\u63A5\u65E0\u6548\u6216\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u56DE\u5230\u7535\u8111\u7AEF\u5237\u65B0\u4E8C\u7EF4\u7801\u540E\u91CD\u65B0\u626B\u7801\u3002",
  "fence.unpaired.title": "\u6B64\u8BBE\u5907\u672A\u914D\u5BF9\uFF0C\u65E0\u6CD5\u8BBF\u95EE\u5DE5\u4F5C\u533A\u6570\u636E",
  "fence.unpaired.eyebrow": "\u9700\u8981\u8BBE\u5907\u914D\u5BF9",
  "fence.unpaired.hint": "\u4E3A\u4FDD\u62A4\u5DE5\u4F5C\u533A\u3001\u4F1A\u8BDD\u4E0E\u63D2\u4EF6\u6570\u636E\uFF0C\u8FDC\u7A0B\u7535\u8111\u5FC5\u987B\u5148\u901A\u8FC7\u4E3B\u7535\u8111\u6388\u6743\u3002",
  "fence.unpaired.stepDesktop": "\u5728\u4E3B\u7535\u8111\u6253\u5F00 http://127.0.0.1:3080\uFF0C\u8FDB\u5165\u201C\u8FDC\u7A0B\u8BBF\u95EE\u201D\u3002",
  "fence.unpaired.stepLink": "\u5728\u201C\u8BBE\u5907\u914D\u5BF9\u201D\u4E2D\u590D\u5236\u7535\u8111\u914D\u5BF9\u94FE\u63A5\u3002",
  "fence.unpaired.stepOpen": "\u5728\u5F53\u524D\u6D4F\u89C8\u5668\u6253\u5F00\u8BE5\u94FE\u63A5\uFF0C\u5B8C\u6210\u6388\u6743\u540E\u5373\u53EF\u8FDB\u5165\u3002",
  "fence.unpaired.retry": "\u91CD\u65B0\u68C0\u6D4B",
  "fence.unpaired.tokenPlaceholder": "\u6216\u5728\u6B64\u76F4\u63A5\u7C98\u8D34\u914D\u5BF9\u94FE\u63A5 / Token",
  "fence.unpaired.pairAction": "\u7ACB\u5373\u914D\u5BF9",
  "fence.unpaired.pairing": "\u914D\u5BF9\u4E2D\u2026",
  "fence.unpaired.tokenInvalid": "\u914D\u5BF9\u94FE\u63A5\u6216 Token \u65E0\u6548\u5DF2\u8FC7\u671F",
  "fence.unpaired.tokenFailed": "\u914D\u5BF9\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216\u91CD\u65B0\u83B7\u53D6\u94FE\u63A5",
  "fence.unpaired.footnote": "\u8BF7\u52FF\u4F7F\u7528\u4ED6\u4EBA\u63D0\u4F9B\u7684\u914D\u5BF9\u94FE\u63A5\uFF1B\u7BA1\u7406\u5458\u53EF\u968F\u65F6\u53D6\u6D88\u6B64\u8BBE\u5907\u7684\u6388\u6743\u3002",
  "posture.exposed": "/api \u901A\u9053\u5BF9\u672A\u914D\u5BF9\u8BBE\u5907\u655E\u5F00",
  "posture.exposedHint": "\u4EE5\u4E0B\u6765\u6E90\u7684\u8BF7\u6C42\u672A\u7ECF\u914D\u5BF9\u5373\u53EF\u8BBF\u95EE\u5B8C\u6574\u684C\u9762 API\uFF1A{hosts}\u3002\u8BF7\u79FB\u9664\u5BF9\u5E94\u6765\u6E90\u7684 --trusted-host\uFF08\u914D\u5BF9\u673A\u5236\u5DF2\u8986\u76D6\u8FDC\u7A0B\u8BBF\u95EE\uFF09\uFF0C\u6216\u6539\u4E3A\u4EC5\u7ED1\u5B9A 127.0.0.1 \u5E76\u4F7F\u7528\u96A7\u9053\u3002",
  "action.stop": "\u505C\u6B62",
  "action.refresh": "\u5237\u65B0\u4E8C\u7EF4\u7801",
  "action.copy": "\u590D\u5236\u94FE\u63A5",
  "action.copyLink": "\u590D\u5236\u94FE\u63A5",
  "action.copyToken": "\u590D\u5236\u4EE4\u724C",
  "action.copied": "\u5DF2\u590D\u5236",
  "action.copiedToken": "\u5DF2\u590D\u5236\u4EE4\u724C",
  "devices.title": "\u5DF2\u6388\u6743\u8BBE\u5907",
  "devices.empty": "\u8FD8\u6CA1\u6709\u5DF2\u914D\u5BF9\u7684\u8BBE\u5907\u3002\u626B\u7801\u6216\u6253\u5F00\u94FE\u63A5\u540E\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002",
  "devices.unknown": "\u672A\u77E5\u8BBE\u5907",
  "devices.online": "\u5728\u7EBF",
  "devices.offline": "\u79BB\u7EBF",
  "devices.lastSeen": "\u6700\u8FD1\u6D3B\u52A8 {time}",
  "devices.revoke": "\u53D6\u6D88\u914D\u5BF9",
  "devices.revoke.label": "\u53D6\u6D88\u914D\u5BF9\u6B64\u8BBE\u5907",
  "stopped.hint": '\u5DF2\u505C\u6B62\u8FDC\u7A0B\u8BBF\u95EE\u3002\u70B9\u51FB"\u5237\u65B0\u4E8C\u7EF4\u7801"\u91CD\u65B0\u5F00\u542F\u3002',
  "tunnel.starting": "\u516C\u7F51\u96A7\u9053\u542F\u52A8\u4E2D\uFF0C\u4E8C\u7EF4\u7801\u5C06\u81EA\u52A8\u53D8\u4E3A\u516C\u7F51\u94FE\u63A5\u2026",
  "tunnel.failed": "\u516C\u7F51\u96A7\u9053\u542F\u52A8\u5931\u8D25\uFF1A{error}",
  "tunnel.unknownError": "\u672A\u77E5\u9519\u8BEF",
  "relay.registering": "\u6B63\u5728\u628A\u4E34\u65F6\u96A7\u9053\u540C\u6B65\u5230\u56FA\u5B9A\u57DF\u540D\uFF08<id>.dsh-market.com\uFF09\u2026",
  "relay.failed": "\u56FA\u5B9A\u57DF\u540D\u540C\u6B65\u5931\u8D25\uFF1A{error}\u3002\u6B63\u5728\u81EA\u52A8\u91CD\u8BD5\uFF0C\u671F\u95F4\u4E8C\u7EF4\u7801\u53EF\u80FD\u4F7F\u7528\u4E34\u65F6\u5730\u5740\u3002",
  "close.label": "\u5173\u95ED\u8FDC\u7A0B\u8BBF\u95EE\u9762\u677F",
  // 插件设置卡片（家族 list 席位，或官方 plugins.bundle.config 席位）。
  "settings.title": "\u8FDC\u7A0B\u8FDE\u63A5\u8BBE\u7F6E",
  "settings.description": "\u624B\u673A\u914D\u5BF9\u3001\u516C\u7F51\u96A7\u9053\u4E0E\u5C40\u57DF\u7F51\u8BBF\u95EE\u3002",
  "settings.sectionAccess": "\u8FDC\u7A0B\u8BBF\u95EE",
  "settings.enabled": "\u542F\u7528\u8FDC\u7A0B\u8BBF\u95EE",
  "settings.enabledHint": "\u5173\u95ED\u540E\u64A4\u9500\u5168\u90E8\u5DF2\u914D\u5BF9\u8BBE\u5907\u5E76\u65AD\u5F00\u516C\u7F51\u96A7\u9053\uFF1B\u4FA7\u8FB9\u680F\u5165\u53E3\u4FDD\u7559\uFF0C\u53EF\u968F\u65F6\u91CD\u65B0\u6253\u5F00\u3002",
  "settings.sectionPublic": "\u516C\u7F51\u8BBF\u95EE",
  "settings.tunnel": "\u516C\u7F51\u8BBF\u95EE\u65B9\u5F0F",
  "settings.tunnelHint": "\u8BA9\u4E0D\u5728\u540C\u4E00\u7F51\u7EDC\u7684\u624B\u673A\u8FDE\u4E0A\u8FD9\u53F0\u673A\u5668\uFF0C\u4E09\u79CD\u65B9\u5F0F\u4E92\u65A5\u3002",
  "settings.tunnelOff": "\u5173\u95ED",
  "settings.tunnelOffDetail": "\u53EA\u5728\u672C\u673A\u4E0E\u5C40\u57DF\u7F51\u53EF\u7528\u3002",
  "settings.tunnelQuick": "\u4E34\u65F6\u96A7\u9053",
  "settings.tunnelQuickDetail": "\u63D2\u4EF6\u81EA\u52A8\u8FD0\u884C Cloudflare \u4E34\u65F6\u96A7\u9053\uFF0C\u65E0\u9700\u4EFB\u4F55\u914D\u7F6E\uFF1B\u5730\u5740\u6BCF\u6B21\u542F\u52A8\u90FD\u4F1A\u53D8\u5316\uFF0C\u624B\u673A\u9700\u91CD\u65B0\u626B\u7801\u914D\u5BF9\u3002",
  "settings.tunnelNamed": "\u56FA\u5B9A\u57DF\u540D\u96A7\u9053",
  "settings.tunnelNamedDetail": "\u63D2\u4EF6\u8FD0\u884C\u4F60\u81EA\u5DF1\u7684 Cloudflare \u547D\u540D\u96A7\u9053\uFF1A\u57DF\u540D\u56FA\u5B9A\uFF0C\u914D\u5BF9\u4E00\u6B21\u540E\u91CD\u542F\u4E5F\u4E0D\u7528\u91CD\u626B\u3002\u9700\u5148\u5728 Cloudflare \u63A7\u5236\u53F0\u628A\u8BE5\u57DF\u540D\u6307\u5411 http://127.0.0.1:\u7AEF\u53E3\u3002",
  "settings.tunnelHost": "\u516C\u7F51\u57DF\u540D",
  "settings.tunnelHostHint": "\u56FA\u5B9A\u57DF\u540D\u96A7\u9053\u5BF9\u5916\u63D0\u4F9B\u7684\u5730\u5740\uFF0C\u4F8B\u5982 https://dsh.example.com\u3002",
  "settings.tunnelToken": "Cloudflare \u96A7\u9053\u4EE4\u724C",
  "settings.tunnelTokenHint": "cloudflared tunnel run --token \u7684\u503C\u3002\u7559\u7A7A\u8868\u793A\u6CBF\u7528\u5DF2\u4FDD\u5B58\u7684\u4EE4\u724C\u3002",
  "settings.tunnelHostMissing": "\u56FA\u5B9A\u57DF\u540D\u96A7\u9053\u9700\u8981\u586B\u5199\u516C\u7F51\u57DF\u540D\u3002",
  "settings.tunnelHostInvalid": "\u516C\u7F51\u57DF\u540D\u5FC5\u987B\u662F http(s) \u5730\u5740\u3002",
  "settings.tunnelTokenMissing": "\u56FA\u5B9A\u57DF\u540D\u96A7\u9053\u9700\u8981\u586B\u5199 Cloudflare \u96A7\u9053\u4EE4\u724C\u3002",
  "settings.sectionLan": "\u5C40\u57DF\u7F51\u8BBF\u95EE",
  "settings.lanBind": "\u7ED1\u5B9A\u5730\u5740",
  "settings.lanBindHint": "\u51B3\u5B9A Web \u670D\u52A1\u662F\u5426\u5BF9\u5C40\u57DF\u7F51\u5F00\u653E\u3002\u6539\u52A8\u4F1A\u5199\u5165 profile \u8865\u4E01\uFF0C\u901A\u5E38\u5728\u91CD\u542F dsh web \u540E\u751F\u6548\u3002",
  "settings.lanFollow": "\u8DDF\u968F\u542F\u52A8\u53C2\u6570",
  "settings.lanFollowDetail": "\u63D2\u4EF6\u4E0D\u6539\u5199 profile \u8865\u4E01\uFF0C\u7ED1\u5B9A\u7531 dsh web --host \u51B3\u5B9A\u3002",
  "settings.lanOn": "\u5BF9\u5C40\u57DF\u7F51\u5F00\u653E\uFF080.0.0.0\uFF09",
  "settings.lanOnDetail": "\u5199\u5165 profile \u8865\u4E01\u628A\u7ED1\u5B9A\u9ED8\u8BA4\u6539\u4E3A 0.0.0.0\uFF0C\u5E76\u653E\u884C\u4E3B\u673A\u9632\u706B\u5899\u3002",
  "settings.lanOff": "\u4EC5\u672C\u673A\uFF08127.0.0.1\uFF09",
  "settings.lanOffDetail": "\u5199\u5165 profile \u8865\u4E01\u628A\u7ED1\u5B9A\u56FA\u5B9A\u4E3A 127.0.0.1\u3002",
  "settings.sectionOther": "\u5176\u4ED6",
  "settings.requirePairingForLan": "\u5C40\u57DF\u7F51\u8BBF\u95EE\u8981\u6C42\u914D\u5BF9",
  "settings.requirePairingForLanHint": "\u5F00\u542F\uFF1A\u975E\u672C\u673A\u56DE\u73AF\u7684\u684C\u9762 Web GUI \u6539\u8D70\u95E8\u63A7\u7684 /remote\uFF0C\u5FC5\u987B\u643A\u5E26\u6709\u6548\u914D\u5BF9 Cookie\uFF1B\u5173\u95ED\uFF1A\u684C\u9762\u7EE7\u7EED\u8D70\u666E\u901A\u8DEF\u5F84\uFF08\u4EC5\u5728\u8BE5\u6765\u6E90\u5DF2\u88AB\u4FE1\u4EFB\u65F6\u6709\u610F\u4E49\uFF09\u3002",
  "settings.tokenTtlMs": "\u914D\u5BF9\u94FE\u63A5\u6709\u6548\u671F\uFF08\u6BEB\u79D2\uFF09",
  "settings.tokenTtlMsHint": "\u65B0\u751F\u6210\u7684\u4E8C\u7EF4\u7801\u94FE\u63A5\u5728\u6B64\u65F6\u95F4\u540E\u5931\u6548\u3002",
  "lan.cardTitle": "\u5C40\u57DF\u7F51\u8BBF\u95EE",
  "lan.bind": "\u7ED1\u5B9A\uFF1A{host}:{port}",
  "lan.off": "\u5F53\u524D\u4EC5\u672C\u673A\u53EF\u8BBF\u95EE\u3002",
  "lan.urls": "\u5C40\u57DF\u7F51\u5730\u5740\uFF1A{urls}",
  "lan.firewall.ok": "\u9632\u706B\u5899\u5DF2\u653E\u884C",
  "lan.firewall.bad": "\u9632\u706B\u5899\u672A\u653E\u884C\uFF08\u9700\u7BA1\u7406\u5458\u6743\u9650\uFF09",
  "lan.firewall.unmanaged": "\u9632\u706B\u5899\u4E0D\u7531\u63D2\u4EF6\u7BA1\u7406\uFF08\u672A\u68C0\u6D4B\u5230\u53D7\u652F\u6301\u7684\u9632\u706B\u5899\uFF09",
  "lan.untouched": "\u5C1A\u672A\u63A5\u7BA1\uFF1A\u7ED1\u5B9A\u7531\u542F\u52A8\u53C2\u6570\u51B3\u5B9A\u3002",
  "lan.pendingRestart": "\u7ED1\u5B9A\u5C06\u5728\u91CD\u542F dsh web \u540E\u751F\u6548\u3002",
  "settings.on": "\u5F00",
  "settings.off": "\u5173",
  "settings.overridden": "\u5DF2\u8986\u76D6",
  "settings.reset": "\u6062\u590D\u9ED8\u8BA4",
  "settings.notExposed": "\u5F53\u524D DSH \u7248\u672C\u672A\u5411\u8BBE\u7F6E\u9875\u66B4\u9732\u672C\u63D2\u4EF6\u7684\u914D\u7F6E\u547D\u540D\u7A7A\u95F4\uFF0C\u8868\u5355\u4E0D\u53EF\u7528\u3002\u53EF\u7F16\u8F91 $DSH_HOME/settings.yaml \u76F4\u63A5\u914D\u7F6E\uFF0C\u6216\u786E\u8BA4\u63D0\u4F9B\u8BE5\u547D\u540D\u7A7A\u95F4\u7684\u63D2\u4EF6\u5DF2\u6302\u8F7D\u5176\u8BBE\u7F6E\u57DF\u5E76\u91CD\u542F\u3002",
  "settings.readOnly": "\u5F53\u524D\u90E8\u7F72\u7684\u8BBE\u7F6E\u53EA\u8BFB\u3002",
  "settings.expand": "\u5C55\u5F00\u8BBE\u7F6E",
  "settings.collapse": "\u6536\u8D77\u8BBE\u7F6E",
  "settings.save": "\u4FDD\u5B58",
  "settings.saving": "\u4FDD\u5B58\u4E2D\u2026",
  "settings.discard": "\u653E\u5F03",
  "settings.unsaved": "\u672A\u4FDD\u5B58",
  "settings.saveFailed": "\u90E8\u7F72\u672A\u63A5\u53D7\u8FD9\u4E9B\u503C\uFF0C\u5DF2\u4FDD\u7559\u4F9B\u4F60\u4FEE\u6539\u3002",
  "settings.invalidNumber": "\u8BF7\u8F93\u5165\u6570\u5B57\uFF0C\u7559\u7A7A\u5219\u4F7F\u7528\u9ED8\u8BA4\u503C\u3002"
  // 更新面板（侧边栏更新按钮）。
};
var en = {
  "entry.label": "Remote access",
  "mobile.whale.open": "Open sidebar",
  "title": "Remote access",
  "subtitle": "Pair a phone or another computer to share the same Web GUI (official UI + mobile adaptation)",
  "card.title": "Pair a device",
  "public.badge": "Public",
  "status.waiting": "Waiting for a device",
  "status.connected": "{n} device(s) connected",
  "status.disconnected": "Paired devices offline",
  "status.stopped": "Remote access stopped",
  "status.lanRequired": "This feature needs a LAN bind or a public address",
  "status.lanRequiredHint": "The server is bound to 127.0.0.1 and no public address is configured, so a phone cannot reach it. Turn on LAN access in the settings below, or restart with dsh web --host 0.0.0.0, or set the tunneled public address.",
  "status.loopbackRequired": "The pairing panel works on this machine only",
  "status.loopbackRequiredHint": "Open this page at http://127.0.0.1 to mint a QR code; phones use the paired link.",
  "status.unreachable": "Cannot reach the pairing service",
  "status.unreachableHint": "Refresh the page and try again.",
  "status.disabled": "Remote access is off",
  "status.disabledHint": "Every paired device lost its session and the public tunnel is down. Turn on remote access in the settings below, then refresh.",
  "pair.hint": "Cannot scan? Open one of the pairing links below",
  "pair.publicHint": "Public links work when the device is not on the same network",
  "address.label": "Network the QR code points to",
  "address.public": "Public",
  "address.lan": "LAN",
  "address.hint": "Use the public address when the remote device is on another network; LAN addresses only work on the same network.",
  "pair.expires": "QR code valid until {time}",
  "pair.expired": "QR code expired \u2014 refresh it",
  "pair.linkLabel": "Pairing link",
  "pair.tokenLabel": "Pairing token",
  "pair.dockerHint": "In Docker or reverse proxy environments, copy this token to pair directly on the target device.",
  "pair.oneTimeHint": "The link carries a time-limited token: until it expires or the QR is refreshed, the same link can pair several devices, each with its own device session.",
  "pair.failed.title": "Pairing failed",
  "pair.failed.detail": "The link is invalid or has expired. Refresh the QR code on your computer and scan again.",
  "fence.unpaired.title": "This device is not paired and cannot reach workspace data",
  "fence.unpaired.eyebrow": "Device pairing required",
  "fence.unpaired.hint": "To protect workspace, session, and plugin data, a remote computer must first be authorized by the primary computer.",
  "fence.unpaired.stepDesktop": "On the primary computer, open http://127.0.0.1:3080 and go to Remote access.",
  "fence.unpaired.stepLink": "Copy the computer pairing link under Pair a device.",
  "fence.unpaired.stepOpen": "Open that link in this browser. After authorization, the workspace will become available.",
  "fence.unpaired.retry": "Check again",
  "fence.unpaired.tokenPlaceholder": "Or paste pairing link / token here",
  "fence.unpaired.pairAction": "Pair Now",
  "fence.unpaired.pairing": "Pairing\u2026",
  "fence.unpaired.tokenInvalid": "Pairing link or token is invalid or expired",
  "fence.unpaired.tokenFailed": "Pairing failed, please check network or issue a new link",
  "fence.unpaired.footnote": "Do not use pairing links from people you do not trust. An administrator can revoke this device at any time.",
  "posture.exposed": "The /api channel is open to unpaired devices",
  "posture.exposedHint": "Requests from {hosts} reach the full desktop API without pairing. Remove --trusted-host for them (pairing already covers remote access), or bind loopback only and use the tunnel.",
  "action.stop": "Stop",
  "action.refresh": "Refresh QR",
  "action.copy": "Copy link",
  "action.copyLink": "Copy link",
  "action.copyToken": "Copy token",
  "action.copied": "Copied",
  "action.copiedToken": "Token copied",
  "devices.title": "Authorized devices",
  "devices.empty": "No paired devices yet. Scan the QR or open the link to add one.",
  "devices.unknown": "Unknown device",
  "devices.online": "Online",
  "devices.offline": "Offline",
  "devices.lastSeen": "Last active {time}",
  "devices.revoke": "Unpair",
  "devices.revoke.label": "Unpair this device",
  "stopped.hint": 'Remote access is stopped. Click "Refresh QR" to re-enable it.',
  "tunnel.starting": "The public tunnel is starting; the QR code will switch to a public link shortly\u2026",
  "tunnel.failed": "The public tunnel failed to start: {error}",
  "tunnel.unknownError": "unknown error",
  "relay.registering": "Syncing the ephemeral tunnel to the stable hostname (<id>.dsh-market.com)\u2026",
  "relay.failed": "Stable-hostname sync failed: {error}. Retrying automatically; the QR may use the ephemeral address meanwhile.",
  "close.label": "Close remote access panel",
  // Plugin settings card (the family list seat, or the official bundle-config seat).
  "settings.title": "Remote connection settings",
  "settings.description": "Phone pairing, the public tunnel and LAN access.",
  "settings.sectionAccess": "Remote access",
  "settings.enabled": "Enable remote access",
  "settings.enabledHint": "When off, every paired device is revoked and the public tunnel stops; the sidebar entry stays so you can turn it back on.",
  "settings.sectionPublic": "Public access",
  "settings.tunnel": "How the GUI is reached publicly",
  "settings.tunnelHint": "Let a phone on another network reach this machine. One mode at a time.",
  "settings.tunnelOff": "Off",
  "settings.tunnelOffDetail": "Only this machine and the local network can connect.",
  "settings.tunnelQuick": "Temporary tunnel",
  "settings.tunnelQuickDetail": "The plugin runs a Cloudflare quick tunnel with no setup; the address changes on every start, so a phone has to scan again after a restart.",
  "settings.tunnelNamed": "Fixed-domain tunnel",
  "settings.tunnelNamedDetail": "The plugin runs your own Cloudflare named tunnel: the hostname never changes, so a phone pairs once and keeps its bookmark across restarts. Map that hostname to http://127.0.0.1:port in the Cloudflare dashboard first.",
  "settings.tunnelHost": "Public hostname",
  "settings.tunnelHostHint": "The address the fixed-domain tunnel serves, e.g. https://dsh.example.com.",
  "settings.tunnelToken": "Cloudflare tunnel token",
  "settings.tunnelTokenHint": "The value of cloudflared tunnel run --token. Leave blank to keep the stored token.",
  "settings.tunnelHostMissing": "The fixed-domain tunnel needs its public hostname.",
  "settings.tunnelHostInvalid": "The public hostname must be an http(s) URL.",
  "settings.tunnelTokenMissing": "The fixed-domain tunnel needs its Cloudflare tunnel token.",
  "settings.sectionLan": "LAN access",
  "settings.lanBind": "Bind address",
  "settings.lanBindHint": "Whether the web server listens on the local network. A change is written into the profile patch and usually applies after dsh web restarts.",
  "settings.lanFollow": "Follow the launch flags",
  "settings.lanFollowDetail": "The plugin leaves the profile patch alone; dsh web --host decides the bind.",
  "settings.lanOn": "Open to the LAN (0.0.0.0)",
  "settings.lanOnDetail": "Writes the profile patch to default the bind to 0.0.0.0 and opens the host firewall.",
  "settings.lanOff": "This machine only (127.0.0.1)",
  "settings.lanOffDetail": "Writes the profile patch to pin the bind to 127.0.0.1.",
  "settings.sectionOther": "Other",
  "settings.requirePairingForLan": "Require pairing for LAN access",
  "settings.requirePairingForLanHint": "On: a desktop Web GUI at a non-loopback origin rides the gated /remote channel and must carry a live paired-device cookie. Off: the desktop stays on its original paths (only useful when that origin is already trusted).",
  "settings.tokenTtlMs": "Pairing link lifetime (ms)",
  "settings.tokenTtlMsHint": "How long a minted QR link stays valid before it dies.",
  "lan.cardTitle": "LAN access",
  "lan.bind": "Bind: {host}:{port}",
  "lan.off": "Currently localhost-only.",
  "lan.urls": "LAN URLs: {urls}",
  "lan.firewall.ok": "firewall open",
  "lan.firewall.bad": "firewall blocked (needs admin)",
  "lan.firewall.unmanaged": "firewall not managed (no supported firewall detected)",
  "lan.untouched": "Not managed: the bind comes from the launch flags.",
  "lan.pendingRestart": "The bind change takes effect after dsh web restarts.",
  "settings.on": "On",
  "settings.off": "Off",
  "settings.overridden": "Overridden",
  "settings.reset": "Reset to default",
  "settings.notExposed": "This DSH version does not expose this plugin's settings namespace to the configuration page, so the form is unavailable. Edit $DSH_HOME/settings.yaml directly, or confirm that the plugin owning the namespace is mounted with its settings domain and restart.",
  "settings.readOnly": "This deployment stores settings read-only.",
  "settings.expand": "Show settings",
  "settings.collapse": "Hide settings",
  "settings.save": "Save",
  "settings.saving": "Saving\u2026",
  "settings.discard": "Discard",
  "settings.unsaved": "Unsaved",
  "settings.saveFailed": "The deployment did not accept these values; they were left for you to correct.",
  "settings.invalidNumber": "Enter a number, or leave blank to use the default."
  // Update panel (the sidebar update trigger).
};

// packages/dsh-remote-web/src/client/deep-link.ts
var PAIR_FAILED_MARKER = "dsh-remote-pair-failed";
var browserPage = {
  get href() {
    return window.location.href;
  },
  replaceState(url) {
    window.history.replaceState(null, "", url);
  },
  navigate(url) {
    window.location.assign(url);
  },
  reload() {
    window.location.reload();
  }
};
function runPairBootFlow(ctx, search, page = browserPage) {
  void ctx;
  const params = readPairParams(search);
  if (params.pair !== void 0) {
    void runAccept(params.pair, page);
  }
}
async function runAccept(token, page) {
  let ok = false;
  try {
    const result = await acceptPair(token);
    ok = result.ok;
    if (!ok) sessionStorage.setItem(PAIR_FAILED_MARKER, "failed");
  } catch {
    sessionStorage.setItem(PAIR_FAILED_MARKER, "failed");
  }
  const url = new URL(page.href);
  url.searchParams.delete("pair");
  page.replaceState(`${url.pathname}${url.search}${url.hash}`);
  if (ok) {
    page.reload();
  }
}

// packages/dsh-remote-web/src/http/remote-methods.ts
var REMOTE_PREFIX = "/remote";
var REMOTE_API_PREFIX = `${REMOTE_PREFIX}/api`;
var REMOTE_API_PATHS = {
  mux: `${REMOTE_API_PREFIX}/remote.mux`
};
var REMOTE_UPGRADE_PATHS = [
  REMOTE_API_PATHS.mux,
  `${REMOTE_PREFIX}/sidebar/ws/terminal`,
  `${REMOTE_PREFIX}/sidebar/ws/agent-terminals`,
  `${REMOTE_PREFIX}/sidebar/ws/agent-opens`,
  `${REMOTE_API_PREFIX}/dsh-ssh/terminal`
];
var REMOTE_DEVICE_HEADER = "x-dsh-remote-device";
var REMOTE_DEVICE_QUERY = "device";

// packages/dsh-remote-web/src/http/remote-channel-rules.ts
var REMOTE_PREFIX2 = "/remote";
var WEB_PAGE_PROTOCOLS = [
  "http:",
  "https:",
  "blob:",
  "data:",
  "about:",
  "filesystem:"
];
function isWebPageProtocol(protocol) {
  return WEB_PAGE_PROTOCOLS.includes(protocol);
}
function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "::1" || hostname === "[::1]") return true;
  const parts = hostname.split(".");
  return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
function isLocalPage(hostname, protocol, transportOwnsHost) {
  if (isLoopbackHostname(hostname)) return true;
  if (protocol !== void 0 && protocol !== "" && !isWebPageProtocol(protocol)) return true;
  return transportOwnsHost === true && !isNetworkOrigin(hostname);
}
function isNetworkOrigin(hostname) {
  return hostname.includes(".") || hostname.includes(":");
}
var REMOTE_API_PREFIX2 = `${REMOTE_PREFIX2}/api`;
var REMOTE_HOST_GRANT_GLOBAL = "__DSH_REMOTE_HOST_GRANT__";
var REMOTE_CHANNEL_RULES = {
  remotePrefix: REMOTE_PREFIX2,
  apiPrefix: "/api/",
  pairPrefix: "/api/pair/",
  updatePrefix: "/api/update/",
  settingsBridgePrefix: "/api/dsh-web-ui-settings",
  sidebarPrefix: "/sidebar/",
  gitPrefix: "/git/",
  petPrefix: "/pet/",
  // The official 0.1.2-alpha.2 line opens exactly one stream socket (the
  // Typert gateway mux, /api/remote.mux); the legacy /api/events.* paths
  // were removed by the SDK and stay absent here.
  wsPaths: [
    "/api/remote.mux",
    "/sidebar/ws/terminal",
    "/sidebar/ws/agent-terminals",
    "/sidebar/ws/agent-opens",
    "/api/dsh-ssh/terminal"
  ],
  deviceHeader: REMOTE_DEVICE_HEADER,
  deviceKey: "dsh-remote-device",
  deviceQuery: REMOTE_DEVICE_QUERY,
  uploadPath: "/api/session/uploadFileBinary",
  uploadHookGlobal: "__DSH_FILE_UPLOAD__",
  webProtocols: WEB_PAGE_PROTOCOLS,
  hostGrantGlobal: REMOTE_HOST_GRANT_GLOBAL
};
var REMOTE_CHANNEL_BOOT_GLOBAL = "__DSH_REMOTE_CHANNEL_BOOT__";

// packages/dsh-remote-web/src/client/remote-channel.ts
var RULES = REMOTE_CHANNEL_RULES;
function pageOriginFacts(win = window) {
  const transport = win.__DSH_TRANSPORT__;
  return {
    hostname: win.location.hostname,
    protocol: win.location.protocol,
    ...transport?.ownsHost === true ? { transportOwnsHost: true } : {}
  };
}
function remoteChannelRequired(origin, snapshot, hostPairingPolicy) {
  if (isLocalPage(origin.hostname, origin.protocol, origin.transportOwnsHost)) return false;
  if (snapshot.status === "ready") {
    return (snapshot.value?.enabled ?? true) && (snapshot.value?.requirePairingForLan ?? true);
  }
  return hostPairingPolicy !== false;
}
function shouldRewriteFetchPath(pathname) {
  if (pathname.startsWith(RULES.pairPrefix)) return false;
  if (pathname.startsWith(RULES.updatePrefix)) return false;
  if (pathname === RULES.settingsBridgePrefix || pathname.startsWith(`${RULES.settingsBridgePrefix}/`)) return false;
  if (pathname.startsWith(RULES.apiPrefix)) return true;
  if (pathname.startsWith(RULES.sidebarPrefix) || pathname === "/sidebar") return true;
  if (pathname.startsWith(RULES.gitPrefix) || pathname === "/git") return true;
  if (pathname.startsWith(RULES.petPrefix) || pathname === "/pet") return true;
  return false;
}
function shouldRewriteWsPath(pathname) {
  return RULES.wsPaths.includes(pathname);
}
function rewritePath(pathname) {
  return `${REMOTE_PREFIX2}${pathname}`;
}
function rewriteRawUrl(raw, baseHref, origin) {
  let url;
  try {
    url = new URL(raw, baseHref);
  } catch {
    return raw;
  }
  if (url.origin !== origin) return raw;
  if (!shouldRewriteFetchPath(url.pathname)) return raw;
  url.pathname = rewritePath(url.pathname);
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return url.href;
}
function unpairedCodeOf(value) {
  if (typeof value !== "object" || value === null) return void 0;
  const record = value;
  const nested = record.result;
  if (typeof nested === "object" && nested !== null) {
    const error2 = nested.error;
    if (typeof error2 === "object" && error2 !== null && typeof error2.code === "string") {
      return error2.code;
    }
  }
  const error = record.error;
  if (typeof error === "object" && error !== null && typeof error.code === "string") {
    return error.code;
  }
  return void 0;
}
async function isUnpairedDenied(response) {
  if (response.status !== 403) return false;
  try {
    return unpairedCodeOf(await response.json()) === "unpaired";
  } catch {
    return false;
  }
}
function patchSrcAccessor(ctor, rewrite) {
  if (ctor === void 0) return () => {
  };
  const descriptor = Object.getOwnPropertyDescriptor(ctor.prototype, "src");
  if (descriptor === void 0 || descriptor.configurable === false) return () => {
  };
  if (descriptor.set === void 0) return () => {
  };
  const originalSet = descriptor.set;
  const originalGet = descriptor.get;
  Object.defineProperty(ctor.prototype, "src", {
    configurable: true,
    enumerable: descriptor.enumerable ?? true,
    get: originalGet,
    set(value) {
      originalSet.call(this, rewrite(String(value)));
    }
  });
  return () => {
    Object.defineProperty(ctor.prototype, "src", descriptor);
  };
}
function installRemoteChannel(window2, options = {}) {
  const originalFetch = window2.fetch;
  const OriginalWebSocket = window2.WebSocket;
  const OriginalEventSource = window2.EventSource;
  const restoreUploadHook = installFileUploadHook(window2);
  const sameOrigin = (url) => url.origin === window2.location.origin;
  const rewrite = (raw) => rewriteRawUrl(raw, window2.location.href, window2.location.origin);
  const device = (() => {
    try {
      return window2.sessionStorage?.getItem(RULES.deviceKey) ?? null;
    } catch {
      return null;
    }
  })();
  const attach = (init, inherited) => {
    if (device === null) return init;
    try {
      const merged = new Headers(init?.headers ?? inherited);
      merged.set(RULES.deviceHeader, device);
      return { ...init, headers: merged };
    } catch {
      return init;
    }
  };
  const withDeviceQuery = (url) => {
    if (device !== null) url.searchParams.set(RULES.deviceQuery, device);
    return url;
  };
  const patchedFetch = (input, init) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input.toString() : input.url,
      window2.location.href
    );
    if (sameOrigin(url) && shouldRewriteFetchPath(url.pathname)) {
      const rewritten = new URL(url);
      rewritten.pathname = rewritePath(url.pathname);
      const next = typeof input === "string" || input instanceof URL ? rewritten.toString() : new Request(rewritten, input);
      const inherited = typeof input === "object" && "headers" in input ? input.headers : void 0;
      return Promise.resolve(originalFetch.call(window2, next, attach(init, inherited))).then(async (response) => {
        if (response.status === 403 && await isUnpairedDenied(response.clone())) options.onUnpaired?.();
        else options.onPaired?.();
        return response;
      });
    }
    return originalFetch.call(window2, input, init);
  };
  class PatchedWebSocket extends OriginalWebSocket {
    constructor(url, protocols) {
      const parsed = new URL(url.toString(), window2.location.href);
      const wsOrigin = parsed.protocol === "wss:" ? `https://${parsed.host}` : parsed.protocol === "ws:" ? `http://${parsed.host}` : "";
      if (wsOrigin !== "" && wsOrigin === window2.location.origin && shouldRewriteWsPath(parsed.pathname)) {
        const rewritten = new URL(parsed);
        rewritten.pathname = rewritePath(parsed.pathname);
        super(withDeviceQuery(rewritten), protocols);
        return;
      }
      super(url, protocols);
    }
  }
  const restoreSrc = [
    patchSrcAccessor(window2.HTMLImageElement, rewrite),
    patchSrcAccessor(window2.HTMLScriptElement, rewrite),
    patchSrcAccessor(window2.HTMLIFrameElement, rewrite)
  ];
  window2.fetch = patchedFetch;
  window2.WebSocket = PatchedWebSocket;
  if (OriginalEventSource !== void 0) {
    class PatchedEventSource extends OriginalEventSource {
      constructor(url, eventSourceInitDict) {
        const parsed = new URL(url.toString(), window2.location.href);
        if (sameOrigin(parsed) && shouldRewriteFetchPath(parsed.pathname)) {
          const rewritten = new URL(parsed);
          rewritten.pathname = rewritePath(parsed.pathname);
          super(withDeviceQuery(rewritten), eventSourceInitDict);
          return;
        }
        super(url, eventSourceInitDict);
      }
    }
    window2.EventSource = PatchedEventSource;
  }
  return () => {
    window2.fetch = originalFetch;
    window2.WebSocket = OriginalWebSocket;
    if (OriginalEventSource !== void 0) window2.EventSource = OriginalEventSource;
    for (const restore of restoreSrc) restore();
    restoreUploadHook();
  };
}
function installFileUploadHook(window2) {
  if (window2.__DSH_FILE_UPLOAD__ !== void 0) return () => {
  };
  const originalFetch = window2.fetch;
  const hook = {
    fetch: (input, init) => {
      const raw = typeof input === "string" ? input : input.href;
      let url;
      try {
        url = new URL(raw, window2.location.href);
      } catch {
        return originalFetch.call(window2, input, init);
      }
      if (url.origin === window2.location.origin && url.pathname === RULES.uploadPath) {
        return window2.fetch.call(window2, raw, init);
      }
      return originalFetch.call(window2, input, init);
    }
  };
  window2.__DSH_FILE_UPLOAD__ = hook;
  return () => {
    if (window2.__DSH_FILE_UPLOAD__ === hook) delete window2.__DSH_FILE_UPLOAD__;
  };
}
function channelTransition(active, installed) {
  if (active && !installed) return "install";
  if (!active && installed) return "retire";
  return "none";
}

// packages/dsh-remote-web/src/client/panel/FenceNotice.tsx
var import_react7 = require("react");
var import_jsx_runtime9 = require("react/jsx-runtime");
function extractPairToken(input) {
  const trimmed = input.trim();
  if (trimmed === "") return void 0;
  try {
    const url = new URL(trimmed);
    const token = url.searchParams.get("pair");
    if (token !== null && token !== "") return token;
  } catch {
  }
  return trimmed;
}
function FenceNotice({ t, onRetry, onAccept = acceptPair }) {
  const [tokenInput, setTokenInput] = (0, import_react7.useState)("");
  const [submitting, setSubmitting] = (0, import_react7.useState)(false);
  const [errorMsg, setErrorMsg] = (0, import_react7.useState)(void 0);
  const handleSubmit = async (event) => {
    event.preventDefault();
    const token = extractPairToken(tokenInput);
    if (!token) return;
    setSubmitting(true);
    setErrorMsg(void 0);
    try {
      const result = await onAccept(token);
      if (result.ok) {
        onRetry();
        return;
      }
      if (result.code === "invalid") {
        setErrorMsg(t("fence.unpaired.tokenInvalid"));
      } else {
        setErrorMsg(t("fence.unpaired.tokenFailed"));
      }
    } catch {
      setErrorMsg(t("fence.unpaired.tokenFailed"));
    } finally {
      setSubmitting(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: remote_default.fencePage, role: "dialog", "aria-modal": "true", "aria-labelledby": "remote-fence-title", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("main", { className: remote_default.fenceCard, "data-dsh-plugin": "remote-web-ui", children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: remote_default.fenceMark, "aria-hidden": "true", children: "\xD7" }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: remote_default.fenceEyebrow, children: t("fence.unpaired.eyebrow") }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("h1", { id: "remote-fence-title", className: remote_default.fenceTitle, children: t("fence.unpaired.title") }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: remote_default.fenceDetail, children: t("fence.unpaired.hint") }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("ol", { className: remote_default.fenceSteps, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("li", { children: t("fence.unpaired.stepDesktop") }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("li", { children: t("fence.unpaired.stepLink") }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("li", { children: t("fence.unpaired.stepOpen") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("form", { className: remote_default.fenceForm, onSubmit: handleSubmit, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: remote_default.fenceInputRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "input",
          {
            type: "text",
            className: remote_default.fenceInput,
            placeholder: t("fence.unpaired.tokenPlaceholder"),
            value: tokenInput,
            onChange: (event) => {
              setTokenInput(event.target.value);
              if (errorMsg !== void 0) setErrorMsg(void 0);
            },
            disabled: submitting,
            "aria-label": t("fence.unpaired.tokenPlaceholder")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "button",
          {
            className: remote_default.fencePairButton,
            type: "submit",
            disabled: submitting || tokenInput.trim() === "",
            children: submitting ? t("fence.unpaired.pairing") : t("fence.unpaired.pairAction")
          }
        )
      ] }),
      errorMsg !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: remote_default.fenceError, role: "alert", children: errorMsg })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("button", { className: remote_default.fenceRetry, type: "button", onClick: onRetry, children: t("fence.unpaired.retry") }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: remote_default.fenceFootnote, children: t("fence.unpaired.footnote") })
  ] }) });
}

// packages/dsh-remote-web/src/client/mobile-adapt.ts
var FORCE_DESKTOP_KEY = "dsh-remote-force-desktop";
var WHALE_POS_KEY = "dsh-remote-whale-pos";
var ADAPT_CSS_ID = "dsh-remote-web-ui/mobile-adapt.css";
var ACTIVE_CLASS = "dsh-remote-portrait";
var RAIL_HIDDEN_CLASS = "dsh-remote-rail-hidden";
var SIDEBAR_SELECTOR = '[class*="_sidebarCol"]';
var ROW_SELECTOR = '[class*="_sessionRow"], [class*="_projectRow"]';
var STYLE_SELECTOR = `style[data-plugin-css="${ADAPT_CSS_ID}"]`;
var WHALE_ID = "dshRemoteWhale";
var HEADER_SEATED_CLASS = "dsh-remote-header-seated";
var HEADER_RESERVE_VAR = "--dsh-remote-header-actions-reserve";
var APP_FRAME_SELECTOR = '[data-dsh-frame], [class*="_frame"]:has([class*="_centerCol"])';
var COMPOSER_SELECTOR = '[class$="_composerSeat"], [data-dsh-surface="composer"]';
function appFrame() {
  const frame = document.querySelector(APP_FRAME_SELECTOR);
  return frame instanceof HTMLElement ? frame : null;
}
function isMobilePortrait() {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  if (!window.matchMedia("(orientation: portrait)").matches) return false;
  if (!window.matchMedia("(pointer: coarse)").matches) return false;
  if (window.innerWidth >= 1100) return false;
  if (window.sessionStorage.getItem(FORCE_DESKTOP_KEY) === "1") return false;
  return true;
}
var ADAPT_CSS = [
  "html,body{height:100%}",
  // The app frame fills the dynamic viewport (browser chrome collapse).
  // Scoped to the application frame: a bare [class$="_frame"] also matches the
  // chat turn rail, message thumbnails, the subagent pill and PlanReviewPanel,
  // stretching each to a full-width 100dvh pointer-events:auto block.
  '[class*="_frame"]:has([class*="_centerCol"]){width:100%;height:100dvh}',
  // Collapsed rail: bigger touch targets.
  '[class$="_railFish"] button,[class$="_panelIcon"],[class$="_newSession"]{min-width:44px;min-height:44px}',
  // Message list padding on narrow screens.
  '[class$="_scroll"]{padding:8px 10px}',
  // 16px inputs prevent iOS focus zoom; keep the send button touchy.
  '[class$="_input"],textarea,input{font-size:16px}',
  '[class$="_composer"]{padding-bottom:calc(4px + env(safe-area-inset-bottom))}',
  // v50: slightly smaller type on portrait phones.
  '[class$="_scrollBody"] [class$="_root"]{font-size:14.5px}',
  '[class$="_scrollBody"] [class$="_bubble"]{font-size:14.5px}',
  '[class$="_titleRow"] *{font-size:13px}',
  '[class*="_sidebarCol"] [class$="_root"],[class*="_sidebarCol"] [class$="_newSession"],[class*="_sidebarCol"] [class$="_trigger"],[class*="_sidebarCol"] [class$="_title"]{font-size:13px}',
  '[class*="_sidebarCol"] [class$="_meta"],[class*="_sidebarCol"] [class$="_time"]{font-size:11.5px}',
  // v50: collapsed rail hidden; the whale button is the entry. The frame's
  // grid is inline-styled (56px rail track when collapsed); pin the first
  // track to 0 so content uses the full width. On portrait phones the
  // details track is always 0 (computeColumns drops it when there is no
  // room), so the three-track override is safe here.
  '[class$="_frame"][data-sidebar-collapsed]{grid-template-columns:0 minmax(0,1fr) 0 !important}',
  // The official collapsed sidebar is an absolutely-positioned overlay rail
  // (it leaves the grid flow), so the in-flow centerCol would auto-place
  // into the now-0px FIRST track and collapse the conversation to zero width
  // on an intermittent basis (the rail flips relative <-> absolute as the
  // host overlay mounts). Pin every column to an explicit track so the
  // center always lands on the 1fr track regardless of the sidebar's
  // computed position.
  '[class$="_frame"][data-sidebar-collapsed] [class*="_sidebarCol"]{grid-column:1/2}',
  '[class$="_frame"][data-sidebar-collapsed] [class$="_centerCol"]{grid-column:2/3}',
  '[class$="_frame"][data-sidebar-collapsed] [class$="_detailsCol"]{grid-column:3/4}',
  // Keep the chat header title clear of the floating whale.
  `body.${RAIL_HIDDEN_CLASS} [class$="_titleRow"]{padding-left:52px}`,
  // The whale button itself.
  `#${WHALE_ID}{position:fixed;top:calc(4px + env(safe-area-inset-top));left:calc(8px + env(safe-area-inset-left));z-index:2147482999;width:34px;height:34px;min-width:34px;padding:0;border-radius:10px;background:var(--dsw-alias-bg-module-platform);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,.25)}`,
  `#${WHALE_ID} svg{width:20px;height:15px;display:block}`,
  `#${WHALE_ID}:active{opacity:.72}`,
  `#${WHALE_ID}{touch-action:none}`,
  // v51/v52: smaller collapse toggle in the expanded sidebar (the toggle
  // carries two classes, so match by containment); v47's panelIcon touch
  // rule forces a 44px min on the icon itself — zero it out so the 13px
  // glyph fits the 18px button.
  '[class*="_sidebarCol"] [class$="_logoRow"] [class*="_iconButton"]{width:18px;height:18px}',
  '[class*="_sidebarCol"] [class$="_logoRow"] [class*="_iconButton"] svg{width:13px;height:13px;min-width:0;min-height:0}',
  // v77: workspace rows' right-side actions (menu + new session) are
  // hover-only on desktop; always show them on mobile touch.
  '[class*="_sidebarCol"] [class*="_projectRow"] [class*="_rowActions"]{display:inline-flex}',
  // v78: mobile long-press on a row must not start native drag.
  '[class*="_sidebarCol"] [class*="_sessionRow"],[class*="_sidebarCol"] [class*="_projectRow"]{-webkit-user-drag:none;user-select:none}',
  // Hide the header Session-log download button (no space on phones).
  '[class$="_headerUtilities"]{display:none}',
  // v52 composer: the two lines (permission / model) stay stacked with zero
  // row gap; the command, context-meter and send/stop buttons float at the
  // left/right edges vertically centered over both lines. "Both lines" is what
  // makes _row the containing block for those three floats: _row is the one box
  // that wraps the lines, so nothing between a float and _row may claim it.
  '[class$="_composerSeat"] [class$="_card"]{margin-bottom:1px}',
  '[class$="_composerSeat"] [class$="_row"]{flex-wrap:wrap;row-gap:0;padding:2px 8px 1px;position:relative}',
  // The attach button is the only file-picker entry on the portrait composer,
  // and taking it out of flow costs it the paint order it had inline: a
  // positioned sibling painted after it (the trailing line, see below) covers
  // it and eats the taps on the covered half. Its own z-index makes the hit
  // layer a property of the button instead of a side effect of a sibling
  // (#1829). It clears the composer's own stacking ladder and stays far below
  // the bottom-sheet menus (2147482000), which own the overlay above it.
  '[class$="_composerSeat"] [class$="_add"]{position:absolute;left:8px;top:50%;transform:translateY(-50%);z-index:10}',
  '[class$="_composerSeat"] [class$="_modes"]{min-width:0;padding-left:38px}',
  // Model line left-aligned with the permission line (same command-button
  // clearance), rows stay tightly stacked.
  // The trailing line is forced onto its own row at flex-basis:100% and carries
  // 116px of side padding (38 left for the command button, 78 right for the
  // send button). Under the default content-box that padding is ADDED to the
  // 100% basis, so the line's own box overflowed the card by exactly 116px and
  // dragged the absolutely-positioned send button out with it: on a 393px phone
  // the card ended at x=367 while the button sat at x=433..467, past the
  // viewport's right edge, which is the unreachable button the reporter
  // measured (#1818). border-box contains the padding inside the basis, so the
  // line stays within the card and the button lands back inside it.
  //
  // The line stays UNPOSITIONED on purpose. position:relative arrived here with
  // the compact picker and outlived it, but this box is the LAST line only: as
  // the nearest positioned ancestor it took the containing block from _row, so
  // the send button and the context meter centered inside the trailing line
  // instead of over both lines - the send button rode the input's bottom edge,
  // out of line with the attach button - and, painted after the out-of-flow
  // attach button, the line covered that button's lower half and swallowed the
  // taps there (#1829).
  '[class$="_composerSeat"] [class$="_trailing"]{box-sizing:border-box;flex-basis:100%;min-height:32px;justify-content:flex-start;padding-left:38px;padding-right:78px}',
  '[class$="_composerSeat"] [class$="_trailing"] *{font-size:12px}',
  // v54: smaller permission/model buttons (font + height). v79: the
  // permission trigger collapses to its shield icon on phones — the label
  // text is the first thing a narrow row drops (the icon color carries the
  // state), matching the dsh-LAN compact composer.
  '[class$="_composerSeat"] [class$="_modes"] [class$="_trigger"]{height:24px;min-height:24px;font-size:12px}',
  '[class$="_composerSeat"] [class$="_trailing"] [class$="_trigger"]{height:24px;min-height:24px;font-size:11px}',
  // Context meter + send/stop float at the right edge, vertically centered
  // over both lines (the meter's root contains the track).
  '[class$="_composerSeat"] [class$="_trailing"] > [class$="_root"]:has([class$="_track"]){position:absolute;right:52px;top:50%;transform:translateY(-50%)}',
  '[class$="_composerSeat"] [class$="_primary"]{position:absolute;right:8px;top:50%;transform:translateY(-50%)}',
  // v79: the model picker menu anchors right:0 to its narrow trigger, so on
  // a phone both the picker menu and the model list fly past the left
  // viewport edge (model names unreadably cut). Turn the picker into a
  // bottom sheet: the composer seat carries an identity transform, which
  // would still become the containing block for fixed children, so free it
  // first; then pin every seat menu to the viewport bottom with real touch
  // targets. Covers the picker, the model list, and the other composer
  // popovers (permission presets, attachments) alike.
  '[class$="_composerSeat"]{transform:none !important}',
  '[class$="_composerSeat"] [class$="_menu"]{position:fixed !important;left:8px !important;right:8px !important;top:auto !important;bottom:calc(8px + env(safe-area-inset-bottom)) !important;width:auto !important;max-width:none !important;max-height:70dvh !important;overflow-y:auto !important;z-index:2147482000}',
  '[class$="_composerSeat"] [class$="_menu"] [class$="_cell"]{height:44px;min-height:44px;font-size:13px}',
  // v79's compact picker (two synthesized model/effort icon buttons in the
  // tools row, the trailing text trigger hidden behind a body class, and the
  // trailing line collapsed to zero width) was removed at the user's request.
  // The portrait composer keeps the official text trigger with the trailing
  // line rules above; the bottom-sheet rules immediately above still apply to
  // the official menu.
  // Bottom stats line (N rounds / M steps) two sizes below the tabs; v55
  // wraps freely but clamps at two lines (the official rule is nowrap +
  // single-line ellipsis); v60 drops the official 32px right padding.
  '[class$="_composerSeat"] [data-slot="conversation.composer.dock"] [class$="_root"]{font-size:10px;white-space:normal;word-break:break-word;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-align:left;line-height:13px;letter-spacing:-0.2px;padding-left:0;padding-right:0}',
  // (user bubbles keep the v50 14.5px via the _bubble rule.)
  '[class$="_scrollBody"] [class$="_root"]{font-size:13px}',
  // v58/v65 port note: the dsh-LAN `_body` gap:6px compaction is deliberately
  // NOT ported. The official message row is a shrinkable flex column whose
  // bottom-anchored body then measures shorter than its text (13px root font
  // on a fixed 24px line box), and the extra gap pushed the first text line
  // above the row box — every assistant message clipped its top half on the
  // phone (verified on the real GUI; the removal restores natural heights).
  // v58/v65: on touch, taps leave :hover/:focus stuck, so official Tooltip
  // bubbles stay visible on mobile. The bubble class hash sits AFTER the
  // name, so match by containment, still scoped by role=tooltip so user
  // message bubbles (no tooltip role) stay visible.
  '[class*="_bubble"][role="tooltip"]{display:none}',
  // v65: PlanReviewPanel shares the _frame/_card suffixes and overflows a
  // narrow phone; pin it to the viewport with border-box and cap its height
  // so the card sits fully on screen.
  '[class$="_composerSeat"] [class$="_frame"]{box-sizing:border-box;width:100%;max-width:100%;padding-left:12px;padding-right:12px;height:auto;max-height:calc(100dvh - 96px);align-items:flex-start;overflow-y:auto}',
  '[class$="_composerSeat"] [class$="_frame"] [class$="_card"]{max-width:none;width:100%}',
  // v67: header actions (agent-preset mode label + background-task badge)
  // are re-seated from the title row into the tabs row; hidden in the
  // original spot so React re-renders do not flicker them back.
  // Only while the layer has taken the actions over: out of flow (so the
  // title row keeps its own layout and React keeps owning the node) and
  // painted over the tabs row by the transform alignActionsText computes.
  `body.${HEADER_SEATED_CLASS} [class$="_header"] [class$="_titleCluster"] [class$="_headerActions"]{position:absolute;left:0;top:0;margin:0;display:flex;align-items:center;gap:6px;flex:none;z-index:2}`,
  // v70: match the tab text size with the seated mode label (12px); NB
  // [class$="_tab"] misses the active tab (its class ends in "_tabActive")
  // — containment so BOTH tabs match.
  '[class$="_header"] [class$="_tabs"] [class*="_tab"]{font-size:12px;white-space:nowrap}',
  // v80: the tabs row must give the painted actions their width up on its own.
  // The v67 padding reservation could not do it: the row is a nowrap flex
  // container, and once the tab labels plus their gaps overflow the reduced
  // content box the flex items spill over the padding box, so the trailing
  // tabs render underneath the actions (reported on a phone: a long agent
  // preset label covered the last tabs). Cap the row against the reserve and
  // let the labels scroll instead. The value rides a CSS variable on <html>
  // because the update lands before React re-creates the row node, and an
  // inline reservation on that node is dropped until the next sync tick.
  // The 2px bottom padding keeps the active-tab underline inside the clipping
  // box; the matching negative margin keeps the header height official.
  `body.${HEADER_SEATED_CLASS} [class$="_header"] [class$="_tabs"]{max-width:max(0px,calc(100% - var(${HEADER_RESERVE_VAR},0px)));overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:2px;margin-bottom:-2px}`,
  `body.${HEADER_SEATED_CLASS} [class$="_header"] [class$="_tabs"]::-webkit-scrollbar{display:none}`,
  `body.${HEADER_SEATED_CLASS} [class$="_header"] [class$="_tabs"] > [class*="_tab"]{flex:0 0 auto}`,
  // Mobile scope: hide the plugin surfaces that do not fit a phone — the
  // right-hand details column and every desktop-oriented tool surface. The
  // list keys on the L2 semantic roots (data-dsh-plugin, ownership stays
  // with the declaring plugin), so official class churn cannot resurrect
  // them. These are render suppressions: the client bundles still load.
  // The pet is part of the hidden set by design: the mobile remote mirror
  // carries the desktop-less phone surface, and a floating pet would only
  // cover the small viewport. The suppression is the requirement, not a bug.
  `body.${ACTIVE_CLASS} [class$="_detailsCol"]{display:none !important}`,
  `body.${ACTIVE_CLASS} [data-dsh-plugin="ssh"],`,
  `body.${ACTIVE_CLASS} [data-dsh-plugin="skill-explorer"],`,
  `body.${ACTIVE_CLASS} [data-dsh-plugin="task-board"],`,
  `body.${ACTIVE_CLASS} [data-dsh-plugin="git-graph"],`,
  `body.${ACTIVE_CLASS} [data-dsh-plugin="pet"],`,
  `body.${ACTIVE_CLASS} [data-dsh-plugin="usage"]{display:none !important}`,
  // The official workbench (Files / source control) mounts into a
  // full-viewport portal layer with no data-dsh-plugin root, so the plugin
  // list above cannot key on it; its open state persists across page loads,
  // and on a phone it covers the entire conversation with no visible close
  // control — the remote-opens-to-an-empty-screen report. Hide the
  // workbench panel only: the same portal layer also hosts the settings
  // modal, which must stay reachable (verified in the GUI QA round).
  `body.${ACTIVE_CLASS} [class$="_overlayLayer"] [class$="_workbench"]{display:none !important}`,
  // v68: settings modal on mobile — the official panel is a fixed 800px
  // two-column layout (nav + content); switch to a column layout: the
  // section nav becomes a horizontal scrollable row on top.
  // Scoped to the portrait body class like the suppressions above: these
  // are the only rules in this array that reshape an official two-column
  // surface, and the overlay portal is shared with every other dialog.
  // Unscoped, the tag — which lives in <head> for as long as the layer
  // is active and is restored by the sync tick after a revert —
  // collapsed the DESKTOP settings panel into a stacked column (measured
  // on a real 1440px host: panel flex-direction row -> column, nav 800px
  // tall -> 236px, content 612px -> 800px wide and pushed below the nav).
  `body.${ACTIVE_CLASS} [class$="_overlay"] [class$="_panel"]{flex-direction:column;max-height:calc(100dvh - 32px)}`,
  `body.${ACTIVE_CLASS} [class$="_overlay"] [class$="_panel"] [class$="_nav"]{flex-direction:row;gap:4px;width:100%;padding:12px 12px 0;overflow-x:auto;overflow-y:hidden}`,
  `body.${ACTIVE_CLASS} [class$="_overlay"] [class$="_panel"] [class$="_navTitle"]{display:none}`,
  `body.${ACTIVE_CLASS} [class$="_overlay"] [class$="_panel"] [class$="_navList"]{flex-direction:row;gap:4px}`,
  `body.${ACTIVE_CLASS} [class$="_overlay"] [class$="_panel"] [class$="_navCell"]{height:34px;padding:0 12px;gap:6px;flex:none;border-radius:10px}`,
  `body.${ACTIVE_CLASS} [class$="_overlay"] [class$="_panel"] [class$="_navLabel"]{font-size:13px}`,
  `body.${ACTIVE_CLASS} [class$="_overlay"] [class$="_panel"] [class$="_content"]{flex:1;min-height:0}`
];
var FISH_PATH = "M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018Z";
function startMobileAdapt() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__dshRemoteAdaptInstalled === true) return;
  window.__dshRemoteAdaptInstalled = true;
  const w = window;
  const surfaceText = (key, fallback) => {
    try {
      const out = w.__dshRemoteAdapt?.translate?.(key);
      return typeof out === "string" && out.length > 0 ? out : fallback;
    } catch {
      return fallback;
    }
  };
  let active = false;
  let savedViewportContent = null;
  let whaleEl = null;
  let whaleObserver = null;
  let headerObserver = null;
  let domObserver = null;
  let observedHeader = null;
  let headerGeometryDirty = true;
  let whaleTimer = null;
  let whaleSuppressClick = false;
  let whaleShown = false;
  let drag = null;
  let swipeTouch = null;
  let lastComposerTap = 0;
  let adaptEnabled = true;
  function ensureAdaptStyle() {
    if (nodeOf(STYLE_SELECTOR) !== null) return;
    const tag = document.createElement("style");
    tag.dataset.plugin = "remote-web-ui";
    tag.dataset.pluginCss = ADAPT_CSS_ID;
    tag.textContent = ADAPT_CSS.join("");
    document.head.appendChild(tag);
    nodeCache.set(STYLE_SELECTOR, tag);
    nodeMissCache.delete(STYLE_SELECTOR);
  }
  function apply2() {
    if (active) return;
    active = true;
    forgetAbsentSelectors();
    document.body.classList.add(ACTIVE_CLASS);
    try {
      w.__dshRemoteAdapt?.closeDetails?.();
    } catch {
    }
    ensureAdaptStyle();
    const meta = document.querySelector("meta[name=viewport]");
    if (meta instanceof HTMLMetaElement && meta.getAttribute("content") !== null && !(meta.getAttribute("content") ?? "").includes("viewport-fit")) {
      savedViewportContent = meta.getAttribute("content");
      meta.setAttribute("content", `${savedViewportContent}, viewport-fit=cover`);
    }
    ensureWhale();
    ensureDomObserver();
    syncWhale();
    setWhaleTimer(true);
    seatHeaderActions();
  }
  function revert() {
    if (!active) return;
    active = false;
    unseatHeaderActions();
    restoreRowDrag();
    document.body.classList.remove(ACTIVE_CLASS);
    document.body.classList.remove(RAIL_HIDDEN_CLASS);
    const tag = document.querySelector(`style[data-plugin-css="${ADAPT_CSS_ID}"]`);
    tag?.remove();
    const meta = document.querySelector("meta[name=viewport]");
    if (meta instanceof HTMLMetaElement && savedViewportContent !== null) {
      meta.setAttribute("content", savedViewportContent);
      savedViewportContent = null;
    }
    if (whaleEl !== null) whaleEl.style.display = "none";
    whaleShown = false;
    setWhaleTimer(false);
    if (whaleObserver !== null) {
      whaleObserver.disconnect();
      whaleObserver = null;
    }
    if (domObserver !== null) {
      domObserver.disconnect();
      domObserver = null;
    }
    forgetAbsentSelectors();
  }
  function ensureDomObserver() {
    if (domObserver !== null || typeof MutationObserver === "undefined" || !document.body) return;
    domObserver = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "childList" || record.target !== document.body) {
          noteDomChange();
          return;
        }
      }
    });
    domObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-dsh-frame"]
    });
  }
  function setWhaleTimer(on) {
    if (on && whaleTimer === null && active) {
      whaleTimer = window.setInterval(syncWhale, 600);
    } else if (!on && whaleTimer !== null) {
      window.clearInterval(whaleTimer);
      whaleTimer = null;
    }
  }
  function officialSidebarToggle() {
    const rail = document.querySelector('[class$="_railFish"] button');
    if (rail instanceof HTMLElement) return rail;
    const row = document.querySelector('[class$="_logoRow"]');
    if (row === null) return null;
    const toggles = row.querySelectorAll('button[class*="_toggle"]');
    const last = toggles.length > 0 ? toggles[toggles.length - 1] : row.querySelectorAll("button")[row.querySelectorAll("button").length - 1];
    return last instanceof HTMLElement ? last : null;
  }
  function toggleSidebarVerified() {
    const frame = appFrame();
    const collapsedBefore = frame !== null ? frame.hasAttribute("data-sidebar-collapsed") : null;
    const face = w.__dshRemoteAdapt?.toggleSidebar;
    const callFace = () => {
      if (typeof face !== "function") return;
      try {
        face();
      } catch {
      }
    };
    const toggle = officialSidebarToggle();
    if (collapsedBefore === null || toggle === null) {
      if (toggle !== null) toggle.click();
      else callFace();
      return;
    }
    toggle.click();
    let tries = 0;
    const verify = () => {
      if (!active) return;
      const frameNow = appFrame();
      if (frameNow === null) return;
      if (frameNow.hasAttribute("data-sidebar-collapsed") !== collapsedBefore) return;
      tries += 1;
      if (tries < 2) {
        window.setTimeout(verify, 120);
        return;
      }
      callFace();
    };
    window.setTimeout(verify, 120);
  }
  function ensureWhale() {
    if (whaleEl !== null || !document.body) return;
    const whale = document.createElement("button");
    whale.id = WHALE_ID;
    whale.type = "button";
    whale.dataset.dshPlugin = "remote-web-ui";
    const whaleLabel = surfaceText("mobile.whale.open", "Open sidebar");
    whale.title = whaleLabel;
    whale.setAttribute("aria-label", whaleLabel);
    whale.innerHTML = `<svg viewBox="0 0 23.16 17.04" fill="none" aria-hidden="true"><path d="${FISH_PATH}" fill="currentColor"/></svg>`;
    whale.addEventListener("click", () => {
      if (whaleSuppressClick) {
        whaleSuppressClick = false;
        return;
      }
      toggleSidebarVerified();
    });
    whale.addEventListener("pointerdown", (e) => {
      if (whaleEl === null) return;
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (active && isComposerField(document.activeElement)) {
        document.activeElement.blur();
        lastComposerTap = 0;
      }
      drag = { x: e.clientX, y: e.clientY, left: whale.offsetLeft, top: whale.offsetTop, moved: false };
      try {
        whale.setPointerCapture(e.pointerId);
      } catch {
      }
      e.preventDefault();
      e.stopPropagation();
    });
    whale.addEventListener("pointermove", (e) => {
      if (whaleEl === null || drag === null) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.moved = drag.moved || Math.abs(dx) > 3 || Math.abs(dy) > 3;
      whaleEl.style.left = `${Math.min(Math.max(4, drag.left + dx), window.innerWidth - 38)}px`;
      whaleEl.style.top = `${Math.min(Math.max(4, drag.top + dy), window.innerHeight - 38)}px`;
      e.preventDefault();
      e.stopPropagation();
    });
    const endWhaleDrag = () => {
      if (whaleEl === null || drag === null) return;
      const moved = drag.moved;
      drag = null;
      whaleSuppressClick = moved;
      try {
        window.localStorage.setItem(WHALE_POS_KEY, JSON.stringify({ x: whaleEl.offsetLeft, y: whaleEl.offsetTop }));
      } catch {
      }
    };
    whale.addEventListener("pointerup", endWhaleDrag);
    whale.addEventListener("pointercancel", () => {
      drag = null;
      whaleSuppressClick = false;
    });
    whaleEl = whale;
    document.body.appendChild(whale);
  }
  function restoreRowDragState(row, original) {
    if (original === null) row.removeAttribute("draggable");
    else row.setAttribute("draggable", original);
  }
  function restoreRowDrag() {
    if (dragOverridden.size === 0) return;
    for (const [row, original] of dragOverridden) restoreRowDragState(row, original);
    dragOverridden.clear();
  }
  function applyWhalePos() {
    if (whaleEl === null) return;
    let pos = null;
    try {
      pos = JSON.parse(window.localStorage.getItem(WHALE_POS_KEY) ?? "null");
    } catch {
    }
    if (pos !== null && typeof pos.x === "number" && typeof pos.y === "number") {
      const x = Math.min(Math.max(4, pos.x), window.innerWidth - 38);
      const y = Math.min(Math.max(4, pos.y), window.innerHeight - 38);
      whaleEl.style.left = `${x}px`;
      whaleEl.style.top = `${y}px`;
    }
  }
  const dragOverridden = /* @__PURE__ */ new Map();
  function disableRowDrag() {
    if (!active) return;
    const rows = sidebarRows();
    for (const row of rows) {
      if (row.getAttribute("draggable") !== "false") {
        if (!dragOverridden.has(row)) dragOverridden.set(row, row.getAttribute("draggable"));
        row.setAttribute("draggable", "false");
      }
    }
    if (dragOverridden.size === 0) return;
    for (const [row, original] of dragOverridden) {
      if (row.isConnected) continue;
      restoreRowDragState(row, original);
      dragOverridden.delete(row);
    }
  }
  const nodeCache = /* @__PURE__ */ new Map();
  const nodeMissCache = /* @__PURE__ */ new Set();
  let domGeneration = 0;
  let missGeneration = -1;
  function noteDomChange() {
    domGeneration += 1;
  }
  function forgetAbsentSelectors() {
    nodeMissCache.clear();
    domGeneration += 1;
  }
  function nodeOf(selector) {
    const cached = nodeCache.get(selector);
    if (cached !== void 0) {
      if (cached.isConnected) return cached;
      nodeCache.delete(selector);
    }
    if (missGeneration !== domGeneration) {
      nodeMissCache.clear();
      missGeneration = domGeneration;
    }
    if (nodeMissCache.has(selector)) return null;
    const found = document.querySelector(selector);
    if (found === null) {
      nodeMissCache.add(selector);
      return null;
    }
    nodeCache.set(selector, found);
    return found;
  }
  function sidebarRows() {
    const sidebar = nodeOf(SIDEBAR_SELECTOR);
    if (sidebar === null) return [];
    return Array.from(sidebar.querySelectorAll(ROW_SELECTOR));
  }
  function frameEl() {
    const frame = nodeOf(APP_FRAME_SELECTOR);
    return frame instanceof HTMLElement ? frame : null;
  }
  function syncWhale() {
    if (active) ensureAdaptStyle();
    if (whaleEl === null) return;
    if (!active) {
      whaleEl.style.display = "none";
      return;
    }
    const collapsed = frameEl()?.hasAttribute("data-sidebar-collapsed") === true;
    const overlayUp = nodeOf('[class$="_overlay"]') !== null;
    const show = collapsed && !overlayUp;
    if (show && !whaleShown) applyWhalePos();
    whaleEl.style.display = show ? "" : "none";
    whaleShown = show;
    const whaleLabel = surfaceText("mobile.whale.open", "Open sidebar");
    if (whaleEl.title !== whaleLabel) whaleEl.title = whaleLabel;
    if (whaleEl.getAttribute("aria-label") !== whaleLabel) whaleEl.setAttribute("aria-label", whaleLabel);
    document.body.classList.toggle(RAIL_HIDDEN_CLASS, collapsed);
    disableRowDrag();
    seatHeaderActions();
    alignActionsText();
  }
  function seatHeaderActions() {
    if (!active) return;
    const header = nodeOf('[class$="_header"]');
    const tabs = header !== null ? header.querySelector('[class$="_tabs"]') : null;
    const actions = header !== null ? header.querySelector('[class$="_titleCluster"] [class$="_headerActions"]') : null;
    const seated = header !== null && tabs !== null && actions !== null;
    document.body.classList.toggle(HEADER_SEATED_CLASS, seated);
    ensureHeaderObserver(seated ? header : null);
  }
  function alignActionsText() {
    if (!active) return;
    const header = nodeOf('[class$="_header"]');
    if (header === null) return;
    const tabs = header.querySelector('[class$="_tabs"]');
    const actions = header.querySelector('[class$="_titleCluster"] [class$="_headerActions"]');
    if (tabs === null || actions === null || !(tabs instanceof HTMLElement) || !(actions instanceof HTMLElement)) return;
    if (!headerGeometryDirty) return;
    headerGeometryDirty = false;
    const tabBtn = tabs.querySelector(':scope > [class*="_tab"]');
    const textBottom = (el) => {
      if (el === null) return null;
      const text = Array.from(el.childNodes).find((n) => n.nodeType === 3 && n.textContent !== null && n.textContent.trim() !== "");
      if (text === void 0) return null;
      try {
        const range = document.createRange();
        range.selectNode(text);
        return range.getBoundingClientRect().bottom;
      } catch {
        return null;
      }
    };
    const translate = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(actions.style.transform ?? "");
    let dx = translate !== null ? parseFloat(translate[1] ?? "0") : 0;
    let dy = translate !== null ? parseFloat(translate[2] ?? "0") : 0;
    const actionsRect = actions.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const headerStyle = getComputedStyle(header);
    const contentRight = headerRect.right - (parseFloat(headerStyle.paddingRight) || 0) - (parseFloat(headerStyle.borderRightWidth) || 0);
    const rightDiff = contentRight - actionsRect.right;
    if (Math.abs(rightDiff) >= 0.5) dx = Math.round((dx + rightDiff) * 10) / 10;
    const tabBottom = textBottom(tabBtn);
    if (tabBottom !== null) {
      let maxBottom = null;
      for (const sel of ['[class$="_label"]', '[class$="_count"]']) {
        const b = textBottom(actions.querySelector(sel));
        if (b !== null && (maxBottom === null || b > maxBottom)) maxBottom = b;
      }
      if (maxBottom !== null) {
        const bottomDiff = tabBottom - maxBottom;
        if (Math.abs(bottomDiff) >= 0.5) dy = Math.round((dy + bottomDiff) * 10) / 10;
      }
    }
    const next = `translate(${dx}px, ${dy}px)`;
    if (actions.style.transform !== next) actions.style.transform = next;
    const reserve = `${Math.ceil(actionsRect.width) + 8}px`;
    const rootStyle = document.documentElement.style;
    if (rootStyle.getPropertyValue(HEADER_RESERVE_VAR) !== reserve) rootStyle.setProperty(HEADER_RESERVE_VAR, reserve);
  }
  function unseatHeaderActions() {
    document.body.classList.remove(HEADER_SEATED_CLASS);
    document.documentElement.style.removeProperty(HEADER_RESERVE_VAR);
    const header = document.querySelector('[class$="_header"]');
    const tabs = header !== null ? header.querySelector('[class$="_tabs"]') : null;
    const actions = header !== null ? header.querySelector('[class$="_titleCluster"] [class$="_headerActions"]') : null;
    if (actions instanceof HTMLElement) actions.style.transform = "";
    if (tabs instanceof HTMLElement) tabs.style.paddingRight = "";
    if (headerObserver !== null) {
      headerObserver.disconnect();
      headerObserver = null;
      observedHeader = null;
    }
  }
  function ensureWhaleObserver() {
    if (whaleObserver !== null || typeof MutationObserver === "undefined" || !document.body) return;
    whaleObserver = new MutationObserver(() => {
      syncWhale();
    });
    whaleObserver.observe(document.body, { attributes: true, attributeFilter: ["data-sidebar-collapsed"], subtree: true });
  }
  function ensureHeaderObserver(header) {
    if (typeof MutationObserver === "undefined") return;
    if (observedHeader === header && headerObserver !== null) return;
    headerObserver?.disconnect();
    headerObserver = null;
    observedHeader = null;
    if (header === null) return;
    headerObserver = new MutationObserver(() => {
      headerGeometryDirty = true;
    });
    headerObserver.observe(header, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
    observedHeader = header;
    headerGeometryDirty = true;
  }
  function evaluate() {
    headerGeometryDirty = true;
    if (!adaptEnabled) {
      revert();
      return;
    }
    if (isMobilePortrait()) {
      apply2();
      ensureWhaleObserver();
      if (active && drag === null) applyWhalePos();
    } else {
      revert();
    }
  }
  evaluate();
  window.addEventListener("orientationchange", evaluate);
  window.addEventListener("resize", evaluate);
  document.addEventListener("visibilitychange", () => {
    setWhaleTimer(document.visibilityState !== "hidden");
  });
  function onKeydownCapture(e) {
    if (!active) return;
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (composerFieldOf(t) === null) return;
    if (e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      document.execCommand("insertText", false, "\n");
    } catch {
    }
  }
  document.addEventListener("keydown", onKeydownCapture, true);
  function collapseSidebar() {
    toggleSidebarVerified();
  }
  function onClickCapture(e) {
    if (!active) return;
    const frame = appFrame();
    if (frame === null || frame.hasAttribute("data-sidebar-collapsed")) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('[class*="_sidebarCol"]') !== null) {
      const topNewSessionClicked = t.closest('[class$="_newSession"], [class$="_brand"]') !== null;
      let projectNewSessionClicked = false;
      const projectActions = t.closest('[class*="_projectRow"] [class*="_rowActions"]');
      if (projectActions !== null) {
        const btn = t.closest("button");
        const btns = projectActions.querySelectorAll("button");
        projectNewSessionClicked = btn !== null && btns.length > 0 && btn === btns[btns.length - 1];
      }
      let shouldCollapse = false;
      if (t.closest('[class*="_sessionRow"]') !== null) {
        shouldCollapse = t.closest('[class*="_rowActions"]') === null;
      } else if (t.closest('[class$="_settingsArea"]') !== null || topNewSessionClicked || projectNewSessionClicked) {
        shouldCollapse = true;
      }
      if (shouldCollapse) collapseSidebar();
      return;
    }
    if (t.closest('[class$="_overlay"], [class$="_dialog"], [class$="_menu"], [class*="_portal"], [id="dshRemoteWhale"], [id="dshLanGate"]') !== null) return;
    collapseSidebar();
  }
  document.addEventListener("click", onClickCapture, true);
  function insideHScrollable(el) {
    let n = el;
    while (n !== null && n !== document.body) {
      const cs = getComputedStyle(n);
      if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && n.scrollWidth > n.clientWidth + 4) return true;
      n = n.parentElement;
    }
    return false;
  }
  document.addEventListener("touchstart", (e) => {
    if (!active) return;
    if (e.touches.length > 1) {
      swipeTouch = null;
      return;
    }
    const t = e.target;
    const editable = t instanceof HTMLElement && t.isContentEditable;
    if (t instanceof Element && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || editable || t.closest(`#${WHALE_ID}`) !== null || t.closest('table, [class$="_table"], [class$="_tablePane"]') !== null)) {
      swipeTouch = null;
      return;
    }
    const ct = e.changedTouches[0];
    if (ct === void 0) return;
    swipeTouch = { x: ct.clientX, y: ct.clientY, id: ct.identifier, el: t instanceof Element ? t : null };
  }, { capture: true, passive: true });
  document.addEventListener("touchend", (e) => {
    if (swipeTouch === null) return;
    if (e.touches.length > 0) return;
    const ct = e.changedTouches[0];
    if (ct === void 0 || ct.identifier !== swipeTouch.id) return;
    const dx = ct.clientX - swipeTouch.x;
    const dy = ct.clientY - swipeTouch.y;
    const start = swipeTouch;
    swipeTouch = null;
    if (!active) return;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (start.el !== null && insideHScrollable(start.el)) return;
    const frame = frameEl();
    if (frame === null) return;
    if (nodeOf('[class$="_overlay"], [class$="_dialog"], [class$="_menu"], [class*="_portal"]') !== null) return;
    const collapsed = frame.hasAttribute("data-sidebar-collapsed");
    if (dx < 0 && !collapsed) collapseSidebar();
    else if (dx > 0 && collapsed) toggleSidebarVerified();
  }, { capture: true, passive: true });
  document.addEventListener("touchcancel", () => {
    swipeTouch = null;
  }, true);
  const LONG_PRESS_MS = 500;
  const LONG_PRESS_MOVE = 10;
  let longPress = null;
  let suppressSessionClickUntil = 0;
  let suppressSessionClickRow = null;
  let longPressMenuGuardUntil = 0;
  function clearLongPress() {
    if (longPress !== null) {
      if (longPress.timer !== null) window.clearTimeout(longPress.timer);
      longPress = null;
    }
  }
  function openSessionMenu(row) {
    const actions = row.querySelector('[class*="_rowActions"]');
    const btn = actions?.querySelector("button");
    if (actions === null || btn === null) return;
    longPressMenuGuardUntil = Date.now() + 1200;
    actions.style.display = "inline-flex";
    try {
      btn.click();
    } finally {
      window.setTimeout(() => {
        actions.style.display = "";
      }, 50);
    }
  }
  document.addEventListener("touchstart", (e) => {
    if (!active) return;
    const t = e.target;
    if (!(t instanceof Element)) {
      clearLongPress();
      return;
    }
    const row = t.closest('[class*="_sessionRow"]');
    if (row === null || t.closest('[class*="_rowActions"]') !== null) {
      clearLongPress();
      return;
    }
    const ct = e.changedTouches[0];
    if (ct === void 0) return;
    clearLongPress();
    const lp = { row, x: ct.clientX, y: ct.clientY, timer: null, triggered: false };
    lp.timer = window.setTimeout(() => {
      if (longPress !== lp) return;
      lp.triggered = true;
      openSessionMenu(lp.row);
      try {
        navigator.vibrate?.(10);
      } catch {
      }
    }, LONG_PRESS_MS);
    longPress = lp;
  }, { capture: true, passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!active || longPress === null) return;
    const ct = e.changedTouches[0];
    if (ct === void 0) return;
    if (Math.abs(ct.clientX - longPress.x) > LONG_PRESS_MOVE || Math.abs(ct.clientY - longPress.y) > LONG_PRESS_MOVE) {
      clearLongPress();
    }
  }, { capture: true, passive: true });
  document.addEventListener("touchend", (e) => {
    if (!active || longPress === null) return;
    const ct = e.changedTouches[0];
    if (ct === void 0) return;
    const lp = longPress;
    clearLongPress();
    if (lp.triggered) {
      e.preventDefault();
      suppressSessionClickUntil = Date.now() + 800;
      suppressSessionClickRow = lp.row;
    }
  }, { capture: true, passive: false });
  document.addEventListener("touchcancel", () => {
    clearLongPress();
  }, true);
  window.addEventListener("click", (e) => {
    if (!active || Date.now() > suppressSessionClickUntil) return;
    const t = e.target;
    if (t instanceof Element && suppressSessionClickRow !== null && (t === suppressSessionClickRow || suppressSessionClickRow.contains(t))) {
      e.stopPropagation();
      e.preventDefault();
      suppressSessionClickUntil = 0;
      suppressSessionClickRow = null;
    }
  }, true);
  document.addEventListener("contextmenu", (e) => {
    if (!active) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('[class*="_sessionRow"]') !== null && (longPress !== null && longPress.triggered || Date.now() <= suppressSessionClickUntil)) {
      e.preventDefault();
    }
  }, true);
  document.addEventListener("pointerleave", (e) => {
    if (!active || Date.now() > longPressMenuGuardUntil) return;
    const t = e.target;
    if (t instanceof Element && (t.closest('[class*="_rowActions"]') !== null || t.closest('[class*="_sessionRow"]') !== null || t.closest('[class*="_projectRow"]') !== null)) {
      e.stopPropagation();
    }
  }, true);
  const isComposerField = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.closest(COMPOSER_SELECTOR) === null) return false;
    if (el.matches("[data-composer-input]")) return true;
    if (el.tagName === "TEXTAREA") return true;
    return el.tagName === "INPUT" && el.matches('[class*="_input"]');
  };
  const composerFieldOf = (target) => {
    const el = target instanceof Element ? target.closest('[data-composer-input], [class*="_input"], textarea') : null;
    return isComposerField(el) ? el : null;
  };
  const lanOrigFocus = HTMLElement.prototype.focus;
  const patchedFocus = function(options) {
    if (active && isComposerField(this) && Date.now() - lastComposerTap >= 800) return;
    lanOrigFocus.call(this, options);
  };
  const installFocusPatch = () => {
    HTMLElement.prototype.focus = patchedFocus;
  };
  const restoreFocusPatch = () => {
    if (HTMLElement.prototype.focus === patchedFocus) HTMLElement.prototype.focus = lanOrigFocus;
  };
  installFocusPatch();
  document.addEventListener("pointerdown", (e) => {
    if (!active) return;
    if (composerFieldOf(e.target) !== null) lastComposerTap = Date.now();
  }, true);
  w.__dshRemoteAdapt = {
    evaluate,
    toggleSidebar: null,
    closeDetails: null,
    translate: null,
    setEnabled(on) {
      adaptEnabled = on;
      if (on) {
        installFocusPatch();
        evaluate();
      } else {
        revert();
        restoreFocusPatch();
      }
    },
    flushCloseDetails() {
      if (active) w.__dshRemoteAdapt?.closeDetails?.();
    }
  };
}

// packages/dsh-remote-web/src/client/settings/settings-entry-form.ts
function pendingSnapshot() {
  return {
    status: "loading",
    value: void 0,
    base: void 0,
    user: void 0,
    revision: void 0,
    writable: false,
    mode: "host"
  };
}
function createServedEntryForm(options) {
  const { forms, entryIds } = options;
  const fallbackId = entryIds[0];
  const namespaceId = entryIds[entryIds.length - 1];
  const listeners = /* @__PURE__ */ new Set();
  let boundId;
  let bound;
  let offBound;
  let snapshot = pendingSnapshot();
  const publish = () => {
    if (bound !== void 0) snapshot = bound.getSnapshot();
    for (const listener of [...listeners]) listener();
  };
  const resolve = () => {
    let served;
    try {
      served = forms.describe().getSnapshot().view?.namespaces.map((row) => row.ns);
    } catch {
      served = void 0;
    }
    if (served === void 0 || served.length === 0) return fallbackId;
    return entryIds.find((id4) => served.includes(id4)) ?? namespaceId;
  };
  const bind = () => {
    const target = resolve();
    if (target === boundId) return;
    offBound?.();
    offBound = void 0;
    let form;
    try {
      form = forms.get(target);
    } catch {
      boundId = void 0;
      return;
    }
    boundId = target;
    bound = form;
    offBound = form.subscribe(() => {
      publish();
    });
    publish();
  };
  try {
    forms.describe().subscribe(() => {
      bind();
    });
  } catch {
  }
  bind();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (field, value) => bound?.set(field, value) ?? Promise.resolve(false),
    unset: (field) => bound?.unset(field) ?? Promise.resolve(false),
    mutate: (ops, expectedRevision) => bound?.mutate(ops, expectedRevision) ?? Promise.resolve(false)
  };
}

// packages/dsh-remote-web/src/client/index.ts
var NS = "remote";
var REMOTE_WEB_UI_NS = "remote-web-ui";
var PACK_ROW_ID = "web-pack-remote-web";
var AGGREGATE_ENTRY_ID = "web-ui-remote-web-ui";
var REMOTE_WEB_UI_ENTRY_IDS = [PACK_ROW_ID, AGGREGATE_ENTRY_ID, "ui-remote-web-ui", REMOTE_WEB_UI_NS];
function servedEntryId(forms) {
  let served;
  try {
    served = forms.describe().getSnapshot().view?.namespaces.map((view) => view.ns);
  } catch {
    served = void 0;
  }
  if (served === void 0 || served.length === 0) return AGGREGATE_ENTRY_ID;
  return REMOTE_WEB_UI_ENTRY_IDS.find((id4) => served.includes(id4)) ?? REMOTE_WEB_UI_NS;
}
function bindSettingsForm(ctx) {
  const family = ctx.get("webUiSettings");
  if (family !== void 0 && typeof family.bind === "function") {
    return family.bind({ namespace: REMOTE_WEB_UI_NS });
  }
  return createServedEntryForm({
    forms: ctx.configForms,
    entryIds: REMOTE_WEB_UI_ENTRY_IDS
  });
}
var HEARTBEAT_INTERVAL_MS = 1e4;
var inject = ["slots", "locale", "connection", "configForms", "remote"];
function apply(ctx) {
  startMobileAdapt();
  ctx.effect(() => () => {
    ;
    window.__dshRemoteAdapt?.setEnabled?.(false);
  }, "dsh-remote-web: mobile-adapt");
  ctx.effect(() => {
    try {
      return ctx.locale.register(NS, { zh, en });
    } catch {
      return () => {
      };
    }
  }, "dsh-remote-web: dictionaries");
  const layout = ctx.get("layout");
  const adapt = window.__dshRemoteAdapt;
  const layoutCall = (call) => {
    try {
      call?.();
    } catch {
    }
  };
  if (layout !== void 0 && adapt !== void 0) {
    if (typeof layout.toggleSidebar === "function") {
      adapt.toggleSidebar = () => {
        layoutCall(layout.toggleSidebar);
      };
    }
    if (typeof layout.closeDetails === "function") {
      adapt.closeDetails = () => {
        layoutCall(layout.closeDetails);
      };
    }
  }
  if (adapt !== void 0 && adapt.toggleSidebar === null) {
    adapt.toggleSidebar = () => {
      document.querySelector('[class$="_railFish"] button, [class$="_logoRow"] [class*="_iconButton"]')?.click();
    };
  }
  const t = ctx.locale.bind(NS);
  if (adapt !== void 0) adapt.translate = t;
  const settingsForm = bindSettingsForm(ctx);
  const enabled = () => {
    const snapshot = settingsForm.getSnapshot();
    return snapshot.status === "ready" ? snapshot.value?.enabled ?? true : snapshot.status === "unavailable";
  };
  const syncAdaptEnabled = () => {
    ;
    window.__dshRemoteAdapt?.setEnabled?.(enabled());
  };
  settingsForm.subscribe(syncAdaptEnabled);
  syncAdaptEnabled();
  try {
    adapt?.flushCloseDetails?.();
  } catch {
  }
  ctx.slots.inject("sidebar.footer.action", () => {
    try {
      return ctx.slots.register({ name: "sidebar.footer.action", id: "remote-web-ui", locale: NS }, FooterRemoteEntry);
    } catch {
      return () => {
      };
    }
  });
  const remoteSettings = new RemoteSettingsCardController(settingsForm);
  publishSettingsFace(remoteSettings.inject());
  ctx.effect(() => () => {
    publishSettingsFace(void 0);
    remoteSettings.dispose();
  }, "dsh-remote-web: settings card");
  let disposeRuntime;
  const syncRuntime = () => {
    if (enabled() && disposeRuntime === void 0) {
      disposeRuntime = ctx.effect(() => {
        const connection = ctx.get("connection");
        const loopback = connection?.isLoopback ?? true;
        runPairBootFlow(ctx, window.location.search);
        if (loopback) return () => {
        };
        const timer = window.setInterval(() => {
          void sendHeartbeat().then((status) => {
            if (shouldStopHeartbeat(status)) window.clearInterval(timer);
          }).catch(() => {
          });
        }, HEARTBEAT_INTERVAL_MS);
        return () => {
          window.clearInterval(timer);
        };
      }, "dsh-remote-web: pair flow + heartbeats");
    } else if (!enabled() && disposeRuntime !== void 0) {
      disposeRuntime();
      disposeRuntime = void 0;
    }
  };
  settingsForm.subscribe(syncRuntime);
  syncRuntime();
  let disposeChannel;
  let hostPairingPolicy;
  let unpairedWhilePolicyPending = false;
  let fenceNotice;
  const showFenceNotice = () => {
    if (fenceNotice !== void 0) return;
    const node = document.createElement("div");
    document.body.appendChild(node);
    const root = (0, import_client.createRoot)(node);
    root.render((0, import_react8.createElement)(FenceNotice, { t, onRetry: () => {
      window.location.reload();
    } }));
    fenceNotice = { unmount: () => {
      root.unmount();
      node.remove();
    }, node };
  };
  const hideFenceNotice = () => {
    fenceNotice?.unmount();
    fenceNotice = void 0;
  };
  const handleUnpaired = () => {
    if (settingsForm.getSnapshot().status !== "ready" && hostPairingPolicy === void 0) {
      unpairedWhilePolicyPending = true;
      return;
    }
    showFenceNotice();
  };
  const channelActive = () => remoteChannelRequired(
    pageOriginFacts(window),
    settingsForm.getSnapshot(),
    hostPairingPolicy
  );
  const bootSeat = () => window[REMOTE_CHANNEL_BOOT_GLOBAL];
  const syncChannel = () => {
    const transition = channelTransition(channelActive(), disposeChannel !== void 0);
    if (transition === "install") {
      const seat = bootSeat();
      if (seat !== void 0) {
        seat.onUnpaired = handleUnpaired;
        seat.onPaired = hideFenceNotice;
        if (seat.pendingUnpaired) {
          seat.pendingUnpaired = false;
          handleUnpaired();
        }
        disposeChannel = ctx.effect(() => () => {
          seat.onUnpaired = null;
          seat.onPaired = null;
        }, "dsh-remote-web: remote desktop channel (boot patch)");
      } else {
        disposeChannel = ctx.effect(() => {
          const restore = installRemoteChannel(window, { onUnpaired: handleUnpaired, onPaired: hideFenceNotice });
          return restore;
        }, "dsh-remote-web: remote desktop channel");
      }
    } else if (transition === "retire" && disposeChannel !== void 0) {
      disposeChannel();
      disposeChannel = void 0;
      bootSeat()?.restore();
      hideFenceNotice();
    } else if (transition === "none" && !channelActive()) {
      bootSeat()?.restore();
    }
  };
  settingsForm.subscribe(syncChannel);
  syncChannel();
  const pageOrigin = pageOriginFacts(window);
  if (!isLocalPage(pageOrigin.hostname, pageOrigin.protocol, pageOrigin.transportOwnsHost) && settingsForm.getSnapshot().status !== "ready") {
    void readPairGatePolicy().then((policy) => {
      hostPairingPolicy = policy.requirePairingForLan;
      syncChannel();
      if (hostPairingPolicy && unpairedWhilePolicyPending) showFenceNotice();
      unpairedWhilePolicyPending = false;
    }).catch(() => {
      hostPairingPolicy = true;
      syncChannel();
      if (unpairedWhilePolicyPending) showFenceNotice();
      unpairedWhilePolicyPending = false;
    });
  }
  ctx.effect(() => {
    const timer = window.setTimeout(() => {
      if (sessionStorage.getItem(PAIR_FAILED_MARKER) === null) return;
      sessionStorage.removeItem(PAIR_FAILED_MARKER);
      const mount = document.createElement("div");
      document.body.appendChild(mount);
      const root = (0, import_client.createRoot)(mount);
      root.render((0, import_react8.createElement)(PairFailedNotice, { t }));
      void root;
    }, 1500);
    return () => {
      window.clearTimeout(timer);
    };
  }, "dsh-remote-web: failed-pair notice");
}
/*! Bundled license information:

qrcode.react/lib/esm/index.js:
  (**
   * @license QR Code generator library (TypeScript)
   * Copyright (c) Project Nayuki.
   * SPDX-License-Identifier: MIT
   *)
  (**
   * @license qrcode.react
   * Copyright (c) Paul O'Shannessy
   * SPDX-License-Identifier: ISC
   *)
*/

    return module.exports
  },
})
