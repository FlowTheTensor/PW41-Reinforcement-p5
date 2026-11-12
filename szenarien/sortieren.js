// =============================================================================
//  szenarien/sortieren.js – Sortierstation
// =============================================================================
//  Werkstücke kommen auf einem Förderband an: rot oder schwarz (Kunststoff)
//  oder silber (Metall). Manche sind fehlerhaft (zu niedrig).
//
//  Der Agent sieht NICHT das Werkstück, sondern nur drei Sensorsignale:
//    induktiv   1 = Metall erkannt
//    optisch    1 = hell (rot oder silber), 0 = dunkel (schwarz)
//    Höhe       1 = Höhe in Ordnung, 0 = zu niedrig
//
//  Variante "nur Sensoren" (8 Zustände × 4 Aktionen)
//    Aktionen  Rutsche 1 (Metall), Rutsche 2 (rot), Rutsche 3 (schwarz), Ausschuss
//    Jedes Werkstück ist ein abgeschlossener Fall: Ziel = r (γ spielt keine Rolle).
//
//  Variante "mit Bandposition" (8 × 4 = 32 Zustände × 4 Aktionen)
//    Das Band läuft, der Agent muss den richtigen Zylinder im richtigen
//    Moment auslösen. Aktionen: warten, Zylinder 1, 2, 3.
//    Fährt ein Zylinder ins Leere, kostet das Druckluft (−0,2).
//    Am Bandende fällt das Werkstück in den Ausschuss.
//
//  Belohnung   richtig einsortiert                 +1
//              Gutteil in falscher Rutsche         −1
//              Gutteil im Ausschuss (verschrottet) −2
//              Fehlteil in einer Gut-Rutsche       −5  (Reklamation beim Kunden)
//  Episode     eine Charge mit 20 Werkstücken
// =============================================================================

