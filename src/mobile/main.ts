// SBS Scout Live — panel mobilny do obserwacji w trakcie meczu.
//
// Osobne wejście obok aplikacji na komputerze (index.html), ta sama baza, to samo logowanie.
// Podział pracy jest celowy: telefon REJESTRUJE (zdarzenia z minutą meczu, oceny w skalach),
// komputer REDAGUJE (opisy, PDF, analizy). Dlatego nie ma tu prób odtworzenia całego SBS —
// są cztery ekrany, które da się obsłużyć jedną ręką, stojąc.

import "./style.css";
import { currentUser, signIn, signOut, requestPasswordReset, mojeKonto, type Konto } from "../data/auth";
import {
  uid, getCache, refreshCache, patchCache, flushQueue, queueLength,
  saveObservation, saveReport, savePlayerStatus, saveLiveEvents, deleteObservation,
  zablokowaneZadania, liczbaZablokowanych, ponowZablokowane, ostatniBladWysylki,
  getLive, setLive, getScout, setScout, zarchiwizujZdarzenia, zdarzeniaObserwacji,
  wyczyscKopieBazy,
  type Cache, type LiveEvent, type LiveState, type Period,
} from "./db";
import type { Observation, Report } from "../types";

// ---------------------------------------------------------------------------
// Stałe — CELOWO identyczne z aplikacją na komputerze (src/main.ts).
// Klucze muszą się zgadzać co do znaku, bo na nich opierają się radar, średnie i wykresy w SBS.
// ---------------------------------------------------------------------------

const RATING_KEYS = ["technika", "taktyka", "motoryka", "mentalnosc", "potencjal"] as const;
const RATING_LABELS: Record<string, string> = {
  technika: "Technika", taktyka: "Taktyka", motoryka: "Motoryka",
  mentalnosc: "Mentalność", potencjal: "Potencjał",
};
const REPORT_PHASES = [
  { key: "fazaAtaku", label: "Faza ataku" },
  { key: "fazaPrzejsciaAtakObrona", label: "Przejście atak → obrona" },
  { key: "fazaObrony", label: "Faza obrony" },
  { key: "fazaPrzejsciaObronaAtak", label: "Przejście obrona → atak" },
];
const REPORT_SET_PIECES = [
  { key: "rzutRoznyObrona", label: "Rzut rożny — obrona" },
  { key: "rzutRoznyAtak", label: "Rzut rożny — atak" },
  { key: "rzutWolnyAtak", label: "Rzut wolny — atak" },
  { key: "rzutWolnyObrona", label: "Rzut wolny — obrona" },
];
const STATUS_OPTIONS = [
  { value: "Do Obserwacji", label: "Do obserwacji" },
  { value: "Na Testy", label: "Testy" },
  { value: "Do transferu", label: "Do transferu" },
  { value: "Z polecenia", label: "Z polecenia" },
  { value: "Odrzucony", label: "Odrzucony" },
];
const PERSPEKTYWA = ["WYSOKA", "ŚREDNIA", "NISKA"];

// OCENA SPOTKANIA, nie zawodnika. Przy jednej obserwacji na mecz to ona jest kontekstem dla
// wszystkich ocen indywidualnych: te same osiem na dziesięć znaczy co innego w rywalizacji
// o czubek tabeli i co innego w meczu rozstrzygniętym do przerwy, i co innego w ulewie.
const WARUNKI = ["Słonecznie", "Pochmurno", "Deszcz", "Silny wiatr", "Upał", "Mróz", "Śnieg", "Sztuczne światło"];

// Części meczu. `offset` to minuta, od której zaczyna się liczenie w danej części — dzięki temu
// zdarzenie z dogrywki ma minutę 97, a nie 7, i zgadza się z tym, co pokazuje tablica na stadionie.
// Doliczony czas nie wymaga osobnej obsługi: zegar nie zatrzymuje się na 45:00 ani 90:00, tylko
// biegnie dalej, więc gol w doliczonym czasie pierwszej połowy zapisze się jako 46' lub 47'.
const PERIODS: { n: Period; label: string; offset: number }[] = [
  { n: 1, label: "1. połowa", offset: 0 },
  { n: 2, label: "2. połowa", offset: 45 },
  { n: 3, label: "1. dogrywka", offset: 90 },
  { n: 4, label: "2. dogrywka", offset: 105 },
];
const periodOf = (n: Period) => PERIODS.find((p) => p.n === n) || PERIODS[0];

// Zdarzenia rejestrowane jednym dotknięciem. Dziewięć kafli to maksimum, jakie mieści się na
// ekranie telefonu bez przewijania — a przewijanie w trakcie akcji oznacza przegapioną akcję.
const EVENT_TAGS = [
  { key: "podanie_kluczowe", label: "Podanie kluczowe" },
  { key: "strzal", label: "Strzał" },
  { key: "drybling", label: "Drybling" },
  { key: "pojedynek", label: "Pojedynek" },
  { key: "gra_glowa", label: "Gra głową" },
  { key: "odbior", label: "Odbiór" },
  { key: "strata", label: "Strata" },
  { key: "ustawienie", label: "Ustawienie" },
  { key: "gol", label: "Gol" },
  { key: "asysta", label: "Asysta" },
];

// ---------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const pad = (n: number) => (n < 10 ? "0" : "") + n;
const todayISO = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Motyw jasny / ciemny
// ---------------------------------------------------------------------------
//
// Mecze gra się o różnych porach: ciemny ekran wieczorem nie oślepia i oszczędza baterię,
// ale w pełnym słońcu jest nieczytelny. Wybór zapamiętujemy w telefonie, bo scout ustawia go
// raz na dane warunki, a nie przy każdym uruchomieniu.
//
// Domyślnie idziemy za ustawieniem systemu — telefony same przełączają się na ciemny o zmroku,
// więc bez wskazania użytkownika to najlepsze przybliżenie pory dnia, jakie mamy.

const THEME_KEY = "sbs-m:theme";
type Theme = "light" | "dark";

const systemTheme = (): Theme =>
  window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";

const storedTheme = (): Theme | null => {
  const v = localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" ? v : null;
};

const activeTheme = (): Theme => storedTheme() || systemTheme();

function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  // Pasek stanu telefonu ma kolor z tego znacznika. Bez podmiany w trybie jasnym zostawałby
  // ciemnozielony i odcinał się od reszty ekranu.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "light" ? "#F6F3EA" : "#16302A");
}

// Przełączenie NIE przerysowuje widoku. Cały wygląd wisi na zmiennych CSS, więc podmiana
// znacznika wystarcza — a przerysowanie skasowałoby to, co scout ma właśnie wpisane w notatce
// do minuty albo w opisie po meczu. Poprawiamy tylko sam przycisk.
function themeButtonHtml(): string {
  const jasny = activeTheme() === "light";
  return `<button class="theme-btn" data-act="theme" aria-label="${jasny ? "Przełącz na ciemny ekran" : "Przełącz na jasny ekran"}">${jasny ? ICON_MOON : ICON_SUN}</button>`;
}

function updateThemeButton() {
  const btn = document.querySelector(".topbar .theme-btn");
  if (btn) btn.outerHTML = themeButtonHtml();
}

function toggleTheme() {
  const nowy: Theme = activeTheme() === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, nowy);
  applyTheme(nowy);
  updateThemeButton();
}

// Ustawiamy motyw natychmiast przy wczytaniu skryptu, przed pierwszym rysowaniem — inaczej
// przy jasnym motywie mignęłoby ciemne tło.
applyTheme(activeTheme());

// ---------------------------------------------------------------------------
// EFEKTY RUCHU
// ---------------------------------------------------------------------------
//
// iPhone ma ustawienie „Ogranicz ruch" (Dostępność → Ruch), a przeglądarka podaje je stronie jako
// prefers-reduced-motion. Panel to szanował i wyłączał animacje — i słusznie, bo dla części ludzi
// ruch na ekranie to zawroty głowy, a nie ozdoba.
//
// Tyle że to ustawienie bywa włączone z zupełnie innych powodów (oszczędzanie baterii, dawna
// decyzja, o której nikt już nie pamięta), a wtedy właściciel telefonu widzi martwy ekran
// powitalny i nieruchomy herb, nie mając pojęcia dlaczego. Dlatego podpowiedź systemu zostaje
// DOMYŚLNA, ale nie ostateczna: własny wybór w Ustawieniach jest ważniejszy, dokładnie tak samo
// jak przy jasnym i ciemnym ekranie.
//
// Rozstrzygnięcie zapada TUTAJ, w jednym miejscu, i ląduje w atrybucie data-ruch na <html>.
// Arkusz stylów nie pyta już systemu o zdanie — patrzy wyłącznie na ten atrybut. Bez tego każdą
// regułę trzeba by pisać dwa razy: raz w zapytaniu medialnym, raz dla wymuszenia.
type Ruch = "system" | "pelne" | "oszczedne";
const RUCH_KEY = "sbs-m:ruch";

const wybranyRuch = (): Ruch => {
  const v = localStorage.getItem(RUCH_KEY);
  return v === "pelne" || v === "oszczedne" ? v : "system";
};
const systemOgraniczaRuch = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Trzy stany, nie dwa — bo „system prosi o spokój" i „scout wyłączył efekty" to nie to samo:
//
//   pelne             — ruch wszędzie
//   system-oszczedne  — system prosi o spokój, ale scout sam niczego nie wybrał. Wyciszamy to,
//                       co dzieje się W TRAKCIE PRACY (kręcący się herb przy odświeżaniu,
//                       przenikanie komunikatów), a ZOSTAWIAMY ekran powitalny i logowania.
//                       Tam ruch nie przeszkadza w niczym: nikt wtedy nie rejestruje akcji,
//                       a to jedyne dwa ekrany, na których aplikacja się przedstawia.
//   oszczedne         — scout wyłączył efekty jawnie. Wtedy gasną wszystkie, bez wyjątku:
//                       jawny wybór musi znaczyć dokładnie to, co mówi.
function zastosujRuch(): void {
  const wybor = wybranyRuch();
  document.documentElement.dataset.ruch =
    wybor === "oszczedne" ? "oszczedne"
    : wybor === "pelne" ? "pelne"
    : systemOgraniczaRuch() ? "system-oszczedne"
    : "pelne";
}

zastosujRuch();
window.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", () => {
  if (wybranyRuch() === "system") zastosujRuch();
});

// Zmiana ustawienia systemowego (zachód słońca, tryb nocny) przestawia panel tylko wtedy, gdy
// scout nie wybrał wariantu sam. Własny wybór jest ważniejszy niż podpowiedź systemu.
window.matchMedia?.("(prefers-color-scheme: light)").addEventListener?.("change", () => {
  if (!storedTheme()) { applyTheme(systemTheme()); updateThemeButton(); }
});

let toastTimer: number | undefined;
function toast(msg: string) {
  let el = $("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove("show"), 2200);
}

// ---------------------------------------------------------------------------
// Stan aplikacji
// ---------------------------------------------------------------------------

type ViewName = "dzis" | "live" | "ocena" | "baza" | "nowa" | "podglad" | "terminarz" | "wklej";
let podgladObsId: string | null = null;
// Wybór z terminarza wypełnia formularz planowania, więc jego treść musi przeżyć przejście
// do listy meczów i z powrotem.
let planMecz = "", planData = "", planGodzina = "", planMiejsce = "";
let planRozgrywki = "", planKategoria = "";
// Czy kategorię wskazał scout, czy tylko podpowiedział ją panel. Po ręcznym wyborze przestajemy
// nadpisywać go rozpoznaniem z nazwy — inaczej dopisanie litery w polu rozgrywek cofałoby poprawkę.
let kategoriaRecznie = false;
let terminarzLiga = "";
let terminarzSzukaj = "";
// Tekst przepisany ze zrzutu ekranu, czekający na rozpoznanie. Trzymany w stanie, a nie tylko
// w polu, żeby przejście do formularza i powrót go nie kasowały.
let wklejTekst = "";
// Która część listy obserwacji jest widoczna: to, co przed nami, czy to, co już rozliczone.
let listaTryb: "nadchodzace" | "zakonczone" = "nadchodzace";

let cache: Cache = getCache();
let view: ViewName = "dzis";
let live: LiveState | null = getLive();
let polarity: 1 | -1 = 1;
// Która zakładka ekranu Live jest widoczna: rejestrowanie zdarzeń czy składy meczu.
let liveTab: "zdarzenia" | "sklady" = "zdarzenia";
// Zakładka Składy ma trzy stany: lista nazwisk, plansza z ustawieniem i panel jednego zawodnika.
let skladWidok: "lista" | "mapa" = "lista";
let skladStrona: "gospodarze" | "goscie" = "gospodarze";
let wyborZKadry: "gospodarze" | "goscie" | null = null;   // otwarta lista kadry klubu z bazy
let obsadzanaPozycja: number | null = null;   // wybrane puste pole na planszy — czeka na zawodnika
let ocenianyZawodnik: number | null = null;   // indeks zawodnika, którego panel oceny jest otwarty
// Czy panel ocen na ekranie zdarzeń jest rozwinięty. Zwinięty pokazuje sam pasek z nazwiskiem
// i tym, co już wystawiono; rozwinięty — pełne skale, kosztem zejścia kafli niżej.
let ocenaRozwinieta = false;
let searchQuery = "";
let clockTimer: number | undefined;
// Czy panel pracuje na sesji użytkownika. Od zamknięcia systemu jest to WARUNEK WEJŚCIA:
// bez sesji panel pokazuje ekran logowania i nic poza nim.
let zalogowany = false;
// Adres konta, na którym pracuje panel. Pokazujemy go przy wylogowaniu, bo scout bywa zalogowany
// innym kontem niż na komputerze — a wtedy widzi pustą bazę i nie ma jak się domyślić dlaczego.
let kontoEmail = "";

// Czy w tle doszła nowsza wersja panelu. Patrz komentarz przy rejestracji mechanizmu offline
// na końcu pliku — bez tego wdrożona poprawka potrafiła tygodniami nie docierać do telefonu.
let nowaWersja = false;

// Formularz oceny — trzymany w pamięci, żeby przełączenie zakładki go nie kasowało.
interface OcenaState {
  observationId: string;
  ratings: Record<string, number>;
  phases: Record<string, number>;
  setPieces: Record<string, number>;
  perspektywa: string;
  status: string;
  description: string;
  setPieceComment: string;
}
let ocena: OcenaState | null = null;

const playerById = (id?: string) => cache.players.find((p) => p.id === id);
const clubName = (id?: string) => cache.clubs.find((c) => c.id === id)?.name || "";
const playerLabel = (id?: string) => {
  const p = playerById(id);
  return p ? [p.firstName, p.lastName].filter(Boolean).join(" ") : "";
};

function startOcena(obsId: string) {
  const obs = cache.observations.find((o) => o.id === obsId);
  const r = (obs?.ratings || {}) as Record<string, number>;
  ocena = {
    observationId: obsId,
    // Puste, nie „domyślne 5". Wstępnie wypełniona ocena jest gorsza niż jej brak — kusi, żeby
    // zostawić ją bez zmian, i w bazie ląduje liczba, której nikt nie wystawił.
    ratings: Object.fromEntries(RATING_KEYS.map((k) => [k, Number(r[k]) || 0])),
    phases: Object.fromEntries(REPORT_PHASES.map((f) => [f.key, 0])),
    setPieces: Object.fromEntries(REPORT_SET_PIECES.map((f) => [f.key, 0])),
    perspektywa: "",
    status: "",
    description: "",
    setPieceComment: "",
  };
}

// ---------------------------------------------------------------------------
// Zegar meczu
// ---------------------------------------------------------------------------

// Czas liczymy ze znacznika startu, a nie przez dodawanie sekundy co tyknięcie. Przeglądarka na
// telefonie usypia karty w tle i tyknięcia przestają przychodzić — po powrocie zegar musi pokazać
// czas rzeczywisty, a nie ten, który zdążył naliczyć.
function liveSeconds(s: LiveState): number {
  if (!s.running || !s.startedAt) return s.seconds;
  return s.seconds + Math.floor((Date.now() - s.startedAt) / 1000);
}
const liveMinute = (s: LiveState): number => Math.floor(liveSeconds(s) / 60) + periodOf(s.half).offset;

function paintClock() {
  if (!live) return;
  const el = $("clock-time");
  if (!el) return;
  el.textContent = liveMinute(live) + ":" + pad(liveSeconds(live) % 60);
}

function startClockTicker() {
  window.clearInterval(clockTimer);
  clockTimer = window.setInterval(paintClock, 1000);
}

// ---------------------------------------------------------------------------
// Widoki
// ---------------------------------------------------------------------------

// Miesiąc po polsku, do nagłówków w zakończonych („Sierpień 2026").
const miesiacPl = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  const nazwa = d.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
  return nazwa.charAt(0).toUpperCase() + nazwa.slice(1);
};

// DATA Z DNIEM TYGODNIA — „sobota, 29.08".
//
// Sam zapis 2026-08-29 nic nie mówi o tym, czy da się na ten mecz pojechać. Scout planuje
// wyjazdy wokół pracy i weekendu, więc dzień tygodnia jest tu ważniejszy niż numer dnia:
// piątek 20:30 i sobota 15:00 to dwie zupełnie różne decyzje.
//
// Rok dopisujemy TYLKO wtedy, gdy nie jest bieżący. Sezon przechodzi przez sylwestra, więc przy
// meczu w styczniu sam „16.01" byłby mylący — ale dokładanie roku do każdego wiersza zamieniłoby
// listę w ścianę cyfr.
function dataZDniem(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;   // data w nieoczekiwanym kształcie — oddajemy jak jest
  const dzien = d.toLocaleDateString("pl-PL", { weekday: "long" });
  const reszta = d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
  const rok = d.getFullYear() !== new Date().getFullYear() ? "." + d.getFullYear() : "";
  return `${dzien}, ${reszta}${rok}`;
}

// Znacznik rozgrywek na karcie. Kategoria jest wyróżniona kolorem, bo to ona rozstrzyga, jak
// czytać ocenę — nazwa rozgrywek stoi obok jako uszczegółowienie, nie zamiast niej.
function ligaChip(o: Observation & { rozgrywki?: string; kategoria?: string }): string {
  const kat = o.kategoria || kategoriaZRozgrywek(o.rozgrywki || "", o.match || "");
  if (!o.rozgrywki && !kat) return "";
  // Nierozpoznana kategoria dostaje barwę NEUTRALNĄ, a nie seniorską. Dotąd „nie wiem" wyglądało
  // dokładnie tak samo jak „seniorzy" — czyli aplikacja twierdziła coś, czego nie ustaliła.
  const barwa = kat === "mlodziez" ? "var(--accent-fg)" : kat === "seniorzy" ? "var(--good-fg)" : "var(--text-2)";
  const opis = [ETYKIETA_KATEGORII[kat] || "", o.rozgrywki || ""].filter(Boolean).join(" · ");
  return `<span style="color:${barwa}; font-weight:650;">${esc(opis)}</span> · `;
}

function kartaObserwacji(o: Observation, dzis: string): string {
  const oceniona = !!o.statsFilledIn;
  const trwa = live && live.observationId === o.id;
  return `
    <div class="card obs-card ${trwa ? "selected" : ""}">
      <div class="row">
        <div style="min-width:0;">
          <div class="name">${esc(o.match || "Mecz bez nazwy")}</div>
          <div class="sub" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(dataZDniem(o.date || ""))}${o.matchTime ? " · " + esc(o.matchTime) : ""}${o.location ? " · " + esc(o.location) : ""}</div>
        </div>
        <span class="tag ${trwa ? "live" : oceniona ? "done" : ""}">${trwa ? "W toku" : oceniona ? "Oceniona" : o.date === dzis ? "Dziś" : "Plan"}</span>
      </div>
      <div class="sub" style="margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${ligaChip(o)}
        ${o.playerId ? "<strong style=\"color:var(--text-strong)\">" + esc(playerLabel(o.playerId)) + "</strong>" : "Obserwacja zespołu"}
        ${o.scout ? " · " + esc(o.scout) : ""}
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn ${trwa ? "" : "ghost"}" data-act="start-live" data-id="${esc(o.id)}">${trwa ? "Wróć" : "Rozpocznij"}</button>
        ${oceniona
          ? `<button class="btn ghost" data-act="podglad" data-id="${esc(o.id)}">Otwórz</button>`
          : `<button class="btn ghost" data-act="open-ocena" data-id="${esc(o.id)}">Oceń</button>`}
        <!-- Kosz jest wąski i stoi z boku: kasowanie ma być dostępne, ale nie pod kciukiem obok
             „Rozpocznij". Pyta o potwierdzenie i podaje nazwę meczu, więc dotknięcie przez pomyłkę
             niczego nie traci. -->
        <button class="btn ghost" style="flex:0 0 auto; width:46px; padding:0;"
                data-act="usun-obserwacje" data-id="${esc(o.id)}"
                aria-label="Usuń obserwację ${esc(o.match || "")}" title="Usuń obserwację">🗑</button>
      </div>
    </div>`;
}

function naglowekObserwacji(podtytul: string): string {
  return `
    <h2>Obserwacje</h2>
    <p class="hint">${podtytul}</p>`;
}

// OBSERWACJE POCHODNE — po jednej na ocenionego zawodnika — NIE POKAZUJĄ SIĘ NA LIŚCIE.
//
// Ocena wystawiona z trybuny zakłada zawodnikowi jego własną obserwację (patrz
// savePlayerRatingsFromSquad): bez tego nie liczyłaby się do jego średniej ani do mapy rankingowej
// w SBS. Identyfikator takiej obserwacji to „<obserwacja meczu>:<zawodnik>".
//
// Na komputerze to jest dokładnie to, czego trzeba. Na liście w telefonie — nie: jeden mecz z
// dziewięcioma wyróżnionymi rozsypywał się na dziesięć kart z tą samą nazwą spotkania, przez które
// trzeba przewijać, żeby znaleźć następny mecz. Obserwacja meczu jest tu jedyną sensowną
// jednostką; nazwiska widać po jej otwarciu.
const jestPochodnaZawodnika = (o: Observation): boolean => {
  const i = String(o.id || "").lastIndexOf(":");
  if (i <= 0) return false;
  const rodzic = o.id.slice(0, i);
  return cache.observations.some((x) => x.id === rodzic);
};

function viewDzis(): string {
  const dzis = todayISO();
  const wczoraj = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

  const przelacznik = `
    <div class="polarity" style="margin-bottom:10px;">
      <button class="pol seg" data-act="lista-tryb" data-v="nadchodzace" aria-pressed="${listaTryb === "nadchodzace"}">Nadchodzące</button>
      <button class="pol seg" data-act="lista-tryb" data-v="zakonczone" aria-pressed="${listaTryb === "zakonczone"}">Zakończone</button>
    </div>`;

  // ZAKOŃCZONE — pogrupowane miesiącami, od najnowszych. Kalendarz na telefonie zajmuje pół
  // ekranu i pokazuje mniej niż zwykła lista; miesiąc jako nagłówek daje ten sam porządek taniej.
  if (listaTryb === "zakonczone") {
    const skonczone = cache.observations
      .filter((o) => !jestPochodnaZawodnika(o))
      .filter((o) => o.statsFilledIn || (o.date || "") < wczoraj)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const wgMiesiaca = new Map<string, Observation[]>();
    skonczone.forEach((o) => {
      const klucz = (o.date || "").slice(0, 7) || "bez daty";
      if (!wgMiesiaca.has(klucz)) wgMiesiaca.set(klucz, []);
      wgMiesiaca.get(klucz)!.push(o);
    });

    return `
      ${naglowekObserwacji("Zakończone i minione · " + skonczone.length)}
      ${przelacznik}
      ${skonczone.length
        ? [...wgMiesiaca.entries()].map(([klucz, lista]) => `
            <div class="section" style="${[...wgMiesiaca.keys()][0] === klucz ? "border-top:none; margin-top:0; padding-top:0;" : ""}">
              <span class="label">${esc(klucz === "bez daty" ? "Bez daty" : miesiacPl(klucz + "-01"))} · ${lista.length}</span>
              ${lista.map((o) => kartaObserwacji(o, dzis)).join("")}
            </div>`).join("")
        : '<div class="empty">Nic jeszcze nie zostało zakończone.</div>'}`;
  }

  const lista = cache.observations
    .filter((o) => !jestPochodnaZawodnika(o))
    .filter((o) => (o.date || "") >= wczoraj && !o.statsFilledIn)
    .sort((a, b) => ((a.date || "") + (a.matchTime || "")).localeCompare((b.date || "") + (b.matchTime || "")));

  return `
    ${naglowekObserwacji("Zaplanowane" + (cache.fetchedAt ? " · kopia z " + new Date(cache.fetchedAt).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""))}
    ${banerIkony()}
    ${przelacznik}
    ${lista.length ? lista.map((o) => kartaObserwacji(o, dzis)).join("") : '<div class="empty">Nic nie czeka.<br>Zaplanuj obserwację albo zajrzyj do zakończonych.</div>'}
    <button class="btn ghost" data-act="go-nowa">+ Zaplanuj obserwację</button>`;
}

// KATEGORIA ROZGRYWEK: SENIORZY CZY MŁODZIEŻ.
//
// Ta sama ocena znaczy co innego w III lidze i w A1, więc lista obserwacji musi to rozróżniać.
// Nazwy rozgrywek nie mówią tego wprost i potrafią mylić: „A1" to juniorzy starsi, ale „klasa A"
// to rozgrywki seniorskie; „CLJ U17" to młodzież, a „IV liga" nie. Dlatego rozpoznanie jest
// PODPOWIEDZIĄ — scout może je jednym dotknięciem zmienić, a wybór zapisuje się przy obserwacji.
//
// Kolejność sprawdzania ma znaczenie. Wzorzec młodzieżowy wymaga litery Z CYFRĄ (A1, B2, C1),
// więc „klasa A" go nie spełnia i trafia dalej, do wzorca seniorskiego.
const MLODZIEZ_WZORCE = [
  /\b[ABCD][12]\b/i,                    // A1, A2, B1, B2, C1, C2, D1, D2
  /\bU-?\d{1,2}\b/i,                    // U19, U17, U15, U13
  /juniorz?k?[aiy]?\b|juniorsk/i,
  /młodzik|mlodzik|młodzicz|mlodzicz/i,
  /trampkarz|orlik|żak\b|zak\b/i,
  /\bCLJ\b/i,                           // Centralna Liga Juniorów
  /młodzieżow|mlodziezow/i,
];
const SENIORZY_WZORCE = [
  /ekstraklasa|ekstraliga|betclic/i,
  /\b(I|II|III|IV|V)\s*liga\b/i,
  /\b[1-5]\s*liga\b/i,
  // Numer ligi bywa zapisany SŁOWNIE — tak podaje go część terminarzy („Pierwsza liga").
  // Bez tego takie rozgrywki nie pasowały do niczego i kończyły się kategorią pustą.
  /\b(pierwsza|druga|trzecia|czwarta|piąta|piata)\s+liga\b/i,
  /klasa\s+[ABC]\b|\b[ABC]\s+klasa|okręgow|okregow/i,
  /puchar\s+polski/i,
];

// NAZWY DRUŻYN TEŻ MÓWIĄ, KTO GRA.
//
// Rozpoznanie czytało wyłącznie nazwę rozgrywek — i przy „Arka Gdynia SA U17 – ŁKS Łódź S.A. U17"
// w rozgrywkach „Pierwsza liga" wychodziły z tego seniorzy, mimo że U17 stoi w nazwie OBU drużyn.
// Rocznik przy nazwie klubu jest informacją równie dobrą jak nazwa rozgrywek, a często lepszą:
// ligi młodzieżowe bywają nazywane tak samo jak seniorskie, bo są ligami tego samego szczebla.
//
// Drużyny sprawdzamy TYLKO pod kątem młodzieży. Brak „U17" przy nazwie nie znaczy, że to seniorzy —
// większość klubów seniorskich nie dopisuje sobie nic — więc w drugą stronę ten sygnał nie działa.
export function kategoriaZRozgrywek(nazwa: string, nazwaMeczu = ""): "seniorzy" | "mlodziez" | "" {
  const n = (nazwa || "").trim();
  const m = (nazwaMeczu || "").trim();
  if (!n && !m) return "";
  if (MLODZIEZ_WZORCE.some((w) => w.test(n) || w.test(m))) return "mlodziez";
  if (SENIORZY_WZORCE.some((w) => w.test(n))) return "seniorzy";
  return "";
}

