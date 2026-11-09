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
    state.view = VIEWS.includes(hash) ? hash : "diary";
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
      </button>`;
  }

  function answerHtml(query, matches) {
    if (!query.trim()) return "";
    const summary = L.summarize(matches);
    if (!summary) {
      return `<div class="answer" role="status"><h2>Not in your diary yet</h2><p class="muted">No meal matches “${esc(query)}”. Try a place, a taste like “spicy”, or a friend's name.</p></div>`;
    }
    const last = summary.last;
    const range = summary.minPrice === summary.maxPrice ? money(summary.minPrice) : `${money(summary.minPrice)} – ${money(summary.maxPrice)}`;
    return `
      <div class="answer" role="status">
        <p class="eyebrow">Have I eaten this?</p>
        <h2>Yes, ${summary.count} ${summary.count === 1 ? "time" : "times"}. Last ${esc(relative(last.ts))}${last.place ? " at " + esc(last.place) : ""}.</h2>
        <dl>
          <div><dt>Avg price</dt><dd>${esc(money(summary.avgPrice))}</dd></div>
          <div><dt>Price range</dt><dd>${esc(range)}</dd></div>
          <div><dt>Avg plate score</dt><dd>${summary.avgHealth}</dd></div>
          <div><dt>Avg rating</dt><dd>${summary.avgRating ? summary.avgRating.toFixed(1) + " / 5" : "–"}</dd></div>
          <div><dt>Where</dt><dd>${esc(summary.places.join(", ") || "–")}</dd></div>
          <div><dt>First logged</dt><dd>${esc(new Date(summary.first.ts).toLocaleDateString(undefined, { day: "numeric", month: "short" }))}</dd></div>
        </dl>
        <div class="btn-row" style="margin-top:12px"><button type="button" class="btn" data-again="${esc(last.id)}">Log “${esc(last.name)}” again</button></div>
      </div>`;
  }

  function weekAsideHtml() {
    const week = L.withinDays(state.entries, 7);
    const spend = L.spendSummary(week);
    const avg = week.length ? Math.round(week.reduce((sum, entry) => sum + L.healthScore(entry.plate), 0) / week.length) : 0;
    const onRepeat = L.repeats(week, 3).slice(0, 3);
    return `
      <aside class="panel" aria-labelledby="week-title">
        <p class="eyebrow">Last 7 days</p>
        <h2 id="week-title">Your week on a plate</h2>
        <div class="stat-grid">
          <div class="stat"><div class="label">Meals</div><div class="value">${week.length}</div></div>
          <div class="stat"><div class="label">Variety</div><div class="value">${L.varietyScore(week)}</div></div>
          <div class="stat"><div class="label">Health (plate score)</div><div class="value">${avg}</div><div class="note">${esc(L.healthLabel(avg))}</div></div>
          <div class="stat"><div class="label">Spent</div><div class="value money">${esc(money(spend.total))}</div></div>
        </div>
        ${onRepeat.length ? `<p class="notice">On repeat: ${onRepeat.map((item) => `${esc(item.name)} ×${item.count}`).join(", ")}.</p>` : ""}
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
      ? `<button type="button" class="btn" data-hangout="${best.person.id}">Hang out</button>`
      : `<button type="button" class="btn" data-add="${best.person.id}">Add bud</button>`;
    return `<div class="bud-nudge"><span class="avatar" style="background:${best.person.color || "var(--accent)"}">${esc(best.person.name[0])}</span><span><strong>${esc(best.person.name)} · ${best.match}% match</strong><span class="muted small">${esc(reasonsFor(best.person))}</span></span>${action}</div>`;
  }

  function weekLineHtml() {
    const week = L.withinDays(state.entries, 7);
    const spend = L.spendSummary(week);
    const avg = week.length ? Math.round(week.reduce((sum, entry) => sum + L.healthScore(entry.plate), 0) / week.length) : 0;
    return `
      <div class="weekline">
        <dl>
          <div><dt>7-day meals</dt><dd>${week.length}</dd></div>
          <div><dt>Variety</dt><dd>${L.varietyScore(week)}</dd></div>
          <div><dt>Health</dt><dd>${avg} <small>${esc(L.healthLabel(avg))}</small></dd></div>
          <div><dt>Spent</dt><dd>${esc(money(spend.total))}</dd></div>
        </dl>
        <button type="button" class="btn small" data-share-week>Share my week</button>
      </div>`;
  }

  function emptyHtml() {
    return `
      <div class="empty">
        <canvas id="empty-plate" width="240" height="240" aria-hidden="true"></canvas>
        <h2>Your plate is empty</h2>
        <p>Log a meal in about 15 seconds: dish, place, price, and how the plate looked. Everything stays on this device.</p>
        <div class="btn-row">
          <button type="button" class="btn primary" data-action="log">Log your first meal</button>
          <button type="button" class="btn" data-sample>Try with a sample fortnight</button>
        </div>
      </div>`;
  }

  function renderDiary() {
    const root = $("#view-diary");
    const filters = `
      <div class="chips filters" role="group" aria-label="Filter meals">
        ${["all", "out", "home", "delivery"].map((key) => `<button type="button" class="chip" data-source="${key}" aria-pressed="${state.sourceFilter === key}">${key === "all" ? "All" : esc(SOURCES[key])}</button>`).join("")}
        ${TASTES.map((taste) => `<button type="button" class="chip" data-taste="${taste}" aria-pressed="${state.tasteFilter.includes(taste)}">${taste}</button>`).join("")}
      </div>`;
    const head = `
      <div class="view-head diary-head">
        <div>
          <h1>What did I eat?</h1>
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
    const days = groups.map((group) => {
      const spend = group.entries.reduce((sum, entry) => sum + (Number(entry.price) || 0), 0);
      const avg = Math.round(group.entries.reduce((sum, entry) => sum + L.healthScore(entry.plate), 0) / group.entries.length);
      return `
        <section class="day" aria-label="${esc(dayLabel(group.entries[0].ts))}">
          <div class="day-head">
            <h2>${esc(dayLabel(group.entries[0].ts))}</h2>
            <span class="mono">${plural(group.entries.length, "meal")} · ${esc(money(spend))} · health ${avg}</span>
          </div>
          ${group.entries.map(ticketHtml).join("")}
        </section>`;
    }).join("");
    const keepFocus = document.activeElement && document.activeElement.id === "q";
    const caret = keepFocus ? document.activeElement.selectionStart : null;
    root.innerHTML = `
      ${head}
      <div class="split">
        <div>
          <form class="search" role="search" onsubmit="return false">
            ${ICON_SEARCH}
            <label class="sr" for="q" style="position:absolute;left:-9999px">Search your meals</label>
            <input id="q" type="search" placeholder="Have I eaten this? Try “bakso”" value="${esc(state.query)}" autocomplete="off">
          </form>
          ${filters}
          ${state.query ? "" : todayHtml()}
          ${weekLineHtml()}
          ${answerHtml(state.query, list)}
          ${days ? days.replace("</section>", () => `</section>${state.query ? "" : budNudgeHtml()}`) : '<p class="muted">No meals match these filters.</p>'}
        </div>
        ${weekAsideHtml()}
      </div>`;
    if (keepFocus) {
      const input = $("#q");
      input.focus();
      input.setSelectionRange(caret, caret);
    }
  }

  /* ---------------- insights ---------------- */
  function radarSvg(vector) {
    const size = 260;
    const center = size / 2;
    const radius = 92;
    const points = (values) => values.map((value, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / values.length;
      return [center + Math.cos(angle) * radius * value, center + Math.sin(angle) * radius * value];
    });
    const rings = [0.33, 0.66, 1].map((level) => `<polygon points="${points(vector.map(() => level)).map((p) => p.join(",")).join(" ")}" fill="none" stroke="#e0d5c2"/>`).join("");
    const labels = points(vector.map(() => 1.22)).map((p, index) => `<text x="${p[0]}" y="${p[1]}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="600" fill="#1d1813">${TASTES[index]}</text>`).join("");
    const shape = points(vector.map((value) => Math.max(0.06, value))).map((p) => p.join(",")).join(" ");
    return `<svg class="radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="Taste profile: ${TASTES.map((taste, index) => `${taste} ${Math.round(vector[index] * 100)}%`).join(", ")}">${rings}<polygon points="${shape}" fill="rgba(180,56,15,0.22)" stroke="#b4380f" stroke-width="2.5"/>${labels}</svg>`;
  }

  function barsHtml(items, max) {
    return `<div class="bars">${items.map((item) => `
      <div class="bar-row"><span>${esc(item.name)}</span><span class="track"><span class="fill" style="display:block;width:${Math.round((item.count / max) * 100)}%"></span></span><span class="n">${item.count}</span></div>`).join("")}</div>`;
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
          ${strip}
          <p class="notice">Plate score is a simple rule: veg and protein add points, deep-fried, sugary and processed take points off. It is a nudge, not medical advice.</p>
        </section>
        <section class="panel">
          <h2>Taste profile</h2>
          ${radarSvg(L.tasteVector(entries))}
        </section>
        <section class="panel">
          <h2>Cuisines</h2>
          ${cuisines.length ? barsHtml(cuisines, cuisines[0].count) : '<p class="muted">No meals in this period.</p>'}
          ${onRepeat.length ? `<h3 style="margin-top:20px">On repeat</h3><p>${onRepeat.map((item) => `${esc(item.name)} <span class="mono">×${item.count}</span>`).join(" · ")}</p>` : ""}
        </section>
        <section class="panel">
          <h2>Top places</h2>
          ${places.length ? places.map((place) => `<div class="person" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="name">${esc(place.name)}</div><div class="why">${place.count} visits · ${esc(place.cuisines.join(", "))}</div></div><span class="mono">${esc(money(place.spend))}</span></div>`).join("") : '<p class="muted">No places yet.</p>'}
        </section>
        <section class="panel">
          <h2>Where the money went</h2>
          ${barsHtml(Object.keys(SOURCES).map((key) => ({ name: SOURCES[key], count: Math.round(spend[key] / 1000) })), Math.max(1, Math.round(Math.max(spend.out, spend.home, spend.delivery) / 1000)))}
          <p class="notice">Bars in thousands of ${esc(state.settings.currency)}. Out ${esc(money(spend.out))}, home ${esc(money(spend.home))}, delivery ${esc(money(spend.delivery))}.</p>
        </section>
      </div>`;
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

  function avatar(person) {
    return `<span class="avatar" style="background:${person.color}" aria-hidden="true">${esc(person.name[0])}</span>`;
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
        <p class="muted">Send Lahap to someone you eat with. Once they log a few meals too, you can compare tastes and plan where to makan next.</p>
        <button type="button" class="btn primary" data-invite>Invite a friend</button>
      </section>`;
  }

  function renderBuds() {
    const root = $("#view-buds");
    const friends = PEOPLE.filter((person) => state.friends.includes(person.id));
    const others = PEOPLE.filter((person) => !state.friends.includes(person.id))
      .map((person) => ({ person, match: matchFor(person) }))
      .sort((a, b) => b.match - a.match);
    const totalPoints = Object.values(state.points).reduce((sum, value) => sum + value, 0);
    const invites = state.invites.slice().sort((a, b) => new Date(a.when) - new Date(b.when));

    root.innerHTML = `
      <div class="view-head">
        <div><h1>Taste buds</h1><p>Friends ranked by how close their taste is to yours. Tag them in meals and eat together to grow the connection.</p></div>
        <div class="stat" style="min-width:160px"><div class="label">Connection points</div><div class="value">${totalPoints}</div></div>
      </div>
      <div class="split">
        <div>
          <section class="panel">
            <h2>Your buds</h2>
            ${friends.length ? friends.map((person) => {
              const points = state.points[person.id] || 0;
              const level = L.levelFor(points);
              return `<div class="person">${avatar(person)}<div><div class="name">${esc(person.name)} <span class="match">${matchLabel(matchFor(person))}</span></div><div class="why">${esc(level.name)} · ${points} pts</div>${level.next ? `<div class="next-step">${esc(nextStep(level))}</div>` : ""}<div class="level"><div class="track"><div class="fill" style="width:${Math.round(level.progress * 100)}%"></div></div></div></div><button type="button" class="btn" data-hangout="${person.id}">Hang out</button></div>`;
            }).join("") : '<p class="muted">No buds yet. Invite a friend, or add an example profile below to try tagging and hangouts.</p>'}
          </section>
          ${friends.length ? "" : inviteHtml()}
          <section class="panel">
            <h2>${hasTasteProfile() ? "Suggested by taste" : "Example buds to try"}</h2>
            ${others.length ? others.map(({ person, match }) => `<div class="person">${avatar(person)}<div><div class="name">${esc(person.name)} <span class="match">${matchLabel(match)}</span></div><div class="why">${esc(hasTasteProfile() ? reasonsFor(person) : "Log a few meals to see what you share")} · ${esc(person.area)}</div></div><button type="button" class="btn" data-add="${person.id}">Add</button></div>`).join("") : '<p class="muted">You added everyone. Nice.</p>'}
            <p class="notice">These are example profiles so you can try matching, tagging and hangouts. Lahap has no server yet: buds and points stay on this device, and invites go out through WhatsApp or your phone's share sheet.</p>
          </section>
          ${friends.length ? inviteHtml() : ""}
        </div>
        <aside>
          <section class="panel">
            <h2>Plans</h2>
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
              <tr><td>Hang out and mark “We went”</td><td>+${L.POINTS.hangout}</td></tr>
              ${L.LEVELS.slice(1).map((level) => `<tr><td>${esc(level.name)}</td><td>${level.min} pts</td></tr>`).join("")}
            </table>
          </section>
        </aside>
      </div>`;
  }

  // e.g. "Regular in 40 pts: 1 hangout + 2 tagged meals"
  function nextStep(level) {
    const hangouts = Math.floor(level.toNext / L.POINTS.hangout);
    const tags = Math.ceil((level.toNext - hangouts * L.POINTS.hangout) / L.POINTS.tag);
    const parts = [];
    if (hangouts) parts.push(`${hangouts} hangout${hangouts > 1 ? "s" : ""}`);
    if (tags) parts.push(`${tags} tagged meal${tags > 1 ? "s" : ""}`);
    return `${level.next} in ${level.toNext} pts: ${parts.join(" + ")}`;
  }

  function suggestedPlanHtml(friends) {
    const best = friends.map((person) => ({ person, match: matchFor(person) })).sort((a, b) => b.match - a.match)[0];
    if (!best) return '<p class="muted">No plans yet. Add a bud first.</p>';
    const place = L.topPlaces(state.entries, 20).find((item) => item.name !== "Home" && item.cuisines.some((cuisine) => best.person.cuisines.includes(cuisine)));
    return `<div class="invite suggested"><span class="eyebrow">Suggested</span><strong>Makan with ${esc(best.person.name)}${place ? " at " + esc(place.name) : ""}</strong><span class="muted small">${best.match}% match. ${esc(reasonsFor(best.person))}.</span><div class="btn-row"><button type="button" class="btn primary" data-hangout="${best.person.id}">Plan it</button></div></div>`;
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
      <div class="view-head"><div><h1>Me</h1><p>Your diary lives in this browser only. No account, no server, no ads.</p></div></div>
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
        ${missing ? '<p class="notice">Some details were blank, so these use average values. Retake the quiz from Me any time.</p>' : ""}
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
    return `
      <article class="recipe">
        <div class="recipe-head">
          <h3>${esc(recipe.name)}</h3>
          <span class="mono small">${recipe.minutes} min · ${recipe.nutrition.kcal} kcal · ${recipe.nutrition.p} g protein</span>
        </div>
        ${fit || need ? `<p class="small">${esc(fit + need)}</p>` : ""}
        <details${index === 0 ? " open" : ""}>
          <summary>Ingredients and steps</summary>
          <ul class="ingredients">${recipe.items.map((item) => `<li class="${recipe.have.includes(item.id) ? "got" : ""}">${esc(R.amountLabel(item))}</li>`).join("")}</ul>
          <ol class="steps">${recipe.steps.map((stepText) => `<li>${esc(stepText)}</li>`).join("")}</ol>
        </details>
        <div class="btn-row">
          <button type="button" class="btn small primary" data-lab-log="${esc(recipe.id)}">Cooked it, log the meal</button>
          ${recipe.missing.length ? `<button type="button" class="btn small" data-lab-shop="${esc(recipe.id)}">Copy shopping list</button>` : ""}
        </div>
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
      <div class="view-head"><div><h1>Lab</h1><p>Tell Lahap what is in your kitchen and get home recipes sized for your goal, with the calories and protein worked out.</p></div></div>
      <div class="lab-grid">
        <section class="panel lab-input">
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
          <div class="chips">${quick.map((id) => `<button type="button" class="chip" data-lab-add="${id}">+ ${esc(ingredientLabel(id))}</button>`).join("")}</div>
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
          <div class="row">
            <label class="field"><span>Place</span><input type="text" name="place" list="place-list" value="${esc(draft.place)}" placeholder="Warung or Home"></label>
            <label class="field"><span>Cuisine</span><input type="text" name="cuisine" list="cuisine-list" value="${esc(draft.cuisine)}" placeholder="Indonesian"></label>
          </div>
          <datalist id="place-list">${places.map((place) => `<option value="${esc(place)}">`).join("")}</datalist>
          <datalist id="cuisine-list">${CUISINES.map((cuisine) => `<option value="${esc(cuisine)}">`).join("")}</datalist>
          <div class="row">
            <label class="field"><span>Price (${esc(state.settings.currency)})</span><input type="number" name="price" inputmode="decimal" min="0" step="any" value="${esc(draft.price)}" placeholder="0"></label>
            <label class="field"><span>When</span><input type="datetime-local" name="ts" value="${localInputValue(new Date(draft.ts))}"></label>
          </div>
          <fieldset class="field"><legend>Taste</legend><div class="chips">${TASTES.map((taste) => `<label class="chip"><input type="checkbox" name="taste" value="${taste}" ${draft.tastes.includes(taste) ? "checked" : ""}><span>${taste}</span></label>`).join("")}</div></fieldset>
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
          <div class="field"><span>Rating</span>${segHtml("rating", [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]], draft.rating)}</div>
          <fieldset class="field"><legend>Ate with <span class="hint">${esc(closestBudNudge() || `+${L.POINTS.tag} connection points each`)}</span></legend>
            ${buds.length ? `<div class="chips">${buds.map((person) => `<label class="chip"><input type="checkbox" name="friend" value="${person.id}" ${draft.friends.includes(person.id) ? "checked" : ""}><span>${esc(person.name)}</span></label>`).join("")}</div>` : '<p class="muted small">Add buds on the Taste buds tab to tag them here.</p>'}
          </fieldset>
          <label class="field"><span>Notes</span><textarea name="notes" placeholder="Less sambal next time, ask for extra lime">${esc(draft.notes)}</textarea></label>
        </div>
        <div class="sheet-foot">
          <button type="button" class="btn ghost" data-close>Cancel</button>
          <button type="submit" class="btn primary">${editing ? "Save changes" : "Save meal"}</button>
        </div>
      </form>`;

    const form = $("#log-form");
    const plateCanvas = $("#log-plate");

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
      box.innerHTML = `<p class="notice" style="margin:-8px 0 16px">Had it ${past.length}× before, last ${esc(relative(last.ts))}${last.place ? " at " + esc(last.place) : ""} for ${esc(money(last.price))}. <button type="button" class="btn" style="margin-top:6px" data-fill="${esc(last.id)}">Fill from last time</button></p>`;
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
  const share = { subject: null, template: "card", background: "paper", size: "story", photo: null };

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

  async function drawShare(canvas) {
    const W = 1080;
    const H = share.size === "story" ? 1920 : 1080;
    drawShare.boxes = [];
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    const isWeek = share.subject === "week";
    const entry = isWeek ? null : share.subject;
    const bg = share.background;
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
    if (bg === "paper") {
      ctx.fillStyle = "#f5efe3";
      ctx.fillRect(0, 0, W, H);
    } else if (bg === "ink") {
      ctx.fillStyle = "#1d1813";
      ctx.fillRect(0, 0, W, H);
    } else if (bg === "photo") {
      if (photo) {
        cover(ctx, photo, 0, 0, W, H);
      } else {
        ctx.fillStyle = "#3b2a1e";
        ctx.fillRect(0, 0, W, H);
        drawPlate(ctx, W / 2, H / 2, W * 0.42, entry ? entry.plate : { veg: 1, protein: 1, carbs: 1 }, entry ? entry.name : "week");
      }
      const shade = ctx.createLinearGradient(0, H * 0.35, 0, H);
      shade.addColorStop(0, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(0,0,0,0.72)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);
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
      drawShare.boxes.push({ x, y, width: Math.max(valueWidth, ctx.measureText(label.toUpperCase()).width) });
    }

    if (share.template === "receipt") {
      drawReceipt(ctx, W, H, entry, isWeek, mono, serif);
      return;
    }

    if (share.template === "stats") {
      // Strava-style: big numbers only, meant for clear background over your own photo
      const lines = isWeek
        ? (function () {
          const data = weekData();
          return [["Meals this week", String(data.entries.length)], ["Spent", money(data.spend.total)], ["Plate score", String(data.avg)], ["Variety", String(data.variety)]];
        })()
        : [["Dish", entry.name], ["Price", money(entry.price)], ["Plate score", `${L.healthScore(entry.plate)} ${L.healthLabel(L.healthScore(entry.plate))}`], ["Taste", (entry.tastes || []).join(" · ") || entry.cuisine || "–"]];
      const story = share.size === "story";
      if (!isWeek && story && entry.place) lines.push(["Where", entry.place]);
      const block = story ? 250 : 180;
      const glyph = story ? 170 : 80;
      const stackHeight = glyph * 2 + 60 + lines.length * block;
      const stackTop = Math.max(40, (H - stackHeight) / 2 - 30);
      drawPlate(ctx, W / 2, stackTop + glyph, glyph, isWeek ? averagePlate(weekData().entries) : entry.plate, isWeek ? "week" : entry.name);
      let y = stackTop + glyph * 2 + 60 + 32;
      ctx.textAlign = "center";
      for (const [label, value] of lines) {
        ctx.fillStyle = sub;
        ctx.font = mono(story ? 34 : 28, 600);
        ctx.fillText(label.toUpperCase(), W / 2, y);
        ctx.fillStyle = ink;
        // shrink long values until they fit; only truncate below a readable floor
        let fontSize = story ? 116 : 88;
        ctx.font = serif(fontSize);
        while (ctx.measureText(value).width > W - pad * 2 && fontSize > 56) {
          fontSize -= 4;
          ctx.font = serif(fontSize);
        }
        const fitted = wrapText(ctx, value, W - pad * 2, 1)[0];
        ctx.fillText(fitted, W / 2, y + (story ? 118 : 92));
        y += block;
      }
      ctx.font = mono(30, 700);
      ctx.fillStyle = ink;
      ctx.fillText("LAHAP", W / 2, H - 90);
      ctx.textAlign = "left";
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
      const top = share.size === "story" ? 520 : 400;
      const cell = (W - pad * 2) / 7;
      days.forEach((day, column) => {
        const cx = pad + cell * column + cell / 2;
        ctx.textAlign = "center";
        ctx.fillStyle = sub;
        ctx.font = mono(26, 600);
        ctx.fillText(day.date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(), cx, top);
        const rows = share.size === "story" ? 3 : 2;
        day.meals.slice(0, rows).forEach((meal, row) => {
          drawPlate(ctx, cx, top + 70 + row * (cell + 18), cell * 0.42, meal.plate, meal.name);
        });
      });
      ctx.textAlign = "left";
      const statsTop = share.size === "story" ? 1300 : 790;
      const colW = (W - pad * 2) / 2;
      statBlock(pad, statsTop, "Meals", String(data.entries.length), 84, colW - 32);
      statBlock(pad + colW, statsTop, "Spent", money(data.spend.total), 64, colW - 32);
      if (share.size === "story") {
        statBlock(pad, statsTop + 220, "Plate score", String(data.avg), 84, colW - 32);
        statBlock(pad + colW, statsTop + 220, "Variety", String(data.variety), 84, colW - 32);
      }
      return;
    }

    // single meal card
    brand(pad + 20);
    const square = share.size === "square";
    if (bg !== "photo") {
      const box = square ? 420 : 760;
      const x = (W - box) / 2;
      const y = square ? 130 : 200;
      if (cutout) {
        // food-only cutout sits on the card like a sticker, no box around it
        const fit = Math.min(box / cutout.width, box / cutout.height);
        const cw = cutout.width * fit;
        const ch = cutout.height * fit;
        ctx.save();
        ctx.shadowColor = "rgba(29,24,19,0.28)";
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 18;
        ctx.drawImage(cutout, x + (box - cw) / 2, y + (box - ch) / 2, cw, ch);
        ctx.restore();
      } else if (photo) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, box, box, 36) : ctx.rect(x, y, box, box);
        ctx.clip();
        cover(ctx, photo, x, y, box, box);
        ctx.restore();
      } else {
        drawPlate(ctx, W / 2, y + box / 2, box * 0.46, entry.plate, entry.name);
      }
    }
    const baseY = square ? 640 : 1100;
    ctx.fillStyle = sub;
    ctx.font = mono(30, 600);
    const metaLine = [new Date(entry.ts).toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase(), entry.place ? entry.place.toUpperCase() : null].filter(Boolean).join(" · ");
    ctx.fillText(wrapText(ctx, metaLine, W - pad * 2, 1)[0], pad, baseY);
    ctx.fillStyle = ink;
    ctx.font = serif(square ? 76 : 104);
    const titleLines = wrapText(ctx, entry.name, W - pad * 2, 2);
    titleLines.forEach((line, index) => ctx.fillText(line, pad, baseY + (square ? 90 : 120) * (index + 1)));
    const tearY = baseY + (square ? 90 : 120) * titleLines.length + (square ? 36 : 56);
    drawTearLine(ctx, W, tearY, light ? "#c9bba3" : "rgba(255,255,255,0.55)", bg === "paper" ? "#f5efe3" : bg === "ink" ? "#1d1813" : null);
    const statsY = tearY + (square ? 62 : 84);
    // price gets the wide column; plate score and rating share the rest
    const priceW = (W - pad * 2) * 0.46;
    const smallW = (W - pad * 2 - priceW) / 2;
    const gutter = 32;
    statBlock(pad, statsY, "Price", money(entry.price), square ? 56 : 68, priceW - gutter);
    statBlock(pad + priceW, statsY, "Plate score", String(L.healthScore(entry.plate)), square ? 56 : 68, smallW - gutter);
    statBlock(pad + priceW + smallW, statsY, "Rating", entry.rating ? `${entry.rating}/5` : "–", square ? 56 : 68, smallW - gutter);
    if (!square) {
      // second row: what makes this meal yours (cuisine, how often, who with)
      const rowY = statsY + 200;
      const thirdW = (W - pad * 2) / 3;
      const times = timesEaten(entry);
      const withWho = (entry.friends || []).map((id) => (personById(id) || {}).name).filter(Boolean);
      statBlock(pad, rowY, "Cuisine", entry.cuisine || "–", 56, thirdW - gutter);
      statBlock(pad + thirdW, rowY, "Eaten", times === 1 ? "1st time" : `${times}×`, 56, thirdW - gutter);
      statBlock(pad + thirdW * 2, rowY, "With", withWho.length ? withWho.join(", ") : "Solo", 56, thirdW - gutter);
      ctx.fillStyle = sub;
      ctx.font = mono(30, 600);
      const footer = [(entry.tastes || []).join(" · "), SOURCES[entry.source]].filter(Boolean).join("  ·  ").toUpperCase();
      ctx.fillText(wrapText(ctx, footer, W - pad * 2, 1)[0], pad, H - 110);
    }
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

  function drawReceipt(ctx, W, H, entry, isWeek, mono, serif) {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    const paperW = 760;
    const x = (W - paperW) / 2;
    const items = isWeek ? weekData().entries.slice().sort((a, b) => new Date(a.ts) - new Date(b.ts)) : [entry];
    const maxItems = share.size === "story" ? 16 : 7;
    const shown = items.slice(-maxItems);
    const lineH = 52;
    const extraRows = isWeek ? 0 : 3;
    const paperH = Math.min(H - 160, 610 + (shown.length + extraRows) * lineH);
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
    drawPlate(ctx, W / 2, y + 86, 46, isWeek ? averagePlate(items) : entry.plate, isWeek ? "week" : entry.name);
    let cursor = y + 200;
    ctx.fillStyle = "#1d1813";
    ctx.textAlign = "center";
    ctx.font = serif(64);
    ctx.fillText("Lahap", W / 2, cursor);
    cursor += 50;
    ctx.font = mono(26, 500);
    ctx.fillStyle = "#5e554a";
    const dateText = isWeek ? `WEEK ENDING ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase()}` : new Date(entry.ts).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).toUpperCase();
    ctx.fillText(dateText, W / 2, cursor);
    cursor += 30;
    const rule = () => {
      ctx.save();
      ctx.strokeStyle = "#1d1813";
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left, cursor);
      ctx.lineTo(right, cursor);
      ctx.stroke();
      ctx.restore();
    };
    rule();
    cursor += 56;
    ctx.fillStyle = "#1d1813";
    ctx.font = mono(30, 600);
    for (const item of shown) {
      ctx.textAlign = "left";
      ctx.fillText(wrapText(ctx, item.name.toUpperCase(), right - left - 240, 1)[0], left, cursor);
      ctx.textAlign = "right";
      ctx.fillText(money(item.price), right, cursor);
      cursor += lineH;
    }
    if (items.length > shown.length) {
      ctx.textAlign = "left";
      ctx.fillStyle = "#5e554a";
      ctx.fillText(`+${items.length - shown.length} MORE`, left, cursor);
      cursor += lineH;
    }
    cursor -= 20;
    rule();
    cursor += 56;
    const total = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    const avg = items.length ? Math.round(items.reduce((sum, item) => sum + L.healthScore(item.plate), 0) / items.length) : 0;
    const rows = [["TOTAL", money(total)], ["PLATE SCORE", String(avg)]];
    if (isWeek) rows.push(["VARIETY", String(L.varietyScore(items))]);
    else {
      const withWho = (entry.friends || []).map((id) => (personById(id) || {}).name).filter(Boolean);
      rows.push(["TASTE", (entry.tastes || []).join("/").toUpperCase() || "-"]);
      rows.push(["PLACE", (entry.place || "-").toUpperCase()]);
      rows.push(["EATEN", timesEaten(entry) === 1 ? "1ST TIME" : `${timesEaten(entry)}X`]);
      rows.push(["WITH", withWho.length ? withWho.join(", ").toUpperCase() : "SOLO"]);
    }
    ctx.font = mono(32, 700);
    ctx.fillStyle = "#1d1813";
    for (const [label, value] of rows) {
      ctx.textAlign = "left";
      ctx.fillText(label, left, cursor);
      ctx.textAlign = "right";
      ctx.fillText(wrapText(ctx, value, right - left - 260, 1)[0], right, cursor);
      cursor += lineH;
    }
    ctx.textAlign = "center";
    ctx.font = mono(24, 500);
    ctx.fillStyle = "#5e554a";
    ctx.fillText("TERIMA KASIH · SEE YOU NEXT MEAL", W / 2, y + paperH - 50);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function openShare(subject) {
    share.subject = subject;
    const isWeek = subject === "week";
    if (!isWeek && subject.photo) share.background = "photo";
    if (isWeek && share.background === "photo") share.background = "paper";
    if (!["card", "receipt", "stats"].includes(share.template)) share.template = "card";
    const dialog = $("#dlg-share");
    const backgrounds = [["paper", "Paper"], ["ink", "Dark"], ["photo", "Photo"], ["clear", "Transparent"]].filter(([key]) => !(isWeek && key === "photo"));
    dialog.innerHTML = `
      <div class="sheet-head"><h2 id="share-title">${isWeek ? "Share my week" : "Share " + esc(subject.name)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${ICON_CLOSE}</button></div>
      <div class="sheet-body share-grid">
        <div class="canvas-stage"><canvas id="share-canvas" role="img" aria-label="Share card preview"></canvas></div>
        <div>
          <div class="control"><span>Template</span>${segHtml("template", [["card", isWeek ? "Plates" : "Card"], ["receipt", "Receipt"], ["stats", "Stats"]], share.template)}</div>
          <div class="control"><span>Background</span>${segHtml("background", backgrounds, share.background)}</div>
          <div class="control"><span>Size</span>${segHtml("size", [["story", "Story 9:16"], ["square", "Post 1:1"]], share.size)}</div>
          <p class="notice">Transparent saves a PNG with no background: drop it on your own photo in Instagram or WhatsApp stories, like a Strava sticker.</p>
          <div class="btn-row" style="margin-top:16px">
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
      await drawShare(canvas);
      if (token !== drawToken) return;
      canvas.toBlob((blob) => {
        if (token !== drawToken || !blob) return;
        prepared = new File([blob], filename(), { type: "image/png" });
        sendButton.disabled = false;
      }, "image/png");
    };
    dialog.onclick = (event) => {
      const button = event.target.closest("[data-seg]");
      if (!button) return;
      share[button.dataset.seg] = button.dataset.value;
      for (const sibling of $$(`[data-seg="${button.dataset.seg}"]`, dialog)) sibling.setAttribute("aria-pressed", String(sibling === button));
      redraw();
    };
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
    dialog.showModal();
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
      const url = "https://juw12.github.io/lahap/";
      const text = "I'm keeping a food diary on Lahap (free, no account). Try it and we can compare tastes:";
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

  async function init() {
    await store.open();
    state.entries = await store.all();
    state.settings = Object.assign(state.settings, await store.get("settings", {}));
    state.friends = await store.get("friends", []);
    state.points = await store.get("points", {});
    state.invites = await store.get("invites", []);
    const params = new URLSearchParams(location.search);
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
  window.Lahap = { state, openLog, openShare, openHangout, openQuiz, drawShare, loadSample, sampleEntries, renderLab, nutritionFor, readListPhoto };

  init();
})();