(() => {
  const CHARGE = 20;
  const P_FEHLER = 0.15; // Anteil fehlerhafter Werkstücke
  const P_STOERUNG = 0.1; // optischer Sensor irrt sich (Option)
  const LEERHUB = -0.2; // Zylinder fährt ins Leere

  const FARB_NAME = { rot: "rot", schwarz: "schwarz", silber: "silber" };
  const RUTSCHE_FUER = { silber: 1, rot: 2, schwarz: 3 };
  const RUTSCHE_NAME = ["", "Metall", "rot", "schwarz"];

  // Zeichnung (Draufsicht)
  const BX0 = 64; // Band von …
  const BX1 = 582; // … bis
  const BY = 266; // Oberkante Band
  const BH = 48; // Bandbreite
  const BM = BY + BH / 2; // Bandmitte
  const SENSOR_X = [98, 146, 194]; // induktiv, optisch, Höhe
  const WARTE_X = 146; // dort wartet das Teil unter den Sensoren
  const POS_X = [222, 312, 412, 512]; // Bandpositionen 0 … 3
  const ZYL_X = [0, 312, 412, 512]; // Zylinder 1 … 3
  const ENDE_X = 612; // Ausschussbehälter
  const R_TEIL = 16;

  // ---------------------------------------------------------------------------
  // Umgebung
  // ---------------------------------------------------------------------------
  function neuesTeil() {
    const r = Math.random();
    const farbe = r < 0.35 ? "rot" : r < 0.7 ? "schwarz" : "silber";
    return { farbe, fehler: Math.random() < P_FEHLER };
  }

  function messen(teil) {
    const s = {
      ind: teil.farbe === "silber" ? 1 : 0,
      opt: teil.farbe === "schwarz" ? 0 : 1,
      hoehe: teil.fehler ? 0 : 1,
      gestoert: false,
    };
    if (SZ.einstellung.stoerung === "an" && Math.random() < P_STOERUNG) {
      s.opt = 1 - s.opt;
      s.gestoert = true;
    }
    return s;
  }

  function bandVariante() {
    return SZ.einstellung.zustand === "band";
  }

  // Bewertung: Wohin ist das Werkstück gekommen?  ziel = 1, 2, 3 oder "aus"
  function bewerten(teil, ziel) {
    if (teil.fehler) {
      return ziel === "aus"
        ? { r: 1, richtig: true, text: "Fehlteil aussortiert – richtig" }
        : { r: -5, richtig: false, text: "Fehlteil in Gut-Rutsche – Reklamation!" };
    }
    const soll = RUTSCHE_FUER[teil.farbe];
    if (ziel === soll) {
      return { r: 1, richtig: true, text: "richtige Rutsche" };
    }
    if (ziel === "aus") {
      return { r: -2, richtig: false, text: "Gutteil verschrottet" };
    }
    return { r: -1, richtig: false, text: `falsche Rutsche (richtig: ${soll})` };
  }

  const env = {
    zuruecksetzen() {
      this.rutschen = [[], [], [], []]; // Index 1 … 3
      this.ausschuss = [];
      this.ergebnisse = [];
      this.punkte = 0;
      this.richtig = 0;
      this.vorbei = false;
      this.naechstesTeil();
    },

    naechstesTeil() {
      this.teil = neuesTeil();
      this.sensor = messen(this.teil);
      this.pos = 0;
    },

    zustand() {
      return {
        teil: Object.assign({}, this.teil),
        sensor: Object.assign({}, this.sensor),
        pos: this.pos,
        rutschen: this.rutschen.map((r) => r.slice(-6)),
        anzahl: this.rutschen.map((r) => r.length),
        ausschuss: this.ausschuss.slice(-6),
        nAusschuss: this.ausschuss.length,
        ergebnisse: this.ergebnisse.slice(),
        punkte: this.punkte,
        richtig: this.richtig,
      };
    },

    // Werkstück ist angekommen (Rutsche oder Ausschuss)
    abschliessen(ziel, info) {
      const b = bewerten(this.teil, ziel);
      if (ziel === "aus") {
        this.ausschuss.push(this.teil);
      } else {
        this.rutschen[ziel].push(this.teil);
      }
      this.ergebnisse.push({ r: b.r, richtig: b.richtig });
      if (b.richtig) {
        this.richtig++;
      }
      info.ziel = ziel;
      info.bewertung = b;
      if (this.ergebnisse.length >= CHARGE) {
        this.vorbei = true;
      }
      this.naechstesTeil();
      return b.r;
    },

    schritt(a) {
      const info = { teil: Object.assign({}, this.teil), sensor: Object.assign({}, this.sensor), von: this.pos };
      let r = 0;
      let terminal = false;
      if (!bandVariante()) {
        r = this.abschliessen(a < 3 ? a + 1 : "aus", info);
        terminal = true;
      } else {
        if (a > 0) {
          info.zylinder = a;
          if (this.pos === a) {
            r = this.abschliessen(a, info);
            terminal = true;
          } else {
            r = LEERHUB;
            info.leerhub = true;
          }
        }
        if (!terminal) {
          this.pos++;
          info.nach = this.pos;
          if (this.pos >= 4) {
            r += this.abschliessen("aus", info);
            terminal = true;
          }
        }
      }
      this.punkte += r;
      return { z2: this.zustand(), r, terminal, vorbei: this.vorbei, info };
    },
  };

  // ---------------------------------------------------------------------------
  // Einordnen: drei Sensorsignale (und ggf. Bandposition) → Zeile s
  // ---------------------------------------------------------------------------
  function code(sensor) {
    return sensor.ind * 4 + sensor.opt * 2 + sensor.hoehe;
  }

  function einordnen(z) {
    const c = code(z.sensor);
    const f = { ind: z.sensor.ind, opt: z.sensor.opt, hoehe: z.sensor.hoehe, pos: z.pos };
    return { f, s: bandVariante() ? c * 4 + Math.min(z.pos, 3) : c };
  }

  function sensorText(c) {
    const ind = c >> 2;
    const opt = (c >> 1) & 1;
    const hoehe = c & 1;
    return `${ind ? "Metall" : "kein Metall"} · ${opt ? "hell" : "dunkel"} · ${hoehe ? "Höhe ok" : "zu niedrig"}`;
  }

  // Was steckt typischerweise hinter einer Sensorkombination?
  function typischText(c) {
    const ind = c >> 2;
    const opt = (c >> 1) & 1;
    const hoehe = c & 1;
    let t;
    if (ind && opt) {
      t = "silber";
    } else if (ind && !opt) {
      return "kommt ohne Sensorstörung nicht vor";
    } else if (opt) {
      t = "rot";
    } else {
      t = "schwarz";
    }
    return `typisch: ${t}, ${hoehe ? "in Ordnung" : "fehlerhaft"}`;
  }

  function posText(p) {
    return p === 0 ? "nach den Sensoren" : `vor Zylinder ${p}`;
  }

  function teilText(t) {
    return `${FARB_NAME[t.farbe]}${t.fehler ? ", zu niedrig" : ", i. O."}`;
  }

  function zielText(ziel) {
    return ziel === "aus" ? "Ausschuss" : `Rutsche ${ziel} (${RUTSCHE_NAME[ziel]})`;
  }

  // ---------------------------------------------------------------------------
  // Q-Tabelle
  // ---------------------------------------------------------------------------
  const QX = 900; // links davon: Zeilenbeschriftung
  const QW = 664;
  const QY = 168;
  const ZH = 50; // Zeilenhöhe

  function qZelle(s) {
    if (!bandVariante()) {
      return { x: QX, y: QY + s * ZH, w: QW, h: ZH - 6 };
    }
    const c = Math.floor(s / 4);
    const p = s % 4;
    const w = QW / 4;
    return { x: QX + p * w + 2, y: QY + c * ZH, w: w - 4, h: ZH - 6 };
  }

  function zeichneQAchsen() {
    const akt = SZ.aktionen();
    noStroke();
    textFont(SCHRIFT);
    // Zeilen: Sensorkombinationen
    for (let c = 0; c < 8; c++) {
      const y = QY + c * ZH + (ZH - 6) / 2;
      fill(...FARBE.text);
      textSize(12);
      textAlign(LEFT, BOTTOM);
      text(`${c}: ${sensorText(c)}`, 696, y + 1);
      fill(...FARBE.blass);
      textSize(11);
      textAlign(LEFT, TOP);
      text(typischText(c), 696, y + 3);
    }
    // Spalten
    fill(...FARBE.grau);
    textSize(12);
    textAlign(CENTER, BOTTOM);
    if (!bandVariante()) {
      for (let a = 0; a < 4; a++) {
        fill(...akt[a].farbe);
        textStyle(BOLD);
        text(akt[a].kurz, QX + (a + 0.5) * (QW / 4), QY - 18);
        textStyle(NORMAL);
        fill(...FARBE.grau);
        textSize(11);
        text(akt[a].text, QX + (a + 0.5) * (QW / 4), QY - 4);
        textSize(12);
      }
      fill(...FARBE.text);
      textAlign(LEFT, BOTTOM);
      text("Sensoren (Zustand s)", 696, QY - 4);
    } else {
      const w = QW / 4;
      for (let p = 0; p < 4; p++) {
        fill(...FARBE.text);
        textSize(12);
        text(p === 0 ? "nach den Sensoren" : `vor Zylinder ${p}`, QX + (p + 0.5) * w, QY - 20);
        textSize(10);
        for (let a = 0; a < 4; a++) {
          fill(...akt[a].farbe);
          text(akt[a].kurz, QX + p * w + 2 + (a + 0.5) * ((w - 4) / 4), QY - 5);
        }
      }
      fill(...FARBE.text);
      textSize(12);
      textAlign(LEFT, BOTTOM);
      text("Sensoren  ·  Bandposition →", 696, QY - 20);
    }
    fill(...FARBE.blass);
    textSize(12);
    textAlign(CENTER, TOP);
    text(
      bandVariante()
        ? "Die Werte wandern beim Lernen von rechts nach links: „warten“ lohnt sich, wenn später etwas Gutes kommt."
        : "Ein Werkstück, eine Entscheidung: Jeder Q-Wert ist die mittlere Belohnung dieser Rutsche.",
      QT.x + QT.w / 2 - 50,
      QY + 8 * ZH + 4
    );
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  function teilFarbe(t) {
    if (t.farbe === "rot") {
      return [200, 30, 58];
    }
    if (t.farbe === "schwarz") {
      return [38, 38, 36];
    }
    return [196, 198, 202];
  }

  function zeichneTeil(x, y, t, alpha, r) {
    const rr = r || R_TEIL;
    const a = alpha === undefined ? 255 : alpha;
    stroke(29, 29, 28, a);
    strokeWeight(1.5);
    fill(...teilFarbe(t), a);
    circle(x, y, 2 * rr);
    // Bohrung in der Mitte (Draufsicht)
    noStroke();
    fill(t.farbe === "schwarz" ? 90 : 255, a * 0.55);
    circle(x, y, rr * 0.75);
    if (t.farbe === "silber") {
      fill(255, a * 0.7);
      arc(x, y, 2 * rr - 5, 2 * rr - 5, PI + 0.4, PI + 1.4);
    }
    if (t.fehler) {
      // zu niedrig: gestrichelter Warnring
      noFill();
      stroke(...FARBE.senf, a);
      strokeWeight(2);
      gestrichelt(true);
      circle(x, y, 2 * rr + 7);
      gestrichelt(false);
    }
  }

  function zeichneBand(laeuft) {
    // Rahmen
    noStroke();
    fill(...FARBE.flaeche2);
    rect(BX0 - 8, BY - 8, BX1 - BX0 + 16, BH + 16, 6);
    fill(92, 90, 86);
    rect(BX0, BY, BX1 - BX0, BH, 3);
    // Querrillen (laufen mit, wenn das Band fährt)
    const versatz = laeuft ? (millis() * 0.06) % 18 : 0;
    stroke(118, 115, 110);
    strokeWeight(2);
    for (let x = BX0 + versatz; x < BX1; x += 18) {
      line(x, BY + 4, x, BY + BH - 4);
    }
    // Umlenkrollen
    noStroke();
    fill(...FARBE.grau);
    rect(BX0 - 10, BY - 2, 10, BH + 4, 4);
    rect(BX1, BY - 2, 10, BH + 4, 4);
  }

  function zeichneSensoren(sensor, aktivTeil) {
    const namen = ["induktiv", "optisch", "Höhe"];
    const werte = [sensor.ind, sensor.opt, sensor.hoehe];
    const anzeigen = [sensor.ind ? "Metall" : "–", sensor.opt ? "hell" : "dunkel", sensor.hoehe ? "ok" : "niedrig"];
    for (let i = 0; i < 3; i++) {
      const x = SENSOR_X[i];
      // Halter
      stroke(...FARBE.blass);
      strokeWeight(2);
      line(x, BY - 12, x, BY - 30);
      noStroke();
      fill(...FARBE.dunkel);
      rect(x - 11, BY - 50, 22, 22, 4);
      // LED
      const an = aktivTeil && werte[i] === 1;
      fill(...(an ? [255, 196, 0] : [120, 118, 112]));
      circle(x, BY - 39, 9);
      textFont(SCHRIFT);
      textSize(10);
      textAlign(CENTER, BOTTOM);
      fill(...FARBE.grau);
      text(namen[i], x, BY - 54);
      if (aktivTeil) {
        fill(...(an ? FARBE.text : FARBE.blass));
        textStyle(an ? BOLD : NORMAL);
        text(anzeigen[i], x, BY - 66);
        textStyle(NORMAL);
      }
    }
    if (aktivTeil && sensor.gestoert) {
      fill(...FARBE.akzent);
      textSize(10);
      textStyle(BOLD);
      textAlign(CENTER, BOTTOM);
      text("Störung!", SENSOR_X[1], BY - 78);
      textStyle(NORMAL);
    }
  }

  // Zylinder k mit Kolbenstange; aus = 0 … 1 (wie weit ausgefahren)
  function zeichneZylinder(k, aus, markiert, farbe) {
    const x = ZYL_X[k];
    const stange = 10 + aus * (BH + 6);
    noStroke();
    fill(...(markiert ? farbe : FARBE.dunkel));
    rect(x - 13, BY - 58, 26, 40, 4);
    fill(...FARBE.blass);
    rect(x - 3, BY - 18, 6, stange - 8);
    fill(...(markiert ? farbe : FARBE.grau));
    rect(x - 20, BY - 18 + stange - 8, 40, 7, 2);
    textFont(SCHRIFT);
    textSize(11);
    textAlign(CENTER, BOTTOM);
    fill(...(markiert ? farbe : FARBE.grau));
    textStyle(markiert ? BOLD : NORMAL);
    text(`Zylinder ${k}`, x, BY - 62);
    textStyle(NORMAL);
  }

  function zeichneRutsche(k, teile, anzahl) {
    const x = ZYL_X[k];
    noStroke();
    fill(...FARBE.flaeche2);
    stroke(...FARBE.linie);
    strokeWeight(1);
    quad(x - 30, BY + BH + 8, x + 30, BY + BH + 8, x + 24, BY + BH + 62, x - 24, BY + BH + 62);
    noStroke();
    for (let i = 0; i < teile.length; i++) {
      zeichneTeil(x, BY + BH + 50 - i * 8, teile[i], 255, 10);
    }
    textFont(SCHRIFT);
    textSize(11);
    textAlign(CENTER, TOP);
    fill(...FARBE.text);
    textStyle(BOLD);
    text(`Rutsche ${k}`, x, BY + BH + 66);
    textStyle(NORMAL);
    fill(...FARBE.grau);
    text(`${RUTSCHE_NAME[k]} · ${anzahl}`, x, BY + BH + 80);
  }

  function zeichneAusschuss(teile, anzahl) {
    noStroke();
    fill(...FARBE.flaeche2);
    stroke(...FARBE.linie);
    rect(ENDE_X - 26, BY - 4, 52, 98, 6);
    noStroke();
    for (let i = 0; i < teile.length; i++) {
      zeichneTeil(ENDE_X, BY + 80 - i * 9, teile[i], 255, 10);
    }
    textFont(SCHRIFT);
    textSize(11);
    textAlign(CENTER, TOP);
    fill(...FARBE.text);
    textStyle(BOLD);
    text("Ausschuss", ENDE_X, BY + 98);
    textStyle(NORMAL);
    fill(...FARBE.grau);
    text(String(anzahl), ENDE_X, BY + 112);
  }

  // Ziel eines Teils als Punkt im Bild
  function zielPunkt(ziel) {
    if (ziel === "aus") {
      return { x: ENDE_X, y: BY + 40 };
    }
    return { x: ZYL_X[ziel], y: BY + BH + 40 };
  }

  function zeichneUmgebung(an) {
    const p = P_UMW;
    const z = an.z;
    const band = bandVariante();
    const zl = an.zuletzt && an.zuletzt.info && an.zuletzt.info.teil ? an.zuletzt : null;
    const t = an.anim;
    const animiert = zl && t < 1;

    // --- Messwerte oben ---
    noStroke();
    textFont(MONO);
    textSize(13);
    textAlign(LEFT, TOP);
    fill(...FARBE.text);
    const sen = z.sensor;
    text(
      `induktiv = ${sen.ind}   optisch = ${sen.opt} (${sen.opt ? "hell" : "dunkel"})   Höhe = ${sen.hoehe} (${sen.hoehe ? "ok" : "niedrig"})${band ? `   Position = ${z.pos}` : ""}`,
      p.x + 16,
      p.y + 46
    );
    textFont(SCHRIFT);
    textSize(12);
    fill(...FARBE.grau);
    text(`Agent sieht: Zustand s = ${einordnen(z).s} (Zeile der Q-Tabelle) – das Werkstück selbst sieht er nicht`, p.x + 16, p.y + 68);
    textAlign(RIGHT, TOP);
    text(`Teil ${Math.min(z.ergebnisse.length + 1, CHARGE)} von ${CHARGE}`, p.x + p.w - 16, p.y + 68);

    // --- Anlage ---
    const bandLaeuft = (laeuft && (band || animiert)) || (animiert && band);
    zeichneBand(bandLaeuft);

    // Zylinder: ausfahren, wenn gerade ausgelöst
    for (let k = 1; k <= 3; k++) {
      let aus = 0;
      let markiert = false;
      const akt = SZ.aktionen();
      if (zl && animiert) {
        const zk = band ? zl.info.zylinder : zl.info.ziel;
        if (zk === k) {
          aus = Math.sin(constrain((t - (band ? 0 : 0.45)) / (band ? 1 : 0.55), 0, 1) * PI);
          markiert = true;
        }
      }
      if (an.wahl !== null && an.wahl !== undefined) {
        const gew = band ? an.wahl : an.wahl + 1;
        if (gew === k) {
          markiert = true;
        }
      }
      zeichneZylinder(k, aus, markiert, band ? akt[k].farbe : akt[k - 1].farbe);
      zeichneRutsche(k, z.rutschen[k], z.anzahl[k]);
    }
    zeichneAusschuss(z.ausschuss, z.nAusschuss);
    const neuesTeilSichtbar = !animiert || t > 0.75;
    zeichneSensoren(sen, neuesTeilSichtbar && (!band || z.pos === 0));

    // Positionsmarken (Variante mit Bandposition)
    if (band) {
      noStroke();
      textFont(SCHRIFT);
      textSize(10);
      textAlign(CENTER, TOP);
      for (let i = 0; i < 4; i++) {
        fill(...(i === z.pos ? FARBE.akzent : FARBE.blass));
        textStyle(i === z.pos ? BOLD : NORMAL);
        text(`Pos ${i}`, POS_X[i] + (i === 0 ? 0 : -42), BY + BH + 4);
      }
      textStyle(NORMAL);
    }

    // --- Werkstücke ---
    if (animiert) {
      const info = zl.info;
      const vonX = band ? POS_X[info.von] : WARTE_X;
      if (info.ziel !== undefined) {
        // Teil wurde einsortiert: über das Band fahren, dann in die Rutsche
        const ziel = zielPunkt(info.ziel);
        const fahrX = info.ziel === "aus" ? BX1 + 8 : ziel.x;
        let x;
        let y;
        const anteilFahrt = band ? (info.ziel === "aus" ? 0.6 : 0.25) : 0.5;
        if (t < anteilFahrt) {
          x = lerp(vonX, fahrX, weich(t / anteilFahrt));
          y = BM;
        } else {
          const u = weich((t - anteilFahrt) / (1 - anteilFahrt));
          x = lerp(fahrX, ziel.x, u);
          y = lerp(BM, ziel.y, u);
        }
        zeichneTeil(x, y, info.teil, 255 * (1 - 0.5 * Math.max(0, t - 0.85) / 0.15));
      } else if (band && info.nach !== undefined) {
        // Teil rückt auf dem Band eine Position weiter
        zeichneTeil(lerp(vonX, POS_X[Math.min(info.nach, 3)], weich(t)), BM, info.teil);
      }
    }
    if (!animiert || zl.info.ziel !== undefined) {
      // aktuelles Teil an seiner Position (nach dem Einsortieren erscheint das nächste)
      const x = band ? POS_X[z.pos] : WARTE_X;
      if (neuesTeilSichtbar) {
        const einblenden = animiert ? constrain((t - 0.75) / 0.25, 0, 1) : 1;
        zeichneTeil(x, BM, z.teil, 255 * einblenden);
      }
    }

    // Bewertung des letzten Teils
    if (zl && zl.info.bewertung && t < 1.0 + 0.0001 && (laeuft || an.phase !== "bereit")) {
      const b = zl.info.bewertung;
      const ziel = zielPunkt(zl.info.ziel);
      noStroke();
      textFont(SCHRIFT);
      textStyle(BOLD);
      textSize(13);
      textAlign(CENTER, BOTTOM);
      fill(...(b.richtig ? FARBE.gruen : FARBE.akzent));
      if (t > 0.6) {
        textAlign(LEFT, CENTER);
        text(belohnungText(b.r), ziel.x + (zl.info.ziel === "aus" ? -12 : 34), zl.info.ziel === "aus" ? BY - 16 : BY + BH + 30);
      }
      textStyle(NORMAL);
    }
    if (zl && zl.info.leerhub && animiert) {
      noStroke();
      textFont(SCHRIFT);
      textSize(11);
      fill(...FARBE.akzent);
      textAlign(CENTER, BOTTOM);
      text("ins Leere: −0,2", ZYL_X[zl.info.zylinder], BY - 76);
    }

    // --- Charge: Ergebnis je Werkstück ---
    const cy = p.y + p.h - 52;
    const bx = p.x + 16;
    noStroke();
    textFont(SCHRIFT);
    textSize(11);
    fill(...FARBE.grau);
    textAlign(LEFT, CENTER);
    text("Charge", bx, cy);
    for (let i = 0; i < CHARGE; i++) {
      const x = bx + 52 + i * 17;
      const e = z.ergebnisse[i];
      if (e) {
        fill(...(e.richtig ? FARBE.gruen : FARBE.akzent));
      } else {
        fill(...FARBE.flaeche2);
      }
      rect(x, cy - 6, 13, 12, 3);
    }
    textAlign(RIGHT, CENTER);
    fill(...FARBE.text);
    text(`${z.richtig} richtig · Punkte ${belohnungText(Number(z.punkte.toFixed(2)))}`, p.x + p.w - 16, cy);
  }

  // ---------------------------------------------------------------------------
  // Das Szenario
  // ---------------------------------------------------------------------------
  const SZ = {
    id: "sortieren",
    name: "Sortierstation",
    titel: "KI sortiert",
    umgebungTitel: "Umgebung · Sortierstation",
    umgebungKurz: "Band, Sensoren, Zylinder",
    regelText: "Rutsche 1: Metall · 2: rot · 3: schwarz · Fehlteile (zu niedrig) in den Ausschuss · Charge = 20 Teile",
    optionen: [
      {
        key: "zustand",
        name: "Zustand",
        neuAufbau: true,
        werte: [
          ["sensoren", "nur Sensoren (8)"],
          ["band", "mit Bandposition (32)"],
        ],
      },
      {
        key: "stoerung",
        name: "Sensoren",
        neuAufbau: false,
        werte: [
          ["aus", "fehlerfrei"],
          ["an", "optischer Sensor irrt 10 %"],
        ],
      },
    ],
    einstellung: { zustand: "sensoren", stoerung: "aus" },
    vorgaben: { alpha: 0.2, gamma: 0.9, episoden: 100 },
    qStellen: 2,
    meldungY: 110,
    get dt() {
      return bandVariante() ? 0.45 : 1.0;
    },
    get mensch() {
      return bandVariante() ? "echtzeit" : "diskret";
    },

    aktionen() {
      if (bandVariante()) {
        return [
          { kurz: "W", text: "warten", farbe: FARBE.gruen },
          { kurz: "Z1", text: "Zylinder 1", farbe: FARBE.links },
          { kurz: "Z2", text: "Zylinder 2", farbe: FARBE.akzent },
          { kurz: "Z3", text: "Zylinder 3", farbe: FARBE.dunkel },
        ];
      }
      return [
        { kurz: "R1", text: "Rutsche 1", farbe: FARBE.links },
        { kurz: "R2", text: "Rutsche 2", farbe: FARBE.akzent },
        { kurz: "R3", text: "Rutsche 3", farbe: FARBE.dunkel },
        { kurz: "AS", text: "Ausschuss", farbe: FARBE.senf },
      ];
    },
    anzahl() {
      return bandVariante() ? 32 : 8;
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
    // Band läuft von selbst; Ziffer 1–3 löst den Zylinder aus
    menschAktion(taste) {
      return taste !== null && taste >= 0 && taste <= 2 ? taste + 1 : 0;
    },

    episodenWert() {
      return Math.round((env.richtig / CHARGE) * 100);
    },
    episodenErgebnis() {
      return {
        text: `Charge fertig · ${env.richtig} von ${CHARGE} richtig · Punkte ${belohnungText(Number(env.punkte.toFixed(2)))}`,
        gut: env.richtig >= CHARGE - 1,
      };
    },
    kurve: {
      titel: "Lernkurve · richtig sortiert je Charge",
      min: 0,
      max: 100,
      ticks: [0, 50, 100],
      leer: "Noch keine Charge. Eine Episode ist eine Charge mit 20 Werkstücken.",
      besserHoch: true,
      format: (v) => `${v.toFixed(0)} %`,
    },

    zeichneUmgebung,
    qZelle,
    zeichneQAchsen,
    zustandsZeilen(s) {
      if (!bandVariante()) {
        return [sensorText(s), typischText(s)];
      }
      const c = Math.floor(s / 4);
      return [sensorText(c), typischText(c), `Werkstück ${posText(s % 4)}`];
    },

    texte: {
      get menschStatus() {
        return bandVariante()
          ? "Selbst steuern · Das Band läuft · 1, 2 oder 3 drücken, wenn das Werkstück vor dem richtigen Zylinder ist"
          : "Selbst sortieren · Taste 1–4 oder Knöpfe unten · Du siehst das Werkstück, der Agent nur die Sensoren";
      },
      menschStart: "Leertaste oder 1–3 drücken, um das Band zu starten",
      menschLaeuft:
        "Das Band läuft. Drücke 1, 2 oder 3, wenn das Werkstück vor dem richtigen Zylinder steht. Fehlteile (zu niedrig, gestrichelter Ring) lässt du in den Ausschuss durchlaufen.",
      menschFormeln: () => [`Teil ${Math.min(env.ergebnisse.length + 1, CHARGE)} von ${CHARGE}   richtig: ${env.richtig}   Punkte: ${env.punkte.toFixed(1)}`],
      get menschIntro() {
        return bandVariante()
          ? "Jetzt mit Timing: Das Band läuft von selbst. Drücke 1, 2 oder 3 genau dann, wenn das Werkstück vor dem passenden Zylinder steht. Fährt ein Zylinder ins Leere, kostet das Druckluft. Fehlteile (zu niedrig) lässt du durchlaufen."
          : "Sortiere selbst: Rutsche 1 für Metall, 2 für rot, 3 für schwarz, Fehlteile (gestrichelter Ring = zu niedrig) in den Ausschuss. Du siehst das Werkstück – der Agent sieht nur die drei Sensorsignale und muss die Zuordnung erst lernen.";
      },
      get menschKreislauf() {
        return bandVariante() ? "siehst das Teil, löst Zylinder aus" : "siehst das Teil, wählst die Rutsche";
      },
      get menschTipp() {
        return bandVariante()
          ? "Tipp: In der Zeitlupe ist das Timing leichter.\nDer Agent muss dasselbe Timing lernen."
          : "Der Agent kennt die Regeln nicht – er\nlernt sie nur aus den Belohnungen.";
      },
      get trainingTipp() {
        return bandVariante()
          ? "γ: Wie viel ist eine spätere Belohnung wert?\nMit γ = 0 lernt „warten“ nichts dazu.\nε: Wie oft wird zufällig ausprobiert?"
          : "α: Wie stark zählt neue Erfahrung?\nγ spielt hier keine Rolle: Jedes Teil ist\nein abgeschlossener Fall (Ziel = r).";
      },
      zufall: "Ein Agent ohne Wissen sortiert jedes Werkstück zufällig. Wie viele landen im Mittel richtig? Das ist der Vergleichswert.",
      start:
        "Der Agent weiß nicht, welche Rutsche wofür ist. Er probiert aus und lernt nur aus den Belohnungen: richtig +1, falsche Rutsche −1, Gutteil verschrottet −2, Fehlteil in Gut-Rutsche −5. An der echten Anlage wäre dieses Ausprobieren teurer Ausschuss – deshalb trainiert man in der Simulation.",
      terminalText: "das Werkstück ist einsortiert",
      get lernenTerminal() {
        return bandVariante()
          ? "Das Werkstück ist angekommen – danach kommt für diese Entscheidung nichts mehr. Das Ziel ist deshalb nur die Belohnung r. Der Q-Wert rückt um den Anteil α an r heran."
          : "Das Werkstück ist einsortiert – das nächste Teil hängt nicht von dieser Entscheidung ab. Das Ziel ist deshalb nur die Belohnung r, γ spielt keine Rolle. Der Q-Wert rückt um den Anteil α an r heran.";
      },

      beobachten(s) {
        const sen = s.z.sensor;
        const formeln = [
          `induktiv = ${sen.ind} (${sen.ind ? "Metall" : "kein Metall"})   optisch = ${sen.opt} (${sen.opt ? "hell" : "dunkel"})   Höhe = ${sen.hoehe} (${sen.hoehe ? "ok" : "niedrig"})`,
        ];
        if (bandVariante()) {
          formeln.push(`Bandposition = ${s.z.pos} (${posText(s.z.pos)})   →   s = ${code(sen)} · 4 + ${s.z.pos} = ${s.s}`);
        } else {
          formeln.push(`s = 4 · ${sen.ind} + 2 · ${sen.opt} + ${sen.hoehe} = ${s.s}${sen.gestoert ? "   (Achtung: Störung am optischen Sensor!)" : ""}`);
        }
        return {
          text: bandVariante()
            ? "Der Agent liest die drei Sensorsignale (beim Einlaufen gemessen) und die Bandposition. Zusammen ergeben sie den Zustand s – eine Zelle der Q-Tabelle (rot umrandet)."
            : "Der Agent sieht nicht das Werkstück, sondern nur drei Sensorsignale (je 0 oder 1). Jede Kombination ist ein Zustand s – eine Zeile der Q-Tabelle (rot umrandet).",
          formeln,
        };
      },
      ausfuehren(s) {
        const info = s.info;
        const formeln = [];
        let text;
        if (info.ziel !== undefined) {
          const b = info.bewertung;
          text = `Das Werkstück (${teilText(info.teil)}) landet in: ${zielText(info.ziel)}. ${b.richtig ? "Richtig!" : "Falsch – " + b.text + "."}`;
          if (info.leerhub) {
            formeln.push(`Zylinder ${info.zylinder} fuhr ins Leere: ${LEERHUB.toFixed(1).replace(".", ",")}`);
          }
          formeln.push(`Belohnung r = ${belohnungText(s.r)}   (${b.text})`);
          formeln.push("Das Werkstück ist abgeschlossen – das nächste kommt.");
        } else if (info.leerhub) {
          text = `Zylinder ${info.zylinder} fährt aus – aber das Werkstück steht nicht davor. Das kostet Druckluft. Das Band läuft weiter.`;
          formeln.push(`Werkstück: Position ${info.von} → ${info.nach}   neuer Zustand s' = ${s.s2}`);
          formeln.push(`Belohnung r = ${belohnungText(s.r)}   (Zylinder ins Leere)`);
        } else {
          text = "Der Agent wartet, das Band läuft eine Position weiter. Dafür gibt es noch keine Belohnung – ob sich das Warten lohnt, zeigt sich erst später.";
          formeln.push(`Werkstück: Position ${info.von} → ${info.nach}   neuer Zustand s' = ${s.s2}`);
          formeln.push(`Belohnung r = 0`);
        }
        return { text, formeln };
      },
      kurz(s) {
        const info = s.info;
        if (info.ziel !== undefined) {
          return `Werkstück ${teilText(info.teil)} → ${zielText(info.ziel)}: ${info.bewertung.text}`;
        }
        return `Werkstück: Position ${info.von} → ${info.nach}${info.leerhub ? "  (Zylinder ins Leere)" : ""}`;
      },
      ende(k) {
        return `Charge fertig: ${k.wert} % richtig sortiert.`;
      },
      fazit(letzte) {
        const m = letzte.reduce((a, k) => a + k.wert, 0) / letzte.length;
        let text = `Nach ${agent.episoden} Chargen sortiert der Agent im Mittel ${m.toFixed(0)} % richtig (letzte 20 Chargen). `;
        if (agent.epsilon > 0.2) {
          text += "ε ist noch groß – ein Teil der Fehler ist absichtliches Ausprobieren. Teste unter „Vorführen“, was er wirklich kann.";
        } else if (m >= 90) {
          text += "Die Strategie steht. Mit „SPS-Export“ wird sie zu SCL-Code für die echte Sortierstation – so geht man in der Industrie vor: in der Simulation lernen, an der Anlage nutzen.";
        } else {
          text += "Das reicht noch nicht. Tipp: weitertrainieren oder unter „Vorführen“ prüfen, welche Zustände noch falsch sind.";
        }
        return text;
      },
    },

    export: {
      titel: "Sortierstation",
      get erklaerung() {
        return "Nach dem Training ist die Strategie nur noch eine Tabelle: Für jede Kombination der Sensorsignale steht fest, was zu tun ist. Diese Tabelle lässt sich als CASE-Anweisung in einen SCL-Baustein (TIA Portal) übernehmen – die SPS braucht dafür kein neuronales Netz und keine Lernregel." +
          (bandVariante() ? " In der Variante mit Bandposition muss die SPS zusätzlich die Position des Werkstücks kennen (z. B. über einen Wegzähler oder Lichtschranken)." : "");
      },
      get eingaenge() {
        const e = ["#Induktiv : BOOL   // 1 = Metall erkannt", "#Optisch  : BOOL   // 1 = hell (rot oder silber)", "#HoeheOk  : BOOL   // 1 = Höhe in Ordnung"];
        if (bandVariante()) {
          e.push("#Position : INT    // 0 = nach den Sensoren, 1 … 3 = vor Zylinder 1 … 3");
        }
        return e;
      },
      ausgang: "#Aktion : INT",
      get vorgabe() {
        return bandVariante() ? 0 : 3; // im Zweifel: Ausschuss bzw. durchlaufen lassen
      },
      zustandsNummer() {
        const z = ["#Zustand := BOOL_TO_INT(#Induktiv) * 4 + BOOL_TO_INT(#Optisch) * 2 + BOOL_TO_INT(#HoeheOk);"];
        if (bandVariante()) {
          z.push("#Zustand := #Zustand * 4 + #Position;");
        }
        return z;
      },
      zustandsKommentar(s) {
        if (!bandVariante()) {
          return sensorText(s);
        }
        return `${sensorText(Math.floor(s / 4))}, ${posText(s % 4)}`;
      },
    },
  };

  szenarioRegistrieren(SZ);
})();
