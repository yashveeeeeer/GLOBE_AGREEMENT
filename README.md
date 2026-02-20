# Commenda -- Global Agreements Visualization

Interactive 3D globe showing animated arcs for international trade and investment agreements. Built with React, Three.js, react-globe.gl, and Tailwind CSS, themed to the Commenda brand palette.

## Prerequisites

- **Node.js** >= 18.x (tested with v20.11.1)
- **npm** >= 9.x

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Download textures and preprocess data
npm run setup

# 3. Start the development server
npm run dev
```

Open [http://localhost:5173]((https://yashveeeeeer.github.io/GLOBE_AGREEMENT/)) in your browser.

## npm Scripts

| Script | Description |
|---|---|
| `npm run setup` | Downloads globe textures + runs preprocessing pipeline |
| `npm run preprocess` | Generates `public/data/*.json` from CSV |
| `npm run download-textures` | Downloads earth day texture and topology bump map |
| `npm run dev` | Starts Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |

## Data Pipeline

Raw data lives in `RAW_DATA/`. The preprocessing script (`scripts/preprocess.ts`) reads:

- `RAW_DATA/AGREEMENT_EDGES.csv` -- country-to-country agreement edges
- `RAW_DATA/GLOBE_VIZ_UPDATED.csv` -- full agreement records (used for ORG-party agreements)
- `data/iso3_lookup.json` -- country ISO3 to name/coordinates/continent
- `data/org_lookup.json` -- organization name to HQ coordinates/continent

And produces:

- `public/data/agreements_edges.json` -- ~3,800+ arc edges (country-to-country and ORG hub-and-spoke)
- `public/data/countries_index.json` -- per-country/org aggregate stats

### Hub-and-Spoke Expansion

Multiparty agreements are expanded by picking the first party as the hub and connecting it to every other party. ORG-involved agreements use a similar pattern and are tagged with `has_org_party: true`.

## Features

- Natural earth day texture with topology bump map for terrain relief
- Soft atmosphere halo tinted with Commenda blue
- Light (#FAF9F6) background themed to Commenda brand palette
- Refined pinpoint country markers with hover/select states
- Animated arc highlights with traveling-dash effect on hover/select
- Auto-scaled arc altitude (short arcs hug the surface, long arcs arch high)
- Auto-rotation that pauses when the cursor is over the globe
- Collapsible filter panel: agreement type, status, continent, year range, country search, ORG toggle
- Collapsible stats panel: edge counts, top types, top countries
- Agreement detail panel listing connected agreements for a selected country
- URL state encoding for shareable filter configurations
- Error boundary with recovery for WebGL crashes
- Mobile-responsive panels with touch-friendly interactions

## Project Structure

```
RAW_DATA/                 Raw CSV source data (untouched)
data/                     Processed lookup JSON
scripts/                  Node preprocessing scripts
public/data/              Generated viz-ready JSON
public/textures/          Earth day texture and topology bump map
src/app/App.tsx           Main application with error boundary
src/components/           GlobeView, FiltersPanel, StatsPanel, AgreementDetailPanel
src/lib/                  Types, filtering, color palette
```

## Deployment

Build for production:

```bash
npm run build
```

The `dist/` folder is a static site ready to deploy to any static host (Netlify, Vercel, GitHub Pages, S3, etc.). Ensure `public/data/` and `public/textures/` are included.

## License

Data sourced from open datasets. Textures from three-globe examples (NASA public domain imagery).
