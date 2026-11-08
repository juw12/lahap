# Lahap: a food diary you can search

Live: https://juw12.github.io/lahap/ (add `?demo=1` for a sample fortnight)

![Diary on a phone](screenshots/diary-phone.png) ![Lab recipes](screenshots/lab-phone.png)
![Photo cut out to the food](screenshots/log-cutout-phone.png) ![Estimated nutrition and tips](screenshots/nutrition-phone.png)
![Goal quiz](screenshots/quiz-phone.png) ![Share card](screenshots/share-card.png)

Offline-first web app (PWA). No account, no server: meals, photos and your goal stay in the browser (IndexedDB).

Run locally: serve this folder (e.g. `python -m http.server 8765`) and open http://127.0.0.1:8765/ .
Add `?demo=1` to load a sample fortnight, `?noquiz=1` to skip the first-run quiz.

What it does
- Goal quiz on first run (skippable, retake from Me): goal, body, activity, cooking time, diet. It works out daily
  calories (Mifflin-St Jeor times activity, plus or minus your goal) and protein per kg, and shows the maths.
- Log a meal fast: photo (optional), dish with "seen before" prefill, place, cuisine, price, taste, plate balance,
  portion, rating, buds.
- Food-only photos: the background, plate and cutlery are removed on the device (U-2-Net small model in the browser),
  so tickets, the detail view and share cards show just the food. "Original" keeps the full photo.
- Nutrition estimate and tips: kcal, protein, carbs, fat and fiber from typical recipes for known dishes, or from the
  plate you tick, scaled by portion. Today bar shows calories and protein against your targets, with one tip.
- Lab: type what is in your kitchen, say it (English or Bahasa Indonesia), or scan a written list or receipt.
  Lahap ranks home recipes by what you have, sizes them to your goal and diet, and fits your cooking time.
  "Cooked it, log the meal" fills in the log; "Copy shopping list" copies what is missing.
- Search "Have I eaten this?": count, last time and place, average price and range, plate score, rating.
- Insights: variety score (Simpson diversity of dishes + cuisines), plate score by day, spend (out/home/delivery),
  taste radar, cuisines, top places.
- Share cards like Strava: Card / Receipt / Stats templates, Paper / Dark / Photo / Transparent backgrounds,
  Story 9:16 or Post 1:1, the food cut-out drawn as a sticker, saved as PNG or sent through the share sheet.
- Taste buds: match % from your taste profile, tag buds in meals (+10 points), plan a hangout by WhatsApp,
  mark "We went" (+25), levels New bud, Makan buddy, Regular, Family table.
- Backup export/import (JSON), currency setting.

Limits (honest)
- Nutrition numbers are estimates from typical portions and recipes, not measurements and not medical advice.
  Lahap does not recognise the dish from the photo: you pick or type it.
- Food cut-out: about 1.5 to 3.5 s on a laptop; slower on older phones. The plate trim learns the plate's own
  tint from its rim, so warm or greenish white sides (krupuk, cucumber) stay; food the exact tint of the plate
  can still go with it, and thin bowl rims can stay. Tap "Original" if it looks wrong.
- Scan a list reads printed or neatly written lists and receipts (English model), not photos of food.
- Voice needs a browser with speech recognition (Chrome, Edge, Android, Safari); Firefox users can type.
- The models (about 36 MB: onnxruntime-web, U-2-Net small, Tesseract) load only the first time you use a photo or
  scan, then stay cached for offline use.
- Suggested buds are example profiles: there is no server yet, so buds, matching and points live on this device only.

Tests: `python tests/test_app.py` (Playwright, 128 checks, including a real cut-out and OCR run). Design rules: `design.md`.

Why another food diary: PlateDiary is a private restaurant photo journal and Mynu is a home-cooking journal.
Lahap logs both (ate out, home-cooked, delivery), answers "have I eaten this before?", estimates what is on the
plate against your own goal, turns what is in your kitchen into recipes, and adds Strava-style share cards.

Third-party files in `vendor/`: onnxruntime-web (MIT, Microsoft), U-2-Net small model (Apache-2.0, Xuebin Qin et al.),
tesseract.js and its English data (Apache-2.0).

Licence: MIT.
