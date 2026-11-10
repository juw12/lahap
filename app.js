/* Lahap app: views, storage, share cards, taste buds. Logic lives in logic.js. */
(function () {
  "use strict";

  const L = window.LahapLogic;
  const TASTES = L.TASTES;
  const CUISINES = [
    "Indonesian", "Malay", "Chinese", "Japanese", "Korean", "Thai", "Vietnamese",
    "Indian", "Western", "Middle Eastern", "Dessert & drinks", "Other",
  ];
  const SOURCES = { out: "Ate out", home: "Home-cooked", delivery: "Delivery" };
  const CURRENCIES = ["IDR", "SGD", "MYR", "USD", "TWD", "EUR"];

  // Sample profiles shown under "Suggested by taste". There is no server yet, so these are demo people.
  const PEOPLE = [
    { id: "rina", name: "Rina", area: "Batam Centre", color: "#8f3b1b", tastes: [1, 0.3, 0.6, 0.4, 0.8, 0.7], cuisines: ["Indonesian", "Thai", "Korean"] },
    { id: "kevin", name: "Kevin", area: "Nagoya", color: "#2f4f6a", tastes: [0.3, 0.5, 0.2, 0.7, 1, 0.8], cuisines: ["Japanese", "Chinese", "Western"] },
    { id: "arif", name: "Arif", area: "Batu Aji", color: "#4c5a1e", tastes: [1, 0.1, 0.7, 0.5, 0.6, 0.5], cuisines: ["Indonesian", "Malay", "Indian"] },
    { id: "mei", name: "Mei Lin", area: "Harbour Bay", color: "#1f5e57", tastes: [0.4, 0.3, 0.4, 0.6, 1, 0.3], cuisines: ["Chinese", "Vietnamese", "Japanese"] },
    { id: "dewi", name: "Dewi", area: "Sekupang", color: "#6a3a5c", tastes: [0.2, 1, 0.3, 0.2, 0.4, 0.6], cuisines: ["Dessert & drinks", "Western", "Japanese"] },
    { id: "jonas", name: "Jonas", area: "Nongsa", color: "#5a4632", tastes: [0.1, 0.6, 0.1, 0.8, 0.5, 1], cuisines: ["Western", "Middle Eastern"] },
  ];

  const state = {
    entries: [],
    settings: { name: "", currency: "IDR", profile: null, quizSeen: false },
    friends: [],
    points: {},
    invites: [],
    view: "diary",
    query: "",
    sourceFilter: "all",
    tasteFilter: [],
    tastesOpen: false,
    period: 7,
    lab: { text: "", have: [], goal: null, status: "" },
  };

  /* ---------------- storage: IndexedDB, in-memory fallback ---------------- */
  const store = (function () {
    let db = null;
    const memory = { entries: new Map(), kv: new Map() };

    function open() {
      return new Promise((resolve) => {
        try {
          const request = indexedDB.open("lahap", 1);
          request.onupgradeneeded = () => {
            const database = request.result;
            database.createObjectStore("entries", { keyPath: "id" });
            database.createObjectStore("kv", { keyPath: "key" });
          };
          request.onsuccess = () => {
            db = request.result;
            resolve(true);
          };
          request.onerror = () => resolve(false);
        } catch (error) {
          resolve(false);
        }
      });
    }

    function tx(name, mode, work) {
      if (!db) return Promise.resolve(work(null));
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(name, mode);
        const objectStore = transaction.objectStore(name);
        const result = work(objectStore);
        transaction.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
        transaction.onerror = () => reject(transaction.error);
      });
    }

    return {
      open,
      async all() {
        if (!db) return Array.from(memory.entries.values());
        return tx("entries", "readonly", (objectStore) => objectStore.getAll());
      },
      async put(entry) {
        if (!db) {
          memory.entries.set(entry.id, entry);
          return;
        }
        return tx("entries", "readwrite", (objectStore) => objectStore.put(entry));
      },
      async remove(id) {
        if (!db) {
          memory.entries.delete(id);
          return;
        }
        return tx("entries", "readwrite", (objectStore) => objectStore.delete(id));
      },
      async clear() {
        memory.entries.clear();
        memory.kv.clear();
        if (!db) return;
        await tx("entries", "readwrite", (objectStore) => objectStore.clear());
        await tx("kv", "readwrite", (objectStore) => objectStore.clear());
      },
      async get(key, fallback) {
        if (!db) return memory.kv.has(key) ? memory.kv.get(key) : fallback;
        const row = await tx("kv", "readonly", (objectStore) => objectStore.get(key));
        return row ? row.value : fallback;
      },
      async set(key, value) {
        if (!db) {
          memory.kv.set(key, value);
          return;
        }
        return tx("kv", "readwrite", (objectStore) => objectStore.put({ key, value }));
      },
    };
  })();

  async function saveMeta() {
    await store.set("settings", state.settings);
    await store.set("friends", state.friends);
    await store.set("points", state.points);
    await store.set("invites", state.invites);
  }

  /* ---------------- helpers ---------------- */
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function money(value) {
    return L.formatMoney(value, state.settings.currency);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function personById(id) {
    return PEOPLE.find((person) => person.id === id);
  }

  function friendNames() {
    const names = {};
    for (const person of PEOPLE) names[person.id] = person.name;
    return names;
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove("show"), 2600);
  }

  function dayLabel(ts) {
    const date = new Date(ts);
    const today = new Date();
    const key = L.dayKey(date);
    if (key === L.dayKey(today)) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (key === L.dayKey(yesterday)) return "Yesterday";
    return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  }

  function timeLabel(ts) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function relative(ts) {
    const days = Math.round((new Date(L.dayKey(new Date())) - new Date(L.dayKey(ts))) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 31) return `${days} days ago`;
    const months = Math.round(days / 30);
    return months === 1 ? "a month ago" : `${months} months ago`;
  }

  function scoreClass(score) {
    if (score >= 75) return "good";
    if (score >= 50) return "ok";
    return "heavy";
  }

  function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
  }

  function scoreBadge(score) {
    return `<span class="score ${scoreClass(score)}" title="Plate score ${score} of 100: ${L.healthLabel(score)}">${score} ${L.healthLabel(score)}</span>`;
  }

  function localInputValue(date) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date - offset).toISOString().slice(0, 16);
  }

  function sortedEntries() {
    return state.entries.slice().sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }

  function myCuisines(entries) {
    return L.topCuisines(entries || state.entries, 4).map((item) => item.name);
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ---------------- plate glyph ---------------- */
  const PLATE_COLORS = { veg: "#4f8a3c", protein: "#a8452a", carbs: "#e0b25a" };

  function seeded(seed) {
    let value = 0;
    for (let i = 0; i < seed.length; i++) value = (value * 31 + seed.charCodeAt(i)) >>> 0;
    return function () {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  // Draws the plate as portions: veg, protein and starch wedges sized by what you logged.
  function drawPlate(ctx, cx, cy, radius, plate, seedText) {
    const p = Object.assign({ veg: 0, protein: 0, carbs: 0 }, plate || {});
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#d8ccb6";
    ctx.lineWidth = Math.max(1, radius * 0.03);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // each dish gets its own plate: rim style and portion rotation come from the dish name
    const style = seeded("rim:" + (seedText || "plate"));
    const rim = Math.floor(style() * 3);
    if (rim === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.82, 0, Math.PI * 2);
      ctx.strokeStyle = "#ece3d3";
      ctx.stroke();
    } else if (rim === 1) {
      const beads = 28;
      ctx.fillStyle = "#e6dac4";
      for (let i = 0; i < beads; i++) {
        const a = (i / beads) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * radius * 0.9, cy + Math.sin(a) * radius * 0.9, Math.max(0.6, radius * 0.022), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.89, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1, radius * 0.06);
      ctx.strokeStyle = "#f0e2c8";
      ctx.stroke();
      ctx.lineWidth = Math.max(1, radius * 0.03);
    }
    const turn = style() * Math.PI * 2;

    const portions = [
      { key: "veg", size: p.veg },
      { key: "protein", size: p.protein },
      { key: "carbs", size: p.carbs },
    ].filter((portion) => portion.size > 0);
    const total = portions.reduce((sum, portion) => sum + portion.size, 0);
    const inner = radius * 0.74;
    const random = seeded(seedText || "plate");
    if (!total) {
      ctx.setLineDash([radius * 0.08, radius * 0.08]);
      ctx.strokeStyle = "#c9bba3";
      ctx.beginPath();
      ctx.arc(cx, cy, inner * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    let angle = -Math.PI / 2 + turn;
    for (const portion of portions) {
      const sweep = (portion.size / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, inner, angle + 0.04, angle + sweep - 0.04);
      ctx.closePath();
      ctx.fillStyle = PLATE_COLORS[portion.key];
      ctx.fill();
      // texture dots so wedges read as food, not a chart
      const dots = Math.round(6 + portion.size * 6);
      for (let i = 0; i < dots; i++) {
        const a = angle + 0.12 + random() * (sweep - 0.24);
        const d = inner * (0.25 + random() * 0.65);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, radius * (0.025 + random() * 0.03), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.fill();
      }
      angle += sweep;
    }
    if (p.fried) {
      ctx.strokeStyle = "#8a5a12";
      ctx.lineWidth = Math.max(1.5, radius * 0.045);
      ctx.setLineDash([radius * 0.06, radius * 0.05]);
      ctx.beginPath();
      ctx.arc(cx, cy, inner + radius * 0.02, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (p.sugary) {
      const gx = cx + radius * 0.78;
      const gy = cy - radius * 0.78;
      ctx.beginPath();
      ctx.arc(gx, gy, radius * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#d8ccb6";
      ctx.lineWidth = Math.max(1, radius * 0.03);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(gx, gy, radius * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = "#b5577a";
      ctx.fill();
    }
    ctx.restore();
  }

  const thumbCache = new Map();

  function plateThumb(entry, size) {
    const px = size || 144;
    const key = JSON.stringify(entry.plate || {}) + entry.name + px;
    if (thumbCache.has(key)) return thumbCache.get(key);
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#efe6d6";
    ctx.fillRect(0, 0, px, px);
    drawPlate(ctx, px / 2, px / 2, px * 0.42, entry.plate, entry.name);
    const url = canvas.toDataURL("image/png");
    thumbCache.set(key, url);
    return url;
  }

  function imageFor(entry) {
    return entry.cutout || entry.photo || plateThumb(entry);
  }

  /* ---------------- nutrition and goals ---------------- */
  const N = window.LahapNutrition;
  const R = window.LahapRecipes;
  const SAMPLE_PROFILE = { goal: "healthy", sex: "m", age: 30, height: 170, weight: 68, activity: "light", diet: {}, cookMinutes: 30 };

  function profileOrDefault() {
    return state.settings.profile || { goal: "healthy" };
  }

  function nutritionFor(entry) {
    return N.estimate(entry);
  }

  function dayTotals(key, exceptId) {
    return N.sum(state.entries.filter((entry) => L.dayKey(entry.ts) === key && entry.id !== exceptId).map(nutritionFor));
  }

  function nutriHtml(nutrition, tips) {
    return `
      <div class="nutri-head"><h3>Estimated nutrition</h3><span class="hint">${esc(nutrition.label)}</span></div>
      <dl class="macros">
        <div><dt>Energy</dt><dd>${nutrition.kcal}<small> kcal</small></dd></div>
        <div><dt>Protein</dt><dd>${nutrition.p}<small> g</small></dd></div>
        <div><dt>Carbs</dt><dd>${nutrition.c}<small> g</small></dd></div>
        <div><dt>Fat</dt><dd>${nutrition.f}<small> g</small></dd></div>
        <div><dt>Fiber</dt><dd>${nutrition.fiber}<small> g</small></dd></div>
      </dl>
      ${tips && tips.length ? `<ul class="tips">${tips.map((tip) => `<li>${esc(tip)}</li>`).join("")}</ul>` : ""}
      <p class="hint small">Estimated from typical portions, not measured. Not medical advice.</p>`;
  }

  // r28: when the newest day is not today, a one-line Today row says so and offers the 15-second log
  function todayEmptyHtml() {
    const key = L.dayKey(new Date());
    if (!state.entries.length || state.entries.some((entry) => L.dayKey(entry.ts) === key)) return "";
    return `<div class="today-empty"><p><b>Today</b><span class="te-sub">nothing logged yet</span></p><button type="button" class="btn small primary" data-action="log">Log a meal</button></div>`;
  }

  function todayHtml() {
    const key = L.dayKey(new Date());
    const today = state.entries.filter((entry) => L.dayKey(entry.ts) === key);
    const goals = profileOrDefault();
    const target = N.targets(goals);
    const total = N.sum(today.map(nutritionFor));
    const pct = (value, of) => Math.min(100, Math.round((value / Math.max(1, of)) * 100));
    const kcalPct = pct(total.kcal, target.kcal);
    const proteinPct = pct(total.p, target.protein);
    return `
      <section class="today" aria-label="Today against your targets">
        <div class="today-grid">
          <div>
            <div class="today-row"><span>Today</span><span class="mono">${total.kcal} / ${target.kcal} kcal</span></div>
            <div class="bar" role="img" aria-label="${kcalPct}% of today's calories"><span style="width:${kcalPct}%"></span></div>
          </div>
          <div>
            <div class="today-row"><span>Protein</span><span class="mono">${total.p} / ${target.protein} g</span></div>
            <div class="bar protein" role="img" aria-label="${proteinPct}% of today's protein"><span style="width:${proteinPct}%"></span></div>
          </div>
        </div>
        <p class="today-tip">${esc(N.dayTip(total, goals, new Date().getHours()))}</p>
        ${state.settings.profile ? "" : '<button type="button" class="btn small" data-quiz>Set my goal for personal targets</button>'}
      </section>`;
  }

  /* ---------------- sample data ---------------- */
  const SAMPLE_DISHES = [
    { name: "Nasi lemak ayam", place: "Warung Kak Ros", source: "out", cuisine: "Malay", tastes: ["Spicy", "Rich"], plate: { veg: 0, protein: 1, carbs: 2, fried: true }, price: 25000, rating: 5 },
    { name: "Gado-gado", place: "Warung Bu Sri", source: "out", cuisine: "Indonesian", tastes: ["Sweet", "Rich"], plate: { veg: 2, protein: 1, carbs: 1 }, price: 22000, rating: 4 },
    { name: "Tonkotsu ramen", place: "Menya Kiri", source: "out", cuisine: "Japanese", tastes: ["Umami", "Salty", "Rich"], plate: { veg: 0, protein: 1, carbs: 2 }, price: 78000, rating: 4 },
    { name: "Kangkung and tofu stir-fry", place: "Home", source: "home", cuisine: "Chinese", tastes: ["Salty", "Umami"], plate: { veg: 2, protein: 1, carbs: 1 }, price: 15000, rating: 4 },
    { name: "Soto ayam", place: "Soto Pak Min", source: "out", cuisine: "Indonesian", tastes: ["Sour", "Umami"], plate: { veg: 1, protein: 1, carbs: 1 }, price: 20000, rating: 4 },
    { name: "Brown sugar boba", place: "Teh Tarik Corner", source: "out", cuisine: "Dessert & drinks", tastes: ["Sweet"], plate: { veg: 0, protein: 0, carbs: 0, sugary: true }, price: 28000, rating: 3 },
    { name: "Bakso urat", place: "Bakso Pak Gun", source: "out", cuisine: "Indonesian", tastes: ["Salty", "Umami"], plate: { veg: 0, protein: 2, carbs: 1, processed: true }, price: 23000, rating: 4 },
    { name: "Salmon rice bowl", place: "Home", source: "home", cuisine: "Japanese", tastes: ["Umami"], plate: { veg: 1, protein: 2, carbs: 1 }, price: 45000, rating: 5 },
    { name: "Tom yum seafood", place: "Krua Thai", source: "out", cuisine: "Thai", tastes: ["Spicy", "Sour"], plate: { veg: 1, protein: 2, carbs: 1 }, price: 65000, rating: 5 },
    { name: "Kimchi fried rice", place: "Home", source: "home", cuisine: "Korean", tastes: ["Spicy", "Umami"], plate: { veg: 1, protein: 1, carbs: 2 }, price: 18000, rating: 4 },
    { name: "Nasi padang rendang", place: "RM Minang Jaya", source: "out", cuisine: "Indonesian", tastes: ["Spicy", "Rich"], plate: { veg: 1, protein: 2, carbs: 2 }, price: 35000, rating: 5 },
    { name: "Chicken caesar wrap", place: "Wrap and Co", source: "delivery", cuisine: "Western", tastes: ["Salty", "Rich"], plate: { veg: 1, protein: 1, carbs: 1 }, price: 52000, rating: 3 },
    { name: "Overnight oats", place: "Home", source: "home", cuisine: "Western", tastes: ["Sweet"], plate: { veg: 1, protein: 1, carbs: 1 }, price: 12000, rating: 4 },
    { name: "Pho bo", place: "Pho Ha Long", source: "out", cuisine: "Vietnamese", tastes: ["Umami", "Sour"], plate: { veg: 1, protein: 2, carbs: 1 }, price: 55000, rating: 4 },
  ];

  // 16 days, 2-3 meals a day, a few repeats on purpose so search has something to find.
  const SAMPLE_PLAN = [
    [12, 0, 4], [3, 6], [12, 1, 8], [10, 5], [13, 9, 3], [0, 7], [12, 2, 5], [1, 10],
    [13, 4, 0], [11, 3], [12, 6, 8], [9, 2], [13, 0, 5], [1, 7], [12, 10, 3], [4, 0],
  ];
  const SAMPLE_FRIENDS = { 2: ["kevin"], 8: ["rina"], 10: ["rina", "arif"], 0: [] };

  function sampleEntries(now) {
    const entries = [];
    const mealHours = [8, 12, 19];
    SAMPLE_PLAN.forEach((dishes, dayOffset) => {
      dishes.forEach((dishIndex, slot) => {
        const dish = SAMPLE_DISHES[dishIndex];
        const date = new Date(now);
        date.setDate(date.getDate() - dayOffset);
        const hour = dishes.length === 2 ? [12, 19][slot] : mealHours[slot];
        date.setHours(hour, (dishIndex * 7) % 60, 0, 0);
        if (date > now) date.setDate(date.getDate() - 1);
        const friends = slot > 0 && SAMPLE_FRIENDS[dishIndex] ? SAMPLE_FRIENDS[dishIndex] : [];
        entries.push(Object.assign({}, dish, {
          id: `s${dayOffset}-${slot}`,
          ts: date.toISOString(),
          plate: Object.assign({ fried: false, sugary: false, processed: false }, dish.plate),
          friends,
          notes: "",
          photo: null,
          sample: true,
        }));
      });
    });
    return entries;
  }

  async function loadSample() {
    const entries = sampleEntries(new Date());
    for (const entry of entries) await store.put(entry);
    state.entries = state.entries.filter((entry) => !entry.sample).concat(entries);
    if (!state.friends.length) state.friends = ["rina", "kevin"];
    for (const entry of entries) {
      for (const id of entry.friends) state.points[id] = (state.points[id] || 0) + L.POINTS.tag;
    }
    await saveMeta();
  }

  /* ---------------- router ---------------- */
  const VIEWS = ["diary", "insights", "lab", "buds", "me"];

  function route() {
    const hash = location.hash.replace("#", "");
    const previousView = state.view;
    state.view = VIEWS.includes(hash) ? hash : "diary";
    // r22: a new view opens at its top, not at the scroll depth of the last one
    if (previousView && previousView !== state.view) window.scrollTo(0, 0);
    for (const section of $$(".view")) section.hidden = section.dataset.view !== state.view;
    for (const link of $$("[data-tab]")) {
      if (link.dataset.tab === state.view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    render();
  }

  function render() {
    if (state.view === "diary") renderDiary();
    if (state.view === "insights") renderInsights();
    if (state.view === "lab") renderLab();
    if (state.view === "buds") renderBuds();
    if (state.view === "me") renderMe();
  }

  const ICON_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_SHARE_SMALL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0L8 8m4-4 4 4M6 12v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  /* ---------------- diary ---------------- */
  function filteredEntries() {
    let list = L.searchEntries(sortedEntries(), state.query, friendNames());
    if (state.sourceFilter !== "all") list = list.filter((entry) => entry.source === state.sourceFilter);
    if (state.tasteFilter.length) {
      list = list.filter((entry) => state.tasteFilter.every((taste) => (entry.tastes || []).includes(taste)));
    }
    return list;
  }

  function ticketHtml(entry) {
    const score = L.healthScore(entry.plate);
    const who = (entry.friends || []).map((id) => (personById(id) || {}).name).filter(Boolean);
    const samePlace = entry.place && entry.source === "home" && /^home$/i.test(entry.place.trim());
    const meta = [timeLabel(entry.ts), samePlace ? null : entry.place, SOURCES[entry.source]].filter(Boolean);
    const tags = (entry.tastes || []).map((taste) => `<span class="tag">${esc(taste)}</span>`).join("");
    const withWho = who.length ? `<span class="tag">with ${esc(who.join(", "))}</span>` : "";
    return `
      <div class="ticket-wrap">
      <button type="button" class="ticket" data-open="${esc(entry.id)}">
        <img class="thumb${entry.cutout ? " cut" : ""}" src="${imageFor(entry)}" alt="${entry.photo ? "Photo of " + esc(entry.name) : "Plate drawing of " + esc(entry.name)}" width="72" height="72" loading="lazy">
        <span>
          <span class="title">${esc(entry.name)}</span>
          <span class="meta">${meta.map((part) => `<span class="seg">${esc(part)}</span>`).join(" · ")}</span>
          <span class="tags">${tags}${withWho}</span>
        </span>
        <span class="stub">
          <span class="price">${entry.price ? esc(money(entry.price)) : "free"}</span>
          <span class="kcal mono">${nutritionFor(entry).kcal} kcal</span>
          ${scoreBadge(score)}
        </span>
      </button>
      <button type="button" class="ticket-share" data-share="${esc(entry.id)}" aria-label="Share a card of ${esc(entry.name)}" title="Share card"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0L8 8m4-4 4 4M6 12v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>`;
  }

  // r12: four answer cells in a 2x2 (phone) / 4-up (desktop) grid; the price range and first-logged date
  // ride as small notes under their parent value instead of taking cells of their own
  function answerStatsHtml(summary) {
    const ranged = summary.minPrice !== summary.maxPrice;
    const rangeNote = ranged ? `<small class="dd-note">${esc(money(summary.minPrice))} – ${esc(money(summary.maxPrice))}</small>` : "";
    const firstNote = `<small class="dd-note">since ${esc(new Date(summary.first.ts).toLocaleDateString(undefined, { day: "numeric", month: "short" }))}</small>`;
    return `
        <dl class="answer-stats">
          <div><dt>Avg price</dt><dd>${esc(money(summary.avgPrice))}${rangeNote}</dd></div>
          <div><dt>Plate score</dt><dd>${scoreBadge(summary.avgHealth)}</dd></div>
          <div><dt>Rating</dt><dd>${summary.avgRating ? summary.avgRating.toFixed(1) + " / 5" : "–"}</dd></div>
          <div><dt>Where</dt><dd>${esc(summary.places.join(", ") || "–")}${firstNote}</dd></div>
        </dl>`;
  }

  function answerHtml(query, matches, eyebrow = "Have I eaten this?") {
    if (!query.trim()) return "";
    const summary = L.summarize(matches);
    if (!summary) {
      return `<div class="answer" role="status"><h2>Not in your diary yet</h2><p class="muted">No meal matches “${esc(query)}”. Try a place, a taste like “spicy”, or a friend's name.</p></div>`;
    }
    const last = summary.last;
    return `
      <div class="answer${eyebrow === "On repeat" ? " featured" : ""}" role="status">
        <div class="answer-head">
          <img class="answer-thumb${last.cutout ? " cut" : ""}" src="${imageFor(last)}" alt="${last.photo ? "Photo of " + esc(last.name) : "Plate drawing of " + esc(last.name)}" width="64" height="64">
          <div>
            <p class="eyebrow">${eyebrow === "On repeat" ? "On repeat · most-eaten, all time" : eyebrow}</p>
            <h2>${eyebrow === "On repeat" ? `<span class="answer-dish">${esc(last.name)}</span>` : ""}Yes, ${summary.count} ${summary.count === 1 ? "time" : "times"}. Last ${esc(relative(last.ts))}${last.place ? " at " + esc(last.place) : ""}.</h2>
          </div>
        </div>
        ${answerStatsHtml(summary)}
        <div class="btn-row" style="margin-top:12px"><button type="button" class="btn" data-again="${esc(last.id)}">Log “${esc(last.name)}” again</button><button type="button" class="btn" data-share="${esc(last.id)}">Share card</button></div>
      </div>`;
  }

  // Fresh first screen (no search, no filters): answer the signature question for the
  // dish you eat most, so log / search / answer are all visible in ~3s without typing.
  // Typing into the search box replaces it with the live search answer.
  // r6b: on desktop this is the page's hero — a big plate, the dish name, and a ×N repeat badge.
  function featuredAnswerHtml() {
    if (state.query.trim()) return "";
    if (state.sourceFilter !== "all" || state.tasteFilter.length) return "";
    const top = L.repeats(state.entries, 2)[0];
    if (!top) return "";
    const matches = state.entries.filter((entry) => L.normalize(entry.name) === L.normalize(top.name));
    const summary = L.summarize(matches);
    if (!summary) return "";
    const last = summary.last;
    const where = last.place ? " at " + esc(last.place) : "";
    return `
      <div class="answer featured" role="status">
        <div class="answer-hero">
          <img class="answer-thumb${last.cutout ? " cut" : ""}" src="${imageFor(last)}" alt="${last.photo ? "Photo of " + esc(last.name) : "Plate drawing of " + esc(last.name)}" width="144" height="144">
          <div class="answer-hero-body">
            <p class="eyebrow">On repeat · most-eaten, all time</p>
            <h2 class="answer-hero-name"><span class="answer-dish">${esc(last.name)}</span></h2>
            <p class="answer-repeat"><span class="repeat-badge" title="Eaten ${summary.count} times">×${summary.count}</span>Yes, ${summary.count} ${summary.count === 1 ? "time" : "times"}. Last ${esc(relative(last.ts))}${where}.</p>
          </div>
        </div>
        ${answerStatsHtml(summary)}
        <div class="btn-row" style="margin-top:12px"><button type="button" class="btn" data-again="${esc(last.id)}">Log “${esc(last.name)}” again</button><button type="button" class="btn" data-share="${esc(last.id)}">Share card</button></div>
      </div>`;
  }

  function weekAsideHtml() {
    const week = L.withinDays(state.entries, 7);
    const spend = L.spendSummary(week);
    const avg = week.length ? Math.round(week.reduce((sum, entry) => sum + L.healthScore(entry.plate), 0) / week.length) : 0;
    const onRepeat = L.repeats(week, 3).slice(0, 3);
    return `
      <aside class="panel" aria-labelledby="week-title">
        ${week.length ? '<canvas id="week-plate" class="week-plate" width="128" height="128" aria-hidden="true"></canvas>' : ""}
        <p class="eyebrow">Last 7 days</p>
        <h2 id="week-title">Your week on a plate</h2>
        <div class="stat-grid">
          <div class="stat"><div class="label">Meals</div><div class="value">${week.length}</div></div>
          <div class="stat"><div class="label">Variety</div><div class="value">${L.varietyScore(week)}</div><div class="note">out of 100 · 0 = same meal</div></div>
          <div class="stat"><div class="label">Plate score</div><div class="value">${avg}</div><div class="note">${esc(L.healthLabel(avg))}</div></div>
          <div class="stat"><div class="label">Spent</div><div class="value money">${esc(money(spend.total))}</div></div>
        </div>
        ${onRepeat.length ? `<p class="notice week-repeat">On repeat this week (last 7 days): ${onRepeat.map((item) => `${esc(item.name)} ×${item.count}`).join(", ")}.</p>` : ""}
        <div class="btn-row" style="margin-top:16px">
          <button type="button" class="btn primary" data-share-week>Share my week</button>
          <a class="btn" href="#insights">All insights</a>
        </div>
      </aside>`;
  }

  // diary nudge: the best-matched bud and why, with a one-tap hangout
  function budNudgeHtml() {
    const buds = PEOPLE.filter((person) => state.friends.includes(person.id));
    const pool = buds.length ? buds : PEOPLE;
    const best = pool.map((person) => ({ person, match: matchFor(person) })).sort((a, b) => b.match - a.match)[0];
    if (!best || state.entries.length < 3) return "";
    const isBud = buds.includes(best.person);
    const action = isBud
      ? `<button type="button" class="btn" data-hangout="${best.person.id}">Plan makan</button>`
      : `<button type="button" class="btn" data-add="${best.person.id}">Add bud</button>`;
    return `<div class="bud-nudge"><span class="avatar" style="background:${best.person.color || "var(--accent)"}">${esc(best.person.name[0])}</span><span><strong>${esc(best.person.name)} · ${best.match}% match</strong><span class="muted small">${esc(reasonsFor(best.person))}</span></span>${action}</div>`;
  }

  // r21: the social loop and the share action on the Diary's first screen, under the latest day's header:
  // the bud closest to their next level (one tap tags them in a new meal) and a share of that day's plate
  function dayPulseHtml(group) {
    const latest = group.entries[0];
    const shareButton = `<button type="button" class="btn small" data-share="${esc(latest.id)}" aria-label="Share a card of ${esc(latest.name)}">${ICON_SHARE_SMALL}<span class="pulse-share-label">Share</span></button>`;
    const buds = PEOPLE.filter((person) => state.friends.includes(person.id));
    const ranked = buds
      .map((person) => ({ person, level: L.levelFor(state.points[person.id] || 0) }))
      .filter((item) => item.level.next)
      .sort((a, b) => a.level.toNext - b.level.toNext);
    // r27: a planned makan that hasn't been marked yet comes first - one tap closes the loop (+points, log the meal)
    const plan = state.invites
      .filter((invite) => !invite.done && buds.some((person) => person.id === invite.friend))
      .sort((a, b) => new Date(a.when) - new Date(b.when))[0];
    if (plan) {
      const friend = personById(plan.friend);
      const when = new Date(plan.when).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      return `<div class="day-pulse pulse-plan">${avatar(friend)}<span class="pulse-text"><strong>Makan with ${esc(friend.name)}</strong><span class="muted small">${esc(plan.place || "somewhere new")} · ${esc(when)}<span class="pulse-extra"> · +${L.POINTS.hangout} pts</span></span></span><button type="button" class="btn small primary" data-done="${esc(plan.id)}">We went</button>${shareButton}</div>`;
    }
    if (!ranked.length) {
      return `<div class="day-pulse"><span class="pulse-text"><strong>Eat with a friend?</strong><span class="muted small">Add a bud on Taste buds and tag them in meals.</span></span><a class="btn small" href="#buds">Find buds</a>${shareButton}</div>`;
    }
    const { person, level } = ranked[0];
    const match = hasTasteProfile() ? ` · ${matchFor(person)}% match` : "";
    return `<div class="day-pulse">${avatar(person)}<span class="pulse-text"><strong>${esc(person.name)}${match}</strong><span class="muted small">${level.toNext} pts to ${esc(level.next)}<span class="pulse-extra"> · +${L.POINTS.tag} a tag</span></span><span class="pulse-meter" aria-hidden="true"><span style="width:${Math.max(4, Math.round((level.progress || 0) * 100))}%"></span></span></span><button type="button" class="btn small primary" data-tag-meal="${esc(person.id)}">Tag ${esc(person.name)}</button>${shareButton}</div>`;
  }

  // r16: short money for the phone week strip - "IDR 533k", "IDR 1.2M"
  function compactMoney(value) {
    const amount = Number(value) || 0;
    const currency = state.settings.currency;
    if (amount >= 1e6) return `${currency} ${(amount / 1e6).toFixed(amount >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
    if (amount >= 1e3) return `${currency} ${Math.round(amount / 1e3)}k`;
    return `${currency} ${Math.round(amount)}`;
  }

  // r16: the phone Diary's first screen answers "how's my week" without scrolling (desktop has the aside)
  function weekStripHtml() {
    const week = L.withinDays(state.entries, 7);
    if (!week.length) return "";
    const spend = L.spendSummary(week);
    const avg = Math.round(week.reduce((sum, entry) => sum + L.healthScore(entry.plate), 0) / week.length);
    const variety = L.varietyScore(week);
    const label = `Last 7 days: ${week.length} ${week.length === 1 ? "meal" : "meals"}, variety ${variety}, plate score ${avg} ${L.healthLabel(avg)}, ${money(spend.total)} spent. Open Insights`;
    return `
      <a class="week-strip" href="#insights" aria-label="${esc(label)}">
        <span><span class="ws-label">7 days</span><span class="ws-value">${week.length} ${week.length === 1 ? "meal" : "meals"}</span></span>
        <span><span class="ws-label">Variety <i class="ws-scale">/100</i></span><span class="ws-value">${variety}</span></span>
        <span><span class="ws-label">Plate <i class="ws-scale">/100</i></span><span class="ws-value">${avg}</span></span>
        <span><span class="ws-label">Spent</span><span class="ws-value" title="${esc(money(spend.total))}" aria-label="${esc(money(spend.total))}">${esc(compactMoney(spend.total))}</span></span>
      </a>`;
  }

  function weekLineHtml() {
    const week = L.withinDays(state.entries, 7);
    const spend = L.spendSummary(week);
    const avg = week.length ? Math.round(week.reduce((sum, entry) => sum + L.healthScore(entry.plate), 0) / week.length) : 0;
    return `
      <div class="weekline${week.length ? " has-strip" : ""}">
        <dl>
          <div><dt>7-day meals</dt><dd>${week.length}</dd></div>
          <div><dt>Variety</dt><dd>${L.varietyScore(week)}</dd></div>
          <div><dt>Plate</dt><dd>${avg} <small>${esc(L.healthLabel(avg))}</small></dd></div>
          <div><dt>Spent</dt><dd>${esc(money(spend.total))}</dd></div>
        </dl>
        <button type="button" class="btn small" data-share-week>Share my week</button>
      </div>`;
  }

  // r18: a first-time user sees what one logged meal looks like before committing to log their own
  function sampleTicketHtml() {
    const sample = {
      name: "Nasi lemak ayam",
      place: "Warung Kak Ros",
      source: "out",
      price: 18000,
      tastes: ["Spicy", "Rich"],
      plate: { veg: 1, protein: 2, carbs: 1, fried: true, sugary: false, processed: false },
      portion: "m",
    };
    const score = L.healthScore(sample.plate);
    let kcal = "";
    try {
      kcal = `${N.estimate(sample).kcal} kcal`;
    } catch (error) {
      kcal = "";
    }
    return `
      <figure class="sample-ticket" aria-label="Example of a logged meal: ${esc(sample.name)} at ${esc(sample.place)}, ${esc(money(sample.price))}, plate score ${score}, eaten with Rina">
        <figcaption class="eyebrow">Example · what one logged meal looks like</figcaption>
        <div class="ticket" aria-hidden="true">
          <img class="thumb" src="${plateThumb(sample, 144)}" alt="" width="72" height="72">
          <span>
            <span class="title">${esc(sample.name)}</span>
            <span class="meta"><span class="seg">12:30</span> · <span class="seg">${esc(sample.place)}</span> · <span class="seg">${esc(SOURCES[sample.source])}</span></span>
            <span class="tags">${sample.tastes.map((taste) => `<span class="tag">${esc(taste)}</span>`).join("")}<span class="tag">with Rina</span></span>
          </span>
          <span class="stub">
            <span class="price">${esc(money(sample.price))}</span>
            ${kcal ? `<span class="kcal mono">${esc(kcal)}</span>` : ""}
            ${scoreBadge(score)}
          </span>
        </div>
      </figure>`;
  }

  function emptyHtml() {
    return `
      <div class="empty">
        <canvas id="empty-plate" width="240" height="240" aria-hidden="true"></canvas>
        <h2>Your plate is empty</h2>
        <p>Log a meal in about 15 seconds: dish, place, price, and how the plate looked. Everything stays on this device.</p>
        ${sampleTicketHtml()}
        <ol class="unlocks" aria-label="What logging unlocks">
          <li><b class="mono">1 meal</b><span><span class="u-long">Your first shareable card</span><span class="u-short">Share card</span></span></li>
          <li><b class="mono">5 meals</b><span><span class="u-long">Your taste profile and plate score</span><span class="u-short">Taste profile</span></span></li>
          <li><b class="mono">10 meals</b><span><span class="u-long">Find your taste twins among friends</span><span class="u-short">Taste twins</span></span></li>
        </ol>
        <div class="btn-row">
          <button type="button" class="btn primary" data-action="log">Log your first meal</button>
          <button type="button" class="btn" data-sample>Try with a sample fortnight</button>
        </div>
      </div>`;
  }

  const PHONE_QUERY = "(max-width: 760px)";
  function isPhone() {
    return Boolean(window.matchMedia && window.matchMedia(PHONE_QUERY).matches);
  }

  function renderDiary() {
    const root = $("#view-diary");
    // on a phone the six taste chips sit behind one "Taste" chip so the row never runs off the edge mid-word
    const tastesOpen = state.tastesOpen || state.tasteFilter.length > 0;
    const filters = `
      <div class="chips filters${tastesOpen ? " tastes-open" : ""}" role="group" aria-label="Filter meals">
        ${["all", "out", "home", "delivery"].map((key) => `<button type="button" class="chip" data-source="${key}" aria-pressed="${state.sourceFilter === key}">${key === "all" ? "All" : key === "home" ? '<span class="lbl-long">Home-cooked</span><span class="lbl-short">Home</span>' : esc(SOURCES[key])}</button>`).join("")}
        <button type="button" class="chip taste-toggle" data-taste-toggle aria-expanded="${tastesOpen}">Taste${state.tasteFilter.length ? ` · ${state.tasteFilter.length}` : ""} <span aria-hidden="true">${tastesOpen ? "▴" : "▾"}</span></button>
        <span class="filter-break" aria-hidden="true"></span>
        ${TASTES.map((taste) => `<button type="button" class="chip" data-taste="${taste}" aria-pressed="${state.tasteFilter.includes(taste)}">${taste}</button>`).join("")}
      </div>`;
    const head = `
      <div class="view-head diary-head">
        <div>
          <h1>Your food diary</h1>
          <p>Search every meal by dish, place, taste or friend, and see how often, how much and how balanced.</p>
        </div>
      </div>`;
    if (!state.entries.length) {
      root.innerHTML = head + emptyHtml();
      const canvas = $("#empty-plate");
      drawPlate(canvas.getContext("2d"), 120, 120, 100, {}, "empty");
      return;
    }
    const list = filteredEntries();
    const groups = [];
    for (const entry of list) {
      const key = L.dayKey(entry.ts);
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        group = { key, entries: [] };
        groups.push(group);
      }
      group.entries.push(entry);
    }
    const plateKey = '<p class="plate-key">Plate score out of 100 · 75+ Balanced · 50+ Okay · under 50 Heavy</p>';
    const dayBlocks = groups.map((group, groupIndex) => {
      const spend = group.entries.reduce((sum, entry) => sum + (Number(entry.price) || 0), 0);
      const avg = Math.round(group.entries.reduce((sum, entry) => sum + L.healthScore(entry.plate), 0) / group.entries.length);
      return `
        <section class="day" aria-label="${esc(dayLabel(group.entries[0].ts))}">
          <div class="day-head">
            <h2>${esc(dayLabel(group.entries[0].ts))}</h2>
            <span class="mono day-sum"><span class="day-chip">${plural(group.entries.length, "meal")}</span> <span class="day-chip">${esc(money(spend))}</span> <span class="day-chip score ${scoreClass(avg)}" title="Plate score out of 100 · 75+ Balanced · 50+ Okay · under 50 Heavy">plate ${avg} <strong class="verdict">${L.healthLabel(avg)}</strong></span></span>
          </div>
          ${groupIndex === 0 ? plateKey : ""}
          ${groupIndex === 0 && !state.query ? dayPulseHtml(group) : ""}
          ${group.entries.map(ticketHtml).join("")}
        </section>`;
    });
    // meals lead; today's targets and the week line follow the first day, the bud nudge the second
    let leadHtml = "";
    let listHtml = '<p class="muted">No meals match these filters.</p>';
    if (dayBlocks.length && state.query) {
      listHtml = dayBlocks.join("");
    } else if (dayBlocks.length) {
      // r19: the latest day, its Today targets and the week line travel together as the lead block
      leadHtml = `${todayEmptyHtml()}<div class="lead-day">${dayBlocks[0]}${todayHtml()}${weekLineHtml()}</div>`;
      listHtml = dayBlocks.slice(1).map((block, index) => (index === 0 ? block + budNudgeHtml() : block)).join("");
      if (dayBlocks.length === 1) listHtml += budNudgeHtml();
    }
    // r19: on a phone the day you are living leads; the "On repeat" answer follows it. Desktop keeps the answer on top.
    const answer = answerHtml(state.query, list) || featuredAnswerHtml();
    const ordered = isPhone() ? leadHtml + answer + listHtml : answer + leadHtml + listHtml;
    const keepFocus = document.activeElement && document.activeElement.id === "q";
    const caret = keepFocus ? document.activeElement.selectionStart : null;
    root.innerHTML = `
      ${head}
      <div class="split">
        <div class="diary-col">
          <form class="search" role="search" onsubmit="return false">
            ${ICON_SEARCH}
            <label class="sr" for="q" style="position:absolute;left:-9999px">Search your meals</label>
            <input id="q" type="search" placeholder="Have I eaten this? Try “bakso”" value="${esc(state.query)}" autocomplete="off">
          </form>
          ${filters}
          ${dayBlocks.length && !state.query ? weekStripHtml() : ""}
          ${ordered}
        </div>
        ${weekAsideHtml()}
      </div>`;
    const weekPlate = $("#week-plate");
    if (weekPlate) drawPlate(weekPlate.getContext("2d"), 64, 64, 56, averagePlate(L.withinDays(state.entries, 7)), "week");
    if (keepFocus) {
      const input = $("#q");
      input.focus();
      input.setSelectionRange(caret, caret);
    }
  }

  /* ---------------- insights ---------------- */
  // r19: taste profile as a receipt tally (mono names, ticked bars, share of meals) instead of a generic radar
  function tasteTallyHtml(entries) {
    const total = Math.max(1, entries.length);
    const rows = TASTES
      .map((name) => ({ name, count: entries.filter((entry) => (entry.tastes || []).includes(name)).length }))
      .map((item) => ({ ...item, pct: Math.round((item.count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
    const max = Math.max(1, rows[0] ? rows[0].count : 1);
    const label = rows.map((item) => `${item.name} ${item.pct}%`).join(", ");
    return `<ol class="taste-tally" aria-label="Taste profile, share of meals: ${esc(label)}">${rows
      .map((item, index) => `<li class="${index < 2 && item.count ? "lead" : ""}"><span class="t-name">${esc(item.name)}</span><span class="t-bar" aria-hidden="true"><span style="width:${Math.round((item.count / max) * 100)}%"></span></span><span class="t-pct">${item.pct}%</span></li>`)
      .join("")}</ol><p class="tally-foot">% of meals tagged with each taste</p>`;
  }

  function tasteLeadHtml(vector) {
    const ranked = vector
      .map((value, index) => ({ name: TASTES[index], value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
    if (!ranked.length) return "";
    const lead = ranked.slice(0, 2).map((item) => item.name.toLowerCase()).join(" and ");
    return `<p class="taste-lead">Your plates lean <b>${esc(lead)}</b>.</p>`;
  }

  function barsHtml(items, max, label) {
    return `<div class="bars">${items.map((item) => `
      <div class="bar-row"><span>${esc(item.name)}</span><span class="track"><span class="fill" style="display:block;width:${Math.round((item.count / max) * 100)}%"></span></span><span class="n">${esc(label ? label(item) : String(item.count))}</span></div>`).join("")}</div>`;
  }

  // the day's plate: average portions of everything eaten that day
  function averagePlate(meals) {
    if (!meals.length) return {};
    const mean = (key) => Math.round(meals.reduce((sum, meal) => sum + ((meal.plate || {})[key] || 0), 0) / meals.length);
    return {
      veg: mean("veg"),
      protein: mean("protein"),
      carbs: mean("carbs"),
      sugary: meals.some((meal) => (meal.plate || {}).sugary),
      fried: meals.some((meal) => (meal.plate || {}).fried),
    };
  }

  function renderInsights() {
    const root = $("#view-insights");
    const period = state.period;
    const entries = period ? L.withinDays(state.entries, period) : state.entries.slice();
    const spend = L.spendSummary(entries);
    const avg = entries.length ? Math.round(entries.reduce((sum, entry) => sum + L.healthScore(entry.plate), 0) / entries.length) : 0;
    const variety = L.varietyScore(entries);
    const cuisines = L.topCuisines(entries, 6);
    const places = L.topPlaces(entries, 5);
    const onRepeat = L.repeats(entries, 2).slice(0, 4);
    const seg = `<div class="seg" role="group" aria-label="Period">${[[7, "7 days"], [30, "30 days"], [0, "All"]].map(([value, label]) => `<button type="button" data-period="${value}" aria-pressed="${period === value}">${label}</button>`).join("")}</div>`;

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = L.dayKey(date);
      const meals = state.entries.filter((entry) => L.dayKey(entry.ts) === key);
      const score = meals.length ? Math.round(meals.reduce((sum, entry) => sum + L.healthScore(entry.plate), 0) / meals.length) : 0;
      days.push({ label: date.toLocaleDateString(undefined, { weekday: "short" }), score, meals: meals.length, plate: averagePlate(meals) });
    }
    const strip = `<div class="plate-week" role="img" aria-label="Plate score per day, last 7 days: ${days.map((day) => (day.meals ? day.score : "no meals")).join(", ")}">${days.map((day) => `<div class="pday"><img src="${plateThumb({ name: day.label + day.score, plate: day.plate }, 96)}" alt="" width="44" height="44"><b class="${day.meals ? scoreClass(day.score) : "none"}">${day.meals ? day.score : "–"}</b><span>${esc(day.label)}</span></div>`).join("")}</div>`;

    const top = cuisines[0];
    const share = top && entries.length ? Math.round((top.count / entries.length) * 100) : 0;
    let tip = "";
    if (top && share >= 45) {
      const mine = new Set(cuisines.map((item) => item.name));
      const bud = PEOPLE.find((person) => state.friends.includes(person.id) && person.cuisines.some((cuisine) => !mine.has(cuisine)));
      const fresh = bud ? bud.cuisines.find((cuisine) => !mine.has(cuisine)) : null;
      tip = `<p class="notice">${esc(top.name)} was ${share}% of your meals.${bud ? ` ${esc(bud.name)} likes ${esc(fresh)}: <a href="#buds">ask them out</a>.` : ""}</p>`;
    }

    if (!state.entries.length) {
      root.innerHTML = `<div class="view-head"><div><h1>Insights</h1><p>Log a few meals and this page fills in: variety, plate score, spend and your taste profile.</p></div></div>${emptyHtml()}`;
      drawPlate($("#empty-plate").getContext("2d"), 120, 120, 100, {}, "empty");
      return;
    }

    root.innerHTML = `
      <div class="view-head">
        <div><h1>Insights</h1><p>How varied, how balanced and how much. Every number comes from the meals you logged.</p></div>
        <div class="btn-row">${seg}<button type="button" class="btn primary" data-share-week>Share my week</button></div>
      </div>
      <div class="grid-2">
        <section class="panel">
          <p class="eyebrow">${period ? `Last ${period} days` : "All time"} · ${entries.length} meals</p>
          <h2>Summary</h2>
          <div class="stat-grid">
            <div class="stat"><div class="label">Variety score</div><div class="value">${variety}</div><div class="note">0 = same meal every time</div></div>
            <div class="stat"><div class="label">Avg plate score</div><div class="value">${avg}</div><div class="note">${esc(L.healthLabel(avg))}</div></div>
            <div class="stat"><div class="label">Total spend</div><div class="value money">${esc(money(spend.total))}</div><div class="note">${esc(money(spend.perMeal))} per meal</div></div>
            <div class="stat"><div class="label">Home-cooked</div><div class="value">${entries.filter((entry) => entry.source === "home").length}</div><div class="note">${esc(money(spend.home))} spent at home</div></div>
          </div>
          ${tip}
        </section>
        <section class="panel">
          <p class="eyebrow">Last 7 days</p>
          <h2>Plate score by day</h2>
          <details class="score-rule"><summary><span>75+ Balanced · 50+ Okay · under 50 Heavy</span><span class="score-rule-how"><span class="srh-i" aria-hidden="true">i</span>How it's scored</span></summary><p>Veg and protein add points; deep-fried, sugary and processed take points off. A nudge, not medical advice.</p></details>
          ${strip}
        </section>
        <section class="panel">
          <h2>Taste profile</h2>
          ${tasteLeadHtml(L.tasteVector(entries))}
          ${tasteTallyHtml(entries)}
        </section>
        <section class="panel">
          <h2>Cuisines</h2>
          ${cuisines.length ? barsHtml(cuisines, cuisines[0].count) : '<p class="muted">No meals in this period.</p>'}
          ${onRepeat.length ? `<h3 style="margin-top:20px">On repeat · ${period ? `last ${period} days` : "all time"}</h3><p>${onRepeat.map((item) => `${esc(item.name)} <span class="mono">×${item.count}</span>`).join(" · ")}</p>` : ""}
        </section>
        <section class="panel">
          <h2>Top places</h2>
          ${places.length ? `<div class="place-list">${places.map((place) => `<div class="person" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="name">${esc(place.name)}</div><div class="why">${place.count} ${place.count === 1 ? "visit" : "visits"} · ${esc(place.cuisines.join(", "))}</div></div><span class="mono">${esc(money(place.spend))}</span></div>`).join("")}</div>` : '<p class="muted">No places yet.</p>'}
        </section>
        <section class="panel">
          <h2>Where the money went</h2>
          ${barsHtml(Object.keys(SOURCES).map((key) => ({ name: SOURCES[key], count: Math.round(spend[key] / 1000) })), Math.max(1, Math.round(Math.max(spend.out, spend.home, spend.delivery) / 1000)), (item) => compactMoney(item.count * 1000))}
          ${spendSplitHtml(spend)}
          <p class="notice">Exact: out ${esc(money(spend.out))}, home ${esc(money(spend.home))}, delivery ${esc(money(spend.delivery))}.</p>
        </section>
      </div>`;
  }

  // r26: one stacked bar for the share of spend by source, so the money card reads at a glance
  function spendSplitHtml(spend) {
    const total = spend.out + spend.home + spend.delivery;
    if (!total) return "";
    const parts = Object.keys(SOURCES)
      .map((key) => ({ key, name: SOURCES[key], pct: Math.round((spend[key] / total) * 100) }))
      .filter((part) => part.pct > 0);
    const lead = parts.slice().sort((a, b) => b.pct - a.pct)[0];
    return `<div class="spend-split" role="img" aria-label="${parts.map((part) => `${esc(part.name)} ${part.pct}%`).join(", ")}">
        ${parts.map((part) => `<span class="split-${part.key}" style="flex:${part.pct}"></span>`).join("")}
      </div>
      <p class="spend-split-key">${parts.map((part) => `<span><i class="split-${part.key}"></i>${esc(part.name)} <b class="mono">${part.pct}%</b></span>`).join("")}</p>
      <p class="spend-split-lead"><b>${lead.pct}%</b> of your food money went to ${esc(lead.name.toLowerCase())}.</p>`;
  }

  /* ---------------- taste buds ---------------- */
  function matchFor(person) {
    const myVector = L.tasteVector(state.entries);
    return L.matchScore(myVector, myCuisines(), person.tastes, person.cuisines);
  }

  function reasonsFor(person) {
    const myVector = L.tasteVector(state.entries);
    const tastes = TASTES.filter((taste, index) => myVector[index] >= 0.5 && person.tastes[index] >= 0.5).slice(0, 2);
    const mine = myCuisines();
    const cuisines = person.cuisines.filter((cuisine) => mine.includes(cuisine)).slice(0, 2);
    const both = tastes.concat(cuisines);
    return both.length ? `You both like ${both.join(", ")}` : "Different tastes: good for trying new food";
  }

  // one concrete, shared thing per bud: where you two actually eat (and what), else a place of yours in a cuisine they like
  function spotFor(person) {
    const together = state.entries.filter((entry) => (entry.friends || []).includes(person.id) && entry.place);
    if (together.length) {
      const place = L.topPlaces(together, 1)[0];
      const dishes = {};
      for (const entry of together.filter((item) => L.normalize(item.place) === L.normalize(place.name))) {
        const key = L.normalize(entry.name);
        dishes[key] = dishes[key] || { name: entry.name, count: 0 };
        dishes[key].count += 1;
      }
      const dish = Object.values(dishes).sort((a, b) => b.count - a.count)[0];
      return `Your spot: ${place.name}\u00a0·\u00a0${dish.name}${dish.count > 1 ? `\u00a0×${dish.count}` : ""}`;
    }
    const place = L.topPlaces(state.entries, 20).find((item) => !/^home$/i.test(item.name) && item.cuisines.some((cuisine) => person.cuisines.includes(cuisine)));
    if (!place) return "";
    const cuisine = place.cuisines.find((item) => person.cuisines.includes(item));
    return `Try ${place.name} together\u00a0·\u00a0they like ${cuisine}`;
  }

  // r24: each bud wears a ring in their strongest taste's colour, so a glance says who likes what
  const TASTE_RING = { Spicy: "#c2381c", Sweet: "#c9558f", Sour: "#9aa81c", Salty: "#3f74a3", Umami: "#7a4a24", Rich: "#d1901a" };
  function topTaste(person) {
    if (!person.tastes || !person.tastes.length) return null;
    let best = 0;
    person.tastes.forEach((value, index) => {
      if (value > person.tastes[best]) best = index;
    });
    return TASTES[best] || null;
  }
  function avatar(person) {
    const taste = topTaste(person);
    const ring = taste ? `;--ring:${TASTE_RING[taste]}` : "";
    return `<span class="avatar${taste ? " ringed" : ""}" style="background:${person.color}${ring}"${taste ? ` data-taste="${taste}"` : ""} aria-hidden="true">${esc(person.name[0])}</span>`;
  }

  // a taste profile needs a few meals; before that a match % would be noise
  const MIN_MEALS_FOR_MATCH = 3;
  function hasTasteProfile() {
    return state.entries.length >= MIN_MEALS_FOR_MATCH;
  }

  function matchLabel(match) {
    return hasTasteProfile() ? `${match}% match` : "match after 3 meals";
  }

  function inviteHtml() {
    return `
      <section class="panel invite-card">
        <h2>Bring a real friend</h2>
        <p class="muted">Send a link with your taste profile: six taste weights and your top cuisines, never your meals. When your friend opens it, Lahap adds you as their bud and shows how close your tastes are.</p>
        <button type="button" class="btn primary" data-invite>Invite a friend</button>
      </section>`;
  }

  // invite links carry a taste profile only (name, 6 taste weights, top cuisines) as base64url JSON
  const INVITE_COLORS = ["#7a3e1d", "#2f5d50", "#5b3f6b", "#3d5a80", "#6b5a2e"];

  function encodeBud(profile) {
    const bytes = new TextEncoder().encode(JSON.stringify(profile));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeBud(code) {
    try {
      const binary = atob(String(code).replace(/-/g, "+").replace(/_/g, "/"));
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const data = JSON.parse(new TextDecoder().decode(bytes));
      if (!Array.isArray(data.t) || data.t.length !== TASTES.length) return null;
      const tastes = data.t.map((value) => Math.max(0, Math.min(1, Number(value) || 0)));
      const name = String(data.n || "").trim().slice(0, 24) || "Your friend";
      const cuisines = Array.isArray(data.c) ? data.c.map((item) => String(item).slice(0, 30)).slice(0, 4) : [];
      return { name, tastes, cuisines };
    } catch (error) {
      return null;
    }
  }

  function inviteLink() {
    const vector = L.tasteVector(state.entries).map((value) => Math.round(value * 10) / 10);
    const code = encodeBud({ n: state.settings.name || "", t: vector, c: myCuisines().slice(0, 3) });
    return `https://juw12.github.io/lahap/?bud=${code}#buds`;
  }

  function budFromInvite(profile) {
    let hash = 0;
    for (const char of profile.name + profile.tastes.join(",") + profile.cuisines.join(",")) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    hash = Math.abs(hash);
    return { id: "inv" + hash.toString(36), name: profile.name, area: "invited you", color: INVITE_COLORS[hash % INVITE_COLORS.length], tastes: profile.tastes, cuisines: profile.cuisines, invited: true };
  }

  function tasteSummary(person) {
    const liked = TASTES.filter((taste, index) => person.tastes[index] >= 0.5).slice(0, 3);
    const parts = [];
    if (liked.length) parts.push(`likes ${liked.join(", ")}`);
    if (person.cuisines.length) parts.push(person.cuisines.slice(0, 3).join(", "));
    return parts.join(" · ") || "no meals logged yet";
  }

  function incomingInviteHtml() {
    const profile = state.pendingBud;
    if (!profile) return "";
    const person = budFromInvite(profile);
    return `
      <section class="panel invite-in">
        <span class="eyebrow">Invite</span>
        <h2>${esc(person.name)} wants to compare tastes</h2>
        <p class="muted">${esc(person.name)} ${esc(tasteSummary(person))}. ${hasTasteProfile() ? `You are a ${matchFor(person)}% match.` : "Log 3 meals to see your match."}</p>
        <div class="btn-row"><button type="button" class="btn primary" data-accept-bud>Add ${esc(person.name)} as a bud</button><button type="button" class="btn ghost" data-dismiss-bud>Not now</button></div>
      </section>`;
  }

  // early state: no buds yet, so point at the one action that starts the loop
  function earlyBudsCardHtml() {
    return `
      <section class="panel next-level-card">
        <span class="eyebrow">Next step</span>
        <h2>Add your first bud</h2>
        <p class="muted">Send your invite link to a friend. When they open it you two are buds, and a tagged meal earns +${L.POINTS.tag} connection pts.</p>
        <div class="btn-row"><button type="button" class="btn primary" data-invite>Invite a friend</button></div>
      </section>`;
  }

  // a one-tap next step: pick the bud closest to their next level and surface it
  // the bud closest to their next level; the Next level card features them
  function closestToNextLevel(friends) {
    return friends
      .map((person) => ({ person, level: L.levelFor(state.points[person.id] || 0) }))
      .filter((item) => item.level.next)
      .sort((a, b) => b.level.progress - a.level.progress)[0] || null;
  }

  function nextLevelCardHtml(friends) {
    if (!friends.length) return "";
    const closest = closestToNextLevel(friends);
    if (!closest) return "";
    const { person, level } = closest;
    return `
      <section class="panel next-level-card">
        <span class="eyebrow">Next level</span>
        <h2>${level.toNext} pts to ${esc(level.next)}</h2>
        <p class="muted">Tag ${esc(person.name)} in your next meal to get there.</p>
        <div class="level next-level-progress" role="progressbar" aria-label="Progress to ${esc(level.next)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(level.progress * 100)}"><div class="track"><div class="fill" style="width:${Math.round(level.progress * 100)}%"></div></div><span class="mono level-caption">${esc(level.name)} → ${esc(level.next)} · ${Math.round(level.progress * 100)}%</span></div>
        <div class="btn-row"><button type="button" class="btn primary" data-tag-meal="${esc(person.id)}">Tag a meal with ${esc(person.name)}</button></div>
      </section>`;
  }

  async function removeFriend(id) {
    const person = PEOPLE.find((p) => p.id === id);
    const name = person ? person.name : "this bud";
    if (!confirm(`Remove ${name} from your buds? Your past meals stay tagged, but they won't count for points anymore.`)) return;
    state.friends = state.friends.filter((x) => x !== id);
    delete state.points[id];
    // invited buds live in the people store; drop them so they don't reappear after reload
    const people = PEOPLE.filter((p) => p.id !== id);
    PEOPLE.length = 0;
    PEOPLE.push(...people);
    await store.set("people", PEOPLE.filter((item) => item.invited));
    await saveMeta();
    toast(`${name} removed`);
    render();
  }

  function renderBuds() {
    const root = $("#view-buds");
    // the subtitle promises "ranked by how close their taste is", so the list honours it
    const friends = PEOPLE.filter((person) => state.friends.includes(person.id))
      .sort((a, b) => matchFor(b) - matchFor(a));
    const others = PEOPLE.filter((person) => !state.friends.includes(person.id))
      .map((person) => ({ person, match: matchFor(person) }))
      .sort((a, b) => b.match - a.match);
    // header total must equal the rows shown below it: only current buds count
    // the featured bud's progress already sits in the Next level card, so their row doesn't repeat it
    const featured = closestToNextLevel(friends);
    const featuredId = featured ? featured.person.id : null;
    const totalPoints = friends.reduce((sum, person) => sum + (state.points[person.id] || 0), 0);
    const invites = state.invites.slice().sort((a, b) => new Date(a.when) - new Date(b.when));

    root.innerHTML = `
      <div class="view-head">
        <div><h1>Taste buds</h1><p>Friends ranked by how close their taste is to yours. Tag them in meals and eat together to grow the connection.</p></div>
        <button type="button" class="btn primary view-head-cta" data-invite>Invite a friend</button>
      </div>
      <div class="split buds-split">
        <div>
          ${budsStripHtml(friends)}
          ${incomingInviteHtml()}
          ${friends.length ? nextLevelCardHtml(friends) : earlyBudsCardHtml()}
          <section class="panel">
            <div class="panel-head"><h2>Your buds</h2>${totalPoints ? `<span class="pts mono">${totalPoints} connection pts</span>` : ""}</div>
            ${friends.length ? '<p class="buds-legend"><b>Match %</b> is how alike your tastes are, from what you both log. <b>Connection pts</b> come from meals and makan together; they raise your level.</p>' : ""}
            ${friends.length ? friends.map((person) => {
              const points = state.points[person.id] || 0;
              const level = L.levelFor(points);
              return `<div class="person">${avatar(person)}<div><div class="name">${esc(person.name)} <span class="match">${matchLabel(matchFor(person))}</span></div><div class="why">${esc(level.name)} · ${points} pts · ${esc(lastTogether(person.id))}</div>${spotFor(person) ? `<div class="spot">${esc(spotFor(person))}</div>` : ""}${pendingPlanHtml(person.id)}${person.id === featuredId ? `<div class="featured-note">Next level shown above</div>` : `${level.next ? `<div class="next-step">${esc(nextStep(level))}</div>` : ""}<div class="level"><div class="track"><div class="fill" style="width:${Math.round(level.progress * 100)}%"></div></div></div>`}</div><div class="person-actions"><button type="button" class="btn small" data-hangout="${person.id}" aria-label="Plan makan with ${esc(person.name)}">Plan makan</button><button type="button" class="person-remove" data-remove="${person.id}" aria-label="Remove ${esc(person.name)}" title="Remove ${esc(person.name)}">Remove</button></div></div>`;
            }).join("") : '<p class="muted">No buds yet. Invite a friend, or add an example profile below to try tagging and hangouts.</p>'}
          </section>
          <details class="panel suggested-panel suggested-fold"${isPhone() ? " open" : ""}>
            <summary><h2>${hasTasteProfile() ? "Demo matches · suggested by taste" : "Example buds to try"}</h2><span class="demo-badge" aria-hidden="true">Demo</span></summary>
            <p class="muted small panel-sub suggested-why">${hasTasteProfile() ? "Example profiles, ranked by how close their tastes are to the meals you logged. Worked out on this phone; nothing is uploaded. Real friends join through your invite link." : "Example profiles to try tagging and hangouts. Log a few meals and they get ranked by taste."}</p>
            ${others.length ? others.map(({ person, match }) => `<div class="person">${avatar(person)}<div><div class="name">${esc(person.name)} <span class="match">${matchLabel(match)}</span></div><div class="why">${esc(hasTasteProfile() ? reasonsFor(person) : "Log a few meals to see what you share")} · ${esc(person.area)}</div>${hasTasteProfile() && spotFor(person) ? `<div class="spot">${esc(spotFor(person))}</div>` : ""}</div><button type="button" class="btn" data-add="${person.id}" aria-label="Add ${esc(person.name)} as a bud on this device">Add bud</button></div>`).join("") : '<p class="muted">You added everyone. Nice.</p>'}
            <p class="notice">These are example profiles so you can try matching, tagging and hangouts. Lahap has no server yet: buds and points stay on this device, and invites go out through WhatsApp or your phone's share sheet.</p>
          </details>
        </div>
        <aside>
          <section class="panel plans-panel">
            <h2>Plan makan</h2>
            ${invites.length ? invites.map((invite) => {
              const person = personById(invite.friend) || { name: "?" };
              const when = new Date(invite.when).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
              return `<div class="invite"><strong>${esc(person.name)} · ${esc(invite.place || "somewhere new")}</strong><span class="muted small">${esc(when)} · ${invite.done ? "eaten together" : "planned"}</span>${invite.done ? "" : `<div class="btn-row"><button type="button" class="btn" data-done="${esc(invite.id)}">We went: +${L.POINTS.hangout} pts</button><button type="button" class="btn ghost" data-cancel="${esc(invite.id)}">Cancel</button></div>`}</div>`;
            }).join("") : suggestedPlanHtml(friends)}
          </section>
          <section class="panel">
            <h2>How points work</h2>
            <table class="breakdown">
              <tr><td>Tag a bud in a meal</td><td>+${L.POINTS.tag}</td></tr>
              <tr><td>Plan makan and mark “We went”</td><td>+${L.POINTS.hangout}</td></tr>
              ${L.LEVELS.slice(1).map((level) => `<tr><td>${esc(level.name)}</td><td>${level.min} pts</td></tr>`).join("")}
            </table>
          </section>
          ${inviteHtml()}
        </aside>
      </div>`;
  }

  // r20: on a phone the buds themselves show above the fold - a one-line ledger of who, ranked by taste match
  function budsStripHtml(friends) {
    if (!friends.length) return "";
    const shown = friends.slice(0, 5);
    const more = friends.length - shown.length;
    return `<section class="buds-strip" aria-label="Your buds">
      <p class="buds-strip-head"><span class="eyebrow">Your buds · ${friends.length}</span><span class="mono">by match · ring = top taste</span></p>
      <ul>${shown.map((person) => `<li>${avatar(person)}<span class="buds-strip-name">${esc(person.name)}</span><span class="mono">${hasTasteProfile() ? matchFor(person) + "%" : "–"}</span></li>`).join("")}${more > 0 ? `<li class="buds-strip-more mono">+${more}</li>` : ""}</ul>
    </section>`;
  }

  // "last makan today" / "... 3 days ago" / "no meals together yet" - a reason to come back
  function lastTogether(personId) {
    const shared = state.entries.filter((entry) => (entry.friends || []).includes(personId));
    if (!shared.length) return "no meals together yet";
    const latest = Math.max(...shared.map((entry) => new Date(entry.ts).getTime()));
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const days = Math.max(0, Math.ceil((startOfToday - latest) / 86400000));
    if (days === 0) return "last makan today";
    if (days === 1) return "last makan yesterday";
    return `last makan ${days} days ago`;
  }

  function pendingPlanHtml(personId) {
    const plan = state.invites.find((invite) => invite.friend === personId && !invite.done);
    if (!plan) return "";
    const when = new Date(plan.when).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return `<div class="plan-pending">Planned: ${esc(when)} · ${esc(plan.place || "somewhere new")}. Mark \u201cWe went\u201d after for +${L.POINTS.hangout}.</div>`;
  }

  // e.g. "Regular in 40 pts: 1 hangout + 2 tagged meals"
  function nextStep(level) {
    const hangouts = Math.floor(level.toNext / L.POINTS.hangout);
    const tags = Math.ceil((level.toNext - hangouts * L.POINTS.hangout) / L.POINTS.tag);
    const parts = [];
    if (hangouts) parts.push(`${hangouts} makan together`);
    if (tags) parts.push(`${tags} tagged meal${tags > 1 ? "s" : ""}`);
    return `${level.toNext} pts to ${level.next}: ${parts.join(" + ")}`;
  }

  function suggestedPlanHtml(friends) {
    const best = friends.map((person) => ({ person, match: matchFor(person) })).sort((a, b) => b.match - a.match)[0];
    if (!best) return '<p class="muted">No plans yet. Add a bud first.</p>';
    const place = L.topPlaces(state.entries, 20).find((item) => item.name !== "Home" && item.cuisines.some((cuisine) => best.person.cuisines.includes(cuisine)));
    return `<div class="invite suggested"><span class="eyebrow">Suggested</span><strong>Makan with ${esc(best.person.name)}${place ? " at " + esc(place.name) : ""}</strong><span class="muted small">${best.match}% match. ${esc(reasonsFor(best.person))}.</span><div class="btn-row"><button type="button" class="btn primary" data-hangout="${best.person.id}">${place ? "Plan makan at " + esc(place.name) : "Plan makan with " + esc(best.person.name)}</button></div></div>`;
  }

  // the bud closest to their next level, for the log form nudge
  function closestBudNudge() {
    const candidates = PEOPLE.filter((person) => state.friends.includes(person.id))
      .map((person) => ({ person, level: L.levelFor(state.points[person.id] || 0) }))
      .filter((item) => item.level.next)
      .sort((a, b) => a.level.toNext - b.level.toNext);
    if (!candidates.length) return "";
    const { person, level } = candidates[0];
    return `Tag ${person.name}: +${L.POINTS.tag} pts, ${level.toNext} to ${level.next}`;
  }

  async function addFriend(id) {
    if (!state.friends.includes(id)) state.friends.push(id);
    await saveMeta();
    toast(`${personById(id).name} added to your buds`);
    render();
  }

  function nextWeekend() {
    const date = new Date();
    const add = (6 - date.getDay() + 7) % 7 || 7;
    date.setDate(date.getDate() + add);
    date.setHours(12, 30, 0, 0);
    return date;
  }

  function openHangout(id) {
    const person = personById(id);
    const dialog = $("#dlg-hangout");
    const shared = L.topPlaces(state.entries, 20).filter((place) => place.name !== "Home" && place.cuisines.some((cuisine) => person.cuisines.includes(cuisine))).slice(0, 3);
    const fallback = L.topPlaces(state.entries, 6).filter((place) => place.name !== "Home").slice(0, 3);
    const places = shared.length ? shared : fallback;
    const match = matchFor(person);
    dialog.innerHTML = `
      <form method="dialog" id="hangout-form">
        <div class="sheet-head"><h2 id="hangout-title">Makan with ${esc(person.name)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${ICON_CLOSE}</button></div>
        <div class="sheet-body">
          <p class="muted" style="margin-bottom:16px">${match}% taste match. ${esc(reasonsFor(person))}.</p>
          <label class="field"><span>Where</span><input type="text" name="place" value="${esc(places[0] ? places[0].name : "")}" list="hangout-places" required></label>
          <datalist id="hangout-places">${L.topPlaces(state.entries, 12).map((place) => `<option value="${esc(place.name)}">`).join("")}</datalist>
          ${places.length ? `<div class="suggest" style="margin:-8px 0 16px">${places.map((place) => `<button type="button" data-pick-place="${esc(place.name)}">${esc(place.name)}</button>`).join("")}</div>` : ""}
          <label class="field"><span>When</span><input type="datetime-local" name="when" value="${localInputValue(nextWeekend())}" required></label>
          <label class="field"><span>Message</span><textarea name="message" rows="4"></textarea></label>
        </div>
        <div class="sheet-foot">
          <a class="btn" id="hangout-wa" target="_blank" rel="noopener">WhatsApp</a>
          <button type="button" class="btn" id="hangout-copy">Copy</button>
          <button type="submit" class="btn primary">Save plan</button>
        </div>
      </form>`;
    const form = $("#hangout-form");
    const updateMessage = () => {
      const when = new Date(form.when.value);
      const label = isNaN(when) ? "" : when.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      form.message.value = `Hi ${person.name}! Lahap says our tastes are a ${match}% match. Makan together at ${form.place.value || "a new place"} on ${label}?`;
      $("#hangout-wa").href = `https://wa.me/?text=${encodeURIComponent(form.message.value)}`;
    };
    updateMessage();
    form.place.addEventListener("input", updateMessage);
    form.when.addEventListener("input", updateMessage);
    form.message.addEventListener("input", () => {
      $("#hangout-wa").href = `https://wa.me/?text=${encodeURIComponent(form.message.value)}`;
    });
    dialog.addEventListener("click", (event) => {
      const pick = event.target.closest("[data-pick-place]");
      if (pick) {
        form.place.value = pick.dataset.pickPlace;
        updateMessage();
      }
    });
    $("#hangout-copy").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(form.message.value);
        toast("Message copied");
      } catch (error) {
        form.message.select();
        toast("Select and copy the message");
      }
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.invites.push({ id: uid(), friend: id, place: form.place.value.trim(), when: new Date(form.when.value).toISOString(), done: false });
      await saveMeta();
      dialog.close();
      toast(`Plan saved with ${person.name}`);
      render();
    });
    dialog.showModal();
  }

  async function inviteDone(inviteId) {
    const invite = state.invites.find((item) => item.id === inviteId);
    if (!invite) return;
    invite.done = true;
    state.points[invite.friend] = (state.points[invite.friend] || 0) + L.POINTS.hangout;
    await saveMeta();
    toast(`+${L.POINTS.hangout} with ${personById(invite.friend).name}. Log what you ate?`);
    render();
    openLog({ place: invite.place, friends: [invite.friend], ts: invite.when });
  }

  /* ---------------- me ---------------- */
  function renderMe() {
    const root = $("#view-me");
    const photos = state.entries.filter((entry) => entry.photo).length;
    root.innerHTML = `
      <div class="view-head"><div><h1>Profile</h1><p>Your goal, your settings and your data. It all lives in this browser: no account, no server, no ads.</p></div></div>
      <div class="grid-2">
        ${goalPanelHtml()}
        <section class="panel">
          <h2>Settings</h2>
          <label class="field"><span>Your name <span class="hint">shown on share cards</span></span><input type="text" id="set-name" value="${esc(state.settings.name)}" placeholder="e.g. Juwen" autocomplete="nickname"></label>
          <label class="field"><span>Currency</span><select id="set-currency">${CURRENCIES.map((code) => `<option ${code === state.settings.currency ? "selected" : ""}>${code}</option>`).join("")}</select></label>
        </section>
        <section class="panel">
          <h2>Your data</h2>
          <p class="muted" style="margin-bottom:16px">${state.entries.length} meals, ${photos} photos, ${state.friends.length} buds, ${state.invites.length} plans.</p>
          <div class="btn-row">
            <button type="button" class="btn" id="export">Export backup (JSON)</button>
            <label class="btn" for="import">Import backup</label>
            <input type="file" id="import" accept="application/json" hidden>
            <button type="button" class="btn" data-sample>Load sample fortnight</button>
            <button type="button" class="btn danger" id="erase">Erase everything</button>
          </div>
          <p class="notice">Photos are resized to 1080 px and kept in this browser's storage. They leave your device only when you share a card.</p>
        </section>
      </div>`;
    $("#set-name").addEventListener("change", async (event) => {
      state.settings.name = event.target.value.trim();
      await saveMeta();
      toast("Name saved");
    });
    $("#set-currency").addEventListener("change", async (event) => {
      state.settings.currency = event.target.value;
      await saveMeta();
      toast(`Prices now shown in ${state.settings.currency}`);
    });
    $("#export").addEventListener("click", () => {
      const data = { app: "lahap", version: 1, exportedAt: new Date().toISOString(), settings: state.settings, friends: state.friends, points: state.points, invites: state.invites, entries: state.entries };
      download(new Blob([JSON.stringify(data)], { type: "application/json" }), `lahap-backup-${L.dayKey(new Date())}.json`);
    });
    $("#import").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.app !== "lahap" || !Array.isArray(data.entries)) throw new Error("Not a Lahap backup");
        for (const entry of data.entries) await store.put(entry);
        const known = new Set(state.entries.map((entry) => entry.id));
        state.entries = state.entries.concat(data.entries.filter((entry) => !known.has(entry.id)));
        state.settings = Object.assign(state.settings, data.settings || {});
        state.friends = Array.from(new Set(state.friends.concat(data.friends || [])));
        state.points = Object.assign({}, data.points || {}, state.points);
        state.invites = state.invites.concat((data.invites || []).filter((invite) => !state.invites.some((item) => item.id === invite.id)));
        await saveMeta();
        toast(`Imported ${data.entries.length} meals`);
        render();
      } catch (error) {
        toast(`Import failed: ${error.message}`);
      }
    });
    $("#erase").addEventListener("click", async () => {
      if (!confirm("Erase every meal, photo, bud and plan on this device? Export a backup first if you want to keep them.")) return;
      await store.clear();
      state.entries = [];
      state.friends = [];
      state.points = {};
      state.invites = [];
      state.settings.profile = null;
      state.settings.quizSeen = false;
      await saveMeta();
      toast("Everything erased");
      render();
    });
  }


  /* ---------------- start quiz ---------------- */
  const DIETS = [["vegetarian", "Vegetarian"], ["noBeef", "No beef"], ["noSeafood", "No seafood"], ["noNuts", "No nuts"], ["noDairy", "No dairy"], ["noEgg", "No egg"], ["noGluten", "No gluten"]];
  const ACTIVITY_LABELS = {
    low: ["Mostly sitting", "Desk job, little walking"],
    light: ["Lightly active", "Daily walks, 1-2 workouts a week"],
    active: ["Active", "3-5 workouts a week"],
    very: ["Very active", "Physical job or training every day"],
  };
  const GOAL_HINTS = {
    lose: "Plates that fill you up for fewer calories",
    maintain: "Stay where you are and eat well",
    gain: "More energy and bigger plates",
    muscle: "Protein first, to go with training",
    healthy: "More veg, less fried and sugary",
  };
  const QUIZ_STEPS = 5;

  function openQuiz() {
    const dialog = $("#dlg-quiz");
    const answers = Object.assign(
      { goal: "healthy", sex: "", age: "", height: "", weight: "", activity: "light", diet: {}, cookMinutes: 30 },
      JSON.parse(JSON.stringify(state.settings.profile || {}))
    );
    let step = 0;

    function stepHtml() {
      if (step === 0) {
        return `
          <h3 class="quiz-q">What do you want from your food?</h3>
          <div class="options">${Object.entries(N.GOALS).map(([key, goal]) => `<button type="button" class="option" data-quiz-goal="${key}" aria-pressed="${answers.goal === key}"><strong>${esc(goal.label)}</strong><span>${esc(GOAL_HINTS[key])}</span></button>`).join("")}</div>`;
      }
      if (step === 1) {
        return `
          <h3 class="quiz-q">A little about you</h3>
          <p class="muted small">Only used to size your daily targets. It never leaves this device.</p>
          <div class="field"><span>Body</span>${segHtml("sex", [["f", "Female"], ["m", "Male"]], answers.sex)}</div>
          <div class="row three">
            <label class="field"><span>Age</span><input type="number" inputmode="numeric" id="quiz-age" min="14" max="100" value="${esc(answers.age)}" placeholder="30"></label>
            <label class="field"><span>Height, cm</span><input type="number" inputmode="numeric" id="quiz-height" min="120" max="230" value="${esc(answers.height)}" placeholder="165"></label>
            <label class="field"><span>Weight, kg</span><input type="number" inputmode="decimal" id="quiz-weight" min="30" max="250" step="any" value="${esc(answers.weight)}" placeholder="60"></label>
          </div>`;
      }
      if (step === 2) {
        return `
          <h3 class="quiz-q">How active is a normal week?</h3>
          <div class="options">${Object.entries(ACTIVITY_LABELS).map(([key, [label, hint]]) => `<button type="button" class="option" data-quiz-activity="${key}" aria-pressed="${answers.activity === key}"><strong>${label}</strong><span>${hint}</span></button>`).join("")}</div>
          <div class="field" style="margin-top:16px"><span>Time to cook on a weekday</span>${segHtml("cook", [[15, "15 min"], [30, "30 min"], [60, "An hour"]], answers.cookMinutes)}</div>`;
      }
      if (step === 3) {
        return `
          <h3 class="quiz-q">Anything you do not eat?</h3>
          <p class="muted small">The Lab leaves these out of every recipe.</p>
          <div class="chips">${DIETS.map(([key, label]) => `<label class="chip"><input type="checkbox" name="diet" value="${key}" ${answers.diet[key] ? "checked" : ""}><span>${label}</span></label>`).join("")}</div>`;
      }
      const target = N.targets(answers);
      const goal = N.GOALS[answers.goal] || N.GOALS.healthy;
      const missing = !answers.sex || !answers.age || !answers.height || !answers.weight;
      return `
        <h3 class="quiz-q">Your daily targets</h3>
        <dl class="macros big">
          <div><dt>Energy</dt><dd>${target.kcal}<small> kcal</small></dd></div>
          <div><dt>Protein</dt><dd>${target.protein}<small> g</small></dd></div>
          <div><dt>Carbs</dt><dd>${target.carbs}<small> g</small></dd></div>
          <div><dt>Fat</dt><dd>${target.fat}<small> g</small></dd></div>
        </dl>
        <p class="small">Goal: <strong>${esc(goal.label)}</strong>. Your body burns about ${target.tdee} kcal a day (Mifflin-St Jeor, ${target.bmr} kcal at rest, times your activity)${goal.kcal ? `, ${goal.kcal > 0 ? "plus" : "minus"} ${Math.abs(goal.kcal)} kcal for your goal` : ""}.</p>
        ${missing ? '<p class="notice">Some details were blank, so these use average values. Retake the quiz from Profile any time.</p>' : ""}
        <p class="hint small">A starting point, not medical advice. If you have a health condition, are pregnant or under 18, ask a doctor or dietitian.</p>`;
    }

    function paint() {
      dialog.innerHTML = `
        <div class="sheet-head">
          <div><p class="eyebrow">Step ${step + 1} of ${QUIZ_STEPS}</p><h2 id="quiz-title">${step === QUIZ_STEPS - 1 ? "Here is your plan" : "Set Lahap up for you"}</h2></div>
          <button type="button" class="icon-btn" data-quiz-skip aria-label="Skip the quiz">${ICON_CLOSE}</button>
        </div>
        <div class="quiz-progress" aria-hidden="true"><span style="width:${Math.round(((step + 1) / QUIZ_STEPS) * 100)}%"></span></div>
        <div class="sheet-body quiz">${stepHtml()}</div>
        <div class="sheet-foot">
          ${step === 0 ? '<button type="button" class="btn ghost" data-quiz-skip>Skip for now</button>' : '<button type="button" class="btn ghost" data-quiz-back>Back</button>'}
          <button type="button" class="btn primary" data-quiz-next>${step === QUIZ_STEPS - 1 ? "Start logging" : "Next"}</button>
        </div>`;
    }

    function readStep() {
      if (step === 1) {
        answers.age = Number($("#quiz-age").value) || "";
        answers.height = Number($("#quiz-height").value) || "";
        answers.weight = Number($("#quiz-weight").value) || "";
      }
      if (step === 3) {
        answers.diet = {};
        for (const box of $$('input[name="diet"]:checked', dialog)) answers.diet[box.value] = true;
      }
    }

    async function finish(save) {
      if (save) state.settings.profile = answers;
      state.settings.quizSeen = true;
      await saveMeta();
      dialog.close();
      if (save) toast(`Targets set: ${N.targets(answers).kcal} kcal and ${N.targets(answers).protein} g protein a day`);
      render();
    }

    dialog.onclick = (event) => {
      const target = event.target;
      const goal = target.closest("[data-quiz-goal]");
      if (goal) {
        answers.goal = goal.dataset.quizGoal;
        step = 1;
        paint();
        return;
      }
      const activity = target.closest("[data-quiz-activity]");
      if (activity) {
        answers.activity = activity.dataset.quizActivity;
        for (const button of $$("[data-quiz-activity]", dialog)) button.setAttribute("aria-pressed", String(button === activity));
        return;
      }
      const seg = target.closest("[data-seg]");
      if (seg) {
        if (seg.dataset.seg === "sex") answers.sex = seg.dataset.value;
        if (seg.dataset.seg === "cook") answers.cookMinutes = Number(seg.dataset.value);
        for (const sibling of $$(`[data-seg="${seg.dataset.seg}"]`, dialog)) sibling.setAttribute("aria-pressed", String(sibling === seg));
        return;
      }
      if (target.closest("[data-quiz-next]")) {
        readStep();
        if (step === QUIZ_STEPS - 1) {
          finish(true);
          return;
        }
        step += 1;
        paint();
        return;
      }
      if (target.closest("[data-quiz-back]")) {
        readStep();
        step = Math.max(0, step - 1);
        paint();
        return;
      }
      if (target.closest("[data-quiz-skip]")) finish(false);
    };
    dialog.onclose = () => {
      if (!state.settings.quizSeen) {
        state.settings.quizSeen = true;
        saveMeta();
      }
    };
    paint();
    dialog.showModal();
  }

  function goalPanelHtml() {
    const prof = state.settings.profile;
    if (!prof) {
      return `
        <section class="panel">
          <h2>Your goal</h2>
          <p class="muted" style="margin-bottom:12px">Take the one-minute quiz for daily calorie and protein targets, tips that fit your goal, and Lab recipes sized for you.</p>
          <button type="button" class="btn primary" data-quiz>Take the quiz</button>
        </section>`;
    }
    const target = N.targets(prof);
    const diet = DIETS.filter(([key]) => prof.diet && prof.diet[key]).map(([, label]) => label);
    return `
      <section class="panel">
        <h2>Your goal</h2>
        <p><strong>${esc((N.GOALS[prof.goal] || N.GOALS.healthy).label)}</strong></p>
        <dl class="macros" style="margin:12px 0">
          <div><dt>Energy</dt><dd>${target.kcal}<small> kcal</small></dd></div>
          <div><dt>Protein</dt><dd>${target.protein}<small> g</small></dd></div>
          <div><dt>Carbs</dt><dd>${target.carbs}<small> g</small></dd></div>
          <div><dt>Fat</dt><dd>${target.fat}<small> g</small></dd></div>
        </dl>
        <p class="muted small" style="margin-bottom:12px">${esc(ACTIVITY_LABELS[prof.activity] ? ACTIVITY_LABELS[prof.activity][0] : "Lightly active")} · cooks ${prof.cookMinutes || 30} min${diet.length ? " · " + esc(diet.join(", ")) : ""}</p>
        <button type="button" class="btn" data-quiz>Retake the quiz</button>
      </section>`;
  }

  /* ---------------- lab: recipes from what you have ---------------- */
  const QUICK_ADD = ["egg", "chicken", "tempeh", "tofu", "fish", "rice", "noodles", "oats", "potato", "kangkung", "spinach", "cabbage", "carrot", "tomato", "garlic", "shallot", "chili", "banana", "milk"];
  const ICON_MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ICON_SCAN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 9h8M8 12h8M8 15h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  let labResults = [];
  let recognition = null;
  let ocrWorker = null;
  let ocrWorkerLangs = "";
  let ocrStatus = null;

  function ingredientLabel(id) {
    return (R.INGREDIENTS[id] || { label: id }).label;
  }

  function labGoal() {
    return state.lab.goal || profileOrDefault().goal || "healthy";
  }

  function labLang() {
    return state.lab.lang || (/^id\b/i.test(navigator.language || "") ? "id-ID" : "en-US");
  }

  function recipeCardHtml(recipe, index) {
    const have = state.lab.have;
    const fit = have.length ? `You have ${recipe.have.length} of ${recipe.items.length}.` : "";
    const need = recipe.missingCore.length ? ` Still need ${recipe.missingCore.map((label) => label.toLowerCase()).join(", ")}.` : "";
    // r21: a recipe is a kitchen ticket like a diary meal - its plate on the left, the numbers on a
    // perforated stub on the right, the ingredients as a till slip (ticked when you have them)
    const plate = R.plateFor(recipe);
    const score = L.healthScore(plate);
    return `
      <article class="recipe recipe-ticket">
        <div class="recipe-top">
          <img class="recipe-plate" src="${plateThumb({ plate, name: recipe.name }, 144)}" alt="Plate drawing of ${esc(recipe.name)}" width="64" height="64">
          <div class="recipe-head">
            <span class="eyebrow">Resep no. ${String(index + 1).padStart(2, "0")} · ${esc(recipe.cuisine || "Home-cooked")}</span>
            <h3>${esc(recipe.name)}</h3>
            ${fit || need ? `<p class="small">${esc(fit + need)}</p>` : ""}
          </div>
          <div class="recipe-stub mono" aria-label="${recipe.minutes} minutes, ${recipe.nutrition.kcal} kcal, ${recipe.nutrition.p} grams protein">
            <span><b>${recipe.minutes}</b> min</span>
            <span><b>${recipe.nutrition.kcal}</b> kcal</span>
            <span><b>${recipe.nutrition.p}</b> g prot</span>
            ${scoreBadge(score)}
          </div>
        </div>
        <div class="btn-row recipe-actions">
          <button type="button" class="btn small primary" data-lab-log="${esc(recipe.id)}">Cooked it? Log to Diary</button>
          ${recipe.missing.length ? `<button type="button" class="btn small" data-lab-shop="${esc(recipe.id)}">Copy shopping list</button>` : ""}
        </div>
        <details${index === 0 ? " open" : ""}>
          <summary>Ingredients and steps</summary>
          <ul class="ingredients">${recipe.items.map((item) => `<li class="${recipe.have.includes(item.id) ? "got" : ""}">${esc(R.amountLabel(item))}</li>`).join("")}</ul>
          <ol class="steps">${recipe.steps.map((stepText) => `<li>${esc(stepText)}</li>`).join("")}</ol>
        </details>
      </article>`;
  }

  function renderLab() {
    const root = $("#view-lab");
    const prof = profileOrDefault();
    const goal = labGoal();
    const have = state.lab.have;
    const speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    const options = { goal, diet: prof.diet || {}, limit: 3, maxMinutes: prof.cookMinutes ? prof.cookMinutes + 15 : 0 };
    labResults = R.suggest(have, options);
    if (!labResults.length && options.maxMinutes) labResults = R.suggest(have, Object.assign({}, options, { maxMinutes: 0 }));
    const quick = QUICK_ADD.filter((id) => R.INGREDIENTS[id] && !have.includes(id)).slice(0, 12);
    const defaultStatus = speech ? "Type, speak (English or Bahasa Indonesia) or scan a written list or receipt." : "Type or scan a written list or receipt. Voice input is not available in this browser.";
    root.innerHTML = `
      <div class="view-head"><div><h1>Recipes</h1><p>Tell Lahap what is in your kitchen and get home recipes sized for your goal. Cooked one? Log it to your Diary in one tap, plate and calories already filled in.</p></div></div>
      <div class="lab-grid">
        <section class="panel lab-input slip">
          <h2>What do you have?</h2>
          <label class="field"><span class="sr-only">Ingredients you have</span><textarea id="lab-text" rows="3" placeholder="e.g. 3 telur, tempe, kangkung, nasi, bawang putih">${esc(state.lab.text)}</textarea></label>
          <div class="btn-row">
            <button type="button" class="btn primary" data-lab-find>Find recipes</button>
            ${speech ? `<button type="button" class="btn" data-lab-voice aria-pressed="${recognition ? "true" : "false"}">${ICON_MIC}<span>${recognition ? "Listening, tap to stop" : "Speak"}</span></button>` : ""}
            <label class="btn" for="lab-photo">${ICON_SCAN}<span>Scan a list</span></label>
            <input type="file" id="lab-photo" accept="image/*" hidden>
          </div>
          <div class="lang-pick"><span class="small muted">List language</span>${segHtml("lablang", [["en-US", "English"], ["id-ID", "Bahasa"]], labLang())}</div>
          <p class="hint small" id="lab-status" role="status" aria-live="polite">${esc(state.lab.status || defaultStatus)}</p>
          ${have.length ? `<h3 class="small-head">In your kitchen</h3><div class="chips">${have.map((id) => `<button type="button" class="chip on" data-lab-remove="${id}" aria-label="Remove ${esc(ingredientLabel(id))}"><span>${esc(ingredientLabel(id))}</span>${ICON_X}</button>`).join("")}</div>` : ""}
          <h3 class="small-head">Quick add</h3>
          <div class="chips">${quick.map((id) => `<button type="button" class="chip quick-tag" data-lab-add="${id}">+ ${esc(ingredientLabel(id))}</button>`).join("")}</div>
        </section>
        <section class="lab-results" aria-label="Recipe ideas">
          <div class="goal-pick"><span class="small muted">Cooking for</span>${segHtml("labgoal", Object.entries(N.GOALS).map(([key, value]) => [key, value.label]), goal)}</div>
          <p class="muted small">${esc(R.GOAL_NOTE[goal] || "")}${prof.diet && Object.values(prof.diet).some(Boolean) ? " Your food rules from the quiz are applied." : ""}</p>
          ${have.length ? "" : '<p class="small-head">Ideas for your goal. Add what you have to rank them by what is in your kitchen.</p>'}
          ${labResults.length ? labResults.map(recipeCardHtml).join("") : '<p class="notice">No recipe fits these yet. Add a protein (egg, tempe, chicken) or a starch (rice, noodles).</p>'}
        </section>
      </div>`;
  }

  function labAdd(ids, source) {
    const before = state.lab.have.length;
    state.lab.have = Array.from(new Set(state.lab.have.concat(ids)));
    const added = state.lab.have.length - before;
    if (source) {
      state.lab.status = ids.length
        ? `${source}: found ${ids.map(ingredientLabel).join(", ").toLowerCase()}${added < ids.length ? " (some were already in)" : ""}.`
        : `${source}: no ingredients recognised. Try names like telur, ayam, tempe, nasi, kangkung.`;
    }
    renderLab();
  }

  function loadScriptOnce(src) {
    if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = src;
      tag.onload = resolve;
      tag.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(tag);
    });
  }

  // OCR of a written list, receipt or label. Runs on this device with Tesseract; reads text, not food photos.
  async function readListPhoto(file) {
    const status = (text) => {
      state.lab.status = text;
      const node = $("#lab-status");
      if (node) node.textContent = text;
    };
    ocrStatus = status;
    status("Loading the text reader (first time only)…");
    await loadScriptOnce("vendor/tesseract/tesseract.min.js");
    // Bahasa lists read with the Indonesian model first and English as backup (mixed lists are common);
    // on handwriting-style test lists this read 124/124 words against 115/124 for English alone.
    const langs = labLang().startsWith("id") ? "ind+eng" : "eng";
    if (ocrWorker && ocrWorkerLangs !== langs) {
      await ocrWorker.terminate();
      ocrWorker = null;
    }
    if (!ocrWorker) {
      const base = new URL("vendor/tesseract/", location.href).href;
      ocrWorkerLangs = langs;
      ocrWorker = await window.Tesseract.createWorker(langs, 1, {
        workerPath: base + "worker.min.js",
        corePath: base,
        langPath: base.replace(/\/$/, ""),
        gzip: true,
        logger: (message) => {
          if (!ocrStatus) return;
          const percent = Math.round((message.progress || 0) * 100);
          if (message.status === "recognizing text") ocrStatus(`Reading the list… ${percent}%`);
          else if (/^loading/.test(message.status || "")) ocrStatus(`Getting the text reader ready (first time only): ${percent}%`);
        },
      });
    }
    const result = await ocrWorker.recognize(file);
    return result.data.text || "";
  }

  function toggleVoice() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return;
    if (recognition) {
      recognition.stop();
      return;
    }
    const box = $("#lab-text");
    const base = box.value ? box.value.replace(/\s*$/, ", ") : "";
    recognition = new Speech();
    recognition.lang = labLang();
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const said = Array.from(event.results).map((result) => result[0].transcript).join(" ");
      const field = $("#lab-text");
      if (field) field.value = base + said;
      state.lab.text = base + said;
    };
    recognition.onerror = (event) => {
      state.lab.status = event.error === "not-allowed" ? "Microphone permission was blocked. Allow it in the browser to use voice." : "Did not catch that. Try again or type it.";
    };
    recognition.onend = () => {
      recognition = null;
      labAdd(R.parseIngredients(state.lab.text), "Heard");
    };
    recognition.start();
    state.lab.status = "Listening… say what is in your fridge, then pause.";
    renderLab();
  }

  /* ---------------- log form ---------------- */
  function segHtml(name, options, value) {
    return `<div class="seg" role="group" aria-label="${esc(name)}">${options.map(([optionValue, label]) => `<button type="button" data-seg="${name}" data-value="${optionValue}" aria-pressed="${String(optionValue) === String(value)}">${label}</button>`).join("")}</div>`;
  }

  async function resizePhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = url;
      });
      const scale = Math.min(1, 1080 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.82);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function openLog(prefill) {
    const editing = prefill && prefill.id && state.entries.some((entry) => entry.id === prefill.id) ? prefill : null;
    const draft = Object.assign(
      { name: "", place: "", source: "out", cuisine: "", price: "", tastes: [], plate: { veg: 1, protein: 1, carbs: 1, fried: false, sugary: false, processed: false }, rating: 0, friends: [], notes: "", photo: null, ts: new Date().toISOString() },
      JSON.parse(JSON.stringify(prefill || {}))
    );
    draft.plate = Object.assign({ veg: 1, protein: 1, carbs: 1, fried: false, sugary: false, processed: false }, draft.plate || {});
    draft.portion = draft.portion || "m";
    draft.useCutout = draft.cutout ? true : false;
    // a plate the user (or a recipe) set by hand is never overwritten by the auto guess
    draft.plateTouched = !!editing || !!draft.nutrition || !!(prefill && prefill.name);
    const dialog = $("#dlg-log");
    const names = Array.from(new Set(sortedEntries().map((entry) => entry.name)));
    const places = Array.from(new Set(sortedEntries().map((entry) => entry.place).filter(Boolean)));
    const buds = PEOPLE.filter((person) => state.friends.includes(person.id));
    // r16: a quick log shows only what it needs; editing, or anything already set below, opens the rest
    const openMore = !!editing || draft.tastes.length > 0 || !!draft.notes || draft.rating > 0;
    dialog.innerHTML = `
      <form id="log-form" novalidate>
        <div class="sheet-head"><h2 id="log-title">${editing ? "Edit meal" : "Log a meal"}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${ICON_CLOSE}</button></div>
        <div class="sheet-body">
          <div class="field photo-pick">
            <img class="preview${draft.cutout ? " cut" : ""}" id="log-preview" alt="Meal photo preview" src="${draft.cutout || draft.photo || plateThumb(draft, 192)}">
            <div>
              <label class="btn" for="log-photo">${draft.photo ? "Change photo" : "Take or pick a photo"}</label>
              <input type="file" id="log-photo" accept="image/*" capture="environment" hidden>
              <p class="hint small muted photo-status" id="photo-status" role="status" aria-live="polite">Optional. Lahap cuts the food out of the photo on this phone and estimates what is on the plate.</p>
              <div id="cut-toggle"${draft.cutout && draft.photo ? "" : " hidden"}>${segHtml("photoview", [["cut", "Food only"], ["full", "Original"]], "cut")}</div>
            </div>
          </div>
          <label class="field"><span>Dish</span><input type="text" name="name" list="dish-list" value="${esc(draft.name)}" placeholder="e.g. Nasi lemak ayam" required autocomplete="off"></label>
          <datalist id="dish-list">${names.map((name) => `<option value="${esc(name)}">`).join("")}</datalist>
          <div id="seen-before"></div>
          <div class="field"><span>Where from</span>${segHtml("source", Object.entries(SOURCES), draft.source)}</div>
          <label class="field"><span>Place</span><input type="text" name="place" list="place-list" value="${esc(draft.place)}" placeholder="Warung or Home"></label>
          <datalist id="place-list">${places.map((place) => `<option value="${esc(place)}">`).join("")}</datalist>
          <!-- r18: who you ate with sits next to Place, outside the fold - tagging is the social loop -->
          <fieldset class="field ate-with"><legend>Ate with <span class="hint">${esc(closestBudNudge() || `+${L.POINTS.tag} connection points each`)}</span></legend>
            ${buds.length ? `<div class="chips">${buds.map((person) => `<label class="chip"><input type="checkbox" name="friend" value="${person.id}" ${draft.friends.includes(person.id) ? "checked" : ""}><span>${esc(person.name)}${hasTasteProfile() ? `<span class="chip-match">${matchFor(person)}%</span>` : ""}</span></label>`).join("")}</div>` : '<p class="muted small">Add buds on the Taste buds tab to tag them here.</p>'}
          </fieldset>
          <!-- r24: price sits with cuisine; r30: below Ate with, so tagging a bud is on the first screen -->
          <div class="row">
            <label class="field"><span>Cuisine</span><input type="text" name="cuisine" list="cuisine-list" value="${esc(draft.cuisine)}" placeholder="Indonesian"></label>
            <label class="field"><span>Price (${esc(state.settings.currency)})</span><input type="number" name="price" inputmode="decimal" min="0" step="any" value="${esc(draft.price)}"></label>
          </div>
          <datalist id="cuisine-list">${CUISINES.map((cuisine) => `<option value="${esc(cuisine)}">`).join("")}</datalist>
          <fieldset class="field"><legend>How did the plate look? <span class="hint">sets the plate score</span></legend>
            <div class="plate-step">
              <div>
                <div class="portion"><span>Veg</span>${segHtml("veg", [[0, "None"], [1, "Some"], [2, "Half"]], draft.plate.veg)}</div>
                <div class="portion"><span>Protein</span>${segHtml("protein", [[0, "None"], [1, "Some"], [2, "Lots"]], draft.plate.protein)}</div>
                <div class="portion"><span>Starch</span>${segHtml("carbs", [[0, "None"], [1, "Normal"], [2, "Big"]], draft.plate.carbs)}</div>
                <div class="portion"><span>Portion</span>${segHtml("portion", [["s", "Small"], ["m", "Regular"], ["l", "Large"]], draft.portion)}</div>
                <div class="chips" style="margin-top:8px">
                  <label class="chip"><input type="checkbox" name="fried" ${draft.plate.fried ? "checked" : ""}><span>Deep-fried</span></label>
                  <label class="chip"><input type="checkbox" name="sugary" ${draft.plate.sugary ? "checked" : ""}><span>Sugary drink</span></label>
                  <label class="chip"><input type="checkbox" name="processed" ${draft.plate.processed ? "checked" : ""}><span>Processed meat</span></label>
                </div>
              </div>
              <div class="plate-live"><canvas id="log-plate" width="264" height="264" aria-hidden="true"></canvas><div id="log-score"></div></div>
            </div>
            <p class="hint small" id="plate-source"></p>
          </fieldset>
          <section class="nutri" id="log-nutri" aria-live="polite"></section>
          <details class="more-fields" id="log-more"${openMore ? " open" : ""}>
            <summary><span>More details</span><span class="more-sum" id="log-more-sum"></span></summary>
            <label class="field when-field"><span>When</span><input type="datetime-local" name="ts" value="${localInputValue(new Date(draft.ts))}"></label>
            <fieldset class="field"><legend>Taste</legend><div class="chips">${TASTES.map((taste) => `<label class="chip"><input type="checkbox" name="taste" value="${taste}" ${draft.tastes.includes(taste) ? "checked" : ""}><span>${taste}</span></label>`).join("")}</div></fieldset>
            <div class="field"><span>Rating</span>${segHtml("rating", [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]], draft.rating)}</div>
            <label class="field"><span>Notes</span><textarea name="notes" placeholder="Less sambal next time, ask for extra lime">${esc(draft.notes)}</textarea></label>
          </details>
        </div>
        <div class="sheet-foot">
          <button type="button" class="btn ghost" data-close>Cancel</button>
          <button type="submit" class="btn primary">${editing ? "Save changes" : "Save meal"}</button>
        </div>
      </form>`;

    const form = $("#log-form");
    const plateCanvas = $("#log-plate");
    const initialWhen = form.ts ? form.ts.value : "";

    // r16: the folded section still says what is in it ("Spicy · ★4 · with Rina")
    function updateMoreSummary() {
      const summary = $("#log-more-sum");
      if (!summary) return;
      const tastes = Array.from(form.querySelectorAll("input[name=taste]:checked")).map((input) => input.value);
      const rated = form.querySelector("[data-seg=rating][aria-pressed=true]");
      const parts = [];
      if (tastes.length) parts.push(tastes.join(", "));
      if (rated) parts.push(`★${rated.dataset.value}`);
      if (form.notes && form.notes.value.trim()) parts.push("note");
      // r24: a back-dated meal says so on the folded row
      if (form.ts && form.ts.value && form.ts.value !== initialWhen) parts.push(form.ts.value.replace("T", " "));
      summary.textContent = parts.length ? parts.join(" · ") : "Taste, rating, notes, time";
    }
    updateMoreSummary();
    form.addEventListener("change", updateMoreSummary);
    form.addEventListener("input", updateMoreSummary);
    form.addEventListener("click", () => setTimeout(updateMoreSummary, 0));

    function readPlate() {
      return {
        veg: draft.plate.veg,
        protein: draft.plate.protein,
        carbs: draft.plate.carbs,
        fried: form.fried.checked,
        sugary: form.sugary.checked,
        processed: form.processed.checked,
      };
    }

    function updatePlate() {
      draft.plate = readPlate();
      const ctx = plateCanvas.getContext("2d");
      ctx.clearRect(0, 0, 264, 264);
      drawPlate(ctx, 132, 132, 112, draft.plate, form.name.value || "draft");
      $("#log-score").innerHTML = scoreBadge(L.healthScore(draft.plate));
      if (!draft.photo) $("#log-preview").src = plateThumb(Object.assign({}, draft, { name: form.name.value }), 192);
      updateNutri();
    }

    function updateNutri() {
      const probe = Object.assign({}, draft, { name: form.name.value, plate: draft.plate });
      const nutrition = N.estimate(probe);
      const when = form.ts.value ? new Date(form.ts.value) : new Date();
      const before = dayTotals(L.dayKey(when), editing ? editing.id : null);
      $("#log-nutri").innerHTML = nutriHtml(nutrition, N.mealTips(probe, nutrition, profileOrDefault(), before));
    }

    function updatePreview() {
      const preview = $("#log-preview");
      const showCut = draft.useCutout && draft.cutout;
      preview.src = showCut ? draft.cutout : draft.photo || plateThumb(Object.assign({}, draft, { name: form.name.value }), 192);
      preview.classList.toggle("cut", !!showCut);
    }

    function syncSegs() {
      for (const button of $$("[data-seg]", form)) {
        const key = button.dataset.seg;
        const current =
          key === "source" ? draft.source : key === "rating" ? draft.rating : key === "portion" ? draft.portion : key === "photoview" ? (draft.useCutout ? "cut" : "full") : draft.plate[key];
        button.setAttribute("aria-pressed", String(String(current) === button.dataset.value));
      }
    }

    // Fill the plate automatically until the user touches it: a known dish wins, then the photo colours.
    function autoPlate(colourGuess) {
      if (draft.plateTouched) return;
      const food = N.matchFood(form.name.value);
      const note = $("#plate-source");
      if (food) {
        Object.assign(draft.plate, { veg: food.plate.veg, protein: food.plate.protein, carbs: food.plate.carbs });
        form.fried.checked = !!food.fried;
        form.sugary.checked = !!food.sugary;
        form.processed.checked = !!food.processed;
        note.textContent = `Filled in from a typical ${food.name.toLowerCase()}. Change anything that looks different.`;
      } else if (colourGuess || draft.colourGuess) {
        const guess = colourGuess || draft.colourGuess;
        draft.colourGuess = guess;
        Object.assign(draft.plate, { veg: guess.veg, protein: guess.protein, carbs: guess.carbs });
        note.textContent = "Guessed from the colours in your photo (green veg, brown and red protein, pale starch). Check it.";
      } else {
        return;
      }
      syncSegs();
      updatePlate();
    }

    function updateSeen() {
      const box = $("#seen-before");
      const name = L.normalize(form.name.value);
      if (!name || editing) {
        box.innerHTML = "";
        return;
      }
      const past = sortedEntries().filter((entry) => L.normalize(entry.name) === name);
      if (!past.length) {
        box.innerHTML = "";
        return;
      }
      const last = past[0];
      // the cuisine of a dish rarely changes, so fill it quietly when the field is still empty
      let filledCuisine = false;
      if (!form.cuisine.value.trim() && last.cuisine) {
        form.cuisine.value = last.cuisine;
        filledCuisine = true;
      }
      box.innerHTML = `<p class="notice" style="margin:-8px 0 16px">Had it ${past.length}× before, last ${esc(relative(last.ts))}${last.place ? " at " + esc(last.place) : ""} for ${esc(money(last.price))}.${filledCuisine ? ` Cuisine set to ${esc(last.cuisine)}.` : ""} <button type="button" class="btn" style="margin-top:6px" data-fill="${esc(last.id)}">Fill from last time</button></p>`;
    }

    function fillFrom(entry) {
      form.place.value = entry.place || "";
      form.cuisine.value = entry.cuisine || "";
      form.price.value = entry.price || "";
      draft.source = entry.source;
      draft.plate = Object.assign({}, entry.plate);
      draft.rating = entry.rating || 0;
      draft.portion = entry.portion || "m";
      draft.plateTouched = true;
      for (const box of $$('input[name="taste"]', form)) box.checked = (entry.tastes || []).includes(box.value);
      form.fried.checked = !!entry.plate.fried;
      form.sugary.checked = !!entry.plate.sugary;
      form.processed.checked = !!entry.plate.processed;
      syncSegs();
      updatePlate();
    }

    form.addEventListener("click", (event) => {
      const segButton = event.target.closest("[data-seg]");
      if (segButton) {
        const key = segButton.dataset.seg;
        const value = ["source", "portion", "photoview"].includes(key) ? segButton.dataset.value : Number(segButton.dataset.value);
        if (key === "source") draft.source = value;
        else if (key === "rating") draft.rating = value;
        else if (key === "portion") draft.portion = value;
        else if (key === "photoview") {
          draft.useCutout = value === "cut";
          updatePreview();
        } else {
          draft.plate[key] = value;
          draft.plateTouched = true;
          $("#plate-source").textContent = "";
        }
        for (const sibling of $$(`[data-seg="${key}"]`, form)) sibling.setAttribute("aria-pressed", String(sibling === segButton));
        updatePlate();
      }
      const fill = event.target.closest("[data-fill]");
      if (fill) {
        fillFrom(state.entries.find((entry) => entry.id === fill.dataset.fill));
        toast("Filled from last time");
      }
    });
    form.addEventListener("change", (event) => {
      if (["fried", "sugary", "processed"].includes(event.target.name)) {
        draft.plateTouched = true;
        updatePlate();
      }
      if (event.target.name === "ts") updateNutri();
    });
    form.name.addEventListener("input", () => {
      updateSeen();
      updateNutri();
    });
    form.name.addEventListener("change", () => {
      autoPlate(null);
      updatePlate();
    });
    $("#log-photo").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const status = $("#photo-status");
      try {
        draft.photo = await resizePhoto(file);
        draft.cutout = null;
        draft.useCutout = false;
        $("#cut-toggle").hidden = true;
        updatePreview();
      } catch (error) {
        toast("Could not read that photo");
        return;
      }
      if (!window.LahapVision) return;
      const token = (draft.cutToken = (draft.cutToken || 0) + 1);
      status.textContent = "Removing the background…";
      dialog.classList.add("working");
      try {
        const result = await window.LahapVision.cutout(draft.photo, {
          onStatus: (text) => {
            if (token === draft.cutToken) status.textContent = text;
          },
        });
        if (token !== draft.cutToken) return;
        draft.cutout = result.cutout;
        draft.useCutout = true;
        $("#cut-toggle").hidden = false;
        syncSegs();
        updatePreview();
        status.textContent =
          result.method === "model"
            ? `Food cut out on this device in ${(result.ms / 1000).toFixed(1)} s. Tap Original to keep the full photo.`
            : "The cutout model could not load (offline?), so this is a soft oval crop. Tap Original to keep the full photo.";
        autoPlate(result.plate);
      } catch (error) {
        status.textContent = "Could not cut out the food, so the original photo is kept.";
      } finally {
        dialog.classList.remove("working");
      }
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.name.value.trim()) {
        form.name.focus();
        toast("Name the dish first");
        return;
      }
      const entry = {
        id: editing ? editing.id : uid(),
        ts: form.ts.value ? new Date(form.ts.value).toISOString() : new Date().toISOString(),
        name: form.name.value.trim(),
        place: form.place.value.trim(),
        cuisine: form.cuisine.value.trim() || "Other",
        source: draft.source,
        price: form.price.value === "" ? 0 : Number(form.price.value),
        tastes: $$('input[name="taste"]:checked', form).map((box) => box.value),
        plate: readPlate(),
        rating: draft.rating,
        friends: $$('input[name="friend"]:checked', form).map((box) => box.value),
        notes: form.notes.value.trim(),
        photo: draft.photo || null,
        cutout: draft.useCutout && draft.cutout ? draft.cutout : null,
        portion: draft.portion,
      };
      if (draft.nutrition) entry.nutrition = draft.nutrition;
      if (draft.recipe) entry.recipe = draft.recipe;
      const before = editing ? editing.friends || [] : [];
      const newlyTagged = entry.friends.filter((id) => !before.includes(id));
      for (const id of newlyTagged) state.points[id] = (state.points[id] || 0) + L.POINTS.tag;
      await store.put(entry);
      state.entries = state.entries.filter((item) => item.id !== entry.id).concat(entry);
      await saveMeta();
      dialog.close();
      const bonus = newlyTagged.length ? ` · +${L.POINTS.tag * newlyTagged.length} connection points` : "";
      toast(`${editing ? "Updated" : "Logged"} ${entry.name}${bonus}`);
      render();
    });
    updatePlate();
    updateSeen();
    dialog.showModal();
    if (!editing) setTimeout(() => form.name.focus(), 30);
  }

  /* ---------------- detail ---------------- */
  function openDetail(id) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    const dialog = $("#dlg-detail");
    const breakdown = L.healthBreakdown(entry.plate);
    const score = L.healthScore(entry.plate);
    const who = (entry.friends || []).map((friendId) => (personById(friendId) || {}).name).filter(Boolean);
    const past = state.entries.filter((item) => L.normalize(item.name) === L.normalize(entry.name)).length;
    const nutrition = nutritionFor(entry);
    dialog.innerHTML = `
      <div class="sheet-head"><h2 id="detail-title">${esc(entry.name)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${ICON_CLOSE}</button></div>
      <div class="sheet-body">
        <img class="detail-photo${entry.cutout ? " cut" : ""}" id="detail-photo" src="${entry.cutout || entry.photo || plateThumb(entry, 480)}" alt="${entry.photo ? "Photo of " + esc(entry.name) : "Plate drawing of " + esc(entry.name)}">
        ${entry.cutout && entry.photo ? '<button type="button" class="btn small" id="detail-swap" style="margin-top:8px">Show original photo</button>' : ""}
        <p class="muted" style="margin-top:12px">${esc(new Date(entry.ts).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }))} · ${esc(SOURCES[entry.source])}${entry.place ? " · " + esc(entry.place) : ""}</p>
        <div class="stat-grid" style="margin-top:16px">
          <div class="stat"><div class="label">Price</div><div class="value money">${esc(money(entry.price))}</div></div>
          <div class="stat"><div class="label">Plate score</div><div class="value">${score}</div></div>
          <div class="stat"><div class="label">Rating</div><div class="value">${entry.rating ? entry.rating + "/5" : "–"}</div></div>
          <div class="stat"><div class="label">Times eaten</div><div class="value">${past}</div></div>
        </div>
        <p style="margin-top:16px">${(entry.tastes || []).map((taste) => `<span class="tag">${esc(taste)}</span>`).join(" ")} <span class="tag">${esc(entry.cuisine || "Other")}</span>${who.length ? ` <span class="tag">with ${esc(who.join(", "))}</span>` : ""}</p>
        ${entry.notes ? `<p style="margin-top:12px">${esc(entry.notes)}</p>` : ""}
        <section class="nutri" style="margin-top:20px">${nutriHtml(nutrition, N.mealTips(entry, nutrition, profileOrDefault(), dayTotals(L.dayKey(entry.ts), entry.id)))}</section>
        <h3 style="margin-top:20px">Why ${score}?</h3>
        <table class="breakdown">${breakdown.map((part) => `<tr><td>${esc(part.label)}</td><td>${part.value > 0 && part.label !== "Base" ? "+" : ""}${part.value}</td></tr>`).join("")}<tr class="total"><td>Plate score (0 to 100)</td><td>${score}</td></tr></table>
      </div>
      <div class="sheet-foot">
        <button type="button" class="btn danger ghost" data-delete="${esc(entry.id)}">Delete</button>
        <button type="button" class="btn" data-edit="${esc(entry.id)}">Edit</button>
        <button type="button" class="btn" data-again="${esc(entry.id)}">Ate it again</button>
        <button type="button" class="btn primary" data-share="${esc(entry.id)}">Share card</button>
      </div>`;
    const swap = $("#detail-swap");
    if (swap) {
      swap.addEventListener("click", () => {
        const img = $("#detail-photo");
        const showingCut = img.classList.contains("cut");
        img.src = showingCut ? entry.photo : entry.cutout;
        img.classList.toggle("cut", !showingCut);
        swap.textContent = showingCut ? "Show food only" : "Show original photo";
      });
    }
    dialog.showModal();
  }

  /* ---------------- share cards ---------------- */
  const share = { subject: null, template: null, background: "paper", size: "story", photo: null };
  // r16: real dish photos bundled as the "Photo" background when a meal has no photo of its own,
  // picked per meal (stable hash) so share cards feel varied instead of all showing one plate.
  const DISH_PHOTOS = ["assets/dish/noodle.jpg", "assets/dish/salad.jpg", "assets/dish/pizza.jpg"];

  function loadImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  function wrapText(ctx, text, maxWidth, maxLines) {
    const words = String(text).split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
    }
    return lines;
  }

  function weekData() {
    const entries = L.withinDays(state.entries, 7);
    const spend = L.spendSummary(entries);
    const avg = entries.length ? Math.round(entries.reduce((sum, entry) => sum + L.healthScore(entry.plate), 0) / entries.length) : 0;
    return { entries, spend, avg, variety: L.varietyScore(entries) };
  }

  function cover(ctx, image, x, y, w, h) {
    const scale = Math.max(w / image.width, h / image.height);
    const sw = w / scale;
    const sh = h / scale;
    ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, w, h);
  }

  // r16: which bundled dish photo backs a meal that has no photo of its own (stable per meal)
  function dishPhotoFor(entry) {
    if (!entry) return DISH_PHOTOS[0];
    const s = String((entry && (entry.id || entry.name)) || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return DISH_PHOTOS[h % DISH_PHOTOS.length];
  }

  async function drawShare(canvas, opts) {
    const W = 1080;
    // opts lets the share sheet render small per-template previews (and other
    // background/size combos) without mutating the live `share` state
    const template = (opts && opts.template) || share.template;
    const size = (opts && opts.size) || share.size;
    const bg = (opts && opts.background) || share.background;
    const scale = (opts && opts.scale) || 1;
    const preview = !!(opts && opts.preview);
    const H = size === "story" ? 1920 : 1080;
    if (!preview) drawShare.boxes = [];
    if (!preview) drawShare.statLabels = [];
    if (!preview) drawShare.stamp = null;
    if (!preview) drawShare.photoHero = null;
    if (!preview) drawShare.footer = null;
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext("2d");
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.clearRect(0, 0, W, H);
    const isWeek = share.subject === "week";
    const entry = isWeek ? null : share.subject;
    const stage = canvas.closest(".canvas-stage");
    if (stage) stage.classList.toggle("checker", bg === "clear");
    const photo = entry && entry.photo ? await loadImage(entry.photo) : null;
    const cutout = entry && entry.cutout ? await loadImage(entry.cutout) : null;
    const light = bg === "paper";
    const ink = light ? "#1d1813" : "#ffffff";
    const sub = light ? "#5e554a" : "rgba(255,255,255,0.86)";
    const display = "700 1px " + getComputedStyle(document.documentElement).getPropertyValue("--font-display");
    const serif = (size) => display.replace("1px", size + "px");
    const mono = (size, weight) => `${weight || 600} ${size}px ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace`;
    const sans = (size, weight) => `${weight || 600} ${size}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;

    // background
    // r26: on the single-meal Card the photo runs sharp and full-bleed, edge to edge, so Photo reads
    // as a photo poster rather than the Paper card recoloured; the card layout lays its own scrim band
    const photoBleed = template === "card" && !isWeek;
    let backdrop = null;
    // never stretch a photo past 1.5x: phone photos are saved at 1080px on the long side, so a
    // landscape shot can't fill a story card sharply - it then runs edge to edge across the top
    // and fades into the ink band instead of being blown up
    const MAX_UPSCALE = 1.5;
    let heroFit = "cover";
    let heroH = H;
    let heroUpscale = 1;
    const paintBackdrop = (img) => {
      const coverScale = Math.max(W / img.width, H / img.height);
      if (!photoBleed || coverScale <= MAX_UPSCALE) {
        heroUpscale = coverScale;
        cover(ctx, img, 0, 0, W, H);
        return;
      }
      // letterbox: ink ground now, the photo itself is laid once the text block's height is known
      heroFit = "top";
      heroH = Math.round(Math.min(H * 0.68, Math.max(img.height * MAX_UPSCALE, (img.height * W) / img.width)));
      heroUpscale = Math.max(W / img.width, heroH / img.height);
      ctx.fillStyle = "#1d1813";
      ctx.fillRect(0, 0, W, H);
    };
    // a full-width photo strip centred in the space above the title, fading into the ink at both edges
    const paintLetterbox = (img, spaceBottom) => {
      const heroTop = Math.max(0, Math.round((spaceBottom - heroH) / 2));
      cover(ctx, img, 0, heroTop, W, heroH);
      const edge = Math.min(240, heroH * 0.3);
      const topFade = ctx.createLinearGradient(0, heroTop, 0, heroTop + edge);
      topFade.addColorStop(0, "rgba(29,24,19,1)");
      topFade.addColorStop(1, "rgba(29,24,19,0)");
      ctx.fillStyle = topFade;
      ctx.fillRect(0, heroTop, W, edge);
      const bottomFade = ctx.createLinearGradient(0, heroTop + heroH - edge, 0, heroTop + heroH);
      bottomFade.addColorStop(0, "rgba(29,24,19,0)");
      bottomFade.addColorStop(1, "rgba(29,24,19,1)");
      ctx.fillStyle = bottomFade;
      ctx.fillRect(0, heroTop + heroH - edge, W, edge);
      return heroTop;
    };
    if (bg === "paper") {
      ctx.fillStyle = "#f5efe3";
      ctx.fillRect(0, 0, W, H);
    } else if (bg === "ink") {
      ctx.fillStyle = "#1d1813";
      ctx.fillRect(0, 0, W, H);
    } else if (bg === "photo") {
      if (photo) {
        backdrop = photo;
        paintBackdrop(photo);
      } else {
        // r16: no photo of this meal - use a bundled real dish photo (rotates per meal), cover-cropped.
        // The scrim below keeps the white text readable. Falls back to the plate glyph only if the
        // image can't load (e.g. offline before the first precache).
        const dish = await loadImage(dishPhotoFor(entry));
        if (dish) {
          backdrop = dish;
          paintBackdrop(dish);
        } else {
          ctx.fillStyle = "#3b2a1e";
          ctx.fillRect(0, 0, W, H);
          drawPlate(ctx, W / 2, H / 2, W * 0.42, entry ? entry.plate : { veg: 1, protein: 1, carbs: 1 }, entry ? entry.name : "week");
        }
      }
      // scrim: clear over the food, then a solid dark band behind the title and stats so
      // white text stays readable over pale plates and busy photos (the full-bleed Card lays its own)
      if (!photoBleed || !backdrop) {
        const shade = ctx.createLinearGradient(0, H * 0.22, 0, H);
        shade.addColorStop(0, "rgba(20,14,10,0)");
        shade.addColorStop(0.36, "rgba(20,14,10,0.62)");
        shade.addColorStop(0.55, "rgba(20,14,10,0.8)");
        shade.addColorStop(1, "rgba(20,14,10,0.88)");
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, W, H);
      }
      // top scrim so the brand row reads over bright photos too
      const topShade = ctx.createLinearGradient(0, 0, 0, H * 0.14);
      topShade.addColorStop(0, "rgba(20,14,10,0.5)");
      topShade.addColorStop(1, "rgba(20,14,10,0)");
      ctx.fillStyle = topShade;
      ctx.fillRect(0, 0, W, H * 0.14);
    }
    // paper card: a printed menu-card frame (double rule) so it reads as a keepsake, not a blank page
    if (bg === "paper" && template !== "receipt" && template !== "stats") {
      ctx.save();
      ctx.strokeStyle = "#d3c5ac";
      ctx.lineWidth = 3;
      ctx.strokeRect(26, 26, W - 52, H - 52);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(38, 38, W - 76, H - 76);
      ctx.restore();
    }
    // "clear" leaves a transparent background, like a sticker over your own photo
    ctx.textBaseline = "alphabetic";
    if (bg === "clear") {
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 2;
    }

    const pad = 84;
    const who = state.settings.name ? state.settings.name : "";

    function brand(y) {
      // the app icon as a mark: a plate split into three portions
      const r = 24;
      const cx = pad + r;
      const cy = y - 13;
      ctx.save();
      ctx.shadowColor = "transparent";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = light ? "#1d1813" : "#ffffff";
      ctx.stroke();
      const wedges = [["#b4380f", -Math.PI / 2, 0], ["#4f8a3c", 0, (2 * Math.PI) / 3], ["#e0b25a", (2 * Math.PI) / 3, 1.5 * Math.PI]];
      for (const [color, from, to] of wedges) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r * 0.78, from, to);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
      ctx.restore();
      ctx.font = serif(46);
      ctx.fillStyle = ink;
      ctx.textAlign = "left";
      ctx.fillText("Lahap", pad + r * 2 + 16, y);
      ctx.textAlign = "right";
      ctx.fillStyle = sub;
      ctx.font = mono(28, 500);
      ctx.fillText(who ? who.toUpperCase() : "FOOD DIARY", W - pad, y);
      ctx.textAlign = "left";
    }

    // value shrinks until it fits its column, so neighbouring stats never touch
    function statBlock(x, y, label, value, size, maxWidth) {
      const limit = maxWidth || W - pad * 2;
      ctx.fillStyle = sub;
      ctx.font = mono(28, 600);
      ctx.fillText(label.toUpperCase(), x, y);
      let fontSize = size || 84;
      ctx.font = serif(fontSize);
      while (ctx.measureText(value).width > limit && fontSize > 28) {
        fontSize -= 2;
        ctx.font = serif(fontSize);
      }
      ctx.fillStyle = ink;
      ctx.fillText(value, x, y + (size || 84) + 8);
      const valueWidth = ctx.measureText(value).width;
      ctx.font = mono(28, 600);
      if (!preview) {
        drawShare.boxes.push({ x, y, width: Math.max(valueWidth, ctx.measureText(label.toUpperCase()).width) });
        drawShare.statLabels.push(label.toUpperCase());
      }
    }

    if (template === "receipt") {
      drawReceipt(ctx, W, H, entry, isWeek, mono, serif, size, preview);
      return;
    }

    if (template === "stats") {
      // Strava-style scoreboard: the plate inside a score ring is the hero, then the dish, then a ruled stat grid
      const story = size === "story";
      const data = isWeek ? weekData() : null;
      const score = isWeek ? data.avg : L.healthScore(entry.plate);
      const title = isWeek ? "My week on a plate" : entry.name;
      const cells = isWeek
        ? [["Meals", String(data.entries.length)], ["Spent", money(data.spend.total)], ["Variety", String(data.variety)], ["Days logged", String(new Set(data.entries.map((item) => L.dayKey(item.ts))).size)]]
        : [["Price", money(entry.price)], ["Taste", (entry.tastes || []).join(" · ") || entry.cuisine || "–"], ["Where", entry.place || SOURCES[entry.source] || "–"], ["Eaten", `${timesEaten(entry)}×`]];
      const rows = story ? 2 : 1;
      brand(pad + 20);

      // score ring around the plate: the arc length is the score out of 100
      const ringR = story ? 250 : 168;
      const ringY = story ? 230 + ringR : 150 + ringR;
      const ringColor = score >= 70 ? "#4f8a3c" : score >= 45 ? "#e0b25a" : "#b4380f";
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = story ? 22 : 16;
      ctx.strokeStyle = light ? "rgba(29,24,19,0.12)" : "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.arc(W / 2, ringY, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = ringColor;
      ctx.beginPath();
      ctx.arc(W / 2, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.max(score, 2)) / 100);
      ctx.stroke();
      ctx.restore();
      // r20: the meal's own cut-out or photo sits in the ring when there is one; the drawn plate is the fallback
      const innerR = ringR - (story ? 44 : 32);
      if (!isWeek && cutout) {
        const fit = Math.min((innerR * 2) / cutout.width, (innerR * 2) / cutout.height);
        const cw = cutout.width * fit;
        const ch = cutout.height * fit;
        ctx.save();
        ctx.shadowColor = light ? "rgba(29,24,19,0.28)" : "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 12;
        ctx.drawImage(cutout, W / 2 - cw / 2, ringY - ch / 2, cw, ch);
        ctx.restore();
      } else if (!isWeek && photo) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(W / 2, ringY, innerR, 0, Math.PI * 2);
        ctx.clip();
        cover(ctx, photo, W / 2 - innerR, ringY - innerR, innerR * 2, innerR * 2);
        ctx.restore();
      } else {
        drawPlate(ctx, W / 2, ringY, innerR, isWeek ? averagePlate(data.entries) : entry.plate, isWeek ? "week" : entry.name);
      }
      if (!preview) drawShare.statsHero = !isWeek && (cutout || photo) ? (cutout ? "cutout" : "photo") : "plate";

      // the score itself, big, under the ring
      ctx.textAlign = "center";
      ctx.fillStyle = ink;
      ctx.font = serif(story ? 216 : 132);
      const scoreY = ringY + ringR + (story ? 232 : 146);
      // r18: the number carries its scale ("/100") so it reads as a score, not a count
      const scoreText = String(score);
      const scoreW = ctx.measureText(scoreText).width;
      ctx.font = serif(story ? 64 : 42);
      const outOfW = ctx.measureText("/100").width;
      const scoreX = W / 2 - outOfW / 2;
      ctx.font = serif(story ? 216 : 132);
      ctx.fillText(scoreText, scoreX, scoreY);
      ctx.textAlign = "left";
      ctx.fillStyle = sub;
      ctx.font = serif(story ? 64 : 42);
      ctx.fillText("/100", scoreX + scoreW / 2 + (story ? 8 : 6), scoreY);
      ctx.textAlign = "center";
      // r18: the label is ink and bold so the metric is understood at feed size; the date follows quieter
      const when = isWeek ? "LAST 7 DAYS" : new Date(entry.ts).toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase();
      const labelText = `PLATE SCORE · ${L.healthLabel(score).toUpperCase()}`;
      const whenText = `  ·  ${when}`;
      ctx.font = mono(story ? 38 : 30, 700);
      const labelW = ctx.measureText(labelText).width;
      ctx.font = mono(story ? 30 : 24, 600);
      const whenW = ctx.measureText(whenText).width;
      const labelX = W / 2 - (labelW + whenW) / 2;
      const labelY = scoreY + (story ? 58 : 44);
      ctx.textAlign = "left";
      ctx.fillStyle = ink;
      ctx.font = mono(story ? 38 : 30, 700);
      ctx.fillText(labelText, labelX, labelY);
      ctx.fillStyle = sub;
      ctx.font = mono(story ? 30 : 24, 600);
      ctx.fillText(whenText, labelX + labelW, labelY);
      ctx.textAlign = "center";

      // stat grid anchored to the bottom, dish title fills the gap above it
      const rowStep = story ? 210 : 0;
      const gridTop = H - (story ? 150 : 70) - (story ? 96 : 76) - rowStep * (rows - 1);
      const ruleY = gridTop - (story ? 70 : 52);
      ctx.font = serif(story ? 92 : 60);
      const titleLines = wrapText(ctx, title, W - pad * 2, story ? 2 : 1);
      const titleStep = story ? 104 : 0;
      const titleSpace = ruleY - (scoreY + (story ? 58 : 44));
      let titleY = scoreY + (story ? 58 : 44) + titleSpace / 2 - (titleStep * (titleLines.length - 1)) / 2 + (story ? 32 : 22);
      ctx.fillStyle = ink;
      for (const line of titleLines) {
        ctx.fillText(line, W / 2, titleY);
        titleY += titleStep;
      }
      ctx.textAlign = "left";
      ctx.save();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = light ? "#1d1813" : "#ffffff";
      ctx.fillRect(pad, ruleY, W - pad * 2, 3);
      ctx.restore();
      const colW = (W - pad * 2) / 2;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < 2; col++) {
          const [label, value] = cells[row * 2 + col];
          statBlock(pad + col * colW, gridTop + row * rowStep, label, value, story ? 76 : 60, colW - 40);
        }
      }
      return;
    }

    if (isWeek) {
      const data = weekData();
      brand(pad + 20);
      ctx.fillStyle = ink;
      ctx.font = serif(96);
      ctx.fillText("My week", pad, pad + 160);
      ctx.fillText("on a plate", pad, pad + 260);
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = L.dayKey(date);
        days.push({ date, meals: data.entries.filter((item) => L.dayKey(item.ts) === key) });
      }
      const top = size === "story" ? 520 : 400;
      const cell = (W - pad * 2) / 7;
      days.forEach((day, column) => {
        const cx = pad + cell * column + cell / 2;
        ctx.textAlign = "center";
        ctx.fillStyle = sub;
        ctx.font = mono(26, 600);
        ctx.fillText(day.date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(), cx, top);
        const rows = size === "story" ? 3 : 2;
        day.meals.slice(0, rows).forEach((meal, row) => {
          drawPlate(ctx, cx, top + 70 + row * (cell + 18), cell * 0.42, meal.plate, meal.name);
        });
      });
      ctx.textAlign = "left";
      const statsTop = size === "story" ? 1300 : 790;
      const colW = (W - pad * 2) / 2;
      statBlock(pad, statsTop, "Meals", String(data.entries.length), 84, colW - 32);
      statBlock(pad + colW, statsTop, "Spent", money(data.spend.total), 64, colW - 32);
      if (size === "story") {
        statBlock(pad, statsTop + 220, "Plate score", String(data.avg), 84, colW - 32);
        statBlock(pad + colW, statsTop + 220, "Variety", String(data.variety), 84, colW - 32);
      }
      return;
    }

    // single meal card: text block anchored to the bottom, the plate fills what is left above it
    const square = size === "square";
    const bleed = bg === "photo" && !!backdrop;
    const titleSize = square ? 76 : 104;
    const titleStep = square ? 90 : 120;
    ctx.font = serif(titleSize);
    const titleLines = wrapText(ctx, entry.name, W - pad * 2, 2);
    // the full-bleed photo keeps one row of three hero stats so the food has the frame
    const rowGap = square || bleed ? 0 : 200;
    const blockHeight = titleStep * titleLines.length + (square ? 36 : 56) + (square ? 62 : 84) + rowGap + (square ? 76 : 84);
    const baseY = H - (square ? 70 : 150) - blockHeight;
    const top = square ? 100 : 150;
    const room = baseY - 60 - top;
    const box = Math.min(square ? 440 : 860, room);
    const boxX = (W - box) / 2;
    const boxY = top + (room - box) / 2;
    let heroTop = 0;
    if (bleed && heroFit === "top") heroTop = paintLetterbox(backdrop, baseY - 40);
    if (bleed && heroFit === "cover") {
      // scrim band: clear over the food, deepening to a solid strip under the title and stats
      const bandTop = baseY - (square ? 300 : 420);
      const band = ctx.createLinearGradient(0, bandTop, 0, baseY + 40);
      band.addColorStop(0, "rgba(20,14,10,0)");
      band.addColorStop(0.55, "rgba(20,14,10,0.62)");
      band.addColorStop(1, "rgba(20,14,10,0.86)");
      ctx.fillStyle = band;
      ctx.fillRect(0, bandTop, W, baseY + 40 - bandTop);
      ctx.fillStyle = "rgba(20,14,10,0.86)";
      ctx.fillRect(0, baseY + 40, W, H - baseY - 40);
    }
    if (bleed && !preview) drawShare.photoHero = { mode: "bleed", fit: heroFit, x: 0, y: heroTop, width: W, height: heroH, upscale: heroUpscale, textTop: baseY - 34 };
    brand(pad + 20);
    if (bg !== "photo") {
      if (cutout) {
        // food-only cutout sits on the card like a sticker, no box around it
        const fit = Math.min(box / cutout.width, box / cutout.height);
        const cw = cutout.width * fit;
        const ch = cutout.height * fit;
        ctx.save();
        ctx.shadowColor = "rgba(29,24,19,0.28)";
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 18;
        ctx.drawImage(cutout, boxX + (box - cw) / 2, boxY + (box - ch) / 2, cw, ch);
        ctx.restore();
      } else if (photo) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(boxX, boxY, box, box, 36) : ctx.rect(boxX, boxY, box, box);
        ctx.clip();
        cover(ctx, photo, boxX, boxY, box, box);
        ctx.restore();
      } else {
        drawPlate(ctx, W / 2, boxY + box / 2, box * 0.46, entry.plate, entry.name);
      }
    }
    // plate score as a tilted stamp on the top-right rim, the one sticker-like flourish;
    // on the full-bleed photo it sits just above the title band, clear of the food's centre
    const score = L.healthScore(entry.plate);
    const stampR = square ? 92 : 124;
    const plateR = box * 0.46;
    const onRim = bg !== "photo";
    const stampX = onRim ? W / 2 + plateR * Math.SQRT1_2 : W - pad - stampR;
    const stampY = onRim ? boxY + box / 2 - plateR * Math.SQRT1_2 : baseY - stampR - 40;
    if (!preview) drawShare.stamp = { x: stampX, y: stampY, r: stampR, ink: bandInk(score) };
    drawScoreStamp(ctx, stampX, stampY, stampR, score, L.healthLabel(score), serif, mono);

    ctx.fillStyle = sub;
    ctx.font = mono(30, 600);
    const metaLine = [new Date(entry.ts).toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase(), entry.place ? entry.place.toUpperCase() : null, SOURCES[entry.source] ? SOURCES[entry.source].toUpperCase() : null].filter(Boolean).join(" · ");
    ctx.fillText(wrapText(ctx, metaLine, W - pad * 2, 1)[0], pad, baseY);
    ctx.fillStyle = ink;
    ctx.font = serif(titleSize);
    titleLines.forEach((line, index) => ctx.fillText(line, pad, baseY + titleStep * (index + 1)));
    const tearY = baseY + titleStep * titleLines.length + (square ? 36 : 56);
    drawTearLine(ctx, W, tearY, light ? "#c9bba3" : "rgba(255,255,255,0.55)", bg === "paper" ? "#f5efe3" : bg === "ink" ? "#1d1813" : null);
    const statsY = tearY + (square ? 62 : 84);
    const gutter = 32;
    const times = timesEaten(entry);
    const eaten = times === 1 ? "1st time" : `${times}×`;
    // price gets the wide column; rating and how often share the rest
    const priceW = (W - pad * 2) * 0.46;
    const smallW = (W - pad * 2 - priceW) / 2;
    statBlock(pad, statsY, "Price", money(entry.price), square ? 56 : 68, priceW - gutter);
    statBlock(pad + priceW, statsY, "Rating", entry.rating ? `${entry.rating}/5` : "–", square ? 56 : 68, smallW - gutter);
    if (bleed) {
      statBlock(pad + priceW + smallW, statsY, "Taste", (entry.tastes || [])[0] || entry.cuisine || "–", square ? 56 : 68, smallW - gutter);
      return;
    }
    statBlock(pad + priceW + smallW, statsY, "Eaten", eaten, square ? 56 : 68, smallW - gutter);
    if (!square) {
      // second row: what makes this meal yours (taste, cuisine, who with)
      const rowY = statsY + rowGap;
      const withWho = (entry.friends || []).map((id) => (personById(id) || {}).name).filter(Boolean);
      statBlock(pad, rowY, "Taste", (entry.tastes || []).join(" · ") || "–", 56, priceW - gutter);
      statBlock(pad + priceW, rowY, "Cuisine", entry.cuisine || "–", 56, smallW - gutter);
      statBlock(pad + priceW + smallW, rowY, "With", withWho.length ? withWho.join(", ") : "Solo", 56, smallW - gutter);
      // r28: a printed foot (a short barcode and the diary line) so the lower edge reads finished, not empty
      const footY = H - (bg === "paper" ? 74 : 58);
      if (footY - rowY > 150) {
        ctx.save();
        ctx.fillStyle = sub;
        let barX = pad;
        const seed = String(entry.id || entry.name || "lahap");
        for (let i = 0; i < 34; i += 1) {
          const code = seed.charCodeAt(i % seed.length) + i * 7;
          const barW = 2 + (code % 3) * 2;
          ctx.fillRect(barX, footY - 30, barW, 30);
          barX += barW + 3 + (code % 2) * 2;
        }
        ctx.font = mono(24, 600);
        ctx.textAlign = "right";
        const footText = `LAHAP · FOOD DIARY · NO. ${String(timesEaten(entry)).padStart(2, "0")}`;
        ctx.fillText(footText, W - pad, footY - 6);
        ctx.restore();
        if (!preview) drawShare.footer = { y: footY, top: footY - 30, statsBottom: rowY + 70, text: footText, barsRight: barX };
      }
    }
  }

  // r21: every stamp inks in its band colour, the same green / amber / red as the app's score chips
  function bandInk(score) {
    return score >= 75 ? "#3f7a2f" : score >= 50 ? "#a5761c" : "#b4380f";
  }

  // round rubber-stamp badge: score in the middle, label underneath, slightly rotated
  function drawScoreStamp(ctx, x, y, r, score, label, serif, mono) {
    ctx.save();
    ctx.shadowColor = "rgba(29,24,19,0.25)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.translate(x, y);
    ctx.rotate(-0.21);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = bandInk(score);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(3, r * 0.035);
    ctx.setLineDash([r * 0.09, r * 0.06]);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = mono(Math.round(r * 0.2), 700);
    ctx.fillText("PLATE", 0, -r * 0.36);
    ctx.font = serif(Math.round(r * 0.78));
    ctx.fillText(String(score), 0, r * 0.26);
    ctx.font = mono(Math.round(r * 0.19), 700);
    let fitted = label.toUpperCase();
    while (ctx.measureText(fitted).width > r * 1.4 && fitted.length > 3) fitted = fitted.slice(0, -1);
    ctx.fillText(fitted, 0, r * 0.58);
    ctx.restore();
    ctx.textAlign = "left";
  }

  function timesEaten(entry) {
    const name = (entry.name || "").trim().toLowerCase();
    return state.entries.filter((item) => (item.name || "").trim().toLowerCase() === name).length || 1;
  }

  // dashed tear line with half-circle notches at both edges, like the diary tickets
  function drawTearLine(ctx, W, y, stroke, notchFill) {
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(W - 60, y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (notchFill) {
      ctx.fillStyle = "rgba(29,24,19,0.10)";
      for (const x of [0, W]) {
        ctx.beginPath();
        ctx.arc(x, y, 28, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawReceipt(ctx, W, H, entry, isWeek, mono, serif, size, preview) {
    // r20: a till receipt, not a recoloured Card - shop header, struk number, QTY column,
    // a rubber-stamped plate score and a barcode; no plate glyph leading the slip
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    const paperW = 760;
    const x = (W - paperW) / 2;
    const items = isWeek ? weekData().entries.slice().sort((a, b) => new Date(a.ts) - new Date(b.ts)) : [entry];
    const maxItems = size === "story" ? 16 : 6;
    const shown = items.slice(-maxItems);
    const lineH = 52;
    const extraRows = isWeek ? 0 : 3;
    const paperH = Math.min(H - 160, 760 + (shown.length + extraRows) * lineH);
    const y = (H - paperH) / 2;
    // scale the slip up so it fills the frame instead of floating as a small sticker
    const fill = Math.min((W - 100) / paperW, (H - 140) / paperH, 1.3);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(fill, fill);
    ctx.translate(-W / 2, -H / 2);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#fffdf8";
    ctx.beginPath();
    const teeth = 24;
    const tooth = paperW / teeth;
    ctx.moveTo(x, y + 14);
    for (let i = 0; i < teeth; i++) {
      ctx.lineTo(x + tooth * i + tooth / 2, y);
      ctx.lineTo(x + tooth * (i + 1), y + 14);
    }
    ctx.lineTo(x + paperW, y + paperH - 14);
    for (let i = teeth; i > 0; i--) {
      ctx.lineTo(x + tooth * i - tooth / 2, y + paperH);
      ctx.lineTo(x + tooth * (i - 1), y + paperH - 14);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const left = x + 56;
    const right = x + paperW - 56;
    const ink = "#1d1813";
    const faded = "#5e554a";
    // a stable struk number per meal / week so the same slip always prints the same number
    const seedText = isWeek ? "week" + new Date().toDateString() : entry.name + entry.ts;
    let seed = 0;
    for (const char of seedText) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
    const struk = String(seed % 10000).padStart(4, "0");

    let cursor = y + 92;
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.font = serif(64);
    ctx.fillText("Lahap", W / 2, cursor);
    cursor += 44;
    ctx.font = mono(26, 600);
    ctx.fillStyle = faded;
    ctx.fillText(`FOOD DIARY · STRUK NO. ${struk}`, W / 2, cursor);
    cursor += 40;
    const dateText = isWeek ? `WEEK ENDING ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase()}` : new Date(entry.ts).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).toUpperCase();
    ctx.fillText(dateText, W / 2, cursor);
    cursor += 26;
    const rule = () => {
      ctx.save();
      ctx.strokeStyle = ink;
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left, cursor);
      ctx.lineTo(right, cursor);
      ctx.stroke();
      ctx.restore();
    };
    rule();
    cursor += 46;
    ctx.font = mono(24, 600);
    ctx.fillStyle = faded;
    ctx.textAlign = "left";
    ctx.fillText("QTY  ITEM", left, cursor);
    ctx.textAlign = "right";
    ctx.fillText("HARGA", right, cursor);
    cursor += 50;
    ctx.fillStyle = ink;
    ctx.font = mono(34, 600);
    for (const item of shown) {
      ctx.textAlign = "left";
      ctx.fillText("1x", left, cursor);
      ctx.fillText(wrapText(ctx, item.name.toUpperCase(), right - left - 330, 1)[0], left + 72, cursor);
      ctx.textAlign = "right";
      ctx.fillText(money(item.price), right, cursor);
      cursor += lineH;
    }
    if (items.length > shown.length) {
      ctx.textAlign = "left";
      ctx.fillStyle = faded;
      ctx.fillText(`+${items.length - shown.length} MORE`, left + 72, cursor);
      ctx.fillStyle = ink;
      cursor += lineH;
    }
    cursor -= 20;
    rule();
    cursor += 56;
    const total = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    const avg = items.length ? Math.round(items.reduce((sum, item) => sum + L.healthScore(item.plate), 0) / items.length) : 0;
    const rows = [["TOTAL", money(total)]];
    if (isWeek) rows.push(["VARIETY", String(L.varietyScore(items))]);
    else {
      const withWho = (entry.friends || []).map((id) => (personById(id) || {}).name).filter(Boolean);
      rows.push(["TASTE", (entry.tastes || []).join("/").toUpperCase() || "-"]);
      rows.push(["PLACE", (entry.place || "-").toUpperCase()]);
      rows.push(["EATEN", timesEaten(entry) === 1 ? "1ST TIME" : `${timesEaten(entry)}X`]);
      rows.push(["WITH", withWho.length ? withWho.join(", ").toUpperCase() : "SOLO"]);
    }
    ctx.font = mono(36, 700);
    ctx.fillStyle = ink;
    for (const [label, value] of rows) {
      ctx.textAlign = "left";
      ctx.fillText(label, left, cursor);
      ctx.textAlign = "right";
      ctx.fillText(wrapText(ctx, value, right - left - 260, 1)[0], right, cursor);
      cursor += lineH;
    }

    // the plate score is rubber-stamped, slightly crooked, in the band's ink
    const stampColor = bandInk(avg);
    const stampText = `PLATE ${avg} · ${L.healthLabel(avg).toUpperCase()}`;
    ctx.save();
    ctx.font = mono(46, 800);
    const stampW = ctx.measureText(stampText).width + 64;
    const stampH = 100;
    const stampY = cursor - 6 + stampH / 2;
    ctx.translate(W / 2, stampY);
    ctx.rotate(-0.07);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = stampColor;
    ctx.fillStyle = stampColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(-stampW / 2, -stampH / 2, stampW, stampH);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-stampW / 2 + 7, -stampH / 2 + 7, stampW - 14, stampH - 14);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(stampText, 0, 2);
    ctx.restore();
    if (!preview) drawShare.receiptStamp = stampText;
    cursor = stampY + stampH / 2 + 28;

    // barcode only when the slip has room for it above the footer
    const footerY = y + paperH - 44;
    const barH = 54;
    if (cursor + barH + 34 < footerY - 30) {
      const barW = 420;
      let bx = W / 2 - barW / 2;
      let state = seed || 7;
      ctx.fillStyle = ink;
      while (bx < W / 2 + barW / 2) {
        state = (state * 1103515245 + 12345) >>> 0;
        const width = 2 + (state % 4) * 1.5;
        ctx.fillRect(bx, cursor, width, barH);
        bx += width + 2 + ((state >> 4) % 3) * 2;
      }
      ctx.font = mono(20, 500);
      ctx.fillStyle = faded;
      ctx.textAlign = "center";
      ctx.fillText(`LHP-${struk}-${String(avg).padStart(3, "0")}`, W / 2, cursor + barH + 26);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = mono(28, 500);
    ctx.fillStyle = faded;
    ctx.fillText("TERIMA KASIH · SEE YOU NEXT MEAL", W / 2, footerY);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function openShare(subject) {
    share.subject = subject;
    const isWeek = subject === "week";
    if (!isWeek && subject.photo) share.background = "photo";
    if (isWeek && share.background === "photo") share.background = "paper";
    // r24: the first share opens on Lahap's own look - the till receipt - unless the meal has a photo,
    // which reads best as the photo Card; the week opens on its row of plates. A later pick sticks.
    if (!["card", "receipt", "stats"].includes(share.template)) share.template = isWeek || subject.photo ? "card" : "receipt";
    const dialog = $("#dlg-share");
    // r17: a single meal always offers Photo; with no photo yet, tapping it picks one and saves it to the meal
    const backgrounds = [["paper", "Paper"], ["ink", "Dark"], ["photo", !isWeek && !subject.photo ? "+ Photo" : "Photo"], ["clear", "Transparent"]].filter(([key]) => key !== "photo" || !isWeek);
    if (share.background === "photo" && (isWeek || !subject.photo)) share.background = "paper";
    const templates = [["card", isWeek ? "Plates" : "Card"], ["receipt", "Receipt"], ["stats", "Stats"]];
    dialog.innerHTML = `
      <div class="sheet-head"><h2 id="share-title">${isWeek ? "Share my week" : "Share " + esc(subject.name)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${ICON_CLOSE}</button></div>
      <div class="sheet-body share-grid">
        <div class="canvas-stage"><canvas id="share-canvas" role="img" aria-label="Share card preview"></canvas><button type="button" class="stage-zoom" id="share-zoom" aria-pressed="false" aria-label="See the card full size"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Full size</span></button></div>
        <div>
          <div class="control"><span>Template</span>
            <div class="template-prev" role="group" aria-label="Template preview">
              ${templates.map(([value, label]) => `<button type="button" class="tp-btn" data-seg="template" data-value="${value}" aria-pressed="${String(share.template === value)}"><canvas class="tp-canvas" data-tpl="${value}" width="108" height="192" role="img" aria-label="${esc(label)} template preview"></canvas><span>${esc(label)}</span></button>`).join("")}
            </div>
          </div>
          <div class="control"><span>Background <small class="share-note">· Transparent = a sticker PNG for your own photo</small></span>${segHtml("background", backgrounds, share.background)}</div>
          <div class="control"><span>Size</span>${segHtml("size", [["story", "Story 9:16"], ["square", "Post 1:1"]], share.size)}</div>
          <input type="file" id="share-photo" accept="image/*" hidden>
          <div class="btn-row share-actions">
            <button type="button" class="btn primary" id="share-save">Save PNG</button>
            <button type="button" class="btn" id="share-send">Share…</button>
          </div>
        </div>
      </div>`;
    const canvas = $("#share-canvas");
    const sendButton = $("#share-send");
    const filename = () => `lahap-${isWeek ? "week" : L.normalize(subject.name).replace(/[^a-z0-9]+/g, "-")}-${share.template}-${share.background}.png`;
    // The PNG is encoded after every redraw, not after the tap: Safari only opens the share sheet while the
    // tap is still "active" (about 5 s), and encoding a 1-2 MB card on a phone can use that up.
    let prepared = null;
    let drawToken = 0;
    const redraw = async () => {
      const token = ++drawToken;
      prepared = null;
      sendButton.disabled = true;
      for (const [value] of templates) {
        const mini = dialog.querySelector(`.tp-canvas[data-tpl="${value}"]`);
        if (mini) await drawShare(mini, { template: value, background: share.background, size: share.size, scale: 0.2, preview: true });
        if (token !== drawToken) return;
      }
      await drawShare(canvas);
      if (token !== drawToken) return;
      const tplChanged = share.template !== drawShare.lastTpl;
      drawShare.lastTpl = share.template;
      if (tplChanged && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
        drawShare.previewAnimCount = (drawShare.previewAnimCount || 0) + 1;
        try { canvas.animate([{ opacity: 0.5, transform: "scale(0.985)" }, { opacity: 1, transform: "scale(1)" }], { duration: 220, easing: "cubic-bezier(.2,.7,.3,1)" }); } catch (error) {}
      }
      canvas.toBlob((blob) => {
        if (token !== drawToken || !blob) return;
        prepared = new File([blob], filename(), { type: "image/png" });
        sendButton.disabled = false;
      }, "image/png");
    };
    // r30: the preview opens full size on a tap, so the card can be read before it is posted
    const stage = dialog.querySelector(".canvas-stage");
    const zoomButton = $("#share-zoom");
    const setZoom = (on) => {
      stage.classList.toggle("zoomed", on);
      zoomButton.setAttribute("aria-pressed", String(on));
      zoomButton.querySelector("span").textContent = on ? "Close" : "Full size";
      zoomButton.setAttribute("aria-label", on ? "Close the full-size card" : "See the card full size");
    };
    dialog.addEventListener("cancel", (event) => {
      if (stage.classList.contains("zoomed")) {
        event.preventDefault();
        setZoom(false);
      }
    });
    dialog.onclick = (event) => {
      if (event.target.closest("#share-zoom") || event.target === canvas) {
        setZoom(!stage.classList.contains("zoomed"));
        return;
      }
      if (stage.classList.contains("zoomed") && event.target === stage) {
        setZoom(false);
        return;
      }
      const button = event.target.closest("[data-seg]");
      if (!button) return;
      if (button.dataset.seg === "background" && button.dataset.value === "photo" && !isWeek && !subject.photo) {
        $("#share-photo").click();
        return;
      }
      share[button.dataset.seg] = button.dataset.value;
      for (const sibling of $$(`[data-seg="${button.dataset.seg}"]`, dialog)) sibling.setAttribute("aria-pressed", String(sibling === button));
      redraw();
    };
    $("#share-photo").addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file || isWeek) return;
      try {
        subject.photo = await resizePhoto(file);
      } catch (error) {
        toast("That photo could not be read. Try another one.");
        return;
      }
      const stored = state.entries.find((item) => item.id === subject.id);
      if (stored && stored !== subject) stored.photo = subject.photo;
      await store.put(stored || subject);
      share.background = "photo";
      openShare(subject);
      render();
      toast("Photo saved to this meal");
    });
    $("#share-save").addEventListener("click", () => {
      if (prepared) download(prepared, prepared.name);
      else canvas.toBlob((blob) => download(blob, filename()), "image/png");
    });
    sendButton.addEventListener("click", () => {
      const file = prepared;
      if (!file) return;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: "Lahap" }).catch((error) => {
          if (error && error.name === "AbortError") return; // closed the share sheet
          download(file, file.name);
          toast("The share sheet did not open, so the PNG was saved instead");
        });
      } else {
        download(file, file.name);
        toast("Sharing isn't available here, so the PNG was saved instead");
      }
    });
    redraw();
    if (!dialog.open) dialog.showModal();
  }

  /* ---------------- global events ---------------- */
  document.addEventListener("click", async (event) => {
    const target = event.target;
    const close = target.closest("[data-close]");
    if (close) {
      close.closest("dialog").close();
      return;
    }
    if (target.closest('[data-action="log"]')) {
      openLog();
      return;
    }
    if (target.closest("[data-quiz]")) {
      openQuiz();
      return;
    }
    const labSeg = target.closest('#view-lab [data-seg]');
    if (labSeg) {
      if (labSeg.dataset.seg === "labgoal") state.lab.goal = labSeg.dataset.value;
      if (labSeg.dataset.seg === "lablang") state.lab.lang = labSeg.dataset.value;
      renderLab();
      return;
    }
    if (target.closest("[data-lab-find]")) {
      state.lab.text = $("#lab-text").value;
      labAdd(R.parseIngredients(state.lab.text), "From your list");
      return;
    }
    if (target.closest("[data-lab-voice]")) {
      toggleVoice();
      return;
    }
    const labAddChip = target.closest("[data-lab-add]");
    if (labAddChip) {
      state.lab.status = "";
      labAdd([labAddChip.dataset.labAdd], null);
      return;
    }
    const labRemove = target.closest("[data-lab-remove]");
    if (labRemove) {
      state.lab.have = state.lab.have.filter((id) => id !== labRemove.dataset.labRemove);
      state.lab.status = "";
      renderLab();
      return;
    }
    const labLog = target.closest("[data-lab-log]");
    if (labLog) {
      const recipe = labResults.find((item) => item.id === labLog.dataset.labLog);
      if (!recipe) return;
      openLog({
        name: recipe.name,
        source: "home",
        place: "Home",
        cuisine: recipe.cuisine || "Home-cooked",
        price: "",
        plate: R.plateFor(recipe),
        nutrition: Object.assign({ label: `From the Lab recipe, sized for ${(N.GOALS[labGoal()] || N.GOALS.healthy).label.toLowerCase()}` }, recipe.nutrition),
        recipe: recipe.id,
        notes: "",
      });
      return;
    }
    const labShop = target.closest("[data-lab-shop]");
    if (labShop) {
      const recipe = labResults.find((item) => item.id === labShop.dataset.labShop);
      if (!recipe) return;
      const lines = recipe.items.filter((item) => !recipe.have.includes(item.id)).map((item) => "- " + R.amountLabel(item));
      const text = `Shopping for ${recipe.name}:\n${lines.join("\n")}`;
      try {
        await navigator.clipboard.writeText(text);
        toast(`Shopping list copied (${lines.length} items)`);
      } catch (error) {
        state.lab.text = text;
        renderLab();
        toast("Could not reach the clipboard, so the list is in the box above");
      }
      return;
    }
    const open = target.closest("[data-open]");
    if (open) {
      openDetail(open.dataset.open);
      return;
    }
    const again = target.closest("[data-again]");
    if (again) {
      const entry = state.entries.find((item) => item.id === again.dataset.again);
      const detail = $("#dlg-detail");
      if (detail.open) detail.close();
      const copy = Object.assign({}, entry, { ts: new Date().toISOString(), photo: null, cutout: null, friends: [], notes: "" });
      delete copy.id;
      delete copy.sample;
      openLog(copy);
      return;
    }
    const edit = target.closest("[data-edit]");
    if (edit) {
      $("#dlg-detail").close();
      openLog(state.entries.find((item) => item.id === edit.dataset.edit));
      return;
    }
    const remove = target.closest("[data-delete]");
    if (remove) {
      if (!confirm("Delete this meal?")) return;
      await store.remove(remove.dataset.delete);
      state.entries = state.entries.filter((item) => item.id !== remove.dataset.delete);
      $("#dlg-detail").close();
      toast("Meal deleted");
      render();
      return;
    }
    const shareButton = target.closest("[data-share]");
    if (shareButton) {
      $("#dlg-detail").close();
      openShare(state.entries.find((item) => item.id === shareButton.dataset.share));
      return;
    }
    if (target.closest("[data-invite]")) {
      const url = inviteLink();
      const text = "Let's compare food tastes on Lahap (free, no account). Open this and I show up as your taste bud - the link only has my taste profile, no meals:";
      if (navigator.share) {
        try {
          await navigator.share({ title: "Lahap", text, url });
        } catch (error) {
          /* user closed the share sheet */
        }
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
      }
      return;
    }
    if (target.closest("[data-accept-bud]") && state.pendingBud) {
      const person = budFromInvite(state.pendingBud);
      if (!personById(person.id)) PEOPLE.push(person);
      await store.set("people", PEOPLE.filter((item) => item.invited));
      state.pendingBud = null;
      await addFriend(person.id);
      return;
    }
    if (target.closest("[data-dismiss-bud]")) {
      state.pendingBud = null;
      render();
      return;
    }
    if (target.closest("[data-share-week]")) {
      openShare("week");
      return;
    }
    if (target.closest("[data-sample]")) {
      await loadSample();
      toast("Sample fortnight loaded");
      render();
      return;
    }
    const source = target.closest("[data-source]");
    if (source) {
      state.sourceFilter = source.dataset.source;
      render();
      return;
    }
    if (target.closest("[data-taste-toggle]")) {
      state.tastesOpen = !(state.tastesOpen || state.tasteFilter.length > 0);
      if (!state.tastesOpen) state.tasteFilter = [];
      render();
      return;
    }
    const taste = target.closest("[data-taste]");
    if (taste) {
      const value = taste.dataset.taste;
      state.tasteFilter = state.tasteFilter.includes(value) ? state.tasteFilter.filter((item) => item !== value) : state.tasteFilter.concat(value);
      render();
      return;
    }
    const period = target.closest("[data-period]");
    if (period) {
      state.period = Number(period.dataset.period);
      render();
      return;
    }
    const add = target.closest("[data-add]");
    if (add) {
      addFriend(add.dataset.add);
      return;
    }
    const hangout = target.closest("[data-hangout]");
    if (hangout) {
      openHangout(hangout.dataset.hangout);
      return;
    }
    const done = target.closest("[data-done]");
    if (done) {
      inviteDone(done.dataset.done);
      return;
    }
    const cancel = target.closest("[data-cancel]");
    if (cancel) {
      state.invites = state.invites.filter((invite) => invite.id !== cancel.dataset.cancel);
      await saveMeta();
      render();
      return;
    }
    const tagMeal = target.closest("[data-tag-meal]");
    if (tagMeal) {
      openLog({ friends: [tagMeal.dataset.tagMeal] });
      return;
    }
    const removeBud = target.closest("[data-remove]");
    if (removeBud) {
      removeFriend(removeBud.dataset.remove);
      return;
    }
  });

  document.addEventListener("change", async (event) => {
    if (event.target.id !== "lab-photo") return;
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await readListPhoto(file);
      state.lab.text = [state.lab.text, text.replace(/\s+/g, " ").trim()].filter(Boolean).join(", ");
      labAdd(R.parseIngredients(text), "Scanned list");
    } catch (error) {
      state.lab.status = "Could not read that photo. The scanner reads written lists, receipts and labels, not photos of the food itself.";
      renderLab();
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "q") {
      state.query = event.target.value;
      renderDiary();
    }
  });

  // click on the dim backdrop closes a sheet
  for (const dialog of $$("dialog")) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  window.addEventListener("hashchange", route);
  // r19: the Diary order differs on phone, so re-render when the viewport crosses the phone breakpoint
  if (window.matchMedia) {
    const phoneMedia = window.matchMedia(PHONE_QUERY);
    const onPhoneChange = () => {
      if (state.view === "diary") renderDiary();
    };
    if (phoneMedia.addEventListener) phoneMedia.addEventListener("change", onPhoneChange);
  }

  async function init() {
    await store.open();
    state.entries = await store.all();
    state.settings = Object.assign(state.settings, await store.get("settings", {}));
    state.friends = await store.get("friends", []);
    state.points = await store.get("points", {});
    state.invites = await store.get("invites", []);
    for (const person of await store.get("people", [])) {
      if (!personById(person.id)) PEOPLE.push(person);
    }
    const params = new URLSearchParams(location.search);
    if (params.has("bud")) {
      const profile = decodeBud(params.get("bud"));
      const known = profile && state.friends.includes(budFromInvite(profile).id);
      state.pendingBud = profile && !known ? profile : null;
      const rest = new URLSearchParams(location.search);
      rest.delete("bud");
      history.replaceState(null, "", location.pathname + (rest.toString() ? "?" + rest : "") + location.hash);
    }
    if (params.has("demo") && !state.entries.length) await loadSample();
    if (params.has("demo") && !state.settings.profile) state.settings.profile = Object.assign({}, SAMPLE_PROFILE);
    route();
    document.documentElement.dataset.ready = "1";
    // first run: a short quiz to learn the goal (skippable, never in the demo or tests)
    if (!state.settings.quizSeen && !state.settings.profile && !params.has("demo") && !params.has("noquiz")) openQuiz();
    if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !params.has("nosw")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  // test hook
  window.Lahap = { state, render, inviteLink, openLog, openShare, openHangout, openQuiz, drawShare, loadSample, sampleEntries, renderLab, nutritionFor, readListPhoto, removeFriend, emptyHtml };

  init();
})();
