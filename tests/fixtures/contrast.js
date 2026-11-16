() => {
  // WCAG 2.x contrast of every visible text node against its composited background.
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
  // url() layers are dropped before reading colour stops: the inline SVG paper grain is a
  // texture, not a colour, and any other url() is a photo (handled below)
  const stripUrls = (image) => image.replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, '');
  const stops = (image) => (stripUrls(image).match(/rgba?\([^)]+\)|color\(srgb [^)]+\)|#[0-9a-f]{3,8}\b/gi) || []).map(parse);
  const photoUrl = (image) => (image.match(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g) || []).some((u) => !/data:image\/svg\+xml/.test(u));
  // text drawn on top of a picture: an <img>, <canvas> or <video> sits under its centre
  const overPicture = (el, box) => {
    const x = Math.min(innerWidth - 1, Math.max(0, box.left + box.width / 2));
    const y = Math.min(innerHeight - 1, Math.max(0, box.top + box.height / 2));
    return document.elementsFromPoint(x, y).some((under) => ['IMG', 'CANVAS', 'VIDEO'].includes(under.tagName) && !el.contains(under));
  };
  // every background the text could sit on: gradients contribute each colour stop
  const backgrounds = (el) => {
    const chain = [];
    for (let node = el; node; node = node.parentElement) chain.unshift(node);
    let bases = [[255, 255, 255, 1]];
    let photo = false;
    for (const node of chain) {
      const style = getComputedStyle(node);
      const colour = parse(style.backgroundColor);
      if (colour[3] > 0) bases = bases.map((base) => over(colour, base));
      const image = style.backgroundImage;
      if (image && image !== 'none') {
        if (photoUrl(image)) photo = true;
        const layers = stops(image);
        if (layers.length) bases = bases.flatMap((base) => layers.map((layer) => over(layer, base)));
        if (bases.length > 24) bases = bases.slice(0, 24);
      }
    }
    return { bases, photo };
  };
  const scope = document.querySelector('dialog[open]') || document.querySelector('.view:not([hidden])') || document.body;
  const roots = [scope];
  if (!document.querySelector('dialog[open]')) roots.push(...document.querySelectorAll('.topbar, .bottombar, header, nav'));
  const seen = new Set();
  const failures = [];
  let measured = 0;
  let skipped = 0;
  for (const root of roots) {
    for (const el of root.querySelectorAll('*')) {
      if (seen.has(el)) continue;
      seen.add(el);
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
      if (!own) continue;
      if (['OPTION', 'SCRIPT', 'STYLE', 'TITLE'].includes(el.tagName)) continue;
      if (el.closest('[aria-hidden="true"], [disabled], [aria-disabled="true"], .leaflet-container, svg')) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const style = getComputedStyle(el);
      let opacity = 1;
      for (let node = el; node; node = node.parentElement) opacity *= parseFloat(getComputedStyle(node).opacity);
      const info = backgrounds(el);
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      if (info.photo || overPicture(el, el.getBoundingClientRect())) { skipped += 1; continue; }
      const ink = parse(style.color);
      ink[3] *= opacity;
      const size = parseFloat(style.fontSize);
      const bold = parseInt(style.fontWeight, 10) >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      const worst = Math.min(...info.bases.map((base) => ratio(over(ink, base), base)));
      measured += 1;
      if (worst + 0.005 < need) {
        failures.push({
          text: own.slice(0, 28), cls: (el.tagName.toLowerCase() + '.' + String(el.className || '').trim().split(/\s+/).join('.')).slice(0, 60),
          parent: String((el.parentElement || {}).className || '').slice(0, 40),
          ratio: Math.round(worst * 100) / 100, need, size, ink: style.color, bg: info.bases.map((b) => b.slice(0, 3).map(Math.round).join(',')).slice(0, 2).join(' | '),
        });
      }
    }
  }
  return { measured, skipped, failures };
}
