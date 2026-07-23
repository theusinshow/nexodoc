---
name: NexoDoc Audit Workspace
description: Auditoria documental inteligente para projetos de engenharia civil
colors:
  base-dark: "#0a0e11"
  panel-surface: "#121518"
  technical-teal: "#00a693"
  bright-teal: "#5bdac6"
  luminous-teal: "#7af7e1"
  rust-salmon: "#dc7858"
  salmon-pink: "#ffb59e"
  signal-ok: "#6ee7a3"
  signal-warning: "#e9b45c"
  signal-critical: "#ff9285"
  destructive-pink: "#ff9285"
  on-surface: "#e1e7ea"
  muted-gray: "#8e9ba3"
  border-divider: "#23282c"
  input-bg: "#2c3338"
  recessed-dark: "#06080a"
  raised-gray: "#1a1e21"
  secondary-surface: "#15191c"
typography:
  display:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Fallback', system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Fallback', system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Fallback', system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.4
  subtitle:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Fallback', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Fallback', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Fallback', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  mono-label:
    fontFamily: "'IBM Plex Mono', 'IBM Plex Mono Fallback', ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: "0.05em"
  mono-data:
    fontFamily: "'IBM Plex Mono', 'IBM Plex Mono Fallback', ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "8px"
  DEFAULT: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  gutter: "16px"
components:
  button-primary:
    backgroundColor: "{colors.technical-teal}"
    textColor: "{colors.base-dark}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "oklch(65% 0.12 180 / 0.9)"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-gray}"
  card:
    backgroundColor: "{colors.panel-surface}"
    rounded: "{rounded.sm}"
    padding: "12px"
  input:
    backgroundColor: "{colors.recessed-dark}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    height: "40px"
  chip-selected:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
---

# Design System: NexoDoc Audit Workspace

## 1. Overview

**Creative North Star: "The Calibrated Instrument"**

NexoDoc is a precision tool for civil engineering document audits. Its visual language borrows from terminal interfaces and industrial measurement instruments: dark, restrained, information-dense, with a single technical accent. Every pixel earns its place. Color is used as a functional indicator, not decoration. Typography enforces discipline: proportional type for body text, monospace for data, labels, timestamps, and IDs.

The system explicitly rejects: SaaS dashboard templates, purple or blue gradients, glassmorphism, oversized decorative cards, hero-metric templates with color-coded big numbers, and any ornamentation without purpose. Shadows are minimal and structural. Borders define surfaces; tonal layering conveys depth.

**Key Characteristics:**
- Dark-first, high-contrast operational environment
- Restrained color strategy: tinted neutrals + one accent (teal) at less than 10% of any screen
- Technical typography: IBM Plex Sans for reading, IBM Plex Mono for data integrity
- 4px base grid; all spacing derived from multiples of 4

## 2. Colors

The palette anchors on a near-black base tinted slightly cool. It separates color into three functional families that never overlap in meaning: **teal is interactive**, **the three signals are status**, and **rust/salmon is emphasis**. This separation is the core discipline — a teal element is always something you can act on; it is never a status.

### Primary — Interactive (teal ramp)
The teal ramp means one thing only: interactivity. Primary actions, current selection, focus, active data. Never a status, never decoration, never a passive fill. Occupies less than 10% of any given screen by design.
- **Technical Teal** (`#00a693`): Primary actions, focus rings, active data selections, current navigation state. Buttons, selected chips, icon accents.
- **Bright Teal** (`#5bdac6`): Focus ring glow, progress indicators, hover highlights on interactive teal elements.
- **Luminous Teal** (`#7af7e1`): Brightest interactive tier — active data-selection highlight and high-emphasis interactive glow. (Formerly the OK-status color; status now owns its own green — see Signal.)

