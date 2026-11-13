# Lahap: a food diary you can search

Live: https://juw12.github.io/lahap/ (add `?demo=1` for a sample fortnight)

![Diary on a phone](screenshots/diary-phone.png) ![Lab recipes](screenshots/lab-phone.png)
![Photo cut out to the food](screenshots/log-cutout-phone.png) ![Estimated nutrition and tips](screenshots/nutrition-phone.png)
![Goal quiz](screenshots/quiz-phone.png) ![Share card](screenshots/share-card.png)

Offline-first web app (PWA). No account, no server: meals, photos and your goal stay in the browser (IndexedDB).
Open https://juw12.github.io/lahap/ (no `?demo`) to start your own diary; it opens empty and saves every meal on the device.

Run locally: serve this folder (e.g. `python -m http.server 8765`) and open http://127.0.0.1:8765/ .
Add `?demo=1` to load a sample fortnight, `?noquiz=1` to skip the first-run quiz.

What it does
- Goal quiz on first run (skippable, retake from Profile): goal, body, activity, cooking time, diet. It works out daily
  calories (Mifflin-St Jeor times activity, plus or minus your goal) and protein per kg, and shows the maths.
- Log a meal fast: photo (optional), dish with "seen before" prefill, place, cuisine, price, taste, plate balance,
  portion, rating, buds.
- Food-only photos: the background, plate and cutlery are removed on the device (U-2-Net small model in the browser),
  so tickets, the detail view and share cards show just the food. "Original" keeps the full photo.
- Nutrition estimate and tips: kcal, protein, carbs, fat and fiber from typical recipes for known dishes, or from the
  plate you tick, scaled by portion. Today bar shows calories and protein against your targets, with one tip.
- Lab: type what is in your kitchen, say it (English or Bahasa Indonesia), or scan a written list or receipt.
  Set List language to Bahasa and the scanner reads with the Indonesian OCR model too. It knows everyday bumbu
  (lengkuas, daun salam, kemiri, terasi, kunyit, ketumbar, gula merah, asam jawa, daun jeruk).
  Lahap ranks home recipes by what you have, sizes them to your goal and diet, and fits your cooking time.
  "Cooked it, log the meal" fills in the log; "Copy shopping list" copies what is missing.
- Search "Have I eaten this?": count, last time and place, average price and range, plate score, rating.
- Insights: variety score (Simpson diversity of dishes + cuisines), plate score by day, spend (out/home/delivery),
  taste radar, cuisines, top places.
- Share cards like Strava: Card / Receipt / Stats templates, Paper / Dark / Photo / Transparent backgrounds,
  Story 9:16 or Post 1:1, the food cut-out drawn as a sticker, saved as PNG or sent through the share sheet.
  Every meal surface has one-tap share — the chip on each diary ticket, plus "Share card" on the
  On-repeat hero and the search answer card — so a past meal is as quick to share as a new one.
- Favourites: tap the heart on a meal; the heart in the search bar shows only those.
- Stamp book (Insights): every place you ate out becomes a stamp with its visit count, and a place turns "regular"
  at 3 visits. Tap a stamp for the place page: visits, spend, what you ordered and who you went with.
- Bud pages: tap a bud to see every meal you shared, where you went together and what you ordered, then log or plan
  the next one.
- "Makan apa?" picker: can't decide? It picks from dishes you already rated well and have not had lately
  (all, eat out or home), never the same pick twice in a row, and one tap starts the log.
- Recap slip: a receipt for any month or year (meals, new dishes, new places, top dish, top place, spend), with
  "Copy" to paste it into a chat.
- Numbers off (Profile): one switch hides calories, nutrition and plate scores on your meals, for a plain photo
  and memory diary. Prices and ratings stay.
- Home-screen shortcuts: long-press the installed icon for "Log a meal" and "Makan apa?".
- Taste buds: match % from your taste profile, tag buds in meals (+10 points), plan a hangout by WhatsApp,
  mark "We went" (+25), levels New bud, Makan buddy, Regular, Family table.
- Invite links: "Invite a bud" shares a link that carries only your taste profile (no meals); your friend
  opens it, sees "<name> wants to compare tastes" and adds you with one tap. No account, no server.
- Save, sync and share (Profile): Share backup (phone share sheet) or Save backup file, then Restore or merge on another
  device. Meals are matched by id, the newest edit wins and deleted meals stay deleted, so syncing twice never doubles
  anything. It is file-based sync, not a cloud: nothing moves until you share the file.
- Crash-safe logging: the meal you are typing is kept as a draft on every change, so if the phone reloads the tab (camera
  app, low memory) the sheet reopens with everything you entered. Photos decode straight to 1080 px, auto cutout can be
  turned off and switches itself off if it ever ran a phone out of memory, and saves retry when a sleeping phone drops the
  database connection. If the browser blocks storage (private tab) the diary says so instead of losing meals.
- One tap removes the sample fortnight if it ever got mixed into a real diary. Currency setting.

Limits (honest)
- Nutrition numbers are estimates from typical portions and recipes, not measurements and not medical advice.
  Lahap does not recognise the dish from the photo: you pick or type it.
