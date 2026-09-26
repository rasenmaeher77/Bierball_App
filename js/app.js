/* Offline-Funktion (Service Worker) */
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function (err) {
      console.warn("Service Worker konnte nicht registriert werden:", err);
    });
  });
}

/* =========================================================
   Zähler – gespeichert in Firebase Firestore (Dokument zaehler/haupt).
   Schutz gegen Zurücksetzen liegt NICHT hier, sondern in den
   Security Rules (firestore.rules). Dieser Code darf öffentlich sein.
   ========================================================= */

/* Aus der Firebase-Konsole: Projekteinstellungen → Meine Apps → Web-App */
const FIREBASE_CONFIG = {
  apiKey: "DEIN_API_KEY",
  authDomain: "DEIN_PROJEKT.firebaseapp.com",
  projectId: "DEIN_PROJEKT",
  storageBucket: "DEIN_PROJEKT.firebasestorage.app",
  messagingSenderId: "DEINE_SENDER_ID",
  appId: "DEINE_APP_ID"
};

/* Muss mit FIREBASE_VERSION in sw.js übereinstimmen (dort offline gecacht) */
const FIREBASE_VERSION = "12.19.0";
const SDK = "https://www.gstatic.com/firebasejs/" + FIREBASE_VERSION + "/";

const zahl = document.getElementById("zahl");
const knopf = document.getElementById("plus");
const statusZeile = document.getElementById("status");

function zeigeStatus(text) {
  statusZeile.textContent = text;
}

/* Zahl kurz „hüpfen“ lassen, wenn sich der Stand ändert */
function zeigeWert(wert) {
  const text = wert.toLocaleString("de-DE");
  if (zahl.textContent === text) return;
  zahl.textContent = text;
  zahl.classList.remove("neu");
  void zahl.offsetWidth; /* Animation neu starten */
  zahl.classList.add("neu");
}

async function starteZaehler() {
  if (FIREBASE_CONFIG.apiKey.startsWith("DEIN_")) {
    zeigeStatus("Firebase ist noch nicht eingerichtet (siehe README).");
    return;
  }

  /* SDK per import() laden: Schlägt das fehl (z. B. erster Start ohne
     Internet), läuft der Rest der Seite trotzdem */
  let app, fs;
  try {
    [app, fs] = await Promise.all([
      import(SDK + "firebase-app.js"),
      import(SDK + "firebase-firestore.js")
    ]);
  } catch (fehler) {
    console.warn("Firebase SDK konnte nicht geladen werden:", fehler);
    zeigeStatus("Zähler konnte nicht geladen werden. Bitte mit Internet öffnen.");
    return;
  }

  /* Offline-Persistenz: Stand und noch nicht gesendete Klicks liegen in
     IndexedDB und werden automatisch nachgereicht, sobald wieder Internet da ist */
  const db = fs.initializeFirestore(app.initializeApp(FIREBASE_CONFIG), {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
  });
  const zaehlerRef = fs.doc(db, "zaehler", "haupt");
  const klicksRef = fs.collection(db, "klicks");

  /* Live-Anzeige auf allen Geräten */
  fs.onSnapshot(zaehlerRef, { includeMetadataChanges: true }, function (snap) {
    if (!snap.exists()) {
      /* Offline beim allerersten Start ist noch nichts im Cache */
      zeigeStatus(snap.metadata.fromCache
        ? "Offline – noch kein Zählerstand geladen."
        : "Startdokument zaehler/haupt fehlt (siehe README).");
      return;
    }

    zeigeWert(snap.data().wert);
    knopf.disabled = false;

    if (snap.metadata.hasPendingWrites) {
      zeigeStatus(navigator.onLine ? "Wird gespeichert …" : "Offline – Klicks werden nachgereicht.");
    } else if (snap.metadata.fromCache) {
      zeigeStatus("Offline – zuletzt bekannter Stand.");
    } else {
      zeigeStatus("");
    }
  }, function (fehler) {
    console.warn("Zähler nicht lesbar:", fehler);
    zeigeStatus("Zähler nicht erreichbar.");
  });

  /* +1: Zähler serverseitig erhöhen (increment verliert bei gleichzeitigen
     Klicks nichts) und im selben Schreibvorgang einen Klick protokollieren */
  knopf.addEventListener("click", function () {
    const batch = fs.writeBatch(db);
    batch.update(zaehlerRef, { wert: fs.increment(1) });
    batch.set(fs.doc(klicksRef), { zeit: fs.serverTimestamp() });

    /* Nicht abwarten: Offline erfüllt sich das Versprechen erst beim
       Nachreichen, die Anzeige aktualisiert sich aber sofort */
    batch.commit().catch(function (fehler) {
      console.warn("Klick abgelehnt:", fehler);
      zeigeStatus("Klick wurde abgelehnt.");
    });
  });
}

starteZaehler();
