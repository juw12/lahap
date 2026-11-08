/* Lahap vision: background removal and a colour-based plate guess, all on this device.
   The cutout model is U^2-Net-p (Apache-2.0, 4.6 MB), run with onnxruntime-web (MIT).
   Both load only when a photo is picked, then the service worker keeps them for offline use. */
(function (root) {
  "use strict";

  const script = typeof document !== "undefined" ? document.currentScript : null;
  const BASE = script && script.src ? new URL(".", script.src).href : "";
  const SIZE = 320;
  const MAX_OUT = 640;
  let sessionPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = src;
      tag.onload = resolve;
      tag.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(tag);
    });
  }

  // Sizes of the vendored files, so the first download can show "x of y MB" even when the server compresses them.
  const FILES = {
    model: { path: "vendor/u2netp.onnx", bytes: 4574861 },
    simd: { path: "vendor/ort/ort-wasm-simd.wasm", bytes: 10551547 },
    plain: { path: "vendor/ort/ort-wasm.wasm", bytes: 9726745 },
  };
  // Smallest wasm module that uses a SIMD instruction (same probe as wasm-feature-detect).
  const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
  let progressListener = null;

  function hasSimd() {
    try {
      return WebAssembly.validate(SIMD_PROBE);
    } catch (error) {
      return false;
    }
  }

  // Fetch a file and report bytes as they arrive. Falls back to one chunk when streams are not available.
  async function download(url, onBytes) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("HTTP " + response.status + " for " + url);
    if (!response.body || !response.body.getReader) {
      const whole = new Uint8Array(await response.arrayBuffer());
      onBytes(whole.length);
      return whole;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onBytes(received);
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }

  function session() {
    if (!sessionPromise) {
      sessionPromise = (async () => {
        if (!root.ort) await loadScript(BASE + "vendor/ort/ort.wasm.min.js");
        const wasm = hasSimd() ? FILES.simd : FILES.plain;
        const total = wasm.bytes + FILES.model.bytes;
        const loaded = { wasm: 0, model: 0 };
        let lastShown = -1;
        const report = () => {
          const done = Math.min(total, loaded.wasm + loaded.model);
          const tenths = Math.floor((done / 1e6) * 10);
          if (tenths === lastShown || !progressListener) return;
          lastShown = tenths;
          progressListener(done, total);
        };
        report();
        const [wasmBytes, modelBytes] = await Promise.all([
          download(BASE + wasm.path, (count) => {
            loaded.wasm = count;
            report();
          }),
          download(BASE + FILES.model.path, (count) => {
            loaded.model = count;
            report();
          }),
        ]);
        const wasmName = wasm === FILES.simd ? "ort-wasm-simd.wasm" : "ort-wasm.wasm";
        const wasmUrl = URL.createObjectURL(new Blob([wasmBytes], { type: "application/wasm" }));
        root.ort.env.wasm.wasmPaths = { [wasmName]: wasmUrl };
        root.ort.env.wasm.numThreads = 1;
        root.ort.env.wasm.proxy = false;
        return root.ort.InferenceSession.create(modelBytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      })().catch((error) => {
        sessionPromise = null;
        throw error;
      });
    }
    return sessionPromise;
  }

  function megabytes(bytes) {
    return (bytes / 1e6).toFixed(1);
  }

  function canvasOf(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not read the photo"));
      image.src = src;
    });
  }

  // U^2-Net-p saliency: 320x320, scale by max, ImageNet mean/std, NCHW float32. Returns Float32Array 320*320 in 0..1.
  async function saliency(image) {
    const net = await session();
    const ort = root.ort;
    const canvas = canvasOf(SIZE, SIZE);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, SIZE, SIZE);
    const pixels = ctx.getImageData(0, 0, SIZE, SIZE).data;
    let peak = 1;
    for (let i = 0; i < pixels.length; i += 4) peak = Math.max(peak, pixels[i], pixels[i + 1], pixels[i + 2]);
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];
    const plane = SIZE * SIZE;
    const input = new Float32Array(plane * 3);
    for (let p = 0; p < plane; p++) {
      for (let c = 0; c < 3; c++) input[c * plane + p] = (pixels[p * 4 + c] / peak - mean[c]) / std[c];
    }
    const feeds = {};
    feeds[net.inputNames[0]] = new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]);
    const results = await net.run(feeds);
    const raw = results[net.outputNames[0]].data;
    let low = Infinity;
    let high = -Infinity;
    for (let i = 0; i < plane; i++) {
      if (raw[i] < low) low = raw[i];
      if (raw[i] > high) high = raw[i];
    }
    const out = new Float32Array(plane);
    const span = high - low || 1;
    for (let i = 0; i < plane; i++) out[i] = (raw[i] - low) / span;
    return out;
  }

  // Fallback when the model cannot run: a soft oval in the middle, where food usually sits.
  function ovalMask() {
    const out = new Float32Array(SIZE * SIZE);
    const c = SIZE / 2;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const d = Math.hypot((x - c) / (SIZE * 0.42), (y - c) / (SIZE * 0.42));
        out[y * SIZE + x] = Math.max(0, Math.min(1, (1 - d) / 0.12));
      }
    }
    return out;
  }

  function hsv(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, max ? d / max : 0, max / 255];
  }

  // Plates and bowls are smooth, bright and colourless. Flood in from the cutout edge through
  // such pixels and drop them, so only the food stays. Rice is white too, but grainy, so it stops the fill.
  function trimPlate(mask, pixels) {
    const n = SIZE * SIZE;
    const luma = new Float32Array(n);
    const plateLike = new Uint8Array(n);
    for (let p = 0; p < n; p++) luma[p] = (0.299 * pixels[p * 4] + 0.587 * pixels[p * 4 + 1] + 0.114 * pixels[p * 4 + 2]) / 255;
    for (let y = 1; y < SIZE - 1; y++) {
      for (let x = 1; x < SIZE - 1; x++) {
        const p = y * SIZE + x;
        let grad = 0;
        for (const q of [p - 1, p + 1, p - SIZE, p + SIZE, p - SIZE - 1, p - SIZE + 1, p + SIZE - 1, p + SIZE + 1]) grad += Math.abs(luma[p] - luma[q]);
        grad /= 8;
        const [, s, v] = hsv(pixels[p * 4], pixels[p * 4 + 1], pixels[p * 4 + 2]);
        plateLike[p] = (s < 0.3 && v > 0.62 && grad < 0.05) || (s < 0.2 && v > 0.45 && grad < 0.045) || (s < 0.12 && v > 0.32 && grad < 0.03) ? 1 : 0;
      }
    }
    const fg = (p) => mask[p] > 0.5;
    // steps from the cutout edge, up to 6: the soft rim pixels blend with the table, so seed from a band
    const depth = new Uint8Array(n).fill(255);
    let ring = [];
    for (let y = 1; y < SIZE - 1; y++) {
      for (let x = 1; x < SIZE - 1; x++) {
        const p = y * SIZE + x;
        if (fg(p) && (!fg(p - 1) || !fg(p + 1) || !fg(p - SIZE) || !fg(p + SIZE))) {
          depth[p] = 0;
          ring.push(p);
        }
      }
    }
    for (let d = 1; d <= 6; d++) {
      const next = [];
      for (const p of ring) {
        for (const q of [p - 1, p + 1, p - SIZE, p + SIZE]) {
          if (q < 0 || q >= n || !fg(q) || depth[q] !== 255) continue;
          depth[q] = d;
          next.push(q);
        }
      }
      ring = next;
    }
    const plate = new Uint8Array(n);
    const queue = [];
    for (let p = 0; p < n; p++) {
      if (depth[p] <= 6 && plateLike[p]) {
        plate[p] = 1;
        queue.push(p);
      }
    }
    while (queue.length) {
      const p = queue.pop();
      for (const q of [p - 1, p + 1, p - SIZE, p + SIZE]) {
        if (q < 0 || q >= n || plate[q] || !fg(q) || !plateLike[q]) continue;
        plate[q] = 1;
        queue.push(q);
      }
    }
    let fgCount = 0;
    let plateCount = 0;
    let edgeCount = 0;
    let edgePlate = 0;
    for (let p = 0; p < n; p++) {
      if (fg(p)) fgCount++;
      if (plate[p]) plateCount++;
      if (depth[p] <= 1) {
        edgeCount++;
        if (plateLike[p]) edgePlate++;
      }
    }
    // only trust the trim when plate is a big share of the cutout (a real rim, not a white cracker
    // at the edge) and a real amount of food is left
    const info = { edge: edgeCount ? Math.round((edgePlate / edgeCount) * 100) : 0, plate: fgCount ? Math.round((plateCount / fgCount) * 100) : 0 };
    if (!fgCount || plateCount < fgCount * 0.18 || fgCount - plateCount < fgCount * 0.2) return { mask, trimmed: false, info };
    const out = new Float32Array(mask);
    for (let p = 0; p < n; p++) {
      if (plate[p] || depth[p] <= 2) out[p] = 0;
    }
    // close pinholes: food pixels fully surrounded by food stay, isolated specks go
    const cleaned = new Float32Array(out);
    for (let y = 1; y < SIZE - 1; y++) {
      for (let x = 1; x < SIZE - 1; x++) {
        const p = y * SIZE + x;
        let around = 0;
        for (const q of [p - 1, p + 1, p - SIZE, p + SIZE, p - SIZE - 1, p - SIZE + 1, p + SIZE - 1, p + SIZE + 1]) around += out[q] > 0.5 ? 1 : 0;
        if (out[p] > 0.5 && around <= 2) cleaned[p] = 0;
        if (out[p] <= 0.5 && around >= 7 && mask[p] > 0.5) cleaned[p] = mask[p];
      }
    }
    return { mask: cleaned, trimmed: true, info };
  }

  // Keep the biggest blob (the dish) and anything at least a fifth of its size (side dishes).
  function keepMainBlobs(mask) {
    const n = SIZE * SIZE;
    const label = new Int32Array(n);
    const sizes = [0];
    for (let p = 0; p < n; p++) {
      if (label[p] || mask[p] <= 0.5) continue;
      const id = sizes.length;
      let count = 0;
      const stack = [p];
      label[p] = id;
      while (stack.length) {
        const q = stack.pop();
        count++;
        const x = q % SIZE;
        for (const r of [x > 0 ? q - 1 : -1, x < SIZE - 1 ? q + 1 : -1, q - SIZE, q + SIZE]) {
          if (r < 0 || r >= n || label[r] || mask[r] <= 0.5) continue;
          label[r] = id;
          stack.push(r);
        }
      }
      sizes.push(count);
    }
    const biggest = Math.max(0, ...sizes);
    const mainId = sizes.indexOf(biggest);
    // second moments per blob: a long thin shape is cutlery or a straw, not food
    const moments = sizes.map(() => [0, 0, 0, 0, 0]);
    for (let p = 0; p < n; p++) {
      if (!label[p]) continue;
      const m = moments[label[p]];
      const x = p % SIZE;
      const y = (p / SIZE) | 0;
      m[0] += x;
      m[1] += y;
      m[2] += x * x;
      m[3] += y * y;
      m[4] += x * y;
    }
    const thin = sizes.map((count, id) => {
      if (!count || id === mainId) return false;
      const [sx, sy, sxx, syy, sxy] = moments[id];
      const mx = sx / count;
      const my = sy / count;
      const a = sxx / count - mx * mx;
      const b = syy / count - my * my;
      const c = sxy / count - mx * my;
      const half = Math.sqrt(((a - b) / 2) ** 2 + c * c);
      const major = (a + b) / 2 + half;
      const minor = Math.max(0.5, (a + b) / 2 - half);
      return Math.sqrt(major / minor) > 3.2;
    });
    const out = new Float32Array(mask);
    for (let p = 0; p < n; p++) {
      if (label[p] && (sizes[label[p]] < biggest * 0.2 || thin[label[p]])) out[p] = 0;
    }
    return out;
  }

  // soft edge pixels stay only next to solid food, so no faint ghosts of the plate or table remain
  function dropGhosts(mask) {
    const out = new Float32Array(mask);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const p = y * SIZE + x;
        if (mask[p] > 0.5 || mask[p] === 0) continue;
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy >= 0 && yy < SIZE && xx >= 0 && xx < SIZE && mask[yy * SIZE + xx] > 0.5) {
              near = true;
              break;
            }
          }
        }
        if (!near) out[p] = 0;
      }
    }
    return out;
  }

  function maskStats(mask) {
    let count = 0;
    let minX = SIZE;
    let minY = SIZE;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (mask[y * SIZE + x] <= 0.5) continue;
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return { share: count / (SIZE * SIZE), box: count ? { minX, minY, maxX, maxY } : null };
  }

  // Colour guess at the plate: green reads as veg, browns and reds as protein, pale and yellow as rice/noodles.
  function guessPlate(mask, pixels) {
    const counts = { veg: 0, protein: 0, carbs: 0, other: 0 };
    let total = 0;
    for (let p = 0; p < SIZE * SIZE; p++) {
      if (mask[p] <= 0.5) continue;
      total++;
      const [h, s, v] = hsv(pixels[p * 4], pixels[p * 4 + 1], pixels[p * 4 + 2]);
      if (v < 0.12) counts.other++;
      else if (h >= 65 && h <= 170 && s > 0.22 && v > 0.18) counts.veg++;
      else if ((h < 18 || h > 340) && s > 0.55 && v > 0.7) counts.veg++;
      else if (s < 0.22 && v > 0.6) counts.carbs++;
      else if (h >= 38 && h < 65 && s > 0.25 && v > 0.55) counts.carbs++;
      else if ((h < 38 || h > 330) && s > 0.28) counts.protein++;
      else counts.other++;
    }
    if (!total) return null;
    const share = {
      veg: counts.veg / total,
      protein: counts.protein / total,
      carbs: counts.carbs / total,
    };
    const level = (value, some, lots) => (value >= lots ? 2 : value >= some ? 1 : 0);
    return {
      veg: level(share.veg, 0.06, 0.3),
      protein: level(share.protein, 0.12, 0.42),
      carbs: level(share.carbs, 0.12, 0.45),
      share: { veg: Math.round(share.veg * 100), protein: Math.round(share.protein * 100), carbs: Math.round(share.carbs * 100) },
    };
  }

  function encode(canvas) {
    const webp = canvas.toDataURL("image/webp", 0.86);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
  }

  /* Cut the food out of a photo (data URL or blob URL).
     Returns { cutout, method: "model" | "oval", trimmed, plate, ms } where cutout is a transparent image data URL. */
  async function cutout(src, options) {
    const opts = Object.assign({ trimPlate: true, onStatus: null }, options || {});
    const started = performance.now();
    const image = await loadImage(src);
    const small = canvasOf(SIZE, SIZE);
    const smallCtx = small.getContext("2d", { willReadFrequently: true });
    smallCtx.drawImage(image, 0, 0, SIZE, SIZE);
    const pixels = smallCtx.getImageData(0, 0, SIZE, SIZE).data;

    let mask;
    let method = "model";
    try {
      progressListener = opts.onStatus
        ? (done, total) => opts.onStatus(`Getting the cutout model ready (first time only): ${megabytes(done)} of ${megabytes(total)} MB`)
        : null;
      await session();
      progressListener = null;
      if (opts.onStatus) opts.onStatus("Removing the background…");
      mask = await saliency(image);
    } catch (error) {
      mask = ovalMask();
      method = "oval";
    }
    let trimmed = false;
    let trimInfo = null;
    if (method === "model") {
      mask = keepMainBlobs(mask);
      const stats = maskStats(mask);
      // nothing salient, or the whole frame: the model did not find a dish, fall back to the oval
      if (stats.share < 0.03 || stats.share > 0.96) {
        mask = ovalMask();
        method = "oval";
      } else if (opts.trimPlate) {
        const result = trimPlate(mask, pixels);
        mask = keepMainBlobs(result.mask);
        trimmed = result.trimmed;
        trimInfo = result.info;
      }
    }
    mask = dropGhosts(mask);
    const stats = maskStats(mask);
    const plate = guessPlate(mask, pixels);

    // paint the mask as alpha at full photo size, then crop to the food with a small margin
    const maskCanvas = canvasOf(SIZE, SIZE);
    const maskCtx = maskCanvas.getContext("2d");
    const maskData = maskCtx.createImageData(SIZE, SIZE);
    for (let p = 0; p < SIZE * SIZE; p++) {
      const alpha = Math.max(0, Math.min(1, (mask[p] - 0.15) / 0.7));
      maskData.data[p * 4 + 3] = Math.round(alpha * 255);
    }
    maskCtx.putImageData(maskData, 0, 0);
    const box = stats.box || { minX: 0, minY: 0, maxX: SIZE - 1, maxY: SIZE - 1 };
    const sx = image.width / SIZE;
    const sy = image.height / SIZE;
    const pad = 0.04 * SIZE;
    const crop = {
      x: Math.max(0, (box.minX - pad) * sx),
      y: Math.max(0, (box.minY - pad) * sy),
      x2: Math.min(image.width, (box.maxX + 1 + pad) * sx),
      y2: Math.min(image.height, (box.maxY + 1 + pad) * sy),
    };
    crop.w = crop.x2 - crop.x;
    crop.h = crop.y2 - crop.y;
    const scale = Math.min(1, MAX_OUT / Math.max(crop.w, crop.h));
    const out = canvasOf(Math.max(1, Math.round(crop.w * scale)), Math.max(1, Math.round(crop.h * scale)));
    const ctx = out.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(maskCanvas, crop.x / sx, crop.y / sy, crop.w / sx, crop.h / sy, 0, 0, out.width, out.height);
    ctx.globalCompositeOperation = "source-over";
    return { cutout: encode(out), method, trimmed, trimInfo, plate, share: Math.round(stats.share * 100), ms: Math.round(performance.now() - started) };
  }

  root.LahapVision = { cutout, session, guessPlate, SIZE };
})(typeof window !== "undefined" ? window : globalThis);
