/* BG-P30 — what the browser is asked, once per route per theme.
 *
 * EVERY FUNCTION HERE IS SERIALISED INTO THE PAGE, so each one is
 * self-contained: no imports, no closure over module scope, and every helper
 * declared inside the function that uses it. Anything it needs from Node —
 * the token name list — arrives as an argument.
 *
 * WHY MEASURE IN A BROWSER AT ALL, when `contrast.test.ts` already measures the
 * tokens. Because a token is not a pairing. `--text2` clears the floor on
 * `--bg` and on `--glass`; what it does on `--glass` over `--card-frame` over
 * `--bg`, at 40% opacity inside a fading card, is a different number, and it is
 * the number a reader actually gets. `better-colors` is explicit: measure the
 * RENDERED pair. jsdom has no cascade for `var()`, no compositing and no
 * layout, so this is the only place the question can be asked.
 *
 * THE GROUND IS COMPOSITED, NOT GUESSED. For each piece of text the sweep walks
 * the ancestor chain, multiplies every layer's alpha by that layer's own
 * opacity chain to the root, and composites the stack over the canvas. The same
 * chain gives the foreground its effective alpha, so text at `opacity: .6` is
 * measured at .6 rather than at 1.
 *
 * WHAT IT REFUSES TO GUESS. Where any layer under the text carries a
 * `background-image`, or an <img>/<video>/<canvas> is painted between the text
 * and its first opaque ground, the pair is reported as `image-beneath` with the
 * composite it WOULD have had. A gradient has no single ratio, and inventing
 * one is exactly the eye-repainting this prompt forbids.
 */

export interface TokenMap {
  [name: string]: string;
}

export interface Hit {
  kind: "text" | "border" | "focus";
  selector: string;
  sample: string;
  fg: string;
  bg: string;
  ratio: number;
  fontPx: number;
  fontWeight: number;
  floor: number;
  status: "pass" | "fail" | "image-beneath" | "hairline" | "exempt";
  note: string;
  count: number;
}

/**
 * The body of the sweep. Returns one row per DISTINCT pairing, with a count —
 * a page repeats `--text2` on `--glass` two hundred times and two hundred
 * identical rows in a CSV is not a report.
 */
