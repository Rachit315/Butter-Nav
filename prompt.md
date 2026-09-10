Build a React + TypeScript navigation bar component called `ButterNav`, styled with
Tailwind CSS and following shadcn/ui conventions (a single file at
`components/ui/butter-nav.tsx`, `"use client"`, the `cn()` helper from
`@/lib/utils`, no other runtime dependencies).

## Theming

Ship both themes from one component: light is the default and dark comes from
Tailwind's `dark:` variant. Light — bar `#ffffff` on a `#fafafa` page, wordmark
and panel titles `#171717`, nav links `#4d4d4d`, descriptions `#8f8f8f`, hairlines
`rgba(0,0,0,0.08)`, hover surfaces `rgba(0,0,0,0.05)`, CTA `#171717` with white
text. Dark — bar `#000000` on `#0f0f0f`, wordmark `#ffffff`, text `#f2f2f2`,
descriptions at 60% of it, hairlines `rgba(255,255,255,0.09)`, CTA `#f2f2f2`
with `#0f0f0f` text. Use `box-shadow: 0 0 0 1px <line>` rather than a CSS
border for the bar and the floating card, so nothing shifts the box model.

Every floating surface — the bar, the menu card and the mobile sheet — also
carries an inside stroke, identical in both themes:
`box-shadow: inset 0 0 0 0.4px rgba(170, 170, 170, 0.2)` (Figma: `#AAAAAA` at
20%, position Inside, weight 0.4). It goes first in the shadow list, ahead of
the surface ring and the drop shadow.

In dark, the component's page canvas behind the bar is `#0f0f0f`; in light it
is `#fafafa`.

## The shell

A floating bar, centered, max-width 840px, 80px tall (64px under `md`),
18px corner radius, with a soft drop shadow (plus an inset
`rgba(255,255,255,0.05)` top highlight in dark). Left side: a
24px wordmark. Right side: the nav links at 12px with 24px gaps, then a 1px ×
20px vertical divider, optional secondary text links, then a pill CTA — 40px
radius, 6px/14px padding, coloured per the palette above. Below `md`
the links collapse into a hamburger that opens a sheet with accordions.

## The mega menu — this is the important part

There is exactly ONE floating card, not one dropdown per item. Moving between
top-level items must never unmount or remount anything; the same card morphs.

1. Every panel stays mounted and laid out at `opacity: 0` so its natural
   width/height can be measured at any time without a reflow mid-animation.
   Cache the sizes; re-measure on resize (debounced ~120ms).
2. On open, set the card's `width`, `height` and `translate3d(x)` together and
   let them interpolate over **240ms** with `cubic-bezier(0.77, 0, 0.175, 1)`
   (movement on screen). The card is centered under the hovered trigger and
   clamped to a 16px viewport margin. Give it `contain: paint`, and set
   `will-change: width, height, transform` only while it is open.
3. Its `transform-origin` is the trigger, not its own centre: set
   `--origin: <trigger centre − card left>px` in the same frame you position
   it, and use `transform-origin: var(--origin) 0`.
4. Content cross-fades directionally: inactive panels rest translated ±14px on
   the side they will exit toward or enter from (right of the active index →
   +14px, left → −14px) **and sit at `filter: blur(3px)`**, so the two states
   read as one transformation rather than two overlapping layers. 160ms, with
   a 40ms delay on entry, so the shell leads and the text follows.
5. A single rounded highlight pill sits behind the nav links. Give it a fixed
   `width: 100px`, `transform-origin: 0 50%`, and drive it with
   `translate3d(x, -50%, 0) scaleX(target / 100)` over 220ms with
   `cubic-bezier(0.23, 1, 0.32, 1)` — never animate its `width`, which would
   run layout on every frame of a hover effect. Radius `10px` so the scaling
   does not visibly stretch the caps. The first time it appears it jumps into
   place with transitions disabled.
6. Enter and exit are asymmetric: opening is the deliberate half at 240ms
   (200ms for the opacity), closing is the system response at 140ms with
   `cubic-bezier(0.23, 1, 0.32, 1)`.
7. First open only: jump the card to the correct size and position with
   `transition: none`, force a reflow, then animate opacity `0 → 1`,
   `translateY(-4px) → 0` and `scale(0.97) → 1`. Otherwise it would slide in
   from x=0. Never animate from `scale(0)`.

## Interaction

- 90ms hover-intent before a cold open; instant swap when a menu is already
  open; 170ms grace period before closing on pointer leave.
- An invisible 14px `::before` bridge above the card spans the 10px gap between
  bar and panel so the pointer can cross without the menu closing.
- Click toggles, `ArrowDown` opens and focuses the first link, `Escape` closes
  and returns focus to the trigger. Outside pointerdown, scroll, and focus
  leaving the component all close it.
- Triggers are real `<button>`s with `aria-expanded`, `aria-haspopup` and
  `aria-controls`; panels are `role="region"` labelled by their trigger.
- Press feedback on every pressable surface: `transform: scale(0.97)` on
  `:active` over 160ms, released in 100ms.
- Gate every hover animation behind
  `@media (hover: hover) and (pointer: fine)` — touch fires a phantom hover on
  tap.
- Under `prefers-reduced-motion: reduce`, go gentler rather than silent: keep
  the opacity fades that explain what changed at ~150ms, and drop the
  transforms, the blur and the size morph so they land instantly.
- Animate `transform` and `opacity` only. The card's `width`/`height` morph is
  the one deliberate exception — it is a single out-of-flow, `contain: paint`
  element whose children are absolutely positioned, so it reflows nothing else;
  a counter-scaled FLIP would distort the 0.4px stroke and the 16px radius.

## Panel content

Panels are data-driven. A menu has `columns` and an optional `footer`. A column
is either `{ type: "cards", items: [{ title, desc, href }] }` — 13px semibold
title over a 13px muted description capped at ~21ch — or
`{ type: "links", items: [{ label, href }] }` — a plain 13px link list. Columns
are separated by 1px `white/9%` rules inside a `white/2.8%` rounded inner box
with 12px radius; the panel has 8px padding. The footer is a row with an
optional bold badge, muted text, and a right-aligned link whose arrow nudges
3px right on hover.

## API

```ts
type ButterNavProps = {
  brand: React.ReactNode
  brandHref?: string
  items: { label: string; href?: string; menu?: ButterNavMenu }[]
  secondary?: { label: string; href?: string }[]
  cta?: { label: string; href?: string }
  openDelay?: number      // 90
  closeDelay?: number     // 170
  morphDuration?: number  // 460
  closeOnScroll?: boolean // true
  sticky?: boolean        // true
  linkComponent?: React.ElementType // e.g. next/link
  className?: string
}
```

An item without a `menu` renders as a plain link. All motion values must be
props-driven where listed, and all copy comes from the config — no hardcoded
strings in the markup.
