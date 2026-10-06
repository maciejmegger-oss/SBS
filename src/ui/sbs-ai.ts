// SBS AI — zakładka i karta na dashboardzie. Pokazuje to, co zrobił asystent (patrz AI-PRACOWNIK.md):
// ostatni raport dzienny, propozycje ocen do potwierdzenia, zadania i dziennik zapisów agenta.
//
// To jest WIDOK. Asystent pracuje na serwerze (api/raport-dzienny.js, api/agent.js) i niczego tu nie
// uruchamia — ekran tylko czyta jego wyniki i pozwala skautowi rozstrzygnąć to, co agent może jedynie
// zaproponować: potwierdzić albo odrzucić ocenę, zmienić status zadania.
//
// Wszystko leci kontem zalogowanego użytkownika, więc obowiązują te same reguły bazy co w reszcie
// aplikacji. Brak danych (asystent jeszcze nie ruszył) jest stanem normalnym i dostaje wyjaśnienie,
// a nie pusty ekran.

import { sb, storage } from "../data/storage";
import {
  KLUCZ_RAPORTU, KLUCZ_ZADAN, KLUCZ_DZIENNIKA, OCENY_ETYKIETY, STATUSY_ZADAN,
  mapujPropozycje, notatkaPoDecyzji, podsumowanieRaportu, zadaniaOtwarte, ustawStatusZadania,
  pokazCzas, raportNieswiezy,
  type RaportAi, type Propozycja, type Zadanie, type ZawodnikRaportu,
} from "../data/sbs-ai";

const ETYKIETY_STATUSU: Record<string, string> = { otwarte: "Otwarte", w_toku: "W toku", zrobione: "Zrobione", anulowane: "Anulowane" };

interface Stan {
  stan: "nieznany" | "pobieram" | "gotowe";
  pobranoO: number;
  raport: RaportAi | null;
  zadania: Zadanie[];
  dziennik: Record<string, unknown>[];
  propozycje: Propozycja[];
  bledy: string[];
}
const S: Stan = { stan: "nieznany", pobranoO: 0, raport: null, zadania: [], dziennik: [], propozycje: [], bledy: [] };

/** Zależności od reszty aplikacji — podawane z main.ts, żeby ten plik nie importował go z powrotem. */
export interface Zaleznosci {
  esc: (s: unknown) => string;
  render: () => void;
  nazwaZawodnika: (id: string) => string;
  kto: () => string;
  /** Wstawia potwierdzoną obserwację do pamięci aplikacji, żeby średnie policzyły się bez przeładowania. */
  wprowadzObserwacje: (o: Record<string, unknown>) => void;
  powiadom: (tekst: string) => void;
}

async function czytajKv<T>(klucz: string): Promise<T | null> {
  const w = await storage.get(klucz, true);
  if (!w || !w.value) return null;
  try { return JSON.parse(w.value) as T; } catch { return null; }
}

/** Pobiera wszystko naraz; awaria jednego źródła nie blokuje reszty, a jej powód widać w ekranie. */
export async function zaladujSbsAi(zaleznosci: Pick<Zaleznosci, "render">, wymus = false): Promise<void> {
  if (S.stan === "pobieram") return;
  if (!wymus && S.stan === "gotowe" && Date.now() - S.pobranoO < 5 * 60 * 1000) return;
  S.stan = "pobieram";
  const bledy: string[] = [];
  const bezpiecznie = async <T,>(nazwa: string, f: () => Promise<T>, domyslnie: T): Promise<T> => {
    try { return await f(); } catch (e) { bledy.push(`${nazwa}: ${(e as Error).message || e}`); return domyslnie; }
  };
  const [raport, zadania, dziennik, wiersze] = await Promise.all([
    bezpiecznie("raport dzienny", () => czytajKv<RaportAi>(KLUCZ_RAPORTU), null),
    bezpiecznie("zadania", async () => (await czytajKv<Zadanie[]>(KLUCZ_ZADAN)) || [], [] as Zadanie[]),
    bezpiecznie("dziennik", async () => (await czytajKv<Record<string, unknown>[]>(KLUCZ_DZIENNIKA)) || [], [] as Record<string, unknown>[]),
    bezpiecznie("propozycje ocen", async () => {
      const { data, error } = await sb.from("sbs_observations").select("*").eq("scout", "SBS AI").eq("stats_filled_in", false).limit(200);
      if (error) throw new Error(error.message);
      return data || [];
    }, [] as Record<string, unknown>[]),
  ]);
  S.raport = raport; S.zadania = zadania; S.dziennik = dziennik;
  S.propozycje = mapujPropozycje(wiersze as never);
  S.bledy = bledy; S.stan = "gotowe"; S.pobranoO = Date.now();
  zaleznosci.render();
}

