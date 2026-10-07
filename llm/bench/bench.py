#!/usr/bin/env python3
"""Tool-calling benchmark for the home assistant model pick.

Runs scripted IT/EN/NL requests against a llama.cpp server (OpenAI API) with
a mock household. Write tools are staged, not executed, like the real
confirm flow. A case passes when every expected call was made with matching
args and no unexpected write was staged.

usage: bench.py http://localhost:8080 [--think] [--out results.json]
"""
import json, re, sys, time, unicodedata, urllib.request, argparse

TODAY = "2026-09-24"  # Thursday

# ── Mock household ──────────────────────────────────────────────────────────
MEMBERS = ["Marco", "Anna", "Pieter"]
ME = "Marco"
ROOMS = ["Kitchen", "Living room", "Bedroom", "Bathroom"]
TAGS = ["Groceries", "Work", "House", "Personal"]
CHORES = [
    {"name": "Dishes", "rooms": ["Kitchen"], "every_days": 1, "due": "2026-09-24"},
    {"name": "Take out trash", "rooms": ["Kitchen"], "every_days": 2, "due": "2026-09-24"},
    {"name": "Water plants", "rooms": ["Living room"], "every_days": 3, "due": "2026-09-24"},
    {"name": "Vacuum living room", "rooms": ["Living room"], "every_days": 7, "due": "2026-09-25"},
    {"name": "Vacuum bedroom", "rooms": ["Bedroom"], "every_days": 7, "due": "2026-09-27"},
]
TODOS = [
    {"title": "Chiamare idraulico", "done": False, "tag": "House"},
    {"title": "Fix bike", "done": False, "tag": "Personal"},
    {"title": "Buy bread", "done": False, "tag": "Groceries"},
    {"title": "Buy detergent", "done": False, "tag": "Groceries"},
    {"title": "Send invoice", "done": False, "tag": "Work"},
]
EVENTS = [
    {"title": "Dentist", "when": "2026-09-25T10:00"},
    {"title": "Riunione condominio", "when": "2026-09-30T21:00"},
    {"title": "Anna's birthday dinner", "when": "2026-10-02T19:30"},
]

CALENDAR = """This week: Mon 2026-09-21, Tue 2026-09-22, Wed 2026-09-23, Thu 2026-09-24 (today), Fri 2026-09-25 (tomorrow), Sat 2026-09-26 (day after tomorrow), Sun 2026-09-27
Next week: Mon 2026-09-28, Tue 2026-09-29, Wed 2026-09-30, Thu 2026-10-01, Fri 2026-10-02, Sat 2026-10-03, Sun 2026-10-04
Later: Mon 2026-10-05, Tue 2026-10-06, Wed 2026-10-07, Thu 2026-10-08, Fri 2026-10-09, Sat 2026-10-10, Sun 2026-10-11"""

# Mirror of systemPrompt() in backend/assistant.js — keep in sync
SYSTEM = f"""You are the assistant of a shared household app with a calendar (events), chores and todos.
You act for the member currently using the app by calling tools.

Today is {TODAY}, timezone Europe/Rome. The user's message starts with the current time.
{CALENDAR}

Current member: {ME}. Members: {", ".join(MEMBERS)}.
Rooms: {", ".join(ROOMS)}.
Tags: {", ".join(TAGS)}.
Chores: {"; ".join(f'{c["name"]} (due {"today" if c["due"] <= TODAY else "in " + str(int(c["due"][-2:]) - 24) + "d"})' for c in CHORES)}.
Open todos: {"; ".join(f'{t["title"]} (tag {t["tag"]})' for t in TODOS)}.
Events in the next 14 days: {"; ".join(f'{e["title"]} ({e["when"].replace("T", " ")})' for e in EVENTS)}.

Rules:
- Take every date from the calendar above; never work out weekdays yourself.
- Refer to existing chores, todos, events, tags and rooms by their exact name from the lists above.
  The user may name them in another language: map to the existing name.
- If more than one existing item fits, ask which one and change nothing.
  Example: chores "Clean sink" and "Clean toilet" exist and the user says "I cleaned" → ask which.
- "The X list" or "my X things" means the todos tagged X.
- When a request covers several items, call the tool once for each item.
- New todos and events: keep the user's own words and language for the title
  ("add buy milk" -> "Buy milk"; "aggiungi comprare il latte" -> "Comprare il latte"). Set only the fields the user asked for.
- Questions about the calendar, agenda or schedule: use list_events. Questions about today: today_recap.
- Dates as YYYY-MM-DD, times as YYYY-MM-DDTHH:MM (24h, local time).
- Changes may be staged for the user's review; a staged change counts as done.
  A staged item returns a ref like "#1" for later tool calls only: never show refs to the user.
- Do only what was asked. Reply briefly, in the language the user wrote in."""

