var WL = (typeof window !== "undefined") ? (window.WL = window.WL || {}) : {};

// WL.Card — Shadow-DOM floating flashcard UI.
// One host <div> appended to document.body once, reused for every card.
// All CSS lives inside the shadow root via a constructable stylesheet
// (adoptedStyleSheets) so it cannot trip claude.ai's style-src CSP.
WL.Card = (function () {
  var CSS = [
    ":host { all: initial; }",
    ".wl-host {",
    "  position: fixed;",
    "  right: 20px;",
    "  bottom: 20px;",
    "  z-index: 2147483647;",
    "  width: 280px;",
    "  max-width: calc(100vw - 40px);",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;",
    "  opacity: 0;",
    "  transform: translateY(12px);",
    "  transition: opacity 200ms ease, transform 200ms ease;",
    "  pointer-events: none;",
    "}",
    ".wl-host.wl-visible {",
    "  opacity: 1;",
    "  transform: translateY(0);",
    "  pointer-events: auto;",
    "}",
    ".wl-card {",
    "  background: #ffffff;",
    "  color: #1a1a1a;",
    "  border: 1px solid rgba(0, 0, 0, 0.12);",
    "  border-radius: 12px;",
    "  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);",
    "  padding: 16px 18px;",
    "  box-sizing: border-box;",
    "}",
    "@media (prefers-color-scheme: dark) {",
    "  .wl-card {",
    "    background: #1f2023;",
    "    color: #f2f2f2;",
    "    border-color: rgba(255, 255, 255, 0.14);",
    "    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);",
    "  }",
    "}",
    ".wl-lang {",
    "  display: inline-block;",
    "  font-size: 10px;",
    "  font-weight: 700;",
    "  letter-spacing: 0.06em;",
    "  text-transform: uppercase;",
    "  color: #6b7280;",
    "  background: rgba(0, 0, 0, 0.05);",
    "  border-radius: 5px;",
    "  padding: 2px 7px;",
    "  margin-bottom: 10px;",
    "}",
    "@media (prefers-color-scheme: dark) {",
    "  .wl-lang { color: #c7c7c7; background: rgba(255, 255, 255, 0.10); }",
    "}",
    ".wl-front-zone { cursor: pointer; }",
    ".wl-text {",
    "  font-size: 20px;",
    "  font-weight: 600;",
    "  line-height: 1.3;",
    "  margin: 0;",
    "}",
    ".wl-back {",
    "  font-size: 18px;",
    "  font-weight: 500;",
    "  line-height: 1.35;",
    "  margin: 10px 0 0 0;",
    "}",
    ".wl-example {",
    "  font-size: 13px;",
    "  line-height: 1.4;",
    "  color: #6b7280;",
    "  font-style: italic;",
    "  margin: 8px 0 0 0;",
    "}",
    "@media (prefers-color-scheme: dark) {",
    "  .wl-example { color: #b5b5b5; }",
    "}",
    ".wl-reveal-hint {",
    "  font-size: 12px;",
    "  color: #8a8f98;",
    "  margin: 12px 0 0 0;",
    "}",
    ".wl-divider {",
    "  height: 1px;",
    "  background: rgba(0, 0, 0, 0.10);",
    "  margin: 14px 0;",
    "}",
    "@media (prefers-color-scheme: dark) {",
    "  .wl-divider { background: rgba(255, 255, 255, 0.12); }",
    "}",
    ".wl-buttons {",
    "  display: flex;",
    "  gap: 10px;",
    "}",
    ".wl-btn {",
    "  flex: 1;",
    "  font: inherit;",
    "  font-size: 14px;",
    "  font-weight: 600;",
    "  border-radius: 8px;",
    "  padding: 9px 12px;",
    "  cursor: pointer;",
    "  border: 1px solid transparent;",
    "}",
    ".wl-btn-got {",
    "  background: #16a34a;",
    "  color: #ffffff;",
    "}",
    ".wl-btn-got:hover { background: #15803d; }",
    ".wl-btn-missed {",
    "  background: transparent;",
    "  color: #1a1a1a;",
    "  border-color: rgba(0, 0, 0, 0.20);",
    "}",
    ".wl-btn-missed:hover { background: rgba(0, 0, 0, 0.05); }",
    "@media (prefers-color-scheme: dark) {",
    "  .wl-btn-missed { color: #f2f2f2; border-color: rgba(255, 255, 255, 0.28); }",
    "  .wl-btn-missed:hover { background: rgba(255, 255, 255, 0.08); }",
    "}",
    ".wl-hidden { display: none; }"
  ].join("\n");

  // STATE = "FRONT" | "REVEALED" | null (not visible)
  var state = null;
  var awaitingAnswer = false;
  var answerHandler = null;

  var host = null;       // host <div> on document.body
  var shadow = null;     // shadow root
  var root = null;       // .wl-host wrapper inside shadow
  // Cached element refs (built once).
  var els = null;

  function build() {
    if (host) return;

    host = document.createElement("div");
    host.setAttribute("data-wl-card-host", "");
    shadow = host.attachShadow({ mode: "open" });

    var sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    shadow.adoptedStyleSheets = [sheet];

    root = document.createElement("div");
    root.className = "wl-host";

    var card = document.createElement("div");
    card.className = "wl-card";

    var lang = document.createElement("span");
    lang.className = "wl-lang wl-hidden";

    var frontZone = document.createElement("div");
    frontZone.className = "wl-front-zone";

    var frontText = document.createElement("p");
    frontText.className = "wl-text";

    var revealHint = document.createElement("p");
    revealHint.className = "wl-reveal-hint";
    revealHint.textContent = "Tap to reveal";

    frontZone.appendChild(frontText);
    frontZone.appendChild(revealHint);

    var backWrap = document.createElement("div");
    backWrap.className = "wl-hidden";

    var divider = document.createElement("div");
    divider.className = "wl-divider";

    var backText = document.createElement("p");
    backText.className = "wl-back";

    var exampleText = document.createElement("p");
    exampleText.className = "wl-example wl-hidden";

    var buttons = document.createElement("div");
    buttons.className = "wl-buttons";

    var gotBtn = document.createElement("button");
    gotBtn.type = "button";
    gotBtn.className = "wl-btn wl-btn-got";
    gotBtn.textContent = "Got it";

    var missedBtn = document.createElement("button");
    missedBtn.type = "button";
    missedBtn.className = "wl-btn wl-btn-missed";
    missedBtn.textContent = "Missed";

    buttons.appendChild(gotBtn);
    buttons.appendChild(missedBtn);

    backWrap.appendChild(divider);
    backWrap.appendChild(backText);
    backWrap.appendChild(exampleText);
    backWrap.appendChild(buttons);

    card.appendChild(lang);
    card.appendChild(frontZone);
    card.appendChild(backWrap);

    root.appendChild(card);
    shadow.appendChild(root);
    document.body.appendChild(host);

    frontZone.addEventListener("click", function () {
      if (state === "FRONT") reveal();
    });
    gotBtn.addEventListener("click", function () {
      onAnswerClick(true);
    });
    missedBtn.addEventListener("click", function () {
      onAnswerClick(false);
    });

    els = {
      lang: lang,
      frontZone: frontZone,
      frontText: frontText,
      revealHint: revealHint,
      backWrap: backWrap,
      backText: backText,
      exampleText: exampleText
    };
  }

  function reveal() {
    state = "REVEALED";
    awaitingAnswer = true;
    els.revealHint.classList.add("wl-hidden");
    els.backWrap.classList.remove("wl-hidden");
  }

  function onAnswerClick(gotIt) {
    if (!awaitingAnswer) return;
    var handler = answerHandler;
    awaitingAnswer = false;
    hide();
    if (typeof handler === "function") handler(!!gotIt);
  }

  function hide() {
    if (!root) return;
    root.classList.remove("wl-visible");
    state = null;
  }

  function show(card, opts) {
    build();
    card = card || {};
    answerHandler = (opts && opts.onAnswer) || null;
    awaitingAnswer = false;
    state = "FRONT";

    // FRONT content
    els.frontText.textContent = card.front || "";

    if (card.lang) {
      els.lang.textContent = card.lang;
      els.lang.classList.remove("wl-hidden");
    } else {
      els.lang.textContent = "";
      els.lang.classList.add("wl-hidden");
    }

    // Reset to FRONT view
    els.revealHint.classList.remove("wl-hidden");
    els.backWrap.classList.add("wl-hidden");

    // Pre-fill REVEALED content (hidden until reveal)
    els.backText.textContent = card.back || "";
    if (card.example) {
      els.exampleText.textContent = card.example;
      els.exampleText.classList.remove("wl-hidden");
    } else {
      els.exampleText.textContent = "";
      els.exampleText.classList.add("wl-hidden");
    }

    // Force a reflow so the fade-in transition runs even on reuse.
    void root.offsetWidth;
    root.classList.add("wl-visible");
  }

  function isVisible() {
    return state !== null;
  }

  function isAwaitingAnswer() {
    return state === "REVEALED" && awaitingAnswer;
  }

  function dismiss() {
    answerHandler = null;
    awaitingAnswer = false;
    hide();
  }

  return {
    show: show,
    isVisible: isVisible,
    isAwaitingAnswer: isAwaitingAnswer,
    dismiss: dismiss
  };
})();
