(function () {
  'use strict';

  var DISMISS_KEY = 'mc_install_dismissed_at';
  var RESHOW_DAYS = 60;
  var deferredPrompt = null;

  var TEXTS = {
    en: {
      msg: "Install MortgageCalc as an app on your phone or computer.",
      btn: "Install",
      later: "Not now",
      ios: "On iPhone: tap the Share icon, then \"Add to Home Screen\"."
    },
    es: {
      msg: "Instala MortgageCalc como aplicación en tu móvil o computadora.",
      btn: "Instalar",
      later: "Ahora no",
      ios: "En iPhone: toca el ícono Compartir y luego \"Añadir a la pantalla de inicio\"."
    },
    fr: {
      msg: "Installez MortgageCalc comme application sur votre mobile ou votre ordinateur.",
      btn: "Installer",
      later: "Plus tard",
      ios: "Sur iPhone : touchez l\u2019ic\u00f4ne Partager puis \u00ab Sur l\u2019\u00e9cran d\u2019accueil \u00bb."
    },
    pt: {
      msg: "Instale o MortgageCalc como aplicativo no celular ou no PC.",
      btn: "Instalar",
      later: "Agora n\u00e3o",
      ios: "No iPhone: toque no \u00edcone Compartilhar e depois em \"Adicionar \u00e0 Tela de In\u00edcio\"."
    },
    de: {
      msg: "Installiere MortgageCalc als App auf dem Handy oder dem PC.",
      btn: "Installieren",
      later: "Sp\u00e4ter",
      ios: "Auf dem iPhone: Teilen-Symbol antippen und \u201eZum Home-Bildschirm\u201c w\u00e4hlen."
    }
  };

  function currentLang() {
    var m = location.pathname.match(/^\/(es|fr|pt|de)(\/|$)/);
    if (m) return m[1];
    return (document.documentElement.getAttribute("lang") || "en").slice(0, 2);
  }

  function standaloneMode() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
  }

  function dismissedRecently() {
    try {
      var v = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
      return v > 0 && (Date.now() - v) < RESHOW_DAYS * 86400000;
    } catch (err) { return false; }
  }

  function markDismissed() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (err) {}
  }

  function addStyles() {
    var css = [
      "#mc-promo{position:fixed;left:16px;bottom:16px;z-index:9990;max-width:360px;",
      "background:#fff;color:#12263F;border-radius:14px;padding:14px 16px;",
      "box-shadow:0 10px 34px rgba(6,43,102,.25);display:flex;gap:12px;align-items:flex-start;",
      "font-size:.92rem;line-height:1.45;opacity:0;transform:translateY(12px);",
      "transition:opacity .35s ease,transform .35s ease}",
      "#mc-promo.mc-visible{opacity:1;transform:translateY(0)}",
      "[data-theme=\"dark\"] #mc-promo{background:#152C50;color:#EAF2FB}",
      "#mc-promo .mc-ico{flex:0 0 34px;width:34px;height:34px;",
      "background:url(/assets/img/logo-mark.svg) center/contain no-repeat;margin-top:2px}",
      "#mc-promo .mc-txt{flex:1 1 auto}",
      "#mc-promo .mc-actions{margin-top:9px;display:flex;gap:12px;align-items:center}",
      "#mc-promo .mc-btn{background:#19D65B;color:#052B18;border:none;border-radius:8px;",
      "padding:7px 15px;font-weight:700;font-size:.88rem;cursor:pointer}",
      "#mc-promo .mc-btn:hover{filter:brightness(1.07)}",
      "#mc-promo .mc-later{background:none;border:none;color:#5B7391;cursor:pointer;",
      "font-size:.82rem;text-decoration:underline;padding:0}",
      "[data-theme=\"dark\"] #mc-promo .mc-later{color:#93A9C8}",
      "#mc-promo .mc-x{position:absolute;top:6px;right:10px;background:none;border:none;",
      "color:#8AA0BC;font-size:1.05rem;cursor:pointer;line-height:1}",
      "@media(max-width:520px){#mc-promo{left:12px;right:12px;bottom:12px;max-width:none}}"
    ].join("");
    var styleEl = document.createElement("style");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  function buildBanner(texts) {
    var el = document.createElement("div");
    el.id = "mc-promo";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", texts.btn);
    el.innerHTML =
      "<span class=\"mc-ico\" aria-hidden=\"true\"></span>" +
      "<div class=\"mc-txt\">" +
      "<span class=\"mc-msg\"></span>" +
      "<div class=\"mc-actions\">" +
      "<button type=\"button\" class=\"mc-btn\"></button>" +
      "<button type=\"button\" class=\"mc-later\"></button>" +
      "</div></div>" +
      "<button type=\"button\" class=\"mc-x\" aria-label=\"\u00d7\">\u00d7</button>";
    el.querySelector(".mc-msg").textContent = texts.msg;
    el.querySelector(".mc-btn").textContent = texts.btn;
    el.querySelector(".mc-later").textContent = texts.later;
    return el;
  }

  function show() {
    if (document.getElementById("mc-promo")) return;
    var texts = TEXTS[currentLang()] || TEXTS.en;
    addStyles();
    var el = buildBanner(texts);
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("mc-visible"); });

    el.querySelector(".mc-btn").addEventListener("click", function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () {
          hide(el);
          markDismissed();
        });
        deferredPrompt = null;
      } else {
        var msg = el.querySelector(".mc-msg");
        msg.textContent = texts.ios;
      }
    });
    el.querySelector(".mc-later").addEventListener("click", function () {
      hide(el); markDismissed();
    });
    el.querySelector(".mc-x").addEventListener("click", function () {
      hide(el); markDismissed();
    });
  }

  function hide(el) {
    el.classList.remove("mc-visible");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });

  window.addEventListener("appinstalled", function () {
    var el = document.getElementById("mc-promo");
    if (el) hide(el);
    markDismissed();
  });

  function init() {
    if (standaloneMode() || dismissedRecently()) return;
    setTimeout(show, 5000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
