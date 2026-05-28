---
name: NexoDoc Audit Workspace
description: Auditoria documental inteligente para projetos de engenharia civil
colors:
  base-dark: "#090c0e"
  panel-surface: "#121518"
  technical-teal: "#00a693"
  bright-teal: "#5bdac6"
  luminous-teal: "#7af7e1"
  rust-salmon: "#dc7858"
  salmon-pink: "#ffb59e"
  destructive-pink: "#ffb4ab"
  on-surface: "#e1e7ea"
  muted-gray: "#8e9ba3"
  border-divider: "#23282c"
  input-bg: "#2c3338"
  recessed-dark: "#06080a"
  raised-gray: "#1a1e21"
  secondary-surface: "#15191c"
typography:
  display:
    fontFamily: "Geist, 'Geist Fallback', system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, 'Geist Fallback', system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, 'Geist Fallback', system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Geist, 'Geist Fallback', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  mono-label:
    fontFamily: "JetBrains Mono, 'JetBrains Mono Fallback', ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: "0.05em"
  mono-data:
    fontFamily: "JetBrains Mono, 'JetBrains Mono Fallback', ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "4px"
  DEFAULT: "4px"
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
    height: "36px"
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
- Technical typography: Geist for reading, JetBrains Mono for data integrity
- 4px base grid; all spacing derived from multiples of 4

## 2. Colors

The palette anchors on a near-black base tinted slightly cool, with a single technical teal accent and a warm salmon/rust tertiary for emphasis states and warnings.

### Primary
- **Technical Teal** (`#00a693`): Primary actions, focus rings, active data selections, current navigation state. Used on buttons, selected chips, status indicators (OK), and icon accents. Occupies less than 10% of any given screen by design.
- **Bright Teal** (`#5bdac6`): Focus ring glow, progress indicators, hover highlights on interactive teal elements.
- **Luminous Teal** (`#7af7e1`): Success/OK status badges and indicators.

### Tertiary
- **Rust Salmon** (`#dc7858`): Secondary emphasis. Active state of "Profundo" analysis level toggle, demo mode toggle accent, action callout cards. Conveys attention without alarm.
- **Salmon Pink** (`#ffb59e`): Warning/attention status badges, mock-mode indicators, low-severity alerts.

### Neutral
- **Base Dark** (`#090c0e`): Application background. The deepest surface; all panels float above it.
- **Panel Surface** (`#121518`): Cards, sidebars, modal containers, header bars. One step above background.
- **Recessed Dark** (`#06080a`): Input fields, textareas, segmented control backgrounds. Darker than background for inset effect.
- **Raised Gray** (`#1a1e21`): Hover states, secondary panels, raised surfaces.
- **On Surface** (`#e1e7ea`): Primary text, active content, foreground.
- **Muted Gray** (`#8e9ba3`): Secondary text, metadata, inactive labels, helper copy.
- **Border Divider** (`#23282c`): All structural borders and dividers.
- **Destructive Pink** (`#ffb4ab`): Error states, critical status badges, destructive action warnings.

### Named Rules
**The One Accent Rule.** Technical Teal appears on primary buttons, current selection, focus indicators, and status OK badges only. It is never used as decoration, background fill, or on inactive states.

**The Tertiary Discipline Rule.** Rust Salmon and Salmon Pink are reserved for emphasis states (deep analysis mode) and warnings respectively. They do not appear in the identity logo, page backgrounds, or passive elements.

## 3. Typography

**Display Font:** Geist (with system-ui fallback)
**Label/Mono Font:** JetBrains Mono (with ui-monospace fallback)

**Character:** A disciplined industrial pairing. Geist provides neutral, contemporary proportions for extended reading. JetBrains Mono signals technical precision: all audit codes, document IDs, timestamps, numerical data, and UI labels use it exclusively. The contrast between proportional body text and mono data creates a "terminal tool" feel without sacrificing readability.

### Hierarchy
- **Display** (600, 40px, 1.1): Hero headlines. Login page main title only.
- **Headline** (500, 24px, 1.2): Page titles, section headers (h2).
- **Title** (500, 18px, 1.4): Card titles, component headers (h3).
- **Body** (400, 14px, 1.5): Reading text, descriptions, conclusions. Cap at 65–75ch.
- **Mono Label** (500, 12px, 1.0, letter-spacing 0.05em): UI labels, section headers in sidebar, field names, tab labels, badge text.
- **Mono Data** (400, 13px, 1.4): Numerical values, timestamps, status codes, file names, audit IDs.

### Named Rules
**The Mono Discipline Rule.** Any element that conveys structured data (timestamp, file name, document ID, finding count, elapsed time) must use JetBrains Mono. Geist is reserved for headings, body paragraphs, and long-form conclusions.

## 4. Elevation

NexoDoc conveys depth through **tonal layering and borders**, not shadows. Surfaces at each level are distinguished by background color alone. Borders are always 1px full-width; side-stripe borders are forbidden.

1. **Level 0 (Background):** `#090c0e`. The base canvas.
2. **Level 1 (Panels):** `#121518`. Cards, sidebars, header bars. Always bordered with `#23282c`.
3. **Level 2 (Active/Hover):** Surface panels with a lighter border or background shift to `#1a1e21`.
4. **Level 3 (Inputs):** `#06080a`. Inset fields sit below the background for a recessed appearance.

Shadows are limited to two structural tokens used sparingly:
- `shadow-panel`: `0 1px 2px rgb(0 0 0 / 0.35)` — Panel edge definition when tonal layering alone is insufficient.
- `shadow-subtle`: `0 1px 1px rgb(0 0 0 / 0.25)` — Minimal lift for dropdowns and popovers.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only when necessary for structural clarity. Cards and panels rely on borders and background contrast first.