/** Ile rzeczy czeka na człowieka — liczba na odznace w menu. */
export const doRozpatrzenia = () => S.propozycje.length;

const pill = (esc: Zaleznosci["esc"], tekst: string, kolor: string) =>
  `<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;background:${kolor};color:#fff;margin-right:4px;">${esc(tekst)}</span>`;

// ───────────────────────────────── KARTA NA DASHBOARDZIE ─────────────────────────────────
export function kartaDashboardu(z: Pick<Zaleznosci, "esc">): string {
  const { esc } = z;
  const naglowek = `<h4 style="margin:0;color:var(--heading);">SBS AI</h4>`;
  const otworz = `<button class="secondary" data-action="goto-sbsai">Otwórz zakładkę SBS AI</button>`;
  if (S.stan !== "gotowe") {
    return `<div class="card">${naglowek}<p class="note" style="margin:8px 0 0;">Wczytuję raport asystenta…</p></div>`;
  }
  const p = podsumowanieRaportu(S.raport);
  const propozycji = S.propozycje.length, zadan = zadaniaOtwarte(S.zadania).length;
  const nieswiezy = S.raport ? raportNieswiezy(S.raport, new Date()) : false;
  const liczba = (n: number, opis: string) => `<div style="min-width:110px;"><div style="font-size:26px;font-weight:600;color:var(--gold-dark);line-height:1.1;">${n}</div><div class="note" style="margin:0;">${esc(opis)}</div></div>`;
  const tresc = S.raport
    ? `<div style="display:flex;gap:18px;flex-wrap:wrap;margin:12px 0;">
         ${liczba(p.nowi, "nowych zawodników")}${liczba(p.spelnia, "spełnia profil")}
         ${liczba(p.doObserwacji, "do obserwacji")}${liczba(p.potencjal, "potencjał transferowy")}${liczba(p.brakDanych, "brak danych")}
       </div>
       <p class="note" style="margin:0 0 10px;">Raport z ${esc(S.raport.data || "—")}${nieswiezy ? ' — <strong style="color:#B0453A;">stary: sprawdź, czy zadanie dzienne działa</strong>' : ""}.</p>`
    : `<p class="note" style="margin:10px 0;">Asystent nie przygotował jeszcze żadnego raportu. Raport pojawi się po pierwszym uruchomieniu zadania dziennego (patrz AI-PRACOWNIK.md).</p>`;
  const czeka = (propozycji || zadan)
    ? `<p style="margin:0 0 10px;">${propozycji ? pill(esc, `${propozycji} ${propozycji === 1 ? "ocena czeka" : "ocen czeka"} na potwierdzenie`, "#B8860B") : ""}${zadan ? pill(esc, `${zadan} ${zadan === 1 ? "zadanie" : "zadań"} otwartych`, "#2F6B5A") : ""}</p>` : "";
  return `<div class="card">${naglowek}${tresc}${czeka}${otworz}</div>`;
}