export const collectContrast = (tokenNames: string[]) => {
  /* ── colour arithmetic (WCAG 2.x, implemented locally) ── */
  type Rgba = [number, number, number, number];

  const parse = (input: string): Rgba => {
    const c = (input || "").trim();
    if (!c || c === "transparent" || c === "none") return [0, 0, 0, 0];
    const m = /^rgba?\(([^)]+)\)$/.exec(c);
    if (m) {
      const parts = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
      return [parts[0], parts[1], parts[2], parts[3] === undefined ? 1 : parts[3]];
    }
    const hex = /^#([0-9a-f]{3,8})$/i.exec(c);
    if (hex) {
      let h = hex[1];
      if (h.length === 3) h = h.split("").map((x) => x + x).join("");
      const n = parseInt(h.slice(0, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
    }
    return [0, 0, 0, 0];
  };

  const over = (f: Rgba, b: Rgba): Rgba => {
    const a = f[3] + b[3] * (1 - f[3]);
    if (a === 0) return [0, 0, 0, 0];
    const ch = (i: number) => Math.round((f[i] * f[3] + b[i] * b[3] * (1 - f[3])) / a);
    return [ch(0), ch(1), ch(2), a];
  };

  const lum = (c: Rgba) => {
    const s = [c[0], c[1], c[2]].map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  };

  const ratio = (a: Rgba, b: Rgba) => {
    const la = lum(a);
    const lb = lum(b);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };

  const hex = (c: Rgba) =>
    "#" +
    [c[0], c[1], c[2]]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

  /* ── the tokens, as this theme has resolved them ── */
  const rootStyle = getComputedStyle(document.documentElement);
  const tokenValue: Record<string, string> = {};
  for (const name of tokenNames) {
    tokenValue[name] = rootStyle.getPropertyValue("--" + name).trim();
  }
  /* A border painted in one of these carries state; a border in --line or
     --glass-border is a hairline, which the spec floors nowhere. */
  const STATE_TOKENS = [
    "action",
    "evidence",
    "lit",
    "cat-breakage",
    "cat-instruction",
    "cat-configuration",
    "cat-data",
    "cat-artefact",
    "cat-evidence",
    "cat-narrative",
    "cat-agents",
    "cat-media",
  ];
  const stateColours = new Set(
    STATE_TOKENS.map((n) => hex(parse(tokenValue[n] || ""))).filter((h) => h !== "#000000"),
  );

  /* ── opacity and ground ── */
  const opacityFrom = (el: Element | null): number => {
    let o = 1;
    let n: Element | null = el;
    while (n && n.nodeType === 1) {
      const v = parseFloat(getComputedStyle(n).opacity);
      if (!isNaN(v)) o *= v;
      n = n.parentElement;
    }
    return o;
  };

  interface Ground {
    rgb: Rgba;
    imageBeneath: boolean;
    glass: boolean;
  }

  const groundOf = (start: Element | null, includeSelf: boolean): Ground => {
    const layers: Rgba[] = [];
    let imageBeneath = false;
    let glass = false;
    let n: Element | null = includeSelf ? start : start && start.parentElement;
    while (n && n.nodeType === 1) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== "none") imageBeneath = true;
      const bf = s.backdropFilter || (s as unknown as Record<string, string>).webkitBackdropFilter;
      if (bf && bf !== "none") glass = true;
      const c = parse(s.backgroundColor);
      if (c[3] > 0) {
        const eff: Rgba = [c[0], c[1], c[2], c[3] * opacityFrom(n)];
        layers.push(eff);
        if (eff[3] >= 0.995) break;
      }
      n = n.parentElement;
    }
    let base: Rgba = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return { rgb: base, imageBeneath, glass };
  };

  /** An <img>/<video>/<canvas> painted between this text and its ground. */
  const paintedMediaUnder = (el: Element, rect: DOMRect): boolean => {
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
    const stack = document.elementsFromPoint(x, y);
    const idx = stack.indexOf(el);
    const below = idx === -1 ? stack : stack.slice(idx + 1);
    for (const node of below) {
      const tag = node.tagName;
      if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "PICTURE") {
        if (!node.contains(el)) return true;
        return true;
      }
    }
    return false;
  };

  /* ── a short, stable name for the thing measured ── */
  const describe = (el: Element): string => {
    const bits: string[] = [];
    let n: Element | null = el;
    let depth = 0;
    while (n && n.nodeType === 1 && depth < 3) {
      let part = n.tagName.toLowerCase();
      const slot = n.getAttribute("data-visual-slot") || n.getAttribute("data-testid");
      if (slot) part += `[${slot}]`;
      else if (n.id) part += `#${n.id}`;
      else {
        const cls = (n.getAttribute("class") || "").split(/\s+/).filter(Boolean)[0];
        if (cls) part += `.${cls}`;
      }
      bits.unshift(part);
      n = n.parentElement;
      depth++;
    }
    return bits.join(">");
  };

  const visuallyHidden = (el: Element, s: CSSStyleDeclaration, rect: DOMRect) => {
    if (s.visibility !== "visible" || s.display === "none") return true;
    if (rect.width < 2 || rect.height < 2) return true;
    if (s.clipPath && s.clipPath.indexOf("inset(50%") === 0) return true;
    if (s.clip && s.clip !== "auto" && s.clip.indexOf("rect(0") === 0) return true;
    return false;
  };

  const hits: Record<string, Hit> = {};
  const push = (h: Hit) => {
    const key = [h.kind, h.selector, h.fg, h.bg, h.fontPx, h.fontWeight].join("|");
    if (hits[key]) hits[key].count += 1;
    else hits[key] = h;
  };

  /* ── 1. every piece of text on its actual ground ── */
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TITLE", "TEMPLATE"]);
  let textNode = walker.nextNode();
  while (textNode) {
    const raw = (textNode.nodeValue || "").replace(/\s+/g, " ").trim();
    const el = textNode.parentElement;
    if (raw && el && !SKIP.has(el.tagName)) {
      const s = getComputedStyle(el);
      const range = document.createRange();
      range.selectNodeContents(textNode);
      const rect = range.getBoundingClientRect();
      const chain = opacityFrom(el);
      if (!visuallyHidden(el, s, rect) && chain >= 0.06) {
        const ground = groundOf(el, true);
        const raw_fg = parse(s.color);
        const fg: Rgba = [raw_fg[0], raw_fg[1], raw_fg[2], raw_fg[3] * chain];
        const painted = over(fg, ground.rgb);
        const r = ratio(painted, ground.rgb);
        const media = ground.imageBeneath || paintedMediaUnder(el, rect);
        const fontPx = Math.round(parseFloat(s.fontSize) * 10) / 10;
        const weight = parseInt(s.fontWeight, 10) || 400;
        const large = fontPx >= 24 || (fontPx >= 18.66 && weight >= 700);
        /* A DISABLED CONTROL IS EXEMPT, and the exemption is WCAG's own:
           1.4.3 excludes "text or images of text that are part of an
           inactive user interface component" and 1.4.11 excludes an
           inactive component's boundary. It is not a loophole — the whole
           point of the 50% wash this kit puts on a disabled control is that
           it reads as unavailable BECAUSE it is harder to see. Reported so
           the numbers are on the record, never failed. */
        const inactive = !!el.closest(
          '[disabled],[aria-disabled="true"],[data-disabled],[data-state="unavailable"]',
        );
        const notes: string[] = [];
        if (large) notes.push("large-text");
        if (ground.glass) notes.push("glass");
        if (chain < 0.999) notes.push(`opacity ${Math.round(chain * 100) / 100}`);
        if (inactive) notes.push("disabled — WCAG 1.4.3 exempts an inactive component");
        push({
          kind: "text",
          selector: describe(el),
          sample: raw.slice(0, 60),
          fg: hex(painted),
          bg: hex(ground.rgb),
          ratio: r,
          fontPx,
          fontWeight: weight,
          floor: inactive ? 0 : 4.5,
          status: inactive
            ? "exempt"
            : media
              ? "image-beneath"
              : r < 4.5
                ? "fail"
                : "pass",
          note: notes.join(" "),
          count: 1,
        });
      }
    }
    textNode = walker.nextNode();
  }

  /* ── 2. every visible border, split into state-carrying and hairline ── */
  const SIDES = ["Top", "Right", "Bottom", "Left"] as const;
  const INTERACTIVE = "a,button,input,select,textarea,[role=button],[role=switch],[role=checkbox],[tabindex]";
  const all = document.body.querySelectorAll("*");
  for (const el of Array.from(all)) {
    const s = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (visuallyHidden(el, s, rect)) continue;
    const chain = opacityFrom(el);
    if (chain < 0.06) continue;
    const outside = groundOf(el, false);
    const inside = groundOf(el, true);
    /* Set by the border pass below: true when this element's own boundary
       clears the 3.0:1 floor, which is what the control-fill check reads. */
    let borderIdentifies = false;
    for (const side of SIDES) {
      const width = parseFloat(s[`border${side}Width` as keyof CSSStyleDeclaration] as string);
      const style = s[`border${side}Style` as keyof CSSStyleDeclaration] as string;
      if (!width || width <= 0 || style === "none" || style === "hidden") continue;
      const c = parse(s[`border${side}Color` as keyof CSSStyleDeclaration] as string);
      if (c[3] <= 0) continue;
      const painted = over([c[0], c[1], c[2], c[3] * chain], outside.rgb);
      const best = Math.max(ratio(painted, outside.rgb), ratio(painted, inside.rgb));
      /* A border is STATE-CARRYING when losing it would lose information: it
         is painted in a state token, it is the boundary of a control whose
         state that boundary encodes, or it is marking an error. A DASHED
         border qualifies only when it is ALSO in a state colour — the gap
         edge is `--cat-breakage` dashed, and a dashed `--line` divider or
         drop-zone is a hairline wearing a dash. */
      const isState =
        stateColours.has(hex(painted)) ||
        el.matches("[role=checkbox],[role=switch],[role=radio],input[type=checkbox],input[type=radio]") ||
        el.getAttribute("aria-invalid") === "true" ||
        el.getAttribute("role") === "alert" ||
        (el.matches(INTERACTIVE) && width >= 1.5);
      const inactive = !!el.closest('[disabled],[aria-disabled="true"],[data-disabled]');
      push({
        kind: "border",
        selector: describe(el) + ` border-${side.toLowerCase()}`,
        sample: `${style} ${Math.round(width * 100) / 100}px`,
        fg: hex(painted),
        bg: hex(outside.rgb),
        ratio: best,
        fontPx: 0,
        fontWeight: 0,
        floor: isState && !inactive ? 3 : 0,
        status: inactive ? "exempt" : isState ? (best < 3 ? "fail" : "pass") : "hairline",
        note: inactive
          ? "disabled — WCAG 1.4.11 exempts an inactive component"
          : isState
            ? "state-carrying"
            : "hairline",
        count: 1,
      });
      borderIdentifies = isState && !inactive && best >= 3;
      break; // one row per element: four identical sides is three rows of noise
    }

    /* A CONTROL'S OWN FILL against the ground it sits on. WCAG 1.4.11 floors
       this at 3.0:1 for anything whose shape identifies it as a component —
       an unchecked switch that cannot be told from the card under it is an
       invisible control, and its BORDER passing says nothing about that. */
    if (
      el.matches(
        "[role=checkbox],[role=switch],[role=radio],input[type=checkbox],input[type=radio],input[type=range],progress",
      )
    ) {
      const own = parse(s.backgroundColor);
      if (own[3] > 0) {
        const painted = over([own[0], own[1], own[2], own[3] * chain], outside.rgb);
        const r = ratio(painted, outside.rgb);
        /* A control that carries its own LABEL is identified by the label,
           and WCAG 1.4.11 does not floor a boundary that is not needed to
           find the component. A bare box — a checkbox, a switch, a radio dot
           — has nothing but its shape, so its fill is the whole affordance
           and 3.0:1 is the floor it has to clear. */
        const labelled = (el.textContent || "").trim().length > 0;
        const inactive = !!el.closest('[disabled],[aria-disabled="true"],[data-disabled]');
        /* WCAG 1.4.11 floors the visual information REQUIRED to identify the
           component, not every part of it. A control identified by its own
           label, or by a boundary that already clears 3.0:1, does not also
           need its fill to — and requiring both would mean no inset control
           could ever sit on a surface one step from it, which is what
           `--recess` is for. */
        const identified = labelled || borderIdentifies;
        push({
          kind: "border",
          selector: describe(el) + " fill",
          sample: `${el.getAttribute("role") || el.tagName.toLowerCase()} ${el.getAttribute("data-state") || ""}`.trim(),
          fg: hex(painted),
          bg: hex(outside.rgb),
          ratio: r,
          fontPx: 0,
          fontWeight: 0,
          floor: identified || inactive ? 0 : 3,
          status: inactive ? "exempt" : identified ? "hairline" : r < 3 ? "fail" : "pass",
          note: inactive
            ? "disabled — WCAG 1.4.11 exempts an inactive component"
            : labelled
              ? "control-fill (identified by its label)"
              : borderIdentifies
                ? "control-fill (identified by its boundary)"
                : "control-fill",
          count: 1,
        });
      }
    }
  }

  return Object.keys(hits).map((k) => hits[k]);
};