const ETYKIETA_KATEGORII: Record<string, string> = { seniorzy: "Seniorzy", mlodziez: "Młodzież" };

// ============================================================================
// WCZYTANIE MECZU ZE ZRZUTU EKRANU
// ============================================================================
//
// Mecz bierze się zwykle z cudzej aplikacji — ŁNP, terminarz okręgu, strona klubu. Przepisywanie
// z niej czterech pól palcem to najbardziej jałowa czynność w całym panelu, a przy okazji jedyna,
// przy której łatwo pomylić datę.
//
// ROZPOZNAWANIE OBRAZU ROBI TELEFON, NIE MY. iPhone od iOS 15 czyta tekst wprost ze zdjęcia
// (przytrzymanie palcem na zrzucie w Zdjęciach), i robi to po polsku lepiej, niż zrobiłaby to
// biblioteka doładowana do strony — a taka biblioteka to kilkanaście megabajtów pobierane na
// stadionie. Panel dostaje więc gotowy TEKST i jego zadaniem jest go zrozumieć.
//
// Zasada nadrzędna: NIGDY nie zgadujemy po cichu. Pola wypełniamy tylko tym, co rozpoznane pewnie,
// resztę zostawiamy pustą i mówimy wprost, czego nie znaleziono — formularz stoi obok, poprawienie
// jednego pola jest tańsze niż wykrycie, że data jest o rok obok.

const MIESIACE_PL = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

// Wiersze interfejsu obcej aplikacji, które NIE są nazwą drużyny. Bez tej listy „Statystyki"
// albo „Dziś grają" trafiały do pola z nazwą meczu.
const NIE_DRUZYNA = new Set([
  "szczegóły", "szczegóły meczu", "relacja", "statystyki", "mecze", "rozgrywki", "ulubione",
  "dziś grają", "terminarz", "stadion", "runda", "rozgrywka", "kolejka", "tabela", "składy",
  "przebieg", "sędziowie", "informacje", "wynik", "transmisja", "bilety", "więcej",
]);

export interface DaneZeZrzutu {
  gospodarze: string;
  goscie: string;
  data: string;      // ISO
  godzina: string;
  miejsce: string;
  rozgrywki: string;
  braki: string[];   // czego NIE udało się odczytać — pokazujemy to wprost
}

// Rok dla daty zapisanej bez roku („02.09"). Bierzemy ten, przy którym mecz wypada najbliżej
// w przód: terminarze pokazuje się przed spotkaniem, nie po nim.
function rokDlaDaty(dzien: number, miesiac: number): number {
  const teraz = new Date();
  const wTym = new Date(teraz.getFullYear(), miesiac - 1, dzien);
  // Mecz sprzed więcej niż miesiąca to prawie na pewno przyszły rok (grudzień → styczeń).
  return wTym.getTime() < teraz.getTime() - 31 * 864e5 ? teraz.getFullYear() + 1 : teraz.getFullYear();
}

