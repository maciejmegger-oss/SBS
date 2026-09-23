// TŁUMACZENIA STRONY PUBLICZNEJ — angielski i niemiecki.
//
// DLACZEGO OSOBNO OD src/i18n/en.ts
// Tamten słownik tłumaczy APLIKACJĘ: kilkaset krótkich napisów z przycisków i nagłówków kolumn,
// dopasowywanych frazami wewnątrz dłuższych tekstów. Strona publiczna to co innego — akapity
// marketingowe z pogrubieniami w środku zdania. Tłumaczone frazami rozpadłyby się na kawałki,
// bo w angielskim i niemieckim szyk zdania jest inny i pogrubienie wypada w innym miejscu.
//
// Dlatego tutaj tłumaczymy CAŁYMI BLOKAMI: każdy przetłumaczalny element ma w index.html
// atrybut data-i18n z krótkim identyfikatorem, a poniżej stoi jego wersja angielska i niemiecka
// wraz ze znacznikami. Dzięki temu <strong> ląduje tam, gdzie w danym języku ma prawo stać.
//
// ZASADA: nie tłumaczymy nazwy własnej systemu („Scout Base System"), nazw modułów, które są
// nazwami własnymi („Scout Transfer", „SBS Live"), adresów e-mail ani nazw polskich rozgrywek.

export interface Przeklad {
  en: string;
  de: string;
}

