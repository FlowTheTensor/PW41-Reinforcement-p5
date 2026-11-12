# KI lernt · Reinforcement Learning

Ein Agent lernt eine Aufgabe – nur durch Ausprobieren und Belohnung. Er kennt weder die Physik noch die Regeln, er bekommt nur Belohnungen und Strafen. Jeder Schritt des Q-Learnings lässt sich mit allen Zahlen und Formeln verfolgen.

Die Aufgabe wird in der roten **Beispiel-Leiste** unter der Kopfzeile gewählt. Beim Start ist die Sortierstation eingestellt.

| Aufgabe | Worum geht es? | Zustände × Aktionen | Schwerpunkt |
|---|---|---|---|
| **Sortierstation** | Werkstücke nach Sensorsignalen in Rutschen sortieren | 8 bzw. 32 × 4 | sofortige Belohnung, Timing, Sensorstörungen |
| **Wagen mit Stab** | Stab balancieren (CartPole) | 48 bzw. 432 × 2 | Messwerte in Fächer einsortieren, Regelung |
| **Wartung Bearbeitungsstation** | produzieren oder warten? (Predictive Maintenance) | 14 × 2 | Abzinsung γ: kurzsichtig gegen weitsichtig |
| **Hochregallager** | ankommende Teile nah oder fern einlagern | 60 × 2 | verzögerte Folgen, ABC-Strategie |

