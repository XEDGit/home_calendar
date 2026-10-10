
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Frontend, backend, mongo and searxng run in k3s (namespace `home-calendar`, manifest `~/k3s/home-calendar/calendar.yaml` in the separate `~/k3s` git repo, images in the local registry `127.0.0.1:30500`). Only the GPU services (`llm`, `whisper`) still run via Docker Compose. Makefile shortcuts:

- `make deploy` — ship to k3s whatever changed since the images the cluster runs (`scripts/deploy-k3s.sh`): npm test, build + push `calendar-<service>:<short HEAD>`, bump the tag in the manifest, `kubectl apply`, wait for the rollout, commit the manifest in `~/k3s`. Refuses uncommitted changes in the service's directory (`ALLOW_DIRTY=1` builds a `<sha>-dirty-<time>` preview). Only redeploys the backend when `backend/` changed: it is one replica with `Recreate`, so a restart interrupts assistant chats. `make deploy-frontend` / `deploy-backend` / `deploy-all` force a service; `DRY_RUN=1` prints the steps, `SKIP_TESTS=1` skips tests.
- `make` — build + start detached
- `make run` — build + start with attached logs
- `make build` — rebuild images with `--no-cache`
- `make down` — stop containers
- `make logs` — tail logs
- `make dev` — frontend in `vite dev` mode with hot reload (`compose.dev.yaml` override); HMR only at http://localhost:5173, nginx refuses the websocket publicly

`docker-compose` reads `--env-file .common.env`. Per-service env files (`.frontend.env`, `.backend.env`, `.database.env`) are loaded by individual services. `SECRET` (JWT) and `MONGO_URI` come from `.backend.env`.

Backend tests: `cd backend && npm test` (`node:test`, no DB needed). Frontend: `cd frontend && npm test` (`node:test`, pure modules only; no component tests).

Frontend runs as a production build by default (`@sveltejs/adapter-node`, `node build`, multi-stage `frontend/Dockerfile`); code changes need a rebuild (`make`). `ORIGIN` in `.frontend.env` must be the public URL or SvelteKit rejects form POSTs as CSRF. Backend hot-reloads via `nodemon backend.js`.

One-off DB migration: `node backend/update_chores_status.js` (run inside backend container) — backfills `status: 0` on chores docs.

## Architecture

Four-service stack on bridge network `app-network`:

```
client → nginx (443/80, certbot TLS) → frontend (SvelteKit, 5173)
                                          ↓ (server-side fetch over internal HTTPS)
                                       backend (Express HTTPS, 3000) → mongo (database:27017)
```

**Backend (`backend/backend.js`)** — the split has landed: `backend.js` just wires up Express (HTTPS, CORS, JSON body limit, cookies, mongo-sanitize), registers the `node-schedule` midnight job (`db.scheduledUpdate()`) and `automations.js`'s `startScheduler()`, and mounts routers from `auth.js`, `events.js`, `todos.js`, `tags.js`, `rooms.js`, `chores.js`, `users.js`, `assistant.js` and `automations.js`. The `DB` wrapper class (including `scheduledUpdate()`) lives in `db.js`; JWT/bcrypt auth lives in `auth.js`. `server.js` is the only file still an empty placeholder. Backend listens on HTTPS using cert files in `backend/keys/` (not committed).

**Auth model** — Login (`POST /login`) checks bcrypt against `sessions` collection, returns a JWT cookie named `session` containing `{session: <random hex>}`. Every DB operation goes through `DB` methods that decode the JWT via `getSession(token)` and scope queries by `session` field — this is the per-household tenancy boundary. `POST /verify` re-validates the token against the DB.

**Frontend (`frontend/`)** — SvelteKit app. Two layers:

1. `src/hooks.server.js` runs on every request. Maintains an on-disk IP blacklist (`blocked_ips.log`) that auto-blocks IPs after `LIMIT_UNAUTH=10` infractions on non-public paths. Forwards the `session` cookie to `https://backend:3000/verify` and redirects to `/login` on failure.
2. `src/routes/api/*` are SvelteKit endpoints that proxy to backend via `src/lib/requests.js` helpers (`getBackend`/`postBackend`). Client code calls `/api/...` (via `getFrontend`/`postFrontend`); server-side proxies forward cookies + auth headers to `https://backend:3000/`. **Endpoint name on the frontend often differs from backend path** — e.g. frontend `/api/getEvents` → backend `GET /events`; frontend `/api/signChore` → backend chore signature endpoint. Check the matching `frontend/src/routes/api/*/+server.js` to see the mapping before assuming.

**Cross-service URLs** — Inside the Docker network, frontend reaches backend at `https://backend:3000/` (hardcoded in `hooks.server.js` and `lib/requests.js` as `BACK_ENDPOINT`). Self-signed cert; Node's TLS check is implicitly disabled in the container.

**Data model (Mongo collections)** — `users`, `sessions`, `events`, `chores`, `signatures` (chore completions), `todos`, `tags`, `rooms`, `automations`, `automation_results`. Every document carries a `session` field for tenancy.

