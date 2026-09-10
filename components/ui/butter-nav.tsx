"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type ButterNavCard = {
  title: string
  desc?: string
  href?: string
}

export type ButterNavLink = {
  label: string
  href?: string
}

export type ButterNavColumn =
  | { type: "cards"; items: ButterNavCard[] }
  | { type: "links"; items: ButterNavLink[] }

export type ButterNavFooter = {
  badge?: string
  text: string
  cta?: ButterNavLink
}

export type ButterNavMenu = {
  columns: ButterNavColumn[]
  footer?: ButterNavFooter
}

export type ButterNavItem = {
  label: string
  /** Plain link when there is no `menu`. */
  href?: string
  menu?: ButterNavMenu
}

export interface ButterNavProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  brand: React.ReactNode
  brandHref?: string
  items: ButterNavItem[]
  /** Text links shown after the divider, before the CTA. */
  secondary?: ButterNavLink[]
  cta?: ButterNavLink
  /** Hover intent before a cold open, in ms. */
  openDelay?: number
  /** Grace period before closing on pointer leave, in ms. */
  closeDelay?: number
  /** Duration of the width / height / position morph, in ms. */
  morphDuration?: number
  /** Close the menu when the page scrolls. */
  closeOnScroll?: boolean
  sticky?: boolean
  /** Render a custom link element (e.g. next/link). */
  linkComponent?: React.ElementType
}

/* -------------------------------------------------------------------------- */
/*                                  Component                                 */
/* -------------------------------------------------------------------------- */

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

/* Curves from the animations.dev catalogue. Every duration below sits under
   the 300ms ceiling for UI motion. */
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)" /* entering / exiting */
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)" /* moving on screen */
const EASE_DRAWER = "cubic-bezier(0.32, 0.72, 0, 1)" /* the sheet */

const CLOSE = 140 /* system response — snappier than the deliberate open */
const OPEN = 200
const FADE = 160
const PRESS = 160
const SHIFT = 14
const PILL_BASE = 100 /* the pill scales off a fixed width, never animates it */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return reduced
}