const iso = (r: number, m: number, d: number) =>
  `${r}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function czytajZeZrzutu(tekst: string, kluby: string[]): DaneZeZrzutu {
  const wiersze = tekst.split(/\r?\n/).map((w) => w.trim()).filter(Boolean);
  const calosc = wiersze.join("\n");
  const wynik: DaneZeZrzutu = { gospodarze: "", goscie: "", data: "", godzina: "", miejsce: "", rozgrywki: "", braki: [] };

  // ---- DATA. Trzy zapisy, od najpewniejszego. Słowny („2 września 2026") jest najlepszy, bo nie
  // da się go pomylić z formatem amerykańskim.
  const slowna = calosc.match(new RegExp(`(\\d{1,2})\\s+(${MIESIACE_PL.join("|")})\\s+(\\d{4})`, "i"));
  const zRokiem = calosc.match(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})\b/);
  const bezRoku = calosc.match(/\b(\d{1,2})[.](\d{1,2})\b(?!\s*[.\-/]\s*\d)/);
  if (slowna) {
    wynik.data = iso(Number(slowna[3]), MIESIACE_PL.indexOf(slowna[2].toLowerCase()) + 1, Number(slowna[1]));
  } else if (zRokiem) {
    wynik.data = iso(Number(zRokiem[3]), Number(zRokiem[2]), Number(zRokiem[1]));
  } else if (bezRoku) {
    const d = Number(bezRoku[1]);
    const m = Number(bezRoku[2]);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) wynik.data = iso(rokDlaDaty(d, m), m, d);
  }
  if (!wynik.data) wynik.braki.push("data");

  // ---- GODZINA. Bierzemy tę z wiersza z terminarzem, jeśli jest — na ekranie meczu bywa też
  // godzina transmisji albo otwarcia bram, a ta z terminarza jest tą właściwą.
  const wierszCzasu = wiersze.find((w) => /^terminarz\s*:/i.test(w)) || "";
  const czas = (wierszCzasu.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/) || calosc.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/));
  if (czas) wynik.godzina = `${String(Number(czas[1])).padStart(2, "0")}:${czas[2]}`;
  else wynik.braki.push("godzina");

  // ---- MIEJSCE i ROZGRYWKI: pola podpisane wprost, więc bez zgadywania.
  // „Gdańska 163 , 85-915 Bydgoszcz" — odstęp przed przecinkiem bierze się z układu tamtej
  // aplikacji, nie z adresu.
  const poEtykiecie = (etykieta: RegExp) => {
    const w = wiersze.find((x) => etykieta.test(x));
    return w ? w.replace(etykieta, "").replace(/\s+,/g, ",").replace(/\s+/g, " ").trim() : "";
  };
  wynik.miejsce = poEtykiecie(/^\s*(stadion|adres|obiekt|miejsce)\s*:\s*/i);
  wynik.rozgrywki = poEtykiecie(/^\s*(rozgrywka|rozgrywki|liga)\s*:\s*/i);
  if (!wynik.miejsce) wynik.braki.push("miejsce");

  // ---- DRUŻYNY. Najpierw zapis „A - B" w jednym wierszu, potem dopasowanie do klubów Z BAZY
  // (najpewniejsza droga — nazwa zgadza się wtedy z kartoteką), a na końcu odsiew wierszy
  // wyglądających na nazwę drużyny.
  const znormalizuj = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const klubyN = kluby.map((k) => ({ nazwa: k, n: znormalizuj(k) })).filter((k) => k.n.length > 2);

  const wJednym = wiersze
    .map((w) => w.match(/^(.{3,40}?)\s+[-–—:]\s+(.{3,40})$/))
    .find((m) => m && !/^\s*(terminarz|stadion|runda|rozgrywka)/i.test(m[1]));
  if (wJednym) {
    wynik.gospodarze = wJednym[1].trim();
    wynik.goscie = wJednym[2].trim();
  } else {
    const znalezione: string[] = [];
    for (const w of wiersze) {
      const n = znormalizuj(w);
      if (NIE_DRUZYNA.has(n) || /[:]/.test(w) || /\d{2}:\d{2}/.test(w)) continue;
      const trafiony = klubyN.find((k) => k.n === n || (n.length > 4 && (k.n.includes(n) || n.includes(k.n))));
      if (trafiony && !znalezione.includes(trafiony.nazwa)) znalezione.push(trafiony.nazwa);
      if (znalezione.length === 2) break;
    }
    // Kluby spoza bazy — drużyny młodzieżowe rzadko w niej są. Wiersz musi wyglądać jak nazwa:
    // od dużej litery, bez dwukropka, bez dat i liczb, najwyżej pięć słów.
    if (znalezione.length < 2) {
      for (const w of wiersze) {
        const n = znormalizuj(w);
        if (znalezione.includes(w) || NIE_DRUZYNA.has(n)) continue;
        if (/[:]/.test(w) || /\d/.test(w) || w.split(/\s+/).length > 5) continue;
        if (!/^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(w)) continue;
        znalezione.push(w);
        if (znalezione.length === 2) break;
      }
    }
    wynik.gospodarze = znalezione[0] || "";
    wynik.goscie = znalezione[1] || "";
  }
  if (!wynik.gospodarze || !wynik.goscie) wynik.braki.push("drużyny");

  return wynik;
}

function viewWklej(): string {
  return `
    <div class="row" style="margin-bottom:8px;">
      <h2 style="margin:0;">Wgraj mecz</h2>
      <button class="btn ghost small" data-act="zamknij-wklej">Wróć</button>
    </div>
    <p class="hint">Zrzut ekranu z ŁNP, terminarza okręgu albo strony klubu — panel wyciągnie
      z niego drużyny, datę, godzinę i adres.</p>

    <div class="card">
      <span class="label">Jak wziąć tekst ze zrzutu</span>
      <ol style="margin:8px 0 0; padding-left:20px; font-size:14.5px; line-height:1.65; color:var(--text-2);">
        <li>Otwórz zrzut w <strong>Zdjęciach</strong></li>
        <li><strong>Przytrzymaj palcem</strong> na tekście — iPhone go podświetli</li>
        <li><strong>Zaznacz wszystko</strong> → <strong>Kopiuj</strong></li>
        <li>Wróć tutaj i naciśnij <strong>Wklej ze schowka</strong></li>
      </ol>
    </div>

    <button class="btn" data-act="wklej-ze-schowka">📋 Wklej ze schowka</button>

    <div class="field" style="margin-top:10px;"><span class="label">Albo wklej tutaj ręcznie</span>
      <textarea id="wklej-tekst" rows="8" placeholder="Zawisza Bydgoszcz&#10;02.09, Śr.&#10;18:00&#10;ZKS Elana Toruń&#10;Terminarz: 2 września 2026 Środa 18:00&#10;Stadion: Gdańska 163, 85-915 Bydgoszcz">${esc(wklejTekst)}</textarea></div>

    <button class="btn ghost" data-act="wczytaj-ze-zrzutu">Wczytaj do formularza</button>`;
}

function viewNowa(): string {
  const scouts = cache.scouts.length
    ? cache.scouts.map((s) => `<option ${s === getScout() ? "selected" : ""}>${esc(s)}</option>`).join("")
    : "";
  const players = cache.players
    .slice()
    .sort((a, b) => (a.lastName || "").localeCompare(b.lastName || "", "pl"))
    .map((p) => `<option value="${esc(p.id)}">${esc(p.lastName)} ${esc(p.firstName)} — ${esc(clubName(p.clubId))}</option>`)
    .join("");

  return `
    <h2>Zaplanuj obserwację</h2>
    <p class="hint">To samo, co „Plan Obserwacji" na komputerze — żeby dało się umówić wyjazd bez siadania do biurka.</p>

    <div class="field"><span class="label">Mecz (gospodarz - gość)</span>
      <input id="n-match" value="${esc(planMecz)}" placeholder="np. Chojniczanka Chojnice - Znicz Pruszków">
      <div style="display:flex; gap:8px; margin-top:6px;">
        <button class="btn ghost small" style="margin:0;" data-act="otworz-terminarz">📅 Z terminarza</button>
        <button class="btn ghost small" style="margin:0;" data-act="otworz-wklej">🖼 Ze zrzutu</button>
      </div></div>
    <div class="grid-2">
      <div class="field"><span class="label">Data</span><input type="date" id="n-date" value="${esc(planData || todayISO())}">
        <span class="hint" id="n-dzien" style="display:block; margin-top:4px;">${esc(dataZDniem(planData || todayISO()))}</span></div>
      <div class="field"><span class="label">Godzina</span><input type="time" id="n-time" value="${esc(planGodzina || "17:00")}"></div>
    </div>
    <div class="field"><span class="label">Miejsce</span>
      <input id="n-location" value="${esc(planMiejsce)}" placeholder="np. ul. Mickiewicza 12, Chojnice"></div>

    <!-- Rozgrywki z podpowiedziami z terminarza: nazwy są długie i łatwo je zapisać na dwa
         sposoby („III liga gr. 2" kontra „III liga, grupa 2"), a wtedy nie da się po nich filtrować. -->
    <div class="field"><span class="label">Rozgrywki</span>
      <input id="n-liga" list="lista-rozgrywek" value="${esc(planRozgrywki)}"
             placeholder="np. III liga, grupa 2 albo A1">
      <datalist id="lista-rozgrywek">
        ${rozgrywkiZTerminarza().map((r) => `<option value="${esc(r)}"></option>`).join("")}
      </datalist></div>
    <div class="field"><span class="label">Kategoria</span>
      <div class="polarity" id="n-kategoria">
        <button type="button" class="pol seg" data-act="kategoria" data-v="seniorzy" aria-pressed="${planKategoria === "seniorzy"}">Seniorzy</button>
        <button type="button" class="pol seg" data-act="kategoria" data-v="mlodziez" aria-pressed="${planKategoria === "mlodziez"}">Młodzież</button>
      </div>
      <span class="hint" style="display:block; margin-top:4px;">${planKategoria
        ? (kategoriaRecznie ? "Wybrane ręcznie." : "Rozpoznane z nazwy rozgrywek — popraw, jeśli się mylę.")
        : "Rozpoznam z nazwy rozgrywek albo wskaż sam."}</span></div>
    <div class="field"><span class="label">Zawodnik (opcjonalnie)</span>
      <select id="n-player"><option value="">— obserwacja meczu —</option>${players}</select></div>
    <div class="field"><span class="label">Rodzaj</span>
      <select id="n-typ">
        <option value="live">Live — na stadionie</option>
        <option value="online">Online</option>
        <option value="video">Video</option>
      </select></div>
    <div class="field"><span class="label">Scout</span>
      ${scouts ? `<select id="n-scout">${scouts}</select>` : `<input id="n-scout" value="${esc(getScout())}" placeholder="Imię i nazwisko">`}</div>

    <button class="btn" data-act="save-nowa" data-start="1">Zapisz i rozpocznij teraz</button>
    <button class="btn ghost" data-act="save-nowa">Zapisz na później</button>
    <button class="btn ghost" data-act="go-dzis">Anuluj</button>`;
}

// TERMINARZ.
//
// Rozgrywki bierzemy z pola `competition` przy meczu — pełnej nazwy ze strony 90minut, która
// zawiera grupę („III liga, grupa 2", „IV liga kujawsko-pomorska"). Bez tego podziału trzy ligi
// zlewałyby się w jedną listę kilkuset spotkań, a scout szuka meczu w SWOJEJ grupie.
function rozgrywkiZTerminarza(): string[] {
  const zbior = new Map<string, number>();
  cache.matches.forEach((m) => {
    const nazwa = (m.competition || m.league || "").trim();
    if (nazwa) zbior.set(nazwa, (zbior.get(nazwa) || 0) + 1);
  });
  return [...zbior.keys()].sort((a, b) => a.localeCompare(b, "pl"));
}

function viewTerminarz(): string {
  const dzis = todayISO();
  const q = terminarzSzukaj.trim().toLowerCase();

  const wszystkie = cache.matches
    .filter((m) => (m.date || "") >= dzis)
    .filter((m) => !terminarzLiga || (m.competition || m.league || "") === terminarzLiga)
    .filter((m) => !q || `${m.homeTeam} ${m.awayTeam} ${m.city || ""}`.toLowerCase().includes(q))
    .sort((a, b) => ((a.date || "") + (a.time || "")).localeCompare((b.date || "") + (b.time || "")));

  const lista = wszystkie.slice(0, 60);
  const rozgrywki = rozgrywkiZTerminarza();

  // PUSTY TERMINARZ MA TRZY RÓŻNE PRZYCZYNY i scout musi wiedzieć, na którą patrzy.
  // Dawny komunikat („pobierz go w aplikacji na komputerze") mówił zawsze to samo, także wtedy,
  // gdy terminarz na komputerze był kompletny, a telefonowi po prostu nie udało się go odczytać.
  const problemy = cache.problemy || [];
  const bladTerminarza = problemy.find((p) => p.startsWith("terminarz:"));
  const bladDostepu = problemy.find((p) => p.startsWith("baza oddała zero"));
  const pusto = !cache.matches.length;
  const wyjasnienie = bladTerminarza
    ? `Nie udało się pobrać terminarza. ${esc(bladTerminarza.replace(/^terminarz:\s*/, ""))}`
    : bladDostepu
      ? `Z bazy nie przyszło nic — ani terminarz, ani zawodnicy. ${esc(bladDostepu.replace(/^baza oddała zero rekordów — zwykle znaczy to, że /, "Zwykle znaczy to, że "))}`
      : pusto
        ? "Kopia w telefonie nie zawiera terminarza. Pobierz go raz w aplikacji na komputerze (zakładka Terminarz), potem odśwież tutaj."
        : !cache.fetchedAt
          ? "Kopia bazy nie była jeszcze odświeżana."
          : "";

  return `
    <div class="row" style="margin-bottom:8px;">
      <h2 style="margin:0;">Terminarz</h2>
      <button class="btn ghost small" data-act="zamknij-terminarz">Wróć</button>
    </div>
    <p class="hint">${cache.matches.length
      ? wszystkie.length + " spotkań od dziś · " + cache.matches.length + " w kopii"
      : "Brak meczów w kopii bazy."}</p>

    ${wyjasnienie ? `<div class="empty" style="text-align:left;">${wyjasnienie}</div>` : ""}
    ${(pusto || bladTerminarza || bladDostepu)
      ? '<button class="btn ghost" data-act="odswiez-terminarz" style="margin-bottom:10px;">↻ Pobierz terminarz z SBS</button>'
      : ""}

    <div class="field">
      <select id="t-liga" data-act="terminarz-liga">
        <option value="">— wszystkie rozgrywki —</option>
        ${rozgrywki.map((r) => `<option value="${esc(r)}" ${r === terminarzLiga ? "selected" : ""}>${esc(r)}</option>`).join("")}
      </select>
    </div>
    <div class="field"><input id="t-szukaj" placeholder="Szukaj drużyny albo miasta…" value="${esc(terminarzSzukaj)}"></div>

    ${lista.map((m) => `
      <button class="sklad-row" style="flex-direction:column; align-items:flex-start; gap:3px;"
              data-act="wybierz-mecz" data-id="${esc(m.id)}">
        <span class="sklad-nazwa" style="font-weight:650;">${esc(m.homeTeam)} - ${esc(m.awayTeam)}</span>
        <span class="sub" style="font-size:11.5px;"><strong style="color:var(--text-strong); font-weight:650;">${esc(dataZDniem(m.date || ""))}</strong>${m.time ? " · " + esc(m.time) : ""}${m.city ? " · " + esc(m.city) : ""}</span>
      </button>`).join("") || '<div class="empty">Brak spotkań spełniających warunki.</div>'}
    ${wszystkie.length > lista.length ? `<p class="hint">Pokazano ${lista.length} z ${wszystkie.length} — zawęź wyszukiwaniem.</p>` : ""}`;
}

function viewLive(): string {
  if (!live) {
    return `
      <h2>Live</h2>
      <p class="hint">Nie trwa żadna obserwacja.</p>
      <div class="empty">Wybierz mecz w zakładce Obserwacje i naciśnij „Rozpocznij".</div>
      <button class="btn ghost" data-act="go-dzis">Przejdź do obserwacji</button>`;
  }

  // Licznik na kaflu mówi, ile zarejestrowano DLA WYBRANEGO podmiotu — przy tagowaniu kilku
  // zawodników suma z całego meczu nie niosłaby żadnej informacji.
  const dlaKogo = live.wybranyZawodnik || "";
  const counts: Record<string, number> = {};
  live.events.filter((e) => (e.zawodnik || "") === dlaKogo)
    .forEach((e) => (counts[e.type] = (counts[e.type] || 0) + 1));
  const secs = liveSeconds(live);
  const okres = periodOf(live.half);
  const nastepny = PERIODS.find((p) => p.n === ((live!.half + 1) as Period));

  return `
    <div class="row" style="margin-bottom:10px;">
      <div>
        <div class="name">${esc(live.playerId ? playerLabel(live.playerId) : "Obserwacja zespołu")}</div>
        <div class="sub">${esc(live.matchLabel)}</div>
      </div>
      <span class="tag live">Live</span>
    </div>

    <div class="clock">
      <div>
        <div class="clock-time" id="clock-time">${liveMinute(live)}:${pad(secs % 60)}</div>
        <div class="clock-half">${esc(okres.label)}</div>
      </div>
      <div class="clock-btns">
        <button class="clock-btn ${live.running ? "run" : ""}" data-act="clock-toggle">${live.running ? "Pauza" : "Start"}</button>
        ${nastepny ? `<button class="clock-btn" data-act="next-period">${esc(nastepny.label)}</button>` : ""}
        ${/* Zerowanie pokazujemy TYLKO przy zatrzymanym zegarze, który zdążył coś naliczyć.
              W trakcie gry ten przycisk nie ma po co istnieć, a stoi tuż obok pauzy. */
          !live.running && secs > 0 ? '<button class="clock-btn" data-act="clock-reset">Zeruj</button>' : ""}
      </div>
    </div>

    <div class="polarity" style="grid-template-columns:1fr 1fr; margin-bottom:10px;">
      <button class="pol seg" data-act="live-tab" data-v="zdarzenia" aria-pressed="${liveTab === "zdarzenia"}">Zdarzenia</button>
      <button class="pol seg" data-act="live-tab" data-v="sklady" aria-pressed="${liveTab === "sklady"}">Składy${skladLiczba(live.observationId) ? " · " + skladLiczba(live.observationId) : ""}</button>
    </div>

    ${liveTab === "sklady" ? viewSklady() : `
    ${pasekZawodnikow()}
    ${blokOceny()}
    <div class="polarity">
      <button class="pol plus" data-act="pol" data-v="1" aria-pressed="${polarity === 1}">+ udane</button>
      <button class="pol minus" data-act="pol" data-v="-1" aria-pressed="${polarity === -1}">− nieudane</button>
    </div>

    <div class="tags">
      ${EVENT_TAGS.map((t) => `
        <button class="tagbtn ${counts[t.key] ? "hit" : ""}" data-act="tag" data-k="${t.key}">
          <span class="cnt">${counts[t.key] || ""}</span>${esc(t.label)}
        </button>`).join("")}
    </div>

    <div class="field" style="margin-top:12px;">
      <input id="quick-note" placeholder="Notatka do bieżącej minuty…">
    </div>

    <div class="row" style="margin-bottom:6px; margin-top:16px;">
      <span class="label" style="margin:0;">Oś zdarzeń · ${live.events.length}</span>
      <span style="display:flex; gap:8px;">
        <button class="btn ghost small" data-act="undo">Cofnij</button>
        <button class="btn small" data-act="finish">Zakończ</button>
      </span>
    </div>
    <div class="timeline">
      ${live.events.slice().reverse().slice(0, 40).map((e) => `
        <div class="ev ${e.quality === 1 ? "plus" : "minus"}">
          <span class="min">${e.minute}'</span>
          <span class="txt">${e.zawodnik ? `<strong>${esc(e.zawodnik)}</strong> · ` : ""}${esc(e.label)}${e.note ? " — " + esc(e.note) : ""}</span>
          <span class="sign">${e.quality === 1 ? "+" : "−"}</span>
          <button class="ev-del" data-act="usun-zdarzenie" data-id="${esc(e.id)}" aria-label="Usuń zdarzenie">✕</button>
        </div>`).join("") || '<div class="empty">Jeszcze nic nie zarejestrowano.</div>'}
    </div>`}`;
}

// ---------------------------------------------------------------------------
// Składy meczu
// ---------------------------------------------------------------------------
//
// Ten sam zapis, którego używa aplikacja na komputerze (sbs_observations → ratings.__ext.skladMeczu):
//   { gospodarze: { nazwa, zawodnicy: [{ nazwa, numer, wyrozniony, … }] }, goscie: { … } }
//
// Wyróżnienie należy do OBSERWACJI, nie do meczu — dwóch skautów oglądających ten sam mecz
// wskaże kogo innego, i tak samo trzyma to komputer. Dlatego zaznaczenie z trybuny trafia
// dokładnie tam, gdzie szuka go potem raport.

interface SkladZawodnik {
  nazwa: string; numer?: string; podstawowy?: boolean; zszedl?: boolean; wyrozniony?: boolean;
  // Pola dokładane przez panel mobilny: pozycja na mapie (numer z POZYCJE), szybka ocena
  // i notatka. Żyją razem z resztą składu w ratings.__ext.skladMeczu, więc nie wymagają
  // zmian w bazie. Uwaga: ponowny import składu na komputerze przebudowuje zawodników
  // i te pola by wtedy przepadły — dlatego mapę układa się po wczytaniu składu, nie przed.
  pozycja?: number;
  ocena?: Record<string, number>;
  // Protokół w skali 1–6 wystawiany TEMU zawodnikowi, nie meczowi: fazy gry i stałe fragmenty.
  // Te same klucze, co w raporcie na komputerze (REPORT_PHASES, REPORT_SET_PIECES), więc przy
  // zapisie idą wprost do pól raportu, bez tłumaczenia.
  fazy?: Record<string, number>;
  sfg?: Record<string, number>;
  // Decyzja o zawodniku — te same wartości, co w raporcie na komputerze (STATUS_OPTIONS):
  // „Do Obserwacji", „Na Testy", „Do transferu"… Zapada NA TRYBUNIE, przy nazwisku, a nie pół
  // godziny później przy jednym wspólnym formularzu po meczu, gdzie dotyczyła tylko jednej osoby.
  status?: string;
  notatka?: string;
  noga?: string;
  // Wskazanie na zawodnika z bazy, gdy skład powstał z kadry klubu, a nie z wklejki. Dzięki temu
  // oceny z trybuny da się później przypisać do prawdziwego profilu, a nie do samego nazwiska.
  playerId?: string;
}
interface SkladStrona { nazwa?: string; zawodnicy: SkladZawodnik[]; formacja?: string }
interface Sklad { gospodarze?: SkladStrona; goscie?: SkladStrona }

const STRONY: ("gospodarze" | "goscie")[] = ["gospodarze", "goscie"];

// Systemy gry i rozmieszczenie jedenastu pozycji na boisku — przepisane z aplikacji na komputerze
// (FORMATIONS, POSITION_NUMBERS i FORMATION_COORDS w src/main.ts), żeby plansza na telefonie
// pokrywała się z klubową planszą co do pozycji. Współrzędne to procent szerokości i wysokości.
const FORMACJE = ["1-4-4-2", "1-4-3-3", "1-3-4-3", "1-3-5-2", "1-4-5-1", "1-5-4-1", "1-4-2-3-1"];

const POZYCJE: Record<number, string> = {
  1: "BR", 2: "PO", 3: "LO", 4: "ŚO", 5: "ŚO", 6: "DP", 7: "PS", 8: "ŚP", 9: "NAP", 10: "OP", 11: "LS",
};
const POZYCJE_PELNE: Record<number, string> = {
  1: "Bramkarz", 2: "Prawy obrońca", 3: "Lewy obrońca", 4: "Stoper (prawy)", 5: "Stoper (lewy)",
  6: "Defensywny pomocnik", 7: "Prawy skrzydłowy", 8: "Środkowy pomocnik", 9: "Napastnik",
  10: "Ofensywny pomocnik", 11: "Lewy skrzydłowy",
};

type Punkt = { x: number; y: number };
const FORMACJA_WSPOLRZEDNE: Record<string, Record<number, Punkt>> = {
  "": { 11:{x:22,y:13}, 9:{x:50,y:10}, 7:{x:78,y:13}, 8:{x:37,y:33}, 10:{x:63,y:33}, 6:{x:50,y:53}, 3:{x:18,y:66}, 2:{x:82,y:66}, 5:{x:37,y:79}, 4:{x:63,y:79}, 1:{x:50,y:93} },
  "1-4-3-3": { 11:{x:22,y:13}, 9:{x:50,y:10}, 7:{x:78,y:13}, 8:{x:37,y:33}, 10:{x:63,y:33}, 6:{x:50,y:53}, 3:{x:18,y:66}, 2:{x:82,y:66}, 5:{x:37,y:79}, 4:{x:63,y:79}, 1:{x:50,y:93} },
  "1-4-4-2": { 9:{x:39,y:10}, 10:{x:61,y:10}, 11:{x:18,y:33}, 7:{x:82,y:33}, 6:{x:61,y:51}, 8:{x:39,y:51}, 3:{x:18,y:66}, 2:{x:82,y:66}, 5:{x:37,y:79}, 4:{x:63,y:79}, 1:{x:50,y:93} },
  "1-3-4-3": { 11:{x:22,y:13}, 9:{x:50,y:10}, 7:{x:78,y:13}, 3:{x:16,y:38}, 8:{x:39,y:38}, 10:{x:61,y:38}, 2:{x:84,y:38}, 5:{x:31,y:72}, 6:{x:50,y:72}, 4:{x:69,y:72}, 1:{x:50,y:93} },
  "1-3-5-2": { 9:{x:39,y:10}, 10:{x:61,y:10}, 11:{x:20,y:36}, 8:{x:50,y:36}, 7:{x:80,y:36}, 3:{x:15,y:54}, 2:{x:85,y:54}, 5:{x:31,y:74}, 6:{x:50,y:74}, 4:{x:69,y:74}, 1:{x:50,y:93} },
  "1-4-5-1": { 9:{x:50,y:10}, 11:{x:20,y:29}, 7:{x:80,y:29}, 8:{x:32,y:46}, 6:{x:50,y:46}, 10:{x:68,y:46}, 3:{x:18,y:66}, 2:{x:82,y:66}, 5:{x:37,y:79}, 4:{x:63,y:79}, 1:{x:50,y:93} },
  "1-5-4-1": { 9:{x:50,y:10}, 11:{x:22,y:36}, 8:{x:41,y:36}, 10:{x:59,y:36}, 7:{x:78,y:36}, 3:{x:14,y:70}, 5:{x:32,y:70}, 6:{x:50,y:70}, 4:{x:68,y:70}, 2:{x:86,y:70}, 1:{x:50,y:93} },
  "1-4-2-3-1": { 9:{x:50,y:10}, 11:{x:20,y:29}, 10:{x:50,y:29}, 7:{x:80,y:29}, 6:{x:38,y:49}, 8:{x:62,y:49}, 3:{x:18,y:66}, 2:{x:82,y:66}, 5:{x:37,y:79}, 4:{x:63,y:79}, 1:{x:50,y:93} },
};

// Skala szybkiej oceny na mapie — trzy z pięciu atrybutów SBS. Mentalność i potencjał zostają
// w pełnej ocenie po meczu: na trybunie, przy jednym epizodzie, nie ma ich z czego wystawić.
const OCENA_MAPY = ["technika", "taktyka", "motoryka"];

// Gra głową osobno w ataku i w obronie: to dwie różne umiejętności, a przy stałych fragmentach
// rozstrzyga często jedna z nich. Trzymane razem z resztą oceny zawodnika przy składzie.
const OCENA_GLOWA = [
  { key: "glowaAtak", label: "Gra głową — atak" },
  { key: "glowaObrona", label: "Gra głową — obrona" },
];
const NOGI = ["prawa", "lewa", "obie"];

const skladObserwacji = (obsId: string): Sklad | null => {
  const obs = cache.observations.find((o) => o.id === obsId) as (Observation & { skladMeczu?: Sklad }) | undefined;
  return obs?.skladMeczu || null;
};

// Liczba wyróżnionych — pokazywana przy zakładce, żeby było widać z ekranu zdarzeń, że coś tam jest.
function skladLiczba(obsId: string): number {
  const s = skladObserwacji(obsId);
  if (!s) return 0;
  return STRONY.reduce((suma, strona) => suma + (s[strona]?.zawodnicy || []).filter((z) => z.wyrozniony).length, 0);
}

// Nazwy drużyn z pola „Mecz" (gospodarz - gość). Kluby bywają wpisywane z różnymi kreskami,
// więc rozdzielamy po każdej z nich — tak samo jak aplikacja na komputerze.
function druzynyZMeczu(match?: string): [string, string] {
  const czesci = String(match || "").split(/\s[-–—]\s/);
  return [czesci[0]?.trim() || "Gospodarze", czesci[1]?.trim() || "Goście"];
}

// Klub z bazy odpowiadający nazwie drużyny z pola „Mecz". Nazwy bywają zapisane skrótowo
// („Chojniczanka" kontra „Chojniczanka Chojnice"), więc po dokładnym trafieniu próbujemy zawierania.
function klubZNazwy(nazwa: string) {
  const n = nazwa.toLowerCase().trim();
  if (!n) return null;
  return cache.clubs.find((c) => (c.name || "").toLowerCase().trim() === n)
    || cache.clubs.find((c) => {
      const k = (c.name || "").toLowerCase().trim();
      return k && (k.includes(n) || n.includes(k));
    })
    || null;
}

function viewSklady(): string {
  if (!live) return "";
  const obs = cache.observations.find((o) => o.id === live!.observationId);
  const sklad = skladObserwacji(live.observationId);
  const [gosp, gosc] = druzynyZMeczu(obs?.match);

  // Wybór z kadry klubu — najszybsza droga, gdy zawodnicy są już w bazie. Wklejanie zostaje
  // dla tych, których w bazie nie ma: składy pojawiają się 45 minut przed meczem, a kopiowanie
  // ze strony wyniku, bez rezerwowych na jednym ekranie, robi się na raty i zjada ten czas.
  if (wyborZKadry) {
    const klub = klubZNazwy(wyborZKadry === "gospodarze" ? gosp : gosc);
    const kadra = klub ? cache.players.filter((pl) => pl.clubId === klub.id) : [];
    const juzWSkladzie = new Set((sklad?.[wyborZKadry]?.zawodnicy || []).map((z) => z.playerId).filter(Boolean));
    return `
      <div class="row" style="margin-bottom:8px;">
        <span class="label" style="margin:0;">${esc(klub?.name || (wyborZKadry === "gospodarze" ? gosp : gosc))}</span>
        <button class="btn ghost small" data-act="zamknij-kadre">Gotowe</button>
      </div>
      ${klub ? "" : '<p class="hint">Nie znalazłem tego klubu w bazie — nazwa w polu „Mecz" musi się zgadzać z nazwą klubu w SBS.</p>'}
      ${kadra.length
        ? kadra.slice().sort((a, b) => (a.lastName || "").localeCompare(b.lastName || "", "pl")).map((pl) => `
            <button class="sklad-row ${juzWSkladzie.has(pl.id) ? "on" : ""}" data-act="z-kadry" data-id="${esc(pl.id)}">
              <span class="sklad-nazwa">${esc(pl.lastName)} ${esc(pl.firstName)}</span>
              <span class="sub" style="font-size:11.5px;">${esc(pl.position || "")}${pl.birthYear ? " · " + esc(pl.birthYear) : ""}</span>
              <span class="sklad-znak">${juzWSkladzie.has(pl.id) ? "✓" : "+"}</span>
            </button>`).join("")
        : klub ? '<div class="empty">Ten klub nie ma zawodników w bazie.</div>' : ""}`;
  }

  if (!sklad || !STRONY.some((s) => (sklad[s]?.zawodnicy || []).length)) {
    return `
      <div style="display:flex; gap:6px; margin-bottom:10px;">
        ${STRONY.map((k) => `<button class="btn ghost" style="margin-top:0;" data-act="otworz-kadre" data-strona="${k}">Kadra: ${esc(k === "gospodarze" ? gosp : gosc)}</button>`).join("")}
      </div>
      <p class="hint">Wklej składy — po jednym zawodniku w wierszu. Numer na początku wiersza jest rozpoznawany.
      Na iPhonie tekst da się skopiować wprost ze zdjęcia: przytrzymaj palec na zrzucie ekranu i zaznacz.</p>
      <div class="field">
        <span class="label">${esc(gosp)}</span>
        <textarea id="sklad-gospodarze" placeholder="1 Kowalski&#10;4 Nowak&#10;…"></textarea>
      </div>
      <div class="field">
        <span class="label">${esc(gosc)}</span>
        <textarea id="sklad-goscie" placeholder="1 Wiśniewski&#10;5 Zieliński&#10;…"></textarea>
      </div>
      <button class="btn" data-act="wczytaj-sklady">Wczytaj składy</button>`;
  }

  const strona = (klucz: "gospodarze" | "goscie", tytul: string) => {
    const lista = sklad[klucz]?.zawodnicy || [];
    if (!lista.length) return "";
    return `
      <div class="section" style="${klucz === "gospodarze" ? "border-top:none; margin-top:0; padding-top:0;" : ""}">
        <div class="row" style="margin-bottom:6px;">
          <span class="label" style="margin:0;">${esc(sklad[klucz]?.nazwa || tytul)} · ${lista.length}</span>
          <button class="btn ghost small" data-act="wyczysc-sklad" data-strona="${klucz}">Wyczyść</button>
        </div>
        ${lista.map((z, i) => `
          <div class="sklad-wiersz">
            <input class="sklad-nr-pole" data-numer-strona="${klucz}" data-numer-i="${i}"
                   value="${esc(z.numer || "")}" placeholder="—"
                   inputmode="numeric" maxlength="2" aria-label="Numer: ${esc(z.nazwa)}">
            <button class="sklad-row ${z.wyrozniony ? "on" : ""}" data-act="wyroznij" data-strona="${klucz}" data-i="${i}">
              <span class="sklad-nazwa">${esc(z.nazwa)}</span>
              <span class="sklad-znak">${z.wyrozniony ? "★" : "☆"}</span>
            </button>
            <button class="sklad-del" data-act="usun-zawodnika" data-strona="${klucz}" data-i="${i}"
                    aria-label="Usuń ${esc(z.nazwa)}">✕</button>
          </div>`).join("")}
      </div>`;
  };

  const dopiszZKadry = `
    <div style="display:flex; gap:6px; margin-bottom:8px;">
      ${STRONY.map((k) => `<button class="btn ghost small" style="flex:1;" data-act="otworz-kadre" data-strona="${k}">+ kadra: ${esc(k === "gospodarze" ? gosp : gosc)}</button>`).join("")}
    </div>`;

  const przelacznik = `
    <div class="polarity" style="margin-bottom:10px;">
      <button class="pol seg" data-act="sklad-widok" data-v="lista" aria-pressed="${skladWidok === "lista"}">Lista</button>
      <button class="pol seg" data-act="sklad-widok" data-v="mapa" aria-pressed="${skladWidok === "mapa"}">Ustawienie</button>
    </div>`;

  if (skladWidok === "mapa") return przelacznik + viewMapa(sklad, gosp, gosc);

  return `
    ${przelacznik}
    ${dopiszZKadry}
    <p class="hint">Dotknij zawodnika, żeby go wyróżnić. Zaznaczenia trafiają do tej obserwacji w SBS.</p>
    ${strona("gospodarze", gosp)}
    ${strona("goscie", gosc)}`;
}

// ---------------------------------------------------------------------------
// Plansza ustawienia
// ---------------------------------------------------------------------------

function viewMapa(sklad: Sklad, gosp: string, gosc: string): string {
  const dane = sklad[skladStrona];
  const lista = dane?.zawodnicy || [];
  const formacja = dane?.formacja || "";
  const wspolrzedne = FORMACJA_WSPOLRZEDNE[formacja] || FORMACJA_WSPOLRZEDNE[""];

  // Panel oceny zajmuje cały ekran zamiast planszy — na telefonie okno nakładkowe nad boiskiem
  // zasłaniałoby to, na co scout właśnie patrzy, i trzeba by je zamykać jednym palcem w biegu.
  if (ocenianyZawodnik !== null && lista[ocenianyZawodnik]) return viewOcenaZawodnika(lista[ocenianyZawodnik]);

  const wyborStrony = `
    <div class="polarity" style="margin-bottom:10px;">
      ${STRONY.map((k) => `<button class="pol seg" data-act="sklad-strona" data-v="${k}" aria-pressed="${skladStrona === k}">${esc(k === "gospodarze" ? gosp : gosc)}</button>`).join("")}
    </div>`;

  const wyborFormacji = `
    <div class="field">
      <span class="label">System gry</span>
      <select id="wybor-formacji" data-act="zmien-formacje">
        <option value="" ${formacja ? "" : "selected"}>— wybierz system —</option>
        ${FORMACJE.map((f) => `<option value="${f}" ${f === formacja ? "selected" : ""}>${f}</option>`).join("")}
      </select>
    </div>`;

  // Wybieranie zawodnika na wskazane pole: lista tej drużyny, numer przed nazwiskiem.
  if (obsadzanaPozycja !== null) {
    const wolni = lista.map((z, i) => ({ z, i })).filter(({ z }) => z.pozycja !== obsadzanaPozycja);
    return `
      ${wyborStrony}
      <div class="row" style="margin-bottom:8px;">
        <span class="label" style="margin:0;">${esc(POZYCJE_PELNE[obsadzanaPozycja])}</span>
        <button class="btn ghost small" data-act="anuluj-obsade">Anuluj</button>
      </div>
      ${wolni.map(({ z, i }) => `
        <button class="sklad-row" data-act="obsadz" data-i="${i}">
          <span class="sklad-nr">${esc(z.numer || "")}</span>
          <span class="sklad-nazwa">${esc(z.nazwa)}</span>
          ${z.pozycja ? `<span class="sklad-znak" style="font-size:12px;">${esc(POZYCJE[z.pozycja])}</span>` : ""}
        </button>`).join("") || '<div class="empty">Brak zawodników w składzie tej drużyny.</div>'}
      ${lista.some((z) => z.pozycja === obsadzanaPozycja)
        ? '<button class="btn ghost" data-act="zwolnij-pozycje">Zdejmij z tej pozycji</button>' : ""}`;
  }

  const pola = Object.keys(wspolrzedne).map(Number).map((numer) => {
    const p = wspolrzedne[numer];
    const idx = lista.findIndex((z) => z.pozycja === numer);
    const z = idx >= 0 ? lista[idx] : null;
    const oceniony = z && z.ocena && OCENA_MAPY.some((k) => Number(z.ocena![k]) > 0);
    return `
      <button class="slot ${z ? "obsadzony" : ""} ${z?.wyrozniony ? "gwiazda" : ""}"
              style="left:${p.x}%; top:${p.y}%;"
              data-act="${z ? "otworz-zawodnika" : "wybierz-pozycje"}" data-numer="${numer}" data-i="${idx}">
        <span class="slot-poz">${esc(POZYCJE[numer])}</span>
        <span class="slot-nazwa">${z ? esc(skrotNazwiska(z)) : "+"}</span>
        ${oceniony ? '<span class="slot-kropka"></span>' : ""}
      </button>`;
  }).join("");

  const obsadzeni = lista.filter((z) => z.pozycja).length;

  return `
    ${wyborStrony}
    ${wyborFormacji}
    <div class="boisko">
      <div class="boisko-linie"></div>
      ${pola}
    </div>
    <p class="hint" style="margin-top:10px;">
      Ustawionych: ${obsadzeni} z 11. Puste pole otwiera listę drużyny, obsadzone — panel oceny.
    </p>`;
}

// KLUCZ zawodnika — pełny zapis z numerem. Musi być jednoznaczny, bo po nim przypisujemy
// zdarzenia: samo nazwisko zlewałoby dwóch Kowalskich w jednego, a numer rozróżnia ich zawsze.
function kluczZawodnika(z: SkladZawodnik): string {
  return (z.numer ? z.numer + " " : "") + z.nazwa.trim();
}

// Popularne polskie imiona męskie. Służą do jednego: rozstrzygnięcia, który wyraz jest
// nazwiskiem. Składy bywają zapisane w obu kolejnościach — protokoły podają „Nazwisko Imię",
// aplikacje z wynikami „Imię Nazwisko" — więc branie któregoś skraju na sztywno myli się w
// połowie przypadków. Gdy jeden z wyrazów jest znanym imieniem, nazwiskiem jest ten drugi.
const IMIONA = new Set([
  "adam","adrian","albert","aleksander","aleks","alan","antoni","arkadiusz","artur","bartosz",
  "bartłomiej","błażej","borys","cezary","czesław","damian","daniel","dariusz","dawid","denis",
  "dominik","emil","eryk","fabian","filip","franciszek","gabriel","grzegorz","gustaw","hubert",
  "igor","ireneusz","jacek","jakub","jan","januszz","janusz","jarosław","jerzy","józef","julian",
  "juliusz","kacper","kamil","karol","kazimierz","konrad","kornel","krystian","krzysztof","leszek",
  "łukasz","maciej","marcel","marcin","marek","mariusz","mateusz","michał","mikołaj","miłosz",
  "mirosław","nikodem","norbert","olaf","oliwier","oskar","patryk","paweł","piotr","przemysław",
  "radosław","rafał","remigiusz","robert","roman","ryszard","sebastian","seweryn","sławomir",
  "stanisław","szymon","tadeusz","tomasz","tymon","tymoteusz","wiktor","witold","władysław",
  "wojciech","zbigniew","zdzisław","ziemowit","alex","david","denys","maksym","mykhailo","serhii",
]);

// SKRÓT do wyświetlenia na polu wielkości kciuka — sam numer i nazwisko. Pełny zapis jest
// na liście i na pasku wyboru, więc skrót nie musi być jednoznaczny, ma się zmieścić.
function skrotNazwiska(z: SkladZawodnik): string {
  const slowa = z.nazwa.trim().split(/\s+/);
  let nazwisko = slowa[slowa.length - 1];
  if (slowa.length > 1) {
    const pierwszeToImie = IMIONA.has(slowa[0].toLowerCase());
    const ostatnieToImie = IMIONA.has(slowa[slowa.length - 1].toLowerCase());
    if (pierwszeToImie && !ostatnieToImie) nazwisko = slowa[slowa.length - 1];
    else if (ostatnieToImie && !pierwszeToImie) nazwisko = slowa[0];
  }
  return (z.numer ? z.numer + " " : "") + nazwisko;
}

// ZDARZENIA JEDNEGO ZAWODNIKA, po ludzku: „Strzał + 3 · Strata − 2".
//
// To samo zestawienie służy dwóm rzeczom: pokazaniu na ekranie, ile już zarejestrowano, i wpisaniu
// dorobku do raportu. Liczymy z bieżącego meczu, jeśli trwa, a po gwizdku z archiwum — po zapisaniu
// ocen stan meczu jest kasowany, a raport ma powstać z tego samego materiału.
function zdarzeniaZawodnika(obsId: string, klucz: string): string {
  const wszystkie = live && live.observationId === obsId ? live.events : zdarzeniaObserwacji(obsId);
  const licznik = new Map<string, number>();
  wszystkie.filter((e) => (e.zawodnik || "") === klucz).forEach((e) => {
    const k = e.label + (e.quality === 1 ? " +" : " −");
    licznik.set(k, (licznik.get(k) || 0) + 1);
  });
  return [...licznik.entries()].map(([co, ile]) => `${co} ${ile}`).join(" · ");
}

// Panel oceny jednego zawodnika. Dwa warianty tego samego:
//
//   osobny ekran — otwarty z planszy w zakładce Składy, zajmuje całe okno,
//   pod kaflami   — stoi na ekranie zdarzeń, pod tym, czym się właśnie taguje.
//
// Wariant drugi jest ważniejszy i to on rządzi układem: w trakcie meczu jedno i drugie robi się
// naprzemiennie, o tym samym zawodniku. Rozdzielenie ich na dwa ekrany oznaczało przechodzenie
// tam i z powrotem po każdej akcji — czyli oderwanie wzroku od boiska dokładnie wtedy, gdy się
// patrzy. Dlatego pod kaflami nie ma tu ani przycisku powrotu, ani nagłówka z nazwiskiem:
// nazwisko stoi kilka centymetrów wyżej, w pasku „Tagujesz", podświetlone.
function viewOcenaZawodnika(z: SkladZawodnik, podKaflami = false): string {
  const ocena = z.ocena || {};
  const fazy = z.fazy || {};
  const sfg = z.sfg || {};
  const zdarzenia = live ? zdarzeniaZawodnika(live.observationId, kluczZawodnika(z)) : "";
  return `
    ${podKaflami ? "" : `
    <div class="row" style="margin-bottom:10px;">
      <div>
        <div class="name">${esc(z.nazwa)}</div>
        <div class="sub">${z.numer ? "nr " + esc(z.numer) + " · " : ""}${z.pozycja ? esc(POZYCJE_PELNE[z.pozycja]) : "poza ustawieniem"}</div>
      </div>
      <button class="btn ghost small" data-act="zamknij-zawodnika">Wróć</button>
    </div>

    ${/* Co już zarejestrowano kaflami. Na osobnym ekranie trzeba to pokazać, bo kafli stąd nie
          widać. Pod kaflami byłoby powtórzeniem — liczniki stoją wprost na nich. */
      zdarzenia ? `<div class="card" style="padding:10px 12px; margin-bottom:10px;">
        <span class="label" style="margin:0;">Zdarzenia z kafli</span>
        <div class="sub" style="margin-top:4px;">${esc(zdarzenia)}</div>
      </div>` : ""}

    ${z.pozycja ? `<button class="btn ghost" style="margin-top:0;" data-act="zmien-na-pozycji" data-numer="${z.pozycja}">
      Zmiana — wstaw innego na ${esc(POZYCJE_PELNE[z.pozycja])}</button>` : ""}`}

    <button class="btn ${z.wyrozniony ? "" : "ghost"}" style="margin-top:0;" data-act="wyroznij-otwartego">
      ${z.wyrozniony ? "★ Wyróżniony" : "☆ Wyróżnij"}
    </button>

    <div class="section">
      <span class="label">Noga</span>
      <div class="chips">
        ${NOGI.map((n) => `<button class="chip" data-act="noga" data-v="${n}" aria-pressed="${z.noga === n}">${n}</button>`).join("")}
      </div>
    </div>

    <div class="section">
      <span class="label">Ocena · skala 1–10</span>
      ${OCENA_MAPY.map((k) => skala("mapa", k, RATING_LABELS[k], Number(ocena[k]) || 0, 10)).join("")}
      ${OCENA_GLOWA.map((f) => skala("mapa", f.key, f.label, Number(ocena[f.key]) || 0, 10)).join("")}
    </div>

    ${/* PROTOKÓŁ 1–6 PRZY KONKRETNYM ZAWODNIKU, wystawiany NA ŻYWO.
          Dotąd fazy gry i stałe fragmenty dało się ocenić dopiero po gwizdku i tylko raz — dla
          całego meczu. Tymczasem to są oceny zawodnika: jak zachowuje się w ataku, jak wraca,
          co robi przy rożnym. Ocenia się je patrząc, a nie z pamięci pół godziny później. */""}
    <div class="section">
      <span class="label">Fazy gry · skala 1–6</span>
      ${REPORT_PHASES.map((f) => skala("fazy", f.key, f.label, Number(fazy[f.key]) || 0, 6)).join("")}
    </div>

    <div class="section">
      <span class="label">Stałe fragmenty · skala 1–6</span>
      ${REPORT_SET_PIECES.map((f) => skala("sfg", f.key, f.label, Number(sfg[f.key]) || 0, 6)).join("")}
    </div>

    <div class="section">
      <div class="row" style="margin-bottom:6px;">
        <span class="label" style="margin:0;">Notatka</span>
        <button class="btn ghost small" data-act="dyktuj-notatke" id="dyktuj-btn">Dyktuj</button>
      </div>
      <textarea id="notatka-zawodnika" placeholder="Co zwróciło uwagę…">${esc(z.notatka || "")}</textarea>
    </div>

    ${/* DECYZJA PRZY NAZWISKU, NA TRYBUNIE.
          Ten sam zestaw, co w raporcie na komputerze. Dotąd dawało się ją wskazać wyłącznie po
          gwizdku, w jednym formularzu na cały mecz — czyli dotyczyła jednej osoby, a przy
          obserwacji zespołu nie dotyczyła nikogo. Tymczasem „tego chcę na testy" wie się w chwili,
          gdy się go ogląda, i przy dziewięciu wyróżnionych po meczu nikt tego nie odtworzy. */""}
    <div class="section">
      <span class="label">Decyzja</span>
      <div class="chips">
        ${STATUS_OPTIONS.map((s) => `
          <button class="chip" data-act="status-zawodnika" data-v="${esc(s.value)}" aria-pressed="${z.status === s.value}">${esc(s.label)}</button>`).join("")}
      </div>
      <p class="hint" style="margin-top:8px;">Zapisuje się samo. Wszystko z tego panelu — z decyzją —
      wejdzie do raportu tego zawodnika w SBS, a status trafi na jego profil.</p>
    </div>`;
}

// Obserwacja z bieżącego meczu wraz ze składem — wołane przy każdej zmianie na planszy.
function biezacyObsSklad(): { obs: Observation & { skladMeczu?: Sklad }; strona: SkladStrona } | null {
  if (!live) return null;
  const obs = cache.observations.find((o) => o.id === live!.observationId) as (Observation & { skladMeczu?: Sklad }) | undefined;
  const strona = obs?.skladMeczu?.[skladStrona];
  return obs && strona ? { obs, strona } : null;
}

// KOGO DOTYCZĄ OCENY WYSTAWIANE WŁAŚNIE TERAZ.
//
// Do tego samego panelu prowadzą dwie drogi: plansza w zakładce Składy (wskazany indeks) oraz
// pasek „Tagujesz" na ekranie zdarzeń (wybrany zawodnik). Rozstrzygamy to w JEDNYM miejscu —
// inaczej każda obsługa dotknięcia musiałaby wiedzieć, z którego ekranu przyszła, a dwie kopie
// tej samej logiki rozjeżdżają się przy pierwszej zmianie.
function ocenianyTeraz(): { obs: Observation & { skladMeczu?: Sklad }; strona?: SkladStrona; z: SkladZawodnik } | null {
  if (!live) return null;
  const obs = cache.observations.find((o) => o.id === live!.observationId) as (Observation & { skladMeczu?: Sklad }) | undefined;
  if (!obs) return null;
  if (liveTab === "sklady") {
    const strona = obs.skladMeczu?.[skladStrona];
    const z = strona?.zawodnicy[ocenianyZawodnik ?? -1];
    // Nazwa drużyny wchodzi w wynik, bo rozstrzyga imienników przy dopasowaniu do kartoteki.
    return z ? { obs, strona, z } : null;
  }
  if (!live.wybranyZawodnik) return null;
  for (const k of STRONY) {
    const strona = obs.skladMeczu?.[k];
    const z = (strona?.zawodnicy || []).find((x) => kluczZawodnika(x) === live!.wybranyZawodnik);
    if (z) return { obs, strona, z };
  }
  return null;
}

// Treść pól tekstowych żyje w DOM, nie w stanie — przed każdym przerysowaniem trzeba ją przepisać
// do zawodnika, inaczej notatka przepada przy pierwszym dotknięciu kropki oceny.
function zabezpieczNotatke() {
  const pole = $<HTMLTextAreaElement>("notatka-zawodnika");
  const dane = ocenianyTeraz();
  if (pole && dane) dane.z.notatka = pole.value;
}

// ROZPOZNAWANIE WKLEJONEGO SKŁADU.
//
// Ze strony meczu kopiuje się nie samą listę, tylko wszystko, co stoi na drodze: godzinę,
// wynik, nazwy zakładek („Przebieg", „Składy", „Statystyki"), nazwę klubu wersalikami.
// Wcześniej każdy taki wiersz stawał się „zawodnikiem" i po wklejeniu strony meczu w składzie
// lądowały trzydzieści trzy pozycje, z których żadna nie była człowiekiem.
//
// Rozpoznajemy więc po tym, jak wygląda nazwisko, a nie po tym, że wiersz jest niepusty:
// musi zawierać wyraz zapisany wielką literą i dalej małymi (Kowalski, Wójcik, Żmuda-Trzebiatowski).
// To odrzuca i „3- 1", i „BTS REKORD BIELSKO-BIAŁA", i „15:02 Y1".

// Nagłówki i etykiety, które na stronach meczowych wyglądają jak nazwisko — jedno słowo
// zapisane z wielkiej litery. Bez tej listy „Przebieg" czy „Sędzia" przechodzą przez sito.
const NIE_ZAWODNIK = new Set([
  "przebieg", "sklady", "skład", "składy", "szczegoly", "szczegóły", "statystyki", "sedzia",
  "sędzia", "sedziowie", "sędziowie", "widzow", "widzów", "widzowie", "trener", "trenerzy",
  "rezerwowi", "lawka", "ławka", "zmiany", "kartki", "gole", "bramki", "mecz", "tabela",
  "terminarz", "komentarze", "relacja", "wynik", "stadion", "data", "godzina", "kolejka",
  "liga", "runda", "sezon", "druzyna", "drużyna", "zawodnik", "zawodnicy", "minuta", "minuty",
  "asysta", "asysty", "obserwator", "delegat", "widownia", "podsumowanie", "poczatek", "początek",
]);

const WIELKA_MALE = /[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{2,}/;

function parsujSklad(tekst: string): SkladZawodnik[] {
  const wynik: SkladZawodnik[] = [];
  const juzJest = new Set<string>();
  // Numer z POPRZEDNIEGO wiersza. W aplikacjach z wynikami numer stoi we własnej komórce tabeli,
  // więc po skopiowaniu ląduje w osobnym wierszu, nad nazwiskiem:
  //     8
  //     Tomasz Boczek
  // Sam numer nie jest zawodnikiem, ale wyrzucenie go razem ze śmieciami kosztowało najważniejszą
  // informację na liście — bez numeru nie da się rozpoznać zawodnika z trybuny.
  let numerZPoprzedniego: string | undefined;

  for (const surowy of tekst.split("\n")) {
    let w = surowy.trim();

    // Wiersz będący wyłącznie liczbą to numer koszulki czekający na nazwisko. Minuty zmian
    // („70 '") mają apostrof i tu nie wpadną — inaczej podmieniałyby numery kolejnym zawodnikom.
    if (/^\d{1,2}$/.test(w)) { numerZPoprzedniego = w; continue; }

    if (w.length < 3 || w.length > 60) continue;

    let numer = numerZPoprzedniego;
    const zNumerem = w.match(/^(\d{1,2})[.)\s]+(.+)$/);
    if (zNumerem) { numer = zNumerem[1]; w = zNumerem[2].trim(); }

    // Ogony po nazwisku: minuty, kartki, nawiasy ze zmianą.
    w = w.replace(/\(.*?\)/g, " ").replace(/\d{1,3}\s*['’]/g, " ").replace(/\s{2,}/g, " ").trim();
    if (w.length < 3) continue;

    if (w === w.toUpperCase()) continue;                       // wersaliki = klub albo nagłówek
    if (!WIELKA_MALE.test(w)) continue;
    if (/\d{1,2}:\d{2}/.test(w)) continue;                    // godzina
    if (/^\d+\s*[-–—]\s*\d+$/.test(w)) continue;              // wynik

    const slowa = w.split(/\s+/);
    if (slowa.length > 4) continue;                            // zdanie, nie nazwisko

    const pierwsze = slowa[0].replace(/[.:,;)\]]+$/, "").toLowerCase();
    if (NIE_ZAWODNIK.has(pierwsze)) continue;
    if (/\d{3,}/.test(w)) continue;

    const klucz = w.toLowerCase();
    if (juzJest.has(klucz)) { numerZPoprzedniego = undefined; continue; }
    juzJest.add(klucz);
    wynik.push(numer ? { nazwa: w, numer } : { nazwa: w });
    numerZPoprzedniego = undefined;   // numer zużyty — nie może spłynąć na następne nazwisko
  }
  return wynik;
}


// KOGO DOTYCZY ZDARZENIE.
//
// Bez tego każde dotknięcie kafla lądowało „gdzieś w meczu": obserwacja zespołu nie wskazuje
// nikogo, a przy jednym wskazanym zawodniku i tak nie da się tagować drugiego. Wyróżnieni ze
// składu trafiają więc na pasek nad kaflami — dotknięcie przełącza, komu przypisują się kolejne
// zdarzenia. Wybór zostaje aż do zmiany, bo w trakcie akcji nie ma czasu na potwierdzanie.
function wyroznieniZawodnicy(): { klucz: string; etykieta: string }[] {
  if (!live) return [];
  const sklad = skladObserwacji(live.observationId);
  if (!sklad) return [];
  const wynik: { klucz: string; etykieta: string }[] = [];
  STRONY.forEach((strona) => {
    (sklad[strona]?.zawodnicy || []).forEach((z) => {
      if (z.wyrozniony) wynik.push({ klucz: kluczZawodnika(z), etykieta: kluczZawodnika(z) });
    });
  });
  return wynik;
}

function pasekZawodnikow(): string {
  const lista = wyroznieniZawodnicy();
  if (!lista.length) {
    return '<p class="hint">Wyróżnij zawodników w zakładce Składy, a pojawią się tutaj — wtedy zdarzenia przypiszesz konkretnej osobie.</p>';
  }
  const wybrany = live?.wybranyZawodnik || "";
  // Pasek zostaje przyklejony do góry ekranu (patrz .tagujesz-strefa w arkuszu): nazwisko
  // rozstrzyga, kogo dotyczą i kafle, i oceny, więc musi być pod ręką z każdego miejsca
  // przewijanej strony, a nie tylko z jej początku.
  return `
    <div class="tagujesz-strefa">
      <span class="label">Tagujesz i oceniasz</span>
      <div class="tagujesz">
        <button class="chip ${wybrany ? "" : "wybrany"}" data-act="taguj-kogo" data-v="" aria-pressed="${!wybrany}">Zespół</button>
        ${lista.map((z) => `
          <button class="chip ${wybrany === z.klucz ? "wybrany" : ""}" data-act="taguj-kogo" data-v="${esc(z.klucz)}" aria-pressed="${wybrany === z.klucz}">${esc(z.etykieta)}</button>`).join("")}
      </div>
    </div>`;
}

// Co już wystawiono temu zawodnikowi — jedną linijką, do nagłówka zwiniętego panelu.
// Bez tego zwinięty panel nie mówiłby nic o tym, czy ktoś jest już oceniony, czy jeszcze nie.
function skrotOcen(z: SkladZawodnik): string {
  const czesci: string[] = [];
  [...OCENA_MAPY.map((k) => ({ k, l: RATING_LABELS[k] })), ...OCENA_GLOWA.map((f) => ({ k: f.key, l: f.label }))]
    .forEach((x) => { if (Number(z.ocena?.[x.k]) > 0) czesci.push(`${x.l} ${z.ocena![x.k]}`); });
  REPORT_PHASES.forEach((f) => { if (Number(z.fazy?.[f.key]) > 0) czesci.push(`${f.label} ${z.fazy![f.key]}`); });
  REPORT_SET_PIECES.forEach((f) => { if (Number(z.sfg?.[f.key]) > 0) czesci.push(`${f.label} ${z.sfg![f.key]}`); });
  // Decyzja na PIERWSZYM miejscu — to jedyna rzecz z tego panelu, która zmienia coś poza raportem.
  if (z.status) czesci.unshift(z.status.toUpperCase());
  return czesci.join(" · ");
}

// PANEL OCENY ZARAZ POD NAZWISKAMI, NAD KAFLAMI.
//
// Stał wcześniej pod kaflami — i tam go po prostu nie było widać. Trzynaście skal nie mieści się
// nad kaflami rozwiniętych, więc panel zaczyna się zwinięty: jeden pasek z nazwiskiem i tym, co
// już wystawiono. Dotknięcie nazwiska zmienia go natychmiast, w miejscu, na które właśnie patrzy
// scout — a nie siedemset pikseli niżej.
//
// Rozwinięcie spycha kafle w dół, ale to świadome dotknięcie: kto otwiera oceny, ten w tej chwili
// ocenia. Zwija się z powrotem jednym dotknięciem tego samego paska, a wybór zostaje na cały mecz,
// bo scout pracuje seriami — albo taguje akcje, albo obchodzi wyróżnionych z ocenami.
function blokOceny(): string {
  const dane = ocenianyTeraz();
  if (!dane) return "";
  const z = dane.z;
  const skrot = skrotOcen(z);
  return `
    <div id="panel-oceny" class="ocena-blok">
      <button class="ocena-naglowek" data-act="rozwin-ocene" aria-expanded="${ocenaRozwinieta}">
        <span class="on-tytul">Oceniasz</span>
        <span class="on-kto">${esc(kluczZawodnika(z))}</span>
        <span class="on-strzalka" aria-hidden="true">${ocenaRozwinieta ? "▲" : "▼"}</span>
      </button>
      <div class="on-skrot">${skrot ? esc(skrot) : (ocenaRozwinieta ? "Wystaw oceny poniżej." : "Dotknij, żeby wystawić oceny — 1–10 i fazy gry 1–6.")}</div>
      ${ocenaRozwinieta ? `<div class="ocena-tresc">${viewOcenaZawodnika(z, true)}</div>` : ""}
    </div>`;
}

function skala(host: string, key: string, label: string, value: number, max: number): string {
  const cls = max === 6 ? "six" : "";
  return `
    <div class="scale">
      <div class="scale-head"><span class="nm">${esc(label)}</span><span class="val">${value || "—"}/${max}</span></div>
      <div class="dots">
        ${Array.from({ length: max }, (_, i) => i + 1).map((n) =>
          `<button class="dot ${n <= value ? "on " + cls : ""}" data-act="rate" data-host="${host}" data-k="${key}" data-v="${n}">${n}</button>`).join("")}
      </div>
    </div>`;
}

function viewOcena(): string {
  if (!ocena) {
    return `
      <h2>Ocena</h2>
      <p class="hint">Nie wybrano obserwacji.</p>
      <div class="empty">Wybierz obserwację w zakładce Obserwacje („Oceń") albo zakończ trwający mecz.</div>
      <button class="btn ghost" data-act="go-dzis">Przejdź do obserwacji</button>`;
  }
  const obs = cache.observations.find((o) => o.id === ocena!.observationId);
  const eventsInfo = live && live.observationId === ocena.observationId ? live.events.length : 0;

  const o = obs as (Observation & { poziomMeczu?: number; warunki?: string[]; notatkaMeczu?: string }) | undefined;
  const warunki = o?.warunki || [];
  const oceniony = ocenieniZeSkladu(obs);

  return `
    <h2>Po gwizdku</h2>
    <p class="hint">${esc(obs?.match || "")}${eventsInfo ? " · " + eventsInfo + " zdarzeń" : ""}</p>

    <span class="label">Ocena meczu</span>
    ${skala("mecz", "poziom", "Poziom meczu", Number(o?.poziomMeczu) || 0, 10)}
    <div class="field">
      <span class="label">Pogoda i warunki</span>
      <div class="chips">
        ${WARUNKI.map((w) => `<button class="chip" data-act="warunki" data-v="${esc(w)}" aria-pressed="${warunki.includes(w)}">${esc(w)}</button>`).join("")}
      </div>
    </div>
    <div class="field">
      <span class="label">Charakterystyka meczu</span>
      <textarea id="o-mecz-notatka" placeholder="Tempo, poziom rywalizacji, jak wyglądało spotkanie…" style="min-height:58px;">${esc(o?.notatkaMeczu || "")}</textarea>
      ${/* Kontekst meczu jest częścią KAŻDEJ oceny indywidualnej, a nie osobnym dokumentem.
            Te same siedem na dziesięć znaczy co innego w ulewie przy zerowym tempie, a co innego
            w meczu o czubek tabeli — dlatego ta adnotacja dopisuje się do raportu każdego
            ocenionego zawodnika, zamiast zostawać wyłącznie przy meczu. */""}
      <p class="hint" style="margin-top:6px;">Pogoda, poziom i ta charakterystyka wejdą do raportu <strong>każdego</strong> ocenionego zawodnika — bez tego ocena 7/10 nic nie znaczy.</p>
    </div>

    ${oceniony}

    ${/* PO GWIZDKU OCENIA SIĘ MECZ, NIE ZAWODNIKÓW.
          Zawodników ocenia się w trakcie, przy nazwisku — panel na ekranie zdarzeń ma komplet:
          skale 1–10, fazy gry, stałe fragmenty, notatkę i decyzję. Powtarzanie tego samego po
          gwizdku było resztką po czasach, gdy nie było gdzie tego zrobić wcześniej, i pytało
          o rzecz niemożliwą: JEDEN komplet ocen na mecz, w którym wyróżniono dziewięciu.

          Zostaje więc tylko to, co dotyczy spotkania: poziom, pogoda i charakterystyka — a one
          i tak dopisują się do raportu każdego ocenionego zawodnika.

          WYJĄTEK: obserwacja umówiona na KONKRETNEGO zawodnika. Tam nie ma składu ani paska
          wyróżnionych, więc ten ekran jest jedynym miejscem, gdzie da się go ocenić — i zostaje
          w całości. */""}
    ${!obs?.playerId ? "" : `
    <div class="section">
    <span class="label">Ocena zawodnika · skala 1–10</span>
    ${RATING_KEYS.map((k) => skala("ratings", k, RATING_LABELS[k], ocena!.ratings[k], 10)).join("")}
    </div>

    <div class="section">
      <span class="label">Fazy gry · skala 1–6</span>
      ${REPORT_PHASES.map((f) => skala("phases", f.key, f.label, ocena!.phases[f.key], 6)).join("")}
    </div>

    <div class="section">
      <span class="label">Stałe fragmenty · skala 1–6</span>
      ${REPORT_SET_PIECES.map((f) => skala("setPieces", f.key, f.label, ocena!.setPieces[f.key], 6)).join("")}
      <div class="field" style="margin-top:8px;">
        <textarea id="o-sfg" placeholder="Uwagi o stałych fragmentach…" style="min-height:60px;">${esc(ocena!.setPieceComment)}</textarea>
      </div>
    </div>

    <div class="section">
      <span class="label">Perspektywa</span>
      <div class="chips">
        ${PERSPEKTYWA.map((p) => `<button class="chip persp" data-act="persp" data-v="${esc(p)}" aria-pressed="${ocena!.perspektywa === p}">${esc(p)}</button>`).join("")}
      </div>
    </div>

    <div class="section">
      <span class="label">Decyzja / status zawodnika</span>
      <div class="chips">
        ${STATUS_OPTIONS.map((s) => `<button class="chip" data-act="status" data-v="${esc(s.value)}" aria-pressed="${ocena!.status === s.value}">${esc(s.label)}</button>`).join("")}
      </div>
      <p class="hint" style="margin-top:8px;">Status przypisze się zawodnikowi po zapisaniu — tak samo jak przy raporcie na komputerze.</p>
    </div>

    <div class="section">
      <div class="row" style="margin-bottom:6px;">
        <span class="label" style="margin:0;">Opis</span>
        <button class="btn ghost small" data-act="dictate" id="dictate-btn">Dyktuj</button>
      </div>
      <textarea id="o-desc" placeholder="Wrażenie ogólne, kontekst meczu…">${esc(ocena!.description)}</textarea>
    </div>`}

    <button class="btn" data-act="save-ocena">Zapisz i wyślij do SBS</button>
    <p class="hint" style="text-align:center; margin-top:8px;">Bez zasięgu trafi do kolejki i pójdzie samo.</p>`;
}

// ---------------------------------------------------------------------------
// Zakończona obserwacja
// ---------------------------------------------------------------------------
//
// Po zapisaniu ocen dorobek meczu znikał z telefonu: stan meczu był kasowany, a wejścia w
// gotową obserwację nie było. Dane szły do bazy, ale scout tego nie widział — a to jest
// dokładnie ta chwila, w której chce się jeszcze raz spojrzeć na to, co się zapisało.
function viewPodglad(): string {
  const obs = cache.observations.find((x) => x.id === podgladObsId) as (Observation & { skladMeczu?: Sklad }) | undefined;
  if (!obs) return '<h2>Obserwacja</h2><div class="empty">Nie znaleziono tej obserwacji.</div>';
  const o = obs as Observation & { poziomMeczu?: number; warunki?: string[]; notatkaMeczu?: string };

  const oceny = (obs.ratings || {}) as Record<string, number>;
  const wystawione = RATING_KEYS.filter((k) => Number(oceny[k]) > 0);
  const raport = cache.reports
    .filter((r) => r.date === obs.date && (!obs.playerId || r.playerId === obs.playerId))
    .slice(-1)[0];
  const zdarzenia = zdarzeniaObserwacji(obs.id);

  // Zestawienie zdarzeń wg zawodnika — to jest zapłata za stukanie w kafle w trakcie meczu.
  const wgZawodnika = new Map<string, Map<string, number>>();
  zdarzenia.forEach((e) => {
    const kto = e.zawodnik || "Zespół";
    if (!wgZawodnika.has(kto)) wgZawodnika.set(kto, new Map());
    const licznik = wgZawodnika.get(kto)!;
    const klucz = e.label + (e.quality === 1 ? " +" : " −");
    licznik.set(klucz, (licznik.get(klucz) || 0) + 1);
  });

  const skladHtml = STRONY.map((strona) => {
    const dane = obs.skladMeczu?.[strona];
    const oznaczeni = (dane?.zawodnicy || []).filter((z) => z.wyrozniony || z.pozycja || z.notatka || z.noga || z.status ||
      [z.ocena, z.fazy, z.sfg].some((w) => w && Object.values(w).some((n) => Number(n) > 0)));
    if (!oznaczeni.length) return "";
    return `
      <div class="section">
        <span class="label">${esc(dane?.nazwa || strona)}</span>
        <!-- SYSTEM GRY DA SIĘ USTAWIĆ PO MECZU.
             Dotąd wybierało się go wyłącznie w trakcie obserwacji, przy planszy — a na trybunie
             rzadko na to czas. Bez systemu wyróżnieni zawodnicy nie trafiają na mapę pozycji
             w SBS na komputerze: mapa zestawia zawodników W OBRĘBIE JEDNEGO systemu, więc mecz
             bez wskazanego układu nie ma jak się do niej podłączyć. Tu można to dopisać
             spokojnie, po powrocie. -->
        <div class="field" style="margin-bottom:8px;">
          <select data-act="podglad-formacja" data-strona="${strona}" aria-label="System gry — ${esc(dane?.nazwa || strona)}">
            <option value="">— system gry: nie wskazano —</option>
            ${FORMACJE.map((f) => `<option value="${esc(f)}" ${dane?.formacja === f ? "selected" : ""}>${esc(f)}</option>`).join("")}
          </select>
          ${dane?.formacja
            ? '<span class="hint" style="display:block; margin-top:4px; color:var(--good-fg);">Wyróżnieni trafią na mapę tego systemu w SBS.</span>'
            : '<span class="hint" style="display:block; margin-top:4px;">Wskaż system, żeby wyróżnieni trafili na mapę pozycji w SBS.</span>'}
        </div>
        ${oznaczeni.map((z) => {
          // Protokół 1–6 wystawiony na żywo. Widoczny tu, bo inaczej scout nie miałby jak
          // sprawdzić, co właściwie zapisał — a to jest ekran, na którym się to sprawdza.
          const protokol = [
            ...REPORT_PHASES.filter((f) => Number(z.fazy?.[f.key]) > 0).map((f) => `${f.label} ${z.fazy![f.key]}/6`),
            ...REPORT_SET_PIECES.filter((f) => Number(z.sfg?.[f.key]) > 0).map((f) => `${f.label} ${z.sfg![f.key]}/6`),
          ].join(" · ");
          return `
          <div class="card" style="padding:11px 12px;">
            <div class="row">
              <div class="name" style="font-size:15px;">${z.wyrozniony ? "★ " : ""}${esc(kluczZawodnika(z))}</div>
              <span style="display:flex; gap:6px;">
                ${z.status ? `<span class="tag" style="background:var(--accent-bg); color:var(--accent-fg);">${esc(z.status)}</span>` : ""}
                ${z.pozycja ? `<span class="tag">${esc(POZYCJE[z.pozycja])}</span>` : ""}
              </span>
            </div>
            ${z.noga ? `<div class="sub" style="margin-top:4px;">noga: ${esc(z.noga)}</div>` : ""}
            ${z.ocena && Object.values(z.ocena).some((n) => Number(n) > 0)
              ? `<div class="sub" style="margin-top:5px; font-family:var(--data);">${[
                  ...OCENA_MAPY.map((k) => ({ k, l: RATING_LABELS[k] })),
                  ...OCENA_GLOWA.map((f) => ({ k: f.key, l: f.label })),
                ].filter((x) => Number(z.ocena![x.k]) > 0)
                  .map((x) => x.l + " " + z.ocena![x.k]).join(" · ")}</div>` : ""}
            ${protokol ? `<div class="sub" style="margin-top:5px; font-family:var(--data);">${esc(protokol)}</div>` : ""}
            ${z.notatka ? `<div class="sub" style="margin-top:5px;">${esc(z.notatka)}</div>` : ""}
          </div>`;
        }).join("")}
      </div>`;
  }).join("");

  return `
    <h2>${esc(obs.match || "Obserwacja")}</h2>
    <p class="hint">${ligaChip(obs)}${esc(dataZDniem(obs.date || ""))}${obs.matchTime ? " · " + esc(obs.matchTime) : ""}${obs.scout ? " · " + esc(obs.scout) : ""}</p>

    ${(o as any).poziomMeczu || ((o as any).warunki || []).length || (o as any).notatkaMeczu ? `
      <div class="section" style="border-top:none; margin-top:0; padding-top:0;">
        <span class="label">Mecz</span>
        <div class="card">
          ${(o as any).poziomMeczu ? `<div class="row" style="margin-bottom:4px;"><span class="sub">Poziom meczu</span>
            <strong style="font-family:var(--data); color:var(--accent-fg);">${(o as any).poziomMeczu}/10</strong></div>` : ""}
          ${((o as any).warunki || []).length ? `<div class="chips" style="margin:6px 0;">${((o as any).warunki as string[]).map((w) => `<span class="tag">${esc(w)}</span>`).join("")}</div>` : ""}
          ${(o as any).notatkaMeczu ? `<div class="sub">${esc((o as any).notatkaMeczu)}</div>` : ""}
        </div>
      </div>` : ""}

    ${wystawione.length ? `
      <div class="section">
        <span class="label">Oceny obserwacji</span>
        <div class="card">
          ${wystawione.map((k) => `
            <div class="row" style="margin-bottom:4px;">
              <span class="sub">${esc(RATING_LABELS[k])}</span>
              <strong style="font-family:var(--data); color:var(--accent-fg);">${oceny[k]}/10</strong>
            </div>`).join("")}
        </div>
      </div>` : ""}

    ${raport?.description || raport?.perspektywa ? `
      <div class="section">
        <span class="label">Raport</span>
        <div class="card">
          ${raport.perspektywa ? `<div style="margin-bottom:6px;"><span class="tag">${esc(raport.perspektywa)}</span></div>` : ""}
          ${raport.description ? `<div class="sub">${esc(raport.description)}</div>` : ""}
        </div>
      </div>` : ""}

    ${wgZawodnika.size ? `
      <div class="section">
        <span class="label">Zdarzenia · ${zdarzenia.length}</span>
        ${[...wgZawodnika.entries()].map(([kto, licznik]) => `
          <div class="card" style="padding:11px 12px;">
            <div class="name" style="font-size:15px;">${esc(kto)}</div>
            <div class="sub" style="margin-top:5px;">${[...licznik.entries()].map(([co, ile]) => `${esc(co)} ${ile}`).join(" · ")}</div>
          </div>`).join("")}
      </div>` : ""}

    ${skladHtml}

    <button class="btn ghost" data-act="podglad-ocen">Popraw oceny</button>
    <button class="btn ghost" data-act="go-dzis">Wróć do listy</button>`;
}

// Po gwizdku warto widzieć, kto ma już ocenę ze składu — inaczej łatwo ocenić kogoś dwa razy
// albo pominąć zmiennika, który wszedł na dziesięć minut.
function ocenieniZeSkladu(obs?: Observation): string {
  const sklad = (obs as (Observation & { skladMeczu?: Sklad }) | undefined)?.skladMeczu;
  if (!sklad) return "";
  const lista: string[] = [];
  STRONY.forEach((strona) => {
    (sklad[strona]?.zawodnicy || []).forEach((z) => {
      const ma = [z.ocena, z.fazy, z.sfg].some((w) => w && Object.values(w).some((n) => Number(n) > 0));
      if (ma || z.wyrozniony) lista.push((z.wyrozniony ? "★ " : "") + kluczZawodnika(z));
    });
  });
  if (!lista.length) return "";
  return `
    <div class="section">
      <span class="label">Ze składu · ${lista.length}</span>
      <p class="hint" style="margin:0;">${lista.map(esc).join(" · ")}</p>
    </div>`;
}

// Czego dotyczą odrzucone zapisy — po ludzku, nazwami meczów, a nie identyfikatorami.
// „24 zapisy" nic nie mówi; „Legia Warszawa - Lech Poznań i 3 inne" mówi wszystko.
function opisZablokowanych(lista: ReturnType<typeof zablokowaneZadania>): string {
  const nazwy = new Set<string>();
  lista.forEach((z) => {
    const j = z.job;
    const id = j.kind === "observation" ? String(j.row.id || "")
      : j.kind === "liveEvents" || j.kind === "usunObserwacje" ? j.observationId
      : "";
    if (id) {
      const o = cache.observations.find((x) => x.id === id);
      nazwy.add(o?.match || "obserwacja");
    } else if (j.kind === "report") nazwy.add("raport");
    else if (j.kind === "playerStatus") nazwy.add("decyzja o zawodniku");
  });
  const lista3 = [...nazwy].slice(0, 3);
  const reszta = nazwy.size - lista3.length;
  return lista3.join(", ") + (reszta > 0 ? ` i ${reszta} inne` : "");
}

// Czy panel stoi pod adresem ROBOCZYM, wydanym dla gałęzi w trakcie prac. Serwer wstawia w taki
// adres człon „-git-" i to jest jedyna różnica widoczna z wnętrza aplikacji — pod każdym innym
// względem zachowuje się identycznie jak docelowy.
const adresRoboczy = (): boolean => /-git-/.test(location.host);

function viewBaza(): string {
  const n = queueLength();
  const ostatnia = cache.fetchedAt
    ? new Date(cache.fetchedAt).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "brak";
  const problemy = cache.problemy || [];
  const zablokowane = zablokowaneZadania();
  const bladWysylki = ostatniBladWysylki();

  return `
    <h2>Ustawienia</h2>
    <p class="hint">Stan aplikacji i kopii danych w telefonie.</p>

    <div class="card">
      <div class="row"><span class="sub">Czeka na wysyłkę</span>
        <strong style="font-family:var(--data); color:${n ? "var(--accent-fg)" : "var(--good-fg)"};">${n}</strong></div>
      <!-- Czemu kolejka stoi. Bez tego „W kolejce · 10" znaczy naraz: nie ma sieci, baza śpi,
           token wygasł albo panel po prostu jeszcze nie spróbował — cztery różne rzeczy z czterema
           różnymi rozwiązaniami, nie do odróżnienia z ekranu. -->
      ${/* Warunek jest na SAMEJ TREŚCI, nie na „coś czeka w kolejce". Przy tym drugim powód
            znikał dokładnie wtedy, gdy był najbardziej potrzebny: po dotknięciu „spróbuj jeszcze
            raz" zapisy schodziły z kolejki do odstawionych, licznik czekających spadał do zera
            i wraz z nim gasło jedyne zdanie mówiące, czemu baza odmówiła. Treść kasuje się sama
            po udanej wysyłce, więc nie ma czego pilnować dodatkowym warunkiem. */""}
      ${bladWysylki ? `<p class="hint" style="margin:4px 0 0; font-family:var(--data); font-size:11.5px;
        color:var(--bad-fg); word-break:break-word;">${esc(bladWysylki)}</p>` : ""}
      <div class="row" style="margin-top:6px;"><span class="sub">Kopia bazy</span>
        <strong style="font-family:var(--data); font-size:12.5px; color:var(--text-2);">${esc(ostatnia)}</strong></div>
      <div class="row" style="margin-top:6px;"><span class="sub">Zawodników w kopii</span>
        <strong style="font-family:var(--data); font-size:12.5px; color:var(--text-2);">${cache.players.length}</strong></div>
      <div class="row" style="margin-top:6px;"><span class="sub">Meczów w terminarzu</span>
        <strong style="font-family:var(--data); font-size:12.5px; color:${cache.matches.length ? "var(--text-2)" : "var(--accent-fg)"};">${cache.matches.length}</strong></div>
      <div class="row" style="margin-top:6px;"><span class="sub">Wersja panelu</span>
        <strong style="font-family:var(--data); font-size:12.5px; color:var(--text-2);">${esc(WERSJA_PANELU)}</strong></div>
      <!-- ADRES, POD KTÓRYM STOI TEN PANEL.
           Aplikacja dodana do ekranu głównego nie ma paska adresu, więc z jej wnętrza nie da się
           stwierdzić, gdzie właściwie się jest. A to bywa rozstrzygające: serwer wydaje dwa rodzaje
           adresów — stały adres aplikacji, który dostaje każdą kolejną wersję, i adres KONKRETNEGO
           wdrożenia, zamrożony na zawsze. Ikona zapisana kiedyś na ten drugi pokazuje w kółko tę
           samą wersję sprzed miesięcy, mimo poprawnych wdrożeń i pełnego zasięgu — i nie ma z niej
           żadnego sygnału, że tak jest. -->
      <div class="row" style="margin-top:6px;"><span class="sub">Adres</span>
        <strong style="font-family:var(--data); font-size:12.5px; min-width:0; overflow:hidden; text-overflow:ellipsis;
                       color:${adresRoboczy() ? "var(--bad-fg)" : "var(--text-2)"};">${esc(location.host)}</strong></div>
      ${/* ADRES ROBOCZY WYGLĄDA IDENTYCZNIE JAK DOCELOWY — I TO JEST PUŁAPKA.
            Serwer wydaje osobny adres dla każdej gałęzi roboczej. Panel działa pod nim tak samo,
            loguje się do tej samej bazy i pokazuje te same dane, więc z ekranu nie da się poznać,
            że to nie jest miejsce, do którego trafiają kolejne wersje. Ikona zapisana kiedyś na
            taki adres pokazuje w kółko starą aplikację, a każda wdrożona poprawka wygląda jak
            poprawka, która nie zadziałała. Kosztowało to pół dnia, zanim wyszło na jaw. */""}
      ${adresRoboczy() ? `
        <p class="hint" style="margin-top:6px; color:var(--bad-fg);">
          To jest adres <strong>roboczy</strong>, nie docelowy — nowe wersje panelu mogą tu nie docierać.
          Właściwy adres to <strong>scoutbasesystem.vercel.app/m</strong>. Zanim się przeniesiesz, wyślij
          wszystko z kolejki: każdy adres ma własną pamięć i to, co tu czeka, tam nie przejdzie.</p>` : ""}
      <!-- Wynik ostatniego pytania o wersję. Bez tego wiersza „nie ma paska o nowszej wersji"
           znaczy naraz dwie rzeczy: że nowszej nie ma i że nie udało się o nią zapytać. -->
      <div class="row" style="margin-top:6px;"><span class="sub">Sprawdzenie wersji</span>
        <strong style="font-family:var(--data); font-size:12px; min-width:0; overflow:hidden; text-overflow:ellipsis;
                       color:${stanWersji.startsWith("na serwerze") ? "var(--accent-fg)" : stanWersji === "masz najnowszą" ? "var(--good-fg)" : "var(--text-2)"};">${esc(stanWersji)}</strong></div>
      <!-- Konto zostaje tu jako INFORMACJA, nie przycisk (wylogowanie przeniosło się na ekran
           obserwacji). Bez niego zalogowanie się w telefonie innym kontem niż na komputerze daje
           pustą bazę bez jednej wskazówki, skąd się wzięła. -->
      <div class="row" style="margin-top:6px;"><span class="sub">Konto</span>
        <strong style="font-family:var(--data); font-size:12.5px; color:var(--text-2); min-width:0; overflow:hidden; text-overflow:ellipsis;">${esc(kontoEmail || "—")}</strong></div>
      <button class="btn ghost" data-act="refresh">Odśwież kopię bazy</button>
      <button class="btn ghost" data-act="sprawdz-wersje">Sprawdź, czy jest nowsza wersja</button>
      <!-- WYJŚCIE AWARYJNE, dostępne ZAWSZE — nie tylko wtedy, gdy panel sam wykrył nowszą wersję.
           Zdarzyło się dokładnie odwrotnie: wdrożona poprawka nie docierała do telefonu, a jedyny
           przycisk, który mógł to naprawić, pokazywał się wyłącznie po wykryciu — czyli wtedy,
           gdy problem już nie istniał. -->
      <button class="btn ghost" data-act="wymus-aktualizacje">Wymuś pobranie najnowszej wersji</button>
      <p class="hint" style="margin-top:6px;">Czyści zapisane pliki aplikacji i pobiera ją od nowa.
      Obserwacje, trwający mecz i kolejka wysyłki zostają nietknięte.</p>
      ${n ? '<button class="btn ghost" data-act="flush">Wyślij teraz</button>' : ""}
    </div>

    ${zablokowane.length ? `
      <div class="card" style="border-color:var(--bad-fg);">
        <span class="label" style="color:var(--bad-fg);">Baza odrzuciła ${zablokowane.length} ${zablokowane.length === 1 ? "zapis" : "zapisów"}</span>
        <p class="hint" style="margin:6px 0 0; color:var(--text-strong);">
          Te zapisy NIE dotarły do SBS i nie zobaczysz ich na komputerze. Nic nie przepadło —
          czekają w telefonie. Poniżej treść odmowy prosto z bazy:</p>
        ${[...new Set(zablokowane.map((z) => z.blad))].slice(0, 3).map((b) => `
          <p class="hint" style="margin:6px 0 0; font-family:var(--data); font-size:11.5px; color:var(--bad-fg); word-break:break-word;">${esc(b)}</p>`).join("")}
        <p class="hint" style="margin-top:8px;">Czego dotyczą: ${esc(opisZablokowanych(zablokowane))}.</p>
        <button class="btn ghost" data-act="ponow-zablokowane">Spróbuj wysłać jeszcze raz</button>
      </div>` : ""}

    ${problemy.length ? `
      <div class="card" style="border-color:var(--accent-fg);">
        <span class="label">Ostatnie pobranie — czego nie udało się wziąć</span>
        ${problemy.map((p) => `<p class="hint" style="margin:4px 0 0; color:var(--text-strong);">• ${esc(p)}</p>`).join("")}
        <p class="hint" style="margin-top:8px;">To, co się nie pobrało, zostało w telefonie z poprzedniego
        razu — nic nie przepadło. Najczęstsza przyczyna to uśpiona baza (wystarczy odświeżyć jeszcze raz)
        albo brak uprawnień do konta.</p>
      </div>` : ""}

    <p class="hint">Kopia bazy to zawodnicy, kluby i plany trzymane w telefonie. Z niej bierze się
    kadra klubu przy składzie — odśwież ją przy zasięgu, zanim pojedziesz na mecz.</p>

    <div class="section">
      <span class="label">Efekty ruchu</span>
      <!-- Trzy kolumny zamiast domyślnych dwóch: przy dwóch trzeci wariant spadał do drugiego
           rzędu i wyglądał jak coś innego niż pozostałe dwa, choć jest z nimi równorzędny. -->
      <div class="polarity" style="margin-top:6px; grid-template-columns:repeat(3,1fr);">
        <button class="pol seg" data-act="ruch" data-v="system" aria-pressed="${wybranyRuch() === "system"}">Jak telefon</button>
        <button class="pol seg" data-act="ruch" data-v="pelne" aria-pressed="${wybranyRuch() === "pelne"}">Włączone</button>
        <button class="pol seg" data-act="ruch" data-v="oszczedne" aria-pressed="${wybranyRuch() === "oszczedne"}">Wyłączone</button>
      </div>
      <p class="hint" style="margin-top:8px;">Ekran powitalny i logowania grają <strong>zawsze</strong> —
        to jedyne miejsca, w których nic się nie rejestruje. Ten przełącznik dotyczy ruchu
        w trakcie pracy: herb kręcącego się przy odświeżaniu i przenikania komunikatów.
        <strong>Wyłączone</strong> gasi wszystko, łącznie z powitaniem.${systemOgraniczaRuch()
        ? " Twój iPhone ma włączone <strong>Ogranicz ruch</strong> (Ustawienia → Dostępność → Ruch) — "
          + "panel to uszanował w trakcie pracy, ale powitania i logowania nie wygasza."
        : ""}</p>
    </div>

    ${instalacjaHtml()}`;
}

// ---------------------------------------------------------------------------
// Ikona na ekranie telefonu
// ---------------------------------------------------------------------------
//
// Instrukcja musi być W APLIKACJI, bo pokazuje się dokładnie tam, gdzie stoi ten, kto jej
// potrzebuje. Dodania ikony nie da się wykonać kodem — iOS dopuszcza to wyłącznie ręcznie,
// z Safari. Dlatego jedyne, co możemy zrobić, to nazwać właściwy przycisk, powiedzieć, gdzie
// go szukać, i podać adres w postaci gotowej do wklejenia.
//
// Rozróżnienie przeglądarek na iOS opiera się na `navigator.standalone`:
//   true      — panel działa już z ikony, nie ma czego dodawać,
//   false     — prawdziwe Safari, instrukcja ma sens,
//   undefined — przeglądarka osadzona w innej aplikacji (Claude, Messenger, Instagram),
//               gdzie opcji dodania po prostu nie ma i trzeba najpierw przejść do Safari.
// Czy panel jest już uruchomiony Z IKONY, a nie z zakładki przeglądarki?
function zIkonyNaEkranie(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || !!window.matchMedia?.("(display-mode: standalone)").matches;
}

// Gdzie stoi ten, kto czyta. Trzy sytuacje, trzy różne instrukcje — patrz komentarz niżej.
function gdzieJestem(): "z-ikony" | "obca-przegladarka" | "ios-safari" | "inna" {
  if (zIkonyNaEkranie()) return "z-ikony";
  const nav = navigator as Navigator & { standalone?: boolean };
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (!iOS) return "inna";
  return nav.standalone === undefined ? "obca-przegladarka" : "ios-safari";
}

// ZAPROSZENIE DO DODANIA IKONY, NA PIERWSZYM EKRANIE.
//
// Instrukcja schowana w Ustawieniach nie działa: trzeba wiedzieć, że tam jest. Ten pasek stoi
// nad listą obserwacji dopóty, dopóki panel chodzi z zakładki przeglądarki — i znika sam w chwili,
// gdy zostanie uruchomiony z ikony. Da się go też odłożyć na bok, żeby nie zawadzał codziennie.
const LS_BANER_IKONA = "sbs-m:baner-ikona";

function banerIkony(): string {
  const gdzie = gdzieJestem();
  if (gdzie === "z-ikony") return "";
  try {
    if (localStorage.getItem(LS_BANER_IKONA) === "schowany") return "";
  } catch {
    /* tryb prywatny — pasek pokaże się za każdym razem, to mniejsze zło niż brak ikony */
  }

  const tresc = gdzie === "obca-przegladarka"
    ? "Jesteś w przeglądarce wbudowanej w inną aplikację — <strong>tu iPhone nie pozwala dodać ikony</strong>. Otwórz panel w Safari, wtedy się uda."
    : "Dodaj ikonę na ekran telefonu — panel otworzysz jednym dotknięciem, bez wpisywania adresu.";

  return `
    <div class="card" style="border-color:var(--accent-fg); margin-bottom:12px;">
      <p class="sub" style="margin:0 0 10px; color:var(--text-strong);">📲 ${tresc}</p>
      <div style="display:flex; gap:8px;">
        <button class="btn" data-act="pokaz-instalacje">Pokaż jak</button>
        <button class="btn ghost" style="flex:0 0 auto; width:112px; white-space:nowrap;" data-act="schowaj-baner">Nie teraz</button>
      </div>
    </div>`;
}

function instalacjaHtml(): string {
  const gdzie = gdzieJestem();
  if (gdzie === "z-ikony") return "";

  const wObcejPrzegladarce = gdzie === "obca-przegladarka";
  const iOS = gdzie === "ios-safari" || wObcejPrzegladarce;
  const adres = location.origin + "/m";

  const kroki = wObcejPrzegladarce
    ? `<p class="sub" style="margin:0 0 8px;">Jesteś w przeglądarce wbudowanej w inną aplikację — tutaj iPhone nie pozwala dodać ikony. Trzeba przejść do Safari:</p>
       <ol style="margin:0; padding-left:18px; font-size:13.5px; color:var(--text-2); line-height:1.7;">
         <li>Skopiuj adres przyciskiem poniżej</li>
         <li>Wyjdź na ekran główny i otwórz <strong>Safari</strong> (niebieski kompas)</li>
         <li>Wklej adres w pasku i otwórz stronę</li>
         <li>Dotknij <strong>kwadratu ze strzałką w górę</strong> ⬆︎ (jeśli pasek adresu masz na dole — dotknij go raz, żeby pokazały się ikony)</li>
         <li>Przewiń listę w dół → <strong>„Do ekranu początkowego"</strong> → <strong>Dodaj</strong></li>
       </ol>`
    : iOS
    ? `<ol style="margin:0; padding-left:18px; font-size:13.5px; color:var(--text-2); line-height:1.7;">
         <li>Dotknij <strong>kwadratu ze strzałką w górę</strong> ⬆︎ na pasku Safari (jeśli pasek masz na dole — dotknij go raz, żeby pokazały się ikony)</li>
         <li>Przewiń listę w dół — pozycja jest dość nisko</li>
         <li><strong>„Do ekranu początkowego"</strong> → <strong>Dodaj</strong></li>
       </ol>`
    : `<ol style="margin:0; padding-left:18px; font-size:13.5px; color:var(--text-2); line-height:1.7;">
         <li>Menu przeglądarki <strong>⋮</strong></li>
         <li><strong>„Zainstaluj aplikację"</strong> albo <strong>„Dodaj do ekranu głównego"</strong></li>
       </ol>`;

  return `
    <div class="section" id="instalacja">
      <span class="label">Ikona na ekranie telefonu</span>
      <div class="card">
        ${kroki}
        <div class="field" style="margin:12px 0 0;">
          <input id="adres-panelu" readonly value="${esc(adres)}" style="font-size:13px;">
        </div>
        <button class="btn ghost" data-act="kopiuj-adres">Kopiuj adres</button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Szkielet i przerysowanie
// ---------------------------------------------------------------------------

// Herb SBS. Ten sam plik służy za ikonę na ekranie głównym telefonu (public/manifest.webmanifest),
// więc po instalacji panelu ikona i logo w aplikacji są tym samym znakiem.
const LOGO = "/icon-192.png";

// Data zbudowania wdrożonej wersji. W trybie deweloperskim podstawienia nie ma, stąd zabezpieczenie.
const WERSJA_PANELU = typeof __WERSJA__ === "string" ? __WERSJA__ : "wersja robocza";

const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.1 5.1l1.4 1.4M17.5 17.5l1.4 1.4M18.9 5.1l-1.4 1.4M6.5 17.5l-1.4 1.4"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>';

// ZAKŁADKI POJAWIAJĄ SIĘ, GDY SĄ DO CZEGOŚ.
//
// „Ocena" i „Baza" zajmowały połowę paska, a wchodziło się w nie rzadko albo wcale: ocena ma sens
// wyłącznie po gwizdku konkretnego meczu i dojście do niej prowadzi przez obserwację, a nie przez
// stały przycisk. Wyszukiwarka bazy okazała się w terenie zbędna — zawodnika szuka się przy
// planowaniu i przy składzie, czyli tam, gdzie jest do czegoś potrzebny.
const TABS: { id: ViewName; label: string; icon: string }[] = [
  { id: "dzis", label: "Obserwacje", icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>' },
  // Live tylko w trakcie meczu — patrz widoczneZakladki(). Poza meczem prowadziła do pustego
  // ekranu, a w trakcie jest jedyną drogą powrotu jednym dotknięciem.
  { id: "live", label: "Live", icon: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>' },
  { id: "baza", label: "Ustawienia", icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>' },
];

// Zakładka Live ma sens wyłącznie wtedy, gdy jest mecz do prowadzenia — trwający albo taki,
// z którego zdarzenia jeszcze nie zostały rozliczone. Na co dzień pasek zostaje dwuelementowy.
function widoczneZakladki(): typeof TABS {
  return TABS.filter((t) => t.id !== "live" || live || view === "live");
}

function syncPill(): string {
  const n = queueLength();
  const odrzucone = liczbaZablokowanych();
  if (!navigator.onLine) return `<span class="sync offline">Offline${n ? " · " + n : ""}</span>`;
  if (n) return `<span class="sync pending">W kolejce · ${n}</span>`;
  // ODRZUCONE MAJĄ WŁASNY STAN, nie „wysłane". Zapis, którego baza nie przyjęła, wypada z kolejki
  // — i gdyby pasek pokazywał wtedy „Wysłane", scout miałby czarno na białym potwierdzenie
  // czegoś, co się nie stało. To najgorszy możliwy komunikat w całym panelu.
  if (odrzucone) return `<span class="sync offline">Odrzucone · ${odrzucone}</span>`;
  // Krótko, bo pasek dzieli szerokość z nazwą aplikacji i przyciskiem motywu.
  return '<span class="sync">Wysłane</span>';
}

// Który to ekran — nie sam widok, ale i zakładka wewnątrz Live. Po tym poznajemy, czy właśnie
// przerysowujemy TO SAMO (dotknięcie kropki oceny), czy przechodzimy gdzie indziej.
const sygnaturaEkranu = () => [view, liveTab, skladWidok, ocenianyZawodnik ?? "", wyborZKadry ?? "", obsadzanaPozycja ?? ""].join("|");
let poprzedniEkran = "";

function render() {
  const app = $("app");
  if (!app) return;
  // ILE BYŁO PRZEWINIĘTE.
  //
  // Strona budowana jest od nowa (innerHTML), więc wszystko wraca na początek. Dopóki ekrany
  // mieściły się bez przewijania, nikt tego nie zauważał. Odkąd pod kaflami zdarzeń stoi panel
  // oceny, każde dotknięcie kropki odrzucałoby scouta na górę ekranu — czyli po każdej ocenie
  // trzeba by przewijać całą jego długość z powrotem, w trakcie meczu.
  //
  // Przewija się <main>, a NIE okno: pasek górny i zakładki stoją nieruchomo, a treść między nimi
  // ma własne okno przewijania (overflow-y:auto w arkuszu). window.scrollY jest tu zawsze zerem.
  const przewiniete = $("main")?.scrollTop || 0;
  // Pasek „Tagujesz" przewija się w bok i też zaczynałby od nowa. Przy dziewięciu wyróżnionych
  // dotknięcie ostatniego z nich odrzucałoby pasek na sam początek — czyli w miejsce, z którego
  // nie widać tego, kogo się właśnie wybrało.
  const przewinietyPasek = (document.querySelector(".tagujesz") as HTMLElement | null)?.scrollLeft || 0;
  const tenSamEkran = sygnaturaEkranu() === poprzedniEkran;
  const body =
    view === "dzis" ? viewDzis() :
    view === "nowa" ? viewNowa() :
    view === "live" ? viewLive() :
    view === "ocena" ? viewOcena() :
    view === "podglad" ? viewPodglad() :
    view === "terminarz" ? viewTerminarz() :
    view === "wklej" ? viewWklej() :
    viewBaza();

  app.innerHTML = `
    <div class="topbar">
      <button class="mark-btn" data-act="refresh" aria-busy="${odswiezanie}"
              aria-label="Odśwież dane z SBS" title="Odśwież dane z SBS">
        <img class="mark" src="${LOGO}" alt="">
      </button>
      <h1>SBS Scout Live</h1>
      ${syncPill()}
      ${themeButtonHtml()}
    </div>
    ${nowaWersja
      ? `<button class="nowa-wersja" data-act="wczytaj-wersje">Jest nowsza wersja panelu — dotknij, żeby ją wczytać</button>`
      : ""}
    <main id="main">${body}</main>
    <nav class="tabbar">
      ${widoczneZakladki().map((t) => `
        <button class="tab" data-act="go" data-v="${t.id}" aria-selected="${view === t.id || (view === "nowa" && t.id === "dzis")}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">${t.icon}</svg>
          ${t.label}
        </button>`).join("")}
      <!-- Wylogowanie w OSTATNIEJ kolumnie siatki, nie zaraz za zakładkami: pasek ma cztery
           kolumny, a zakładek bywa dwie albo trzy (Live tylko w trakcie meczu). Bez tego przycisk
           przeskakiwałby w bok przy pierwszym gwizdku, czyli dokładnie wtedy, gdy kciuk uczy się
           panelu na pamięć. Trzyma się prawego rogu niezależnie od tego, co obok. -->
      ${zalogowany
        ? `<button class="tab tab-wyloguj" style="grid-column:4;" data-act="logout">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>
             Wyloguj
           </button>`
        : `<button class="tab" style="grid-column:4;" data-act="go-login">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/></svg>
             Zaloguj
           </button>`}
    </nav>`;

  // Przewinięcie wraca tylko przy przerysowaniu TEGO SAMEGO ekranu. Po przejściu gdzie indziej
  // zaczynamy od góry — nowy ekran otwarty w połowie wygląda na uszkodzony. Pasek wyróżnionych
  // wraca zawsze: on nie zmienia treści przy przejściu między zakładkami Live.
  poprzedniEkran = sygnaturaEkranu();
  if (tenSamEkran && przewiniete) { const m = $("main"); if (m) m.scrollTop = przewiniete; }
  if (przewinietyPasek) {
    const pasek = document.querySelector(".tagujesz") as HTMLElement | null;
    if (pasek) pasek.scrollLeft = przewinietyPasek;
  }

  if (view === "live" && live) startClockTicker();
  else window.clearInterval(clockTimer);
}

// Odświeżenie samego paska stanu — bez przerysowania widoku, żeby nie kasować tego, co scout
// właśnie wpisuje w pole tekstowe.
function refreshSyncPill() {
  const bar = document.querySelector(".topbar .sync");
  if (bar) bar.outerHTML = syncPill();
}

// ---------------------------------------------------------------------------
// Obsługa dotknięć
// ---------------------------------------------------------------------------

function beginLive(obsId: string) {
  const obs = cache.observations.find((o) => o.id === obsId);
  if (!obs) return;
  if (live && live.observationId !== obsId) {
    // Zdarzenia poprzedniego meczu odkładamy do wysyłki, zanim stan zostanie zastąpiony —
    // inaczej przełączenie meczu skasowałoby całą poprzednią oś.
    saveLiveEvents(live.observationId, live.events);
  }
  if (!live || live.observationId !== obsId) {
    live = {
      observationId: obsId,
      playerId: obs.playerId,
      matchLabel: obs.match || obs.date || "",
      half: 1, seconds: 0, running: false, startedAt: null, events: [],
    };
    setLive(live);
  }
  view = "live";
  render();
}

function addEvent(key: string) {
  if (!live) return;
  const tag = EVENT_TAGS.find((t) => t.key === key);
  if (!tag) return;
  const noteEl = $<HTMLInputElement>("quick-note");
  const ev: LiveEvent = {
    id: uid("lev"),
    observationId: live.observationId,
    playerId: live.playerId,
    half: live.half,
    minute: liveMinute(live),
    type: tag.key,
    label: tag.label,
    quality: polarity,
    zawodnik: live.wybranyZawodnik || undefined,
    note: noteEl?.value.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
  live.events.push(ev);
  setLive(live);
  if (noteEl) noteEl.value = "";
  if (navigator.vibrate) navigator.vibrate(12);
  render();
}

function finishLive() {
  if (!live) return;
  live.running = false;
  void pilnujEkranu();
  saveLiveEvents(live.observationId, live.events);
  zarchiwizujZdarzenia(live.observationId, live.events);
  startOcena(live.observationId);
  live.running = false;
  setLive(live);
  view = "ocena";
  render();
  // Nie „wystaw oceny": te zapadły już w trakcie meczu, przy nazwiskach. Tu opisuje się spotkanie.
  toast("Zdarzenia zapisane — opisz mecz");
}

// Treść pól tekstowych ekranu oceny żyje w DOM — przed przerysowaniem trzeba ją przepisać
// do stanu, inaczej znika przy pierwszym dotknięciu kropki.
function zabezpieczOcene() {
  if (!ocena) return;
  ocena.description = $<HTMLTextAreaElement>("o-desc")?.value ?? ocena.description;
  ocena.setPieceComment = $<HTMLTextAreaElement>("o-sfg")?.value ?? ocena.setPieceComment;
  const notatka = $<HTMLTextAreaElement>("o-mecz-notatka");
  const obs = cache.observations.find((x) => x.id === ocena!.observationId) as (Observation & { notatkaMeczu?: string }) | undefined;
  if (notatka && obs) obs.notatkaMeczu = notatka.value;
}

// Dopasowanie zawodnika ze SKŁADU do kartoteki.
//
// Skład trzyma samo nazwisko — nie ma w nim identyfikatora, bo powstaje z wklejonej strony meczu
// albo z protokołu. Bez tego dopasowania oceny wystawione z trybun zostają przy obserwacji
// i nigdy nie trafiają do profilu zawodnika.
//
// Porównujemy ZBIÓR słów, nie napis: protokoły podają raz „Jan Kowalski", raz „Kowalski Jan”.
// Polskie znaki pomijamy, bo część źródeł zapisuje nazwiska bez nich.
const normImie = (s: string) => String(s || "").toLowerCase()
  .replace(/[łøđ]/g, (c) => ({ "ł": "l", "ø": "o", "đ": "d" }[c] as string))
  .normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
const kluczOsoby = (s: string) => String(s || "").split(/\s+/).map(normImie).filter(Boolean).sort().join(" ");

function znajdzZawodnika(nazwa: string, nazwaKlubu?: string): string | null {
  const szukany = kluczOsoby(nazwa);
  if (!szukany) return null;
  let kandydaci = cache.players.filter((p) => kluczOsoby(`${p.firstName || ""} ${p.lastName || ""}`) === szukany);
  if (!kandydaci.length) return null;
  if (kandydaci.length === 1) return kandydaci[0].id;
  // Imiennicy: rozstrzyga klub, po której stronie składu zawodnik wystąpił.
  if (nazwaKlubu) {
    const k = normImie(nazwaKlubu);
    const wKlubie = kandydaci.filter((p) => {
      const c = cache.clubs.find((x) => x.id === p.clubId);
      const n = normImie(c?.name || "");
      return n && (n === k || (n.length >= 5 && k.length >= 5 && (n.includes(k) || k.includes(n))));
    });
    if (wKlubie.length === 1) return wKlubie[0].id;
  }
  // Dalej niejednoznacznie — świadomie NIE zgadujemy. Lepiej pominąć i powiedzieć o tym,
  // niż dopisać ocenę niewłaściwej osobie.
  return null;
}

// Ocena zawodnika wystawiona ze składu ląduje jako JEGO WŁASNA OBSERWACJA.
//
// W SBS średnia zawodnika liczy się z obserwacji — gdyby ocena została tylko w składzie meczu,
// nie podniosłaby ani średniej, ani licznika obserwacji, ani nie wypełniła mapy rankingowej.
// Obejrzenie dziewięciu zawodników w jednym meczu to dziewięć obserwacji i tak też to zapisujemy.
//
// Identyfikator jest WYLICZANY z obserwacji meczowej i zawodnika, a nie losowy. Dzięki temu
// ponowny zapis tego samego meczu poprawia istniejący wpis, zamiast dokładać drugi.
function savePlayerRatingsFromSquad(
  playerId: string, oceny: Record<string, number>, data: string, scout: string,
  obs: Observation, z: SkladZawodnik,
): void {
  const ratings: Record<string, number> = {};
  RATING_KEYS.forEach((k) => { if (Number(oceny[k]) > 0) ratings[k] = Number(oceny[k]); });
  const notatki = [z.wyrozniony ? "Wyróżnił się." : "", z.notatka || ""].filter(Boolean).join(" ");
  // Bez ocen liczbowych obserwacji nie zakładamy — samo wyróżnienie zostaje w składzie meczu
  // i w raporcie. Pusta obserwacja psułaby licznik, sugerując pracę, której nie było.
  if (!Object.keys(ratings).length && !notatki) return;
  saveObservation({
    id: `${obs.id}:${playerId}`,
    playerId,
    date: data,
    matchTime: obs.matchTime,
    match: obs.match,
    location: obs.location,
    scout,
    ratings,
    notes: notatki,
    statsFilledIn: true,
    obsType: obs.obsType,
  } as Observation);
}

// JEDEN ZAWODNIK ZE SKŁADU → DO SYSTEMU: raport, obserwacja i status na profilu.
//
// Wołane DWA RAZY, celowo. Raz NA ŻYWO, przy każdej zmianie w panelu oceny — żeby praca z trybuny
// szła do SBS od razu, a nie czekała na gwizdek: mecz bywa przerwany, telefon potrafi paść, a
// pół godziny wpisywania nie może wisieć na jednym dotknięciu na końcu. Drugi raz przy zapisie
// po meczu, już z kontekstem spotkania (pogoda, poziom, charakterystyka), którego w trakcie
// jeszcze nie ma.
//
// Podwójny zapis niczego nie mnoży: identyfikatory są WYLICZANE z obserwacji i zawodnika, a
// kolejka zastępuje zadania dotyczące tego samego obiektu (patrz enqueue w db.ts). Drugi zapis
// jest więc poprawką pierwszego, nie jego kopią.
function wyslijZawodnikaDoSystemu(
  obs: Observation,
  nazwaKlubu: string | undefined,
  z: SkladZawodnik,
  scout: string,
): "zapisany" | "pusty" | "nieznany" {
  const o = obs as Observation & { poziomMeczu?: number; warunki?: string[]; notatkaMeczu?: string };
  const oceny = z.ocena || {};
  const maOcene = Object.values(oceny).some((n) => Number(n) > 0);
  // Protokół 1–6 wystawiony na żywo. Puste rubryki pomijamy, a nie zerujemy: „nieocenione"
  // i „ocenione na zero" to w raporcie dwie różne informacje.
  const fazyZ: Record<string, number> = {};
  REPORT_PHASES.forEach((f) => { if (Number(z.fazy?.[f.key]) > 0) fazyZ[f.key] = Number(z.fazy![f.key]); });
  const sfgZ: Record<string, number> = {};
  REPORT_SET_PIECES.forEach((f) => { if (Number(z.sfg?.[f.key]) > 0) sfgZ[f.key] = Number(z.sfg![f.key]); });
  const maProtokol = Object.keys(fazyZ).length > 0 || Object.keys(sfgZ).length > 0;
  if (!maOcene && !maProtokol && !z.wyrozniony && !z.notatka && !z.status) return "pusty";

  const playerId = znajdzZawodnika(z.nazwa, nazwaKlubu);
  if (!playerId) return "nieznany";

  const dataRap = obs.date || todayISO();
  const typObs = (obs.obsType as string) === "online" ? "Online" : (obs.obsType as string) === "video" ? "Video" : "Live";

  // Ocena z trybun trafia też na SAM PROFIL zawodnika, nie tylko do raportu — po to,
  // żeby liczyła się do jego średniej tak samo jak ocena z obserwacji indywidualnej.
  savePlayerRatingsFromSquad(playerId, oceny, dataRap, scout, obs, z);

  // Decyzja wskazana przy nazwisku ustawia status NA PROFILU. Bez tego „do transferu"
  // wskazane na trybunie zostawałoby zdaniem w opisie raportu, a listy w SBS — Monitoring,
  // mapa rankingowa, Scout Transfer — budują się właśnie ze statusów.
  if (z.status) savePlayerStatus(playerId, z.status);

  // KONTEKST SPOTKANIA — warunki, w jakich powstała ocena. W trakcie meczu jeszcze go nie ma
  // (wpisuje się go po gwizdku) i to jest w porządku: raport dopisze go sobie przy zapisie
  // końcowym, bo ten sam identyfikator wraca do tego samego rekordu.
  const kontekstMeczu = [
    obs.match ? `Mecz: ${obs.match}.` : "",
    o.poziomMeczu ? `Poziom meczu: ${o.poziomMeczu}/10.` : "",
    (o.warunki || []).length ? `Warunki: ${(o.warunki as string[]).join(", ")}.` : "",
    o.notatkaMeczu ? `Charakterystyka meczu: ${o.notatkaMeczu}` : "",
  ].filter(Boolean).join(" ");

  // Dorobek z kafli przy nazwisku: to jedyna droga, żeby stukanie w trakcie meczu
  // zostawiło ślad w raporcie, a nie tylko na osi zdarzeń w telefonie.
  const zdarzeniaZ = zdarzeniaZawodnika(obs.id, kluczZawodnika(z));
  const opis = [
    z.wyrozniony ? "Wyróżnił się w tym meczu." : "",
    z.status ? `Decyzja: ${z.status}.` : "",
    z.notatka || "",
    // Gra głową nie ma własnego pola w raporcie, a jest oceniana osobno w ataku i w obronie.
    // Bez przepisania do opisu przepadałaby po drodze na komputer.
    OCENA_GLOWA.filter((f) => Number(oceny[f.key]) > 0)
      .map((f) => `${f.label}: ${oceny[f.key]}/10.`).join(" "),
    zdarzeniaZ ? `Zdarzenia: ${zdarzeniaZ}.` : "",
    z.noga ? `Noga: ${z.noga}.` : "",
    z.numer ? `Nr ${z.numer}.` : "",
  ].filter(Boolean).join(" ");
  const zSkladu = (k: string) => Number(oceny[k]) > 0 ? `Ocena z meczu: ${oceny[k]}/10` : "";
  saveReport({
    id: `rep:${obs.id}:${playerId}`,
    playerId,
    date: dataRap, scout,
    description: [opis, kontekstMeczu].filter(Boolean).join(" "),
    technika: zSkladu("technika"),
    taktyka: zSkladu("taktyka"),
    motoryka: zSkladu("motoryka"),
    obsType: typObs,
    match: obs.match || "",
    // Protokół z trybuny idzie do TYCH SAMYCH pól, które na komputerze wypełnia się ręcznie
    // po meczu — więc raport z telefonu otwiera się tam kompletny, a nie z pustymi rubrykami.
    phases: fazyZ, setPieces: sfgZ,
    fromObservationId: obs.id,
  });
  return "zapisany";
}

// ZAPIS ZMIANY W PANELU OCENY — od razu do systemu.
//
// Jedno miejsce dla wszystkiego, co można przy zawodniku zmienić: ocena, protokół, noga, notatka,
// decyzja, wyróżnienie. Zapisuje skład przy obserwacji (jak dotąd) I wysyła raport zawodnika,
// zamiast trzymać go w telefonie do gwizdka.
function zapiszZmianeZawodnika(dane: { obs: Observation & { skladMeczu?: Sklad }; strona?: SkladStrona; z: SkladZawodnik }): void {
  saveObservation(dane.obs);
  wyslijZawodnikaDoSystemu(dane.obs, dane.strona?.nazwa, dane.z, dane.obs.scout || getScout());
}

// ZAMKNIĘCIE EDYCJI — przed KAŻDĄ zmianą kontekstu panelu.
//
// Kropki ocen zapisują się przy dotknięciu, ale notatka żyje w polu tekstowym aż do przerysowania.
// Odkąd panel stoi pod kaflami, przełączenie na innego zawodnika następuje BEZ zamykania panelu —
// i wpisany tekst przepadał bez śladu. To jedyna rzecz z tego panelu, której nie da się odtworzyć
// z pamięci pół godziny później.
function zamknijEdycjeZawodnika(): void {
  const dane = ocenianyTeraz();
  const pole = $<HTMLTextAreaElement>("notatka-zawodnika");
  if (!dane || !pole || dane.z.notatka === pole.value) return;
  dane.z.notatka = pole.value;
  zapiszZmianeZawodnika(dane);
}

function saveOcena() {
  if (!ocena) return;
  const obs = cache.observations.find((o) => o.id === ocena!.observationId);
  if (!obs) { toast("Nie znaleziono obserwacji"); return; }

  const wystawione = RATING_KEYS.filter((k) => ocena!.ratings[k] > 0);

  // Przy JEDNEJ OBSERWACJI NA MECZ oceny indywidualne powstają przy składzie, a nie tutaj —
  // wymaganie atrybutu na poziomie obserwacji blokowałoby zapis meczu, w którym oceniono
  // trzech zmienników i poziom spotkania. Wystarczy, że cokolwiek zostało wypełnione.
  const o = cache.observations.find((x) => x.id === ocena!.observationId) as (Observation & { poziomMeczu?: number; warunki?: string[]; notatkaMeczu?: string; skladMeczu?: Sklad }) | undefined;
  const cosOceniono = (z: SkladZawodnik) => [z.ocena, z.fazy, z.sfg]
    .some((w) => w && Object.values(w).some((n) => Number(n) > 0));
  const cosZeSkladu = STRONY.some((strona) => (o?.skladMeczu?.[strona]?.zawodnicy || [])
    .some((z) => z.wyrozniony || z.notatka || z.status || cosOceniono(z)));
  const cosJest = wystawione.length || o?.poziomMeczu || (o?.warunki || []).length || o?.notatkaMeczu || cosZeSkladu;
  if (!cosJest) { toast("Nie ma czego zapisać — wystaw ocenę albo opisz mecz"); return; }

  zabezpieczOcene();
  const descEl = $<HTMLTextAreaElement>("o-desc");
  const sfgEl = $<HTMLTextAreaElement>("o-sfg");
  const description = descEl?.value.trim() || "";
  const setPieceComment = sfgEl?.value.trim() || "";
  const scout = obs.scout || getScout();

  // 1. Oceny atrybutów — na istniejącej obserwacji. Zapisujemy tylko te faktycznie wystawione,
  // żeby nie wstawiać zer, które w SBS liczą się do średnich.
  const ratings: Record<string, number> = { ...((obs.ratings as Record<string, number>) || {}) };
  wystawione.forEach((k) => (ratings[k] = ocena!.ratings[k]));
  const updated: Observation = { ...obs, ratings, statsFilledIn: true, notes: description || obs.notes };
  saveObservation(updated);

  // 2. Raport — ten sam rekord, który potem otwiera się na komputerze. Fazy i stałe fragmenty
  // wchodzą tylko wtedy, gdy scout je ocenił; pominięte zostają puste, a nie wyzerowane.
  const phases: Record<string, number> = {};
  REPORT_PHASES.forEach((f) => { if (ocena!.phases[f.key] > 0) phases[f.key] = ocena!.phases[f.key]; });
  const setPieces: Record<string, number> = {};
  REPORT_SET_PIECES.forEach((f) => { if (ocena!.setPieces[f.key] > 0) setPieces[f.key] = ocena!.setPieces[f.key]; });

  // Raport powstaje ZAWSZE przy zapisie oceny.
  //
  // Wcześniej wymagał czegoś specyficznie raportowego — fazy gry, stałych fragmentów,
  // perspektywy albo opisu. Skutek był mylący: scout wystawiał oceny zawodnika w skali 1–10,
  // zapisywał, a w zakładce Raporty widział „Brak zapisanych raportów" i nie miał jak się
  // domyślić, czego zabrakło. Warunek `cosJest` wyżej i tak nie przepuści pustego zapisu,
  // więc raport ma tu z czego powstać.
  //
  // Oceny liczbowe przepisujemy do opisowych pól raportu, żeby na komputerze było widać, co
  // faktycznie oceniono, zamiast pustych rubryk. Klucze ocen odpowiadają polom raportu jeden
  // do jednego — poza mentalnością i potencjałem, które w raporcie mają przyrostek „Opis".
  // Raport MUSI dotyczyć konkretnego zawodnika. Przy obserwacji całego meczu, bez wskazanego
  // zawodnika, raport nie miałby o kim być — na liście w SBS wyświetliłby się jako
  // „(zawodnik usunięty)", czyli gorzej niż jego brak. Praca z takiego meczu i tak nie ginie:
  // zapisuje się przy obserwacji, razem ze składem i wyróżnionymi zawodnikami.
  const zOceny = (k: string) => ocena!.ratings[k] > 0 ? `Ocena z obserwacji: ${ocena!.ratings[k]}/10` : "";
  const typObs = (obs.obsType as string) === "online" ? "Online" : (obs.obsType as string) === "video" ? "Video" : "Live";
  const dataRap = obs.date || todayISO();
  // Co powiedzieć na końcu o raportach ze składu — dopisywane do komunikatu o zapisie.
  let podsumowanieSkladu = "";

  if (obs.playerId) {
    // Obserwacja JEDNEGO zawodnika — jeden raport, jak dotąd.
    saveReport({
      // Identyfikator WYLICZANY z obserwacji, nie losowy: ponowny zapis tego samego meczu ma
      // poprawić istniejący raport, a nie dołożyć drugi o tym samym.
      id: `rep:${obs.id}`,
      playerId: obs.playerId,
      date: dataRap, scout, description,
      technika: zOceny("technika"),
      taktyka: zOceny("taktyka"),
      motoryka: zOceny("motoryka"),
      mentalnoscOpis: zOceny("mentalnosc"),
      potencjalOpis: zOceny("potencjal"),
      perspektywa: ocena.perspektywa,
      obsType: typObs,
      phases, setPieces, setPieceComment,
      fromObservationId: obs.id,
    });
  } else {
    // KONTEKST SPOTKANIA — dopisywany do raportu KAŻDEGO ocenionego zawodnika.
    //
    // Pogoda, poziom rywalizacji i charakterystyka meczu są warunkami, w jakich powstała ocena.
    // Trzymane wyłącznie przy meczu byłyby niewidoczne tam, gdzie się ich potrzebuje: przy
    // nazwisku, pół roku później, gdy nikt już nie pamięta, że tamtego dnia wiało i grało się
    // na zamarzniętym boisku.
    const kontekstMeczu = [
      obs.match ? `Mecz: ${obs.match}.` : "",
      o?.poziomMeczu ? `Poziom meczu: ${o.poziomMeczu}/10.` : "",
      (o?.warunki || []).length ? `Warunki: ${(o!.warunki as string[]).join(", ")}.` : "",
      o?.notatkaMeczu ? `Charakterystyka meczu: ${o.notatkaMeczu}` : "",
    ].filter(Boolean).join(" ");

    // Obserwacja CAŁEGO MECZU. Powstają dwie rzeczy naraz, bo to dwa różne dokumenty:
    //   1. raport meczowy — ocena samego spotkania,
    //   2. raport każdego zawodnika, którego oceniono lub wyróżniono ze składu.
    // Bez tego drugiego cała praca z trybun zostawała w składzie i nie docierała do profilu.
    //
    // Treścią raportu meczowego jest KONTEKST SPOTKANIA, a nie osobne pole „Opis": ekran po
    // gwizdku pyta teraz wyłącznie o mecz, więc opisu do wpisania po prostu nie ma. Bez tego
    // raport meczowy szedłby do SBS pusty.
    saveReport({
      id: `rep:${obs.id}:mecz`,
      date: dataRap, scout, description: description || kontekstMeczu,
      match: obs.match || "", kind: "mecz",
      perspektywa: ocena.perspektywa,
      obsType: typObs,
      phases, setPieces, setPieceComment,
      fromObservationId: obs.id,
    });

    const sklad = (o?.skladMeczu || {}) as Sklad;
    const nierozpoznani: string[] = [];
    let zapisanych = 0;
    STRONY.forEach((strona) => {
      const dane = sklad[strona];
      (dane?.zawodnicy || []).forEach((z) => {
        const wynik = wyslijZawodnikaDoSystemu(obs, dane?.nazwa, z, scout);
        if (wynik === "zapisany") zapisanych++;
        else if (wynik === "nieznany") nierozpoznani.push(z.nazwa);
      });
    });
    // ILE RAPORTÓW POWSTAŁO I KOGO POMINIĘTO — w komunikacie KOŃCOWYM, nie tutaj.
    //
    // Dotąd stało w tym miejscu własne `toast(...)`, które kasował komunikat wyświetlany chwilę
    // później na końcu zapisu. Ostrzeżenie „nie ma w bazie" nie pokazało się więc ani razu, choć
    // kod je budował: scout był przekonany, że ocenił kogoś, kto w kartotece nic nie dostał.
    podsumowanieSkladu = zapisanych ? ` · raporty: ${zapisanych}` : "";
    if (nierozpoznani.length) {
      podsumowanieSkladu += ` · nie ma w bazie: ${nierozpoznani.slice(0, 3).join(", ")}${nierozpoznani.length > 3 ? ` i ${nierozpoznani.length - 3} in.` : ""}`;
    }
  }

  // 3. Status zawodnika — tylko przy obserwacji konkretnego zawodnika i tylko gdy wybrano decyzję.
  if (ocena.status && obs.playerId) savePlayerStatus(obs.playerId, ocena.status);

  if (live && live.observationId === ocena.observationId) {
    saveLiveEvents(live.observationId, live.events);
    // Oś zdarzeń zostaje w telefonie po skasowaniu stanu meczu — inaczej cały dorobek meczu
    // znikał z ekranu w chwili zapisania ocen, choć w bazie był.
    zarchiwizujZdarzenia(live.observationId, live.events);
    live = null;
    setLive(null);
  }
  ocena = null;
  cache = getCache();
  // Zapisana obserwacja przechodzi do zakończonych — pokazujemy WŁAŚNIE tę część listy.
  // Powrót na „Nadchodzące", gdzie jej już nie ma, wyglądałby jak zniknięcie całej pracy z meczu.
  listaTryb = "zakonczone";
  view = "dzis";
  render();
  toast((navigator.onLine ? "Zapisano i wysłano do SBS" : "Zapisano — wyślę, gdy wróci zasięg") + podsumowanieSkladu);
}

// Treść formularza planowania żyje w polach DOM — przed odejściem do terminarza trzeba ją przenieść
// do stanu, inaczej wypełnione pola przepadają przy powrocie.
function zapamietajPlan() {
  planMecz = $<HTMLInputElement>("n-match")?.value ?? planMecz;
  planData = $<HTMLInputElement>("n-date")?.value ?? planData;
  planGodzina = $<HTMLInputElement>("n-time")?.value ?? planGodzina;
  planMiejsce = $<HTMLInputElement>("n-location")?.value ?? planMiejsce;
  planRozgrywki = $<HTMLInputElement>("n-liga")?.value ?? planRozgrywki;
}

// Ustawienie rozgrywek z zewnątrz (terminarz, zrzut ekranu) razem z podpowiedzią kategorii.
// Ręcznego wyboru scouta NIE ruszamy — patrz kategoriaRecznie.
function ustawRozgrywki(nazwa: string) {
  planRozgrywki = nazwa || "";
  if (!kategoriaRecznie) planKategoria = kategoriaZRozgrywek(planRozgrywki);
}

// ODŚWIEŻENIE KOPII BAZY — jedna droga dla przycisku w ustawieniach i dla przycisku w terminarzu.
//
// Wysyłka idzie PRZED pobraniem, nie równolegle: inaczej świeża kopia potrafi przyjść bez
// obserwacji, która wciąż czeka w kolejce, i plan znika scoutowi z listy (patrz start()).
let odswiezanie = false;

// CO WPISANE, ZOSTAJE WPISANE.
//
// Odświeżenie kończy się przerysowaniem ekranu, a formularze panelu żyją w polach DOM — dopóki
// ktoś nie naciśnie „Zapisz", wpisany tekst nie istnieje nigdzie indziej. Dopóki odświeżanie
// siedziało w Ustawieniach, nie było czego stracić; herb w pasku górnym jest pod ręką na KAŻDYM
// ekranie, więc trzeba to przenieść do stanu przed przerysowaniem — inaczej jedno dotknięcie
// logo kasowałoby notatkę pisaną w przerwie meczu.
function zachowajWpisane(): void {
  if (view === "nowa") zapamietajPlan();
  if (view === "ocena") zabezpieczOcene();
  if (ocenianyZawodnik !== null) zabezpieczNotatke();
}

async function odswiezKopie(): Promise<void> {
  if (odswiezanie) return;
  zachowajWpisane();
  odswiezanie = true;
  // Herb kręci się od razu, zanim ruszy sieć. Bez tego dotknięcie logo wyglądało na nieskuteczne:
  // przy dobrym zasięgu pobranie trwa ułamek sekundy i nic nie zdąży się zmienić na ekranie.
  $("app")?.querySelector(".mark-btn")?.setAttribute("aria-busy", "true");
  toast("Pobieram…");
  try {
    await wyslijKolejke();
    cache = await refreshCache();
    refreshSyncPill();
    render();
    // O kłopotach mówimy wprost. „Pobrano" przy pustym terminarzu i cichym błędzie dostępu było
    // najgorszą z możliwych odpowiedzi: wyglądało na sukces, a nie przywoziło niczego.
    const problemy = cache.problemy || [];
    toast(problemy.length ? "Pobrano częściowo — szczegóły w Ustawieniach" : "Kopia bazy odświeżona");
  } catch (e) {
    toast("Nie udało się pobrać: " + (e as Error).message);
  } finally {
    // Zdejmujemy obrót Z BIEŻĄCEGO herbu, a nie z tego sprzed pobrania: render() w środku
    // zbudował pasek górny od nowa, jeszcze przy podniesionej fladze, więc stary przycisk
    // dawno nie istnieje, a nowy kręciłby się już bez końca.
    odswiezanie = false;
    $("app")?.querySelector(".mark-btn")?.setAttribute("aria-busy", "false");
  }
}

// Czy taka obserwacja już istnieje? Porównujemy mecz i datę, po sprowadzeniu nazwy do wspólnej
// postaci — „Chojniczanka Chojnice - Znicz Pruszków" i „chojniczanka chojnice – znicz pruszków"
// to dla scouta to samo spotkanie, a różnica bierze się z myślnika wstawionego przez telefon.
function kluczSpotkania(match: string, date: string): string {
  const nazwa = match
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-ząćęłńóśźż0-9-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return nazwa + "|" + (date || "");
}

function istniejacaObserwacja(match: string, date: string): Observation | undefined {
  const klucz = kluczSpotkania(match, date);
  return cache.observations.find((o) => kluczSpotkania(o.match || "", o.date || "") === klucz);
}

// Podwójne dotknięcie przycisku zapisu tworzyło DWIE obserwacje: każde wywołanie brało świeże
// `uid("obs")`, więc nic ich ze sobą nie wiązało. Na telefonie, w rękawiczkach, przy niepewnym
// zasięgu — sytuacja codzienna, bo pierwsze dotknięcie nie daje natychmiastowej odpowiedzi.
let zapisywanieTrwa = false;

// Rozpoznanie wklejonego tekstu i wypełnienie formularza planowania.
//
// Pola wypełniamy WYŁĄCZNIE tym, co rozpoznane — pustych nie nadpisujemy zgadywanką, a tego,
// co scout wpisał wcześniej ręcznie, nie kasujemy pustym wynikiem. Na końcu mówimy wprost,
// czego nie znaleziono: milczenie kazałoby sprawdzać wszystkie cztery pola po kolei.
function wczytajZeZrzutu(): void {
  wklejTekst = $<HTMLTextAreaElement>("wklej-tekst")?.value ?? wklejTekst;
  if (!wklejTekst.trim()) { toast("Najpierw wklej tekst ze zrzutu"); return; }

  const d = czytajZeZrzutu(wklejTekst, cache.clubs.map((c) => c.name || ""));
  if (d.gospodarze && d.goscie) planMecz = `${d.gospodarze} - ${d.goscie}`;
  if (d.data) planData = d.data;
  if (d.godzina) planGodzina = d.godzina;
  if (d.miejsce) planMiejsce = d.miejsce;
  if (d.rozgrywki) ustawRozgrywki(d.rozgrywki);

  view = "nowa";
  render();

  const rozpoznane = [
    d.gospodarze && d.goscie ? "drużyny" : "",
    d.data ? dataZDniem(d.data) : "",
    d.godzina, d.miejsce ? "miejsce" : "",
    d.rozgrywki ? d.rozgrywki + (planKategoria ? " (" + ETYKIETA_KATEGORII[planKategoria].toLowerCase() + ")" : "") : "",
  ].filter(Boolean);
  if (!rozpoznane.length) { toast("Nie rozpoznałem niczego — sprawdź, czy skopiował się cały tekst"); return; }
  toast(d.braki.length
    ? `Wczytano: ${rozpoznane.join(", ")}. Uzupełnij: ${d.braki.join(", ")}`
    : `Wczytano wszystko: ${rozpoznane.join(", ")}`);
}

function saveNowa(odRazu: boolean) {
  if (zapisywanieTrwa) return;
  const match = $<HTMLInputElement>("n-match")?.value.trim() || "";
  if (!match) { toast("Podaj nazwę meczu"); return; }
  const data = $<HTMLInputElement>("n-date")?.value || todayISO();

  // JEDNA OBSERWACJA NA MECZ. Ten sam mecz zaplanowany na komputerze i jeszcze raz w telefonie
  // dawał dwa wpisy o tej samej nazwie — nie do odróżnienia na liście, z oceną rozbitą na oba.
  // Zamiast tworzyć drugi, otwieramy ten, który już jest.
  const juzJest = istniejacaObserwacja(match, data);
  if (juzJest) {
    zapamietajPlan();
    if (odRazu) { beginLive(juzJest.id); toast("Ta obserwacja już istniała — otwieram ją"); return; }
    listaTryb = juzJest.statsFilledIn ? "zakonczone" : "nadchodzace";
    view = "dzis";
    render();
    toast("Ten mecz jest już zaplanowany — nie dokładam drugiego");
    return;
  }

  zapisywanieTrwa = true;
  window.setTimeout(() => { zapisywanieTrwa = false; }, 1500);

  const scout = ($<HTMLInputElement | HTMLSelectElement>("n-scout")?.value || "").trim();
  if (scout) setScout(scout);
  const obs: Observation = {
    id: uid("obs"),
    playerId: $<HTMLSelectElement>("n-player")?.value || "",
    date: data,
    matchTime: $<HTMLInputElement>("n-time")?.value || "",
    match,
    location: $<HTMLInputElement>("n-location")?.value.trim() || "",
    scout,
    ratings: {},
    statsFilledIn: false,
    obsType: $<HTMLSelectElement>("n-typ")?.value || "live",
    rozgrywki: ($<HTMLInputElement>("n-liga")?.value || "").trim(),
    kategoria: planKategoria,
  };
  saveObservation(obs);
  cache = getCache();
  if (odRazu) { beginLive(obs.id); toast("Obserwacja utworzona"); return; }
  // Plan na później zostaje na liście — scout umawia wyjazd i wraca do niego w dniu meczu.
  // Lista musi pokazać WŁAŚNIE nadchodzące: po zapisaniu ocen zostaje włączona część „Zakończone",
  // a wrócenie do niej po zaplanowaniu wyglądałoby tak, jakby nowy plan się nie zapisał.
  listaTryb = "nadchodzace";
  view = "dzis";
  render();
  toast("Zaplanowane na " + dataZDniem(obs.date || ""));
}

// Dyktowanie notatek. Rozpoznawanie mowy w przeglądarce wysyła dźwięk na serwer producenta,
// więc BEZ ZASIĘGU nie zadziała — na stadionie bez sieci trzeba pisać ręcznie. Wynik trafia
// do wskazanego pola, żeby ta sama funkcja obsłużyła opis po meczu i notatkę przy zawodniku.
function dictate(poleId = "o-desc", przyciskId = "dictate-btn") {
  const Rozpoznawanie =
    (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  if (!Rozpoznawanie) { toast("Ta przeglądarka nie obsługuje dyktowania"); return; }
  if (!navigator.onLine) { toast("Dyktowanie wymaga sieci — wpisz ręcznie"); return; }
  const rec = new (Rozpoznawanie as new () => any)();
  rec.lang = "pl-PL";
  rec.interimResults = false;
  rec.continuous = true;
  const btn = $(przyciskId);
  const ta = $<HTMLTextAreaElement>(poleId);
  if (btn) btn.textContent = "Słucham…";
  rec.onresult = (e: any) => {
    let tekst = "";
    for (let i = e.resultIndex; i < e.results.length; i++) tekst += e.results[i][0].transcript;
    if (!ta) return;
    ta.value = (ta.value ? ta.value.trim() + " " : "") + tekst.trim();
    // Wynik od razu w danych, nie tylko na ekranie — dyktowanie kończy się często razem
    // z odłożeniem telefonu, a wtedy nikt już niczego nie kliknie.
    if (poleId === "o-desc" && ocena) ocena.description = ta.value;
    if (poleId === "notatka-zawodnika") {
      zabezpieczNotatke();
      const dane = biezacyObsSklad();
      if (dane) saveObservation(dane.obs);
    }
  };
  rec.onend = () => { if (btn) btn.textContent = "Dyktuj"; };
  rec.onerror = () => { if (btn) btn.textContent = "Dyktuj"; toast("Nie udało się nagrać"); };
  rec.start();
}

document.addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  const v = el.dataset.v;

  switch (act) {
    case "go": view = v as ViewName; render(); break;
    case "go-dzis": view = "dzis"; render(); break;
    case "lista-tryb": listaTryb = v === "zakonczone" ? "zakonczone" : "nadchodzace"; render(); break;
    case "go-nowa":
      planMecz = planData = planGodzina = planMiejsce = planRozgrywki = planKategoria = "";
      kategoriaRecznie = false;
      wklejTekst = "";
      view = "nowa";
      render();
      break;

    // Kategorię wskazaną palcem traktujemy jako ostateczną: od tej chwili rozpoznanie z nazwy
    // przestaje ją nadpisywać. Ponowne dotknięcie tej samej odznacza ją i wraca do podpowiedzi.
    case "kategoria":
      zapamietajPlan();
      if (planKategoria === v) { planKategoria = kategoriaZRozgrywek(planRozgrywki); kategoriaRecznie = false; }
      else { planKategoria = v || ""; kategoriaRecznie = true; }
      render();
      break;

    case "otworz-terminarz":
      // Zapamiętujemy, co już wpisane — powrót z terminarza nie może wyczyścić formularza.
      zapamietajPlan();
      view = "terminarz";
      render();
      break;

    case "zamknij-terminarz": view = "nowa"; render(); break;

    // WGRANIE MECZU ZE ZRZUTU EKRANU.
    case "otworz-wklej":
      zapamietajPlan();          // formularz nie może stracić tego, co już wpisane
      view = "wklej";
      render();
      break;

    case "zamknij-wklej":
      wklejTekst = $<HTMLTextAreaElement>("wklej-tekst")?.value ?? wklejTekst;
      view = "nowa";
      render();
      break;

    // Schowek czytamy TYLKO na dotknięcie przycisku: iPhone pyta wtedy o zgodę raz i wprost,
    // zamiast pozwalać stronie zaglądać do schowka po cichu.
    case "wklej-ze-schowka": {
      if (!navigator.clipboard?.readText) { toast("Ta przeglądarka nie odda schowka — wklej ręcznie niżej"); break; }
      navigator.clipboard.readText()
        .then((t) => {
          if (!t.trim()) { toast("Schowek jest pusty — skopiuj tekst ze zrzutu"); return; }
          wklejTekst = t;
          const pole = $<HTMLTextAreaElement>("wklej-tekst");
          if (pole) pole.value = t;
          wczytajZeZrzutu();
        })
        .catch(() => toast("Nie udało się odczytać schowka — wklej ręcznie w pole niżej"));
      break;
    }

    case "wczytaj-ze-zrzutu": wczytajZeZrzutu(); break;

    case "wybierz-mecz": {
      const m = cache.matches.find((x) => x.id === el.dataset.id);
      if (!m) break;
      planMecz = `${m.homeTeam} - ${m.awayTeam}`;
      planData = m.date || "";
      planGodzina = m.time || "";
      ustawRozgrywki(m.competition || m.league || "");
      // Adres stadionu bywa pusty w terminarzu — wtedy zostaje miasto, i tak lepsze niż nic.
      planMiejsce = [m.stadium, m.city].filter(Boolean).join(", ");
      view = "nowa";
      render();
      break;
    }
    // USUNIĘCIE OBSERWACJI. Kasowanie jest nieodwracalne, więc pytamy wprost i nazywamy mecz —
    // na liście kilku spotkań z tego samego weekendu sam „Czy na pewno?" niczego nie rozstrzyga.
    case "usun-obserwacje": {
      const id = el.dataset.id!;
      const o = cache.observations.find((x) => x.id === id);
      if (!o) break;
      const opis = (o.match || "obserwację") + (o.date ? " (" + o.date + ")" : "");
      const zOcenami = o.statsFilledIn || zdarzeniaObserwacji(id).length > 0;
      if (!confirm(
        "Usunąć " + opis + "?\n\n" +
        (zOcenami
          ? "Ta obserwacja ma już zapisany dorobek — oceny, notatki i oś zdarzeń znikną razem z nią, także z SBS na komputerze."
          : "Zniknie z listy i z SBS na komputerze.") +
        "\n\nTego nie da się cofnąć.",
      )) break;

      // Trwający mecz kasujemy razem z obserwacją — inaczej zegar biegłby dalej dla czegoś,
      // czego już nie ma, a zapis ocen po meczu próbowałby trafić w skasowany wiersz.
      if (live && live.observationId === id) { live = null; setLive(null); }
      if (ocena && ocena.observationId === id) ocena = null;
      if (podgladObsId === id) podgladObsId = null;

      deleteObservation(id);
      cache = getCache();
      refreshSyncPill();
      view = "dzis";
      render();
      toast("Usunięto");
      break;
    }

    case "odswiez-terminarz": void odswiezKopie(); break;

    // Przeładowanie robimy WYŁĄCZNIE na wyraźne dotknięcie, nigdy samo z siebie: w trakcie meczu
    // strona przeładowana bez pytania to sekundy, w których nie da się nic zarejestrować.
    // Stan meczu i kolejka wysyłki leżą w pamięci telefonu, więc samo przeładowanie nic nie gubi.
    //
    // Nie samo location.reload(): to pod nim wdrożone poprawki potrafiły nie dotrzeć do telefonu.
    // Patrz wymusAktualizacje().
    case "wczytaj-wersje":
    case "wymus-aktualizacje":
      void wymusAktualizacje();
      break;

    // Instrukcja dodania ikony stoi w Ustawieniach — przewijamy wprost do niej, żeby nie kazać
    // jej szukać wzrokiem po całym ekranie.
    case "pokaz-instalacje":
      view = "baza";
      render();
      window.setTimeout(() => $("instalacja")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      break;

    case "schowaj-baner":
      try { localStorage.setItem(LS_BANER_IKONA, "schowany"); } catch { /* tryb prywatny */ }
      render();
      toast("Instrukcja zostaje w Ustawieniach");
      break;

    case "start-live": beginLive(el.dataset.id!); break;
    case "open-ocena": startOcena(el.dataset.id!); view = "ocena"; render(); break;
    case "podglad": podgladObsId = el.dataset.id!; view = "podglad"; render(); break;
    case "podglad-ocen": startOcena(podgladObsId!); view = "ocena"; render(); break;
    case "save-nowa": saveNowa(el.dataset.start === "1"); break;

    case "clock-toggle":
      if (!live) break;
      if (live.running) { live.seconds = liveSeconds(live); live.running = false; live.startedAt = null; }
      else { live.running = true; live.startedAt = Date.now(); }
      setLive(live); void pilnujEkranu(); render();
      break;
    // Zegar puszczony przed pierwszym gwizdkiem — przy sprawdzaniu panelu albo przez pomyłkę —
    // przesuwał minuty WSZYSTKICH zdarzeń do końca meczu, bo minuta liczy się od jego startu.
    // Poza przejściem do kolejnej połowy nie było czego cofnąć. Zdarzenia zostają nietknięte:
    // zerujemy sam czas.
    case "clock-reset":
      if (!live) break;
      if (!window.confirm("Wyzerować zegar? Zarejestrowane zdarzenia zostają.")) break;
      live.seconds = 0; live.running = false; live.startedAt = null;
      setLive(live); render();
      toast("Zegar wyzerowany");
      break;

    case "next-period": {
      if (!live) break;
      const nast = PERIODS.find((p) => p.n === ((live!.half + 1) as Period));
      if (!nast) break;
      // Przejście do kolejnej części zeruje zegar i jest nieodwracalne, a przycisk stoi tuż obok
      // pauzy. Jedno pytanie trzy razy w meczu jest tańsze niż pomyłkowo skasowany czas gry.
      if (!window.confirm("Rozpocząć: " + nast.label + "?")) break;
      live.seconds = 0; live.half = nast.n; live.running = false; live.startedAt = null;
      setLive(live); render();
      break;
    }
    case "pol": polarity = Number(v) === -1 ? -1 : 1; render(); break;
    case "taguj-kogo":
      if (!live) break;
      // Notatka poprzedniego zawodnika zapisuje się ZANIM zmieni się wybór — patrz
      // zamknijEdycjeZawodnika. Panel nie jest tu zamykany, więc nikt inny by jej nie zebrał.
      zamknijEdycjeZawodnika();
      live.wybranyZawodnik = v || undefined;
      setLive(live);
      render();
      break;

    // Rozwinięcie i zwinięcie panelu ocen wskazanego zawodnika. Wybór zostaje na cały mecz:
    // scout pracuje seriami — albo taguje akcje kaflami, albo obchodzi wyróżnionych z ocenami.
    case "rozwin-ocene":
      zamknijEdycjeZawodnika();
      ocenaRozwinieta = !ocenaRozwinieta;
      render();
      break;
    // Przejście między zakładkami zamyka panel oceny otwarty z planszy — po powrocie do Składów
    // ma być plansza, a nie zawodnik, którego oglądało się kwadrans temu.
    case "live-tab":
      zamknijEdycjeZawodnika();
      liveTab = v === "sklady" ? "sklady" : "zdarzenia";
      ocenianyZawodnik = null;
      render();
      break;

    case "usun-zawodnika": {
      if (!live) break;
      const obs = cache.observations.find((o) => o.id === live!.observationId) as (Observation & { skladMeczu?: Sklad }) | undefined;
      const lista = obs?.skladMeczu?.[el.dataset.strona as "gospodarze" | "goscie"]?.zawodnicy;
      if (!obs || !lista) break;
      // Bez pytania: pojedynczy wiersz to drobiazg, a przy trzydziestu śmieciach do skasowania
      // potwierdzanie każdego z osobna byłoby gorsze niż sam problem.
      lista.splice(Number(el.dataset.i), 1);
      saveObservation(obs);
      render();
      break;
    }

    case "wyczysc-sklad": {
      if (!live) break;
      const obs = cache.observations.find((o) => o.id === live!.observationId) as (Observation & { skladMeczu?: Sklad }) | undefined;
      const strona = el.dataset.strona as "gospodarze" | "goscie";
      const ile = obs?.skladMeczu?.[strona]?.zawodnicy.length || 0;
      if (!obs || !ile) break;
      // Tu pytamy — to kasuje razem z wyróżnieniami, ocenami i ustawieniem na planszy.
      if (!window.confirm(`Usunąć cały skład (${ile})? Zniknie razem z wyróżnieniami i ocenami.`)) break;
      delete obs.skladMeczu![strona];
      saveObservation(obs);
      ocenianyZawodnik = null;
      obsadzanaPozycja = null;
      render();
      toast("Skład usunięty");
      break;
    }

    case "otworz-kadre": wyborZKadry = el.dataset.strona as "gospodarze" | "goscie"; render(); break;
    case "zamknij-kadre": wyborZKadry = null; render(); break;

    case "z-kadry": {
      if (!live || !wyborZKadry) break;
      const obs = cache.observations.find((o) => o.id === live!.observationId) as (Observation & { skladMeczu?: Sklad }) | undefined;
      const pl = cache.players.find((x) => x.id === el.dataset.id);
      if (!obs || !pl) break;
      obs.skladMeczu = obs.skladMeczu || {};
      const [ng, ns] = druzynyZMeczu(obs.match);
      const strona = obs.skladMeczu[wyborZKadry] || { nazwa: wyborZKadry === "gospodarze" ? ng : ns, zawodnicy: [] };
      const i = strona.zawodnicy.findIndex((z) => z.playerId === pl.id);
      // Ponowne dotknięcie zdejmuje ze składu, ale tylko dopóki nic przy nim nie zapisano —
      // inaczej jedno omyłkowe dotknięcie kasowałoby ocenę wystawioną w trakcie meczu.
      if (i >= 0) {
        const z = strona.zawodnicy[i];
        const cosMa = z.wyrozniony || z.notatka || z.pozycja || (z.ocena && Object.values(z.ocena).some((n) => Number(n) > 0));
        if (cosMa) { toast("Ten zawodnik ma już ocenę — usuń go krzyżykiem na liście"); break; }
        strona.zawodnicy.splice(i, 1);
      } else {
        strona.zawodnicy.push({ nazwa: [pl.firstName, pl.lastName].filter(Boolean).join(" "), playerId: pl.id });
      }
      obs.skladMeczu[wyborZKadry] = strona;
      saveObservation(obs);
      render();
      break;
    }

    case "sklad-widok": skladWidok = v === "mapa" ? "mapa" : "lista"; ocenianyZawodnik = null; obsadzanaPozycja = null; wyborZKadry = null; render(); break;
    case "sklad-strona": skladStrona = v === "goscie" ? "goscie" : "gospodarze"; ocenianyZawodnik = null; obsadzanaPozycja = null; render(); break;

    case "wybierz-pozycje": obsadzanaPozycja = Number(el.dataset.numer); render(); break;
    case "anuluj-obsade": obsadzanaPozycja = null; render(); break;

    case "obsadz": {
      const dane = biezacyObsSklad();
      if (!dane || obsadzanaPozycja === null) break;
      // Jedna pozycja to jeden zawodnik: kto stał tu wcześniej, schodzi z planszy, a nie dubluje się.
      dane.strona.zawodnicy.forEach((z) => { if (z.pozycja === obsadzanaPozycja) delete z.pozycja; });
      dane.strona.zawodnicy[Number(el.dataset.i)].pozycja = obsadzanaPozycja;
      obsadzanaPozycja = null;
      saveObservation(dane.obs);
      render();
      break;
    }

    case "zwolnij-pozycje": {
      const dane = biezacyObsSklad();
      if (!dane || obsadzanaPozycja === null) break;
      dane.strona.zawodnicy.forEach((z) => { if (z.pozycja === obsadzanaPozycja) delete z.pozycja; });
      obsadzanaPozycja = null;
      saveObservation(dane.obs);
      render();
      break;
    }

    case "otworz-zawodnika": ocenianyZawodnik = Number(el.dataset.i); render(); break;

    // ZMIANA W SKŁADZIE. Po zmianie zawodnika na planszy stał ten z pierwszego składu i nie było
    // jak ocenić tego, który wszedł. Wstawienie kogoś na zajętą pozycję zdejmuje z niej poprzednika,
    // ale jego oceny i notatki ZOSTAJĄ przy nim — zszedł z boiska, nie z obserwacji.
    case "zmien-na-pozycji":
      obsadzanaPozycja = Number(el.dataset.numer);
      ocenianyZawodnik = null;
      render();
      break;

    case "zamknij-zawodnika": {
      // Notatka żyje w polu tekstowym, więc zapis MUSI pójść przy zamykaniu panelu — kropki ocen
      // zapisują się same przy dotknięciu, ale wpisany tekst dopiero tutaj.
      zabezpieczNotatke();
      const dane = ocenianyTeraz();
      if (dane) zapiszZmianeZawodnika(dane);
      ocenianyZawodnik = null;
      render();
      break;
    }

    case "wyroznij-otwartego": {
      zabezpieczNotatke();
      const dane = ocenianyTeraz();
      if (!dane) break;
      dane.z.wyrozniony = !dane.z.wyrozniony;
      // Zdjęcie wyróżnienia zabiera zawodnika z paska „Tagujesz", więc panel pod kaflami nie ma
      // się już przy kim trzymać. Bez tego wybór wskazywałby kogoś, kogo na pasku nie ma.
      if (!dane.z.wyrozniony && live?.wybranyZawodnik === kluczZawodnika(dane.z)) {
        live.wybranyZawodnik = undefined;
        setLive(live);
      }
      zapiszZmianeZawodnika(dane);
      if (navigator.vibrate) navigator.vibrate(10);
      render();
      break;
    }

    case "dyktuj-notatke": dictate("notatka-zawodnika", "dyktuj-btn"); break;

    case "noga": {
      zabezpieczNotatke();
      const dane = ocenianyTeraz();
      if (!dane) break;
      dane.z.noga = dane.z.noga === v ? undefined : v;
      zapiszZmianeZawodnika(dane);
      render();
      break;
    }

    // Decyzja o zawodniku wskazana wprost przy nazwisku. Ponowne dotknięcie ją zdejmuje:
    // „nie wskazano decyzji" to inna informacja niż „wskazano do obserwacji".
    case "status-zawodnika": {
      zabezpieczNotatke();
      const dane = ocenianyTeraz();
      if (!dane) break;
      dane.z.status = dane.z.status === v ? undefined : v;
      zapiszZmianeZawodnika(dane);
      if (navigator.vibrate) navigator.vibrate(10);
      render();
      break;
    }

    case "wyroznij": {
      if (!live) break;
      const obs = cache.observations.find((o) => o.id === live!.observationId) as (Observation & { skladMeczu?: Sklad }) | undefined;
      const strona = obs?.skladMeczu?.[el.dataset.strona as "gospodarze" | "goscie"];
      const z = strona?.zawodnicy[Number(el.dataset.i)];
      if (!obs || !z) break;
      z.wyrozniony = !z.wyrozniony;
      // Zapis idzie od razu, a nie dopiero po meczu: telefon potrafi ubić kartę w tle, a wyróżnienia
      // to jedyna rzecz na tym ekranie, której nie da się odtworzyć z pamięci po powrocie.
      // Razem z wyróżnieniem idzie do SBS raport tego zawodnika — samo „★" już jest informacją.
      zapiszZmianeZawodnika({ obs, strona, z });
      if (navigator.vibrate) navigator.vibrate(10);
      render();
      break;
    }

    case "wczytaj-sklady": {
      if (!live) break;
      const obs = cache.observations.find((o) => o.id === live!.observationId) as (Observation & { skladMeczu?: Sklad }) | undefined;
      if (!obs) break;
      const gospodarze = parsujSklad($<HTMLTextAreaElement>("sklad-gospodarze")?.value || "");
      const goscie = parsujSklad($<HTMLTextAreaElement>("sklad-goscie")?.value || "");
      if (!gospodarze.length && !goscie.length) { toast("Nie rozpoznałem żadnego zawodnika"); break; }
      const [ng, ns] = druzynyZMeczu(obs.match);
      // Dopisujemy do tego, co ewentualnie przyszło z komputera, zamiast nadpisywać całość:
      // skaut mógł wcześniej wpisać jedną drużynę i teraz uzupełniać drugą.
      obs.skladMeczu = {
        gospodarze: gospodarze.length ? { nazwa: ng, zawodnicy: gospodarze } : obs.skladMeczu?.gospodarze,
        goscie: goscie.length ? { nazwa: ns, zawodnicy: goscie } : obs.skladMeczu?.goscie,
      };
      saveObservation(obs);
      render();
      toast(`Wczytano ${gospodarze.length + goscie.length} zawodników`);
      break;
    }
    case "tag": addEvent(el.dataset.k!); break;
    case "undo":
      if (!live || !live.events.length) { toast("Nie ma czego cofnąć"); break; }
      toast("Cofnięto: " + live.events.pop()!.label);
      setLive(live); render();
      break;
    // „Cofnij" zdejmuje ostatnie zdarzenie, ale pomyłka sprzed dziesięciu minut zostawała na osi
    // na zawsze — a przy tagowaniu kilku zawodników łatwo przypisać akcję nie temu, komu trzeba.
    case "usun-zdarzenie": {
      if (!live) break;
      const i = live.events.findIndex((e) => e.id === el.dataset.id);
      if (i < 0) break;
      const usuniete = live.events.splice(i, 1)[0];
      setLive(live);
      render();
      toast("Usunięto: " + usuniete.minute + "' " + usuniete.label);
      break;
    }

    case "finish": finishLive(); break;

    case "rate": {
      if (el.dataset.host === "mecz") {
        const obs = cache.observations.find((x) => x.id === ocena?.observationId) as (Observation & { poziomMeczu?: number }) | undefined;
        if (!obs) break;
        const wartosc = Number(v);
        obs.poziomMeczu = obs.poziomMeczu === wartosc ? undefined : wartosc;
        zabezpieczOcene();
        saveObservation(obs);
        render();
        break;
      }
      // Trzy skale w panelu zawodnika trzymają się w trzech osobnych workach: „mapa" to atrybuty
      // 1–10, „fazy" i „sfg" to protokół 1–6. Rozdzielone, bo w raporcie idą do innych pól i mają
      // inne skale — wspólny worek wymagałby zgadywania po nazwie klucza.
      const workiZawodnika: Record<string, "ocena" | "fazy" | "sfg"> = { mapa: "ocena", fazy: "fazy", sfg: "sfg" };
      const worek = workiZawodnika[el.dataset.host || ""];
      if (worek) {
        zabezpieczNotatke();
        const dane = ocenianyTeraz();
        if (!dane) break;
        const z = dane.z;
        z[worek] = z[worek] || {};
        const klucz = el.dataset.k!;
        const wartosc = Number(v);
        z[worek]![klucz] = z[worek]![klucz] === wartosc ? 0 : wartosc;
        zapiszZmianeZawodnika(dane);
        render();
        break;
      }
      if (!ocena) break;
      const host = el.dataset.host as "ratings" | "phases" | "setPieces";
      const key = el.dataset.k!;
      const val = Number(v);
      // Ponowne dotknięcie tej samej wartości ją zdejmuje — bez tego omyłkowego kliknięcia
      // nie dałoby się wycofać, a pusta ocena to inna informacja niż ocena „1".
      ocena[host][key] = ocena[host][key] === val ? 0 : val;
      // Zapisujemy treść pól tekstowych przed przerysowaniem, inaczej przepadnie.
      ocena.description = $<HTMLTextAreaElement>("o-desc")?.value ?? ocena.description;
      ocena.setPieceComment = $<HTMLTextAreaElement>("o-sfg")?.value ?? ocena.setPieceComment;
      render();
      break;
    }
    case "warunki": {
      const obs = cache.observations.find((x) => x.id === ocena?.observationId) as (Observation & { warunki?: string[] }) | undefined;
      if (!obs) break;
      const lista = obs.warunki || [];
      // Wielokrotny wybór: deszcz z silnym wiatrem to inny mecz niż sam deszcz.
      obs.warunki = lista.includes(v!) ? lista.filter((x) => x !== v) : [...lista, v!];
      zabezpieczOcene();
      saveObservation(obs);
      render();
      break;
    }

    case "persp":
      if (!ocena) break;
      ocena.perspektywa = ocena.perspektywa === v ? "" : v!;
      zabezpieczOcene();
      render();
      break;
    case "status":
      if (!ocena) break;
      ocena.status = ocena.status === v ? "" : v!;
      zabezpieczOcene();
      render();
      break;
    case "theme": toggleTheme(); break;

    // Wybór efektów ruchu. „Jak w telefonie" kasujemy z pamięci, zamiast zapisywać — inaczej
    // późniejsza zmiana ustawienia systemowego nie miałaby jak dojść do panelu.
    case "ruch": {
      if (v === "system") localStorage.removeItem(RUCH_KEY);
      else localStorage.setItem(RUCH_KEY, v === "pelne" ? "pelne" : "oszczedne");
      zastosujRuch();
      render();
      // Herb w pasku górnym stoi na każdym ekranie, ale ruch widać dopiero przy logowaniu
      // i przy starcie — bez tego zdania wybór wyglądałby na nieskuteczny.
      toast(document.documentElement.dataset.ruch === "pelne"
        ? "Efekty włączone — zobaczysz je przy starcie i na ekranie logowania"
        : "Efekty wyłączone");
      break;
    }
    case "dictate": dictate(); break;
    case "save-ocena": saveOcena(); break;

    case "refresh":
      void odswiezKopie();
      break;
    case "sprawdz-wersje":
      toast("Pytam serwer…");
      void sprawdzWersje(false);
      break;

    case "ponow-zablokowane": {
      const ile = ponowZablokowane();
      refreshSyncPill();
      render();
      toast(ile ? `Wracam z ${ile} zapisami do kolejki` : "Nie ma czego ponawiać");
      // Wynik ponowienia widać dopiero po przejściu kolejki — odświeżamy ekran chwilę później,
      // inaczej lista odrzuconych wyglądałaby na pustą także wtedy, gdy baza odmówi po raz drugi.
      window.setTimeout(() => { refreshSyncPill(); render(); }, 2500);
      break;
    }
    case "flush":
      wyslijKolejke().then((left) => { render(); toast(left ? "Zostało " + left : "Wszystko wysłane"); });
      break;
    // WYLOGOWANIE PYTA, ODKĄD STOI NA LIŚCIE OBSERWACJI.
    //
    // W Ustawieniach trafiało się tu z rozmysłem. Na ekranie, po którym przewija się w trakcie
    // meczu, dotknięcie bywa przypadkowe — a skutek jest niebłahy: razem z sesją z telefonu
    // znika kopia bazy (kadry klubów, plany) i stan trwającego meczu. Mówimy więc wprost, co
    // przepadnie, i osobno uspokajamy co do rzeczy, która NIE przepada: kolejki wysyłki.
    case "logout": {
      const wKolejce = queueLength();
      const skutki = [
        "Kopia bazy zniknie z telefonu — kadry klubów i plany trzeba będzie pobrać na nowo, przy zasięgu.",
        live ? "TRWA MECZ „" + (live.matchLabel || "") + "\" — zegar i niezapisane zdarzenia przepadną." : "",
        wKolejce ? "Praca czekająca na wysyłkę (" + wKolejce + ") NIE przepada — zostaje w telefonie i pojedzie po ponownym zalogowaniu." : "",
      ].filter(Boolean).join("\n\n");
      if (!confirm("Wylogować się z " + (kontoEmail || "tego konta") + "?\n\n" + skutki)) break;
      // Kopię bazy zabieramy z telefonu razem z sesją — patrz wyczyscKopieBazy() w db.ts.
      signOut().then(() => { wyczyscKopieBazy(); location.reload(); });
      break;
    }
    case "go-login": renderLogin(); break;

    case "kopiuj-adres": {
      const pole = $<HTMLInputElement>("adres-panelu");
      if (!pole) break;
      // Zaznaczenie tekstu robimy zawsze, nie tylko przy niepowodzeniu: gdy schowek jest
      // niedostępny (starsze Safari, brak zgody), adres zostaje przynajmniej gotowy do
      // przytrzymania i skopiowania palcem.
      pole.select();
      pole.setSelectionRange(0, pole.value.length);
      navigator.clipboard?.writeText(pole.value)
        .then(() => toast("Adres skopiowany — wklej go w Safari"))
        .catch(() => toast("Przytrzymaj adres i wybierz Kopiuj"));
      break;
    }
  }
});

// WYJŚCIE Z POLA NOTATKI = koniec pisania. Zapisujemy wtedy i skład, i raport zawodnika.
//
// Dotąd szedł tu sam skład, więc notatka docierała do SBS dopiero po gwizdku. Co gorsza,
// zabezpieczNotatke() przepisuje ją NAJPIERW do zawodnika w pamięci — więc każde późniejsze
// „czy coś się zmieniło?" wypadało negatywnie i raport nie miał już powodu, żeby ruszyć.
// Stąd zapis musi nastąpić dokładnie tutaj, w jedynym miejscu, które wie, że pisanie się skończyło.
//
// Nasłuch jest na etapie przechwytywania (trzeci argument), bo blur się nie propaguje — a dotknięcie
// nazwiska w pasku „Tagujesz" wywołuje blur ZANIM zadziała obsługa dotknięcia.
document.addEventListener("blur", (e) => {
  if ((e.target as HTMLElement)?.id !== "notatka-zawodnika") return;
  zabezpieczNotatke();
  // ocenianyTeraz, a nie biezacyObsSklad: panel oceny stoi teraz także na ekranie zdarzeń,
  // gdzie zawodnika wskazuje pasek wyróżnionych, a nie indeks na planszy.
  const dane = ocenianyTeraz();
  if (dane) zapiszZmianeZawodnika(dane);
}, true);

document.addEventListener("change", (e) => {
  const wyborLigi = e.target as HTMLSelectElement;
  if (wyborLigi.id === "t-liga") { terminarzLiga = wyborLigi.value; render(); return; }

  const pole = e.target as HTMLInputElement;

  // Dzień tygodnia pod polem daty. Podpis podmieniamy WPROST, bez przerysowania widoku —
  // pełny render zabrałby zawartość pozostałych pól formularza planowania.
  if (pole.id === "n-date") {
    const podpis = $("n-dzien");
    if (podpis) podpis.textContent = dataZDniem(pole.value);
    return;
  }

  if (pole.dataset.numerStrona) {
    // Numeru nie zgadnie żaden parser we wszystkich układach — bywa w osobnej komórce, bywa
    // przy ikonie gola albo kartki, bywa go po prostu brak. Dlatego da się go dopisać ręcznie,
    // zamiast kasować zawodnika i wklejać skład od nowa.
    if (!live) return;
    const obs = cache.observations.find((o) => o.id === live!.observationId) as (Observation & { skladMeczu?: Sklad }) | undefined;
    const z = obs?.skladMeczu?.[pole.dataset.numerStrona as "gospodarze" | "goscie"]?.zawodnicy[Number(pole.dataset.numerI)];
    if (!obs || !z) return;
    const nowy = pole.value.replace(/\D/g, "").slice(0, 2);
    if (nowy) z.numer = nowy; else delete z.numer;
    saveObservation(obs);
    render();
    return;
  }

  // System gry wskazany W PODGLĄDZIE, już po meczu. Ta sama zmiana co przy planszy, tylko
  // dosięgalna wtedy, gdy jest na nią czas.
  const wybor = e.target as HTMLSelectElement;
  if (wybor.dataset.act === "podglad-formacja") {
    const obs = cache.observations.find((x) => x.id === podgladObsId) as (Observation & { skladMeczu?: Sklad }) | undefined;
    const strona = wybor.dataset.strona as "gospodarze" | "goscie";
    const dane = obs?.skladMeczu?.[strona];
    if (!obs || !dane) return;
    dane.formacja = wybor.value;
    saveObservation(obs);
    cache = getCache();
    render();
    toast(wybor.value
      ? `${dane.nazwa || strona}: ${wybor.value} — wyróżnieni trafią na mapę tego systemu`
      : "System gry wyczyszczony");
    return;
  }

  const el = e.target as HTMLSelectElement;
  if (el.id !== "wybor-formacji") return;
  const dane = biezacyObsSklad();
  if (!dane) return;
  // System gry zapamiętujemy przy drużynie w tej obserwacji. Zmiana układu NIE zdejmuje nikogo
  // z planszy: te same jedenaście numerów obowiązuje w każdym systemie, zmienia się tylko ich
  // rozmieszczenie — dokładnie tak, jak działa plansza na komputerze.
  dane.strona.formacja = el.value;
  saveObservation(dane.obs);
  render();
});

document.addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement;

  // Kategoria dopowiada się przy wpisywaniu rozgrywek. Przełącznik przestawiamy WPROST, bez
  // przerysowania widoku: pełny render w trakcie pisania zabrałby kursor z pola.
  if (t.id === "n-liga") {
    planRozgrywki = t.value;
    if (kategoriaRecznie) return;
    planKategoria = kategoriaZRozgrywek(planRozgrywki);
    $("n-kategoria")?.querySelectorAll<HTMLElement>("[data-act='kategoria']").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.v === planKategoria));
    });
    return;
  }

  if (t.id === "t-szukaj") {
    terminarzSzukaj = t.value;
    const main = $("main");
    if (main) {
      const pos = t.selectionStart;
      main.innerHTML = viewTerminarz();
      const nowe = $<HTMLInputElement>("t-szukaj");
      if (nowe) { nowe.focus(); nowe.setSelectionRange(pos ?? 0, pos ?? 0); }
    }
    return;
  }
  if (t.id === "search") {
    searchQuery = t.value;
    // Przerysowujemy tylko listę wyników, żeby pole nie traciło ogniska przy każdej literze.
    const main = $("main");
    if (main) {
      const pos = t.selectionStart;
      main.innerHTML = viewBaza();
      const nowy = $<HTMLInputElement>("search");
      if (nowy) { nowy.focus(); nowy.setSelectionRange(pos ?? 0, pos ?? 0); }
    }
  }
});

