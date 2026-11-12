// =============================================================================
//  KI lernt · Reinforcement Learning
//  Ein Agent lernt mit Q-Learning – nur durch Ausprobieren und Belohnung.
//  Aufgaben: Wagen mit Stab, Sortierstation, Wartung, Hochregallager.
// =============================================================================
//
//  Dateien
//    agent.js              Q-Learning mit Tabelle (kennt die Aufgabe nicht)
//    ui.js                 Knöpfe, Auswahllisten, Regler
//    sketch.js             Ablauf, Phasen, Lernkurve, Q-Tabelle, Erklärung (diese Datei)
//    szenarien/*.js        die Aufgaben: Umgebung, Zeichnung, Erklärtexte
//
//  Bedienung
//    →          ein Schritt des Agenten (Phase für Phase)
//    Leertaste  Start / Stopp
//    Selbst steuern: ← → (Wagen) bzw. Zifferntasten 1–4
//
//  Ein Szenario ist ein Objekt mit festen Bestandteilen (siehe szenarien/wagen.js):
//    id, name, titel, umgebungTitel, umgebungKurz, regelText
//    optionen, einstellung, vorgaben {alpha, gamma, episoden}, dt
//    aktionen(), anzahl(), zuruecksetzen(), zustand(), einordnen(z), schritt(a)
//    episodenWert(), episodenErgebnis(), kurve {titel, min, max, ticks, einheit, leer}
//    zeichneUmgebung(ansicht), qZelle(s), zeichneQAchsen(), zustandsZeilen(s)
//    texte {…}, mensch, menschAktion(taste), klick(x, y), export
//
//  Läuft mit p5.js 1.x und 2.x.
//  Hinweis: Alle Schleifen haben geschweifte Klammern – der p5-Web-Editor
//  kommt mit Schleifen ohne Klammern nicht zurecht.
// =============================================================================

// -----------------------------------------------------------------------------
// Layout (logisches Raster 1600 × 900, wird auf die Fenstergröße skaliert)
// -----------------------------------------------------------------------------
const W = 1600;
const H = 900;
let S = 1;

// Schriften der Jakob-Preh-Schule (Google Fonts, siehe index.html).
// Ohne Internet wird automatisch auf Systemschriften ausgewichen.
const SCHRIFTEN = {
  titel: ["Quicksand", "Arial"],
  text: ["Inter", "Arial"],
  mono: ["JetBrains Mono", "monospace"],
};
const schriftGeladen = { titel: false, text: false, mono: false };
let TITEL = "Arial";
let SCHRIFT = "Arial";
let MONO = "monospace";

function ladeSchriften() {
  if (!document.fonts || !document.fonts.load) {
    return;
  }
  for (const art of Object.keys(SCHRIFTEN)) {
    const name = SCHRIFTEN[art][0];
    Promise.all([
      document.fonts.load(`400 16px "${name}"`),
      document.fonts.load(`700 16px "${name}"`),
    ])
      .then((ergebnis) => {
        if (ergebnis[0].length > 0 && ergebnis[1].length > 0) {
          schriftGeladen[art] = true;
          TITEL = schriftGeladen.titel ? SCHRIFTEN.titel[0] : SCHRIFTEN.titel[1];
          SCHRIFT = schriftGeladen.text ? SCHRIFTEN.text[0] : SCHRIFTEN.text[1];
          MONO = schriftGeladen.mono ? SCHRIFTEN.mono[0] : SCHRIFTEN.mono[1];
        }
      })
      .catch(() => {});
  }
}

const P_UMW = { x: 24, y: 84, w: 640, h: 400, titel: "" };
const P_KURVE = { x: 24, y: 500, w: 640, h: 160, titel: "" };
const P_Q = { x: 680, y: 84, w: 896, h: 576, titel: "Q-Tabelle · Gedächtnis des Agenten" };
const P_ERKL = { x: 24, y: 676, w: 820, h: 208, titel: "" };
const P_EINST = { x: 860, y: 676, w: 716, h: 208, titel: "Einstellungen" };
const KOPF_H = 34; // Höhe der Panel-Überschrift
const MITTE_X = P_UMW.x + P_UMW.w / 2;

// Bereich, in dem die Szenarien ihre Q-Tabelle zeichnen
const QT = { x: 790, y: 150, w: 740, h: 430 };

// Lernkurve
const KV = { x: 74, y: 542, w: 570, h: 98 };

const TEMPI = ["Zeitlupe", "Echtzeit", "schnell", "Turbo"];

// Farben nach dem Corporate Design der Jakob-Preh-Schule (bsnes.de):
// Papierweiß, Logo-Schwarz, Schul-Rot als Akzent, Senf als zweiter Akzent.
const FARBE = {
  papier: [251, 249, 245],
  flaeche: [255, 255, 255],
  flaeche2: [243, 238, 230],
  linie: [231, 225, 214],
  text: [29, 29, 28],
  grau: [91, 88, 82],
  blass: [125, 122, 114],
  akzent: [200, 30, 58], // Schul-Rot (texttauglich)
  akzentHell: [228, 0, 43], // Logo-Rot (nur dekorativ / große Elemente)
  senf: [184, 122, 28],
  gruen: [52, 128, 84],
  links: [44, 92, 150], // blau
  rechts: [184, 122, 28], // Senf
  dunkel: [72, 70, 66],
};

const ART_FARBE = {
  training: [200, 30, 58],
  zufall: [125, 122, 114],
  vorfuehren: [29, 29, 28],
  mensch: [184, 122, 28],
};
const ART_NAME = { training: "Training", zufall: "Zufall", vorfuehren: "Vorführen", mensch: "Selbst" };

// -----------------------------------------------------------------------------
// Szenarien (werden von den Dateien in szenarien/ eingetragen)
// -----------------------------------------------------------------------------
const SZENARIEN = {};
const SZENARIO_LISTE = [];

function szenarioRegistrieren(sz) {
  SZENARIEN[sz.id] = sz;
  SZENARIO_LISTE.push(sz.id);
}

// -----------------------------------------------------------------------------
// Zustand
// -----------------------------------------------------------------------------
let sz; // das aktive Szenario
let agent;
const gespeichert = {}; // je Szenario: Agent und Lernkurve (bleiben beim Wechseln erhalten)

let modus = "training"; // mensch | zufall | training | vorfuehren
let laeuft = false; // läuft gerade automatisch?
let phase = "bereit"; // bereit | beobachten | waehlen | ausfuehren | lernen | ende
let sch = null; // der gerade betrachtete Schritt (alle Zwischenwerte)
let zuletzt = null; // der zuletzt ausgeführte Schritt (für Animationen)
let schrittZeit = 0; // Zeitpunkt des letzten Schritts (für Animationen)
let letzteAktion = null;
let menschTaste = null; // im Echtzeit-Selbststeuern: zuletzt gedrückte Ziffer
let tempo = "Echtzeit";
let episodenZiel = 300;
let laufStart = 0; // Episodenzahl beim Start des Trainings
let zeitKonto = 0; // für Echtzeit / Zeitlupe
let pauseBis = 0; // kurze Pause nach dem Ende einer Episode
let kurve = []; // {wert, gut, art}
let blitz = null; // zuletzt geänderter Q-Wert {s, a, t0}
let meldung = null; // {text, farbe, t0}
let hinweis = null;
let fehlerMeldung = null;
let cnv;

// =============================================================================
// Start
// =============================================================================
function setup() {
  ladeSchriften();
  const [cw, ch] = zeichenflaeche();
  cnv = createCanvas(cw, ch);
  S = width / W;

  sz = SZENARIEN[SZENARIO_LISTE[0]];
  agent = neuerAgent(sz);
  episodenZiel = sz.vorgaben.episoden;
  sz.zuruecksetzen();

  erstelleUi();
  cnv.parent(huelle);
  layoutUi();
  uiAusSzenario();
}

