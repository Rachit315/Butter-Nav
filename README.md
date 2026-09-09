# Butter Nav

A floating navbar whose mega-menu is **one card** that morphs its width,
height and position between menus — with a direction-aware content cross-fade
and a hover pill that tracks the cursor. Built to the Figma design
(`Accord` › node `504:173`), motion modelled on linear.app, docs page styled
after the Vercel design language. Ships light and dark.

```
index.html                    the docs page — the deployed landing page
preview.html                  isolated preview embedded by the docs page
demo.html                     plain full-page demo of the vanilla build
favicon.svg                   the dot, inverted per theme

components/ui/butter-nav.tsx  the shadcn component (React + TS + Tailwind)
r/butter-nav.json             shadcn registry item (the CLI installs this)
registry.json                 registry index
prompt.md                     the "rebuild this component" prompt

scripts/sync-registry.mjs     re-embeds the .tsx into r/butter-nav.json
src/butter-nav.css            vanilla build — styles
src/butter-nav.js             vanilla build — ButterNav class
vercel.json                   static config: clean URLs, headers, CORS on /r
```

There are two implementations of the same component. The **shadcn/React one**
is what people install; the **vanilla one** powers the docs preview and works
with no build step.

## Docs page

```bash
python -m http.server 5177
```

Open http://localhost:5177. A single centred column — achromatic
palette, Geist, shadow-as-border instead of CSS borders, 4px spacing scale,
weights capped at 600. The header carries a three-way theme toggle
(light / system / dark) that persists in `localStorage`, applies before first
paint, and is forwarded to the preview iframe by `postMessage`, so the
component itself flips theme with the page. Below it: Preview/Code tabs over
the live component, package-manager tabs, a props table, keyboard reference,
and two actions:

- **Copy npm i** — copies the shadcn CLI command for the selected package
  manager.
- **Copy prompt** — copies `prompt.md`, a spec that describes every
  measurement and motion rule so an AI editor can regenerate the component
  inside someone else's design system, ready to edit afterwards.

## Install (shadcn)

```bash
npx shadcn@latest add https://<your-deployment>/r/butter-nav.json
```

The docs page builds that URL from `location.origin`, so the copy button hands
out a working command as soon as the site is deployed — nothing to find and
replace. Locally it copies the `localhost:5177` form, which works too.

## Deploying to Vercel

The repo is a static site with no build step, so import it and deploy — the
project root is the output directory. `vercel.json` sets clean URLs, serves
`/r/*.json` as JSON with `Access-Control-Allow-Origin: *` (the shadcn CLI
fetches it cross-origin), serves the `.tsx` source and `prompt.md` as
`text/plain` so the docs page can fetch and display them, and adds
`nosniff` / `Referrer-Policy`. Set the framework preset to **Other**; leave
build and install commands empty.

## Use it

```tsx
import { ButterNav } from "@/components/ui/butter-nav"

<ButterNav
  brand="Pro.nav"
  cta={{ label: "Sign up", href: "/signup" }}
  items={[
    {
      label: "Product",
      menu: {
        columns: [
          { type: "cards", items: [{ title: "Intake", desc: "…", href: "/intake" }] },
          { type: "links", items: [{ label: "Changelog", href: "/changelog" }] },
        ],
        footer: { badge: "New", text: "Priority inbox", cta: { label: "Learn more" } },
      },
    },
    { label: "Pricing", href: "/pricing" },
  ]}
/>
```

Props: `brand`, `brandHref`, `items`, `secondary`, `cta`, `openDelay` (90),
`closeDelay` (170), `morphDuration` (460), `closeOnScroll` (true),
`sticky` (true), `linkComponent`, `className`. An item without a `menu` is a
plain link. Full table in `docs.html`.

## How the motion works

1. **Measure once.** All panels stay mounted at `opacity: 0`, so their natural
   width/height can be read without a reflow mid-animation.
2. **Morph the shell.** `width`, `height` and `translate3d(x)` are set together
   and interpolated with `cubic-bezier(0.32, 0.72, 0, 1)` over 460ms — a long
   decelerating tail with no overshoot. The card is centred on the trigger and
   clamped 16px from the viewport edge.
3. **Cross-fade directionally.** Inactive panels rest ±14px on the side they
   will exit toward, over 200ms — faster than the shell, so the box leads and
   the text follows.
4. **The pill follows the cursor.** One rounded highlight animates
   `transform`/`width` on the same curve, jumping into place the first time.
5. **Intent delays.** 90ms before a cold open, instant when swapping menus,
   170ms grace on leave, plus an invisible 14px bridge above the card so the
   pointer can cross the bar → panel gap.

## Behaviour

- Hover, click, or `ArrowDown` to open; `Escape`, outside click, scroll, or
  focus leaving the component closes it.
- Real `<button>` triggers with `aria-expanded` / `aria-controls`; panels are
  labelled regions; focus rings preserved.
- Under `md` (860px in the vanilla build) the bar collapses to a sheet with
  height-animated accordions.
- `prefers-reduced-motion` collapses the transitions.

## After editing the component

`components/ui/butter-nav.tsx` is the source of truth; the registry item embeds
a copy of it. Re-sync them with:

```bash
node scripts/sync-registry.mjs
```

## Theming

- The React component is light by default with `dark:` variants throughout, so
  it follows the host app's shadcn `.dark` class.
- The vanilla build is driven by CSS custom properties: dark by default, light
  under `html[data-theme="light"]` or a light OS preference when no attribute
  is set.

## Notes

- The React file transpiles cleanly (checked with esbuild); it has not been
  type-checked against `@types/react` in this folder since there is no
  `node_modules` here.
- All copy in the examples and in `ButterNav.defaultConfig` is dummy content.
- `registry.json` lists `butter-nav.vercel.app` as the homepage — change it to
  the real domain after the first deploy.