/**
 * The focus ring, on every ground a control actually sits on. Focus is a state,
 * floored at 3.0:1, and the ring is read against the band the offset leaves —
 * which is the ground OUTSIDE the control, not the control's own fill.
 */
export const collectFocus = async (limit: number) => {
  type Rgba = [number, number, number, number];
  const parse = (input: string): Rgba => {
    const c = (input || "").trim();
    if (!c || c === "transparent" || c === "none") return [0, 0, 0, 0];
    const m = /^rgba?\(([^)]+)\)$/.exec(c);
    if (!m) return [0, 0, 0, 0];
    const p = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
  };
  const over = (f: Rgba, b: Rgba): Rgba => {
    const a = f[3] + b[3] * (1 - f[3]);
    if (a === 0) return [0, 0, 0, 0];
    const ch = (i: number) => Math.round((f[i] * f[3] + b[i] * b[3] * (1 - f[3])) / a);
    return [ch(0), ch(1), ch(2), a];
  };
  const lum = (c: Rgba) => {
    const s = [c[0], c[1], c[2]].map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  };
  const ratio = (a: Rgba, b: Rgba) => {
    const hi = Math.max(lum(a), lum(b));
    const lo = Math.min(lum(a), lum(b));
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  const hex = (c: Rgba) =>
    "#" + [c[0], c[1], c[2]].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();

  const groundOutside = (el: Element): Rgba => {
    const layers: Rgba[] = [];
    let n: Element | null = el.parentElement;
    while (n && n.nodeType === 1) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) {
        layers.push(c);
        if (c[3] >= 0.995) break;
      }
      n = n.parentElement;
    }
    let base: Rgba = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };

  const describe = (el: Element) => {
    const slot = el.getAttribute("data-visual-slot") || el.getAttribute("data-testid");
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean)[0];
    return el.tagName.toLowerCase() + (slot ? `[${slot}]` : cls ? `.${cls}` : "");
  };

  const controls = Array.from(
    document.querySelectorAll<HTMLElement>(
      "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])",
    ),
  ).slice(0, limit);

  const settle = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

  const rows: Array<{
    selector: string;
    ringColour: string;
    ground: string;
    ratio: number;
    width: number;
    offset: number;
    ok: boolean;
    kind: "system" | "ua-default" | "none";
  }> = [];
  const seen = new Set<string>();

  for (const el of controls) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    try {
      el.focus();
    } catch {
      continue;
    }
    if (document.activeElement !== el) continue;
    /* THE RING IS REACT STATE ON MOST CONTROLS. `controls.ts`'s `ring()`
       spreads the outline only when `useInteractive` has recorded a
       keyboard focus, so the inline style does not exist until React has
       re-rendered. Reading the computed style in the same task as the
       `focus()` call measures the control BEFORE its ring is applied, which
       is a whole sweep of phantom findings. Two frames is one React commit
       plus one paint. */
    await settle();
    let s = getComputedStyle(el);
    let ringOn: Element = el;
    /* THE RING IS NOT ALWAYS ON THE FOCUSED ELEMENT. The Explore rail draws it
       on the wrapper around the field and its icon, so the ring encircles the
       two as one object — which is the right call and would read as "no focus
       indicator" to a probe that only ever looked at the input. So: if the
       focused element has no outline, look up to three ancestors for one that
       does. A ring drawn on a wrapper is still the ring. */
    if (!(parseFloat(s.outlineWidth) > 0)) {
      let up: Element | null = el.parentElement;
      for (let i = 0; i < 3 && up; i++) {
        const ancestor = getComputedStyle(up);
        if (parseFloat(ancestor.outlineWidth) > 0 && ancestor.outlineStyle !== "none") {
          s = ancestor;
          ringOn = up;
          break;
        }
        up = up.parentElement;
      }
    }
    let width = parseFloat(s.outlineWidth) || 0;
    const offset = parseFloat(s.outlineOffset) || 0;
    let colour = parse(s.outlineColor);
    /* Some controls draw the ring as a box-shadow instead of an outline. That
       is not the system's definition — `focus.ts` is explicit about why the
       ring is an outline — but a shadow ring is still a ring a reader sees, so
       it is measured rather than reported as "no ring". */
    if ((width === 0 || s.outlineStyle === "none") && s.boxShadow && s.boxShadow !== "none") {
      const shadow = /(rgba?\([^)]+\))[^,]*?(\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px/.exec(s.boxShadow);
      if (shadow) {
        colour = parse(shadow[1]);
        width = 2;
      }
    }
    const ground = groundOutside(ringOn);
    const painted = over(colour, ground);
    const r = width > 0 ? ratio(painted, ground) : 0;
    /* `outline-style: auto` is CHROMIUM'S OWN RING, and it is not one colour:
       the engine paints a light-on-dark double ring chosen against whatever is
       behind it, so a single ratio against `outlineColor` (which reports a
       placeholder) describes nothing. It is reported as what it is — a control
       the system's own ring never reached — rather than as a contrast failure
       it is not. `focus.ts` says one ring, used everywhere; these are where
       that is not yet true. */
    const kind: "system" | "ua-default" | "none" =
      s.outlineStyle === "auto" ? "ua-default" : width > 0 ? "system" : "none";
    const key = [describe(el), hex(painted), hex(ground), kind].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      selector: describe(el) + (ringOn === el ? "" : ` (ring on ${describe(ringOn)})`),
      ringColour: kind === "ua-default" ? "ua-auto" : hex(painted),
      ground: hex(ground),
      ratio: kind === "ua-default" ? 0 : r,
      width,
      offset,
      ok: kind === "ua-default" ? true : width > 0 && r >= 3,
      kind,
    });
  }
  try {
    (document.activeElement as HTMLElement | null)?.blur();
  } catch {
    /* nothing focused, nothing to clear */
  }
  return rows;
};

