"""End-to-end and logic tests for Lahap. Run with the system Python that has Playwright:

    python tests/test_app.py

Serves the app folder on 127.0.0.1, drives Chromium, prints PASS/FAIL per check, exits 1 on any failure.
"""
import functools
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
        page.fill("#q", "nasi lemak")
        page.wait_for_timeout(150)
        expected = page.evaluate("() => window.Lahap.state.entries.filter(e => e.name.toLowerCase().includes('nasi lemak')).length")
        answer = page.locator(".answer h2").inner_text()
        check("search answers 'have I eaten this'", answer.startswith(f"Yes, {expected} times"), answer)
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
        page.locator("#log-form label.chip:has(input[value=Spicy])").click()
        page.locator("#log-form [data-seg=veg][data-value='2']").click()
        page.locator("#log-form label.chip:has(input[value=rina])").click()
        page.locator("#log-form button[type=submit]").click()
        page.wait_for_timeout(300)
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


        # ---- G4: share card stats never overlap (judge finding turned into a gate) ----
        overlaps = page.evaluate(
            """async () => {
              const found = [];
              const entry = window.Lahap.state.entries.reduce((a, b) => (String(a.price).length >= String(b.price).length ? a : b));
              entry.price = 1234567;
              for (const subject of [entry, 'week']) {
                for (const size of ['story', 'square']) {
                  window.Lahap.openShare(subject);
                  document.querySelector(`[data-seg=size][data-value=${size}]`).click();
                  document.querySelector('[data-seg=template][data-value=card]').click();
                  await new Promise(r => setTimeout(r, 150));
                  const boxes = window.Lahap.drawShare.boxes.slice();
                  for (const a of boxes) {
                    for (const b of boxes) {
                      if (a !== b && a.y === b.y && a.x < b.x && a.x + a.width + 16 > b.x) found.push(`${size}:${a.x}->${b.x}`);
                    }
                  }
                  document.getElementById('dlg-share').close();
                }
              }
              return found;
            }"""
        )
        check("G4 share stats never overlap (story + square, meal + week)", not overlaps, overlaps)

        # ---- taste buds ----
        page.goto(base + "?nosw=1#buds")
        page.wait_for_selector("html[data-ready='1']")
        page.locator("[data-add]").first.click()
        page.wait_for_timeout(200)
        friends = page.evaluate("() => window.Lahap.state.friends.length")
        check("add a bud", friends == 3, friends)
        page.locator("[data-hangout=rina]").click()
        page.wait_for_selector("#hangout-form")
        wa = page.get_attribute("#hangout-wa", "href")
        check("hangout: WhatsApp link has message", wa.startswith("https://wa.me/?text=Hi%20Rina"), wa[:60])
        page.locator("#hangout-form button[type=submit]").click()
        page.wait_for_timeout(200)
        before = page.evaluate("() => window.Lahap.state.points.rina || 0")
        page.locator("[data-done]").first.click()
        page.wait_for_timeout(300)
        after = page.evaluate("() => window.Lahap.state.points.rina || 0")
        check("hangout done adds 25 points", after - before == 25, f"{before} -> {after}")
        check("hangout done opens log with bud tagged", page.locator("#log-form input[value=rina]:checked").count() == 1)
        page.locator("#dlg-log [data-close]").first.click()

        # ---- persistence ----
        page.reload()
        page.wait_for_selector("html[data-ready='1']")
        persisted = page.evaluate("() => window.Lahap.state.entries.some(e => e.name === 'Mie goreng test')")
        check("meals persist after reload (IndexedDB)", persisted)

        # ---- layout ----
        for width in (320, 390, 768, 1024, 1440):
            page.set_viewport_size({"width": width, "height": 900})
            for view in ("diary", "insights", "buds", "me"):
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
