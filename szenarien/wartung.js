// =============================================================================
//  szenarien/wartung.js – Wartung der Bearbeitungsstation (Predictive Maintenance)
// =============================================================================
//  Eine Bohrstation produziert Takt für Takt. Mit jedem Takt kann sie
//  verschleißen; ein Schwingungssensor meldet die Verschleißstufe 0 … 5.
//  Je stärker der Verschleiß, desto größer das Risiko eines Ausfalls.
//
//    Zustand   Verschleißstufe 0 … 5 oder "defekt" (Stillstand)
//              × Auftragslage niedrig / hoch            → 14 Zustände
//    Aktionen  produzieren / warten
//
//    produzieren   +10 € (wenig Aufträge) bzw. +20 € (viele Aufträge)
//                  Verschleiß steigt mit 40 % um eine Stufe
//                  Ausfallrisiko je Stufe: 0 / 0 / 3 / 8 / 20 / 40 %
//                  Ausfall: −30 € Reparatur, danach Stillstand
//                  (Reparatur dauert im Mittel 5 Takte, kein Gewinn)
//    warten        −10 € (Techniker, ein Takt ohne Produktion), Verschleiß → 0
//    Auftragslage  wechselt in jedem Takt mit 20 %
//    Episode       eine Schicht mit 50 Takten
//
//  Mit Wertiteration nachgerechnet (Strategie, die auf Dauer am meisten bringt):
//    γ = 0      nie warten – die Maschine läuft bis zum Ausfall    (≈ 434 € je Schicht)
//    γ = 0,9    warten ab Stufe 3 (wenig Aufträge) bzw. 4 (viele)  (≈ 575 € je Schicht)
//    Zufall                                                        (≈ 118 € je Schicht)
// =============================================================================

