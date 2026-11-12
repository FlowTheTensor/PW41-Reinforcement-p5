// =============================================================================
//  agent.js – Q-Learning mit einer Tabelle (ohne p5, reines JavaScript)
// =============================================================================
//  1. Zustand beobachten   Die Messwerte werden eingeordnet → eine Zeile s
//                          der Q-Tabelle.
//  2. Aktion wählen        ε-greedy: mit Wahrscheinlichkeit ε zufällig
//                          (Erkunden), sonst die Aktion mit dem größten Q-Wert.
//  3. Aktion ausführen     Die Umgebung liefert den neuen Zustand s' und die
//                          Belohnung r.
//  4. Q-Wert anpassen      Q(s,a) ← Q(s,a) + α · (r + γ · max Q(s',·) − Q(s,a))
//
//  Q(s,a) ist die Schätzung: "Wie viel Belohnung bekomme ich insgesamt noch,
//  wenn ich im Zustand s die Aktion a wähle und danach gut weiterspiele?"
//
//  Der Agent weiß nichts über die Aufgabe: Er kennt nur die Anzahl der
//  Zustände und Aktionen. Was ein Zustand bedeutet, steht im Szenario.
// =============================================================================

class QAgent {
  constructor(anzahl, aktionen) {
    this.alpha = 0.2; // Lernrate
    this.gamma = 0.99; // Abzinsung: wie wichtig ist die Zukunft?
    this.epsilon = 1.0; // Anteil zufälliger Aktionen
    this.epsilonMin = 0.01;
    this.epsilonFaktor = 0.97; // ε wird nach jeder Episode damit multipliziert
    this.neuAufbauen(anzahl || 1, aktionen || 2);
  }

  neuAufbauen(anzahl, aktionen) {
    this.anzahl = anzahl;
    this.nA = aktionen;
    this.q = [];
    this.besuche = [];
    for (let s = 0; s < anzahl; s++) {
      this.q.push(new Array(aktionen).fill(0));
      this.besuche.push(0);
    }
    this.episoden = 0;
    this.updates = 0;
  }

  maxQ(s) {
    return Math.max(...this.q[s]);
  }

  // Aktion mit dem größten Q-Wert; bei Gleichstand entscheidet der Zufall
  besteAktion(s) {
    const q = this.q[s];
    const m = Math.max(...q);
    const kandidaten = [];
    for (let a = 0; a < q.length; a++) {
      if (q[a] === m) {
        kandidaten.push(a);
      }
    }
    return kandidaten[Math.floor(Math.random() * kandidaten.length)];
  }

  // ε-greedy. Liefert auch die Zufallszahl, damit man die Wahl nachvollziehen kann.
  waehle(s, eps) {
    const e = eps === undefined ? this.epsilon : eps;
    const zufall = Math.random();
    if (zufall < e) {
      return { a: Math.floor(Math.random() * this.nA), zufall, erkunden: true };
    }
    return { a: this.besteAktion(s), zufall, erkunden: false };
  }

  // Der eigentliche Lernschritt. Gibt alle Zwischenwerte zurück (für die Erklärung).
  // terminal: Nach diesem Schritt kommt nichts mehr, das von dieser Entscheidung
  // abhängt (Stab umgefallen, Werkstück einsortiert …) → Ziel = r.
  lernen(s, a, r, s2, terminal) {
    const alt = this.q[s][a];
    const maxNeu = terminal ? 0 : this.maxQ(s2);
    const ziel = r + (terminal ? 0 : this.gamma * maxNeu);
    const fehler = ziel - alt; // TD-Fehler: Überraschung
    const neu = alt + this.alpha * fehler;
    this.q[s][a] = neu;
    this.besuche[s]++;
    this.updates++;
    return { alt, maxNeu, ziel, fehler, neu, terminal, r, s, a, s2, alpha: this.alpha, gamma: this.gamma };
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

  alsJSON(szenario, einstellung) {
    return {
      typ: "q-tabelle",
      szenario,
      einstellung,
      alpha: this.alpha,
      gamma: this.gamma,
      epsilon: this.epsilon,
      episoden: this.episoden,
      q: this.q.map((z) => z.map((v) => Number(v.toFixed(4)))),
      besuche: this.besuche,
    };
  }

  // Werte aus einer Datei übernehmen (Größe muss vorher passend aufgebaut sein)
  ausJSON(d) {
    if (!Array.isArray(d.q) || d.q.length !== this.anzahl || !d.q.every((z) => Array.isArray(z) && z.length === this.nA)) {
      throw new Error("Die Tabelle passt nicht zu dieser Aufgabe.");
    }
    this.q = d.q.map((z) => z.map((v) => Number(v) || 0));
    this.besuche = Array.isArray(d.besuche) && d.besuche.length === this.anzahl ? d.besuche.map((b) => Number(b) || 0) : this.besuche;
    this.alpha = Number(d.alpha) || this.alpha;
    this.gamma = typeof d.gamma === "number" ? d.gamma : this.gamma;
    this.epsilon = typeof d.epsilon === "number" ? d.epsilon : this.epsilon;
    this.episoden = Number(d.episoden) || 0;
  }
}
