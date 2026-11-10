"""End-to-end and logic tests for Lahap. Run with the system Python that has Playwright:

    python tests/test_app.py

Serves the app folder on 127.0.0.1, drives Chromium, prints PASS/FAIL per check, exits 1 on any failure.
"""
import re
import functools
import math
import http.server
import os
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
results = []


def check(name, condition, detail=""):
    results.append((name, bool(condition), detail))
    print(("PASS " if condition else "FAIL ") + name + (f"  [{detail}]" if detail and not condition else ""), flush=True)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def text_file_checks():
    for path in ROOT.rglob("*"):
        if path.suffix not in {".html", ".css", ".js", ".md", ".webmanifest", ".svg", ".py"}:
            continue
        data = path.read_bytes()
        name = str(path.relative_to(ROOT))
        check(f"{name}: no BOM", not data.startswith(b"\xef\xbb\xbf"))
        check(f"{name}: LF only", b"\r\n" not in data)
        text = data.decode("utf-8")
        check(f"{name}: no mojibake", "\u00c3" not in text and "\u00e2\u20ac" not in text)


def main():
    text_file_checks()
    for key in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
        os.environ.pop(key, None)
    os.environ["NO_PROXY"] = "127.0.0.1,localhost"
    server = serve()
    base = f"http://127.0.0.1:{server.server_address[1]}/index.html"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(args=["--proxy-bypass-list=127.0.0.1;localhost", "--no-proxy-server"])
        context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("dialog", lambda dialog: dialog.accept())

        page.goto(base + "?demo=1&nosw=1")
        page.wait_for_selector("html[data-ready='1']")

        # ---- logic ----
        logic = page.evaluate(
            """() => {
              const L = window.LahapLogic;
              const plain = { veg: 0, protein: 0, carbs: 1 };
              const balanced = { veg: 2, protein: 1, carbs: 1 };
              const junk = { veg: 0, protein: 1, carbs: 2, fried: true, sugary: true, processed: true };
              const same = [{ name: "Bakso", cuisine: "Indonesian" }, { name: "bakso ", cuisine: "Indonesian" }];
              const mixed = [
                { name: "A", cuisine: "x" }, { name: "B", cuisine: "y" },
                { name: "C", cuisine: "z" }, { name: "D", cuisine: "w" },
              ];
              const entries = [
                { id: "1", name: "Nasi lemak", place: "Kak Ros", price: 20000, ts: "2026-11-01T12:00:00Z", plate: balanced, rating: 4, tastes: ["Spicy"], friends: ["rina"] },
                { id: "2", name: "Nasi lemak ayam", place: "Kak Ros", price: 30000, ts: "2026-11-05T12:00:00Z", plate: plain, rating: 5, tastes: [] },
                { id: "3", name: "Ramen", place: "Menya", price: 70000, ts: "2026-11-03T12:00:00Z", plate: plain, tastes: ["Umami"] },
              ];
              const found = L.searchEntries(entries, "nasi KAK", {});
              const byFriend = L.searchEntries(entries, "rina", { rina: "Rina" });
              const summary = L.summarize(found);
              return {
                plain: L.healthScore(plain),
                balanced: L.healthScore(balanced),
                junk: L.healthScore(junk),
                varietySame: L.varietyScore(same),
                varietyMixed: L.varietyScore(mixed),
                matchSelf: L.matchScore([1, 0, 0, 0, 1, 0], ["A"], [1, 0, 0, 0, 1, 0], ["A"]),
                matchAB: L.matchScore([1, 0.2, 0, 0, 1, 0], ["A", "B"], [0, 1, 0, 1, 0, 0], ["C"]),
                matchBA: L.matchScore([0, 1, 0, 1, 0, 0], ["C"], [1, 0.2, 0, 0, 1, 0], ["A", "B"]),
                found: found.map((e) => e.id),
                byFriend: byFriend.map((e) => e.id),
                count: summary.count,
                lastId: summary.last.id,
                avgPrice: summary.avgPrice,
                level0: L.levelFor(0).name,
                level85: L.levelFor(85).name,
                spendTotal: L.spendSummary(entries).total,
              };
            }"""
        )
        check("health: plain plate = 55", logic["plain"] == 55, logic["plain"])
        check("health: balanced plate = 95", logic["balanced"] == 95, logic["balanced"])
        check("health: fried + sugary + processed plate = 12", logic["junk"] == 12, logic["junk"])
        check("variety: same dish twice = 0", logic["varietySame"] == 0, logic["varietySame"])
        check("variety: 4 different = 75", logic["varietyMixed"] == 75, logic["varietyMixed"])
        check("match: identical = 100", logic["matchSelf"] == 100, logic["matchSelf"])
        check("match: symmetric", logic["matchAB"] == logic["matchBA"], f"{logic['matchAB']} vs {logic['matchBA']}")
        check("search: all words, any case", sorted(logic["found"]) == ["1", "2"], logic["found"])
        check("search: by friend name", logic["byFriend"] == ["1"], logic["byFriend"])
        check("summary: count/last/avg", logic["count"] == 2 and logic["lastId"] == "2" and logic["avgPrice"] == 25000, logic)
        check("levels", logic["level0"] == "New bud" and logic["level85"] == "Regular", logic)
        check("spend total", logic["spendTotal"] == 120000, logic["spendTotal"])

        # ---- diary + search ----
        tickets = page.locator(".ticket").count()
        sample_count = page.evaluate("() => window.Lahap.state.entries.length")
        check("demo loads sample fortnight", sample_count >= 35, sample_count)
        check("diary shows every meal", tickets == sample_count, f"{tickets} of {sample_count}")
        # featured answer on the fresh first screen (no typing yet): the app answers its
        # signature question for the dish you eat most, so search->answer is visible in ~3s
        feat = page.locator(".answer")
        check("first screen shows a featured answer", feat.count() == 1, feat.count())
        feat_text = feat.text_content()
        check("featured answer reads the go-to dish", "On repeat" in feat_text and "Yes," in feat_text, feat_text)
        feat_dish = page.evaluate("() => (document.querySelector('.answer.featured .answer-dish') || {}).textContent || ''")
        check("featured answer heading names the dish", len(feat_dish.strip()) > 2 and feat_dish.strip() in feat_text, feat_dish)
        check("featured answer offers to log it again", feat.locator("button[data-again]").count() == 1, feat.locator("button[data-again]").count())
        check("featured answer shows the dish", feat.locator("img.answer-thumb").count() == 1, feat.locator("img.answer-thumb").count())
        original_viewport = page.viewport_size
        page.set_viewport_size({"width": 1440, "height": 900})
        page.wait_for_timeout(150)
        stat_rows = page.evaluate(
            """() => {
              if (innerWidth <= 760) return -1;
              const tops = [...document.querySelectorAll('.answer.featured dt')].map((dt) => Math.round(dt.getBoundingClientRect().top));
              return new Set(tops).size;
            }"""
        )
        page.set_viewport_size(original_viewport)
        page.wait_for_timeout(150)
        check("featured answer: one compact row of stats on desktop", stat_rows == 1, stat_rows)
        # r6b follow-up: the one-tap share lives on every meal surface, not just the diary tickets
        feat_share = feat.locator("button[data-share]")
        check("featured answer offers a one-tap share card", feat_share.count() == 1, feat_share.count())
        feat_share_id = feat_share.get_attribute("data-share")
        feat_share.click()
        page.wait_for_selector("#dlg-share[open]", timeout=5000)
        feat_share_text = page.evaluate("() => document.querySelector('#dlg-share').textContent")
        feat_share_name = page.evaluate(f"() => window.Lahap.state.entries.find(e => e.id === '{feat_share_id}').name")
        check("featured answer: share opens that dish's card", feat_share_name in feat_share_text, feat_share_name)
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        # one-tap share on every diary ticket (judge r6b: sharing a past meal should be as fast as logging it)
        share_chips = page.locator(".ticket-share").count()
        check("diary: every ticket has a share chip", share_chips == tickets, f"{share_chips} of {tickets}")
        first_id = page.locator(".ticket").first.get_attribute("data-open")
        page.evaluate("() => document.querySelector('.ticket-share').scrollIntoView({block: 'center'})")
        page.wait_for_timeout(150)
        page.locator(".ticket-share").first.click()
        page.wait_for_selector("#dlg-share[open]", timeout=5000)
        shared_name = page.evaluate("() => document.querySelector('#dlg-share').textContent")
        first_name = page.evaluate(f"() => window.Lahap.state.entries.find(e => e.id === '{first_id}').name")
        detail_open = page.evaluate("() => document.querySelector('#dlg-detail').open")
        check("diary: share chip opens that meal's card, not the detail", first_name in shared_name and not detail_open, first_name)
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        page.fill("#q", "nasi lemak")
        page.wait_for_timeout(150)
        expected = page.evaluate("() => window.Lahap.state.entries.filter(e => e.name.toLowerCase().includes('nasi lemak')).length")
        answer = page.locator(".answer h2").inner_text()
        check("search answers 'have I eaten this'", answer.startswith(f"Yes, {expected} times"), answer)
        ans_share = page.locator(".answer button[data-share]").count()
        check("search answer offers a one-tap share card", ans_share == 1, ans_share)
        check("search keeps focus while typing", page.evaluate("() => document.activeElement.id") == "q")
        page.fill("#q", "zzznothing")
        page.wait_for_timeout(100)
        check("search: empty answer", "Not in your diary" in page.locator(".answer").inner_text())
        page.fill("#q", "")

        # ---- log a meal through the UI ----
        rina_before = page.evaluate("() => window.Lahap.state.points.rina || 0")
        page.locator(".fab").click()
        page.wait_for_selector("#log-form")
        page.fill("#log-form input[name=name]", "Mie goreng test")
        page.fill("#log-form input[name=place]", "Warung Uji")
        page.fill("#log-form input[name=price]", "15000")
        check("r16 log: a fresh log keeps the optional fields folded", page.evaluate("() => !document.getElementById('log-more').open"))
        page.locator("#log-more > summary").click()
        page.locator("#log-form label.chip:has(input[value=Spicy])").click()
        page.locator("#log-form [data-seg=veg][data-value='2']").click()
        page.locator("#log-form label.chip:has(input[value=rina])").click()
        page.locator("#log-form button[type=submit]").click()
        page.wait_for_function("() => window.Lahap.state.entries.some(e => e.name === 'Mie goreng test')", timeout=5000)
        saved = page.evaluate("() => window.Lahap.state.entries.find(e => e.name === 'Mie goreng test')")
        check("log: meal saved", saved is not None)
        check("log: fields kept", saved and saved["price"] == 15000 and saved["tastes"] == ["Spicy"] and saved["plate"]["veg"] == 2, saved and {k: saved[k] for k in ("price", "tastes", "plate")})
        rina_after = page.evaluate("() => window.Lahap.state.points.rina || 0")
        check("tagging a bud adds 10 points", rina_after - rina_before == 10, f"{rina_before} -> {rina_after}")

        # seen-before prefill
        page.locator(".fab").click()
        page.fill("#log-form input[name=name]", "Mie goreng test")
        page.wait_for_selector("[data-fill]")
        page.locator("[data-fill]").click()
        check("seen-before fills price", page.input_value("#log-form input[name=price]") == "15000")
        page.locator("#dlg-log [data-close]").first.click()

        # ---- share card: transparent vs paper ----
        alpha = page.evaluate(
            """async () => {
              const entry = window.Lahap.state.entries.find(e => e.name === 'Mie goreng test');
              window.Lahap.openShare(entry);
              const canvas = document.getElementById('share-canvas');
              const out = {};
              for (const bg of ['clear', 'paper', 'ink']) {
                document.querySelector(`[data-seg=background][data-value=${bg}]`).click();
                await new Promise(r => setTimeout(r, 120));
                out[bg] = canvas.getContext('2d').getImageData(2, 2, 1, 1).data[3];
              }
              for (const tpl of ['receipt', 'stats', 'card']) {
                document.querySelector(`[data-seg=template][data-value=${tpl}]`).click();
                await new Promise(r => setTimeout(r, 120));
              }
              document.querySelector('[data-seg=size][data-value=square]').click();
              await new Promise(r => setTimeout(r, 120));
              out.size = [canvas.width, canvas.height];
              document.getElementById('dlg-share').close();
              window.Lahap.openShare('week');
              await new Promise(r => setTimeout(r, 150));
              out.weekOk = canvas.isConnected || document.getElementById('share-canvas').width === 1080;
              document.getElementById('dlg-share').close();
              return out;
            }"""
        )
        check("share: transparent PNG has alpha 0", alpha["clear"] == 0, alpha)
        check("share: paper background opaque", alpha["paper"] == 255 and alpha["ink"] == 255, alpha)
        check("share: square size 1080x1080", alpha["size"] == [1080, 1080], alpha["size"])
        check("share: week card renders", alpha["weekOk"])

        # ---- r11: the share sheet previews every template on the current (photo) background ----
        # The per-template previews are repainted by an async redraw (openShare / the segment
        # clicks fire redraw() without awaiting it, and drawShare awaits the photo image load).
        # A fixed sleep raced that: sometimes it read the canvas before the story size / the
        # photo / the paper background had actually landed, so it sampled a blank/white canvas.
        # Poll until the painted pixels match what the assertions check instead of sleeping.
        preview = page.evaluate(
            """async () => {
              const minisOf = () => [...document.querySelectorAll('#dlg-share .tp-canvas')];
              const dimsOf = () => minisOf().map((c) => [c.width, c.height]);
              const varianceOf = (c) => {
                const d = c.getContext('2d').getImageData(0, 0, c.width, Math.floor(c.height * 0.15)).data;
                const seen = new Set();
                for (let i = 0; i < d.length; i += 4 * 137) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
                return seen.size;
              };
              const varianceAll = () => minisOf().map(varianceOf);
              const paperCornerOf = () => Array.from(minisOf()[0].getContext('2d').getImageData(6, 6, 1, 1).data);
              // rAF-paced wait for an async repaint to actually land; the short timeout floor
              // keeps the test moving if the frame loop is ever throttled, and the wall-clock
              // deadline guarantees it can never hang the suite.
              async function pollUntil(cond, timeout) {
                timeout = timeout || 5000;
                const deadline = performance.now() + timeout;
                for (;;) {
                  if (cond()) return true;
                  if (performance.now() >= deadline) return false;
                  await Promise.race([
                    new Promise((r) => requestAnimationFrame(r)),
                    new Promise((r) => setTimeout(r, 64)),
                  ]);
                }
              }
              const entry = window.Lahap.state.entries.find(e => e.name === 'Mie goreng test');
              entry.photo = 'tests/fixtures/plate.jpg';
              window.Lahap.openShare(entry);
              document.querySelector('[data-seg=size][data-value=story]').click();
              document.querySelector('[data-seg=background][data-value=photo]').click();
              // wait until every preview is sized to the story canvas AND the photo has actually
              // been painted behind each one (a blank/white canvas reports a single colour, so
              // variance > 40 proves the photo is there) -- the state the fixed sleep used to race
              await pollUntil(() => dimsOf().length === 3 && dimsOf().every((p) => p[0] === 216 && p[1] === 384) && varianceAll().every((v) => v > 40));
              const minis = minisOf();
              const pressed = [...document.querySelectorAll('#dlg-share .tp-btn')].map((b) => b.getAttribute('aria-pressed'));
              const out = {
                count: minis.length,
                dims: dimsOf(),
                pressed,
                variance: varianceAll(),
              };
              document.querySelector('[data-seg=background][data-value=paper]').click();
              // wait until the paper background has actually been painted onto the preview
              await pollUntil(() => {
                const p = paperCornerOf();
                return p[0] === 245 && p[1] === 239 && p[2] === 227 && p[3] === 255;
              });
              out.paperCorner = paperCornerOf();
              entry.photo = null;
              document.getElementById('dlg-share').close();
              return out;
            }"""
        )
        check("share: one live preview per template", preview["count"] == 3, preview["count"])
        check("share: previews render the story canvas at a glance", preview["dims"] == [[216, 384], [216, 384], [216, 384]], preview["dims"])
        check("share: exactly one template preview is selected", preview["pressed"].count("true") == 1, preview["pressed"])
        check("share: the photo shows behind every template", all(v > 40 for v in preview["variance"]), preview["variance"])
        check("share: switching the background repaints the previews", preview["paperCorner"] == [245, 239, 227, 255], preview["paperCorner"])

        # ---- r12: selected template preview pops with an accent ring, and taps animate ----
        r12 = page.evaluate(
            """async () => {
              const entry = window.Lahap.state.entries.find(e => e.name === 'Mie goreng test');
              window.Lahap.openShare(entry);
              document.querySelector('[data-seg=template][data-value=card]').click();
              await new Promise(r => setTimeout(r, 300));
              const btns = [...document.querySelectorAll('#dlg-share .tp-btn')];
              const sel = btns.find((b) => b.getAttribute('aria-pressed') === 'true');
              const out = {
                selRing: getComputedStyle(sel).boxShadow,
                transitionProp: getComputedStyle(btns[0]).transitionProperty,
                transitionDur: getComputedStyle(btns[0]).transitionDuration,
              };
              document.getElementById('dlg-share').close();
              return out;
            }"""
        )
        check("share: selected preview pops with an accent ring", r12["selRing"] and str(r12["selRing"]).lower() != "none", str(r12["selRing"])[:70])
        check("share: template thumbnails animate on tap", "transform" in (r12["transitionProp"] or "") and r12["transitionDur"] != "0s", str(r12["transitionProp"]))

        # ---- r13: the active preview animates on a template switch ----
        r13 = page.evaluate(
            """async () => {
              const entry = window.Lahap.state.entries.find(e => e.name === 'Mie goreng test');
              entry.photo = null;
              window.Lahap.openShare(entry);
              await new Promise(r => setTimeout(r, 320));
              const base = window.Lahap.drawShare.previewAnimCount || 0;
              const sel = document.querySelector('#dlg-share .tp-btn[aria-pressed="true"]');
              const next = ['card', 'receipt', 'stats'].find((v) => v !== sel.getAttribute('data-value'));
              document.querySelector('#dlg-share [data-seg=template][data-value=' + next + ']').click();
              await new Promise(r => setTimeout(r, 320));
              const after = window.Lahap.drawShare.previewAnimCount || 0;
              entry.photo = null;
              document.getElementById('dlg-share').close();
              return { base, after, next };
            }"""
        )
        check("share: active preview animates on a template switch", r13["after"] > r13["base"], f"count {r13['base']}->{r13['after']} (switched to {r13['next']})")

        # ---- G4: share card stats never overlap (judge finding turned into a gate) ----
        overlaps = page.evaluate(
            """async () => {
              const found = [];
              const entry = window.Lahap.state.entries.reduce((a, b) => (String(a.price).length >= String(b.price).length ? a : b));
              entry.price = 1234567;
              for (const subject of [entry, 'week']) {
                for (const [size, template] of [['story', 'card'], ['square', 'card'], ['story', 'stats'], ['square', 'stats']]) {
                  window.Lahap.openShare(subject);
                  document.querySelector(`[data-seg=size][data-value=${size}]`).click();
                  document.querySelector(`[data-seg=template][data-value=${template}]`).click();
                  await new Promise(r => setTimeout(r, 150));
                  const boxes = window.Lahap.drawShare.boxes.slice();
                  for (const a of boxes) {
                    for (const b of boxes) {
                      if (a !== b && a.y === b.y && a.x < b.x && a.x + a.width + 16 > b.x) found.push(`${template}/${size}:${a.x}->${b.x}`);
                    }
                  }
                  document.getElementById('dlg-share').close();
                }
              }
              return found;
            }"""
        )
        check("G4 share stats never overlap (card + stats, story + square, meal + week)", not overlaps, overlaps)

        # ---- r9: plate score decoded where it appears; nav says what the tab is ----
        page.goto(base + "?nosw=1#diary")
        page.wait_for_selector("html[data-ready='1']")
        key_text = page.evaluate("() => (document.querySelector('.plate-key') || {}).textContent || ''")
        bands = page.evaluate("() => [75, 74, 50, 49].map((s) => window.LahapLogic.healthLabel(s))")
        check(
            "diary: plate key matches the real bands (75+ Balanced, 50+ Okay, under 50 Heavy)",
            "75+ Balanced" in key_text and "50+ Okay" in key_text and "under 50 Heavy" in key_text
            and bands == ["Balanced", "Okay", "Okay", "Heavy"],
            [key_text, bands],
        )
        day_head = page.evaluate("() => (document.querySelector('.day-head .mono') || {}).textContent || ''")
        check("diary: day header names the plate band, not a bare number", re.search(r"plate \d+ (Balanced|Okay|Heavy)", day_head) is not None, day_head)
        nav_labels = page.evaluate("() => [...document.querySelectorAll('a[data-tab=lab]')].map((a) => a.textContent.trim())")
        check("nav: one name for recipes on every breakpoint", nav_labels and all(label == "Recipes" for label in nav_labels), nav_labels)

        # ---- r8b: the plate score stamp sits on the plate's top-right rim, fully inside the card ----
        stamp = page.evaluate(
            """async () => {
              const entry = window.Lahap.state.entries.find(e => e.name === 'Tom yum seafood');
              window.Lahap.openShare(entry);
              document.querySelector('[data-seg=template][data-value=card]').click();
              document.querySelector('[data-seg=size][data-value=story]').click();
              document.querySelector('[data-seg=background][data-value=paper]').click();
              await new Promise(r => setTimeout(r, 300));
              const s = window.Lahap.drawShare.stamp;
              const canvas = document.getElementById('share-canvas');
              const px = s ? Array.from(canvas.getContext('2d').getImageData(Math.round(s.x), Math.round(s.y), 1, 1).data) : null;
              document.querySelector('[data-seg=size][data-value=square]').click();
              await new Promise(r => setTimeout(r, 300));
              const square = window.Lahap.drawShare.stamp;
              document.getElementById('dlg-share').close();
              entry.photo = 'tests/fixtures/plate.jpg';
              window.Lahap.openShare(entry);
              document.querySelector('[data-seg=template][data-value=card]').click();
              document.querySelector('[data-seg=background][data-value=photo]').click();
              // the photo background loads async: wait for the redraw instead of a fixed 300 ms
              let photo = null;
              for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 100));
                const current = window.Lahap.drawShare.stamp;
                if (current && current !== square) {
                  photo = current;
                  break;
                }
              }
              document.getElementById('dlg-share').close();
              return { stamp: s, square, photo, px };
            }"""
        )
        s = stamp["stamp"]
        stamp_in = s and 0 <= s["x"] - s["r"] and s["x"] + s["r"] <= 1080 and 0 <= s["y"] - s["r"] and s["y"] + s["r"] <= 1920
        check("r8b stamp: plate badge fully inside the story frame", stamp_in, s)
        q = stamp["square"]
        square_in = q and 0 <= q["x"] - q["r"] and q["x"] + q["r"] <= 1080 and 0 <= q["y"] - q["r"] and q["y"] + q["r"] <= 1080
        check("r8b stamp: plate badge fully inside the square frame", square_in, q)
        p = stamp["photo"]
        photo_in = p and 0 <= p["x"] - p["r"] and p["x"] + p["r"] <= 1080 and 0 <= p["y"] - p["r"] and p["y"] + p["r"] <= 1920
        check("r8b stamp: plate badge fully inside the photo frame", photo_in, p)
        # r21: the stamp inks in its band colour (Tom yum is Balanced, so green like the app's score chips)
        ink = (s or {}).get("ink") or "#000000"
        ink_rgb = [int(ink[i:i + 2], 16) for i in (1, 3, 5)]
        check(
            "r21 stamp: the Card stamp is inked in the plate's band colour, not always red",
            ink == "#3f7a2f" and stamp["px"] and all(abs(stamp["px"][i] - ink_rgb[i]) <= 24 for i in range(3)),
            (ink, stamp["px"]),
        )

        # ---- r15: phone filter row fits (no chip cut off mid-word); tastes sit behind one Taste chip ----
        page.goto(base + "#diary")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(300)
        row_fit = page.evaluate(
            """() => {
              const row = document.querySelector(".filters");
              const box = row.getBoundingClientRect();
              const visible = [...row.querySelectorAll(".chip")].filter((chip) => chip.offsetParent !== null);
              const clipped = visible.filter((chip) => chip.getBoundingClientRect().right > box.right + 1).map((chip) => chip.textContent.trim());
              return {
                over: row.scrollWidth > row.clientWidth + 1,
                clipped,
                labels: visible.map((chip) => chip.textContent.trim()),
                tastesShown: [...row.querySelectorAll("[data-taste]")].some((chip) => chip.offsetParent !== null),
                rows: new Set(visible.map((chip) => Math.round(chip.getBoundingClientRect().top))).size,
              };
            }"""
        )
        check("r15 filters: at 390px no chip runs past the row edge", not row_fit["over"] and not row_fit["clipped"], row_fit)
        check("r15 filters: one row of sources plus a Taste chip, tastes folded away", row_fit["rows"] == 1 and not row_fit["tastesShown"] and any(l.startswith("Taste") for l in row_fit["labels"]), row_fit)
        page.locator(".filters [data-taste-toggle]").click()
        page.wait_for_timeout(150)
        opened = page.evaluate(
            """() => {
              const row = document.querySelector(".filters");
              const box = row.getBoundingClientRect();
              const tastes = [...row.querySelectorAll("[data-taste]")].filter((chip) => chip.offsetParent !== null);
              return {
                count: tastes.length,
                clipped: tastes.filter((chip) => chip.getBoundingClientRect().right > box.right + 1).length,
                expanded: row.querySelector("[data-taste-toggle]").getAttribute("aria-expanded"),
              };
            }"""
        )
        check("r15 filters: Taste opens all six taste chips, wrapped inside the row", opened["count"] == 6 and opened["clipped"] == 0 and opened["expanded"] == "true", opened)
        page.locator(".filters [data-taste='Spicy']").click()
        page.wait_for_timeout(150)
        toggle_label = page.evaluate("() => document.querySelector('.filters [data-taste-toggle]').textContent")
        check("r15 filters: an active taste keeps the row open and counts on the Taste chip", "· 1" in toggle_label and page.evaluate("() => window.Lahap.state.tasteFilter.join()") == "Spicy", toggle_label)
        page.locator(".filters [data-taste-toggle]").click()
        page.wait_for_timeout(150)
        check("r15 filters: closing Taste clears the taste filter", page.evaluate("() => window.Lahap.state.tasteFilter.length") == 0)

        # ---- r16: phone week strip, share disc in its own spot, log sheet folds optional fields ----
        page.goto(base + "#diary")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(300)
        strip = page.evaluate(
            """() => {
              const el = document.querySelector("#view-diary .week-strip");
              if (!el) return null;
              const filters = document.querySelector(".filters").getBoundingClientRect();
              const box = el.getBoundingClientRect();
              const line = document.querySelector("#view-diary .weekline dl");
              return {
                shown: el.offsetParent !== null,
                cells: el.querySelectorAll(".ws-value").length,
                values: [...el.querySelectorAll(".ws-value")].map((v) => v.textContent.trim()),
                href: el.getAttribute("href"),
                belowFilters: box.top >= filters.bottom - 1,
                height: Math.round(box.height),
                fits: el.scrollWidth <= el.clientWidth + 1,
                lineNumbersHidden: !line || line.offsetParent === null,
              };
            }"""
        )
        check("r16 week strip: phone Diary shows four week numbers under the filters", strip and strip["shown"] and strip["cells"] == 4 and strip["belowFilters"] and strip["fits"], strip)
        check("r16 week strip: it is compact and opens Insights", strip and strip["height"] <= 64 and strip["href"] == "#insights", strip)
        check("r16 week strip: spend uses the short form", strip and strip["values"][3].startswith("IDR ") and strip["values"][3][-1] in "kM", strip)
        check("r16 week strip: the week line further down no longer repeats the numbers on a phone", strip and strip["lineNumbersHidden"], strip)
        share_spot = page.evaluate(
            """() => [...document.querySelectorAll("#view-diary .ticket-wrap")].slice(0, 6).map((wrap) => {
              const r = (el) => el.getBoundingClientRect();
              const share = wrap.querySelector(".ticket-share");
              const disc = r(share);
              const discBox = { left: disc.left + 7, right: disc.right - 7, top: disc.top + 7, bottom: disc.bottom - 7 };
              const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
              const tags = [...wrap.querySelectorAll(".tags .tag")].map(r);
              return {
                size: [Math.round(disc.width), Math.round(disc.height)],
                onThumb: hit(discBox, r(wrap.querySelector(".thumb"))),
                onStub: hit(discBox, r(wrap.querySelector(".stub"))),
                onTag: tags.some((t) => hit(discBox, t)),
                inside: discBox.left >= r(wrap).left && discBox.right <= r(wrap).right && discBox.bottom <= r(wrap).bottom,
              };
            })"""
        )
        check("r16 share: the share disc never sits on the photo, the price stub or a taste chip", share_spot and all(not s["onThumb"] and not s["onStub"] and not s["onTag"] and s["inside"] for s in share_spot), share_spot)
        check("r16 share: the share button is still a 44px target", share_spot and all(s["size"] == [44, 44] for s in share_spot), share_spot[:2])
        page.locator(".fab").click()
        page.wait_for_selector("#log-form")
        fold = page.evaluate(
            """() => ({
              open: document.getElementById("log-more").open,
              tasteVisible: [...document.querySelectorAll("#log-form input[name=taste]")].some((i) => i.closest("label").checkVisibility()),
              plateVisible: document.getElementById("log-plate").checkVisibility(),
              sum: document.getElementById("log-more-sum").textContent,
            })"""
        )
        check("r16 log: More details is folded on a new log, the plate step stays open", not fold["open"] and not fold["tasteVisible"] and fold["plateVisible"], fold)
        check("r16 log: the folded section says what is inside", "Taste" in fold["sum"] and "notes" in fold["sum"], fold["sum"])
        page.locator("#log-more > summary").click()
        page.locator("#log-form label.chip:has(input[value=Sour])").click()
        page.locator("#log-form [data-seg=rating][data-value='4']").click()
        page.wait_for_timeout(100)
        live_sum = page.evaluate("() => document.getElementById('log-more-sum').textContent")
        check("r16 log: the summary follows what you pick (taste and rating)", "Sour" in live_sum and "4" in live_sum, live_sum)
        page.locator("#dlg-log [data-close]").first.click()
        page.wait_for_timeout(150)

        # ---- r17: share sheet shows every background (Photo picks one), receipt-style Today, one plan button per place ----
        r17ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        r17 = r17ctx.new_page()
        r17.goto(base + "?demo=1&nosw=1#diary")
        r17.wait_for_selector("html[data-ready='1']")
        r17.wait_for_timeout(300)
        r17.evaluate("() => window.Lahap.openShare(window.Lahap.state.entries.find((e) => !e.photo))")
        r17.wait_for_timeout(600)
        sheet = r17.evaluate(
            """() => {
              const bg = [...document.querySelectorAll("#dlg-share [data-seg=background]")];
              const size = document.querySelector("#dlg-share [data-seg=size]").getBoundingClientRect();
              const tpl = document.querySelector("#dlg-share .tp-btn").getBoundingClientRect();
              return {
                labels: bg.map((b) => b.textContent.trim()),
                sizeBottom: Math.round(size.bottom),
                tplBottom: Math.round(tpl.bottom),
                viewport: window.innerHeight,
              };
            }"""
        )
        check("r17 share: a meal without a photo still offers Photo (as '+ Photo') next to Paper, Dark and Transparent", sheet["labels"] == ["Paper", "Dark", "+ Photo", "Transparent"], sheet["labels"])
        check("r17 share: on a phone, Template, Background and Size all fit on the first screen", sheet["sizeBottom"] <= sheet["viewport"] and sheet["tplBottom"] <= sheet["viewport"], sheet)
        with r17.expect_file_chooser() as chooser_info:
            r17.locator("#dlg-share [data-seg=background][data-value=photo]").click()
        chooser_info.value.set_files(str(ROOT / "tests" / "fixtures" / "plate.jpg"))
        r17.wait_for_timeout(1200)
        picked = r17.evaluate(
            """() => {
              const button = document.querySelector("#dlg-share [data-seg=background][data-value=photo]");
              return {
                open: document.getElementById("dlg-share").open,
                label: button.textContent.trim(),
                pressed: button.getAttribute("aria-pressed"),
                saved: window.Lahap.state.entries.filter((e) => e.photo && String(e.photo).startsWith("data:image/jpeg")).length,
              };
            }"""
        )
        check("r17 share: + Photo opens the picker, saves the photo to the meal and switches the card to it", picked["open"] and picked["label"] == "Photo" and picked["pressed"] == "true" and picked["saved"] == 1, picked)
        r17.evaluate("() => document.getElementById('dlg-share').close()")
        r17.evaluate("() => window.Lahap.openShare('week')")
        r17.wait_for_timeout(300)
        week_labels = r17.evaluate("() => [...document.querySelectorAll('#dlg-share [data-seg=background]')].map((b) => b.textContent.trim())")
        check("r17 share: the week card has no Photo option", "Photo" not in " ".join(week_labels), week_labels)
        r17ctx.close()

        page.goto(base + "#diary")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(300)
        receipt = page.evaluate(
            """() => {
              const today = document.querySelector("#view-diary .today");
              if (!today) return null;
              const edge = getComputedStyle(today, "::after");
              const bar = getComputedStyle(today.querySelector(".bar"));
              const label = getComputedStyle(today.querySelector(".today-row > span"));
              return {
                torn: edge.content !== "none" && parseFloat(edge.height) >= 6,
                tally: bar.backgroundImage.includes("repeating-linear-gradient"),
                mono: label.textTransform === "uppercase",
              };
            }"""
        )
        check("r17 today: the Today card reads as a receipt (torn edge, tally bars, mono labels)", receipt and receipt["torn"] and receipt["tally"] and receipt["mono"], receipt)

        page.goto(base + "#buds")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(300)
        plans = page.evaluate(
            """() => ({
              nextLevelPlan: document.querySelectorAll("#view-buds .next-level-card [data-hangout]").length,
              suggested: [...document.querySelectorAll("#view-buds .invite.suggested [data-hangout]")].map((b) => b.textContent.trim()),
              rows: [...document.querySelectorAll("#view-buds .person-actions [data-hangout]")].map((b) => ({ small: b.classList.contains("small"), label: b.getAttribute("aria-label") || "" })),
            })"""
        )
        check("r17 buds: the Next-level card has one action (tag a meal), no second Plan makan", plans["nextLevelPlan"] == 0, plans["nextLevelPlan"])
        check("r17 buds: the suggested plan's button names the place or the bud", plans["suggested"] and all(s.startswith("Plan makan at ") or s.startswith("Plan makan with ") for s in plans["suggested"]), plans["suggested"])
        check("r17 buds: row plan buttons are the quiet small style and say who they are for", plans["rows"] and all(r["small"] and r["label"].startswith("Plan makan with ") for r in plans["rows"]), plans["rows"])
        page.goto(base + "#diary")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(200)

        # ---- r18: Ate with outside the fold, recipe log first, Plan makan up top on phone, sample ticket, soft tear ----
        page.goto(base + "#diary")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(200)
        page.locator(".fab").click()
        page.wait_for_selector("#log-form")
        page.wait_for_timeout(300)
        ate_with = page.evaluate(
            """() => {
              const field = document.querySelector("#log-form .ate-with");
              const place = document.querySelector("#log-form input[name=place]");
              return {
                exists: !!field,
                folded: !!(field && field.closest("#log-more")),
                moreOpen: document.getElementById("log-more").open,
                visible: !!(field && field.checkVisibility()),
                afterPlace: !!(field && place && (place.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING)),
                sum: document.getElementById("log-more-sum").textContent,
              };
            }"""
        )
        check("r18 log: Ate with sits after Place, outside More details, visible on a fresh log", ate_with["exists"] and not ate_with["folded"] and not ate_with["moreOpen"] and ate_with["visible"] and ate_with["afterPlace"], ate_with)
        check("r18 log: the folded summary no longer promises who you ate with", "ate with" not in ate_with["sum"].lower(), ate_with["sum"])
        page.locator("#dlg-log [data-close]").first.click()
        page.wait_for_timeout(150)

        page.goto(base + "#lab")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(300)
        recipe = page.evaluate(
            """() => {
              const card = document.querySelector("#view-lab .recipe");
              if (!card) return null;
              const log = card.querySelector("[data-lab-log]");
              const details = card.querySelector("details");
              return {
                label: log ? log.textContent.trim() : "",
                beforeSteps: !!(log && details && (log.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING)),
                intro: document.querySelector("#view-lab .view-head p").textContent,
              };
            }"""
        )
        check("r18 recipes: the log button comes before the steps and says it goes to the Diary", recipe and recipe["beforeSteps"] and "Diary" in recipe["label"], recipe)
        check("r18 recipes: the intro says a cooked recipe logs to the Diary", recipe and "Diary" in recipe["intro"], recipe and recipe["intro"])

        page.goto(base + "#buds")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(300)
        buds_order = page.evaluate(
            """() => {
              const top = (selector) => {
                const node = document.querySelector(selector);
                return node ? node.getBoundingClientRect().top : null;
              };
              const plans = document.querySelector("#view-buds .plans-panel");
              const buds = [...document.querySelectorAll("#view-buds .panel h2")].find((h) => h.textContent.trim() === "Your buds");
              return {
                plans: top("#view-buds .plans-panel"),
                next: top("#view-buds .next-level-card"),
                buds: buds ? buds.getBoundingClientRect().top : null,
                tinted: plans ? getComputedStyle(plans).backgroundImage.includes("gradient") : false,
                heading: plans ? plans.querySelector("h2").textContent.trim() : "",
              };
            }"""
        )
        check("r18 buds: on a phone Plan makan sits right under the Next level card, above Your buds", buds_order["plans"] is not None and buds_order["next"] is not None and buds_order["buds"] is not None and buds_order["next"] < buds_order["plans"] < buds_order["buds"], buds_order)
        check("r18 buds: the Plan makan panel is tinted and named for the action", buds_order["tinted"] and buds_order["heading"] == "Plan makan", buds_order)

        page.goto(base + "#diary")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(200)
        tear = page.evaluate(
            """() => {
              const today = document.querySelector("#view-diary .today");
              if (!today) return null;
              const edge = getComputedStyle(today, "::after");
              return { scallop: edge.backgroundImage.includes("radial-gradient"), zigzag: edge.backgroundImage.includes("45deg") };
            }"""
        )
        check("r18 today: the torn edge is a soft scallop, not a zigzag", tear and tear["scallop"] and not tear["zigzag"], tear)

        empty_ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        empty_page = empty_ctx.new_page()
        empty_page.goto(base + "?nosw=1&noquiz=1#diary")
        empty_page.wait_for_selector("html[data-ready='1']")
        empty_page.wait_for_timeout(300)
        sample = empty_page.evaluate(
            """() => {
              const figure = document.querySelector("#view-diary .empty .sample-ticket");
              if (!figure) return null;
              const box = figure.getBoundingClientRect();
              return {
                caption: figure.querySelector("figcaption").textContent,
                label: figure.getAttribute("aria-label") || "",
                interactive: figure.querySelectorAll("button, a, [data-open], [data-share]").length,
                price: figure.querySelector(".price").textContent,
                fits: box.right <= window.innerWidth && box.left >= 0,
                entries: window.Lahap.state.entries.length,
              };
            }"""
        )
        check("r18 empty: a clearly-labelled example ticket shows what a logged meal looks like", sample and "Example" in sample["caption"] and "Example" in sample["label"] and sample["price"].strip() != "", sample)
        check("r18 empty: the example is not clickable, fits the phone and adds no data", sample and sample["interactive"] == 0 and sample["fits"] and sample["entries"] == 0, sample)
        empty_ctx.close()
        page.goto(base + "#diary")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(200)

        # ---- r19: phone Diary leads with the day you are living; desktop keeps On repeat on top; Me is Profile ----
        r19_order = {}
        for r19_width, r19_tag in ((390, "phone"), (1280, "desk")):
            r19_ctx = browser.new_context(viewport={"width": r19_width, "height": 900}, device_scale_factor=1)
            r19_page = r19_ctx.new_page()
            r19_page.goto(base + "?demo=1&nosw=1#diary")
            r19_page.wait_for_selector("html[data-ready='1']")
            r19_page.wait_for_timeout(300)
            r19_order[r19_tag] = r19_page.evaluate(
                """() => {
                  const col = document.querySelector("#view-diary .diary-col");
                  const kids = col ? [...col.children] : [];
                  const at = (selector) => kids.findIndex((el) => el.matches(selector));
                  const lead = document.querySelector("#view-diary .lead-day");
                  return {
                    lead: at(".lead-day"),
                    answer: at(".answer.featured"),
                    search: at(".search"),
                    today: lead ? lead.querySelectorAll(".today").length : 0,
                    tab: [...document.querySelectorAll('a[data-tab=me]')].map((a) => a.textContent.trim()),
                  };
                }"""
            )
            if r19_tag == "phone":
                r19_page.evaluate("() => location.hash = 'me'")
                r19_page.wait_for_timeout(200)
                r19_order["profile_h1"] = r19_page.inner_text("#view-me h1")
                r19_page.evaluate("() => location.hash = 'insights'")
                r19_page.wait_for_timeout(200)
                r19_order["score_px"] = r19_page.evaluate("() => parseFloat(getComputedStyle(document.querySelector('.plate-week .pday b')).fontSize)")
                r19_page.set_viewport_size({"width": 1280, "height": 900})
                r19_page.evaluate("() => location.hash = 'diary'")
                r19_page.wait_for_timeout(300)
                r19_order["resized"] = r19_page.evaluate(
                    """() => {
                      const kids = [...document.querySelector("#view-diary .diary-col").children];
                      return kids.findIndex((el) => el.matches(".answer.featured")) < kids.findIndex((el) => el.matches(".lead-day"));
                    }"""
                )
            r19_ctx.close()
        phone_order = r19_order["phone"]
        desk_order = r19_order["desk"]
        check("r19 diary: on a phone the latest day and Today come before the On repeat answer", phone_order["lead"] > phone_order["search"] >= 0 and 0 <= phone_order["lead"] < phone_order["answer"] and phone_order["today"] == 1, phone_order)
        check("r19 diary: on desktop the On repeat answer still leads the column", 0 <= desk_order["answer"] < desk_order["lead"], desk_order)
        check("r19 diary: widening a phone to desktop re-orders the Diary", r19_order.get("resized") is True, r19_order.get("resized"))
        check("r19 nav: the Me tab is labelled Profile everywhere", phone_order["tab"] and all(label == "Profile" for label in phone_order["tab"]) and r19_order.get("profile_h1") == "Profile", (phone_order["tab"], r19_order.get("profile_h1")))
        check("r19 insights: day scores read at 16px on a phone", r19_order.get("score_px", 0) >= 16, r19_order.get("score_px"))

        # ---- r8b: early-state buds card is the next step when there are no buds yet ----
        fresh = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        fresh_page = fresh.new_page()
        fresh_page.goto(base + "?nosw=1&noquiz=1#buds")
        fresh_page.wait_for_selector("html[data-ready='1']")
        fresh_page.wait_for_timeout(200)
        early = fresh_page.locator(".next-level-card")
        check("r8b buds: early-state card shown when there are no buds", early.count() == 1, early.count())
        check("r8b buds: early card points at inviting a friend", "invite" in early.first.inner_text().lower(), early.first.inner_text()[:80])
        check("r8b buds: early card has the invite action", fresh_page.locator(".next-level-card [data-invite]").count() == 1)
        fresh_page.locator("[data-add]").first.click()
        fresh_page.wait_for_timeout(200)
        fresh_buds_text = fresh_page.locator("#view-buds").inner_text()
        check("r8b buds: early card goes away once a bud exists", "Add your first bud" not in fresh_buds_text)
        fresh.close()

        # ---- taste buds ----
        page.goto(base + "?nosw=1#buds")
        page.wait_for_selector("html[data-ready='1']")
        page.locator("[data-add]").first.click()
        page.wait_for_timeout(200)
        friends = page.evaluate("() => window.Lahap.state.friends.length")
        check("add a bud", friends == 3, friends)
        why_lines = page.evaluate("() => [...document.querySelectorAll('#view-buds .person .why')].map((el) => el.textContent)")
        check(
            "buds: every bud row says when you last ate together",
            why_lines and all(("last makan" in line) or ("no meals together yet" in line) for line in why_lines[:3]),
            why_lines[:3],
        )
        remove_labels = page.evaluate("() => [...document.querySelectorAll('#view-buds [data-remove]')].map((b) => b.textContent.trim())")
        check("buds: remove control is labelled Remove", remove_labels and all(label == "Remove" for label in remove_labels), remove_labels)
        size_before = page.viewport_size
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(150)
        bud_name_width = page.evaluate(
            "() => { const row = document.querySelector('.person .person-actions'); return row ? row.closest('.person').querySelector('.name').getBoundingClientRect().width : 0; }"
        )
        page.set_viewport_size(size_before)
        page.wait_for_timeout(150)
        check("buds: at 390px a bud row keeps a wide name column (actions wrap below)", bud_name_width >= 250, round(bud_name_width))
        buds_text = page.locator("main").inner_text()
        check(
            "buds: one verb for a plan (Plan makan, no Hang out / Plan it)",
            "Plan makan" in buds_text and "Hang out" not in buds_text and "Plan it" not in buds_text,
            [verb for verb in ("Plan makan", "Hang out", "Plan it") if verb in buds_text],
        )
        page.locator("[data-hangout=rina]").click()
        page.wait_for_selector("#hangout-form")
        wa = page.get_attribute("#hangout-wa", "href")
        check("hangout: WhatsApp link has message", wa.startswith("https://wa.me/?text=Hi%20Rina"), wa[:60])
        page.locator("#hangout-form button[type=submit]").click()
        page.wait_for_timeout(200)
        pending = page.evaluate("() => (document.querySelector('#view-buds .plan-pending') || {}).textContent || ''")
        check("buds: a saved plan shows on the bud row with the We went step", "Planned:" in pending and "We went" in pending, pending)
        before = page.evaluate("() => window.Lahap.state.points.rina || 0")
        page.locator("[data-done]").first.click()
        page.wait_for_timeout(300)
        after = page.evaluate("() => window.Lahap.state.points.rina || 0")
        check("hangout done adds 25 points", after - before == 25, f"{before} -> {after}")
        check("hangout done opens log with bud tagged", page.locator("#log-form input[value=rina]:checked").count() == 1)
        hangout_more = page.evaluate(
            """() => {
              const rina = document.querySelector("#log-form input[value=rina]");
              return {
                outsideFold: !rina.closest("#log-more"),
                visible: rina.closest("label").checkVisibility(),
              };
            }"""
        )
        check("r18 log: a prefilled bud is ticked in the Ate with row you can see, not inside More details", hangout_more["outsideFold"] and hangout_more["visible"], hangout_more)
        page.locator("#dlg-log [data-close]").first.click()

        # ---- next-level card: appears when a bud is close to the next tier ----
        nl_card = page.locator(".next-level-card")
        check("buds: next-level card shown when a bud is close to next level", nl_card.count() == 1, nl_card.count())
        if nl_card.count():
            nl_text = nl_card.first.inner_text()
            check("buds: next-level card shows 'to' next level name", " to " in nl_text, nl_text[:80])
            check("buds: next-level card has Tag a meal action", page.locator(".next-level-card [data-tag-meal]").count() == 1, page.locator(".next-level-card [data-tag-meal]").count())
            # Tag a meal opens log with the bud preselected
            bud_id = page.locator(".next-level-card [data-tag-meal]").first.get_attribute("data-tag-meal")
            page.locator(".next-level-card [data-tag-meal]").first.click()
            page.wait_for_selector("#log-form")
            check("next-level: Tag a meal opens log with bud preselected", page.locator(f"#log-form input[value={bud_id}]:checked").count() == 1, bud_id)
            page.locator("#dlg-log [data-close]").first.click()

        # ---- remove friend: ✕ button on every friend row ----
        remove_btns = page.locator("#view-buds [data-remove]")
        check("buds: every friend has a remove button", remove_btns.count() >= 1, remove_btns.count())
        first_remove = remove_btns.first
        check("buds: remove button has aria-label", first_remove.get_attribute("aria-label") is not None, first_remove.get_attribute("aria-label"))
        target_id = first_remove.get_attribute("data-remove")
        target_label = first_remove.get_attribute("aria-label") or ""
        before_count = page.locator("#view-buds [data-remove]").count()
        # intercept the confirm() and accept
        first_remove.click()
        page.wait_for_timeout(300)
        after_count = page.locator("#view-buds [data-remove]").count()
        check("remove: button count decreases by one", after_count == before_count - 1, (before_count, after_count))
        check("remove: target removed from state.friends", target_id not in page.evaluate("() => window.Lahap.state.friends"), target_id)
        check("remove: target removed from state.points", target_id not in page.evaluate("() => window.Lahap.state.points"), target_id)
        # the removed bud should no longer be in the buds list text
        buds_text = page.locator("#view-buds").inner_text()
        # aria-label is "Remove <name>" — pull the name out
        removed_name = target_label.replace("Remove ", "").strip()
        check("remove: bud name no longer in buds list text", removed_name not in buds_text, removed_name)

        # ---- real invite: the link carries a taste profile, a fresh browser adds the sender as a bud ----
        link = page.evaluate("() => { window.Lahap.state.settings.name = 'Juwen'; return window.Lahap.inviteLink(); }")
        code = link.split("bud=")[1].split("#")[0] if "bud=" in link else ""
        check("invite: link carries a taste code", link.startswith("https://juw12.github.io/lahap/?bud=") and len(code) > 20, link[:70])
        guest = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        guest_page = guest.new_page()
        guest_page.goto(base + "?nosw=1&noquiz=1&bud=" + code + "#buds")
        guest_page.wait_for_selector("html[data-ready='1']")
        guest_page.wait_for_timeout(200)
        card = guest_page.inner_text(".invite-in") if guest_page.query_selector(".invite-in") else ""
        check("invite: friend sees who invited them", "Juwen wants to compare tastes" in card, card[:80])
        check("invite: code removed from the address bar", "bud=" not in guest_page.evaluate("() => location.href"))
        guest_page.locator("[data-accept-bud]").click()
        guest_page.wait_for_timeout(300)
        added = guest_page.evaluate("() => window.Lahap.state.friends.filter((id) => id.startsWith('inv')).length")
        check("invite: accepting adds the sender as a bud", added == 1, added)
        guest_page.reload()
        guest_page.wait_for_selector("html[data-ready='1']")
        guest_page.wait_for_timeout(200)
        buds_text = guest_page.inner_text("#view-buds")
        check("invite: bud survives a reload", "Juwen" in buds_text and not guest_page.query_selector(".invite-in"), buds_text[:120])
        bad = guest.new_page()
        bad.goto(base + "?nosw=1&noquiz=1&bud=not-a-real-code#buds")
        bad.wait_for_selector("html[data-ready='1']")
        check("invite: a broken code is ignored", not bad.query_selector(".invite-in"))
        guest.close()

        # ---- share: a meal without a photo offers "+ Photo" (it picks one) and never selects Photo by itself (r17) ----
        photo_options = page.evaluate(
            """() => {
              const plain = window.Lahap.state.entries.find((e) => !e.photo);
              window.Lahap.openShare(plain);
              const button = document.querySelector('[data-seg=background][data-value=photo]');
              const result = { label: button ? button.textContent.trim() : null, pressed: button ? button.getAttribute('aria-pressed') : null };
              document.getElementById('dlg-share').close();
              return result;
            }"""
        )
        check("share: a meal without a photo offers '+ Photo' and does not start on it", photo_options["label"] == "+ Photo" and photo_options["pressed"] == "false", photo_options)


        # ---- nutrition, targets, recipes (pure logic) ----
        logic2 = page.evaluate(
            """() => {
              const N = window.LahapNutrition;
              const R = window.LahapRecipes;
              const male = N.targets({ sex: 'm', age: 30, height: 175, weight: 70, activity: 'light', goal: 'maintain' });
              const tiny = N.targets({ sex: 'f', age: 40, height: 150, weight: 45, activity: 'low', goal: 'lose' });
              const regular = N.estimate({ name: 'Nasi goreng kampung', plate: { veg: 1, protein: 1, carbs: 2 } });
              const large = N.estimate({ name: 'Nasi goreng kampung', plate: { veg: 1, protein: 1, carbs: 2 }, portion: 'l' });
              const unknown = N.estimate({ name: 'Mystery plate', plate: { veg: 2, protein: 1, carbs: 1 } });
              const fromRecipe = N.estimate({ name: 'x', nutrition: { kcal: 512, p: 40, c: 50, f: 12, fiber: 6 } });
              const parsed = R.parseIngredients('3 telur, tempe, kangkung dan nasi putih, bawang merah');
              const lose = R.suggest(['egg', 'rice'], { goal: 'lose', limit: 30 });
              const gain = R.suggest(['egg', 'rice'], { goal: 'gain', limit: 30 });
              const shared = lose.find((r) => gain.some((g) => g.id === r.id) && r.items.some((i) => i.id === 'rice'));
              const riceIn = (list, id) => list.find((r) => r.id === id).items.find((i) => i.id === 'rice').grams;
              const veg = R.suggest([], { diet: { vegetarian: true }, limit: 40 });
              const meaty = veg.filter((r) => r.items.some((i) => ['meat', 'fish', 'seafood', 'beef'].some((t) => R.INGREDIENTS[i.id].tags.includes(t))));
              const tips = N.mealTips({ plate: { veg: 0, protein: 1, carbs: 2, fried: true } }, regular, { goal: 'lose', sex: 'm', age: 30, height: 175, weight: 70 }, { kcal: 900, p: 30 });
              return {
                maleKcal: male.kcal, maleProtein: male.protein, tinyKcal: tiny.kcal,
                food: regular.food, regularKcal: regular.kcal, largeKcal: large.kcal, unknownSource: unknown.source, recipeKcal: fromRecipe.kcal,
                parsed, top: lose[0] && lose[0].id, topHasEgg: lose[0] && lose[0].items.some((i) => i.id === 'egg'),
                riceLose: shared ? riceIn(lose, shared.id) : 0, riceGain: shared ? riceIn(gain, shared.id) : 0,
                vegCount: veg.length, meaty: meaty.map((r) => r.id), tips,
              };
            }"""
        )
        # Mifflin-St Jeor: 10*70 + 6.25*175 - 5*30 + 5 = 1648.75; x1.375 = 2267 -> rounded to 2270
        check("targets: Mifflin-St Jeor maintain = 2270 kcal", logic2["maleKcal"] == 2270, logic2["maleKcal"])
        check("targets: protein 1.2 g/kg = 84 g", logic2["maleProtein"] == 84, logic2["maleProtein"])
        check("targets: weight-loss floor 1200 kcal", logic2["tinyKcal"] == 1200, logic2["tinyKcal"])
        check("estimate: matches nasi goreng", logic2["food"] == "Nasi goreng", logic2["food"])
        check("estimate: large portion is 1.4x", abs(logic2["largeKcal"] - logic2["regularKcal"] * 1.4) < 15, (logic2["regularKcal"], logic2["largeKcal"]))
        check("estimate: unknown dish uses plate model", logic2["unknownSource"] == "plate", logic2["unknownSource"])
        check("estimate: recipe nutrition wins", logic2["recipeKcal"] == 512, logic2["recipeKcal"])
        check("tips: lose goal gets fried + rice tips", len(logic2["tips"]) >= 2 and any("goreng" in t or "rice" in t for t in logic2["tips"]), logic2["tips"])
        check("parse: Indonesian list", set(logic2["parsed"]) >= {"egg", "tempeh", "kangkung", "rice", "shallot"} and "garlic" not in logic2["parsed"], logic2["parsed"])
        check("suggest: egg + rice ranks an egg recipe first", logic2["topHasEgg"], logic2["top"])
        check("suggest: lose uses less rice than gain", 0 < logic2["riceLose"] < logic2["riceGain"], (logic2["riceLose"], logic2["riceGain"]))
        check("suggest: vegetarian filter drops meat and fish", logic2["vegCount"] > 3 and not logic2["meaty"], logic2["meaty"])

        page.evaluate("() => location.hash = 'insights'")
        page.wait_for_timeout(200)
        tally_info = page.evaluate(
            """() => {
              const tally = document.querySelector('[data-view=insights] ol.taste-tally');
              const lead = document.querySelector('[data-view=insights] .taste-lead');
              const rows = tally ? [...tally.querySelectorAll('li')] : [];
              return {
                pcts: rows.map((row) => row.querySelector('.t-pct').textContent),
                names: rows.map((row) => row.querySelector('.t-name').textContent),
                leads: rows.filter((row) => row.classList.contains('lead')).map((row) => row.querySelector('.t-name').textContent.toLowerCase()),
                radar: document.querySelectorAll('[data-view=insights] svg.radar').length,
                lead: lead ? lead.textContent : '',
              };
            }"""
        )
        tally_values = [int(p.rstrip("%")) for p in tally_info["pcts"]] if all(p.endswith("%") for p in tally_info["pcts"]) else []
        check(
            "r19 insights: taste tally prints a % for every taste, sorted high to low, and names the lead tastes",
            len(tally_info["pcts"]) == 6
            and tally_values == sorted(tally_values, reverse=True)
            and tally_info["radar"] == 0
            and "lean" in tally_info["lead"],
            tally_info,
        )
        check(
            "r19 insights: the highlighted tally rows are the tastes the lead sentence names",
            len(tally_info["leads"]) >= 1 and all(name in tally_info["lead"].lower() for name in tally_info["leads"]),
            tally_info,
        )

        page.evaluate("() => location.hash = 'buds'")
        page.wait_for_timeout(200)
        points_info = page.evaluate(
            """() => {
              const view = document.querySelector('[data-view=buds]');
              const head = view.querySelector('.panel-head .pts');
              const rows = [...view.querySelectorAll('.panel .person .why')]
                .map((el) => (el.textContent.match(/(\\d+) pts/) || [])[1])
                .filter(Boolean)
                .map(Number);
              return { head: head ? parseInt(head.textContent, 10) : 0, rows };
            }"""
        )
        check(
            "buds: header connection pts equals the sum of the buds listed",
            points_info["rows"] and points_info["head"] == sum(points_info["rows"]),
            points_info,
        )

        # ---- r12: answer card is a 2x2 of four cells with a share action; buds header has an invite CTA; radar side labels anchor outward ----
        page.evaluate("() => location.hash = 'diary'")
        page.wait_for_timeout(200)
        r12_info = page.evaluate(
            """() => {
              const answer = document.querySelector('.answer.featured');
              const cells = answer ? answer.querySelectorAll('dl.answer-stats > div').length : 0;
              const share = answer ? answer.querySelectorAll('button[data-share]').length : 0;
              location.hash = 'buds';
              return { cells, share };
            }"""
        )
        page.wait_for_timeout(200)
        r12_info["invite"] = page.evaluate("() => document.querySelectorAll('[data-view=buds] .view-head [data-invite]').length")
        page.evaluate("() => location.hash = 'insights'")
        page.wait_for_timeout(200)
        r12_info["fills"] = page.evaluate("() => [...document.querySelectorAll('[data-view=insights] .bar-row .fill')].map((el) => getComputedStyle(el).backgroundImage)")
        check("r12 answer: four stat cells plus a Share card action", r12_info["cells"] == 4 and r12_info["share"] == 1, r12_info)
        check("r12 buds: header carries an Invite a friend button", r12_info["invite"] == 1, r12_info)
        check(
            "r19 insights: cuisine and money bars use the ticked tally fill",
            r12_info["fills"] and all("repeating-linear-gradient" in fill for fill in r12_info["fills"]),
            r12_info["fills"][:2],
        )

        # ---- r13: buds list honours "ranked by taste"; next-level card has a real progress bar; a known dish fills its cuisine ----
        page.evaluate("() => location.hash = 'buds'")
        page.wait_for_timeout(200)
        r13_buds = page.evaluate(
            """() => {
              const view = document.querySelector('[data-view=buds]');
              const matches = [...view.querySelectorAll('.panel .person .name .match')]
                .map((el) => parseInt(el.textContent, 10))
                .filter((n) => !Number.isNaN(n));
              const bar = view.querySelector('.next-level-card [role=progressbar]');
              const fill = bar ? bar.querySelector('.fill') : null;
              return {
                matches,
                hasBar: !!bar,
                now: bar ? Number(bar.getAttribute('aria-valuenow')) : -1,
                fillWidth: fill ? parseInt(fill.style.width, 10) : -1,
                barHeight: bar ? bar.querySelector('.track').getBoundingClientRect().height : 0,
              };
            }"""
        )
        check(
            "r13 buds: your buds are listed closest taste first, as the subtitle says",
            len(r13_buds["matches"]) >= 2 and r13_buds["matches"] == sorted(r13_buds["matches"], reverse=True),
            r13_buds["matches"],
        )
        check(
            "r13 buds: next-level card shows a progress bar that matches its aria value",
            r13_buds["hasBar"] and 0 <= r13_buds["now"] <= 100 and r13_buds["fillWidth"] == r13_buds["now"] and r13_buds["barHeight"] >= 8,
            r13_buds,
        )
        known = page.evaluate(
            """() => {
              const norm = (s) => String(s || '').trim().toLowerCase();
              const entries = window.Lahap.state.entries.slice().sort((a, b) => new Date(b.ts) - new Date(a.ts));
              const seen = new Set();
              for (const entry of entries) {
                const key = norm(entry.name);
                if (seen.has(key)) continue;
                seen.add(key);
                if (entry.cuisine) return { name: entry.name, cuisine: entry.cuisine };
              }
              return null;
            }"""
        )
        page.evaluate("() => location.hash = 'diary'")
        page.wait_for_timeout(150)
        page.locator(".fab").click()
        page.wait_for_selector("#log-form")
        page.fill("#log-form input[name=name]", known["name"] if known else "")
        page.wait_for_timeout(150)
        filled_cuisine = page.input_value("#log-form input[name=cuisine]")
        check(
            "r13 log: typing a dish you've had before fills its cuisine when the field is empty",
            known is not None and filled_cuisine == known["cuisine"],
            {"known": known, "filled": filled_cuisine},
        )
        page.fill("#log-form input[name=cuisine]", "Fusion")
        page.fill("#log-form input[name=name]", "")
        page.fill("#log-form input[name=name]", known["name"] if known else "")
        page.wait_for_timeout(150)
        check(
            "r13 log: a cuisine you typed yourself is never overwritten",
            page.input_value("#log-form input[name=cuisine]") == "Fusion",
            page.input_value("#log-form input[name=cuisine]"),
        )
        page.locator("#dlg-log [data-close]").first.click()
        page.wait_for_timeout(150)

        # ---- r14: '1 visit' singular; every bud names one concrete shared spot ----
        page.evaluate("() => location.hash = 'insights'")
        page.wait_for_timeout(200)
        visit_lines = page.evaluate("() => [...document.querySelectorAll('[data-view=insights] .person .why')].map((el) => el.textContent)")
        check(
            "r14 insights: a place visited once says '1 visit', never '1 visits'",
            visit_lines and not any(line.startswith("1 visits") for line in visit_lines)
            and all(re.match(r"^\d+ visits? ", line) for line in visit_lines),
            visit_lines,
        )
        page.evaluate("() => location.hash = 'buds'")
        page.wait_for_timeout(200)
        spots = page.evaluate(
            """() => {
              const panels = [...document.querySelectorAll('[data-view=buds] .panel')];
              const mine = panels.find((p) => /Your buds/.test((p.querySelector('h2') || {}).textContent || ''));
              const suggested = panels.find((p) => /Suggested by taste|Demo matches/.test((p.querySelector('h2') || {}).textContent || ''));
              const rows = (panel) => panel ? [...panel.querySelectorAll('.person')].map((row) => (row.querySelector('.spot') || {}).textContent || '') : [];
              return { buds: rows(mine), suggested: rows(suggested) };
            }"""
        )
        check(
            "r14 buds: each bud you've eaten with shows your usual spot and dish together",
            spots["buds"] and all(s.startswith("Your spot: ") for s in spots["buds"]),
            spots["buds"],
        )
        check(
            "r14 buds: suggestions name a real place of yours in a cuisine they like",
            any(s.startswith("Try ") and " together · they like " in s for s in spots["suggested"]),
            spots["suggested"],
        )

        # ---- r15: the featured bud's progress lives only in the Next level card; the plate-score rule leads its panel ----
        page.evaluate("() => location.hash = 'buds'")
        page.wait_for_timeout(200)
        dedupe = page.evaluate(
            """() => {
              const view = document.querySelector('[data-view=buds]');
              const card = view.querySelector('.next-level-card');
              const name = card ? (card.querySelector('[data-tag-meal]') || {}).dataset.tagMeal : null;
              const rows = [...view.querySelectorAll('.panel .person')].filter((row) => row.querySelector('[data-remove]'));
              const featured = rows.find((row) => row.querySelector('[data-remove]').dataset.remove === name);
              const others = rows.filter((row) => row !== featured);
              return {
                name,
                featuredBars: featured ? featured.querySelectorAll('.level').length : -1,
                featuredNote: featured ? !!featured.querySelector('.featured-note') : false,
                othersBars: others.map((row) => row.querySelectorAll('.level').length),
              };
            }"""
        )
        check(
            "r15 buds: the bud featured in Next level has no second progress bar in their row",
            dedupe["name"] and dedupe["featuredBars"] == 0 and dedupe["featuredNote"] and all(n == 1 for n in dedupe["othersBars"]),
            dedupe,
        )
        page.evaluate("() => location.hash = 'insights'")
        page.wait_for_timeout(200)
        rule = page.evaluate(
            """() => {
              const panel = [...document.querySelectorAll('[data-view=insights] .panel')].find((p) => /Plate score by day/.test(p.textContent));
              if (!panel) return null;
              const ruleEl = panel.querySelector('.score-rule');
              const h2 = panel.querySelector('h2');
              return { has: !!ruleEl, text: ruleEl ? ruleEl.textContent : '', afterHeading: !!(ruleEl && h2 && h2.nextElementSibling === ruleEl) };
            }"""
        )
        check("r15 insights: the plate-score rule sits right under its heading, with the bands", rule and rule["has"] and rule["afterHeading"] and "75+" in rule["text"], rule)

        # ---- r20: folded score method, day chips, bigger log plate, buds strip + legend, meal photo on Stats, till-receipt stamp ----
        rule20 = page.evaluate(
            """() => {
              const el = document.querySelector('[data-view=insights] details.score-rule');
              if (!el) return null;
              return { open: el.open, summary: el.querySelector('summary').textContent, method: el.querySelector('p').textContent };
            }"""
        )
        check(
            "r20 insights: the plate bands stay in view and the method folds away by default",
            rule20 and not rule20["open"] and "75+ Balanced" in rule20["summary"] and "under 50 Heavy" in rule20["summary"] and "Veg and protein" in rule20["method"],
            rule20,
        )
        page.goto(base + "#diary")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(200)
        chips = page.evaluate(
            """() => [...document.querySelectorAll('#view-diary .day-head')].slice(0, 1).map((head) => {
              const list = [...head.querySelectorAll('.day-chip')];
              return { count: list.length, texts: list.map((c) => c.textContent), scored: list.length ? ['good', 'ok', 'heavy'].some((band) => list[list.length - 1].classList.contains(band)) : false };
            })[0] || null"""
        )
        check(
            "r20 diary: the day summary is three labelled chips and the plate chip carries its band colour",
            chips and chips["count"] == 3 and re.search(r"\d+ meals?", chips["texts"][0]) and chips["texts"][1].startswith("IDR") and chips["scored"],
            chips,
        )
        page.locator(".fab").click()
        page.wait_for_selector("#log-form")
        page.wait_for_timeout(300)
        preview = page.evaluate("() => { const r = document.getElementById('log-preview').getBoundingClientRect(); return { w: r.width, h: r.height }; }")
        check("r20 log: the plate preview on a phone is at least 120px so the balance reads", preview["w"] >= 120 and preview["h"] >= 120, preview)
        page.locator("#dlg-log [data-close]").first.click()
        page.wait_for_timeout(150)
        page.goto(base + "#buds")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(300)
        strip = page.evaluate(
            """() => {
              const s = document.querySelector('#view-buds .buds-strip');
              const next = document.querySelector('#view-buds .next-level-card');
              const legend = document.querySelector('#view-buds .buds-legend');
              const friends = window.Lahap.state.friends.length;
              return {
                visible: !!(s && s.checkVisibility()),
                names: s ? s.querySelectorAll('.buds-strip-name').length : 0,
                friends,
                above: !!(s && next && s.getBoundingClientRect().top < next.getBoundingClientRect().top),
                inFold: !!(s && s.getBoundingClientRect().bottom <= window.innerHeight),
                legend: legend ? legend.textContent : '',
              };
            }"""
        )
        check(
            "r20 buds: on a phone a 'Your buds' strip sits above the fold, before Next level, naming each bud",
            strip["visible"] and strip["above"] and strip["inFold"] and strip["names"] == min(strip["friends"], 5) and strip["names"] > 0,
            strip,
        )
        check("r20 buds: a legend says match % is taste and connection pts are meals together", "Match %" in strip["legend"] and "Connection pts" in strip["legend"], strip["legend"])
        hero = page.evaluate(
            """async () => {
              const entry = window.Lahap.state.entries.find(e => e.name === 'Tom yum seafood');
              const keep = { photo: entry.photo, cutout: entry.cutout };
              const render = async () => {
                window.Lahap.openShare(entry);
                document.querySelector('[data-seg=template][data-value=stats]').click();
                document.querySelector('[data-seg=background][data-value=ink]').click();
                for (let i = 0; i < 30; i++) {
                  await new Promise(r => setTimeout(r, 100));
                  if (window.Lahap.drawShare.statsHero) break;
                }
                const kind = window.Lahap.drawShare.statsHero;
                window.Lahap.drawShare.statsHero = null;
                document.getElementById('dlg-share').close();
                return kind;
              };
              entry.photo = null;
              entry.cutout = null;
              const plain = await render();
              entry.photo = 'tests/fixtures/plate.jpg';
              const withPhoto = await render();
              entry.cutout = 'tests/fixtures/plate.jpg';
              const withCutout = await render();
              entry.photo = keep.photo;
              entry.cutout = keep.cutout;
              window.Lahap.openShare(entry);
              document.querySelector('[data-seg=template][data-value=receipt]').click();
              await new Promise(r => setTimeout(r, 300));
              const stamp = window.Lahap.drawShare.receiptStamp;
              document.getElementById('dlg-share').close();
              return { plain, withPhoto, withCutout, stamp };
            }"""
        )
        check(
            "r20 share: the Stats card puts the meal's own cut-out or photo in the score ring, the drawn plate only as a fallback",
            hero["plain"] == "plate" and hero["withPhoto"] == "photo" and hero["withCutout"] == "cutout",
            hero,
        )
        check(
            "r20 share: the Receipt card rubber-stamps the plate score with its band",
            bool(re.fullmatch(r"PLATE \d+ · (BALANCED|OKAY|HEAVY)", hero["stamp"] or "")),
            hero["stamp"],
        )

        # ---- r22: a new view opens at its top, one-row phone pulse, share actions always on screen ----
        page.goto(base + "#diary")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(250)
        strip23 = page.evaluate(
            """() => [...document.querySelectorAll('#view-diary .week-strip .ws-label')].map((l) => l.textContent.trim())"""
        )
        check("r23 diary: the phone week strip says Variety and Plate are out of 100", any(s.startswith("Variety") and "/100" in s for s in strip23) and any(s.startswith("Plate") and "/100" in s for s in strip23), strip23)
        # ---- r24: louder buds pulse with a meter and taste ring, Receipt-first share, shorter log sheet ----
        page.reload()
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(300)
        pulse24 = page.evaluate(
            """() => {
              const p = document.querySelector('#view-diary .lead-day .day-pulse');
              if (!p) return null;
              const meter = p.querySelector('.pulse-meter > span');
              const av = p.querySelector('.avatar');
              return {
                meter: meter ? Math.round(meter.getBoundingClientRect().width) : 0,
                ring: av ? getComputedStyle(av).boxShadow : '',
                taste: av ? av.dataset.taste || '' : '',
                edge: getComputedStyle(p).borderLeftWidth,
                height: Math.round(p.getBoundingClientRect().height),
              };
            }"""
        )
        check(
            "r24 diary: the buds pulse has a progress meter, a solid accent edge and a top-taste ring, still one compact row",
            pulse24 and pulse24["meter"] > 0 and pulse24["edge"] == "4px" and pulse24["taste"] != "" and "rgb" in pulse24["ring"] and pulse24["height"] < 84,
            pulse24,
        )
        share24 = page.evaluate(
            """async () => {
              const btn = document.querySelector('#view-diary .ticket-share');
              if (!btn) return null;
              btn.click();
              await new Promise((r) => setTimeout(r, 500));
              const t = document.querySelector('#dlg-share [data-seg=template][aria-pressed=true]');
              const bg = document.querySelector('#dlg-share [data-seg=background][aria-pressed=true]');
              return { tpl: t ? t.dataset.value : null, bg: bg ? bg.dataset.value : null };
            }"""
        )
        check(
            "r24 share: a meal's first share opens on the Receipt (the photo Card only when the meal has its own photo)",
            share24 and share24["tpl"] == ("card" if share24["bg"] == "photo" else "receipt"),
            share24,
        )
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        page.locator(".fab").click()
        page.wait_for_selector("#log-form")
        page.wait_for_timeout(250)
        log24 = page.evaluate(
            """() => {
              const f = document.getElementById('log-form');
              const ts = f.querySelector('input[name=ts]');
              const cuisine = f.querySelector('input[name=cuisine]');
              const price = f.querySelector('input[name=price]');
              return {
                whenFolded: !!(ts && ts.closest('#log-more')),
                sameRow: !!(cuisine && price && cuisine.closest('.row') && cuisine.closest('.row') === price.closest('.row')),
                priceVisible: !!(price && price.checkVisibility()),
                sum: document.getElementById('log-more-sum').textContent,
              };
            }"""
        )
        check(
            "r24 log: the time folds into More details, price sits beside cuisine, and the fold says it holds the time",
            log24["whenFolded"] and log24["sameRow"] and log24["priceVisible"] and "time" in log24["sum"],
            log24,
        )
        page.locator("#dlg-log [data-close]").first.click()
        page.wait_for_timeout(150)
        # ---- r25: calmer phone Diary - verdict-first plate chip, legend in the chip, one-idea pulse, torn search answer ----
        calm25 = page.evaluate(
            """async () => {
              const day = document.querySelector('#view-diary .lead-day .day');
              const key = day ? day.querySelector('.plate-key') : null;
              const chip = day ? day.querySelector('.day-chip.score') : null;
              const verdict = chip ? chip.querySelector('.verdict') : null;
              const extra = document.querySelector('#view-diary .day-pulse .pulse-extra');
              // read everything on the resting Diary first - a search re-renders the view
              const result = {
                keyShown: !!(key && key.checkVisibility()),
                title: chip ? chip.title : '',
                verdictWeight: verdict ? Number(getComputedStyle(verdict).fontWeight) : 0,
                extraShown: !!(extra && extra.checkVisibility()),
                torn: false,
              };
              const type = async (text) => {
                const q = document.getElementById('q');
                q.value = text;
                q.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise((r) => setTimeout(r, 400));
              };
              await type('nasi lemak');
              const ans = document.querySelector('#view-diary .answer');
              if (ans) {
                const cs = getComputedStyle(ans);
                result.torn = (cs.maskImage || cs.webkitMaskImage || '').includes('radial-gradient');
              }
              await type('');
              result.pulseBack = !!document.querySelector('#view-diary .day-pulse');
              return result;
            }"""
        )
        check(
            "r25 diary: on a phone the band legend folds into the plate chip, the verdict is bold, the pulse is one idea per line, and the search answer is a torn slip",
            not calm25["keyShown"] and "75+ Balanced" in calm25["title"] and calm25["verdictWeight"] >= 700 and not calm25["extraShown"] and calm25["torn"] and calm25["pulseBack"],
            calm25,
        )
        scroll22 = page.evaluate(
            """async () => {
              window.scrollTo(0, 1400);
              await new Promise(r => setTimeout(r, 100));
              const before = window.scrollY;
              location.hash = '#insights';
              await new Promise(r => setTimeout(r, 300));
              const after = window.scrollY;
              location.hash = '#diary';
              await new Promise(r => setTimeout(r, 300));
              return { before, after };
            }"""
        )
        check("r22 nav: switching views from a scrolled Diary opens Insights at its top", scroll22["before"] > 300 and scroll22["after"] == 0, scroll22)
        pulse22 = page.evaluate(
            """() => {
              const p = document.querySelector('#view-diary .lead-day .day-pulse');
              if (!p) return null;
              const r = p.getBoundingClientRect();
              const tag = p.querySelector('[data-tag-meal]').getBoundingClientRect();
              const share = p.querySelector('[data-share]');
              const sr = share.getBoundingClientRect();
              return {
                height: Math.round(r.height),
                oneRow: Math.abs((tag.top + tag.height / 2) - (sr.top + sr.height / 2)) < 4 && tag.top < r.top + r.height / 2,
                shareW: Math.round(sr.width),
                shareName: share.getAttribute('aria-label') || '',
              };
            }"""
        )
        check(
            "r22 diary: on a phone the buds pulse is one compact row (Tag + icon Share, labelled for screen readers)",
            pulse22 and pulse22["height"] <= 80 and pulse22["oneRow"] and pulse22["shareW"] <= 48 and pulse22["shareName"].startswith("Share"),
            pulse22,
        )
        actions22 = page.evaluate(
            """async () => {
              window.Lahap.openShare(window.Lahap.state.entries.find(e => e.name === 'Tom yum seafood'));
              await new Promise(r => setTimeout(r, 500));
              const save = document.getElementById('share-save');
              const r = save.getBoundingClientRect();
              const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              const size = document.querySelector('#dlg-share [data-seg=size]').closest('.seg') || document.querySelector('#dlg-share [data-seg=size]');
              const sizeBottom = Math.round(size.getBoundingClientRect().bottom);
              const out = { bottom: Math.round(r.bottom), top: Math.round(r.top), sizeBottom, vh: window.innerHeight, hit: !!hit && save.contains(hit) };
              document.getElementById('dlg-share').close();
              return out;
            }"""
        )
        check("r22 share: Save PNG is on screen and tappable as soon as the share sheet opens on a phone, with Size still clear above it", actions22["bottom"] <= actions22["vh"] and actions22["hit"] and actions22["sizeBottom"] <= actions22["top"], actions22)

        # ---- r21: diary pulse (tag a bud, share the day), match % on Ate with, photo card hero, recipe tickets, desk buds order ----
        page.goto(base + "#diary")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(250)
        pulse = page.evaluate(
            """() => {
              const day = document.querySelector('#view-diary .lead-day .day');
              const p = day ? day.querySelector('.day-pulse') : null;
              if (!p) return null;
              const r = p.getBoundingClientRect();
              const tag = p.querySelector('[data-tag-meal]');
              const share = p.querySelector('[data-share]');
              return {
                inFold: r.top >= 0 && r.bottom <= window.innerHeight,
                tag: tag ? tag.dataset.tagMeal : null,
                tagLabel: tag ? tag.textContent.trim() : '',
                share: share ? share.dataset.share : null,
                firstMeal: day.querySelector('.ticket').dataset.open,
                text: p.textContent,
                tapOk: [...p.querySelectorAll('.btn')].every((b) => b.getBoundingClientRect().height >= 44),
              };
            }"""
        )
        check(
            "r21 diary: the first screen on a phone has a buds pulse with a Tag button and a Share button for the day",
            pulse and pulse["inFold"] and pulse["tag"] and pulse["tagLabel"].startswith("Tag ") and pulse["share"] == pulse["firstMeal"] and "pts to" in pulse["text"] and pulse["tapOk"],
            pulse,
        )
        page.locator("#view-diary .day-pulse [data-tag-meal]").click()
        page.wait_for_selector("#log-form")
        page.wait_for_timeout(300)
        tagged = page.evaluate(
            """() => {
              const boxes = [...document.querySelectorAll('#log-form input[name=friend]')];
              return {
                checked: boxes.filter((b) => b.checked).map((b) => b.value),
                matches: [...document.querySelectorAll('#log-form .ate-with .chip-match')].map((m) => m.textContent),
                chips: boxes.length,
              };
            }"""
        )
        check("r21 diary: Tag in the pulse opens Log a meal with that bud already ticked", pulse and tagged["checked"] == [pulse["tag"]], tagged)
        check(
            "r21 log: every Ate with chip shows its taste match %",
            tagged["chips"] > 0 and len(tagged["matches"]) == tagged["chips"] and all(re.fullmatch(r"\d{1,3}%", m) for m in tagged["matches"]),
            tagged,
        )
        page.locator("#dlg-log [data-close]").first.click()
        page.wait_for_timeout(150)
        photo21 = page.evaluate(
            """async () => {
              const entry = window.Lahap.state.entries.find(e => e.name === 'Tom yum seafood');
              const keep = entry.photo;
              entry.photo = 'tests/fixtures/plate.jpg';
              window.Lahap.openShare(entry);
              document.querySelector('[data-seg=template][data-value=card]').click();
              document.querySelector('[data-seg=size][data-value=story]').click();
              document.querySelector('[data-seg=background][data-value=photo]').click();
              let hero = null;
              for (let i = 0; i < 40; i++) {
                await new Promise(r => setTimeout(r, 100));
                hero = window.Lahap.drawShare.photoHero;
                if (hero) break;
              }
              const stamp = window.Lahap.drawShare.stamp;
              const note = document.querySelector('#dlg-share .share-note');
              const noteText = note ? note.textContent : '';
              document.getElementById('dlg-share').close();
              entry.photo = keep;
              return { hero, stamp, noteText };
            }"""
        )
        h21 = photo21["hero"]
        s21 = photo21["stamp"]
        check(
            "r21 share: the Photo card shows the meal sharp on a round plate over its own blurred copy, stamp on the rim",
            h21 and h21["r"] > 200 and s21 and abs(math.hypot(s21["x"] - h21["x"], s21["y"] - h21["y"]) - h21["r"]) < 8,
            photo21,
        )
        check("r21 share: the sheet footnote is one short line", 0 < len(photo21["noteText"]) <= 90, photo21["noteText"])
        page.goto(base + "#lab")
        page.wait_for_selector("html[data-ready='1']")
        page.wait_for_timeout(300)
        rx = page.evaluate(
            """() => {
              const card = document.querySelector('#view-lab .recipe');
              if (!card) return null;
              const stub = card.querySelector('.recipe-stub');
              const plate = card.querySelector('img.recipe-plate');
              const lis = [...card.querySelectorAll('.ingredients li')];
              return {
                ticket: card.classList.contains('recipe-ticket'),
                plate: !!(plate && plate.naturalWidth > 0),
                stub: stub ? stub.textContent.replace(/\s+/g, ' ').trim() : '',
                score: !!(stub && stub.querySelector('.score')),
                eyebrow: (card.querySelector('.recipe-head .eyebrow') || {}).textContent || '',
                slip: lis.length ? getComputedStyle(lis[0], '::before').content : '',
                overflow: card.scrollWidth > card.clientWidth + 1,
              };
            }"""
        )
        check(
            "r21 recipes: each recipe is a ticket with its plate, a stub (min, kcal, protein, plate score) and a numbered eyebrow",
            rx and rx["ticket"] and rx["plate"] and re.search(r"\d+ min", rx["stub"]) and "kcal" in rx["stub"] and "prot" in rx["stub"] and rx["score"] and rx["eyebrow"].startswith("Resep no. 01") and not rx["overflow"],
            rx,
        )
        check("r21 recipes: ingredients read as a tick-box slip", rx and rx["slip"] in ('"\u2610"', '"\u2611"', '"☐"', '"☑"'), rx and rx["slip"])
        desk21 = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        desk21_page = desk21.new_page()
        desk21_page.goto(base + "?demo=1&nosw=1#buds")
        desk21_page.wait_for_selector("html[data-ready='1']")
        desk21_page.wait_for_timeout(300)
        buds21 = desk21_page.evaluate(
            """() => {
              const sug = document.querySelector('#view-buds .suggested-panel');
              const inv = document.querySelector('#view-buds .invite-card');
              return {
                inAside: !!(inv && inv.closest('aside')),
                sugTop: sug ? sug.getBoundingClientRect().top : 9999,
                fold: window.innerHeight,
              };
            }"""
        )
        # ---- r23: Taste buds / Insights cards are receipt slips, Add says what it does, On repeat is compact ----
        buds23 = desk21_page.evaluate(
            """() => {
              const panel = document.querySelector('#view-buds .suggested-panel');
              const add = panel ? panel.querySelector('[data-add]') : null;
              const cs = panel ? getComputedStyle(panel) : null;
              const mask = cs ? (cs.maskImage || cs.webkitMaskImage || '') : '';
              return {
                addText: add ? add.textContent.trim() : '',
                addLabel: add ? add.getAttribute('aria-label') || '' : '',
                torn: mask.includes('radial-gradient'),
              };
            }"""
        )
        check(
            "r23 buds: Suggested 'Add bud' says what it does, and the cards have a torn receipt edge",
            buds23["addText"] == "Add bud" and "as a bud" in buds23["addLabel"] and buds23["torn"],
            buds23,
        )
        desk21_page.goto(base + "?demo=1&nosw=1#insights")
        desk21_page.wait_for_selector("html[data-ready='1']")
        desk21_page.wait_for_timeout(300)
        ins23 = desk21_page.evaluate(
            """() => {
              const panels = [...document.querySelectorAll('#view-insights .panel')];
              const torn = panels.filter((p) => {
                const cs = getComputedStyle(p);
                return (cs.maskImage || cs.webkitMaskImage || '').includes('radial-gradient');
              }).length;
              const rep = [...document.querySelectorAll('#view-insights h3')].find((h) => h.textContent.startsWith('On repeat'));
              return { panels: panels.length, torn, repeat: rep ? rep.textContent : '' };
            }"""
        )
        check(
            "r23 insights: every card is a torn receipt slip and On repeat names its period",
            ins23["panels"] >= 4 and ins23["torn"] == ins23["panels"] and ("last 7 days" in ins23["repeat"] or "all time" in ins23["repeat"] or ins23["repeat"] == ""),
            ins23,
        )
        desk21_page.goto(base + "?demo=1&nosw=1#diary")
        desk21_page.wait_for_selector("html[data-ready='1']")
        desk21_page.wait_for_timeout(300)
        feat23 = desk21_page.evaluate(
            """() => {
              const f = document.querySelector('#view-diary .answer.featured');
              const today = document.querySelector('#view-diary .lead-day');
              return f ? {
                height: Math.round(f.getBoundingClientRect().height),
                eyebrow: (f.querySelector('.eyebrow') || {}).textContent || '',
                todayTop: today ? Math.round(today.getBoundingClientRect().top) : 9999,
                note: (document.querySelector('#view-diary aside .notice') || {}).textContent || '',
              } : null;
            }"""
        )
        check(
            "r23 diary: the desktop On repeat card is compact, says 'all time', and the week aside says 'this week'",
            feat23 and feat23["height"] <= 330 and "all time" in feat23["eyebrow"] and feat23["todayTop"] < 900 and (feat23["note"] == "" or "this week" in feat23["note"]),
            feat23,
        )
        desk21_page.goto(base + "?demo=1&nosw=1#buds")
        desk21_page.wait_for_selector("html[data-ready='1']")
        desk21_page.wait_for_timeout(300)
        buds24 = desk21_page.evaluate(
            """() => {
              const why = document.querySelector('#view-buds .suggested-why');
              const ringed = document.querySelectorAll('#view-buds .avatar.ringed').length;
              const avatars = document.querySelectorAll('#view-buds .avatar').length;
              return { why: why ? why.textContent : '', ringed, avatars };
            }"""
        )
        check(
            "r24 buds: suggested buds say where they come from, and every bud avatar wears a taste ring",
            "invite" in buds24["why"] and "this phone" in buds24["why"] and buds24["avatars"] > 0 and buds24["ringed"] == buds24["avatars"],
            buds24,
        )
        desk21_page.goto(base + "?demo=1&nosw=1#diary")
        desk21_page.wait_for_selector("html[data-ready='1']")
        desk21_page.wait_for_timeout(300)
        week25 = desk21_page.evaluate(
            """() => {
              const p = document.querySelector('#view-diary aside.panel');
              const key = document.querySelector('#view-diary .plate-key');
              if (!p) return null;
              const cs = getComputedStyle(p);
              return { torn: (cs.maskImage || cs.webkitMaskImage || '').includes('radial-gradient'), keyShown: !!(key && key.checkVisibility()) };
            }"""
        )
        check(
            "r25 diary desk: the week panel is a torn receipt slip and the desktop keeps the plate legend line",
            week25 and week25["torn"] and week25["keyShown"],
            week25,
        )
        desk21_page.goto(base + "?demo=1&nosw=1#diary")
        desk21_page.wait_for_selector("html[data-ready='1']")
        desk21_page.wait_for_timeout(300)
        pair21 = desk21_page.evaluate(
            """() => {
              const day = document.querySelector('#view-diary .lead-day .day');
              const t = day ? [...day.querySelectorAll(':scope > .ticket-wrap > .ticket')] : [];
              const tops = t.map((x) => Math.round(x.getBoundingClientRect().top));
              const hs = t.map((x) => Math.round(x.getBoundingClientRect().height));
              return { n: t.length, tops, hs };
            }"""
        )
        desk21.close()
        check("r21 buds desk: Bring a real friend moves to the side rail so Suggested by taste comes up the page", buds21["inAside"] and buds21["sugTop"] < 1400, buds21)
        check(
            "r21 diary desk: two tickets side by side are the same height",
            pair21["n"] < 2 or (pair21["tops"][0] != pair21["tops"][1]) or abs(pair21["hs"][0] - pair21["hs"][1]) <= 1,
            pair21,
        )

        # ---- first run: quiz, lab, cutout, OCR in a clean browser profile ----
        fresh = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, permissions=["clipboard-read", "clipboard-write"])
        page2 = fresh.new_page()
        errors2 = []
        page2.on("pageerror", lambda error: errors2.append(str(error)))
        page2.on("console", lambda message: errors2.append(message.text) if message.type == "error" else None)
        page2.goto(base + "?nosw=1")
        page2.wait_for_selector("html[data-ready='1']")
        check("quiz opens on first run", page2.evaluate("() => document.getElementById('dlg-quiz').open"))
        page2.locator("[data-quiz-goal=lose]").click()
        page2.locator("#dlg-quiz [data-seg=sex][data-value=m]").click()
        page2.fill("#quiz-age", "30")
        page2.fill("#quiz-height", "175")
        page2.fill("#quiz-weight", "70")
        page2.locator("[data-quiz-next]").click()
        page2.locator("[data-quiz-activity=light]").click()
        page2.locator("[data-quiz-next]").click()
        page2.locator("#dlg-quiz input[value=vegetarian]").check()
        page2.locator("[data-quiz-next]").click()
        summary = page2.inner_text("#dlg-quiz .sheet-body")
        check("quiz summary shows targets (2270 - 450 = 1820 kcal)", "1820" in summary and "112" in summary, summary[:120])
        page2.locator("[data-quiz-next]").click()
        page2.wait_for_timeout(200)
        prof = page2.evaluate("() => window.Lahap.state.settings.profile")
        check("quiz saves goal and diet", prof and prof["goal"] == "lose" and prof["diet"].get("vegetarian") is True, prof)
        page2.reload()
        page2.wait_for_selector("html[data-ready='1']")
        check("quiz does not reopen after finishing", not page2.evaluate("() => document.getElementById('dlg-quiz').open"))
        page2.evaluate("() => location.hash = 'me'")
        page2.wait_for_timeout(150)
        check("Profile shows goal and retake", "Retake the quiz" in page2.inner_text("#view-me") and "1820" in page2.inner_text("#view-me"))

        # lab: typed list -> recipes for the goal, vegetarian respected, log as meal
        page2.evaluate("() => location.hash = 'lab'")
        page2.wait_for_selector("#lab-text")
        page2.fill("#lab-text", "telur, tempe, kangkung, nasi")
        page2.locator("[data-lab-find]").click()
        page2.wait_for_timeout(150)
        have = page2.evaluate("() => window.Lahap.state.lab.have")
        check("lab: typed list detected", set(have) >= {"egg", "tempeh", "kangkung", "rice"}, have)
        cards = page2.locator(".recipe").count()
        names = page2.locator(".recipe h3").all_inner_texts()
        check("lab: 3 recipes", cards == 3, cards)
        check("lab: vegetarian recipes only", not any(word in " ".join(names).lower() for word in ("ayam", "chicken", "beef", "fish", "ikan", "udang")), names)
        page2.locator("[data-lab-remove=rice]").click()
        check("lab: remove chip", "rice" not in page2.evaluate("() => window.Lahap.state.lab.have"))
        page2.locator("[data-lab-add=rice]").click()
        page2.locator("[data-lab-log]").first.click()
        page2.wait_for_selector("#log-form")
        logged_name = page2.input_value("#log-form input[name=name]")
        nutri_text = page2.inner_text("#log-nutri")
        check("lab: log prefilled with recipe", logged_name == names[0], (logged_name, names[0]))
        check("lab: log shows recipe nutrition", "From the Lab recipe" in nutri_text, nutri_text[:80])
        page2.locator("#log-form button[type=submit]").click()
        page2.wait_for_timeout(300)
        saved = page2.evaluate("() => window.Lahap.state.entries.find((e) => e.recipe)")
        check("lab: cooked meal saved with nutrition", saved and saved["source"] == "home" and saved["nutrition"]["kcal"] > 0, saved and saved.get("nutrition"))

        # diary: today bar against targets
        page2.evaluate("() => location.hash = 'diary'")
        page2.wait_for_selector(".today")
        today_text = page2.inner_text(".today")
        check("diary: today bar vs 1820 kcal", "/ 1820 kcal" in today_text, today_text[:80])

        # cutout: real photo through the log form, model runs on device
        page2.locator("[data-action=log]:visible").first.click()
        page2.wait_for_selector("#log-form")
        page2.evaluate(
            """() => {
                window.__photoStatuses = [];
                const node = document.getElementById('photo-status');
                new MutationObserver(() => window.__photoStatuses.push(node.textContent))
                    .observe(node, { childList: true, characterData: true, subtree: true });
            }"""
        )
        page2.set_input_files("#log-photo", str(ROOT / "tests" / "fixtures" / "plate.jpg"))
        page2.wait_for_selector("#cut-toggle:not([hidden])", timeout=90000)
        statuses = page2.evaluate("() => window.__photoStatuses")
        progress_lines = [line for line in statuses if " of " in line and "MB" in line]
        check("cutout: first run shows model download progress in MB", len(progress_lines) >= 2, statuses[:4])
        status = page2.inner_text("#photo-status")
        preview = page2.evaluate("() => { const p = document.getElementById('log-preview'); return { cut: p.classList.contains('cut'), src: p.src.slice(0, 22) }; }")
        check("cutout: model removed the background", "cut out on this device" in status, status)
        check("cutout: preview shows the transparent cutout", preview["cut"] and preview["src"].startswith(("data:image/webp", "data:image/png")), preview)
        alpha = page2.evaluate(
            """async () => {
              const img = new Image();
              img.src = document.getElementById('log-preview').src;
              await img.decode();
              const c = document.createElement('canvas');
              c.width = img.width;
              c.height = img.height;
              const ctx = c.getContext('2d');
              ctx.drawImage(img, 0, 0);
              const d = ctx.getImageData(0, 0, c.width, c.height).data;
              let clear = 0;
              let solid = 0;
              for (let i = 3; i < d.length; i += 4) {
                if (d[i] < 10) clear++;
                if (d[i] > 245) solid++;
              }
              const corner = ctx.getImageData(2, 2, 1, 1).data[3];
              const centre = ctx.getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3];
              return { clear: clear / (d.length / 4), solid: solid / (d.length / 4), corner, centre };
            }"""
        )
        check("cutout: corners transparent, food solid", alpha["corner"] < 10 and alpha["centre"] > 245 and alpha["clear"] > 0.1, alpha)
        plate_note = page2.inner_text("#plate-source")
        check("cutout: plate guessed from colours", "colours" in plate_note, plate_note)
        page2.fill("#log-form input[name=name]", "Nasi goreng test")
        page2.locator("#log-form input[name=name]").dispatch_event("change")
        check("dish name sets the plate from the food table", "typical nasi goreng" in page2.inner_text("#plate-source"), page2.inner_text("#plate-source"))
        page2.locator("#log-form [data-seg=photoview][data-value=full]").click()
        check("cutout: Original toggle restores the photo", not page2.evaluate("() => document.getElementById('log-preview').classList.contains('cut')"))
        page2.locator("#log-form [data-seg=photoview][data-value=cut]").click()
        page2.locator("#log-form button[type=submit]").click()
        page2.wait_for_timeout(300)
        cut_entry = page2.evaluate("() => { const e = window.Lahap.state.entries.find((x) => x.name === 'Nasi goreng test'); return e && { cut: !!e.cutout, photo: !!e.photo }; }")
        check("cutout: saved with the original kept", cut_entry == {"cut": True, "photo": True}, cut_entry)
        page2.locator(".ticket", has_text="Nasi goreng test").click()
        page2.wait_for_selector("#dlg-detail .nutri .macros")
        detail_text = page2.inner_text("#dlg-detail")
        check("detail: nutrition and tips shown", "Estimated nutrition" in detail_text and "kcal" in detail_text)
        check("detail: food-only photo with original toggle", page2.locator("#detail-swap").count() == 1)
        # Safari only opens the share sheet while the tap is still active (about 5 s). Make PNG encoding slower
        # than that and record whether share() is called with the activation intact.
        page2.evaluate(
            """() => {
              window.__shareCalls = [];
              window.__realToBlob = HTMLCanvasElement.prototype.toBlob;
              HTMLCanvasElement.prototype.toBlob = function (callback, ...rest) {
                return window.__realToBlob.call(this, (blob) => setTimeout(() => callback(blob), 6000), ...rest);
              };
              Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
              Object.defineProperty(navigator, 'share', {
                configurable: true,
                value: async (data) => {
                  const file = data.files[0];
                  window.__shareCalls.push({ active: navigator.userActivation.isActive, type: file.type, size: file.size });
                },
              });
            }"""
        )
        page2.locator("#dlg-detail [data-share]").click()
        page2.wait_for_timeout(500)
        check("share: card draws the cutout", page2.evaluate("() => document.querySelector('#dlg-share canvas') !== null"))
        page2.locator("#share-send").click(timeout=20000)
        page2.wait_for_timeout(300)
        share_calls = page2.evaluate("() => window.__shareCalls")
        check(
            "share: sheet opens from the tap even when the PNG is slow (Safari 5 s rule)",
            len(share_calls) == 1 and share_calls[0]["active"] and share_calls[0]["type"] == "image/png" and share_calls[0]["size"] > 10000,
            share_calls,
        )
        page2.evaluate("() => { HTMLCanvasElement.prototype.toBlob = window.__realToBlob; }")
        page2.evaluate("() => document.getElementById('dlg-share').close()")

        # OCR: a written list read on the device with Tesseract
        ocr_text = page2.evaluate(
            """async () => {
              const c = document.createElement('canvas');
              c.width = 640;
              c.height = 300;
              const ctx = c.getContext('2d');
              ctx.fillStyle = '#fff';
              ctx.fillRect(0, 0, c.width, c.height);
              ctx.fillStyle = '#111';
              ctx.font = '40px Arial';
              ['telur 6', 'tempe', 'kangkung 1 ikat', 'beras 1 kg'].forEach((line, i) => ctx.fillText(line, 30, 60 + i * 62));
              const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
              return window.Lahap.readListPhoto(blob);
            }"""
        )
        parsed_ocr = page2.evaluate("(t) => window.LahapRecipes.parseIngredients(t)", ocr_text)
        check("ocr: reads a written list on device", set(parsed_ocr) >= {"egg", "tempeh", "kangkung"}, (ocr_text[:80], parsed_ocr))

        # Indonesian bumbu are known ingredients, and "asam manis" is not read as tamarind
        bumbu = page2.evaluate(
            "() => window.LahapRecipes.parseIngredients('lengkuas, daun salam, kemiri 3 butir, terasi, kunyit, ketumbar, gula merah, asam jawa, daun jeruk, ikan teri')"
        )
        check(
            "lab: Indonesian bumbu parsed",
            set(bumbu) == {"galangal", "salamleaf", "candlenut", "shrimppaste", "turmeric", "coriander", "palmsugar", "tamarind", "limeleaf", "fish"},
            bumbu,
        )
        sweet_sour = page2.evaluate("() => window.LahapRecipes.parseIngredients('ayam asam manis')")
        check("lab: asam manis is not tamarind", "tamarind" not in sweet_sour and "chicken" in sweet_sour, sweet_sour)
        soto = page2.evaluate(
            "() => window.LahapRecipes.suggest(['chicken', 'turmeric', 'galangal', 'lemongrass', 'salamleaf'], { goal: 'healthy', limit: 3 }).map((r) => r.id)"
        )
        check("lab: soto bumbu ranks soto ayam first", soto[:1] == ["soto-ayam"], soto)
        no_nuts = page2.evaluate(
            "() => window.LahapRecipes.suggest(['chicken', 'potato'], { goal: 'healthy', limit: 10, diet: { noNuts: true } }).map((r) => r.id)"
        )
        check("lab: no-nuts diet drops candlenut curry", "kari-ayam" not in no_nuts, no_nuts)

        # OCR in Bahasa: the List language switch loads the Indonesian model (ind+eng) for a handwriting-style list
        ind_requests = []
        page2.on("request", lambda request: ind_requests.append(request.url) if "ind.traineddata" in request.url else None)
        ocr_id = page2.evaluate(
            """async () => {
              window.Lahap.state.lab.lang = 'id-ID';
              const lines = ['bawang merah', 'kecap manis', 'daun salam', 'lengkuas', 'ikan teri'];
              const c = document.createElement('canvas');
              c.width = 640;
              c.height = 380;
              const ctx = c.getContext('2d');
              ctx.fillStyle = '#f4efe2';
              ctx.fillRect(0, 0, c.width, c.height);
              ctx.fillStyle = '#1d2a5a';
              ctx.font = "36px 'Segoe Print', 'Comic Sans MS', cursive";
              lines.forEach((line, i) => ctx.fillText(line, 30, 60 + i * 64));
              const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
              const text = await window.Lahap.readListPhoto(blob);
              const expected = window.LahapRecipes.parseIngredients(lines.join(', '));
              const got = window.LahapRecipes.parseIngredients(text);
              window.Lahap.state.lab.lang = 'en-US';
              return { text, expected, got };
            }"""
        )
        check(
            "ocr: Bahasa list reads with the Indonesian model",
            bool(ind_requests)
            and all(word in ocr_id["text"].lower() for word in ["bawang merah", "kecap manis", "daun salam", "lengkuas", "ikan teri"])
            and len(ocr_id["expected"]) >= 3
            and set(ocr_id["got"]) >= set(ocr_id["expected"]),
            (ind_requests[:1], ocr_id["text"][:90], ocr_id["expected"], ocr_id["got"]),
        )

        # phone: Add to Home Screen icons and 44px tap targets in the Lab
        icons = page2.evaluate(
            """async () => {
              const manifest = await (await fetch('manifest.webmanifest')).json();
              const apple = document.querySelector('link[rel=apple-touch-icon]');
              const appleOk = apple ? (await fetch(apple.href)).ok : false;
              return { sizes: manifest.icons.map((i) => i.sizes + ':' + (i.purpose || 'any') + ':' + i.type), appleOk };
            }"""
        )
        check(
            "phone: PNG, maskable and apple-touch icons",
            icons["appleOk"] and "192x192:any:image/png" in icons["sizes"] and "512x512:maskable:image/png" in icons["sizes"],
            icons,
        )
        page2.set_viewport_size({"width": 412, "height": 915})
        page2.evaluate("() => location.hash = 'lab'")
        page2.wait_for_timeout(200)
        short = page2.evaluate(
            """() => {
              const bad = [];
              for (const el of document.querySelectorAll('[data-view=lab] .chip, [data-view=lab] .seg button, [data-view=lab] .btn.small')) {
                if (!el.getBoundingClientRect().width) continue;
                el.scrollIntoView({ block: 'center' });
                const r = el.getBoundingClientRect();
                const x = r.left + r.width / 2;
                const hit = (y) => {
                  const node = document.elementFromPoint(x, y);
                  return node && (node === el || el.contains(node) || node.closest('.chip, .seg button, .btn.small') === el);
                };
                if (!hit(r.top + r.height / 2 - 22 + 1) || !hit(r.top + r.height / 2 + 22 - 1)) bad.push((el.innerText || '').trim() + ' ' + Math.round(r.height));
              }
              return bad;
            }"""
        )
        check("phone: Lab chips, toggles and recipe buttons have a 44px tap area", not short, short)

        hidden = {}
        for view in ("diary", "insights", "lab", "buds", "me"):
            page2.evaluate(f"() => location.hash = '{view}'")
            page2.wait_for_timeout(150)
            gap = page2.evaluate(
                """() => {
                  window.scrollTo(0, document.documentElement.scrollHeight);
                  const view = document.querySelector('[data-view=' + location.hash.slice(1) + ']');
                  const bar = document.querySelector('.bottombar');
                  if (!view || !bar) return null;
                  let bottom = 0;
                  for (const el of view.querySelectorAll('*')) {
                    const r = el.getBoundingClientRect();
                    // closed <details> content still reports boxes in Chrome; checkVisibility skips it
                    if (r.width && r.height && el.checkVisibility()) bottom = Math.max(bottom, r.bottom);
                  }
                  return Math.round(bar.getBoundingClientRect().top - bottom);
                }"""
            )
            if gap is not None and gap < 8:
                hidden[view] = gap
        check("phone: page end clears the bottom bar in every view", not hidden, hidden)

        page2.set_viewport_size({"width": 1280, "height": 900})
        page2.evaluate("() => location.hash = 'lab'")
        page2.wait_for_timeout(150)
        check("lab: list language picker shown", "List language" in page2.inner_text("#view-lab") if page2.query_selector("#view-lab") else "List language" in page2.content())
        check("lab: no overflow on desktop", page2.evaluate("() => document.documentElement.scrollWidth - window.innerWidth") <= 0)
        check("first-run flows: no JS errors", not errors2, "; ".join(errors2[:3]))
        fresh.close()

        # ---- persistence ----
        page.reload()
        page.wait_for_selector("html[data-ready='1']")
        persisted = page.evaluate("() => window.Lahap.state.entries.some(e => e.name === 'Mie goreng test')")
        check("meals persist after reload (IndexedDB)", persisted)

        # ---- layout ----
        for width in (320, 390, 768, 1024, 1440):
            page.set_viewport_size({"width": width, "height": 900})
            for view in ("diary", "insights", "lab", "buds", "me"):
                page.evaluate(f"() => location.hash = '{view}'")
                page.wait_for_timeout(80)
                overflow = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
                if overflow > 0:
                    check(f"no overflow {view} @ {width}", False, overflow)
        check("no horizontal overflow at 320-1440", not any(name.startswith("no overflow") for name, ok, _ in results if not ok))

        check("no JS errors", not errors, "; ".join(errors[:3]))

    failed = [name for name, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    sys.stdout.flush()
    os._exit(1 if failed else 0)


if __name__ == "__main__":
    main()