def fn(name, desc, props=None, required=None):
    return {"type": "function", "function": {"name": name, "description": desc,
            "parameters": {"type": "object", "properties": props or {}, "required": required or []}}}

S = {"type": "string"}
DATE = {"type": "string", "description": "YYYY-MM-DD"}
PRIO = {"type": "string", "enum": ["none", "low", "medium", "high"]}
DT = {"type": "string", "description": "YYYY-MM-DDTHH:MM, or YYYY-MM-DD when no time is given"}
TOOLS = [
    fn("today_recap", "Today's events, chores due and open todos for the household."),
    fn("list_events", "Calendar events between two dates (inclusive), repeating events expanded.",
       {"start_date": DATE, "end_date": DATE}, ["start_date", "end_date"]),
    fn("add_event", "Create a calendar event.",
       {"title": S, "when": DT, "location": S, "description": S,
        "repeat": {"type": "string", "enum": ["daily", "weekly", "monthly", "yearly"]}}, ["title", "when"]),
    fn("update_event", "Change an existing event. Only pass fields that change.",
       {"event": {"type": "string", "description": "event title"}, "title": S, "when": DT, "location": S,
        "description": S, "repeat": {"type": "string", "enum": ["none", "daily", "weekly", "monthly", "yearly"]}},
       ["event"]),
    fn("delete_event", "Delete an event.", {"event": S}, ["event"]),
    fn("list_chores", "All chores with rooms, frequency and due date."),
    fn("sign_chore", "Record that the current member did a chore.",
       {"chore": S, "rooms": {"type": "array", "items": S, "description": "only if some rooms were done"},
        "notes": S}, ["chore"]),
    fn("skip_chore", "Skip a chore this time (moves its due date without recording it as done).",
       {"chore": S}, ["chore"]),
    fn("add_chore", "Create a recurring chore.",
       {"name": S, "every_days": {"type": "integer"}, "rooms": {"type": "array", "items": S}},
       ["name", "every_days", "rooms"]),
    fn("delete_chore", "Delete a chore.", {"chore": S}, ["chore"]),
    fn("list_todos", "Todos of the current member plus shared ones.",
       {"include_done": {"type": "boolean"}}),
    fn("add_todo", "Create a todo.",
       {"title": S, "description": S, "deadline": DATE, "tag": S, "priority": PRIO,
        "shared": {"type": "boolean", "description": "visible to the whole household"}}, ["title"]),
    fn("update_todo", "Change a todo: mark done, rename, retag, reprioritise.",
       {"todo": {"type": "string", "description": "todo title or staged ref"}, "done": {"type": "boolean"},
        "title": S, "deadline": DATE, "tag": S, "priority": PRIO}, ["todo"]),
    fn("delete_todo", "Delete a todo.", {"todo": S}, ["todo"]),
    fn("list_tags", "All tags."),
    fn("add_tag", "Create a tag.", {"name": S}, ["name"]),
    fn("delete_tag", "Delete a tag.", {"tag": S}, ["tag"]),
    fn("list_rooms", "All rooms."),
    fn("add_room", "Create a room.", {"name": S}, ["name"]),
    fn("delete_room", "Delete a room.", {"room": S}, ["room"]),
    fn("get_stats", "Chore completion counts per member.",
       {"period": {"type": "string", "enum": ["week", "month", "year", "all"]}}),
]
WRITES = {"add_event", "update_event", "delete_event", "sign_chore", "skip_chore", "add_chore",
          "delete_chore", "add_todo", "update_todo", "delete_todo", "add_tag", "delete_tag",
          "add_room", "delete_room"}

