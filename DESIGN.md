---
name: Judge Jev
description: A measured research page for reproducible Jev evaluation results.
colors:
  paper: "#f7f6f2"
  surface: "#fffefa"
  ink: "#193238"
  muted: "#52686c"
  rule: "#d3dbd7"
  teal: "#126c61"
  teal-dark: "#0e5049"
  sand: "#f2eadb"
  sand-ink: "#694d28"
  action-teal: "oklch(60% 0.118 184.704)"
  action-teal-border: "oklch(51.1% 0.096 186.391)"
  button-light: "#ffffff"
  button-ink: "oklch(14.1% 0.005 285.823)"
  inverse-text: "#f6fbf8"
  inverse-muted: "#b9cdca"
  inverse-rule: "#52706e"
typography:
  display:
    fontFamily: "Newsreader Variable, Georgia, serif"
    fontSize: "clamp(3.8rem, 7vw, 6.1rem)"
    fontWeight: 480
    lineHeight: 0.99
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Newsreader Variable, Georgia, serif"
    fontSize: "clamp(2.7rem, 4.3vw, 4.2rem)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.028em"
  title:
    fontFamily: "Newsreader Variable, Georgia, serif"
    fontSize: "1.72rem"
    fontWeight: 550
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: "0.98rem"
    lineHeight: 1.75
  label:
    fontFamily: "Inter Variable, Inter, sans-serif"
    fontSize: "0.77rem"
    fontWeight: 750
    letterSpacing: "0.05em"
rounded:
  bar: "3px"
  wordmark: "7px"
  button: "8px"
  panel: "12px"
  chart: "13px"
spacing:
  desktop-gutter: "3rem"
  mobile-gutter: "2rem"
  chart-gap: "1.2rem"
  chart-padding: "1.75rem 1.8rem 1.65rem"
  note-padding: "1.3rem 1.45rem"
components:
  button-primary:
    backgroundColor: "{colors.action-teal}"
    textColor: "{colors.button-light}"
    rounded: "{rounded.button}"
    padding: "calc(0.625rem - 1px) calc(0.875rem - 1px)"
  button-light:
    backgroundColor: "{colors.button-light}"
    textColor: "{colors.button-ink}"
    rounded: "{rounded.button}"
    padding: "calc(0.625rem - 1px) calc(0.875rem - 1px)"
  chart-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chart}"
    padding: "{spacing.chart-padding}"
  study-note:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.sand-ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.note-padding}"
---

# Design System: Judge Jev

## Overview

**Creative North Star: "The Research Field Note"**

Judge Jev presents evidence with the calm of an academic project page. A warm paper ground, blue-green ink, and generous white space make the reading path clear. Newsreader gives findings and section headings an editorial voice; Inter keeps methods, chart labels, and dense numeric tables precise.

The page reserves stronger color for decisions and meaning: teal marks Jev results and actions, muted gray identifies published comparators, and a sand note keeps the study limitation adjacent to the findings. Data remains legible without ornamental graphics. The dark resources section closes the page with a clear shift from interpretation to source material.

**Key Characteristics:**

- Serif conclusions above restrained sans-serif evidence.
- Thin rules, gentle corners, and tonal surfaces instead of heavy containers.
- Teal for Jev and actions; neutral bars for paper benchmarks.
- Generous desktop spacing that collapses into a compact single column on phones.

## Colors

The palette uses warm off-whites and blue-green neutrals; the Catalyst action teal is brighter than the editorial teal used in charts and text.

### Primary

- **Research Teal** (`colors.teal`): Jev bars and visual data emphasis.
- **Deep Research Teal** (`colors.teal-dark`): small headings, key table values, and hover links.
- **Action Teal** (`colors.action-teal`) with **Action Teal Border** (`colors.action-teal-border`): the filled Catalyst buttons. Keep this distinct from chart teal.

### Secondary

- **Study Sand** (`colors.sand`) and **Sand Ink** (`colors.sand-ink`): the research limitation note; this warm exception signals caution without using an error red.

### Neutral

- **Paper** (`colors.paper`): page and header ground.
- **Warm Surface** (`colors.surface`): chart and table panels.
- **Blue-Green Ink** (`colors.ink`): primary reading text and the dark resources ground.
- **Muted Blue-Green** (`colors.muted`): explanatory copy and table labels.
- **Fine Rule** (`colors.rule`): section, panel, and row boundaries.
- **Inverse Text**, **Inverse Muted**, and **Inverse Rule** (`colors.inverse-text`, `colors.inverse-muted`, `colors.inverse-rule`): readable text and dividers on the dark resources ground.
- **Button Light** and **Button Ink** (`colors.button-light`, `colors.button-ink`): the light Catalyst resource action.

