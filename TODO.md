# TODO · Industrie-Beispiele für Reinforcement Learning

Ziel: Neben „Wagen mit Stab“ drei Aufgaben aus dem Umfeld der Industrie-4.0-Modellanlage (ETS),
wählbar auf derselben Seite. Bedienung, vier Phasen, Q-Tabelle, Lernkurve und Agentenkreislauf
bleiben gleich – nur die Umgebung wechselt.

Leitgedanke **Sim-to-Real**: Trainiert wird in der Simulation (an der echten Anlage wären
tausende Versuche zu teuer: Ausschuss, Verschleiß, Zeit). Die fertige Strategie ist nur
eine Nachschlagetabelle und kann als SCL-Code in die SPS übernommen werden.

## 1 · Umbau: Szenario-Schnittstelle
- [x] `agent.js` allgemein: Q-Tabelle mit beliebig vielen Zuständen und Aktionen
- [x] Szenario-Schnittstelle: Umgebung, Einordnung, Aktionen, Belohnung, Zeichnen, Texte, Lernkurve
- [x] `szenarien/wagen.js`: bisheriges CartPole in die Schnittstelle verschieben (Verhalten unverändert)
- [x] `sketch.js`: Ablauf, Phasen, Lernkurve, Erklärung, Q-Tabelle allgemein
- [x] Unterschied „Episode vorbei“ (Lernkurve) und „terminal“ (kein Blick in die Zukunft)
- [x] Auswahl der Aufgabe in der Kopfzeile, Optionen (Zustand/Belohnung) je Aufgabe
- [x] „Selbst steuern“ bei diskreten Aufgaben: Aktions-Knöpfe und Tasten 1–4

## 2 · Sortierstation
- Werkstücke: rot, schwarz (Kunststoff), silber (Metall), jeweils ggf. fehlerhaft (zu niedrig)
- Sensoren: induktiv (Metall), optisch (hell/dunkel), Höhe (ok/zu niedrig) → 8 Zustände
- Aktionen: Rutsche 1 (Metall), 2 (rot), 3 (schwarz), Bandende (Ausschuss)
- Belohnung: richtig +1, falsche Rutsche −1, Fehlteil in Gut-Rutsche −5, Gutteil in Ausschuss −2
- [x] Variante „nur Sensoren“: jedes Teil ist ein abgeschlossener Fall (Ziel = r, γ spielt keine Rolle)
- [x] Variante „mit Bandposition“: Agent muss den Zylinder im richtigen Moment auslösen (verzögerte Belohnung)
- [x] Option: Sensor-Störungen (optischer Sensor irrt sich in 10 %)
- [x] Zeichnung: Band, Sensoren, drei Zylinder mit Rutschen, Ausschussbehälter
- [x] Lernkurve: Punkte je Charge (20 Teile)

## 3 · Wartung der Bearbeitungsstation (Predictive Maintenance)
- Zustand: Verschleiß 0–5 (Schwingungssensor) oder „defekt“ × Auftragslage niedrig/hoch → 14 Zustände
- Aktionen: produzieren / warten
- Produzieren: +10 € (niedrig) bzw. +20 € (hoch), Verschleiß steigt mit 40 %,
  Ausfall mit 0 / 0 / 3 / 8 / 20 / 40 % → −30 € und Stillstand (Reparatur im Mittel 5 Takte)
- Warten: −10 €, Verschleiß auf 0
- Schicht = 50 Takte. Geprüft per Wertiteration: γ = 0 → nie warten (≈ 434 €),
  γ = 0,9 → warten ab Stufe 3 (niedrig) bzw. 4 (hoch), ≈ 575 €; Zufall ≈ 118 €
- [x] Umgebung, Zeichnung (Maschine, Verschleißanzeige, Auftragslage, Zeitleiste), Texte

## 4 · Hochregallager: Einlagerstrategie
- Zustand: Klasse des ankommenden Teils (A/B/C) × Belegung der 3 nahen Plätze → 60 Zustände
- Aktionen: nah einlagern / fern einlagern
- Fahrzeit (Ein- + Auslagern): nah 2 s, fern 8 s. Ankunft A 50 %, B 30 %, C 20 %;
  Auslagern je Takt: A 30 %, B 10 %, C 3 %
- Geprüft per Wertiteration: γ klein → alles nah (≈ 291 s je Schicht),
  γ = 0,95 → ABC-Strategie (≈ 244 s); Zufall ≈ 309 s
- Training: α = 0,1, ε · 0,995 je Episode, 2000 Episoden (sonst hört der Agent zu früh auf zu erkunden)
- [x] Umgebung, Zeichnung (Regal mit Übergabeplatz, Regalbediengerät), Texte

## 5 · Brücke zur echten Anlage
- [x] „SPS-Export“: beste Aktion je Zustand als SCL-Code (CASE-Anweisung) mit Kommentaren
- [x] Erklärtext Sim-to-Real in jeder Industrie-Aufgabe

## 6 · Abschluss
- [x] Alle Aufgaben durchtesten (Training, Vorführen, Zufall, Selbst, Phasen einzeln, Laden/Speichern)
- [x] README ergänzen (Aufgaben, Unterrichtsideen, Export)

## Offen / Ideen für später
- [ ] SCL-Export an einer echten SPS (TIA Portal) ausprobieren und Variablennamen an die ETS-Anlage anpassen
- [ ] Mit Schülern im Unterricht testen: Sind die Texte verständlich, reichen die Zeiten?
- [ ] evtl. feste Vergleichsregeln (z. B. „warten ab Stufe 3“) als zusätzlichen Modus
