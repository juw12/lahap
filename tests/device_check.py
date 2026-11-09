"""Device-matrix check for Lahap: iPhone 13 (WebKit = Safari engine) and Pixel 7 (Chromium).

Runs the real flows a phone user hits: first load + service worker, install tags, camera photo with the
on-device cut-out, Bahasa voice and the share sheet. Speech and share are replaced by recording stubs so we
see exactly what the phone OS would receive. The share stub enforces Safari's rule: share() only works while
the tap's user activation is still active (it rejects with NotAllowedError otherwise, like iOS does).

Usage: python tests/device_check.py [base_url] [--proxy http://host:port] [--slow-blob] [--only webkit|chromium]
--slow-blob makes PNG encoding take 6 s (a slow phone) to prove Share still opens inside Safari's 5 s window.
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "plate.jpg"

SLOW_BLOB = r"""
(() => {
  // a slow phone: PNG encoding takes longer than the 5 s user-activation window
  const original = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function (callback, ...rest) {
    return original.call(this, (blob) => setTimeout(() => callback(blob), 6000), ...rest);
  };
})();
"""

STUBS = r"""
(() => {
  window.__shareCalls = [];
  const fakeShare = async (data) => {
    const activation = navigator.userActivation ? navigator.userActivation.isActive : 'unsupported';
    const file = data && data.files && data.files[0];
    window.__shareCalls.push({
      activation,
      name: file ? file.name : null,
      type: file ? file.type : null,
      size: file ? file.size : 0,
      title: data ? data.title : null,
    });
    if (activation === false) throw new DOMException('Share needs a user gesture', 'NotAllowedError');
  };
  Object.defineProperty(navigator, 'share', { value: fakeShare, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: (data) => !!(data && data.files && data.files.length), configurable: true });

  window.__speech = [];
  class FakeSpeech {
    constructor() { window.__speech.push(this); }
    start() { this.started = true; }
    stop() { if (this.onend) this.onend(); }
    abort() { if (this.onend) this.onend(); }
  }
  // Safari only exposes the prefixed constructor; mirror that on every engine
  try { delete window.SpeechRecognition; } catch (error) {}
  window.SpeechRecognition = undefined;
  window.webkitSpeechRecognition = FakeSpeech;
})();
"""


def run_device(playwright, engine_name, device_name, base, proxy, slow_blob=False):
    results = {"device": device_name, "engine": engine_name}
    engine = getattr(playwright, engine_name)
    launch_args = {"proxy": {"server": proxy}} if proxy else {}
    browser = engine.launch(**launch_args)
    context = browser.new_context(**playwright.devices[device_name])
    context.add_init_script(STUBS)
    if slow_blob:
        context.add_init_script(SLOW_BLOB)
    results["slow_blob"] = slow_blob
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        started = time.time()
        page.goto(base)
        page.wait_for_selector("html[data-ready='1']", timeout=30000)
        results["first_load_s"] = round(time.time() - started, 2)
        results["user_agent"] = page.evaluate("() => navigator.userAgent")[:90]

        results["service_worker"] = page.evaluate(
            """async () => {
              if (!('serviceWorker' in navigator)) return 'unsupported';
              const ready = await Promise.race([
                navigator.serviceWorker.ready.then(() => 'active'),
                new Promise((resolve) => setTimeout(() => resolve('timeout'), 10000)),
              ]);
              return ready;
            }"""
        )
        results["install_tags"] = page.evaluate(
            """() => ({
              manifest: !!document.querySelector('link[rel=manifest]'),
              appleTouchIcon: !!document.querySelector('link[rel=apple-touch-icon]'),
              appleCapable: document.querySelector('meta[name=apple-mobile-web-app-capable]')?.content || null,
              themeColor: document.querySelector('meta[name=theme-color]')?.content || null,
              viewportFit: (document.querySelector('meta[name=viewport]')?.content || '').includes('viewport-fit=cover'),
            })"""
        )

        if page.evaluate("() => document.getElementById('dlg-quiz')?.open"):
            page.locator("[data-quiz-skip]").first.click()
            page.wait_for_timeout(200)

        # camera photo -> on-device cut-out
        page.locator("[data-action=log]:visible").first.click()
        page.wait_for_selector("#log-form")
        results["camera_input"] = page.evaluate(
            """() => { const i = document.getElementById('log-photo'); return { accept: i.accept, capture: i.getAttribute('capture') }; }"""
        )
        started = time.time()
        page.set_input_files("#log-photo", str(FIXTURE))
        try:
            page.wait_for_selector("#cut-toggle:not([hidden])", timeout=120000)
            results["cutout_first_s"] = round(time.time() - started, 1)
            results["cutout_status"] = page.inner_text("#photo-status")[:80]
        except Exception as error:
            results["cutout_first_s"] = None
            results["cutout_status"] = "FAILED: " + page.inner_text("#photo-status")[:120]
        page.fill("#log-form input[name=name]", "Device check plate")
        page.locator("#log-form button[type=submit]").click()
        page.wait_for_timeout(400)

        # share sheet from the meal detail
        page.locator(".ticket", has_text="Device check plate").first.click()
        page.wait_for_selector("#dlg-detail[open]")
        page.locator("#dlg-detail [data-share]").click()
        page.wait_for_selector("#dlg-share[open]")
        page.wait_for_timeout(600)
        page.locator("#share-send").click(timeout=20000)
        page.wait_for_timeout(8000 if slow_blob else 2500)
        results["share_toast"] = page.evaluate("() => (document.querySelector('.toast') || {}).textContent || ''")[:90]
        results["share_calls"] = page.evaluate("() => window.__shareCalls")
        page.evaluate("() => document.getElementById('dlg-share').close()")
        page.evaluate("() => { const d = document.getElementById('dlg-detail'); if (d.open) d.close(); }")

        # Bahasa voice in the Lab
        page.evaluate("() => location.hash = 'lab'")
        page.wait_for_selector("#lab-text")
        page.locator("[data-seg=lablang][data-value='id-ID']").click()
        page.locator("[data-lab-voice]").click()
        page.wait_for_timeout(200)
        results["voice"] = page.evaluate(
            """() => {
              const rec = window.__speech[window.__speech.length - 1];
              if (!rec) return { started: false };
              const lang = rec.lang;
              rec.onresult({ results: [[{ transcript: 'tiga telur, tempe sama kangkung' }]] });
              rec.onend();
              return { started: !!rec.started, lang, have: window.Lahap.state.lab.have };
            }"""
        )
        results["overflow_px"] = page.evaluate("() => document.documentElement.scrollWidth - innerWidth")
    finally:
        results["js_errors"] = errors[:5]
        browser.close()
    return results


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    base = args[0] if args else "http://127.0.0.1:8791/"
    proxy = None
    if "--proxy" in sys.argv:
        proxy = sys.argv[sys.argv.index("--proxy") + 1]
        args = [a for a in args if a != proxy]
        base = args[0] if args else base
    slow_blob = "--slow-blob" in sys.argv
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    args = [a for a in args if a != only]
    base = args[0] if args else base
    report = []
    with sync_playwright() as playwright:
        for engine_name, device_name in (("webkit", "iPhone 13"), ("chromium", "Pixel 7")):
            if only and engine_name != only:
                continue
            try:
                report.append(run_device(playwright, engine_name, device_name, base, proxy, slow_blob))
            except Exception as error:
                report.append({"device": device_name, "engine": engine_name, "crash": str(error)[:300]})
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