// ---------------------------------------------------------------------------
// Ekran logowania
// ---------------------------------------------------------------------------

function renderLogin(info?: string) {
  const app = $("app")!;
  app.innerHTML = `
    <div class="login">
      <div class="login-brand">
        <div class="login-stage">
          <div class="login-halo" aria-hidden="true"></div>
          <div class="login-logo">
            <div class="login-badge">
              <div class="login-face">
                <img src="${LOGO}" alt="Scout Base System" width="104" height="104">
                <span class="login-sheen" aria-hidden="true"></span>
              </div>
            </div>
          </div>
          <div class="login-orbit" aria-hidden="true"></div>
          <div class="login-orbit login-orbit--druga" aria-hidden="true"></div>
        </div>
        <h1>SBS Scout Live</h1>
        <p class="hint">Zaloguj się tym samym kontem, co w Scout Base System.</p>
      </div>
      <div id="login-error"></div>
      ${info ? `<div class="error" style="background:rgba(78,154,99,.14); border-color:var(--good); color:#8FD3A2;">${esc(info)}</div>` : ""}
      <div class="field"><input id="l-email" type="email" inputmode="email" autocomplete="username" placeholder="E-mail"></div>
      <div class="field"><input id="l-pass" type="password" autocomplete="current-password" placeholder="Hasło"></div>
      <button class="btn" id="l-submit">Zaloguj się</button>
      <button class="link" id="l-reset">Nie pamiętam hasła</button>
      <p class="hint" style="text-align:center;margin-top:14px;">
        Nie masz konta? Zgłoś się na <a href="/" style="color:var(--gold);">scoutbasesystem.com</a> —
        dostęp otwiera administrator systemu.
      </p>
    </div>`;

  const err = (msg: string) => { $("login-error")!.innerHTML = msg ? `<div class="error">${esc(msg)}</div>` : ""; };

  $("l-submit")!.addEventListener("click", async () => {
    const email = $<HTMLInputElement>("l-email")!.value;
    const pass = $<HTMLInputElement>("l-pass")!.value;
    if (!email || !pass) { err("Podaj e-mail i hasło."); return; }
    const btn = $<HTMLButtonElement>("l-submit")!;
    btn.disabled = true; btn.textContent = "Loguję…";
    const r = await signIn(email, pass);
    btn.disabled = false; btn.textContent = "Zaloguj się";
    // Po zalogowaniu wracamy do boot(), a nie wprost do panelu: dostęp otwiera dopiero zgoda
    // administratora i to boot() ją sprawdza.
    if (r.ok) void boot();
    else err(r.error || "Nie udało się zalogować.");
  });

  $("l-reset")!.addEventListener("click", async () => {
    const email = $<HTMLInputElement>("l-email")!.value;
    if (!email) { err("Wpisz najpierw swój e-mail."); return; }
    await requestPasswordReset(email);
    renderLogin("Jeśli konto istnieje, wysłaliśmy link do zmiany hasła.");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && $("l-submit")) ($("l-submit") as HTMLButtonElement).click();
  }, { once: true });
}

