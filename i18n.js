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
  const ATTRS = ["placeholder", "aria-label", "title"];
  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CANVAS", "SVG", "OPTION"]);
  // user content lives in these; never translate them
  const USER_CONTENT = ".meal-name, .name, .ticket-name, .dish, .place-name, .notes, .answer-text, .story-card, [data-no-i18n], #studio-name-ideas, .split-list, .leaflet-container";

  let current = "en";
  let getLang = () => "en";
  let table = null;
  let observer = null;
  let scheduled = false;
  const original = new WeakMap();

  function dictionary() {
    if (!table) {
      table = {};
      const source = window.LahapI18nStrings || {};
      for (const code of Object.keys(source)) table[code] = new Map(Object.entries(source[code]));
    }
    return table[current] || null;
  }

  function translate(value, dict) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const hit = dict.get(trimmed);
    if (hit) return value.replace(trimmed, hit);
    // simple counted phrases: "3 meals", "12 visits"
    const counted = trimmed.match(/^(\d+)\s+(.+)$/);
    if (counted) {
      const word = dict.get("# " + counted[2]);
      if (word) return value.replace(trimmed, word.replace("#", counted[1]));
    }
    return null;
  }

  function skipped(element) {
    return !element || SKIP.has(element.tagName) || (element.closest && element.closest(USER_CONTENT));
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
      if (element.closest(USER_CONTENT)) continue;
      for (const attr of ATTRS) {
        if (!element.hasAttribute(attr)) continue;
        const key = "i18n" + attr.replace(/-(\w)/g, (_, letter) => letter.toUpperCase());
        if (!(key in element.dataset)) element.dataset[key] = element.getAttribute(attr);
        const english = element.dataset[key];
        const shown = dict ? translate(english, dict) : null;
        const next = shown || english;
        if (element.getAttribute(attr) !== next) element.setAttribute(attr, next);
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

  window.LahapI18n = { LANGS, init, apply, set, t };
})();
