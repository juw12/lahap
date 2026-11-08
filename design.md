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
