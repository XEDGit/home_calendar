# Assistant prompt queue + stored conversations — design

Date: 2026-10-08

## Goal

Today a chat question that arrives while the model is busy (an automation run can take up to 5 minutes) waits silently inside an open SSE request. Nothing is stored: closing the tab, a dropped connection or a backend restart loses the question and its answer, chat history lives only in the browser component, and staged plans expire after 10 minutes in memory.

1. **One durable queue** for every model prompt: all members' chat questions and all automation runs, executed strictly one at a time (the GPU fits one context).
2. **Feedback while waiting**: the asker sees how many jobs are ahead, then the answer streaming in.
3. **Nothing lost**: a question is stored the moment it is sent and answered even if the page is closed.
4. **Conversation list** like claude.ai: past conversations, reopen one, read the answer, continue it.
5. **Approve later**: staged changes stay reviewable until the member approves or rejects them.

## Decisions

| Topic | Decision |
|---|---|
| Visibility | A conversation is private to the member who started it (household `session` + member `user`) |
| Queue order | Chat before automations; FIFO within each class; a running job is never preempted |
| Done while away | Unread marker: dot on the conversation, count badge on the Assistant nav button. No browser/push notifications |
| Where | New **Assistant** tab (list + conversation). The home panel stays a full chat showing the member's latest conversation |
| Mechanism | Mongo-backed queue + single in-process worker in the backend (approach A) |
| Automations | Same queue (priority 1), same results in `automation_results`, Automations tab unchanged |
| Restart | Interrupted automation jobs are requeued (read-only, safe). Interrupted chat jobs are marked interrupted, never re-run (writes may already have run) |
| History | Rebuilt server-side from stored messages. The client no longer sends `history` |
| Plans | Stored on the message with full action details server-side; client only ever sees summaries; no TTL |

## Architecture

```
browser ──POST /api/assistant──────────────▶ backend: store messages + job, return {conversationId, messageId, ahead}
   ▲                                              │
   │                                         assistant_jobs (Mongo)
   │                                              │  wake
   │                                         worker (one, in backend process)
   │                                              │  runAgent → llm
   │                                              ▼
   └──GET /api/assistantEvents (SSE) ◀── in-process event bus ── saves results to assistant_messages
```

The backend runs as a single replica with `strategy: Recreate` (k3s manifest), so exactly one worker exists. This is a requirement: never scale the backend above 1 replica without first adding a distributed lock.

New module **`backend/assistantQueue.js`** owns the queue, the worker loop and the event bus. `assistant.js` keeps the agent loop (`runAgent`, `complete`, prompts, history) and the HTTP routes. `automations.js` enqueues instead of calling `exclusive()`. `exclusive()` is removed.

## Data model

All documents carry `session` = the household id from `db.getSession(token)` (same tenancy field as every other collection) and `user` = the member id (the `user` cookie). Every query filters by both.

### `assistant_conversations`

```
{ _id, session, user, title, createdAt, updatedAt, unread: bool }
```

- `title`: first question, trimmed to 60 characters. Not editable.
- `unread`: set `true` when a chat job in it ends (done, error or interrupted); set `false` when the member opens it.
- `updatedAt`: bumped on every new message and on job end; the list is sorted by it.
- Deleted only by the member (messages and queued jobs go with it). No automatic deletion.

Index: `{ session: 1, user: 1, updatedAt: -1 }`.

### `assistant_messages`

```
{ _id, session, user, conversationId, role: 'user'|'assistant',
  content: string,
  status: 'queued'|'running'|'done'|'error'|'cancelled'|'interrupted',   // assistant messages only
  error: string|null,
  tools: [{ name, summary, error, staged, done }],
  plan: { state: 'review'|'running'|'finished'|'rejected',
          actions: [ <exec.staged action, full> ],
          results: [{ ref, status, error? }] } | null,
  doneActions: [{ ref, tool, summary }] | null,
  createdAt, updatedAt }
```

- Sending a question inserts the user message and an empty assistant message (`status: 'queued'`) together.
- While running, `content` and `tools` are saved at most once per second, and finally at the end.
- `plan.actions` is never sent to the client; see "Client view of a message".

Index: `{ conversationId: 1, createdAt: 1 }`.

### `assistant_jobs`

