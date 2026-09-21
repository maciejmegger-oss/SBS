# Plakat LinkedIn — ELLITE-SPORTS

Plakat jest budowany w HTML/CSS i renderowany headless Chromium w 2x,
dzięki czemu tekst da się edytować bez pracy w edytorze graficznym.

## Render

    ./render.sh poster.html ../ellite-poster-v2-2048x3072.png 1024 1536

`render.sh` renderuje z zapasem wysokości i przycina — headless Chromium
daje viewport niższy niż `--window-size`, więc render 1:1 ucina dolny pasek.

## Pliki

- `poster.html` — layout i treść
- `inter_local.css` + `fonts/` — Inter (SIL OFL), podzbiory latin i latin-ext
  (latin-ext jest wymagany dla polskich znaków)
- `logo_knockout.png` — logo w wersji kontrowej: człon slowny na bialo,
  zloto zachowane, do ciemnych tel

## Paleta

- niebieski `#007AEA`, zloto `#C6A44E`
- tlo `#0E1823` -> `#04070A`
- margines bazowy 60 px (naglowek, stopka, pasek brandowy)
