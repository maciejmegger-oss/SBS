// NUMERY KIERUNKOWE DO FORMULARZA ZGŁOSZENIA.
//
// PO CO
// Dopóki pole telefonu było gołe, każdy wpisywał numer po swojemu: „507113413", „+48 507 113 413",
// „0048507113413". Przy polskim kliencie to jeszcze nic, ale system idzie po niemiecku i angielsku,
// a numer bez kierunkowego jest wtedy bezużyteczny — nie da się oddzwonić, nie wiedząc, do którego
// kraju. Wybór z listy rozstrzyga to za wpisującego i zapisuje numer w jednej, przewidywalnej
// postaci: „+49 170 1234567".
//
// DLACZEGO NIE PEŁNA LISTA ŚWIATA
// Dwieście pozycji, przez które trzeba przewijać, to gorsze pole niż brak pola. Tu jest cała Europa
// (bo stamtąd przychodzą kluby, skauci i agenci) oraz te kraje spoza niej, z którymi polska piłka
// naprawdę się styka. Gdyby kiedyś zabrakło jakiegoś kierunku, dopisanie to jedna linia.
//
// NAZWY W TRZECH JĘZYKACH, bo lista jest częścią strony, która przełącza się na angielski
// i niemiecki. „Niemcy / Germany / Deutschland" — każdy znajduje swój kraj tak, jak go nazywa.

export interface Kierunkowy {
  kod: string;   // numer kierunkowy, np. '+48'
  pl: string;
  en: string;
  de: string;
}

// KOLEJNOŚĆ: najpierw kraje języków, które strona obsługuje — Polska, Niemcy, Austria, Szwajcaria,
// Wielka Brytania. To one będą wybierane najczęściej, a szukanie ich w środku alfabetu przy
// każdym zgłoszeniu byłoby stratą czasu. Reszta alfabetycznie po polsku.
export const KIERUNKOWE: Kierunkowy[] = [
  { kod: '+48',  pl: 'Polska',            en: 'Poland',            de: 'Polen' },
  { kod: '+49',  pl: 'Niemcy',            en: 'Germany',           de: 'Deutschland' },
  { kod: '+43',  pl: 'Austria',           en: 'Austria',           de: 'Österreich' },
  { kod: '+41',  pl: 'Szwajcaria',        en: 'Switzerland',       de: 'Schweiz' },
  { kod: '+44',  pl: 'Wielka Brytania',   en: 'United Kingdom',    de: 'Vereinigtes Königreich' },

  { kod: '+355', pl: 'Albania',           en: 'Albania',           de: 'Albanien' },
  { kod: '+376', pl: 'Andora',            en: 'Andorra',           de: 'Andorra' },
  { kod: '+32',  pl: 'Belgia',            en: 'Belgium',           de: 'Belgien' },
  { kod: '+375', pl: 'Białoruś',          en: 'Belarus',           de: 'Belarus' },
  { kod: '+387', pl: 'Bośnia i Hercegowina', en: 'Bosnia and Herzegovina', de: 'Bosnien und Herzegowina' },
  { kod: '+359', pl: 'Bułgaria',          en: 'Bulgaria',          de: 'Bulgarien' },
  { kod: '+385', pl: 'Chorwacja',         en: 'Croatia',           de: 'Kroatien' },
  { kod: '+357', pl: 'Cypr',              en: 'Cyprus',            de: 'Zypern' },
  { kod: '+420', pl: 'Czechy',            en: 'Czechia',           de: 'Tschechien' },
  { kod: '+45',  pl: 'Dania',             en: 'Denmark',           de: 'Dänemark' },
  { kod: '+372', pl: 'Estonia',           en: 'Estonia',           de: 'Estland' },
  { kod: '+358', pl: 'Finlandia',         en: 'Finland',           de: 'Finnland' },
  { kod: '+33',  pl: 'Francja',           en: 'France',            de: 'Frankreich' },
  { kod: '+30',  pl: 'Grecja',            en: 'Greece',            de: 'Griechenland' },
  { kod: '+995', pl: 'Gruzja',            en: 'Georgia',           de: 'Georgien' },
  { kod: '+353', pl: 'Irlandia',          en: 'Ireland',           de: 'Irland' },
  { kod: '+354', pl: 'Islandia',          en: 'Iceland',           de: 'Island' },
  { kod: '+972', pl: 'Izrael',            en: 'Israel',            de: 'Israel' },
  { kod: '+383', pl: 'Kosowo',            en: 'Kosovo',            de: 'Kosovo' },
  { kod: '+370', pl: 'Litwa',             en: 'Lithuania',         de: 'Litauen' },
  { kod: '+352', pl: 'Luksemburg',        en: 'Luxembourg',        de: 'Luxemburg' },
  { kod: '+371', pl: 'Łotwa',             en: 'Latvia',            de: 'Lettland' },
  { kod: '+389', pl: 'Macedonia Północna', en: 'North Macedonia',  de: 'Nordmazedonien' },
  { kod: '+356', pl: 'Malta',             en: 'Malta',             de: 'Malta' },
  { kod: '+373', pl: 'Mołdawia',          en: 'Moldova',           de: 'Moldau' },
  { kod: '+377', pl: 'Monako',            en: 'Monaco',            de: 'Monaco' },
  { kod: '+31',  pl: 'Holandia',          en: 'Netherlands',       de: 'Niederlande' },
  { kod: '+47',  pl: 'Norwegia',          en: 'Norway',            de: 'Norwegen' },
  { kod: '+351', pl: 'Portugalia',        en: 'Portugal',          de: 'Portugal' },
  { kod: '+7',   pl: 'Rosja',             en: 'Russia',            de: 'Russland' },
  { kod: '+40',  pl: 'Rumunia',           en: 'Romania',           de: 'Rumänien' },
  { kod: '+381', pl: 'Serbia',            en: 'Serbia',            de: 'Serbien' },
  { kod: '+421', pl: 'Słowacja',          en: 'Slovakia',          de: 'Slowakei' },
  { kod: '+386', pl: 'Słowenia',          en: 'Slovenia',          de: 'Slowenien' },
  { kod: '+34',  pl: 'Hiszpania',         en: 'Spain',             de: 'Spanien' },
  { kod: '+46',  pl: 'Szwecja',           en: 'Sweden',            de: 'Schweden' },
  { kod: '+90',  pl: 'Turcja',            en: 'Türkiye',           de: 'Türkei' },
  { kod: '+380', pl: 'Ukraina',           en: 'Ukraine',           de: 'Ukraine' },
  { kod: '+36',  pl: 'Węgry',             en: 'Hungary',           de: 'Ungarn' },
  { kod: '+39',  pl: 'Włochy',            en: 'Italy',             de: 'Italien' },

  // Poza Europą — kierunki, z którymi polska piłka styka się naprawdę.
  { kod: '+54',  pl: 'Argentyna',         en: 'Argentina',         de: 'Argentinien' },
  { kod: '+61',  pl: 'Australia',         en: 'Australia',         de: 'Australien' },
  { kod: '+55',  pl: 'Brazylia',          en: 'Brazil',            de: 'Brasilien' },
  { kod: '+1',   pl: 'USA / Kanada',      en: 'USA / Canada',      de: 'USA / Kanada' },
  { kod: '+971', pl: 'Zjednoczone Emiraty Arabskie', en: 'United Arab Emirates', de: 'Vereinigte Arabische Emirate' },
  { kod: '+974', pl: 'Katar',             en: 'Qatar',             de: 'Katar' },
  { kod: '+966', pl: 'Arabia Saudyjska',  en: 'Saudi Arabia',      de: 'Saudi-Arabien' },
  { kod: '+81',  pl: 'Japonia',           en: 'Japan',             de: 'Japan' },
  { kod: '+82',  pl: 'Korea Południowa',  en: 'South Korea',       de: 'Südkorea' },
  { kod: '+212', pl: 'Maroko',            en: 'Morocco',           de: 'Marokko' },
  { kod: '+234', pl: 'Nigeria',           en: 'Nigeria',           de: 'Nigeria' },
  { kod: '+27',  pl: 'RPA',               en: 'South Africa',      de: 'Südafrika' },
];