```
{ _id, kind: 'chat'|'automation', priority: 0|1,
  status: 'queued'|'running'|'done'|'error'|'cancelled'|'interrupted',
  session, user,                          // chat: the member; automation: createdBy of the automation
  conversationId, messageId,              // chat only
  automationId,                           // automation only
  createdAt, startedAt, finishedAt }
```

- Next job: `{ status: 'queued' }` sorted `{ priority: 1, createdAt: 1 }`, claimed with one `findOneAndUpdate` setting `status: 'running', startedAt`.
- Finished jobs are removed by a TTL index on `finishedAt` (`expireAfterSeconds: 604800`, 7 days). Queued/running jobs have no `finishedAt` and never expire.

Indexes: `{ status: 1, priority: 1, createdAt: 1 }`, TTL `{ finishedAt: 1 }`.

Indexes are created at backend startup (`createIndex` is idempotent). No migration: all three collections are new.

## Queue and worker (`backend/assistantQueue.js`)

### Storage interface

The module talks to Mongo through a small store object (insert job, claim next, finish, cancel, count ahead, recover). Production passes the Mongo implementation; tests pass an in-memory fake. Job handlers are registered by kind (`chat` from `assistant.js`, `automation` from `automations.js`), so the queue module has no model or HTTP knowledge.

### Enqueue

`enqueue(job)` inserts the job and wakes the worker (an in-process promise/flag, no polling while idle). After every enqueue, claim, finish and cancel, the module recomputes `ahead` for every queued chat job and emits a `queue` event to its owner.

`ahead(job)` = running jobs + queued jobs with lower `priority`, or the same `priority` and an earlier `createdAt`. A later chat question can therefore increase an automation's `ahead`; that is intended.

Limits on chat enqueue:
- Existing per-household rate limit stays (`rateLimited`, 20 per minute) → 429.
- At most **5** queued + running chat jobs per member → 429 `Wait for your earlier questions first`.

### Worker loop

```
loop:
  job = claimNext()            // atomic queued → running
  if none: wait for wake
  try   handler[job.kind](job, ctx)    // ctx: { emit, signal, saveProgress }
  catch mark job error (log), continue
  finish(job, status)
```

A handler throwing never stops the loop. Each job gets an `AbortController`: aborted by the 5-minute timeout or by a member's Stop.

### Chat handler (in `assistant.js`)

1. Load the member (`users` by `_id` + `session`). Missing member → message `error` ("Member no longer exists").
2. Mint a short-lived session token at run start, exactly like automations do: `jwt.sign({ session: job.session }, SECRET, { expiresIn: '15m' })`, cookie `session=<token>; user=<memberId>`. The asker's own cookie may have expired by the time the job runs.
3. `createExecutor({ cookie, userId, stage: member.assistantConfirm !== false })`, read at run time.
4. Messages: `systemPrompt(member, householdContext(exec))` + history rebuilt from this conversation's earlier messages (user messages and assistant messages with `status: 'done'` and non-empty `content`, through the existing `cleanHistory` limits: `MAX_HISTORY`, `MAX_MESSAGE`, and `fitContext`) + `userTurn(question)`.
5. `runAgent({ messages, exec, signal, onText, onTool, stop })`: `onText`/`onTool` update the message in memory, emit `text`/`tool` events and trigger the throttled save.
6. End: store `content`, `tools`, `plan` (if `exec.staged.length`: `{ state: 'review', actions: exec.staged, results: [] }`), `doneActions`, `status: 'done'` (or `'cancelled'` when stopped by the member: partial content is kept). Mark the conversation `unread: true`, bump `updatedAt`, emit `plan`/`done_actions`/`end`, emit the member's new `unread` count.
7. Errors: model unreachable or HTTP error → `status: 'error'`, `error: 'The assistant is unavailable right now'`. Timeout → `'error'`, `'Took too long, try again'`.

### Automation handler (in `automations.js`)

The current `report(doc)` minus its `exclusive()` wrapper, followed by the existing `finishRun`. Its `RUN_TIMEOUT_MS` now starts when the worker picks the job, which preserves today's rule that queue wait never counts against an automation's budget.

Claiming stays as today: `runAutomation` sets `runningSince` (the "already running" guard), then **enqueues** a job instead of running inline. `runningSince` therefore means "queued or running". `POST /automations/run` keeps answering `202 { started: true }` / `409 already running`.

### Restart recovery

At startup, before the worker starts and before `startScheduler()`'s own recovery:

