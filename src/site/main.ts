// Strona publiczna — jedyna logika, jaka jest tu potrzebna: formularz zgłoszenia o dostęp.
//
// Klienta bazy wczytujemy DOPIERO przy wysyłce formularza (import dynamiczny). Powód jest
// praktyczny: gdy w danym środowisku brakuje kluczy do bazy, moduł klienta wywala się już przy
// wczytywaniu — a strona wizytówkowa musi się pokazać zawsze, nawet gdy zaplecze akurat nie działa.
// Przy takiej awarii nie działa wyłącznie sam formularz, a zgłaszający dostaje adres e-mail.

const rok = document.getElementById("rok");
if (rok) rok.textContent = String(new Date().getFullYear());

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
    telefon: pole("telefon"),
    email: pole("email"),
    haslo: String(dane.get("haslo") || ""),
  };

  // Sprawdzamy sami, zamiast polegać na komunikatach przeglądarki — te bywają po angielsku
  // i potrafią wskazać pole schowane poza ekranem.
  if (!wniosek.imieNazwisko || !wniosek.klub) { pokaz("Podaj imię, nazwisko i klub.", "err"); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(wniosek.email)) { pokaz("Podaj poprawny adres e-mail.", "err"); return; }
  if (wniosek.haslo.length < 8) { pokaz("Hasło musi mieć co najmniej 8 znaków.", "err"); return; }
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
