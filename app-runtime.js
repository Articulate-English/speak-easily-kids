/* Speak Easily Kids — paygate runtime: access check, licence unlock,
   teacher share links, student deep links.

   Content model: lesson-data.js carries the free teaser (4 topics) plus metadata
   for all 20, encrypted under a PUBLIC key. The remaining 16 topics are sealed
   per buyer / per shared lesson by the unlock service and decrypted here.
   The paid key never ships. */
(function () {
  "use strict";
  var DECK = "kids";
  var PATH = "/speak-easily-kids";
  var WORKER = "https://ae-sliding-in.billiethomasonsound.workers.dev";
  var APP_URL = "https://articulate-english.github.io/speak-easily-kids/";
  var PRODUCT_KEY = "";   /* Payhip seller/product key — set in Payhip dashboard */
  var TEACHER_PRODUCT_KEY = "teacher";  /* lets a teacher key unlock + share before the store is live */
  var EFFECTIVE_PRODUCT_KEY = PRODUCT_KEY || TEACHER_PRODUCT_KEY;
  var BUY_URL = "";       /* Payhip checkout URL — set in Payhip dashboard */
  var FREE_SLUGS = ["myfamily", "mybestfriend", "gamesandsports", "animalsandnature"];
  var LS_GRANTED = "speak-easily-kids-granted";
  var LS_LICENCE = "speak-easily-kids-licence";

  var unlocked = false;
  var granted = {};

  /* ── restore a previous session ── */
  try {
    var raw = localStorage.getItem(LS_GRANTED);
    if (raw) granted = JSON.parse(raw) || {};
  } catch (e) {}
  function saveGranted() {
    try { localStorage.setItem(LS_GRANTED, JSON.stringify(granted)); } catch (e) {}
  }

  /* ── access ── */
  window.speakEasyKidsIsOpen = function (slug) {
    return FREE_SLUGS.indexOf(slug) >= 0 || unlocked || !!granted[slug];
  };
  /* the free teaser stays labelled "Free" even after an unlock */
  window.speakEasyKidsIsFree = function (slug) {
    return FREE_SLUGS.indexOf(slug) >= 0;
  };

  /* ── crypto (mirrors the Worker's hkdfFromString) ── */
  function b64urlDecode(s) {
    try {
      var t = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
      var pad = t.length % 4 === 0 ? "" : "=".repeat(4 - (t.length % 4));
      var bin = atob(t + pad);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch (e) { return new Uint8Array(0); }
  }
  function deriveKey(secret, salt, info) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(secret))).then(function (ikm) {
      return crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveKey"]);
    }).then(function (base) {
      return crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode(salt), info: new TextEncoder().encode(info) },
        base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    });
  }
  function decryptPayload(ctB64, key) {
    var raw = b64urlDecode(ctB64);
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, key, raw.slice(12));
  }
  function grantNonce(token) {
    try {
      var part = String(token).split(".")[0];
      return JSON.parse(new TextDecoder().decode(b64urlDecode(part))).nonce || null;
    } catch (e) { return null; }
  }
  function deviceId() {
    try {
      var id = localStorage.getItem("speak-easily-kids-device");
      if (!id) { id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem("speak-easily-kids-device", id); }
      return id;
    } catch (e) { return "anonymous"; }
  }

  /* ── data merge ── */
  function mergeTopics(incoming) {
    var data = window.lessonData || [];
    (incoming || []).forEach(function (cat) {
      var target = null;
      for (var i = 0; i < data.length; i++) if (data[i].category === cat.category) { target = data[i]; break; }
      if (!target) { target = { category: cat.category, topics: [] }; data.push(target); }
      (cat.topics || []).forEach(function (t) {
        if (!t.questions || !t.questions.length) return;   // never overwrite real content with a stub
        var found = false;
        for (var j = 0; j < target.topics.length; j++) {
          if (target.topics[j].slug === t.slug) { target.topics[j] = t; found = true; break; }
        }
        if (!found) target.topics.push(t);
      });
    });
    window.lessonData = data;
  }
  function findTopic(slug) {
    var data = window.lessonData || [];
    for (var i = 0; i < data.length; i++) {
      for (var j = 0; j < data[i].topics.length; j++) {
        if (data[i].topics[j].slug === slug) return { cat: data[i].category, topic: data[i].topics[j] };
      }
    }
    return null;
  }
  function rerender() { if (window.tryInitLibrary) window.tryInitLibrary(); }
  function openTopic(slug) {
    var hit = findTopic(slug);
    if (hit && window.openDeck) { window.openDeck(hit.cat, hit.topic); return true; }
    return false;
  }

  /* ── licence ── */
  function storedLicence() { try { return localStorage.getItem(LS_LICENCE) || ""; } catch (e) { return ""; } }
  function setUnlockMessage(text, kind) {
    var el = document.getElementById("unlockMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = kind === "error" ? "#f87171" : "var(--text-dim)";
  }
  window.speakEasyKidsUnlock = function () {
    var input = document.getElementById("licenceKey");
    var key = input ? input.value.trim() : storedLicence();
    if (!key) { setUnlockMessage("Paste the license key from your receipt email.", "error"); return; }
    if (!PRODUCT_KEY && !TEACHER_PRODUCT_KEY) { setUnlockMessage("Unlock is not enabled yet.", "error"); return; }
    setUnlockMessage("Checking…");
    fetch(WORKER + PATH + "/verify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licence_key: key, product_key: EFFECTIVE_PRODUCT_KEY })
    }).then(function (r) { return r.json().then(function (d) { return { status: r.status, body: d }; }); })
      .then(function (res) {
        if (!res.body.ok) { setUnlockMessage(res.body.error || "That key was not accepted.", "error"); return; }
        return fetch(WORKER + PATH + "/payload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ licence_key: key, product_key: EFFECTIVE_PRODUCT_KEY, deck: DECK })
        }).then(function (r2) { return r2.json().then(function (d2) { return { status: r2.status, body: d2 }; }); })
          .then(function (res2) {
            if (!res2.body.ok) { setUnlockMessage(res2.body.error || "Could not load the topics.", "error"); return; }
            return deriveKey(key, "speak-easily-kids/" + DECK, "speak-easily-kids/payload/v1")
              .then(function (k) { return decryptPayload(res2.body.ciphertext, k); })
              .then(function (plain) {
                mergeTopics(JSON.parse(new TextDecoder().decode(plain)));
                unlocked = true;
                try { localStorage.setItem(LS_LICENCE, key); } catch (e) {}
                setUnlockMessage("");
                var modal = document.getElementById("buyModal");
                if (modal) modal.classList.remove("open");
                rerender();
                var btn = document.getElementById("buyBtn");
                if (btn) { btn.textContent = "Unlocked"; btn.classList.remove("disabled"); }
              });
          });
      }).catch(function () { setUnlockMessage("Network error — try again.", "error"); });
  };

  /* ── teacher share: mint a signed link for ONE topic ── */
  window.speakEasyKidsShare = function (slug) {
    var key = storedLicence();
    if (!key) { openBuyModal(null); setUnlockMessage("Unlock with your teacher or licence key first, then share topics with your students.", "error"); return; }
    if (!PRODUCT_KEY && !TEACHER_PRODUCT_KEY) { setUnlockMessage("Sharing is not enabled yet.", "error"); return; }
    fetch(WORKER + PATH + "/grant", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licence_key: key, product_key: EFFECTIVE_PRODUCT_KEY, deck: DECK, lesson: slug })
    }).then(function (r) { return r.json().then(function (d) { return { status: r.status, body: d }; }); })
      .then(function (res) {
        if (!res.body.ok) { alert("Could not create a share link: " + (res.body.error || "unknown error")); return; }
        var url = res.body.url;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () { alert("Topic link copied — send it to your student. It unlocks this topic only."); });
        } else {
          prompt("Copy this topic link:", url);
        }
      }).catch(function () { alert("Network error — could not create the link."); });
  };

  /* ── student deep link: ?lesson=<slug>&grant=<token> ── */
  function handleDeepLink() {
    var p = new URLSearchParams(window.location.search);
    var slug = p.get("lesson");
    var token = p.get("grant");
    if (!slug) return;
    if (window.speakEasyKidsIsOpen(slug)) { openTopic(slug); return; }
    if (!token) { openBuyModal(null); return; }
    var nonce = grantNonce(token);
    fetch(WORKER + PATH + "/redeem", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant: token, device: deviceId() })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) { openBuyModal(null); return; }
      granted[d.lesson] = true;
      saveGranted();
      if (!d.payload || !nonce) { rerender(); openTopic(d.lesson); return; }
      deriveKey(nonce, "speak-easily-kids/grant/" + d.deck + "/" + d.lesson, "speak-easily-kids/grant/v1")
        .then(function (k) { return decryptPayload(d.payload, k); })
        .then(function (plain) {
          mergeTopics(JSON.parse(new TextDecoder().decode(plain)));
          rerender();
          openTopic(d.lesson);
        }).catch(function () { rerender(); });
    }).catch(function () { openBuyModal(null); });
  }

  /* ── wire the UI ── */
  function openBuyModal(topic) {
    var m = document.getElementById("buyModal");
    if (!m) return;
    var sub = document.getElementById("buyModalTopic");
    if (sub) sub.textContent = topic
      ? "“" + (topic.title || "").replace(/ \(\d+ questions?\)$/, "") + "” is part of the full Speak Easily Kids collection."
      : "All 20 topics, 240 questions, on any device.";
    m.classList.add("open");
  }
  window.openBuyModal = openBuyModal;
  window.closeBuyModal = function () {
    var m = document.getElementById("buyModal");
    if (m) m.classList.remove("open");
  };

  function wire() {
    var share = document.getElementById("shareBtn");
    if (share) share.addEventListener("click", function () {
      var slug = share.getAttribute("data-slug");
      if (slug) window.speakEasyKidsShare(slug);
    });
    var unlockBtn = document.getElementById("unlockBtn");
    if (unlockBtn) unlockBtn.addEventListener("click", window.speakEasyKidsUnlock);
    var buyBtn = document.getElementById("buyBtn");
    if (buyBtn) {
      if (BUY_URL) { buyBtn.textContent = "Buy on Payhip"; buyBtn.classList.remove("disabled"); buyBtn.setAttribute("href", BUY_URL); }
      else { buyBtn.textContent = "On Payhip soon"; buyBtn.classList.add("disabled"); }
    }
    var empty = document.getElementById("buyEmpty");
    if (empty && !BUY_URL) empty.textContent = "Payhip checkout opens here once the store is live. Have a license key? Use Unlock below.";
  }

  /* keep the Share button pointed at whichever topic is open */
  function hookOpenDeck() {
    if (!window.openDeck) { setTimeout(hookOpenDeck, 200); return; }
    if (window.__sekHooked) return;
    window.__sekHooked = true;
    var orig = window.openDeck;
    window.openDeck = function (cat, topic) {
      var btn = document.getElementById("shareBtn");
      if (btn && topic && topic.slug) btn.setAttribute("data-slug", topic.slug);
      return orig.apply(this, arguments);
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    hookOpenDeck();
    wire();
    handleDeepLink();
  });
})();
