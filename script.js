(function () {
  "use strict";

  /* ---------- Leistungen & Preise ---------- */
  var categories = [
    {
      label: "Energieberatung & Förderung",
      intro: "Unabhängig beraten, sicher gefördert: vom Sanierungsfahrplan bis zur Baubegleitung Ihrer BAFA-Einzelmaßnahmen.",
      items: [
        { sub: "Sanierung planen", title: "Individueller Sanierungsfahrplan (iSFP)", features: ["Vor-Ort-Aufnahme & Energiebilanz", "Maßnahmen mit Kosten & Reihenfolge", "+5 % iSFP-Bonus auf Einzelmaßnahmen"], price: "1.290 €", unit: "Einfamilienhaus · bis 50 % BAFA-Zuschuss" },
        { sub: "Sanierung umsetzen", title: "Baubegleitung BAFA-Einzelmaßnahmen", features: ["Technischer Projektnachweis & Antrag", "Prüfung von Angeboten & Details", "Stichproben-Kontrollen auf der Baustelle"], price: "690 €", unit: "je Maßnahme · 50 % förderfähig" },
        { sub: "Fördergeld sichern", title: "Fördermittelberatung & Antrag", features: ["Passende Programme von BAFA & KfW", "Antrag & Bestätigung zum Antrag (BzA)", "Verwendungsnachweis nach Abschluss"], price: "290 €", unit: "je Förderantrag" },
        { sub: "Verkauf & Vermietung", title: "Energieausweis", features: ["Verbrauchs- oder Bedarfsausweis", "Gesetzeskonform nach GEG", "10 Jahre gültig"], price: "149 €", unit: "Verbrauchsausweis · Bedarf ab 390 €" }
      ]
    },
    {
      label: "Thermische Bauphysik",
      intro: "Wärme, Feuchte und Luftdichtheit berechnet und gemessen – für Neubau, Sanierung und Schadensfälle.",
      items: [
        { sub: "Neubau & Anbau", title: "Wärmeschutz- & GEG-Nachweis", features: ["Prüffähiger Nachweis für den Bauantrag", "Energiebedarfsausweis inklusive", "Effizienzhaus-Nachweis für KfW"], price: "990 €", unit: "Einfamilienhaus" },
        { sub: "Schimmel vermeiden", title: "Wärmebrücken & Feuchteschutz", features: ["Wärmebrückenberechnung", "Tauwasser- & Schimmelrisiko-Analyse", "Hygrothermische Simulation (WUFI)"], price: "390 €", unit: "je Detail" },
        { sub: "Luftdichtheit", title: "Blower-Door-Messung", features: ["Messung nach DIN EN ISO 9972", "Leckageortung in der Bauphase", "n50-Nachweis für GEG & KfW"], price: "490 €", unit: "Einfamilienhaus" },
        { sub: "Schwachstellen sehen", title: "Thermografie", features: ["Wärmebilder innen & außen", "Dach, Fassade & Fenster geprüft", "Bericht mit Empfehlungen"], price: "350 €", unit: "Einfamilienhaus" }
      ]
    },
    {
      label: "Bau- und Raumakustik",
      intro: "Ruhe planen statt nachbessern: Schallschutz nach DIN 4109 und gute Akustik für Wohnen, Arbeiten und Lernen.",
      items: [
        { sub: "Baugenehmigung", title: "Schallschutznachweis DIN 4109", features: ["Luft- & Trittschall prüffähig berechnet", "Für Bauantrag & Ausschreibung", "Konkrete Bauteilempfehlungen"], price: "890 €", unit: "je Gebäude" },
        { sub: "Früh richtig planen", title: "Schallschutzkonzept", features: ["Vordimensionierung der Bauteile", "Neubau, Aufstockung & Sanierung", "Abstimmung mit Planung & Handwerk"], price: "690 €", unit: "je Gebäude" },
        { sub: "Gut hören & verstehen", title: "Raumakustik", features: ["Berechnung der Nachhallzeit", "Büro, Praxis, Kita & Schule", "Maßnahmenkatalog mit Absorbern"], price: "790 €", unit: "je Raum" },
        { sub: "Qualität prüfen", title: "Bauakustische Messung", features: ["Luft- & Trittschallmessung vor Ort", "Qualitätssicherung am Bau", "Messbericht mit Bewertung"], price: "690 €", unit: "je Messtermin" }
      ]
    }
  ];

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function icon(id, cls) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", cls || "icon");
    svg.setAttribute("aria-hidden", "true");
    var use = document.createElementNS(ns, "use");
    use.setAttribute("href", "#" + id);
    svg.appendChild(use);
    return svg;
  }

  var catRoot = document.getElementById("categories");
  if (catRoot) {
    categories.forEach(function (cat, i) {
      var block = el("div");
      var head = el("div", "cat-head");
      head.appendChild(el("span", "cat-no", "0" + (i + 1)));
      head.appendChild(el("h3", null, cat.label));
      head.appendChild(el("p", null, cat.intro));
      block.appendChild(head);

      var grid = el("div", "cards");
      cat.items.forEach(function (item) {
        var card = el("article", "card");
        card.appendChild(el("p", "card-sub", item.sub));
        card.appendChild(el("h4", null, item.title));
        var ul = el("ul");
        item.features.forEach(function (f) {
          var li = el("li");
          li.appendChild(icon("i-check"));
          li.appendChild(document.createTextNode(f));
          ul.appendChild(li);
        });
        card.appendChild(ul);

        var foot = el("div", "card-foot");
        var priceWrap = el("div");
        var price = el("strong", "price");
        price.appendChild(el("span", null, "ab "));
        price.appendChild(document.createTextNode(item.price));
        priceWrap.appendChild(price);
        priceWrap.appendChild(el("span", "unit", item.unit));
        foot.appendChild(priceWrap);

        var link = el("a", "arrow-btn");
        link.href = "#kontakt";
        link.setAttribute("aria-label", item.title + " anfragen");
        link.appendChild(icon("i-arrow"));
        foot.appendChild(link);

        card.appendChild(foot);
        grid.appendChild(card);
      });
      block.appendChild(grid);
      catRoot.appendChild(block);
    });
  }

  /* ---------- Kundenstimmen ---------- */
  var testimonials = [
    { quote: "Die Beratung war fachlich exzellent und gleichzeitig so verständlich, dass wir jede Entscheidung sicher treffen konnten. Besonders wertvoll war der klare Sanierungsfahrplan.", name: "Familie Berger", project: "Sanierung Einfamilienhaus · Freiburg" },
    { quote: "Von der ersten Berechnung bis zur Abnahme hatten wir einen verlässlichen Ansprechpartner. Die Wärmebrückendetails wurden früh erkannt und sauber gelöst.", name: "Anna & Tobias Kern", project: "Effizienzhaus-Neubau · Offenburg" },
    { quote: "Pragmatisch, transparent und immer erreichbar. Die Fördermittelberatung hat uns nicht nur Zeit, sondern auch eine erhebliche Summe gespart.", name: "M. Schneider", project: "Energetische Modernisierung · Karlsruhe" }
  ];
  var slide = document.getElementById("t-slide");
  var dotsRoot = document.getElementById("t-dots");
  var current = 0;
  var timer = null;

  function renderTestimonial() {
    if (!slide) return;
    var t = testimonials[current];
    slide.innerHTML = "";
    var q = el("blockquote", null, "“" + t.quote + "”");
    var meta = el("div", "t-meta");
    meta.appendChild(el("strong", null, t.name));
    meta.appendChild(el("span", "dash"));
    meta.appendChild(el("span", null, t.project));
    slide.appendChild(q);
    slide.appendChild(meta);
    slide.classList.remove("t-enter");
    void slide.offsetWidth;
    slide.classList.add("t-enter");
    Array.prototype.forEach.call(dotsRoot.children, function (d, i) {
      d.setAttribute("aria-current", i === current ? "true" : "false");
    });
  }

  function go(i) {
    current = (i + testimonials.length) % testimonials.length;
    renderTestimonial();
    restart();
  }

  function restart() {
    if (timer) clearInterval(timer);
    timer = setInterval(function () { go(current + 1); }, 7000);
  }

  if (dotsRoot) {
    testimonials.forEach(function (_, i) {
      var b = el("button", "t-dot");
      b.type = "button";
      b.setAttribute("aria-label", "Kundenstimme " + (i + 1));
      b.addEventListener("click", function () { go(i); });
      dotsRoot.appendChild(b);
    });
    var prev = document.querySelector("[data-t-prev]");
    var next = document.querySelector("[data-t-next]");
    if (prev) prev.addEventListener("click", function () { go(current - 1); });
    if (next) next.addEventListener("click", function () { go(current + 1); });
    renderTestimonial();
    restart();
  }

  /* ---------- Datei-Upload: Dateiname anzeigen ---------- */
  var upload = document.getElementById("upload");
  var uploadName = document.getElementById("upload-name");
  if (upload && uploadName) {
    upload.addEventListener("change", function () {
      var f = upload.files && upload.files[0];
      uploadName.textContent = f ? f.name : "PDF, JPG, PNG oder ZIP · max. 10 MB";
    });
  }

  /* ---------- Demo-Hinweis beim Absenden ---------- */
  var form = document.getElementById("contact-form");
  var modal = document.getElementById("demo-modal");
  var lastFocus = null;

  function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    var ok = modal.querySelector(".modal-ok");
    if (ok) ok.focus();
  }

  function closeModal() {
    modal.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  if (form && modal) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      openModal();
    });
    Array.prototype.forEach.call(modal.querySelectorAll("[data-close]"), function (b) {
      b.addEventListener("click", closeModal);
    });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });
  }
})();
