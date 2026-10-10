---
name: Home Calendar
description: Household management tool for shared calendars, chores, and todos
colors:
  dusty-rose: "#8F5C66"
  deep-rose: "#7A4E56"
  warm-cream: "#FFEAD0"
  cream-shade: "#F0D6B3"
  teal-ink: "#113537"
  delete-red: "#C71414"
  urgent: "#DB324D"
  warn: "#E07B39"
  ok: "#5B8C5A"
  muted-rose: "#C8B0B4"
  idle-gray: "#9E9E9E"
typography:
  display:
    fontFamily: "Libre Franklin, Franklin Gothic, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.728rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "Libre Franklin, Franklin Gothic, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.44rem"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "Libre Franklin, Franklin Gothic, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Libre Franklin, Franklin Gothic, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Libre Franklin, Franklin Gothic, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 700
    lineHeight: 1.4
  small:
    fontFamily: "Libre Franklin, Franklin Gothic, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "5px"
  md: "7px"
  lg: "10px"
  pill: "999px"
  circle: "50%"
spacing:
  xs: "5px"
  sm: "10px"
  md: "15px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.dusty-rose}"
    textColor: "{colors.warm-cream}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.warm-cream}"
    textColor: "{colors.dusty-rose}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-ghost:
    backgroundColor: "{colors.warm-cream}"
    textColor: "{colors.dusty-rose}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.dusty-rose}"
    textColor: "{colors.warm-cream}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-danger:
    backgroundColor: "{colors.delete-red}"
    textColor: "{colors.warm-cream}"
    rounded: "{rounded.md}"
    padding: "13px"
    width: "100%"
  button-block:
    backgroundColor: "{colors.dusty-rose}"
    textColor: "{colors.warm-cream}"
    rounded: "{rounded.md}"
    padding: "13px"
    width: "100%"
  nav-bar:
    backgroundColor: "{colors.dusty-rose}"
    rounded: "{rounded.lg}"
    padding: "5px"
  button-nav:
    backgroundColor: "transparent"
    textColor: "{colors.warm-cream}"
    rounded: "{rounded.sm}"
    height: "2.5rem"
  button-nav-active:
    backgroundColor: "{colors.warm-cream}"
    textColor: "{colors.dusty-rose}"
    rounded: "{rounded.sm}"
    height: "2.5rem"
  chip:
    backgroundColor: "{colors.warm-cream}"
    textColor: "{colors.dusty-rose}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  chip-active:
    backgroundColor: "{colors.dusty-rose}"
    textColor: "{colors.warm-cream}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  card:
    backgroundColor: "{colors.warm-cream}"
    textColor: "{colors.dusty-rose}"
    rounded: "{rounded.lg}"
    padding: "10px"
---

# Design System: Home Calendar

## 1. Overview

**Creative North Star: "The Family Almanac"**

This system reads like a household almanac kept on the kitchen shelf: a dependable printed reference with a seasonal rhythm. Entries are ruled and orderly, the paper is warm, the ink is a single faded rose. It is consulted in seconds ("what's today, who's on it") and trusted because its structure never changes from page to page. Not a digital product imitating paper, but one that shares print's values: legibility first, warmth through material, structure that feels earned.

The color discipline is strict: two voices do all the work. Dusty rose and warm cream form a closed system, and the primary interaction is always a clean inversion between them. Rose is the ink: text, borders, headers, active fills. Shadows appear only when earned by interaction; everything else is flat. Density is low. Household members glance at this app between tasks; they do not sit and study it.

Motion is quick, continuous, and calm. Tabs are peers, so they fade through in place while the nav pill glides to its new tab; forms rise from below and settle back; the masthead never moves. Nothing pops into place and nothing jumps; lists close their gaps, panels unfold, and late data eases in. Motion starts almost at once (under 100ms after a tap), every movement is short (100 to 260ms) and decelerates softly, and all of it disappears for anyone who prefers reduced motion.

Every household member re-inks their own almanac: each person picks a two-colour theme in Settings, and it follows them to every device. A theme swaps only the two voices (`--primary` and `--paper`); every other colour derives from them, structure never changes, and every palette keeps the AA contrast the default guarantees.

This system explicitly refuses: Google's over-minimalism (stripped to nothing), generic SaaS white-and-blue (this lives in a home, not an office), dense productivity tools like Jira and Asana (wrong register entirely), and the pastel Cozi-style "family app" look (too soft, not enough structure).

