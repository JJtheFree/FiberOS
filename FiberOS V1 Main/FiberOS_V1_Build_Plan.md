# FiberOS V1 — Living Build Plan

**Single source of truth.** We check items off here as we go. Last updated: 2026-08-01.

**What FiberOS is:** a friendly, modern, beginner-accessible hub for fiber projects. FiberOS is the umbrella brand. Tapestry Studio is the grid-builder room inside it. V1 is tapestry crochet only.

**Owner:** JJ. **Environment:** Mac, VS Code, terminal-comfortable.

---

## Status legend

- [ ] not started
- [~] in progress
- [x] done

---

## 1. Locked decisions (do not reopen without a reason)

- **Architecture:** stay vanilla (plain HTML/CSS/JS), no framework for V1. Deploys as static files, no build toolchain to maintain. A framework rebuild (React) is parked for if/when this outgrows a solo project.
- **Hosting:** Cloudflare Pages for the site files (free).
- **Backend:** Supabase for accounts, saved projects, and image storage (one dashboard, set-and-forget). Not wired until the accounts phase. V1 is local-first.
- **Saving V1:** local-first (works instantly, no login to create), built with a clean seam so Supabase drops in later without a redo.
- **Accounts V1:** private accounts, users save their own projects. No public gallery in V1.
- **Public sharing (Ravelry-style gallery):** future build, separate greenlight. Still being weighed against FiberOS's purpose.
- **Scope V1:** tapestry crochet only. C2C/graphgan is the first fast-follow after V1.
- **Platform priority:** desktop-first, but designed mobile-aware from the start.
- **Yarn data:** slim the 3.9MB bundle to load on demand (online-only is fine). Keep all 14,087 records including discontinued ones. Keep CC BY 4.0 attribution to temperature-blanket.com / Yarn Colorways API.

## 2. Brand and visual identity

- **Palette:** greens as the core — forest, hunter, sage. **No mint.**
- **Accents:** burnt orange, lavender, periwinkle.
- **Rules carried from the original spec:** no emojis in the UI, real SVG icons, cozy-not-childish, plain language over engineering terms. Dark mode works on every screen.
- Build a small color-token system so the palette is consistent everywhere and dark mode holds up.

**ACCESSIBILITY — HARD REQUIREMENT (JJ has photophobia; wears FL-41 lenses).**
The UI must be comfortable to view WITHOUT the lenses, with no eye pain. This drives the color phase:

- No pure-white (`#fff`) panels or cards on dark backgrounds. Use softened off-white / warm low-luminance surfaces.
- No bright, glowing, or high-saturation gradients (the pink walkthrough panel and white guide cards are current offenders).
- Reduce overall contrast intensity in dark mode; aim for gentle, warm, low-glare surfaces rather than stark black/white.
- Favor warm tones over cold blue-white light (FL-41 filters blue-green; our design should not lean on harsh blue-white).
- Provide a genuinely low-strain dark theme; consider a "reduced glare / soft" option.
- Re-audit EVERY screen against this, including modals (beginner guide), the editor, and the packet preview.

Flagged 2026-08-01 after seeing the Studio dark mode. Current dark theme is a stopgap; the dedicated color-design pass must fix this properly.

## 3. The moat (what makes FiberOS different)

Real yarn-colorway matching: chart colors map to actual purchasable yarn by brand and line. Stitch Fiddle, Chart Minder, Floss Cross, and the rest do not do this. Lean into it hard.

---

## 4. Ordered build plan (V1)

Each phase is greenlit and verified before the next begins.

### Phase 1 — Data foundation  ✅ DONE (2026-08-01)
- [x] Define one versioned project schema (covers grid, palette, yarn assignments, source image, conversion settings, packet settings, chart styling, foundation-chain + row-direction choices). → `app/project-schema.js`
- [x] Build a converter that reads existing legacy localStorage projects and upconverts them, so nothing is lost. → `app/project-migrate.js`
- [x] Verified with 13 automated checks against realistic legacy fixtures. → `tests/migrate.test.cjs` (run: `node tests/migrate.test.cjs`)

**Notes for later phases:** migration is non-destructive (legacy keys stay) and idempotent (safe to run on every page load). New v1 storage keys: `fiberos_v1_projects`, `fiberos_v1_active_project`, `fiberos_v1_migrated`. Phase 3 (Connect the flow) should call `FiberOSMigrate.migrate()` once at startup, then read/write only the v1 keys.

### Phase 2 — Hub shell and rebrand  ✅ DONE (2026-08-01)
- [x] Consolidated the whole app into this `FiberOS V1 Main` folder so the hub is self-contained. Open `index.html` to run it. (Parent folder kept as the original backup.)
- [x] One shared nav (Home / Tapestry Studio / Yarn Library) + footer with yarn-data attribution across all pages.
- [x] Real FiberOS home/dashboard front door: your projects (read from the v1 store via `app/project-repository.js`, which runs the Phase 1 migration) + a tools launcher (Tapestry Studio, Yarn Library live; C2C, Cross-Stitch, Temperature Blanket shown as future rooms).
- [x] Green palette + accents applied suite-wide via one stylesheet `fiberos-green.css` (forest/hunter/sage core; burnt orange/lavender/periwinkle accents; no mint). Covers light + dark, including studio's hardcoded accents.