// Domyślny kierunkowy dla języka strony. Ktoś, kto czyta stronę po niemiecku, najpewniej dzwoni
// z niemieckiego numeru — a jeśli nie, zmieni jednym kliknięciem.
export const DOMYSLNY_KIERUNKOWY: Record<string, string> = { pl: '+48', en: '+44', de: '+49' };

// ZŁOŻENIE NUMERU Z KIERUNKOWEGO I TEGO, CO WPISANO.
//
// Trzy przypadki, które naprawdę się zdarzają:
//   „507113413"        → numer krajowy, doklejamy wybrany kierunkowy
//   „+48 507 113 413"  → ktoś wpisał komplet ręcznie, zostawiamy jak jest
//   „0048507113413"    → stary zapis z zerami zamiast plusa, zamieniamy na „+"
// Puste pole zostaje puste — telefon nie jest wymagany i nie wolno zapisać samego „+48".
//
// Funkcja stoi tutaj, a nie przy obsłudze formularza, bo nie dotyka strony: da się ją sprawdzić
// osobno (scripts/test-kierunkowe.mjs), bez uruchamiania przeglądarki.
export function zlozNumer(wpisane: string, kierunkowy: string): string {
  const numer = String(wpisane || '').trim();
  if (!numer) return '';
  if (numer.startsWith('+')) return numer;
  if (numer.startsWith('00')) return '+' + numer.slice(2).trim();
  // Zero wiodące to krajowy prefiks międzymiastowy — przy numerze z kierunkowym jest zbędne.
  const krajowy = numer.replace(/^0+/, '').trim();
  if (!krajowy) return '';
  return `${kierunkowy || '+48'} ${krajowy}`;
}
