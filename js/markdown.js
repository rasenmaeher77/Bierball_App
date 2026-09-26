/* =========================================================
   Mini-Markdown – wandelt den Regelwerk-Text in HTML um.
   Ohne externe Bibliothek, damit alles offline funktioniert.
   Die unterstützte Schreibweise steht in Regelwerk/regelwerk.js.
   ========================================================= */

var Markdown = (function () {
  "use strict";

  var HEADING = /^(#{1,3})\s+(.*)$/;
  var IMAGE = /^!\[(.*)\]\((.*)\)$/;
  var LISTS = [
    { open: '<ol type="I">', close: "</ol>", re: /^[IVXLC]+\.\s+(.*)$/ },
    { open: "<ol>", close: "</ol>", re: /^\d+\.\s+(.*)$/ },
    { open: "<ul>", close: "</ul>", re: /^[-‣•]\s+(.*)$/ }
  ];

  var paragrafen = {};
  var vergebeneIds = {};

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function indentOf(line) {
    return line.match(/^ */)[0].length;
  }

  function isBlank(line) {
    return line.trim() === "";
  }

  function listTypeOf(line) {
    var text = line.trim();
    for (var i = 0; i < LISTS.length; i++) {
      var match = text.match(LISTS[i].re);
      if (match) return { list: LISTS[i], content: match[1] };
    }
    return null;
  }

  function startsBlock(line) {
    var text = line.trim();
    if (text.charAt(0) === "\\") return false;
    return HEADING.test(text) || IMAGE.test(text) || listTypeOf(text) !== null;
  }

  /* "§12 Treffer" -> "paragraf-12", sonst z. B. "spielaufbau" */
  function idFor(title) {
    var paragraf = title.match(/^§\s?(\d+)/);
    var id = paragraf
      ? "paragraf-" + paragraf[1]
      : title.toLowerCase()
          .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
    var base = id;
    for (var n = 2; vergebeneIds[id]; n++) id = base + "-" + n;
    vergebeneIds[id] = true;
    return id;
  }

  function inline(text, verlinken) {
    var html = escapeHtml(text.replace(/^\\/, ""))
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    if (!verlinken) return html;
    /* "§§3-4" wird als Ganzes verlinkt (auf den ersten Paragrafen) */
    html = html.replace(/§§?\s?(\d+)(?:-\d+)?/g, function (match, nr) {
      return paragrafen[nr] ? '<a class="verweis" href="#paragraf-' + nr + '">' + match + "</a>" : match;
    });
    /* Bereiche wie "6-7" oder "I-III" nicht am Bindestrich umbrechen */
    return html.replace(/\b(\d+|[IVX]+)-(\d+|[IVX]+)\b/g, '<span class="zusammen">$1-$2</span>');
  }

  function dedent(lines) {
    var min = Infinity;
    lines.forEach(function (line) {
      if (!isBlank(line)) min = Math.min(min, indentOf(line));
    });
    return lines.map(function (line) {
      return line.slice(min === Infinity ? 0 : min);
    });
  }

  function parseBlocks(lines) {
    var html = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];
      var text = line.trim();

      if (isBlank(line)) {
        i++;
        continue;
      }

      var heading = text.match(HEADING);
      if (heading) {
        var level = heading[1].length;
        html.push("<h" + level + ' id="' + idFor(heading[2]) + '">' + inline(heading[2], false) + "</h" + level + ">");
        i++;
        continue;
      }

      var image = text.match(IMAGE);
      if (image) {
        html.push('<figure><img src="' + escapeHtml(image[2]) + '" alt="' + escapeHtml(image[1]) + '"></figure>');
        i++;
        continue;
      }

      var item = text.charAt(0) === "\\" ? null : listTypeOf(text);
      if (item) {
        var list = item.list;
        var indent = indentOf(line);
        html.push(list.open);

        while (i < lines.length) {
          var current = lines[i];
          var currentItem = listTypeOf(current);
          if (!currentItem || currentItem.list !== list || indentOf(current) !== indent) break;

          var body = [];
          i++;
          while (i < lines.length && (isBlank(lines[i]) || indentOf(lines[i]) > indent)) {
            body.push(lines[i]);
            i++;
          }
          /* Leerzeilen am Ende gehören nicht zum Punkt */
          while (body.length && isBlank(body[body.length - 1])) {
            body.pop();
            i--;
          }

          var inner = parseBlocks([currentItem.content].concat(dedent(body)));
          /* Nur ein Absatz -> ohne <p>, damit die Liste kompakt bleibt */
          var single = inner.match(/^<p>([\s\S]*)<\/p>$/);
          html.push("<li>" + (single && single[1].indexOf("<p>") === -1 ? single[1] : inner) + "</li>");

          while (i < lines.length && isBlank(lines[i])) i++;
        }

        html.push(list.close);
        continue;
      }

      var paragraph = [];
      while (i < lines.length && !isBlank(lines[i]) && (paragraph.length === 0 || !startsBlock(lines[i]))) {
        paragraph.push(inline(lines[i].trim(), true));
        i++;
      }
      html.push("<p>" + paragraph.join("<br>") + "</p>");
    }

    return html.join("\n");
  }

  function render(text) {
    var lines = text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");

    paragrafen = {};
    vergebeneIds = {};
    lines.forEach(function (line) {
      var match = line.trim().match(/^#{1,3}\s+§\s?(\d+)/);
      if (match) paragrafen[match[1]] = true;
    });

    return parseBlocks(lines);
  }

  return { render: render };
})();