- `running` automation jobs → `status: 'queued'`, `startedAt: null` (re-run; automations are read-only).
- `running` chat jobs → job `interrupted`; message `status: 'interrupted'`, `error: 'Interrupted by a restart, send it again'`; conversation `unread: true`.

`startScheduler()`'s recovery changes: it records "interrupted by a restart" only for automations with `runningSince` set **and no queued/running job**. Automations with a requeued job keep their claim and simply run again.

### Cancel and stop

- Queued job → `cancelled`, message `status: 'cancelled'`, `ahead` recomputed for the others.
- Running chat job → its `AbortController` is aborted; `runAgent` stops at once (the in-flight model request is aborted), and the handler stores what was produced with `status: 'cancelled'`.
- Automation jobs cannot be cancelled from the chat UI (out of scope).

## API

Backend routes live in `assistant.js`. Each gets a SvelteKit proxy in `frontend/src/routes/api/<name>/+server.js` following the existing `getBackend`/`postBackend` pattern. Every route resolves `session` via `db.getSession(req.cookies.session)` and the member via the `user` cookie, and returns **404** for any conversation/message not owned by both.

| Backend | Frontend proxy | Behaviour |
|---|---|---|
| `POST /assistant` `{ message, conversationId? }` | `/api/assistant` | Validates (`MAX_MESSAGE`), checks limits, creates the conversation if needed, inserts user + assistant messages and the job. Returns **201** `{ conversationId, messageId, ahead }`. No longer an SSE stream. |
| `GET /assistant/conversations` | `/api/assistantConversations` | `[{ _id, title, updatedAt, unread, busy }]`, newest first, max 100. `busy` = has a queued/running message. Plus `unreadCount`. |
| `GET /assistant/conversations/:id` | `/api/assistantConversation?id=` | Conversation + messages (client view). Sets `unread: false`, emits new `unread` count. |
| `DELETE /assistant/conversations/:id` | `/api/assistantDeleteConversation` | 409 if a message in it is `running`. Otherwise cancels its queued jobs and deletes conversation + messages. |
| `POST /assistant/cancel` `{ messageId }` | `/api/assistantCancel` | Cancel if queued, stop if running, 409 if already finished. |
| `POST /assistant/confirm` `{ messageId, refs }` | `/api/assistantConfirm` (body changes from `planId`) | Atomically `plan.state: 'review' → 'running'` (else 409 with current state). Runs selected actions in order with `runAction(action, <requester's cookie>, ids)`, the same stop-at-first-failure logic as today, stores `results`, sets `'finished'`, returns `{ results }`. |
| `POST /assistant/plan/cancel` `{ messageId }` | `/api/assistantPlanCancel` | `'review' → 'rejected'` (else 409). |
| `GET /assistant/events` | `/api/assistantEvents` | SSE for this member (see below). |

### Client view of a message

```
{ _id, role, content, status, error, tools, doneActions, createdAt,
  plan: { state, results, actions: [{ ref, tool, summary, deps }] } | null }
```

`deps` comes from the existing `actionDeps(action)`. Action arguments never leave the server.

### Event stream

`GET /assistant/events` keeps the response open (`text/event-stream`, heartbeat comment every 15 s, `X-Accel-Buffering: no` on the proxy). The bus delivers only events whose `session` + `user` match the stream's member. Every event carries `conversationId` and `messageId` where relevant:

| type | payload |
|---|---|
| `queue` | `{ ahead }` |
| `start` | — |
| `text` | `{ text }` |
| `tool` | `{ name, summary, error, staged, done }` |
| `plan` | `{ plan }` (client view) |
| `done_actions` | `{ actions }` |
| `end` | `{ status }` |
| `error` | `{ error }` |
| `unread` | `{ count }` |

Events are a live convenience, not the source of truth: after (re)connecting, the client reloads the list and the open conversation from the REST routes.

## Frontend

### `lib/assistant/store.js` (new)

One store for the whole page:
- Opens one `EventSource('/api/assistantEvents')` once a member is picked; closes and reopens when the member changes (member switch on home sets the `user` cookie).
- Holds `conversations`, `unreadCount`, and the loaded messages of open conversations.
- Applies events to the matching message (queue position, appended text, tools, plan, end).
- On `open` after a reconnect: reloads the list and any open conversation.
- Actions: `send(text, conversationId?)`, `open(id)`, `newChat()`, `cancel(messageId)`, `confirm(messageId, refs)`, `rejectPlan(messageId)`, `remove(id)`.