# ── Mock executor ───────────────────────────────────────────────────────────
# Mirror of resolve() in backend/assistantTools.js — keep in sync
def _norm(x):
    return unicodedata.normalize("NFD", str(x or "")).encode("ascii", "ignore").decode().lower().strip()

def _words(x):
    return {w for w in re.split(r"[^a-z0-9]+", _norm(x)) if len(w) > 2}

def resolve(name, items, staged):
    if isinstance(name, str) and name.startswith("#") and name in staged:
        return {"ok": name}
    q = _norm(name)
    if not q:
        return {"error": "missing name"}
    exact = [i for i in items if _norm(i) == q]
    if len(exact) == 1:
        return {"ok": exact[0]}
    partial = [i for i in items if q in _norm(i) or _norm(i) in q]
    if not partial:
        qw = _words(name)
        partial = [i for i in items if _words(i) and _words(i) <= qw]
    if len(partial) == 1:
        return {"ok": partial[0]}
    if partial:
        return {"error": f'"{name}" matches more than one item. Ask the user which one they mean; do not pick one yourself',
                "candidates": partial}
    return {"error": f'nothing named "{name}". If one of the candidates is clearly what the user meant, call again with its exact name; otherwise ask',
            "candidates": items}

REF_ARG = {"update_event": ("event", lambda: [e["title"] for e in EVENTS]),
           "delete_event": ("event", lambda: [e["title"] for e in EVENTS]),
           "sign_chore": ("chore", lambda: [c["name"] for c in CHORES]),
           "skip_chore": ("chore", lambda: [c["name"] for c in CHORES]),
           "delete_chore": ("chore", lambda: [c["name"] for c in CHORES]),
           "update_todo": ("todo", lambda: [t["title"] for t in TODOS]),
           "delete_todo": ("todo", lambda: [t["title"] for t in TODOS]),
           "delete_tag": ("tag", lambda: TAGS), "delete_room": ("room", lambda: ROOMS)}

def execute(name, args, staged):
    if name in REF_ARG:
        key, items = REF_ARG[name]
        r = resolve(args.get(key), items(), staged)
        if "error" in r:
            return r
    if name in WRITES:
        ref = f"#{len(staged) + 1}"
        staged[ref] = (name, args)
        return {"staged": True, "ref": ref}
    if name == "today_recap":
        return {"events": [], "chores_due": [c for c in CHORES if c["due"] == TODAY],
                "todos": TODOS}
    if name == "list_events":
        s, e = args.get("start_date", ""), args.get("end_date", "") + "T99"
        return {"events": [ev for ev in EVENTS if s <= ev["when"] <= e]}
    if name == "list_chores": return {"chores": CHORES}
    if name == "list_todos": return {"todos": TODOS}
    if name == "list_tags": return {"tags": TAGS}
    if name == "list_rooms": return {"rooms": ROOMS}
    if name == "get_stats":
        return {"period": args.get("period", "month"), "counts": {"Marco": 12, "Anna": 17, "Pieter": 9}}
    return {"error": "unknown tool"}

# ── Cases ───────────────────────────────────────────────────────────────────
def has(sub):   return lambda v: isinstance(v, str) and sub.lower() in v.lower()
def anyof(*s):  return lambda v: isinstance(v, str) and any(x.lower() in v.lower() for x in s)
def eq(x):      return lambda v: v == x
def starts(x):  return lambda v: isinstance(v, str) and v.startswith(x)
def contains(x): return lambda v: isinstance(v, list) and any(x.lower() == i.lower() for i in v)
def between(a, b): return lambda v: isinstance(v, str) and a <= v[:10] <= b