Die drei Industrie-Aufgaben orientieren sich an den Stationen einer Industrie-4.0-Modellanlage. Die gelernte Strategie lässt sich als SCL-Code für die SPS ausgeben (siehe [Von der Simulation in die Anlage](#von-der-simulation-in-die-anlage)).

Erstellt für den Unterricht an der Jakob-Preh-Schule ([bsnes.de](https://www.bsnes.de)).

**Live-Version:** [Hier direkt anschauen](https://flowthetensor.github.io/PW41-Reinforcement-p5/)

---

## Wagen mit Stab: Worum geht es?

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

**Einstellungen:** Lernrate α, Abzinsung γ, Erkundungsrate ε (nimmt nach jeder Episode um einen Faktor ab, bis 0,01 – beim Wagen 0,97), Episoden je Training, Zustand, Belohnung (mit oder ohne Strafe −100 beim Scheitern), Tempo (Zeitlupe, Echtzeit, schnell, Turbo). Q-Tabellen lassen sich als JSON speichern und wieder laden. Jede Aufgabe behält ihre Q-Tabelle und Lernkurve, wenn man zwischen den Aufgaben wechselt.

## Industrie-Aufgaben

Bedienung, die vier Phasen, Q-Tabelle, Lernkurve und Agentenkreislauf sind bei allen Aufgaben gleich – nur die Umgebung wechselt. Bei „Selbst steuern“ entscheiden die Schüler mit den Zifferntasten 1–4 oder mit den Knöpfen unter der Anlage.

Alle Modelle wurden vorher per Wertiteration durchgerechnet. Die Zahlen unten stammen aus diesen Rechnungen und aus Testtrainings mit den Voreinstellungen.

### Sortierstation

Werkstücke kommen auf dem Band an: rot oder schwarz (Kunststoff) oder silber (Metall), 15 % davon sind fehlerhaft (zu niedrig). Der Agent sieht **nicht das Werkstück**, sondern nur drei Sensorsignale:

| Sensor | 1 bedeutet |
|---|---|
| induktiv | Metall erkannt |
| optisch | hell (rot oder silber) |
| Höhe | Höhe in Ordnung |

| Belohnung | |
|---|---|
| richtig einsortiert | +1 |
| Gutteil in falscher Rutsche | −1 |
| Gutteil im Ausschuss (verschrottet) | −2 |
| Fehlteil in einer Gut-Rutsche (Reklamation) | −5 |

- **nur Sensoren (8 Zustände):** Aktionen Rutsche 1 (Metall), 2 (rot), 3 (schwarz), Ausschuss. Jedes Werkstück ist ein abgeschlossener Fall: Das Ziel ist nur r, γ spielt keine Rolle. Ein guter Einstieg, weil jeder Q-Wert einfach die mittlere Belohnung ist. Nach 100 Chargen sortiert der Agent in der Regel 100 % richtig, der Zufall etwa 25 %.
- **mit Bandposition (32 Zustände):** Das Band läuft. Aktionen: warten, Zylinder 1, 2, 3. Fährt ein Zylinder ins Leere, kostet das Druckluft (−0,2). Die Belohnung kommt erst, wenn das Werkstück angekommen ist – in der Q-Tabelle sieht man, wie die Werte von rechts („vor Zylinder 3“) nach links („nach den Sensoren“) wandern. Beim Selbststeuern ist Timing gefragt.
- **Sensoren:** Mit „optischer Sensor irrt 10 %“ bleibt auch der beste Agent bei etwa 94 % – manche Fehler kann keine Strategie verhindern. Zwei Sensorkombinationen (Metall + dunkel) kommen ohne Störung gar nicht vor und bleiben in der Tabelle leer.
- Eine Episode ist eine Charge mit 20 Werkstücken. Die Lernkurve zeigt, wie viel Prozent richtig sortiert wurden.

### Wartung der Bearbeitungsstation

Eine Bohrstation produziert Takt für Takt und verschleißt dabei. Ein Schwingungssensor meldet die Verschleißstufe.

| | |
|---|---|
| Zustand | Verschleiß 0–5 oder „defekt“ × Auftragslage wenig/viel (14 Zustände) |
| produzieren | +10 € (wenig Aufträge) bzw. +20 € (viele). Verschleiß steigt mit 40 % um eine Stufe. Ausfallrisiko je Stufe 0 / 0 / 3 / 8 / 20 / 40 % |
| Ausfall | −30 € Reparatur, danach Stillstand ohne Gewinn (im Mittel 5 Takte) |
| warten | −10 € (Techniker, ein Takt ohne Produktion), Verschleiß zurück auf 0 |
| Episode | eine Schicht mit 50 Takten. Die Auftragslage wechselt in jedem Takt mit 20 % |

Der Kern ist die **Abzinsung γ**. Der Ausfall selbst kostet nur 30 €, teuer ist der Stillstand danach – und den „sieht“ nur ein Agent, der vorausschaut:

| Strategie | Gewinn je Schicht |
|---|---|
| Zufall | ≈ 120 € |
| nie warten | ≈ 434 € |
| γ = 0 (kurzsichtig): wartet höchstens bei Stufe 5 | ≈ 480–510 € |
| γ = 0,9: wartet ab Stufe 3 bei wenig Aufträgen, ab Stufe 4 bei vielen | ≈ 550–575 € |

Der weitsichtige Agent legt die Wartung bevorzugt in Zeiten mit wenig Aufträgen – das hat ihm niemand gesagt. Stufe 5 bleibt in der Tabelle oft leer, weil der Agent vorher wartet.

### Hochregallager

Teile kommen am Übergabeplatz an. Neben dem Übergabeplatz gibt es nur **3 nahe Plätze** (2 s Fahrzeit für Ein- und Auslagern), der Rest des Regals ist fern (8 s).

| Klasse | kommt an | wird ausgelagert (je Takt) |
|---|---|---|
| A – Schnelldreher | 50 % | 30 % |
| B – Mitteldreher | 30 % | 10 % |
| C – Langsamdreher | 20 % | 3 % |

- Zustand: Klasse des ankommenden Teils × Belegung der nahen Plätze (wie viele A, B, C liegen dort?) → 60 Zustände. Die fernen Plätze sieht der Agent nicht.
- Aktionen: nah oder fern einlagern. Ist nah voll, geht es automatisch fern.
- Belohnung: −Fahrzeit. Jedes Teil wird genau einmal ausgelagert, deshalb wird die Fahrzeit für Ein- und Auslagern gleich beim Einlagern verbucht.
- Episode: eine Schicht mit 50 Einlagerungen. Die Lernkurve zeigt die Fahrzeit – hier ist **weniger besser**.

Kurzfristig ist „nah“ immer besser. Ein C-Teil blockiert einen nahen Platz aber sehr lange, dann muss manches A-Teil fern liegen. Das merkt nur ein Agent mit großem γ:

| Strategie | Fahrzeit je Schicht |
|---|---|
| Zufall | ≈ 310 s |
| γ = 0,5: alles nah, solange frei | ≈ 290 s |
| γ = 0,95: A nah, C fern, B je nach Belegung (ABC-Strategie) | ≈ 245–255 s (bestmöglich ≈ 244 s) |

Die Aufgabe braucht mehr Training (Voreinstellung 2000 Episoden, ε nimmt langsamer ab: · 0,995) – mit „Turbo“ etwa eine halbe Minute.

### Von der Simulation in die Anlage

An der echten Anlage zu lernen, wäre zu teuer: tausende Versuche, Ausschuss, Verschleiß, Ausfälle. Deshalb trainiert man in der **Simulation** (einem Modell der Anlage, „digitaler Zwilling“) und überträgt nur das Ergebnis.

Nach dem Training ist die Strategie nur noch eine Nachschlagetabelle. Der Knopf **„SPS-Export“** (oben in der Q-Tabelle, bei den Industrie-Aufgaben) erzeugt daraus einen SCL-Baustein (TIA Portal, IEC 61131-3 Structured Text): Aus den Eingängen wird die Zustandsnummer berechnet, eine `CASE`-Anweisung liefert die Aktion. Nie besuchte Zustände bekommen eine sichere Vorgabe (z. B. Ausschuss).

Der Code ist ein Vorschlag für den Unterricht und wurde nicht an einer echten SPS getestet: Variablennamen, Datentypen und die Erfassung der Eingänge (z. B. Bandposition, Klasse über RFID) müssen an die eigene Anlage angepasst werden.

Gesprächsanlässe: Was passiert, wenn die echte Anlage anders ist als das Modell (andere Ausfallraten, neuer Werkstücktyp)? Wer haftet für eine gelernte Strategie? Warum ist eine Tabelle für die SPS leichter zu prüfen als ein neuronales Netz?

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

Wählt der Agent immer nur die bisher beste Aktion, lernt er die andere nie kennen. Deshalb wählt er mit der Wahrscheinlichkeit ε eine zufällige Aktion. Am Anfang ist ε = 1 (nur ausprobieren), nach jeder Episode wird ε kleiner (· 0,97, beim Hochregallager · 0,995), bis der Agent fast nur noch sein Wissen nutzt.

### Episode vorbei oder abgeschlossen?

Zwei Dinge werden unterschieden:

- **abgeschlossen (terminal):** Nach diesem Schritt kommt nichts mehr, das von der Entscheidung abhängt – der Stab ist umgefallen, das Werkstück ist einsortiert. Dann ist das Ziel nur r.
- **Episode vorbei:** Die Lernkurve bekommt einen Punkt (500 Schritte geschafft, Charge fertig, Schichtende). Bei Wartung und Lager ist das Schichtende kein echtes Ende – die Anlage läuft morgen weiter. Deshalb rechnet der Agent dort auch im letzten Takt mit γ · max Q(s',·) weiter.

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

### Industrie-Aufgaben im Unterricht

- **Sortierstation, erst selbst:** Die Schüler sortieren selbst und sehen das Werkstück – der Agent sieht nur drei Bits. Woher soll er wissen, welche Rutsche wofür ist?
- **Q-Wert = mittlere Belohnung:** In der Variante „nur Sensoren“ nach wenigen Chargen ablesen: Warum steht beim Fehlteil in den Gut-Rutschen etwa −5? Warum ändert γ hier nichts?
- **Sensorstörung:** Mit „optischer Sensor irrt 10 %“ trainieren. Warum schafft der Agent keine 100 % mehr? Welche Sensorkombinationen tauchen plötzlich auf?
- **Timing:** In der Variante „mit Bandposition“ selbst steuern (Zeitlupe!), dann trainieren. In welcher Reihenfolge färben sich die Spalten? Was passiert mit γ = 0?
- **Wartung mit γ = 0 und γ = 0,9:** Zweimal trainieren und die Tabellen vergleichen. Ab welcher Stufe wird gewartet? Warum wartet der weitsichtige Agent lieber bei wenig Aufträgen?
- **Hochregallager:** Selbst einlagern – wer schafft weniger als 260 s? Dann mit γ = 0,5 und γ = 0,95 trainieren und die ABC-Strategie aus der Tabelle ablesen.
- **SPS-Export:** Den SCL-Code lesen: Wo steht die Zustandsnummer, wo die Strategie? Was müsste an der echten Anlage noch erfasst werden?

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
| `agent.js` | Q-Learning mit Tabelle – reines JavaScript, ohne p5, kennt die Aufgabe nicht |
| `ui.js` | Knöpfe, Auswahllisten, Regler, Fenster für den SPS-Export |
| `sketch.js` | Ablauf, Phasen, Lernkurve, Q-Tabelle, Erklärung, SCL-Export (für alle Aufgaben gleich) |
| `szenarien/wagen.js` | Wagen mit Stab – Physik wie Gymnasium CartPole-v1 |
| `szenarien/sortieren.js` | Sortierstation |
| `szenarien/wartung.js` | Wartung der Bearbeitungsstation |
| `szenarien/lager.js` | Hochregallager |
| `assets/logo-jps.png` | Logo der Jakob-Preh-Schule |
| `libraries/p5.min.js` | p5.js (lokal, damit die Seite auch offline läuft) |

## Beispiel-Leiste (gemeinsames Schema für alle PW-Programme)

Damit sich alle Programme der Reihe gleich bedienen lassen, wird das Beispiel überall gleich gewählt:

| Element | Festlegung |
|---|---|
| Ort | eigene Leiste direkt unter der Kopfzeile, über die ganze Breite, 48 px hoch (logisches Raster), der restliche Inhalt rutscht um 48 px nach unten |
| Hintergrund | Hellrot `#fdf0f2`, unten eine feine Linie `#f0c8d0` |
| Beschriftung | links „Beispiel ›“ in Schul-Rot `#c81e3a`, Quicksand fett, 15 px |
| Reiter | ein Knopf je Beispiel, nebeneinander, Text „1 · Name“, „2 · Name“ …, Pillenform, 1,5 px roter Rand, rote Schrift auf Weiß |
| aktives Beispiel | Reiter rot gefüllt, weiße Schrift, leichter Schatten |
| Verhalten | ein Klick wechselt das Beispiel; während ein Lauf/Training läuft, sind die anderen Reiter gesperrt; jedes Beispiel behält seinen Stand |
| Reihenfolge | das erste Beispiel ist beim Start aktiv |

Umsetzung hier: Reiter in `ui.js` (Klasse `beispiel`), Leiste in `zeichneBeispielLeiste()` in `sketch.js`, Stil am Ende von `style.css`.

## Lokal starten

Am einfachsten in VS Code mit der Erweiterung **Live Server**: Rechtsklick auf `index.html` → „Open with Live Server“.

## Technische Hinweise

- Läuft mit **p5.js 1.x** (lokal mitgeliefert: 1.10) und **p5.js 2.x**. Dafür verzichtet der Code bewusst auf Funktionen, die sich zwischen den Versionen geändert haben (z. B. `preload`, `loadFont`).
- Die Schriften (Quicksand, Inter, JetBrains Mono) kommen von Google Fonts. Ohne Internet weicht die Seite automatisch auf Systemschriften aus.
- Alle Schleifen haben geschweifte Klammern: Der p5-Web-Editor baut in Schleifen eine Endlosschleifen-Sicherung ein, die bei Schleifen ohne Klammern fehlschlägt.
- Fehler in `draw()` werden abgefangen und als Hinweis angezeigt, statt das Programm einzufrieren.
- Physik: explizites Euler-Verfahren mit Δt = 0,02 s, Startzustand zufällig in ±0,05 (wie Gymnasium). Im Modus „Selbst steuern“ gibt es zusätzlich „keine Kraft“, wenn keine Taste gedrückt ist.
- Getestet: Mit den Voreinstellungen („nur Stab“, 300 Episoden) erreicht der Agent in etwa drei von fünf Trainings 500 Schritte. Mit „Stab + Wagen“, „Strafe −100“ und 1000 Episoden fast immer.
- Neue Aufgabe hinzufügen: eine Datei in `szenarien/` anlegen, die `szenarioRegistrieren({...})` aufruft (Aufbau siehe Kopf von `sketch.js` und `szenarien/wagen.js`), und in `index.html` einbinden. Jede Datei ist in eine Funktion eingeschlossen, damit sich Namen nicht in die Quere kommen.
- Industrie-Aufgaben getestet: Lernen mit den Voreinstellungen – Sortierstation 100 % (beide Varianten), Wartung ≈ 550–575 € je Schicht, Hochregallager ≈ 245–255 s je Schicht.
- Ältere Q-Tabellen (Wagen mit Stab, erste Programmversion) lassen sich weiterhin laden.
