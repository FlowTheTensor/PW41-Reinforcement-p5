// =============================================================================
//  KI balanciert · Reinforcement Learning
//  Ein Agent lernt mit Q-Learning, einen Stab auf einem Wagen zu balancieren –
//  nur durch Ausprobieren und Belohnung, ohne die Physik zu kennen.
// =============================================================================
//
//  Dateien
//    umgebung.js  Wagen mit Stab (Physik wie Gymnasium "CartPole-v1")
//    agent.js     Q-Learning mit Tabelle
//    ui.js        Knöpfe, Auswahllisten, Regler
//    sketch.js    Ablauf, Zeichnen, Erklärungen (diese Datei)
//
//  Bedienung
//    →          ein Schritt des Agenten (Phase für Phase)
//    Leertaste  Start / Stopp
//    ← →        halten: Wagen selbst schieben (Modus "Selbst steuern")
//    Klick in die Umgebung: Stab anstupsen
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

const P_UMW = { x: 24, y: 84, w: 640, h: 400, titel: "Umgebung · Wagen mit Stab" };
const P_KURVE = { x: 24, y: 500, w: 640, h: 160, titel: "Lernkurve · Schritte je Episode" };
const P_Q = { x: 680, y: 84, w: 896, h: 576, titel: "Q-Tabelle · Gedächtnis des Agenten" };
const P_ERKL = { x: 24, y: 676, w: 820, h: 208, titel: "" };
const P_EINST = { x: 860, y: 676, w: 716, h: 208, titel: "Einstellungen" };
const KOPF_H = 34; // Höhe der Panel-Überschrift

// Umgebung
const MITTE_X = P_UMW.x + P_UMW.w / 2;
const BODEN_Y = 422;
const PX_M = 112; // Pixel je Meter auf der Bahn
const STAB_PX = 140; // gezeichnete Stablänge (etwas länger als maßstäblich)
const WAGEN_B = 64;
const WAGEN_H = 30;

// Q-Tabelle
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
  links: [44, 92, 150], // Aktion ← (blau)
  rechts: [184, 122, 28], // Aktion → (Senf)
};
const AKTION_FARBE = [FARBE.links, FARBE.rechts];

const ART_FARBE = {
  training: [200, 30, 58],
  zufall: [125, 122, 114],
  vorfuehren: [29, 29, 28],
  mensch: [184, 122, 28],
};
const ART_NAME = { training: "Training", zufall: "Zufall", vorfuehren: "Vorführen", mensch: "Selbst" };

const GRUND_TEXT = {
  umgefallen: "Stab umgefallen",
  bahn: "Wagen aus der Bahn gefahren",
  geschafft: "Geschafft – 10 Sekunden balanciert",
};

// -----------------------------------------------------------------------------
// Zustand
// -----------------------------------------------------------------------------
let env;
let agent;

let modus = "training"; // mensch | zufall | training | vorfuehren
let laeuft = false; // läuft gerade automatisch?
let phase = "bereit"; // bereit | beobachten | waehlen | ausfuehren | lernen | ende
let sch = null; // der gerade betrachtete Schritt (alle Zwischenwerte)
let letzteAktion = null; // für den Kraftpfeil am Wagen
let tempo = "Echtzeit";
let episodenZiel = 300;
let laufStart = 0; // Episodenzahl beim Start des Trainings
let zeitKonto = 0; // für Echtzeit / Zeitlupe
let pauseBis = 0; // kurze Pause nach dem Ende einer Episode
let kurve = []; // {schritte, grund, art}
let blitz = null; // zuletzt geänderter Q-Wert {s, a, d, t0}
let meldung = null; // {text, farbe, t0}
let hinweis = null;
let fehlerMeldung = null;
let stupsAnzeige = null;
let cnv;

