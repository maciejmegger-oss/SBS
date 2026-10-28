# Dane osobowe w Scout Base System — mapa i punkty ryzyka

> **To nie jest opinia prawna.** To inwentaryzacja: co system przechowuje, o kim i gdzie.
> Dokument powstał po to, żeby prawnik od RODO nie musiał tego ustalać na Twój rachunek —
> przychodzisz do niego z gotowym materiałem i pytaniami, a nie z pytaniem „co my właściwie
> mamy?". Ocena podstawy prawnej, obowiązku DPIA i treści umów należy do prawnika.
>
> Stan na 28.10.2026, odczytany z `supabase/schema.sql` i migracji.

---

## 1. Kogo dotyczą dane

| Kategoria osób | Ile | Gdzie | Uwaga |
|---|---|---|---|
| **Zawodnicy — dorośli** | część z ~16 200 | `sbs_players` | |
| **Zawodnicy — MAŁOLETNI** | część z ~16 200 | `sbs_players` | **roczniki 2011–2014 to dzieci 12–15 lat** |
| **Kandydaci (Talent)** | ~520 | `sbs_talents` | w tym małoletni |
| **Pracownicy klubów** | ~191 | `sbs_contacts` | dorośli, dane służbowe |
| **Skauci / współpracownicy** | kilku | `sbs_observations`, `sbs_reports`, `sbs_analiza_zlecenia` | podpisani pod obserwacjami |
| **Użytkownicy systemu (klienci)** | rośnie | `sbs_konta` | podstawa: umowa |

**Najważniejsze zdanie w tym dokumencie:** znaczna część zbioru to **dane dzieci**, przetwarzane
**na dużą skalę**, zawierające **oceny wartościujące**, w celu **komercyjnym**. To jest zestaw,
przy którym przepisy są najbardziej wymagające.

---

## 2. Co dokładnie jest przechowywane

### `sbs_players` — kartoteka zawodników (zbiór główny)

| Grupa | Kolumny |
|---|---|
| Tożsamość | `first_name`, `last_name`, `birth_date`, `birth_year`, `nationality` |
| Cechy fizyczne | `height`, `foot`, `position` |
| Przynależność | `club_id`, `has_agent`, `agency_name` |
| **Wizerunek** | `photo_url` |
| **Media społecznościowe** | `instagram_link`, `facebook_link` |
| Odnośniki | `video_link`, `lnp_link`, `tm_link` |
| **Oceny i opinie** | `notes`, `committee_opinion`, `committee_decision`, `committee_notes`, `opis_koncowy`, `status` |
| **Obserwacja** | `monitored`, `kadra_wojewodzka`, `reprezentacja`, `powolania` |
| Statystyki | `matches`, `minutes`, `goals`, `assists` |
| **Nieokreślone** | `attachments` (jsonb), `custom_fields` (jsonb) |

### `sbs_observations` — obserwacje

`player_id`, `date`, `match_time`, `match`, `location`, **`scout`**, **`ratings`**,
**`recommendation`**, `notes`, **`start_location`**, **`distance_km`**

### `sbs_reports` — raporty skautingowe

`player_id`, `date`, **`scout`**, `description`, **`technika`**, **`taktyka`**, **`motoryka`**,
**`mentalnosc_opis`**, **`potencjal_opis`**, **`perspektywa`**, `phases`, `set_pieces`, `obs_type`

### `sbs_talents` — kandydaci

`first_name`, `last_name`, `birth_year`, `club`, `confidence`, **`source_image`**

### `sbs_contacts` — kontakty klubowe

`first_name`, `last_name`, `email`, `phone`, `club`, `note`

### `sbs_konta` — konta użytkowników

`user_id`, `email`, `imie_nazwisko`, `klub`, `rola_w_klubie`, `telefon`, `rola`, `status`, `uwagi`

### `sbs_zdarzenia_konta` — dziennik zdarzeń

`konto`, `email`, `kto`, `kto_email`, `rodzaj`, `opis`, `utworzone_at`

### `sbs_raport_inbox` — skrzynka raportów *(wrzesień 2026)*

