# AgeTogether Australia App

First-iteration static prototype for the AgeTogether Australia app.

## Local preview

```powershell
npm install
npm start
```

Then open http://127.0.0.1:8000/

`server.js` serves the static prototype and the two APIs below from a single origin,
so there is no CORS setup. It replaces the previous `python -m http.server` command.

## App server

### Setup

Copy `.env.example` to `.env` and add a DeepSeek API key. **Never commit `.env`** — it is
already listed in `.gitignore`. Without a key the site still runs; only the AI companion is off.

```powershell
Copy-Item .env.example .env
```

### `POST /api/ask`

Proxies one request to the DeepSeek API so the key stays on the server. The prompts live in
`server.js`, not in the browser, so the endpoint accepts a named task rather than free-form
instructions. Body: `{ "task": "<name>", "input": "<text>", "language": "en-AU", "style": "simple" }`.

Supported languages are `en-AU`, `zh-CN`, and `zh-TW`. Supported styles are `simple`,
`standard`, and `expressive`. Safety rules always override language and style preferences.

| Task | Purpose |
|---|---|
| `tidy-note` | Turn rough speech or typing into a short, warm board note |
| `reply-suggestions` | Three ready-to-send replies to a friend's message (also returned as a `suggestions` array) |
| `scam-check` | Assess a suspicious message and give a safe next step |
| `ask` | Free-form question from the AI Companion page |

Every task inherits shared rules: plain language for older readers, no medical/legal/financial
advice, and no invented event times, prices or accessibility details — matching the limitations
recorded in `docs/data-source-and-licence.md`.

Rate limited to 20 requests per minute per client.

### `GET` / `PUT /api/state`

Whole-blob JSON persistence to `server-state.json` (gitignored), so prototype changes survive a
page refresh. `GET` returns `null` when nothing has been saved yet, letting the frontend fall
back to the seed data in `data.js`.

The AI Companion page now uses `/api/ask` for quick questions, free-form questions,
daily suggestions, and safety tips. The saved-state endpoint remains available for future
frontend persistence work.

## Photo companion (`pet.js`)

On the AI Companion page the user can choose a photo. It is downscaled, the background is cut
out, the transparent edges are trimmed, and the result becomes the floating companion. Users who
choose no photo keep the default drawn companion, which also blinks.

Everything runs in the browser — **the photo never leaves the device** and never reaches
`server.js`. It is kept in `localStorage`, so it is per-device and survives a refresh.

Background removal is the only AI in this file: `@imgly/background-removal`, loaded from a CDN on
first use (a one-off model download of roughly 40 MB, then cached). To move it server-side
(remove.bg, Photoroom, self-hosted rembg), replace `removeBackground()` in `pet.js` — the contract
is canvas in, canvas with transparency out, and nothing else changes. If the model cannot load the
photo is shown in a circular crop instead, so the feature degrades rather than breaking.

Idle life is pure CSS, no AI: breathing (4.2 s) and swaying (6.7 s) run on separate independent
transform properties so they compose, with deliberately non-harmonic periods so the loops drift
apart instead of reading as clockwork. Pressing the companion makes it hop with squash and
stretch. All motion is disabled under `prefers-reduced-motion`.

## Iteration 1 Data Science

The Iteration 1 data pipeline uses City of Melbourne open data for local place discovery:

City of Melbourne open data → validation and coordinate preparation → product-relevance classification → descriptive analysis → 115 Tier 1 discovery places → transparent rule-based ranking baseline.

The demonstration ranking baseline combines category relevance with straight-line geographic proximity using transparent, deterministic rules. It is not machine learning or a claim of real user preference, and is intended for later evaluation and refinement using explicit user feedback.

DS evidence and outputs:

- `notebooks/Iteration1_ds.ipynb`
- `data/processed/agetogether_places_classified.csv`
- `data/processed/agetogether_discovery_places.csv`
- `data/processed/agetogether_ranking_baseline_demo.csv` (DEMONSTRATION baseline)
- `docs/data-source-and-licence.md`
