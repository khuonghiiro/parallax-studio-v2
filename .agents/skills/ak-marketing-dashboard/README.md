# Marketing Dashboard

Local-first Vue and Hono application for browsing marketing assets, inspecting
brand context, and configuring the local dashboard client.

## Documentation Authority

This README owns the dashboard's implementation inventory and operating
instructions. `SKILL.md` routes users here instead of copying commands,
endpoints, tables, or feature lists. The checked-in application and server
source remain final truth when behavior changes.

## Current Product Surface

| Area | UI route | Current behavior |
|------|----------|------------------|
| Assets | `/` (`/assets` redirects to `/`) | Browse scanned assets, preview supported files, rescan the asset directory, and update stored metadata |
| Brand | `/brand` | Inspect design tokens, brand voice, and logos; upload validated logo files |
| Settings | `/settings` | Configure the browser client's API base URL and legacy session API-key value |

The current application does not implement campaign management, a content
library, AI generation endpoints, or automation recipes.

The Settings view still exposes an API-key field, but the local server does not
currently enforce API-key authentication. Do not treat the field as an active
security boundary.

## Runtime Stack

| Layer | Implementation |
|-------|----------------|
| Frontend | Vue 3, Vite, Pinia, Vue Router, Tailwind CSS |
| Server | Hono on Node.js |
| Storage | SQLite through optional `better-sqlite3` |

Node.js 20 LTS is recommended for the native SQLite driver.

## Start And Stop

Run commands from this skill directory.

### Development

```bash
./start.sh
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3457`
- Health: `http://localhost:3457/health`

Stop the processes with `Ctrl+C` in the starting terminal or:

```bash
./stop.sh
```

### Production

```bash
./build.sh
./start-production.sh
```

The production server exposes the built application at
`http://localhost:3457`.

## Live API

### Health

- `GET /health`

### Assets

- `GET /api/assets`
- `GET /api/assets/:id`
- `POST /api/assets/scan`
- `PUT /api/assets/:id`
- `GET /api/assets/:id/content`
- `GET /api/assets/file/*`

### Brand

- `GET /api/brand/tokens`
- `GET /api/brand/voice`
- `GET /api/brand/logos`
- `POST /api/brand/logos`

## Storage

The SQLite schema currently contains:

- `assets`: scanned asset metadata, prompts, and R2 state;
- `brand_cache`: singleton cached brand context.

The database is created under `data/marketing.db`. Asset and brand routes also
read the kit's shared assets and brand guidance from their source-owned paths.

## Configuration

Server environment variables currently read by `server/index.js`:

- `PORT`, default `3457`;
- `NODE_ENV`, default `development`;
- `ALLOWED_ORIGINS`, comma-separated, with local Vite origins as defaults.

The frontend reads its API base through `app/src/config.js`.

## Validation

```bash
cd server
npm test

cd ../app
npm run build
```

The frontend package has no test or lint script. Do not claim those checks until
the package source adds them.

## Troubleshooting

### SQLite driver unavailable

From `server/`:

```bash
npm install
```

If `better-sqlite3` still cannot load, use Node.js 20 LTS. On Windows, install
Visual Studio Build Tools with the C++ desktop workload, then run:

```bash
npm rebuild better-sqlite3 --build-from-source
```

### Port already in use

Identify the listeners and verify they belong to this dashboard task before
stopping them. The script checks ports `3457` and `5173` when no saved PID file
is available, so do not run that fallback against unrelated processes. Reuse
a matching running instance or stop only the owned PID, then restart.

## Scope Maintenance

When source behavior changes, update this README in the same change. Keep
future work in the active project plan; do not copy planned features into this
reusable runtime reference.
