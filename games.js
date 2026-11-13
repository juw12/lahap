/* Lahap games: ten small toys played with your own food cut-outs, on one tiny circle-physics engine.
   Free: Tumble, Float, Water, Magnet. Also free here: Claw, Launch, Catch, Tap, Burst, Slice. */
(function () {
  "use strict";

  const GAMES = [
    ["tumble", "Tumble", "Tap to drop your plates into a pile"],
    ["float", "Float", "No gravity. Fling them about"],
    ["water", "Water", "They bob on the surface"],
    ["magnet", "Magnet", "Hold to pull them to your finger"],
    ["claw", "Claw", "Tap to drop the claw, win a plate"],
    ["launch", "Launch", "Drag back and let go at the stack"],
    ["catch", "Catch", "Move the tray, catch what falls"],
    ["tap", "Tap", "Tap each plate before it hides"],
    ["burst", "Burst", "Pop the plates as they rise"],
    ["slice", "Slice", "Swipe through the tossed plates"],
  ];

  let api = null;
  let sheet = null;
  let loops = null;

  function images() {
    const list = api.state.entries.filter((entry) => entry && entry.name);
    const withCuts = list.filter((entry) => entry.cutout);
    const chosen = (withCuts.length >= 3 ? withCuts : list).slice(-12);
    return Promise.all(chosen.map((entry) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = api.imageFor(entry);
    }))).then((loaded) => loaded.filter(Boolean));
  }

  function open(appApi, sheetFn, loopSet) {
    api = appApi;
    sheet = sheetFn;
    loops = loopSet;
    sheet("Games", `
      <p class="muted">Little toys made from your own plates. No scores are kept, nothing leaves this phone.</p>
      <div class="studio-grid games-grid">${GAMES.map(([key, name, how]) => `<button type="button" class="studio-tile" data-game="${key}"><span class="studio-name">${name}</span><span class="studio-why">${how}</span></button>`).join("")}</div>`);
  }

  async function play(key) {
    const game = GAMES.find((item) => item[0] === key);
    if (!game) return;
    const pics = await images();
    sheet(game[1], `
      <div class="game-wrap"><canvas id="game-canvas" width="720" height="960" aria-label="${game[1]} game" tabindex="0"></canvas></div>
      <p class="muted small" id="game-status">${game[2]}.</p>`,
      `<button type="button" class="btn" data-studio="games">All games</button><button type="button" class="btn primary" data-game="${key}">Restart</button>`);
    start(key, document.getElementById("game-canvas"), pics);
  }

  /* ---------------- engine ---------------- */

  function start(mode, canvas, pics) {
    const context = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const status = document.getElementById("game-status");
    const style = getComputedStyle(document.documentElement);
    const ink = style.getPropertyValue("--ink").trim() || "#1d1813";
    const accent = style.getPropertyValue("--accent").trim() || "#b4380f";
    const paper = style.getPropertyValue("--paper").trim() || "#f5efe3";
    const bodies = [];
    const sparks = [];
    const pointer = { x: W / 2, y: H / 2, down: false, trail: [], startX: 0, startY: 0 };
    const game = { score: 0, misses: 0, time: 0, claw: { x: W / 2, y: 60, state: "idle", grab: null }, tray: W / 2, spawn: 0, sling: null };
    let picIndex = 0;
    let running = true;
    let last = performance.now();

    function nextPic() {
      const pic = pics.length ? pics[picIndex % pics.length] : null;
      picIndex += 1;
      return pic;
    }

    function add(x, y, r, extra) {
      const body = Object.assign({ x, y, vx: 0, vy: 0, r, a: 0, va: 0, pic: nextPic(), alive: true, life: Infinity }, extra);
      bodies.push(body);
      return body;
    }

    function burst(x, y) {
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2;
        sparks.push({ x, y, vx: Math.cos(angle) * (3 + Math.random() * 4), vy: Math.sin(angle) * (3 + Math.random() * 4), life: 30 });
      }
    }

    function say(text) {
      status.textContent = text;
    }

    // set up each mode
    const n = Math.max(3, Math.min(10, pics.length || 6));
    if (mode === "float" || mode === "magnet") {
      for (let i = 0; i < n; i++) add(80 + Math.random() * (W - 160), 80 + Math.random() * (H - 160), 60 + Math.random() * 25, { vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, va: (Math.random() - 0.5) * 0.05 });
    } else if (mode === "water") {
      for (let i = 0; i < n; i++) add(80 + Math.random() * (W - 160), 60 + Math.random() * 300, 55 + Math.random() * 20);
    } else if (mode === "claw") {
      for (let i = 0; i < n + 3; i++) add(140 + Math.random() * (W - 180), H - 80 - Math.random() * 200, 58);
    } else if (mode === "launch") {
      for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) add(W - 200 + col * 110, H - 60 - row * 110, 52, { target: true });
      game.sling = add(150, H - 260, 50, { held: true });
    } else if (mode === "tumble") {
      for (let i = 0; i < 4; i++) add(150 + i * 140, 100 + i * 60, 60);
    }

    // input
    const toCanvas = (event) => {
      const rect = canvas.getBoundingClientRect();
      return [((event.clientX - rect.left) / rect.width) * W, ((event.clientY - rect.top) / rect.height) * H];
    };
    const hit = (x, y) => bodies.slice().reverse().find((body) => body.alive && (body.x - x) ** 2 + (body.y - y) ** 2 < body.r ** 2);
    canvas.addEventListener("pointerdown", (event) => {
      canvas.setPointerCapture(event.pointerId);
      [pointer.x, pointer.y] = toCanvas(event);
      pointer.down = true;
      pointer.startX = pointer.x;
      pointer.startY = pointer.y;
      pointer.trail = [[pointer.x, pointer.y, game.time]];
      if (mode === "tumble") add(pointer.x, 40, 50 + Math.random() * 25, { va: (Math.random() - 0.5) * 0.1 });
      if (mode === "claw" && game.claw.state === "idle") game.claw.state = "down";
      if (mode === "tap" || mode === "burst") {
        const body = hit(pointer.x, pointer.y);
        if (body) {
          body.alive = false;
          burst(body.x, body.y);
          game.score += 1;
          say(`${game.score} ${mode === "tap" ? "tapped" : "popped"}${mode === "tap" ? `, ${game.misses} got away` : ""}.`);
        }
      }
      if (mode === "float") pointer.grab = hit(pointer.x, pointer.y) || null;
    });
    canvas.addEventListener("pointermove", (event) => {
      const [x, y] = toCanvas(event);
      if (pointer.grab) {
        pointer.grab.vx = (x - pointer.x) * 0.9;
        pointer.grab.vy = (y - pointer.y) * 0.9;
      }
      pointer.x = x;
      pointer.y = y;
      if (pointer.down) pointer.trail.push([x, y, game.time]);
      if (pointer.trail.length > 14) pointer.trail.shift();
      if (mode === "slice" && pointer.down) {
        for (const body of bodies) {
          if (body.alive && (body.x - x) ** 2 + (body.y - y) ** 2 < body.r ** 2) {
            body.alive = false;
            burst(body.x, body.y);
            game.score += 1;
            say(`${game.score} sliced, ${game.misses} dropped.`);
          }
        }
      }
    });
    const release = () => {
      if (mode === "launch" && game.sling && game.sling.held && pointer.down) {
        game.sling.held = false;
        game.sling.vx = (pointer.startX - pointer.x) * 0.25 + 6;
        game.sling.vy = (pointer.startY - pointer.y) * 0.25 - 4;
        game.sling.flying = true;
      }
      pointer.down = false;
      pointer.grab = null;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("keydown", (event) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        canvas.dispatchEvent(new PointerEvent("pointerdown", { clientX: canvas.getBoundingClientRect().left + canvas.clientWidth / 2, clientY: canvas.getBoundingClientRect().top + 40, pointerId: 1 }));
        canvas.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
      }
    });

    function physics(dt) {
      const gravity = { tumble: 0.6, water: 0.5, claw: 0.6, launch: 0.5, catch: 0.25, slice: 0.35 }[mode] || 0;
      const waterLine = H * 0.55;
      for (const body of bodies) {
        if (!body.alive || body.held || body.grabbed) continue;
        body.vy += gravity * dt;
        if (mode === "water" && body.y > waterLine) {
          body.vy -= 1.1 * dt * Math.min(1, (body.y - waterLine) / body.r);
          body.vx *= 0.97;
          body.vy *= 0.96;
        }
        if (mode === "magnet" && pointer.down) {
          const dx = pointer.x - body.x;
          const dy = pointer.y - body.y;
          const dist = Math.max(40, Math.hypot(dx, dy));
          body.vx += (dx / dist) * 1.4 * dt;
          body.vy += (dy / dist) * 1.4 * dt;
        }
        if (mode === "float" || mode === "magnet") {
          body.vx *= 0.995;
          body.vy *= 0.995;
        } else if (mode === "burst") {
          body.vy = -1.6 - body.speed;
          body.vx = Math.sin(game.time / 30 + body.r) * 1.2;
        }
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        body.a += body.va * dt;
        const floor = mode === "catch" || mode === "slice" || mode === "burst" || mode === "tap" ? Infinity : H;
        if (body.y + body.r > floor) {
          body.y = floor - body.r;
          body.vy *= -0.35;
          body.vx *= 0.9;
          body.va = body.vx / body.r;
        }
        if (mode !== "launch" || !body.flying) {
          if (body.x - body.r < 0) {
            body.x = body.r;
            body.vx *= -0.6;
          }
          if (body.x + body.r > W) {
            body.x = W - body.r;
            body.vx *= -0.6;
          }
        }
        if ((mode === "float" || mode === "magnet") && (body.y - body.r < 0 || body.y + body.r > H)) {
          body.y = Math.max(body.r, Math.min(H - body.r, body.y));
          body.vy *= -0.6;
        }
      }
      // circle collisions
      if (mode !== "slice" && mode !== "burst" && mode !== "tap") {
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i];
            const b = bodies[j];
            if (!a.alive || !b.alive || a.held || b.held || a.grabbed || b.grabbed) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy) || 0.01;
            const overlap = a.r + b.r - dist;
            if (overlap <= 0) continue;
            const nx = dx / dist;
            const ny = dy / dist;
            a.x -= nx * overlap / 2;
            a.y -= ny * overlap / 2;
            b.x += nx * overlap / 2;
            b.y += ny * overlap / 2;
            const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (relative < 0) {
              const impulse = -relative * 0.8;
              a.vx -= nx * impulse / 2;
              a.vy -= ny * impulse / 2;
              b.vx += nx * impulse / 2;
              b.vy += ny * impulse / 2;
              a.va -= impulse * 0.004;
              b.va += impulse * 0.004;
            }
          }
        }
      }
    }

    function rules(dt) {
      game.time += dt;
      if (mode === "tumble" && bodies.length > 30) bodies.shift();
      if (mode === "claw") {
        const claw = game.claw;
        if (claw.state === "idle") claw.x += (pointer.x - claw.x) * 0.15 * dt;
        if (claw.state === "down") {
          claw.y += 9 * dt;
          const target = bodies.find((body) => body.alive && Math.abs(body.x - claw.x) < body.r * 0.7 && Math.abs(body.y - claw.y) < body.r);
          if (target || claw.y > H - 60) {
            claw.grab = target && Math.random() < 0.8 ? target : null;
            if (claw.grab) claw.grab.grabbed = true;
            claw.state = "up";
          }
        } else if (claw.state === "up") {
          claw.y -= 8 * dt;
          if (claw.y <= 60) {
            claw.y = 60;
            claw.state = claw.grab ? "carry" : "idle";
            if (!claw.grab) say("Slipped! Try again.");
          }
        } else if (claw.state === "carry") {
          claw.x -= 10 * dt;
          if (claw.x < 70) {
            claw.grab.alive = false;
            claw.grab = null;
            claw.state = "idle";
            game.score += 1;
            say(`${game.score} won. Tap to drop the claw again.`);
          }
        }
        if (claw.grab) {
          claw.grab.x = claw.x;
          claw.grab.y = claw.y + claw.grab.r + 20;
        }
      }
      if (mode === "launch") {
        const sling = game.sling;
        if (sling.held && pointer.down) {
          const dx = Math.max(-140, Math.min(0, pointer.x - pointer.startX));
          const dy = Math.max(-40, Math.min(140, pointer.y - pointer.startY));
          sling.x = 150 + dx;
          sling.y = H - 260 + dy;
        }
        if (sling.flying && (sling.x > W + 100 || sling.y > H + 200 || (Math.abs(sling.vx) < 0.2 && sling.y + sling.r >= H - 1))) {
          const down = bodies.filter((body) => body.target && (body.y < H - 400 || Math.abs(body.vx) > 0.5 || body.x > W - 40 || body.x < W - 320)).length;
          game.score = Math.max(game.score, down);
          say(`${down} of 6 knocked. Drag back again.`);
          sling.flying = false;
          sling.held = true;
          sling.x = 150;
          sling.y = H - 260;
          sling.vx = sling.vy = 0;
          sling.pic = nextPic();
        }
      }
      if (mode === "catch") {
        game.tray += (pointer.x - game.tray) * 0.25 * dt;
        game.spawn -= dt;
        if (game.spawn <= 0) {
          add(60 + Math.random() * (W - 120), -60, 45, { va: (Math.random() - 0.5) * 0.08 });
          game.spawn = Math.max(25, 70 - game.score * 2);
        }
        for (const body of bodies) {
          if (!body.alive) continue;
          if (body.y > H - 110 && body.y < H - 60 && Math.abs(body.x - game.tray) < 110) {
            body.alive = false;
            game.score += 1;
            burst(body.x, body.y);
            say(`${game.score} caught, ${game.misses} dropped.`);
          } else if (body.y > H + 60) {
            body.alive = false;
            game.misses += 1;
            say(`${game.score} caught, ${game.misses} dropped.`);
          }
        }
      }
      if (mode === "tap") {
        game.spawn -= dt;
        if (game.spawn <= 0) {
          add(80 + Math.random() * (W - 160), 120 + Math.random() * (H - 240), 60, { life: Math.max(40, 110 - game.score * 3), born: game.time });
          game.spawn = 45;
        }
        for (const body of bodies) {
          if (body.alive && game.time - body.born > body.life) {
            body.alive = false;
            game.misses += 1;
            say(`${game.score} tapped, ${game.misses} got away.`);
          }
        }
      }
      if (mode === "burst") {
        game.spawn -= dt;
        if (game.spawn <= 0) {
          add(60 + Math.random() * (W - 120), H + 60, 45 + Math.random() * 20, { speed: Math.random() * 1.5 });
          game.spawn = 35;
        }
        for (const body of bodies) if (body.alive && body.y < -80) body.alive = false;
      }
      if (mode === "slice") {
        game.spawn -= dt;
        if (game.spawn <= 0) {
          const count = 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < count; i++) add(120 + Math.random() * (W - 240), H + 50, 55, { vx: (Math.random() - 0.5) * 6, vy: -17 - Math.random() * 4, va: (Math.random() - 0.5) * 0.15 });
          game.spawn = 70;
        }
        for (const body of bodies) {
          if (body.alive && body.vy > 0 && body.y > H + 80) {
            body.alive = false;
            game.misses += 1;
            say(`${game.score} sliced, ${game.misses} dropped.`);
          }
        }
      }
      for (let i = bodies.length - 1; i >= 0; i--) if (!bodies[i].alive && !bodies[i].grabbed) bodies.splice(i, 1);
    }

    function drawBody(body) {
      context.save();
      context.translate(body.x, body.y);
      context.rotate(body.a);
      if (body.pic) {
        const ratio = body.pic.width / body.pic.height;
        const size = body.r * 2.2;
        const w = ratio >= 1 ? size : size * ratio;
        const h = ratio >= 1 ? size / ratio : size;
        context.drawImage(body.pic, -w / 2, -h / 2, w, h);
      } else {
        context.fillStyle = accent;
        context.beginPath();
        context.arc(0, 0, body.r, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }

    function draw() {
      context.fillStyle = paper;
      context.fillRect(0, 0, W, H);
      if (mode === "water") {
        context.fillStyle = "rgba(31, 102, 128, 0.25)";
        const line = H * 0.55;
        context.beginPath();
        context.moveTo(0, H);
        for (let x = 0; x <= W; x += 20) context.lineTo(x, line + Math.sin(x / 50 + game.time / 15) * 8);
        context.lineTo(W, H);
        context.fill();
      }
      if (mode === "claw") {
        context.fillStyle = "rgba(0,0,0,0.08)";
        context.fillRect(0, 0, 120, 200);
        context.strokeStyle = ink;
        context.lineWidth = 6;
        context.beginPath();
        context.moveTo(game.claw.x, 0);
        context.lineTo(game.claw.x, game.claw.y);
        context.moveTo(game.claw.x - 34, game.claw.y + 30);
        context.lineTo(game.claw.x, game.claw.y);
        context.lineTo(game.claw.x + 34, game.claw.y + 30);
        context.stroke();
      }
      if (mode === "catch") {
        context.fillStyle = ink;
        context.fillRect(game.tray - 110, H - 70, 220, 16);
      }
      if (mode === "launch" && game.sling && game.sling.held && pointer.down) {
        context.strokeStyle = accent;
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(150, H - 260);
        context.lineTo(game.sling.x, game.sling.y);
        context.stroke();
      }
      for (const body of bodies) drawBody(body);
      for (const spark of sparks) {
        context.fillStyle = accent;
        context.globalAlpha = spark.life / 30;
        context.fillRect(spark.x - 4, spark.y - 4, 8, 8);
      }
      context.globalAlpha = 1;
      if (mode === "slice" && pointer.down && pointer.trail.length > 1) {
        context.strokeStyle = ink;
        context.lineWidth = 6;
        context.beginPath();
        pointer.trail.forEach(([x, y], i) => (i ? context.lineTo(x, y) : context.moveTo(x, y)));
        context.stroke();
      }
      if (["claw", "catch", "tap", "burst", "slice", "launch"].includes(mode)) {
        context.fillStyle = ink;
        context.font = "700 44px ui-monospace, Consolas, monospace";
        context.textAlign = "right";
        context.fillText(String(game.score), W - 30, 60);
      }
    }

    function frame(now) {
      if (!running) return;
      const dt = Math.min(2, (now - last) / 16.67);
      last = now;
      physics(dt);
      rules(dt);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i];
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.life -= 1;
        if (spark.life <= 0) sparks.splice(i, 1);
      }
      draw();
      handle = requestAnimationFrame(frame);
    }
    let handle = requestAnimationFrame(frame);
    loops.add(() => {
      running = false;
      cancelAnimationFrame(handle);
    });
    if (!pics.length) say("Log a meal with a photo to play with your own plates. Plain discs for now.");
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-game]");
    if (button && api) play(button.dataset.game);
  });

  window.LahapGames = { open, play, GAMES };
})();
