// Skleja stronę „do skopiowania" ze stopką e-mail.
//
// PO CO OSOBNY SKRYPT: logo musi jechać w treści jako base64, a nie jako adres https.
// Edytor podpisu w poczcie przyjmuje obrazek wbudowany, a linkowany z zewnątrz wycina —
// sprawdzone na żywym edytorze. Base64 ma ~26 tys. znaków, więc nie przepisujemy go ręcznie,
// tylko wyjmujemy z pliku, w którym już zadziałał.
//
// CZEGO NIE UŻYWAMY: znacznika <a>. Klient poczty nadpisuje kolor każdego odnośnika własnym
// niebieskim i wygrywa ze stylem wbudowanym. Adres i telefon zostają zwykłym tekstem —
// poczta i tak zrobi z nich klikalne przy wysyłce, zachowując kolor.
import fs from "node:fs";

const PULPIT = "C:/Users/macie/Desktop";
const ZRODLO = `${PULPIT}/SBS-stopka-email.html`;
const CEL = `${PULPIT}/SBS-stopka-DO-SKOPIOWANIA.html`;

const stare = fs.readFileSync(ZRODLO, "utf8");
const logo = stare.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
if (!logo) {
  console.error(`Nie znalazłem logo w ${ZRODLO}.`);
  process.exit(1);
}
console.log(`Logo base64: ${(logo[0].length / 1024).toFixed(1)} tys. znaków`);

const stopka = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td style="padding:0 18px 0 0;vertical-align:top;"><img src="${logo[0]}" width="76" height="76" alt="Scout Base System" style="display:block;width:76px;height:76px;border-radius:12px;border:0;"></td>
    <td style="padding:0 18px 0 0;vertical-align:top;"><div style="width:3px;height:76px;background:#c69b3c;background-color:#c69b3c;font-size:0;line-height:0;">&nbsp;</div></td>
    <td style="vertical-align:top;">
      <div style="font-size:17px;font-weight:bold;color:#16302a;">Maciej Megger</div>
      <div style="font-size:11px;font-weight:bold;color:#8c6c21;letter-spacing:1.2px;text-transform:uppercase;padding:3px 0 9px;">Scout Base System</div>
      <div style="font-size:13px;color:#1b2420;line-height:1.7;">
        <span style="color:#1b2420;">+48 507 113 413</span><br>
        <span style="color:#1b2420;">kontakt@scoutbasesystem.com</span><br>
        <span style="color:#b8860b;font-weight:bold;">scoutbasesystem.com</span>
      </div>
    </td>
  </tr>
  <tr><td colspan="3" style="padding-top:14px;"><div style="font-size:11px;color:#8a857a;">Skauting i analiza zawodnik&oacute;w &mdash; Ekstraklasa, I&ndash;IV liga, rozgrywki m&#322;odzie&#380;owe</div></td></tr>
</table>`;

const strona = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>Stopka SBS &mdash; do skopiowania</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;background:#f6f3ea;color:#1b2420;margin:0;padding:28px;}
  .karta{max-width:700px;background:#fff;border:1px solid #e3decd;border-radius:10px;padding:18px 22px;margin-bottom:24px;}
  .karta h1{font-size:17px;margin:0 0 12px;color:#16302a;}
  .karta ol{margin:0;padding-left:20px;line-height:2;font-size:14px;}
  .karta p{font-size:13px;color:#5a5f5a;line-height:1.65;}
  .ramka{background:#fff;border:2px dashed #c69b3c;border-radius:10px;padding:22px;display:inline-block;}
  .etykieta{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#8a857a;margin-bottom:10px;}
</style>
</head>
<body>

<div class="karta">
  <h1>Wklej stopk&#281; &mdash; jedno przej&#347;cie</h1>
  <ol>
    <li>Od&#347;wie&#380; t&#281; stron&#281;: <strong>Ctrl+F5</strong></li>
    <li>Zaznacz myszą ca&#322;&#261; stopk&#281; z przerywanej ramki poni&#380;ej &rarr; <strong>Ctrl+C</strong></li>
    <li>W poczcie kliknij w pole podpisu &rarr; <strong>Ctrl+A</strong> &rarr; <strong>Delete</strong></li>
    <li><strong>Ctrl+V</strong> &rarr; <strong>Zapisz</strong></li>
  </ol>
  <p>Logo jedzie <strong>w treści</strong> (base64), nie z adresu &mdash; tak przechodzi przez edytor podpisu.
  Telefon, e-mail i domena to <strong>zwyk&#322;y tekst bez odno&#347;nika</strong>, dlatego nie zrobi&#261; si&#281; niebieskie;
  poczta sama zamieni je w klikalne przy wysy&#322;ce.</p>
</div>

<div class="etykieta">Stopka &mdash; zaznacz i skopiuj</div>
<div class="ramka">
${stopka}
</div>

</body>
</html>
`;

fs.writeFileSync(CEL, strona, "utf8");
console.log(`Zapisane: ${CEL}  (${(strona.length / 1024).toFixed(0)} kB)`);
console.log(`Znaczników <a>: ${(stopka.match(/<a /g) || []).length}   (musi być 0)`);
console.log(`Logo w treści: ${/src="data:image\/png;base64,/.test(stopka)}`);
console.log(`Złoty pasek: ${/background-color:#c69b3c/.test(stopka)}`);
