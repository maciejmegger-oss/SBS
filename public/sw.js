// Mechanizm offline panelu mobilnego.
//
// Zadanie jest jedno: aplikacja ma się otworzyć na stadionie bez zasięgu. Nie cache'ujemy tu
// DANYCH — te trzyma sam panel w pamięci telefonu (localStorage, patrz src/mobile/db.ts) razem
// z kolejką wysyłki. Tutaj chodzi wyłącznie o pliki samej aplikacji.
//
// Nazwy plików po zbudowaniu zawierają skrót treści (app.9f3c1d.js), więc nie da się ich wypisać
// z góry. Dlatego zamiast listy zapisujemy to, co przeglądarka faktycznie pobrała, przy pierwszym
// udanym pobraniu.

const CACHE = "sbs-live-v1";

self.addEventListener("install", (e) => {
  // Panel ma działać od razu po pierwszym wejściu, bez odświeżania strony.
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/m", "/manifest.webmanifest", "/icon-192.png"]).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Zapytania do Supabase idą zawsze do sieci. Podanie odpowiedzi z cache byłoby tu szkodliwe:
  // scout zobaczyłby nieaktualne dane i nie miałby jak odróżnić ich od świeżych.
  if (url.origin !== self.location.origin) return;

  // Wejście na adres panelu: najpierw sieć (żeby wdrożona poprawka doszła od razu), a gdy jej
  // nie ma — zapisana wersja.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const kopia = res.clone();
          caches.open(CACHE).then((c) => c.put("/m", kopia));
          return res;
        })
        .catch(() => caches.match("/m").then((r) => r || caches.match(req))),
    );
    return;
  }

  // Pozostałe pliki (skrypty, style, ikony): NAJPIERW SIEĆ, zapisana kopia dopiero gdy sieci brak.
  //
  // Wcześniej było odwrotnie — kopia natychmiast, odświeżenie w tle — i to okazało się złe.
  // Wdrożona poprawka docierała dopiero przy KOLEJNYM uruchomieniu, więc scout, któremu kazano
  // odświeżyć stronę, po odświeżeniu widział dokładnie to samo, co przed. Przy zasięgu nie ma
  // powodu podawać starego pliku: cała aplikacja to kilkadziesiąt kilobajtów, a pewność, że
  // pracuje się na aktualnej wersji, jest warta więcej niż zaoszczędzone pół sekundy.
  //
  // Praca bez zasięgu nie ucierpiała: gdy sieci nie ma, zapytanie kończy się błędem i wtedy
  // sięgamy po kopię — dokładnie tak jak dotąd.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const kopia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, kopia));
        }
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