function neuerAgent(s) {
  const a = new QAgent(s.anzahl(), s.aktionen().length);
  a.alpha = s.vorgaben.alpha;
  a.gamma = s.vorgaben.gamma;
  a.epsilonFaktor = s.vorgaben.epsFaktor || 0.97;
  return a;
}

function zeichenflaeche() {
  const cw = Math.max(800, Math.min(1600, windowWidth - 24, ((windowHeight - 24) * W) / H));
  return [Math.round(cw), Math.round((cw * H) / W)];
}

function windowResized() {
  const [cw, ch] = zeichenflaeche();
  resizeCanvas(cw, ch);
  S = width / W;
  layoutUi();
}

// =============================================================================
// Hauptschleife – Fehler werden abgefangen, damit nie alles einfriert
// =============================================================================
function draw() {
  try {
    logik();
    background(...FARBE.papier);
    push();
    scale(S);
    zeichneKopf();
    zeichneUmgebung();
    zeichneKurve();
    zeichneQTabelle();
    zeichneErklaerung();
    zeichneEinstellungen();
    zeichneTooltip();
    zeichneFehlerMeldung();
    pop();
    aktualisiereUi();
  } catch (err) {
    behandleFehler(err);
  }
}

function behandleFehler(err) {
  console.error(err);
  fehlerMeldung = { text: String((err && err.message) || err), t0: millis() };
  laeuft = false;
  phase = "bereit";
  sch = null;
}

// =============================================================================
// Szenario wechseln
// =============================================================================
function szenarioWechseln(id) {
  if (!SZENARIEN[id] || (sz && id === sz.id)) {
    return;
  }
  gespeichert[sz.id] = { agent, kurve, episodenZiel };
  sz = SZENARIEN[id];
  if (gespeichert[id]) {
    agent = gespeichert[id].agent;
    kurve = gespeichert[id].kurve;
    episodenZiel = gespeichert[id].episodenZiel;
  } else {
    agent = neuerAgent(sz);
    kurve = [];
    episodenZiel = sz.vorgaben.episoden;
  }
  modus = "training";
  allesZuruecksetzen();
  uiAusSzenario();
}

// Eine Option (z. B. Zustand) ändern. Ändert sie die Tabelle, wird neu begonnen.
function optionAendern(i, wert) {
  const o = sz.optionen[i];
  if (sz.einstellung[o.key] === wert) {
    return;
  }
  if (o.neuAufbau) {
    if (agent.updates > 0 && !confirm("Achtung: Die Q-Tabelle wird neu angelegt, alles Gelernte geht verloren.")) {
      return;
    }
    sz.einstellung[o.key] = wert;
    const alt = agent;
    agent = neuerAgent(sz);
    agent.alpha = alt.alpha;
    agent.gamma = alt.gamma;
    kurve = [];
  } else {
    sz.einstellung[o.key] = wert;
  }
  allesZuruecksetzen();
}

// =============================================================================
// Ablauf
// =============================================================================
function allesZuruecksetzen() {
  laeuft = false;
  phase = "bereit";
  sch = null;
  zuletzt = null;
  blitz = null;
  meldung = null;
  letzteAktion = null;
  menschTaste = null;
  sz.zuruecksetzen();
  if (ui.eps) {
    uiAusAgent();
  }
}

function setzeModus(m) {
  if (laeuft && modus !== "mensch") {
    return;
  }
  modus = m;
  allesZuruecksetzen();
}

function neuStarten() {
  if (!confirm("Q-Tabelle leeren? Alles Gelernte und die Lernkurve gehen verloren.")) {
    return;
  }
  agent.neuAufbauen(sz.anzahl(), sz.aktionen().length);
  agent.epsilon = 1;
  kurve = [];
  allesZuruecksetzen();
}

function menschDiskret() {
  return modus === "mensch" && sz.mensch === "diskret";
}

function aktionsKnopf() {
  if (menschDiskret()) {
    // Selbst entscheiden: neu beginnen
    sz.zuruecksetzen();
    sch = null;
    zuletzt = null;
    meldung = null;
    phase = "bereit";
    return;
  }
  if (laeuft) {
    laeuft = false;
    if (modus === "mensch") {
      sz.zuruecksetzen();
    }
    return;
  }
  starten();
}

function starten() {
  if (modus === "training" && agent.epsilon < 0.02 && agent.episoden === 0) {
    zeigeHinweis("Hinweis: ε ist 0 – der Agent probiert nichts Neues aus.");
  }
  const mittendrin = phase !== "bereit" && phase !== "ende" && sch && !sch.vorbei;
  if (!mittendrin) {
    sz.zuruecksetzen();
  }
  phase = "bereit";
  sch = null;
  meldung = null;
  menschTaste = null;
  laufStart = agent.episoden;
  zeitKonto = 0;
  pauseBis = 0;
  laeuft = true;
}

function zeigeHinweis(text) {
  hinweis = { text, t0: millis() };
}

function tempoFaktor() {
  return tempo === "Zeitlupe" ? 0.25 : 1;
}

// Wie viele Schritte pro Bild?  Zeitlupe/Echtzeit laufen nach der Uhr.
function schritteProBild() {
  if (tempo === "Zeitlupe" || tempo === "Echtzeit" || modus === "mensch") {
    const faktor = modus === "mensch" ? (tempo === "Zeitlupe" ? 0.25 : 1) : tempoFaktor();
    zeitKonto += (Math.min(deltaTime, 100) / 1000) * faktor;
    let n = 0;
    while (zeitKonto >= sz.dt && n < 5) {
      zeitKonto -= sz.dt;
      n++;
    }
    return n;
  }
  if (tempo === "schnell") {
    return 10;
  }
  return Infinity; // Turbo: so viele, wie in 14 ms passen
}

// Fortschritt der Animation des letzten Schritts (0 … 1)
function animation() {
  const schnell = laeuft && modus !== "mensch" && (tempo === "schnell" || tempo === "Turbo");
  if (schnell || !zuletzt) {
    return 1;
  }
  const dauer = laeuft ? (sz.dt * 1000) / tempoFaktor() : 550;
  return constrain((millis() - schrittZeit) / Math.max(dauer, 1), 0, 1);
}

function logik() {
  if (!laeuft) {
    return;
  }
  if (millis() < pauseBis) {
    return;
  }

  if (modus === "mensch") {
    const n = schritteProBild();
    for (let i = 0; i < n; i++) {
      const a = sz.menschAktion(menschTaste);
      menschTaste = null;
      letzteAktion = a >= 0 ? a : null;
      const st = sz.schritt(a);
      zuletzt = { wahl: { a }, info: st.info, r: st.r, z2: st.z2 };
      schrittZeit = millis();
      if (st.vorbei) {
        episodeAbschliessen();
        laeuft = false;
        break;
      }
    }
    return;
  }

  const n = schritteProBild();
  const t0 = performance.now();
  let i = 0;
  while (i < n) {
    if (n === Infinity && performance.now() - t0 > 14) {
      break;
    }
    const s = agentSchritt();
    i++;
    if (s.vorbei) {
      episodeAbschliessen();
      if (modus === "training" && agent.episoden - laufStart >= episodenZiel) {
        laeuft = false;
        phase = "bereit";
        return;
      }
      sz.zuruecksetzen();
      if (tempo === "Zeitlupe" || tempo === "Echtzeit") {
        // Endzustand noch kurz zeigen
        pauseBis = millis() + 700;
        sch = s;
        return;
      }
    }
  }
}

// Ein kompletter Schritt: beobachten → wählen → ausführen → (lernen)
function agentSchritt() {
  const s = { z: sz.zustand() };
  beobachten(s);
  waehlen(s);
  ausfuehren(s);
  if (modus === "training") {
    lernen(s);
  }
  return s;
}

