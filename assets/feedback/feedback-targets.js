/* ==========================================================================
   Kommentierbare Bereiche für JM Bauphysik
   --------------------------------------------------------------------------
   Setzt die Attribute data-fb (eindeutige ID) und data-fb-label (lesbarer
   Name) per Selektor, damit index.html selbst nicht angepasst werden muss.
   Muss NACH script.js (rendert die Leistungskarten) und VOR feedback.js
   geladen werden.
   ========================================================================== */
(function () {
  "use strict";

  function slug(text) {
    return String(text)
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "bereich";
  }

  function mark(el, id, label) {
    if (!el || el.hasAttribute("data-fb")) return;
    el.setAttribute("data-fb", id);
    el.setAttribute("data-fb-label", label);
  }

  function markOne(selector, id, label) {
    mark(document.querySelector(selector), id, label);
  }

  function textOf(el, selector) {
    var node = el.querySelector(selector);
    return node ? node.textContent.replace(/\s+/g, " ").trim() : "";
  }

  /* --- Feste Bereiche (Reihenfolge = Reihenfolge in der Auswahlliste) --- */
  markOne(".site-header", "header", "Kopfzeile & Navigation");
  markOne(".site-header .brand", "logo", "Logo");
  markOne(".hero", "hero", "Startbild");
  markOne(".hero h1", "hero-titel", "Startbild – Hauptüberschrift");
  markOne(".hero-lead", "hero-text", "Startbild – Einleitungstext");
  markOne(".hero .btn-primary", "hero-button", "Startbild – Button „Leistungen entdecken“");
  markOne(".hero-aside", "hero-hinweis", "Startbild – Hinweis Energieeffizienz-Experte");

  markOne("#leistungen .section-head", "leistungen-intro", "Leistungen – Überschrift & Einleitung");
  markOne(".steps", "leistungen-schritte", "Leistungen – Drei Schritte (Erstberatung, Vor-Ort-Termin, Angebot)");

  /* Kategorien und einzelne Leistungskarten (von script.js erzeugt) */
  document.querySelectorAll("#categories > div").forEach(function (block, i) {
    var catName = textOf(block, ".cat-head h3") || "Kategorie " + (i + 1);
    mark(block, "kategorie-" + (i + 1), "Leistungen – Kategorie " + (i + 1) + ": " + catName);
    block.querySelectorAll(".card").forEach(function (card, j) {
      var title = textOf(card, "h4") || "Leistung " + (j + 1);
      mark(card, "leistung-" + (i + 1) + "-" + slug(title), "Leistung: " + title + " (" + catName + ")");
    });
  });
  markOne("#leistungen .fineprint", "leistungen-preishinweis", "Leistungen – Preishinweis");

  markOne(".profile-media", "profil-bild", "Über mich – Foto");
  markOne(".profile-text", "profil-text", "Über mich – Text");

  markOne(".testimonials", "kundenstimmen", "Kundenstimmen");

  markOne("#referenzen .section-head", "referenzen-intro", "Referenzen – Überschrift");
  document.querySelectorAll("#referenzen .ref").forEach(function (ref, i) {
    var title = textOf(ref, "h3") || "Referenz " + (i + 1);
    mark(ref, "referenz-" + (i + 1), "Referenz " + String(i + 1).padStart(2, "0") + ": " + title);
  });

  markOne(".contact-text", "kontakt-text", "Kontakt – Text, Telefon & E-Mail");
  markOne("#contact-form", "kontakt-formular", "Kontakt – Anfrageformular");

  markOne(".site-footer", "footer", "Fußzeile");
})();
