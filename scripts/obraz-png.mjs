// PRZYCINANIE I POMNIEJSZANIE PNG BEZ ŻADNYCH BIBLIOTEK — sam node:zlib.
//
// Po co to w repozytorium: herby i logotypy przychodzą w rozmiarach do druku (3543 px), a w SBS
// stoją w przyciskach jako znaczki 22 px. Wrzucanie do przeglądarki pliku pół megabajta po to,
// żeby go pokazać jako kwadracik, to marnowanie łącza przy każdym wejściu. Do tego część znaków
// ma pod spodem napis („PZPN", „WZPN", „Lubelski Związek…"), który w znaczku zamienia się w plamę
// — więc najpierw wycinamy samo godło.
//
// Uruchomienie:
//   node scripts/obraz-png.mjs wejscie.png wyjscie.png [--kadr X,Y,SZER,WYS] [--szerokosc 128]
import fs from "node:fs";
import zlib from "node:zlib";

// ---------- odczyt ----------
export function wczytajPng(sciezka) {
  const plik = fs.readFileSync(sciezka);
  let i = 8, ihdr = null;
  const idat = [];
  while (i < plik.length) {
    const dlugosc = plik.readUInt32BE(i);
    const typ = plik.toString("latin1", i + 4, i + 8);
    const dane = plik.subarray(i + 8, i + 8 + dlugosc);
    if (typ === "IHDR") ihdr = { w: dane.readUInt32BE(0), h: dane.readUInt32BE(4), glebia: dane[8], kolor: dane[9], przeplot: dane[12] };
    if (typ === "IDAT") idat.push(dane);
    i += 12 + dlugosc;
  }
  if (!ihdr || ihdr.glebia !== 8 || ihdr.kolor !== 6 || ihdr.przeplot !== 0) {
    throw new Error(`umiem tylko PNG 8-bit RGBA bez przeplotu, a to jest ${JSON.stringify(ihdr)}`);
  }
  const surowe = zlib.inflateSync(Buffer.concat(idat));
  const wiersz = ihdr.w * 4;
  const piksele = Buffer.alloc(wiersz * ihdr.h);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); };
  for (let y = 0; y < ihdr.h; y++) {
    const filtr = surowe[y * (wiersz + 1)];
    const we = surowe.subarray(y * (wiersz + 1) + 1, y * (wiersz + 1) + 1 + wiersz);
    for (let x = 0; x < wiersz; x++) {
      const a = x >= 4 ? piksele[y * wiersz + x - 4] : 0;
      const b = y > 0 ? piksele[(y - 1) * wiersz + x] : 0;
      const c = (x >= 4 && y > 0) ? piksele[(y - 1) * wiersz + x - 4] : 0;
      const v = we[x];
      piksele[y * wiersz + x] =
        filtr === 0 ? v : filtr === 1 ? (v + a) & 255 : filtr === 2 ? (v + b) & 255
        : filtr === 3 ? (v + ((a + b) >> 1)) & 255 : (v + paeth(a, b, c)) & 255;
    }
  }
  return { w: ihdr.w, h: ihdr.h, piksele };
}

// ---------- przycięcie ----------
export function przytnij(obraz, X, Y, W, H) {
  const w2 = Math.max(1, Math.min(W, obraz.w - X)), h2 = Math.max(1, Math.min(H, obraz.h - Y));
  const out = Buffer.alloc(w2 * h2 * 4);
  for (let y = 0; y < h2; y++) {
    obraz.piksele.copy(out, y * w2 * 4, ((Y + y) * obraz.w + X) * 4, ((Y + y) * obraz.w + X) * 4 + w2 * 4);
  }
  return { w: w2, h: h2, piksele: out };
}

// ---------- pomniejszenie ----------
//
// Uśrednianie po obszarze, nie wybieranie co n-tego piksela: przy skoku z 2250 px na 128 px
// pojedyncze piksele dałyby poszarpane krawędzie i pogubione cienkie kreski (korona, napisy).
// Kolory mnożymy przez przezroczystość i dzielimy na końcu, inaczej przy krawędziach herbu
// wychodzi ciemna obwódka z przezroczystych czarnych pikseli.
export function pomniejsz(obraz, noweW) {
  const noweH = Math.max(1, Math.round(obraz.h * noweW / obraz.w));
  const out = Buffer.alloc(noweW * noweH * 4);
  for (let y = 0; y < noweH; y++) {
    const y0 = Math.floor(y * obraz.h / noweH), y1 = Math.max(y0 + 1, Math.floor((y + 1) * obraz.h / noweH));
    for (let x = 0; x < noweW; x++) {
      const x0 = Math.floor(x * obraz.w / noweW), x1 = Math.max(x0 + 1, Math.floor((x + 1) * obraz.w / noweW));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const p = (yy * obraz.w + xx) * 4, al = obraz.piksele[p + 3];
          r += obraz.piksele[p] * al; g += obraz.piksele[p + 1] * al; b += obraz.piksele[p + 2] * al;
          a += al; n++;
        }
      }
      const p = (y * noweW + x) * 4;
      out[p] = a ? Math.round(r / a) : 0;
      out[p + 1] = a ? Math.round(g / a) : 0;
      out[p + 2] = a ? Math.round(b / a) : 0;
      out[p + 3] = Math.round(a / n);
    }
  }
  return { w: noweW, h: noweH, piksele: out };
}

// ---------- zapis ----------
const crcTab = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTab[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (typ, dane) => {
  const dl = Buffer.alloc(4); dl.writeUInt32BE(dane.length);
  const tresc = Buffer.concat([Buffer.from(typ, "latin1"), dane]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(tresc));
  return Buffer.concat([dl, tresc, c]);
};
export function zapiszPng(sciezka, obraz) {
  const wiersz = obraz.w * 4;
  const zFiltrami = Buffer.alloc((wiersz + 1) * obraz.h);
  for (let y = 0; y < obraz.h; y++) {
    zFiltrami[y * (wiersz + 1)] = 0;
    obraz.piksele.copy(zFiltrami, y * (wiersz + 1) + 1, y * wiersz, y * wiersz + wiersz);
  }
  const naglowek = Buffer.alloc(13);
  naglowek.writeUInt32BE(obraz.w, 0); naglowek.writeUInt32BE(obraz.h, 4);
  naglowek[8] = 8; naglowek[9] = 6;
  fs.writeFileSync(sciezka, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", naglowek),
    chunk("IDAT", zlib.deflateSync(zFiltrami, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]));
}

// ---------- wiersz poleceń ----------
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const [we, wy] = process.argv.slice(2);
  const arg = (nazwa) => { const i = process.argv.indexOf(nazwa); return i > 0 ? process.argv[i + 1] : null; };
  if (!we || !wy) { console.error("użycie: node scripts/obraz-png.mjs wejscie.png wyjscie.png [--kadr X,Y,SZER,WYS] [--szerokosc 128]"); process.exit(1); }
  let obraz = wczytajPng(we);
  const kadr = arg("--kadr");
  if (kadr) { const [X, Y, W, H] = kadr.split(",").map(Number); obraz = przytnij(obraz, X, Y, W, H); }
  const szer = Number(arg("--szerokosc") || 0);
  if (szer > 0 && szer < obraz.w) obraz = pomniejsz(obraz, szer);
  zapiszPng(wy, obraz);
  console.log(`${wy}: ${obraz.w}x${obraz.h}, ${Math.round(fs.statSync(wy).size / 1024)} kB`);
}
