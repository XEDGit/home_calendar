# Security Audit — home_calendar

Full audit of backend (Express), frontend (SvelteKit), and infra (nginx, Docker,
Mongo). Findings are mapped to the OWASP Top 10 (2021). Each item is marked
**FIXED** (changed in this branch) or **ACTION REQUIRED** (operator must do it —
cannot be safely automated without risking the running deployment).

---

## Critical

### C1. TLS private key committed to git — A02 Cryptographic Failures
`backend/keys/private.key` (and the certs/CSR) were tracked in git history
(commit `4777a4f`).
- **FIXED**: removed from the index (`git rm --cached`) and added to
  `.gitignore` (`backend/keys/`, `*.key/*.crt/*.csr/*.pem`).
- **ACTION REQUIRED**: the key is still in history and must be considered
  compromised. **Rotate the certificate/key pair**, then scrub history
  (`git filter-repo --invert-paths --path backend/keys/private.key`) and
  force-push. Revoke the old cert if it was CA-issued.

### C2. Weak/known JWT secret — A02 / A07 Identification & Auth Failures
`SECRET='use-env-file'` (12 chars, placeholder) signed every session JWT. Anyone
who reads the repo can forge a valid token for any `session` value.
- **FIXED**: `db.js` now refuses to boot if `SECRET` is missing or `< 32` chars.
  A strong 64-char random secret was generated into `.backend.env` (gitignored).
- **ACTION REQUIRED**: rotate this secret in your real deployment; all existing
  sessions are invalidated on change (users re-login).

### C3. Weak MongoDB root password — A05 Security Misconfiguration
`MONGO_ROOT_PASSWORD=password`.
- **ACTION REQUIRED** (not auto-changed — the password is baked into the existing
  Mongo data volume; changing only the env var would lock the backend out).
  Rotate with: `db.changeUserPassword('root', '<strong>')` inside the running
  mongo, then update `.backend.env`/`.database.env`. Or wipe `./backup/data/db`
  and re-init with a strong password.

---

## High

### H1. Broken auth scoping — invalid token silently mapped to a shared tenant — A01 Broken Access Control
`getSession()` returned `0` on an invalid/expired token, so DB ops ran against
`{session: 0}` instead of being rejected — a shared bucket for all bad tokens.
- **FIXED**: `getSession()` returns `null` on any failure; every DB method now
  rejects (401/false) when the session can't be resolved. Defense-in-depth on top
  of the frontend `/verify` gate.

### H2. NoSQL operator injection — A03 Injection
User-supplied JSON (`req.body`, query params) flowed into Mongo filters/updates.
Objects like `{"$ne": null}` / `{"$gt": ""}` could become query operators
(login username, update `$set` payloads, etc.).
- **FIXED**:
  - Global `mongoSanitize` middleware strips `$`-prefixed and dotted keys from
    `body`/`query`/`params`.
  - `db.js` `sanitize()` recursively scrubs every filter and insert payload.
  - `sanitizeUpdate()` keeps only `$`-operators at the top level and strips
    `session`/`_id` from the values (blocks tenant reassignment / mass-assignment).
  - `findLogin`/`findSessionByUsername` coerce `username` to `String`.
  - `auth.js` validates `username`/`password` are bounded strings.

### H3. Insecure session cookie — A05 / A07
`res.cookie('session', …)` set no `httpOnly`, `secure`, or `sameSite` → readable
by JS (XSS token theft) and sent cross-site (CSRF).
- **FIXED**: cookie now `httpOnly`, `secure` (toggle via `INSECURE_COOKIES=true`
  for non-TLS dev), `sameSite=lax`, `path=/`, bounded `maxAge`.

### H4. JWT never expired — A07
Tokens were signed with no `expiresIn`; a leaked token was valid forever.
- **FIXED**: `expiresIn: '30d'`, matched to the cookie lifetime.

### H5. Spoofable client IP defeats the blacklist — A05 / abuse
`hooks.server.js` trusted the leftmost `X-Forwarded-For`, which the client
controls. Attackers could rotate IPs to evade blocks, forge a victim's IP to get
them blocked (DoS), and grow `blocked_ips.log` unbounded (disk exhaustion).
- **FIXED**: client IP is taken from nginx's non-spoofable `X-Real-IP` (falls
  back to the rightmost XFF hop). Blacklist capped (`MAX_TRACKED_IPS`,
  `MAX_INFRACTIONS`) with eviction.

### H6. No brute-force protection on login — A07
`/login` had no rate limiting (and `/login` is excluded from the infraction
counter), allowing unlimited credential stuffing.
- **FIXED**: in-memory sliding-window limiter (`loginRateLimiter`) keyed by
  `ip|username` (10 / 15 min → 429). Also added a constant-ish bcrypt compare for
  unknown users to reduce username-enumeration via timing.

---

## Medium

### M1. State-changing operations over GET — A01 / CSRF
`GET /chores/dbg` (ran the cross-tenant nightly recompute) and
`GET /chores/stats/clear` (deleted rows) were triggerable by a simple cross-site
GET (`<img src>`), and `stats/clear` passed `res` as the Mongo filter and never
responded.
- **FIXED**: both are now `POST`. `chores/dbg` is disabled when
  `NODE_ENV=production`. `stats/clear` uses the correct scoped filter and
  responds. Frontend proxy routes updated to `postBackend`.

