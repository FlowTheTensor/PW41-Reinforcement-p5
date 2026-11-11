// =============================================================================
//  agent.js – Q-Learning mit einer Tabelle (ohne p5, reines JavaScript)
// =============================================================================
//  1. Zustand beobachten   Die vier Messwerte werden in Fächer (Bereiche)
//                          einsortiert → eine Zeile s der Q-Tabelle.
//  2. Aktion wählen        ε-greedy: mit Wahrscheinlichkeit ε zufällig
//                          (Erkunden), sonst die Aktion mit dem größten Q-Wert.
//  3. Aktion ausführen     Die Umgebung liefert den neuen Zustand s' und die
//                          Belohnung r.
//  4. Q-Wert anpassen      Q(s,a) ← Q(s,a) + α · (r + γ · max Q(s',·) − Q(s,a))
//
//  Q(s,a) ist die Schätzung: "Wie viel Belohnung bekomme ich insgesamt noch,
//  wenn ich im Zustand s die Aktion a wähle und danach gut weiterspiele?"
// =============================================================================

// Welche Messwerte der Agent sieht und in wie viele Fächer sie geteilt werden.
// Werte außerhalb des Bereichs landen im ersten bzw. letzten Fach.
const ZUSTAENDE = {
  einfach: {
    name: "nur Stab",
    faecher: { x: 1, v: 1, theta: 6, omega: 8 },
  },
  voll: {
    name: "Stab + Wagen",
    faecher: { x: 3, v: 3, theta: 6, omega: 8 },
  },
};

const BEREICH = {
  x: 2.4, // m
  v: 1.0, // m/s
  theta: PHYSIK.thetaMax, // rad (12°)
  omega: 1.5, // rad/s (≈ 86 °/s)
};

const MESSWERTE = ["x", "v", "theta", "omega"];

class QAgent {
  constructor(zustandsArt) {
    this.alpha = 0.2; // Lernrate
    this.gamma = 0.99; // Abzinsung: wie wichtig ist die Zukunft?
    this.epsilon = 1.0; // Anteil zufälliger Aktionen
    this.epsilonMin = 0.01;
    this.epsilonFaktor = 0.97; // ε wird nach jeder Episode damit multipliziert
    this.strafe = 0; // Strafe beim Scheitern (0 oder −100): umgefallen oder aus der Bahn
    this.neuAufbauen(zustandsArt || "einfach");
  }

  neuAufbauen(zustandsArt) {
    this.art = zustandsArt;
    this.faecher = Object.assign({}, ZUSTAENDE[zustandsArt].faecher);
    this.anzahl = this.faecher.x * this.faecher.v * this.faecher.theta * this.faecher.omega;
    this.q = [];
    this.besuche = [];
    for (let s = 0; s < this.anzahl; s++) {
      this.q.push([0, 0]);
      this.besuche.push(0);
    }
    this.episoden = 0;
    this.updates = 0;
  }

  // Nummer des Fachs, in das ein Messwert fällt (0 … n−1)
  fach(wert, groesse) {
    const n = this.faecher[groesse];
    if (n <= 1) {
      return 0;
    }
    const b = BEREICH[groesse];
    const anteil = (wert + b) / (2 * b);
    return Math.min(n - 1, Math.max(0, Math.floor(anteil * n)));
  }

  // Fachgrenzen eines Messwerts (für die Anzeige)
  grenzen(groesse) {
    const n = this.faecher[groesse];
    const b = BEREICH[groesse];
    const g = [];
    for (let i = 1; i < n; i++) {
      g.push(-b + (2 * b * i) / n);
    }
    return g;
  }

  // Zustand → Fächer und Zeilennummer s der Q-Tabelle
  einordnen(z) {
    const f = {
      x: this.fach(z.x, "x"),
      v: this.fach(z.v, "v"),
      theta: this.fach(z.theta, "theta"),
      omega: this.fach(z.omega, "omega"),
    };
    const F = this.faecher;
    const s = ((f.x * F.v + f.v) * F.theta + f.theta) * F.omega + f.omega;
    return { f, s };
  }

  besteAktion(s) {
    const q = this.q[s];
    if (q[0] === q[1]) {
      return Math.random() < 0.5 ? 0 : 1; // Gleichstand: Münzwurf
    }
    return q[1] > q[0] ? 1 : 0;
  }

  // ε-greedy. Liefert auch die Zufallszahl, damit man die Wahl nachvollziehen kann.
  waehle(s, eps) {
    const e = eps === undefined ? this.epsilon : eps;
    const zufall = Math.random();
    if (zufall < e) {
      return { a: Math.random() < 0.5 ? 0 : 1, zufall, erkunden: true };
    }
    return { a: this.besteAktion(s), zufall, erkunden: false };
  }

  // Der eigentliche Lernschritt. Gibt alle Zwischenwerte zurück (für die Erklärung).
  lernen(s, a, r, s2, gescheitert) {
    const alt = this.q[s][a];
    const maxNeu = gescheitert ? 0 : Math.max(this.q[s2][0], this.q[s2][1]);
    const ziel = r + (gescheitert ? 0 : this.gamma * maxNeu);
    const fehler = ziel - alt; // TD-Fehler: Überraschung
    const neu = alt + this.alpha * fehler;
    this.q[s][a] = neu;
    this.besuche[s]++;
    this.updates++;
    return { alt, maxNeu, ziel, fehler, neu, gescheitert, r, s, a, s2, alpha: this.alpha, gamma: this.gamma };
  }

  belohnung(gescheitert) {
    return gescheitert ? 1 + this.strafe : 1;
  }

  episodeBeendet(epsilonAbnehmend) {
    this.episoden++;
    if (epsilonAbnehmend) {
      this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonFaktor);
    }
  }

  besuchteZustaende() {
    let n = 0;
    for (const b of this.besuche) {
      if (b > 0) {
        n++;
      }
    }
    return n;
  }

  alsJSON() {
    return {
      typ: "q-tabelle-wagen-mit-stab",
      art: this.art,
      faecher: this.faecher,
      alpha: this.alpha,
      gamma: this.gamma,
      epsilon: this.epsilon,
      strafe: this.strafe,
      episoden: this.episoden,
      q: this.q.map((z) => [Number(z[0].toFixed(4)), Number(z[1].toFixed(4))]),
      besuche: this.besuche,
    };
  }

  ausJSON(d) {
    if (!d || d.typ !== "q-tabelle-wagen-mit-stab" || !ZUSTAENDE[d.art]) {
      throw new Error("Das ist keine Q-Tabelle aus diesem Programm.");
    }
    this.neuAufbauen(d.art);
    if (!Array.isArray(d.q) || d.q.length !== this.anzahl) {
      throw new Error("Die Tabelle passt nicht zu dieser Programmversion.");
    }
    this.q = d.q.map((z) => [Number(z[0]) || 0, Number(z[1]) || 0]);
    this.besuche = Array.isArray(d.besuche) ? d.besuche.map((b) => Number(b) || 0) : this.besuche;
    this.alpha = Number(d.alpha) || this.alpha;
    this.gamma = Number(d.gamma) || this.gamma;
    this.epsilon = typeof d.epsilon === "number" ? d.epsilon : this.epsilon;
    this.strafe = Number(d.strafe) || 0;
    this.episoden = Number(d.episoden) || 0;
  }
}
