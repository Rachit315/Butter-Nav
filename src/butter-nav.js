/* ==========================================================================
   ButterNav — a self-contained, data-driven navbar component.

   Usage:
     const nav = new ButterNav(document.querySelector('#nav'), NAV_DATA);
     nav.destroy();

   Everything is rendered from the config object, so the markup never has to
   be hand-maintained. All copy in the default config is dummy content.
   ========================================================================== */

(function (global) {
  "use strict";

  var PILL_BASE = 100; /* keep in sync with --bn-pill-base */

  var SVG_CHEVRON =
    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
    '<path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.4" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /** Small DOM helper. */
  function el(tag, className, props) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (props) {
      for (var key in props) {
        if (key === "html") node.innerHTML = props[key];
        else if (key === "text") node.textContent = props[key];
        else node.setAttribute(key, props[key]);
      }
    }
    return node;
  }

  function ButterNav(root, config) {
    if (!root) throw new Error("ButterNav: root element is required");
    this.root = root;
    this.config = config || ButterNav.defaultConfig;

    this.items = []; // { def, button, panel, size }
    this.activeIndex = -1;
    this.isOpen = false;
    this.openTimer = null;
    this.closeTimer = null;
    this.reduceMotion =
      global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this._render();
    this._bind();
    this._measure();
  }

  /* ----------------------------------------------------------- rendering */

  ButterNav.prototype._render = function () {
    var cfg = this.config;
    var self = this;

    this.root.classList.add("bn");
    this.root.innerHTML = "";

    var inner = el("div", "bn__inner");
    var bar = el("div", "bn__bar");

    // brand
    bar.appendChild(
      el("a", "bn__brand", { href: cfg.brandHref || "#", text: cfg.brand })
    );

    // desktop nav
    var nav = el("nav", "bn__nav", { "aria-label": "Main" });
    this.pill = el("span", "bn__pill");
    nav.appendChild(this.pill);

    cfg.items.forEach(function (def, i) {
      var node;
      if (def.menu) {
        node = el("button", "bn__link", {
          type: "button",
          "aria-expanded": "false",
          "aria-haspopup": "true",
          id: "bn-trigger-" + i,
          "aria-controls": "bn-panel-" + i,
        });
      } else {
        node = el("a", "bn__link", { href: def.href || "#" });
      }
      node.textContent = def.label;
      node.dataset.index = String(i);
      nav.appendChild(node);
      self.items.push({ def: def, button: node, panel: null, size: null });
    });

    bar.appendChild(nav);

    // right cluster: divider + secondary links + CTA
    var right = el("div", "bn__right");
    right.appendChild(el("span", "bn__divider", { "aria-hidden": "true" }));
    (cfg.secondary || []).forEach(function (link) {
      right.appendChild(
        el("a", "bn__link", { href: link.href || "#", text: link.label })
      );
    });
    if (cfg.cta) {
      right.appendChild(
        el("a", "bn__cta", { href: cfg.cta.href || "#", text: cfg.cta.label })
      );
    }
    bar.appendChild(right);

    // mobile trigger
    this.burger = el("button", "bn__burger", {
      type: "button",
      "aria-label": "Open menu",
      "aria-expanded": "false",
      html: "<i></i><i></i><i></i>",
    });
    bar.appendChild(this.burger);

    inner.appendChild(bar);

    // popover
    this.pop = el("div", "bn__pop");
    this.card = el("div", "bn__card");
    this.items.forEach(function (item, i) {
      if (!item.def.menu) return;
      var panel = el("div", "bn__panel", {
        id: "bn-panel-" + i,
        role: "region",
        "aria-labelledby": "bn-trigger-" + i,
      });
      panel.appendChild(self._renderMenu(item.def.menu));
      item.panel = panel;
      self.card.appendChild(panel);
    });
    this.pop.appendChild(this.card);
    inner.appendChild(this.pop);

    // mobile sheet
    inner.appendChild(this._renderSheet());

    this.root.appendChild(inner);
  };

  ButterNav.prototype._renderMenu = function (menu) {
    var wrap = document.createDocumentFragment();
    var grid = el("div", "bn__grid");

    (menu.columns || []).forEach(function (col) {
      var column = el(
        "div",
        "bn__col" + (col.type === "links" ? " bn__col--links" : "")
      );
      (col.items || []).forEach(function (entry) {
        if (col.type === "links") {
          column.appendChild(
            el("a", "bn__plain", { href: entry.href || "#", text: entry.label })
          );
        } else {
          var link = el("a", "bn__card-link", { href: entry.href || "#" });
          link.appendChild(el("span", "bn__card-title", { text: entry.title }));
          if (entry.desc) {
            link.appendChild(el("span", "bn__card-desc", { text: entry.desc }));
          }
          column.appendChild(link);
        }
      });
      grid.appendChild(column);
    });

    wrap.appendChild(grid);

    if (menu.footer) {
      var foot = el("div", "bn__foot");
      var left = el("div");
      if (menu.footer.badge) {
        left.appendChild(el("span", "bn__badge", { text: menu.footer.badge }));
      }
      left.appendChild(el("span", "bn__foot-text", { text: menu.footer.text }));
      foot.appendChild(left);
      if (menu.footer.cta) {
        var cta = el("a", "bn__foot-cta", {
          href: menu.footer.cta.href || "#",
        });
        cta.appendChild(document.createTextNode(menu.footer.cta.label));
        cta.appendChild(el("span", null, { text: "→" }));
        foot.appendChild(cta);
      }
      wrap.appendChild(foot);
    }

    return wrap;
  };

  ButterNav.prototype._renderSheet = function () {
    var self = this;
    var sheet = el("div", "bn__sheet");

    this.config.items.forEach(function (def) {
      if (!def.menu) {
        sheet.appendChild(
          el("a", "bn__acc-btn", { href: def.href || "#", text: def.label })
        );
        return;
      }
      var acc = el("div", "bn__acc");
      var btn = el("button", "bn__acc-btn", {
        type: "button",
        "aria-expanded": "false",
      });
      btn.appendChild(document.createTextNode(def.label));
      btn.insertAdjacentHTML("beforeend", SVG_CHEVRON);

      var body = el("div", "bn__acc-body");
      var inner = el("div", "bn__acc-inner");
      (def.menu.columns || []).forEach(function (col) {
        (col.items || []).forEach(function (entry) {
          inner.appendChild(
            el("a", null, {
              href: entry.href || "#",
              text: entry.title || entry.label,
            })
          );
        });
      });
      body.appendChild(inner);

      btn.addEventListener("click", function () {
        var open = acc.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", String(open));
        body.style.height = open ? inner.offsetHeight + "px" : "0px";
      });

      acc.appendChild(btn);
      acc.appendChild(body);
      sheet.appendChild(acc);
    });

    if (this.config.cta) {
      var cta = el("a", "bn__acc-btn", {
        href: this.config.cta.href || "#",
        text: this.config.cta.label,
      });
      sheet.appendChild(cta);
    }

    self.sheet = sheet;
    return sheet;
  };

  /* ---------------------------------------------------------- measuring */

  ButterNav.prototype._measure = function () {
    // Panels stay laid out (opacity 0) so their natural size is readable
    // at any time — no reflow thrash while the menu is animating.
    this.items.forEach(function (item) {
      if (!item.panel) return;
      item.size = {
        w: Math.ceil(item.panel.offsetWidth),
        h: Math.ceil(item.panel.offsetHeight),
      };
    });
  };

  /* ------------------------------------------------------------ binding */

  ButterNav.prototype._bind = function () {
    var self = this;
    this._handlers = [];

    function on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      self._handlers.push([target, type, fn, opts]);
    }

    this.items.forEach(function (item, i) {
      on(item.button, "pointerenter", function (e) {
        if (e.pointerType === "touch") return;
        self._hoverPill(i);
        if (item.def.menu) self._scheduleOpen(i);
        else self._scheduleClose();
      });

      on(item.button, "focus", function () {
        self._hoverPill(i);
        if (item.def.menu && self.isOpen) self.open(i);
      });

      if (item.def.menu) {
        on(item.button, "click", function (e) {
          e.preventDefault();
          if (self.isOpen && self.activeIndex === i) self.close();
          else self.open(i);
        });
        on(item.button, "keydown", function (e) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            self.open(i);
            var first = item.panel.querySelector("a");
            if (first) first.focus();
          }
        });
      }
    });

    on(this.root.querySelector(".bn__bar"), "pointerleave", function () {
      self._cancelOpen();
      self._resetPill();
      self._scheduleClose();
    });

    on(this.card, "pointerenter", function () {
      self._cancelClose();
    });
    on(this.card, "pointerleave", function () {
      self._resetPill();
      self._scheduleClose();
    });

    on(document, "keydown", function (e) {
      if (e.key !== "Escape") return;
      if (self.isOpen) {
        var active = self.items[self.activeIndex];
        self.close();
        if (active) active.button.focus();
      }
      if (self.root.classList.contains("is-sheet")) self._toggleSheet(false);
    });

    on(document, "pointerdown", function (e) {
      if (!self.root.contains(e.target)) {
        self.close();
        self._toggleSheet(false);
      }
    });

    // Tabbing out of the menu closes it.
    on(this.root, "focusout", function (e) {
      if (!self.isOpen) return;
      if (!e.relatedTarget || !self.root.contains(e.relatedTarget)) {
        self.close();
      }
    });

    on(this.burger, "click", function () {
      self._toggleSheet(!self.root.classList.contains("is-sheet"));
    });

    var resizeTimer;
    on(global, "resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        self._measure();
        if (self.isOpen) self._position(self.activeIndex, true);
      }, 120);
    });

    on(global, "scroll", function () {
      if (self.isOpen) self.close();
    }, { passive: true });
  };

  /* ------------------------------------------------------------- opening */

  ButterNav.prototype._scheduleOpen = function (index) {
    var self = this;
    this._cancelClose();
    if (this.isOpen) {
      // Already open: swap instantly so the card morphs between menus.
      this.open(index);
      return;
    }
    this._cancelOpen();
    this.openTimer = setTimeout(function () {
      self.open(index);
    }, 90); // small intent delay, like Linear
  };

  ButterNav.prototype._cancelOpen = function () {
    clearTimeout(this.openTimer);
    this.openTimer = null;
  };

  ButterNav.prototype._scheduleClose = function () {
    var self = this;
    this._cancelClose();
    this.closeTimer = setTimeout(function () {
      self.close();
    }, 170);
  };

  ButterNav.prototype._cancelClose = function () {
    clearTimeout(this.closeTimer);
    this.closeTimer = null;
  };

  ButterNav.prototype.open = function (index) {
    var item = this.items[index];
    if (!item || !item.panel) return;
    this._cancelOpen();
    this._cancelClose();

    var wasOpen = this.isOpen;
    var previous = this.activeIndex;
    if (wasOpen && previous === index) return;

    if (!item.size) this._measure();

    // Direction of travel drives the content cross-fade.
    var dir = previous === -1 || index > previous ? 1 : -1;

    if (previous > -1 && this.items[previous].panel) {
      var out = this.items[previous].panel;
      out.style.setProperty("--bn-shift", -dir * 14 + "px");
      out.classList.remove("is-active");
    }

    var panel = item.panel;
    panel.style.setProperty("--bn-shift", dir * 14 + "px");
    if (!wasOpen) panel.style.setProperty("--bn-shift", "0px");
    void panel.offsetWidth; // commit the start position
    panel.classList.add("is-active");

    this.activeIndex = index;
    this._position(index, !wasOpen);

    this.isOpen = true;
    this.root.classList.add("is-open");
    this.card.setAttribute("aria-hidden", "false");

    this.items.forEach(function (it, i) {
      if (it.def.menu) {
        it.button.setAttribute("aria-expanded", i === index ? "true" : "false");
      }
    });

    this._movePill(index, !wasOpen);
  };

  /** Size + slide the card so it is centred under the trigger. */
  ButterNav.prototype._position = function (index, instant) {
    var item = this.items[index];
    var size = item.size;
    if (!size) return;

    var innerRect = this.root
      .querySelector(".bn__inner")
      .getBoundingClientRect();
    var itemRect = item.button.getBoundingClientRect();

    var x = itemRect.left + itemRect.width / 2 - innerRect.left - size.w / 2;
    var margin = 16;
    var minX = margin - innerRect.left;
    var maxX = global.innerWidth - margin - size.w - innerRect.left;
    if (maxX < minX) maxX = minX;
    x = Math.max(minX, Math.min(x, maxX));

    var card = this.card;
    this._x = x;

    // The panel scales out of the trigger that opened it, not its own centre.
    var origin = itemRect.left + itemRect.width / 2 - innerRect.left - x;
    card.style.setProperty("--bn-origin", Math.round(origin) + "px");

    var apply = function () {
      card.style.width = size.w + "px";
      card.style.height = size.h + "px";
      card.style.transform = "translate3d(" + x + "px, 0, 0) scale(1)";
    };

    if (instant && !this.isOpen) {
      // First open: jump to the right place, then let opacity/scale animate in.
      card.style.transition = "none";
      card.style.width = size.w + "px";
      card.style.height = size.h + "px";
      card.style.transform = "translate3d(" + x + "px, -4px, 0) scale(0.97)";
      void card.offsetWidth;
      card.style.transition = "";
      apply();
    } else {
      apply();
    }
  };

  ButterNav.prototype.close = function () {
    this._cancelOpen();
    this._cancelClose();
    if (!this.isOpen) return;

    this.isOpen = false;
    this.root.classList.remove("is-open");
    this.card.setAttribute("aria-hidden", "true");
    this.card.style.transform =
      "translate3d(" + (this._x || 0) + "px, -4px, 0) scale(0.97)";

    var active = this.items[this.activeIndex];
    if (active && active.panel) {
      active.panel.style.setProperty("--bn-shift", "0px");
    }
    this.items.forEach(function (it) {
      if (it.def.menu) it.button.setAttribute("aria-expanded", "false");
    });

    this.activeIndex = -1;
    this._resetPill();
  };

  /* ------------------------------------------------------------ the pill */

  ButterNav.prototype._hoverPill = function (index) {
    this._movePill(index, this.pill.style.opacity !== "1");
  };

  ButterNav.prototype._movePill = function (index, instant) {
    var item = this.items[index];
    if (!item) return;
    var navRect = this.root.querySelector(".bn__nav").getBoundingClientRect();
    var rect = item.button.getBoundingClientRect();
    var padX = 12;
    var x = rect.left - navRect.left - padX;
    var w = rect.width + padX * 2;

    // scaleX off a fixed base keeps this on the compositor — animating
    // `width` would run layout on every frame of a hover effect.
    var transform =
      "translate3d(" + x + "px, -50%, 0) scaleX(" + w / PILL_BASE + ")";

    if (instant) {
      this.pill.style.transition = "none";
      this.pill.style.transform = transform;
      void this.pill.offsetWidth;
      this.pill.style.transition = "";
    } else {
      this.pill.style.transform = transform;
    }
    this.pill.style.opacity = "1";
  };

  ButterNav.prototype._resetPill = function () {
    if (this.isOpen && this.activeIndex > -1) {
      this._movePill(this.activeIndex, false);
      return;
    }
    this.pill.style.opacity = "0";
  };

  /* ------------------------------------------------------------- mobile */

  ButterNav.prototype._toggleSheet = function (open) {
    this.root.classList.toggle("is-sheet", open);
    this.burger.setAttribute("aria-expanded", String(open));
    this.burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (!open) {
      this.sheet.querySelectorAll(".bn__acc.is-open").forEach(function (acc) {
        acc.classList.remove("is-open");
        acc.querySelector(".bn__acc-btn").setAttribute("aria-expanded", "false");
        acc.querySelector(".bn__acc-body").style.height = "0px";
      });
    }
  };

  /* ------------------------------------------------------------ teardown */

  ButterNav.prototype.destroy = function () {
    this._cancelOpen();
    this._cancelClose();
    (this._handlers || []).forEach(function (h) {
      h[0].removeEventListener(h[1], h[2], h[3]);
    });
    this._handlers = [];
    this.root.innerHTML = "";
    this.root.classList.remove("bn", "is-open", "is-sheet");
  };

  /* ------------------------------------------------- dummy default config */

  ButterNav.defaultConfig = {
    brand: "Pro.nav",
    brandHref: "#",
    cta: { label: "Sign up", href: "#" },
    secondary: [],
    items: [
      {
        label: "Product",
        menu: {
          columns: [
            {
              type: "cards",
              items: [
                {
                  title: "Intake",
                  desc: "Bring requests and context in from every tool you use",
                },
                {
                  title: "Plan and monitor",
                  desc: "Set the plan and follow it from idea to launch",
                },
              ],
            },
            {
              type: "cards",
              items: [
                {
                  title: "AI and automations",
                  desc: "Agents that follow work from conversation to code",
                },
                {
                  title: "Build, review and ship",
                  desc: "Write code and review pull requests in one place",
                },
              ],
            },
            {
              type: "links",
              items: [
                { label: "Integration directory" },
                { label: "Changelog" },
                { label: "Mobile" },
                { label: "Security" },
              ],
            },
          ],
          footer: {
            badge: "New",
            text: "Priority inbox",
            cta: { label: "Learn more" },
          },
        },
      },
      {
        label: "Resources",
        menu: {
          columns: [
            {
              type: "cards",
              items: [
                {
                  title: "About",
                  desc: "Meet the team and the story behind the product",
                },
                {
                  title: "Careers",
                  desc: "Come work with us on the tools our teams use daily",
                },
              ],
            },
            {
              type: "cards",
              items: [
                {
                  title: "Docs",
                  desc: "Learn how to use every part of the platform",
                },
                {
                  title: "Developers",
                  desc: "Build on the API and developer platform",
                },
              ],
            },
            {
              type: "links",
              items: [
                { label: "Switch to Pro.nav" },
                { label: "For enterprise" },
                { label: "For startups" },
                { label: "Download" },
              ],
            },
          ],
        },
      },
      {
        label: "Customers",
        menu: {
          columns: [
            {
              type: "cards",
              items: [
                {
                  title: "Case studies",
                  desc: "How fast-moving teams ship with Pro.nav",
                },
                {
                  title: "Customer stories",
                  desc: "Interviews with the people behind the work",
                },
              ],
            },
            {
              type: "links",
              items: [
                { label: "Startups" },
                { label: "Agencies" },
                { label: "Enterprise" },
              ],
            },
          ],
          footer: {
            badge: "Featured",
            text: "Northwind ships 3x faster",
            cta: { label: "Read the story" },
          },
        },
      },
      { label: "Pricing", href: "#pricing" },
      { label: "Contact", href: "#contact" },
    ],
  };

  global.ButterNav = ButterNav;
})(window);
