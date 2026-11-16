() => {
  // WCAG 2.x contrast of what a text field shows: the typed value and the placeholder hint,
  // each against the field's composited background.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const parse = (value) => {
    let m = /^rgba?\(([^)]+)\)$/.exec(value);
    if (m) {
      const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    m = /^color\(srgb ([^)]+)\)$/.exec(value);
    if (m) {
      const p = m[1].split(/[\s\/]+/).filter(Boolean).map(parseFloat);
      return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1];
    }
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (top, bottom) => {
    const a = top[3];
    return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const stripUrls = (image) => image.replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, '');
  const stops = (image) => (stripUrls(image).match(/rgba?\([^)]+\)|color\(srgb [^)]+\)|#[0-9a-f]{3,8}\b/gi) || []).map(parse);
  const backgrounds = (el) => {
    const chain = [];
    for (let node = el; node; node = node.parentElement) chain.unshift(node);
    let bases = [[255, 255, 255, 1]];
    for (const node of chain) {
      const style = getComputedStyle(node);
      const colour = parse(style.backgroundColor);
      if (colour[3] > 0) bases = bases.map((base) => over(colour, base));
      const image = style.backgroundImage;
      if (image && image !== 'none') {
        const layers = stops(image);
        if (layers.length) bases = bases.flatMap((base) => layers.map((layer) => over(layer, base)));
        if (bases.length > 24) bases = bases.slice(0, 24);
      }
    }
    return bases;
  };
  const scope = document.querySelector('dialog[open]') || document.querySelector('.view:not([hidden])') || document.body;
  const roots = [scope];
  if (!document.querySelector('dialog[open]')) roots.push(...document.querySelectorAll('.topbar, header'));
  const skipTypes = ['checkbox', 'radio', 'range', 'file', 'color', 'hidden', 'button', 'submit', 'reset', 'image'];
  const seen = new Set();
  const failures = [];
  const fields = [];
  let values = 0;
  let hints = 0;
  for (const root of roots) {
    for (const el of root.querySelectorAll('input, textarea, select')) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (el.tagName === 'INPUT' && skipTypes.includes(el.type)) continue;
      if (el.disabled || el.closest('[aria-hidden="true"], .leaflet-container')) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const box = el.getBoundingClientRect();
      if (box.width < 8 || box.height < 8) continue;
      const style = getComputedStyle(el);
      let opacity = 1;
      for (let node = el; node; node = node.parentElement) opacity *= parseFloat(getComputedStyle(node).opacity);
      const bases = backgrounds(el);
      const size = parseFloat(style.fontSize);
      const bold = parseInt(style.fontWeight, 10) >= 700;
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      const name = el.id || el.name || el.getAttribute('aria-label') || el.tagName.toLowerCase();
      const ink = parse(style.color);
      ink[3] *= opacity;
      const valueRatio = Math.min(...bases.map((base) => ratio(over(ink, base), base)));
      values += 1;
      fields.push(name);
      if (valueRatio + 0.005 < need) failures.push({ field: name, kind: 'value', ratio: Math.round(valueRatio * 100) / 100, need });
      const hint = el.getAttribute('placeholder');
      if (hint && hint.trim() && el.tagName !== 'SELECT') {
        const pseudo = getComputedStyle(el, '::placeholder');
        const hintInk = parse(pseudo.color);
        hintInk[3] *= opacity * parseFloat(pseudo.opacity || '1');
        const hintRatio = Math.min(...bases.map((base) => ratio(over(hintInk, base), base)));
        hints += 1;
        if (hintRatio + 0.005 < need) failures.push({ field: name, kind: 'placeholder', ratio: Math.round(hintRatio * 100) / 100, need, colour: pseudo.color });
      }
    }
  }
  return { values, hints, fields, failures };
}