- Food cut-out: about 1.5 to 3.5 s on a laptop, about 3 to 4 s per photo on a phone-speed CPU (emulated 4x
  slowdown; almost all of it is the model itself). The first one also downloads about 18 MB. The plate trim learns the plate's own
  tint from its rim, so warm or greenish white sides (krupuk, cucumber) stay; food the exact tint of the plate
  can still go with it, and thin bowl rims can stay. Tap "Original" if it looks wrong.
- Scan a list reads printed or neatly written lists and receipts (English, or English + Indonesian when List language is Bahasa), not photos of food.
- Voice needs a browser with speech recognition (Chrome, Edge, Android, Safari); Firefox users can type.
- The models (about 37 MB: onnxruntime-web, U-2-Net small, Tesseract English + Indonesian) load only the first time you use a photo or
  scan, then stay cached for offline use.
- Install: Chrome / Android shows "Install app" or "Add to Home Screen"; on iPhone use Safari, Share, Add to
  Home Screen. It opens full screen with its own icon. `python tests/device_check.py` runs the camera photo,
  cut-out, Bahasa voice and share sheet in iPhone (WebKit) and Android (Chromium) profiles; not yet on a real handset.
- Suggested buds are example profiles. Invited buds are real but one-way snapshots: there is no server, so buds,
  matching and points live on each device and do not sync after the invite.

Tests: `python tests/test_app.py` (Playwright, 425 checks, including a real cut-out and OCR run). Design rules: `design.md`.

Lahap vs PlateDiary (checked against platediary.app/features on 13 Nov 2026)

PlateDiary is a polished native app for iPhone and Android: a private photo journal for eating out, with a free tier,
a paid Premium tier and a separate AI add-on. Lahap is a free web app with no paid tier. Both keep the diary on your
device with no account.

Everything on PlateDiary's feature list now has a Lahap counterpart, free:
- Cut-outs, and several dishes from one photo: open a meal and tap Split dishes; each dish becomes its own meal.
- Stamp book, place pages, favourites, people you eat with, a craving picker ("Makan apa?") and a month or year recap.
- Collections: eight smart collections that fill themselves (favourites, five stars, with buds, home, delivered,
  this month, treats, first tries) plus your own named collections.
- Food map of every place you ate (OpenStreetMap; pin a place where you stand or by tapping the map).
- Look & feel: six colour palettes (including a dark "Night market") and four type styles.
- Share Studio: collage templates (grid, scatter, stack, receipt), doodles on top, and a 3 second looping video.
- Games with your own cut-outs: Tumble, Float, Water, Magnet, Claw, Launch, Catch, Tap, Burst, Slice.
- Bill scan: a photo of the bill fills in the total (or one line's price), read on the device in English or Bahasa.
- Ask Lahap: questions about your own diary ("how much did I spend on bakso this month?") and a written story of
  your week, month or year. Name ideas for a new meal from your usual dish at that place and from photos that look alike.
- 14 interface languages: English, Bahasa Indonesia, Bahasa Melayu, Thai, Vietnamese, Traditional and Simplified
  Chinese, Japanese, Korean, Spanish, Brazilian Portuguese, French, German, Italian.
- Backup to iCloud Drive or Google Drive: "Back up now" opens the share sheet (Save to Files or Drive); on a computer
  you can pick a file inside a synced iCloud Drive or Google Drive folder and Lahap rewrites it after every change.
- Widgets: on Windows 11 the installed app offers Quick Snap, Memory Lane, Craving Shuffle and Table Window on the
  Widgets board; in the app, Memory lane, Craving shuffle, Table window (latest meals or one collection, as Scatter,
  Postcard or Menu) and the Save wall live under Insights, and home-screen shortcuts open
  Log, Makan apa? and the Food map directly.

Where Lahap goes further
- Nothing to install and no store: it opens in any browser on phone or laptop, and works offline after the first visit.
- Everything is free. There is no Premium tier and no AI add-on to buy, and nothing is sent to a server.
- Search answers "have I eaten this?" with count, last time and place, price range and rating in one card.
- Eating out, home-cooked and delivery live in one diary, with spend split across the three.
- Nutrition estimates against your own goal, and a single switch to hide all numbers.
- Lab turns what is in your kitchen into ranked recipes and a shopping list, typed, spoken or scanned.

Honest limits (what a web app cannot match today)
- Phone home-screen widgets on iPhone and Android need a native app from the App Store or Google Play, which needs
  developer accounts. Lahap's widgets run on Windows 11 only; phones get home-screen shortcuts instead.
- Name ideas only know dishes already in your diary. PlateDiary's paid AI can name a dish you have never logged.
- The 13 non-English languages were machine-translated and have not been reviewed by native speakers yet. Each covers
  94-99 % of the interface text; the few strings left show in English. Your own dish names and notes are never translated.
- The food map needs a connection for the map tiles; offline it lists your pinned places instead.

Third-party files in `vendor/`: onnxruntime-web (MIT, Microsoft), U-2-Net small model (Apache-2.0, Xuebin Qin et al.),
tesseract.js and its English and Indonesian data (Apache-2.0), Leaflet 1.9.4 (BSD-2-Clause).

Licence: MIT.