export function ButterNav({
  brand,
  brandHref = "#",
  items,
  secondary = [],
  cta,
  openDelay = 90,
  closeDelay = 170,
  morphDuration = 240,
  closeOnScroll = true,
  sticky = true,
  linkComponent,
  className,
  ...props
}: ButterNavProps) {
  const Link = (linkComponent ?? "a") as React.ElementType
  // Reduced motion keeps the fades that explain what changed and drops
  // everything that moves or resizes.
  const reduced = usePrefersReducedMotion()
  const morph = reduced ? 0 : morphDuration

  const [active, setActive] = React.useState<number | null>(null)
  // The panel that is painted. It lags `active` on close so the card can fade
  // out with its content intact instead of emptying first.
  const [shown, setShown] = React.useState<number | null>(null)
  const [sheet, setSheet] = React.useState(false)
  const [hovered, setHovered] = React.useState<number | null>(null)

  const rootRef = React.useRef<HTMLElement>(null)
  const innerRef = React.useRef<HTMLDivElement>(null)
  const navRef = React.useRef<HTMLDivElement>(null)
  const cardRef = React.useRef<HTMLDivElement>(null)
  const pillRef = React.useRef<HTMLSpanElement>(null)
  const triggers = React.useRef<Array<HTMLElement | null>>([])
  const panels = React.useRef<Array<HTMLDivElement | null>>([])

  const sizes = React.useRef<Record<number, { w: number; h: number }>>({})
  const x = React.useRef(0)
  const wasOpen = React.useRef(false)
  const pillShown = React.useRef(false)
  const openTimer = React.useRef<number | null>(null)
  const closeTimer = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (active !== null) setShown(active)
  }, [active])

  /* ----------------------------- measurement ----------------------------- */

  // Panels stay mounted and laid out at opacity 0, so their natural size can be
  // read at any moment without a reflow while the card is animating.
  const measure = React.useCallback(() => {
    panels.current.forEach((panel, i) => {
      if (!panel) return
      sizes.current[i] = {
        w: Math.ceil(panel.offsetWidth),
        h: Math.ceil(panel.offsetHeight),
      }
    })
  }, [])

  useIsomorphicLayoutEffect(() => {
    measure()
  }, [measure, items])

  /* ------------------------------ positioning ---------------------------- */

  const positionCard = React.useCallback(
    (index: number, instant: boolean) => {
      const card = cardRef.current
      const inner = innerRef.current
      const trigger = triggers.current[index]
      const size = sizes.current[index]
      if (!card || !inner || !trigger || !size) return

      const innerRect = inner.getBoundingClientRect()
      const rect = trigger.getBoundingClientRect()

      const margin = 16
      const min = margin - innerRect.left
      const max = Math.max(
        min,
        window.innerWidth - margin - size.w - innerRect.left
      )
      const next = Math.min(
        Math.max(rect.left + rect.width / 2 - innerRect.left - size.w / 2, min),
        max
      )
      x.current = next

      // Anchor the scale origin on the trigger before anything animates.
      const origin = rect.left + rect.width / 2 - innerRect.left - next
      card.style.setProperty("--butter-nav-origin", `${Math.round(origin)}px`)

      const commit = () => {
        card.style.width = `${size.w}px`
        card.style.height = `${size.h}px`
        card.style.transform = `translate3d(${next}px, 0, 0) scale(1)`
      }

      if (instant) {
        // Cold open: jump into place, then let opacity + scale animate in.
        card.style.transition = "none"
        card.style.width = `${size.w}px`
        card.style.height = `${size.h}px`
        card.style.transform = `translate3d(${next}px, -4px, 0) scale(0.97)`
        void card.offsetWidth
        card.style.transition = ""
        commit()
      } else {
        commit()
      }
    },
    []
  )

  const movePill = React.useCallback((index: number | null) => {
    const pill = pillRef.current
    const nav = navRef.current
    if (!pill || !nav) return

    if (index === null) {
      pill.style.opacity = "0"
      pillShown.current = false
      return
    }

    const trigger = triggers.current[index]
    if (!trigger) return

    const navRect = nav.getBoundingClientRect()
    const rect = trigger.getBoundingClientRect()
    const pad = 12
    const left = rect.left - navRect.left - pad
    const width = rect.width + pad * 2

    // scaleX off a fixed base keeps this on the compositor — animating
    // `width` would run layout on every frame of a hover effect.
    const transform = `translate3d(${left}px, -50%, 0) scaleX(${width / PILL_BASE})`

    if (!pillShown.current) {
      pill.style.transition = "none"
      pill.style.transform = transform
      void pill.offsetWidth
      pill.style.transition = ""
    } else {
      pill.style.transform = transform
    }
    pill.style.opacity = "1"
    pillShown.current = true
  }, [])

  useIsomorphicLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return

    if (active === null) {
      card.style.transform = `translate3d(${x.current}px, -4px, 0) scale(0.97)`
      wasOpen.current = false
      return
    }

    if (!sizes.current[active]) measure()
    positionCard(active, !wasOpen.current)
    wasOpen.current = true
  }, [active, measure, positionCard])

  useIsomorphicLayoutEffect(() => {
    movePill(active ?? hovered)
  }, [active, hovered, movePill])

  /* -------------------------------- timers ------------------------------- */

  const clearTimers = React.useCallback(() => {
    if (openTimer.current) window.clearTimeout(openTimer.current)
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    openTimer.current = null
    closeTimer.current = null
  }, [])

  const requestOpen = React.useCallback(
    (index: number) => {
      clearTimers()
      // Instant when a menu is already open — that swap is the whole point.
      if (active !== null) {
        setActive(index)
        return
      }
      openTimer.current = window.setTimeout(
        () => setActive(index),
        openDelay
      )
    },
    [active, clearTimers, openDelay]
  )

  const requestClose = React.useCallback(() => {
    clearTimers()
    closeTimer.current = window.setTimeout(() => setActive(null), closeDelay)
  }, [clearTimers, closeDelay])

  React.useEffect(() => () => clearTimers(), [clearTimers])

  /* ----------------------------- global events --------------------------- */

  React.useEffect(() => {
    let frame: number | null = null
    const onResize = () => {
      if (frame) window.clearTimeout(frame)
      frame = window.setTimeout(() => {
        measure()
        if (active !== null) positionCard(active, false)
      }, 120)
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (active !== null) {
        triggers.current[active]?.focus()
        setActive(null)
      }
      setSheet(false)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setActive(null)
      setSheet(false)
    }

    const onScroll = () => {
      if (closeOnScroll) setActive(null)
    }

    window.addEventListener("resize", onResize)
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("resize", onResize)
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("scroll", onScroll)
      if (frame) window.clearTimeout(frame)
    }
  }, [active, closeOnScroll, measure, positionCard])

  /* -------------------------------- render ------------------------------- */

  const open = active !== null

  return (
    <header
      ref={rootRef}
      data-slot="butter-nav"
      data-state={open ? "open" : "closed"}
      className={cn(
        "z-50 w-full px-4 pt-6 font-sans antialiased",
        sticky && "sticky top-0",
        className
      )}
      {...props}
    >
      <div ref={innerRef} className="relative mx-auto w-full max-w-[840px]">
        {/* ------------------------------ the bar ----------------------------- */}
        <div
          className="relative z-[2] flex h-16 items-center rounded-[18px] bg-white px-4 shadow-[inset_0_0_0_0.4px_rgba(170,170,170,0.2),0_0_0_1px_rgba(0,0,0,0.08),0_8px_24px_-12px_rgba(0,0,0,0.16)] md:h-20 md:px-6 dark:bg-black dark:shadow-[inset_0_0_0_0.4px_rgba(170,170,170,0.2),0_1px_0_rgba(255,255,255,0.05)_inset,0_12px_40px_-12px_rgba(0,0,0,0.9)]"
          onPointerLeave={() => {
            setHovered(null)
            requestClose()
          }}
        >
          <Link
            href={brandHref}
            className="whitespace-nowrap text-xl tracking-[-0.01em] text-[#171717] md:text-2xl dark:text-white"
          >
            {brand}
          </Link>

          <nav
            ref={navRef}
            aria-label="Main"
            className="relative ml-auto hidden items-center gap-6 md:flex"
          >
            <span
              ref={pillRef}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-1/2 h-[30px] origin-left rounded-[10px] bg-black/[0.06] opacity-0 dark:bg-white/[0.08]"
              style={{
                width: PILL_BASE,
                transform: "translate3d(0, -50%, 0) scaleX(0)",
                transition: reduced
                  ? `opacity ${FADE}ms linear`
                  : `transform 220ms ${EASE_OUT}, opacity 120ms linear`,
              }}
            />

            {items.map((item, i) =>
              item.menu ? (
                <button
                  key={item.label}
                  type="button"
                  id={`butter-nav-trigger-${i}`}
                  aria-expanded={active === i}
                  aria-haspopup="true"
                  aria-controls={`butter-nav-panel-${i}`}
                  ref={(node) => {
                    triggers.current[i] = node
                  }}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "touch") return
                    setHovered(i)
                    requestOpen(i)
                  }}
                  onFocus={() => setHovered(i)}
                  onClick={() => setActive(active === i ? null : i)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowDown") return
                    event.preventDefault()
                    setActive(i)
                    panels.current[i]?.querySelector("a")?.focus()
                  }}
                  className={cn(
                    "relative z-[1] cursor-pointer whitespace-nowrap text-xs leading-none text-[#4d4d4d] dark:text-[#f2f2f2] opacity-85 transition-opacity duration-150 outline-none",
                    "hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#171717]/40 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:focus-visible:ring-[#f2f2f2]/60 dark:focus-visible:ring-offset-black",
                    active === i && "opacity-100"
                  )}
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.label}
                  href={item.href ?? "#"}
                  ref={(node: HTMLElement | null) => {
                    triggers.current[i] = node
                  }}
                  onPointerEnter={(event: React.PointerEvent) => {
                    if (event.pointerType === "touch") return
                    setHovered(i)
                    requestClose()
                  }}
                  onFocus={() => setHovered(i)}
                  className="relative z-[1] whitespace-nowrap text-xs leading-none text-[#4d4d4d] dark:text-[#f2f2f2] opacity-85 transition-opacity duration-150 hover:opacity-100"
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          <div className="ml-6 hidden items-center gap-6 md:flex">
            <span aria-hidden="true" className="h-5 w-px bg-black/15 dark:bg-[#f2f2f2]/25" />
            {secondary.map((link) => (
              <Link
                key={link.label}
                href={link.href ?? "#"}
                className="whitespace-nowrap text-xs leading-none text-[#4d4d4d] dark:text-[#f2f2f2] opacity-85 transition-opacity duration-150 hover:opacity-100"
              >
                {link.label}
              </Link>
            ))}
            {cta ? (
              <Link
                href={cta.href ?? "#"}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-[40px] bg-[#171717] px-[14px] py-1.5 text-xs text-white dark:bg-[#f2f2f2] dark:text-[#0f0f0f] transition-[transform,opacity] duration-200 hover:opacity-90 active:scale-[0.97]"
              >
                {cta.label}
              </Link>
            ) : null}
          </div>

          <button
            type="button"
            aria-label={sheet ? "Close menu" : "Open menu"}
            aria-expanded={sheet}
            onClick={() => setSheet((value) => !value)}
            className="ml-auto grid size-10 place-items-center rounded-[10px] md:hidden"
          >
            <span className="sr-only">Menu</span>
            <span aria-hidden="true" className="flex flex-col gap-[5px]">
              {[0, 1, 2].map((line) => (
                <span
                  key={line}
                  className={cn(
                    "block h-[1.5px] w-[18px] rounded-sm bg-[#171717] transition-[transform,opacity] dark:bg-[#f2f2f2] duration-300",
                    sheet && line === 0 && "translate-y-[6.5px] rotate-45",
                    sheet && line === 1 && "opacity-0",
                    sheet && line === 2 && "-translate-y-[6.5px] -rotate-45"
                  )}
                  style={{ transitionTimingFunction: EASE_IN_OUT }}
                />
              ))}
            </span>
          </button>
        </div>

        {/* ---------------------------- the mega menu ------------------------- */}
        <div className="pointer-events-none absolute left-0 top-full hidden h-0 w-full md:block">
          <div
            ref={cardRef}
            data-state={open ? "open" : "closed"}
            onPointerEnter={() => clearTimers()}
            onPointerLeave={() => {
              setHovered(null)
              requestClose()
            }}
            className={cn(
              "pointer-events-none absolute left-0 top-[10px] h-0 w-0 overflow-hidden rounded-2xl bg-white opacity-0 [contain:paint] dark:bg-[#0b0b0b]",
              "shadow-[inset_0_0_0_0.4px_rgba(170,170,170,0.2),0_0_0_1px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.02),0_8px_16px_-4px_rgba(0,0,0,0.04),0_24px_32px_-8px_rgba(0,0,0,0.06)]",
              "dark:shadow-[inset_0_0_0_0.4px_rgba(170,170,170,0.2),0_0_0_1px_rgba(255,255,255,0.09),0_24px_60px_-20px_rgba(0,0,0,0.9)]",
              // invisible bridge so the pointer can cross the bar → card gap
              "before:absolute before:inset-x-0 before:-top-3.5 before:h-3.5 before:content-['']",
              open && "pointer-events-auto opacity-100"
            )}
            style={{
              // Scales out of the trigger that opened it, not its own centre.
              transformOrigin: "var(--butter-nav-origin, 50%) 0",
              transform: "translate3d(0, -4px, 0) scale(0.97)",
              transition: reduced
                ? `opacity ${FADE}ms linear`
                : [
                    `width ${open ? morph : CLOSE}ms ${open ? EASE_IN_OUT : EASE_OUT}`,
                    `height ${open ? morph : CLOSE}ms ${open ? EASE_IN_OUT : EASE_OUT}`,
                    `transform ${open ? morph : CLOSE}ms ${open ? EASE_IN_OUT : EASE_OUT}`,
                    `opacity ${open ? OPEN : CLOSE}ms ${EASE_OUT}`,
                  ].join(", "),
              willChange: open ? "width, height, transform" : undefined,
            }}
          >
            {items.map((item, i) => {
              if (!item.menu) return null
              // Inactive panels rest on the side they will exit / enter from, so
              // the cross-fade always follows the direction of travel.
              const shift =
                shown === null || shown === i ? 0 : i > shown ? SHIFT : -SHIFT

              return (
                <div
                  key={item.label}
                  id={`butter-nav-panel-${i}`}
                  role="region"
                  aria-labelledby={`butter-nav-trigger-${i}`}
                  aria-hidden={active !== i}
                  ref={(node) => {
                    panels.current[i] = node
                  }}
                  className={cn(
                    "absolute left-0 top-0 w-max p-2",
                    shown === i && active !== null
                      ? "pointer-events-auto opacity-100"
                      : shown === i
                        ? "pointer-events-none opacity-100"
                        : "pointer-events-none opacity-0"
                  )}
                  style={{
                    // A touch of blur blends the two panels into one perceived
                    // transformation instead of two overlapping states.
                    filter: reduced || shown === i ? "blur(0px)" : "blur(3px)",
                    transform: reduced
                      ? undefined
                      : `translate3d(${shift}px, 0, 0)`,
                    transition: reduced
                      ? `opacity ${FADE}ms linear`
                      : `opacity ${FADE}ms linear, transform ${FADE}ms ${EASE_OUT}, filter ${FADE}ms ${EASE_OUT}`,
                    transitionDelay: shown === i ? "40ms" : "0ms",
                  }}
                >
                  <ButterNavPanel menu={item.menu} Link={Link} />
                </div>
              )
            })}
          </div>
        </div>

        {/* ------------------------------ mobile ------------------------------ */}
        <ButterNavSheet
          open={sheet}
          items={items}
          cta={cta}
          Link={Link}
          morphDuration={morphDuration}
        />
      </div>
    </header>
  )
}

