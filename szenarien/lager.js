// =============================================================================
//  szenarien/lager.js – Hochregallager: Einlagerstrategie
// =============================================================================
//  Werkstücke kommen am Übergabeplatz an und werden vom Regalbediengerät
//  eingelagert. Neben dem Übergabeplatz gibt es 3 nahe Plätze (kurze Fahrt),
//  der Rest des Regals ist weit weg.
//
//    Klassen   A = Schnelldreher (kommt oft, wird schnell wieder gebraucht)
//              B = Mitteldreher
//              C = Langsamdreher (bleibt lange liegen)
//
//    Zustand   Klasse des ankommenden Teils × Belegung der 3 nahen Plätze
//              (wie viele A, B, C liegen dort?)        → 3 × 20 = 60 Zustände
//    Aktionen  nah einlagern / fern einlagern  (nah voll → es geht automatisch fern)
//
//    Belohnung −Fahrzeit für Ein- und Auslagern: nah 2 s, fern 8 s
//              (jedes Teil wird genau einmal ausgelagert, deshalb wird die
//              Fahrzeit gleich beim Einlagern verbucht)
//    Ablauf    je Takt kommt ein Teil (A 50 %, B 30 %, C 20 %),
//              jedes gelagerte Teil wird mit A 30 %, B 10 %, C 3 % ausgelagert
//    Episode   eine Schicht mit 50 Einlagerungen
//
//  Mit Wertiteration nachgerechnet:
//    γ klein (0 … 0,5)  alles nah, solange frei              (≈ 291 s je Schicht)
//    γ = 0,95           ABC-Strategie: A nah, C fern, B je nach Belegung (≈ 244 s)
//    Zufall                                                  (≈ 309 s)
//  Der Grund: Ein C-Teil blockiert einen nahen Platz sehr lange – dann muss
//  manches A-Teil fern liegen. Das sieht nur ein Agent, der weit vorausschaut.
// =============================================================================