/**
 * Every colour this page actually paints, as a set. The both-theme completeness
 * check reads it: a value that belongs to the OTHER room's token block and to
 * no token in this one is a colour that stopped following the theme.
 */
export const collectColours = () => {
  const props = [
    "color",
    "backgroundColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "outlineColor",
    "textDecorationColor",
    "caretColor",
    "fill",
    "stroke",
  ] as const;

  const out: Record<string, { prop: string; selector: string; sample: string }> = {};
  const describe = (el: Element) => {
    const slot = el.getAttribute("data-visual-slot") || el.getAttribute("data-testid");
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean)[0];
    return el.tagName.toLowerCase() + (slot ? `[${slot}]` : cls ? `.${cls}` : "");
  };

  const els = Array.from(document.body.querySelectorAll("*"));
  for (const el of els) {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility !== "visible") continue;
    for (const prop of props) {
      const value = (s[prop] as string) || "";
      if (!value || value === "none" || value === "rgba(0, 0, 0, 0)") continue;
      // Ignore a property that is merely inheriting the element's own colour.
      if (prop !== "color" && value === s.color && prop !== "borderTopColor") continue;
      const key = prop + "|" + value;
      if (!out[key]) {
        out[key] = {
          prop,
          selector: describe(el),
          sample: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
        };
      }
    }
  }
  return Object.keys(out).map((k) => ({
    value: k.slice(k.indexOf("|") + 1),
    prop: out[k].prop,
    selector: out[k].selector,
    sample: out[k].sample,
  }));
};

