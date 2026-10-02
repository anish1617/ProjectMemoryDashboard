---
name: Project Memory
description: A calm reading desk for returning to local projects.
colors:
  canvas: "#f6f7f5"
  surface: "#ffffff"
  soft: "#f0f3ef"
  ink: "#24362e"
  muted: "#627168"
  line: "#e1e7df"
  accent: "#2f624d"
  accent-soft: "#e6eee7"
  attention: "#795624"
  attention-bg: "#f7efdf"
  focus: "#488b6c"
  dark-canvas: "#141c18"
  dark-surface: "#1b2520"
  dark-soft: "#24312a"
  dark-ink: "#e6eee6"
  dark-muted: "#a6b4aa"
  dark-line: "#344239"
  dark-accent: "#aad6b8"
  dark-accent-soft: "#2d4736"
  dark-attention: "#eac788"
  dark-attention-bg: "#443826"
  dark-focus: "#aad6b8"
  dark-action-ink: "#1b3022"
typography:
  display:
    fontFamily: '"DM Sans Variable", sans-serif'
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"DM Sans Variable", sans-serif'
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  title:
    fontFamily: '"DM Sans Variable", sans-serif'
    fontSize: "18px"
    fontWeight: 600
    letterSpacing: "-0.015em"
  body:
    fontFamily: '"DM Sans Variable", sans-serif'
    fontSize: "13px"
    lineHeight: 1.65
  label:
    fontFamily: '"DM Sans Variable", sans-serif'
    fontSize: "12px"
  evidence:
    fontFamily: "ui-monospace, Consolas, monospace"
    fontSize: "12px"
    lineHeight: 1.6
rounded:
  provenance: "4px"
  badge: "5px"
  filter: "6px"
  control: "7px"
  navigation: "8px"
  marker: "10px"
  container: "12px"
spacing:
  compact: "6px"
  inline: "8px"
  small: "12px"
  grid: "16px"
  medium: "20px"
  panel: "24px"
  wide: "28px"
  section: "34px"
  desk: "42px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  button-secondary-hover:
    backgroundColor: "{colors.soft}"
  navigation-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.navigation}"
    padding: "12px 14px"
  status-attention:
    backgroundColor: "{colors.attention-bg}"
    textColor: "{colors.attention}"
    rounded: "{rounded.badge}"
    padding: "5px 8px"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 13px"
  project-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.container}"
    padding: "21px 22px 0"
---

# Design System: Project Memory

## Overview

**Creative North Star: "Project reading desk"**

A calm side index selects a project; the main desk opens its resume, with evidence and history nearby. Cool paper, green ink and restrained document surfaces keep technical context readable. The metaphor is spatial: no literal desk illustration is implemented.

Resume leads the current dashboard, supported by portfolio and activity. The user confirmed this direction on 2026-10-02 and requested mock dashboard first, then local tooling and gradual project onboarding. This is a code-led record, not an approved visual comp or a standing preference for future design workflows. No generated raster asset was supplied or created for this direction.

Seven directions were considered: developer workspace, journal index, operations log, research archive, document register, studio shelf and project reading desk. Board/split-flap alternatives contributed stable identity and prioritized columns; metro contributed decisive selection; type specimens contributed a typographic grid. These are rationale, not user-approved anti-references.

**Key Characteristics:**

- Calm, compact document surfaces with clear boundaries.
- Green actions and selection; amber attention with text labels.
- Readable paths and explicit evidence provenance.
- Persistent distinction between sample and local project data.

## Colors

The palette pairs cool paper neutrals with forest actions and restrained amber attention. Frontmatter records current CSS values; `apps/dashboard/src/styles.css` is the implementation source when refreshing this document.

### Primary

- **Forest action** (`accent`): actions, links, selected navigation and factual provenance.
- **Pale forest wash** (`accent-soft`): selection, project symbols and verified badges.
- **Focus green** (`focus`): keyboard outlines and project-card hover borders.

### Secondary

- **Amber attention** (`attention`, `attention-bg`): stale context, paused/debugging stages and inline errors. Text explains the meaning.

### Neutral

- **Cool paper** (`canvas`): overall workspace and form-field background.
- **Document white** (`surface`): index, cards, buttons and forms.
- **Soft paper** (`soft`): continuation context, neutral badges and hover surfaces.
- **Green ink** (`ink`): primary text.
- **Quiet green grey** (`muted`): metadata and secondary text.
- **Paper edge** (`line`): dividers and control boundaries.

Dark appearance maps each role to its `dark-` token under `:root[data-theme="dark"]`. Primary buttons use `dark-action-ink` for text. Decorative project identity colors exist in light mode; dark project icons share the theme's soft surface and accent. Identity colors carry no status meaning.

**The Meaning Rule.** Color accompanies a readable status or provenance label; it never establishes verification on its own.

## Typography

