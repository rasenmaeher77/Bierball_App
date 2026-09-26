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
  apiKey: "AIzaSyBlsWR2EuyMWXPWeEEis4VPeDrGgvPqamQ",
  authDomain: "bierballapp-13597.firebaseapp.com",
  projectId: "bierballapp-13597",
  storageBucket: "bierballapp-13597.firebasestorage.app",
  messagingSenderId: "217762106237",
  appId: "1:217762106237:web:d9efa9e5384e33b8a51a14"
};

/* Muss mit FIREBASE_VERSION in sw.js übereinstimmen (dort offline gecacht) */
const FIREBASE_VERSION = "12.19.0";
const SDK = "https://www.gstatic.com/firebasejs/" + FIREBASE_VERSION + "/";

/* Die vier Zähler = Felder im Dokument zaehler/haupt.
   Fehlende Felder gelten als 0 (auch in den Security Rules) */
const FELDER = ["rundenLinks", "rundenRechts", "ausgleichLinks", "ausgleichRechts"];

const knoepfe = document.querySelectorAll(".knopf");
const einstellungen = document.getElementById("einstellungen");
const statusZeile = document.getElementById("status");

let stand = {};            /* zuletzt angezeigte Werte je Feld */
let korrektur = false;     /* true = Knöpfe ziehen 1 ab statt 1 dazu */
let geladen = false;
let netzStatus = "";

function zeigeStatus() {
  statusZeile.textContent = korrektur ? "Korrekturmodus: Tippen zieht 1 ab" : netzStatus;
}

/* Knöpfe passend zum Modus beschriften; unter 0 geht es nicht */
function aktualisiereKnoepfe() {
  knoepfe.forEach(function (knopf) {
    knopf.textContent = korrektur ? "−" : "+";
    knopf.disabled = !geladen || (korrektur && !stand[knopf.dataset.feld]);
  });
}

/* Zahl kurz „hüpfen“ lassen, wenn sich der Stand ändert */
function zeigeWert(feld, wert) {
  const ziel = document.querySelector('.wert[data-feld="' + feld + '"]');
  if (stand[feld] === wert) return;
  const ersterWert = !(feld in stand);
  stand[feld] = wert;
  ziel.textContent = wert.toLocaleString("de-DE");
  if (ersterWert) return; /* beim Laden nicht hüpfen */
  ziel.classList.remove("neu");
  void ziel.offsetWidth; /* Animation neu starten */
  ziel.classList.add("neu");
}

einstellungen.addEventListener("click", function () {
  korrektur = !korrektur;
  document.body.classList.toggle("korrektur", korrektur);
  einstellungen.setAttribute("aria-pressed", String(korrektur));
  aktualisiereKnoepfe();
  zeigeStatus();
});

async function starteZaehler() {
  if (FIREBASE_CONFIG.apiKey.startsWith("DEIN_")) {
    netzStatus = "Firebase ist noch nicht eingerichtet (siehe README).";
    zeigeStatus();
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
    netzStatus = "Zähler konnte nicht geladen werden. Bitte mit Internet öffnen.";
    zeigeStatus();
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
      netzStatus = snap.metadata.fromCache
        ? "Offline – noch kein Zählerstand geladen."
        : "Startdokument zaehler/haupt fehlt (siehe README).";
      zeigeStatus();
      return;
    }

    const daten = snap.data();
    FELDER.forEach(function (feld) {
      zeigeWert(feld, daten[feld] || 0);
    });
    geladen = true;
    aktualisiereKnoepfe();

    if (snap.metadata.hasPendingWrites) {
      netzStatus = navigator.onLine ? "Wird gespeichert …" : "Offline – Klicks werden nachgereicht.";
    } else if (snap.metadata.fromCache) {
      netzStatus = "Offline – zuletzt bekannter Stand.";
    } else {
      netzStatus = "";
    }
    zeigeStatus();
  }, function (fehler) {
    console.warn("Zähler nicht lesbar:", fehler);
    netzStatus = "Zähler nicht erreichbar.";
    zeigeStatus();
  });

  /* ±1: Feld serverseitig ändern (increment verliert bei gleichzeitigen
     Klicks nichts) und im selben Schreibvorgang den Klick protokollieren */
  knoepfe.forEach(function (knopf) {
    knopf.addEventListener("click", function () {
      const feld = knopf.dataset.feld;
      const schritt = korrektur ? -1 : 1;
      if (schritt < 0 && !stand[feld]) return;

      const aenderung = {};
      aenderung[feld] = fs.increment(schritt);

      const batch = fs.writeBatch(db);
      batch.update(zaehlerRef, aenderung);
      batch.set(fs.doc(klicksRef), { zeit: fs.serverTimestamp(), feld: feld, schritt: schritt });

      /* Nicht abwarten: Offline erfüllt sich das Versprechen erst beim
         Nachreichen, die Anzeige aktualisiert sich aber sofort */
      batch.commit().catch(function (fehler) {
        console.warn("Klick abgelehnt:", fehler);
        netzStatus = "Klick wurde abgelehnt.";
        zeigeStatus();
      });
    });
  });
}

starteZaehler();
