"""Device-matrix check for Lahap: iPhone 13 (WebKit = Safari engine) and Pixel 7 (Chromium).

Runs the real flows a phone user hits: first load + service worker, install tags, camera photo with the
on-device cut-out, Bahasa voice and the share sheet. Speech and share are replaced by recording stubs so we
see exactly what the phone OS would receive. The share stub enforces Safari's rule: share() only works while
the tap's user activation is still active (it rejects with NotAllowedError otherwise, like iOS does).

It then walks the everyday data flows: log a meal with no camera, reload half-way through logging and get the
draft back, share a backup, and restore that backup into a second, empty browser profile (twice, to prove a
second restore adds nothing). Each flow lands in "flows" as true/false and the last line counts them.

This is device emulation (screen size, touch, user agent, and the real Safari engine for the iPhone profile).
It is not a run on a physical phone.

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
    const call = {
      activation,
      name: file ? file.name : null,
      type: file ? file.type : null,
      size: file ? file.size : 0,
      title: data ? data.title : null,
      text: null,
    };
    window.__shareCalls.push(call);
    // a backup is a text file: keep what the share sheet would receive so the restore flow can use it
    if (file && /json|text\/plain/.test(file.type)) call.text = await file.text();
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
        results["flows"] = data_flows(playwright, browser, page, device_name, base)
    finally:
        results["js_errors"] = errors[:5]
        browser.close()
    return results


def toast_text(page):
    return page.evaluate("() => (document.querySelector('.toast') || {}).textContent || ''")


def real_meal_names(page):
    return page.evaluate("() => window.Lahap.state.entries.filter((entry) => !entry.sample).map((entry) => entry.name).sort()")


def with_query(base, query):
    return base + ("&" if "?" in base else "?") + query


def data_flows(playwright, browser, page, device_name, base):
    """Everyday data flows: quick log, draft restore after a reload, backup share, restore on a second profile."""
    flows = {}

    # 1. log a meal with no camera: a name is enough
    page.evaluate("() => location.hash = 'diary'")
    page.locator("[data-action=log]:visible").first.click()
    page.wait_for_selector("#log-form")
    page.fill("#log-form input[name=name]", "Device check quick meal")
    page.locator("#log-form button[type=submit]").click()
    page.wait_for_timeout(500)
    flows["quick_log_saved"] = "Device check quick meal" in real_meal_names(page)
    flows["quick_log_on_diary"] = page.locator(".ticket", has_text="Device check quick meal").count() >= 1

    # 2. reload half-way through logging: the sheet comes back with what was typed
    page.locator("[data-action=log]:visible").first.click()
    page.wait_for_selector("#log-form")
    page.fill("#log-form input[name=name]", "Device check draft meal")
    page.wait_for_timeout(900)
    page.reload()
    page.wait_for_selector("html[data-ready='1']", timeout=30000)
    try:
        page.wait_for_selector("#dlg-log[open] #log-form", timeout=5000)
        flows["draft_sheet_reopened"] = True
        flows["draft_name_kept"] = page.input_value("#log-form input[name=name]") == "Device check draft meal"
        flows["draft_toast"] = "Restored the meal you were logging" in toast_text(page)
        page.locator("#log-form button[type=submit]").click()
        page.wait_for_timeout(600)
    except Exception:
        flows["draft_sheet_reopened"] = False
        flows["draft_name_kept"] = False
        flows["draft_toast"] = False
    flows["draft_saved_as_meal"] = "Device check draft meal" in real_meal_names(page)
    page.reload()
    page.wait_for_selector("html[data-ready='1']", timeout=30000)
    page.wait_for_timeout(500)
    flows["draft_cleared_after_save"] = not page.evaluate("() => document.getElementById('dlg-log').open")
    if page.evaluate("() => document.getElementById('dlg-quiz')?.open"):
        page.locator("[data-quiz-skip]").first.click()
        page.wait_for_timeout(200)

    # 3. share a backup from the profile tab
    expected = real_meal_names(page)
    page.evaluate("() => { window.__shareCalls.length = 0; location.hash = 'me'; }")
    page.wait_for_selector("#share-backup")
    page.locator("#share-backup").click()
    page.wait_for_function("() => window.__shareCalls.some((call) => call.text)", timeout=15000)
    call = page.evaluate("() => window.__shareCalls.find((call) => call.text)")
    backup = json.loads(call["text"])
    flows["backup_share_called"] = call["title"] == "Lahap backup" and call["size"] > 0
    flows["backup_file_type"] = call["type"] in ("application/json", "text/plain")
    flows["backup_has_my_meals"] = sorted(entry["name"] for entry in backup["entries"]) == expected
    flows["backup_has_no_samples"] = not any(entry.get("sample") for entry in backup["entries"])
    page.wait_for_timeout(400)
    flows["backup_marked_done"] = page.evaluate("() => !!window.Lahap.state.settings.lastBackup")

    # 4. restore it on a second, empty profile (another phone), then once more to prove nothing doubles
    other = browser.new_context(**playwright.devices[device_name])
    other.add_init_script(STUBS)
    try:
        second = other.new_page()
        second.goto(with_query(base, "noquiz=1"))
        second.wait_for_selector("html[data-ready='1']", timeout=30000)
        flows["second_profile_starts_empty"] = real_meal_names(second) == []
        second.evaluate("() => location.hash = 'me'")
        second.wait_for_selector("#import", state="attached")
        payload = {"name": call["name"], "mimeType": call["type"], "buffer": call["text"].encode("utf-8")}
        second.set_input_files("#import", payload)
        second.wait_for_function(
            "() => ((document.querySelector('.toast') || {}).textContent || '').includes('Synced:')", timeout=15000
        )
        first_toast = toast_text(second)
        flows["restore_toast"] = first_toast == f"Synced: {len(expected)} new, 0 updated, 0 removed"
        flows["restore_meals_match"] = real_meal_names(second) == expected
        second.evaluate("() => location.hash = 'diary'")
        second.wait_for_timeout(400)
        flows["restore_on_diary"] = second.locator(".ticket", has_text="Device check quick meal").count() >= 1
        second.evaluate("() => location.hash = 'me'")
        second.wait_for_selector("#import", state="attached")
        second.set_input_files("#import", payload)
        second.wait_for_function(
            "() => ((document.querySelector('.toast') || {}).textContent || '').includes('Synced: 0 new')", timeout=15000
        )
        flows["second_restore_adds_nothing"] = toast_text(second) == "Synced: 0 new, 0 updated, 0 removed"
        flows["second_restore_no_doubles"] = real_meal_names(second) == expected
        flows["detail"] = {"meals": expected, "backup_bytes": call["size"], "restore_toast": first_toast}
    finally:
        other.close()
    return flows


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
    passed = 0
    total = 0
    for row in report:
        flows = row.get("flows") or {}
        for name, value in flows.items():
            if name == "detail":
                continue
            total += 1
            passed += 1 if value is True else 0
            if value is not True:
                print(f"FAILED {row.get('device')}: {name}")
        if "crash" in row:
            total += 1
            print(f"FAILED {row.get('device')}: crashed: {row['crash']}")
    print(f"device flows: {passed}/{total} passed (emulation, not a physical phone)")
    if passed != total:
        sys.exit(1)


if __name__ == "__main__":
    main()
