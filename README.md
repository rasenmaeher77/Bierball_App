# Bierball Zähler

Spielstand-Zähler für Bierball als iPhone-Web-App (HTML, CSS, JavaScript, keine Frameworks).
Vier Zähler: gewonnene Runden (oben) und Ausgleichsrunden (unten, blasser), je für Alma und Max.
Der Stand liegt in Firebase Firestore, ist auf allen Geräten gleich und aktualisiert sich live.

Mit „+“ zählt man hoch. Der Einstellungsknopf unten schaltet den Korrekturmodus ein: Die Knöpfe
werden rot und ziehen 1 ab, zum Beispiel nach einem Verklicken. Die Security Rules auf dem Server
erlauben pro Klick nur genau +1 oder −1 und nie Werte unter 0. Direkt auf einen beliebigen Wert
setzen oder löschen kann man nichts.

| Datei / Ordner         | Zweck                                                   |
|------------------------|---------------------------------------------------------|
| `index.html`           | Überschrift, vier Zähler, Einstellungsknopf             |
| `css/style.css`        | Grundstil, Safe-Areas, Dark Mode, Zähler                |
| `js/app.js`            | Service Worker, Firebase-Config, Zähler-Logik           |
| `firestore.rules`      | Security Rules (in der Firebase-Konsole einfügen)       |
| `manifest.webmanifest` | Name, Icon und Farben auf dem Home-Bildschirm           |
| `sw.js`                | Service Worker; neue Dateien in `FILES` eintragen       |
| `icons/`               | App-Icons (180, 192, 512 px)                            |
| `Schriftarten/`        | „Anton“ für die Überschrift (Lizenz: `Anton-OFL.txt`)   |

## Firebase einrichten

1. **Projekt anlegen:** <https://console.firebase.google.com> → „Projekt hinzufügen“ → Name z. B. `bierball-zaehler`.
   Google Analytics wird nicht gebraucht. Das Projekt läuft im kostenlosen Spark-Tarif.
2. **Web-App registrieren:** Projektübersicht → Symbol `</>` („Web“) → Spitzname z. B. `Bierball Zähler`.
   Firebase Hosting **nicht** anhaken (die App liegt auf GitHub Pages).
   Das angezeigte `firebaseConfig`-Objekt in `js/app.js` bei `FIREBASE_CONFIG` einfügen.
   Du findest es später auch unter Projekteinstellungen → Allgemein → Meine Apps.
3. **Firestore aktivieren:** Menü „Build“ → „Firestore Database“ → „Datenbank erstellen“.
   - Edition: Standard, Datenbank-ID `(default)` lassen (nur diese ist kostenlos)
   - Standort: z. B. `eur3 (Europe)` oder `europe-west3 (Frankfurt)`. Er lässt sich später nicht ändern.
   - Im **Produktionsmodus** starten (alles gesperrt, bis die Rules drin sind)
4. **Startdokument anlegen:** Reiter „Daten“ → „Sammlung starten“
   - Sammlungs-ID: `zaehler`
   - Dokument-ID: `haupt` (nicht automatisch generieren lassen)
   - Felder: keine nötig (ein leeres Dokument reicht). Die Zähler `rundenLinks`, `rundenRechts`,
     `ausgleichLinks` und `ausgleichRechts` gelten als 0, bis zum ersten Mal geklickt wird.

   Die Sammlung `klicks` legt die App beim ersten Klick selbst an. Sie protokolliert jeden Klick
   mit Serverzeit, Feld und Schritt (+1/−1). „Links“ ist Alma, „Rechts“ ist Max.
5. **Rules einfügen:** Reiter „Regeln“ → Inhalt komplett durch `firestore.rules` ersetzen → „Veröffentlichen“.
   Es dauert bis zu einer Minute, bis die Rules greifen.
6. **Veröffentlichen:** Änderungen auf GitHub pushen. Die App auf dem iPhone einmal mit Internet öffnen,
   danach funktioniert sie auch offline.

Als Admin kannst du in der Firebase-Konsole weiterhin alles ändern, zum Beispiel den Zähler korrigieren.
Die Konsole ist nicht an die Rules gebunden.

### Optional: API-Key auf die eigene Domain beschränken

In der [Google Cloud Console](https://console.cloud.google.com/apis/credentials) das Projekt wählen und
den „Browser key“ öffnen. Unter „Website-Einschränkungen“ `https://rasenmaeher77.github.io/*` eintragen,
zum lokalen Testen zusätzlich `http://localhost:*/*`. Das hält Fremde davon ab, deinen Key bequem in
eigenen Seiten zu benutzen. Ein echter Schutz ist es nicht, denn den Referer kann man fälschen.
Den eigentlichen Schutz liefern die Rules.

## Testen, dass Manipulationen abgelehnt werden

**In der Browser-Konsole** (App öffnen → Entwicklertools → Konsole; am iPhone über Safari am Mac → Entwickler):

```js
const fs = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js");
const ref = fs.doc(fs.getFirestore(), "zaehler", "haupt");

await fs.updateDoc(ref, { rundenLinks: 99 });                        // beliebiger Wert   → abgelehnt
await fs.setDoc(ref, {});                                            // alles überschreiben → abgelehnt
await fs.updateDoc(ref, { rundenLinks: fs.increment(5) });           // mehr als 1        → abgelehnt
await fs.updateDoc(ref, { rundenLinks: fs.increment(1),
                          rundenRechts: fs.increment(1) });          // zwei auf einmal   → abgelehnt
await fs.updateDoc(ref, { hack: 1 });                                // fremdes Feld      → abgelehnt
await fs.deleteDoc(ref);                                             // löschen           → abgelehnt
await fs.updateDoc(ref, { rundenLinks: fs.increment(1) });           // +1                → klappt
await fs.updateDoc(ref, { rundenLinks: fs.increment(-1) });          // −1 (Korrektur)    → klappt
```

Jede abgelehnte Zeile endet mit `FirebaseError: Missing or insufficient permissions.`
Wegen der Offline-Persistenz springt die Zahl dabei kurz auf den falschen Wert. Das ist nur die
lokale Vorschau: Sobald der Server ablehnt, springt sie zurück. Zur Kontrolle die Seite neu laden
oder in der Firebase-Konsole nachsehen.

**Mit einem manipulierten Request direkt an die REST-API** (ganz ohne App; `PROJEKT` und `API_KEY` ersetzen):

```sh
curl -X PATCH \
  "https://firestore.googleapis.com/v1/projects/PROJEKT/databases/(default)/documents/zaehler/haupt?updateMask.fieldPaths=rundenLinks&key=API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fields":{"rundenLinks":{"integerValue":"99"}}}'
```

Erwartet: `"code": 403`, `"status": "PERMISSION_DENIED"`.

**Im Rules Playground** (Firestore → Regeln → „Rules Playground“) kannst du Update, Delete und Create
auf `/zaehler/haupt` simulieren, ohne echte Daten zu verändern.