## 5. Components

### Buttons
- **Shape:** `4px` border-radius. Monospace labels.
- **Primary:** Solid `#00a693` background, dark text (`#06080a`). No gradients. Hover: 10% darker. Height: 36px (h-9) or 40px (h-10) for prominent CTAs.
- **Outline:** Transparent background, 1px border (`#23282c`), foreground text. Hover: border shifts to ring color, subtle background tint.
- **Secondary:** Subtle background (`#1a1e21`), border, foreground text.
- **Ghost:** Transparent, muted text. Hover: background tint + foreground text. Used for navigation, admin links, demo toggle.
- **Focus:** All variants use `focus-visible:ring-3 focus-visible:ring-[var(--ring)]/25` with border transition to ring color.

### Chips / Segmented Controls
- **Style:** Dark recessed background (`#06080a`), 1px border (`#23282c`), 4px radius container. Mono labels at 12px.
- **Selected:** Card background (`#121518`) with teal border (`#00a693`/30), medium weight.
- **Unselected:** Transparent border, muted text. Hover shifts text to foreground.
- **Special:** "Profundo" level uses Rust Salmon accent instead of teal when selected.

### Cards / Containers
- **Corner Style:** `4px` border-radius universally.
- **Background:** `#121518` for content cards, transparent for background-level strips.
- **Border:** 1px `#23282c`. Used consistently; no borderless floating elements.
- **Internal Padding:** 12px (p-3) standard, 16px (p-4) for panels and sidebars.

### Inputs / Fields
- **Style:** 1px border (`#2c3338`), recessed background (`#06080a`), 4px radius. Height: 36px (h-9) standard, 32px (h-8) compact.
- **Focus:** Border shifts to `#5bdac6`, 3px ring at 20–25% opacity.
- **Textarea:** Same treatment. Resizable vertically. Minimum height 5.5–12rem depending on context.
- **Placeholder:** `text-muted-foreground` (gray-green).

### Navigation (Sidebar)
- **Style:** 236px wide, `#121518` background, right border 1px. Logo + name at top, action buttons grouped with 4px gaps, collapsible status indicators, scrollable history list, fixed user footer at bottom.
- **Active Item:** Teal border + filled background on current page. History items are transparent with hover highlight.
- **User Area:** Fixed at sidebar bottom. Photo or initials (teal text on dark circle), name, email, sign-out icon button.

### Audit Result
- **Header:** Status badge (colored border + background tint + mono label), finding/file/time summary line, next action as emphasized title, segmented tab bar below.
- **Metrics Grid:** 2–4 column grid of compact cards (recessed background, mono labels, medium-weight values).
- **Tabs:** Segmented control pattern (`bg-recessed`, 4px radius). Active: card bg + teal border. Inactive: transparent + muted text.
- **Finding Card:** Single container with internal sections separated by borders, not nested cards. Evidence, conflict, and action are adjacent blocks distinguished by icon + label headers.

### Tooltip
- **Style:** `max-w-xs`, border + card background, `shadow-subtle`, mono text at 12px. Fade + zoom entrance via `animate-in`.
- **Trigger:** Wraps the target element via `asChild`. Delay 300ms before showing.
- **Usage:** Compact buttons without visible labels (SignOut icon-only), technical terms that benefit from explanation.

### Keyboard Shortcuts
- **Modal:** `modal-scale-in` entrance (200ms, scale + fade). Backdrop with `backdrop-blur-sm`. Dismiss via Esc or overlay click.
- **Keycap style:** `h-6 min-w-[24px]`, `rounded` border, bg-muted, mono 11px text.
- **Shortcuts:** `Ctrl+G` dashboard, `Ctrl+A` auditoria, `Ctrl+L` LD, `Ctrl+Shift+A` admin, `?` ajuda.

### Animations
- **Entrance:** `nexodoc-enter` (240ms, fade + slideY 10px), `nexodoc-message-in` (180ms), `nexodoc-file-in` (180ms), `nexodoc-result-in` (220ms), `nexodoc-section-reveal` (200ms).
- **Progress:** `audit-progress` (1.4s, infinite translateX), `nexodoc-status-pulse` (1.8s, opacity pulse).
- **Drawer:** `sidebar-drawer-open` (220ms, slide-in from left), `sidebar-drawer-closing` (180ms exit). Backdrop `backdrop-fade-in` (200ms) / `backdrop-fade-out` (150ms).
- **Dropdown:** `dropdown-expand` (180ms, scaleY from top origin).
- **Easing:** `cubic-bezier(0.25, 1, 0.5, 1)` para feedback; `cubic-bezier(0.22, 1, 0.36, 1)` para entrances. Exit faster than enter (approx 75% da duracao).
- **Safety:** Tudo usa `transform` + `opacity`. `prefers-reduced-motion` desabilita todas as animacoes.

## 6. Do's and Don'ts

### Do:
- **Do** use `rounded-sm` (4px) consistently. No other radius value should appear.
- **Do** use JetBrains Mono for all structured data: timestamps, file names, counts, IDs, status codes.
- **Do** use Geist for body text, headings, and long-form conclusions.
- **Do** separate sections with 1px full-width borders (`#23282c`), never with side-stripe accents.
- **Do** keep Technical Teal to less than 10% of any screen surface.
- **Do** use tonal layering (background color differentiation) to convey depth, not shadows.
- **Do** keep the sidebar user avatar anchored at the bottom, outside the scrollable area.
- **Do** label segmented controls (Tipo, Nível) with visible mono labels to the left of the control.

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