**The Meaningful Teal Rule.** Use teal to identify Jev measures, primary actions, and selected values; keep the paper benchmark in a separate gray treatment.

## Typography

**Display Font:** Newsreader Variable (Georgia fallback).  
**Body Font:** Inter Variable (Inter and sans-serif fallbacks).  
**Data Font:** Inter Variable with tabular numerals. Code uses the system monospace stack.

**Character:** The serif is expressive but controlled; the sans-serif is compact, durable, and clear at table scale.

### Hierarchy

- **Display** (`typography.display`): the hero question, balanced at roughly 11 characters per line; the phone size changes to `clamp(3.55rem, 12vw, 5.3rem)`.
- **Headline** (`typography.headline`): section titles, generally limited to 12–13 characters of width.
- **Title** (`typography.title`): table and method subheadings.
- **Body** (`typography.body`): section explanation, often capped around 60–64 characters.
- **Label** (`typography.label`): uppercase experiment metadata. Smaller table labels and notes use Inter at about 0.73–0.82rem.

**The Numeral Rule.** Use tabular numerals for metrics and counts so rows and comparisons scan vertically.

## Layout

The content container is capped at 1180px. It has a 3rem total viewport inset on desktop and 2rem at 700px and below. Hero, section introductions, chart pairs, method content, and resources use two columns with generous gaps; the hero and system section become one column at 900px, and the remaining pairs stack at 700px. On narrow screens (390px and below), chart labels and navigation tighten without changing the content order.

Section padding is fluid (`clamp(5.1rem, 8vw, 7.3rem)`); the hero and dark resources section use their own slightly different fluid padding. Keep prose line lengths deliberately shorter than the full grid width. Table containers may scroll horizontally rather than compressing numeric columns.

**The Evidence Pair Rule.** When two metrics invite comparison, give them equal-width panels and shared scale; place the explanatory caption directly after them.

## Elevation & Depth

The page is almost flat. Depth comes from a slight shift between paper and surface, fine 1px borders, the tinted system section, and the dark resources section. Chart and table containers have no site-authored drop shadow. Catalyst solid buttons retain their small internal highlight and shadow, so they feel actionable without turning the page into a raised-card interface.

**The Quiet Border Rule.** Use borders and tone to group research content; avoid adding heavy ambient shadows to evidence panels.

## Shapes

Panels are gently curved: study notes and table frames use a 12px radius; chart panels use 13px. The wordmark mark is a compact 7px rounded square, and Catalyst buttons use their 8px `rounded-lg` shape. Bars have 3px corners. Dividers remain straight and thin. These small differences reflect each element's scale rather than a universal pill shape.

## Components

### Buttons

- **Primary:** Catalyst solid teal with white text, a subtle border and inner highlight, an 8px radius, and responsive padding. Used for exploring results and downloading the report.
- **Light:** A white Catalyst solid button with dark text on the inverse resources section.
- **Outline:** A restrained Catalyst border with dark text for the secondary paper link on the light hero.
- **Hover / Focus:** Catalyst adds a subtle overlay on hover or active; interactive elements show a visible focus outline. Motion is brief, and reduced-motion preference removes meaningful animation.

### Study Limitation Badge and Note

The small amber Catalyst badge leads a warm sand note. At desktop width the label occupies a narrow first column; on phones it sits above the prose. Keep the limitation text readable and visually present, with the bold lead-in retained.

### Chart Cards

Off-white cards with a 1px rule border and 13px corners hold paired horizontal bars. Jev uses research teal, while the paper best uses neutral gray. Numeric values align to the right in tabular figures; the bars share a zero-based 0.5 κ scale.

### Results Tables

Dense Catalyst tables sit in bordered warm-surface frames. Numeric columns align right. The primary judgment boundary uses deep teal type; the featured Jev row gets a pale teal tint and the paper benchmark gets a neutral tint. Keep labels readable, and allow horizontal overflow on small screens.

### Navigation and Resource Links

The header uses a compact monogram, wordmark, three text links, and a source link. Navigation hover shifts to deep teal; the source link hides at 700px. The dark resources list uses simple divided rows, secondary file-type labels, and a slight left inset on hover.

## Do's and Don'ts

### Do:

- **Do** pair prominent conclusions with clearly labeled measures and nearby explanatory captions.
- **Do** use warm-surface panels, fine rules, and tabular figures for dense results.
- **Do** keep the dark resource treatment and readable light-on-dark type for source links.
- **Do** preserve a visible focus indicator and the reduced-motion behavior.

### Don't:

- **Don't** color the paper-best comparator like a Jev result.
- **Don't** replace the careful serif/sans hierarchy with one undifferentiated type style.
- **Don't** turn data panels into shadow-heavy or pill-shaped cards.
- **Don't** collapse numeric columns until the comparison is unreadable; let the table scroll.
