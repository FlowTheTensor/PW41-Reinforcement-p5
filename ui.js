// =============================================================================
//  ui.js – HTML-Bedienelemente über der Zeichenfläche
// =============================================================================
//  Alle Positionen werden im logischen 1600×900-Raster angegeben und beim
//  Ändern der Fenstergröße mitskaliert (siehe layoutUi).
// =============================================================================

const ui = {};
const uiPositionen = [];
let huelle;

function platziere(el, x, y, w, ...klassen) {
  el.addClass("ui");
  for (const k of klassen) {
    el.addClass(k);
  }
  el.parent(huelle);
  uiPositionen.push({ el, x, y, w });
  return el;
}

function layoutUi() {
  huelle.style("width", width + "px");
  huelle.style("font-size", 15 * S + "px");
  for (const p of uiPositionen) {
    p.el.position(p.x * S, p.y * S);
    if (p.w) {
      p.el.style("width", p.w * S + "px");
    }
  }
}

// Nach dem Anklicken den Fokus abgeben, damit die Pfeiltasten wieder wirken
function fokusWeg(el) {
  const inp = el.elt.querySelector ? el.elt.querySelector("input, select") : null;
  (inp || el.elt).blur();
}

function erstelleUi() {
  huelle = createDiv();
  huelle.addClass("huelle");

  // --- Kopfzeile -------------------------------------------------------------
  ui.logo = platziere(createImg("assets/logo-jps.png", "Logo der Jakob-Preh-Schule"), 14, 3, 122, "logo");

  ui.aufgabe = platziere(createSelect(), 190, 30, 244, "aufgabe");
  for (const id of SZENARIO_LISTE) {
    ui.aufgabe.option(SZENARIEN[id].name, id);
  }
  ui.aufgabe.changed(() => {
    if (laeuft) {
      ui.aufgabe.selected(sz.id);
    } else {
      szenarioWechseln(ui.aufgabe.value());
    }
    ui.aufgabe.elt.blur();
  });

  ui.modi = {};
  const modi = [
    ["mensch", "Selbst steuern", 446, 140],
    ["zufall", "Zufall", 592, 84],
    ["training", "Training", 682, 104],
    ["vorfuehren", "Vorführen", 792, 112],
  ];
  for (const [name, text, x, w] of modi) {
    ui.modi[name] = platziere(createButton(text), x, 12, w, "kopf");
    ui.modi[name].mousePressed(() => setzeModus(name));
  }

  ui.aktion = platziere(createButton("▶ Training starten"), 920, 12, 224, "primaer");
  ui.aktion.mousePressed(aktionsKnopf);

  ui.neu = platziere(createButton("Q-Tabelle leeren"), 1206, 12, 166, "kopf");
  ui.neu.mousePressed(neuStarten);

  ui.laden = platziere(createButton("Laden"), 1378, 12, 96, "kopf");
  ui.laden.mousePressed(() => ui.datei.elt.click());

  ui.speichern = platziere(createButton("Speichern"), 1480, 12, 106, "kopf");
  ui.speichern.mousePressed(tabelleSpeichern);

  ui.datei = createFileInput(dateiGewaehlt);
  ui.datei.parent(huelle);
  ui.datei.hide();

  // --- Q-Tabelle: Export für die SPS -------------------------------------------
  ui.export = platziere(createButton("SPS-Export"), 1452, 89, 116, "klein");
  ui.export.mousePressed(exportOeffnen);

  // --- Erklärung -------------------------------------------------------------
  ui.schritt = platziere(createButton("Schritt ▶ (→)"), 40, 846, 190, "dunkel");
  ui.schritt.mousePressed(schrittVor);

  ui.phasen = platziere(createCheckbox(" Phasen einzeln", true), 244, 851, 150);
  ui.phasen.changed(() => fokusWeg(ui.phasen));

  // --- Einstellungen: linke Spalte (Lernen) -----------------------------------
  ui.alphaText = platziere(createSpan(""), 878, 716, 100);
  ui.alpha = platziere(createSlider(0.01, 1, agent.alpha, 0.01), 980, 722, 230);
  ui.alpha.input(() => {
    agent.alpha = Number(ui.alpha.value());
  });
  ui.alpha.changed(() => ui.alpha.elt.blur());

  ui.gammaText = platziere(createSpan(""), 878, 748, 100);
  ui.gamma = platziere(createSlider(0, 0.99, agent.gamma, 0.01), 980, 754, 230);
  ui.gamma.input(() => {
    agent.gamma = Number(ui.gamma.value());
  });
  ui.gamma.changed(() => ui.gamma.elt.blur());

  ui.epsText = platziere(createSpan(""), 878, 780, 100);
  ui.eps = platziere(createSlider(0, 1, agent.epsilon, 0.01), 980, 786, 230);
  ui.eps.input(() => {
    agent.epsilon = Number(ui.eps.value());
  });
  ui.eps.changed(() => ui.eps.elt.blur());

  ui.epsAb = platziere(createCheckbox(" ε nimmt nach jeder Episode ab (· 0,97)", true), 878, 814, 340);
  ui.epsAb.changed(() => fokusWeg(ui.epsAb));

  platziere(createSpan("Episoden je Training"), 878, 846, 170);
  ui.episoden = platziere(createSelect(), 1050, 846, 90);
  for (const e of [20, 50, 100, 200, 300, 500, 1000, 2000]) {
    ui.episoden.option(String(e), String(e));
  }
  ui.episoden.changed(() => {
    episodenZiel = parseInt(ui.episoden.value(), 10);
    ui.episoden.elt.blur();
  });

  // --- Einstellungen: rechte Spalte (Aufgabe) ---------------------------------
  // zwei Auswahllisten, deren Inhalt das Szenario festlegt
  ui.opt = [];
  for (let i = 0; i < 2; i++) {
    const y = 714 + i * 34;
    const name = platziere(createSpan(""), 1240, y + 2, 84);
    const liste = platziere(createSelect(), 1326, y, 238);
    liste.changed(() => {
      if (!laeuft) {
        optionAendern(i, liste.value());
      }
      liste.selected(sz.einstellung[sz.optionen[i].key]);
      liste.elt.blur();
    });
    ui.opt.push({ name, liste });
  }

  platziere(createSpan("Tempo"), 1240, 784, 84);
  ui.tempo = platziere(createSelect(), 1326, 782, 238);
  for (const t of TEMPI) {
    ui.tempo.option(t, t);
  }
  ui.tempo.selected(tempo);
  ui.tempo.changed(() => {
    tempo = ui.tempo.value();
    ui.tempo.elt.blur();
  });

  erstelleExportFenster();
  uiAusAgent();
}