(() => {
  const NAH = 3;
  const FERN = 15;
  const P_ANKUNFT = [0.5, 0.3, 0.2];
  const P_RAUS = [0.3, 0.1, 0.03];
  const KOSTEN = [2, 8];
  const TAKTE = 50;
  const KLASSE = ["A", "B", "C"];
  const KLASSE_TEXT = ["Schnelldreher", "Mitteldreher", "Langsamdreher"];
  const KLASSE_FARBE = [
    [200, 30, 58],
    [184, 122, 28],
    [91, 88, 82],
  ];

  // alle möglichen Belegungen der nahen Plätze, sortiert nach Anzahl
  const BELEGUNGEN = [];
  for (let a = 0; a <= NAH; a++) {
    for (let b = 0; a + b <= NAH; b++) {
      for (let c = 0; a + b + c <= NAH; c++) {
        BELEGUNGEN.push([a, b, c]);
      }
    }
  }
  const belegName = (n) => "A".repeat(n[0]) + "B".repeat(n[1]) + "C".repeat(n[2]);
  BELEGUNGEN.sort((x, y) => x[0] + x[1] + x[2] - (y[0] + y[1] + y[2]) || belegName(x).localeCompare(belegName(y)));
  const NB = BELEGUNGEN.length; // 20

  function belegIndex(n) {
    return BELEGUNGEN.findIndex((m) => m[0] === n[0] && m[1] === n[1] && m[2] === n[2]);
  }

  function zufallsKlasse() {
    const r = Math.random();
    return r < P_ANKUNFT[0] ? 0 : r < P_ANKUNFT[0] + P_ANKUNFT[1] ? 1 : 2;
  }

  // ---------------------------------------------------------------------------
  // Umgebung
  // ---------------------------------------------------------------------------
  const env = {
    zuruecksetzen() {
      this.nah = new Array(NAH).fill(null);
      this.fern = new Array(FERN).fill(null);
      // das Lager ist zu Schichtbeginn nicht leer: ein paar Teile liegen schon fern
      for (let i = 0; i < 6; i++) {
        this.fern[Math.floor(Math.random() * FERN)] = Math.random() < 0.7 ? 2 : 1;
      }
      this.ankunft = zufallsKlasse();
      this.takt = 0;
      this.fahrzeit = 0;
      this.anzahlNah = [0, 0, 0];
      this.anzahlFern = [0, 0, 0];
      this.vorbei = false;
    },

    zustand() {
      return {
        nah: this.nah.slice(),
        fern: this.fern.slice(),
        ankunft: this.ankunft,
        takt: this.takt,
        fahrzeit: this.fahrzeit,
        anzahlNah: this.anzahlNah.slice(),
        anzahlFern: this.anzahlFern.slice(),
      };
    },

    schritt(a) {
      const c = this.ankunft;
      const frei = this.nah.indexOf(null);
      const info = { klasse: c, wunsch: a };
      let r;
      if (a === 0 && frei >= 0) {
        this.nah[frei] = c;
        info.zone = "nah";
        info.platz = frei;
        r = -KOSTEN[0];
        this.anzahlNah[c]++;
      } else {
        info.zone = "fern";
        info.erzwungen = a === 0; // nah war voll
        const freie = [];
        for (let i = 0; i < FERN; i++) {
          if (this.fern[i] === null) {
            freie.push(i);
          }
        }
        if (freie.length > 0) {
          info.platz = freie[Math.floor(Math.random() * freie.length)];
          this.fern[info.platz] = c;
        } else {
          info.platz = -1; // Regal voll: Ausweichlager
        }
        r = -KOSTEN[1];
        this.anzahlFern[c]++;
      }
      // Auslagern: jedes Teil wird mit seiner Wahrscheinlichkeit gebraucht
      info.raus = [];
      for (const [zone, liste] of [
        ["nah", this.nah],
        ["fern", this.fern],
      ]) {
        for (let i = 0; i < liste.length; i++) {
          if (liste[i] !== null && Math.random() < P_RAUS[liste[i]]) {
            info.raus.push({ zone, platz: i, klasse: liste[i] });
            liste[i] = null;
          }
        }
      }
      this.fahrzeit -= r;
      this.takt++;
      this.vorbei = this.takt >= TAKTE;
      this.ankunft = zufallsKlasse();
      // Schichtende ist kein echtes Ende: das Lager arbeitet weiter → nicht terminal
      return { z2: this.zustand(), r, terminal: false, vorbei: this.vorbei, info };
    },
  };

  function zaehleNah(nah) {
    const n = [0, 0, 0];
    for (const k of nah) {
      if (k !== null) {
        n[k]++;
      }
    }
    return n;
  }

  function einordnen(z) {
    const n = zaehleNah(z.nah);
    const b = belegIndex(n);
    return { f: { klasse: z.ankunft, belegung: b }, s: z.ankunft * NB + b };
  }

  function belegText(b) {
    const n = BELEGUNGEN[b];
    const s = n[0] + n[1] + n[2];
    if (s === 0) {
      return "nah: alle 3 Plätze frei";
    }
    return `nah: ${belegName(n)}${s === NAH ? " (voll)" : `, ${NAH - s} frei`}`;
  }

  // ---------------------------------------------------------------------------
  // Q-Tabelle: Spalten = ankommende Klasse, Zeilen = Belegung der nahen Plätze
  // ---------------------------------------------------------------------------
  const QX = 820;
  const QY = 168;
  const KW = 236;
  const LUECKE = 8;
  const ZH = 20.5;

  function qZelle(s) {
    const k = Math.floor(s / NB);
    const b = s % NB;
    return { x: QX + k * (KW + LUECKE), y: QY + b * ZH, w: KW, h: ZH - 2 };
  }

  function zeichneQAchsen() {
    noStroke();
    textFont(SCHRIFT);
    for (let k = 0; k < 3; k++) {
      const x = QX + k * (KW + LUECKE);
      fill(...KLASSE_FARBE[k]);
      textStyle(BOLD);
      textSize(12);
      textAlign(CENTER, BOTTOM);
      text(`ankommend: ${KLASSE[k]} (${KLASSE_TEXT[k]})`, x + KW / 2, QY - 18);
      textStyle(NORMAL);
      textSize(10);
      fill(...FARBE.grau);
      textAlign(LEFT, BOTTOM);
      text("nah", x + 6, QY - 4);
      textAlign(RIGHT, BOTTOM);
      text("fern", x + KW - 6, QY - 4);
    }
    // Zeilen: drei kleine Plätze, gefüllt mit der Klasse
    fill(...FARBE.text);
    textSize(11);
    textAlign(LEFT, BOTTOM);
    text("nahe Plätze", 700, QY - 4);
    for (let b = 0; b < NB; b++) {
      const n = BELEGUNGEN[b];
      const inhalt = [];
      for (let k = 0; k < 3; k++) {
        for (let i = 0; i < n[k]; i++) {
          inhalt.push(k);
        }
      }
      const y = QY + b * ZH + 2;
      for (let i = 0; i < NAH; i++) {
        const x = 704 + i * 20;
        if (i < inhalt.length) {
          fill(...KLASSE_FARBE[inhalt[i]]);
          rect(x, y, 17, ZH - 6, 2);
          fill(255);
          textAlign(CENTER, CENTER);
          textSize(10);
          text(KLASSE[inhalt[i]], x + 8.5, y + (ZH - 6) / 2);
        } else {
          noFill();
          stroke(...FARBE.linie);
          rect(x, y, 17, ZH - 6, 2);
          noStroke();
        }
      }
      if (inhalt.length === NAH) {
        fill(...FARBE.blass);
        textAlign(LEFT, CENTER);
        textSize(10);
        text("voll", 768, y + (ZH - 6) / 2);
      }
    }
    fill(...FARBE.blass);
    textSize(11);
    textAlign(CENTER, TOP);
    text("„voll“: nah geht nicht mehr – beide Aktionen bedeuten dann „fern“.", QX + (3 * KW + 2 * LUECKE) / 2, QY + NB * ZH + 4);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Regal in der Vorderansicht
  // ---------------------------------------------------------------------------
  const RX = 160; // linke Kante Regal
  const RY = 198; // Oberkante Regal
  const PW = 72; // Platzbreite
  const PH = 54; // Platzhöhe
  const SPALTEN = 6; // Spalte 0 = nah (3 Plätze), Spalte 1 … 5 = fern
  const IO = { x: 84, y: RY + 2 * PH + PH / 2 }; // Übergabeplatz

  function platzMitte(zone, platz) {
    if (zone === "nah") {
      return { x: RX + PW / 2, y: RY + (2 - platz) * PH + PH / 2 };
    }
    const sp = 1 + (platz % 5);
    const zeile = Math.floor(platz / 5);
    return { x: RX + sp * PW + PW / 2, y: RY + (2 - zeile) * PH + PH / 2 };
  }

  function zeichneKiste(x, y, k, alpha, gross) {
    const b = gross ? 46 : 40;
    const h = gross ? 36 : 30;
    const a = alpha === undefined ? 255 : alpha;
    stroke(29, 29, 28, a * 0.6);
    strokeWeight(1);
    fill(...KLASSE_FARBE[k], a);
    rect(x - b / 2, y - h / 2, b, h, 4);
    noStroke();
    fill(255, a);
    textFont(SCHRIFT);
    textStyle(BOLD);
    textSize(gross ? 16 : 14);
    textAlign(CENTER, CENTER);
    text(KLASSE[k], x, y + 1);
    textStyle(NORMAL);
  }

  function zeichneUmgebung(an) {
    const p = P_UMW;
    const z = an.z;
    const zl = an.zuletzt && an.zuletzt.info && an.zuletzt.info.zone ? an.zuletzt : null;
    const t = an.anim;
    const animiert = zl && t < 1;

    // --- Messwerte oben ---
    const n = zaehleNah(z.nah);
    noStroke();
    textFont(MONO);
    textSize(13);
    textAlign(LEFT, TOP);
    fill(...FARBE.text);
    text(`ankommend: ${KLASSE[z.ankunft]} (${KLASSE_TEXT[z.ankunft]})   nah belegt: ${belegName(n) || "–"} (${n[0] + n[1] + n[2]} von 3)`, p.x + 16, p.y + 46);
    textFont(SCHRIFT);
    textSize(12);
    fill(...FARBE.grau);
    text(`Agent sieht: Zustand s = ${einordnen(z).s} (Zelle der Q-Tabelle) – die fernen Plätze sieht er nicht`, p.x + 16, p.y + 68);
    textAlign(RIGHT, TOP);
    text(`Einlagerung ${Math.min(z.takt + 1, TAKTE)} von ${TAKTE}`, p.x + p.w - 16, p.y + 68);

    // --- Regal ---
    noStroke();
    fill(232, 241, 236);
    rect(RX - 4, RY - 4, PW + 8, 3 * PH + 8, 6);
    stroke(...FARBE.grau);
    strokeWeight(1.5);
    for (let sp = 0; sp <= SPALTEN; sp++) {
      line(RX + sp * PW, RY, RX + sp * PW, RY + 3 * PH);
    }
    for (let ze = 0; ze <= 3; ze++) {
      line(RX, RY + ze * PH, RX + SPALTEN * PW, RY + ze * PH);
    }
    noStroke();
    textFont(SCHRIFT);
    textSize(11);
    textAlign(CENTER, BOTTOM);
    fill(...FARBE.gruen);
    textStyle(BOLD);
    text("nah · 2 s", RX + PW / 2, RY - 8);
    fill(...FARBE.links);
    text("fern · 8 s", RX + PW + (5 * PW) / 2, RY - 8);
    textStyle(NORMAL);

    // Teile im Regal (das gerade eingelagerte erscheint erst, wenn das Gerät dort ist)
    const ankommt = (zone, i) => animiert && zl.info.zone === zone && zl.info.platz === i && t < 0.5;
    for (let i = 0; i < NAH; i++) {
      if (z.nah[i] !== null && !ankommt("nah", i)) {
        const m = platzMitte("nah", i);
        zeichneKiste(m.x, m.y, z.nah[i]);
      }
    }
    for (let i = 0; i < FERN; i++) {
      if (z.fern[i] !== null && !ankommt("fern", i)) {
        const m = platzMitte("fern", i);
        zeichneKiste(m.x, m.y, z.fern[i]);
      }
    }
    // gerade ausgelagerte Teile verblassen
    if (animiert) {
      for (const r of zl.info.raus) {
        const m = platzMitte(r.zone, r.platz);
        zeichneKiste(m.x, m.y, r.klasse, 200 * (1 - t));
      }
    }

    // --- Übergabeplatz ---
    noStroke();
    fill(...FARBE.flaeche2);
    rect(IO.x - 36, IO.y - 26, 72, 52, 6);
    fill(...FARBE.grau);
    textSize(11);
    textAlign(CENTER, TOP);
    text("Übergabe", IO.x, IO.y + 30);
    if (!animiert || t > 0.5) {
      zeichneKiste(IO.x, IO.y, z.ankunft, animiert ? 255 * ((t - 0.5) / 0.5) : 255, true);
    }

    // --- Regalbediengerät: fährt zum Platz und zurück ---
    let gx = IO.x + 46;
    let gy = IO.y;
    let ladung = null;
    if (animiert && zl.info.platz >= 0) {
      const ziel = platzMitte(zl.info.zone, zl.info.platz);
      const hin = t < 0.5;
      const u = weich(hin ? t / 0.5 : 1 - (t - 0.5) / 0.5);
      gx = lerp(IO.x + 46, ziel.x, u);
      gy = lerp(IO.y, ziel.y, u);
      if (hin) {
        ladung = zl.info.klasse;
      }
    }
    stroke(...FARBE.dunkel);
    strokeWeight(4);
    line(gx, RY - 20, gx, RY + 3 * PH + 14); // Mast
    strokeWeight(2);
    line(IO.x + 30, RY + 3 * PH + 16, RX + SPALTEN * PW, RY + 3 * PH + 16); // Fahrschiene
    noStroke();
    fill(...FARBE.dunkel);
    rect(gx - 14, RY + 3 * PH + 10, 28, 10, 3);
    fill(...FARBE.senf);
    rect(gx - 24, gy + 14, 48, 6, 2); // Hubwagen
    if (ladung !== null) {
      zeichneKiste(gx, gy - 2, ladung);
    }

    // Fahrzeit des letzten Schritts
    if (animiert) {
      textFont(SCHRIFT);
      textStyle(BOLD);
      textSize(13);
      textAlign(RIGHT, BOTTOM);
      fill(...(zl.info.zone === "nah" ? FARBE.gruen : FARBE.links));
      text(`${zl.info.zone === "nah" ? "nah" : "fern"}: −${-zl.r} s${zl.info.erzwungen ? " (nah war voll)" : ""}`, P_UMW.x + P_UMW.w - 16, RY - 8);
      textStyle(NORMAL);
    }

    // --- Legende und Summen ---
    const ly = p.y + p.h - 84;
    noStroke();
    textFont(SCHRIFT);
    textSize(11);
    textAlign(LEFT, CENTER);
    for (let k = 0; k < 3; k++) {
      const y = ly + k * 15;
      fill(...KLASSE_FARBE[k]);
      rect(p.x + 16, y - 6, 12, 12, 2);
      fill(...FARBE.grau);
      text(
        `${KLASSE[k]}: ${KLASSE_TEXT[k]} · kommt ${Math.round(P_ANKUNFT[k] * 100)} % · raus ${Math.round(P_RAUS[k] * 100)} % je Takt`,
        p.x + 32,
        y
      );
    }
    textAlign(RIGHT, CENTER);
    fill(...FARBE.text);
    textStyle(BOLD);
    textSize(12);
    text(`Fahrzeit bisher: ${z.fahrzeit} s`, p.x + p.w - 16, ly);
    textStyle(NORMAL);
    fill(...FARBE.grau);
    textSize(11);
    text(`nah eingelagert: A ${z.anzahlNah[0]} · B ${z.anzahlNah[1]} · C ${z.anzahlNah[2]}`, p.x + p.w - 16, ly + 15);
    text(`fern eingelagert: A ${z.anzahlFern[0]} · B ${z.anzahlFern[1]} · C ${z.anzahlFern[2]}`, p.x + p.w - 16, ly + 30);
  }

  // ---------------------------------------------------------------------------
  // Das Szenario
  // ---------------------------------------------------------------------------
  const SZ = {
    id: "lager",
    name: "Hochregallager",
    titel: "KI lagert ein",
    umgebungTitel: "Umgebung · Hochregallager",
    umgebungKurz: "Regal, Bediengerät, Aufträge",
    regelText: "Fahrzeit für Ein- und Auslagern: nah 2 s, fern 8 s · nur 3 nahe Plätze · Schicht = 50 Einlagerungen",
    optionen: [],
    einstellung: {},
    vorgaben: { alpha: 0.1, gamma: 0.95, episoden: 2000, epsFaktor: 0.995 },
    dt: 0.8,
    qStellen: 1,
    meldungY: 110,
    mensch: "diskret",

    aktionen() {
      return [
        { kurz: "nah", text: "nah einlagern", farbe: FARBE.gruen },
        { kurz: "fern", text: "fern einlagern", farbe: FARBE.links },
      ];
    },
    anzahl() {
      return 3 * NB;
    },
    zuruecksetzen() {
      env.zuruecksetzen();
    },
    zustand() {
      return env.zustand();
    },
    einordnen,
    schritt(a) {
      return env.schritt(a);
    },

    episodenWert() {
      return env.fahrzeit;
    },
    episodenErgebnis() {
      return { text: `Schicht vorbei · Fahrzeit ${env.fahrzeit} s`, gut: env.fahrzeit <= 255 };
    },
    kurve: {
      titel: "Lernkurve · Fahrzeit je Schicht (weniger ist besser)",
      min: 100,
      max: 400,
      ticks: [100, 200, 300, 400],
      leer: "Noch keine Schicht. Eine Episode ist eine Schicht mit 50 Einlagerungen.",
      besserHoch: false,
      format: (v) => `${v.toFixed(0)} s`,
    },

    zeichneUmgebung,
    qZelle,
    zeichneQAchsen,
    zustandsZeilen(s) {
      const k = Math.floor(s / NB);
      return [`ankommend: ${KLASSE[k]} (${KLASSE_TEXT[k]})`, belegText(s % NB)];
    },

    texte: {
      menschStatus: "Selbst einlagern · 1 = nah, 2 = fern · Wer schafft die kürzeste Fahrzeit in einer Schicht?",
      menschStart: "",
      menschLaeuft: "",
      menschIntro:
        "Du steuerst das Regalbediengerät: Jedes ankommende Teil kommt nah (2 s) oder fern (8 s). Es gibt aber nur 3 nahe Plätze! A-Teile werden schnell wieder gebraucht, C-Teile bleiben lange liegen. Taste 1 oder 2 bzw. die Knöpfe unten.",
      menschKreislauf: "siehst das Teil, wählst den Platz",
      menschTipp: "Tipp: Was passiert, wenn ein C-Teil\neinen nahen Platz belegt?",
      trainingTipp: "γ: Wie weit schaut der Agent voraus?\nMit γ = 0,5 legt er alles nah – mit γ = 0,95\nlernt er die ABC-Strategie.",
      zufall: "Ein Agent ohne Wissen lagert zufällig nah oder fern ein. Wie lang ist die Fahrzeit je Schicht im Mittel?",
      start:
        "Der Agent kennt weder die Klassen noch wie lange ein Teil liegen bleibt. Er sieht nur das ankommende Teil und die Belegung der nahen Plätze. Kurzfristig ist „nah“ immer besser – ob ein C-Teil dort einen Platz blockiert, merkt er nur, wenn er weit genug vorausschaut (γ).",
      lernenTerminal: "",

      beobachten(s) {
        const n = zaehleNah(s.z.nah);
        return {
          text: "Der Agent sieht die Klasse des ankommenden Teils und, wie viele A-, B- und C-Teile auf den nahen Plätzen liegen. Das ist der Zustand s – eine Zelle der Q-Tabelle (rot umrandet).",
          formeln: [
            `ankommend: ${KLASSE[s.z.ankunft]}   nah: ${n[0]}× A, ${n[1]}× B, ${n[2]}× C   (${NAH - n[0] - n[1] - n[2]} frei)`,
            `s = 20 · ${s.z.ankunft} + Belegung ${s.f.belegung} = ${s.s}`,
          ],
        };
      },
      ausfuehren(s) {
        const i = s.info;
        let text;
        if (i.zone === "nah") {
          text = `Das ${KLASSE[i.klasse]}-Teil kommt auf einen nahen Platz: kurze Fahrt, aber der Platz ist jetzt belegt, bis das Teil gebraucht wird.`;
        } else if (i.erzwungen) {
          text = `Nah ist voll – das ${KLASSE[i.klasse]}-Teil muss fern eingelagert werden. Lange Fahrt.`;
        } else {
          text = `Das ${KLASSE[i.klasse]}-Teil kommt fern ins Regal: lange Fahrt, aber die nahen Plätze bleiben frei.`;
        }
        const raus = i.raus.length ? i.raus.map((r) => `${KLASSE[r.klasse]} (${r.zone})`).join(", ") : "keins";
        return {
          text,
          formeln: [`Belohnung r = −${-s.r} s Fahrzeit   ausgelagert in diesem Takt: ${raus}`, `neuer Zustand s' = ${s.s2} (ankommend: ${KLASSE[s.z2.ankunft]})`],
        };
      },
      kurz(s) {
        return `${KLASSE[s.info.klasse]}-Teil → ${s.info.zone}${s.info.erzwungen ? " (nah voll)" : ""}`;
      },
      ende(k) {
        return `Schicht vorbei: ${k.wert} s Fahrzeit.`;
      },
      fazit(letzte) {
        const m = letzte.reduce((a, k) => a + k.wert, 0) / letzte.length;
        let text = `Nach ${agent.episoden} Schichten braucht das Lager im Mittel ${m.toFixed(0)} s Fahrzeit je Schicht (letzte 20). `;
        if (agent.epsilon > 0.2) {
          text += "ε ist noch groß – der Agent probiert noch viel aus.";
        } else if (agent.gamma < 0.8) {
          text += `Mit γ = ${f2(agent.gamma)} schaut der Agent kaum voraus und legt fast alles nah. Probiere γ = 0,95!`;
        } else {
          text += "Lies ab: Wohin kommen A-, B- und C-Teile? Das ist die ABC-Strategie aus der Lagerlogistik – der Agent hat sie selbst gefunden.";
        }
        return text;
      },
    },

    export: {
      titel: "Hochregallager · Einlagerstrategie",
      erklaerung:
        "Die gelernte Einlagerstrategie ist eine Tabelle: Für jede ankommende Klasse und jede Belegung der nahen Plätze steht fest, ob nah oder fern eingelagert wird. Die SPS des Regalbediengeräts zählt dazu die Teile je Klasse auf den nahen Plätzen.",
      eingaenge: [
        "#Klasse : INT   // 0 = A, 1 = B, 2 = C (z. B. aus dem RFID-Tag)",
        "#NahA, #NahB, #NahC : INT   // Anzahl der Teile je Klasse auf den nahen Plätzen",
      ],
      ausgang: "#Aktion : INT",
      vorgabe: 1,
      zustandsNummer() {
        const z = ["// Belegung der nahen Plätze → Nummer 0 … 19", "CASE #NahA * 16 + #NahB * 4 + #NahC OF"];
        for (let b = 0; b < NB; b++) {
          const n = BELEGUNGEN[b];
          z.push(`    ${String(n[0] * 16 + n[1] * 4 + n[2]).padStart(2)}: #Belegung := ${String(b).padStart(2)};   // ${belegName(n) || "leer"}`);
        }
        z.push("END_CASE;");
        z.push("#Zustand := #Klasse * 20 + #Belegung;");
        return z;
      },
      zustandsKommentar(s) {
        return `ankommend ${KLASSE[Math.floor(s / NB)]}, ${belegText(s % NB)}`;
      },
    },
  };

  szenarioRegistrieren(SZ);
})();
