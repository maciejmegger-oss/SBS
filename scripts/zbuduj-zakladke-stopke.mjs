// Buduje zakładkę (bookmarklet), która wstawia stopkę wprost do pola podpisu w poczcie.
//
// PO CO ZAKŁADKA, A NIE KOPIUJ-WKLEJ: edytor podpisu przepuszcza kolory tekstu, ale wycina
// obrazki linkowane z zewnątrz, a kolor odnośników nadpisuje własnym niebieskim. Zamiast walczyć
// ze schowkiem, zakładka wstawia gotowy kod prosto w pole edytora — to samo wyjście, które
// sprawdziło się przy zbieraniu danych z ŁNP.
//
// LOGO JEDZIE JAKO BASE64, bo tylko obrazek wbudowany w treść przeżywa zapis podpisu.
// Wyjmujemy je z pliku, w którym już raz przeszło przez ten edytor.
//
// ŻADNYCH ZNACZNIKÓW <a>: klient poczty przemalowuje każdy odnośnik na niebiesko i wygrywa ze
// stylem wbudowanym. Telefon i adres zostają zwykłym tekstem — poczta sama zrobi z nich klikalne.
import fs from "node:fs";

const PULPIT = "C:/Users/macie/Desktop";
const ZRODLO_LOGO = `${PULPIT}/SBS-stopka-email.html`;
const CEL = `${PULPIT}/SBS-zakladka-STOPKA.html`;

const logo = (fs.readFileSync(ZRODLO_LOGO, "utf8").match(/data:image\/png;base64,[A-Za-z0-9+/=]+/) || [])[0];
if (!logo) { console.error(`Nie znalazłem logo w ${ZRODLO_LOGO}.`); process.exit(1); }

// Jedna linia, bez apostrofów — cały kod trafia do adresu zakładki, a apostrof zamknąłby napis.
const stopka = [
  '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">',
  '<tr>',
  `<td style="padding:0 18px 0 0;vertical-align:top;"><img src="${logo}" width="76" height="76" alt="Scout Base System" style="display:block;width:76px;height:76px;border-radius:12px;border:0;"></td>`,
  '<td style="padding:0 18px 0 0;vertical-align:top;"><div style="width:3px;height:76px;background:#c69b3c;background-color:#c69b3c;font-size:0;line-height:0;">&nbsp;</div></td>',
  '<td style="vertical-align:top;">',
  '<div style="font-size:17px;font-weight:bold;color:#16302a;">Maciej Megger</div>',
  '<div style="font-size:11px;font-weight:bold;color:#8c6c21;letter-spacing:1.2px;text-transform:uppercase;padding:3px 0 9px;">Scout Base System</div>',
  '<div style="font-size:13px;color:#1b2420;line-height:1.7;">',
  '<span style="color:#1b2420;">+48 507 113 413</span><br>',
  '<span style="color:#1b2420;">kontakt@scoutbasesystem.com</span><br>',
  '<span style="color:#b8860b;font-weight:bold;">scoutbasesystem.com</span>',
  '</div></td></tr>',
  '<tr><td colspan="3" style="padding-top:14px;"><div style="font-size:11px;color:#8a857a;">Skauting i analiza zawodnik&oacute;w &mdash; Ekstraklasa, I&ndash;IV liga, rozgrywki m&#322;odzie&#380;owe</div></td></tr>',
  '</table>',
].join('');

if (stopka.includes("'")) { console.error("Stopka zawiera apostrof — rozwaliłby zakładkę."); process.exit(1); }
if (stopka.includes('%')) { console.error("Stopka zawiera znak procenta — przeglądarka zje go przy dekodowaniu adresu."); process.exit(1); }

// Największe widoczne pole edycyjne na stronie to pole podpisu. Nie zgadujemy nazw klas,
// bo poczta może je zmienić przy każdej aktualizacji.
const kod = `javascript:(function(){var H='${stopka}';` +
  `var c=[].slice.call(document.querySelectorAll('[contenteditable]')).filter(function(e){return e.isContentEditable&&e.offsetHeight>40&&e.offsetWidth>200});` +
  `if(!c.length){alert('Nie znalazlem pola podpisu. Otworz Ustawienia > Podpisy, kliknij w pole tresci i uruchom zakladke jeszcze raz.');return}` +
  `c.sort(function(a,b){return b.offsetHeight*b.offsetWidth-a.offsetHeight*a.offsetWidth});var p=c[0];` +
  `p.focus();try{document.execCommand('selectAll',false,null);document.execCommand('insertHTML',false,H)}catch(e){}` +
  `if(p.innerHTML.indexOf('Maciej Megger')<0){p.innerHTML=H}` +
  `p.dispatchEvent(new Event('input',{bubbles:true}));p.dispatchEvent(new Event('change',{bubbles:true}));` +
  `alert('Stopka wstawiona. Teraz kliknij Zapisz.')})()`;

