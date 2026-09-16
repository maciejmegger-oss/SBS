// TŁUMACZ INTERFEJSU — czysty mechanizm, bez DOM (testowalny w Node).
//
// SBS ma polskie napisy wpisane wprost w szablony widoków. Zamiast przepisywać ~22 tys. linii na klucze
// tłumaczeń, tłumaczymy to, co już zostało narysowane — słownikiem polski → angielski:
//
//  • CAŁY NAPIS ze słownika („Zapisz", „Śr. ocena") → wprost.
//  • FRAZA WIELOCZŁONOWA wewnątrz dłuższego tekstu („Nowych nazwisk: 1074", „🔄 Odśwież statystyki")
//    → podmiana z granicami słów, od najdłuższych fraz. Dzięki temu działa przy liczbach i ikonach.
//  • POJEDYNCZE SŁOWO tylko wtedy, gdy jest jedynym słowem napisu („Usuń (3)"). Wewnątrz zdań NIE —
//    inaczej miasto Nowe albo drużyna „Młode Talenty" zmieniałyby nazwę.
//
// Wyniki pamiętamy: te same napisy (kolumny, przyciski, statusy) powtarzają się setki razy na jednej liście.

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

// NAZWY ROZGRYWEK I GRUP ZOSTAJĄ PO POLSKU — to nazwy własne i jednocześnie dane, po których system
// dopasowuje kluby. Bez tej listy „Rocznik 2013" (nazwa grupy) stawał się „Born 2013", bo pojedyncze
// słowo „Rocznik" jest w słowniku jako nagłówek kolumny.
const NIE_TLUMACZ = [
  /^Rocznik \d{4}$/,
  /^(I|II|III|IV) liga\b/,
  /^CLJ U\s?\d{2}\b/,
  /^Liga makroregionalna\b/,
  /^Klasa okręgowa\b/,
  /^Ekstraklasa$/,
];

type Fraza = { re: RegExp; en: string; dl: number };

export function zbudujTlumacza(slownik: Record<string, string>) {
  const dokladne = new Map<string, string>();
  const indeks = new Map<string, Fraza[]>();
  for (const [pl, en] of Object.entries(slownik)) {
    const k = norm(pl);
    if (!k || !en) continue;
    dokladne.set(k, en);
    if (/\s/.test(k) && k.length >= 5) {
      const pierwsze = (k.match(/[\p{L}][\p{L}\p{N}]*/u) || [''])[0].toLowerCase();
      if (!pierwsze) continue;
      const wpis = { re: new RegExp('(^|[^\\p{L}\\p{N}])' + escapeRe(k) + '(?![\\p{L}\\p{N}])', 'gu'), en, dl: k.length };
      if (!indeks.has(pierwsze)) indeks.set(pierwsze, []);
      indeks.get(pierwsze)!.push(wpis);
    }
  }

  const przetlumacz = (tekst: string): string => {
    const lead = (tekst.match(/^\s*/) || [''])[0];
    const trail = (tekst.match(/\s*$/) || [''])[0];
    const rdzen = norm(tekst);
    if (NIE_TLUMACZ.some((re) => re.test(rdzen))) return tekst;
    const calosc = dokladne.get(rdzen);
    if (calosc !== undefined) return lead + calosc + trail;
    const slowa = rdzen.match(/[\p{L}][\p{L}\p{N}]*\.?/gu) || [];
    if (slowa.length === 1) {
      const jedno = dokladne.get(slowa[0]) ?? dokladne.get(slowa[0].replace(/\.$/, ''));
      if (jedno !== undefined) return tekst.replace(slowa[0].replace(/\.$/, ''), jedno);
    }
    const kandydaci: Fraza[] = [];
    for (const s of new Set(slowa.map((x) => x.replace(/\.$/, '').toLowerCase()))) {
      const lista = indeks.get(s);
      if (lista) kandydaci.push(...lista);
    }
    if (!kandydaci.length) return tekst;
    kandydaci.sort((a, b) => b.dl - a.dl);
    let out = tekst;
    for (const k of kandydaci) {
      k.re.lastIndex = 0;
      out = out.replace(k.re, (_m, przed) => przed + k.en);
    }
    return out;
  };

  const pamiec = new Map<string, string>();
  return function tlumacz(tekst: string): string {
    if (!tekst || !/\p{L}/u.test(tekst)) return tekst;
    const zPamieci = pamiec.get(tekst);
    if (zPamieci !== undefined) return zPamieci;
    const wynik = przetlumacz(tekst);
    if (pamiec.size > 20000) pamiec.clear();
    pamiec.set(tekst, wynik);
    return wynik;
  };
}