function beobachten(s) {
  const e = sz.einordnen(s.z);
  s.f = e.f;
  s.s = e.s;
  s.q = agent.q[s.s].slice();
}

function waehlen(s) {
  if (modus === "zufall") {
    s.wahl = { a: Math.floor(Math.random() * agent.nA), zufall: null, erkunden: true };
  } else if (modus === "vorfuehren") {
    s.wahl = { a: agent.besteAktion(s.s), zufall: null, erkunden: false };
  } else {
    s.wahl = agent.waehle(s.s);
    s.eps = agent.epsilon;
  }
  letzteAktion = s.wahl.a;
}

function ausfuehren(s) {
  const st = sz.schritt(s.wahl.a);
  s.z2 = st.z2;
  s.r = st.r;
  s.terminal = st.terminal;
  s.vorbei = st.vorbei;
  s.info = st.info || {};
  const e = sz.einordnen(s.z2);
  s.f2 = e.f;
  s.s2 = e.s;
  zuletzt = s;
  schrittZeit = millis();
}

function lernen(s) {
  s.upd = agent.lernen(s.s, s.wahl.a, s.r, s.s2, s.terminal);
  blitz = { s: s.s, a: s.wahl.a, t0: millis() };
}

function episodeAbschliessen() {
  const erg = sz.episodenErgebnis();
  kurve.push({ wert: sz.episodenWert(), gut: erg.gut, art: modus, grund: erg.grund, extra: erg.extra });
  if (kurve.length > 5000) {
    kurve.shift();
  }
  if (modus === "training") {
    agent.episodeBeendet(ui.epsAb.checked());
  }
  meldung = { text: erg.text, farbe: erg.gut ? FARBE.gruen : FARBE.akzent, t0: millis() };
}

// --- schrittweise mit → -------------------------------------------------------
function schrittVor() {
  if (laeuft || modus === "mensch") {
    return;
  }
  const einzeln = ui.phasen.checked();

  if (phase === "ende") {
    sz.zuruecksetzen();
    meldung = null;
    phase = "bereit";
    sch = null;
    zuletzt = null;
    if (!einzeln) {
      return schrittVor();
    }
  }

  if (!einzeln) {
    sch = agentSchritt();
    phase = sch.upd ? "lernen" : "ausfuehren";
    if (sch.vorbei) {
      episodeAbschliessen();
      phase = "ende";
    }
    return;
  }

  if (phase === "bereit" || phase === "lernen" || (phase === "ausfuehren" && modus !== "training")) {
    if (sch && sch.vorbei) {
      episodeAbschliessen();
      phase = "ende";
      return;
    }
    sch = { z: sz.zustand() };
    beobachten(sch);
    phase = "beobachten";
  } else if (phase === "beobachten") {
    waehlen(sch);
    phase = "waehlen";
  } else if (phase === "waehlen") {
    ausfuehren(sch);
    phase = "ausfuehren";
  } else if (phase === "ausfuehren") {
    lernen(sch);
    phase = "lernen";
  }
}

// --- Selbst entscheiden (diskrete Aufgaben): ein Tastendruck = ein Schritt ---
function menschSchritt(a) {
  if (!menschDiskret() || a < 0 || a >= agent.nA) {
    return;
  }
  if (phase === "ende") {
    sz.zuruecksetzen();
    meldung = null;
  }
  const s = { z: sz.zustand() };
  beobachten(s);
  s.wahl = { a, zufall: null, erkunden: false };
  letzteAktion = a;
  ausfuehren(s);
  sch = s;
  phase = "ausfuehren";
  if (s.vorbei) {
    episodeAbschliessen();
    phase = "ende";
  }
}

// =============================================================================
// Zeichnen – Grundlagen (auch von den Szenarien benutzt)
// =============================================================================
function mausX() {
  return mouseX / S;
}

function mausY() {
  return mouseY / S;
}

// Karte im Stil der Schule: weiße Fläche, feine Linie, Titel mit rotem Punkt
function panel(p) {
  noStroke();
  fill(29, 29, 28, 10);
  rect(p.x + 1, p.y + 3, p.w, p.h, 12);
  fill(...FARBE.flaeche);
  stroke(...FARBE.linie);
  strokeWeight(1);
  rect(p.x, p.y, p.w, p.h, 12);
  stroke(...FARBE.linie);
  line(p.x + 12, p.y + KOPF_H, p.x + p.w - 12, p.y + KOPF_H);
  if (p.titel) {
    noStroke();
    fill(...FARBE.akzentHell);
    circle(p.x + 19, p.y + KOPF_H / 2 + 1, 7);
    fill(...FARBE.text);
    textFont(TITEL);
    textStyle(BOLD);
    textSize(16);
    textAlign(LEFT, CENTER);
    text(p.titel, p.x + 30, p.y + KOPF_H / 2 + 1);
    textStyle(NORMAL);
  }
}

function f2(v) {
  return v.toFixed(2);
}

function vz(v, stellen) {
  return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(stellen);
}

function klammer(v) {
  return v < 0 ? "(" + v.toFixed(2) + ")" : v.toFixed(2);
}

function zahl(v, stellen) {
  return v.toFixed(stellen).replace("-", "−");
}

function umbrechen(txt, maxBreite) {
  const woerter = txt.split(" ");
  const zeilen = [];
  let akt = "";
  for (const wort of woerter) {
    const probe = akt ? akt + " " + wort : wort;
    if (textWidth(probe) > maxBreite && akt) {
      zeilen.push(akt);
      akt = wort;
    } else {
      akt = probe;
    }
  }
  if (akt) {
    zeilen.push(akt);
  }
  return zeilen;
}

function gestrichelt(an) {
  drawingContext.setLineDash(an ? [5, 4] : []);
}

// sanfte Bewegung für Animationen
function weich(t) {
  return t * t * (3 - 2 * t);
}

// Schriftzug mit Hintergrund (für Meldungen in der Umgebung)
function plakette(txt, x, y, farbe) {
  textFont(TITEL);
  textStyle(BOLD);
  textSize(19);
  textAlign(CENTER, CENTER);
  const b = textWidth(txt) + 36;
  fill(255, 235);
  stroke(...farbe);
  strokeWeight(1.5);
  rect(x - b / 2, y - 16, b, 32, 16);
  noStroke();
  fill(...farbe);
  text(txt, x, y);
  textStyle(NORMAL);
}

// =============================================================================
// Kopfzeile
// =============================================================================
function zeichneKopf() {
  noStroke();
  fill(...FARBE.flaeche);
  rect(0, 0, W, 56);
  stroke(...FARBE.linie);
  strokeWeight(1);
  line(0, 56, W, 56);

  // Trenner zwischen Logo und Titel: Punkt und Strich wie im Logo
  noStroke();
  fill(...FARBE.akzentHell);
  circle(160, 28, 6);
  stroke(...FARBE.akzentHell);
  strokeWeight(3);
  line(170, 34, 180, 22);

  noStroke();
  fill(...FARBE.text);
  textFont(TITEL);
  textStyle(BOLD);
  textSize(20);
  textAlign(LEFT, CENTER);
  text(sz.titel, 194, 17);
  textStyle(NORMAL);

  fill(...FARBE.grau);
  textFont(SCHRIFT);
  textSize(13);
  textAlign(LEFT, CENTER);
  text(statusText(), 26, 70);
}

function statusText() {
  const tab = `Q-Tabelle: ${agent.besuchteZustaende()} von ${agent.anzahl} Zuständen besucht · ${agent.episoden} Episoden gelernt`;
  if (modus === "mensch") {
    return sz.texte.menschStatus;
  }
  if (modus === "zufall") {
    return "Zufallsagent · wählt jede Aktion zufällig · lernt nichts · " + tab;
  }
  if (modus === "vorfuehren") {
    return "Vorführen · ε = 0, der Agent nutzt nur sein Wissen und lernt nicht dazu · " + tab;
  }
  let s = `Training · α = ${f2(agent.alpha)} · γ = ${f2(agent.gamma)} · ε = ${f2(agent.epsilon)}`;
  if (laeuft) {
    s += ` · Episode ${agent.episoden - laufStart + 1} von ${episodenZiel}`;
  }
  return s + " · " + tab;
}