### Signal — Status (verde / âmbar / coral)
The three signal colors mean status and nothing else. They are perceptually distinct so a finding's severity reads at a glance — the product's core job. They never appear on interactive controls.
- **Signal OK** (`#6ee7a3`): Success / conforme / "sem problemas". A technical mint-green, deliberately outside the teal family so "approved" never reads as "clickable".
- **Signal Warning** (`#e9b45c`): Attention / "ponto de atenção" / low-severity. A warm amber — caution without alarm.
- **Signal Critical** (`#ff9285`): Problem / "problema de montagem" / error. A coral, clearly redder than amber. Firm without becoming an aggressive alarm-red.

### Tertiary — Emphasis (rust / salmon)
Reserved for emphasis states only, never status. Active "Profundo" analysis toggle, demo-mode accent, action callout cards.
- **Rust Salmon** (`#dc7858`): Secondary emphasis, "Profundo" active state, demo toggle. Conveys weight without alarm.
- **Salmon Pink** (`#ffb59e`): Softer emphasis tint, mock-mode indicators.

### Neutral
- **Base Dark** (`#0a0e11`): Application background. The deepest surface; all panels float above it.
- **Panel Surface** (`#121518`): Cards, sidebars, modal containers, header bars. One step above background.
- **Recessed Dark** (`#06080a`): Input fields, textareas, segmented control backgrounds. Darker than background for inset effect.
- **Raised Gray** (`#1a1e21`): Hover states, secondary panels, raised surfaces.
- **On Surface** (`#e1e7ea`): Primary text, active content, foreground.
- **Muted Gray** (`#8e9ba3`): Secondary text, metadata, inactive labels, helper copy.
- **Border Divider** (`#23282c`): All structural borders and dividers.
- **Destructive Coral** (`#ff9285`): Destructive action warnings (delete, discard). Shares the hue of Signal Critical on purpose — danger is one colour across the system, whether it's a status or an action.

### Canonical status tokens

Status colour is only ever consumed through these CSS variables — never a raw hex, never a Tailwind palette class (`bg-yellow-*`), never an invented name. There is no `--status-danger` or `--status-warn`; those don't exist and any reference to them is a bug.

| Semantic | Text/border token | Background tint token |
|----------|-------------------|-----------------------|
| OK       | `--status-ok` `#6ee7a3`       | `--status-ok-bg` |
| Warning  | `--status-warning` `#e9b45c`  | `--status-warning-bg` |
| Critical | `--status-critical` `#ff9285` | `--status-critical-bg` |

The canonical badge pattern is `border-[var(--status-X)]/30 bg-[var(--status-X-bg)] text-[var(--status-X)]`, exposed as `<Badge variant="ok|warning|critical">`. Use the component; do not hand-roll status classes.

### Named Rules
**The One Accent Rule.** Teal means interactive — primary buttons, current selection, focus indicators, active data. Only. It is never a status, never decoration, never a background fill, never on inactive states. "OK" is green, not teal.

**The Signal Separation Rule.** The three signals (green/amber/coral) are perceptually distinct and reserved for status. Warning and Critical must never collapse toward the same hue — a reader distinguishes attention from problem at a glance, without reading the label.

**The Tertiary Discipline Rule.** Rust Salmon and Salmon Pink are reserved for emphasis states (deep analysis mode, demo) only. They are not status colours and do not appear in the identity logo, page backgrounds, or passive elements.

## 3. Typography

**Display Font:** IBM Plex Sans (with system-ui fallback)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace fallback)

**Character:** A disciplined engineering pairing from a single type family. IBM Plex Sans — designed by IBM for technical and data-dense contexts — provides an engineered, institutional neutrality for extended reading, deliberately away from the generic startup/AI-default sans. IBM Plex Mono, its sibling, signals technical precision: all audit codes, document IDs, timestamps, numerical data, and UI labels use it exclusively. Because both faces come from one family, their metrics and proportions are harmonised — the contrast between proportional body text and mono data reads as one calibrated system, not two fonts stitched together.

### Hierarchy

