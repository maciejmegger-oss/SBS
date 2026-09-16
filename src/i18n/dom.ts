// PRZEŁĄCZNIK JĘZYKA — tłumaczenie tego, co jest narysowane na stronie.
//
// Mechanizm: słownik z src/i18n/en.ts + tłumacz z src/i18n/tlumacz.ts. Po włączeniu angielskiego
// tłumaczymy całą stronę, a obserwator zmian tłumaczy każdy nowy fragment: przerysowany widok, okno,
// komunikat. Oryginalne napisy pamiętamy przy węzłach, więc powrót na polski je przywraca bez
// przeładowania strony. Nie ruszamy pól do pisania (textarea), kodu i elementów z data-bez-tlumaczenia.
//
// Wybór zapamiętuje przeglądarka (localStorage) — tak samo jak motyw jasny/ciemny.

import { zbudujTlumacza } from './tlumacz';
import { EN } from './en';

type Jezyk = 'pl' | 'en';
const KLUCZ = 'sbs-jezyk';
const ATRYBUTY = ['placeholder', 'title', 'aria-label', 'alt'];
const POMIN = 'script, style, textarea, code, pre, [data-bez-tlumaczenia], [contenteditable="true"]';

let jezyk: Jezyk = 'pl';
const tlumacz = zbudujTlumacza(EN);

const oryginalTekstu = new WeakMap<Node, string>();
const tlumaczenieTekstu = new WeakMap<Node, string>();
const oryginalAtr = new WeakMap<Element, Map<string, string>>();
const tlumaczenieAtr = new WeakMap<Element, Map<string, string>>();

export const jezykInterfejsu = (): Jezyk => jezyk;

const pomijany = (el: Element | null) => !!(el && el.closest && el.closest(POMIN));

function tekstWezla(n: Text) {
  const obecny = n.nodeValue || '';
  if (tlumaczenieTekstu.get(n) === obecny) return;          // już przetłumaczony — nasza własna zmiana
  if (pomijany(n.parentElement)) return;
  const przetl = tlumacz(obecny);
  if (przetl !== obecny) {
    oryginalTekstu.set(n, obecny);
    tlumaczenieTekstu.set(n, przetl);
    n.nodeValue = przetl;
  } else {
    oryginalTekstu.delete(n);
    tlumaczenieTekstu.delete(n);
  }
}

function atrybutElementu(el: Element, a: string) {
  const obecny = el.getAttribute(a);
  if (obecny == null) return;
  const tl = tlumaczenieAtr.get(el);
  if (tl && tl.get(a) === obecny) return;
  if (pomijany(el)) return;
  const przetl = tlumacz(obecny);
  if (przetl === obecny) {
    if (tl) tl.delete(a);
    const org = oryginalAtr.get(el);
    if (org) org.delete(a);
    return;
  }
  if (!oryginalAtr.has(el)) oryginalAtr.set(el, new Map());
  if (!tlumaczenieAtr.has(el)) tlumaczenieAtr.set(el, new Map());
  oryginalAtr.get(el)!.set(a, obecny);
  tlumaczenieAtr.get(el)!.set(a, przetl);
  el.setAttribute(a, przetl);
}

function przetlumaczPoddrzewo(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { tekstWezla(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (pomijany(el)) return;
  ATRYBUTY.forEach((a) => atrybutElementu(el, a));
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE && (n as Element).matches(POMIN))
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  let n: Node | null;
  while ((n = w.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) tekstWezla(n as Text);
    else ATRYBUTY.forEach((a) => atrybutElementu(n as Element, a));
  }
}

function przywrocPoddrzewo(root: Element) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null = root;
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = tlumaczenieTekstu.get(n);
      if (t !== undefined && n.nodeValue === t) n.nodeValue = oryginalTekstu.get(n) ?? n.nodeValue;
      tlumaczenieTekstu.delete(n);
      oryginalTekstu.delete(n);
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as Element;
      const tl = tlumaczenieAtr.get(el);
      if (tl) {
        const org = oryginalAtr.get(el);
        tl.forEach((v, a) => { if (el.getAttribute(a) === v && org && org.has(a)) el.setAttribute(a, org.get(a)!); });
        tlumaczenieAtr.delete(el);
        oryginalAtr.delete(el);
      }
    }
    n = w.nextNode();
  }
}

let obserwator: MutationObserver | null = null;
function obserwuj() {
  if (obserwator || !document.body) return;
  obserwator = new MutationObserver((zmiany) => {
    if (jezyk !== 'en') return;
    for (const z of zmiany) {
      if (z.type === 'childList') z.addedNodes.forEach((n) => przetlumaczPoddrzewo(n));
      else if (z.type === 'characterData') tekstWezla(z.target as Text);
      else if (z.type === 'attributes' && z.attributeName) atrybutElementu(z.target as Element, z.attributeName);
    }
  });
  obserwator.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRYBUTY });
}

// Okienka przeglądarki (alert/confirm/prompt) nie są częścią strony — tłumaczymy je linia po linii.
function owinDialogi() {
  const w = window as any;
  if (w.__sbsDialogiOwiniete) return;
  w.__sbsDialogiOwiniete = true;
  const przez = (m: unknown) => (jezyk === 'en' && typeof m === 'string') ? m.split('\n').map((l) => tlumacz(l)).join('\n') : m;
  const alert0 = window.alert.bind(window);
  const confirm0 = window.confirm.bind(window);
  const prompt0 = window.prompt.bind(window);
  window.alert = (m?: any) => alert0(przez(m));
  window.confirm = (m?: any) => confirm0(przez(m) as any);
  window.prompt = (m?: any, d?: any) => prompt0(przez(m) as any, d);
}

export function odswiezPrzelacznikJezyka() {
  const btn = document.getElementById('lang-toggle');
  if (!btn) return;
  btn.setAttribute('data-bez-tlumaczenia', '');
  btn.innerHTML = jezyk === 'en' ? '🇵🇱 <span>Polski</span>' : '🇬🇧 <span>English</span>';
  btn.title = jezyk === 'en' ? 'Przełącz na polski / Switch to Polish' : 'Switch to English / Przełącz na angielski';
  btn.onclick = () => ustawJezyk(jezyk === 'en' ? 'pl' : 'en');
}

export function ustawJezyk(nowy: Jezyk) {
  jezyk = nowy;
  try { localStorage.setItem(KLUCZ, nowy); } catch (e) { /* tryb prywatny */ }
  document.documentElement.lang = nowy;
  if (document.body) {
    if (nowy === 'en') przetlumaczPoddrzewo(document.body);
    else przywrocPoddrzewo(document.body);
  }
  odswiezPrzelacznikJezyka();
}

export function uruchomTlumaczenie() {
  owinDialogi();
  obserwuj();
  let zapisany: Jezyk = 'pl';
  try { zapisany = localStorage.getItem(KLUCZ) === 'en' ? 'en' : 'pl'; } catch (e) { /* tryb prywatny */ }
  if (zapisany === 'en') ustawJezyk('en');
  else odswiezPrzelacznikJezyka();
}
