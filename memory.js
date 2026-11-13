/* Lahap: memory features (no DOM). Stamp book, place and bud pages, craving picker, recap.
   Loaded after logic.js, by the app and by the tests. */
(function (root) {
  "use strict";

  const L = root.LahapLogic;

  // Home is not a place you collect a stamp for.
  function placeKey(entry) {
    const key = L.normalize(entry && entry.place);
    return key && key !== "home" && key !== "rumah" ? key : null;
  }

  function byNewest(a, b) {
    return String(b.ts).localeCompare(String(a.ts));
  }

  // [{ name, count }] by count, then by first appearance in the list.
  function tally(names) {
    const counts = new Map();
    for (const name of names) {
      const key = L.normalize(name);
      if (!key) continue;
      if (!counts.has(key)) counts.set(key, { name, count: 0 });
      counts.get(key).count += 1;
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }

  function totalSpend(entries) {
    return entries.reduce((sum, entry) => sum + (Number(entry.price) || 0), 0);
  }

  function average(values) {
    const numbers = values.map(Number).filter((value) => value > 0);
    return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
  }

  // One stamp per place you ate at, most visited first.
  function stampBook(entries) {
    const places = new Map();
    for (const entry of entries.slice().sort(byNewest)) {
      const key = placeKey(entry);
      if (!key) continue;
      if (!places.has(key)) places.set(key, { key, name: entry.place, visits: [] });
      places.get(key).visits.push(entry);
    }
    return Array.from(places.values())
      .map((place) => {
        const dishes = tally(place.visits.map((entry) => entry.name));
        return {
          key: place.key,
          name: place.name,
          count: place.visits.length,
          first: place.visits[place.visits.length - 1].ts,
          last: place.visits[0].ts,
          spend: totalSpend(place.visits),
          cuisines: Array.from(new Set(place.visits.map((entry) => entry.cuisine).filter(Boolean))),
          topDish: dishes.length ? dishes[0].name : "",
        };
      })
      .sort((a, b) => b.count - a.count || String(b.last).localeCompare(String(a.last)));
  }

  function companionsOf(entries) {
    const counts = new Map();
    for (const entry of entries) {
      for (const id of entry.friends || []) counts.set(id, (counts.get(id) || 0) + 1);
    }
    return Array.from(counts, ([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
  }

  function placePage(entries, key) {
    const visits = entries.filter((entry) => placeKey(entry) === key).sort(byNewest);
    if (!visits.length) return null;
    const dishes = tally(visits.map((entry) => entry.name));
    const paid = visits.filter((entry) => Number(entry.price) > 0);
    return {
      key,
      name: visits[0].place,
      count: visits.length,
      first: visits[visits.length - 1].ts,
      last: visits[0].ts,
      spend: totalSpend(visits),
      avgSpend: paid.length ? totalSpend(paid) / paid.length : 0,
      avgRating: average(visits.map((entry) => entry.rating)),
      usual: dishes[0],
      dishes,
      visits,
      companions: companionsOf(visits),
    };
  }

  function budPage(entries, id) {
    const meals = entries.filter((entry) => (entry.friends || []).includes(id)).sort(byNewest);
    const dishes = tally(meals.map((entry) => entry.name));
    const places = new Map();
    for (const entry of meals) {
      const key = placeKey(entry);
      if (!key) continue;
      if (!places.has(key)) places.set(key, { key, name: entry.place, count: 0 });
      places.get(key).count += 1;
    }
    return {
      id,
      count: meals.length,
      first: meals.length ? meals[meals.length - 1].ts : null,
      last: meals.length ? meals[0].ts : null,
      usual: dishes[0] || null,
      dishes,
      places: Array.from(places.values()).sort((a, b) => b.count - a.count),
      meals,
      spend: totalSpend(meals),
    };
  }

  // Dishes worth eating again: rated 4 and up, or hearted. One item per dish, keeping the latest log.
  function cravingPool(entries, mode) {
    const pool = new Map();
    for (const entry of entries.slice().sort(byNewest)) {
      if (!(entry.fav || Number(entry.rating) >= 4)) continue;
      const home = entry.source === "home";
      if (mode === "home" && !home) continue;
      if (mode === "out" && home) continue;
      const key = L.normalize(entry.name);
      if (!key) continue;
      if (!pool.has(key)) pool.set(key, { key, name: entry.name, entry, count: 0 });
      pool.get(key).count += 1;
    }
    return Array.from(pool.values());
  }

  // random is a 0..1 function, so the tests can pin the pick. avoidKey skips the dish just shown.
  function pickCraving(pool, random, avoidKey) {
    const choices = pool.length > 1 ? pool.filter((item) => item.key !== avoidKey) : pool;
    if (!choices.length) return null;
    const index = Math.min(choices.length - 1, Math.floor((random || Math.random)() * choices.length));
    return choices[index];
  }

  // Months and years that have a log, newest first: [{ year, month }] with month 0-11 or null for the year.
  function recapPeriods(entries) {
    const months = new Set();
    const years = new Set();
    for (const entry of entries) {
      const date = new Date(entry.ts);
      if (Number.isNaN(date.getTime())) continue;
      months.add(date.getFullYear() * 12 + date.getMonth());
      years.add(date.getFullYear());
    }
    const sortedMonths = Array.from(months).sort((a, b) => b - a);
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    return {
      months: sortedMonths.map((value) => ({ year: Math.floor(value / 12), month: value % 12 })),
      years: sortedYears.map((year) => ({ year, month: null })),
    };
  }

  function inPeriod(entry, year, month) {
    const date = new Date(entry.ts);
    return date.getFullYear() === year && (month === null || month === undefined || date.getMonth() === month);
  }

  function recap(entries, year, month) {
    const inside = entries.filter((entry) => inPeriod(entry, year, month)).sort(byNewest);
    // A place is new in this period when its first ever visit falls inside it.
    const firstVisit = new Map();
    for (const place of stampBook(entries)) firstVisit.set(place.key, place.first);
    const book = stampBook(inside);
    const rated = inside.filter((entry) => Number(entry.rating) > 0);
    const best = rated.slice().sort((a, b) => Number(b.rating) - Number(a.rating) || byNewest(a, b))[0] || null;
    return {
      year,
      month: month === undefined ? null : month,
      count: inside.length,
      days: new Set(inside.map((entry) => L.dayKey(entry.ts))).size,
      topDishes: tally(inside.map((entry) => entry.name)).slice(0, 3),
      topPlace: book[0] || null,
      places: book.length,
      newPlaces: book.filter((place) => inPeriod({ ts: firstVisit.get(place.key) }, year, month)).map((place) => place.name),
      companions: companionsOf(inside),
      spend: totalSpend(inside),
      bestRated: best,
      homeCount: inside.filter((entry) => entry.source === "home").length,
      outCount: inside.filter((entry) => entry.source !== "home").length,
      favCount: inside.filter((entry) => entry.fav).length,
    };
  }

  root.LahapMemory = {
    placeKey,
    stampBook,
    placePage,
    budPage,
    cravingPool,
    pickCraving,
    recapPeriods,
    recap,
  };
})(typeof window !== "undefined" ? window : globalThis);