// =============================================================================
// Umgebung – das Zeichnen übernimmt das Szenario
// =============================================================================
function zeichneUmgebung() {
  const p = P_UMW;
  p.titel = sz.umgebungTitel;
  panel(p);

  // bei kurzer Pause nach dem Ende: den letzten Zustand zeigen
  const zeigeEnde = millis() < pauseBis && sch && sch.z2;
  const ansicht = {
    z: zeigeEnde ? sch.z2 : sz.zustand(),
    zeigeEnde,
    sch,
    phase,
    letzteAktion,
    wahl: sch && phase === "waehlen" && sch.wahl ? sch.wahl.a : null,
    zuletzt,
    anim: animation(),
    aktiv: laeuft || phase === "waehlen" || phase === "ausfuehren" || phase === "lernen",
  };
  sz.zeichneUmgebung(ansicht);

  // --- Meldung (Episode vorbei) ---
  const schnellLauf = laeuft && (tempo === "schnell" || tempo === "Turbo") && modus !== "mensch";
  if (meldung && !schnellLauf && (millis() - meldung.t0 < 2500 || !laeuft)) {
    plakette(meldung.text, MITTE_X, p.y + (sz.meldungY || 106), meldung.farbe);
  } else if (modus === "mensch" && !laeuft && sz.mensch === "echtzeit") {
    noStroke();
    textFont(SCHRIFT);
    textSize(14);
    textAlign(CENTER, CENTER);
    fill(...FARBE.grau);
    text(sz.texte.menschStart, MITTE_X, p.y + (sz.meldungY || 106));
  }

  // unterste Zeile: Regeln oder (Selbst entscheiden) Aktions-Knöpfe
  if (menschDiskret()) {
    zeichneMenschKnoepfe();
  } else {
    noStroke();
    textFont(SCHRIFT);
    textSize(12);
    textAlign(CENTER, BOTTOM);
    fill(...FARBE.grau);
    text(sz.regelText, MITTE_X, p.y + p.h - 7);
  }
}

// Knöpfe für "Selbst steuern" bei Aufgaben, die Schritt für Schritt gehen
function menschKnopfFlaechen() {
  const p = P_UMW;
  const akt = sz.aktionen();
  const luecke = 8;
  const b = (p.w - 32 - luecke * (akt.length - 1)) / akt.length;
  return akt.map((a, i) => ({ x: p.x + 16 + i * (b + luecke), y: p.y + p.h - 38, w: b, h: 30, a: i }));
}

function zeichneMenschKnoepfe() {
  const akt = sz.aktionen();
  for (const k of menschKnopfFlaechen()) {
    const ueber = mausX() >= k.x && mausX() <= k.x + k.w && mausY() >= k.y && mausY() <= k.y + k.h;
    stroke(...akt[k.a].farbe);
    strokeWeight(1.5);
    fill(...akt[k.a].farbe, ueber ? 60 : 25);
    rect(k.x, k.y, k.w, k.h, 15);
    noStroke();
    fill(...FARBE.text);
    textFont(SCHRIFT);
    textStyle(BOLD);
    textSize(13);
    textAlign(CENTER, CENTER);
    text(`${k.a + 1} · ${akt[k.a].text}`, k.x + k.w / 2, k.y + k.h / 2);
    textStyle(NORMAL);
  }
}

// =============================================================================
// Lernkurve
// =============================================================================
function zeichneKurve() {
  const p = P_KURVE;
  const kv = sz.kurve;
  p.titel = kv.titel;
  panel(p);

  // Legende in der Kopfzeile
  const arten = [];
  for (const k of kurve) {
    if (!arten.includes(k.art)) {
      arten.push(k.art);
    }
  }
  textFont(SCHRIFT);
  textSize(12);
  let lx = p.x + p.w - 14;
  textAlign(RIGHT, CENTER);
  for (const art of ["mensch", "vorfuehren", "zufall", "training"]) {
    if (!arten.includes(art)) {
      continue;
    }
    noStroke();
    fill(...FARBE.grau);
    text(ART_NAME[art], lx, p.y + KOPF_H / 2 + 1);
    lx -= textWidth(ART_NAME[art]) + 8;
    fill(...ART_FARBE[art]);
    circle(lx, p.y + KOPF_H / 2 + 1, 8);
    lx -= 16;
  }

  // Achsen
  const k = KV;
  const yWert = (v) => k.y + k.h - ((constrain(v, kv.min, kv.max) - kv.min) / (kv.max - kv.min)) * k.h;
  stroke(...FARBE.linie);
  strokeWeight(1);
  for (const v of kv.ticks) {
    line(k.x, yWert(v), k.x + k.w, yWert(v));
  }
  noStroke();
  fill(...FARBE.blass);
  textSize(11);
  textAlign(RIGHT, CENTER);
  for (const v of kv.ticks) {
    text(String(v).replace("-", "−"), k.x - 6, yWert(v));
  }
  textAlign(LEFT, TOP);
  text("Episode →", k.x, k.y + k.h + 4);

  if (kurve.length === 0) {
    textAlign(CENTER, CENTER);
    textSize(13);
    fill(...FARBE.grau);
    text(kv.leer, k.x + k.w / 2, k.y + k.h / 2 - 8);
    return;
  }

  const n = Math.max(kurve.length, 20);
  const dx = k.w / n;
  const r = constrain(dx * 0.9, 1.6, 5);
  noStroke();
  for (let i = 0; i < kurve.length; i++) {
    const e = kurve[i];
    fill(...ART_FARBE[e.art], e.art === "training" ? 110 : 190);
    circle(k.x + (i + 0.5) * dx, yWert(e.wert), r * 2);
  }

  // gleitender Mittelwert über 20 Trainings-Episoden
  stroke(...FARBE.akzent);
  strokeWeight(2);
  noFill();
  beginShape();
  const fenster = [];
  let summe = 0;
  for (let i = 0; i < kurve.length; i++) {
    if (kurve[i].art !== "training") {
      continue;
    }
    fenster.push(kurve[i].wert);
    summe += kurve[i].wert;
    if (fenster.length > 20) {
      summe -= fenster.shift();
    }
    vertex(k.x + (i + 0.5) * dx, yWert(summe / fenster.length));
  }
  endShape();

  const letzte = kurve[kurve.length - 1];
  noStroke();
  fill(...FARBE.grau);
  textSize(11);
  textAlign(RIGHT, TOP);
  text(
    `${kurve.length} Episoden · letzte: ${kv.format(letzte.wert)} · Linie: Mittel der letzten 20 Trainings-Episoden`,
    k.x + k.w,
    k.y + k.h + 4
  );
}

// =============================================================================
// Q-Tabelle – Lage der Zellen und Beschriftung kommen vom Szenario
// =============================================================================
function besteVon(q) {
  let best = 0;
  for (let a = 1; a < q.length; a++) {
    if (q[a] > q[best]) {
      best = a;
    }
  }
  // Gleichstand an der Spitze → keine eindeutig bessere Aktion
  for (let a = 0; a < q.length; a++) {
    if (a !== best && q[a] === q[best]) {
      return -1;
    }
  }
  return best;
}

function vorsprung(q) {
  const sortiert = q.slice().sort((a, b) => b - a);
  return sortiert[0] - sortiert[1];
}

function zahlenPassen(c, nA) {
  return c.w / nA >= (nA === 2 ? 40 : 38) && c.h >= 15;
}