### M2. Verbose error responses — A05 Information Disclosure
Handlers did `res.status(500).send({error: err})`, leaking raw Mongo/driver
errors (and stack details) to clients.
- **FIXED**: all DB error paths return generic messages; details go to server logs.

### M3. Unhandled `ObjectId` construction → 500 — A05 / DoS
`new ObjectId(<attacker string>)` threw `BSONError` on malformed input in several
routes (rooms/del, user/update, `getID`).
- **FIXED**: `getID()` validates with `ObjectId.isValid`; added `toObjectId()`
  helper; user routes guard before constructing.

### M4. Missing security headers — A05
No HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
- **FIXED**: set at nginx (HSTS, CSP, frame-ancestors, nosniff, Referrer-Policy,
  Permissions-Policy) and reinforced in `hooks.server.js` + backend
  `securityHeaders`. `x-powered-by` disabled on Express.

### M5. Weak TLS config at nginx — A02
No `ssl_protocols`/cipher restrictions.
- **FIXED**: TLS 1.2/1.3 only, modern cipher suite, session tickets off,
  `server_tokens off`, `client_max_body_size 1m`. Body size also capped at the
  Express layer (`express.json({limit:'256kb'})`).

### M6. CSRF protection signal disabled — A01
`vite.config.js` carried `csrf: { checkOrigin: false }`. (It was inert — SvelteKit
reads CSRF config from `svelte.config.js`, not vite — but it documented intent to
disable same-origin checking.)
- **FIXED**: removed. SvelteKit's default same-origin CSRF check (`checkOrigin:
  true`) stays on. Note: the API uses `application/json`, which browsers cannot
  send cross-origin without a CORS preflight the app never grants — a second layer.

---

## Low / Hardening

### L1. Within-household identity via client-set `user` cookie — A01
The non-secret `user` cookie (set in browser JS) is used by the backend to scope
todos/tags. A household member can set it to another member's id and read shared
data / their non-private todos. Same-tenant only, low impact. *Recommend* deriving
the active user server-side from the session rather than a client cookie.

### L2. Global TLS verification disabled — A02
`NODE_TLS_REJECT_UNAUTHORIZED=0` (frontend) disables all cert checks in the Node
process (needed today for the self-signed `https://backend:3000`). Internal,
isolated docker network, so contained — but it would also silence any external
TLS MITM. *Recommend*: issue an internal cert with `SAN=backend`, mount the CA
into the frontend container, set `NODE_EXTRA_CA_CERTS`, and remove the flag.
Documented in `.frontend.env.example`.

### L3. Backend CORS origin was wrong — A05
`origin: 'http://frontend:3000'` (backend is reached server-side only).
- **FIXED**: set to `https://frontend:5173` with `credentials:true`. Low impact
  since the backend isn't browser-facing.

### L4. Open self-registration — A07
`POST /sessions` lets anyone create a new household. If unintended, gate it behind
an invite/admin token. Left as-is (appears to be product intent).

### L5. Docker images unpinned, run as root — A06 Vulnerable & Outdated Components
`FROM node:latest` / `ubuntu/nginx:latest`, processes run as root. *Recommend*
pinning digests (e.g. `node:22-bookworm-slim`), adding `USER node`, and a
dependency scan (`npm audit`) in CI. Not changed here to avoid breaking the
volume-mounted dev containers.

### L6. Sensitive data in logs — A09 Logging Failures
Login/insert logs include usernames and document contents. Trim PII from logs;
ensure log volumes are access-controlled. (Auth failures are now logged for
monitoring — A09 detection.)

---

## What changed in this branch (file list)
- `backend/db.js` — null-session rejection, recursive sanitize, sanitizeUpdate,
  unscoped session helpers, generic errors, boot-time SECRET check.
- `backend/auth.js` — input validation, cookie flags, JWT expiry, rate limit,
  timing-safe-ish compare, generic errors.
- `backend/security.js` *(new)* — headers, NoSQL sanitize middleware, login limiter.
- `backend/backend.js` — wired middleware, disabled x-powered-by, fixed CORS, body limit.
- `backend/helpers.js` — safe `getID`/`toObjectId`.
- `backend/chores.js` / `backend/users.js` — POST debug/clear, safe ObjectId.
- `frontend/src/hooks.server.js` — non-spoofable IP, blacklist cap, security headers.
- `frontend/vite.config.js` — removed inert csrf-disable.
- `frontend/src/routes/api/{clearStats,dbgChores}/+server.js` — POST proxies.
- `nginx/nginx.conf` — TLS + security headers + limits.
- `.gitignore`, `.backend.env` (strong secret), `*.env.example` templates.

## Operator checklist (do these before deploying)
1. **Rotate** the TLS key (C1) and scrub git history.
2. **Rotate** the Mongo root password (C3).
3. Confirm `.backend.env` `SECRET` is the strong generated value (C2) and
   `NODE_ENV=production`.
4. Plan removal of `NODE_TLS_REJECT_UNAUTHORIZED=0` (L2).
5. Pin Docker base images and run `npm audit` (L5).
