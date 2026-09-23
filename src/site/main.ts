// Strona publiczna — jedyna logika, jaka jest tu potrzebna: formularz zgłoszenia o dostęp.
//
// Klienta bazy wczytujemy DOPIERO przy wysyłce formularza (import dynamiczny). Powód jest
// praktyczny: gdy w danym środowisku brakuje kluczy do bazy, moduł klienta wywala się już przy
// wczytywaniu — a strona wizytówkowa musi się pokazać zawsze, nawet gdy zaplecze akurat nie działa.
// Przy takiej awarii nie działa wyłącznie sam formularz, a zgłaszający dostaje adres e-mail.

import { uruchomPrzelacznikJezyka } from "./jezyk";
import { zlozNumer } from "./kierunkowe";

const rok = document.getElementById("rok");
if (rok) rok.textContent = String(new Date().getFullYear());

// Wybór języka: polski, angielski, niemiecki. Uruchamiamy od razu, przed resztą — ktoś, kto nie
// czyta po polsku, ma zobaczyć swoją wersję zamiast mignięcia polskiej treści.
uruchomPrzelacznikJezyka();

// ---------------------------------------------------------------------------
// Odsłanianie sekcji przy przewijaniu
// ---------------------------------------------------------------------------
//
// Klasę „js" nakładamy dopiero tutaj, i to jest cała ostrożność tego rozwiązania: stan początkowy
// (przezroczystość) opisuje reguła `.js [data-anim]`, więc gdy skrypt się nie wykona — bo przeglądarka
// go zablokowała albo plik nie doszedł — strona po prostu jest widoczna, zamiast zostać pustą kartką.
//
// Ruch dostają elementy raz: po odsłonięciu przestajemy je obserwować. Karty wracające do widoku przy
// każdym przewinięciu w górę i w dół migają, a to męczy przy dłuższym czytaniu.
const doOdsloniecia = Array.from(document.querySelectorAll<HTMLElement>("[data-anim]"));
const ruchDozwolony = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (doOdsloniecia.length && ruchDozwolony && "IntersectionObserver" in window) {
  document.documentElement.classList.add("js");

  const obserwator = new IntersectionObserver(
    (wpisy) => {
      wpisy.forEach((wpis) => {
        if (!wpis.isIntersecting) return;
        const el = wpis.target as HTMLElement;
        // Drobne opóźnienie wg kolejności w rzędzie — sąsiadujące karty wchodzą jedna po drugiej,
        // zamiast wskakiwać wszystkie naraz jak jeden blok.
        const rodzenstwo = Array.from(el.parentElement?.children || []);
        el.style.transitionDelay = Math.min(rodzenstwo.indexOf(el), 5) * 70 + "ms";
        el.classList.add("widoczne");
        obserwator.unobserve(el);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
  );

  doOdsloniecia.forEach((el) => obserwator.observe(el));
}

// PODGLĄD HASŁA.
//
// Hasło wpisuje się w ciemno, a przy zakładaniu konta trzeba je wpisać dwa razy — bez podglądu
// pomyłka wychodzi dopiero przy pierwszym logowaniu. Oczko pokazuje treść na żądanie.
//
// Ikona rysowana, nie emoji ani znak z kroju pisma: emoji oka i „👁" wyglądają inaczej na każdym
// systemie, a na części Windowsów nie rysują się wcale. Te dwie ścieżki SVG wyglądają wszędzie
// tak samo. Przycisk ma type="button", bo bez tego kliknięcie wysyłałoby formularz.
const OKO_OTWARTE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" focusable="false">'
  + '<path d="M1.8 12s3.8-7 10.2-7 10.2 7 10.2 7-3.8 7-10.2 7S1.8 12 1.8 12z" stroke-linejoin="round"/>'
  + '<circle cx="12" cy="12" r="3.2"/></svg>';
const OKO_ZAMKNIETE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" focusable="false">'
  + '<path d="M1.8 12s3.8-7 10.2-7 10.2 7 10.2 7-3.8 7-10.2 7S1.8 12 1.8 12z" stroke-linejoin="round"/>'
  + '<circle cx="12" cy="12" r="3.2"/>'
  + '<path d="M3.5 3.5l17 17" stroke-linecap="round"/></svg>';

document.querySelectorAll<HTMLButtonElement>(".oko").forEach((btn) => {
  const pole = document.querySelector<HTMLInputElement>(`input[name="${btn.dataset.oko}"]`);
  if (!pole) return;
  btn.innerHTML = OKO_OTWARTE;
  btn.addEventListener("click", () => {
    const widoczne = pole.type === "text";
    pole.type = widoczne ? "password" : "text";
    btn.innerHTML = widoczne ? OKO_OTWARTE : OKO_ZAMKNIETE;
    // Podpowiedź musi mówić, co się stanie PO kliknięciu, a nie jaki jest stan teraz.
    btn.dataset.i18nTitle = widoczne ? "oko-pokaz" : "oko-ukryj";
    const opis = widoczne ? "Pokaż hasło" : "Ukryj hasło";
    btn.title = opis;
    btn.setAttribute("aria-label", opis);
    // Kursor wraca do pola — inaczej po podejrzeniu trzeba w nie klikać z powrotem.
    pole.focus();
  });
});

// WYBÓR PAKIETU.
//
// Przycisk przy pakiecie robi dwie rzeczy naraz: przenosi do formularza i ZAPAMIĘTUJE, o co
// konkretnie chodzi. Bez tego drugiego zgłoszenia przychodziłyby bez informacji, które rozgrywki
// kogo interesują — a to jedyne pytanie, na które ta sekcja ma odpowiadać.
//
// Wybór jest widoczny nad formularzem, bo po przewinięciu w dół nie widać już, w co się kliknęło.
const poleWybranego = document.getElementById("wybrany-pakiet") as HTMLInputElement | null;
const pasekPakietu = document.getElementById("pasek-pakietu");

function pokazWybranyPakiet(nazwa: string) {
  if (!poleWybranego || !pasekPakietu) return;
  poleWybranego.value = nazwa;
  // Etykieta idzie za językiem strony — ten sam słownik, co reszta.
  const etykieta = pasekPakietu.dataset.etykieta || "Wybrany pakiet:";
  pasekPakietu.innerHTML = `${etykieta} <strong>${nazwa}</strong>`;
  pasekPakietu.hidden = false;
}

document.querySelectorAll<HTMLButtonElement>(".wez-pakiet").forEach((btn) => {
  btn.addEventListener("click", () => {
    pokazWybranyPakiet(btn.dataset.pakiet || "");
    const cel = document.getElementById("dostep");
    if (cel) cel.scrollIntoView({ behavior: "smooth", block: "start" });
    // Kursor do pierwszego pola — kto kliknął „poproś o dostęp", chce od razu pisać,
    // a nie szukać, gdzie zacząć. Po przewinięciu, żeby strona nie skoczyła dwa razy.
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>('input[name="imieNazwisko"]')?.focus({ preventScroll: true });
    }, 450);
  });
});

const form = document.getElementById("form-dostep") as HTMLFormElement | null;
// Nazwa „status" jest zajęta przez globalne window.status (zwykły tekst) — stąd przyrostek.
const statusEl = document.getElementById("form-status");

function pokaz(tekst: string, rodzaj: "ok" | "err" | "") {
  if (!statusEl) return;
  statusEl.textContent = tekst;
  statusEl.className = "form-status" + (rodzaj ? " " + rodzaj : "");
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dane = new FormData(form);
  const pole = (n: string) => String(dane.get(n) || "").trim();

  const wniosek = {
    imieNazwisko: pole("imieNazwisko"),
    klub: pole("klub"),
    rolaWKlubie: pole("rolaWKlubie"),
    // Numer zapisujemy ZAWSZE z kierunkowym i zawsze tak samo: „+49 170 1234567". Bez tego
    // w kartotece leżałyby obok siebie „507113413", „+48 507 113 413" i „0048507113413" — trzy
    // zapisy tego samego numeru, z których żadnego nie da się porównać ani wybrać jednym klikiem.
    telefon: zlozNumer(pole("telefon"), pole("kierunkowy")),
    pakiet: pole("pakiet"),
    email: pole("email"),
    haslo: String(dane.get("haslo") || ""),
  };

  // Sprawdzamy sami, zamiast polegać na komunikatach przeglądarki — te bywają po angielsku
  // i potrafią wskazać pole schowane poza ekranem.
  if (!wniosek.imieNazwisko || !wniosek.klub) { pokaz("Podaj imię, nazwisko i klub.", "err"); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(wniosek.email)) { pokaz("Podaj poprawny adres e-mail.", "err"); return; }
  if (wniosek.haslo.length < 8) { pokaz("Hasło musi mieć co najmniej 8 znaków.", "err"); return; }
  // Porównujemy PRZED wysłaniem. Konto zakłada się raz, a literówka w haśle wychodzi dopiero
  // przy pierwszym logowaniu — gdy nie ma już jak jej naprawić bez odzyskiwania konta.
  if (wniosek.haslo !== String(dane.get("haslo2") || "")) {
    pokaz("Hasła nie są takie same — sprawdź oba pola.", "err");
    return;
  }
  if (!dane.get("zgoda")) { pokaz("Potrzebna jest zgoda na przetwarzanie danych kontaktowych.", "err"); return; }

  const przycisk = form.querySelector("button[type=submit]") as HTMLButtonElement | null;
  const napis = przycisk?.textContent || "Wyślij zgłoszenie";
  if (przycisk) { przycisk.disabled = true; przycisk.textContent = "Wysyłam…"; }
  pokaz("", "");

  try {
    const { zglosDostep } = await import("../data/auth");
    const r = await zglosDostep(wniosek);
    if (r.ok) {
      form.classList.add("sent");
      form.querySelectorAll("input").forEach((i) => (i.disabled = true));
      if (przycisk) przycisk.textContent = "Zgłoszenie wysłane";
      pokaz(
        "Dziękujemy — zgłoszenie trafiło do administratora systemu. O decyzji poinformujemy e-mailem; " +
          "do tego czasu logowanie nie pokaże żadnych danych.",
        "ok",
      );
      return;
    }
    // „Failed to fetch" nikomu nic nie mówi — przy zerwanym połączeniu podajemy adres,
    // pod którym da się załatwić to samo ręcznie.
    const zerwanePolaczenie = /failed to fetch|networkerror|load failed/i.test(r.error || "");
    pokaz(
      zerwanePolaczenie
        ? "Nie udało się połączyć z systemem. Sprawdź internet albo napisz na kontakt@scoutbasesystem.com — założymy konto ręcznie."
        : r.error || "Nie udało się wysłać zgłoszenia.",
      "err",
    );
  } catch (err) {
    console.error("Zgłoszenie o dostęp nie doszło:", err);
    pokaz(
      "Nie udało się połączyć z systemem. Napisz na kontakt@scoutbasesystem.com — założymy konto ręcznie.",
      "err",
    );
  } finally {
    if (przycisk && !form.classList.contains("sent")) { przycisk.disabled = false; przycisk.textContent = napis; }
  }
});
