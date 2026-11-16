/* Lahap languages: 14 interface languages. The app is written in English; this swaps visible interface text,
   placeholders, labels and tooltips for the chosen language from the table in i18n-strings.js.
   Your own words (dish names, places, notes) are never touched. */
(function () {
  "use strict";

  const LANGS = [
    ["en", "English"],
    ["id", "Bahasa Indonesia"],
    ["ms", "Bahasa Melayu"],
    ["th", "ไทย"],
    ["vi", "Tiếng Việt"],
    ["zh-Hant", "繁體中文"],
    ["zh-Hans", "简体中文"],
    ["ja", "日本語"],
    ["ko", "한국어"],
    ["es", "Español"],
    ["pt-BR", "Português (Brasil)"],
    ["fr", "Français"],
    ["de", "Deutsch"],
    ["it", "Italiano"],
  ];
  const ATTRS = ["placeholder", "aria-label", "title", "alt"];
  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CANVAS", "SVG", "OPTION"]);
  // user content lives in these; never translate them
  const USER_CONTENT = ".meal-name, .name, .ticket-name, .dish, .place-name, .notes, .answer-text, .story-card, [data-no-i18n], #studio-name-ideas, .split-list, .leaflet-container";

  let current = "en";
  let getLang = () => "en";
  let table = null;
  let observer = null;
  let scheduled = false;
  const original = new WeakMap();
  // what the last pass wrote into each translated attribute, so a label the app changes later
  // ("Add to favourites" -> "Remove from favourites") is seen as new English, not overwritten
  const shownAttrs = new WeakMap();

  function dictionary() {
    if (!table) {
      table = {};
      const source = window.LahapI18nStrings || {};
      for (const code of Object.keys(source)) table[code] = new Map(Object.entries(source[code]));
    }
    return table[current] || null;
  }

  // Keys with {0}, {1}... are templates: "Eaten {0} times" matches "Eaten 5 times". Compiled once per language,
  // most literal text first, so the most specific template wins.
  function templatesFor(dict) {
    if (dict.templates) return dict.templates;
    const list = [];
    for (const [key, out] of dict) {
      if (!/\{\d\}/.test(key)) continue;
      const order = [];
      const source = key
        .replace(/[.*+?^$()|[\]\\]/g, "\\$&")
        .replace(/ /g, "[ \\u00a0]")
        // a slot right before "%" is a number; any other slot is free text
        .replace(/\{(\d)\}(%?)/g, (_, index, percent) => {
          order.push(Number(index));
          return (percent ? "(\\d[\\d.,]*)" : "(.+?)") + percent;
        });
      list.push({ regex: new RegExp("^" + source + "$"), order, out, weight: key.replace(/\{\d\}/g, "").length });
    }
    list.sort((a, b) => b.weight - a.weight);
    dict.templates = list;
    return list;
  }

  // one piece of text -> its translation, or null. Order: exact, counted ("3 meals"), " · " segments,
  // templates, then comma lists. Pieces with no key (names, money, dates) stay as written.
  function lookup(text, dict, depth) {
    const hit = dict.get(text) || (text.includes("\u00a0") ? dict.get(text.replace(/\u00a0/g, " ")) : null);
    if (hit) return hit;
    const counted = text.match(/^(\d+)\s+(.+)$/);
    if (counted) {
      const word = dict.get("# " + counted[2]);
      if (word) return word.replace("#", counted[1]);
    }
    if (depth > 3) return null;
    // a text node can start or end on the "·" joiner when the next piece is its own element ("· You both like")
    const edged = text.match(/^(·[ \u00a0])?(.*?)([ \u00a0]·)?$/);
    if (edged && (edged[1] || edged[3]) && edged[2]) {
      const inner = lookup(edged[2], dict, depth + 1);
      return inner ? (edged[1] || "") + inner + (edged[3] || "") : null;
    }
    const viaSegments = joined(text, /([ \u00a0]·[ \u00a0])/, dict, depth, false);
    if (viaSegments) return viaSegments;
    for (const template of templatesFor(dict)) {
      const match = template.regex.exec(text);
      if (!match) continue;
      const values = {};
      template.order.forEach((slot, position) => {
        values[slot] = lookup(match[position + 1], dict, depth + 1) || match[position + 1];
      });
      return template.out.replace(/\{(\d)\}/g, (whole, slot) => (slot in values ? values[slot] : whole));
    }
    return joined(text, /(, | \+ )/, dict, depth, true);
  }

  // split on a separator, translate each part, keep the separators. " · " joins interface pieces with names,
  // so one translated part is enough; a comma list must translate whole (bare numbers aside), or a
  // sentence with a comma would come out half translated
  function joined(text, separator, dict, depth, needAll) {
    const parts = text.split(separator);
    if (parts.length < 3) return null;
    let changed = false;
    let whole = true;
    const out = parts.map((part, index) => {
      if (index % 2) return part;
      const shown = lookup(part, dict, depth + 1);
      if (shown) changed = true;
      else if (!/^[\d.,%]+$/.test(part)) whole = false;
      return shown || part;
    });
    return changed && (whole || !needAll) ? out.join("") : null;
  }

  function translate(value, dict) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!dict.seen) dict.seen = new Map();
    if (dict.seen.size > 4000) dict.seen.clear();
    if (!dict.seen.has(trimmed)) dict.seen.set(trimmed, lookup(trimmed, dict, 0));
    const shown = dict.seen.get(trimmed);
    return shown ? value.replace(trimmed, () => shown) : null;
  }

  // user content is never translated, except an interface label inside it that opts back in with data-i18n
  function skipped(element) {
    if (!element || SKIP.has(element.tagName)) return true;
    return insideUserContent(element);
  }

  function insideUserContent(element) {
    const owner = element.closest && element.closest(USER_CONTENT + ", [data-i18n]");
    return Boolean(owner) && !owner.hasAttribute("data-i18n");
  }

  function walk(root, dict) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (skipped(node.parentElement)) continue;
      if (!original.has(node)) original.set(node, node.nodeValue);
      const english = original.get(node);
      const shown = dict ? translate(english, dict) : null;
      const next = shown || english;
      if (node.nodeValue !== next) node.nodeValue = next;
    }
    const elements = root.querySelectorAll ? root.querySelectorAll(ATTRS.map((attr) => `[${attr}]`).join(",")) : [];
    for (const element of elements) {
      // the tag list above guards text a person typed; a field's placeholder and a canvas's label are
      // interface text, so only the user-content rule applies to attributes
      if (insideUserContent(element)) continue;
      for (const attr of ATTRS) {
        if (!element.hasAttribute(attr)) continue;
        const key = "i18n" + attr.replace(/-(\w)/g, (_, letter) => letter.toUpperCase());
        const now = element.getAttribute(attr);
        let written = shownAttrs.get(element);
        if (!written) shownAttrs.set(element, (written = {}));
        if (!(key in element.dataset) || (attr in written && written[attr] !== now)) element.dataset[key] = now;
        const english = element.dataset[key];
        const shown = dict ? translate(english, dict) : null;
        const next = shown || english;
        if (now !== next) element.setAttribute(attr, next);
        written[attr] = next;
      }
    }
  }

  function apply(override) {
    current = override || getLang() || "en";
    document.documentElement.lang = current;
    const dict = current === "en" ? null : dictionary();
    if (current === "en" && !document.documentElement.dataset.i18nUsed) return;
    document.documentElement.dataset.i18nUsed = "1";
    if (observer) observer.disconnect();
    walk(document.body, dict);
    if (observer) observer.observe(document.body, { childList: true, subtree: true, characterData: false });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  function init(langGetter) {
    getLang = langGetter;
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    apply();
  }

  // preview a language without saving it; the saved setting wins on the next render
  function set(code) {
    apply(code);
  }

  // for code that builds text outside the DOM (toasts, canvas)
  function t(english) {
    const dict = current === "en" ? null : dictionary();
    return (dict && translate(english, dict)) || english;
  }

  // the same rule for any language without switching the page: used by the tests and the coverage probe
  function translateWith(code, english) {
    dictionary();
    const dict = table[code];
    return (dict && translate(english, dict)) || null;
  }

  window.LahapI18n = { LANGS, init, apply, set, t, translateWith };
})();
