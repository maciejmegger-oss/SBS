// CENY NA KARTACH PAKIETÓW — rysowanie i przełącznik okresu.
//
// Same kwoty siedzą w src/site/cennik.ts; tutaj jest wyłącznie to, co dotyczy strony:
// przycisk wyboru okresu i wstawianie wyliczonych cen do kart.
//
// DLACZEGO CENY RYSUJE JAVASCRIPT, A NIE STOJĄ WPROST W index.html
// Kwot jest dwadzieścia jeden (siedem pakietów × trzy okresy), a w dwóch walutach czterdzieści
// dwie. Wpisane ręcznie w stronę rozjechałyby się przy pierwszej podwyżce — ktoś poprawiłby
// sezon, a zapomniał o kwartale, i klient zobaczyłby dwie różne prawdy. Tak jest jedno miejsce
// do zmiany i zero okazji do pomyłki.

import { OKRESY, policzCene, nazwaOkresu, type Okres } from './cennik';

const KLUCZ = 'sbs-okres-cennika';
// Wybór odtwarzamy JUŻ PRZY WCZYTANIU pliku, a nie osobnym uruchomieniem. Ceny rysuje
// przełącznik języka, który startuje pierwszy — gdyby okres wczytywał się później, przy
// wejściu mignęłaby cena sezonowa, choć poprzednio oglądało się kwartalne.
let okres: Okres = zapamietanyOkres();

function zapamietanyOkres(): Okres {
  try {
    const z = localStorage.getItem(KLUCZ);
    if (z === 'polrocze' || z === 'kwartal' || z === 'sezon') return z;
  } catch (e) { /* tryb prywatny */ }
  return 'sezon';
}

// Wstawienie kwot do kart. Wołane przy starcie, przy zmianie okresu i przy zmianie języka —
// bo język decyduje o walucie.
export function odswiezCennik(jezyk: string): void {
  document.querySelectorAll<HTMLElement>('[data-pakiet-cena]').forEach((el) => {
    const cena = policzCene(el.dataset.pakietCena || '', okres, jezyk);
    // Pakiet bez ceny w cenniku zostaje po prostu bez kwoty — lepsza karta bez ceny
    // niż karta z napisem „undefined".
    if (!cena) { el.innerHTML = ''; return; }
    el.innerHTML = `<span class="pak-kwota-glowna">${cena.glowna}</span>`
      + `<span class="pak-kwota-mies">${cena.miesiecznie}</span>`;
  });

  const host = document.querySelector('.okresy');
  if (!host) return;
  host.innerHTML = OKRESY.map((o) =>
    `<button type="button" data-okres="${o}" aria-pressed="${o === okres ? 'true' : 'false'}">`
    + `${nazwaOkresu(o, jezyk)}</button>`
  ).join('');
  host.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.addEventListener('click', () => {
      okres = b.dataset.okres as Okres;
      try { localStorage.setItem(KLUCZ, okres); } catch (e) { /* tryb prywatny */ }
      odswiezCennik(jezyk);
    });
  });
}