`player_id`, `zawodnik`, `tytul`, **`dane` (jsonb)**, `zrodlo`, `status`

### `sbs_analiza_zlecenia` — zlecenia analiz *(wrzesień 2026)*

`player_id`, `zawodnik`, `mecz`, **`link`**, **`plik`**, `uwagi`, **`zlecil`**, **`wykonawca`**

---

## 3. Punkty ryzyka — konkretnie

**1. Oceny wartościujące dzieci.**
`committee_decision`, `status` (w tym wartość **„Odrzucony"**), `opis_koncowy`, `recommendation`,
`perspektywa`. To są dane osobowe z pełnym prawem dostępu. Trzeba liczyć się z wnioskiem rodzica:
*„proszę o wydanie wszystkiego, co macie o moim synu"* — i system musi umieć to wydać.

**2. `mentalnosc_opis` w raportach.**
Opis cech psychicznych małoletniego. Formalnie nie jest to kategoria szczególna z art. 9,
ale to najbardziej wrażliwa treść w całym zbiorze. Do przemyślenia z prawnikiem, czy i jak
ograniczyć.

**3. `attachments` i `custom_fields` — worek bez dna.**
Pola jsonb bez narzuconej struktury. Dziś trafiają tam statystyki i historia transferów, ale
technicznie **nic nie stoi na przeszkodzie, żeby ktoś wrzucił skan dokumentu, numer PESEL albo
zaświadczenie lekarskie.** Rejestr czynności musi opisywać, co tam jest — a skoro nie da się
tego zagwarantować strukturą, trzeba to zagwarantować instrukcją dla użytkowników.
**To jest najłatwiejsza do zamknięcia dziura w całym zestawieniu.**

**4. `dane` (jsonb) w skrzynce raportów.** To samo, nowe miejsce.

**5. Wizerunek małoletnich.**
`photo_url`, `source_image` w Talencie, `plik`/`link` w zleceniach analiz (materiał wideo).

**6. Dane lokalizacyjne skautów.**
`start_location`, `distance_km`, `location` — gdzie skaut był i ile przejechał. To dane osobowe
**współpracownika**, nie zawodnika. Osobna podstawa, osobna informacja.

**7. Źródło danych.**
Zawodnicy nie podają danych sami — pochodzą ze źródeł publicznych (90minut, Łączy Nas Piłka)
i z pracy skautów. To uruchamia **obowiązek informacyjny z art. 14** (dane zbierane nie od osoby,
której dotyczą), z wyjątkami do oceny przez prawnika.

**8. Powierzenie przy klientach.**
Gdy klub-klient tworzy własne obserwacje i raporty, administratorem tych danych jest klub,
a Ellite-Sports jest **podmiotem przetwarzającym**. Do każdej umowy licencyjnej musi iść
**umowa powierzenia**. **Bez niej nie można sprzedać pierwszej licencji.**

---

## 4. Czego NIE ma — i to jest dobra wiadomość

Sprawdzone w kodzie i w schemacie:

- **Brak danych o zdrowiu.** Żadnego pola o kontuzjach, badaniach, leczeniu. To kategoria
  szczególna z art. 9 — jej brak znacząco obniża poprzeczkę.
- **Brak numerów PESEL i dokumentów tożsamości.**
- **Brak danych o pochodzeniu etnicznym, wyznaniu, poglądach.** (`nationality` to obywatelstwo,
  nie pochodzenie etniczne — ale warto to z prawnikiem potwierdzić.)
- **Brak danych finansowych** zawodników.

---

## 5. Zabezpieczenia, które już działają

Do pokazania prawnikowi jako dowód „ochrony w fazie projektowania" (art. 25):

| Zabezpieczenie | Gdzie |
|---|---|
| Reguły dostępu na poziomie wiersza (RLS) na wszystkich tabelach | migracje `2026-08-11`, `2026-09-22`, `2026-09-23` |
| Rozdzielone role: administrator / skaut / klient | `sbs_konta.rola` |
| Klient widzi wyłącznie wykupione rozgrywki | `sbs_ma_lige()`, `sbs_kluby_klienta()` |
| Klient bez pakietu nie wchodzi do systemu | brama w `wpuscZalogowanego()` |
| **Brak eksportu kartoteki** — nie da się jej wynieść hurtem | brak takiej funkcji w kodzie |
| Eksport kontaktów zamknięty dla klienta | `AKCJE_BEZ_KLIENTA` |
| Kopia zapasowa bazy tylko dla administratora | `AKCJE_BEZ_KLIENTA` |
| Dziennik zdarzeń na kontach (hasła, dostęp, role, pakiety) | `sbs_zdarzenia_konta` |
| Dostęp otwiera administrator ręcznie, po weryfikacji zgłoszenia | zakładka Dostęp |

---

## 6. Pytania do prawnika

Zabierz je na spotkanie. Odpowiedzi przesądzają o treści dokumentów.

1. **Podstawa prawna** przetwarzania danych zawodników — prawnie uzasadniony interes
   (art. 6 ust. 1 lit. f)? Jak przeprowadzić i udokumentować test równowagi, skoro
   znaczna część osób to **małoletni**?
2. **Obowiązek informacyjny z art. 14** — przy ponad 16 000 osób, do których nie mamy kontaktu.
   Czy wystarczy nota informacyjna na stronie, czy potrzeba czegoś więcej?
3. **Czy DPIA jest obowiązkowa?** Przetwarzanie na dużą skalę + systematyczna obserwacja
   + ocena + dane dzieci + cel komercyjny.
4. **Zgoda rodziców** — konieczna, czy wystarczy uzasadniony interes? Jeśli konieczna, to przy
   jakim zakresie danych (wizerunek? oceny?).
5. **Umowa powierzenia** z klientem — wzór do umowy licencyjnej.
6. **Okresy retencji** — jak długo trzymać dane zawodnika, który nigdy nie został
   zarekomendowany? Dane o odrzuceniu dziecka sprzed pięciu lat?
7. **Realizacja praw** — dostęp, sprostowanie, usunięcie, sprzeciw. Czy sprzeciw zawodnika
   oznacza usunięcie go z bazy?
8. **Dane ze źródeł publicznych** — czy fakt publikacji przez PZPN/90minut wzmacnia naszą
   podstawę, a jeśli tak, to w jakim zakresie?
9. **Powierzenie poza EOG** — baza stoi w Supabase, aplikacja na Vercelu. Gdzie fizycznie są
   serwery i czy potrzebne są standardowe klauzule umowne?

---

## 7. Dokumenty do przygotowania przed sprzedażą

| Dokument | Kto robi | Status |
|---|---|---|
| Mapa danych | ten plik | **gotowe** |
| Rejestr czynności przetwarzania (art. 30) | szkic — ja, zatwierdzenie — prawnik | do zrobienia |
| Polityka prywatności na stronę | szkic — ja, zatwierdzenie — prawnik | do zrobienia |
| Ocena skutków (DPIA) | prawnik | do oceny, czy obowiązkowa |
| **Umowa powierzenia przetwarzania** | prawnik | **blokuje sprzedaż** |
| Umowa licencyjna / regulamin | prawnik | **blokuje sprzedaż** |
| Procedura realizacji praw | ja + prawnik | do zrobienia |
| Polityka retencji | prawnik | do zrobienia |

---

## 8. Co można zrobić od ręki, bez prawnika

1. **Ograniczyć `attachments`** — instrukcja w interfejsie przy wgrywaniu: „nie wgrywaj
   dokumentów tożsamości, zaświadczeń lekarskich ani danych wrażliwych". Jedno zdanie
   w widoku, a zamyka największą niewiadomą w całym zbiorze.
2. **Opisać `dane` w skrzynce raportów** — zawęzić do znanych pól albo udokumentować zawartość.
3. **Przygotować „wydruk wszystkiego o zawodniku"** — widok, który zbiera z kartoteki,
   obserwacji, raportów i Talentu wszystko o jednej osobie. Potrzebny przy wniosku o dostęp,
   a przy okazji przydatny w normalnej pracy.
4. **Ustalić retencję w praktyce** — nawet przed decyzją prawnika warto wiedzieć, ilu zawodników
   nie było ruszanych od dwóch lat.
