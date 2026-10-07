# Home Assistant Chat — Design

Status: draft for review · 2026-09-24

## Goal

A chat on the home page backed by a **local** LLM that can do everything a
member can do in the app: recap today, sign chores, add/update/move todos,
manage events, tags, rooms. Voice input in Italian, English and Dutch.

## Hardware constraints

- GPU: RX 5600 XT, 6 GB VRAM (Navi 10 / RDNA1, gfx1010). ROCm 6.x dropped
  RDNA1 → use **llama.cpp Vulkan** backend, no ROCm.
- CPU: Ryzen 3700X 8c/16t, 15 GB RAM → speech-to-text runs on CPU, VRAM
  stays for the LLM.

## Services (compose.yaml)

```
browser ──/api/assistant (SSE)──> frontend ──> backend  /assistant (agent loop)
   │                                              │  tools → own HTTP routes
   └─audio──/api/transcribe──> frontend ──> whisper (CPU)
                                                  └──> llm (llama.cpp Vulkan, GPU)
```

- `llm`: `ghcr.io/ggml-org/llama.cpp:server-vulkan`, devices `/dev/dri`,
  `--jinja` (tool calling), `-ngl 99`, `-c 12288`, model volume
  `./models`. Internal only on `app-network`.
- `whisper`: whisper.cpp server, multilingual `ggml-small` (q5), CPU,
  internal only.

## Model

~4B instruct at Q4_K_M (≈2.5–3.5 GB) leaves room for 8–16k context.
Candidates, picked by a benchmark before build-out:

1. Qwen3.5 small (~4B) / fallback Qwen3-4B-Instruct-2507
2. Gemma 4 E4B

Benchmark: ~30 scripted prompts in IT / EN / NL covering every tool,
relative dates ("dopodomani", "volgende week dinsdag"), multi-step
requests. Score = correct tool + correct args. Also note tok/s and
end-to-end latency.

## Backend: `backend/assistant.js`

Router mounted like the others. `POST /assistant` streams SSE.

### Context sent each turn

System prompt (English) + today's date, weekday, timezone, current member
(from `user` cookie → name), member list, rooms, tags. Instruct: reply in
the language the user wrote in.

### Tools

Tools execute by calling the backend's **own HTTP routes** with the
caller's `session` + `user` cookies. Same validation and side effects as
the UI, zero refactor of route handlers, and signing automatically uses
the member picked on the home page (`req.cookies.user`).

| Tool | Route | Kind |
|---|---|---|
| `today_recap` | events + chores + todos for today | read |
| `list_events(start,end)` | `GET /events` | read |
| `add_event` / `update_event` / `delete_event` | `/events`, `/updateEvent`, `/deleteEvent` | write |
| `list_chores` | `GET /chores` | read |
| `sign_chore(chore, notes?)` | `/chores/sign` | write |
| `skip_chore(chore)` | `/chores/skip` | write |
| `add_chore` / `delete_chore` | `/chores`, `/chores/del` | write |
| `list_todos` | `GET /todos` | read |
| `add_todo` / `update_todo` (done, column, tags) / `delete_todo` | `/todos`, `/updateTodo`, `/deleteTodo` | write |
| `list_tags` / `add_tag` / `delete_tag` | `/tags`, `/deleteTag` | read/write |
| `list_rooms` / `add_room` / `delete_room` | `/rooms`, `/rooms/del` | read/write |
| `get_stats` | `GET /chores/stats` | read |

Model refers to things **by name**; the tool resolves name → `_id`
(case/accent-insensitive, fuzzy). Ambiguous or missing → tool returns the
candidates and the model asks the user.

Not exposed: user management, stats delete/clear, login/sessions, theme.

### Confirmation flow (per-member setting)

New field `users.assistantConfirm` (default `true`), toggled in Settings
via `POST /user/assistant`.

**Confirm ON (default)** — plan, then review:

1. Agent loop runs. Read tools execute. Write tools are **staged**, not
   executed: tool returns `{staged: true, ref: "#3"}` so the model can keep
   planning (and refer to a staged item, e.g. add todo then tag it).
2. Loop ends → backend sends the final message plus the full action list
   `[{ref, tool, args, summary}]` and stores it as a pending plan
   (in-memory, keyed by random id, bound to session + user, 10 min TTL).
3. UI shows the list with a checkbox per action (all on) and
   Confirm / Cancel.
4. `POST /assistant/confirm {planId, refs[]}` → backend executes the
   selected actions **in order, without the LLM**, resolving `#n` refs to
   ids created earlier in the batch. Stops at the first failure and reports
   what ran and what didn't.

**Confirm OFF** — write tools execute immediately during the loop. The
reply still ends with the list of what was done (no buttons).

### Limits

- Max 8 tool calls per turn, max history 20 messages (client-held, sent
  each turn).
- Rate limit `/assistant` per session.
- One request to `llm` at a time (queue); llama.cpp `--parallel 1`.

## Voice

- Mic button on the chat → `MediaRecorder` (webm/opus) → `POST
  /api/transcribe` → backend forwards to `whisper` → text is placed in
  the input box. User can edit it, or it auto-sends (toggle).
- Language: auto-detect limited to `it|en|nl`. If detection is unreliable
  on short clips, add a per-member language setting and pass it to Whisper.
- Mic requires HTTPS, which nginx already provides.

## Frontend

- `lib/components/AssistantChat.svelte` on the home page: collapsible card,
  streamed reply, mic button, action chips ("✓ Signed *Dishes*"),
  plan-review list with checkboxes.
- Proxies: `routes/api/assistant/+server.js` (SSE pass-through),
  `routes/api/assistant/confirm/+server.js`, `routes/api/transcribe/+server.js`,
  `routes/api/assistantSetting/+server.js`.
- After any executed write, home reloads its data (`loadData()`); other
  screens pick changes up on their next `active`.
- Settings: "Assistant asks for confirmation" toggle per member.

## Risks

- A 4B model misreads requests → the review list (default on) is the
  safety net. The benchmark gates model choice.
- Prompt injection via todo/event text is limited to the member's own
  household and their normal permissions.
- VRAM: desktop/compositor usage on the same GPU cuts headroom. Measure.

## Build order

1. `llm` container up, confirm Vulkan sees the GPU, run the benchmark → pick model.
2. `assistant.js`: read tools + recap, SSE, no writes.
3. Write tools + staging + confirm endpoint + per-member setting.
4. Chat UI on the home page.
5. `whisper` service + mic.
