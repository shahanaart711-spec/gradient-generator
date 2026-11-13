# Professional Seamless Pattern Generator

A production-ready **Adobe Illustrator ExtendScript (JSX)** tool that generates batches of
five original, mathematically seamless, 4000 × 4000 px RGB vector patterns and exports them
as separate EPS files — designed for professional surface design and commercial stock
marketplace submission, subject to each marketplace's individual technical and content
requirements.

Tested target environment: **Adobe Illustrator 2025 (v29) on Windows 11**.
Pure ExtendScript ES3 — no plug-ins, no external libraries, no internet access required.

---

## Features

| Area | What it does |
|---|---|
| **Batch output** | Exactly 5 separate EPS files per run (`Pattern_0001.eps`, `Pattern_0002.eps`, …), each a complete seamless tile. Never overwrites existing files. |
| **Document specs** | 4000 × 4000 px artboard, RGB color mode, pure vector content, EPS export with color TIFF preview. |
| **Seamless engine** | Exact ±4000 pt edge-wrapping (left/right, top/bottom, and all four corners) measured from the *real* drawn geometry of every motif, then clipped to the tile. |
| **Style library** | 7 categories — Geometric, Abstract, Line, Minimalist, Decorative, Retro/Vintage, Modern Creative — built from 36 algorithmic vector motifs. |
| **Color engine** | 10 palette schemes (pastel, earth, luxury, vibrant, monochromatic, complementary, analogous, neutral, retro, muted) with HSL-based harmony, WCAG-style contrast checks, and muddy/desaturation penalties. |
| **Background selection** | Intelligent and design-dependent: candidates are generated per color scheme and scored by minimum and average contrast against the motif colors, with saturation and harmony penalties — never a fixed white/black. |
| **Composition engine** | Straight grid, alternating, diagonal, half-drop, brick, hexagonal, radial rings, and scattered (torus-distance) arrangements, with randomized size, rotation, spacing, density and scale variation. |
| **Persistent history** | `Pattern_History.json` (separate from the script) stores fingerprints, category, palette, background, composition and export filename per design. In-batch and cross-run duplicate prevention via an O(1) fingerprint index plus structural keys. Automatic backups and corruption recovery. |
| **Quality control** | Pre-export validation of artboard size, RGB mode, background coverage, clipping, and edge-wrap twins — plus a temporary 3 × 3 tiled test document that verifies tile-boundary geometry programmatically. |
| **UI** | ScriptUI palette window: output folder picker (remembered), Generate button, history count, DB status, live progress bar, and completion notification. |

---

## Installation

1. Copy `Professional_Seamless_Pattern_Generator.jsx` into your Illustrator **Scripts** folder, e.g.:

   ```
   %AppData%\Adobe\Adobe Illustrator 2025\en_US\Documents\Scripts
   ```

   (or `C:\Program Files\Adobe\Adobe Illustrator 2025\Presets\en_US\Scripts` with admin rights).

2. Restart Illustrator, then choose **File > Scripts > Professional Seamless Pattern Generator**.

3. Click **Browse…**, choose an output folder, and click **Generate 5 EPS Patterns**.

Detailed steps, first-run behavior and troubleshooting: see `Installation_Instructions.txt`.

---

## Usage

- The output folder is remembered between runs (stored in the history file).
- Files are numbered sequentially and continue from the highest existing number —
  existing EPS files are never overwritten.
- Each run produces five **visually different** designs: the generator actively rejects
  designs that repeat a structure (category + composition + motif set + density) or a
  palette/background combination already recorded in history — both within the batch and
  across all previous runs.
- If a design fails validation or export, it is skipped and reported; previously exported
  files and the history database are always preserved.

---

## How seamlessness is guaranteed

Every motif is placed by a `placeWrapped` routine that:

1. Draws the motif group at its intended position inside the 4000 × 4000 pt tile.
2. Measures the group's **actual** `visibleBounds` (so strokes, blobs and overshoots are
   accounted for — nothing is estimated from nominal size).
3. Duplicates the group with an exact `translate(±4000)` for every tile edge it crosses;
   motifs crossing a corner receive duplicates at all three wrapped positions.
