/* ==========================================================================
   Kommentarfunktion für Website-Entwürfe – v1.0.0
   Quelle: dockerPlayground/kommentarFunktion/src  (NUR DORT BEARBEITEN,
   Kopien in Projekten werden mit install.sh überschrieben)
   --------------------------------------------------------------------------
   - Jedes Element mit  data-fb="id"  und  data-fb-label="Name"  ist
     kommentierbar. Beim Hovern erscheint ein Rahmen mit "Kommentieren".
   - Kommentare werden als einzelne JSON-Dateien über die nginx-WebDAV-API
     gespeichert (Standard: api/comments/ relativ zur Seite). Ist die API
     nicht erreichbar, wird auf localStorage ausgewichen.
   - Konfiguration über Attribute am <script>-Tag:
       data-api="pfad/zur/api/"   (Standard "api/comments/")
       data-poll="20000"          (Abgleich-Intervall in ms, min. 5000)
   ========================================================================== */
(function () {
  "use strict";

  const VERSION = "1.0.0";
  const SCRIPT = document.currentScript;
  const cfg = (name) => (SCRIPT && SCRIPT.getAttribute("data-" + name)) || null;
  const API = (cfg("api") || "api/comments/").replace(/\/?$/, "/");
  const POLL_MS = Math.max(5000, parseInt(cfg("poll"), 10) || 20000);
  const FILE_RE = /^c-[a-z0-9-]{6,64}\.json$/;
  const LS = {
    name: "fb-author",
    mode: "fb-mode",
    intro: "fb-intro-seen",
    local: "fb-local-comments",
  };
  const PAGE_TARGET = { id: "page", label: "Gesamteindruck (Farben, Schriften, Stil)", el: null };
  const TYPES = [
    { id: "like", label: "Gefällt mir" },
    { id: "change", label: "Bitte ändern" },
    { id: "question", label: "Frage / Idee" },
  ];

  /* ------------------------------------------------------------------ Helfer */
  function lsGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (e) { /* privat/blockiert – ohne Persistenz weiterarbeiten */ }
  }

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : String(v));
      }
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : String(c));
    }
    return el;
  }

  function icon(name) {
    const paths = {
      comment: "M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 3 13.5",
      plus: "M12 5v14M5 12h14",
      close: "M6 6l12 12M18 6 6 18",
      list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
      help: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5M12 18h.01",
      check: "M5 12.5l4.5 4.5L19 7.5",
      star: "M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4 7.2 18.9l.9-5.4-3.9-3.8 5.4-.8z",
    };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", paths[name]);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "2");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    svg.appendChild(p);
    return svg;
  }

  const dateFmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
  function fmtDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : dateFmt.format(d);
  }
  function newId() {
    const rand = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
    return "c-" + Date.now().toString(36) + "-" + rand;
  }
  function typeLabel(id) {
    const t = TYPES.find((x) => x.id === id);
    return t ? t.label : "Kommentar";
  }
  function isValidComment(c) {
    return c && typeof c === "object" && typeof c.id === "string" && FILE_RE.test(c.id + ".json") &&
      typeof c.target === "string" && typeof c.text === "string";
  }
  function byCreated(a, b) { return String(a.created).localeCompare(String(b.created)); }

  /* ------------------------------------------------------------------ Zustand */
  const state = {
    comments: [],
    backend: null,          // "server" | "local"
    offline: false,
    mode: lsGet(LS.mode) !== "off",
    hover: null,            // aktuell gehovertes Element
    open: null,             // Ziel-ID des offenen Popovers
    editing: null,          // ID des Kommentars in Bearbeitung
    drafts: {},             // Ziel-ID -> { text, type }
    panelOpen: false,
    filter: "all",          // "all" | "open" | "done"
    author: lsGet(LS.name) || "",
  };

  /* ------------------------------------------------------------------ Ziele */
  function findEl(id) {
    if (id === "page") return null;
    const sel = '[data-fb="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]';
    return document.querySelector(sel);
  }
  function labelOf(el) {
    return el.getAttribute("data-fb-label") || el.getAttribute("data-fb");
  }
  function allTargets() {
    const list = [PAGE_TARGET];
    document.querySelectorAll("[data-fb]").forEach((el) => {
      list.push({ id: el.getAttribute("data-fb"), label: labelOf(el), el });
    });
    return list;
  }
  function targetInfo(id) {
    if (id === "page") return PAGE_TARGET;
    const el = findEl(id);
    if (el) return { id, label: labelOf(el), el };
    const c = state.comments.find((x) => x.target === id);
    return { id, label: (c && c.targetLabel) || id, el: null };
  }
  function commentsFor(id) {
    return state.comments.filter((c) => c.target === id).sort(byCreated);
  }

  /* ------------------------------------------------------------------ Speicher */
  const storage = {
    async load() {
      try {
        const res = await fetch(API, { cache: "no-store", headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const list = await res.json();
        if (!Array.isArray(list)) throw new Error("Unerwartete Antwort");
        const names = list
          .filter((f) => f && f.type === "file" && FILE_RE.test(f.name))
          .map((f) => f.name);
        const items = await Promise.all(names.map((n) =>
          fetch(API + n, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        ));
        state.backend = "server";
        state.offline = false;
        return items.filter(isValidComment);
      } catch (err) {
        if (state.backend === "server") {
          // Server war schon erreichbar: kurzer Aussetzer, Daten behalten
          state.offline = true;
          throw err;
        }
        state.backend = "local";
        return this.readLocal();
      }
    },
    readLocal() {
      try {
        const data = JSON.parse(lsGet(LS.local) || "[]");
        return Array.isArray(data) ? data.filter(isValidComment) : [];
      } catch (e) { return []; }
    },
    writeLocal() {
      lsSet(LS.local, JSON.stringify(state.comments));
    },
    async save(comment) {
      if (state.backend !== "server") { this.writeLocal(); return; }
      const res = await fetch(API + comment.id + ".json", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comment, null, 2),
      });
      await res.text().catch(() => "");  // Antwort vollständig lesen (sonst meldet Chrome ERR_ABORTED)
      if (!res.ok) throw new Error("Speichern fehlgeschlagen (HTTP " + res.status + ")");
    },
    async remove(id) {
      if (state.backend !== "server") { this.writeLocal(); return; }
      const res = await fetch(API + id + ".json", { method: "DELETE" });
      await res.text().catch(() => "");
      if (!res.ok && res.status !== 404) throw new Error("Löschen fehlgeschlagen (HTTP " + res.status + ")");
    },
  };

  /* ------------------------------------------------------------------ DOM-Grundgerüst */
  const root = h("div", { class: "fb-root", id: "fb-root" });
  const frame = h("div", { class: "fb-frame", hidden: true });
  const frameLabel = h("div", { class: "fb-frame-label", hidden: true });
  const frameBtn = h("button", { class: "fb-frame-btn", type: "button", hidden: true }, icon("comment"), h("span", { text: "Kommentieren" }));
  const badgeLayer = h("div", { class: "fb-badges" });
  const pop = h("div", { class: "fb-pop", role: "dialog", "aria-modal": "false", hidden: true });
  const toast = h("div", { class: "fb-toast", role: "status", "aria-live": "polite" });
  const panel = h("aside", { class: "fb-panel", "aria-label": "Alle Kommentare", "aria-hidden": "true" });

  const modeBtn = h("button", { class: "fb-bar-btn", type: "button", "aria-pressed": String(state.mode), title: "Kommentar-Modus ein/aus" },
    icon("comment"), h("span", { class: "fb-mode-text" }));
  const generalBtn = h("button", { class: "fb-bar-btn", type: "button", title: "Feedback zum Gesamteindruck" },
    icon("star"), h("span", { class: "fb-hide-sm", text: "Gesamteindruck" }));
  const countEl = h("span", { class: "fb-count", text: "0" });
  const listBtn = h("button", { class: "fb-bar-btn", type: "button", "aria-expanded": "false", title: "Alle Kommentare anzeigen" },
    icon("list"), h("span", { class: "fb-hide-sm", text: "Alle Kommentare" }), countEl);
  const helpBtn = h("button", { class: "fb-bar-btn", type: "button", "aria-label": "Hilfe", title: "So funktioniert's" }, icon("help"));
  const bar = h("div", { class: "fb-bar", role: "toolbar", "aria-label": "Feedback-Werkzeug" },
    h("span", { class: "fb-bar-title", text: "Entwurf · Feedback" }),
    h("span", { class: "fb-bar-sep" }),
    modeBtn, generalBtn, listBtn, helpBtn);

  root.append(frame, badgeLayer, frameLabel, frameBtn, pop, panel, toast, bar);

  /* ------------------------------------------------------------------ Toast */
  let toastTimer = 0;
  function showToast(msg, isError) {
    toast.textContent = msg;
    toast.classList.toggle("is-error", !!isError);
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), isError ? 5000 : 2200);
  }

  /* ------------------------------------------------------------------ Layout (Positionen) */
  let rafId = 0;
  function schedule() {
    if (!rafId) rafId = requestAnimationFrame(layout);
  }
  const header = document.querySelector(".site-header");
  function headerBottom() {
    if (!header) return 0;
    const r = header.getBoundingClientRect();
    return r.bottom > 0 ? r.bottom : 0;
  }
  function visibleTop(el, rect, hb) {
    return header && header.contains(el) ? rect.top : Math.max(rect.top, hb);
  }
  function isRendered(rect) { return rect.width > 0 && rect.height > 0; }

  const badges = new Map(); // Ziel-ID -> Badge-Element

  function layout() {
    rafId = 0;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const hb = headerBottom();

    // --- Rahmen
    const openEl = state.open && state.open !== "page" ? findEl(state.open) : null;
    const frameEl = openEl || (state.mode && !state.open ? state.hover : null);
    let btnRight = null;
    if (frameEl && frameEl.isConnected) {
      const r = frameEl.getBoundingClientRect();
      const vt = visibleTop(frameEl, r, hb);
      if (isRendered(r) && vt < r.bottom - 24 && r.top < vh) {
        Object.assign(frame.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
        frame.hidden = false;
        frame.classList.toggle("fb-frame--active", !!openEl);

        // Label + Button über den Rahmen setzen, wenn Platz ist – sonst innen oben
        const outside = r.top >= vt - 0.5 && r.top - 36 >= hb + 4;
        const chipTop = outside ? r.top - 34 : Math.min(vt + 10, r.bottom - 38);
        frameLabel.textContent = labelOf(frameEl);
        frameLabel.hidden = false;
        frameLabel.style.left = Math.max(4, r.left + (outside ? 0 : 10)) + "px";
        frameLabel.style.top = chipTop + "px";

        frameBtn.hidden = !!openEl;
        if (!openEl) {
          const hasBadge = badges.has(frameEl.getAttribute("data-fb"));
          btnRight = Math.min(r.right, vw) - (outside ? 0 : 10 + (hasBadge ? 40 : 0));
          frameBtn.style.top = chipTop + "px";
          frameBtn.style.left = "0px";
          const w = frameBtn.offsetWidth;
          frameBtn.style.left = Math.max(4, btnRight - w) + "px";
        }
      } else {
        hideFrame();
      }
    } else {
      hideFrame();
    }

    // --- Badges
    badges.forEach((badge, id) => {
      const el = findEl(id);
      if (!state.mode || !el) { badge.hidden = true; return; }
      const r = el.getBoundingClientRect();
      const vt = visibleTop(el, r, hb);
      const top = Math.min(vt + 8, r.bottom - 38);
      // vt berücksichtigt bereits den Sticky-Header (bei Elementen im Header selbst: dessen Oberkante)
      const visible = isRendered(r) && top >= vt - 1 && r.top < vh && r.bottom > vt + 30;
      badge.hidden = !visible;
      if (visible) {
        badge.style.top = top + "px";
        badge.style.left = Math.min(Math.min(r.right, vw) - 10 - badge.offsetWidth, vw - badge.offsetWidth - 6) + "px";
      }
    });

    // --- Popover
    if (state.open && !pop.hidden) {
      if (window.matchMedia("(max-width: 640px)").matches) {
        pop.style.left = ""; pop.style.top = "";
      } else {
        const pw = pop.offsetWidth;
        const ph = pop.offsetHeight;
        // nicht unter die geöffnete Seitenleiste schieben
        const rightLimit = state.panelOpen ? vw - panel.offsetWidth : vw;
        let left, top;
        if (openEl) {
          const r = openEl.getBoundingClientRect();
          const vt = visibleTop(openEl, r, hb);
          if (rightLimit - r.right >= pw + 28) {          // rechts daneben
            left = r.right + 14; top = vt;
          } else if (r.left >= pw + 28) {                 // links daneben
            left = r.left - pw - 14; top = vt;
          } else {                                        // über dem Element, oben rechts
            left = Math.min(r.right, vw) - pw - 10;
            top = Math.min(vt + 10, r.bottom - 38) + 40;
          }
        } else {
          left = vw - pw - 16;
          top = vh - ph - 84;
        }
        left = Math.max(12, Math.min(left, rightLimit - pw - 12));
        top = Math.max(Math.max(8, hb + 8), Math.min(top, vh - ph - 76));
        if (top + ph > vh - 8) top = Math.max(8, vh - ph - 8);
        pop.style.left = left + "px";
        pop.style.top = top + "px";
      }
    }
  }
  function hideFrame() {
    frame.hidden = true;
    frameLabel.hidden = true;
    frameBtn.hidden = true;
  }

  /* ------------------------------------------------------------------ Badges rendern */
  function renderBadges() {
    const counts = new Map();
    state.comments.forEach((c) => {
      if (c.target === "page") return;
      const e = counts.get(c.target) || { open: 0, total: 0 };
      e.total += 1;
      if (!c.resolved) e.open += 1;
      counts.set(c.target, e);
    });
    // Entfernen, was es nicht mehr gibt
    badges.forEach((b, id) => {
      if (!counts.has(id) || !findEl(id)) { b.remove(); badges.delete(id); }
    });
    counts.forEach((e, id) => {
      if (!findEl(id)) return;
      let b = badges.get(id);
      if (!b) {
        b = h("button", { class: "fb-badge", type: "button", onclick: (ev) => { ev.stopPropagation(); openPopover(id); } });
        badgeLayer.appendChild(b);
        badges.set(id, b);
      }
      b.replaceChildren();
      const done = e.open === 0;
      b.classList.toggle("fb-badge--done", done);
      if (done) b.append(icon("check"));
      else b.append(String(e.open));
      const label = labelOf(findEl(id));
      b.setAttribute("aria-label", label + ": " + (done ? "alle " + e.total + " Kommentare erledigt" : e.open + " offene Kommentare"));
      b.title = b.getAttribute("aria-label");
    });
  }

  /* ------------------------------------------------------------------ Popover */
  function commentView(c, opts) {
    const inPanel = opts && opts.inPanel;
    const meta = h("div", { class: "fb-comment-meta" },
      h("span", { class: "fb-type fb-type--" + c.type, text: typeLabel(c.type) }),
      h("span", { class: "fb-comment-author", text: c.author || "Unbekannt" }),
      h("span", { text: fmtDate(c.created) + (c.updated && c.updated !== c.created ? " · bearbeitet" : "") }),
      c.resolved ? h("span", { class: "fb-status-done", text: "✓ erledigt" }) : null
    );
    const text = h("p", { class: "fb-comment-text", text: c.text });
    if (inPanel) {
      return h("button", {
        class: "fb-list-item" + (c.resolved ? " is-resolved" : ""),
        type: "button",
        onclick: () => jumpTo(c.target),
      }, meta, text);
    }

    const delBtn = h("button", { class: "fb-link-btn is-danger", type: "button", text: "Löschen" });
    let armed = false;
    let armTimer = 0;
    delBtn.addEventListener("click", () => {
      if (!armed) {
        armed = true;
        delBtn.textContent = "Wirklich löschen?";
        armTimer = setTimeout(() => { armed = false; delBtn.textContent = "Löschen"; }, 3500);
        return;
      }
      clearTimeout(armTimer);
      deleteComment(c.id);
    });

    return h("div", { class: "fb-comment" + (c.resolved ? " is-resolved" : "") },
      meta, text,
      h("div", { class: "fb-comment-actions" },
        h("button", { class: "fb-link-btn", type: "button", text: c.resolved ? "Wieder öffnen" : "Als erledigt markieren", onclick: () => toggleResolved(c.id) }),
        h("button", { class: "fb-link-btn", type: "button", text: "Bearbeiten", onclick: () => startEdit(c.id) }),
        delBtn
      )
    );
  }

  let threadEl = null;
  function renderThread() {
    if (!threadEl || !state.open) return;
    threadEl.replaceChildren(...commentsFor(state.open).map((c) => commentView(c)));
  }

  function renderPopover() {
    if (!state.open) { pop.hidden = true; pop.replaceChildren(); threadEl = null; return; }
    const info = targetInfo(state.open);
    const editing = state.editing ? state.comments.find((c) => c.id === state.editing) : null;
    const draft = state.drafts[state.open] || { text: "", type: "change" };
    const current = editing ? { text: editing.text, type: editing.type } : draft;

    threadEl = h("div", { class: "fb-thread" });

    const typeGroupName = "fb-type-" + Math.random().toString(36).slice(2, 7);
    const types = h("div", { class: "fb-types", role: "radiogroup", "aria-label": "Art des Kommentars" },
      TYPES.map((t) => h("label", null,
        h("input", { type: "radio", name: typeGroupName, value: t.id, checked: current.type === t.id }),
        h("span", { "data-type": t.id, text: t.label })
      ))
    );
    const textarea = h("textarea", {
      rows: "4",
      placeholder: editing ? "Kommentar bearbeiten …" : "Was gefällt Ihnen, was soll anders werden?",
      "aria-label": "Kommentar",
      maxlength: "4000",
    });
    textarea.value = current.text;

    const needName = !state.author;
    const nameInput = needName ? h("input", { type: "text", placeholder: "z. B. Johann Moschalow", autocomplete: "name", maxlength: "80", "aria-label": "Ihr Name" }) : null;
    const errorEl = h("p", { class: "fb-error", hidden: true });
    const saveBtn = h("button", { class: "fb-btn fb-btn-primary", type: "submit", text: editing ? "Änderung speichern" : "Kommentar speichern" });

    const hint = needName
      ? h("span", { class: "fb-hint", text: "Strg + Enter zum Speichern" })
      : h("span", { class: "fb-hint" }, "als " + state.author + " · ",
          h("button", { type: "button", text: "ändern", onclick: () => { openPanel(); setTimeout(() => panelNameInput.focus(), 50); } }));

    const form = h("form", { class: "fb-composer", novalidate: true },
      types,
      textarea,
      needName ? h("label", { class: "fb-field-label", text: "Ihr Name" }) : null,
      nameInput,
      errorEl,
      h("div", { class: "fb-composer-foot" },
        hint,
        h("div", { style: "display:flex;gap:6px" },
          editing ? h("button", { class: "fb-btn fb-btn-secondary", type: "button", text: "Abbrechen", onclick: () => { state.editing = null; renderPopover(); } }) : null,
          saveBtn
        )
      )
    );
    if (nameInput) {
      const lbl = form.querySelector(".fb-field-label");
      const id = "fb-name-" + typeGroupName;
      nameInput.id = id;
      lbl.setAttribute("for", id);
    }

    function currentType() {
      const checked = form.querySelector("input[type=radio]:checked");
      return checked ? checked.value : "change";
    }
    function rememberDraft() {
      if (editing) return;
      state.drafts[state.open] = { text: textarea.value, type: currentType() };
    }
    textarea.addEventListener("input", () => { rememberDraft(); errorEl.hidden = true; });
    types.addEventListener("change", rememberDraft);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true })); }
    });

    const targetId = state.open;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = textarea.value.trim();
      if (!text) { errorEl.textContent = "Bitte geben Sie einen Kommentar ein."; errorEl.hidden = false; textarea.focus(); return; }
      if (nameInput) {
        const name = nameInput.value.trim();
        if (!name) { errorEl.textContent = "Bitte geben Sie Ihren Namen an."; errorEl.hidden = false; nameInput.focus(); return; }
        setAuthor(name);
      }
      saveBtn.disabled = true;
      const ok = editing
        ? await updateComment(editing.id, { text, type: currentType() })
        : await createComment(targetId, info.label, currentType(), text);
      saveBtn.disabled = false;
      if (ok) {
        if (editing) state.editing = null;
        else delete state.drafts[targetId];
        if (state.open === targetId) renderPopover();
      } else {
        errorEl.textContent = "Konnte nicht gespeichert werden. Bitte erneut versuchen.";
        errorEl.hidden = false;
      }
    });

    const head = h("div", { class: "fb-pop-head" },
      h("div", { class: "fb-pop-title" },
        h("div", { class: "fb-pop-kicker", text: info.el || info.id === "page" ? "Kommentare zu" : "Kommentare zu (nicht mehr vorhanden)" }),
        h("div", { class: "fb-pop-name", id: "fb-pop-name", text: info.label })
      ),
      h("button", { class: "fb-icon-btn", type: "button", "aria-label": "Schließen", onclick: closePopover }, icon("close"))
    );
    pop.setAttribute("aria-labelledby", "fb-pop-name");
    pop.replaceChildren(head, threadEl, form);
    pop.hidden = false;
    renderThread();
    schedule();
    requestAnimationFrame(() => {
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  }

  function openPopover(id) {
    if (!state.mode) setMode(true);
    state.open = id;
    state.editing = null;
    state.hover = null;
    renderPopover();
    document.dispatchEvent(new CustomEvent("feedback:pause"));
  }
  function closePopover() {
    if (!state.open) return;
    state.open = null;
    state.editing = null;
    renderPopover();
    schedule();
    document.dispatchEvent(new CustomEvent("feedback:resume"));
  }
  function startEdit(id) {
    state.editing = id;
    renderPopover();
  }

  function jumpTo(targetId) {
    const el = findEl(targetId);
    if (window.matchMedia("(max-width: 640px)").matches) closePanel();
    if (el) {
      el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      // Popover nach dem Scrollen öffnen
      setTimeout(() => openPopover(targetId), 350);
    } else {
      openPopover(targetId);
    }
  }

  /* ------------------------------------------------------------------ CRUD */
  async function createComment(target, label, type, text) {
    const now = new Date().toISOString();
    const c = {
      v: 1,
      id: newId(),
      target,
      targetLabel: label,
      type,
      text,
      author: state.author,
      created: now,
      updated: now,
      resolved: false,
      page: location.pathname,
    };
    state.comments.push(c);
    renderAll();
    try {
      await storage.save(c);
      showToast(state.backend === "server" ? "Kommentar gespeichert" : "Kommentar lokal gespeichert");
      return true;
    } catch (err) {
      state.comments = state.comments.filter((x) => x.id !== c.id);
      renderAll();
      showToast(err.message, true);
      return false;
    }
  }

  async function updateComment(id, patch) {
    const idx = state.comments.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    const before = state.comments[idx];
    const after = Object.assign({}, before, patch, { updated: new Date().toISOString() });
    state.comments[idx] = after;
    renderAll();
    try {
      await storage.save(after);
      return true;
    } catch (err) {
      const i = state.comments.findIndex((c) => c.id === id);
      if (i >= 0) state.comments[i] = before;
      renderAll();
      showToast(err.message, true);
      return false;
    }
  }

  async function toggleResolved(id) {
    const c = state.comments.find((x) => x.id === id);
    if (!c) return;
    const ok = await updateComment(id, { resolved: !c.resolved });
    if (ok) showToast(c.resolved ? "Wieder geöffnet" : "Als erledigt markiert");
  }

  async function deleteComment(id) {
    const c = state.comments.find((x) => x.id === id);
    if (!c) return;
    state.comments = state.comments.filter((x) => x.id !== id);
    if (state.editing === id) state.editing = null;
    renderAll();
    try {
      await storage.remove(id);
      showToast("Kommentar gelöscht");
    } catch (err) {
      state.comments.push(c);
      renderAll();
      showToast(err.message, true);
    }
  }

  function setAuthor(name) {
    state.author = name.trim().slice(0, 80);
    lsSet(LS.name, state.author || null);
    if (panelNameInput && document.activeElement !== panelNameInput) panelNameInput.value = state.author;
  }

  /* ------------------------------------------------------------------ Seitenleiste */
  const panelNameInput = h("input", { type: "text", id: "fb-panel-name", placeholder: "Ihr Name", autocomplete: "name", maxlength: "80" });
  const targetSelect = h("select", { id: "fb-target-select", "aria-label": "Bereich wählen" });
  const panelList = h("div", { class: "fb-panel-list" });
  const storageInfo = h("span", { class: "fb-storage" });
  const tabs = [["all", "Alle"], ["open", "Offen"], ["done", "Erledigt"]].map(([id, label]) =>
    h("button", { class: "fb-tab", type: "button", role: "tab", "data-filter": id, text: label, onclick: () => { state.filter = id; renderPanel(); } })
  );
  const panelCount = h("span", { class: "fb-count", text: "0" });

  panelNameInput.value = state.author;
  panelNameInput.addEventListener("change", () => { setAuthor(panelNameInput.value); renderPopoverIfIdle(); showToast("Name gespeichert"); });

  panel.append(
    h("div", { class: "fb-panel-head" },
      h("div", { class: "fb-panel-title" }, "Kommentare ", panelCount),
      h("button", { class: "fb-icon-btn", type: "button", "aria-label": "Seitenleiste schließen", onclick: () => closePanel() }, icon("close"))
    ),
    h("div", { class: "fb-panel-section" },
      h("label", { class: "fb-field-label", for: "fb-panel-name", style: "margin-top:0", text: "Ihr Name" }),
      panelNameInput,
      h("label", { class: "fb-field-label", for: "fb-target-select", text: "Neuer Kommentar zu …" }),
      h("div", { class: "fb-panel-row" },
        targetSelect,
        h("button", { class: "fb-btn fb-btn-primary", type: "button", onclick: () => jumpTo(targetSelect.value) }, icon("plus"), "Kommentieren")
      )
    ),
    h("div", { class: "fb-tabs", role: "tablist", "aria-label": "Filter" }, tabs),
    panelList,
    h("div", { class: "fb-panel-foot" },
      storageInfo,
      h("button", { class: "fb-btn fb-btn-secondary", type: "button", text: "Als Markdown exportieren", onclick: exportMarkdown })
    )
  );

  function renderTargetSelect() {
    const prev = targetSelect.value;
    targetSelect.replaceChildren(...allTargets().map((t) => h("option", { value: t.id, text: t.label })));
    if (prev) targetSelect.value = prev;
  }

  function renderPanel() {
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.getAttribute("data-filter") === state.filter)));
    storageInfo.className = "fb-storage" + (state.backend === "local" ? " is-local" : "") + (state.offline ? " is-offline" : "");
    storageInfo.textContent = state.offline
      ? "Server nicht erreichbar"
      : state.backend === "server"
        ? "Gespeichert auf dem Server"
        : state.backend === "local" ? "Nur in diesem Browser gespeichert" : "Lädt …";
    if (!state.panelOpen) return;

    const filtered = state.comments.filter((c) =>
      state.filter === "all" ? true : state.filter === "open" ? !c.resolved : c.resolved);
    const groups = [];
    const known = new Set();
    allTargets().forEach((t) => {
      known.add(t.id);
      const items = filtered.filter((c) => c.target === t.id).sort(byCreated);
      if (items.length) groups.push({ id: t.id, label: t.label, items });
    });
    const orphans = filtered.filter((c) => !known.has(c.target)).sort(byCreated);
    if (orphans.length) groups.push({ id: null, label: "Ohne Zuordnung (Bereich entfernt)", items: orphans });

    if (!groups.length) {
      panelList.replaceChildren(h("p", { class: "fb-empty", text:
        state.comments.length ? "Keine Kommentare in diesem Filter." : "Noch keine Kommentare. Fahren Sie mit der Maus über einen Bereich der Seite und klicken Sie auf „Kommentieren“." }));
      return;
    }
    panelList.replaceChildren(...groups.flatMap((g) => [
      h("p", { class: "fb-group-title" },
        g.id ? h("button", { type: "button", text: g.label + " (" + g.items.length + ")", onclick: () => jumpTo(g.id) }) : g.label),
      ...g.items.map((c) => commentView(c, { inPanel: true })),
    ]));
  }

  function openPanel() {
    state.panelOpen = true;
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    listBtn.setAttribute("aria-expanded", "true");
    renderTargetSelect();
    renderPanel();
  }
  function closePanel() {
    state.panelOpen = false;
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    listBtn.setAttribute("aria-expanded", "false");
  }

  /* ------------------------------------------------------------------ Werkzeugleiste */
  function renderBar() {
    modeBtn.setAttribute("aria-pressed", String(state.mode));
    modeBtn.querySelector(".fb-mode-text").textContent = state.mode ? "Kommentieren: an" : "Kommentieren: aus";
    const open = state.comments.filter((c) => !c.resolved).length;
    countEl.textContent = String(open);
    countEl.classList.toggle("has-open", open > 0);
    countEl.title = open + " offen / " + state.comments.length + " gesamt";
    panelCount.textContent = String(state.comments.length);
    document.documentElement.classList.toggle("fb-mode-on", state.mode);
  }

  function setMode(on) {
    state.mode = on;
    lsSet(LS.mode, on ? "on" : "off");
    if (!on) { state.hover = null; closePopover(); }
    renderBar();
    schedule();
  }

  modeBtn.addEventListener("click", () => {
    setMode(!state.mode);
    showToast(state.mode ? "Kommentar-Modus aktiviert" : "Kommentar-Modus aus – Sie sehen die Seite ohne Markierungen");
  });
  generalBtn.addEventListener("click", () => openPopover("page"));
  listBtn.addEventListener("click", () => (state.panelOpen ? closePanel() : openPanel()));
  helpBtn.addEventListener("click", () => showIntro());

  /* ------------------------------------------------------------------ Willkommens-Dialog */
  function showIntro() {
    const nameIn = h("input", { type: "text", id: "fb-intro-name", placeholder: "Ihr Name", autocomplete: "name", maxlength: "80" });
    nameIn.value = state.author;
    let modal;
    const close = () => {
      if (nameIn.value.trim()) setAuthor(nameIn.value);
      lsSet(LS.intro, "1");
      modal.remove();
      document.removeEventListener("keydown", onKey, true);
      renderPopoverIfIdle();
      renderPanel();
      helpBtn.focus({ preventScroll: true });
    };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    modal = h("div", { class: "fb-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "fb-intro-title",
      onclick: (e) => { if (e.target === modal) close(); } },
      h("form", { class: "fb-modal-card", onsubmit: (e) => { e.preventDefault(); close(); } },
        h("h2", { id: "fb-intro-title", text: "Willkommen zu Ihrem Website-Entwurf" }),
        h("p", { text: "Sie können jeden größeren Bereich dieser Seite direkt kommentieren. So entsteht Schritt für Schritt Ihre Wunsch-Website." }),
        h("ol", { class: "fb-steps" },
          h("li", { text: "Fahren Sie mit der Maus über einen Bereich (auf dem Handy: antippen)." }),
          h("li", { text: "Klicken Sie auf „Kommentieren“ und wählen Sie: Gefällt mir, Bitte ändern oder Frage / Idee." }),
          h("li", { text: "Ihre Kommentare werden gespeichert und bleiben auch nach dem Neuladen sichtbar." })
        ),
        h("p", { class: "fb-note", text: "Hinweis: Texte, Preise, Kundenstimmen, Referenzen und Bilder sind Platzhalter für den Entwurf. Allgemeines Feedback zu Farben und Schriften geben Sie über „Gesamteindruck“ unten in der Leiste." }),
        h("label", { class: "fb-field-label", for: "fb-intro-name", text: "Wie dürfen wir Sie nennen?" }),
        nameIn,
        h("div", { class: "fb-modal-foot" },
          h("button", { class: "fb-btn fb-btn-primary", type: "submit", text: "Entwurf ansehen" })
        )
      )
    );
    root.appendChild(modal);
    document.addEventListener("keydown", onKey, true);
    requestAnimationFrame(() => nameIn.focus());
  }

  /* ------------------------------------------------------------------ Export */
  function exportMarkdown() {
    const lines = [
      "# Feedback zum Website-Entwurf",
      "",
      "- Seite: " + location.href,
      "- Exportiert: " + dateFmt.format(new Date()),
      "- Kommentare: " + state.comments.length + " (" + state.comments.filter((c) => !c.resolved).length + " offen)",
      "",
    ];
    const known = new Set();
    const emit = (label, items) => {
      if (!items.length) return;
      lines.push("## " + label, "");
      items.forEach((c) => {
        lines.push("- **" + typeLabel(c.type) + "**" + (c.resolved ? " _(erledigt)_" : "") + " – " + (c.author || "Unbekannt") + ", " + fmtDate(c.created));
        c.text.split(/\r?\n/).forEach((l) => lines.push("  > " + l));
        lines.push("");
      });
    };
    allTargets().forEach((t) => { known.add(t.id); emit(t.label, commentsFor(t.id)); });
    emit("Ohne Zuordnung", state.comments.filter((c) => !known.has(c.target)).sort(byCreated));

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: "feedback-entwurf-" + new Date().toISOString().slice(0, 10) + ".md" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ------------------------------------------------------------------ Rendern */
  function renderAll() {
    renderBadges();
    renderThread();
    renderBar();
    renderPanel();
    schedule();
  }
  function renderPopoverIfIdle() {
    if (state.open && !pop.contains(document.activeElement)) renderPopover();
  }

  /* ------------------------------------------------------------------ Ereignisse */
  document.addEventListener("mouseover", (e) => {
    if (!state.mode || state.open) return;
    if (root.contains(e.target)) return; // über Button/Badge: aktuelles Ziel behalten
    const el = e.target.closest ? e.target.closest("[data-fb]") : null;
    if (el !== state.hover) { state.hover = el; schedule(); }
  }, true);
  document.documentElement.addEventListener("mouseleave", () => {
    if (state.hover) { state.hover = null; schedule(); }
  });
  // Touch: Antippen wählt den Bereich (ohne Links zu blockieren)
  document.addEventListener("pointerdown", (e) => {
    if (state.open && !root.contains(e.target)) closePopover();
    if (e.pointerType !== "touch" || !state.mode || root.contains(e.target)) return;
    const el = e.target.closest ? e.target.closest("[data-fb]") : null;
    if (el !== state.hover) { state.hover = el; schedule(); }
  }, true);

  frameBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.hover) openPopover(state.hover.getAttribute("data-fb"));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (state.open) { closePopover(); return; }
    if (state.panelOpen) { closePanel(); listBtn.focus(); }
  });

  window.addEventListener("scroll", schedule, { passive: true, capture: true });
  window.addEventListener("resize", schedule, { passive: true });
  document.addEventListener("transitionend", schedule, true);
  document.addEventListener("feedback:relayout", schedule);
  if ("ResizeObserver" in window) new ResizeObserver(schedule).observe(document.body);

  /* ------------------------------------------------------------------ Laden & Aktualisieren */
  let loading = false;
  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      const list = await storage.load();
      state.comments = list;
      if (state.editing && !list.some((c) => c.id === state.editing)) state.editing = null;
    } catch (err) {
      // offline: vorhandene Daten behalten
    } finally {
      loading = false;
    }
    renderAll();
  }

  function init() {
    document.body.appendChild(root);
    renderBar();
    renderPanel();
    refresh();
    setInterval(() => { if (!document.hidden && state.backend === "server") refresh(); }, POLL_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && state.backend === "server") refresh(); });
    if (!lsGet(LS.intro)) showIntro();
  }

  window.FeedbackTool = Object.freeze({ version: VERSION, api: API });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
