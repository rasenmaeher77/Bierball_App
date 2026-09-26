# Bierball Zähler

Ein gemeinsamer Zähler als iPhone-Web-App (HTML, CSS, JavaScript, keine Frameworks).
Der Stand liegt in Firebase Firestore, ist auf allen Geräten gleich und aktualisiert sich live.
Man kann ihn nur um 1 erhöhen, nicht zurücksetzen. Das erzwingen die Security Rules auf dem Server.

| Datei / Ordner         | Zweck                                                   |
|------------------------|---------------------------------------------------------|
| `index.html`           | Überschrift, Zahl, „+1“-Knopf                           |
| `css/style.css`        | Grundstil, Safe-Areas, Dark Mode, Zähler                |
| `js/app.js`            | Service Worker, Firebase-Config, Zähler-Logik           |
| `firestore.rules`      | Security Rules (in der Firebase-Konsole einfügen)       |
| `manifest.webmanifest` | Name, Icon und Farben auf dem Home-Bildschirm           |
| `sw.js`                | Service Worker; neue Dateien in `FILES` eintragen       |
| `icons/`               | App-Icons (180, 192, 512 px)                            |
| `Schriftarten/`        | Schrift für Überschrift, Zahl und Knopf                 |

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
   - Feld: `wert`, Typ `number`, Wert `0`

   Die Sammlung `klicks` legt die App beim ersten Klick selbst an.
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

## Testen, dass Zurücksetzen abgelehnt wird

**In der Browser-Konsole** (App öffnen → Entwicklertools → Konsole; am iPhone über Safari am Mac → Entwickler):

```js
const fs = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js");
const ref = fs.doc(fs.getFirestore(), "zaehler", "haupt");

await fs.updateDoc(ref, { wert: 0 });                    // zurücksetzen      → abgelehnt
await fs.setDoc(ref, { wert: 999 });                     // beliebiger Wert   → abgelehnt
await fs.updateDoc(ref, { wert: fs.increment(-1) });     // runterzählen      → abgelehnt
await fs.updateDoc(ref, { wert: fs.increment(5) });      // mehr als 1        → abgelehnt
await fs.updateDoc(ref, { wert: fs.increment(1), x: 1 }); // Zusatzfeld       → abgelehnt
await fs.deleteDoc(ref);                                 // löschen           → abgelehnt
await fs.updateDoc(ref, { wert: fs.increment(1) });      // +1                → klappt
```

Jede abgelehnte Zeile endet mit `FirebaseError: Missing or insufficient permissions.`
Wegen der Offline-Persistenz springt die Zahl dabei kurz auf den falschen Wert. Das ist nur die
lokale Vorschau: Sobald der Server ablehnt, springt sie zurück. Zur Kontrolle die Seite neu laden
oder in der Firebase-Konsole nachsehen.

**Mit einem manipulierten Request direkt an die REST-API** (ganz ohne App; `PROJEKT` und `API_KEY` ersetzen):

```sh
curl -X PATCH \
  "https://firestore.googleapis.com/v1/projects/PROJEKT/databases/(default)/documents/zaehler/haupt?updateMask.fieldPaths=wert&key=API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fields":{"wert":{"integerValue":"0"}}}'
```

Erwartet: `"code": 403`, `"status": "PERMISSION_DENIED"`.

**Im Rules Playground** (Firestore → Regeln → „Rules Playground“) kannst du Update, Delete und Create
auf `/zaehler/haupt` simulieren, ohne echte Daten zu verändern.
