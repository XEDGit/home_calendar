# design/ — Home Calendar design system bundle

Portable design-system bundle for "The Warm Ledger" — extracted from the live app styling and unified (one border width, one radius scale, one size per control class). Repurpose it in another project or hand the whole folder to a design tool / Claude as context.

## Files

| File | What it is |
|---|---|
| [tokens.css](tokens.css) | All design tokens as CSS custom properties. Drop into any project; everything else references these. |
| [palette.json](palette.json) | Palette as machine-readable JSON (brand, status, tints, usage notes, rules). |
| [palette.md](palette.md) | Same palette, human-readable with usage table and named rules. |
| [components.md](components.md) | Component specs: buttons, chips, inputs, cards, modals, nav, status vocabulary. |

Root-level mirrors (kept in sync, consumed by tooling):

- `/DESIGN.md` — full design-system narrative (frontmatter + prose), used by the impeccable context loader.
- `/DESIGN.json` — generated machine bundle with OKLCH ramps and component snippets.
- `/PRODUCT.md` — product context (users, brand personality, anti-references).

## Source of truth in the app

The app imports `frontend/src/lib/design/tokens.css` (identical copy of [tokens.css](tokens.css)) through `frontend/src/routes/+layout.svelte` → `frontend/src/lib/general.css`. Shared control classes (`.btn`, `.btn-solid`, `.btn-ghost`, `.btn-danger`, `.btn-block`, `.chip`) live in `general.css`.

**If you change a token:** edit `frontend/src/lib/design/tokens.css`, then copy it here (`cp frontend/src/lib/design/tokens.css design/tokens.css`).

## The system in one paragraph

Dusty rose (`#8F5C66`) and warm cream (`#FFEAD0`) form a closed two-color system; every hover/active state is a full inversion between them. Rose carries text on cream (4.6:1, AA); teal ink is reserved for long-form reading text. One typeface (Libre Franklin via `--font-sans`), hierarchy by weight (400/700) and a 1.2 rem scale (`--text-xs` to `--text-xl`). One border width (2px) on every control, 1px hairlines for dividers. Radius scale: 5 / 7 / 10 px + pills and circles. Flat at rest; shadows only as interaction feedback. Status speaks through small colored dots and badges (urgent / warn / ok / muted), and delete-red appears exclusively on destructive buttons.