4. A clip path is added **last** (brought to front, `clipping = true`) so the tile exports
   as exactly one complete, closed 4000 × 4000 px unit.

Before each export the script validates the document (artboard rect, RGB mode, background
coverage, clip structure, wrap twins) and then builds a **temporary 3 × 3 tiled test
document**: the tile is duplicated into a 12000 × 12000 pt scratch document with exact
offsets and all relative boundary positions are verified programmatically. The scratch
document is closed without saving.

**Verification statement:** all seamlessness checks in this project are *geometric and
programmatic* (exact coordinate/offset comparisons of path geometry across tile
boundaries). No human visual inspection of rendered output was performed; the script
itself likewise verifies tiling mathematically and reports any failure in the completion
dialog rather than claiming visual proof.

---

## History & duplicate prevention

- `Pattern_History.json` is created automatically on first run, next to the script if that
  folder is writable, otherwise in the user's Documents folder.
- Each record stores a structural fingerprint (category | composition | motif set |
  density), palette key, background color, generation date and export filename.
- Duplicate rejection is **fingerprint-based minimization, not a guarantee of infinite
  unique designs**: the design space is finite, and the generator avoids previously used
  structures and palette/background combinations where practical. Over very long use,
  near-identical *styles* may recur with different geometry, colors and arrangement.
- A backup (`Pattern_History.backup.json`) is written before every save. On load, a
  corrupted main file is recovered from the backup; if both are unusable, a fresh database
  is started. Existing EPS files are never affected.
- History is updated **only after** all five EPS exports in a batch succeed.
- Lookup uses an in-memory fingerprint index, so performance stays stable at thousands of
  records. There is no arbitrary size cap.

---

## EPS export settings

- `EPSSaveOptions` with **Color TIFF** preview and **Illustrator 17** (CS6-era EPS
  compatibility, widely accepted by stock platforms), with an automatic fallback to
  Illustrator 15 compatibility for older Illustrator versions. Each option is set
  defensively so unexpected constant changes cannot break the export.
- The document raster-effect resolution is pinned to 72 ppi so the 4000 pt tile equals
  4000 px exactly.
- `nextExportIndex()` scans the output folder and the history database to pick the next
  free number; the export bumps the index if a race creates the file first.

---

## Project files

```
Professional_Seamless_Pattern_Generator.jsx   The generator (single self-contained script)
Installation_Instructions.txt                 Step-by-step install & first-run guide
README.md                                     This document
test/                                         Developer-only Node.js mock harness (not
                                              needed to run the generator in Illustrator)
```

`Pattern_History.json` and `Pattern_History.backup.json` are **not shipped**; they are
created automatically at runtime, keeping the database separate from the source code.

---

## Technical notes

- Written for **ExtendScript ES3**: no `JSON`, `Array.prototype.indexOf`, arrow functions,
  `let`/`const`, or other post-ES3 features. A minimal JSON serializer and recursive
  parser are built in.
- All shapes are created via `setEntirePath` with computed point arrays (circles, blobs,
  polygons, stars, rings, rounded rects), which avoids Illustrator API argument-order
  quirks and keeps every element editable vector geometry.
- Documents are created per design and closed in a `finally` block; user alert
  preferences are suppressed only during generation and always restored.
- The random engine is a deterministic, ES3-safe 32-bit LCG seeded from the clock, so
  behavior is reproducible if a design id is re-run for debugging.

## Developer tests (optional, not required at runtime)

The `test/` folder contains a Node.js harness that mocks the Illustrator DOM and drives
the real script's UI and batch pipeline:

- `test/harness.js` — end-to-end batch run: sequential numbering, no overwrites,
  unique fingerprints, backup creation, document cleanup.
- `test/stress.js` — 60 additional designs across 12 batches: all fingerprints unique.
- `test/seamcheck.js` — independent edge-twin verification on real 4000 × 4000 tiles.
- `test/recovery.js` — history corruption recovery from backup and fresh start.

Run any of them with `node test/harness.js Professional_Seamless_Pattern_Generator.jsx`
(and similarly for the others). They are development artifacts; Illustrator users can
ignore them.

---

## License & usage

Generated designs are original algorithmic compositions produced at run time. You are
responsible for ensuring submissions meet each stock marketplace's individual technical
and content requirements.