The IBM Plex Sans (proportional) ramp is a continuous scale with no gaps — every intermediate case has a named step, so no screen invents an off-scale size (`text-[11px]`, `text-[15px]`). Steps sit ~1.2–1.35× apart.

- **Display** (600, 40px, 1.1, -0.02em): Hero headlines. Login page main title only.
- **Headline** (500, 24px, 1.2, -0.01em): Page titles, section headers (h2).
- **Title** (500, 18px, 1.4): Card titles, component headers (h3).
- **Subtitle** (500, 16px, 1.4): Sub-section headers, emphasized lead text, the step between a card title and body.
- **Body** (400, 14px, 1.5): Reading text, descriptions, conclusions. Cap at 65–75ch.
- **Caption** (400, 12px, 1.4, muted): Metadata, helper text, secondary annotations in IBM Plex Sans. The proportional counterpart to Mono Data — use it for prose-like meta, not for structured values.

Mono (IBM Plex Mono) runs on a parallel two-step axis for structured content:

- **Mono Label** (500, 12px, 1.0, letter-spacing 0.05em): UI labels, sidebar section headers, field names, tab labels, badge text. Micro-labels may drop to 11px, but never below.
- **Mono Data** (400, 13px, 1.4): Numerical values, timestamps, status codes, file names, audit IDs.

### Named Rules
**The Mono Discipline Rule.** Any element that conveys structured data (timestamp, file name, document ID, finding count, elapsed time) must use IBM Plex Mono. IBM Plex Sans is reserved for headings, body paragraphs, and long-form conclusions.

**The Tabular Figures Rule.** All numeric data renders with tabular (monospaced) figures so counts, elapsed times, page numbers, and IDs align vertically in columns and never jitter as values change — numeric alignment is data integrity, not decoration. IBM Plex Mono is tabular by nature; IBM Plex Sans carries numeric data via its `tnum` feature (enabled globally). A number that can change or be compared is always tabular.

## 4. Elevation

NexoDoc conveys depth through **tonal layering and borders**, not shadows. In-page surfaces at each level are distinguished by background color alone. Borders are always 1px full-width; side-stripe borders are forbidden.

1. **Level 0 (Background):** `#0a0e11`. The base canvas.
2. **Level 1 (Panels):** `#121518`. Cards, sidebars, header bars. Always bordered with `#23282c`.
3. **Level 2 (Active/Hover):** Surface panels with a lighter border or background shift to `#1a1e21`.
4. **Level 3 (Inputs):** `#06080a`. Inset fields sit below the background for a recessed appearance.
5. **Level 4 (Overlay):** Dropdowns, popovers, tooltips, modals — surfaces that genuinely float *above* the page. Panel background (`#121518`) + 1px border + `shadow-subtle`. This is the only tier where shadow is structural rather than optional, because there is no tonal layering to separate a floating surface from arbitrary content behind it.

### Edge highlight — depth without shadow

Raised and interactive surfaces carry a **1px inner top highlight**, a hairline catching light from above. It reads as precision machining, not glass, and gives tactile depth while keeping every surface matte and shadowless.

- `edge-highlight`: `inset 0 1px 0 rgb(255 255 255 / 0.04)` — applied to raised/interactive elements only: buttons, cards on hover, Level 4 overlays. **Never** on flat in-page panels at rest, recessed inputs, or passive strips.

Shadows remain limited to two structural tokens, used sparingly:
- `shadow-panel`: `0 1px 2px rgb(0 0 0 / 0.35)` — Panel edge definition when tonal layering alone is insufficient.
- `shadow-subtle`: `0 1px 1px rgb(0 0 0 / 0.25)` — Minimal lift for Level 4 overlays.

### Named Rules
**The Flat-By-Default Rule.** In-page surfaces are flat at rest. Depth comes from borders and background contrast first, then the `edge-highlight` hairline on raised/interactive elements. Drop shadow is reserved for Level 4 overlays only.