// ───────────────────────────────────── ZAKŁADKA ──────────────────────────────────────────
function tabelaZawodnikow(z: Pick<Zaleznosci, "esc">, lista: ZawodnikRaportu[], kolumnaPowod: "powody" | "braki"): string {
  const { esc } = z;
  if (!lista.length) return `<p class="note">Brak.</p>`;
  const wiersze = lista.map((x) => {
    const znaczniki = [
      x.spelniaProfil ? pill(esc, "spełnia profil", "#2F6B5A") : "",
      x.potencjalTransferowy ? pill(esc, "potencjał transferowy", "#B8860B") : "",
      x.wymagaObserwacji ? pill(esc, "do obserwacji", "#5B6C8F") : "",
      x.brakDanych ? pill(esc, "brak danych", "#8A8A8A") : "",
    ].join("");
    const powod = kolumnaPowod === "powody" ? (x.powodyObserwacji || []).join("; ") : (x.braki || []).join(", ");
    return `<tr>
      <td><a href="#" data-action="sbsai-otworz-zawodnika" data-id="${esc(x.id)}">${esc(x.nazwa)}</a></td>
      <td>${esc(x.pozycja || "—")}</td><td>${esc(x.rocznik ?? "—")}</td>
      <td><strong>${esc(x.wynik)}</strong></td><td>${x.ocenaSrednia ?? "—"}</td>
      <td>${znaczniki}</td><td class="note">${esc(powod)}</td></tr>`;
  }).join("");
  return `<div class="tabela-przewijana"><table>
    <thead><tr><th>Zawodnik</th><th>Pozycja</th><th>Rocznik</th><th>Wynik</th><th>Śr. ocen</th><th></th><th>${kolumnaPowod === "powody" ? "Dlaczego" : "Czego brakuje"}</th></tr></thead>
    <tbody>${wiersze}</tbody></table></div>`;
}

