// PRZEŁĄCZNIK JĘZYKA NA STRONIE PUBLICZNEJ — polski, angielski, niemiecki.
//
// DLACZEGO NIE TEN SAM MECHANIZM CO W APLIKACJI
// src/i18n/dom.ts tłumaczy aplikację, przechodząc po węzłach tekstowych i podmieniając frazy ze
// słownika. Dla tysięcy krótkich napisów z przycisków to jedyne sensowne wyjście — przepisywanie
// dwudziestu paru tysięcy linii widoków na klucze odpada. Ale strona publiczna to akapity, a w nich
// pogrubienia w środku zdania. Takie zdanie jest w drzewie POCIĘTE na kawałki („Dla klubów, które",
// „nie mają własnego działu skautingu", „— a mimo to…"), a w angielskim i niemieckim szyk jest inny
// i pogrubienie wypada gdzie indziej. Tłumaczone kawałkami wyszłoby kalectwo.
//
// Dlatego tutaj podmieniamy CAŁE BLOKI: element z atrybutem data-i18n dostaje gotowy przekład razem
// ze znacznikami. Polska wersja zostaje w pamięci, więc powrót na polski nie wymaga przeładowania.
//
// Świadomie NIE ruszamy: nazwy własnej systemu, adresów e-mail, znaku w pasku i stopce.

import { STRONA } from '../i18n/strona';
import { FLAGI, JEZYKI } from '../i18n/flagi';
import { KIERUNKOWE, DOMYSLNY_KIERUNKOWY } from './kierunkowe';
import { odswiezCennik } from './ceny-na-stronie';

type Jezyk = 'pl' | 'en' | 'de';
const KLUCZ = 'sbs-jezyk-strony';

let jezyk: Jezyk = 'pl';
// Polski oryginał każdego bloku — zdjęty ze strony przy pierwszym uruchomieniu, zanim cokolwiek
// podmienimy. Bez tego powrót na polski musiałby przeładować stronę.
const oryginaly = new Map<string, string>();

function zapamietajOryginaly() {
  if (oryginaly.size) return;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const id = el.dataset.i18n!;
    if (!oryginaly.has(id)) oryginaly.set(id, el.innerHTML);
  });
}

// Atrybuty tłumaczone osobno — podpowiedź w polu i opis przycisku nie są treścią elementu.
//
// Oryginał pamiętamy pod kluczem złożonym z nazwy atrybutu i identyfikatora, bo ten sam
// identyfikator („oko-pokaz") bywa użyty przy kilku przyciskach naraz.
function podmienAtrybuty(j: Jezyk) {
  const atrybut = (selektor: string, pole: string, atr: string[]) => {
    document.querySelectorAll<HTMLElement>(selektor).forEach((el) => {
      const id = el.dataset[pole as keyof DOMStringMap] as string;
      const wpis = STRONA[id];
      if (!wpis) return;
      atr.forEach((a) => {
        const klucz = a + ':' + id;
        if (!oryginaly.has(klucz)) oryginaly.set(klucz, el.getAttribute(a) || '');
        el.setAttribute(a, j === 'pl' ? oryginaly.get(klucz)! : wpis[j]);
      });
    });
  };
  atrybut('[data-i18n-ph]', 'i18nPh', ['placeholder']);
  // Przycisk podglądu hasła: to samo słowo trafia w podpowiedź i w opis dla czytnika ekranu.
  atrybut('[data-i18n-title]', 'i18nTitle', ['title', 'aria-label']);
}

// LISTA KIERUNKOWYCH — nazwy krajów w języku strony.
//
// Przebudowujemy ją przy każdej zmianie języka, bo „Niemcy" po niemiecku to „Deutschland" i ktoś,
// kto czyta stronę po niemiecku, szuka właśnie tego słowa. Wybór użytkownika przeżywa przełączenie:
// zapamiętujemy kierunkowy, a nie pozycję na liście.
function odswiezKierunkowe(j: Jezyk) {
  const select = document.getElementById('kierunkowy') as HTMLSelectElement | null;
  if (!select) return;
  // Czy człowiek już sam wybrał? Jeśli nie, podpowiadamy kraj pasujący do języka strony.
  const ruszony = select.dataset.ruszony === '1';
  const bylo = select.value;
  const lista = KIERUNKOWE.slice();
  // KIERUNKOWY PRZED NAZWĄ KRAJU — i to nie jest kwestia gustu. Zamknięta lista jest wąska,
  // więc długie nazwy („Bośnia i Hercegowina") i tak zostaną przycięte. Gdy pierwszy stoi numer,
  // przycięcie nie szkodzi: widać to, co w tym polu naprawdę ważne.
  select.innerHTML = lista.map((k) =>
    `<option value="${k.kod}" title="${k[j]}">${k.kod} ${k[j]}</option>`).join('');
  select.value = ruszony && bylo ? bylo : (DOMYSLNY_KIERUNKOWY[j] || '+48');
  if (!select.dataset.podpiety) {
    select.addEventListener('change', () => { select.dataset.ruszony = '1'; });
    select.dataset.podpiety = '1';
  }
}

