/* Lahap studio logic (no DOM): collections, bill reading, stories, questions, name suggestions,
   dish splitting, looks. Loaded after logic.js and memory.js, by the app and by the tests. */
(function (root) {
  "use strict";

  const L = root.LahapLogic;
  const DAY = 86400000;

  function norm(value) {
    return L && L.normalize ? L.normalize(value) : String(value || "").trim().toLowerCase();
  }

  function byNewest(a, b) {
    return String(b.ts).localeCompare(String(a.ts));
  }

  function real(entries) {
    return (entries || []).filter((entry) => entry && entry.name);
  }

  /* ---------------- collections ---------------- */

  // Smart collections fill themselves from the diary. Each rule is a plain predicate over one meal.
  const SMART = [
    { id: "smart-fav", name: "Favourites", why: "Meals you hearted", test: (entry) => !!entry.fav },
    { id: "smart-top", name: "Five stars", why: "Rated 5 out of 5", test: (entry) => Number(entry.rating) >= 5 },
    { id: "smart-buds", name: "With buds", why: "Meals you shared with someone", test: (entry) => (entry.friends || []).length > 0 },
    { id: "smart-home", name: "Cooked at home", why: "Home cooking", test: (entry) => entry.source === "home" },
    { id: "smart-delivery", name: "Delivered", why: "Ordered in", test: (entry) => entry.source === "delivery" },
    { id: "smart-month", name: "This month", why: "Since the 1st", test: (entry, ctx) => new Date(entry.ts) >= ctx.monthStart },
    { id: "smart-treats", name: "Treats", why: "Your priciest quarter of meals", test: (entry, ctx) => ctx.treatLine > 0 && Number(entry.price) >= ctx.treatLine },
    { id: "smart-new", name: "First tries", why: "The first time you ate a dish", test: (entry, ctx) => ctx.firsts.has(entry.id) },
  ];

  function smartContext(entries, now) {
    const today = now ? new Date(now) : new Date();
    const prices = entries.map((entry) => Number(entry.price) || 0).filter((price) => price > 0).sort((a, b) => a - b);
    const treatLine = prices.length >= 4 ? prices[Math.floor(prices.length * 0.75)] : 0;
    const firsts = new Set();
    const seen = new Set();
    for (const entry of entries.slice().sort((a, b) => String(a.ts).localeCompare(String(b.ts)))) {
      const key = norm(entry.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      firsts.add(entry.id);
    }
    return { monthStart: new Date(today.getFullYear(), today.getMonth(), 1), treatLine, firsts };
  }

  function smartCollections(entries, now) {
    const list = real(entries);
    const ctx = smartContext(list, now);
    return SMART.map((rule) => ({
      id: rule.id,
      name: rule.name,
      why: rule.why,
      smart: true,
      entries: list.filter((entry) => rule.test(entry, ctx)).sort(byNewest),
    }));
  }

  // Custom collections live in settings as [{ id, name, ids: [] }]; missing meals are skipped.
  function customCollections(collections, entries) {
    const byId = new Map(real(entries).map((entry) => [entry.id, entry]));
    return (collections || []).map((collection) => ({
      id: collection.id,
      name: collection.name,
      smart: false,
      entries: (collection.ids || []).map((id) => byId.get(id)).filter(Boolean).sort(byNewest),
    }));
  }

  function toggleInCollection(collections, collectionId, entryId) {
    return (collections || []).map((collection) => {
      if (collection.id !== collectionId) return collection;
      const ids = collection.ids || [];
      return Object.assign({}, collection, { ids: ids.includes(entryId) ? ids.filter((id) => id !== entryId) : ids.concat(entryId) });
    });
  }

  /* ---------------- bill reading ---------------- */

  const TOTAL_WORDS = /\b(grand\s*total|total\s*bayar|total\s*due|amount\s*due|jumlah\s*bayar|tagihan|total|jumlah|balance\s*due|to\s*pay)\b/i;
  const SUBTOTAL_WORDS = /\b(sub\s*-?\s*total|subtotal)\b/i;
  const TAX_WORDS = /\b(tax|ppn|pb1|pajak|vat|gst|sst)\b/i;
  const SERVICE_WORDS = /\b(service|servis|layanan|svc|s\/c)\b/i;
  const SKIP_WORDS = /\b(cash|tunai|change|kembali|kembalian|card|debit|kredit|credit|qris|ovo|gopay|dana|shopeepay|discount|diskon|disc|rounding|pembulatan|table|meja|order|no\.|telp|phone|npwp|kasir|cashier|date|tanggal|time|jam)\b/i;

  // Read one money amount. "45.000" and "45,000" are thousands; "12.50" and "12,50" are decimals.
  function parseAmount(raw) {
    const cleaned = String(raw).replace(/[^\d.,]/g, "");
    if (!/\d/.test(cleaned)) return null;
    if (/^\d{1,3}([.,]\d{3})+$/.test(cleaned)) return Number(cleaned.replace(/[.,]/g, ""));
    const decimal = cleaned.match(/^(\d+(?:[.,]\d{3})*)[.,](\d{1,2})$/);
    if (decimal) return Number(decimal[1].replace(/[.,]/g, "") + "." + decimal[2]);
    return Number(cleaned.replace(/[.,]/g, ""));
  }

  const AMOUNT_AT_END = /((?:rp|idr|rm|myr|sgd|s\$|\$|usd|thb|฿|php|₱|vnd|₫|eur|€|¥|jpy|krw|₩)?\s*-?\d[\d.,]*\d|\d)\s*(?:[a-z]{0,3})?\s*$/i;

  function readLine(line) {
    const match = line.match(AMOUNT_AT_END);
    if (!match) return null;
    const amount = parseAmount(match[1]);
    if (amount === null || !isFinite(amount) || amount <= 0) return null;
    const label = line.slice(0, match.index).replace(/^[\s\d]+[x×@]?\s*/i, "").replace(/[\s.:=\-]+$/, "").trim();
    return { label, amount };
  }

  // Bill text from the reader -> { total, subtotal, tax, service, items: [{ name, price }] }.
  function parseBill(text) {
    const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const result = { total: 0, subtotal: 0, tax: 0, service: 0, items: [] };
    const totals = [];
    for (const line of lines) {
      const read = readLine(line);
      if (!read) continue;
      if (SUBTOTAL_WORDS.test(line)) result.subtotal = read.amount;
      else if (TOTAL_WORDS.test(line)) totals.push(read.amount);
      else if (TAX_WORDS.test(line)) result.tax += read.amount;
      else if (SERVICE_WORDS.test(line)) result.service += read.amount;
      else if (SKIP_WORDS.test(line)) continue;
      else if (read.label && /[a-z]{2,}/i.test(read.label) && read.label.length <= 40) {
        result.items.push({ name: read.label.replace(/\s{2,}/g, " "), price: read.amount });
      }
    }
    if (totals.length) result.total = Math.max(...totals);
    else if (result.subtotal) result.total = result.subtotal + result.tax + result.service;
    else if (result.items.length) result.total = result.items.reduce((sum, item) => sum + item.price, 0) + result.tax + result.service;
    return result;
  }

  /* ---------------- stories ---------------- */

  function periodEntries(entries, days, now) {
    const end = now ? new Date(now).getTime() : Date.now();
    return real(entries).filter((entry) => {
      const time = new Date(entry.ts).getTime();
      return time <= end && time > end - days * DAY;
    });
  }

  function top(list) {
    const counts = new Map();
    for (const value of list) {
      const key = norm(value);
      if (!key) continue;
      if (!counts.has(key)) counts.set(key, { name: value, count: 0 });
      counts.get(key).count += 1;
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }

  // A short diary story for the last `days` days, written from the meals only (no service, no guessing).
  function story(entries, options) {
    const opts = Object.assign({ days: 7, now: null, money: (value) => String(value), budName: (id) => id }, options);
    const list = periodEntries(entries, opts.days, opts.now).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    const span = opts.days <= 7 ? "this week" : opts.days <= 31 ? "this month" : "this year";
    if (!list.length) return { title: "A quiet stretch", paragraphs: [`Nothing logged ${span} yet. The next meal starts the story.`] };
    const out = list.filter((entry) => entry.source === "out");
    const home = list.filter((entry) => entry.source === "home");
    const places = top(out.map((entry) => entry.place));
    const dishes = top(list.map((entry) => entry.name));
    const best = list.slice().sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))[0];
    const buds = top(list.flatMap((entry) => entry.friends || []).map((id) => opts.budName(id)));
    const spend = list.reduce((sum, entry) => sum + (Number(entry.price) || 0), 0);
    const first = list[0];
    const last = list[list.length - 1];
    const paragraphs = [];
    paragraphs.push(`It started with ${first.name}${first.place ? ` at ${first.place}` : ""} and, ${list.length} meals later, ended with ${last.name}${last.place ? ` at ${last.place}` : ""}.`);
    const mix = [];
    if (out.length) mix.push(`${out.length} out`);
    if (home.length) mix.push(`${home.length} at home`);
    const delivered = list.length - out.length - home.length;
    if (delivered) mix.push(`${delivered} delivered`);
    paragraphs.push(`That was ${mix.join(", ")}${spend ? `, for ${opts.money(spend)} in all` : ""}.`);
    if (dishes[0] && dishes[0].count > 1) paragraphs.push(`${dishes[0].name} kept coming back: ${dishes[0].count} times.`);
    if (places[0]) paragraphs.push(places[0].count > 1 ? `${places[0].name} was the place you kept returning to (${places[0].count} visits).` : `You ate out at ${places.length} different ${places.length === 1 ? "place" : "places"}.`);
    if (best && Number(best.rating) >= 4) paragraphs.push(`The high point: ${best.name}, rated ${best.rating} out of 5.`);
    if (buds[0]) paragraphs.push(`${buds[0].name} shared the table most often${buds.length > 1 ? `, with ${buds.length - 1} more ${buds.length === 2 ? "bud" : "buds"} along the way` : ""}.`);
    const title = dishes[0] && dishes[0].count > 1 ? `The ${span.replace("this ", "")} of ${dishes[0].name}` : `${list.length} meals ${span}`;
    return { title, paragraphs };
  }

  /* ---------------- questions ---------------- */

  const STOP = new Set("how much many did i do have has spend spent spending on for the a an at in of my me when last time times eat ate eaten eating what where whats was is are best favourite favorite place places with who whom which most expensive priciest cheapest week month year today yesterday ever total all this that these those meal meals food dish dishes so far past every it to from often go went got".split(" "));

  const SOURCE_WORDS = [
    { source: "out", pattern: /\b(eating out|eat out|ate out|dine out|dining out|restaurants?)\b/ },
    { source: "delivery", pattern: /\b(delivery|delivered|ordered in|order in|takeaway|takeout)\b/ },
    { source: "home", pattern: /\b(at home|cook|cooked|cooking|home cooking|homemade)\b/ },
  ];

  function sourceOf(question) {
    const q = norm(question);
    const found = SOURCE_WORDS.find((item) => item.pattern.test(q));
    return found ? { source: found.source, rest: q.replace(new RegExp(found.pattern.source, "g"), " ") } : { source: null, rest: q };
  }

  function topicOf(question) {
    return sourceOf(question).rest
      .replace(/[?!.,]/g, " ")
      .split(/\s+/)
      .filter((word) => word && !STOP.has(word))
      .join(" ")
      .trim();
  }

  function matches(entry, topic) {
    if (!topic) return true;
    const hay = norm([entry.name, entry.place, entry.cuisine, (entry.tastes || []).join(" "), entry.notes].join(" "));
    return topic.split(" ").every((word) => hay.includes(word));
  }

  function rangeFor(question, now) {
    const q = norm(question);
    const today = now ? new Date(now) : new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (/\btoday\b/.test(q)) return { from: start.getTime(), label: "today" };
    if (/\byesterday\b/.test(q)) return { from: start.getTime() - DAY, to: start.getTime(), label: "yesterday" };
    if (/\b(this|last) week\b|\bpast week\b/.test(q)) return { from: today.getTime() - 7 * DAY, label: "in the last 7 days" };
    if (/\b(this|last) month\b/.test(q)) return { from: today.getTime() - 30 * DAY, label: "in the last 30 days" };
    if (/\b(this|last) year\b/.test(q)) return { from: today.getTime() - 365 * DAY, label: "in the last year" };
    return { from: 0, label: "" };
  }

  // Answers questions about the diary with plain counting. Returns { text, ids, kind }.
  function answer(entries, question, options) {
    const opts = Object.assign({ now: null, money: (value) => String(value), budName: (id) => id }, options);
    const q = norm(question);
    if (!q.trim()) return { kind: "empty", text: "Ask about your own meals, for example “how much did I spend on ramen this month?”", ids: [] };
    const range = rangeFor(question, opts.now);
    const topic = topicOf(question);
    const pool = real(entries).filter((entry) => {
      const time = new Date(entry.ts).getTime();
      return time >= range.from && (!range.to || time < range.to);
    });
    const source = sourceOf(question).source;
    const hits = pool.filter((entry) => (!source || entry.source === source) && matches(entry, topic)).sort(byNewest);
    const sourceLabel = { out: "eating out", delivery: "delivery", home: "home cooking" }[source];
    const about = topic ? `“${topic}”` : sourceLabel || "your meals";
    const when = range.label ? ` ${range.label}` : "";
    const ids = hits.slice(0, 8).map((entry) => entry.id);
    if (!hits.length) return { kind: "none", text: `Nothing in your diary matches ${about}${when}.`, ids: [] };
    if (/how much|spend|spent|cost/.test(q)) {
      const total = hits.reduce((sum, entry) => sum + (Number(entry.price) || 0), 0);
      return { kind: "spend", text: `${opts.money(total)} on ${about}${when}, over ${hits.length} ${hits.length === 1 ? "meal" : "meals"}.`, ids };
    }
    if (/how (many|often)|times/.test(q)) {
      return { kind: "count", text: `${hits.length} ${hits.length === 1 ? "time" : "times"}${when} for ${about}.`, ids };
    }
    if (/\bwhen\b|\blast\b/.test(q) && !range.label) {
      const lastMeal = hits[0];
      return { kind: "last", text: `Last time: ${lastMeal.name}${lastMeal.place ? ` at ${lastMeal.place}` : ""} on ${new Date(lastMeal.ts).toDateString()}.`, ids: [lastMeal.id] };
    }
    if (/\bwho\b|\bwith\b/.test(q)) {
      const buds = top(hits.flatMap((entry) => entry.friends || []).map((id) => opts.budName(id)));
      return { kind: "who", text: buds.length ? `${buds.map((bud) => `${bud.name} (${bud.count})`).join(", ")}.` : `You ate ${about} on your own each time.`, ids };
    }
    if (/\bwhere\b|\bplace\b|best/.test(q)) {
      const places = new Map();
      for (const entry of hits.filter((item) => item.place)) {
        const key = norm(entry.place);
        if (!places.has(key)) places.set(key, { name: entry.place, total: 0, count: 0 });
        places.get(key).total += Number(entry.rating) || 0;
        places.get(key).count += 1;
      }
      const ranked = Array.from(places.values()).sort((a, b) => b.total / b.count - a.total / a.count || b.count - a.count);
      if (!ranked.length) return { kind: "where", text: `No place saved for ${about}.`, ids };
      const lead = ranked[0];
      return { kind: "where", text: `${lead.name}: ${lead.count} ${lead.count === 1 ? "visit" : "visits"}, average ${(lead.total / lead.count).toFixed(1)}/5${ranked.length > 1 ? `. Also: ${ranked.slice(1, 4).map((place) => place.name).join(", ")}` : ""}.`, ids };
    }
    if (/expensive|priciest|cheapest/.test(q)) {
      const sorted = hits.filter((entry) => Number(entry.price) > 0).sort((a, b) => (/cheapest/.test(q) ? a.price - b.price : b.price - a.price));
      if (!sorted.length) return { kind: "price", text: `No prices saved for ${about}${when}.`, ids };
      return { kind: "price", text: `${sorted[0].name}${sorted[0].place ? ` at ${sorted[0].place}` : ""}: ${opts.money(sorted[0].price)}.`, ids: [sorted[0].id] };
    }
    if (/what did i|what have i/.test(q)) {
      return { kind: "list", text: `${hits.length} ${hits.length === 1 ? "meal" : "meals"}${when}: ${hits.slice(0, 5).map((entry) => entry.name).join(", ")}${hits.length > 5 ? "…" : ""}.`, ids };
    }
    return { kind: "found", text: `${hits.length} ${hits.length === 1 ? "meal matches" : "meals match"} ${about}${when}. Latest: ${hits[0].name}.`, ids };
  }

  /* ---------------- name suggestions ---------------- */

  // A colour signature is 12 hue bins + 3 brightness bins, normalised to sum 1 (computed from pixels by the app).
  function signatureFromPixels(data) {
    const bins = new Array(15).fill(0);
    let counted = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      if (delta > 0.12) {
        let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
        hue = (hue * 60 + 360) % 360;
        bins[Math.floor(hue / 30) % 12] += 1;
      } else {
        bins[12 + Math.min(2, Math.floor(max * 3))] += 1;
      }
      counted += 1;
    }
    return counted ? bins.map((value) => value / counted) : null;
  }

  function signatureDistance(a, b) {
    if (!a || !b) return Infinity;
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.min(a[i], b[i]);
    return 1 - sum;
  }

  // Names to offer for a new meal: what you usually have at this place, then dishes whose photos look closest.
  function suggestNames(entries, options) {
    const opts = Object.assign({ place: "", signature: null, signatures: {}, limit: 4 }, options);
    const list = real(entries);
    const out = [];
    const seen = new Set();
    const push = (name, why) => {
      const key = norm(name);
      if (!key || seen.has(key) || out.length >= opts.limit) return;
      seen.add(key);
      out.push({ name, why });
    };
    const placeKey = norm(opts.place);
    if (placeKey) {
      for (const dish of top(list.filter((entry) => norm(entry.place) === placeKey).map((entry) => entry.name))) {
        push(dish.name, `your usual here ×${dish.count}`);
      }
    }
    if (opts.signature) {
      const scored = list
        .filter((entry) => opts.signatures[entry.id])
        .map((entry) => ({ entry, distance: signatureDistance(opts.signature, opts.signatures[entry.id]) }))
        .filter((item) => item.distance < 0.45)
        .sort((a, b) => a.distance - b.distance);
      for (const item of scored) push(item.entry.name, `looks like your ${item.entry.name} photo`);
    }
    return out;
  }

  /* ---------------- dish splitting ---------------- */

  // alpha: Uint8 array (0..255) of width*height. Returns boxes of separate food blobs, largest first.
  // Blobs under minShare of the food area, or touching only by thin bridges at this scale, stay separate pieces.
  function splitBlobs(alpha, width, height, options) {
    const opts = Object.assign({ threshold: 128, minShare: 0.08, maxPieces: 6, pad: 2 }, options);
    const labels = new Int32Array(width * height);
    const blobs = [];
    let solid = 0;
    for (let i = 0; i < alpha.length; i++) if (alpha[i] >= opts.threshold) solid += 1;
    if (!solid) return [];
    let next = 0;
    const stack = [];
    for (let start = 0; start < alpha.length; start++) {
      if (labels[start] || alpha[start] < opts.threshold) continue;
      next += 1;
      const box = { x0: width, y0: height, x1: 0, y1: 0, area: 0, label: next };
      labels[start] = next;
      stack.push(start);
      while (stack.length) {
        const index = stack.pop();
        const x = index % width;
        const y = (index - x) / width;
        box.area += 1;
        if (x < box.x0) box.x0 = x;
        if (y < box.y0) box.y0 = y;
        if (x > box.x1) box.x1 = x;
        if (y > box.y1) box.y1 = y;
        const around = [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, y > 0 ? index - width : -1, y < height - 1 ? index + width : -1];
        for (const n of around) {
          if (n < 0 || labels[n] || alpha[n] < opts.threshold) continue;
          labels[n] = next;
          stack.push(n);
        }
      }
      blobs.push(box);
    }
    return blobs
      .filter((box) => box.area / solid >= opts.minShare)
      .sort((a, b) => b.area - a.area)
      .slice(0, opts.maxPieces)
      .map((box) => ({
        label: box.label,
        share: box.area / solid,
        x: Math.max(0, box.x0 - opts.pad),
        y: Math.max(0, box.y0 - opts.pad),
        w: Math.min(width, box.x1 + opts.pad + 1) - Math.max(0, box.x0 - opts.pad),
        h: Math.min(height, box.y1 + opts.pad + 1) - Math.max(0, box.y0 - opts.pad),
      }));
  }

  /* ---------------- looks ---------------- */

  const PALETTES = [
    { id: "receipt", name: "Receipt", swatch: ["#f5efe3", "#b4380f", "#1d1813"] },
    { id: "night", name: "Night market", swatch: ["#17130f", "#f08a4b", "#f3eadb"] },
    { id: "matcha", name: "Matcha", swatch: ["#eef1e4", "#3f6b3a", "#1b2116"] },
    { id: "sambal", name: "Sambal", swatch: ["#fbeee8", "#c0262d", "#2a1210"] },
    { id: "kopi", name: "Kopi", swatch: ["#efe5d6", "#7a4a26", "#2b1d12"] },
    { id: "laut", name: "Laut", swatch: ["#e9f0f2", "#1f6680", "#11222a"] },
  ];

  const TYPES = [
    { id: "classic", name: "Classic", sample: "Serif headings, clean body" },
    { id: "rounded", name: "Rounded", sample: "Soft and friendly" },
    { id: "mono", name: "Receipt mono", sample: "Everything on the till roll" },
    { id: "large", name: "Large", sample: "Bigger text everywhere" },
  ];

  root.LahapStudioLogic = {
    SMART,
    smartCollections,
    customCollections,
    toggleInCollection,
    parseAmount,
    parseBill,
    story,
    answer,
    topicOf,
    signatureFromPixels,
    signatureDistance,
    suggestNames,
    splitBlobs,
    PALETTES,
    TYPES,
  };
})(typeof window !== "undefined" ? window : globalThis);