const wHtml = (s)=> s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const strona = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>Zak&#322;adka: stopka SBS</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;background:#f6f3ea;color:#1b2420;margin:0;padding:32px;line-height:1.6;}
  .karta{max-width:720px;background:#fff;border:1px solid #e3decd;border-radius:12px;padding:24px 28px;margin:0 auto 22px;}
  h1{font-size:21px;margin:0 0 6px;color:#16302a;}
  .pod{font-size:13px;color:#8a857a;margin:0 0 20px;}
  ol{padding-left:22px;font-size:15px;}
  li{margin-bottom:10px;}
  .lapka{display:inline-block;background:#16302a;color:#f0d493;text-decoration:none;font-weight:bold;font-size:16px;
         padding:14px 26px;border-radius:10px;border:2px solid #c69b3c;cursor:grab;}
  .strefa{background:#fbf8f0;border:2px dashed #c69b3c;border-radius:10px;padding:20px;text-align:center;margin:18px 0;}
  .uwaga{font-size:13px;color:#5a5f5a;background:#fbf8f0;border-left:3px solid #c69b3c;padding:10px 14px;border-radius:0 6px 6px 0;}
  button{font-family:inherit;font-size:14px;padding:10px 18px;border-radius:8px;border:1px solid #c69b3c;
         background:#fff;color:#16302a;cursor:pointer;}
  button:hover{background:#fbf8f0;}
</style>
</head>
<body>

<div class="karta">
  <h1>Zak&#322;adka &bdquo;Stopka SBS&rdquo;</h1>
  <p class="pod">Klikasz j&#261; na stronie podpisu &mdash; sama wstawia stopk&#281; do pola. Bez kopiowania, bez HTML-a.</p>

  <ol>
    <li>W&#322;&#261;cz pasek zak&#322;adek w Chrome, je&#347;li go nie widzisz: <strong>Ctrl+Shift+B</strong></li>
    <li><strong>Przeci&#261;gni&#281;ciem</strong> przenie&#347; poni&#380;szy z&#322;oty przycisk na pasek zak&#322;adek.<br>
        Je&#347;li przeci&#261;ganie nie wychodzi &mdash; kliknij <em>Skopiuj kod zak&#322;adki</em> pod spodem, a potem
        prawym przyciskiem na pasku zak&#322;adek &rarr; <em>Dodaj stron&#281;</em> &rarr; w pole <em>Adres URL</em> wklej kod.</li>
    <li>Wejd&#378; w poczcie w <strong>Ustawienia &rarr; Podpisy</strong> i kliknij w pole tre&#347;ci podpisu.</li>
    <li>Kliknij zak&#322;adk&#281; <strong>Stopka SBS</strong> na pasku.</li>
    <li>Kliknij <strong>Zapisz</strong> w poczcie.</li>
  </ol>

  <div class="strefa">
    <a class="lapka" href="${wHtml(kod)}">&#9993;&nbsp; Stopka SBS</a>
    <div style="margin-top:14px;">
      <button id="kopiuj">Skopiuj kod zak&#322;adki</button>
      <span id="stan" style="font-size:13px;color:#8a857a;margin-left:10px;"></span>
    </div>
  </div>

  <p class="uwaga"><strong>Je&#347;li zak&#322;adka powie, &#380;e nie znalaz&#322;a pola podpisu</strong> &mdash; kliknij najpierw
  myszą w bia&#322;e pole tre&#347;ci podpisu, &#380;eby by&#322;o widoczne na ekranie, i uruchom j&#261; jeszcze raz.
  Zak&#322;adka szuka najwi&#281;kszego pola edycyjnego na stronie.</p>
</div>

<script>
document.getElementById('kopiuj').onclick = function(){
  var kod = document.querySelector('.lapka').getAttribute('href');
  navigator.clipboard.writeText(kod).then(function(){
    document.getElementById('stan').textContent = 'Skopiowane — wklej w pole Adres URL nowej zakładki.';
  }, function(){
    document.getElementById('stan').textContent = 'Nie udało się. Kliknij prawym na złoty przycisk → Kopiuj adres linku.';
  });
};
</script>

</body>
</html>
`;

fs.writeFileSync(CEL, strona, "utf8");
console.log(`Zapisane: ${CEL}`);
console.log(`Zakładka: ${(kod.length / 1024).toFixed(1)} kB   (logo ${(logo.length / 1024).toFixed(1)} kB)`);
console.log(`Znaczników <a> w stopce: ${(stopka.match(/<a /g) || []).length}   (musi być 0)`);
console.log(`Logo w treści: ${/src="data:image\/png;base64,/.test(stopka)}`);
console.log(`Złoty pasek: ${/background-color:#c69b3c/.test(stopka)}`);
console.log(`Złota domena: ${/color:#b8860b/.test(stopka)}`);