export function ustawJezykStrony(j: Jezyk) {
  zapamietajOryginaly();
  jezyk = j;
  try { localStorage.setItem(KLUCZ, j); } catch (e) { /* tryb prywatny */ }

  document.documentElement.lang = j;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const id = el.dataset.i18n!;
    const wpis = STRONA[id];
    if (j === 'pl') {
      const org = oryginaly.get(id);
      if (org !== undefined) el.innerHTML = org;
      return;
    }
    // Brak przekładu zostawia polski — lepiej jedno polskie zdanie niż dziura w treści.
    if (wpis && wpis[j]) el.innerHTML = wpis[j];
  });
  podmienAtrybuty(j);
  odswiezKierunkowe(j);
  // Cennik odświeżamy razem z językiem, bo język rozstrzyga o walucie: polski czyta ceny
  // w złotych, angielski i niemiecki w euro.
  odswiezCennik(j);

  // Pasek „Wybrany pakiet" rysuje się dopiero po kliknięciu, więc jego etykietę podajemy
  // z wyprzedzeniem w atrybucie — inaczej po zmianie języka zostałaby poprzednia.
  const pasek = document.getElementById('pasek-pakietu');
  if (pasek) {
    const wpis = STRONA['pakiet-wybrany'];
    const etykieta = j === 'pl' ? 'Wybrany pakiet:' : (wpis ? wpis[j] : 'Wybrany pakiet:');
    pasek.dataset.etykieta = etykieta;
    const mocne = pasek.querySelector('strong');
    if (mocne) pasek.innerHTML = `${etykieta} <strong>${mocne.textContent}</strong>`;
  }

  // Tytuł karty i opis dla wyszukiwarek nie są widoczne na stronie, ale to one trafiają do
  // zakładek i wyników wyszukiwania — po przełączeniu języka mają się zgadzać z treścią.
  const tytul = STRONA['meta-title'];
  const opis = STRONA['meta-desc'];
  if (!oryginaly.has('doc:title')) oryginaly.set('doc:title', document.title);
  document.title = j === 'pl' ? oryginaly.get('doc:title')! : (tytul ? tytul[j] : document.title);
  const metaOpis = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (metaOpis) {
    if (!oryginaly.has('doc:desc')) oryginaly.set('doc:desc', metaOpis.content);
    metaOpis.content = j === 'pl' ? oryginaly.get('doc:desc')! : (opis ? opis[j] : metaOpis.content);
  }

  odswiezPrzyciski();
}

function odswiezPrzyciski() {
  document.querySelectorAll<HTMLButtonElement>('.jezyk-strony button').forEach((b) => {
    const wybrany = b.dataset.jezyk === jezyk;
    b.setAttribute('aria-pressed', wybrany ? 'true' : 'false');
  });
}

export function uruchomPrzelacznikJezyka() {
  const host = document.querySelector('.jezyk-strony');
  if (!host) return;
  host.innerHTML = JEZYKI.map((j) =>
    `<button type="button" data-jezyk="${j.kod}" title="${j.tytul}" aria-pressed="false">`
    + `<span class="flaga">${FLAGI[j.kod]}</span><span>${j.etykieta}</span></button>`
  ).join('');
  host.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.addEventListener('click', () => ustawJezykStrony(b.dataset.jezyk as Jezyk));
  });

  let zapisany: Jezyk = 'pl';
  try {
    const z = localStorage.getItem(KLUCZ);
    if (z === 'en' || z === 'de') zapisany = z;
  } catch (e) { /* tryb prywatny */ }
  ustawJezykStrony(zapisany);
}