# expect: list of (tool, {arg: check}); forbid: tools that must not be staged
CASES = [
    # Italian
    ("it", "Cosa devo fare oggi?", [("today_recap", {})]),
    ("it", "Ho lavato i piatti", [("sign_chore", {"chore": eq("Dishes")})]),
    ("it", "Aggiungi latte e uova alla lista della spesa",
     [[("add_todo", {"title": has("latte"), "tag": eq("Groceries")}),
       ("add_todo", {"title": has("uova"), "tag": eq("Groceries")})],
      [("add_todo", {"title": lambda v: has("latte")(v) and has("uova")(v), "tag": eq("Groceries")})]]),
    ("it", "Dopodomani alle 15 dentista",
     [("add_event", {"title": anyof("dent"), "when": eq("2026-09-26T15:00")})]),
    ("it", "Ho chiamato l'idraulico, segnalo come fatto",
     [("update_todo", {"todo": eq("Chiamare idraulico"), "done": eq(True)})]),
    ("it", "Oggi salto la spazzatura", [("skip_chore", {"chore": eq("Take out trash")})]),
    ("it", "Cosa c'è in calendario la settimana prossima?",
     [("list_events", {"start_date": between("2026-09-25", "2026-09-28"),
                       "end_date": between("2026-10-03", "2026-10-05")})]),
    ("it", "Elimina la riunione di condominio", [("delete_event", {"event": eq("Riunione condominio")})]),
    ("it", "Nuova faccenda: pulire il bagno ogni 7 giorni",
     [("add_chore", {"name": anyof("bagno", "bathroom"), "every_days": eq(7), "rooms": contains("Bathroom")})]),
    ("it", "Ho passato l'aspirapolvere", "ask"),
    # English
    ("en", "What's on today?", [("today_recap", {})]),
    ("en", "I took out the trash and watered the plants",
     [("sign_chore", {"chore": eq("Take out trash")}), ("sign_chore", {"chore": eq("Water plants")})]),
    ("en", "Add a todo to renew my passport by October 15, tag it personal",
     [("add_todo", {"title": has("passport"), "deadline": eq("2026-10-15"), "tag": eq("Personal")})]),
    ("en", "Make fix bike high priority", [("update_todo", {"todo": eq("Fix bike"), "priority": eq("high")})]),
    ("en", "Football training every Monday at 8pm, starting next week",
     [("add_event", {"title": anyof("football"), "when": eq("2026-09-28T20:00"), "repeat": eq("weekly")})]),
    ("en", "Push the dentist appointment to 4pm",
     [("update_event", {"event": eq("Dentist"), "when": eq("2026-09-25T16:00")})]),
    ("en", "Add a room called Garage and a chore to sweep it every 14 days",
     [("add_room", {"name": eq("Garage")}),
      ("add_chore", {"name": has("sweep"), "every_days": eq(14), "rooms": contains("Garage")})]),
    ("en", "Delete the Work tag", [("delete_tag", {"tag": eq("Work")})]),
    ("en", "Who did the most chores this month?", [("get_stats", {})]),
    ("en", "I bought everything on the grocery list, tick it off",
     [("update_todo", {"todo": eq("Buy bread"), "done": eq(True)}),
      ("update_todo", {"todo": eq("Buy detergent"), "done": eq(True)})]),
    # Dutch
    ("nl", "Wat moet ik vandaag doen?", [("today_recap", {})]),
    ("nl", "Ik heb de afwas gedaan", [("sign_chore", {"chore": eq("Dishes")})]),
    ("nl", "Zet melk kopen op mijn lijstje", [("add_todo", {"title": has("melk")})]),
    ("nl", "Morgen om 9 uur afspraak bij de huisarts",
     [("add_event", {"title": has("huisarts"), "when": eq("2026-09-25T09:00")})]),
    ("nl", "Volgende week dinsdag is oma jarig, de hele dag",
     [("add_event", {"title": has("oma"), "when": starts("2026-09-29")})]),
    ("nl", "Sla het water geven van de planten over", [("skip_chore", {"chore": eq("Water plants")})]),
    ("nl", "Verwijder de taak fiets repareren", [("delete_todo", {"todo": eq("Fix bike")})]),
    ("nl", "Wat staat er deze week in de agenda?",
     [("list_events", {"start_date": between("2026-09-21", "2026-09-24"),
                       "end_date": between("2026-09-27", "2026-09-28")})]),
    ("nl", "Maak een nieuwe tag Tuin", [("add_tag", {"name": eq("Tuin")})]),
    ("nl", "Ik heb gestofzuigd", "ask"),
]

