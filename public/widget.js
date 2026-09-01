/*
 * guftagu.ai — embeddable support widget loader (گفتگو)
 *
 * A business drops ONE script tag on their site:
 *
 *   <script src="https://YOUR-HOST/widget.js" data-business="BUSINESS_ID" async></script>
 *
 * This file is intentionally dependency-free and tiny: it injects a floating
 * launcher button and, on first open, mounts an iframe pointing at the hosted
 * widget page. Isolating the UI in an iframe means none of our styles or JS can
 * collide with the host site, and vice versa.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var businessId = script.getAttribute("data-business");
  if (!businessId) {
    console.error("[guftagu.ai] missing data-business attribute on widget script");
    return;
  }

  // Derive the host we were served from so the iframe points back to us.
  var origin;
  try {
    origin = new URL(script.src).origin;
  } catch {
    console.error("[guftagu.ai] could not determine widget origin");
    return;
  }

  // Avoid double-mounting if the snippet is pasted twice.
  if (window.__GUFTAGU_MOUNTED__) return;
  window.__GUFTAGU_MOUNTED__ = true;

  var ACCENT = "#0f766e"; // emerald-700

  // ---- Launcher button ----
  var btn = document.createElement("button");
  btn.setAttribute("aria-label", "Chat with support");
  btn.style.cssText = [
    "position:fixed",
    "bottom:20px",
    "right:20px",
    "width:56px",
    "height:56px",
    "border-radius:9999px",
    "border:none",
    "background:" + ACCENT,
    "color:#fff",
    "cursor:pointer",
    "z-index:2147483000",
    "box-shadow:0 4px 16px rgba(0,0,0,0.25)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "transition:transform .15s ease",
  ].join(";");
  btn.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4.2 3.15A.6.6 0 0 1 4 18.6V5z" fill="#fff"/>' +
    "</svg>";
  btn.onmouseenter = function () { btn.style.transform = "scale(1.06)"; };
  btn.onmouseleave = function () { btn.style.transform = "scale(1)"; };

  // ---- Iframe panel ----
  var panel = document.createElement("div");
  panel.style.cssText = [
    "position:fixed",
    "bottom:88px",
    "right:20px",
    "width:360px",
    "max-width:calc(100vw - 40px)",
    "height:520px",
    "max-height:calc(100vh - 120px)",
    "border-radius:16px",
    "overflow:hidden",
    "box-shadow:0 10px 40px rgba(0,0,0,0.3)",
    "z-index:2147483001",
    "display:none",
    "background:#fff",
  ].join(";");

  var iframe = document.createElement("iframe");
  iframe.title = "Guftagu support chat";
  iframe.setAttribute("allow", "clipboard-write");
  iframe.style.cssText = "width:100%;height:100%;border:0;display:block;";

  panel.appendChild(iframe);

  var loaded = false;
  function open() {
    if (!loaded) {
      // Lazy-mount: only load the widget when the customer first opens it.
      iframe.src = origin + "/widget/" + encodeURIComponent(businessId);
      loaded = true;
    }
    panel.style.display = "block";
    btn.setAttribute("aria-expanded", "true");
  }
  function close() {
    panel.style.display = "none";
    btn.setAttribute("aria-expanded", "false");
  }
  btn.addEventListener("click", function () {
    if (panel.style.display === "none") open();
    else close();
  });

  document.body.appendChild(panel);
  document.body.appendChild(btn);

  // ---- Agentic actions (navigate / lead-form prefill) ----
  // The chat iframe asks us (the host page script) to take the visitor to an
  // exact page/section or fill the site's lead form. Only relative paths are
  // ever accepted, so a visitor can never be redirected off-site.

  var PREFILL_KEY = "guftagu_pending_prefill";

  function normalizePath(p) {
    if (typeof p !== "string") return null;
    if (p.charAt(0) !== "/" || p.indexOf("//") === 0) return null;
    return p.split(/[?#]/)[0];
  }

  function isFillable(el) {
    var type = el ? el.getAttribute("type") : null;
    return (
      el &&
      (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") &&
      !el.disabled &&
      !el.readOnly &&
      type !== "hidden" &&
      type !== "submit" &&
      type !== "checkbox" &&
      type !== "radio"
    );
  }

  function findField(key) {
    if (typeof key !== "string" || !key || key.length > 100) return null;
    var el = document.getElementById(key);
    if (isFillable(el)) return el;
    var byName = document.querySelector(
      'input[name="' + key + '"], textarea[name="' + key + '"], select[name="' + key + '"]'
    );
    if (isFillable(byName)) return byName;
    var labels = document.querySelectorAll("label");
    for (var i = 0; i < labels.length; i++) {
      var text = (labels[i].textContent || "").trim().toLowerCase();
      if (text === key.toLowerCase()) {
        var target = labels[i].htmlFor
          ? document.getElementById(labels[i].htmlFor)
          : labels[i].querySelector("input, textarea, select");
        if (isFillable(target)) return target;
      }
    }
    return null;
  }

  function setNativeValue(el, value) {
    // Use the element prototype's native setter so frameworks (React etc.)
    // that intercept value assignment still see the change.
    var proto =
      el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : el.tagName === "SELECT"
          ? window.HTMLSelectElement.prototype
          : window.HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function flash(el) {
    var prev = el.style.boxShadow;
    el.style.transition = "box-shadow .3s ease";
    el.style.boxShadow = "0 0 0 3px " + ACCENT + "66";
    setTimeout(function () {
      el.style.boxShadow = prev;
    }, 2000);
  }

  function fillForm(fields) {
    var filled = [];
    for (var key in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
      var el = findField(key);
      if (!el) continue;
      var value = String(fields[key] == null ? "" : fields[key]);
      if (!value) continue;
      if (el.tagName === "SELECT") {
        var hasOption = false;
        for (var i = 0; i < el.options.length; i++) {
          if (el.options[i].value === value) {
            hasOption = true;
            break;
          }
        }
        if (!hasOption) continue;
      }
      setNativeValue(el, value);
      filled.push(el);
    }
    if (filled.length > 0) {
      filled[0].scrollIntoView({ behavior: "smooth", block: "center" });
      for (var j = 0; j < filled.length; j++) flash(filled[j]);
    }
    return filled.length;
  }

  // The host page may hydrate its form after our script runs, so retry.
  function runPrefill(action) {
    var tries = 0;
    (function attempt() {
      if (fillForm(action.fields) > 0) return;
      if (++tries < 10) setTimeout(attempt, 500);
    })();
  }

  function samePath(a, b) {
    return a.replace(/\/+$/, "") === b.replace(/\/+$/, "");
  }

  function executeAction(action) {
    if (!action || typeof action !== "object") return;
    if (action.type === "navigate") {
      var path = normalizePath(action.path);
      if (!path) return;
      var anchor =
        typeof action.anchor === "string" && /^[\w-]+$/.test(action.anchor)
          ? "#" + action.anchor
          : "";
      setTimeout(function () {
        window.location.href = path + anchor;
      }, 800);
    } else if (action.type === "prefill") {
      var formPath = normalizePath(action.path);
      if (!formPath || !action.fields || typeof action.fields !== "object")
        return;
      if (samePath(window.location.pathname, formPath)) {
        setTimeout(function () {
          runPrefill(action);
        }, 400);
      } else {
        // Move to the form's page first; the fill survives via sessionStorage.
        try {
          sessionStorage.setItem(PREFILL_KEY, JSON.stringify(action));
        } catch (e) {
          /* private mode — still navigate */
        }
        setTimeout(function () {
          window.location.href = formPath;
        }, 800);
      }
    }
  }

  window.addEventListener("message", function (e) {
    // Only trust our own iframe; never execute instructions from elsewhere.
    if (e.origin !== origin) return;
    var d = e.data;
    if (!d || d.source !== "guftagu" || d.type !== "action") return;
    executeAction(d.action);
  });

  // Complete a prefill that was stashed before a page navigation.
  try {
    var pending = sessionStorage.getItem(PREFILL_KEY);
    if (pending) {
      sessionStorage.removeItem(PREFILL_KEY);
      runPrefill(JSON.parse(pending));
    }
  } catch (e) {
    /* ignore malformed storage */
  }
})();
