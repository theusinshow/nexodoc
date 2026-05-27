---
name: NexoDoc Engineering System
colors:
  surface: '#0b1514'
  surface-dim: '#0b1514'
  surface-bright: '#313b39'
  surface-container-lowest: '#07100e'
  surface-container-low: '#141d1c'
  surface-container: '#182120'
  surface-container-high: '#222c2a'
  surface-container-highest: '#2d3735'
  on-surface: '#dae5e2'
  on-surface-variant: '#bbcac5'
  inverse-surface: '#dae5e2'
  inverse-on-surface: '#283230'
  outline: '#869490'
  outline-variant: '#3c4946'
  surface-tint: '#5bdac6'
  primary: '#5bdac6'
  on-primary: '#003730'
  primary-container: '#00a693'
  on-primary-container: '#00332c'
  inverse-primary: '#006b5e'
  secondary: '#c1c8c6'
  on-secondary: '#2b3231'
  secondary-container: '#464d4c'
  on-secondary-container: '#b6bdbb'
  tertiary: '#ffb59e'
  on-tertiary: '#5d1801'
  tertiary-container: '#dc7858'
  on-tertiary-container: '#571500'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7af7e1'
  primary-fixed-dim: '#5bdac6'
  on-primary-fixed: '#00201b'
  on-primary-fixed-variant: '#005046'
  secondary-fixed: '#dde4e2'
  secondary-fixed-dim: '#c1c8c6'
  on-secondary-fixed: '#161d1c'
  on-secondary-fixed-variant: '#414847'
  tertiary-fixed: '#ffdbd0'
  tertiary-fixed-dim: '#ffb59e'
  on-tertiary-fixed: '#3a0b00'
  on-tertiary-fixed-variant: '#7b2e14'
  background: '#0b1514'
  on-background: '#dae5e2'
  surface-variant: '#2d3735'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  mono-label:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style
The design system is engineered for high-stakes technical environments. It prioritizes information density, legibility, and operational confidence. The aesthetic is a sophisticated evolution of the terminal—utilitarian yet premium—utilizing a "Dark-Mode First" philosophy to reduce eye strain during long auditing sessions.

The style is **Minimalist / Technical**. It avoids decorative flourishes, instead finding beauty in alignment, precise borders, and intentional use of color as a functional indicator. It speaks to engineers and auditors who value efficiency and clarity over visual noise. Every element is designed to feel like a calibrated instrument.

## Colors
The palette is rooted in deep, desaturated teals and graphites to establish a "low-light" operational environment. 

- **Primary Background**: Use `#0A0F0E` for the base canvas of the application.
- **Surface Panels**: Use `#141B1A` for sidebars, cards, and modal containers to create subtle depth.
- **Borders & Dividers**: Use `#2D3735` for all structural divisions. High-contrast borders are discouraged; the goal is a cohesive, monolithic feel.
- **Technical Teal (Accent)**: Reserve `#00A693` for primary actions, focus states, and active data selections. 
- **Semantic Status**: Colors for Success, Warning, and Critical states must be used sparingly to ensure they immediately draw the auditor's eye to anomalies.

## Typography
Typography is the primary vehicle for data hierarchy. This design system utilizes **Geist** for its neutral, contemporary proportions and **JetBrains Mono** for technical data and labels.

- **Headlines**: Keep weights moderate (500-600). Avoid heavy bolds to maintain the sophisticated, understated tone.
- **Monospace Integration**: All audit codes, document IDs, timestamps, and numerical data must use the `mono-data` or `mono-label` styles to ensure character alignment and a "terminal" feel.
- **Hierarchy**: Use `text-muted` (gray-green) for secondary information and `text-primary` (off-white) for active content.

## Layout & Spacing
The layout follows a **Strict Modular Grid** based on a 4px baseline. This ensures that technical components like data tables and document viewers remain perfectly aligned.

- **Desktop**: A 12-column grid with a fixed sidebar (240px or 280px). Content panels should use "Panel" background colors to distinguish between navigation, document view, and audit controls.
- **Density**: High density is preferred. Use `sm` (8px) and `md` (16px) spacing for internal component padding to allow more data on screen.
- **Reflow**: On tablet, the sidebar should collapse into a rail or drawer. On mobile, the document viewer takes priority, with audit actions moved to a bottom sheet.

## Elevation & Depth
In this design system, depth is communicated through **Tonal Layering** and **Borders** rather than shadows. 

1.  **Level 0 (Background)**: `#0A0F0E` - The lowest surface.
2.  **Level 1 (Panels)**: `#141B1A` - Cards, sidebars, and header bars.
3.  **Level 2 (Active/Hover)**: Surface panels with a slightly lighter border or a 2% lighter background tint.
4.  **Level 3 (Modals/Popovers)**: Use the Panel color but with a sharp `#2D3735` border and a subtle "Scrim" (50% opacity black) to isolate the element.

Shadows should be avoided entirely to maintain the crisp, flat "instrument panel" aesthetic. If a shadow is required for extreme contrast, use a hard, 0-blur shadow (1px offset) in a dark teal tint.

## Shapes
The shape language is **Soft (Level 1)**. Elements use a 4px (`0.25rem`) radius to soften the technical edge just enough to feel modern and premium, without appearing "consumer-friendly" or bubbly.

- **Standard Elements**: Buttons, inputs, and cards use the base 4px radius.
- **Large Containers**: Large dashboard panels may use 8px (`rounded-lg`) for structural hierarchy.
- **Inner Elements**: Small tags or checkboxes should maintain the 4px radius or remain sharp if they are under 16px in height.

## Components

- **Buttons**:
  - *Primary*: Solid `#00A693` with black text. No gradients.
  - *Secondary*: Outline style using the border color `#2D3735` and teal text.
  - *Ghost*: Transparent background, teal text, only visible on hover or active state.
- **Input Fields**: Dark backgrounds (`#0A0F0E`), 1px border (`#2D3735`). Focus state transitions the border to `#00A693`.
- **Chips / Tags**: Small, monochromatic (`#141B1A` background with `#8A9A98` text). Use JetBrains Mono for the text within tags.
- **Data Tables**: The core of the app. Row height 40px. Use horizontal dividers only (`#2D3735`). No alternating row colors; use a subtle hover state (`+2% brightness`) instead.
- **Checkboxes**: Square with 2px radius. Active state is Technical Teal with a white or black checkmark.
- **Cards**: Use the `#141B1A` surface color. Ensure a 1px border is present to define the silhouette against the primary background.
- **Audit Indicators**: Small circular pips for status. Green for "Pass," Amber for "Flagged," Red for "Violation."