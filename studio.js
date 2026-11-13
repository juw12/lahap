/* Lahap studio: collections, food map, Share Studio (collage, doodles, looping video), Ask Lahap and stories,
   Look & feel, backup to iCloud Drive / Google Drive, dish splitting, bill scan, name ideas, widget data.
   app.js calls LahapStudio.init(api) once; everything here stays on the device. */
(function () {
  "use strict";

  const S = window.LahapStudioLogic;
  const L = window.LahapLogic;
  let api = null;
  const signatures = {};
  let ocrWorker = null;
  let backupHandle = null;

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const esc = (value) => api.esc(value);
  const norm = (value) => (L && L.normalize ? L.normalize(value) : String(value || "").trim().toLowerCase());

  const ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function entries() {
    return api.state.entries.filter((entry) => entry && entry.name);
  }

  function settings() {
    return api.state.settings;
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---------------- sheet ---------------- */

  function dialog() {
    let node = $("#dlg-studio");
    if (!node) {
      node = document.createElement("dialog");
      node.id = "dlg-studio";
      node.className = "sheet";
      node.setAttribute("aria-labelledby", "studio-title");
      document.body.appendChild(node);
    }
    return node;
  }

  function sheet(title, body, foot, wide) {
    const node = dialog();
    stopLoops();
    node.classList.toggle("wide", !!wide);
    node.innerHTML = `
      <div class="sheet-head"><h2 id="studio-title">${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${ICON_CLOSE}</button></div>
      <div class="sheet-body studio">${body}</div>
      ${foot ? `<div class="sheet-foot">${foot}</div>` : ""}`;
    if (!node.open) node.showModal();
    $(".sheet-body", node).scrollTop = 0;
    return node;
  }

  const loops = new Set();
  function stopLoops() {
    for (const stop of loops) stop();
    loops.clear();
  }

  /* ---------------- entry points rendered by app.js ---------------- */

  const TOOLS = [
    ["collections", "Collections", "Smart and your own"],
    ["map", "Food map", "Every place you ate"],
    ["collage", "Share Studio", "Collage, doodles, video"],
    ["games", "Games", "Play with your cut-outs"],
    ["ask", "Ask Lahap", "Questions and stories"],
    ["memory", "Memory lane", "This day, back then"],
  ];

  function insightsHtml() {
    return `<section class="panel studio-panel">
      <p class="eyebrow">Studio</p>
      <h2>Play with your diary</h2>
      <div class="studio-grid">${TOOLS.map(([key, name, why]) => `<button type="button" class="studio-tile" data-studio="${key}"><span class="studio-name">${esc(name)}</span><span class="studio-why">${esc(why)}</span></button>`).join("")}</div>
    </section>`;
  }

  function profileHtml() {
    const look = settings().look || {};
    const last = settings().lastBackup;
    return `<section class="panel studio-profile">
      <h2>Look &amp; feel</h2>
      <p class="muted small">Colours and type for the whole app. Free, all of them.</p>
      <div class="swatches" role="radiogroup" aria-label="Colours">${S.PALETTES.map((palette) => `<button type="button" class="swatch${(look.palette || "receipt") === palette.id ? " on" : ""}" role="radio" aria-checked="${(look.palette || "receipt") === palette.id}" data-look-palette="${palette.id}"><span class="dots">${palette.swatch.map((colour) => `<i style="background:${colour}"></i>`).join("")}</span>${esc(palette.name)}</button>`).join("")}</div>
      <div class="chips type-chips" role="radiogroup" aria-label="Type">${S.TYPES.map((type) => `<button type="button" class="chip${(look.type || "classic") === type.id ? " on" : ""}" role="radio" aria-checked="${(look.type || "classic") === type.id}" data-look-type="${type.id}">${esc(type.name)}</button>`).join("")}</div>
      <label class="field lang-field"><span>Language</span><select id="set-lang">${(window.LahapI18n ? window.LahapI18n.LANGS : [["en", "English"]]).map(([code, name]) => `<option value="${code}"${(settings().lang || "en") === code ? " selected" : ""}>${esc(name)}</option>`).join("")}</select></label>
    </section>
    <section class="panel studio-profile">
      <h2>Back up to iCloud Drive or Google Drive</h2>
      <p class="muted small">${last ? `Last backup ${esc(api.shortDate(last.at))}, ${last.count} meals.` : "No backup yet."} On a phone, pick “Save to Files” (iCloud Drive) or “Drive” in the share sheet. On a computer, pick a file inside your iCloud Drive or Google Drive folder and Lahap keeps it up to date after every change.</p>
      <div class="row-btns">
        <button type="button" class="btn primary" data-studio-backup="share">Back up now</button>
        <button type="button" class="btn" data-studio-backup="file"${"showSaveFilePicker" in window ? "" : " hidden"}>Keep a synced file</button>
      </div>
      <p class="muted small" id="studio-backup-status">${backupHandle ? "Synced file on: Lahap writes it after every change." : ""}</p>
    </section>`;
  }

  function detailHtml(entry) {
    const inCollections = (settings().collections || []).filter((collection) => (collection.ids || []).includes(entry.id)).map((collection) => collection.name);
    return `<div class="studio-detail">
      <button type="button" class="chip" data-studio-collect="${esc(entry.id)}">${inCollections.length ? `In ${esc(inCollections.join(", "))}` : "Add to a collection"}</button>
      ${entry.cutout ? `<button type="button" class="chip" data-studio-split="${esc(entry.id)}">Split dishes</button>` : ""}
    </div>`;
  }

  function logToolsHtml() {
    return `<div class="studio-log-tools">
      <button type="button" class="chip" data-studio-names>Name ideas</button>
      <label class="chip file-chip">Scan bill<input type="file" accept="image/*" capture="environment" data-studio-bill hidden></label>
      <span class="muted small" id="studio-log-status" role="status"></span>
    </div>
    <div class="chips" id="studio-name-ideas"></div>`;
  }

  /* ---------------- log sheet hooks ---------------- */

  let logContext = null;

  function bindLog(form, draft) {
    logContext = { form, draft };
  }

  function setField(name, value) {
    if (!logContext) return;
    const input = logContext.form.querySelector(`[name="${name}"]`);
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function logStatus(text) {
    const node = $("#studio-log-status");
    if (node) node.textContent = text;
  }

  async function imagePixels(src, size) {
    const image = await loadImage(src);
    const scale = Math.min(1, size / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, width, height);
    return { data: context.getImageData(0, 0, width, height).data, width, height, image };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  async function signatureOf(src) {
    try {
      const { data } = await imagePixels(src, 48);
      return S.signatureFromPixels(data);
    } catch (error) {
      return null;
    }
  }

  async function nameIdeas() {
    if (!logContext) return;
    const draft = logContext.draft;
    const place = (logContext.form.querySelector('[name="place"]') || {}).value || draft.place || "";
    const photo = draft.cutout || draft.photo;
    logStatus(photo ? "Comparing with your photos…" : "");
    let signature = null;
    if (photo) {
      signature = await signatureOf(photo);
      for (const entry of entries()) {
        const src = entry.cutout || entry.photo;
        if (src && !(entry.id in signatures)) signatures[entry.id] = await signatureOf(src);
      }
    }
    const ideas = S.suggestNames(entries(), { place, signature, signatures, limit: 5 });
    const holder = $("#studio-name-ideas");
    if (!holder) return;
    holder.innerHTML = ideas.length
      ? ideas.map((idea) => `<button type="button" class="chip" data-studio-name="${esc(idea.name)}" title="${esc(idea.why)}">${esc(idea.name)} <span class="muted small">${esc(idea.why)}</span></button>`).join("")
      : "";
    logStatus(ideas.length ? "From your own diary. Tap one to use it." : place || photo ? "No match in your diary yet. Type the dish name." : "Add a photo or a place first, then try again.");
  }

  async function ocr(file) {
    await api.loadScriptOnce("vendor/tesseract/tesseract.min.js");
    if (!ocrWorker) {
      const base = new URL("vendor/tesseract/", location.href).href;
      ocrWorker = await window.Tesseract.createWorker("ind+eng", 1, {
        workerPath: base + "worker.min.js",
        corePath: base,
        langPath: base.replace(/\/$/, ""),
        gzip: true,
        logger: (message) => {
          if (message.status === "recognizing text") logStatus(`Reading the bill… ${Math.round((message.progress || 0) * 100)}%`);
        },
      });
    }
    const result = await ocrWorker.recognize(file);
    return result.data.text || "";
  }

  async function scanBill(file) {
    logStatus("Loading the bill reader (first time only)…");
    try {
      const bill = S.parseBill(await ocr(file));
      showBill(bill);
    } catch (error) {
      logStatus("Could not read that bill. Type the price instead.");
    }
  }

  function showBill(bill) {
    const holder = $("#studio-name-ideas");
    if (!bill.total && !bill.items.length) {
      logStatus("No prices found on that photo. Try a sharper, flat photo of the bill.");
      return;
    }
    if (bill.total) setField("price", bill.total);
    logStatus(bill.total ? `Total ${api.money(bill.total)} filled in${bill.tax || bill.service ? " (tax and service included)" : ""}. Tap a line to use just that dish.` : "Tap a line to use its price.");
    if (holder) {
      holder.innerHTML = bill.items.slice(0, 8).map((item) => `<button type="button" class="chip" data-studio-bill-item="${item.price}" data-studio-bill-name="${esc(item.name)}">${esc(item.name)} <span class="mono">${esc(api.money(item.price))}</span></button>`).join("");
    }
  }

  // After the cut-out runs in the log sheet: count the dishes so the user knows Split dishes will work.
  async function afterCutout(cutout, statusNode) {
    try {
      const pieces = await piecesOf(cutout, false);
      if (pieces.length > 1 && statusNode) statusNode.textContent += ` ${pieces.length} dishes found: after saving, open the meal and tap Split dishes.`;
    } catch (error) {
      /* counting is a hint only */
    }
  }

  /* ---------------- dish splitting ---------------- */

  async function piecesOf(src, crop) {
    const small = await imagePixels(src, 220);
    const alpha = new Uint8Array(small.width * small.height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = small.data[i * 4 + 3];
    const boxes = S.splitBlobs(alpha, small.width, small.height, { minShare: 0.1, maxPieces: 6, pad: 3 });
    if (!crop) return boxes;
    const image = small.image;
    const sx = (image.naturalWidth || image.width) / small.width;
    const sy = (image.naturalHeight || image.height) / small.height;
    return boxes.map((box) => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(box.w * sx);
      canvas.height = Math.round(box.h * sy);
      canvas.getContext("2d").drawImage(image, box.x * sx, box.y * sy, box.w * sx, box.h * sy, 0, 0, canvas.width, canvas.height);
      return { src: canvas.toDataURL("image/png"), share: box.share };
    });
  }

  let splitState = null;

  async function openSplit(id) {
    const entry = api.state.entries.find((item) => item.id === id);
    if (!entry || !entry.cutout) return;
    const pieces = await piecesOf(entry.cutout, true);
    if (pieces.length < 2) {
      api.toast("Only one dish in this cut-out.");
      return;
    }
    splitState = { entry, pieces };
    if ($("#dlg-detail").open) $("#dlg-detail").close();
    sheet("Split dishes", `
      <p class="muted">${pieces.length} dishes found in this photo. Name each one: they become separate meals with the same time and place. The first keeps the original meal.</p>
      <div class="split-list">${pieces.map((piece, index) => `<label class="split-item"><img src="${piece.src}" alt="" width="72" height="72"><span class="field"><span>Dish ${index + 1}</span><input type="text" data-split-name="${index}" value="${index === 0 ? esc(entry.name) : ""}" placeholder="${index === 0 ? "" : "e.g. Es teh"}"></span></label>`).join("")}</div>`,
      `<button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" data-studio-split-save>Save ${pieces.length} meals</button>`);
  }

  async function saveSplit() {
    if (!splitState) return;
    const { entry, pieces } = splitState;
    const names = $$("[data-split-name]").map((input) => input.value.trim());
    const now = new Date().toISOString();
    entry.cutout = pieces[0].src;
    entry.name = names[0] || entry.name;
    entry.updatedAt = now;
    await api.store.put(entry);
    let made = 0;
    for (let i = 1; i < pieces.length; i++) {
      const copy = {
        id: api.uid(),
        ts: entry.ts,
        name: names[i] || `${entry.name} (dish ${i + 1})`,
        place: entry.place,
        source: entry.source,
        cuisine: entry.cuisine,
        price: "",
        rating: entry.rating,
        tastes: [],
        friends: (entry.friends || []).slice(),
        plate: Object.assign({}, entry.plate),
        photo: null,
        cutout: pieces[i].src,
        notes: "",
        updatedAt: now,
      };
      await api.store.put(copy);
      api.state.entries.push(copy);
      made += 1;
    }
    splitState = null;
    dialog().close();
    api.render();
    api.toast(`Saved ${made + 1} dishes from one photo`);
  }

  /* ---------------- collections ---------------- */

  function allCollections() {
    return S.smartCollections(entries()).concat(S.customCollections(settings().collections, entries()));
  }

  function coverHtml(list) {
    const shots = list.slice(0, 3);
    return `<span class="cover">${shots.map((entry) => `<img src="${api.imageFor(entry)}" alt="" width="40" height="40">`).join("") || '<span class="cover-empty"></span>'}</span>`;
  }

  function openCollections() {
    const smart = S.smartCollections(entries()).filter((collection) => collection.entries.length);
    const custom = S.customCollections(settings().collections, entries());
    sheet("Collections", `
      <h3>Smart collections <span class="muted small">fill themselves</span></h3>
      <div class="collection-list">${smart.map((collection) => `<button type="button" class="collection-row" data-studio-collection="${collection.id}">${coverHtml(collection.entries)}<span class="meal-main"><span class="meal-name">${esc(collection.name)}</span><span class="meal-where">${esc(collection.why)} · ${api.plural(collection.entries.length, "meal")}</span></span></button>`).join("")}</div>
      <h3>Your collections</h3>
      ${custom.length ? `<div class="collection-list">${custom.map((collection) => `<button type="button" class="collection-row" data-studio-collection="${collection.id}">${coverHtml(collection.entries)}<span class="meal-main"><span class="meal-name">${esc(collection.name)}</span><span class="meal-where">${api.plural(collection.entries.length, "meal")}</span></span></button>`).join("")}</div>` : '<p class="muted">None yet. Make one here, then add meals from any meal’s page.</p>'}
      <form class="inline-form" data-studio-new-collection><input type="text" name="name" placeholder="New collection, e.g. Best laksa" maxlength="40" aria-label="New collection name"><button type="submit" class="btn">Make</button></form>`);
  }

  function openCollection(id) {
    const collection = allCollections().find((item) => item.id === id);
    if (!collection) return;
    sheet(collection.name, `
      <p class="eyebrow">${collection.smart ? "Smart collection" : "Your collection"} · ${api.plural(collection.entries.length, "meal")}</p>
      ${collection.entries.length ? `<div class="meal-list">${collection.entries.map((entry) => api.mealRowHtml(entry)).join("")}</div>` : '<p class="muted">No meals in it yet. Open a meal and tap “Add to a collection”.</p>'}`,
      `<button type="button" class="btn" data-studio="collections">All collections</button>${collection.smart ? "" : `<button type="button" class="btn danger ghost" data-studio-drop-collection="${collection.id}">Delete collection</button>`}<button type="button" class="btn primary" data-studio-collage-from="${collection.id}">Make a collage</button>`);
  }

  async function newCollection(name) {
    const clean = String(name || "").trim().slice(0, 40);
    if (!clean) return null;
    const collection = { id: "c" + api.uid(), name: clean, ids: [] };
    settings().collections = (settings().collections || []).concat(collection);
    await api.saveMeta();
    return collection;
  }

  function openCollect(entryId) {
    const custom = settings().collections || [];
    if ($("#dlg-detail").open) $("#dlg-detail").close();
    const entry = api.state.entries.find((item) => item.id === entryId);
    sheet("Add to a collection", `
      <p class="muted">${esc(entry ? entry.name : "")}</p>
      <div class="check-list">${custom.map((collection) => `<label class="check-row"><input type="checkbox" data-studio-toggle="${collection.id}" data-entry="${esc(entryId)}"${(collection.ids || []).includes(entryId) ? " checked" : ""}> ${esc(collection.name)}</label>`).join("") || '<p class="muted">No collections yet.</p>'}</div>
      <form class="inline-form" data-studio-new-collection data-entry="${esc(entryId)}"><input type="text" name="name" placeholder="New collection" maxlength="40" aria-label="New collection name"><button type="submit" class="btn">Make and add</button></form>`,
      `<button type="button" class="btn primary" data-studio-back="${esc(entryId)}">Done</button>`);
  }

  /* ---------------- food map ---------------- */

  // Sample pins so the demo map is not empty (around Jakarta). Real places are pinned by the user.
  const SAMPLE_PINS = {
    "warung bu sri": [-6.2297, 106.8295], "bakso pak gun": [-6.2146, 106.8451], "krua thai": [-6.1944, 106.8229],
    "menya kiri": [-6.2253, 106.7997], "pho ha long": [-6.1862, 106.8340], "rm minang jaya": [-6.2088, 106.8456],
    "soto pak min": [-6.2402, 106.8173], "teh tarik corner": [-6.1754, 106.8272], "warung kak ros": [-6.2615, 106.8106],
    "wrap and co": [-6.2241, 106.8095],
  };

  function placeList() {
    const places = new Map();
    for (const entry of entries()) {
      const key = norm(entry.place);
      if (!key || key === "home" || key === "rumah") continue;
      if (!places.has(key)) places.set(key, { key, name: entry.place, visits: [], sample: true });
      const place = places.get(key);
      place.visits.push(entry);
      if (!entry.sample) place.sample = false;
    }
    const pins = settings().placeGeo || {};
    return Array.from(places.values()).map((place) => {
      const pin = pins[place.key] || (place.sample && SAMPLE_PINS[place.key] ? { lat: SAMPLE_PINS[place.key][0], lng: SAMPLE_PINS[place.key][1], sample: true } : null);
      return Object.assign(place, { pin });
    }).sort((a, b) => b.visits.length - a.visits.length);
  }

  let mapState = null;

  function loadCssOnce(href) {
    if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  async function openMap() {
    const places = placeList();
    const pinned = places.filter((place) => place.pin);
    const unpinned = places.filter((place) => !place.pin);
    sheet("Food map", `
      <div id="food-map" class="food-map" role="application" aria-label="Map of the places you ate at"></div>
      <p class="muted small" id="map-hint">${pinned.length ? `${api.plural(pinned.length, "place")} on the map. Tap a pin for its page.` : "No pins yet."} Map © OpenStreetMap contributors.</p>
      ${unpinned.length ? `<h3>Not on the map yet</h3><div class="pin-list">${unpinned.map((place) => `<div class="pin-row"><span class="meal-main"><span class="meal-name">${esc(place.name)}</span><span class="meal-where">${api.plural(place.visits.length, "visit")}</span></span><button type="button" class="chip" data-studio-pin-here="${esc(place.key)}">I’m here now</button><button type="button" class="chip" data-studio-pin-tap="${esc(place.key)}">Tap the map</button></div>`).join("")}</div>` : ""}`, "", true);
    const holder = $("#food-map");
    try {
      if (!navigator.onLine) throw new Error("offline");
      await loadCssOnce("vendor/leaflet/leaflet.css");
      await api.loadScriptOnce("vendor/leaflet/leaflet.js");
      const map = window.L.map(holder, { zoomControl: true, attributionControl: true });
      window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
      const bounds = [];
      for (const place of pinned) {
        const marker = window.L.marker([place.pin.lat, place.pin.lng], {
          icon: window.L.divIcon({ className: "map-pin", html: `<span>${place.visits.length}</span>`, iconSize: [30, 30], iconAnchor: [15, 30] }),
          title: place.name,
          keyboard: true,
        }).addTo(map);
        marker.on("click", () => {
          dialog().close();
          api.openPlace(place.key);
        });
        bounds.push([place.pin.lat, place.pin.lng]);
      }
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
      else if (bounds.length === 1) map.setView(bounds[0], 15);
      else map.setView([-6.2, 106.82], 11);
      map.on("click", (event) => {
        if (!mapState || !mapState.pinning) return;
        pinPlace(mapState.pinning, event.latlng.lat, event.latlng.lng);
      });
      mapState = { map, pinning: null };
      setTimeout(() => map.invalidateSize(), 60);
    } catch (error) {
      holder.classList.add("offline");
      holder.innerHTML = `<ol class="map-fallback">${pinned.map((place) => `<li><button type="button" class="link-btn" data-place="${esc(place.key)}">${esc(place.name)}</button> <span class="mono">${place.pin.lat.toFixed(3)}, ${place.pin.lng.toFixed(3)}</span></li>`).join("")}</ol><p class="muted small">The map needs a connection; your pins are listed instead.</p>`;
      mapState = null;
    }
  }

  async function pinPlace(key, lat, lng) {
    settings().placeGeo = Object.assign({}, settings().placeGeo, { [key]: { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) } });
    await api.saveMeta();
    api.toast("Pinned");
    openMap();
  }

  function pinHere(key) {
    if (!navigator.geolocation) {
      api.toast("This browser cannot share your location. Tap the map instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => pinPlace(key, position.coords.latitude, position.coords.longitude),
      () => api.toast("Location not allowed. Tap the map instead."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  /* ---------------- Share Studio: collage, doodles, looping video ---------------- */

  const TEMPLATES = [
    ["grid", "Grid"],
    ["scatter", "Scatter"],
    ["stack", "Stack"],
    ["receipt", "Receipt"],
  ];
  const INKS = ["#1d1813", "#b4380f", "#2f6a3a", "#1f6680", "#ffffff"];
  let collage = null;

  function collageEntries(fromCollection) {
    const pool = fromCollection ? (allCollections().find((item) => item.id === fromCollection) || { entries: [] }).entries : entries().slice().sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
    const withCuts = pool.filter((entry) => entry.cutout);
    return (withCuts.length >= 3 ? withCuts : pool).slice(0, 9);
  }

  async function openCollage(fromCollection) {
    const list = collageEntries(fromCollection);
    const images = await Promise.all(list.map((entry) => loadImage(api.imageFor(entry)).catch(() => null)));
    collage = { list, images: images.filter(Boolean), template: "scatter", title: fromCollection ? (allCollections().find((item) => item.id === fromCollection) || {}).name || "My plates" : "My plates", strokes: [], ink: INKS[1], drawing: false, seed: 7 };
    sheet("Share Studio", `
      <div class="studio-canvas-wrap"><canvas id="collage-canvas" width="1080" height="1350" aria-label="Collage preview"></canvas></div>
      <div class="chips" role="radiogroup" aria-label="Template">${TEMPLATES.map(([key, name]) => `<button type="button" class="chip${key === collage.template ? " on" : ""}" role="radio" aria-checked="${key === collage.template}" data-collage-template="${key}">${name}</button>`).join("")}<button type="button" class="chip" data-collage-shuffle>Shuffle</button></div>
      <label class="field"><span>Title</span><input type="text" id="collage-title" value="${esc(collage.title)}" maxlength="32"></label>
      <div class="doodle-bar"><span class="muted small">Doodle on it:</span>${INKS.map((ink) => `<button type="button" class="ink${ink === collage.ink ? " on" : ""}" data-collage-ink="${ink}" style="background:${ink}" aria-label="Pen colour ${ink}"></button>`).join("")}<button type="button" class="chip" data-collage-undo>Undo</button></div>
      <p class="muted small" id="collage-status">${api.plural(collage.images.length, "meal")} on the page.</p>`,
      `<button type="button" class="btn" data-collage-video>Looping video</button><button type="button" class="btn primary" data-collage-save>Save image</button>`, true);
    const canvas = $("#collage-canvas");
    bindDoodle(canvas);
    $("#collage-title").addEventListener("input", (event) => {
      collage.title = event.target.value;
      drawCollage(0);
    });
    drawCollage(0);
  }

  function seeded(seed) {
    let value = seed;
    return () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  function layout(count, template, seed) {
    const random = seeded(seed);
    const slots = [];
    const W = 1080;
    const top = 220;
    const H = 1350 - top - 120;
    if (template === "grid") {
      const cols = count <= 4 ? 2 : 3;
      const rows = Math.ceil(count / cols);
      const size = Math.min(W / cols, H / rows) - 30;
      for (let i = 0; i < count; i++) {
        slots.push({ x: (W - cols * (size + 30)) / 2 + (i % cols) * (size + 30) + size / 2 + 15, y: top + Math.floor(i / cols) * (size + 30) + size / 2, s: size, r: 0 });
      }
    } else if (template === "stack") {
      for (let i = 0; i < count; i++) {
        slots.push({ x: W / 2 + (random() - 0.5) * 360, y: top + H - 180 - i * (H - 260) / Math.max(1, count - 1), s: 360 - i * 14, r: (random() - 0.5) * 0.5 });
      }
    } else if (template === "receipt") {
      const size = Math.min(170, H / count - 10);
      for (let i = 0; i < count; i++) slots.push({ x: 200, y: top + 20 + i * (size + 10) + size / 2, s: size, r: 0, line: true });
    } else {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + random();
        const radius = i === 0 ? 0 : 230 + random() * 170;
        slots.push({ x: W / 2 + Math.cos(angle) * radius, y: top + H / 2 + Math.sin(angle) * radius * 1.1, s: i === 0 ? 420 : 250 + random() * 90, r: (random() - 0.5) * 0.6 });
      }
    }
    return slots;
  }

  function drawCollage(time, target) {
    if (!collage) return;
    const canvas = target || $("#collage-canvas");
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const style = getComputedStyle(document.documentElement);
    const paper = style.getPropertyValue("--paper").trim() || "#f5efe3";
    const ink = style.getPropertyValue("--ink").trim() || "#1d1813";
    const accent = style.getPropertyValue("--accent").trim() || "#b4380f";
    context.fillStyle = paper;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = ink;
    context.textAlign = "center";
    context.font = '700 76px "Iowan Old Style", Georgia, serif';
    context.fillText(collage.title || "My plates", canvas.width / 2, 130);
    context.font = '400 30px ui-monospace, Consolas, monospace';
    context.fillStyle = accent;
    context.fillText(`${collage.list.length} PLATES · LAHAP`, canvas.width / 2, 180);
    const slots = layout(collage.images.length, collage.template, collage.seed);
    collage.images.forEach((image, index) => {
      const slot = slots[index];
      const bob = time ? Math.sin(time / 420 + index) * 14 : 0;
      const spin = time ? Math.sin(time / 700 + index * 2) * 0.06 : 0;
      context.save();
      context.translate(slot.x, slot.y + bob);
      context.rotate(slot.r + spin);
      const ratio = image.width / image.height;
      const w = ratio >= 1 ? slot.s : slot.s * ratio;
      const h = ratio >= 1 ? slot.s / ratio : slot.s;
      context.shadowColor = "rgba(0,0,0,0.18)";
      context.shadowBlur = 18;
      context.shadowOffsetY = 8;
      context.drawImage(image, -w / 2, -h / 2, w, h);
      context.restore();
      if (slot.line) {
        const entry = collage.list[index];
        context.textAlign = "left";
        context.fillStyle = ink;
        context.font = '600 40px system-ui, sans-serif';
        context.fillText(entry.name.slice(0, 22), 330, slot.y);
        context.font = '400 28px ui-monospace, Consolas, monospace';
        context.fillText(`${api.shortDate(entry.ts)}${entry.place ? " · " + entry.place.slice(0, 18) : ""}`, 330, slot.y + 40);
      }
    });
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of collage.strokes) {
      context.strokeStyle = stroke.ink;
      context.lineWidth = 10;
      context.beginPath();
      stroke.points.forEach(([x, y], i) => (i ? context.lineTo(x, y) : context.moveTo(x, y)));
      context.stroke();
    }
  }

  function bindDoodle(canvas) {
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return [((event.clientX - rect.left) / rect.width) * canvas.width, ((event.clientY - rect.top) / rect.height) * canvas.height];
    };
    canvas.addEventListener("pointerdown", (event) => {
      collage.drawing = true;
      canvas.setPointerCapture(event.pointerId);
      collage.strokes.push({ ink: collage.ink, points: [point(event)] });
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!collage.drawing) return;
      collage.strokes[collage.strokes.length - 1].points.push(point(event));
      drawCollage(0);
    });
    const end = () => {
      collage.drawing = false;
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  }

  async function shareOrDownload(blob, filename, title) {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return "shared";
      } catch (error) {
        if (error && error.name === "AbortError") return "cancelled";
      }
    }
    api.download(blob, filename);
    return "downloaded";
  }

  function saveCollage() {
    const canvas = $("#collage-canvas");
    canvas.toBlob((blob) => shareOrDownload(blob, "lahap-collage.png", collage.title), "image/png");
  }

  function recordVideo() {
    const canvas = $("#collage-canvas");
    const status = $("#collage-status");
    if (!canvas.captureStream || !window.MediaRecorder) {
      status.textContent = "This browser cannot record video. Save the image instead.";
      return;
    }
    const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
    const type = types.find((item) => MediaRecorder.isTypeSupported(item)) || "";
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 4000000 } : undefined);
    const chunks = [];
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    const started = performance.now();
    let frame = 0;
    const tick = (now) => {
      drawCollage(now - started + 1);
      if (now - started < 3000) frame = requestAnimationFrame(tick);
      else recorder.stop();
    };
    recorder.onstop = () => {
      cancelAnimationFrame(frame);
      drawCollage(0);
      const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
      const extension = /mp4/.test(blob.type) ? "mp4" : "webm";
      status.textContent = `Video ready (${(blob.size / 1e6).toFixed(1)} MB, 3 s loop).`;
      shareOrDownload(blob, `lahap-collage.${extension}`, collage.title);
    };
    status.textContent = "Recording a 3 second loop…";
    recorder.start();
    frame = requestAnimationFrame(tick);
    loops.add(() => cancelAnimationFrame(frame));
  }

  /* ---------------- Ask Lahap and stories ---------------- */

  const EXAMPLES = ["How much did I spend eating out this month?", "When did I last eat bakso?", "Where is the best soto?", "Who did I eat with this week?", "Most expensive meal", "What did I eat yesterday?"];

  function budName(id) {
    return api.personName ? api.personName(id) : id;
  }

  function openAsk(question) {
    sheet("Ask Lahap", `
      <form class="inline-form" data-studio-ask><input type="search" name="q" placeholder="Ask about your meals" value="${esc(question || "")}" aria-label="Question"><button type="submit" class="btn primary">Ask</button></form>
      <div class="chips">${EXAMPLES.map((example) => `<button type="button" class="chip" data-studio-example="${esc(example)}">${esc(example)}</button>`).join("")}</div>
      <div id="ask-answer" aria-live="polite"></div>
      <h3>Your story</h3>
      <div class="chips"><button type="button" class="chip" data-studio-story="7">This week</button><button type="button" class="chip" data-studio-story="30">This month</button><button type="button" class="chip" data-studio-story="365">This year</button></div>
      <div id="story-out" aria-live="polite"></div>
      <p class="muted small">Answers and stories are counted from your own diary on this device. Nothing is sent anywhere, and nothing is made up.</p>`);
    if (question) answer(question);
  }

  function answer(question) {
    const result = S.answer(entries(), question, { money: api.money, budName });
    const rows = result.ids.map((id) => api.state.entries.find((entry) => entry.id === id)).filter(Boolean);
    $("#ask-answer").innerHTML = `<div class="answer-card"><p class="answer-text">${esc(result.text)}</p>${rows.length ? `<div class="meal-list">${rows.map((entry) => api.mealRowHtml(entry)).join("")}</div>` : ""}</div>`;
  }

  function showStory(days) {
    const story = S.story(entries(), { days, money: api.money, budName });
    const text = [story.title, ""].concat(story.paragraphs).join("\n");
    $("#story-out").innerHTML = `<article class="story-card"><h4>${esc(story.title)}</h4>${story.paragraphs.map((line) => `<p>${esc(line)}</p>`).join("")}<button type="button" class="chip" data-studio-copy-story>Copy</button></article>`;
    $("#story-out").dataset.text = text;
  }

  /* ---------------- memory lane (also feeds the widgets) ---------------- */

  function memoryLane(now) {
    const today = now ? new Date(now) : new Date();
    const list = entries().filter((entry) => !entry.sample || entries().every((item) => item.sample));
    const sameDay = (date, months) => {
      const then = new Date(today);
      then.setMonth(then.getMonth() - months);
      return date.getFullYear() === then.getFullYear() && date.getMonth() === then.getMonth() && date.getDate() === then.getDate();
    };
    for (const [months, label] of [[12, "A year ago today"], [6, "Six months ago today"], [3, "Three months ago today"], [1, "A month ago today"]]) {
      const hit = list.filter((entry) => sameDay(new Date(entry.ts), months));
      if (hit.length) return { label, entries: hit };
    }
    const weekAgo = list.filter((entry) => {
      const days = (today - new Date(entry.ts)) / 86400000;
      return days >= 6 && days < 8;
    });
    if (weekAgo.length) return { label: "A week ago", entries: weekAgo };
    const fallback = list.slice().sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    return fallback.length ? { label: "A favourite from your diary", entries: fallback.slice(0, 1) } : null;
  }

  /* ---------------- Table window (PlateDiary's 5th widget) ---------------- */

  // r40: your latest meals, or one collection, laid out three ways. Kept in settings so it stays put.
  const TABLE_STYLES = [
    ["scatter", "Scatter"],
    ["postcard", "Postcard"],
    ["menu", "Menu"],
  ];

  function tableChoice() {
    const saved = settings().tableWindow || {};
    return { style: saved.style || "scatter", source: saved.source || "latest" };
  }

  function tableEntries(source) {
    if (source && source !== "latest") {
      const found = allCollections().find((collection) => collection.id === source);
      if (found) return found.entries.slice(0, 6);
    }
    return entries().slice().sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 6);
  }

  function tableBodyHtml(choice) {
    const list = tableEntries(choice.source);
    if (!list.length) return '<p class="muted">Nothing here yet.</p>';
    if (choice.style === "menu") {
      return `<ol class="table-menu">${list.map((entry) => `<li><button type="button" data-open="${esc(entry.id)}"><span class="tm-name">${esc(entry.name)}</span><span class="tm-dots" aria-hidden="true"></span><span class="tm-price">${entry.price ? esc(api.money(entry.price)) : esc(api.shortDate(entry.ts))}</span></button></li>`).join("")}</ol>`;
    }
    if (choice.style === "postcard") {
      const first = list[0];
      return `<button type="button" class="table-postcard" data-open="${esc(first.id)}"><img src="${api.imageFor(first)}" alt=""><span class="tp-text"><span class="tp-name">${esc(first.name)}</span><span class="tp-where">${esc([first.place, api.shortDate(first.ts)].filter(Boolean).join(" · "))}</span></span></button>`;
    }
    const tilts = [-4, 3, -2, 5, -5, 2];
    return `<div class="table-scatter">${list.map((entry, index) => `<button type="button" class="wall-tile" style="transform:rotate(${tilts[index % tilts.length]}deg)" data-open="${esc(entry.id)}"><img src="${api.imageFor(entry)}" alt="${esc(entry.name)}"></button>`).join("")}</div>`;
  }

  function tableWindowHtml() {
    const choice = tableChoice();
    const sources = allCollections().filter((collection) => collection.entries.length);
    return `<div class="table-window" id="table-window">
      <div class="table-controls">
        <label class="sr-only" for="table-source">Show</label>
        <select id="table-source">
          <option value="latest"${choice.source === "latest" ? " selected" : ""}>Latest meals</option>
          ${sources.map((collection) => `<option value="${esc(collection.id)}"${choice.source === collection.id ? " selected" : ""}>${esc(collection.name)}</option>`).join("")}
        </select>
        <div class="chips" role="radiogroup" aria-label="Style">${TABLE_STYLES.map(([key, name]) => `<button type="button" class="chip${choice.style === key ? " on" : ""}" role="radio" aria-checked="${choice.style === key}" data-table-style="${key}">${esc(name)}</button>`).join("")}</div>
      </div>
      <div class="table-body">${tableBodyHtml(choice)}</div>
    </div>`;
  }

  async function setTable(part, value) {
    settings().tableWindow = Object.assign({}, tableChoice(), { [part]: value });
    await api.saveMeta();
    const holder = document.getElementById("table-window");
    if (holder) holder.outerHTML = tableWindowHtml();
    writeWidgetData();
  }

  function openMemory() {
    const lane = memoryLane();
    const shuffle = entries().length ? entries()[Math.floor(Math.random() * entries().length)] : null;
    sheet("Memory lane", `
      ${lane ? `<p class="eyebrow">${esc(lane.label)}</p><div class="memory-wall">${lane.entries.map((entry) => `<button type="button" class="wall-tile" data-open="${esc(entry.id)}"><img src="${api.imageFor(entry)}" alt=""><span>${esc(entry.name)}</span></button>`).join("")}</div>` : '<p class="muted">Log a few meals and they come back here.</p>'}
      ${shuffle ? `<h3>Craving shuffle</h3><button type="button" class="wall-tile wide" data-open="${esc(shuffle.id)}"><img src="${api.imageFor(shuffle)}" alt=""><span>${esc(shuffle.name)}${shuffle.place ? ` · ${esc(shuffle.place)}` : ""}</span></button>` : ""}
      <h3>Table window</h3>
      ${tableWindowHtml()}
      <h3>Save wall</h3>
      <div class="memory-wall small">${entries().filter((entry) => entry.cutout || entry.photo).slice(-12).reverse().map((entry) => `<button type="button" class="wall-tile" data-open="${esc(entry.id)}"><img src="${api.imageFor(entry)}" alt="${esc(entry.name)}"></button>`).join("") || '<p class="muted">Photos you log show up here.</p>'}</div>`,
      `<button type="button" class="btn" data-studio="memory">Shuffle again</button>`);
  }

  // Windows 11 widgets read this snapshot from the cache (see sw.js); it holds names and places only, no photos.
  async function writeWidgetData() {
    if (!("caches" in window)) return;
    try {
      const lane = memoryLane();
      const all = entries();
      const pick = all.length ? all[Math.floor(Math.random() * all.length)] : null;
      const data = {
        updated: new Date().toISOString(),
        count: all.length,
        memoryLabel: lane ? lane.label : "Nothing yet",
        memory: lane ? lane.entries.slice(0, 3).map((entry) => `${entry.name}${entry.place ? " · " + entry.place : ""}`).join("\n") : "Log a meal to start",
        craving: pick ? `${pick.name}${pick.place ? " at " + pick.place : ""}` : "Log a meal to start",
        tableLabel: tableChoice().source === "latest" ? "Latest meals" : (allCollections().find((collection) => collection.id === tableChoice().source) || {}).name || "Latest meals",
        table: tableEntries(tableChoice().source).slice(0, 5).map((entry) => `${entry.name}${entry.place ? " · " + entry.place : ""}`).join("\n") || "Log a meal to start",
      };
      const cache = await caches.open("lahap-widgets");
      await cache.put("widget-data.json", new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } }));
    } catch (error) {
      /* widgets are optional */
    }
  }

  /* ---------------- Look & feel ---------------- */

  function applyLook() {
    const look = settings().look || {};
    const root = document.documentElement;
    if (look.palette && look.palette !== "receipt") root.dataset.theme = look.palette;
    else delete root.dataset.theme;
    if (look.type && look.type !== "classic") root.dataset.type = look.type;
    else delete root.dataset.type;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", getComputedStyle(root).getPropertyValue("--paper").trim() || "#f5efe3");
  }

  async function setLook(part, value) {
    settings().look = Object.assign({}, settings().look, { [part]: value });
    await api.saveMeta();
    applyLook();
    api.render();
  }

  /* ---------------- backup ---------------- */

  async function backupNow() {
    const file = api.backupFile("application/json");
    const result = await shareOrDownload(file, file.name, "Lahap backup");
    if (result !== "cancelled") {
      await api.markBackedUp();
      api.toast(result === "shared" ? "Backup handed to the share sheet" : "Backup file saved");
      api.render();
    }
  }

  async function chooseBackupFile() {
    try {
      backupHandle = await window.showSaveFilePicker({ suggestedName: "lahap-backup.json", types: [{ description: "Lahap backup", accept: { "application/json": [".json"] } }] });
      await writeBackupFile();
      api.toast("Synced backup file set");
      api.render();
    } catch (error) {
      if (error && error.name !== "AbortError") api.toast("Could not use that file.");
    }
  }

  let writeTimer = null;
  async function writeBackupFile() {
    if (!backupHandle) return;
    const writable = await backupHandle.createWritable();
    await writable.write(api.backupFile("application/json"));
    await writable.close();
    await api.markBackedUp();
  }

  let widgetTimer = null;
  function afterChange() {
    clearTimeout(widgetTimer);
    widgetTimer = setTimeout(writeWidgetData, 2000);
    if (!backupHandle) return;
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => writeBackupFile().catch(() => {}), 1500);
  }

  /* ---------------- clicks ---------------- */

  async function onClick(event) {
    const target = event.target;
    const tool = target.closest("[data-studio]");
    if (tool) {
      const key = tool.dataset.studio;
      if (key === "collections") openCollections();
      else if (key === "map") openMap();
      else if (key === "collage") openCollage();
      else if (key === "games" && window.LahapGames) window.LahapGames.open(api, sheet, loops);
      else if (key === "ask") openAsk();
      else if (key === "memory") openMemory();
      return;
    }
    const open = target.closest("#dlg-studio [data-open]");
    if (open) {
      dialog().close();
      return; // app.js opens the meal
    }
    const collection = target.closest("[data-studio-collection]");
    if (collection) return openCollection(collection.dataset.studioCollection);
    const drop = target.closest("[data-studio-drop-collection]");
    if (drop) {
      settings().collections = (settings().collections || []).filter((item) => item.id !== drop.dataset.studioDropCollection);
      await api.saveMeta();
      return openCollections();
    }
    const collect = target.closest("[data-studio-collect]");
    if (collect) return openCollect(collect.dataset.studioCollect);
    const back = target.closest("[data-studio-back]");
    if (back) {
      dialog().close();
      api.render();
      return api.openDetail(back.dataset.studioBack);
    }
    const split = target.closest("[data-studio-split]");
    if (split) return openSplit(split.dataset.studioSplit);
    if (target.closest("[data-studio-split-save]")) return saveSplit();
    const collageFrom = target.closest("[data-studio-collage-from]");
    if (collageFrom) return openCollage(collageFrom.dataset.studioCollageFrom);
    const tableStyle = target.closest("[data-table-style]");
    if (tableStyle) return setTable("style", tableStyle.dataset.tableStyle);
    const template = target.closest("[data-collage-template]");
    if (template) {
      collage.template = template.dataset.collageTemplate;
      $$("[data-collage-template]").forEach((chip) => {
        chip.classList.toggle("on", chip === template);
        chip.setAttribute("aria-checked", String(chip === template));
      });
      return drawCollage(0);
    }
    if (target.closest("[data-collage-shuffle]")) {
      collage.seed = Math.floor(Math.random() * 1e6) + 1;
      return drawCollage(0);
    }
    const ink = target.closest("[data-collage-ink]");
    if (ink) {
      collage.ink = ink.dataset.collageInk;
      $$("[data-collage-ink]").forEach((button) => button.classList.toggle("on", button === ink));
      return;
    }
    if (target.closest("[data-collage-undo]")) {
      collage.strokes.pop();
      return drawCollage(0);
    }
    if (target.closest("[data-collage-save]")) return saveCollage();
    if (target.closest("[data-collage-video]")) return recordVideo();
    const example = target.closest("[data-studio-example]");
    if (example) {
      $('[data-studio-ask] input').value = example.dataset.studioExample;
      return answer(example.dataset.studioExample);
    }
    const story = target.closest("[data-studio-story]");
    if (story) return showStory(Number(story.dataset.studioStory));
    if (target.closest("[data-studio-copy-story]")) {
      try {
        await navigator.clipboard.writeText($("#story-out").dataset.text || "");
        api.toast("Story copied");
      } catch (error) {
        api.toast("Copy is blocked here. Select the text instead.");
      }
      return;
    }
    const pinHereButton = target.closest("[data-studio-pin-here]");
    if (pinHereButton) return pinHere(pinHereButton.dataset.studioPinHere);
    const pinTap = target.closest("[data-studio-pin-tap]");
    if (pinTap) {
      if (!mapState) return api.toast("The map needs a connection for tap-to-pin.");
      mapState.pinning = pinTap.dataset.studioPinTap;
      $("#map-hint").textContent = "Now tap the spot on the map.";
      $("#food-map").scrollIntoView({ block: "nearest" });
      return;
    }
    const palette = target.closest("[data-look-palette]");
    if (palette) return setLook("palette", palette.dataset.lookPalette);
    const type = target.closest("[data-look-type]");
    if (type) return setLook("type", type.dataset.lookType);
    const backup = target.closest("[data-studio-backup]");
    if (backup) return backup.dataset.studioBackup === "file" ? chooseBackupFile() : backupNow();
    if (target.closest("[data-studio-names]")) return nameIdeas();
    const name = target.closest("[data-studio-name]");
    if (name) {
      setField("name", name.dataset.studioName);
      logStatus(`Using “${name.dataset.studioName}”.`);
      return;
    }
    const billItem = target.closest("[data-studio-bill-item]");
    if (billItem) {
      setField("price", billItem.dataset.studioBillItem);
      const nameInput = logContext && logContext.form.querySelector('[name="name"]');
      if (nameInput && !nameInput.value.trim()) setField("name", billItem.dataset.studioBillName);
      logStatus(`Price set to ${api.money(Number(billItem.dataset.studioBillItem))}.`);
    }
  }

  async function onSubmit(event) {
    const form = event.target;
    if (form.matches("[data-studio-new-collection]")) {
      event.preventDefault();
      const collection = await newCollection(form.elements.name.value);
      if (!collection) return;
      if (form.dataset.entry) {
        settings().collections = S.toggleInCollection(settings().collections, collection.id, form.dataset.entry);
        await api.saveMeta();
        return openCollect(form.dataset.entry);
      }
      return openCollections();
    }
    if (form.matches("[data-studio-ask]")) {
      event.preventDefault();
      answer(form.elements.q.value);
    }
  }

  async function onChange(event) {
    const target = event.target;
    if (target.matches("[data-studio-toggle]")) {
      settings().collections = S.toggleInCollection(settings().collections, target.dataset.studioToggle, target.dataset.entry);
      await api.saveMeta();
      return;
    }
    if (target.matches("[data-studio-bill]") && target.files && target.files[0]) {
      scanBill(target.files[0]);
      target.value = "";
      return;
    }
    if (target.id === "table-source") return setTable("source", target.value);
    if (target.id === "set-lang") {
      settings().lang = target.value;
      await api.saveMeta();
      if (window.LahapI18n) window.LahapI18n.set(target.value);
      api.render();
    }
  }

  function init(appApi) {
    api = appApi;
    applyLook();
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    document.addEventListener("change", onChange);
    dialog().addEventListener("close", stopLoops);
    writeWidgetData();
  }

  window.LahapStudio = { init, insightsHtml, profileHtml, detailHtml, logToolsHtml, bindLog, afterCutout, afterChange, applyLook, memoryLane, openAsk, openMap, openCollage, openCollections };
})();