/**
 * BG-P31 — the glass census. Counts blurred surfaces, the blur values in play,
 * the deepest nesting, and any blurred element that is a full-height fixed
 * panel. §Glass allows one blur value, about twenty surfaces, and no nesting.
 */
export const collectGlass = () => {
  const blurred: Array<{
    selector: string;
    filter: string;
    blur: string;
    depth: number;
    fixedFullHeight: boolean;
    rect: { w: number; h: number };
    ancestors: string[];
  }> = [];

  const describe = (el: Element) => {
    const slot = el.getAttribute("data-visual-slot") || el.getAttribute("data-testid");
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean)[0];
    return el.tagName.toLowerCase() + (slot ? `[${slot}]` : cls ? `.${cls}` : "");
  };

  const isBlurred = (el: Element) => {
    const s = getComputedStyle(el);
    const bf = s.backdropFilter || (s as unknown as Record<string, string>).webkitBackdropFilter;
    return bf && bf !== "none" ? bf : "";
  };

  const els = Array.from(document.querySelectorAll("*"));
  for (const el of els) {
    const bf = isBlurred(el);
    if (!bf) continue;
    const s = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const chain: string[] = [];
    let n: Element | null = el.parentElement;
    while (n && n.nodeType === 1) {
      if (isBlurred(n)) chain.push(describe(n));
      n = n.parentElement;
    }
    const blurMatch = /blur\(([^)]+)\)/.exec(bf);
    blurred.push({
      selector: describe(el),
      filter: bf,
      blur: blurMatch ? blurMatch[1].trim() : "none",
      depth: chain.length,
      fixedFullHeight:
        s.position === "fixed" && rect.height >= window.innerHeight * 0.9 && rect.height > 0,
      rect: { w: Math.round(rect.width), h: Math.round(rect.height) },
      ancestors: chain,
    });
  }

  return {
    count: blurred.length,
    maxDepth: blurred.reduce((m, b) => Math.max(m, b.depth), 0),
    blurValues: Array.from(new Set(blurred.map((b) => b.blur))).sort(),
    nested: blurred.filter((b) => b.depth > 0),
    fixedFullHeight: blurred.filter((b) => b.fixedFullHeight),
    surfaces: blurred,
  };
};
