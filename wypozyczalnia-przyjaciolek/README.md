# Wypożyczalnia Przyjaciółek — strona

Statyczna strona (HTML + CSS + JS, bez budowania). Otwórz `index.html` w przeglądarce.

## Co jest na stronie
Pasek z kartami podarunkowymi, hero ze zmieniającym się hasłem („Przyjaciółka na zakupy / na koncert / …”),
przesuwający się pasek okazji, kafelki okazji, karty przyjaciółek, quiz „dobierz mi przyjaciółkę”,
3 kroki, cennik, zasady, voucher, FAQ, formularz rezerwacji + kontakt (Instagram, WhatsApp, e-mail),
przycisk „Zarezerwuj” przyklejony do dołu ekranu na telefonie.

## Co podmienić
- **Zdjęcia** w `img/` — obecne są wycięte z plakatów i służą tylko jako tymczasowe.
  Docelowo: prawdziwe zdjęcia dziewczyn, które będą chodzić na spotkania (hero ok. 1200×800, portrety ok. 600×630).
  Klientki powinny widzieć osoby, które naprawdę mogą zarezerwować.
- **Miasto**: element `data-city` w hero.
- **Kontakt**: `TWOJ_PROFIL`, `+48 000 000 000`, `kontakt@twojadomena.pl`, link `wa.me/48000000000`.
- **Formularz**: w `index.html` ustaw `action` formularza, np. `https://formspree.io/f/TWOJE_ID` — skrypt wyśle dane sam.
- **Quiz**: tabela `RESULTS` w `script.js`.
- **Kolory i fonty**: `:root` na górze `style.css`.
- **Regulamin i polityka prywatności**: linki w stopce i przy zgodzie (RODO).

## Publikacja
Dowolny hosting statyczny (Netlify, Vercel, GitHub Pages) — wystarczy wrzucić ten folder.
