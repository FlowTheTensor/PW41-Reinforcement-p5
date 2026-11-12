// =============================================================================
//  szenarien/wagen.js – Wagen mit Stab (Balancing Pole / CartPole)
// =============================================================================
//  Dieselbe Physik wie in der Python-Bibliothek Gymnasium ("CartPole-v1"):
//
//    Zustand   x      Position des Wagens in m          (0 = Mitte der Bahn)
//              v      Geschwindigkeit des Wagens in m/s
//              θ      Winkel des Stabs in rad           (0 = senkrecht, + = nach rechts geneigt)
//              ω      Winkelgeschwindigkeit in rad/s    (+ = kippt nach rechts)
//
//    Aktionen  0 = Wagen nach links schieben, 1 = nach rechts schieben (je 10 N)
//    Belohnung +1 für jeden Zeitschritt (0,02 s), in dem der Stab noch steht
//    Ende      |θ| > 12°  oder  |x| > 2,4 m  (umgefallen / aus der Bahn)
//              nach 500 Schritten ist die Episode geschafft
//
//  Die Messwerte sind Kommazahlen – für die Tabelle werden sie in Fächer
//  einsortiert.
// =============================================================================

(() => {
  const PHYSIK = {
    g: 9.8, // Erdbeschleunigung in m/s²
    mWagen: 1.0, // Masse des Wagens in kg
    mStab: 0.1, // Masse des Stabs in kg
    l: 0.5, // halbe Stablänge in m
    kraft: 10, // Schubkraft in N
    dt: 0.02, // Zeitschritt in s
    thetaMax: (12 * Math.PI) / 180, // ab diesem Winkel gilt der Stab als umgefallen
    xMax: 2.4, // Ende der Bahn in m
    maxSchritte: 500,
  };

  const AKTION_TEXT = ["nach links", "nach rechts"];

  // Welche Messwerte der Agent sieht und in wie viele Fächer sie geteilt werden.
  // Werte außerhalb des Bereichs landen im ersten bzw. letzten Fach.
  const ZUSTAENDE = {
    einfach: { name: "nur Stab", faecher: { x: 1, v: 1, theta: 6, omega: 8 } },
    voll: { name: "Stab + Wagen", faecher: { x: 3, v: 3, theta: 6, omega: 8 } },
  };

  const BEREICH = {
    x: 2.4, // m
    v: 1.0, // m/s
    theta: PHYSIK.thetaMax, // rad (12°)
    omega: 1.5, // rad/s (≈ 86 °/s)
  };

  const GRUND_TEXT = {
    umgefallen: "Stab umgefallen",
    bahn: "Wagen aus der Bahn gefahren",
    geschafft: "Geschafft – 10 Sekunden balanciert",
  };

  // Zeichnung
  const MITTE_X = P_UMW.x + P_UMW.w / 2;
  const BODEN_Y = 422;
  const PX_M = 112; // Pixel je Meter auf der Bahn
  const STAB_PX = 140; // gezeichnete Stablänge (etwas länger als maßstäblich)
  const WAGEN_B = 64;
  const WAGEN_H = 30;

  // ---------------------------------------------------------------------------
  // Umgebung: Physik
  // ---------------------------------------------------------------------------
  class WagenMitStab {
    constructor() {
      this.zuruecksetzen();
    }

    // Start fast senkrecht, mit ein wenig Zufall (wie in Gymnasium: ±0,05)
    zuruecksetzen() {
      const z = () => Math.random() * 0.1 - 0.05;
      this.x = z();
      this.v = z();
      this.theta = z();
      this.omega = z();
      this.schritte = 0;
      this.vorbei = false;
      this.grund = ""; // "umgefallen" | "bahn" | "geschafft"
    }

    zustand() {
      return { x: this.x, v: this.v, theta: this.theta, omega: this.omega };
    }

    // Ein Zeitschritt. richtung: −1 (links), +1 (rechts) oder 0 (nur beim Selbststeuern)
    schritt(richtung) {
      const P = PHYSIK;
      const F = richtung * P.kraft;
      const mGes = P.mWagen + P.mStab;
      const mlStab = P.mStab * P.l;
      const cos = Math.cos(this.theta);
      const sin = Math.sin(this.theta);

      // Bewegungsgleichungen (Barto, Sutton & Anderson 1983)
      const temp = (F + mlStab * this.omega * this.omega * sin) / mGes;
      const alpha = (P.g * sin - cos * temp) / (P.l * (4 / 3 - (P.mStab * cos * cos) / mGes));
      const a = temp - (mlStab * alpha * cos) / mGes;

      // Euler-Verfahren: erst Lage, dann Geschwindigkeit
      this.x += P.dt * this.v;
      this.v += P.dt * a;
      this.theta += P.dt * this.omega;
      this.omega += P.dt * alpha;

      this.schritte++;
      if (Math.abs(this.theta) > P.thetaMax) {
        this.vorbei = true;
        this.grund = "umgefallen";
      } else if (Math.abs(this.x) > P.xMax) {
        this.vorbei = true;
        this.grund = "bahn";
      } else if (this.schritte >= P.maxSchritte) {
        this.vorbei = true;
        this.grund = "geschafft";
      }
      // "gescheitert" heißt: wirklich gescheitert (nicht nur Zeit abgelaufen)
      return this.vorbei && this.grund !== "geschafft";
    }

    // Stab anstupsen (Klick in die Umgebung)
    stups(staerke) {
      this.omega += staerke;
    }
  }

  const env = new WagenMitStab();
  let stupsAnzeige = null;

  // ---------------------------------------------------------------------------
  // Einordnen: Messwerte → Fächer → Zeile s der Q-Tabelle
  // ---------------------------------------------------------------------------
  function faecher() {
    return ZUSTAENDE[SZ.einstellung.zustand].faecher;
  }

  // Nummer des Fachs, in das ein Messwert fällt (0 … n−1)
  function fach(wert, groesse) {
    const n = faecher()[groesse];
    if (n <= 1) {
      return 0;
    }
    const b = BEREICH[groesse];
    const anteil = (wert + b) / (2 * b);
    return Math.min(n - 1, Math.max(0, Math.floor(anteil * n)));
  }

  // Fachgrenzen eines Messwerts (für die Anzeige)
  function grenzen(groesse) {
    const n = faecher()[groesse];
    const b = BEREICH[groesse];
    const g = [];
    for (let i = 1; i < n; i++) {
      g.push(-b + (2 * b * i) / n);
    }
    return g;
  }

  function einordnen(z) {
    const f = {
      x: fach(z.x, "x"),
      v: fach(z.v, "v"),
      theta: fach(z.theta, "theta"),
      omega: fach(z.omega, "omega"),
    };
    const F = faecher();
    const s = ((f.x * F.v + f.v) * F.theta + f.theta) * F.omega + f.omega;
    return { f, s };
  }

  function faecherAus(s) {
    const F = faecher();
    let r = s;
    const omega = r % F.omega;
    r = Math.floor(r / F.omega);
    const theta = r % F.theta;
    r = Math.floor(r / F.theta);
    const v = r % F.v;
    const x = Math.floor(r / F.v);
    return { x, v, theta, omega };
  }

  // --- Anzeige-Helfer ---
  function grad(rad) {
    return vz((rad * 180) / Math.PI, 1) + "°";
  }

  function gradS(rad) {
    return vz((rad * 180) / Math.PI, 0) + " °/s";
  }

  // Fachgrenzen als lesbarer Text, z. B. "0° … +4°"
  function fachText(groesse, i) {
    const n = faecher()[groesse];
    if (n <= 1) {
      return "–";
    }
    const g = grenzen(groesse);
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

  // ---------------------------------------------------------------------------
  // Q-Tabelle: je Kombination aus Wagenposition und -geschwindigkeit eine
  // Kachel Winkel × Drehgeschwindigkeit
  // ---------------------------------------------------------------------------
  function qGeometrie() {
    const F = faecher();
    const lueckeX = F.x > 1 ? 18 : 0;
    const lueckeY = F.v > 1 ? 18 : 0;
    const kopfX = F.x > 1 ? 18 : 0; // Platz für Überschriften der Kacheln
    const kw = (QT.w - lueckeX * (F.x - 1)) / F.x;
    const kh = (QT.h - kopfX - (lueckeY + kopfX) * (F.v - 1)) / F.v;
    return { F, lueckeX, lueckeY, kopfX, kw, kh, zw: kw / F.theta, zh: kh / F.omega };
  }

  function zelle(f) {
    const g = qGeometrie();
    const kx = QT.x + f.x * (g.kw + g.lueckeX);
    const vr = g.F.v - 1 - f.v; // positive Geschwindigkeit oben
    const ky = QT.y + g.kopfX + vr * (g.kh + g.lueckeY + g.kopfX);
    const or = g.F.omega - 1 - f.omega; // positive Drehgeschwindigkeit oben
    return { x: kx + f.theta * g.zw, y: ky + or * g.zh, w: g.zw, h: g.zh, kx, ky };
  }

  function zeichneQAchsen() {
    const g = qGeometrie();
    const F = g.F;
    noStroke();
    fill(...FARBE.grau);
    textFont(SCHRIFT);
    if (F.x === 1) {
      textSize(11);
      textAlign(CENTER, TOP);
      const gt = grenzen("theta");
      for (let i = 0; i < gt.length; i++) {
        text(grad(gt[i]).replace(".0°", "°"), QT.x + (i + 1) * g.zw, QT.y + QT.h + 4);
      }
      textAlign(RIGHT, CENTER);
      const go = grenzen("omega");
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
  }

  // ---------------------------------------------------------------------------
  // Umgebung zeichnen: Bahn, Wagen, Stab
  // ---------------------------------------------------------------------------
  function zeichneUmgebung(an) {
    const p = P_UMW;
    const z = an.z;
    const F = faecher();
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
    if (F.x > 1) {
      stroke(...FARBE.blass);
      strokeWeight(1);
      gestrichelt(true);
      for (const g of grenzen("x")) {
        line(MITTE_X + g * PX_M, BODEN_Y - 10, MITTE_X + g * PX_M, BODEN_Y + 26);
      }
      gestrichelt(false);
      noStroke();
      const fx = fach(z.x, "x");
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
    const n = F.theta;
    const ft = fach(z.theta, "theta");
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
    if (an.letzteAktion !== null && an.aktiv) {
      const r = an.letzteAktion === 1 ? 1 : -1;
      const farbe = SZ.aktionen()[an.letzteAktion].farbe;
      const fx0 = wx - r * (WAGEN_B / 2 + 6);
      const fx1 = fx0 - r * 34;
      stroke(...farbe);
      strokeWeight(4);
      line(fx1, drehY + WAGEN_H / 2, fx0 - r * 8, drehY + WAGEN_H / 2);
      noStroke();
      fill(...farbe);
      triangle(fx0, drehY + WAGEN_H / 2, fx0 - r * 12, drehY + WAGEN_H / 2 - 8, fx0 - r * 12, drehY + WAGEN_H / 2 + 8);
    }

    // --- Stab ---
    const gescheitert = an.zeigeEnde ? an.sch.terminal : env.vorbei && env.grund !== "geschafft";
    const sx = wx + Math.sin(z.theta) * STAB_PX;
    const sy = drehY - Math.cos(z.theta) * STAB_PX;
    stroke(...(gescheitert ? FARBE.akzent : FARBE.senf));
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
    text(`Agent sieht: Zustand s = ${einordnen(z).s} (Zeile der Q-Tabelle)`, p.x + 16, p.y + 68);
    textAlign(RIGHT, TOP);
    const schritte = an.zeigeEnde && kurve.length ? kurve[kurve.length - 1].wert : env.schritte;
    text(`Schritt ${schritte} von ${PHYSIK.maxSchritte}`, p.x + p.w - 16, p.y + 68);

    // Stups-Anzeige
    if (stupsAnzeige && millis() - stupsAnzeige.t0 < 600) {
      const a = 255 * (1 - (millis() - stupsAnzeige.t0) / 600);
      noFill();
      stroke(...FARBE.akzent, a);
      strokeWeight(2);
      circle(stupsAnzeige.x, stupsAnzeige.y, 20 + (millis() - stupsAnzeige.t0) / 12);
    }

    noStroke();
    fill(...FARBE.blass);
    textFont(SCHRIFT);
    textSize(12);
    textAlign(RIGHT, CENTER);
    text("Klick neben den Stab: anstupsen", p.x + p.w - 16, p.y + KOPF_H / 2 + 1);
  }

  // ---------------------------------------------------------------------------
  // Das Szenario
  // ---------------------------------------------------------------------------
  const SZ = {
    id: "wagen",
    name: "Wagen mit Stab",
    titel: "KI balanciert",
    umgebungTitel: "Umgebung · Wagen mit Stab",
    umgebungKurz: "Wagen mit Stab · Physik",
    regelText: "Abbruch: Stab kippt mehr als 12° · Wagen verlässt die Bahn (±2,4 m)   ·   Ziel: 500 Schritte (10 s)",
    optionen: [
      {
        key: "zustand",
        name: "Zustand",
        neuAufbau: true,
        werte: Object.keys(ZUSTAENDE).map((k) => {
          const f = ZUSTAENDE[k].faecher;
          return [k, `${ZUSTAENDE[k].name} (${f.x * f.v * f.theta * f.omega})`];
        }),
      },
      {
        key: "belohnung",
        name: "Belohnung",
        neuAufbau: false,
        werte: [
          ["0", "+1 je Schritt"],
          ["-100", "+1 je Schritt, Strafe −100"],
        ],
      },
    ],
    einstellung: { zustand: "einfach", belohnung: "0" },
    vorgaben: { alpha: 0.2, gamma: 0.99, episoden: 300 },
    dt: PHYSIK.dt,
    qPfeile: true,
    qStellen: 1,
    mensch: "echtzeit",
    menschTasten: ["ArrowLeft", "ArrowRight"],

    aktionen() {
      return [
        { kurz: "←", text: "nach links schieben", farbe: FARBE.links },
        { kurz: "→", text: "nach rechts schieben", farbe: FARBE.rechts },
      ];
    },
    anzahl() {
      const f = faecher();
      return f.x * f.v * f.theta * f.omega;
    },
    zuruecksetzen() {
      env.zuruecksetzen();
    },
    zustand() {
      return env.zustand();
    },
    einordnen,
    schritt(a) {
      const gescheitert = env.schritt(a === 1 ? 1 : a === 0 ? -1 : 0);
      const strafe = Number(this.einstellung.belohnung);
      return { z2: env.zustand(), r: gescheitert ? 1 + strafe : 1, terminal: gescheitert, vorbei: env.vorbei, info: { grund: env.grund } };
    },
    // Selbst steuern: Pfeiltasten gedrückt halten, sonst rollt der Wagen frei
    menschAktion() {
      let r = 0;
      if (keyIsDown(LEFT_ARROW)) {
        r -= 1;
      }
      if (keyIsDown(RIGHT_ARROW)) {
        r += 1;
      }
      return r === 0 ? -1 : r > 0 ? 1 : 0;
    },
    klick(mx, my) {
      if (env.vorbei) {
        return;
      }
      // links vom Stab geklickt → Stab nach rechts stupsen und umgekehrt
      const wx = MITTE_X + env.x * PX_M;
      env.stups((mx < wx ? 1 : -1) * 0.6);
      stupsAnzeige = { x: mx, y: my, t0: millis() };
    },

    episodenWert() {
      return env.schritte;
    },
    episodenErgebnis() {
      return { text: `${GRUND_TEXT[env.grund]} · ${env.schritte} Schritte`, gut: env.grund === "geschafft", grund: env.grund };
    },
    kurve: {
      titel: "Lernkurve · Schritte je Episode",
      min: 0,
      max: 500,
      ticks: [0, 250, 500],
      leer: "Noch keine Episode. Jede Episode endet, wenn der Stab umfällt.",
      besserHoch: true,
      format: (v) => `${v.toFixed(0)} Schritte`,
    },

    zeichneUmgebung,
    qZelle(s) {
      return zelle(faecherAus(s));
    },
    zeichneQAchsen,
    zustandsZeilen(s) {
      const f = faecherAus(s);
      const zeilen = [];
      if (faecher().x > 1) {
        zeilen.push(`x: ${fachText("x", f.x)}   v: ${fachText("v", f.v)}`);
      }
      zeilen.push(`θ: ${fachText("theta", f.theta)}`);
      zeilen.push(`ω: ${fachText("omega", f.omega)}`);
      return zeilen;
    },

    texte: {
      menschStatus: "Selbst steuern · ← und → gedrückt halten · Schaffst du 500 Schritte (10 Sekunden)?",
      menschStart: "Leertaste oder ← / → drücken, um zu starten",
      menschLaeuft: "← und → schieben den Wagen. Lässt du los, rollt er frei. Der Stab darf nicht mehr als 12° kippen, der Wagen nicht aus der Bahn fahren.",
      menschFormeln: () => [`Schritt ${env.schritte} von 500   (1 Schritt = 0,02 s)`],
      menschIntro:
        "Erst selbst probieren: Halte ← oder → gedrückt, um den Wagen zu schieben. Schaffst du 500 Schritte (10 Sekunden)? Tipp: Unter „Tempo“ gibt es eine Zeitlupe. Danach lernt der Agent dieselbe Aufgabe – ohne die Physik zu kennen.",
      menschKreislauf: "schaust hin, drückst ← oder →",
      menschTipp: "Tipp: In der Zeitlupe ist es viel leichter.\nLässt du beide Tasten los, rollt der Wagen frei.",
      vorfuehrenLaeuft:
        "Der Agent nutzt nur noch sein Wissen (ε = 0) und lernt nicht dazu: In jedem Zustand wählt er die Aktion mit dem größeren Q-Wert. Klick neben den Stab, um ihn anzustupsen – fängt der Agent das ab?",
      zufall: "Ein Agent ohne Gedächtnis: Er wirft bei jedem Schritt eine Münze. Starte ihn oben oder gehe mit → Schritt für Schritt durch. Wie lange hält der Stab im Mittel?",
      start:
        "Der Agent kennt die Physik nicht. Er probiert aus und merkt sich in der Q-Tabelle, wie viel Belohnung jede Aktion in jedem Zustand gebracht hat. Gehe mit → Schritt für Schritt durch oder starte oben das Training.",
      terminalText: "danach kommt nichts mehr – die Episode ist vorbei",

      beobachten(s) {
        const F = faecher();
        const formeln = [];
        if (F.x > 1) {
          formeln.push(`x = ${vz(s.z.x, 2)} m → Fach ${s.f.x + 1} von ${F.x}     v = ${vz(s.z.v, 2)} m/s → Fach ${s.f.v + 1} von ${F.v}`);
        }
        formeln.push(`θ = ${grad(s.z.theta)}       → Fach ${s.f.theta + 1} von ${F.theta}  (${fachText("theta", s.f.theta)})`);
        formeln.push(`ω = ${gradS(s.z.omega)}   → Fach ${s.f.omega + 1} von ${F.omega}  (${fachText("omega", s.f.omega)})`);
        return {
          text:
            F.x > 1
              ? "Der Agent misst die vier Werte und sortiert jeden in ein Fach. Die Kombination der Fächer ist der Zustand s – eine Zelle der Q-Tabelle (rot umrandet)."
              : "Der Agent misst Winkel θ und Drehgeschwindigkeit ω und sortiert beide in Fächer. Die Kombination ist der Zustand s – eine Zelle der Q-Tabelle (rot umrandet). Die Wagenposition sieht er nicht.",
          formeln,
        };
      },
      ausfuehren(s) {
        return {
          text: `Der Wagen wird 0,02 s lang mit 10 N ${AKTION_TEXT[s.wahl.a]} geschoben. Die Umgebung meldet den neuen Zustand s' (gestrichelt) und eine Belohnung r.`,
          formeln: [
            `θ: ${grad(s.z.theta)} → ${grad(s.z2.theta)}     ω: ${gradS(s.z.omega)} → ${gradS(s.z2.omega)}`,
            `x: ${vz(s.z.x, 2)} → ${vz(s.z2.x, 2)} m     neuer Zustand s' = ${s.s2}`,
            s.terminal
              ? `Belohnung r = ${belohnungText(s.r)}   (${s.info.grund === "bahn" ? "aus der Bahn" : "Stab umgefallen"} – Episode vorbei)`
              : `Belohnung r = +1   (Stab steht noch)`,
          ],
        };
      },
      kurz(s) {
        return `θ: ${grad(s.z.theta)} → ${grad(s.z2.theta)}     ω: ${gradS(s.z.omega)} → ${gradS(s.z2.omega)}`;
      },
      ende(k) {
        return k.grund === "geschafft"
          ? "Geschafft: 500 Schritte (10 Sekunden) balanciert."
          : `${GRUND_TEXT[k.grund]} nach ${k.wert} Schritten.`;
      },
      fazit(letzte) {
        const m = letzte.reduce((a, k) => a + k.wert, 0) / letzte.length;
        const bahn = letzte.filter((k) => k.grund === "bahn").length;
        const geschafft = letzte.filter((k) => k.grund === "geschafft").length;
        let text = `Nach ${agent.episoden} Episoden hält der Stab im Mittel ${m.toFixed(0)} Schritte (letzte 20 Episoden, ${geschafft}× geschafft). `;
        if (agent.epsilon > 0.2) {
          text += "ε ist noch groß – der Agent probiert viel aus. Weitertrainieren oder unter „Vorführen“ ohne Ausprobieren testen.";
        } else if (bahn >= 5 && faecher().x === 1) {
          text += `${bahn}× fuhr der Wagen aus der Bahn: Der Agent sieht die Wagenposition nicht! Tipp: Zustand „Stab + Wagen“ und Belohnung „Strafe −100“ wählen, dann 1000 Episoden trainieren.`;
        } else if (m < 150) {
          text += "Das reicht noch nicht. Tipp: weitertrainieren, Lernrate α ändern oder „Q-Tabelle leeren“ und neu beginnen.";
        } else {
          text += "Schau dir unter „Vorführen“ an, was der Agent gelernt hat.";
        }
        return text;
      },
    },
  };

  szenarioRegistrieren(SZ);
})();
