/* Lahap: pure logic (no DOM). Loaded by the app and by the tests. */
(function (root) {
  "use strict";

  const TASTES = ["Spicy", "Sweet", "Sour", "Salty", "Umami", "Rich"];

  const LEVELS = [
    { min: 0, name: "New bud" },
    { min: 30, name: "Makan buddy" },
    { min: 80, name: "Regular" },
    { min: 150, name: "Family table" },
  ];

  const POINTS = { tag: 10, hangout: 25 };

  // Rule-based plate score. Inputs come from the "plate balance" step of the log form.
  // plate = { veg: 0-2, protein: 0-2, carbs: 0-2, fried, sugary, processed }
  function healthBreakdown(plate) {
    const p = Object.assign(
      { veg: 0, protein: 0, carbs: 0, fried: false, sugary: false, processed: false },
      plate || {}
    );
    const parts = [{ label: "Base", value: 50 }];
    if (p.veg === 1) parts.push({ label: "Some veg", value: 15 });
    if (p.veg === 2) parts.push({ label: "Half-plate veg", value: 30 });
    if (p.protein === 1) parts.push({ label: "Some protein", value: 10 });
    if (p.protein === 2) parts.push({ label: "Good protein", value: 12 });
    if (p.carbs === 0) parts.push({ label: "No starch", value: -5 });
    if (p.carbs === 1) parts.push({ label: "Normal starch", value: 5 });
    if (p.carbs === 2) parts.push({ label: "Big starch portion", value: -8 });
    if (p.fried) parts.push({ label: "Deep-fried", value: -15 });
    if (p.sugary) parts.push({ label: "Sugary drink or dessert", value: -15 });
    if (p.processed) parts.push({ label: "Processed meat", value: -10 });
    return parts;
  }

  function healthScore(plate) {
    const total = healthBreakdown(plate).reduce((sum, part) => sum + part.value, 0);
    return Math.max(0, Math.min(100, total));
  }

  function healthLabel(score) {
    if (score >= 75) return "Balanced";
    if (score >= 50) return "Okay";
    return "Heavy";
  }

  // Simpson diversity of what you ate (dish names + cuisines), scaled 0-100.
  // 0 = the same thing every time; close to 100 = every meal different.
  function varietyScore(entries) {
    if (!entries.length) return 0;
    const counts = {};
    for (const entry of entries) {
      const key = normalize(entry.name);
      counts[key] = (counts[key] || 0) + 1;
    }
    const total = entries.length;
    let sumSquares = 0;
    for (const key in counts) {
      sumSquares += Math.pow(counts[key] / total, 2);
    }
    const dishDiversity = 1 - sumSquares;

    const cuisineCounts = {};
    for (const entry of entries) {
      const key = normalize(entry.cuisine || "Other");
      cuisineCounts[key] = (cuisineCounts[key] || 0) + 1;
    }
    let cuisineSquares = 0;
    for (const key in cuisineCounts) {
      cuisineSquares += Math.pow(cuisineCounts[key] / total, 2);
    }
    const cuisineDiversity = 1 - cuisineSquares;
    return Math.round(100 * (0.5 * dishDiversity + 0.5 * cuisineDiversity));
  }

  function repeats(entries, minimum) {
    const counts = {};
    for (const entry of entries) {
      const key = normalize(entry.name);
      if (!counts[key]) counts[key] = { name: entry.name, count: 0 };
      counts[key].count += 1;
    }
    return Object.values(counts)
      .filter((item) => item.count >= (minimum || 2))
      .sort((a, b) => b.count - a.count);
  }

  function tasteVector(entries) {
    const vector = TASTES.map(() => 0);
    for (const entry of entries) {
      for (const taste of entry.tastes || []) {
        const index = TASTES.indexOf(taste);
        if (index >= 0) vector[index] += 1;
      }
    }
    const max = Math.max(1, ...vector);
    return vector.map((value) => value / max);
  }

  function cosine(a, b) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (!normA || !normB) return 0;
    return dot / Math.sqrt(normA * normB);
  }

  function jaccard(listA, listB) {
    const setA = new Set(listA.map(normalize));
    const setB = new Set(listB.map(normalize));
    if (!setA.size && !setB.size) return 0;
    let shared = 0;
    for (const item of setA) {
      if (setB.has(item)) shared += 1;
    }
    return shared / (setA.size + setB.size - shared);
  }

  // Taste match between you and another person, 0-100.
  function matchScore(myTastes, myCuisines, theirTastes, theirCuisines) {
    const score = 0.65 * cosine(myTastes, theirTastes) + 0.35 * jaccard(myCuisines, theirCuisines);
    return Math.round(100 * score);
  }

  function topCuisines(entries, limit) {
    const counts = {};
    for (const entry of entries) {
      const name = entry.cuisine || "Other";
      counts[name] = (counts[name] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit || 5)
      .map(([name, count]) => ({ name, count }));
  }

  function topPlaces(entries, limit) {
    const places = {};
    for (const entry of entries) {
      if (!entry.place) continue;
      const key = normalize(entry.place);
      if (!places[key]) places[key] = { name: entry.place, count: 0, spend: 0, cuisines: new Set() };
      places[key].count += 1;
      places[key].spend += Number(entry.price) || 0;
      if (entry.cuisine) places[key].cuisines.add(entry.cuisine);
    }
    return Object.values(places)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit || 5)
      .map((place) => Object.assign(place, { cuisines: Array.from(place.cuisines) }));
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Every word of the query must appear in name, place, cuisine, tastes, notes or friend names.
  function searchEntries(entries, query, friendNames) {
    const words = normalize(query).split(" ").filter(Boolean);
    if (!words.length) return entries.slice();
    return entries.filter((entry) => {
      const names = (entry.friends || []).map((id) => (friendNames && friendNames[id]) || "");
      const haystack = normalize(
        [entry.name, entry.place, entry.cuisine, entry.source, (entry.tastes || []).join(" "), entry.notes, names.join(" ")].join(" ")
      );
      return words.every((word) => haystack.includes(word));
    });
  }

  // "Have I eaten this before?" summary for a set of matches.
  function summarize(matches) {
    if (!matches.length) return null;
    const sorted = matches.slice().sort((a, b) => new Date(b.ts) - new Date(a.ts));
    const priced = matches.filter((entry) => Number(entry.price) > 0);
    const spend = priced.reduce((sum, entry) => sum + Number(entry.price), 0);
    const health = matches.reduce((sum, entry) => sum + healthScore(entry.plate), 0) / matches.length;
    const rated = matches.filter((entry) => entry.rating);
    const places = topPlaces(matches, 3).map((place) => place.name);
    return {
      count: matches.length,
      last: sorted[0],
      first: sorted[sorted.length - 1],
      avgPrice: priced.length ? spend / priced.length : 0,
      minPrice: priced.length ? Math.min(...priced.map((entry) => Number(entry.price))) : 0,
      maxPrice: priced.length ? Math.max(...priced.map((entry) => Number(entry.price))) : 0,
      avgHealth: Math.round(health),
      avgRating: rated.length ? rated.reduce((sum, entry) => sum + entry.rating, 0) / rated.length : 0,
      places,
    };
  }

  function spendSummary(entries) {
    const result = { total: 0, out: 0, home: 0, delivery: 0, meals: entries.length, perMeal: 0 };
    for (const entry of entries) {
      const price = Number(entry.price) || 0;
      result.total += price;
      result[entry.source || "out"] += price;
    }
    result.perMeal = entries.length ? result.total / entries.length : 0;
    return result;
  }

  function levelFor(points) {
    let current = LEVELS[0];
    let next = null;
    for (let i = 0; i < LEVELS.length; i++) {
      if (points >= LEVELS[i].min) {
        current = LEVELS[i];
        next = LEVELS[i + 1] || null;
      }
    }
    const progress = next ? (points - current.min) / (next.min - current.min) : 1;
    return { name: current.name, next: next ? next.name : null, toNext: next ? next.min - points : 0, progress };
  }

  function withinDays(entries, days, now) {
    const end = now ? new Date(now) : new Date();
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    return entries.filter((entry) => {
      const time = new Date(entry.ts);
      return time >= start && time <= end;
    });
  }

  function dayKey(ts) {
    const date = new Date(ts);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function formatMoney(value, currency) {
    const code = currency || "IDR";
    const digits = code === "IDR" ? 0 : 2;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(Number(value) || 0);
    } catch (error) {
      return `${code} ${(Number(value) || 0).toFixed(digits)}`;
    }
  }

  const api = {
    TASTES,
    LEVELS,
    POINTS,
    healthBreakdown,
    healthScore,
    healthLabel,
    varietyScore,
    repeats,
    tasteVector,
    matchScore,
    topCuisines,
    topPlaces,
    normalize,
    searchEntries,
    summarize,
    spendSummary,
    levelFor,
    withinDays,
    dayKey,
    formatMoney,
  };

  root.LahapLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