(() => {
  const P = {
    risiko: [0, 0, 0.03, 0.08, 0.2, 0.4],
    pVerschleiss: 0.4,
    gewinn: [10, 20],
    ausfall: -30,
    wartung: -10,
    pReparatur: 0.2,
    pWechsel: 0.2,
    takte: 50,
  };
  const DEFEKT = 6;
  const SCHWINGUNG = [1.2, 2.0, 2.8, 4.1, 5.6, 7.5]; // mm/s, nur zur Anzeige
  const LAGE = ["wenig Aufträge", "viele Aufträge"];

  // ---------------------------------------------------------------------------
  // Umgebung
  // ---------------------------------------------------------------------------
  const env = {
    zuruecksetzen() {
      this.w = 0;
      this.lage = Math.random() < 0.5 ? 0 : 1;
      this.takt = 0;
      this.gewinn = 0;
      this.ausfaelle = 0;
      this.wartungen = 0;
      this.verlauf = []; // je Takt: {art: "P" | "W" | "A" | "R", r, lage}
      this.vorbei = false;
    },

    zustand() {
      return {
        w: this.w,
        lage: this.lage,
        takt: this.takt,
        gewinn: this.gewinn,
        ausfaelle: this.ausfaelle,
        wartungen: this.wartungen,
        verlauf: this.verlauf.slice(),
      };
    },

    schritt(a) {
      const info = { w: this.w, lage: this.lage };
      let r = 0;
      if (this.w === DEFEKT) {
        info.art = "R"; // Stillstand, es wird repariert
        if (Math.random() < P.pReparatur) {
          this.w = 0;
          info.repariert = true;
        }
      } else if (a === 1) {
        info.art = "W";
        r = P.wartung;
        this.w = 0;
        this.wartungen++;
      } else if (Math.random() < P.risiko[this.w]) {
        info.art = "A";
        r = P.ausfall;
        this.w = DEFEKT;
        this.ausfaelle++;
      } else {
        info.art = "P";
        r = P.gewinn[this.lage];
        if (Math.random() < P.pVerschleiss) {
          this.w = Math.min(5, this.w + 1);
          info.verschlissen = true;
        }
      }
      if (Math.random() < P.pWechsel) {
        this.lage = 1 - this.lage;
        info.lageWechsel = true;
      }
      this.verlauf.push({ art: info.art, r, lage: info.lage });
      this.gewinn += r;
      this.takt++;
      this.vorbei = this.takt >= P.takte;
      // Schichtende ist kein echtes Ende: Die Maschine läuft morgen weiter → nicht terminal
      return { z2: this.zustand(), r, terminal: false, vorbei: this.vorbei, info };
    },
  };

  function einordnen(z) {
    return { f: { w: z.w, lage: z.lage }, s: z.lage * 7 + z.w };
  }

  function stufeText(w) {
    return w === DEFEKT ? "defekt (Stillstand)" : `Verschleiß ${w}`;
  }

  function euro(v) {
    return `${v < 0 ? "−" : v > 0 ? "+" : ""}${Math.abs(v)} €`;
  }

  // ---------------------------------------------------------------------------
  // Q-Tabelle: Zeilen = Auftragslage, Spalten = Verschleißstufe
  // ---------------------------------------------------------------------------
  const QX = 836;
  const QW = 728;
  const QY = 190;
  const ZH = 150;
  const LUECKE = 24;

  function qZelle(s) {
    const lage = Math.floor(s / 7);
    const w = s % 7;
    const sw = QW / 7;
    const zeile = 1 - lage; // viele Aufträge oben
    return { x: QX + w * sw + 2, y: QY + zeile * (ZH + LUECKE), w: sw - 4, h: ZH };
  }

  function zeichneQAchsen() {
    const sw = QW / 7;
    noStroke();
    textFont(SCHRIFT);
    textSize(12);
    textAlign(CENTER, BOTTOM);
    for (let w = 0; w <= DEFEKT; w++) {
      fill(...(w === DEFEKT ? FARBE.akzent : FARBE.text));
      text(w === DEFEKT ? "defekt" : `Stufe ${w}`, QX + (w + 0.5) * sw, QY - 18);
      fill(...FARBE.blass);
      textSize(11);
      text(w === DEFEKT ? "Stillstand" : `${SCHWINGUNG[w].toFixed(1).replace(".", ",")} mm/s`, QX + (w + 0.5) * sw, QY - 4);
      textSize(12);
    }
    textAlign(LEFT, CENTER);
    for (let lage = 1; lage >= 0; lage--) {
      const y = QY + (1 - lage) * (ZH + LUECKE) + ZH / 2;
      fill(...FARBE.text);
      textStyle(BOLD);
      text(lage ? "viele" : "wenig", 700, y - 9);
      textStyle(NORMAL);
      text("Aufträge", 700, y + 8);
      fill(...FARBE.blass);
      textSize(11);
      text(`${P.gewinn[lage]} € je Takt`, 700, y + 26);
      textSize(12);
    }
    fill(...FARBE.text);
    textAlign(LEFT, BOTTOM);
    text("Verschleiß →", 700, QY - 4);
    // in jeder Zelle: links P, rechts W
    fill(...FARBE.blass);
    textSize(12);
    textAlign(CENTER, TOP);
    text(
      "In jeder Zelle: links Q(s,P) = produzieren, rechts Q(s,W) = warten.  Ab welcher Stufe lohnt sich die Wartung?",
      QX + QW / 2 - 70,
      QY + 2 * ZH + LUECKE + 10
    );
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  function ampel(x, y, rot, gelb, gruen) {
    noStroke();
    fill(...FARBE.dunkel);
    rect(x - 3, y + 66, 6, 46);
    const lampen = [
      [rot, [228, 0, 43]],
      [gelb, [240, 180, 0]],
      [gruen, [52, 168, 84]],
    ];
    for (let i = 0; i < 3; i++) {
      const [an, farbe] = lampen[i];
      fill(...(an ? farbe : [farbe[0] * 0.3 + 150, farbe[1] * 0.3 + 150, farbe[2] * 0.3 + 150]));
      rect(x - 11, y + i * 22, 22, 20, 3);
    }
  }

  function zeichneMaschine(x, y, zustand, t, laeuft) {
    // Gestell
    noStroke();
    fill(...FARBE.flaeche2);
    rect(x, y + 150, 210, 18, 4);
    fill(...FARBE.dunkel);
    rect(x + 20, y, 26, 152, 4); // Säule
    rect(x + 20, y, 130, 30, 6); // Ausleger
    // Spindel
    const hub = zustand === "P" ? Math.sin(t * PI) * 26 : 0;
    fill(...FARBE.grau);
    rect(x + 108, y + 30, 30, 34 + hub, 3);
    fill(...FARBE.blass);
    rect(x + 119, y + 64 + hub, 8, 22);
    // Bohrer dreht sich
    if (zustand === "P" && laeuft) {
      stroke(255);
      strokeWeight(1.5);
      const o = (millis() * 0.05) % 8;
      for (let k = 0; k < 22; k += 8) {
        line(x + 119, y + 66 + hub + ((k + o) % 22), x + 127, y + 70 + hub + ((k + o) % 22));
      }
      noStroke();
    }
    // Werkstück auf dem Tisch
    fill(...FARBE.dunkel);
    rect(x + 70, y + 132, 110, 18, 3);
    fill(200, 30, 58);
    rect(x + 100, y + 116, 46, 16, 3);

    // Wartung: Schraubenschlüssel
    if (zustand === "W") {
      push();
      translate(x + 175, y + 70);
      rotate(-0.6 + Math.sin(t * TWO_PI) * 0.4);
      fill(...FARBE.senf);
      rect(-4, 0, 8, 46, 3);
      circle(0, 0, 22);
      fill(...FARBE.flaeche);
      rect(-4, -12, 8, 12);
      pop();
    }
    // Ausfall / Stillstand: Warnzeichen
    if (zustand === "A" || zustand === "R") {
      const a = zustand === "A" ? 255 : 160;
      fill(...FARBE.akzent, a);
      triangle(x + 175, y + 40, x + 152, y + 82, x + 198, y + 82);
      fill(255, a);
      textFont(SCHRIFT);
      textStyle(BOLD);
      textSize(22);
      textAlign(CENTER, CENTER);
      text("!", x + 175, y + 66);
      textStyle(NORMAL);
      if (zustand === "A") {
        // Funken
        stroke(...FARBE.senf, 255 * (1 - t));
        strokeWeight(2);
        for (let k = 0; k < 7; k++) {
          const wnk = (k / 7) * TWO_PI;
          const r0 = 10 + t * 20;
          line(x + 123 + Math.cos(wnk) * r0, y + 100 + Math.sin(wnk) * r0, x + 123 + Math.cos(wnk) * (r0 + 8), y + 100 + Math.sin(wnk) * (r0 + 8));
        }
        noStroke();
      }
    }
  }

  function zeichneUmgebung(an) {
    const p = P_UMW;
    const z = an.z;
    const zl = an.zuletzt && an.zuletzt.info && an.zuletzt.info.art ? an.zuletzt : null;
    const t = an.anim;

    // --- Messwerte oben ---
    noStroke();
    textFont(MONO);
    textSize(13);
    textAlign(LEFT, TOP);
    fill(...FARBE.text);
    text(
      `Verschleiß = ${z.w === DEFEKT ? "defekt" : z.w + " (" + SCHWINGUNG[z.w].toFixed(1) + " mm/s)"}   Auftragslage = ${z.lage ? "viele" : "wenig"}`,
      p.x + 16,
      p.y + 46
    );
    textFont(SCHRIFT);
    textSize(12);
    fill(...FARBE.grau);
    text(`Agent sieht: Zustand s = ${einordnen(z).s} (Zelle der Q-Tabelle)`, p.x + 16, p.y + 68);
    textAlign(RIGHT, TOP);
    text(`Takt ${Math.min(z.takt + 1, P.takte)} von ${P.takte}`, p.x + p.w - 16, p.y + 68);

    // --- Maschine und Signalsäule ---
    const zustand = z.w === DEFEKT ? (zl && zl.info.art === "A" && t < 1 ? "A" : "R") : zl && t < 1 ? zl.info.art : "–";
    zeichneMaschine(p.x + 40, p.y + 120, zustand, t, laeuft || t < 1);
    const art = zl ? zl.info.art : "";
    ampel(p.x + 272, p.y + 122, z.w === DEFEKT, art === "W" && t < 1, z.w !== DEFEKT && (art === "P" || art === "" || t >= 1));
    noStroke();
    textFont(SCHRIFT);
    textSize(11);
    textAlign(CENTER, TOP);
    fill(...FARBE.grau);
    text("Signalsäule", p.x + 272, p.y + 238);

    // --- Verschleißanzeige ---
    const gx = p.x + 340;
    const gy = p.y + 130;
    textAlign(LEFT, BOTTOM);
    fill(...FARBE.text);
    textStyle(BOLD);
    textSize(13);
    text("Schwingungssensor · Verschleiß", gx, gy - 4);
    textStyle(NORMAL);
    for (let w = 0; w < 6; w++) {
      const farbe = lerpColor(color(52, 128, 84), color(200, 30, 58), w / 5);
      const aktiv = z.w !== DEFEKT && w <= z.w;
      fill(aktiv ? farbe : color(...FARBE.flaeche2));
      stroke(...(w === z.w ? FARBE.text : FARBE.linie));
      strokeWeight(w === z.w ? 2 : 1);
      rect(gx + w * 44, gy + 4, 38, 30, 4);
      noStroke();
      fill(...(aktiv ? [255] : FARBE.grau));
      textAlign(CENTER, CENTER);
      textSize(13);
      text(String(w), gx + w * 44 + 19, gy + 19);
    }
    textAlign(LEFT, TOP);
    textSize(12);
    if (z.w === DEFEKT) {
      fill(...FARBE.akzent);
      textStyle(BOLD);
      text("Ausgefallen – Reparatur läuft (im Mittel 5 Takte)", gx, gy + 42);
      textStyle(NORMAL);
    } else {
      fill(...FARBE.grau);
      text(`Ausfallrisiko im nächsten Takt: ${Math.round(P.risiko[z.w] * 100)} %`, gx, gy + 42);
      fill(...FARBE.blass);
      textSize(11);
      text("(diese Zahlen kennt der Agent nicht)", gx, gy + 58);
    }

    // --- Auftragslage ---
    const ay = p.y + 222;
    stroke(...(z.lage ? FARBE.senf : FARBE.linie));
    strokeWeight(z.lage ? 2 : 1);
    fill(...(z.lage ? [251, 243, 228] : FARBE.flaeche2));
    rect(gx, ay, 260, 52, 8);
    noStroke();
    fill(...FARBE.text);
    textStyle(BOLD);
    textSize(13);
    textAlign(LEFT, TOP);
    text(`Auftragsbuch: ${LAGE[z.lage]}`, gx + 12, ay + 9);
    textStyle(NORMAL);
    fill(...FARBE.grau);
    textSize(12);
    text(`produzieren bringt ${P.gewinn[z.lage]} € je Takt`, gx + 12, ay + 29);

    // letzte Belohnung
    if (zl && t < 1) {
      textFont(SCHRIFT);
      textStyle(BOLD);
      textSize(16);
      textAlign(CENTER, CENTER);
      fill(...(zl.r > 0 ? FARBE.gruen : zl.r < 0 ? FARBE.akzent : FARBE.grau));
      text(zl.r === 0 ? "0 € (Stillstand)" : euro(zl.r), p.x + 145, p.y + 106 - t * 10);
      textStyle(NORMAL);
    }

    // --- Zeitleiste der Schicht ---
    const ty = p.y + p.h - 92;
    const bx = p.x + 16;
    const bw = (p.w - 32) / P.takte;
    noStroke();
    fill(...FARBE.grau);
    textSize(11);
    textAlign(LEFT, BOTTOM);
    text("Schicht: jeder Takt ein Kästchen", bx, ty - 4);
    const farbeArt = { P: FARBE.gruen, W: FARBE.senf, A: FARBE.akzent, R: [222, 160, 168] };
    for (let i = 0; i < P.takte; i++) {
      const e = z.verlauf[i];
      if (e) {
        fill(...farbeArt[e.art], e.art === "P" && e.lage === 0 ? 140 : 255);
      } else {
        fill(...FARBE.flaeche2);
      }
      rect(bx + i * bw + 0.5, ty, bw - 1.5, 16, 2);
    }
    // Legende und Summen
    let lx = bx;
    const ly = ty + 30;
    textAlign(LEFT, CENTER);
    for (const [farbe, txt, alpha] of [
      [FARBE.gruen, "produziert (hell: wenig Aufträge)", 255],
      [FARBE.senf, "gewartet", 255],
      [FARBE.akzent, "Ausfall", 255],
      [[222, 160, 168], "Stillstand", 255],
    ]) {
      fill(...farbe, alpha);
      rect(lx, ly - 5, 10, 10, 2);
      fill(...FARBE.grau);
      text(txt, lx + 14, ly);
      lx += 24 + textWidth(txt);
    }
    textAlign(RIGHT, CENTER);
    fill(...FARBE.text);
    textStyle(BOLD);
    text(`Gewinn ${z.gewinn} € · ${z.ausfaelle}× Ausfall · ${z.wartungen}× Wartung`, p.x + p.w - 16, ty - 10);
    textStyle(NORMAL);
  }

  // ---------------------------------------------------------------------------
  // Das Szenario
  // ---------------------------------------------------------------------------
  const SZ = {
    id: "wartung",
    name: "Wartung Bearbeitungsstation",
    titel: "KI wartet",
    umgebungTitel: "Umgebung · Bearbeitungsstation",
    umgebungKurz: "Maschine, Verschleiß, Aufträge",
    regelText: "Produzieren bringt Geld, erhöht aber den Verschleiß · Ausfall: −30 € und Stillstand · Wartung: −10 €",
    optionen: [],
    einstellung: {},
    vorgaben: { alpha: 0.05, gamma: 0.9, episoden: 1000 },
    dt: 0.5,
    qStellen: 0,
    meldungY: 106,
    mensch: "diskret",

    aktionen() {
      return [
        { kurz: "P", text: "produzieren", farbe: FARBE.gruen },
        { kurz: "W", text: "warten", farbe: FARBE.senf },
      ];
    },
    anzahl() {
      return 14;
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
      return env.gewinn;
    },
    episodenErgebnis() {
      return {
        text: `Schicht vorbei · Gewinn ${env.gewinn} € · ${env.ausfaelle}× Ausfall`,
        gut: env.gewinn >= 500,
        extra: { ausfaelle: env.ausfaelle, wartungen: env.wartungen },
      };
    },
    kurve: {
      titel: "Lernkurve · Gewinn je Schicht",
      min: -200,
      max: 800,
      ticks: [-200, 0, 400, 800],
      leer: "Noch keine Schicht. Eine Episode ist eine Schicht mit 50 Takten.",
      besserHoch: true,
      format: (v) => `${v.toFixed(0)} €`,
    },

    zeichneUmgebung,
    qZelle,
    zeichneQAchsen,
    zustandsZeilen(s) {
      const lage = Math.floor(s / 7);
      const w = s % 7;
      return [`${stufeText(w)} · ${LAGE[lage]}`];
    },

    texte: {
      menschStatus: "Selbst entscheiden · 1 = produzieren, 2 = warten · Wie viel Gewinn schaffst du in einer Schicht?",
      menschStart: "",
      menschLaeuft: "",
      menschIntro:
        "Du bist für die Bohrstation verantwortlich. In jedem Takt entscheidest du: produzieren (Geld, aber Verschleiß) oder warten (kostet, setzt den Verschleiß zurück). Fällt die Maschine aus, steht sie mehrere Takte still. Taste 1 oder 2 bzw. die Knöpfe unten.",
      menschKreislauf: "liest den Sensor, entscheidest",
      menschTipp: "Tipp: Warten ist billiger, wenn gerade\nwenig Aufträge da sind.",
      trainingTipp: "γ: Wie wichtig ist die Zukunft? Mit γ = 0\nsieht der Agent den Stillstand nach einem\nAusfall nicht kommen – probiere es aus!",
      zufall: "Ein Agent ohne Wissen entscheidet jeden Takt zufällig – er wartet viel zu oft und verdient kaum etwas.",
      start:
        "Der Agent kennt weder das Ausfallrisiko noch die Reparaturzeit. Er sieht nur Verschleißstufe und Auftragslage und lernt aus Gewinnen und Verlusten, wann sich eine Wartung lohnt. An der echten Maschine wäre jeder Lern-Ausfall teuer – deshalb trainiert man mit einem Modell (digitaler Zwilling).",
      lernenTerminal: "",

      beobachten(s) {
        return {
          text: "Der Agent liest die Verschleißstufe (aus dem Schwingungssensor) und die Auftragslage. Zusammen ergeben sie den Zustand s – eine Zelle der Q-Tabelle (rot umrandet).",
          formeln: [
            `Verschleiß = ${s.z.w === DEFEKT ? "defekt (6)" : s.z.w}   Auftragslage = ${s.z.lage} (${LAGE[s.z.lage]})`,
            `s = 7 · ${s.z.lage} + ${s.z.w} = ${s.s}`,
          ],
        };
      },
      ausfuehren(s) {
        const i = s.info;
        const formeln = [];
        let text;
        if (i.art === "R") {
          text = "Die Maschine steht still und wird repariert – egal, was der Agent wählt. Kein Gewinn." + (i.repariert ? " Jetzt ist sie wieder repariert (Verschleiß 0)." : "");
        } else if (i.art === "W") {
          text = "Der Techniker wartet die Maschine: Das kostet 10 € und einen Takt ohne Produktion, dafür ist der Verschleiß wieder 0.";
        } else if (i.art === "A") {
          text = `Ausfall! Bei Verschleiß ${i.w} lag das Risiko bei ${Math.round(P.risiko[i.w] * 100)} %. Reparatur: −30 €, und die Maschine steht jetzt mehrere Takte still.`;
        } else {
          text = `Die Maschine produziert: +${P.gewinn[i.lage]} €.` + (i.verschlissen ? " Dabei ist der Verschleiß um eine Stufe gestiegen." : " Der Verschleiß bleibt gleich.");
        }
        formeln.push(`${stufeText(i.w)} → ${stufeText(s.z2.w)}${i.lageWechsel ? `   Auftragslage wechselt: ${LAGE[s.z2.lage]}` : ""}`);
        formeln.push(`neuer Zustand s' = ${s.s2}   Belohnung r = ${euro(s.r)}`);
        return { text, formeln };
      },
      kurz(s) {
        const namen = { P: "produziert", W: "gewartet", A: "AUSFALL", R: "Stillstand" };
        return `${namen[s.info.art]}: ${stufeText(s.info.w)} → ${stufeText(s.z2.w)}`;
      },
      ende(k) {
        return `Schicht vorbei: ${k.wert} € Gewinn${k.extra ? `, ${k.extra.ausfaelle}× Ausfall, ${k.extra.wartungen}× Wartung` : ""}.`;
      },
      fazit(letzte) {
        const m = letzte.reduce((a, k) => a + k.wert, 0) / letzte.length;
        const ausf = letzte.reduce((a, k) => a + (k.extra ? k.extra.ausfaelle : 0), 0) / letzte.length;
        let text = `Nach ${agent.episoden} Schichten verdient der Agent im Mittel ${m.toFixed(0)} € je Schicht (${ausf.toFixed(1).replace(".", ",")} Ausfälle, letzte 20). `;
        if (agent.epsilon > 0.2) {
          text += "ε ist noch groß – der Agent probiert noch viel aus.";
        } else if (agent.gamma < 0.5) {
          text += `Mit γ = ${f2(agent.gamma)} ist der Agent kurzsichtig: Den Stillstand nach einem Ausfall „sieht“ er kaum. Vergleiche mit γ = 0,9!`;
        } else {
          text += "Lies in der Q-Tabelle ab, ab welcher Stufe er wartet – und ob er die Wartung in Zeiten mit wenig Aufträgen legt.";
        }
        return text;
      },
    },

    export: {
      titel: "Wartung Bearbeitungsstation",
      erklaerung:
        "Die gelernte Wartungsstrategie ist eine Tabelle: Für jede Verschleißstufe und Auftragslage steht fest, ob produziert oder gewartet wird. Als SCL-Baustein könnte die SPS damit selbst eine Wartungsanforderung auslösen (z. B. eine Meldung ans Bedienpanel). Im Zustand „defekt“ ist die Aktion egal.",
      eingaenge: [
        "#Verschleiss    : INT    // 0 … 5 aus dem Schwingungssensor, 6 = Störung",
        "#VieleAuftraege : BOOL   // 1 = viele Aufträge (aus dem MES/ERP)",
      ],
      ausgang: "#Aktion : INT",
      vorgabe: 1,
      zustandsNummer() {
        return ["#Zustand := BOOL_TO_INT(#VieleAuftraege) * 7 + #Verschleiss;"];
      },
      zustandsKommentar(s) {
        return `${stufeText(s % 7)}, ${LAGE[Math.floor(s / 7)]}`;
      },
    },
  };

  szenarioRegistrieren(SZ);
})();
