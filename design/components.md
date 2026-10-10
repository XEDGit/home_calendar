# Components — unified spec

Every value below maps to a token in [tokens.css](tokens.css). One size per control class; one border width (`--bw: 2px`) for every bordered control, hairlines (`--bw-hair: 1px`) for dividers and dense grids only.

## Control classes (global, in `frontend/src/lib/general.css`)

| Class | Padding | Min height | Radius | Border | Colors |
|---|---|---|---|---|---|
| `.btn` (base) | `8px 14px` | `40px` | `--radius-md` (7px) | `--bw` rose | — |
| `.btn-solid` | — | — | — | — | rose bg / cream text, inverts on hover |
| `.btn-ghost` | — | — | — | — | cream bg / rose text, inverts on hover |
| `.btn-danger` | — | — | — | `--bw` danger | danger bg / cream text, inverts on hover |
| `.btn-block` | `13px` | — | `--radius-md` | inherits | full width, `1.05rem` |
| `.chip` | `5px 12px` | — | `--radius-pill` | `--bw` rose | cream/rose, inverts on hover or `.active` |

## Buttons

- **Standard button** (mode switches, retries, settings actions): control padding `8px 14px`, min-height `40px`, radius `--radius-md`, border `--bw` solid rose, weight 700. Hover = inversion.
- **Block button** (form submits, sign/save/delete in modals): full width, padding `13px`, radius `--radius-md`, border `--bw`. Save = rose solid. Delete = `--danger` solid (the only red button). Skip/secondary = transparent with rose border.
- **Nav segment** (top nav only): transparent segment of the solid rose nav bar, height `2.5rem`, radius `--radius-sm`, cream `--text-base` label (`--text-xs` under 640px, never breaking a word). Active = cream pill with rose label. Hover (pointer devices) = `--paper-a12` wash.
- **FAB**: circle `clamp(50px, 10vh, 80px)`, cream/rose, border `--bw`, fixed `bottom: 5vh; right: 40px`. Hover inverts.
- **Disabled**: `--idle` fill and border, cream text, no hover.

## Chips & pills

All filters and tags are pills: radius `--radius-pill`, padding `5px 12px`, border `--bw` rose, weight 700. Active/hover = inversion. Tag chips prefix `# `. Room chips inside rose cards invert the palette (cream selected, `--paper-a35` border unselected) and use `10px 16px` with 44px touch target on mobile-first forms.

## Inputs

- **Underline input** (on cream or rose): no box, `--bw` bottom border (rose on cream, `--paper-a60` on rose). Focus darkens to `--primary-deep` / `--paper`.
- **Boxed input / select / textarea / date**: cream bg, `--bw` solid rose border, radius `--radius-md`, padding `8-10px`. Focus: border `--primary-deep` + `--focus-ring`.
- **On-rose inputs**: bg `--paper-a12`, border `--bw` `--paper-a35`–`--paper-a60`, cream text.
- **Checkbox**: cream bg, `--bw` rose border; circle in list context, `--radius-sm` in card context. Checked = rose fill (+ cream `✓` in cards).
- **Search**: boxed input, full width.

## Cards & panels

- **Card**: cream bg, `--bw` rose border, radius `--radius-lg` (10px), padding `--space-sm`. Hover `scale(1.02)`, no shadow at rest.
- **Rose form card** (addChore/addEvent): rose bg, radius `--radius-lg`, padding `15-16px`, no border.
- **Panel/board/chart container**: `--bw` rose border, radius `--radius-lg`.
- **List row** (events, todos, chores): radius `--radius-md`, `--bw` border in `--primary-a25` resting → rose on hover; rose-filled rows darken to `--primary-deep`.

## Modals

Overlay `--overlay` + 2-3px blur. Content: cream, radius `--radius-lg` (bottom-sheet on mobile: `--radius-lg --radius-lg 0 0`), `--shadow-modal`, max-height ~90dvh.

## Navigation & headers

- **Nav bar**: one solid rose bar (`.on-primary`), radius `--radius-lg`, inset `--space-xs`, 95% wide like the content column; tabs in equal columns, two rows of four under 900px (3px inset and gaps under 640px).
- **Calendar header**: rose band, radius `--radius-lg`, cream controls inside (borderless cream buttons, hover `--paper-shade`; today-button gets `--bw` `--primary-deep` border).
- **Section header**: `h2` + `hr` pair colored via `--color` prop (defaults `var(--primary)`; `var(--urgent)` for overdue sections; `var(--paper)` on rose cards).

## Dense data (calendar grids)

Hairline (`--bw-hair`) grid borders in `--primary-a12`/`--primary-a25` (cream side) or `--paper-a12`/`--paper-a35` (rose side). Event pill: rose solid, radius `--radius-sm`. Chore pill: cream + hairline rose border, radius `--radius-sm`, status dot colored by urgency tokens.

## Status vocabulary

| Signal | Token |
|---|---|
| Overdue / high priority / errors | `--urgent` |
| Due soon / medium priority | `--warn` |
| Today-on-track / low priority / success | `--ok` |
| Later / quiet | `--muted` |
| None / disabled | `--idle` |
| Destructive action | `--danger` (buttons + trash icon only) |

## Shadows & motion

Flat at rest. `--shadow-lift` on nav hover, `--shadow-ambient` on calendar cells, `--shadow-pop` on popups, `--shadow-modal` behind dialogs, `--focus-ring` on keyboard focus. Color swaps animate with `--swap` (150ms ease-out). Never animate layout properties.