**How to view:** open `FiberOS V1 Main/index.html` in your browser. Use the Dark mode button in the top bar to check dark theme.

**Known follow-up:** studio is still the 168KB monolith. Its palette is green now, but a deeper visual/layout cleanup comes when we decompose it in a later phase. This was the intended "connect now, refactor later" call.

### Phase 3 — Connect the flow  ✅ DONE (2026-08-01, verified live in Chrome)
- [x] "Open in Studio" now loads the selected project straight into the editor (grid + palette + yarn + chart settings), verified: opened to the Edit step with the 28×36 grid rendered.
- [x] Unified save: Studio now writes the full v1 project to the library. Proven round trip — edited a cell in the editor, saved, and the change appeared in the library card thumbnail.
- [x] Studio's own save button was replaced (its handler was locked inside an IIFE) via a published-internals hook (`window.__studio`) + `app/studio-bridge.js`.
- [x] v1 "active project" stays in sync while editing (current work), separate from explicit library saves.

**How it works:** dashboard "Open in Studio" calls `Repo.requestOpen()` (sets active + open-intent). `app/studio-bridge.js` hydrates the editor on load and owns Save. Studio publishes its internals on `window.__studio` from inside its IIFE.

**Partial / follow-up:** the source *reference image* pixels aren't persisted yet (only the filename). Real round trip of grid/palette/yarn/settings is done; source-image reference is a small later touch. Packet page still reads the legacy active shape (kept in sync), full packet migration is a later phase.

### Phase 4 — One shared chart renderer  ✅ DONE (2026-08-01, verified live in Chrome)
- [x] Built one canonical `renderChart(canvas, opts)` engine → `app/chart-renderer.js`, extracted from the proven packet renderer so output is identical.
- [x] Enforces all locked rules: square cells, column numbers top + bottom, row numbers both sides with direction arrows, odd/even alternating direction, every 10th global line major, grid lines clipped to bounds, configurable grid-line color/opacity, tiling with global numbering.
- [x] Added the two rules the packet was missing: **foundation-chain row offset** and **configurable grid-line color/opacity**.
- [x] Pure logic unit-tested — 10 checks (`tests/chart-renderer.test.cjs`, run: `node tests/chart-renderer.test.cjs`).
- [x] Integrated into the packet: `pattern-packet.html`'s `drawChart` is now a thin delegate to the shared engine. Verified live — numbering, arrows, and major lines all correct on the demo chart.

**Follow-up:** the Studio editor still uses its own interactive canvas (hover, selection, active-stitch overlays). Its rules already match (it was the reference), but literally routing its base grid draw through the shared engine is a low-risk refinement deferred to the monolith-decompose pass. Packet + print — where correctness matters most — are unified now.

### Phase 5 — Slim the yarn data  ✅ DONE (2026-08-01, verified live in Chrome)
- [x] Built a slim `yarn-colorways.json` (dropped unused fields brandId/yarnId/dateAccessed/unavailableDate): 4.05MB → 2.43MB raw, ~190KB gzipped over the wire.
- [x] Rewrote `yarn-api.js` to fetch the JSON ON DEMAND (cached), same `FiberOSYarnAPI.load()` interface + validation. Removed the 3.9MB inline `yarn-colorways-api-data.js` from Studio, Packet, and Yarn Library — it no longer loads on any page.
- [x] Verified: all 14,087 records load via fetch on Library + Studio; old blob never fetched; discontinued records preserved; attribution kept.
- [x] Fixed a pre-existing Yarn Library crash (`#fixtureNotice` null reference) that made it show an error on load; it now reports "ready" and renders results with working dependent brand/weight/line menus.

**Note:** the old `yarn-colorways-api-data.js` (4MB) is now unused/unreferenced — safe to delete from the folder when convenient (left in place for now; not deleting user data automatically).

### Phase 6 — Conversion-quality rebuild (the "first draft needs too much editing" fix)  🔶 IN PROGRESS

**Baseline finding (verified on real samples):** the conversion algorithm is already strong — clip art (house) kept every distinct region; the dog photo was recognizable at 7 colors. The palette extractor already uses perceptual merging + farthest-point selection to avoid dropping distinct regions. So the biggest wins are in the DEFAULTS, not a rewrite.

