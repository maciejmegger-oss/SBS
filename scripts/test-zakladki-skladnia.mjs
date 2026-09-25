// Czy KAŻDA zakładka — razem z kopią awaryjną w środku — jest poprawnym kodem po wklejeniu w pasek?
import fs from 'node:fs';

const main = fs.readFileSync('src/main.ts', 'utf8');
const szablon = main.match(/const zakladkaSamoaktualizujaca = \(sciezka, kodAwaryjny\) => `([\s\S]*?)`;/)[1];
const buduj = new Function('sciezka', 'kodAwaryjny', 'SBS_ADRES_JS', 'return `' + szablon + '`;');

const doSprawdzenia = [
  ['/zakladka-lnp-v2.js', 'public/zakladka-lnp-v2.js'],
  ...fs.readdirSync('public/zakladki').map((p) => ['/zakladki/' + p, 'public/zakladki/' + p]),
];
let bledy = 0;
for (const [sciezka, plik] of doSprawdzenia) {
  const url = buduj(sciezka, fs.readFileSync(plik, 'utf8'), JSON.stringify('https://scoutbasesystem.com'));
  try {
    new Function(url.replace(/^javascript:/, ''));
    console.log('  OK  ', sciezka.padEnd(34), (url.length / 1024).toFixed(0) + ' kB');
  } catch (e) {
    bledy++;
    console.log(' BŁĄD ', sciezka, e.message);
  }
}
process.exit(bledy ? 1 : 0);
