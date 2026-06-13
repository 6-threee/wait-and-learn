// Options page logic for Agora.
// Consumer of window.WL.DeckStore (loaded via the <script> tags before this file).
// This is a normal extension page, so plain DOM is fine here.
(function () {
  "use strict";

  var DeckStore = window.WL && window.WL.DeckStore;

  // Elements
  var activeDeckSel = document.getElementById("active-deck");
  var statTotal = document.getElementById("stat-total");
  var statDue = document.getElementById("stat-due");
  var statNew = document.getElementById("stat-new");
  var boxesEl = document.getElementById("boxes");
  var statsEmptyEl = document.getElementById("stats-empty");
  var importText = document.getElementById("import-text");
  var importBtn = document.getElementById("import-btn");
  var importFile = document.getElementById("import-file");
  var importMsg = document.getElementById("import-msg");
  var resetBtn = document.getElementById("reset-btn");
  var resetMsg = document.getElementById("reset-msg");
  var speakAutoCheck = document.getElementById("speak-auto");

  function showMsg(el, text, ok) {
    el.textContent = text;
    el.classList.remove("hidden", "ok", "err");
    el.classList.add(ok ? "ok" : "err");
  }

  function hideMsg(el) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove("ok", "err");
  }

  // Populate the active-deck dropdown from listDecks(), marking the current active one.
  async function renderDeckList() {
    var decks = await DeckStore.listDecks();
    var active = DeckStore.getActiveDeck();
    var activeId = active ? active.id : null;

    activeDeckSel.innerHTML = "";
    decks.forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.name + " (" + d.count + ")";
      if (d.id === activeId) opt.selected = true;
      activeDeckSel.appendChild(opt);
    });
  }

  // Compute and render stats for the active deck from getEntries() + SRS states.
  function renderStats() {
    var entries = DeckStore.getEntries();
    var now = Date.now();

    var total = entries.length;
    var due = 0;
    var unseen = 0;
    var boxes = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    entries.forEach(function (entry) {
      var state = entry.state;
      if (!state) {
        // Unseen cards are treated as due (matches Scheduler.pickNext).
        unseen++;
        due++;
        return;
      }
      if (state.dueAt <= now) due++;
      if (boxes.hasOwnProperty(state.box)) boxes[state.box]++;
    });

    statTotal.textContent = String(total);
    statDue.textContent = String(due);
    statNew.textContent = String(unseen);

    // Per-box breakdown; always render all five boxes including zeros.
    var maxCount = 1;
    for (var b = 1; b <= 5; b++) {
      if (boxes[b] > maxCount) maxCount = boxes[b];
    }

    boxesEl.innerHTML = "";
    for (var box = 1; box <= 5; box++) {
      var count = boxes[box];
      var li = document.createElement("li");

      var name = document.createElement("span");
      name.className = "box-name";
      name.textContent = "Box " + box;

      var bar = document.createElement("span");
      bar.className = "bar";
      var fill = document.createElement("span");
      fill.style.width = Math.round((count / maxCount) * 100) + "%";
      bar.appendChild(fill);

      var num = document.createElement("span");
      num.className = "box-count";
      num.textContent = String(count);

      li.appendChild(name);
      li.appendChild(bar);
      li.appendChild(num);
      boxesEl.appendChild(li);
    }

    if (total === 0) {
      statsEmptyEl.classList.remove("hidden");
    } else {
      statsEmptyEl.classList.add("hidden");
    }
  }

  // Re-resolve the active deck into memory and repaint everything.
  async function refreshAll() {
    await DeckStore.init();
    await renderDeckList();
    renderStats();
  }

  // Active-deck dropdown: switching sets the active deck and re-renders stats.
  activeDeckSel.addEventListener("change", async function () {
    var id = activeDeckSel.value;
    try {
      await DeckStore.setActiveDeck(id);
      // init() is the documented path that loads the active deck's cards + SRS into memory.
      await refreshAll();
    } catch (e) {
      console.error("Agora: setActiveDeck failed", e);
    }
  });

  // Import from pasted JSON. JSON.parse and schema validation are separate concerns.
  importBtn.addEventListener("click", async function () {
    hideMsg(importMsg);
    var raw = importText.value.trim();
    if (!raw) {
      showMsg(importMsg, "Paste a deck as JSON first.", false);
      return;
    }
    var obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      showMsg(importMsg, "Invalid JSON: " + e.message, false);
      return;
    }
    await runImport(obj);
  });

  // Import from a chosen .json file.
  importFile.addEventListener("change", function () {
    hideMsg(importMsg);
    var file = importFile.files && importFile.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = async function () {
      var obj;
      try {
        obj = JSON.parse(String(reader.result));
      } catch (e) {
        showMsg(importMsg, "Invalid JSON in file: " + e.message, false);
        return;
      }
      await runImport(obj);
    };
    reader.onerror = function () {
      showMsg(importMsg, "Could not read the file.", false);
    };
    reader.readAsText(file);
  });

  // Shared import path: DeckStore.importDeck owns validation + persistence.
  async function runImport(obj) {
    var result;
    try {
      result = await DeckStore.importDeck(obj);
    } catch (e) {
      console.error("Agora: importDeck threw", e);
      showMsg(importMsg, "Import failed: " + (e && e.message ? e.message : "unknown error"), false);
      return;
    }
    if (result && result.ok) {
      showMsg(importMsg, "Imported deck: " + result.id, true);
      importText.value = "";
      importFile.value = "";
      await refreshAll();
    } else {
      var err = result && result.error ? result.error : "unknown error";
      showMsg(importMsg, "Import failed: " + err, false);
    }
  }

  // Reset progress for the active deck, guarded by a confirm().
  resetBtn.addEventListener("click", async function () {
    hideMsg(resetMsg);
    var active = DeckStore.getActiveDeck();
    if (!active) {
      showMsg(resetMsg, "No active deck.", false);
      return;
    }
    var ok = window.confirm(
      'Reset all spaced-repetition progress for "' + active.name + '"? This cannot be undone.'
    );
    if (!ok) return;

    try {
      await DeckStore.resetProgress(active.id);
      await refreshAll();
      showMsg(resetMsg, "Progress reset.", true);
    } catch (e) {
      console.error("Agora: resetProgress failed", e);
      showMsg(resetMsg, "Reset failed: " + (e && e.message ? e.message : "unknown error"), false);
    }
  });

  // Auto-speak preference (stored under wl.speakAuto, default true). Read/write
  // chrome.storage.local directly; content.js listens for changes live.
  function loadSpeakAuto() {
    try {
      chrome.storage.local.get("wl.speakAuto", function (res) {
        if (chrome.runtime && chrome.runtime.lastError) { speakAutoCheck.checked = true; return; }
        speakAutoCheck.checked = (res && typeof res["wl.speakAuto"] === "boolean") ? res["wl.speakAuto"] : true;
      });
    } catch (e) {
      speakAutoCheck.checked = true;
    }
  }
  if (speakAutoCheck) {
    speakAutoCheck.addEventListener("change", function () {
      try { chrome.storage.local.set({ "wl.speakAuto": speakAutoCheck.checked }); } catch (e) {}
    });
  }

  // Boot.
  if (!DeckStore) {
    console.error("Agora: WL.DeckStore not found. Check script load order.");
    return;
  }
  loadSpeakAuto();
  refreshAll().catch(function (e) {
    console.error("Agora: options init failed", e);
  });
})();