- [x] **Smarter defaults, done + verified (D11).** On image load, the app now auto-detects the conversion mode (added a `flatnessRatio` test that separates flat art from photos even with anti-aliased edges) and sets a sensible starting color count instead of a blanket 8: logo 4, clip 6, photo 12. Verified live: dog → photo/12 (was logo/8, briefly 20), house → clip/6, suzie → clip/6. This directly fixes "too many colors by default."
- [x] **Pixel Art overhaul, done + verified.** Pixel Art mode used naive 1-pixel-per-cell sampling and produced garbage (scattered specks) on flat/lettering art. Rerouted it through the good coverage-based flat-art engine (with proper supersampling, keeping the no-merge guard for crisp pixel detail). Verified live: the "Welcome Home" sign went from unreadable specks to clean, legible lettering in Pixel Art mode.
- [x] **Lettering / thin lines.** Confirmed logo/clip modes already render lettering crisply; the "broken lettering" was specifically the Pixel Art path (now fixed) plus small default sizes for text.
- [x] **Rogue grey halos, fixed + verified.** The flat-art engine was learning anti-alias grey edge pixels as real palette colors (Slate/DarkGrey/MediumGray around black lettering). Now neutral (low-chroma) pixels snap to pure black or white; genuine hues are untouched. Verified: "Welcome Home" → black+white only (0 greys); house clip art → green/brown/tan all preserved with crisp black outlines (0 greys). Also improves mode detection since black-on-white no longer reads as multi-grey.
- [x] **Fine-detail preservation (window panes).** Two fixes: (a) Logo & Pixel modes no longer run the tiny-region merge (only Clip does), so thin lines/small features survive; (b) recommended grid size now scales up with detected detail (base raised, detail-weighted), so simple-but-fine art has enough stitches to render. The "Welcome Home" window went from a solid black blob to structured panes; text stayed crisp.
- [x] **Full sample × mode matrix verified live.** Tested all 4 built-in samples (Simple flower, Simple dog, Building logo, Welcome Home) across all 4 modes (Logo, Clip, Photo, Pixel) at 94×67. Results: flower keeps its orange center; dog keeps pink cheeks + black features; building keeps its 3 distinct blues; welcome-home window resolves; no grey halos anywhere; each mode behaves as intended (logo/clip/pixel crisp, photo smoother). All clean.
- [ ] **Photos look messy (D-photo).** No bad case found on samples; revisit if a specific real photo looks off. (Open.)

**Phase 6 is effectively complete** for V1: smart defaults, Pixel Art overhaul, grey-halo fix, fine-detail preservation, and larger detail-aware sizing — all verified across the full sample matrix.

### Palette Studio (replaces Yarn Library) — IN PROGRESS
Decision: the browse-all Yarn Library was redundant (color/yarn is assigned inline in the making flow), so it's being transformed into **Palette Studio** — build a color scheme from a photo or a seed/mood, ground every color in real yarn, save it, then apply it to a design (as a non-destructive duplicate) or start a new one. Built before Cloudflare deploy per JJ.