function zeichneQTabelle() {
  const p = P_Q;
  panel(p);
  const akt = sz.aktionen();
  const nA = agent.nA;
  const stellen = sz.qStellen === undefined ? 1 : sz.qStellen;

  // Maßstab für die Farbstärke
  let maxDiff = 0.001;
  for (const q of agent.q) {
    maxDiff = Math.max(maxDiff, vorsprung(q));
  }

  textFont(SCHRIFT);
  for (let s = 0; s < agent.anzahl; s++) {
    const c = sz.qZelle(s);
    if (!c) {
      continue;
    }
    const q = agent.q[s];
    const besucht = agent.besuche[s] > 0;
    stroke(...FARBE.linie);
    strokeWeight(1);
    if (!besucht && q.every((v) => v === 0)) {
      fill(...FARBE.papier);
      rect(c.x, c.y, c.w, c.h);
      continue;
    }
    const besser = besteVon(q);
    if (besser < 0) {
      fill(...FARBE.flaeche);
    } else {
      const a = 40 + 170 * Math.sqrt(vorsprung(q) / maxDiff);
      fill(...akt[besser].farbe, a);
    }
    rect(c.x, c.y, c.w, c.h);

    noStroke();
    if (zahlenPassen(c, nA)) {
      textFont(MONO);
      textSize(Math.min(12, c.h * 0.62));
      const tw = c.w / nA;
      for (let a = 0; a < nA; a++) {
        fill(...FARBE.text);
        textStyle(a === besser ? BOLD : NORMAL);
        if (nA === 2) {
          textAlign(a === 0 ? LEFT : RIGHT, CENTER);
          const tx = a === 0 ? c.x + 6 : c.x + c.w - 6;
          const zusatz = sz.qPfeile ? [akt[0].kurz, akt[1].kurz] : ["", ""];
          text((a === 0 ? zusatz[0] : "") + zahl(q[a], stellen) + (a === 1 ? zusatz[1] : ""), tx, c.y + c.h / 2);
        } else {
          textAlign(CENTER, CENTER);
          text(zahl(q[a], stellen), c.x + (a + 0.5) * tw, c.y + c.h / 2);
          if (a > 0) {
            stroke(255, 120);
            strokeWeight(1);
            line(c.x + a * tw, c.y + 3, c.x + a * tw, c.y + c.h - 3);
            noStroke();
          }
        }
      }
      textStyle(NORMAL);
    } else if (besser >= 0 && c.w > 14) {
      fill(255, 230);
      textFont(SCHRIFT);
      textSize(Math.min(12, c.h * 0.8));
      textAlign(CENTER, CENTER);
      text(akt[besser].kurz, c.x + c.w / 2, c.y + c.h / 2);
    }
  }

  // Teilfläche einer Aktion in einer Zelle (für Markierungen)
  const teil = (c, a) => {
    if (!zahlenPassen(c, nA)) {
      return { x: c.x, y: c.y, w: c.w, h: c.h };
    }
    return { x: c.x + (a * c.w) / nA, y: c.y, w: c.w / nA, h: c.h };
  };

  // gerade geänderter Q-Wert blitzt auf
  if (blitz && millis() - blitz.t0 < 900 && blitz.s < agent.anzahl) {
    const c = sz.qZelle(blitz.s);
    if (c) {
      const t = teil(c, blitz.a);
      const a = 255 * (1 - (millis() - blitz.t0) / 900);
      noFill();
      stroke(...FARBE.akzentHell, a);
      strokeWeight(3);
      rect(t.x, t.y, t.w, t.h);
    }
  }

  // aktueller Zustand (rot) und – nach dem Ausführen – neuer Zustand (gestrichelt)
  let sJetzt = null;
  let sNeu = null;
  if (sch && phase !== "bereit" && !laeuft) {
    sJetzt = sch.s;
    if (sch.s2 !== undefined && (phase === "ausfuehren" || phase === "lernen" || phase === "ende")) {
      sNeu = sch.s2;
    }
  } else {
    sJetzt = sz.einordnen(sz.zustand()).s;
  }
  if (sNeu !== null && sNeu !== sJetzt && !(sch && sch.terminal)) {
    const c = sz.qZelle(sNeu);
    if (c) {
      noFill();
      stroke(...FARBE.text);
      strokeWeight(2.5);
      gestrichelt(true);
      rect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
      gestrichelt(false);
    }
  }
  if (sJetzt !== null) {
    const c = sz.qZelle(sJetzt);
    if (c) {
      noFill();
      stroke(...FARBE.akzent);
      strokeWeight(3);
      rect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
      if (sch && phase === "waehlen" && !laeuft && zahlenPassen(c, nA)) {
        // gewählte Aktion markieren
        const t = teil(c, sch.wahl.a);
        stroke(...akt[sch.wahl.a].farbe);
        strokeWeight(3);
        rect(t.x + 3, t.y + 3, t.w - 6, t.h - 6, 3);
      }
    }
  }

  // --- Achsen und Beschriftung (Szenario) ---
  sz.zeichneQAchsen();

  // Legende: Farben der Aktionen
  const ly = p.y + p.h - 22;
  textFont(SCHRIFT);
  textSize(12);
  textAlign(LEFT, CENTER);
  let x = p.x + 18;
  for (let a = 0; a < nA; a++) {
    const txt = `${akt[a].kurz} besser`;
    noStroke();
    fill(...akt[a].farbe, 170);
    rect(x, ly - 7, 22, 14, 3);
    fill(...FARBE.grau);
    text(txt, x + 28, ly);
    x += 28 + textWidth(txt) + 14;
  }
  fill(...FARBE.papier);
  stroke(...FARBE.linie);
  rect(x, ly - 7, 22, 14, 3);
  noStroke();
  fill(...FARBE.grau);
  text("nie besucht", x + 28, ly);
  x += 28 + textWidth("nie besucht") + 14;
  stroke(...FARBE.akzent);
  strokeWeight(3);
  noFill();
  rect(x, ly - 7, 22, 14);
  noStroke();
  fill(...FARBE.grau);
  text("Zustand s", x + 28, ly);
  x += 28 + textWidth("Zustand s") + 14;
  stroke(...FARBE.text);
  strokeWeight(2);
  noFill();
  gestrichelt(true);
  rect(x, ly - 7, 22, 14);
  gestrichelt(false);
  noStroke();
  fill(...FARBE.grau);
  text("neuer Zustand s'", x + 28, ly);

  // Unterzeile im Kopf
  textAlign(RIGHT, CENTER);
  textSize(12);
  fill(...FARBE.grau);
  text(
    `${agent.anzahl} Zustände × ${nA} Aktionen · Farbe = bessere Aktion` + (sz.export ? "" : ", Stärke = wie viel besser"),
    p.x + p.w - (sz.export ? 140 : 16),
    p.y + KOPF_H / 2 + 1
  );
}

function zelleUnterMaus() {
  const mx = mausX();
  const my = mausY();
  if (mx < P_Q.x || mx > P_Q.x + P_Q.w || my < P_Q.y + KOPF_H || my > P_Q.y + P_Q.h - 36) {
    return null;
  }
  for (let s = 0; s < agent.anzahl; s++) {
    const c = sz.qZelle(s);
    if (c && mx >= c.x && mx < c.x + c.w && my >= c.y && my < c.y + c.h) {
      return s;
    }
  }
  return null;
}

// =============================================================================
// Erklärung (mit den echten Zahlen) und Agentenkreislauf
// =============================================================================
function aktionText(a) {
  const akt = sz.aktionen()[a];
  return `${akt.kurz} (${akt.text})`;
}

function qListe(q) {
  const akt = sz.aktionen();
  const st = sz.qStellen === undefined ? 2 : Math.max(sz.qStellen, 1);
  return q.map((v, a) => `Q(s,${akt[a].kurz}) = ${zahl(v, st)}`).join("  ");
}

