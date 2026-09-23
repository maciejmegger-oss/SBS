// PODGLĄD WPISYWANEGO HASŁA — „oczko" przy polu.
//
// PO CO
// Hasło wpisuje się w ciemno, a przy zakładaniu konta trzeba je wpisać dwa razy. Bez podglądu
// pomyłka wychodzi dopiero przy pierwszym logowaniu — i wtedy nie wiadomo, czy hasło jest złe,
// czy tylko literówka poszła w obie kopie naraz. Na telefonie, gdzie klawiatura podmienia znaki
// i zostawia wielkie litery, dzieje się to notorycznie.
//
// DLACZEGO IKONA JEST RYSOWANA, A NIE PISANA
// Emoji oka („👁") wygląda inaczej na każdym systemie, a na części Windowsów nie rysuje się wcale —
// zostaje pusty kwadrat albo nic. Te dwie ścieżki SVG wyglądają wszędzie tak samo.
//
// DLACZEGO type="button"
// Bez tego przycisk wewnątrz formularza jest przyciskiem wysyłającym: kliknięcie w oczko
// wysyłałoby zgłoszenie zamiast pokazać hasło.
//
// TEN PLIK JEST WSPÓLNY dla strony publicznej (formularz zgłoszenia) i aplikacji (ekran logowania
// i ustawiania nowego hasła). Dwie kopie tego samego oczka rozjechałyby się przy pierwszej
// poprawce — a użytkownik widzi oba w odstępie kilku minut, więc mają wyglądać identycznie.

export const OKO_OTWARTE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" focusable="false">'
  + '<path d="M1.8 12s3.8-7 10.2-7 10.2 7 10.2 7-3.8 7-10.2 7S1.8 12 1.8 12z" stroke-linejoin="round"/>'
  + '<circle cx="12" cy="12" r="3.2"/></svg>';

export const OKO_ZAMKNIETE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" focusable="false">'
  + '<path d="M1.8 12s3.8-7 10.2-7 10.2 7 10.2 7-3.8 7-10.2 7S1.8 12 1.8 12z" stroke-linejoin="round"/>'
  + '<circle cx="12" cy="12" r="3.2"/>'
  + '<path d="M3.5 3.5l17 17" stroke-linecap="round"/></svg>';

// Podpięcie oczka do pary przycisk + pole.
//
// `poPrzelaczeniu` dostaje informację, czy hasło jest OD TERAZ ukryte — strona publiczna korzysta
// z tego, żeby zaktualizować klucz tłumaczenia podpowiedzi. Aplikacja nie musi nic robić: jej
// tłumacz obserwuje zmiany atrybutów i sam przekłada nowy tytuł.
export function podepnijOczko(
  btn: HTMLButtonElement,
  pole: HTMLInputElement,
  poPrzelaczeniu?: (ukryte: boolean) => void,
): void {
  btn.innerHTML = OKO_OTWARTE;
  btn.addEventListener('click', () => {
    const bylWidoczny = pole.type === 'text';
    pole.type = bylWidoczny ? 'password' : 'text';
    btn.innerHTML = bylWidoczny ? OKO_OTWARTE : OKO_ZAMKNIETE;
    // Podpowiedź mówi, co się stanie PO kliknięciu, a nie jaki jest stan teraz.
    const opis = bylWidoczny ? 'Pokaż hasło' : 'Ukryj hasło';
    btn.title = opis;
    btn.setAttribute('aria-label', opis);
    if (poPrzelaczeniu) poPrzelaczeniu(bylWidoczny);
    // Kursor wraca do pola — inaczej po podejrzeniu trzeba w nie klikać z powrotem.
    pole.focus();
  });
}
