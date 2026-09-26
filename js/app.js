/* Offline-Funktion (Service Worker) */
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function (err) {
      console.warn("Service Worker konnte nicht registriert werden:", err);
    });
  });
}

/* Regelwerk anzeigen (Text steht in Regelwerk/regelwerk.js) */
(function () {
  var ziel = document.getElementById("regelwerk");
  if (!ziel || !window.REGELWERK) return;

  ziel.innerHTML = Markdown.render(window.REGELWERK);

  /* Inhaltsverzeichnis aus den Überschriften (## und ###) */
  var nav = document.createElement("nav");
  nav.className = "inhaltsverzeichnis";
  nav.setAttribute("aria-label", "Inhaltsverzeichnis");

  var liste = document.createElement("ul");
  var aktuellerAbschnitt = null;

  function span(klasse, text) {
    var element = document.createElement("span");
    element.className = klasse;
    element.textContent = text;
    return element;
  }

  /* "§12 Treffer, Trinken" -> Nummer und Titel getrennt (für die Optik) */
  function fuelle(element, nr, titel) {
    element.textContent = "";
    if (nr !== null) element.append(span("nr", nr), " ");
    element.append(span("titel", titel));
  }

  ziel.querySelectorAll("h2, h3").forEach(function (ueberschrift) {
    var teile = ueberschrift.textContent.match(/^(§\s?\d+)\s+(.*)$/);
    var nr = teile ? teile[1] : null;
    var titel = teile ? teile[2] : ueberschrift.textContent;

    var eintrag = document.createElement("li");
    var link = document.createElement("a");
    link.href = "#" + ueberschrift.id;
    /* Unterpunkte ohne § bekommen eine leere Nummer, damit alles bündig bleibt */
    fuelle(link, ueberschrift.tagName === "H3" && nr === null ? "" : nr, titel);
    eintrag.appendChild(link);
    if (nr !== null) fuelle(ueberschrift, nr, titel);

    if (ueberschrift.tagName === "H2" || !aktuellerAbschnitt) {
      liste.appendChild(eintrag);
      aktuellerAbschnitt = ueberschrift.tagName === "H2" ? eintrag : null;
    } else {
      var unterliste = aktuellerAbschnitt.querySelector("ul");
      if (!unterliste) {
        unterliste = document.createElement("ul");
        aktuellerAbschnitt.appendChild(unterliste);
      }
      unterliste.appendChild(eintrag);
    }
  });

  var titel = document.createElement("h2");
  titel.textContent = "Inhaltsverzeichnis";
  nav.appendChild(titel);
  nav.appendChild(liste);
  ziel.insertBefore(nav, ziel.querySelector("h2"));

  /* Beim Neuladen immer ganz oben starten: Browser soll die alte
     Scrollposition nicht wiederherstellen, und ein #Sprungziel aus dem
     Inhaltsverzeichnis wird aus der Adresse entfernt */
  var navigation = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
  var neuGeladen = navigation && navigation.type === "reload";
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  if (neuGeladen) {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    window.scrollTo({ top: 0, behavior: "instant" });
  } else if (location.hash) {
    /* Direktlink wie index.html#paragraf-12 ansteuern */
    var sprungziel = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (sprungziel) sprungziel.scrollIntoView();
  }
})();