// ---------------------------------------------------------------------------
// Ekran nie gaśnie w trakcie meczu
// ---------------------------------------------------------------------------
//
// Telefon usypia po minucie, więc przez dziewięćdziesiąt minut scout odblokowuje go przy każdej
// akcji — a akcja nie czeka. Blokadę trzymamy WYŁĄCZNIE gdy zegar meczu biegnie: poza tym byłaby
// zwykłym zjadaczem baterii, której na stadionie i tak brakuje.
//
// System zdejmuje blokadę sam, gdy karta idzie w tło, dlatego po powrocie trzeba ją odtworzyć.
let blokadaEkranu: { release: () => Promise<void> } | null = null;

async function pilnujEkranu() {
  const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<any> } };
  const powinna = !!(live && live.running);

  if (powinna && !blokadaEkranu && nav.wakeLock) {
    try {
      blokadaEkranu = await nav.wakeLock.request("screen");
      // Zwolniona przez system (wygaszenie, przejście w tło) — pamiętamy o tym, żeby przy
      // powrocie poprosić o nią jeszcze raz zamiast myśleć, że wciąż działa.
      (blokadaEkranu as any).addEventListener?.("release", () => { blokadaEkranu = null; });
    } catch {
      /* odmowa systemu albo brak obsługi — mecz idzie dalej, tylko ekran będzie gasł */
    }
    return;
  }

  if (!powinna && blokadaEkranu) {
    try { await blokadaEkranu.release(); } catch { /* już zwolniona */ }
    blokadaEkranu = null;
  }
}

