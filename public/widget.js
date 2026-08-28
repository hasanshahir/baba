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
})();