function erklaerung() {
  const T = sz.texte;
  if (modus === "mensch") {
    if (menschDiskret() && sch && sch.z2) {
      const e = T.ausfuehren(sch);
      return { titel: phase === "ende" ? "Episode vorbei" : "Deine Entscheidung", text: e.text, formeln: e.formeln.concat(mittelText("mensch")) };
    }
    if (laeuft) {
      return { titel: "Selbst steuern", text: T.menschLaeuft, formeln: T.menschFormeln ? T.menschFormeln() : [] };
    }
    return { titel: "Selbst steuern: Wie gut bist du?", text: T.menschIntro, formeln: mittelText("mensch") };
  }

  if (laeuft) {
    if (modus === "training") {
      return {
        titel: "Training läuft",
        text: T.trainingLaeuft || "Bei jedem Schritt: Zustand einordnen, Aktion wählen (ε-greedy), ausführen, Q-Wert anpassen. Zu Beginn probiert der Agent viel aus (ε groß), später nutzt er immer mehr sein Wissen. Beobachte, wie sich die Q-Tabelle einfärbt.",
        formeln: [
          `Episode ${agent.episoden - laufStart + 1} von ${episodenZiel}   ε = ${f2(agent.epsilon)}`,
          `bisher ${agent.updates} Q-Werte angepasst`,
        ],
      };
    }
    if (modus === "zufall") {
      return {
        titel: "Zufallsagent",
        text: "Der Zufallsagent wählt jede Aktion zufällig und lernt nichts. So sieht man, wie schwer die Aufgabe ohne Wissen ist – der Vergleichswert für den lernenden Agenten.",
        formeln: mittelText("zufall"),
      };
    }
    return {
      titel: "Vorführen",
      text: T.vorfuehrenLaeuft || "Der Agent nutzt nur noch sein Wissen (ε = 0) und lernt nicht dazu: In jedem Zustand wählt er die Aktion mit dem größten Q-Wert.",
      formeln: mittelText("vorfuehren"),
    };
  }

  if (phase === "bereit") {
    if (modus === "training") {
      return trainingsFazit();
    }
    if (modus === "zufall") {
      return {
        titel: "Zufallsagent",
        text: T.zufall || "Ein Agent ohne Gedächtnis: Er wählt jede Aktion zufällig. Starte ihn oben oder gehe mit → Schritt für Schritt durch.",
        formeln: mittelText("zufall"),
      };
    }
    return {
      titel: "Vorführen",
      text: "Jetzt zeigt der Agent, was er gelernt hat: immer die Aktion mit dem größten Q-Wert, kein Ausprobieren, kein Lernen. Starte oben oder gehe mit → Schritt für Schritt durch.",
      formeln: mittelText("vorfuehren"),
    };
  }

  const s = sch;

  if (phase === "beobachten") {
    const e = T.beobachten(s);
    return { titel: "1 · Zustand beobachten", text: e.text, formeln: e.formeln.concat([`Zustand s = ${s.s}:   ${qListe(s.q)}`]) };
  }

  if (phase === "waehlen") {
    const formeln = [];
    let text;
    if (modus === "zufall") {
      text = "Der Zufallsagent schaut gar nicht in die Tabelle – er wählt zufällig.";
      formeln.push(`Zufall → Aktion ${aktionText(s.wahl.a)}`);
    } else if (modus === "vorfuehren") {
      text = "Beim Vorführen ist ε = 0: Der Agent nimmt immer die Aktion mit dem größten Q-Wert.";
      formeln.push(qListe(s.q));
      formeln.push(`→ Aktion ${aktionText(s.wahl.a)}`);
    } else {
      text =
        "ε-greedy: Mit Wahrscheinlichkeit ε probiert der Agent etwas Zufälliges aus (Erkunden), sonst nimmt er die Aktion mit dem größten Q-Wert (Wissen nutzen).";
      if (s.wahl.erkunden) {
        formeln.push(`Zufallszahl ${s.wahl.zufall.toFixed(3)} < ε = ${f2(s.eps)}   → Erkunden!`);
        formeln.push(`zufällige Aktion: ${aktionText(s.wahl.a)}`);
      } else {
        formeln.push(`Zufallszahl ${s.wahl.zufall.toFixed(3)} ≥ ε = ${f2(s.eps)}   → Wissen nutzen`);
        formeln.push(qListe(s.q));
        const gleich = s.q.filter((v) => v === Math.max(...s.q)).length > 1;
        formeln.push(`→ größter Wert: Aktion ${aktionText(s.wahl.a)}${gleich ? "  (Gleichstand: Zufall)" : ""}`);
      }
    }
    return { titel: "2 · Aktion wählen", text, formeln };
  }

  if (!ui.phasen.checked() && (phase === "ausfuehren" || phase === "lernen")) {
    // ein ganzer Schritt auf einmal: kurze Fassung
    const akt = sz.aktionen();
    const formeln = [
      `s = ${s.s}  →  Aktion ${akt[s.wahl.a].kurz}${s.wahl.erkunden && modus === "training" ? " (erkundet)" : ""}  →  s' = ${s.s2}`,
      T.kurz(s),
      `Belohnung r = ${belohnungText(s.r)}${s.terminal ? "  (abgeschlossen)" : ""}`,
    ];
    if (s.upd) {
      const u = s.upd;
      formeln.push(`Q(s,${akt[s.wahl.a].kurz}) ← ${f2(u.alt)} + ${f2(u.alpha)}·(${f2(u.ziel)} − ${f2(u.alt)}) = ${f2(u.neu)}`);
    }
    return {
      titel: "Ein ganzer Schritt",
      text: "Beobachten, wählen, ausführen" + (s.upd ? ", lernen" : "") + " – alles auf einmal. Für die Einzelheiten „Phasen einzeln“ anhaken.",
      formeln,
    };
  }

  if (phase === "ausfuehren") {
    const e = T.ausfuehren(s);
    return { titel: "3 · Aktion ausführen", text: e.text, formeln: e.formeln };
  }

  if (phase === "lernen") {
    const u = s.upd;
    const an = sz.aktionen()[s.wahl.a].kurz;
    const formeln = [];
    if (u.terminal) {
      formeln.push(`Ziel = r = ${belohnungText(u.r)}    (${T.terminalText || "danach kommt nichts mehr"})`);
    } else {
      formeln.push(`Ziel = r + γ · max Q(s',·) = ${belohnungText(u.r)} + ${f2(u.gamma)} · ${klammer(u.maxNeu)} = ${f2(u.ziel)}`);
    }
    formeln.push(`Fehler = Ziel − Q(s,${an}) = ${f2(u.ziel)} − ${klammer(u.alt)} = ${vz(u.fehler, 2)}`);
    formeln.push(`Q(s,${an}) ← ${f2(u.alt)} + ${f2(u.alpha)} · ${klammer(u.fehler)} = ${f2(u.neu)}`);
    return {
      titel: "4 · Q-Wert anpassen",
      text: u.terminal && T.lernenTerminal
        ? T.lernenTerminal
        : "Das Ziel ist die Belohnung jetzt plus der (mit γ abgezinste) beste Wert im neuen Zustand. Der Unterschied zum alten Q-Wert ist die Überraschung – davon wird der Anteil α übernommen.",
      formeln,
    };
  }

  if (phase === "ende") {
    const k = kurve[kurve.length - 1];
    return {
      titel: "Episode vorbei",
      text: `${T.ende(k)} Mit → beginnt eine neue Episode – die Q-Tabelle bleibt erhalten.${
        modus === "training" && ui.epsAb.checked() ? " ε wurde etwas kleiner." : ""
      }`,
      formeln: modus === "training" ? [`ε = ${f2(agent.epsilon)}   Episoden gelernt: ${agent.episoden}`] : [],
    };
  }
  return { titel: "", text: "", formeln: [] };
}

