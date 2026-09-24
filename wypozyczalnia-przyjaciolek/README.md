# Wypożyczalnia Przyjaciółek — szablon strony

Statyczna strona (HTML + CSS + JS, bez budowania). Otwórz `index.html` w przeglądarce.

## Co podmienić
- **Zdjęcia**: bloki `<div class="ph ...">` zamień na `<img src="img/....jpg" alt="...">` (hero 4:5, przyjaciółki 1:1).
- **Miasto**: tekst w elementach `data-city`.
- **Kontakt**: `kontakt@twojadomena.pl`, `+48 000 000 000`, linki `TWOJ_PROFIL` (Instagram, Facebook, TikTok).
- **Formularz**: w `index.html` ustaw `action` formularza np. na `https://formspree.io/f/TWOJE_ID` — skrypt wyśle dane sam.
- **Kolory i fonty**: `:root` na górze `style.css`.
- **Regulamin i polityka prywatności**: linki w stopce (wymagane przy zbieraniu danych — RODO).

## Publikacja
Dowolny hosting statyczny (Netlify, Vercel, GitHub Pages) — wystarczy wrzucić ten folder.