export const STRONA: Record<string, Przeklad> = {
  // ---- Tytuł karty i opis dla wyszukiwarek ----
  'meta-title': {
    en: 'Scout Base System — scouting software for lower-league clubs',
    de: 'Scout Base System — Scouting-Software für Vereine der unteren Ligen',
  },
  'meta-desc': {
    en: 'Scout Base System brings order to scouting work: a player and club database, an observation plan, match reports and live event logging from the stands. Access granted by the administrator.',
    de: 'Scout Base System bringt Ordnung in die Scouting-Arbeit: Spieler- und Vereinsdatenbank, Beobachtungsplan, Spielberichte und Live-Erfassung von der Tribüne. Zugang nach Freigabe durch den Administrator.',
  },

  // ---- Pasek górny ----
  'nav-dla-kogo': { en: 'Who it is for', de: 'Für wen' },
  'nav-moduly': { en: 'Modules', de: 'Module' },
  'nav-jak': { en: 'How it works', de: 'Ablauf' },
  'nav-bezpieczenstwo': { en: 'Security', de: 'Sicherheit' },
  'nav-pakiety': { en: 'Packages', de: 'Pakete' },
  'nav-kontakt': { en: 'Contact', de: 'Kontakt' },
  'cta-pakiety': { en: 'Packages', de: 'Pakete' },
  'cta-dostep': { en: 'Request access', de: 'Zugang anfragen' },
  'hero-btn-pakiety': { en: 'See the packages', de: 'Pakete ansehen' },
  'cta-zaloguj': { en: 'Sign in', de: 'Anmelden' },

  // ---- Nagłówek strony ----
  'hero-eyebrow': { en: 'Scouting system &middot; Poland', de: 'Scouting-System &middot; Polen' },
  'hero-h1': {
    en: 'Scouting that does not end in a notebook.',
    de: 'Scouting, das nicht im Notizbuch endet.',
  },
  'hero-lead': {
    en: 'Scout Base System guides the scout through the whole way: from picking a match in the fixture list, through logging events in the stands, to the report, the rating and the club’s decision. All in one place, for the whole staff, with no spreadsheets going round by e-mail.',
    de: 'Scout Base System begleitet den Scout über den gesamten Weg: von der Auswahl des Spiels im Spielplan über die Erfassung der Ereignisse auf der Tribüne bis zum Bericht, der Bewertung und der Entscheidung des Vereins. Alles an einem Ort, für den gesamten Stab, ohne Tabellen, die per E-Mail kreisen.',
  },
  'hero-btn-dostep': { en: 'Request access', de: 'Zugang anfragen' },
  'hero-btn-konto': { en: 'I already have an account — sign in', de: 'Ich habe bereits ein Konto — anmelden' },

  // ---- Dla kogo ----
  'dk-h2': { en: 'Who it is for', de: 'Für wen' },
  'dk-sub': {
    en: 'For clubs that <strong>have no scouting department of their own</strong> — and still, every transfer window, have to decide whom to sign, whom to keep and whom to let go. Scouting there happens after hours, between a few people, on private notes and photographs of team sheets. Scout Base System gives that work a structure instead of demanding full-time posts and a separate department.',
    de: 'Für Vereine, die <strong>keine eigene Scouting-Abteilung haben</strong> — und dennoch in jeder Transferperiode entscheiden müssen, wen sie holen, wen sie halten und wen sie ziehen lassen. Scouting geschieht dort nach Feierabend, zu wenigen, auf privaten Notizen und Fotos von Spielberichtsbögen. Scout Base System gibt dieser Arbeit eine Struktur, statt Planstellen und eine eigene Abteilung zu verlangen.',
  },
  'dk1-h3': { en: 'A club without a scouting department', de: 'Verein ohne Scouting-Abteilung' },
  'dk1-p': {
    en: 'No need to hire analysts or buy access to databases that simply do not exist for these divisions. The system keeps the order: whom we are watching, who is travelling to see them, what came of it and what the club did about it. The knowledge stays with the club, not in one person’s phone.',
    de: 'Es müssen weder Analysten eingestellt noch Datenbanken gekauft werden, die es für diese Ligen schlicht nicht gibt. Das System wahrt die Reihenfolge: wen wir beobachten, wer hinfährt, was dabei herauskam und was der Verein damit gemacht hat. Das Wissen bleibt im Verein und nicht im Telefon einer einzelnen Person.',
  },
  'dk2-h3': { en: 'Sporting director', de: 'Sportdirektor' },
  'dk2-p': {
    en: 'One place showing the whole market under consideration: who was watched, how many times, with what rating and at what stage the talks are. A transfer decision stops depending on who happens to speak loudest or remember best.',
    de: 'Ein Ort, an dem der gesamte betrachtete Markt sichtbar ist: wer beobachtet wurde, wie oft, mit welcher Bewertung und in welchem Stadium die Gespräche sind. Eine Transferentscheidung hängt nicht mehr davon ab, wer gerade am lautesten spricht oder sich am besten erinnert.',
  },
  'dk3-h3': { en: 'Coach and staff', de: 'Trainer und Stab' },
  'dk3-p': {
    en: 'A match report on a single template — technique, tactics, athleticism, mentality, potential — so two players can be compared instead of two impressions being set side by side. Plus the observation history: is the lad developing, or did he simply have one good game.',
    de: 'Ein Spielbericht nach einer einzigen Vorlage — Technik, Taktik, Athletik, Mentalität, Potenzial — sodass sich zwei Spieler vergleichen lassen, statt zwei Eindrücke nebeneinanderzustellen. Dazu die Beobachtungshistorie: entwickelt sich der Junge, oder hatte er nur ein gutes Spiel.',
  },
  'dk4-h3': { en: 'Scout', de: 'Scout' },
  'dk4-p': {
    en: 'A travel plan instead of random matches, event logging straight from the stands — also without signal — and a report closed the same evening rather than a week later from night-time notes.',
    de: 'Ein Reiseplan statt zufälliger Spiele, Erfassung der Ereignisse direkt von der Tribüne — auch ohne Empfang — und ein Bericht, der noch am selben Abend abgeschlossen wird statt eine Woche später aus nächtlichen Notizen.',
  },

  // ---- Moduły ----
  'mod-h2': { en: 'What is inside', de: 'Was drin ist' },
  'mod-sub': {
    en: 'Briefly about the modules. The details — screen layouts, rating sheets, indicators and data — we show after signing in, to people entitled to see them.',
    de: 'Kurz zu den Modulen. Die Einzelheiten — Bildschirmaufbau, Bewertungsbögen, Kennzahlen und Daten — zeigen wir nach der Anmeldung, und zwar Personen, die dazu berechtigt sind.',
  },
  'm1-h3': { en: 'Player database', de: 'Spielerdatenbank' },
  'm1-p': {
    en: 'Player profile: position, year of birth, club, season statistics, video material, observation history and attachments.',
    de: 'Spielerprofil: Position, Jahrgang, Verein, Saisonstatistik, Videomaterial, Beobachtungshistorie und Anhänge.',
  },
  'm2-h3': { en: 'Clubs and age groups', de: 'Vereine und Jahrgänge' },
  'm2-p': {
    en: 'Clubs split by division and group, youth teams, crests, contact details and ground addresses.',
    de: 'Vereine nach Liga und Gruppe, Jugendmannschaften, Wappen, Kontaktdaten und Adressen der Sportanlagen.',
  },
  'm3-h3': { en: 'Observation plan', de: 'Beobachtungsplan' },
  'm3-p': {
    en: 'Fixture calendar, assignment of scouts to matches, the purpose of the observation and the list of players to check.',
    de: 'Spielplan, Zuordnung der Scouts zu den Spielen, Ziel der Beobachtung und Liste der zu prüfenden Spieler.',
  },
  'm4-h3': { en: 'Reports', de: 'Berichte' },
  'm4-p': {
    en: 'A match report on a single template, with a rating, a conclusion and a recommendation. Downloadable as PDF.',
    de: 'Ein Spielbericht nach einer einzigen Vorlage, mit Bewertung, Fazit und Empfehlung. Als PDF herunterladbar.',
  },
  'm5-h3': { en: 'Monitoring and ranking', de: 'Monitoring und Ranking' },
  'm5-p': {
    en: 'Players followed over time: successive observations, changes in form, summaries and comparisons.',
    de: 'Spieler über die Zeit verfolgt: aufeinanderfolgende Beobachtungen, Formverlauf, Übersichten und Vergleiche.',
  },
  'm6-h3': { en: 'Scout Transfer', de: 'Scout Transfer' },
  'm6-p': {
    en: 'The club’s decision path: recommendation, trials, committee opinion and the status of the talks.',
    de: 'Der Entscheidungsweg des Vereins: Empfehlung, Probetraining, Votum des Gremiums und Stand der Gespräche.',
  },
  'm7-h3': { en: 'Agents and contacts', de: 'Berater und Kontakte' },
  'm7-p': {
    en: 'Agencies, players’ representatives and club contacts — at hand the moment they are needed.',
    de: 'Agenturen, Spielerberater und Vereinskontakte — zur Hand in dem Moment, in dem sie gebraucht werden.',
  },
  'm8-h3': { en: 'Live mobile panel', de: 'Mobiles Live-Panel' },
  'm8-p': {
    en: 'Event logging straight from the stands, also without signal — the data arrives once the phone is back on the network.',
    de: 'Erfassung der Ereignisse direkt von der Tribüne, auch ohne Empfang — die Daten kommen an, sobald das Telefon wieder im Netz ist.',
  },

  // ---- Jak to działa ----
  'jak-h2': { en: 'How you get into the system', de: 'Wie Sie ins System kommen' },
  'j1-h3': { en: 'Application', de: 'Anmeldung' },
  'j1-p': {
    en: 'You fill in the form at the bottom of the page: who you are, from which club and in what role. You set your own password.',
    de: 'Sie füllen das Formular am Ende der Seite aus: wer Sie sind, aus welchem Verein und in welcher Rolle. Das Passwort legen Sie selbst fest.',
  },
  'j2-h3': { en: 'Administrator’s decision', de: 'Entscheidung des Administrators' },
  'j2-p': {
    en: 'The application goes to the system administrator. Until it is approved, the account sees no data at all.',
    de: 'Die Anmeldung geht an den Systemadministrator. Bis zur Freigabe sieht das Konto keinerlei Daten.',
  },
  'j3-h3': { en: 'Signing in', de: 'Anmeldung im System' },
  'j3-p': {
    en: 'Once approved, you sign in with your e-mail address — on the computer and on the phone with the same account.',
    de: 'Nach der Freigabe melden Sie sich mit Ihrer E-Mail-Adresse an — am Computer und am Telefon mit demselben Konto.',
  },
  'j4-h3': { en: 'Work', de: 'Arbeit' },
  'j4-p': {
    en: 'You plan observations, carry them out from the phone at the ground and close them with a report visible to the staff.',
    de: 'Sie planen Beobachtungen, führen sie mit dem Telefon im Stadion durch und schließen sie mit einem Bericht ab, den der Stab einsehen kann.',
  },

  // ---- Bezpieczeństwo ----
  'bez-h2': { en: 'Data and security', de: 'Daten und Sicherheit' },
  'b1-h3': { en: 'Closed access', de: 'Geschlossener Zugang' },
  'b1-p': {
    en: 'The system has no public part. Every screen, every report and every record requires signing in on an account approved by the administrator — and the database itself enforces it, not only the page.',
    de: 'Das System hat keinen offenen Bereich. Jeder Bildschirm, jeder Bericht und jeder Datensatz erfordert die Anmeldung mit einem vom Administrator freigegebenen Konto — darüber wacht die Datenbank selbst, nicht nur die Seite.',
  },
  'b2-h3': { en: 'Passwords and sessions', de: 'Passwörter und Sitzungen' },
  'b2-p': {
    en: 'Passwords are handled by a dedicated authentication layer; we do not keep them in any table of our own. The connection is encrypted and a session can be revoked at any time.',
    de: 'Passwörter verwaltet eine spezialisierte Authentifizierungsschicht; wir speichern sie in keiner eigenen Tabelle. Die Verbindung ist verschlüsselt, und eine Sitzung lässt sich jederzeit ungültig machen.',
  },
  'b3-h3': { en: 'Player data', de: 'Spielerdaten' },
  'b3-p': {
    en: 'The system holds personal data of players, including minors. Only information needed for a sporting assessment goes into it, and a closed circle of people can see it.',
    de: 'Im System befinden sich personenbezogene Daten von Spielern, auch von Minderjährigen. Es gelangen ausschließlich Angaben hinein, die für die sportliche Beurteilung nötig sind, und nur ein geschlossener Personenkreis sieht sie.',
  },
  'b4-h3': { en: 'Withdrawing access', de: 'Entzug des Zugangs' },
  'b4-p': {
    en: 'The administrator withdraws access at any moment — the account stops seeing data immediately, without waiting for anything to expire.',
    de: 'Der Administrator entzieht den Zugang jederzeit — das Konto sieht die Daten sofort nicht mehr, ohne dass etwas ablaufen muss.',
  },

  // ---- Pakiety ----
  'pak-h2': { en: 'Packages', de: 'Pakete' },
  'pak-sub': {
    en: 'One package is one competition. You take as many as you need — <strong>access adds up</strong>. Each package gives you all the data of those competitions: clubs, players, statistics, and the whole working panel: observations, reports and ratings.',
    de: 'Ein Paket ist ein Wettbewerb. Sie nehmen so viele, wie Sie brauchen — <strong>die Zugänge summieren sich</strong>. Jedes Paket enthält sämtliche Daten dieser Wettbewerbe: Vereine, Spieler, Statistiken und das gesamte Arbeitspanel: Beobachtungen, Berichte und Bewertungen.',
  },
  'pk1-h3': { en: 'Ekstraklasa', de: 'Ekstraklasa' },
  'pk1-p': {
    en: 'Clubs, players and statistics of the top division.',
    de: 'Vereine, Spieler und Statistiken der höchsten Spielklasse.',
  },
  'pk2-h3': { en: 'I liga', de: 'I liga' },
  'pk2-p': { en: 'Full data of the second tier.', de: 'Vollständige Daten der zweiten Spielklasse.' },
  'pk3-h3': { en: 'II liga', de: 'II liga' },
  'pk3-p': { en: 'Full data of the third tier.', de: 'Vollständige Daten der dritten Spielklasse.' },
  'pk4-h3': { en: 'III liga', de: 'III liga' },
  'pk4-p': {
    en: 'All four groups of the fourth tier — where the real market begins.',
    de: 'Alle vier Gruppen der vierten Spielklasse — dort beginnt der eigentliche Markt.',
  },
  'pk5-h3': { en: 'IV liga', de: 'IV liga' },
  'pk5-p': {
    en: 'Every regional group. Data no commercial service carries.',
    de: 'Sämtliche Regionalgruppen. Daten, die kein kommerzieller Anbieter führt.',
  },
  'pk6-h3': { en: 'Youth competitions', de: 'Nachwuchswettbewerbe' },
  'pk6-p': {
    en: 'The Central Youth League and the remaining youth competitions.',
    de: 'Die Zentrale Juniorenliga und die übrigen Nachwuchswettbewerbe.',
  },
  'pk7-h3': { en: 'Premium', de: 'Premium' },
  'pk7-p': {
    en: '<strong>Every competition at once</strong> — from the top division to the youth categories, with nothing to pick and nothing to add later. One access to the whole database.',
    de: '<strong>Alle Wettbewerbe auf einmal</strong> — von der höchsten Spielklasse bis zu den Nachwuchsklassen, ohne Auswahl und ohne späteres Nachbuchen. Ein Zugang zur gesamten Datenbank.',
  },
  'pak-wstega': { en: 'Widest access', de: 'Breitester Zugang' },
  'pakiet-btn': { en: 'Request access', de: 'Zugang anfragen' },
  'pakiet-btn-premium': { en: 'Request Premium access', de: 'Premium-Zugang anfragen' },
  'pak-cena': {
    en: 'Prices exclude VAT and cover one account. Each additional account in the organisation — 40% of the package price. '
      + 'Packages add up, and access is opened by the administrator after reviewing your request. '
      + 'On renewal we keep your existing price.',
    de: 'Preise zzgl. MwSt. und für ein Konto. Jedes weitere Konto in der Organisation — 40% des Paketpreises. '
      + 'Pakete summieren sich, und den Zugang öffnet der Administrator nach Prüfung der Anfrage. '
      + 'Bei der Verlängerung behalten Sie Ihren bisherigen Preis.',
  },
  'pakiet-wybrany': { en: 'Selected package:', de: 'Gewähltes Paket:' },

  // ---- Formularz ----
  'form-h2': { en: 'Request access', de: 'Zugang anfragen' },
  'form-intro': {
    en: 'The form creates an account with the status <strong>awaiting approval</strong>. The system administrator reviews the application and makes a decision. Until then, signing in shows no data.',
    de: 'Das Formular legt ein Konto mit dem Status <strong>wartet auf Freigabe</strong> an. Der Systemadministrator prüft die Anmeldung und entscheidet. Bis dahin zeigt die Anmeldung keine Daten.',
  },
  'form-maszkonto': {
    en: 'Already have an account and simply want to get in? <a href="/app">Go to sign-in</a>.',
    de: 'Sie haben bereits ein Konto und wollen einfach hinein? <a href="/app">Zur Anmeldung</a>.',
  },
  'f-imie': { en: 'Full name', de: 'Vor- und Nachname' },
  'f-klub': { en: 'Club / organisation', de: 'Verein / Organisation' },
  'f-rola': { en: 'Role at the club', de: 'Rolle im Verein' },
  'f-rola-ph': { en: 'e.g. scout, coach, sporting director', de: 'z. B. Scout, Trainer, Sportdirektor' },
  'f-telefon': { en: 'Phone', de: 'Telefon' },
  'f-email': { en: 'E-mail address', de: 'E-Mail-Adresse' },
  'f-haslo': { en: 'Password', de: 'Passwort' },
  'oko-pokaz': { en: 'Show password', de: 'Passwort anzeigen' },
  'oko-ukryj': { en: 'Hide password', de: 'Passwort verbergen' },
  'f-haslo2': { en: 'Repeat password', de: 'Passwort wiederholen' },
  'f-haslo2-hint': {
    en: 'Both fields must match.',
    de: 'Beide Felder müssen übereinstimmen.',
  },
  'f-haslo-hint': {
    en: 'At least 8 characters. You set it yourself — nobody else will see it.',
    de: 'Mindestens 8 Zeichen. Sie legen es selbst fest — niemand sonst sieht es.',
  },
  'f-zgoda': {
    en: 'I agree to my contact details being processed in order to consider this application and to maintain an account in the system.',
    de: 'Ich stimme der Verarbeitung meiner Kontaktdaten zur Prüfung dieser Anmeldung und zur Führung eines Kontos im System zu.',
  },
  'f-wyslij': { en: 'Send application', de: 'Anmeldung senden' },

  // ---- Stopka ----
  'foot-kontakt': { en: 'Contact', de: 'Kontakt' },
  'foot-system': { en: 'System', de: 'System' },
  'foot-logowanie': { en: 'Sign in to the system', de: 'Anmeldung im System' },
  'foot-mobilny': { en: 'Mobile panel (SBS Live)', de: 'Mobiles Panel (SBS Live)' },
  'foot-zgloszenie': { en: 'Access application', de: 'Zugangsanfrage' },
  'foot-legal': {
    en: 'Scout Base System. Access to the system is restricted to users approved by the administrator.',
    de: 'Scout Base System. Der Zugang zum System ist auf vom Administrator freigegebene Nutzer beschränkt.',
  },
};