**Display Font:** DM Sans Variable, with sans-serif fallback.
**Body Font:** DM Sans Variable, self-hosted by the dashboard.
**Label/Mono Font:** ui-monospace, Consolas, monospace for paths and evidence.

The humanist sans keeps dense project context approachable. Monospace distinguishes technical references without giving the whole interface a terminal appearance.

### Hierarchy

- **Display:** page headings use the display role; mobile headings become 26px at 760px and 27px at 440px.
- **Headline:** section headings use the headline role; several portfolio headings use the title size.
- **Title:** project and card headings use the title role.
- **Body:** resume claims use the body size; paragraphs are bounded to 72ch. Supporting prose generally uses 11–13px.
- **Label:** controls use the label role; compact metadata and provenance use 9–11px.
- **Evidence:** wrapped evidence uses the evidence role; paths may use 10px in compact metadata.

**The Reference Rule.** Paths and evidence may wrap anywhere; never require horizontal scrolling to understand a reference.

## Layout

Desktop uses a sticky full-height index (232px) and a flexible desk. Main content is centered, capped at 1450px, with 24px top, 42px horizontal and 34px bottom padding. The top bar is 76px tall. Portfolio cards form three columns; continuation uses a 1.25:1 split. Resume and next actions use a 1.8:1 split with a 260px minimum supporting column and 40px gap.

At 1180px and below, the index narrows to 205px, desk padding becomes 28px, portfolio becomes two columns and resume gap becomes 25px. At 760px and below, the index becomes a compact header with icon navigation; project shortcuts and index footer disappear. The top bar becomes 54px, main padding becomes 17px 20px 30px, and continuation/resume panels stack. Portfolio remains two columns until 440px, where it becomes one. Search width changes from 245px to 190px at 760px and 166px at 440px. At 1500px and above, card gaps grow to 20px and card padding to 26px.

Spacing tokens describe recurring steps rather than every one-off measurement. Empty, loading and dense states preserve the reading order. Repository and checkpoint forms appear inline with their context.

## Elevation & Depth

No decorative shadows or gradients are implemented. Surface tones and one-pixel borders separate the index, document cards and supporting context. Toasts and busy indicators use fixed positioning rather than shadow elevation. Green outlines supply focus; hover changes a surface or border instead of lifting it.

## Shapes

Document containers use gently curved corners from the container token; controls use the smaller control token. Status badges and provenance use smaller radii. Small rounded squares identify projects and activity. One-pixel boundaries and consistent alignment do more structural work than corner decoration.

## Components

### Buttons

Restrained and explicit. Primary actions use forest fill; secondary actions use document white with a paper-edge border. Both use the frontmatter control dimensions with a 38px minimum height. Secondary hover uses soft paper. Buttons transition background and text color for 160ms with ease-out and receive a slight brightness change on hover. Keyboard focus uses a two-pixel green outline, offset four pixels. Disabled buttons use 0.55 opacity and a waiting cursor. Text actions keep green text without a filled container.

### Chips

Status chips pair a readable label with neutral, green or amber treatment. Provenance distinguishes verified statements from other sources. Filter buttons use compact spacing and a green wash when selected.

### Cards / Containers

Project cards are flat document surfaces with a paper-edge border. Hover changes to soft paper with a focus-green edge. The footer separates freshness and agent metadata from the next action. Continuation uses a soft supporting region, divided vertically on desktop and horizontally on mobile.

### Inputs / Fields

Repository and checkpoint fields use paper backgrounds, ink text and paper-edge borders. Search uses a document-white wrapper; focus-within outlines the whole search region. Form labels remain visible. Inline errors use amber attention with readable explanation and a dismissal control where provided.

### Navigation

The index uses muted text at rest, a soft hover surface and a green selected surface with stronger weight. Mobile keeps named accessible buttons while showing compact icons. Resume, evidence and history use an underline for the active tab. A keyboard-visible skip link reaches main content. Lucide icons use consistent strokes.

### Continuation and evidence

Continuation leads with a project and its next useful action. Resume claims carry provenance; evidence expands in native disclosures, and activity uses small rounded markers. Sample/local controls and source labels stay visible so illustrative content does not imply repository verification.

The working icon rotates once per second while busy. Reduced-motion preference disables animations and transitions. Toast feedback lasts four seconds. These are source observations; browser acceptance is recorded separately in project memory.

## Do's and Don'ts

### Do:

- **Do** keep the next useful action close to readable project context.
- **Do** use theme role tokens for repeated surfaces and status treatments.
- **Do** preserve readable labels, provenance and sample/local source indicators.
- **Do** wrap paths and technical evidence within the available width.
- **Do** retain keyboard focus, honest empty/error states and reduced-motion behavior.

### Don't:

- **Don't** equate a green badge or sample refresh with verified project completion.
- **Don't** introduce decorative shadows or gradients into this recorded flat system without an intentional design revision.
- **Don't** replace evidence labels with invented completion percentages.
- **Don't** describe source inspection or this design document as runtime visual acceptance.