**Key Characteristics:**
- Two-voice palette: dusty rose + warm cream, inverted on every interaction
- Rose is the ink: text on cream is rose at 4.6:1 (AA)
- Flat at rest; shadows as feedback, never decoration
- One typeface (Libre Franklin); hierarchy through weight and a 1.2 size scale
- Gently curved corners on a fixed 5 / 7 / 10 px scale
- Every value is a token, so households can re-theme without breaking anything
- Continuous motion: nothing pops or jumps; things arrive with a soft deceleration and leave quickly

## 2. Colors: The Two-Voice Palette

Two voices, one inversion. Every surface is either rose or cream; every state change swaps them.

### Primary
- **Dusty Rose** (#8F5C66): The ink and the structure. Text on cream, borders, nav backgrounds, active fills, header bands, section rules. Darkened from the original #96616B to clear 4.5:1 on cream. When something is selected or active, it wears rose.

### Secondary
- **Deep Rose** (#7A4E56): Focused input borders and fine detail where rose needs more weight (5.9:1 on cream). Never a background.

### Neutral
- **Warm Cream** (#FFEAD0): The page. Every surface at rest: background, card faces, inputs, inactive buttons. Text on rose. Nothing sits on pure white.
- **Cream Shade** (#F0D6B3): Hover-darken of cream surfaces where inversion would be too loud (dense grid cells).
- **Teal Ink** (#113537): Long-form reading text on cream only (event notes, todo descriptions), 11.3:1. A quiet second voice for paragraphs; never on rose, never for labels or controls.

### Member themes
Each household member picks one of six two-colour palettes in Settings ("Your theme"). The choice is saved on their user record (`users.theme`) and follows them to every device; a `theme` cookie lets the server paint it on the first frame. Palettes live in `$lib/theme.js`; the rose default above is the first.

| Theme | Primary | Paper | Primary on paper |
|---|---|---|---|
| Rose & Cream (default) | #8F5C66 | #FFEAD0 | 4.6:1 |
| Sage & Linen | #4E6B57 | #F2EEE1 | 5.1:1 |
| Denim & Oat | #3F5B7C | #F4EEE2 | 6.1:1 |
| Plum & Blush | #6D4A7C | #F7ECEE | 6.2:1 |
| Olive & Honey | #655D2C | #FAF0D2 | 5.9:1 |
| Slate & Bone | #4A515C | #F0ECE5 | 6.8:1 |

A theme sets only `--primary` and `--paper` (inline on `<html>`). Everything else derives in `tokens.css`: `--primary-deep` (89% primary + black), `--paper-shade` (86% paper + primary), `--muted` (41% primary + paper), the alpha tints, and the focus ring. Teal ink and the status colours stay constant.

**The Two-Colour Theme Rule.** A palette is exactly two colours, and must keep primary/paper at 4.5:1 or more (the UI inverts them on hover) and teal ink at 11:1 or more on the paper. Avoid red, orange, or green-leaning primaries that would blur into the status colours. Components never name a palette colour: they read `--primary` and `--paper`.

### Status (dots and badges, never surfaces)
- **Urgent** (#DB324D): Overdue chores, high priority, error text.
- **Warn** (#E07B39): Due soon, medium priority.
- **Ok** (#5B8C5A): On track, low priority, success feedback.
- **Muted Rose** (#C8B0B4): Distant deadlines; a rose-tinted neutral, not gray.
- **Idle Gray** (#9E9E9E): Disabled fills and "none" states.
- **Delete Red** (#C71414): Destructive buttons and the trash icon only. Its rarity is its meaning.

### Named Rules
**The Inversion Rule.** The primary interaction pattern is a full color swap: rose flips to cream, cream flips to rose. No gradients, no intermediate tints, no opacity tricks. A hover that does anything else needs a strong reason.

**The Two-Voice Rule.** Page surfaces speak rose and cream only. Teal ink appears only in paragraphs. Delete red appears on destructive actions alone; using it elsewhere devalues it.

**The Solid Ink Rule.** Text is never alpha-tinted. Cream at 60% on rose is 2.7:1 and rose at 45% on cream is 1.8:1; both fail. Secondary text gets hierarchy from size, weight, or italic in a solid color, never from opacity. Alpha tints (`--primary-a08` to `--primary-a45`, `--paper-a12` to `--paper-a60`) are for washes, tracks, and hairlines only.

**The Never-Hue-Alone Rule.** Status color always travels with a label, icon, or position. Warn (2.5:1), ok (3.4:1), and muted (1.7:1) are too light to carry meaning by themselves, and a household theme may shift them anyway.

## 3. Typography

**Body Font:** Libre Franklin (with Franklin Gothic, Helvetica Neue, Arial fallbacks), loaded at 400, 700, and 400 italic.
**No display face.** One family handles every role, through `--font-sans`.

**Character:** The printed-almanac grotesque. Libre Franklin descends from Franklin Gothic, the face of American newspapers, seed catalogues, and almanac mastheads: sturdy bolds, plain-spoken regular, warm without costume. It reads cleanly at small sizes, which matters for a glance-first app, and its confident caps give section labels a printed-ledger feel.

### Hierarchy
Fixed rem scale, 1.2 ratio. Every size is a token in `tokens.css`; components never write raw sizes.
- **Display** (700, `--text-xl` 1.728rem, 1.2): Page title; one per view (`h1`, the `.title` band).
- **Headline** (700, `--text-lg` 1.44rem, 1.2): Section headings (`h2` + hairline rule), dialog titles.
- **Title** (700, `--text-md` 1.2rem, 1.2): Card headers, kanban column names, chore names in panels.
- **Body** (400, `--text-base` 1rem, 1.5): List rows, buttons, form fields, dialog text. Rose on cream.
- **Label** (700, `--text-sm` 0.9rem, 1.35): Chips, filter pills, form labels, secondary UI.
- **Small** (400, `--text-xs` 0.8rem, 1.35, often italic): Timestamps, meta, captions. The floor: nothing smaller.
- **Prose:** Notes and descriptions carry `.prose`: capped at `--measure` (65ch), line-height 1.5, `text-wrap: pretty`. Teal ink on cream, cream on rose.

### Named Rules
**The One Family Rule.** One font, all roles. Hierarchy lives in weight (`--weight-regular` 400 / `--weight-bold` 700, nothing between) and the 1.2 size scale. Do not add a second typeface for visual interest; the color system already does that work.

**The Token-Only Rule.** Font sizes are `var(--text-*)`, never px, em, or a one-off rem. Fluid `clamp()` type is prohibited in UI (the FAB glyph is the one exception, sized with its button). A size that doesn't fit the scale is a design question, not a new value.

**The Theme Hook Rule.** Components read `--font-sans`, never a family name, so a household theme can swap the face without touching components.

## 4. Elevation

Flat by default. Surfaces sit flush at rest; depth shows up only as a response to state (hover, focus, an open popover or dialog). Cards are defined by their 2px border, not a shadow.

### Shadow Vocabulary
- **Ambient** (`box-shadow: 0 2px 5px rgba(0,0,0,0.1)`): Calendar day cells. Structural separation in dense grids.
- **Pop** (`box-shadow: 0 2px 10px rgba(0,0,0,0.1)`): Context menus and floating popovers.
- **Lift** (`box-shadow: 0 7px 15px rgba(0,0,0,0.3)`): Kanban cards while dragging. The card rises toward the finger.
- **Modal** (`box-shadow: 0 4px 20px rgba(0,0,0,0.3)`): Dialogs, over the overlay.
- **Focus outline** (`outline: 2px solid` deep rose, `outline-offset: 2px`): Global `:focus-visible` rule in `general.css`. Inside primary surfaces (mark the container `.on-primary`) the outline turns paper-coloured. Never remove it; `outline: none` is prohibited.
- **Focus ring** (`box-shadow: 0 0 0 2px rgba(143,92,102,0.3)`): Optional soft glow on inputs, in addition to the outline, never instead of it.
- **Overlay** (`background: rgba(0,0,0,0.5)`): Dimming behind dialogs.

### Named Rules
**The Flat-By-Default Rule.** A permanent shadow needs a structural reason (separation from content beneath). Decorative shadows are prohibited. If a card at rest casts a shadow, remove it.

## 5. Components

All components read from `tokens.css`. Shared classes (`.btn`, `.btn-solid`, `.btn-ghost`, `.btn-danger`, `.btn-block`, `.chip`) live in `general.css`; use them instead of restyling per component.

### Buttons
Clean and purposeful. The 2px rose border is always present, so the hit target reads even in the ghost state. One size per control class.
- **Shape:** Gently curved (7px); the FAB is a circle.
- **Primary (`.btn-solid`):** Rose fill, cream text, `8px 14px`, min-height 40px, 700 weight.
- **Ghost (`.btn-ghost`):** Cream fill, rose text, same border.
- **Block (`.btn-block`):** Full width, 13px padding. Form submit and dialog actions.
- **Danger (`.btn-danger`):** Delete red fill and border, cream text. The only red button.
- **Hover:** Full inversion via `--swap` (150ms ease-out on background, color, border).
- **Focus:** The global `:focus-visible` outline (see Elevation).
- **Disabled:** Idle gray fill and border, cream text, no hover.

### Chips
- **Style:** True pill (999px), cream fill, rose text, 2px rose border, 700 weight, `5px 12px`.
- **State:** Hover and active invert to rose fill, cream text. Used for room and tag filters. Sentence case via `::first-letter` capitalize.

### Cards / Containers
- **Corner Style:** 10px, shared by panels, cards, and dialogs.
- **Background:** Warm cream.
- **Border:** 2px solid rose; the border defines the card.
- **Header band:** Rose fill, cream title text, bleeding to the card edges.
- **Shadow Strategy:** None at rest (see Elevation).
- **Internal Padding:** 10px.
- **Nesting:** Prohibited.

### Inputs / Fields
- **Text input:** No background, no outer border; 2px rose bottom border only. The underline says "editable" without weight.
- **Textarea:** Cream fill, 2px rose border, 7px radius, resize disabled.
- **Date / Select:** Cream fill, 2px rose border, 7px radius, 8px padding.
- **Focus:** Border shifts to deep rose, plus the global `:focus-visible` outline.
- **Placeholder:** Solid primary at small size or italic, not `--primary-a45` (fails contrast).
- **Checkbox:** Cream fill, rose border; circle in lists, 5px radius in cards. Checked = rose fill.
- **Size:** Fields read at 16px (`--text-base`), never smaller: iOS zooms the page into any smaller field when it takes focus, and stays zoomed.
- **Phones:** In forms the label sits above its field and the field takes the full width.

### Navigation
- **Bar:** One solid rose bar (`.on-primary`), 10px radius, 5px inset, lined up with the content column (95% wide) with 10px below it. The tabs are its segments: equal columns in one row, a column growing past its share only when its label needs the room.
- **Segment:** Transparent, cream label, 5px radius (10px bar minus 5px inset, so the corners nest), 2.5rem height, 700 weight, `--text-base`, never wrapping.
- **Active:** A cream pill with a rose label. During a page change the pill glides to its new tab.
- **Hover:** A `--paper-a12` wash with the label kept solid cream (pointer devices only). The one exception to the Inversion Rule: inside the bar a full swap would read as the active tab.
- **Badge:** Urgent-red count riding on the label's top-right with a 2px rose ring, since a segment has no visible edge to hang it from.
- **Narrow screens:** Under 900px the bar becomes two rows of four (as many columns as half the tabs). Under 640px labels step down to `--text-xs`, gaps and inset to 3px and segment corners to 7px. A label never breaks inside a word.

### Assistant tab
- **Two panels** built like kanban columns: 2px rose border, 10px radius, rose header band. "Chats" (list, with **New chat** in its band) and the open conversation (its title, and delete, in the band). Phones show one panel at a time; the conversation band carries a **Chats** back button.
- **Fills the screen exactly:** the tab measures its top and is as tall as the screen below the nav, so the page never scrolls; the list and the messages scroll inside their panels and the band and input stay put. The page's bottom spacer is skipped on this tab.
- **Reading column:** messages and the input share one centred 46rem column; the scrollbar stays at the panel edge. The member's messages are rose bubbles on the right; answers are plain teal-ink text on the page, no box.
- **Answer formatting:** answers may use `#` headings (rose, bold, `--text-md` for `#`, `--text-base` below), `-`/`*` lists (rose bullets, nesting up to two levels), `---` rules (a `--primary-a25` hairline), **bold** and *italic*. Nothing else is formatted; the member's own messages are never formatted.
- **Opens at the latest message** and follows new ones while the member is at the bottom; scrolling up to read stops the follow.
- **New chat** says what the assistant can do and offers tappable starter questions (chips).
- **Running:** the steps so far as a ticked list, the current one pulsing; **Stop**, **Cancel** and **Ask again** are compact pill buttons, not links.
- **Review card:** square tick boxes (22px, 5px radius, rose border, rose fill with a cream ✓), primary "Do it" / "Do 2 of 3" (disabled when nothing is ticked) and a ghost Cancel.

### Section Headers
- **Pattern:** h2 plus hairline rule (1px), colored through a `--color` custom property; subtitle as an italic h5.
- **Fit:** Title and subtitle share a line when they fit; otherwise the subtitle drops below the title. Words never split.

### Kanban Board (signature)
- **Columns:** Cream panels with 2px rose border and 10px radius; rose header band carries the column name and count.
- **Cards:** 7px list-row radius, 2px border, no shadow at rest; dragging lifts with the lift shadow. Moves must also work by keyboard.

### Edit surfaces
- **Inline first:** Chore editing expands in place under its row (`updateChore.svelte` panel, 2px rose border, 10px radius, close button 44px).
- **Dialog when there is no room inline:** Todo and event editing use a native `<dialog class="dialog">` with the `modalDialog` action: top layer, focus trap and Escape for free. It rises 12px and scales from 0.98 over a fading `--overlay` (200ms), and every close path (×, Escape, backdrop, after Save or Delete) plays a 130ms exit before closing. No backdrop blur.
- **Mode switches:** View ↔ Edit and Sign ↔ Edit morph the container's height (`morphHeight`) instead of jumping.

### FAB
- **Shape:** Circle, `clamp(50px, 10vh, 80px)`.
- **Default:** Cream fill, rose text and 2px border. Hover inverts.
- **Position:** Fixed, `bottom: 5vh`, `right: 40px`.

### Collapsible
- **Trigger:** Full-width rose button, cream text, 7px radius. Hover inverts. Carries `aria-expanded`.
- **Content:** Unfolds in place with `expand` (height, 200ms in / 130ms out), so what sits below glides.

### Motion (system-wide)
Motion tokens live in `tokens.css` and are mirrored for JS in `$lib/motion.js`: `--ease-out` (quint out) for arrivals, `--ease-in` (quint in) for exits, durations `--dur-instant` 100ms (press), `--dur-fast` 130ms (swaps, exits), `--dur-base` 200ms (reveals, dialogs, panels), `--dur-slow` 260ms (list reflow, height changes), and for whole screens `--dur-screen` 360ms with `--ease-screen` (moves at once, lands softly).
- **Page changes:** a horizontal push. The screens sit in a row in nav order, each form just right of its tab. Changing screen slides the one you leave out while the next slides in right beside it, never blended; further right comes in from the right, going back from the left. The nav pill glides in step, header and nav stay on top, and the + button stays put between two screens that both have one. Each screen (`$lib/containers/screen.svelte`) is its own View Transition group, named only during a page change.
- **Screens arrive whole:** a tab stays mounted once opened (hidden when out of view), so coming back shows it at once, as you left it, then refreshes in place. After the first screen is up, the other tabs open in the background one at a time, so their data is in before the first visit. A tab whose data isn't in yet holds the change (up to 600ms) until it is (each view reports it through `onReady`); forms wait up to 600ms for their own data. Nothing slides in empty and fills in afterwards.
- **First load:** the loading line holds until the first screen's data is in, then crossfades to the complete page, greeting included; header and nav glide into place.
- **Calendar paging:** fetch first, then commit dates and events together: the old period fades while nudging away, the new one arrives 20px from the side time moved (earlier = left, later = right). View and filter toggles crossfade.
- **Loading states:** the loading line only fades in if loading passes 300ms; the calendar dims only for a slow navigation, never on first load; empty-state text waits for data.
- **Lists:** keyed rows use `animate:move` + `in:reveal` + `out:vanish`: leavers fade in place while the rest glide into the gap. Containers whose height changes with data use `use:autoHeight`, so sections below move instead of jumping.
- **Refreshes never blank the page:** only the first load shows the loading line; later refreshes update in place and keep filters.
- **Press feedback:** compact controls give `scale(0.97)` under the finger; rows and large surfaces highlight instead.
- **Reduced motion:** every path collapses to instant (CSS rule plus `ms()` in JS); View Transitions are skipped entirely.

### Phones (system-wide)
Most household glances happen on a phone, so these hold on every screen down to 320px:
- **Whole words only.** Short labels (times like "09:30 AM", buttons, chips, member names, nav labels) are `white-space: nowrap`; a group of them wraps as whole items (`flex-wrap`), never inside one. Headings wrap at spaces only.
- **Nothing wider than the screen.** On a phone one overflowing element grows the layout viewport: the page pans sideways and fixed controls (the + button) drift off screen. `html` and `body` clip horizontal overflow as a safety net, but the fix is always the element: `box-sizing: border-box` on anything with `width: 100%` plus padding or border, and `min-width: 0` on flex children that hold text.
- **Titles over metadata.** In list rows a title gets two lines (line clamp) rather than an ellipsis after a few letters; secondary details (date, last signer) move under it.
- **Hover is for pointers.** Every `:hover` style sits inside `@media (hover: hover)`. On touch screens a tapped element keeps `:hover` until the next tap, so a filter you just switched off would still look on.
- **Tabs are addresses.** `/calendar`, `/todo` and the other tab paths load the app on that tab (`routes/[view=view]`), so a refresh or a reopened tab lands where you were.

## 6. Do's and Don'ts

### Do:
- **Do** use the rose/cream inversion as the hover and active pattern everywhere. Consistency is the system.
- **Do** read every color, radius, border, and shadow from `tokens.css`. A hardcoded hex breaks household theming.
- **Do** size text only with `--text-xs` to `--text-xl` and weight only with 400/700.
- **Do** keep text on cream in solid dusty rose (#8F5C66, 4.6:1) and paragraphs in teal ink (#113537).
- **Do** rely on the global `:focus-visible` outline; add `.on-primary` to primary-filled containers so it turns paper-coloured there. Never write `outline: none`.
- **Do** pair every status color with a label, icon, or position.
- **Do** keep surfaces flat at rest; add the lift shadow only on hover for interactive elements.
- **Do** use the radius scale: 10px panels, cards, dialogs; 7px buttons, inputs, list rows; 5px dense tiles and calendar pills; pills for chips and badges.
- **Do** use 2px borders on every bordered control and container; 1px hairlines only for dividers and dense grids.
- **Do** lead each screen with what the household came to check (today, overdue, whose turn), per PRODUCT.md's "glance first".
- **Do** check every screen at 320px and 360px wide: no word split, no short label wrapped, nothing past the edge.

### Don't:
- **Don't** use generic SaaS white-and-blue. "This lives in someone's home, not an office."
- **Don't** drift toward Google's over-minimalism. Clean is good; stripped to nothing is not.
- **Don't** build dense Jira/Asana-style screens: no toolbars of twelve icons, no 13px data grids.
- **Don't** use the pastel Cozi-style "family app" look: no baby blue, no gradient backgrounds, no rounded-everything with drop shadows.
- **Don't** tint text with alpha or use idle gray (2.3:1) for readable text.
- **Don't** add a `border-left` or `border-right` over 1px as a colored accent stripe. Use a full border, a background tint, or a leading icon.
- **Don't** use gradient text (`background-clip: text`). Emphasis is weight or size.
- **Don't** introduce a second typeface.
- **Don't** add colors beyond the named status set. Delete red stays on destructive controls; status colors stay on dots and badges, never surfaces.
- **Don't** build identical card grids; cards have structure because their content varies.
- **Don't** reach for a modal first. Inline expansion, collapsibles, and contextual panels usually serve better.
- **Don't** use `word-break: break-word` or `overflow-wrap: anywhere` on headings or labels: inside a flex row they let the browser split a word to make room ("Roo / ms"). Use `overflow-wrap: break-word`, which only breaks a word longer than the whole line.
- **Don't** use `transition: all`. Transition colours via `--swap`; move things with `transform`/`opacity`, and change height only through `expand`, `autoHeight`, or `morphHeight`.
- **Don't** let content pop in, jump, or blank out. A new state arrives through a transition, a list change moves rows rather than replacing them, and a refresh updates in place.
- **Don't** use bounce, elastic, or overshoot easing, or durations over 260ms for anything but whole-screen pushes (360ms) and chart data morphs (350ms).
- **Don't** slide whole pages sideways between tabs or let the old and new page overlap at full strength; fade through.
- **Don't** hold the page frozen waiting for data; cap `settle` at about 50ms and let late content ease in.
