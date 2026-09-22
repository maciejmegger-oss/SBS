// FLAGI JĘZYKÓW — rysowane, nie emoji.
//
// Emoji flag (🇵🇱, 🇬🇧, 🇩🇪) nie da się tu użyć, choć byłoby krócej: Windows ich NIE RYSUJE.
// Zamiast flagi pokazuje dwie litery w ramkach — czyli dokładnie to, czego flaga miała uniknąć,
// tylko brzydziej. To samo bywa na starszych Androidach. Kilka linii SVG wygląda identycznie
// na każdym systemie i nie potrzebuje żadnego pliku z sieci.
//
// Flaga stoi OBOK kodu języka, a nie zamiast niego. Flaga oznacza kraj, nie język — angielskim
// mówi kilkanaście krajów — więc sama bywa myląca. Razem czyta się najszybciej: oko łapie kolor,
// a kod rozstrzyga.
//
// Wspólne dla strony publicznej (src/site/jezyk.ts) i panelu (src/i18n/dom.ts) — przełącznik
// ma wyglądać tak samo przed zalogowaniem i po nim.

export type KodJezyka = 'pl' | 'en' | 'de';

export const FLAGI: Record<KodJezyka, string> = {
  // Polska: biel nad czerwienią.
  pl: '<svg viewBox="0 0 60 30" aria-hidden="true" focusable="false">'
    + '<rect width="60" height="15" fill="#FFFFFF"/>'
    + '<rect y="15" width="60" height="15" fill="#DC143C"/></svg>',
  // Wielka Brytania: uproszczony Union Jack — przy 18 px szerokości pełna geometria i tak
  // zlałaby się w plamę, a te pięć kresek czyta się od razu.
  en: '<svg viewBox="0 0 60 30" aria-hidden="true" focusable="false">'
    + '<rect width="60" height="30" fill="#012169"/>'
    + '<path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" stroke-width="6"/>'
    + '<path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" stroke-width="2.6"/>'
    + '<path d="M30,0 V30 M0,15 H60" stroke="#FFFFFF" stroke-width="10"/>'
    + '<path d="M30,0 V30 M0,15 H60" stroke="#C8102E" stroke-width="6"/></svg>',
  // Niemcy: czerń, czerwień, złoto w poziomych pasach.
  de: '<svg viewBox="0 0 60 30" aria-hidden="true" focusable="false">'
    + '<rect width="60" height="10" fill="#000000"/>'
    + '<rect y="10" width="60" height="10" fill="#DD0000"/>'
    + '<rect y="20" width="60" height="10" fill="#FFCE00"/></svg>',
};

export const JEZYKI: { kod: KodJezyka; etykieta: string; tytul: string }[] = [
  { kod: 'pl', etykieta: 'PL', tytul: 'Polski' },
  { kod: 'en', etykieta: 'EN', tytul: 'English' },
  { kod: 'de', etykieta: 'DE', tytul: 'Deutsch' },
];
