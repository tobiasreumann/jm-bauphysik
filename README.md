# JM Bauphysik – Onepager (Demo)

Statische Website (HTML, CSS, JavaScript) für das Ingenieurbüro JM Bauphysik.
Wird über GitHub Pages ausgeliefert, kein Build-Schritt nötig.

- `index.html` – Seitenstruktur
- `styles.css` – Gestaltung
- `script.js` – Leistungen & Preise, Kundenstimmen, Demo-Hinweis beim Formular
- `assets/` – Bilder
- `assets/feedback/` – Kommentarfunktion als eigenes Modul (siehe unten)

## Kommentarfunktion

Eingebunden über zwei `<link>`- und zwei `<script>`-Zeilen in `index.html`, sonst ohne Eingriff in den Seitencode:

- `feedback.js` / `feedback.css` – unveränderte Kopie des Kommentar-Werkzeugs
- `feedback-theme.css` – Farben (Grün statt Orange) und Hover-Rahmen ohne Einfärbung
- `feedback-targets.js` – legt fest, welche Bereiche kommentierbar sind (`data-fb` / `data-fb-label` per Selektor)

Auf GitHub Pages gibt es keine Kommentar-API. Kommentare werden deshalb im Browser
(localStorage) der jeweiligen Person gespeichert und über „Alle Kommentare“ →
„Als Markdown exportieren“ als `.md` heruntergeladen. Jede Überschrift im Export
nennt den kommentierten Bereich.

Fotos unter der Unsplash-Lizenz:
- „Wohnhaus am Hang“ (`assets/reference-1.jpg`): Nitish Nayak / Unsplash
- „Haus im Grünen“ (`assets/reference-2.jpg`): Chris Weiher / Unsplash