# ── Runner ──────────────────────────────────────────────────────────────────
def chat(base, messages, think):
    body = {"messages": messages, "tools": TOOLS, "temperature": 0.2,
            "chat_template_kwargs": {"enable_thinking": think}}
    req = urllib.request.Request(base + "/v1/chat/completions", json.dumps(body).encode(),
                                 {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)

LANG_NAMES = {"it": "Italian", "en": "English", "nl": "Dutch"}

def run_case(base, prompt, think, lang):
    # Mirrors userTurn() in backend/assistant.js
    messages = [{"role": "system", "content": SYSTEM},
                {"role": "user", "content": f"[09:30, reply in {LANG_NAMES[lang]}] {prompt}"}]
    staged, calls, gen_tokens, gen_ms = {}, [], 0, 0
    t0 = time.time()
    for _ in range(8):
        resp = chat(base, messages, think)
        t = resp.get("timings", {})
        gen_tokens += t.get("predicted_n", 0); gen_ms += t.get("predicted_ms", 0)
        msg = resp["choices"][0]["message"]
        tcs = msg.get("tool_calls") or []
        messages.append({k: v for k, v in msg.items() if k in ("role", "content", "tool_calls")})
        if not tcs:
            break
        for tc in tcs:
            name = tc["function"]["name"]
            try:
                args = json.loads(tc["function"]["arguments"] or "{}")
            except json.JSONDecodeError:
                args = {"_bad_json": tc["function"]["arguments"]}
            result = execute(name, args, staged)
            calls.append({"tool": name, "args": args, "result": result})
            messages.append({"role": "tool", "tool_call_id": tc.get("id", ""), "content": json.dumps(result)})
    return {"calls": calls, "staged": list(staged.values()), "reply": msg.get("content") or "",
            "secs": time.time() - t0, "tok_s": gen_tokens / (gen_ms / 1000) if gen_ms else 0}

def score(expect, out):
    if expect != "ask" and expect and isinstance(expect[0], list):  # alternatives
        return any(score(alt, out) for alt in expect)
    staged = out["staged"]
    if expect == "ask":  # ambiguous: must not stage a write, must ask
        return not staged
    matched = []
    for tool, checks in expect:
        pool = staged if tool in WRITES else [(c["tool"], c["args"]) for c in out["calls"]]
        hit = next((i for i, (n, a) in enumerate(pool)
                    if n == tool and all(chk(a.get(k)) for k, chk in checks.items())
                    and (tool not in WRITES or i not in matched)), None)
        if hit is None:
            return False
        if tool in WRITES:
            matched.append(hit)
    return len(staged) == len(matched)  # no extra writes

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base"); ap.add_argument("--think", action="store_true"); ap.add_argument("--out")
    a = ap.parse_args()
    results, by_lang = [], {}
    for lang, prompt, expect in CASES:
        out = run_case(a.base, prompt, a.think, lang)
        ok = score(expect, out)
        by_lang.setdefault(lang, []).append(ok)
        results.append({"lang": lang, "prompt": prompt, "ok": ok, **out,
                        "staged": [[n, x] for n, x in out["staged"]]})
        calls = ", ".join(f'{c["tool"]}({json.dumps(c["args"], ensure_ascii=False)})' for c in out["calls"])
        print(f'{"PASS" if ok else "FAIL"} [{lang}] {out["secs"]:5.1f}s  {prompt}\n      {calls or "-"}'
              + ("" if ok else f'\n      reply: {out["reply"][:160]!r}'), flush=True)
    total = sum(r["ok"] for r in results)
    secs = [r["secs"] for r in results]; toks = [r["tok_s"] for r in results if r["tok_s"]]
    print(f"\nTOTAL {total}/{len(results)}  " + "  ".join(f"{l}:{sum(v)}/{len(v)}" for l, v in by_lang.items())
          + f"  avg {sum(secs)/len(secs):.1f}s/case  gen {sum(toks)/max(len(toks),1):.0f} tok/s")
    if a.out:
        json.dump(results, open(a.out, "w"), indent=1, ensure_ascii=False, default=str)

if __name__ == "__main__":
    main()