**The Blur Rule.** Backdrop blur is permitted on **one** surface only: the dimming backdrop behind a modal. It is never applied to a card, panel, or any content surface — blurred surfaces are glassmorphism, which the system rejects.

**Liquid Glass — ambient layer (scoped amendment, Nexo module only).** The Nexo conversational reflow (see `docs/ui-references/ARQUITETURA.md` §6, Appendix H) reverts the Blur Rule for a **closed list** of floating/immersive *chrome* surfaces — and nothing else: the modal dimming backdrop, the composer dock, the welcome wash, the assistant chat bubble (as a subtle wrapper), and the PDF viewer chrome. The rule that data is matte is **non-negotiable and unchanged**: cards, findings, tables, artifact frames, and the `ConfirmationCard` never carry blur. The "waterline" is literal — above it (chrome, the AI's own bubble) may be glass; below it (any data surface) is always matte. Glass uses only the derived `--glass-*` tokens (no new color), degrades to a solid `--card` where `backdrop-filter` is unsupported or `prefers-reduced-transparency: reduce`, and keeps text ≥4.5:1 via a high tint floor. This exception is deliberately narrow — premium is precision plus a few ambient moments, not glass everywhere.

## 5. Components

### State Matrix

Every interactive component defines the same seven states with the same vocabulary. If a component ships without one of these, it is incomplete. Consistency across the surface is the point — a hover means the same thing on a button as on a table row.

| State | Treatment |
|-------|-----------|
| **Default** | The component at rest, per its own spec. Flat; depth from border + surface tone. |
| **Hover** | Subtle tonal raise (surface → `#1a1e21`) or border shift toward `ring`; ghost elements move muted text → foreground. `--duration-fast`. Never a dramatic colour change. |
| **Focus** | The single system ring only — border → `#5bdac6` + 3px ring at `/25`. Driven by `:focus-visible` (keyboard), never bare `:focus`. Identical on every component. |
| **Active / pressed** | `translateY(1px)` press + slight background darken. `--duration-fast`. |
| **Selected / current** | Teal border + filled background (`nav` active item, selected chip, selected row). Teal marks the current thing. |
| **Disabled** | Opacity **50%**, `pointer-events: none`, no hover, default cursor. The one canonical disabled opacity — not 45% on one component and 50% on another. |
| **Loading** | Component-scoped and layout-stable: a button keeps its width and swaps its label for an inline spinner ("Gerando…"); a content region shows a skeleton. Never a spinner parked over content, never a width jump. |
| **Error** | Fields shift border to Signal Critical (coral) with critical helper text below — not a silent ring-colour change. Form-level errors use the Signal Critical vocabulary, never the empty-state treatment. |

**Read-only ≠ disabled.** A read-only field shows its value at normal contrast with no edit affordance; a disabled field is dimmed to 50%. Never use disabled styling to convey "not editable right now".

### Buttons
- **Shape:** `8px` border-radius. Monospace labels.
- **Primary:** Solid `#00a693` background, dark text (`#06080a`). No gradients. Hover: 10% darker. Height: 40px (h-10) default, 36px (h-9) compact. Controls in a form row (button + input) share the 40px height so they align.
- **Outline:** Transparent background, 1px border (`#23282c`), foreground text. Hover: border shifts to ring color, subtle background tint.
- **Secondary:** Subtle background (`#1a1e21`), border, foreground text.
- **Ghost:** Transparent, muted text. Hover: background tint + foreground text. Used for navigation, admin links, demo toggle.
- **Focus:** All variants use `focus-visible:ring-3 focus-visible:ring-[var(--ring)]/25` with border transition to ring color.

### Chips / Segmented Controls
- **Style:** Dark recessed background (`#06080a`), 1px border (`#23282c`), 8px radius container. Mono labels at 12px.
- **Selected:** Card background (`#121518`) with teal border (`#00a693`/30), medium weight.
- **Unselected:** Transparent border, muted text. Hover shifts text to foreground.
- **Special:** "Profundo" level uses Rust Salmon accent instead of teal when selected.

### Cards / Containers
- **Corner Style:** `8px` border-radius universally.
- **Background:** `#121518` for content cards, transparent for background-level strips.
- **Border:** 1px `#23282c`. Used consistently; no borderless floating elements.
- **Internal Padding:** 12px (p-3) standard, 16px (p-4) for panels and sidebars.

### Inputs / Fields
- **Style:** 1px border (`#2c3338`), recessed background (`#06080a`), 8px radius. Height: 40px (h-10) standard, 32px (h-8) compact.
- **Focus:** The single system focus ring — border shifts to `#5bdac6`, plus a 3px ring in bright-teal at 25% opacity (`rgb(91 218 198 / 0.25)`). Identical on buttons, inputs, textareas, links; no component overrides it.
- **Textarea:** Same treatment. Resizable vertically. Minimum height 5.5–12rem depending on context.
- **Placeholder:** `text-muted-foreground` (gray-green).

### Navigation (Sidebar)
- **Style:** 236px wide, `#121518` background, right border 1px. Logo + name at top, action buttons grouped with 4px gaps, collapsible status indicators, scrollable history list, fixed user footer at bottom.
- **Active Item:** Teal border + filled background on current page. History items are transparent with hover highlight.
- **User Area:** Fixed at sidebar bottom. Photo or initials (teal text on dark circle), name, email, sign-out icon button.

### Audit Result
- **Header:** Status badge (colored border + background tint + mono label), finding/file/time summary line, next action as emphasized title, segmented tab bar below.
- **Metrics Grid:** 2–4 column grid of compact cards (recessed background, mono labels, medium-weight values).
- **Tabs:** Segmented control pattern (`bg-recessed`, 8px radius). Active: card bg + teal border. Inactive: transparent + muted text.
- **Finding Card:** Single container with internal sections separated by borders, not nested cards. Evidence, conflict, and action are adjacent blocks distinguished by icon + label headers.

### Tooltip
- **Style:** `max-w-xs`, border + card background, `shadow-subtle`, mono text at 12px. Fade + zoom entrance via `animate-in`.
- **Trigger:** Wraps the target element via `asChild`. Delay 300ms before showing.
- **Usage:** Compact buttons without visible labels (SignOut icon-only), technical terms that benefit from explanation.

### Keyboard Shortcuts
- **Modal:** `modal-scale-in` entrance (200ms, scale + fade). Backdrop with `backdrop-blur-sm`. Dismiss via Esc or overlay click.
- **Keycap style:** `h-6 min-w-[24px]`, `rounded` border, bg-muted, mono 11px text.
- **Shortcuts:** `Ctrl+G` dashboard, `Ctrl+A` auditoria, `Ctrl+L` LD, `Ctrl+Shift+A` admin, `?` ajuda.

### Data Tables

Tables are a primary surface — this is an audit tool, so the default favours **seeing many rows at once**. Depth and separation come from borders, never zebra striping.

- **Density:** compact by default — `px-3 py-2.5` cells, ~40px rows. A denser variant (`py-1.5`) exists for large datasets; a comfortable variant is the exception, not the default. Density is a table-level choice, applied uniformly to all its rows.
- **Separation:** a 1px bottom border between rows (`#23282c`); the header carries a slightly firmer bottom border. **Horizontal rules only — no vertical column dividers** (they add grid noise the system rejects). No zebra striping.
- **Header cells:** Mono Label — uppercase IBM Plex Mono, 11–12px, letter-spacing 0.05em, `muted-foreground`. (Corrects the shadcn default, which renders headers in the proportional face.) Header stays **sticky** on scroll for long tables, on the panel background.
- **Numeric columns:** right-aligned, Mono Data, tabular figures, so digits line up and compare cleanly. Text columns left-aligned. A status column renders a `<Badge>`, not coloured text.
- **Non-wrapping data:** IDs, codes, and timestamps (mono) never wrap; long prose cells may wrap. Truncate with ellipsis + tooltip when a mono value would overflow.
- **Row states:** hover raises the row to `#1a1e21`; the selected row uses a subtle teal tint; keyboard focus is the system focus ring on the row. Disabled rows drop to `muted-foreground` with no hover.
- **Loading & empty:** loading shows skeleton rows matching the column layout (never a spinner); an empty table uses the Empty State treatment inside the table body, not a bare "0 results".

### Iconography

Icons come from **`lucide-react` exclusively** — one line-based set, never mixed with another family. Line/outline only; no filled, duotone, or coloured icon styles. Icons clarify or label; they never decorate.

- **Stroke:** `1.5` across the board (`strokeWidth={1.5}`), finer than the lucide default of 2 — reads as a precision instrument and holds up in dense, dark UI. Set once, globally; individual icons never override it.
- **Size scale** (aligned to the 4px grid):
  | Token | Size | Use |
  |-------|------|-----|
  | `size-3.5` | 14px | Dense inline, next to Mono Data |
  | `size-4`   | 16px | **Default** — buttons, controls, most inline UI |
  | `size-5`   | 20px | Emphasis, section headers |
  | `size-6`   | 24px | Rare — large affordances, empty states |
- **Colour:** icons inherit `currentColor`. Teal only when the icon *is* the interactive/active affordance; `muted-foreground` when passive; a **signal token** (`--status-ok/warning/critical`) when the icon carries status. Never a decorative colour.
- **Alignment:** optically centred with adjacent text, `shrink-0` so they never squash, `gap-2` (8px) between icon and label — the same gap buttons use.
- **Icon-only controls:** allowed only for universally-understood glyphs (close/X, chevrons, search) and always paired with a tooltip (see Tooltip). Everything else carries a visible label.

### Loading & Skeletons

Content that is loading is shown as a **skeleton of its eventual shape**, never a spinner parked in the middle of the screen. A skeleton reserves the layout so nothing jumps when data arrives.

- **Skeleton block:** recessed background (`#15191c`), 8px radius, sized and positioned to match the incoming element (a line of text is a short bar; a card is a card-shaped block). Group several to mirror the real structure.
- **Shimmer:** a single subtle sweep reusing the system easing — low-contrast, slow, non-distracting. Never a bright pulse.
- **Spinner scope:** a small inline spinner is allowed **only inside a button** during a pointed action ("Gerando…"). It never appears as the loading state for a content region — that is always a skeleton.
- **Long determinate work:** the `audit-progress` bar remains the pattern for ongoing analysis with no known percentage.

### Empty States

An empty state **teaches the interface**; it never just says "nothing here". It occupies the content area calmly, within the existing surface vocabulary — no large illustration, no marketing tone.

- **Structure:** a short Mono Label naming the region, one line of Body (IBM Plex Sans, muted) explaining what will appear here and how to make it appear, and — when there is a next step — a single primary action.
- **Placement:** centered in the content region or inside the panel that will hold the data, using border + muted text, not a decorated card.
- **Restraint:** no oversized icons, no emoji, no hero copy. The tone is the same calibrated-instrument voice as the rest of the tool.
- **Distinguish from error:** an empty state is neutral ("no findings yet"); a failure uses the Signal Critical vocabulary, not the empty-state treatment.

### Animations

**Motion means state change, not decoration.** This is a work instrument used in long sessions, not a page you watch load. Motion earns its place only when it communicates something changing: a panel opening, a status flipping, work in progress, a control responding to touch. There are no orchestrated load sequences and no per-element entrance choreography.

**Motion tokens** (no magic numbers):

| Token | Value | Use |
|-------|-------|-----|
| `--duration-fast`    | `120ms` | Interaction feedback: hover, active press, focus. |
| `--duration-base`    | `180ms` | Reveals, dropdowns, the single content reveal. |
| `--duration-slow`    | `240ms` | Drawer, modal — larger surfaces travelling further. |
| `--ease-feedback`    | `cubic-bezier(0.25, 1, 0.5, 1)` | Interaction feedback and exits. |
| `--ease-entrance`    | `cubic-bezier(0.22, 1, 0.36, 1)` | Surfaces entering. |

Exits run at ~75% of the enter duration. Every animation uses **only `transform` and `opacity`** — never layout properties.

**The canonical set** (one reveal, the rest functional):
- **Content reveal:** a single `reveal` (`--duration-base`, fade + slideY 6px). Used once per newly-arrived block (an audit result, a message) — not cascaded across every child. Replaces the former five-way entrance vocabulary (`enter` / `message-in` / `file-in` / `result-in` / `section-reveal`), which read as "watch it load".
- **Feedback:** hover/focus transitions at `--duration-fast`; active press is `translateY(1px)`. This is where the tool feels responsive — prioritise it over reveals.
- **Progress:** `audit-progress` (1.4s, infinite translateX) and `status-pulse` (1.8s opacity) — legitimately continuous because they signal ongoing state.
- **Drawer:** slide-in `--duration-slow` / exit faster; backdrop fades.
- **Dropdown / Overlay:** `--duration-base`, scaleY from top origin (dropdown) or scale+fade (modal).

**Safety.** `prefers-reduced-motion: reduce` disables every animation. Motion is always an enhancement, never load-bearing for meaning.

## 6. Do's and Don'ts

### Do:
- **Do** use the single system radius (8px) consistently. No other radius value should appear.
- **Do** use IBM Plex Mono for all structured data: timestamps, file names, counts, IDs, status codes.
- **Do** use IBM Plex Sans for body text, headings, and long-form conclusions.
- **Do** separate sections with 1px full-width borders (`#23282c`), never with side-stripe accents.
- **Do** keep Technical Teal to less than 10% of any screen surface.
- **Do** use tonal layering (background color differentiation) to convey depth, not shadows.
- **Do** keep the sidebar user avatar anchored at the bottom, outside the scrollable area.
- **Do** label segmented controls (Tipo, Nível) with visible mono labels to the left of the control.
- **Do** use the three signal colours (green/amber/coral) for status, and teal only for interactive elements.
- **Do** consume status colour through `--status-ok/warning/critical` and the `<Badge variant>` component — never a raw hex or a Tailwind palette class.
- **Do** show a skeleton of the eventual shape while a content region loads.
- **Do** give numeric data tabular figures so columns align.

### Don't:
- **Don't** use purple, blue, or neon gradients on any surface.
- **Don't** apply glassmorphism (backdrop blur on cards).
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe.
- **Don't** nest cards inside cards. Use border dividers within a single container.
- **Don't** animate CSS layout properties (width, height, top, left). Use transform and opacity only.
- **Don't** use gradient text (`background-clip: text`).
- **Don't** create identical card grids (same-sized icon + heading + text repeated).
- **Don't** turn the audit workspace into a landing page with hero sections or marketing copy.
- **Don't** use emojis in the interface.
- **Don't** make modals the first solution for any interaction. Exhaust inline alternatives first.
- **Don't** use teal for a status, or a signal colour (green/amber/coral) on an interactive control — the families never cross.
- **Don't** let Warning and Critical drift toward the same hue; they must be distinguishable at a glance without the label.
- **Don't** reference `--status-danger` or `--status-warn` — they don't exist. The only status tokens are `--status-ok`, `--status-warning`, `--status-critical`.
- **Don't** park a spinner in a content region; use a skeleton. Spinners live inside buttons only.
- **Don't** blur a card or panel — backdrop blur is for the modal dimming backdrop alone.