// ---------------------------------------------------------------------------
// Ekran powitalny
// ---------------------------------------------------------------------------
//
// Herb wchodzi obrotem w trzech wymiarach, obiega go złota obręcz. Trwa to sekundę i nie
// wstrzymuje niczego: logowanie i pobieranie danych idą pod spodem, a ekran znika sam.
// Dotknięcie kończy go od razu — scout, który wraca do trwającego meczu, nie ma na co czekać.

function splash() {
  // Dwa ekrany powitalne naraz nie mają jak powstać przy zwykłym starcie, ale przy powrocie
  // do karty zdarzenia potrafią przyjść parami — a drugi herb nad pierwszym wygląda jak usterka.
  if (document.querySelector(".splash")) return;
  const el = document.createElement("div");
  el.className = "splash";
  el.innerHTML = `
    <div class="splash-stage">
      <div class="splash-orbit"></div>
      <div class="splash-logo"><img src="${LOGO}" alt="Scout Base System"></div>
    </div>
    <div class="splash-word">SBS Scout <span>Live</span></div>`;
  document.body.appendChild(el);

  let zamkniete = false;
  const zamknij = () => {
    if (zamkniete) return;
    zamkniete = true;
    el.classList.add("done");
    // Element usuwamy dopiero po wygaszeniu, żeby nie uciął się w połowie przejścia.
    window.setTimeout(() => el.remove(), 450);
  };
  el.addEventListener("click", zamknij);
  window.setTimeout(zamknij, 1600);
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

// PONAWIANIE WYSYŁKI SAMO Z SIEBIE.
//
// Kolejka próbowała ruszyć wyłącznie przy zdarzeniach: starcie panelu, powrocie do aplikacji,
// odzyskaniu sieci. Gdy baza akurat spała (usypia się po okresie bezczynności i budzi kilkanaście
// sekund), pierwsza próba trafiała w próżnię — i kolejka stała do następnego POWROTU do panelu.
// Scout, który zamknął telefon i pojechał do domu, miał tam pracę z całego dnia, o niczym nie
// wiedząc.
//
// Odstępy rosną: 15 s, minuta, pięć minut, kwadrans. Krótki pierwszy odstęp załatwia uśpioną bazę,
// długie kolejne nie zjadają baterii przy awarii, która potrwa. Licznik zeruje się, gdy kolejka
// przejdzie do końca.
const KROKI_PONOWIENIA = [15_000, 60_000, 300_000, 900_000];
let ponowienieWysylki: number | undefined;
let krokPonowienia = 0;

function wyslijKolejke(): Promise<number> {
  return flushQueue()
    .catch(() => queueLength())
    .then((zostalo) => {
      refreshSyncPill();
      window.clearTimeout(ponowienieWysylki);
      if (!zostalo) { krokPonowienia = 0; return 0; }
      const za = KROKI_PONOWIENIA[Math.min(krokPonowienia, KROKI_PONOWIENIA.length - 1)];
      krokPonowienia++;
      ponowienieWysylki = window.setTimeout(() => { void wyslijKolejke(); }, za);
      return zostalo;
    });
}

// ODSTAWIONE ZAPISY CZEKAJĄ NA POPRAWKĘ — NIECH SIĘ SAME ZGŁOSZĄ, GDY PRZYJDZIE.
//
// Baza odrzuca zapis trwale prawie zawsze z jednego powodu: aplikacja wysyła coś, czego ta baza
// nie przyjmuje. Naprawa idzie wtedy w kodzie i przychodzi z nową wersją panelu. Dotąd trzeba było
// jednak samemu wejść w Ustawienia, znaleźć czerwoną kartę i dotknąć „spróbuj jeszcze raz" — czyli
// wiedzieć, że poprawka doszła i że w ogóle jest gdzie kliknąć. Praktyka pokazała, jak to wygląda:
// dziesięć raportów z meczu leżało odstawionych przez pół dnia, mimo trzech wdrożonych poprawek.
//
// Zapamiętujemy więc wersję, przy której coś odstawiono. Gdy panel startuje na innej — czyli gdy
// coś się w międzyczasie zmieniło — próbujemy jeszcze raz sami. Ponowienie i tak przebudowuje
// wiersze bieżącymi regułami, więc nic nie kosztuje, a jedna odmowa więcej wraca po prostu na
// czerwoną kartę.
const WERSJA_ODSTAWIENIA = "sbs-m:wersja-odstawienia";

function ponowPoAktualizacji(): void {
  if (!liczbaZablokowanych()) return;
  let zapisana = "";
  try { zapisana = localStorage.getItem(WERSJA_ODSTAWIENIA) || ""; } catch { /* tryb prywatny */ }
  try { localStorage.setItem(WERSJA_ODSTAWIENIA, WERSJA_PANELU); } catch { /* j.w. */ }
  if (zapisana === WERSJA_PANELU) return;   // ta sama wersja — nic się nie zmieniło, nie ma po co
  const ile = ponowZablokowane();
  if (ile) toast(`Nowa wersja panelu — próbuję wysłać ${ile} odrzuconych zapisów`);
}

async function start(pobranaKopia?: Cache) {
  cache = pobranaKopia || getCache();
  live = getLive();
  if (live) view = "live";
  render();

  // NAJPIERW WYSYŁKA, DOPIERO POTEM POBRANIE.
  //
  // Obie rzeczy puszczone równolegle ścigały się ze sobą: pobranie zdążało odpytać serwer, zanim
  // dojechała tam obserwacja z kolejki, więc świeża kopia jej nie zawierała i plan znikał z listy.
  // Scout planował go wtedy po raz drugi — i tak w bazie lądowały dwie obserwacje tego samego meczu.
  ponowPoAktualizacji();
  await wyslijKolejke();
  if (pobranaKopia) return; // kopia przyszła już przy sprawdzaniu dostępu — nie pobieramy drugi raz

  // Kopię bazy pobieramy w tle. Panel jest użyteczny natychmiast — z tym, co zostało w telefonie
  // z poprzedniego razu — a świeże dane dochodzą, gdy dojdą.
  try {
    cache = await refreshCache();
    render();
  } catch (e) {
    console.warn("Nie udało się odświeżyć kopii bazy:", (e as Error).message);
    if (!cache.players.length) toast("Brak połączenia i pustej kopii bazy — spróbuj przy zasięgu");
  }
}

// ---------------------------------------------------------------------------
// Ekran „konto czeka na akceptację"
// ---------------------------------------------------------------------------

function renderCzekaNaZgode(konto: Konto) {
  const odrzucone = konto.status === "odrzucone";
  const app = $("app")!;
  app.innerHTML = `
    <div class="login">
      <div class="login-brand">
        <div class="login-stage">
          <div class="login-halo" aria-hidden="true"></div>
          <div class="login-logo">
            <div class="login-badge">
              <div class="login-face">
                <img src="${LOGO}" alt="Scout Base System" width="104" height="104">
                <span class="login-sheen" aria-hidden="true"></span>
              </div>
            </div>
          </div>
          <div class="login-orbit" aria-hidden="true"></div>
          <div class="login-orbit login-orbit--druga" aria-hidden="true"></div>
        </div>
        <h1>${odrzucone ? "Brak dostępu" : "Konto czeka na akceptację"}</h1>
        <p class="hint">${odrzucone
          ? "Administrator systemu nie przyznał dostępu temu kontu."
          : "Zgłoszenie dotarło. Panel otworzy się, gdy administrator systemu przyzna dostęp."}</p>
      </div>
      <p class="hint" style="text-align:center;">Zalogowano jako ${esc(konto.email)}</p>
      <button class="btn" id="z-sprawdz">Sprawdź ponownie</button>
      <button class="link" id="z-wyloguj">Wyloguj się</button>
    </div>`;

  $("z-sprawdz")!.addEventListener("click", async () => {
    const b = $<HTMLButtonElement>("z-sprawdz")!;
    b.disabled = true; b.textContent = "Sprawdzam…";
    const swieze = await mojeKonto();
    if (swieze && swieze.status === "zatwierdzone") { start(); return; }
    renderCzekaNaZgode(swieze || konto);
  });
  $("z-wyloguj")!.addEventListener("click", () => {
    signOut().then(() => { wyczyscKopieBazy(); location.reload(); });
  });
}

// KIEDY PANEL PYTA O HASŁO: ZAWSZE.
//
// Adres /m jest publiczny tak samo jak /app, więc zostawienie panelu otwartego znaczyłoby, że
// zamknięcie systemu na komputerze niczego nie daje — obserwacje i kadra byłyby do obejrzenia
// z telefonu. Po zalogowaniu panel działa bez żadnych dalszych ograniczeń, dokładnie jak dotąd.
//
// Zalogowanemu sprawdzamy jeszcze zgodę administratora, żeby konto oczekujące dostało wyjaśnienie
// zamiast pustych list.
//
// Praca bez zasięgu nie ucierpiała: sesję Supabase trzyma w pamięci telefonu, więc scout, który
// zalogował się przed wyjazdem, wchodzi na stadionie do swojej kopii bazy bez sieci — hasła nie
// trzeba wpisywać drugi raz.
async function boot() {
  const user = await currentUser();
  if (!user) { renderLogin(); return; }
  zalogowany = true;
  kontoEmail = user.email || "";

  // Stan konta czytamy z bazy; bez sieci pytanie się nie uda i wtedy wchodzimy do zapisanej kopii.
  // To nie jest zabezpieczenie (tym są reguły dostępu w bazie), tylko wyjaśnienie dla użytkownika.
  let konto: Konto | null = null;
  try {
    konto = await mojeKonto();
  } catch (e) {
    console.warn("Nie udało się sprawdzić stanu konta:", (e as Error).message);
  }
  if (konto && konto.status !== "zatwierdzone") { renderCzekaNaZgode(konto); return; }

  start();
}

window.addEventListener("online", () => { krokPonowienia = 0; void wyslijKolejke(); });
window.addEventListener("offline", refreshSyncPill);

// Zegar bywa zatrzymywany przez system, gdy karta idzie w tło. Po powrocie przeliczamy czas
// i odświeżamy wyświetlanie, zamiast pokazywać wartość sprzed uśpienia.
// POWRÓT DO APLIKACJI.
//
// Na telefonie karta zostaje otwarta tygodniami — moduł wykonuje się raz, więc ekran powitalny
// pokazywał się praktycznie tylko za pierwszym razem. „Otwarcie aplikacji" w odczuciu scouta to
// jednak powrót do niej po godzinach, nie przeładowanie strony; stąd wrażenie, że animacji nie ma.
//
// Powtarzamy ją więc po dłuższej nieobecności — ale NIGDY w trakcie biegnącego meczu. Wtedy
// powrót do telefonu oznacza akcję do zarejestrowania i sekunda z herbem to sekunda za dużo.
const PRZERWA_NA_POWITANIE = 20 * 60 * 1000;
let ukryteOd: number | null = null;

document.addEventListener("visibilitychange", () => {
  if (document.hidden) { ukryteOd = Date.now(); return; }

  paintClock();
  void pilnujEkranu();
  void wyslijKolejke();

  const przerwa = ukryteOd ? Date.now() - ukryteOd : 0;
  ukryteOd = null;
  if (przerwa > PRZERWA_NA_POWITANIE && !(live && live.running)) splash();
});

// Znacznik dla czujnika nieudanego startu z mobile.html. Jeśli którykolwiek z importów wyżej
// wywali się przy wczytywaniu, ta linia nigdy się nie wykona i czujnik pokaże treść błędu
// zamiast pustego ekranu.
(window as unknown as { __sbsStart?: boolean }).__sbsStart = true;

splash();
void boot();

// Rejestracja mechanizmu offline tylko w wersji wdrożonej — w trybie deweloperskim przeszkadzałby
// w podmianie plików na gorąco.
//
// WDROŻONA POPRAWKA MUSI DAĆ ZNAĆ, ŻE DOSZŁA.
//
// Panel dodany do ekranu telefonu zachowuje się jak aplikacja: karta zostaje otwarta tygodniami,
// a system usypia ją zamiast zamykać. Wgrany kod wykonuje się więc RAZ i nowa wersja potrafiła
// nie dotrzeć do telefonu przez wiele dni — poprawka była wdrożona, a na ekranie stało stare.
// Jedynym sposobem było całkowite ubicie aplikacji z przełącznika, o czym nikt nie ma prawa
// wiedzieć. Dlatego pytamy o nową wersję przy każdym powrocie do panelu, a gdy dojdzie —
// mówimy o tym paskiem, zamiast czekać, aż ktoś się domyśli.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Offline niedostępne:", e));
  });
}