// Bedienelemente an das aktive Szenario anpassen (Optionen, Episoden …)
function uiAusSzenario() {
  ui.aufgabe.selected(sz.id);
  for (let i = 0; i < 2; i++) {
    const o = sz.optionen[i];
    const { name, liste } = ui.opt[i];
    zeige(name, !!o);
    zeige(liste, !!o);
    if (!o) {
      continue;
    }
    beschrifte(name, o.name);
    liste.elt.innerHTML = "";
    for (const [wert, text] of o.werte) {
      liste.option(text, wert);
    }
    liste.selected(sz.einstellung[o.key]);
  }
  ui.episoden.selected(String(episodenZiel));
  uiAusAgent();
}

// Bedienelemente an den Zustand des Agenten anpassen (z. B. nach dem Laden)
function uiAusAgent() {
  ui.alpha.value(agent.alpha);
  ui.gamma.value(agent.gamma);
  ui.eps.value(agent.epsilon);
  for (let i = 0; i < sz.optionen.length && i < 2; i++) {
    ui.opt[i].liste.selected(sz.einstellung[sz.optionen[i].key]);
  }
}

// --- kleine Helfer, damit das DOM nur bei echten Änderungen angefasst wird ---
function zeige(el, sichtbar) {
  if (el._sichtbar !== sichtbar) {
    if (sichtbar) {
      el.show();
    } else {
      el.hide();
    }
    el._sichtbar = sichtbar;
  }
}

function beschrifte(el, html) {
  if (el._html !== html) {
    el.html(html);
    el._html = html;
  }
}

function sperre(el, gesperrt) {
  if (el.elt.disabled !== gesperrt) {
    el.elt.disabled = gesperrt;
  }
}

function klasse(el, name, an) {
  if (an) {
    el.addClass(name);
  } else {
    el.removeClass(name);
  }
}