export function widokSbsAi(z: Pick<Zaleznosci, "esc" | "nazwaZawodnika">): string {
  const { esc } = z;
  const r = S.raport, p = podsumowanieRaportu(r);
  const bledy = S.bledy.length
    ? `<div class="card" style="border-left:4px solid #B0453A;"><strong>Nie wszystko się wczytało:</strong><ul style="margin:6px 0 0;">${S.bledy.map((b) => `<li class="note">${esc(b)}</li>`).join("")}</ul></div>` : "";

  const raportHtml = !r
    ? `<div class="card"><h4 style="margin-top:0;color:var(--heading);">Raport dzienny</h4>
        <p>Asystent nie przygotował jeszcze raportu. Zadanie uruchamia się codziennie rano (06:00 UTC); wymaga ustawień opisanych w
        <code>AI-PRACOWNIK.md</code> — klucza serwisowego, tematu powiadomień i profilu poszukiwanego przez klub.</p></div>`
    : `<div class="card">
        <h4 style="margin-top:0;color:var(--heading);">Raport dzienny — ${esc(r.data || "—")}</h4>
        ${r.ostrzezenie ? `<p style="color:#B0453A;">⚠ ${esc(r.ostrzezenie)}</p>` : ""}
        ${r.wiadomosc ? `<pre style="white-space:pre-wrap;font:inherit;background:var(--card-alt, rgba(0,0,0,.04));padding:10px 12px;border-radius:8px;margin:0 0 6px;">${esc(r.wiadomosc)}</pre>
          <p class="note" style="margin:0 0 14px;">To samo, co dostajesz na telefon.</p>` : ""}
        ${r.uzupelnienie && (r.uzupelnienie.uzupelnieni || r.uzupelnienie.doRecznegoWskazania.length || r.uzupelnienie.bledy.length) ? `
          <p class="note">Uzupełnianie braków z Transfermarktu: sprawdzono ${r.uzupelnienie.sprawdzeni}, uzupełniono ${r.uzupelnienie.uzupelnieni}.
          ${r.uzupelnienie.doRecznegoWskazania.length ? `Do ręcznego wskazania profilu: <strong>${esc(r.uzupelnienie.doRecznegoWskazania.join(", "))}</strong>.` : ""}
          ${r.uzupelnienie.bledy.length ? `Błędy: ${esc(r.uzupelnienie.bledy.slice(0, 3).join("; "))}.` : ""}</p>` : ""}
        <h5 style="margin:14px 0 6px;">Nowi zawodnicy (${p.nowi}) — ranking</h5>${tabelaZawodnikow(z, (r.ranking || []), "braki")}
        ${(r.nowi || []).some((x) => x.brakDanych) ? `<h5 style="margin:14px 0 6px;">Brak wystarczających danych</h5>${tabelaZawodnikow(z, (r.nowi || []).filter((x) => x.brakDanych), "braki")}` : ""}
        <h5 style="margin:14px 0 6px;">W bazie czeka na ponowną obserwację (${p.zBazy})</h5>${tabelaZawodnikow(z, r.zBazyLista || [], "powody")}
        ${(r.rankingBazy || []).length ? `<h5 style="margin:14px 0 6px;">Najlepiej dopasowani do profilu w całej bazie</h5>${tabelaZawodnikow(z, r.rankingBazy || [], "braki")}` : ""}
      </div>`;

  const propozycjeHtml = `<div class="card">
    <h4 style="margin-top:0;color:var(--heading);">Propozycje ocen do potwierdzenia (${S.propozycje.length})</h4>
    <p class="note">Asystent nie wpisuje ocen sam. To propozycje — <strong>nie liczą się do średnich ani rankingu</strong>, dopóki ich nie potwierdzisz.
    Sprawdź uzasadnienie i zdecyduj.</p>
    ${S.propozycje.length ? S.propozycje.map((m) => `
      <div style="border-top:1px solid var(--border);padding:10px 0;">
        <div><strong>${esc(z.nazwaZawodnika(m.playerId) || m.playerId)}</strong> <span class="note">${esc(m.data)}${m.mecz ? " · " + esc(m.mecz) : ""}</span></div>
        <div style="margin:4px 0;">${Object.entries(m.oceny).map(([k, v]) => pill(esc, `${OCENY_ETYKIETY[k] || k}: ${v}`, "#5B6C8F")).join("")}
          ${m.srednia !== null ? `<span class="note">średnia ${m.srednia}</span>` : ""}</div>
        <div class="note" style="margin:4px 0 8px;">„${esc(m.uzasadnienie)}"</div>
        <button class="gold" data-action="sbsai-potwierdz" data-id="${esc(m.id)}">Potwierdź ocenę</button>
        <button class="secondary" data-action="sbsai-odrzuc" data-id="${esc(m.id)}">Odrzuć</button>
      </div>`).join("") : `<p class="note">Nic nie czeka.</p>`}
  </div>`;

  const otwarte = zadaniaOtwarte(S.zadania);
  const zadaniaHtml = `<div class="card">
    <h4 style="margin-top:0;color:var(--heading);">Zadania scoutingowe (${otwarte.length} otwartych)</h4>
    ${otwarte.length ? `<div class="tabela-przewijana"><table>
      <thead><tr><th>Zadanie</th><th>Zawodnik</th><th>Termin</th><th>Priorytet</th><th>Status</th></tr></thead><tbody>
      ${otwarte.map((t) => `<tr>
        <td>${esc(t.opis)}${t.mecz ? `<div class="note">${esc(t.mecz)}</div>` : ""}</td>
        <td>${t.zawodnik_id ? esc(z.nazwaZawodnika(t.zawodnik_id) || t.zawodnik_id) : "—"}</td>
        <td>${esc(t.termin || "—")}</td><td>${esc(t.priorytet || "normalny")}</td>
        <td><select data-action="sbsai-status-zadania" data-id="${esc(t.id)}" style="width:auto;">
          ${STATUSY_ZADAN.map((s) => `<option value="${s}" ${s === t.status ? "selected" : ""}>${ETYKIETY_STATUSU[s]}</option>`).join("")}</select></td></tr>`).join("")}
      </tbody></table></div>` : `<p class="note">Brak otwartych zadań.</p>`}
  </div>`;

  const dz = S.dziennik.slice(-25).reverse();
  const dziennikHtml = `<div class="card">
    <h4 style="margin-top:0;color:var(--heading);">Dziennik asystenta (ostatnie ${dz.length})</h4>
    <p class="note">Każdy zapis, który agent wykonał w SBS. Dziennika nie da się stąd edytować.</p>
    ${dz.length ? `<div class="tabela-przewijana"><table><thead><tr><th>Kiedy</th><th>Narzędzie</th><th>Szczegóły</th></tr></thead><tbody>
      ${dz.map((w) => {
        const { czas, narzedzie, ...reszta } = w as Record<string, unknown>;
        return `<tr><td>${esc(pokazCzas(czas as string))}</td><td>${esc(narzedzie)}</td><td class="note">${esc(JSON.stringify(reszta))}</td></tr>`;
      }).join("")}</tbody></table></div>` : `<p class="note">Agent nie zapisał jeszcze niczego.</p>`}
  </div>`;

  return `
  <h2 class="view-title">SBS AI</h2>
  <p class="view-sub">Asystent czyta bazę, porównuje zawodników z profilem klubu i przygotowuje raport. Ocen i raportów sam nie zatwierdza — to robisz Ty.
    <button class="secondary" data-action="sbsai-odswiez" style="margin-left:8px;">Odśwież</button>
    ${S.stan === "pobieram" ? '<span class="note">wczytuję…</span>' : `<span class="note">wczytano ${esc(pokazCzas(new Date(S.pobranoO).toISOString()))}</span>`}</p>
  ${bledy}
  <div style="display:flex;flex-direction:column;gap:18px;">${propozycjeHtml}${raportHtml}${zadaniaHtml}${dziennikHtml}</div>`;
}