**Member themes** — Each user picks a two-colour palette in Settings (stored as `users.theme`, a palette id, via `POST /user/theme`). Palettes live in `frontend/src/lib/theme.js`; components only read the `--primary`/`--paper` tokens, and every other colour derives from them in `lib/design/tokens.css`. `hooks.server.js` paints the `theme` cookie onto `<html>` so the first frame is already themed.

**Screens** — The app is one page (`routes/+page.svelte`; tab URLs like `/calendar` load it too through `routes/[view=view]`). Each tab is a `Screen` that stays mounted once opened, hidden when out of view, and the other tabs are warmed up in the background after the first load. So every tab view takes `active` (refresh in place when it becomes true again) and `onReady` (call once its first data is in; a page change waits for it so screens never slide in empty). Page changes are a horizontal View Transition push in nav order (`general.css`).

**Recurring events** — `events` may have a `repeatDays` field. Expansion happens server-side in `GET /events?startDate=&endDate=` (see `backend.js:374`+). When touching event logic, account for both one-shot (`when` only) and repeating shapes.

**Assistant** — Chat on the home page (`lib/components/AssistantChat.svelte`) backed by a local model. `llm` service = llama.cpp Vulkan server (RX 5600 XT is RDNA1, no ROCm), model file from the `models` volume via `LLM_MODEL`; `whisper` service = whisper.cpp server for voice input (`/api/transcribe`). Both internal only. `backend/assistant.js` runs the agent loop and the routes; every model prompt (chat and automations) goes through one durable queue (`assistantQueue.js`, Mongo store `assistantJobs.js`, collection `assistant_jobs`): one job at a time, chat before automations, restart requeues automations and marks chat questions interrupted. Chat questions are stored in `assistant_conversations`/`assistant_messages` (`assistantConversations.js`, private per member), answered by `assistantChatJob.js`, and streamed to the member's pages over `GET /assistant/events` (`assistantEvents.js`). Replies render a small markdown subset (`lib/assistant/markdown.js` → `Markdown.svelte`: `#` headings, `-`/`*` lists, `**bold**`, `*italic*`; everything else literal). It parses to a tree rendered as elements, never `{@html}`, because replies can carry web-page text. The frontend keeps one stream per page in `lib/assistant/store.js`; the home panel shows the latest conversation and the Assistant tab lists them all. The backend must run as a single replica (one worker). `backend/assistantTools.js` defines the tools; tools call the backend's **own HTTP routes** with the caller's cookies, so they behave exactly like the UI (signing uses the `user` cookie = member picked on home). Per-member `users.assistantConfirm` (default on): writes are staged and stored as a review list on the answer, run later (no expiry) by `POST /assistant/confirm` without the model; off = writes run immediately. Chores with duplicate names get a `label` to tell them apart. When adding an endpoint the assistant should use, add a matching tool. Model files live in the `home_calendar_models` named volume (root ext4; the repo sits on mergerfs, which can't mmap them). Add models with `llm/fetch-model.sh <hf-repo> <file>` (verifies sha256). `whisper/` builds whisper.cpp with Vulkan for AVX2: the upstream Vulkan image needs AVX-512. GPU runtime suspend moves VRAM contents to system RAM and they stay there (about 15x slower), so both models must unload before the 300 s autosuspend (`llm/80-amdgpu-autosuspend.rules`, install it in `/etc/udev/rules.d/`): llm uses `--sleep-idle-seconds 240`, and whisper runs behind `whisper/ondemand.py`, which starts whisper-server on each request and stops it after 60 s idle. `llm/bench/` = tool-calling benchmark used to pick the model (`llm/bench/run.sh <model.gguf>`). Internet: `backend/web.js` — `web_search` via the internal `searxng` service (`searxng/settings.yml`, `SEARXNG_SECRET` in `.common.env`) and `fetch_page`, which is SSRF-guarded (public IPs only, IP pinned per hop, ports 80/443, max 3 redirects, text only, 1 MB / 10 s, 8000 chars; pages longer than that are cut to their main article with `@mozilla/readability`). `runAgent` drops the oldest tool results once the conversation nears `LLM_CTX` (backend env, keep in sync with the llm service's `-c`/`LLM_CTX`, default 32768). Web results are wrapped as untrusted content. **Automations** (`backend/automations.js`, `automationSchedule.js`): saved prompts run on a schedule (≥ 15 min) by a one-minute `node-schedule` tick, read-only (`READ_TOOLS` allowlist), up to 12 model steps, results in `automation_results` (last 10 each); shown as one window per automation in the Automations tab (`lib/menus/automations/`). Backend tests: `cd backend && npm test` (`node --test`).

**Nginx** — Terminates TLS for `home-calendar.com` via Certbot-managed certs in `nginx/data` and proxies to `frontend:5173`. Backend is **not** exposed externally — only reached server-side from SvelteKit.

## Conventions

- ES modules everywhere (`"type": "module"` in both `package.json`s).
- Backend endpoints live in the matching router file (`events.js`, `chores.js`, `todos.js`, `tags.js`, `rooms.js`, `users.js`, `auth.js`, `assistant.js`, `automations.js`). When adding an endpoint, place it in the matching file rather than `backend.js`.
- Frontend uses Svelte 5, `@event-calendar/*` for the calendar view, `chart.js` for stats.
- `lol.html` and `ex.py` at repo root are scratch files, not part of the app.
