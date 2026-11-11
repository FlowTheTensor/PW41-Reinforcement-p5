// =============================================================================
//  umgebung.js – Wagen mit Stab (Balancing Pole / CartPole), reines JavaScript
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
// =============================================================================

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

const AKTION_NAME = ["←", "→"];
const AKTION_TEXT = ["nach links", "nach rechts"];

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
    this.summe = 0; // Summe der Belohnungen in dieser Episode
    this.vorbei = false;
    this.grund = ""; // "umgefallen" | "bahn" | "geschafft"
    return this.zustand();
  }

  zustand() {
    return { x: this.x, v: this.v, theta: this.theta, omega: this.omega };
  }

  // Ein Zeitschritt. kraft: −1 (links), +1 (rechts) oder 0 (nur beim Selbststeuern)
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
    // "abgebrochen" heißt: wirklich gescheitert (nicht nur Zeit abgelaufen)
    const gescheitert = this.vorbei && this.grund !== "geschafft";
    return { zustand: this.zustand(), gescheitert, vorbei: this.vorbei };
  }

  // Stab anstupsen (Klick in die Umgebung)
  stups(staerke) {
    this.omega += staerke;
  }
}