function belohnungText(r) {
  const st = Number.isInteger(r) ? 0 : 2;
  return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r).toFixed(st);
}

function mittelText(art) {
  const liste = kurve.filter((k) => k.art === art);
  if (liste.length === 0) {
    return [];
  }
  const kv = sz.kurve;
  const m = liste.reduce((a, k) => a + k.wert, 0) / liste.length;
  const werte = liste.map((k) => k.wert);
  const best = kv.besserHoch === false ? Math.min(...werte) : Math.max(...werte);
  return [`${liste.length} Episoden   im Mittel ${kv.format(m)}   beste: ${kv.format(best)}`];
}

function trainingsFazit() {
  const tr = kurve.filter((k) => k.art === "training");
  if (tr.length < 10) {
    return {
      titel: "Training mit Q-Learning",
      text: sz.texte.start,
      formeln: ["Q(s,a) ← Q(s,a) + α · ( r + γ · max Q(s',·) − Q(s,a) )"],
    };
  }
  return {
    titel: "Training beendet",
    text: sz.texte.fazit(tr.slice(-20)),
    formeln: ["Q(s,a) ← Q(s,a) + α · ( r + γ · max Q(s',·) − Q(s,a) )"],
  };
}

function zeichneErklaerung() {
  const p = P_ERKL;
  const e = erklaerung();
  p.titel = e.titel;
  panel(p);

  const textB = 590;
  let ty = p.y + KOPF_H + 10;
  const unten = p.y + p.h - 46;
  noStroke();
  textAlign(LEFT, TOP);
  textFont(SCHRIFT);
  textSize(14);
  if (hinweis && millis() - hinweis.t0 < 3500) {
    fill(...FARBE.akzent);
    textStyle(BOLD);
    for (const z of umbrechen(hinweis.text, textB)) {
      text(z, p.x + 16, ty);
      ty += 18;
    }
    textStyle(NORMAL);
  } else {
    fill(...FARBE.grau);
    const zeilen = umbrechen(e.text, textB);
    const maxZ = e.formeln.length === 0 ? 7 : e.formeln.length >= 4 ? 2 : e.formeln.length === 3 ? 3 : 4;
    for (const z of zeilen.slice(0, maxZ)) {
      text(z, p.x + 16, ty);
      ty += 18;
    }
  }

  ty += 6;
  textFont(MONO);
  textSize(13);
  fill(...FARBE.text);
  for (const f of e.formeln) {
    if (ty + 16 > unten + 40) {
      break;
    }
    text(f, p.x + 16, ty);
    ty += 17;
  }

  zeichneKreislauf();
}

// Agent ↔ Umgebung: Welche Phase ist gerade dran?
function zeichneKreislauf() {
  const x0 = 640;
  const x1 = 828;
  const yA = 716;
  const yU = 822;
  const hb = 40;
  const aktivAgent = phase === "waehlen" || phase === "lernen" || (laeuft && modus !== "mensch");
  const aktivUmw = phase === "ausfuehren" || laeuft;
  const aktivA = phase === "waehlen" || phase === "ausfuehren" || laeuft;
  const aktivS = phase === "beobachten" || phase === "lernen" || laeuft;

  const kasten = (y, titel, unter, aktiv) => {
    stroke(...(aktiv ? FARBE.akzent : FARBE.linie));
    strokeWeight(aktiv ? 2 : 1);
    fill(...(aktiv ? [253, 240, 242] : FARBE.flaeche2));
    rect(x0, y, x1 - x0, hb, 8);
    noStroke();
    fill(...FARBE.text);
    textFont(TITEL);
    textStyle(BOLD);
    textSize(14);
    textAlign(CENTER, TOP);
    text(titel, (x0 + x1) / 2, y + 5);
    textStyle(NORMAL);
    textFont(SCHRIFT);
    textSize(11);
    fill(...FARBE.grau);
    text(unter, (x0 + x1) / 2, y + 23);
  };
  if (modus === "mensch") {
    kasten(yA, "Du", sz.texte.menschKreislauf, laeuft || menschDiskret());
  } else {
    kasten(yA, "Agent", phase === "lernen" ? "passt Q-Tabelle an" : "Q-Tabelle, wählt Aktion", aktivAgent);
  }
  kasten(yU, "Umgebung", sz.umgebungKurz, aktivUmw);

  const pfeil = (x, yVon, yBis, aktiv) => {
    stroke(...(aktiv ? FARBE.akzent : FARBE.blass));
    strokeWeight(aktiv ? 2.5 : 1.5);
    line(x, yVon, x, yBis);
    noStroke();
    fill(...(aktiv ? FARBE.akzent : FARBE.blass));
    const r = yBis > yVon ? 1 : -1;
    triangle(x, yBis + r * 2, x - 5, yBis - r * 7, x + 5, yBis - r * 7);
  };
  pfeil(x1 - 30, yA + hb + 2, yU - 4, aktivA);
  pfeil(x0 + 30, yU - 2, yA + hb + 4, aktivS);
  noStroke();
  textFont(SCHRIFT);
  textSize(12);
  fill(...(aktivA ? FARBE.akzent : FARBE.grau));
  textAlign(RIGHT, CENTER);
  text("Aktion a", x1 - 38, yA + hb + 27);
  fill(...(aktivS ? FARBE.akzent : FARBE.grau));
  textAlign(LEFT, CENTER);
  text("Zustand s'", x0 + 38, yA + hb + 14);
  text("Belohnung r", x0 + 38, yA + hb + 40);
}

function zeichneEinstellungen() {
  const p = P_EINST;
  panel(p);
  stroke(...FARBE.linie);
  strokeWeight(1);
  line(1224, p.y + KOPF_H + 10, 1224, p.y + p.h - 12);

  noStroke();
  textFont(SCHRIFT);
  textSize(12);
  textAlign(RIGHT, CENTER);
  fill(...FARBE.blass);
  text("Lernen", 1210, p.y + KOPF_H / 2 + 1);
  text("Aufgabe & Anzeige", p.x + p.w - 16, p.y + KOPF_H / 2 + 1);

  textAlign(LEFT, TOP);
  fill(...FARBE.grau);
  const tipps = {
    mensch: sz.texte.menschTipp,
    zufall: "α, γ und ε spielen hier keine Rolle:\nDer Zufallsagent lernt nicht.",
    training: sz.texte.trainingTipp || "α: Wie stark zählt neue Erfahrung?\nγ: Wie wichtig ist die Zukunft?\nε: Wie oft wird zufällig ausprobiert?",
    vorfuehren: "Beim Vorführen gilt ε = 0, und es wird\nnicht gelernt. „Turbo“ zeigt schnell den\nMittelwert vieler Episoden.",
  };
  text(tipps[modus], 1240, 818);
}

// -----------------------------------------------------------------------------
// Tooltip und Fehlermeldung
// -----------------------------------------------------------------------------
function zeichneTooltip() {
  if (exportOffen()) {
    return;
  }
  const s = zelleUnterMaus();
  if (s === null) {
    return;
  }
  const akt = sz.aktionen();
  const zeilen = [`Zustand s = ${s}   (${agent.besuche[s]}× angepasst)`].concat(sz.zustandsZeilen(s));
  const st = sz.qStellen === undefined ? 2 : Math.max(sz.qStellen, 1);
  for (let a = 0; a < akt.length; a += 2) {
    let z = `Q(s,${akt[a].kurz}) = ${zahl(agent.q[s][a], st)}`;
    if (a + 1 < akt.length) {
      z += `    Q(s,${akt[a + 1].kurz}) = ${zahl(agent.q[s][a + 1], st)}`;
    }
    zeilen.push(z);
  }

  textFont(MONO);
  textSize(12);
  let b = 0;
  for (const z of zeilen) {
    b = Math.max(b, textWidth(z));
  }
  b += 20;
  const h = zeilen.length * 17 + 12;
  let x = mausX() + 14;
  let y = mausY() + 14;
  if (x + b > W - 8) {
    x = mausX() - b - 10;
  }
  if (y + h > H - 8) {
    y = mausY() - h - 10;
  }
  fill(...FARBE.text, 235);
  noStroke();
  rect(x, y, b, h, 6);
  fill(255);
  textAlign(LEFT, TOP);
  for (let i = 0; i < zeilen.length; i++) {
    text(zeilen[i], x + 10, y + 7 + i * 17);
  }
}

