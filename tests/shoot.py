"""Screenshot Lahap states for review/judging: python tests/shoot.py <label>"""
import functools
import http.server
import os
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
LABEL = sys.argv[1] if len(sys.argv) > 1 else "shots"
OUT = Path(os.environ.get("SHOT_OUT") or (ROOT.parent / "hone" / LABEL))
OUT.mkdir(parents=True, exist_ok=True)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


for key in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
    os.environ.pop(key, None)
server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
server.daemon_threads = True
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_address[1]}/index.html"

STATES = [
    ("diary", "#diary", None),
    ("search", "#diary", "search"),
    ("insights", "#insights", None),
    ("buds", "#buds", None),
    ("log", "#diary", "log"),
    ("share", "#diary", "share"),
    ("empty", "#diary", "empty"),
]

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(args=["--no-proxy-server"])
    for width, height in ((390, 844), (1440, 900)):
        context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)
        context.set_default_timeout(180000)
        page = context.new_page()
        for name, hash_, action in STATES:
            query = "?nosw=1&noquiz=1" if action == "empty" else "?demo=1&nosw=1"
            if action == "empty":
                fresh = browser.new_context(viewport={"width": width, "height": height})
                fresh.set_default_timeout(180000)
                target = fresh.new_page()
            else:
                target = page
            target.goto(base + query + hash_)
            target.wait_for_selector("html[data-ready='1']", state="attached")
            target.wait_for_timeout(250)
            if action == "search":
                target.fill("#q", "nasi lemak")
                target.wait_for_timeout(200)
            if action == "log":
                target.evaluate("() => window.Lahap.openLog()")
                target.fill("#log-form input[name=name]", "Nasi lemak ayam")
                target.wait_for_timeout(300)
            if action == "share":
                target.evaluate("() => window.Lahap.openShare(window.Lahap.state.entries.find(e => e.name === \'Tom yum seafood\'))")
                target.wait_for_timeout(500)
            full = action in (None, "search") and width == 1440
            print('shot', name, width, flush=True)
            target.screenshot(path=str(OUT / f"{name}-{width}.png"), full_page=full)
            if action == "empty":
                fresh.close()
        if width == 390:
            page.goto(base + "?demo=1&nosw=1")
            page.wait_for_selector("html[data-ready='1']", state="attached")
            page.evaluate("() => window.Lahap.openShare(window.Lahap.state.entries.find(e => e.name === 'Tom yum seafood'))")
            for template, background in (("card", "paper"), ("receipt", "clear"), ("stats", "ink")):
                data = page.evaluate(
                    """async ([template, background]) => {
                        document.querySelector(`[data-seg=template][data-value=${template}]`).click();
                        document.querySelector(`[data-seg=background][data-value=${background}]`).click();
                        await new Promise(r => setTimeout(r, 1500));
                        return document.getElementById('share-canvas').toDataURL('image/png');
                    }""",
                    [template, background],
                )
                import base64
                (OUT / f"card-{template}-{background}.png").write_bytes(base64.b64decode(data.split(",")[1]))
                print("card", template, background, flush=True)
print("saved", OUT)
sys.stdout.flush()
os._exit(0)