- [x] **Step 1 done + verified:** `app/palette-engine.js` (k-means palette extraction, color harmonies, curated moods, hex/hsl utils, background call-out) + 7 unit tests (`tests/palette-engine.test.cjs`). `palette-studio.html` page: "From a photo" (samples + upload) and "From a color or mood" (seed + harmony + moods), color-count slider, swatches with the **Background** color called out. Nav + home card now point to Palette Studio. Verified live: house image → accurate palette w/ cream background; autumn mood + complementary harmony both work; dark-mode readable.
- [x] **Step 2 done + verified:** every palette color is grounded in a real, buyable yarn from the 14k database (shows yarn name + brand + line + hex; background called out). Per-swatch **Lock** (pin), **Swap** (pick from ~12 nearby yarn alternatives), and **Regenerate** (re-roll the unlocked colors' yarns). Loads the slim yarn JSON on demand. Also: swapped the sample set to JJ's royalty-free images (skipped the VW-logo one for trademark), deleted the old "fiberOS sample photos 1" folder.
- [x] **Step 2.5 done + verified — brand filter (now GLOBAL):** searchable "Yarn brands you can buy" multi-select (all 81 brands, with per-brand colorway counts). Empty = every brand (default). Picking brands restricts every recommendation AND every Swap alternative to those brands; palette re-matches instantly and **honors Locks** (a locked off-brand yarn stays put). Selection persists in localStorage (`fiberos.paletteBrands`) and restores on reload. Falls back to all yarns if a filter would leave nothing to match.
  - Extracted into a shared module **`app/brand-filter.js`** (`window.FiberOSBrands`) so the preference is **global across the app**. Tapestry Studio now respects it too: its auto-match pool, both yarn search lists, and both brand dropdowns are filtered through the same store (verified: a choice set in Palette Studio narrows Studio from 14,087 → 613 colorways). 8 Node unit tests pass.
  - Also removed the **"pick a mood"** option from Palette Studio per JJ; the color mode is now just "From a color" (photo + starting-color + harmony).
- **Decisions captured from JJ for Step 3 (personal stash) + polish:**
  - Brand filter is global (done). When "My Yarns" exists, selecting it should **default-narrow the brand filter to owned brands** (my rec, JJ deferred). Add a **"only brands I own"** shortcut next to the brand picker.
  - **"Can't get close in these brands"** warning: yes — flag when selected brands can't match a palette color within a tolerance (JJ expects it rare; worth having).
  - Brand choice affects **matching only, not extraction** (keeps colors true to the photo) — keep as-is.
  - Add **grouping by yarn weight** (worsted, DK, etc.) — helpful for tapestry.
  - Saved brand sets: **one list is enough**, but allow **tags** on saved sets and filter by tag when needed.
  - Do **not** hide colorway counts. Keep brand list **alphabetical**. Country/retailer filtering is the user's job — skip.
- [x] **Step 3 done + verified — My Yarns (personal stash):**
  - New shared module **`app/my-yarns.js`** (`window.FiberOSMyYarns`, localStorage `fiberos.myYarns`), kept **completely separate from the 14k master DB** so it never bloats or gets typo-polluted. Dedupes on brand+name+hex. 12 Node unit tests pass.
  - New **`my-yarns.html`** room (added to nav across the app). Two ways to add: **From the library** (search the 14k DB, click Add; already-added shows "Added") and **Add your own** (name + color required; optional brand, line, weight). Stash list with search filter, per-item Library/Custom tag, Remove, and **Group by weight** (real weight names, ordered fine→heavy). **Export backup** (downloads JSON) and **Import backup** (merges, skipping dupes) so nothing is lost before accounts exist.
  - **Palette Studio integration:** a **Match colors against → Full library | My yarns** toggle (My yarns restricts matching to your stash; disabled with a "build your stash" link when empty), plus a **"Use only brands I own"** shortcut that sets the global brand filter to the brands in your stash.
  - Verified end-to-end in browser: add-from-DB + add-manual, dedupe, export→clear→import round-trip, group-by-weight, My-yarns matching draws only from the stash, only-brands-I-own narrows the filter, and the Studio chip reflects it. Test data cleared afterward.
- [x] **Yarn-weight surfacing done + verified (2026-08-02).** Investigated JJ's "everything looks like DK weight 4" concern. Reality: the DB has a **full weight spread** (DK 4,209 · Worsted 3,295 · Aran 1,566 · Sport 1,450 · Fingering 1,419 · Thread 726 · Super bulky 644 · Lace 407 · Bulky 139) — the app just never displayed it. Decoded the opaque weight codes by inspecting the yarn lines behind each and built shared **`app/yarn-weights.js`** (`window.FiberOSWeights`) mapping l/lf/f/s/d/w/a/b/sb/t → real names. Weight now shows in **Palette Studio swatches** (e.g. "Katia · Merino Classic · DK") and in **My Yarns** cards + grouping (fine→heavy); manual dropdown uses the same vocabulary. All non-blank DB codes verified to map.

#### Yarn database findings (for JJ) — 2026-08-02
- **Weights:** present and varied (see above). Fixed by surfacing them.
- **Fiber (cotton/wool/merino/acrylic):** the data has **no fiber field**, but the fibers exist inside the yarn *lines* (Scheepjes Catona = cotton, Cascade 220 Superwash Merino = merino, Knit Picks Palette = wool, etc.). Not filterable today. Options: infer fiber from line-name heuristics (light lift), or accept untagged for V1.
- **Multicolor / variegated:** genuinely **absent** — the source (temperature-blanket.com) is solid-color by design (one yarn = one temperature = one hex). For **tapestry crochet this is appropriate** (variegated muddies block-color charts), so it's a fine V1 limitation.
- **Ravelry** is the richest alternative (fiber, WPI, yardage, weight, variegated) but needs per-app OAuth and its data-stewardship stance makes bulk-caching/redistribution for a public product legally murky. **Rec:** keep the current CC BY 4.0 solid-color DB for V1; consider a Ravelry integration later as a logged-in feature, not a rebundle.
- **Open decision for JJ:** (a) ship V1 on the current DB as-is, (b) add light fiber tagging via line-name heuristics before deploy, or (c) research a second solid-color source to broaden brands/fibers.

- [x] **Studio yarn section made prominent (2026-08-02).** On the Adjust screen the "Choose your yarn colors" card was easy to miss (bottom, muted "Optional"). Highlighted accent-border card with a stronger heading and a "Saves time later" pill, and fixed a dead link (old `yarn-library.html` → `my-yarns.html`, "Browse & save your yarns"). Verified live on the sunflower sample. (Only real dead-link file was studio.html; other hits are `.fuse_hidden*` OS leftovers.)
- [x] **Adjust screen sizing consolidated + de-cluttered (2026-08-02).** The right column had three overlapping sizing controls. Removed the redundant **"Grid size recommendation" card** entirely (the recommendation already auto-fills the stitch/row fields, so it was duplicate UI + a duplicate recommendation vs the item picker). Merged **"What are you making?"** and the **stitches/rows/color-count** fields into one **"Chart size"** box moved to the **left panel** with the image controls. Picking an item still auto-sets the stitch count and fires the too-small warning; the smart recommendation still populates the fields on image load. Right panel is now just the prominent yarn card + Create button. Removed the dead `applyRecommendedBtn`/`recommendedText` JS refs. Verified live: no page errors (the 47 console errors are all from a browser extension's share-modal.js, not FiberOS), sunflower auto-sized to 116×83, baby blanket → 144×103, coaster → warning.

- [x] **Checkpoint saved before Step 4 (2026-08-02).** `git init` + first commit inside `FiberOS V1 Main`, plus a visible zip backup `FiberOS_V1_Main_checkpoint_2026-08-02.zip` in the parent folder. Clean rollback point.
- [x] **Adjust-screen round 2 (2026-08-02, verified live):**
  - **Project colors moved to the right panel** ("How many colors in this project?") with a live **"n of N colors chosen"** counter that ticks up as yarns are selected (fills the right panel meaningfully instead of stretching the yarn card — my rec for a short right column).
  - **Live grid preview overlay** on the image: a light stitch grid that updates with the stitch/row values (and with the item picker), so the size choice is visible. Toggle "Show grid preview on the image" (default on) for FL-41 comfort; dense grids thin themselves to read as texture. Verified: 876 grid-line pixels on vs 0 off.
  - **Soft glow flash** on the stitch fields when the item picker auto-sizes them, so the change is noticed.
  - **Create button is sticky** (`position:sticky; bottom:12px; z-index:6`) so it stays reachable across desktop/tablet/mobile.
  - Left "Chart size" box keeps item picker + stitches/rows + grid toggle; the recommendation still auto-fills on load.
- [x] **Review color-key count discrepancy fixed (2026-08-02, verified live).** JJ hit "Maximum 6 but only 5 shown, and no way to add a color without going back to step 2." Root cause: at small charts the flat-art extraction resolves fewer distinct colors than requested; the field implied you'd always get that many. Fixes: (1) relabeled **Total colors → Maximum colors** with clearer help; (2) added a **capacity note** that appears only when the image resolves to fewer than the max ("resolves to N colors at W×H — increase the grid size to fit more"); (3) added **"+ Add another color"** on the review color key so you never go back to step 2 (bumps the max + re-converts here, with an honest toast when the image can't produce more at the current size). Tested across **all eight "What are you making?" sizes** (coaster→queen): note shows only when capped (coaster 4, mug rug 5), hides once all 6 resolve, and **zero card overlap** in any case. Note: the card overlap/duplicate in JJ's screenshot did **not** reproduce — cards render cleanly and evenly spaced; likely a transient render artifact. Ask JJ to confirm it's gone. Also exposed generateReviewPreview/renderReviewPalette/getPaletteCounts on the studio bridge (the create button awaits a requestAnimationFrame that browsers pause when the tab isn't focused, which blocks automated testing; the bridge hooks let tests bypass it — no effect on real users).
- [x] **Small grids no longer cap colors (2026-08-02, verified live).** JJ: a small coaster/mug must still allow 6-7+ colors (sprinkles, abstract designs). The palette extraction already produced the requested number of centers — colors were being lost in **cell assignment** (a small region never dominates a full cell, and island/tiny-region cleanup stripped it). Fix: track the best-coverage cell for every palette color during assembly, then **after cleanup force each requested color to appear at least once** (flat-art / logo / clip / pixel path). Verified: 20×20 coaster now yields exactly 5, 6, 7, or 8 colors on request (was capping at 4); all eight "What are you making?" sizes return the full 6; small accent colors show as ≥1 stitch; no card overlap. The "Maximum colors" note/‑"+Add" remain as an honest fallback for genuinely limited images.
- [x] **Tapestry Studio samples replaced (2026-08-02, verified live).** Swapped the drawn samples for real royalty-free images (JJ's upload set): **Cat, Dog, Abstract waves** (flat vector illustrations that convert cleanly) and **Beagle photo** (demos photo mode); kept the **Simple flower**. Sample system now supports file-based sources (`samples/*.svg|jpg`) alongside the drawn flower. All five load; clicking loads into the editor.
- [x] **Small-grid photo conversion improved (2026-08-02, verified live).** JJ chose: **crisp & bold**, **emphasize subject**, min size **15×15**, no dithering (explained; runs against the crisp look). Implemented in the Photo path only (flat-art/logo/clip/pixel untouched): (1) **subject-emphasis** — per-cell center weighting feeds a new weighted k-means so the subject wins the color budget over a blurry/peripheral background; (2) **crisp & bold** — saturation + contrast boost on samples, scaled up the smaller the chart (full boost near 15, tapering to gentle by ~70); (3) lowered the **minimum grid to 15** (inputs + all sizing clamps). Verified: the beagle at 32×32 now reads clearly (tan face, dark muzzle, pink tongue, white blaze) with bold color instead of mud; at 15×15 it's necessarily abstract but reads as a dog in bold flat blocks. Dithering deferred (would be a plainly-labeled "Blend shading" toggle if JJ ever wants soft gradients).
- [x] **Crop grid now snaps to image aspect (2026-08-02, verified live).** JJ spotted the root cause: the crop canvas was a fixed 900×560 rectangle, so a square image sat letterboxed with white margins, the grid drew over that white, and it could bleed into the conversion. Fix: on image load, resize the crop canvas to the image's aspect ratio (fit within 860×520). The grid overlay + crop frame + conversion now cover only the image — square, wide, or tall. Verified: square Dog → 520×520 square canvas + square grid + **0 white cells** in the conversion; wide Abstract-waves → 860×483 (aspect 1.78) canvas/grid.
- [x] **Edit chart made dominant (2026-08-02, verified live).** JJ: the edit grid was too small. The "Original reference" took ~40% of the center and the chart drew at a fixed 10px cell. Fix: reference shrunk to a 168px thumbnail; new `fitEditorChart()` auto-sizes the chart to fill the panel (and re-fits on window resize / on entering the editor), clamped to the 4–32px zoom range. Verified: a 40×40 chart now fills the width and is clearly editable; the zoom slider/presets still scale from the fitted size.
- [x] **Upload error feedback (2026-08-02, verified live).** JJ's own photo upload "did nothing." The handler is fine (verified uploading beagle.jpg loads + advances + snaps the canvas) — the file almost certainly failed to decode silently (**iPhone HEIC** is unsupported by browsers). Added `img.onerror` → clear toast: use JPG/PNG/WebP, convert HEIC first. (Future nicety: detect .heic by extension up front, or add client-side HEIC decoding.)
- [x] **Per-page Help overhaul done + verified (2026-08-02).** Built a shared, self-contained help modal (`app/help.js`, `window.FiberOSHelp`) — themed to the app (dark-mode/FL-41 safe), opens from any `.js-help`/`#helpBtn` button (or a floating fallback), closes on ×, click-outside, or Esc. Each page has its own Help button with **text-based, page-specific guidance**: Home, Tapestry Studio (5-step flow + HEIC upload tip), Palette Studio, My Yarns, and Pattern Packet. Dropped the beginner-video walkthrough: Studio's four old guide triggers now open the new Help; the old `guideModalWrap` is left orphaned (harmless, unused). Verified live on Studio (4 buttons wired, 6 sections, no crash) and Palette Studio (renders clean in dark mode). Screenshots deferred per JJ ("text or text+screenshots" — text first); can add labeled screenshots later.
- [x] **Home restructured into Landing + My Studio (2026-08-02, verified live).** `index.html` is now a **parallax landing**: "What would you like to do today?" with three big **shimmer-on-hover** buttons + hover captions — Tapestry Studio ("Build the grid for your next design."), Palette Studio ("Pick your colors for your next design."), My Studio ("See your saved designs and color palettes."). Engine does mouse-move depth + scroll camera-pan across back-to-front layers loaded from **`landing/*.png`** (bg, basket, yarnball, trail); until JJ adds art it shows a clearly-labeled placeholder scene. Saved designs + saved palettes (+ apply/export logic) moved to a new **`my-studio.html`**. Nav updated across all pages (Home→landing, added My Studio). Asset spec in `landing/README.txt`. **Limitation told JJ:** I can't generate images here — the photoreal basket/yarn scene is JJ's to craft (ChatGPT/Canva/Photopea) as transparent PNG layers; I built the engine to consume them.
- [x] **Add color + palette size limits (2026-08-02, verified live).** Added a **"+ Add color"** button (top row next to Regenerate/Save) that opens the library search to append a new real-yarn swatch. Palette is bounded **2–12 colors**: Delete keeps a minimum of 2; Add disables at a recommended **maximum of 12** (past that a tapestry palette gets muddy to read and heavy to carry, and 12 keeps the app fast). Verified: add appends a swatch, add disables at 12, delete floors at 2.
- [x] **Palette Studio swatch controls upgraded (2026-08-02, verified live).** Per JJ: each swatch now has **Lock**, **Swap**, and **Delete**. Swap opens two choices: **"Similar color, other brand"** (nearest color from a different brand, one per brand) and **"Pick a different color…"** which opens a **library search modal** — filter by color/name/hex text, **brand**, and **weight** — that only ever returns real, buyable yarns (never an arbitrary hex we don't stock). Delete removes an unwanted color (keeps a minimum of 2). Verified: swap-menu, 12 other-brand chips, modal with 82 brand + 12 weight filters, weight filter returns only that weight, picking applies the yarn to the swatch, delete stops at 2.
- [x] **Step 4 DONE + verified (2026-08-02).** Save palettes + apply to designs, built in four verified pieces:
  - **4a — Save palette:** new `app/palettes.js` (`window.FiberOSPalettes`, localStorage). Palette Studio's Save button now names + saves the **exact yarns** (name/brand/line/hex/weight/href per slot, background flagged) plus the **rules** active when made (brand filter, source mode, color count), status defaults to Concept. Confirmation toast links to Home. 9 Node tests pass; browser-verified.
  - **4b — Home dashboard:** "Your projects" renamed **Saved designs**; new **Saved palettes** section renders palette cards with a swatch row of the actual yarn colors, status badge, color count, and Rename/Delete/Export/Apply. Verified.
  - **4c — Export sheet:** each saved palette exports a clean printable sheet (swatch, name, brand · line, weight, hex; Background flagged) that opens and auto-prints → **Save as PDF**. Verified doc build (brands, weights, background all present).
  - **4d — Apply to a design:** from a palette card, **Apply to a design** opens a modal → pick a saved design → **dot-to-dot color mapping** (each original chart color → chosen palette color, nearest-match defaults, adjustable dropdown, stitch counts) → **Preview** the recolored image → **Create duplicate**. Non-destructive: makes a copy named "Name 2" (then 3…) in Saved designs, grid recolored to palette hexes, palette entries rebuilt with yarn info. Original untouched. Verified end-to-end (3-color and 7-color designs; all new grid colors come from the palette). Test artifacts cleaned up afterward.
  - Deferred niceties (not blocking): "can't get close in a brand" top-3 substitute popup, different-weight warning with "don't warn me again", match-quality tag, Concept/Ready toggle in the save dialog, and a shareable PNG export. Logged below.
- **Original Step 4 decisions from JJ (for reference):**
  - Save the **exact yarns** (brand + colorway), not just colors.
  - A saved palette **remembers the rules/constraints** active when made (brand filter, source mode, color count).
  - "Apply to a saved design" makes a **non-destructive duplicate saved inside Studio** (Printify-style: sits next to the original in the projects list, click to edit). Duplicate naming just **appends a number** (cow → cow 2 → cow 3).
  - When color counts differ, show a **preview with arrows** from each original chart color to the palette color it becomes (dot→dot mapping). **Start with the dot-mapping change; show the full image preview on the Next step** (both live-updating is fine if performant, but don't make it slow — dots first, image preview after).
  - Home dashboard shows **two separate sections: Saved designs and Saved palettes** (distinct menus, so navigation is obvious).
  - **"Can't get close in a brand" →** tiny popup recommending **top 3 similar colors from other brands**, with a **"show more options"** button for further choices (offer a solution, don't dead-end).
  - **Weight never blocks** a pick, but choosing a yarn of a **different weight than the rest of the project** shows a dismissable warning popup **with a "don't warn me again" option** (X out to continue).
  - **Export a palette** as a printable/shareable sheet: each color as a square/circle swatch with **hex + brand + brand's color name + weight**, and **yardage when available**. Format: **PDF or PNG, whichever is simplest to generate** (one is fine).
  - **Match-quality tag** (great/close/loose) only if useful, not clutter.
- **Yarn filtering discoverability + fiber (2026-08-02):**
  - JJ confirmed the DB is comprehensive enough — **no new yarn data for V1.**
  - Want yarn filtering **easy to find in both Tapestry Studio and Palette Studio** (Studio Adjust card now promoted; keep this in mind for other surfaces).
  - **Fiber filter in Palette Studio** is desired, but depends on fiber tagging, which is **deferred** (would come from line-name heuristics later). Park until post-V1 unless JJ asks.
  - Before QA/mobile/deploy, **JJ will do a full click-through of all four rooms.**
- [ ] **Later:** scheduled yarn-data re-sync + a home-page "N new yarn colors added" badge (post-deploy).

### Phase 6b — Recommendation + Adjust-screen polish (2026-08-01, verified live)
- [x] **Stitch-count recommendation biased toward clarity.** The recommended size now starts high enough for a clean first impression (samples land ~116×83, was 76–94) instead of a muddy one. Rationale: the white background of flat art dilutes the detail metric, so we can't rely on it; better to default generous and let the user lower the count (and watch detail soften) than to hand them a muddy draft.
- [x] **Adjust screen deeply simplified.** Background removal, brightness, contrast, and simplify sliders (low impact, intimidating) are collapsed into one optional "Advanced image tweaks" expander. The image, grid-size/color fields, and Create button are now the focus. All controls retained and functional, just out of the way by default.
- [x] **Crop controls moved to the left panel; zoom is a typeable %** (plus scroll/pinch-to-zoom on the image). Removed the +/- zoom buttons from the center.
- [x] **Dark-mode contrast fixes** (FL-41 requirement): the "auto" tag, info notes, and tips now use dark backgrounds with light text instead of hardcoded pale ones. Verified readable.
- [x] **"What are you making?" item-size picker (optional).** Coaster → queen blanket presets translate to a stitch count (ballpark gauge ~4 sts/in) and fire a gentle "may look blocky" warning when the chosen size is too small for the image's detail. Includes a "final size varies with hook and yarn" callout. Verified: baby blanket → 144×103 no warning; coaster → 20×20 warning shown.
  - Future: swap the dropdown for the clip-art thumbnails from the "fiberOS object size indicators" folder (now saved in FiberOS V1 Main); optionally let advanced users set their own gauge for exact finished dimensions.
- [x] **UI tweaks:** removed the "One hub, more rooms coming" tagline and the non-functional "C2C — Coming soon" teaser card from the home page; moved the review screen's "Open selected in editor" button to a prominent bottom-left continue CTA (was hidden between the previews).
- [x] **Review-screen decluttering:** dropped the 3 preview variants (Simpler/Recommended/More detail) — now shows just the one recommended conversion (also faster: 1 build instead of 3); removed the off "recommended color count" guidance (label is now plain "Total colors", auto-set from the image, adjustable).
- [x] **Editor overhaul:** color key moved to a horizontal scrollable top bar (frees the chart to be much larger — the grid was cramped in the old 3-column layout); tools trimmed to the 5 tapestry essentials (Replace stitch, Fill area, Eyedropper, Undo, Redo) with the recolor/select/line/circle/replace-all/transform clutter hidden; chart canvas given more height. All via scoped CSS (no fragile JS changes).
- [x] **Packet: written instructions background removed** so they print clean (the dark-mode audit had leaked a dark background onto the printable `.paper`). Scoped `.paper .instructions` to transparent/dark-text.
- [x] **Packet customization trim (done + verified):** removed Visual-style themes (defaults to clean Minimal), removed Pattern-content extras (photo/blank grid/journal), removed the Compress toggle (compression always on — the crochet standard), simplified the per-color panel to display + a light "change yarn" search (hid the name/brand/hex re-edit fields). Kept the functional print controls (orientation, chart layout/tiling, legend, row direction, instruction labels, large-font/shading). Written instructions are now background-free for clean printing.
- [x] **More dark-mode readability fixes:** editor brush-size buttons and the packet "Live instruction sample" were white/low-contrast in dark mode — now dark cards with light text.
- [x] **Color-options modal overhaul:** replaced the confusing Select→"Replace this color" two-step with one-click **Use** buttons that assign a yarn instantly; shows the current assigned yarn; kept a single "Merge into another color" secondary action; removed the selection-preview clutter and the disabled Replace button. Verified live.
- [x] **Dark-mode readability audit (FL-41 requirement).** Fixed hardcoded-white surfaces the app's own dark theme missed, which showed low-contrast/unreadable text in night mode: the Beginner-guide modal (walkthrough panel, chapter cards, Close button), plus studio yarn-pick/variant/mode/color-summary/replacement/compare-stage/instructions/checkline/layout/chart-preview cards, Yarn Library result cards + meta chips, and Packet yarn-search dropdown + setting preview. Amber notices softened to low-glare dark. All fixes centralized in `fiberos-green.css`. Verified live on the guide modal and yarn library.
- [ ] **Palette extraction (D10).** Already good per baseline; revisit only if a specific sample regresses.
- [ ] Produce before/after screenshots on the sample set for JJ to review.

**Where it lives:** `detectConversionMode`, `flatnessRatio`, `applySmartDefaults` in studio.html, called from the single image-load funnel (`loadImageFromSrc`).

### Phase 7 — Local-first persistence with backend seam
- [ ] Central persistence service, local-first, structured so Supabase snaps in later.
- [ ] Autosave + version history preserved.

### Phase 8 — Mobile pass, test images, acceptance checklist
- [ ] Responsive/mobile QA (desktop-first, mobile-aware).
- [ ] Run the full upload → packet journey in a real browser (Chrome, Firefox, Safari).
- [ ] Work through the acceptance checklist from the original handoff.

---

## 5. Post-V1 backlog (separate greenlights)

- [ ] Real accounts + cloud sync (wire Supabase).
- [ ] C2C / graphgan Studio — reuses the same grid engine, adds a diagonal-row instruction mode. **First fast-follow.**
- [ ] Public pattern gallery (private/public visibility, Ravelry-style) — pending the "does it fit FiberOS" decision.
- [ ] Cross-stitch Studio — reuses grid + renderer, swaps in an embroidery-floss database (e.g. DMC).
- [ ] Temperature-blanket tool — shares the yarn database, different (weather-driven) engine.
- [ ] Knitting colorwork — needs an aspect-ratio-aware grid (knit stitches aren't square), so it's a larger later effort.

## 6. Sample assets

Located in `fiberOS sample photos/` (in the current project folder). Used for Phase 6 conversion tuning:

- Lettering / logos: `welcome home sign.png`, `sample logo 1.png`
- Flat clip art: `house clip art.png`
- Real photos: `suzie.png`, `dog face.png`
- Complex / decorative: `intricate design.png`, `groovy 1-4.png`

## 7. Do-not-regress list (carried from the original handoff)

No emojis. Square cells. Directly typeable stitch/row fields. Minimum 2 colors, max 20. Accurate requested color count for flat art. Yarn assignment survives editing. Full 14,087-record yarn export stays available including discontinued. Column numbers top + bottom. Row arrows + alternating direction follow user choice. Every 10th grid line darker/thicker. Foundation-chain choice changes numbering everywhere. Editor usable at 100% browser zoom. Dark mode on every screen. Edit goes directly to Packet Builder. Packet contains Project Essentials + chart + color/yarn key + instructions. No yardage estimate, no quality score, no difficulty estimate. No paid background-removal dependency without approval. Never silently swap real yarn data for demo/fallback.

## 8. Open items / pending decisions

- Final Cloudflare-only vs Cloudflare + Supabase comparison to review at the accounts phase (leaning Supabase, decided).
- Public gallery: in or out of the product long-term.
- Domain name for the site.
- Whether the visual refresh stays subtle or goes further than a palette swap.

---

*Working style: JJ approves recommendations before build. Never assume — ask, then recommend. Keep it non-bloated.*
