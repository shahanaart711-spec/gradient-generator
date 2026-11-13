// =====================================================================
//  PROFESSIONAL SEAMLESS PATTERN GENERATOR  v1.0.0
//  Adobe Illustrator 2025 / Windows 11  -  ExtendScript (ES3)
//
//  - Generates 5 original, visually distinct seamless vector patterns
//  - Exact 4000 x 4000 px tile (4000 pt at 72 ppi), RGB, EPS export
//  - Mathematically correct edge/corner wrapping (true seamlessness)
//  - Intelligent, palette-aware background selection
//  - Persistent fingerprint history (Pattern_History.json) with
//    duplicate prevention, backups and safe recovery
//  - Professional ScriptUI, quality control, 3x3 tiling verification
// =====================================================================

#target illustrator

(function () {

    var SCRIPT_NAME = 'Professional Seamless Pattern Generator';
    var VERSION = '1.0.0';
    var TILE = 4000;                 // tile size in points == 4000 px @ 72 ppi
    var BATCH_SIZE = 5;
    var EPS_EXT = '.eps';
    var HISTORY_FILE = 'Pattern_History.json';
    var HISTORY_BACKUP = 'Pattern_History.backup.json';

    var CATEGORIES = [
        'GEOMETRIC', 'ABSTRACT', 'LINE', 'MINIMALIST',
        'DECORATIVE', 'RETRO', 'MODERN'
    ];

    var DENSITIES = ['SPARSE', 'MEDIUM', 'DENSE'];

    // ------------------------- UTILITIES (ES3) -------------------------

    function rndRange(rng, min, max) { return min + rng() * (max - min); }
    function rndInt(rng, min, max) { return Math.floor(min + rng() * (max - min + 1)); }
    function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

    function inArray(arr, v) {
        for (var i = 0; i < arr.length; i++) if (arr[i] === v) return true;
        return false;
    }

    function shuffle(rng, arr) {
        var a = arr.slice(0);
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(rng() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    function pad4(n) {
        var s = String(n);
        while (s.length < 4) s = '0' + s;
        return s;
    }

    // Seeded PRNG: LCG with exact 32-bit arithmetic in doubles
    // (max intermediate value ~7.2e15 < 2^53, so ES3-safe and exact)
    function makeRng(seed) {
        var t = Math.floor(seed) % 4294967296;
        if (t < 0) t += 4294967296;
        return function () {
            t = (t * 1664525 + 1013904223) % 4294967296;
            return t / 4294967296;
        };
    }

    // ------------------------- COLOR ENGINE ----------------------------

    function hslToRgb(h, s, l) {
        h = ((h % 360) + 360) % 360;
        s = clamp(s, 0, 1);
        l = clamp(l, 0, 1);
        var c = (1 - Math.abs(2 * l - 1)) * s;
        var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        var m = l - c / 2;
        var r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }
        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255)
        };
    }

    function rgbToHex(c) {
        function h2(v) { var s = v.toString(16); return s.length < 2 ? '0' + s : s; }
        return '#' + h2(c.r) + h2(c.g) + h2(c.b);
    }

    function hslToHex(h, s, l) { return rgbToHex(hslToRgb(h, s, l)); }

    function hexToRgb(hex) {
        return {
            r: parseInt(hex.substr(1, 2), 16),
            g: parseInt(hex.substr(3, 2), 16),
            b: parseInt(hex.substr(5, 2), 16)
        };
    }

    function rgbLuminance(c) {
        function lin(v) {
            v = v / 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        }
        return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    }

    function contrastRatio(a, b) {
        var la = rgbLuminance(a), lb = rgbLuminance(b);
        var hi = la > lb ? la : lb;
        var lo = la > lb ? lb : la;
        return (hi + 0.05) / (lo + 0.05);
    }

    function makeRgbColor(hex) {
        var c = hexToRgb(hex);
        var col = new RGBColor();
        col.red = c.r;
        col.green = c.g;
        col.blue = c.b;
        return col;
    }

    // Build a foreground palette (array of hex strings) for a scheme.
    function buildPalette(scheme, rng) {
        var cols = [];
        var h, i;

        if (scheme === 'PASTEL') {
            h = rndRange(rng, 0, 360);
            for (i = 0; i < 4; i++) {
                cols.push(hslToHex(h + rndRange(rng, -35, 35), rndRange(rng, 0.35, 0.6), rndRange(rng, 0.74, 0.86)));
            }
            cols.push(hslToHex(h + rndRange(rng, -25, 25), rndRange(rng, 0.45, 0.7), rndRange(rng, 0.4, 0.52)));
        } else if (scheme === 'EARTH_TONE') {
            h = rndRange(rng, 15, 55);
            for (i = 0; i < 3; i++) {
                cols.push(hslToHex(h + rndRange(rng, -18, 18), rndRange(rng, 0.35, 0.6), rndRange(rng, 0.32, 0.55)));
            }
            cols.push(hslToHex(h + rndRange(rng, 60, 90), rndRange(rng, 0.2, 0.4), rndRange(rng, 0.3, 0.45)));
            cols.push(hslToHex(h + rndRange(rng, -10, 10), rndRange(rng, 0.15, 0.35), rndRange(rng, 0.78, 0.88)));
        } else if (scheme === 'LUXURY') {
            h = rndRange(rng, 36, 52); // gold family
            for (i = 0; i < 3; i++) {
                cols.push(hslToHex(h + rndRange(rng, -8, 8), rndRange(rng, 0.5, 0.75), rndRange(rng, 0.5, 0.66)));
            }
            cols.push(hslToHex(rndRange(rng, 210, 235), rndRange(rng, 0.25, 0.5), rndRange(rng, 0.25, 0.45)));
            cols.push(hslToHex(h + rndRange(rng, -6, 6), rndRange(rng, 0.3, 0.55), rndRange(rng, 0.8, 0.9)));
        } else if (scheme === 'VIBRANT') {
            h = rndRange(rng, 0, 360);
            for (i = 0; i < 4; i++) {
                cols.push(hslToHex(h + i * rndRange(rng, 55, 95), rndRange(rng, 0.65, 0.9), rndRange(rng, 0.45, 0.58)));
            }
            cols.push(hslToHex(h, 0.7, 0.3));
        } else if (scheme === 'MONOCHROMATIC') {
            h = rndRange(rng, 0, 360);
            for (i = 0; i < 4; i++) {
                cols.push(hslToHex(h + rndRange(rng, -6, 6), rndRange(rng, 0.35, 0.65), rndRange(rng, 0.3 + i * 0.14, 0.38 + i * 0.14)));
            }
            cols.push(hslToHex(h, rndRange(rng, 0.3, 0.6), rndRange(rng, 0.85, 0.92)));
        } else if (scheme === 'COMPLEMENTARY') {
            h = rndRange(rng, 0, 360);
            for (i = 0; i < 2; i++) {
                cols.push(hslToHex(h + rndRange(rng, -12, 12), rndRange(rng, 0.5, 0.8), rndRange(rng, 0.4, 0.6)));
            }
            for (i = 0; i < 2; i++) {
                cols.push(hslToHex(h + 180 + rndRange(rng, -12, 12), rndRange(rng, 0.4, 0.7), rndRange(rng, 0.4, 0.62)));
            }
            cols.push(hslToHex(h, rndRange(rng, 0.15, 0.3), rndRange(rng, 0.7, 0.85)));
        } else if (scheme === 'ANALOGOUS') {
            h = rndRange(rng, 0, 360);
            var step = rndRange(rng, 22, 40) * (rng() < 0.5 ? 1 : -1);
            for (i = 0; i < 4; i++) {
                cols.push(hslToHex(h + step * i, rndRange(rng, 0.4, 0.7), rndRange(rng, 0.42, 0.62)));
            }
            cols.push(hslToHex(h + step * 2, rndRange(rng, 0.2, 0.4), rndRange(rng, 0.75, 0.88)));
        } else if (scheme === 'NEUTRAL') {
            h = rndRange(rng, 20, 50);
            for (i = 0; i < 3; i++) {
                cols.push(hslToHex(h + rndRange(rng, -10, 10), rndRange(rng, 0.03, 0.12), rndRange(rng, 0.2 + i * 0.2, 0.3 + i * 0.2)));
            }
            cols.push(hslToHex(h + rndRange(rng, -15, 15), rndRange(rng, 0.25, 0.45), rndRange(rng, 0.4, 0.55)));
            cols.push(hslToHex(h, rndRange(rng, 0.05, 0.15), rndRange(rng, 0.85, 0.93)));
        } else if (scheme === 'RETRO') {
            h = rndRange(rng, 0, 40);
            cols.push(hslToHex(h + rndRange(rng, 5, 20), rndRange(rng, 0.75, 0.9), rndRange(rng, 0.5, 0.58)));
            cols.push(hslToHex(rndRange(rng, 42, 52), rndRange(rng, 0.65, 0.85), rndRange(rng, 0.48, 0.58)));
            cols.push(hslToHex(rndRange(rng, 75, 105), rndRange(rng, 0.35, 0.55), rndRange(rng, 0.35, 0.48)));
            cols.push(hslToHex(h + rndRange(rng, -5, 10), rndRange(rng, 0.35, 0.55), rndRange(rng, 0.28, 0.38)));
            cols.push(hslToHex(rndRange(rng, 15, 40), rndRange(rng, 0.2, 0.4), rndRange(rng, 0.84, 0.9)));
        } else { // MUTED_ELEGANT
            h = rndRange(rng, 0, 360);
            var h2 = rndRange(rng, -45, 45);
            for (i = 0; i < 3; i++) {
                cols.push(hslToHex(h + rndRange(rng, -15, 15), rndRange(rng, 0.22, 0.4), rndRange(rng, 0.42, 0.62)));
            }
            cols.push(hslToHex(h + h2, rndRange(rng, 0.18, 0.35), rndRange(rng, 0.45, 0.6)));
            cols.push(hslToHex(h + h2, rndRange(rng, 0.1, 0.25), rndRange(rng, 0.78, 0.88)));
        }
        return cols;
    }

    // Rough RGB -> HSL with a hue-confidence weight (achromatic colors
    // contribute little to the representative palette hue).
    function rgbToHslApprox(c) {
        var r = c.r / 255, g = c.g / 255, b = c.b / 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var h = 0, s = 0, l = (max + min) / 2;
        var d = max - min;
        if (d > 0.0001) {
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = (((g - b) / d) % 6 + 6) % 6;
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
        }
        return { h: h, s: s, l: l, w: d > 0.08 ? 1 : 0.15 };
    }

    // Intelligent background selection: analyzes the palette and picks a
    // harmonious background with sufficient contrast against the motifs.
    function selectBackground(scheme, fgColors, rng) {
        var fgRgb = [];
        var i, j, totalL = 0;
        for (i = 0; i < fgColors.length; i++) {
            var c = hexToRgb(fgColors[i]);
            fgRgb.push(c);
            totalL += rgbLuminance(c);
        }
        var avgL = totalL / fgRgb.length;

        var hueSum = 0, satSum = 0, cnt = 0;
        for (i = 0; i < fgRgb.length; i++) {
            var hsl = rgbToHslApprox(fgRgb[i]);
            hueSum += hsl.h * hsl.w;
            satSum += hsl.s * hsl.w;
            cnt += hsl.w;
        }
        var baseHue = cnt > 0 ? hueSum / cnt : rndRange(rng, 0, 360);
        var baseSat = cnt > 0 ? satSum / cnt : 0.3;

        var candidates = [];

        if (scheme === 'LUXURY') {
            candidates.push(hslToHex(rndRange(rng, 215, 235), rndRange(rng, 0.45, 0.65), rndRange(rng, 0.10, 0.17)));
            candidates.push(hslToHex(rndRange(rng, 20, 32), rndRange(rng, 0.35, 0.5), rndRange(rng, 0.10, 0.16)));
            candidates.push(hslToHex(rndRange(rng, 150, 170), rndRange(rng, 0.25, 0.4), rndRange(rng, 0.08, 0.14)));
        } else if (scheme === 'PASTEL') {
            candidates.push(hslToHex(baseHue + 180 + rndRange(rng, -25, 25), rndRange(rng, 0.2, 0.4), rndRange(rng, 0.22, 0.34)));
            candidates.push(hslToHex(baseHue + 180 + rndRange(rng, -25, 25), rndRange(rng, 0.15, 0.35), rndRange(rng, 0.3, 0.42)));
            candidates.push(hslToHex(baseHue + rndRange(rng, -20, 20), rndRange(rng, 0.25, 0.45), rndRange(rng, 0.18, 0.28)));
        } else if (scheme === 'EARTH_TONE') {
            candidates.push(hslToHex(rndRange(rng, 30, 48), rndRange(rng, 0.18, 0.35), rndRange(rng, 0.82, 0.9)));
            candidates.push(hslToHex(rndRange(rng, 22, 38), rndRange(rng, 0.25, 0.4), rndRange(rng, 0.12, 0.2)));
            candidates.push(hslToHex(rndRange(rng, 35, 55), rndRange(rng, 0.12, 0.25), rndRange(rng, 0.85, 0.92)));
        } else if (scheme === 'VIBRANT') {
            candidates.push(hslToHex(baseHue, rndRange(rng, 0.04, 0.12), rndRange(rng, 0.9, 0.96)));
            candidates.push(hslToHex(baseHue, rndRange(rng, 0.03, 0.1), rndRange(rng, 0.12, 0.18)));
            candidates.push(hslToHex(baseHue + 180, rndRange(rng, 0.05, 0.15), rndRange(rng, 0.88, 0.94)));
        } else if (scheme === 'RETRO') {
            candidates.push(hslToHex(rndRange(rng, 28, 45), rndRange(rng, 0.2, 0.38), rndRange(rng, 0.84, 0.9)));
            candidates.push(hslToHex(rndRange(rng, 20, 35), rndRange(rng, 0.3, 0.45), rndRange(rng, 0.14, 0.22)));
        } else if (scheme === 'MONOCHROMATIC') {
            candidates.push(hslToHex(baseHue, rndRange(rng, 0.1, 0.3), avgL > 0.5 ? rndRange(rng, 0.12, 0.2) : rndRange(rng, 0.85, 0.92)));
            candidates.push(hslToHex(baseHue, rndRange(rng, 0.08, 0.2), avgL > 0.5 ? rndRange(rng, 0.85, 0.92) : rndRange(rng, 0.12, 0.2)));
        } else if (scheme === 'NEUTRAL') {
            candidates.push(hslToHex(baseHue, rndRange(rng, 0.02, 0.08), avgL > 0.5 ? rndRange(rng, 0.1, 0.16) : rndRange(rng, 0.88, 0.94)));
            candidates.push(hslToHex(baseHue + 180, rndRange(rng, 0.05, 0.15), avgL > 0.5 ? rndRange(rng, 0.86, 0.93) : rndRange(rng, 0.14, 0.22)));
        } else {
            // COMPLEMENTARY / ANALOGOUS / MUTED_ELEGANT and default
            candidates.push(hslToHex(baseHue + 180 + rndRange(rng, -20, 20), rndRange(rng, 0.08, 0.22), avgL > 0.5 ? rndRange(rng, 0.14, 0.24) : rndRange(rng, 0.84, 0.92)));
            candidates.push(hslToHex(baseHue + rndRange(rng, -15, 15), rndRange(rng, 0.06, 0.2), avgL > 0.5 ? rndRange(rng, 0.88, 0.95) : rndRange(rng, 0.1, 0.18)));
            candidates.push(hslToHex(baseHue + rndRange(rng, -25, 25), rndRange(rng, 0.1, 0.28), avgL > 0.5 ? rndRange(rng, 0.2, 0.32) : rndRange(rng, 0.78, 0.88)));
        }

        // Validate contrast: the background must keep a usable contrast
        // ratio against EVERY foreground color (min 2.2:1) and a strong
        // ratio against the palette average (min 3.2:1).
        var best = null, bestScore = -1;
        for (i = 0; i < candidates.length; i++) {
            var bgRgb = hexToRgb(candidates[i]);
            var minRatio = 100, avgRatio = 0;
            for (j = 0; j < fgRgb.length; j++) {
                var r = contrastRatio(bgRgb, fgRgb[j]);
                if (r < minRatio) minRatio = r;
                avgRatio += r / fgRgb.length;
            }
            var bhsl = rgbToHslApprox(bgRgb);
            var penalty = 0;
            if (bhsl.s > 0.55 && bhsl.l > 0.3 && bhsl.l < 0.7) penalty += 0.8;
            if (bhsl.l > 0.36 && bhsl.l < 0.64 && minRatio < 2.8) penalty += 1.2;
            var score = minRatio * 0.6 + avgRatio * 0.4 - penalty;
            if (minRatio >= 2.2 && avgRatio >= 3.2 && score > bestScore) {
                bestScore = score;
                best = candidates[i];
            }
        }

        // Fallback: push lightness until contrast passes.
        if (!best) {
            var light = avgL > 0.5 ? 0.08 : 0.94;
            var tries = 0;
            while (tries < 24) {
                var cand = hslToHex(baseHue, clamp(baseSat * 0.3, 0.03, 0.25), light);
                var cbg = hexToRgb(cand);
                var ok = true;
                for (var k = 0; k < fgRgb.length; k++) {
                    if (contrastRatio(cbg, fgRgb[k]) < 2.2) { ok = false; break; }
                }
                if (ok) { best = cand; break; }
                light = clamp(avgL > 0.5 ? light + 0.03 : light - 0.03, 0.02, 0.98);
                tries++;
            }
            if (!best) best = avgL > 0.5 ? '#0d0d0d' : '#f5f2ea';
        }
        return best;
    }

    // ------------------- MINIMAL JSON (ES3-safe) -----------------------
    // ExtendScript has no native JSON object; this serializer/parser
    // handles the subset used by Pattern_History.json.

    var Json = {
        stringify: function (value) { return this._ser(value); },
        _ser: function (v) {
            var t = typeof v, i, out;
            if (v === null || v === undefined) return 'null';
            if (t === 'number') return isFinite(v) ? String(v) : 'null';
            if (t === 'boolean') return v ? 'true' : 'false';
            if (t === 'string') return this._quote(v);
            if (v instanceof Array) {
                out = [];
                for (i = 0; i < v.length; i++) out.push(this._ser(v[i]));
                return '[' + out.join(',') + ']';
            }
            out = [];
            for (var k in v) {
                if (v.hasOwnProperty(k)) out.push(this._quote(String(k)) + ':' + this._ser(v[k]));
            }
            return '{' + out.join(',') + '}';
        },
        _quote: function (s) {
            var out = '"';
            for (var i = 0; i < s.length; i++) {
                var ch = s.charAt(i), code = s.charCodeAt(i);
                if (ch === '"') out += '\\"';
                else if (ch === '\\') out += '\\\\';
                else if (ch === '\n') out += '\\n';
                else if (ch === '\r') out += '\\r';
                else if (ch === '\t') out += '\\t';
                else if (code < 32) out += '\\u' + ('000' + code.toString(16)).slice(-4);
                else out += ch;
            }
            return out + '"';
        },
        parse: function (text) {
            var p = new JsonParser(text);
            var v = p.parseValue();
            p.skipWs();
            if (!p.atEnd()) throw new Error('Trailing characters in JSON');
            return v;
        }
    };

    function JsonParser(text) {
        this.s = text;
        this.i = 0;
    }
    JsonParser.prototype.atEnd = function () { return this.i >= this.s.length; };
    JsonParser.prototype.skipWs = function () {
        while (this.i < this.s.length) {
            var c = this.s.charAt(this.i);
            if (c === ' ' || c === '\n' || c === '\r' || c === '\t') this.i++;
            else break;
        }
    };
    JsonParser.prototype.peek = function () { return this.s.charAt(this.i); };
    JsonParser.prototype.expect = function (ch) {
        if (this.s.charAt(this.i) !== ch) throw new Error('Expected "' + ch + '" at ' + this.i);
        this.i++;
    };
    JsonParser.prototype.parseValue = function () {
        this.skipWs();
        var c = this.peek();
        if (c === '{') return this.parseObject();
        if (c === '[') return this.parseArray();
        if (c === '"') return this.parseString();
        if (c === '-' || (c >= '0' && c <= '9')) return this.parseNumber();
        if (this.s.substr(this.i, 4) === 'true') { this.i += 4; return true; }
        if (this.s.substr(this.i, 5) === 'false') { this.i += 5; return false; }
        if (this.s.substr(this.i, 4) === 'null') { this.i += 4; return null; }
        throw new Error('Unexpected character "' + c + '" at ' + this.i);
    };
    JsonParser.prototype.parseObject = function () {
        var obj = {};
        this.expect('{');
        this.skipWs();
        if (this.peek() === '}') { this.i++; return obj; }
        while (true) {
            this.skipWs();
            var key = this.parseString();
            this.skipWs();
            this.expect(':');
            obj[key] = this.parseValue();
            this.skipWs();
            if (this.peek() === ',') { this.i++; continue; }
            if (this.peek() === '}') { this.i++; return obj; }
            throw new Error('Bad object at ' + this.i);
        }
    };
    JsonParser.prototype.parseArray = function () {
        var arr = [];
        this.expect('[');
        this.skipWs();
        if (this.peek() === ']') { this.i++; return arr; }
        while (true) {
            arr.push(this.parseValue());
            this.skipWs();
            if (this.peek() === ',') { this.i++; continue; }
            if (this.peek() === ']') { this.i++; return arr; }
            throw new Error('Bad array at ' + this.i);
        }
    };
    JsonParser.prototype.parseString = function () {
        this.expect('"');
        var out = '';
        while (this.i < this.s.length) {
            var c = this.s.charAt(this.i);
            if (c === '"') { this.i++; return out; }
            if (c === '\\') {
                this.i++;
                var e = this.s.charAt(this.i);
                if (e === 'n') out += '\n';
                else if (e === 't') out += '\t';
                else if (e === 'r') out += '\r';
                else if (e === 'u') {
                    out += String.fromCharCode(parseInt(this.s.substr(this.i + 1, 4), 16));
                    this.i += 4;
                } else out += e;
                this.i++;
            } else {
                out += c;
                this.i++;
            }
        }
        throw new Error('Unterminated string');
    };
    JsonParser.prototype.parseNumber = function () {
        var start = this.i;
        if (this.peek() === '-') this.i++;
        while (this.i < this.s.length) {
            var c = this.s.charAt(this.i);
            if ((c >= '0' && c <= '9') || c === '.' || c === 'e' || c === 'E' || c === '+' || c === '-') this.i++;
            else break;
        }
        return parseFloat(this.s.substr(start, this.i - start));
    };

    // ------------------- HISTORY DATABASE ------------------------------

    var History = {
        path: null,
        data: null,

        storageFolder: function () {
            // Writability probe uses a dedicated temp file - never the
            // history database itself, which must never be truncated.
            var probeName = '/pspg_write_probe.tmp';
            var candidates = [];
            try {
                candidates.push(new File($.fileName).parent);
            } catch (e) { /* ignore */ }
            candidates.push(Folder.myDocuments);
            for (var i = 0; i < candidates.length; i++) {
                var f = new File(candidates[i].fsName + probeName);
                try {
                    if (f.open('w')) { f.close(); f.remove(); return candidates[i]; }
                } catch (e2) { /* try next candidate */ }
            }
            return Folder.myDocuments;
        },

        init: function () {
            this.path = new File(this.storageFolder().fsName + '/' + HISTORY_FILE);
            this.load();
        },

        load: function () {
            this.data = {
                version: 1,
                createdAt: new Date().toString(),
                settings: { lastFolder: '', lastExportIndex: 0 },
                records: [],
                index: {}
            };
            if (!this.path.exists) return this.data;
            try {
                this.path.encoding = 'UTF-8';
                if (!this.path.open('r')) return this.data;
                var txt = this.path.read();
                this.path.close();
                if (!txt || txt.length < 5) return this.data;
                var parsed = Json.parse(txt);
                if (parsed && parsed.version) {
                    this.data = parsed;
                    if (!this.data.index) this.rebuildIndex();
                    if (!this.data.settings) this.data.settings = { lastFolder: '', lastExportIndex: 0 };
                    if (!this.data.records) this.data.records = [];
                }
            } catch (e) {
                var backup = new File(this.path.parent.fsName + '/' + HISTORY_BACKUP);
                var recovered = false;
                if (backup.exists) {
                    try {
                        backup.encoding = 'UTF-8';
                        backup.open('r');
                        var btxt = backup.read();
                        backup.close();
                        var bdata = Json.parse(btxt);
                        if (bdata && bdata.version) {
                            this.data = bdata;
                            if (!this.data.index) this.rebuildIndex();
                            recovered = true;
                        }
                    } catch (e2) { /* fall through */ }
                }
                if (!recovered) {
                    this.data = {
                        version: 1,
                        createdAt: new Date().toString(),
                        settings: { lastFolder: '', lastExportIndex: 0 },
                        records: [],
                        index: {}
                    };
                }
            }
            return this.data;
        },

        rebuildIndex: function () {
            this.data.index = {};
            for (var i = 0; i < this.data.records.length; i++) {
                this.data.index[this.data.records[i].fingerprint] = this.data.records[i];
            }
        },

        save: function () {
            try {
                if (this.path.exists) {
                    var backup = new File(this.path.parent.fsName + '/' + HISTORY_BACKUP);
                    this.path.copy(backup.fsName);
                }
                this.path.encoding = 'UTF-8';
                if (this.path.open('w')) {
                    this.path.write(Json.stringify(this.data));
                    this.path.close();
                    return true;
                }
            } catch (e) { /* keep in-memory state */ }
            return false;
        },

        hasFingerprint: function (fp) {
            return this.data.index.hasOwnProperty(fp);
        },

        // Practical structural-similarity guard: a structure key
        // (category+composition+motif mix+density) that was already used
        // is rejected so long-term output keeps rotating through designs.
        structureUsedCount: function (key) {
            var c = 0;
            for (var fp in this.data.index) {
                if (this.data.index.hasOwnProperty(fp) && this.data.index[fp].structureKey === key) c++;
            }
            return c;
        },

        paletteUsed: function (bg, colorsJoined) {
            for (var fp in this.data.index) {
                if (!this.data.index.hasOwnProperty(fp)) continue;
                var r = this.data.index[fp];
                if (r.background === bg && r.paletteKey === colorsJoined) return true;
            }
            return false;
        },

        addRecord: function (rec) {
            this.data.records.push(rec);
            this.data.index[rec.fingerprint] = rec;
        },

        count: function () { return this.data.records.length; },

        lastFolder: function () {
            return this.data.settings && this.data.settings.lastFolder ? this.data.settings.lastFolder : '';
        },
        setLastFolder: function (fsName) { this.data.settings.lastFolder = fsName; },

        lastIndex: function () {
            return this.data.settings && this.data.settings.lastExportIndex ? this.data.settings.lastExportIndex : 0;
        },
        setLastIndex: function (n) { this.data.settings.lastExportIndex = n; }
    };

    // ------------------- VECTOR PRIMITIVES -----------------------------
    // All shapes are built via setEntirePath for maximum ExtendScript
    // compatibility (no reliance on ellipse()/polygon() argument-order
    // quirks across Illustrator versions).

    function circlePoints(cx, cy, r, segments) {
        var pts = [], seg = segments || 32;
        for (var i = 0; i < seg; i++) {
            var a = (i / seg) * Math.PI * 2;
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        return pts;
    }

    function blobPoints(cx, cy, r, rng, irregularity, points) {
        var pts = [], n = points || 14, i;
        var offs = [];
        for (i = 0; i < n; i++) offs.push(1 + rndRange(rng, -irregularity, irregularity));
        var sm = [];
        for (i = 0; i < n; i++) {
            sm.push((offs[(i - 1 + n) % n] + offs[i] * 2 + offs[(i + 1) % n]) / 4);
        }
        for (i = 0; i < n; i++) {
            var a = (i / n) * Math.PI * 2;
            pts.push([cx + Math.cos(a) * r * sm[i], cy + Math.sin(a) * r * sm[i]]);
        }
        return pts;
    }

    function polygonPoints(cx, cy, r, sides, rotDeg) {
        var pts = [];
        var rot = (rotDeg || 0) * Math.PI / 180;
        for (var i = 0; i < sides; i++) {
            var a = rot + (i / sides) * Math.PI * 2 - Math.PI / 2;
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        return pts;
    }

    function starPoints(cx, cy, rOuter, rInner, points, rotDeg) {
        var pts = [];
        var rot = (rotDeg || 0) * Math.PI / 180;
        for (var i = 0; i < points * 2; i++) {
            var r = (i % 2 === 0) ? rOuter : rInner;
            var a = rot + (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        return pts;
    }

    function addPath(parent, pts, closed, hexFill, hexStroke, strokeWidth) {
        var p = parent.pathItems.add();
        p.name = 'pspg_shape';
        p.setEntirePath(pts);
        p.closed = !!closed;
        if (hexFill) {
            p.filled = true;
            p.fillColor = makeRgbColor(hexFill);
        } else {
            p.filled = false;
        }
        if (hexStroke) {
            p.stroked = true;
            p.strokeColor = makeRgbColor(hexStroke);
            p.strokeWidth = strokeWidth || 4;
            p.strokeCap = StrokeCap.ROUNDCAP;
            p.strokeJoin = StrokeJoin.ROUNDJOIN;
        } else {
            p.stroked = false;
        }
        return p;
    }

    function addCircle(parent, cx, cy, r, hexFill, hexStroke, strokeWidth) {
        return addPath(parent, circlePoints(cx, cy, r, 36), true, hexFill, hexStroke, strokeWidth);
    }

    function addRing(parent, cx, cy, rOuter, rInner, hexFill) {
        var rMid = (rOuter + rInner) / 2;
        var w = rOuter - rInner;
        return addPath(parent, circlePoints(cx, cy, rMid, 40), false, null, hexFill, w);
    }

    function addRect(parent, cx, cy, w, h, hexFill, hexStroke, strokeWidth, cornerR) {
        var pts;
        if (cornerR && cornerR > 0) {
            var r = Math.min(cornerR, w / 2, h / 2);
            var x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
            pts = [];
            var seg = 8;
            var corners = [
                [x1 - r, y0 + r, 0],
                [x1 - r, y1 - r, 90],
                [x0 + r, y1 - r, 180],
                [x0 + r, y0 + r, 270]
            ];
            for (var c = 0; c < 4; c++) {
                for (var i = 0; i <= seg; i++) {
                    var a = (corners[c][2] + (i / seg) * 90) * Math.PI / 180;
                    pts.push([corners[c][0] + Math.cos(a) * r, corners[c][1] + Math.sin(a) * r]);
                }
            }
        } else {
            pts = [
                [cx - w / 2, cy - h / 2],
                [cx + w / 2, cy - h / 2],
                [cx + w / 2, cy + h / 2],
                [cx - w / 2, cy + h / 2]
            ];
        }
        return addPath(parent, pts, true, hexFill, hexStroke, strokeWidth);
    }

    function rotateAround(item, cx, cy, deg) {
        if (!deg) return;
        item.translate(cx, cy);
        item.rotate(deg, true, true, true, true, Transformation.CENTER);
        item.translate(-cx, -cy);
    }

    // ------------------- SEAMLESS WRAPPING ENGINE ----------------------

    // Draws a motif via maker(group, cx, cy, size, ctx, extra) centered at
    // (cx, cy), MEASURES its real visible bounds (including strokes and
    // organic overshoot), then replicates the exact drawn group across the
    // tile boundaries it actually crosses. Duplicates are offset by exactly
    // +/- TILE, which guarantees a mathematically seamless repeat.
    function placeWrapped(ctx, maker, cx, cy, size, extra) {
        var g = ctx.clipGroup.groupItems.add();
        g.name = 'pspg_motif';
        maker(g, cx, cy, size, ctx, extra);

        var b = g.visibleBounds; // [left, top, right, bottom]
        var xs = [0], ys = [0];
        if (b[0] < 0) xs.push(TILE);
        if (b[2] > TILE) xs.push(-TILE);
        if (b[1] < 0) ys.push(TILE);
        if (b[3] > TILE) ys.push(-TILE);

        for (var xi = 0; xi < xs.length; xi++) {
            for (var yi = 0; yi < ys.length; yi++) {
                if (xs[xi] === 0 && ys[yi] === 0) continue;
                var dup = g.duplicate(ctx.clipGroup, ElementPlacement.PLACEATEND);
                dup.translate(xs[xi], ys[yi]);
                ctx.stats.wrappedCopies++;
            }
        }
        ctx.stats.motifInstances++;
        if (xs.length > 1 || ys.length > 1) ctx.stats.wrappedMotifs++;
    }

    // Independent document-level wrapping verification: every motif group
    // whose visible bounds cross a tile edge must have an exact twin at
    // the corresponding +/- TILE offset, and vice versa.
    function verifyWrappingInDoc(clipGroup) {
        var groups = [];
        var gi = clipGroup.groupItems;
        for (var i = 0; i < gi.length; i++) {
            if (gi[i].name === 'pspg_motif') groups.push(gi[i]);
        }
        var issues = [];
        for (var a = 0; a < groups.length; a++) {
            var ba = groups[a].visibleBounds;
            var crosses = (ba[0] < 0 || ba[2] > TILE || ba[1] < 0 || ba[3] > TILE);
            if (!crosses) continue;
            var need = [];
            if (ba[0] < 0) need.push([TILE, 0]);
            if (ba[2] > TILE) need.push([-TILE, 0]);
            if (ba[1] < 0) need.push([0, TILE]);
            if (ba[3] > TILE) need.push([0, -TILE]);
            if (ba[0] < 0 && ba[1] < 0) need.push([TILE, TILE]);
            if (ba[0] < 0 && ba[3] > TILE) need.push([TILE, -TILE]);
            if (ba[2] > TILE && ba[1] < 0) need.push([-TILE, TILE]);
            if (ba[2] > TILE && ba[3] > TILE) need.push([-TILE, -TILE]);
            for (var n = 0; n < need.length; n++) {
                var found = false;
                for (var b2 = 0; b2 < groups.length; b2++) {
                    if (b2 === a) continue;
                    var bb2 = groups[b2].visibleBounds;
                    if (Math.abs(bb2[0] - (ba[0] + need[n][0])) < 0.5 &&
                        Math.abs(bb2[1] - (ba[1] + need[n][1])) < 0.5 &&
                        Math.abs(bb2[2] - (ba[2] + need[n][0])) < 0.5 &&
                        Math.abs(bb2[3] - (ba[3] + need[n][1])) < 0.5) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    issues.push('Missing wrap twin for motif at [' +
                        [ba[0], ba[1], ba[2], ba[3]].join(', ') +
                        '] offset [' + need[n][0] + ', ' + need[n][1] + ']');
                }
            }
        }
        return issues;
    }

    // ------------------------- MOTIF LIBRARY ---------------------------

    function col(ctx, idx) { return ctx.palette[idx % ctx.palette.length]; }
    function colAny(ctx) { return pick(ctx.rng, ctx.palette); }

    function colContrast(ctx, against) {
        var a = hexToRgb(against), best = ctx.palette[0], bestC = -1;
        for (var i = 0; i < ctx.palette.length; i++) {
            var r = contrastRatio(hexToRgb(ctx.palette[i]), a);
            if (r > bestC) { bestC = r; best = ctx.palette[i]; }
        }
        return best;
    }

    var MOTIFS = {

        dot: function (g, cx, cy, s, ctx) {
            addCircle(g, cx, cy, s * 0.5, colAny(ctx), null, 0);
        },

        concentricCircles: function (g, cx, cy, s, ctx) {
            var n = rndInt(ctx.rng, 2, 4);
            for (var i = 0; i < n; i++) {
                var r = s * 0.5 * (1 - i / (n + 0.4));
                if (i % 2 === 0) addCircle(g, cx, cy, r, col(ctx, i), null, 0);
                else addCircle(g, cx, cy, r, null, col(ctx, i), s * 0.06);
            }
        },

        semicircle: function (g, cx, cy, s, ctx, extra) {
            var rot = (extra && extra.rot) || 0;
            var pts = [];
            var seg = 18;
            for (var i = 0; i <= seg; i++) {
                var a = Math.PI + (i / seg) * Math.PI;
                pts.push([cx + Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5]);
            }
            pts.push([cx - s * 0.5, cy], [cx + s * 0.5, cy]);
            var p = addPath(g, pts, true, colAny(ctx), null, 0);
            rotateAround(p, cx, cy, rot);
        },

        triangle: function (g, cx, cy, s, ctx, extra) {
            var rot = (extra && extra.rot) || 0;
            addPath(g, polygonPoints(cx, cy, s * 0.58, 3, rot), true, colAny(ctx), null, 0);
        },

        square: function (g, cx, cy, s, ctx, extra) {
            var rot = (extra && extra.rot) || 0;
            var p = addRect(g, cx, cy, s * 0.85, s * 0.85, colAny(ctx), null, 0, 0);
            rotateAround(p, cx, cy, rot);
        },

        roundedSquare: function (g, cx, cy, s, ctx, extra) {
            var rot = (extra && extra.rot) || 0;
            var p = addRect(g, cx, cy, s * 0.85, s * 0.85, colAny(ctx), null, 0, s * 0.22);
            rotateAround(p, cx, cy, rot);
        },

        diamond: function (g, cx, cy, s, ctx, extra) {
            var rot = (extra && extra.rot) || 0;
            addPath(g, polygonPoints(cx, cy, s * 0.62, 4, 45 + rot), true, colAny(ctx), null, 0);
        },

        hexagon: function (g, cx, cy, s, ctx) {
            addPath(g, polygonPoints(cx, cy, s * 0.55, 6, 0), true, colAny(ctx), null, 0);
        },

        polygon: function (g, cx, cy, s, ctx, extra) {
            var sides = rndInt(ctx.rng, 5, 8);
            var rot = (extra && extra.rot) || 0;
            addPath(g, polygonPoints(cx, cy, s * 0.55, sides, rot), true, colAny(ctx), null, 0);
        },

        star: function (g, cx, cy, s, ctx) {
            addPath(g, starPoints(cx, cy, s * 0.55, s * 0.24, rndInt(ctx.rng, 4, 6), rndRange(ctx.rng, 0, 30)), true, colAny(ctx), null, 0);
        },

        blob: function (g, cx, cy, s, ctx) {
            addPath(g, blobPoints(cx, cy, s * 0.5, ctx.rng, 0.28, 14), true, colAny(ctx), null, 0);
        },

        blobOutline: function (g, cx, cy, s, ctx) {
            addPath(g, blobPoints(cx, cy, s * 0.44, ctx.rng, 0.3, 14), true, null, colAny(ctx), s * 0.05);
        },

        fluidBlobPair: function (g, cx, cy, s, ctx) {
            addPath(g, blobPoints(cx - s * 0.16, cy - s * 0.1, s * 0.32, ctx.rng, 0.32, 12), true, col(ctx, 0), null, 0);
            addPath(g, blobPoints(cx + s * 0.18, cy + s * 0.12, s * 0.24, ctx.rng, 0.32, 12), true, col(ctx, 1 % ctx.palette.length), null, 0);
        },

        leaf: function (g, cx, cy, s, ctx, extra) {
            var rot = (extra && extra.rot) || 0;
            var w = s * 0.5, h = s * 0.22;
            var pts = [];
            var seg = 12, i;
            for (i = 0; i <= seg; i++) {
                var t = i / seg;
                pts.push([cx - w + 2 * w * t, cy - Math.sin(t * Math.PI) * h]);
            }
            for (i = seg; i >= 0; i--) {
                var t2 = i / seg;
                pts.push([cx - w + 2 * w * t2, cy + Math.sin(t2 * Math.PI) * h]);
            }
            var p = addPath(g, pts, true, colAny(ctx), null, 0);
            rotateAround(p, cx, cy, rot);
        },

        branch: function (g, cx, cy, s, ctx) {
            var c = colAny(ctx);
            var stem = [];
            var seg = 10;
            for (var i = 0; i <= seg; i++) {
                var t = i / seg;
                stem.push([cx - s * 0.45 + s * 0.9 * t, cy + Math.sin(t * Math.PI * 0.9) * s * 0.18]);
            }
            addPath(g, stem, false, null, c, s * 0.04);
            for (i = 1; i < 5; i++) {
                var t2 = i / 5;
                var px = cx - s * 0.45 + s * 0.9 * t2;
                var py = cy + Math.sin(t2 * Math.PI * 0.9) * s * 0.18;
                var side = (i % 2 === 0) ? 1 : -1;
                var lf = [];
                for (var j = 0; j <= 8; j++) {
                    var tt = j / 8;
                    lf.push([px + s * 0.14 * tt, py + side * Math.sin(tt * Math.PI) * s * 0.1]);
                }
                for (j = 8; j >= 0; j--) {
                    var tt2 = j / 8;
                    lf.push([px + s * 0.14 * tt2, py + side * Math.sin(tt2 * Math.PI) * s * 0.02]);
                }
                addPath(g, lf, true, c, null, 0);
            }
        },

        flower: function (g, cx, cy, s, ctx) {
            var petals = rndInt(ctx.rng, 5, 8);
            var pc = col(ctx, 0);
            var cc = colContrast(ctx, pc);
            for (var i = 0; i < petals; i++) {
                var a = (i / petals) * 360;
                var px = cx + Math.cos(a * Math.PI / 180) * s * 0.26;
                var py = cy + Math.sin(a * Math.PI / 180) * s * 0.26;
                var pts = [];
                var seg = 10;
                var pr = s * 0.16;
                for (var j = 0; j <= seg; j++) {
                    var aa = (j / seg) * Math.PI * 2;
                    pts.push([px + Math.cos(aa) * pr, py + Math.sin(aa) * pr * 0.62]);
                }
                var petal = addPath(g, pts, true, pc, null, 0);
                rotateAround(petal, px, py, a);
            }
            addCircle(g, cx, cy, s * 0.13, cc, null, 0);
        },

        tulipMotif: function (g, cx, cy, s, ctx) {
            var c = colAny(ctx);
            var pts = [];
            var seg = 14;
            for (var i = 0; i <= seg; i++) {
                var t = i / seg;
                var x = cx + Math.cos(Math.PI + t * Math.PI) * s * 0.3;
                pts.push([x, cy - s * 0.35 + Math.sin(Math.PI + t * Math.PI) * -s * 0.3]);
            }
            pts.push([cx, cy + s * 0.4]);
            addPath(g, pts, true, c, null, 0);
        },

        waveLine: function (g, cx, cy, s, ctx) {
            var amp = s * rndRange(ctx.rng, 0.12, 0.22);
            var waves = rndInt(ctx.rng, 1, 3);
            var pts = [];
            var seg = 40;
            for (var i = 0; i <= seg; i++) {
                var t = i / seg;
                pts.push([cx - s * 0.5 + s * t, cy + Math.sin(t * Math.PI * 2 * waves) * amp]);
            }
            addPath(g, pts, false, null, colAny(ctx), s * rndRange(ctx.rng, 0.04, 0.09));
        },

        arcLine: function (g, cx, cy, s, ctx, extra) {
            var rot = (extra && extra.rot) || 0;
            var pts = [];
            var seg = 22;
            for (var i = 0; i <= seg; i++) {
                var a = Math.PI + (i / seg) * Math.PI;
                pts.push([cx + Math.cos(a) * s * 0.45, cy + Math.sin(a) * s * 0.45]);
            }
            var p = addPath(g, pts, false, null, colAny(ctx), s * rndRange(ctx.rng, 0.05, 0.1));
            rotateAround(p, cx, cy, rot);
        },

        straightLine: function (g, cx, cy, s, ctx, extra) {
            var rot = (extra && extra.rot) || 0;
            var p = addPath(g, [[cx - s * 0.5, cy], [cx + s * 0.5, cy]], false, null, colAny(ctx), s * rndRange(ctx.rng, 0.04, 0.1));
            rotateAround(p, cx, cy, rot);
        },

        zigzag: function (g, cx, cy, s, ctx) {
            var n = rndInt(ctx.rng, 3, 5);
            var pts = [];
            for (var i = 0; i <= n * 2; i++) {
                pts.push([cx - s * 0.5 + s * (i / (n * 2)), cy + (i % 2 === 0 ? -1 : 1) * s * 0.18]);
            }
            addPath(g, pts, false, null, colAny(ctx), s * rndRange(ctx.rng, 0.05, 0.09));
        },

        squiggle: function (g, cx, cy, s, ctx) {
            var pts = [];
            var seg = 36;
            var f = rndInt(ctx.rng, 2, 3);
            var phase = rndRange(ctx.rng, 0, 0.4);
            for (var i = 0; i <= seg; i++) {
                var t = i / seg;
                pts.push([cx - s * 0.5 + s * t, cy + Math.sin(t * Math.PI * 2 * f + phase) * s * 0.16]);
            }
            addPath(g, pts, false, null, colAny(ctx), s * 0.06);
        },

        cross: function (g, cx, cy, s, ctx) {
            var w = s * 0.16;
            var c = colAny(ctx);
            addRect(g, cx, cy, s * 0.7, w, c, null, 0, w / 2);
            addRect(g, cx, cy, w, s * 0.7, c, null, 0, w / 2);
        },

        ring: function (g, cx, cy, s, ctx) {
            addRing(g, cx, cy, s * 0.45, s * 0.3, colAny(ctx));
        },

        halfMoonStack: function (g, cx, cy, s, ctx) {
            var n = rndInt(ctx.rng, 2, 3);
            for (var i = 0; i < n; i++) {
                var pts = [];
                var seg = 16;
                var r = s * 0.42;
                for (var j = 0; j <= seg; j++) {
                    var a = Math.PI + (j / seg) * Math.PI;
                    pts.push([cx + Math.cos(a) * r, cy + i * s * 0.16 + Math.sin(a) * r * 0.55]);
                }
                pts.push([cx - r, cy + i * s * 0.16], [cx + r, cy + i * s * 0.16]);
                addPath(g, pts, true, col(ctx, i), null, 0);
            }
        },

        retroArcs: function (g, cx, cy, s, ctx) {
            var n = rndInt(ctx.rng, 2, 4);
            for (var i = 0; i < n; i++) {
                var r = s * 0.45 - i * s * 0.11;
                if (r < s * 0.06) break;
                var pts = [];
                var seg = 20;
                for (var j = 0; j <= seg; j++) {
                    var a = Math.PI + (j / seg) * Math.PI;
                    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
                }
                addPath(g, pts, false, null, col(ctx, i), s * 0.07);
            }
        },

        eyeMotif: function (g, cx, cy, s, ctx) {
            var c1 = col(ctx, 0), c2 = colContrast(ctx, c1);
            var pts = [], seg = 12, i;
            for (i = 0; i <= seg; i++) {
                var t = i / seg;
                pts.push([cx - s * 0.45 + s * 0.9 * t, cy - Math.sin(t * Math.PI) * s * 0.26]);
            }
            for (i = seg; i >= 0; i--) {
                var t2 = i / seg;
                pts.push([cx - s * 0.45 + s * 0.9 * t2, cy + Math.sin(t2 * Math.PI) * s * 0.26]);
            }
            addPath(g, pts, true, c1, null, 0);
            addCircle(g, cx, cy, s * 0.14, c2, null, 0);
        },

        tinyDot: function (g, cx, cy, s, ctx) {
            addCircle(g, cx, cy, s * 0.16, colAny(ctx), null, 0);
        },

        tinyRing: function (g, cx, cy, s, ctx) {
            addRing(g, cx, cy, s * 0.3, s * 0.22, colAny(ctx));
        },

        tinyDiamond: function (g, cx, cy, s, ctx) {
            addPath(g, polygonPoints(cx, cy, s * 0.2, 4, 45), true, colAny(ctx), null, 0);
        },

        tinyPlus: function (g, cx, cy, s, ctx) {
            var c = colAny(ctx);
            var w = s * 0.06;
            addRect(g, cx, cy, s * 0.3, w, c, null, 0, 0);
            addRect(g, cx, cy, w, s * 0.3, c, null, 0, 0);
        },

        tinyTriangle: function (g, cx, cy, s, ctx) {
            addPath(g, polygonPoints(cx, cy, s * 0.2, 3, 0), true, colAny(ctx), null, 0);
        },

        tinyArc: function (g, cx, cy, s, ctx) {
            var pts = [];
            var seg = 12;
            for (var i = 0; i <= seg; i++) {
                var a = Math.PI + (i / seg) * Math.PI;
                pts.push([cx + Math.cos(a) * s * 0.2, cy + Math.sin(a) * s * 0.2]);
            }
            addPath(g, pts, false, null, colAny(ctx), s * 0.05);
        },

        budMotif: function (g, cx, cy, s, ctx) {
            addPath(g, blobPoints(cx, cy, s * 0.2, ctx.rng, 0.18, 10), true, colAny(ctx), null, 0);
            addPath(g, [[cx, cy], [cx - s * 0.12, cy + s * 0.3]], false, null, colAny(ctx), s * 0.04);
        },

        ornamentDiamond: function (g, cx, cy, s, ctx) {
            var c1 = col(ctx, 0), c2 = colContrast(ctx, c1);
            addPath(g, polygonPoints(cx, cy, s * 0.45, 4, 45), true, c1, null, 0);
            addPath(g, polygonPoints(cx, cy, s * 0.26, 4, 45), true, c2, null, 0);
            addCircle(g, cx, cy, s * 0.09, c1, null, 0);
        },

        scallopRow: function (g, cx, cy, s, ctx) {
            var n = 3;
            var r = s * 0.18;
            for (var i = 0; i < n; i++) {
                var scx = cx - s * 0.4 + i * (s * 0.4);
                var pts = [];
                var seg = 10;
                for (var j = 0; j <= seg; j++) {
                    var a = Math.PI + (j / seg) * Math.PI;
                    pts.push([scx + Math.cos(a) * r, cy + Math.sin(a) * r]);
                }
                pts.push([scx - r, cy], [scx + r, cy]);
                addPath(g, pts, true, colAny(ctx), null, 0);
            }
        }
    };

    // 'circle-like' resolves to a plain filled circle at draw time.
    function resolveMotif(name) {
        if (name === 'circle-like') return MOTIFS.dot;
        return MOTIFS[name];
    }

    // ------------------------- STYLE LIBRARY ---------------------------
    // category -> motif pools, preferred compositions, palette schemes

    var STYLES = {
        GEOMETRIC: {
            motifs: ['circle-like', 'concentricCircles', 'semicircle', 'triangle', 'square', 'roundedSquare', 'diamond', 'hexagon', 'polygon', 'ring', 'cross'],
            compositions: ['STRAIGHT_GRID', 'BRICK', 'HEXAGONAL', 'DIAGONAL', 'ALTERNATING', 'HALF_DROP'],
            schemes: ['VIBRANT', 'COMPLEMENTARY', 'MONOCHROMATIC', 'ANALOGOUS', 'MUTED_ELEGANT'],
            sizeFactor: [0.55, 0.95],
            rotation: [0, 0]
        },
        ABSTRACT: {
            motifs: ['blob', 'blobOutline', 'fluidBlobPair', 'concentricCircles', 'semicircle', 'eyeMotif'],
            compositions: ['SCATTERED', 'HALF_DROP', 'STRAIGHT_GRID', 'RADIAL_RINGS'],
            schemes: ['PASTEL', 'MUTED_ELEGANT', 'ANALOGOUS', 'VIBRANT'],
            sizeFactor: [0.7, 1.5],
            rotation: [0, 35]
        },
        LINE: {
            motifs: ['waveLine', 'arcLine', 'straightLine', 'zigzag', 'squiggle', 'ring', 'concentricCircles'],
            compositions: ['STRAIGHT_GRID', 'DIAGONAL', 'SCATTERED', 'BRICK', 'HALF_DROP'],
            schemes: ['MONOCHROMATIC', 'NEUTRAL', 'MUTED_ELEGANT', 'ANALOGOUS', 'PASTEL'],
            sizeFactor: [0.6, 1.1],
            rotation: [0, 90]
        },
        MINIMALIST: {
            motifs: ['tinyDot', 'tinyRing', 'tinyDiamond', 'tinyPlus', 'tinyTriangle', 'tinyArc', 'dot'],
            compositions: ['STRAIGHT_GRID', 'HALF_DROP', 'ALTERNATING', 'SCATTERED', 'DIAGONAL'],
            schemes: ['PASTEL', 'NEUTRAL', 'MONOCHROMATIC', 'MUTED_ELEGANT'],
            sizeFactor: [0.35, 0.6],
            rotation: [0, 0]
        },
        DECORATIVE: {
            motifs: ['flower', 'leaf', 'branch', 'budMotif', 'ornamentDiamond', 'scallopRow', 'tulipMotif', 'ring'],
            compositions: ['HALF_DROP', 'BRICK', 'STRAIGHT_GRID', 'SCATTERED', 'RADIAL_RINGS'],
            schemes: ['LUXURY', 'PASTEL', 'MUTED_ELEGANT', 'EARTH_TONE', 'ANALOGOUS'],
            sizeFactor: [0.6, 1.1],
            rotation: [0, 25]
        },
        RETRO: {
            motifs: ['semicircle', 'halfMoonStack', 'retroArcs', 'circle-like', 'concentricCircles', 'diamond', 'zigzag', 'eyeMotif'],
            compositions: ['BRICK', 'HALF_DROP', 'STRAIGHT_GRID', 'ALTERNATING', 'DIAGONAL'],
            schemes: ['RETRO', 'EARTH_TONE', 'VIBRANT'],
            sizeFactor: [0.6, 1.0],
            rotation: [0, 0]
        },
        MODERN: {
            motifs: ['blob', 'triangle', 'semicircle', 'squiggle', 'zigzag', 'tinyPlus', 'dot', 'ring', 'leaf', 'diamond', 'cross', 'scallopRow'],
            compositions: ['SCATTERED', 'ALTERNATING', 'STRAIGHT_GRID', 'HALF_DROP', 'DIAGONAL'],
            schemes: ['VIBRANT', 'PASTEL', 'COMPLEMENTARY', 'RETRO', 'MUTED_ELEGANT'],
            sizeFactor: [0.5, 1.2],
            rotation: [0, 30]
        }
    };

    var COMPOSITIONS = [
        'STRAIGHT_GRID', 'HALF_DROP', 'BRICK', 'DIAGONAL',
        'HEXAGONAL', 'RADIAL_RINGS', 'SCATTERED', 'ALTERNATING'
    ];

    // ---------------------- COMPOSITION ENGINE -------------------------

    // Returns an array of cell descriptors: {x, y, cell, variant}
    function buildComposition(comp, density, cell, rng) {
        var cells = [];
        var cols, rows, r, c;

        if (comp === 'STRAIGHT_GRID' || comp === 'ALTERNATING' || comp === 'DIAGONAL') {
            cols = Math.max(2, Math.round(TILE / cell));
            rows = cols;
            var stepX = TILE / cols, stepY = TILE / rows;
            for (r = 0; r < rows; r++) {
                for (c = 0; c < cols; c++) {
                    var variant = 0;
                    if (comp === 'DIAGONAL' || comp === 'ALTERNATING') variant = (r + c) % 2;
                    else if ((r * 31 + c * 17) % 7 === 0) variant = 1;
                    cells.push({ x: stepX * (c + 0.5), y: stepY * (r + 0.5), cell: cell, variant: variant });
                }
            }
        } else if (comp === 'HALF_DROP') {
            cols = Math.max(2, Math.round(TILE / cell));
            rows = cols;
            var sx = TILE / cols, sy = TILE / rows;
            for (c = 0; c < cols; c++) {
                var off = (c % 2 === 1) ? sy / 2 : 0;
                for (r = 0; r < rows; r++) {
                    cells.push({ x: sx * (c + 0.5), y: (sy * (r + 0.5) + off) % TILE, cell: cell, variant: c % 2 });
                }
            }
        } else if (comp === 'BRICK') {
            cols = Math.max(2, Math.round(TILE / cell));
            rows = cols;
            var bx = TILE / cols, by = TILE / rows;
            for (r = 0; r < rows; r++) {
                var offx = (r % 2 === 1) ? bx / 2 : 0;
                for (c = 0; c < cols; c++) {
                    cells.push({ x: (bx * (c + 0.5) + offx) % TILE, y: by * (r + 0.5), cell: cell, variant: r % 2 });
                }
            }
        } else if (comp === 'HEXAGONAL') {
            cols = Math.max(2, Math.round(TILE / cell));
            var hx = TILE / cols;
            var hy = hx * 0.866;
            var rowIdx = 0;
            for (var y2 = hy / 2; y2 < TILE + hy / 2; y2 += hy) {
                var off2 = (rowIdx % 2 === 1) ? hx / 2 : 0;
                for (var x2 = hx / 2; x2 < TILE + hx / 2; x2 += hx) {
                    cells.push({ x: (x2 + off2) % TILE, y: y2 % TILE, cell: cell, variant: rowIdx % 3 });
                }
                rowIdx++;
            }
        } else if (comp === 'SCATTERED') {
            var base = Math.pow(TILE / cell, 2);
            var target = density === 'DENSE' ? Math.round(base * 0.9)
                : (density === 'SPARSE' ? Math.round(base * 0.35) : Math.round(base * 0.6));
            target = clamp(target, 12, 260);
            var minDist = cell * (density === 'DENSE' ? 0.55 : (density === 'SPARSE' ? 1.05 : 0.75));
            var attempts = 0;
            while (cells.length < target && attempts < target * 30) {
                attempts++;
                var px = rndRange(rng, 0, TILE), py = rndRange(rng, 0, TILE);
                var ok = true;
                for (var i = 0; i < cells.length; i++) {
                    var dx2 = Math.abs(px - cells[i].x), dy2 = Math.abs(py - cells[i].y);
                    if (dx2 > TILE / 2) dx2 = TILE - dx2;
                    if (dy2 > TILE / 2) dy2 = TILE - dy2;
                    if (Math.sqrt(dx2 * dx2 + dy2 * dy2) < minDist) { ok = false; break; }
                }
                if (ok) cells.push({ x: px, y: py, cell: cell, variant: rndInt(rng, 0, 2) });
            }
        } else if (comp === 'RADIAL_RINGS') {
            var nc = density === 'DENSE' ? 3 : 2;
            var stepC = TILE / nc;
            var centers = [];
            for (r = 0; r < nc; r++) {
                for (c = 0; c < nc; c++) {
                    centers.push({ x: stepC * (c + 0.5), y: stepC * (r + 0.5) });
                }
            }
            var rings = density === 'SPARSE' ? 2 : 3;
            for (var ci = 0; ci < centers.length; ci++) {
                for (var ri = 0; ri < rings; ri++) {
                    var rad = cell * (0.55 + ri * 0.5);
                    var count = Math.max(3, Math.round((2 * Math.PI * rad) / (cell * 0.85)));
                    for (var a2 = 0; a2 < count; a2++) {
                        var ang = (a2 / count) * Math.PI * 2 + ri * 0.35;
                        cells.push({
                            x: centers[ci].x + Math.cos(ang) * rad,
                            y: centers[ci].y + Math.sin(ang) * rad,
                            cell: cell, variant: ri % 2
                        });
                    }
                }
            }
        }
        return cells;
    }

    // ------------------- DOCUMENT + TILE STRUCTURE ---------------------

    function createPatternDocument() {
        var doc = app.documents.add(DocumentColorSpace.RGB, TILE, TILE);
        try { doc.rasterEffectSettings.resolution = 72; } catch (e) { /* default */ }
        try { doc.artboards[0].artboardRect = [0, TILE, TILE, 0]; } catch (e) { /* default */ }
        return doc;
    }

    function buildTileStructure(doc, bgHex) {
        var layer = doc.layers.add();
        layer.name = 'Pattern';

        var clipGroup = layer.groupItems.add();
        clipGroup.name = 'PatternTile';

        var bg = addPath(clipGroup, [[0, 0], [TILE, 0], [TILE, TILE], [0, TILE]], true, bgHex, null, 0);
        bg.name = 'Background';
        bg.zOrder = ZOrderMethod.SENDTOBACK;

        return { layer: layer, clipGroup: clipGroup, clipPath: null, bg: bg };
    }

    // The clipping path is added LAST and brought to the front of the tile
    // group, so it reliably clips every motif added during generation.
    function finalizeTileStructure(structure) {
        var clipPath = addPath(structure.clipGroup, [[0, 0], [TILE, 0], [TILE, TILE], [0, TILE]], true, null, null, 0);
        clipPath.name = 'TileClipPath';
        clipPath.zOrder = ZOrderMethod.BRINGTOFRONT;
        clipPath.clipping = true;
        structure.clipGroup.clipped = true;
        structure.clipPath = clipPath;
        return structure;
    }

    // ---------------------- DESIGN GENERATION --------------------------

    function generateDesignSpec(rng, history, batchStructures, batchPalettes) {
        var category = pick(rng, CATEGORIES);
        var style = STYLES[category];
        var composition = pick(rng, style.compositions);
        var density = pick(rng, DENSITIES);
        var scheme = pick(rng, style.schemes);

        var motifTypes = shuffle(rng, style.motifs).slice(0, rndInt(rng, 1, 3));
        var structureKey = category + '|' + composition + '|' + motifTypes.slice().sort().join(',') + '|' + density;

        var attempt = 0;
        while ((history.structureUsedCount(structureKey) > 0 || inArray(batchStructures, structureKey)) && attempt < 40) {
            category = pick(rng, CATEGORIES);
            style = STYLES[category];
            composition = pick(rng, style.compositions);
            density = pick(rng, DENSITIES);
            scheme = pick(rng, style.schemes);
            motifTypes = shuffle(rng, style.motifs).slice(0, rndInt(rng, 1, 3));
            structureKey = category + '|' + composition + '|' + motifTypes.slice().sort().join(',') + '|' + density;
            attempt++;
        }

        var fgColors = null, paletteKey = '', bg = '', attempt2 = 0;
        while (attempt2 < 60) {
            fgColors = buildPalette(scheme, rng);
            paletteKey = fgColors.slice().sort().join(',');
            bg = selectBackground(scheme, fgColors, rng);
            if (!history.paletteUsed(bg, paletteKey) && !inArray(batchPalettes, bg + paletteKey)) break;
            attempt2++;
        }

        var fingerprint = [
            'v1', category, composition, density, scheme, bg, paletteKey,
            motifTypes.slice().sort().join(','),
            'sf' + Math.round(rndRange(rng, 0, 100))
        ].join('|');

        return {
            category: category,
            composition: composition,
            density: density,
            scheme: scheme,
            motifTypes: motifTypes,
            structureKey: structureKey,
            palette: fgColors,
            background: bg,
            paletteKey: paletteKey,
            fingerprint: fingerprint,
            sizeFactor: rndRange(rng, style.sizeFactor[0], style.sizeFactor[1]),
            rotRange: style.rotation,
            seed: Math.floor(rng() * 2147483647)
        };
    }

    function buildPattern(doc, spec) {
        var rng = makeRng(spec.seed);
        var stats = { motifInstances: 0, wrappedCopies: 0, wrappedMotifs: 0 };
        var structure = buildTileStructure(doc, spec.background);
        var ctx = {
            layer: structure.layer,
            clipGroup: structure.clipGroup,
            palette: spec.palette,
            bg: spec.background,
            rng: rng,
            stats: stats
        };

        var baseCell = TILE / (spec.density === 'DENSE' ? rndInt(rng, 7, 9)
            : (spec.density === 'SPARSE' ? rndInt(rng, 3, 4) : rndInt(rng, 5, 6)));
        var cell = baseCell * spec.sizeFactor;

        var cells = buildComposition(spec.composition, spec.density, cell, rng);
        var makers = [];
        for (var i = 0; i < spec.motifTypes.length; i++) makers.push(resolveMotif(spec.motifTypes[i]));

        for (var c = 0; c < cells.length; c++) {
            var cd = cells[c];
            var maker = makers[cd.variant % makers.length];
            var jitter = spec.composition === 'SCATTERED' ? cd.cell * 0.18 : cd.cell * 0.05;
            var noJitter = (spec.composition === 'STRAIGHT_GRID' || spec.composition === 'ALTERNATING');
            var jx = noJitter ? 0 : rndRange(rng, -jitter, jitter);
            var jy = noJitter ? 0 : rndRange(rng, -jitter, jitter);
            var size = cd.cell * rndRange(rng, 0.72, 1.0);
            var rot = spec.rotRange[1] > 0
                ? rndRange(rng, spec.rotRange[0], spec.rotRange[1]) * (rng() < 0.5 ? -1 : 1)
                : 0;
            placeWrapped(ctx, maker, cd.x + jx, cd.y + jy, size, { rot: rot });
        }

        return { structure: structure, stats: stats, cells: cells.length };
    }

    // ------------------------ QUALITY CONTROL --------------------------

    function validateDesign(doc, spec, buildResult) {
        var issues = [];

        var ab = doc.artboards[0].artboardRect; // [left, top, right, bottom]
        if (Math.abs(ab[0]) > 0.01 || Math.abs(ab[1] - TILE) > 0.01 ||
            Math.abs(ab[2] - TILE) > 0.01 || Math.abs(ab[3]) > 0.01) {
            issues.push('Artboard is not exactly 4000 x 4000: [' + ab.join(', ') + ']');
        }

        if (doc.documentColorSpace !== DocumentColorSpace.RGB) {
            issues.push('Document is not RGB.');
        }

        if (buildResult.structure.layer.groupItems.length < 1) {
            issues.push('Missing pattern tile group.');
        }

        var bb = buildResult.structure.bg.geometricBounds;
        if (Math.abs(bb[0]) > 0.01 || Math.abs(bb[1]) > 0.01 ||
            Math.abs(bb[2] - TILE) > 0.01 || Math.abs(bb[3] - TILE) > 0.01) {
            issues.push('Background does not cover the full artboard.');
        }

        var cb = buildResult.structure.clipPath.geometricBounds;
        if (Math.abs(cb[0]) > 0.01 || Math.abs(cb[1]) > 0.01 ||
            Math.abs(cb[2] - TILE) > 0.01 || Math.abs(cb[3] - TILE) > 0.01) {
            issues.push('Clipping path does not match the artboard.');
        }
        if (!buildResult.structure.clipGroup.clipped) {
            issues.push('Tile group is not clipped.');
        }

        if (buildResult.stats.motifInstances < buildResult.cells) {
            issues.push('Motif instance count mismatch (expected at least ' + buildResult.cells + ').');
        }
        if (buildResult.stats.wrappedMotifs > 0 &&
            buildResult.stats.wrappedCopies < buildResult.stats.wrappedMotifs) {
            issues.push('Edge-wrapping verification failed: wrapped motifs=' +
                buildResult.stats.wrappedMotifs + ', wrapped copies=' + buildResult.stats.wrappedCopies);
        }

        return issues;
    }

    // Temporary 3x3 tiled test: duplicates the finished tile into a scratch
    // document, arranges 9 copies at exact multiples of the tile size, and
    // verifies each copy landed on its expected offset. This is a geometric
    // verification only - it does not claim visual inspection.
    function verifyTiling3x3(doc, sourceGroup, log) {
        var tempDoc = null;
        try {
            var baseBounds = sourceGroup.geometricBounds; // [l, t, r, b]
            tempDoc = app.documents.add(DocumentColorSpace.RGB, TILE * 3, TILE * 3);
            var tLayer = tempDoc.layers[0];
            var placed = 0;
            for (var r = 0; r < 3; r++) {
                for (var c = 0; c < 3; c++) {
                    var copy = sourceGroup.duplicate(tLayer, ElementPlacement.PLACEATEND);
                    copy.translate(c * TILE, r * TILE);
                    var pb = copy.geometricBounds;
                    if (Math.abs(pb[0] - (baseBounds[0] + c * TILE)) > 1 ||
                        Math.abs(pb[1] - (baseBounds[1] + r * TILE)) > 1 ||
                        Math.abs(pb[2] - (baseBounds[2] + c * TILE)) > 1 ||
                        Math.abs(pb[3] - (baseBounds[3] + r * TILE)) > 1) {
                        log.push('3x3 copy at row ' + r + ', col ' + c + ': offset mismatch');
                    }
                    placed++;
                }
            }
            if (placed !== 9) log.push('3x3 test placed ' + placed + ' of 9 copies');
            tempDoc.close(SaveOptions.DONOTSAVECHANGES);
            return placed === 9;
        } catch (e) {
            if (tempDoc) {
                try { tempDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) { /* ignore */ }
            }
            log.push('3x3 tiling test skipped: ' + e.message);
            return true; // non-fatal; numeric wrap verification already ran
        }
    }

    // ------------------------- EPS EXPORT ------------------------------

    function makeEpsOptions() {
        var opts = new EPSSaveOptions();
        try { opts.preview = EPSPreview.COLORTIFF; } catch (e) { /* default */ }
        try { opts.compatibility = Compatibility.ILLUSTRATOR17; } catch (e) {
            try { opts.compatibility = Compatibility.ILLUSTRATOR15; } catch (e2) { /* default */ }
        }
        try { opts.embedAllFonts = false; } catch (e) { /* default */ }
        try { opts.embedLinkedFiles = true; } catch (e) { /* default */ }
        try { opts.saveMultipleArtboards = false; } catch (e) { /* default */ }
        return opts;
    }

    function nextExportIndex(folder, history) {
        var maxIdx = history.lastIndex();
        var files = folder.getFiles('*' + EPS_EXT);
        for (var i = 0; i < files.length; i++) {
            var m = files[i].name.match(/^Pattern_(\d+)\.eps$/i);
            if (m) {
                var n = parseInt(m[1], 10);
                if (n > maxIdx) maxIdx = n;
            }
        }
        return maxIdx + 1;
    }

    function exportEps(doc, folder, index) {
        var file = new File(folder.fsName + '/Pattern_' + pad4(index) + EPS_EXT);
        var safety = 0;
        while (file.exists && safety < 10000) {
            index++;
            file = new File(folder.fsName + '/Pattern_' + pad4(index) + EPS_EXT);
            safety++;
        }
        doc.saveAs(file, makeEpsOptions());
        if (!file.exists) throw new Error('EPS export failed: ' + file.fsName);
        return { file: file, index: index };
    }

    // ---------------------- BATCH GENERATION ---------------------------

    function generateBatch(folder, progress) {
        var savedInteraction = null;
        try { savedInteraction = app.userInteractionLevel; } catch (e) { /* ignore */ }
        try { app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS; } catch (e) { /* ignore */ }

        var exported = [];
        var log = [];
        try {
            History.init();
            var startIdx = nextExportIndex(folder, History);
            var batchStructures = [];
            var batchPalettes = [];
            var masterRng = makeRng((new Date().getTime()) % 2147483647);

            for (var i = 0; i < BATCH_SIZE; i++) {
                if (progress) progress('Design ' + (i + 1) + ' of ' + BATCH_SIZE + ': composing...', (i / BATCH_SIZE) * 100);

                var spec = generateDesignSpec(masterRng, History, batchStructures, batchPalettes);
                batchStructures.push(spec.structureKey);
                batchPalettes.push(spec.background + spec.paletteKey);

                var doc = createPatternDocument();
                try {
                    var buildResult = buildPattern(doc, spec);
                    finalizeTileStructure(buildResult.structure);

                    var issues = validateDesign(doc, spec, buildResult);
                    var wrapIssues = verifyWrappingInDoc(buildResult.structure.clipGroup);
                    issues = issues.concat(wrapIssues);
                    if (issues.length) throw new Error('Quality control failed: ' + issues.join(' ; '));

                    if (progress) progress('Design ' + (i + 1) + ' of ' + BATCH_SIZE + ': verifying 3x3 tiling...', (i / BATCH_SIZE) * 100);
                    verifyTiling3x3(doc, buildResult.structure.clipGroup, log);

                    if (progress) progress('Design ' + (i + 1) + ' of ' + BATCH_SIZE + ': exporting EPS...', (i / BATCH_SIZE) * 100);
                    var res = exportEps(doc, folder, startIdx);
                    startIdx = res.index + 1;

                    History.addRecord({
                        fingerprint: spec.fingerprint,
                        structureKey: spec.structureKey,
                        category: spec.category,
                        composition: spec.composition,
                        density: spec.density,
                        colorScheme: spec.scheme,
                        palette: spec.palette,
                        paletteKey: spec.paletteKey,
                        background: spec.background,
                        motifTypes: spec.motifTypes,
                        seed: spec.seed,
                        generatedAt: new Date().toString(),
                        filename: res.file.name
                    });
                    History.setLastIndex(res.index);
                    exported.push(res.file);
                } finally {
                    try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) { /* ignore */ }
                }
            }

            // History is persisted only after all exports succeeded.
            History.save();
        } finally {
            try {
                if (savedInteraction !== null) app.userInteractionLevel = savedInteraction;
            } catch (e) { /* ignore */ }
        }

        return { files: exported, log: log, total: History.count() };
    }

    // ------------------------- USER INTERFACE --------------------------

    function pickOutputFolder(current) {
        var start = current ? new Folder(current) : Folder.myDocuments;
        if (!start.exists) start = Folder.myDocuments;
        var f = Folder.selectDialog('Select the output folder for EPS patterns', start);
        return f ? f.fsName : null;
    }

    function buildUi() {
        History.init();

        var win = new Window('palette', SCRIPT_NAME + '  v' + VERSION);
        win.orientation = 'column';
        win.alignChildren = ['fill', 'top'];
        win.spacing = 8;
        win.margins = 16;

        var folderGroup = win.add('group');
        folderGroup.orientation = 'row';
        folderGroup.alignChildren = ['left', 'center'];
        var folderLabel = folderGroup.add('statictext', undefined, 'Output folder:');
        var folderText = folderGroup.add('edittext', undefined, History.lastFolder());
        folderText.characters = 30;
        var browseBtn = folderGroup.add('button', undefined, 'Browse...');

        var genBtn = win.add('button', undefined, 'Generate 5 EPS Patterns');
        genBtn.preferredSize.height = 34;

        var histText = win.add('statictext', undefined,
            'History: ' + History.count() + ' pattern(s) generated  |  DB: ' +
            (History.path.exists ? 'OK' : 'new'));
        var statusText = win.add('statictext', undefined, 'Ready.');
        statusText.characters = 46;

        var progress = win.add('progressbar', undefined, 0, 100);
        progress.preferredSize.width = 340;

        browseBtn.onClick = function () {
            var f = pickOutputFolder(folderText.text);
            if (f) {
                folderText.text = f;
                History.setLastFolder(f);
                History.save();
            }
        };

        genBtn.onClick = function () {
            var folder = folderText.text;
            if (!folder) {
                var picked = pickOutputFolder('');
                if (!picked) { statusText.text = 'No output folder selected.'; return; }
                folder = picked;
                folderText.text = folder;
            }
            var outFolder = new Folder(folder);
            if (!outFolder.exists) {
                if (!outFolder.create()) { statusText.text = 'Cannot create output folder.'; return; }
            }
            History.setLastFolder(outFolder.fsName);
            History.save();

            genBtn.enabled = false;
            browseBtn.enabled = false;
            try {
                var result = generateBatch(outFolder, function (msg, pct) {
                    statusText.text = msg;
                    progress.value = pct;
                    win.update();
                });
                progress.value = 100;
                statusText.text = 'Done: ' + result.files.length + ' EPS file(s) exported.';
                histText.text = 'History: ' + result.total + ' pattern(s) generated  |  DB: OK';
                var names = [];
                for (var i = 0; i < result.files.length; i++) names.push(result.files[i].name);
                alert(SCRIPT_NAME + '\n\nExported:\n' + names.join('\n') +
                    (result.log.length ? '\n\nNotes:\n' + result.log.join('\n') : ''));
            } catch (e) {
                statusText.text = 'Error: ' + e.message;
                alert(SCRIPT_NAME + ' - error\n\n' + e.message +
                    '\n\nPreviously exported files and history are preserved.');
            } finally {
                genBtn.enabled = true;
                browseBtn.enabled = true;
                win.update();
            }
        };

        win.center();
        win.show();
    }

    // --------------------------- ENTRY POINT ---------------------------

    buildUi();

})();
