# Palette — The Warm Ledger

Two voices do all the work. Dusty rose structures; warm cream breathes. Every interaction is a clean inversion between them. Rose carries text on cream; teal ink is reserved for long-form reading text. Status colors appear only as dots, badges, and the rare destructive button.

## Brand

| Token | Hex | OKLCH | Use |
|---|---|---|---|
| `--primary` | `#8F5C66` | `oklch(53% 0.068 7)` | Nav backgrounds, active fills, borders, header bands. "Selected" wears rose. |
| `--primary-deep` | `#7A4E56` | `oklch(42% 0.06 10)` | Focused input borders, hover-darken on rose surfaces. Never a resting background. |
| `--paper` | `#FFEAD0` | `oklch(93% 0.04 70)` | The page. Cards, inputs, inactive buttons, text on rose. Nothing sits on pure white. |
| `--paper-shade` | `#F0D6B3` | `oklch(88% 0.05 75)` | Hover-darken of cream buttons sitting on rose headers. |
| `--ink` | `#113537` | `oklch(22% 0.05 195)` | Long-form reading text on cream (notes, descriptions). Never on rose. |

## Status

| Token | Hex | Use |
|---|---|---|
| `--danger` | `#C71414` | Destructive buttons and trash icons **only**. Rarity is its meaning. |
| `--urgent` | `#DB324D` | Overdue chores, high priority, error text. |
| `--warn` | `#E07B39` | Due soon, medium priority. |
| `--ok` | `#5B8C5A` | On track, low priority, success feedback. |
| `--muted` | `#C8B0B4` | Distant deadlines, quiet dots. Rose-tinted neutral, not gray. |
| `--idle` | `#9E9E9E` | Disabled fills, "none" priority. |

## Tints

| Token | Value | Use |
|---|---|---|
| `--primary-a08` | `rgba(143, 92, 102,.08)` | Hover wash on cream cells |
| `--primary-a12` | `rgba(143, 92, 102,.12)` | Badge/track backgrounds, grid hairlines |
| `--primary-a25` | `rgba(143, 92, 102,.25)` | Quiet borders, dividers |
| `--primary-a45` | `rgba(143, 92, 102,.45)` | Placeholders, caret |
| `--urgent-a12` | `rgba(219,50,77,.12)` | Overdue badge background |
| `--paper-a12` | `rgba(255,234,208,.12)` | Input backgrounds on rose cards |
| `--paper-a35` | `rgba(255,234,208,.35)` | Quiet borders/placeholders on rose |
| `--paper-a60` | `rgba(255,234,208,.6)` | Secondary text on rose |

## Named rules

1. **The Inversion Rule.** The only hover/active pattern is a full rose ↔ cream swap. No gradients, no intermediate states.
2. **The Two-Voice Rule.** Surfaces speak rose and cream only. Status colors are accents, never surfaces.
3. **Destructive vs urgent.** Delete red (`--danger`) marks destructive controls only. Overdue and error text use `--urgent`. Mixing them devalues both.

## Canvas caveat

chart.js renders to canvas and cannot resolve CSS variables. Chart series use the user's stored color or concrete `#8F5C66` / `#8F5C6699` fallbacks.

## Member themes

Every household member picks one of six two-colour palettes in Settings. A theme sets only `--primary` and `--paper`; every other colour derives from them in `tokens.css`. The palettes (id, primary, paper) live in `frontend/src/lib/theme.js`:

| Theme | Primary | Paper |
|---|---|---|
| Rose & Cream (default) | `#8F5C66` | `#FFEAD0` |
| Sage & Linen | `#4E6B57` | `#F2EEE1` |
| Denim & Oat | `#3F5B7C` | `#F4EEE2` |
| Plum & Blush | `#6D4A7C` | `#F7ECEE` |
| Olive & Honey | `#655D2C` | `#FAF0D2` |
| Slate & Bone | `#4A515C` | `#F0ECE5` |

New palettes must keep primary/paper at 4.5:1 or more both ways and teal ink (`#113537`) at 11:1 or more on the paper.