function zeichneFehlerMeldung() {
  if (!fehlerMeldung || millis() - fehlerMeldung.t0 > 8000) {
    return;
  }
  const s = "Interner Fehler: " + fehlerMeldung.text + "  (Details in der Konsole)";
  textFont(SCHRIFT);
  textSize(14);
  const b = textWidth(s) + 30;
  noStroke();
  fill(...FARBE.akzent, 240);
  rect(W / 2 - b / 2, 62, b, 30, 6);
  fill(255);
  textAlign(CENTER, CENTER);
  text(s, W / 2, 77);
}

// =============================================================================
// Eingaben
// =============================================================================
function mousePressed() {
  if (exportOffen()) {
    return;
  }
  const mx = mausX();
  const my = mausY();
  if (menschDiskret()) {
    for (const k of menschKnopfFlaechen()) {
      if (mx >= k.x && mx <= k.x + k.w && my >= k.y && my <= k.y + k.h) {
        menschSchritt(k.a);
        return;
      }
    }
  }
  const p = P_UMW;
  if (mx < p.x || mx > p.x + p.w || my < p.y + KOPF_H || my > p.y + p.h) {
    return;
  }
  if (sz.klick) {
    sz.klick(mx, my);
  }
}

function keyPressed() {
  if (exportOffen()) {
    if (key === "Escape") {
      exportSchliessen();
    }
    return true;
  }
  // Tasten nicht abfangen, wenn eine Auswahlliste oder ein Textfeld den Fokus hat
  const el = document.activeElement;
  if (el && (el.tagName === "SELECT" || el.tagName === "TEXTAREA" ||
      (el.tagName === "INPUT" && !["checkbox", "range", "button", "file"].includes(el.type)))) {
    return true;
  }
  if (el && el.tagName === "BUTTON") {
    el.blur(); // sonst löst die Leertaste den Knopf noch einmal aus
  }
  if (key === " ") {
    aktionsKnopf();
    return false;
  }
  const ziffer = "123456789".indexOf(key);
  if (modus === "mensch") {
    if (menschDiskret()) {
      if (ziffer >= 0) {
        menschSchritt(ziffer);
        return false;
      }
      return true;
    }
    const taste = (sz.menschTasten || []).includes(key) || (ziffer >= 0 && ziffer < agent.nA);
    if (taste && !laeuft) {
      starten();
    }
    if (ziffer >= 0) {
      menschTaste = ziffer;
    }
    return taste ? false : true;
  }
  if (key === "ArrowRight") {
    schrittVor();
    return false;
  }
  return true;
}

// =============================================================================
// Q-Tabelle speichern und laden
// =============================================================================
function datumsName(endung) {
  const jetzt = new Date();
  const datum = jetzt.toISOString().split("T")[0];
  const uhr = jetzt.toTimeString().split(" ")[0].replace(/:/g, "-");
  return `${datum}_${uhr}_${sz.id}_${endung}`;
}

function herunterladen(name, inhalt, typ) {
  const blob = new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = name;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function tabelleSpeichern() {
  const name = prompt("Dateiname:", datumsName("q-tabelle.json"));
  if (name === null) {
    return;
  }
  herunterladen(name, JSON.stringify(agent.alsJSON(sz.id, Object.assign({}, sz.einstellung))), "application/json");
}

function dateiGewaehlt(datei) {
  if (!datei || !datei.name || !datei.name.toLowerCase().endsWith(".json")) {
    alert("Bitte eine JSON-Datei wählen.");
    return;
  }
  const leser = new FileReader();
  leser.onload = (ev) => {
    try {
      let d = JSON.parse(ev.target.result);
      if (d && d.typ === "q-tabelle-wagen-mit-stab") {
        // Dateien aus der ersten Programmversion
        d = Object.assign({}, d, { typ: "q-tabelle", szenario: "wagen", einstellung: { zustand: d.art, belohnung: String(d.strafe || 0) } });
      }
      if (!d || d.typ !== "q-tabelle" || !SZENARIEN[d.szenario]) {
        throw new Error("Das ist keine Q-Tabelle aus diesem Programm.");
      }
      szenarioWechseln(d.szenario);
      const ziel = SZENARIEN[d.szenario];
      for (const o of ziel.optionen) {
        if (d.einstellung && d.einstellung[o.key] !== undefined && o.werte.some((w) => w[0] === d.einstellung[o.key])) {
          ziel.einstellung[o.key] = d.einstellung[o.key];
        }
      }
      const neu = neuerAgent(ziel);
      neu.ausJSON(d);
      agent = neu;
      kurve = [];
      allesZuruecksetzen();
      uiAusSzenario();
    } catch (err) {
      alert("Die Q-Tabelle konnte nicht geladen werden: " + err.message);
    }
  };
  leser.readAsText(datei.file);
  ui.datei.elt.value = "";
}

// =============================================================================
// SPS-Export: die gelernte Strategie als SCL-Code (TIA Portal, IEC 61131-3 ST)
// =============================================================================
function sclCode() {
  const ex = sz.export;
  const akt = sz.aktionen();
  const z = [];
  const jetzt = new Date();
  z.push(`// =====================================================================`);
  z.push(`//  Strategie aus Q-Learning: ${ex.titel}`);
  z.push(`//  trainiert am ${jetzt.toLocaleDateString("de-DE")} · ${agent.episoden} Episoden · γ = ${f2(agent.gamma)}`);
  z.push(`//  Erzeugt mit „KI lernt“ (Jakob-Preh-Schule). Die Tabelle wurde in der`);
  z.push(`//  Simulation gelernt – vor dem Einsatz an der Anlage prüfen!`);
  z.push(`// =====================================================================`);
  z.push(`//  Eingänge:`);
  for (const e of ex.eingaenge) {
    z.push(`//    ${e}`);
  }
  z.push(`//  Ausgang:  ${ex.ausgang}`);
  for (let a = 0; a < akt.length; a++) {
    z.push(`//    ${a} = ${akt[a].text}`);
  }
  z.push(`// ---------------------------------------------------------------------`);
  z.push("");
  for (const zeile of ex.zustandsNummer()) {
    z.push(zeile);
  }
  z.push("");
  z.push(`CASE #Zustand OF`);
  let nie = 0;
  for (let s = 0; s < agent.anzahl; s++) {
    const besucht = agent.besuche[s] > 0;
    const a = besucht ? besteVon(agent.q[s]) : -1;
    const wahl = a >= 0 ? a : ex.vorgabe;
    let kommentar = ex.zustandsKommentar(s);
    if (!besucht) {
      kommentar += "  (nie besucht – Vorgabe)";
      nie++;
    } else if (a < 0) {
      kommentar += "  (Gleichstand – Vorgabe)";
    }
    z.push(`    ${String(s).padStart(2)}: #Aktion := ${wahl};   // ${akt[wahl].text.padEnd(18)} | ${kommentar}`);
  }
  z.push(`ELSE`);
  z.push(`    #Aktion := ${ex.vorgabe};   // ${akt[ex.vorgabe].text}`);
  z.push(`END_CASE;`);
  if (nie > 0) {
    z.push("");
    z.push(`// Hinweis: ${nie} Zustände wurden im Training nie besucht.`);
  }
  return z.join("\n");
}
