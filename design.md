# Lahap design system

Read this before any visual change. Code must match these values.

## Idea
A food diary that feels like a stack of warung receipts on paper: warm, factual, numbers in mono.
Signature: the **plate glyph** (veg / protein / starch wedges sized by what you logged) and the **ticket**
entry with a dashed tear line and notches. Share cards reuse both, plus a thermal **receipt** template.

## Palette (AA checked)
- paper `#f5efe3` (page), card `#fffdf8`, ink `#1d1813`, muted `#5e554a` (6.4:1 on paper)
- accent chili `#b4380f` (5.2:1 on paper; white on accent 6.0:1). One accent: primary buttons, focus, active tab, radar.
- leaf `#2f6a3a` / `#dcebd9` (balanced), amber `#85560a` / `#f3e3c2` (okay), chili-soft `#f6d9d0` with `#8f2a0a` (heavy)
- plate wedges: veg `#4f8a3c`, protein `#a8452a`, starch `#e0b25a`, sugary cup `#b5577a`

## Type
- display: Iowan Old Style / Palatino / Georgia serif (headings, big numbers)
- body: system-ui
- mono: ui-monospace / Cascadia Mono / Consolas (prices, labels, eyebrow text, receipts)
Never Inter-only. Floor 12 px.

## Space, shape, motion
Spacing 4/8/12/16/24/32/48. Radius 10 (cards), 6 (inputs), pills 999. One soft shadow. Motion only on toast;
respect reduced motion.

## Voice
Plain, short, Singapore/Indonesia English with local food words (makan, warung). No hype words, no emoji icons.
Health is a "plate score": a nudge, never medical advice.

## Banned defaults
Purple/indigo gradients, glow blobs, glassmorphism, emoji as icons, identical icon+heading card grids,
gradient text, fake testimonials, "Get started" hero.

## Food photos, nutrition, Lab, quiz (added 2026-11-08)
- Cut-out food sits on a warm paper tile (`--card`) with one soft drop shadow; never on a checkerboard in the app,
  only in the transparent share preview. "Original" is always one tap away.
- Nutrition uses the same mono labels + serif numbers as the stat row. Tips are one line each, max two, plain verbs.
  Every estimate carries "Estimated from typical portions, not measured. Not medical advice."
- Today bar: two thin bars (kcal chili, protein leaf), no rings or gauges.
- Lab recipe cards are paper cards with mono meta (min, kcal, protein); ingredients you have turn leaf green.
- Quiz is a bottom sheet with a thin chili progress line, one question per step, always skippable.

## Memory: stamps, place and bud pages, picker, recap (added 2026-11-13)
- A place is a **stamp**: a rubber-stamp box (2 px ink border with a thin inner line, tilted by under 1 degree) with
  the place name in mono caps, the last visit date and the visit count in serif. Places with 3 or more visits are
  "regular" and print in chili. No badges, medals or confetti.
- Place pages and bud pages are bottom sheets built from the same parts as the diary: stat row, then plain meal rows
  with a dashed rule between them. One primary action per sheet.
- "Makan apa?" picker shows one dish in serif on a ticket. The only motion is the dish name swapping a few times
  before it settles (text only, under a second); with reduced motion it shows the pick at once. This is the one
  motion exception besides the toast.
- Recap is a thermal receipt (mono, dashed rules, totals at the bottom), the same language as the Receipt share card.
- Favourite is a small heart outline that fills chili. It is the only place a heart is used.
- Numbers off (`html[data-numbers="off"]`) hides anything marked `.num-only` and the nutrition blocks; layouts must
  still read as complete without them.

## Studio, looks and languages (added 2026-11-13, run 2)
- Studio tools (collections, food map, Share Studio, games, Ask Lahap, memory lane) open as one bottom sheet,
  `#dlg-studio`, from a six-tile panel on Insights. Tiles are plain cards with a mono label and a serif name; no
  gradients, no icons bigger than the label.
- Looks are token swaps only: `:root[data-theme]` sets `--paper`, `--card`, `--ink`, `--muted`, `--line`,
  `--accent` (Receipt is the default; Night, Matcha, Sambal, Kopi, Laut). Components must never hard-code a light
  colour; surfaces that need translucency use `color-mix(in srgb, var(--paper) 94%, transparent)`.
- Type styles (`:root[data-type]`: classic, rounded, mono, large) only swap `--font-display` / `--font-body` or the
  base size; layout must not depend on a specific font.
- Share Studio canvas is 1080 x 1350. Templates draw with the current theme tokens; doodles use four inks and one undo.
- Table window (Memory lane sheet) shows six meals at most in one of three layouts: Scatter (tilted photo tiles),
  Postcard (one photo, name and place behind a dashed rule) and Menu (names, dotted leaders, prices in mono).
- Food map pins are round ink dots with the visit count; tiles are OpenStreetMap; with no network the map falls back
  to a plain place list, never an empty grey box.
- Languages: 14, chosen in Profile. Text is translated in place from the English source, so English stays the
  reference. Labels in tabs, chips and the Log button never wrap (ellipsis instead); outside English the ticket
  share button is the icon disc only. User content (dish names, places, notes, people) is never translated.
