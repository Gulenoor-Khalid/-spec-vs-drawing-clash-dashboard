# Spec vs Drawing Clash Dashboard

A real, working analytics dashboard that compares a client **specification PDF** against a structural **drawing PDF**, reports clashes, and suggests fixes.

This is **not a mock** — itt actually reads both PDFs, extracts structural parameters with a bilingual (English / French) rule-based parser, and runs a comparator that classifies each finding as MATCH, MARGINAL, CLASH, MISSING-IN-DRAWING or MISSING-IN-SPEC.

## How it works

```
┌───────────────────┐    ┌────────────────────┐    ┌──────────────────┐
│  Upload 2 PDFs    │ ─▶ │  pdftotext extract │ ─▶ │  Param extractor │
│ (spec + drawing)  │    │   (poppler CLI)    │    │  (regex, EN/FR)  │
└───────────────────┘    └────────────────────┘    └────────┬─────────┘
                                                            │
┌───────────────────────────────────────────────────────────▼─────────┐
│  Comparator: pair params by key, classify by tolerance, suggest fix │
└───────────────────────────────────┬─────────────────────────────────┘
                                    ▼
                       ┌─────────────────────────┐
                       │  Chart.js dashboard:    │
                       │   KPIs · Doughnut · Bar │
                       │   Findings cards · Data │
                       └─────────────────────────┘
```

### Parameters the parser currently understands

| Category | Parameters |
|---|---|
| Foundations | Strip footing dims (SF1/SF2…), isolated footing (SI), tie beam (tirant), embedment, anchorage |
| Geotech | Allowable bearing pressure (SLS / ULS) |
| Loads | Permanent (G) and live (Q) in kg/m² or kN/m² |
| Materials | Concrete grade (C25/30, C30/37 …), rebar grade (B500A/B/C), cover |
| Slabs | Poutrelle-hourdis thickness, total slab thickness, floor build-up |
| Levels | Finished Floor Level in NGF |
| Architecture | Parapet (acrotère) height |

Recognized in both English specification language and French drawing language.

## Run it

```bash
cd dashboard
npm install
node server.js
```

Then open **http://localhost:5174** in a browser, upload your specification + drawing PDFs, click *Analyze*.

Requires `pdftotext` (from poppler) on PATH — already installed on this machine via mingw.

## Files

```
dashboard/
├── server.js              Express server + /api/analyze endpoint
├── lib/
│   ├── extract.js         PDF → structured parameters (bilingual)
│   └── compare.js         Two parameter sets → findings + suggestions
├── public/
│   ├── index.html         Dashboard markup
│   ├── style.css          Visual design
│   └── app.js             Frontend logic + Chart.js charts
└── test-run.js            CLI sanity check against the project's real PDFs
```

## Real findings on the sample data

Running on `20240026-01-C.pdf` (FM Ingénieur Conseil drawing) vs `STRUCTURAL-SPECIFICATION.pdf`:

- 7 clashes — embedment 0.9 m vs 1.0 m, isolated footing 1100² vs 1200² min, parapet 370 vs 400 mm, slab 200 vs 220 mm, floor build-up 200 vs 180 mm, FFL 127.10 vs 127.00 NGF, tie beam depth 250 vs 300 mm
- 4 items missing from drawing (concrete grade, rebar grade, cover, standard-strip-footing minimum)
- 4 items missing from spec (specific strip footing sizes SF1/SF2, bearing pressure ULS/SLS, etc.)
- 2 matches (anchorage 0.30 m, permanent load G = 200 kg/m²)

## Extending

To add a new parameter type:
1. Add a regex-based extractor function in `lib/extract.js` returning `{ key, label, value, unit, raw, context }`.
2. Add an entry in `extractAllParameters()`.
3. Optionally add a tolerance in `NUMERIC_TOL` inside `lib/compare.js`.
4. Optionally add the new key to the category map in `public/app.js` (`drawBar` function) so it groups nicely in the stacked bar chart.