### Components (split of `AssistantChat.svelte`, 480 lines)

- `lib/assistant/AssistantThread.svelte`: messages, tool chips, plan review list (same UI as today, now driven by stored state), per-message status line.
- `lib/assistant/AssistantInput.svelte`: text input + voice button (existing `/api/transcribe` flow unchanged). On a 429/503 the text stays in the box and the error is shown.
- `lib/components/AssistantChat.svelte` becomes the home panel: Thread + Input for the member's **most recent conversation**, header buttons **New** and **All chats →** (navigates to the Assistant tab with that conversation open).
- `lib/menus/assistant/assistant.svelte` (new tab): conversation list + Thread + Input. Desktop: list left, conversation right. Phone: list full screen, tap opens the conversation, back returns. List row: title, relative time, unread dot, "waiting"/"answering" marker. **New chat** at the top; delete asks for confirmation.

### Message states

- `queued`: "Waiting — N ahead of you" + **Cancel**.
- `running`: streaming text and tool chips + **Stop**.
- `cancelled` / `error` / `interrupted`: one line explaining it + **Ask again** (sends the same question as a new message in the same conversation).

### Navigation

Add `'assistant'` to `VIEWS` in `params/view.js` and to `pageNames` in `routes/+page.svelte`; new `Screen name="assistant"` and nav button with the unread badge. The tab follows the `Screen` contract (`active`, `onReady`).

Styling uses the existing tokens (`lib/design/tokens.css`, member theme `--primary`/`--paper`) and follows `DESIGN.md`.

## Error handling

| Situation | Behaviour |
|---|---|
| Model unreachable / HTTP error | Message `error` "The assistant is unavailable right now"; worker continues with the next job |
| Run exceeds 5 min | Aborted; `error` "Took too long, try again" (chat) / existing "timed out" (automation) |
| Mongo error on send | 503; input keeps the text |
| Handler throws | Job + message `error`, logged; loop continues |
| Double confirm / confirm after reject | 409 with current `plan.state`; UI shows that state |
| Not owner / other household | 404 |
| Queue cap reached | 429 "Wait for your earlier questions first" |
| Stream drops | `EventSource` auto-reconnects; client reloads from REST |
| Backend restart | Recovery rules above |

## Testing

Backend (`node --test`, no DB, in `backend/test/`):
- Claim order: chat before automation, FIFO within class, running job not preempted.
- A job is claimed once (two concurrent `claimNext` calls on the fake → one winner).
- `ahead` values, including a later chat raising an automation's `ahead`.
- Per-member cap (5) and that finished jobs don't count.
- Cancel queued; stop running (abort reaches the handler; partial content kept as `cancelled`).
- Handler throwing → job `error`, next job still runs.
- Restart recovery: running automation → queued; running chat → interrupted; scheduler recovery skips automations with an active job.
- History rebuild: only done/non-empty assistant messages, limits applied, current question last.
- Client view strips `plan.actions` down to `{ ref, tool, summary, deps }`.
- Plan confirm state machine: review → running → finished; second confirm 409; reject then confirm 409.
- Ownership check helper: other member / other session → not found.
- Existing tests keep passing.

Frontend (no test runner): `npm run build` passes, then manual checks in the deployed app:
- Ask while an automation runs: "Waiting — 1 ahead" counts down, answer streams.
- Close the tab while queued, reopen later: answer present, unread dot + badge, cleared on open.
- Staged plan approved after a backend restart (plans survive), double-click Do it runs once.
- Stop a running answer; Cancel a queued one; Ask again after an error.
- Switch member on home: list and stream switch to that member; other member's conversations not visible.
- Phone layout of the Assistant tab.

## Rollout

1. Build new backend + frontend images from this repo (new tag), push to the k3s registry, update `~/k3s/home-calendar/calendar.yaml`, apply.
2. Verify automations still run through the queue (Run now on one automation, result appears in the Automations tab).
3. Manual checklist above.

Nothing to migrate: chats were never stored server-side. An already-open old tab sending a request without `conversationId` simply starts a new conversation.

## Out of scope

Renaming or searching conversations, sharing between members, browser/push notifications, automatic deletion of old conversations, cancelling automation runs from the chat UI, multiple backend replicas, the AH automation step-limit behaviour.