// ───────────────────────────────────── AKCJE ─────────────────────────────────────────────
async function rozstrzygnij(z: Zaleznosci, id: string, decyzja: "potwierdzona" | "odrzucona") {
  const m = S.propozycje.find((x) => x.id === id);
  if (!m) return;
  const dzien = new Date().toISOString().slice(0, 10);
  const zmiany: Record<string, unknown> = { notes: notatkaPoDecyzji(m.wiersz.notes || "", decyzja, z.kto(), dzien) };
  // Potwierdzenie = ocena zaczyna się liczyć (aplikacja bierze średnie wyłącznie z obserwacji z wypełnioną oceną).
  // Odrzucenie niczego nie kasuje — zmienia się tylko notatka, więc propozycja znika z listy, a ślad zostaje.
  if (decyzja === "potwierdzona") zmiany.stats_filled_in = true;
  const { error } = await sb.from("sbs_observations").update(zmiany).eq("id", id);
  if (error) { z.powiadom("Nie udało się zapisać decyzji: " + error.message); return; }
  if (decyzja === "potwierdzona") {
    z.wprowadzObserwacje({
      id: m.id, playerId: m.playerId, date: m.data, match: m.mecz, scout: "SBS AI", ratings: m.oceny,
      recommendation: m.wiersz.recommendation || "", notes: zmiany.notes, statsFilledIn: true,
    });
  }
  S.propozycje = S.propozycje.filter((x) => x.id !== id);
  z.powiadom(decyzja === "potwierdzona" ? "Ocena potwierdzona — od teraz liczy się do średnich." : "Propozycja odrzucona.");
  z.render();
}

async function zmienStatusZadania(z: Zaleznosci, id: string, status: string) {
  // Świeży odczyt tuż przed zapisem: agent mógł w międzyczasie dodać zadanie, a zapis listy je nadpisze.
  const aktualne = (await czytajKv<Zadanie[]>(KLUCZ_ZADAN)) || [];
  const nowe = ustawStatusZadania(aktualne, id, status, new Date().toISOString());
  if (!nowe) { z.powiadom("Nie znalazłem tego zadania — odśwież listę."); return; }
  try { await storage.set(KLUCZ_ZADAN, JSON.stringify(nowe), true); }
  catch (e) { z.powiadom("Nie udało się zapisać zadania: " + (e as Error).message); return; }
  S.zadania = nowe;
  z.render();
}

/** Podpina przyciski zakładki i karty. Wołane z attachHandlers() po każdym rysowaniu. */
export function podepnijSbsAi(main: HTMLElement, z: Zaleznosci & { przejdzDo: (widok: string) => void; otworzZawodnika: (id: string) => void }) {
  main.querySelectorAll<HTMLElement>('[data-action="goto-sbsai"]').forEach((b) => (b.onclick = () => z.przejdzDo("sbsai")));
  main.querySelectorAll<HTMLElement>('[data-action="sbsai-odswiez"]').forEach((b) => (b.onclick = () => { zaladujSbsAi(z, true); z.render(); }));
  main.querySelectorAll<HTMLElement>('[data-action="sbsai-potwierdz"]').forEach((b) => (b.onclick = () => rozstrzygnij(z, b.dataset.id || "", "potwierdzona")));
  main.querySelectorAll<HTMLElement>('[data-action="sbsai-odrzuc"]').forEach((b) => (b.onclick = () => rozstrzygnij(z, b.dataset.id || "", "odrzucona")));
  main.querySelectorAll<HTMLElement>('[data-action="sbsai-otworz-zawodnika"]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); z.otworzZawodnika(a.dataset.id || ""); }));
  main.querySelectorAll<HTMLSelectElement>('[data-action="sbsai-status-zadania"]').forEach((s) => (s.onchange = () => zmienStatusZadania(z, s.dataset.id || "", s.value)));
}
