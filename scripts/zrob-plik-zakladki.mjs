// Plik do zaimportowania w przeglądarce, tworzący zakładkę SBS od razu NA PASKU.
//
// Przeciąganie zakładki na pasek bywa zawodne — u Macieja przestało działać zupełnie. Import
// z pliku HTML jest drogą pewną: przeglądarka sama tworzy wpis we wskazanym folderze, więc nic
// nie zależy od tego, czy uda się coś upuścić w odpowiednie miejsce.
//
// W zakładce siedzi WYŁĄCZNIE ładowacz: pobiera świeży kod zbieracza z SBS przy każdym kliknięciu.
// Dzięki temu ta jedna zakładka nie zdezaktualizuje się już nigdy — poprawki wchodzą same,
// bez przeciągania czegokolwiek od nowa.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ADRES = "https://www.scoutbasesystem.com";

const kod =
  "javascript:(function(){var A='" + ADRES + "';" +
  "try{window.__SBS_ADRES=A;}catch(e){}" +
  "fetch(A+'/zakladka-lnp-v2.js?t='+Date.now(),{cache:'no-store'})" +
  ".then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text();})" +
  ".then(function(t){(new Function(t))();})" +
  ".catch(function(e){alert('SBS: nie moglem pobrac zbieracza - '+e.message);});})();";

// Sprawdzamy to, co i tak sprawdzi przeglądarka — lepiej wywalić skrypt niż wydać zepsutą zakładkę.
new Function(kod.replace(/^javascript:/, ""));
if (kod.indexOf("\n") >= 0) throw new Error("Kod zakładki nie może zawierać łamania wierszy.");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- Import tego pliku tworzy jedna zakladke SBS na pasku zakladek. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 PERSONAL_TOOLBAR_FOLDER="true">Pasek zakladek</H3>
    <DL><p>
        <DT><A HREF="${esc(kod)}">&#9889; Zbierz cala kolejke (SBS)</A>
    </DL><p>
</DL><p>
`;

const pulpit = path.join(os.homedir(), "Desktop");
const cel = path.join(fs.existsSync(pulpit) ? pulpit : os.homedir(), "SBS-zakladka.html");
fs.writeFileSync(cel, html, "utf8");
console.log("Zapisano: " + cel);
console.log("Rozmiar: " + fs.statSync(cel).size + " bajtów, kod zakładki: " + kod.length + " znaków");
