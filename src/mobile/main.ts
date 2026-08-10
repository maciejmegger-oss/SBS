// SBS Scout Live — panel mobilny do obserwacji w trakcie meczu.
//
// Osobne wejście obok aplikacji na komputerze (index.html), ta sama baza, to samo logowanie.
// Podział pracy jest celowy: telefon REJESTRUJE (zdarzenia z minutą meczu, oceny w skalach),
// komputer REDAGUJE (opisy, PDF, analizy). Dlatego nie ma tu prób odtworzenia całego SBS —
// są cztery ekrany, które da się obsłużyć jedną ręką, stojąc.

import "./style.css";
import { currentUser, signIn, signOut, requestPasswordReset } from "../data/auth";
import {
  uid, getCache, refreshCache, patchCache, flushQueue, queueLength,
  saveObservation, saveReport, savePlayerStatus, saveLiveEvents,
  getLive, setLive, getScout, setScout, zarchiwizujZdarzenia, zdarzeniaObserwacji,
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

type ViewName = "dzis" | "live" | "ocena" | "baza" | "nowa" | "podglad";
let podgladObsId: string | null = null;

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
let searchQuery = "";
let clockTimer: number | undefined;
// Czy panel pracuje na sesji użytkownika. Bez niej też działa — dopóki baza oddaje dane
// bez logowania — więc to informacja dla widoku, a nie warunek wejścia.
let zalogowany = false;

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

function viewDzis(): string {
  const today = todayISO();
  const wczoraj = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const lista = cache.observations
    .filter((o) => (o.date || "") >= wczoraj)
    .sort((a, b) => ((a.date || "") + (a.matchTime || "")).localeCompare((b.date || "") + (b.matchTime || "")))
    .slice(0, 40);

  const karta = (o: Observation) => {
    const oceniona = !!o.statsFilledIn;
    const trwa = live && live.observationId === o.id;
    const dzis = o.date === today;
    return `
    <div class="card obs-card ${trwa ? "selected" : ""}">
      <div class="row">
        <div style="min-width:0;">
          <div class="name">${esc(o.match || "Mecz bez nazwy")}</div>
          <div class="sub" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(o.date)}${o.matchTime ? " · " + esc(o.matchTime) : ""}${o.location ? " · " + esc(o.location) : ""}</div>
        </div>
        <span class="tag ${trwa ? "live" : oceniona ? "done" : ""}">${trwa ? "W toku" : oceniona ? "Oceniona" : dzis ? "Dziś" : "Plan"}</span>
      </div>
      <div class="sub" style="margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${o.playerId ? "<strong style=\"color:var(--text-strong)\">" + esc(playerLabel(o.playerId)) + "</strong>" : "Obserwacja zespołu"}
        ${o.scout ? " · " + esc(o.scout) : ""}
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn ${trwa ? "" : "ghost"}" data-act="start-live" data-id="${esc(o.id)}">${trwa ? "Wróć" : "Rozpocznij"}</button>
        ${oceniona
          ? `<button class="btn ghost" data-act="podglad" data-id="${esc(o.id)}">Otwórz</button>`
          : `<button class="btn ghost" data-act="open-ocena" data-id="${esc(o.id)}">Oceń</button>`}
      </div>
    </div>`;
  };

  return `
    <h2>Obserwacje</h2>
    <p class="hint">Plany z SBS · od wczoraj wzwyż${cache.fetchedAt ? " · kopia z " + new Date(cache.fetchedAt).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</p>
    ${lista.length ? lista.map(karta).join("") : '<div class="empty">Brak zaplanowanych obserwacji.<br>Załóż nową albo odśwież kopię bazy w zakładce Baza.</div>'}
    <button class="btn ghost" data-act="go-nowa">+ Zaplanuj obserwację</button>`;
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
      <input id="n-match" placeholder="np. Chojniczanka Chojnice - Znicz Pruszków"></div>
    <div class="grid-2">
      <div class="field"><span class="label">Data</span><input type="date" id="n-date" value="${todayISO()}"></div>
      <div class="field"><span class="label">Godzina</span><input type="time" id="n-time" value="17:00"></div>
    </div>
    <div class="field"><span class="label">Miejsce</span>
      <input id="n-location" placeholder="np. ul. Mickiewicza 12, Chojnice"></div>
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

    <div class="row" style="margin-bottom:6px;">
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

function viewOcenaZawodnika(z: SkladZawodnik): string {
  const ocena = z.ocena || {};
  return `
    <div class="row" style="margin-bottom:10px;">
      <div>
        <div class="name">${esc(z.nazwa)}</div>
        <div class="sub">${z.numer ? "nr " + esc(z.numer) + " · " : ""}${z.pozycja ? esc(POZYCJE_PELNE[z.pozycja]) : "poza ustawieniem"}</div>
      </div>
      <button class="btn ghost small" data-act="zamknij-zawodnika">Wróć</button>
    </div>

    ${z.pozycja ? `<button class="btn ghost" style="margin-top:0;" data-act="zmien-na-pozycji" data-numer="${z.pozycja}">
      Zmiana — wstaw innego na ${esc(POZYCJE_PELNE[z.pozycja])}</button>` : ""}

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

    <div class="section">
      <div class="row" style="margin-bottom:6px;">
        <span class="label" style="margin:0;">Notatka</span>
        <button class="btn ghost small" data-act="dyktuj-notatke" id="dyktuj-btn">Dyktuj</button>
      </div>
      <textarea id="notatka-zawodnika" placeholder="Co zwróciło uwagę…">${esc(z.notatka || "")}</textarea>
      <p class="hint" style="margin-top:6px;">Zapisuje się samo — po wpisaniu możesz od razu wrócić na planszę.</p>
    </div>`;
}

// Obserwacja z bieżącego meczu wraz ze składem — wołane przy każdej zmianie na planszy.
function biezacyObsSklad(): { obs: Observation & { skladMeczu?: Sklad }; strona: SkladStrona } | null {
  if (!live) return null;
  const obs = cache.observations.find((o) => o.id === live!.observationId) as (Observation & { skladMeczu?: Sklad }) | undefined;
  const strona = obs?.skladMeczu?.[skladStrona];
  return obs && strona ? { obs, strona } : null;
}

// Treść pól tekstowych żyje w DOM, nie w stanie — przed każdym przerysowaniem trzeba ją przepisać
// do zawodnika, inaczej notatka przepada przy pierwszym dotknięciu kropki oceny.
function zabezpieczNotatke() {
  if (ocenianyZawodnik === null) return;
  const pole = $<HTMLTextAreaElement>("notatka-zawodnika");
  const dane = biezacyObsSklad();
  const z = dane?.strona.zawodnicy[ocenianyZawodnik];
  if (pole && z) z.notatka = pole.value;
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
  return `
    <span class="label">Tagujesz</span>
    <div class="tagujesz">
      <button class="chip ${wybrany ? "" : "wybrany"}" data-act="taguj-kogo" data-v="" aria-pressed="${!wybrany}">Zespół</button>
      ${lista.map((z) => `
        <button class="chip ${wybrany === z.klucz ? "wybrany" : ""}" data-act="taguj-kogo" data-v="${esc(z.klucz)}" aria-pressed="${wybrany === z.klucz}">${esc(z.etykieta)}</button>`).join("")}
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
      <span class="label">Warunki</span>
      <div class="chips">
        ${WARUNKI.map((w) => `<button class="chip" data-act="warunki" data-v="${esc(w)}" aria-pressed="${warunki.includes(w)}">${esc(w)}</button>`).join("")}
      </div>
    </div>
    <div class="field">
      <textarea id="o-mecz-notatka" placeholder="Krótka notatka o meczu…" style="min-height:58px;">${esc(o?.notatkaMeczu || "")}</textarea>
    </div>

    ${oceniony}

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
        <textarea id="o-sfg" placeholder="Uwagi o stałych fragmentach…" style="min-height:60px;">${esc(ocena.setPieceComment)}</textarea>
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
      <textarea id="o-desc" placeholder="Wrażenie ogólne, kontekst meczu…">${esc(ocena.description)}</textarea>
    </div>

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
    const oznaczeni = (dane?.zawodnicy || []).filter((z) => z.wyrozniony || z.pozycja || z.notatka || z.noga ||
      (z.ocena && Object.values(z.ocena).some((n) => Number(n) > 0)));
    if (!oznaczeni.length) return "";
    return `
      <div class="section">
        <span class="label">${esc(dane?.nazwa || strona)}${dane?.formacja ? " · " + esc(dane.formacja) : ""}</span>
        ${oznaczeni.map((z) => `
          <div class="card" style="padding:11px 12px;">
            <div class="row">
              <div class="name" style="font-size:15px;">${z.wyrozniony ? "★ " : ""}${esc(kluczZawodnika(z))}</div>
              ${z.pozycja ? `<span class="tag">${esc(POZYCJE[z.pozycja])}</span>` : ""}
            </div>
            ${z.noga ? `<div class="sub" style="margin-top:4px;">noga: ${esc(z.noga)}</div>` : ""}
            ${z.ocena && Object.values(z.ocena).some((n) => Number(n) > 0)
              ? `<div class="sub" style="margin-top:5px; font-family:var(--data);">${[
                  ...OCENA_MAPY.map((k) => ({ k, l: RATING_LABELS[k] })),
                  ...OCENA_GLOWA.map((f) => ({ k: f.key, l: f.label })),
                ].filter((x) => Number(z.ocena![x.k]) > 0)
                  .map((x) => x.l + " " + z.ocena![x.k]).join(" · ")}</div>` : ""}
            ${z.notatka ? `<div class="sub" style="margin-top:5px;">${esc(z.notatka)}</div>` : ""}
          </div>`).join("")}
      </div>`;
  }).join("");

  return `
    <h2>${esc(obs.match || "Obserwacja")}</h2>
    <p class="hint">${esc(obs.date)}${obs.matchTime ? " · " + esc(obs.matchTime) : ""}${obs.scout ? " · " + esc(obs.scout) : ""}</p>

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
      const ma = z.ocena && [...OCENA_MAPY, ...OCENA_GLOWA.map((f) => f.key)].some((k) => Number(z.ocena![k]) > 0);
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

function viewBaza(): string {
  const n = queueLength();
  const ostatnia = cache.fetchedAt
    ? new Date(cache.fetchedAt).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "brak";

  return `
    <h2>Ustawienia</h2>
    <p class="hint">Stan aplikacji i kopii danych w telefonie.</p>

    <div class="card">
      <div class="row"><span class="sub">Czeka na wysyłkę</span>
        <strong style="font-family:var(--data); color:${n ? "var(--accent-fg)" : "var(--good-fg)"};">${n}</strong></div>
      <div class="row" style="margin-top:6px;"><span class="sub">Kopia bazy</span>
        <strong style="font-family:var(--data); font-size:12.5px; color:var(--text-2);">${esc(ostatnia)}</strong></div>
      <div class="row" style="margin-top:6px;"><span class="sub">Zawodników w kopii</span>
        <strong style="font-family:var(--data); font-size:12.5px; color:var(--text-2);">${cache.players.length}</strong></div>
      <div class="row" style="margin-top:6px;"><span class="sub">Wersja panelu</span>
        <strong style="font-family:var(--data); font-size:12.5px; color:var(--text-2);">${esc(WERSJA_PANELU)}</strong></div>
      <button class="btn ghost" data-act="refresh">Odśwież kopię bazy</button>
      ${n ? '<button class="btn ghost" data-act="flush">Wyślij teraz</button>' : ""}
    </div>

    <p class="hint">Kopia bazy to zawodnicy, kluby i plany trzymane w telefonie. Z niej bierze się
    kadra klubu przy składzie — odśwież ją przy zasięgu, zanim pojedziesz na mecz.</p>

    <div class="section">
      ${zalogowany
        ? '<button class="btn danger" data-act="logout">Wyloguj się</button>'
        : '<button class="btn ghost" data-act="go-login">Zaloguj się</button>'}
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
function instalacjaHtml(): string {
  const nav = navigator as Navigator & { standalone?: boolean };
  const zIkony = nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
  if (zIkony) return "";

  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const wObcejPrzegladarce = iOS && nav.standalone === undefined;
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
    <div class="section">
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
  if (!navigator.onLine) return `<span class="sync offline">Offline${n ? " · " + n : ""}</span>`;
  if (n) return `<span class="sync pending">W kolejce · ${n}</span>`;
  // Krótko, bo pasek dzieli szerokość z nazwą aplikacji i przyciskiem motywu.
  return '<span class="sync">Wysłane</span>';
}

function render() {
  const app = $("app");
  if (!app) return;
  const body =
    view === "dzis" ? viewDzis() :
    view === "nowa" ? viewNowa() :
    view === "live" ? viewLive() :
    view === "ocena" ? viewOcena() :
    view === "podglad" ? viewPodglad() :
    viewBaza();

  app.innerHTML = `
    <div class="topbar">
      <img class="mark" src="${LOGO}" alt="">
      <h1>SBS Scout Live</h1>
      ${syncPill()}
      ${themeButtonHtml()}
    </div>
    <main id="main">${body}</main>
    <nav class="tabbar">
      ${widoczneZakladki().map((t) => `
        <button class="tab" data-act="go" data-v="${t.id}" aria-selected="${view === t.id || (view === "nowa" && t.id === "dzis")}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">${t.icon}</svg>
          ${t.label}
        </button>`).join("")}
    </nav>`;

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
  toast("Zdarzenia zapisane — wystaw oceny");
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

function saveOcena() {
  if (!ocena) return;
  const obs = cache.observations.find((o) => o.id === ocena!.observationId);
  if (!obs) { toast("Nie znaleziono obserwacji"); return; }

  const wystawione = RATING_KEYS.filter((k) => ocena!.ratings[k] > 0);

  // Przy JEDNEJ OBSERWACJI NA MECZ oceny indywidualne powstają przy składzie, a nie tutaj —
  // wymaganie atrybutu na poziomie obserwacji blokowałoby zapis meczu, w którym oceniono
  // trzech zmienników i poziom spotkania. Wystarczy, że cokolwiek zostało wypełnione.
  const o = cache.observations.find((x) => x.id === ocena!.observationId) as (Observation & { poziomMeczu?: number; warunki?: string[]; notatkaMeczu?: string; skladMeczu?: Sklad }) | undefined;
  const cosZeSkladu = STRONY.some((strona) => (o?.skladMeczu?.[strona]?.zawodnicy || [])
    .some((z) => z.wyrozniony || z.notatka || (z.ocena && Object.values(z.ocena).some((n) => Number(n) > 0))));
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

  const maRaport = Object.keys(phases).length || Object.keys(setPieces).length ||
    ocena.perspektywa || description || setPieceComment;
  if (maRaport) {
    const rep: Report = {
      id: uid("rep"),
      playerId: obs.playerId,
      date: obs.date || todayISO(),
      scout,
      description,
      perspektywa: ocena.perspektywa,
      obsType: (obs.obsType as string) === "online" ? "Online" : (obs.obsType as string) === "video" ? "Video" : "Live",
      phases, setPieces, setPieceComment,
    };
    saveReport(rep);
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
  view = "dzis";
  render();
  toast(navigator.onLine ? "Zapisano i wysłano do SBS" : "Zapisano — wyślę, gdy wróci zasięg");
}

function saveNowa(odRazu: boolean) {
  const match = $<HTMLInputElement>("n-match")?.value.trim() || "";
  if (!match) { toast("Podaj nazwę meczu"); return; }
  const scout = ($<HTMLInputElement | HTMLSelectElement>("n-scout")?.value || "").trim();
  if (scout) setScout(scout);
  const obs: Observation = {
    id: uid("obs"),
    playerId: $<HTMLSelectElement>("n-player")?.value || "",
    date: $<HTMLInputElement>("n-date")?.value || todayISO(),
    matchTime: $<HTMLInputElement>("n-time")?.value || "",
    match,
    location: $<HTMLInputElement>("n-location")?.value.trim() || "",
    scout,
    ratings: {},
    statsFilledIn: false,
    obsType: $<HTMLSelectElement>("n-typ")?.value || "live",
  };
  saveObservation(obs);
  cache = getCache();
  if (odRazu) { beginLive(obs.id); toast("Obserwacja utworzona"); return; }
  // Plan na później zostaje na liście — scout umawia wyjazd i wraca do niego w dniu meczu.
  view = "dzis";
  render();
  toast("Zaplanowane na " + (obs.date || ""));
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
    case "go-nowa": view = "nowa"; render(); break;
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
      live.wybranyZawodnik = v || undefined;
      setLive(live);
      render();
      break;
    case "live-tab": liveTab = v === "sklady" ? "sklady" : "zdarzenia"; render(); break;
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
      zabezpieczNotatke();
      const dane = biezacyObsSklad();
      if (dane) saveObservation(dane.obs);
      ocenianyZawodnik = null;
      render();
      break;
    }

    case "wyroznij-otwartego": {
      zabezpieczNotatke();
      const dane = biezacyObsSklad();
      const z = dane?.strona.zawodnicy[ocenianyZawodnik ?? -1];
      if (!dane || !z) break;
      z.wyrozniony = !z.wyrozniony;
      saveObservation(dane.obs);
      if (navigator.vibrate) navigator.vibrate(10);
      render();
      break;
    }

    case "dyktuj-notatke": dictate("notatka-zawodnika", "dyktuj-btn"); break;

    case "noga": {
      zabezpieczNotatke();
      const dane = biezacyObsSklad();
      const z = dane?.strona.zawodnicy[ocenianyZawodnik ?? -1];
      if (!dane || !z) break;
      z.noga = z.noga === v ? undefined : v;
      saveObservation(dane.obs);
      render();
      break;
    }

    case "wyroznij": {
      if (!live) break;
      const obs = cache.observations.find((o) => o.id === live!.observationId) as (Observation & { skladMeczu?: Sklad }) | undefined;
      const lista = obs?.skladMeczu?.[el.dataset.strona as "gospodarze" | "goscie"]?.zawodnicy;
      const z = lista?.[Number(el.dataset.i)];
      if (!obs || !z) break;
      z.wyrozniony = !z.wyrozniony;
      // Zapis idzie od razu, a nie dopiero po meczu: telefon potrafi ubić kartę w tle, a wyróżnienia
      // to jedyna rzecz na tym ekranie, której nie da się odtworzyć z pamięci po powrocie.
      saveObservation(obs);
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
      if (el.dataset.host === "mapa") {
        zabezpieczNotatke();
        const dane = biezacyObsSklad();
        const z = dane?.strona.zawodnicy[ocenianyZawodnik ?? -1];
        if (!dane || !z) break;
        z.ocena = z.ocena || {};
        const klucz = el.dataset.k!;
        const wartosc = Number(v);
        z.ocena[klucz] = z.ocena[klucz] === wartosc ? 0 : wartosc;
        saveObservation(dane.obs);
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
    case "dictate": dictate(); break;
    case "save-ocena": saveOcena(); break;

    case "refresh":
      toast("Pobieram…");
      refreshCache().then((c) => { cache = c; render(); toast("Kopia bazy odświeżona"); })
        .catch((err) => toast("Nie udało się pobrać: " + err.message));
      break;
    case "flush":
      flushQueue().then((left) => { refreshSyncPill(); render(); toast(left ? "Zostało " + left : "Wszystko wysłane"); });
      break;
    case "logout":
      signOut().then(() => location.reload());
      break;
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

document.addEventListener("blur", (e) => {
  if ((e.target as HTMLElement)?.id !== "notatka-zawodnika") return;
  zabezpieczNotatke();
  const dane = biezacyObsSklad();
  if (dane) saveObservation(dane.obs);
}, true);

document.addEventListener("change", (e) => {
  const pole = e.target as HTMLInputElement;
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
        <img src="${LOGO}" alt="Scout Base System" width="88" height="88">
        <h1>SBS Scout Live</h1>
        <p class="hint">Zaloguj się tym samym kontem, co w Scout Base System.</p>
      </div>
      <div id="login-error"></div>
      ${info ? `<div class="error" style="background:rgba(78,154,99,.14); border-color:var(--good); color:#8FD3A2;">${esc(info)}</div>` : ""}
      <div class="field"><input id="l-email" type="email" inputmode="email" autocomplete="username" placeholder="E-mail"></div>
      <div class="field"><input id="l-pass" type="password" autocomplete="current-password" placeholder="Hasło"></div>
      <button class="btn" id="l-submit">Zaloguj się</button>
      <button class="link" id="l-reset">Nie pamiętam hasła</button>
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
    if (r.ok) start();
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

async function start(pobranaKopia?: Cache) {
  cache = pobranaKopia || getCache();
  live = getLive();
  if (live) view = "live";
  render();

  void flushQueue().then(refreshSyncPill);
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

// KIEDY PANEL PYTA O HASŁO.
//
// Nie zawsze — tylko wtedy, gdy baza rzeczywiście tego wymaga. Reguły dostępu (RLS) w bazie są
// dziś takie, że dane czyta się bez logowania; tak samo działa aplikacja na komputerze
// (WYMAGAJ_LOGOWANIA w src/main.ts). Wymuszanie logowania w samym panelu niczego by nie chroniło:
// klucz dostępu jest wpisany w kod każdej strony i można go stamtąd odczytać. Blokowałoby tylko
// scouta, który stoi na trybunie i chce zacząć obserwację.
//
// Dlatego zamiast flagi do ręcznego przestawiania panel po prostu SPRAWDZA, czy dane przychodzą.
// Gdy przyjdą — wchodzi od razu na listę obserwacji. Gdy baza nic nie odda (bo ktoś włączył
// reguły dostępu tylko dla zalogowanych) — pokazuje ekran logowania. Nie ma tu nic do
// przestawiania po zamknięciu dostępu: panel dostosuje się sam, przy pierwszym uruchomieniu.
async function boot() {
  const user = await currentUser();
  if (user) { zalogowany = true; start(); return; }

  // Bez sesji nie da się odróżnić „brak dostępu" od „pusta tabela" po samym błędzie — reguły
  // dostępu w Postgresie nie zgłaszają odmowy, tylko oddają zero wierszy. Dlatego rozstrzyga
  // wynik: cokolwiek przyszło, znaczy że dostęp jest.
  try {
    const kopia = await refreshCache();
    if (kopia.players.length || kopia.clubs.length || kopia.observations.length) {
      start(kopia);
      return;
    }
  } catch (e) {
    console.warn("Odczyt bez logowania nie powiódł się:", (e as Error).message);
  }

  // Została jeszcze kopia z poprzedniego uruchomienia — na stadionie bez zasięgu to ona jest
  // wszystkim, co mamy, i szkoda byłoby zamiast niej pokazać ekran logowania.
  if (getCache().players.length) { start(); return; }

  renderLogin();
}

window.addEventListener("online", () => { void flushQueue().then(refreshSyncPill); });
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
  void flushQueue().then(refreshSyncPill);

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
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Offline niedostępne:", e));
  });
}
