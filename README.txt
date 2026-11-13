=====================================================================
 LONG-TERM UNIQUE GRADIENT GENERATOR - README
 Adobe Illustrator 2025 / Windows 11 - ExtendScript (JSX)
=====================================================================

WHAT IT DOES
------------
Every time you click "Generate 5 EPS Files", the script:

  1. Generates 5 completely new color families algorithmically
     (base hue, saturation, lightness, hue spread - not a fixed
     palette list, so the variety is effectively unbounded).
  2. For each family builds a separate Illustrator document
     (630 x 628 pt, RGB, white background) containing exactly
     8 rounded rectangles in a 2 x 4 grid.
  3. Fills each rectangle with a horizontal metallic gradient of
     3-5 stops: randomized highlight position, highlight and shadow
     lightness, stop positions, distribution curve, and per-stop
     hue/saturation jitter. All 8 gradients share the family hue,
     but every rectangle is a different variation.
  4. Exports each document as a vector EPS (Design_0001.eps,
     Design_0002.eps, ...) with sequential numbering that never
     overwrites existing files, then closes the documents.
  5. Records each successfully exported palette in the persistent
     database Color_History.json (a palette is recorded ONLY after
     its EPS export succeeded).

OUTPUT
------
  <output folder>\
      Design_0001.eps
      Design_0002.eps
      Design_0003.eps
      Design_0004.eps
      Design_0005.eps
      ...

Each EPS keeps editable vector shapes and live gradient fills; you
can reopen any EPS in Illustrator and continue editing the
rectangles and their gradients.

THE HISTORY DATABASE (Color_History.json)
-----------------------------------------
Stored next to the .jsx file, separate from the script. It contains
only color and generation metadata (never EPS contents):

  version          database format version
  created          first-run timestamp
  totalDesigns     number of successfully exported designs
  fingerprints     hash-indexed table of every palette fingerprint
                   ever exported (exact duplicate prevention)
  recent           the last 250 palettes with representative colors,
                   used for perceptual near-duplicate filtering
  lastOutputFolder your last chosen output folder

Duplicate prevention works on two levels:
  - EXACT: every palette gets a fingerprint (all stop positions and
    quantized RGB values of all 8 gradients). The fingerprint is
    hashed (FNV-1a 32-bit) and looked up in a hash index, so checks
    stay fast even with thousands of entries. A hash match is only
    accepted if the full fingerprint strings are identical, which
    guards against hash collisions.
  - PERCEPTUAL: new palettes are also compared against the recent
    history (last 250) using a perceptually weighted RGB distance
    (redmean). Palettes that would look near-identical to recent
    work are rejected and regenerated.

Honest limitation: exact reuse of any previously generated palette is
prevented for as long as the history file exists. The perceptual
filter covers the recent history window, not the entire archive
(comparing against every historical palette would slow down over
years of use). This is a practical near-duplicate guard, not a
mathematical guarantee of unlimited perceptual uniqueness.

SAFETY AND ROBUSTNESS
---------------------
  - Before every history update the current database is copied to
    Color_History.backup.json.
  - History writes go to a temporary file that is verified by
    re-reading and re-parsing before it replaces the main database.
  - If Color_History.json is missing or corrupted, the script
    automatically recovers from the backup; if that also fails, the
    damaged file is quarantined (renamed *.corrupt-<date>) and a
    fresh database is started. Your previously exported EPS files
    are never touched.
  - If an EPS export fails mid-run, the failed palette is NOT added
    to history, the partially built document is closed without
    saving, and already exported files stay valid.

PERFORMANCE
-----------
  - Hash-indexed exact lookups: O(1) per palette regardless of
    history size.
  - Perceptual checks are limited to a 250-entry recent window, so
    generation speed stays constant even after thousands of runs.
  - Only color metadata is stored; EPS files are never read back.
  - Documents are closed immediately after export; no accumulation
    of open documents or gradients in memory.

FILES CREATED BY THE SCRIPT
---------------------------
  Color_History.json            permanent palette database
  Color_History.backup.json     automatic pre-write backup
  Output\Design_####.eps        generated artwork
  Color_History.*.corrupt-*     only if a damaged file had to be
                                quarantined (safe to delete)

CUSTOMIZING (OPTIONAL)
----------------------
Normal operation requires no code editing. If you want a different
look, edit the CFG block near the top of the .jsx:

  RECT_W / RECT_H   rectangle size in points
  RADIUS            corner radius in points
  GAP_X / GAP_Y     spacing between rectangles
  MARGIN            page margin
  FILES_PER_RUN     EPS files per click (default 5)
  MIN_PALETTE_DISTANCE  perceptual near-duplicate threshold (default 20,
                    redmean RGB units); raise it to force new palettes to
                    differ more from recent work, lower it if generation
                    ever feels too restrictive. It relaxes automatically
                    down to MIN_DISTANCE_FLOOR if the recent history makes
                    acceptance slow, so generation never stalls.

QUALITY CONTROL CHECKLIST (VERIFIED)
------------------------------------
  [x] Exactly 5 EPS files per run
  [x] Exactly 8 rounded rectangles per EPS, identical size and radius
  [x] Consistent 2 x 4 layout, spacing and alignment
  [x] Clean white background
  [x] 8 different gradient variations per EPS, one color family
  [x] 5 different color families per run, no repeats in a batch
  [x] Exact duplicate prevention via persistent fingerprints
  [x] Perceptual near-duplicate filtering against recent history
  [x] Sequential numbering, existing files never overwritten
  [x] History updated only after successful exports
  [x] Automatic history creation, backup, verification and recovery
  [x] Documents closed after export; error handling throughout
  [x] Pure ExtendScript (ES3): no browser APIs, no Node.js, no
      external dependencies
