#target illustrator

/*
    Long-Term Unique Gradient Generator
    ===================================
    Generates 5 EPS files per run. Each EPS contains 8 rounded rectangles
    (2 columns x 4 rows) filled with unique metallic gradients that all
    belong to one algorithmically generated color family.

    Duplicate prevention: persistent Color_History.json stored next to this
    script (fingerprint index + perceptual distance checks on recent work).

    Target: Adobe Illustrator 2025, Windows 11. ExtendScript (ES3) only.
*/

(function () {

    var SCRIPT_FILE = new File($.fileName);
    var SCRIPT_FOLDER = SCRIPT_FILE.parent;

    // =====================================================================
    // PURE-BEGIN (no Illustrator API dependency - safe to unit test)
    // =====================================================================

    var CFG = {
        COLS: 2,
        ROWS: 4,
        RECTS: 8,
        RECT_W: 260,
        RECT_H: 118,
        RADIUS: 18,
        GAP_X: 26,
        GAP_Y: 22,
        MARGIN: 42,
        FILES_PER_RUN: 5,
        HISTORY_FILE: 'Color_History.json',
        BACKUP_FILE: 'Color_History.backup.json',
        TMP_FILE: 'Color_History.tmp.json',
        RECENT_CAP: 250,
        MIN_PALETTE_DISTANCE: 20,
        MIN_DISTANCE_FLOOR: 12,
        MAX_FAMILY_ATTEMPTS: 120,
        FILE_PREFIX: 'Design_'
    };

    var ART_W = CFG.MARGIN * 2 + CFG.COLS * CFG.RECT_W + (CFG.COLS - 1) * CFG.GAP_X;
    var ART_H = CFG.MARGIN * 2 + CFG.ROWS * CFG.RECT_H + (CFG.ROWS - 1) * CFG.GAP_Y;

    function clamp(v, lo, hi) {
        if (v < lo) return lo;
        if (v > hi) return hi;
        return v;
    }

    function rnd(lo, hi) {
        return lo + Math.random() * (hi - lo);
    }

    function rndInt(lo, hi) {
        return Math.floor(rnd(lo, hi + 1));
    }

    function norm360(h) {
        h = h % 360;
        if (h < 0) h += 360;
        return h;
    }

    function pad2(n) {
        return (n < 10 ? '0' : '') + n;
    }

    function pad4(n) {
        var s = String(n);
        while (s.length < 4) s = '0' + s;
        return s;
    }

    function timestamp() {
        var d = new Date();
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
            ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    }

    function hslToRgb(h, s, l) {
        h = norm360(h);
        s = clamp(s, 0, 1);
        l = clamp(l, 0, 1);
        var c = (1 - Math.abs(2 * l - 1)) * s;
        var hp = h / 60;
        var x = c * (1 - Math.abs(hp % 2 - 1));
        var r = 0, g = 0, b = 0;
        if (hp < 1) { r = c; g = x; }
        else if (hp < 2) { r = x; g = c; }
        else if (hp < 3) { g = c; b = x; }
        else if (hp < 4) { g = x; b = c; }
        else if (hp < 5) { r = x; b = c; }
        else { r = c; b = x; }
        var m = l - c / 2;
        return [
            Math.round(clamp(r + m, 0, 1) * 255),
            Math.round(clamp(g + m, 0, 1) * 255),
            Math.round(clamp(b + m, 0, 1) * 255)
        ];
    }

    // Perceptually weighted (redmean) RGB distance. Max is roughly 765.
    function colorDistance(c1, c2) {
        var rmean = (c1[0] + c2[0]) / 2;
        var r = c1[0] - c2[0];
        var g = c1[1] - c2[1];
        var b = c1[2] - c2[2];
        return Math.sqrt(
            ((512 + rmean) * r * r) / 256 +
            4 * g * g +
            ((767 - rmean) * b * b) / 256
        );
    }

    // ---------------------------------------------------------------------
    // Minimal JSON engine (ExtendScript has no native JSON object)
    // ---------------------------------------------------------------------

    function jsonEscape(s) {
        var out = '';
        var i, ch, code;
        for (i = 0; i < s.length; i++) {
            ch = s.charAt(i);
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (s.charCodeAt(i) < 32) {
                code = s.charCodeAt(i).toString(16);
                while (code.length < 4) code = '0' + code;
                out += '\\u' + code;
            } else {
                out += ch;
            }
        }
        return out;
    }

    function jsonStringify(value) {
        var i, k, parts, t;
        if (value === null || value === undefined) return 'null';
        t = typeof value;
        if (t === 'number') return isFinite(value) ? String(value) : 'null';
        if (t === 'boolean') return value ? 'true' : 'false';
        if (t === 'string') return '"' + jsonEscape(value) + '"';
        if (value instanceof Array) {
            parts = [];
            for (i = 0; i < value.length; i++) parts.push(jsonStringify(value[i]));
            return '[' + parts.join(',') + ']';
        }
        parts = [];
        for (k in value) {
            if (value.hasOwnProperty(k)) {
                t = typeof value[k];
                if (t !== 'function' && t !== 'undefined') {
                    parts.push('"' + jsonEscape(String(k)) + '":' + jsonStringify(value[k]));
                }
            }
        }
        return '{' + parts.join(',') + '}';
    }

    function jsonParse(text) {
        var pos = 0;

        function fail(msg) {
            throw new Error('JSON parse error at position ' + pos + ': ' + msg);
        }

        function ws() {
            var c;
            while (pos < text.length) {
                c = text.charAt(pos);
                if (c === ' ' || c === '\t' || c === '\n' || c === '\r') pos++;
                else break;
            }
        }

        function peek() {
            ws();
            return text.charAt(pos);
        }

        function parseValue() {
            var c = peek();
            if (c === '{') return parseObject();
            if (c === '[') return parseArray();
            if (c === '"') return parseString();
            if (c === '-' || (c >= '0' && c <= '9')) return parseNumber();
            if (text.substr(pos, 4) === 'true') { pos += 4; return true; }
            if (text.substr(pos, 5) === 'false') { pos += 5; return false; }
            if (text.substr(pos, 4) === 'null') { pos += 4; return null; }
            fail('unexpected character "' + c + '"');
        }

        function parseObject() {
            var obj = {}, key, d;
            pos++;
            if (peek() === '}') { pos++; return obj; }
            while (true) {
                if (peek() !== '"') fail('expected object key');
                key = parseString();
                if (peek() !== ':') fail('expected ":"');
                pos++;
                obj[key] = parseValue();
                d = peek();
                if (d === ',') { pos++; continue; }
                if (d === '}') { pos++; return obj; }
                fail('expected "," or "}"');
            }
        }

        function parseArray() {
            var arr = [], d;
            pos++;
            if (peek() === ']') { pos++; return arr; }
            while (true) {
                arr.push(parseValue());
                d = peek();
                if (d === ',') { pos++; continue; }
                if (d === ']') { pos++; return arr; }
                fail('expected "," or "]"');
            }
        }

        function parseString() {
            var out = '', c, hex;
            pos++;
            while (pos < text.length) {
                c = text.charAt(pos);
                if (c === '"') { pos++; return out; }
                if (c === '\\') {
                    pos++;
                    c = text.charAt(pos);
                    if (c === '"') { out += '"'; pos++; }
                    else if (c === '\\') { out += '\\'; pos++; }
                    else if (c === '/') { out += '/'; pos++; }
                    else if (c === 'n') { out += '\n'; pos++; }
                    else if (c === 'r') { out += '\r'; pos++; }
                    else if (c === 't') { out += '\t'; pos++; }
                    else if (c === 'b') { out += '\b'; pos++; }
                    else if (c === 'f') { out += '\f'; pos++; }
                    else if (c === 'u') {
                        hex = text.substr(pos + 1, 4);
                        if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('bad \\u escape');
                        out += String.fromCharCode(parseInt(hex, 16));
                        pos += 5;
                    } else {
                        fail('bad escape "\\' + c + '"');
                    }
                } else {
                    out += c;
                    pos++;
                }
            }
            fail('unterminated string');
        }

        function parseNumber() {
            var m = text.slice(pos).match(/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/);
            if (!m) fail('bad number');
            pos += m[0].length;
            return parseFloat(m[0]);
        }

        var result = parseValue();
        ws();
        if (pos < text.length) fail('trailing characters');
        return result;
    }

    // ---------------------------------------------------------------------
    // Fingerprinting (hash-indexed exact duplicate prevention)
    // ---------------------------------------------------------------------

    function fnv1a32(str) {
        var hash = 0x811c9dc5;
        for (var i = 0; i < str.length; i++) {
            hash = hash ^ str.charCodeAt(i);
            hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
        }
        return ('0000000' + hash.toString(16)).slice(-8);
    }

    function rectSignature(spec) {
        var parts = [];
        for (var i = 0; i < spec.stops.length; i++) {
            parts.push(Math.round(spec.stops[i].p) + ':' + spec.stops[i].r + ',' + spec.stops[i].g + ',' + spec.stops[i].b);
        }
        return parts.join('|');
    }

    function paletteFingerprint(rects) {
        var sigs = [];
        for (var i = 0; i < rects.length; i++) sigs.push(rectSignature(rects[i]));
        var fp = sigs.join('#');
        return { fp: fp, hash: fnv1a32(fp) };
    }

    // ---------------------------------------------------------------------
    // Gradient palette generation (metallic, single color family)
    // ---------------------------------------------------------------------

    function makeGradientSpec(hue, sat) {
        var hiPos = rnd(25, 68);
        var hiL = rnd(0.80, 0.93);
        var edgeL1 = rnd(0.16, 0.30);
        var edgeL2 = clamp(edgeL1 + rnd(-0.06, 0.06), 0.14, 0.32);
        var spread = Math.max(hiPos, 100 - hiPos);
        var curve = rnd(0.8, 1.5);
        var nMid = rndInt(0, 2);
        var positions = [0, hiPos, 100];
        var i, j, p;

        for (i = 0; i < nMid; i++) {
            if (Math.random() < hiPos / 100) {
                positions.push(clamp(rnd(6, hiPos - 8), 4, hiPos - 6));
            } else {
                positions.push(clamp(rnd(hiPos + 8, 94), hiPos + 6, 96));
            }
        }
        positions.sort(function (a, b) { return a - b; });
        var kept = [positions[0]];
        for (j = 1; j < positions.length; j++) {
            p = positions[j];
            var essential = (p === 0 || p === 100 || Math.abs(p - hiPos) < 0.5);
            if (!essential && (p - kept[kept.length - 1] < 5 || p > 97)) continue;
            kept.push(p);
        }
        positions = kept;

        var stops = [];
        for (i = 0; i < positions.length; i++) {
            p = positions[i];
            var l, sj;
            if (p === 0) {
                l = clamp(edgeL1 + rnd(-0.02, 0.02), 0.12, 0.36);
                sj = clamp(sat + rnd(0, 0.10), 0.15, 0.85);
            } else if (p === 100) {
                l = clamp(edgeL2 + rnd(-0.02, 0.02), 0.12, 0.36);
                sj = clamp(sat + rnd(0, 0.10), 0.15, 0.85);
            } else if (Math.abs(p - hiPos) < 0.5) {
                l = clamp(hiL + rnd(-0.015, 0.015), 0.75, 0.96);
                sj = clamp(sat * rnd(0.45, 0.70), 0.10, 0.65);
            } else {
                var d = Math.abs(p - hiPos) / spread;
                l = clamp(hiL - (hiL - edgeL1) * Math.pow(d, curve) + rnd(-0.03, 0.03), 0.14, 0.94);
                sj = clamp(sat + (d * 0.15 - 0.05) + rnd(-0.06, 0.06), 0.14, 0.85);
            }
            var rgb = hslToRgb(hue + rnd(-6, 6), sj, l);
            stops.push({ p: p, r: rgb[0], g: rgb[1], b: rgb[2] });
        }
        return { stops: stops, hiPos: Math.round(hiPos) };
    }

    function makeRectSpecs(fam) {
        var specs = [];
        for (var i = 0; i < CFG.RECTS; i++) {
            var h = norm360(fam.hue + fam.spread * ((i / (CFG.RECTS - 1)) - 0.5) * 2 + rnd(-7, 7));
            var s = clamp(fam.sat + rnd(-0.07, 0.07), 0.22, 0.78);
            specs.push(makeGradientSpec(h, s));
        }
        return specs;
    }

    function rectsAreDistinct(rects) {
        var seen = {};
        for (var i = 0; i < rects.length; i++) {
            var sig = rectSignature(rects[i]);
            if (seen[sig]) return false;
            seen[sig] = true;
        }
        return true;
    }

    function makeFamily() {
        var tries = 0;
        var fam;
        while (tries < 20) {
            tries++;
            fam = {
                hue: rnd(0, 360),
                sat: rnd(0.34, 0.68),
                light: rnd(0.44, 0.60),
                spread: rnd(5, 16) * (Math.random() < 0.5 ? -1 : 1)
            };
            fam.rects = makeRectSpecs(fam);
            if (!rectsAreDistinct(fam.rects)) continue;
            fam.reps = [
                hslToRgb(fam.hue, fam.sat, fam.light),
                hslToRgb(fam.hue, Math.min(fam.sat * 0.7, 0.8), Math.min(fam.light + 0.32, 0.95)),
                hslToRgb(fam.hue, fam.sat, Math.max(fam.light - 0.22, 0.05))
            ];
            var fpr = paletteFingerprint(fam.rects);
            fam.fp = fpr.fp;
            fam.hash = fpr.hash;
            return fam;
        }
        throw new Error('Could not build a distinct 8-rectangle palette.');
    }

    function familyDistance(famA, famB) {
        var total = 0;
        for (var i = 0; i < 3; i++) total += colorDistance(famA.reps[i], famB.reps[i]);
        return total / 3;
    }

    function sampleStops(stops, pos) {
        if (pos <= stops[0].p) return stops[0];
        if (pos >= stops[stops.length - 1].p) return stops[stops.length - 1];
        for (var i = 1; i < stops.length; i++) {
            if (pos <= stops[i].p) {
                var a = stops[i - 1];
                var b = stops[i];
                var t = (pos - a.p) / (b.p - a.p);
                return {
                    p: pos,
                    r: Math.round(a.r + (b.r - a.r) * t),
                    g: Math.round(a.g + (b.g - a.g) * t),
                    b: Math.round(a.b + (b.b - a.b) * t)
                };
            }
        }
        return stops[stops.length - 1];
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            CFG: CFG,
            clamp: clamp,
            hslToRgb: hslToRgb,
            colorDistance: colorDistance,
            jsonStringify: jsonStringify,
            jsonParse: jsonParse,
            fnv1a32: fnv1a32,
            rectSignature: rectSignature,
            paletteFingerprint: paletteFingerprint,
            makeGradientSpec: makeGradientSpec,
            makeFamily: makeFamily,
            familyDistance: familyDistance,
            sampleStops: sampleStops,
            timestamp: timestamp,
            pad4: pad4
        };
    }

    // =====================================================================
    // PURE-END
    // =====================================================================

    // ---------------------------------------------------------------------
    // Persistent history database (Color_History.json, next to this script)
    // ---------------------------------------------------------------------

    var History = {
        folder: null,
        file: null,
        backup: null,
        tmp: null,
        data: null,

        init: function (folder) {
            this.folder = folder;
            this.file = new File(folder.fsName + '/' + CFG.HISTORY_FILE);
            this.backup = new File(folder.fsName + '/' + CFG.BACKUP_FILE);
            this.tmp = new File(folder.fsName + '/' + CFG.TMP_FILE);
            this.load();
        },

        freshData: function () {
            return {
                version: 1,
                created: timestamp(),
                totalDesigns: 0,
                fingerprints: {},
                recent: [],
                lastOutputFolder: ''
            };
        },

        readJson: function (file) {
            if (!file.exists) return null;
            file.encoding = 'UTF-8';
            if (!file.open('r')) return null;
            var text = file.read();
            file.close();
            if (!text || text.charAt(0) !== '{') return null;
            return jsonParse(text);
        },

        quarantine: function (file) {
            try {
                var q = new File(file.fsName + '.corrupt-' + timestamp().replace(/[: ]/g, '-'));
                file.copy(q.fsName);
            } catch (e) {}
        },

        load: function () {
            var data = null;
            try { data = this.readJson(this.file); } catch (eMain) { data = null; }
            if (data === null && this.backup.exists) {
                try { data = this.readJson(this.backup); } catch (eBak) { data = null; }
            }
            if (data === null) {
                if (this.file.exists) this.quarantine(this.file);
                if (this.backup.exists) this.quarantine(this.backup);
                data = this.freshData();
                this.data = data;
                this.save();
            }
            if (typeof data.totalDesigns !== 'number' || isNaN(data.totalDesigns)) data.totalDesigns = 0;
            if (!data.fingerprints || typeof data.fingerprints !== 'object') data.fingerprints = {};
            if (!(data.recent instanceof Array)) data.recent = [];
            this.data = data;
        },

        save: function () {
            var text;
            try {
                text = jsonStringify(this.data);
            } catch (eSer) {
                throw new Error('Could not serialize history data: ' + eSer.message);
            }

            if (this.file.exists) {
                try {
                    if (this.backup.exists) this.backup.remove();
                    this.file.copy(this.backup.fsName);
                } catch (eBak) {}
            }

            this.tmp.encoding = 'UTF-8';
            if (!this.tmp.open('w')) {
                throw new Error('Cannot write history file: ' + this.tmp.error);
            }
            this.tmp.write(text);
            this.tmp.close();

            var check = null;
            try { check = this.readJson(this.tmp); } catch (eVer) { check = null; }
            if (check === null) {
                try { this.tmp.remove(); } catch (eDel) {}
                throw new Error('History verification failed; existing history was preserved.');
            }

            if (this.file.exists) {
                try { this.file.remove(); } catch (eRem) {}
            }
            if (!this.tmp.copy(this.file.fsName)) {
                throw new Error('Could not replace history file: ' + this.tmp.error);
            }
            try { this.tmp.remove(); } catch (eCls) {}
        },

        hasFingerprint: function (hash, fp) {
            return this.data.fingerprints[hash] === fp;
        },

        paletteTooSimilar: function (fam, minDistance) {
            var recent = this.data.recent;
            for (var i = 0; i < recent.length; i++) {
                if (recent[i] && recent[i].reps && familyDistance(fam, recent[i]) < minDistance) {
                    return true;
                }
            }
            return false;
        },

        addDesign: function (fam, epsFile, outFolder) {
            var d = this.data;
            d.fingerprints[fam.hash] = fam.fp;
            d.totalDesigns = (d.totalDesigns || 0) + 1;
            d.recent.push({
                hash: fam.hash,
                hue: Math.round(fam.hue * 10) / 10,
                reps: fam.reps,
                file: epsFile.name,
                folder: outFolder.fsName,
                date: timestamp()
            });
            if (d.recent.length > CFG.RECENT_CAP) {
                d.recent.splice(0, d.recent.length - CFG.RECENT_CAP);
            }
            d.lastOutputFolder = outFolder.fsName;
            this.save();
        },

        total: function () {
            return this.data.totalDesigns || 0;
        }
    };

    // ---------------------------------------------------------------------
    // Illustrator document building
    // ---------------------------------------------------------------------

    function makeRGB(rgb) {
        var c = new RGBColor();
        c.red = rgb[0];
        c.green = rgb[1];
        c.blue = rgb[2];
        return c;
    }

    function roundedRectPath(parent, left, top, w, h, r, yDir) {
        var K = 0.5522847498;
        var kr = K * r;
        var R = left + w;
        var bot = top + yDir * h;
        var P = [
            [left + r, top],
            [R - r, top],
            [R, top + yDir * r],
            [R, bot - yDir * r],
            [R - r, bot],
            [left + r, bot],
            [left, bot - yDir * r],
            [left, top + yDir * r]
        ];
        var dirs = [
            [1, 0], [1, 0], [0, yDir], [0, yDir],
            [-1, 0], [-1, 0], [0, -yDir], [0, -yDir]
        ];
        var item = parent.pathItems.add();
        item.closed = true;
        item.stroked = false;
        item.filled = true;
        for (var i = 0; i < 8; i++) {
            var pt = item.pathPoints.add();
            var a = P[i];
            var inH = [a[0], a[1]];
            var outH = [a[0], a[1]];
            if (((i + 7) % 8) % 2 === 1) {
                inH = [a[0] - dirs[i][0] * kr, a[1] - dirs[i][1] * kr];
            }
            if ((i % 2) === 1) {
                outH = [a[0] + dirs[i][0] * kr, a[1] + dirs[i][1] * kr];
            }
            pt.anchor = a;
            pt.leftDirection = inH;
            pt.rightDirection = outH;
        }
        return item;
    }

    function applyGradient(doc, item, spec, name) {
        var grad = doc.gradients.add();
        grad.name = name;
        grad.type = GradientType.LINEAR;
        var gs = grad.gradientStops;
        while (gs.length > spec.stops.length) {
            try { gs[gs.length - 1].remove(); } catch (eRem) { break; }
        }
        while (gs.length < spec.stops.length) {
            try { gs.add(); } catch (eAdd) { break; }
        }
        var i, st;
        if (gs.length === spec.stops.length) {
            for (i = 0; i < gs.length; i++) {
                st = spec.stops[i];
                gs[i].color = makeRGB([st.r, st.g, st.b]);
                gs[i].rampPoint = clamp(st.p, 0, 100);
                gs[i].midPoint = 50;
                gs[i].opacity = 100;
            }
        } else {
            for (i = 0; i < gs.length; i++) {
                var pos = gs.length === 1 ? 0 : (i / (gs.length - 1)) * 100;
                st = sampleStops(spec.stops, pos);
                gs[i].color = makeRGB([st.r, st.g, st.b]);
                gs[i].rampPoint = pos;
                gs[i].midPoint = 50;
                gs[i].opacity = 100;
            }
        }
        item.fillColor = grad;
        return grad;
    }

    function newDocument() {
        var preset = new DocumentPreset();
        preset.width = ART_W;
        preset.height = ART_H;
        preset.colorMode = DocumentColorMode.RGB;
        try { preset.units = RulerUnits.Pixels; } catch (eU) {}
        try { return app.documents.addDocument('Print', preset); } catch (e1) {}
        try { return app.documents.add(preset); } catch (e2) {}
        return app.documents.add();
    }

    function buildDocument(fam, designNumber) {
        var doc = newDocument();
        var ab = doc.artboards[0].artboardRect;
        var yUp = ab[1] > ab[3];
        var L = Math.min(ab[0], ab[2]);
        var T = yUp ? Math.max(ab[1], ab[3]) : Math.min(ab[1], ab[3]);
        var yDir = yUp ? -1 : 1;

        var bg = doc.pathItems.rectangle(T, L, ART_W, ART_H);
        bg.name = 'Background';
        bg.stroked = false;
        bg.filled = true;
        bg.fillColor = makeRGB([255, 255, 255]);
        bg.locked = true;

        var m = CFG.MARGIN;
        var w = CFG.RECT_W;
        var h = CFG.RECT_H;
        for (var row = 0; row < CFG.ROWS; row++) {
            for (var col = 0; col < CFG.COLS; col++) {
                var idx = row * CFG.COLS + col;
                var left = L + m + col * (w + CFG.GAP_X);
                var top = T + yDir * (m + row * (h + CFG.GAP_Y));
                var item = roundedRectPath(doc, left, top, w, h, CFG.RADIUS, yDir);
                item.name = 'Gradient_' + (idx + 1);
                applyGradient(doc, item, fam.rects[idx], 'LTG_' + pad4(designNumber) + '_' + (idx + 1));
            }
        }
        app.redraw();
        return doc;
    }

    function makeEpsOptions() {
        var o = new EPSSaveOptions();
        try {
            if (Compatibility && Compatibility.ILLUSTRATOR17 !== undefined) {
                o.compatibility = Compatibility.ILLUSTRATOR17;
            }
        } catch (e17) {
            try {
                if (Compatibility.ILLUSTRATOR15 !== undefined) {
                    o.compatibility = Compatibility.ILLUSTRATOR15;
                }
            } catch (e15) {}
        }
        try { o.embedAllFonts = false; } catch (e1) {}
        try { o.embedLinkedFiles = false; } catch (e2) {}
        try { o.includeDocumentThumbnails = true; } catch (e3) {}
        try { o.postScript = EPSPostScriptLevelEnum.LEVEL2; } catch (e4) {}
        return o;
    }

    function exportEps(doc, epsFile) {
        doc.saveAs(epsFile, makeEpsOptions());
        return epsFile.exists;
    }

    function defaultOutputFolder() {
        var f = new Folder(SCRIPT_FOLDER.fsName + '/Output');
        if (!f.exists) {
            if (!f.create()) {
                throw new Error('Cannot create output folder: ' + f.fsName);
            }
        }
        return f;
    }

    function nextFileNumber(folder) {
        var max = 0;
        var files = folder.getFiles(CFG.FILE_PREFIX + '*.eps');
        for (var i = 0; i < files.length; i++) {
            var m = files[i].name.match(new RegExp('^' + CFG.FILE_PREFIX + '(\\d+)\\.eps$', 'i'));
            if (m) {
                var n = parseInt(m[1], 10);
                if (n > max) max = n;
            }
        }
        return max + 1;
    }

    // ---------------------------------------------------------------------
    // Generation controller
    // ---------------------------------------------------------------------

    function pickUniqueFamilies(count) {
        var chosen = [];
        var attempts = 0;
        var limit = CFG.MAX_FAMILY_ATTEMPTS * count;
        while (chosen.length < count && attempts < limit) {
            attempts++;
            var relax = attempts > limit / 2 ? (attempts - limit / 2) / (limit / 2) : 0;
            var minDistance = CFG.MIN_PALETTE_DISTANCE +
                (CFG.MIN_DISTANCE_FLOOR - CFG.MIN_PALETTE_DISTANCE) * relax;
            var fam = makeFamily();
            if (History.hasFingerprint(fam.hash, fam.fp)) continue;
            if (History.paletteTooSimilar(fam, minDistance)) continue;
            var tooClose = false;
            for (var i = 0; i < chosen.length; i++) {
                if (chosen[i].hash === fam.hash && chosen[i].fp === fam.fp) { tooClose = true; break; }
                if (familyDistance(chosen[i], fam) < minDistance) { tooClose = true; break; }
            }
            if (tooClose) continue;
            chosen.push(fam);
        }
        if (chosen.length < count) {
            throw new Error('Could not find ' + count + ' unique color families after ' +
                attempts + ' attempts. Run the generator again; the space of new ' +
                'combinations is still very large.');
        }
        return chosen;
    }

    function runGeneration(statusFn) {
        var outFolder = state.outputFolder;
        if (!outFolder || !outFolder.exists) outFolder = defaultOutputFolder();

        statusFn('Checking color history for unused palettes...');
        var fams = pickUniqueFamilies(CFG.FILES_PER_RUN);

        var startNum = nextFileNumber(outFolder);
        var exported = [];
        var doc = null;
        try {
            for (var i = 0; i < fams.length; i++) {
                var num = startNum + i;
                var epsFile = new File(outFolder.fsName + '/' + CFG.FILE_PREFIX + pad4(num) + '.eps');
                statusFn('Building design ' + (i + 1) + ' of ' + fams.length + ' (' + epsFile.name + ')...');
                doc = buildDocument(fams[i], num);
                statusFn('Exporting ' + epsFile.name + '...');
                var ok = exportEps(doc, epsFile);
                try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
                doc = null;
                if (!ok) throw new Error('EPS export failed for ' + epsFile.name);
                History.addDesign(fams[i], epsFile, outFolder);
                exported.push(epsFile.name);
            }
        } catch (err) {
            if (doc) {
                try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose2) {}
            }
            throw err;
        }
        return exported;
    }

    var state = {
        outputFolder: null
    };

    // ---------------------------------------------------------------------
    // User interface
    // ---------------------------------------------------------------------

    function buildUI() {
        var win = new Window('dialog', 'Long-Term Unique Gradient Generator');
        win.orientation = 'column';
        win.alignChildren = ['fill', 'top'];
        win.spacing = 10;
        win.margins = 16;

        win.add('statictext', undefined, 'Generates 5 EPS files per run. Each EPS contains 8 rounded rectangles');
        win.add('statictext', undefined, '(2 x 4 grid) with unique metallic gradients from one color family.');

        var folderPanel = win.add('panel', undefined, 'Output folder');
        folderPanel.orientation = 'column';
        folderPanel.alignChildren = ['fill', 'top'];
        folderPanel.margins = 12;
        folderPanel.spacing = 6;
        var folderText = folderPanel.add('statictext', undefined, '', { truncate: 'middle' });
        var browseBtn = folderPanel.add('button', undefined, 'Choose output folder...');

        var statsPanel = win.add('panel', undefined, 'Status');
        statsPanel.orientation = 'column';
        statsPanel.alignChildren = ['fill', 'top'];
        statsPanel.margins = 12;
        statsPanel.spacing = 6;
        var totalText = statsPanel.add('statictext', undefined, '');
        var historyText = statsPanel.add('statictext', undefined, '');
        var statusText = statsPanel.add('statictext', undefined, 'Ready.');

        var genBtn = win.add('button', undefined, 'Generate 5 EPS Files');
        var closeBtn = win.add('button', undefined, 'Close');

        function setStatus(msg) {
            statusText.text = msg;
            win.update();
        }

        function refreshStats() {
            folderText.text = state.outputFolder.fsName;
            totalText.text = 'Total previously generated designs: ' + History.total();
            historyText.text = 'History database: ' + History.file.fsName +
                ' (' + (History.file.exists ? 'OK' : 'will be created on first run') + ')';
        }

        browseBtn.onClick = function () {
            var f = Folder.selectDialog('Select the output folder for EPS files');
            if (f) {
                state.outputFolder = f;
                refreshStats();
            }
        };

        genBtn.onClick = function () {
            try {
                genBtn.enabled = false;
                var files = runGeneration(setStatus);
                var msg = 'Generation complete.\n\n' + files.join('\n') +
                    '\n\nTotal designs generated so far: ' + History.total();
                setStatus('Done. ' + files.length + ' EPS files generated in ' + state.outputFolder.fsName);
                alert(msg);
                refreshStats();
            } catch (e) {
                setStatus('Error: ' + e.message);
                alert('Generation failed:\n\n' + e.message);
            } finally {
                genBtn.enabled = true;
            }
        };

        closeBtn.onClick = function () {
            win.close();
        };

        refreshStats();
        win.center();
        win.show();
    }

    // ---------------------------------------------------------------------
    // Entry point
    // ---------------------------------------------------------------------

    function main() {
        try {
            History.init(SCRIPT_FOLDER);
            state.outputFolder = defaultOutputFolder();
            var last = History.data.lastOutputFolder;
            if (last) {
                var lf = new Folder(last);
                if (lf.exists) state.outputFolder = lf;
            }
        } catch (e) {
            alert('Failed to initialize the history database:\n' + e.message);
            return;
        }
        buildUI();
    }

    main();

})();
