/* Lahap Lab: ingredient parsing and goal-aware home recipes (pure, no DOM).
 * Nutrition per 100 g from typical USDA FoodData Central / TKPI values, rounded. Estimates, not advice.
 */
(function (root) {
  "use strict";

  // role: protein | carb | veg | fat | flavor. kcal, p, c, f, fiber per 100 g. unit: grams per "piece" when counted.
  const INGREDIENTS = {
    chicken: { label: "Chicken", aliases: ["chicken", "ayam", "dada ayam", "chicken breast", "paha ayam", "chicken thigh"], role: "protein", kcal: 165, p: 31, c: 0, f: 3.6, fiber: 0, tags: ["meat"] },
    egg: { label: "Eggs", aliases: ["egg", "eggs", "telur", "telor"], role: "protein", kcal: 143, p: 12.6, c: 0.7, f: 9.5, fiber: 0, piece: 55, tags: ["egg"] },
    tofu: { label: "Tofu", aliases: ["tofu", "tahu"], role: "protein", kcal: 76, p: 8, c: 1.9, f: 4.8, fiber: 0.3, tags: ["soy"] },
    tempeh: { label: "Tempe", aliases: ["tempe", "tempeh"], role: "protein", kcal: 192, p: 20, c: 7.6, f: 11, fiber: 5, tags: ["soy"] },
    beef: { label: "Beef", aliases: ["beef", "daging sapi", "daging", "sapi", "minced beef", "daging giling"], role: "protein", kcal: 217, p: 26, c: 0, f: 12, fiber: 0, tags: ["meat", "beef"] },
    fish: { label: "Fish", aliases: ["fish", "ikan", "ikan nila", "tilapia", "ikan dori", "dory", "kakap", "snapper", "tongkol", "kembung", "teri", "ikan teri", "anchovy", "anchovies"], role: "protein", kcal: 110, p: 22, c: 0, f: 2, fiber: 0, tags: ["fish"] },
    salmon: { label: "Salmon", aliases: ["salmon"], role: "protein", kcal: 208, p: 20, c: 0, f: 13, fiber: 0, tags: ["fish"] },
    tuna: { label: "Tuna (canned)", aliases: ["tuna", "tuna kaleng", "canned tuna"], role: "protein", kcal: 116, p: 26, c: 0, f: 1, fiber: 0, tags: ["fish"] },
    shrimp: { label: "Shrimp", aliases: ["shrimp", "prawn", "prawns", "udang"], role: "protein", kcal: 99, p: 24, c: 0.2, f: 0.3, fiber: 0, tags: ["seafood"] },
    chickpeas: { label: "Chickpeas", aliases: ["chickpeas", "chickpea", "garbanzo", "kacang arab"], role: "protein", kcal: 164, p: 8.9, c: 27, f: 2.6, fiber: 7.6, tags: [] },
    lentils: { label: "Lentils", aliases: ["lentils", "lentil", "dal", "kacang lentil"], role: "protein", kcal: 116, p: 9, c: 20, f: 0.4, fiber: 7.9, tags: [] },
    rice: { label: "Rice", aliases: ["rice", "nasi", "beras", "brown rice", "beras merah", "nasi putih"], role: "carb", kcal: 130, p: 2.7, c: 28, f: 0.3, fiber: 0.4, tags: [] },
    noodles: { label: "Noodles", aliases: ["noodles", "noodle", "mie", "mi", "bihun", "kwetiau", "pasta", "spaghetti", "ramen"], role: "carb", kcal: 138, p: 4.5, c: 25, f: 2, fiber: 1.2, tags: ["gluten"] },
    oats: { label: "Oats", aliases: ["oats", "oat", "oatmeal", "havermut"], role: "carb", kcal: 389, p: 17, c: 66, f: 7, fiber: 10, tags: [] },
    bread: { label: "Bread", aliases: ["bread", "roti", "roti tawar", "toast", "tortilla", "wrap"], role: "carb", kcal: 265, p: 9, c: 49, f: 3.2, fiber: 2.7, piece: 30, tags: ["gluten"] },
    potato: { label: "Potato", aliases: ["potato", "potatoes", "kentang"], role: "carb", kcal: 77, p: 2, c: 17, f: 0.1, fiber: 2.2, piece: 150, tags: [] },
    sweetpotato: { label: "Sweet potato", aliases: ["sweet potato", "ubi", "ubi jalar"], role: "carb", kcal: 86, p: 1.6, c: 20, f: 0.1, fiber: 3, piece: 150, tags: [] },
    corn: { label: "Corn", aliases: ["corn", "jagung"], role: "carb", kcal: 86, p: 3.3, c: 19, f: 1.4, fiber: 2.7, tags: [] },
    spinach: { label: "Spinach", aliases: ["spinach", "bayam"], role: "veg", kcal: 23, p: 2.9, c: 3.6, f: 0.4, fiber: 2.2, tags: [] },
    kangkung: { label: "Water spinach", aliases: ["kangkung", "water spinach", "morning glory"], role: "veg", kcal: 19, p: 2.6, c: 3.1, f: 0.2, fiber: 2.1, tags: [] },
    cabbage: { label: "Cabbage", aliases: ["cabbage", "kol", "kubis", "sawi", "pak choy", "pakcoy", "bok choy", "caisim", "sawi putih"], role: "veg", kcal: 25, p: 1.3, c: 6, f: 0.1, fiber: 2.5, tags: [] },
    carrot: { label: "Carrot", aliases: ["carrot", "carrots", "wortel"], role: "veg", kcal: 41, p: 0.9, c: 10, f: 0.2, fiber: 2.8, piece: 70, tags: [] },
    broccoli: { label: "Broccoli", aliases: ["broccoli", "brokoli", "brocoli"], role: "veg", kcal: 34, p: 2.8, c: 7, f: 0.4, fiber: 2.6, tags: [] },
    beans: { label: "Long beans", aliases: ["long beans", "kacang panjang", "buncis", "green beans"], role: "veg", kcal: 47, p: 2.8, c: 8, f: 0.4, fiber: 3.4, tags: [] },
    tomato: { label: "Tomato", aliases: ["tomato", "tomatoes", "tomat"], role: "veg", kcal: 18, p: 0.9, c: 3.9, f: 0.2, fiber: 1.2, piece: 120, tags: [] },
    cucumber: { label: "Cucumber", aliases: ["cucumber", "timun", "mentimun"], role: "veg", kcal: 15, p: 0.7, c: 3.6, f: 0.1, fiber: 0.5, tags: [] },
    mushroom: { label: "Mushrooms", aliases: ["mushroom", "mushrooms", "jamur"], role: "veg", kcal: 22, p: 3.1, c: 3.3, f: 0.3, fiber: 1, tags: [] },
    eggplant: { label: "Eggplant", aliases: ["eggplant", "terong", "terung", "aubergine"], role: "veg", kcal: 25, p: 1, c: 6, f: 0.2, fiber: 3, tags: [] },
    sprouts: { label: "Bean sprouts", aliases: ["bean sprouts", "tauge", "taoge", "toge"], role: "veg", kcal: 30, p: 3, c: 6, f: 0.2, fiber: 1.8, tags: [] },
    onion: { label: "Onion", aliases: ["onion", "bawang bombay", "bombay"], role: "flavor", kcal: 40, p: 1.1, c: 9.3, f: 0.1, fiber: 1.7, tags: [] },
    shallot: { label: "Shallots", aliases: ["shallot", "shallots", "bawang merah"], role: "flavor", kcal: 72, p: 2.5, c: 17, f: 0.1, fiber: 3.2, tags: [] },
    garlic: { label: "Garlic", aliases: ["garlic", "bawang putih"], role: "flavor", kcal: 149, p: 6.4, c: 33, f: 0.5, fiber: 2.1, tags: [] },
    chili: { label: "Chili", aliases: ["chili", "chilli", "cabai", "cabe", "rawit", "sambal"], role: "flavor", kcal: 40, p: 1.9, c: 9, f: 0.4, fiber: 1.5, tags: [] },
    ginger: { label: "Ginger", aliases: ["ginger", "jahe"], role: "flavor", kcal: 80, p: 1.8, c: 18, f: 0.8, fiber: 2, tags: [] },
    lemongrass: { label: "Lemongrass", aliases: ["lemongrass", "serai", "sereh"], role: "flavor", kcal: 99, p: 1.8, c: 25, f: 0.5, fiber: 0, tags: [] },
    lime: { label: "Lime", aliases: ["lime", "jeruk nipis", "lemon", "jeruk limau"], role: "flavor", kcal: 30, p: 0.7, c: 10, f: 0.2, fiber: 2.8, tags: [] },
    coconutmilk: { label: "Coconut milk", aliases: ["coconut milk", "santan"], role: "fat", kcal: 230, p: 2.3, c: 6, f: 24, fiber: 2.2, tags: [] },
    soysauce: { label: "Soy sauce", aliases: ["soy sauce", "kecap", "kecap manis", "kecap asin", "sweet soy sauce", "oyster sauce", "saus tiram"], role: "flavor", kcal: 200, p: 6, c: 40, f: 0, fiber: 0, tags: ["soy"] },
    oil: { label: "Cooking oil", aliases: ["oil", "minyak", "minyak goreng", "olive oil", "cooking oil"], role: "fat", kcal: 884, p: 0, c: 0, f: 100, fiber: 0, tags: [] },
    peanutbutter: { label: "Peanut butter", aliases: ["peanut butter", "selai kacang", "peanuts", "kacang tanah", "kacang"], role: "fat", kcal: 588, p: 25, c: 20, f: 50, fiber: 6, tags: ["nuts"] },
    avocado: { label: "Avocado", aliases: ["avocado", "alpukat"], role: "fat", kcal: 160, p: 2, c: 8.5, f: 15, fiber: 6.7, tags: [] },
    milk: { label: "Milk", aliases: ["milk", "susu", "uht"], role: "protein", kcal: 61, p: 3.2, c: 4.8, f: 3.3, fiber: 0, tags: ["dairy"] },
    yogurt: { label: "Yogurt", aliases: ["yogurt", "yoghurt", "greek yogurt"], role: "protein", kcal: 73, p: 6, c: 6, f: 2.5, fiber: 0, tags: ["dairy"] },
    cheese: { label: "Cheese", aliases: ["cheese", "keju"], role: "fat", kcal: 400, p: 25, c: 1.3, f: 33, fiber: 0, tags: ["dairy"] },
    banana: { label: "Banana", aliases: ["banana", "bananas", "pisang"], role: "carb", kcal: 89, p: 1.1, c: 23, f: 0.3, fiber: 2.6, piece: 110, tags: [] },
    honey: { label: "Honey", aliases: ["honey", "madu"], role: "flavor", kcal: 304, p: 0.3, c: 82, f: 0, fiber: 0, tags: [] },
    // Indonesian bumbu, per 100 g. Galangal, shrimp paste, tamarind, palm sugar, coriander seed: MyFCD (Malaysia).
    // Candlenut, fresh turmeric and the two leaves are approximate; recipes use 1-10 g, so they barely move totals.
    galangal: { label: "Galangal", aliases: ["galangal", "lengkuas", "laos"], role: "flavor", kcal: 36, p: 0.9, c: 6.5, f: 0.7, fiber: 1.6, tags: [] },
    turmeric: { label: "Turmeric", aliases: ["turmeric", "kunyit", "kunir"], role: "flavor", kcal: 60, p: 1.5, c: 10, f: 1, fiber: 3, tags: [] },
    salamleaf: { label: "Salam leaf", aliases: ["daun salam", "salam leaf", "indonesian bay leaf", "bay leaf", "bay leaves"], role: "flavor", kcal: 50, p: 3, c: 8, f: 1, fiber: 5, tags: [] },
    limeleaf: { label: "Lime leaf", aliases: ["daun jeruk", "daun jeruk purut", "kaffir lime leaf", "kaffir lime leaves", "lime leaves", "lime leaf"], role: "flavor", kcal: 50, p: 3, c: 8, f: 1, fiber: 5, tags: [] },
    candlenut: { label: "Candlenut", aliases: ["candlenut", "candlenuts", "kemiri"], role: "fat", kcal: 630, p: 19, c: 8, f: 63, fiber: 3, tags: ["nuts"] },
    coriander: { label: "Coriander seed", aliases: ["coriander seed", "coriander seeds", "ketumbar"], role: "flavor", kcal: 279, p: 11.1, c: 58, f: 0.3, fiber: 12.5, tags: [] },
    shrimppaste: { label: "Shrimp paste", aliases: ["shrimp paste", "terasi", "trasi", "belacan"], role: "flavor", kcal: 161, p: 28.7, c: 6.8, f: 2.1, fiber: 0, tags: ["seafood"] },
    tamarind: { label: "Tamarind", aliases: ["tamarind", "asam jawa", "asem jawa"], role: "flavor", kcal: 313, p: 3.5, c: 72.6, f: 1, fiber: 1.4, tags: [] },
    palmsugar: { label: "Palm sugar", aliases: ["palm sugar", "gula merah", "gula jawa", "gula aren", "gula melaka"], role: "flavor", kcal: 374, p: 0, c: 92.7, f: 0.4, fiber: 0, tags: [] },
  };

  // pantry basics every recipe may use without counting as missing
  const PANTRY = ["salt", "pepper", "water", "sugar"];

  // grams per serving for a 1-person base. core = needed to call it this dish.
  const RECIPES = [
    { id: "ayam-bakar", name: "Ayam bakar kecap with rice and lalapan", minutes: 35, cuisine: "Indonesian",
      items: [["chicken", 150, true], ["rice", 160, true], ["soysauce", 20], ["garlic", 6], ["shallot", 10], ["cucumber", 60], ["cabbage", 40], ["lime", 10], ["oil", 5]],
      steps: ["Rub chicken with crushed garlic, shallot, kecap and lime; rest 15 min.", "Grill or pan-sear on low heat 6-7 min a side, brushing more kecap.", "Serve with rice, sliced cucumber and raw cabbage (lalapan)."] },
    { id: "tumis-kangkung-tempe", name: "Tumis kangkung with baked tempe", minutes: 20, cuisine: "Indonesian",
      items: [["kangkung", 200, true], ["tempeh", 120, true], ["garlic", 8], ["shallot", 10], ["chili", 5], ["soysauce", 8], ["oil", 8], ["rice", 120]],
      steps: ["Slice tempe, season with garlic and salt, bake or pan-fry with a little oil until golden.", "Stir-fry shallot, garlic and chili 1 min, add kangkung and a splash of water.", "Season with a little kecap asin; serve with tempe and rice."] },
    { id: "telur-dadar-sayur", name: "Veggie telur dadar", minutes: 12, cuisine: "Indonesian",
      items: [["egg", 110, true], ["carrot", 40], ["cabbage", 40], ["onion", 20], ["chili", 4], ["oil", 6], ["rice", 120]],
      steps: ["Beat eggs with grated carrot, shredded cabbage, onion, chili and salt.", "Cook in a lightly oiled pan on medium heat, fold when set.", "Serve with rice or on its own for a lighter plate."] },
    { id: "nasi-goreng-sehat", name: "Lighter nasi goreng with egg and veg", minutes: 15, cuisine: "Indonesian",
      items: [["rice", 180, true], ["egg", 55, true], ["carrot", 40], ["cabbage", 50], ["shallot", 10], ["garlic", 6], ["soysauce", 12], ["oil", 8], ["chicken", 60]],
      steps: ["Use day-old rice. Stir-fry shallot and garlic, add diced chicken if you have it.", "Add carrot and cabbage, then rice and kecap; toss on high heat.", "Push aside, scramble the egg, mix through."] },
    { id: "sup-ayam", name: "Sup ayam sayur", minutes: 30, cuisine: "Indonesian",
      items: [["chicken", 120, true], ["carrot", 60, true], ["potato", 100], ["cabbage", 60], ["garlic", 6], ["onion", 20], ["rice", 120]],
      steps: ["Simmer chicken in 600 ml water with garlic and onion for 15 min.", "Add diced potato and carrot, cook 10 min; add cabbage for the last 3 min.", "Season with salt and pepper. Serve with rice if you need the energy."] },
    { id: "tahu-tempe-bacem", name: "Tahu tempe bacem", minutes: 40, cuisine: "Indonesian",
      items: [["tofu", 120, true], ["tempeh", 100, true], ["soysauce", 15], ["palmsugar", 10], ["tamarind", 5], ["galangal", 5], ["salamleaf", 1], ["coriander", 2], ["garlic", 6], ["shallot", 10], ["rice", 120]],
      steps: ["Simmer tofu and tempe in water with garlic, shallot, ginger, kecap and a little palm sugar for 25 min until dry.", "Pan-sear briefly for colour (skip the deep fryer).", "Serve warm with rice and veg."] },
    { id: "ikan-kukus-jahe", name: "Steamed fish with ginger and soy", minutes: 20, cuisine: "Chinese-Indonesian",
      items: [["fish", 160, true], ["ginger", 10, true], ["garlic", 6], ["soysauce", 12], ["cabbage", 80], ["rice", 140], ["oil", 4]],
      steps: ["Lay fish on a plate with sliced ginger and garlic.", "Steam 10-12 min, add bok choy or cabbage for the last 3 min.", "Drizzle soy and a little hot oil; serve with rice."] },
    { id: "capcay-udang", name: "Capcay with shrimp", minutes: 20, cuisine: "Chinese-Indonesian",
      items: [["shrimp", 120, true], ["broccoli", 80, true], ["carrot", 50], ["cabbage", 60], ["mushroom", 40], ["garlic", 6], ["soysauce", 12], ["oil", 8], ["rice", 120]],
      steps: ["Stir-fry garlic, add shrimp until pink.", "Add carrot and broccoli, then cabbage and mushrooms with a splash of water.", "Season with oyster or soy sauce; thicken with a little cornstarch water."] },
    { id: "oat-pisang", name: "Banana peanut butter oats", minutes: 8, cuisine: "Breakfast",
      items: [["oats", 50, true], ["banana", 110, true], ["milk", 200], ["peanutbutter", 16], ["honey", 5]],
      steps: ["Cook oats in milk for 4-5 min, stirring.", "Top with sliced banana and a spoon of peanut butter.", "A little honey only if you need it sweet."] },
    { id: "overnight-oats", name: "Overnight oats with yogurt", minutes: 5, cuisine: "Breakfast",
      items: [["oats", 45, true], ["yogurt", 120, true], ["milk", 80], ["banana", 60], ["honey", 5]],
      steps: ["Mix oats, yogurt and milk in a jar.", "Leave in the fridge overnight.", "Top with banana in the morning."] },
    { id: "gado-gado", name: "Home gado-gado", minutes: 25, cuisine: "Indonesian",
      items: [["cabbage", 80, true], ["sprouts", 50], ["beans", 60], ["tofu", 80, true], ["egg", 55], ["potato", 80], ["peanutbutter", 25, true], ["chili", 4], ["garlic", 4], ["soysauce", 8], ["lime", 8]],
      steps: ["Blanch cabbage, sprouts and long beans 1-2 min; boil potato and egg.", "Pan-sear tofu with a little oil.", "Whisk peanut butter with warm water, garlic, chili, kecap and lime into a sauce; pour over."] },
    { id: "orak-arik-brokoli", name: "Orak-arik egg and broccoli", minutes: 10, cuisine: "Indonesian",
      items: [["egg", 110, true], ["broccoli", 120, true], ["garlic", 6], ["onion", 20], ["oil", 6], ["rice", 120]],
      steps: ["Stir-fry garlic and onion, add broccoli florets and a splash of water, cover 2 min.", "Pour in beaten eggs and scramble together.", "Season with salt and pepper."] },
    { id: "mie-kuah", name: "Mie kuah with egg and greens", minutes: 12, cuisine: "Indonesian",
      items: [["noodles", 180, true], ["egg", 55, true], ["cabbage", 70], ["carrot", 30], ["garlic", 6], ["chili", 3], ["chicken", 60]],
      steps: ["Boil 500 ml water with garlic; add sliced chicken if using.", "Add noodles and carrot, then greens; crack in the egg for the last 2 min.", "Season with salt, pepper and a little soy (skip the instant seasoning packet to cut sodium)."] },
    { id: "chicken-broccoli-bowl", name: "Chicken broccoli rice bowl", minutes: 20, cuisine: "Everyday",
      items: [["chicken", 150, true], ["broccoli", 120, true], ["rice", 160, true], ["garlic", 6], ["soysauce", 12], ["oil", 6]],
      steps: ["Slice chicken, sear with garlic until cooked through.", "Add broccoli with a splash of water, cover 3 min.", "Toss with soy sauce; serve over rice."] },
    { id: "salmon-teriyaki", name: "Salmon soy-honey bowl", minutes: 20, cuisine: "Japanese-style",
      items: [["salmon", 130, true], ["rice", 160, true], ["broccoli", 80], ["cucumber", 50], ["soysauce", 15], ["honey", 8], ["ginger", 4]],
      steps: ["Pan-sear salmon skin side down 4 min, flip 2 min.", "Add soy, honey and grated ginger; spoon the glaze over.", "Serve on rice with steamed broccoli and cucumber."] },
    { id: "sayur-lodeh", name: "Sayur lodeh with tempe", minutes: 30, cuisine: "Indonesian",
      items: [["beans", 60, true], ["eggplant", 80], ["cabbage", 60], ["coconutmilk", 60, true], ["tempeh", 80], ["shallot", 10], ["garlic", 6], ["chili", 4], ["galangal", 5], ["salamleaf", 1], ["rice", 120]],
      steps: ["Saute shallot, garlic and chili; add 300 ml water and the vegetables.", "Simmer 10 min, add coconut milk and cubed tempe, simmer 5 min more without boiling hard.", "Season with salt and a pinch of sugar."] },
    { id: "sapo-tahu", name: "Sapo tahu with chicken", minutes: 25, cuisine: "Chinese-Indonesian",
      items: [["tofu", 150, true], ["chicken", 80], ["broccoli", 60], ["carrot", 40], ["mushroom", 40], ["garlic", 6], ["soysauce", 15], ["rice", 120]],
      steps: ["Pan-sear tofu cubes until golden.", "Stir-fry garlic and chicken, add vegetables and 150 ml water with oyster or soy sauce.", "Add tofu, thicken lightly and serve with rice."] },
    { id: "tumis-daging-brokoli", name: "Beef and broccoli stir-fry", minutes: 20, cuisine: "Everyday",
      items: [["beef", 130, true], ["broccoli", 120, true], ["garlic", 6], ["onion", 30], ["soysauce", 15], ["ginger", 4], ["oil", 6], ["rice", 150]],
      steps: ["Slice beef thin against the grain, toss with soy and ginger.", "Sear beef on high heat 1-2 min, set aside.", "Stir-fry onion and broccoli, return the beef, toss and serve with rice."] },
    { id: "kari-ayam", name: "Light chicken and potato curry", minutes: 40, cuisine: "Indonesian",
      items: [["chicken", 140, true], ["potato", 120, true], ["carrot", 50], ["coconutmilk", 40], ["shallot", 12], ["garlic", 6], ["ginger", 4], ["lemongrass", 5], ["turmeric", 4], ["candlenut", 5], ["coriander", 2], ["salamleaf", 1], ["rice", 120]],
      steps: ["Saute shallot, garlic, ginger, lemongrass and curry powder 2 min.", "Add chicken, potato, carrot and 400 ml water; simmer 20 min.", "Stir in a little coconut milk at the end; serve with rice."] },
    { id: "banana-smoothie", name: "Banana peanut milk smoothie", minutes: 5, cuisine: "Drink",
      items: [["banana", 120, true], ["milk", 250, true], ["peanutbutter", 20], ["oats", 20], ["honey", 6]],
      steps: ["Blend everything with a few ice cubes until smooth.", "Drink as a snack between meals (good for gaining)."] },
    { id: "chickpea-curry", name: "Chickpea and spinach curry", minutes: 25, cuisine: "Indian-style",
      items: [["chickpeas", 160, true], ["spinach", 100, true], ["tomato", 120], ["onion", 40], ["garlic", 6], ["ginger", 4], ["coconutmilk", 30], ["rice", 120]],
      steps: ["Saute onion, garlic, ginger and curry spices.", "Add chopped tomato and chickpeas with 150 ml water; simmer 10 min.", "Stir in spinach and a little coconut milk; serve with rice."] },
    { id: "ubi-telur", name: "Sweet potato and egg plate", minutes: 25, cuisine: "Breakfast",
      items: [["sweetpotato", 150, true], ["egg", 110, true], ["spinach", 80], ["avocado", 50], ["oil", 4]],
      steps: ["Steam or roast sweet potato chunks 15-20 min.", "Boil or fry the eggs with very little oil; wilt spinach in the same pan.", "Plate with sliced avocado; salt and pepper."] },
    { id: "tuna-wrap", name: "Tuna egg wrap", minutes: 10, cuisine: "Everyday",
      items: [["tuna", 80, true], ["bread", 60, true], ["egg", 55], ["cucumber", 50], ["tomato", 50], ["yogurt", 30]],
      steps: ["Mix tuna with yogurt, salt and pepper (lighter than mayo).", "Fill the wrap or bread with tuna, sliced boiled egg, cucumber and tomato.", "Roll tight and toast for 1 min if you like it warm."] },
    { id: "udang-tomat", name: "Shrimp in tomato sauce", minutes: 15, cuisine: "Indonesian",
      items: [["shrimp", 130, true], ["tomato", 150, true], ["onion", 30], ["garlic", 6], ["chili", 4], ["soysauce", 8], ["oil", 6], ["rice", 140]],
      steps: ["Saute garlic, onion and chili.", "Add chopped tomato and a splash of water, cook to a sauce 5 min.", "Add shrimp for 2-3 min until pink; serve with rice."] },
    { id: "bubur-ayam", name: "Home bubur ayam", minutes: 35, cuisine: "Indonesian",
      items: [["rice", 60, true], ["chicken", 100, true], ["ginger", 5], ["garlic", 6], ["egg", 55], ["soysauce", 8]],
      steps: ["Simmer rice (or leftover nasi) in 700 ml water with ginger until creamy, about 25 min.", "Poach and shred the chicken in the same pot.", "Top with chicken, a boiled egg and a little kecap."] },
    { id: "soto-ayam", name: "Soto ayam rumahan", minutes: 40, cuisine: "Indonesian",
      items: [["chicken", 130, true], ["sprouts", 50], ["cabbage", 50], ["egg", 55], ["lemongrass", 5], ["ginger", 5], ["turmeric", 5], ["galangal", 5], ["salamleaf", 1], ["limeleaf", 1], ["garlic", 6], ["shallot", 10], ["lime", 8], ["rice", 120]],
      steps: ["Simmer chicken with lemongrass, ginger and turmeric 20 min; shred.", "Blend and saute garlic and shallot, add to the broth.", "Serve broth over chicken, sprouts, cabbage, egg and rice with lime."] },
    { id: "tofu-veg-stirfry", name: "Tofu and mixed veg stir-fry", minutes: 15, cuisine: "Everyday",
      items: [["tofu", 150, true], ["carrot", 50], ["broccoli", 60], ["cabbage", 60], ["beans", 40], ["garlic", 6], ["soysauce", 12], ["oil", 8], ["rice", 120]],
      steps: ["Pan-sear tofu cubes until golden, set aside.", "Stir-fry garlic and whatever veg you have, harder ones first.", "Return tofu, season with soy and serve with rice."] },
  ];

  // goal changes how much of each role goes on the plate
  const GOAL_SCALE = {
    lose: { protein: 1.1, carb: 0.55, veg: 1.5, fat: 0.6, flavor: 1 },
    maintain: { protein: 1, carb: 1, veg: 1, fat: 1, flavor: 1 },
    healthy: { protein: 1, carb: 0.9, veg: 1.3, fat: 0.8, flavor: 1 },
    gain: { protein: 1.25, carb: 1.5, veg: 1, fat: 1.4, flavor: 1 },
    muscle: { protein: 1.5, carb: 1.15, veg: 1.1, fat: 1, flavor: 1 },
  };

  const GOAL_NOTE = {
    lose: "Less rice and oil, more veg and protein so it fills you up for fewer calories.",
    maintain: "A regular, balanced home portion.",
    healthy: "Extra veg, a little less oil and rice.",
    gain: "Bigger rice and protein portions plus healthy fats for extra energy.",
    muscle: "Protein portion bumped up by half to support training.",
  };

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  // find ingredients in free text (typed list, voice transcript or OCR of a receipt/list)
  function parseIngredients(text) {
    const haystack = " " + normalize(text) + " ";
    const found = [];
    const aliasList = [];
    for (const [id, item] of Object.entries(INGREDIENTS)) {
      for (const alias of item.aliases) aliasList.push([normalize(alias), id]);
    }
    // longest aliases first so "bawang merah" wins over "bawang", "sweet potato" over "potato"
    aliasList.sort((a, b) => b[0].length - a[0].length);
    let rest = haystack;
    for (const [alias, id] of aliasList) {
      const needle = " " + alias + " ";
      if (rest.includes(needle)) {
        if (!found.includes(id)) found.push(id);
        rest = rest.split(needle).join(" ");
      }
    }
    return found;
  }

  function scaledItems(recipe, goal) {
    const scale = GOAL_SCALE[goal] || GOAL_SCALE.maintain;
    return recipe.items.map(([id, grams, core]) => {
      const item = INGREDIENTS[id];
      return { id, label: item.label, grams: Math.round((grams * (scale[item.role] || 1)) / 5) * 5, core: !!core, role: item.role, piece: item.piece };
    });
  }

  function nutritionOf(items) {
    const total = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 };
    for (const entry of items) {
      const item = INGREDIENTS[entry.id];
      for (const key of Object.keys(total)) total[key] += (item[key] * entry.grams) / 100;
    }
    for (const key of Object.keys(total)) total[key] = Math.round(total[key]);
    return total;
  }

  // diet: { vegetarian, noBeef, noSeafood, noNuts, noDairy, noEgg, noGluten }
  function allowed(recipe, diet) {
    const d = diet || {};
    const tags = new Set();
    for (const [id] of recipe.items) for (const tag of INGREDIENTS[id].tags) tags.add(tag);
    if (d.vegetarian && (tags.has("meat") || tags.has("fish") || tags.has("seafood") || tags.has("beef"))) return false;
    if (d.noBeef && tags.has("beef")) return false;
    if (d.noSeafood && (tags.has("seafood") || tags.has("fish"))) return false;
    if (d.noNuts && tags.has("nuts")) return false;
    if (d.noDairy && tags.has("dairy")) return false;
    if (d.noEgg && tags.has("egg")) return false;
    if (d.noGluten && tags.has("gluten")) return false;
    return true;
  }

  // how well a recipe suits a goal, from its scaled nutrition
  function goalFit(nutrition, goal) {
    const proteinShare = (nutrition.p * 4) / Math.max(1, nutrition.kcal);
    if (goal === "lose") return proteinShare * 2 + (nutrition.kcal < 550 ? 0.6 : 0) + Math.min(nutrition.fiber, 10) / 20;
    if (goal === "muscle") return proteinShare * 2 + (nutrition.p >= 35 ? 0.6 : 0);
    if (goal === "gain") return Math.min(nutrition.kcal, 900) / 900 + proteinShare;
    return proteinShare + Math.min(nutrition.fiber, 10) / 15;
  }

  // Rank recipes for what you have. have: ingredient ids. Returns the best few with scaled amounts and nutrition.
  function suggest(have, options) {
    const opts = Object.assign({ goal: "healthy", diet: {}, limit: 3, maxMinutes: 0 }, options || {});
    const owned = new Set(have || []);
    const results = [];
    for (const recipe of RECIPES) {
      if (!allowed(recipe, opts.diet)) continue;
      if (opts.maxMinutes && recipe.minutes > opts.maxMinutes) continue;
      const items = scaledItems(recipe, opts.goal);
      const core = items.filter((item) => item.core);
      const coreHave = core.filter((item) => owned.has(item.id)).length;
      if (owned.size && coreHave === 0) continue;
      const allHave = items.filter((item) => owned.has(item.id)).length;
      const nutrition = nutritionOf(items);
      const coverage = coreHave / core.length;
      const score = coverage * 3 + (allHave / items.length) + goalFit(nutrition, opts.goal) * 0.8;
      results.push({
        id: recipe.id,
        name: recipe.name,
        minutes: recipe.minutes,
        cuisine: recipe.cuisine,
        steps: recipe.steps.slice(),
        items,
        have: items.filter((item) => owned.has(item.id)).map((item) => item.id),
        missing: items.filter((item) => !owned.has(item.id)).map((item) => item.label),
        missingCore: core.filter((item) => !owned.has(item.id)).map((item) => item.label),
        nutrition,
        note: GOAL_NOTE[opts.goal] || GOAL_NOTE.maintain,
        score,
      });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, opts.limit);
  }

  // plate portions (0-2) for logging a cooked recipe as a meal
  function plateFor(result) {
    const grams = { veg: 0, protein: 0, carb: 0 };
    for (const item of result.items) if (grams[item.role] !== undefined) grams[item.role] += item.grams;
    const level = (value, some, lots) => (value >= lots ? 2 : value >= some ? 1 : 0);
    return { veg: level(grams.veg, 60, 160), protein: level(grams.protein, 60, 140), carbs: level(grams.carb, 80, 170), fried: false, sugary: false, processed: false };
  }

  function amountLabel(item) {
    if (item.piece) {
      const count = Math.max(1, Math.round(item.grams / item.piece));
      return `${count} × ${item.label.toLowerCase()} (~${item.grams} g)`;
    }
    return `${item.grams} g ${item.label.toLowerCase()}`;
  }

  const api = { INGREDIENTS, RECIPES, PANTRY, GOAL_SCALE, GOAL_NOTE, parseIngredients, scaledItems, nutritionOf, allowed, suggest, plateFor, amountLabel };
  root.LahapRecipes = api;
})(typeof window !== "undefined" ? window : globalThis);