// SKĄD PANEL WIE, ŻE WDROŻONO POPRAWKĘ.
//
// Pyta serwer wprost: /wersja.json zawiera godzinę budowania i zmienia się przy każdym wdrożeniu
// (patrz wersjaPlikPlugin w vite.config.ts). Różni się od tej, na której pracuje karta — znaczy,
// że doszło coś nowego.
//
// Poprzednie podejście opierało się na mechanizmie offline: „nowy service worker = nowa wersja".
// Brzmiało rozsądnie i NIE DZIAŁAŁO ANI RAZU. Plik sw.js nie zmienia się przy zwykłym wdrożeniu
// (zmieniają się skrypty aplikacji, o nazwach ze skrótem treści), więc przeglądarka nie miała
// czego instalować, zdarzenie „zmiana kontrolera" nie padało nigdy i pasek się nie pokazywał.
// Skutek dla scouta: wdrożona poprawka nie docierała do telefonu tygodniami, a jedynym ratunkiem
// było ubicie aplikacji z przełącznika — o czym nikt nie ma prawa wiedzieć.
// Co odpowiedział serwer przy ostatnim pytaniu o wersję. Pokazujemy to w Ustawieniach.
//
// Pierwsza wersja tej funkcji łykała KAŻDE niepowodzenie po cichu — i doprowadziła dokładnie do
// sytuacji, dla której powstała: panel chodził na wersji sprzed poprawki, pasek o nowszej się nie
// pokazał, a jedynym sposobem sprawdzenia, czy sprawdzanie w ogóle działa, było zgadywanie.
// Narzędzie do diagnozy, które ukrywa własną diagnozę, jest gorsze niż jego brak.
let stanWersji = "jeszcze nie pytałem";