/* -------------------------------------------------------------------------- */
/*                                    Panel                                   */
/* -------------------------------------------------------------------------- */

function ButterNavPanel({
  menu,
  Link,
}: {
  menu: ButterNavMenu
  Link: React.ElementType
}) {
  return (
    <>
      <div className="flex items-stretch rounded-xl bg-black/[0.02] dark:bg-white/[0.028]">
        {menu.columns.map((column, index) => (
          <div
            key={index}
            className={cn(
              "px-[26px] py-[22px]",
              index > 0 && "border-l border-black/[0.08] dark:border-white/[0.09]",
              column.type === "links"
                ? "flex min-w-[210px] flex-col justify-start gap-1"
                : "min-w-[240px]"
            )}
          >
            {column.type === "links"
              ? column.items.map((entry) => (
                  <Link
                    key={entry.label}
                    href={entry.href ?? "#"}
                    className="block rounded-lg px-3 py-[9px] text-[13px] leading-tight text-[#171717] dark:text-[#f2f2f2] transition-colors duration-150 hover:bg-black/[0.05] dark:hover:bg-white/[0.05]"
                  >
                    {entry.label}
                  </Link>
                ))
              : column.items.map((entry, i) => (
                  <Link
                    key={entry.title}
                    href={entry.href ?? "#"}
                    className={cn(
                      "-mx-3 -my-2.5 block rounded-[10px] px-3 py-2.5 transition-colors duration-150 hover:bg-black/[0.05] dark:hover:bg-white/[0.05]",
                      i > 0 && "mt-3"
                    )}
                  >
                    <span className="block text-[13px] font-semibold leading-tight text-[#171717] dark:text-[#f2f2f2]">
                      {entry.title}
                    </span>
                    {entry.desc ? (
                      <span className="mt-1 block max-w-[21ch] text-[13px] leading-[1.45] text-[#8f8f8f] dark:text-[#4d4d4d] dark:text-[#f2f2f2]/60">
                        {entry.desc}
                      </span>
                    ) : null}
                  </Link>
                ))}
          </div>
        ))}
      </div>

      {menu.footer ? (
        <div className="flex items-center justify-between gap-10 px-[18px] pb-2.5 pt-3.5 text-[13px]">
          <div>
            {menu.footer.badge ? (
              <span className="mr-2 font-semibold text-[#171717] dark:text-[#f2f2f2]">
                {menu.footer.badge}
              </span>
            ) : null}
            <span className="text-[#8f8f8f] dark:text-[#4d4d4d] dark:text-[#f2f2f2]/60">{menu.footer.text}</span>
          </div>
          {menu.footer.cta ? (
            <Link
              href={menu.footer.cta.href ?? "#"}
              className="group inline-flex items-center gap-1.5 whitespace-nowrap text-[#171717] dark:text-[#f2f2f2]"
            >
              {menu.footer.cta.label}
              <span className="transition-transform duration-300 group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Mobile sheet                                */
/* -------------------------------------------------------------------------- */

function ButterNavSheet({
  open,
  items,
  cta,
  Link,
  morphDuration,
}: {
  open: boolean
  items: ButterNavItem[]
  cta?: ButterNavLink
  Link: React.ElementType
  morphDuration: number
}) {
  const [expanded, setExpanded] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!open) setExpanded(null)
  }, [open])

  return (
    <div
      className={cn(
        "absolute inset-x-0 top-[calc(100%+10px)] origin-top rounded-2xl bg-white p-2 shadow-[inset_0_0_0_0.4px_rgba(170,170,170,0.2),0_0_0_1px_rgba(0,0,0,0.08),0_8px_16px_-4px_rgba(0,0,0,0.04),0_24px_32px_-8px_rgba(0,0,0,0.06)] md:hidden dark:bg-[#0b0b0b] dark:shadow-[inset_0_0_0_0.4px_rgba(170,170,170,0.2),0_0_0_1px_rgba(255,255,255,0.09),0_24px_60px_-20px_rgba(0,0,0,0.9)]",
        open
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
          : "pointer-events-none -translate-y-2 scale-[0.98] opacity-0"
      )}
      style={{
        transition: `opacity ${open ? OPEN : CLOSE}ms ${EASE_OUT}, transform ${open ? OPEN : CLOSE}ms ${EASE_DRAWER}`,
      }}
    >
      {items.map((item, i) =>
        item.menu ? (
          <div key={item.label}>
            <button
              type="button"
              aria-expanded={expanded === i}
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{ transitionDuration: `${PRESS}ms`, transitionTimingFunction: EASE_OUT }}
              className="flex w-full items-center justify-between rounded-[10px] p-3.5 text-left text-sm text-[#171717] transition-transform active:scale-[0.985] active:duration-100 motion-reduce:active:scale-100 dark:text-[#f2f2f2]"
            >
              {item.label}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
                className={cn(
                  "transition-transform duration-300",
                  expanded === i && "rotate-180"
                )}
                style={{ transitionTimingFunction: EASE_IN_OUT }}
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-[380ms]"
              style={{
                gridTemplateRows: expanded === i ? "1fr" : "0fr",
                transitionTimingFunction: EASE_IN_OUT,
                transitionDuration: `${morphDuration}ms`,
              }}
            >
              <div className="overflow-hidden">
                <div className="px-3.5 pb-3.5 pt-0.5">
                  {item.menu.columns.flatMap((column) =>
                    column.items.map((entry) => {
                      const label =
                        "title" in entry ? entry.title : entry.label
                      return (
                        <Link
                          key={label}
                          href={entry.href ?? "#"}
                          className="block py-2.5 text-[13px] text-[#8f8f8f] hover:text-[#171717] dark:text-[#4d4d4d] dark:text-[#f2f2f2]/60 dark:hover:text-[#4d4d4d] dark:text-[#f2f2f2]"
                        >
                          {label}
                        </Link>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Link
            key={item.label}
            href={item.href ?? "#"}
            className="block rounded-[10px] p-3.5 text-sm text-[#171717] dark:text-[#f2f2f2]"
          >
            {item.label}
          </Link>
        )
      )}

      {cta ? (
        <Link
          href={cta.href ?? "#"}
          className="block rounded-[10px] p-3.5 text-sm text-[#171717] dark:text-[#f2f2f2]"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  )
}

export default ButterNav
