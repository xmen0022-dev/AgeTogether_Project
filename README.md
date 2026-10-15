# AgeTogether Australia

AgeTogether is an accessible web prototype designed to help older adults stay
connected with their community. It brings together letter writing, local social
discovery, a simple activity-suitability check, news, profile preferences and
an optional AI Companion.

This repository contains the frontend, a small Node.js server, the project data
pipeline outputs, PostgreSQL/PostGIS scripts, and automated tests. It is a
university prototype, not a production service.

## Features

- **Letter** — write, preview, download and, when an email delivery service is
  configured, send a styled letter. Optional AI rewrites provide simpler,
  warmer or more formal wording in English, Simplified Chinese and Traditional
  Chinese.
- **Social** — browse local activities, locations, maps and a bundled news
  snapshot. Users can save activities or record an interest in joining them.
- **Activity check** — a transparent, rule-based check that considers selected
  access needs, distance and interests. It is not machine learning and does
  not make a booking or confirm venue information.
- **Profile and privacy** — manage personal preferences stored locally in the
  browser.
- **AI Companion** — ask general questions, request message suggestions and
  use safety-oriented prompts. It is optional and requires a server-side
  DeepSeek API key.
- **Photo companion** — optionally turn a chosen photo into the on-screen
  companion. Image processing happens in the browser; the photo is not sent to
  this server.

## Quick start

### Prerequisites

- Node.js 18 or later (Node.js 20 LTS recommended)
- npm
- Optional: PostgreSQL 17 and PostGIS 3.6 for database-backed place discovery

### Install and run

```powershell
git clone <repository-url>
cd AgeTogether-Australia-App
npm install
npm start
```

Open <http://127.0.0.1:8000/> in a browser. On Windows systems where PowerShell
blocks `npm.ps1`, use `npm.cmd start` and `npm.cmd test` instead.

The app runs without a database or AI key. In that mode, the static prototype,
local data and non-AI features remain available; AI features show an
unavailable message.

## Configuration

Copy the supplied template before setting up optional AI functionality:

```powershell
Copy-Item .env.example .env
```

Add your DeepSeek key to `.env`, then restart the server:

```dotenv
DEEPSEEK_API_KEY=your_key_here
```

The template also documents optional settings for the DeepSeek-compatible base
URL, model, server port and PostgreSQL connection. `.env` is ignored by Git and
must never be committed.

## Testing

Run the automated test suite with:

```powershell
npm test
```

The tests use Node's built-in test runner and cover the activity decision tree,
contextual tools, pet behaviour, server helpers and HTML escaping. They do not
require API keys, a running server or a database.

For a quick server smoke test after starting the app:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/healthz
```

The expected response body is `ok`.

## Application structure

| Path | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Single-page interface and styling |
| `script.js` | Shared state, storage, introductory/Home pages and background data loading |
| `script-letter.js` | Letter editing, preview, download, email and rewrite interactions |
| `script-social.js` | Location, activities, checks, maps, news and saved selections |
| `script-profile.js` | Profile interface, validation and privacy controls |
| `script-ai.js` | AI Companion interface and request helper |
| `script-app.js` | Routing, delegated events, form actions and application startup |
| `data.js` | Seed data used by the prototype |
| `activity-check.js` | Explainable activity-suitability decision tree |
| `pet.js`, `pet-chat.js` | Photo companion and companion chat behaviour |
| `server.js` | Static-file server and API endpoints |
| `tests/` | Automated Node.js tests |
| `data/`, `notebooks/` | Source data, processed data and data-science notebooks |
| `database/` | PostgreSQL/PostGIS schema, loading, validation and example queries |
| `docs/` | Data provenance, licences, database documentation and project records |

The frontend is deliberately split by feature. Its scripts are classic browser
scripts that share one global lexical environment, so the load order in
`index.html` is significant. Keep `script-app.js` after the feature files: it
starts the application only after their helpers have loaded.

## Server and APIs

`server.js` serves the frontend and APIs from one origin, so local development
does not need CORS configuration. The health endpoint is intentionally public
for deployment monitoring:

| Endpoint | Method | Purpose | Dependency |
| --- | --- | --- | --- |
| `/healthz` | `GET` | Service health check; returns `ok` | None |
| `/api/ask` | `POST` | AI Companion and letter-rewrite requests | DeepSeek key |
| `/api/send-letter` | `POST` | Sends a completed letter | Email delivery configuration |
| `/api/state` | `GET`, `PUT`, `POST` | Prototype whole-state persistence | Local file storage |
| `/api/discovery-places` | `GET` | Tier 1 discovery places | PostgreSQL/PostGIS |
| `/api/nearby-places` | `GET` | Places ordered by distance from coordinates | PostgreSQL/PostGIS |
| `/api/news` | `GET` | Bundled news snapshot | Processed CSV |

`/api/ask` accepts named tasks rather than arbitrary server prompts. Supported
tasks are `tidy-note`, `reply-suggestions`, `scam-check` and `ask`. The server
limits AI requests to 20 per minute per client. The AI is designed to use plain
language and must not provide medical, legal or financial advice.

`/api/state` writes `server-state.json`, which is intentionally ignored by Git.
It is prototype persistence only, not multi-user storage.

## Database setup (optional)

The database is needed only for the discovery-place and nearby-place API
endpoints. The frontend otherwise falls back to its bundled data.

1. Install PostgreSQL 17 and PostGIS 3.6, then create a database named
   `agetogether_db`.
2. Set the `DATABASE_URL` described in `.env.example`.
3. Run the scripts in order from the project root:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d agetogether_db -f database/schema.sql
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d agetogether_db -f database/load_data.sql
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d agetogether_db -f database/validation.sql
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d agetogether_db -f database/queries.sql
```

See [database/README.md](database/README.md) for database details and
[docs/database-data-dictionary.md](docs/database-data-dictionary.md) for the
data dictionary.

## Data, provenance and limitations

The project includes processed snapshots for activities, news, demographic
insights and places. The Iteration 1 discovery dataset is derived from City of
Melbourne Open Data under CC BY; attribution and detailed provenance are in
[docs/data-source-and-licence.md](docs/data-source-and-licence.md).

Place records describe locations only. They do **not** confirm live events,
dates, times, prices, bookings, opening hours, accessibility, availability or
suitability for an individual. The news feed is also a bundled snapshot, not a
live service. Users must verify these details directly with the venue or
provider.

The default distance demonstration uses Melbourne CBD rather than live device
location. Saved activities and profile preferences are local intentions stored
on the current device; they are not registrations or shared accounts.

## Privacy and security notes

- Keep secrets in `.env`; never commit API keys or generated state files.
- The companion photo is processed and stored locally in the browser. Its
  background-removal model is loaded from a CDN on first use; if it cannot be
  loaded, the app falls back to a circular crop.
- AI rewrite requests ask for confirmation before text is sent. Recipient
  fields are excluded from rewrite requests.
- This is a teaching prototype. Do not treat its local storage, state endpoint
  or optional integrations as a production-ready authentication, authorisation
  or data-protection solution.

## License and acknowledgements

Data licences and attributions are recorded in the corresponding files under
`docs/`. The map uses Leaflet and OpenStreetMap tiles. Background removal uses
`@imgly/background-removal`, loaded in the browser when the photo companion is
used.
