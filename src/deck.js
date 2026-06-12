var WL = (typeof window !== "undefined") ? (window.WL = window.WL || {}) : {};

// WL.DeckStore - loads decks and persists SRS state via chrome.storage.local.
// Bundled deck comes from the WL.__bundledDeck global (not fetched). Imported
// decks live under wl.decks. SRS state under wl.srs.<deckId>. Active deck id
// under wl.activeDeck. Never throws into the page: on any storage error it logs
// to console and continues with in-memory state.

(function () {
  var BUNDLED_DECK_ID = "bundled:spanish-starter";
  var DEFAULT_ACTIVE_DECK = BUNDLED_DECK_ID;

  // In-memory state, populated by init().
  var activeDeckId = DEFAULT_ACTIVE_DECK;
  var importedDecks = {}; // id -> deck object
  var srsMap = {}; // cardId -> state for the active deck

  // --- chrome.storage.local helpers (Promise-wrapped, fail-silent) ---

  function storageGet(keys) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(keys, function (result) {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.error("[WL.DeckStore] storage get error:", chrome.runtime.lastError);
            resolve({});
            return;
          }
          resolve(result || {});
        });
      } catch (e) {
        console.error("[WL.DeckStore] storage get threw:", e);
        resolve({});
      }
    });
  }

  function storageSet(obj) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.set(obj, function () {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.error("[WL.DeckStore] storage set error:", chrome.runtime.lastError);
            resolve(false);
            return;
          }
          resolve(true);
        });
      } catch (e) {
        console.error("[WL.DeckStore] storage set threw:", e);
        resolve(false);
      }
    });
  }

  function storageRemove(keys) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.remove(keys, function () {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.error("[WL.DeckStore] storage remove error:", chrome.runtime.lastError);
            resolve(false);
            return;
          }
          resolve(true);
        });
      } catch (e) {
        console.error("[WL.DeckStore] storage remove threw:", e);
        resolve(false);
      }
    });
  }

  // --- internal helpers ---

  function bundledDeck() {
    return (typeof WL !== "undefined" && WL.__bundledDeck) ? WL.__bundledDeck : null;
  }

  function deckById(deckId) {
    var bundled = bundledDeck();
    if (bundled && bundled.id === deckId) return bundled;
    if (importedDecks && Object.prototype.hasOwnProperty.call(importedDecks, deckId)) {
      return importedDecks[deckId];
    }
    return null;
  }

  function srsKey(deckId) {
    return "wl.srs." + deckId;
  }

  function slugify(name) {
    return String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Load the SRS map for the given deck id into the in-memory srsMap.
  function loadSrsFor(deckId) {
    var key = srsKey(deckId);
    return storageGet(key).then(function (result) {
      var stored = result[key];
      srsMap = (stored && typeof stored === "object") ? stored : {};
    });
  }

  // --- public API ---

  function init() {
    return storageGet(["wl.activeDeck", "wl.decks"]).then(function (result) {
      var storedDecks = result["wl.decks"];
      importedDecks = (storedDecks && typeof storedDecks === "object") ? storedDecks : {};

      var storedActive = result["wl.activeDeck"];
      // Use the stored active deck only if we can actually resolve its cards.
      if (storedActive && deckById(storedActive)) {
        activeDeckId = storedActive;
      } else {
        activeDeckId = DEFAULT_ACTIVE_DECK;
      }

      return loadSrsFor(activeDeckId);
    });
  }

  function getActiveDeck() {
    var deck = deckById(activeDeckId);
    if (!deck) return null;
    return {
      id: deck.id,
      name: deck.name,
      lang: deck.lang,
      cards: deck.cards
    };
  }

  function getEntries() {
    var deck = deckById(activeDeckId);
    if (!deck || !Array.isArray(deck.cards)) return [];
    return deck.cards.map(function (card) {
      return {
        id: card.id,
        card: card,
        state: srsMap[card.id]
      };
    });
  }

  function getCard(cardId) {
    var deck = deckById(activeDeckId);
    if (!deck || !Array.isArray(deck.cards)) return undefined;
    for (var i = 0; i < deck.cards.length; i++) {
      if (deck.cards[i].id === cardId) return deck.cards[i];
    }
    return undefined;
  }

  function getState(cardId) {
    return srsMap[cardId];
  }

  function saveState(cardId, state) {
    srsMap[cardId] = state;
    var key = srsKey(activeDeckId);
    var payload = {};
    payload[key] = srsMap;
    return storageSet(payload).then(function () {
      return undefined;
    });
  }

  function listDecks() {
    return Promise.resolve().then(function () {
      var decks = [];
      var bundled = bundledDeck();
      if (bundled) {
        decks.push({
          id: bundled.id,
          name: bundled.name,
          lang: bundled.lang,
          count: Array.isArray(bundled.cards) ? bundled.cards.length : 0
        });
      }
      for (var id in importedDecks) {
        if (Object.prototype.hasOwnProperty.call(importedDecks, id)) {
          var d = importedDecks[id];
          decks.push({
            id: d.id,
            name: d.name,
            lang: d.lang,
            count: Array.isArray(d.cards) ? d.cards.length : 0
          });
        }
      }
      return decks;
    });
  }

  function setActiveDeck(deckId) {
    activeDeckId = deckId;
    return storageSet({ "wl.activeDeck": deckId }).then(function () {
      return loadSrsFor(deckId);
    });
  }

  function importDeck(deckObj) {
    // Validate schema. On any failure, store nothing and return {ok:false,error}.
    if (!deckObj || typeof deckObj !== "object") {
      return Promise.resolve({ ok: false, error: "Deck must be an object." });
    }
    if (typeof deckObj.name !== "string" || deckObj.name.trim() === "") {
      return Promise.resolve({ ok: false, error: "Deck name must be a non-empty string." });
    }
    if (typeof deckObj.lang !== "string" || deckObj.lang.trim() === "") {
      return Promise.resolve({ ok: false, error: "Deck lang must be a non-empty string." });
    }
    if (!Array.isArray(deckObj.cards) || deckObj.cards.length === 0) {
      return Promise.resolve({ ok: false, error: "Deck cards must be a non-empty array." });
    }

    var cards = [];
    for (var i = 0; i < deckObj.cards.length; i++) {
      var raw = deckObj.cards[i];
      if (!raw || typeof raw !== "object") {
        return Promise.resolve({ ok: false, error: "Card at index " + i + " must be an object." });
      }
      if (typeof raw.front !== "string" || raw.front.trim() === "") {
        return Promise.resolve({ ok: false, error: "Card at index " + i + " needs a non-empty front." });
      }
      if (typeof raw.back !== "string" || raw.back.trim() === "") {
        return Promise.resolve({ ok: false, error: "Card at index " + i + " needs a non-empty back." });
      }
      var card = {
        id: (typeof raw.id === "string" && raw.id !== "") ? raw.id : "imp-" + i,
        front: raw.front,
        back: raw.back
      };
      if (typeof raw.example === "string") {
        card.example = raw.example;
      }
      cards.push(card);
    }

    var id = "imported:" + slugify(deckObj.name);
    var deck = {
      id: id,
      name: deckObj.name,
      lang: deckObj.lang,
      cards: cards
    };

    importedDecks[id] = deck;
    var payload = {};
    payload["wl.decks"] = importedDecks;
    return storageSet(payload).then(function (ok) {
      if (!ok) {
        // Storage failed: roll back the in-memory addition and report failure.
        delete importedDecks[id];
        return { ok: false, error: "Failed to save deck to storage." };
      }
      return { ok: true, id: id };
    });
  }

  function resetProgress(deckId) {
    if (deckId === activeDeckId) {
      srsMap = {};
    }
    return storageRemove(srsKey(deckId)).then(function () {
      return undefined;
    });
  }

  WL.DeckStore = {
    init: init,
    getActiveDeck: getActiveDeck,
    getEntries: getEntries,
    getCard: getCard,
    getState: getState,
    saveState: saveState,
    listDecks: listDecks,
    setActiveDeck: setActiveDeck,
    importDeck: importDeck,
    resetProgress: resetProgress
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = WL.DeckStore;