// =============================================================================
// Start
// =============================================================================
function setup() {
  ladeSchriften();
  const [cw, ch] = zeichenflaeche();
  cnv = createCanvas(cw, ch);
  S = width / W;

  env = new WagenMitStab();
  agent = new QAgent("einfach");

  erstelleUi();
  cnv.parent(huelle);
  layoutUi();
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
// Ablauf
// =============================================================================
function allesZuruecksetzen() {
  laeuft = false;
  phase = "bereit";
  sch = null;
  blitz = null;
  meldung = null;
  letzteAktion = null;
  env.zuruecksetzen();
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
  agent.neuAufbauen(agent.art);
  agent.epsilon = 1;
  kurve = [];
  allesZuruecksetzen();
}

function aktionsKnopf() {
  if (laeuft) {
    laeuft = false;
    if (modus === "mensch") {
      env.zuruecksetzen();
    }
    return;
  }
  starten();
}

function starten() {
  if (modus === "training" && agent.epsilon < 0.02 && agent.episoden === 0) {
    zeigeHinweis("Hinweis: ε ist 0 – der Agent probiert nichts Neues aus.");
  }
  if (phase !== "bereit" && phase !== "ende" && sch && !env.vorbei) {
    // mitten in einer schrittweisen Episode einfach weitermachen
  } else {
    env.zuruecksetzen();
  }
  phase = "bereit";
  sch = null;
  meldung = null;
  laufStart = agent.episoden;
  zeitKonto = 0;
  pauseBis = 0;
  laeuft = true;
}

function zeigeHinweis(text) {
  hinweis = { text, t0: millis() };
}

// Wie viele Schritte pro Bild?  Zeitlupe/Echtzeit laufen nach der Uhr.
function schritteProBild() {
  if (tempo === "Zeitlupe" || tempo === "Echtzeit" || modus === "mensch") {
    const faktor = tempo === "Zeitlupe" ? 0.25 : 1;
    zeitKonto += (Math.min(deltaTime, 100) / 1000) * faktor;
    let n = 0;
    while (zeitKonto >= PHYSIK.dt && n < 5) {
      zeitKonto -= PHYSIK.dt;
      n++;
    }
    return n;
  }
  if (tempo === "schnell") {
    return 10;
  }
  return Infinity; // Turbo: so viele, wie in 14 ms passen
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
    for (let i = 0; i < n && !env.vorbei; i++) {
      let richtung = 0;
      if (keyIsDown(LEFT_ARROW)) {
        richtung -= 1;
      }
      if (keyIsDown(RIGHT_ARROW)) {
        richtung += 1;
      }
      letzteAktion = richtung === 0 ? null : richtung > 0 ? 1 : 0;
      env.schritt(richtung);
      env.summe += 1;
    }
    if (env.vorbei) {
      episodeAbschliessen();
      laeuft = false;
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
      env.zuruecksetzen();
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
  const s = { z: env.zustand() };
  beobachten(s);
  waehlen(s);
  ausfuehren(s);
  if (modus === "training") {
    lernen(s);
  }
  return s;
}

function beobachten(s) {
  const e = agent.einordnen(s.z);
  s.f = e.f;
  s.s = e.s;
  s.q = agent.q[s.s].slice();
}

function waehlen(s) {
  if (modus === "zufall") {
    s.wahl = { a: Math.random() < 0.5 ? 0 : 1, zufall: null, erkunden: true };
  } else if (modus === "vorfuehren") {
    s.wahl = { a: agent.besteAktion(s.s), zufall: null, erkunden: false };
  } else {
    s.wahl = agent.waehle(s.s);
    s.eps = agent.epsilon;
  }
  letzteAktion = s.wahl.a;
}

function ausfuehren(s) {
  const st = env.schritt(s.wahl.a === 1 ? 1 : -1);
  s.z2 = st.zustand;
  s.gescheitert = st.gescheitert;
  s.vorbei = st.vorbei;
  s.r = agent.belohnung(st.gescheitert);
  env.summe += s.r;
  const e = agent.einordnen(s.z2);
  s.f2 = e.f;
  s.s2 = e.s;
}

function lernen(s) {
  s.upd = agent.lernen(s.s, s.wahl.a, s.r, s.s2, s.gescheitert);
  blitz = { s: s.s, a: s.wahl.a, d: s.upd.neu - s.upd.alt, t0: millis() };
}

function episodeAbschliessen() {
  kurve.push({ schritte: env.schritte, grund: env.grund, art: modus });
  if (kurve.length > 5000) {
    kurve.shift();
  }
  if (modus === "training") {
    agent.episodeBeendet(ui.epsAb.checked());
  }
  const farbe = env.grund === "geschafft" ? FARBE.gruen : FARBE.akzent;
  meldung = { text: `${GRUND_TEXT[env.grund]} · ${env.schritte} Schritte`, farbe, t0: millis(), grund: env.grund };
}

// --- schrittweise mit → -------------------------------------------------------
function schrittVor() {
  if (laeuft || modus === "mensch") {
    return;
  }
  const einzeln = ui.phasen.checked();

  if (phase === "ende" || (phase === "bereit" && env.vorbei)) {
    env.zuruecksetzen();
    meldung = null;
    phase = "bereit";
    sch = null;
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
    sch = { z: env.zustand() };
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

// =============================================================================
// Zeichnen – Grundlagen
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

function grad(rad) {
  return vz((rad * 180) / Math.PI, 1) + "°";
}

function gradS(rad) {
  return vz((rad * 180) / Math.PI, 0) + " °/s";
}

function klammer(v) {
  return v < 0 ? "(" + v.toFixed(2) + ")" : v.toFixed(2);
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

// Fachgrenzen als lesbarer Text, z. B. "0° … +4°"
function fachText(groesse, i) {
  const n = agent.faecher[groesse];
  if (n <= 1) {
    return "–";
  }
  const g = agent.grenzen(groesse);
  const fmt = (v) => {
    if (groesse === "theta") {
      return grad(v).replace(".0°", "°");
    }
    if (groesse === "omega") {
      return gradS(v);
    }
    return vz(v, 1) + (groesse === "x" ? " m" : " m/s");
  };
  if (i === 0) {
    return "unter " + fmt(g[0]);
  }
  if (i === n - 1) {
    return "über " + fmt(g[n - 2]);
  }
  return fmt(g[i - 1]) + " … " + fmt(g[i]);
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
  textSize(21);
  textAlign(LEFT, CENTER);
  text("KI balanciert", 194, 21);
  textStyle(NORMAL);
  textFont(SCHRIFT);
  textSize(13);
  fill(...FARBE.blass);
  text("Reinforcement Learning · Q-Learning", 194, 41);

  fill(...FARBE.grau);
  textSize(13);
  textAlign(LEFT, CENTER);
  text(statusText(), 26, 70);
}

function statusText() {
  const tab = `Q-Tabelle: ${agent.besuchteZustaende()} von ${agent.anzahl} Zuständen besucht · ${agent.episoden} Episoden gelernt`;
  if (modus === "mensch") {
    return "Selbst steuern · ← und → gedrückt halten · Schaffst du 500 Schritte (10 Sekunden)?";
  }
  if (modus === "zufall") {
    return "Zufallsagent · wirft bei jedem Schritt eine Münze · lernt nichts · " + tab;
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
// Umgebung: Bahn, Wagen, Stab
// =============================================================================
function zeichneUmgebung() {
  const p = P_UMW;
  panel(p);

  // bei kurzer Pause nach dem Ende: den letzten Zustand zeigen
  const zeigeEnde = millis() < pauseBis && sch && sch.z2;
  const z = zeigeEnde ? sch.z2 : env.zustand();

  const wx = MITTE_X + z.x * PX_M;
  const drehY = BODEN_Y - 8 - WAGEN_H;

  // --- Bahn ---
  const links = MITTE_X - PHYSIK.xMax * PX_M;
  const rechts = MITTE_X + PHYSIK.xMax * PX_M;
  stroke(...FARBE.linie);
  strokeWeight(4);
  line(p.x + 16, BODEN_Y, p.x + p.w - 16, BODEN_Y);
  stroke(...FARBE.grau);
  strokeWeight(2);
  line(links, BODEN_Y, rechts, BODEN_Y);
  // Bahnenden: dezent, rot nur wenn der Wagen sie überfahren hat
  const ausBahn = Math.abs(z.x) > PHYSIK.xMax;
  for (const sgn of [-1, 1]) {
    const erreicht = ausBahn && Math.sign(z.x) === sgn;
    stroke(...(erreicht ? FARBE.akzent : FARBE.blass));
    strokeWeight(erreicht ? 3 : 1.5);
    const ex = sgn < 0 ? links : rechts;
    line(ex, BODEN_Y - (erreicht ? 14 : 8), ex, BODEN_Y + 4);
  }

  // Fächer der Position (nur wenn der Agent sie sieht)
  noStroke();
  textFont(SCHRIFT);
  textSize(11);
  fill(...FARBE.blass);
  textAlign(CENTER, TOP);
  text("−2,4 m", links, BODEN_Y + 10);
  text("0", MITTE_X, BODEN_Y + 10);
  text("+2,4 m", rechts, BODEN_Y + 10);
  if (agent.faecher.x > 1) {
    stroke(...FARBE.blass);
    strokeWeight(1);
    gestrichelt(true);
    for (const g of agent.grenzen("x")) {
      line(MITTE_X + g * PX_M, BODEN_Y - 10, MITTE_X + g * PX_M, BODEN_Y + 26);
    }
    gestrichelt(false);
    noStroke();
    const fx = agent.fach(z.x, "x");
    const namen = ["links", "Mitte", "rechts"];
    for (let i = 0; i < 3; i++) {
      fill(...(i === fx ? FARBE.akzent : FARBE.blass));
      textStyle(i === fx ? BOLD : NORMAL);
      text(namen[i], MITTE_X + (i - 1) * 1.6 * PX_M, BODEN_Y + 26);
    }
    textStyle(NORMAL);
  } else {
    noStroke();
    fill(...FARBE.blass);
    text("Der Agent sieht die Wagenposition nicht", MITTE_X, BODEN_Y + 28);
  }

  // --- Winkelfächer hinter dem Stab: so "sieht" der Agent den Winkel ---
  const n = agent.faecher.theta;
  const ft = agent.fach(z.theta, "theta");
  const rF = STAB_PX + 18;
  for (let i = 0; i < n; i++) {
    const a1 = -PHYSIK.thetaMax + (2 * PHYSIK.thetaMax * i) / n;
    const a2 = -PHYSIK.thetaMax + (2 * PHYSIK.thetaMax * (i + 1)) / n;
    noStroke();
    if (i === ft) {
      fill(...FARBE.akzent, 34);
    } else {
      fill(...FARBE.flaeche2, i % 2 === 0 ? 150 : 90);
    }
    arc(wx, drehY, 2 * rF, 2 * rF, -HALF_PI + a1, -HALF_PI + a2, PIE);
  }
  // Grenze ±12°: nur einblenden, wenn der Stab sie überschritten hat
  if (Math.abs(z.theta) > PHYSIK.thetaMax) {
    const sgn = Math.sign(z.theta);
    const a = sgn * PHYSIK.thetaMax;
    stroke(...FARBE.akzent);
    strokeWeight(1.5);
    gestrichelt(true);
    line(wx, drehY, wx + Math.sin(a) * (rF + 8), drehY - Math.cos(a) * (rF + 8));
    gestrichelt(false);
    noStroke();
    fill(...FARBE.akzent);
    textSize(11);
    textAlign(CENTER, BOTTOM);
    text(sgn < 0 ? "−12°" : "+12°", wx + Math.sin(a) * (rF + 14), drehY - Math.cos(a) * (rF + 12));
  }

  // --- Wagen ---
  const umgefallen = env.vorbei || zeigeEnde;
  noStroke();
  fill(...FARBE.text);
  rect(wx - WAGEN_B / 2, drehY, WAGEN_B, WAGEN_H, 6);
  fill(...FARBE.grau);
  circle(wx - WAGEN_B / 2 + 14, BODEN_Y - 6, 13);
  circle(wx + WAGEN_B / 2 - 14, BODEN_Y - 6, 13);
  fill(...FARBE.flaeche);
  circle(wx - WAGEN_B / 2 + 14, BODEN_Y - 6, 4);
  circle(wx + WAGEN_B / 2 - 14, BODEN_Y - 6, 4);

  // Kraftpfeil
  if (letzteAktion !== null && (laeuft || phase === "ausfuehren" || phase === "lernen" || phase === "waehlen")) {
    const r = letzteAktion === 1 ? 1 : -1;
    const fx0 = wx - r * (WAGEN_B / 2 + 6);
    const fx1 = fx0 - r * 34;
    stroke(...AKTION_FARBE[letzteAktion]);
    strokeWeight(4);
    line(fx1, drehY + WAGEN_H / 2, fx0 - r * 8, drehY + WAGEN_H / 2);
    noStroke();
    fill(...AKTION_FARBE[letzteAktion]);
    triangle(fx0, drehY + WAGEN_H / 2, fx0 - r * 12, drehY + WAGEN_H / 2 - 8, fx0 - r * 12, drehY + WAGEN_H / 2 + 8);
  }

  // --- Stab ---
  const sx = wx + Math.sin(z.theta) * STAB_PX;
  const sy = drehY - Math.cos(z.theta) * STAB_PX;
  stroke(...(umgefallen && (zeigeEnde ? sch.gescheitert : env.grund !== "geschafft") ? FARBE.akzent : FARBE.senf));
  strokeWeight(9);
  strokeCap(ROUND);
  line(wx, drehY, sx, sy);
  noStroke();
  fill(...FARBE.flaeche);
  circle(wx, drehY, 8);

  // Drehgeschwindigkeit als gebogener Pfeil an der Stabspitze
  if (Math.abs(z.omega) > 0.02) {
    const laenge = constrain(z.omega, -2, 2) * 0.35;
    const r = STAB_PX + 2;
    const a0 = -HALF_PI + z.theta;
    const a1 = a0 + laenge;
    stroke(...FARBE.text);
    strokeWeight(2);
    noFill();
    arc(wx, drehY, 2 * r, 2 * r, Math.min(a0, a1), Math.max(a0, a1));
    const ex = wx + Math.cos(a1) * r;
    const ey = drehY + Math.sin(a1) * r;
    const t = a1 + (laenge > 0 ? HALF_PI : -HALF_PI);
    noStroke();
    fill(...FARBE.text);
    push();
    translate(ex, ey);
    rotate(t);
    triangle(4, 0, -5, -5, -5, 5);
    pop();
  }

  // --- Messwerte ---
  noStroke();
  textFont(MONO);
  textSize(13);
  textAlign(LEFT, TOP);
  fill(...FARBE.text);
  text(`x = ${vz(z.x, 2)} m   v = ${vz(z.v, 2)} m/s   θ = ${grad(z.theta)}   ω = ${gradS(z.omega)}`, p.x + 16, p.y + 46);
  textFont(SCHRIFT);
  textSize(12);
  fill(...FARBE.grau);
  const e = agent.einordnen(z);
  text(`Agent sieht: Zustand s = ${e.s} (Zeile der Q-Tabelle)`, p.x + 16, p.y + 68);
  textAlign(RIGHT, TOP);
  const schritte = zeigeEnde && kurve.length ? kurve[kurve.length - 1].schritte : env.schritte;
  text(`Schritt ${schritte} von ${PHYSIK.maxSchritte}`, p.x + p.w - 16, p.y + 68);

  // --- Meldung (umgefallen, geschafft …) ---
  const schnellLauf = laeuft && (tempo === "schnell" || tempo === "Turbo") && modus !== "mensch";
  if (meldung && !schnellLauf && (millis() - meldung.t0 < 2500 || !laeuft)) {
    textFont(TITEL);
    textStyle(BOLD);
    textSize(19);
    textAlign(CENTER, CENTER);
    const b = textWidth(meldung.text) + 36;
    fill(255, 235);
    stroke(...meldung.farbe);
    strokeWeight(1.5);
    rect(MITTE_X - b / 2, p.y + 90, b, 32, 16);
    noStroke();
    fill(...meldung.farbe);
    text(meldung.text, MITTE_X, p.y + 106);
    textStyle(NORMAL);
  } else if (modus === "mensch" && !laeuft) {
    textFont(SCHRIFT);
    textSize(14);
    textAlign(CENTER, CENTER);
    fill(...FARBE.grau);
    text("Leertaste oder ← / → drücken, um zu starten", MITTE_X, p.y + 106);
  }

  // Stups-Anzeige
  if (stupsAnzeige && millis() - stupsAnzeige.t0 < 600) {
    const a = 255 * (1 - (millis() - stupsAnzeige.t0) / 600);
    noFill();
    stroke(...FARBE.akzent, a);
    strokeWeight(2);
    circle(stupsAnzeige.x, stupsAnzeige.y, 20 + (millis() - stupsAnzeige.t0) / 12);
  }

  // Spielregeln
  noStroke();
  textFont(SCHRIFT);
  textSize(12);
  textAlign(CENTER, BOTTOM);
  fill(...FARBE.grau);
  text(
    "Abbruch: Stab kippt mehr als 12° · Wagen verlässt die Bahn (±2,4 m)   ·   Ziel: 500 Schritte (10 s)",
    MITTE_X,
    p.y + p.h - 7
  );

  noStroke();
  fill(...FARBE.blass);
  textFont(SCHRIFT);
  textSize(12);
  textAlign(RIGHT, CENTER);
  text("Klick neben den Stab: anstupsen", p.x + p.w - 16, p.y + KOPF_H / 2 + 1);
}

// =============================================================================
// Lernkurve
// =============================================================================
function zeichneKurve() {
  const p = P_KURVE;
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
  stroke(...FARBE.linie);
  strokeWeight(1);
  for (const v of [0, 250, 500]) {
    const y = k.y + k.h - (v / 500) * k.h;
    line(k.x, y, k.x + k.w, y);
  }
  noStroke();
  fill(...FARBE.blass);
  textSize(11);
  textAlign(RIGHT, CENTER);
  for (const v of [0, 250, 500]) {
    text(String(v), k.x - 6, k.y + k.h - (v / 500) * k.h);
  }
  textAlign(LEFT, TOP);
  text("Episode →", k.x, k.y + k.h + 4);

  if (kurve.length === 0) {
    textAlign(CENTER, CENTER);
    textSize(13);
    fill(...FARBE.grau);
    text("Noch keine Episode. Jede Episode endet, wenn der Stab umfällt.", k.x + k.w / 2, k.y + k.h / 2 - 8);
    return;
  }

  const n = Math.max(kurve.length, 20);
  const dx = k.w / n;
  const r = constrain(dx * 0.9, 1.6, 5);
  noStroke();
  for (let i = 0; i < kurve.length; i++) {
    const e = kurve[i];
    fill(...ART_FARBE[e.art], e.art === "training" ? 110 : 190);
    circle(k.x + (i + 0.5) * dx, k.y + k.h - (e.schritte / 500) * k.h, r * 2);
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
    fenster.push(kurve[i].schritte);
    summe += kurve[i].schritte;
    if (fenster.length > 20) {
      summe -= fenster.shift();
    }
    vertex(k.x + (i + 0.5) * dx, k.y + k.h - (summe / fenster.length / 500) * k.h);
  }
  endShape();

  const letzte = kurve[kurve.length - 1];
  noStroke();
  fill(...FARBE.grau);
  textSize(11);
  textAlign(RIGHT, TOP);
  text(`${kurve.length} Episoden · letzte: ${letzte.schritte} Schritte · Linie: Mittel der letzten 20 Trainings-Episoden`, k.x + k.w, k.y + k.h + 4);
}

// =============================================================================
// Q-Tabelle
// =============================================================================
// Teilt die Q-Tabelle in Kacheln: je Kombination aus Wagenposition und
// -geschwindigkeit eine Tabelle Winkel × Drehgeschwindigkeit.
function qGeometrie() {
  const F = agent.faecher;
  const lueckeX = F.x > 1 ? 18 : 0;
  const lueckeY = F.v > 1 ? 18 : 0;
  const kopfX = F.x > 1 ? 18 : 0; // Platz für Überschriften der Kacheln
  const kw = (QT.w - lueckeX * (F.x - 1)) / F.x;
  const kh = (QT.h - kopfX - (lueckeY + kopfX) * (F.v - 1)) / F.v;
  return { F, lueckeX, lueckeY, kopfX, kw, kh, zw: kw / F.theta, zh: kh / F.omega };
}

// linke obere Ecke der Zelle (Fächer f) im Bild
function zelle(f) {
  const g = qGeometrie();
  const kx = QT.x + f.x * (g.kw + g.lueckeX);
  // positive Geschwindigkeit oben
  const vr = g.F.v - 1 - f.v;
  const ky = QT.y + g.kopfX + vr * (g.kh + g.lueckeY + g.kopfX);
  // positive Drehgeschwindigkeit oben
  const or = g.F.omega - 1 - f.omega;
  return { x: kx + f.theta * g.zw, y: ky + or * g.zh, w: g.zw, h: g.zh, kx, ky, g };
}

function faecherAus(s) {
  const F = agent.faecher;
  let r = s;
  const omega = r % F.omega;
  r = Math.floor(r / F.omega);
  const theta = r % F.theta;
  r = Math.floor(r / F.theta);
  const v = r % F.v;
  const x = Math.floor(r / F.v);
  return { x, v, theta, omega };
}

function zeichneQTabelle() {
  const p = P_Q;
  panel(p);
  const g = qGeometrie();
  const F = g.F;
  const gross = g.zw > 80;

  // Maßstab für die Farbstärke
  let maxDiff = 0.001;
  for (const q of agent.q) {
    maxDiff = Math.max(maxDiff, Math.abs(q[1] - q[0]));
  }

  textFont(SCHRIFT);
  for (let s = 0; s < agent.anzahl; s++) {
    const f = faecherAus(s);
    const c = zelle(f);
    const q = agent.q[s];
    const besucht = agent.besuche[s] > 0;
    stroke(...FARBE.linie);
    strokeWeight(1);
    if (!besucht && q[0] === 0 && q[1] === 0) {
      fill(...FARBE.papier);
      rect(c.x, c.y, c.w, c.h);
      continue;
    }
    const besser = q[1] > q[0] ? 1 : q[0] > q[1] ? 0 : -1;
    if (besser < 0) {
      fill(...FARBE.flaeche);
    } else {
      const a = 40 + 170 * Math.sqrt(Math.abs(q[1] - q[0]) / maxDiff);
      fill(...AKTION_FARBE[besser], a);
    }
    rect(c.x, c.y, c.w, c.h);

    noStroke();
    if (gross) {
      textFont(MONO);
      textSize(12);
      for (let a = 0; a < 2; a++) {
        fill(...FARBE.text);
        textStyle(a === besser ? BOLD : NORMAL);
        textAlign(a === 0 ? LEFT : RIGHT, CENTER);
        const tx = a === 0 ? c.x + 6 : c.x + c.w - 6;
        text((a === 0 ? "←" : "") + q[a].toFixed(1) + (a === 1 ? "→" : ""), tx, c.y + c.h / 2);
      }
      textStyle(NORMAL);
    } else if (besser >= 0 && c.w > 14) {
      fill(255, 230);
      textFont(SCHRIFT);
      textSize(Math.min(12, c.h * 0.8));
      textAlign(CENTER, CENTER);
      text(AKTION_NAME[besser], c.x + c.w / 2, c.y + c.h / 2);
    }
  }

  // gerade geänderter Q-Wert blitzt auf
  if (blitz && millis() - blitz.t0 < 900 && blitz.s < agent.anzahl) {
    const c = zelle(faecherAus(blitz.s));
    const a = 255 * (1 - (millis() - blitz.t0) / 900);
    noFill();
    stroke(...FARBE.akzentHell, a);
    strokeWeight(3);
    const hx = gross ? (blitz.a === 0 ? c.x : c.x + c.w / 2) : c.x;
    rect(hx, c.y, gross ? c.w / 2 : c.w, c.h);
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
    sJetzt = agent.einordnen(env.zustand()).s;
  }
  if (sNeu !== null && sNeu !== sJetzt) {
    const c = zelle(faecherAus(sNeu));
    noFill();
    stroke(...FARBE.text);
    strokeWeight(2.5);
    gestrichelt(true);
    rect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
    gestrichelt(false);
  }
  if (sJetzt !== null) {
    const c = zelle(faecherAus(sJetzt));
    noFill();
    stroke(...FARBE.akzent);
    strokeWeight(3);
    rect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
    if (sch && phase === "waehlen" && gross && !laeuft) {
      // gewählte Aktion markieren
      const a = sch.wahl.a;
      stroke(...AKTION_FARBE[a]);
      strokeWeight(3);
      rect(a === 0 ? c.x + 3 : c.x + c.w / 2, c.y + 3, c.w / 2 - 3, c.h - 6, 3);
    }
  }

  // --- Achsen ---
  noStroke();
  fill(...FARBE.grau);
  textFont(SCHRIFT);
  if (F.x === 1) {
    // eine große Tabelle: Fachgrenzen beschriften
    textSize(11);
    textAlign(CENTER, TOP);
    const gt = agent.grenzen("theta");
    for (let i = 0; i < gt.length; i++) {
      text(grad(gt[i]).replace(".0°", "°"), QT.x + (i + 1) * g.zw, QT.y + QT.h + 4);
    }
    textAlign(RIGHT, CENTER);
    const go = agent.grenzen("omega");
    for (let i = 0; i < go.length; i++) {
      text(gradS(go[i]), QT.x - 6, QT.y + QT.h - (i + 1) * g.zh);
    }
    textSize(12);
    fill(...FARBE.text);
    textAlign(CENTER, TOP);
    text("Winkel θ   ←  Stab neigt nach links  ·  nach rechts  →", QT.x + QT.w / 2, QT.y + QT.h + 20);
    push();
    translate(QT.x - 66, QT.y + QT.h / 2);
    rotate(-HALF_PI);
    textAlign(CENTER, BOTTOM);
    text("Drehgeschwindigkeit ω   ←  kippt nach links  ·  nach rechts  →", 0, 0);
    pop();
  } else {
    // Kacheln beschriften
    const xn = ["Wagen links", "Wagen Mitte", "Wagen rechts"];
    const vn = ["fährt nach rechts", "steht fast", "fährt nach links"];
    textSize(11);
    for (let ix = 0; ix < F.x; ix++) {
      for (let iv = 0; iv < F.v; iv++) {
        const c = zelle({ x: ix, v: F.v - 1 - iv, theta: 0, omega: F.omega - 1 });
        fill(...FARBE.grau);
        textAlign(LEFT, BOTTOM);
        text(`${xn[ix]} · ${vn[iv]}`, c.kx, c.ky - 3);
      }
    }
    textSize(12);
    fill(...FARBE.text);
    textAlign(CENTER, TOP);
    text("je Kachel: Winkel θ nach rechts  ·  Drehgeschwindigkeit ω nach oben", QT.x + QT.w / 2, QT.y + QT.h + 8);
  }

  // Legende
  const ly = p.y + p.h - 22;
  textSize(12);
  textAlign(LEFT, CENTER);
  let x = p.x + 18;
  for (const [farbe, txt] of [
    [FARBE.links, "← besser"],
    [FARBE.rechts, "→ besser"],
  ]) {
    noStroke();
    fill(...farbe, 170);
    rect(x, ly - 7, 22, 14, 3);
    fill(...FARBE.grau);
    text(txt, x + 28, ly);
    x += 28 + textWidth(txt) + 18;
  }
  fill(...FARBE.papier);
  stroke(...FARBE.linie);
  rect(x, ly - 7, 22, 14, 3);
  noStroke();
  fill(...FARBE.grau);
  text("nie besucht", x + 28, ly);
  x += 28 + textWidth("nie besucht") + 18;
  stroke(...FARBE.akzent);
  strokeWeight(3);
  noFill();
  rect(x, ly - 7, 22, 14);
  noStroke();
  fill(...FARBE.grau);
  text("aktueller Zustand s", x + 28, ly);
  x += 28 + textWidth("aktueller Zustand s") + 18;
  stroke(...FARBE.text);
  strokeWeight(2);
  noFill();
  gestrichelt(true);
  rect(x, ly - 7, 22, 14);
  gestrichelt(false);
  noStroke();
  fill(...FARBE.grau);
  text("neuer Zustand s'", x + 28, ly);

  textAlign(RIGHT, CENTER);
  fill(...FARBE.blass);
  text(gross ? "Zahlen: Q(s,←) und Q(s,→)" : "Maus über eine Zelle: Q-Werte", p.x + p.w - 18, ly);

  // Unterzeile im Kopf
  textAlign(RIGHT, CENTER);
  textSize(12);
  fill(...FARBE.grau);
  text(
    `${agent.anzahl} Zustände × 2 Aktionen · Farbe = bessere Aktion, Stärke = wie viel besser`,
    p.x + p.w - 16,
    p.y + KOPF_H / 2 + 1
  );
}

function zelleUnterMaus() {
  const mx = mausX();
  const my = mausY();
  if (mx < QT.x || mx > QT.x + QT.w || my < QT.y || my > QT.y + QT.h) {
    return null;
  }
  for (let s = 0; s < agent.anzahl; s++) {
    const c = zelle(faecherAus(s));
    if (mx >= c.x && mx < c.x + c.w && my >= c.y && my < c.y + c.h) {
      return s;
    }
  }
  return null;
}

// =============================================================================
// Erklärung (mit den echten Zahlen) und Agentenkreislauf
// =============================================================================
function aktionText(a) {
  return `${AKTION_NAME[a]} (${AKTION_TEXT[a]} schieben)`;
}

function erklaerung() {
  if (modus === "mensch") {
    if (laeuft) {
      return {
        titel: "Selbst steuern",
        text: "← und → schieben den Wagen. Lässt du los, rollt er frei. Der Stab darf nicht mehr als 12° kippen, der Wagen nicht aus der Bahn fahren.",
        formeln: [`Schritt ${env.schritte} von 500   (1 Schritt = 0,02 s)`],
      };
    }
    const meine = kurve.filter((k) => k.art === "mensch");
    const e = {
      titel: "Selbst steuern: Wie gut bist du?",
      text: "Erst selbst probieren: Halte ← oder → gedrückt, um den Wagen zu schieben. Schaffst du 500 Schritte (10 Sekunden)? Tipp: Unter „Tempo“ gibt es eine Zeitlupe. Danach lernt der Agent dieselbe Aufgabe – ohne die Physik zu kennen.",
      formeln: [],
    };
    if (meine.length > 0) {
      const best = Math.max(...meine.map((k) => k.schritte));
      e.formeln.push(`Deine Versuche: ${meine.length}   bester: ${best} Schritte   letzter: ${meine[meine.length - 1].schritte}`);
    }
    return e;
  }

  if (laeuft) {
    if (modus === "training") {
      return {
        titel: "Training läuft",
        text: "Bei jedem Schritt: Zustand einordnen, Aktion wählen (ε-greedy), ausführen, Q-Wert anpassen. Zu Beginn probiert der Agent viel aus (ε groß), später nutzt er immer mehr sein Wissen. Beobachte, wie sich die Q-Tabelle einfärbt.",
        formeln: [
          `Episode ${agent.episoden - laufStart + 1} von ${episodenZiel}   ε = ${f2(agent.epsilon)}`,
          `bisher ${agent.updates} Q-Werte angepasst`,
        ],
      };
    }
    if (modus === "zufall") {
      return {
        titel: "Zufallsagent",
        text: "Der Zufallsagent wählt jede Aktion per Münzwurf und lernt nichts. So sieht man, wie schwer die Aufgabe ohne Wissen ist – der Vergleichswert für den lernenden Agenten.",
        formeln: mittelText("zufall"),
      };
    }
    return {
      titel: "Vorführen",
      text: "Der Agent nutzt nur noch sein Wissen (ε = 0) und lernt nicht dazu: In jedem Zustand wählt er die Aktion mit dem größeren Q-Wert. Klick neben den Stab, um ihn anzustupsen – fängt der Agent das ab?",
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
        text: "Ein Agent ohne Gedächtnis: Er wirft bei jedem Schritt eine Münze. Starte ihn oben oder gehe mit → Schritt für Schritt durch. Wie lange hält der Stab im Mittel?",
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
  const F = agent.faecher;

  if (phase === "beobachten") {
    const formeln = [];
    if (F.x > 1) {
      formeln.push(`x = ${vz(s.z.x, 2)} m → Fach ${s.f.x + 1} von ${F.x}     v = ${vz(s.z.v, 2)} m/s → Fach ${s.f.v + 1} von ${F.v}`);
    }
    formeln.push(`θ = ${grad(s.z.theta)}       → Fach ${s.f.theta + 1} von ${F.theta}  (${fachText("theta", s.f.theta)})`);
    formeln.push(`ω = ${gradS(s.z.omega)}   → Fach ${s.f.omega + 1} von ${F.omega}  (${fachText("omega", s.f.omega)})`);
    formeln.push(`Zustand s = ${s.s}:   Q(s,←) = ${f2(s.q[0])}   Q(s,→) = ${f2(s.q[1])}`);
    return {
      titel: "1 · Zustand beobachten",
      text:
        F.x > 1
          ? "Der Agent misst die vier Werte und sortiert jeden in ein Fach. Die Kombination der Fächer ist der Zustand s – eine Zelle der Q-Tabelle (rot umrandet)."
          : "Der Agent misst Winkel θ und Drehgeschwindigkeit ω und sortiert beide in Fächer. Die Kombination ist der Zustand s – eine Zelle der Q-Tabelle (rot umrandet). Die Wagenposition sieht er nicht.",
      formeln,
    };
  }

  if (phase === "waehlen") {
    const formeln = [];
    let text;
    if (modus === "zufall") {
      text = "Der Zufallsagent schaut gar nicht in die Tabelle – er wirft eine Münze.";
      formeln.push(`Münzwurf → Aktion ${aktionText(s.wahl.a)}`);
    } else if (modus === "vorfuehren") {
      text = "Beim Vorführen ist ε = 0: Der Agent nimmt immer die Aktion mit dem größeren Q-Wert.";
      formeln.push(`Q(s,←) = ${f2(s.q[0])}   Q(s,→) = ${f2(s.q[1])}`);
      formeln.push(`→ Aktion ${aktionText(s.wahl.a)}`);
    } else {
      text =
        "ε-greedy: Mit Wahrscheinlichkeit ε probiert der Agent etwas Zufälliges aus (Erkunden), sonst nimmt er die Aktion mit dem größeren Q-Wert (Wissen nutzen).";
      if (s.wahl.erkunden) {
        formeln.push(`Zufallszahl ${s.wahl.zufall.toFixed(3)} < ε = ${f2(s.eps)}   → Erkunden!`);
        formeln.push(`zufällige Aktion: ${aktionText(s.wahl.a)}`);
      } else {
        formeln.push(`Zufallszahl ${s.wahl.zufall.toFixed(3)} ≥ ε = ${f2(s.eps)}   → Wissen nutzen`);
        const vergleich = s.q[0] === s.q[1] ? "=" : s.q[0] > s.q[1] ? ">" : "<";
        formeln.push(`Q(s,←) = ${f2(s.q[0])}  ${vergleich}  Q(s,→) = ${f2(s.q[1])}`);
        formeln.push(`→ Aktion ${aktionText(s.wahl.a)}${vergleich === "=" ? "  (Gleichstand: Münzwurf)" : ""}`);
      }
    }
    return { titel: "2 · Aktion wählen", text, formeln };
  }

  if (!ui.phasen.checked() && (phase === "ausfuehren" || phase === "lernen")) {
    // ein ganzer Schritt auf einmal: kurze Fassung
    const formeln = [
      `s = ${s.s}  →  Aktion ${AKTION_NAME[s.wahl.a]}${s.wahl.erkunden && modus === "training" ? " (erkundet)" : ""}  →  s' = ${s.s2}`,
      `θ: ${grad(s.z.theta)} → ${grad(s.z2.theta)}     ω: ${gradS(s.z.omega)} → ${gradS(s.z2.omega)}`,
      `Belohnung r = ${s.r > 0 ? "+" : ""}${s.r}${s.gescheitert ? "  (Episode vorbei)" : ""}`,
    ];
    if (s.upd) {
      const u = s.upd;
      formeln.push(`Q(s,${AKTION_NAME[s.wahl.a]}) ← ${f2(u.alt)} + ${f2(u.alpha)}·(${f2(u.ziel)} − ${f2(u.alt)}) = ${f2(u.neu)}`);
    }
    return {
      titel: "Ein ganzer Schritt",
      text: "Beobachten, wählen, ausführen" + (s.upd ? ", lernen" : "") + " – alles auf einmal. Für die Einzelheiten „Phasen einzeln“ anhaken.",
      formeln,
    };
  }

  if (phase === "ausfuehren") {
    const formeln = [
      `θ: ${grad(s.z.theta)} → ${grad(s.z2.theta)}     ω: ${gradS(s.z.omega)} → ${gradS(s.z2.omega)}`,
      `x: ${vz(s.z.x, 2)} → ${vz(s.z2.x, 2)} m     neuer Zustand s' = ${s.s2}`,
      s.gescheitert
        ? `Belohnung r = ${s.r}   (${env.grund === "bahn" ? "aus der Bahn" : "Stab umgefallen"} – Episode vorbei)`
        : `Belohnung r = +1   (Stab steht noch)`,
    ];
    return {
      titel: "3 · Aktion ausführen",
      text: `Der Wagen wird 0,02 s lang mit 10 N ${AKTION_TEXT[s.wahl.a]} geschoben. Die Umgebung meldet den neuen Zustand s' (gestrichelt) und eine Belohnung r.`,
      formeln,
    };
  }

  if (phase === "lernen") {
    const u = s.upd;
    const an = AKTION_NAME[s.wahl.a];
    const formeln = [];
    if (u.gescheitert) {
      formeln.push(`Ziel = r = ${u.r}    (danach kommt nichts mehr – die Episode ist vorbei)`);
    } else {
      formeln.push(`Ziel = r + γ · max Q(s',·) = ${u.r} + ${f2(u.gamma)} · ${f2(u.maxNeu)} = ${f2(u.ziel)}`);
    }
    formeln.push(`Fehler = Ziel − Q(s,${an}) = ${f2(u.ziel)} − ${f2(u.alt)} = ${vz(u.fehler, 2)}`);
    formeln.push(`Q(s,${an}) ← ${f2(u.alt)} + ${f2(u.alpha)} · ${klammer(u.fehler)} = ${f2(u.neu)}`);
    return {
      titel: "4 · Q-Wert anpassen",
      text: "Das Ziel ist die Belohnung jetzt plus der (mit γ abgezinste) beste Wert im neuen Zustand. Der Unterschied zum alten Q-Wert ist die Überraschung – davon wird der Anteil α übernommen.",
      formeln,
    };
  }

  if (phase === "ende") {
    const k = kurve[kurve.length - 1];
    return {
      titel: "Episode vorbei",
      text: `${k.grund === "geschafft" ? "Geschafft: 500 Schritte (10 Sekunden) balanciert" : GRUND_TEXT[k.grund] + " nach " + k.schritte + " Schritten"}. Mit → beginnt eine neue Episode – die Q-Tabelle bleibt erhalten.${
        modus === "training" && ui.epsAb.checked() ? " ε wurde etwas kleiner." : ""
      }`,
      formeln: modus === "training" ? [`ε = ${f2(agent.epsilon)}   Episoden gelernt: ${agent.episoden}`] : [],
    };
  }
  return { titel: "", text: "", formeln: [] };
}

function mittelText(art) {
  const liste = kurve.filter((k) => k.art === art);
  if (liste.length === 0) {
    return [];
  }
  const m = liste.reduce((a, k) => a + k.schritte, 0) / liste.length;
  return [`${liste.length} Episoden   im Mittel ${m.toFixed(0)} Schritte   bester Lauf: ${Math.max(...liste.map((k) => k.schritte))}`];
}

function trainingsFazit() {
  const tr = kurve.filter((k) => k.art === "training");
  if (tr.length < 10) {
    return {
      titel: "Training mit Q-Learning",
      text: "Der Agent kennt die Physik nicht. Er probiert aus und merkt sich in der Q-Tabelle, wie viel Belohnung jede Aktion in jedem Zustand gebracht hat. Gehe mit → Schritt für Schritt durch oder starte oben das Training.",
      formeln: ["Q(s,a) ← Q(s,a) + α · ( r + γ · max Q(s',·) − Q(s,a) )"],
    };
  }
  const letzte = tr.slice(-20);
  const m = letzte.reduce((a, k) => a + k.schritte, 0) / letzte.length;
  const bahn = letzte.filter((k) => k.grund === "bahn").length;
  const geschafft = letzte.filter((k) => k.grund === "geschafft").length;
  let text = `Nach ${agent.episoden} Episoden hält der Stab im Mittel ${m.toFixed(0)} Schritte (letzte 20 Episoden, ${geschafft}× geschafft). `;
  if (agent.epsilon > 0.2) {
    text += "ε ist noch groß – der Agent probiert viel aus. Weitertrainieren oder unter „Vorführen“ ohne Ausprobieren testen.";
  } else if (bahn >= 5 && agent.faecher.x === 1) {
    text += `${bahn}× fuhr der Wagen aus der Bahn: Der Agent sieht die Wagenposition nicht! Tipp: Zustand „Stab + Wagen“ und Belohnung „Strafe −100“ wählen, dann 1000 Episoden trainieren.`;
  } else if (m < 150) {
    text += "Das reicht noch nicht. Tipp: weitertrainieren, Lernrate α ändern oder „Q-Tabelle leeren“ und neu beginnen.";
  } else {
    text += "Schau dir unter „Vorführen“ an, was der Agent gelernt hat.";
  }
  return { titel: "Training beendet", text, formeln: ["Q(s,a) ← Q(s,a) + α · ( r + γ · max Q(s',·) − Q(s,a) )"] };
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
    const maxZ = modus === "mensch" ? 5 : e.formeln.length >= 4 ? 2 : 3;
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
    if (ty + 16 > unten + (modus === "mensch" ? 40 : 0)) {
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
    kasten(yA, "Du", "schaust hin, drückst ← oder →", laeuft);
  } else {
    kasten(yA, "Agent", phase === "lernen" ? "passt Q-Tabelle an" : "Q-Tabelle, wählt Aktion", aktivAgent);
  }
  kasten(yU, "Umgebung", "Wagen mit Stab · Physik", aktivUmw);

  // Pfeil rechts: Aktion nach unten
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
    mensch: "Tipp: In der Zeitlupe ist es viel leichter.\nLässt du beide Tasten los, rollt der Wagen frei.",
    zufall: "α, γ und ε spielen hier keine Rolle:\nDer Zufallsagent lernt nicht.",
    training: "α: Wie stark zählt neue Erfahrung?\nγ: Wie wichtig ist die Zukunft?\nε: Wie oft wird zufällig ausprobiert?",
    vorfuehren: "Beim Vorführen gilt ε = 0, und es wird\nnicht gelernt. „Turbo“ zeigt schnell den\nMittelwert vieler Episoden.",
  };
  text(tipps[modus], 1240, 818);
}

// -----------------------------------------------------------------------------
// Tooltip und Fehlermeldung
// -----------------------------------------------------------------------------
function zeichneTooltip() {
  const s = zelleUnterMaus();
  if (s === null) {
    return;
  }
  const f = faecherAus(s);
  const F = agent.faecher;
  const zeilen = [`Zustand s = ${s}   (${agent.besuche[s]}× angepasst)`];
  if (F.x > 1) {
    zeilen.push(`x: ${fachText("x", f.x)}   v: ${fachText("v", f.v)}`);
  }
  zeilen.push(`θ: ${fachText("theta", f.theta)}`);
  zeilen.push(`ω: ${fachText("omega", f.omega)}`);
  zeilen.push(`Q(s,←) = ${f2(agent.q[s][0])}    Q(s,→) = ${f2(agent.q[s][1])}`);

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
  const mx = mausX();
  const my = mausY();
  const p = P_UMW;
  if (mx < p.x || mx > p.x + p.w || my < p.y + KOPF_H || my > p.y + p.h) {
    return;
  }
  if (env.vorbei) {
    return;
  }
  // links vom Stab geklickt → Stab nach rechts stupsen und umgekehrt
  const wx = MITTE_X + env.x * PX_M;
  const richtung = mx < wx ? 1 : -1;
  env.stups(richtung * 0.6);
  stupsAnzeige = { x: mx, y: my, t0: millis() };
}

function keyPressed() {
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
  if (modus === "mensch") {
    if ((key === "ArrowLeft" || key === "ArrowRight") && !laeuft) {
      starten();
    }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      return false;
    }
    return true;
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
function tabelleSpeichern() {
  const jetzt = new Date();
  const datum = jetzt.toISOString().split("T")[0];
  const uhr = jetzt.toTimeString().split(" ")[0].replace(/:/g, "-");
  const name = prompt("Dateiname:", `${datum}_${uhr}_q-tabelle.json`);
  if (name === null) {
    return;
  }
  const blob = new Blob([JSON.stringify(agent.alsJSON())], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = name;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dateiGewaehlt(datei) {
  if (!datei || !datei.name || !datei.name.toLowerCase().endsWith(".json")) {
    alert("Bitte eine JSON-Datei wählen.");
    return;
  }
  const leser = new FileReader();
  leser.onload = (ev) => {
    try {
      agent.ausJSON(JSON.parse(ev.target.result));
      kurve = [];
      allesZuruecksetzen();
    } catch (err) {
      alert("Die Q-Tabelle konnte nicht geladen werden: " + err.message);
    }
  };
  leser.readAsText(datei.file);
  ui.datei.elt.value = "";
}