// wird in jedem Frame aufgerufen
function aktualisiereUi() {
  for (const name of Object.keys(ui.modi)) {
    klasse(ui.modi[name], "aktiv", modus === name);
    sperre(ui.modi[name], laeuft && modus !== "mensch");
  }

  const texte = {
    mensch: ["▶ Versuch starten", "■ Abbrechen"],
    zufall: ["▶ Zufall starten", "■ Zufall stoppen"],
    training: ["▶ Training starten", "■ Training stoppen"],
    vorfuehren: ["▶ Vorführen", "■ Vorführen stoppen"],
  };
  if (menschDiskret()) {
    beschrifte(ui.aktion, "↺ Neu beginnen");
  } else {
    beschrifte(ui.aktion, texte[modus][laeuft ? 1 : 0]);
  }
  klasse(ui.aktion, "primaer", !laeuft);
  klasse(ui.aktion, "dunkel", laeuft);

  beschrifte(ui.alphaText, "α = " + agent.alpha.toFixed(2));
  beschrifte(ui.gammaText, "γ = " + agent.gamma.toFixed(2));
  beschrifte(ui.epsText, "ε = " + agent.epsilon.toFixed(2));
  const epsLabel = ui.epsAb.elt.querySelector("span");
  if (epsLabel) {
    const t = ` ε nimmt nach jeder Episode ab (· ${String(agent.epsilonFaktor).replace(".", ",")})`;
    if (epsLabel.textContent !== t) {
      epsLabel.textContent = t;
    }
  }
  // ε ändert sich während des Trainings – Regler mitführen
  if (Math.abs(Number(ui.eps.value()) - agent.epsilon) > 0.005) {
    ui.eps.value(agent.epsilon);
  }

  zeige(ui.schritt, modus !== "mensch");
  zeige(ui.phasen, modus !== "mensch");
  sperre(ui.schritt, laeuft);
  if (phase === "ende") {
    beschrifte(ui.schritt, "Neue Episode ▶ (→)");
  } else if (ui.phasen.checked() && phase !== "bereit") {
    beschrifte(ui.schritt, "Weiter ▶ (→)");
  } else {
    beschrifte(ui.schritt, "Schritt ▶ (→)");
  }

  zeige(ui.export, !!sz.export);
  for (const el of [ui.neu, ui.laden, ui.aufgabe, ui.export, ui.opt[0].liste, ui.opt[1].liste]) {
    sperre(el, laeuft);
  }
}

// =============================================================================
// Fenster für den SPS-Export
// =============================================================================
function erstelleExportFenster() {
  ui.exp = createDiv();
  ui.exp.addClass("export");
  ui.exp.parent(huelle);
  ui.exp.html(`
    <div class="export-karte" role="dialog" aria-modal="true" aria-labelledby="export-titel">
      <div class="export-kopf">
        <span class="punkt"></span>
        <h2 id="export-titel">Strategie für die SPS</h2>
        <button class="export-zu" title="Schließen (Esc)">✕</button>
      </div>
      <p class="export-text"></p>
      <textarea readonly spellcheck="false"></textarea>
      <div class="export-fuss">
        <button class="ex-kopieren">In die Zwischenablage</button>
        <button class="ex-laden">Als .scl herunterladen</button>
        <span class="export-status"></span>
      </div>
    </div>`);
  const q = (sel) => ui.exp.elt.querySelector(sel);
  q(".export-zu").addEventListener("click", exportSchliessen);
  ui.exp.elt.addEventListener("click", (ev) => {
    if (ev.target === ui.exp.elt) {
      exportSchliessen();
    }
  });
  q(".ex-kopieren").addEventListener("click", () => {
    const ta = q("textarea");
    const fertig = () => (q(".export-status").textContent = "Kopiert.");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(fertig, () => {
        ta.select();
        document.execCommand("copy");
        fertig();
      });
    } else {
      ta.select();
      document.execCommand("copy");
      fertig();
    }
  });
  q(".ex-laden").addEventListener("click", () => {
    herunterladen(datumsName("strategie.scl"), q("textarea").value, "text/plain");
  });
  ui.exp.hide();
}

function exportOffen() {
  return !!(ui.exp && ui.exp.elt.style.display !== "none");
}

function exportOeffnen() {
  if (!sz.export || laeuft) {
    return;
  }
  const q = (sel) => ui.exp.elt.querySelector(sel);
  q(".export-text").textContent = sz.export.erklaerung;
  q("textarea").value = sclCode();
  q(".export-status").textContent = "";
  ui.exp.style("display", "flex"); // show() würde "block" setzen
  q("textarea").scrollTop = 0;
  q(".export-zu").focus();
}

function exportSchliessen() {
  ui.exp.hide();
}