async function sprawdzWersje(cicho = true): Promise<void> {
  if (!navigator.onLine) { stanWersji = "brak sieci"; return; }
  try {
    // Znacznik czasu w adresie dokłada się do nagłówka no-store: pośrednik po drodze (CDN, sieć
    // operatora) potrafi zignorować nagłówek, ale nie potrafi zignorować innego adresu.
    const odp = await fetch("/wersja.json?t=" + Date.now(), { cache: "no-store" });
    if (!odp.ok) { stanWersji = "serwer odpowiedział " + odp.status; return; }
    const { wersja } = (await odp.json()) as { wersja?: string };
    if (!wersja) { stanWersji = "serwer nie podał wersji"; return; }
    if (wersja === WERSJA_PANELU) { stanWersji = "masz najnowszą"; return; }
    stanWersji = "na serwerze: " + wersja;
    if (nowaWersja) return;
    nowaWersja = true;
    // Sam pasek, bez przeładowania: decyzję zostawiamy scoutowi, bo w trakcie meczu
    // przeładowanie strony to sekundy, w których nie da się nic zarejestrować.
    if (zalogowany) render();
  } catch (e) {
    stanWersji = "nie udało się zapytać: " + ((e as Error).message || "nieznany błąd");
  } finally {
    if (!cicho) { render(); }
  }
}

// WYMUSZONE POBRANIE NAJNOWSZEJ WERSJI.
//
// Samo przeładowanie strony NIE WYSTARCZA i to była prawdziwa przyczyna tego, że wdrożone
// poprawki nie docierały do telefonu. Nad panelem stoją dwie warstwy pamięci: mechanizm offline
// (public/sw.js) i zwykła pamięć przeglądarki. Po przeładowaniu potrafią obie zgodnie podać
// dokładnie to samo, co przed — a na telefonie z aplikacją dodaną do ekranu głównego widać to
// najostrzej, bo tam nie ma paska adresu ani żadnego „odśwież bez pamięci".
//
// Skutek jest najgorszy z możliwych: scout odświeża, widzi tę samą wersję i nie ma jak odróżnić
// „poprawka nie działa" od „poprawka do mnie nie dotarła". Traci czas na opisywanie błędu, który
// dawno naprawiono.
//
// Dlatego przed przeładowaniem sprzątamy jedno i drugie: kasujemy zapisane pliki aplikacji
// i wyrejestrowujemy mechanizm offline. Zarejestruje się z powrotem sam, przy najbliższym
// uruchomieniu — praca bez zasięgu wraca po pierwszym wejściu z siecią.
//
// DANE SĄ BEZPIECZNE. Obserwacje, stan trwającego meczu i kolejka wysyłki leżą w pamięci telefonu
// (localStorage), której to w ogóle nie dotyka. Kasujemy wyłącznie pliki samej aplikacji.
async function wymusAktualizacje(): Promise<void> {
  toast("Pobieram najnowszą wersję…");
  try {
    if ("caches" in window) {
      await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const rejestracje = await navigator.serviceWorker.getRegistrations();
      await Promise.all(rejestracje.map((r) => r.unregister()));
    }
  } catch (e) {
    // Nieudane sprzątanie nie może zablokować przeładowania: gorzej niż stara wersja jest tylko
    // stara wersja, której nie da się nawet spróbować odświeżyć.
    console.warn("Nie udało się wyczyścić pamięci aplikacji:", e);
  }
  // Zwykłe przeładowanie, BEZ znacznika czasu w adresie. Adres panelu jest wysyłany z nagłówkiem
  // „no-store" (patrz vercel.json), więc pamięć przeglądarki i tak go nie trzyma — a doklejony
  // parametr niósł własne ryzyko: to od niego zależałoby, czy przepisanie adresu „/m" na stronę
  // panelu w ogóle zadziała. Prawdziwą przyczyną było sprzątnięte wyżej: zapisana kopia strony
  // w mechanizmie offline.
  location.reload();
}

// MECHANIZM OFFLINE TEŻ TRZEBA POPCHNĄĆ.
//
// Sprawdzanie /wersja.json mówi tylko, ŻE na serwerze stoi coś nowszego. Nowe pliki i tak nie
// przyjdą, dopóki przeglądarka nie pobierze nowego sw.js — a robi to przy wejściu na adres panelu.
// Aplikacja dodana do ekranu głównego bywa trzymana w pamięci telefonu tygodniami: przełączenie
// się do niej NIE jest wejściem na adres, więc takiego pobrania może nie być ani razu. Panel stoi
// wtedy na wersji sprzed poprawek, mimo że urządzenie ma pełny zasięg i codziennie jest używane.
//
// Prosimy więc wprost o sprawdzenie sw.js przy każdym powrocie do aplikacji. Nowy mechanizm
// instaluje się od razu (skipWaiting w public/sw.js), a scout dostaje pasek o nowszej wersji.
function popchnijMechanizmOffline(): void {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.getRegistration()
    .then((r) => r?.update())
    .catch(() => { /* brak mechanizmu offline nie jest błędem — panel działa bez niego */ });
}

if (import.meta.env.PROD) {
  document.addEventListener("visibilitychange", () => { if (!document.hidden) popchnijMechanizmOffline(); });
  window.setInterval(popchnijMechanizmOffline, 15 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void sprawdzWersje(); });
  window.addEventListener("online", () => { void sprawdzWersje(); });
  window.setInterval(() => { void sprawdzWersje(); }, 30 * 60 * 1000);
  window.setTimeout(() => { void sprawdzWersje(); }, 4000);   // pierwsze pytanie po starcie
}
