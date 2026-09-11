// KOMUNIKATY POWOŁAŃ ZAPISANE W KODZIE — do przywrócenia kadr, które wyciął dawny błąd zapisu.
//
// Tabela sbs_talents nie miała gdzie trzymać kadry i po odświeżeniu strony powołani lądowali
// w „Poza kadrą". Samo naprawienie zapisu nie przywraca tego, co już przepadło, a wymaganie od
// skauta, żeby pamiętał o ponownym wklejeniu komunikatu, to przerzucanie na niego skutków błędu.
//
// Aplikacja przy starcie czyta te komunikaty tym samym czytnikiem co pole „Wklej tekst"
// (osobyZPowolaniaPzpn) i dopisuje kadrę tylko tam, gdzie jej brakuje. Wpisy są bezpieczne do
// pozostawienia na stałe — ale kolejnych komunikatów NIE trzeba tu dopisywać: nowe powołania
// zapisują się już poprawnie.

export type KomunikatPowolan = {
  kadra: string;
  /** Data publikacji — trafia jako data dodania, gdy powołanego trzeba dopisać od nowa. */
  data: string;
  zrodlo: string;
  tekst: string;
};

export const POWOLANIA_DO_PRZYWROCENIA: KomunikatPowolan[] = [
  {
    kadra: 'U-16',
    data: '2026-09-09',
    zrodlo: '90minut.pl — komunikat PZPN',
    tekst: `U-16: Powołania na turniej towarzyski w Niemczech

Selekcjoner reprezentacji Polski do lat 16 Piotr Klepczarek powołał 22 zawodników na zgrupowanie, które odbędzie się w dniach 26 września - 4 października we Frankfurcie. Biało-czerwoni rozegrają podczas niego turniej towarzyski, w ramach którego zmierzą się z Niemcami (28 września, 11:00), Austrią (1 października, 15:00) i Grecją (4 października, 11:30).

Kadra:

Essam Abdelhamid (PSV Eindhoven, Holandia), Antoni Balcer (Talent Warszawa), Mateusz Borowiec (Śląsk Wrocław), Antoni Chojecki (Widzew Łódź), Julian Grzegorczyk (Lech Poznań), Mateusz Jadachowski (Zagłębie Lubin), Igor Kaczor (Górnik Zabrze), Wiktor Kożuchowski (Legia Warszawa), Michał Kucała (Legia Warszawa), Karol Kupczyk (Pogoń Szczecin), Kacper Kwiatkowski (Legia Warszawa), Cyprian Lipiński (Legia Warszawa), Natan Łukasiewicz (ŁKS Łódź), Antoni Miernik (Chelsea FC, Anglia), Ksawery Słota (Piast Gliwice), David Sulewski (FC Bayern München, Niemcy), Martin Szczerbiński (Lechia Gdańsk), Aleks Szybalski (Legia Warszawa), Piotr Tobór (Górnik Zabrze), Wiktor Waloch (Legia Warszawa), Patryk Wiśniak (Pogoń Szczecin), Marcel Zdybał (Lech Poznań).`,
  },
];
