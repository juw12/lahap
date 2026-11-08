/* Lahap: nutrition estimates, daily targets and tips (pure, no DOM). Loaded by the app and by the tests.
 *
 * Numbers are typical values per serving for home/warung portions, rounded. They are estimates for
 * awareness, not medical or dietetic advice. Sources: typical USDA FoodData Central and Indonesian
 * food composition table (TKPI) values for the main components, combined per dish.
 */
(function (root) {
  "use strict";

  // kcal, protein g, carbs g, fat g, fiber g, sodium mg, plus the plate parts (0-2) the dish usually has
  const FOODS = [
    // Indonesian and Malaysian
    { name: "Nasi lemak ayam", aliases: ["nasi lemak"], kcal: 760, p: 30, c: 85, f: 33, fiber: 3, na: 1200, plate: { veg: 0, protein: 2, carbs: 2 }, fried: true },
    { name: "Nasi goreng", aliases: ["fried rice", "nasgor", "kimchi fried rice"], kcal: 620, p: 18, c: 82, f: 23, fiber: 3, na: 1300, plate: { veg: 1, protein: 1, carbs: 2 } },
    { name: "Mie goreng", aliases: ["mee goreng", "bakmi goreng", "fried noodles"], kcal: 660, p: 16, c: 86, f: 27, fiber: 4, na: 1500, plate: { veg: 1, protein: 1, carbs: 2 } },
    { name: "Indomie goreng", aliases: ["indomie", "instant noodles", "mie instan", "mi instan"], kcal: 390, p: 8, c: 54, f: 15, fiber: 2, na: 1100, plate: { veg: 0, protein: 0, carbs: 2 }, processed: true },
    { name: "Gado-gado", aliases: ["gado gado", "pecel", "karedok"], kcal: 440, p: 18, c: 32, f: 27, fiber: 8, na: 700, plate: { veg: 2, protein: 1, carbs: 1 } },
    { name: "Soto ayam", aliases: ["soto"], kcal: 460, p: 26, c: 52, f: 15, fiber: 2, na: 1400, plate: { veg: 1, protein: 1, carbs: 1 } },
    { name: "Bakso", aliases: ["bakso urat", "meatball soup", "baso"], kcal: 420, p: 22, c: 42, f: 17, fiber: 2, na: 1600, plate: { veg: 0, protein: 1, carbs: 1 }, processed: true },
    { name: "Nasi padang rendang", aliases: ["rendang", "nasi padang"], kcal: 820, p: 36, c: 86, f: 36, fiber: 4, na: 1300, plate: { veg: 1, protein: 2, carbs: 2 } },
    { name: "Sate ayam", aliases: ["sate", "satay", "sate ayam lontong"], kcal: 560, p: 38, c: 45, f: 23, fiber: 2, na: 1100, plate: { veg: 0, protein: 2, carbs: 1 } },
    { name: "Ayam geprek", aliases: ["geprek", "ayam penyet"], kcal: 760, p: 35, c: 80, f: 33, fiber: 2, na: 1100, plate: { veg: 0, protein: 2, carbs: 2 }, fried: true },
    { name: "Ayam goreng nasi", aliases: ["ayam goreng", "fried chicken rice", "nasi ayam goreng"], kcal: 720, p: 34, c: 78, f: 30, fiber: 1, na: 900, plate: { veg: 0, protein: 2, carbs: 2 }, fried: true },
    { name: "Ayam bakar nasi", aliases: ["ayam bakar", "grilled chicken rice", "ayam taliwang"], kcal: 610, p: 40, c: 72, f: 16, fiber: 2, na: 900, plate: { veg: 1, protein: 2, carbs: 2 } },
    { name: "Pecel lele", aliases: ["lele goreng"], kcal: 660, p: 30, c: 75, f: 26, fiber: 2, na: 900, plate: { veg: 1, protein: 2, carbs: 2 }, fried: true },
    { name: "Nasi uduk", aliases: ["uduk"], kcal: 640, p: 20, c: 80, f: 26, fiber: 2, na: 900, plate: { veg: 0, protein: 1, carbs: 2 } },
    { name: "Gudeg", aliases: ["nasi gudeg"], kcal: 560, p: 20, c: 80, f: 18, fiber: 5, na: 800, plate: { veg: 1, protein: 1, carbs: 2 } },
    { name: "Rawon", aliases: ["nasi rawon"], kcal: 520, p: 28, c: 60, f: 18, fiber: 3, na: 1300, plate: { veg: 0, protein: 2, carbs: 2 } },
    { name: "Bubur ayam", aliases: ["bubur", "congee", "porridge chicken"], kcal: 400, p: 18, c: 60, f: 9, fiber: 1, na: 1100, plate: { veg: 0, protein: 1, carbs: 2 } },
    { name: "Lontong sayur", aliases: ["lontong"], kcal: 460, p: 14, c: 60, f: 18, fiber: 5, na: 1000, plate: { veg: 1, protein: 1, carbs: 2 } },
    { name: "Ketoprak", aliases: [], kcal: 500, p: 18, c: 60, f: 22, fiber: 5, na: 900, plate: { veg: 1, protein: 1, carbs: 2 } },
    { name: "Siomay", aliases: ["batagor"], kcal: 420, p: 20, c: 45, f: 17, fiber: 3, na: 1000, plate: { veg: 1, protein: 1, carbs: 1 } },
    { name: "Pempek", aliases: ["empek empek"], kcal: 450, p: 18, c: 62, f: 14, fiber: 1, na: 1100, plate: { veg: 0, protein: 1, carbs: 2 }, fried: true },
    { name: "Martabak manis", aliases: ["terang bulan", "martabak coklat"], kcal: 520, p: 10, c: 70, f: 22, fiber: 2, na: 400, plate: { veg: 0, protein: 0, carbs: 2 }, sugary: true },
    { name: "Martabak telur", aliases: ["martabak asin"], kcal: 620, p: 24, c: 45, f: 38, fiber: 2, na: 1100, plate: { veg: 0, protein: 1, carbs: 1 }, fried: true },
    { name: "Gorengan", aliases: ["bakwan", "tahu isi", "pisang goreng", "tempe mendoan", "risoles"], kcal: 400, p: 8, c: 40, f: 23, fiber: 3, na: 600, plate: { veg: 0, protein: 0, carbs: 1 }, fried: true },
    { name: "Tempe goreng", aliases: ["tempe", "tempeh"], kcal: 300, p: 18, c: 12, f: 20, fiber: 4, na: 300, plate: { veg: 0, protein: 2, carbs: 0 }, fried: true },
    { name: "Tahu tempe bacem", aliases: ["bacem"], kcal: 330, p: 20, c: 22, f: 17, fiber: 3, na: 500, plate: { veg: 0, protein: 2, carbs: 0 } },
    { name: "Capcay", aliases: ["cap cay", "chop suey", "tumis sayur"], kcal: 260, p: 12, c: 20, f: 14, fiber: 6, na: 900, plate: { veg: 2, protein: 1, carbs: 0 } },
    { name: "Kangkung and tofu stir-fry", aliases: ["tumis kangkung", "kangkung", "cah kangkung"], kcal: 260, p: 14, c: 14, f: 16, fiber: 5, na: 800, plate: { veg: 2, protein: 1, carbs: 0 } },
    { name: "Sayur lodeh", aliases: ["lodeh", "sayur asem"], kcal: 300, p: 10, c: 20, f: 20, fiber: 6, na: 700, plate: { veg: 2, protein: 1, carbs: 0 } },
    { name: "Laksa", aliases: ["curry laksa", "laksa lemak"], kcal: 620, p: 22, c: 60, f: 32, fiber: 3, na: 1700, plate: { veg: 0, protein: 1, carbs: 2 } },
    { name: "Char kway teow", aliases: ["kwetiau goreng", "kwetiau", "kway teow"], kcal: 750, p: 22, c: 80, f: 38, fiber: 3, na: 1500, plate: { veg: 0, protein: 1, carbs: 2 } },
    { name: "Hainanese chicken rice", aliases: ["chicken rice", "nasi ayam hainan"], kcal: 610, p: 30, c: 75, f: 19, fiber: 1, na: 1100, plate: { veg: 0, protein: 2, carbs: 2 } },
    { name: "Roti canai", aliases: ["roti prata", "roti cane"], kcal: 450, p: 10, c: 50, f: 23, fiber: 2, na: 800, plate: { veg: 0, protein: 0, carbs: 2 } },
    { name: "Kaya toast", aliases: ["roti bakar", "kaya toast set"], kcal: 420, p: 15, c: 45, f: 20, fiber: 1, na: 600, plate: { veg: 0, protein: 1, carbs: 2 }, sugary: true },
    // East and Southeast Asian
    { name: "Pho bo", aliases: ["pho", "beef pho"], kcal: 450, p: 30, c: 55, f: 10, fiber: 2, na: 1800, plate: { veg: 1, protein: 1, carbs: 2 } },
    { name: "Banh mi", aliases: [], kcal: 520, p: 22, c: 60, f: 20, fiber: 3, na: 1100, plate: { veg: 1, protein: 1, carbs: 2 } },
    { name: "Tom yum seafood", aliases: ["tom yum", "tomyam"], kcal: 300, p: 26, c: 12, f: 15, fiber: 2, na: 1600, plate: { veg: 1, protein: 2, carbs: 0 } },
    { name: "Pad thai", aliases: [], kcal: 650, p: 22, c: 80, f: 26, fiber: 3, na: 1400, plate: { veg: 1, protein: 1, carbs: 2 } },
    { name: "Green curry with rice", aliases: ["green curry", "thai curry"], kcal: 700, p: 25, c: 75, f: 33, fiber: 3, na: 1200, plate: { veg: 1, protein: 1, carbs: 2 } },
    { name: "Tonkotsu ramen", aliases: ["ramen"], kcal: 820, p: 30, c: 80, f: 40, fiber: 3, na: 2500, plate: { veg: 0, protein: 1, carbs: 2 } },
    { name: "Sushi", aliases: ["sushi set", "maki"], kcal: 360, p: 16, c: 62, f: 5, fiber: 2, na: 900, plate: { veg: 0, protein: 1, carbs: 2 } },
    { name: "Salmon rice bowl", aliases: ["poke", "poke bowl", "salmon bowl"], kcal: 600, p: 35, c: 70, f: 18, fiber: 4, na: 900, plate: { veg: 1, protein: 2, carbs: 2 } },
    { name: "Bibimbap", aliases: [], kcal: 600, p: 24, c: 85, f: 18, fiber: 6, na: 1100, plate: { veg: 2, protein: 1, carbs: 2 } },
    { name: "Korean fried chicken", aliases: ["chimaek", "yangnyeom chicken"], kcal: 820, p: 45, c: 45, f: 50, fiber: 1, na: 1600, plate: { veg: 0, protein: 2, carbs: 1 }, fried: true },
    { name: "Dim sum", aliases: ["siu mai", "har gow", "dimsum"], kcal: 420, p: 20, c: 40, f: 19, fiber: 2, na: 1200, plate: { veg: 0, protein: 1, carbs: 1 } },
    // Western and everyday
    { name: "Burger", aliases: ["cheeseburger", "hamburger"], kcal: 560, p: 28, c: 45, f: 29, fiber: 2, na: 1000, plate: { veg: 0, protein: 2, carbs: 1 } },
    { name: "French fries", aliases: ["fries", "kentang goreng"], kcal: 360, p: 4, c: 46, f: 17, fiber: 4, na: 300, plate: { veg: 0, protein: 0, carbs: 2 }, fried: true },
    { name: "Pizza", aliases: ["pizza slice"], kcal: 560, p: 24, c: 66, f: 22, fiber: 4, na: 1300, plate: { veg: 0, protein: 1, carbs: 2 } },
    { name: "Spaghetti bolognese", aliases: ["spaghetti", "pasta bolognese", "pasta"], kcal: 620, p: 28, c: 80, f: 20, fiber: 5, na: 900, plate: { veg: 1, protein: 1, carbs: 2 } },
    { name: "Chicken caesar wrap", aliases: ["wrap", "caesar wrap", "chicken wrap"], kcal: 560, p: 32, c: 45, f: 28, fiber: 3, na: 1200, plate: { veg: 1, protein: 2, carbs: 1 } },
    { name: "Chicken salad", aliases: ["salad", "caesar salad", "garden salad"], kcal: 360, p: 30, c: 14, f: 20, fiber: 5, na: 700, plate: { veg: 2, protein: 2, carbs: 0 } },
    { name: "Steak", aliases: ["beef steak", "sirloin"], kcal: 600, p: 50, c: 20, f: 35, fiber: 2, na: 700, plate: { veg: 1, protein: 2, carbs: 1 } },
    { name: "Grilled fish", aliases: ["ikan bakar", "fish and rice"], kcal: 520, p: 38, c: 60, f: 12, fiber: 2, na: 800, plate: { veg: 1, protein: 2, carbs: 2 } },
    { name: "Overnight oats", aliases: ["oatmeal", "oats", "porridge oats"], kcal: 360, p: 13, c: 55, f: 10, fiber: 7, na: 100, plate: { veg: 0, protein: 1, carbs: 2 } },
    { name: "Eggs", aliases: ["boiled eggs", "telur rebus", "omelette", "telur dadar", "scrambled eggs"], kcal: 180, p: 13, c: 1, f: 13, fiber: 0, na: 250, plate: { veg: 0, protein: 2, carbs: 0 } },
    { name: "Toast with peanut butter", aliases: ["peanut butter toast", "roti selai kacang"], kcal: 350, p: 12, c: 32, f: 19, fiber: 4, na: 400, plate: { veg: 0, protein: 1, carbs: 1 } },
    { name: "Yogurt with fruit", aliases: ["yogurt", "yoghurt", "greek yogurt"], kcal: 220, p: 12, c: 30, f: 5, fiber: 3, na: 80, plate: { veg: 1, protein: 1, carbs: 1 } },
    { name: "Fruit", aliases: ["banana", "pisang", "apple", "apel", "papaya", "pepaya", "mango", "mangga", "fruit salad", "rujak"], kcal: 110, p: 1, c: 27, f: 0, fiber: 3, na: 2, plate: { veg: 2, protein: 0, carbs: 1 } },
    { name: "Smoothie", aliases: ["jus", "juice", "fruit juice"], kcal: 220, p: 4, c: 48, f: 2, fiber: 3, na: 40, plate: { veg: 1, protein: 0, carbs: 1 }, sugary: true },
    { name: "Protein shake", aliases: ["whey", "shake"], kcal: 160, p: 25, c: 8, f: 3, fiber: 1, na: 200, plate: { veg: 0, protein: 2, carbs: 0 } },
    { name: "Chicken breast", aliases: ["dada ayam", "grilled chicken"], kcal: 250, p: 46, c: 0, f: 6, fiber: 0, na: 400, plate: { veg: 0, protein: 2, carbs: 0 } },
    { name: "Cake", aliases: ["kue", "brownies", "donut", "donat", "croissant", "pastry"], kcal: 380, p: 5, c: 48, f: 19, fiber: 1, na: 300, plate: { veg: 0, protein: 0, carbs: 2 }, sugary: true },
    { name: "Ice cream", aliases: ["es krim", "gelato"], kcal: 260, p: 4, c: 30, f: 14, fiber: 0, na: 80, plate: { veg: 0, protein: 0, carbs: 1 }, sugary: true },
    // Drinks
    { name: "Brown sugar boba", aliases: ["boba", "bubble tea", "milk tea", "boba milk tea"], kcal: 450, p: 4, c: 80, f: 13, fiber: 1, na: 150, plate: { veg: 0, protein: 0, carbs: 1 }, sugary: true },
    { name: "Kopi susu gula aren", aliases: ["kopi susu", "es kopi susu", "latte"], kcal: 240, p: 6, c: 38, f: 7, fiber: 0, na: 100, plate: { veg: 0, protein: 0, carbs: 1 }, sugary: true },
    { name: "Teh manis", aliases: ["es teh manis", "sweet tea", "iced lemon tea", "es teh"], kcal: 120, p: 0, c: 30, f: 0, fiber: 0, na: 10, plate: { veg: 0, protein: 0, carbs: 0 }, sugary: true },
    { name: "Black coffee", aliases: ["kopi hitam", "americano", "espresso", "teh tawar", "plain tea"], kcal: 5, p: 0, c: 1, f: 0, fiber: 0, na: 5, plate: { veg: 0, protein: 0, carbs: 0 } },
    { name: "Es campur", aliases: ["es teler", "es cendol", "cendol"], kcal: 360, p: 3, c: 62, f: 12, fiber: 2, na: 60, plate: { veg: 0, protein: 0, carbs: 1 }, sugary: true },
  ];

  const PORTIONS = { s: 0.7, m: 1, l: 1.4 };
  const PORTION_LABELS = { s: "Small", m: "Regular", l: "Large" };

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function tokens(text) {
    return normalize(text).split(" ").filter(Boolean);
  }

  // best food match for a dish name: exact name/alias, then whole alias inside the name, then token overlap
  function matchFood(name) {
    const target = normalize(name);
    if (!target) return null;
    let best = null;
    let bestScore = 0;
    for (const food of FOODS) {
      const keys = [food.name].concat(food.aliases).map(normalize);
      for (const key of keys) {
        let score = 0;
        if (key === target) score = 100;
        else if ((" " + target + " ").includes(" " + key + " ")) score = 60 + key.length;
        else {
          const wanted = tokens(key);
          const have = new Set(tokens(target));
          const hits = wanted.filter((word) => have.has(word)).length;
          if (hits && hits === wanted.length) score = 40 + key.length;
          else if (hits) score = 15 * (hits / wanted.length);
        }
        if (score > bestScore) {
          bestScore = score;
          best = food;
        }
      }
    }
    return bestScore >= 15 ? best : null;
  }

  function round(value) {
    return Math.round(value);
  }

  // Estimate for one logged meal. Uses the food list when the dish is known, otherwise builds it from the plate.
  // entry: { name, plate: {veg, protein, carbs, fried, sugary, processed}, portion: "s"|"m"|"l", nutrition? }
  function estimate(entry) {
    if (entry && entry.nutrition && entry.nutrition.kcal) {
      return Object.assign({ source: "recipe", label: "From the recipe you cooked" }, entry.nutrition);
    }
    const plate = Object.assign({ veg: 1, protein: 1, carbs: 1 }, (entry && entry.plate) || {});
    const scale = PORTIONS[(entry && entry.portion) || "m"] || 1;
    const food = matchFood(entry && entry.name);
    let base;
    let source;
    let label;
    if (food) {
      base = { kcal: food.kcal, p: food.p, c: food.c, f: food.f, fiber: food.fiber, na: food.na };
      // the plate you ticked nudges the typical dish: more rice, more meat, more veg
      const diff = (key) => (plate[key] || 0) - food.plate[key];
      base.c += diff("carbs") * 22;
      base.kcal += diff("carbs") * 95;
      base.p += diff("protein") * 9;
      base.kcal += diff("protein") * 60;
      base.fiber += diff("veg") * 2.5;
      base.kcal += diff("veg") * 25;
      if (plate.fried && !food.fried) {
        base.f += 12;
        base.kcal += 110;
      }
      if (plate.sugary && !food.sugary) {
        base.c += 30;
        base.kcal += 120;
      }
      source = "food";
      label = `Typical ${food.name.toLowerCase()}`;
    } else {
      // generic plate model: about 200 kcal per starch portion, 150 per protein portion, 40 per veg portion
      base = {
        kcal: 80 + plate.carbs * 200 + plate.protein * 150 + plate.veg * 40,
        p: 4 + plate.protein * 14 + plate.carbs * 3 + plate.veg * 1.5,
        c: 6 + plate.carbs * 42 + plate.veg * 6,
        f: 6 + plate.protein * 7 + plate.carbs * 2,
        fiber: 1 + plate.veg * 3 + plate.carbs * 0.8,
        na: 400 + plate.protein * 200 + plate.carbs * 100,
      };
      if (plate.fried) {
        base.f += 14;
        base.kcal += 130;
      }
      if (plate.sugary) {
        base.c += 35;
        base.kcal += 140;
      }
      if (plate.processed) base.na += 500;
      source = "plate";
      label = "Built from the plate you ticked";
    }
    const out = {};
    for (const key of ["kcal", "p", "c", "f", "fiber", "na"]) out[key] = Math.max(0, round(base[key] * scale));
    if (scale !== 1) label += `, ${PORTION_LABELS[entry.portion].toLowerCase()} portion`;
    return Object.assign(out, { source, label, food: food ? food.name : null });
  }

  /* ---------------- targets from the start quiz ---------------- */
  const GOALS = {
    lose: { label: "Lose weight", kcal: -450, proteinPerKg: 1.6 },
    maintain: { label: "Keep my weight", kcal: 0, proteinPerKg: 1.2 },
    gain: { label: "Gain weight", kcal: 350, proteinPerKg: 1.6 },
    muscle: { label: "Build muscle", kcal: 250, proteinPerKg: 1.8 },
    healthy: { label: "Eat healthier", kcal: 0, proteinPerKg: 1.2 },
  };
  const ACTIVITY = { low: 1.2, light: 1.375, active: 1.55, very: 1.725 };

  // Mifflin-St Jeor BMR x activity, then the goal offset. Floors keep weight-loss targets sensible.
  function targets(profile) {
    const p = Object.assign({ sex: "f", age: 30, height: 160, weight: 60, activity: "light", goal: "healthy" }, profile || {});
    const weight = Math.min(250, Math.max(30, Number(p.weight) || 60));
    const height = Math.min(230, Math.max(120, Number(p.height) || 160));
    const age = Math.min(100, Math.max(14, Number(p.age) || 30));
    const bmr = 10 * weight + 6.25 * height - 5 * age + (p.sex === "m" ? 5 : -161);
    const tdee = bmr * (ACTIVITY[p.activity] || 1.375);
    const goal = GOALS[p.goal] || GOALS.healthy;
    const floor = p.sex === "m" ? 1500 : 1200;
    const kcal = Math.round(Math.max(floor, tdee + goal.kcal) / 10) * 10;
    const protein = Math.round(weight * goal.proteinPerKg);
    const fat = Math.round((kcal * 0.28) / 9);
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    return { kcal, protein, fat, carbs, fiber: p.sex === "m" ? 38 : 25, sodium: 2000, bmr: Math.round(bmr), tdee: Math.round(tdee), goal: p.goal };
  }

  function sum(list) {
    const total = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0, na: 0 };
    for (const item of list) for (const key of Object.keys(total)) total[key] += item[key] || 0;
    return total;
  }

  /* ---------------- tips ---------------- */
  // Up to three short, specific tips for one meal, given the goal and what was already eaten today.
  function mealTips(entry, nutrition, profile, dayBefore) {
    const tips = [];
    const goal = (profile && profile.goal) || "healthy";
    const target = targets(profile);
    const plate = Object.assign({ veg: 1, protein: 1, carbs: 1 }, (entry && entry.plate) || {});
    const share = nutrition.kcal / target.kcal;
    const before = dayBefore || { kcal: 0, p: 0 };
    const left = target.kcal - before.kcal - nutrition.kcal;

    if (goal === "lose") {
      if (share > 0.4) tips.push(`This plate is about ${Math.round(share * 100)}% of your day (${target.kcal} kcal). Keep the next meal light: soup, grilled protein and sayur.`);
      if (plate.fried) tips.push("Ask for it bakar or kukus instead of goreng next time: roughly 100-150 kcal less.");
      if (plate.carbs >= 2) tips.push("Try half rice (setengah nasi) and an extra veg side to cut about 150 kcal.");
    }
    if (goal === "gain" && share < 0.25) tips.push("A bit small for gaining: add rice, an egg or a glass of milk to reach your day.");
    if ((goal === "muscle" || goal === "gain" || goal === "lose") && nutrition.p < 25) {
      tips.push(`Only about ${nutrition.p} g protein. Add an egg (+6 g), tempe (+10 g) or chicken (+20 g).`);
    }
    if (goal === "muscle" && nutrition.p >= 30) tips.push(`Good protein hit: ${nutrition.p} g toward your ${target.protein} g target.`);
    if (plate.sugary) tips.push("The sweet drink adds about 120-200 kcal of sugar. Teh tawar or water saves it.");
    if (!plate.veg) tips.push("No veg on this plate. Add lalapan, kangkung or a side salad for fiber.");
    if (nutrition.na > 1500) tips.push("Salty meal (high sodium). Go easy on kuah and kecap later and drink water.");
    if (plate.processed) tips.push("Processed meat (sausage, nugget, bakso) is fine sometimes; fresh meat or tempe is better day to day.");
    if (left < -150 && goal !== "gain" && goal !== "muscle") tips.push(`You are about ${Math.abs(Math.round(left))} kcal over today's target. No stress: a lighter day tomorrow evens it out.`);
    if (!tips.length) tips.push("Nicely balanced plate. Keep this one on repeat.");
    return tips.slice(0, 3);
  }

  // one line for the diary: how today is going against the targets
  function dayTip(total, profile, hour) {
    const target = targets(profile);
    const goal = (profile && profile.goal) || "healthy";
    const dayDone = hour >= 20;
    if (!total.kcal) return "Nothing logged today yet. Snap your first meal.";
    if (total.p < target.protein * (dayDone ? 0.8 : 0.4) && (goal === "muscle" || goal === "lose" || goal === "gain")) {
      return `Protein is at ${total.p} g of ${target.protein} g. A protein-led dinner (ayam bakar, ikan, tempe, eggs) closes the gap.`;
    }
    if (goal === "lose" && total.kcal > target.kcal) return `Over today's ${target.kcal} kcal by ${total.kcal - target.kcal}. A walk and a lighter breakfast tomorrow help.`;
    if (goal === "gain" && dayDone && total.kcal < target.kcal * 0.85) return `Under today's ${target.kcal} kcal. A snack like milk, banana and peanut butter adds about 400.`;
    if (total.fiber < target.fiber * 0.4 && dayDone) return "Low on fiber today. Add fruit or sayur to the next meal.";
    return `${target.kcal - total.kcal > 0 ? target.kcal - total.kcal : 0} kcal and ${Math.max(0, target.protein - total.p)} g protein left for today.`;
  }

  const api = { FOODS, PORTIONS, PORTION_LABELS, GOALS, ACTIVITY, normalize, matchFood, estimate, targets, sum, mealTips, dayTip };
  root.LahapNutrition = api;
})(typeof window !== "undefined" ? window : globalThis);
