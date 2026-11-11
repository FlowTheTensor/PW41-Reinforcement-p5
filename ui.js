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
  ui.gamma = platziere(createSlider(0.5, 0.99, agent.gamma, 0.01), 980, 754, 230);
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
  for (const e of [50, 100, 200, 300, 500, 1000, 2000]) {
    ui.episoden.option(String(e), String(e));
  }
  ui.episoden.selected(String(episodenZiel));
  ui.episoden.changed(() => {
    episodenZiel = parseInt(ui.episoden.value(), 10);
    ui.episoden.elt.blur();
  });

  // --- Einstellungen: rechte Spalte (Aufgabe) ---------------------------------
  platziere(createSpan("Zustand"), 1240, 716, 80);
  ui.zustand = platziere(createSelect(), 1320, 714, 244);
  for (const art of Object.keys(ZUSTAENDE)) {
    const f = ZUSTAENDE[art].faecher;
    const n = f.x * f.v * f.theta * f.omega;
    ui.zustand.option(`${ZUSTAENDE[art].name} (${n})`, art);
  }
  ui.zustand.changed(() => {
    const art = ui.zustand.value();
    if (art !== agent.art) {
      if (confirm("Achtung: Die Q-Tabelle wird neu angelegt, alles Gelernte geht verloren.")) {
        agent.neuAufbauen(art);
        agent.epsilon = 1;
        kurve = [];
        allesZuruecksetzen();
      }
    }
    ui.zustand.selected(agent.art);
    ui.zustand.elt.blur();
  });

  platziere(createSpan("Belohnung"), 1240, 750, 90);
  ui.belohnung = platziere(createSelect(), 1330, 748, 230);
  ui.belohnung.option("+1 je Schritt", "0");
  ui.belohnung.option("+1 je Schritt, Strafe −100", "-100");
  ui.belohnung.changed(() => {
    agent.strafe = Number(ui.belohnung.value());
    ui.belohnung.elt.blur();
  });

  platziere(createSpan("Tempo"), 1240, 784, 90);
  ui.tempo = platziere(createSelect(), 1330, 782, 230);
  for (const t of TEMPI) {
    ui.tempo.option(t, t);
  }
  ui.tempo.selected(tempo);
  ui.tempo.changed(() => {
    tempo = ui.tempo.value();
    ui.tempo.elt.blur();
  });

  uiAusAgent();
}

// Bedienelemente an den Zustand des Agenten anpassen (z. B. nach dem Laden)
function uiAusAgent() {
  ui.alpha.value(agent.alpha);
  ui.gamma.value(agent.gamma);
  ui.eps.value(agent.epsilon);
  ui.zustand.selected(agent.art);
  ui.belohnung.selected(String(agent.strafe));
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
  beschrifte(ui.aktion, texte[modus][laeuft ? 1 : 0]);
  klasse(ui.aktion, "primaer", !laeuft);
  klasse(ui.aktion, "dunkel", laeuft);

  beschrifte(ui.alphaText, "α = " + agent.alpha.toFixed(2));
  beschrifte(ui.gammaText, "γ = " + agent.gamma.toFixed(2));
  beschrifte(ui.epsText, "ε = " + agent.epsilon.toFixed(2));
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

  for (const el of [ui.neu, ui.laden, ui.zustand]) {
    sperre(el, laeuft);
  }
}
