# KI balanciert · Reinforcement Learning

Ein Agent lernt, einen Stab auf einem Wagen zu balancieren – nur durch Ausprobieren und Belohnung. Er kennt weder die Physik noch die Regeln, er bekommt nur für jeden Zeitschritt, in dem der Stab noch steht, einen Punkt. Jeder Schritt des Q-Learnings lässt sich mit allen Zahlen und Formeln verfolgen.

Erstellt für den Unterricht an der Jakob-Preh-Schule ([bsnes.de](https://www.bsnes.de)).

**Live-Version:** [Hier direkt anschauen](https://flowthetensor.github.io/PW41-Reinforcement-p5/)

---

## Worum geht es?

Ein Wagen fährt auf einer Schiene, oben auf dem Wagen steht ein Stab mit einem Gelenk. Der Wagen kann in jedem Zeitschritt (0,02 s) nach links oder rechts geschoben werden. Ziel: Der Stab soll nicht umfallen und der Wagen nicht aus der Bahn fahren.

| Messwert | Bedeutung |
|---|---|
| x | Position des Wagens (−2,4 … +2,4 m) |
| v | Geschwindigkeit des Wagens |
| θ | Winkel des Stabs (umgefallen ab ±12°) |
| ω | Drehgeschwindigkeit des Stabs |

Die Physik ist dieselbe wie in der Python-Bibliothek Gymnasium (`CartPole-v1`): 10 N Schubkraft, Belohnung +1 je Schritt, nach 500 Schritten (10 Sekunden) ist die Episode geschafft.

Die Grundbegriffe des Reinforcement Learnings stecken alle in der Aufgabe:

| Begriff | hier |
|---|---|
| **Agent** | das Programm, das den Wagen schiebt |
| **Umgebung** | Wagen, Stab, Schiene und Physik |
| **Zustand s** | die Messwerte, in Fächer einsortiert |
| **Aktion a** | ← oder → schieben |
| **Belohnung r** | +1 für jeden Schritt, in dem der Stab steht |
| **Episode** | ein Versuch, vom Start bis zum Umfallen (höchstens 500 Schritte) |
| **Strategie (Policy)** | welche Aktion der Agent in welchem Zustand wählt |

## Bedienung

| Aktion | Wirkung |
|---|---|
| **→** oder „Schritt“ | ein Schritt des Agenten, mit „Phasen einzeln“ Phase für Phase |
| **Leertaste** | Start / Stopp (entspricht dem roten Knopf) |
| **← →** halten | Wagen selbst schieben (Modus „Selbst steuern“) |
| Klick neben den Stab | Stab anstupsen – fängt der Agent das ab? |
| Maus über der Q-Tabelle | Fächer und Q-Werte dieses Zustands |

**Modi**

- **Selbst steuern:** Erst einmal selbst probieren – mit ← und → (Zeitlupe unter „Tempo“). Die Schüler spüren, wie schwer die Aufgabe ist.
- **Zufall:** Ein Agent, der bei jedem Schritt eine Münze wirft. Er schafft im Mittel nur etwa 20 Schritte – der Vergleichswert.
- **Training:** Q-Learning. Schrittweise mit → oder automatisch für eine gewählte Zahl von Episoden.
- **Vorführen:** Der Agent nutzt nur noch sein Wissen (ε = 0) und lernt nicht dazu.

**Ein Schritt in vier Phasen** (Training, „Phasen einzeln“)

1. **Zustand beobachten:** Die Messwerte werden in Fächer einsortiert → eine Zelle der Q-Tabelle (rot umrandet).
2. **Aktion wählen (ε-greedy):** Zufallszahl < ε → zufällige Aktion (Erkunden), sonst die Aktion mit dem größeren Q-Wert (Wissen nutzen).
3. **Aktion ausführen:** Die Physik rechnet 0,02 s weiter. Neuer Zustand s' (gestrichelt) und Belohnung r.
4. **Q-Wert anpassen:** Q(s,a) ← Q(s,a) + α · (r + γ · max Q(s',·) − Q(s,a))

Rechts unten im Erklärfeld zeigt der Agentenkreislauf (Agent → Aktion → Umgebung → Zustand und Belohnung → Agent), welche Phase gerade dran ist.

**Die Q-Tabelle**

Für jeden Zustand gibt es zwei Zahlen: Q(s,←) und Q(s,→). Die Farbe zeigt die bessere Aktion (blau = ←, senf = →), die Farbstärke, wie viel besser sie ist. Leere, helle Zellen wurden noch nie besucht.

- **nur Stab (48 Zustände):** Winkel θ in 6 Fächer, Drehgeschwindigkeit ω in 8 Fächer. Die Tabelle ist groß genug, um alle Zahlen zu lesen.
- **Stab + Wagen (432 Zustände):** zusätzlich Position x und Geschwindigkeit v in je 3 Fächer. Die Tabelle wird in 3 × 3 Kacheln gezeigt (Wagen links/Mitte/rechts × fährt nach rechts/steht/fährt nach links).

**Einstellungen:** Lernrate α, Abzinsung γ, Erkundungsrate ε (nimmt nach jeder Episode um den Faktor 0,97 ab, bis 0,01), Episoden je Training, Zustand, Belohnung (mit oder ohne Strafe −100 beim Scheitern), Tempo (Zeitlupe, Echtzeit, schnell, Turbo). Q-Tabellen lassen sich als JSON speichern und wieder laden.

## Herleitung des Q-Learnings

### Was soll der Agent erreichen?

Der Agent soll möglichst viel Belohnung sammeln – nicht nur jetzt, sondern insgesamt. Spätere Belohnungen zählen etwas weniger, dafür sorgt der **Abzinsungsfaktor** γ (0 < γ < 1):

$$G_t = r_{t+1} + \gamma\, r_{t+2} + \gamma^2\, r_{t+3} + \dots$$

Bei γ = 0,99 zählt eine Belohnung in 100 Schritten noch etwa 37 %, bei γ = 0,5 fast gar nicht mehr.

### Was bedeutet ein Q-Wert?

$Q(s,a)$ ist die Schätzung des Agenten: *„Wie viel (abgezinste) Belohnung bekomme ich noch, wenn ich im Zustand $s$ die Aktion $a$ wähle und danach gut weiterspiele?“*

Kennt der Agent die richtigen Q-Werte, ist die beste Strategie einfach: in jedem Zustand die Aktion mit dem größten Q-Wert.

### Die Bellman-Gleichung

Die Gesamtbelohnung lässt sich in „jetzt“ und „danach“ zerlegen. Für die richtigen Q-Werte gilt deshalb:

$$Q(s,a) = r + \gamma \cdot \max_{a'} Q(s',a')$$

Wert jetzt = Belohnung jetzt + abgezinster Wert des besten nächsten Schritts.

### Die Lernregel

Der Agent kennt die richtigen Q-Werte nicht. Nach jedem Schritt vergleicht er seine Schätzung mit dem, was die Bellman-Gleichung mit dem gerade Erlebten ergibt:

$$\text{Ziel} = r + \gamma \cdot \max_{a'} Q(s',a') \qquad \text{Fehler} = \text{Ziel} - Q(s,a)$$

Der Fehler (TD-Fehler, „Überraschung“) wird nicht ganz, sondern nur zum Anteil α übernommen:

$$\boxed{Q(s,a) \leftarrow Q(s,a) + \alpha \cdot \bigl(r + \gamma \cdot \max_{a'} Q(s',a') - Q(s,a)\bigr)}$$

Ist die Episode gescheitert (Stab umgefallen oder Wagen aus der Bahn), kommt danach nichts mehr. Dann ist das Ziel nur $r$.

### Warum steht in der Tabelle oft fast 100?

Wenn der Stab dauerhaft steht, bekommt der Agent in jedem Schritt +1. Die abgezinste Summe ist eine geometrische Reihe:

$$1 + \gamma + \gamma^2 + \dots = \frac{1}{1-\gamma} = \frac{1}{1-0{,}99} = 100$$

Ein Q-Wert nahe 100 bedeutet also: „Von hier aus geht es lange gut.“ Ein kleiner Wert bedeutet: „Von hier aus fällt der Stab bald um.“

### Erkunden oder Wissen nutzen (ε-greedy)

Wählt der Agent immer nur die bisher beste Aktion, lernt er die andere nie kennen. Deshalb wählt er mit der Wahrscheinlichkeit ε eine zufällige Aktion. Am Anfang ist ε = 1 (nur ausprobieren), nach jeder Episode wird ε kleiner (· 0,97), bis der Agent fast nur noch sein Wissen nutzt.

### Warum Fächer?

Die Messwerte sind Kommazahlen, eine Tabelle braucht aber endlich viele Zeilen. Deshalb wird jeder Messwert in Fächer einsortiert (diskretisiert). Wenige Fächer: kleine Tabelle, schnelles Lernen, aber grob. Viele Fächer: genauer, aber jeder Zustand wird seltener besucht und das Lernen dauert länger. Für große oder stetige Zustandsräume ersetzt man die Tabelle durch ein **neuronales Netz**, das die Q-Werte schätzt (Deep Q-Learning, DQN) – siehe PW9.

## Ideen für den Unterricht

- **Erst selbst steuern:** Wer schafft 500 Schritte? Mit und ohne Zeitlupe. Was ist schwierig?
- **Zufall als Vergleich:** Wie lange hält der Stab bei Münzwurf? (etwa 20 Schritte)
- **Einen Schritt von Hand nachrechnen:** Mit „Phasen einzeln“ jede Phase mit Taschenrechner nachvollziehen.
- **Training beobachten:** Wann färbt sich die Q-Tabelle? Warum sind die Zellen in der Mitte zuerst gefärbt? Warum zeigt die Lernkurve so starke Schwankungen?
- **Strategie ablesen:** In welchen Zellen ist ← besser, in welchen →? Passt das zur Physik? (Stab kippt nach rechts → Wagen nach rechts schieben)
- **Der Agent sieht nicht alles:** Mit „nur Stab“ balanciert der Agent oft gut, fährt aber manchmal aus der Bahn. Warum? Mit „Stab + Wagen“ und „Strafe −100“ (1000 Episoden) klappt es zuverlässig.
- **Belohnung gestalten:** Was ändert die Strafe −100 an den Q-Werten? Warum hilft sie?
- **Parameter variieren:** α = 0,01 oder α = 1? γ = 0,5? ε immer 1 oder immer 0? Was passiert jeweils?
- **Robustheit:** Beim Vorführen den Stab anstupsen. Wie stark darf der Stups sein?
- **Zufall:** Zwei Trainings mit denselben Einstellungen sind nie gleich. Warum?

## Vergleich mit dem Python-Beispiel

Im Python-Beispiel (Gymnasium + Stable-Baselines3) wird dieselbe Umgebung mit **PPO** und einem neuronalen Netz gelöst:

```python
env = gym.make("CartPole-v1")
model = PPO("MlpPolicy", env, verbose=1)
model.learn(total_timesteps=20000)
```

Das ist kurz und leistungsfähig, aber das Lernen bleibt eine Blackbox. Hier wird stattdessen **tabellarisches Q-Learning** verwendet: weniger leistungsfähig, aber jede Zahl ist sichtbar und nachrechenbar. Gleich bleiben Umgebung, Zustand, Aktionen, Belohnung und Episodenende – die Python-Variante eignet sich deshalb gut als nächster Schritt.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Seite, bindet Schriften, p5.js und die Skripte ein |
| `style.css` | Gestaltung im Corporate Design der Schule |
| `umgebung.js` | Wagen mit Stab – Physik wie Gymnasium CartPole-v1, reines JavaScript |
| `agent.js` | Q-Learning mit Tabelle – reines JavaScript, ohne p5 |
| `ui.js` | Knöpfe, Auswahllisten, Regler |
| `sketch.js` | Ablauf, Zeichnen, Erklärtexte |
| `assets/logo-jps.png` | Logo der Jakob-Preh-Schule |
| `libraries/p5.min.js` | p5.js (lokal, damit die Seite auch offline läuft) |

## Lokal starten

Am einfachsten in VS Code mit der Erweiterung **Live Server**: Rechtsklick auf `index.html` → „Open with Live Server“.

## Technische Hinweise

- Läuft mit **p5.js 1.x** (lokal mitgeliefert: 1.10) und **p5.js 2.x**. Dafür verzichtet der Code bewusst auf Funktionen, die sich zwischen den Versionen geändert haben (z. B. `preload`, `loadFont`).
- Die Schriften (Quicksand, Inter, JetBrains Mono) kommen von Google Fonts. Ohne Internet weicht die Seite automatisch auf Systemschriften aus.
- Alle Schleifen haben geschweifte Klammern: Der p5-Web-Editor baut in Schleifen eine Endlosschleifen-Sicherung ein, die bei Schleifen ohne Klammern fehlschlägt.
- Fehler in `draw()` werden abgefangen und als Hinweis angezeigt, statt das Programm einzufrieren.
- Physik: explizites Euler-Verfahren mit Δt = 0,02 s, Startzustand zufällig in ±0,05 (wie Gymnasium). Im Modus „Selbst steuern“ gibt es zusätzlich „keine Kraft“, wenn keine Taste gedrückt ist.
- Getestet: Mit den Voreinstellungen („nur Stab“, 300 Episoden) erreicht der Agent in etwa drei von fünf Trainings 500 Schritte. Mit „Stab + Wagen“, „Strafe −100“ und 1000 Episoden fast immer.
