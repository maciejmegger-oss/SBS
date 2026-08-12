import "./style.css";
import { storage } from "./data/storage";
import { currentUser, signIn, signOut, requestPasswordReset, setNewPassword, isPasswordRecoveryLink,
         mojeKonto, listaKont, ustawStatusKonta, ustawRoleKonta, tokenSesji } from "./data/auth";
import { VOIVODESHIP_PATHS } from "./data/voivodeships";
import type { Database } from "./types";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// DOM helpers for type safety
const el = (sel: string) => document.querySelector(sel) as HTMLElement;
const inp = (sel: string) => document.querySelector(sel) as HTMLInputElement;
const btn = (sel: string) => document.querySelector(sel) as HTMLButtonElement;
const div = (sel: string) => document.querySelector(sel) as HTMLDivElement;
const sel_el = (sel: string) => document.querySelector(sel) as HTMLSelectElement;

const RATING_KEYS = ["technika","taktyka","motoryka","mentalnosc","potencjal"];
const RATING_LABELS = {technika:"Technika",taktyka:"Taktyka",motoryka:"Motoryka",mentalnosc:"Mentalność",potencjal:"Potencjał"};
const STATUS_CLASS = {"Nowy typ":"new","W obserwacji":"watching","Rekomendowany":"reco","Na testach":"trial","Podpisany":"signed","Odrzucony":"rejected","Wstrzymany":"hold","Do Obserwacji":"watching","Na Testy":"trial","Do transferu":"signed","Z polecenia":"reco"};
const FORMATIONS = ["1-4-4-2","1-4-3-3","1-3-4-3","1-3-5-2","1-4-5-1","1-5-4-1","1-4-2-3-1"];

let currentScout = "";
let customTabNames = [];

let DB: Database = { players: [], clubs: [], observations: [], reports: [], talents: [], contacts: [], matches: [], agencies: [], agents: [], agencyLogos: {}, clubCrests: {}, settings: null };
let currentView = "dashboard";
let editingPlayerId = null;
let editingReportId = null;
let obsPreselectPlayerId = null;
let editingObsId = null;
let promotingTalentId = null; // gdy ustawione, zapis nowego zawodnika usuwa też odpowiadający wpis z Talentu
let talentPasteText = '';   // treść wklejona w Talent -> "Wklej tekst" (zachowana między re-renderami)
let talentPasteParsed = null; // wynik rozpoznania (null = jeszcze nie kliknięto "Rozpoznaj")
let monitoringSearchQuery = ''; // wyszukiwarka słów w zakładce Monitoring
let viewingPlayerId = null;
let viewingClubId = null;
let viewingRocznikGroup = null;
let rankingLeague = null;
let rankingFormationFilter = ''; // '' = wszystkie systemy; inaczej jedna z wartości FORMATIONS
let positionMapAssignments = {}; // { "league|||number": [playerId, ...] up to 6 }
let editingClubId = null;
let clubBrowse = {top:"", group:""};
let dashboardLeagueSelected = null;
let dashboardGroupSelected = null; // wybrana grupa (np. "III liga, gr. II") po rozwinięciu ligi z grupami

const DEFAULT_SETTINGS = {
  regions: ["Dolnośląski ZPN","Kujawsko-Pomorski ZPN","Lubelski ZPN","Lubuski ZPN","Łódzki ZPN","Małopolski ZPN","Mazowiecki ZPN","Opolski ZPN","Podkarpacki ZPN","Podlaski ZPN","Pomorski ZPN","Śląski ZPN","Świętokrzyski ZPN","Warmińsko-Mazurski ZPN","Wielkopolski ZPN","Zachodniopomorski ZPN"],
  leagues: ["Ekstraklasa","I liga","II liga","III liga, gr. I","III liga, gr. II","III liga, gr. III","III liga, gr. IV","IV liga (pomorska)","IV liga (zachodniopomorska)","IV liga (dolnośląska)","IV liga (śląska)","IV liga (wielkopolska)","IV liga (kujawsko-pomorska)","IV liga (łódzka)","Klasa okręgowa","CLJ U19","CLJ U17 (zachodnia)","CLJ U17 (wschodnia)","Liga makroregionalna U16","Rocznik 2011","Rocznik 2012","Rocznik 2013","Rocznik 2014"],
  positions: ["Bramkarz","Obrońca prawy","Obrońca lewy","Obrońca środkowy","Obrońca środkowy prawy","Obrońca środkowy centralny","Obrońca środkowy lewy","Obrońca boczny","Wahadłowy prawy","Wahadłowy lewy","Pomocnik defensywny","Pomocnik środkowy","Pomocnik ofensywny","Skrzydłowy","Skrzydłowy prawy","Skrzydłowy lewy","Napastnik"],
  statuses: ["Do Obserwacji","Na Testy","Do transferu","Z polecenia","Rekomendowany","Odrzucony"],
  recommendations: ["Kontynuować obserwację","Zaprosić na testy","(Do transferu)","Odrzucić","Zbyt wcześnie ocenić"],
  scouts: [],
  customFields: [],
  sponsors: []
};
const TOP_LEVELS = ["Ekstraklasa","I liga","II liga","III liga","IV liga","Klasa okręgowa","Kategorie juniorskie"];
function topLevelOf(league){
  if(!league) return "Nieprzypisane";
  if(league.startsWith("III liga")) return "III liga";
  if(league.startsWith("IV liga")) return "IV liga";
  if(league==="II liga") return "II liga";
  if(league==="I liga") return "I liga";
  if(league==="Ekstraklasa") return "Ekstraklasa";
  if(league==="Klasa okręgowa") return "Klasa okręgowa";
  return "Kategorie juniorskie";
}
function groupsForTop(top){
  const settings = DB.settings as any;
  if(top==="III liga") return settings.leagues.filter((l:any)=>l.startsWith("III liga, gr."));
  if(top==="IV liga") return settings.leagues.filter((l:any)=>l.startsWith("IV liga ("));
  if(top==="Kategorie juniorskie") return settings.leagues.filter((l:any)=>topLevelOf(l)==="Kategorie juniorskie");
  return [];
}
const SEED_CLUBS_III_LIGA_GR1 = [
  {name:"Olimpia Elbląg", region:"Warmińsko-Mazurski ZPN", city:"Elbląg"},
  {name:"Polonia Lidzbark Warmiński", region:"Warmińsko-Mazurski ZPN", city:"Lidzbark Warmiński"},
  {name:"Olimpia Zambrów", region:"Podlaski ZPN", city:"Zambrów"},
  {name:"Widzew II Łódź", region:"Łódzki ZPN", city:"Łódź"},
  {name:"Mazovia Mińsk Mazowiecki", region:"Mazowiecki ZPN", city:"Mińsk Mazowiecki"},
  {name:"Wigry Suwałki", region:"Podlaski ZPN", city:"Suwałki"},
  {name:"Warta Sieradz", region:"Łódzki ZPN", city:"Sieradz"},
  {name:"Pelikan Łowicz", region:"Łódzki ZPN", city:"Łowicz"},
  {name:"KTS Weszło Warszawa", region:"Mazowiecki ZPN", city:"Warszawa"},
  {name:"Lechia Tomaszów Mazowiecki", region:"Łódzki ZPN", city:"Tomaszów Mazowiecki"},
  {name:"ŁKS Łomża", region:"Podlaski ZPN", city:"Łomża"},
  {name:"Mławianka Mława", region:"Mazowiecki ZPN", city:"Mława"},
  {name:"ŁKS II Łódź", region:"Łódzki ZPN", city:"Łódź"},
  {name:"Jagiellonia II Białystok", region:"Podlaski ZPN", city:"Białystok"},
  {name:"KS CK Troszyn", region:"Mazowiecki ZPN", city:"Troszyn"},
  {name:"Ząbkovia Ząbki", region:"Mazowiecki ZPN", city:"Ząbki"},
  {name:"Świt Nowy Dwór Mazowiecki", region:"Mazowiecki ZPN", city:"Nowy Dwór Mazowiecki"},
  {name:"Wisła II Płock", region:"Mazowiecki ZPN", city:"Płock"}
].map(c=>Object.assign({id:uid('K'), league:"III liga, gr. I", season:"2026/2027", crestUrl:"", juniorCategories:"", profileLnp:"", profileTm:""}, c));

const SEED_CLUBS_II_LIGA = [
  {name:"GKS Tychy", region:"Śląski ZPN", city:"Tychy", klubId:82, crestUrl:"https://gkstychy.info/wp-content/uploads/2019/11/GKS-Tychy-HERB-1.png"},
  {name:"Górnik Łęczna", region:"Lubelski ZPN", city:"Łęczna", klubId:93, crestUrl:"https://www.gornik.leczna.pl/wp-content/uploads/2020/01/herb_naglowek.png"},
  {name:"Znicz Pruszków", region:"Mazowiecki ZPN", city:"Pruszków", klubId:448},
  {name:"Chojniczanka Chojnice", region:"Pomorski ZPN", city:"Chojnice", klubId:42},
  {name:"Hutnik Kraków", region:"Małopolski ZPN", city:"Kraków", klubId:121},
  {name:"Olimpia Grudziądz", region:"Kujawsko-Pomorski ZPN", city:"Grudziądz", klubId:1302},
  {name:"Podhale Nowy Targ", region:"Małopolski ZPN", city:"Nowy Targ", klubId:14382},
  {name:"Rekord Bielsko-Biała", region:"Śląski ZPN", city:"Bielsko-Biała", klubId:3707},
  {name:"Resovia", region:"Podkarpacki ZPN", city:"Rzeszów", klubId:331},
  {name:"Sandecja Nowy Sącz", region:"Małopolski ZPN", city:"Nowy Sącz", klubId:343},
  {name:"Sokół Kleczew", region:"Wielkopolski ZPN", city:"Kleczew", klubId:1576},
  {name:"Stal Stalowa Wola", region:"Podkarpacki ZPN", city:"Stalowa Wola", klubId:373},
  {name:"Śląsk II Wrocław", region:"Dolnośląski ZPN", city:"Wrocław", klubId:1672},
  {name:"Świt Szczecin", region:"Zachodniopomorski ZPN", city:"Szczecin", klubId:26775},
  {name:"Legia II Warszawa", region:"Mazowiecki ZPN", city:"Warszawa", klubId:782},
  {name:"Zawisza Bydgoszcz", region:"Kujawsko-Pomorski ZPN", city:"Bydgoszcz", klubId:444},
  {name:"Avia Świdnik", region:"Lubelski ZPN", city:"Świdnik", klubId:12},
  {name:"Lechia Zielona Góra", region:"Lubuski ZPN", city:"Zielona Góra", klubId:168}
].map(c=>Object.assign({
    id:uid('K'), league:"II liga", season:"2026/2027", crestUrl:"", juniorCategories:"", profileTm:"",
    profileLnp:`http://www.90minut.pl/skarb.php?id_klub=${c.klubId}&id_sezon=109`
  }, {name:c.name, region:c.region, city:c.city, crestUrl:c.crestUrl}));

const SEED_CLUBS_III_LIGA_GR2 = [
  {name:"Flota Świnoujście", region:"Zachodniopomorski ZPN", city:"Świnoujście", klubId:73},
  {name:"Kotwica Kórnik", region:"Wielkopolski ZPN", city:"Kórnik", klubId:150},
  {name:"Bałtyk Koszalin", region:"Zachodniopomorski ZPN", city:"Koszalin", klubId:2393},
  {name:"Victoria Września", region:"Wielkopolski ZPN", city:"Września", klubId:1753},
  {name:"Chemik Bydgoszcz", region:"Kujawsko-Pomorski ZPN", city:"Bydgoszcz", klubId:38},
  {name:"Błękitni Stargard", region:"Zachodniopomorski ZPN", city:"Stargard", klubId:21170},
  {name:"Lipno Stęszew", region:"Wielkopolski ZPN", city:"Stęszew", klubId:6795},
  {name:"Gedania Gdańsk", region:"Pomorski ZPN", city:"Gdańsk", klubId:953},
  {name:"Grom Nowy Staw", region:"Pomorski ZPN", city:"Nowy Staw", klubId:4773},
  {name:"Unia Swarzędz", region:"Wielkopolski ZPN", city:"Swarzędz", klubId:404},
  {name:"Noteć Czarnków", region:"Wielkopolski ZPN", city:"Czarnków", klubId:237},
  {name:"Elana Toruń", region:"Kujawsko-Pomorski ZPN", city:"Toruń", klubId:67},
  {name:"Wda Świecie", region:"Kujawsko-Pomorski ZPN", city:"Świecie", klubId:417},
  {name:"Kluczevia Stargard", region:"Zachodniopomorski ZPN", city:"Stargard", klubId:19798},
  {name:"Lech II Poznań", region:"Wielkopolski ZPN", city:"Poznań", klubId:1133},
  {name:"Polonia Środa Wielkopolska", region:"Wielkopolski ZPN", city:"Środa Wielkopolska", klubId:1474},
  {name:"Wikęd Luzino", region:"Pomorski ZPN", city:"Luzino", klubId:25712},
  {name:"KKS 1925 Kalisz", region:"Wielkopolski ZPN", city:"Kalisz", klubId:10574}
].map(c=>Object.assign({
    id:uid('K'), league:"III liga, gr. II", season:"2026/2027", crestUrl:"", juniorCategories:"", profileTm:"",
    profileLnp:`http://www.90minut.pl/skarb.php?id_klub=${c.klubId}&id_sezon=109`
  }, {name:c.name, region:c.region, city:c.city}));

const SEED_CLUBS_III_LIGA_GR3 = [
  {name:"Karkonosze Jelenia Góra", region:"Dolnośląski ZPN", city:"Jelenia Góra", klubId:140},
  {name:"ROW 1964 Rybnik", region:"Śląski ZPN", city:"Rybnik", klubId:18912},
  {name:"Carina Gubin", region:"Lubuski ZPN", city:"Gubin", klubId:5741},
  {name:"Barycz Sułów", region:"Dolnośląski ZPN", city:"Sułów", klubId:3552},
  {name:"Górnik Polkowice", region:"Dolnośląski ZPN", city:"Polkowice", klubId:95},
  {name:"Odra Bytom Odrzański", region:"Lubuski ZPN", city:"Bytom Odrzański", klubId:5063},
  // Nazwy zgodne z tym, co jest w bazie po scaleniu duplikatów — inaczej lista startowa
  // wstawiałaby drugi wariant tej samej drużyny („Zagłębie II Lubin" obok „Zagłębie Lubin II").
  {name:"Zagłębie Lubin II", region:"Dolnośląski ZPN", city:"Lubin", klubId:1830},
  {name:"Stilon Gorzów", region:"Lubuski ZPN", city:"Gorzów Wielkopolski", klubId:15203},
  {name:"Stal Brzeg", region:"Opolski ZPN", city:"Brzeg", klubId:12983},
  {name:"Goczałkowice-Zdrój", region:"Śląski ZPN", city:"Goczałkowice-Zdrój", klubId:3932},
  {name:"Ślęza Wrocław", region:"Dolnośląski ZPN", city:"Wrocław", klubId:391},
  {name:"Sparta Katowice", region:"Śląski ZPN", city:"Katowice", klubId:4018},
  // Skra Częstochowa i Słowianin Wolibórz NIE grają w tej grupie — usunięte z listy startowej,
  // bo wracały przy każdym uruchomieniu mimo kasowania. Zastąpione właściwymi drużynami.
  // Sparta Katowice i Raków Częstochowa II zostają: obie widnieją w tabeli grupy III
  // na Transfermarkcie, a lista ma się z nią zgadzać co do klubu (18 drużyn).
  {name:"Polonia Nysa", region:"Opolski ZPN", city:"Nysa", klubId:1567},
  {name:"Raków Częstochowa II", region:"Śląski ZPN", city:"Częstochowa", klubId:7684},
  {name:"MKS Kluczbork", region:"Opolski ZPN", city:"Kluczbork", klubId:6607},
  {name:"Miedź II Legnica", region:"Dolnośląski ZPN", city:"Legnica", klubId:3397},
  {name:"Warta Gorzów Wielkopolski", region:"Lubuski ZPN", city:"Gorzów Wielkopolski", klubId:12994},
  {name:"Zagłębie Sosnowiec", region:"Śląski ZPN", city:"Sosnowiec", klubId:440}
].map(c=>Object.assign({
    id:uid('K'), league:"III liga, gr. III", season:"2026/2027", crestUrl:"", juniorCategories:"", profileTm:"",
    profileLnp:`http://www.90minut.pl/skarb.php?id_klub=${c.klubId}&id_sezon=109`
  }, {name:c.name, region:c.region, city:c.city}));

const SEED_CLUBS_III_LIGA_GR4 = [
  {name:"Pogoń-Sokół Lubaczów", region:"Podkarpacki ZPN", city:"Lubaczów", klubId:6744},
  {name:"Moravia Morawica", region:"Świętokrzyski ZPN", city:"Morawica", klubId:4064},
  {name:"Naprzód Jędrzejów", region:"Świętokrzyski ZPN", city:"Jędrzejów", klubId:233},
  {name:"Wisła II Kraków", region:"Małopolski ZPN", city:"Kraków", klubId:1797},
  {name:"KSZO 1929 Ostrowiec Świętokrzyski", region:"Świętokrzyski ZPN", city:"Ostrowiec Świętokrzyski", klubId:15270},
  {name:"Hetman Zamość", region:"Lubelski ZPN", city:"Zamość", klubId:119},
  {name:"Czarni Połaniec", region:"Świętokrzyski ZPN", city:"Połaniec", klubId:911},
  {name:"AKS 1947 Busko Zdrój", region:"Świętokrzyski ZPN", city:"Busko-Zdrój", klubId:23163},
  {name:"JKS Jarosław", region:"Podkarpacki ZPN", city:"Jarosław", klubId:23158},
  {name:"Sokół Kolbuszowa Dolna", region:"Podkarpacki ZPN", city:"Kolbuszowa Dolna", klubId:7270},
  {name:"Wisłoka Dębica", region:"Podkarpacki ZPN", city:"Dębica", klubId:427},
  {name:"Wieczysta II Kraków", region:"Małopolski ZPN", city:"Kraków", klubId:23244},
  {name:"Siarka Tarnobrzeg", region:"Podkarpacki ZPN", city:"Tarnobrzeg", klubId:347},
  {name:"Podlasie Biała Podlaska", region:"Lubelski ZPN", city:"Biała Podlaska", klubId:6097},
  {name:"Star Starachowice", region:"Świętokrzyski ZPN", city:"Starachowice", klubId:377},
  {name:"Korona II Kielce", region:"Świętokrzyski ZPN", city:"Kielce", klubId:6366},
  {name:"Wiślanie Skawina", region:"Małopolski ZPN", city:"Skawina", klubId:26781},
  {name:"Chełmianka Chełm", region:"Lubelski ZPN", city:"Chełm", klubId:880}
].map(c=>Object.assign({
    id:uid('K'), league:"III liga, gr. IV", season:"2026/2027", crestUrl:"", juniorCategories:"", profileTm:"",
    profileLnp:`http://www.90minut.pl/skarb.php?id_klub=${c.klubId}&id_sezon=109`
  }, {name:c.name, region:c.region, city:c.city}));

const SEED_CLUBS_IV_POMORSKA = [
  {name:"Radunia Stężyca", city:"Stężyca", klubId:1509},
  {name:"Anioły Garczegorze", city:"Garczegorze", klubId:11862},
  {name:"Gryf Słupsk", city:"Słupsk", klubId:109},
  {name:"Dolina Speranda Niepoględzie", city:"Niepoględzie", klubId:25236},
  {name:"Powiśle Dzierzgoń", city:"Dzierzgoń", klubId:322},
  {name:"Chojniczanka II Chojnice", city:"Chojnice", klubId:3777},
  {name:"Sparta Sycewice", city:"Sycewice", klubId:1613},
  {name:"Stoczniowiec Gdańsk", city:"Gdańsk", klubId:382},
  {name:"Stolem Gniewino", city:"Gniewino", klubId:384},
  {name:"KP Starogard Gdański", city:"Starogard Gdański", klubId:12827},
  {name:"Wierzyca Pelplin", city:"Pelplin", klubId:1790},
  {name:"Jaguar Gdańsk", city:"Gdańsk", klubId:23355},
  {name:"Pogoń Lębork", city:"Lębork", klubId:288},
  {name:"Arka II Gdynia", city:"Gdynia", klubId:3753},
  {name:"Czarni Pruszcz Gdański", city:"Pruszcz Gdański", klubId:912},
  {name:"Sokół Bożepole Wielkie", city:"Bożepole Wielkie", klubId:4861},
  {name:"Cartusia Kartuzy", city:"Kartuzy", klubId:871},
  {name:"Gryf Wejherowo", city:"Wejherowo", klubId:765}
].map(c=>Object.assign({
    id:uid('K'), region:"Pomorski ZPN", league:"IV liga (pomorska)", season:"2026/2027",
    crestUrl:"", juniorCategories:"", profileTm:"",
    profileLnp:`http://www.90minut.pl/skarb.php?id_klub=${c.klubId}&id_sezon=109`
  }, {name:c.name, city:c.city}));

const SEED_CLUBS_IV_ZACHODNIOPOMORSKA = [
  {name:"Orzeł Wałcz", city:"Wałcz", klubId:9883},
  {name:"Pogoń II Szczecin", city:"Szczecin", klubId:1427},
  {name:"Astra Ustronie Morskie", city:"Ustronie Morskie", klubId:4891},
  {name:"Świt II Szczecin", city:"Szczecin", klubId:26776},
  {name:"Iskierka Śmierdnica", city:"Szczecin", klubId:5852},
  {name:"CRS Barlinek", city:"Barlinek", klubId:18960},
  {name:"GKS Manowo", city:"Manowo", klubId:17703},
  {name:"MKS Kotwica Kołobrzeg", city:"Kołobrzeg", klubId:27579},
  {name:"Sparta Gryfice", city:"Gryfice", klubId:5107},
  {name:"Chemik Police", city:"Police", klubId:40},
  {name:"Dąb Dębno", city:"Dębno", klubId:59},
  {name:"Arkonia Szczecin", city:"Szczecin", klubId:811},
  {name:"Ina Ińsko", city:"Ińsko", klubId:5844},
  {name:"Wybrzeże Rewalskie Rewal", city:"Rewal", klubId:1896},
  {name:"Gwardia Koszalin", city:"Koszalin", klubId:111},
  {name:"Biali Sądów", city:"Sądów", klubId:15970}
].map(c=>Object.assign({
    id:uid('K'), region:"Zachodniopomorski ZPN", league:"IV liga (zachodniopomorska)", season:"2026/2027",
    crestUrl:"", juniorCategories:"", profileTm:"",
    profileLnp:`http://www.90minut.pl/skarb.php?id_klub=${c.klubId}&id_sezon=109`
  }, {name:c.name, city:c.city}));

const SEED_CLUBS_IV_DOLNOSLASKA = [
  {name:"WKS Wierzbice", city:"Wierzbice", klubId:8677},
  {name:"GKS Raciborowice", city:"Raciborowice", klubId:962},
  {name:"Odra Ścinawa", city:"Ścinawa", klubId:1294},
  {name:"Polonia-Stal Świdnica", city:"Świdnica", klubId:18267},
  {name:"Polonia Bielany Wrocławskie", city:"Bielany Wrocławskie", klubId:8717},
  {name:"Błyskawica Gać", city:"Gać", klubId:846},
  {name:"AKS Strzegom", city:"Strzegom", klubId:802},
  {name:"Moto Jelcz Oława", city:"Jelcz-Laskowice", klubId:225},
  {name:"Chrobry II Głogów", city:"Głogów", klubId:883},
  {name:"Górnik Złotoryja", city:"Złotoryja", klubId:986},
  {name:"Lechia Dzierżoniów", city:"Dzierżoniów", klubId:164},
  {name:"Polonia Środa Śląska", city:"Środa Śląska", klubId:1473},
  {name:"Orzeł Ząbkowice Śląskie", city:"Ząbkowice Śląskie", klubId:263},
  {name:"Prochowiczanka Prochowice", city:"Prochowice", klubId:1490},
  {name:"Piast Śmigród", city:"Śmigród", klubId:1399},
  {name:"Iskra Księginice", city:"Księginice", klubId:3351},
  {name:"Piast Nowa Ruda", city:"Nowa Ruda", klubId:276},
  {name:"GKS Mirków/Długołęka", city:"Długołęka", klubId:1240}
].map(c=>Object.assign({
    id:uid('K'), region:"Dolnośląski ZPN", league:"IV liga (dolnośląska)", season:"2026/2027",
    crestUrl:"", juniorCategories:"", profileTm:"",
    profileLnp:`http://www.90minut.pl/skarb.php?id_klub=${c.klubId}&id_sezon=109`
  }, {name:c.name, city:c.city}));

const SEED_CLUBS_IV_SLASKA = [
  {name:"Unia Turza Śląska", city:"Turza Śląska", klubId:5033},
  {name:"Rozwój Katowice", city:"Katowice", klubId:339},
  {name:"Victoria Częstochowa", city:"Częstochowa", klubId:1742},
  {name:"Polonia Łaziska Górne", city:"Łaziska Górne", klubId:1462},
  {name:"Kuźnia Ustroń", city:"Ustroń", klubId:163},
  {name:"Podbeskidzie II Bielsko-Biała", city:"Bielsko-Biała", klubId:6092},
  {name:"Ruch Radzionków", city:"Radzionków", klubId:341},
  {name:"MRKS Czechowice-Dziedzice", city:"Czechowice-Dziedzice", klubId:9839},
  {name:"Podlesianka Katowice", city:"Katowice", klubId:176},
  {name:"Przemsza Siewierz", city:"Siewierz", klubId:1501},
  {name:"Drama Zbrosławice", city:"Zbrosławice", klubId:3643},
  {name:"Piast II Gliwice", city:"Gliwice", klubId:3968},
  {name:"Gwarek Tarnowskie Góry", city:"Tarnowskie Góry", klubId:115},
  {name:"Ruch II Chorzów", city:"Chorzów", klubId:1532},
  {name:"LKS Bełk", city:"Bełk", klubId:3989},
  {name:"Raków II Częstochowa", city:"Częstochowa", klubId:1512},
  {name:"Szombierki Bytom", city:"Bytom", klubId:388},
  {name:"Spójnia Landek", city:"Landek", klubId:3889}
].map(c=>Object.assign({
    id:uid('K'), region:"Śląski ZPN", league:"IV liga (śląska)", season:"2026/2027",
    crestUrl:"", juniorCategories:"", profileTm:"",
    profileLnp:`http://www.90minut.pl/skarb.php?id_klub=${c.klubId}&id_sezon=109`
  }, {name:c.name, city:c.city}));

const SEED_CLUBS_IV_WIELKOPOLSKA = [
  {name:"Huragan Pobiedziska", city:"Pobiedziska", klubId:1026},
  {name:"Obra Kościan", city:"Kościan", klubId:239},
  {name:"Warta Śrem", city:"Śrem", klubId:415},
  {name:"Górnik Konin", city:"Konin", klubId:91},
  {name:"Meblorz Swarzędz", city:"Swarzędz", klubId:17050},
  {name:"Astra Krotoszyn", city:"Krotoszyn", klubId:8},
  {name:"Avia Kamionki", city:"Kamionki", klubId:15496},
  {name:"Ostrovia 1909 Ostrów Wielkopolski", city:"Ostrów Wielkopolski", klubId:16656},
  {name:"Kłos Budzyń", city:"Budzyń", klubId:1077},
  {name:"Pogoń Nowe Skalmierzyce", city:"Nowe Skalmierzyce", klubId:290},
  {name:"Polonia Chodzież", city:"Chodzież", klubId:307},
  {name:"Piast Kobylnica", city:"Kobylnica", klubId:2977},
  {name:"Nielba Wągrowiec", city:"Wągrowiec", klubId:236},
  {name:"Polonia 1912 Leszno", city:"Leszno", klubId:311},
  {name:"Polonia Golina", city:"Golina", klubId:1454},
  {name:"Kania Gostyń", city:"Gostyń", klubId:139},
  {name:"Mieszko Gniezno", city:"Gniezno", klubId:209},
  {name:"LKS Gołuchów", city:"Gołuchów", klubId:1157}
].map(c=>Object.assign({
    id:uid('K'), region:"Wielkopolski ZPN", league:"IV liga (wielkopolska)", season:"2026/2027",
    crestUrl:"", juniorCategories:"", profileTm:"",
    profileLnp:`http://www.90minut.pl/skarb.php?id_klub=${c.klubId}&id_sezon=109`
  }, {name:c.name, city:c.city}));

const SEED_CLUBS_IV_LODZKA = [
  {name:"Boruta Zgierz", city:"Zgierz"},
  {name:"Zjednoczeni Stryków", city:"Stryków"},
  {name:"Polonia Piotrków Trybunalski", city:"Piotrków Trybunalski"},
  {name:"ŁKS III Łódź", city:"Łódź"},
  {name:"RKS Radomsko", city:"Radomsko"},
  {name:"Orzeł Parzęczew", city:"Parzęczew"},
  {name:"Ekolog Wojsławice", city:"Wojsławice"},
  {name:"Orkan Buczek", city:"Buczek"},
  {name:"Concordia Piotrków Trybunalski", city:"Piotrków Trybunalski"},
  {name:"Włókniarz Pabianice", city:"Pabianice"},
  {name:"Stal Głowno", city:"Głowno"},
  {name:"AKS SMS Łódź", city:"Łódź"},
  {name:"Zryw Wygoda", city:"Wygoda"},
  {name:"GKS Bełchatów", city:"Bełchatów"},
  {name:"LZS Justynów", city:"Justynów"},
  {name:"KS Kutno", city:"Kutno"},
  {name:"Ceramika Opoczno", city:"Opoczno"},
  {name:"Sokół Aleksandrów Łódzki", city:"Aleksandrów Łódzki"}
].map(c=>Object.assign({
    id:uid('K'), region:"Łódzki ZPN", league:"IV liga (łódzka)", season:"2026/2027",
    crestUrl:"", juniorCategories:"", profileTm:"", profileLnp:""
  }, c));

const ALL_SEED_CLUBS = [
  ...SEED_CLUBS_II_LIGA, ...SEED_CLUBS_III_LIGA_GR1, ...SEED_CLUBS_III_LIGA_GR2,
  ...SEED_CLUBS_III_LIGA_GR3, ...SEED_CLUBS_III_LIGA_GR4,
  ...SEED_CLUBS_IV_POMORSKA, ...SEED_CLUBS_IV_ZACHODNIOPOMORSKA, ...SEED_CLUBS_IV_DOLNOSLASKA,
  ...SEED_CLUBS_IV_SLASKA, ...SEED_CLUBS_IV_WIELKOPOLSKA, ...SEED_CLUBS_IV_LODZKA
];

// Squad list supplied by user (Transfermarkt-style), mapped onto the app's existing position vocabulary:
// "Środkowy obrońca"->"Obrońca środkowy", "Defensywny/Ofensywny pomocnik"->"Pomocnik defensywny/ofensywny",
// generic "Pomocnik"->"Pomocnik środkowy", "Lewy pomocnik" (wide)->"Skrzydłowy" (closest existing label).
const SEED_PLAYERS_ZNICZ = [
  {firstName:'Kacper',       lastName:'Napieraj',      position:'Bramkarz',            birthDate:'',           number:'12', marketValue:''},
  {firstName:'Piotr',        lastName:'Misztal',       position:'Bramkarz',            birthDate:'1987-07-10', number:'32', marketValue:'25 tys. €'},
  {firstName:'Maciej',       lastName:'Sypniewski',    position:'Bramkarz',            birthDate:'2007-01-05', number:'5',  marketValue:''},
  {firstName:'Jarosław',     lastName:'Jach',          position:'Obrońca środkowy',    birthDate:'1994-02-17', number:'6',  marketValue:''},
  {firstName:'Michał',       lastName:'Pawlik',        position:'Obrońca środkowy',    birthDate:'1995-05-08', number:'20', marketValue:''},
  {firstName:'Michał',       lastName:'Borecki',       position:'Pomocnik defensywny', birthDate:'1997-03-05', number:'80', marketValue:'100 tys. €'},
  {firstName:'Patryk',       lastName:'Plewka',        position:'Pomocnik defensywny', birthDate:'2000-01-02', number:'53', marketValue:'100 tys. €'},
  {firstName:'Aleksander',   lastName:'Nadolski',      position:'Pomocnik defensywny', birthDate:'2005-03-18', number:'14', marketValue:'75 tys. €'},
  {firstName:'Vladyslav',    lastName:'Okhronchuk',    position:'Pomocnik defensywny', birthDate:'1997-07-14', number:'3',  marketValue:'', nationality:'Ukraina'},
  {firstName:'Antoni',       lastName:'Bartoszewicz',  position:'Pomocnik defensywny', birthDate:'2009-04-27', number:'35', marketValue:''},
  {firstName:'Aleksander',   lastName:'Redliński',     position:'Pomocnik środkowy',   birthDate:'2007-04-20', number:'77', marketValue:''},
  {firstName:'Filip',        lastName:'Składowski',    position:'Skrzydłowy',          birthDate:'2005-03-04', number:'8',  marketValue:''},
  {firstName:'Tymon',        lastName:'Proczek',       position:'Pomocnik ofensywny',  birthDate:'2003-01-11', number:'19', marketValue:'150 tys. €'},
  {firstName:'Mateusz',      lastName:'Karol',         position:'Pomocnik ofensywny',  birthDate:'2004-06-20', number:'90', marketValue:'100 tys. €'},
  {firstName:'Jakub',        lastName:'Nowakowski',    position:'Pomocnik ofensywny',  birthDate:'2001-10-11', number:'',   marketValue:'50 tys. €'},
  {firstName:'Oskar',        lastName:'Garbiński',     position:'Pomocnik ofensywny',  birthDate:'2007-06-06', number:'18', marketValue:''},
  {firstName:'Mikołaj',      lastName:'Kunicki',       position:'Pomocnik ofensywny',  birthDate:'2006-06-27', number:'',   marketValue:''},
  {firstName:'Nikodem',      lastName:'Zawistowski',   position:'Skrzydłowy',          birthDate:'2000-07-03', number:'17', marketValue:''},
  {firstName:'Adrian',       lastName:'Kazimierczak',  position:'Napastnik',           birthDate:'2004-10-31', number:'16', marketValue:'150 tys. €'},
  {firstName:'Wiktor',       lastName:'Kieszek',       position:'Napastnik',           birthDate:'2008-09-26', number:'',   marketValue:''},
].map(p => Object.assign({clubName:'Znicz Pruszków'}, p));

// Legia II Warszawa — full squad sourced directly from 90minut.pl (skarb.php, id_klub=782, id_sezon=109),
// cross-referenced against the same source's transfery.php (II liga, updated 10 lipca 2026) to flag
// departures/arrivals/loans accurately rather than presenting a stale snapshot as if it were static.
const SEED_PLAYERS_LEGIA_II = [
  // Bramkarze
  {firstName:'Jan', lastName:'Bienduga', position:'Bramkarz', birthDate:'2008-08-10', height:189, notes:'Odchodzi do: Legia Warszawa (90minut.pl, transfer 2026/27).'},
  {firstName:'Konrad', lastName:'Kassyanowicz', position:'Bramkarz', birthDate:'2007-12-14', height:187, notes:'Odchodzi z klubu (90minut.pl, transfer 2026/27).'},
  {firstName:'Denys', lastName:'Stolarenko', position:'Bramkarz', birthDate:'2009-01-12', notes:'Narodowość: Ukraina. Junior.'},
  {firstName:'Jakub', lastName:'Trojanowski', position:'Bramkarz', birthDate:'2001-07-15', height:190, notes:'Odchodzi do: Legia Warszawa (90minut.pl, transfer 2026/27).'},
  // Obrońcy
  {firstName:'Rafał', lastName:'Boczoń', position:'Obrońca środkowy', birthDate:'2006-08-09', height:185},
  {firstName:'Daniel', lastName:'Foks', position:'Obrońca środkowy', birthDate:'2008-07-29', height:160},
  {firstName:'Łukasz', lastName:'Góra', position:'Obrońca środkowy', birthDate:'1993-10-04', height:188},
  {firstName:'Filip', lastName:'Jania', position:'Obrońca środkowy', birthDate:'2004-06-28', height:175},
  {firstName:'Viktor', lastName:'Karolak', position:'Obrońca środkowy', birthDate:'2006-06-21', height:182, notes:'Narodowość: Szwecja.'},
  {firstName:'Patryk', lastName:'Konik', position:'Obrońca środkowy', birthDate:'2001-03-06', height:180},
  {firstName:'Bartosz', lastName:'Korzyński', position:'Obrońca środkowy', birthDate:'2009-03-23', height:179, notes:'Odchodzi do: Legia Warszawa (90minut.pl, transfer 2026/27). Junior.'},
  {firstName:'Karol', lastName:'Kosiorek', position:'Obrońca środkowy', birthDate:'2006-01-12', height:182},
  {firstName:'Stanisław', lastName:'Kubiak', position:'Obrońca środkowy', birthDate:'2008-02-09'},
  {firstName:'Mateusz', lastName:'Lauryn', position:'Obrońca środkowy', birthDate:'2008-03-28', notes:'Odchodzi do: Legia Warszawa / SK Sigma Ołomuniec (90minut.pl, transfer 2026/27).'},
  {firstName:'Jan', lastName:'Leszczyński', position:'Obrońca środkowy', birthDate:'2007-04-12', height:184, notes:'Awansował do pierwszego zespołu (90minut.pl, transfer 2026/27).'},
  {firstName:'Adam', lastName:'Mesjasz', position:'Obrońca środkowy', birthDate:'1993-03-08', height:188, notes:'Odchodzi z klubu (90minut.pl, transfer 2026/27).'},
  {firstName:'Jeremiah', lastName:'White IV', position:'Obrońca środkowy', birthDate:'2007-02-07', notes:'Narodowość: USA.'},
  {firstName:'Bartosz', lastName:'Dembek', position:'Obrońca środkowy', notes:'Nowy transfer 2026/27: przyszedł z Pogoni Siedlce (90minut.pl).'},
  {firstName:'Dawid', lastName:'Korzeniowski', position:'Obrońca środkowy', notes:'Nowy transfer 2026/27: przyszedł z Lechii Zielona Góra (90minut.pl).'},
  {firstName:'Oskar', lastName:'Krakowiak', position:'Obrońca środkowy', notes:'Nowy transfer 2026/27: awans z juniorów (90minut.pl).'},
  {firstName:'Igor', lastName:'Owczarczyk', position:'Obrońca środkowy', notes:'Nowy transfer 2026/27: awans z juniorów (90minut.pl).'},
  // Pomocnicy
  {firstName:'Tudor', lastName:'Butucel', position:'Pomocnik środkowy', birthDate:'2003-08-14', height:181, notes:'Narodowość: Mołdawia. Odchodzi do: Zimbru Kiszyniów (90minut.pl, transfer 2026/27).'},
  {firstName:'Samuel', lastName:'Kováčik', position:'Pomocnik środkowy', birthDate:'2007-05-28', height:177, notes:'Narodowość: Słowacja. Awansował do pierwszego zespołu (90minut.pl, transfer 2026/27).'},
  {firstName:'Mieszko', lastName:'Lorenc', position:'Pomocnik środkowy', birthDate:'2001-08-26', height:189, notes:'Wypożyczony z: Znicz Pruszków (90minut.pl).'},
  {firstName:'Erik', lastName:'Mikanowicz', position:'Pomocnik środkowy', birthDate:'2007-10-22', notes:'Narodowość: Białoruś. Odchodzi do: Legia Warszawa (90minut.pl, transfer 2026/27).'},
  {firstName:'Mateusz', lastName:'Możdżeń', position:'Pomocnik środkowy', birthDate:'1991-03-14', height:180},
  {firstName:'Szymon', lastName:'Piasta', position:'Pomocnik środkowy', birthDate:'2009-04-13', height:173},
  {firstName:'Filip', lastName:'Przybyłko', position:'Pomocnik środkowy', birthDate:'2008-08-04', notes:'Odchodzi do: Legia Warszawa (90minut.pl, transfer 2026/27). Junior.'},
  {firstName:'Maciej', lastName:'Ruszkiewicz', position:'Pomocnik środkowy', birthDate:'2008-03-12', notes:'Odchodzi do: Legia Warszawa (90minut.pl, transfer 2026/27).'},
  {firstName:'Maciej', lastName:'Saletra', position:'Pomocnik środkowy', birthDate:'2006-12-19', height:180},
  {firstName:'Samuel', lastName:'Žarudi', position:'Pomocnik środkowy', birthDate:'2006-01-26', height:165, notes:'Narodowość: Słowacja.'},
  {firstName:'Igor', lastName:'Skrobała', position:'Pomocnik środkowy', birthDate:'2006-07-31', height:180},
  {firstName:'Edouard', lastName:'von Brandt-Etchemendigaray', position:'Pomocnik środkowy', birthDate:'2009-04-07', notes:'Odchodzi do: Legia Warszawa (90minut.pl, transfer 2026/27). Junior.'},
  {firstName:'Aleksander', lastName:'Wyganowski', position:'Pomocnik środkowy', birthDate:'2009-06-11', height:173},
  {firstName:'Jakub', lastName:'Gliwa', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: awans z juniorów (90minut.pl).'},
  {firstName:'Marcel', lastName:'Laszczyk', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: awans z juniorów (90minut.pl).'},
  {firstName:'Jakub', lastName:'Zbróg', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: przyszedł z Pogoni Siedlce (90minut.pl).'},
  {firstName:'Nikodem', lastName:'Gimiński', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: awans z juniorów (90minut.pl).'},
  // Napastnicy
  {firstName:'Dawid', lastName:'Kiedrowicz', position:'Napastnik', birthDate:'2004-06-08', height:180},
  {firstName:'Jordan', lastName:'Majchrzak', position:'Napastnik', birthDate:'2004-10-08', height:186, notes:'Odchodzi do: VfB Stuttgart 1893 II, Niemcy (90minut.pl, transfer 2026/27).'},
  {firstName:'Przemysław', lastName:'Mizera', position:'Napastnik', birthDate:'2006-03-20'},
  {firstName:'Cyprian', lastName:'Pchełka', position:'Napastnik', birthDate:'2006-09-26', height:179},
  {firstName:'Adam', lastName:'Ryczkowski', position:'Napastnik', birthDate:'1997-04-30', height:178},
].map(p => Object.assign({clubName:'Legia II Warszawa'}, p));

// Górnik Łęczna — PARTIAL roster only. Unlike Legia II, 90minut.pl's structured "Kadra" squad list
// for this club is nearly empty this early in the 2026/27 season (autumn round barely started, spring
// round not begun) — it only surfaces newly-arrived signings, not the full contracted squad. Cross-checked
// against transfery.php (II liga, updated 10 lipca 2026) for the confirmed incoming list. Existing squad
// members who haven't been freshly re-signed are NOT included here since no verified source for them was found.
const SEED_PLAYERS_GORNIK_LECZNA = [
  // Pełne dane (data ur. + wzrost) — potwierdzone w Kadra (jesień) 2026/27
  {firstName:'Adam', lastName:'Matysek', position:'Bramkarz', birthDate:'2007-05-30', notes:'Nowy transfer 2026/27: przyszedł z Zagłębia Lubin (90minut.pl).'},
  {firstName:'Grzegorz', lastName:'Rogala', position:'Obrońca środkowy', birthDate:'1995-10-12', height:183, notes:'Nowy transfer 2026/27: przyszedł z GKS Katowice (90minut.pl).'},
  {firstName:'Bartłomiej', lastName:'Korbecki', position:'Pomocnik środkowy', birthDate:'2002-02-23', height:178, notes:'Nowy transfer 2026/27: przyszedł z Chełmianki Chełm (90minut.pl).'},
  {firstName:'Wiktor', lastName:'Niewiarowski', position:'Pomocnik środkowy', birthDate:'2001-09-22', height:177, notes:'Nowy transfer 2026/27: przyszedł ze Śląska Wrocław (90minut.pl).'},
  {firstName:'Samuel', lastName:'Quainoo', position:'Pomocnik środkowy', birthDate:'2006-08-27', height:190, notes:'Nowy transfer 2026/27: przyszedł z Górnika II Zabrze (90minut.pl).'},
  {firstName:'Michał', lastName:'Walski', position:'Pomocnik środkowy', birthDate:'1997-02-27', height:169, notes:'Nowy transfer 2026/27: przyszedł z Puszczy Niepołomice (90minut.pl).'},
  {firstName:'Hubert', lastName:'Antkowiak', position:'Napastnik', birthDate:'1996-09-12', height:189, notes:'Nowy transfer 2026/27: przyszedł z ŁKS Łomża (90minut.pl).'},
  {firstName:'Jindřich', lastName:'Novotný', position:'Napastnik', notes:'Narodowość: Czechy. Nowy transfer 2026/27: przyszedł z FK Arsenal Česká Lípa (90minut.pl).'},
  // Tylko nazwisko + skąd przyszedł — potwierdzone w transferach, ale bez daty ur./wzrostu w dostępnym źródle
  {firstName:'Olivier', lastName:'Siniawski', position:'Bramkarz', notes:'Nowy transfer 2026/27: przyszedł z Miedzi II Legnica (90minut.pl). Brak pełnych danych w źródle — uzupełnij ręcznie.'},
  {firstName:'Maksymilian', lastName:'Soja', position:'Obrońca środkowy', notes:'Nowy transfer 2026/27: przyszedł ze Stali Rzeszów (90minut.pl). Brak pełnych danych w źródle — uzupełnij ręcznie.'},
  {firstName:'Michał', lastName:'Steszuk', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: przyszedł z Noteci Czarnków (90minut.pl). Brak pełnych danych w źródle — uzupełnij ręcznie.'},
  {firstName:'Iwo', lastName:'Świerkot', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: przyszedł z Górnika II Zabrze (90minut.pl). Brak pełnych danych w źródle — uzupełnij ręcznie.'},
  {firstName:'Karol', lastName:'Turek', position:'Obrońca środkowy', notes:'Nowy transfer 2026/27: przyszedł z Unii Skierniewice (90minut.pl). Brak pełnych danych w źródle — uzupełnij ręcznie.'},
  {firstName:'Paweł', lastName:'Żyra', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: przyszedł z Miedzi II Legnica (90minut.pl). Brak pełnych danych w źródle — uzupełnij ręcznie.'},
  {firstName:'Alan', lastName:'Duma', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: awans z Górnika II Łęczna (90minut.pl). Brak pełnych danych w źródle — uzupełnij ręcznie.'},
  {firstName:'Dawid', lastName:'Kłos', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: awans z Górnika II Łęczna (90minut.pl). Brak pełnych danych w źródle — uzupełnij ręcznie.'},
  // Dodatkowi zawodnicy z pełnej listy składu przesłanej przez użytkownika (wiek, nie dokładna data ur.)
  {firstName:'Kuba', lastName:'Wilk', position:'Bramkarz', age:17, nationality:'Polska'},
  {firstName:'Erwin', lastName:'Stadnicki', position:'Obrońca środkowy', age:19, number:'3', nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Holownia', position:'Obrońca środkowy', age:28, number:'4', nationality:'Polska'},
  {firstName:'Paweł', lastName:'Jaroszyński', position:'Obrońca środkowy', age:31, number:'74', nationality:'Polska'},
  {firstName:'Kamil', lastName:'Kruk', position:'Obrońca środkowy', age:26, number:'37', nationality:'Polska'},
  {firstName:'Jan', lastName:'Stępniak', position:'Obrońca środkowy', age:17, number:'21', nationality:'Polska'},
  {firstName:'Jakub', lastName:'Bednarczyk', position:'Obrońca boczny', age:27, nationality:'Polska/Niemcy'},
  {firstName:'Adam', lastName:'Deja', position:'Pomocnik defensywny', age:33, number:'30', nationality:'Polska'},
  {firstName:'Bekzod', lastName:'Akhmedov', position:'Pomocnik defensywny', age:26, number:'88', nationality:'Uzbekistan'},
  {firstName:'Oskar', lastName:'Osipiuk', position:'Pomocnik defensywny', age:23, nationality:'Polska'},
  {firstName:'Szymon', lastName:'Małyska', position:'Pomocnik środkowy', age:19, number:'16', nationality:'Polska'},
  {firstName:'Krystian', lastName:'Kołodziejczak', position:'Pomocnik defensywny', age:16, number:'78', nationality:'Polska'},
  {firstName:'Natan', lastName:'Mundry', position:'Pomocnik defensywny', age:16, nationality:'Polska'},
  {firstName:'Dawid', lastName:'Tkacz', position:'Pomocnik ofensywny', age:21, number:'38', marketValue:'150 tys. €', nationality:'Polska'},
  {firstName:'Jakub', lastName:'Myszor', position:'Pomocnik ofensywny', age:24, marketValue:'150 tys. €', nationality:'Polska'},
  {firstName:'Fryderyk', lastName:'Janaszek', position:'Skrzydłowy', age:22, marketValue:'150 tys. €', nationality:'Polska'},
].map(p => Object.assign({clubName:'Górnik Łęczna'}, p));

// Position/age corrections for the 11 Górnik players already in the database — the earlier import only had
// generic-default positions (transfery.php gave just a coarse O/P/N code); this full squad list gives much
// more specific positions, which are applied here as corrections rather than left as stale generic guesses.
const SEED_PLAYER_ENRICHMENT_GORNIK = [
  {firstName:'Grzegorz', lastName:'Rogala', clubName:'Górnik Łęczna', correctPosition:'Skrzydłowy'},
  {firstName:'Karol', lastName:'Turek', clubName:'Górnik Łęczna', correctPosition:'Skrzydłowy'},
  {firstName:'Bartłomiej', lastName:'Korbecki', clubName:'Górnik Łęczna', correctPosition:'Skrzydłowy'},
  {firstName:'Michał', lastName:'Steszuk', clubName:'Górnik Łęczna', correctPosition:'Skrzydłowy'},
  {firstName:'Wiktor', lastName:'Niewiarowski', clubName:'Górnik Łęczna', correctPosition:'Pomocnik ofensywny'},
  {firstName:'Samuel', lastName:'Quainoo', clubName:'Górnik Łęczna', correctPosition:'Skrzydłowy'},
];

// Chojniczanka Chojnice — full confirmed data for all 7 new signings this window, sourced from
// 90minut.pl's Kadra (jesień) 2026/27 page and cross-checked against both transfery.php and the
// club's own official news page (mkschojniczanka.pl), which independently confirmed the Borowski
// and Sobol arrivals. Unlike Górnik Łęczna, every entry here has full birthdate + height data.
const SEED_PLAYERS_CHOJNICZANKA = [
  {firstName:'Ramil', lastName:'Mustafajew', position:'Obrońca środkowy', birthDate:'2003-12-20', height:183, notes:'Nowy transfer 2026/27: przyszedł z Cracovii II (90minut.pl).'},
  {firstName:'Jan', lastName:'Smolarczyk', position:'Obrońca środkowy', birthDate:'2006-07-26', notes:'Nowy transfer 2026/27: przyszedł z FC Dordrecht, Holandia (90minut.pl).'},
  {firstName:'Jakub', lastName:'Tecław', position:'Obrońca środkowy', birthDate:'1999-07-03', height:190, notes:'Nowy transfer 2026/27: przyszedł z GKS Tychy (90minut.pl).'},
  {firstName:'Maciej', lastName:'Famulak', position:'Pomocnik środkowy', birthDate:'1999-11-18', height:182, notes:'Nowy transfer 2026/27: przyszedł z Pogoni Siedlce (90minut.pl).'},
  {firstName:'Szymon', lastName:'Stypułkowski', position:'Pomocnik środkowy', birthDate:'2006-03-17', height:180, notes:'Nowy transfer 2026/27: przyszedł z Jagiellonii II Białystok (90minut.pl).'},
  {firstName:'Bartosz', lastName:'Borowski', position:'Napastnik', birthDate:'2007-01-24', height:183, notes:'Nowy transfer 2026/27: przyszedł z Wisły Płock (90minut.pl, potwierdzone też na oficjalnej stronie klubu). Wartość rynkowa: 150 tys. €.'},
  {firstName:'Hubert', lastName:'Sobol', position:'Napastnik', birthDate:'2000-06-25', height:183, notes:'Nowy transfer 2026/27: przyszedł z NK Široki Brijeg, Bośnia i Hercegowina (90minut.pl, potwierdzone też na oficjalnej stronie klubu).'},
  {firstName:'Damian', lastName:'Primel', position:'Bramkarz', age:34, number:'33', nationality:'Polska'},
  {firstName:'Dawid', lastName:'Lic', position:'Bramkarz', age:19, number:'88', nationality:'Polska'},
  {firstName:'Adrian', lastName:'Czerniewicz', position:'Bramkarz', age:16, nationality:'Polska'},
  {firstName:'Dmytro', lastName:'Yukhymovych', position:'Obrońca środkowy', age:29, nationality:'Ukraina'},
  {firstName:'Jakub', lastName:'Goliński', position:'Obrońca środkowy', age:21, number:'26', nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Meyer', position:'Obrońca środkowy', age:20, number:'19', nationality:'Polska'},
  {firstName:'Maksymilian', lastName:'Tkocz', position:'Obrońca boczny', age:24, nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Bąkowicz', position:'Obrońca boczny', age:24, nationality:'Polska'},
  {firstName:'Rafał', lastName:'Majtyka', position:'Pomocnik defensywny', age:28, number:'34', nationality:'Polska'},
  {firstName:'Damian', lastName:'Nowacki', position:'Pomocnik defensywny', age:28, number:'8', nationality:'Polska'},
  {firstName:'Adrian', lastName:'Czyżewski', position:'Pomocnik środkowy', age:19, number:'80', nationality:'Polska'},
  {firstName:'Filip', lastName:'Mosek', position:'Pomocnik defensywny', age:18, number:'31', nationality:'Polska'},
  {firstName:'Jakub', lastName:'Żywicki', position:'Pomocnik środkowy', age:20, number:'77', nationality:'Polska'},
  {firstName:'Jakub', lastName:'Pławski', position:'Skrzydłowy', age:19, number:'7', nationality:'Polska'},
  {firstName:'Błażej', lastName:'Szczepanek', position:'Pomocnik ofensywny', age:25, number:'30', nationality:'Polska'},
  {firstName:'Kacper', lastName:'Stoklosa', position:'Pomocnik ofensywny', age:22, nationality:'Polska'},
  {firstName:'Dariusz', lastName:'Kamiński', position:'Skrzydłowy', age:27, number:'91', nationality:'Polska'},
  {firstName:'Kacper', lastName:'Korczyc', position:'Skrzydłowy', age:20, nationality:'Polska'},
  {firstName:'Maciej', lastName:'Firlej', position:'Napastnik', age:29, number:'20', nationality:'Polska'},
  {firstName:'Valerijs', lastName:'Sabala', position:'Napastnik', age:31, number:'97', nationality:'Łotwa'},
  {firstName:'Jakub', lastName:'Oleksiewicz', position:'Napastnik', age:20, nationality:'Polska'},
].map(p => Object.assign({clubName:'Chojniczanka Chojnice'}, p));

// The following 5 clubs: PARTIAL rosters only (confirmed incoming signings, position + previous club),
// sourced from 90minut.pl's transfery.php (II liga, updated 10 lipca 2026). A tool-side caching issue
// prevented fetching the richer Kadra squad pages this session, so birthdate/height are NOT available —
// left blank rather than guessed. Position codes (B/O/P/N) mapped to generic środkowy/środkowa variants
// per established convention; players with no position code in the source are left blank, not guessed.
const SEED_PLAYERS_AVIA = [
  {firstName:'Grzegorz', lastName:'Aftyka', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: przyszedł ze Świtu Szczecin (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Łukasz', lastName:'Jakubowski', position:'Bramkarz', notes:'Nowy transfer 2026/27: przyszedł z ŁKS Łódź (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Wojciech', lastName:'Karasiewicz', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: przyszedł z Unii Swarzędz (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Michał', lastName:'Kołodziejski', position:'Obrońca środkowy', notes:'Nowy transfer 2026/27: przyszedł z Pogoni Siedlce (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Egzon', lastName:'Kryeziu', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: przyszedł z Górnika Łęczna (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Marcin', lastName:'Kumorek', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: przyszedł z Podhala Nowy Targ (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Kacper', lastName:'Wełniak', position:'Napastnik', notes:'Nowy transfer 2026/27: przyszedł z GKS Tychy (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Mateusz', lastName:'Wójcik', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: przyszedł z GKS Bełchatów (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Aleksander', lastName:'Kalita', position:'', notes:'Nowy transfer 2026/27: awans z Avii II Świdnik (90minut.pl). Brak pozycji/daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
].map(p => Object.assign({clubName:'Avia Świdnik'}, p));

const SEED_PLAYERS_REKORD = [
  {firstName:'Denis', lastName:'Potoma', position:'Pomocnik środkowy', notes:'Narodowość: Słowacja. Nowy transfer 2026/27: przyszedł z MŠK Považská Bystrica (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Sebastian', lastName:'Sobolewski', position:'Bramkarz', notes:'Nowy transfer 2026/27: przyszedł z Olimpii Grudziądz (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Tomasz', lastName:'Walaszek', position:'Obrońca środkowy', notes:'Nowy transfer 2026/27: przyszedł z Cracovii II (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Jakub', lastName:'Motyka', position:'', notes:'Nowy transfer 2026/27: awans z Rekordu II Bielsko-Biała (90minut.pl). Brak pozycji/daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Jakub', lastName:'Wnęczak', position:'', notes:'Nowy transfer 2026/27: awans z Rekordu II Bielsko-Biała (90minut.pl). Brak pozycji/daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Konrad', lastName:'Duśniak', position:'', notes:'Nowy transfer 2026/27: awans z Rekordu II Bielsko-Biała (90minut.pl). Brak pozycji/daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Rafał', lastName:'Walaszek', position:'', notes:'Nowy transfer 2026/27: awans z Rekordu II Bielsko-Biała (90minut.pl). Brak pozycji/daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Krzysztof', lastName:'Żerdka', position:'Bramkarz', age:34, number:'39', nationality:'Polska'},
  {firstName:'Wiktor', lastName:'Kaczorowski', position:'Bramkarz', age:24, nationality:'Polska'},
  {firstName:'Krzysztof', lastName:'Bem', position:'Bramkarz', age:19, number:'3', nationality:'Polska'},
  {firstName:'Jan', lastName:'Sobociński', position:'Obrońca środkowy', age:27, number:'4', nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Broda', position:'Obrońca środkowy', age:25, number:'8', nationality:'Polska'},
  {firstName:'Tomasz', lastName:'Boczek', position:'Obrońca środkowy', age:36, number:'24', nationality:'Polska'},
  {firstName:'Louis', lastName:'Poznański', position:'Obrońca środkowy', age:25, number:'30', nationality:'Polska/Niemcy'},
  {firstName:'Konrad', lastName:'Kareta', position:'Obrońca środkowy', age:31, nationality:'Polska'},
  {firstName:'Tymon', lastName:'Sobek', position:'Obrońca środkowy', age:20, nationality:'Polska'},
  {firstName:'Dawid', lastName:'Mazurek', position:'Obrońca boczny', age:19, number:'18', marketValue:'75 tys. €', nationality:'Polska'},
  {firstName:'Jakub', lastName:'Kempny', position:'Obrońca boczny', age:21, number:'16', nationality:'Polska'},
  {firstName:'Dariusz', lastName:'Pawłowski', position:'Obrońca boczny', age:27, number:'6', nationality:'Polska'},
  {firstName:'Daniel', lastName:'Ściślak', position:'Pomocnik defensywny', age:26, number:'75', nationality:'Polska'},
  {firstName:'Piotr', lastName:'Wyroba', position:'Pomocnik defensywny', age:25, nationality:'Polska'},
  {firstName:'Krystian', lastName:'Myszka', position:'Pomocnik defensywny', age:17, number:'14', nationality:'Polska'},
  {firstName:'Michał', lastName:'Hornik', position:'Pomocnik środkowy', age:20, number:'17', nationality:'Polska'},
  {firstName:'Adam', lastName:'Gibiec', position:'Pomocnik defensywny', age:21, nationality:'Polska'},
  {firstName:'Hubert', lastName:'Żyrek', position:'Skrzydłowy', age:20, nationality:'Polska'},
  {firstName:'Jan', lastName:'Ciućka', position:'Pomocnik ofensywny', age:23, nationality:'Polska'},
  {firstName:'Kamil', lastName:'Gumółka', position:'Pomocnik ofensywny', age:18, number:'21', nationality:'Polska'},
  {firstName:'Jakub', lastName:'Ryś', position:'Pomocnik ofensywny', age:27, nationality:'Polska'},
  {firstName:'Wojciech', lastName:'Łaski', position:'Skrzydłowy', age:26, number:'19', nationality:'Polska'},
  {firstName:'Kacper', lastName:'Kasprzak', position:'Skrzydłowy', age:23, number:'91', nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Klichowicz', position:'Skrzydłowy', age:34, number:'27', nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Tekieli', position:'Skrzydłowy', age:20, number:'77', nationality:'Polska'},
  {firstName:'Filip', lastName:'Sapiński', position:'Skrzydłowy', age:17, number:'11', nationality:'Polska'},
  {firstName:'Daniel', lastName:'Świderski', position:'Napastnik', age:31, nationality:'Polska'},
  {firstName:'Szymon', lastName:'Mlocek', position:'Napastnik', age:20, nationality:'Polska'},
  {firstName:'Maksymilian', lastName:'Sordyl', position:'Napastnik', age:18, number:'26', nationality:'Polska'},
  {firstName:'Bartosz', lastName:'Syrek', position:'Napastnik', age:17, nationality:'Polska'},
].map(p => Object.assign({clubName:'Rekord Bielsko-Biała'}, p));

const SEED_PLAYER_ENRICHMENT_REKORD = [
  {firstName:'Denis', lastName:'Potoma', clubName:'Rekord Bielsko-Biała', correctPosition:'Pomocnik ofensywny'},
];

const SEED_PLAYERS_SLASK_II = [
  {firstName:'Patryk', lastName:'Bojek', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: awans z juniorów (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Gracjan', lastName:'Korytkowski', position:'Bramkarz', age:24, number:'31', nationality:'Polska'},
  {firstName:'Oskar', lastName:'Mielcarz', position:'Bramkarz', age:22, nationality:'Polska'},
  {firstName:'Hubert', lastName:'Śliczniak', position:'Bramkarz', age:19, nationality:'Polska'},
  {firstName:'Tomasz', lastName:'Pytlak', position:'Bramkarz', age:17, nationality:'Polska'},
  {firstName:'Dominik', lastName:'Klint', position:'Bramkarz', age:17, nationality:'Polska'},
  {firstName:'Dominik', lastName:'Nowak', position:'Bramkarz', age:17, number:'3', nationality:'Polska'},
  {firstName:'Jakub', lastName:'Popiela', position:'Obrońca środkowy', age:18, nationality:'Polska'},
  {firstName:'Szymon', lastName:'Rygiel', position:'Obrońca środkowy', age:22, number:'28', marketValue:'10 tys. €', nationality:'Polska'},
  {firstName:'Hubert', lastName:'Muszyński', position:'Obrońca środkowy', age:31, number:'32', nationality:'Polska'},
  {firstName:'Mikołaj', lastName:'Tudruj', position:'Obrońca środkowy', age:20, nationality:'Polska'},
  {firstName:'Jakub', lastName:'Kaszub', position:'Obrońca środkowy', age:18, nationality:'Polska'},
  {firstName:'Adrian', lastName:'Żulewski', position:'Obrońca środkowy', age:19, number:'2', nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Cegliński', position:'Obrońca środkowy', age:18, number:'38', nationality:'Polska'},
  {firstName:'Allen', lastName:'Rozum', position:'Obrońca środkowy', age:21, number:'18', nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Krygowski', position:'Obrońca boczny', age:19, nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Moskaluk', position:'Pomocnik defensywny', age:17, nationality:'Polska'},
  {firstName:'Aleksander', lastName:'Marciniak', position:'Pomocnik środkowy', age:20, number:'3', nationality:'Polska'},
  {firstName:'Maksymilian', lastName:'Krzewiński', position:'Pomocnik defensywny', age:19, number:'16', nationality:'Polska'},
  {firstName:'Jan', lastName:'Chodera', position:'Pomocnik defensywny', age:19, nationality:'Polska'},
  {firstName:'Bartosz', lastName:'Sadłocha', position:'Pomocnik środkowy', age:17, nationality:'Polska'},
  {firstName:'Patryk', lastName:'Skrzypczyński', position:'Pomocnik ofensywny', age:19, number:'11', nationality:'Polska'},
  {firstName:'Miłosz', lastName:'Kurowski', position:'Skrzydłowy', age:21, nationality:'Polska'},
  {firstName:'Kamil', lastName:'Rutowski', position:'Skrzydłowy', age:20, nationality:'Polska'},
  {firstName:'Krystian', lastName:'Rostek', position:'Skrzydłowy', age:18, number:'7', nationality:'Polska'},
  {firstName:'Wiktor', lastName:'Kamiński', position:'Napastnik', age:22, nationality:'Polska'},
  {firstName:'Julian', lastName:'Liberski', position:'Napastnik', age:18, nationality:'Polska'},
  {firstName:'Dawid', lastName:'Moskaluk', position:'Napastnik', age:18, number:'9', nationality:'Polska'},
  {firstName:'Igor', lastName:'Kobelczuk', position:'Napastnik', age:19, nationality:'Polska'},
].map(p => Object.assign({clubName:'Śląsk II Wrocław'}, p));

const SEED_PLAYERS_SWIT_SZCZECIN = [
  {firstName:'Mateusz', lastName:'Abramowicz', position:'Bramkarz', notes:'Nowy transfer 2026/27: przyszedł z Odry Opole (90minut.pl). Nr 72.'},
  {firstName:'Mateusz', lastName:'Andruszko', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: przyszedł z KKS 1925 Kalisz (90minut.pl). Nr 77. Uwaga: lista klubowa podaje pozycję "Ofensywny pomocnik" — do weryfikacji.'},
  {firstName:'Jakub', lastName:'Bursztyn', position:'Bramkarz', notes:'Nowy transfer 2026/27: przyszedł z Lechii Zielona Góra (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Alexander', lastName:'Gorgon', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: przyszedł z SC Rheindorf Altach, Austria (90minut.pl). Uwaga: lista klubowa podaje pozycję "Ofensywny pomocnik" i wiek 37 — do weryfikacji.'},
  {firstName:'Jakub', lastName:'Rajczykowski', position:'Bramkarz', notes:'Nowy transfer 2026/27: przyszedł z Polonii Bytom (90minut.pl). Wartość rynkowa: 50 tys. €.'},
  {firstName:'Wojciech', lastName:'Szpaler', position:'Bramkarz', age:18, nationality:'Polska'},
  {firstName:'Bartosz', lastName:'Pituch', position:'Obrońca środkowy', age:20, number:'3', nationality:'Polska'},
  {firstName:'Rafał', lastName:'Remisz', position:'Obrońca środkowy', age:34, number:'4', nationality:'Polska'},
  {firstName:'Sebastian', lastName:'Rogala', position:'Obrońca środkowy', age:26, nationality:'Polska'},
  {firstName:'Daniel', lastName:'Zamiara', position:'Obrońca środkowy', age:20, nationality:'Polska'},
  {firstName:'Kacper', lastName:'Gołębiewski', position:'Pomocnik defensywny', age:20, number:'15', nationality:'Polska'},
  {firstName:'Kacper', lastName:'Wojdak', position:'Pomocnik defensywny', age:27, number:'25', nationality:'Polska'},
  {firstName:'Yuriy', lastName:'Tkachuk', position:'Pomocnik defensywny', age:31, nationality:'Ukraina'},
  {firstName:'Kacper', lastName:'Żendełek', position:'Pomocnik defensywny', age:20, number:'6', nationality:'Polska'},
  {firstName:'Karol', lastName:'Maszało', position:'Pomocnik defensywny', age:20, number:'17', nationality:'Polska'},
  {firstName:'Szymon', lastName:'Zań', position:'Pomocnik środkowy', age:20, number:'17', nationality:'Polska'},
  {firstName:'Marcel', lastName:'Broda', position:'Pomocnik defensywny', age:18, number:'20', nationality:'Polska'},
  {firstName:'Damian', lastName:'Ciechanowski', position:'Skrzydłowy', age:30, number:'23', nationality:'Polska'},
  {firstName:'Szymon', lastName:'Nowicki', position:'Skrzydłowy', age:27, number:'11', nationality:'Polska'},
  {firstName:'Kacper', lastName:'Nowak', position:'Skrzydłowy', age:25, number:'19', nationality:'Polska'},
  {firstName:'Dawid', lastName:'Kisły', position:'Skrzydłowy', age:25, number:'22', nationality:'Polska'},
  {firstName:'Aleksander', lastName:'Woźniak', position:'Skrzydłowy', age:19, nationality:'Polska'},
  {firstName:'Adam', lastName:'Ładziak', position:'Pomocnik ofensywny', age:29, number:'8', nationality:'Polska'},
  {firstName:'Maciej', lastName:'Koziara', position:'Pomocnik ofensywny', age:29, number:'10', nationality:'Polska'},
  {firstName:'Dawid', lastName:'Kort', position:'Pomocnik ofensywny', age:31, nationality:'Polska'},
  {firstName:'Alan', lastName:'Dziuniak', position:'Pomocnik ofensywny', age:19, number:'9', nationality:'Polska'},
  {firstName:'Krzysztof', lastName:'Ropski', position:'Napastnik', age:29, number:'13', nationality:'Polska'},
  {firstName:'Szymon', lastName:'Kapelusz', position:'Napastnik', age:32, nationality:'Polska'},
].map(p => Object.assign({clubName:'Świt Szczecin'}, p));

const SEED_PLAYERS_OLIMPIA_GRUDZIADZ = [
  {firstName:'Dawid', lastName:'Abramowicz', position:'Obrońca środkowy', notes:'Nowy transfer 2026/27: przyszedł z Arki Gdynia (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Dawid', lastName:'Bałdyga', position:'Napastnik', notes:'Nowy transfer 2026/27: przyszedł z Resovii (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Oskar', lastName:'Klat', position:'Bramkarz', notes:'Nowy transfer 2026/27: przyszedł z Wisły Płock (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Szymon', lastName:'Michalski', position:'Obrońca środkowy', notes:'Nowy transfer 2026/27: przyszedł z Warty Poznań (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Dawid', lastName:'Olejarka', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: przyszedł z Wisły Kraków (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Jakub', lastName:'Pawlak', position:'Bramkarz', notes:'Nowy transfer 2026/27: przyszedł z ŁKS Łódź (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Jakub', lastName:'Stec', position:'Pomocnik środkowy', notes:'Nowy transfer 2026/27: przyszedł z Puszczy Niepołomice (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Maciej', lastName:'Wichtowski', position:'Obrońca środkowy', notes:'Nowy transfer 2026/27: przyszedł z Lecha II Poznań (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
  {firstName:'Filip', lastName:'Wilak', position:'Napastnik', notes:'Nowy transfer 2026/27: przyszedł z Lecha II Poznań (90minut.pl). Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.'},
].map(p => Object.assign({clubName:'Olimpia Grudziądz'}, p));

// Full squads pasted directly by the user (not independently fetched by Claude this round) for 7 more
// II liga clubs. Source gives AGE only, not exact birthdate — birthYear is therefore an approximation
// (2026 minus age), clearly flagged as such in each player's notes rather than presented as a verified date.
const SEED_PLAYERS_SANDECJA = [
  {firstName:'Konrad', lastName:'Tokarz', position:'Bramkarz', age:20, number:'1', nationality:'Polska'},
  {firstName:'Karol', lastName:'Szymkowiak', position:'Bramkarz', age:26, number:'3', nationality:'Polska'},
  {firstName:'Wiktor', lastName:'Pleśnierowicz', position:'Obrońca środkowy', age:25, number:'24', nationality:'Polska'},
  {firstName:'Kamil', lastName:'Słaby', position:'Obrońca środkowy', age:32, number:'47', nationality:'Polska'},
  {firstName:'Wojciech', lastName:'Błyszko', position:'Obrońca środkowy', age:26, nationality:'Polska'},
  {firstName:'Bartosz', lastName:'Gurba', position:'Obrońca środkowy', age:19, number:'47', nationality:'Polska'},
  {firstName:'Kacper', lastName:'Wokacz', position:'Obrońca środkowy', age:19, nationality:'Polska'},
  {firstName:'Łukasz', lastName:'Gerstenstein', position:'Obrońca boczny', age:21, nationality:'Polska'},
  {firstName:'Dominik', lastName:'Holan', position:'Pomocnik defensywny', age:24, number:'19', nationality:'Czechy'},
  {firstName:'Tomasz', lastName:'Kołbon', position:'Pomocnik defensywny', age:32, number:'33', nationality:'Polska'},
  {firstName:'Bartłomiej', lastName:'Kasprzak', position:'Pomocnik defensywny', age:33, number:'74', nationality:'Polska'},
  {firstName:'Przemysław', lastName:'Skałecki', position:'Pomocnik defensywny', age:26, number:'20', nationality:'Polska'},
  {firstName:'Eryk', lastName:'Kosiński', position:'Pomocnik defensywny', age:18, number:'16', nationality:'Polska'},
  {firstName:'Karol', lastName:'Smajdor', position:'Skrzydłowy', age:25, number:'23', nationality:'Polska'},
  {firstName:'Adrian', lastName:'Danek', position:'Skrzydłowy', age:31, number:'98', nationality:'Polska'},
  {firstName:'Kamil', lastName:'Ogorzały', position:'Skrzydłowy', age:25, number:'77', nationality:'Polska'},
  {firstName:'Leon', lastName:'Ziętek', position:'Skrzydłowy', age:20, number:'6', nationality:'Polska'},
  {firstName:'Maciej', lastName:'Żurawski', position:'Pomocnik ofensywny', age:25, number:'29', nationality:'Polska'},
  {firstName:'Adam', lastName:'Brenkus', position:'Pomocnik ofensywny', age:27, nationality:'Słowacja'},
  {firstName:'Marcel', lastName:'Płocica', position:'Pomocnik ofensywny', age:17, nationality:'Polska'},
  {firstName:'Patryk', lastName:'Kieliś', position:'Skrzydłowy', age:25, nationality:'Polska'},
  {firstName:'Marko', lastName:'Kolar', position:'Napastnik', age:31, number:'25', nationality:'Chorwacja'},
  {firstName:'Filip', lastName:'Piszczek', position:'Napastnik', age:31, nationality:'Polska'},
  {firstName:'Patryk', lastName:'Peciak', position:'Napastnik', age:19, nationality:'Polska'},
].map(p => Object.assign({clubName:'Sandecja Nowy Sącz'}, p));

const SEED_PLAYERS_PODHALE = [
  {firstName:'Maciej', lastName:'Styrczula', position:'Bramkarz', age:25, number:'33', nationality:'Polska'},
  {firstName:'Dorian', lastName:'Frątczak', position:'Bramkarz', age:29, number:'12', nationality:'Polska'},
  {firstName:'Kostyantyn', lastName:'Solobchuk', position:'Bramkarz', age:26, nationality:'Ukraina'},
  {firstName:'Radosław', lastName:'Seweryś', position:'Obrońca środkowy', age:22, number:'2', nationality:'Polska'},
  {firstName:'Krzysztof', lastName:'Salak', position:'Obrońca środkowy', age:25, number:'19', nationality:'Polska'},
  {firstName:'Marcin', lastName:'Michota', position:'Obrońca środkowy', age:29, number:'21', nationality:'Polska'},
  {firstName:'Peter', lastName:'Vosko', position:'Obrońca środkowy', age:25, nationality:'Słowacja'},
  {firstName:'Michał', lastName:'Osikowski', position:'Obrońca środkowy', age:18, number:'4', nationality:'Polska/Anglia'},
  {firstName:'Oliwier', lastName:'Zemanek', position:'Obrońca środkowy', age:18, number:'32', nationality:'Polska'},
  {firstName:'Artur', lastName:'Łukasz', position:'Obrońca środkowy', age:17, nationality:'Polska'},
  {firstName:'Richard', lastName:'Pecarka', position:'Obrońca boczny', age:22, number:'8', nationality:'Słowacja'},
  {firstName:'Rastislav', lastName:'Vaclavik', position:'Pomocnik defensywny', age:29, number:'15', nationality:'Słowacja'},
  {firstName:'Patryk', lastName:'Kupczak', position:'Pomocnik defensywny', age:20, number:'20', nationality:'Polska'},
  {firstName:'Jakub', lastName:'Kluś', position:'Pomocnik defensywny', age:19, number:'23', nationality:'Polska'},
  {firstName:'Bartosz', lastName:'Mikołajczyk', position:'Pomocnik defensywny', age:21, number:'7', nationality:'Polska'},
  {firstName:'Łukasz', lastName:'Seweryn', position:'Skrzydłowy', age:24, number:'27', nationality:'Polska'},
  {firstName:'Cesar', lastName:'Peña', position:'Skrzydłowy', age:24, number:'42', nationality:'Kolumbia'},
  {firstName:'Mikołaj', lastName:'Lipień', position:'Skrzydłowy', age:22, number:'16', nationality:'Polska'},
  {firstName:'Jakub', lastName:'Rubiś', position:'Skrzydłowy', age:20, nationality:'Polska'},
  {firstName:'Damian', lastName:'Kołtanski', position:'Pomocnik ofensywny', age:23, nationality:'Polska'},
  {firstName:'Michał', lastName:'Surzyn', position:'Pomocnik ofensywny', age:22, nationality:'Polska'},
  {firstName:'Tobiasz', lastName:'Kubik', position:'Pomocnik ofensywny', age:23, number:'29', nationality:'Polska'},
  {firstName:'Marcinho', lastName:'', position:'Pomocnik ofensywny', age:29, number:'10', nationality:'Brazylia'},
  {firstName:'Arkadiusz', lastName:'Nowak', position:'Pomocnik ofensywny', age:19, number:'99', nationality:'Polska'},
  {firstName:'Piotr', lastName:'Giel', position:'Napastnik', age:36, number:'9', nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Niedziałkowski', position:'Napastnik', age:21, number:'87', nationality:'Polska'},
  {firstName:'Bartosz', lastName:'Kurzeja', position:'Napastnik', age:22, nationality:'Polska'},
].map(p => Object.assign({clubName:'Podhale Nowy Targ'}, p));

const SEED_PLAYERS_STAL_STALOWA_WOLA = [
  {firstName:'Mikołaj', lastName:'Smyłek', position:'Bramkarz', age:31, number:'1', nationality:'Polska'},
  {firstName:'Krystian', lastName:'Harciński', position:'Bramkarz', age:19, number:'4', nationality:'Polska'},
  {firstName:'Łukasz', lastName:'Furtak', position:'Obrońca środkowy', age:30, number:'6', nationality:'Polska'},
  {firstName:'Piotr', lastName:'Żemło', position:'Obrońca środkowy', age:31, nationality:'Polska'},
  {firstName:'Hubert', lastName:'Kędziora', position:'Obrońca środkowy', age:18, nationality:'Polska'},
  {firstName:'Antoni', lastName:'Łukawski', position:'Obrońca środkowy', age:20, number:'11', nationality:'Polska'},
  {firstName:'Patryk', lastName:'Zaucha', position:'Obrońca boczny', age:26, nationality:'Polska'},
  {firstName:'Kamil', lastName:'Kort', position:'Pomocnik defensywny', age:23, nationality:'Polska'},
  {firstName:'Oskar', lastName:'Bystrek', position:'Pomocnik środkowy', age:20, number:'7', nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Radecki', position:'Pomocnik defensywny', age:33, number:'43', nationality:'Polska'},
  {firstName:'Igor', lastName:'Fedejko', position:'Pomocnik defensywny', age:22, nationality:'Polska'},
  {firstName:'Maciej', lastName:'Śliwa', position:'Pomocnik ofensywny', age:25, number:'10', nationality:'Polska'},
  {firstName:'Maksymilian', lastName:'Hebel', position:'Pomocnik ofensywny', age:29, number:'17', nationality:'Polska'},
  {firstName:'Hubert', lastName:'Tomalski', position:'Skrzydłowy', age:32, number:'19', nationality:'Polska'},
  {firstName:'Dawid', lastName:'Wolny', position:'Napastnik', age:31, number:'17', nationality:'Polska'},
  {firstName:'Adrian', lastName:'Piotrowski', position:'Napastnik', age:18, nationality:'Polska'},
].map(p => Object.assign({clubName:'Stal Stalowa Wola'}, p));

const SEED_PLAYERS_HUTNIK = [
  {firstName:'Damian', lastName:'Hoyo-Kowalski', position:'Bramkarz', age:20, number:'33', nationality:'Polska/Hiszpania'},
  {firstName:'Wiktor', lastName:'Nowak', position:'Bramkarz', age:19, number:'5', nationality:'Polska'},
  {firstName:'Dawid', lastName:'Burka', position:'Obrońca środkowy', age:26, number:'14', nationality:'Polska'},
  {firstName:'Krystian', lastName:'Bracik', position:'Obrońca środkowy', age:25, nationality:'Polska'},
  {firstName:'Valentine', lastName:'Nweke', position:'Obrońca środkowy', age:19, number:'79', nationality:'Nigeria'},
  {firstName:'Kacper', lastName:'Kopyściański', position:'Obrońca środkowy', age:17, number:'13', nationality:'Polska'},
  {firstName:'Maksymilian', lastName:'Gandziarowski', position:'Obrońca boczny', age:23, number:'15', nationality:'Polska'},
  {firstName:'Oliwier', lastName:'Soprych', position:'Obrońca boczny', age:21, nationality:'Polska'},
  {firstName:'Nazar', lastName:'Ponomarenko', position:'Pomocnik defensywny', age:21, nationality:'Ukraina/Węgry'},
  {firstName:'Mateusz', lastName:'Daniel', position:'Pomocnik środkowy', age:19, number:'16', nationality:'Polska/Irlandia'},
  {firstName:'Szymon', lastName:'Bil', position:'Pomocnik defensywny', age:18, number:'20', nationality:'Polska'},
  {firstName:'Ksawery', lastName:'Halo', position:'Pomocnik defensywny', age:17, number:'47', nationality:'Polska'},
  {firstName:'Igor', lastName:'Gałek', position:'Pomocnik defensywny', age:17, nationality:'Polska'},
  {firstName:'Nikita', lastName:'Kholodov', position:'Pomocnik środkowy', age:19, number:'37', nationality:'Ukraina'},
  {firstName:'Artem', lastName:'Motrych', position:'Skrzydłowy', age:20, nationality:'Ukraina'},
  {firstName:'Bartosz', lastName:'Florek', position:'Pomocnik ofensywny', age:21, number:'27', nationality:'Polska'},
  {firstName:'Marcin', lastName:'Budziński', position:'Pomocnik ofensywny', age:36, nationality:'Polska'},
  {firstName:'Oskar', lastName:'Kordykiewicz', position:'Pomocnik ofensywny', age:26, number:'11', nationality:'Polska'},
  {firstName:'Mikolaj', lastName:'Zieba', position:'Pomocnik ofensywny', age:22, number:'19', nationality:'Polska'},
  {firstName:'Kacper', lastName:'Rzepka', position:'Pomocnik ofensywny', age:17, number:'10', nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Sowiński', position:'Skrzydłowy', age:25, nationality:'Polska'},
  {firstName:'Yaroslav', lastName:'Dudchenko', position:'Skrzydłowy', age:19, nationality:'Ukraina'},
  {firstName:'Krystian', lastName:'Lelek', position:'Skrzydłowy', age:23, number:'77', nationality:'Polska'},
  {firstName:'Kacper', lastName:'Prusiński', position:'Napastnik', age:21, nationality:'Polska'},
].map(p => Object.assign({clubName:'Hutnik Kraków'}, p));

const SEED_PLAYERS_RESOVIA = [
  {firstName:'Kuba', lastName:'Bochniarz', position:'Bramkarz', age:17, nationality:'Polska'},
  {firstName:'Bartosz', lastName:'Skręt', position:'Bramkarz', age:18, nationality:'Polska'},
  {firstName:'Olaf', lastName:'Les', position:'Bramkarz', age:18, number:'1', nationality:'Polska'},
  {firstName:'Jakub', lastName:'Tetyk', position:'Bramkarz', age:18, number:'13', nationality:'Polska'},
  {firstName:'Mikołaj', lastName:'Kwiatek', position:'Bramkarz', age:17, number:'88', nationality:'Polska'},
  {firstName:'Bartosz', lastName:'Gacek', position:'Bramkarz', age:19, nationality:'Polska'},
  {firstName:'Myles', lastName:'Asei Dantoni', position:'Obrońca środkowy', age:19, nationality:'Polska'},
  {firstName:'Damian', lastName:'Oko', position:'Obrońca środkowy', age:29, number:'2', nationality:'Polska'},
  {firstName:'Jakub', lastName:'Banach', position:'Obrońca środkowy', age:27, number:'19', nationality:'Polska'},
  {firstName:'Bartosz', lastName:'Grasza', position:'Obrońca środkowy', age:26, number:'23', nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Geniec', position:'Obrońca środkowy', age:25, number:'21', nationality:'Polska'},
  {firstName:'Bartosz', lastName:'Ciszewski', position:'Obrońca boczny', age:20, number:'6', nationality:'Polska'},
  {firstName:'Adrian', lastName:'Małachowski', position:'Pomocnik defensywny', age:28, number:'10', nationality:'Polska'},
  {firstName:'Jakub', lastName:'Letniowski', position:'Pomocnik defensywny', age:25, nationality:'Polska'},
  {firstName:'Damian', lastName:'Kotecki', position:'Pomocnik defensywny', age:20, nationality:'Polska'},
  {firstName:'Rafał', lastName:'Bajek', position:'Pomocnik środkowy', number:'35', nationality:'Polska'},
  {firstName:'Miłosz', lastName:'Leśniak', position:'Pomocnik środkowy', age:18, number:'22', nationality:'Polska'},
  {firstName:'Kornel', lastName:'Rębisz', position:'Skrzydłowy', age:21, number:'3', nationality:'Polska'},
  {firstName:'Gracjan', lastName:'Czapniewski', position:'Skrzydłowy', age:18, number:'77', nationality:'Polska'},
  {firstName:'Patryk', lastName:'Romanowski', position:'Skrzydłowy', age:22, nationality:'Polska'},
  {firstName:'Filip', lastName:'Zawadzki', position:'Pomocnik ofensywny', age:22, nationality:'Polska'},
  {firstName:'Filip', lastName:'Mikrut', position:'Pomocnik ofensywny', age:22, number:'25', nationality:'Polska'},
  {firstName:'Gracjan', lastName:'Jaroch', position:'Pomocnik ofensywny', age:28, number:'98', nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Czyżycki', position:'Pomocnik ofensywny', age:28, number:'11', nationality:'Polska'},
  {firstName:'Bartosz', lastName:'Zimnicki', position:'Pomocnik ofensywny', age:20, number:'72', nationality:'Polska'},
  {firstName:'Mikołaj', lastName:'Szkiela', position:'Skrzydłowy', age:19, number:'7', nationality:'Polska'},
  {firstName:'Javier', lastName:'Mateo Ortíz', position:'Napastnik', age:23, number:'69', nationality:'Kolumbia'},
  {firstName:'Jan', lastName:'Silny', position:'Napastnik', age:31, nationality:'Czechy'},
  {firstName:'Piotr', lastName:'Matusek', position:'Napastnik', age:19, nationality:'Polska'},
].map(p => Object.assign({clubName:'Resovia'}, p));

const SEED_PLAYERS_LECHIA_ZG = [
  // Note: "Jakub Bursztyn" (Bramkarz) appears in the source under Lechia too, but he's already recorded
  // as a confirmed 2026/27 transfer TO Świt Szczecin — omitted here to avoid representing him at two clubs.
  {firstName:'Patryk', lastName:'Witaszczyk', position:'Bramkarz', age:18, nationality:'Polska'},
  {firstName:'Wiktor', lastName:'Urbanek', position:'Bramkarz', age:17, number:'1', nationality:'Polska'},
  {firstName:'Michal', lastName:'Ambrozy', position:'Bramkarz', age:19, number:'12', nationality:'Polska'},
  {firstName:'Daniel', lastName:'Słobodzian', position:'Bramkarz', age:19, number:'2', nationality:'Polska'},
  {firstName:'Kacper', lastName:'Lechowicz', position:'Obrońca środkowy', age:25, number:'6', nationality:'Polska'},
  {firstName:'Gibi', lastName:'Embaló', position:'Obrońca środkowy', age:27, number:'22', nationality:'Gwinea Bissau/Polska'},
  {firstName:'Michał', lastName:'Aleksandrowicz', position:'Obrońca środkowy', age:17, number:'3', nationality:'Polska'},
  {firstName:'Rafal', lastName:'Ostrowski', position:'Obrońca środkowy', age:30, nationality:'Polska'},
  {firstName:'Igor', lastName:'Kurowski', position:'Obrońca środkowy', age:22, number:'4', nationality:'Polska'},
  {firstName:'Paweł', lastName:'Flis', position:'Obrońca środkowy', age:24, number:'28', nationality:'Polska'},
  {firstName:'Bartosz', lastName:'Rutkowski', position:'Obrońca środkowy', age:21, number:'24', nationality:'Polska'},
  {firstName:'Michał', lastName:'Szmigiel', position:'Obrońca boczny', age:23, number:'15', nationality:'Polska'},
  {firstName:'Lukasz', lastName:'Mackowiak', position:'Pomocnik defensywny', age:23, number:'5', nationality:'Polska'},
  {firstName:'Franciszek', lastName:'Majchrzak', position:'Pomocnik środkowy', age:19, number:'9', nationality:'Polska'},
  {firstName:'Kamil', lastName:'Olek', position:'Pomocnik środkowy', age:23, number:'16', nationality:'Polska'},
  {firstName:'Maciej', lastName:'Szostak', position:'Pomocnik środkowy', age:19, number:'19', nationality:'Polska'},
  {firstName:'Marcel', lastName:'Kurek', position:'Pomocnik środkowy', age:17, number:'20', nationality:'Polska'},
  {firstName:'Szymon', lastName:'Osinski', position:'Pomocnik środkowy', age:21, number:'23', nationality:'Polska'},
  {firstName:'Filip', lastName:'Szczotko', position:'Pomocnik środkowy', age:17, number:'25', nationality:'Polska'},
  {firstName:'Marcjusz', lastName:'Balaj', position:'Pomocnik środkowy', number:'27', nationality:'Polska'},
  {firstName:'Tymon', lastName:'Ziarkowski', position:'Pomocnik środkowy', age:16, number:'8', nationality:'Polska'},
  {firstName:'Wiktor', lastName:'Nahrebecki', position:'Pomocnik środkowy', age:26, number:'75', nationality:'Polska'},
  {firstName:'Dominik', lastName:'Więcek', position:'Pomocnik środkowy', age:25, number:'13', nationality:'Polska'},
  {firstName:'Kuba', lastName:'Lizakowski', position:'Skrzydłowy', age:24, number:'21', nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Zientarski', position:'Skrzydłowy', age:21, number:'7', nationality:'Polska'},
  {firstName:'Przemysław', lastName:'Bargiel', position:'Pomocnik ofensywny', age:26, number:'77', nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Lisowski', position:'Skrzydłowy', age:25, number:'10', nationality:'Polska'},
  {firstName:'Przemysław', lastName:'Mycan', position:'Napastnik', age:31, number:'11', nationality:'Polska'},
  {firstName:'Jakub', lastName:'Kolodenny', position:'Napastnik', age:22, number:'17', nationality:'Polska'},
  {firstName:'Dawid', lastName:'Dębski', position:'Napastnik', age:19, nationality:'Polska'},
].map(p => Object.assign({clubName:'Lechia Zielona Góra'}, p));

const SEED_PLAYERS_ZAWISZA = [
  {firstName:'Michal', lastName:'Oczkowski', position:'Bramkarz', age:25, number:'46', nationality:'Polska'},
  {firstName:'Kamil', lastName:'Krawczyk', position:'Bramkarz', age:18, nationality:'Polska'},
  {firstName:'Adrian', lastName:'Czapranski', position:'Obrońca środkowy', age:20, nationality:'Polska'},
  {firstName:'Jakub', lastName:'Bonkowski', position:'Obrońca środkowy', number:'4', nationality:'Polska'},
  {firstName:'Sebastian', lastName:'Golak', position:'Obrońca środkowy', age:26, number:'24', nationality:'Polska'},
  {firstName:'Mikolaj', lastName:'Staniak', position:'Obrońca środkowy', age:23, number:'2', nationality:'Polska'},
  {firstName:'Mikołaj', lastName:'Dziarkowski', position:'Obrońca środkowy', age:21, number:'3', nationality:'Polska'},
  {firstName:'Mariusz', lastName:'Slawek', position:'Obrońca boczny', age:26, number:'23', nationality:'Polska'},
  {firstName:'Kacper', lastName:'Nowak', position:'Obrońca boczny', age:21, number:'8', nationality:'Polska'},
  {firstName:'Kacper', lastName:'Bogusiewicz', position:'Pomocnik defensywny', age:20, number:'10', nationality:'Polska'},
  {firstName:'Maciej', lastName:'Kona', position:'Pomocnik defensywny', age:29, number:'99', nationality:'Polska'},
  {firstName:'Łukasz', lastName:'Szramowski', position:'Pomocnik defensywny', age:24, number:'5', nationality:'Polska'},
  {firstName:'Tymon', lastName:'Paichert', position:'Pomocnik środkowy', age:17, number:'16', nationality:'Polska'},
  {firstName:'Filip', lastName:'Marciniak', position:'Pomocnik środkowy', age:17, number:'16', nationality:'Polska'},
  {firstName:'Gabriel', lastName:'Pietruszkiewicz', position:'Pomocnik środkowy', age:18, number:'77', nationality:'Polska'},
  {firstName:'Michal', lastName:'Cywinski', position:'Pomocnik środkowy', age:30, number:'22', nationality:'Polska'},
  {firstName:'Marcel', lastName:'Strzyżewski', position:'Skrzydłowy', age:21, number:'21', nationality:'Polska'},
  {firstName:'Wojciech', lastName:'Szumilas', position:'Pomocnik ofensywny', age:29, nationality:'Polska'},
  {firstName:'Bartosz', lastName:'Kuśmierczyk', position:'Pomocnik ofensywny', age:19, number:'14', nationality:'Polska'},
  {firstName:'Antoni', lastName:'Pralat', position:'Skrzydłowy', age:22, nationality:'Polska'},
  {firstName:'Mateusz', lastName:'Stępień', position:'Skrzydłowy', age:24, number:'11', nationality:'Polska'},
  {firstName:'Sebastian', lastName:'Rak', position:'Skrzydłowy', age:25, nationality:'Polska'},
  {firstName:'Maciej', lastName:'Mas', position:'Napastnik', age:25, number:'9', nationality:'Polska'},
  {firstName:'Filip', lastName:'Kozlowski', position:'Napastnik', age:31, nationality:'Polska'},
  {firstName:'Michal', lastName:'Kalitta', position:'Napastnik', age:24, nationality:'Polska'},
  {firstName:'Maciej', lastName:'Wanat', position:'Napastnik', age:19, nationality:'Polska'},
].map(p => Object.assign({clubName:'Zawisza Bydgoszcz'}, p));

const SEED_PLAYERS_GKS_TYCHY = [
  {firstName:'Jakub', lastName:'Mądrzyk', position:'Bramkarz', birthDate:'2003-12-04', notes:'Nowy transfer 2026/27: przyszedł z Przemszy Siewierz.'},
  {firstName:'Kacper', lastName:'Myszkowski', position:'Bramkarz', birthDate:'2008-11-07', notes:'Nr 13.'},
  {firstName:'Tymoteusz', lastName:'Proczek', position:'Bramkarz', birthDate:'2009-06-11', notes:'Nowy transfer 2026/27: przyszedł z Lechii Zielona Góra.'},
  {firstName:'Łukasz', lastName:'Tumala', position:'Obrońca środkowy', birthDate:'2006-03-08', notes:'Nowy transfer 2026/27: przyszedł z Admira Wacker, Austria.'},
  {firstName:'Matija', lastName:'Horvat', position:'Obrońca środkowy', birthDate:'1999-05-07', notes:'Narodowość: Chorwacja. Nowy transfer 2026/27: przyszedł z Hutnika Kraków.'},
  {firstName:'Daniel', lastName:'Hoyo-Kowalski', position:'Obrońca środkowy', birthDate:'2003-07-12', notes:'Narodowość: Polska/Hiszpania. Nr 26.'},
  {firstName:'Igor', lastName:'Łasicki', position:'Obrońca środkowy', birthDate:'1995-06-26', notes:'Nowy transfer 2026/27: przyszedł z Podlesianki Katowice.'},
  {firstName:'Bartosz', lastName:'Brzęk', position:'Obrońca środkowy', birthDate:'2009-01-15', notes:'Nowy transfer 2026/27: przyszedł z ŁKS Łomża.'},
  {firstName:'Józef', lastName:'Chorosiński', position:'Obrońca boczny', birthDate:'2007-06-26', notes:'Nowy transfer 2026/27: przyszedł z Górnika Zabrze.'},
  {firstName:'Paweł', lastName:'Olkowski', position:'Obrońca boczny', birthDate:'1990-02-13', notes:'Wartość rynkowa: 50 tys. €. Nowy transfer 2026/27: przyszedł z Wieczystej Kraków.'},
  {firstName:'Michał', lastName:'Trąbka', position:'Pomocnik defensywny', birthDate:'1997-04-22', notes:'Nowy transfer 2026/27: przyszedł ze Śląska Wrocław.'},
  {firstName:'Oskar', lastName:'Wojtczak', position:'Pomocnik defensywny', birthDate:'2004-06-15', notes:'Nowy transfer 2026/27: przyszedł z Zemplin Michalovce, Słowacja.'},
  {firstName:'Matus', lastName:'Begala', position:'Pomocnik środkowy', birthDate:'2001-04-07', notes:'Narodowość: Słowacja. Nowy transfer 2026/27: przyszedł ze Sparty Katowice.'},
  {firstName:'Milosz', lastName:'Krzak', position:'Skrzydłowy', birthDate:'2007-06-06', notes:'Nr 47.'},
  {firstName:'Bartosz', lastName:'Jankowski', position:'Skrzydłowy', birthDate:'2006-11-21', notes:'Nr 92.'},
  {firstName:'Damian', lastName:'Kądzior', position:'Pomocnik ofensywny', birthDate:'1992-06-16', notes:'Wartość rynkowa: 100 tys. €. Nowy transfer 2026/27: przyszedł z Lechii Tomaszów Mazowiecki.'},
  {firstName:'Piotr', lastName:'Gębala', position:'Pomocnik ofensywny', birthDate:'2007-01-21', notes:'Nr 44.'},
  {firstName:'Nico', lastName:'Baier', position:'Pomocnik ofensywny', birthDate:'2005-04-18', notes:'Narodowość: Polska/Niemcy. Nowy transfer 2026/27: przyszedł z Chojniczanki Chojnice.'},
  {firstName:'Marcin', lastName:'Kozina', position:'Skrzydłowy', birthDate:'2001-04-29', notes:'Nr 99.'},
  {firstName:'Tymoteusz', lastName:'Ryguła', position:'Napastnik', birthDate:'2008-05-31', notes:'Wartość rynkowa: 150 tys. €. Nowy transfer 2026/27: przyszedł z ŁKS Łódź.'},
  {firstName:'Mateusz', lastName:'Lewandowski', position:'Napastnik', birthDate:'1999-03-04', notes:'Nowy transfer 2026/27: przyszedł z Karkonoszy Jelenia Góra.'},
  {firstName:'Dawid', lastName:'Kasprzyk', position:'Napastnik', birthDate:'2000-01-08', notes:''},
].map(p => Object.assign({clubName:'GKS Tychy'}, p));

const SEED_PLAYERS_SOKOL_KLECZEW = [
  {firstName:'Adam', lastName:'Wójcik', position:'Bramkarz', birthDate:'2005-03-23', notes:'Wartość rynkowa: 125 tys. €. Nowy transfer 2026/27: przyszedł z Lecha Poznań II.'},
  {firstName:'Adrian', lastName:'Lis', position:'Bramkarz', birthDate:'1992-05-28', notes:'Nr 24.'},
  {firstName:'Bartosz', lastName:'Budziak', position:'Bramkarz', birthDate:'2005-08-21', notes:'Nr 24.'},
  {firstName:'Adam', lastName:'Broniszewski', position:'Bramkarz', birthDate:'2007-04-24', notes:'Nowy transfer 2026/27: przyszedł z Polonii Środa Wielkopolska.'},
  {firstName:'Wojciech', lastName:'Słowiński', position:'Obrońca środkowy', birthDate:'2006-01-19', notes:'Nowy transfer 2026/27: przyszedł z KKS 1925 Kalisz.'},
  {firstName:'Mateusz', lastName:'Wypych', position:'Obrońca środkowy', birthDate:'1998-01-10', notes:'Nr 3.'},
  {firstName:'Mateusz', lastName:'Gawlik', position:'Obrońca środkowy', birthDate:'1991-08-13', notes:'Nowy transfer 2026/27: przyszedł z Lipna Stęszew.'},
  {firstName:'Hubert', lastName:'Kaptur', position:'Obrońca środkowy', birthDate:'2003-10-29', notes:'Nowy transfer 2026/27: przyszedł z Rakowa Częstochowa II.'},
  {firstName:'Bartłomiej', lastName:'Zieliński', position:'Obrońca środkowy', birthDate:'2007-04-19', notes:''},
  {firstName:'Kacper', lastName:'Szymański', position:'Obrońca środkowy', birthDate:'2007-06-21', notes:'Nowy transfer 2026/27: przyszedł z Górnika Konin.'},
  {firstName:'Wojciech', lastName:'Wojtaszak', position:'Obrońca środkowy', birthDate:'2008-01-25', notes:'Nr 28.'},
  {firstName:'Volodymyr', lastName:'Kostevych', position:'Obrońca boczny', birthDate:'1992-10-23', notes:'Narodowość: Ukraina. Nr 2.'},
  {firstName:'Michał', lastName:'Zimmer', position:'Obrońca boczny', birthDate:'2000-03-08', notes:'Nr 15.'},
  {firstName:'Jan', lastName:'Andrzejewski', position:'Obrońca boczny', birthDate:'1998-04-08', notes:'Nr 27.'},
  {firstName:'Wiktor', lastName:'Smoliński', position:'Obrońca boczny', birthDate:'2004-06-20', notes:'Nowy transfer 2026/27: przyszedł z Odry Opole.'},
  {firstName:'Daniel', lastName:'Dudziński', position:'Pomocnik defensywny', birthDate:'2002-03-07', notes:'Nowy transfer 2026/27: przyszedł z Błękitnych Stargard.'},
  {firstName:'Mateusz', lastName:'Piotrowski', position:'Pomocnik defensywny', birthDate:'2001-01-30', notes:'Nr 25.'},
  {firstName:'Hubert', lastName:'Kupczak', position:'Pomocnik środkowy', birthDate:'2007-10-07', notes:'Nowy transfer 2026/27: przyszedł z Lechii Tomaszów Mazowiecki.'},
  {firstName:'Jacek', lastName:'Tkaczyk', position:'Skrzydłowy', birthDate:'2003-09-26', notes:'Nr 8.'},
  {firstName:'Mateusz', lastName:'Sopoćko', position:'Pomocnik ofensywny', birthDate:'1999-06-26', notes:'Nr 14.'},
  {firstName:'Filip', lastName:'Karbowy', position:'Pomocnik ofensywny', birthDate:'1997-09-03', notes:'Nowy transfer 2026/27: przyszedł z Polonii Golina.'},
  {firstName:'Jan', lastName:'Paczyński', position:'Pomocnik ofensywny', birthDate:'1997-07-03', notes:'Nowy transfer 2026/27: przyszedł z Górnika Zabrze II.'},
  {firstName:'Bartosz', lastName:'Kosiba', position:'Pomocnik ofensywny', birthDate:'2006-09-26', notes:'Nowy transfer 2026/27: przyszedł z Górnika Zabrze II.'},
  {firstName:'Filip', lastName:'Adamski', position:'Skrzydłowy', birthDate:'2007-05-21', notes:'Nr 9.'},
  {firstName:'Jakub', lastName:'Sangowski', position:'Skrzydłowy', birthDate:'2002-03-11', notes:'Nowy transfer 2026/27: przyszedł z Polonii Środa Wielkopolska.'},
  {firstName:'Adam', lastName:'Iwiński', position:'Skrzydłowy', birthDate:'2004-05-28', notes:'Nr 22.'},
  {firstName:'Aleksander', lastName:'Kubacki', position:'Skrzydłowy', birthDate:'2005-02-25', notes:'Nr 10.'},
  {firstName:'Dawid', lastName:'Retlewski', position:'Napastnik', birthDate:'1992-01-08', notes:'Nr 18.'},
  {firstName:'Antoni', lastName:'Kulawiak', position:'Napastnik', birthDate:'2005-01-26', notes:'Nr 9.'},
  {firstName:'Kacper', lastName:'Lewandowski', position:'Napastnik', birthDate:'2007-04-30', notes:''},
].map(p => Object.assign({clubName:'Sokół Kleczew'}, p));

const SEED_PLAYER_ENRICHMENT_AVIA_V2 = [
  {firstName:'Łukasz', lastName:'Jakubowski', clubName:'Avia Świdnik', birthDate:'2006-12-08'},
  {firstName:'Michał', lastName:'Kołodziejski', clubName:'Avia Świdnik', birthDate:'1993-05-09'},
  {firstName:'Marcin', lastName:'Kumorek', clubName:'Avia Świdnik', birthDate:'2003-03-08'},
  {firstName:'Mateusz', lastName:'Wójcik', clubName:'Avia Świdnik', birthDate:'2005-10-31'},
  {firstName:'Wojciech', lastName:'Karasiewicz', clubName:'Avia Świdnik', birthDate:'2006-09-30', correctPosition:'Skrzydłowy'},
  {firstName:'Egzon', lastName:'Kryeziu', clubName:'Avia Świdnik', birthDate:'2000-04-25', correctPosition:'Pomocnik ofensywny'},
  {firstName:'Grzegorz', lastName:'Aftyka', clubName:'Avia Świdnik', birthDate:'1998-02-02'},
  {firstName:'Kacper', lastName:'Wełniak', clubName:'Avia Świdnik', birthDate:'2000-05-21'},
];
// Marcinho (Podhale Nowy Targ) — wzbogacenie prawdziwymi danymi znalezionymi przez Transfermarkt
// (link podany przez użytkownika jako przykład); pełny profil zablokowany botom, ale wyszukiwarka
// ujawniła realne dane: pełne imię prawne, dokładna data urodzenia, wzrost, noga, agent.
const SEED_PLAYER_ENRICHMENT_MARCINHO = [
  {firstName:'Marcinho', lastName:'', clubName:'Podhale Nowy Targ', birthDate:'1996-10-29', height:176,
   agencyName:'S4S', notes:'Pełne imię i nazwisko: Márcio Manoel Oliveira da Silva Filho. Noga: prawa. W klubie od 20.08.2024, kontrakt do 30.06.2026 (transfermarkt.pl).'},
];
const SEED_PLAYER_ENRICHMENT_OLIMPIA = [
  {firstName:'Jakub', lastName:'Pawlak', clubName:'Olimpia Grudziądz', birthDate:'2008-02-01'},
  {firstName:'Oskar', lastName:'Klat', clubName:'Olimpia Grudziądz', birthDate:'2007-04-09'},
  {firstName:'Maciej', lastName:'Wichtowski', clubName:'Olimpia Grudziądz', birthDate:'1991-01-02'},
  {firstName:'Szymon', lastName:'Michalski', clubName:'Olimpia Grudziądz', birthDate:'2004-03-08'},
  {firstName:'Dawid', lastName:'Abramowicz', clubName:'Olimpia Grudziądz', birthDate:'1991-05-16', correctPosition:'Obrońca boczny'},
  {firstName:'Jakub', lastName:'Stec', clubName:'Olimpia Grudziądz', birthDate:'2005-02-15', correctPosition:'Pomocnik defensywny'},
  {firstName:'Dawid', lastName:'Olejarka', clubName:'Olimpia Grudziądz', birthDate:'2001-12-27', correctPosition:'Pomocnik ofensywny'},
  {firstName:'Filip', lastName:'Wilak', clubName:'Olimpia Grudziądz', birthDate:'2003-08-06', correctPosition:'Skrzydłowy'},
  {firstName:'Dawid', lastName:'Bałdyga', clubName:'Olimpia Grudziądz', birthDate:'2003-01-08'},
];

const SEED_PLAYERS_AVIA_V2 = [
  {firstName:'Andrzej', lastName:'Sobieszczyk', position:'Bramkarz', birthDate:'1993-05-05', notes:'Nr 31. Nowy transfer 2026/27: przyszedł z Rakowa Częstochowa II.'},
  {firstName:'Mateusz', lastName:'Białka', position:'Bramkarz', birthDate:'2006-10-30', notes:'Nr 1.'},
  {firstName:'Igor', lastName:'Bartnik', position:'Bramkarz', birthDate:'2005-06-30', notes:'Nowy transfer 2026/27: przyszedł z Pogoni Siedlce.'},
  {firstName:'Rafal', lastName:'Kursa', position:'Obrońca środkowy', birthDate:'1993-04-18', notes:'Nowy transfer 2026/27: przyszedł z Olimpii Grudziądz.'},
  {firstName:'Kacper', lastName:'Orzechowski', position:'Obrońca środkowy', birthDate:'2006-05-28', notes:'Nr 4.'},
  {firstName:'Kamil', lastName:'Rozmus', position:'Obrońca boczny', birthDate:'1994-01-13', notes:'Nr 26.'},
  {firstName:'Michał', lastName:'Wróblewski', position:'Obrońca boczny', birthDate:'2007-02-26', notes:'Nr 25.'},
  {firstName:'Damian', lastName:'Zbozien', position:'Obrońca boczny', birthDate:'1989-04-25', notes:'Nr 42.'},
  {firstName:'David', lastName:'Niepsuj', position:'Obrońca boczny', birthDate:'1995-08-16', notes:'Narodowość: Polska/Niemcy. Nr 17.'},
  {firstName:'Szymon', lastName:'Kaminski', position:'Pomocnik defensywny', birthDate:'1998-01-30', notes:'Nr 36.'},
  {firstName:'Kacper', lastName:'Jodłowski', position:'Pomocnik defensywny', birthDate:'1999-05-30', notes:'Nr 24.'},
  {firstName:'Pawel', lastName:'Uliczny', position:'Pomocnik środkowy', birthDate:'1995-10-06', notes:'Nowy transfer 2026/27: przyszedł z GKS Bełchatów.'},
  {firstName:'Marcin', lastName:'Pigiel', position:'Skrzydłowy', birthDate:'1998-02-15', notes:'Nowy transfer 2026/27: przyszedł z Unii Swarzędz.'},
  {firstName:'Wiktor', lastName:'Marek', position:'Skrzydłowy', birthDate:'2005-10-31', notes:'Nowy transfer 2026/27: przyszedł z Górnika Łęczna.'},
  {firstName:'Wojciech', lastName:'Kalinowski', position:'Skrzydłowy', birthDate:'1993-09-09', notes:'Nr 33.'},
  {firstName:'Kamil', lastName:'Wojtkowski', position:'Pomocnik ofensywny', birthDate:'1998-02-26', notes:'Nr 80.'},
  {firstName:'Bartosz', lastName:'Falbierski', position:'Pomocnik ofensywny', birthDate:'2005-09-12', notes:'Nr 9.'},
  {firstName:'Andriy', lastName:'Remenyuk', position:'Skrzydłowy', birthDate:'1999-02-03', notes:'Narodowość: Ukraina. Nr 15.'},
  {firstName:'Dave', lastName:'Djalme Assuncao', position:'Skrzydłowy', birthDate:'2002-06-01', notes:'Narodowość: Anglia/Angola. Nowy transfer 2026/27: przyszedł ze Świtu Szczecin.'},
  {firstName:'Michal', lastName:'Zuber', position:'Napastnik', birthDate:'1992-06-14', notes:'Nr 11.'},
  {firstName:'Dawid', lastName:'Łącki', position:'Napastnik', birthDate:'2005-03-09', notes:'Nr 27.'},
  {firstName:'Dominik', lastName:'Pisarek', position:'Napastnik', birthDate:'1999-06-07', notes:'Nr 99.'},
  {firstName:'Arkadiusz', lastName:'Maj', position:'Napastnik', birthDate:'1999-08-24', notes:''},
].map(p => Object.assign({clubName:'Avia Świdnik'}, p));

const SEED_PLAYERS_OLIMPIA_V2 = [
  {firstName:'Alan', lastName:'Hallmann', position:'Bramkarz', birthDate:'2009-07-06', notes:'Nr 33.'},
  {firstName:'Egor', lastName:'Budchan', position:'Bramkarz', birthDate:'2006-06-27', notes:'Narodowość: Białoruś/Polska. Nr 40.'},
  {firstName:'Filip', lastName:'Kondracik', position:'Bramkarz', birthDate:'2008-01-18', notes:'Nowy transfer 2026/27: przyszedł z Lecha Poznań II.'},
  {firstName:'Bartosz', lastName:'Zbiciak', position:'Obrońca środkowy', birthDate:'2001-01-17', notes:'Nowy transfer 2026/27: przyszedł z Arki Gdynia.'},
  {firstName:'Ivan', lastName:'Tsyupa', position:'Obrońca boczny', birthDate:'1993-06-25', notes:'Narodowość: Ukraina. Nr 14.'},
  {firstName:'Bartosz', lastName:'Brzęk', position:'Obrońca boczny', birthDate:'2005-12-01', notes:'Nr 32.'},
  {firstName:'Przemysław', lastName:'Stolc', position:'Obrońca boczny', birthDate:'1994-07-03', notes:'Nowy transfer 2026/27: przyszedł z Elany Toruń.'},
  {firstName:'Patryk', lastName:'Zabłoński', position:'Obrońca boczny', birthDate:'2006-08-30', notes:'Nowy transfer 2026/27: przyszedł z Puszczy Niepołomice.'},
  {firstName:'Karol', lastName:'Fietz', position:'Pomocnik defensywny', birthDate:'2003-07-16', notes:'Nr 42.'},
  {firstName:'Adam', lastName:'Kardaś', position:'Pomocnik defensywny', birthDate:'2006-08-23', notes:'Nowy transfer 2026/27: przyszedł z Unii Solec Kujawski.'},
  {firstName:'Wojciech', lastName:'Goralski', position:'Pomocnik defensywny', birthDate:'2006-08-04', notes:'Nowy transfer 2026/27: przyszedł z Tłuchowii Tłuchowo.'},
  {firstName:'Maciej', lastName:'Quaium', position:'Pomocnik defensywny', birthDate:'2007-08-09', notes:'Nr 70.'},
  {firstName:'Filip', lastName:'Nowacki', position:'Pomocnik defensywny', birthDate:'2009-02-24', notes:'Nowy transfer 2026/27: przyszedł z Wisły Kraków.'},
  {firstName:'Kacper', lastName:'Cichoń', position:'Pomocnik ofensywny', birthDate:'2001-10-02', notes:'Nr 44.'},
  {firstName:'Dominik', lastName:'Frelek', position:'Pomocnik ofensywny', birthDate:'2001-10-11', notes:'Nowy transfer 2026/27: przyszedł z Lecha Poznań II.'},
  {firstName:'Artur', lastName:'Siemaszko', position:'Skrzydłowy', birthDate:'1997-01-06', notes:'Nr 18.'},
  {firstName:'Kacper', lastName:'Jarzec', position:'Skrzydłowy', birthDate:'2005-01-31', notes:'Nowy transfer 2026/27: przyszedł z Cartusii Kartuzy.'},
  {firstName:'Alex', lastName:'Kolasa', position:'Skrzydłowy', birthDate:'2006-10-03', notes:'Narodowość: Polska/Irlandia. Nowy transfer 2026/27: przyszedł z Resovii.'},
].map(p => Object.assign({clubName:'Olimpia Grudziądz'}, p));

// === I liga 2026/2027 — składy 18 klubów, źródło: Transfermarkt (kader, plus/1 widok szczegółowy),
// pobrane 2026-07-21. Numer/wartość rynkowa/narodowość (gdy nie-polska) trafiają do notatek przez
// importClubRoster, tak jak w pozostałych blokach SEED_PLAYERS_* powyżej.
const SEED_PLAYERS_ILIGA_LECHIA_GDANSK = [
  {firstName:'Szymon', lastName:'Weirauch', position:'Bramkarz', birthDate:'2004-03-05', height:193, number:'1', marketValue:'250 tys. €'},
  {firstName:'Kacper', lastName:'Gutowski', position:'Bramkarz', birthDate:'2006-06-15', height:187, number:'81', marketValue:'25 tys. €'},
  {firstName:'Bujar', lastName:'Pllana', position:'Obrońca środkowy', birthDate:'2001-10-29', height:190, number:'4', marketValue:'600 tys. €', nationality:'Albania/Kosowo'},
  {firstName:'Indrit', lastName:'Mavraj', position:'Obrońca środkowy', birthDate:'2006-01-23', height:195, number:'76', marketValue:'100 tys. €', nationality:'Kosowo/Szwajcaria'},
  {firstName:'Wojciech', lastName:'Madej', position:'Obrońca środkowy', birthDate:'2007-09-24'},
  {firstName:'Danylo', lastName:'Malov', position:'Obrońca boczny', birthDate:'2007-01-28', height:175, number:'3', marketValue:'125 tys. €', nationality:'Ukraina'},
  {firstName:'Antoni', lastName:'Ziółkowski', position:'Obrońca boczny', birthDate:'2007-03-29', number:'22'},
  {firstName:'Samuel', lastName:'Kopasek', position:'Obrońca boczny', birthDate:'2003-05-22', height:175, number:'19', marketValue:'600 tys. €', nationality:'Słowacja'},
  {firstName:'Tomasz', lastName:'Wójtowicz', position:'Obrońca boczny', birthDate:'2003-12-19', height:180, number:'33', marketValue:'350 tys. €'},
  {firstName:'Alvis', lastName:'Jaunzems', position:'Obrońca boczny', birthDate:'1999-06-16', height:179, number:'16', marketValue:'300 tys. €', nationality:'Łotwa'},
  {firstName:'Ivan', lastName:'Zhelizko', position:'Pomocnik defensywny', birthDate:'2001-02-12', height:187, number:'5', marketValue:'4,00 mln €', nationality:'Ukraina'},
  {firstName:'Jakub', lastName:'Adkonis', position:'Pomocnik defensywny', birthDate:'2007-06-10', height:184, number:'88', marketValue:'400 tys. €'},
  {firstName:'Bartosz', lastName:'Szczepankiewicz', position:'Pomocnik defensywny', birthDate:'2006-12-10', height:186},
  {firstName:'Rifet', lastName:'Kapic', position:'Pomocnik ofensywny', birthDate:'1995-07-03', height:179, number:'10', marketValue:'800 tys. €', nationality:'Bośnia i Hercegowina'},
  {firstName:'Tomasz', lastName:'Neugebauer', position:'Pomocnik ofensywny', birthDate:'2003-05-08', height:182, number:'99', marketValue:'600 tys. €'},
  {firstName:'Bogdan', lastName:'Viunnyk', position:'Pomocnik ofensywny', birthDate:'2002-05-21', height:189, number:'7', marketValue:'500 tys. €', nationality:'Ukraina'},
  {firstName:'Kacper', lastName:'Sezonienko', position:'Skrzydłowy', birthDate:'2003-03-23', height:193, number:'79', marketValue:'600 tys. €'},
  {firstName:'Igor', lastName:'Bambecki', position:'Skrzydłowy', birthDate:'2005-02-06', height:180, number:'49'},
  {firstName:'Camilo', lastName:'Mena', position:'Skrzydłowy', birthDate:'2002-10-01', height:175, number:'11', marketValue:'4,00 mln €', nationality:'Kolumbia'},
  {firstName:'Tomas', lastName:'Bobcek', position:'Napastnik', birthDate:'2001-09-08', height:187, number:'89', marketValue:'8,00 mln €', nationality:'Słowacja'},
  {firstName:'Michał', lastName:'Głogowski', position:'Napastnik', birthDate:'2005-08-04', height:190, number:'21', marketValue:'150 tys. €'},
  {firstName:'Martin', lastName:'Szczerbiński', position:'Napastnik', birthDate:'2011-01-04', height:180},
  {firstName:'Dorian', lastName:'Sinkiewicz', position:'Napastnik', birthDate:'2009-01-31', height:197, number:'77'},
].map(p => Object.assign({clubName:'Lechia Gdańsk'}, p));

const SEED_PLAYERS_ILIGA_ARKA_GDYNIA = [
  {firstName:'Dawid', lastName:'Arndt', position:'Bramkarz', birthDate:'2001-09-22', height:190, number:'99', marketValue:'250 tys. €'},
  {firstName:'Jędrzej', lastName:'Grobelny', position:'Bramkarz', birthDate:'2001-06-28', height:190, number:'33', marketValue:'150 tys. €'},
  {firstName:'Kacper', lastName:'Krzepisz', position:'Bramkarz', birthDate:'1999-12-16', height:190, number:'30', marketValue:'50 tys. €'},
  {firstName:'Marco', lastName:'Komenda', position:'Obrońca środkowy', birthDate:'1996-11-26', height:184, number:'4', marketValue:'700 tys. €', nationality:'Niemcy/Chorwacja'},
  {firstName:'Serafin', lastName:'Szota', position:'Obrońca środkowy', birthDate:'1999-03-04', height:187, number:'3', marketValue:'250 tys. €'},
  {firstName:'Javi', lastName:'Domínguez', position:'Obrońca środkowy', birthDate:'2001-03-26', height:195, number:'44', marketValue:'200 tys. €', nationality:'Hiszpania'},
  {firstName:'Kamil', lastName:'Górecki', position:'Obrońca środkowy', birthDate:'2005-05-30', height:181},
  {firstName:'Dawid', lastName:'Gojny', position:'Obrońca boczny', birthDate:'1994-08-31', height:178, number:'94', marketValue:'200 tys. €'},
  {firstName:'Wojciech', lastName:'Zacharewicz', position:'Obrońca boczny', birthDate:'2006-06-23', height:185, number:'80'},
  {firstName:'Kasjan', lastName:'Lipkowski', position:'Obrońca boczny', birthDate:'2003-03-28', height:190, number:'6', marketValue:'150 tys. €'},
  {firstName:'Konrad', lastName:'Gruszkowski', position:'Obrońca boczny', birthDate:'2001-01-27', height:183, number:'20', marketValue:'150 tys. €'},
  {firstName:'Dominik', lastName:'Kun', position:'Pomocnik defensywny', birthDate:'1993-06-22', height:171, number:'14', marketValue:'250 tys. €'},
  {firstName:'Szymon', lastName:'Lewkot', position:'Pomocnik defensywny', birthDate:'1999-02-18', height:187, number:'23', marketValue:'250 tys. €'},
  {firstName:'Maksymilian', lastName:'Sznaucner', position:'Pomocnik defensywny', birthDate:'2006-03-30', height:176, number:'27', marketValue:'175 tys. €', nationality:'Polska/Grecja'},
  {firstName:'Michał', lastName:'Rzuchowski', position:'Pomocnik defensywny', birthDate:'1993-12-27', height:175, number:'22', marketValue:'100 tys. €'},
  {firstName:'Jakub', lastName:'Staniszewski', position:'Pomocnik defensywny', birthDate:'2005-07-11', height:178, number:'31', marketValue:'100 tys. €'},
  {firstName:'Nikodem', lastName:'Gozdecki', position:'Pomocnik defensywny', birthDate:'2006-11-02'},
  {firstName:'Alassane', lastName:'Sidibe', position:'Pomocnik ofensywny', birthDate:'2002-06-09', height:180, number:'8', marketValue:'250 tys. €', nationality:'Wybrzeże Kości Słoniowej'},
  {firstName:'Hide', lastName:'Vitalucci', position:'Pomocnik ofensywny', birthDate:'2002-03-05', height:176, number:'10', marketValue:'150 tys. €', nationality:'Japonia/Włochy'},
  {firstName:'Bartłomiej', lastName:'Pawłowski', position:'Pomocnik ofensywny', birthDate:'1992-11-13', height:178, number:'19', marketValue:'150 tys. €'},
  {firstName:'Filip', lastName:'Waluś', position:'Pomocnik ofensywny', birthDate:'2005-02-10', height:170, number:'77'},
  {firstName:'Dawid', lastName:'Kocyła', position:'Skrzydłowy', birthDate:'2002-07-23', height:180, number:'11', marketValue:'300 tys. €'},
  {firstName:'Jakub', lastName:'Kowalski', position:'Skrzydłowy', birthDate:'2006-02-05', height:175, number:'71', marketValue:'75 tys. €'},
  {firstName:'Kuba', lastName:'Solecki', position:'Skrzydłowy', birthDate:'2007-02-09', height:174, number:'16'},
  {firstName:'Michał', lastName:'Milewski', position:'Skrzydłowy', birthDate:'2005-11-29', height:180, number:'39'},
  {firstName:'Vladislavs', lastName:'Gutkovskis', position:'Napastnik', birthDate:'1995-04-02', height:187, number:'9', marketValue:'350 tys. €', nationality:'Łotwa'},
  {firstName:'Elmedin', lastName:'Rama', position:'Napastnik', birthDate:'2005-03-25', height:190, number:'98', marketValue:'250 tys. €', nationality:'Albania/Kosowo'},
].map(p => Object.assign({clubName:'Arka Gdynia'}, p));

const SEED_PLAYERS_ILIGA_POLONIA_WARSCHAU = [
  {firstName:'Mateusz', lastName:'Jeleń', position:'Bramkarz', birthDate:'2007-02-02', height:195, number:'71', marketValue:'200 tys. €'},
  {firstName:'Mateusz', lastName:'Kuchta', position:'Bramkarz', birthDate:'1996-02-05', height:188, number:'96', marketValue:'200 tys. €'},
  {firstName:'Adrian', lastName:'Sandach', position:'Bramkarz', birthDate:'2004-05-19', height:190, number:'1', marketValue:'25 tys. €'},
  {firstName:'Märten', lastName:'Kuusk', position:'Obrońca środkowy', birthDate:'1996-04-05', height:182, number:'2', marketValue:'250 tys. €', nationality:'Estonia'},
  {firstName:'Jakub', lastName:'Budnicki', position:'Obrońca środkowy', birthDate:'2001-07-19', height:190, number:'16', marketValue:'250 tys. €'},
  {firstName:'Michał', lastName:'Marcjanik', position:'Obrońca środkowy', birthDate:'1994-12-15', height:188, number:'29', marketValue:'200 tys. €'},
  {firstName:'Aleksander', lastName:'Golos', position:'Obrońca środkowy', birthDate:'2007-08-24', height:192},
  {firstName:'Davíd Kristján', lastName:'Ólafsson', position:'Obrońca boczny', birthDate:'1995-05-15', height:184, number:'20', marketValue:'450 tys. €', nationality:'Islandia'},
  {firstName:'Patryk', lastName:'Janasik', position:'Obrońca boczny', birthDate:'1997-08-25', height:178, number:'97', marketValue:'175 tys. €'},
  {firstName:'Ernest', lastName:'Terpiłowski', position:'Obrońca boczny', birthDate:'2001-09-14', height:178, number:'24', marketValue:'150 tys. €'},
  {firstName:'Paweł', lastName:'Olszewski', position:'Obrońca boczny', birthDate:'1999-06-07', height:178, number:'22', marketValue:'100 tys. €'},
  {firstName:'Mikołaj', lastName:'Gorzędowski', position:'Obrońca boczny', birthDate:'2008-10-06', height:180, number:'14'},
  {firstName:'Tomasz', lastName:'Makowski', position:'Pomocnik defensywny', birthDate:'1999-07-19', height:179, number:'36', marketValue:'250 tys. €'},
  {firstName:'Benedykt', lastName:'Piotrowski', position:'Pomocnik defensywny', birthDate:'2005-07-09', height:173, number:'44', marketValue:'150 tys. €'},
  {firstName:'Jakub', lastName:'Paszkowski', position:'Pomocnik defensywny', birthDate:'2006-09-16', height:178},
  {firstName:'Antoni', lastName:'Nerek', position:'Pomocnik defensywny', birthDate:'2006-01-29'},
  {firstName:'Krystian', lastName:'Tabara', position:'Skrzydłowy', birthDate:'2001-08-04', height:189, number:'26', marketValue:'200 tys. €'},
  {firstName:'Oliwier', lastName:'Wojciechowski', position:'Pomocnik ofensywny', birthDate:'2005-04-05', height:172, number:'8', marketValue:'250 tys. €'},
  {firstName:'Dave', lastName:'Gnaase', position:'Pomocnik ofensywny', birthDate:'1996-12-14', height:179, number:'6', marketValue:'200 tys. €', nationality:'Niemcy'},
  {firstName:'Nikita', lastName:'Vasin', position:'Pomocnik ofensywny', birthDate:'2006-03-01', height:183, number:'19', marketValue:'200 tys. €', nationality:'Ukraina/Polska'},
  {firstName:'Marek', lastName:'Mróz', position:'Pomocnik ofensywny', birthDate:'1999-02-18', height:179, number:'10', marketValue:'150 tys. €'},
  {firstName:'Dani', lastName:'Vega', position:'Skrzydłowy', birthDate:'1997-01-11', height:176, number:'7', marketValue:'200 tys. €', nationality:'Hiszpania'},
  {firstName:'İlkay', lastName:'Durmuş', position:'Skrzydłowy', birthDate:'1994-05-01', height:180, number:'99', marketValue:'150 tys. €', nationality:'Turcja/Niemcy'},
  {firstName:'Mateusz', lastName:'Młyński', position:'Skrzydłowy', birthDate:'2001-01-02', height:178, number:'11', marketValue:'100 tys. €'},
  {firstName:'Antoni', lastName:'Kapusta', position:'Skrzydłowy', birthDate:'2009-09-05', height:185, number:'21', marketValue:'25 tys. €'},
  {firstName:'Robert', lastName:'Dadok', position:'Skrzydłowy', birthDate:'1996-12-24', height:184, number:'17', marketValue:'250 tys. €'},
  {firstName:'Simon', lastName:'Skrabb', position:'Skrzydłowy', birthDate:'1995-01-19', height:174, number:'23', marketValue:'150 tys. €', nationality:'Finlandia'},
  {firstName:'Kacper', lastName:'Kostorz', position:'Napastnik', birthDate:'1999-08-21', height:191, number:'9', marketValue:'150 tys. €'},
  {firstName:'Kacper', lastName:'Ziółkowski', position:'Napastnik', birthDate:'2009-09-26', number:'18'},
].map(p => Object.assign({clubName:'Polonia Warszawa'}, p));

const SEED_PLAYERS_ILIGA_MIEDZ_LEGNICA = [
  {firstName:'Ivan', lastName:'Lucic', position:'Bramkarz', birthDate:'1995-03-23', height:194, number:'72', marketValue:'250 tys. €', nationality:'Austria/Chorwacja'},
  {firstName:'Vitaliy', lastName:'Dyachenko', position:'Bramkarz', birthDate:'2006-01-09', height:198, number:'78', marketValue:'25 tys. €', nationality:'Ukraina'},
  {firstName:'Dmytro', lastName:'Sydorenko', position:'Bramkarz', birthDate:'2002-11-12', height:197, nationality:'Ukraina'},
  {firstName:'Krzysztof', lastName:'Narożny', position:'Bramkarz', birthDate:'2010-02-27', height:193, number:'12'},
  {firstName:'Franciszek', lastName:'Chojak', position:'Bramkarz', birthDate:'2005-01-29', height:197, number:'33'},
  {firstName:'Myroslav', lastName:'Mazur', position:'Obrońca środkowy', birthDate:'1998-08-11', height:194, marketValue:'300 tys. €', nationality:'Ukraina'},
  {firstName:'Karol', lastName:'Noiszewski', position:'Obrońca środkowy', birthDate:'1999-11-13', height:193, marketValue:'250 tys. €'},
  {firstName:'Mateusz', lastName:'Grudziński', position:'Obrońca środkowy', birthDate:'2000-06-20', height:188, number:'3', marketValue:'200 tys. €'},
  {firstName:'Milos', lastName:'Jovicic', position:'Obrońca środkowy', birthDate:'1995-01-29', height:189, number:'15', marketValue:'150 tys. €', nationality:'Serbia/Austria'},
  {firstName:'Babacar', lastName:'Diallo', position:'Obrońca środkowy', birthDate:'2005-08-18', height:188, marketValue:'100 tys. €', nationality:'Senegal'},
  {firstName:'Adnan', lastName:'Kovacevic', position:'Obrońca środkowy', birthDate:'1993-09-09', height:189, number:'5', marketValue:'75 tys. €', nationality:'Bośnia i Hercegowina'},
  {firstName:'Wojciech', lastName:'Hajda', position:'Pomocnik defensywny', birthDate:'2000-05-23', height:182, marketValue:'200 tys. €'},
  {firstName:'Jakub', lastName:'Serafin', position:'Pomocnik defensywny', birthDate:'1996-05-25', height:181, number:'8', marketValue:'200 tys. €'},
  {firstName:'Zvonimir', lastName:'Petrovic', position:'Pomocnik defensywny', birthDate:'2000-12-11', height:182, number:'80', marketValue:'200 tys. €', nationality:'Bośnia i Hercegowina/Chorwacja'},
  {firstName:'Juliusz', lastName:'Letniowski', position:'Pomocnik defensywny', birthDate:'1998-04-08', height:183, number:'27', marketValue:'150 tys. €'},
  {firstName:'Filip', lastName:'Żur', position:'Pomocnik środkowy', birthDate:'2007-10-30'},
  {firstName:'Marceli', lastName:'Żwan', position:'Pomocnik defensywny', birthDate:'2008-01-26', number:'51'},
  {firstName:'Mateusz', lastName:'Bochnak', position:'Skrzydłowy', birthDate:'1998-02-11', height:179, number:'7', marketValue:'150 tys. €'},
  {firstName:'Jacek', lastName:'Podgórski', position:'Skrzydłowy', birthDate:'1996-06-23', height:180, number:'6', marketValue:'75 tys. €'},
  {firstName:'Wojciech', lastName:'Rezacz', position:'Skrzydłowy', birthDate:'2008-06-28', height:183, number:'69', marketValue:'25 tys. €'},
  {firstName:'Oliwier', lastName:'Szymoniak', position:'Skrzydłowy', birthDate:'2006-12-15', height:180, number:'49', marketValue:'350 tys. €'},
  {firstName:'Gustaf', lastName:'Norlin', position:'Skrzydłowy', birthDate:'1997-01-09', height:183, marketValue:'200 tys. €', nationality:'Szwecja'},
  {firstName:'Igor', lastName:'Maliszewski', position:'Skrzydłowy', birthDate:'2007-11-06', height:186, number:'17', marketValue:'10 tys. €'},
  {firstName:'Szymon', lastName:'Pączek', position:'Skrzydłowy', birthDate:'2008-05-13', height:174, number:'88'},
  {firstName:'Asier', lastName:'Córdoba', position:'Pomocnik ofensywny', birthDate:'2000-03-31', height:184, number:'18', marketValue:'350 tys. €', nationality:'Hiszpania'},
  {firstName:'Kamil', lastName:'Antonik', position:'Pomocnik ofensywny', birthDate:'1998-11-28', height:184, number:'98', marketValue:'300 tys. €'},
  {firstName:'Jarosław', lastName:'Czerwik', position:'Pomocnik ofensywny', birthDate:'2008-06-16', height:175},
  {firstName:'Daniel', lastName:'Stanclik', position:'Napastnik', birthDate:'2000-03-22', height:188, number:'21', marketValue:'300 tys. €'},
  {firstName:'Kristian', lastName:'Fucak', position:'Napastnik', birthDate:'1998-11-14', height:193, marketValue:'200 tys. €', nationality:'Chorwacja'},
  {firstName:'Marcel', lastName:'Mansfeld', position:'Napastnik', birthDate:'2001-06-23', height:194, number:'95', marketValue:'175 tys. €', nationality:'Niemcy/Polska'},
  {firstName:'Mame Mody', lastName:'Sy', position:'Napastnik', birthDate:'2007-03-08', marketValue:'10 tys. €', nationality:'Senegal'},
  {firstName:'Sebastian', lastName:'Herbut', position:'Napastnik', birthDate:'2008-10-18'},
  {firstName:'Modou', lastName:'Keita', position:'Napastnik', birthDate:'2006-01-02', height:192, number:'91', nationality:'Gambia'},
].map(p => Object.assign({clubName:'Miedź Legnica'}, p));

const SEED_PLAYERS_ILIGA_LKS_LODZ = [
  {firstName:'Damian', lastName:'Węglarz', position:'Bramkarz', birthDate:'1996-03-21', height:189, number:'77', marketValue:'250 tys. €'},
  {firstName:'Łukasz', lastName:'Bomba', position:'Bramkarz', birthDate:'2004-04-09', height:199, number:'1', marketValue:'150 tys. €'},
  {firstName:'Mikołaj', lastName:'Ćwikliński', position:'Bramkarz', birthDate:'2010-02-21', height:187, number:'12'},
  {firstName:'James', lastName:'Rhodes', position:'Bramkarz', birthDate:'2007-11-05', number:'40', nationality:'Kanada/Stany Zjednoczone'},
  {firstName:'Artur', lastName:'Crăciun', position:'Obrońca środkowy', birthDate:'1998-06-29', height:193, number:'22', marketValue:'350 tys. €', nationality:'Mołdawia/Rumunia'},
  {firstName:'Krzysztof', lastName:'Fałowski', position:'Obrońca środkowy', birthDate:'2007-04-06', height:192, number:'3', marketValue:'300 tys. €'},
  {firstName:'Bartosz', lastName:'Farbiszewski', position:'Obrońca środkowy', birthDate:'2002-12-17', height:194, number:'4', marketValue:'200 tys. €'},
  {firstName:'Sebastian', lastName:'Rudol', position:'Obrońca środkowy', birthDate:'1995-02-21', height:185, number:'6', marketValue:'150 tys. €'},
  {firstName:'Łukasz', lastName:'Wiech', position:'Obrońca środkowy', birthDate:'1997-03-25', height:194, number:'5', marketValue:'75 tys. €'},
  {firstName:'Mateusz', lastName:'Kupczak', position:'Obrońca środkowy', birthDate:'1992-02-20', height:187, number:'21', marketValue:'50 tys. €'},
  {firstName:'Szymon', lastName:'Frakowski', position:'Obrońca boczny', birthDate:'2007-07-25', height:186, number:'14'},
  {firstName:'Kacper', lastName:'Terlecki', position:'Pomocnik defensywny', birthDate:'2005-07-31', height:183, number:'88', marketValue:'300 tys. €'},
  {firstName:'Mateusz', lastName:'Wysokiński', position:'Pomocnik defensywny', birthDate:'2002-03-19', height:182, number:'20', marketValue:'200 tys. €'},
  {firstName:'Michał', lastName:'Kaput', position:'Pomocnik defensywny', birthDate:'1998-02-18', height:185, number:'28', marketValue:'200 tys. €'},
  {firstName:'Julian', lastName:'Keiblinger', position:'Skrzydłowy', birthDate:'2001-05-18', height:176, number:'37', marketValue:'250 tys. €', nationality:'Austria'},
  {firstName:'Dominik', lastName:'Sokół', position:'Skrzydłowy', birthDate:'1999-05-16', height:185, number:'7', marketValue:'150 tys. €'},
  {firstName:'Sergiy', lastName:'Krykun', position:'Skrzydłowy', birthDate:'1996-09-22', height:175, number:'27', marketValue:'125 tys. €', nationality:'Ukraina'},
  {firstName:'Marcel', lastName:'Błachewicz', position:'Skrzydłowy', birthDate:'2003-05-06', height:187, number:'11', marketValue:'175 tys. €'},
  {firstName:'Antoni', lastName:'Młynarczyk', position:'Skrzydłowy', birthDate:'2005-05-03', height:186, number:'15', marketValue:'150 tys. €'},
  {firstName:'Mateusz', lastName:'Książek', position:'Skrzydłowy', birthDate:'2007-07-06', height:173, number:'26', marketValue:'75 tys. €'},
  {firstName:'Lenard', lastName:'Szczygieł', position:'Skrzydłowy', birthDate:'2008-08-24', height:186, number:'33', marketValue:'10 tys. €'},
  {firstName:'Kacper', lastName:'Nowakowski', position:'Pomocnik ofensywny', birthDate:'2006-06-19', height:177, number:'19', marketValue:'300 tys. €'},
  {firstName:'Koki', lastName:'Hinokio', position:'Pomocnik ofensywny', birthDate:'2001-02-26', height:165, number:'34', marketValue:'250 tys. €', nationality:'Japonia'},
  {firstName:'Sebastian', lastName:'Sopel', position:'Pomocnik ofensywny', birthDate:'2009-07-02', height:174, number:'9'},
  {firstName:'Andreu', lastName:'Arasa', position:'Napastnik', birthDate:'1999-05-21', height:179, number:'13', marketValue:'200 tys. €', nationality:'Hiszpania'},
  {firstName:'Karol', lastName:'Podliński', position:'Napastnik', birthDate:'1997-11-06', height:194, number:'99', marketValue:'150 tys. €'},
  {firstName:'Fabian', lastName:'Piasecki', position:'Napastnik', birthDate:'1995-05-04', height:186, number:'18', marketValue:'150 tys. €'},
  {firstName:'Alan', lastName:'Siwek', position:'Napastnik', birthDate:'2007-08-11', height:182, number:'32'},
  {firstName:'Fabian', lastName:'Olejniczak', position:'Napastnik', birthDate:'2009-04-16', height:175, number:'77'},
].map(p => Object.assign({clubName:'ŁKS Łódź'}, p));

const SEED_PLAYERS_ILIGA_ODRA_OPOLE = [
  {firstName:'Miłosz', lastName:'Mleczko', position:'Bramkarz', birthDate:'1999-03-01', height:191, marketValue:'150 tys. €'},
  {firstName:'Artur', lastName:'Haluch', position:'Bramkarz', birthDate:'1995-07-23', height:192, number:'30', marketValue:'75 tys. €'},
  {firstName:'Jan', lastName:'Druzbicki', position:'Bramkarz', birthDate:'2006-07-24', height:185},
  {firstName:'Kacper', lastName:'Jureczko', position:'Bramkarz', birthDate:'2007-04-30'},
  {firstName:'Cezary', lastName:'Glomb', position:'Bramkarz', birthDate:'2007-02-28', number:'12'},
  {firstName:'Maksymilian', lastName:'Pingot', position:'Obrońca środkowy', birthDate:'2003-04-01', height:188, marketValue:'250 tys. €'},
  {firstName:'Nemanja', lastName:'Mijušković', position:'Obrońca środkowy', birthDate:'1992-03-04', height:185, marketValue:'100 tys. €', nationality:'Czarnogóra/Serbia'},
  {firstName:'Jiri', lastName:'Piroch', position:'Obrońca środkowy', birthDate:'1995-08-31', height:187, number:'3', marketValue:'100 tys. €', nationality:'Czechy'},
  {firstName:'Jakub', lastName:'Pochcioł', position:'Obrońca środkowy', birthDate:'2003-08-26', height:185, number:'6', marketValue:'100 tys. €'},
  {firstName:'Marcel', lastName:'Białowąs', position:'Obrońca środkowy', birthDate:'2006-11-13', height:190, number:'47', marketValue:'100 tys. €'},
  {firstName:'', lastName:'Cássio', position:'Obrońca środkowy', birthDate:'1999-07-16', height:187, marketValue:'100 tys. €', nationality:'Brazylia'},
  {firstName:'Pawel', lastName:'Krysiak', position:'Obrońca środkowy', birthDate:'2005-10-11'},
  {firstName:'Tomasz', lastName:'Gajda', position:'Pomocnik defensywny', birthDate:'1995-12-18', height:182, marketValue:'200 tys. €'},
  {firstName:'Jan', lastName:'Debski', position:'Pomocnik defensywny', birthDate:'2005-01-21', height:172},
  {firstName:'Marcin', lastName:'Staś', position:'Pomocnik środkowy', birthDate:'2008-09-23', number:'22'},
  {firstName:'Mateusz', lastName:'Spychała', position:'Skrzydłowy', birthDate:'1998-01-28', height:171, marketValue:'175 tys. €'},
  {firstName:'Franciszek', lastName:'Franczak', position:'Skrzydłowy', birthDate:'2007-08-16', height:176, number:'7', marketValue:'125 tys. €', nationality:'Polska/Szkocja'},
  {firstName:'Mato', lastName:'Milos', position:'Skrzydłowy', birthDate:'1993-06-30', height:175, number:'24', marketValue:'75 tys. €', nationality:'Chorwacja'},
  {firstName:'Jakub', lastName:'Szrek', position:'Skrzydłowy', birthDate:'1997-08-25', height:177, number:'77', marketValue:'75 tys. €'},
  {firstName:'Szymon', lastName:'Szkliński', position:'Skrzydłowy', birthDate:'2006-07-28', height:184, marketValue:'75 tys. €'},
  {firstName:'Bartosz', lastName:'Biedrzycki', position:'Skrzydłowy', birthDate:'2003-04-16', height:180, number:'25', marketValue:'250 tys. €'},
  {firstName:'Krystian', lastName:'Palacz', position:'Skrzydłowy', birthDate:'2003-07-19', height:180, number:'33', marketValue:'250 tys. €'},
  {firstName:'Filip', lastName:'Kupczyk', position:'Skrzydłowy', birthDate:'2006-05-08', height:178, marketValue:'125 tys. €'},
  {firstName:'Patryk', lastName:'Szysz', position:'Pomocnik ofensywny', birthDate:'1998-04-01', height:177, marketValue:'250 tys. €'},
  {firstName:'Bartłomiej', lastName:'Barański', position:'Pomocnik ofensywny', birthDate:'2006-10-09', height:178, number:'16', marketValue:'250 tys. €'},
  {firstName:'Adrian', lastName:'Liber', position:'Pomocnik ofensywny', birthDate:'2001-01-09', height:171, marketValue:'250 tys. €', nationality:'Chorwacja'},
  {firstName:'Mathieu', lastName:'Scalet', position:'Pomocnik ofensywny', birthDate:'1997-04-01', height:186, number:'18', marketValue:'200 tys. €', nationality:'Francja/Polska'},
  {firstName:'Szymon', lastName:'Mida', position:'Pomocnik ofensywny', birthDate:'2005-12-08', height:176, number:'11', marketValue:'200 tys. €'},
  {firstName:'Joshua', lastName:'Pérez', position:'Pomocnik ofensywny', birthDate:'1998-01-21', height:165, marketValue:'150 tys. €', nationality:'Salwador/USA'},
  {firstName:'Branislav', lastName:'Spacil', position:'Skrzydłowy', birthDate:'2003-09-20', height:184, number:'32', marketValue:'250 tys. €', nationality:'Słowacja'},
  {firstName:'Michal', lastName:'Feliks', position:'Napastnik', birthDate:'1999-03-19', height:186, number:'19', marketValue:'150 tys. €'},
  {firstName:'Kacper', lastName:'Przybylko', position:'Napastnik', birthDate:'1993-03-25', height:192, marketValue:'100 tys. €', nationality:'Polska/Niemcy'},
].map(p => Object.assign({clubName:'Odra Opole'}, p));

const SEED_PLAYERS_ILIGA_BRUK_BET_TERMALICA_NIECIECZA = [
  {firstName:'Adrian', lastName:'Chovan', position:'Bramkarz', birthDate:'1995-10-08', height:192, number:'1', marketValue:'200 tys. €', nationality:'Słowacja'},
  {firstName:'Eric', lastName:'Topór', position:'Bramkarz', birthDate:'2005-02-12', height:190, nationality:'Polska/Stany Zjednoczone'},
  {firstName:'Mikołaj', lastName:'Molga', position:'Bramkarz', birthDate:'2005-12-02', height:190},
  {firstName:'Maciej', lastName:'Janicki', position:'Bramkarz', birthDate:'2008-01-14', height:187, number:'24'},
  {firstName:'Lucas', lastName:'Masoero', position:'Obrońca środkowy', birthDate:'1995-02-01', height:188, number:'5', marketValue:'200 tys. €', nationality:'Argentyna/Włochy'},
  {firstName:'Albert', lastName:'Zarówny', position:'Obrońca środkowy', birthDate:'2004-10-29', height:188, number:'77', marketValue:'125 tys. €'},
  {firstName:'Artem', lastName:'Putivtsev', position:'Obrońca środkowy', birthDate:'1988-08-29', height:188, marketValue:'50 tys. €', nationality:'Ukraina/Polska'},
  {firstName:'Yevgen', lastName:'Opanasenko', position:'Obrońca środkowy', birthDate:'2003-06-09', height:192, nationality:'Ukraina'},
  {firstName:'Thiago', lastName:'Dombroski', position:'Obrońca środkowy', birthDate:'2002-06-20', height:190, nationality:'Brazylia/Polska'},
  {firstName:'Miłosz', lastName:'Kozik', position:'Obrońca środkowy', birthDate:'2004-12-18', height:195, number:'13'},
  {firstName:'Krzysztof', lastName:'Kubica', position:'Pomocnik defensywny', birthDate:'2000-05-25', height:193, number:'28', marketValue:'400 tys. €'},
  {firstName:'Maciej', lastName:'Ambrosiewicz', position:'Pomocnik defensywny', birthDate:'1998-05-24', height:185, marketValue:'400 tys. €'},
  {firstName:'Jakub', lastName:'Rozycki', position:'Pomocnik defensywny', birthDate:'2005-06-24'},
  {firstName:'Patryk', lastName:'Olejnik', position:'Pomocnik defensywny', birthDate:'2006-03-15', height:186, number:'16'},
  {firstName:'Paweł', lastName:'Surowiec', position:'Pomocnik defensywny', birthDate:'2008-09-29', number:'35'},
  {firstName:'Kacper', lastName:'Surowiec', position:'Pomocnik defensywny', birthDate:'2008-09-29', number:'27'},
  {firstName:'Radu', lastName:'Boboc', position:'Skrzydłowy', birthDate:'1999-04-24', height:180, marketValue:'300 tys. €', nationality:'Rumunia'},
  {firstName:'Maciej', lastName:'Jaroszewski', position:'Skrzydłowy', birthDate:'2007-08-15', height:184, number:'21'},
  {firstName:'Damian', lastName:'Hilbrycht', position:'Skrzydłowy', birthDate:'1998-05-19', height:182, number:'26', marketValue:'400 tys. €'},
  {firstName:'Wojciech', lastName:'Jakubik', position:'Skrzydłowy', birthDate:'2005-01-23', height:186, marketValue:'200 tys. €'},
  {firstName:'Jakub', lastName:'Marcinkowski', position:'Skrzydłowy', birthDate:'2003-12-11', height:178, number:'23'},
  {firstName:'Sergio', lastName:'Guerrero', position:'Pomocnik ofensywny', birthDate:'1999-04-10', height:174, marketValue:'300 tys. €', nationality:'Hiszpania'},
  {firstName:'Oliwier', lastName:'Sławiński', position:'Pomocnik ofensywny', birthDate:'2005-04-15', height:186, number:'8', marketValue:'250 tys. €'},
  {firstName:'Rafał', lastName:'Kurzawa', position:'Pomocnik ofensywny', birthDate:'1993-01-29', height:182, number:'17', marketValue:'150 tys. €'},
  {firstName:'Dominik', lastName:'Biniek', position:'Pomocnik ofensywny', birthDate:'2004-09-05', height:173, number:'19', marketValue:'100 tys. €', nationality:'Polska/Anglia'},
  {firstName:'Ivan', lastName:'Durdov', position:'Napastnik', birthDate:'2000-07-17', height:194, number:'7', marketValue:'350 tys. €', nationality:'Chorwacja'},
  {firstName:'Morgan', lastName:'Faßbender', position:'Napastnik', birthDate:'1998-10-18', height:188, number:'9', marketValue:'300 tys. €', nationality:'Niemcy/Ghana'},
  {firstName:'Jesús', lastName:'Jiménez', position:'Napastnik', birthDate:'1993-11-05', height:183, number:'25', marketValue:'200 tys. €', nationality:'Hiszpania'},
  {firstName:'Kamil', lastName:'Zapolnik', position:'Napastnik', birthDate:'1992-09-09', height:182, marketValue:'150 tys. €'},
].map(p => Object.assign({clubName:'Bruk-Bet Termalica Nieciecza'}, p));

const SEED_PLAYERS_ILIGA_RUCH_CHORZOW = [
  {firstName:'Jakub', lastName:'Bielecki', position:'Bramkarz', birthDate:'2000-10-28', height:192, number:'82', marketValue:'150 tys. €'},
  {firstName:'Jakub', lastName:'Wrąbel', position:'Bramkarz', birthDate:'1996-06-08', height:196, number:'44', marketValue:'100 tys. €'},
  {firstName:'Marcel', lastName:'Potoczny', position:'Bramkarz', birthDate:'2006-06-29', height:187, number:'1'},
  {firstName:'Nikodem', lastName:'Proczek', position:'Bramkarz', birthDate:'2007-09-05', height:195, number:'70'},
  {firstName:'Filip', lastName:'Kędziera', position:'Obrońca środkowy', birthDate:'2008-02-09', height:181, number:'4'},
  {firstName:'Nikodem', lastName:'Leśniak-Paduch', position:'Obrońca środkowy', birthDate:'2006-01-12', height:188, number:'28', marketValue:'400 tys. €'},
  {firstName:'Abraham', lastName:'del Moral', position:'Obrońca środkowy', birthDate:'2001-07-05', height:183, number:'3', marketValue:'150 tys. €', nationality:'Hiszpania'},
  {firstName:'Andrej', lastName:'Lukic', position:'Obrońca środkowy', birthDate:'1994-04-02', height:190, number:'17', marketValue:'100 tys. €', nationality:'Chorwacja'},
  {firstName:'Aleksander', lastName:'Komor', position:'Obrońca środkowy', birthDate:'1994-06-24', height:190, number:'24', marketValue:'100 tys. €'},
  {firstName:'Kajetan', lastName:'Klaja', position:'Obrońca środkowy', birthDate:'2008-03-02', height:183},
  {firstName:'Maciej', lastName:'Krzempek', position:'Obrońca środkowy', birthDate:'2007-03-04', height:179},
  {firstName:'Jakub', lastName:'Domagała', position:'Obrońca środkowy', birthDate:'2004-08-25', height:183, number:'19'},
  {firstName:'Mateusz', lastName:'Bąk', position:'Obrońca boczny', birthDate:'2001-09-17', height:181, number:'26'},
  {firstName:'Filip', lastName:'Wójcik', position:'Obrońca boczny', birthDate:'1997-04-11', height:174, number:'14', marketValue:'250 tys. €'},
  {firstName:'Martin', lastName:'Konczkowski', position:'Obrońca boczny', birthDate:'1993-09-14', height:181, number:'15', marketValue:'100 tys. €'},
  {firstName:'Szymon', lastName:'Szymański', position:'Pomocnik defensywny', birthDate:'1996-04-13', height:185, number:'20', marketValue:'200 tys. €'},
  {firstName:'Denis', lastName:'Ventura', position:'Pomocnik defensywny', birthDate:'1995-08-01', height:182, number:'25', marketValue:'200 tys. €', nationality:'Słowacja'},
  {firstName:'Patryk', lastName:'Sikora', position:'Pomocnik defensywny', birthDate:'1999-11-20', height:187, number:'8', marketValue:'125 tys. €'},
  {firstName:'Mateusz', lastName:'Rosół', position:'Pomocnik defensywny', birthDate:'2008-06-11', height:186, number:'5', marketValue:'100 tys. €'},
  {firstName:'Kamil', lastName:'Lipiński', position:'Pomocnik defensywny', birthDate:'2005-01-14', height:181, number:'22'},
  {firstName:'Shuma', lastName:'Nagamatsu', position:'Pomocnik ofensywny', birthDate:'1995-08-29', height:170, number:'18', marketValue:'200 tys. €', nationality:'Japonia'},
  {firstName:'Michał', lastName:'Chrapek', position:'Pomocnik ofensywny', birthDate:'1992-04-03', height:177, number:'6', marketValue:'150 tys. €'},
  {firstName:'Krystian', lastName:'Wachowiak', position:'Skrzydłowy', birthDate:'2001-10-19', height:182, number:'2', marketValue:'200 tys. €'},
  {firstName:'Filip', lastName:'Lachendro', position:'Skrzydłowy', birthDate:'2006-06-28', height:182, number:'29', marketValue:'50 tys. €'},
  {firstName:'Patryk', lastName:'Szwedzik', position:'Skrzydłowy', birthDate:'2001-12-02', height:185, number:'21', marketValue:'350 tys. €'},
  {firstName:'Kacper', lastName:'Laskowski', position:'Skrzydłowy', birthDate:'2001-10-04', height:175, number:'27', marketValue:'250 tys. €'},
  {firstName:'Jakub', lastName:'Sobeczko', position:'Skrzydłowy', birthDate:'2006-10-14', height:178},
  {firstName:'Krystian', lastName:'Rostek', position:'Skrzydłowy', birthDate:'2008-03-08', height:178, number:'88'},
  {firstName:'Daniel', lastName:'Szczepan', position:'Napastnik', birthDate:'1995-06-05', height:179, number:'95', marketValue:'150 tys. €'},
  {firstName:'Robert', lastName:'Łukowiak', position:'Napastnik', birthDate:'2007-06-13', height:190},
  {firstName:'Kacper', lastName:'Dyduch', position:'Napastnik', birthDate:'2008-08-22', height:186},
  {firstName:'Dawid', lastName:'Magusiak', position:'Napastnik', birthDate:'2006-12-13', height:188},
  {firstName:'Max', lastName:'Pawłowski', position:'Napastnik', birthDate:'2007-01-07', height:192, number:'9'},
  {firstName:'Seweryn', lastName:'Cieślak', position:'Napastnik', birthDate:'2008-04-21', height:187, number:'11'},
].map(p => Object.assign({clubName:'Ruch Chorzów'}, p));

const SEED_PLAYERS_ILIGA_PUSZCZA_NIEPOLOMICE = [
  {firstName:'Wiktor', lastName:'Kowal', position:'Bramkarz', birthDate:'2006-01-25', height:190, number:'97', marketValue:'75 tys. €'},
  {firstName:'Filip', lastName:'Andrzejczak', position:'Bramkarz', birthDate:'2008-06-01', height:194},
  {firstName:'Kacper', lastName:'Smok', position:'Bramkarz', birthDate:'2007-04-02', height:192, number:'41'},
  {firstName:'Kacper', lastName:'Przybyłko', position:'Obrońca środkowy', birthDate:'2005-02-05', height:190, number:'23', marketValue:'300 tys. €'},
  {firstName:'Konrad', lastName:'Kasolik', position:'Obrońca środkowy', birthDate:'1997-09-29', height:193, number:'2', marketValue:'150 tys. €'},
  {firstName:'Adrian', lastName:'Piekarski', position:'Obrońca środkowy', birthDate:'1998-05-24', height:193, number:'34', marketValue:'150 tys. €'},
  {firstName:'Filip', lastName:'Szabaciuk', position:'Obrońca środkowy', birthDate:'2003-04-08', height:185, marketValue:'125 tys. €'},
  {firstName:'Kacper', lastName:'Wołowiec', position:'Obrońca środkowy', birthDate:'2007-10-15', height:191},
  {firstName:'Mark', lastName:'Strajnar', position:'Obrońca boczny', birthDate:'2003-12-19', height:187, marketValue:'200 tys. €', nationality:'Słowenia'},
  {firstName:'Omar', lastName:'Kocar', position:'Pomocnik defensywny', birthDate:'2001-06-06', height:187, marketValue:'200 tys. €', nationality:'Słowenia'},
  {firstName:'Filipe', lastName:'Nascimento', position:'Pomocnik defensywny', birthDate:'1995-01-07', height:175, number:'88', marketValue:'125 tys. €', nationality:'Portugalia'},
  {firstName:'Konrad', lastName:'Stępień', position:'Pomocnik defensywny', birthDate:'1993-03-07', height:185, number:'5', marketValue:'100 tys. €'},
  {firstName:'Igor', lastName:'Pieprzyca', position:'Pomocnik defensywny', birthDate:'2008-10-08', height:180, number:'28', marketValue:'25 tys. €'},
  {firstName:'Adam', lastName:'Sendor', position:'Pomocnik defensywny', birthDate:'2006-11-21', height:186},
  {firstName:'Filip', lastName:'Jaworski', position:'Pomocnik środkowy', birthDate:'2007-10-06'},
  {firstName:'Szymon', lastName:'Fielek', position:'Pomocnik środkowy', birthDate:'2008-08-01'},
  {firstName:'Antoni', lastName:'Klimek', position:'Skrzydłowy', birthDate:'2002-08-04', height:176, marketValue:'150 tys. €'},
  {firstName:'Andrzej', lastName:'Trubeha', position:'Pomocnik ofensywny', birthDate:'1997-11-22', height:186, marketValue:'150 tys. €'},
  {firstName:'Przemyslaw', lastName:'Sajdak', position:'Pomocnik ofensywny', birthDate:'2000-02-07', height:182},
  {firstName:'Olaf', lastName:'Korczakowski', position:'Skrzydłowy', birthDate:'2003-11-11', height:183, number:'11', marketValue:'150 tys. €'},
  {firstName:'Mateusz', lastName:'Cholewiak', position:'Skrzydłowy', birthDate:'1990-02-05', height:184, number:'10', marketValue:'75 tys. €'},
  {firstName:'Dawid', lastName:'Kogut', position:'Skrzydłowy', birthDate:'2008-08-05', height:183, number:'17'},
  {firstName:'Kosei', lastName:'Iwao', position:'Skrzydłowy', birthDate:'1997-07-24', height:188, number:'17', marketValue:'200 tys. €', nationality:'Japonia'},
  {firstName:'German', lastName:'Barkovskiy', position:'Napastnik', birthDate:'2002-06-25', height:191, marketValue:'450 tys. €', nationality:'Białoruś'},
  {firstName:'Amarildo', lastName:'Gjoni', position:'Napastnik', birthDate:'1999-07-25', height:185, number:'14', marketValue:'350 tys. €', nationality:'Albania'},
  {firstName:'Oskar', lastName:'Gerstenstein', position:'Napastnik', birthDate:'2007-01-16', height:183},
].map(p => Object.assign({clubName:'Puszcza Niepołomice'}, p));

const SEED_PLAYERS_ILIGA_POLONIA_BYTOM = [
  {firstName:'Wojciech', lastName:'Banasik', position:'Bramkarz', birthDate:'2006-05-08', height:191, number:'1', marketValue:'75 tys. €'},
  {firstName:'Klaudiusz', lastName:'Mazur', position:'Bramkarz', birthDate:'2002-10-29', height:187},
  {firstName:'Kamil', lastName:'Hajduk', position:'Bramkarz', birthDate:'2005-06-26', height:188},
  {firstName:'Filip', lastName:'Zwoliński', position:'Bramkarz', birthDate:'2006-09-03', height:190},
  {firstName:'Pawel', lastName:'Zagorski', position:'Bramkarz', birthDate:'2006-10-21', height:187},
  {firstName:'Artur', lastName:'Flak', position:'Bramkarz', birthDate:'2008-05-29', height:191, number:'40'},
  {firstName:'Aleksander', lastName:'Gajgier', position:'Obrońca środkowy', birthDate:'2003-08-10', height:193, marketValue:'200 tys. €'},
  {firstName:'Jakub', lastName:'Szymański', position:'Obrońca środkowy', birthDate:'2002-07-05', height:189, number:'30', marketValue:'200 tys. €'},
  {firstName:'Oskar', lastName:'Krzyżak', position:'Obrońca środkowy', birthDate:'2002-01-24', height:190, marketValue:'150 tys. €'},
  {firstName:'Dominik', lastName:'Konieczny', position:'Obrońca środkowy', birthDate:'1997-05-08', height:180, number:'8', marketValue:'75 tys. €'},
  {firstName:'Mikołaj', lastName:'Łabojko', position:'Pomocnik defensywny', birthDate:'2001-03-12', height:176, marketValue:'250 tys. €'},
  {firstName:'Mateusz', lastName:'Anklewicz', position:'Pomocnik defensywny', birthDate:'2005-05-11', height:175},
  {firstName:'Piotr', lastName:'Topolewski', position:'Pomocnik defensywny', birthDate:'2005-10-05', height:173, number:'32'},
  {firstName:'Artur', lastName:'Winkler', position:'Pomocnik defensywny', birthDate:'2009-06-24', number:'10'},
  {firstName:'Kacper', lastName:'Michalski', position:'Skrzydłowy', birthDate:'2000-01-03', height:187, number:'14', marketValue:'150 tys. €'},
  {firstName:'Grzegorz', lastName:'Szymusik', position:'Skrzydłowy', birthDate:'1998-06-04', height:182, number:'16', marketValue:'150 tys. €'},
  {firstName:'Patryk', lastName:'Stefański', position:'Skrzydłowy', birthDate:'1990-03-12', height:178, marketValue:'25 tys. €'},
  {firstName:'Daniel', lastName:'Zielinski', position:'Skrzydłowy', birthDate:'2005-09-01', height:188},
  {firstName:'Maciej', lastName:'Wolski', position:'Skrzydłowy', birthDate:'1997-03-29', height:176, number:'7', marketValue:'200 tys. €'},
  {firstName:'Lucjan', lastName:'Zieliński', position:'Skrzydłowy', birthDate:'1997-12-04', height:172, number:'17', marketValue:'125 tys. €'},
  {firstName:'Krzysztof', lastName:'Wołkowicz', position:'Skrzydłowy', birthDate:'1994-09-12', height:180, marketValue:'75 tys. €'},
  {firstName:'Szymon', lastName:'Kądziołka', position:'Pomocnik ofensywny', birthDate:'2006-01-29', height:178, marketValue:'250 tys. €'},
  {firstName:'Kamil', lastName:'Orlik', position:'Pomocnik ofensywny', birthDate:'1999-08-03', height:179, number:'11', marketValue:'200 tys. €'},
  {firstName:'Konrad', lastName:'Andrzejczak', position:'Pomocnik ofensywny', birthDate:'1996-06-08', height:183, number:'20', marketValue:'175 tys. €'},
  {firstName:'Jan', lastName:'Łabędzki', position:'Pomocnik ofensywny', birthDate:'2006-02-11', height:186, marketValue:'150 tys. €'},
  {firstName:'Benedik', lastName:'Mioc', position:'Pomocnik ofensywny', birthDate:'1994-10-06', height:173, marketValue:'100 tys. €', nationality:'Chorwacja'},
  {firstName:'Jakub Jordan', lastName:'Jokel', position:'Pomocnik ofensywny', birthDate:'2004-08-11', height:182, marketValue:'50 tys. €', nationality:'Słowacja'},
  {firstName:'Mateusz', lastName:'Wzięch', position:'Pomocnik ofensywny', birthDate:'2002-05-20', height:186, marketValue:'50 tys. €'},
  {firstName:'Lukasz', lastName:'Piontek', position:'Pomocnik ofensywny', birthDate:'2005-08-11', height:173, number:'9'},
  {firstName:'Kamil', lastName:'Wojtyra', position:'Napastnik', birthDate:'1997-09-06', height:190, number:'23', marketValue:'150 tys. €'},
  {firstName:'Jakub', lastName:'Arak', position:'Napastnik', birthDate:'1995-04-02', height:183, marketValue:'150 tys. €'},
  {firstName:'Kamil', lastName:'Siudak', position:'Napastnik', birthDate:'2008-10-03', height:180, number:'34'},
  {firstName:'Dylan', lastName:'Harwin', position:'Napastnik', birthDate:'2008-11-30'},
].map(p => Object.assign({clubName:'Polonia Bytom'}, p));

const SEED_PLAYERS_ILIGA_POGON_GRODZISK_MAZOWIECKI = [
  {firstName:'Krzysztof', lastName:'Kamiński', position:'Bramkarz', birthDate:'1990-11-26', height:191, marketValue:'75 tys. €'},
  {firstName:'Mikołaj', lastName:'Glacel', position:'Bramkarz', birthDate:'2004-12-27', height:193, number:'25'},
  {firstName:'Bartosz', lastName:'Dembek', position:'Obrońca środkowy', birthDate:'2006-01-03', height:196, marketValue:'250 tys. €'},
  {firstName:'Oskar', lastName:'Koprowski', position:'Obrońca środkowy', birthDate:'1999-03-18', height:185, marketValue:'100 tys. €'},
  {firstName:'Kamil', lastName:'Głogowski', position:'Obrońca środkowy', birthDate:'2004-07-22', height:186, number:'8', marketValue:'100 tys. €'},
  {firstName:'Grzegorz', lastName:'Gulczyński', position:'Obrońca środkowy', birthDate:'1996-01-26', height:184},
  {firstName:'Jan', lastName:'Krupa', position:'Obrońca środkowy', birthDate:'2006-04-02', height:188, number:'21'},
  {firstName:'Kacper', lastName:'Łoś', position:'Pomocnik defensywny', birthDate:'2000-03-29', height:184, number:'5', marketValue:'250 tys. €'},
  {firstName:'Matheus', lastName:'Dias', position:'Pomocnik defensywny', birthDate:'1997-07-16', height:183, nationality:'Brazylia/Włochy'},
  {firstName:'Henry', lastName:'Uzoigwe', position:'Pomocnik defensywny', birthDate:'2004-07-14', nationality:'Nigeria'},
  {firstName:'Filip', lastName:'Mączka', position:'Pomocnik środkowy', birthDate:'2009-10-11'},
  {firstName:'Jakub', lastName:'Miazgowski', position:'Pomocnik środkowy', birthDate:'2006-03-03'},
  {firstName:'Jakub', lastName:'Jędrasik', position:'Skrzydłowy', birthDate:'2005-04-07', height:179, number:'11', marketValue:'250 tys. €'},
  {firstName:'Kamil', lastName:'Kargulewicz', position:'Skrzydłowy', birthDate:'2000-09-15', height:172, marketValue:'100 tys. €'},
  {firstName:'Nikodem', lastName:'Niski', position:'Skrzydłowy', birthDate:'2002-04-14', height:182, number:'27', marketValue:'250 tys. €'},
  {firstName:'Jakub', lastName:'Konstantyn', position:'Skrzydłowy', birthDate:'2002-06-26', height:175, number:'17', marketValue:'250 tys. €'},
  {firstName:'Jakub', lastName:'Niewiadomski', position:'Skrzydłowy', birthDate:'2002-04-09', height:184, number:'20', marketValue:'125 tys. €'},
  {firstName:'Olivier', lastName:'Wypart', position:'Skrzydłowy', birthDate:'2001-01-16', height:182, number:'13', marketValue:'75 tys. €'},
  {firstName:'Jakub', lastName:'Lis', position:'Pomocnik ofensywny', birthDate:'2004-10-14', height:185, marketValue:'150 tys. €'},
  {firstName:'Bartłomiej', lastName:'Ciepiela', position:'Pomocnik ofensywny', birthDate:'2001-05-24', height:182, number:'4', marketValue:'125 tys. €'},
  {firstName:'Igor', lastName:'Korczakowski', position:'Pomocnik ofensywny', birthDate:'1998-09-26', height:186, marketValue:'125 tys. €'},
  {firstName:'Radosław', lastName:'Majewski', position:'Pomocnik ofensywny', birthDate:'1986-12-15', height:170, number:'10', marketValue:'50 tys. €'},
  {firstName:'Damian', lastName:'Jaroń', position:'Pomocnik ofensywny', birthDate:'1990-04-09', height:184, marketValue:'25 tys. €'},
  {firstName:'Jakub', lastName:'Zbróg', position:'Skrzydłowy', birthDate:'2007-07-15', height:183, marketValue:'250 tys. €'},
  {firstName:'Aldrit', lastName:'Oshafi', position:'Napastnik', birthDate:'2000-03-26', height:193, marketValue:'150 tys. €', nationality:'Albania/Bułgaria'},
  {firstName:'Hubert', lastName:'Turski', position:'Napastnik', birthDate:'2003-01-31', height:192},
].map(p => Object.assign({clubName:'Pogoń Grodzisk Mazowiecki'}, p));

const SEED_PLAYERS_ILIGA_CHROBRY_GLOGOW = [
  {firstName:'Krzysztof', lastName:'Bąkowski', position:'Bramkarz', birthDate:'2003-01-04', height:192, number:'22', marketValue:'350 tys. €'},
  {firstName:'Krzysztof', lastName:'Wróblewski', position:'Bramkarz', birthDate:'2002-01-23', height:188, number:'1'},
  {firstName:'Marcel', lastName:'Gawłowski', position:'Bramkarz', birthDate:'2007-05-15', height:190},
  {firstName:'Jakub', lastName:'Gric', position:'Obrońca środkowy', birthDate:'1996-07-05', height:180, number:'8', marketValue:'200 tys. €', nationality:'Słowacja'},
  {firstName:'Michał', lastName:'Kozajda', position:'Obrońca środkowy', birthDate:'1999-04-03', height:185, number:'21', marketValue:'175 tys. €'},
  {firstName:'Krzysztof', lastName:'Janiszewski', position:'Obrońca środkowy', birthDate:'2005-02-15', height:195},
  {firstName:'Beniamin', lastName:'Czajka', position:'Obrońca środkowy', birthDate:'2000-03-31', height:192, number:'6'},
  {firstName:'Wiktor', lastName:'Łaszyński', position:'Obrońca środkowy', birthDate:'2008-03-14', height:191, number:'14'},
  {firstName:'Kacper', lastName:'Tabiś', position:'Obrońca boczny', birthDate:'2000-01-31', height:175, number:'80', marketValue:'250 tys. €'},
  {firstName:'Mateusz', lastName:'Bartolewski', position:'Obrońca boczny', birthDate:'1998-01-12', height:187, number:'77', marketValue:'75 tys. €'},
  {firstName:'Jakub', lastName:'Lis', position:'Obrońca boczny', birthDate:'2002-01-14', height:175, number:'28', marketValue:'200 tys. €'},
  {firstName:'Kamil', lastName:'Grzelak', position:'Pomocnik defensywny', birthDate:'2007-08-25', height:178, number:'24', marketValue:'150 tys. €'},
  {firstName:'Radosław', lastName:'Bąk', position:'Pomocnik defensywny', birthDate:'2004-08-26', height:187, number:'5', marketValue:'100 tys. €'},
  {firstName:'Robert', lastName:'Mandrysz', position:'Pomocnik defensywny', birthDate:'1991-01-06', height:180, number:'16', marketValue:'75 tys. €'},
  {firstName:'Adrian', lastName:'Bukowski', position:'Pomocnik defensywny', birthDate:'2003-03-18', height:188, number:'33', marketValue:'75 tys. €'},
  {firstName:'Krystian', lastName:'Tworzydło', position:'Pomocnik defensywny', birthDate:'2007-06-26', height:172, number:'31', marketValue:'10 tys. €'},
  {firstName:'Szymon', lastName:'Manijak', position:'Pomocnik defensywny', birthDate:'2008-03-04', height:179},
  {firstName:'Yegor', lastName:'Sharabura', position:'Skrzydłowy', birthDate:'2004-03-24', height:179, number:'10', marketValue:'150 tys. €', nationality:'Ukraina'},
  {firstName:'Ziemowit', lastName:'Witczak', position:'Pomocnik ofensywny', birthDate:'2006-06-10', height:173, number:'91'},
  {firstName:'Mateusz', lastName:'Ozimek', position:'Skrzydłowy', birthDate:'2000-06-21', height:179, number:'9', marketValue:'175 tys. €'},
  {firstName:'Kelechukwu', lastName:'Ibe-Torti', position:'Skrzydłowy', birthDate:'2002-01-26', height:174, number:'17', marketValue:'250 tys. €', nationality:'Polska/Nigeria'},
  {firstName:'Agon', lastName:'Sadiku', position:'Napastnik', birthDate:'2003-03-10', height:184, marketValue:'225 tys. €', nationality:'Finlandia/Kosowo'},
  {firstName:'Sebastian', lastName:'Strózik', position:'Napastnik', birthDate:'1999-05-15', height:192, number:'11', marketValue:'125 tys. €'},
  {firstName:'Alan', lastName:'Rybak', position:'Napastnik', birthDate:'2006-12-01', height:185, number:'51', marketValue:'100 tys. €'},
  {firstName:'Kuba', lastName:'Szabłowski', position:'Napastnik', birthDate:'2006-05-24', height:203, number:'72', marketValue:'10 tys. €'},
].map(p => Object.assign({clubName:'Chrobry Głogów'}, p));

const SEED_PLAYERS_ILIGA_STAL_RZESZOW = [
  {firstName:'Svyatoslav', lastName:'Vanivskyi', position:'Bramkarz', birthDate:'2005-02-27', height:193, number:'1', marketValue:'100 tys. €', nationality:'Ukraina'},
  {firstName:'Marek', lastName:'Kozioł', position:'Bramkarz', birthDate:'1988-06-01', height:199, number:'88', marketValue:'25 tys. €'},
  {firstName:'Mateusz', lastName:'Sokół', position:'Bramkarz', birthDate:'2008-03-17'},
  {firstName:'Wojciech', lastName:'Witkowski', position:'Bramkarz', birthDate:'2008-03-14'},
  {firstName:'Frederick', lastName:'Wolff', position:'Bramkarz', birthDate:'2006-11-08', height:195, number:'50', nationality:'Słowacja/Niemcy'},
  {firstName:'Vladislav', lastName:'Krasovskiy', position:'Obrońca środkowy', birthDate:'2004-02-02', height:198, number:'3', marketValue:'300 tys. €', nationality:'Białoruś'},
  {firstName:'Marcin', lastName:'Kaczor', position:'Obrońca środkowy', birthDate:'2004-09-18', height:188, marketValue:'250 tys. €'},
  {firstName:'Kacper', lastName:'Pasko', position:'Obrońca środkowy', birthDate:'2004-07-29', height:182, number:'29'},
  {firstName:'Filip', lastName:'Sonntag', position:'Obrońca środkowy', birthDate:'2008-06-09', height:188},
  {firstName:'Fabian', lastName:'Blejwas', position:'Obrońca środkowy', birthDate:'2008-04-28', height:182, number:'45'},
  {firstName:'Daniel', lastName:'Zieja', position:'Obrońca środkowy', birthDate:'2008-01-23', height:190},
  {firstName:'Ksawery', lastName:'Kukułka', position:'Obrońca boczny', birthDate:'2004-01-31', height:181, number:'77', marketValue:'200 tys. €'},
  {firstName:'Antoni', lastName:'Perduta', position:'Obrońca boczny', birthDate:'2009-11-25', height:183, number:'42'},
  {firstName:'Łukasz', lastName:'Piwnicki', position:'Obrońca boczny', birthDate:'2007-09-17', height:177},
  {firstName:'Marco', lastName:'Thiede', position:'Obrońca boczny', birthDate:'1992-05-20', height:178, marketValue:'150 tys. €', nationality:'Niemcy'},
  {firstName:'Sean', lastName:'Goss', position:'Pomocnik defensywny', birthDate:'1995-10-01', height:191, number:'27', marketValue:'200 tys. €', nationality:'Irlandia Północna/Anglia'},
  {firstName:'Dominik', lastName:'Gujda', position:'Pomocnik defensywny', birthDate:'2007-08-03', height:177, marketValue:'150 tys. €'},
  {firstName:'Wojciech', lastName:'Machura', position:'Pomocnik defensywny', birthDate:'2008-03-03', height:185},
  {firstName:'Mateusz', lastName:'Leniart', position:'Pomocnik defensywny', birthDate:'2008-03-09', height:170, number:'5'},
  {firstName:'Mikołaj', lastName:'Jaskot', position:'Pomocnik środkowy', birthDate:'2007-03-29', number:'13'},
  {firstName:'Wojciech', lastName:'Brzęk', position:'Pomocnik środkowy', birthDate:'2008-08-11', number:'41'},
  {firstName:'Oliwier', lastName:'Madej', position:'Pomocnik defensywny', birthDate:'2010-07-09', number:'42'},
  {firstName:'Jakub', lastName:'Sadowski', position:'Skrzydłowy', birthDate:'2007-07-22'},
  {firstName:'Jakub', lastName:'Kucharski', position:'Pomocnik ofensywny', birthDate:'2008-11-03', height:175, number:'20', marketValue:'300 tys. €'},
  {firstName:'Marcin', lastName:'Listkowski', position:'Pomocnik ofensywny', birthDate:'1998-02-10', height:178, marketValue:'100 tys. €'},
  {firstName:'Arsen', lastName:'Grosu', position:'Pomocnik ofensywny', birthDate:'2001-04-13', height:175, number:'9', marketValue:'75 tys. €', nationality:'Ukraina'},
  {firstName:'Kacper', lastName:'Masiak', position:'Skrzydłowy', birthDate:'2005-01-11', height:175, number:'25', marketValue:'200 tys. €'},
  {firstName:'Filip', lastName:'Wolski', position:'Skrzydłowy', birthDate:'2006-04-09', height:178, number:'10', marketValue:'150 tys. €'},
  {firstName:'Jonathan', lastName:'Júnior', position:'Napastnik', birthDate:'1999-04-28', height:178, marketValue:'250 tys. €', nationality:'Brazylia'},
  {firstName:'Michał', lastName:'Musik', position:'Napastnik', birthDate:'2004-04-19', height:193, number:'55', marketValue:'100 tys. €'},
  {firstName:'Jakub', lastName:'Kaczówka', position:'Napastnik', birthDate:'2008-03-29', height:190, number:'44', marketValue:'75 tys. €'},
  {firstName:'Szymon', lastName:'Pukała', position:'Napastnik', birthDate:'2007-08-13', marketValue:'25 tys. €'},
  {firstName:'Szymon', lastName:'Salamon', position:'Napastnik', birthDate:'2006-03-22', height:186, number:'45'},
  {firstName:'Radosław', lastName:'Bieniaszewski', position:'Napastnik', birthDate:'2006-06-06'},
].map(p => Object.assign({clubName:'Stal Rzeszów'}, p));

const SEED_PLAYERS_ILIGA_POGON_SIEDLCE = [
  {firstName:'Jakub', lastName:'Lemanowicz', position:'Bramkarz', birthDate:'1999-03-27', height:190, number:'57', marketValue:'150 tys. €'},
  {firstName:'Jakub', lastName:'Tomkiel', position:'Bramkarz', birthDate:'2005-02-19', height:190, number:'1'},
  {firstName:'Szymon', lastName:'Mucha', position:'Obrońca środkowy', birthDate:'2004-08-16'},
  {firstName:'Filip', lastName:'Kendzia', position:'Obrońca środkowy', birthDate:'1997-02-20', height:189, marketValue:'150 tys. €'},
  {firstName:'Przemysław', lastName:'Szur', position:'Obrońca środkowy', birthDate:'1996-03-24', height:186, marketValue:'75 tys. €'},
  {firstName:'Krystian', lastName:'Miś', position:'Obrońca boczny', birthDate:'1996-04-12', height:182, number:'2', marketValue:'100 tys. €'},
  {firstName:'Sebastian', lastName:'Szczytniewski', position:'Obrońca boczny', birthDate:'2003-03-19', height:183, number:'72', marketValue:'75 tys. €'},
  {firstName:'Damian', lastName:'Jakubik', position:'Obrońca boczny', birthDate:'1990-03-25', height:183, number:'14', marketValue:'50 tys. €'},
  {firstName:'Franciszek', lastName:'Saganowski', position:'Obrońca boczny', birthDate:'2006-03-27', height:175},
  {firstName:'Jakub', lastName:'Barczak', position:'Obrońca boczny', birthDate:'2007-07-10'},
  {firstName:'Ernest', lastName:'Dzięcioł', position:'Pomocnik defensywny', birthDate:'1998-02-11', height:184, number:'31', marketValue:'150 tys. €'},
  {firstName:'Bartłomiej', lastName:'Poczobut', position:'Pomocnik defensywny', birthDate:'1993-07-11', height:180, number:'16', marketValue:'100 tys. €'},
  {firstName:'Jakub', lastName:'Sinior', position:'Pomocnik defensywny', birthDate:'2000-07-07', height:185, number:'8', marketValue:'75 tys. €'},
  {firstName:'Bartosz', lastName:'Borkowski', position:'Pomocnik defensywny', birthDate:'2007-02-25', height:174, number:'28', marketValue:'10 tys. €'},
  {firstName:'Mateusz', lastName:'Kizyma', position:'Pomocnik defensywny', birthDate:'2002-07-08', height:186},
  {firstName:'Krystian', lastName:'Gryglak', position:'Pomocnik defensywny', birthDate:'2005-02-14', height:173, number:'25'},
  {firstName:'Bolesław', lastName:'Świerczewski', position:'Pomocnik defensywny', birthDate:'2007-05-16', height:186, number:'47'},
  {firstName:'Rafał', lastName:'Makowski', position:'Pomocnik ofensywny', birthDate:'1996-08-05', height:191, marketValue:'75 tys. €'},
  {firstName:'Mateusz', lastName:'Marzec', position:'Pomocnik ofensywny', birthDate:'1994-08-13', height:178, marketValue:'50 tys. €'},
  {firstName:'Damian', lastName:'Szuprytowski', position:'Pomocnik ofensywny', birthDate:'1989-06-25', height:172, number:'7', marketValue:'50 tys. €'},
  {firstName:'Nikodem', lastName:'Zielonka', position:'Skrzydłowy', birthDate:'2004-08-17', height:184, number:'95', marketValue:'150 tys. €'},
  {firstName:'Cezary', lastName:'Demianiuk', position:'Skrzydłowy', birthDate:'1992-10-17', height:180, number:'56', marketValue:'75 tys. €'},
  {firstName:'Olaf', lastName:'Kozłowski', position:'Skrzydłowy', birthDate:'2005-05-19', height:187, number:'19', marketValue:'50 tys. €', nationality:'Polska/Belgia'},
  {firstName:'Maciej', lastName:'Rosołek', position:'Napastnik', birthDate:'2001-09-02', height:183, marketValue:'200 tys. €'},
  {firstName:'Jarosław', lastName:'Niezgoda', position:'Napastnik', birthDate:'1995-03-15', height:185, number:'29', marketValue:'100 tys. €'},
  {firstName:'Patryk', lastName:'Klimek', position:'Napastnik', birthDate:'2006-08-28', number:'22'},
].map(p => Object.assign({clubName:'Pogoń Siedlce'}, p));

const SEED_PLAYERS_ILIGA_STAL_MIELEC = [
  {firstName:'Maciej', lastName:'Gostomski', position:'Bramkarz', birthDate:'1988-09-27', height:196, number:'99', marketValue:'25 tys. €'},
  {firstName:'Piotr', lastName:'Chrapusta', position:'Bramkarz', birthDate:'2007-05-28', height:195, number:'41'},
  {firstName:'Israel', lastName:'Puerto', position:'Obrońca środkowy', birthDate:'1993-06-15', height:187, number:'44', marketValue:'100 tys. €', nationality:'Hiszpania'},
  {firstName:'Bartosz', lastName:'Kwiecień', position:'Obrońca środkowy', birthDate:'1994-05-07', height:189, number:'94', marketValue:'100 tys. €'},
  {firstName:'Kamil', lastName:'Kościelny', position:'Obrońca środkowy', birthDate:'1991-08-04', height:185, number:'14', marketValue:'50 tys. €'},
  {firstName:'Michael', lastName:'Wyparlo', position:'Obrońca środkowy', birthDate:'2003-09-25', height:191, number:'38', nationality:'Polska/USA'},
  {firstName:'Michał', lastName:'Stala', position:'Obrońca środkowy', birthDate:'2004-03-02', height:188, number:'26'},
  {firstName:'Hubert', lastName:'Matynia', position:'Obrońca boczny', birthDate:'1995-11-04', height:181, number:'5', marketValue:'100 tys. €'},
  {firstName:'Krystian', lastName:'Getinger', position:'Obrońca boczny', birthDate:'1988-08-29', height:188, number:'23'},
  {firstName:'Bartłomiej', lastName:'Kukułowicz', position:'Obrońca boczny', birthDate:'2000-10-11', height:181, number:'2'},
  {firstName:'Kacper', lastName:'Sommerfeld', position:'Pomocnik defensywny', birthDate:'2004-01-28', height:177, number:'6', marketValue:'100 tys. €'},
  {firstName:'Piotr', lastName:'Wlazło', position:'Pomocnik defensywny', birthDate:'1989-06-03', height:184, number:'18', marketValue:'50 tys. €'},
  {firstName:'Jakub', lastName:'Malek', position:'Pomocnik defensywny', birthDate:'2008-04-15'},
  {firstName:'Nikodem', lastName:'Szady', position:'Pomocnik defensywny', birthDate:'2009-01-17', height:171, number:'16'},
  {firstName:'Dawid', lastName:'Zieba', position:'Skrzydłowy', birthDate:'2005-01-25', height:184},
  {firstName:'Marcin', lastName:'Cebula', position:'Pomocnik ofensywny', birthDate:'1995-12-06', height:177, number:'32', marketValue:'150 tys. €'},
  {firstName:'Fryderyk', lastName:'Gerbowski', position:'Pomocnik ofensywny', birthDate:'2003-01-17', height:181, number:'77', marketValue:'150 tys. €'},
  {firstName:'Kacper', lastName:'Sadłocha', position:'Pomocnik ofensywny', birthDate:'2002-12-01', height:172, number:'47', marketValue:'75 tys. €'},
  {firstName:'Maciej', lastName:'Domanski', position:'Pomocnik ofensywny', birthDate:'1990-09-05', height:168, number:'10', marketValue:'50 tys. €'},
  {firstName:'Natan', lastName:'Niedźwiedź', position:'Pomocnik ofensywny', birthDate:'2006-06-27', height:184, number:'8'},
  {firstName:'Siméon', lastName:'Oure', position:'Pomocnik ofensywny', birthDate:'1999-10-22', height:175, number:'19', nationality:'Francja'},
  {firstName:'Tymoteusz', lastName:'Gmur', position:'Pomocnik ofensywny', birthDate:'2008-01-02', height:174, number:'90'},
  {firstName:'Paweł', lastName:'Kruszelnicki', position:'Skrzydłowy', birthDate:'2003-01-22', height:177, marketValue:'300 tys. €'},
  {firstName:'Seif', lastName:'Darwish', position:'Skrzydłowy', birthDate:'2003-05-05', height:166, number:'11', marketValue:'150 tys. €', nationality:'Jordania'},
  {firstName:'Kamil', lastName:'Odolak', position:'Napastnik', birthDate:'2002-04-01', height:186, marketValue:'75 tys. €'},
].map(p => Object.assign({clubName:'Stal Mielec'}, p));

const SEED_PLAYERS_ILIGA_WARTA_POSEN = [
  {firstName:'Leo', lastName:'Przybylak', position:'Bramkarz', birthDate:'2004-05-28', height:194, number:'42'},
  {firstName:'Arkadiusz', lastName:'Najemski', position:'Obrońca środkowy', birthDate:'1996-01-12', height:182, marketValue:'250 tys. €'},
  {firstName:'Oleksandr', lastName:'Azatskyi', position:'Obrońca środkowy', birthDate:'1994-01-13', height:192, marketValue:'75 tys. €', nationality:'Ukraina'},
  {firstName:'Kacper', lastName:'Lepczyński', position:'Obrońca środkowy', birthDate:'2001-07-18', height:191, number:'2'},
  {firstName:'Tomasz', lastName:'Wojcinowicz', position:'Obrońca środkowy', birthDate:'1996-04-12', height:186, number:'4'},
  {firstName:'Filip', lastName:'Jakubowski', position:'Obrońca środkowy', birthDate:'2004-09-14', height:188, number:'35'},
  {firstName:'Dmytro', lastName:'Avdeev', position:'Obrońca środkowy', birthDate:'2002-02-26', height:180, number:'24', nationality:'Ukraina'},
  {firstName:'Karol', lastName:'Łysiak', position:'Pomocnik defensywny', birthDate:'2004-02-25', height:178, marketValue:'300 tys. €'},
  {firstName:'Aleksander', lastName:'Wołczek', position:'Pomocnik defensywny', birthDate:'2005-05-31', height:185},
  {firstName:'Kamil', lastName:'Kumoch', position:'Pomocnik defensywny', birthDate:'2000-11-10', height:176, number:'8'},
  {firstName:'Bartosz', lastName:'Lelito', position:'Pomocnik defensywny', birthDate:'2004-11-10', height:186},
  {firstName:'Jan', lastName:'Niedzielski', position:'Pomocnik defensywny', birthDate:'2005-05-26', height:172, number:'13'},
  {firstName:'Oskar', lastName:'Mazurkiewicz', position:'Pomocnik środkowy', birthDate:'2007-05-29', number:'27'},
  {firstName:'Jakub', lastName:'Apolinarski', position:'Skrzydłowy', birthDate:'1999-05-04', height:178, marketValue:'150 tys. €'},
  {firstName:'Igor', lastName:'Stańczak', position:'Skrzydłowy', birthDate:'2006-10-17', height:175},
  {firstName:'Kacper', lastName:'Rychert', position:'Skrzydłowy', birthDate:'2004-09-29', height:181, number:'29'},
  {firstName:'Igor', lastName:'Kornobis', position:'Skrzydłowy', birthDate:'2004-12-11', height:176, number:'16'},
  {firstName:'Marcel', lastName:'Stefaniak', position:'Skrzydłowy', birthDate:'2000-02-22', height:181, number:'17'},
  {firstName:'Szymon', lastName:'Zalewski', position:'Skrzydłowy', birthDate:'2000-04-17', height:180, number:'74'},
  {firstName:'Marcel', lastName:'Zylla', position:'Pomocnik ofensywny', birthDate:'2000-01-14', height:178, number:'21', nationality:'Polska/Niemcy'},
  {firstName:'Patryk', lastName:'Kusztal', position:'Pomocnik ofensywny', birthDate:'2003-03-28', height:176, number:'23'},
  {firstName:'Jędrzej', lastName:'Hanuszczak', position:'Pomocnik ofensywny', birthDate:'2008-03-23', height:176},
  {firstName:'Sebastian', lastName:'Steblecki', position:'Pomocnik ofensywny', birthDate:'1992-01-16', height:187, number:'71'},
  {firstName:'Adrian', lastName:'Wnuk', position:'Pomocnik ofensywny', birthDate:'2006-04-24', height:184},
  {firstName:'Jakub', lastName:'Kendzia', position:'Skrzydłowy', birthDate:'2006-07-13', height:182},
  {firstName:'Mateusz', lastName:'Stanek', position:'Napastnik', birthDate:'2005-03-02', height:190, number:'9'},
  {firstName:'Iwo', lastName:'Wojciechowski', position:'Napastnik', birthDate:'2008-07-28'},
  {firstName:'Michał', lastName:'Smoczyński', position:'Napastnik', birthDate:'2007-07-07', height:190, number:'99'},
].map(p => Object.assign({clubName:'Warta Poznań'}, p));

const SEED_PLAYERS_ILIGA_PODBESKIDZIE_BIELSKO_BIALA = [
  {firstName:'Konrad', lastName:'Forenc', position:'Bramkarz', birthDate:'1992-07-17', height:191, number:'1'},
  {firstName:'Szymon', lastName:'Brańczyk', position:'Bramkarz', birthDate:'2006-08-13', height:191, number:'99'},
  {firstName:'Piotr', lastName:'Twardosz', position:'Obrońca środkowy', birthDate:'2007-06-02', number:'47'},
  {firstName:'Arkadiusz', lastName:'Kasperkiewicz', position:'Obrońca środkowy', birthDate:'1994-09-29', height:187, number:'3', marketValue:'150 tys. €'},
  {firstName:'Marcin', lastName:'Biernat', position:'Obrońca środkowy', birthDate:'1992-05-28', height:190, number:'4'},
  {firstName:'Jan', lastName:'Majsterek', position:'Obrońca środkowy', birthDate:'2000-06-09', height:187, number:'17'},
  {firstName:'Lukasz', lastName:'Kabaj', position:'Obrońca środkowy', birthDate:'2006-02-13', height:183},
  {firstName:'Maksymilian', lastName:'Świta', position:'Obrońca środkowy', birthDate:'2006-04-19', height:185, number:'2'},
  {firstName:'Kamil', lastName:'Sochań', position:'Obrońca środkowy', birthDate:'2004-02-04', height:186},
  {firstName:'Nikodem', lastName:'Gancarczyk', position:'Obrońca boczny', birthDate:'2006-03-06', height:183, number:'27'},
  {firstName:'Aleksander', lastName:'Iwańczyk', position:'Pomocnik defensywny', birthDate:'2007-02-12', height:181, number:'8', marketValue:'75 tys. €'},
  {firstName:'Dalibor', lastName:'Takac', position:'Pomocnik defensywny', birthDate:'1997-10-11', height:178, number:'14', nationality:'Słowacja'},
  {firstName:'Marcin', lastName:'Urynowicz', position:'Pomocnik defensywny', birthDate:'1996-03-16', height:187, number:'26'},
  {firstName:'Oskar', lastName:'Sewerzyński', position:'Pomocnik defensywny', birthDate:'2001-08-12', height:186},
  {firstName:'Piotr', lastName:'Szumiński', position:'Pomocnik defensywny', birthDate:'2006-07-13', height:187, number:'7'},
  {firstName:'Maksymilian', lastName:'Sitek', position:'Skrzydłowy', birthDate:'2000-12-04', height:174, number:'22'},
  {firstName:'Kacper', lastName:'Gach', position:'Skrzydłowy', birthDate:'1998-07-11', height:178, number:'16'},
  {firstName:'Kacper', lastName:'Smoliński', position:'Pomocnik ofensywny', birthDate:'2001-02-07', height:177, number:'10', marketValue:'200 tys. €'},
  {firstName:'Daniel', lastName:'Pietraszkiewicz', position:'Pomocnik ofensywny', birthDate:'2001-09-12', height:178, number:'98'},
  {firstName:'Wojciech', lastName:'Słomka', position:'Pomocnik ofensywny', birthDate:'1998-11-04', height:181},
  {firstName:'Krzysztof', lastName:'Wiesner', position:'Pomocnik ofensywny', birthDate:'2009-10-13', height:180, number:'84'},
  {firstName:'Bartosz', lastName:'Martosz', position:'Pomocnik ofensywny', birthDate:'2006-11-11', height:182, number:'11'},
  {firstName:'Toki', lastName:'Hirosawa', position:'Skrzydłowy', birthDate:'2002-10-21', height:170, number:'21', nationality:'Japonia'},
  {firstName:'Krzysztof', lastName:'Kolanko', position:'Skrzydłowy', birthDate:'2006-08-03', height:169, number:'9', marketValue:'200 tys. €'},
  {firstName:'Evgeniy', lastName:'Shikavka', position:'Napastnik', birthDate:'1992-10-15', height:185, number:'37', nationality:'Białoruś'},
  {firstName:'Oskar', lastName:'Tomczyk', position:'Napastnik', birthDate:'2006-01-25', height:181, number:'90'},
  {firstName:'Lucjan', lastName:'Klisiewicz', position:'Napastnik', birthDate:'2002-04-20', height:193},
  {firstName:'Grzegorz', lastName:'Janusz', position:'Napastnik', birthDate:'2006-05-08', height:193},
].map(p => Object.assign({clubName:'Podbeskidzie Bielsko-Biała'}, p));

const SEED_PLAYERS_ILIGA_UNIA_SKIERNIEWICE = [
  {firstName:'Antoni', lastName:'Wodzicki', position:'Bramkarz', birthDate:'2005-02-13', height:199, marketValue:'100 tys. €'},
  {firstName:'Rafał', lastName:'Grocholski', position:'Bramkarz', birthDate:'2004-12-09', height:191, number:'1'},
  {firstName:'Stanisław', lastName:'Pruszkowski', position:'Bramkarz', birthDate:'2004-07-22', height:198, number:'3'},
  {firstName:'Jonatan', lastName:'Straus', position:'Obrońca środkowy', birthDate:'1994-06-30', height:187, number:'15'},
  {firstName:'Eryk', lastName:'Woliński', position:'Obrońca środkowy', birthDate:'2000-04-10', height:188, number:'28'},
  {firstName:'Mateusz', lastName:'Stępień', position:'Obrońca środkowy', birthDate:'1996-06-10', height:186, number:'3'},
  {firstName:'Oleksandr', lastName:'Gavrylenko', position:'Obrońca środkowy', birthDate:'2006-08-22', height:192, number:'14', nationality:'Ukraina'},
  {firstName:'Igor', lastName:'Antosik', position:'Obrońca środkowy', birthDate:'2007-04-21', height:191, number:'17'},
  {firstName:'Julian', lastName:'Kamiński', position:'Obrońca środkowy', birthDate:'2005-04-15', height:193},
  {firstName:'Bartłomiej', lastName:'Eizenchart', position:'Obrońca boczny', birthDate:'2001-08-23', height:182},
  {firstName:'Jakub', lastName:'Murat', position:'Obrońca boczny', birthDate:'2005-07-22', height:190},
  {firstName:'Sammy', lastName:'Dudek', position:'Pomocnik defensywny', birthDate:'2008-04-18', height:175, marketValue:'200 tys. €', nationality:'Polska/Niemcy'},
  {firstName:'Jakub', lastName:'Bieroński', position:'Pomocnik defensywny', birthDate:'2003-04-18', height:188, number:'6', marketValue:'125 tys. €'},
  {firstName:'Damian', lastName:'Makuch', position:'Pomocnik defensywny', birthDate:'2002-08-16', height:188, number:'20'},
  {firstName:'Maksymilian', lastName:'Kosior', position:'Pomocnik defensywny', birthDate:'2003-03-10', height:185, number:'42'},
  {firstName:'Jan', lastName:'Kozdryk', position:'Pomocnik defensywny', birthDate:'2007-04-17', height:184},
  {firstName:'Patryk', lastName:'Walicki', position:'Pomocnik środkowy', birthDate:'2003-05-29', height:182, number:'7', nationality:'Polska/Belgia'},
  {firstName:'Jakub', lastName:'Czarnecki', position:'Skrzydłowy', birthDate:'2003-09-19', height:178, number:'18'},
  {firstName:'Jan', lastName:'Mierzwa', position:'Skrzydłowy', birthDate:'2005-01-28', height:172},
  {firstName:'Szymon', lastName:'Wrona', position:'Skrzydłowy', birthDate:'2006-08-22', height:172, number:'21'},
  {firstName:'Mateusz', lastName:'Szmyd', position:'Skrzydłowy', birthDate:'2003-06-28', height:175, number:'99'},
  {firstName:'Igor', lastName:'Zyntek', position:'Skrzydłowy', birthDate:'2008-02-07', height:181, number:'10'},
  {firstName:'Krzysztof', lastName:'Toporkiewicz', position:'Pomocnik ofensywny', birthDate:'2002-04-21', height:176, number:'52'},
  {firstName:'Damian', lastName:'Gąska', position:'Pomocnik ofensywny', birthDate:'1996-11-24', height:176},
  {firstName:'Antoni', lastName:'Burkiewicz', position:'Pomocnik ofensywny', birthDate:'2008-04-21', height:183, number:'25'},
  {firstName:'Jakub', lastName:'Jaroch', position:'Pomocnik ofensywny', birthDate:'2007-08-25', height:180, number:'26'},
  {firstName:'Oskar', lastName:'Melich', position:'Pomocnik ofensywny', birthDate:'2006-01-26', height:176},
  {firstName:'Kacper', lastName:'Kalisz', position:'Skrzydłowy', birthDate:'2005-02-24', height:180, number:'9'},
  {firstName:'Kamil', lastName:'Sabiłło', position:'Napastnik', birthDate:'1994-03-24', height:175, number:'11'},
  {firstName:'Bartosz', lastName:'Bida', position:'Napastnik', birthDate:'2001-02-21', height:175},
].map(p => Object.assign({clubName:'Unia Skierniewice'}, p));

// Individually-verified data found via real Transfermarkt search results (not fabricated).
// Only fills currently-blank fields on matching existing players — never overwrites anything already set.
const SEED_PLAYER_ENRICHMENT_ZNICZ = [
  {firstName:'Kacper',     lastName:'Napieraj',    tmLink:'https://www.transfermarkt.pl/kacper-napieraj/profil/spieler/1283223',    birthDate:'2007-04-13'},
  {firstName:'Piotr',      lastName:'Misztal',     tmLink:'https://www.transfermarkt.pl/piotr-misztal/profil/spieler/45047'},
  {firstName:'Maciej',     lastName:'Sypniewski',  tmLink:'https://www.transfermarkt.pl/maciej-sypniewski/profil/spieler/1283222'},
  {firstName:'Jarosław',   lastName:'Jach',        tmLink:'https://www.transfermarkt.pl/jaroslaw-jach/profil/spieler/327755',        agencyName:'Pawel Staniszewski'},
  {firstName:'Michał',     lastName:'Pawlik',      tmLink:'https://www.transfermarkt.pl/michal-pawlik/profil/spieler/240811'},
  {firstName:'Michał',     lastName:'Borecki',     tmLink:'https://www.transfermarkt.pl/michal-borecki/profil/spieler/265878',       agencyName:'KFM'},
  {firstName:'Patryk',     lastName:'Plewka',      tmLink:'https://www.transfermarkt.pl/patryk-plewka/profil/spieler/495237',        agencyName:'ProSport Manager'},
  {firstName:'Aleksander', lastName:'Nadolski',    tmLink:'https://www.transfermarkt.pl/aleksander-nadolski/profil/spieler/1048614',  agencyName:'Mariusz Kulesza'},
  {firstName:'Vladyslav',  lastName:'Okhronchuk',  tmLink:'https://www.transfermarkt.pl/vladyslav-okhronchuk/profil/spieler/489546',  agencyName:'ABP Sport'},
].map(p => Object.assign({clubName:'Znicz Pruszków'}, p));

// Individually-verified via real Transfermarkt/club/press searches (not fabricated). Fill-blanks-only,
// plus explicit position corrections where deeper research contradicted the generic default guess made
// at import time (e.g. Aftyka/Wełniak are confirmed centre-forwards, not the generic midfielder default).
const SEED_PLAYER_ENRICHMENT_AVIA = [
  {firstName:'Grzegorz', lastName:'Aftyka', clubName:'Avia Świdnik', birthDate:'1998-02-02', height:178, correctPosition:'Napastnik', agencyName:'FairSport', tmLink:'https://www.transfermarkt.pl/grzegorz-aftyka/profil/spieler/266346'},
  {firstName:'Łukasz', lastName:'Jakubowski', clubName:'Avia Świdnik', birthDate:'2006-12-08', height:191, agencyName:'11-Football Players', tmLink:'https://www.transfermarkt.pl/lukasz-jakubowski/profil/spieler/1155814'},
  {firstName:'Wojciech', lastName:'Karasiewicz', clubName:'Avia Świdnik', birthDate:'2006-09-30', height:173, correctPosition:'Skrzydłowy', agencyName:'FFG', tmLink:'https://www.transfermarkt.pl/wojciech-karasiewicz/profil/spieler/1232369'},
  {firstName:'Michał', lastName:'Kołodziejski', clubName:'Avia Świdnik', birthDate:'1993-05-09', height:184, tmLink:'https://www.transfermarkt.pl/michal-kolodziejski/profil/spieler/85522'},
  {firstName:'Egzon', lastName:'Kryeziu', clubName:'Avia Świdnik', birthDate:'2000-04-25', height:180, correctPosition:'Pomocnik ofensywny', agencyName:'FBG', nationality:'Słowenia', tmLink:'https://www.transfermarkt.pl/egzon-kryeziu/profil/spieler/469693'},
  {firstName:'Marcin', lastName:'Kumorek', clubName:'Avia Świdnik', birthDate:'2003-03-08', height:188, correctPosition:'Pomocnik defensywny', tmLink:'https://www.transfermarkt.pl/marcin-kumorek/profil/spieler/949201'},
  {firstName:'Kacper', lastName:'Weśniak', correctLastName:'Wełniak', clubName:'Avia Świdnik', birthDate:'2000-05-21', height:185, correctPosition:'Napastnik', tmLink:'https://www.transfermarkt.pl/kacper-welniak/profil/spieler/393567'},
  {firstName:'Mateusz', lastName:'Wójcik', clubName:'Avia Świdnik', birthDate:'2005-10-31', height:180, correctPosition:'Pomocnik defensywny', tmLink:'http://www.90minut.pl/kariera.php?id=43416'},
];

function uid(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function esc(s){ return (s===undefined||s===null?"":String(s)).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

// Przerysowanie okna modalnego buduje jego zawartość od nowa, więc pole tekstowe, w którym ktoś
// pisze, jest niszczone i tworzone ponownie — kursor wraca wtedy na początek i kolejne litery
// wchodzą od tyłu („Maciej" zamieniało się w „jeicaM"). render() radzi sobie z tym dla treści
// strony, ale okna modalne żyją poza nią, więc potrzebują własnego zabezpieczenia.
// Zapamiętujemy pozycję kursora przed przerysowaniem i przywracamy ją do tego samego pola.
// Przełącznik jasnego i ciemnego motywu.
//
// Motyw jest wyłącznie zmianą wartości zmiennych CSS — żadna reguła układu się nie rusza, więc
// przełączenie nie może niczego rozjechać. Wybór trzymamy w pamięci przeglądarki, a nie w bazie:
// to ustawienie TEGO urządzenia, a nie konta, i baza jest wspólna dla całego zespołu.
//
// Pierwsze wejście bez zapisanego wyboru idzie za ustawieniem systemu operacyjnego.
function odswiezPrzelacznikMotywu(){
  const btn = document.getElementById('theme-toggle');
  if(!btn) return;
  const ciemny = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.innerHTML = ciemny ? '☀️ <span>Jasne tło</span>' : '🌙 <span>Ciemne tło</span>';
  btn.title = ciemny ? 'Przełącz na jasny motyw' : 'Przełącz na ciemny motyw';
  btn.onclick = ()=>{
    const teraz = document.documentElement.getAttribute('data-theme') === 'dark';
    if(teraz) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme','dark');
    try{ localStorage.setItem('sbs-motyw', teraz ? 'light' : 'dark'); }catch(e){ /* tryb prywatny */ }
    odswiezPrzelacznikMotywu();
  };
}

function zachowajKursorPoPrzerysowaniu(kontener, selektor, przerysuj){
  const stare = kontener.querySelector(selektor);
  const poz = (stare && stare.selectionStart != null) ? stare.selectionStart : null;
  przerysuj();
  const nowe = kontener.querySelector(selektor);
  if(!nowe) return;
  nowe.focus();
  const docelowa = poz != null ? poz : String(nowe.value || '').length;
  try{ nowe.setSelectionRange(docelowa, docelowa); }catch(e){ /* np. input[type=number] tego nie wspiera */ }
}
function fmt1(n){ return (Math.round(n*10)/10).toFixed(1); }

async function enrichZniczRoster(){
  const club = DB.clubs.find(c => c.name === 'Znicz Pruszków');
  if(!club) return {ok:false, error:'Nie znaleziono klubu Znicz Pruszków.'};
  let changed = 0;
  SEED_PLAYER_ENRICHMENT_ZNICZ.forEach(enrich=>{
    const pl = DB.players.find(x => x.firstName===enrich.firstName && x.lastName===enrich.lastName && x.clubId===club.id);
    if(!pl) return;
    if(!pl.tmLink && enrich.tmLink){ pl.tmLink = enrich.tmLink; changed++; }
    if(!pl.birthDate && enrich.birthDate){ pl.birthDate = enrich.birthDate; pl.birthYear = String(new Date(enrich.birthDate).getFullYear()); changed++; }
    if(!pl.hasAgent && enrich.agencyName){ pl.hasAgent = true; pl.agencyName = enrich.agencyName; changed++; }
  });
  // Uwaga: zapis (savePlayers) celowo NIE dzieje się tutaj — wywołujący (loadAllInner) grupuje zmiany
  // ze wszystkich bramek wzbogacania w JEDEN zapis na końcu, zamiast do 7 osobnych cykli ponawiania.
  return {ok:true, changed};
}

async function enrichRosterGeneric(enrichArray){
  let changed = 0;
  enrichArray.forEach(enrich=>{
    const club = DB.clubs.find(c => c.name === enrich.clubName);
    if(!club) return;
    let pl = DB.players.find(x => x.firstName===enrich.firstName && x.lastName===enrich.lastName && x.clubId===club.id);
    if(!pl && enrich.correctLastName){
      // Covers a fresh import where the seed data already uses the corrected spelling (no rename needed here)
      pl = DB.players.find(x => x.firstName===enrich.firstName && x.lastName===enrich.correctLastName && x.clubId===club.id);
    }
    if(!pl) return;
    if(!pl.tmLink && enrich.tmLink){ pl.tmLink = enrich.tmLink; changed++; }
    if(!pl.height && enrich.height){ pl.height = enrich.height; changed++; }
    if(!pl.birthDate && enrich.birthDate){ pl.birthDate = enrich.birthDate; pl.birthYear = String(new Date(enrich.birthDate).getFullYear()); changed++; }
    if(!pl.hasAgent && enrich.agencyName){ pl.hasAgent = true; pl.agencyName = enrich.agencyName; changed++; }
    if(enrich.correctLastName && pl.lastName===enrich.lastName){ pl.lastName = enrich.correctLastName; changed++; }
    if(enrich.correctPosition && pl.position!==enrich.correctPosition){ pl.position = enrich.correctPosition; changed++; }
    if(enrich.nationality && !(pl.notes||'').includes('Narodowość')){ pl.notes = (pl.notes?pl.notes+' ':'') + 'Narodowość: '+enrich.nationality+'.'; changed++; }
    if(enrich.notes && !(pl.notes||'').includes(enrich.notes)){ pl.notes = (pl.notes?pl.notes+' ':'') + enrich.notes; changed++; }
    if(pl.birthDate && pl.notes && pl.notes.includes('Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.')){
      pl.notes = pl.notes.replace('Brak daty ur./wzrostu w źródle — uzupełnij ręcznie.', '').trim();
      changed++;
    }
  });
  // Uwaga: zapis (savePlayers) celowo NIE dzieje się tutaj — patrz komentarz w enrichZniczRoster powyżej.
  return {ok:true, changed};
}

async function importClubRoster(clubName, seedArray, profileTmUrl){
  const club = DB.clubs.find(c => c.name === clubName);
  if(!club) return {ok:false, error:'Nie znaleziono klubu '+clubName+' w bazie klubów.'};
  let addedPlayers = 0;
  seedArray.forEach(seed=>{
    const exists = DB.players.some(pl => pl.firstName===seed.firstName && pl.lastName===seed.lastName && pl.clubId===club.id);
    if(!exists){
      let notes = seed.notes || '';
      if(!notes){
        const noteParts = [];
        if(seed.number) noteParts.push('nr '+seed.number);
        if(seed.marketValue) noteParts.push('wartość rynkowa: '+seed.marketValue);
        if(seed.nationality) noteParts.push('narodowość: '+seed.nationality);
        notes = noteParts.length ? ('Transfermarkt — '+noteParts.join(', ')+'.') : '';
      }
      // Age-only source (no exact birthdate given): store an approximate birth year, clearly flagged as such.
      // Rocznik trzymamy ZAWSZE jako tekst — w bazie kolumna jest tekstowa, a mieszanie liczby
      // z tekstem rozjeżdżało porównania w widoku roczników i przy dopasowywaniu importu.
      let birthYear = seed.birthDate ? String(new Date(seed.birthDate).getFullYear()) : '';
      if(!seed.birthDate && seed.age){
        birthYear = String(2026 - seed.age);
        notes = (notes ? notes+' ' : '') + '(Rocznik przybliżony na podstawie wieku podanego w źródle — nie dokładna data urodzenia.)';
      }
      DB.players.push({
        id: uid('Z'),
        firstName: seed.firstName, lastName: seed.lastName,
        birthDate: seed.birthDate || '',
        birthYear,
        position: seed.position, foot: '', height: seed.height || null,
        status: 'Nowy typ', clubId: club.id, scout: '',
        videoLink: '', lnpLink: '', tmLink: '',
        hasAgent: false, agencyName: '', formation: '', customFields: {},
        notes,
        dateAdded: new Date().toISOString().slice(0,10)
      });
      addedPlayers++;
    }
  });
  let clubChanged = false;
  if(profileTmUrl && !club.profileTm){
    club.profileTm = profileTmUrl;
    clubChanged = true;
  }
  // Uwaga: zapis (saveClubs/savePlayers) celowo NIE dzieje się tutaj per-klub — przy imporcie wielu
  // klubów naraz (importAllKnownRosters) to prowadziło do nawet ~38 osobnych operacji zapisu, każda z
  // własnym cyklem ponawiania w razie problemów z pamięcią. Wywołujący zbiera zmiany i zapisuje raz.
  return {ok:true, added:addedPlayers, total:seedArray.length, clubChanged};
}
const CLUB_ROSTER_IMPORTS_ILIGA = [
  {clubName:'Lechia Gdańsk', players: SEED_PLAYERS_ILIGA_LECHIA_GDANSK, profileTm:'https://www.transfermarkt.pl/lechia-gdansk/startseite/verein/4000'},
  {clubName:'Arka Gdynia', players: SEED_PLAYERS_ILIGA_ARKA_GDYNIA, profileTm:'https://www.transfermarkt.pl/arka-gdynia/startseite/verein/6107'},
  {clubName:'Polonia Warszawa', players: SEED_PLAYERS_ILIGA_POLONIA_WARSCHAU, profileTm:'https://www.transfermarkt.pl/polonia-warschau/startseite/verein/2745'},
  {clubName:'Miedź Legnica', players: SEED_PLAYERS_ILIGA_MIEDZ_LEGNICA, profileTm:'https://www.transfermarkt.pl/miedz-legnica/startseite/verein/8936'},
  {clubName:'ŁKS Łódź', players: SEED_PLAYERS_ILIGA_LKS_LODZ, profileTm:'https://www.transfermarkt.pl/lks-lodz/startseite/verein/256'},
  {clubName:'Odra Opole', players: SEED_PLAYERS_ILIGA_ODRA_OPOLE, profileTm:'https://www.transfermarkt.pl/odra-opole/startseite/verein/5699'},
  {clubName:'Bruk-Bet Termalica Nieciecza', players: SEED_PLAYERS_ILIGA_BRUK_BET_TERMALICA_NIECIECZA, profileTm:'https://www.transfermarkt.pl/bruk-bet-termalica-nieciecza/startseite/verein/15906'},
  {clubName:'Ruch Chorzów', players: SEED_PLAYERS_ILIGA_RUCH_CHORZOW, profileTm:'https://www.transfermarkt.pl/ruch-chorzow/startseite/verein/318'},
  {clubName:'Puszcza Niepołomice', players: SEED_PLAYERS_ILIGA_PUSZCZA_NIEPOLOMICE, profileTm:'https://www.transfermarkt.pl/puszcza-niepolomice/startseite/verein/28893'},
  {clubName:'Polonia Bytom', players: SEED_PLAYERS_ILIGA_POLONIA_BYTOM, profileTm:'https://www.transfermarkt.pl/polonia-bytom/startseite/verein/7976'},
  {clubName:'Pogoń Grodzisk Mazowiecki', players: SEED_PLAYERS_ILIGA_POGON_GRODZISK_MAZOWIECKI, profileTm:'https://www.transfermarkt.pl/pogon-grodzisk-mazowiecki/startseite/verein/30998'},
  {clubName:'Chrobry Głogów', players: SEED_PLAYERS_ILIGA_CHROBRY_GLOGOW, profileTm:'https://www.transfermarkt.pl/chrobry-glogow/startseite/verein/8377'},
  {clubName:'Stal Rzeszów', players: SEED_PLAYERS_ILIGA_STAL_RZESZOW, profileTm:'https://www.transfermarkt.pl/stal-rzeszow/startseite/verein/9510'},
  {clubName:'Pogoń Siedlce', players: SEED_PLAYERS_ILIGA_POGON_SIEDLCE, profileTm:'https://www.transfermarkt.pl/pogon-siedlce/startseite/verein/4896'},
  {clubName:'Stal Mielec', players: SEED_PLAYERS_ILIGA_STAL_MIELEC, profileTm:'https://www.transfermarkt.pl/stal-mielec/startseite/verein/22431'},
  {clubName:'Warta Poznań', players: SEED_PLAYERS_ILIGA_WARTA_POSEN, profileTm:'https://www.transfermarkt.pl/warta-posen/startseite/verein/7146'},
  {clubName:'Podbeskidzie Bielsko-Biała', players: SEED_PLAYERS_ILIGA_PODBESKIDZIE_BIELSKO_BIALA, profileTm:'https://www.transfermarkt.pl/podbeskidzie-bielsko-biala/startseite/verein/6361'},
  {clubName:'Unia Skierniewice', players: SEED_PLAYERS_ILIGA_UNIA_SKIERNIEWICE, profileTm:'https://www.transfermarkt.pl/unia-skierniewice/startseite/verein/30753'},
];
const CLUB_ROSTER_IMPORTS = [
  {clubName:'Znicz Pruszków', players: SEED_PLAYERS_ZNICZ, profileTm:'https://www.transfermarkt.pl/znicz-pruszkow/startseite/verein/9109'},
  {clubName:'Legia II Warszawa', players: SEED_PLAYERS_LEGIA_II, profileTm:'https://www.transfermarkt.pl/legia-warschau-ii/startseite/verein/6628'},
  {clubName:'Górnik Łęczna', players: SEED_PLAYERS_GORNIK_LECZNA, profileTm:'https://www.transfermarkt.pl/gornik-leczna/startseite/verein/3291'},
  {clubName:'Chojniczanka Chojnice', players: SEED_PLAYERS_CHOJNICZANKA, profileTm:'https://www.transfermarkt.pl/chojniczanka-chojnice/startseite/verein/28887'},
  {clubName:'Avia Świdnik', players: SEED_PLAYERS_AVIA, profileTm:'https://www.transfermarkt.pl/avia-swidnik/startseite/verein/10768'},
  {clubName:'Rekord Bielsko-Biała', players: SEED_PLAYERS_REKORD, profileTm:'https://www.transfermarkt.pl/rekord-bielsko-biala/startseite/verein/31568'},
  {clubName:'Świt Szczecin', players: SEED_PLAYERS_SWIT_SZCZECIN, profileTm:'https://www.transfermarkt.pl/swit-stettin/startseite/verein/50309'},
  {clubName:'Śląsk II Wrocław', players: SEED_PLAYERS_SLASK_II, profileTm:'https://www.transfermarkt.pl/slask-wroclaw-ii/startseite/verein/22568'},
  {clubName:'Olimpia Grudziądz', players: SEED_PLAYERS_OLIMPIA_GRUDZIADZ, profileTm:'https://www.transfermarkt.pl/olimpia-grudziadz/startseite/verein/26564'},
  {clubName:'Sandecja Nowy Sącz', players: SEED_PLAYERS_SANDECJA},
  {clubName:'Podhale Nowy Targ', players: SEED_PLAYERS_PODHALE},
  {clubName:'Stal Stalowa Wola', players: SEED_PLAYERS_STAL_STALOWA_WOLA},
  {clubName:'Hutnik Kraków', players: SEED_PLAYERS_HUTNIK},
  {clubName:'Resovia', players: SEED_PLAYERS_RESOVIA},
  {clubName:'Lechia Zielona Góra', players: SEED_PLAYERS_LECHIA_ZG},
  {clubName:'Zawisza Bydgoszcz', players: SEED_PLAYERS_ZAWISZA},
  {clubName:'GKS Tychy', players: SEED_PLAYERS_GKS_TYCHY},
  {clubName:'Sokół Kleczew', players: SEED_PLAYERS_SOKOL_KLECZEW},
  {clubName:'Avia Świdnik', players: SEED_PLAYERS_AVIA_V2, profileTm:'https://www.transfermarkt.pl/avia-swidnik/startseite/verein/10768'},
  {clubName:'Olimpia Grudziądz', players: SEED_PLAYERS_OLIMPIA_V2, profileTm:'https://www.transfermarkt.pl/olimpia-grudziadz/startseite/verein/26564'},
  ...CLUB_ROSTER_IMPORTS_ILIGA,
];
async function importAllKnownRosters(){
  let totalAdded = 0, totalPlayers = 0, anyClubChanged = false;
  const perClub = [];
  for(const cfg of CLUB_ROSTER_IMPORTS){
    const result = await importClubRoster(cfg.clubName, cfg.players, cfg.profileTm);
    if(result.ok){
      totalAdded += result.added; totalPlayers += result.total; perClub.push({clubName:cfg.clubName, added:result.added});
      if(result.clubChanged) anyClubChanged = true;
    }
  }
  // Jeden zapis klubów i jeden zapis zawodników na koniec całego importu, zamiast osobnego zapisu
  // dla każdego z 19 klubów — kluczowe dla szybkości i niezawodności pierwszego uruchomienia aplikacji.
  if(anyClubChanged) await saveClubs();
  if(totalAdded>0) await savePlayers();
  return {ok:true, added:totalAdded, total:totalPlayers, perClub};
}
let quietFlagFailCount = 0;
async function quietFlagSet(key){
  try{ await storage.set(key, '1', true); }
  catch(e){ quietFlagFailCount++; }
}

async function loadAllInner(){
  // Faza 1: równoległe wczytanie WSZYSTKICH kolekcji i flag jednorazowych. Wcześniej ~16 odczytów szło
  // sekwencyjnie (każdy to osobny round-trip do Supabase) — przy dużej bazie sumowało się do kilkunastu
  // sekund. Promise.all robi je naraz; każdy z własnym .catch, więc pojedynczy błąd nie wywraca całości.
  // Pomiar czasu i wielkości każdego odczytu. Bez niego „długo się ładuje" pozostaje wrażeniem,
  // a przy kilkunastu kolekcjach nie ma jak zgadnąć, która z nich ciąży. Wynik ląduje w konsoli
  // przeglądarki (F12 → Console) jako tabelka: ile milisekund i ile kilobajtów.
  const pomiar = [];
  const czytaj = async (klucz)=>{
    const start = performance.now();
    try{
      const wiersz = await storage.get(klucz, true);
      pomiar.push({ kolekcja: klucz.replace('scouting:',''), ms: Math.round(performance.now()-start),
                    kB: Math.round(((wiersz && wiersz.value ? wiersz.value.length : 0)/1024)) });
      return wiersz;
    }catch(e){
      pomiar.push({ kolekcja: klucz.replace('scouting:',''), ms: Math.round(performance.now()-start), kB: 0 });
      return null;
    }
  };

  const [p, c, o, rp, tl, ct, mt, ag, agt, pmaRow, s,
    seedFlag, enrichFlag, enrichAviaFlag, enrichGornikFlag, enrichAviaV2Flag, recoMigrationFlag, statusMigrationFlag] = await Promise.all([
    czytaj('scouting:players'),
    czytaj('scouting:clubs'),
    czytaj('scouting:observations'),
    czytaj('scouting:reports'),
    czytaj('scouting:talents'),
    czytaj('scouting:contacts'),
    czytaj('scouting:matches'),
    czytaj('scouting:agencies'),
    czytaj('scouting:agents'),
    storage.get('scouting:position_map_assignments', true).catch(()=>null),
    storage.get('scouting:settings', true).catch(()=>null),
    storage.get('scouting:seed_rosters_v9', true).catch(()=>null),
    storage.get('scouting:enrich_znicz_players_v1', true).catch(()=>null),
    storage.get('scouting:enrich_avia_v1', true).catch(()=>null),
    storage.get('scouting:enrich_gornik_v1', true).catch(()=>null),
    storage.get('scouting:enrich_avia_olimpia_v2', true).catch(()=>null),
    storage.get('scouting:reco_migration_v1', true).catch(()=>null),
    storage.get('scouting:status_migration_v1', true).catch(()=>null),
  ]);
  try{ DB.players = p ? JSON.parse(p.value) : []; }catch(e){ DB.players = []; }
  try{ DB.clubs = c ? JSON.parse(c.value) : []; }catch(e){ DB.clubs = []; }
  try{ DB.observations = o ? JSON.parse(o.value) : []; }catch(e){ DB.observations = []; }
  try{ DB.reports = rp ? JSON.parse(rp.value) : []; }catch(e){ DB.reports = []; }
  try{ DB.talents = tl ? JSON.parse(tl.value) : []; }catch(e){ DB.talents = []; }
  try{ DB.contacts = ct ? JSON.parse(ct.value) : []; }catch(e){ DB.contacts = []; }
  try{ DB.matches = mt ? JSON.parse(mt.value) : []; }catch(e){ DB.matches = []; }
  try{ DB.agencies = ag ? JSON.parse(ag.value) : []; }catch(e){ DB.agencies = []; }
  try{ DB.agents = agt ? JSON.parse(agt.value) : []; }catch(e){ DB.agents = []; }
  try{ positionMapAssignments = pmaRow ? JSON.parse(pmaRow.value) : {}; }catch(e){ positionMapAssignments = {}; }
  try{
    const loaded = s ? JSON.parse(s.value) : {};
    DB.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), loaded);
  }catch(e){ DB.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); }
  if(DB.settings.scouts && DB.settings.scouts.length){ currentScout = DB.settings.scouts[0]; }
  // Wczesny render — użytkownik widzi bazę natychmiast po równoległym odczycie; migracje/seed/wzbogacanie
  // (poniżej) na istniejącej instalacji są prawie natychmiastowe i i tak wywołają końcowe render().
  try{ render(); }catch(e){ console.error('Wczesny render() nie powiódł się (niekrytyczny):', e); }

  // HERBY I LOGOTYPY DOCHODZĄ W TLE.
  //
  // To obrazki zapisane jako base64 — najcięższa rzecz w całej bazie, kilka megabajtów przy
  // komplecie klubów. Wstrzymywanie na nie PIERWSZEGO widoku znaczyło, że po zalogowaniu patrzy
  // się w pustkę, czekając na ozdobniki: lista klubów i zawodników jest czytelna także bez nich,
  // a herby pojawią się same, gdy dojdą. Migracja starych herbów też idzie tutaj — musi widzieć
  // wczytaną mapę, inaczej nadpisałaby ją niepełną.
  void (async ()=>{
    const [cc, agLogo] = await Promise.all([
      czytaj('scouting:club_crests'),
      czytaj('scouting:agency_logos'),
    ]);
    try{ DB.clubCrests = cc ? JSON.parse(cc.value) : {}; }catch(e){ DB.clubCrests = {}; }
    try{ DB.agencyLogos = agLogo ? JSON.parse(agLogo.value) : {}; }catch(e){ DB.agencyLogos = {}; }
    // Ratunek dla logotypów, które trafiły do mapy herbów, zanim dostały własny magazyn.
    Object.keys(DB.clubCrests||{}).forEach(id=>{
      if(!id.startsWith('AG')) return;
      if(!DB.agencyLogos[id]) DB.agencyLogos[id] = DB.clubCrests[id];
      delete DB.clubCrests[id];
    });

    // Jednorazowa migracja: herby (base64) zapisane wprost w polu crestUrl klubu -> osobny magazyn.
    let migratedAnyCrest = false;
    DB.clubs.forEach(club=>{
      if(club.crestUrl && club.crestUrl.startsWith('data:image')){
        DB.clubCrests[club.id] = club.crestUrl;
        club.crestUrl = '';
        migratedAnyCrest = true;
      }
    });
    if(migratedAnyCrest){
      try{ await saveClubCrests(); }catch(e){ console.error('Migracja herbów (zapis) nie powiodła się', e); }
      try{ await saveClubs(); }catch(e){ console.error('Migracja herbów (czyszczenie starego pola) nie powiodła się', e); }
    }

    try{ render(); }catch(e){ /* widok mógł się w międzyczasie zmienić — nic pilnego */ }
    console.table(pomiar.slice().sort((a,b)=> b.ms - a.ms));
  })();
  // Lista startowa klubów wstawia się TYLKO RAZ, przy pierwszym uruchomieniu na danej bazie.
  //
  // Wcześniej przebiegała przy każdym starcie i dokładała wszystko, czego akurat nie było — więc
  // każdy usunięty klub wracał po odświeżeniu strony. Tak wracały „Skra Częstochowa" i „Słowianin
  // Wolibórz" (drużyny spoza rozgrywek) oraz drugie warianty nazw po scaleniu duplikatów.
  // Kasowanie klubu było skuteczne dokładnie do następnego wejścia na stronę.
  const klubyZaslane = await storage.get('scouting:seed_clubs_v1', true).catch(()=>null);
  if(!klubyZaslane){
    let addedSeed = false;
    ALL_SEED_CLUBS.forEach(seed=>{
      const exists = DB.clubs.some(c2=>c2.name===seed.name && c2.league===seed.league);
      if(!exists){ DB.clubs.push(Object.assign({}, seed, {id: uid('K')})); addedSeed = true; }
    });
    if(addedSeed) await saveClubs();
    await quietFlagSet('scouting:seed_clubs_v1');
  }
  // IV liga łódzka — osiemnaście klubów sezonu 2026/2027, wprost z tabeli 90minut.
  //
  // Lista startowa wyżej wstawia się TYLKO przy pierwszym uruchomieniu, a ta grupa doszła później,
  // gdy działająca baza dawno miała ten znacznik ustawiony. Stąd osobna, jednorazowa migracja
  // z własnym znacznikiem: dokłada tylko brakujące kluby i tylko raz, więc usunięty klub nie wraca
  // po odświeżeniu strony (na tym potknęła się kiedyś lista startowa).
  const lodzkaZaslana = await storage.get('scouting:seed_iv_lodzka_v1', true).catch(()=>null);
  if(!lodzkaZaslana){
    let dodano = false;
    SEED_CLUBS_IV_LODZKA.forEach(seed=>{
      const jest = DB.clubs.some(c2=> c2.name === seed.name && c2.league === seed.league);
      if(!jest){ DB.clubs.push(Object.assign({}, seed, {id: uid('K')})); dodano = true; }
    });
    if(dodano) await saveClubs();
    await quietFlagSet('scouting:seed_iv_lodzka_v1');
  }
  if(!seedFlag){
    try{ await importAllKnownRosters(); }catch(e){ console.error('Roster seed error', e); }
    await quietFlagSet('scouting:seed_rosters_v9');
  }
  let totalEnrichChanged = 0;
  if(!enrichFlag){
    try{ const r = await enrichZniczRoster(); totalEnrichChanged += r.changed||0; }catch(e){ console.error('Znicz enrich error', e); }
    await quietFlagSet('scouting:enrich_znicz_players_v1');
  }
  if(!enrichAviaFlag){
    try{ const r = await enrichRosterGeneric(SEED_PLAYER_ENRICHMENT_AVIA); totalEnrichChanged += r.changed||0; }catch(e){ console.error('Avia enrich error', e); }
    await quietFlagSet('scouting:enrich_avia_v1');
  }
  if(!enrichGornikFlag){
    try{
      const r1 = await enrichRosterGeneric(SEED_PLAYER_ENRICHMENT_GORNIK);
      const r2 = await enrichRosterGeneric(SEED_PLAYER_ENRICHMENT_REKORD);
      totalEnrichChanged += (r1.changed||0) + (r2.changed||0);
    }catch(e){ console.error('Gornik/Rekord enrich error', e); }
    await quietFlagSet('scouting:enrich_gornik_v1');
  }
  if(!enrichAviaV2Flag){
    try{
      const r1 = await enrichRosterGeneric(SEED_PLAYER_ENRICHMENT_AVIA_V2);
      const r2 = await enrichRosterGeneric(SEED_PLAYER_ENRICHMENT_OLIMPIA);
      const r3 = await enrichRosterGeneric(SEED_PLAYER_ENRICHMENT_MARCINHO);
      totalEnrichChanged += (r1.changed||0) + (r2.changed||0) + (r3.changed||0);
    }catch(e){ console.error('Avia/Olimpia V2 enrich error', e); }
    await quietFlagSet('scouting:enrich_avia_olimpia_v2');
  }
  // Jeden zapis zawodników na koniec WSZYSTKICH bramek wzbogacania, zamiast do 7 osobnych.
  if(totalEnrichChanged > 0){ try{ await savePlayers(); }catch(e){ console.error('Batched enrichment savePlayers error', e); } }
  if(!recoMigrationFlag){
    DB.settings.recommendations = ["Kontynuować obserwację","Zaprosić na testy","(Do transferu)","Odrzucić","Zbyt wcześnie ocenić"];
    let anyObsChanged = false;
    DB.observations.forEach(o=>{
      if(o.recommendation === 'Rekomendować transfer'){ o.recommendation = '(Do transferu)'; anyObsChanged = true; }
      if(o.recommendation === 'Przyspieszyć / kolejny mecz pilnie'){ o.recommendation = 'Kontynuować obserwację'; anyObsChanged = true; }
    });
    try{ await saveSettings(); }catch(e){ console.error('Reco settings migration save error', e); }
    if(anyObsChanged){ try{ await saveObservations(); }catch(e){ console.error('Reco observations migration save error', e); } }
    await quietFlagSet('scouting:reco_migration_v1');
  }
  if(!statusMigrationFlag){
    DB.settings.statuses = ["Do Obserwacji","Rekomendowany","Na Testy","Odrzucony","Do transferu"];
    const STATUS_REMAP = {
      'Nowy typ':'Do Obserwacji', 'W obserwacji':'Do Obserwacji', 'Na testach':'Na Testy',
      'Podpisany':'Do transferu', 'Wstrzymany':'Do Obserwacji'
    };
    let anyPlayerChanged = false;
    DB.players.forEach(p=>{
      if(STATUS_REMAP[p.status]){ p.status = STATUS_REMAP[p.status]; anyPlayerChanged = true; }
    });
    try{ await saveSettings(); }catch(e){ console.error('Status settings migration save error', e); }
    if(anyPlayerChanged){ try{ await savePlayers(); }catch(e){ console.error('Status players migration save error', e); } }
    await quietFlagSet('scouting:status_migration_v1');
  }
  // Zapewnienia ustawień PO migracjach (żeby migracja statusów ich nie nadpisała): status "Z polecenia"
  // oraz rozbicie CLJ U17 na grupę zachodnią/wschodnią. Idempotentne, bez wymuszania zapisu.
  if(Array.isArray(DB.settings.statuses) && !DB.settings.statuses.includes('Z polecenia')){
    const idx = DB.settings.statuses.indexOf('Odrzucony');
    if(idx >= 0) DB.settings.statuses.splice(idx, 0, 'Z polecenia'); else DB.settings.statuses.push('Z polecenia');
  }
  if(Array.isArray(DB.settings.leagues)){
    const L = DB.settings.leagues;
    if(!L.includes('I liga')) L.unshift('I liga');
    if(!L.includes('Ekstraklasa')) L.unshift('Ekstraklasa');   // najwyższy poziom — na początek listy
    if(!L.includes('CLJ U19')) L.push('CLJ U19');
    const variants = ['CLJ U17 (zachodnia)','CLJ U17 (wschodnia)'].filter(v=>!L.includes(v));
    const plain = L.indexOf('CLJ U17');
    if(plain >= 0) L.splice(plain, 1, ...variants);
    else variants.forEach(v=>L.push(v));
    // Usuń "Liga wojewódzka U15" z listy (na życzenie) także w istniejącej bazie.
    const woj = L.indexOf('Liga wojewódzka U15');
    if(woj >= 0) L.splice(woj, 1);
  }
  // Kategorie juniorskie wg ROCZNIKA (2011-2014) — osobne "grupy" pod Kategoriami juniorskimi,
  // do zakładania klubów/drużyn rocznikowych i wgrywania ich zawodników. Idempotentnie dla
  // istniejących instalacji (dopisujemy brakujące na koniec listy lig).
  if(Array.isArray(DB.settings.leagues)){
    ['Rocznik 2011','Rocznik 2012','Rocznik 2013','Rocznik 2014'].forEach(r=>{
      if(!DB.settings.leagues.includes(r)) DB.settings.leagues.push(r);
    });
    // Grupy IV ligi dochodzą pojedynczo, w miarę jak wchodzą w obszar obserwacji. Wstawiamy je
    // PRZY pozostałych grupach IV ligi, żeby lista nie miała ich doklejonych na końcu, za
    // kategoriami juniorskimi — i tylko wtedy, gdy jeszcze ich nie ma.
    ['IV liga (kujawsko-pomorska)', 'IV liga (łódzka)'].forEach(grupa=>{
      if(DB.settings.leagues.includes(grupa)) return;
      const last4 = DB.settings.leagues.map(l=>/^IV liga \(/.test(l)).lastIndexOf(true);
      DB.settings.leagues.splice(last4 >= 0 ? last4+1 : DB.settings.leagues.length, 0, grupa);
    });
  }
  // Rozszerzona lista pozycji (skrzydłowy P/L, wahadłowy P/L, obrońcy P/L/środkowi) także w istniejących
  // instalacjach. Zastępujemy całą listę kanoniczną — stare wartości pozycji zawodników nadal w niej są.
  if(Array.isArray(DB.settings.positions) && !DB.settings.positions.includes('Skrzydłowy prawy')){
    DB.settings.positions = ["Bramkarz","Obrońca prawy","Obrońca lewy","Obrońca środkowy","Obrońca środkowy prawy","Obrońca środkowy centralny","Obrońca środkowy lewy","Obrońca boczny","Wahadłowy prawy","Wahadłowy lewy","Pomocnik defensywny","Pomocnik środkowy","Pomocnik ofensywny","Skrzydłowy","Skrzydłowy prawy","Skrzydłowy lewy","Napastnik"];
  }
  if(quietFlagFailCount > 0){
    console.log('Uwaga (niegroźne): ' + quietFlagFailCount + ' znaczników "już to zrobione" w tle nie zapisało się — te operacje mogą się powtórzyć przy następnym otwarciu, ale to nie dotyczy Twoich danych.');
  }
  if(DB.settings.scouts.length){ currentScout = DB.settings.scouts[0]; }
  render();
}
// loadAllInner() ma dziesiątki sekwencyjnych kroków (import składów, wzbogacanie danych, migracje) i nie
// każdy pojedynczy krok jest osobno zabezpieczony. Jeśli COKOLWIEK po drodze rzuci nieobsłużony wyjątek,
// finalne render() na końcu loadAllInner() nigdy by się nie wykonało - zostawiając całą aplikację pustą.
// DODATKOWO: jeśli zapis do pamięci ma gorszy moment, każda nieudana operacja to teraz 3 próby z
// opóźnieniem (~1s) - a loadAllInner() wykonuje wiele takich operacji pod rząd (import składów wielu
// klubów). To mogło się kumulować do dziesiątek sekund i sprawiać wrażenie "aplikacja się nie otwiera",
// mimo że docelowo by się doładowała. Dlatego całe ładowanie ma teraz twardy limit czasu: jeśli nie
// skończy się w rozsądnym czasie, renderujemy NATYCHMIAST z tym, co już wczytane - a loadAllInner()
// kończy pracę w tle i wyrenderuje ponownie, gdy skończy (bez ryzyka, że użytkownik zobaczy pustą stronę).
async function loadAll(){
  let settled = false;
  const timeoutGuard = new Promise(resolve=>{
    setTimeout(()=>{
      if(!settled){
        console.error('loadAll() przekroczyło limit czasu (15s) - prawdopodobnie zapis do pamięci ma poważne problemy. Renderuję natychmiast z tym, co już wczytane; ładowanie kontynuuje się w tle.');
        try{ render(); }catch(e){ console.error('Awaryjne render() po przekroczeniu limitu czasu też się nie powiodło:', e); }
      }
      resolve();
    }, 15000);
  });
  const loadPromise = (async ()=>{
    try{
      await loadAllInner();
    }catch(e){
      console.error('loadAll() nie powiodło się w trakcie ładowania — renderuję z tym, co udało się wczytać do tej pory:', e);
      try{ render(); }catch(e2){ console.error('render() też się nie powiodło:', e2); }
    }
    settled = true;
  })();
  await Promise.race([loadPromise, timeoutGuard]);
  // Odświeżanie statystyk celowo POZA wyścigiem z limitem czasu — to praca w tle, która nie może
  // opóźnić pokazania bazy. Błędy tu nie mogą przewrócić startu aplikacji.
  refreshStatsInBackground().catch(e=>console.warn('Odświeżanie statystyk w tle nie powiodło się:', e));
  // Powtarzamy cyklicznie co 6 h, żeby długo otwarta karta też miała świeże liczby — sam start
  // aplikacji nie wystarcza, gdy system chodzi cały dzień bez przeładowania.
  setInterval(()=>{
    refreshStatsInBackground().catch(e=>console.warn('Cykliczne odświeżanie statystyk nie powiodło się:', e));
  }, STATS_INTERVAL_MS);
}
let lastSaveFailure = null; // {key, time} gdy zapis ostatecznie się nie powiódł — pokazywane w trwałym banerze
// Zapis do pamięci (storage.set) może się czasem nie powieść - to udokumentowana cecha tego API,
// nie tylko błąd w naszym kodzie. Dlatego każdy zapis ponawiamy automatycznie do 3 razy z rosnącym
// opóźnieniem; dopiero gdy WSZYSTKIE próby zawiodą, pokazujemy widoczny baner ostrzegawczy zamiast
// cichego console.error — bo to właśnie cisza powodowała wrażenie "danych, które znikają po odświeżeniu".
async function robustStorageSet(key, jsonValue){
  let lastError = null;
  for(let attempt = 1; attempt <= 3; attempt++){
    try{
      const result = await storage.set(key, jsonValue, true);
      if(result){
        if(lastSaveFailure && lastSaveFailure.key === key){
          lastSaveFailure = null;
          try{ renderNav(); }catch(e){ console.error('renderNav after save-success failed (non-fatal):', e); }
        }
        return true;
      }
      lastError = new Error('Zapis zwrócił pusty wynik.');
    }catch(e){
      lastError = e;
    }
    if(attempt < 3) await new Promise(r=>setTimeout(r, 200 * attempt));
  }
  console.error('Zapis "' + key + '" nie powiódł się po 3 próbach:', lastError);
  lastSaveFailure = {key, time: new Date().toLocaleTimeString('pl-PL')};
  try{ renderNav(); }catch(e){ console.error('renderNav after save-failure failed (non-fatal):', e); }
  return false;
}

async function savePlayers(){ return robustStorageSet('scouting:players', JSON.stringify(DB.players)); }
async function saveClubs(){ return robustStorageSet('scouting:clubs', JSON.stringify(DB.clubs)); }
async function saveClubCrests(){
  // Do tabeli herbów wchodzą WYŁĄCZNIE identyfikatory istniejących klubów: kolumna club_id ma
  // klucz obcy do sbs_clubs, więc jeden obcy klucz (np. agencji) wywraca CAŁY wsad i herby
  // przestają się zapisywać, choć z pozoru nic złego nie zrobiłeś. Odsiewamy je przed zapisem.
  const znaneKluby = new Set(DB.clubs.map(c=>c.id));
  const czyste = {};
  Object.keys(DB.clubCrests||{}).forEach(id=>{ if(znaneKluby.has(id)) czyste[id] = DB.clubCrests[id]; });
  return robustStorageSet('scouting:club_crests', JSON.stringify(czyste));
}
async function saveObservations(){ return robustStorageSet('scouting:observations', JSON.stringify(DB.observations)); }
async function saveReports(){ return robustStorageSet('scouting:reports', JSON.stringify(DB.reports)); }
async function saveTalents(){ return robustStorageSet('scouting:talents', JSON.stringify(DB.talents)); }
async function saveContacts(){ return robustStorageSet('scouting:contacts', JSON.stringify(DB.contacts)); }
async function saveMatches(){ return robustStorageSet('scouting:matches', JSON.stringify(DB.matches)); }
// Agencje i menedżerowie idą ścieżką sbs_kv (jeden rekord JSON na kolekcję), tak jak terminarz
// i ustawienia. Świadomie NIE zakładamy nowych tabel: migracja schematu wymaga ręcznego kroku
// w Supabase, a ta, której nie uruchomiono przy sbs_matches, przez długi czas kasowała zapisy.
// Zbiór jest mały (setki rekordów, nie tysiące), więc jeden JSON w zupełności wystarcza.
async function saveAgencies(){ return robustStorageSet('scouting:agencies', JSON.stringify(DB.agencies)); }
async function saveAgents(){ return robustStorageSet('scouting:agents', JSON.stringify(DB.agents)); }
async function saveAgencyLogos(){ return robustStorageSet('scouting:agency_logos', JSON.stringify(DB.agencyLogos)); }

// Zapis JEDNEGO zawodnika zamiast całej kartoteki. Pełny zapis to przy 4050 zawodnikach ponad
// 20 zapytań i ~7 MB — nie do zaakceptowania przy zmianie jednego pola. Używamy go wszędzie tam,
// gdzie zmiana dotyczy dokładnie jednej osoby: historia transferowa, znacznik agenta, szybkie
// statystyki. Zbiorcze operacje (import, scalanie) nadal idą przez savePlayers().
async function savePlayerOne(p){
  if(!p) return false;
  try{
    await storage.saveOne('scouting:players', p);
    if(lastSaveFailure && lastSaveFailure.key === 'scouting:players'){
      lastSaveFailure = null;
      try{ renderNav(); }catch(e){ /* baner to dodatek, nie może wywrócić zapisu */ }
    }
    return true;
  }catch(e){
    console.error('Zapis zawodnika nie powiódł się:', e);
    lastSaveFailure = {key:'scouting:players', time: new Date().toLocaleTimeString('pl-PL')};
    try{ renderNav(); }catch(err){ /* jw. */ }
    return false;
  }
}

// ---- Automatyczne statystyki z 90minut.pl -------------------------------------------------
// Źródłem jest link w polu "mPZPN / 90minut.pl" (p.lnpLink). Pobieranie idzie przez naszą
// funkcję /api/stats, bo 90minut nie wysyła nagłówka CORS i przeglądarka nie odpyta go wprost.
// Transfermarkt jest tu nieprzydatny — dorysowuje statystyki JavaScriptem, w HTML-u ich nie ma.
//
// 90minut publikuje TYLKO mecze i bramki — minuty i asysty zostają wpisywane ręcznie i nigdy
// nie są tu nadpisywane.
const STATS_MAX_AGE_MS = 6 * 60 * 60 * 1000;   // odświeżamy najwyżej raz na 6 h
const STATS_STARTUP_LIMIT = 25;                // ile profili maksymalnie odświeżamy przy jednym przebiegu
const STATS_INTERVAL_MS = 6 * 60 * 60 * 1000;  // powtarzamy cyklicznie, gdy karta zostaje otwarta

// 90minut.pl NIE obsługuje HTTPS — na porcie 443 nic nie nasłuchuje (połączenie jest odrzucane,
// więc nie chodzi o certyfikat ani wersję TLS). Adres z https:// przechodzi walidację w /api/stats
// i dopiero `fetch` pada na timeoucie, przez co wracał stamtąd błąd 504 — nie do odróżnienia od
// awarii serwisu. Sprowadzamy protokół do http:, zanim link gdziekolwiek trafi.
function normalizuj90minut(link){
  const s = String(link || '').trim();
  return s.replace(/^https:\/\/((?:www\.)?90minut\.pl)/i, 'http://$1');
}

function has90minutLink(p){ return !!(p.lnpLink && /90minut\.pl/i.test(p.lnpLink)); }

function statsAreStale(p){
  if(!p.statsUpdatedAt) return true;
  const ts = new Date(p.statsUpdatedAt).getTime();
  if(isNaN(ts)) return true;
  return (Date.now() - ts) > STATS_MAX_AGE_MS;
}

// Zwraca true, jeśli którakolwiek liczba faktycznie się zmieniła (żeby nie zapisywać bez potrzeby).
async function fetchStatsFor(player){
  const res = await fetch('/api/stats?url=' + encodeURIComponent(player.lnpLink));
  // Poza wdrożeniem /api nie istnieje — serwer deweloperski oddaje wtedy HTML aplikacji, a nie JSON.
  const ctype = res.headers.get('content-type') || '';
  if(!ctype.includes('application/json')){
    throw new Error('pobieranie statystyk działa tylko na wdrożonej stronie (lokalnie nie ma /api).');
  }
  if(!res.ok){
    const body = await res.json().catch(()=>({}));
    throw new Error(body.error || ('Serwer odpowiedział kodem ' + res.status));
  }
  const data = await res.json();
  let changed = false;
  if(typeof data.matches === 'number' && data.matches !== player.matches){ player.matches = data.matches; changed = true; }
  if(typeof data.goals === 'number' && data.goals !== player.goals){ player.goals = data.goals; changed = true; }
  player.statsUpdatedAt = new Date().toISOString();
  player.statsSource = data.source || '90minut.pl';
  player.statsSeason = data.season || '';
  return { changed, data };
}

// Odświeżanie w tle po starcie. Świadomie ograniczone: najwyżej raz na dobę na zawodnika i
// najwyżej STATS_STARTUP_LIMIT profili na jedno uruchomienie — przy kilkuset zawodnikach
// odpytywanie wszystkich naraz obciążyłoby źródło i grozi blokadą. Pominięte doczekają
// kolejnego uruchomienia; ile ich zostało, wypisujemy w konsoli (bez cichego ucinania).
async function refreshStatsInBackground(){
  const candidates = DB.players.filter(p=>has90minutLink(p) && statsAreStale(p));
  if(!candidates.length) return;

  const batch = candidates.slice(0, STATS_STARTUP_LIMIT);
  const skipped = candidates.length - batch.length;
  console.info(`Statystyki: odświeżam ${batch.length} z ${candidates.length} profili 90minut.` +
    (skipped ? ` Pozostałe ${skipped} przy następnym uruchomieniu.` : ''));

  let changedAny = false, failed = 0;
  for(const p of batch){
    try{
      const { changed } = await fetchStatsFor(p);
      if(changed) changedAny = true;
    }catch(e){
      failed++;
      console.warn(`Statystyki: nie udało się odświeżyć ${p.lastName} ${p.firstName} —`, e.message);
    }
  }

  if(failed) console.warn(`Statystyki: ${failed} z ${batch.length} profili nie odpowiedziało.`);
  // Zapisujemy raz, po całej partii — nie po każdym zawodniku.
  if(changedAny || batch.length){
    await savePlayers();
    if(changedAny) render();
  }
}
async function saveSettings(){ return robustStorageSet('scouting:settings', JSON.stringify(DB.settings)); }
async function savePositionMapAssignments(){ return robustStorageSet('scouting:position_map_assignments', JSON.stringify(positionMapAssignments)); }

// JAWNE, punktowe usunięcie jednego rekordu z bazy. Zapisy (save*) NIGDY nie kasują — kasujemy tylko
// tutaj, gdy użytkownik świadomie kliknie "usuń". Ponawiamy do 3 razy; przy porażce pokazujemy baner
// (jak przy zapisach) i zwracamy false, żeby wołający mógł cofnąć zmianę w UI zamiast udawać sukces.
async function robustStorageDelete(key, id){
  let lastError = null;
  for(let attempt = 1; attempt <= 3; attempt++){
    try{
      await storage.deleteItem(key, id);
      if(lastSaveFailure && lastSaveFailure.key === key){
        lastSaveFailure = null;
        try{ renderNav(); }catch(e){ console.error('renderNav after delete-success failed (non-fatal):', e); }
      }
      return true;
    }catch(e){ lastError = e; }
    if(attempt < 3) await new Promise(r=>setTimeout(r, 200 * attempt));
  }
  console.error('Usunięcie "' + key + '/' + id + '" nie powiodło się po 3 próbach:', lastError);
  lastSaveFailure = {key, time: new Date().toLocaleTimeString('pl-PL')};
  try{ renderNav(); }catch(e){ console.error('renderNav after delete-failure failed (non-fatal):', e); }
  return false;
}
async function deletePlayerRecord(id){ return robustStorageDelete('scouting:players', id); }
async function deleteClubRecord(id){ return robustStorageDelete('scouting:clubs', id); }
async function deleteObservationRecord(id){ return robustStorageDelete('scouting:observations', id); }
async function deleteReportRecord(id){ return robustStorageDelete('scouting:reports', id); }
async function deleteTalentRecord(id){ return robustStorageDelete('scouting:talents', id); }
// Usunięcie wielu talentów jednym zapytaniem. Kasowanie po jednym przy kilkudziesięciu
// zaznaczonych to kilkadziesiąt osobnych żądań i kilkanaście sekund czekania.
async function deleteTalentRecords(ids){
  if(!ids || !ids.length) return true;
  try{ await storage.deleteItems('scouting:talents', ids); return true; }
  catch(e){ console.error('Zbiorcze usuwanie talentów nie powiodło się:', e); return false; }
}
async function deleteContactRecord(id){ return robustStorageDelete('scouting:contacts', id); }

function clubName(id){ const c = DB.clubs.find(x=>x.id===id); return c? c.name : "—"; }
function clubRegion(id){ const c = DB.clubs.find(x=>x.id===id); return c? c.region : ""; }
function clubLeague(id){ const c = DB.clubs.find(x=>x.id===id); return c? c.league : ""; }
function clubCrest(id){ if(DB.clubCrests[id]) return DB.clubCrests[id]; const c = DB.clubs.find(x=>x.id===id); return c && c.crestUrl ? c.crestUrl : null; }
function clubSeason(id){ const c = DB.clubs.find(x=>x.id===id); return c && c.season ? c.season : ""; }
function crestImg(url, size, name){
  const cls = size==='lg' ? 'crest-lg' : size==='xs' ? 'crest-xs' : 'crest';
  if(url) return `<img src="${esc(url)}" class="${cls}" alt="">`;
  const initials = (name||'').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?';
  const fs = size==='lg' ? 15 : size==='xs' ? 7 : 9;
  return `<svg class="${cls}" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" style="background:var(--card);">
    <path d="M22 3 L38 8 L38 21 C38 30.5 31 37.5 22 40.5 C13 37.5 6 30.5 6 21 L6 8 Z" fill="var(--pitch)" stroke="var(--gold)" stroke-width="1.6"/>
    <text x="22" y="${size==='lg'?27:26}" text-anchor="middle" font-family="'Barlow Condensed',sans-serif" font-weight="700" font-size="${fs*2}" fill="var(--on-pitch)">${esc(initials)}</text>
  </svg>`;
}
function playerObs(playerId){ return DB.observations.filter(o=>o.playerId===playerId).sort((a,b)=> a.date.localeCompare(b.date)); }
// Ocena zawodnika: obserwacje to już TYLKO plan/odbycie wizyty (bez suwaków ocen) — średnią
// ("śr. ocena", skala 1-6) liczymy wyłącznie z WYPEŁNIONYCH RAPORTÓW (fazy gry + stałe fragmenty).
// overall === null, dopóki zawodnik nie ma żadnego raportu z ocenami. Radar (avgs, 5 atrybutów 1-10)
// zostaje zasilany historycznymi ocenami z obserwacji, w których statystykę wypełniono ZANIM
// usunęliśmy to okno — dla nowych zawodników radar po prostu się nie pokaże.
function playerAvg(playerId){
  const obs = playerObs(playerId);
  const reps = DB.reports.filter(r=>r.playerId===playerId);
  let overall = null;
  let ratedReports = 0;
  if(reps.length){
    let sum = 0;
    reps.forEach(r=>{
      const vals = [...Object.values(r.phases||{}), ...Object.values(r.setPieces||{})]
        .map(Number).filter(v=>Number.isFinite(v) && v>0);
      if(vals.length){ sum += vals.reduce((a,b)=>a+b,0)/vals.length; ratedReports++; }
    });
    if(ratedReports) overall = sum/ratedReports;
  }
  // Radar tylko z obserwacji z faktycznie wypełnioną (historycznie) statystyką.
  const rated = obs.filter(o=> o.statsFilledIn && o.ratings && RATING_KEYS.some(k=>Number(o.ratings[k])>0));
  let avgs = null;
  if(rated.length){
    const sums = {}; RATING_KEYS.forEach(k=>sums[k]=0);
    rated.forEach(o=> RATING_KEYS.forEach(k=> sums[k]+= (Number(o.ratings[k])||0) ));
    avgs = {}; RATING_KEYS.forEach(k=> avgs[k]= sums[k]/rated.length );
  }
  // METRYKI Z RAPORTÓW — TO ONE ZASILAJĄ RADAR.
  //
  // Radar żywił się dotąd wyłącznie ocenami z obserwacji, a te zniknęły razem z suwakami w oknie
  // obserwacji (ocenia się w zakładce Raporty). Stąd sprzeczność w profilu: „średnia 4.6 z 1 rap."
  // obok komunikatu „brak ocen". Ocen liczbowych dostarczają dziś raporty: cztery fazy gry i
  // cztery stałe fragmenty, wszystkie w skali 1-6 — i to jest osiem osi radaru.
  const metryki = [];
  if(reps.length){
    const zbierz = (pole, lista)=> lista.forEach(f=>{
      const wartosci = reps.map(r=> Number((r[pole]||{})[f.key])).filter(v=>Number.isFinite(v) && v>0);
      if(wartosci.length) metryki.push({
        key: f.key, label: f.krotko || f.label,
        wartosc: wartosci.reduce((x,y)=>x+y,0)/wartosci.length,
        zIlu: wartosci.length,
      });
    });
    zbierz('phases', REPORT_PHASES);
    zbierz('setPieces', REPORT_SET_PIECES);
  }

  if(!obs.length && overall===null && !avgs && !metryki.length) return null;
  const last = obs.length ? obs[obs.length-1]
    : {date: reps.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(r=>r.date).pop() || ''};
  return {avgs, overall, metryki, count: obs.length, reportCount: ratedReports, last};
}
// "śr. ocena" w listach: kreska, dopóki nie ma żadnego raportu z ocenami.
function fmtAvg(a){ return a && a.overall!=null ? fmt1(a.overall) : "—"; }
// Kartki w listach: żółte/czerwone jako kolorowe znaczniki. Kreska, gdy obu brak — zero pokazujemy
// tylko wtedy, gdy druga wartość jest uzupełniona (żeby "0/1" było czytelne).
function cardsCell(p){
  const y = p.yellowCards, r = p.redCards;
  if(y==null && r==null) return '—';
  const parts = [];
  if(y!=null) parts.push(`<span class="card-chip card-y" title="Żółte kartki">${y}</span>`);
  if(r!=null) parts.push(`<span class="card-chip card-r" title="Czerwone kartki">${r}</span>`);
  return parts.join(' ');
}
function daysSince(dateStr){
  if(!dateStr) return null;
  const d = new Date(dateStr+"T00:00:00");
  const now = new Date();
  return Math.floor((now-d)/(1000*60*60*24));
}

// ---------- RADAR / PORÓWNYWARKA ----------
const RADAR_COLORS = ['var(--pitch)', 'var(--gold)', 'var(--clay)']; // pitch / gold / clay — do 3 zawodników
// Radar (wykres pajęczy) z 5 atrybutów (RATING_KEYS, skala 1-10). entries: [{label, avgs:{k:val}, count}].
function radarSvg(entries){
  const keys = RATING_KEYS, N = keys.length, max = 10;
  const cx = 150, cy = 150, R = 96;
  const ang = i => (-90 + i*(360/N)) * Math.PI/180;
  const pt = (i, r) => [ +(cx + r*Math.cos(ang(i))).toFixed(1), +(cy + r*Math.sin(ang(i))).toFixed(1) ];
  let grid = '';
  for(let ring=2; ring<=10; ring+=2){
    const rr = R*ring/max;
    grid += `<polygon points="${keys.map((_,i)=>pt(i,rr).join(',')).join(' ')}" fill="none" stroke="var(--chalk-dim)" stroke-width="1"/>`;
  }
  let axes = '';
  keys.forEach((k,i)=>{
    const [x,y] = pt(i,R);
    axes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--chalk-dim)" stroke-width="1"/>`;
    const [lx,ly] = pt(i,R+20);
    const anchor = Math.abs(lx-cx)<6 ? 'middle' : (lx>cx ? 'start' : 'end');
    axes += `<text x="${lx}" y="${ly+3}" text-anchor="${anchor}" font-size="11" font-weight="600" fill="var(--ink-soft)">${esc(RATING_LABELS[k]||k)}</text>`;
  });
  let shapes = '';
  entries.forEach((e,idx)=>{
    const color = RADAR_COLORS[idx%3];
    const poly = keys.map((k,i)=>{ const v = e.avgs && e.avgs[k]!=null ? e.avgs[k] : 0; return pt(i, R*v/max).join(','); }).join(' ');
    shapes += `<polygon points="${poly}" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="2"/>`;
    keys.forEach((k,i)=>{ const v = e.avgs && e.avgs[k]!=null ? e.avgs[k] : 0; const [x,y] = pt(i, R*v/max); shapes += `<circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`; });
  });
  return `<svg viewBox="0 0 300 300" style="width:100%;max-width:340px;height:auto;display:block;margin:0 auto;">${grid}${axes}${shapes}</svg>`;
}

let compareIds = ['', '', ''];
function compareDescriptive(entries){
  // Porównanie liczbowe wymaga zawodników z radarem (historyczne oceny obserwacji) — nowy model
  // ocen opiera się na raportach, więc overall może istnieć bez avgs i odwrotnie.
  const withAvg = entries.filter(e=>e.avg && e.avg.avgs);
  if(withAvg.length < 2) return '<div class="empty">Wybierz co najmniej dwóch zawodników z ocenami, aby zobaczyć porównanie opisowe.</div>';
  const lines = [];
  const withOverall = withAvg.filter(e=>e.avg.overall!=null);
  if(withOverall.length){
    const bestOverall = withOverall.slice().sort((a,b)=>b.avg.overall-a.avg.overall)[0];
    lines.push(`<li><strong>Ogólnie najwyżej (śr. z raportów):</strong> ${esc(bestOverall.p.lastName)} ${esc(bestOverall.p.firstName)} — średnia <strong>${fmt1(bestOverall.avg.overall)}</strong>/6.</li>`);
  }
  RATING_KEYS.forEach(k=>{
    const sorted = withAvg.slice().sort((a,b)=> b.avg.avgs[k]-a.avg.avgs[k]);
    const best = sorted[0], diff = best.avg.avgs[k]-sorted[sorted.length-1].avg.avgs[k];
    lines.push(`<li><strong>${esc(RATING_LABELS[k])}:</strong> ${esc(best.p.lastName)} (${fmt1(best.avg.avgs[k])})${diff<0.3?' — porównywalnie':''}.</li>`);
  });
  const small = withAvg.filter(e=>e.avg.count < 3);
  if(small.length) lines.push(`<li style="color:var(--clay-dark);"><strong>Mała próba:</strong> ${small.map(e=>esc(e.p.lastName)+' ('+e.avg.count+' obs.)').join(', ')} — wyniki mniej pewne.</li>`);
  const none = entries.filter(e=>!e.avg);
  if(none.length) lines.push(`<li style="color:var(--ink-soft);">Bez ocen (poza radarem): ${none.map(e=>esc(e.p.lastName)).join(', ')} — dodaj obserwacje.</li>`);
  return `<ul style="margin:0;padding-left:18px;line-height:1.7;font-size:13.5px;">${lines.join('')}</ul>`;
}
function compareTable(entries){
  const withAvg = entries.filter(e=>e.avg && e.avg.avgs);
  if(!withAvg.length) return '';
  const head = `<tr><th>Atrybut</th>${withAvg.map(e=>`<th>${esc(e.p.lastName)}</th>`).join('')}</tr>`;
  const rows = RATING_KEYS.map(k=>{
    const mx = Math.max(...withAvg.map(e=>e.avg.avgs[k]));
    return `<tr><td>${esc(RATING_LABELS[k])}</td>${withAvg.map(e=>`<td style="${e.avg.avgs[k]===mx?'font-weight:800;color:var(--heading);':''}">${fmt1(e.avg.avgs[k])}</td>`).join('')}</tr>`;
  }).join('');
  const overallRow = `<tr style="border-top:2px solid var(--border);"><td><strong>Śr. z raportów</strong></td>${withAvg.map(e=>`<td><strong>${e.avg.overall!=null?fmt1(e.avg.overall):'—'}</strong></td>`).join('')}</tr>`;
  const obsRow = `<tr><td style="color:var(--ink-soft);font-size:11.5px;">Liczba obserwacji</td>${withAvg.map(e=>`<td style="color:var(--ink-soft);font-size:11.5px;">${e.avg.count}</td>`).join('')}</tr>`;
  return `<table style="width:auto;min-width:280px;">${head}${rows}${overallRow}${obsRow}</table>`;
}
// Pasek porównawczy pod liczbą. DŁUGOŚĆ = udział względem najwyższego wyniku (wielkość),
// KOLOR = jakość wyniku na skali chłodny → ciepły. Rozdzielenie tych dwóch rzeczy ma znaczenie
// przy kartkach: pasek pokazuje, ile ich jest, a kolor — że im mniej, tym lepiej.
function statBar(dlugoscProc, jakosc){
  const t = Math.max(0, Math.min(1, jakosc));
  // Chłodny błękit → morska zieleń → ciepłe złoto. Punkt pośredni trzyma środek skali w zieleni
  // zamiast przechodzić przez szarość, którą daje mieszanie błękitu ze złotem wprost.
  const zimny = [62,110,142], sredni = [90,140,110], cieply = [201,155,60];
  const lerp = (a,b,u)=> a.map((c,i)=> Math.round(c + (b[i]-c)*u));
  const rgb = t <= 0.5 ? lerp(zimny, sredni, t/0.5) : lerp(sredni, cieply, (t-0.5)/0.5);
  const kolor = `rgb(${rgb.join(',')})`;
  const w = Math.max(3, Math.round(Math.max(0, Math.min(100, dlugoscProc))));
  return `<div class="stat-bar"><div class="stat-bar-fill" style="width:${w}%;background:${kolor};"></div></div>`;
}

// Porównanie STATYSTYK SEZONU: wartości bezwzględne i udział procentowy względem najlepszego
// w zestawieniu. Dochodzą przeliczenia na mecz (minuty, gole), bo sama suma faworyzuje tego,
// kto rozegrał więcej spotkań — przy ocenie zawodnika liczy się wydajność, nie tylko wolumen.
function compareSeasonStats(entries){
  const POLA = [
    {k:'matches', label:'Mecze',   opis:'rozegrane spotkania'},
    {k:'minutes', label:'Minuty',  opis:'łączny czas gry'},
    {k:'goals',   label:'Gole',    opis:'bramki w sezonie'},
    {k:'assists', label:'Asysty',  opis:'asysty w sezonie'},
    {k:'yellowCards', label:'Żółte kartki', opis:'mniej znaczy lepiej', odwrotne:true},
    {k:'redCards',    label:'Czerwone kartki', opis:'mniej znaczy lepiej', odwrotne:true},
  ];
  const maDane = entries.some(e=> POLA.some(f=> e.p[f.k]!=null));
  if(!maDane){
    return `<div class="card"><h4 style="margin-top:0;color:var(--heading);">Statystyki sezonu</h4>
      <div class="empty">Brak statystyk u wybranych zawodników — uzupełnij je w profilu albo przez „Statystyki drużyny".</div></div>`;
  }

  const wiersz = (f)=>{
    const wartosci = entries.map(e=> e.p[f.k]);
    const konkretne = wartosci.filter(v=>v!=null);
    if(!konkretne.length) return '';
    // Odniesienie: przy kartkach najlepszy jest najmniejszy wynik, przy reszcie największy.
    const najlepszy = f.odwrotne ? Math.min(...konkretne) : Math.max(...konkretne);
    const odniesienie = Math.max(...konkretne) || 1;
    const najmniej = Math.min(...konkretne), rozstep = Math.max(...konkretne) - najmniej;
    return `<tr>
      <td><strong>${esc(f.label)}</strong><div class="note" style="font-size:10.5px;">${esc(f.opis)}</div></td>
      ${wartosci.map(v=>{
        if(v==null) return '<td style="text-align:right;color:var(--ink-soft);">—</td>';
        const proc = Math.round((v / odniesienie) * 100);
        const czyNaj = v === najlepszy && konkretne.length > 1;
        // Jakość: przy kartkach im mniej, tym lepiej — dlatego skalę odwracamy.
        const jakosc = rozstep === 0 ? 1
          : (f.odwrotne ? (Math.max(...konkretne) - v) / rozstep : (v - najmniej) / rozstep);
        return `<td style="text-align:right;${czyNaj?'font-weight:800;color:var(--heading);':''}">
          ${v}<div class="note" style="font-size:10.5px;">${proc}%</div>
          ${statBar(proc, jakosc)}</td>`;
      }).join('')}
    </tr>`;
  };

  // Wydajność na mecz — liczona tylko tam, gdzie znamy liczbę meczów.
  const naMecz = (e, klucz)=>{
    const m = e.p.matches, v = e.p[klucz];
    if(!m || v==null) return null;
    return v / m;
  };
  const wierszNaMecz = (label, klucz, cyfry)=>{
    const wartosci = entries.map(e=> naMecz(e, klucz));
    const konkretne = wartosci.filter(v=>v!=null);
    if(!konkretne.length) return '';
    const max = Math.max(...konkretne) || 1;
    return `<tr>
      <td><strong>${esc(label)}</strong><div class="note" style="font-size:10.5px;">przelicznik na mecz</div></td>
      ${wartosci.map(v=>{
        if(v==null) return '<td style="text-align:right;color:var(--ink-soft);">—</td>';
        const czyNaj = v === Math.max(...konkretne) && konkretne.length > 1;
        const najm = Math.min(...konkretne), rozs = max - najm;
        const proc = Math.round(v/max*100);
        return `<td style="text-align:right;${czyNaj?'font-weight:800;color:var(--heading);':''}">
          ${v.toFixed(cyfry)}<div class="note" style="font-size:10.5px;">${proc}%</div>
          ${statBar(proc, rozs===0 ? 1 : (v-najm)/rozs)}</td>`;
      }).join('')}
    </tr>`;
  };

  return `<div class="card" style="overflow:auto;">
    <h4 style="margin-top:0;color:var(--heading);">Statystyki sezonu</h4>
    <p class="note" style="margin-top:-6px;">Wartość bezwzględna, pod nią udział procentowy względem najwyższego wyniku w zestawieniu. Pogrubienie = najlepszy.</p>
    <table style="width:100%;">
      <tr><th style="text-align:left;">Wskaźnik</th>${entries.map(e=>`<th style="text-align:right;">${esc(e.p.lastName)} ${esc(e.p.firstName)}</th>`).join('')}</tr>
      ${POLA.map(wiersz).join('')}
      ${wierszNaMecz('Minuty / mecz','minutes',0)}
      ${wierszNaMecz('Gole / mecz','goals',2)}
    </table>
  </div>`;
}

// Porównanie RAPORTÓW: średnie z faz gry i stałych fragmentów (skala 1-6) plus zestawienie
// opisów obok siebie, żeby było widać różnice w ocenie tych samych obszarów.
function compareReports(entries){
  const zRaportami = entries.map(e=>({
    e, raporty: DB.reports.filter(r=>r.playerId===e.p.id)
                          .sort((a,b)=>(b.date||'').localeCompare(a.date||''))
  }));
  if(!zRaportami.some(x=>x.raporty.length)){
    return `<div class="card"><h4 style="margin-top:0;color:var(--heading);">Raporty</h4>
      <div class="empty">Żaden z wybranych zawodników nie ma jeszcze raportu.</div></div>`;
  }

  // Średnia ocen ze wszystkich raportów zawodnika, osobno dla faz gry i stałych fragmentów.
  const srednia = (raporty, pole)=>{
    const v = raporty.flatMap(r=> Object.values(r[pole]||{}))
      .map(Number).filter(n=>Number.isFinite(n) && n>0);
    return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null;
  };
  const wierszOcen = (label, pole)=>{
    const wartosci = zRaportami.map(x=> srednia(x.raporty, pole));
    const konkretne = wartosci.filter(v=>v!=null);
    if(!konkretne.length) return '';
    const max = Math.max(...konkretne);
    return `<tr>
      <td><strong>${esc(label)}</strong><div class="note" style="font-size:10.5px;">średnia, skala 1-6</div></td>
      ${wartosci.map(v=> v==null
        ? '<td style="text-align:right;color:var(--ink-soft);">—</td>'
        : `<td style="text-align:right;${v===max&&konkretne.length>1?'font-weight:800;color:var(--heading);':''}">
            ${fmt1(v)}<div class="note" style="font-size:10.5px;">${Math.round(v/6*100)}%</div>
            ${statBar(v/6*100, v/6)}</td>`).join('')}
    </tr>`;
  };

  // Opisy z NAJNOWSZEGO raportu każdego zawodnika, zestawione obszarami obok siebie.
  const OBSZARY = [
    {k:'technika', label:'Technika'},
    {k:'taktyka', label:'Taktyka'},
    {k:'motoryka', label:'Motoryka'},
    {k:'mentalnoscOpis', label:'Mentalność'},
    {k:'potencjalOpis', label:'Potencjał'},
  ];
  const opisy = OBSZARY.map(o=>{
    const teksty = zRaportami.map(x=>{
      const r = x.raporty[0];
      return r && r[o.k] ? String(r[o.k]).trim() : '';
    });
    if(!teksty.some(Boolean)) return '';
    return `<div style="margin-bottom:14px;">
      <div style="font-weight:800;color:var(--heading);font-size:13px;margin-bottom:5px;">${esc(o.label)}</div>
      <div class="grid" style="grid-template-columns:repeat(${entries.length},minmax(0,1fr));gap:10px;">
        ${teksty.map((t,i)=>`<div style="background:var(--card-soft);border:1px solid var(--chalk-dim);border-radius:8px;padding:9px;font-size:12.5px;line-height:1.55;">
          <div class="note" style="font-size:10.5px;margin-bottom:3px;">${esc(entries[i].p.lastName)}</div>
          ${t ? esc(t) : '<span style="color:var(--ink-soft);">— brak opisu —</span>'}
        </div>`).join('')}
      </div>
    </div>`;
  }).filter(Boolean).join('');

  return `<div class="card" style="overflow:auto;">
    <h4 style="margin-top:0;color:var(--heading);">Raporty</h4>
    <p class="note" style="margin-top:-6px;">Oceny uśrednione ze wszystkich raportów zawodnika. Opisy pochodzą z najnowszego raportu każdego z nich.</p>
    <table style="width:100%;margin-bottom:16px;">
      <tr><th style="text-align:left;">Obszar</th>${entries.map(e=>`<th style="text-align:right;">${esc(e.p.lastName)} ${esc(e.p.firstName)}</th>`).join('')}</tr>
      <tr><td>Liczba raportów</td>${zRaportami.map(x=>`<td style="text-align:right;">${x.raporty.length}</td>`).join('')}</tr>
      ${wierszOcen('Fazy gry','phases')}
      ${wierszOcen('Stałe fragmenty','setPieces')}
    </table>
    ${opisy || '<div class="empty">Raporty nie zawierają opisów tekstowych.</div>'}
  </div>`;
}

// Podpis zawodnika w wyszukiwarkach: "Nazwisko Imię — Klub".
function playerLabelFor(id){
  const p = DB.players.find(x=>x.id===id);
  if(!p) return '';
  return `${p.lastName||''} ${p.firstName||''} — ${clubName(p.clubId)}`.trim();
}

function viewCompare(){
  const allPlayers = DB.players.slice().sort((a,b)=>(a.lastName||'').localeCompare(b.lastName||''));
  const firstPlayer = compareIds[0] ? DB.players.find(x=>x.id===compareIds[0]) : null;
  // Lista podpowiada zawodników z rocznika pierwszego wybranego (±1), bo porównanie ma sens
  // w zbliżonym wieku. Ale zawodnicy JUŻ WYBRANI muszą zostać na liście niezależnie od rocznika —
  // inaczej wskazanie ich z listy zawodników (zaznaczeniem) nie miało jak zadziałać: ich pozycji
  // po prostu nie było w rozwijanym wyborze.
  const wybrani = new Set(compareIds.filter(Boolean));
  const players = firstPlayer && firstPlayer.birthYear ?
    allPlayers.filter(p => wybrani.has(p.id)
      || p.birthYear === firstPlayer.birthYear
      || p.birthYear === String(Number(firstPlayer.birthYear) + 1)) :
    allPlayers;
  const opt = (sel)=> `<option value="">— wybierz zawodnika —</option>` + players.map(p=>`<option value="${p.id}" ${sel===p.id?'selected':''}>${esc(p.lastName)} ${esc(p.firstName)} — ${esc(clubName(p.clubId))}</option>`).join('');
  const entries = compareIds.map(id => id ? {p: DB.players.find(x=>x.id===id), avg: playerAvg(id)} : null).filter(e=>e && e.p);
  const radarEntries = entries.filter(e=>e.avg && e.avg.avgs).map(e=>({label:e.p.lastName, avgs:e.avg.avgs, count:e.avg.count}));
  const legend = entries.filter(e=>e.avg && e.avg.avgs).map((e,i)=>`<span style="display:inline-flex;align-items:center;gap:6px;margin:0 12px 6px 0;font-size:13px;"><span style="width:12px;height:12px;border-radius:3px;background:${RADAR_COLORS[i%3]};display:inline-block;"></span>${esc(e.p.lastName)} ${esc(e.p.firstName)}</span>`).join('');
  return `
  <button class="secondary" data-action="compare-back" style="margin-bottom:14px;">&larr; Wróć do zawodników</button>
  <h2 class="view-title">Porównywarka zawodników</h2>
  <p class="view-sub">Wybierz 2–3 zawodników — porównanie graficzne (radar) i opisowe. Skala 1–10 ze średnich obserwacji.</p>
  <div class="card">
    <div class="grid grid-3">
      <div class="field-wrap"><label class="field">Zawodnik 1</label><select id="compare-sel-0">${opt(compareIds[0])}</select></div>
      <div class="field-wrap"><label class="field">Zawodnik 2</label><select id="compare-sel-1">${opt(compareIds[1])}</select></div>
      <div class="field-wrap"><label class="field">Zawodnik 3 (opcjonalnie)</label><select id="compare-sel-2">${opt(compareIds[2])}</select></div>
    </div>
  </div>
  ${entries.length ? `
  <div class="grid grid-2">
    <div class="card">
      <h4 style="margin-top:0;color:var(--heading);">Radar profilu</h4>
      ${radarEntries.length ? radarSvg(radarEntries) + `<div style="text-align:center;margin-top:8px;">${legend}</div>` : '<div class="empty">Zaznaczeni zawodnicy nie mają jeszcze ocen — dodaj obserwacje.</div>'}
    </div>
    <div class="card">
      <h4 style="margin-top:0;color:var(--heading);">Porównanie opisowe</h4>
      ${compareDescriptive(entries)}
    </div>
  </div>
  ${compareSeasonStats(entries)}
  ${compareReports(entries)}
  <div class="card" style="overflow:auto;">
    <h4 style="margin-top:0;color:var(--heading);">Dane liczbowe (radar)</h4>
    ${compareTable(entries) || '<div class="empty">Brak ocen z obserwacji — radar pojawi się, gdy będą.</div>'}
  </div>` : '<div class="card"><div class="empty">Wybierz zawodników powyżej, aby zobaczyć porównanie.</div></div>'}`;
}

// ---------- DOSTĘP: KTO WCHODZI DO SYSTEMU (panel administratora) ----------
//
// Zgłoszenia ze strony publicznej zakładają konto ze stanem „oczekuje". Tutaj administrator je
// otwiera albo odrzuca. Zakładka jest widoczna wyłącznie dla roli 'admin', ale nie na tym opiera
// się bezpieczeństwo: reguły dostępu w bazie oddają zwykłemu użytkownikowi wyłącznie jego własny
// wiersz i nie pozwolą mu zmienić niczyjego statusu, choćby wywołał zapytanie ręcznie.

let kontaLista = null;          // null = jeszcze nie pobrano z bazy
let kontaWczytywanie = false;
let kontaBlad = '';

async function odswiezKonta(){
  kontaWczytywanie = true; kontaBlad = '';
  try{
    kontaLista = await listaKont();
  }catch(e){
    kontaBlad = e.message || String(e);
    kontaLista = kontaLista || [];
  }
  kontaWczytywanie = false;
  if(currentView === 'access') render();
}

const STATUS_ETYKIETY = {oczekuje:'Oczekuje', zatwierdzone:'Ma dostęp', odrzucone:'Bez dostępu'};

function kontoWiersz(k){
  const kiedy = (k.utworzoneAt||'').slice(0,10);
  const jaSam = kontoUzytkownika && kontoUzytkownika.userId === k.userId;
  const przyciski = [];
  if(k.status !== 'zatwierdzone'){
    przyciski.push(`<button class="gold" data-action="konto-decyzja" data-id="${esc(k.userId)}" data-status="zatwierdzone">Przyznaj dostęp</button>`);
  }
  if(k.status !== 'odrzucone' && !jaSam){
    // Własnego konta administrator nie odbiera sobie jednym kliknięciem — to pewna droga do
    // zamknięcia się na zewnątrz systemu bez możliwości powrotu.
    przyciski.push(`<button class="secondary" data-action="konto-decyzja" data-id="${esc(k.userId)}" data-status="odrzucone">${k.status==='zatwierdzone'?'Cofnij dostęp':'Odrzuć'}</button>`);
  }
  if(k.status === 'zatwierdzone' && !jaSam){
    przyciski.push(k.rola === 'admin'
      ? `<button class="secondary" data-action="konto-rola" data-id="${esc(k.userId)}" data-rola="scout">Odbierz prawa administratora</button>`
      : `<button class="secondary" data-action="konto-rola" data-id="${esc(k.userId)}" data-rola="admin">Zrób administratorem</button>`);
  }
  const opis = [k.klub, k.rolaWKlubie].filter(Boolean).map(esc).join(' · ');
  return `<tr>
    <td>
      <strong>${esc(k.imieNazwisko || '—')}</strong>${k.rola==='admin'?' <span class="badge tab-chip">administrator</span>':''}${jaSam?' <span class="badge new">to Ty</span>':''}
      <div class="note" style="margin:2px 0 0;">${esc(k.email)}</div>
    </td>
    <td>${opis || '<span class="note">—</span>'}</td>
    <td>${esc(k.telefon || '—')}</td>
    <td>${esc(kiedy || '—')}</td>
    <td><span class="badge stan-${esc(k.status)}">${STATUS_ETYKIETY[k.status] || esc(k.status)}</span></td>
    <td style="white-space:nowrap;">${przyciski.join(' ')}</td>
  </tr>`;
}

function kontaTabela(lista){
  if(!lista.length) return '';
  return `<div class="tabela-przewijana"><table>
    <thead><tr><th>Osoba</th><th>Klub / rola</th><th>Telefon</th><th>Zgłoszenie</th><th>Stan</th><th></th></tr></thead>
    <tbody>${lista.map(kontoWiersz).join('')}</tbody>
  </table></div>`;
}

function viewAccess(){
  if(!(kontoUzytkownika && kontoUzytkownika.rola === 'admin')){
    return `<h2 class="view-title">Dostęp</h2>
      <div class="card"><div class="empty">Tę zakładkę widzi wyłącznie administrator systemu.</div></div>`;
  }
  if(kontaLista === null){
    if(!kontaWczytywanie) odswiezKonta();     // pierwsze wejście — dociągnij w tle, widok odświeży się sam
    return `<h2 class="view-title">Dostęp</h2><div class="card"><div class="empty">Wczytuję listę kont…</div></div>`;
  }

  const wg = (s)=>kontaLista.filter(k=>k.status===s);
  const oczekujace = wg('oczekuje'), zatwierdzone = wg('zatwierdzone'), odrzucone = wg('odrzucone');

  return `
  <h2 class="view-title">Dostęp do systemu</h2>
  <p class="view-sub">Zgłoszenia ze strony publicznej trafiają tutaj. Nowe konto nie widzi żadnych danych,
    dopóki nie przyznasz mu dostępu — a cofnięcie działa od razu.</p>

  ${kontaBlad ? `<div class="card" style="border-color:var(--clay);"><strong>Nie udało się pobrać listy kont.</strong>
    <div class="note">${esc(kontaBlad)}</div></div>` : ''}

  <div class="toolbar" style="margin-bottom:14px;">
    <button class="secondary" data-action="konta-odswiez">${kontaWczytywanie ? 'Odświeżam…' : '↻ Odśwież listę'}</button>
    <span class="note">Oczekujących: <strong>${oczekujace.length}</strong> · z dostępem: <strong>${zatwierdzone.length}</strong></span>
  </div>

  <div class="card">
    <h4 style="margin-top:0;color:var(--heading);">Czekają na decyzję (${oczekujace.length})</h4>
    ${oczekujace.length ? kontaTabela(oczekujace) : '<div class="empty">Brak nowych zgłoszeń.</div>'}
  </div>

  <div class="card" style="margin-top:18px;">
    <h4 style="margin-top:0;color:var(--heading);">Mają dostęp (${zatwierdzone.length})</h4>
    ${zatwierdzone.length ? kontaTabela(zatwierdzone) : '<div class="empty">Nikt nie ma jeszcze dostępu.</div>'}
  </div>

  ${odrzucone.length ? `<div class="card" style="margin-top:18px;">
    <h4 style="margin-top:0;color:var(--heading);">Bez dostępu (${odrzucone.length})</h4>
    ${kontaTabela(odrzucone)}
  </div>` : ''}`;
}

const NAV_ITEMS = [
  {id:"dashboard", label:"Dashboard"},
  {id:"clubs", label:"Kluby"},
  {id:"players", label:"Zawodnicy"},
  {id:"newobs", label:"Plan Obserwacji"},
  {id:"reports", label:"Raporty"},
  {id:"monitoring", label:"Monitoring"},
  {id:"ranking", label:"Ranking"},
  {id:"talent", label:"Talent"},
  {id:"committee", label:"Scout Transfer"},
  {id:"agencies", label:"Menedżerowie"},
  {id:"contacts", label:"Kontakty"},
  {id:"settings", label:"Ustawienia"},
];
const SAVE_FN_BY_KEY = {
  'scouting:players': ()=>savePlayers(), 'scouting:clubs': ()=>saveClubs(), 'scouting:observations': ()=>saveObservations(),
  'scouting:reports': ()=>saveReports(), 'scouting:talents': ()=>saveTalents(), 'scouting:contacts': ()=>saveContacts(),
  'scouting:settings': ()=>saveSettings(), 'scouting:position_map_assignments': ()=>savePositionMapAssignments(),
  'scouting:agencies': ()=>saveAgencies(), 'scouting:agents': ()=>saveAgents(),
  'scouting:agency_logos': ()=>saveAgencyLogos(),
};
async function retryFailedSave(){
  const key = lastSaveFailure ? lastSaveFailure.key : null;
  const fn = key && SAVE_FN_BY_KEY[key];
  if(fn) await fn(); else lastSaveFailure = null;
  renderNav();
}

function renderNav(){
  const brand = document.querySelector('.brand');
  if(brand){
    brand.innerHTML = `
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAABHvklEQVR42u29Z7hdxZE1vKr33ifdHCQkEEIEgwnGZAMGhAgmGIPTxfZgBpyzecceZ48F44iNI2NmGGfsFwMCAxZRBCEymGAyQiCUc7j5nrC76/2xU3fv3kd6xvP9+/Q8ILj33HP36VC1atWqKsI/8GdoaMhbsGABAMjka77noRWGAkD3mjVrOrdMbuFGXRAAVAFMAfG/q/FPTMV/6/9f1b6u/aT9Uv1P+pZV5H/XDt7a9Uj242EHX3M9a9V6L8dz5l4LANXoe+WK4sHaIM2aNWscwEjg+Rwqqf8yb2hoCAsWLFAA+H+yh/QPbLwCwIII9z355LSrrv7dses2bTh2eGT04EajMafZanWXgqBLSslgEFP0y5g5/q3xr2YGM4Nox4/C8euJyPi0FH+PnD/DAJO2PumDxP9L0c8xA0TJX7nfGf0kFa8Yx89A2m/m7An196T48+vv7XxLZvY8H4rVuCBsq5Wra3v7el/YbZeZj573vnc/OO+IE9er+HPFeyL/Pz0A8+fPF5dccgkAqMD3cd7nP3HaayuWf3jLtm2nNMNWf7PVQtgKoeJTyszJCkafmtnYMs7trvlEpG9v8nXO/yy5DsoOPjRrJ4YcPxMfCzDYccC0nyBKPyPzDlaVANqJe2qvi/AEAEAIAc/3UQ4CVEuVkb7e3jv33WPOn3790ytuJSIFQMyfPx+XXHKJ+l8/AMkJ8z0fp593zhkr1274yvjUxNx6owEVShBYEgkmIopXj9xLq31KarNrRdeas3NAbL1Ofz3n98r4XsGjRRtO+Z9jx4+Qdfv1n3d+yHYn0rU8xs9zZBOYlWICwfM8H5VyCdP6B57ef+99L7v6it9c3QxbmDt3rr9kyZLwf/MAeADk/O99b987Hr735xs3bzq9KUOoVqiIiEEQSA07afeT0gtCiTHQFihZLHbuCBWcCrTZUcdLnO/Itn0pNEOG4Uqft+gkc/HuGntJO3xt7uXazyROC8xKgQlEolapYJeBaXccc9ARF/3kBz94Jd6zHWID2okDIgRInjp09vkr1q+9fGxqokeFMtl4L72RMH1ntHgE/fvuj8/udaQdXRMqNCmUriO3OTSFzkgzL7DeM3EIcF/ZwhWlncJo6ati2ELtLKZ2gAFWUikWvud1VTpG9ttzny/e8qdrf8OAiH+S/ycHgACQIKGOf/fpl65ev+7L42Pj8DxP6htfbLajc5qsJbf3dOmXiEgDivkFNG8gO/1F+h6OnTFvtPUcRNGzFv5+C0AW3m7LL+gHwHG4SXso1sBkYjnbolz9GZmlUsrr6OzA7rvs+uP7/nLrl+O1YCI3+qB2N5+Z1cnnnv3HV15ffp4MQ0lEgsHUBnIb70oWqk7xoOvW7ZS/IsuEs7mIOrjXH8fadKIEsLUDDMUHEE6rUYB62mGRQiBiA8w8XtK/lQLuyBezVEqWyiV/z912v/bRW+95f7PVKrQEnvPTzp3riVWr5IMvPv37V9esOD9sNFskhJ/bfCbzdJJ1AOJvEkizqtx2g/MmjrTvkO2hLZQWYY709qQvi0JHMg6Ly5Tr70cFX+edsKXU/jU7dLwEjq2R8/A4QmbKVo+ISIRh2BqrTx584KFvfsOG5atukEr5rocXDrQvsGRJeNw5Z3xj6YrXLmhM1lvkiSA98ca6sHHyk/9I/pv1TWWX7yJj21nbcKTvwTlMzMlr2I0J2HHT2EEBtPfE7LjGbRy9bmHM/3FeDvPQU87fk8FZaO/BmnvRP6/1vkKIoFlvtFauW3PeSe8668ceiXBoaEi0tQBJqPeuC99/6rJVr/+uUa+HIrn51qcxHtDyk5QaazKjNGp3JYoQYHylyTwiBjeg2w/KLkh00Tn9xURFd5QMi5VHYMi5GsdOtg/oc36ctMNsHQH7tVTwe/TP6TBcJMgLW2FrvDF53FtPnPv0jX++7uWhoSHvxRdf5LwFmD9fLFiwgK+77rr+pSte//3ExAQLEoJz28bmv/Xoiyj3uY27w3YIplsVjjeM8p+bXZidHFie08tL6eNReigMfEARFkitjB41xLaXyLHqKabhwmtNdkhKZjhHoAiHGIeZTetH7bwMWbvu2KH4y57neePj42rZitd+c9VVV01fsGABz58/X+QswND06eKll15Sa5tjP9q0bevJkEoC8IwbTuxySDmalFKKla0j6qB8UzQTLUrC9EVfJmPxss9MhRFAYi3sx+bkEOgUFZNxfExs4LIOGRBNPodhEYhyTqy9ldBjGjJW0+UmHEGac03JwGEgIpJNGXa+uGxp//rXVt48bfp0kVgBod1+9aHPf2K/DZs2fCJsNhUJ8vNHy7XwGTlCOmOr31rOPHh2C+PFYmg3VPf9lO2z4btJc3qkXUkz3GBtzfSwnmDjALY4iwIySOfvNYzAzNFXibX4YOdjnOzeJ2iHc76D7QtnuUS2QYCBfQgE8sNmS24fH/3QRV//0hELFixQiRWILMD0JQIvQlFP7afD46OHgiFBJHSTlfpfonzcrQdHFC+mhlaT20zZBY0vvZkjIFfAq9Pu7RxhfGCoHeXbjpwuiLf120XW7SPSGU/HRljREbsBfEEkpK0tUequcomMNkCBtGSXEKQklFdvNqavWbr8mvum3SfwIljMnz9fYAHk/O/PnzM2Of5eJSUTkWey20gfgrVslo7Os83MPi1xfiHYWAiKrUZCGTvgLHN647KfYw0+aYiEtcvJbHoKjWLNh6rF4RwzW7gB6e/OLJbNK2i8j567KASW7XiP6L1Td8VadpFI24sU9Wr7QhoJR55shbxm/fozLvrWl/fBAsj58+cLD4C3cuVKJfp6Prt5eNvbVChldABczMWOiEM2z3BsDfSTT/rmp1+IbDZpcbxuHDMgRzlAmM8bZtCKiEyn6Lz+XMT+ajcd5jW2fnd6Q8md7iMrB1JMebdbc86sXGw0SX8c3QtaQJoSLwyWDJSUlNuWv7B0yfj4uC+WLFkimZk2bdn0nlajyTHbZz1CPi6mwgSNdtvZXuYCQoWzk+5KD3DyGna9j5XJI0rdUEoHs21N8nGam5xj7XOwI9SKjxzHz549oMk77GQW0DhosC2dG+il3rYofWJkrknIMMS24ZFzmJmefPLJ0AOA1eOb93hl+avfDkPpkXZtSOPPKYe42RF8Uo6iJB2zFMHh5HZbQM6y4ZbJ5h0w2Tuid90WjdIogqz8AVsWyIVBqPCdCdQmlt+RZTVTCq5gRRfVkIU3mHTUwmCiwU3rNl31wOLFwwIAVq9dfyRIBASWNptF6Q2FtjAuH20ShAQNqDrz6NSGZLEdI2mGtHjzyUm5sb5F7qthPCe7uf40gmGg7WfJzHxGn3EOe+StoePIEOXxZAHlTBYHo0XeBrdJINloNIJHnv3bkWkYONWoH66y3JMWQ7Gx8eQymmSlTGGGX64MBHEBAmIb8bNpConyWTgDChoosA2RyyZdy3nTTtqyZRvvoJ7ZTshw5gmYjUCZqR1NaPPGbIWE7Pho3NamJcECm1EUSyUxOTF+cEwZCzTq9X1kGGqATf/VZOdbjPNkpiPzCS3XDrADJnMa5bCD7aNckkxnEIu50gLAh8I0go69izLkucyg81WcJ3eIHacxsVBkH7KMtcoYSy2S4h3lNEzgbdu0qbA5m4ggWDHGxscH2OBD3L7MOBR2rA/rtDn0GkywyJbMg9hJGmrn5+2Qi4riqiJOjtrK0bgQ4LKbeLWihtyakElMOZ+ZWYsoipyYtb6040NgEm+JAWYEvr+7RwJCsfJIUI8b5Jhmjky2NWPXCihsJ6gl8/KTxg8YmT7XdlCB4bMT8Ix8vsFaUt4ZVYTxOjvPwYUHyD6jVJgFJytC0iKK1GWwdWkyN0OGZIDa2j3bpg+PjJBUEgKA19PV3R8recmIW8nlG/MXibktwEdR+l2njclpzClH9BBcaVfWspSkORC27iw7sHXeVLnRfM52OzVK+tpxkVGyohNyhnoaQ0psrb1GeXMeHrvPJRmuNAzDLBuoOEL/hgeK1TyF8ilXPqd9/sqdMWUzl5IRiToOyEBZ/gNS7mabgm7XIrjsMVloH8Xuw9pAdkpZTLBLueSZI59LLrdDMQvIDuTB6QVkh0FqTxaTng5mipIaJpvYLuyA02e7XDGZIZAeGTj2ggwCgXMnO5+hTXA2OwFaHh6wZZnYCr3s216kDHJ7IU4PHln21HZjWfo7hdRsA9tiDJK6S3JYNrbld3BYJKEdANWGRWqXtqBc9FYAQPJ+g4xMofYebKNol3YIWQ4hzaXpN4g0Fo6tSEJ7bk0vYIhvkrSuA0xSEbnThpDSE2icJGiIzCczzgw5gRRpMZJJr2cPz2wdgoJMMuuCENZTkW1FxMVYuZgDMxlDtvyqod+zklw2yLSjKCY4zKkNwsi4+bCjGP35yYqfdSyk5QwMOoq4GOVqKeMsJMh2x8ZAxjuTHWSQmUSzKXMrekwBohFh6XVvSncBVrBBNsnn1tZz27yqQ5WxA6/qivDgoOH13A607FziMYhsOpSyr5PJMrAjHDVieco40agUwtxw3aIQ2fJ0OLUFdq7DvvDEZH4OMtE/iI3nNsA6ZzpNdrGwYEObJ2xMrSdlqDCG4RxVWUzHk6HLK4qZnNR/JhbSQiNO+QTWVpUdKVfSTCK3e1aXnoLNm5WmfxnGhlOubIzM9HSSwYtFMYnbYXIcQJifi40I0FS46OomO0ChOJzUfbEJf7NfkrMAKd7mdiFF3rwbKJdcKCSP4FgjFIndzLAJlKNPTS6BMhXlHJBTKie/PPn9Om1rHzxXfMpMOYjPOfKK83E4maGfvnFWwXKODHJhcV3zau9Xsv6UFreygyS3LEChjWYbAuW1ykbIxbaIMp9LZ10/UlAoSgwQO6puKW8tmC3czK7spKOG0L7NulnVXEpqgUBOiTM5Q5V4E9gKLwnImQCjrJwNIQmsZBJZOTiyMq+sASd2kmvZ/wrz2pDxS6gwxuMCu8AWaWzddAerZ1DEzhQDpRvAmsrHRv0uranJkWU2wFVwwdbNSXMUbWiVNP5m6yDZ0N5giTOdgtEqga3Po1lPXdhiY1lomEZXDrW13+SwANTe1uc2sPgwsJ12Kc4I6SIaghGJ2CbN1BLa/pMLWa8ifTVzpmKDkX9ji0C2qGXSq3c5x8mz/dmsRArDlcHMKxeY9KJUylHo6e9kzjGm7WosbEgn2tLIBcmLnalzJYsQSG5LemssEiYlojQdPzmSPEUUDBUmBxykjtUFhIzmE+TIHmbOmdlkAItIwlx+XrvBRJyv6yNN/ROffkrXio3EknmPyGH1uADAcC5yEwBAothHJFeTd2T9HaeaHaXjZNxacqL+dqlkO4vIO2Dqi7gLXVjLmrkhV7JDY1nIutI22UUWyCUrNk9BpHUoE/PNWizKFrgl/fCSrUMwZfXFRa6OA5CVkbsWmY3EA+fKoZEz7cT5dH0qltBvbcI7Ud4nsnU92YpVUteqx8u8Ey1YGGaRCfQij3zCKdm5hM3jxORq9p3ZCtv0MFmXaRl9hCzq2hDiWcUtLsE8OxgstJOLswXzNCqYKJ9LMpolkYvxLk7quNPppkkiPVfHOtHLVtkfm7E36+5CW/h453SOQLcSrN96Pebm/NftQvDEhZHlRsCEYsjFuUymeWMpb5G0FLDdU8GgrWETBfmMYXFOgwyMI/Q3T2tbbJ0fm6fT0Pu5iAsnC2UCwmQRuEhqlYP0plYoR9eCQPEDsLGZ2WkoLuljx/XKJ2WY8rbI5eOzX8luvYIWCueYQjbNOiysYG6NLlujzPwSrCIV271nrsxPeGEmdlC9bCU0NCaL3dpb0i+JsskPTa9PWjysLUbm61grD+PMh5K+GJShZA3em1UCsHy31m7Oln7krhyZfYVYN9nmGjBpP8MODl67QqkNFAShVRSxdrLtz5q6J7L2xTqKeuqYCjtxEZiVfgDQtlUPw5IW2VQsmzx38qGJCEKI9BdKKaN/lEofIHmNIA++H/1DIEgpLTrTfDBKqx0I5JHRb1DX17MVo9tLIVJ0z04VDeV8Q9bsgtAGHDPHoRyDSEDEzdMUGFKGUTs9VumhFYIghAfPE/A9H0QCzApKKZN+Y2e6qU1UxDkCT4+lfDMatHW/pPXJ04qZdc5Z/y9O6v8IggRaYYixiQmEMkSlVEZvTw+6OrrQ2dGBSqUMJRUajQZaUmJ8YgLbh7djeHQEzECtVkW1EnXMlFIabFwqthQEpRjN8VacXxcZMcL5wJTdzYo0L8AQRIAAPCHgeYToLQnKQJhUqAvS+RxB0aY2Wy2MTU4iDCWqlTL6+/vR09WDwPdRLpXgeR4azSZGx0YxNjGO0bExTE1NwfM9dFRrKJfLUEpBsjJ6ChQKGwtBel7b7eupweKInh29cUgzPRkz4fk+Gs0mJqYmMdjbjxOPOQ4nvOUYHHzAQdh95m7o6+1BtVpD4PkARdKkZquFsfFxbNi0ES+9shRPvfAsHvv7U3juhefRClvo7ekBiCDD0OAClGQEPnDI0TMRlAOAACUlWMWWQFAsfGCwUoZfFkJEZlzFlkMIKMmYnGxiYryJ4e11jI41MVVX8AShVBJm9ZJh1vMq5sDzMT45ganJSewxezbOOe3tOPrQw7H/G/bFrJm7or+vD6WgBCKC53kIwxATExPYPjqCNevX4fmXX8ITzz6Nh//2OFatWY1KpYKOzhpkKFPrmSe+2KSxyex2krkPocEB5tJbzjr5pRVrV+8VCE8xQ9jOnXMcu2WPY5MsPA/btm/HnFmz8bEPXoB3n3EWZu82y3mwlOK0dtD1p9Fo4uEnHsNV11+LW+9dBNkK0dFRg1QyfbywJdHXW8FHP3koSoFAGCqwjN5XeJQVT6ZEFDvKZqC5DoIMFcKWQjMMMTHZworXx/D8c5uxYcMEgiCyCkovGAUZ8asnBKRUGB0bxaFvOhgfft95OOPkt2HGtOluw5OQPsK9Dpu2bMGdi+/G7667Go8//RS6Ojvg+x6kUmbTLJe7d7fakxDkVYLS4hWPPntSdADOPPmlFetW7xV4vmKwyE5R5MeMto6cr84RFPnsialJfOy8C/CVT1+E6YPT4luqIl8XLzBB7+jFGTfOOsJneMJLF+W+hx/EV797MV5a/ip6u7oQhq3YIigMDHbgvA8eAJbSyI2nFcdawaSSSnMd8e8X0fMoqYk/mOAFgO8JeJ5AsyXx3DOb8cD9qzFVlyiVvSxs0yyv53lotVqQUuELH/80LvrYp1CLGz8nIszkoKVbIkSKX6Cl41lFuMDzogr+ZrOJK6/6HS795c/RkC1Uy2VIGcKqO3Lk4y1Ex/EBKEUHIGMDyIrBLSFZwjKxFfwTAMUKoZK4/Ns/xI+/9R1MH5yGMAwhpUpNnCdiIETkIGAiICeEiPrhelFxspQKYRjixGOPw6JrbsQ7TjkN24aHIYSXSqekVFAtGftbgvCiv2PJW7rBBI7MvohArBCIXh9bCc/LUs7CB5QCmk2FyakmwqbEoYdMwz+dtz8GBytoNCWESGhhioGsh0ajgXK5hD9f8Wt87fNfQK1SRRiGUEpFa+B5qetJD4JWkJFgJ08I+L4HT3hQSqHVChH4AT730U9g4VXXYNfpMzA5NQXP87PNZ3KJ77J8hQsnGMkgLkgHW5DTULLHDz05NYX/+sFPccG5H0Cr1YKSCr7nQwja+Wa0DspXaP6xu6sLv/3x5Tjx6LdiZHQ0+vCsEDZbkErl2L2Ul4hvulJa9kxlmjrmCEukfQCEDiI5roskTEyF6Omp4Nxz34hpu3Si2VKRC0ssiIoinN/95AqccsKJaLZakSXzvGLhzI6KOuJIyvcjK9BqtXDomw7Gtf/1W/T19qHeaEBkfTw0zEaaIJeM3gWcpJvhEIQ4ciZa6po1RxB9UwiBbcPbcdFHPon3nPkONFst+L4PEmQuoo22uaiGzM0ker6HUEqUSiX86rJfYPdZs9AMmxAQ8e2L4jLW6EgdJ7HFAyQhJGvMCyvEoDHjJpSKv04MzyM0Q4mungBvO3V3I8EliDAyOoJvXPSvOOm4E9BqtRD4fpvDTyYxusMSrwjQBn6AZquFN+7zBlz2zX9HfaqeCVgL83/twkNNFcwuNU0CkJhzElAhBCanJnHwAQfhK5/5P5BKwfc8R9pVa9+qOO49ZdLYSimEUkJJVXhTPCHQarYwY/p0fOFjn8HY+HjcPt2D53spuRTdemVx7InPjzZUJRSwYrCMCSuDrOToADGDRNaaxfcJExMtzJzegf3f2IdmU8L3PEzUp3DEoYfhsx/6GKSUqd8uAn1ShlBSGeAzslIRV6IUO4EigxF4PlqtEOecfibecdoZGB0fi7kWPX2RXT52tLbWAz/hunwpMjViXjLkRUSEer2BT1/wEdSq1YiwcHWwjL8kpYTwBHzfhxACSjFaYQiiyOcHvg/P92KGj3OSayKKLEEYYuiss7HfnL0xWZ+KQJSd6Lf68ZXKHjpqAaqV6J9aJUC16qNaDVCrBejsKqOjq4xS2YsOioxNuyBDhSFDTl3l4UfORLlWAglCo1HHR99/PkqlUuE6JIkkQdEaJHhAqogYS7BP9D0RuTU4WtPG5ldKiU+e/yH4np8j0okprcyGg9vRd953JXTIiSzZ8EuNZhO777obzpx3avTBhLteP3m953l47KkncMeSe/DC0pexadMmKDA6uzoxvW8QB+67H045YR4OPejgGDVHtyt5DsXRjfF9H+VSGTNnzsSrq1ZCCIrZMorj/yykYgL8QGD9+gkse2UYvk8pfcxazOz7HqoVH9OnVTB9egek4ggse9GaSJnRySSiMHDa9A709Zaxbu0wZgxOx2lzT44jAVF09SGEQBiGWLjodix5/BG8umI5RkZG4AU+auUq9tp9No485DCcfNxczNp1tzhcjg5HYi2klJGbJUKtUkVHrYZWGEbrzxpdx9o+OhO4pB0AoV8gBwiwdH+CBKbqUzjk2OMxODAAKVXODCVmjRlotpr4yne+hauuvxaSVYTYQdHtJUaz1cJ1C2/Ej6/8D5x8/ImY/y9fwb577xN9eBKRTy0FgAfccd89+PbPL8Oy5a+iVq1BSml0IzM+nwI8AtauHcfi+1ajUhWRued8NAMApZKPN+w3gLedugfKZQ+tZmSOSZckESEMgbIH9HUHeHXZFE454QRMnzYtvv3CafaFEHht5Qp86utfxMOPPQrhefADP5OeK4UHH38UV91wLQZ7+/ChD3wQX/70RSiXyqlVlKGEH/hoNBv4j9//Gpf/9r/RbDZTy+nUZ1o6Qvua+u5bm9eJMsxEiJQKb9r/gBhAKUB4Dl8XndYf/fJn+MVvrsTsWbPSn9WBWa1aS/MFC+++A4899QSuvuLXOOqQwyGlRFAKsGb9Onz3Fz/Gn2+6Ib6xFTQbYbyhDIgsj84cbb6S0fNWqgFqnQEqJYoQv+2iNAjw3HOb0Gq08M53vgF6qjxZQBUfaiEIPb1VKEE4YL83xm5Oxag/v6aTk5P48Bc+iyeeexrTBgag4sglIaiElsOYajbx/f/4KZ5+/ln8/qf/iVq1mrrO+x99CPN//AM8+tQT6O3ugedH0ZCRAiWHTJ2hzUYSFghEXpNu+C5b5Bn/OyF7nCX8zPA9H/V6HTfffQemT58OxdFtjxI9CkoxpFIIQwkZRsCov6cP20eH8dEvfg4TExMgIvznH36DUz/wLvzphmvR1dGJWqUas3pa6xoiI42aiiopIqNkK6KIlSFNY0jJkBz9o5jR2eHjlVe2YeXKEZRKHvT6h+TQCg8QPsMvCaiWxGBfv6FWJk3RIpUCCcLTLzyHZ154DoO9/Wg1WwiljDgMFRFlUkmEUqIVhvCEwIxpu+CWexbh3374Xfi+j3Ub1uPz3/wy3v3xC/DMi89jWv9AzEWwUd6Goi47KUCgtH1kZgEUDNXpjjrmJ6egXCq1j+sFMFWvY2JiEsSIka8+Z0nlUp+tsIXOWifWbFiPL39vPtatW4/b7r0L/f196O/pRSilMZwmInmEGV5SzGDGKTslVcz5uwZG6HRwLPLwBEbHWzFYDREnNOPhTVF4GLYUJkYbkK0Wgtj65fQvWhp1ZGw0A4cCDrCaZVA5Zv4G+wdw06JbMTgwgAULb8Krry9Hf18fUKKIWaR8fsbgaYvGtJBdGSSQ00ZbzU2Mr1AMTqbqU8WxawzOerq7se+cvTExNYVSfGDYlg9ZErYwDNFRreHPN92AxY8+hBm7TI9oVhmaLdM13QLb1UrxjWbFKftnsqNstWij9CAwM5RMaGI2lL6JYVGSMT4Zwi8HEa3oCrYowksAcMAb9kO1VEaj0YTn+U6xNdv9gTgif354xc+xYcsmDA4OpOEiERUUqlLxBCMqqgtI2CRDSsC5PTLMi0fYvG1rgdzJBD/f/so3MNg3gE2bN8MTAoEfZNWxRj+AjKWSSqKzowPdXV0I4xvsVsllZpcon5NPBZn6bdE1/64Gzgx0dwURtiGRVSDHjKIQQL0psW17E6Wyj7GJ8UJij0SE3OfsPhsX/+vXMDIygsmJSQR+EIWC0MvLdBFL5tp6e3oRBAFCKTPVlqaltNPTbEnp2/0RuYNh59wtmX0SX5aCAM++9GKcWiVnoiPhst+0/wG49aprceZJp6LRbGLr9m0Reo1j30QsQaxZGYqyalHCwwJs5GqplhdoZvP2CMKPchEi5dwJnkdZDkEAni8wOdnCrFld2GvvPjQaKimfjt7Hozha8LBq1QSGt9fhEeHlZa+4xPDZz8Wf5ePnX4hrr/wd9tlzL2wfGcHI6CjCMITv+TGZ5U7jSBkaMxjJpu+L1NnsaKJh1RP60QuV0YHKyCg6CieVkqhVa/jb009izbp12G3mTFP/RiaXLaXE/vvui+v++/d4/OmncP3Cm3Dvw/fj9bWr0ag3UKtUUCmXI06dOX4edjBK7NBGs0UCZaNjOFn8kDE53gKqXsSyOTp4Jlq7WbN7cPoZe2piUjKUQcIj1KcUnnhiIzyfUKlW8MyLz2NyagrVSsWcgqrpNkSscjr7tDNw+ryTccfie/DXRbfjgccfwbqNG6K4vlpFuRQA8WtV2rRDG06pwXyroalDHVQgEdf2yE+xWI6+0drA59SpQOAH2Lh5E25edCs+c+HHIEOZZvFyZkaIKF4HcNShh+GoQw/D+MQE/vbM07hz8T1Y/ND9eG3VCtSbDVTLZVQqFXgUsWRmiVZmJHUcYTSOEFqjRhmh8MGBKg558yBKJZGFi3GqGgCE76Gzs4RpgxXM2aMXQUBotUIIL/r8wotIJiWBru4Ai25fgXVrRlHrLMH3yli2/DXc/+jDOH3eycVUcIwHwjDKaZx92hk4+7QzsGHTJtz/2MO487578NhTT2LN+rVQrFCrVlEKSnEkIY0iEKPUn3PN5SypCiw1Nhs1Cnk9ALNw2iErpgQRQhliWv8A7r7mJuwybTqUVBCeSNOc7BSCRNZGzxtMTU3hyeeewe2L78HdS+7FqyuXoxVKdNZqCIIg1hAaddogEMJQobevgvPPPwgeJcoeMoCVkgpBSSAoeVFix48204h8YjfAijE5EYKhtDbrUe7A8yIX8sSTG7FkyWp4IkvSjI2N4+jDjsCtf7wulpWJ9hnAOP+RaAiSP1u2bcWDjz+GW+++Ew8/+TjWbFgHAUKtVoUgEWsI3YQOG5EE8t3Ls7WTJIRXKZUXv/7I30/KFEFrtANA9jHTTpV2KDzhYfvwdrz9pLfhmit/F21uDPx2mP1lTlk2z9cOQ30KD//tcVy38CYsWnIvtmzfiq7OLgS+jzAWQCQeIQwVensr+OAHD4BnDCPQmjcnxRyCjHo63YaSZxWlKKTkkhDRQdi6tY7771+D5a8Po1YLIEOVKox8z8f24e245F+/jn/5+KfRarWiA05UeADMdVBxTiRbt81bt2DRksW45qYb8OhTT6AZNtHT1Q0GR2GtzfSx1fHcEfXFjytZwKsGpcWvp4IQR7lHUmJcNOou4sgl+np6cdviu/Cv//5vaUIjUb+0AyhRfkCkPLeUEmEYolqp4uTj5+LKH/4Ui69fiC9+/LOoBGUMj47C933Hu7Grx0r2aUSW5iUt/BMiMu0U75OdyqB441kxyCNs2lLHxGQLvgDq9dC44VIpdHd147u/uAzX/fUvsdXi9Ja3q85K8iRJTiMMQ4RhiGkDgzjv3UNYeNU1WPiHa/DO096O0dFx1OsNBIGfDd+gfFcytgs37DK9SB4TXeKLL77Y+/XVV312eHS0TwiRXg2987RrvFtmURgdtRoefOwRvLzsFcw95jh0dnRAxQsgYqVuG9WpIQ9njlLGzIz+3j6ceOxxOOvU07Bx82Y8/cLzqJRKKZKXilEu+zj44EF4HmkVPiYnEIk8dING8VTu6HfK0Gz2kKmJKObpgVm7deCgA6dhz7170ZKM9evG4uhBZBspPPx10e2oVio45vAjU+xDO+qmAnMNEplYcoB23203vOuMs3DIgQfhqeeexZoN69FRq6XfN2omDDKP0voFq8pO+J5YMbxm4x+E80a162mq9QtO3EwYSvT19uHmRbfh1Pe/Ezfdfkukb/d9QGSIdmf+iHghRSyuDMMQe8/ZE3/4+RX47pe+gYnJSS2nnRRskhkFaL4wmxKauIXY3wOQCmg1Fbw4PU0alUux60g0A1OTIUIpsetuHTj7rL1w8kmzI7VRnFxSrCAEoVKu4Bs/+DY+8KkP4+Vlr0Qcvhf5b6VU+nrs6E4khyGOCKSUOP2kU3DH1dfjjBNPxvbh4Wh9yeLGtMkytBOtZIVOBTPcbUZcRV52K5lQSvT09GDl2tW48AufxrmfvBB3378YrFSU4xYi4uTtgo82KqlEFJkswOc+8nH84tuXot5sRPr9eKES6bfePAlapwxigBUZKe2OzhKe/NtGXHvtUjA48r/JbWFTrUNxKZUQQKMuMTnRxFFv2RXvOGefWDWkjCqg3p5e3HbvXTjtn96Nr373Yix9dRk8EWsCPRGLPtTOSeUIqVay1Qox2N+Pq6/4Nc457UxsHxmGJ7y0VtIeZsJFPZAT+jxxAb/6v3/47MhY5gKoTbsYe6ainn9QihEEJVQqFbz0yitYcMvNWPzQEkxMTGKXadPQ29ubiiJVWvWSqIULficnPpzQCkMc9qaDMTY+jnsfuh/Vag2VauQC7E6aZI0cS/IGSgHlso+Nm+u4c9EKbFw/Cs8TOOCAaajXpdZ/l/SyRHsqHZpNidl7dKHZUHh9xUgUZSTKHWZUq1WEMsSDTzyK6xbehKefewaB72Pm9BmoVqvpOiSZUbETtF2Um4gyjm87YR5uuftObN66BaWglC8fc1hzyvrYisD3Vwyv2fAHYubSUWee9NLKdWv28j1PgSEiNJll28g1XMExJFvvBu7FCZKJyUk0Gg3MnLkLjj/yGLz95NPw1iOPxsxddslAVMwR7Ch64JjEGZ+YwNx3nYlV69dhlxm9+MD73wDPI22/TfImrSGMV0aGjGuuW4otWyYR+IRmqDD03jdizz16UG+00ixb+l6sF1xq50oAssn487WvYNu2yewZEkdLBOFFIpDxiQkQgH323BunHD8Xp809GUcechi6OjuNHEhyMIpxQiyW8X0sWnIvPvDZj6FWrqRcgZHDhpNLkyzIq5TKi1c88veTchaA9VybNcXFSDbr9ZJkAwRKkyqlUoCOjhrq9Saefel53LzoNlz/1xvx+NNPotlsYtrAILo6uyIAqDit6nHO2I3j52q1ipYMcdt992KwrwsHHTiQyhFIb+rAbNDEigmVmo97712FpS9vRbkS/ZAKGatWDuPAA6ehVPKi+gFBOUYvrUeMlUEyZFRrHhgCy5ZtRxBQrnGTij9PtVJBuVzB1uHtePjJx3HDbX/FjbctxNLXliHwfcyYPh3lmA2VUsYWgQpwUoRZ9pmzJx54/BG89vpyVMrltHDXbUzSYlcGkfBFZAFEkRc2dCVsFn26xK1G61cy9YVSSggh0NPVg96uboxMjOHmRbfjE1/9F8x739n4xJcuwl1LFkN4kchTsXK2YSVNaXTmSaeit6cXzVYrQutsNBDIHVqlgErZw4svbsPTf9+EWi2IIxVGEBCGh5u4+94V8P0IC5BIKpQ5jXbsHu0RQAP22rMLlbKIikus7rKJUVRSQSmJcilAf28vatUa1mxYj1/9+Y8499Mfxknnno1vXfrdFDiSoFxBq1nfEWUE33bcPExN1WPryVn5mms6idF4UDkEITaBzVqRNTlQpS2mhdUpifRZfnGsLyNQ2NvTjZ7ubmzbth3/98br8e4PfxDnXPB+LH1tGTzPS1kvk5xO0quEPWbtjj1m7IqpqanM32uNKBKfSJRgE4Htw3Xcc/eKKGTUDrhioFr18fxzm/HMs5vR0VmCDLMGyorN0bF6S3ilGJ1dAfr7qwg1VXPanCLX04ERhhEILJWjw9BRqeK1Fa/jR1dejpOGzsY3L/0O6o1GqqQuCpsB4IhDDkFHrZaWirkaTOs+wO4xJNqFInrLdsdsKKMLR8oUpLeP8sM0kIVjiRJICIG+3l709vVi8WMP4ewLP4CXXlkaAzaVI6hAUcjlez72mbNXrKgtSKNBqw8EcPfdqzA+3kw5A7tRU6nsYfF9q7BhwwRKJT9mBAFXIJ1YOqUYHgl0dgVRJZTOkwjKLGdB/0UpowqqcqmMaQODIEH40ZWX44LPfxL1RqNwCG1yAPaYNRsDAwMG+UauCMBqmeIoDDG5AHZQP2zP3HGYGc/z0AplhkVItz52iXksdoxLnwf7BrBy9Wr86Iqf56aXmM2Xom/09fRGkqpYaQSONoRVJpNSklHrCPC3v23AsmXbUKlkYZPNgnqewNRkE3fesTxq2KSi70QHjI1+R2ktX3xIqtUgpeaStHOrFQFKoyci29qKCGgr5ojqJmDm4HTceMctuHPxPUYizXWGOmsdqCWkENlNux19i61mWMLIoDmPgZsMMn4Zx00QhMD20VH0dvWAhIjic4beQT/TvXBWVZxghkajga6uTrz02rJU7WojE/0AiJhbAGdsn96kghkoVzysWjWGhx5ai0rFzzKfjhZ0rBjlio8VK0fxwP0rUasF2gI6ethqY+8jZW6UH2m0mpiqN9Df2w+pIqIp1wndECSz8TsUM8rlMv7+4rM5GtcZKUtTIcSFBaJFRFBBroLgauGZAYrkNPtBgHqjgeGREXzw3UO4d8Ffcc6pZ2LDxo0ol0rGYOW0IbUh5ER6GJRUqNVq8DyvkDVLnq8RNiPRB1mDHpJBjyA0WxJ3LlqBUKm0Pp7ZEd1ofX2qFQ+PP74Br68cRaXipxqCpM9AKjaNQaRiRn2yAQHC2NgYdp0xE7/5yeW4/Y8LUCtVMTk5Bd/3nVm8fKgbLUgYSnR3djnFXfr/NVtN1OtZiZgTmLehHoWhB9AaK5mj08zhCZkmI+oJMDw6gl13mYHf/eSX+K8f/AS7zZyJ73/t3/CuM96BdRs3RHp2P4grhCPLQJq5TBRAfhBgZHwMZ8w9OWIAlSzUFwDAmrVro4WNhZpp76L40wc+YfG9q7Fh/TjKgafF9pmyyRp+Fru2qFr5zjtfx9SUQhB4UKFjEdNCFEYrJEw16jjx2ONw77U3452nnYk5s2fjv3/0MwR+gK3btsH3PARBJAVLmDgicyxGEPhohiFq5QpOO/HkQn4ksYLbhrdjsl6PGEHNv7vbblHu7gsgP6whFYFawA1aM2Lheag36ti+fTvOf8/7cO+Cv+K97zgnLguX6O7uxtW//BUu/sJX0dnZha3bt2N0fBytuGpWb1YiWWF8Yhzr16/HBUMfwGc/8vGU8QLyKFoIgZHREby6fDmq1UpE46pEBhaVdlerPpa+sg1PPbUR1YoHaVsTTX7GjsUNAoEtWyZx1z0rIo4iSaemsre4PsAj1BshRsdaCFULbz/1dAz09aPeaCCUEicfPxd3Xv0XnHbiKWiEIbYND2NiYhKtsBXpE+I6S45d4OYtW9BsNvGzb/8AB+z7xkhjkRwAS2/JYCxbvhzjUxPRWrGjI4A1TNomXH0rg2qCPTYngiciAyEiMcjee+yJr3/ui3jn6Wem5VzJpiUb+LXP/QsuGHo/br7zNix55CG8/NoyjIyNot5sQkkJQQID/QN40zH74z1nvANDZ73TWdCYhIIRscJ45oXnsHr9WsyZM93KrQNBycfISBN3L16NwCej03fWzi1r7pCIQfQ1kpJRrfp49pkN2G1mDYcdNgNTUy0IL2omkUQRnhBYv24SW7dOoquzin332js6QHEhRxiGOPjAA3HDr/+AR596Ercsuh2PPvk41m7aiIn6FBr1BkgQqpUqdp0+A0ccfAg++k//jCMOOTSiykWB0D+mzx949GE0m01QR6dLGA577nWmE7G7hJErfmBHkymGEB7GhkfxthPm4Z2nn4lms5Xm9vVETjKebNcZM/GpCz6CT13wEYyOjWHLtq2YnJqCUgpBEGBa/wAGBwayk8326DazVpGIcMviuyKuQGXFLiSjOr5yGbj7nlUYHW6gWkl0gBogij+WiAUf0hZYaNRzueTjgQfWYPbsHgwMVtBqyuxIxk0mXn1tFJP1BvbbazYOO+hgQxzr+37c5Ipw9GGH4+jDDgcrxpbt2zAyOoLJ+hRYMTo7OrDrjJmoVipxIapMRa1wJOg8ITAxOYm7H1qCWqWaytvY6m1IbEZvZM2C9/NvTo7cb9zyLJEzSYnu7h5cu/BGfPyDF2L3XXeLVS1Wla6mDE607N1dXeju6sp9rjCMFjZSCQtLnMKaVRFYs24dbrzjNnR3d6EVthC2wshPs0Kt6uHxxzbg5Ze3olr1o/IwbfMjMglo1EO84Y3TsOecbtx+66vo6CylZdl6M0rPJ0zVQ9y7eDXe97794zKs6L18X2D7tim88sIWNOoTOOW4E9FR60AoZYT8idKi0IQRTZpGTBsYwLT40JvrEFVMC8+D3bMhsV6tUCIIAly78EYsW7Ecfd3daegNrbci0l6GZHRW1/dYuOPLfON+2w+XggAbNm7At39yqdEDX48QTM2dSLNZUpk9A5ONTdwHF4yVUTH9+e8/uRQbN25AECR0bvSScsXDhg0TePChtSgHUZ89p3iOovZyBx4wgCMOn4G+/ipaLenIeSQUso/XXtuOhx9ajXLgp3WS1aqPp/6+FdtHprD7zJn4zAUfjZtYZYhSn8MYtX/x0nrKdA2MdfBS3iGnLgZBxlZz05bN+OHlP0O1VI5YQIt+z/oa62BeD0OEozKooAE0Gb3rs5Pa29OLa2+5Cb/8/a9SU5eYIjuho/cDEtqBsPsGFekHWzLqk/OHBX/GtbfciN7uboStEF7gxf0BIwt1112rELZU6oJIT4TEef0wVJg+oxOzd++EHxAOOWQXtJpZLG0XnURxucADD6zGylUjKJc9dHSU8OxzW/DMc5tR6yhBMWPNunWxxSvQPFBeARX9Q851sN8jlGF6iS6a/zWs27QBpVI5slyWSDANs8nRNp4RCV9R0CCibRSpTT5THJV+fePS7+DH/3l5JPzwo/At8c//0J9YdyiEQCkIcNV11+BL35mPrs6uiPFjhohFFkHg4aGH12Pt2nGUywKK9YoZSoc+kSA0mxJv3K8fXZ0ljI81sf/+/ZELSP2oVeSh9e+9+57XQULg5aXbcPutr4FiDn58YhxDn7gQdy25F0EQxMUg0mhFXxTLu2xwyoTGnUySSutms4WPfOFzuPXuRejr7TXa5mGnZDZmfkLofxkKfH02mzVtyOixrCIN+7cu+z4+9qXPY826tVoXkFgBpDh/I1xJpaQuL/45EgTf9zE2Po5/++F38flvfQWB72cNDxkImy34AWHpy1vwyENrUKmIrKbfQhF6m7pyyTPKxIKSn5vgS2RO5whKHrZsq+Pqq1/A7bcvj0PSCJuUSiU0Wk2cf9En8f3Lf4KJyYlsHeLq3+TQ5vokOSyeVBKSo4uUdFZ5adlSvPtj5+O6hTeip6sbrZj/Z9tx5s6uNfaesz33ix/C+psMvaU2MyfyVQMD/bhu4U1Y8vCD+Of3vh/nvedc7Dl7jrsuINbamXN2KEd4jI6P4cbbb8Evf/8rvPzqq+jp7k5/NnExpXKAyckIpAnPboVkj7fLsIkfxH15fQFPEJSUyA2VYnNielQSJ7B2zRg8X8DzRUo8KaVQCgIwAd/52Y/w1ztvwyf/+cM465TTMdDfn9vgqABVGZStSIgyi5p/dcVy/PaaP+GP11+L8anJXPLHpn31ETxkzRDMPqLKCkOOOvPkl1auW72XLzzFrgyhUw5s1esQIISHVrOJ8ckJ7DI4DUcfcjiOO/pYHPHmQzFn99no6+6FHxSeOTSaDazbuBHPv/wi7nvkISx++AG8+vpylMulqOdevEmJeQ5DiYHpHejtruCVpZHAIz1Y7J6gIwRharKF44/bHYceNgNTUyGaLYm/3LAUjWbSasVlmbVGCzFv4GjonqqDJ+tTqNfrmLPb7jjx2OPw1iOPxsEHHoRZM3dFT2d3MSfMjOHREaxYsxp/+/tTWPzwg3jkycexeesWdHd2xQypcgg+2aDWyW6ZnwHTuFNosHjFY89FhSFHnHHSS6vXr4kPAAtnNkljluyO1ZkUmdPefs1mCxOTE5BSoqOzE9P6BzDQ14/pA4Po7+9HuVROS7gnpyaxbds2bNq6BRu3bMa24e0IwxC1ag2VcjmtF3SeRgakYviePpYt6e/nUttmYFj4IkXqSrE5whbYCeLe3VkNWnVQo9nAZH0KggjdXd0Y7BvA9IFBDA4OoqerG34sAQuVwsjIMDZv3YpN27Zgw6ZNGBsfg+f76KhUtQoplYZ6RrGUNpzTFIjmXK9xAHwDCboQn205OP8yo/KMkeb5e3p6ok7bSmHLtq1Yv2ljCoyUVsgpRNwd0/Pg+wG6OjvjDt1RB1IzcWONGSXA94Vx8xMtG1mDXvW+xwxEoZ+m9CTXSdF5DSuFm0pHNXPLpHUXZ0YQBOgrl2N2UWHdxg1YtXZNKorV9ZAUr0Hg+/D9AAP9/amrCKU0EYo1cDPdfNvcFxSRpUSV08Q7GzdoGho7nWmMU8kICClVuki+7yMIgkwBTCazxRqmSCXTbPpfY96flZ8H2cks0uoIkUm+9cnZomieT+GNyMbFWeurp8YZepOsTNgCisrqy6VSKjh1AcC0KVTc/9i+hMa4ebSZEKiDNmvCFrOLCUxapCCb6EWweHTH4hhCj/RmkDkiKl5hBQV79Lx+w+3ZPORsUJGwk/bhgzGVkx0tUfQ+hymAY1ftExvduG334BysQZkVtLutZSA61u0p5IUaZGkEWGMk9J5Izspt63S7plnkhm46mkS5JtUb03HIJQ7VLYM5lIiIkD9G2rg1rW8P623pCAXVKhoYY5gDFMg0EKaO0Z7y7fD3xFYBDBfq5cjquaBHTWZjHbOeEtRG2MGm+olyAM9uraM9IVt9Z53kTd5OiGLagCyRYf62pu7T0RyCtNpBu/AsAzFsgLLcZ7E7X7l6D5MmXGWXPWwztZzIIaOyW944UyPmEMykcwfr1sNG6Np7cL7ljj0P2bY97FBtG6JM57Gyp1PnWUa3IsjW+uuTrtospLGZZBMQ+qAjNgcl2ZtcUNpUNJJOXyRH13S34lnLWRizrrXKmswUW+ePdHmbOTYnuffsGE9m4wZ2DcXUdZQ5Vsch3SN3HoeKFs4asi1ce8n28BvjeucVtTvkDHLTqymXgc7F7M66CPd0U126RtbwiVwEoWMXs5TA7CrOnK+R0A4G5+Gg5pczEMrkENWxU4FvSK1NVMWWmbRvSH54dq4TKru9gXDhOntSGOw6ucJLRnlXwPZM26LuXGaYRjvBads6efv25Suk9PFq2eGwewWxYZao4PiRKXI1wsJMf2/X7icz++zDoEc4Wmd/63Jaq5Pr5Jq/sIWS9PjEFGIAo8BF1/kzWfyCNX3PNa+QzT52UfxKWtTIJlC1x9Jlpb5mGGMMabTVsPnwEFbP0/xcP4fvbAM/0nvK2Xaxwbeb4VoyJdX520gPI6lNzoQtlEaphjPDDmRhD7LmEZPDAnBeFK77wnRjiK14mfMHi/MfLJWGk5mXZt0s62SLUffOTsGzOa1bK0kjK6dHlhVlGJsF29Qa39Pxj1txa7bpJQdGyU/PJRedyAVtmVCACfRIyx5yWRS9oJ0LYK1ho36KbEizk2NgyNa8awoV/eGzokYth8+s3fA8G2IOs9TG02tIljSTzi5CryhZn+M8iqaacC4EtSXm6cweMuM81m+jg3wy+7RqvRC0+FbHOQy7DI2sSe0uEJkqgig3c0afQcdEOz36J5sUk9wMs5cZkXuJ4SD5XMVHucZH+lMTnNVxOYBE0JJKdsxHBbF0/iH0mYpGEKPDfSMyIvOZOCs6Taetpq5E792azUaO1Noch5JktIXJ5CwW12LxGjlxOLcTD7CDGmfLKuf4B3PEnC1MMnR3sDT52gfOxcFkVaIn37FcB2w+SZ+EZod1TgYJOSkWxats9OrTwj+20XjansZSRjlH3JNmFcjy5XlIyJzv1+AcHqv5SWK35Y5Lw1DIS5Jhr/L8PLtUIgVMmpnCJBP9GvodDa4x8jcycQsWKmYuiGbgmgVc3GmvWMHjrvAkPeRJqGm2SrrYOvyc53/JeD8y3p+KgKNdpmffyBy6dhwAQLAd61PBNjLZYNTqv0eUW2TdFxXPsGNXQXPuYLHFJHBuhr1pyfW43pCXMzvRPnI5B8oRK6whSrIkZIbbs5IwSYNnU+Zuhsf64de7tXKOKSONftaxALkDGTYjAesAsJcvxuDcrGnmPG2LXIKErfakrulDbHT0Mn0TFSbj9YWBPr49aWVjhe7GJSOybiLFyRYySrP0/zY/lZ0ttQmxaKAUsXtYU5YQo1wm0ISe2Yj5LCpgcyc4r+9j14QwtqOPmP61wkA5Nj62zfd8gM0OvG7TzprGzsXkUIHMHNmpZTKwQQZ/yA3OrBQJpe+TYQ2y2yIZsCAvaExbyEGbNeCgrNuRnRkLx+khTAgbIm0VKes3lGYEjTI8cxONdLbOwFq5fD397CLiiKz50ZRFXYHvE0AQHpH0hDci4hJmvUW80fyJcjmu1N+xbeYsuoUKCRbOpWDzthu5m5jiZDLhUdr/gC3Lw5YoUmuHbSeqzPAsm8Kpd+bMRy0W12/8PxmWgQ2BCZkFuIX8J1sHwWF68yldV0we6y0kOiq1licEBIRAtVrZGlfFMty0uQH8zHAFtjTFMqUOcpfQluzlHD1W9NocCWtKNthJqDrUDY4kF+fGJ8OGG3pJOmm3OidcInPiEtmpRtanntilcJSjsW1UUJQAdPJcAHtRy91VoZIQSinIUD7vCeGmJpEPvZwhlFM9o4kqNL9HTG24AM7LsUyY1SZZzdbRsDU0lk83WIQ8u0eufJZtWvVjzhp7antPckQBOV4azmwD5Sh80iyxZWFJzy27Ax4hBGqdHStSEDg4MPhMrNal3Ja6BIDOdI3L5CMvtHQxAVygjGjLN7Fxa7LwRIubbVEk51PcZCEF6Py+k0kigzPShS+sdcXKJ9RMk01Os2ehektG4+6cxgXfYTO1mnoeJYiB7lrn39MD8KYD9n9agJrM7OmVP6nrcPTrMfwirJk9WohkCscctWpW/iAPttiyOtq9yM+6yR952sGXbbrMSlXr2jJdlaPXC7jIQ9Zexw6z2la3YOVJyNIQMMFIPXGhH4CmdIperphFpRRMzTv2LU8k3xaeEGr/E49+YNvo8FshleJo4KZBNFiNsvKHmtyt6eCIcqkwb22mkZl09ZBJvLA1D5edid/ioimjESZcnZBdnAAXL3Qyap7NamR7GFcRzax3Z83S1ORYN8pPczHohrZ1aJIFxMzB6Q89d88jx4cyFOLwww/3pFKY1tf/F9/3iVkxOUwR6fy1YwgRuUgohz/TNStFm484ts+zs+ygptzBGhMVKm8NLiI9vDqwYoe7Y3degWFkYkibAGpefGuwG1m4wk52sY20yHmsWeP8XWwmaxiDGex7PvX29PwllCEOP/xwT5x11lkSAI459OBrfKYxxfB0TQo7gDgx53w3s1NDYaBlQpuDYfPusJQ9xppRwVhM610LJqHmBCKsMwHtgClpG8Om/I2MBGaWBYTd5ctG+EZq0Bn4kGXuzYiC8peCHel5BitWXskLxo5589HXAMBZZ50lo58egkcLSB515rzfrNm88cMchiEDPmxS19Utrk0TxDyY5x1UsRaUnBg8toPwz7F0iZ6BrNvhdgn5sEvvMm6b/uKm2blzVfijxc+y82tT7P5gDc6IrB2F5JO/526zf/PIwrs+yu9lDwsgBQDMP2A+M5iOPfKo79eq1al4FDOTI2xnF+5qlzkl3aSRM4CDxRnYYRml5lUjpNKqR9LCSqTSbtKuHlGRD7ezHXkRJ1yhJBcYkxzdEZNI1iCHgrCooDty3gq1e3Yj6MnIO5ZKilql1jz60MN+yMw0/4D5JiwdGhryFixYIOe95+xLl61+/cuy0QhJCL/oWdh1OBwTrPXEhY1mjdeyYz6Rbuy0ujuDW+Bc30YTQRPcRRc5YGeCyyTH4DRu+gxiYlBbOG/NLLZl7Du45XZNpkm7swOkmjiCCGDFoed7/h67zb7s4b/e+aVkr/NneD5o8YmLa5/+t688s318eC9PeJKZvTzAyoebvBNKIbZm3ZlpYiv5RBaRVPCzyTAIMKVTs3SXpcvZKB5Rb7PwbCFtm6C2us9bEzypOEgo1szkxSe5nAfnooDc3+yIodl6JUEqxd5Ab9/yX178gzfPmzdvUjdnuiSMh14connz5o2/5ZDDLuzp6WWplJNwpiy/kSlcE16ejZ7EhReDrCQV2ZURunTM0vI5k1DkILB06MVugsUw1UYqKsfOmMNLrdqpFLBamnku5LqLzH2uTUVxlpQcrsFYB2IZSnR2dPBRbzr0wnnz5o0PDQ0ZJ8a43S+++CLPnTvXv3nBDSuOOeGEzcPjI2c1G41QxC2vDGLMBcKZcoRhnsZ0+8zsIJkMElM2Up3goGe1se+wMm9puzmdizcyOmSxprYax2Tg9UaZNi2VS+iQTqQVaQ2KIhjz9uv1kWmgYBVOpLIRrWZWKhVWOzr8/fbY+4vX//aP186dO9e/7bbbpL5tOfO+cuVKhbnwX134wmN77b+fP9VqzpNShiJu1E9GJScKxAFk4QMHeLEKNuxx6OB8Sare5d+s87NqEfWcO5mdzTOq3FxYg9MgKgaFuuKYHECWUFiNliPLjIECnBOhIJehQP72M4xoJb5ErJhDvxQEg93933l44aLv8dwT/JVLluQGOnpOE70ympa6/rUV9xx81OHVqWbjhPpUXXnCS11nXixdUNKRU+bE4MqQl+U1uGSFYM4lcf+qXDrbuPik0dt6OtcxDMskaSgHuGzQmIOwpFsgk72jXKDu2uqdABZmJ3sQoEIZcrVa82cMTrv0qUVLvsFgDytXStePt5vSpHgI3iMLF331oL3fOL+rs8uTrASBwmK8ilwUQGxO4YrGuOUrhHR+xegDQOSIe2NbwJyKLO1u7pmiOf+9vPiTswpiK62QkWHsbpSlhZnMds8AS/5OZnrYTV0j5+yIiulsyyCEoZKiu6vbe9O++8//+6L7v4qhIQ9t+rXtjNrbI0B+8NOfOOeZpc9fuXV4+y5SShZEihmeDs9tutfAdNaAQyex5GjhbvPc6W+iNjl75Hvm2oAdbSah6TxK9ns4Z4/YTCBb6h5L8EJ591aUrSKyASvl8hTWkZAylOT5nujr6d14+AFv/sSfrrjyZo4svGy7uTtxABhz5/rPXn/DS9//3iXXrly9drBer7+5GbaEkpKFEDKuyyO7tk8XRBDnrahjZgN2eFK5naCk6ATlay/IdsNkx/hcgHRjCVjBTbSVR6Z5IscTUaFbse2eBTYVAVIpRQyIrq4OmjNr9jVf/OePn/utr37tccyFj5XtN39nLYBBFAkifPiizxz/7MsvfH3ryMjpjbCBsBUCDEUCCtGMPiKKDZddiuPMLjpkz+1npJsdQPQcGbmtBxVHXQUqJc7zFe1ZWRTmtsjhsAveh+EefcSKmbP+LZ5ipqAUoFqqYKC3794jDjvsh//1ncvulKygEz3/awcg3hSiaE6r9D0PX7j4m8c+/Phj524bGz6rpeTe9ampdIChUlyYoXKxLBnZUrDqDk6dC0IRwo4afRkTljWrQAZR49TBoEgg46JMTLOXL7JhJ7VLuiuI19LzPICi5tuVcgW1SmX1QE/fnQcfcOBvr/j+ZY/ETSM9ZlZUBBr+0QOQ/Jk/f7645JJLkIALZi7/n4u/+ZZly145anxq/KBGM5wVhq2Z9VbDi3q2Ui61aeTz42ZNUSNuTeJgCFGzbqMJMNOLR+3ZO1kiSEPYunrDandCQNRGXOkpVj3cK5KqFZxSztTGOYEvzLb4RJT1HrRr/gWh7JdkKOWaro7OdR3V6gv7zNnr8V/+4LIniGgyefHQ0JDY2Vv/Dx8Awy1sWkBYglB/wyAI0Gg2xT/6/v//n8ww+MJTinNzDbyhoSH8TzY++fP/ANm/WF1jAHF4AAAAAElFTkSuQmCC" alt="Scout Base" class="brand-logo">
      <h1>SCOUT BASE SYSTEM</h1>
      <p class="subtitle">Future &amp; Intelligent</p>
    `;
    // Kliknięcie w logo/nagłówek wraca na stronę główną (dashboard).
    brand.style.cursor = 'pointer';
    brand.title = 'Powrót do panelu głównego';
    brand.onclick = ()=>{ currentView='dashboard'; editingPlayerId=null; viewingPlayerId=null; render(); };
  }
  odswiezPrzelacznikMotywu();
  // Przycisk sesji na dole panelu bocznego. Gość widzi „Zaloguj się" także wtedy, gdy logowanie
  // nie jest jeszcze wymagane — inaczej nie dałoby się sprawdzić hasła przed zamknięciem systemu.
  const sesjaBtn = document.getElementById('sesja-btn');
  if(sesjaBtn){
    const zalogowany = !!sesjaUzytkownika;
    sesjaBtn.textContent = zalogowany ? 'Wyloguj się →' : 'Zaloguj się →';
    sesjaBtn.dataset.action = zalogowany ? 'logout' : 'login-screen';
  }
  // ZNACZNIK WERSJI.
  //
  // Po każdej poprawce wraca to samo pytanie: „czy ja już mam nową wersję?". Przeglądarka potrafi
  // trzymać stary plik nawet po wdrożeniu, a wtedy naprawiony błąd wygląda dokładnie tak, jakby
  // poprawki nie było. Data zbudowania w panelu bocznym rozstrzyga to jednym spojrzeniem — tak
  // samo, jak w panelu mobilnym (zakładka Baza).
  const znacznik = document.getElementById('wersja-znacznik');
  if(znacznik) znacznik.textContent = 'wersja ' + (typeof __WERSJA__ === 'string' ? __WERSJA__ : 'robocza');
  const nav = document.getElementById('nav');
  // Zakładka „Dostęp" tylko dla administratora — reszcie nie ma czego pokazywać, bo baza i tak
  // odda im wyłącznie ich własny wiersz.
  const pozycje = (kontoUzytkownika && kontoUzytkownika.rola === 'admin')
    ? NAV_ITEMS.concat([{id:'access', label:'Dostęp'}])
    : NAV_ITEMS;
  nav.innerHTML = pozycje.map(it => `
    <div class="nav-item ${currentView===it.id?'active':''}" data-view="${it.id}">
      <span class="nav-dot"></span>${it.label}
    </div>`).join('');
  nav.querySelectorAll('.nav-item').forEach(el=>{
    // Kliknięcie w zakładkę z bocznego panelu wraca na jej stronę główną. Wcześniej zerowaliśmy
    // tylko zawodnika, więc np. Kluby otwierały się na ostatnio oglądanym klubie albo z zawężeniem
    // do jednej ligi — a od zakładki oczekuje się widoku ogólnego ("Wszystkie").
    el.addEventListener('click', ()=>{
      currentView = el.dataset.view;
      editingPlayerId = null;
      viewingPlayerId = null;
      viewingClubId = null;
      clubBrowse = { top: '', group: '' };
      viewingRocznikGroup = null;
      viewingAgencyId = null;
      compareIds = ['', '', ''];
      dashboardLeagueSelected = null;
      render();
    });
  });
  const banner = document.getElementById('save-failure-banner');
  if(banner){
    if(lastSaveFailure){
      banner.innerHTML = `<div class="save-fail-bar">
        ⚠️ <strong>Nie udało się zapisać ostatniej zmiany</strong> (${esc(lastSaveFailure.time)}) — dane mogą się nie zachować po zamknięciu strony.
        <button data-action="retry-save">Spróbuj zapisać ponownie</button>
      </div>`;
      const retryBtn = banner.querySelector('[data-action="retry-save"]');
      if(retryBtn) retryBtn.onclick = ()=>retryFailedSave();
    } else {
      banner.innerHTML = '';
    }
    // Przycisk sesji stoi w prawym górnym rogu, czyli dokładnie tam, gdzie baner. Klasa na <body>
    // przesuwa go pod baner na czas, gdy baner jest widoczny.
    document.body.classList.toggle('baner-zapisu', !!lastSaveFailure);
  }
}

// ---------- RENDER ROOT ----------
// Przewiń widok na samą górę (np. po otwarciu profilu zawodnika — żeby widok zaczynał się od góry,
// a nie od miejsca, w którym była lista). Czyścimy wszystkie prawdopodobne kontenery przewijania.
function scrollViewTop(){
  try{ window.scrollTo(0,0); }catch(e){}
  try{ document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }catch(e){}
  const m = document.getElementById('main');
  if(m){ m.scrollTop = 0; let el = m.parentElement; while(el){ el.scrollTop = 0; el = el.parentElement; } }
}
let lastRenderedPageKey = null; // wykrywa zmianę "strony" (zakładka / otwarty profil / otwarty klub), żeby przewinąć na górę tylko wtedy, a nie przy każdym re-renderze (np. po zapisie pola)
function render(){
  const main = document.getElementById('main');
  const pageKey = currentView + '|' + (viewingPlayerId||'') + '|' + (viewingClubId||'');
  const pageChanged = pageKey !== lastRenderedPageKey;
  lastRenderedPageKey = pageKey;
  // Zachowaj pozycję kursora w polu tekstowym, jeśli jakieś jest aktywne — pełne przebudowanie innerHTML
  // niszczy i tworzy elementy na nowo, co bez tego resetowałoby kursor na koniec tekstu przy każdym znaku.
  const active = document.activeElement;
  let focusRestore = null;
  if(active && main && main.contains(active) && (active.tagName==='INPUT' || active.tagName==='TEXTAREA') && active.id){
    focusRestore = {id: active.id, start: active.selectionStart, end: active.selectionEnd};
  }
  renderNav();
  if(currentView==="dashboard") main.innerHTML = viewDashboard();
  else if(currentView==="players") main.innerHTML = viewPlayers();
  else if(currentView==="clubs") main.innerHTML = viewClubs();
  else if(currentView==="newobs") main.innerHTML = viewNewObs();
  else if(currentView==="observedlist") main.innerHTML = viewObservedList();
  else if(currentView==="monitoring") main.innerHTML = viewMonitoring();
  else if(currentView==="committee") main.innerHTML = viewTransferCommittee();
  else if(currentView==="ranking") main.innerHTML = viewRanking();
  else if(currentView==="reports") main.innerHTML = viewReports();
  else if(currentView==="talent") main.innerHTML = viewTalent();
  else if(currentView==="agencies") main.innerHTML = viewAgencies();
  else if(currentView==="contacts") main.innerHTML = viewContacts();
  else if(currentView==="settings") main.innerHTML = viewSettings();
  else if(currentView==="compare") main.innerHTML = viewCompare();
  else if(currentView==="access") main.innerHTML = viewAccess();
  attachHandlers();
  if(focusRestore){
    const el = document.getElementById(focusRestore.id);
    if(el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA')){
      el.focus();
      try{ el.setSelectionRange(focusRestore.start, focusRestore.end); }catch(e){ /* niektóre typy input (np. number) nie wspierają setSelectionRange */ }
    }
  }
  syncHistory();
  if(pageChanged) scrollViewTop();
}

// ---------- HISTORIA / NAWIGACJA WSTECZ-DALEJ ----------
// Integracja z historią przeglądarki: cofanie (przycisk myszy „wstecz", Alt+strzałka w lewo) i naprzód
// (Alt+strzałka w prawo) wracają do poprzedniego/następnego widoku aplikacji. render() zgłasza aktualny
// stan przez syncHistory(); przy zmianie widoku wpisujemy go do historii (pushState), a popstate przywraca.
let lastNavSig = null;
let historyInited = false;
let restoringFromHistory = false;
let navIndex = 0;   // pozycja w naszej ścieżce; 0 = pierwszy widok, nie ma dokąd cofać
function navSignature(){
  // Sygnatura musi obejmować KAŻDY stan, który zmienia zawartość ekranu. Brakowało tu widoku
  // agencji i rocznika — wejście w agencję nie zmieniało sygnatury, więc do historii nie trafiał
  // żaden wpis, a „wstecz" wracało do ostatniego zapamiętanego widoku, czyli zwykle dashboardu.
  return JSON.stringify({v:currentView, p:viewingPlayerId, c:viewingClubId, a:viewingAgencyId,
    r:viewingRocznikGroup, ct:clubBrowse.top, cg:clubBrowse.group, cmp:compareIds});
}
function syncHistory(){
  const sig = navSignature();
  if(sig === lastNavSig) return;      // ten sam widok (np. render po zapisie danych) — nie dubluj wpisu
  lastNavSig = sig;
  if(restoringFromHistory) return;    // przywracanie z historii nie tworzy nowego wpisu
  const state = {currentView, viewingPlayerId, viewingClubId, viewingAgencyId, viewingRocznikGroup,
    clubBrowseTop:clubBrowse.top, clubBrowseGroup:clubBrowse.group, compareIds:[...compareIds]};
  if(!historyInited){ navIndex = 0; history.replaceState({...state, navIndex}, ''); historyInited = true; }
  else { navIndex++; history.pushState({...state, navIndex}, ''); }
}
// Przyciski „← Wróć…" w aplikacji mają iść TĄ SAMĄ ścieżką co przycisk wstecz w przeglądarce.
// Wcześniej ustawiały stan wprost, przez co render() dokładał NOWY wpis do historii: ścieżka
// rosła do przodu, a przeglądarkowe „wstecz" wracało tam, skąd użytkownik właśnie wyszedł.
// navIndex mówi, czy jest dokąd cofać wewnątrz aplikacji; na pierwszym wpisie ustawiamy stan
// ręcznie, żeby nie wyrzucić użytkownika ze strony.
function cofnijWidok(przywrocStan){
  if(navIndex > 0){ history.back(); return; }
  przywrocStan();
  render();
}
window.addEventListener('popstate', (e)=>{
  const s = e.state;
  restoringFromHistory = true;
  currentView = (s && s.currentView) || 'dashboard';
  viewingPlayerId = (s && s.viewingPlayerId) || null;
  viewingClubId = (s && s.viewingClubId) || null;
  viewingAgencyId = (s && s.viewingAgencyId) || null;
  viewingRocznikGroup = (s && s.viewingRocznikGroup) || null;
  navIndex = (s && typeof s.navIndex === 'number') ? s.navIndex : 0;
  editingPlayerId = null;
  if(clubBrowse){ clubBrowse.top = (s && s.clubBrowseTop) || ''; clubBrowse.group = (s && s.clubBrowseGroup) || ''; }
  if(s && s.compareIds) compareIds = s.compareIds;
  try{ render(); }catch(err){ console.error('render() po popstate nie powiódł się:', err); }
  restoringFromHistory = false;
});
// Alt+strzałka w lewo/prawo — jawnie mapowane na wstecz/naprzód (na wypadek, gdy przeglądarka/OS tego nie robi).
window.addEventListener('keydown', (e)=>{
  if(!e.altKey || e.ctrlKey || e.metaKey) return;
  if(e.key === 'ArrowLeft'){ e.preventDefault(); history.back(); }
  else if(e.key === 'ArrowRight'){ e.preventDefault(); history.forward(); }
});

// ---------- DASHBOARD ----------
// Środek geometryczny (bounding-box) ścieżki SVG — do umieszczenia liczby klubów na województwie.
// Zbiera absolutne punkty ścieżki SVG, poprawnie obsługując komendy WZGLĘDNE (małe litery: m,l,h,v,c,z)
// i bezwzględne (M,L,H,V,C,Z). Wcześniejsza wersja traktowała każdą liczbę jak absolutną parę x,y — przez
// co województwa zapisane relatywnie (Pomorskie, Zachodniopomorskie) miały środek liczony błędnie i etykieta
// z liczbą klubów lądowała poza regionem.
function pathAbsPoints(d){
  const pts = [];
  let x=0, y=0, sx=0, sy=0;
  const chunks = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
  for(const chunk of chunks){
    const c = chunk[0], rel = c === c.toLowerCase(), C = c.toUpperCase();
    const a = (chunk.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
    if(C === 'M'){
      for(let i=0; i+1<a.length; i+=2){ x = rel? x+a[i] : a[i]; y = rel? y+a[i+1] : a[i+1]; if(i===0){ sx=x; sy=y; } pts.push([x,y]); }
    } else if(C === 'L'){
      for(let i=0; i+1<a.length; i+=2){ x = rel? x+a[i] : a[i]; y = rel? y+a[i+1] : a[i+1]; pts.push([x,y]); }
    } else if(C === 'H'){
      for(const n of a){ x = rel? x+n : n; pts.push([x,y]); }
    } else if(C === 'V'){
      for(const n of a){ y = rel? y+n : n; pts.push([x,y]); }
    } else if(C === 'C'){
      for(let i=0; i+5<a.length; i+=6){ x = rel? x+a[i+4] : a[i+4]; y = rel? y+a[i+5] : a[i+5]; pts.push([x,y]); }
    } else if(C === 'Z'){
      x=sx; y=sy;
    }
  }
  return pts;
}
function pathBoundingCenter(d){
  const pts = pathAbsPoints(d);
  if(!pts.length) return {x:0, y:0};
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const [px,py] of pts){ if(px<minX)minX=px; if(px>maxX)maxX=px; if(py<minY)minY=py; if(py>maxY)maxY=py; }
  return {x:(minX+maxX)/2, y:(minY+maxY)/2};
}

// Mapa Polski wg województw w stylu strony (ciemna zieleń → złoto wg liczby klubów) z efektem 3D:
// pod każdą "płytą" województwa rysowana jest ciemna warstwa wytłoczenia (extrusion) przesunięta w dół,
// a na wierzchu barwna płyta z połyskiem (gradient góra-jasno / dół-ciemno). Całość ma miękki cień.
// Najechanie kursorem podnosi województwo (CSS .voiv-shape:hover), odsłaniając głębię — stąd wrażenie 3D.
const MAP_DEPTH = 8; // wysokość wytłoczenia w jednostkach viewBox
function polandVoivodeshipMap(){
  const counts = {};
  DB.clubs.forEach(c=>{
    const key = (c.region||'').replace(' ZPN','');
    counts[key] = (counts[key]||0) + 1;
  });
  // Skala murawa → złoto, utrzymana w JASNEJ, stonowanej części zakresu (0,44-0,75 domieszki złota).
  // Wcześniej jasność zależała od tego, ile klubów ma najliczniejsze województwo: przy maksimum 31
  // mapa wychodziła jasna i elegancka, a przy 40 te same województwa robiły się ciemne i ponure.
  // Rozpięcie między najmniejszą a największą wartością odcina tę zależność — wygląd zostaje ten sam
  // niezależnie od tego, ilu klubów przybędzie w bazie.
  const wartosci = VOIVODESHIP_PATHS.map(v=> counts[v.region] || 0).filter(n=>n>0);
  const minCount = wartosci.length ? Math.min(...wartosci) : 0;
  const maxCount = Math.max(1, ...wartosci);
  const items = VOIVODESHIP_PATHS.map(v=>{
    const count = counts[v.region] || 0;
    const t = count===0 ? 0 : (count - minCount) / Math.max(1, maxCount - minCount);
    const intensity = (0.58 + 0.42 * t) * 0.75;   // najciemniejsze ~0,44, najjaśniejsze 0,75
    // Ręczna interpolacja RGB (nie CSS color-mix) dla zgodności ze wszystkimi przeglądarkami.
    const pitchRgb = [22,48,42], goldRgb = [198,155,60];
    const mixed = pitchRgb.map((cc,i)=> Math.round(cc + (goldRgb[i]-cc)*intensity));
    const fill = count===0 ? '#17322A' : `rgb(${mixed[0]},${mixed[1]},${mixed[2]})`;
    const center = pathBoundingCenter(v.d);
    return {v, count, fill, center};
  });
  // Warstwa wytłoczenia (ciemne boki), rysowana pod spodem i przesunięta w dół — daje grubość mapy.
  const extrusion = items.map(s=>`<path d="${s.v.d}" fill="#0B1F19" transform="translate(0,${MAP_DEPTH})"/>`).join('');
  // Barwne płyty województw + połysk + liczba klubów. Każde w grupie .voiv-shape (podnosi się przy hover).
  const tops = items.map(s=>`<g class="voiv-shape" data-region="${esc(s.v.region)}">
      <path d="${s.v.d}" fill="${s.fill}" stroke="#0E241E" stroke-width="1.1"/>
      <path d="${s.v.d}" fill="url(#voivGloss)" stroke="none"/>
      <text x="${s.center.x}" y="${s.center.y}" text-anchor="middle" font-size="10" font-weight="800" fill="var(--on-pitch)" style="pointer-events:none;paint-order:stroke;stroke:#0B1F19;stroke-width:3px;">${s.count}</text>
    </g>`).join('');
  return `<svg viewBox="0 -4 612 592" class="poland-map" style="width:100%;height:auto;max-width:440px;display:block;margin:0 auto;">
    <defs>
      <filter id="mapShadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#08130F" flood-opacity="0.55"/>
      </filter>
      <linearGradient id="voivGloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--card)" stop-opacity="0.16"/>
        <stop offset="0.5" stop-color="var(--card)" stop-opacity="0.02"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.22"/>
      </linearGradient>
    </defs>
    <g filter="url(#mapShadow)">${extrusion}</g>
    <g>${tops}</g>
  </svg>`;
}

// Wykres kołowy (donut) rozkładu obserwacji / statusów zawodników.
function observationsDonut(){
  const totalObs = DB.observations.length;
  const inObservation = DB.players.filter(p=>p.status==='Do Obserwacji' || p.status==='Rekomendowany' || p.status==='Na Testy').length;
  const forTransfer = DB.players.filter(p=>p.status==='Do transferu').length;
  const total = Math.max(1, totalObs + inObservation + forTransfer);
  const segments = [
    {label:'Obserwacje', value:totalObs, color:'var(--gold)'},
    {label:'W obserwacji', value:inObservation, color:'#6E9C7C'},
    {label:'Do transferu', value:forTransfer, color:'var(--clay)'}
  ];
  const R = 60, CX = 70, CY = 70, STROKE = 24;
  const circumference = 2*Math.PI*R;
  let offset = 0;
  const arcs = segments.map(s=>{
    const frac = s.value/total;
    const dash = frac*circumference;
    const el = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${s.color}" stroke-width="${STROKE}"
      stroke-dasharray="${dash.toFixed(1)} ${(circumference-dash).toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 ${CX} ${CY})"/>`;
    offset += dash;
    return el;
  }).join('');
  const legend = segments.map(s=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
    <span style="width:11px;height:11px;border-radius:3px;background:${s.color};display:inline-block;flex-shrink:0;"></span>
    <span style="font-size:12.5px;">${esc(s.label)}: <strong>${s.value}</strong> (${Math.round(s.value/total*100)}%)</span>
  </div>`).join('');
  return `<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
    <svg viewBox="0 0 140 140" style="width:140px;height:140px;flex-shrink:0;">${arcs}
      <text x="70" y="66" text-anchor="middle" font-size="20" font-weight="800" fill="var(--pitch)">${totalObs+inObservation+forTransfer}</text>
      <text x="70" y="80" text-anchor="middle" font-size="9" fill="var(--ink-soft)">łącznie</text>
    </svg>
    <div>${legend}</div>
  </div>`;
}

const BYDGOSZCZ_COORDS = {lat:53.1235, lon:18.0084};
const KNOWN_CITY_COORDS = {
  'warszawa':{lat:52.2297,lon:21.0122}, 'kraków':{lat:50.0647,lon:19.9450}, 'łódź':{lat:51.7592,lon:19.4560},
  'wrocław':{lat:51.1079,lon:17.0385}, 'poznań':{lat:52.4064,lon:16.9252}, 'gdańsk':{lat:54.3520,lon:18.6466},
  'szczecin':{lat:53.4285,lon:14.5528}, 'bydgoszcz':{lat:53.1235,lon:18.0084}, 'lublin':{lat:51.2465,lon:22.5684},
  'białystok':{lat:53.1325,lon:23.1688}, 'katowice':{lat:50.2649,lon:19.0238}, 'kielce':{lat:50.8661,lon:20.6286},
  'rzeszów':{lat:50.0413,lon:21.9990}, 'olsztyn':{lat:53.7784,lon:20.4801}, 'opole':{lat:50.6751,lon:17.9213},
  'zielona góra':{lat:51.9356,lon:15.5062}, 'toruń':{lat:53.0138,lon:18.5984}
};
function haversineKm(a, b){
  const R = 6371;
  const dLat = (b.lat-a.lat)*Math.PI/180;
  const dLon = (b.lon-a.lon)*Math.PI/180;
  const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2*Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}
// Geokodowanie miejscowości/adresu w Polsce -> {lat,lon}. Najpierw darmowe Nominatim (OpenStreetMap,
// bez klucza API); jeśli sieć/limit zawiedzie, dopasowanie po rdzeniu nazwy z listy większych miast.
async function geocodePl(text){
  if(!text) return null;
  try{
    const resp = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pl&q=' + encodeURIComponent(text));
    if(resp.ok){
      const results = await resp.json();
      if(results && results.length){
        const d = {lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon)};
        if(!isNaN(d.lat) && !isNaN(d.lon)) return d;
      }
    }
  }catch(e){ console.error('Geokodowanie Nominatim nie powiodło się, próbuję listy miast', e); }
  const low = text.toLowerCase();
  const stem = (name)=> name.length > 5 ? name.slice(0, name.length-2) : name;
  const city = Object.keys(KNOWN_CITY_COORDS).find(c=>low.includes(stem(c)));
  return city ? KNOWN_CITY_COORDS[city] : null;
}
// Odległość w linii prostej (haversine) między punktem startowym A a miejscem obserwacji B. Oba geokodowane.
async function calcDistanceBetween(startText, destText){
  const [a, b] = await Promise.all([geocodePl(startText), geocodePl(destText)]);
  if(!a || !b) return null;
  return Math.round(haversineKm(a, b));
}
// Zgodność wstecz: dystans z Bydgoszczy (gdy nie podano punktu startowego).
async function calcDistanceFromBydgoszcz(locationText){
  const b = await geocodePl(locationText);
  return b ? Math.round(haversineKm(BYDGOSZCZ_COORDS, b)) : null;
}

function bydgoszczDistanceWidget(){
  const year = '2026';
  const yearObs = DB.observations.filter(o=>(o.date||'').startsWith(year) && o.distanceKm!=null);
  const totalKm = yearObs.reduce((sum,o)=>sum+Number(o.distanceKm||0), 0);
  return `<div class="card">
    <h4 style="margin-top:0;color:var(--heading);">📍 Dystans obserwacji 2026</h4>
    ${yearObs.length ? `
      <div style="display:flex;align-items:baseline;gap:8px;">
        <span style="font-size:32px;font-weight:800;color:var(--gold-dark);">${totalKm.toLocaleString('pl-PL')}</span>
        <span style="font-size:14px;color:var(--ink-soft);">km łącznie (${yearObs.length} obserwacji z lokalizacją)</span>
      </div>
      <p class="note" style="margin-top:4px;">Suma odległości w linii prostej z punktu startowego do miejsc zaplanowanych obserwacji w 2026.</p>
    ` : `<div class="empty">Brak obserwacji 2026 z obliczonym dystansem — dystans liczy się automatycznie przy zapisywaniu obserwacji z podaną lokalizacją.</div>`}
  </div>`;
}

function sponsorsPanel(){
  const sponsors = (DB.settings && DB.settings.sponsors) || [];
  // Puste, małe okienko bez napisów i bez żadnego znaczka — na przyszłość, do logotypów partnerów i
  // sponsorów. Dodać logo można klikając w puste pole okienka (niewidoczna, klikalna strefa).
  const logos = sponsors.map((s,i)=>`<div style="position:relative;display:inline-flex;">
      <img src="${s.dataUrl}" alt="${esc(s.name||'')}" style="height:34px;max-width:100px;object-fit:contain;">
      <button class="link-btn" data-action="remove-sponsor" data-idx="${i}" title="Usuń" style="position:absolute;top:-7px;right:-7px;background:var(--clay-dark);color:var(--card);border-radius:50%;width:15px;height:15px;font-size:9px;line-height:1;padding:0;">✕</button>
    </div>`).join('');
  return `<div class="card sponsors-box">
    ${logos}
    <label class="sponsors-add-zone" title="Kliknij, aby dodać logo partnera / sponsora">
      <input type="file" id="sponsor-logo-input" accept="image/png,image/jpeg,image/svg+xml" style="display:none;">
    </label>
  </div>`;
}

// Odmiana "zawodnik" po liczbie (w licznikach naturalna forma: 1 zawodnik, N zawodników).
function plZaw(n){ return n === 1 ? 'zawodnik' : 'zawodników'; }

// Szybki dostęp wg lig na dashboardzie — TYLKO najwyższe poziomy (reszta jest już w pełni dostępna
// w zakładce Kluby). Logotypy w jednolitym rozmiarze, styl 3D, układ poziomy. Klik w logo rozwija w
// miejscu rząd herbów klubów tej ligi; klik w herb przenosi od razu do listy zawodników klubu. Loga
// wgrywa użytkownik (jak herby klubów) — oficjalne logotypy lig to znaki towarowe, których nie
// pobieramy automatycznie. CLJ U19 dopasowana dokładnie (nie przez topLevelOf, bo ten grupuje
// wszystkie kategorie juniorskie razem) — tu chodzi tylko o samo U19.
const DASHBOARD_QUICK_LEAGUES = [
  {key:'Ekstraklasa', match:c=>topLevelOf(c.league)==='Ekstraklasa'},
  {key:'I liga',       match:c=>topLevelOf(c.league)==='I liga'},
  {key:'II liga',      match:c=>topLevelOf(c.league)==='II liga'},
  {key:'III liga',     match:c=>topLevelOf(c.league)==='III liga'},
  {key:'CLJ U19',      match:c=>c.league==='CLJ U19'},
];
function leagueQuickAccessPanel(){
  const logos = DASHBOARD_QUICK_LEAGUES.map(({key, match})=>{
    const count = DB.clubs.filter(match).length;
    const active = dashboardLeagueSelected===key;
    return `<div class="league-logo-3d ${active?'active':''}" data-action="dash-select-league" data-val="${esc(key)}" title="${esc(key)} — ${count} ${count===1?'klub':'klubów'} w bazie — kliknij, aby zobaczyć kluby">
      <div class="league-logo-3d-plate">
        ${leagueLogoImg(key, 64)}
        <label class="league-logo-3d-upload" title="Wgraj/zmień logo tej ligi" onclick="event.stopPropagation()">✎
          <input type="file" class="league-logo-input" data-league="${esc(key)}" accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg" style="display:none;">
        </label>
      </div>
      <div class="league-logo-3d-label">${esc(key)}</div>
    </div>`;
  }).join('');

  let clubsRow = '';
  if(dashboardLeagueSelected){
    // Ligi z podziałem na grupy (np. III liga: gr. I-IV) — najpierw wybór grupy, dopiero
    // potem lista klubów tej konkretnej grupy, zamiast wrzucania wszystkich grup naraz.
    const groups = groupsForTop(dashboardLeagueSelected);
    if(groups.length){
      const groupTiles = groups.map(g=>{
        const label = g.replace(dashboardLeagueSelected+', ', '');
        const count = DB.clubs.filter(c=>c.league===g).length;
        const active = dashboardGroupSelected===g;
        return `<div class="league-logo-3d league-logo-3d-small ${active?'active':''}" data-action="dash-select-group" data-val="${esc(g)}" title="${esc(g)} — ${count} ${count===1?'klub':'klubów'}">
          <div class="league-logo-3d-plate league-logo-3d-plate-small">${esc(label)}</div>
        </div>`;
      }).join('');
      let groupClubsRow = '';
      if(dashboardGroupSelected){
        const clubs = DB.clubs.filter(c=>c.league===dashboardGroupSelected).sort((a,b)=>a.name.localeCompare(b.name,'pl'));
        const cards = clubs.map(c=>{
          const n = DB.players.filter(p=>p.clubId===c.id).length;
          return `<div class="club-crest-card" data-action="dash-goto-club" data-id="${esc(c.id)}" title="Przejdź do zawodników klubu ${esc(c.name)}">
            ${crestImg(clubCrest(c.id), null, c.name)}
            <div style="min-width:0;">
              <div style="font-weight:700;color:var(--heading);font-size:14px;">${esc(c.name)}</div>
              <div style="font-size:11.5px;color:var(--ink-soft);">${esc((c.region||'').replace(' ZPN',''))} &middot; <strong>${n}</strong> ${plZaw(n)}</div>
            </div>
          </div>`;
        }).join('');
        groupClubsRow = `<div style="margin-top:14px;">
          <div class="note" style="margin-bottom:8px;">${esc(dashboardGroupSelected)} — ${clubs.length} ${clubs.length===1?'klub':'klubów'} w bazie</div>
          ${clubs.length ? `<div class="club-crest-grid">${cards}</div>` : `<div class="empty">Brak klubów tej grupy w bazie.</div>`}
        </div>`;
      }
      clubsRow = `<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px;">
        <div class="note" style="margin-bottom:8px;">${esc(dashboardLeagueSelected)} — wybierz grupę</div>
        <div class="league-logos-row">${groupTiles}</div>
        ${groupClubsRow}
      </div>`;
    } else {
      const spec = DASHBOARD_QUICK_LEAGUES.find(l=>l.key===dashboardLeagueSelected);
      const clubs = spec ? DB.clubs.filter(spec.match).sort((a,b)=>a.name.localeCompare(b.name,'pl')) : [];
      const cards = clubs.map(c=>{
        const n = DB.players.filter(p=>p.clubId===c.id).length;
        return `<div class="club-crest-card" data-action="dash-goto-club" data-id="${esc(c.id)}" title="Przejdź do zawodników klubu ${esc(c.name)}">
          ${crestImg(clubCrest(c.id), null, c.name)}
          <div style="min-width:0;">
            <div style="font-weight:700;color:var(--heading);font-size:14px;">${esc(c.name)}</div>
            <div style="font-size:11.5px;color:var(--ink-soft);">${esc((c.region||'').replace(' ZPN',''))} &middot; <strong>${n}</strong> ${plZaw(n)}</div>
          </div>
        </div>`;
      }).join('');
      clubsRow = `<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px;">
        <div class="note" style="margin-bottom:8px;">${esc(dashboardLeagueSelected)} — ${clubs.length} ${clubs.length===1?'klub':'klubów'} w bazie</div>
        ${clubs.length ? `<div class="club-crest-grid">${cards}</div>` : `<div class="empty">Brak klubów tego poziomu w bazie — dodaj je w zakładce Kluby.</div>`}
      </div>`;
    }
  }

  return `<div class="card">
    <h4 style="margin-top:0;color:var(--heading);">Szybki dostęp wg lig</h4>
    <p class="note" style="margin-top:-4px;margin-bottom:10px;">Kliknij logo ligi, aby zobaczyć jej kluby — kliknij herb klubu, aby przejść do zawodników.</p>
    <div class="league-logos-row">${logos}</div>
    ${clubsRow}
    ${dashboardLeagueSelected ? tabelaLigowaHtml(dashboardLeagueSelected, dashboardGroupSelected) : ''}
  </div>`;
}

// Aktualna tabela ligowa pod kafelkami. Pobiera się z tej samej strony 90minut co terminarz,
// więc nie dokładamy nowego źródła ani nowego zapytania do serwisu ponad to, co już robimy.
// Wynik trzymamy w pamięci karty na czas sesji — tabela zmienia się po kolejce, nie co minutę.
const tabeleLigowe = {};        // liga -> {stan:'ladowanie'|'gotowe'|'blad', grupy:[{nazwa,wiersze}], blad}

// Nazwa grupy z naszej bazy („III liga, gr. II") kontra nagłówek strony 90minut
// („Betclic III liga 2026/2027, grupa: II") — porównujemy sam oznacznik grupy.
function oznacznikGrupy(nazwa){
  const m = String(nazwa||'').match(/gr(?:upa)?\.?\s*:?\s*([IVX]+|\d+|[a-ząćęłńóśźż-]+)\s*$/i);
  return m ? importNorm(m[1]) : '';
}

function tabelaLigowaHtml(liga, grupa){
  const dane = tabeleLigowe[liga];
  if(!dane){
    // Pierwsze wejście: zlecamy pobranie i pokazujemy informację, że trwa.
    pobierzTabeleLigowe(liga);
    return `<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px;">
      <div class="note">Pobieram tabelę ${esc(liga)} z 90minut…</div></div>`;
  }
  if(dane.stan === 'ladowanie'){
    return `<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px;">
      <div class="note">Pobieram tabelę ${esc(liga)} z 90minut…</div></div>`;
  }
  if(dane.stan === 'blad'){
    return `<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px;">
      <div class="note" style="color:var(--clay-dark);">Nie udało się pobrać tabeli: ${esc(dane.blad||'')}
      ${liga==='CLJ U19' ? ' — dla rozgrywek juniorskich 90minut nie prowadzi tabeli pod tym adresem.' : ''}</div></div>`;
  }
  if(!dane.grupy.length){
    return `<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px;">
      <div class="note">Brak tabeli dla ${esc(liga)} — rozgrywki mogły się jeszcze nie rozpocząć.</div></div>`;
  }

  // Po wybraniu konkretnej grupy pokazujemy TYLKO ją — cztery tabele naraz zaciemniają obraz,
  // a wybór grupy jest jasną deklaracją, co chcesz oglądać.
  let grupy = dane.grupy;
  if(grupa){
    const szukany = oznacznikGrupy(grupa);
    const pasujace = grupy.filter(g=> oznacznikGrupy(g.nazwa) === szukany);
    if(pasujace.length) grupy = pasujace;
  }

  // Klub z naszej bazy wyróżniamy, żeby od razu było widać, gdzie stoją obserwowani.
  const naszeKluby = new Set(DB.clubs.map(c=>importNorm(c.name)));
  const tabelaHtml = (g)=>`<table class="tabela-ligowa">
    <thead><tr><th style="width:34px;text-align:right;">Lp.</th><th>Drużyna</th>
      <th style="text-align:right;">M.</th><th style="text-align:right;">Pkt.</th>
      <th style="text-align:right;">Z</th><th style="text-align:right;">R</th><th style="text-align:right;">P</th>
      <th style="text-align:right;">Bramki</th></tr></thead>
    <tbody>${g.wiersze.map(w=>{
      const nasz = naszeKluby.has(importNorm(w.nazwa));
      return `<tr${nasz?' style="background:rgba(198,155,60,0.10);"':''}>
        <td style="text-align:right;color:var(--ink-soft);">${w.miejsce}.</td>
        <td>${nasz?'<strong>':''}${esc(w.nazwa)}${nasz?'</strong>':''}</td>
        <td style="text-align:right;">${w.mecze}</td>
        <td style="text-align:right;"><strong>${w.punkty}</strong></td>
        <td style="text-align:right;">${w.zwyciestwa ?? '—'}</td>
        <td style="text-align:right;">${w.remisy ?? '—'}</td>
        <td style="text-align:right;">${w.porazki ?? '—'}</td>
        <td style="text-align:right;white-space:nowrap;">${esc(w.bramki||'—')}</td>
      </tr>`;
    }).join('')}</tbody></table>`;

  const sekcje = grupy.map((g,i)=> grupy.length === 1
    ? `<div class="note" style="font-weight:700;color:var(--heading);margin-bottom:6px;">${esc(g.nazwa)}</div>${tabelaHtml(g)}`
    : `<details ${i===0?'open':''} style="margin-bottom:8px;">
         <summary style="cursor:pointer;font-weight:700;color:var(--heading);">${esc(g.nazwa)}</summary>
         ${tabelaHtml(g)}
       </details>`).join('');

  return `<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px;">
    <div class="note" style="margin-bottom:8px;">Aktualna tabela — źródło: 90minut.pl. Kluby z Twojej bazy są wyróżnione.</div>
    <div style="overflow:auto;">${sekcje}</div>
  </div>`;
}

async function pobierzTabeleLigowe(liga){
  if(tabeleLigowe[liga]) return;
  tabeleLigowe[liga] = {stan:'ladowanie', grupy:[]};
  const adresy = scheduleUrlsFor(liga);
  if(!adresy.length){
    tabeleLigowe[liga] = {stan:'blad', grupy:[], blad:'nie mam adresu tych rozgrywek na 90minut'};
    render();
    return;
  }
  try{
    const wyniki = await Promise.all(adresy.map(async (url)=>{
      const res = await fetch('/api/schedule?url=' + encodeURIComponent(url));
      const ctype = res.headers.get('content-type') || '';
      if(!ctype.includes('application/json')) throw new Error('tabela działa tylko na wdrożonej stronie');
      if(!res.ok){ const b = await res.json().catch(()=>({})); throw new Error(b.error || ('kod ' + res.status)); }
      const d = await res.json();
      return {nazwa: d.league || liga, wiersze: d.table || []};
    }));
    tabeleLigowe[liga] = {stan:'gotowe', grupy: wyniki.filter(g=>g.wiersze.length)};
  }catch(e){
    tabeleLigowe[liga] = {stan:'blad', grupy:[], blad: e.message};
  }
  render();
}

function viewDashboard(){
  const totalClubs = DB.clubs.length;
  const totalPlayers = DB.players.length;
  const totalObs = DB.observations.length;
  const totalReports = DB.reports.length;
  const forTransferCount = DB.players.filter(p=>p.status==='Do transferu').length;

  const recent = DB.observations.slice().sort((a,b)=> b.date.localeCompare(a.date)).slice(0,6);

  return `
  <h2 class="view-title">Dashboard</h2>
  <p class="view-sub">Zalogowany scout: <strong>${esc(currentScout || 'Nieznany')}</strong></p>
  <div class="grid grid-5" style="margin-bottom:18px;">
    <div class="stat" data-action="goto-clubs" style="cursor:pointer;" title="Wszystkie kluby w systemie (wszystkie ligi) — kliknij, aby przejść"><div class="num">${totalClubs}</div><div class="lbl">Kluby</div></div>
    <div class="stat"><div class="num">${totalPlayers}</div><div class="lbl">Zawodnicy</div></div>
    <div class="stat"><div class="num">${totalObs}</div><div class="lbl">Obserwacje</div></div>
    <div class="stat"><div class="num">${totalReports}</div><div class="lbl">Raporty</div></div>
    <div class="stat"><div class="num">${forTransferCount}</div><div class="lbl">Do transferu</div></div>
  </div>
  <div class="grid grid-2">
    <div class="card">
      <h4 style="margin-top:0;color:var(--heading);">Mapa Województw</h4>
      ${polandVoivodeshipMap()}
      <p class="note" style="text-align:center;margin-top:6px;">Liczba klubów w bazie wg województwa</p>
    </div>
    <div class="card">
      <h4 style="margin-top:0;color:var(--heading);">Szybkie akcje</h4>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="gold" data-action="goto-newobs">+ Dodaj obserwację z meczu</button>
        <button class="secondary" data-action="goto-addplayer">+ Dodaj nowego zawodnika</button>
        <button class="secondary" data-action="goto-monitoring">Zobacz listę do re-obserwacji</button>
      </div>
      <p class="note" style="margin-top:14px;">Baza jest wspólna dla całego zespołu scoutów — dane synchronizują się automatycznie.</p>
    </div>
  </div>
  <div class="grid grid-2" style="margin-top:18px;">
    <div class="card">
      <h4 style="margin-top:0;color:var(--heading);">Statystyki obserwacji</h4>
      ${observationsDonut()}
    </div>
    ${bydgoszczDistanceWidget()}
  </div>
  <div style="margin-top:18px;">
    ${leagueQuickAccessPanel()}
  </div>
  <div style="margin-top:18px;">
    <div class="card">
      <h4 style="margin-top:0;color:var(--heading);">Ostatnie obserwacje</h4>
      ${recent.length? recent.map(o=>{
        const pl = DB.players.find(p=>p.id===o.playerId);
        const avg = RATING_KEYS.reduce((a,k)=>a+(Number(o.ratings[k])||0),0)/RATING_KEYS.length;
        // Obserwacja BEZ wskazanego zawodnika to obserwacja całego meczu — świadomy wybór, a nie
        // uszkodzony wpis. Pokazujemy wtedy sam mecz. Napis „(usunięty zawodnik)" sugerował awarię
        // i był po prostu nieprawdziwy: takie obserwacje nigdy nie miały przypisanego zawodnika.
        // Zawodnika naprawdę usuniętego rozpoznajemy po tym, że identyfikator JEST, ale nic mu nie
        // odpowiada — i tylko wtedy trzeba o tym uprzedzić.
        const naglowek = pl ? esc(pl.firstName + " " + pl.lastName)
          : (o.playerId ? '<span style="color:var(--clay-dark);">(zawodnik usunięty z kartoteki)</span>'
                        : esc(o.match || 'Obserwacja meczu'));
        return `<div class="obs-item">
          <strong>${naglowek}</strong>${pl || o.playerId ? ` — <span class="avg-chip">${fmt1(avg)}</span>` : ''}
          <div class="meta">${esc(o.date)}${pl || o.playerId ? ' &middot; ' + esc(o.match) : ''} &middot; scout: ${esc(o.scout)}</div>
        </div>`;
      }).join('') : `<div class="empty">Brak obserwacji — dodaj pierwszą w zakładce „Plan Obserwacji”.</div>`}
    </div>
  </div>
  <div style="margin-top:18px;">
    ${sponsorsPanel()}
  </div>`;
}

// ---------- PLAYERS ----------
let playerFilters = {region:"",league:"",status:"",position:"",search:"",birthYear:"",agent:"",club:""};
function viewPlayers(){
  if(viewingPlayerId) return viewPlayerDetail(viewingPlayerId);

  let list = DB.players.slice();
  if(viewingRocznikGroup){
    const year = viewingRocznikGroup.match(/\d{4}/)[0];
    // Rocznik porównujemy JAKO TEKST. Część ścieżek zapisu wyliczała go z daty urodzenia
    // (new Date(...).getFullYear() — liczba), a import rocznikowy wpisuje tekst z nazwy kategorii.
    // Przy ścisłym === liczbowy 2014 nie równał się tekstowemu "2014": zawodnik znikał z listy
    // rocznika, a ponowny import zakładał go drugi raz, bo nie znajdował istniejącego wpisu.
    list = list.filter(p => String(p.birthYear||'') === year);
  }
  if(playerFilters.region) list = list.filter(p=>clubRegion(p.clubId)===playerFilters.region);
  if(playerFilters.league) list = list.filter(p=>clubLeague(p.clubId)===playerFilters.league);
  if(playerFilters.status) list = list.filter(p=>p.status===playerFilters.status);
  if(playerFilters.position) list = list.filter(p=>p.position===playerFilters.position);
  if(playerFilters.birthYear) list = list.filter(p=>String(p.birthYear||'')===String(playerFilters.birthYear));
  // „Niesprawdzone" to trzeci stan: ani zaznaczonego menedżera, ani śladu, że ktoś to weryfikował.
  if(playerFilters.agent==='tak') list = list.filter(p=>!!p.hasAgent);
  else if(playerFilters.agent==='nie') list = list.filter(p=>!p.hasAgent);
  else if(playerFilters.agent==='niesprawdzone') list = list.filter(p=>!p.hasAgent && !p.agentCheckedAt);
  // Ta sama grupa, którą podświetlamy na żółto — tu do wyfiltrowania na osobną listę.
  else if(playerFilters.agent==='mlodzi-bez') list = list.filter(p=>p.birthYear && isYouthPlayer(p) && !p.hasAgent);
  if(playerFilters.search){
    const q = playerFilters.search.toLowerCase();
    list = list.filter(p=> (p.firstName+" "+p.lastName).toLowerCase().includes(q));
  }
  // Szukanie po klubie — po fragmencie nazwy i bez oglądania się na polskie znaki, żeby „lecz"
  // trafiało w „Górnik Łęczna". Lista lig zawęża do poziomu rozgrywek, a to zawęża do jednego
  // klubu, czego samą listą rozwijaną nie da się zrobić przy kilkuset klubach w bazie.
  if(playerFilters.club){
    const q = importNorm(playerFilters.club);
    list = list.filter(p=> importNorm(clubName(p.clubId)).includes(q));
  }
  // Lista wg alfabetu (nazwisko, potem imię) — nie wg klubu/kolejności importu.
  list.sort((a,b)=> (a.lastName||a.firstName||'').localeCompare(b.lastName||b.firstName||'','pl') || (a.firstName||'').localeCompare(b.firstName||'','pl'));

  const rows = list.map((p, idx)=>{
    const a = playerAvg(p.id);
    const cls = STATUS_CLASS[p.status]||"new";
    // Cały wiersz otwiera profil — tabela jest szeroka i przy węższym ekranie kolumna z przyciskami
    // („Zobacz", „✕") bywa poza kadrem, więc samo kliknięcie w nazwisko musi wystarczyć.
    // Młodzieżowiec BEZ menedżera — wiersz podświetlony na żółto. To jedyne połączenie tych dwóch
    // kolumn, które ma wartość handlową: zawodnik jest młody, a jeszcze nikt go nie reprezentuje.
    // Rocznik bywa pusty, więc wymagamy go wprost — brak rocznika to niewiedza, nie okazja,
    // i podświetlanie takiego wiersza byłoby myleniem jednego z drugim.
    const okazja = p.birthYear && isYouthPlayer(p) && !p.hasAgent;
    return `<tr class="player-row${okazja?' prow-okazja':''}" data-action="row-open-player" data-id="${p.id}" style="cursor:pointer;" title="${okazja?'Młodzieżowiec bez menedżera — ':''}Kliknij, aby otworzyć profil">
      <td><input type="checkbox" class="player-checkbox" data-id="${p.id}"></td>
      <td style="color:var(--ink-soft);font-size:12px;text-align:right;">${idx+1}</td>
      <td>${p.nationality?`<span title="${esc(p.nationality)}">${nationalityFlag(p.nationality)}</span> `:''}<strong>${esc(p.lastName)}</strong> ${esc(p.firstName)}</td>
      <td>${p.birthYear||"—"}${isYouthPlayer(p)?youthBadge():''}</td>
      <td>${esc(p.position)}</td>
      <td><div class="club-cell">${crestImg(clubCrest(p.clubId))}<span>
        <span class="club-name">${esc(clubName(p.clubId))}</span>
        <span class="club-sub">${esc((clubRegion(p.clubId)||'').replace(/\s*ZPN$/,''))}${clubLeague(p.clubId)?' · '+esc((clubLeague(p.clubId)||'').replace(/,\s*gr\./,' gr.')):''}</span>
      </span></div></td>
      <td>${p.status? `<span class="badge ${cls}">${esc(p.status)}</span>` : '—'}</td>
      <td onclick="event.stopPropagation()" style="text-align:center;">${agentToggleHtml(p)}</td>
      <td style="text-align:right;">${p.matches!=null?p.matches:'—'}</td>
      <td style="text-align:right;">${p.minutes!=null?p.minutes:'—'}</td>
      <td style="text-align:right;">${p.goals!=null?p.goals:'—'}</td>
      <td style="text-align:right;">${a? a.count : 0}</td>
      <td style="white-space:nowrap;">
        <button class="link-btn" data-action="add-to-monitoring" data-id="${p.id}" title="${p.monitored?'W Monitoringu — kliknij, aby usunąć':'Dodaj do Monitoringu'}" style="color:${p.monitored?'var(--good)':'var(--gold-dark)'};">${p.monitored?'✓ Monitoring':'+ Monitoring'}</button>
        <button class="link-btn" data-action="delete-player" data-id="${p.id}" title="Usuń zawodnika" style="margin-left:8px;color:var(--clay-dark);">Usuń</button>
      </td>
    </tr>`;
  }).join('');

  return `
  <h2 class="view-title">${viewingRocznikGroup ? esc(viewingRocznikGroup) : 'Zawodnicy'}</h2>
  <p class="view-sub">${viewingRocznikGroup ? 'Zawodnicy z tego rocznika.' : 'Kartoteka wszystkich obserwowanych zawodników.'}
    <span style="display:inline-flex;align-items:center;gap:6px;margin-left:8px;">
      <span style="display:inline-block;width:22px;height:12px;border-radius:3px;background:var(--row-okazja);box-shadow:inset 3px 0 0 var(--gold);"></span>
      młodzieżowiec bez menedżera</span></p>
  ${viewingRocznikGroup ? `<div style="display:flex;gap:8px;margin-bottom:12px;">
    <button class="secondary" data-action="back-rocznik">← Wróć do roczników</button>
    <button class="danger" data-action="delete-rocznik" data-year="${viewingRocznikGroup.match(/\d{4}/)[0]}" title="Usuń wszystkich zawodników z tego rocznika">🗑️ Usuń cały rocznik</button>
  </div>` : ''}
  <div class="toolbar">
    <div class="filters">
      <select id="f-region"><option value="">Wszystkie regiony</option>${DB.settings.regions.map(r=>`<option ${playerFilters.region===r?'selected':''}>${esc(r)}</option>`).join('')}</select>
      <select id="f-league"><option value="">Wszystkie ligi</option>${DB.settings.leagues.map(r=>`<option ${playerFilters.league===r?'selected':''}>${esc(r)}</option>`).join('')}</select>
      <select id="f-position"><option value="">Wszystkie pozycje</option>${DB.settings.positions.map(r=>`<option ${playerFilters.position===r?'selected':''}>${esc(r)}</option>`).join('')}</select>
      <select id="f-status"><option value="">Wszystkie statusy</option>${DB.settings.statuses.map(r=>`<option ${playerFilters.status===r?'selected':''}>${esc(r)}</option>`).join('')}</select>
      <select id="f-agent" title="Filtruj po tym, czy zawodnik ma menedżera">
        <option value="">Menedżer: wszyscy</option>
        <option value="tak" ${playerFilters.agent==='tak'?'selected':''}>Menedżer: Tak</option>
        <option value="nie" ${playerFilters.agent==='nie'?'selected':''}>Menedżer: Nie</option>
        <option value="niesprawdzone" ${playerFilters.agent==='niesprawdzone'?'selected':''}>Menedżer: niesprawdzone</option>
        <option value="mlodzi-bez" ${playerFilters.agent==='mlodzi-bez'?'selected':''}>⭐ Młodzieżowcy bez menedżera</option>
      </select>
      <input id="f-birthyear" type="text" inputmode="numeric" maxlength="4" placeholder="Rocznik np. 2005" value="${esc(playerFilters.birthYear)}" style="max-width:140px;">
      <input id="f-club" placeholder="Szukaj po klubie..." value="${esc(playerFilters.club)}" style="max-width:200px;">
      <input id="f-search" placeholder="Szukaj po nazwisku..." value="${esc(playerFilters.search)}">
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="gold" data-action="add-player">+ Nowy zawodnik</button>
      ${viewingRocznikGroup ? `<button class="gold" data-action="rocznik-excel-import">📋 Wgraj z Excela</button>` : ''}
      <button class="secondary" data-action="agent-import" title="Zbierz menedżerów z profili na Transfermarkcie">🕵 Menedżerowie</button>
      <button class="secondary" data-action="compare-open" title="Zaznacz do 3 zawodników na liście, aby porównać właśnie ich">⚖️ Porównaj zawodników</button>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
      <input type="checkbox" id="select-all-players">
      <span style="font-size:13px;">Zaznacz wszystkie</span>
    </label>
    <button class="danger" id="delete-selected-btn" style="display:none;" data-action="delete-selected-players">🗑️ Usuń zaznaczonych (0)</button>
  </div>
  <p class="note" style="margin:0 0 6px;font-size:11.5px;">Tabela jest szeroka — przewiń ją w bok pod spodem albo przytrzymaj <strong>Shift</strong> i kręć kółkiem myszy. Kolumna akcji zostaje widoczna.</p>
  <div class="card table-scroll" style="padding:0;overflow:auto;">
    <table class="players-table">
      <thead><tr><th style="width:24px;"><input type="checkbox" class="header-checkbox"></th><th style="width:34px;text-align:right;" title="Liczba porządkowa">Lp.</th><th>Zawodnik</th><th>Rocznik</th><th>Pozycja</th><th>Klub / region / liga</th><th>Status</th><th style="text-align:center;" title="Czy zawodnik ma menedżera — kliknij, aby przełączyć Tak/Nie">Agent</th><th style="text-align:right;" title="Rozegrane mecze w sezonie">Mecze</th><th style="text-align:right;" title="Rozegrane minuty w sezonie">Minuty</th><th style="text-align:right;" title="Gole w sezonie">Gole</th><th style="text-align:right;" title="Liczba obserwacji">Obs.</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="13"><div class="empty">Brak zawodników spełniających filtry.</div></td></tr>`}</tbody>
    </table>
  </div>`;
}

// Przełącznik „ma menedżera" wprost na liście — dla agencji to informacja pierwszego rzutu oka,
// więc nie chowamy jej w profilu. Nazwę agencji (jeśli jest) pokazujemy w podpowiedzi.
function agentToggleHtml(p){
  const tak = !!p.hasAgent;
  const tytul = tak
    ? 'Ma menedżera' + (p.agencyName ? ': ' + p.agencyName : '') + ' — kliknij, aby zmienić na „Nie"'
    : 'Bez menedżera — kliknij, aby zmienić na „Tak"';
  return `<button class="link-btn agent-toggle ${tak?'agent-yes':'agent-no'}" data-action="toggle-agent" data-id="${p.id}" title="${esc(tytul)}">${tak?'Tak':'Nie'}</button>`;
}
async function toggleHasAgent(id){
  const p = DB.players.find(x=>x.id===id);
  if(!p) return;
  p.hasAgent = !p.hasAgent;
  // Zdjęcie znacznika kasuje też nazwę agencji — inaczej zostawałaby przy zawodniku
  // opisanym jako „bez menedżera" i przy następnym eksporcie wyglądałaby na aktualną.
  if(!p.hasAgent) p.agencyName = '';
  // Ręczne kliknięcie liczy się jako sprawdzenie — także to na „Nie". Dzięki temu zawodnik
  // znika z kolejki „niesprawdzone", bo ktoś się nim faktycznie zajął.
  p.agentCheckedAt = new Date().toISOString().slice(0,10);
  p.agentSource = 'ręcznie';
  await savePlayers();
  render();
}

function viewPlayerDetail(id){
  const p = DB.players.find(x=>x.id===id);
  if(!p){ viewingPlayerId=null; return viewPlayers(); }
  const a = playerAvg(id);
  const obs = playerObs(id).slice().reverse();
  // Radar rysujemy z ocen w raportach (fazy gry + stałe fragmenty, 1-6). Stary radar z pięciu
  // atrybutów obserwacji zostaje tylko dla zawodników ocenianych, zanim to okno zniknęło.
  const radarChartHtml = (a && a.metryki && a.metryki.length >= 3)
    ? radarRaportow(a.metryki) + `<p class="note" style="flex-basis:100%;margin:2px 0 0;">Skala 1-6 &middot; średnia z ${a.reportCount} ${a.reportCount===1?'raportu':'raportów'} tego zawodnika.</p>`
    : (a && a.avgs) ? radarChart(a.avgs)
    : `<p class="note">Brak ocen — średnia i profil pojawią się po wypełnieniu raportu w zakładce „Raporty".</p>`;

  return `
  <button class="secondary" data-action="back-players" style="margin-bottom:14px;">&larr; Wróć do listy</button>
  <div class="toolbar">
    <div style="display:flex;align-items:center;gap:12px;">
      <label for="player-photo-input" style="cursor:pointer;display:inline-flex;" title="Kliknij, aby wgrać/zmienić zdjęcie">
        ${p.photoUrl ? `<img src="${esc(p.photoUrl)}" class="player-photo-lg" alt="">` : `<span class="player-photo-lg player-photo-ph">${esc(((p.firstName||'')[0]||'')+((p.lastName||'')[0]||'')).toUpperCase()}</span>`}
      </label>
      <input type="file" id="player-photo-input" class="player-photo-input" data-player-id="${p.id}" accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg,application/pdf,.pdf" style="display:none;">
      ${crestImg(clubCrest(p.clubId),'lg')}
      <div>
        <h2 class="view-title" style="margin-bottom:0;">${esc(p.firstName)} ${esc(p.lastName)}</h2>
        <p class="view-sub" style="margin-bottom:0;">${esc(p.birthYear||"")} &middot; ${esc(p.position)} &middot; ${esc(clubName(p.clubId))}${clubSeason(p.clubId)?" ("+esc(clubSeason(p.clubId))+")":""} &middot; ${esc(clubRegion(p.clubId))} / ${esc(clubLeague(p.clubId))}</p>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="secondary" data-action="edit-player" data-id="${p.id}">Edytuj</button>
      ${has90minutLink(p) ? `<button class="secondary" data-action="refresh-stats" data-id="${p.id}" title="Pobierz mecze i bramki z 90minut.pl">🔄 Odśwież statystyki</button>` : ''}
      <button class="gold" data-action="paste-stats" data-id="${p.id}">📊 Wklej statystyki</button>
      <button class="danger" data-action="delete-player" data-id="${p.id}">Usuń</button>
    </div>
  </div>
  <div class="grid grid-2">
    <div class="card">
      <h4 style="margin-top:0;color:var(--heading);">Profil ocen ${a && a.overall!=null? '&middot; średnia '+fmt1(a.overall)+' <span class="note" style="font-weight:400;">(z '+a.reportCount+' rap.)</span>' : ''}</h4>
      ${a && a.avgs? `<div class="gauge-row" style="margin-bottom:14px;">
        ${RATING_KEYS.map(k=>gaugeRing(a.avgs[k], 64, RATING_LABELS[k])).join('')}
      </div>` : ''}
      <div class="radar-wrap">${radarChartHtml}</div>
    </div>
    <div class="card">
      <h4 style="margin-top:0;color:var(--heading);">Informacje</h4>
      <table>
        <tr><td style="color:var(--ink-soft);">Status</td><td>${p.status? `<span class="badge ${STATUS_CLASS[p.status]||'new'}">${esc(p.status)}</span>` : '—'}</td></tr>
        <tr><td style="color:var(--ink-soft);">Narodowość</td><td>${p.nationality? nationalityFlag(p.nationality)+' '+esc(p.nationality) : "—"}</td></tr>
        <tr><td style="color:var(--ink-soft);">Noga</td><td>${esc(p.foot||"—")}</td></tr>
        <tr><td style="color:var(--ink-soft);">Wzrost</td><td>${p.height? p.height+" cm":"—"}</td></tr>
        <tr><td style="color:var(--ink-soft);">System gry</td><td>${p.formation? `<strong>${esc(p.formation)}</strong>`:"—"}</td></tr>
        <tr><td style="color:var(--ink-soft);">Mecze / minuty / gole / asysty</td><td>${(p.matches!=null||p.minutes!=null||p.goals!=null||p.assists!=null) ? `${p.matches!=null?p.matches:'—'} mecze &middot; ${p.minutes!=null?p.minutes:'—'} min &middot; ${p.goals!=null?p.goals:'—'} goli &middot; ${p.assists!=null?p.assists:'—'} asyst` : "—"}${p.statsUpdatedAt?`<div class="note" style="font-size:11px;margin-top:2px;">Mecze i bramki z ${esc(p.statsSource||'90minut.pl')}${p.statsSeason?' (sezon '+esc(p.statsSeason)+')':''}, odświeżone ${esc(String(p.statsUpdatedAt).slice(0,10))}. Minuty i asysty wpisujesz ręcznie.</div>`:''}</td></tr>
        <tr><td style="color:var(--ink-soft);">Kadra wojewódzka</td><td>${p.kadraWojewodzka? '<strong style="color:var(--good);">Tak</strong>' : 'Nie'}</td></tr>
        <tr><td style="color:var(--ink-soft);">Reprezentacja</td><td>${p.reprezentacja? `<strong style="color:var(--good);">Tak</strong>${p.powolania!=null?` &middot; ${p.powolania} ${p.powolania===1?'powołanie':'powołań'}`:''}` : 'Nie'}</td></tr>
        <tr><td style="color:var(--ink-soft);">Instagram</td><td>${p.instagramLink? `<a class="ext-link" href="${esc(p.instagramLink)}" target="_blank" rel="noopener">📷 śledź &rarr;</a>`:"—"}</td></tr>
        <tr><td style="color:var(--ink-soft);">Facebook</td><td>${p.facebookLink? `<a class="ext-link" href="${esc(p.facebookLink)}" target="_blank" rel="noopener">📘 śledź &rarr;</a>`:"—"}</td></tr>
        <tr><td style="color:var(--ink-soft);">Scout odpowiedzialny</td><td>${esc(p.scout||"—")}</td></tr>
        <tr><td style="color:var(--ink-soft);">Data dodania</td><td>${esc(p.dateAdded||"—")}</td></tr>
        <tr><td style="color:var(--ink-soft);">Link wideo</td><td>${p.videoLink? `<a href="${esc(p.videoLink)}" target="_blank" rel="noopener">otwórz</a>`:"—"}</td></tr>
        <tr><td style="color:var(--ink-soft);">mPZPN / 90minut.pl</td><td>${p.lnpLink? `<a class="ext-link" href="${esc(p.lnpLink)}" target="_blank" rel="noopener">profil / statystyki &rarr;</a>`:"—"}</td></tr>
        <tr><td style="color:var(--ink-soft);">Transfermarkt</td><td>${p.tmLink? `<a class="ext-link" href="${esc(p.tmLink)}" target="_blank" rel="noopener">profil &rarr;</a>`:"—"}</td></tr>
        <tr><td style="color:var(--ink-soft);">Menedżer / agent</td><td>${
          p.agencyId && agencyById(p.agencyId)
            ? `<a class="ext-link" href="#" data-action="open-agency" data-id="${p.agencyId}"><strong>${esc(agencyById(p.agencyId).name)}</strong></a>` +
              (p.agentId && agentById(p.agentId) ? `<span class="note" style="display:block;">opiekun: ${esc(agentFullName(agentById(p.agentId)))}${
                agentById(p.agentId).phone ? ' · '+esc(agentById(p.agentId).phone) : ''}${
                agentById(p.agentId).email ? ' · '+esc(agentById(p.agentId).email) : ''}</span>`
                : `<span class="note" style="display:block;">opiekun niewskazany — uzupełnij w zakładce Menedżerowie</span>`)
            : (p.hasAgent ? agencyDisplayHtml(p) : (p.agentCheckedAt ? 'Nie' : '<span class="note">niesprawdzone</span>'))
        }${
          p.agentCheckedAt ? `<span class="note" style="display:block;font-size:11px;">sprawdzone ${esc(p.agentCheckedAt)}${p.agentSource?' — '+esc(p.agentSource):''}</span>` : ''
        }</td></tr>
        <tr><td style="color:var(--ink-soft);">Kontrakt</td><td>${p.hasContract? `<span class="agent-yes">Tak</span>${p.contractUntil?` — do <strong>${esc(p.contractUntil)}</strong>`:''}` : '<span class="agent-no">Nie</span>'}</td></tr>
      </table>
      ${p.notes? `<p style="margin-top:10px;font-size:13px;">${esc(p.notes)}</p>`:''}
    </div>
  </div>
  <div class="card">
    <div class="toolbar" style="margin-bottom:8px;">
      <h4 style="margin:0;color:var(--heading);">Załączniki</h4>
      <button class="link-btn" data-action="manage-attachments" data-id="${p.id}" style="color:var(--gold-dark);">Zarządzaj załącznikami</button>
    </div>
    ${p.attachments && p.attachments.length? `
      <div class="attach-grid">
        ${p.attachments.map(a=>`<div class="attach-card" data-action="manage-attachments" data-id="${p.id}" title="${esc(a.name)}">
          <div class="attach-thumb">${attachmentThumbInner(a)}</div>
          <div class="attach-card-name">📎 ${esc(a.name)}</div>
        </div>`).join('')}
      </div>` : '<div class="empty">Brak załączników — kliknij "Zarządzaj załącznikami", aby dodać plik PDF, JPG lub PNG.</div>'}
  </div>
  <div class="card">
    <div class="toolbar" style="margin-bottom:0;">
      <h4 style="margin:0;color:var(--heading);">Raport zawodnika</h4>
      <button class="secondary" data-action="print-player" data-id="${p.id}">⭳ Pobierz raport PDF</button>
    </div>
    <p class="note" style="margin-top:8px;margin-bottom:0;">Generuje i pobiera gotowy plik PDF — chwilę to potrwa, w zależności od urządzenia.</p>
  </div>
  <div class="card">
    <h4 style="margin-top:0;color:var(--heading);">Historia obserwacji (${obs.length})</h4>
    ${obs.length? obs.map(o=>{
      // Oceny liczbowe przy obserwacji to już tylko dane historyczne (okno "Statystyka" usunięte).
      const hasHistRatings = o.statsFilledIn && o.ratings && RATING_KEYS.some(k=>Number(o.ratings[k])>0);
      const avg = hasHistRatings ? RATING_KEYS.reduce((a2,k)=>a2+(Number(o.ratings[k])||0),0)/RATING_KEYS.length : null;
      return `<div class="obs-item">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>${esc(o.date)} &middot; ${esc(o.match||'—')}</strong>
          ${avg!=null?`<span class="avg-chip">${fmt1(avg)}</span>`:''}
        </div>
        <div class="meta">Scout: ${esc(o.scout)}${hasHistRatings?' &middot; '+RATING_KEYS.map(k=>RATING_LABELS[k]+": "+o.ratings[k]).join(' &middot; '):''}</div>
        ${o.recommendation?`<div class="meta">Rekomendacja: <strong>${esc(o.recommendation)}</strong></div>`:''}
        ${o.notes? `<div style="font-size:12.5px;margin-top:4px;">${esc(o.notes)}</div>`:''}
      </div>`;
    }).join('') : `<div class="empty">Brak obserwacji dla tego zawodnika.</div>`}
  </div>
  <div class="card">
    <h4 style="margin-top:0;color:var(--heading);">⚡ Szybkie statystyki sezonu${
      p.statsSeason ? ` <span class="note" style="font-weight:400;">— ${esc(p.statsSeason)}</span>` : ''}</h4>
    ${(p.przebieg && p.przebieg.length) ? `<div style="margin-bottom:12px;">
      <div class="note" style="margin-bottom:2px;">Minuty w kolejnych meczach${p.przebiegSezon?' — sezon '+esc(p.przebiegSezon):''}:</div>
      <div style="overflow-x:auto;">${wykresMinut(p.przebieg)}</div>
      <div class="note" style="margin-top:2px;">${podsumowanieMinut(p.przebieg)}</div>
    </div>` : ''}
    ${poprzednieSezonyHtml(p)}
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;">
      <div class="field-wrap" style="margin-bottom:8px;"><label class="field">Mecze</label><input type="number" min="0" id="qs-matches" value="${p.matches!=null?p.matches:''}"></div>
      <div class="field-wrap" style="margin-bottom:8px;"><label class="field">Minuty</label><input type="number" min="0" id="qs-minutes" value="${p.minutes!=null?p.minutes:''}"></div>
      <div class="field-wrap" style="margin-bottom:8px;"><label class="field">Gole</label><input type="number" min="0" id="qs-goals" value="${p.goals!=null?p.goals:''}"></div>
      <div class="field-wrap" style="margin-bottom:8px;"><label class="field">Asysty</label><input type="number" min="0" id="qs-assists" value="${p.assists!=null?p.assists:''}"></div>
      <div class="field-wrap" style="margin-bottom:8px;"><label class="field">Żółte kartki</label><input type="number" min="0" id="qs-yellow" value="${p.yellowCards!=null?p.yellowCards:''}"></div>
      <div class="field-wrap" style="margin-bottom:8px;"><label class="field">Czerwone kartki</label><input type="number" min="0" id="qs-red" value="${p.redCards!=null?p.redCards:''}"></div>
    </div>
    <button class="gold" data-action="save-quick-stats" data-id="${p.id}">Zapisz statystyki</button>
    <p class="note" style="margin-top:6px;">Szybka aktualizacja bez otwierania pełnej edycji — wpisz i zapisz.</p>
  </div>
  <div class="card">
    <h4 style="margin-top:0;color:var(--heading);">Profil ocen — radar</h4>
    ${(()=>{ const a = playerAvg(p.id);
      if(a && a.metryki && a.metryki.length >= 3) return `<div style="text-align:center;">${radarRaportow(a.metryki)}</div><p class="note" style="text-align:center;margin-top:6px;">Skala 1-6, średnia z ${a.reportCount} ${a.reportCount===1?'raportu':'raportów'}${a.overall!=null?` &middot; śr. ocena: ${fmt1(a.overall)}`:''}</p>`;
      if(a && a.avgs) return radarSvg([{label:p.lastName, avgs:a.avgs, count:a.count}]) + `<p class="note" style="text-align:center;margin-top:6px;">Radar z historycznych ocen obserwacji (skala 1–10)${a.overall!=null?` &middot; śr. ocena z raportów: ${fmt1(a.overall)}`:''}</p>`;
      return '<div class="empty">Brak ocen — średnia pojawi się po wypełnieniu raportu w zakładce „Raporty".</div>'; })()}
  </div>
  <div class="card">
    <h4 style="margin-top:0;color:var(--heading);">Raporty taktyczne (${playerReports(p.id).length})</h4>
    ${playerReports(p.id).length? playerReports(p.id).map(r=>{
      const phaseAvg = REPORT_PHASES.reduce((a2,f)=>a2+(Number(r.phases[f.key])||0),0)/REPORT_PHASES.length;
      const spAvg = REPORT_SET_PIECES.reduce((a2,f)=>a2+(Number(r.setPieces[f.key])||0),0)/REPORT_SET_PIECES.length;
      return `<div class="obs-item">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <strong>${esc(r.date)} &middot; ${esc(r.scout)}${r.obsType?' &middot; '+esc(r.obsType):''} ${perspektywaBadge(r.perspektywa)}</strong>
          <span style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <span class="avg-chip">fazy ${fmt1(phaseAvg)} / stałe ${fmt1(spAvg)}</span>
            <button class="secondary" data-action="edit-report" data-id="${r.id}" style="padding:4px 10px;font-size:11.5px;">✎ Edytuj</button>
            <button class="secondary" data-action="print-player" data-id="${p.id}" style="padding:4px 10px;font-size:11.5px;">⭳ PDF</button>
          </span>
        </div>
        ${r.description? `<div style="font-size:12.5px;margin-top:4px;">${esc(r.description)}</div>`:''}
        <div class="meta" style="margin-top:6px;font-size:11.5px;">
          ${r.technika?`<div><strong>Technika:</strong> ${esc(r.technika)}</div>`:''}
          ${r.taktyka?`<div><strong>Taktyka:</strong> ${esc(r.taktyka)}</div>`:''}
          ${r.motoryka?`<div><strong>Motoryka:</strong> ${esc(r.motoryka)}</div>`:''}
          ${r.mentalnoscOpis?`<div><strong>Mentalność:</strong> ${esc(r.mentalnoscOpis)}</div>`:''}
          ${r.potencjalOpis?`<div><strong>Potencjał:</strong> ${esc(r.potencjalOpis)}</div>`:''}
        </div>
        <div class="meta" style="margin-top:4px;">${REPORT_PHASES.map(f=>f.label+": "+r.phases[f.key]).join(' &middot; ')}</div>
        <div class="meta">${REPORT_SET_PIECES.map(f=>f.label+": "+r.setPieces[f.key]).join(' &middot; ')}</div>
        ${r.setPieceComment? `<div style="font-size:12px;margin-top:4px;font-style:italic;color:var(--ink-soft);">Stałe fragmenty: ${esc(r.setPieceComment)}</div>`:''}
      </div>`;
    }).join('') : `<div class="empty">Brak raportów taktycznych — dodaj w zakładce "Raporty".</div>`}
  </div>
  <div class="card">
    <div class="toolbar" style="margin-bottom:8px;">
      <h4 style="margin:0;color:var(--heading);">Historia transferowa</h4>
      <button class="link-btn" data-action="manage-transfer-history" data-id="${p.id}" style="color:var(--gold-dark);">Zarządzaj</button>
    </div>
    ${(p.transferHistory && p.transferHistory.length) ? `<table><tbody>
      ${p.transferHistory.slice().sort((a,b)=>(b.from||'').localeCompare(a.from||'')).map(t=>`
        <tr>
          <td style="white-space:nowrap;color:var(--ink-soft);font-size:12px;">${esc(t.from||'—')}</td>
          <td><strong>${esc(t.fromClub||t.club||'—')}</strong> <span style="color:var(--ink-soft);">&rarr;</span> <strong>${esc(t.toClub||'—')}</strong>${t.type?` <span class="badge" style="font-size:10px;">${esc(t.type)}</span>`:''}</td>
          <td style="color:var(--ink-soft);font-size:12px;">${esc(t.fee||'')}</td>
        </tr>`).join('')}
    </tbody></table>` : '<div class="empty">Brak historii transferowej — dodaj wpisy przez „Zarządzaj" (Z klubu → Do klubu, rok, typ transferu).</div>'}
  </div>
  <div class="card">
    <h4 style="margin-top:0;color:var(--heading);">Opis Końcowy</h4>
    <textarea id="opis-koncowy" rows="5" placeholder="Wpisz opis końcowy zawodnika...">${esc(p.opisKoncowy||'')}</textarea>
    <button class="gold" data-action="save-opis" data-id="${p.id}" style="margin-top:8px;">Zapisz opis</button>
  </div>`;
}

function gaugeColor(value){
  if(value>=8) return 'var(--good)'; // score-high (zielony)
  if(value>=5) return 'var(--gold)'; // score-mid (złoty)
  return 'var(--clay)'; // score-low (czerwony)
}
function gaugeRing(value, size, label){
  const s = size || 78;
  const r = (s/2) - 7;
  const cx = s/2, cy = s/2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, (value||0)/10));
  const dashOffset = circumference * (1 - pct);
  const color = gaugeColor(value||0);
  return `<div class="gauge-wrap">
    <div class="gauge-ring" style="width:${s}px;height:${s}px;">
      <svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--chalk-dim)" stroke-width="6"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="6"
          stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}"
          stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
      </svg>
      <div class="gauge-value">${fmt1(value||0)}</div>
    </div>
    ${label? `<div class="gauge-label">${esc(label)}</div>` : ''}
  </div>`;
}

function radarChart(avgs){
  const size=220, cx=size/2, cy=size/2, r=85;
  const n = RATING_KEYS.length;
  const pt = (i,val)=>{
    const ang = -Math.PI/2 + i*(2*Math.PI/n);
    const rad = (val/10)*r;
    return [cx+rad*Math.cos(ang), cy+rad*Math.sin(ang)];
  };
  const gridLevels=[0.25,0.5,0.75,1];
  let grid = gridLevels.map(lvl=>{
    const pts = RATING_KEYS.map((k,i)=>pt(i,lvl*10).join(",")).join(" ");
    return `<polygon points="${pts}" fill="none" stroke="var(--border-strong)" stroke-width="1"/>`;
  }).join('');
  let axes = RATING_KEYS.map((k,i)=>{
    const [x,y] = pt(i,10);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--border-strong)" stroke-width="1"/>`;
  }).join('');
  let dataPts = RATING_KEYS.map((k,i)=>pt(i,avgs[k]).join(",")).join(" ");
  let labels = RATING_KEYS.map((k,i)=>{
    const ang = -Math.PI/2 + i*(2*Math.PI/n);
    const lx = cx+(r+26)*Math.cos(ang), ly = cy+(r+26)*Math.sin(ang);
    return `<text x="${lx}" y="${ly}" font-size="10.5" fill="var(--ink-soft)" text-anchor="middle" font-family="Inter,sans-serif">${RATING_LABELS[k]}</text>`;
  }).join('');
  return `<svg width="${size+60}" height="${size+20}" viewBox="0 0 ${size+60} ${size+20}">
    <g transform="translate(30,0)">
    ${grid}${axes}
    <polygon points="${dataPts}" fill="var(--gold)" fill-opacity="0.35" stroke="var(--gold-dark)" stroke-width="2"/>
    ${labels}
    </g>
  </svg>`;
}

// RADAR Z RAPORTÓW — osiem osi (4 fazy gry + 4 stałe fragmenty), skala 1-6.
// Rysowany w czystym SVG, bez bibliotek: ten sam kod obsługuje ekran i PDF, więc wykres w pobranym
// raporcie wygląda dokładnie tak, jak w profilu. Kolory przyjmujemy parametrem, bo generator PDF
// renderuje wycinek strony przez html2canvas, który nie zna zmiennych CSS spoza wstrzykniętej palety.
function radarRaportow(metryki, opcje){
  const o = opcje || {};
  const R = o.r || 92;                 // promień „szóstki" (maksimum skali)
  // Podpis osi to dwie linijki (nazwa + wartość) ustawione NA ZEWNĄTRZ wykresu, więc ramka SVG
  // musi być wyraźnie większa od samego koła — inaczej „Atak" u góry i „Rożny obr." u dołu
  // zostają ucięte krawędzią obrazka.
  const marginesBok = o.etykiety === false ? 14 : 100;
  const marginesGora = o.etykiety === false ? 14 : 50;
  const w = R*2 + marginesBok*2, h = R*2 + marginesGora*2;
  const cx = w/2, cy = h/2;
  const n = metryki.length;
  const MAX = 6, MIN = 1;
  const kolorSiatka = o.siatka || 'var(--border-strong)';
  const kolorPodpis = o.podpis || 'var(--ink-soft)';
  const kolorPole   = o.pole   || 'var(--gold)';
  const kolorLinia  = o.linia  || 'var(--gold-dark)';

  // Skala zaczyna się od 1 (najniższa możliwa ocena), więc „1" to nie środek wykresu, tylko mały
  // wielokąt wokół niego — inaczej ocena 1 i brak oceny wyglądałyby identycznie.
  const promien = (v)=> (Math.max(MIN, Math.min(MAX, v)) - MIN) / (MAX - MIN) * (R - 14) + 14;
  const kat = (i)=> -Math.PI/2 + i*(2*Math.PI/n);
  const pkt = (i, v)=>{ const a = kat(i), rr = promien(v); return [cx + rr*Math.cos(a), cy + rr*Math.sin(a)]; };
  const wielokat = (v)=> metryki.map((_,i)=> pkt(i, v).map(x=>x.toFixed(1)).join(',')).join(' ');

  const siatka = [2,3,4,5,6].map(lvl=>
    `<polygon points="${wielokat(lvl)}" fill="none" stroke="${kolorSiatka}" stroke-width="${lvl===6?1.4:0.8}"/>`
  ).join('');
  const osie = metryki.map((_,i)=>{
    const [x,y] = pkt(i, MAX);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${kolorSiatka}" stroke-width="0.8"/>`;
  }).join('');
  const dane = metryki.map((m,i)=> pkt(i, m.wartosc).map(x=>x.toFixed(1)).join(',')).join(' ');
  const kropki = metryki.map((m,i)=>{
    const [x,y] = pkt(i, m.wartosc);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="${kolorLinia}"/>`;
  }).join('');
  const podpisy = o.etykiety === false ? '' : metryki.map((m,i)=>{
    const a = kat(i);
    const lx = cx + (R+22)*Math.cos(a), ly = cy + (R+22)*Math.sin(a);
    // Podpis odsuwamy w stronę, w którą „patrzy" oś: na prawej połowie tekst od lewej,
    // na lewej od prawej, na górze i dole wyśrodkowany. Bez tego dłuższe nazwy wchodzą na wykres.
    const cosA = Math.cos(a);
    const anchor = cosA > 0.25 ? 'start' : cosA < -0.25 ? 'end' : 'middle';
    const dy = Math.sin(a) > 0.6 ? 10 : Math.sin(a) < -0.6 ? -3 : 4;
    return `<text x="${lx.toFixed(1)}" y="${(ly+dy).toFixed(1)}" font-size="10.5" font-weight="600" fill="${kolorPodpis}" text-anchor="${anchor}" font-family="Inter,Arial,sans-serif">${esc(m.label)}</text>
      <text x="${lx.toFixed(1)}" y="${(ly+dy+12).toFixed(1)}" font-size="10" fill="${kolorLinia}" text-anchor="${anchor}" font-family="Inter,Arial,sans-serif" font-weight="700">${fmt1(m.wartosc)}</text>`;
  }).join('');

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Profil ocen zawodnika w skali 1-6">
    ${siatka}${osie}
    <polygon points="${dane}" fill="${kolorPole}" fill-opacity="0.32" stroke="${kolorLinia}" stroke-width="2" stroke-linejoin="round"/>
    ${kropki}${podpisy}
  </svg>`;
}

// ---------- CLUBS ----------
function pill(label, active, action, dataAttrs){
  const attrs = Object.entries(dataAttrs||{}).map(([k,v])=>`data-${k}="${esc(v)}"`).join(' ');
  return `<button class="secondary" data-action="${action}" ${attrs} style="border-radius:20px;padding:6px 14px;font-size:12.5px;${active?'background:var(--pitch);color:var(--on-pitch);border-color:var(--pitch);':''}">${esc(label)}</button>`;
}
// Logo poziomu rozgrywek (I liga, II liga...) — wgrywane przez użytkownika (jak herby klubów), bo oficjalne
// logotypy lig (Ekstraklasa, Betclic 1/2/3 liga) to znaki towarowe, których nie pobieramy automatycznie.
// Do czasu wgrania pokazuje się schludny placeholder z inicjałami poziomu.
function leagueLogoImg(topLevel, size){
  const logo = DB.settings.leagueLogos && DB.settings.leagueLogos[topLevel];
  // max-width/max-height (nie width/height sztywne) — logo dowolnych proporcji mieści się w jednolitym
  // "gabarycie" bez rozciągania/spłaszczania.
  if(logo) return `<img src="${esc(logo)}" alt="" style="max-width:${size}px;max-height:${Math.round(size*0.62)}px;object-fit:contain;">`;
  const initials = (topLevel.match(/[A-ZĄĆĘŁŃÓŚŹŻ0-9]/g)||[]).join('').slice(0,3) || topLevel.slice(0,2).toUpperCase();
  return `<span style="width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;background:var(--pitch);color:var(--gold);border-radius:9px;font-weight:800;font-size:${Math.round(size*0.34)}px;">${esc(initials)}</span>`;
}
function viewClubs(){
  if(viewingClubId) return viewClubDetail(viewingClubId);

  // Alfabetycznie, po polsku — kolejność importu nie niesie żadnej informacji, a przy 18 klubach
  // w grupie szukanie wzrokiem konkretnej nazwy w przypadkowej kolejności jest mozolne.
  // localeCompare z 'pl' ustawia Ł po L, a nie na końcu alfabetu, jak zrobiłoby zwykłe porównanie.
  let list = DB.clubs.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','pl'));
  if(clubBrowse.top) list = list.filter(c=>topLevelOf(c.league)===clubBrowse.top);
  if(clubBrowse.group) list = list.filter(c=>c.league===clubBrowse.group);

  const topRow = ['Wszystkie', ...TOP_LEVELS].map(t=>{
    const val = t==='Wszystkie' ? '' : t;
    return pill(t, clubBrowse.top===val, 'browse-top', {val});
  }).join(' ');

  let groupRow = '';
  if(clubBrowse.top==='III liga' || clubBrowse.top==='IV liga' || clubBrowse.top==='Kategorie juniorskie'){
    const allGroups = groupsForTop(clubBrowse.top);
    // Kategorie juniorskie: roczniki (Rocznik 2011-2014) w OSOBNYM rzędzie pod ligami juniorskimi.
    const yearGroups = allGroups.filter(g=>/^Rocznik \d{4}$/.test(g));
    const groups = allGroups.filter(g=>!yearGroups.includes(g));
    const groupPill = (g, i)=>{
      const val = g==='Wszystkie grupy' ? '' : g;
      // Skracaj etykietę tylko dla III/IV ligi; kategorie juniorskie (np. "CLJ U17 (zachodnia)") zostają w całości.
      let label = g;
      if(g.startsWith('III liga, ')) label = g.replace('III liga, ','');
      else if(g.startsWith('IV liga (')) label = g.replace(/^IV liga \(|\)$/g,'');
      if(i > 0) label = i + '. ' + label;   // liczba porządkowa przy każdej grupie (poza "Wszystkie grupy")
      return pill(label, clubBrowse.group===val, 'browse-group', {val});
    };
    groupRow = `<div class="filters" style="margin-top:8px;">` +
      ['Wszystkie grupy', ...groups].map(groupPill).join(' ') + `</div>` +
      (yearGroups.length ? `<div class="filters" style="margin-top:8px;">` +
        yearGroups.map(g=>pill(g, clubBrowse.group===g, 'browse-group', {val:g})).join(' ') + `</div>` : '');
  }

  const rows = list.map(c=>{
    const count = DB.players.filter(p=>p.clubId===c.id).length;
    return `<tr style="cursor:pointer;" data-action="view-club" data-id="${c.id}">
      <td onclick="event.stopPropagation()">
        <label for="quick-crest-${c.id}" style="cursor:pointer;display:inline-flex;" title="Kliknij, aby wgrać/zmienić herb">${crestImg(clubCrest(c.id), null, c.name)}</label>
        <input type="file" id="quick-crest-${c.id}" class="quick-crest-input" data-club-id="${c.id}" accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg,application/pdf,.pdf" style="display:none;">
      </td>
      <td><strong>${esc(c.name)}</strong></td>
      <td>${esc(c.region)}</td>
      <td>${esc(c.league)}${c.season?` <span class="note">(${esc(c.season)})</span>`:''}</td>
      <td>${esc(c.city||"—")}</td>
      <td>${count}</td>
      <td onclick="event.stopPropagation()"><button class="link-btn" data-action="edit-club" data-id="${c.id}">Edytuj</button>
          <button class="link-btn" data-action="delete-club" data-id="${c.id}" style="color:var(--clay-dark);">Usuń</button></td>
    </tr>`;
  }).join('');

  return `
  <h2 class="view-title">Kluby</h2>
  <p class="view-sub">Przeglądaj wg ligi i grupy — jak w strukturze PZPN / mPZPN. Kliknij klub, aby zobaczyć skład na obecny sezon.</p>
  <div class="filters" style="margin-bottom:0;">${topRow}</div>
  ${groupRow}
  <div class="toolbar" style="margin-top:14px;">
    <div class="note">${list.length} ${list.length===1?'klub':'klubów'} w widoku</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <label class="secondary" style="cursor:pointer;padding:9px 16px;border:1px solid #C9C2AB;border-radius:6px;display:inline-flex;align-items:center;" title="Zaznacz wiele plików — dopasuję je do klubów po nazwie pliku">
        ⭱ Wgraj wiele logo <input type="file" id="multi-logo-input" accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg" multiple style="display:none;">
      </label>
      ${clubBrowse.top ? `<button class="secondary" data-action="league-stats" data-league="${esc(clubBrowse.top)}" title="Wklej statystyki wszystkich klubów tej ligi w jednym oknie">⏱ Statystyki ligi</button>` : ''}
      <button class="secondary" data-action="paste-clubs" title="Wklej listę nazw klubów — założę je wszystkie naraz w wybranej grupie">📋 Wklej listę klubów</button>
      <button class="secondary" data-action="merge-duplicates" title="Znajdź kluby wpisane dwa razy pod różnymi nazwami i połącz je w jeden">🧹 Scal duplikaty</button>
      <button class="gold" data-action="add-club">+ Nowy klub</button>
    </div>
  </div>
  <div class="card" style="padding:0;overflow:auto;">
    <table>
      <thead><tr><th>Herb</th><th>Klub</th><th>ZPN / Region</th><th>Liga (aktualna)</th><th>Miasto</th><th>Zawodnicy w bazie</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7"><div class="empty">Brak klubów w tym widoku.</div></td></tr>`}</tbody>
    </table>
  </div>`;
}

// ---------- MINI TABELA: GDZIE KLUB STOI W SWOICH ROZGRYWKACH ----------
//
// Pozycja w tabeli jest pierwszą rzeczą, o którą pyta się przy klubie („z kim gramy i jak im
// idzie"), a dotąd trzeba było po nią wychodzić na 90minut. Bierzemy ją z tego samego źródła,
// co pełne tabele w widoku lig — więc jedno pobranie obsługuje oba miejsca.
//
// Pokazujemy wycinek: dwie drużyny nad i dwie pod, żeby od razu było widać dystans do sąsiadów.
function miniTabelaKlubuHtml(c){
  // Kartoteka trzyma pełną nazwę z grupą („IV liga (kujawsko-pomorska)", „III liga, gr. II"),
  // a adresy na 90minut są zapisane per POZIOM rozgrywek. Bez sprowadzenia do poziomu funkcja
  // nie znajdowała adresu i karta w ogóle się nie pokazywała.
  const etykieta = c.league || '';
  const liga = scheduleUrlsFor(etykieta).length ? etykieta : topLevelOf(etykieta);
  if(!liga || !scheduleUrlsFor(liga).length) return '';

  const ramka = (tresc)=>`<div class="card">
    <h4 style="margin-top:0;color:var(--heading);">Pozycja w tabeli</h4>${tresc}</div>`;

  const stan = tabeleLigowe[liga];
  if(!stan){ pobierzTabeleLigowe(liga); return ramka('<div class="note">Wczytuję tabelę z 90minut…</div>'); }
  if(stan.stan === 'ladowanie') return ramka('<div class="note">Wczytuję tabelę z 90minut…</div>');
  if(stan.stan === 'blad') return ramka(`<div class="note">Nie udało się pobrać tabeli: ${esc(stan.blad||'')}</div>`);

  // Nazwy po obu stronach bywają zapisane inaczej („KP Wda Świecie" kontra „Wda Świecie"),
  // więc dopuszczamy zawieranie — ale dopiero od pięciu znaków, żeby krótka nazwa nie sklejała
  // się z pierwszym lepszym klubem.
  const nk = szukajNorm(c.name).replace(/[^a-z0-9]/g,'');
  const toSam = (nazwa)=>{
    const x = szukajNorm(nazwa).replace(/[^a-z0-9]/g,'');
    return x === nk || (x.length >= 5 && nk.length >= 5 && (x.includes(nk) || nk.includes(x)));
  };
  let grupa = null, idx = -1;
  for(const g of (stan.grupy||[])){
    const i = (g.wiersze||[]).findIndex(w=> toSam(w.nazwa));
    if(i >= 0){ grupa = g; idx = i; break; }
  }
  if(!grupa) return ramka(`<div class="note">Nie znalazłem tego klubu w tabelach rozgrywek „${esc(etykieta || liga)}".
    Sprawdź, czy nazwa i liga w kartotece zgadzają się z zapisem na 90minut.</div>`);

  const wiersze = grupa.wiersze;
  const nasz = wiersze[idx];
  const od = Math.max(0, idx - 2), dokad = Math.min(wiersze.length, idx + 3);
  const wycinek = wiersze.slice(od, dokad);

  return ramka(`
    <p class="note" style="margin:-2px 0 10px;">${esc(grupa.nazwa||liga)} · <strong>${nasz.miejsce}. miejsce</strong>
      z ${wiersze.length} · ${nasz.punkty} pkt po ${nasz.mecze} ${nasz.mecze===1?'meczu':'meczach'} · źródło: 90minut.pl</p>
    <div class="tabela-przewijana"><table>
      <thead><tr><th style="width:34px;">Lp</th><th>Klub</th><th style="width:44px;">M</th><th style="width:44px;">Pkt</th><th style="width:70px;">Bramki</th></tr></thead>
      <tbody>${wycinek.map(w=>{
        const nasza = toSam(w.nazwa);
        return `<tr${nasza?' style="background:var(--card-warm);font-weight:600;"':''}>
          <td>${w.miejsce}</td><td>${esc(w.nazwa)}</td><td>${w.mecze}</td><td>${w.punkty}</td><td>${esc(w.bramki||'—')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`);
}

function viewClubDetail(id){
  const c = DB.clubs.find(x=>x.id===id);
  if(!c){ viewingClubId=null; return viewClubs(); }
  const squad = DB.players.filter(p=>p.clubId===id).sort((a,b)=>(a.lastName||a.firstName||'').localeCompare(b.lastName||b.firstName||'','pl'));
  const squadRows = squad.map(p=>{
    const a = playerAvg(p.id);
    // Wiersz otwiera profil — tak samo jak na liście Zawodników, żeby podgląd działał wszędzie
    // jednakowo, a nie tylko przez mały odnośnik „Zobacz" na końcu wiersza.
    return `<tr class="player-row" data-action="row-open-player" data-id="${p.id}" style="cursor:pointer;" title="Kliknij, aby otworzyć profil">
      <td onclick="event.stopPropagation()"><input type="checkbox" class="squad-player-check" data-id="${p.id}"></td>
      <td>${p.nationality?`<span title="${esc(p.nationality)}">${nationalityFlag(p.nationality)}</span> `:''}<strong>${esc(p.lastName)}</strong> ${esc(p.firstName)}</td>
      <td>${p.birthYear||"—"}${isYouthPlayer(p)?youthBadge():''}</td>
      <td>${esc(p.position)}</td>
      <td>${p.status? `<span class="badge ${STATUS_CLASS[p.status]||'new'}">${esc(p.status)}</span>` : '—'}</td>
      <td style="text-align:right;">${p.matches!=null?p.matches:'—'}</td>
      <td style="text-align:right;">${p.minutes!=null?p.minutes:'—'}</td>
      <td style="text-align:right;">${p.goals!=null?p.goals:'—'}</td>
      <td style="text-align:right;white-space:nowrap;">${cardsCell(p)}</td>
      <td>${fmtAvg(a)}</td>
      <td style="white-space:nowrap;">
        <button class="link-btn" data-action="add-to-monitoring" data-id="${p.id}" style="color:var(--gold-dark);">${p.monitored?'✓ Monitoring':'+ Monitoring'}</button>
        <button class="link-btn" data-action="view-player" data-id="${p.id}" style="margin-left:10px;">Zobacz</button>
      </td>
    </tr>`;
  }).join('');

  return `
  <button class="secondary" data-action="back-clubs" style="margin-bottom:14px;">&larr; Wróć do listy klubów</button>
  <div class="toolbar">
    <div style="display:flex;align-items:center;gap:14px;">
      ${crestImg(clubCrest(c.id),'lg',c.name)}
      <div>
        <h2 class="view-title" style="margin-bottom:0;">${esc(c.name)}</h2>
        <p class="view-sub" style="margin-bottom:0;">${esc(c.league)}${c.season?" · sezon "+esc(c.season):""} &middot; ${esc(c.region)} &middot; ${esc(c.city||"—")}</p>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="gold" data-action="import-squad" data-id="${c.id}">📋 Import składu</button>
      <button class="gold" data-action="stats-90minut" data-id="${c.id}" title="Pobierz z 90minut mecze, minuty, bramki i kartki całego składu — bez kopiowania czegokolwiek">⏱ Statystyki z 90minut</button>
      <button class="secondary" data-action="import-squad-stats" data-id="${c.id}" title="Zapasowa droga: ręczna wklejka z Transfermarktu. Dla polskich lig użyj przycisku obok.">📋 Wklejka z Transfermarktu</button>
      <button class="secondary" data-action="edit-club" data-id="${c.id}">Edytuj klub</button>
      <button class="danger" data-action="delete-club" data-id="${c.id}">Usuń</button>
    </div>
  </div>
  <div class="card">
    <h4 style="margin-top:0;color:var(--heading);">Pełny oficjalny skład</h4>
    <p class="note" style="margin-bottom:10px;">Nie pobieramy automatycznie składów z zewnętrznych serwisów — poniżej znajdziesz bezpośrednie linki do sprawdzenia pełnej, aktualnej listy zawodników na sezon ${esc(c.season||'bieżący')}.</p>
    <div style="display:flex;gap:18px;flex-wrap:wrap;">
      ${c.profileLnp? `<a class="ext-link" href="${esc(c.profileLnp)}" target="_blank" rel="noopener">90minut.pl / Łączy Nas Piłka &rarr;</a>` : `<span class="note">Brak linku do 90minut.pl — dodaj w edycji klubu</span>`}
      ${c.profileTm? `<a class="ext-link" href="${esc(c.profileTm)}" target="_blank" rel="noopener">Transfermarkt &rarr;</a>` : `<span class="note">Brak linku do Transfermarkt — dodaj w edycji klubu</span>`}
    </div>
  </div>
  ${miniTabelaKlubuHtml(c)}
  <div class="card">
    <div class="toolbar" style="margin-bottom:8px;">
      <h4 style="margin:0;color:var(--heading);">Zawodnicy scoutowani w tym klubie (${squad.length})</h4>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="secondary" id="squad-reset-stats-btn" style="display:none;" data-action="reset-squad-stats" data-club="${c.id}" title="Czyści dorobek bieżącego sezonu, żeby wczytać go od nowa. Archiwum poprzednich sezonów zostaje.">↺ Wyzeruj statystyki (0)</button>
        <button class="danger" id="squad-delete-btn" style="display:none;" data-action="delete-squad-selected" data-club="${c.id}">🗑️ Usuń zaznaczonych (0)</button>
        <button class="gold" data-action="add-player-to-club" data-id="${c.id}">+ Dodaj zawodnika do tego klubu</button>
      </div>
    </div>
    <table>
      <thead><tr><th style="width:24px;"><input type="checkbox" id="squad-select-all" title="Zaznacz wszystkich"></th><th>Zawodnik</th><th>Rocznik</th><th>Pozycja</th><th>Status</th><th style="text-align:right;" title="Rozegrane mecze w sezonie">Mecze</th><th style="text-align:right;" title="Rozegrane minuty w sezonie">Min</th><th style="text-align:right;" title="Gole w sezonie">Gole</th><th style="text-align:right;" title="Kartki żółte / czerwone">Kartki</th><th>Śr. ocena</th><th></th></tr></thead>
      <tbody>${squadRows || `<tr><td colspan="11"><div class="empty">Jeszcze nikogo tu nie scoutujecie — pełny skład sprawdzisz w linkach powyżej.</div></td></tr>`}</tbody>
    </table>
  </div>`;
}

// ---------- NEW OBSERVATION ----------
// Rodzaje obserwacji z przypisanym kolorem — ten sam kolor niesie się do kalendarza i listy,
// żeby po samym rzucie oka było widać, co jest wyjazdem, a co oglądaniem zdalnym.
const OBS_TYPES = [
  { id:'live',   label:'Live',   color:'var(--good)' },
  { id:'online', label:'Online', color:'#2F6FA8' },
  { id:'video',  label:'Video',  color:'#8B5CF6' },
];
const obsTypeOf = (o)=> (o && o.obsType) || 'live';
const obsTypeMeta = (id)=> OBS_TYPES.find(t=>t.id===id) || OBS_TYPES[0];

// Adresy stadionów zapamiętujemy PRZY KLUBIE, żeby przy kolejnej obserwacji tego gospodarza
// podstawiły się same. Trzymamy je w ustawieniach (zwykły JSON), więc nie wymaga to zmian w bazie.
function clubIdByName(name){
  const n = importNorm(name);
  if(!n) return null;
  const c = DB.clubs.find(c=> importNorm(c.name) === n)
    || DB.clubs.find(c=> importNorm(c.name).includes(n) || n.includes(importNorm(c.name)));
  return c ? c.id : null;
}
function stadiumAddressFor(clubName){
  const id = clubIdByName(clubName);
  if(!id) return '';
  const map = DB.settings.stadiumAddresses || {};
  return map[id] || '';
}
// Gospodarz z pola "Mecz" — część przed myślnikiem. Kluby bywają wpisywane z różnymi kreskami
// (zwykły dywiz, półpauza, pauza), więc rozdzielamy po każdej z nich.
function hostFromMatch(matchText){
  return String(matchText||'').split(/\s+[-–—]\s+/)[0].trim();
}
// Adres obiektu należy do KLUBU, nie do pojedynczej osoby, dlatego trzymamy jeden adres na klub
// (w ustawieniach) i pokazujemy go w Kontaktach. Gdyby siedział w wierszu kontaktu, klub z kilkoma
// osobami miałby kilka kopii adresu, które od razu zaczęłyby się rozjeżdżać.
function contactClubName(c){ return String((c && (c.club || c.name)) || '').trim(); }
function contactAddress(c){
  const id = clubIdByName(contactClubName(c));
  if(!id) return '';
  return (DB.settings.stadiumAddresses || {})[id] || '';
}
// Zapis adresu wpisanego wprost w Kontaktach. Bez klubu w bazie nie ma do czego go przypiąć —
// zgłaszamy to, zamiast po cichu gubić wpisaną treść.
async function setClubAddressByName(clubNazwa, adres){
  const id = clubIdByName(clubNazwa);
  if(!id) return false;
  if(!DB.settings.stadiumAddresses) DB.settings.stadiumAddresses = {};
  const czysty = String(adres||'').trim();
  if(czysty) DB.settings.stadiumAddresses[id] = czysty;
  else delete DB.settings.stadiumAddresses[id];
  await saveSettings();
  return true;
}
// Zapamiętanie adresu po zapisaniu planu obserwacji. Robi trzy rzeczy naraz:
// 1. zakłada klub, jeśli gospodarza jeszcze nie ma w bazie (sama nazwa — resztę uzupełniasz ręcznie),
// 2. zapisuje adres przy tym klubie, żeby przy następnym meczu podstawił się sam,
// 3. dopisuje pusty wiersz w Kontaktach, żeby adres miał się gdzie pokazać.
// Ligi, regionu ani miasta NIE zgadujemy — formularz obserwacji ich nie zawiera, a wpisanie
// czegokolwiek "na oko" byłoby gorsze niż puste pole, które od razu widać na liście klubów.
async function rememberStadiumAddress(matchText, address){
  const adres = String(address||'').trim();
  const gospodarz = hostFromMatch(matchText);
  if(!adres || !gospodarz) return null;

  let clubId = clubIdByName(gospodarz);
  let utworzonoKlub = false;
  if(!clubId){
    const nowy = {
      id: uid('K'), name: gospodarz, region: '', league: '', season: '',
      city: '', crestUrl: '', juniorCategories: '', profileLnp: '', profileTm: ''
    };
    DB.clubs.push(nowy);
    await saveClubs();
    clubId = nowy.id;
    utworzonoKlub = true;
  }
  const klubNazwa = (DB.clubs.find(c=>c.id===clubId) || {}).name || gospodarz;

  if(!DB.settings.stadiumAddresses) DB.settings.stadiumAddresses = {};
  if(DB.settings.stadiumAddresses[clubId] !== adres){
    DB.settings.stadiumAddresses[clubId] = adres;
    await saveSettings();
  }

  const klucz = importNorm(klubNazwa);
  const maKontakt = DB.contacts.some(c=> importNorm(contactClubName(c)) === klucz);
  let utworzonoKontakt = false;
  if(!maKontakt){
    DB.contacts.push({
      id: uid('C'), club: klubNazwa, email: '', firstName: '', lastName: '',
      phone: '', note: '', dateAdded: new Date().toISOString().slice(0,10)
    });
    await saveContacts();
    utworzonoKontakt = true;
  }
  return {clubId, klubNazwa, utworzonoKlub, utworzonoKontakt};
}

// Wybrany rodzaj w formularzu trzymamy w stanie modułu (jak obsCalendarSelectedDay) i przerysowujemy
// widok po kliknięciu. Ustawianie stylów bezpośrednio na przyciskach bywało gubione przy
// przerysowaniach formularza, przez co zaznaczenie wracało do domyślnego.
let newObsType = OBS_TYPES[0].id;
let obsCalendarDate = new Date();
let obsCalendarSelectedDay = null;

function viewNewObs(){
  const editing = editingObsId ? DB.observations.find(o=>o.id===editingObsId) : null;
  // Pierwsza pozycja celowo PUSTA: wybór meczu z terminarza ma dawać obserwację zespołu, a nie
  // podstawiać przypadkowego zawodnika z góry listy. Zawodnika wskazujesz sam, gdy chcesz.
  const aktywnyTyp = editing ? (editing.obsType || OBS_TYPES[0].id) : newObsType;
  const wybranyZawodnik = editing ? (editing.playerId||'') : (obsPreselectPlayerId||'');
  const playerOptions = `<option value="" ${wybranyZawodnik?'':'selected'}>— obserwacja zespołu (bez wskazania zawodnika) —</option>` +
    DB.players.slice().sort((a,b)=>(a.lastName||a.firstName||'').localeCompare(b.lastName||b.firstName||'','pl'))
    .map(p=>`<option value="${p.id}" ${wybranyZawodnik===p.id?'selected':''}>${esc(p.lastName)} ${esc(p.firstName)} — ${esc(clubName(p.clubId))}</option>`).join('');
  const scoutOptions = DB.settings.scouts.map(s=>`<option value="${esc(s)}" ${s===(editing?editing.scout:currentScout)?'selected':''}>${esc(s)}</option>`).join('');
  obsPreselectPlayerId = null; // jednorazowa preselekcja — po wyrenderowaniu formularza wraca do normalnego wyboru

  return `
  <h2 class="view-title">Plan Obserwacji ${editing? '<span style="font-size:14px;color:var(--gold-dark);font-family:Inter,sans-serif;">— edycja obserwacji</span>':''}</h2>
  <p class="view-sub">Zaplanuj, kogo i kiedy obserwujesz — szczegółową ocenę wpiszesz później, klikając zaplanowaną pozycję na liście poniżej.</p>
  <div class="grid grid-2">
    <div class="card" style="${editing?'border:1px solid var(--gold);':''}">
      <h4 style="margin-top:0;color:var(--heading);">${editing? 'Edytuj plan' : 'Nowy plan'}</h4>
      <div class="field-wrap">
        <label class="field">Zawodnik</label>
        <select id="obs-player">${playerOptions || '<option value="">Brak zawodników — dodaj najpierw w zakładce Zawodnicy</option>'}</select>
      </div>
      <div class="grid grid-2">
        <div class="field-wrap"><label class="field">Data meczu</label><input type="date" id="obs-date" value="${editing? esc(editing.date) : new Date().toISOString().slice(0,10)}"></div>
        <div class="field-wrap"><label class="field">Godzina meczu</label><input type="time" id="obs-time" value="${editing? esc(editing.matchTime||'15:00') : '15:00'}"></div>
      </div>
      <div class="field-wrap">
        <label class="field">Scout</label>
        <select id="obs-scout-select">
          ${scoutOptions}
          <option value="__new__">➕ Nowy scout...</option>
        </select>
        <input id="obs-scout-new" placeholder="Imię i nazwisko nowego scouta" style="display:${DB.settings.scouts.length?'none':'block'};margin-top:6px;" value="${DB.settings.scouts.length?'':esc(editing?editing.scout||'':currentScout)}">
      </div>
      <div class="field-wrap">
        <label class="field">Rodzaj obserwacji</label>
        <div class="obs-type-picker">
          ${OBS_TYPES.map(t=>{
            // Kolor ustawiamy wprost w stylu elementu — ogólniejsze reguły dla <button> potrafiły
            // przykryć regułę opartą na klasie i zaznaczenie nie było widać.
            const styl = aktywnyTyp === t.id
              ? `background:${t.color};border-color:${t.color};color:var(--card);`
              : `background:var(--card);border-color:var(--border-strong);color:var(--ink-soft);`;
            return `<button type="button" class="obs-type-btn" data-action="pick-obs-type" data-type="${t.id}" style="${styl}">${t.label}</button>`;
          }).join('')}
        </div>
        <input type="hidden" id="obs-type" value="${esc(aktywnyTyp)}">
      </div>
      <div class="field-wrap">
        <label class="field">Mecz (gospodarz - gość)</label>
        <div style="display:flex;gap:8px;">
          <input id="obs-match" placeholder="np. Mazovia Przykładowo - Rywal FC" style="flex:1;" value="${editing? esc(editing.match||'') : ''}">
          <button type="button" class="gold" data-action="open-match-schedule" style="white-space:nowrap;">📅 Terminarz</button>
        </div>
      </div>
      <div class="field-wrap" style="position:relative;">
        <label class="field">Punkt startowy (miejscowość)</label>
        <input id="obs-start" autocomplete="off" placeholder="np. Świdnik" value="${editing? esc(editing.startLocation||DB.settings.startLocation||'Bydgoszcz') : esc(DB.settings.startLocation || 'Bydgoszcz')}">
        <div class="addr-suggestions" id="obs-start-suggestions"></div>
      </div>
      <div class="field-wrap" style="position:relative;">
        <label class="field">Miejsce (adres obiektu)</label>
        <div style="display:flex;gap:8px;">
          <input id="obs-location" autocomplete="off" placeholder="np. ul. Sportowa 5, Pruszków" style="flex:1;" value="${editing? esc(editing.location||'') : ''}">
          <button type="button" class="secondary" data-action="open-obs-location-map" style="white-space:nowrap;">📍 Mapa</button>
        </div>
        <div class="addr-suggestions" id="obs-location-suggestions"></div>
        <div id="obs-distance-info" class="note" style="margin-top:6px;min-height:16px;"></div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start;">
        <button class="gold" data-action="save-obs">${editing? 'Zapisz zmiany' : 'Zapisz plan'}</button>
        ${editing? '<button class="secondary" data-action="cancel-edit-obs">Anuluj edycję</button>' : ''}
      </div>
    </div>
    <div class="card">
      <h4 style="margin-top:0;color:var(--heading);">Kalendarz</h4>
      ${obsCalendarHtml()}
    </div>
  </div>

  <h3 style="margin-top:24px;color:var(--heading);font-family:'Barlow Condensed',sans-serif;">Zaplanowane i obserwowane w ${monthNamePl(obsCalendarDate.getMonth())} ${obsCalendarDate.getFullYear()}</h3>
  <div class="card">${obsMonthListHtml()}</div>`;
}

function monthNamePl(m){
  return ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'][m];
}

function obsMonthListHtml(){
  const y = obsCalendarDate.getFullYear(), m = obsCalendarDate.getMonth();
  const monthObs = DB.observations.filter(o=>{
    const d = new Date(o.date+'T00:00:00');
    return d.getFullYear()===y && d.getMonth()===m;
  }).sort((a,b)=> (a.date+'T'+(a.matchTime||'00:00')).localeCompare(b.date+'T'+(b.matchTime||'00:00')));

  if(!monthObs.length) return '<div class="empty">Brak zaplanowanych ani zrealizowanych obserwacji w tym miesiącu.</div>';

  // Kliknięcie pozycji NIE otwiera już okna ocen (usunięte na życzenie — ocena powstaje w Raporcie).
  // "✎ Edytuj" otwiera formularz edycji planu obserwacji (ten sam co "Nowy plan").
  return monthObs.map((o,i)=>{
    const pl = DB.players.find(p=>p.id===o.playerId);
    return `<div class="obs-item">
      <div class="toolbar" style="margin-bottom:2px;">
        <strong>${i+1}. ${pl ? esc(pl.firstName+' '+pl.lastName) : esc(o.match || 'Obserwacja meczu')}</strong>
        <span style="display:flex;align-items:center;gap:8px;">
          <span class="obs-type-tag" style="background:${obsTypeMeta(obsTypeOf(o)).color};">${esc(obsTypeMeta(obsTypeOf(o)).label)}</span>
          <span class="meta">${esc(o.date)}${o.matchTime?' &middot; '+esc(o.matchTime):''}</span>
          <button class="link-btn" data-action="obs-sklad" data-id="${o.id}" style="font-size:11px;" title="Składy obu drużyn i zaznaczanie zawodników wyróżniających się">👥 Skład${liczbaWyroznionych(o)?' ('+liczbaWyroznionych(o)+')':''}</button>
          <button class="link-btn" data-action="edit-obs" data-id="${o.id}" style="font-size:11px;">✎ Edytuj</button>
          <button class="link-btn" data-action="delete-obs" data-id="${o.id}" style="font-size:11px;color:var(--clay-dark);">Usuń</button>
        </span>
      </div>
      <div class="meta">${pl ? esc(o.match||'brak danych meczu') : '<em>obserwacja całego meczu</em>'}${o.location?' &middot; 📍 '+esc(o.location):''} &middot; scout: ${esc(o.scout)}</div>
    </div>`;
  }).join('');
}

function obsCalendarHtml(){
  const y = obsCalendarDate.getFullYear(), m = obsCalendarDate.getMonth();
  const firstOfMonth = new Date(y, m, 1);
  const startWeekday = (firstOfMonth.getDay()+6)%7; // poniedziałek=0
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0,10);

  const obsByDay = {};
  DB.observations.forEach(o=>{
    const d = new Date(o.date+'T00:00:00');
    if(d.getFullYear()===y && d.getMonth()===m){
      const day = d.getDate();
      (obsByDay[day] = obsByDay[day] || []).push(o);
    }
  });

  let cells = '';
  for(let i=0;i<startWeekday;i++) cells += `<div class="cal-cell cal-empty"></div>`;
  for(let day=1; day<=daysInMonth; day++){
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayObs = obsByDay[day] || [];
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === obsCalendarSelectedDay;
    // Kropka w kolorze rodzaju obserwacji. Gdy w jednym dniu są oba rodzaje, pokazujemy dwie —
    // liczba sama w sobie nie powiedziałaby, czy trzeba gdzieś jechać.
    const wgTypu = {};
    dayObs.forEach(o=>{ const t = obsTypeOf(o); wgTypu[t] = (wgTypu[t]||0)+1; });
    const kropki = Object.keys(wgTypu)
      .sort((a,b)=> OBS_TYPES.findIndex(t=>t.id===a) - OBS_TYPES.findIndex(t=>t.id===b))
      .map(t=>{
        const meta = obsTypeMeta(t);
        return `<span class="cal-dot" style="background:${meta.color};" title="${esc(meta.label)}: ${wgTypu[t]}">${wgTypu[t]}</span>`;
      }).join('');
    cells += `<div class="cal-cell ${isToday?'cal-today':''} ${isSelected?'cal-selected':''} ${dayObs.length?'cal-has-obs':''}" data-date="${dateStr}">
      <span class="cal-daynum">${day}</span>
      ${dayObs.length? `<span class="cal-dots">${kropki}</span>` : ''}
    </div>`;
  }

  const selectedObs = obsCalendarSelectedDay ? DB.observations.filter(o=>o.date===obsCalendarSelectedDay) : [];

  return `
  <div class="cal-header">
    <button type="button" class="link-btn" data-action="cal-prev-month">← poprzedni</button>
    <strong>${monthNamePl(m)} ${y}</strong>
    <button type="button" class="link-btn" data-action="cal-next-month">następny →</button>
  </div>
  <div class="cal-grid cal-grid-header">
    ${['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(d=>`<div class="cal-cell cal-weekday">${d}</div>`).join('')}
  </div>
  <div class="cal-grid">${cells}</div>
  ${obsCalendarSelectedDay ? `
  <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px;">
    <strong style="font-size:13px;color:var(--heading);">${esc(obsCalendarSelectedDay)}</strong>
    ${selectedObs.length ? selectedObs.map(o=>{
      const pl = DB.players.find(p=>p.id===o.playerId);
      return `<div class="obs-item" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span>${pl ? `<strong>${esc(pl.firstName+' '+pl.lastName)}</strong> — ${esc(o.match||'brak danych meczu')}`
          : `<strong>${esc(o.match || 'Obserwacja meczu')}</strong>`} <span class="meta">(${esc(o.scout)})</span></span>
        <span style="flex-shrink:0;white-space:nowrap;">
          <button class="link-btn" data-action="edit-obs" data-id="${o.id}" style="font-size:11px;">✎</button>
          <button class="link-btn" data-action="delete-obs" data-id="${o.id}" style="font-size:11px;color:var(--clay-dark);">✕</button>
        </span>
      </div>`;
    }).join('') : '<div class="empty">Brak obserwacji tego dnia.</div>'}
  </div>` : ''}`;
}


function openObsLocationMap(){
  const loc = document.getElementById('obs-location');
  const addr = loc ? loc.value.trim() : '';
  if(!addr){ alert('Najpierw wpisz adres obiektu.'); return; }
  window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr), '_blank', 'noopener,noreferrer');
}
function calShiftMonth(delta){
  obsCalendarDate = new Date(obsCalendarDate.getFullYear(), obsCalendarDate.getMonth()+delta, 1);
  render();
}
function calSelectDay(dateStr){
  obsCalendarSelectedDay = (obsCalendarSelectedDay === dateStr) ? null : dateStr;
  render();
}

async function saveNewObservation(){
  // Pusty zawodnik jest DOZWOLONY — to obserwacja całego zespołu. Wymagamy wtedy podania meczu,
  // inaczej wpis nie niósłby żadnej informacji o tym, co obserwujemy.
  const playerId = document.getElementById('obs-player').value;
  if(!playerId && !document.getElementById('obs-match').value.trim()){
    alert('Wybierz zawodnika albo wpisz mecz — obserwacja musi wskazywać, co obserwujesz.');
    return;
  }
  const scoutSelectEl = document.getElementById('obs-scout-select');
  const scoutNewEl = document.getElementById('obs-scout-new');
  let scout = '';
  if(scoutSelectEl && scoutSelectEl.value === '__new__'){
    scout = scoutNewEl ? scoutNewEl.value.trim() : '';
  } else if(scoutSelectEl){
    scout = scoutSelectEl.value;
  }
  if(!scout) scout = currentScout || 'Nieznany';
  const editing = editingObsId ? DB.observations.find(o=>o.id===editingObsId) : null;
  const planFields = {
    playerId,
    date: document.getElementById('obs-date').value,
    matchTime: document.getElementById('obs-time').value,
    match: document.getElementById('obs-match').value.trim(),
    location: document.getElementById('obs-location').value.trim(),
    obsType: (document.getElementById('obs-type')||{}).value || OBS_TYPES[0].id,
    scout,
  };
  // Przy edycji nadpisujemy TYLKO pola planu — ewentualne historyczne oceny/notatki zostają nietknięte.
  const obs = editing ? Object.assign(editing, planFields) : Object.assign({
    id: uid('O'),
    // Obserwacja to wyłącznie plan/odbycie wizyty — ocena zawodnika powstaje w zakładce Raporty.
    ratings: {},
    recommendation: '',
    notes: '',
    statsFilledIn: false
  }, planFields);
  // Dystans w linii prostej: punkt startowy -> miejsce obserwacji (geokodowanie + fallback).
  // Zasila sumę na dashboardzie ("Dystans obserwacji"). Zapamiętujemy też start jako domyślny.
  const startEl = document.getElementById('obs-start');
  const startLoc = startEl ? startEl.value.trim() : (DB.settings.startLocation || 'Bydgoszcz');
  obs.startLocation = startLoc;
  try{ obs.distanceKm = await calcDistanceBetween(startLoc, obs.location); }catch(e){ obs.distanceKm = null; }
  if(!editing) DB.observations.push(obs);
  // Wynik zapisu MUSI być sprawdzony. Wcześniej szedł bez kontroli, więc gdy baza odrzucała
  // zapis, plan znikał po cichu: na ekranie wyglądał na zapisany, a w bazie go nie było.
  const zapisano = await saveObservations();
  if(!zapisano){
    if(!editing) DB.observations = DB.observations.filter(x=>x.id !== obs.id);   // nie udawaj, że jest
    alert('NIE ZAPISANO planu obserwacji — baza odrzuciła zapis.\n\n' +
      'Plan nie został dodany. Sprawdź baner u góry strony i spróbuj ponownie; jeśli błąd wraca, zgłoś go.');
    render();
    return;
  }
  // Adres obiektu zapamiętujemy przy klubie-gospodarzu — przy następnym meczu tej drużyny
  // podstawi się sam — i pokazujemy go w Kontaktach. Gdy gospodarza nie ma jeszcze w bazie,
  // zakładany jest klub z samą nazwą; mówimy o tym wprost, bo trzeba mu dopisać ligę i region.
  const zapamietane = await rememberStadiumAddress(obs.match, obs.location);
  if(zapamietane && (zapamietane.utworzonoKlub || zapamietane.utworzonoKontakt)){
    const co = [];
    if(zapamietane.utworzonoKlub) co.push('dodałem go do listy klubów (bez ligi, regionu i miasta — uzupełnij ręcznie)');
    if(zapamietane.utworzonoKontakt) co.push('założyłem dla niego wiersz w Kontaktach');
    alert(`Adres zapamiętany przy klubie „${zapamietane.klubNazwa}".\n\nPrzy okazji ` + co.join(' oraz ') + '.');
  }
  // Zaplanowanie obserwacji od razu stawia zawodnika na liście Monitoring i nadaje status
  // "Do Obserwacji" — ale tylko jeśli zawodnik nie ma jeszcze żadnego statusu (import składu
  // zostawia status pusty; nie chcemy nadpisywać np. "Do transferu" ustawionego przez raport).
  const obsPlayer = DB.players.find(x=>x.id===playerId);
  if(obsPlayer){
    let playerChanged = false;
    if(!obsPlayer.monitored){ obsPlayer.monitored = true; playerChanged = true; }
    if(!obsPlayer.status){ obsPlayer.status = 'Do Obserwacji'; playerChanged = true; }
    if(playerChanged) await savePlayers();
  }
  let settingsChanged = false;
  if(scout && !DB.settings.scouts.includes(scout)){ DB.settings.scouts.push(scout); settingsChanged = true; }
  if(startLoc && DB.settings.startLocation !== startLoc){ DB.settings.startLocation = startLoc; settingsChanged = true; }
  if(settingsChanged) await saveSettings();
  editingObsId = null;
  render();
}

function playerReports(playerId){ return DB.reports.filter(r=>r.playerId===playerId).sort((a,b)=>a.date.localeCompare(b.date)); }

// `krotko` — podpis na osi radaru. Pełne nazwy („Faza przejścia z ataku do obrony") nie mieszczą
// się przy wierzchołku wykresu i zlewają się z sąsiednimi, więc na radarze i w PDF używamy skrótu.
const REPORT_PHASES = [
  {key:'fazaAtaku', label:'Faza ataku', krotko:'Atak'},
  {key:'fazaPrzejsciaAtakObrona', label:'Faza przejścia z ataku do obrony', krotko:'Przejście A→O'},
  {key:'fazaObrony', label:'Faza obrony', krotko:'Obrona'},
  {key:'fazaPrzejsciaObronaAtak', label:'Faza przejścia z obrony do ataku', krotko:'Przejście O→A'},
];
const REPORT_SET_PIECES = [
  {key:'rzutRoznyObrona', label:'Rzut rożny — obrona', krotko:'Rożny obr.'},
  {key:'rzutRoznyAtak', label:'Rzut rożny — atak', krotko:'Rożny atak'},
  {key:'rzutWolnyAtak', label:'Rzut wolny — atak', krotko:'Wolny atak'},
  {key:'rzutWolnyObrona', label:'Rzut wolny — obrona', krotko:'Wolny obr.'},
];

// Młodzieżowiec — rocznik 2006 i młodszy, we wszystkich ligach. Odznaka w stylu "3D" (gradient +
// warstwowy cień), spójna z kafelkami lig na dashboardzie, a nie zwykła płaska plakietka.
// Dorobek z POPRZEDNICH sezonów. Pola mecze/minuty/gole na zawodniku dotyczą sezonu bieżącego —
// odświeżenie z API je nadpisuje. Wcześniejsze sezony trafiają do archiwum i pokazujemy je tutaj,
// żeby nadpisanie nie wyglądało jak utrata danych.
function poprzednieSezonyHtml(p){
  const sezony = p.seasonStats || {};
  const biezacy = p.statsSeason || '';
  const klucze = Object.keys(sezony).filter(k=>k !== biezacy).sort().reverse();
  if(!klucze.length) return '';
  return `<div style="margin-bottom:10px;">
    <div class="note" style="margin-bottom:4px;">Poprzednie sezony:</div>
    <table style="font-size:12.5px;"><tbody>${klucze.map(k=>{
      const s = sezony[k] || {};
      return `<tr>
        <td style="font-weight:700;white-space:nowrap;padding-right:12px;">${esc(k)}</td>
        <td style="padding-right:12px;">${s.mecze ?? '—'} m &middot; ${s.minuty ?? '—'} min &middot; ${s.gole ?? '—'} g</td>
        <td class="note">${esc(s.zrodlo||'')}</td>
      </tr>`;
    }).join('')}</tbody></table>
  </div>`;
}

// WYKRES MINUT — DOSTĘPNOŚĆ ZAWODNIKA MECZ PO MECZU.
//
// Suma „1 240 minut w sezonie" nic nie mówi o tym, JAK te minuty powstały: czy zawodnik gra pełne
// spotkania, wchodzi z ławki, czy właśnie wypadł na miesiąc. Słupek na mecz pokazuje to od razu —
// pełne 90 minut sięga góry skali, wejście na kwadrans jest niskie, a mecz opuszczony to pusta
// kreska przy podstawie. Dane biorą się z protokołów 90minut (minuta wejścia i zejścia).
function wykresMinut(przebieg, opcje){
  const o = opcje || {};
  const lista = (przebieg || []).filter(Boolean);
  if(!lista.length) return '';
  const MAKS = 90;
  const wysokosc = o.wysokosc || 132;
  const szerSlupka = o.szerSlupka || 22;
  const odstep = 5;
  const marginesLewy = 26, marginesDol = o.podpisy === false ? 8 : 26, marginesGora = 14;
  const w = marginesLewy + lista.length*(szerSlupka+odstep) + 8;
  const h = wysokosc + marginesDol + marginesGora;
  const kolorPelne = o.pelne || 'var(--pitch)';
  const kolorCzesc = o.czesc || 'var(--gold)';
  const kolorBrak  = o.brak  || 'var(--chalk-dim)';
  const kolorSiatka = o.siatka || 'var(--border-strong)';
  const kolorPodpis = o.podpis || 'var(--ink-soft)';

  const yDla = (min)=> marginesGora + wysokosc - (Math.max(0, Math.min(MAKS, min))/MAKS)*wysokosc;
  const linie = [0, 45, 90].map(v=>{
    const y = yDla(v);
    return `<line x1="${marginesLewy}" y1="${y.toFixed(1)}" x2="${w-4}" y2="${y.toFixed(1)}" stroke="${kolorSiatka}" stroke-width="${v===0?1.2:0.7}" ${v===45?'stroke-dasharray="3 3"':''}/>
      <text x="${marginesLewy-5}" y="${(y+3.5).toFixed(1)}" font-size="9" fill="${kolorPodpis}" text-anchor="end" font-family="Inter,Arial,sans-serif">${v}</text>`;
  }).join('');

  const slupki = lista.map((m,i)=>{
    const x = marginesLewy + i*(szerSlupka+odstep);
    const min = Math.max(0, Math.min(MAKS, Number(m.minuty)||0));
    const y = yDla(min);
    // Mecz bez gry rysujemy jako niską, szarą kreskę przy podstawie — pusta przerwa w rzędzie
    // słupków wygląda jak brak danych, a to jest informacja: zawodnika nie było w protokole.
    const wys = Math.max(min > 0 ? 2 : 4, marginesGora + wysokosc - y);
    const kolor = min === 0 ? kolorBrak : (min >= MAKS ? kolorPelne : kolorCzesc);
    const tytul = `${m.data||('kolejka '+(m.kolejka||i+1))} &middot; ${m.dom?'u siebie':'na wyjeździe'} z ${m.rywal||'—'}${m.wynik?' ('+m.wynik+')':''} &middot; ${min} min${
      min>0 && !m.podstawowy ? ' (z ławki)' : ''}`;
    const podpis = o.podpisy === false ? '' :
      `<text x="${(x+szerSlupka/2).toFixed(1)}" y="${(marginesGora+wysokosc+11).toFixed(1)}" font-size="8.5" fill="${kolorPodpis}" text-anchor="middle" font-family="Inter,Arial,sans-serif">${esc(String(m.kolejka || (i+1)))}</text>
       <text x="${(x+szerSlupka/2).toFixed(1)}" y="${(marginesGora+wysokosc+21).toFixed(1)}" font-size="8" fill="${kolorPodpis}" text-anchor="middle" font-family="Inter,Arial,sans-serif">${esc(skrotRywala(m.rywal))}</text>`;
    return `<g><title>${tytul.replace(/&middot;/g,'·')}</title>
      <rect x="${x}" y="${y.toFixed(1)}" width="${szerSlupka}" height="${wys.toFixed(1)}" rx="3" fill="${kolor}"/>
      ${min>0 ? `<text x="${(x+szerSlupka/2).toFixed(1)}" y="${(y-3).toFixed(1)}" font-size="8.5" font-weight="700" fill="${kolorPodpis}" text-anchor="middle" font-family="Inter,Arial,sans-serif">${min}</text>` : ''}
    </g>${podpis}`;
  }).join('');

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Minuty rozegrane w kolejnych meczach">
    ${linie}${slupki}
  </svg>`;
}
// Podpis pod słupkiem musi zmieścić się w 22 pikselach — bierzemy inicjały nazwy rywala.
function skrotRywala(nazwa){
  const slowa = String(nazwa||'').split(/\s+/).filter(Boolean);
  if(!slowa.length) return '';
  if(slowa.length === 1) return slowa[0].slice(0,4);
  return slowa.map(s=>s[0]).join('').slice(0,4).toUpperCase();
}
// Podsumowanie pod wykresem: ile pełnych meczów, ile z ławki, ile opuszczonych.
function podsumowanieMinut(przebieg){
  const lista = (przebieg||[]).filter(Boolean);
  if(!lista.length) return '';
  const pelne = lista.filter(m=>(Number(m.minuty)||0) >= 90).length;
  const zLawki = lista.filter(m=>(Number(m.minuty)||0) > 0 && !m.podstawowy).length;
  const bez = lista.filter(m=>(Number(m.minuty)||0) === 0).length;
  const suma = lista.reduce((s,m)=>s+(Number(m.minuty)||0),0);
  const srednia = lista.length ? suma/lista.length : 0;
  return `${lista.length} ${lista.length===1?'mecz':'meczów'} klubu &middot; ${pelne} pełnych &middot; ${zLawki} z ławki &middot; ${bez} bez gry &middot; średnio ${Math.round(srednia)} min`;
}

function isYouthPlayer(p){
  // Protokół PZPN oznacza młodzieżowca wprost — i to źródło jest pewniejsze niż rocznik, bo
  // w IV lidze rocznika nie ma skąd wziąć, a przepis o młodzieżowcu obowiązuje tam tak samo.
  if(p && p.mlodziezowiec) return true;
  const y = Number(p.birthYear);
  return Number.isFinite(y) && y >= 2006;
}
function youthBadge(){
  // Wiodący odstęp (nbsp) + margines w CSS — żeby odznaka nie zlewała się z rokiem/datą obok.
  return `&nbsp;<span class="youth-badge-3d" title="Młodzieżowiec — rocznik 2006 i młodszy">MŁ</span>`;
}
// Agent/agencja: jeśli w nazwie jest link (http…), rozdziel nazwę od linku i zrób go klikalnym
// (przekierowanie do strony agencji, np. Transfermarkt). Bez linku — sama nazwa.
function agencyDisplayHtml(p){
  const raw = (p && p.agencyName ? String(p.agencyName) : '').trim();
  if(!raw) return 'Tak';
  const m = raw.match(/(https?:\/\/[^\s]+)/i);
  if(!m) return esc(raw);
  const link = m[1];
  const name = raw.replace(link, '').replace(/[\s\-–—:]+$/,'').trim();
  return `${name?`<strong>${esc(name)}</strong> `:''}<a class="ext-link" href="${esc(link)}" target="_blank" rel="noopener">strona agencji &rarr;</a>`;
}

let reportPerspektywaValue = '';
function selectPerspektywa(value){
  reportPerspektywaValue = (reportPerspektywaValue === value) ? '' : value;
  // WYŁĄCZNIE aktualizacja DOM — bez render(), żeby NIE skasować wpisanej treści raportu.
  const picker = document.getElementById('rep-perspektywa-picker');
  if(picker){
    picker.dataset.value = reportPerspektywaValue;
    picker.querySelectorAll('.persp-btn').forEach(b => b.classList.toggle('active', b.dataset.value === reportPerspektywaValue));
  }
}

// Decyzja/status na dole raportu. value = docelowy status zawodnika. Pierwsze cztery => Monitoring;
// "Do transferu" i "Na Testy" => mapa pozycji w Rankingu (Do transferu najwyżej).
const REPORT_STATUS_OPTIONS = [
  {value:'Do Obserwacji', label:'Do obserwacji'},
  {value:'Na Testy',      label:'Testy'},
  {value:'Do transferu',  label:'Do transferu'},
  {value:'Z polecenia',   label:'Z polecenia'},
  {value:'Odrzucony',     label:'Odrzucony'},
];
let reportStatusValue = '';
function selectReportStatus(value){
  reportStatusValue = (reportStatusValue === value) ? '' : value;
  // Tylko DOM — bez render(), żeby żaden klik nie skasował treści raportu.
  const picker = document.getElementById('rep-status-picker');
  if(picker){
    picker.dataset.value = reportStatusValue;
    picker.querySelectorAll('.status-btn').forEach(b => b.classList.toggle('active', b.dataset.value === reportStatusValue));
  }
}

// Sposób przeprowadzenia obserwacji — Live (na stadionie) / Online (transmisja) / Video (nagranie).
const OBSERVATION_TYPES = ['Live','Online','Video'];
let reportObsTypeValue = '';
function selectObsType(value){
  reportObsTypeValue = (reportObsTypeValue === value) ? '' : value;
  const picker = document.getElementById('rep-obstype-picker');
  if(picker){
    picker.dataset.value = reportObsTypeValue;
    picker.querySelectorAll('.obstype-btn').forEach(b => b.classList.toggle('active', b.dataset.value === reportObsTypeValue));
  }
}

function perspektywaBadge(value){
  if(!value) return '';
  const colorMap = {'WYSOKA':'var(--good)', 'ŚREDNIA':'#3E6FA8', 'NISKA':'var(--clay)'};
  const color = colorMap[value] || 'var(--ink-faint)';
  return `<span class="badge" style="background:${color};color:var(--card);font-weight:700;">${esc(value)}</span>`;
}
function perspektywaBadgeReport(value){
  if(!value) return '';
  const colorMap = {'WYSOKA':'var(--good)', 'ŚREDNIA':'#3E6FA8', 'NISKA':'var(--clay)'};
  const color = colorMap[value] || 'var(--ink-faint)';
  return `<span class="persp-badge-report" style="background:${color};">PERSPEKTYWA: ${esc(value)}</span>`;
}

// Kolor punktu oceny 1-6 na skali od czerwieni (1, słabo) do złota (6, dobrze).
function pointColor(n){
  const t = (Math.max(1,Math.min(6,Number(n)||1))-1)/5;
  const red=[182,80,63], gold=[198,155,60];
  const c = red.map((r,i)=>Math.round(r+(gold[i]-r)*t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
// Punktowe ocenianie 1-6 (zamiast suwaka). Wartość trzymana w ukrytym inpucie o danym id (czytanym przy zapisie).
function ratingPointsHtml(id, val){
  const v = Number(val)||3;
  return `<span class="rating-points">
    ${[1,2,3,4,5,6].map(n=>`<button type="button" class="rp-dot ${n===v?'active':''}" data-target="${id}" data-val="${n}" style="--rp:${pointColor(n)};" title="Ocena ${n}/6">${n}</button>`).join('')}
    <input type="hidden" id="${id}" value="${v}">
  </span>`;
}

function viewReports(){
  const editing = editingReportId ? DB.reports.find(r=>r.id===editingReportId) : null;
  const playerOptions = DB.players.slice().sort((a,b)=>(a.lastName||a.firstName||'').localeCompare(b.lastName||b.firstName||'','pl'))
    .map(p=>`<option value="${p.id}" ${editing&&editing.playerId===p.id?'selected':''}>${esc(p.lastName)} ${esc(p.firstName)} — ${esc(clubName(p.clubId))}</option>`).join('');

  // Liczba porządkowa wg kolejności TWORZENIA: DB.reports jest w kolejności dodawania (push),
  // więc index+1 = numer porządkowy raportu. Lista pokazana od najnowszego, ale każdy raport ma
  // swój stały numer z chwili utworzenia. Lista boczna „Raporty" — z przyciskiem usuwania.
  const ordinalOf = {};
  DB.reports.forEach((r,i)=> ordinalOf[r.id] = i+1);
  const allReports = DB.reports.slice().sort((a,b)=> (b.date||'').localeCompare(a.date||'') || (ordinalOf[b.id]-ordinalOf[a.id]));
  const listHtml = allReports.length ? allReports.map(r=>{
    const pl = DB.players.find(p=>p.id===r.playerId);
    // Raport z CAŁEGO MECZU nie ma jednego zawodnika i to jest w porządku — nosi opis spotkania.
    // Odróżniamy go po znaczniku kind, a nie po samym braku zawodnika: brak zawodnika znaczy też
    // „skasowany z kartoteki", a to zupełnie inna sytuacja i inny komunikat.
    const name = pl ? (esc(pl.lastName)+' '+esc(pl.firstName))
      : (r.kind==='mecz'
          ? `<span class="badge tab-chip" style="margin-right:6px;">MECZ</span>${esc(r.match||'Obserwacja meczu')}`
          : '<span style="color:var(--clay-dark);">(zawodnik usunięty)</span>');
    return `<div class="report-row${editingReportId===r.id?' editing':''}">
      <span class="report-num" title="Numer porządkowy (kolejność utworzenia)">${ordinalOf[r.id]}</span>
      <div class="report-row-body">
        ${pl?`<strong data-action="view-player" data-id="${pl.id}">${name}</strong>`:`<strong>${name}</strong>`}
        <span class="meta">${esc(r.date||'')}${r.perspektywa?' · '+esc(r.perspektywa):''}</span>
      </div>
      <div class="report-row-actions">
        <button class="secondary" data-action="edit-report" data-id="${r.id}" title="Edytuj">✎</button>
        ${pl?`<button class="secondary" data-action="print-player" data-id="${pl.id}" title="Pobierz PDF">⭳</button>`:''}
        <button class="danger-btn" data-action="delete-report" data-id="${r.id}" title="Usuń raport">✕</button>
      </div>
    </div>`;
  }).join('') : '<div class="empty">Brak zapisanych raportów.</div>';

  return `
  <h2 class="view-title">Raporty ${editing? '<span style="font-size:14px;color:var(--gold-dark);font-family:Inter,sans-serif;">— edycja raportu</span>':''}</h2>
  <p class="view-sub">Raport taktyczny — opis techniki, taktyki i motoryki, oceny faz gry i stałych fragmentów w skali 1-6.</p>
  <div class="reports-layout">
  <div class="card reports-form-card" style="${editing?'border:1px solid var(--gold);':''}">
    <div class="field-wrap">
      <label class="field">Zawodnik</label>
      <div class="club-combo">
        <input type="hidden" id="rep-player" value="${editing? esc(editing.playerId||'') : ''}">
        <input type="text" id="rep-player-search" class="club-combo-input" autocomplete="off"
          placeholder="Zacznij pisać nazwisko…"
          value="${editing && editing.playerId ? esc(playerLabelFor(editing.playerId)) : ''}">
        <div class="club-combo-list" id="rep-player-list"></div>
      </div>
    </div>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">Data</label><input type="date" id="rep-date" value="${editing? esc(editing.date) : new Date().toISOString().slice(0,10)}"></div>
      <div class="field-wrap"><label class="field">Scout</label><input id="rep-scout" value="${editing? esc(editing.scout||'') : esc(currentScout)}" placeholder="Imię i nazwisko scouta"></div>
    </div>
    <div class="field-wrap">
      <label class="field" style="display:block;margin-bottom:8px;">Obserwacja</label>
      <div class="obstype-picker" id="rep-obstype-picker" data-value="${esc(reportObsTypeValue)}">
        ${OBSERVATION_TYPES.map(t=>`<button type="button" class="obstype-btn ${reportObsTypeValue===t?'active':''}" data-value="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
    </div>
    <div class="field-wrap"><label class="field">Technika (opis)</label><textarea id="rep-technika" rows="2" placeholder="Ocena techniczna opisowo...">${editing? esc(editing.technika||'') : ''}</textarea></div>
    <div class="field-wrap"><label class="field">Taktyka (opis)</label><textarea id="rep-taktyka" rows="2" placeholder="Ocena taktyczna opisowo...">${editing? esc(editing.taktyka||'') : ''}</textarea></div>
    <div class="field-wrap"><label class="field">Motoryka (opis)</label><textarea id="rep-motoryka" rows="2" placeholder="Ocena motoryczna opisowo...">${editing? esc(editing.motoryka||'') : ''}</textarea></div>
    <div class="field-wrap"><label class="field">Mentalność (opis)</label><textarea id="rep-mentalnosc-opis" rows="2" placeholder="Ocena mentalna opisowo...">${editing? esc(editing.mentalnoscOpis||'') : ''}</textarea></div>
    <div class="field-wrap"><label class="field">Potencjał (opis)</label><textarea id="rep-potencjal-opis" rows="2" placeholder="Ocena potencjału opisowo...">${editing? esc(editing.potencjalOpis||'') : ''}</textarea></div>

    <div style="border-top:1px solid var(--border);margin:14px 0;padding-top:10px;">
      <label class="field" style="display:block;margin-bottom:8px;">Perspektywa</label>
      <div class="perspektywa-picker" id="rep-perspektywa-picker" data-value="${esc(reportPerspektywaValue)}">
        <button type="button" class="persp-btn persp-wysoka ${reportPerspektywaValue==='WYSOKA'?'active':''}" data-value="WYSOKA">WYSOKA</button>
        <button type="button" class="persp-btn persp-srednia ${reportPerspektywaValue==='ŚREDNIA'?'active':''}" data-value="ŚREDNIA">ŚREDNIA</button>
        <button type="button" class="persp-btn persp-niska ${reportPerspektywaValue==='NISKA'?'active':''}" data-value="NISKA">NISKA</button>
      </div>
    </div>

    <div style="border-top:1px solid var(--border);margin:14px 0;padding-top:10px;">
      <label class="field" style="display:block;margin-bottom:8px;">Fazy gry (skala 1-6)</label>
      ${REPORT_PHASES.map(f=>{ const v = editing && editing.phases && editing.phases[f.key]!=null ? editing.phases[f.key] : 3; return `
        <div class="slider-row">
          <span class="lbl">${esc(f.label)}</span>
          ${ratingPointsHtml('rep-'+f.key, v)}
        </div>`; }).join('')}
    </div>

    <div style="border-top:1px solid var(--border);margin:14px 0;padding-top:10px;">
      <label class="field" style="display:block;margin-bottom:8px;">Stałe fragmenty gry (skala 1-6)</label>
      ${REPORT_SET_PIECES.map(f=>{ const v = editing && editing.setPieces && editing.setPieces[f.key]!=null ? editing.setPieces[f.key] : 3; return `
        <div class="slider-row">
          <span class="lbl">${esc(f.label)}</span>
          ${ratingPointsHtml('rep-'+f.key, v)}
        </div>`; }).join('')}
      <div class="field-wrap" style="margin-top:10px;">
        <label class="field">Komentarz do stałych fragmentów gry</label>
        <textarea id="rep-setpiece-comment" rows="2" placeholder="Uwagi o rzutach rożnych, wolnych...">${editing? esc(editing.setPieceComment||'') : ''}</textarea>
      </div>
    </div>

    <div class="field-wrap" style="border-top:1px solid var(--border);margin:14px 0 0;padding-top:10px;">
      <label class="field">Opis raportu</label>
      <textarea id="rep-description" rows="3" placeholder="Ogólne wrażenie, kontekst obserwacji...">${editing? esc(editing.description||'') : ''}</textarea>
    </div>

    <div style="border-top:1px solid var(--border);margin:14px 0;padding-top:10px;">
      <label class="field" style="display:block;margin-bottom:8px;">Decyzja / status zawodnika</label>
      <div class="status-picker" id="rep-status-picker" data-value="${esc(reportStatusValue)}">
        ${REPORT_STATUS_OPTIONS.map(o=>`<button type="button" class="status-btn ${reportStatusValue===o.value?'active':''}" data-value="${esc(o.value)}">${esc(o.label)}</button>`).join('')}
      </div>
      <p class="note" style="margin-top:6px;">Kliknięcie tylko zaznacza — <strong>nic nie kasuje</strong>. Pierwsze cztery dodają zawodnika do <strong>Monitoringu</strong>; „Do transferu" i „Testy" trafiają też na <strong>mapę pozycji</strong> w Rankingu (Do transferu najwyżej). Status zostaje przypisany po kliknięciu „Zapisz raport".</p>
    </div>

    <div class="modal-actions" style="justify-content:flex-start;">
      <button class="gold" data-action="save-report">${editing? 'Zapisz zmiany' : 'Zapisz raport'}</button>
      ${editing? '<button class="secondary" data-action="cancel-edit-report">Anuluj edycję</button>' : ''}
    </div>
  </div>

  <aside class="reports-aside">
    <h3 class="reports-aside-title">Raporty <span class="reports-count">${allReports.length}</span></h3>
    <p class="view-sub" style="margin:0 0 8px;">Wg kolejności utworzenia. „✎" edytuj · „⭳" PDF · „✕" usuń.</p>
    <div class="card reports-list">${listHtml}</div>
  </aside>
  </div>`;
}

// ---------- TALENT ----------
function downloadContactsTemplate(){
  if(!XLSX) throw new Error('Biblioteka do arkuszy nie jest dostępna (brak połączenia z internetem przy wczytywaniu strony?).');
  const data = [
    ['Klub', 'Adres', 'Email', 'Imię', 'Nazwisko', 'Telefon', 'Notatka'],
    ['Przykładowy Klub FC', 'ul. Sportowa 5, 05-800 Pruszków', 'kontakt@przykladowyklub.pl', '', '', '', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:24},{wch:34},{wch:28},{wch:14},{wch:16},{wch:16},{wch:30}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kontakty');
  XLSX.writeFile(wb, 'szablon_kontakty.xlsx');
}

// Czysta logika parsowania JEDNEGO arkusza kontaktów z surowych wierszy (tablica tablic, nie obiekty) -
// sama wykrywa, w którym wierszu są prawdziwe nagłówki (pliki często mają wiersz tytułowy nad nimi).
function parseContactSheetRaw(rawRows){
  const norm = (s)=> String(s||'').toLowerCase().replace(/[ąćęłńóśźż]/g, c=>({ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z'}[c])).replace(/[^a-z0-9]/g,'');
  const CLUB_NAMES = ['klub','club','agencja','nazwa'];
  const EMAIL_NAMES = ['email','emailadres','email','e mail'];

  let headerRowIdx = -1, colClub = -1, colEmail = -1, colFirst = -1, colLast = -1, colPhone = -1, colNote = -1, colAddress = -1;
  const scanLimit = Math.min(8, rawRows.length);
  for(let i=0; i<scanLimit; i++){
    const row = rawRows[i] || [];
    const normalized = row.map(norm);
    const clubIdx = normalized.findIndex(c=>CLUB_NAMES.includes(c));
    const emailIdx = normalized.findIndex(c=>c.startsWith('email') || c==='mail' || c==='e-mail'.replace('-',''));
    if(clubIdx !== -1 || emailIdx !== -1){
      headerRowIdx = i; colClub = clubIdx; colEmail = emailIdx;
      colFirst = normalized.findIndex(c=>['imie','firstname'].includes(c));
      colLast = normalized.findIndex(c=>['nazwisko','lastname'].includes(c));
      colPhone = normalized.findIndex(c=>['telefon','phone','tel'].includes(c));
      colNote = normalized.findIndex(c=>['notatka','notes','uwagi','adnotacja'].includes(c));
      colAddress = normalized.findIndex(c=>['adres','adresobiektu','adresstadionu','stadion','address'].includes(c));
      break;
    }
  }
  if(headerRowIdx === -1) return null; // brak rozpoznawalnych nagłówków w tym arkuszu

  const MAX_LEN = 80;
  const nowDate = new Date().toISOString().slice(0,10);
  let skippedCount = 0;
  const contacts = [];
  for(let i=headerRowIdx+1; i<rawRows.length; i++){
    const row = rawRows[i] || [];
    const club = colClub!==-1 ? String(row[colClub]||'').trim() : '';
    const email = colEmail!==-1 ? String(row[colEmail]||'').trim() : '';
    if(!club && !email) continue;
    if(club.length > MAX_LEN || email.length > MAX_LEN){ skippedCount++; continue; }
    contacts.push({
      id: uid('C'), club, email,
      firstName: colFirst!==-1 ? String(row[colFirst]||'').trim() : '',
      lastName: colLast!==-1 ? String(row[colLast]||'').trim() : '',
      phone: colPhone!==-1 ? String(row[colPhone]||'').trim() : '',
      note: colNote!==-1 ? String(row[colNote]||'').trim() : '',
      dateAdded: nowDate,
      // Adres NIE jest polem kontaktu — tabela sbs_contacts nie ma takiej kolumny, a i tak należy
      // on do klubu. Wieszamy go tymczasowo pod „_address"; import zdejmuje ten klucz przed
      // zapisem i przepisuje adres do klubu (patrz obsługa contacts-import-input).
      _address: colAddress!==-1 ? String(row[colAddress]||'').trim() : ''
    });
  }
  return {contacts, skippedCount};
}

// Awaryjne wyodrębnienie samych adresów email z arkusza bez rozpoznawalnej struktury (np. jedna komórka
// z setkami adresów rozdzielonych przecinkami) - klub zostaje pusty do ręcznego uzupełnienia.
function extractEmailsFallback(rawRows){
  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const nowDate = new Date().toISOString().slice(0,10);
  const found = new Set();
  rawRows.forEach(row=>{
    (row||[]).forEach(cell=>{
      const text = String(cell||'');
      const matches = text.match(EMAIL_RE);
      if(matches) matches.forEach(m=>found.add(m.toLowerCase()));
    });
  });
  return Array.from(found).map(email => ({
    id: uid('C'), club: '', email, firstName:'', lastName:'', phone:'', note:'Zaimportowano bez nazwy klubu — uzupełnij ręcznie.', dateAdded: nowDate
  }));
}

async function parseContactsSpreadsheet(file){
  if(!XLSX) throw new Error('Biblioteka do odczytu arkuszy nie jest dostępna (brak połączenia z internetem przy wczytywaniu strony?).');
  const buffer = await new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>resolve(reader.result);
    reader.onerror = ()=>reject(new Error('Nie udało się odczytać pliku.'));
    reader.readAsArrayBuffer(file);
  });
  const workbook = XLSX.read(buffer, {type:'array'});
  if(!workbook.SheetNames.length) throw new Error('Plik nie zawiera żadnego arkusza.');

  let allContacts = [];
  let totalSkipped = 0;
  let anySheetHadStructure = false;

  for(const sheetName of workbook.SheetNames){
    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {header:1, defval:''});
    if(!rawRows.length) continue;
    const result = parseContactSheetRaw(rawRows);
    if(result){
      anySheetHadStructure = true;
      allContacts = allContacts.concat(result.contacts);
      totalSkipped += result.skippedCount;
    } else {
      // Arkusz bez rozpoznawalnych nagłówków (np. ściana tekstu z emailami) - spróbuj wyłuskać same adresy.
      const fallbackContacts = extractEmailsFallback(rawRows);
      allContacts = allContacts.concat(fallbackContacts);
    }
  }

  if(!allContacts.length){
    throw new Error('Nie znaleziono żadnych kontaktów w żadnym z ' + workbook.SheetNames.length + ' arkuszy pliku — sprawdź, czy któryś arkusz zawiera kolumny Klub/Email.');
  }
  return {contacts: allContacts, skippedCount: totalSkipped};
}

// Czysta logika parsowania (bez FileReader) - działa na już odczytanych wierszach z arkusza,
// więc można ją testować bezpośrednio, niezależnie od API przeglądarki do odczytu plików.
function parseTalentRowsObject(rows){
  if(!rows.length) throw new Error('Arkusz jest pusty (brak wierszy danych pod nagłówkiem).');

  // Dopasowanie nagłówków kolumn niezależnie od wielkości liter / polskich znaków / drobnych wariantów.
  const norm = (s)=> String(s||'').toLowerCase().replace(/[ąćęłńóśźż]/g, c=>({ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z'}[c])).replace(/[^a-z0-9]/g,'');
  const headerMap = {};
  if(rows[0]) Object.keys(rows[0]).forEach(h=>{ headerMap[norm(h)] = h; });
  const findCol = (...candidates) => {
    for(const c of candidates){ if(headerMap[norm(c)]) return headerMap[norm(c)]; }
    return null;
  };
  const colFirst = findCol('Imię','Imie','FirstName','first_name','Imię i nazwisko');
  const colLast = findCol('Nazwisko','LastName','last_name');
  const colYear = findCol('Rocznik','Rok urodzenia','BirthYear','birth_year','Rok');
  const colClub = findCol('Klub','Club');
  if(!colFirst && !colLast) throw new Error('Nie znaleziono kolumny z imieniem ani nazwiskiem — sprawdź nagłówki arkusza (oczekiwane: Imię, Nazwisko, Rocznik, Klub).');

  const nowDate = new Date().toISOString().slice(0,10);
  const MAX_NAME_LEN = 40; // realne imię/nazwisko nigdy nie jest tak długie — dłuższy tekst to zwykle
                            // przypadkowo złapany wiersz z legendą/notatką, a nie prawdziwy zawodnik
  const parsed = rows.map(row=>{
    const firstName = colFirst ? String(row[colFirst]||'').trim() : '';
    const lastName = colLast ? String(row[colLast]||'').trim() : '';
    const yearRaw = colYear ? row[colYear] : '';
    const birthYear = yearRaw && !isNaN(Number(yearRaw)) ? Number(yearRaw) : null;
    const club = colClub ? String(row[colClub]||'').trim() : '';
    return {firstName, lastName, birthYear, club};
  });
  const validRows = parsed.filter(r => (r.firstName || r.lastName) && r.firstName.length <= MAX_NAME_LEN && r.lastName.length <= MAX_NAME_LEN);
  const withAnyName = parsed.filter(r => r.firstName || r.lastName);
  const skippedCount = withAnyName.length - validRows.length; // np. wiersz z legendą/notatką złapaną w kolumnie danych

  if(!validRows.length){
    // Najczęstszy powód odrzucenia to wklejony ARTYKUŁ zamiast tabeli. Zdania mają wiele słów
    // i znaki interpunkcyjne, więc łatwo je rozpoznać — i wtedy warto powiedzieć wprost, co zrobić,
    // zamiast powtarzać, że „nie znaleziono wiersza".
    // Ta funkcja dostaje już rozbite WIERSZE, nie surowy tekst — prozę rozpoznajemy więc po tym,
    // co znalazło się w komórkach. Wcześniej sięgałem tu po nieistniejącą zmienną `text`, przez co
    // zamiast podpowiedzi wyskakiwał błąd „text is not defined" i import nie działał w ogóle.
    const komorki = rows.flatMap(r => Object.values(r||{})).map(v => String(v||'').trim()).filter(Boolean);
    const linie = komorki.slice(0, 12);
    const wyglądaNaArtykuł = komorki.some(v => v.split(/\s+/).length > 8 && /[.,]/.test(v));
    if(wyglądaNaArtykuł){
      throw new Error(
        'To wygląda na artykuł, a nie na listę zawodników.\n\n' +
        'To pole czyta TABELĘ: jedna osoba w linijce, kolumny Imię, Nazwisko, Rocznik, Klub\n' +
        'rozdzielone tabulatorem, przecinkiem albo dwiema spacjami.\n\n' +
        'Pojedynczego zawodnika z artykułu dodaj formularzem „Dodaj ręcznie" niżej —\n' +
        'wpisz imię, nazwisko, rocznik i klub, a potem „pełny profil", żeby uzupełnić resztę.'
      );
    }
    throw new Error('Nie znaleziono żadnego wiersza z imieniem lub nazwiskiem.\n\n' +
      'Oczekuję jednej osoby w linijce, z kolumnami rozdzielonymi tabulatorem, przecinkiem albo dwiema spacjami.');
  }
  return {
    talents: validRows.map(r => ({
      id: uid('T'), firstName: r.firstName, lastName: r.lastName, birthYear: r.birthYear, club: r.club,
      confidence: 'import', sourceImage: '', dateAdded: nowDate
    })),
    skippedCount
  };
}

// ---------- WKLEJANIE LISTY DO ZAKŁADKI TALENT ----------
//
// Do tego pola trafiają trzy różne rzeczy i parser musi rozumieć każdą z nich:
//   1. TABELA Z ARKUSZA — kolumny Imię / Nazwisko / Rocznik / Klub rozdzielone tabulatorem.
//   2. LISTA POWOŁAŃ (PZPN, kadry wojewódzkie) — „Lp. | Imię Nazwisko | Klub", a rocznik podany
//      RAZ w nagłówku nad listą („Reprezentacja U-15, rocznik 2011"). Wcześniej rocznik przepadał,
//      bo parser czytał wyłącznie kolumny w wierszu zawodnika.
//   3. SKOPIOWANY SKŁAD — „Hubert Simson(8)-Wda Świecie", nierzadko kilku zawodników sklejonych
//      w JEDNEJ linijce. Stary parser robił z takiej linijki jednego zawodnika o imieniu
//      „Hubert Simson(8)-Wda Świecie" i pustym nazwisku.
const RE_ROK_TALENTU = /\b(19[89]\d|20[0-4]\d)\b/;

function czyscLinieTalentu(l){
  // Twarda spacja i myślniki w kilku wariantach to standard przy kopiowaniu z PDF i stron WWW.
  return String(l||'').replace(/ /g,' ').replace(/[‐-―]/g,'-').replace(/\s+/g,' ').trim();
}

// Nagłówek grupy: „ROCZNIK 2013", „Kadra U-15 (2011)", sama liczba w linijce. Zwraca rocznik,
// który obowiązuje dla WSZYSTKICH kolejnych wierszy — aż do następnego takiego nagłówka.
function rocznikZNaglowkaTalentu(linia){
  const l = czyscLinieTalentu(linia);
  const m = l.match(RE_ROK_TALENTU);
  if(!m) return null;
  const rok = Number(m[0]);
  if(/^\(?\s*(19|20)\d{2}\s*\)?$/.test(l)) return rok;
  if(/(rocznik|rok urodzenia|kadra|kadry|kadrze|powolan|powołan|reprezentacj|selekcj|u-?\s?\d{1,2}\b)/i.test(l)
     && !/[;\t]/.test(l) && l.split(' ').length <= 9) return rok;
  return null;
}

// „KOWALSKI" i „kowalski" na „Kowalski" — listy PZPN piszą nazwiska wersalikami, a w profilu
// zawodnika ma być normalny zapis. Człony po myślniku traktujemy osobno (Nowak-Jeziorski).
function ladnaNazwaOsoby(s){
  return String(s||'').trim().split(/\s+/).filter(Boolean).map(w=>
    w.split('-').map(cz=> cz ? cz[0].toUpperCase() + cz.slice(1).toLowerCase() : cz).join('-')
  ).join(' ');
}
function rozdzielImieNazwisko(pelne){
  const slowa = ladnaNazwaOsoby(pelne).split(/\s+/).filter(Boolean);
  if(!slowa.length) return {firstName:'', lastName:''};
  if(slowa.length === 1) return {firstName:'', lastName:slowa[0]};
  return {firstName:slowa[0], lastName:slowa.slice(1).join(' ')};
}

// Czy ten kawałek tekstu to nazwa klubu? Najpewniejsza odpowiedź to nasza własna kartoteka klubów;
// dopiero gdy klubu tam nie ma, sięgamy po typowe człony nazw (KS, Akademia, Sokół…).
function wygladaNaKlubTalentu(s){
  const t = czyscLinieTalentu(s);
  if(!t) return false;
  const n = t.toLowerCase();
  if(DB.clubs && DB.clubs.some(c => c.name && (n === c.name.toLowerCase() || n.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(n)))) return true;
  return /\b(ks|lks|mks|uks|gks|kks|zks|rks|cwks|wks|sp|ssa|fc|ac|sc|akademia|akademii|klub|szkola|szkoła|sportowa|football|soccer|team)\b/i.test(t);
}

// Format „Imię Nazwisko(7)-Klub" — numer na koszulce jest tu granicą rekordu, więc nawet kilku
// zawodników sklejonych w jedną linijkę rozdzielamy pewnie. Czytamy od numeru do numeru: dwa
// ostatnie słowa przed nawiasem to zawodnik, a wszystko wcześniej — klub POPRZEDNIEGO zawodnika.
function osobyZeSkladuTalentu(linia, rocznik){
  const l = czyscLinieTalentu(linia);
  const re = /\((\d{1,2})\)/g;
  const znaczniki = [];
  let m;
  while((m = re.exec(l)) !== null) znaczniki.push({od: m.index, do: m.index + m[0].length});
  if(!znaczniki.length) return [];

  const out = [];
  let kursor = 0;
  znaczniki.forEach(z=>{
    const przed = l.slice(kursor, z.od).replace(/^[\s\-,;]+/,'').trim();
    kursor = z.do;
    let slowa = przed.split(' ').filter(Boolean);
    if(!slowa.length) return;
    let nazwa = slowa.slice(-2).join(' ');
    let ogon = slowa.slice(0, -2).join(' ').replace(/[-,;]+$/,'').trim();
    // Jedno samotne słowo przed nazwiskiem, które nie wygląda na klub, to zwykle drugie imię
    // albo pierwszy człon nazwiska — nie robimy z niego klubu.
    if(ogon && !ogon.includes(' ') && !wygladaNaKlubTalentu(ogon)){ nazwa = ogon + ' ' + nazwa; ogon = ''; }
    if(ogon && out.length && !out[out.length-1].club) out[out.length-1].club = ogon;
    const {firstName, lastName} = rozdzielImieNazwisko(nazwa);
    if(!firstName && !lastName) return;
    out.push({firstName, lastName, birthYear: rocznik || null, club: ''});
  });

  // Ostatni zawodnik ma klub dopiero za swoim numerem — do końca linijki.
  const koncowka = l.slice(kursor).replace(/^[\s\-,;]+/,'').replace(/[-,;]+$/,'').trim();
  if(koncowka && out.length && !out[out.length-1].club) out[out.length-1].club = koncowka;

  out.forEach(o=>{
    const mr = o.club && o.club.match(RE_ROK_TALENTU);
    if(mr){ o.birthYear = Number(mr[0]); o.club = o.club.replace(RE_ROK_TALENTU,'').replace(/\s+/g,' ').trim(); }
  });
  return out;
}

function komorkiLiniiTalentu(l){
  if(l.includes('\t')) return l.split('\t');
  if(l.includes('|')) return l.split('|');
  if(l.includes(';')) return l.split(';');
  if(/\s{2,}/.test(l)) return l.split(/\s{2,}/);
  if(l.includes(',')) return l.split(',');
  return [l];
}

// Wiersz rozbity na kolumny. Kolejność bywa różna (arkusz: Imię/Nazwisko/Rocznik/Klub; powołania:
// Lp./Imię Nazwisko/Klub), więc nie liczymy na pozycje: rocznik poznajemy po tym, że jest rokiem,
// klub po tym, że wygląda na klub albo został jako ostatnia nadmiarowa kolumna.
function osobaZKomorekTalentu(komorki, rocznik){
  let c = komorki.map(czyscLinieTalentu).filter(Boolean);
  if(c.length && /^\d{1,3}[.)]?$/.test(c[0])) c = c.slice(1);   // liczba porządkowa „Lp."
  if(!c.length) return null;
  let rok = null;
  const nazwowe = [];
  c.forEach(kom=>{
    const sam = kom.match(/^\(?((?:19|20)\d{2})\)?$/);
    if(sam && !rok){ rok = Number(sam[1]); return; }
    nazwowe.push(kom);
  });
  if(!nazwowe.length) return null;
  let klub = '';
  if(nazwowe.length >= 3) klub = nazwowe.pop();
  else if(nazwowe.length === 2 && (nazwowe[0].includes(' ') || wygladaNaKlubTalentu(nazwowe[1]))) klub = nazwowe.pop();
  const nazwa = nazwowe.join(' ');
  if(!rok){
    const mr = nazwa.match(RE_ROK_TALENTU);
    if(mr) rok = Number(mr[0]);
  }
  const {firstName, lastName} = rozdzielImieNazwisko(nazwa.replace(RE_ROK_TALENTU,'').trim());
  if(!firstName && !lastName) return null;
  return {firstName, lastName, birthYear: rok || rocznik || null, club: klub};
}

// Wiersz bez separatorów: „1. Jan Kowalski - Legia Warszawa" albo „Jan Kowalski Legia Warszawa".
function osobaZWierszaTalentu(linia, rocznik){
  let l = czyscLinieTalentu(linia).replace(/^\d{1,3}\s*[.)]\s*/,'');
  if(!l) return null;
  let rok = null;
  const mr = l.match(RE_ROK_TALENTU);
  if(mr){ rok = Number(mr[0]); l = (l.slice(0, mr.index) + ' ' + l.slice(mr.index + 4)).replace(/\s+/g,' ').trim(); }
  let nazwa = l, klub = '';
  const myslnik = l.match(/^(.+?)\s*-\s+(.+)$/) || l.match(/^(.+?),\s*(.+)$/);
  if(myslnik){ nazwa = myslnik[1].trim(); klub = myslnik[2].trim(); }
  else {
    // Bez myślnika ryzykujemy podział tylko wtedy, gdy reszta wiersza faktycznie wygląda na klub —
    // inaczej trzyczłonowe nazwisko rozpadłoby się na zawodnika i wymyślony klub.
    const slowa = l.split(' ');
    if(slowa.length > 2){
      const reszta = slowa.slice(2).join(' ');
      if(wygladaNaKlubTalentu(reszta)){ nazwa = slowa.slice(0,2).join(' '); klub = reszta; }
    }
  }
  const {firstName, lastName} = rozdzielImieNazwisko(nazwa);
  if(!firstName && !lastName) return null;
  return {firstName, lastName, birthYear: rok || rocznik || null, club: klub};
}

function parseTalentPastedText(text){
  const surowe = String(text||'').split(/\r?\n/);
  // Lista powołań bywa wklejana jako jeden akapit: „1. Jan Kowalski - Legia 2. Piotr Nowak - Lech".
  // Numer porządkowy w środku linii to wtedy granica kolejnego zawodnika.
  const linie = [];
  surowe.forEach(l=>{
    const c = czyscLinieTalentu(l);
    if(!c) return;
    if(/^\d{1,3}[.)]\s/.test(c) && /\s\d{1,3}[.)]\s/.test(c)) c.split(/\s+(?=\d{1,3}[.)]\s)/).forEach(x=>linie.push(x));
    else linie.push(c);
  });
  if(!linie.length) throw new Error('Wklej przynajmniej jedną linię z danymi.');

  const norm = (s)=> String(s||'').toLowerCase().replace(/[ąćęłńóśźż]/g, c=>({ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z'}[c])).replace(/[^a-z0-9]/g,'');
  const HEADER_WORDS = ['imie','nazwisko','rocznik','klub','firstname','lastname','birthyear','club','rokurodzenia','imieinazwisko'];
  const pierwszeKomorki = komorkiLiniiTalentu(linie[0]).map(c=>c.trim());
  const naglowekKolumn = pierwszeKomorki.length > 1 && pierwszeKomorki.some(c => HEADER_WORDS.includes(norm(c)));
  if(naglowekKolumn){
    const rows = linie.slice(1).map(line=>{
      const cells = komorkiLiniiTalentu(line);
      const obj = {};
      pierwszeKomorki.forEach((h,i)=> obj[h] = cells[i]!=null ? cells[i].trim() : '');
      return obj;
    });
    return parseTalentRowsObject(rows);
  }

  const nowDate = new Date().toISOString().slice(0,10);
  const MAX_NAME_LEN = 40;
  let rocznik = null;
  const osoby = [];
  let pominiete = 0;
  linie.forEach(l=>{
    const naglowek = rocznikZNaglowkaTalentu(l);
    if(naglowek){ rocznik = naglowek; return; }
    const zeSkladu = osobyZeSkladuTalentu(l, rocznik);
    if(zeSkladu.length){ osoby.push(...zeSkladu); return; }
    const komorki = komorkiLiniiTalentu(l);
    const os = komorki.length > 1 ? osobaZKomorekTalentu(komorki, rocznik) : osobaZWierszaTalentu(l, rocznik);
    if(!os){ pominiete++; return; }
    if(!os.birthYear && rocznik) os.birthYear = rocznik;
    if(os.firstName.length > MAX_NAME_LEN || os.lastName.length > MAX_NAME_LEN){ pominiete++; return; }
    osoby.push(os);
  });

  // Ten sam zawodnik potrafi być w wklejce dwa razy (np. w składzie i na ławce) — do listy
  // wchodzi raz, z pełniejszym kompletem danych.
  const unikalne = [];
  const widziane = new Map();
  osoby.forEach(o=>{
    const klucz = norm(o.firstName) + '|' + norm(o.lastName) + '|' + (o.birthYear||'');
    const byl = widziane.get(klucz);
    if(byl){ if(!byl.club && o.club) byl.club = o.club; return; }
    widziane.set(klucz, o);
    unikalne.push(o);
  });

  if(!unikalne.length){
    const dlugie = linie.some(v => v.split(/\s+/).length > 8 && /[.,]/.test(v));
    if(dlugie){
      throw new Error(
        'To wygląda na artykuł, a nie na listę zawodników.\n\n' +
        'To pole czyta LISTĘ: jedna osoba w linijce — „Imię Nazwisko - Klub",\n' +
        'kolumny z arkusza albo powołania z numeracją „1. Jan Kowalski  Legia Warszawa".\n' +
        'Rocznik możesz podać raz, w linijce nad listą (np. „rocznik 2013").\n\n' +
        'Pojedynczego zawodnika z artykułu dodaj formularzem „Dodaj ręcznie" niżej.'
      );
    }
    throw new Error('Nie znaleziono żadnego wiersza z imieniem lub nazwiskiem.\n\n' +
      'Oczekuję jednej osoby w linijce: „Imię Nazwisko - Klub" albo kolumny rozdzielone tabulatorem.');
  }

  // Segregacja według roczników — o to prosi zakładka Talent: najpierw najmłodsi, w obrębie
  // rocznika alfabetycznie po nazwisku. Wpisy bez rocznika lądują na końcu.
  unikalne.sort((a,b)=>{
    const ra = a.birthYear || -1, rb = b.birthYear || -1;
    if(ra !== rb) return rb - ra;
    return (a.lastName||'').localeCompare(b.lastName||'', 'pl');
  });

  return {
    talents: unikalne.map(o=>({
      id: uid('T'), firstName: o.firstName, lastName: o.lastName, birthYear: o.birthYear || null,
      club: o.club || '', confidence: 'import', sourceImage: '', dateAdded: nowDate
    })),
    skippedCount: pominiete
  };
}

function promoteTalentToPlayer(talentId){
  const t = DB.talents.find(x=>x.id===talentId);
  if(!t) return;
  promotingTalentId = talentId;
  const prefill = {
    firstName: t.firstName || '',
    lastName: t.lastName || '',
    birthDate: t.birthYear ? (t.birthYear+'-01-01') : '',
    notes: (t.club? 'Klub wg zakładki Talent: '+t.club+'. ':'') + 'Dodany z zakładki Talent — zweryfikuj dane i uzupełnij dokładną datę urodzenia oraz klub.'
  };
  openPlayerModal(null, null, prefill);
}

async function addTalentManually(){
  const firstName = document.getElementById('talent-manual-first').value.trim();
  const lastName = document.getElementById('talent-manual-last').value.trim();
  if(!firstName && !lastName){ alert('Podaj przynajmniej imię lub nazwisko.'); return; }
  const yearVal = document.getElementById('talent-manual-year').value;
  DB.talents.push({
    id: uid('T'),
    firstName, lastName,
    birthYear: yearVal ? Number(yearVal) : null,
    club: document.getElementById('talent-manual-club').value.trim(),
    confidence: 'ręcznie',
    sourceImage: '',
    dateAdded: new Date().toISOString().slice(0,10)
  });
  await saveTalents();
  render();
}

function viewTalent(){
  // SEGREGACJA WEDŁUG ROCZNIKÓW.
  //
  // Kolejność dodania nic tu nie znaczy — przy wklejeniu listy powołań z dwóch roczników naraz
  // (2013 i 2014) chłopcy mieszali się na jednej długiej liście. Grupujemy więc po roczniku,
  // od najmłodszych, a w obrębie rocznika alfabetycznie po nazwisku. Bez rocznika — na końcu,
  // w osobnej grupie, żeby było widać, komu trzeba go uzupełnić.
  const rows = DB.talents.slice().sort((a,b)=>{
    const ra = a.birthYear || -1, rb = b.birthYear || -1;
    if(ra !== rb) return rb - ra;
    return (a.lastName||'').localeCompare(b.lastName||'', 'pl') || (a.firstName||'').localeCompare(b.firstName||'', 'pl');
  });
  const wierszTalentu = (t)=>`
    <div class="talent-row">
      <span class="talent-row-name"><input type="checkbox" class="talent-check" data-id="${t.id}" style="margin-right:6px;vertical-align:middle;">${esc(t.firstName)} ${esc(t.lastName)}</span>
      <span class="talent-row-actions">
        <button class="link-btn" data-action="talent-promote" data-id="${t.id}" style="color:var(--gold-dark);">pełny profil / dodaj do bazy</button>
        <button class="link-btn talent-remove-btn" data-id="${t.id}" style="color:var(--clay-dark);">usuń</button>
      </span>
      <span class="talent-row-meta">${esc(t.club||'klub nieznany')}</span>
    </div>`;
  let rowsHtml = '';
  if(rows.length){
    let biezacyRocznik;
    rows.forEach(t=>{
      const r = t.birthYear || null;
      if(r !== biezacyRocznik){
        biezacyRocznik = r;
        const ilu = rows.filter(x=>(x.birthYear||null) === r).length;
        rowsHtml += `<div class="talent-year-head">${r ? 'Rocznik '+esc(String(r)) : 'Bez rocznika'} <span class="reports-count">${ilu}</span></div>`;
      }
      rowsHtml += wierszTalentu(t);
    });
  } else {
    rowsHtml = '<div class="empty">Brak jeszcze dodanych talentów — użyj importu lub formularza poniżej.</div>';
  }

  return `
  <h2 class="view-title">Talent</h2>
  <p class="view-sub">Lista młodych zawodników do szybkiego dodania — zaimportuj z arkusza, wpisz ręcznie, a potem kliknij "pełny profil", żeby uzupełnić wszystkie dane i dodać do głównej bazy.</p>

  <div class="talent-layout">
    <div>
      <h3 style="margin-top:0;color:var(--heading);font-family:'Barlow Condensed',sans-serif;">Wklej tekst</h3>
      <div class="card">
        <p class="note" style="margin-top:-4px;">Wklej listę w dowolnej z trzech postaci: <strong>tabelę z arkusza</strong> (Imię, Nazwisko, Rocznik, Klub), <strong>listę powołań</strong> („1. Jan Kowalski — Legia Warszawa") albo <strong>skopiowany skład</strong> („Jan Kowalski(8)-Wda Świecie"), nawet gdy kilku zawodników wylądowało w jednej linijce. <strong>Rocznik wystarczy podać raz</strong>, w linijce nad grupą (np. „rocznik 2013") — trafi do wszystkich nazwisk poniżej, aż do następnego takiego nagłówka.</p>
        <div class="field-wrap">
          <textarea id="talent-paste-text" rows="6" placeholder="np.&#10;rocznik 2013&#10;1. Jan Kowalski — Legia Warszawa&#10;2. Piotr Nowak — Lech Poznań&#10;rocznik 2014&#10;Kacper	Kowalkowski	&#9;Zawisza Bydgoszcz">${esc(talentPasteText)}</textarea>
        </div>
        <div class="modal-actions" style="justify-content:flex-start;margin-bottom:0;">
          <button class="secondary" data-action="talent-paste-parse">Rozpoznaj zawodników</button>
        </div>
        ${talentPasteParsed ? `
          <div style="border-top:1px solid var(--border);margin-top:14px;padding-top:10px;max-height:260px;overflow:auto;">
            <p class="note" style="margin-top:0;">Rozpoznano <strong>${talentPasteParsed.length}</strong> ${plZaw(talentPasteParsed.length)}. Odznacz, czego nie chcesz dodać.</p>
            <table><tbody>
              ${talentPasteParsed.map((t,i)=>`<tr>
                <td style="width:24px;"><input type="checkbox" class="talent-paste-check" data-idx="${i}" checked></td>
                <td><strong>${esc(t.firstName)} ${esc(t.lastName)}</strong></td>
                <td>${t.birthYear?esc(String(t.birthYear)):'—'}</td>
                <td>${esc(t.club||'—')}</td>
              </tr>`).join('')}
            </tbody></table>
          </div>
          <div class="modal-actions" style="justify-content:flex-start;">
            <button class="gold" data-action="talent-paste-import">+ Dodaj zaznaczonych do listy</button>
          </div>
        ` : ''}
      </div>

      <h3 style="margin-top:20px;color:var(--heading);font-family:'Barlow Condensed',sans-serif;">Dodaj ręcznie</h3>
      <div class="card">
        <div class="grid grid-2">
          <div class="field-wrap"><label class="field">Imię</label><input id="talent-manual-first"></div>
          <div class="field-wrap"><label class="field">Nazwisko</label><input id="talent-manual-last"></div>
        </div>
        <div class="grid grid-2">
          <div class="field-wrap"><label class="field">Rocznik</label><input type="number" id="talent-manual-year" placeholder="np. 2010"></div>
          <div class="field-wrap"><label class="field">Klub</label><input id="talent-manual-club"></div>
        </div>
        <div class="modal-actions" style="justify-content:flex-start;">
          <button class="gold" data-action="talent-add-manual">Dodaj do listy</button>
        </div>
      </div>
    </div>

    <aside class="talent-aside">
      <h3 class="reports-aside-title">Lista talentów <span class="reports-count">${rows.length}</span></h3>
      ${rows.length ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="talent-select-all"><span>Zaznacz wszystkie</span>
        </label>
        <button class="danger" id="talent-delete-selected" style="display:none;" data-action="talent-delete-selected">🗑️ Usuń zaznaczonych (0)</button>
      </div>` : ''}
      <div class="card talent-list">${rowsHtml}</div>
    </aside>
  </div>`;
}

let contactSearchQuery = '';

async function updateContactField(id, field, value){
  const c = DB.contacts.find(x=>x.id===id);
  if(!c) return;
  // Adres nie jest polem kontaktu, tylko klubu — zapisujemy go tam, żeby wszystkie osoby z tego
  // samego klubu widziały jeden i ten sam adres (patrz komentarz przy contactAddress).
  if(field === 'address'){
    const ok = await setClubAddressByName(contactClubName(c), value);
    if(!ok && String(value||'').trim()){
      alert('Nie mam do czego przypiąć tego adresu — w polu „Klub" nie ma nazwy, którą znajdę na liście klubów.\nUzupełnij najpierw nazwę klubu.');
    }
    return;
  }
  c[field] = value;
  await saveContacts();
}

async function updateCommitteeField(playerId, field, value){
  const p = DB.players.find(x=>x.id===playerId);
  if(!p) return;
  p[field] = value;
  await savePlayers();
}

function contactRow(c, num){
  return `<tr data-id="${c.id}">
    <td class="contact-num">${num}</td>
    <td><input class="contact-inline-input contact-field-klub" data-id="${c.id}" data-field="club" value="${esc(c.club||'')}" placeholder="Klub" style="font-weight:700;"></td>
    <td><input class="contact-inline-input contact-field-adres" data-id="${c.id}" data-field="address" value="${esc(contactAddress(c))}" placeholder="Adres obiektu" title="Uzupełnia się sam z planu obserwacji — jeden adres na klub"></td>
    <td><input class="contact-inline-input contact-field-email" data-id="${c.id}" data-field="email" value="${esc(c.email||'')}" placeholder="Email"></td>
    <td><input class="contact-inline-input contact-field-imie" data-id="${c.id}" data-field="firstName" value="${esc(c.firstName||'')}" placeholder="Imię"></td>
    <td><input class="contact-inline-input contact-field-nazwisko" data-id="${c.id}" data-field="lastName" value="${esc(c.lastName||'')}" placeholder="Nazwisko"></td>
    <td><input class="contact-inline-input contact-field-telefon" data-id="${c.id}" data-field="phone" value="${esc(c.phone||'')}" placeholder="Telefon"></td>
    <td><input class="contact-inline-input contact-field-notatka" data-id="${c.id}" data-field="note" value="${esc(c.note||'')}" placeholder="Notatka"></td>
    <td><button class="link-btn contact-remove-btn" data-id="${c.id}" style="color:var(--clay-dark);font-size:11px;">usuń</button></td>
  </tr>`;
}

// Wyłuskaj nazwę klubu z adresu e-mail: sprawdza część PRZED @ (local) i domenę, normalizuje i dopasowuje
// do klubów w bazie (np. "sekretariat@zniczpruszkow.pl" -> "Znicz Pruszków", "gks.tychy@wp.pl" -> "GKS Tychy").
function clubFromEmail(email){
  if(!email || !email.includes('@')) return null;
  const parts = email.toLowerCase().split('@');
  const local = parts[0];
  const domain = (parts[1]||'').split('.')[0]; // fragment domeny przed pierwszą kropką
  const stripDiac = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'');
  const norm = s => stripDiac(s).replace(/[^a-z0-9]/g,'').replace(/[0-9]/g,'');
  const clubNorm = c => norm(c.name);
  const generic = new Set(['gmail','wp','onet','interia','o2','poczta','op','gazeta','icloud','yahoo','hotmail','outlook','vp','autograf','tlen']);
  const cands = [];
  if(domain && !generic.has(domain)) cands.push(norm(domain));
  cands.push(norm(local));
  if(!generic.has(domain)) cands.push(norm(local + domain));
  for(const cand of cands){
    if(!cand || cand.length < 3) continue;
    // najpierw dokładne, potem zawieranie (klub zawiera kandydata lub odwrotnie), preferuj najbliższy długością
    const scored = DB.clubs.map(c=>{ const cn=clubNorm(c); let rank=99;
      if(!cn) return {c,rank};
      if(cn===cand) rank=0; else if(cn.startsWith(cand)||cand.startsWith(cn)) rank=1; else if(cn.includes(cand)||cand.includes(cn)) rank=2;
      return {c, cn, rank, dl:Math.abs((cn||'').length-cand.length)};
    }).filter(x=>x.rank<99 && x.cn.length>=3).sort((a,b)=> a.rank-b.rank || a.dl-b.dl);
    if(scored[0]) return scored[0].c.name;
  }
  return null;
}

function viewContacts(){
  const q = contactSearchQuery.toLowerCase();
  let list = DB.contacts.slice();
  if(q){
    list = list.filter(c =>
      (c.club||'').toLowerCase().includes(q) ||
      (c.firstName||'').toLowerCase().includes(q) ||
      (c.lastName||'').toLowerCase().includes(q) ||
      (c.name||'').toLowerCase().includes(q) ||
      (c.email||'').toLowerCase().includes(q) ||
      contactAddress(c).toLowerCase().includes(q)
    );
  }
  // Sortuj alfabetycznie wg nazwy klubu; kontakty BEZ nazwy klubu lądują na końcu listy.
  list.sort((a,b)=>{
    const ca = (a.club||a.name||'').trim(), cb = (b.club||b.name||'').trim();
    if(!ca && !cb) return (a.email||'').localeCompare(b.email||'');
    if(!ca) return 1;   // a bez klubu -> niżej
    if(!cb) return -1;  // b bez klubu -> niżej
    return ca.localeCompare(cb, 'pl');
  });

  return `
  <h2 class="view-title">Kontakty</h2>
  <p class="view-sub">Baza kontaktów — zaimportuj z arkusza (klub + email), a resztę uzupełnij ręcznie bezpośrednio na liście.
    Adres obiektu zapisuje się sam, gdy wpiszesz go w Planie Obserwacji: trafia do klubu-gospodarza i pokazuje się tutaj.</p>

  <div class="card" style="max-width:640px;">
    <h4 style="margin-top:0;color:var(--heading);">Import z Excela / CSV</h4>
    <p class="note" style="margin-top:-4px;">Oczekiwane kolumny: <strong>Klub, Email</strong> (dodatkowo rozpoznawane: Adres, Imię, Nazwisko, Telefon, Notatka — jeśli są w arkuszu).</p>
    <div class="modal-actions" style="justify-content:flex-start;margin-top:0;margin-bottom:12px;">
      <button class="secondary" data-action="contacts-download-template">Pobierz szablon Excel</button>
    </div>
    <div class="field-wrap">
      <input type="file" id="contacts-import-input" accept=".xlsx,.xls,.csv">
      <div id="contacts-import-status" class="note" style="margin-top:6px;"></div>
    </div>
  </div>

  <div class="toolbar" style="margin-top:20px;flex-wrap:wrap;gap:10px;">
    <input id="contact-search" placeholder="Szukaj po nazwie klubu, imieniu, nazwisku, emailu..." value="${esc(contactSearchQuery)}" style="max-width:340px;">
    <span>
      <button class="secondary" data-action="contacts-fill-clubs">🔗 Uzupełnij kluby z e-maili</button>
      <button class="secondary" data-action="contacts-export-excel">📊 Pobierz Excel</button>
      <button class="secondary" data-action="contacts-export-pdf">📄 Pobierz PDF</button>
    </span>
  </div>

  <div class="card" style="padding:0;overflow:auto;margin-top:12px;">
    <table>
      <thead><tr><th>#</th><th>Klub</th><th>Adres obiektu</th><th>Email</th><th>Imię</th><th>Nazwisko</th><th>Telefon</th><th>Notatka</th><th></th></tr></thead>
      <tbody>${list.length ? list.map((c,i)=>contactRow(c,i+1)).join('') : `<tr><td colspan="9"><div class="empty">${contactSearchQuery? 'Brak kontaktów pasujących do wyszukiwania.' : 'Brak kontaktów — zaimportuj arkusz powyżej.'}</div></td></tr>`}</tbody>
    </table>
  </div>`;
}

function downloadContactsExcel(){
  if(!XLSX) throw new Error('Biblioteka do arkuszy nie jest dostępna.');
  const rows = [['Klub','Adres obiektu','Email','Imię','Nazwisko','Telefon','Notatka']];
  DB.contacts.slice().sort((a,b)=>(a.club||'').localeCompare(b.club||'')).forEach(c=>{
    rows.push([c.club||'', contactAddress(c), c.email||'', c.firstName||'', c.lastName||'', c.phone||'', c.note||'']);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:24},{wch:34},{wch:26},{wch:14},{wch:16},{wch:16},{wch:30}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kontakty');
  XLSX.writeFile(wb, 'kontakty_sbs.xlsx');
}

function downloadContactsPdf(){
  const sorted = DB.contacts.slice().sort((a,b)=>(a.club||'').localeCompare(b.club||''));
  const rowsHtml = sorted.map((c,i)=>`<tr>
    <td>${i+1}</td><td>${esc(c.club||'—')}</td><td>${esc(contactAddress(c)||'—')}</td><td>${esc(c.email||'—')}</td>
    <td>${esc(c.firstName||'')}</td><td>${esc(c.lastName||'')}</td><td>${esc(c.phone||'')}</td><td>${esc(c.note||'')}</td>
  </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kontakty SBS</title>
  <style>
    body{font-family:Arial,sans-serif;padding:24px;color:#16302A;}
    h1{font-size:20px;}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px;}
    th,td{border:1px solid #E7E2D3;padding:6px 8px;text-align:left;}
    th{background:#16302A;color:#F6F3EA;}
    tr:nth-child(even){background:#F6F3EA;}
  </style></head><body>
  <h1>Scout Base System — Kontakty</h1>
  <p>Wygenerowano: ${new Date().toLocaleString('pl-PL')}</p>
  <table><thead><tr><th>#</th><th>Klub</th><th>Adres obiektu</th><th>Email</th><th>Imię</th><th>Nazwisko</th><th>Telefon</th><th>Notatka</th></tr></thead>
  <tbody>${rowsHtml}</tbody></table>
  </body></html>`;
  const blob = new Blob([html], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'kontakty_sbs.html';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}



// Klasyczny układ 11 numerowanych pozycji (na wzór przesłanego wzoru) — niezależny od formacji.
// Na każdej pozycji można ręcznie przypisać do 6 zawodników wybranych z bazy; lista wypełnia się
// automatycznie najwyżej ocenionymi zawodnikami przy pierwszym wyświetleniu (patrz buildAutoPositionCandidates).
const POSITION_NUMBERS = [
  {number:1,  label:'Bramkarz',            posName:'Bramkarz',            rankOffset:0},
  {number:3,  label:'Lewy obrońca',        posName:'Obrońca boczny',      rankOffset:0},
  {number:2,  label:'Prawy obrońca',       posName:'Obrońca boczny',      rankOffset:6},
  {number:5,  label:'Stoper (lewy)',       posName:'Obrońca środkowy',    rankOffset:0},
  {number:4,  label:'Stoper (prawy)',      posName:'Obrońca środkowy',    rankOffset:6},
  {number:6,  label:'Defensywny pomocnik', posName:'Pomocnik defensywny', rankOffset:0},
  {number:8,  label:'Środkowy pomocnik',   posName:'Pomocnik środkowy',   rankOffset:0},
  {number:10, label:'Ofensywny pomocnik',  posName:'Pomocnik ofensywny',  rankOffset:0},
  {number:11, label:'Lewe skrzydło',       posName:'Skrzydłowy',          rankOffset:0},
  {number:7,  label:'Prawe skrzydło',      posName:'Skrzydłowy',          rankOffset:6},
  {number:9,  label:'Napastnik',           posName:'Napastnik',           rankOffset:0},
];
// Współrzędne (procent szerokości/wysokości boiska) dla każdej z 11 pozycji — osobny układ dla każdego
// systemu gry, żeby pola realnie odzwierciedlały kształt taktyczny formacji. Bazowy układ (dla "" i
// 1-4-3-3) odwzorowuje dokładnie przesłany wzór klubowej planszy. Te same 11 numerów/etykiet/pozycji
// (POSITION_NUMBERS) obowiązują zawsze — zmieniają się tylko ich współrzędne na boisku.
const FORMATION_COORDS = {
  '':          {11:{x:22,y:13}, 9:{x:50,y:10}, 7:{x:78,y:13}, 8:{x:37,y:33}, 10:{x:63,y:33}, 6:{x:50,y:53}, 3:{x:18,y:66}, 2:{x:82,y:66}, 5:{x:37,y:79}, 4:{x:63,y:79}, 1:{x:50,y:93}},
  '1-4-3-3':   {11:{x:22,y:13}, 9:{x:50,y:10}, 7:{x:78,y:13}, 8:{x:37,y:33}, 10:{x:63,y:33}, 6:{x:50,y:53}, 3:{x:18,y:66}, 2:{x:82,y:66}, 5:{x:37,y:79}, 4:{x:63,y:79}, 1:{x:50,y:93}},
  '1-4-4-2':   {9:{x:39,y:10}, 10:{x:61,y:10}, 11:{x:18,y:33}, 7:{x:82,y:33}, 6:{x:61,y:51}, 8:{x:39,y:51}, 3:{x:18,y:66}, 2:{x:82,y:66}, 5:{x:37,y:79}, 4:{x:63,y:79}, 1:{x:50,y:93}},
  // 1-3-4-3: naprawione — 3 obrońców (5,6,4) + 4 pomocników (wahadłowi 3/2 + środkowi 8/10), zgodnie z nazwą systemu.
  '1-3-4-3':   {11:{x:22,y:13}, 9:{x:50,y:10}, 7:{x:78,y:13}, 3:{x:16,y:38}, 8:{x:39,y:38}, 10:{x:61,y:38}, 2:{x:84,y:38}, 5:{x:31,y:72}, 6:{x:50,y:72}, 4:{x:69,y:72}, 1:{x:50,y:93}},
  // 1-3-5-2: naprawione — 3 obrońców (5,6,4) + 5 pomocników (wahadłowi 3/2 + szerocy 11/7 + środkowy 8).
  '1-3-5-2':   {9:{x:39,y:10}, 10:{x:61,y:10}, 11:{x:20,y:36}, 8:{x:50,y:36}, 7:{x:80,y:36}, 3:{x:15,y:54}, 2:{x:85,y:54}, 5:{x:31,y:74}, 6:{x:50,y:74}, 4:{x:69,y:74}, 1:{x:50,y:93}},
  '1-4-5-1':   {9:{x:50,y:10}, 11:{x:20,y:29}, 7:{x:80,y:29}, 8:{x:32,y:46}, 6:{x:50,y:46}, 10:{x:68,y:46}, 3:{x:18,y:66}, 2:{x:82,y:66}, 5:{x:37,y:79}, 4:{x:63,y:79}, 1:{x:50,y:93}},
  // 1-5-4-1: naprawione — 5 obrońców (3,5,6,4,2, w tym wahadłowi na skrajach) + 4 pomocników (11,8,10,7).
  '1-5-4-1':   {9:{x:50,y:10}, 11:{x:22,y:36}, 8:{x:41,y:36}, 10:{x:59,y:36}, 7:{x:78,y:36}, 3:{x:14,y:70}, 5:{x:32,y:70}, 6:{x:50,y:70}, 4:{x:68,y:70}, 2:{x:86,y:70}, 1:{x:50,y:93}},
  '1-4-2-3-1': {9:{x:50,y:10}, 11:{x:20,y:29}, 10:{x:50,y:29}, 7:{x:80,y:29}, 6:{x:38,y:49}, 8:{x:62,y:49}, 3:{x:18,y:66}, 2:{x:82,y:66}, 5:{x:37,y:79}, 4:{x:63,y:79}, 1:{x:50,y:93}},
};
function positionMapKey(league, formation, number){ return league+'|||'+(formation||'wszystkie')+'|||'+number; }
// Automatyczna podpowiedź: najlepiej ocenieni zawodnicy danej ligi na tej pozycji (wg pola "Pozycja" w profilu),
// posortowani wg średniej oceny. Jeśli wybrano konkretny system gry, dodatkowo wymaga, aby zawodnik miał
// wpisany dokładnie ten system w swoim profilu. rankOffset rozdziela pulę między sparowane pozycje
// (np. lewy/prawy obrońca), żeby nie pokazywały dokładnie tych samych nazwisk.
function buildAutoPositionCandidates(league, formation, number){
  const posDef = POSITION_NUMBERS.find(p=>p.number===number);
  if(!posDef) return [];
  // Na mapę wchodzi każdy, kogo AKTYWNIE prowadzisz: ze statusem decyzyjnym albo z Monitoringu.
  // Wcześniej liczyły się wyłącznie dwa statusy, przez co zawodnik „Rekomendowany" albo świeżo
  // dodany do Monitoringu nie pojawiał się nigdzie — a to on jest przedmiotem pracy skautingowej.
  const kwalifikujeSie = (p)=> p.status==='Do transferu' || p.status==='Na Testy' || !!p.monitored;
  const statusRank = {'Do transferu':0, 'Na Testy':1};
  const rangaZawodnika = (p)=> statusRank[p.status] !== undefined ? statusRank[p.status] : 2;
  const candidates = DB.players
    // System gry: po wybraniu konkretnego układu zawodnik pojawia się WYŁĄCZNIE w tym, który ma
    // zapisany w profilu. Wcześniej ci bez wpisanego systemu wchodzili do każdego układu naraz,
    // przez co ten sam zawodnik widniał we wszystkich systemach i mapa przestawała cokolwiek
    // rozróżniać. Kto nie ma systemu w profilu, jest widoczny pod „Wszystkie systemy".
    .filter(p => clubLeague(p.clubId)===league && p.position===posDef.posName && (!formation || p.formation===formation)
      && kwalifikujeSie(p))
    .map(p => ({p, a: playerAvg(p.id)}))
    // NIE wymagamy obserwacji — zawodnik z samą decyzją statusu (z raportu) też trafia na mapę.
    .sort((a,b) => {
      const s = rangaZawodnika(a.p) - rangaZawodnika(b.p);   // Do transferu, potem Na Testy, na końcu Monitoring
      if(s !== 0) return s;
      return ((b.a&&b.a.overall!=null)? b.a.overall : -1) - ((a.a&&a.a.overall!=null)? a.a.overall : -1);     // potem wg średniej oceny (z raportów)
    });
  const offset = posDef.rankOffset || 0;
  return candidates.slice(offset, offset+6).map(x=>x.p.id);
}
async function reorderPositionMapPlayer(league, formation, number, playerId, targetIndex){
  const key = positionMapKey(league, formation, number);
  const ids = (positionMapAssignments[key] || []).slice();
  const fromIndex = ids.indexOf(playerId);
  if(fromIndex === -1) return;
  ids.splice(fromIndex, 1);
  const clamped = Math.max(0, Math.min(targetIndex, ids.length));
  ids.splice(clamped, 0, playerId);
  positionMapAssignments[key] = ids;
  await savePositionMapAssignments();
}
// Klucz listy zawodników RĘCZNIE USUNIĘTYCH z danej pozycji.
//
// Bez niej usuwanie z mapy nie działało: kasowanie zdejmowało zawodnika z przypisań, ale przy
// najbliższym przerysowaniu automat wstawiał go z powrotem, bo wciąż spełniał warunki. Z zewnątrz
// wyglądało to tak, jakby przycisk „usuń" był martwy.
const kluczWykluczonych = (key) => key + '|||wykluczeni';

// Wyróżnieni zawodnicy Z OBSERWACJI MECZOWYCH trafiają na mapę — do systemu, którym grał ich
// zespół, i na pozycję wskazaną na planszy w telefonie.
//
// Liczy się to przy każdym wejściu na mapę, a nie w chwili zapisu z telefonu. Dzięki temu działa
// także dla meczów obejrzanych WCZEŚNIEJ, bez powtarzania pracy — a jedna implementacja obsługuje
// obie drogi zamiast dwóch, które musiałyby się zgadzać.
function wyroznieniZMeczow(liga, system){
  if(!system) return {};       // „Wszystkie systemy" — bez przypisań do konkretnych pozycji
  const wg = {};               // numer pozycji -> [playerId]
  const kluczOsoby = (s)=> String(s||'').split(/\s+/).map(importNorm).filter(Boolean).sort().join(' ');

  DB.observations.forEach(o=>{
    const sklad = o.skladMeczu;
    if(!sklad) return;
    ['gospodarze','goscie'].forEach(strona=>{
      const dane = sklad[strona];
      if(!dane || dane.formacja !== system) return;
      (dane.zawodnicy||[]).forEach(z=>{
        if(!z.pozycja) return;
        const oceniony = z.ocena && Object.values(z.ocena).some(n=>Number(n)>0);
        if(!oceniony && !z.wyrozniony && !z.notatka) return;
        // Dopasowanie po ZBIORZE słów — protokoły podają raz „Jan Kowalski", raz „Kowalski Jan".
        const szukany = kluczOsoby(z.nazwa);
        let kand = DB.players.filter(p=> kluczOsoby(`${p.firstName||''} ${p.lastName||''}`) === szukany);
        if(kand.length > 1 && dane.nazwa){
          const k = importNorm(dane.nazwa);
          const wKlubie = kand.filter(p=>{
            const n = importNorm(clubName(p.clubId));
            return n && (n===k || (n.length>=5 && k.length>=5 && (n.includes(k)||k.includes(n))));
          });
          if(wKlubie.length === 1) kand = wKlubie;
        }
        // Niejednoznaczność zostawiamy bez rozstrzygnięcia — lepiej nie pokazać nikogo,
        // niż postawić na mapie niewłaściwego zawodnika.
        if(kand.length !== 1) return;
        if(clubLeague(kand[0].clubId) !== liga) return;
        (wg[z.pozycja] = wg[z.pozycja] || []).push(kand[0].id);
      });
    });
  });
  return wg;
}

function viewRankingNumbersMode(){
  // Zbierz WSZYSTKIE automatyczne uzupełnienia w jednym przebiegu i zapisz JEDEN raz — wywoływanie zapisu
  // osobno dla każdej z 11 pozycji powodowało równoczesne zapisy do tego samego klucza i błędy magazynu.
  let anyChanged = false;
  let anyRealCandidatesFound = false;
  const zMeczow = wyroznieniZMeczow(rankingLeague, rankingFormationFilter);
  POSITION_NUMBERS.forEach(posDef=>{
    const key = positionMapKey(rankingLeague, rankingFormationFilter, posDef.number);
    const wykluczeni = positionMapAssignments[kluczWykluczonych(key)] || [];
    // Zawodnicy wskazani na planszy w telefonie idą PRZED podpowiedziami automatu: to konkretna
    // decyzja skauta z konkretnego meczu, a nie wynik sortowania po średniej.
    const zMeczu = (zMeczow[posDef.number] || []).filter(id=> !wykluczeni.includes(id));
    const auto = [...zMeczu, ...buildAutoPositionCandidates(rankingLeague, rankingFormationFilter, posDef.number)
      .filter(id=> !wykluczeni.includes(id) && !zMeczu.includes(id))];
    if(positionMapAssignments[key] === undefined){
      positionMapAssignments[key] = auto;
      anyChanged = true;
    } else {
      // Dołącz automatycznie zawodników ze statusem (Do transferu/Testy), których jeszcze nie ma na tej
      // pozycji — "Do transferu" na początek (priorytet), "Na Testy" na koniec. Cap 6 na pozycję.
      let cur = positionMapAssignments[key];
      // Sprzątanie po starej regule: dopóki zawodnik bez wpisanego systemu wchodził do KAŻDEGO
      // układu, jego identyfikator zapisał się na mapie wszystkich systemów. Sama zmiana warunku
      // by go stąd nie usunęła, bo przypisania są zapamiętane — więc odsiewamy je przy wczytaniu.
      // Zawodnika przypisanego RĘCZNIE to nie dotyczy tylko wtedy, gdy ma zgodny system.
      if(rankingFormationFilter){
        const przefiltrowane = cur.filter(id=>{
          // Zawodnik wskazany na planszy w tym systemie zostaje, nawet jeśli w profilu nie ma
          // wpisanego systemu gry. Zaznaczenie go na boisku w telefonie JEST tą informacją —
          // odsianie go tutaj kasowałoby dopiero co wykonaną pracę.
          if(zMeczu.includes(id)) return true;
          if(wykluczeni.includes(id)) return false;
          const pl = DB.players.find(p=>p.id===id);
          return !pl || pl.formation === rankingFormationFilter;
        });
        if(przefiltrowane.length !== cur.length){
          positionMapAssignments[key] = przefiltrowane;
          cur = przefiltrowane;
          anyChanged = true;
        }
      }
      auto.forEach(id=>{
        if(cur.includes(id) || cur.length >= 6) return;
        const pl = DB.players.find(p=>p.id===id);
        if(pl && pl.status==='Do transferu') cur.unshift(id); else cur.push(id);
        anyChanged = true;
      });
    }
    if((positionMapAssignments[key]||[]).length>0) anyRealCandidatesFound = true;
  });
  if(anyChanged) savePositionMapAssignments();

  // Ilu zawodników wypada z widoku TYLKO dlatego, że nie mają wpisanego systemu gry. Bez tej
  // informacji znikaliby po cichu i wyglądałoby to na zgubione dane.
  const bezSystemu = rankingFormationFilter
    ? DB.players.filter(p => clubLeague(p.clubId)===rankingLeague && !p.formation
        && (p.status==='Do transferu' || p.status==='Na Testy' || !!p.monitored)
        && POSITION_NUMBERS.some(pd => pd.posName === p.position)).length
    : 0;

  const activeCoords = FORMATION_COORDS[rankingFormationFilter] || FORMATION_COORDS[''];

  const markerHtml = (posDef)=>{
    const coord = activeCoords[posDef.number];
    const key = positionMapKey(rankingLeague, rankingFormationFilter, posDef.number);
    const ids = positionMapAssignments[key] || [];
    const isGk = posDef.number === 1;
    const playerRowsHtml = ids.map(id=>{
      const pl = DB.players.find(p=>p.id===id);
      if(!pl) return '';
      // Kolor wg statusu: „Do transferu" = złoto; „Na Testy" i pozostałe = bez koloru (neutralnie).
      const statusCls = pl.status==='Do transferu' ? ' pmr-transfer' : '';
      return `<span class="pos-marker-row${statusCls}" title="${esc(pl.status||'')}">${crestImg(clubCrest(pl.clubId),'xs',clubName(pl.clubId))}<span class="pmr-name">${esc(pl.lastName || pl.firstName || '—')}</span>${pl.birthYear?`<span class="pmr-year">${esc(pl.birthYear)}</span>`:''}</span>`;
    }).join('');
    return `
    <div class="pos-marker" style="left:${coord.x}%;top:${coord.y}%;" data-action="position-slot-click" data-number="${posDef.number}" title="${esc(posDef.label)} — kliknij, aby zarządzać (do 6 zawodników)">
      <span class="pos-marker-dot ${isGk?'gk':''}">${posDef.number}</span>
      <span class="pos-marker-tag">${ids.length ? playerRowsHtml : '<span class="pos-marker-row pmr-empty">—</span>'}</span>
    </div>`;
  };

  const markersHtml = POSITION_NUMBERS.map(markerHtml).join('');
  const logoEl = document.querySelector('.brand-logo');
  const logoSrc = logoEl ? logoEl.src : '';

  return `
  <div class="pitch-wrap-outer">
  <div class="position-map-pitch">
    <div class="pitch-deco">
      <div class="pitch-deco-box pitch-deco-box-top"></div>
      <div class="pitch-deco-goal pitch-deco-goal-top"></div>
      <div class="pitch-deco-circle"></div>
      <div class="pitch-deco-line"></div>
      <div class="pitch-deco-box pitch-deco-box-bottom"></div>
      <div class="pitch-deco-goal pitch-deco-goal-bottom"></div>
      <div class="pitch-deco-arc pitch-deco-arc-top"></div>
      <div class="pitch-deco-arc pitch-deco-arc-bottom"></div>
    </div>
    ${logoSrc ? `<img src="${logoSrc}" class="pitch-watermark" alt="">` : ''}
    <div class="position-map-content">
      ${markersHtml}
    </div>
  </div>
  </div>
  <p class="note" style="margin-top:10px;">Kliknij dowolną pozycję na boisku, aby dodać, usunąć lub przeciągnięciem zmienić kolejność zawodników (do 6 na pozycję, dwa pierwsze miejsca = priorytetowi).
  ${rankingFormationFilter? ` Układ pól odzwierciedla kształt systemu ${esc(rankingFormationFilter)}.` : ''}
  ${!anyRealCandidatesFound? ' Mapa jest pusta, bo w tej lidze nikt nie jest ani w Monitoringu, ani ze statusem „Do transferu" / „Na Testy" — to oni wypełniają mapę. Dodaj kogoś do Monitoringu albo nadaj status w profilu zawodnika.' : ''}
  ${bezSystemu? ` <strong>Poza tym systemem:</strong> ${bezSystemu} zawodnik(ów) tej ligi ma status kwalifikujący, ale w profilu nie ma wpisanego systemu gry — zobaczysz ich pod „Wszystkie systemy" albo po uzupełnieniu systemu w profilu.` : ''}</p>`;
}

function viewRanking(){
  if(!rankingLeague || !DB.settings.leagues.includes(rankingLeague)) rankingLeague = DB.settings.leagues[0];

  const leagueOptions = DB.settings.leagues.map(l =>
    `<option value="${esc(l)}" ${l===rankingLeague?'selected':''}>${esc(l)}</option>`
  ).join('');
  const formationOptions = `<option value="" ${!rankingFormationFilter?'selected':''}>Wszystkie systemy</option>` +
    FORMATIONS.filter(f => f!=='1-4-5-1' && f!=='1-5-4-1').map(f => `<option value="${esc(f)}" ${f===rankingFormationFilter?'selected':''}>${esc(f)}</option>`).join('');

  return `
  <h2 class="view-title" style="margin-bottom:4px;">Mapa rankingowa</h2>
  <p class="view-sub" style="margin-bottom:10px;">Pozycje wypełniają się automatycznie najlepiej ocenionymi zawodnikami. Dwa pierwsze miejsca (złote obramowanie w liście) to zawodnicy priorytetowi.</p>
  <div class="card" style="margin-bottom:12px;padding:12px 14px;">
    <div class="grid grid-2">
      <div class="field-wrap" style="margin:0;">
        <label class="field" style="display:block;margin-bottom:4px;">Liga</label>
        <select id="ranking-league-select" style="width:100%;">${leagueOptions}</select>
      </div>
      <div class="field-wrap" style="margin:0;">
        <label class="field" style="display:block;margin-bottom:4px;">System gry</label>
        <select id="ranking-formation-filter-select" style="width:100%;">${formationOptions}</select>
      </div>
    </div>
  </div>
  ${viewRankingNumbersMode()}`;
}

// ---------- MONITORING ----------
function viewObservedList(){
  const STATUS_ORDER = {"Do transferu":0, "Na Testy":1, "Rekomendowany":2, "Do Obserwacji":3};
  let rows = DB.players.filter(p => p.status !== 'Odrzucony').map(p=>{
    const a = playerAvg(p.id);
    return {p, a};
  });
  rows.sort((a,b)=>{
    const rankA = STATUS_ORDER[a.p.status] !== undefined ? STATUS_ORDER[a.p.status] : 9;
    const rankB = STATUS_ORDER[b.p.status] !== undefined ? STATUS_ORDER[b.p.status] : 9;
    if(rankA !== rankB) return rankA - rankB;
    return ((b.a&&b.a.overall!=null)?b.a.overall:0) - ((a.a&&a.a.overall!=null)?a.a.overall:0);
  });
  const trs = rows.map(({p,a})=>{
    return `<tr>
      <td><strong>${esc(p.lastName)} ${esc(p.firstName)}</strong></td>
      <td>${esc(clubName(p.clubId))}</td>
      <td>${esc(p.position||'—')}</td>
      <td><span class="badge">${esc(p.status||'—')}</span></td>
      <td>${fmtAvg(a)}</td>
      <td><button class="link-btn" data-action="view-player" data-id="${p.id}">Zobacz</button></td>
    </tr>`;
  }).join('');
  return `
  <h2 class="view-title">Lista obserwowanych</h2>
  <p class="view-sub">Wszyscy zawodnicy w bazie z wyjątkiem odrzuconych — Twoja aktywna lista scoutingowa.</p>
  <div class="card" style="padding:0;overflow:auto;">
    <table>
      <thead><tr><th>Zawodnik</th><th>Klub</th><th>Pozycja</th><th>Status</th><th>Śr. ocena</th><th></th></tr></thead>
      <tbody>${trs || `<tr><td colspan="6"><div class="empty">Brak zawodników na liście — wszyscy mają status "Odrzucony", albo baza jest pusta.</div></td></tr>`}</tbody>
    </table>
  </div>`;
}

// Kolor wiersza wg statusu (jak w raporcie): Do transferu = złoto, reszta wg statusu.
const COMMITTEE_ROW_CLASS = {
  'Do transferu':'crow-transfer', 'Na Testy':'crow-trial', 'Rekomendowany':'crow-reco',
  'Z polecenia':'crow-reco', 'Do Obserwacji':'crow-watching', 'Odrzucony':'crow-rejected'
};
function viewTransferCommittee(){
  // Pokazuj wszystkich zawodników z nadanym statusem. „Do transferu" zawsze na górze i alfabetycznie,
  // każdy inny status niżej (też alfabetycznie). Sort działa na każdym renderze, więc po zmianie
  // statusu lista sama się przekłada.
  const rows = DB.players.filter(p => p.status && p.status.trim())
    .sort((a,b)=> ((a.status==='Do transferu'?0:1)-(b.status==='Do transferu'?0:1))
      || (a.lastName||'').localeCompare(b.lastName||'','pl')
      || (a.firstName||'').localeCompare(b.firstName||'','pl'));
  const trs = rows.map(p=>{
    const a = playerAvg(p.id);
    const rowCls = COMMITTEE_ROW_CLASS[p.status] || '';
    return `<tr data-id="${p.id}" class="${rowCls}">
      <td><strong data-action="view-player" data-id="${p.id}" style="cursor:pointer;">${esc(p.lastName)} ${esc(p.firstName)}</strong></td>
      <td>${esc(clubName(p.clubId))}</td>
      <td>${esc(p.position||'—')}</td>
      <td><span class="badge ${STATUS_CLASS[p.status]||'new'}">${esc(p.status)}</span></td>
      <td>${fmtAvg(a)}</td>
      <td>
        <select class="committee-decision-select" data-id="${p.id}">
          <option value="" ${!p.committeeDecision?'selected':''}>Do rozpatrzenia</option>
          <option value="Zatwierdzony" ${p.committeeDecision==='Zatwierdzony'?'selected':''}>Zatwierdzony</option>
          <option value="Do dalszej analizy" ${p.committeeDecision==='Do dalszej analizy'?'selected':''}>Do dalszej analizy</option>
          <option value="Odrzucony przez komitet" ${p.committeeDecision==='Odrzucony przez komitet'?'selected':''}>Odrzucony przez komitet</option>
        </select>
      </td>
      <td><input class="committee-notes-input" data-id="${p.id}" value="${esc(p.committeeNotes||'')}" placeholder="Notatka komitetu"></td>
      <td><button class="link-btn" data-action="open-committee-reports" data-id="${p.id}">📄 Raporty (${(p.committeeReports||[]).length})</button></td>
      <td><button class="gold" data-action="analyze-player" data-id="${p.id}" style="padding:5px 12px;font-size:12px;white-space:nowrap;">🔍 Analizuj</button></td>
    </tr>`;
  }).join('');
  return `
  <h2 class="view-title">Komitet Transferowy</h2>
  <p class="view-sub">Zawodnicy z nadanym statusem — „Do transferu" (złoto) na górze, reszta niżej; wszystko alfabetycznie. Miejsce na finalną decyzję komitetu.</p>
  <div class="card" style="padding:0;overflow:auto;">
    <table>
      <thead><tr><th>Zawodnik</th><th>Klub</th><th>Pozycja</th><th>Status</th><th>Śr. ocena</th><th>Decyzja komitetu</th><th>Notatka</th><th>Raporty</th><th>Analiza</th></tr></thead>
      <tbody>${trs || `<tr><td colspan="9"><div class="empty">Brak zawodników z nadanym statusem — ustaw status zawodnika w jego profilu, aby pojawił się tutaj.</div></td></tr>`}</tbody>
    </table>
  </div>`;
}

// Niezależna analiza zawodnika na podstawie DANYCH (obserwacje, oceny, statystyki, wiek, raporty). To
// transparentna logika scoutingowa — pokazuje nie tylko wynik, ale też pewność danych i okno rozwoju,
// żeby zminimalizować granicę błędu transferowego. (Narracyjną analizę LLM/Claude da się dopiąć po
// podłączeniu klucza API + małego proxy — patrz opis pod przyciskiem.)
function analyzePlayer(p){
  const a = playerAvg(p.id);
  const obs = playerObs(p.id);
  const reports = playerReports(p.id);
  const age = p.birthYear ? (new Date().getFullYear() - Number(p.birthYear)) : null;
  const overall = a ? a.overall : null;

  // Mocne i słabe strony liczymy z tego samego materiału co radar: ocen w raportach (fazy gry +
  // stałe fragmenty). Stare oceny obserwacji zostają awaryjnie, dla zawodników sprzed zmiany.
  let strengths = [], weaknesses = [];
  if(a && a.metryki && a.metryki.length >= 3){
    const e = a.metryki.map(m=>({k:m.key, etykieta:m.label, v:m.wartosc})).sort((x,y)=>y.v-x.v);
    strengths = e.slice(0,2);
    weaknesses = e.slice(-2).reverse();
  } else if(a && a.avgs){
    const e = RATING_KEYS.map(k=>({k, v:a.avgs[k]})).sort((x,y)=>y.v-x.v);
    strengths = e.slice(0,2);
    weaknesses = e.slice(-2).reverse();
  }
  // Trend: średnia pierwszej połowy obserwacji vs druga połowa.
  let trend = null;
  if(obs.length >= 2){
    const half = Math.floor(obs.length/2) || 1;
    const mean = arr => arr.reduce((s,o)=> s + RATING_KEYS.reduce((a2,k)=>a2+(Number(o.ratings[k])||0),0)/RATING_KEYS.length, 0) / arr.length;
    trend = mean(obs.slice(half)) - mean(obs.slice(0, half));
  }
  // Okno rozwoju wg wieku.
  let devNote, devBonus;
  if(age==null){ devNote='Brak rocznika — nie oszacowano okna rozwoju.'; devBonus=0; }
  else if(age<=18){ devNote=`Bardzo młody (${age} l.) — duży zapas rozwoju.`; devBonus=12; }
  else if(age<=21){ devNote=`Młody (${age} l.) — wysoki potencjał rozwoju.`; devBonus=9; }
  else if(age<=25){ devNote=`Wiek rozwojowo-optymalny (${age} l.).`; devBonus=5; }
  else if(age<=29){ devNote=`Szczyt formy (${age} l.) — mały zapas rozwoju.`; devBonus=1; }
  else { devNote=`Doświadczony (${age} l.) — rozwój ograniczony, liczy się forma bieżąca.`; devBonus=0; }
  // Pewność / granica błędu wg ilości danych.
  const nData = (a?a.count:0) + reports.length;
  let confidence, errorMargin, confPenalty;
  if(nData===0){ confidence='brak danych'; errorMargin='bardzo wysoka'; confPenalty=0.55; }
  else if(nData<3){ confidence='niska'; errorMargin='wysoka'; confPenalty=0.8; }
  else if(nData<6){ confidence='umiarkowana'; errorMargin='średnia'; confPenalty=0.92; }
  else { confidence='wysoka'; errorMargin='niska'; confPenalty=1; }
  // Niezależny wskaźnik 0-100.
  let score = null;
  if(overall!=null){
    let s = (overall/10)*72;                                   // baza z ocen (0-72)
    if(trend!=null) s += Math.max(-8, Math.min(8, trend*8));   // trend +/-8
    s += devBonus;                                             // okno rozwoju (0-12)
    s *= confPenalty;                                          // kara za niepewność danych
    score = Math.max(0, Math.min(100, Math.round(s)));
  }
  // Rekomendacja niezależna.
  let reco, recoTone;
  if(overall==null){ reco='Zbyt mało danych — potrzebne pierwsze obserwacje przed decyzją.'; recoTone='hold'; }
  else if(score>=75){ reco='TRANSFER — wysoki poziom przy wiarygodnych danych.'; recoTone='go'; }
  else if(score>=60){ reco='TESTY / dalsza obserwacja — obiecujący, potwierdzić w kolejnych meczach.'; recoTone='test'; }
  else if(score>=45){ reco='OBSERWACJA — przeciętny profil, monitorować rozwój.'; recoTone='watch'; }
  else { reco='NIŻSZY PRIORYTET — poziom poniżej progu transferowego.'; recoTone='no'; }
  return {a, overall, score, strengths, weaknesses, trend, age, devNote, nData, confidence, errorMargin, reco, recoTone, obs, reports};
}

function openPlayerAnalysisModal(playerId){
  const existing = document.querySelector('.modal-overlay[data-analysis-for]');
  if(existing) existing.remove();
  const p = DB.players.find(x=>x.id===playerId);
  if(!p) return;
  const an = analyzePlayer(p);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.dataset.analysisFor = playerId;
  const tone = {go:'var(--good)', test:'var(--gold)', watch:'var(--gold-dark)', no:'var(--clay)', hold:'var(--ink-soft)'}[an.recoTone];
  const trendTxt = an.trend==null ? 'brak (za mało obserwacji)' : (an.trend>0.15?`↑ poprawa (+${fmt1(an.trend)})` : an.trend<-0.15?`↓ spadek (${fmt1(an.trend)})` : '→ stabilnie');
  overlay.innerHTML = `
  <div class="modal" style="max-width:640px;">
    <h3>Analiza zawodnika — ${esc(p.firstName)} ${esc(p.lastName)}</h3>
    <p class="note" style="margin-top:-6px;">Niezależna analiza na podstawie danych (obserwacje, oceny, wiek, statystyki), by minimalizować granicę błędu transferowego — nie zastępuje obserwacji na żywo.</p>
    <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;margin:12px 0;">
      <div style="text-align:center;">
        <div style="font-size:40px;font-weight:800;color:${tone};line-height:1;">${an.score!=null?an.score:'—'}</div>
        <div class="note">Wskaźnik /100</div>
      </div>
      <div style="flex:1;min-width:220px;">
        <div style="font-weight:800;color:${tone};font-size:15px;">${esc(an.reco)}</div>
        <div class="note" style="margin-top:4px;">Śr. ocena (z raportów): <strong>${an.overall!=null?fmt1(an.overall):'—'}/6</strong> · Trend: ${trendTxt} · Pewność: <strong>${esc(an.confidence)}</strong> (granica błędu: ${esc(an.errorMargin)})</div>
      </div>
    </div>
    ${(an.a && an.a.metryki && an.a.metryki.length>=3) ? `<div style="text-align:center;">${radarRaportow(an.a.metryki)}</div>`
      : (an.a && an.a.avgs) ? radarSvg([{label:p.lastName, avgs:an.a.avgs, count:an.a.count}])
      : '<div class="empty">Brak ocen liczbowych — wypełnij raport, aby analiza była pełna.</div>'}
    <div class="grid grid-2" style="margin-top:12px;">
      <div><label class="field">Mocne strony</label>${an.strengths.length? `<ul style="margin:4px 0;padding-left:18px;">${an.strengths.map(s=>`<li>${esc(s.etykieta||RATING_LABELS[s.k]||s.k)} (${fmt1(s.v)})</li>`).join('')}</ul>` : '<div class="note">Brak danych</div>'}</div>
      <div><label class="field">Do poprawy</label>${an.weaknesses.length? `<ul style="margin:4px 0;padding-left:18px;">${an.weaknesses.map(s=>`<li>${esc(s.etykieta||RATING_LABELS[s.k]||s.k)} (${fmt1(s.v)})</li>`).join('')}</ul>` : '<div class="note">Brak danych</div>'}</div>
    </div>
    <div style="margin-top:10px;"><label class="field">Potencjał rozwoju</label><div style="font-size:13px;">${esc(an.devNote)}</div></div>
    <div class="note" style="margin-top:10px;">Podstawa: ${an.a?an.a.count:0} obserwacji, ${an.reports.length} raportów.${an.nData<3?' ⚠️ Mała próba — oprzyj decyzję też na obserwacji na żywo.':''}</div>
    <div class="modal-actions"><button class="secondary" data-action="close-analysis">Zamknij</button></div>
  </div>`;
  overlay.querySelector('[data-action="close-analysis"]').onclick = ()=>overlay.remove();
  overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

const MONITORING_STATUSES = ['Do Obserwacji','Na Testy','Do transferu','Z polecenia'];
function viewMonitoring(){
  // Pokazuj zawodników dodanych ręcznie ORAZ tych z decyzją statusu z raportu (pierwsze cztery opcje).
  let base = DB.players.filter(p => (p.monitored || p.source==='manual' || MONITORING_STATUSES.includes(p.status)) && !p.watchlistRemoved);
  // Wyszukiwanie według słów: każde wpisane słowo musi pasować do nazwiska/imienia/klubu/regionu/pozycji.
  if(monitoringSearchQuery.trim()){
    const words = monitoringSearchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    base = base.filter(p=>{
      const hay = [p.firstName, p.lastName, clubName(p.clubId), clubRegion(p.clubId), p.position, p.status, p.birthYear].join(' ').toLowerCase();
      return words.every(w=>hay.includes(w));
    });
  }
  let rows = base.map(p=>{
    const a = playerAvg(p.id);
    const ds = a? daysSince(a.last.date) : null;
    let priority = "Brak obserwacji";
    if(a){
      if(ds>45) priority="Pilne";
      else if(a.overall!=null && a.overall>=5) priority="Top talent";   // skala 1-6 (śr. z raportów)
      else priority="Standardowy";
    }
    return {p,a,ds,priority};
  });
  rows.sort((a,b)=>{
    const rank = {"Pilne":0,"Top talent":1,"Standardowy":2,"Brak obserwacji":3};
    const wgPriorytetu = rank[a.priority]-rank[b.priority];
    if(wgPriorytetu) return wgPriorytetu;
    // W obrębie tego samego priorytetu — alfabetycznie po nazwisku (a przy równych nazwiskach po
    // imieniu). Dotąd zostawała tu kolejność dodawania do bazy, czyli dla oka przypadkowa:
    // na liście kilkuset zawodników nie dało się znaleźć nikogo wzrokiem.
    return (a.p.lastName||a.p.firstName||'').localeCompare(b.p.lastName||b.p.firstName||'','pl')
        || (a.p.firstName||'').localeCompare(b.p.firstName||'','pl');
  });
  const trs = rows.map(({p,a,ds,priority})=>{
    const pillClass = priority==="Pilne"?"pill-urgent": priority==="Top talent"?"pill-top":"pill-ok";
    return `<tr>
      <td><strong>${esc(p.lastName)} ${esc(p.firstName)}</strong></td>
      <td>${p.birthYear||"—"}${isYouthPlayer(p)?youthBadge():''}</td>
      <td>${esc(clubName(p.clubId))}</td>
      <td>${esc(clubRegion(p.clubId))}</td>
      <td>${a? a.count : 0}</td>
      <td>${fmtAvg(a)}</td>
      <td>${a? a.last.date : "—"}</td>
      <td>${ds!==null? ds+" dni" : "—"}</td>
      <td>${p.hasAgent
        ? `<span class="agent-yes">Tak</span>`
        // Gwiazdka przy „Nie" w Monitoringu: zawodnik jest już na Twojej liście i NIKT go nie
        // reprezentuje. To najkrótsze okno na kontakt, więc musi rzucać się w oczy bez czytania
        // całego wiersza.
        : `<span class="agent-no">Nie</span> <span title="Bez menedżera, a jest w Monitoringu — otwarte pole do kontaktu" style="color:var(--gold);font-size:15px;line-height:1;">★</span>`}</td>
      <td><span class="badge ${pillClass}" style="border-radius:6px;">${priority}</span></td>
      <td style="white-space:nowrap;">
        <button class="link-btn" data-action="monitoring-plan-obs" data-id="${p.id}" style="color:var(--gold-dark);">📅 Zaplanuj obserwację</button>
        <button class="link-btn" data-action="view-player" data-id="${p.id}" style="margin-left:8px;">Zobacz</button>
        <button class="link-btn" data-action="monitoring-remove" data-id="${p.id}" style="color:var(--clay-dark);margin-left:8px;">Usuń</button>
      </td>
    </tr>`;
  }).join('');
  return `
  <h2 class="view-title">Monitoring / Watchlist</h2>
  <p class="view-sub">Automatyczne zestawienie — kto wymaga ponownej obserwacji, kto jest top talentem. Pokazuje tylko zawodników dodanych ręcznie przez Ciebie (nie masowe importy składów).</p>
  <div class="toolbar" style="margin-bottom:10px;">
    <input id="monitoring-search" placeholder="Szukaj po nazwisku, klubie, regionie, pozycji…" value="${esc(monitoringSearchQuery)}" style="max-width:360px;">
  </div>
  <div class="card" style="padding:0;overflow:auto;">
    <table>
      <thead><tr><th>Zawodnik</th><th>Rocznik</th><th>Klub</th><th>Region</th><th>Obs.</th><th>Śr. ocena</th><th>Ostatnia obs.</th><th>Dni temu</th><th>Agent</th><th>Priorytet</th><th></th></tr></thead>
      <tbody>${trs || `<tr><td colspan="11"><div class="empty">Brak ręcznie dodanych zawodników — ci z masowych importów składów tu się nie pokazują. Dodaj zawodnika przez "Zawodnicy → Dodaj zawodnika", aby pojawił się na tej liście.</div></td></tr>`}</tbody>
    </table>
  </div>`;
}

// ---------- SETTINGS ----------
function viewSettings(){
  function block(key,title,hint){
    const items = DB.settings[key];
    return `
    <div class="settings-block">
      <h4>${title}</h4>
      <p class="note">${hint}</p>
      <div class="tag-list">${items.map((it,i)=>`<span class="tag">${esc(it)}<button data-action="del-setting" data-key="${key}" data-idx="${i}">&times;</button></span>`).join('')}</div>
      <div class="add-row"><input id="add-${key}" placeholder="Dodaj nową pozycję..."><button class="secondary" data-action="add-setting" data-key="${key}">Dodaj</button></div>
    </div>`;
  }
  return `
  <h2 class="view-title">Ustawienia</h2>
  <p class="view-sub">Zarządzaj słownikami — regiony, ligi, pozycje, statusy i lista scoutów w zespole.</p>
  <div class="grid grid-2">
    <div class="card">
      ${block('regions','Regiony','Regiony, w których obecnie prowadzicie scouting.')}
      ${block('leagues','Ligi / poziom rozgrywek','III liga, IV liga, klasa okręgowa, kategorie juniorskie itd.')}
    </div>
    <div class="card">
      ${block('positions','Pozycje','Lista pozycji do wyboru w kartotece zawodnika.')}
      ${block('scouts','Scouci w zespole','Osoby, które wpisują obserwacje — pojawią się na liście na górze ekranu.')}
    </div>
  </div>
  <div class="card">
    ${block('customFields','Dodatkowe pola zawodnika','Własne pola, które pojawią się dodatkowo w formularzu zawodnika i w jego profilu — dodawaj dowolną ilość, kiedy tylko czegoś zabraknie w standardowej kartotece.')}
  </div>
  <div class="card">
    <h4 style="margin-top:0;">Kopia zapasowa</h4>
    <p class="note" style="margin-bottom:10px;">Zapisuje <strong>wszystkie</strong> dane do jednego pliku na Twoim dysku:
    zawodników, kluby, obserwacje, raporty, talenty, kontakty, agencje, menedżerów, terminarz, herby i ustawienia.
    Plik możesz trzymać gdziekolwiek — na dysku, w chmurze, na pendrivie.</p>
    <button class="gold" data-action="kopia-pobierz">⭳ Pobierz kopię wszystkich danych</button>
    <p class="note" style="margin:10px 0 14px;font-size:11.5px;">Supabase w darmowym planie <strong>nie robi kopii za Ciebie</strong>.
    Jedyna kopia to ta, którą pobierzesz sam. Warto po każdym większym imporcie.</p>

    <details>
      <summary style="cursor:pointer;font-size:12.5px;color:var(--ink-soft);">Przywracanie z pliku</summary>
      <p class="note" style="margin:8px 0;">Wczytanie kopii <strong>zastąpi</strong> dane w bazie tymi z pliku.
      Zanim cokolwiek podmienię, pobiorę automatycznie kopię stanu obecnego — żeby dało się cofnąć pomyłkę.</p>
      <input type="file" id="kopia-plik" accept=".json">
    </details>
  </div>
  <div class="card">
    <h4 style="margin-top:0;">Dane</h4>
    <p class="note">Baza jest współdzielona — wszyscy scouci widzą te same dane w czasie rzeczywistym.</p>
    <button class="secondary" data-action="import-znicz-roster" style="margin-bottom:10px;">Zaimportuj / uzupełnij znane składy klubów</button>
    <p class="note" style="margin-top:0;margin-bottom:14px;">Użyj tego przycisku, jeśli po otwarciu aplikacji skład Znicza Pruszków jest pusty — automatyczny import mógł się nie udać (np. chwilowy problem z zapisem). Można kliknąć bezpiecznie wielokrotnie — nie tworzy duplikatów.</p>
    <button class="danger" data-action="reset-all">Wyczyść całą bazę</button>
  </div>
  `;
}

// ---------- MODALS: player / club forms ----------
function openPlayerModal(id, presetClubId, prefillData){
  editingPlayerId = id;
  const p = id ? DB.players.find(x=>x.id===id) : (prefillData || null);
  const isNew = !id;
  const selectedClubId = (id && p) ? p.clubId : (presetClubId||"");
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
  <div class="modal">
    <h3>${isNew? (prefillData? 'Pełny profil zawodnika (z zakładki Talent)':'Nowy zawodnik') : 'Edytuj zawodnika'}</h3>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">Imię</label><input id="pm-first" value="${p?esc(p.firstName):''}"></div>
      <div class="field-wrap"><label class="field">Nazwisko</label><input id="pm-last" value="${p?esc(p.lastName):''}"></div>
    </div>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">Data urodzenia</label><input type="date" id="pm-birth" value="${p&&p.birthDate?p.birthDate:''}"></div>
      <div class="field-wrap"><label class="field">Pozycja</label><select id="pm-position">${DB.settings.positions.map(x=>`<option ${p&&p.position===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
    </div>
    <div class="grid grid-4">
      <div class="field-wrap"><label class="field">Noga</label><select id="pm-foot"><option ${p&&p.foot==='Prawa'?'selected':''}>Prawa</option><option ${p&&p.foot==='Lewa'?'selected':''}>Lewa</option><option ${p&&p.foot==='Obie'?'selected':''}>Obie</option></select></div>
      <div class="field-wrap"><label class="field">Wzrost (cm)</label><input type="number" id="pm-height" value="${p&&p.height?p.height:''}"></div>
      <div class="field-wrap"><label class="field">Status</label><select id="pm-status"><option value="" ${p&&!p.status?'selected':''}>— brak —</option>${DB.settings.statuses.map(x=>`<option ${p&&p.status===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="field-wrap"><label class="field">Narodowość</label><input id="pm-nationality" value="${p&&p.nationality?esc(p.nationality):''}" placeholder="np. Polska"></div>
    </div>
    <div class="field-wrap">
      <label class="field">System gry (formacja)</label>
      <select id="pm-formation">
        <option value="">— nie określono —</option>
        ${FORMATIONS.map(f=>`<option ${p&&p.formation===f?'selected':''}>${esc(f)}</option>`).join('')}
      </select>
    </div>
    <div class="grid grid-4">
      <div class="field-wrap"><label class="field">Mecze (sezon)</label><input type="number" min="0" id="pm-matches" value="${p&&p.matches!=null?p.matches:''}"></div>
      <div class="field-wrap"><label class="field">Minuty (sezon)</label><input type="number" min="0" id="pm-minutes" value="${p&&p.minutes!=null?p.minutes:''}"></div>
      <div class="field-wrap"><label class="field">Gole (sezon)</label><input type="number" min="0" id="pm-goals" value="${p&&p.goals!=null?p.goals:''}"></div>
      <div class="field-wrap"><label class="field">Asysty (sezon)</label><input type="number" min="0" id="pm-assists" value="${p&&p.assists!=null?p.assists:''}"></div>
    </div>
    <p class="note" style="margin-top:-6px;margin-bottom:6px;">Wpisz ręcznie albo skopiuj statystyki ze strony (Transfermarkt / 90minut / ŁNP) i wklej poniżej — liczby same trafią do pól.</p>
    <div class="field-wrap" style="margin-bottom:8px;">
      <textarea id="pm-stats-paste" rows="3" placeholder="Wklej tu skopiowane statystyki, np.: Appearances 15  Minutes played 1350  Goals 5  Assists 3" style="font-size:12px;font-family:monospace;"></textarea>
    </div>
    <div class="modal-actions" style="justify-content:flex-start;margin-top:0;margin-bottom:14px;">
      <button type="button" class="gold" data-action="pm-parse-stats">📊 Wczytaj z wklejonego tekstu</button>
      <button type="button" class="secondary" data-action="open-tm-profile">↗ Otwórz profil Transfermarkt</button>
    </div>
    <div class="field-wrap">
      <label class="field">Klub</label>
      <div style="display:flex;align-items:center;gap:10px;">
        <span id="pm-crest-preview">${crestImg(selectedClubId?clubCrest(selectedClubId):null,'lg')}</span>
        <div class="club-combo" style="flex:1;">
          <input type="hidden" id="pm-club" value="${esc(selectedClubId||'')}">
          <input type="text" id="pm-club-search" class="club-combo-input" autocomplete="off" placeholder="Zacznij pisać nazwę klubu…" value="${selectedClubId?esc(clubName(selectedClubId)):''}">
          <div class="club-combo-list" id="pm-club-list"></div>
        </div>
      </div>
    </div>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">Scout odpowiedzialny</label><input id="pm-scout" value="${p?esc(p.scout||''):esc(currentScout)}"></div>
      <div class="field-wrap"><label class="field">Link wideo</label><input id="pm-video" value="${p?esc(p.videoLink||''):''}" placeholder="https://..."></div>
    </div>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">Profil Łączy Nas Piłka / mPZPN</label><input id="pm-lnp" value="${p?esc(p.lnpLink||''):''}" placeholder="https://laczynaspilka.pl/..."></div>
      <div class="field-wrap"><label class="field">Profil Transfermarkt</label><input id="pm-tm" value="${p?esc(p.tmLink||''):''}" placeholder="https://www.transfermarkt.pl/..."></div>
    </div>
    <div class="field-wrap" style="margin-bottom:6px;"><label class="field">Media — śledź zawodnika</label></div>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">Instagram</label><input id="pm-instagram" value="${p?esc(p.instagramLink||''):''}" placeholder="https://instagram.com/..."></div>
      <div class="field-wrap"><label class="field">Facebook</label><input id="pm-facebook" value="${p?esc(p.facebookLink||''):''}" placeholder="https://facebook.com/..."></div>
    </div>
    <div class="grid grid-2">
      <div class="field-wrap">
        <label class="field">Kadra wojewódzka</label>
        <div class="radio-row">
          <label><input type="radio" name="pm-kadra" value="tak" ${p&&p.kadraWojewodzka?'checked':''}> Tak</label>
          <label><input type="radio" name="pm-kadra" value="nie" ${!(p&&p.kadraWojewodzka)?'checked':''}> Nie</label>
        </div>
      </div>
      <div class="field-wrap">
        <label class="field">Reprezentacja</label>
        <div class="radio-row">
          <label><input type="radio" name="pm-repr" value="tak" ${p&&p.reprezentacja?'checked':''}> Tak</label>
          <label><input type="radio" name="pm-repr" value="nie" ${!(p&&p.reprezentacja)?'checked':''}> Nie</label>
        </div>
        <input type="number" min="0" id="pm-powolania" value="${p&&p.powolania!=null?p.powolania:''}" placeholder="Liczba powołań" style="margin-top:6px;">
      </div>
    </div>
    <div class="field-wrap">
      <label class="field">Czy zawodnik posiada menedżera / agenta</label>
      <div class="radio-row">
        <label><input type="radio" name="pm-agent" value="tak" ${p&&p.hasAgent?'checked':''}> Tak</label>
        <label><input type="radio" name="pm-agent" value="nie" ${!(p&&p.hasAgent)?'checked':''}> Nie</label>
      </div>
      <div id="pm-agency-wrap" style="${p&&p.hasAgent?'':'display:none;'}">
        <input id="pm-agency" placeholder="Nazwa agencji" value="${p?esc(p.agencyName||''):''}">
      </div>
    </div>
    <div class="field-wrap">
      <label class="field">Czy zawodnik ma kontrakt</label>
      <div class="radio-row">
        <label><input type="radio" name="pm-contract" value="tak" ${p&&p.hasContract?'checked':''}> Tak</label>
        <label><input type="radio" name="pm-contract" value="nie" ${!(p&&p.hasContract)?'checked':''}> Nie</label>
      </div>
      <div id="pm-contract-wrap" style="${p&&p.hasContract?'':'display:none;'}">
        <label class="field" style="margin-top:6px;">Kontrakt do (data)</label>
        <input type="date" id="pm-contract-until" value="${p?esc(p.contractUntil||''):''}">
      </div>
    </div>
    ${DB.settings.customFields && DB.settings.customFields.length ? `
    <div class="field-wrap">
      <label class="field">Dodatkowe pola</label>
      <div class="grid grid-2">
        ${DB.settings.customFields.map(f=>`<div class="field-wrap"><label class="field">${esc(f)}</label><input class="pm-custom" data-field="${esc(f)}" value="${p&&p.customFields&&p.customFields[f]?esc(p.customFields[f]):''}"></div>`).join('')}
      </div>
    </div>` : ''}
    <div class="field-wrap"><label class="field">Dodatkowe notatki</label><textarea id="pm-notes" rows="3">${p?esc(p.notes||''):''}</textarea></div>
    <div class="modal-actions">
      <button class="secondary" data-action="close-modal">Anuluj</button>
      <button class="gold" data-action="save-player">Zapisz</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

// Okno "Statystyka" (suwaki ocen przy obserwacji) USUNIĘTE na życzenie użytkownika — obserwacja to
// wyłącznie plan/odbycie wizyty; ocena zawodnika powstaje w zakładce Raporty (fazy gry + stałe
// fragmenty), z której liczona jest średnia. Historyczne oceny z obserwacji nadal zasilają radar.

// Liga podpowiadana w oknie NOWEGO klubu: ta, którą właśnie przeglądasz. Wcześniej okno zawsze
// startowało od pierwszej pozycji listy (Ekstraklasa), więc klub dodany podczas przeglądania
// III ligi lądował w Ekstraklasie i znikał z widoku — wyglądało to na to, że zapis nie działa.
function domyslnaLigaNowegoKlubu(){
  const ligi = DB.settings.leagues || [];
  // Wybrana grupa jest konkretną ligą („III liga, gr. III") — bierzemy ją wprost.
  if(clubBrowse.group && ligi.includes(clubBrowse.group)) return clubBrowse.group;
  // Sam poziom („III liga") nie jest ligą z listy — bierzemy jego pierwszą grupę.
  if(clubBrowse.top){
    if(ligi.includes(clubBrowse.top)) return clubBrowse.top;
    const pierwszaGrupa = ligi.find(l=> topLevelOf(l) === clubBrowse.top);
    if(pierwszaGrupa) return pierwszaGrupa;
  }
  return ligi[0] || '';
}

// ZAKŁADANIE CAŁEJ GRUPY NARAZ.
//
// Nowa grupa rozgrywek to osiemnaście klubów. Wpisywanie ich pojedynczo w oknie „Nowy klub" to
// osiemdziesiąt kliknięć i kwadrans pracy — a lista i tak jest zwykle skądś skopiowana (tabela
// ligi, komunikat związku). Wystarczy ją więc wkleić: jedna nazwa w linijce, opcjonalnie
// z miastem po przecinku. Region podpowiadamy z nazwy grupy, bo „IV liga (łódzka)" to zawsze
// Łódzki ZPN — użytkownik może go zmienić przed założeniem.
const ZPN_WG_GRUPY = {
  'dolnośląska':'Dolnośląski ZPN', 'kujawsko-pomorska':'Kujawsko-Pomorski ZPN', 'lubelska':'Lubelski ZPN',
  'lubuska':'Lubuski ZPN', 'łódzka':'Łódzki ZPN', 'małopolska':'Małopolski ZPN', 'mazowiecka':'Mazowiecki ZPN',
  'opolska':'Opolski ZPN', 'podkarpacka':'Podkarpacki ZPN', 'podlaska':'Podlaski ZPN', 'pomorska':'Pomorski ZPN',
  'śląska':'Śląski ZPN', 'świętokrzyska':'Świętokrzyski ZPN', 'warmińsko-mazurska':'Warmińsko-Mazurski ZPN',
  'wielkopolska':'Wielkopolski ZPN', 'zachodniopomorska':'Zachodniopomorski ZPN',
};
function zpnDlaLigi(liga){
  const m = String(liga||'').match(/\(([^)]+)\)/);
  return (m && ZPN_WG_GRUPY[m[1].toLowerCase()]) || '';
}
// Wiersz wklejonej listy: „Widzew II Łódź", „Pelikan Łowicz, Łowicz", „1. Warta Sieradz  Sieradz",
// „Boruta Zgierz 18 34 12" (skopiowana tabela — liczby na końcu odcinamy).
function klubZWiersza(linia){
  let l = String(linia||'').replace(/ /g,' ').replace(/\s+/g,' ').trim();
  if(!l) return null;
  l = l.replace(/^\d{1,2}\s*[.)]?\s+/, '');            // pozycja w tabeli
  l = l.replace(/(\s+[-\d:]+){2,}$/, '').trim();       // kolumny liczbowe skopiowane z tabeli
  if(!l || !/[\p{L}]/u.test(l)) return null;
  let nazwa = l, miasto = '';
  const przecinek = l.match(/^(.+?)\s*[,;]\s*(.+)$/);
  if(przecinek){ nazwa = przecinek[1].trim(); miasto = przecinek[2].trim(); }
  else {
    const tab = l.split(/\t|\s{2,}/).map(x=>x.trim()).filter(Boolean);
    if(tab.length >= 2){ nazwa = tab[0]; miasto = tab[1]; }
  }
  if(!miasto){
    // Bez osobnej kolumny miasto bierzemy z końca nazwy („Pelikan Łowicz" → Łowicz). Gdy ostatnie
    // słowo jest przymiotnikiem, miasto jest dwuczłonowe („Konstantynów Łódzki"). To tylko
    // podpowiedź do pola „Miasto" — nazwa klubu zostaje w całości, a podgląd pokazuje wynik
    // przed założeniem, więc pomyłkę widać od razu.
    const slowa = nazwa.split(' ');
    if(slowa.length >= 2){
      const ostatnie = slowa[slowa.length-1];
      miasto = /(ski|cki|dzki|ska|cka|dzka|skie|ckie|dzkie)$/i.test(ostatnie) && slowa.length >= 3
        ? slowa.slice(-2).join(' ')
        : ostatnie;
    }
  }
  if(nazwa.length > 60) return null;
  return { nazwa, miasto };
}
function openPasteClubsModal(){
  const ligi = DB.settings.leagues || [];
  const domyslna = domyslnaLigaNowegoKlubu();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
  <div class="modal">
    <h3>Wklej listę klubów</h3>
    <p class="note" style="margin-top:-6px;">Jedna nazwa w linijce. Możesz wkleić samą listę nazw albo całą tabelę ligi — numery pozycji i kolumny z punktami odetnę. Miasto podaj po przecinku, jeśli ma być inne niż ostatnie słowo nazwy.</p>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">Liga / grupa</label><select id="pk-liga">${ligi.map(x=>`<option ${x===domyslna?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="field-wrap"><label class="field">Region (ZPN)</label><select id="pk-region">${DB.settings.regions.map(x=>`<option ${x===zpnDlaLigi(domyslna)?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
    </div>
    <div class="field-wrap"><label class="field">Sezon</label><input id="pk-sezon" value="2026/2027"></div>
    <div class="field-wrap"><label class="field">Kluby</label>
      <textarea id="pk-tekst" rows="9" placeholder="np.&#10;Boruta Zgierz&#10;Pilica Przedbórz&#10;Włókniarz Konstantynów Łódzki&#10;GKS Ksawerów"></textarea>
    </div>
    <div id="pk-podglad" class="note"></div>
    <div class="modal-actions">
      <button class="secondary" data-action="close-modal">Anuluj</button>
      <button class="gold" id="pk-zaloz">Załóż kluby</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=()=>overlay.remove());
  const selLiga = overlay.querySelector('#pk-liga');
  const selRegion = overlay.querySelector('#pk-region');
  selLiga.onchange = ()=>{ const z = zpnDlaLigi(selLiga.value); if(z) selRegion.value = z; };

  const pole = overlay.querySelector('#pk-tekst');
  const podglad = overlay.querySelector('#pk-podglad');
  const rozpoznaj = ()=> pole.value.split(/\r?\n/).map(klubZWiersza).filter(Boolean);
  const odswiez = ()=>{
    const lista = rozpoznaj();
    const istniejace = new Set(DB.clubs.map(c=>String(c.name||'').toLowerCase()));
    const nowe = lista.filter(k=>!istniejace.has(k.nazwa.toLowerCase()));
    podglad.innerHTML = lista.length
      ? `Rozpoznano <strong>${lista.length}</strong>, do założenia <strong>${nowe.length}</strong>${
          lista.length - nowe.length ? ` (${lista.length - nowe.length} już jest w kartotece — pominę)` : ''}.
        <div style="max-height:150px;overflow:auto;margin-top:6px;"><table style="font-size:12px;"><tbody>${
          lista.map(k=>`<tr><td style="padding-right:12px;">${esc(k.nazwa)}</td><td style="color:var(--ink-soft);">${esc(k.miasto||'—')}</td><td style="color:var(--ink-soft);">${
            istniejace.has(k.nazwa.toLowerCase()) ? 'już jest' : ''}</td></tr>`).join('')}</tbody></table></div>`
      : '';
  };
  pole.oninput = odswiez;

  overlay.querySelector('#pk-zaloz').onclick = async ()=>{
    const lista = rozpoznaj();
    if(!lista.length){ alert('Nie rozpoznałem żadnej nazwy klubu — wklej listę, po jednej nazwie w linijce.'); return; }
    const liga = selLiga.value, region = selRegion.value;
    const sezon = overlay.querySelector('#pk-sezon').value.trim();
    const istniejace = new Set(DB.clubs.map(c=>String(c.name||'').toLowerCase()));
    const nowe = lista.filter(k=>!istniejace.has(k.nazwa.toLowerCase()));
    if(!nowe.length){ alert('Wszystkie te kluby już są w kartotece — nic nie dodaję.'); return; }
    nowe.forEach(k=> DB.clubs.push({
      id: uid('K'), name: k.nazwa, city: k.miasto || '', region, league: liga, season: sezon,
      crestUrl: '', juniorCategories: '', profileLnp: '', profileTm: '',
    }));
    const ok = await saveClubs();
    if(!ok){ alert('Nie udało się zapisać — sprawdź baner u góry strony.'); return; }
    overlay.remove();
    clubBrowse = { top: topLevelOf(liga), group: liga };
    alert(`Założyłem ${nowe.length} ${nowe.length===1?'klub':'klubów'} w grupie „${liga}".\n\n` +
      'Herby, linki do 90minut i składy uzupełnisz w edycji klubu — a statystyki pobierzesz przyciskiem „⏱ Statystyki z 90minut" w widoku klubu.');
    render();
  };
}

function openClubModal(id){
  const c = id ? DB.clubs.find(x=>x.id===id) : null;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.dataset.clubId = id || "";
  overlay.innerHTML = `
  <div class="modal">
    <h3>${c? 'Edytuj klub':'Nowy klub'}</h3>
    <div class="field-wrap"><label class="field">Nazwa klubu</label><input id="cm-name" value="${c?esc(c.name):''}"></div>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">Region</label><select id="cm-region">${DB.settings.regions.map(x=>`<option ${c&&c.region===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="field-wrap"><label class="field">Liga / poziom (aktualna)</label><select id="cm-league">${DB.settings.leagues.map(x=>`<option ${(c ? c.league===x : x===domyslnaLigaNowegoKlubu())?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
    </div>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">Sezon</label><input id="cm-season" value="${c?esc(c.season||''):''}" placeholder="np. 2025/2026"></div>
      <div class="field-wrap"><label class="field">Miasto</label><input id="cm-city" value="${c?esc(c.city||''):''}"></div>
    </div>
    <div class="grid grid-2">
      <div class="field-wrap">
        <label class="field">Herb klubu — wgraj plik (PNG / JPG / PDF)</label>
        <div style="display:flex;align-items:center;gap:10px;">
          <span id="cm-crest-preview" style="display:inline-flex;">${crestImg(c?clubCrest(c.id):'', 'lg', c?c.name:'')}</span>
          <div style="flex:1;">
            <input type="file" id="cm-crest-file" accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg,application/pdf,.pdf">
            <div id="cm-crest-status" class="note" style="margin-top:4px;"></div>
          </div>
        </div>
        <input type="hidden" id="cm-crest" value="${c?esc(clubCrest(c.id)||''):''}">
        <details style="margin-top:6px;">
          <summary style="cursor:pointer;font-size:12px;color:var(--ink-soft);">albo wklej link do obrazka zamiast wgrywania</summary>
          <input id="cm-crest-url-alt" value="${c&&c.crestUrl&&c.crestUrl.startsWith('http')?esc(c.crestUrl):''}" placeholder="https://..." style="margin-top:6px;">
        </details>
      </div>
      <div class="field-wrap"><label class="field">Kategorie juniorskie</label><input id="cm-juniors" value="${c?esc(c.juniorCategories||''):''}" placeholder="np. U19, U17, U15"></div>
    </div>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">Link — tabela / skład (90minut.pl, ŁNP)</label><input id="cm-lnp" value="${c?esc(c.profileLnp||''):''}" placeholder="http://www.90minut.pl/... lub laczynaspilka.pl"></div>
      <div class="field-wrap"><label class="field">Link — Transfermarkt</label><input id="cm-tm" value="${c?esc(c.profileTm||''):''}" placeholder="https://www.transfermarkt.pl/..."></div>
    </div>
    <div class="modal-actions">
      <button class="secondary" data-action="close-modal">Anuluj</button>
      <button class="gold" data-action="save-club">Zapisz</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

// ---------- EVENT HANDLING ----------
function attachHandlers(){
  const main = document.getElementById('main');

  main.querySelectorAll('[data-action="goto-newobs"]').forEach(b=>b.onclick=()=>{currentView='newobs';render();});
  main.querySelectorAll('[data-action="goto-addplayer"]').forEach(b=>b.onclick=()=>{currentView='players';render();openPlayerModal(null);});
  main.querySelectorAll('[data-action="goto-monitoring"]').forEach(b=>b.onclick=()=>{currentView='monitoring';render();});
  main.querySelectorAll('[data-action="goto-clubs"]').forEach(b=>b.onclick=()=>{currentView='clubs';viewingClubId=null;render();});

  const sponsorInput = main.querySelector('#sponsor-logo-input');
  if(sponsorInput){
    sponsorInput.onchange = async ()=>{
      const file = sponsorInput.files[0];
      if(!file) return;
      try{
        const dataUrl = await new Promise((resolve,reject)=>{
          const reader = new FileReader();
          reader.onload = ()=>resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        if(!DB.settings.sponsors) DB.settings.sponsors = [];
        DB.settings.sponsors.push({name: file.name.replace(/\.[^.]+$/,''), dataUrl});
        await saveSettings();
        render();
      }catch(e){ console.error('Nie udało się wczytać logo sponsora:', e); alert('Nie udało się wczytać logo sponsora.'); }
    };
  }
  main.querySelectorAll('[data-action="remove-sponsor"]').forEach(b=>b.onclick=async()=>{
    const idx = Number(b.dataset.idx);
    if(DB.settings.sponsors && idx>=0){ DB.settings.sponsors.splice(idx,1); await saveSettings(); render(); }
  });
  // Szybkie przejście z dashboardu: klik w klub → widok klubu z listą jego zawodników.
  main.querySelectorAll('[data-action="dash-goto-club"]').forEach(b=>b.onclick=()=>{
    currentView='clubs'; viewingClubId=b.dataset.id; editingPlayerId=null; viewingPlayerId=null; render();
  });
  // Szybki dostęp wg lig (dashboard): klik w logo ligi rozwija/zwija rząd herbów klubów tej ligi.
  main.querySelectorAll('[data-action="dash-select-league"]').forEach(b=>b.onclick=()=>{
    dashboardLeagueSelected = (dashboardLeagueSelected===b.dataset.val) ? null : b.dataset.val;
    dashboardGroupSelected = null;
    render();
  });
  // Ligi z podziałem na grupy (III liga) na dashboardzie: klik w grupę rozwija/zwija jej kluby.
  main.querySelectorAll('[data-action="dash-select-group"]').forEach(b=>b.onclick=()=>{
    dashboardGroupSelected = (dashboardGroupSelected===b.dataset.val) ? null : b.dataset.val;
    render();
  });

  main.querySelectorAll('[data-action="add-player"]').forEach(b=>b.onclick=()=>openPlayerModal(null));
  main.querySelectorAll('[data-action="edit-player"]').forEach(b=>b.onclick=()=>openPlayerModal(b.dataset.id));
  main.querySelectorAll('[data-action="paste-stats"]').forEach(b=>b.onclick=()=>openPasteStatsModal(b.dataset.id));
  main.querySelectorAll('[data-action="refresh-stats"]').forEach(b=>b.onclick=async()=>{
    const p = DB.players.find(x=>x.id===b.dataset.id);
    if(!p) return;
    const orig = b.textContent;
    b.disabled = true; b.textContent = '⏳ Pobieram...';
    try{
      const { data } = await fetchStatsFor(p);
      const ok = await savePlayers();
      if(!ok){ alert('Pobrano statystyki, ale nie udało się ich zapisać — sprawdź baner u góry strony.'); return; }
      alert(`Sezon ${data.season}: ${data.matches} meczów, ${data.goals} bramek.\n` +
        `Źródło: ${data.source}${data.clubs && data.clubs.length ? ' — ' + data.clubs.join(', ') : ''}.\n\n` +
        'To tabela kariery — bez minut i kartek. Po minuty użyj w widoku klubu przycisku „⏱ Statystyki z 90minut".');
      render();
    }catch(e){
      alert('Nie udało się pobrać statystyk: ' + (e.message||e));
    }finally{
      b.disabled = false; b.textContent = orig;
    }
  });
  main.querySelectorAll('[data-action="open-match-schedule"]').forEach(b=>b.onclick=()=>openMatchScheduleModal());
  // Wybór rodzaju obserwacji przestawiamy W MIEJSCU, bez przerysowania formularza.
  //
  // Przerysowanie kasowało wszystko, co było już wpisane: przy NOWEJ obserwacji pola renderują
  // się z pustych wartości (wypełnia je tylko tryb edycji), więc wybrany z terminarza mecz,
  // adres i notatki znikały po samym przełączeniu Live na Video. Podmiana klas i ukrytego pola
  // załatwia to samo, a niczego nie dotyka.
  document.querySelectorAll('[data-action="pick-obs-type"]').forEach(b=>b.onclick=()=>{
    const wybrany = b.dataset.type;
    const editing = editingObsId ? DB.observations.find(o=>o.id===editingObsId) : null;
    if(editing) editing.obsType = wybrany; else newObsType = wybrany;

    const ukryte = document.getElementById('obs-type');
    if(ukryte) ukryte.value = wybrany;
    document.querySelectorAll('[data-action="pick-obs-type"]').forEach(inny=>{
      const meta = obsTypeMeta(inny.dataset.type);
      inny.style.cssText = inny.dataset.type === wybrany
        ? `background:${meta.color};border-color:${meta.color};color:var(--card);`
        : `background:var(--card);border-color:var(--border-strong);color:var(--ink-soft);`;
    });
  });
  main.querySelectorAll('[data-action="view-player"]').forEach(b=>b.onclick=()=>{viewingPlayerId=b.dataset.id; currentView='players'; render();});
  // Kliknięcie w wiersz listy zawodników otwiera profil, ale nie może przechwytywać kliknięć
  // w zaznaczanie do usuwania ani w przyciski akcji z ostatniej kolumny.
  main.querySelectorAll('[data-action="row-open-player"]').forEach(row=>row.addEventListener('click', (e)=>{
    if((e.target as HTMLElement).closest('button, input, a, label')) return;
    viewingPlayerId = (row as HTMLElement).dataset.id; currentView='players'; render();
  }));
  // Osobna akcja dla PRZYCISKU „Profil" (np. w widoku agencji). Obsługa kliknięcia w wiersz wyżej
  // celowo pomija kliknięcia w przyciski, żeby „Usuń" czy „Odłącz" nie otwierały profilu — więc
  // przycisk otwierający profil musi mieć własną akcję, inaczej sam siebie blokuje.
  main.querySelectorAll('[data-action="open-player-profile"]').forEach(b=>b.onclick=(e)=>{
    e.stopPropagation();
    viewingPlayerId = (b as HTMLElement).dataset.id;
    currentView = 'players';
    viewingAgencyId = null;
    render();
  });
  // Przycisk "Monitoring" w liście zawodników — od razu dodaje/usuwa zawodnika z zakładki Monitoring.
  main.querySelectorAll('[data-action="monitoring-plan-obs"]').forEach(b=>b.onclick=()=>{
    obsPreselectPlayerId = b.dataset.id;
    currentView = 'newobs'; viewingPlayerId = null;
    render();
  });
  main.querySelectorAll('[data-action="agent-import"]').forEach(b=>b.onclick=()=>openAgentImportModal());
  main.querySelectorAll('[data-action="agencies-import"]').forEach(b=>b.onclick=()=>openAgenciesImportModal());
  const agencySearchInput = main.querySelector('#agency-search');
  if(agencySearchInput) agencySearchInput.oninput = ()=>{ agencySearchQuery = agencySearchInput.value; render(); };
  const agencySortSelect = main.querySelector('#agency-sort');
  if(agencySortSelect) agencySortSelect.onchange = ()=>{ agencySort = agencySortSelect.value; render(); };
  main.querySelectorAll('[data-action="agency-squad"]').forEach(b=>b.onclick=()=>openAgencySquadModal(b.dataset.id));
  main.querySelectorAll('[data-action="agency-add-players"]').forEach(b=>b.onclick=()=>openAddPlayersToAgencyModal(b.dataset.id));
  main.querySelectorAll('[data-action="agency-staff"]').forEach(b=>b.onclick=()=>openAgencyStaffModal(b.dataset.id));
  // Telefon i e-mail wpisywane wprost w tabeli — Transfermarkt nie podaje ich przy osobach,
  // więc i tak trafiają tam ręcznie i nie ma po co za każdym razem otwierać okna edycji.
  main.querySelectorAll('.agent-inline').forEach((inp:any)=>inp.onchange = async ()=>{
    const m = agentById(inp.dataset.id);
    if(!m) return;
    m[inp.dataset.field] = inp.value.trim();
    const ok = await saveAgents();
    if(!ok) alert('Nie udało się zapisać — sprawdź baner u góry strony.');
  });

  // Zaznaczanie agencji do usunięcia hurtem. „Zaznacz wszystkie" obejmuje TYLKO to, co widać —
  // przy włączonym wyszukiwaniu zaznaczenie ukrytych agencji byłoby pułapką.
  const agencyCheckboxes = main.querySelectorAll('.agency-checkbox') as any;
  const agencySelectAll = main.querySelector('#select-all-agencies') as any;
  const agencyHeaderCheck = main.querySelector('.agency-header-checkbox') as any;
  const agencyDeleteBtn = main.querySelector('#delete-selected-agencies-btn') as any;
  function odswiezPrzyciskAgencji(){
    if(!agencyDeleteBtn) return;
    const ile = Array.from(agencyCheckboxes).filter((c:any)=>c.checked).length;
    agencyDeleteBtn.style.display = ile ? 'inline-block' : 'none';
    agencyDeleteBtn.textContent = `🗑️ Usuń zaznaczone (${ile})`;
  }
  const zaznaczWszystkieAgencje = (stan)=>{
    Array.from(agencyCheckboxes).forEach((c:any)=>c.checked = stan);
    if(agencySelectAll) agencySelectAll.checked = stan;
    if(agencyHeaderCheck) agencyHeaderCheck.checked = stan;
    odswiezPrzyciskAgencji();
  };
  if(agencySelectAll) agencySelectAll.onchange = ()=>zaznaczWszystkieAgencje(agencySelectAll.checked);
  if(agencyHeaderCheck) agencyHeaderCheck.onchange = ()=>zaznaczWszystkieAgencje(agencyHeaderCheck.checked);
  Array.from(agencyCheckboxes).forEach((c:any)=>c.onchange = odswiezPrzyciskAgencji);
  if(agencyDeleteBtn) agencyDeleteBtn.onclick = async ()=>{
    const ids = Array.from(agencyCheckboxes).filter((c:any)=>c.checked).map((c:any)=>c.dataset.id);
    if(!ids.length) return;
    const zbior = new Set(ids);
    const nazwy = DB.agencies.filter(a=>zbior.has(a.id)).map(a=>a.name);
    const menedzerow = DB.agents.filter(m=>zbior.has(m.agencyId)).length;
    const zawodnikow = DB.players.filter(p=>zbior.has(p.agencyId)).length;
    // Wypisujemy skutki uboczne, zanim ktoś skasuje 190 agencji jednym kliknięciem.
    if(!confirm(`Usunąć ${ids.length} agencji?\n\n` +
      nazwy.slice(0,8).join(', ') + (nazwy.length>8 ? ` … i ${nazwy.length-8} więcej` : '') +
      (menedzerow ? `\n\nZniknie też ${menedzerow} menedżer(ów) tych agencji.` : '') +
      (zawodnikow ? `\n${zawodnikow} zawodnik(ów) straci przypisanie do agencji — znacznik „Agent: Tak" im zostaje.` : '') +
      `\n\nTego nie można cofnąć.`)) return;
    DB.agents = DB.agents.filter(m=>!zbior.has(m.agencyId));
    DB.players.forEach(p=>{ if(zbior.has(p.agencyId)){ p.agencyId = ''; p.agentId = ''; } });
    DB.agencies = DB.agencies.filter(a=>!zbior.has(a.id));
    const ok = await saveAgents() && await saveAgencies() && await savePlayers();
    if(!ok){ alert('Nie udało się zapisać — sprawdź baner u góry strony. Odśwież stronę, żeby zobaczyć rzeczywisty stan.'); return; }
    viewingAgencyId = null;
    render();
  };
  main.querySelectorAll('[data-action="open-agency"]').forEach(b=>b.onclick=(e)=>{
    e.preventDefault();          // odnośnik w profilu zawodnika nie ma przeładowywać strony
    viewingAgencyId = b.dataset.id;
    currentView = 'agencies'; viewingPlayerId = null;
    render();
  });
  main.querySelectorAll('[data-action="back-agencies"]').forEach(b=>b.onclick=()=>cofnijWidok(()=>{ viewingAgencyId = null; }));
  main.querySelectorAll('[data-action="add-agency"]').forEach(b=>b.onclick=()=>openAgencyModal(null));
  main.querySelectorAll('[data-action="edit-agency"]').forEach(b=>b.onclick=()=>openAgencyModal(b.dataset.id));
  main.querySelectorAll('[data-action="add-agent"]').forEach(b=>b.onclick=()=>openAgentModal(null, b.dataset.agency));
  main.querySelectorAll('[data-action="edit-agent"]').forEach(b=>b.onclick=()=>openAgentModal(b.dataset.id, null));
  main.querySelectorAll('[data-action="delete-agency"]').forEach(b=>b.onclick=async()=>{
    const a = agencyById(b.dataset.id);
    if(!a) return;
    const zaw = agencyPlayers(a.id).length, men = agencyAgents(a.id).length;
    // Mówimy wprost, co przepadnie — kasowanie agencji odłącza zawodników i usuwa jej menedżerów.
    if(!confirm(`Usunąć agencję „${a.name}"?` +
      (men ? `\n\nZniknie też ${men} menedżer(ów) tej agencji.` : '') +
      (zaw ? `\n${zaw} zawodnik(ów) straci przypisanie do agencji (znacznik „ma menedżera" zostaje).` : '') +
      `\n\nTego nie można cofnąć.`)) return;
    DB.agents = DB.agents.filter(m=>m.agencyId!==a.id);
    DB.players.forEach(p=>{ if(p.agencyId===a.id){ p.agencyId = ''; p.agentId = ''; } });
    DB.agencies = DB.agencies.filter(x=>x.id!==a.id);
    await saveAgents(); await saveAgencies(); await savePlayers();
    viewingAgencyId = null;
    render();
  });
  main.querySelectorAll('[data-action="delete-agent"]').forEach(b=>b.onclick=async()=>{
    const m = agentById(b.dataset.id);
    if(!m) return;
    const ilu = agentPlayers(m.id).length;
    if(!confirm(`Usunąć menedżera „${agentFullName(m)}"?` +
      (ilu ? `\n\n${ilu} zawodnik(ów) zostanie przy agencji, ale bez wskazanej osoby.` : ''))) return;
    DB.players.forEach(p=>{ if(p.agentId===m.id) p.agentId = ''; });
    DB.agents = DB.agents.filter(x=>x.id!==m.id);
    await saveAgents(); await savePlayers();
    render();
  });
  main.querySelectorAll('[data-action="unlink-agency"]').forEach(b=>b.onclick=async()=>{
    const p = DB.players.find(x=>x.id===b.dataset.id);
    if(!p) return;
    p.agencyId = ''; p.agentId = '';
    await savePlayers();
    render();
  });
  main.querySelectorAll('.agent-assign').forEach(sel=>sel.onchange=async()=>{
    const p = DB.players.find(x=>x.id===sel.dataset.player);
    if(!p) return;
    p.agentId = sel.value;
    await savePlayers();
  });
  main.querySelectorAll('[data-action="agency-migrate"]').forEach(b=>b.onclick=async()=>{
    const r = await migrujAgencjeZTekstu();
    const m = await uporzadkujMenedzerow();
    render();
    const czesci = [];
    if(r.powiazane) czesci.push(`Powiązano zawodników z agencjami: ${r.powiazane}\nZałożono nowych agencji: ${r.utworzone}`);
    if(m.poprawione) czesci.push(`Poprawiono nazwiska menedżerów: ${m.poprawione}\n(zdjęte „licensed", myślniki i role — rola trafiła do własnej rubryki)`);
    if(m.zTelefonem) czesci.push(`Uzupełniono telefon z agencji u menedżerów: ${m.zTelefonem}`);
    alert(czesci.length ? 'Uporządkowano.\n\n' + czesci.join('\n\n')
      : 'Nie znalazłem nic do uporządkowania.');
  });
  main.querySelectorAll('[data-action="toggle-agent"]').forEach(b=>b.onclick=(e)=>{
    e.stopPropagation();          // klik w komórkę nie może otwierać profilu zawodnika
    toggleHasAgent(b.dataset.id);
  });
  main.querySelectorAll('[data-action="add-to-monitoring"]').forEach(b=>b.onclick=()=>{
    const pl = DB.players.find(x=>x.id===b.dataset.id);
    if(!pl) return;
    pl.monitored = !pl.monitored;
    if(pl.monitored) pl.watchlistRemoved = false;  // ponowne dodanie cofa wcześniejsze "Usuń"
    render();                 // natychmiastowy feedback (etykieta ✓/+), zapis leci w tle
    savePlayers();
  });
  // Usunięcie zawodnika z listy Monitoring (nie kasuje zawodnika z bazy — tylko z watchlisty).
  main.querySelectorAll('[data-action="monitoring-remove"]').forEach(b=>b.onclick=async()=>{
    const pl = DB.players.find(x=>x.id===b.dataset.id);
    if(!pl) return;
    if(!confirm('Usunąć tego zawodnika z listy Monitoring? (zawodnik zostaje w bazie)')) return;
    pl.watchlistRemoved = true;
    pl.monitored = false;
    render();
    savePlayers();
  });
  main.querySelectorAll('[data-action="back-players"]').forEach(b=>b.onclick=()=>cofnijWidok(()=>{ viewingPlayerId=null; }));
  main.querySelectorAll('[data-action="back-rocznik"]').forEach(b=>b.onclick=()=>cofnijWidok(()=>{ viewingRocznikGroup=null; currentView='clubs'; }));
  main.querySelectorAll('[data-action="delete-rocznik"]').forEach(b=>b.onclick=async()=>{
    const year = b.dataset.year;
    if(confirm(`Usunąć wszystkich zawodników z rocznika ${year}? To działanie nie może być cofnięte.`)){
      const toDelete = DB.players.filter(p=>String(p.birthYear||'')===String(year));
      for(const p of toDelete){ DB.players = DB.players.filter(x=>x.id!==p.id); }
      const ok = await savePlayers();
      if(ok){
        alert(`Usunięto ${toDelete.length} zawodników.`);
        viewingRocznikGroup = null;
        currentView = 'clubs';
        render();
      } else {
        alert('Nie udało się usunąć zawodników.');
      }
    }
  });
  main.querySelectorAll('[data-action="rocznik-excel-import"]').forEach(b=>b.onclick=()=>{
    if(viewingRocznikGroup) openRocznikExcelImport(viewingRocznikGroup);
  });

  const rankingSelect = main.querySelector('#ranking-league-select');
  if(rankingSelect){
    rankingSelect.onchange = ()=>{ rankingLeague = rankingSelect.value; render(); };
  }
  const rankingFormationFilterSelect = main.querySelector('#ranking-formation-filter-select');
  if(rankingFormationFilterSelect){
    rankingFormationFilterSelect.onchange = ()=>{ rankingFormationFilter = rankingFormationFilterSelect.value; render(); };
  }
  main.querySelectorAll('[data-action="position-slot-click"]').forEach(b=>b.onclick=()=>{
    openPositionSlotModal(rankingLeague, rankingFormationFilter, Number(b.dataset.number));
  });
  main.querySelectorAll('[data-action="delete-player"]').forEach(b=>b.onclick=async()=>{
    if(confirm('Usunąć tego zawodnika i jego obserwacje?')){
      const id = b.dataset.id;
      const ok = await deletePlayerRecord(id);   // usuwa też obserwacje w bazie (kaskada FK)
      if(!ok){ alert('Nie udało się usunąć zawodnika — sprawdź baner u góry strony. Nic nie usunięto.'); return; }
      DB.players = DB.players.filter(p=>p.id!==id);
      DB.observations = DB.observations.filter(o=>o.playerId!==id);
      viewingPlayerId=null; render();
    }
  });

  // Przewijanie szerokiej tabeli przeciąganiem myszy (kursor „łapka") oraz kółkiem z Shiftem.
  // Sam pasek przewijania bywa przeoczony, a tabela zawodników ma 14 kolumn i nie mieści się na ekranie.
  document.querySelectorAll('.table-scroll').forEach(box=>{
    let ciagnie = false, startX = 0, startScroll = 0;
    box.addEventListener('mousedown', (e)=>{
      // Nie przechwytujemy kliknięć w elementy interaktywne — inaczej nie dałoby się nic kliknąć.
      if((e.target as HTMLElement).closest('button, input, a, select, label')) return;
      ciagnie = true; startX = e.pageX; startScroll = box.scrollLeft;
    });
    const koniec = ()=>{ ciagnie = false; };
    box.addEventListener('mouseup', koniec);
    box.addEventListener('mouseleave', koniec);
    box.addEventListener('mousemove', (e)=>{
      if(!ciagnie) return;
      const przesuniecie = e.pageX - startX;
      if(Math.abs(przesuniecie) > 3) e.preventDefault();   // dopiero wtedy to przeciąganie, a nie klik
      box.scrollLeft = startScroll - przesuniecie;
    });
    // Kółko myszy w poziomie, gdy trzymany Shift.
    box.addEventListener('wheel', (e)=>{
      if(!e.shiftKey) return;
      e.preventDefault();
      box.scrollLeft += e.deltaY;
    }, {passive:false});
  });

  // Checkboxy do zaznaczania zawodników
  const selectAllCheckbox = main.querySelector('#select-all-players') as HTMLInputElement;
  const deleteSelectedBtn = main.querySelector('#delete-selected-btn');
  const playerCheckboxes = main.querySelectorAll('.player-checkbox') as NodeListOf<HTMLInputElement>;

  function updateDeleteButton(){
    const checked = Array.from(playerCheckboxes).filter(c=>c.checked).length;
    // Przycisk porównania mówi, ilu zaznaczono — inaczej nie wiadomo, że zaznaczenie ma na nie wpływ.
    const cmpBtn = main.querySelector('[data-action="compare-open"]');
    if(cmpBtn){
      cmpBtn.textContent = checked ? `⚖️ Porównaj zaznaczonych (${Math.min(checked,3)}${checked>3?' z '+checked:''})`
                                   : '⚖️ Porównaj zawodników';
    }
    if(!deleteSelectedBtn) return;
    if(checked > 0){
      deleteSelectedBtn.style.display = 'inline-block';
      deleteSelectedBtn.textContent = `🗑️ Usuń zaznaczonych (${checked})`;
    } else {
      deleteSelectedBtn.style.display = 'none';
    }
  }

  if(selectAllCheckbox){
    selectAllCheckbox.onchange = ()=>{
      playerCheckboxes.forEach(c=>c.checked = selectAllCheckbox.checked);
      updateDeleteButton();
    };
  }

  playerCheckboxes.forEach(c=>{
    c.onchange = ()=>{
      const allChecked = Array.from(playerCheckboxes).every(x=>x.checked);
      const anyChecked = Array.from(playerCheckboxes).some(x=>x.checked);
      if(selectAllCheckbox){
        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = anyChecked && !allChecked;
      }
      updateDeleteButton();
    };
  });

  if(deleteSelectedBtn){
    deleteSelectedBtn.onclick = async()=>{
      const checked = Array.from(playerCheckboxes).filter(c=>c.checked);
      if(!checked.length) return;
      if(!confirm(`Usunąć ${checked.length} zaznaczonych zawodników? To działanie nie może być cofnięte.`)) return;

      const ids = checked.map(c=>c.dataset.id);
      const orig = deleteSelectedBtn.textContent;
      (deleteSelectedBtn as HTMLButtonElement).disabled = true;
      deleteSelectedBtn.textContent = `Usuwam ${ids.length}…`;
      try{
        // Jedno zapytanie na paczkę zamiast jednego na zawodnika — przy stu zaznaczonych
        // kasowanie po kolei trwało tak długo, że wyglądało na zawieszenie aplikacji.
        await storage.deleteItems('scouting:players', ids);
        const gone = new Set(ids);
        DB.players = DB.players.filter(p=>!gone.has(p.id));
        DB.observations = DB.observations.filter(o=>!gone.has(o.playerId));
        alert(`Usunięto ${ids.length} zawodników.`);
        render();
      }catch(e){
        (deleteSelectedBtn as HTMLButtonElement).disabled = false;
        deleteSelectedBtn.textContent = orig;
        alert('Nie udało się usunąć: ' + ((e as any).message||e));
      }
    };
  }

  main.querySelectorAll('[data-action="manage-tabs"]').forEach(b=>b.onclick=()=>openPlayerTabsModal(b.dataset.id));
  main.querySelectorAll('[data-action="manage-attachments"]').forEach(b=>b.onclick=()=>openPlayerAttachmentsModal(b.dataset.id));

  main.querySelectorAll('[data-action="print-player"]').forEach(b=>b.onclick=async()=>{
    const originalText = b.textContent;
    b.textContent = '⏳ Generowanie PDF...';
    b.disabled = true;
    try{
      await generatePlayerPDF(b.dataset.id);
    }catch(e){
      console.error('Błąd generowania PDF:', e);
      alert('Nie udało się wygenerować PDF: ' + (e.message||e));
    }finally{
      b.textContent = originalText;
      b.disabled = false;
    }
  });

  document.querySelectorAll('[data-action="logout"]').forEach(b=>b.onclick=()=>performLogout());
  document.querySelectorAll('[data-action="login-screen"]').forEach(b=>b.onclick=()=>renderLoginScreen());

  // Zakładka „Dostęp": decyzje administratora o kontach.
  main.querySelectorAll('[data-action="konta-odswiez"]').forEach(b=>b.onclick=()=>{ odswiezKonta(); render(); });
  main.querySelectorAll('[data-action="konto-decyzja"]').forEach(b=>b.onclick=async()=>{
    const id = b.dataset.id, status = b.dataset.status;
    const konto = (kontaLista||[]).find(k=>k.userId===id);
    const kto = konto ? (konto.imieNazwisko || konto.email) : 'to konto';
    if(status === 'zatwierdzone'){
      if(!confirm(`Przyznać dostęp do całego systemu: ${kto}?`)) return;
    } else if(!confirm(`Zamknąć dostęp: ${kto}? Konto przestanie widzieć dane natychmiast.`)) return;
    const napis = b.textContent;
    b.disabled = true; b.textContent = 'Zapisuję…';
    const r = await ustawStatusKonta(id, status);
    if(!r.ok){ alert(r.error); b.disabled=false; b.textContent=napis; return; }
    await odswiezKonta();   // sam przerysowuje listę po pobraniu
  });
  main.querySelectorAll('[data-action="konto-rola"]').forEach(b=>b.onclick=async()=>{
    const id = b.dataset.id, rola = b.dataset.rola;
    const konto = (kontaLista||[]).find(k=>k.userId===id);
    const kto = konto ? (konto.imieNazwisko || konto.email) : 'to konto';
    if(!confirm(rola==='admin'
      ? `Nadać prawa administratora: ${kto}? Będzie mógł przyznawać i odbierać dostęp innym.`
      : `Odebrać prawa administratora: ${kto}?`)) return;
    b.disabled = true;
    const r = await ustawRoleKonta(id, rola);
    if(!r.ok){ alert(r.error); b.disabled=false; return; }
    await odswiezKonta();   // sam przerysowuje listę po pobraniu
  });

  main.querySelectorAll('.quick-crest-input').forEach(inp=>inp.onchange = async ()=>{
    const file = inp.files[0];
    if(!file) return;
    const club = DB.clubs.find(c=>c.id===inp.dataset.clubId);
    if(!club) return;
    try{
      DB.clubCrests[club.id] = await processCrestFile(file);
      await saveClubCrests();
      render();
    }catch(e){
      alert('Nie udało się wczytać tego pliku. Spróbuj PNG/JPG lub PDF.');
      console.error(e);
    }
  });
  main.querySelectorAll('.agency-logo-input').forEach(inp=>inp.onchange = async ()=>{
    const file = inp.files[0];
    if(!file) return;
    const a = agencyById(inp.dataset.agencyId);
    if(!a) return;
    try{
      if(!DB.agencyLogos) DB.agencyLogos = {};
      DB.agencyLogos[a.id] = await processCrestFile(file);
      const ok = await saveAgencyLogos();
      if(!ok){ alert('Nie udało się zapisać logo — sprawdź baner u góry strony.'); return; }
      render();
    }catch(e){
      alert('Nie udało się wczytać tego pliku. Spróbuj PNG/JPG lub PDF.');
      console.error(e);
    }
  });
  main.querySelectorAll('.player-photo-input').forEach(inp=>inp.onchange = async ()=>{
    const file = inp.files[0];
    if(!file) return;
    const pl = DB.players.find(x=>x.id===inp.dataset.playerId);
    if(!pl) return;
    try{
      pl.photoUrl = await processPlayerPhotoFile(file);
      await savePlayers();
      render();
    }catch(e){
      alert('Nie udało się wczytać tego pliku. Spróbuj PNG/JPG lub PDF.');
      console.error(e);
    }
  });
  main.querySelectorAll('.talent-remove-btn').forEach(b=>b.onclick=async()=>{
    const ok = await deleteTalentRecord(b.dataset.id);
    if(!ok){ alert('Nie udało się usunąć — sprawdź baner u góry strony. Nic nie usunięto.'); return; }
    DB.talents = DB.talents.filter(t=>t.id!==b.dataset.id);
    render();
  });
  main.querySelectorAll('[data-action="talent-promote"]').forEach(b=>b.onclick=()=>{
    promoteTalentToPlayer(b.dataset.id);
  });

  // Zaznaczanie i usuwanie wielu talentów naraz. Lista rośnie szybko przy imporcie z arkusza,
  // a kasowanie pojedynczo bywa dziesiątkami kliknięć.
  const talentChecks = main.querySelectorAll('.talent-check') as any;
  const talentAll = main.querySelector('#talent-select-all') as any;
  const talentDelBtn = main.querySelector('#talent-delete-selected') as any;
  function odswiezTalentPrzycisk(){
    if(!talentDelBtn) return;
    const ile = Array.from(talentChecks).filter((c:any)=>c.checked).length;
    talentDelBtn.style.display = ile ? 'inline-block' : 'none';
    talentDelBtn.textContent = `🗑️ Usuń zaznaczonych (${ile})`;
  }
  if(talentAll) talentAll.onchange = ()=>{
    Array.from(talentChecks).forEach((c:any)=>c.checked = talentAll.checked);
    odswiezTalentPrzycisk();
  };
  Array.from(talentChecks).forEach((c:any)=>c.onchange = odswiezTalentPrzycisk);
  if(talentDelBtn) talentDelBtn.onclick = async ()=>{
    const ids = Array.from(talentChecks).filter((c:any)=>c.checked).map((c:any)=>c.dataset.id);
    if(!ids.length) return;
    if(!confirm(`Usunąć ${ids.length} ${ids.length===1?'talent':'talentów'} z listy?\n\nTego nie można cofnąć.`)) return;
    // Kasujemy jednym zapytaniem, a nie po jednym — przy kilkudziesięciu wpisach to różnica
    // między chwilą a kilkunastoma sekundami.
    const ok = await deleteTalentRecords(ids);
    if(!ok){ alert('Nie udało się usunąć — sprawdź baner u góry strony. Nic nie usunięto.'); return; }
    const zbior = new Set(ids);
    DB.talents = DB.talents.filter(t=>!zbior.has(t.id));
    render();
  };
  main.querySelectorAll('[data-action="talent-add-manual"]').forEach(b=>b.onclick=()=>addTalentManually());
  main.querySelectorAll('[data-action="talent-paste-parse"]').forEach(b=>b.onclick=()=>{
    const ta = main.querySelector('#talent-paste-text');
    talentPasteText = ta ? ta.value : '';
    try{
      talentPasteParsed = parseTalentPastedText(talentPasteText).talents;
    }catch(e){
      alert(e.message || 'Nie udało się rozpoznać wklejonego tekstu.');
      talentPasteParsed = null;
    }
    render();
  });
  main.querySelectorAll('[data-action="talent-paste-import"]').forEach(b=>b.onclick=async()=>{
    const checked = Array.from(main.querySelectorAll('.talent-paste-check:checked')).map(c=>Number(c.dataset.idx));
    const toAdd = checked.map(i=>talentPasteParsed[i]).filter(Boolean);
    if(!toAdd.length){ alert('Brak zaznaczonych zawodników do dodania.'); return; }
    DB.talents.push(...toAdd);
    const ok = await saveTalents();
    if(!ok){ alert('Nie udało się zapisać — sprawdź baner u góry strony.'); return; }
    talentPasteText = ''; talentPasteParsed = null;
    render();
  });
  main.querySelectorAll('.contact-remove-btn').forEach(b=>b.onclick=async()=>{
    const ok = await deleteContactRecord(b.dataset.id);
    if(!ok){ alert('Nie udało się usunąć — sprawdź baner u góry strony. Nic nie usunięto.'); return; }
    DB.contacts = DB.contacts.filter(c=>c.id!==b.dataset.id);
    render();
  });
  main.querySelectorAll('[data-action="contacts-download-template"]').forEach(b=>b.onclick=()=>{
    try{ downloadContactsTemplate(); }
    catch(e){ console.error(e); alert('Nie udało się pobrać szablonu: ' + (e.message||e)); }
  });
  main.querySelectorAll('[data-action="contacts-export-excel"]').forEach(b=>b.onclick=()=>{
    try{ downloadContactsExcel(); }
    catch(e){ console.error(e); alert('Nie udało się wygenerować pliku Excel: ' + (e.message||e)); }
  });
  main.querySelectorAll('[data-action="contacts-export-pdf"]').forEach(b=>b.onclick=()=>{
    try{ downloadContactsPdf(); }
    catch(e){ console.error(e); alert('Nie udało się wygenerować pliku: ' + (e.message||e)); }
  });
  const contactSearchInput = main.querySelector('#contact-search');
  if(contactSearchInput) contactSearchInput.oninput = ()=>{ contactSearchQuery = contactSearchInput.value; render(); };
  const monitoringSearchInput = main.querySelector('#monitoring-search');
  if(monitoringSearchInput) monitoringSearchInput.oninput = ()=>{ monitoringSearchQuery = monitoringSearchInput.value; render(); };
  main.querySelectorAll('.contact-inline-input').forEach(inp=>inp.onchange = async ()=>{
    await updateContactField(inp.dataset.id, inp.dataset.field, inp.value.trim());
    // Po zmianie nazwy klubu przebuduj listę, żeby wiersz od razu trafił na właściwe miejsce (alfabet).
    if(inp.dataset.field === 'club') render();
  });
  main.querySelectorAll('.committee-decision-select').forEach(sel=>sel.onchange = ()=>{
    updateCommitteeField(sel.dataset.id, 'committeeDecision', sel.value);
  });
  main.querySelectorAll('.committee-notes-input').forEach(inp=>inp.onchange = ()=>{
    updateCommitteeField(inp.dataset.id, 'committeeNotes', inp.value.trim());
  });
  main.querySelectorAll('[data-action="open-committee-reports"]').forEach(b=>b.onclick=()=>openCommitteeReportsModal(b.dataset.id));
  main.querySelectorAll('[data-action="manage-transfer-history"]').forEach(b=>b.onclick=()=>openTransferHistoryModal(b.dataset.id));
  main.querySelectorAll('[data-action="import-squad"]').forEach(b=>b.onclick=()=>openSquadImportModal(b.dataset.id));
  main.querySelectorAll('[data-action="import-squad-stats"]').forEach(b=>b.onclick=()=>openSquadStatsModal(b.dataset.id));
  main.querySelectorAll('[data-action="stats-90minut"]').forEach(b=>b.onclick=()=>open90minutStatsModal(b.dataset.id));

  // Zaznaczanie i usuwanie zawodników wprost ze składu klubu — pojedynczo lub całością.
  const squadChecks = document.querySelectorAll('.squad-player-check');
  const squadDelBtn = document.getElementById('squad-delete-btn');
  const squadResetBtn = document.getElementById('squad-reset-stats-btn');
  const squadAll = document.getElementById('squad-select-all');
  const odswiezPrzycisk = ()=>{
    const n = Array.from(squadChecks).filter(c=>c.checked).length;
    if(squadDelBtn){
      squadDelBtn.style.display = n ? 'inline-block' : 'none';
      squadDelBtn.textContent = `🗑️ Usuń zaznaczonych (${n})`;
    }
    if(squadResetBtn){
      squadResetBtn.style.display = n ? 'inline-block' : 'none';
      squadResetBtn.textContent = `↺ Wyzeruj statystyki (${n})`;
    }
  };
  squadChecks.forEach(c=>c.onchange = odswiezPrzycisk);
  if(squadAll) squadAll.onchange = ()=>{ squadChecks.forEach(c=>c.checked = squadAll.checked); odswiezPrzycisk(); };
  if(squadDelBtn) squadDelBtn.onclick = async ()=>{
    const ids = Array.from(squadChecks).filter(c=>c.checked).map(c=>c.dataset.id);
    if(!ids.length) return;
    if(!confirm(`Usunąć ${ids.length} zawodników z bazy? Tego nie można cofnąć.`)) return;
    const orig = squadDelBtn.textContent;
    squadDelBtn.disabled = true; squadDelBtn.textContent = `Usuwam ${ids.length}…`;
    try{
      await storage.deleteItems('scouting:players', ids);
      const gone = new Set(ids);
      DB.players = DB.players.filter(p=>!gone.has(p.id));
      DB.observations = DB.observations.filter(o=>!gone.has(o.playerId));
      render();
    }catch(e){
      squadDelBtn.disabled = false; squadDelBtn.textContent = orig;
      alert('Nie udało się usunąć: ' + ((e as any).message||e));
    }
  };
  // Wyzerowanie dorobku BIEŻĄCEGO sezonu — potrzebne, gdy statystyki wjechały błędnie (np. z wklejki
  // pomylonej z protokołem) i trzeba wczytać je od nowa. Zerujemy do pustej wartości, a nie do zera:
  // „nie wiemy" to co innego niż „zagrał zero minut", a dopisywanie z protokołu i tak startuje od (x||0).
  //
  // Kasujemy też listę rozliczonych meczów — bez tego ponowne wczytanie tego samego protokołu zostałoby
  // pominięte jako już policzone i wyzerowanie nie dałoby się cofnąć wczytaniem. Archiwum sezonów
  // (seasonStats) zostaje nietknięte: dotyczy lat poprzednich i nie ma związku z tym błędem.
  if(squadResetBtn) squadResetBtn.onclick = async ()=>{
    const ids = new Set(Array.from(squadChecks).filter(c=>c.checked).map(c=>c.dataset.id));
    if(!ids.size) return;
    if(!confirm(`Wyzerować statystyki bieżącego sezonu u ${ids.size} zawodników?\n\n`
      + `Czyszczę: mecze, minuty, gole, asysty, kartki oraz znacznik rozliczonych meczów.\n`
      + `Zostaje: archiwum poprzednich sezonów, oceny i obserwacje.`)) return;
    const orig = squadResetBtn.textContent;
    squadResetBtn.disabled = true; squadResetBtn.textContent = `Zeruję ${ids.size}…`;
    const kopia = DB.players.filter(p=>ids.has(p.id)).map(p=>({...p}));
    DB.players.forEach(p=>{
      if(!ids.has(p.id)) return;
      p.matches = null; p.minutes = null; p.goals = null; p.assists = null;
      p.yellowCards = null; p.redCards = null;
      p.statsUpdatedAt = ''; p.statsSource = '';
      p.rozliczoneMecze = [];
    });
    const ok = await savePlayers();
    if(!ok){
      // Zapis nie przeszedł — cofamy zmianę w pamięci, żeby widok nie pokazywał wyzerowanych
      // liczb, których w bazie nie ma.
      const wg = new Map(kopia.map(p=>[p.id, p]));
      DB.players = DB.players.map(p=> wg.get(p.id) || p);
      squadResetBtn.disabled = false; squadResetBtn.textContent = orig;
      alert('Nie udało się zapisać — sprawdź baner u góry strony. Nic nie zostało zmienione.');
      return;
    }
    render();
  };

  main.querySelectorAll('[data-action="league-stats"]').forEach(b=>b.onclick=()=>openLeagueStatsModal(b.dataset.league));
  main.querySelectorAll('[data-action="merge-duplicates"]').forEach(b=>b.onclick=()=>openMergeDuplicatesModal());
  main.querySelectorAll('[data-action="analyze-player"]').forEach(b=>b.onclick=()=>openPlayerAnalysisModal(b.dataset.id));
  main.querySelectorAll('[data-action="contacts-fill-clubs"]').forEach(b=>b.onclick=async()=>{
    let filled = 0, noMatch = 0;
    DB.contacts.forEach(c=>{
      if(c.club && c.club.trim()) return;          // nie nadpisuj ręcznie wpisanych
      const name = clubFromEmail(c.email);
      if(name){ c.club = name; filled++; } else if(c.email){ noMatch++; }
    });
    if(filled){ await saveContacts(); }
    render();
    alert(`Uzupełniono klub dla ${filled} kontaktów z adresu e-mail.` + (noMatch? `\nNie dopasowano: ${noMatch} (brak klubu w bazie pasującego do adresu) — uzupełnij ręcznie.` : ''));
  });

  const contactsImportInput = main.querySelector('#contacts-import-input');
  if(contactsImportInput) contactsImportInput.onchange = async ()=>{
    const file = contactsImportInput.files[0];
    if(!file) return;
    const status = main.querySelector('#contacts-import-status');
    if(status){ status.textContent = 'Wczytuję arkusz…'; status.style.color = 'var(--ink-soft)'; }
    try{
      const result = await parseContactsSpreadsheet(file);
      // Adresy z arkusza (kolumna „Adres") zdejmujemy z kontaktów i przypisujemy klubom — inaczej
      // zapis do bazy padłby na nieistniejącej kolumnie, a adres by przepadł.
      let adresow = 0;
      const adresyDoPrzypisania = [];
      result.contacts.forEach(c=>{
        const adr = c._address;
        delete c._address;
        if(adr && c.club) adresyDoPrzypisania.push([c.club, adr]);
      });
      DB.contacts.push(...result.contacts);
      await saveContacts();
      for(const [klub, adr] of adresyDoPrzypisania){
        if(await setClubAddressByName(klub, adr)) adresow++;
      }
      render();
      const uwagi = [];
      if(result.skippedCount > 0) uwagi.push('Pominięto ' + result.skippedCount + ' wiersz(y), które wyglądały na notatkę/legendę.');
      if(adresyDoPrzypisania.length) uwagi.push('Adresy przypisano do ' + adresow + ' z ' + adresyDoPrzypisania.length + ' klubów (resztę pomijam — brak takiego klubu w bazie).');
      if(uwagi.length) alert('Zaimportowano ' + result.contacts.length + ' kontaktów.\n\n' + uwagi.join('\n'));
    }catch(e){
      console.error(e);
      if(status){ status.textContent = 'Błąd importu: ' + (e.message||e); status.style.color='var(--clay-dark)'; }
    }
  };
  main.querySelectorAll('[data-action="add-club"]').forEach(b=>b.onclick=()=>openClubModal(null));
  main.querySelectorAll('[data-action="paste-clubs"]').forEach(b=>b.onclick=()=>openPasteClubsModal());
  main.querySelectorAll('[data-action="edit-club"]').forEach(b=>b.onclick=()=>openClubModal(b.dataset.id));
  main.querySelectorAll('[data-action="delete-club"]').forEach(b=>b.onclick=async()=>{
    if(confirm('Usunąć ten klub?')){
      const ok = await deleteClubRecord(b.dataset.id);
      if(!ok){ alert('Nie udało się usunąć klubu — sprawdź baner u góry strony. Nic nie usunięto.'); return; }
      DB.clubs = DB.clubs.filter(c=>c.id!==b.dataset.id);
      viewingClubId = null;
      render();
    }
  });
  main.querySelectorAll('[data-action="browse-top"]').forEach(b=>b.onclick=()=>{
    clubBrowse.top = b.dataset.val; clubBrowse.group=""; render();
  });
  main.querySelectorAll('.league-logo-input').forEach(inp=>inp.onchange = async ()=>{
    const file = inp.files[0];
    if(!file) return;
    try{
      const dataUrl = await processCrestFile(file);
      if(!DB.settings.leagueLogos) DB.settings.leagueLogos = {};
      DB.settings.leagueLogos[inp.dataset.league] = dataUrl;
      await saveSettings();
      render();
    }catch(e){ console.error('Nie udało się wczytać logo ligi:', e); alert('Nie udało się wczytać logo ligi.'); }
  });
  main.querySelectorAll('[data-action="browse-group"]').forEach(b=>b.onclick=()=>{
    clubBrowse.group = b.dataset.val;
    if(/^Rocznik \d{4}$/.test(b.dataset.val)){
      viewingRocznikGroup = b.dataset.val;
      currentView = 'players';
      viewingPlayerId = null;
    }
    render();
  });
  main.querySelectorAll('[data-action="view-club"]').forEach(b=>b.onclick=()=>{
    viewingClubId = b.dataset.id; render();
  });
  main.querySelectorAll('[data-action="back-clubs"]').forEach(b=>b.onclick=()=>cofnijWidok(()=>{ viewingClubId = null; }));
  main.querySelectorAll('[data-action="add-player-to-club"]').forEach(b=>b.onclick=()=>openPlayerModal(null, b.dataset.id));

  const obsScoutSelect = main.querySelector('#obs-scout-select');
  if(obsScoutSelect){
    obsScoutSelect.onchange = ()=>{
      const newInput = main.querySelector('#obs-scout-new');
      if(newInput) newInput.style.display = (obsScoutSelect.value==='__new__') ? 'block' : 'none';
    };
  }
  main.querySelectorAll('[data-action="open-obs-location-map"]').forEach(b=>b.onclick=()=>openObsLocationMap());

  // Żywe liczenie dystansu A→B w planie obserwacji (po opuszczeniu pola startu lub miejsca).
  const obsStart = main.querySelector('#obs-start');
  const obsLoc = main.querySelector('#obs-location');
  const obsDist = main.querySelector('#obs-distance-info');
  if(obsStart && obsLoc && obsDist){
    const recompute = async ()=>{
      const start = obsStart.value.trim(), dest = obsLoc.value.trim();
      if(!start || !dest){ obsDist.textContent = ''; return; }
      obsDist.textContent = 'Liczę dystans…';
      const km = await calcDistanceBetween(start, dest);
      obsDist.innerHTML = (km!=null)
        ? `📍 <strong>${km} km</strong> w linii prostej: „${esc(start)}" → „${esc(dest)}"`
        : 'Nie udało się obliczyć dystansu — sprawdź nazwy miejscowości.';
    };
    obsStart.addEventListener('blur', ()=>setTimeout(recompute, 150)); // opóźnienie, by klik w podpowiedź zdążył wpisać wartość
    obsLoc.addEventListener('blur', ()=>setTimeout(recompute, 150));
  }
  // Własne podpowiedzi adresów (zamiast natywnego <datalist>, niespójnego w tym środowisku) — filtrują się
  // po każdej wpisanej literze i pamiętają wszystkie miejscowości/adresy użyte we wcześniejszych planach.
  // Pozycja podpowiedzi ma osobno ETYKIETĘ (co widać, np. z nazwą klubu) i WARTOŚĆ (co trafia do
  // pola). Bez tego rozdzielenia wybranie „ul. Sportowa 5 — Elana Toruń" wpisywałoby do adresu
  // także nazwę klubu i psuło liczenie dystansu.
  function setupAddressAutocomplete(inputEl, boxEl, sourceValues){
    if(!inputEl || !boxEl) return;
    const widziane = new Set();
    const values = [];
    sourceValues.filter(Boolean).forEach(v=>{
      const etykieta = typeof v === 'string' ? v : v.etykieta;
      const wartosc = typeof v === 'string' ? v : v.wartosc;
      if(!etykieta || !wartosc || widziane.has(etykieta)) return;
      widziane.add(etykieta);
      values.push({etykieta, wartosc});
    });
    const render = ()=>{
      const q = inputEl.value.trim().toLowerCase();
      const matches = q ? values.filter(v=>v.etykieta.toLowerCase().includes(q) && v.wartosc.toLowerCase()!==q) : values;
      if(!matches.length){ boxEl.innerHTML=''; boxEl.style.display='none'; return; }
      boxEl.innerHTML = matches.slice(0,8).map((v,i)=>`<div class="addr-suggestion-item" data-idx="${i}">${esc(v.etykieta)}</div>`).join('');
      boxEl.style.display = 'block';
      const widoczne = matches.slice(0,8);
      boxEl.querySelectorAll('.addr-suggestion-item').forEach(item=>{
        item.onmousedown = (e)=>{
          e.preventDefault();
          inputEl.value = widoczne[Number(item.dataset.idx)].wartosc;
          boxEl.style.display='none';
          inputEl.dispatchEvent(new Event('blur'));
        };
      });
    };
    inputEl.addEventListener('input', render);
    inputEl.addEventListener('focus', render);
    inputEl.addEventListener('blur', ()=>setTimeout(()=>{ boxEl.style.display='none'; }, 200));
  }
  setupAddressAutocomplete(obsStart, main.querySelector('#obs-start-suggestions'),
    DB.observations.map(o=>o.startLocation).concat(DB.settings.startLocation||[]));
  // Adresy obiektów podpowiadamy z DWÓCH źródeł: z wcześniejszych planów ORAZ z adresów
  // zapamiętanych przy klubach. To drugie było zbierane, ale nigdy nie pokazywane — więc wpisując
  // „Elana" nie dostawało się adresu, który system już znał. Do adresu doklejamy nazwę klubu,
  // żeby dało się go znaleźć po nazwie drużyny, a nie tylko po ulicy.
  const adresyKlubow = Object.entries(DB.settings.stadiumAddresses || {}).map(([clubId, adres])=>{
    const nazwa = clubName(clubId);
    return {etykieta: (nazwa && nazwa !== '—') ? `${adres} — ${nazwa}` : adres, wartosc: adres};
  });
  setupAddressAutocomplete(obsLoc, main.querySelector('#obs-location-suggestions'),
    adresyKlubow.concat(DB.observations.map(o=>o.location)));

  // Wpisanie meczu podstawia adres gospodarza, jeśli system go pamięta, a pole jest jeszcze puste.
  // Dzięki temu przy „Elana Toruń - …" adres pojawia się sam, bez szukania w podpowiedziach.
  const obsMatchInput = main.querySelector('#obs-match');
  if(obsMatchInput && obsLoc){
    obsMatchInput.addEventListener('blur', ()=>{
      if(obsLoc.value.trim()) return;                       // nie nadpisujemy tego, co wpisałeś
      const adres = stadiumAddressFor(hostFromMatch(obsMatchInput.value));
      if(!adres) return;
      obsLoc.value = adres;
      obsLoc.dispatchEvent(new Event('blur'));              // przelicz dystans
    });
  }
  main.querySelectorAll('[data-action="cal-prev-month"]').forEach(b=>b.onclick=()=>calShiftMonth(-1));
  main.querySelectorAll('[data-action="cal-next-month"]').forEach(b=>b.onclick=()=>calShiftMonth(1));
  main.querySelectorAll('.cal-cell[data-date]').forEach(cell=>cell.onclick=()=>calSelectDay(cell.dataset.date));
  main.querySelectorAll('[data-action="save-obs"]').forEach(b=>b.onclick=()=>saveNewObservation());

  // Edycja/usuwanie zaplanowanej lub zrealizowanej obserwacji.
  main.querySelectorAll('[data-action="edit-obs"]').forEach(b=>b.onclick=()=>{
    editingObsId = b.dataset.id;
    currentView = 'newobs';
    render();
    const card = document.querySelector('.main .card'); if(card) card.scrollIntoView({behavior:'smooth', block:'start'});
  });
  main.querySelectorAll('[data-action="obs-sklad"]').forEach(b=>b.onclick=()=>openObsSkladModal(b.dataset.id));
  main.querySelectorAll('[data-action="cancel-edit-obs"]').forEach(b=>b.onclick=()=>{ editingObsId = null; render(); });
  main.querySelectorAll('[data-action="delete-obs"]').forEach(b=>b.onclick=async()=>{
    if(!confirm('Usunąć tę obserwację?')) return;
    const ok = await deleteObservationRecord(b.dataset.id);
    if(!ok){ alert('Nie udało się usunąć obserwacji — sprawdź baner u góry strony. Nic nie usunięto.'); return; }
    DB.observations = DB.observations.filter(o=>o.id!==b.dataset.id);
    if(editingObsId===b.dataset.id) editingObsId = null;
    render();
  });

  // Edycja istniejącego raportu — wczytaj go do formularza (prefill w viewReports wg editingReportId).
  main.querySelectorAll('[data-action="edit-report"]').forEach(b=>b.onclick=()=>{
    const r = DB.reports.find(x=>x.id===b.dataset.id);
    if(!r) return;
    editingReportId = r.id;
    reportPerspektywaValue = r.perspektywa || '';
    reportStatusValue = '';
    reportObsTypeValue = r.obsType || '';
    currentView = 'reports'; viewingPlayerId = null;
    render();
    const card = document.querySelector('.main .card'); if(card) card.scrollIntoView({behavior:'smooth', block:'start'});
  });
  main.querySelectorAll('[data-action="cancel-edit-report"]').forEach(b=>b.onclick=()=>{
    editingReportId = null; reportPerspektywaValue = ''; reportStatusValue = ''; reportObsTypeValue = ''; render();
  });
  main.querySelectorAll('[data-action="delete-report"]').forEach(b=>b.onclick=async()=>{
    if(!confirm('Usunąć ten raport?')) return;
    const id = b.dataset.id;
    const ok = await deleteReportRecord(id);
    if(!ok){ alert('Nie udało się usunąć raportu — sprawdź baner u góry strony. Nic nie usunięto.'); return; }
    DB.reports = DB.reports.filter(r=>r.id!==id);
    if(editingReportId===id){ editingReportId = null; reportPerspektywaValue=''; reportStatusValue=''; reportObsTypeValue=''; }
    render();
  });
  main.querySelectorAll('.persp-btn').forEach(btn=>btn.onclick=()=>selectPerspektywa(btn.dataset.value));
  main.querySelectorAll('.status-btn').forEach(btn=>btn.onclick=()=>selectReportStatus(btn.dataset.value));
  main.querySelectorAll('.obstype-btn').forEach(btn=>btn.onclick=()=>selectObsType(btn.dataset.value));
  // Punktowe ocenianie 1-6 — ustaw wartość w ukrytym inpucie i podświetl wybrany punkt (bez render → nic nie kasuje).
  main.querySelectorAll('.rp-dot').forEach(btn=>btn.onclick=()=>{
    const target = document.getElementById(btn.dataset.target);
    if(target) target.value = btn.dataset.val;
    btn.parentElement.querySelectorAll('.rp-dot').forEach(d=>d.classList.toggle('active', d===btn));
  });
  // Szybkie statystyki sezonu (profil zawodnika) — zapis bez otwierania pełnej edycji.
  main.querySelectorAll('[data-action="save-quick-stats"]').forEach(b=>b.onclick=async()=>{
    const pl = DB.players.find(x=>x.id===b.dataset.id);
    if(!pl) return;
    const num = id=>{ const el=document.getElementById(id); const v=el?el.value:''; return v===''? null : Number(v); };
    pl.matches = num('qs-matches'); pl.minutes = num('qs-minutes'); pl.goals = num('qs-goals'); pl.assists = num('qs-assists');
    pl.yellowCards = num('qs-yellow'); pl.redCards = num('qs-red');
    const orig = b.textContent; b.textContent = 'Zapisywanie...'; b.disabled = true;
    const ok = await savePlayers();
    b.textContent = ok ? '✓ Zapisano' : 'Błąd zapisu — spróbuj ponownie';
    setTimeout(()=>render(), 700);
  });

  // Opis końcowy — zapis prosto z pola tekstowego w profilu.
  main.querySelectorAll('[data-action="save-opis"]').forEach(b=>b.onclick=async()=>{
    const pl = DB.players.find(x=>x.id===b.dataset.id);
    if(!pl) return;
    const ta = document.getElementById('opis-koncowy');
    pl.opisKoncowy = ta ? ta.value.trim() : '';
    const orig = b.textContent; b.textContent = 'Zapisywanie...'; b.disabled = true;
    const ok = await savePlayers();
    b.textContent = ok ? '✓ Zapisano' : 'Błąd zapisu — spróbuj ponownie';
    b.disabled = false;
    if(ok) setTimeout(()=>{ if(b.isConnected) b.textContent = orig; }, 1500);
  });

  // Porównywarka zawodników
  // Wyszukiwarka zawodnika w Raportach: pole tekstowe zawężające listę literami. Przy ponad
  // dwóch tysiącach zawodników zwykła lista rozwijana była nie do przejrzenia.
  (function(){
    const hidden = document.getElementById('rep-player');
    const search = document.getElementById('rep-player-search');
    const list = document.getElementById('rep-player-list');
    if(!hidden || !search || !list) return;
    const norm = szukajNorm;
    const gracze = DB.players.slice().sort((a,b)=>
      (a.lastName||a.firstName||'').localeCompare(b.lastName||b.firstName||'','pl')
      || (a.firstName||'').localeCompare(b.firstName||'','pl'));

    const ustaw = (p)=>{
      hidden.value = p ? p.id : '';
      search.value = p ? playerLabelFor(p.id) : '';
    };
    function rysuj(q){
      const nq = norm(q.trim());
      // Szukamy w nazwisku, imieniu i nazwie klubu — każde słowo z osobna, więc "kowal legia" też trafi.
      const slowa = nq ? nq.split(/\s+/) : [];
      const pasuje = p=>{
        if(!slowa.length) return true;
        const hay = norm(`${p.lastName||''} ${p.firstName||''} ${clubName(p.clubId)}`);
        return slowa.every(w=>hay.includes(w));
      };
      // Kolejność wyników: najpierw nazwiska ZACZYNAJĄCE się od wpisanej frazy, potem zawierające ją
      // w nazwisku, na końcu trafienia po imieniu lub klubie. Bez tego wpisanie "k" pokazywało
      // najpierw zawodników klubów z literą "k" w nazwie, zamiast nazwisk na "K".
      const ranga = (p)=>{
        if(!slowa.length) return 3;
        const nazw = norm(p.lastName||'');
        if(nazw.startsWith(slowa[0])) return 0;
        if(nazw.includes(slowa[0])) return 1;
        if(norm(p.firstName||'').startsWith(slowa[0])) return 2;
        return 3;
      };
      let trafienia = gracze.filter(pasuje)
        .sort((a,b)=> ranga(a) - ranga(b))     // sort stabilny — w obrębie rangi zostaje alfabet
        .slice(0,60);

      // LITERÓWKA NIE MOŻE UKRYWAĆ ZAWODNIKA.
      //
      // Nazwiska pisze się z pamięci i jedna litera nie tam ("Jedliński" zamiast "Jeleński")
      // kończyła się komunikatem „brak zawodnika" — a zawodnik jest w bazie i nie ma jak tego
      // zgadnąć. Gdy dokładnych trafień nie ma, pokazujemy najbliższe nazwiska.
      let podpowiedzi = false;
      if(!trafienia.length && slowa.length && slowa[0].length >= 4){
        const proba = slowa[0];
        const limit = proba.length <= 5 ? 1 : 2;   // krótkie nazwiska są czulsze na pomyłkę
        trafienia = gracze
          .map(p=>({ p, d: odlegloscEdycyjna(proba, norm(p.lastName||'')) }))
          .filter(x=> x.d <= limit)
          .sort((a,b)=> a.d - b.d)
          .slice(0,10)
          .map(x=> x.p);
        podpowiedzi = trafienia.length > 0;
      }

      list.innerHTML = (podpowiedzi ? '<div class="club-combo-empty" style="text-align:left;">Nie ma dokładnego trafienia — może chodzi o:</div>' : '') + (trafienia.length ? trafienia.map(p=>{
        const rocznik = p.birthYear ? p.birthYear : '—';
        return `<div class="club-combo-item" data-id="${esc(p.id)}">
          <strong>${esc(p.lastName||'')} ${esc(p.firstName||'')}</strong>
          <span class="club-combo-reg">${esc(clubName(p.clubId))} · ${esc(rocznik)}</span>
        </div>`;
      }).join('') : '<div class="club-combo-empty">Brak zawodnika pasującego do frazy.</div>');
      list.style.display = 'block';
      list.querySelectorAll('.club-combo-item').forEach(it=>it.onmousedown=(e)=>{
        e.preventDefault();                       // wybór przed zdarzeniem blur pola
        ustaw(gracze.find(x=>x.id===it.dataset.id));
        list.style.display = 'none';
      });
    }
    search.oninput = ()=>rysuj(search.value);
    search.onfocus = ()=>rysuj(search.value);
    search.onblur = ()=>setTimeout(()=>{
      list.style.display = 'none';
      // Po wyjściu z pola przywracamy podpis aktualnie wybranego — żeby nie zostawał urwany tekst.
      ustaw(gracze.find(x=>x.id===hidden.value) || null);
    }, 150);
  })();

  main.querySelectorAll('[data-action="compare-open"]').forEach(b=>b.onclick=()=>{
    // Zaznaczeni na liście przechodzą wprost do porównywarki. Porównanie obsługuje trzech
    // zawodników — przy większym zaznaczeniu bierzemy trzech pierwszych i mówimy o tym wprost,
    // zamiast po cichu uciąć resztę.
    const zaznaczeni = Array.from(document.querySelectorAll('.player-checkbox:checked'))
      .map(c=>(c as HTMLInputElement).dataset.id);
    if(zaznaczeni.length){
      if(zaznaczeni.length > 3){
        alert(`Zaznaczyłeś ${zaznaczeni.length} zawodników, a porównanie obejmuje najwyżej 3.\n\n` +
          `Porównam trzech pierwszych z listy. Aby porównać innych — odznacz nadmiarowych.`);
      }
      compareIds = [zaznaczeni[0]||'', zaznaczeni[1]||'', zaznaczeni[2]||''];
    }
    currentView='compare'; viewingPlayerId=null; render();
  });
  main.querySelectorAll('[data-action="compare-back"]').forEach(b=>b.onclick=()=>cofnijWidok(()=>{ currentView='players'; viewingPlayerId=null; }));
  [0,1,2].forEach(i=>{ const sel=main.querySelector('#compare-sel-'+i); if(sel) sel.onchange=()=>{ compareIds[i]=sel.value; render(); }; });

  // Wgrywanie wielu logotypów naraz — dopasowanie plików do klubów po nazwie.
  const multiLogo = main.querySelector('#multi-logo-input');
  if(multiLogo){
    multiLogo.onchange = async ()=>{
      const files = Array.from(multiLogo.files||[]);
      if(!files.length) return;
      const normName = s => szukajNorm(s).replace(/[^a-z0-9]/g,'');
      const matchedPairs = []; const unmatched = [];
      for(const file of files){
        const fn = normName(file.name.replace(/\.[^.]+$/,''));
        if(!fn){ unmatched.push(file.name); continue; }
        // Ranking dopasowań: dokładne > klub zaczyna się od nazwy pliku > plik zaczyna się od klubu > zawiera.
        const scored = DB.clubs.map(c=>{ const cn=normName(c.name); let rank=99;
          if(cn===fn) rank=0; else if(cn.startsWith(fn)) rank=1; else if(fn.startsWith(cn)) rank=2; else if(cn.includes(fn)||fn.includes(cn)) rank=3;
          return {c, cn, rank, dl:Math.abs(cn.length-fn.length)};
        }).filter(x=>x.rank<99).sort((a,b)=> a.rank-b.rank || a.dl-b.dl);
        const club = scored[0] && scored[0].c;
        if(!club){ unmatched.push(file.name); continue; }
        try{ DB.clubCrests[club.id] = await processCrestFile(file); matchedPairs.push(file.name+' → '+club.name); }
        catch(e){ unmatched.push(file.name+' (błąd pliku)'); }
      }
      if(matchedPairs.length) await saveClubCrests();
      render();
      alert(`Zapisano ${matchedPairs.length} logo:\n` + matchedPairs.join('\n') +
        (unmatched.length ? `\n\nNie dopasowano (${unmatched.length}) — wgraj je klikając w herb klubu:\n${unmatched.join('\n')}` : ''));
    };
  }
  main.querySelectorAll('[data-action="save-report"]').forEach(b=>b.onclick=async()=>{
    const playerId = document.getElementById('rep-player').value;
    if(!playerId){ alert('Wybierz zawodnika.'); return; }
    const scout = document.getElementById('rep-scout').value.trim() || currentScout || 'Nieznany';
    const rep = {
      id: editingReportId || uid('R'),
      playerId,
      date: document.getElementById('rep-date').value,
      scout,
      description: document.getElementById('rep-description').value.trim(),
      technika: document.getElementById('rep-technika').value.trim(),
      taktyka: document.getElementById('rep-taktyka').value.trim(),
      motoryka: document.getElementById('rep-motoryka').value.trim(),
      mentalnoscOpis: document.getElementById('rep-mentalnosc-opis').value.trim(),
      potencjalOpis: document.getElementById('rep-potencjal-opis').value.trim(),
      perspektywa: reportPerspektywaValue,
      obsType: reportObsTypeValue,
      phases: {}, setPieces: {},
      setPieceComment: document.getElementById('rep-setpiece-comment').value.trim()
    };
    REPORT_PHASES.forEach(f=> rep.phases[f.key] = Number(document.getElementById('rep-'+f.key).value));
    REPORT_SET_PIECES.forEach(f=> rep.setPieces[f.key] = Number(document.getElementById('rep-'+f.key).value));
    const wasEditing = !!editingReportId;
    if(wasEditing){
      const idx = DB.reports.findIndex(r=>r.id===editingReportId);
      if(idx>=0) DB.reports[idx] = rep; else DB.reports.push(rep);
    } else {
      DB.reports.push(rep);
    }
    await saveReports();
    // Przypisanie statusu z decyzji na dole raportu (jeśli wybrano). Pierwsze cztery => Monitoring,
    // "Do transferu"/"Na Testy" => mapa pozycji w Rankingu. Zapisujemy zawodnika osobno.
    if(reportStatusValue){
      const pl = DB.players.find(x=>x.id===playerId);
      if(pl){ pl.status = reportStatusValue; await savePlayers(); }
    }
    reportPerspektywaValue = '';
    reportStatusValue = '';
    reportObsTypeValue = '';
    editingReportId = null;
    if(scout && !DB.settings.scouts.includes(scout)){ DB.settings.scouts.push(scout); await saveSettings(); }
    currentView = wasEditing ? 'reports' : 'dashboard';
    render();
  });

  // filters
  const fr = document.getElementById('f-region'); if(fr) fr.onchange=()=>{playerFilters.region=fr.value; render();};
  const fl = document.getElementById('f-league'); if(fl) fl.onchange=()=>{playerFilters.league=fl.value; render();};
  const fp = document.getElementById('f-position'); if(fp) fp.onchange=()=>{playerFilters.position=fp.value; render();};
  const fs = document.getElementById('f-status'); if(fs) fs.onchange=()=>{playerFilters.status=fs.value; render();};
  const fby = document.getElementById('f-birthyear'); if(fby) fby.oninput=()=>{playerFilters.birthYear=fby.value.replace(/\D/g,''); render();};
  const fag = document.getElementById('f-agent'); if(fag) fag.onchange=()=>{playerFilters.agent=fag.value; render();};
  const fq = document.getElementById('f-search'); if(fq) fq.oninput=()=>{playerFilters.search=fq.value; render();};
  // Przerysowanie zabiera ognisko z pola, więc po każdej literze trzeba by w nie klikać na nowo.
  const fcl = document.getElementById('f-club');
  if(fcl) fcl.oninput=()=>{ playerFilters.club=fcl.value; zachowajKursorPoPrzerysowaniu(document, '#f-club', render); };

  // settings add/remove
  main.querySelectorAll('[data-action="add-setting"]').forEach(b=>b.onclick=async()=>{
    const key = b.dataset.key;
    const input = document.getElementById('add-'+key);
    const val = input.value.trim();
    if(!val) return;
    if(!DB.settings[key].includes(val)) DB.settings[key].push(val);
    await saveSettings(); render();
  });
  main.querySelectorAll('[data-action="del-setting"]').forEach(b=>b.onclick=async()=>{
    const key = b.dataset.key, idx = Number(b.dataset.idx);
    DB.settings[key].splice(idx,1);
    await saveSettings(); render();
  });
  main.querySelectorAll('[data-action="import-znicz-roster"]').forEach(b=>b.onclick=async()=>{
    b.disabled = true;
    const originalText = b.textContent;
    b.textContent = 'Importowanie...';
    try{
      const result = await importAllKnownRosters();
      const enrichResult = await enrichZniczRoster();
      const enrichAviaResult = await enrichRosterGeneric(SEED_PLAYER_ENRICHMENT_AVIA);
      const enrichGornikResult = await enrichRosterGeneric(SEED_PLAYER_ENRICHMENT_GORNIK);
      const enrichRekordResult = await enrichRosterGeneric(SEED_PLAYER_ENRICHMENT_REKORD);
      const enrichAviaV2Result = await enrichRosterGeneric(SEED_PLAYER_ENRICHMENT_AVIA_V2);
      const enrichOlimpiaResult = await enrichRosterGeneric(SEED_PLAYER_ENRICHMENT_OLIMPIA);
      if(!result.ok){
        alert('Import nie powiódł się.');
      } else {
        const perClubLines = result.perClub.map(c => c.clubName+': '+(c.added>0?('+'+c.added+' nowych'):'brak nowych')).join('\n');
        const totalEnriched = (enrichResult.ok?enrichResult.changed:0) + (enrichAviaResult.ok?enrichAviaResult.changed:0) + (enrichGornikResult.ok?enrichGornikResult.changed:0) + (enrichRekordResult.ok?enrichRekordResult.changed:0) + (enrichAviaV2Result.ok?enrichAviaV2Result.changed:0) + (enrichOlimpiaResult.ok?enrichOlimpiaResult.changed:0);
        const extra = totalEnriched>0 ? ('\n\nDodatkowo uzupełniono '+totalEnriched+' brakujących pól (linki, agenci, daty urodzenia, wzrost, poprawki pozycji).') : '';
        alert('Gotowe:\n' + perClubLines + extra);
      }
      render();
    }catch(e){
      console.error(e);
      alert('Import nie powiódł się z powodu błędu zapisu (spróbuj ponownie za chwilę): ' + (e.message||e));
    } finally {
      b.disabled = false;
      b.textContent = originalText;
    }
  });
  // Kopia zapasowa całej bazy do jednego pliku. Supabase w darmowym planie nie robi kopii,
  // więc jedyną istniejącą kopią jest ta, którą użytkownik pobierze sam.
  main.querySelectorAll('[data-action="kopia-pobierz"]').forEach(b=>b.onclick=()=>{
    const dane = {
      _opis: 'Kopia zapasowa Scout Base System', _wersja: 1,
      _data: new Date().toISOString(),
      _liczby: { zawodnicy: DB.players.length, kluby: DB.clubs.length, obserwacje: DB.observations.length },
      players: DB.players, clubs: DB.clubs, observations: DB.observations, reports: DB.reports,
      talents: DB.talents, contacts: DB.contacts, matches: DB.matches,
      agencies: DB.agencies, agents: DB.agents, agencyLogos: DB.agencyLogos,
      clubCrests: DB.clubCrests, settings: DB.settings,
    };
    const blob = new Blob([JSON.stringify(dane)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sbs_kopia_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  });

  const plikKopii = document.getElementById('kopia-plik');
  if(plikKopii) plikKopii.onchange = async ()=>{
    const f = plikKopii.files[0];
    if(!f) return;
    try{
      const dane = JSON.parse(await f.text());
      if(!Array.isArray(dane.players)) throw new Error('To nie wygląda na kopię z SBS — brakuje listy zawodników.');
      const ile = `${(dane.players||[]).length} zawodników, ${(dane.clubs||[]).length} klubów, ${(dane.observations||[]).length} obserwacji`;
      if(!confirm(`Wczytać kopię z ${String(dane._data||'').slice(0,10)}?\n\nW pliku: ${ile}.\nObecnie w bazie: ${DB.players.length} zawodników.\n\nDane w bazie zostaną ZASTĄPIONE. Najpierw pobiorę kopię stanu obecnego.`)) { plikKopii.value=''; return; }
      // Kopia bezpieczeństwa PRZED podmianą — żeby dało się cofnąć pomyłkę w wyborze pliku.
      document.querySelector('[data-action="kopia-pobierz"]').click();
      await new Promise(r=>setTimeout(r, 1200));
      ['players','clubs','observations','reports','talents','contacts','matches','agencies','agents'].forEach(k=>{
        if(Array.isArray(dane[k])) DB[k] = dane[k];
      });
      if(dane.agencyLogos) DB.agencyLogos = dane.agencyLogos;
      if(dane.clubCrests) DB.clubCrests = dane.clubCrests;
      if(dane.settings) DB.settings = dane.settings;
      const wyniki = await Promise.all([savePlayers(), saveClubs(), saveObservations()]);
      alert(wyniki.every(Boolean)
        ? `Wczytano kopię: ${ile}.`
        : 'Część danych nie zapisała się do bazy — sprawdź baner u góry strony. Twoja kopia bezpieczeństwa została pobrana przed podmianą.');
      render();
    }catch(e){
      alert('Nie udało się wczytać kopii: ' + (e.message||e));
    }finally{ plikKopii.value=''; }
  };

  main.querySelectorAll('[data-action="reset-all"]').forEach(b=>b.onclick=async()=>{
    if(confirm('Na pewno usunąć WSZYSTKIE dane (zawodnicy, kluby, obserwacje)? Tej operacji nie można cofnąć.')){
      DB.players=[]; DB.clubs=[]; DB.observations=[];
      await savePlayers(); await saveClubs(); await saveObservations();
      render();
    }
  });
}

// Re-attach modal handlers whenever a modal is appended (since attachHandlers runs at render time only)
const origOpenPlayerModal = openPlayerModal;
openPlayerModal = function(id, presetClubId, prefillData){ origOpenPlayerModal(id, presetClubId, prefillData); wireLastModal(); };
const origOpenClubModal = openClubModal;
openClubModal = function(id){ origOpenClubModal(id); wireLastModal(); };
// Okna agencji i menedżera muszą przejść tę samą drogę. Bez tego ich „Zapisz" nie miał w ogóle
// podpiętej obsługi: kliknięcie nic nie robiło, okno zostawało otwarte i wyglądało na zawieszone.
const origOpenAgencyModal = openAgencyModal;
openAgencyModal = function(id){ origOpenAgencyModal(id); wireLastModal(); };
const origOpenAgentModal = openAgentModal;
openAgentModal = function(agentId, agencyId){ origOpenAgentModal(agentId, agencyId); wireLastModal(); };
function openPlayerTabsModal(playerId){
  const already = document.querySelector('.modal-overlay[data-tabs-for]');
  if(already) already.remove();
  const p = DB.players.find(x=>x.id===playerId);
  if(!p) return;
  if(!p.customFields) p.customFields = {};

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.dataset.tabsFor = playerId;

  function closeAndRefresh(){ overlay.remove(); render(); }

  function draw(){
    const entries = Object.entries(p.customFields);
    overlay.innerHTML = `
    <div class="modal">
      <h3>Zakładki — ${esc(p.firstName)} ${esc(p.lastName)}</h3>
      <div style="margin-bottom:16px;max-height:280px;overflow:auto;">
        ${entries.length ? entries.map(([key,val])=>`
          <div class="obs-item">
            <div class="toolbar" style="margin-bottom:2px;">
              <strong>${esc(key)}</strong>
              <button class="link-btn tab-delete-btn" data-key="${esc(key)}" style="color:var(--clay-dark);font-size:11px;">usuń</button>
            </div>
            <div style="font-size:13px;white-space:pre-wrap;">${esc(val)}</div>
          </div>
        `).join('') : '<div class="empty">Brak dodatkowych zakładek — dodaj pierwszą poniżej.</div>'}
      </div>
      <div class="field-wrap"><label class="field">Nazwa nowej zakładki</label><input id="tab-new-name" placeholder="np. Historia transferów"></div>
      <div class="field-wrap"><label class="field">Treść</label><textarea id="tab-new-content" rows="3"></textarea></div>
      <div class="modal-actions">
        <button class="secondary" data-action="close-modal">Zamknij</button>
        <button class="gold tab-add-btn">+ Dodaj zakładkę</button>
      </div>
    </div>`;
    wire();
  }

  function wire(){
    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=closeAndRefresh);
    const addBtn = overlay.querySelector('.tab-add-btn');
    if(addBtn) addBtn.onclick = async ()=>{
      const nameInp = overlay.querySelector('#tab-new-name');
      const contentInp = overlay.querySelector('#tab-new-content');
      const name = nameInp.value.trim();
      const content = contentInp.value.trim();
      if(!name){ nameInp.focus(); return; }
      if(!content){ contentInp.focus(); return; }
      p.customFields[name] = content;
      await savePlayers();
      draw();
    };
    overlay.querySelectorAll('.tab-delete-btn').forEach(b=>b.onclick=async()=>{
      delete p.customFields[b.dataset.key];
      await savePlayers();
      draw();
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeAndRefresh(); });
  document.body.appendChild(overlay);
  draw();
}

function openCommitteeReportsModal(playerId){
  const already = document.querySelector('.modal-overlay[data-committee-for]');
  if(already) already.remove();
  const p = DB.players.find(x=>x.id===playerId);
  if(!p) return;
  if(!p.committeeReports) p.committeeReports = [];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.dataset.committeeFor = playerId;

  function closeAndRefresh(){ overlay.remove(); render(); }
  function fmtSize(bytes){
    if(bytes < 1024) return bytes + ' B';
    if(bytes < 1024*1024) return Math.round(bytes/1024) + ' KB';
    return (bytes/1024/1024).toFixed(1) + ' MB';
  }

  function draw(){
    overlay.innerHTML = `
    <div class="modal">
      <h3>Komitet Transferowy — ${esc(p.firstName)} ${esc(p.lastName)}</h3>
      <label class="field" style="display:block;margin-bottom:6px;">Raporty PDF (dowolna liczba)</label>
      <div style="margin-bottom:16px;max-height:220px;overflow:auto;">
        ${p.committeeReports.length ? p.committeeReports.map((a,i)=>`
          <div class="obs-item">
            <div class="toolbar" style="margin-bottom:2px;">
              <a href="${a.dataUrl}" download="${esc(a.name)}" style="font-weight:700;color:var(--heading);text-decoration:none;">📄 ${esc(a.name)}</a>
              <button class="link-btn committee-report-delete-btn" data-idx="${i}" style="color:var(--clay-dark);font-size:11px;">usuń</button>
            </div>
            <div class="meta">${fmtSize(a.size)} &middot; dodano ${esc(a.uploadedAt)}</div>
          </div>
        `).join('') : '<div class="empty">Brak raportów — dodaj pierwszy poniżej.</div>'}
      </div>
      <div class="field-wrap">
        <label class="field">Dodaj raport (PDF)</label>
        <input type="file" id="committee-report-file" accept="application/pdf,.pdf">
        <div id="committee-report-status" class="note" style="margin-top:4px;"></div>
      </div>
      <div style="border-top:1px solid var(--border);margin:14px 0;padding-top:10px;">
        <label class="field" style="display:block;margin-bottom:6px;">Opinia porównawcza komitetu</label>
        <p class="note" style="margin-top:-2px;">Wgraj powyższe raporty także na czacie z Claude — poproś o porównawczą ocenę na podstawie tych raportów jako scout, menadżer i trener, a wynik wklej tutaj.</p>
        <textarea id="committee-opinion-text" rows="5" placeholder="Wklej tutaj opinię porównawczą...">${esc(p.committeeOpinion||'')}</textarea>
      </div>
      <div class="modal-actions">
        <button class="secondary" data-action="close-modal">Zamknij</button>
        <button class="gold" data-action="save-committee-opinion">Zapisz opinię</button>
      </div>
    </div>`;
    wire();
  }

  function wire(){
    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=closeAndRefresh);
    const fileInput = overlay.querySelector('#committee-report-file');
    const status = overlay.querySelector('#committee-report-status');
    if(fileInput) fileInput.onchange = async ()=>{
      const file = fileInput.files[0];
      if(!file) return;
      status.textContent = 'Wczytywanie...';
      status.style.color = 'var(--ink-soft)';
      try{
        const att = await processAttachmentFile(file);
        p.committeeReports.push(att);
        await savePlayers();
        draw();
      }catch(e){
        status.textContent = e.message || 'Nie udało się wczytać pliku.';
        status.style.color = 'var(--clay-dark)';
      }
    };
    overlay.querySelectorAll('.committee-report-delete-btn').forEach(b=>b.onclick=async()=>{
      p.committeeReports.splice(Number(b.dataset.idx), 1);
      await savePlayers();
      draw();
    });
    overlay.querySelectorAll('[data-action="save-committee-opinion"]').forEach(b=>b.onclick=async()=>{
      p.committeeOpinion = overlay.querySelector('#committee-opinion-text').value.trim();
      await savePlayers();
      closeAndRefresh();
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeAndRefresh(); });
  document.body.appendChild(overlay);
  draw();
}

// ---------- IMPORT SKŁADU (Ty kopiujesz z Transfermarkt/90minut/ŁNP, my rozpoznajemy i wstawiamy) ----------
// Nie pobieramy tych danych sami (scraping) — użytkownik ogląda stronę we własnej przeglądarce, zaznacza
// i kopiuje widoczny skład, wkleja tutaj. Rozpoznajemy imię/nazwisko/pozycję/rocznik z wklejonego tekstu.
const SQUAD_POSITION_MAP = [
  [/bramkarz/i, 'Bramkarz'],
  [/(środkowy obrońca|centralny obrońca)/i, 'Obrońca środkowy'],
  [/(lewy obrońca|prawy obrońca|boczny obrońca)/i, 'Obrońca boczny'],
  [/defensywny pomocnik/i, 'Pomocnik defensywny'],
  [/ofensywny pomocnik/i, 'Pomocnik ofensywny'],
  [/środkowy pomocnik/i, 'Pomocnik środkowy'],
  [/(lewy pomocnik|prawy pomocnik|lewy wahadłowy|prawy wahadłowy|lewe skrzydło|prawe skrzydło|skrzydłowy)/i, 'Skrzydłowy'],
  [/(lewy napastnik|prawy napastnik|środkowy napastnik|napastnik)/i, 'Napastnik'],
  [/obrońca/i, 'Obrońca środkowy'],
  [/pomocnik/i, 'Pomocnik środkowy'],
];
// Flaga narodowości — emoji Unicode (nie obrazy), więc bez żadnych kwestii praw autorskich: flagi
// państwowe to symbole urzędowe, nie znaki towarowe/utwory. Klucze po polsku (jak w źródłach typu
// Transfermarkt/90minut), wartość to flaga renderowana natywnie przez przeglądarkę.
const COUNTRY_FLAGS = {
  'polska':'🇵🇱','niemcy':'🇩🇪','portugalia':'🇵🇹','hiszpania':'🇪🇸','francja':'🇫🇷','włochy':'🇮🇹',
  'anglia':'🏴','wielka brytania':'🇬🇧','szkocja':'🏴','walia':'🏴','irlandia':'🇮🇪',
  'holandia':'🇳🇱','belgia':'🇧🇪','austria':'🇦🇹','szwajcaria':'🇨🇭','dania':'🇩🇰','szwecja':'🇸🇪',
  'norwegia':'🇳🇴','finlandia':'🇫🇮','islandia':'🇮🇸','ukraina':'🇺🇦','białoruś':'🇧🇾','rosja':'🇷🇺',
  'czechy':'🇨🇿','słowacja':'🇸🇰','węgry':'🇭🇺','rumunia':'🇷🇴','bułgaria':'🇧🇬','serbia':'🇷🇸',
  'chorwacja':'🇭🇷','słowenia':'🇸🇮','bośnia i hercegowina':'🇧🇦','czarnogóra':'🇲🇪','macedonia północna':'🇲🇰',
  'albania':'🇦🇱','kosowo':'🇽🇰','grecja':'🇬🇷','turcja':'🇹🇷','cypr':'🇨🇾','gruzja':'🇬🇪','armenia':'🇦🇲',
  'litwa':'🇱🇹','łotwa':'🇱🇻','estonia':'🇪🇪','mołdawia':'🇲🇩',
  'brazylia':'🇧🇷','argentyna':'🇦🇷','urugwaj':'🇺🇾','kolumbia':'🇨🇴','chile':'🇨🇱','peru':'🇵🇪',
  'meksyk':'🇲🇽','usa':'🇺🇸','stany zjednoczone':'🇺🇸','kanada':'🇨🇦','paragwaj':'🇵🇾','wenezuela':'🇻🇪','ekwador':'🇪🇨',
  'nigeria':'🇳🇬','ghana':'🇬🇭','senegal':'🇸🇳','kamerun':'🇨🇲','wybrzeże kości słoniowej':'🇨🇮','mali':'🇲🇱',
  'algieria':'🇩🇿','maroko':'🇲🇦','tunezja':'🇹🇳','egipt':'🇪🇬','rpa':'🇿🇦','demokratyczna republika konga':'🇨🇩',
  'iran':'🇮🇷','irak':'🇮🇶','izrael':'🇮🇱','arabia saudyjska':'🇸🇦','japonia':'🇯🇵','korea południowa':'🇰🇷',
  'chiny':'🇨🇳','australia':'🇦🇺','nowa zelandia':'🇳🇿',
  'gwinea':'🇬🇳','gwinea bissau':'🇬🇼','komory':'🇰🇲','burkina faso':'🇧🇫','kongo':'🇨🇬','azerbejdżan':'🇦🇿',
};
function nationalityFlag(nat){
  if(!nat) return '';
  return COUNTRY_FLAGS[nat.trim().toLowerCase()] || '';
}
// Literówki/warianty pisowni napotykane w realnych wklejeniach (np. "Stany Zjednaczone" zamiast
// "Zjednoczone") — mapowane na klucz kanoniczny z COUNTRY_FLAGS, żeby flaga i nazwa zawsze się zgadzały.
const NATIONALITY_ALIASES = { 'stany zjednaczone': 'stany zjednoczone' };
function titleCasePl(s){ return s.split(' ').map(w=>w? w.charAt(0).toUpperCase()+w.slice(1) : w).join(' '); }
// Szuka NAJWCZEŚNIEJSZEGO (wg pozycji w tekście, nie kolejności w słowniku) rozpoznanego kraju —
// istotne przy podwójnym obywatelstwie ("Dominikana\nHiszpania"), gdzie liczy się kolejność źródłowa.
function detectNationality(text){
  const low = text.toLowerCase();
  const keys = [...Object.keys(COUNTRY_FLAGS), ...Object.keys(NATIONALITY_ALIASES)];
  let best = null;
  for(const key of keys){
    const idx = low.indexOf(key);
    if(idx>=0 && (best===null || idx<best.idx)) best = {idx, key};
  }
  if(!best) return '';
  const canonical = NATIONALITY_ALIASES[best.key] || best.key;
  return titleCasePl(canonical);
}
function mapSquadPosition(raw){
  for(const [re, mapped] of SQUAD_POSITION_MAP) if(re.test(raw)) return mapped;
  return null;
}
// Wyciąga imię/nazwisko/pozycję/rocznik z jednej wklejonej linii (np. skopiowanego wiersza tabeli
// składu). Format bywa różny, więc rozpoznajemy po punktach orientacyjnych: numer na początku,
// nazwa pozycji gdzieś w środku, 4-cyfrowy rok (data urodzenia) gdzieś dalej — imię/nazwisko to
// tekst PRZED rozpoznaną pozycją, po odcięciu wiodącego numeru.
// Zakres roczników: od 1970 (weterani w niższych ligach) po 2020 (drużyny młodzieżowe i rocznikowe).
// Wcześniejsze ograniczenie do 2015 ucinało najmłodszych, a rocznik zostawał pusty bez żadnego sygnału.
const BIRTH_YEAR_RE = /\b(19[7-9]\d|20[01]\d|2020)\b/;

// Część widoków Transfermarktu podaje sam WIEK, bez daty urodzenia ("Zawodnik / Wiek / Narodowość").
// Gdy roku nie ma, wyliczamy go z wieku. To wartość przybliżona — zależnie od tego, czy zawodnik
// miał już w tym roku urodziny, rocznik może wypaść o rok wcześniej; oznaczamy to (birthYearFromAge),
// żeby import mógł o tym uprzedzić zamiast podawać wyliczenie jako pewnik.
function birthYearFromAgeText(text){
  if(!text) return null;
  // Bierzemy pierwszą liczbę w zakresie wieku piłkarza; numery na koszulkach bywają wyższe lub niższe,
  // ale przy braku daty to jedyna dostępna wskazówka.
  const m = String(text).match(/\b(1[5-9]|[2-3]\d|4[0-5])\b/);
  if(!m) return null;
  return String(new Date().getFullYear() - parseInt(m[1], 10));
}

function parseSquadLine(line){
  let text = line.trim();
  if(!text) return null;
  text = text.replace(/^[-–]\s*/, '').replace(/^\d{1,2}\s+/, ''); // numer koszulki lub "-" na początku
  const posMatch = SQUAD_POSITION_MAP.map(([re])=>{ const m = text.match(re); return m ? {index:m.index, re} : null; })
    .filter(Boolean).sort((a,b)=>a.index-b.index)[0];
  if(!posMatch) return { ok:false, raw: line.trim() };
  const namePart = text.slice(0, posMatch.index).trim();
  const positionRaw = text.slice(posMatch.index).match(posMatch.re)[0];
  const position = mapSquadPosition(positionRaw);
  const nameWords = namePart.split(/\s+/).filter(Boolean);
  if(nameWords.length < 2) return { ok:false, raw: line.trim() };
  const firstName = nameWords[0];
  const lastName = nameWords.slice(1).join(' ');
  // Rok urodzenia szukamy w CAŁEJ linii, nie tylko po nazwie pozycji — w części wklejeń data stoi
  // przed pozycją i wtedy przepadała.
  const rest = text.slice(posMatch.index + positionRaw.length) + ' ' + namePart;
  const yearMatch = rest.match(BIRTH_YEAR_RE);
  const zWieku = yearMatch ? null : birthYearFromAgeText(text.slice(posMatch.index + positionRaw.length));
  const birthYear = yearMatch ? yearMatch[0] : (zWieku || '');
  const nationality = detectNationality(rest);
  return { ok:true, firstName, lastName, position, birthYear,
    birthYearFromAge: !yearMatch && !!zWieku, nationality, raw: line.trim() };
}
// Wykrywa, czy pozycja to nazwa pozycji (krótka linia pasująca do słownika) — punkt orientacyjny do
// wykrywania bloków w formacie wieloliniowym (patrz parseSquadBlocks).
function isSquadPositionLine(line){
  const t = line.trim();
  return t.length>0 && t.length<40 && SQUAD_POSITION_MAP.some(([re])=>re.test(t));
}
// Prawdziwy format wklejenia z Transfermarkt to zwykle NIE "jeden zawodnik = jedna linia", tylko blok
// kilku linii na zawodnika (nazwa, potem pozycja w osobnej linii, potem data/narodowość/wartość — a przy
// podwójnym obywatelstwie narodowość sama zajmuje dodatkową linię, więc liczba linii na blok jest
// zmienna). Wykrywamy start każdego bloku po sąsiadującej parze linii: "coś, co nie jest pozycją" tuż
// przed linią, która JEST pozycją — to zawsze odpowiada parze (nazwisko, pozycja).
function parseSquadBlocks(rawText){
  const lines = rawText.split('\n');
  const starts = [];
  for(let i=0;i<lines.length-1;i++){
    const cur = lines[i].trim(), next = lines[i+1].trim();
    if(cur && !isSquadPositionLine(cur) && isSquadPositionLine(next)) starts.push(i);
  }
  if(!starts.length) return null; // brak wykrytych bloków — wywołujący spróbuje trybu "linia = zawodnik"
  return starts.map((s,i)=>{
    const block = lines.slice(s, i+1<starts.length ? starts[i+1] : lines.length);
    const nameText = block[0].trim().split('\t')[0].trim(); // nazwa bywa zdublowana tabulatorem
    const words = nameText.split(/\s+/).filter(Boolean);
    if(!words.length) return { ok:false, raw: block.join(' | ').slice(0,140) };
    const position = mapSquadPosition(block[1].trim());
    // Rocznika szukamy w CAŁYM bloku poza linią nazwiska, a nie dopiero od trzeciej linii —
    // w niektórych układach data stoi tuż przy pozycji i wcześniej wypadała poza zakresem.
    const rest = block.slice(1).join(' ');
    const yearMatch = rest.match(BIRTH_YEAR_RE);
    // Bez daty urodzenia próbujemy wyliczyć rocznik z wieku (widok „Zawodnik / Wiek / Narodowość").
    const zWieku = yearMatch ? null : birthYearFromAgeText(rest.replace(block[1]||'', ''));
    return {
      ok:true, firstName: words[0], lastName: words.length>1 ? words.slice(1).join(' ') : '',
      position, birthYear: yearMatch ? yearMatch[0] : (zWieku || ''),
      birthYearFromAge: !yearMatch && !!zWieku,
      nationality: detectNationality(rest),
      raw: block.join(' | ').slice(0,140)
    };
  });
}
// Trzeci układ: KRATKA KOSZULEK. Tak wygląda skład na Łączy nas piłką i na stronach klubowych —
// rysunek koszulki z numerem, a pod nim nazwisko. Po skopiowaniu zostaje z tego naprzemiennie
// numer w osobnej linii i nazwisko w następnej, BEZ nazwy pozycji.
//
// Pozostałe dwa parsery wymagają pozycji: blokowy szuka jej jako punktu orientacyjnego, liniowy
// bez niej odrzuca wiersz. Dlatego ten układ nie rozpoznawał niczego, choć to jedyne miejsce
// z PEŁNĄ listą zgłoszonych — 90minut podaje wyłącznie tych, którzy weszli na boisko.
const WYGLADA_NA_NAZWISKO = /^[\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){1,3}$/u;

// Kopiowanie takiej kratki daje w praktyce jeden z czterech układów — zależnie od tego, czy
// przeglądarka wstawi łamanie wiersza między numerem a nazwiskiem i po której stronie stoi numer.
// Zamiast zgadywać, który to, obsługujemy wszystkie i bierzemy ten, który znalazł najwięcej.
const zawodnikZKratki = (numer, nazwa, zrodlo)=>{
  const slowa = nazwa.split(/\s+/);
  return {
    ok:true, firstName: slowa[0], lastName: slowa.slice(1).join(' '),
    position: '', birthYear: '', nationality: '',
    numer: numer!=null ? parseInt(numer,10) : null,
    raw: zrodlo,
  };
};
const dobreNazwisko = (s)=> !!s && !isSquadPositionLine(s) && WYGLADA_NA_NAZWISKO.test(s);

function parseSquadKratka(rawText){
  const linie = rawText.split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);
  const warianty = [];

  // 1. numer i nazwisko w JEDNEJ linii: „40 Bartosz Kowalczyk" (także rozdzielone tabulatorem,
  //    bo tabulatory sprowadziliśmy wyżej do spacji).
  warianty.push(linie.map(l=>{
    const m = l.match(/^(\d{1,2})\s+(.+)$/);
    return (m && dobreNazwisko(m[2])) ? zawodnikZKratki(m[1], m[2], l) : null;
  }).filter(Boolean));

  // 2. numer w swojej linii, nazwisko w NASTĘPNEJ.
  const poNumerze = [];
  for(let i=0;i<linie.length-1;i++){
    if(/^\d{1,2}$/.test(linie[i]) && dobreNazwisko(linie[i+1])){
      poNumerze.push(zawodnikZKratki(linie[i], linie[i+1], `${linie[i]} ${linie[i+1]}`));
      i++;
    }
  }
  warianty.push(poNumerze);

  // 3. nazwisko w swojej linii, numer w NASTĘPNEJ (część układów podpisuje koszulkę od dołu).
  const przedNumerem = [];
  for(let i=0;i<linie.length-1;i++){
    if(dobreNazwisko(linie[i]) && /^\d{1,2}$/.test(linie[i+1])){
      przedNumerem.push(zawodnikZKratki(linie[i+1], linie[i], `${linie[i+1]} ${linie[i]}`));
      i++;
    }
  }
  warianty.push(przedNumerem);

  // 4. same nazwiska, bez numerów — gdy przeglądarka pominie tekst na obrazku koszulki.
  //    Wymagamy, żeby stały OBOK SIEBIE, inaczej złapalibyśmy pozycje z menu i stopki.
  const ciagi = [];
  let biezacy = [];
  for(const l of linie){
    if(dobreNazwisko(l)) biezacy.push(l);
    else { if(biezacy.length > ciagi.length) ciagi.length = 0, ciagi.push(...biezacy); biezacy = []; }
  }
  if(biezacy.length > ciagi.length){ ciagi.length = 0; ciagi.push(...biezacy); }
  warianty.push(ciagi.map(n=>zawodnikZKratki(null, n, n)));

  // Próg ośmiu zawodników. Prawdziwa lista zgłoszonych ma ich kilkanaście do trzydziestu, a wyżej
  // podniesiony próg chroni przed trafieniem w tabelę strzelców albo w blok nawigacji.
  const najlepszy = warianty.sort((a,b)=>b.length-a.length)[0];
  return (najlepszy && najlepszy.length >= 8) ? najlepszy : null;
}

// Skład skopiowany z Łączy nas piłką.
//
// ŁNP powtarza przy każdym zawodniku dwie linijki i między nimi wstawia nazwisko:
//     Numer zawodnika pochodzi z ostatniego meczu
//     Maciej Andrzejewski
//     Zobacz profil zawodnika ➔
// Nazwiska NIE stoją więc obok siebie i żaden z wcześniejszych układów ich nie widział —
// stąd „Rozpoznano 0 ze 146 linii" mimo poprawnie skopiowanej strony.
//
// Kotwiczymy się na tych stałych zdaniach, a nie na wyglądzie samej linii z nazwiskiem. To
// odróżnia zawodnika od nagłówków i stopki, w których też trafiają się dwa słowa z wielkiej litery
// („Nazwa drużyny", „Akademia Juniora"). Sprawdzamy obie strony, bo przy kopiowaniu bez formatowania
// znika czasem jedna z linii.
// Znacznik traktujemy jako SEPARATOR, a nie jako sąsiada nazwiska.
//
// Poprzednia wersja wymagała, żeby nazwisko stało dokładnie w następnej linijce po znaczniku —
// i nie zadziałała, choć znacznik w tekście był. Nie wiadomo z góry, co ŁNP wstawi pomiędzy:
// numer koszulki, pustą linię, obrazek. Dlatego po każdym znaczniku szukamy PIERWSZEJ linii,
// która wygląda na nazwisko, przeglądając kilka kolejnych i pomijając to, co nazwiskiem nie jest.
function parseSquadLnp(rawText){
  const linie = rawText.split('\n').map(l=>l.replace(/\s+/g,' ').trim());
  const smiec = (l)=> !l
    || /zobacz profil|numer zawodnika|wi[eę]cej o klubie|nazwa dru[żz]yny|rozgrywki|sezon|^\d+$/i.test(l)
    || /https?:\/\//i.test(l)
    || isSquadPositionLine(l);

  // Nazwisko w wykazie ŁNP bywa opakowane w odnośnik, więc zdejmujemy nawiasy Markdowna
  // i strzałkę, którą serwis dokleja do linków.
  const oczysc = (l)=> l.replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[➔→»]/g,'').replace(/^[\s*\-\d.]+/,'').trim();

  const znalezieni = [];
  const uzyte = new Set();
  linie.forEach((l,i)=>{
    if(!/numer zawodnika pochodzi/i.test(l)) return;
    // Zaglądamy maksymalnie cztery linijki w przód — dalej to już następny zawodnik.
    for(let j=i+1;j<Math.min(i+5,linie.length);j++){
      if(uzyte.has(j)) continue;
      const nazwa = oczysc(linie[j]);
      if(smiec(nazwa) || !WYGLADA_NA_NAZWISKO.test(nazwa)) continue;
      const slowa = nazwa.split(/\s+/);
      znalezieni.push({
        ok:true, firstName: slowa[0], lastName: slowa.slice(1).join(' '),
        position:'', birthYear:'', nationality:'', raw:nazwa,
      });
      uzyte.add(j);
      break;
    }
  });
  return znalezieni.length >= 3 ? znalezieni : null;
}

// Punkt wejścia używany przez importer. Kolejność od najbardziej charakterystycznego układu do
// najogólniejszego: blokowy z Transfermarktu, wykaz z ŁNP, kratka koszulek, a na końcu
// "jedna linia = zawodnik".
// PROTOKÓŁ MECZOWY z Łączy nas piłką.
//
// Zawiera obie drużyny, więc bierzemy tylko tę, do której importujemy — inaczej połowa
// zawodników trafiłaby do niewłaściwego klubu.
//
// Układ jest stały: nazwa drużyny, „Skład wyjściowy", nagłówek „Zawodnik", a potem naprzemiennie
// numer koszulki i nazwisko. Po nazwisku bywają minuty zdarzeń (65', 90' +3').
//
// PRZYROSTKI PRZY NAZWISKU są tu najcenniejsze:
//   (M) — MŁODZIEŻOWIEC. Protokół związkowy mówi to wprost, więc w IV lidze, gdzie rocznika
//         nie ma skąd wziąć, to jedyne pewne źródło tej informacji.
//   (B) — bramkarz,  (C) — kapitan.
//
// Czego stąd NIE bierzemy: minut gry, bramek i kartek. Rodzaj zdarzenia jest na stronie IKONĄ,
// a po skopiowaniu zostaje sama liczba — nie da się odróżnić gola od kartki ani od zejścia
// z boiska. Poprzednia wersja tego importu zgadywała i wpisywała rezerwowym odwrotność ich
// dorobku; lepiej nie podać nic niż podać liczbę, która wygląda wiarygodnie i jest nieprawdziwa.
function parseLnpProtokol(rawText, nazwaKlubu){
  const linie = rawText.split('\n').map(l=>l.replace(/\s+/g,' ').trim());
  const start = linie.findIndex(l=>/^Składy$/i.test(l));
  if(start < 0 || !nazwaKlubu) return null;

  const bezOzdob = (l)=> l.replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').trim();
  const szukany = importNorm(nazwaKlubu);

  // Granice sekcji naszej drużyny: od jej nazwy do „Sztab" (dalej idzie sztab i druga drużyna).
  let od = -1;
  for(let i=start;i<linie.length;i++){
    if(importNorm(bezOzdob(linie[i])) === szukany && /skład wyjściowy/i.test(linie[i+1]||'')){ od = i; break; }
  }
  if(od < 0) return null;
  let doIdx = linie.findIndex((l,i)=> i>od && /^Sztab$/i.test(l));
  if(doIdx < 0) doIdx = linie.length;

  const znalezieni = [];
  let rezerwa = false;
  for(let i=od+1;i<doIdx;i++){
    const l = linie[i];
    if(/skład rezerwowy/i.test(l)){ rezerwa = true; continue; }
    if(!/^\d{1,2}$/.test(l)) continue;                       // szukamy numeru koszulki
    const numer = parseInt(l,10);
    // Nazwisko to pierwsza kolejna linia, która nie jest minutą zdarzenia ani pusta.
    let nazwa = '';
    for(let j=i+1;j<Math.min(i+4,doIdx);j++){
      const kandydat = bezOzdob(linie[j]);
      if(!kandydat || /^\d{1,3}'(\s*\+\s*\d+')?$/.test(kandydat)) continue;
      nazwa = kandydat; i = j; break;
    }
    if(!nazwa) continue;
    const mlodziezowiec = /\(M\)/.test(nazwa);
    const bramkarz = /\(B\)/.test(nazwa);
    const czyste = nazwa.replace(/\((?:M|B|C)\)/g,'').replace(/\s+/g,' ').trim();
    if(!WYGLADA_NA_NAZWISKO.test(czyste)) continue;
    const slowa = czyste.split(/\s+/);
    znalezieni.push({
      ok:true, firstName: slowa[0], lastName: slowa.slice(1).join(' '),
      position: bramkarz ? 'Bramkarz' : '', birthYear:'', nationality:'',
      mlodziezowiec, numer, rezerwa,
      raw: `${numer} ${czyste}${mlodziezowiec?' [młodzieżowiec]':''}`,
    });
  }
  return znalezieni.length >= 5 ? znalezieni : null;
}

function parseSquadText(rawText, nazwaKlubu){
  // Protokół meczowy poznajemy po sekcji „Składy" — sprawdzamy go pierwszego, bo zawiera
  // najwięcej informacji (numery, podział na jedenastkę i ławkę, oznaczenie młodzieżowca).
  if(/^\s*Składy\s*$/m.test(rawText)){
    const prot = parseLnpProtokol(rawText, nazwaKlubu);
    if(prot) return prot;
  }
  // Wykaz z ŁNP rozpoznajemy PO ZNACZNIKU, zanim spróbujemy czegokolwiek innego. Parser blokowy
  // potrafi zaczepić się o słowo „Trener" w stopce PZPN i zwrócić garść śmieci, a wtedy właściwy
  // czytnik nigdy by nie dostał szansy — kolejność prób ma tu znaczenie.
  if(/numer zawodnika pochodzi/i.test(rawText)){
    const lnp = parseSquadLnp(rawText);
    if(lnp) return lnp;
  }
  return parseSquadBlocks(rawText)
    || parseSquadLnp(rawText)
    || parseSquadKratka(rawText)
    || rawText.split('\n').map(parseSquadLine).filter(Boolean);
}
// Import składu z pliku Excel/CSV — np. listy rocznikowe do rozgrywek juniorskich (Rocznik 2011-2014),
// gdzie nie ma strony na Transfermarkt do skopiowania. Kolumny: Imię, Nazwisko (albo jedna kolumna
// "Zawodnik"/"Imię i nazwisko"), opcjonalnie Rocznik, Pozycja, Narodowość — kolejność dowolna.
// Arkusze z ZPN mają nad tabelą blok tytułowy (logo, „Poziom rozgrywkowy", „Wojewódzka liga"),
// więc pierwszy wiersz arkusza NIE jest nagłówkiem. Szukamy wiersza, w którym są jednocześnie
// „Nazwisko" i „Imię", i dopiero od niego czytamy dane.
// "DO TRANSFERU" w arkuszu a "Do transferu" w systemie to ten sam status — dopasowujemy luźno,
// żeby import nie tworzył nowych, nieznanych wartości.
function matchKnownStatus(raw){
  const v = String(raw||'').trim();
  if(!v) return '';
  const norm = (s)=> String(s||'').toLowerCase()
    .replace(/[łøđ]/g, c=>({'ł':'l','ø':'o','đ':'d'}[c]))
    .normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z]/g,'');
  const key = norm(v);
  return (DB.settings.statuses||[]).find(s=> norm(s) === key) || '';
}

// NORMALIZACJA DO WYSZUKIWANIA.
//
// Znaki diakrytyczne zdejmuje NFD — ale „ł", „ø" i „đ" wcale się nie rozkładają i zostają w tekście.
// Bez ich ręcznego zmapowania wpisanie „holuj" nie znajdowało „Hołuj", a „glowinski" nie znajdowało
// „Głowińskiego": zawodnik po prostu nie pojawiał się na liście, choć jest w bazie. Spacje
// zostawiamy, żeby dało się szukać dwoma słowami („kowalski legia").
const szukajNorm = (s)=> String(s||'').toLowerCase()
  .replace(/[łøđ]/g, c=>({'ł':'l','ø':'o','đ':'d'}[c]))
  .normalize('NFD').replace(/\p{M}/gu,'');

// Odległość edycyjna (Levenshtein) — ile liter trzeba zmienić, żeby jedno słowo stało się drugim.
// Służy do podpowiedzi przy literówce w nazwisku: „Jedliński" wpisane zamiast „Jeleński" to
// odległość 2, więc zawodnik nadal daje się znaleźć.
function odlegloscEdycyjna(a, b){
  if(a === b) return 0;
  if(!a.length) return b.length;
  if(!b.length) return a.length;
  let poprzedni = Array.from({length: b.length + 1}, (_, i)=>i);
  for(let i = 1; i <= a.length; i++){
    const biezacy = [i];
    for(let j = 1; j <= b.length; j++){
      biezacy[j] = Math.min(
        poprzedni[j] + 1,                                   // usunięcie
        biezacy[j-1] + 1,                                   // wstawienie
        poprzedni[j-1] + (a[i-1] === b[j-1] ? 0 : 1),       // zamiana
      );
    }
    poprzedni = biezacy;
  }
  return poprzedni[b.length];
}

const importNorm = (s)=> String(s||'').toLowerCase()
  .replace(/[łøđ]/g, c=>({'ł':'l','ø':'o','đ':'d'}[c]))
  .normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]/g,'');

// Czy ten wiersz wygląda na nagłówek tabeli zawodników?
function looksLikeHeaderRow(cells){
  const c = (cells||[]).map(importNorm);
  return (c.includes('nazwisko') && c.some(x=>x==='imie'))
      || c.some(x=>x==='zawodnik')
      || c.some(x=>x==='imienazwisko');
}

// Zamiana siatki (tablica tablic) na obiekty, z pominięciem bloku tytułowego nad nagłówkiem.
function gridToRows(grid){
  let headerIdx = grid.findIndex(looksLikeHeaderRow);
  if(headerIdx < 0) headerIdx = 0;           // brak wyraźnego nagłówka — czytaj od pierwszego wiersza
  const header = (grid[headerIdx]||[]).map(h=>String(h||'').trim());
  return grid.slice(headerIdx+1)
    .filter(r => (r||[]).some(c => String(c||'').trim() !== ''))
    .map(r => {
      const obj = {};
      header.forEach((h,i)=>{ if(h) obj[h] = r[i]!==undefined ? r[i] : ''; });
      return obj;
    });
}

function sheetToRows(sheet){
  return gridToRows(XLSX.utils.sheet_to_json(sheet, {header:1, defval:''}));
}

// Skoroszyt potrafi mieć arkusz tytułowy albo instrukcję przed właściwą tabelą, więc zamiast brać
// na sztywno pierwszy — szukamy pierwszego arkusza, w którym w ogóle jest nagłówek z nazwiskiem.
function workbookToRows(wb){
  for(const name of wb.SheetNames){
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], {header:1, defval:''});
    if(grid.some(looksLikeHeaderRow)) return gridToRows(grid);
  }
  return sheetToRows(wb.Sheets[wb.SheetNames[0]]);
}

// Wklejenie prosto z Excela: kolumny rozdziela TABULATOR. Obsługujemy też średnik i podwójne
// spacje, bo tak wychodzi przy kopiowaniu z niektórych widoków i z PDF-ów.
function pastedTableToRows(text){
  const grid = text.split('\n')
    .filter(l => l.trim() !== '')
    .map(l => l.includes('\t') ? l.split('\t') : l.split(/\s{2,}|;/))
    .map(cells => cells.map(c => c.trim()));
  return gridToRows(grid);
}

// Odczyt odpowiedzi TAK/NIE z komórki arkusza. Zwraca null, gdy komórka jest pusta albo zawiera
// coś, czego nie umiem jednoznacznie odczytać — wtedy niczego nie zakładamy i nie nadpisujemy
// tego, co jest już w bazie. Lepiej zostawić pole puste, niż wpisać „Nie" na podstawie zgadywania.
function parseTakNie(wartosc){
  if(wartosc === true) return true;
  if(wartosc === false) return false;
  const s = String(wartosc ?? '').trim().toLowerCase()
    .replace(/[łøđ]/g, c=>({'ł':'l','ø':'o','đ':'d'}[c]))
    .normalize('NFD').replace(/\p{M}/gu,'');
  if(!s) return null;
  if(['tak','t','yes','y','1','x','v','✓','prawda','true','jest','ma'].includes(s)) return true;
  if(['nie','n','no','0','-','–','—','brak','falsz','false','nie ma'].includes(s)) return false;
  return null;
}

// Menedżer w podglądzie importu. Rozróżniamy trzy stany, bo dla agencji „nie wiadomo" znaczy
// zupełnie co innego niż „nie ma menedżera" — pierwsze trzeba sprawdzić, drugie jest ustalone.
function agentPreviewHtml(p){
  if(p.hasAgent === true){
    return `<span class="agent-yes">Menedżer: Tak</span>` + (p.agencyName? ` <span class="note">${esc(p.agencyName)}</span>` : '');
  }
  if(p.hasAgent === false) return `<span class="agent-no">Menedżer: Nie</span>`;
  return `<span class="note">Menedżer: ?</span>`;
}

function parseSquadWorkbookRows(rows){
  if(!rows.length) throw new Error('Arkusz jest pusty (brak wierszy danych pod nagłówkiem).');
  const norm = (s)=> String(s||'').toLowerCase()
    .replace(/[łøđ]/g, c=>({'ł':'l','ø':'o','đ':'d'}[c]))
    .normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]/g,'');
  const headerMap = {};
  Object.keys(rows[0]).forEach(h=>{ headerMap[norm(h)] = h; });
  // Najpierw trafienie dokładne, potem „nagłówek zawiera szukane słowo" — inaczej „Aktualny klub"
  // czy „Pozycja boiskowa" z arkuszy ZPN nie zostałyby rozpoznane.
  const findCol = (...cands)=>{
    for(const c of cands){ if(headerMap[norm(c)]) return headerMap[norm(c)]; }
    for(const c of cands){
      const key = Object.keys(headerMap).find(h=> h.includes(norm(c)));
      if(key) return headerMap[key];
    }
    return null;
  };
  const colFirst = findCol('Imię','Imie','FirstName');
  const colLast  = findCol('Nazwisko','LastName');
  const colFull  = findCol('Imię i nazwisko','Zawodnik','Imie i nazwisko');
  const colYear  = findCol('Rocznik','Rok urodzenia','Rok','BirthYear');
  const colPos   = findCol('Pozycja','Position');
  const colNat   = findCol('Narodowość','Narodowosc','Nationality');
  const colClub  = findCol('Aktualny klub','Klub','Club','Drużyna','Druzyna','Zespół','Zespol','Team');
  const colStatus = findCol('Status');
  const colPowolania = findCol('Ilość powołań','Ilosc powolan','Powołania','Powolania');
  const colInfo  = findCol('Dodatkowe informacje','Uwagi','Notatka');
  // Menedżer — dla agencji to jedna z ważniejszych informacji, więc czytamy ją na dwa sposoby:
  // kolumnę TAK/NIE oraz kolumnę z nazwą agencji. Sama wpisana nazwa agencji też znaczy „ma
  // menedżera", nawet jeśli kolumny TAK/NIE w arkuszu w ogóle nie ma.
  const colAgent = findCol('Menedżer','Menadżer','Menedzer','Menadzer','Manager','Menager','Agent','Ma menedżera','Pełnomocnik');
  const colAgency = findCol('Agencja','Nazwa agencji','Agencja menedżerska','Agencja menadżerska');
  if(!colFirst && !colLast && !colFull) throw new Error('Nie znaleziono kolumny z imieniem/nazwiskiem — oczekiwane nagłówki: Imię, Nazwisko (albo Zawodnik).');
  return rows.map(row=>{
    let firstName = colFirst ? String(row[colFirst]||'').trim() : '';
    let lastName  = colLast ? String(row[colLast]||'').trim() : '';
    if(!firstName && !lastName && colFull){
      const parts = String(row[colFull]||'').trim().split(/\s+/).filter(Boolean);
      firstName = parts[0]||''; lastName = parts.slice(1).join(' ');
    }
    if(!firstName && !lastName) return null;
    const yearRaw = colYear ? String(row[colYear]||'').trim() : '';
    const posRaw  = colPos ? String(row[colPos]||'').trim() : '';
    return {
      ok: true, firstName, lastName,
      position: posRaw ? (mapSquadPosition(posRaw) || posRaw) : '',
      birthYear: /^\d{4}$/.test(yearRaw) ? yearRaw : '',
      nationality: colNat ? String(row[colNat]||'').trim() : '',
      club: colClub ? String(row[colClub]||'').trim() : '',
      // "DO TRANSFERU" / "DO OBSERWACJI" z arkusza sprowadzamy do statusów używanych w systemie.
      status: colStatus ? matchKnownStatus(String(row[colStatus]||'').trim()) : '',
      powolania: colPowolania ? (parseInt(String(row[colPowolania]||''),10) || null) : null,
      info: colInfo ? String(row[colInfo]||'').trim() : '',
      // null = arkusz nic o tym nie mówi (nie nadpisujemy tego, co już jest w bazie);
      // true/false = wpisana odpowiedź. Nazwa agencji sama w sobie oznacza „ma menedżera".
      hasAgent: (()=>{
        const zKolumny = colAgent ? parseTakNie(row[colAgent]) : null;
        if(zKolumny !== null) return zKolumny;
        const agencja = colAgency ? String(row[colAgency]||'').trim() : '';
        return agencja ? true : null;
      })(),
      agencyName: colAgency ? String(row[colAgency]||'').trim() : '',
      raw: [firstName, lastName, yearRaw].filter(Boolean).join(' ')
    };
  }).filter(Boolean);
}
// Opis wklejki widziany oczami parsera: numerowane linie z etykietą, czym każda z nich JEST.
// Powstało, bo układ schowka bywa inny, niż wygląda na stronie, a bez tego widoku diagnoza sprowadza
// się do zgadywania — a każde nietrafione zgadnięcie to kolejna funkcja, która „powinna działać".
function opiszWklejke(tekst){
  const linie = String(tekst||'').split('\n');
  const etykieta = (l)=>{
    const t = l.replace(/\s+/g,' ').trim();
    if(!t) return 'pusta';
    if(/^\d{1,2}$/.test(t)) return 'SAM NUMER';
    if(isSquadPositionLine(t)) return 'POZYCJA';
    if(WYGLADA_NA_NAZWISKO.test(t)) return 'NAZWISKO';
    if(/^\d{1,2}\s+/.test(t)) return 'NUMER + reszta';
    return 'inne';
  };
  const naglowek = `linii razem: ${linie.length}; pokazuję pierwsze 60\n`
    + `tabulatory oznaczam jako [TAB]\n${'-'.repeat(52)}\n`;
  return naglowek + linie.slice(0, 60).map((l,i)=>
    `${String(i+1).padStart(3)} | ${etykieta(l).padEnd(14)} | ${l.replace(/\t/g,'[TAB]').slice(0,60)}`
  ).join('\n');
}

function openSquadImportModal(clubId){
  const already = document.querySelector('.modal-overlay[data-squadimport-for]');
  if(already) already.remove();
  const club = DB.clubs.find(x=>x.id===clubId);
  if(!club) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.dataset.squadimportFor = clubId;
  let parsed = [];
  let pastedText = '';
  let diagnostyka = '';
  // Zrzut ekranu tylko jako WIZUALNY podgląd do porównania obok wklejonego tekstu — nie jest
  // analizowany automatycznie (brak OCR/AI w aplikacji), dane zawsze biorą się z wklejonego tekstu.
  let referenceImage = null;

  function closeAndRefresh(){ overlay.remove(); render(); }

  function draw(){
    overlay.innerHTML = `
    <div class="modal" style="max-width:680px;">
      <h3>Import składu — ${esc(club.name)}</h3>
      <p class="note" style="margin-top:-4px;">Otwórz źródło we własnej przeglądarce, zaznacz stronę (<strong>Ctrl+A</strong>), skopiuj i wklej poniżej.
      Nie pobieramy niczego automatycznie — to Ty decydujesz, co wkleić.</p>
      <div style="border-left:3px solid var(--gold-dark);padding:8px 12px;margin:0 0 12px;background:var(--card-soft);font-size:12px;">
        <strong>Można wkleić trzy rzeczy:</strong>
        <div style="margin-top:5px;line-height:1.7;">
          📋 <strong>Wykaz składu z ŁNP</strong> — pełna lista zgłoszonych, same nazwiska.<br>
          ⚽ <strong>Protokół meczowy z ŁNP</strong> — dodatkowo numery, podział na jedenastkę i ławkę
          oraz <strong>oznaczenie młodzieżowca</strong> „(M)". Protokół zawiera obie drużyny — wezmę z niego tylko ${esc(club.name)}.<br>
          📊 <strong>Tabela składu z Transfermarktu</strong> — z rocznikami i pozycjami.
        </div>
        <div class="note" style="margin-top:6px;font-size:11.5px;">Wklejenie protokołu po wgraniu listy składu <strong>uzupełni</strong>
        istniejących zawodników o to, czego wcześniej nie było — nic nie zostanie zdublowane ani nadpisane.</div>
      </div>
      <div class="grid grid-2" style="align-items:start;">
        <div class="field-wrap">
          <textarea id="squad-import-text" rows="8" placeholder="np.&#10;1 Rafał Grocholski Bramkarz 9 gru 2004 (21) Polska -&#10;3 Jonatan Straus Środkowy obrońca 30 cze 1994 (32) Polska -">${esc(pastedText)}</textarea>
        </div>
        <div class="field-wrap">
          <label class="field">Podgląd zrzutu ekranu (opcjonalnie, do porównania — nie jest odczytywany automatycznie)</label>
          ${referenceImage ? `
            <div style="position:relative;">
              <img src="${referenceImage}" style="max-width:100%;max-height:260px;object-fit:contain;border:1px solid var(--border);border-radius:6px;display:block;">
              <button class="secondary" data-action="squad-image-remove" style="position:absolute;top:6px;right:6px;padding:2px 8px;">✕</button>
            </div>
          ` : `
            <label for="squad-import-image" style="display:flex;align-items:center;justify-content:center;height:120px;border:1px dashed var(--border-strong);border-radius:6px;cursor:pointer;color:var(--ink-soft);font-size:13px;text-align:center;padding:8px;">📋 Wklej (Ctrl+V) lub kliknij, aby wgrać zrzut</label>
            <input type="file" id="squad-import-image" accept="image/*" style="display:none;">
          `}
        </div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start;margin-bottom:10px;">
        <button class="secondary" data-action="squad-parse">Rozpoznaj zawodników</button>
        <button class="secondary" data-action="squad-diag" title="Pokazuje wklejony tekst tak, jak widzi go parser — do wysłania, gdy rozpoznawanie zawodzi">🔍 Pokaż, co widzę</button>
      </div>
      ${diagnostyka ? `<div class="field-wrap" style="margin-bottom:12px;">
        <label class="field">Tak wygląda wklejka dla parsera — zaznacz to pole, skopiuj i wyślij, jeśli rozpoznawanie zawodzi</label>
        <textarea readonly rows="14" style="font-size:11px;font-family:monospace;white-space:pre;">${esc(diagnostyka)}</textarea>
      </div>` : ''}
      <div class="field-wrap" style="border-top:1px dashed var(--border-strong);padding-top:10px;margin-bottom:14px;">
        <label class="field">…albo wgraj plik Excel / CSV (np. lista rocznika do rozgrywek juniorskich) — kolumny: <strong>Imię, Nazwisko</strong> (albo „Zawodnik"), opcjonalnie Rocznik, Pozycja, Narodowość, <strong>Menedżer</strong> (Tak/Nie), Agencja</label>
        <input type="file" id="squad-import-file" accept=".xlsx,.xls,.csv">
      </div>
      ${parsed.length ? `
        <div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:12px;max-height:280px;overflow:auto;">
          <p class="note" style="margin-top:0;">Rozpoznano <strong>${parsed.filter(p=>p.ok).length}</strong> z ${parsed.length} linii. Odznacz, czego nie chcesz importować.</p>
          <table><tbody>
            ${parsed.map((p,i)=> p.ok ? `
              <tr>
                <td style="width:24px;"><input type="checkbox" class="squad-row-check" data-idx="${i}" checked></td>
                <td><strong>${esc(p.lastName)}</strong> ${esc(p.firstName)}</td>
                <td>${esc(p.position||'—')}</td>
                <td>${esc(p.birthYear||'—')}${isYouthPlayer(p)?youthBadge():''}</td>
                <td>${p.nationality? nationalityFlag(p.nationality)+' '+esc(p.nationality) : '—'}</td>
                <td style="white-space:nowrap;">${agentPreviewHtml(p)}</td>
              </tr>` : `
              <tr style="color:var(--clay-dark);">
                <td></td>
                <td colspan="5" style="font-size:12px;">Nie rozpoznano: „${esc(p.raw)}”</td>
              </tr>`
            ).join('')}
          </tbody></table>
        </div>
        <div class="modal-actions" style="justify-content:flex-start;">
          <button class="gold" data-action="squad-import-confirm">Importuj zaznaczonych zawodników</button>
        </div>
      ` : ''}
      <div class="modal-actions">
        <button class="secondary" data-action="close-modal">Zamknij</button>
      </div>
    </div>`;
    wire();
  }

  function loadReferenceImageFile(file){
    if(!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ()=>{ referenceImage = reader.result; draw(); };
    reader.readAsDataURL(file);
  }

  function wire(){
    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=closeAndRefresh);
    overlay.querySelectorAll('[data-action="squad-parse"]').forEach(b=>b.onclick=()=>{
      const text = overlay.querySelector('#squad-import-text').value;
      pastedText = text;
      // Nazwa klubu jest potrzebna przy protokole meczowym — zawiera obie drużyny i bez niej
      // nie wiadomo, którą z nich importujemy.
      parsed = parseSquadText(text, club.name);
      draw();
    });
    overlay.querySelectorAll('[data-action="squad-diag"]').forEach(b=>b.onclick=()=>{
      pastedText = overlay.querySelector('#squad-import-text').value;
      diagnostyka = opiszWklejke(pastedText);
      draw();
    });
    const squadFileInput = overlay.querySelector('#squad-import-file');
    if(squadFileInput) squadFileInput.onchange = async ()=>{
      const file = squadFileInput.files[0];
      if(!file) return;
      try{
        if(!XLSX) throw new Error('Biblioteka do odczytu arkuszy nie jest dostępna.');
        const buf = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(new Error('Nie udało się odczytać pliku.')); r.readAsArrayBuffer(file); });
        const wb = XLSX.read(buf, {type:'array'});
        const firstSheet = wb.SheetNames[0];
        if(!firstSheet) throw new Error('Plik nie zawiera żadnego arkusza.');
        const rows = workbookToRows(wb);
        parsed = parseSquadWorkbookRows(rows);
        draw();
      }catch(e){ alert('Błąd importu pliku: ' + (e.message||e)); }
    };
    const imageInput = overlay.querySelector('#squad-import-image');
    if(imageInput) imageInput.onchange = ()=> loadReferenceImageFile(imageInput.files[0]);
    overlay.querySelectorAll('[data-action="squad-image-remove"]').forEach(b=>b.onclick=()=>{ referenceImage = null; draw(); });
    // Wklejenie zrzutu ekranu ze schowka (Ctrl+V) w dowolnym miejscu okna — samo tylko jako
    // podgląd obok wklejanego tekstu, żeby łatwiej porównać skopiowane nazwiska ze zrzutem.
    overlay.onpaste = (e)=>{
      const item = Array.from(e.clipboardData?.items||[]).find(i=>i.type.startsWith('image/'));
      if(item) loadReferenceImageFile(item.getAsFile());
    };
    const textarea = overlay.querySelector('#squad-import-text');
    if(textarea) textarea.oninput = ()=>{ pastedText = textarea.value; };
    overlay.querySelectorAll('[data-action="squad-import-confirm"]').forEach(b=>b.onclick=async()=>{
      const checked = Array.from(overlay.querySelectorAll('.squad-row-check:checked')).map(c=>Number(c.dataset.idx));
      const toAdd = checked.map(i=>parsed[i]).filter(p=>p && p.ok);
      if(!toAdd.length){ alert('Brak zaznaczonych zawodników do zaimportowania.'); return; }
      const origLabel = b.textContent; b.disabled = true; b.textContent = 'Importowanie...';
      let added = 0, skipped = 0, uzupelnieni = 0, bezRocznika = 0, zWieku = 0;
      toAdd.forEach(p=>{
        // Porównanie z pominięciem polskich znaków. Dosłowne zestawienie napisów uznawało
        // „Głowicki" i „Glowicki" za dwie różne osoby i zakładało bliźniaczy wpis — a taki
        // duplikat psuje potem pobieranie statystyk, bo przy dwóch kandydatach o tym samym
        // nazwisku nie da się rozstrzygnąć, którego z nich dotyczą liczby.
        const istniejacy = DB.players.find(pl=>
          pl.clubId===club.id
          && importNorm(pl.firstName)===importNorm(p.firstName)
          && importNorm(pl.lastName)===importNorm(p.lastName));
        if(istniejacy){
          // Zawodnik już jest — ale wklejka może nieść coś, czego wcześniej nie było.
          // Zwykłe pominięcie oznaczałoby, że wklejenie protokołu PO wgraniu listy składu
          // nie dokłada oznaczenia młodzieżowca ani pozycji bramkarza, choć protokół je podaje.
          // Uzupełniamy WYŁĄCZNIE puste pola — nic wpisanego wcześniej nie jest nadpisywane.
          let zmienione = false;
          if(p.mlodziezowiec === true && !istniejacy.mlodziezowiec){ istniejacy.mlodziezowiec = true; zmienione = true; }
          if(p.position && !istniejacy.position){ istniejacy.position = p.position; zmienione = true; }
          if(p.birthYear && !istniejacy.birthYear){ istniejacy.birthYear = p.birthYear; zmienione = true; }
          if(p.nationality && !istniejacy.nationality){ istniejacy.nationality = p.nationality; zmienione = true; }
          if(zmienione) uzupelnieni++; else skipped++;
          return;
        }
        if(!p.birthYear) bezRocznika++;
        else if(p.birthYearFromAge) zWieku++;
        DB.players.push({
          id: uid('Z'), firstName: p.firstName, lastName: p.lastName,
          birthDate: '', birthYear: p.birthYear || '', nationality: p.nationality || '',
          position: p.position || '', foot: '', height: null,   // brak pozycji w źródle = puste (uzupełnisz później), nie "Bramkarz"
          // Bez statusu przy imporcie — status "Do Obserwacji" pojawia się dopiero, gdy dla
          // zawodnika faktycznie zaplanujemy obserwację (patrz saveNewObservation()).
          status: '', clubId: club.id, scout: currentScout || '',
          videoLink: '', lnpLink: '', tmLink: '',
          hasAgent: p.hasAgent === true, agencyName: p.agencyName || '',
          // Znacznik z protokołu PZPN — jedyna pewna informacja o młodzieżowcu tam, gdzie
          // rocznika nie ma skąd wziąć.
          mlodziezowiec: p.mlodziezowiec === true,
          formation: '', customFields: {}, notes: '',
          dateAdded: new Date().toISOString().slice(0,10)
        });
        added++;
      });
      try{
        // savePlayers() (robustStorageSet) NIE rzuca wyjątku przy porażce — zwraca false i pokazuje
        // baner ostrzegawczy. Trzeba sprawdzić wynik wprost, inaczej pokazalibyśmy "zaimportowano"
        // nawet gdyby zapis się nie powiódł (np. brakująca kolumna w bazie przed migracją).
        const ok = await savePlayers();
        if(ok){
          alert(`Zaimportowano ${added} zawodników.` +
            (uzupelnieni ? ` Uzupełniono dane ${uzupelnieni} istniejącym — np. oznaczenie młodzieżowca z protokołu.` : '') +
            (skipped ? ` Pominięto ${skipped} (byli już w bazie i nie wnosili nic nowego).` : '') +
            (zWieku ? `\n\n${zWieku} rocznik(ów) wyliczono z wieku — mogą być o rok wcześniejsze,` +
              ` zależnie od tego, czy zawodnik miał już urodziny. Sprawdź, jeśli to istotne.` : '') +
            (bezRocznika ? `\n\nUWAGA: ${bezRocznika} bez rocznika — w skopiowanym tekście nie było ani daty urodzenia, ani wieku.` +
              ` Na Transfermarkcie użyj zakładki „Szczegóły składu", która pokazuje daty.` : ''));
          closeAndRefresh();
        } else {
          b.disabled = false; b.textContent = origLabel;
          alert('Nie udało się zapisać zaimportowanych zawodników — sprawdź baner ostrzegawczy u góry strony. Dane zostaną utracone po odświeżeniu, dopóki zapis się nie powiedzie.');
        }
      }catch(e){
        console.error('Import składu nie powiódł się:', e);
        b.disabled = false; b.textContent = origLabel;
        alert('Nie udało się zapisać zaimportowanych zawodników: ' + (e.message||e));
      }
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeAndRefresh(); });
  document.body.appendChild(overlay);
  draw();
}

function openMatchScheduleModal(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  let selectedLeague = '';
  let selectedMatch = null;
  let szukanaDruzyna = '';
  // Ligi, dla których próbowaliśmy już pobrać terminarz w tym otwarciu okna — bez tego
  // nieudane pobranie (np. brak sieci) zapętliłoby się przy każdym przerysowaniu.
  const autoTried = new Set();

  function closeModal(){ overlay.remove(); }

  // Zawodnicy drużyny z terminarza (nazwa klubu jako tekst, nie identyfikator). Wersja wprost —
  // filtr po wszystkich zawodnikach, a w środku szukanie klubu — kosztowała 2514 × 540 operacji
  // NA KAŻDE wywołanie, a wołamy ją dwa razy na mecz, przy ~300 meczach. Stąd okno terminarza
  // otwierało się z wyraźnym opóźnieniem. Teraz raz budujemy indeksy i pamiętamy wynik per nazwa.
  let klubyWgId = null, zawodnicyWgKlubu = null;
  const cacheDruzyn = new Map();
  function buildSquadIndex(){
    klubyWgId = new Map(DB.clubs.map(c=>[c.id, (c.name||'').toLowerCase()]));
    zawodnicyWgKlubu = new Map();
    DB.players.forEach(p=>{
      if(!p.clubId) return;
      let arr = zawodnicyWgKlubu.get(p.clubId);
      if(!arr){ arr = []; zawodnicyWgKlubu.set(p.clubId, arr); }
      arr.push(p);
    });
  }
  function playersForClub(clubName){
    if(!clubName) return [];
    const normalized = clubName.toLowerCase().trim();
    const hit = cacheDruzyn.get(normalized);
    if(hit) return hit;
    if(!klubyWgId) buildSquadIndex();

    const out = [];
    klubyWgId.forEach((nazwa, id)=>{
      if(!nazwa) return;
      if(nazwa.includes(normalized) || normalized.includes(nazwa)){
        const arr = zawodnicyWgKlubu.get(id);
        if(arr) out.push(...arr);
      }
    });
    out.sort((a,b)=>{
      const ya = Number(a.birthYear)||0, yb = Number(b.birthYear)||0;
      return yb - ya;
    });
    cacheDruzyn.set(normalized, out);
    return out;
  }

  // Mecze jeszcze nierozegrane w wybranej lidze (od dziś w przód), po dacie i godzinie.
  function futureMatches(){
    const todayStr = new Date().toISOString().slice(0,10);
    // Dopasowanie po POZIOMIE rozgrywek: wybór "III liga" ma łapać też "III liga, gr. II" itd.
    const matchesLeague = (m)=> !selectedLeague || m.league === selectedLeague
      || topLevelOf(m.league) === selectedLeague;
    return DB.matches
      .filter(m=> m.date && m.date >= todayStr && matchesLeague(m))
      .sort((a,b)=> (a.date+' '+(a.time||'')).localeCompare(b.date+' '+(b.time||'')));
  }

  // Okno miesięczne: pokazujemy wszystkie mecze od dziś przez najbliższe 30 dni. Liczymy dni,
  // a nie „do końca miesiąca kalendarzowego" — pod koniec miesiąca to drugie zostawiałoby
  // praktycznie pustą listę.
  const SCHEDULE_WINDOW_DAYS = 30;
  function upcomingMatches(){
    const endStr = new Date(Date.now() + SCHEDULE_WINDOW_DAYS*24*60*60*1000).toISOString().slice(0,10);
    // Szukanie po fragmencie nazwy („So" → Solec Kujawski) obejmuje OBIE drużyny, bo mecz jest
    // wart pokazania niezależnie od tego, czy szukany klub gra u siebie, czy na wyjeździe.
    // Porównujemy bez polskich znaków, żeby „lecz" trafiało w „Łęczna".
    const szukane = importNorm(szukanaDruzyna);
    return futureMatches().filter(m=> m.date <= endStr).filter(m=>{
      if(!szukane) return true;
      return importNorm(m.homeTeam).includes(szukane) || importNorm(m.awayTeam).includes(szukane);
    });
  }

  // Kolejki obecne w wyświetlanym oknie — służą tylko do nagłówków grup i podpisu w tytule.
  function visibleRounds(){
    return [...new Set(upcomingMatches().map(m=>m.round).filter(r=>r!=null))].sort((a,b)=>a-b);
  }

  // Pobranie terminarza wybranej ligi z 90minut przez /api/schedule (90minut nie wysyła CORS,
  // więc idzie to przez naszego pośrednika). Dopisujemy tylko mecze, których jeszcze nie ma —
  // powtórne pobranie nie tworzy duplikatów i nie kasuje niczego, co już jest w bazie.
  // Bez wybranej ligi pobieramy WSZYSTKIE znane poziomy rozgrywek — po to, żeby zaraz po wejściu
  // w terminarz był komplet meczów, bez klikania po ligach.
  async function fetchScheduleFor90minut(btn){
    const status = overlay.querySelector('#schedule-status');
    const targets = selectedLeague ? [selectedLeague] : Object.keys(SCHEDULE_SOURCES);
    const jobs = targets
      .map(lg => ({ league: lg, urls: scheduleUrlsFor(lg) }))
      .filter(j => j.urls.length);

    if(!jobs.length){
      status.innerHTML = `<span style="color:var(--clay-dark);">Dla „${esc(selectedLeague)}" nie mam adresu terminarza
        (IV liga dzieli się na grupy regionalne). Wgraj terminarz z pliku albo podaj adres strony ligi na 90minut.</span>`;
      return;
    }

    const prev = btn.textContent;
    btn.disabled = true; btn.textContent = 'Pobieram…';
    const totalUrls = jobs.reduce((n,j)=>n+j.urls.length, 0);
    let doneUrls = 0;
    try{
      let added = 0, seen = 0;
      // Wszystkie strony naraz, nie jedna po drugiej. Przy 7 adresach (Ekstraklasa, I, II liga
      // i cztery grupy III ligi) czekanie w kolejce oznaczało sumę wszystkich pobrań; równolegle
      // trwa to tyle, co najwolniejsze pojedyncze.
      const tasks = jobs.flatMap(job => job.urls.map(url => ({league: job.league, url})));
      const settled = await Promise.all(tasks.map(async (t)=>{
        try{
          const res = await fetch('/api/schedule?url=' + encodeURIComponent(t.url));
          // Serwer deweloperski nie obsługuje /api (to funkcje Vercela) i na każdy adres oddaje
          // stronę aplikacji — bez tej kontroli użytkownik dostawał surowy błąd parsera JSON.
          const ctype = res.headers.get('content-type') || '';
          if(!ctype.includes('application/json')){
            throw new Error('pobieranie terminarza działa tylko na wdrożonej stronie — lokalny serwer deweloperski nie obsługuje /api.');
          }
          if(!res.ok){
            const body = await res.json().catch(()=>({}));
            throw new Error(body.error || ('serwer odpowiedział kodem ' + res.status));
          }
          const data = await res.json();
          doneUrls++;
          status.textContent = `Pobieram z 90minut.pl… (${doneUrls}/${totalUrls})`;
          return {league: t.league, data};
        }catch(e){ return {league: t.league, error: e.message}; }
      }));

      // Jedna liga może paść (np. zmieniony adres) — reszta i tak wchodzi. Zgłaszamy, które.
      const failed = settled.filter(s=>s.error);
      if(failed.length === settled.length) throw new Error(failed[0].error);

      // Klucze już obecnych meczów liczymy RAZ; wcześniej dla każdego z 2000+ meczów
      // przechodziliśmy całą tablicę, co przy pełnym sezonie zajmowało zauważalnie długo.
      // Tożsamość meczu to KOLEJKA + para drużyn, świadomie bez daty. Wcześniej w kluczu była
      // data — więc gdy 90minut zamieniało datę przybliżoną na potwierdzoną, klucz się zmieniał
      // i powstawał DRUGI wpis zamiast poprawienia pierwszego. Obserwacja wskazywała wtedy nadal
      // na stary termin, bez godziny.
      const kluczMeczu = (x)=> `${x.round ?? ''}|${importNorm(x.homeTeam)}|${importNorm(x.awayTeam)}`;
      const wgKlucza = new Map();
      DB.matches.forEach(x=> wgKlucza.set(kluczMeczu(x), x));
      let uaktualnione = 0;
      const potwierdzone = [];
      for(const s of settled){
        if(s.error) continue;
        for(const m of s.data.matches){
          seen++;
          const key = kluczMeczu(m);
          if(!m.dateApprox && m.date) potwierdzone.push(m);
          const istniejacy = wgKlucza.get(key);
          if(!istniejacy){
            const nowy = {id: uid('M'), league: s.league, competition: s.data.league,
              date: m.date, time: m.time, homeTeam: m.homeTeam, awayTeam: m.awayTeam,
              round: m.round, dateApprox: !!m.dateApprox, stadium: ''};
            DB.matches.push(nowy);
            wgKlucza.set(key, nowy);
            added++;
            continue;
          }
          // Poprawiamy tylko w stronę większej pewności: potwierdzony termin zastępuje przybliżony
          // albo wcześniejszy potwierdzony, gdy klub przełożył spotkanie.
          const jestDokladna = !m.dateApprox && !!m.date;
          const inny = istniejacy.date !== m.date || (istniejacy.time||'') !== (m.time||'');
          if(jestDokladna && (istniejacy.dateApprox || inny)){
            istniejacy.date = m.date;
            istniejacy.time = m.time || '';
            istniejacy.dateApprox = false;
            uaktualnione++;
          }
        }
      }
      // Potwierdzony termin przepisujemy do zaplanowanych obserwacji tego meczu — po to, żeby
      // mecz wybrany, gdy nie miał jeszcze godziny, sam dostał właściwy dzień i godzinę.
      const obsPoprawione = await przepiszTerminyDoObserwacji(potwierdzone);
      // Doszły nowe mecze, więc podpowiedzi „ilu zawodników w bazie" trzeba policzyć od nowa.
      klubyWgId = null; zawodnicyWgKlubu = null; cacheDruzyn.clear();
      // Znacznik czasu pobrania trzymamy per liga — na nim opiera się dobowe odświeżanie.
      if(!DB.settings.scheduleFetchedAt) DB.settings.scheduleFetchedAt = {};
      const stamp = new Date().toISOString();
      jobs.forEach(j=>{ DB.settings.scheduleFetchedAt[j.league] = stamp; });
      const ok = await saveMatches();
      if(!ok) throw new Error('nie udało się zapisać meczów w bazie.');
      await saveSettings();
      status.innerHTML = `✓ Pobrano ${seen} meczów, dodano nowych: <strong>${added}</strong>.` +
        (uaktualnione ? ` Potwierdzono termin przy <strong>${uaktualnione}</strong>.` : '') +
        (obsPoprawione ? ` Poprawiono termin w <strong>${obsPoprawione}</strong> zaplanowanych obserwacjach.` : '') +
        (added + uaktualnione < seen ? ` Reszta bez zmian.` : '');
      draw();
    }catch(e){
      status.innerHTML = `<span style="color:var(--clay-dark);">Nie udało się pobrać: ${esc(e.message)}</span>`;
      btn.disabled = false; btn.textContent = prev;
    }
  }

  // Automatyczne wczytanie terminarza po wyborze ligi — bez klikania. Pobieramy, gdy dla danej
  // ligi nie mamy jeszcze żadnego nadchodzącego meczu ALBO gdy ostatnie pobranie było ponad dobę
  // temu (dochodzą przełożenia i godziny kolejnych kolejek). Przycisk zostaje do wymuszenia
  // odświeżenia w dowolnym momencie.
  const SCHEDULE_REFRESH_MS = 24 * 60 * 60 * 1000;
  function scheduleIsStale(league){
    const at = DB.settings.scheduleFetchedAt && DB.settings.scheduleFetchedAt[league];
    if(!at) return true;
    const ts = new Date(at).getTime();
    return isNaN(ts) || (Date.now() - ts) > SCHEDULE_REFRESH_MS;
  }
  function maybeAutoFetch(){
    // Klucz "" oznacza wejście bez wybranej ligi — wtedy ciągniemy wszystkie poziomy rozgrywek.
    const key = selectedLeague || '';
    if(autoTried.has(key)) return;
    const targets = selectedLeague ? [selectedLeague] : Object.keys(SCHEDULE_SOURCES);
    const usable = targets.filter(lg => scheduleUrlsFor(lg).length);   // IV liga bez adresu odpada
    if(!usable.length) return;
    // Pobieramy, gdy czegoś brakuje albo gdy którykolwiek terminarz jest starszy niż doba.
    const nothingToShow = upcomingMatches().length === 0;
    if(!nothingToShow && !usable.some(scheduleIsStale)) return;
    autoTried.add(key);
    const btn = overlay.querySelector('[data-action="fetch-schedule"]');
    if(btn) fetchScheduleFor90minut(btn);
  }

  function draw(){
    const matches = upcomingMatches();
    const rounds = visibleRounds();
    // Poziomy rozgrywek pokazujemy ZAWSZE (Ekstraklasa → IV liga), niezależnie od tego, czy jakiś
    // mecz jest już zaimportowany. Wcześniej lista powstawała z DB.matches, więc przy pustym
    // terminarzu zostawało samo "Wszystkie ligi" i nie było czego wybrać.
    const SCHEDULE_LEAGUES = ["Ekstraklasa","I liga","II liga","III liga","IV liga"];
    const extra = [...new Set(DB.matches.map(m=>m.league).filter(Boolean))]
      .filter(l=> !SCHEDULE_LEAGUES.includes(l)).sort();
    const leagues = [...SCHEDULE_LEAGUES, ...extra];
    // Mecze porządkujemy WEDŁUG KOLEJKI, a dopiero wewnątrz niej po dacie. Przy sortowaniu samą
    // datą kolejki różnych lig przeplatały się (III liga gra kolejkę 1, gdy Ekstraklasa 2), więc
    // ten sam nagłówek „Kolejka 1" pojawiał się na liście kilka razy.
    matches.sort((a,b)=>{
      const ra = a.round==null ? 999 : a.round, rb = b.round==null ? 999 : b.round;
      if(ra !== rb) return ra - rb;
      return (a.date+' '+(a.time||'')).localeCompare(b.date+' '+(b.time||''));
    });
    // Nagłówek grupy nad pierwszym meczem każdej kolejki — przy braku kolejek nie pokazujemy nic.
    let lastRound;
    const roundHeader = (m)=>{
      if(!rounds.length || m.round === lastRound) return '';
      lastRound = m.round;
      return `<div style="margin:6px 0 2px;font-weight:800;color:var(--heading);font-size:13px;">Kolejka ${m.round}</div>`;
    };

    overlay.innerHTML = `
    <div class="modal" style="max-width:900px;max-height:85vh;overflow:auto;">
      <h3>📅 Terminarz meczów — najbliższy miesiąc${matches.length?` <span style="font-weight:400;font-size:13px;color:var(--ink-soft);">(${matches.length} meczów${rounds.length?', kolejki '+rounds.join(', '):''})</span>`:''}</h3>
      <p class="note">Mecze z najbliższych 30 dni pobierają się same przy wejściu. Zawęź listę wyborem ligi. Kliknij mecz, aby wybrać zawodnika do obserwacji.</p>

      <div class="field-wrap" style="margin-bottom:10px;">
        <label class="field">Poziom rozgrywek</label>
        <div style="display:flex;gap:8px;">
          <select id="schedule-league-filter" style="flex:1;">
            <option value="">Wszystkie ligi</option>
            ${leagues.map(l=>`<option value="${esc(l)}" ${selectedLeague===l?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
          <button class="gold" data-action="fetch-schedule" style="white-space:nowrap;" title="${selectedLeague?'Odśwież terminarz tej ligi':'Pobierz terminarze wszystkich lig'}">⬇ ${selectedLeague?'Pobierz z 90minut':'Pobierz wszystkie ligi'}</button>
        </div>
        <div id="schedule-status" class="note" style="margin-top:6px;font-size:11.5px;"></div>
      </div>

      <div class="field-wrap" style="margin-bottom:10px;">
        <label class="field">Szukaj drużyny</label>
        <input id="schedule-team-search" placeholder="np. So… → Solec Kujawski" value="${esc(szukanaDruzyna)}" autocomplete="off">
        ${szukanaDruzyna?`<div class="note" style="margin-top:4px;font-size:11.5px;">Pasujących meczów: <strong>${matches.length}</strong>
          &middot; <button class="link-btn" data-action="clear-team-search" style="font-size:11px;">wyczyść</button></div>`:''}
      </div>

      ${!DB.matches.length ? `
        <div class="empty" style="padding:24px;text-align:center;">
          <p style="margin-bottom:12px;">Brak meczów w bazie.</p>
          <button class="gold" data-action="import-matches">📋 Wgraj terminarz z pliku</button>
          <button class="secondary" data-action="download-match-template" style="margin-left:8px;">⭳ Pobierz szablon CSV</button>
        </div>
      ` : matches.length ? `
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
          ${matches.map(m=>{
            const homePlayers = playersForClub(m.homeTeam);
            const awayPlayers = playersForClub(m.awayTeam);
            const totalPlayers = homePlayers.length + awayPlayers.length;
            const youth = [...homePlayers, ...awayPlayers].filter(p=>Number(p.birthYear) >= 2005).length;
            const dateObj = new Date(m.date + 'T00:00:00');
            const dayName = ['Nd','Pon','Wt','Śr','Czw','Pt','Sob'][dateObj.getDay()];

            return roundHeader(m) + `<div class="match-row" data-match-id="${m.id}" style="border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer;transition:all 0.2s;background:${selectedMatch===m.id?'var(--card-warm)':'var(--card)'};" onmouseover="this.style.background='var(--card-warm)'" onmouseout="this.style.background='${selectedMatch===m.id?'var(--card-warm)':'var(--card)'}'">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-weight:600;color:var(--heading);">${esc(m.homeTeam||'—')} — ${esc(m.awayTeam||'—')}</div>
                  <div class="meta" style="font-size:12px;">${m.dateApprox?'~ ':''}${dayName} ${esc(m.date)}${m.time?' • '+esc(m.time):''}${m.stadium?' • 📍 '+esc(m.stadium):''}${m.dateApprox?' <span title="90minut podaje na razie tylko zakres dat tej kolejki">(termin orientacyjny)</span>':''}</div>
                  ${m.league?`<div class="meta" style="font-size:11px;color:var(--gold-dark);">${esc(m.league)}</div>`:''}
                </div>
                <div style="text-align:right;">
                  ${totalPlayers ? `<div style="font-size:12px;color:var(--good);">👥 ${totalPlayers} zawodników w bazie</div>` : '<div style="font-size:12px;color:var(--ink-soft);">Brak zawodników</div>'}
                  ${youth ? `<div style="font-size:11px;color:var(--gold-dark);">⭐ ${youth} młodzieżowców</div>` : ''}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      ` : '<div class="empty">Brak meczów w najbliższych 30 dniach. Kliknij „Pobierz", aby zaciągnąć terminarz z 90minut.</div>'}

      <div class="modal-actions">
        ${DB.matches.length ? `<button class="secondary" data-action="import-matches">📋 Wgraj więcej meczów</button>` : ''}
        <button class="secondary" data-action="close-modal">Zamknij</button>
      </div>
    </div>`;
    wire();
  }

  function drawPlayerSelection(matchId){
    const m = DB.matches.find(x=>x.id===matchId);
    if(!m) return;

    const homePlayers = playersForClub(m.homeTeam);
    const awayPlayers = playersForClub(m.awayTeam);

    const renderPlayerList = (players, teamName) => {
      if(!players.length) return `<div class="empty" style="padding:12px;font-size:12px;">Brak zawodników z ${esc(teamName)} w bazie</div>`;
      return players.map(p=>{
        const isYouth = Number(p.birthYear) >= 2005;
        return `<div class="player-option" data-player-id="${p.id}" style="padding:8px 12px;border:1px solid var(--border);border-radius:6px;margin-bottom:6px;cursor:pointer;background:var(--card);" onmouseover="this.style.background='var(--card-warm)'" onmouseout="this.style.background='var(--card)'">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong>${esc(p.lastName)}</strong> ${esc(p.firstName)}
              ${isYouth?'<span style="color:var(--gold-dark);font-size:11px;margin-left:6px;">⭐ MŁODZIEŻ</span>':''}
            </div>
            <div class="meta" style="font-size:11px;">${esc(p.position||'—')} • ${esc(p.birthYear||'—')}</div>
          </div>
        </div>`;
      }).join('');
    };

    overlay.innerHTML = `
    <div class="modal" style="max-width:700px;max-height:85vh;overflow:auto;">
      <h3>Wybierz zawodnika do obserwacji</h3>
      <div style="background:var(--card-warm);padding:12px;border-radius:8px;margin-bottom:16px;">
        <div style="font-weight:600;color:var(--heading);">${esc(m.homeTeam||'—')} — ${esc(m.awayTeam||'—')}</div>
        <div class="meta">${esc(m.date)}${m.time?' • '+esc(m.time):''}${m.stadium?' • 📍 '+esc(m.stadium):''}</div>
      </div>

      <div style="margin-bottom:16px;">
        <h4 style="color:var(--heading);margin-bottom:8px;">🏠 ${esc(m.homeTeam||'Gospodarz')}</h4>
        ${renderPlayerList(homePlayers, m.homeTeam)}
      </div>

      <div style="margin-bottom:16px;">
        <h4 style="color:var(--heading);margin-bottom:8px;">✈️ ${esc(m.awayTeam||'Gość')}</h4>
        ${renderPlayerList(awayPlayers, m.awayTeam)}
      </div>

      <div class="modal-actions">
        <button class="gold" data-action="select-no-player">Bez zawodnika (obserwuję zespół)</button>
        <button class="secondary" data-action="back-to-schedule">← Wróć do terminarza</button>
      </div>
    </div>`;

    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=closeModal);
    overlay.querySelectorAll('[data-action="back-to-schedule"]').forEach(b=>b.onclick=()=>{ selectedMatch=null; draw(); });
    overlay.querySelectorAll('.player-option').forEach(b=>b.onclick=()=>{
      fillObsForm(m, (b as HTMLElement).dataset.playerId);
      closeModal();
    });
    overlay.querySelectorAll('[data-action="select-no-player"]').forEach(b=>b.onclick=()=>{
      fillObsForm(m, null);
      closeModal();
    });
  }

  function fillObsForm(match, playerId){
    const matchInput = document.querySelector('#obs-match') as HTMLInputElement;
    const dateInput = document.querySelector('#obs-date') as HTMLInputElement;
    const timeInput = document.querySelector('#obs-time') as HTMLInputElement;
    const locationInput = document.querySelector('#obs-location') as HTMLInputElement;
    const playerSelect = document.querySelector('#obs-player') as HTMLSelectElement;

    if(matchInput) matchInput.value = `${match.homeTeam||''} - ${match.awayTeam||''}`;
    if(dateInput && match.date) dateInput.value = match.date;
    if(timeInput && match.time) timeInput.value = match.time;
    // Adres: z terminarza, a gdy go tam nie ma — zapamiętany wcześniej adres gospodarza.
    if(locationInput){
      const zapamietany = stadiumAddressFor(match.homeTeam);
      if(match.stadium) locationInput.value = match.stadium;
      else if(zapamietany) locationInput.value = zapamietany;
    }
    // Zawodnika ustawiamy TYLKO gdy został wskazany wprost. Wybór samego meczu zostawia pole puste
    // (obserwacja zespołu) — wcześniej podstawiał się pierwszy zawodnik z listy.
    if(playerSelect) playerSelect.value = playerId || '';
  }

  function wire(){
    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=closeModal);
    overlay.querySelectorAll('[data-action="import-matches"]').forEach(b=>b.onclick=()=>{ closeModal(); openMatchImportModal(); });
    overlay.querySelectorAll('[data-action="download-match-template"]').forEach(b=>b.onclick=()=>downloadMatchTemplate());

    const leagueFilter = overlay.querySelector('#schedule-league-filter') as HTMLSelectElement;
    if(leagueFilter) leagueFilter.onchange = ()=>{ selectedLeague = leagueFilter.value; draw(); maybeAutoFetch(); };

    // Przerysowanie okna zabiera ognisko z pola tekstowego i po każdej literze trzeba by w nie
    // klikać na nowo. Ten sam pomocnik zdał egzamin przy pozostałych polach w aplikacji.
    const szukajka = overlay.querySelector('#schedule-team-search');
    if(szukajka) szukajka.oninput = ()=>{
      szukanaDruzyna = szukajka.value;
      zachowajKursorPoPrzerysowaniu(overlay, '#schedule-team-search', draw);
    };
    overlay.querySelectorAll('[data-action="clear-team-search"]').forEach(b=>b.onclick=()=>{ szukanaDruzyna=''; draw(); });
    overlay.querySelectorAll('[data-action="fetch-schedule"]').forEach(b=>b.onclick=()=>fetchScheduleFor90minut(b));

    overlay.querySelectorAll('.match-row').forEach(row=>{
      row.addEventListener('click', ()=>{
        const matchId = (row as HTMLElement).dataset.matchId;
        selectedMatch = matchId;
        drawPlayerSelection(matchId);
      });
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeModal(); });
  document.body.appendChild(overlay);
  draw();
  maybeAutoFetch();
}

function downloadMatchTemplate(){
  const rows = [
    ['Liga','Kolejka','Data','Godzina','Gospodarz','Gość','Stadion'],
    ['Ekstraklasa',2,'2026-08-01','17:00','Legia Warszawa','Lech Poznań','Stadion Wojska Polskiego'],
    ['Ekstraklasa',2,'2026-08-02','20:00','Raków Częstochowa','Pogoń Szczecin','Stadion Miejski'],
    ['Ekstraklasa',3,'2026-08-08','17:30','Lech Poznań','Cracovia','Enea Stadion'],
    ['I liga',2,'2026-08-03','15:00','Widzew Łódź','Arka Gdynia','Stadion Widzewa'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Terminarz');
  XLSX.writeFile(wb, 'terminarz_szablon.xlsx');
}

function openMatchImportModal(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  function closeModal(){ overlay.remove(); render(); }

  overlay.innerHTML = `
  <div class="modal" style="max-width:650px;">
    <h3>📋 Wgraj terminarz meczów</h3>
    <p class="note">Wgraj plik Excel/CSV z meczami. Kolumny: <strong>Liga, Kolejka, Data, Godzina, Gospodarz, Gość</strong>, opcjonalnie Stadion.<br>
    <span style="font-size:11px;">Kolejka decyduje o tym, które mecze pokażą się w planowaniu — bez niej wracamy do okna 14 dni.</span></p>

    <div class="field-wrap" style="margin-bottom:14px;">
      <label class="field">Plik Excel / CSV</label>
      <input type="file" id="match-file" accept=".xlsx,.xls,.csv">
    </div>

    <div style="border-top:1px dashed var(--border-strong);padding-top:12px;margin-bottom:14px;">
      <label class="field">…albo wklej terminarz (jeden mecz na linię)</label>
      <textarea id="match-paste" rows="8" placeholder="Ekstraklasa	2026-08-01	17:00	Legia Warszawa	Lech Poznań&#10;Ekstraklasa	2026-08-02	20:00	Raków	Pogoń" style="font-size:12px;font-family:monospace;"></textarea>
    </div>

    <div class="modal-actions">
      <button class="gold" data-action="do-import">Importuj</button>
      <button class="secondary" data-action="get-template">⭳ Szablon</button>
      <button class="secondary" data-action="close-modal">Anuluj</button>
    </div>
  </div>`;

  overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=closeModal);
  overlay.querySelectorAll('[data-action="get-template"]').forEach(b=>b.onclick=()=>downloadMatchTemplate());
  overlay.querySelectorAll('[data-action="do-import"]').forEach(b=>b.onclick=async()=>{
    const fileInput = overlay.querySelector('#match-file') as HTMLInputElement;
    const textarea = overlay.querySelector('#match-paste') as HTMLTextAreaElement;

    let newMatches = [];

    if(fileInput.files && fileInput.files[0]){
      try{
        const buf = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(new Error('Nie udało się wczytać.')); r.readAsArrayBuffer(fileInput.files[0]); });
        const wb = XLSX.read(buf, {type:'array'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {defval:''});
        newMatches = parseMatchRows(rows);
      }catch(e){ alert('Błąd odczytu pliku: '+((e as any).message||e)); return; }
    } else if(textarea.value.trim()){
      newMatches = parseMatchText(textarea.value.trim());
    } else {
      alert('Wybierz plik albo wklej terminarz!'); return;
    }

    if(!newMatches.length){ alert('Nie rozpoznano żadnych meczów.'); return; }

    const orig = (b as HTMLElement).textContent;
    (b as HTMLButtonElement).disabled = true;
    (b as HTMLElement).textContent = 'Importowanie...';

    newMatches.forEach(m=>{
      const exists = DB.matches.some(x=>x.date===m.date && x.homeTeam===m.homeTeam && x.awayTeam===m.awayTeam);
      if(!exists) DB.matches.push({id: uid('M'), ...m});
    });

    const ok = await saveMatches();
    if(ok){
      alert(`Zaimportowano ${newMatches.length} meczów.`);
      closeModal();
    } else {
      (b as HTMLButtonElement).disabled = false;
      (b as HTMLElement).textContent = orig;
      alert('Nie udało się zapisać meczów.');
    }
  });

  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function parseMatchRows(rows){
  if(!rows.length) return [];
  const norm = (s)=> String(s||'').toLowerCase().replace(/[ąćęłńóśźż]/g, c=>({ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z'}[c])).replace(/[^a-z0-9]/g,'');
  const headerMap = {};
  Object.keys(rows[0]).forEach(h=>{ headerMap[norm(h)] = h; });
  const findCol = (...cands)=>{ for(const c of cands){ if(headerMap[norm(c)]) return headerMap[norm(c)]; } return null; };

  const colLeague = findCol('Liga','League','Rozgrywki');
  const colDate = findCol('Data','Date');
  const colTime = findCol('Godzina','Time','Godz');
  const colHome = findCol('Gospodarz','Home','Gospodarze');
  const colAway = findCol('Gość','Gosc','Away','Goście');
  const colStadium = findCol('Stadion','Stadium','Obiekt');
  const colRound = findCol('Kolejka','Round','Queue','Nr kolejki','Kolejka nr');

  return rows.map(row=>{
    const homeTeam = colHome ? String(row[colHome]||'').trim() : '';
    const awayTeam = colAway ? String(row[colAway]||'').trim() : '';
    if(!homeTeam || !awayTeam) return null;

    let date = colDate ? String(row[colDate]||'').trim() : '';
    if(date && !/^\d{4}-\d{2}-\d{2}$/.test(date)){
      const parts = date.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
      if(parts) date = `${parts[3]}-${parts[2].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
    }

    return {
      league: colLeague ? String(row[colLeague]||'').trim() : '',
      date,
      time: colTime ? String(row[colTime]||'').trim() : '',
      homeTeam, awayTeam,
      stadium: colStadium ? String(row[colStadium]||'').trim() : '',
      // Kolejka jako liczba — z "2", "kolejka 2", "2. kolejka" itd. Brak = pusty (mecz trafi do
      // grupy "bez kolejki", zamiast udawać kolejkę 0).
      round: colRound ? roundNumber(row[colRound]) : null,
    };
  }).filter(Boolean);
}

// Wyciąga numer kolejki z dowolnego zapisu ("3", "kolejka 3", "3. kolejka", "K3").
function roundNumber(raw){
  const m = String(raw==null?'':raw).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function parseMatchText(text){
  return text.split('\n').map(line=>{
    const parts = line.split(/\t+|\s{2,}/).map(p=>p.trim()).filter(Boolean);
    if(parts.length < 4) return null;

    let league='', date='', time='', homeTeam='', awayTeam='', stadium='', round=null;

    for(const part of parts){
      if(/^\d{4}-\d{2}-\d{2}$/.test(part)) date = part;
      else if(/^\d{1,2}:\d{2}$/.test(part)) time = part;
      // "kolejka 3" / "3. kolejka" — rozpoznajemy po słowie, żeby nie pomylić z samą liczbą,
      // która w tej samej linii mogłaby być czymkolwiek innym.
      else if(/kolejk/i.test(part) && round==null) round = roundNumber(part);
      else if(/liga|ekstraklasa|klasa/i.test(part) && !league) league = part;
      else if(!homeTeam) homeTeam = part;
      else if(!awayTeam) awayTeam = part;
      else if(!stadium) stadium = part;
    }

    if(!homeTeam || !awayTeam) return null;
    return {league, date, time, homeTeam, awayTeam, stadium, round};
  }).filter(Boolean);
}

// Strony terminarzy na 90minut dla poszczególnych poziomów rozgrywek (sezon 2026/2027).
// III liga ma cztery grupy — pobieramy wszystkie naraz. IV liga jest podzielona regionalnie i nie
// da się jej sprowadzić do jednego adresu, więc jej adres(y) wskazuje użytkownik: wpis w
// DB.settings.scheduleUrls[liga] nadpisuje tę mapę i przeżywa zmianę sezonu bez zmiany kodu.
const SCHEDULE_SOURCES = {
  'Ekstraklasa': ['http://www.90minut.pl/liga/1/liga14675.html'],
  'I liga':      ['http://www.90minut.pl/liga/1/liga14676.html'],
  'II liga':     ['http://www.90minut.pl/liga/1/liga14677.html'],
  'III liga':    ['http://www.90minut.pl/liga/1/liga14742.html',
                  'http://www.90minut.pl/liga/1/liga14743.html',
                  'http://www.90minut.pl/liga/1/liga14744.html',
                  'http://www.90minut.pl/liga/1/liga14745.html'],
  // Grupy IV ligi, sezon 2026/2027 — te, które obserwujesz. Numery rozgrywek pochodzą
  // wprost ze stron 90minut i zmieniają się co sezon; przy nowym sezonie trzeba je podmienić
  // (albo wskazać własne adresy w ustawieniach, patrz scheduleUrlsFor).
  'IV liga':     ['http://www.90minut.pl/liga/1/liga14747.html',   // śląska
                  'http://www.90minut.pl/liga/1/liga14748.html',   // zachodniopomorska
                  'http://www.90minut.pl/liga/1/liga14749.html',   // pomorska
                  'http://www.90minut.pl/liga/1/liga14768.html',   // dolnośląska
                  'http://www.90minut.pl/liga/1/liga14779.html',   // wielkopolska
                  'http://www.90minut.pl/liga/1/liga14836.html',   // kujawsko-pomorska
                  'http://www.90minut.pl/liga/1/liga14968.html'],  // łódzka
};
// Przepisanie potwierdzonych terminów do ZAPLANOWANYCH obserwacji. Kluby mają czas do piątku do
// północy na zgłoszenie terminu, więc mecz wybrany wcześniej często nie ma jeszcze dnia i godziny.
// Ruszamy wyłącznie obserwacje z przyszłości — przestawianie tych, które już się odbyły, byłoby
// fałszowaniem historii pracy.
async function przepiszTerminyDoObserwacji(potwierdzone){
  if(!potwierdzone || !potwierdzone.length) return 0;
  const poParze = new Map();
  potwierdzone.forEach(m=>{
    poParze.set(`${importNorm(m.homeTeam)}|${importNorm(m.awayTeam)}`, {date: m.date, time: m.time || ''});
  });
  const dzisiaj = new Date().toISOString().slice(0,10);
  let zmienione = 0;
  DB.observations.forEach(o=>{
    const czysty = String(o.match||'').replace(/\s+/g,' ').trim();
    const czesci = czysty.split(/\s+[-–—]\s+/);
    if(czesci.length < 2) return;
    // Za nazwą gościa bywa doklejona data z terminarza — bierzemy tekst do pierwszego przecinka.
    const klucz = `${importNorm(czesci[0])}|${importNorm(czesci[1].split(',')[0])}`;
    const termin = poParze.get(klucz);
    if(!termin) return;
    if(o.date && o.date < dzisiaj) return;
    if(o.date === termin.date && (o.matchTime||'') === termin.time) return;
    o.date = termin.date;
    if(termin.time) o.matchTime = termin.time;
    zmienione++;
  });
  if(zmienione) await saveObservations();
  return zmienione;
}

function scheduleUrlsFor(league){
  const override = DB.settings.scheduleUrls && DB.settings.scheduleUrls[league];
  if(override) return Array.isArray(override) ? override : [override];
  return SCHEDULE_SOURCES[league] || [];
}

// Rozpoznanie serwisu po adresie. Tylko 90minut da się pobrać automatycznie: Transfermarkt i ŁNP
// serwują pustą powłokę JS (sprawdzone — w HTML nie ma ani jednego wiersza tabeli), a API ŁNP
// dodatkowo wymaga tokenu wydawanego po reCAPTCHA. Dlatego dla nich zapisujemy sam link.
function detectStatsSource(raw){
  let host;
  try{ host = new URL(raw.trim()).hostname.replace(/^www\./,'').toLowerCase(); }
  catch{ return {kind:'invalid'}; }
  if(/(^|\.)90minut\.pl$/.test(host)) return {kind:'90minut', field:'lnpLink'};
  if(/(^|\.)transfermarkt\.[a-z.]+$/.test(host)) return {kind:'transfermarkt', field:'tmLink', label:'Transfermarkt'};
  if(/(^|\.)laczynaspilka\.pl$/.test(host)) return {kind:'lnp', field:'lnpLink', label:'Łączy nas piłką'};
  return {kind:'unknown', host};
}

// Wklejenie tabeli statystyk CAŁEJ drużyny (np. zaznaczonej na Transfermarkt) i rozdzielenie jej
// na zawodników po nazwisku. Powstało, bo minut nie da się pobrać automatycznie z żadnego źródła:
// 90minut ich nie publikuje, a Transfermarkt renderuje tabelę JavaScriptem, więc w pobranym HTML-u
// jej nie ma. Wklejenie raz na klub zastępuje wpisywanie liczb zawodnik po zawodniku.
//
// Transfermarkt rozbija JEDNEGO zawodnika na kilka linii, a nagłówki kolumn są ikonami (zegar =
// minuty, piłka = bramki), więc po wklejeniu nie ma żadnych etykiet tekstowych. Układ wygląda tak:
//
//   Mikael Ishak   Mikael Ishak      <- nazwisko (dwa razy: pełne i skrócone)
//   Środkowy napastnik               <- pozycja
//       33   Szwecja                 <- wiek i narodowość
//   Syria   3   3   2   222'         <- DOPIERO TU liczby: mecze, bramki, asysty, minuty
//
// Dlatego czytamy blokami: linia z nazwiskiem otwiera blok zawodnika, a liczby zbieramy z
// kolejnych linii aż do nazwiska następnego. Kotwicą minut jest apostrof ("222'", "1.980'") —
// to jedyne pewne oznaczenie, jakie w ogóle zostaje po ikonach.
// MINUTY GRY z protokołu ŁNP.
//
// Rodzaju zdarzenia protokół po skopiowaniu nie zdradza — ikony znikają i zostaje sama liczba.
// Ale zmiany mają cechę, której gole i kartki nie mają: w TEJ SAMEJ minucie schodzi zawodnik
// z jedenastki i wchodzi zawodnik z ławki. Parujemy je po minucie i stąd wiemy, kto ile zagrał.
// Liczba samotna — bez pary po drugiej stronie — to gol albo kartka i takiej NIE ruszamy.
//
// Wynik sprawdzamy sumą: jedenastu zawodników przez cały mecz to 990 minut. Jeśli suma się nie
// zgadza, parowanie zawiodło i wtedy NIE zapisujemy nic, zamiast wpisywać liczby, które wyglądają
// wiarygodnie i są zmyślone. Poprzednia wersja tego importu nie miała takiej kontroli i wpisywała
// rezerwowym odwrotność ich dorobku.
const DLUGOSC_MECZU = 90;

function parseLnpProtokolMinuty(rawText, nazwaKlubu){
  const zawodnicy = parseLnpProtokol(rawText, nazwaKlubu);
  if(!zawodnicy) return null;

  // Minuty zapisane przy każdym nazwisku — wyciągamy je ponownie, tym razem z przypisaniem.
  const linie = rawText.split('\n').map(l=>l.replace(/\s+/g,' ').trim());
  const bezOzdob = (l)=> l.replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').trim();
  const szukany = importNorm(nazwaKlubu);
  let od = -1;
  for(let i=0;i<linie.length;i++){
    if(importNorm(bezOzdob(linie[i])) === szukany && /skład wyjściowy/i.test(linie[i+1]||'')){ od = i; break; }
  }
  if(od < 0) return null;
  let doIdx = linie.findIndex((l,i)=> i>od && /^Sztab$/i.test(l));
  if(doIdx < 0) doIdx = linie.length;

  // Do każdego zawodnika dopisujemy minuty stojące pod jego nazwiskiem, aż do następnego numeru.
  const wgNazwiska = new Map(zawodnicy.map(z=>[importNorm(z.firstName+z.lastName), z]));
  let biezacy = null;
  for(let i=od+1;i<doIdx;i++){
    const l = bezOzdob(linie[i]);
    if(/^\d{1,2}$/.test(l)){ biezacy = null; continue; }
    const minuta = l.match(/^(\d{1,3})'(?:\s*\+\s*(\d+)')?$/);
    if(minuta && biezacy){ biezacy.minuty.push(minuta[2] ? `${minuta[1]}+${minuta[2]}` : minuta[1]); continue; }
    const czyste = l.replace(/\((?:M|B|C)\)/g,'').replace(/\s+/g,' ').trim();
    const trafiony = wgNazwiska.get(importNorm(czyste));
    if(trafiony){ trafiony.minuty = trafiony.minuty || []; biezacy = trafiony; }
  }

  // Parowanie zmian: w danej minucie tylu schodzi, ilu wchodzi.
  const wgMinuty = new Map();
  zawodnicy.forEach(z=>(z.minuty||[]).forEach(m=>{
    if(!wgMinuty.has(m)) wgMinuty.set(m, {z11:[], zLawki:[]});
    (z.rezerwa ? wgMinuty.get(m).zLawki : wgMinuty.get(m).z11).push(z);
  }));
  wgMinuty.forEach((grupa, m)=>{
    const par = Math.min(grupa.z11.length, grupa.zLawki.length);
    const minuta = parseInt(m,10);
    for(let i=0;i<par;i++){
      grupa.z11[i].zszedl = minuta;
      // Wchodzący bierze najwcześniejsze wejście — kolejne liczby przy jego nazwisku
      // to już zdarzenia z czasu, gdy był na boisku.
      if(grupa.zLawki[i].wszedl == null || minuta < grupa.zLawki[i].wszedl) grupa.zLawki[i].wszedl = minuta;
    }
  });

  const wynik = zawodnicy.map(z=>{
    const minuty = z.rezerwa
      ? (z.wszedl != null ? Math.max(0, DLUGOSC_MECZU - z.wszedl) : 0)
      : (z.zszedl != null ? z.zszedl : DLUGOSC_MECZU);
    return { ...z, minutyGry: minuty, zagral: minuty > 0 };
  });

  const suma = wynik.reduce((n,z)=>n+z.minutyGry, 0);
  const oczekiwana = 11 * DLUGOSC_MECZU;
  return { zawodnicy: wynik, suma, oczekiwana, zgodne: suma === oczekiwana };
}

// Nazwy obu drużyn z protokołu — stoją tuż przed „Skład wyjściowy".
function nazwyDruzynZProtokolu(rawText){
  const linie = rawText.split('\n').map(l=>l.replace(/\s+/g,' ').trim());
  const bez = (l)=> l.replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').trim();
  const out = [];
  linie.forEach((l,i)=>{
    if(!/skład wyjściowy/i.test(linie[i+1]||'')) return;
    const n = bez(l);
    if(n && !out.includes(n)) out.push(n);
  });
  return out;
}

// Tożsamość meczu — do pilnowania, żeby ten sam protokół wklejony dwa razy nie policzył
// dorobku podwójnie. Statystyki z protokołów SUMUJĄ SIĘ mecz po meczu, więc bez tego
// drugie kliknięcie podwoiłoby każdemu minuty.
const kluczProtokolu = (druzyny, rawText)=>{
  const data = (rawText.match(/(\d{1,2})\s+(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia)/i)||[]).slice(1).join(' ');
  return 'lnp|' + druzyny.map(importNorm).join('|') + (data ? '|'+importNorm(data) : '');
};

// Przetworzenie protokołu dla OBU drużyn naraz. Protokół sam podaje nazwy zespołów, więc
// nie trzeba wskazywać klubu — to jedno wklejenie zamiast dwóch.
function przetworzProtokolLnp(rawText){
  const druzyny = nazwyDruzynZProtokolu(rawText);
  if(druzyny.length < 1) return {blad:'W tej wklejce nie widzę sekcji „Skład wyjściowy" — to chyba nie jest protokół meczu.'};
  const klucz = kluczProtokolu(druzyny, rawText);
  const strony = [];

  for(const nazwa of druzyny){
    const dane = parseLnpProtokolMinuty(rawText, nazwa);
    if(!dane){ strony.push({nazwa, blad:'nie udało się odczytać składu'}); continue; }
    // Klub dopasowujemy po nazwie, z pominięciem polskich znaków i skrótów typu „KS".
    const n = importNorm(nazwa);
    let klub = DB.clubs.find(c=>importNorm(c.name)===n)
      || DB.clubs.find(c=>{ const a=importNorm(c.name); return a.length>=5 && n.length>=5 && (a.includes(n)||n.includes(a)); });
    if(!klub){ strony.push({nazwa, dane, blad:'nie ma takiego klubu w bazie'}); continue; }

    const wiersze = dane.zawodnicy.map(z=>{
      const zawodnik = DB.players.find(p=>p.clubId===klub.id
        && importNorm(p.firstName+p.lastName) === importNorm(z.firstName+z.lastName));
      const juzPoliczony = zawodnik && (zawodnik.rozliczoneMecze||[]).includes(klucz);
      return {...z, zawodnik, juzPoliczony};
    });
    strony.push({nazwa, klub, dane, wiersze});
  }
  return {klucz, druzyny, strony};
}

function parseSquadStatsText(text, squad){
  // Nazwiska w składach bywają skandynawskie, tureckie czy portugalskie (Håkans, Thórdarson,
  // Håkans), więc zamiast wyliczać znaki, rozkładamy je Unicode'em i zdejmujemy znaki diakrytyczne.
  // ł, ø i đ nie rozkładają się tą drogą — te trzy mapujemy ręcznie.
  const norm = (s)=> String(s||'').toLowerCase()
    .replace(/[łøđ]/g, c=>({'ł':'l','ø':'o','đ':'d'}[c]))
    .normalize('NFD').replace(/\p{M}/gu,'')
    .replace(/[^a-z]/g,'');
  // Dowolna litera Unicode — wcześniejsza lista pomijała np. „å", przez co „Håkans" rozpadało
  // się na „kans" i zawodnik nie był rozpoznawany.
  const WORDS = /[\p{L}'’-]{3,}/gu;

  // Przy wklejaniu dla CAŁEJ ligi pula liczy setki nazwisk i powtórki są nieuniknione
  // (dwóch Kowalskich w różnych klubach). Takiego wiersza nie zgadujemy — trafia do listy
  // niejednoznacznych, bo wpisanie minut nie temu zawodnikowi jest gorsze niż ich brak.
  const ambiguous = [];
  const playerInLine = (line)=>{
    const words = line.match(WORDS) || [];
    if(!words.length) return null;
    const hits = squad.filter(p=>{
      const last = norm(p.lastName);
      return last.length >= 3 && words.some(w=> norm(w) === last);
    });
    if(!hits.length) return null;
    if(hits.length > 1){
      // Spróbuj rozstrzygnąć imieniem, jeśli występuje w tej samej linii.
      const byFirst = hits.filter(p=> p.firstName && words.some(w=> norm(w) === norm(p.firstName)));
      if(byFirst.length === 1) return byFirst[0];
      ambiguous.push(hits[0].lastName + ' (' + hits.length + ' zawodników o tym nazwisku)');
      return null;
    }
    return hits[0];
  };

  // Układ kolumn na Transfermarkcie („Statystyki drużynowe" → Ogólnie) jest taki:
  //
  //   Wiek | Narodowość | W kadrze | Mecze | Gole | Minuty
  //
  // Pierwsza liczba po narodowości to „W KADRZE", a NIE mecze — i to był źródłem błędu: mecze
  // lądowały w golach, a „w kadrze" w meczach. Widać to na Gumnym: w kadrze 4, mecze 3, gole „–",
  // a system pokazywał 4 mecze i 3 gole.
  //
  // Czytamy pozycyjnie po ŻETONACH, nie po samych liczbach — kreska „–" oznacza zero/brak i musi
  // zajmować swoje miejsce w kolejności. Inaczej wiersz z kreską przy golach przesuwałby się o jedno.
  const statsFromLine = (line)=>{
    let tail = line;
    const words = [...line.matchAll(WORDS)];
    if(words.length){
      const last = words[words.length-1];
      tail = line.slice(last.index + last[0].length);
    }
    const minM = tail.match(/(\d[\d.]*)\s*['’]/);
    if(!minM){
      // BRAK MINUT NIE ZNACZY, ŻE WIERSZ JEST NIEWAŻNY.
      //
      // Transfermarkt pisze przy takich zawodnikach „Poza kadrą w tym sezonie" albo stawia kreski
      // — i to jest konkretna informacja: zero występów. Wcześniej odrzucaliśmy takie wiersze, przez
      // co na starcie sezonu, gdy prawie nikt jeszcze nie zagrał, import kończył się komunikatem
      // „nie dopasowałem żadnego wiersza". Zapisujemy zera tylko wtedy, gdy źródło WPROST mówi
      // o braku występów; przy samym braku liczb nadal nic nie zgadujemy.
      const brakWystepow = /poza kadr|nie by[łl] w kadrze|not in squad|kein einsatz/i.test(line)
        || /(^|\s)[-–—](\s+[-–—])+(\s|$)/.test(tail);
      if(!brakWystepow) return null;
      return { minutes: 0, matches: 0, goals: 0 };
    }
    const minutes = parseInt(minM[1].replace(/\./g,''), 10);
    if(isNaN(minutes)) return null;

    // Żetony przed minutami: liczba albo kreska (kreska = brak wartości, ale trzyma pozycję).
    const zetony = tail.slice(0, minM.index).trim().split(/\s+/).filter(Boolean)
      .map(z => /^[-–—]$/.test(z) ? null : (/^\d[\d.]*$/.test(z) ? parseInt(z.replace(/\./g,''),10) : undefined))
      .filter(z => z !== undefined);

    // [0] = w kadrze (pomijamy), [1] = mecze, [2] = gole. Tej kolumny asyst ten widok nie ma.
    // Kreska w kolumnie oznacza ZERO i zapisujemy ją jako 0, a nie jako „brak danych". Bez tego
    // wklejenie nie nadpisywało starej wartości i przy Gumnym zostawały gole z poprzedniego,
    // błędnego importu — mimo że na Transfermarkcie ma kreskę.
    const stats = { minutes };
    if(zetony.length >= 2) stats.matches = zetony[1] == null ? 0 : zetony[1];
    if(zetony.length >= 3) stats.goals   = zetony[2] == null ? 0 : zetony[2];
    // Gdy jest tylko jedna liczba, nie potrafimy odróżnić „w kadrze" od „mecze" — zostawiamy puste,
    // zamiast zapisywać zgadywaną wartość.
    return stats;
  };

  const results = [];
  const unmatched = [];
  const withoutStats = [];
  let current = null;

  for(const raw of text.split('\n')){
    const line = raw.replace(/\s+/g,' ').trim();
    if(!line) continue;

    const found = playerInLine(line);
    if(found && (!current || current.player !== found)){
      if(current && !current.stats) withoutStats.push(current.player.lastName);
      current = { player: found, stats: null };
      results.push(current);
      // Nazwisko i liczby bywają w JEDNEJ linii (węższy układ) — sprawdzamy od razu.
      const inline = statsFromLine(line);
      if(inline) current.stats = inline;
      continue;
    }

    if(current && !current.stats){
      const s = statsFromLine(line);
      if(s) current.stats = s;
      continue;
    }
    // Linia przed pierwszym rozpoznanym zawodnikiem albo należąca do kogoś spoza składu.
    if(!current && /['’]/.test(line)) unmatched.push(line.slice(0,44));
  }
  if(current && !current.stats) withoutStats.push(current.player.lastName);

  return {
    results: results.filter(r=>r.stats).map(r=>({player: r.player, stats: r.stats})),
    unmatched,
    withoutStats,
    ambiguous: [...new Set(ambiguous)],
  };
}

// Rozpoznanie protokołu meczowego wklejonego do okna statystyk drużyny/ligi.
//
// Te okna oczekują tabeli „Statystyki drużynowe" z Transfermarktu, gdzie liczba z apostrofem to
// MINUTY GRY. W protokole meczowym liczba z apostrofem znaczy co innego — MINUTĘ ZDARZENIA — więc
// parser wpisywał rezerwowym odwrotność ich dorobku (wszedł w 81' → zapisywał 81 zamiast 9) i
// zakładał osobny wiersz na każde zdarzenie tego samego zawodnika. Wynik wyglądał wiarygodnie
// i był nieprawdziwy, dlatego taki tekst odrzucamy, zamiast go interpretować.
//
// Typ zdarzenia (gol, kartka, zmiana) jest na stronie IKONĄ bez tekstu — po skopiowaniu zostają
// same liczby, więc goli i kartek nie da się z tej wklejki odzyskać żadnym parserem. Właściwa
// droga to przycisk „⏱ Statystyki z 90minut" w widoku klubu, który pobiera liczby z serwera.
function wygladaNaProtokolMeczu(text){
  const t = String(text || '');
  if(/^###\s*PROTOKOL:/im.test(t)) return true;
  const sygnaly = [
    /sk[łl]ad\s+wyj[śs]ciowy/i,
    /sk[łl]ad\s+rezerwowy/i,
    /przebieg\s+spotkania/i,
    /wynik\s+do\s+przerwy/i,
    /asystent\s+trenera|trener\s+bramkarzy|kierownik\s+dru[żz]yny/i,
  ].filter(re => re.test(t)).length;
  // Dwa niezależne sygnały — pojedynczy mógłby paść przypadkiem w zwykłej tabeli statystyk.
  return sygnaly >= 2;
}

function komunikatOProtokole(){
  return `<div class="empty" style="text-align:left;padding:14px;">
    <strong style="color:var(--clay-dark);">To jest protokół meczowy, a nie tabela statystyk.</strong>
    <p style="margin:8px 0 0;">Liczby z apostrofem znaczą tu <strong>minutę zdarzenia</strong>, a nie minuty gry.
    Rezerwowy, który wszedł w 81', ma za sobą 9 minut, a nie 81 — gdybym to wczytał, zapisałbym odwrotność.</p>
    <p style="margin:8px 0 0;">Goli i kartek w tej wklejce nie ma wcale: na stronie są ikonami bez tekstu,
    więc kopiowanie zostawia same liczby.</p>
    <p style="margin:8px 0 0;">Zamiast tego wejdź w <strong>klub</strong> i kliknij <strong>⏱ Statystyki z 90minut</strong> —
    liczby pobierane są z serwera, razem z minutami, bramkami i kartkami. Nic nie trzeba kopiować.</p>
  </div>`;
}

// Link do strony ze statystykami drużyny na Transfermarkt. Gdy klub ma zapisany profil, zamieniamy
// w nim zakładkę na „Statystyki drużynowe" (/leistungsdaten/) — to jedyna, która podaje minuty.
// Bez zapisanego profilu kierujemy do wyszukiwarki po nazwie klubu.
function tmStatsLink(club){
  const tm = club.profileTm || '';
  if(/transfermarkt\.[a-z.]+\/.+\/verein\/\d+/i.test(tm)){
    return tm.replace(/\/(startseite|kader|spielplan)\/verein\//i, '/leistungsdaten/verein/');
  }
  return 'https://www.transfermarkt.pl/schnellsuche/ergebnis/schnellsuche?query=' + encodeURIComponent(club.name||'');
}

// Wklejanie statystyk dla CAŁEJ ligi w jednym oknie. Przy 18 klubach Ekstraklasy (a dojdzie
// jeszcze III liga) otwieranie osobnego okna dla każdego klubu było najdroższą częścią pracy.
// Nazwiska dopasowujemy do puli wszystkich zawodników ligi, więc nie trzeba wskazywać klubu —
// wklejasz tabele jedna po drugiej, choćby wszystkie naraz.
// Skryptozakładka ("bookmarklet") do Transfermarktu. Statystyki są tam rysowane JavaScriptem, więc
// serwer ich nie pobierze — ale w TWOJEJ przeglądarce, na otwartej stronie, są już gotowe. Ten
// skrypt czyta tekst strony i wrzuca do schowka, zastępując zaznaczanie myszą. To nie jest
// obchodzenie zabezpieczeń: czyta wyłącznie to, co i tak masz przed sobą, na stronie, którą
// normalnie odwiedzasz. Świadomie NIE chodzi po innych podstronach — automatyczne przemierzanie
// serwisu łamałoby jego regulamin.
//
// Czytamy cały tekst strony, a nie konkretną tabelę: układ HTML Transfermarktu może się zmienić,
// a parser i tak pomija wszystko, w czym nie rozpozna nazwiska ze składu.
// Zakładka ZBIERA kolejne kluby, zamiast nadpisywać schowek. Każde kliknięcie dokłada tabelę do
// pamięci przeglądarki (localStorage na domenie Transfermarktu) i od razu wrzuca do schowka CAŁY
// zebrany zestaw. Dzięki temu po przejściu całej ligi wklejasz RAZ, a nie osiemnaście razy.
// Shift+klik czyści zebrane dane i zaczyna od nowa.
//
// Świadomie nie chodzi po stronach samodzielnie — automatyczne przemierzanie serwisu łamałoby
// jego regulamin. Czyta wyłącznie stronę, którą masz otwartą.
const TM_BOOKMARKLET = `javascript:(function(){try{
var K='sbs_zebrane';
if(window.event&&window.event.shiftKey){localStorage.removeItem(K);alert('SBS: wyczyszczono zebrane kluby.');return;}
var u=location.href;
if(/\\/verein\\/\\d+/.test(u)&&!/\\/leistungsdaten\\//.test(u)){
location.href=u.replace(/\\/(startseite|kader|spielplan|leistungsdaten)\\/verein\\//,'/leistungsdaten/verein/').replace(/\\/verein\\//,'/leistungsdaten/verein/').replace(/\\/leistungsdaten\\/leistungsdaten\\//,'/leistungsdaten/');
return;}
if(!/\\/leistungsdaten\\//.test(u)){alert('SBS: to nie jest strona klubu na Transfermarkcie.\\n\\nOtworz klub, a potem kliknij te zakladke ponownie.');return;}
var best=null,n=0;var ts=document.querySelectorAll('table');
for(var i=0;i<ts.length;i++){var r=ts[i].rows.length;if(r>n){n=r;best=ts[i];}}
var t=(best&&n>4)?best.innerText:document.body.innerText;
if(!/\\d\\s*['’]/.test(t)){alert('SBS: na tej stronie nie ma minut.\\n\\nUpewnij sie, ze u gory wybrales sezon i rozgrywki (np. \\u201eLacznie 26/27\\u201d).');return;}
var nazwa=(document.title||'klub').split(' - ')[0];
var stare=localStorage.getItem(K)||'';
if(stare.indexOf('### '+nazwa+' ###')>=0){alert('SBS: '+nazwa+' jest juz zebrany — pomijam, zeby nie dublowac.');return;}
var caly=stare+(stare?'\\n\\n':'')+'### '+nazwa+' ###\\n'+t;
localStorage.setItem(K,caly);
var ile=(caly.match(/### /g)||[]).length;
navigator.clipboard.writeText(caly).then(function(){
var d=document.createElement('div');
d.innerHTML='<b>SBS: dodano '+nazwa+'</b><br>zebrane kluby: '+ile+' — schowek gotowy do wklejenia<br><span style="opacity:.75;font-weight:400">Shift+klik = wyczysc zebrane</span>';
d.style.cssText='position:fixed;top:16px;right:16px;z-index:999999;background:#16302A;color:#C69B3C;padding:12px 18px;border-radius:8px;font:600 13px sans-serif;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.3)';
document.body.appendChild(d);setTimeout(function(){d.remove()},3200);
}).catch(function(e){alert('Nie udało się skopiować: '+e.message)})}catch(e){alert('Błąd: '+e.message)}})();`;

// Zakładka do zbierania MENEDŻERÓW z profili zawodników na Transfermarkcie.
//
// Osobna od tej do statystyk, bo pole „Doradca" jest tylko na profilu pojedynczego zawodnika
// (/profil/spieler/…), a nie na stronie klubu ze statystykami drużynowymi. Zbiera do tego samego
// rodzaju bufora co tamta: wchodzisz na profil, klikasz, i tak przez całą listę — a na końcu
// wklejasz wszystko naraz.
//
// Etykieta pola różni się między wersjami językowymi i zmienia się w czasie — na polskiej stronie
// jest to „Menadżerowie:", nie „Doradca". Dlatego nie szukamy jednego napisu w tekście strony,
// tylko chodzimy po DOM: znajdujemy komórkę-etykietę pasującą do wzorca i bierzemy sąsiada obok.
// Nazwę agencji czytamy z atrybutu `title` odnośnika, bo widoczny tekst bywa ucięty wielokropkiem
// („BMS Sportconsulting …") — a przy okazji mamy adres strony agencji.
//
// UWAGA merytoryczna, zapisana też w oknie importu: brak doradcy na Transfermarkcie NIE znaczy,
// że zawodnik nie ma menedżera. To pole bywa tam nieuzupełnione, zwłaszcza u młodzieży. Dlatego
// skrypt zapisuje „AGENT: -", a aplikacja odnotowuje wtedy tylko fakt sprawdzenia — nigdy nie
// ustawia „nie ma agenta" na tej podstawie.
const TM_AGENT_BOOKMARKLET = `javascript:(function(){try{
var K='sbs_agenci';
if(window.event&&window.event.shiftKey){localStorage.removeItem(K);alert('SBS: wyczyszczono zebranych zawodnikow.');return;}
var u=location.href;
if(!/\\/profil\\/spieler\\/\\d+/.test(u)){alert('SBS: to nie jest profil zawodnika na Transfermarkcie.\\n\\nOtworz profil zawodnika (adres z \\u201e/profil/spieler/\\u201d) i kliknij ponownie.');return;}
var imie=(document.title||'').split(' - ')[0].replace(/\\s+/g,' ').trim();
if(!imie){alert('SBS: nie odczytalem nazwiska z tej strony.');return;}
function pole(ok){
var n=document.querySelectorAll('span,th,td,dt,div');
for(var i=0;i<n.length;i++){var e=n[i];
if(e.children.length)continue;
var t=(e.textContent||'').replace(/\\u00a0/g,' ').trim();
if(!t||t.length>34||t.charAt(t.length-1)!==':')continue;
var k=t.toLowerCase().replace(/\\u0142/g,'l').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z]/g,'');
if(!ok(k))continue;
var v=e.nextElementSibling;if(!v)continue;
var a=v.querySelector('a')||(v.tagName==='A'?v:null);
var nazwa=a?((a.getAttribute('title')||a.textContent||'').trim()):((v.textContent||'').replace(/\\u00a0/g,' ').trim());
nazwa=nazwa.replace(/[\\s.\\u2026]+$/,'').trim();
if(nazwa)return{nazwa:nazwa,link:(a&&a.href)?a.href:''};}
return null;}
var ETYKIETY=['menadzerowie','menedzerowie','menadzer','menedzer','doradca','doradcy','berater','spielerberater','playeragent','agent','agents','advisor'];
var ag=pole(function(k){return ETYKIETY.indexOf(k)>=0;});
var agent=ag?ag.nazwa:'';var agLink=ag?ag.link:'';
if(/^(brak|-|\\u2013|\\u2014|unknown|k\\.A\\.)$/i.test(agent)){agent='';agLink='';}
var ur=pole(function(k){return k.indexOf('urodz')===0||k.indexOf('dataurodzenia')===0||k.indexOf('geb')===0||k.indexOf('dateofbirth')===0;});
var rok='';
if(ur){var mu=ur.nazwa.match(/(\\d{4})/);if(mu)rok=mu[1];}
if(!rok){var mt=document.body.innerText.replace(/\\u00a0/g,' ').match(/(?:Urodz|Data urodzenia|Geb\\.|Date of birth)[^\\n]*?(\\d{4})/i);if(mt)rok=mt[1];}
var wpis='### '+imie+' ###\\nROK: '+rok+'\\nAGENT: '+(agent||'-')+(agLink?'\\nLINK: '+agLink:'');
var stare=localStorage.getItem(K)||'';
if(stare.indexOf('### '+imie+' ###')>=0){alert('SBS: '+imie+' jest juz zebrany — pomijam, zeby nie dublowac.');return;}
var caly=stare+(stare?'\\n\\n':'')+wpis;
localStorage.setItem(K,caly);
var ile=(caly.match(/### /g)||[]).length;
navigator.clipboard.writeText(caly).then(function(){
var d=document.createElement('div');
d.innerHTML='<b>SBS: '+imie+'</b><br>menedzer: '+(agent||'Transfermarkt nie podaje')+'<br>zebranych: '+ile+' — schowek gotowy<br><span style="opacity:.75;font-weight:400">Shift+klik = wyczysc zebrane</span>';
d.style.cssText='position:fixed;top:16px;right:16px;z-index:999999;background:#16302A;color:#C69B3C;padding:12px 18px;border-radius:8px;font:600 13px sans-serif;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.3)';
document.body.appendChild(d);setTimeout(function(){d.remove()},3200);
}).catch(function(e){alert('Nie udalo sie skopiowac: '+e.message)})}catch(e){alert('Blad: '+e.message)}})();`;

// Zakładka do zbierania CAŁEJ LISTY AGENCJI z Transfermarktu (Zapoznaj się → Agencje, wybór kraju).
// Lista jest podzielona na strony — bufor sumuje się między nimi, więc przechodzisz stronę po
// stronie, klikając zakładkę na każdej, a na końcu wklejasz wszystko naraz.
//
// Wiersz tabeli czytamy przez odnośnik do profilu agencji (/beraterfirma/berater/…), bo to jedyny
// element o stałym kształcie. Reszta kolumn bywa przestawiana, dlatego liczby bierzemy „po
// znaczeniu": pierwsza komórka będąca samą liczbą to liczba zawodników, pierwsza z symbolem euro
// to wartość rynkowa. Sztywne numery kolumn rozjechałyby się przy najbliższej zmianie serwisu.
//
// Bufor ODŚWIEŻA wiersze, a nie tylko dopisuje nowe. Pierwsza wersja pomijała agencję, której
// adres już w buforze był — więc gdy zbierało się listę zepsutą wersją skryptu, ponowne przejście
// stron niczego nie naprawiało: poprawione wiersze były „już zebrane" i wypadały. Teraz wiersz o
// tym samym adresie zastępuje poprzedni, zachowując kolejność zbierania.
//
// UWAGA na zagnieżdżenie: Transfermarkt wkłada w pierwszą komórkę OSOBNĄ tabelkę (logo, nazwa,
// kraj, znaczek LICENSED). closest('tr') trafia więc w jej wiersz, w którym liczb nie ma wcale —
// pierwsza wersja zbierała przez to same nazwy z pustym krajem, liczbą zawodników i wartością.
// Dlatego wspinamy się do NAJBARDZIEJ ZEWNĘTRZNEGO wiersza, a przy czytaniu liczb pomijamy
// komórki zawierające zagnieżdżoną tabelę — inaczej wpadłby nam tekst z tamtej tabelki.
const TM_AGENCIES_BOOKMARKLET = `javascript:(function(){try{
var K='sbs_agencje';
if(window.event&&window.event.shiftKey){localStorage.removeItem(K);alert('SBS: wyczyszczono zebrane agencje.');return;}
var linki=document.querySelectorAll('a[href*="/beraterfirma/berater/"]');
if(!linki.length){alert('SBS: nie widze tu listy agencji.\\n\\nOtworz Transfermarkt \\u2192 Zapoznaj sie \\u2192 Agencje, wybierz kraj i kliknij ponownie.');return;}
var widziane={},wiersze=[];
for(var i=0;i<linki.length;i++){
var a=linki[i];
var nazwa=(a.getAttribute('title')||a.textContent||'').replace(/\\s+/g,' ').trim();
if(!nazwa||nazwa.length<2)continue;
var href=a.href;
if(widziane[href])continue;
var tr=a.closest('tr');if(!tr)continue;
var wyzej;
while((wyzej=tr.parentElement&&tr.parentElement.closest('tr')))tr=wyzej;
widziane[href]=1;
var kraj='';
var flaga=tr.querySelector('img.flaggenrahmen,img[class*="flagge"]');
if(flaga)kraj=(flaga.getAttribute('title')||flaga.getAttribute('alt')||'').trim();
var lic=/licensed/i.test(tr.textContent||'')?'tak':'nie';
var logo='';
var im=tr.querySelectorAll('img');
for(var q=0;q<im.length;q++){
var s=im[q].getAttribute('src')||'';
if(!/^https?:/i.test(s))continue;
if(/flagge|flaggen|\\/verifiziert|default|platzhalter|blank|nologo|dummy/i.test(s))continue;
logo=s;break;}
var td=tr.querySelectorAll('td'),zaw='',wart='';
for(var j=0;j<td.length;j++){
if(td[j].querySelector('table,td'))continue;
var t=(td[j].textContent||'').replace(/\\u00a0/g,' ').trim();
if(!zaw&&/^\\d{1,5}$/.test(t))zaw=t;
if(!wart&&t.indexOf('\\u20ac')>=0)wart=t;}
wiersze.push(nazwa+' | '+href+' | '+kraj+' | '+zaw+' | '+wart+' | '+lic+' | '+logo);}
if(!wiersze.length){alert('SBS: znalazlem odnosniki, ale nie umialem odczytac wierszy tabeli.');return;}
var stare=(localStorage.getItem(K)||'').split('\\n').filter(function(x){return x.trim()});
var poAdresie={},kolejnosc=[];
for(var s=0;s<stare.length;s++){var ad=stare[s].split(' | ')[1];if(!ad)continue;if(!poAdresie[ad])kolejnosc.push(ad);poAdresie[ad]=stare[s];}
var nowe=0,odswiezone=0;
for(var k=0;k<wiersze.length;k++){
var adres=wiersze[k].split(' | ')[1];
if(poAdresie[adres]){if(poAdresie[adres]!==wiersze[k])odswiezone++;}
else{kolejnosc.push(adres);nowe++;}
poAdresie[adres]=wiersze[k];}
var lista=[];for(var m=0;m<kolejnosc.length;m++)lista.push(poAdresie[kolejnosc[m]]);
var caly=lista.join('\\n');
if(!nowe&&!odswiezone){alert('SBS: wszystkie '+wiersze.length+' agencji z tej strony mam juz w buforze, i to z tymi samymi danymi.');return;}
localStorage.setItem(K,caly);
var ile=lista.length;
navigator.clipboard.writeText(caly).then(function(){
var d=document.createElement('div');
d.innerHTML='<b>SBS: nowych '+nowe+' agencji</b>'+(odswiezone?'<br>odswiezono danych: '+odswiezone:'')+'<br>w buforze: '+ile+' \\u2014 schowek gotowy<br><span style="opacity:.75;font-weight:400">Przejdz na kolejna strone i kliknij ponownie<br>Shift+klik = wyczysc bufor</span>';
d.style.cssText='position:fixed;top:16px;right:16px;z-index:999999;background:#16302A;color:#C69B3C;padding:12px 18px;border-radius:8px;font:600 13px sans-serif;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.3)';
document.body.appendChild(d);setTimeout(function(){d.remove()},3600);
}).catch(function(e){alert('Nie udalo sie skopiowac: '+e.message)})}catch(e){alert('Blad: '+e.message)}})();`;

// Zakładka do zbierania PRACOWNIKÓW agencji — sekcja „Pracownicy" na profilu agencji wymienia
// osoby, z którymi faktycznie się rozmawia. To jedyne miejsce, gdzie Transfermarkt podaje ludzi,
// a nie samą firmę; wszystko inne (telefon, mail, licencja) i tak dopisujesz sam.
const TM_AGENCY_STAFF_BOOKMARKLET = `javascript:(function(){try{
var u=location.href;
if(!/\\/berater\\/\\d+/.test(u)){alert('SBS: to nie jest profil agencji.\\n\\nOtworz strone agencji na Transfermarkcie i kliknij ponownie.');return;}
var agencja=(document.title||'').split(/ - |\\|/)[0].replace(/\\s+/g,' ').trim();
var osoby=[],widziane={};
var linki=document.querySelectorAll('a[href*="/beraterberater/"],a[href*="/mitarbeiter/"],a[href*="/berater/mitarbeiter/"]');
for(var i=0;i<linki.length;i++){
var n=(linki[i].getAttribute('title')||linki[i].textContent||'').replace(/\\s+/g,' ').trim();
if(!n||n.length<4||n.length>50)continue;
if(widziane[n.toLowerCase()])continue;widziane[n.toLowerCase()]=1;
osoby.push(n);}
if(!osoby.length){
// Zapasowo: sekcja „Pracownicy" bywa zwyklym blokiem bez odnosnikow — bierzemy z niej wiersze,
// ktore wygladaja na imie i nazwisko (dwa lub trzy slowa z wielkiej litery, bez cyfr).
var bloki=document.querySelectorAll('div,section,aside,table');
for(var b=0;b<bloki.length;b++){
var nag=(bloki[b].textContent||'').slice(0,40);
if(!/pracownic|mitarbeiter|staff/i.test(nag))continue;
var linie=(bloki[b].innerText||'').split('\\n').map(function(x){return x.trim()}).filter(Boolean);
for(var l=0;l<linie.length;l++){
var t=linie[l];
if(/pracownic|mitarbeiter|staff/i.test(t))continue;
if(t.length<4||t.length>50||/\\d|@|\\u20ac/.test(t))continue;
if(!/^[A-Z\\u0104\\u0106\\u0118\\u0141\\u0143\\u00d3\\u015a\\u0179\\u017b][^ ]+( [A-Z\\u0104\\u0106\\u0118\\u0141\\u0143\\u00d3\\u015a\\u0179\\u017b][^ ]+){1,2}$/.test(t))continue;
if(widziane[t.toLowerCase()])continue;widziane[t.toLowerCase()]=1;
osoby.push(t);}
if(osoby.length)break;}}
if(!osoby.length){alert('SBS: nie znalazlem sekcji Pracownicy na tej stronie.\\n\\nMozesz wpisac nazwiska recznie w oknie w SBS — po jednym w linijce.');return;}
// Numer i mail z bloku CONTACT to jedyne dane kontaktowe, jakie Transfermarkt podaje — i sa
// wspolne dla calej agencji, nie dla poszczegolnych osob. Dopisujemy je do naglowka, zeby SBS
// mogl nimi podstawic puste pola przy menedzerach.
var tel='',mail='';
var wszystkie=document.querySelectorAll('td,span,div,dt,th');
for(var t2=0;t2<wszystkie.length;t2++){
var e2=wszystkie[t2];
if(e2.children.length)continue;
var et=(e2.textContent||'').replace(/\\u00a0/g,' ').trim();
if(!et||et.length>20)continue;
var kk=et.toLowerCase().replace(/[^a-z]/g,'');
if(kk!=='telefon'&&kk!=='email'&&kk!=='emailadres')continue;
var v2=e2.nextElementSibling;if(!v2)continue;
var vt=(v2.textContent||'').replace(/\\u00a0/g,' ').trim();
if(!vt||vt==='-')continue;
if(kk==='telefon'&&!tel)tel=vt;
if(kk!=='telefon'&&!mail&&vt.indexOf('@')>=0)mail=vt;}
var caly='### PRACOWNICY: '+agencja+' | '+u+(tel?' | TEL:'+tel:'')+(mail?' | MAIL:'+mail:'')+' ###\\n'+osoby.join('\\n');
navigator.clipboard.writeText(caly).then(function(){
var d=document.createElement('div');
d.innerHTML='<b>SBS: '+agencja+'</b><br>pracownikow: '+osoby.length+' \\u2014 schowek gotowy<br><span style="opacity:.75;font-weight:400">Wklej w oknie „Wgraj menedzerow" w SBS</span>';
d.style.cssText='position:fixed;top:16px;right:16px;z-index:999999;background:#16302A;color:#C69B3C;padding:12px 18px;border-radius:8px;font:600 13px sans-serif;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.3)';
document.body.appendChild(d);setTimeout(function(){d.remove()},3600);
}).catch(function(e){alert('Nie udalo sie skopiowac: '+e.message)})}catch(e){alert('Blad: '+e.message)}})();`;

// Rozbiór listy menedżerów. Przyjmuje i wklejkę z zakładki, i zwykłą listę nazwisk wpisaną ręcznie
// — po jednym w linijce, opcjonalnie z e-mailem i telefonem po pionowej kresce.
function parseMenedzerowieWklejka(text){
  const wynik = [];
  // Kontakt agencji wyłuskany z nagłówka — podstawiany osobom, które nie mają własnego numeru.
  let telAgencji = '', mailAgencji = '';
  const naglowek = String(text||'').split(/\r?\n/).find(l=>/^###/.test(l.trim()));
  if(naglowek){
    const mt = naglowek.match(/TEL:\s*([^|#]+)/i);   if(mt) telAgencji = mt[1].trim();
    const mm = naglowek.match(/MAIL:\s*([^|#\s]+)/i); if(mm) mailAgencji = mm[1].trim();
  }
  (wynik as any).telAgencji = telAgencji;
  (wynik as any).mailAgencji = mailAgencji;
  // Czytamy BLOKAMI, nie linijka po linijce. Na profilu agencji dane kontaktowe stoją pod
  // nazwiskiem, w osobnych wierszach („Tel.: +48…", „E-mail : ktos@…"), więc przypisujemy je
  // do ostatniej rozpoznanej osoby. Wcześniej każda linijka była oceniana samodzielnie i telefony
  // po prostu przepadały.
  const oczyscKontakt = (s)=> String(s||'').replace(/^[\s:.]+/, '').trim();
  String(text||'').split(/\r?\n/).forEach(l=>{
    let s = l.trim();
    if(!s || /^###/.test(s)) return;
    const ostatni = wynik.length ? wynik[wynik.length-1] : null;

    // Wiersze kontaktowe — z etykietą albo bez.
    const mTel = s.match(/^tel\.?\s*:?\s*(.+)$/i) || s.match(/^(?:telefon|phone)\s*:?\s*(.+)$/i);
    if(mTel){ if(ostatni && !ostatni.phone) ostatni.phone = oczyscKontakt(mTel[1]); return; }
    const mMail = s.match(/^e-?\s?mail\s*:?\s*(.+)$/i);
    if(mMail){ if(ostatni && !ostatni.email) ostatni.email = oczyscKontakt(mMail[1]); return; }
    if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)){ if(ostatni && !ostatni.email) ostatni.email = s; return; }
    if(/^[+\d][\d\s()-]{6,}$/.test(s)){ if(ostatni && !ostatni.phone) ostatni.phone = s; return; }

    // Wiersz z nazwiskiem. Kontakt może też stać po pionowej kresce — obsługujemy oba zapisy.
    const cz = s.split('|').map(x=>x.trim());
    let pelne = cz[0];
    if(!pelne) return;
    // Ozdobniki listy na początku („- Arkadiusz Głowacki") i śmieci na końcu („(Agent) -").
    pelne = pelne.replace(/^[-–—•·*\s]+/, '').replace(/[-–—,;.\s]+$/, '').trim();
    // Rola stoi w nawiasie na końcu: „(Agent)", „(Owner)", „(Head of Scouting)".
    let role = '';
    const mr = pelne.match(/\(([^)]{2,40})\)\s*$/);
    if(mr){ role = mr[1].trim(); pelne = pelne.slice(0, mr.index).trim(); }
    // Znacznik licencji jest osobną plakietką na stronie i wchodził w środek nazwiska.
    let licensed = false;
    if(/\blicensed\b/i.test(pelne)){ licensed = true; pelne = pelne.replace(/\blicensed\b/ig, ' '); }
    pelne = pelne.replace(/\s+/g,' ').replace(/[-–—,;.\s]+$/,'').trim();
    if(!pelne || pelne.length < 4 || pelne.length > 60) return;
    if(/\d|@/.test(pelne)) return;                    // to nie nazwisko, tylko kontakt
    const slowa = pelne.split(/\s+/).filter(Boolean);
    if(slowa.length < 2) return;                      // samo imię (albo „Polska") to nie osoba
    wynik.push({
      firstName: slowa[0],
      lastName: slowa.slice(1).join(' '),
      role, licensed,
      email: cz.find(x=>x.includes('@')) || '',
      phone: cz.find(x=>/^[+\d][\d\s()-]{6,}$/.test(x)) || '',
    });
  });
  return wynik;
}

// Zakładka do zbierania REPREZENTOWANYCH ZAWODNIKÓW z profilu jednej agencji.
// Profil agencji ma tabelę „Reprezentowani zawodnicy" — zawodnika rozpoznajemy po odnośniku do
// jego profilu (/profil/spieler/…), tak samo jak agencję rozpoznajemy po /beraterfirma/berater/.
// Nazwę agencji bierzemy z tytułu strony, a jej adres wprost z paska — dzięki temu wklejka wie,
// do której agencji należy, i nie trzeba tego wybierać ręcznie.
const TM_AGENCY_SQUAD_BOOKMARKLET = `javascript:(function(){try{
var K='sbs_sklad_agencji';
if(window.event&&window.event.shiftKey){localStorage.removeItem(K);alert('SBS: wyczyszczono zebrany sklad.');return;}
var u=location.href;
if(!/\\/beraterfirma\\/berater\\/\\d+/.test(u)&&!/\\/berater\\/\\d+/.test(u)){alert('SBS: to nie jest profil agencji.\\n\\nOtworz strone agencji na Transfermarkcie (adres z \\u201e/beraterfirma/berater/\\u201d) i kliknij ponownie.');return;}
var idAg=((u.match(/\\/berater\\/(\\d+)/)||[])[1])||'';
var agencja=(document.title||'').split(/ - |\\|/)[0].replace(/\\s+/g,' ').trim();
var linki=document.querySelectorAll('a[href*="/profil/spieler/"]');
if(!linki.length){alert('SBS: nie widze tabeli reprezentowanych zawodnikow na tej stronie.');return;}
var widziane={},wiersze=[];
for(var i=0;i<linki.length;i++){
var a=linki[i];
var nazwa=(a.getAttribute('title')||a.textContent||'').replace(/\\s+/g,' ').trim();
if(!nazwa||nazwa.length<3||nazwa.length>60)continue;
var href=a.href.split('?')[0];
if(widziane[href])continue;
widziane[href]=1;
var tr=a.closest('tr');
var wiek='',klub='',wart='',poz='';
if(tr){
var wyzej;
while((wyzej=tr.parentElement&&tr.parentElement.closest('tr')))tr=wyzej;
var kl=tr.querySelector('a[href*="/verein/"]');
if(kl){
klub=(kl.getAttribute('title')||'').replace(/\\s+/g,' ').trim();
if(!klub){var im2=kl.querySelector('img');if(im2)klub=(im2.getAttribute('title')||im2.getAttribute('alt')||'').replace(/\\s+/g,' ').trim();}
if(!klub)klub=(kl.textContent||'').replace(/\\s+/g,' ').trim();}
if(!klub){var ki=tr.querySelector('img[class*="wappen"],img[src*="wappen"],img[src*="vereinslogo"]');
if(ki)klub=(ki.getAttribute('title')||ki.getAttribute('alt')||'').replace(/\\s+/g,' ').trim();}
var kom=a.closest('td');
if(kom){
var wyzejK;
while((wyzejK=kom.parentElement&&kom.parentElement.closest('td')))kom=wyzejK;
var lisc=kom.querySelectorAll('*');
for(var z=0;z<lisc.length;z++){
if(lisc[z].children.length)continue;
var tx=(lisc[z].textContent||'').replace(/\\s+/g,' ').trim();
if(!tx||tx===nazwa)continue;
if(tx.length<3||tx.length>32)continue;
if(/\\d|@|\\u20ac/.test(tx))continue;
poz=tx;break;}}
var td=tr.querySelectorAll('td');
for(var j=0;j<td.length;j++){
if(td[j].querySelector('table,td'))continue;
var t=(td[j].textContent||'').replace(/\\u00a0/g,' ').trim();
if(!wiek&&/^\\d{2}$/.test(t))wiek=t;
if(!wart&&t.indexOf('\\u20ac')>=0)wart=t;}}
wiersze.push(nazwa+' | '+wiek+' | '+klub+' | '+poz+' | '+wart);}
if(!wiersze.length){alert('SBS: znalazlem odnosniki do zawodnikow, ale nie umialem odczytac wierszy.');return;}
var naglowek='### AGENCJA: '+agencja+' | '+u+' | ID:'+idAg+' ###';
var stare=(localStorage.getItem(K)||'').split('\\n').filter(function(x){return x.trim()});
if(stare.length&&stare[0].indexOf('ID:'+idAg+' ')<0){
if(!confirm('SBS: w buforze masz sklad innej agencji ('+stare[0].replace(/^### AGENCJA: /,'').split(' | ')[0]+').\\n\\nOK = zaczynam zbierac te agencje od nowa.\\nAnuluj = nie ruszam bufora.'))return;
stare=[];}
var poNazwie={},kolejnosc=[];
for(var s=1;s<stare.length;s++){var kl2=stare[s].split(' | ')[0];if(!kl2)continue;if(!poNazwie[kl2])kolejnosc.push(kl2);poNazwie[kl2]=stare[s];}
var nowych=0;
for(var k=0;k<wiersze.length;k++){var kl3=wiersze[k].split(' | ')[0];
if(!poNazwie[kl3]){kolejnosc.push(kl3);nowych++;}
poNazwie[kl3]=wiersze[k];}
var lista=[];for(var m=0;m<kolejnosc.length;m++)lista.push(poNazwie[kolejnosc[m]]);
var caly=naglowek+'\\n'+lista.join('\\n');
localStorage.setItem(K,caly);
var ile=lista.length;
navigator.clipboard.writeText(caly).then(function(){
var d=document.createElement('div');
d.innerHTML='<b>SBS: '+agencja+'</b><br>z tej strony nowych: '+nowych+'<br>w buforze: '+ile+' \\u2014 schowek gotowy<br><span style="opacity:.75;font-weight:400">Przejdz na kolejna strone i kliknij ponownie<br>Shift+klik = wyczysc bufor</span>';
d.style.cssText='position:fixed;top:16px;right:16px;z-index:999999;background:#16302A;color:#C69B3C;padding:12px 18px;border-radius:8px;font:600 13px sans-serif;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.3)';
document.body.appendChild(d);setTimeout(function(){d.remove()},3600);
}).catch(function(e){alert('Nie udalo sie skopiowac: '+e.message)})}catch(e){alert('Blad: '+e.message)}})();`;

// Klub z Transfermarktu -> klub w naszej bazie. To jednocześnie nasz sprawdzian „czy gra w Polsce":
// baza zawiera wyłącznie polskie rozgrywki, więc trafienie w klub oznacza polską ligę. Nazwy bywają
// zapisane inaczej („Bruk-Bet Termalica Nieciecza" vs „Termalica Nieciecza"), stąd dopasowanie
// dokładne, a potem zawieranie — ale tylko przy nazwach dość długich, by nie łączyć przypadkiem.
function znajdzKlubPoNazwieTM(nazwaTM){
  const n = importNorm(nazwaTM);
  if(!n || n.length < 3) return null;
  const dokladny = DB.clubs.find(c=> importNorm(c.name) === n);
  if(dokladny) return dokladny;
  const kandydaci = DB.clubs.filter(c=>{
    const cn = importNorm(c.name);
    if(cn.length < 5 || n.length < 5) return false;
    return cn.includes(n) || n.includes(cn);
  });
  // Przy kilku pasujących nie zgadujemy — „Zagłębie" pasowałoby i do Lubina, i do Sosnowca.
  return kandydaci.length === 1 ? kandydaci[0] : null;
}

// Rozbiór wklejki z profilu agencji: nagłówek „### AGENCJA: nazwa | adres ###" i po jednym
// zawodniku w linijce.
function parseAgencySquadPaste(text){
  const linie = String(text||'').split(/\r?\n/);
  let agencja = '', link = '';
  const zawodnicy = [];
  linie.forEach(l=>{
    const s = l.trim();
    if(!s) return;
    const m = s.match(/^###\s*AGENCJA:\s*(.*?)\s*###$/i);
    if(m){
      const czesci = m[1].split('|').map(x=>x.trim());
      agencja = czesci[0] || '';
      link = czesci.find(x=>/^https?:\/\//i.test(x)) || '';
      return;
    }
    if(/^###/.test(s)) return;
    const cz = s.split('|').map(x=>x.trim());
    const nazwa = cz[0];
    if(!nazwa || nazwa.length < 3 || nazwa.length > 60) return;
    if(/^[\d\s.,€%+-]+$/.test(nazwa)) return;
    // Starsze wklejki miały 4 pola (bez pozycji) — rozpoznajemy oba układy, żeby bufor
    // zebrany przed zmianą nadal się wczytywał.
    const zPozycja = cz.length >= 5;
    zawodnicy.push({
      nazwa,
      wiek: /^\d{1,2}$/.test(cz[1]||'') ? parseInt(cz[1],10) : null,
      klub: cz[2] || '',
      pozycja: zPozycja ? (cz[3] || '') : '',
      wartosc: zPozycja
        ? ((cz[4] && cz[4].includes('€')) ? cz[4] : '')
        : ((cz[3] && cz[3].includes('€')) ? cz[3] : '')
    });
  });
  return {agencja, link, zawodnicy};
}

// „118,13 mln €" -> 118130000. Potrzebne, żeby dało się sortować agencje po wielkości portfela;
// jako tekst „856 tys." wypadłoby przed „118,13 mln", co odwracałoby całą kolejność.
function parsujWartoscRynkowa(s){
  const t = String(s||'').toLowerCase().replace(/\s|\u00a0/g,'').replace(/€/g,'');
  if(!t || /^[-–—]$/.test(t)) return null;
  const m = t.match(/^([\d.,]+)(mld|mln|tys\.?)?$/);
  if(!m) return null;
  const liczba = parseFloat(m[1].replace(/\./g,'').replace(',','.'));
  if(isNaN(liczba)) return null;
  const jednostka = m[2] || '';
  const mnoznik = jednostka === 'mld' ? 1e9
    : jednostka === 'mln' ? 1e6
    : /^tys/.test(jednostka) ? 1e3 : 1;
  return Math.round(liczba * mnoznik);
}

// Rozbiór wklejonej listy agencji. Format z zakładki to wiersze rozdzielone „ | ".
// Wklejka zrobiona ręcznie (bez zakładki) nie ma linków ani liczb — wtedy traktujemy
// każdą linijkę jako samą nazwę agencji. Mówimy o tym wprost w oknie importu.
function parseAgencjeWklejka(text){
  const liczba = (s)=>{
    const m = String(s||'').replace(/\s/g,'').match(/^(\d{1,5})$/);
    return m ? parseInt(m[1],10) : null;
  };
  const wynik = [];
  String(text||'').split(/\r?\n/).forEach(linia=>{
    const l = linia.trim();
    if(!l || /^###/.test(l)) return;
    const czesci = l.includes('|') ? l.split('|').map(s=>s.trim())
                 : l.includes('\t') ? l.split('\t').map(s=>s.trim())
                 : [l];
    const name = czesci[0];
    if(!name || name.length > 90) return;
    // Odsiewamy wiersze, które są samą liczbą, kwotą albo numeracją stron — w ręcznej wklejce
    // ze strony jest ich pełno i bez tego zrobiłyby się z nich „agencje" o nazwie „138".
    if(/^[\d\s.,€%+-]+$/.test(name)) return;
    // Kwoty („118,13 mln €", „856 tys. €") przechodziły przez powyższy filtr, bo mają w sobie
    // litery — a w ręcznej wklejce ze strony jest ich tyle samo, co nazw agencji.
    if(name.includes('€') || /^\d[\d\s.,]*\s*(mln|mld|tys\.?)\b/i.test(name)) return;
    if(/^(licensed|polska|agencja menad|z weryfikacj|zawodnik|pogloski|pogłoski|reklama)/i.test(name)) return;
    const link = czesci.find(c=>/^https?:\/\//i.test(c)) || '';
    return void wynik.push({
      name,
      tmLink: link,
      country: (czesci[2] && !/^https?:/i.test(czesci[2])) ? czesci[2] : '',
      playersTm: liczba(czesci[3]),
      marketValue: czesci[4] && czesci[4].includes('€') ? czesci[4] : '',
      marketValueEur: parsujWartoscRynkowa(czesci[4]),
      licensed: /^tak$/i.test(czesci[5]||''),
      logoUrl: (czesci[6] && /^https?:\/\//i.test(czesci[6])) ? czesci[6] : '',
    });
  });
  return wynik;
}

// Rozbiór bufora zebranego zakładką. Jeden blok = jeden zawodnik.
function parseAgentPaste(text){
  return String(text||'').split(/^###\s*/m).map(s=>s.trim()).filter(Boolean).map(blok=>{
    const linie = blok.split(/\r?\n/);
    const naglowek = (linie.shift()||'').replace(/#+\s*$/,'').trim();
    if(!naglowek) return null;
    let rok = '', agent = '', link = '';
    linie.forEach(l=>{
      const mr = l.match(/^ROK:\s*(\d{4})/i);   if(mr) rok = mr[1];
      const ma = l.match(/^AGENT:\s*(.*)$/i);   if(ma) agent = ma[1].trim();
      const ml = l.match(/^LINK:\s*(\S+)/i);    if(ml) link = ml[1].trim();
    });
    const brak = !agent || /^[-–—]$/.test(agent) || /^(brak|nie podano|unknown)$/i.test(agent);
    return {
      nazwa: naglowek, birthYear: rok, maAgenta: !brak,
      agencyName: brak ? '' : agent,
      agencyLink: brak ? '' : link,
      // W bazie nazwa i adres agencji mieszkają w jednym polu — agencyDisplayHtml() rozdziela je
      // przy wyświetlaniu i robi z adresu klikalny odnośnik „strona agencji →".
      agencyValue: brak ? '' : (link ? agent + ' ' + link : agent)
    };
  }).filter(Boolean);
}

// Dopasowanie „Imię Nazwisko" z Transfermarktu do zawodnika w bazie. Porównujemy ZBIÓR słów, bo
// kolejność bywa odwrotna (arkusze ZPN piszą „NOWAK JAN", Transfermarkt „Jan Nowak").
function matchPlayersByFullName(nazwa, birthYear){
  const slowa = String(nazwa||'').split(/\s+/).map(importNorm).filter(Boolean).sort().join(' ');
  if(!slowa) return [];
  let kandydaci = DB.players.filter(p=>
    [p.firstName, p.lastName].join(' ').split(/\s+/).map(importNorm).filter(Boolean).sort().join(' ') === slowa);
  // Imiennicy: rocznik z profilu rozstrzyga, o którego chodzi.
  if(kandydaci.length > 1 && birthYear){
    const zRocznikiem = kandydaci.filter(p=> String(p.birthYear||'') === String(birthYear));
    if(zRocznikiem.length) kandydaci = zRocznikiem;
  }
  return kandydaci;
}

function openBookmarkletModal(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
  <div class="modal" style="max-width:640px;">
    <h3>🔖 Szybkie kopiowanie z Transfermarktu</h3>
    <p class="note">Zamiast zaznaczać tabelę myszą — jedno kliknięcie na stronie klubu kopiuje wszystko do schowka.
    Ustawiasz to <strong>raz</strong>.</p>

    <ol style="font-size:12.5px;line-height:1.9;padding-left:18px;">
      <li>Włącz pasek zakładek w przeglądarce: <strong>Ctrl+Shift+B</strong></li>
      <li>Przeciągnij ten przycisk na pasek zakładek:<br>
        <a href="${esc(TM_BOOKMARKLET)}" onclick="event.preventDefault();alert('To nie jest przycisk do klikania.\n\nPRZECIĄGNIJ go myszą na pasek zakładek przeglądarki (Ctrl+Shift+B, jeśli paska nie widać),\na potem kliknij go TAM, będąc na stronie źródłowej.\n\nJeśli przeciąganie nie działa — rozwiń „Kod do wklejenia ręcznie" pod spodem.');return false;" style="display:inline-block;margin:8px 0;padding:8px 16px;background:var(--gold);color:var(--heading);border-radius:6px;font-weight:800;text-decoration:none;cursor:grab;">⏱ Kopiuj do SBS</a>
      </li>
      <li>Wejdź na stronę klubu → <strong>Statystyki drużynowe</strong></li>
      <li>Kliknij <strong>„⏱ Kopiuj do SBS"</strong> na pasku zakładek — pojawi się potwierdzenie</li>
      <li>Wróć tutaj i wklej (<strong>Ctrl+V</strong>) w oknie statystyk ligi</li>
    </ol>

    <p class="note" style="font-size:11.5px;">Kolejne kluby: wchodzisz na stronę, klikasz zakładkę, wklejasz.
    Bez zaznaczania i bez ryzyka, że urwiesz kawałek tabeli.</p>
    <p class="note" style="font-size:11px;color:var(--ink-soft);">Skrypt czyta tylko tekst strony, którą masz otwartą —
    nie loguje się nigdzie i nie chodzi po serwisie samodzielnie.</p>

    <details style="margin-top:10px;">
      <summary style="cursor:pointer;font-size:12px;color:var(--gold-dark);">Przeciąganie nie działa? Pokaż kod do wklejenia ręcznie</summary>
      <p class="note" style="font-size:11px;margin-top:6px;">Utwórz nową zakładkę i wklej to w pole adresu:</p>
      <textarea readonly rows="4" style="font-size:10.5px;font-family:monospace;width:100%;">${esc(TM_BOOKMARKLET)}</textarea>
    </details>

    <div class="modal-actions">
      <button class="secondary" data-action="close-modal">Zamknij</button>
    </div>
  </div>`;
  overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=()=>overlay.remove());
  overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ---------- AGENCJE I MENEDŻEROWIE ----------
//
// Model: AGENCJA (firma) --< MENEDŻER (osoba) --< ZAWODNIK.
// Zawodnik wskazuje agencję (agencyId) i opcjonalnie konkretną osobę z niej (agentId). Osobno,
// bo Transfermarkt podaje wyłącznie firmę — nazwisko opiekuna zdobywa się rozmową i wpisuje ręcznie.
// Trzymanie samej nazwy w polu tekstowym przy zawodniku, jak było wcześniej, ma dwie wady:
// po zmianie szyldu trzeba poprawiać setki rekordów, a menedżerów nie da się w ogóle zapisać.

let viewingAgencyId = null;
let agencySearchQuery = '';
let agencySort = 'wartosc';   // wartosc | zawodnicy | nazwa

// Logo agencji. Adres wskazuje na serwer Transfermarktu, więc może się nie wczytać (blokada
// odsyłacza, zmiana adresu) — wtedy pokazujemy inicjały, tak jak przy klubach bez herbu.
// Logotypy agencji na JASNEJ płytce — zawsze, niezależnie od motywu.
//
// Logotypy przychodzą z zewnątrz i są nieprzewidywalne: większość to ciemna kreska na
// przezroczystym tle, część jest biała. Na ciemnym tle te pierwsze znikały zupełnie. Biała
// płytka z marginesem to rozwiązanie, które stosują wszystkie serwisy transferowe — działa
// dla każdego logotypu, bo nie zakłada niczego o jego kolorze.
function agencyLogoHtml(a, size){
  const s = size || 34;
  const inicjaly = String(a && a.name || '?').split(/\s+/).filter(Boolean).slice(0,2)
    .map(w=>w[0]).join('').toUpperCase();
  const zastepcze = `<span class="agency-logo agency-logo-fallback" style="width:${s}px;height:${s}px;font-size:${Math.round(s*0.36)}px;">${esc(inicjaly)}</span>`;
  // Pierwszeństwo ma logo WGRANE RĘCZNIE — adres z Transfermarktu bywa niedostępny (hotlink),
  // a plik wgrany przez użytkownika jest jego i zawsze się wyświetli.
  const zrodlo = agencyLogo(a);
  if(!zrodlo) return zastepcze;
  return `<img src="${esc(zrodlo)}" alt="" referrerpolicy="no-referrer" loading="lazy"
    class="agency-logo" style="width:${s}px;height:${s}px;"
    onerror="this.outerHTML=this.dataset.fallback" data-fallback="${esc(zastepcze)}">`;
}

// Adres zewnętrzny do odnośnika. Bez „http://" przeglądarka traktuje wpis jako ścieżkę WEWNĄTRZ
// aplikacji i ląduje na stronie 404 naszego serwera — dokładnie to działo się przy stronach agencji.
// Zwracamy pusty ciąg dla tego, co adresem nie jest (numer telefonu, sama nazwa), żeby nie robić
// odnośnika, który i tak donikąd nie prowadzi.
function adresZewnetrzny(raw){
  const s = String(raw||'').trim();
  if(!s) return '';
  if(/^https?:\/\//i.test(s)) return s;
  if(/^[+\d][\d\s()-]{5,}$/.test(s)) return '';                       // numer telefonu
  if(!/^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(s)) return '';            // nie wygląda na domenę
  // Do samej domeny doklejamy „http://", a nie „https://" — tak samo, jak zachowuje się pasek
  // adresu przeglądarki. Wymuszanie HTTPS wysypywało strony agencji z niepasującym certyfikatem
  // (unidos.com.pl działa wyłącznie po HTTP i Firefox pokazywał ostrzeżenie o bezpieczeństwie).
  // Strony, które mają poprawne HTTPS, i tak same przekierują — kosztem jednego przeskoku.
  return 'http://' + s;
}

function agencyById(id){ return DB.agencies.find(a=>a.id===id) || null; }
// Logotypy agencji mają WŁASNY magazyn (klucz scouting:agency_logos w sbs_kv).
//
// Pierwsza wersja wkładała je do tabeli herbów klubów, licząc na to, że klucz jest zwykłym
// tekstem. Nie jest: sbs_club_crests.club_id ma klucz obcy do sbs_clubs, więc baza odrzucała
// każdy zapis z identyfikatorem agencji („Key is not present in table sbs_clubs") i logo nigdy
// się nie zapisywało. Osobny magazyn omija to bez migracji schematu.
//
// Osobny, a nie wewnątrz rekordu agencji — obrazki w base64 ważą tysiące razy więcej niż reszta
// pól, a cały zbiór agencji zapisuje się przy każdej drobnej zmianie. Trzymane obok wchodzą do
// zapisu tylko wtedy, gdy faktycznie zmieniasz logo.
function agencyLogo(a){
  if(!a) return null;
  if(DB.agencyLogos && DB.agencyLogos[a.id]) return DB.agencyLogos[a.id];
  return a.logoUrl || null;
}
function agentById(id){ return DB.agents.find(a=>a.id===id) || null; }
function agencyAgents(agencyId){
  return DB.agents.filter(a=>a.agencyId===agencyId)
    .sort((a,b)=> (a.lastName||'').localeCompare(b.lastName||'','pl'));
}
function agencyPlayers(agencyId){
  return DB.players.filter(p=>p.agencyId===agencyId)
    .sort((a,b)=> (a.lastName||'').localeCompare(b.lastName||'','pl'));
}
function agentPlayers(agentId){ return DB.players.filter(p=>p.agentId===agentId); }
function agentFullName(a){
  if(!a) return '';
  return [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || '(bez nazwiska)';
}
// Nazwa agencji bywa zapisana z linkiem w tym samym polu („Nazwa https://…") — to spadek po
// wcześniejszej wersji, w której agencja była zwykłym tekstem przy zawodniku.
function rozdzielNazweILink(raw){
  const s = String(raw||'').trim();
  const m = s.match(/(https?:\/\/[^\s]+)/i);
  if(!m) return {name: s, link: ''};
  return {name: s.replace(m[1], '').replace(/[\s\-–—:]+$/,'').trim(), link: m[1]};
}
// Część wpisów z poprzedniej wersji to sam adres, bez nazwy. Adres agencji na Transfermarkcie
// ma postać /nazwa-agencji/beraterfirma/berater/123 — pierwszy człon czyta się wystarczająco
// dobrze, żeby nie zostawiać w bazie pozycji „(agencja bez nazwy)".
function nazwaZLinkuAgencji(link){
  const m = String(link||'').match(/^https?:\/\/[^/]+\/([^/]+)\//);
  if(!m) return '';
  return m[1].replace(/-/g,' ').replace(/\s+/g,' ').trim()
    .replace(/\b\p{Ll}/gu, c=>c.toUpperCase());
}
// Znajdź agencję po nazwie (bez względu na wielkość liter i znaki) albo po adresie na
// Transfermarkcie; gdy nie ma — załóż nową. Zwraca rekord agencji.
function znajdzLubUtworzAgencje(nazwa, link){
  const czysta = String(nazwa||'').trim();
  const czystyLink = String(link||'').trim();
  if(!czysta && !czystyLink) return null;
  let a = null;
  if(czystyLink) a = DB.agencies.find(x=> x.tmLink && x.tmLink === czystyLink);
  if(!a && czysta) a = DB.agencies.find(x=> importNorm(x.name) === importNorm(czysta));
  if(a){
    if(!a.tmLink && czystyLink){ a.tmLink = czystyLink; }
    return a;
  }
  a = {
    id: uid('AG'), name: czysta || nazwaZLinkuAgencji(czystyLink) || '(agencja bez nazwy)', tmLink: czystyLink,
    website:'', country:'', city:'', email:'', phone:'', notes:'',
    dateAdded: new Date().toISOString().slice(0,10)
  };
  DB.agencies.push(a);
  return a;
}
// Jednorazowe przeniesienie tego, co siedzi w polu tekstowym agencyName, do rekordów agencji.
// Nie kasuje agencyName — zostaje jako zapasowy opis, gdyby coś w powiązaniu poszło nie tak.
// Porządki na menedżerach WGRANYCH WCZEŚNIEJ, zanim import nauczył się czyścić nazwiska.
// Robi trzy rzeczy: zdejmuje z nazwiska ozdobniki, plakietkę „licensed" i rolę w nawiasie,
// przenosi rolę do własnego pola, a osobom bez telefonu podstawia numer agencji.
// To ten sam rozbiór co przy imporcie, więc jedno i drugie daje identyczny wynik.
async function uporzadkujMenedzerow(){
  let poprawione = 0, zTelefonem = 0;
  DB.agents.forEach(m=>{
    const pelne = [m.firstName, m.lastName].filter(Boolean).join(' ');
    const rozbiór = parseMenedzerowieWklejka(pelne)[0];
    if(rozbiór){
      const zmienioneImie = rozbiór.firstName !== m.firstName || rozbiór.lastName !== m.lastName;
      if(zmienioneImie){ m.firstName = rozbiór.firstName; m.lastName = rozbiór.lastName; poprawione++; }
      if(!m.role && rozbiór.role) m.role = rozbiór.role;
      if(!m.licensed && rozbiór.licensed) m.licensed = true;
    }
    if(!m.phone){
      const a = agencyById(m.agencyId);
      if(a && a.phone){ m.phone = a.phone; zTelefonem++; }
    }
    if(!m.email){
      const a = agencyById(m.agencyId);
      if(a && a.email) m.email = a.email;
    }
  });
  if(poprawione || zTelefonem) await saveAgents();
  return {poprawione, zTelefonem};
}

async function migrujAgencjeZTekstu(){
  let utworzone = 0, powiazane = 0;
  DB.players.forEach(p=>{
    if(p.agencyId) return;
    if(!p.hasAgent || !p.agencyName) return;
    const {name, link} = rozdzielNazweILink(p.agencyName);
    if(!name && !link) return;
    const przed = DB.agencies.length;
    const a = znajdzLubUtworzAgencje(name, link);
    if(!a) return;
    if(DB.agencies.length > przed) utworzone++;
    p.agencyId = a.id;
    powiazane++;
  });
  if(powiazane){
    await saveAgencies();
    await savePlayers();
  }
  return {utworzone, powiazane};
}

// Młodzieżowcy, przy których wciąż nie wiadomo, czy mają menedżera — czyli ani zaznaczonego
// „Tak", ani śladu wcześniejszego sprawdzenia. To jest właściwa lista roboczej kolejki.
function mlodziezowcyBezInfoOAgencie(){
  return DB.players
    .filter(p=> isYouthPlayer(p) && !p.hasAgent && !p.agentCheckedAt)
    .sort((a,b)=> (a.lastName||'').localeCompare(b.lastName||'','pl'));
}
function linkTmDoZawodnika(p){
  if(p.tmLink && /transfermarkt/.test(p.tmLink)) return p.tmLink;
  // Bez zapisanego profilu podajemy wyszukiwarkę Transfermarktu — dalej klika już użytkownik.
  const q = encodeURIComponent([p.firstName, p.lastName].filter(Boolean).join(' '));
  return 'https://www.transfermarkt.pl/schnellsuche/ergebnis/schnellsuche?query=' + q;
}

function viewAgencies(){
  if(viewingAgencyId) return viewAgencyDetail(viewingAgencyId);

  const q = agencySearchQuery.toLowerCase();
  let lista = DB.agencies.slice();
  if(q){
    lista = lista.filter(a=>
      (a.name||'').toLowerCase().includes(q) ||
      (a.country||'').toLowerCase().includes(q) ||
      (a.city||'').toLowerCase().includes(q) ||
      agencyAgents(a.id).some(m=> agentFullName(m).toLowerCase().includes(q))
    );
  }
  // Domyślnie od najmocniejszej: agencja z największym portfelem jest tą, z którą warto rozmawiać
  // najpierw. Agencje bez podanej wartości lądują na końcu, a nie udają najsłabszych.
  if(agencySort === 'nazwa'){
    lista.sort((a,b)=> (a.name||'').localeCompare(b.name||'','pl'));
  } else if(agencySort === 'zawodnicy'){
    lista.sort((a,b)=> (b.playersTm||0) - (a.playersTm||0) || (a.name||'').localeCompare(b.name||'','pl'));
  } else {
    lista.sort((a,b)=>{
      const wa = a.marketValueEur != null ? a.marketValueEur : parsujWartoscRynkowa(a.marketValue);
      const wb = b.marketValueEur != null ? b.marketValueEur : parsujWartoscRynkowa(b.marketValue);
      if(wa == null && wb == null) return (a.name||'').localeCompare(b.name||'','pl');
      if(wa == null) return 1;
      if(wb == null) return -1;
      return wb - wa || (a.name||'').localeCompare(b.name||'','pl');
    });
  }

  // Zawodnicy oznaczeni jako „ma menedżera", ale bez wskazanej agencji — luka, którą warto widzieć.
  const bezAgencji = DB.players.filter(p=> p.hasAgent && !p.agencyId).length;

  const wiersze = lista.map((a,i)=>{
    const menedzerowie = agencyAgents(a.id);
    const zawodnicy = agencyPlayers(a.id);
    const mlodziez = zawodnicy.filter(isYouthPlayer).length;
    return `<tr style="cursor:pointer;" data-action="open-agency" data-id="${a.id}" title="Kliknij, aby zobaczyć menedżerów i zawodników">
      <td onclick="event.stopPropagation()" style="width:24px;"><input type="checkbox" class="agency-checkbox" data-id="${a.id}"></td>
      <td style="color:var(--ink-soft);font-size:12px;text-align:right;">${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:8px;">
        <label for="agency-logo-${a.id}" onclick="event.stopPropagation()" style="cursor:pointer;display:inline-flex;flex:0 0 auto;" title="Kliknij, aby wgrać własne logo agencji">${agencyLogoHtml(a)}</label>
        <input type="file" id="agency-logo-${a.id}" class="agency-logo-input" data-agency-id="${a.id}" accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg,application/pdf,.pdf" style="display:none;" onclick="event.stopPropagation()">
        <span>
        <strong>${esc(a.name)}</strong>${a.licensed?` <span class="agent-yes" style="font-size:10px;" title="Agencja licencjonowana wg Transfermarktu">LIC</span>`:''}
        <span class="club-sub" style="display:block;">${esc([a.city, a.country].filter(Boolean).join(', ')||'—')}</span>
      </span></div></td>
      <td style="text-align:right;">${menedzerowie.length}</td>
      <td style="text-align:right;">${zawodnicy.length}</td>
      <td style="text-align:right;">${mlodziez ? `<span class="agent-yes">${mlodziez}</span>` : '0'}</td>
      <td style="text-align:right;color:var(--ink-soft);font-size:12px;">${a.playersTm!=null?a.playersTm:'—'}${
        a.marketValue?`<span class="club-sub" style="display:block;">${esc(a.marketValue)}</span>`:''}</td>
      <td style="font-size:12px;">${esc(a.email||'')}${a.phone?`<span class="club-sub" style="display:block;">${esc(a.phone)}</span>`:''}</td>
      <td onclick="event.stopPropagation()" style="white-space:nowrap;">
        <button class="link-btn" data-action="edit-agency" data-id="${a.id}">Edytuj</button>
        <button class="link-btn" data-action="delete-agency" data-id="${a.id}" style="margin-left:8px;color:var(--clay-dark);">Usuń</button>
      </td>
    </tr>`;
  }).join('');

  return `
  <h2 class="view-title">Menedżerowie</h2>
  <p class="view-sub">Agencje i pracujący w nich menedżerowie. Zawodnik należy do <strong>agencji</strong>,
  a w jej ramach do konkretnej <strong>osoby</strong> — bo rozmawia się z osobą, nie z firmą.</p>

  <div class="toolbar" style="flex-wrap:wrap;gap:10px;">
    <input id="agency-search" placeholder="Szukaj agencji, miasta lub nazwiska menedżera..." value="${esc(agencySearchQuery)}" style="max-width:360px;">
    <select id="agency-sort" title="Kolejność na liście" style="max-width:210px;">
      <option value="wartosc" ${agencySort==='wartosc'?'selected':''}>Wg wartości rynkowej</option>
      <option value="zawodnicy" ${agencySort==='zawodnicy'?'selected':''}>Wg liczby zawodników</option>
      <option value="nazwa" ${agencySort==='nazwa'?'selected':''}>Alfabetycznie</option>
    </select>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="gold" data-action="agencies-import" title="Wgraj całą listę agencji z Transfermarktu — strona po stronie">📋 Wgraj listę agencji</button>
      <button class="secondary" data-action="agent-import" title="Zbierz agencje z profili zawodników na Transfermarkcie">🕵 Pobierz z profili zawodników</button>
      <button class="secondary" data-action="agency-migrate" title="Przenieś agencje wpisane wcześniej jako zwykły tekst przy zawodniku">🔗 Uporządkuj stare wpisy</button>
      <button class="gold" data-action="add-agency">+ Nowa agencja</button>
    </div>
  </div>

  ${bezAgencji ? `<p class="note" style="margin:0 0 10px;">${bezAgencji} zawodnik(ów) ma zaznaczonego menedżera, ale nie wskazano agencji.
    Kliknij <strong>Uporządkuj stare wpisy</strong>, aby przenieść nazwy wpisane wcześniej tekstem.</p>` : ''}

  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
      <input type="checkbox" id="select-all-agencies">
      <span style="font-size:13px;">Zaznacz wszystkie${agencySearchQuery?' z widoku':''}</span>
    </label>
    <button class="danger" id="delete-selected-agencies-btn" style="display:none;" data-action="delete-selected-agencies">🗑️ Usuń zaznaczone (0)</button>
  </div>

  <div class="card" style="padding:0;overflow:auto;">
    <table>
      <thead><tr><th style="width:24px;"><input type="checkbox" class="agency-header-checkbox"></th><th style="width:34px;text-align:right;">Lp.</th><th>Agencja</th>
        <th style="text-align:right;">Menedżerów</th><th style="text-align:right;">Zawodników</th>
        <th style="text-align:right;" title="Rocznik 2006 i młodsi">Młodzież</th>
        <th style="text-align:right;" title="Cały portfel agencji wg Transfermarktu — nie tylko ci zawodnicy, których masz w bazie">Wg TM</th>
        <th>Kontakt</th><th></th></tr></thead>
      <tbody>${wiersze || `<tr><td colspan="9"><div class="empty">${agencySearchQuery
        ? 'Brak agencji pasujących do wyszukiwania.'
        : 'Brak agencji. Dodaj ręcznie albo pobierz z Transfermarktu przyciskiem powyżej.'}</div></td></tr>`}</tbody>
    </table>
  </div>`;
}

function viewAgencyDetail(id){
  const a = agencyById(id);
  if(!a){ viewingAgencyId = null; return viewAgencies(); }
  const menedzerowie = agencyAgents(id);
  const zawodnicy = agencyPlayers(id);

  // Lista wyboru menedżera przy zawodniku — pusta pozycja znaczy „agencja tak, osoba nieznana".
  const opcjeMenedzera = (wybrany)=>
    `<option value="">— nie wskazano osoby —</option>` +
    menedzerowie.map(m=>`<option value="${m.id}" ${wybrany===m.id?'selected':''}>${esc(agentFullName(m))}</option>`).join('');

  const wierszeMenedzerow = menedzerowie.map(m=>`<tr>
    <td><strong>${esc(agentFullName(m))}</strong>${m.licensed?` <span class="agent-yes" style="font-size:10px;" title="Licencjonowany wg Transfermarktu">LIC</span>`:''}${
      m.licence?`<span class="club-sub" style="display:block;">licencja ${esc(m.licence)}</span>`:''}</td>
    <td style="font-size:12px;">${esc(m.role||'—')}</td>
    <td><input class="agent-inline" data-id="${m.id}" data-field="email" value="${esc(m.email||'')}" placeholder="E-mail" style="width:100%;box-sizing:border-box;font-size:12px;"></td>
    <td><input class="agent-inline" data-id="${m.id}" data-field="phone" value="${esc(m.phone||'')}" placeholder="Telefon" style="width:100%;box-sizing:border-box;font-size:12px;"></td>
    <td style="text-align:right;">${agentPlayers(m.id).length}</td>
    <td style="font-size:12px;">${esc(m.notes||'')}</td>
    <td style="white-space:nowrap;">
      <button class="link-btn" data-action="edit-agent" data-id="${m.id}">Edytuj</button>
      <button class="link-btn" data-action="delete-agent" data-id="${m.id}" style="margin-left:8px;color:var(--clay-dark);">Usuń</button>
    </td>
  </tr>`).join('');

  const wierszeZawodnikow = zawodnicy.map(p=>`<tr>
    <td><strong>${esc(p.lastName)}</strong> ${esc(p.firstName)}${isYouthPlayer(p)?youthBadge():''}</td>
    <td>${esc(p.birthYear||'—')}</td>
    <td>${esc(p.position||'—')}</td>
    <td><div class="club-cell">${crestImg(clubCrest(p.clubId))}<span class="club-name">${esc(clubName(p.clubId))}</span></div></td>
    <td><select class="agent-assign" data-player="${p.id}" style="min-width:190px;">${opcjeMenedzera(p.agentId||'')}</select></td>
    <td style="white-space:nowrap;">
      <button class="link-btn" data-action="open-player-profile" data-id="${p.id}">Profil</button>
      <button class="link-btn" data-action="unlink-agency" data-id="${p.id}" style="margin-left:8px;color:var(--clay-dark);">Odłącz</button>
    </td>
  </tr>`).join('');

  return `
  <button class="secondary" data-action="back-agencies" style="margin-bottom:14px;">&larr; Wróć do agencji</button>
  <div style="display:flex;align-items:center;gap:12px;">
    <label for="agency-logo-${a.id}" style="cursor:pointer;display:inline-flex;" title="Kliknij, aby wgrać własne logo agencji">${agencyLogoHtml(a, 52)}</label>
    <input type="file" id="agency-logo-${a.id}" class="agency-logo-input" data-agency-id="${a.id}" accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg,application/pdf,.pdf" style="display:none;">
    <h2 class="view-title" style="margin:0;">${esc(a.name)}</h2>
  </div>
  <p class="view-sub">
    ${esc([a.city, a.country].filter(Boolean).join(', ')||'brak lokalizacji')}
    ${a.email?` &middot; ${esc(a.email)}`:''}${a.phone?` &middot; ${esc(a.phone)}`:''}
    ${adresZewnetrzny(a.tmLink)?` &middot; <a class="ext-link" href="${esc(adresZewnetrzny(a.tmLink))}" target="_blank" rel="noopener noreferrer">Transfermarkt &rarr;</a>`:''}
    ${adresZewnetrzny(a.website)?` &middot; <a class="ext-link" href="${esc(adresZewnetrzny(a.website))}" target="_blank" rel="noopener noreferrer">strona &rarr;</a>`:''}
  </p>
  ${a.notes?`<p class="note" style="margin-top:-6px;">${esc(a.notes)}</p>`:''}
  <div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;">
    <button class="secondary" data-action="edit-agency" data-id="${a.id}">Edytuj agencję</button>
    <button class="gold" data-action="add-agent" data-agency="${a.id}">+ Nowy menedżer</button>
    <button class="gold" data-action="agency-staff" data-id="${a.id}" title="Wgraj kilku menedżerów naraz — z profilu agencji albo z listy nazwisk">👥 Wgraj menedżerów</button>
    <button class="gold" data-action="agency-squad" data-id="${a.id}" title="Wgraj listę reprezentowanych zawodników z Transfermarktu">📥 Wgraj zawodników</button>
    <button class="secondary" data-action="agency-add-players" data-id="${a.id}" title="Wybierz zawodników z bazy i przypisz ich do tej agencji">➕ Dodaj z bazy</button>
  </div>

  <h3 style="color:var(--heading);font-family:'Barlow Condensed',sans-serif;">Menedżerowie <span class="reports-count">${menedzerowie.length}</span></h3>
  <div class="card" style="padding:0;overflow:auto;margin-bottom:24px;">
    <table>
      <thead><tr><th>Imię i nazwisko</th><th>Rola</th><th style="min-width:190px;">E-mail</th><th style="min-width:150px;">Telefon</th><th style="text-align:right;">Zawodników</th><th>Notatka</th><th></th></tr></thead>
      <tbody>${wierszeMenedzerow || `<tr><td colspan="7"><div class="empty">Brak menedżerów — dodaj osoby, z którymi faktycznie rozmawiasz.</div></td></tr>`}</tbody>
    </table>
  </div>

  <h3 style="color:var(--heading);font-family:'Barlow Condensed',sans-serif;">Zawodnicy tej agencji <span class="reports-count">${zawodnicy.length}</span></h3>
  <div class="card" style="padding:0;overflow:auto;">
    <table>
      <thead><tr><th>Zawodnik</th><th>Rocznik</th><th>Pozycja</th><th>Klub</th><th>Opiekun z agencji</th><th></th></tr></thead>
      <tbody>${wierszeZawodnikow || `<tr><td colspan="6"><div class="empty">Żaden zawodnik nie jest jeszcze przypisany do tej agencji.</div></td></tr>`}</tbody>
    </table>
  </div>`;
}

// Wspólny zapis przypisania zawodnika do agencji — używa go i wgrywanie listy z Transfermarktu,
// i ręczne dodawanie. Trzymamy to w jednym miejscu, żeby obie drogi ustawiały DOKŁADNIE to samo:
// agencję w profilu, znacznik „Agent: Tak" na liście zawodników oraz ślad, skąd i kiedy to wiemy.
function przypiszZawodnikaDoAgencji(p, agencja, zrodlo){
  if(!p || !agencja) return false;
  if(p.agencyId === agencja.id) return false;
  p.agentId = '';                       // opiekun należał do poprzedniej agencji
  p.agencyId = agencja.id;
  p.hasAgent = true;                    // to właśnie zapala „Tak" w kolumnie Agent
  p.agencyName = agencja.name + (agencja.tmLink ? ' ' + agencja.tmLink : '');
  p.agentCheckedAt = new Date().toISOString().slice(0,10);
  p.agentSource = zrodlo;
  return true;
}

// Ręczne dopisanie zawodników do agencji — dla przypadków, których Transfermarkt nie zna:
// młodzież z niższych lig, informacja od skauta, rozmowa z menedżerem.
function openAddPlayersToAgencyModal(agencyId){
  const agencja = agencyById(agencyId);
  if(!agencja) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  let szukaj = '';
  let tylkoBezAgencji = true;
  const wybrani = new Set();

  function lista(){
    let l = DB.players.slice();
    if(tylkoBezAgencji) l = l.filter(p=> !p.agencyId || p.agencyId === agencyId);
    const q = importNorm(szukaj);
    if(q) l = l.filter(p=> importNorm([p.lastName,p.firstName].join(' ')).includes(q)
      || importNorm(clubName(p.clubId)).includes(q));
    l.sort((a,b)=> (a.lastName||'').localeCompare(b.lastName||'','pl') || (a.firstName||'').localeCompare(b.firstName||'','pl'));
    return l;
  }

  function draw(){
    const l = lista();
    const LIMIT = 120;
    overlay.innerHTML = `
    <div class="modal" style="max-width:720px;">
      <h3>Dodaj zawodników — ${esc(agencja.name)}</h3>
      <p class="note" style="margin-top:0;">Zaznacz zawodników z bazy. Każdemu ustawię tę agencję w profilu
      i zaznaczę <strong>Agent: Tak</strong> na liście zawodników.</p>

      <div class="field-wrap" style="margin-bottom:8px;">
        <input id="dodaj-szukaj" placeholder="Szukaj po nazwisku albo klubie..." value="${esc(szukaj)}" autocomplete="off">
      </div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;margin-bottom:10px;cursor:pointer;">
        <input type="checkbox" id="dodaj-tylko-wolni" ${tylkoBezAgencji?'checked':''}>
        <span>Pokaż tylko tych bez przypisanej agencji</span>
      </label>

      <div style="max-height:320px;overflow:auto;border-top:1px solid var(--border);padding-top:8px;">
        ${l.length ? `<table><tbody>${l.slice(0,LIMIT).map(p=>`<tr>
          <td style="width:24px;"><input type="checkbox" class="dodaj-check" data-id="${p.id}" ${wybrani.has(p.id)?'checked':''} ${p.agencyId===agencyId?'disabled':''}></td>
          <td><strong>${esc(p.lastName)}</strong> ${esc(p.firstName)}${isYouthPlayer(p)?youthBadge():''}
            <span class="club-sub" style="display:block;">${esc(p.birthYear||'—')} · ${esc(clubName(p.clubId))}</span></td>
          <td style="font-size:12px;">${p.agencyId===agencyId
            ? '<span class="note">już w tej agencji</span>'
            : (p.agencyId ? `<span style="color:var(--clay-dark);">${esc((agencyById(p.agencyId)||{}).name||'inna agencja')}</span>` : '')}</td>
        </tr>`).join('')}</tbody></table>`
        : '<div class="empty">Nikt nie pasuje do wyszukiwania.</div>'}
      </div>
      ${l.length > LIMIT ? `<p class="note" style="margin-top:6px;">Pokazuję ${LIMIT} z ${l.length} — zawęź wyszukiwaniem.</p>` : ''}

      <div class="modal-actions">
        <button class="secondary" data-action="close-modal">Anuluj</button>
        <button class="gold" data-action="dodaj-zapisz">Dodaj zaznaczonych (${wybrani.size})</button>
      </div>
    </div>`;
    wire();
  }

  function wire(){
    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=()=>{ overlay.remove(); render(); });
    const inp = overlay.querySelector('#dodaj-szukaj') as any;
    if(inp){
      inp.oninput = ()=>{
        szukaj = inp.value;
        const poz = inp.selectionStart;
        draw();
        const nowy = overlay.querySelector('#dodaj-szukaj') as any;
        if(nowy){ nowy.focus(); nowy.setSelectionRange(poz, poz); }
      };
    }
    const chk = overlay.querySelector('#dodaj-tylko-wolni') as any;
    if(chk) chk.onchange = ()=>{ tylkoBezAgencji = chk.checked; draw(); };
    overlay.querySelectorAll('.dodaj-check').forEach((c:any)=>c.onchange = ()=>{
      if(c.checked) wybrani.add(c.dataset.id); else wybrani.delete(c.dataset.id);
      // Przerysowanie tylko po to, żeby licznik na przycisku był zgodny z zaznaczeniem.
      const przycisk = overlay.querySelector('[data-action="dodaj-zapisz"]');
      if(przycisk) przycisk.textContent = `Dodaj zaznaczonych (${wybrani.size})`;
    });
    overlay.querySelectorAll('[data-action="dodaj-zapisz"]').forEach(b=>b.onclick=async()=>{
      if(!wybrani.size){ alert('Nikogo nie zaznaczyłeś.'); return; }
      let dodani = 0, przeniesieni = 0;
      wybrani.forEach(id=>{
        const p = DB.players.find(x=>x.id===id);
        if(!p) return;
        if(p.agencyId && p.agencyId !== agencyId) przeniesieni++;
        if(przypiszZawodnikaDoAgencji(p, agencja, 'ręcznie')) dodani++;
      });
      const ok = await savePlayers();
      if(!ok){ alert('Nie udało się zapisać — sprawdź baner u góry strony.'); return; }
      alert(`Dodano do agencji: ${dodani}` +
        (przeniesieni ? `\n(w tym przeniesionych z innej agencji: ${przeniesieni})` : '') +
        `\n\nKażdy ma teraz „Agent: Tak" na liście zawodników i tę agencję w profilu.`);
      overlay.remove();
      render();
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay){ overlay.remove(); render(); } });
  document.body.appendChild(overlay);
  draw();
}

// Wgranie składu jednej agencji. Zawodników NIE zakładamy — wiążemy tylko tych, którzy już są
// w bazie. Transfermarkt wymienia cały portfel agencji, także z lig, których nie obserwujesz;
// tworzenie z tego setek pustych rekordów zaśmieciłoby kartotekę bardziej, niż by pomogło.
// Hurtowe dopisanie menedżerów do agencji — z sekcji „Pracownicy" na Transfermarkcie albo
// z listy nazwisk wpisanej ręcznie.
function openAgencyStaffModal(agencyId){
  const agencja = agencyById(agencyId);
  if(!agencja) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  let wklejka = '';
  let rozpoznani = null;

  function podzial(){
    if(!rozpoznani) return {nowi:[], juzSa:[]};
    const nowi = [], juzSa = [];
    const istniejacy = agencyAgents(agencyId);
    const widziane = new Set();
    rozpoznani.forEach(m=>{
      const klucz = importNorm(m.firstName + m.lastName);
      if(widziane.has(klucz)) return;
      widziane.add(klucz);
      const jest = istniejacy.find(x=> importNorm((x.firstName||'')+(x.lastName||'')) === klucz);
      if(jest) juzSa.push({...m, istniejacy: jest}); else nowi.push(m);
    });
    return {nowi, juzSa};
  }

  function draw(){
    const {nowi, juzSa} = podzial();
    overlay.innerHTML = `
    <div class="modal" style="max-width:660px;">
      <h3>👥 Wgraj menedżerów — ${esc(agencja.name)}</h3>
      <p class="note" style="margin-top:0;">Sekcja <strong>Pracownicy</strong> na profilu agencji to jedyne miejsce,
      gdzie Transfermarkt podaje osoby, a nie samą firmę. Telefon, e-mail i licencję dopisujesz sam — tego tam nie ma.</p>

      <details style="margin-bottom:12px;" ${rozpoznani?'':'open'}>
        <summary style="cursor:pointer;font-weight:700;color:var(--gold-dark);">Zakładka (opcjonalnie)</summary>
        <ol style="font-size:12.5px;line-height:1.9;padding-left:18px;">
          <li>Przeciągnij na pasek zakładek:<br>
            <a href="${esc(TM_AGENCY_STAFF_BOOKMARKLET)}" onclick="event.preventDefault();alert('To nie jest przycisk do klikania.\n\nPRZECIĄGNIJ go myszą na pasek zakładek przeglądarki (Ctrl+Shift+B, jeśli paska nie widać),\na potem kliknij go TAM, będąc na stronie źródłowej.\n\nJeśli przeciąganie nie działa — rozwiń „Kod do wklejenia ręcznie" pod spodem.');return false;" style="display:inline-block;margin:8px 0;padding:8px 16px;background:var(--gold);color:var(--heading);border-radius:6px;font-weight:800;text-decoration:none;cursor:grab;">👥 Pracownicy agencji do SBS</a>
          </li>
          ${agencja.tmLink ? `<li>Otwórz <a class="ext-link" href="${esc(agencja.tmLink)}" target="_blank" rel="noopener noreferrer">profil tej agencji &rarr;</a>, kliknij zakładkę</li>`
            : `<li>Otwórz profil agencji na Transfermarkcie i kliknij zakładkę</li>`}
        </ol>
        <details style="margin-top:6px;">
          <summary style="cursor:pointer;font-size:12px;color:var(--gold-dark);">Kod do wklejenia ręcznie</summary>
          <textarea readonly rows="4" style="font-size:10.5px;font-family:monospace;width:100%;margin-top:6px;">${esc(TM_AGENCY_STAFF_BOOKMARKLET)}</textarea>
        </details>
      </details>

      <div class="field-wrap" style="margin-bottom:10px;">
        <label class="field">Wklej albo wpisz — po jednym menedżerze w linijce</label>
        <textarea id="staff-paste" rows="7" placeholder="Paweł Zimoń&#10;Branislav Jašurek&#10;Tomasz Rumiński | tomasz@agencja.pl | +48 600 100 200" style="font-size:12px;font-family:monospace;">${esc(wklejka)}</textarea>
        <div class="note" style="margin-top:5px;font-size:11px;">Możesz dopisać e-mail i telefon po pionowej kresce — kolejność dowolna.</div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start;margin-top:0;">
        <button class="secondary" data-action="staff-parse">Rozpoznaj</button>
      </div>

      ${rozpoznani ? `
        <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:12px;max-height:260px;overflow:auto;">
          <p class="note" style="margin-top:0;">Rozpoznano <strong>${rozpoznani.length}</strong>:
            nowych <strong>${nowi.length}</strong>${juzSa.length? `, już w agencji <strong>${juzSa.length}</strong>`:''}.</p>
          <table><tbody>
          ${nowi.map((m,i)=>`<tr>
            <td style="width:24px;"><input type="checkbox" class="staff-check" data-idx="${i}" checked></td>
            <td><strong>${esc(m.lastName)}</strong> ${esc(m.firstName)}</td>
            <td style="font-size:12px;">${esc(m.email||'')}${m.phone?`<span class="club-sub" style="display:block;">${esc(m.phone)}</span>`:''}</td>
          </tr>`).join('')}
          ${juzSa.map(m=>`<tr style="opacity:.6;"><td></td>
            <td>${esc(m.lastName)} ${esc(m.firstName)}</td>
            <td style="font-size:12px;">jest już w tej agencji</td></tr>`).join('')}
          </tbody></table>
        </div>
        <div class="modal-actions" style="justify-content:flex-start;">
          <button class="gold" data-action="staff-apply">Dodaj zaznaczonych (${nowi.length})</button>
        </div>
      ` : ''}

      <div class="modal-actions">
        <button class="secondary" data-action="close-modal">Zamknij</button>
      </div>
    </div>`;
    wire();
  }

  function wire(){
    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=()=>{ overlay.remove(); render(); });
    const ta = overlay.querySelector('#staff-paste') as any;
    if(ta) ta.oninput = ()=>{ wklejka = ta.value; };
    overlay.querySelectorAll('[data-action="staff-parse"]').forEach(b=>b.onclick=()=>{
      wklejka = ((overlay.querySelector('#staff-paste') as any)||{}).value || '';
      const r = parseMenedzerowieWklejka(wklejka);
      if(!r.length){ alert('Nie rozpoznałem żadnego menedżera.\n\nWpisz imię i nazwisko — po jednym w linijce.'); return; }
      rozpoznani = r;
      draw();
    });
    overlay.querySelectorAll('[data-action="staff-apply"]').forEach(b=>b.onclick=async()=>{
      const {nowi} = podzial();
      const zaznaczeni = Array.from(overlay.querySelectorAll('.staff-check:checked')).map((c:any)=>Number(c.dataset.idx));
      if(!zaznaczeni.length){ alert('Nikogo nie zaznaczyłeś.'); return; }
      const dzis = new Date().toISOString().slice(0,10);
      const telZWklejki = (rozpoznani as any).telAgencji || '';
      const mailZWklejki = (rozpoznani as any).mailAgencji || '';
      // Numer i mail z profilu uzupełniają też sam rekord agencji, jeśli był pusty.
      let zmianaAgencji = false;
      if(!agencja.phone && telZWklejki){ agencja.phone = telZWklejki; zmianaAgencji = true; }
      if(!agencja.email && mailZWklejki){ agencja.email = mailZWklejki; zmianaAgencji = true; }
      if(zmianaAgencji) await saveAgencies();
      let dodani = 0;
      zaznaczeni.forEach(i=>{
        const m = nowi[i];
        if(!m) return;
        DB.agents.push({
          id: uid('MN'), agencyId, firstName: m.firstName, lastName: m.lastName,
          // Brak telefonu przy osobie podstawiamy numerem agencji — to jedyny numer, jaki
          // Transfermarkt w ogóle podaje, i lepszy punkt zaczepienia niż puste pole.
          email: m.email || '', phone: m.phone || telZWklejki || agencja.phone || '',
          role: m.role || '', licensed: !!m.licensed,
          licence: '', tmLink: '', notes: '',
          dateAdded: dzis
        });
        dodani++;
      });
      const ok = await saveAgents();
      if(!ok){ alert('Nie udało się zapisać — sprawdź baner u góry strony.'); return; }
      alert(`Dodano menedżerów: ${dodani}` +
        (telZWklejki ? `\n\nTransfermarkt podaje JEDEN numer dla całej agencji (${telZWklejki}) — wpisałem go każdemu,` +
          `\nkto nie miał własnego. Numery bezpośrednie wpisz w tabeli, w kolumnie Telefon.`
          : `\n\nTransfermarkt nie podaje numerów do poszczególnych osób — wpisz je w tabeli, w kolumnie Telefon.`));
      rozpoznani = null; wklejka = '';
      render();
      draw();
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay){ overlay.remove(); render(); } });
  document.body.appendChild(overlay);
  draw();
}

function openAgencySquadModal(agencyId){
  const agencja = agencyById(agencyId);
  if(!agencja) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  let wklejka = '';
  let rozpoznane = null;
  let zakladajBrakujacych = true;

  // Rozdział na cztery kubełki:
  //  trafione        — są w bazie, wystarczy przypiąć agencję
  //  doZalozenia     — nie ma ich w bazie, ALE grają w klubie, który mamy (czyli w polskiej lidze)
  //  niejednoznaczne — kilka osób o tym nazwisku; nie zgadujemy
  //  zagraniczni     — klub spoza naszej bazy; pomijamy, bo to nie polskie rozgrywki
  function dopasuj(){
    if(!rozpoznane) return {trafione:[], doZalozenia:[], niejednoznaczne:[], zagraniczni:[], bezKlubu:[]};
    const trafione = [], doZalozenia = [], niejednoznaczne = [], zagraniczni = [], bezKlubu = [];
    rozpoznane.zawodnicy.forEach(z=>{
      const rocznik = z.wiek ? String(new Date().getFullYear() - z.wiek) : '';
      const klub = znajdzKlubPoNazwieTM(z.klub);
      const kandydaci = matchPlayersByFullName(z.nazwa, rocznik);
      if(kandydaci.length === 1){ trafione.push({...z, player: kandydaci[0], klubBazy: klub}); return; }
      if(kandydaci.length > 1){ niejednoznaczne.push({...z, kandydaci}); return; }
      if(klub){ doZalozenia.push({...z, klubBazy: klub, rocznik}); return; }
      // Pusty klub to NIE to samo, co klub zagraniczny. Pierwsze znaczy, że nie udało się go
      // odczytać ze strony i trzeba wskazać ręcznie; drugie, że zawodnik gra poza Polską.
      // Wrzucanie jednego do drugiego kasowałoby ludzi bez śladu.
      if(!String(z.klub||'').trim()) bezKlubu.push({...z, rocznik});
      else zagraniczni.push(z);
    });
    return {trafione, doZalozenia, niejednoznaczne, zagraniczni, bezKlubu};
  }

  function draw(){
    const {trafione, doZalozenia, niejednoznaczne, zagraniczni, bezKlubu} = dopasuj();
    const inna = rozpoznane && rozpoznane.link && agencja.tmLink && rozpoznane.link !== agencja.tmLink;
    // Ile zawodników ma agencja wg Transfermarktu, a ile faktycznie zebrałeś. Rozjazd znaczy
    // zwykle jedno: profil ma kilka stron, a kliknięcie padło tylko na część z nich.
    const wgTm = agencja.playersTm;
    const zebrano = rozpoznane ? rozpoznane.zawodnicy.length : 0;
    const brakujeStron = rozpoznane && wgTm != null && zebrano < wgTm - 2;

    overlay.innerHTML = `
    <div class="modal" style="max-width:780px;">
      <h3>📥 Wgraj zawodników — ${esc(agencja.name)}</h3>
      <p class="note" style="margin-top:0;">Profil agencji jest <strong>podzielony na strony</strong> — kliknij zakładkę
      na każdej z nich, bufor się sumuje. Biorę <strong>tylko zawodników grających w klubach z Twojej bazy</strong>,
      czyli w polskich rozgrywkach; resztę wypisuję, ale pomijam.</p>

      <details style="margin-bottom:12px;" ${rozpoznane?'':'open'}>
        <summary style="cursor:pointer;font-weight:700;color:var(--gold-dark);">1. Ustaw zakładkę (raz)</summary>
        <ol style="font-size:12.5px;line-height:1.9;padding-left:18px;">
          <li>Przeciągnij na pasek zakładek:<br>
            <a href="${esc(TM_AGENCY_SQUAD_BOOKMARKLET)}" onclick="event.preventDefault();alert('To nie jest przycisk do klikania.\n\nPRZECIĄGNIJ go myszą na pasek zakładek przeglądarki (Ctrl+Shift+B, jeśli paska nie widać),\na potem kliknij go TAM, będąc na stronie źródłowej.\n\nJeśli przeciąganie nie działa — rozwiń „Kod do wklejenia ręcznie" pod spodem.');return false;" style="display:inline-block;margin:8px 0;padding:8px 16px;background:var(--gold);color:var(--heading);border-radius:6px;font-weight:800;text-decoration:none;cursor:grab;">📥 Zawodnicy agencji do SBS</a>
          </li>
          ${agencja.tmLink ? `<li>Otwórz <a class="ext-link" href="${esc(agencja.tmLink)}" target="_blank" rel="noopener noreferrer">profil tej agencji &rarr;</a></li>`
            : `<li>Otwórz profil tej agencji na Transfermarkcie <span class="note">(nie mam zapisanego adresu — dopisz go w „Edytuj agencję", to pojawi się tu odnośnik)</span></li>`}
          <li>Kliknij zakładkę, przejdź na kolejną stronę składu (2, 3, …) i klikaj na każdej — bufor się sumuje</li>
          <li>Na koniec wróć tutaj i wklej. <strong>Shift+klik</strong> czyści bufor.</li>
        </ol>
        <details style="margin-top:6px;">
          <summary style="cursor:pointer;font-size:12px;color:var(--gold-dark);">Kod do wklejenia ręcznie</summary>
          <textarea readonly rows="4" style="font-size:10.5px;font-family:monospace;width:100%;margin-top:6px;">${esc(TM_AGENCY_SQUAD_BOOKMARKLET)}</textarea>
        </details>
      </details>

      <div class="field-wrap" style="margin-bottom:10px;">
        <label class="field">2. Wklej zebrane (Ctrl+V)</label>
        <textarea id="squad-paste" rows="6" placeholder="### AGENCJA: ... ###&#10;Michał Michalak | 26 | Lech Poznań | 250 tys. €" style="font-size:11.5px;font-family:monospace;">${esc(wklejka)}</textarea>
      </div>
      <div class="modal-actions" style="justify-content:flex-start;margin-top:0;">
        <button class="secondary" data-action="squad-parse">Rozpoznaj</button>
      </div>

      ${rozpoznane ? `
        ${inna ? `<p class="note" style="color:var(--clay-dark);margin-top:12px;">
          Uwaga: wklejka pochodzi z profilu <strong>${esc(rozpoznane.agencja||'innej agencji')}</strong>,
          a otwarta jest <strong>${esc(agencja.name)}</strong>. Sprawdź, czy to na pewno ta sama agencja —
          przypiszę zawodników do otwartej.</p>` : ''}
        ${brakujeStron ? `<p class="note" style="color:var(--clay-dark);margin-top:12px;border:1px solid var(--clay-dark);border-radius:6px;padding:8px 10px;">
          <strong>Zebrałeś ${zebrano} z ${wgTm} zawodników tej agencji.</strong>
          Profil jest podzielony na strony — wróć na Transfermarkt, przejdź kolejne strony składu
          (2, 3, 4…) i kliknij zakładkę na <strong>każdej</strong>, a potem wklej ponownie.
          Bufor sumuje się sam, więc nic z tego, co już masz, nie przepadnie.</p>` : ''}
        <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:12px;">
          <p class="note" style="margin-top:0;">Na liście z Transfermarktu: <strong>${rozpoznane.zawodnicy.length}</strong>.
            Gra w klubach z Twojej bazy: <strong>${trafione.length + doZalozenia.length}</strong>
            (w bazie ${trafione.length}${doZalozenia.length? `, do założenia ${doZalozenia.length}`:''}).
            Poza polskimi rozgrywkami: <strong>${zagraniczni.length}</strong>${
            niejednoznaczne.length? `, niejednoznacznych <strong>${niejednoznaczne.length}</strong>`:''}.</p>

          ${doZalozenia.length ? `<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;margin:8px 0;cursor:pointer;">
            <input type="checkbox" id="squad-zakladaj" ${zakladajBrakujacych?'checked':''}>
            <span>Załóż <strong>${doZalozenia.length}</strong> brakujących zawodników z polskich klubów</span>
          </label>` : ''}

          <div style="max-height:280px;overflow:auto;">
            <table><tbody>
            ${trafione.map((x,i)=>`<tr>
              <td style="width:24px;"><input type="checkbox" class="squad-row-check" data-idx="${i}" checked></td>
              <td><strong>${esc(x.player.lastName)}</strong> ${esc(x.player.firstName)}${isYouthPlayer(x.player)?youthBadge():''}
                <span class="club-sub" style="display:block;">${esc(clubName(x.player.clubId))}</span></td>
              <td style="font-size:12px;">${x.player.agencyId===agencyId
                ? '<span class="note">już przypisany</span>'
                : (x.player.agencyId ? `<span style="color:var(--clay-dark);">zmiana z: ${esc((agencyById(x.player.agencyId)||{}).name||'innej agencji')}</span>`
                                     : '<span class="agent-yes">przypiszę</span>')}</td>
            </tr>`).join('')}
            ${doZalozenia.map((x,i)=>`<tr style="background:rgba(198,155,60,0.06);">
              <td style="width:24px;"><input type="checkbox" class="squad-new-check" data-idx="${i}" ${zakladajBrakujacych?'checked':''}></td>
              <td>${esc(x.nazwa)}${x.rocznik && Number(x.rocznik)>=2006 ? youthBadge() : ''}
                <span class="club-sub" style="display:block;">${esc(x.klubBazy.name)}${x.rocznik? ' · '+esc(x.rocznik):''}${x.pozycja? ' · '+esc(x.pozycja):''}</span></td>
              <td style="font-size:12px;color:var(--gold-dark);">nowy — założę</td>
            </tr>`).join('')}
            ${niejednoznaczne.map(x=>`<tr style="color:var(--clay-dark);"><td></td>
              <td colspan="2" style="font-size:12px;">${esc(x.nazwa)} — w bazie jest ${x.kandydaci.length} osób o tym nazwisku, przypisz ręcznie</td></tr>`).join('')}
            ${bezKlubu.length ? `<tr><td></td><td colspan="2" style="font-size:12px;color:var(--clay-dark);padding-top:8px;">
              <strong>Bez odczytanego klubu (${bezKlubu.length})</strong> — nie wiem, gdzie grają, więc ich nie zakładam.
              Na Transfermarkcie przełącz tabelę na kartę <strong>„Szczegółowo"</strong>, tam klub jest podany tekstem,
              i zbierz jeszcze raz:<br>${
              bezKlubu.slice(0,20).map(z=>esc(z.nazwa)).join(', ')}${
              bezKlubu.length>20?` … i ${bezKlubu.length-20} więcej`:''}</td></tr>` : ''}
            ${zagraniczni.length ? `<tr><td></td><td colspan="2" style="font-size:12px;color:var(--ink-soft);padding-top:8px;">
              <strong>Poza polskimi rozgrywkami (${zagraniczni.length})</strong> — pomijam:<br>${
              zagraniczni.slice(0,20).map(z=>esc(z.nazwa)+(z.klub?` <span style="opacity:.7">(${esc(z.klub)})</span>`:'')).join(', ')}${
              zagraniczni.length>20?` … i ${zagraniczni.length-20} więcej`:''}</td></tr>` : ''}
            </tbody></table>
          </div>
        </div>
        <div class="modal-actions" style="justify-content:flex-start;">
          <button class="gold" data-action="squad-apply">Zapisz zaznaczonych</button>
        </div>
      ` : ''}

      <div class="modal-actions">
        <button class="secondary" data-action="close-modal">Zamknij</button>
      </div>
    </div>`;
    wire();
  }

  function wire(){
    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=()=>{ overlay.remove(); render(); });
    const ta = overlay.querySelector('#squad-paste');
    if(ta) ta.oninput = ()=>{ wklejka = ta.value; };
    overlay.querySelectorAll('[data-action="squad-parse"]').forEach(b=>b.onclick=()=>{
      wklejka = (overlay.querySelector('#squad-paste')||{}).value || '';
      const r = parseAgencySquadPaste(wklejka);
      if(!r.zawodnicy.length){ alert('Nie rozpoznałem żadnego zawodnika.\n\nWklej to, co skopiowała zakładka „📥 Zawodnicy agencji do SBS".'); return; }
      rozpoznane = r;
      draw();
    });
    const zakladajCheck = overlay.querySelector('#squad-zakladaj') as any;
    if(zakladajCheck) zakladajCheck.onchange = ()=>{
      zakladajBrakujacych = zakladajCheck.checked;
      overlay.querySelectorAll('.squad-new-check').forEach((c:any)=>c.checked = zakladajBrakujacych);
    };
    overlay.querySelectorAll('[data-action="squad-apply"]').forEach(b=>b.onclick=async()=>{
      const {trafione, doZalozenia} = dopasuj();
      const zaznaczone = Array.from(overlay.querySelectorAll('.squad-row-check:checked')).map(c=>Number(c.dataset.idx));
      const zaznaczoneNowe = Array.from(overlay.querySelectorAll('.squad-new-check:checked')).map(c=>Number(c.dataset.idx));
      let przypisani = 0, przeniesieni = 0, zalozeni = 0;
      zaznaczone.forEach(i=>{
        const x = trafione[i];
        if(!x) return;
        const p = x.player;
        if(p.agencyId === agencyId) return;         // już tu jest — nic nie ruszamy
        if(p.agencyId) przeniesieni++;
        if(przypiszZawodnikaDoAgencji(p, agencja, 'Transfermarkt (profil agencji)')) przypisani++;
      });
      // Zakładanie brakujących — TYLKO tych, których klub mamy w bazie. Wiek z Transfermarktu
      // daje rocznik z dokładnością do roku (zależy, czy zawodnik miał już urodziny), więc
      // zapisujemy to w notatce zamiast udawać pewność.
      zaznaczoneNowe.forEach(i=>{
        const x = doZalozenia[i];
        if(!x) return;
        const czesci = String(x.nazwa).split(/\s+/).filter(Boolean);
        const firstName = czesci[0] || '';
        const lastName = czesci.slice(1).join(' ') || firstName;
        const nowy = {
          id: uid('Z'), firstName, lastName,
          birthDate: '', birthYear: x.rocznik || '', nationality: '',
          position: x.pozycja ? (mapSquadPosition(x.pozycja) || x.pozycja) : '',
          foot: '', height: null, status: '', clubId: x.klubBazy.id, scout: currentScout || '',
          videoLink: '', lnpLink: '', tmLink: '',
          hasAgent: true, agencyId: agencja.id, agentId: '',
          agencyName: agencja.name + (agencja.tmLink ? ' ' + agencja.tmLink : ''),
          agentCheckedAt: new Date().toISOString().slice(0,10),
          agentSource: 'Transfermarkt (profil agencji)',
          formation: '', customFields: {},
          notes: 'Dodany z profilu agencji na Transfermarkcie.' +
            (x.rocznik ? ' Rocznik wyliczony z wieku — może być o rok wcześniejszy.' : ''),
          dateAdded: new Date().toISOString().slice(0,10)
        };
        DB.players.push(nowy);
        zalozeni++;
      });
      // Liczba zawodników agencji wg Transfermarktu — bierzemy prosto z długości listy.
      let zmianaAgencji = false;
      if(agencja.playersTm !== rozpoznane.zawodnicy.length){
        agencja.playersTm = rozpoznane.zawodnicy.length;
        zmianaAgencji = true;
      }
      if(!agencja.tmLink && rozpoznane.link){ agencja.tmLink = rozpoznane.link; zmianaAgencji = true; }
      const okAg = zmianaAgencji ? await saveAgencies() : true;
      const ok = okAg && await savePlayers();
      if(!ok){ alert('Nie udało się zapisać — sprawdź baner u góry strony.'); return; }
      alert((przypisani || zalozeni)
        ? `Przypisano do agencji: ${przypisani}` +
          (przeniesieni ? `\n(w tym przeniesionych z innej agencji: ${przeniesieni})` : '') +
          (zalozeni ? `\nZałożono nowych zawodników: ${zalozeni}` : '') +
          `\n\nKażdy ma „Agent: Tak" i tę agencję w profilu.` +
          `\nLiczba zawodników agencji wg Transfermarktu: ${rozpoznane.zawodnicy.length}`
        : 'Nic nie zmieniłem — zaznaczeni zawodnicy byli już przypisani do tej agencji.');
      rozpoznane = null; wklejka = '';
      render();
      draw();
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay){ overlay.remove(); render(); } });
  document.body.appendChild(overlay);
  draw();
}

function openAgenciesImportModal(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  let parsed = [];
  let pasted = '';

  // Rozdzielenie na nowe i już znane. Rozpoznajemy po adresie na Transfermarkcie, a gdy go nie ma —
  // po nazwie. Znanych nie duplikujemy, tylko uzupełniamy im puste pola.
  function podzial(){
    const nowe = [], znane = [];
    const widzianeWTejWklejce = new Set();
    parsed.forEach(w=>{
      const klucz = w.tmLink || importNorm(w.name);
      if(widzianeWTejWklejce.has(klucz)) return;   // ta sama agencja dwa razy w jednej wklejce
      widzianeWTejWklejce.add(klucz);
      const istnieje = (w.tmLink && DB.agencies.find(a=>a.tmLink===w.tmLink))
        || DB.agencies.find(a=>importNorm(a.name)===importNorm(w.name));
      if(istnieje) znane.push({...w, istniejaca: istnieje});
      else nowe.push(w);
    });
    return {nowe, znane};
  }

  function draw(){
    const {nowe, znane} = parsed.length ? podzial() : {nowe:[], znane:[]};
    overlay.innerHTML = `
    <div class="modal" style="max-width:780px;">
      <h3>📋 Wgraj listę agencji</h3>
      <p class="note" style="margin-top:0;">Lista agencji na Transfermarkcie jest podzielona na strony.
      Zakładka zbiera je do wspólnego bufora — przechodzisz stronę po stronie i klikasz na każdej,
      a na końcu wklejasz wszystko naraz.</p>

      <details style="margin-bottom:12px;" ${parsed.length?'':'open'}>
        <summary style="cursor:pointer;font-weight:700;color:var(--gold-dark);">1. Ustaw zakładkę (raz)</summary>
        <ol style="font-size:12.5px;line-height:1.9;padding-left:18px;">
          <li>Włącz pasek zakładek: <strong>Ctrl+Shift+B</strong></li>
          <li>Przeciągnij ten przycisk na pasek zakładek:<br>
            <a href="${esc(TM_AGENCIES_BOOKMARKLET)}" onclick="event.preventDefault();alert('To nie jest przycisk do klikania.\n\nPRZECIĄGNIJ go myszą na pasek zakładek przeglądarki (Ctrl+Shift+B, jeśli paska nie widać),\na potem kliknij go TAM, będąc na stronie źródłowej.\n\nJeśli przeciąganie nie działa — rozwiń „Kod do wklejenia ręcznie" pod spodem.');return false;" style="display:inline-block;margin:8px 0;padding:8px 16px;background:var(--gold);color:var(--heading);border-radius:6px;font-weight:800;text-decoration:none;cursor:grab;">📋 Agencje do SBS</a>
          </li>
          <li>Na Transfermarkcie: <strong>Zapoznaj się → Agencje</strong>, wybierz kraj, kliknij <strong>Pokaż wybór</strong></li>
          <li>Kliknij zakładkę. Przejdź na kolejną stronę (2, 3, …) i klikaj na każdej — bufor się sumuje,
              powtórzone agencje są pomijane.</li>
          <li><strong>Shift+klik</strong> czyści bufor, gdy chcesz zacząć od nowa.</li>
        </ol>
        <details style="margin-top:6px;">
          <summary style="cursor:pointer;font-size:12px;color:var(--gold-dark);">Przeciąganie nie działa? Kod do wklejenia ręcznie</summary>
          <textarea readonly rows="4" style="font-size:10.5px;font-family:monospace;width:100%;margin-top:6px;">${esc(TM_AGENCIES_BOOKMARKLET)}</textarea>
        </details>
      </details>

      <div class="field-wrap" style="margin-bottom:10px;">
        <label class="field">2. Wklej zebrane (Ctrl+V)</label>
        <textarea id="agencies-paste" rows="7" placeholder="FairSport Agency | https://www.transfermarkt.pl/... | Polska | 138 | 118,13 mln € | tak" style="font-size:11.5px;font-family:monospace;">${esc(pasted)}</textarea>
        <div class="note" style="margin-top:5px;font-size:11px;">Możesz też wkleić samą listę nazw — po jednej w linijce.
        Wtedy powstaną agencje z samą nazwą, bez linku i liczb, a resztę uzupełnisz ręcznie.</div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start;margin-top:0;">
        <button class="secondary" data-action="agencies-parse">Rozpoznaj</button>
      </div>

      ${parsed.length ? `
        <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:12px;">
          <p class="note" style="margin-top:0;">Rozpoznano <strong>${parsed.length}</strong>:
            nowych <strong>${nowe.length}</strong>, już w bazie <strong>${znane.length}</strong>.</p>
          <div style="max-height:280px;overflow:auto;">
            <table><thead><tr><th style="width:24px;"></th><th>Agencja</th><th>Kraj</th>
              <th style="text-align:right;" title="Liczba zawodników wg Transfermarktu">Zaw.</th>
              <th style="text-align:right;">Wartość</th><th></th></tr></thead>
            <tbody>
            ${nowe.map((w,i)=>`<tr>
              <td><input type="checkbox" class="agency-row-check" data-idx="${i}" checked></td>
              <td><strong>${esc(w.name)}</strong>${w.licensed?' <span class="agent-yes" style="font-size:10px;">LIC</span>':''}</td>
              <td style="font-size:12px;">${esc(w.country||'—')}</td>
              <td style="text-align:right;">${w.playersTm!=null?w.playersTm:'—'}</td>
              <td style="text-align:right;font-size:12px;">${esc(w.marketValue||'—')}</td>
              <td style="font-size:11px;color:var(--ink-soft);">nowa</td>
            </tr>`).join('')}
            ${znane.map(w=>`<tr style="opacity:.65;">
              <td></td>
              <td>${esc(w.name)}</td>
              <td style="font-size:12px;">${esc(w.country||'—')}</td>
              <td style="text-align:right;">${w.playersTm!=null?w.playersTm:'—'}</td>
              <td style="text-align:right;font-size:12px;">${esc(w.marketValue||'—')}</td>
              <td style="font-size:11px;color:var(--ink-soft);">jest — uzupełnię puste pola</td>
            </tr>`).join('')}
            </tbody></table>
          </div>
        </div>
        <div class="modal-actions" style="justify-content:flex-start;">
          <button class="gold" data-action="agencies-apply">Zapisz ${nowe.length} nowych${znane.length?` i uzupełnij ${znane.length}`:''}</button>
        </div>
      ` : ''}

      <div class="modal-actions">
        <button class="secondary" data-action="close-modal">Zamknij</button>
      </div>
    </div>`;
    wire();
  }

  function wire(){
    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=()=>{ overlay.remove(); render(); });
    const ta = overlay.querySelector('#agencies-paste');
    if(ta) ta.oninput = ()=>{ pasted = ta.value; };
    overlay.querySelectorAll('[data-action="agencies-parse"]').forEach(b=>b.onclick=()=>{
      pasted = (overlay.querySelector('#agencies-paste')||{}).value || '';
      parsed = parseAgencjeWklejka(pasted);
      if(!parsed.length){ alert('Nie rozpoznałem żadnej agencji.\n\nWklej to, co skopiowała zakładka „📋 Agencje do SBS", albo listę nazw po jednej w linijce.'); return; }
      draw();
    });
    overlay.querySelectorAll('[data-action="agencies-apply"]').forEach(b=>b.onclick=async()=>{
      const {nowe, znane} = podzial();
      const zaznaczone = Array.from(overlay.querySelectorAll('.agency-row-check:checked')).map(c=>Number(c.dataset.idx));
      const dzis = new Date().toISOString().slice(0,10);
      let dodane = 0, uzupelnione = 0;
      zaznaczone.forEach(i=>{
        const w = nowe[i];
        if(!w) return;
        DB.agencies.push({
          id: uid('AG'), name: w.name, tmLink: w.tmLink||'', country: w.country||'',
          city:'', email:'', phone:'', website:'', notes:'',
          playersTm: w.playersTm==null?undefined:w.playersTm,
          marketValue: w.marketValue||'',
          marketValueEur: w.marketValueEur==null?undefined:w.marketValueEur,
          licensed: !!w.licensed, logoUrl: w.logoUrl||'',
          dateAdded: dzis
        });
        dodane++;
      });
      // Istniejące agencje tylko UZUPEŁNIAMY — nigdy nie nadpisujemy tego, co wpisałeś ręcznie.
      znane.forEach(w=>{
        const a = w.istniejaca;
        let zmiana = false;
        if(!a.tmLink && w.tmLink){ a.tmLink = w.tmLink; zmiana = true; }
        if(!a.country && w.country){ a.country = w.country; zmiana = true; }
        if(a.playersTm == null && w.playersTm != null){ a.playersTm = w.playersTm; zmiana = true; }
        if(!a.marketValue && w.marketValue){ a.marketValue = w.marketValue; zmiana = true; }
        // Kwota liczbowo: uzupełniamy też wtedy, gdy tekst już był — starsze wpisy powstały,
        // zanim w ogóle liczyliśmy wartość, więc bez tego nigdy nie dałyby się posortować.
        if(a.marketValueEur == null){
          const eur = w.marketValueEur != null ? w.marketValueEur : parsujWartoscRynkowa(a.marketValue);
          if(eur != null){ a.marketValueEur = eur; zmiana = true; }
        }
        if(!a.licensed && w.licensed){ a.licensed = true; zmiana = true; }
        if(!a.logoUrl && w.logoUrl){ a.logoUrl = w.logoUrl; zmiana = true; }
        if(zmiana) uzupelnione++;
      });
      const ok = await saveAgencies();
      if(!ok){ alert('Nie udało się zapisać — sprawdź baner u góry strony.'); return; }
      // Gdy nic się nie zmieniło, mówimy to WPROST. Suchy komunikat „Nowych agencji: 0" czytało
      // się jak awarię zapisu, choć znaczył tylko tyle, że wszystko już było na miejscu.
      if(!dodane && !uzupelnione){
        alert(`Wszystkie ${parsed.length} agencji były już w bazie i nie brakowało im żadnych danych.\n\n` +
          `Nic nie zmieniłem — to nie błąd zapisu. Lista agencji jest w zakładce pod tym oknem.`);
      } else {
        alert(`Zapisano.\n\nNowych agencji: ${dodane}` + (uzupelnione?`\nUzupełnionych istniejących: ${uzupelnione}`:'') +
          `\n\nMenedżerów (osoby) dopisujesz sam — Transfermarkt podaje tylko firmy.`);
      }
      parsed = []; pasted = '';
      render();      // odśwież listę POD oknem, żeby było widać efekt bez zamykania
      draw();
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay){ overlay.remove(); render(); } });
  document.body.appendChild(overlay);
  draw();
}

function openAgencyModal(id){
  const a = id ? agencyById(id) : null;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.dataset.agencyId = id || '';
  overlay.innerHTML = `
  <div class="modal">
    <h3>${a? 'Edytuj agencję':'Nowa agencja'}</h3>
    <div class="field-wrap"><label class="field">Nazwa agencji</label><input id="am-name" value="${a?esc(a.name):''}" placeholder="np. BMS Sportconsulting GmbH"></div>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">Kraj</label><input id="am-country" value="${a?esc(a.country||''):''}" placeholder="np. Polska"></div>
      <div class="field-wrap"><label class="field">Miasto</label><input id="am-city" value="${a?esc(a.city||''):''}"></div>
    </div>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">E-mail</label><input id="am-email" value="${a?esc(a.email||''):''}"></div>
      <div class="field-wrap"><label class="field">Telefon</label><input id="am-phone" value="${a?esc(a.phone||''):''}"></div>
    </div>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">Strona agencji na Transfermarkcie</label><input id="am-tm" value="${a?esc(a.tmLink||''):''}" placeholder="https://www.transfermarkt.pl/..."></div>
      <div class="field-wrap"><label class="field">Strona własna</label><input id="am-web" value="${a?esc(a.website||''):''}" placeholder="https://..."></div>
    </div>
    <div class="field-wrap"><label class="field">Notatka</label><textarea id="am-notes" rows="2">${a?esc(a.notes||''):''}</textarea></div>
    <div class="modal-actions">
      <button class="secondary" data-action="close-modal">Anuluj</button>
      <button class="gold" data-action="save-agency">Zapisz</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

function openAgentModal(agentId, agencyId){
  const m = agentId ? agentById(agentId) : null;
  const agId = m ? m.agencyId : agencyId;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.dataset.agentId = agentId || '';
  overlay.dataset.agencyFor = agId || '';
  const agencjaOpcje = DB.agencies.slice().sort((x,y)=>(x.name||'').localeCompare(y.name||'','pl'))
    .map(x=>`<option value="${x.id}" ${x.id===agId?'selected':''}>${esc(x.name)}</option>`).join('');
  overlay.innerHTML = `
  <div class="modal">
    <h3>${m? 'Edytuj menedżera':'Nowy menedżer'}</h3>
    <div class="field-wrap"><label class="field">Agencja</label><select id="mm-agency">${agencjaOpcje}</select></div>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">Imię</label><input id="mm-first" value="${m?esc(m.firstName||''):''}"></div>
      <div class="field-wrap"><label class="field">Nazwisko</label><input id="mm-last" value="${m?esc(m.lastName||''):''}"></div>
    </div>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">E-mail</label><input id="mm-email" value="${m?esc(m.email||''):''}"></div>
      <div class="field-wrap"><label class="field">Telefon</label><input id="mm-phone" value="${m?esc(m.phone||''):''}"></div>
    </div>
    <div class="grid grid-2">
      <div class="field-wrap"><label class="field">Numer licencji FIFA</label><input id="mm-licence" value="${m?esc(m.licence||''):''}" placeholder="opcjonalnie"></div>
      <div class="field-wrap"><label class="field">Profil na Transfermarkcie</label><input id="mm-tm" value="${m?esc(m.tmLink||''):''}" placeholder="https://..."></div>
    </div>
    <div class="field-wrap"><label class="field">Notatka</label><textarea id="mm-notes" rows="2">${m?esc(m.notes||''):''}</textarea></div>
    <div class="modal-actions">
      <button class="secondary" data-action="close-modal">Anuluj</button>
      <button class="gold" data-action="save-agent">Zapisz</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

function openAgentImportModal(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  let parsed = [];
  let pasted = '';

  function dopasowania(){
    return parsed.map(w=>{
      const kandydaci = matchPlayersByFullName(w.nazwa, w.birthYear);
      return { ...w, kandydaci, player: kandydaci.length === 1 ? kandydaci[0] : null };
    });
  }

  function draw(){
    const wynik = dopasowania();
    const doZapisu = wynik.filter(x=>x.player);
    const doKolejki = mlodziezowcyBezInfoOAgencie();
    const LIMIT = 40;

    overlay.innerHTML = `
    <div class="modal" style="max-width:760px;">
      <h3>🕵 Menedżerowie z Transfermarktu</h3>
      <p class="note" style="margin-top:0;">Pole „Doradca" jest na profilu <strong>pojedynczego zawodnika</strong>,
      nie na stronie klubu — dlatego to osobna zakładka niż ta do statystyk. Wchodzisz na profil, klikasz,
      i tak przez całą listę; na końcu wklejasz wszystko naraz.</p>

      <details style="margin-bottom:12px;" ${parsed.length?'':'open'}>
        <summary style="cursor:pointer;font-weight:700;color:var(--gold-dark);">1. Ustaw zakładkę (raz)</summary>
        <ol style="font-size:12.5px;line-height:1.9;padding-left:18px;">
          <li>Włącz pasek zakładek: <strong>Ctrl+Shift+B</strong></li>
          <li>Przeciągnij ten przycisk na pasek zakładek:<br>
            <a href="${esc(TM_AGENT_BOOKMARKLET)}" onclick="event.preventDefault();alert('To nie jest przycisk do klikania.\n\nPRZECIĄGNIJ go myszą na pasek zakładek przeglądarki (Ctrl+Shift+B, jeśli paska nie widać),\na potem kliknij go TAM, będąc na stronie źródłowej.\n\nJeśli przeciąganie nie działa — rozwiń „Kod do wklejenia ręcznie" pod spodem.');return false;" style="display:inline-block;margin:8px 0;padding:8px 16px;background:var(--gold);color:var(--heading);border-radius:6px;font-weight:800;text-decoration:none;cursor:grab;">🕵 Menedżer do SBS</a>
          </li>
          <li>Wejdź na <strong>profil zawodnika</strong> na Transfermarkcie i kliknij zakładkę</li>
          <li>Powtórz dla kolejnych — bufor się sumuje. <strong>Shift+klik</strong> czyści zebrane.</li>
        </ol>
        <details style="margin-top:6px;">
          <summary style="cursor:pointer;font-size:12px;color:var(--gold-dark);">Przeciąganie nie działa? Kod do wklejenia ręcznie</summary>
          <textarea readonly rows="4" style="font-size:10.5px;font-family:monospace;width:100%;margin-top:6px;">${esc(TM_AGENT_BOOKMARKLET)}</textarea>
        </details>
      </details>

      <div class="field-wrap" style="margin-bottom:10px;">
        <label class="field">2. Wklej zebrane (Ctrl+V)</label>
        <textarea id="agent-paste" rows="6" placeholder="### Jan Nowak ###&#10;ROK: 2007&#10;AGENT: Przykładowa Agencja" style="font-size:12px;font-family:monospace;">${esc(pasted)}</textarea>
      </div>
      <div class="modal-actions" style="justify-content:flex-start;margin-top:0;">
        <button class="secondary" data-action="agent-parse">Rozpoznaj</button>
      </div>

      ${parsed.length ? `
        <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:12px;max-height:300px;overflow:auto;">
          <p class="note" style="margin-top:0;">Rozpoznano <strong>${parsed.length}</strong>,
          dopasowano do bazy <strong>${doZapisu.length}</strong>. Odznacz, czego nie chcesz zapisywać.</p>
          <table><tbody>
            ${wynik.map((x,i)=>{
              if(!x.player){
                const powod = x.kandydaci.length > 1
                  ? `w bazie jest ${x.kandydaci.length} zawodników o tym nazwisku — popraw ręcznie`
                  : 'nie znalazłem takiego zawodnika w bazie';
                return `<tr style="color:var(--clay-dark);"><td></td>
                  <td colspan="3" style="font-size:12px;">${esc(x.nazwa)} — ${esc(powod)}</td></tr>`;
              }
              const p = x.player;
              return `<tr>
                <td style="width:24px;"><input type="checkbox" class="agent-row-check" data-idx="${i}" checked></td>
                <td><strong>${esc(p.lastName)}</strong> ${esc(p.firstName)}${isYouthPlayer(p)?youthBadge():''}
                  <span class="note" style="display:block;">${esc(clubName(p.clubId))}</span></td>
                <td style="font-size:12px;">${p.hasAgent ? `<span class="agent-yes">Tak</span>${p.agencyName?' · '+esc(p.agencyName):''}` : `<span class="agent-no">Nie</span>`}</td>
                <td style="font-size:12px;">→ ${x.maAgenta
                  ? `<span class="agent-yes">Tak</span> · ${esc(x.agencyName)}` +
                    (x.agencyLink ? `<a class="ext-link" href="${esc(x.agencyLink)}" target="_blank" rel="noopener noreferrer" style="display:block;font-size:11px;">strona agencji →</a>` : '')
                  : `<span class="note">Transfermarkt nie podaje — zapiszę tylko datę sprawdzenia</span>`}</td>
              </tr>`;
            }).join('')}
          </tbody></table>
        </div>
        <div class="modal-actions" style="justify-content:flex-start;">
          <button class="gold" data-action="agent-apply">Zapisz zaznaczonych</button>
        </div>
      ` : ''}

      <details style="margin-top:14px;border-top:1px dashed var(--border-strong);padding-top:10px;">
        <summary style="cursor:pointer;font-weight:700;color:var(--heading);">
          Młodzieżowcy bez informacji o menedżerze — ${doKolejki.length}
        </summary>
        <p class="note" style="margin:6px 0;">Rocznik 2006 i młodsi, u których nie ma ani zaznaczonego „Tak",
        ani śladu wcześniejszego sprawdzenia. Kliknij nazwisko, aby otworzyć go na Transfermarkcie.</p>
        <div style="max-height:220px;overflow:auto;font-size:12.5px;line-height:1.8;">
          ${doKolejki.slice(0,LIMIT).map(p=>
            `<div><a href="${esc(linkTmDoZawodnika(p))}" target="_blank" rel="noopener noreferrer" style="color:var(--gold-dark);font-weight:700;">${esc(p.lastName)} ${esc(p.firstName)}</a>
             <span class="note">${esc(p.birthYear||'')} · ${esc(clubName(p.clubId))}</span></div>`).join('')
            || '<div class="note">Wszyscy młodzieżowcy mają już tę informację.</div>'}
        </div>
        ${doKolejki.length > LIMIT ? `<p class="note" style="margin-top:6px;">Pokazuję pierwszych ${LIMIT} z ${doKolejki.length} — reszta pojawi się, gdy odhaczysz tych.</p>` : ''}
      </details>

      <div class="modal-actions">
        <button class="secondary" data-action="close-modal">Zamknij</button>
      </div>
    </div>`;
    wire();
  }

  function wire(){
    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=()=>{ overlay.remove(); render(); });
    const ta = overlay.querySelector('#agent-paste');
    if(ta) ta.oninput = ()=>{ pasted = ta.value; };
    overlay.querySelectorAll('[data-action="agent-parse"]').forEach(b=>b.onclick=()=>{
      pasted = (overlay.querySelector('#agent-paste')||{}).value || '';
      parsed = parseAgentPaste(pasted);
      if(!parsed.length){ alert('Nie rozpoznałem żadnego zawodnika.\n\nWklej to, co skopiowała zakładka „🕵 Menedżer do SBS".'); return; }
      draw();
    });
    overlay.querySelectorAll('[data-action="agent-apply"]').forEach(b=>b.onclick=async()=>{
      const wynik = dopasowania();
      const zaznaczone = Array.from(overlay.querySelectorAll('.agent-row-check:checked')).map(c=>Number(c.dataset.idx));
      const dzis = new Date().toISOString().slice(0,10);
      let zAgentem = 0, samoSprawdzenie = 0, agencjeDotkniete = false;
      zaznaczone.forEach(i=>{
        const x = wynik[i];
        if(!x || !x.player) return;
        const p = x.player;
        p.agentCheckedAt = dzis;
        p.agentSource = 'Transfermarkt';
        if(x.maAgenta){
          p.hasAgent = true;
          if(x.agencyValue) p.agencyName = x.agencyValue;
          // Zakładamy (albo odnajdujemy) rekord agencji i wiążemy z nim zawodnika. Konkretnej
          // OSOBY Transfermarkt nie podaje — opiekuna wskazujesz sam w zakładce Menedżerowie.
          const agencja = znajdzLubUtworzAgencje(x.agencyName, x.agencyLink);
          if(agencja){
            if(p.agencyId !== agencja.id) p.agentId = '';   // zmiana agencji unieważnia starego opiekuna
            p.agencyId = agencja.id;
            agencjeDotkniete = true;
          }
          zAgentem++;
        } else {
          // Świadomie NIE ustawiamy hasAgent=false. Brak wpisu na Transfermarkcie to brak danych,
          // nie potwierdzenie, że zawodnik jest bez menedżera — a dla agencji to różnica zasadnicza.
          samoSprawdzenie++;
        }
      });
      // Agencje zapisujemy PRZED zawodnikami — inaczej zawodnik wskazywałby agencję,
      // której nie ma jeszcze w bazie (ten sam błąd, co kiedyś przy klubach w imporcie składu).
      const okAg = agencjeDotkniete ? await saveAgencies() : true;
      const ok = okAg && await savePlayers();
      if(!ok){ alert('Nie udało się zapisać — sprawdź baner u góry strony.'); return; }
      alert(`Zapisano.\n\nZ menedżerem: ${zAgentem}` +
        (agencjeDotkniete ? `\nAgencje uzupełnione w zakładce „Menedżerowie" — wpisz tam osoby, z którymi rozmawiasz.` : '') +
        (samoSprawdzenie ? `\nSprawdzonych, ale Transfermarkt nikogo nie podaje: ${samoSprawdzenie}` +
          `\n(znacznik „Tak/Nie" zostaje bez zmian — brak wpisu w serwisie nie oznacza, że zawodnik nie ma menedżera)` : ''));
      parsed = []; pasted = '';
      draw();
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay){ overlay.remove(); render(); } });
  document.body.appendChild(overlay);
  draw();
}

// Scalanie klubów wpisanych dwa razy pod różnymi nazwami („Zagłębie II Lubin" i „Zagłębie Lubin II").
//
// Dlaczego to działa W APLIKACJI, a nie skryptem po stronie bazy: otwarta karta trzyma w pamięci
// migawkę danych z chwili wczytania i przy każdym zapisie odsyła ją w całości. Zmiany robione
// w bazie „obok" aplikacji były więc cofane pierwszym zapisem — duplikaty wracały trzykrotnie.
// Tutaj operujemy na tej samej migawce, więc zapis ją utrwala.
//
// Rdzeń nazwy: pomijamy „II", „KS", „LKS", „MKS" i znaki nie-literowe, bo właśnie tym różnią się
// zapisy z 90minut i Transfermarktu.
function rdzenNazwyKlubu(s){
  return String(s||'').toLowerCase()
    .replace(/[łøđ]/g, c=>({'ł':'l','ø':'o','đ':'d'}[c]))
    .normalize('NFD').replace(/\p{M}/gu,'')
    .replace(/\b(ii|iii|ks|lks|mks|kp|kks)\b/g,'')
    // Usuwamy TYLKO rok w nazwie („ROW 1964 Rybnik" = „ROW Rybnik"). Oznaczeń wiekowych
    // (U17, U19) ruszać nie wolno — to osobne drużyny tego samego klubu, a nie duplikaty.
    .replace(/\b(19|20)\d{2}\b/g,'')
    .replace(/[^a-z0-9]/g,'');
}

// Dwie nazwy uznajemy za ten sam klub także wtedy, gdy jedna jest skróconą wersją drugiej —
// „Warta Gorzów" wobec „Warta Gorzów Wielkopolski", „Stilon Gorzów" wobec „KS Stilon Gorzów
// Wielkopolski". Same równe rdzenie tego nie łapały, bo portale dopisują człon regionalny.
// Próg 6 znaków chroni przed sklejeniem różnych klubów o krótkich, podobnych nazwach.
// Czy nazwa oznacza zespół rezerw („Legia II Warszawa", „Zagłębie Lubin II")?
// To musi się zgadzać po obu stronach: pierwszy zespół i rezerwy to RÓŻNE drużyny, grające
// w innych ligach. Bez tej kontroli scalanie połączyłoby Legię Warszawa z Legią II Warszawa.
function czyRezerwy(nazwa){ return /\bII+\b/.test(String(nazwa||'')); }

function tenSamKlub(a, b){
  if(!a || !b) return false;
  if(a === b) return true;
  const [krotszy, dluzszy] = a.length <= b.length ? [a,b] : [b,a];
  return krotszy.length >= 6 && dluzszy.startsWith(krotszy);
}

function znajdzDuplikatyKlubow(){
  const grupy = [];
  DB.clubs.forEach(c=>{
    const rdzen = rdzenNazwyKlubu(c.name);
    if(!rdzen) return;
    // Grupujemy w obrębie tej samej LIGI (nie samego poziomu) i tylko drużyny tego samego typu —
    // pierwszy zespół osobno, rezerwy osobno.
    const poziom = c.league || '';
    const rez = czyRezerwy(c.name);
    const g = grupy.find(g=> g.poziom === poziom && g.rezerwy === rez && g.warianty.some(w=> tenSamKlub(w, rdzen)));
    if(g){ g.kluby.push(c); g.warianty.push(rdzen); }
    else grupy.push({ poziom, rezerwy: rez, warianty:[rdzen], kluby:[c] });
  });
  return grupy.filter(g=>g.kluby.length>1).map(g=>g.kluby).map(grupa=>{
    // Zostaje wpis z NAJWIĘKSZĄ liczbą zawodników; przy remisie ten, który ma herb —
    // herb jest przypisany do identyfikatora klubu i przepada, gdyby usunąć właśnie ten wpis.
    const zLiczba = grupa.map(c=>({c, ile: DB.players.filter(p=>p.clubId===c.id).length, herb: !!DB.clubCrests[c.id]}));
    zLiczba.sort((a,b)=> b.ile-a.ile || (b.herb?1:0)-(a.herb?1:0) || a.c.name.localeCompare(b.c.name,'pl'));
    return { zostaje: zLiczba[0], doScalenia: zLiczba.slice(1) };
  });
}

function openMergeDuplicatesModal(){
  const grupy = znajdzDuplikatyKlubow();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const zamknij = ()=>{ overlay.remove(); render(); };

  const tresc = !grupy.length
    ? `<div class="empty">Nie znalazłem klubów wpisanych dwa razy. Wszystko wygląda w porządku.</div>`
    : `<p class="note">Znalazłem ${grupy.length} ${grupy.length===1?'klub wpisany':'kluby wpisane'} dwa razy pod różnymi nazwami.
       Zostaje wpis z większym składem (a przy równych — ten z herbem), reszta zostanie do niego dołączona.</p>
       <div style="max-height:320px;overflow:auto;">
       ${grupy.map(g=>`
         <div style="border-bottom:1px solid var(--chalk-dim);padding:9px 2px;font-size:12.5px;">
           <strong style="color:var(--heading);">${esc(g.zostaje.c.name)}</strong>
           <span class="note">— zostaje (${g.zostaje.ile} zaw.${g.zostaje.herb?', z herbem':''})</span>
           ${g.doScalenia.map(d=>`<div style="color:var(--clay-dark);margin-left:12px;">↳ ${esc(d.c.name)} — dołączam ${d.ile} zaw.${d.herb&&!g.zostaje.herb?' i herb':''}</div>`).join('')}
         </div>`).join('')}
       </div>`;

  overlay.innerHTML = `<div class="modal" style="max-width:620px;">
    <h3>🧹 Scal duplikaty klubów</h3>
    ${tresc}
    <p class="note" style="font-size:11.5px;margin-top:10px;">Zawodnicy nie są kasowani — przechodzą do klubu, który zostaje.
    Jeśli ten sam zawodnik jest w obu wpisach, zostanie jedna kopia.</p>
    <div class="modal-actions">
      ${grupy.length?`<button class="gold" data-action="merge-go">Scal ${grupy.length} ${grupy.length===1?'klub':'kluby'}</button>`:''}
      <button class="secondary" data-action="close-modal">Zamknij</button>
    </div>
  </div>`;

  overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=zamknij);
  overlay.addEventListener('click', e=>{ if(e.target===overlay) zamknij(); });

  overlay.querySelectorAll('[data-action="merge-go"]').forEach(b=>b.onclick=async()=>{
    b.disabled = true; b.textContent = 'Scalam…';
    const nkey = p => rdzenNazwyKlubu((p.firstName||'')+(p.lastName||''));
    let przeniesionych = 0, usunietychKopii = 0;
    const klubyDoUsuniecia = [];

    grupy.forEach(({zostaje, doScalenia})=>{
      const docelowy = zostaje.c;
      const juzTam = new Set(DB.players.filter(p=>p.clubId===docelowy.id).map(nkey));
      doScalenia.forEach(({c})=>{
        // Herb przenosimy, jeśli docelowy go nie ma — inaczej przepadłby razem z wpisem.
        if(!DB.clubCrests[docelowy.id] && DB.clubCrests[c.id]) DB.clubCrests[docelowy.id] = DB.clubCrests[c.id];
        DB.players.filter(p=>p.clubId===c.id).forEach(p=>{
          if(juzTam.has(nkey(p))){ p.__doUsuniecia = true; usunietychKopii++; }
          else { p.clubId = docelowy.id; juzTam.add(nkey(p)); przeniesionych++; }
        });
        klubyDoUsuniecia.push(c.id);
      });
    });

    const idsZawodnikow = DB.players.filter(p=>p.__doUsuniecia).map(p=>p.id);
    DB.players = DB.players.filter(p=>!p.__doUsuniecia);
    const zbior = new Set(klubyDoUsuniecia);
    DB.clubs = DB.clubs.filter(c=>!zbior.has(c.id));

    try{
      if(idsZawodnikow.length) await storage.deleteItems('scouting:players', idsZawodnikow);
      for(const id of klubyDoUsuniecia) await storage.deleteItem('scouting:clubs', id);
      await savePlayers(); await saveClubs(); await saveClubCrests();
      alert(`Scalono.\nPrzeniesiono zawodników: ${przeniesionych}\nUsunięto zdublowane kopie: ${usunietychKopii}\nUsunięto nadmiarowych wpisów klubowych: ${klubyDoUsuniecia.length}`);
      zamknij();
    }catch(e){
      alert('Nie udało się scalić: ' + ((e as any).message||e));
      b.disabled = false; b.textContent = 'Spróbuj ponownie';
    }
  });

  document.body.appendChild(overlay);
}

function openLeagueStatsModal(league){
  const clubs = DB.clubs.filter(c=> c.league === league || topLevelOf(c.league) === league);
  const clubIds = new Set(clubs.map(c=>c.id));
  const pool = DB.players.filter(p=> clubIds.has(p.clubId));

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const close = ()=>{ overlay.remove(); render(); };
  let parsed = null;
  // Odczytany protokół z ŁNP czeka tu na potwierdzenie — drugie kliknięcie go zapisuje.
  let protokol = null;

  // Świeżość liczymy z najnowszego zapisu statystyk wśród zawodników klubu.
  const clubFreshness = (c)=>{
    const stamps = DB.players.filter(p=>p.clubId===c.id && p.statsUpdatedAt).map(p=>p.statsUpdatedAt).sort();
    if(!stamps.length) return {label:'nigdy', stale:true};
    const days = Math.floor((Date.now() - new Date(stamps[stamps.length-1]).getTime())/86400000);
    return {label: days===0 ? 'dziś' : days===1 ? 'wczoraj' : days+' dni temu', stale: days >= 7};
  };

  overlay.innerHTML = `
  <div class="modal" style="max-width:760px;max-height:88vh;overflow:auto;">
    <h3>⏱ Statystyki — ${esc(league)}</h3>
    <p class="note">Wklej tabele „Statystyki drużynowe" z Transfermarktu — możesz jedna po drugiej,
    wszystkie kluby do tego samego pola. Nie musisz wskazywać klubu: dopasowuję po nazwisku
    do ${pool.length} zawodników z ${clubs.length} klubów tej ligi.</p>

    <div style="max-height:150px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:12px;">
      <table style="width:100%;font-size:12px;">
        <tr><th style="text-align:left;">Klub</th><th style="text-align:right;">Zawodników</th><th style="text-align:right;">Statystyki z</th></tr>
        ${clubs.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','pl')).map(c=>{
          const f = clubFreshness(c);
          return `<tr><td>${esc(c.name)}</td>
            <td style="text-align:right;">${DB.players.filter(p=>p.clubId===c.id).length}</td>
            <td style="text-align:right;color:${f.stale?'var(--clay-dark)':'var(--ink-soft)'};">${esc(f.label)}</td></tr>`;
        }).join('')}
      </table>
    </div>

    <div class="field-wrap" style="margin-bottom:12px;">
      <textarea id="league-stats-paste" rows="10" placeholder="Wklej tu tabelę pierwszego klubu, potem kolejnego — wszystko może iść razem." style="font-size:12px;font-family:monospace;"></textarea>
    </div>
    <div id="league-stats-preview"></div>
    <div class="modal-actions" style="justify-content:space-between;">
      <button class="secondary" data-action="show-bookmarklet" title="Kopiowanie ze strony klubu jednym kliknięciem">🔖 Szybkie kopiowanie</button>
      <span>
        <button class="gold" data-action="league-stats-parse">Rozpoznaj</button>
        <button class="secondary" data-action="close-modal">Zamknij</button>
      </span>
    </div>
  </div>`;

  overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=close);
  overlay.querySelectorAll('[data-action="show-bookmarklet"]').forEach(b=>b.onclick=()=>openBookmarkletModal());
  overlay.addEventListener('click', e=>{ if(e.target===overlay) close(); });

  const preview = overlay.querySelector('#league-stats-preview');
  const btn = overlay.querySelector('[data-action="league-stats-parse"]');

  btn.onclick = async ()=>{
    // Drugie kliknięcie po odczytaniu protokołu = zapis. Dorobek z protokołów SUMUJE SIĘ mecz
    // po meczu, więc każdy mecz musi być policzony dokładnie raz — stąd znacznik rozliczonych.
    if(protokol){
      let dopisanych = 0, klubow = 0;
      protokol.strony.forEach(s=>{
        if(s.blad || !s.dane.zgodne) return;
        klubow++;
        s.wiersze.forEach(w=>{
          if(!w.zawodnik || w.juzPoliczony) return;
          const p = w.zawodnik;
          if(w.mlodziezowiec && !p.mlodziezowiec) p.mlodziezowiec = true;
          if(w.position && !p.position) p.position = w.position;
          if(!w.zagral) return;                       // był w kadrze meczowej, ale nie wszedł
          p.matches = (p.matches || 0) + 1;
          p.minutes = (p.minutes || 0) + w.minutyGry;
          p.rozliczoneMecze = [...(p.rozliczoneMecze || []), protokol.klucz];
          p.statsUpdatedAt = new Date().toISOString().slice(0,10);
          p.statsSource = 'protokół ŁNP';
          dopisanych++;
        });
      });
      const pominiete = protokol.strony.filter(s=>s.dane && !s.dane.zgodne).map(s=>s.nazwa);
      if(!dopisanych){
        alert('Nie zapisałem nic — wszyscy byli już policzeni z tego meczu albo suma minut się nie zgadzała.');
        return;
      }
      const ok = await savePlayers();
      alert(ok
        ? `Dopisano dorobek ${dopisanych} zawodnikom z ${klubow} klubów.`
          + (pominiete.length ? `\n\nPOMINIĘTE (suma minut się nie zgadzała): ${pominiete.join(', ')}.` : '')
        : 'Nie udało się zapisać — sprawdź baner u góry strony.');
      if(ok){ protokol = null; close(); }
      return;
    }
    if(!parsed){
      const text = (overlay.querySelector('#league-stats-paste') as HTMLTextAreaElement).value.trim();
      if(!text){ alert('Wklej najpierw tabele statystyk.'); return; }

      // PROTOKÓŁ Z ŁNP — jedyne źródło statystyk IV ligi, bo ani Transfermarkt, ani 90minut
      // tej ligi nie prowadzą. Protokół podaje obie drużyny, więc jedno wklejenie aktualizuje
      // oba zespoły naraz i nie trzeba wskazywać klubu.
      if(/skład wyjściowy/i.test(text)){
        const wynik = przetworzProtokolLnp(text);
        if(wynik.blad){ preview.innerHTML = `<div class="empty" style="text-align:left;padding:14px;color:var(--clay-dark);">${esc(wynik.blad)}</div>`; parsed = null; return; }
        protokol = wynik;
        preview.innerHTML = wynik.strony.map(s=>{
          if(s.blad) return `<div class="empty" style="text-align:left;padding:10px;margin-bottom:8px;">
            <strong>${esc(s.nazwa)}</strong> — ${esc(s.blad)}</div>`;
          const doZapisu = s.wiersze.filter(w=>w.zawodnik && w.zagral && !w.juzPoliczony);
          const brakWBazie = s.wiersze.filter(w=>!w.zawodnik);
          return `<div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:10px;">
            <strong>${esc(s.klub.name)}</strong>
            ${s.dane.zgodne
              ? `<span class="badge reco" style="margin-left:8px;">minuty się zgadzają (${s.dane.suma})</span>`
              : `<span class="badge rejected" style="margin-left:8px;">suma minut ${s.dane.suma} zamiast ${s.dane.oczekiwana} — NIE ZAPISZĘ</span>`}
            <div class="note" style="margin-top:6px;font-size:12px;">
              do dopisania: <strong>${doZapisu.length}</strong>
              ${s.wiersze.filter(w=>w.juzPoliczony).length ? ` &middot; już policzonych wcześniej: ${s.wiersze.filter(w=>w.juzPoliczony).length}` : ''}
              ${brakWBazie.length ? ` &middot; <span style="color:var(--clay-dark);">spoza kartoteki: ${brakWBazie.length}</span>` : ''}
            </div>
            <div style="font-size:11.5px;line-height:1.7;margin-top:6px;">
              ${doZapisu.slice(0,24).map(w=>`${esc(w.lastName)} ${esc(w.firstName)} <strong>${w.minutyGry}′</strong>${w.mlodziezowiec?' <span class="youth-badge-3d">MŁ</span>':''}`).join(' &nbsp;·&nbsp; ')}
            </div>
            ${brakWBazie.length ? `<div class="note" style="font-size:11px;margin-top:6px;">Nie ma w kartotece: ${brakWBazie.map(w=>esc(w.firstName+' '+w.lastName)).join(', ')}</div>` : ''}
          </div>`;
        }).join('');
        btn.textContent = 'Zapisz statystyki obu drużyn';
        parsed = null; return;
      }

      if(wygladaNaProtokolMeczu(text)){
        preview.innerHTML = komunikatOProtokole();
        parsed = null; return;
      }
      // Najczęstszy błąd: skopiowana zakładka „Kadra" zamiast „Statystyki drużynowe". Tamta ma
      // daty urodzenia i wartości rynkowe, ale ani jednej minuty — rozpoznajemy to wprost,
      // zamiast zostawiać użytkownika z „nie dopasowałem żadnego wiersza".
      const maWartosciRynkowe = /(mln|tys\.)\s*€/i.test(text);
      if(!/\d\s*['’]/.test(text)){
        preview.innerHTML = `<div class="empty" style="text-align:left;padding:14px;">
          <strong style="color:var(--clay-dark);">W tym tekście nie ma ani jednej liczby minut.</strong>
          ${maWartosciRynkowe ? `<p style="margin:8px 0 0;">Widzę daty urodzenia i wartości rynkowe (np. „150 tys. €"),
            więc to zakładka <strong>Kadra</strong>, a nie <strong>Statystyki drużynowe</strong>.</p>` : ''}
          <p style="margin:8px 0 0;">W adresie strony musi być <code>/leistungsdaten/</code>. Jeśli jest tam
          <code>/startseite/</code> albo <code>/kader/</code> — zamień to na <code>leistungsdaten</code> i skopiuj ponownie.</p>
          <p style="margin:8px 0 0;color:var(--ink-soft);font-size:12px;">Minuty poznasz po apostrofie: <code>222'</code>.</p>
        </div>`;
        parsed = null; return;
      }
      parsed = parseSquadStatsText(text, pool);
      if(!parsed.results.length){
        preview.innerHTML = `<div class="empty">Minuty są w tekście, ale żadne nazwisko nie pasuje do zawodników tej ligi —
          sprawdź, czy klub jest w bazie i czy nazwiska zapisane są tak samo.
          ${parsed.ambiguous.length?`<br>Niejednoznaczne: ${esc(parsed.ambiguous.join(', '))}.`:''}</div>`;
        parsed = null; return;
      }
      const byClub = {};
      parsed.results.forEach(r=>{ const n = clubName(r.player.clubId); (byClub[n]=byClub[n]||[]).push(r); });
      preview.innerHTML = `
        <p class="note" style="margin:0 0 6px;">Rozpoznano <strong>${parsed.results.length}</strong> zawodników w ${Object.keys(byClub).length} klubach:</p>
        <div style="max-height:240px;overflow:auto;">
        ${Object.keys(byClub).sort((a,b)=>a.localeCompare(b,'pl')).map(cn=>`
          <div style="font-weight:700;color:var(--heading);font-size:12.5px;margin-top:6px;">${esc(cn)} <span style="font-weight:400;color:var(--ink-soft);">(${byClub[cn].length})</span></div>
          <table style="width:100%;font-size:12px;">
            ${byClub[cn].map(r=>`<tr><td>${esc(r.player.lastName)} ${esc(r.player.firstName)}</td>
              <td style="text-align:right;">${r.stats.matches??'—'} m.</td>
              <td style="text-align:right;"><strong>${r.stats.minutes??'—'}</strong> min</td>
              <td style="text-align:right;">${r.stats.goals??'—'} g.</td>
              <td style="text-align:right;">${r.stats.assists??'—'} a.</td></tr>`).join('')}
          </table>`).join('')}
        </div>
        ${parsed.withoutStats.length?`<p class="note" style="margin-top:8px;">Bez minut (pomijam): ${esc(parsed.withoutStats.slice(0,12).join(', '))}${parsed.withoutStats.length>12?' i '+(parsed.withoutStats.length-12)+' innych':''}.</p>`:''}
        ${parsed.ambiguous.length?`<p class="note" style="color:var(--clay-dark);margin-top:4px;">Pominięto niejednoznaczne: ${esc(parsed.ambiguous.join(', '))} — uzupełnij ręcznie w profilu.</p>`:''}`;
      btn.textContent = `✓ Zapisz dla ${parsed.results.length} zawodników`;
      return;
    }

    parsed.results.forEach(({player, stats})=>{
      if(stats.minutes !== undefined) player.minutes = stats.minutes;
      if(stats.matches !== undefined) player.matches = stats.matches;
      if(stats.goals !== undefined) player.goals = stats.goals;
      if(stats.assists !== undefined) player.assists = stats.assists;
      player.statsUpdatedAt = new Date().toISOString();
      player.statsSource = 'Transfermarkt (wklejone)';
    });
    const ok = await savePlayers();
    alert(ok ? `Zapisano statystyki dla ${parsed.results.length} zawodników.` : 'Nie udało się zapisać.');
    if(ok) close();
  };

  document.body.appendChild(overlay);
}

// SKŁADY DO OBSERWACJI MECZU (online i wideo).
//
// SKĄD BRAĆ SKŁAD — dwie drogi, bo zależy to od tego, czy mecz już się odbył:
//
//   PRZED MECZEM nie ma publicznego źródła składów. Kluby ogłaszają wyjściową jedenastkę mniej
//   więcej godzinę przed gwizdkiem, w mediach społecznościowych, i nie trafia to do żadnego
//   serwisu, który dałoby się odczytać. Dlatego bierzemy KADRĘ KLUBU z naszej bazy — masz przed
//   sobą wszystkich zawodników obu drużyn i zaznaczasz tych, którzy wyszli na boisko.
//
//   PO MECZU (i przy obserwacji z wideo, która i tak jest późniejsza) 90minut publikuje protokół:
//   kto faktycznie zagrał, z numerami, podziałem na podstawowy skład i rezerwę oraz minutami
//   zejścia. To jest źródło dokładniejsze i wtedy warto go użyć.
//
// Wyróżnienia zapisujemy przy OBSERWACJI, a nie przy meczu — to notatka konkretnego skauta
// z konkretnego oglądania, a dwóch obserwatorów może wskazać kogo innego.
const liczbaWyroznionych = (o) => {
  const s = o && o.skladMeczu;
  if(!s) return 0;
  return ['gospodarze','goscie'].reduce((suma,strona)=>
    suma + (((s[strona]||{}).zawodnicy)||[]).filter(z=>z.wyrozniony).length, 0);
};

// „Pogoń Szczecin - Motor Lublin" -> obie nazwy. Rozdzielamy po myślniku OTOCZONYM spacjami,
// bo w nazwach klubów myślnik występuje na stałe („Błękitni Stargard - Wda Świecie" kontra
// „Bielsko-Biała"). Doklejoną datę po przecinku ucinamy.
function paraDruzynZObserwacji(tekst){
  const czysty = String(tekst||'').replace(/\s+/g,' ').trim();
  const czesci = czysty.split(/\s+[-–—]\s+/);
  if(czesci.length < 2) return null;
  const gospodarz = czesci[0].trim();
  const gosc = czesci[1].split(',')[0].trim();
  return (gospodarz && gosc) ? {gospodarz, gosc} : null;
}

function openObsSkladModal(obsId){
  const obs = DB.observations.find(o=>o.id===obsId);
  if(!obs) return;
  const para = paraDruzynZObserwacji(obs.match);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  let pracuje = false, komunikat = '', bladPobrania = '';

  // Kadra z naszej bazy — dostępna od razu, także przed meczem.
  function zBazy(nazwaDruzyny){
    const klub = DB.clubs.find(c=>importNorm(c.name) === importNorm(nazwaDruzyny))
      || DB.clubs.find(c=>{
        const a = importNorm(c.name), b = importNorm(nazwaDruzyny);
        return a.length>=5 && b.length>=5 && (a.includes(b) || b.includes(a));
      });
    if(!klub) return null;
    const kadra = DB.players.filter(p=>p.clubId===klub.id)
      .sort((a,b)=>(a.lastName||'').localeCompare(b.lastName||'','pl'));
    return {nazwa: klub.name, zawodnicy: kadra.map(p=>({
      playerId: p.id, nazwa: `${p.firstName||''} ${p.lastName||''}`.trim(),
      numer: null, pozycja: p.position||'', rocznik: p.birthYear||'', wyrozniony: false,
    }))};
  }

  function wczytajZBazy(){
    if(!para){ bladPobrania = 'Pole „Mecz" nie zawiera dwóch drużyn rozdzielonych myślnikiem.'; draw(); return; }
    const g = zBazy(para.gospodarz), s = zBazy(para.gosc);
    if(!g && !s){
      bladPobrania = `Nie mam w bazie ani „${para.gospodarz}", ani „${para.gosc}". Zaimportuj skład klubu w zakładce Kluby.`;
      draw(); return;
    }
    obs.skladMeczu = {
      zrodlo: 'baza', pobrano: new Date().toISOString().slice(0,10),
      gospodarze: g || {nazwa: para.gospodarz, zawodnicy: []},
      goscie: s || {nazwa: para.gosc, zawodnicy: []},
    };
    bladPobrania = '';
    komunikat = (!g || !s)
      ? `Wczytałem tylko jedną drużynę — drugiej („${g?para.gosc:para.gospodarz}") nie ma w bazie klubów.`
      : 'Wczytałem kadry obu drużyn z bazy SBS.';
    zapisz();
  }

  async function wczytajZ90minut(){
    if(!para){ bladPobrania = 'Pole „Mecz" nie zawiera dwóch drużyn rozdzielonych myślnikiem.'; draw(); return; }
    pracuje = true; bladPobrania = ''; komunikat = ''; draw();
    try{
      const klubGosp = DB.clubs.find(c=>importNorm(c.name)===importNorm(para.gospodarz));
      const res = await fetch('/api/sklad-meczu?home=' + encodeURIComponent(para.gospodarz)
        + '&away=' + encodeURIComponent(para.gosc)
        + (klubGosp && klubGosp.league ? '&league=' + encodeURIComponent(klubGosp.league) : ''));
      const dane = await res.json();
      if(!res.ok || dane.error){
        bladPobrania = (dane.error || ('Serwer odpowiedział kodem ' + res.status + '.'))
          + (dane.podpowiedz ? ' ' + dane.podpowiedz : '');
      } else {
        // Zachowujemy dotychczasowe wyróżnienia — wczytanie protokołu po meczu nie może skasować
        // tego, co skaut zaznaczył w trakcie oglądania.
        const bylo = obs.skladMeczu || {};
        const przenies = (strona, zawodnicy)=>{
          const wczesniej = new Map((((bylo[strona]||{}).zawodnicy)||[])
            .map(z=>[importNorm(z.nazwa), !!z.wyrozniony]));
          return zawodnicy.map(z=>({
            nazwa: z.nazwa, numer: z.numer, podstawowy: z.podstawowy, zszedl: z.zszedl,
            zolte: z.zolte, czerwone: z.czerwone,
            wyrozniony: wczesniej.get(importNorm(z.nazwa)) || false,
          }));
        };
        obs.skladMeczu = {
          zrodlo: '90minut', pobrano: new Date().toISOString().slice(0,10),
          wynik: dane.wynik || '', link: dane.zrodlo || '',
          gospodarze: {nazwa: dane.gospodarzeNazwa, zawodnicy: przenies('gospodarze', dane.gospodarze)},
          goscie: {nazwa: dane.goscieNazwa, zawodnicy: przenies('goscie', dane.goscie)},
        };
        komunikat = 'Wczytałem protokół — to zawodnicy, którzy faktycznie zagrali.';
        await zapisz();
        return;
      }
    }catch(e){
      bladPobrania = 'Nie udało się połączyć z serwerem: ' + (e && e.message ? e.message : e);
    }finally{
      pracuje = false; draw();
    }
  }

  async function zapisz(){
    pracuje = true; draw();
    const ok = await saveObservations();
    pracuje = false;
    if(!ok) komunikat = 'UWAGA: nie udało się zapisać do bazy. Sprawdź połączenie.';
    draw();
  }

  function kolumnaHtml(strona, tytulZapasowy){
    const dane = (obs.skladMeczu||{})[strona];
    const zawodnicy = (dane && dane.zawodnicy) || [];
    return `<div style="flex:1;min-width:250px;">
      <h4 style="margin:0 0 6px;color:var(--heading);font-size:13px;">${esc((dane&&dane.nazwa)||tytulZapasowy||'—')}
        <span class="meta" style="font-weight:400;">(${zawodnicy.length})</span></h4>
      ${zawodnicy.length ? zawodnicy.map((z,i)=>`
        <label style="display:flex;align-items:center;gap:7px;padding:3px 4px;border-radius:5px;cursor:pointer;font-size:12.5px;${z.wyrozniony?'background:var(--card-warm);font-weight:700;':''}">
          <input type="checkbox" class="obs-wyroz" data-strona="${strona}" data-i="${i}" ${z.wyrozniony?'checked':''}>
          <span style="color:var(--ink-soft);min-width:20px;">${z.numer!=null?esc(String(z.numer)):''}</span>
          <span style="flex:1;">${esc(z.nazwa)}</span>
          <span class="meta" style="font-size:10.5px;white-space:nowrap;">${
            z.podstawowy===false ? 'ław.' : (z.zszedl ? z.zszedl+"'" : '')
          }${z.zolte?' 🟨':''}${z.czerwone?' 🟥':''}${z.pozycja?esc(z.pozycja):''}${z.rocznik?' '+esc(String(z.rocznik)):''}</span>
        </label>`).join('')
      : `<p class="note" style="font-size:11.5px;">Brak — wczytaj skład przyciskiem powyżej.</p>`}
    </div>`;
  }

  function draw(){
    const s = obs.skladMeczu;
    overlay.innerHTML = `
    <div class="modal" style="max-width:820px;">
      <h3>👥 Skład meczu</h3>
      <p class="note" style="margin-bottom:4px;">${esc(obs.match||'brak danych meczu')}
        &middot; ${esc(obs.date||'')}${obs.matchTime?' '+esc(obs.matchTime):''}</p>
      <p class="note" style="font-size:11.5px;margin-bottom:10px;">
        <strong>Przed meczem</strong> składów nie ma nigdzie publicznie — kluby ogłaszają je na godzinę przed gwizdkiem.
        Weź wtedy <strong>kadrę z bazy SBS</strong>. <strong>Po meczu</strong> (i przy oglądaniu z wideo)
        użyj <strong>protokołu z 90minut</strong> — pokaże, kto faktycznie zagrał, z numerami i minutami zejścia.</p>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        <button class="secondary" data-x="baza" ${pracuje?'disabled':''}>📋 Kadry z bazy SBS</button>
        <button class="gold" data-x="protokol" ${pracuje?'disabled':''}>${pracuje?'Pobieram…':'⚽ Kto zagrał (90minut)'}</button>
      </div>

      ${bladPobrania?`<div class="empty" style="text-align:left;padding:12px;border-color:var(--clay-dark);">
        <strong style="color:var(--clay-dark);">${esc(bladPobrania)}</strong></div>`:''}
      ${komunikat?`<p class="note" style="font-size:12px;color:var(--heading);">${esc(komunikat)}</p>`:''}

      ${s?`<div style="font-size:11.5px;color:var(--ink-soft);margin-bottom:6px;">
        Źródło: <strong>${s.zrodlo==='90minut'?'protokół 90minut':'kadra z bazy SBS'}</strong>
        &middot; pobrano ${esc(s.pobrano||'')}${s.wynik?' &middot; '+esc(s.wynik):''}
        ${s.link?` &middot; <a class="ext-link" href="${esc(s.link)}" target="_blank" rel="noopener">protokół &rarr;</a>`:''}
        <br>Zaznacz zawodników, którzy się wyróżnili — zaznaczenia zapisują się od razu.</div>
        <div style="display:flex;gap:22px;flex-wrap:wrap;">
          ${kolumnaHtml('gospodarze', para&&para.gospodarz)}
          ${kolumnaHtml('goscie', para&&para.gosc)}
        </div>
        <p class="note" style="font-size:11.5px;margin-top:10px;">Wyróżnionych: <strong>${liczbaWyroznionych(obs)}</strong></p>
      `:''}

      <div style="display:flex;justify-content:flex-end;margin-top:14px;">
        <button class="secondary" data-x="zamknij">Zamknij</button>
      </div>
    </div>`;

    overlay.querySelector('[data-x="zamknij"]').onclick = ()=>{ overlay.remove(); render(); };
    overlay.querySelector('[data-x="baza"]').onclick = wczytajZBazy;
    overlay.querySelector('[data-x="protokol"]').onclick = wczytajZ90minut;
    overlay.querySelectorAll('.obs-wyroz').forEach(inp=>inp.onchange = ()=>{
      const lista = obs.skladMeczu[inp.dataset.strona].zawodnicy;
      lista[Number(inp.dataset.i)].wyrozniony = inp.checked;
      zapisz();
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay){ overlay.remove(); render(); } });
  document.body.appendChild(overlay);
  draw();
}

// Pobranie statystyk całego składu z 90minut — bez kopiowania czegokolwiek.
//
// Cała robota dzieje się na serwerze (/api/stats-90minut): strona ligi → protokoły meczów tego
// klubu → strony zawodników, z których bierzemy GOTOWE sumy sezonowe. Dlatego dwukrotne
// uruchomienie niczego nie podwaja — nie dopisujemy meczu do meczu, tylko przepisujemy sumę.
//
// Najpierw pokazujemy podgląd, a dopiero potem zapisujemy. Przy pierwszym uruchomieniu na klubie
// zmian bywa kilkadziesiąt i warto zobaczyć je przed dotknięciem bazy.
function open90minutStatsModal(clubId){
  const club = DB.clubs.find(c=>c.id===clubId);
  if(!club) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  let wynik = null, pracuje = false, blad = '';

  function tabelaZmian(r){
    if(!r.zmiany.length) return `<p class="note" style="margin:10px 0;">Wszystkie liczby są już aktualne — nie ma czego zapisywać.</p>`;
    return `<table style="width:100%;font-size:12px;border-collapse:collapse;margin:10px 0;">
      <tr style="text-align:left;color:var(--ink-soft);"><th style="padding:4px;">Zawodnik</th><th style="padding:4px;">Rocznik</th><th style="padding:4px;">Było</th><th style="padding:4px;">Będzie</th></tr>
      ${r.zmiany.map(z=>`<tr style="border-top:1px solid var(--border);">
        <td style="padding:4px;font-weight:600;">${esc(z.kto)}</td>
        <td style="padding:4px;">${z.rocznik?`<strong style="color:var(--heading);">${esc(String(z.rocznik))}</strong>${Number(z.rocznik)>=2006?youthBadge():''}`:'<span class="meta">—</span>'}</td>
        <td style="padding:4px;color:var(--ink-soft);">${esc(z.bylo)}</td>
        <td style="padding:4px;">${esc(z.bedzie)}</td></tr>`).join('')}
    </table>`;
  }

  function draw(){
    overlay.innerHTML = `
    <div class="modal" style="max-width:760px;">
      <h3>⏱ Statystyki z 90minut — ${esc(club.name)}</h3>
      <p class="note" style="margin-bottom:10px;">Pobieram z 90minut protokoły meczów tego klubu, a z nich
      <strong>mecze, minuty, bramki i kartki</strong> każdego zawodnika. Liczby są gotowymi sumami za sezon,
      więc ponowne uruchomienie niczego nie podwoi.
      <br><strong>Asyst nie pobieram</strong> — 90minut ich nie publikuje, więc to pole zostaje nietknięte.</p>

      ${blad ? `<div class="empty" style="text-align:left;padding:12px;border-color:var(--clay-dark);">
        <strong style="color:var(--clay-dark);">${esc(blad)}</strong>
        ${wynik && wynik.podpowiedz ? `<p style="margin:8px 0 0;">${esc(wynik.podpowiedz)}</p>` : ''}
      </div>` : ''}

      ${wynik && wynik.ok ? `
        <div style="background:var(--card-soft);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:12.5px;">
          <div>${esc(wynik.rozgrywki || wynik.liga || '')}</div>
          <div style="margin-top:4px;">Sprawdzonych meczów: <strong>${wynik.sprawdzoneMecze}</strong>
          &middot; zawodników odczytanych z 90minut: <strong>${wynik.zawodnikowNa90minut}</strong>
          &middot; do zapisania: <strong>${wynik.doZapisu}</strong>
          ${wynik.zapisani ? ` &middot; <span style="color:var(--heading);font-weight:700;">zapisanych: ${wynik.zapisani}</span>` : ''}</div>
        </div>
        ${tabelaZmian(wynik)}
        ${wynik.spozaBazy.length ? `<div style="border-left:3px solid var(--gold-dark);padding:8px 12px;margin-top:10px;background:var(--card-soft);font-size:12px;">
          <strong>Zagrali w tym klubie, ale nie ma ich w kartotece — ${wynik.spozaBazy.length}:</strong>
          <div style="margin-top:6px;line-height:1.8;">
          ${wynik.spozaBazy.map(x=>`${esc(x.kto)}${x.rocznik?` <strong>${x.rocznik}</strong>${Number(x.rocznik)>=2006?youthBadge():''}`:''} — ${x.minuty} min`).join('<br>')}</div>
          <button class="gold" data-x="dopisz" style="margin-top:10px;" ${pracuje?'disabled':''}>${pracuje==='zapis'?'Dopisuję…':`+ Dopisz całą tę ${wynik.spozaBazy.length}-osobową listę do klubu`}</button>
        </div>` : ''}
        ${wynik.niejednoznaczni.length ? `<div style="border-left:3px solid var(--clay-dark);padding:8px 12px;margin-top:10px;background:var(--card-alert);font-size:12px;">
          <strong>Pominąłem ${wynik.niejednoznaczni.length} — nie wiem, o kogo chodzi:</strong>
          ${wynik.niejednoznaczni.map(n=>`<div style="margin-top:5px;">
            <strong>${esc(n.kto)}</strong> — ${esc(n.powod)}<br>
            <span class="meta">w bazie: ${esc((n.wBazie||[]).join(' &nbsp;•&nbsp; '))}</span></div>`).join('')}
          <p style="margin:8px 0 0;">Jeśli to ten sam zawodnik wpisany dwa razy, usuń zbędny wpis
          na liście składu poniżej — wtedy rocznik i statystyki wejdą przy kolejnym pobraniu.</p>
        </div>` : ''}
        ${wynik.pominietiGorsze && wynik.pominietiGorsze.length ? `<div style="border-left:3px solid var(--good);padding:8px 12px;margin-top:10px;background:var(--good-bg);font-size:12px;">
          <strong>Pominąłem ${wynik.pominietiGorsze.length} — 90minut podaje MNIEJ niż już mamy.</strong>
          <p style="margin:6px 0 0;">Dla Ekstraklasy dokładniejsze jest płatne API (liczy doliczony czas), więc nie cofam
          jego danych. ${wynik.pominietiGorsze.slice(0,6).map(x=>`${esc(x.kto)} <span class="meta">(mamy ${esc(x.mamy)}, 90minut ${esc(x.z90)})</span>`).join(' &nbsp;·&nbsp; ')}</p>
        </div>` : ''}
        ${wynik.bezDanych && wynik.bezDanych.length ? `<details style="margin-top:10px;font-size:12px;">
          <summary style="cursor:pointer;color:var(--ink-soft);">Bez liczb z tego pobrania — ${wynik.bezDanych.length} zawodników (kliknij, żeby sprawdzić)</summary>
          <p class="note" style="margin:8px 0 6px;">90minut nie wymienił ich w sprawdzonych protokołach. Zwykle znaczy to,
          że nie zagrali — ale jeśli ktoś tu jest, a wiesz, że grał, to znak, że jego nazwisko w kartotece
          różni się od zapisu na 90minut. Wtedy popraw pisownię w profilu i pobierz jeszcze raz.</p>
          <div>${wynik.bezDanych.map(x=>`${esc(x.kto)}${x.rocznik?` <span class="meta">(${esc(String(x.rocznik))})</span>`:''}`).join(' &nbsp;·&nbsp; ')}</div>
        </details>` : ''}
        ${wynik.bledyZapisu && wynik.bledyZapisu.length ? `<p class="note" style="font-size:11.5px;margin-top:8px;color:var(--clay-dark);">
          Nie udało się zapisać: ${wynik.bledyZapisu.map(b=>esc(b.kto)).join(', ')}</p>` : ''}
      ` : ''}

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
        <button class="secondary" data-x="zamknij">Zamknij</button>
        <button class="secondary" data-x="sprawdz" ${pracuje?'disabled':''}>${pracuje==='pobieranie'?'Pobieram…':'Sprawdź, co się zmieni'}</button>
        ${wynik && wynik.ok && wynik.doZapisu && !wynik.zapisani ? `<button class="gold" data-x="zapisz" ${pracuje?'disabled':''}>${pracuje==='zapis'?'Zapisuję…':`Zapisz ${wynik.doZapisu} zmian`}</button>` : ''}
      </div>
    </div>`;

    overlay.querySelector('[data-x="zamknij"]').onclick = ()=>{ overlay.remove(); render(); };
    const sprawdz = overlay.querySelector('[data-x="sprawdz"]');
    if(sprawdz) sprawdz.onclick = ()=>pobierz(false);
    const zapisz = overlay.querySelector('[data-x="zapisz"]');
    if(zapisz) zapisz.onclick = ()=>pobierz(true);

    // Dopisanie zawodników, którzy zagrali, ale nie ma ich w kartotece. To siatka bezpieczeństwa:
    // wystarczy, że ktoś wejdzie na boisko choć na minutę, a nie przepadnie tylko dlatego,
    // że nie było go na liście, z której importowano skład.
    const dopisz = overlay.querySelector('[data-x="dopisz"]');
    if(dopisz) dopisz.onclick = async ()=>{
      const nowi = (wynik.spozaBazy||[]).filter(x=>{
        const slowa = String(x.kto||'').trim().split(/\s+/);
        if(slowa.length < 2) return false;
        // Ostatnia kontrola po stronie przeglądarki — gdyby ktoś w międzyczasie został dodany ręcznie.
        return !DB.players.some(p=> p.clubId===clubId
          && importNorm(p.firstName+p.lastName) === importNorm(slowa[0]+slowa.slice(1).join('')));
      });
      if(!nowi.length){ komunikat = 'Wszyscy są już w kartotece.'; draw(); return; }
      nowi.forEach(x=>{
        const slowa = String(x.kto).trim().split(/\s+/);
        DB.players.push({
          id: uid('Z'), firstName: slowa[0], lastName: slowa.slice(1).join(' '),
          birthDate: '', birthYear: x.rocznik ? String(x.rocznik) : '', nationality: '',
          position: '', foot: '', height: null, status: '', clubId, scout: currentScout || '',
          videoLink: '', lnpLink: '', tmLink: x.adres || '',
          hasAgent: false, agencyName: '', formation: '', customFields: {},
          notes: 'Dopisany automatycznie — zagrał w meczu, a nie było go w kartotece.',
          dateAdded: new Date().toISOString().slice(0,10),
        });
      });
      pracuje = 'zapis'; komunikat = ''; draw();
      const ok = await savePlayers();
      pracuje = false;
      komunikat = ok ? `Dopisano ${nowi.length} zawodników. Kliknij ponownie „Sprawdź, co się zmieni", żeby wciągnąć ich statystyki.`
                     : 'Nie udało się zapisać — sprawdź baner u góry strony.';
      if(ok) wynik.spozaBazy = [];
      draw();
    };
  }

  async function pobierz(zapisujemy){
    pracuje = zapisujemy ? 'zapis' : 'pobieranie'; blad = ''; draw();
    try{
      // Token sesji jedzie razem z żądaniem: dzięki niemu serwer pyta bazę W TWOIM IMIENIU i
      // reguły dostępu wpuszczają go tak samo, jak przeglądarkę. Bez tego zamknięta baza nie
      // oddałaby serwerowi ani jednego wiersza.
      const token = await tokenSesji();
      const naglowkiZadania = token ? { Authorization: 'Bearer ' + token } : {};

      // ZAPIS NIE POWTARZA POBIERANIA.
      //
      // Podgląd policzył już wszystko i oddał gotowy ładunek. Odsyłamy go z powrotem, więc serwer
      // ma tylko zapisać — kilka zapytań do bazy zamiast ponownego czytania kilkudziesięciu stron
      // 90minut. Wcześniej „Zapisz" trwał tyle samo, co „Sprawdź", i potrafił przekroczyć limit
      // czasu funkcji, zostawiając przycisk w bezruchu.
      if(zapisujemy && wynik && Array.isArray(wynik.pakiet) && wynik.pakiet.length){
        const zapis = await fetch('/api/stats-90minut?clubId=' + encodeURIComponent(clubId) + '&apply=1',
          { method: 'POST', signal: AbortSignal.timeout(60000),
            headers: { ...naglowkiZadania, 'Content-Type': 'application/json' },
            body: JSON.stringify({ pakiet: wynik.pakiet }) });
        const odp = await zapis.json().catch(()=>({ error: 'Serwer nie zwrócił danych.' }));
        if(!zapis.ok || odp.error){ blad = odp.error || ('Serwer odpowiedział kodem ' + zapis.status + '.'); return; }

        // ZAPISANE LICZBY NANOSIMY NA PAMIĘĆ APLIKACJI, ZAMIAST WCZYTYWAĆ CAŁĄ BAZĘ OD NOWA.
        //
        // loadAll() ściąga wszystkich zawodników, kluby, obserwacje i raporty — przy tej wielkości
        // bazy to kilka sekund czekania po zapisie, który sam trwa chwilę. A wiemy dokładnie, co
        // się zmieniło: to ten sam ładunek, który przed sekundą poszedł na serwer.
        wynik.pakiet.forEach(poz=>{
          const gracz = DB.players.find(x=>x.id===poz.id);
          if(!gracz || !poz.dane) return;
          const dane = poz.dane;
          if(dane.matches !== undefined) gracz.matches = dane.matches;
          if(dane.minutes !== undefined) gracz.minutes = dane.minutes;
          if(dane.goals !== undefined) gracz.goals = dane.goals;
          if(dane.birth_year) gracz.birthYear = String(dane.birth_year);
          // Pola schowane w __ext (kartki, dorobek sezonowy, znacznik źródła) leżą na zawodniku
          // płasko — dokładnie tak, jak rozpakowuje je warstwa odczytu przy wczytywaniu bazy.
          const cf = { ...(dane.custom_fields || {}) };
          const ext = cf.__ext || {};
          delete cf.__ext;
          gracz.customFields = cf;
          Object.keys(ext).forEach(k=>{ gracz[k] = ext[k]; });
        });
        pracuje = false;
        overlay.remove();
        render();
        const nieudane = (odp.bledyZapisu||[]).length;
        alert(`Zapisano dorobek ${odp.zapisani} zawodnikom.` + (nieudane ? ` Nie udało się zapisać ${nieudane}.` : ''));
        return;
      }
      // Limit czasu po stronie przeglądarki. Bez niego nieudane wywołanie zostawiało przycisk
      // na „Pobieram…" bez końca i wyglądało to dokładnie jak „nie zapisuje" — użytkownik nie
      // miał jak odróżnić trwającej pracy od zawieszenia.
      const res = await fetch('/api/stats-90minut?clubId=' + encodeURIComponent(clubId) + (zapisujemy?'&apply=1':''),
        { signal: AbortSignal.timeout(90000), headers: naglowkiZadania });
      const typ = res.headers.get('content-type') || '';
      if(!typ.includes('application/json')){
        throw new Error('serwer nie zwrócił danych (prawdopodobnie przekroczony limit czasu funkcji). Spróbuj ponownie — druga próba jest szybsza, bo część stron jest już w pamięci podręcznej.');
      }
      const dane = await res.json();
      wynik = dane;
      // Podpowiedź z serwera mówi, CO ZROBIĆ (np. brakuje klucza serwisowego w Vercelu) — bez niej
      // zostawał sam komunikat „nie ma takiego klubu", z którego nic nie wynika.
      if(!res.ok || dane.error){
        blad = (dane.error || ('Serwer odpowiedział kodem ' + res.status + '.'))
             + (dane.podpowiedz ? ' ' + dane.podpowiedz : '');
      }
      // Po udanym zapisie okno zamyka się samo. Zostawianie go otwartego zmuszało do
      // dodatkowego kliknięcia i nie niosło już żadnej informacji — wynik widać w tabeli.
      if(zapisujemy && dane.zapisani){
        await loadAll();
        pracuje = false;
        overlay.remove();
        render();
        const ile = dane.zapisani;
        const roczniki = dane.rocznikiDoUzupelnienia ? ` Uzupełniłem też ${dane.rocznikiDoUzupelnienia} roczników.` : '';
        const pominiete = (dane.pominietiGorsze||[]).length
          ? ` Pominąłem ${dane.pominietiGorsze.length}, bo 90minut podaje mniej niż już mamy.` : '';
        alert(`Zapisano dorobek ${ile} zawodnikom.${roczniki}${pominiete}`);
        return;
      }
    }catch(e){
      blad = (e && e.name === 'TimeoutError')
        ? 'Przekroczono czas oczekiwania (90 s). Pobieranie z 90minut trwało za długo — spróbuj ponownie.'
        : 'Nie udało się połączyć z serwerem: ' + (e && e.message ? e.message : e);
    }finally{
      pracuje = false; draw();
    }
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay){ overlay.remove(); render(); } });
  document.body.appendChild(overlay);
  draw();
}

function openSquadStatsModal(clubId){
  const club = DB.clubs.find(c=>c.id===clubId);
  if(!club) return;
  const squad = DB.players.filter(p=>p.clubId===clubId);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
  <div class="modal" style="max-width:680px;">
    <h3>⏱ Statystyki drużyny — ${esc(club.name)}</h3>
    ${club.profileTm ? '' : `
    <div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:10px;background:var(--card-soft);">
      <label class="field" style="display:block;margin-bottom:5px;">Jednorazowo: wklej adres tego klubu z Transfermarktu</label>
      <div style="display:flex;gap:8px;">
        <input id="tm-club-url" placeholder="https://www.transfermarkt.pl/lech-posen/startseite/verein/238" style="flex:1;font-size:11.5px;">
        <button class="secondary" data-action="save-tm-url" style="white-space:nowrap;">Zapisz</button>
      </div>
      <div class="note" style="margin-top:5px;font-size:11px;">Skopiuj adres z paska przeglądarki, będąc na stronie klubu.
      Zapiszę go i od tej pory link poniżej będzie prowadził prosto do statystyk — bez szukania w menu.</div>
    </div>`}
    <ol style="font-size:12.5px;line-height:1.8;padding-left:18px;margin:6px 0 10px;">
      <li><a class="ext-link" href="${esc(tmStatsLink(club))}" target="_blank" rel="noopener">${club.profileTm?'Otwórz statystyki drużynowe':'Znajdź klub na Transfermarkt'} &rarr;</a></li>
      ${club.profileTm ? '' : `<li>Wejdź w klub, a potem w dolnym menu w <strong>STATYSTYKI</strong>
        <span style="color:var(--ink-soft);">— albo w adresie zamień <code>startseite</code> na <code>leistungsdaten</code></span></li>`}
      <li>Zaznacz myszą tabelę zawodników: od pierwszego nazwiska do ostatniego wiersza</li>
      <li><strong>Ctrl+C</strong>, a potem <strong>Ctrl+V</strong> w polu poniżej</li>
    </ol>
    <p class="note" style="font-size:11.5px;">Potrzebne kolumny to <strong>Mecze</strong>, <strong>Bramki</strong> i
    <strong>Minuty</strong> (liczby z apostrofem, np. <code>1.980'</code>). Nagłówków nie musisz zaznaczać —
    wiersze dopasowuję po nazwisku do ${squad.length} zawodników tego klubu, a czego nie rozpoznam, to pominę i wypiszę.</p>
    <div style="border-left:3px solid var(--gold-dark);padding:8px 12px;margin:10px 0;background:var(--card-soft);font-size:12px;">
      <strong>Dla polskich lig nie musisz tego robić.</strong> Zamknij to okno i kliknij
      <strong>⏱ Statystyki z 90minut</strong> — mecze, minuty, bramki i kartki pobiorą się same.
      Ta wklejka jest zapasem dla klubów zagranicznych, których 90minut nie prowadzi.
    </div>
    <div class="field-wrap" style="margin-bottom:14px;">
      <textarea id="squad-stats-paste" rows="12" placeholder="Lewandowski   24   18   5   3   1   1.980'&#10;Zieliński     22    4   7   2   0   1.755'" style="font-size:12px;font-family:monospace;"></textarea>
    </div>
    <div id="squad-stats-preview"></div>
    <div class="modal-actions">
      <button class="gold" data-action="squad-stats-parse">Rozpoznaj</button>
      <button class="secondary" data-action="close-modal">Anuluj</button>
    </div>
  </div>`;

  let parsed = null;
  const close = ()=>{ overlay.remove(); render(); };
  overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=close);
  overlay.addEventListener('click', e=>{ if(e.target===overlay) close(); });

  const preview = overlay.querySelector('#squad-stats-preview');
  const actionBtn = overlay.querySelector('[data-action="squad-stats-parse"]');

  // Zapis adresu klubu z Transfermarktu — jednorazowo, żeby kolejne wejścia prowadziły od razu
  // do zakładki ze statystykami zamiast do wyszukiwarki.
  overlay.querySelectorAll('[data-action="save-tm-url"]').forEach(b=>b.onclick=async()=>{
    const val = (overlay.querySelector('#tm-club-url') as HTMLInputElement).value.trim();
    if(!/transfermarkt\.[a-z.]+\/.+\/verein\/\d+/i.test(val)){
      alert('To nie wygląda na adres klubu z Transfermarktu.\n\nPowinien zawierać „/verein/" i numer, np.\nhttps://www.transfermarkt.pl/lech-posen/startseite/verein/238');
      return;
    }
    club.profileTm = val;
    const ok = await saveClubs();
    if(!ok){ alert('Nie udało się zapisać adresu.'); return; }
    overlay.remove();
    openSquadStatsModal(clubId);   // przerysuj z aktywnym linkiem bezpośrednim
  });

  actionBtn.onclick = async ()=>{
    if(!parsed){
      const text = (overlay.querySelector('#squad-stats-paste') as HTMLTextAreaElement).value.trim();
      if(!text){ alert('Wklej najpierw tabelę statystyk.'); return; }
      if(wygladaNaProtokolMeczu(text)){
        preview.innerHTML = komunikatOProtokole();
        parsed = null; return;
      }
      parsed = parseSquadStatsText(text, squad);
      if(!parsed.results.length){
        preview.innerHTML = `<div class="empty">Nie dopasowałem żadnego wiersza do zawodników tego klubu.
          ${parsed.unmatched.length?`Nierozpoznane: ${esc(parsed.unmatched.slice(0,5).join(', '))}`:''}</div>`;
        parsed = null; return;
      }
      preview.innerHTML = `<table style="width:100%;font-size:12.5px;">
        <tr><th>Zawodnik</th><th style="text-align:right;">Mecze</th><th style="text-align:right;">Minuty</th><th style="text-align:right;">Gole</th><th style="text-align:right;">Asysty</th></tr>
        ${parsed.results.map(r=>`<tr><td>${esc(r.player.lastName)} ${esc(r.player.firstName)}</td>
          <td style="text-align:right;">${r.stats.matches!=null?r.stats.matches:'—'}</td>
          <td style="text-align:right;"><strong>${r.stats.minutes!=null?r.stats.minutes:'—'}</strong></td>
          <td style="text-align:right;">${r.stats.goals!=null?r.stats.goals:'—'}</td>
          <td style="text-align:right;">${r.stats.assists!=null?r.stats.assists:'—'}</td></tr>`).join('')}
      </table>
      ${parsed.withoutStats.length?`<p class="note" style="margin-top:8px;">Bez minut w tym sezonie (pomijam): ${esc(parsed.withoutStats.join(', '))}.</p>`:''}
      ${parsed.unmatched.length?`<p class="note" style="margin-top:4px;">Nie dopasowano ${parsed.unmatched.length} wierszy — te zostaną pominięte.</p>`:''}`;
      actionBtn.textContent = `✓ Zapisz dla ${parsed.results.length} zawodników`;
      return;
    }

    parsed.results.forEach(({player, stats})=>{
      if(stats.minutes !== undefined) player.minutes = stats.minutes;
      if(stats.matches !== undefined) player.matches = stats.matches;
      if(stats.goals !== undefined) player.goals = stats.goals;
      if(stats.assists !== undefined) player.assists = stats.assists;
      player.statsUpdatedAt = new Date().toISOString();
      player.statsSource = 'wklejone ręcznie';
    });
    const ok = await savePlayers();
    alert(ok ? `Zapisano statystyki dla ${parsed.results.length} zawodników.` : 'Nie udało się zapisać.');
    if(ok) close();
  };

  document.body.appendChild(overlay);
}

function openPasteStatsModal(playerId){
  const p = DB.players.find(x=>x.id===playerId);
  if(!p) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  function closeAndRefresh(){ overlay.remove(); render(); }

  // Krok 1: import po wklejeniu linku. Zapisuje adres w odpowiednim polu profilu, a dla 90minut
  // od razu ściąga liczby przez /api/stats (ten sam pośrednik, co odświeżanie cykliczne).
  async function importStatsFromLink(btn){
    const input = overlay.querySelector('#stats-link') as HTMLInputElement;
    const status = overlay.querySelector('#link-status');
    // Normalizujemy od razu, żeby do bazy nie trafił adres 90minut z https:// — taki link
    // nigdy się nie pobierze, a wpadłby do cyklicznego odświeżania co 6 h i padał przy każdym przebiegu.
    const raw = normalizuj90minut((input.value||'').trim());
    if(!raw){ alert('Wklej najpierw link do profilu zawodnika.'); return; }
    input.value = raw;

    const src = detectStatsSource(raw);
    if(src.kind === 'invalid'){ alert('To nie wygląda na poprawny adres URL.'); return; }
    if(src.kind === 'unknown'){
      alert(`Nieobsługiwany serwis: ${src.host}\n\nObsługiwane: 90minut.pl (automatycznie), Transfermarkt i Łączy nas piłką (zapis linku).`);
      return;
    }

    // Transfermarkt / ŁNP — zapisujemy sam link, bez udawania, że pobraliśmy liczby.
    if(src.kind !== '90minut'){
      p[src.field] = raw;
      const ok = await savePlayers();
      status.innerHTML = ok
        ? `✓ Zapisano link do <strong>${esc(src.label)}</strong> w profilu.<br>
           <span style="color:var(--clay-dark);">Statystyk z tego serwisu nie da się pobrać automatycznie — liczby wklej w kroku 2 poniżej.</span>`
        : '<span style="color:var(--clay-dark);">Nie udało się zapisać linku.</span>';
      return;
    }

    const prevLabel = btn.textContent;
    btn.disabled = true; btn.textContent = 'Pobieram…';
    status.textContent = 'Łączę się z 90minut.pl…';
    try{
      p.lnpLink = raw;                       // zapis linku włącza też odświeżanie cykliczne co 6 h
      const { data } = await fetchStatsFor(p);
      const ok = await savePlayers();
      if(!ok) throw new Error('Nie udało się zapisać danych w bazie.');
      status.innerHTML = `✓ Pobrano z 90minut.pl (sezon ${esc(data.season||'—')}):
        <strong>${data.matches!=null?data.matches:'—'}</strong> mecze,
        <strong>${data.goals!=null?data.goals:'—'}</strong> goli.<br>
        <span style="color:var(--ink-soft);">To tabela kariery — bez minut i kartek. Po nie wejdź w klub i kliknij „⏱ Statystyki z 90minut".</span>`;
      render();
    }catch(e){
      status.innerHTML = `<span style="color:var(--clay-dark);">Nie udało się pobrać: ${esc(e.message)}</span>`;
    }finally{
      btn.disabled = false; btn.textContent = prevLabel;
    }
  }

  function draw(){
    overlay.innerHTML = `
    <div class="modal" style="max-width:600px;">
      <h3>Statystyki — ${esc(p.firstName)} ${esc(p.lastName)}</h3>

      <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px;background:var(--card-soft);">
        <label class="field" style="display:block;margin-bottom:6px;">1. Wklej link do profilu zawodnika</label>
        <div style="display:flex;gap:8px;">
          <input id="stats-link" placeholder="http://www.90minut.pl/kariera.php?id=..." value="${esc(p.lnpLink||p.tmLink||'')}" style="flex:1;font-size:12px;">
          <button class="gold" data-action="fetch-from-link" style="white-space:nowrap;">⬇ Pobierz</button>
        </div>
        <div id="link-status" class="note" style="margin-top:8px;font-size:11.5px;">
          <strong>90minut.pl</strong> — pobiera mecze i bramki automatycznie i zapisuje link do odświeżania co 6 h.<br>
          <strong>Transfermarkt</strong> i <strong>Łączy nas piłką</strong> — liczb nie ma w kodzie strony (dorysowuje je JavaScript),
          więc link zostaje zapisany w profilu, ale same statystyki wklej w kroku 2.
        </div>
      </div>

      <label class="field" style="display:block;margin-bottom:6px;">2. Albo wklej statystyki tekstem</label>
      <p class="note" style="font-size:11px;color:var(--ink-soft);margin-top:0;">Parser wyciąga: Mecze, Minuty, Gole, Asysty, Kartki żółte i czerwone — z dowolnego formatu.</p>
      <div class="field-wrap" style="margin-bottom:14px;">
        <label class="field">Wklej statystyki (np. z Transfermarkt, 90minut, ŁNP)</label>
        <textarea id="stats-paste" rows="10" placeholder="Appearances 15&#10;Minutes played 1350&#10;Goals 5&#10;Assists 3&#10;&#10;lub:&#10;15 mecze 1350 minut 5 goli 3 asysty&#10;&#10;lub jakolwiek inny format — parser się domyśli" style="font-size:12px;font-family:monospace;"></textarea>
      </div>
      <div class="modal-actions">
        <button class="gold" data-action="parse-stats">✓ Wczytaj statystyki</button>
        <button class="secondary" data-action="close-modal">Anuluj</button>
      </div>
    </div>`;
    wire();
  }

  function wire(){
    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=closeAndRefresh);
    overlay.querySelectorAll('[data-action="fetch-from-link"]').forEach(b=>b.onclick=()=>importStatsFromLink(b));
    overlay.querySelectorAll('[data-action="parse-stats"]').forEach(b=>b.onclick=()=>{
      const textarea = overlay.querySelector('#stats-paste') as HTMLTextAreaElement;
      const text = textarea.value.trim();
      if(!text){ alert('Wklej dane statystyk!'); return; }

      const parsed = parseStatsText(text);
      if(!Object.keys(parsed).length){ alert('Nie udało się wyciągnąć statystyk. Spróbuj innego formatu.'); return; }

      if(parsed.matches !== undefined) p.matches = parsed.matches;
      if(parsed.minutes !== undefined) p.minutes = parsed.minutes;
      if(parsed.goals !== undefined) p.goals = parsed.goals;
      if(parsed.assists !== undefined) p.assists = parsed.assists;
      if(parsed.yellowCards !== undefined) p.yellowCards = parsed.yellowCards;
      if(parsed.redCards !== undefined) p.redCards = parsed.redCards;

      savePlayers().then(ok=>{
        if(ok){
          alert(`✓ Wczytano statystyki!\nMecze: ${parsed.matches||p.matches||'—'}\nMinuty: ${parsed.minutes||p.minutes||'—'}\nGole: ${parsed.goals||p.goals||'—'}\nAsysty: ${parsed.assists||p.assists||'—'}`);
          closeAndRefresh();
        } else {
          alert('Nie udało się zapisać statystyk.');
        }
      });
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeAndRefresh(); });
  document.body.appendChild(overlay);
  draw();
}

// Rozpoznaje statystyki sezonowe w tekście skopiowanym ze strony (Transfermarkt, 90minut, ŁNP).
// Obsługuje trzy układy: "Etykieta 15", "15 etykieta" oraz etykieta i liczba w osobnych liniach
// (tak wychodzi kopiowanie tabeli z Transfermarktu). Liczby bywają z separatorem tysięcy i
// apostrofem minut — "1.350'" / "1 350" — więc separatory usuwamy przed parsowaniem.
// Kartki idą PRZED golami: "żółte kartki" zawiera słowo, które przy luźniejszym wzorcu potrafiłoby
// wpaść w inną kategorię — dopasowujemy najbardziej szczegółowe etykiety najpierw.
const STATS_PATTERNS: [string, string][] = [
  ['(?:żółte|zolte|zółte) kartki|kartki (?:żółte|zolte)|yellow cards|żółtych kartek|kartek żółtych', 'yellowCards'],
  ['czerwone kartki|kartki czerwone|red cards|czerwonych kartek|kartek czerwonych', 'redCards'],
  ['appearances|matches|mecze|mecz(?:ow|y)|spotkania|wystepy|występy', 'matches'],
  ['minutes played|minutes|minuty|minut|rozegrane minuty', 'minutes'],
  ['goals scored|goals|gole|goli|bramki|bramek', 'goals'],
  ['assists|asysty|asyst|podania kluczowe', 'assists'],
];

function statsNumber(raw){
  const n = parseInt(String(raw).replace(/[.\s'’]/g, ''), 10);
  return isNaN(n) ? undefined : n;
}

function parseStatsText(text){
  const result: any = {};
  const lines = text.split(/[\n;]+/).map(l=>l.trim()).filter(Boolean);

  for(const [pattern, key] of STATS_PATTERNS){
    // 1) etykieta i liczba w tej samej linii — w dowolnej kolejności
    for(const line of lines){
      const after = line.match(new RegExp(`(?:${pattern})\\D{0,12}?([\\d.\\s']+)`, 'i'));
      const before = line.match(new RegExp(`([\\d.\\s']+?)\\s*(?:${pattern})`, 'i'));
      const num = statsNumber((after && after[1]) || (before && before[1]) || '');
      if(num !== undefined){ result[key] = num; break; }
    }
    if(result[key] !== undefined) continue;

    // 2) etykieta w jednej linii, liczba w następnej (kopiowana tabela)
    for(let i = 0; i < lines.length - 1; i++){
      if(new RegExp(`^\\s*(?:${pattern})\\s*:?\\s*$`, 'i').test(lines[i])){
        const num = statsNumber(lines[i+1]);
        if(num !== undefined){ result[key] = num; break; }
      }
    }
  }

  return result;
}

// Przypisanie klubu z importu: najpierw szukamy istniejącego (po nazwie znormalizowanej, więc
// "AF Brzoza" i "AF BRZOZA" to ten sam klub), a gdy go nie ma — zakładamy nowy w tej kategorii.
// Bez tego zawodnicy wchodzili z pustym klubem i lista rocznika była bezużyteczna.
function resolveClubForImport(name, league, created){
  const clean = String(name||'').trim();
  if(!clean) return null;
  const norm = (s)=> String(s||'').toLowerCase()
    .replace(/[łøđ]/g, c=>({'ł':'l','ø':'o','đ':'d'}[c]))
    .normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]/g,'');
  const key = norm(clean);
  // Szukamy WYŁĄCZNIE w tej samej kategorii. Wcześniej dopasowanie szło po całej bazie, więc
  // „CHEMIK BYDGOSZCZ" z listy rocznika 2013 trafiał do seniorskiego Chemika z III ligi i dzieci
  // lądowały w składzie seniorów. Drużyna młodzieżowa to osobny byt, nawet przy tej samej nazwie.
  const found = DB.clubs.find(c=> c.league === league && norm(c.name) === key);
  if(found) return found.id;
  const club = { id: uid('K'), name: clean, region: '', league: league || '', season: '', city: '' };
  DB.clubs.push(club);
  if(created) created.push(clean);
  return club.id;
}

function parseRocznikTextLines(text){
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  const results = [];
  let current = {};
  const norm = (s)=> String(s||'').toLowerCase().replace(/[ąćęłńóśźż]/g, c=>({ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z'}[c])).replace(/[^a-z0-9]/g,'');

  for(const line of lines){
    const clean = line.replace(/^\d+\.?\s*/, '').trim();
    if(!clean) continue;
    if(/^\d{4}$/.test(clean)){ current.birthYear = clean; }
    else if(/(bramkarz|obron|pomocnik|napastnik|bramka|def|mid|for|forward|back|defender)/i.test(clean)){
      current.position = mapSquadPosition(clean) || clean;
    }
    else if(clean.length > 2 && !/\s/.test(clean) && !current.firstName){
      current.firstName = clean;
    }
    else if(clean.length > 2 && !current.lastName && current.firstName){
      current.lastName = clean;
      if(current.firstName && current.lastName){
        results.push({ ok: true, firstName: current.firstName, lastName: current.lastName, position: current.position||'', nationality: '' });
        current = {};
      }
    }
  }

  // Parsuj też format tabelaryczny (Lp, Nazwisko, Imię...)
  const headerLine = lines[0];
  if(headerLine && (headerLine.includes('Nazwisko') || headerLine.includes('Imię'))){
    results.length = 0;
    const lines2 = text.split('\n').map(l=>l.trim()).filter(Boolean);
    for(let i=1; i<lines2.length; i++){
      const parts = lines2[i].split(/\t+|\s{2,}/);
      if(parts.length >= 3){
        let nameIdx=0, firstIdx=1, yearIdx=2, posIdx=-1;
        // Spróbuj znaleźć poprawny porządek
        const header = lines2[0].toLowerCase();
        if(header.includes('nazwisko') && header.includes('imię')){
          nameIdx = header.indexOf('nazwisko') > header.indexOf('imię') ? 1 : 0;
          firstIdx = nameIdx===0 ? 1 : 0;
        }
        const lastName = (parts[nameIdx]||'').replace(/^\d+\.?\s*/,'').trim();
        const firstName = (parts[firstIdx]||'').trim();
        const year = (parts[yearIdx]||'').match(/\d{4}/)?.[0]||'';
        const pos = posIdx>=0 ? (parts[posIdx]||'').trim() : '';
        if(firstName && lastName){
          results.push({ ok: true, firstName, lastName, position: pos || '', nationality: '' });
        }
      }
    }
  }

  return results.length ? results : [];
}

function openRocznikExcelImport(rocznikGroup){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const year = rocznikGroup.match(/\d{4}/)[0];
  let importMode = 'file';

  function closeAndRefresh(){ overlay.remove(); render(); }

  function draw(){
    overlay.innerHTML = `
    <div class="modal" style="max-width:700px;">
      <h3>Import zawodników — ${esc(rocznikGroup)}</h3>
      <div style="display:flex;gap:8px;margin-bottom:14px;">
        <button class="gold" data-action="mode-file" style="${importMode==='file'?'':'opacity:0.6;'}">📋 Plik Excel/CSV</button>
        <button class="gold" data-action="mode-text" style="${importMode==='text'?'':'opacity:0.6;'}">📝 Wklej tekst</button>
      </div>
      ${importMode==='file' ? `
        <div class="field-wrap" style="margin-bottom:14px;">
          <label class="field">Wgraj plik Excel / CSV — rozpoznaję m.in. Nazwisko, Imię, Rocznik, Pozycja, Aktualny klub, <strong>Menedżer</strong> (Tak/Nie), Agencja</label>
          <input type="file" id="rocznik-file" accept=".xlsx,.xls,.csv">
        </div>
        <div class="modal-actions">
          <button class="gold" data-action="rocznik-import-go">Importuj z pliku</button>
          <button class="secondary" data-action="close-modal">Anuluj</button>
        </div>
      ` : `
        <p class="note" style="margin-top:0;">Zaznacz w Excelu tabelę <strong>razem z wierszem nagłówków</strong>
        (Nazwisko, Imię, Aktualny klub…), skopiuj <strong>Ctrl+C</strong> i wklej poniżej.
        Rozpoznaję te same kolumny co przy wgrywaniu pliku — to droga awaryjna, gdy plik się nie wczytuje.<br>
        Jeśli w arkuszu jest kolumna <strong>Menedżer</strong> (Tak/Nie) albo <strong>Agencja</strong>, wczytam ją razem z resztą.</p>
        <div class="field-wrap" style="margin-bottom:14px;">
          <label class="field">Wklej zaznaczoną tabelę z Excela</label>
          <textarea id="rocznik-paste" rows="12" placeholder="Lp.&#9;Nazwisko&#9;Imię&#9;Rok urodzenia&#9;Pozycja boiskowa&#9;Aktualny klub&#10;1&#9;NOWICKI&#9;KAROL&#9;2013&#9;Bramkarz&#9;AF BRZOZA&#10;2&#9;BIAŁKOWSKI&#9;DAWID&#9;2013&#9;&#9;CHEMIK BYDGOSZCZ" style="font-size:12px;font-family:monospace;"></textarea>
        </div>
        <div class="modal-actions">
          <button class="gold" data-action="rocznik-paste-go">Importuj z tekstu</button>
          <button class="secondary" data-action="close-modal">Anuluj</button>
        </div>
      `}
    </div>`;
    wire();
  }

  function wire(){
    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=closeAndRefresh);
    overlay.querySelectorAll('[data-action="mode-file"]').forEach(b=>b.onclick=()=>{ importMode='file'; draw(); });
    overlay.querySelectorAll('[data-action="mode-text"]').forEach(b=>b.onclick=()=>{ importMode='text'; draw(); });
    overlay.querySelectorAll('[data-action="rocznik-paste-go"]').forEach(b=>b.onclick=async()=>{
      const textarea = overlay.querySelector('#rocznik-paste') as any;
      const text = textarea.value.trim();
      if(!text){ alert('Wklej listę zawodników!'); return; }
      try{
        // Ta sama ścieżka co przy pliku: wklejenie z Excela to po prostu tabela rozdzielona
        // tabulatorami, więc po zamianie na wiersze idzie przez ten sam parser kolumn.
        // Gdy nagłówków brak, wracamy do dawnego formatu pionowego (nazwisko/imię w osobnych liniach).
        let parsed;
        const rows = pastedTableToRows(text);
        try{ parsed = rows.length ? parseSquadWorkbookRows(rows) : []; }
        catch{ parsed = []; }
        if(!parsed.length) parsed = parseRocznikTextLines(text);

        const toAdd = parsed.filter(p=>p.firstName && p.lastName);
        if(!toAdd.length){ alert('Nie rozpoznałem żadnego zawodnika.\n\nUpewnij się, że zaznaczyłeś w Excelu także wiersz nagłówków (Nazwisko, Imię…).'); return; }
        const orig = b.textContent; b.disabled = true; b.textContent = 'Importowanie...';
        let added = 0, updated = 0;
        const createdClubs = [];
        const nkey = (f,l)=> importNorm(f) + '|' + importNorm(l);
        toAdd.forEach(p=>{
          const clubId = resolveClubForImport(p.club, rocznikGroup, createdClubs);
          const existing = DB.players.find(pl=> String(pl.birthYear||'')===String(year) && nkey(pl.firstName,pl.lastName)===nkey(p.firstName,p.lastName));
          if(existing){
            let touched = false;
            if(!existing.clubId && clubId){ existing.clubId = clubId; touched = true; }
            if(!existing.position && p.position){ existing.position = p.position; touched = true; }
            if(!existing.status && p.status){ existing.status = p.status; touched = true; }
            if(existing.powolania==null && p.powolania!=null){ existing.powolania = p.powolania; touched = true; }
            if(!existing.notes && p.info){ existing.notes = p.info; touched = true; }
            // Menedżer: uzupełniamy tylko wtedy, gdy arkusz coś o tym mówi (p.hasAgent !== null).
            // Pustej kolumny nie czytamy jako „nie ma" — to zmazywałoby ustalenia z wcześniejszej pracy.
            if(p.hasAgent !== null && p.hasAgent !== undefined && !existing.hasAgent && p.hasAgent){
              existing.hasAgent = true; touched = true;
            }
            if(!existing.agencyName && p.agencyName){ existing.agencyName = p.agencyName; touched = true; }
            if(touched) updated++;
            return;
          }
          DB.players.push({
            id: uid('Z'), firstName: p.firstName, lastName: p.lastName,
            birthDate: '', birthYear: p.birthYear || year, nationality: p.nationality || '',
            position: p.position || '', foot: '', height: null,
            status: p.status || '', clubId, scout: currentScout || '',
            powolania: p.powolania ?? null,
            videoLink: '', lnpLink: '', tmLink: '',
            hasAgent: p.hasAgent === true, agencyName: p.agencyName || '',
            formation: '', customFields: {}, notes: p.info || '',
            dateAdded: new Date().toISOString().slice(0,10)
          });
          added++;
        });
        const okClubs = createdClubs.length ? await saveClubs() : true;
        const ok = okClubs && await savePlayers();
        if(ok){
          alert(`Dodano nowych: ${added}` +
            (updated ? `\nUzupełniono istniejących: ${updated}` : '') +
            (createdClubs.length ? `\nZałożono ${createdClubs.length} nowych klubów: ${createdClubs.slice(0,6).join(', ')}${createdClubs.length>6?'…':''}` : ''));
          closeAndRefresh();
        } else {
          b.disabled = false; b.textContent = orig;
          alert('Nie udało się zapisać.');
        }
      }catch(e){
        b.disabled = false; b.textContent = 'Importuj z tekstu';
        alert('Błąd: ' + ((e as any).message||e));
      }
    });
    overlay.querySelectorAll('[data-action="rocznik-import-go"]').forEach(b=>b.onclick=async()=>{
      const fileInput = overlay.querySelector('#rocznik-file') as any;
      if(!fileInput.files[0]){ alert('Wybierz plik!'); return; }
      const file = fileInput.files[0];
      try{
        if(!XLSX) throw new Error('Biblioteka nie dostępna.');
        const buf = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(new Error('Nie udało się wczytać.')); r.readAsArrayBuffer(file); });
        const wb = XLSX.read(buf, {type:'array'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        if(!sheet) throw new Error('Brak arkusza.');
        const rows = workbookToRows(wb);
        const parsed = parseSquadWorkbookRows(rows);
        const toAdd = parsed.filter(p=>p.ok);
        if(!toAdd.length){ alert('Brak prawidłowych zawodników.'); return; }
        const orig = b.textContent; b.disabled = true; b.textContent = 'Importowanie...';
        let added = 0, updated = 0;
        const createdClubs = [];
        const withoutClub = [];
        // Nazwiska porównujemy bez względu na wielkość liter i znaki diakrytyczne — w arkuszach
        // ZPN bywają pisane wersalikami ("BIAŁKOWSKI"), a w bazie normalnie ("Białkowski").
        const nkey = (f,l)=> String(f||'').toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z]/g,'')
          + '|' + String(l||'').toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z]/g,'');
        // Arkusze ZPN mieszają roczniki w jednym wykazie (2012, 2013 i 2014 obok siebie). Wcześniej
        // wszyscy dostawali rocznik z nazwy otwartej kategorii, przez co „Rocznik 2013" puchł
        // o zawodników z innych lat. Bierzemy WYŁĄCZNIE wiersze z rocznikiem tej kategorii;
        // wiersz bez podanego roku traktujemy jako należący do niej.
        const innyRocznik = {};
        const zTegoRocznika = toAdd.filter(p=>{
          if(p.birthYear && String(p.birthYear) !== String(year)){
            innyRocznik[p.birthYear] = (innyRocznik[p.birthYear]||0) + 1;
            return false;
          }
          return true;
        });
        if(!zTegoRocznika.length){
          b.disabled = false; b.textContent = orig;
          alert(`W pliku nie ma nikogo z rocznika ${year}.\n\nZnalezione roczniki: ` +
            Object.entries(innyRocznik).map(([r,n])=>`${r} (${n})`).join(', '));
          return;
        }
        zTegoRocznika.forEach(p=>{
          const clubId = resolveClubForImport(p.club, rocznikGroup, createdClubs);
          if(!clubId) withoutClub.push(p.lastName);
          const rocznikZawodnika = year;
          // Zawodnik już jest? UZUPEŁNIJ brakujące pola zamiast pomijać. Wcześniej powtórne
          // wgranie tego samego pliku nie robiło nic, więc dane z pierwszego, wadliwego importu
          // (bez klubu) zostawały na zawsze. Wypełnionych pól nie nadpisujemy.
          const existing = DB.players.find(pl=> String(pl.birthYear||'')===String(rocznikZawodnika) && nkey(pl.firstName,pl.lastName)===nkey(p.firstName,p.lastName));
          if(existing){
            let touched = false;
            if(!existing.clubId && clubId){ existing.clubId = clubId; touched = true; }
            if(!existing.position && p.position){ existing.position = p.position; touched = true; }
            if(!existing.status && p.status){ existing.status = p.status; touched = true; }
            if(existing.powolania==null && p.powolania!=null){ existing.powolania = p.powolania; touched = true; }
            if(!existing.notes && p.info){ existing.notes = p.info; touched = true; }
            // Menedżer: uzupełniamy tylko wtedy, gdy arkusz coś o tym mówi (p.hasAgent !== null).
            // Pustej kolumny nie czytamy jako „nie ma" — to zmazywałoby ustalenia z wcześniejszej pracy.
            if(p.hasAgent !== null && p.hasAgent !== undefined && !existing.hasAgent && p.hasAgent){
              existing.hasAgent = true; touched = true;
            }
            if(!existing.agencyName && p.agencyName){ existing.agencyName = p.agencyName; touched = true; }
            if(touched) updated++;
            return;
          }
          DB.players.push({
            id: uid('Z'), firstName: p.firstName, lastName: p.lastName,
            birthDate: '', birthYear: rocznikZawodnika, nationality: p.nationality || '',
            position: p.position || '', foot: '', height: null,
            status: p.status || '', clubId, scout: currentScout || '',
            powolania: p.powolania ?? null,
            videoLink: '', lnpLink: '', tmLink: '',
            hasAgent: p.hasAgent === true, agencyName: p.agencyName || '',
            formation: '', customFields: {}, notes: p.info || '',
            dateAdded: new Date().toISOString().slice(0,10)
          });
          added++;
        });
        // Kluby zapisujemy PRZED zawodnikami — inaczej zawodnik wskazywałby na klub,
        // którego nie ma jeszcze w bazie.
        const okClubs = createdClubs.length ? await saveClubs() : true;
        const ok = okClubs && await savePlayers();
        if(ok){
          const pominięte = Object.entries(innyRocznik);
          const zAgentem = zTegoRocznika.filter(p=>p.hasAgent === true).length;
          const bezInfo = zTegoRocznika.filter(p=>p.hasAgent === null || p.hasAgent === undefined).length;
          alert(`Rocznik ${year} — dodano nowych: ${added}` +
            (updated ? `\nUzupełniono istniejących: ${updated}` : '') +
            (zAgentem ? `\n\nZ menedżerem: ${zAgentem}` +
              (bezInfo ? ` (u ${bezInfo} arkusz nic o tym nie mówił — zostawiam do ręcznego zaznaczenia)` : '') : '') +
            (pominięte.length ? `\n\nPominięto inne roczniki z pliku: ` +
              pominięte.sort().map(([r,n])=>`${r} — ${n}`).join(', ') +
              `.\nWgraj je z poziomu ich własnych kategorii.` : '') +
            (createdClubs.length ? `\n\nZałożono ${createdClubs.length} nowych klubów: ${createdClubs.slice(0,6).join(', ')}${createdClubs.length>6?'…':''}` : '') +
            (withoutClub.length ? `\nBez klubu (pusta kolumna w pliku): ${withoutClub.length}` : ''));
          closeAndRefresh();
        } else {
          b.disabled = false; b.textContent = orig;
          alert('Nie udało się zapisać.');
        }
      }catch(e){
        b.disabled = false; b.textContent = 'Importuj';
        alert('Błąd: ' + ((e as any).message||e));
      }
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeAndRefresh(); });
  document.body.appendChild(overlay);
  draw();
}

const TRANSFER_HISTORY_TYPES = ['Transfer definitywny','Wypożyczenie','Wolny transfer','Debiut w klubie (juniorzy)','Powrót z wypożyczenia'];
// Zakładka czytająca TABELĘ TRANSFERÓW z profilu zawodnika na Transfermarkcie.
//
// Powstała, bo wklejenie tej tabeli jest nie do rozczytania: przeglądarka kopiuje ją PIONOWO,
// po jednej komórce w linijce („Polska / Warta Mld. / Wa. Poznań U19 / Polska / …"), więc ginie
// podział na kolumny i nie da się odróżnić klubu opuszczanego od docelowego. W DOM te kolumny
// są osobnymi elementami, więc odczyt jest jednoznaczny.
//
// Nowy układ Transfermarktu ma klasy „…transfer-history-grid__<kolumna>"; starszy to zwykła
// tabela. Obsługujemy oba, a gdy żadnego nie ma — mówimy o tym wprost zamiast zgadywać.
const TM_TRANSFERS_BOOKMARKLET = `javascript:(function(){try{
var u=location.href;
if(!/\\/profil\\/spieler\\/\\d+/.test(u)){alert('SBS: to nie jest profil zawodnika na Transfermarkcie.\\n\\nOtworz profil zawodnika i kliknij ponownie.');return;}
var imie=(document.title||'').split(' - ')[0].replace(/\\s+/g,' ').trim();
function tekst(e){return e?(e.textContent||'').replace(/\\u00a0/g,' ').replace(/\\s+/g,' ').trim():'';}
function nazwaKlubu(kom){
if(!kom)return '';
var a=kom.querySelector('a[href*="/verein/"]');
if(a){var t=(a.getAttribute('title')||'').trim();if(t)return t;
var im=a.querySelector('img');if(im){var ti=(im.getAttribute('title')||im.getAttribute('alt')||'').trim();if(ti)return ti;}
if(tekst(a))return tekst(a);}
var im2=kom.querySelector('img[src*="wappen"],img[class*="wappen"]');
if(im2){var t2=(im2.getAttribute('title')||im2.getAttribute('alt')||'').trim();if(t2)return t2;}
// Ostatecznie najdluzszy wiersz tekstu w komorce (odsiewa skroty i nazwe kraju z flagi).
var linie=tekst(kom).split(/\\s{2,}/).filter(Boolean);
linie.sort(function(a,b){return b.length-a.length});
return linie[0]||'';}
var wiersze=[];
var grid=document.querySelectorAll('[class*="transfer-history-grid__row"],[class*="transfer-history-grid"] [class*="__season"]');
var kom=document.querySelectorAll('[class*="transfer-history-grid__season"]');
for(var i=0;i<kom.length;i++){
var rzad=kom[i].parentElement;if(!rzad)continue;
var q=function(k){return rzad.querySelector('[class*="transfer-history-grid__'+k+'"]')};
var sezon=tekst(q('season')),data=tekst(q('date'));
var zK=nazwaKlubu(q('old-club')),doK=nazwaKlubu(q('new-club'));
var kwota=tekst(q('fee')),wart=tekst(q('market-value'));
if(!zK&&!doK)continue;
wiersze.push([sezon,data,zK,doK,wart,kwota].join('\\t'));}
if(!wiersze.length){
// Starszy uklad: zwykla tabela z naglowkiem zawierajacym „Sezon"/„Season".
var tab=document.querySelectorAll('table');
for(var t3=0;t3<tab.length&&!wiersze.length;t3++){
if(!/sezon|season/i.test(tekst(tab[t3].querySelector('thead'))||''))continue;
var tr=tab[t3].querySelectorAll('tbody tr');
for(var r=0;r<tr.length;r++){
var td=tr[r].querySelectorAll('td');if(td.length<4)continue;
var kluby=[];for(var c=0;c<td.length;c++){var n=nazwaKlubu(td[c]);if(n&&kluby.indexOf(n)<0)kluby.push(n);}
if(kluby.length<2)continue;
var teksty=[];for(var c2=0;c2<td.length;c2++)teksty.push(tekst(td[c2]));
var sez=teksty.find(function(x){return /^\\d{2}\\/\\d{2}$/.test(x)})||'';
var dat=teksty.find(function(x){return /\\d{1,2}\\s+[a-z\\u0105\\u0107\\u0119\\u0142\\u0144\\u00f3\\u015b\\u017a\\u017c]{3,}\\s+\\d{4}/i.test(x)})||'';
var kw=teksty.filter(function(x){return /\\u20ac|mln|tys|free|wolny/i.test(x)});
wiersze.push([sez,dat,kluby[0],kluby[1],kw[0]||'',kw[1]||''].join('\\t'));}}}
if(!wiersze.length){alert('SBS: nie znalazlem tabeli transferow na tej stronie.\\n\\nUpewnij sie, ze jestes na PROFILU zawodnika i ze sekcja „Transfery" jest widoczna.');return;}
var caly='### TRANSFERY: '+imie+' ###\\n'+wiersze.join('\\n');
navigator.clipboard.writeText(caly).then(function(){
var d=document.createElement('div');
d.innerHTML='<b>SBS: '+imie+'</b><br>transferow: '+wiersze.length+' \\u2014 schowek gotowy<br><span style="opacity:.75;font-weight:400">Wklej w oknie historii transferowej</span>';
d.style.cssText='position:fixed;top:16px;right:16px;z-index:999999;background:#16302A;color:#C69B3C;padding:12px 18px;border-radius:8px;font:600 13px sans-serif;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.3)';
document.body.appendChild(d);setTimeout(function(){d.remove()},3600);
}).catch(function(e){alert('Nie udalo sie skopiowac: '+e.message)})}catch(e){alert('Blad: '+e.message)}})();`;

// Rozbiór WKLEJONEJ tabeli transferów z Transfermarktu. Kolumny na stronie stoją w kolejności:
// Sezon | Data | Odchodzi z | Dołącza do | Wartość rynkowa | Kwota transferu — a po skopiowaniu
// rozdziela je tabulator. Kolejności NIE zakładamy na sztywno: sezon, datę i kwoty rozpoznajemy
// po kształcie, a to, co zostanie, to nazwy klubów. Dzięki temu zmiana układu tabeli albo wersji
// językowej nie wywraca odczytu.
// Odczyt wklejki PIONOWEJ — takiej, jaką daje zaznaczenie tabeli transferów myszą.
//
// Kolumny znikają, ale zostaje powtarzalny wzór, ten sam w każdej próbce:
//
//     Pogoń Młd.        <- klub opuszczany
//     Stätzling Jgd.    <- klub docelowy (wariant skrócony)
//     Niemcy            <- kraj klubu docelowego
//     Stätzling Jgd.    <- klub docelowy (pełny)
//     -                 <- wartość rynkowa
//     Bez odstępnego    <- kwota transferu
//
// Kotwicą jest POWTÓRZENIE nazwy klubu docelowego wokół nazwy kraju („X, kraj, X"). Klub
// opuszczany to linijka bezpośrednio przed tą trójką. To rozpoznanie oparte na strukturze,
// a nie na zgadywaniu kolejności — dlatego nie pomyli klubów miejscami.
function parseHistoriaPionowa(text){
  const linie = String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
    .filter(l=>!/^###/.test(l));
  const kwotowa = (s)=> /€|\bmln\b|\btys\b|bez odst[eę]pnego|free transfer|wolny transfer|wypożycz|wypozycz|loan|^[-–—?]$/i.test(s);
  // Data ani sezon NIE są nazwą klubu. Bez tego warunku „05.02.2026" lądowało w rubryce
  // „z klubu" i przy każdym transferze powstawał drugi, fałszywy wpis.
  const dataLubSezon = (s)=> /^\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}$/.test(s)
    || /^\d{2}\/\d{2}$/.test(s)
    || /^\d{1,2}\s+[a-ząćęłńóśźż]{3,}\s+\d{4}$/i.test(s)
    || /^\d{4}$/.test(s);
  const nieKlub = (s)=> !s || kwotowa(s) || dataLubSezon(s);
  const wynik = [];
  const juzDodane = new Set();          // ochrona przed powieleniem w obrębie jednej wklejki
  for(let i = 1; i + 1 < linie.length; i++){
    // „X, cokolwiek, X" — powtórzona nazwa klubu docelowego wokół kraju.
    if(importNorm(linie[i-1]) !== importNorm(linie[i+1])) continue;
    if(nieKlub(linie[i-1])) continue;
    const toClub = linie[i+1];
    const fromClub = (i - 2 >= 0 && !nieKlub(linie[i-2])) ? linie[i-2] : '';
    if(!fromClub || importNorm(fromClub) === importNorm(toClub)) continue;
    // Za trójką stoją wartość rynkowa i kwota transferu.
    const ogon = linie.slice(i+2, i+5).filter(kwotowa);
    const kwota = ogon.length >= 2 ? ogon[1] : (ogon[0] || '');
    // Sezon lub rok szukamy wstecz, przed nazwą klubu opuszczanego.
    let sezon = '';
    for(let j = i-3; j >= 0 && j >= i-8; j--){
      if(/^\d{2}\/\d{2}$/.test(linie[j])){ sezon = linie[j]; break; }
      const md = linie[j].match(/\b(\d{4})\b/);
      if(md && !sezon) sezon = md[1];
    }
    const wypozyczenie = /wypożycz|wypozycz|loan/i.test(kwota);
    // Ten sam transfer nie może wejść dwa razy z jednej wklejki — Transfermarkt powtarza
    // niektóre warianty nazw, przez co wzór „X, kraj, X" trafiał się kilkakrotnie.
    const odcisk = importNorm(fromClub) + '>' + importNorm(toClub) + '@' + (sezon||'');
    if(juzDodane.has(odcisk)){ i += 2; continue; }
    juzDodane.add(odcisk);
    wynik.push({
      fromClub, toClub, from: sezon,
      type: wypozyczenie ? 'Wypożyczenie' : (kwota ? 'Transfer definitywny' : ''),
      fee: wypozyczenie ? '' : (/^[-–—?]$/.test(kwota) ? '' : kwota),
      note: '',
    });
    i += 2;   // ta trójka jest już rozliczona
  }
  return wynik;
}

function parseHistoriaTransferow(text){
  const MIESIACE = {sty:1,lut:2,mar:3,kwi:4,maj:5,cze:6,lip:7,sie:8,wrz:9,paz:10,paź:10,lis:11,gru:12};
  const wynik = [];
  String(text||'').split(/\r?\n/).forEach(linia=>{
    const s = linia.trim();
    if(!s) return;
    // Nagłówek tabeli i wiersze podsumowania odsiewamy po charakterystycznych słowach.
    if(/^(sezon|data|odchodzi|dołącza|dolacza|wartość|wartosc|kwota|season|date|left|joined|fee|razem|suma)\b/i.test(s)) return;

    const pola = s.split(/\t+|\s{2,}|\s+\|\s+/).map(x=>x.trim()).filter(Boolean);
    if(pola.length < 2) return;

    let sezon = '', data = '', kwota = '', wartosc = '';
    const pozostale = [];
    pola.forEach(p=>{
      if(!sezon && /^\d{2}\/\d{2}$/.test(p)){ sezon = p; return; }
      if(!sezon && /^\d{4}[\/-]\d{2,4}$/.test(p)){ sezon = p; return; }
      const md = p.match(/^(\d{1,2})\s+([a-ząćęłńóśźż]{3,})\s+(\d{4})$/i);
      if(!data && md && MIESIACE[md[2].slice(0,3).toLowerCase()]){
        data = `${md[3]}-${String(MIESIACE[md[2].slice(0,3).toLowerCase()]).padStart(2,'0')}-${String(md[1]).padStart(2,'0')}`;
        return;
      }
      if(!data && /^\d{4}-\d{2}-\d{2}$/.test(p)){ data = p; return; }
      // Kwoty: „500 tys. €", „1,20 mln €", „free transfer", „wypożyczenie".
      if(/€|\bmln\b|\btys\b|free transfer|wolny transfer|bez kwoty|wypożycz|wypozycz|loan|\?$|^-$/i.test(p)){
        if(!wartosc) wartosc = p; else if(!kwota) kwota = p;
        return;
      }
      pozostale.push(p);
    });

    // Nazwy klubów: pierwsze dwa pola, których nie rozpoznaliśmy jako liczby/daty/kwoty.
    // Transfermarkt powtarza nazwę klubu w komórce (pełną i skróconą) — bierzemy tę dłuższą.
    const kluby = pozostale.filter(x=> x.length >= 2 && !/^\d+$/.test(x));
    if(kluby.length < 2) return;
    const fromClub = kluby[0];
    const toClub = kluby[1];
    if(!fromClub || !toClub) return;

    // Gdy w wierszu była tylko jedna kwota, jest nią kwota transferu, nie wartość rynkowa.
    const fee = kwota || wartosc || '';
    const typ = /wypożycz|wypozycz|loan/i.test(fee) ? 'Wypożyczenie'
      : /free transfer|wolny transfer/i.test(fee) ? 'Transfer definitywny'
      : fee ? 'Transfer definitywny' : '';

    wynik.push({
      fromClub, toClub,
      from: sezon || (data ? data.slice(0,4) : ''),
      type: typ,
      fee: /wypożycz|wypozycz|loan/i.test(fee) ? '' : fee,
      note: data ? ('Data transferu: ' + data) : '',
    });
  });
  return wynik;
}

// Historia transferowa — wpisy dodawane ręcznie przez scouta (klub, okres, typ, kwota), na wzór układu
// kariery znanego z Transfermarkt/90minut, albo wklejone hurtem z tabeli transferów.
function openTransferHistoryModal(playerId){
  const already = document.querySelector('.modal-overlay[data-transferhist-for]');
  if(already) already.remove();
  const p = DB.players.find(x=>x.id===playerId);
  if(!p) return;
  if(!p.transferHistory) p.transferHistory = [];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.dataset.transferhistFor = playerId;

  function closeAndRefresh(){ overlay.remove(); render(); }
  let editIdx = null; // indeks edytowanego wpisu (null = dodawanie nowego)

  function draw(){
    // starsze wpisy miały jedno pole „club" — pokazujemy je jako „Z klubu" (fallback wstecz).
    const sorted = p.transferHistory.map((t,i)=>({t,i})).sort((a,b)=>(b.t.from||'').localeCompare(a.t.from||''));
    const editing = editIdx!=null ? p.transferHistory[editIdx] : null;
    const typeOpts = TRANSFER_HISTORY_TYPES.map(t=>`<option ${editing&&editing.type===t?'selected':''}>${esc(t)}</option>`).join('');
    overlay.innerHTML = `
    <div class="modal" style="max-width:640px;">
      <h3>Historia transferowa — ${esc(p.firstName)} ${esc(p.lastName)}</h3>
      <div style="margin-bottom:16px;max-height:240px;overflow:auto;">
        ${sorted.length ? sorted.map(({t,i})=>`
          <div class="obs-item"${editIdx===i?' style="background:var(--card-warm);border-radius:8px;"':''}>
            <div class="toolbar" style="margin-bottom:2px;">
              <strong>${esc(t.fromClub||t.club||'—')} &rarr; ${esc(t.toClub||'—')}</strong>
              <span style="display:flex;gap:8px;">
                <button class="link-btn th-edit-btn" data-idx="${i}" style="color:var(--gold-dark);font-size:11px;">✎ edytuj</button>
                <button class="link-btn th-delete-btn" data-idx="${i}" style="color:var(--clay-dark);font-size:11px;">usuń</button>
              </span>
            </div>
            <div class="meta">${esc(t.from||'—')}${t.type?' &middot; '+esc(t.type):''}${t.fee?' &middot; '+esc(t.fee):''}</div>
            ${t.note?`<div style="font-size:12px;margin-top:3px;">${esc(t.note)}</div>`:''}
          </div>`).join('') : '<div class="empty">Brak wpisów — dodaj pierwszy poniżej.</div>'}
      </div>
      <details style="border-top:1px solid var(--border);padding-top:12px;margin-bottom:12px;">
        <summary style="cursor:pointer;font-weight:700;color:var(--gold-dark);">📋 Wklej całą historię z Transfermarktu</summary>
        <p class="note" style="margin:8px 0;">Transfermarkt kopiuje tę tabelę <strong>pionowo, po jednej komórce w linijce</strong>
        — ginie wtedy podział na kolumny i nie da się odróżnić klubu opuszczanego od docelowego. Dlatego użyj zakładki,
        która czyta tabelę wprost ze strony:</p>
        <p style="margin:8px 0;">
          <a href="${esc(TM_TRANSFERS_BOOKMARKLET)}" onclick="event.preventDefault();alert('To nie jest przycisk do klikania.\n\nPRZECIĄGNIJ go myszą na pasek zakładek przeglądarki (Ctrl+Shift+B, jeśli paska nie widać),\na potem kliknij go TAM, będąc na stronie źródłowej.\n\nJeśli przeciąganie nie działa — rozwiń „Kod do wklejenia ręcznie" pod spodem.');return false;" style="display:inline-block;padding:8px 16px;background:var(--gold);color:var(--heading);border-radius:6px;font-weight:800;text-decoration:none;cursor:grab;">↔ Transfery do SBS</a>
          <span class="note" style="display:block;font-size:11px;margin-top:4px;">Przeciągnij na pasek zakładek (Ctrl+Shift+B), wejdź na profil zawodnika, kliknij — i wklej poniżej.</span>
        </p>
        <details style="margin-bottom:6px;">
          <summary style="cursor:pointer;font-size:12px;color:var(--gold-dark);">Kod do wklejenia ręcznie</summary>
          <textarea readonly rows="4" style="font-size:10.5px;font-family:monospace;width:100%;margin-top:6px;">${esc(TM_TRANSFERS_BOOKMARKLET)}</textarea>
        </details>
        <textarea id="th-paste" rows="6" placeholder="26/27&#9;1 lip 2026&#9;Podhale Nowy Targ&#9;Cracovia&#9;100 tys. €&#9;free transfer" style="font-size:11.5px;font-family:monospace;"></textarea>
        <div class="modal-actions" style="justify-content:flex-start;margin-top:8px;">
          <button class="secondary" data-action="th-parse">Rozpoznaj</button>
        </div>
        <div id="th-preview"></div>
      </details>
      <div style="border-top:1px solid var(--border);margin-bottom:14px;padding-top:12px;${editing?'background:var(--card-warm);border-radius:8px;padding:12px;':''}">
        <label class="field" style="display:block;margin-bottom:8px;">${editing?'✎ Edytuj wpis':'Dodaj wpis'}</label>
        <div class="grid grid-2">
          <div class="field-wrap"><label class="field">Z klubu</label><input id="th-from-club" placeholder="np. Podhale Nowy Targ" value="${editing?esc(editing.fromClub||editing.club||''):''}"></div>
          <div class="field-wrap"><label class="field">Do klubu</label><input id="th-to-club" placeholder="np. Cracovia" value="${editing?esc(editing.toClub||''):''}"></div>
        </div>
        <div class="grid grid-2">
          <div class="field-wrap"><label class="field">Typ transferu</label>
            <select id="th-type"><option value="">— wybierz —</option>${typeOpts}</select>
          </div>
          <div class="field-wrap"><label class="field">Rok / sezon</label><input id="th-from" placeholder="np. 2024 / 2023-24" value="${editing?esc(editing.from||''):''}"></div>
        </div>
        <div class="field-wrap"><label class="field">Kwota transferu (opcjonalnie)</label><input id="th-fee" placeholder="np. 50 tys. € / wolny transfer" value="${editing?esc(editing.fee||''):''}"></div>
        <div class="field-wrap"><label class="field">Notatka</label><input id="th-note" placeholder="Dodatkowe informacje" value="${editing?esc(editing.note||''):''}"></div>
      </div>
      <div class="modal-actions">
        <button class="secondary" data-action="close-modal">Zamknij</button>
        ${editing?'<button class="secondary" data-action="th-cancel-edit">Anuluj edycję</button>':''}
        <button class="gold" data-action="save-transfer-history">${editing?'Zapisz zmiany':'+ Dodaj wpis'}</button>
      </div>
    </div>`;
    wire();
  }

  function wire(){
    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=closeAndRefresh);
    overlay.querySelectorAll('.th-edit-btn').forEach(b=>b.onclick=()=>{ editIdx = Number(b.dataset.idx); draw(); });
    overlay.querySelectorAll('[data-action="th-cancel-edit"]').forEach(b=>b.onclick=()=>{ editIdx = null; draw(); });
    overlay.querySelectorAll('.th-delete-btn').forEach(b=>b.onclick=async()=>{
      const idx = Number(b.dataset.idx);
      const kopia = p.transferHistory.slice();
      p.transferHistory.splice(idx, 1);
      if(editIdx===idx) editIdx = null; else if(editIdx!=null && editIdx>idx) editIdx--;
      const ok = await savePlayerOne(p);
      if(!ok){ p.transferHistory = kopia; alert("Nie udało się usunąć — sprawdź baner u góry strony."); }
      draw();
    });
    overlay.querySelectorAll('[data-action="th-parse"]').forEach(b=>b.onclick=()=>{
      const ta = overlay.querySelector('#th-paste');
      const box = overlay.querySelector('#th-preview');
      // Najpierw układ kolumnowy (z zakładki), a gdy nic z niego nie wyjdzie — pionowy,
      // czyli ten, który powstaje po zaznaczeniu tabeli myszą.
      const tresc = ta ? ta.value : '';
      let rozpoznane = parseHistoriaTransferow(tresc);
      if(!rozpoznane.length) rozpoznane = parseHistoriaPionowa(tresc);
      if(!rozpoznane.length){
        box.innerHTML = `<p class="note" style="color:var(--clay-dark);">Nie rozpoznałem żadnego transferu.
          Jeśli wklejałeś zaznaczoną myszą tabelę — to nie zadziała, bo Transfermarkt kopiuje ją pionowo,
          po jednej komórce w linijce, i przepada podział na kolumny.
          <strong>Użyj zakładki „↔ Transfery do SBS"</strong> z pola powyżej: czyta tabelę ze strony razem z kolumnami.</p>`;
        return;
      }
      // Nie dublujemy wpisów, które już są — porównujemy po parze klubów i sezonie.
      const maJuz = (w)=> (p.transferHistory||[]).some(t=>
        importNorm(t.fromClub||'')===importNorm(w.fromClub) &&
        importNorm(t.toClub||'')===importNorm(w.toClub) &&
        (t.from||'')===(w.from||''));
      const nowe = rozpoznane.filter(w=>!maJuz(w));
      box.innerHTML = `
        <p class="note" style="margin:8px 0;">Rozpoznano <strong>${rozpoznane.length}</strong>,
          nowych <strong>${nowe.length}</strong>${rozpoznane.length-nowe.length? `, już w historii ${rozpoznane.length-nowe.length}`:''}.</p>
        <table><tbody>${nowe.map(w=>`<tr>
          <td style="font-size:12px;white-space:nowrap;">${esc(w.from||'—')}</td>
          <td style="font-size:12px;">${esc(w.fromClub)} → <strong>${esc(w.toClub)}</strong></td>
          <td style="font-size:12px;">${esc(w.type||'—')}</td>
          <td style="font-size:12px;">${esc(w.fee||'—')}</td>
        </tr>`).join('')}</tbody></table>
        ${nowe.length? `<div class="modal-actions" style="justify-content:flex-start;">
          <button class="gold" data-action="th-apply">Dodaj ${nowe.length} wpisów do historii</button></div>` : ''}`;
      box.querySelectorAll('[data-action="th-apply"]').forEach(bt=>bt.onclick=async()=>{
        nowe.forEach(w=> p.transferHistory.push(Object.assign({id: uid('TH')}, w)));
        const ok = await savePlayerOne(p);
        if(!ok){ alert('Nie udało się zapisać — sprawdź baner u góry strony.'); return; }
        if(ta) ta.value = '';
        draw();
      });
    });
    overlay.querySelectorAll('[data-action="save-transfer-history"]').forEach(b=>b.onclick=async()=>{
      const fromClub = overlay.querySelector('#th-from-club').value.trim();
      const toClub = overlay.querySelector('#th-to-club').value.trim();
      if(!fromClub && !toClub){ overlay.querySelector('#th-from-club').focus(); return; }
      const entry = {
        fromClub, toClub,
        from: overlay.querySelector('#th-from').value.trim(),
        type: overlay.querySelector('#th-type').value,
        fee: overlay.querySelector('#th-fee').value.trim(),
        note: overlay.querySelector('#th-note').value.trim(),
      };
      if(editIdx!=null){ Object.assign(p.transferHistory[editIdx], entry); editIdx = null; }
      else { p.transferHistory.push(Object.assign({id: uid('TH')}, entry)); }
      const ok = await savePlayerOne(p);
      if(!ok){ alert('Nie udało się zapisać — sprawdź baner u góry strony.'); return; }
      draw();
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeAndRefresh(); });
  document.body.appendChild(overlay);
  draw();
}

function openPlayerAttachmentsModal(playerId){
  const already = document.querySelector('.modal-overlay[data-attach-for]');
  if(already) already.remove();
  const p = DB.players.find(x=>x.id===playerId);
  if(!p) return;
  if(!p.attachments) p.attachments = [];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.dataset.attachFor = playerId;

  function closeAndRefresh(){ overlay.remove(); render(); }
  function fmtSize(bytes){
    if(bytes < 1024) return bytes + ' B';
    if(bytes < 1024*1024) return Math.round(bytes/1024) + ' KB';
    return (bytes/1024/1024).toFixed(1) + ' MB';
  }

  function draw(){
    overlay.innerHTML = `
    <div class="modal">
      <h3>Załączniki — ${esc(p.firstName)} ${esc(p.lastName)}</h3>
      <div style="margin-bottom:16px;max-height:280px;overflow:auto;">
        ${p.attachments.length ? p.attachments.map((a,i)=>`
          <div class="obs-item" style="display:flex;gap:12px;align-items:flex-start;">
            <a href="${a.dataUrl}" download="${esc(a.name)}" class="attach-thumb attach-thumb-sm" title="Pobierz ${esc(a.name)}">${attachmentThumbInner(a)}</a>
            <div style="flex:1;min-width:0;">
              <div class="toolbar" style="margin-bottom:2px;">
                <a href="${a.dataUrl}" download="${esc(a.name)}" style="font-weight:700;color:var(--heading);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📎 ${esc(a.name)}</a>
                <button class="link-btn attach-delete-btn" data-idx="${i}" style="color:var(--clay-dark);font-size:11px;">usuń</button>
              </div>
              <div class="meta">${fmtSize(a.size)} &middot; dodano ${esc(a.uploadedAt)}</div>
            </div>
          </div>
        `).join('') : '<div class="empty">Brak załączników — dodaj pierwszy poniżej.</div>'}
      </div>
      <div class="field-wrap">
        <label class="field">Dodaj plik (PDF, JPG, PNG)</label>
        <input type="file" id="attach-new-file" accept="application/pdf,.pdf,image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png">
        <div id="attach-status" class="note" style="margin-top:4px;"></div>
      </div>
      <div class="modal-actions">
        <button class="secondary" data-action="close-modal">Zamknij</button>
      </div>
    </div>`;
    wire();
  }

  function wire(){
    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=closeAndRefresh);
    const fileInput = overlay.querySelector('#attach-new-file');
    const status = overlay.querySelector('#attach-status');
    if(fileInput) fileInput.onchange = async ()=>{
      const file = fileInput.files[0];
      if(!file) return;
      status.textContent = 'Wczytywanie...';
      status.style.color = 'var(--ink-soft);';
      try{
        const att = await processAttachmentFile(file);
        p.attachments.push(att);
        await savePlayers();
        draw();
      }catch(e){
        status.textContent = e.message || 'Nie udało się wczytać pliku.';
        status.style.color = 'var(--clay-dark)';
      }
    };
    overlay.querySelectorAll('.attach-delete-btn').forEach(b=>b.onclick=async()=>{
      p.attachments.splice(Number(b.dataset.idx), 1);
      await savePlayers();
      draw();
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeAndRefresh(); });
  document.body.appendChild(overlay);
  draw();
}
function openPositionSlotModal(league, formation, number){
  const already = document.querySelector('.modal-overlay[data-position-slot]');
  if(already) already.remove();

  const posDef = POSITION_NUMBERS.find(s => s.number === number);
  if(!posDef) return;
  const key = positionMapKey(league, formation, number);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.dataset.positionSlot = '1';

  function closeAndRefresh(){ overlay.remove(); render(); }
  function currentIds(){ return positionMapAssignments[key] || []; }

  function draw(query){
    const ids = currentIds();
    const assigned = ids.map(id => DB.players.find(p=>p.id===id)).filter(Boolean);
    const atLimit = assigned.length >= 6;
    const q = (query||'').trim().toLowerCase();
    const matches = (q.length < 2 || atLimit) ? [] : DB.players
      .filter(pl => !ids.includes(pl.id) && (pl.firstName+' '+pl.lastName).toLowerCase().includes(q))
      .slice(0, 25);

    overlay.innerHTML = `
    <div class="modal">
      <h3>Numer ${posDef.number} — ${esc(posDef.label)}</h3>
      <p class="note" style="margin-top:-6px;">${esc(league)}${formation?' &middot; system '+esc(formation):''} &middot; przypisano ${assigned.length}/6</p>
      <div style="margin-bottom:14px;">
        ${assigned.length ? assigned.map((pl,i)=>{
          const av = playerAvg(pl.id);
          return `<div class="obs-item ${i<2?'priority-item':''}">
            <div class="toolbar" style="margin-bottom:2px;">
              <strong>${i+1}. ${esc(pl.firstName)} ${esc(pl.lastName)}</strong>
              <span style="display:flex;align-items:center;gap:6px;">
                <button class="row-arrow-btn" data-action="posmodal-move" data-dir="up" data-id="${pl.id}" title="Wyżej" ${i===0?'disabled':''}>▲</button>
                <button class="row-arrow-btn" data-action="posmodal-move" data-dir="down" data-id="${pl.id}" title="Niżej" ${i===assigned.length-1?'disabled':''}>▼</button>
                <button class="link-btn" data-action="posmodal-view-profile" data-id="${pl.id}" style="color:var(--gold-dark);font-size:11px;">profil</button>
                <button class="link-btn posmodal-remove-btn" data-id="${pl.id}" style="color:var(--clay-dark);font-size:11px;">usuń</button>
              </span>
            </div>
            <div class="meta">${esc(pl.position)} &middot; ${esc(clubName(pl.clubId))} &middot; ${av&&av.overall!=null?fmt1(av.overall):'brak ocen'}</div>
          </div>`;
        }).join('') : '<div class="empty">Brak przypisanych zawodników — dodaj poniżej.</div>'}
      </div>
      ${atLimit ? '<p class="note">Osiągnięto limit 6 zawodników na tej pozycji — usuń kogoś, aby dodać kolejnego.</p>' : `
      <div class="field-wrap">
        <label class="field">Dodaj zawodnika (szukaj po imieniu lub nazwisku)</label>
        <input id="posmodal-search" placeholder="np. Kowalski..." value="${esc(query||'')}">
      </div>
      <div style="max-height:220px;overflow:auto;margin-top:8px;">
        ${q.length < 2 ? '<p class="note">Wpisz co najmniej 2 znaki, aby wyszukać.</p>' :
          matches.length ? matches.map(pl=>{
            const av = playerAvg(pl.id);
            return `<div class="obs-item picker-result" data-player-id="${pl.id}" style="cursor:pointer;">
              <strong>${esc(pl.firstName)} ${esc(pl.lastName)}</strong>
              <div class="meta">${esc(pl.position)} &middot; ${esc(clubName(pl.clubId))} &middot; ${av&&av.overall!=null?fmt1(av.overall):'brak ocen'}</div>
            </div>`;
          }).join('') : '<p class="note">Brak wyników.</p>'}
      </div>`}
      <div class="modal-actions">
        <button class="secondary" data-action="close-modal">Zamknij</button>
      </div>
    </div>`;
    wire();
  }

  function wire(){
    overlay.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=closeAndRefresh);
    overlay.querySelectorAll('[data-action="posmodal-view-profile"]').forEach(b=>b.onclick=()=>{
      viewingPlayerId = b.dataset.id; currentView = 'players';
      overlay.remove(); render();
    });
    overlay.querySelectorAll('.posmodal-remove-btn').forEach(b=>b.onclick=async()=>{
      positionMapAssignments[key] = currentIds().filter(id => id !== b.dataset.id);
      // Zapamiętujemy DECYZJĘ o usunięciu, nie tylko jej skutek. Samo zdjęcie z listy nie
      // wystarczało: automat dopełniający pozycje wstawiał zawodnika z powrotem przy najbliższym
      // przerysowaniu i przycisk wyglądał na niedziałający.
      const kw = kluczWykluczonych(key);
      const wykluczeni = positionMapAssignments[kw] || [];
      if(!wykluczeni.includes(b.dataset.id)) positionMapAssignments[kw] = [...wykluczeni, b.dataset.id];
      await savePositionMapAssignments();
      draw();
    });
    overlay.querySelectorAll('[data-action="posmodal-move"]').forEach(b=>b.onclick=async()=>{
      const ids = currentIds();
      const idx = ids.indexOf(b.dataset.id);
      if(idx === -1) return;
      const targetIndex = b.dataset.dir === 'up' ? idx-1 : idx+1;
      if(targetIndex < 0 || targetIndex >= ids.length) return;
      await reorderPositionMapPlayer(league, formation, number, b.dataset.id, targetIndex);
      draw();
    });
    const searchInput = overlay.querySelector('#posmodal-search');
    if(searchInput){
      searchInput.focus();
      searchInput.oninput = ()=> zachowajKursorPoPrzerysowaniu(overlay, '#posmodal-search',
        ()=> draw(searchInput.value));
    }
    overlay.querySelectorAll('.picker-result').forEach(row=>row.onclick = async ()=>{
      const ids = currentIds();
      if(ids.length >= 6 || ids.includes(row.dataset.playerId)) return;
      positionMapAssignments[key] = [...ids, row.dataset.playerId];
      // Ponowne dodanie cofa wcześniejsze usunięcie — inaczej zawodnik zniknąłby zaraz po dodaniu.
      const kw = kluczWykluczonych(key);
      if((positionMapAssignments[kw]||[]).length){
        positionMapAssignments[kw] = positionMapAssignments[kw].filter(id => id !== row.dataset.playerId);
      }
      await savePositionMapAssignments();
      draw();
    });
  }

  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeAndRefresh(); });
  document.body.appendChild(overlay);
  draw('');
}

async function generatePlayerPDF(playerId){
  const p = DB.players.find(x=>x.id===playerId);
  if(!p) return;
  const a = playerAvg(playerId);
  const obs = playerObs(playerId);
  const logoEl = document.querySelector('.brand-logo');
  const logoSrc = logoEl ? logoEl.src : '';
  const club = DB.clubs.find(c=>c.id===p.clubId);
  const posDef = POSITION_NUMBERS.find(pn => pn.posName === p.position);
  const posNumber = posDef ? posDef.number : '—';
  const lastObs = obs.length ? obs[obs.length-1] : null;
  const latestReport = playerReports(p.id).slice(-1)[0] || null;
  const reportTextByKey = {
    technika: latestReport ? latestReport.technika : '',
    taktyka: latestReport ? latestReport.taktyka : '',
    motoryka: latestReport ? latestReport.motoryka : '',
    mentalnosc: latestReport ? latestReport.mentalnoscOpis : '',
    potencjal: latestReport ? latestReport.potencjalOpis : ''
  };
  if(!html2canvas || !jsPDF) throw new Error('Biblioteki do generowania PDF nie są dostępne.');

  let html = `
  <html>
  <head>
  <title>Raport - ${esc(p.firstName)} ${esc(p.lastName)}</title>
  <meta charset="UTF-8">
  <style>
    /* PALETA WPISANA WPROST — RAPORT NIE MA DOSTĘPU DO ARKUSZA APLIKACJI.
       Szablon idzie do osobnej ramki, w której nie ma naszego style.css, więc każde var(--…)
       zostawało niezdefiniowane: kolory spadały do domyślnych, a html2canvas przerywał pracę
       komunikatem „unsupported color function var". Stąd wartości podane tutaj, na sztywno i
       zawsze w wersji jasnej — wydruk ma być czytelny na papierze niezależnie od tego, czy w
       aplikacji włączony jest ciemny motyw. */
    :root{
      --card:#FFFFFF; --chalk:#F6F3EA; --chalk-dim:#E7E2D3; --clay:#B6503F;
      --gold:#C69B3C; --gold-dark:#8C6C21; --good:#3E7D4C; --good-bg:#DEEBDF;
      --heading:#16302A; --ink:#1B2420; --ink-faint:#8A857A; --ink-soft:#5B6560;
      --on-pitch:#F6F3EA; --pitch:#16302A; --warn-bg:#F4E3C4;
    }
    @page { margin: 16mm 14mm; }
    *{box-sizing:border-box;}
    body{font-family:Arial,Helvetica,sans-serif;color:var(--ink);background:var(--card);margin:0;padding:0 14mm;font-size:13px;line-height:1.5;}
    .report-header{display:flex;align-items:center;gap:18px;padding-bottom:16px;border-bottom:4px solid var(--gold);margin-bottom:0;}
    .report-header img{width:52px;height:52px;border-radius:12px;flex-shrink:0;}
    .brand-block{flex:1;}
    .brand-name{font-family:Arial,'Arial Narrow',sans-serif;font-weight:700;font-size:22px;color:var(--heading);letter-spacing:.02em;margin:0;}
    .brand-sub{font-size:11px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.06em;margin:3px 0 0;}
    .brand-signature{font-size:11px;color:var(--ink);margin:4px 0 0;font-weight:600;}
    .report-date{font-size:11px;color:var(--ink-faint);text-align:right;white-space:nowrap;}
    .title-bar{display:flex;align-items:center;gap:14px;padding:18px 20px;background:var(--pitch);margin:16px -14mm 0;}
    .pos-badge-lg{width:44px;height:44px;border-radius:50%;background:var(--gold);color:var(--heading);display:flex;align-items:center;justify-content:center;
      font-family:Arial,'Arial Narrow',sans-serif;font-weight:700;font-size:20px;flex-shrink:0;border:3px solid var(--chalk);}
    .title-text h1{font-family:Arial,'Arial Narrow',sans-serif;font-weight:700;font-size:24px;color:var(--on-pitch);margin:0;}
    .title-text p{font-size:12px;color:#C6D9CE;margin:3px 0 0;text-transform:uppercase;letter-spacing:.03em;}
    .player-meta{display:flex;flex-wrap:wrap;padding:14px 0;background:var(--chalk);margin:0 -14mm;padding-left:14mm;padding-right:14mm;border-bottom:1px solid var(--chalk-dim);}
    .meta-item{flex:1;min-width:110px;padding:4px 14px;border-left:1px solid var(--chalk-dim);}
    .meta-item:first-child{border-left:none;padding-left:0;}
    .meta-item .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-faint);font-weight:600;}
    .meta-item .val{font-size:13px;color:var(--ink);font-weight:700;margin-top:2px;}
    .section{padding:18px 0;}
    .section-title{font-family:Arial,'Arial Narrow',sans-serif;font-weight:700;font-size:14px;color:var(--heading);text-transform:uppercase;
      letter-spacing:.04em;border-left:4px solid var(--gold);padding-left:10px;margin:0 0 12px;}
    .attr-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
    .attr-card{background:var(--chalk);border-radius:8px;padding:10px 6px;text-align:center;border:1px solid var(--chalk-dim);}
    .attr-card .score{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      font-family:Arial,'Arial Narrow',sans-serif;font-weight:700;font-size:15px;margin:0 auto 6px;color:var(--card);}
    .score-high{background:var(--good);} .score-mid{background:var(--gold);} .score-low{background:var(--clay);}
    .attr-card .lbl{font-size:9.5px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.02em;font-weight:600;}
    .attr5-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
    .attr5-col{display:flex;flex-direction:column;}
    .attr5-head{background:var(--pitch);color:var(--on-pitch);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.02em;
      padding:7px 6px;border-radius:6px 6px 0 0;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px;}
    .attr5-score{background:var(--gold);color:var(--heading);border-radius:10px;padding:1px 9px;font-size:13px;font-weight:700;}
    .attr5-body{background:var(--chalk);border:1px solid var(--chalk-dim);border-top:none;border-radius:0 0 6px 6px;
      padding:8px 8px;font-size:10.5px;color:var(--ink);line-height:1.4;flex:1;min-height:46px;}
    .attr5-empty{color:var(--ink-faint);}
    .metric-section-label{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-faint);font-weight:600;margin:10px 0 5px;}
    .attr5-grid.metric4{grid-template-columns:repeat(4,1fr);}
    /* ZIELONE NAGŁÓWKI RÓWNEJ WYSOKOŚCI.
       „Faza przejścia z ataku do obrony" łamie się na dwie linie, „Faza obrony" mieści się w
       jednej — przy wysokości zależnej od treści sąsiadujące kafelki miały różne nagłówki i rząd
       wyglądał na rozjechany. Stała wysokość z wyśrodkowaniem w pionie wyrównuje je niezależnie
       od długości podpisu; dwie linie mieszczą się bez ucinania. */
    .attr5-grid.metric4 .attr5-head{
      height:38px; padding:4px 6px; line-height:1.15; font-size:10.5px;
      justify-content:center; gap:0;
    }
    .metric-num-body{background:var(--chalk);border:1px solid var(--chalk-dim);border-top:none;border-radius:0 0 6px 6px;
      padding:9px 8px;text-align:center;font-size:22px;font-weight:800;color:var(--heading);line-height:1;
      flex:1;display:flex;align-items:center;justify-content:center;min-height:30px;}
    .gauge-wrap{display:flex;flex-direction:column;align-items:center;gap:5px;}
    .gauge-ring{position:relative;}
    .gauge-ring svg{display:block;}
    .gauge-value{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
      font-family:Arial,'Arial Narrow',sans-serif;font-weight:700;font-size:15px;color:var(--heading);}
    .gauge-label{font-size:9.5px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.02em;font-weight:600;text-align:center;}
    .gauge-desc{font-size:10.5px;color:var(--ink);text-align:center;margin-top:6px;line-height:1.35;}
    .persp-badge-report{display:inline-block;padding:5px 14px;border-radius:6px;font-family:Arial,'Arial Narrow',sans-serif;
      font-weight:700;font-size:13px;color:var(--card);letter-spacing:.03em;}
    .overall-strip{display:flex;align-items:center;gap:12px;background:var(--pitch);border-radius:8px;padding:12px 16px;margin-bottom:14px;}
    .overall-strip .big-num{font-family:Arial,'Arial Narrow',sans-serif;font-weight:700;font-size:28px;color:var(--gold);line-height:1;}
    .overall-strip .txt{color:var(--on-pitch);font-size:12px;line-height:1.4;}
    .overall-strip .txt strong{display:block;font-size:13px;margin-bottom:1px;}
    .notes-box{background:var(--chalk);border-left:4px solid var(--gold);border-radius:0 6px 6px 0;padding:12px 14px;font-size:12.5px;color:var(--ink);}
    .obs-table{width:100%;border-collapse:collapse;}
    .obs-table th{background:var(--pitch);color:var(--on-pitch);font-size:10px;text-transform:uppercase;letter-spacing:.03em;padding:7px 10px;text-align:left;}
    .obs-table td{padding:7px 10px;border-bottom:1px solid var(--chalk-dim);font-size:11.5px;}
    .obs-table tr:nth-child(even) td{background:#FAF8F2;}
    .page-break{height:0;overflow:hidden;}
    .radar-box{background:var(--chalk);border:1px solid var(--chalk-dim);border-radius:8px;padding:10px 8px 12px;
      display:flex;flex-direction:column;align-items:center;gap:6px;}
    .recommend-box{background:var(--good-bg);border-radius:8px;padding:12px 14px;}
    .recommend-box .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--good);font-weight:700;margin-bottom:5px;}
    .recommend-box .val{font-size:12.5px;color:var(--ink);font-weight:600;line-height:1.5;}
    .agent-box{background:var(--warn-bg);border-radius:8px;padding:12px 14px;margin-top:12px;}
    .agent-box .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--gold-dark);font-weight:700;margin-bottom:5px;}
    .agent-box .val{font-size:12.5px;color:var(--ink);font-weight:600;}
    .report-footer{text-align:center;padding:14px 0 0;font-size:10px;color:var(--ink-faint);border-top:1px solid var(--chalk-dim);margin-top:18px;}
    .empty-note{font-size:12px;color:var(--ink-faint);font-style:italic;}
    @media print{ body{-webkit-print-color-adjust:exact;print-color-adjust:exact;} }
  </style>
  </head>
  <body>

  <div class="report-header">
    ${logoSrc ? `<img src="${logoSrc}" alt="SBS">` : ''}
    <div class="brand-block">
      <p class="brand-name">SCOUT BASE SYSTEM</p>
      <p class="brand-sub">Raport scoutingowy zawodnika</p>
      <p class="brand-signature">Sporządził: ${esc(currentScout || 'Nieznany scout')}</p>
    </div>
    <div class="report-date">Wygenerowano<br>${new Date().toLocaleDateString('pl-PL')}</div>
  </div>

  <div class="title-bar">
    <div class="pos-badge-lg">${esc(String(posNumber))}</div>
    <div class="title-text">
      <h1>${esc(p.firstName)} ${esc(p.lastName)}</h1>
      <p>${esc(p.position)}${club?' &middot; '+esc(club.name):''}${club&&club.league?' &middot; '+esc(club.league):''}</p>
    </div>
  </div>

  <div class="player-meta">
    <div class="meta-item"><div class="lbl">Rocznik</div><div class="val">${esc(p.birthYear||"—")}${isYouthPlayer(p)?youthBadge():''}</div></div>
    <div class="meta-item"><div class="lbl">Wzrost</div><div class="val">${p.height?p.height+" cm":"—"}</div></div>
    <div class="meta-item"><div class="lbl">Noga</div><div class="val">${esc(p.foot||"—")}</div></div>
    <div class="meta-item"><div class="lbl">System gry</div><div class="val">${esc(p.formation||"—")}</div></div>
    <div class="meta-item"><div class="lbl">Status</div><div class="val">${esc(p.status||"—")}</div></div>
    <div class="meta-item"><div class="lbl">Kontrakt</div><div class="val">${p.hasContract? ('Tak'+(p.contractUntil?' — do '+esc(p.contractUntil):'')) : 'Nie'}</div></div>
    <div class="meta-item"><div class="lbl">Mecze / gole / asysty</div><div class="val">${p.matches!=null?p.matches:"—"} / ${p.goals!=null?p.goals:"—"} / ${p.assists!=null?p.assists:"—"}</div></div>
    <div class="meta-item"><div class="lbl">Kartki żółte / czerwone</div><div class="val"><span style="color:#B8860B;">▮</span> ${p.yellowCards!=null?p.yellowCards:"—"} / <span style="color:var(--clay);">▮</span> ${p.redCards!=null?p.redCards:"—"}</div></div>
  </div>

  ${latestReport?`<div class="section" style="padding-top:0;">
    <div class="section-title">Raport taktyczny${latestReport.date?' — '+esc(latestReport.date):''}${latestReport.perspektywa?' &middot; perspektywa '+esc(latestReport.perspektywa):''}</div>
    ${latestReport.description?`<div class="notes-box" style="margin-bottom:10px;">${esc(latestReport.description)}</div>`:''}
    ${(latestReport.phases&&Object.keys(latestReport.phases).length)?`<div class="metric-section-label">Fazy gry (1-6)</div><div class="attr5-grid metric4">${REPORT_PHASES.map(f=>`<div class="attr5-col"><div class="attr5-head"><span>${esc(f.label)}</span></div><div class="metric-num-body">${latestReport.phases[f.key]!=null?latestReport.phases[f.key]:'—'}</div></div>`).join('')}</div>`:''}
    ${(latestReport.setPieces&&Object.keys(latestReport.setPieces).length)?`<div class="metric-section-label">Stałe fragmenty (1-6)</div><div class="attr5-grid metric4">${REPORT_SET_PIECES.map(f=>`<div class="attr5-col"><div class="attr5-head"><span>${esc(f.label)}</span></div><div class="metric-num-body">${latestReport.setPieces[f.key]!=null?latestReport.setPieces[f.key]:'—'}</div></div>`).join('')}</div>`:''}
    ${latestReport.setPieceComment?`<div class="notes-box" style="margin-top:10px;">${esc(latestReport.setPieceComment)}</div>`:''}
  </div>`:''}

  ${p.notes?`<div class="section" style="padding-top:0;">
    <div class="section-title">Notatki scouta</div>
    <div class="notes-box">${esc(p.notes)}</div>
  </div>`:''}

  <!-- Wymuszony podział: strona pierwsza to treść raportu, druga zaczyna się od historii. -->
  <div class="page-break"></div>

  <div class="section" style="padding-top:0;">
    <div class="section-title">Historia obserwacji (${obs.length})</div>
    ${obs.length?`<table class="obs-table">
      <tr><th>Data</th><th>Mecz</th><th>Scout</th><th>Ocena</th><th>Rekomendacja</th></tr>
      ${obs.map(o=>{
        const hasHist = o.statsFilledIn && o.ratings && RATING_KEYS.some(k=>Number(o.ratings[k])>0);
        const rowAvg = hasHist ? RATING_KEYS.reduce((s,k)=>s+(Number(o.ratings[k])||0),0)/RATING_KEYS.length : null;
        return `<tr><td>${esc(o.date)}</td><td>${esc(o.match||'—')}</td><td>${esc(o.scout)}</td><td>${rowAvg!=null?fmt1(rowAvg):'—'}</td><td>${esc(o.recommendation||'—')}</td></tr>`;
      }).join('')}
    </table>`:`<p class="empty-note">Brak zarejestrowanych obserwacji.</p>`}
  </div>

  ${(a && a.metryki && a.metryki.length >= 3) ? `<div class="section" style="padding-top:0;">
    <div class="section-title">Profil ocen — radar (skala 1-6)</div>
    <div class="radar-box">
      ${radarRaportow(a.metryki, {r:96, siatka:'#E7E2D3', podpis:'#5B6560', pole:'#C69B3C', linia:'#8C6C21'})}
      <p class="empty-note" style="margin:0;text-align:center;">Średnia ocen z ${a.reportCount} ${a.reportCount===1?'raportu':'raportów'} — cztery fazy gry i cztery stałe fragmenty.</p>
    </div>
  </div>` : ''}

  ${(p.przebieg && p.przebieg.length) ? `<div class="section" style="padding-top:0;">
    <div class="section-title">Minuty w kolejnych meczach${p.przebiegSezon?' — sezon '+esc(p.przebiegSezon):''}</div>
    <div class="radar-box" style="align-items:flex-start;overflow:hidden;">
      ${wykresMinut(p.przebieg.slice(-14), {szerSlupka:26, wysokosc:110,
        pelne:'#16302A', czesc:'#C69B3C', brak:'#E7E2D3', siatka:'#E7E2D3', podpis:'#5B6560'})}
      <p class="empty-note" style="margin:0;">${podsumowanieMinut(p.przebieg)}</p>
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Oceny scoutingowe</div>
    ${a && a.overall!=null?`
    <div class="overall-strip">
      <div class="big-num">${fmt1(a.overall)}</div>
      <div class="txt"><strong>Średnia ogólna (z ${a.reportCount} raportów, skala 1-6)</strong> obserwacje: ${a.count}, ostatnia: ${esc(lastObs?lastObs.date:'—')}</div>
      ${latestReport && latestReport.perspektywa ? `<div style="margin-left:auto;">${perspektywaBadgeReport(latestReport.perspektywa)}</div>` : ''}
    </div>` : ''}
    ${(a || latestReport) ? `<div class="attr5-grid">
      ${RATING_KEYS.map(k=>`<div class="attr5-col">
        <div class="attr5-head"><span>${esc(RATING_LABELS[k])}</span>${a&&a.avgs?`<span class="attr5-score">${fmt1(a.avgs[k])}</span>`:''}</div>
        <div class="attr5-body">${reportTextByKey[k]?esc(reportTextByKey[k]):'<span class="attr5-empty">—</span>'}</div>
      </div>`).join('')}
    </div>` : `<p class="empty-note">Brak obserwacji i raportu — oceny oraz opisy pojawią się po pierwszej wizycie scoutingowej.</p>`}
  </div>

  <div class="section" style="padding-top:0;">
    <div class="recommend-box">
      <div class="lbl">Opinia skautingu</div>
      <div class="val">${(()=>{
        // OPINIA SKAUTINGU TO GŁOS KILKU OSÓB, NIE JEDNEJ.
        //
        // Jeden raport to obserwacja jednego meczu przez jednego człowieka — na tej podstawie klub
        // nie podejmuje decyzji. Dlatego opinia pojawia się dopiero przy co najmniej dwóch
        // raportach i mówi wprost, z ilu raportów i od ilu skautów pochodzi. Przy jednym raporcie
        // nie udajemy, że opinia już istnieje: piszemy, czego brakuje.
        const raporty = DB.reports.filter(r=>r.playerId===p.id);
        const skauci = [...new Set(raporty.map(r=>String(r.scout||'').trim()).filter(Boolean))];
        const oceny = raporty.map(r=>{
          const v = [...Object.values(r.phases||{}), ...Object.values(r.setPieces||{})]
            .map(Number).filter(x=>Number.isFinite(x) && x>0);
          return v.length ? v.reduce((x,y)=>x+y,0)/v.length : null;
        }).filter(x=>x!=null);
        const srednia = oceny.length ? oceny.reduce((x,y)=>x+y,0)/oceny.length : null;

        // Perspektywa: ta, która powtarza się najczęściej w raportach.
        const licznik = {};
        raporty.forEach(r=>{ if(r.perspektywa) licznik[r.perspektywa] = (licznik[r.perspektywa]||0)+1; });
        const perspektywa = Object.keys(licznik).sort((x,y)=>licznik[y]-licznik[x])[0] || '';

        const podsumowanie = `<div style="font-weight:400;font-size:11px;color:var(--ink-soft);margin-top:6px;">`
          + `Na podstawie ${raporty.length} ${raporty.length===1?'raportu':'raportów'}`
          + (skauci.length ? ` · ${skauci.length} ${skauci.length===1?'skaut':'skautów'}: ${esc(skauci.join(', '))}` : '')
          + (srednia!=null ? ` · średnia ocena ${fmt1(srednia)}/6` : '')
          + (perspektywa ? ` · perspektywa ${esc(perspektywa)}` : '')
          + `</div>`;

        if(raporty.length < 2){
          return `Opinia skautingu powstaje z co najmniej dwóch raportów — ten zawodnik ma na razie `
            + `${raporty.length === 0 ? 'zero' : 'jeden'}.`
            + (p.opisKoncowy ? `<div style="font-weight:400;margin-top:8px;">${esc(p.opisKoncowy).replace(/\n/g,'<br>')}`
                + `<span style="font-size:11px;color:var(--ink-faint);"> — opis końcowy z profilu, jeszcze nie opinia skautingu</span></div>` : '')
            + (raporty.length ? podsumowanie : '');
        }
        return (p.opisKoncowy
                  ? esc(p.opisKoncowy).replace(/\n/g,'<br>')
                  : `Zawodnik oglądany przez ${skauci.length>1?'kilku skautów':'skauta'}; wnioski szczegółowe w raportach powyżej. `
                    + `Opis końcowy nie został jeszcze wpisany w profilu.`)
               + podsumowanie;
      })()}</div>
    </div>
    ${p.hasAgent?`<div class="agent-box">
      <div class="lbl">Menedżer / agent</div>
      <div class="val">${agencyDisplayHtml(p)}</div>
    </div>`:''}
  </div>

  <div class="report-footer">Raport wygenerowany automatycznie przez Scout Base System &middot; ${new Date().toLocaleString('pl-PL')}</div>
  </body></html>`;

  // Generowanie prawdziwego pliku PDF: renderujemy raport w ukrytej ramce (iframe) - żeby style
  // (w tym print-owe) zastosowały się poprawnie i niezależnie od reszty strony - następnie html2canvas
  // przechwytuje to jako obraz, a jsPDF składa z niego gotowy, wielostronicowy plik PDF do pobrania.
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-99999px';
  iframe.style.top = '0';
  iframe.style.width = '794px';   // ~210mm przy 96dpi
  iframe.style.height = '1123px'; // ~297mm przy 96dpi (A4), ramka i tak przechwyci całą wysokość treści
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  try{
    const idoc = iframe.contentDocument || iframe.contentWindow.document;
    idoc.open(); idoc.write(html); idoc.close();
    await new Promise(resolve=>{
      if(idoc.readyState === 'complete') resolve();
      else iframe.onload = resolve;
      setTimeout(resolve, 400); // zabezpieczenie, gdyby onload nie odpalił się w tym środowisku
    });

    const targetEl = idoc.body;
    const SKALA = 2;
    // Tło podajemy literalnie. html2canvas parsuje tę wartość sam i nie zna funkcji var() —
    // przekazanie jej tutaj kończyło każde generowanie PDF błędem, niezależnie od treści raportu.
    const canvas = await html2canvas(targetEl, {scale:SKALA, useCORS:true, backgroundColor:'#FFFFFF', windowWidth:794});

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();

    // MARGINESY DRUKU.
    //
    // Obraz szedł dotąd od krawędzi do krawędzi kartki. Na ekranie wygląda to dobrze, ale każda
    // drukarka ma obszar niezadrukowywalny przy brzegach — treść przy górnej krawędzi i przy
    // bokach albo ginie, albo ląduje tuż przy cięciu. Zostawiamy więc oddech: treść zaczyna się
    // niżej i nie dotyka boków, a wysokość strony liczymy już po odjęciu marginesów.
    const marginesGoraMm = 12;
    const marginesBokMm = 7;
    const obrazSzerMm = pageWidthMm - 2 * marginesBokMm;
    const obrazWysMm = pageHeightMm - 2 * marginesGoraMm;
    // Ile pikseli obrazu mieści się na jednej stronie przy tej szerokości.
    const stronaPx = Math.floor(canvas.width * (obrazWysMm / obrazSzerMm));

    // ---------- GDZIE WOLNO PRZECIĄĆ ----------
    //
    // Wcześniej raport szedł jako jeden wysoki obraz cięty co 297 mm — a że treść nic o tym nie
    // wiedziała, cięcie wypadało w połowie nagłówka albo wiersza tabeli. Teraz pytamy o to sam
    // dokument: każdy element, który mieści się na stronie (nagłówek sekcji, wiersz tabeli, karta
    // oceny), wyznacza strefę zakazaną — nie wolno przez niego przejść. Cięcie robimy na
    // najniższym dozwolonym dnie elementu przed końcem strony.
    const zakazane = [];   // [{od, do}] w pikselach obrazu
    const dna = [];        // dopuszczalne miejsca cięcia
    // Miejsca, w których podział MA nastąpić — znacznik .page-break w szablonie. Dzięki temu
    // druga strona zaczyna się od historii, a nie od tego, co akurat wypadło po 297 mm.
    const wymuszone = [];
    idoc.body.querySelectorAll('*').forEach(el=>{
      const r = el.getBoundingClientRect();
      const od = Math.round((r.top + idoc.documentElement.scrollTop) * SKALA);
      const doo = Math.round((r.bottom + idoc.documentElement.scrollTop) * SKALA);
      // Znacznik podziału sprawdzamy PRZED odsianiem elementów o zerowej wysokości — sam
      // .page-break jest właśnie taki (to pusty div), więc wcześniej wypadał z listy i wymuszony
      // podział nigdy nie działał: druga strona zaczynała się tam, gdzie akurat skończyła pierwsza.
      if(el.classList && el.classList.contains('page-break')){ wymuszone.push(od); return; }
      if(r.height <= 0) return;
      dna.push(doo);
      // Bloki wyższe niż pół strony i tak trzeba kiedyś przeciąć — one nie blokują.
      if((doo - od) < stronaPx * 0.5) zakazane.push({od, do: doo});
    });
    wymuszone.sort((a,b)=>a-b);
    dna.sort((a,b)=>a-b);

    const wolnoCiac = (y)=> !zakazane.some(z=> y > z.od + 1 && y < z.do - 1);

    let y = 0, pierwsza = true;
    while(y < canvas.height){
      const koniecIdealny = Math.min(y + stronaPx, canvas.height);
      let ciecie = koniecIdealny;
      // Wymuszony podział ma pierwszeństwo przed szukaniem bezpiecznego miejsca.
      const wymuszony = wymuszone.find(w => w > y + 4 && w <= koniecIdealny);
      if(wymuszony){
        ciecie = wymuszony;
      } else if(koniecIdealny < canvas.height){
        // Najniższe dno elementu przed końcem strony, przy którym nie przecinamy niczego w pół.
        // Nie schodzimy poniżej 45% strony — inaczej jedna wysoka tabela zostawiałaby po sobie
        // kartkę zapełnioną w jednej trzeciej.
        const minimum = y + stronaPx * 0.45;
        let najlepsze = 0;
        for(const d of dna){
          if(d <= y) continue;
          if(d > koniecIdealny) break;
          if(d >= minimum && wolnoCiac(d)) najlepsze = d;
        }
        if(najlepsze) ciecie = najlepsze;

        // OGON NIE ZASŁUGUJE NA WŁASNĄ KARTKĘ. Po bezpiecznym cięciu zostawała czasem sama
        // stopka („Raport wygenerowany…") i lądowała na trzeciej, pustej stronie. Jeśli reszta
        // treści to taki skrawek, dociągamy cięcie do końca i mieścimy go na tej stronie —
        // obraz zmniejsza się o kilka procent, czego na wydruku nie widać.
        if(canvas.height - ciecie > 0 && canvas.height - ciecie < stronaPx * 0.08) ciecie = canvas.height;
      }

      const wysokoscWycinka = Math.max(1, ciecie - y);
      const kawalek = document.createElement('canvas');
      kawalek.width = canvas.width;
      kawalek.height = wysokoscWycinka;
      kawalek.getContext('2d').drawImage(canvas, 0, y, canvas.width, wysokoscWycinka, 0, 0, canvas.width, wysokoscWycinka);

      // Skalę liczymy z szerokości, ale gdyby wycinek był wyższy niż strona (patrz dociągnięty
      // ogon), zmniejszamy OBIE miary — inaczej treść wyszłaby poza obszar druku albo spłaszczyła
      // się w pionie.
      let rysSzer = obrazSzerMm;
      let rysWys = (wysokoscWycinka * obrazSzerMm) / canvas.width;
      if(rysWys > obrazWysMm){
        const k = obrazWysMm / rysWys;
        rysWys = obrazWysMm; rysSzer = obrazSzerMm * k;
      }
      if(!pierwsza) pdf.addPage();
      pierwsza = false;
      pdf.addImage(kawalek.toDataURL('image/jpeg', 0.95), 'JPEG',
        marginesBokMm + (obrazSzerMm - rysSzer) / 2, marginesGoraMm, rysSzer, rysWys);

      y = ciecie;
    }

    const safeName = ((p.firstName||'')+'_'+(p.lastName||'')).trim().replace(/\s+/g,'_').replace(/[^\w\-]/g,'') || 'zawodnik';
    pdf.save('raport_' + safeName + '.pdf');
  } finally {
    document.body.removeChild(iframe);
  }
}

async function processImageFile(file, maxDim){
  const MAX_DIM = maxDim || 256;
  let sourceCanvas;

  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if(isPdf){
    if(!pdfjsLib) throw new Error('Biblioteka do odczytu PDF nie jest dostępna.');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: buf}).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({scale: 2});
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = viewport.width;
    tempCanvas.height = viewport.height;
    await page.render({canvasContext: tempCanvas.getContext('2d'), viewport}).promise;
    sourceCanvas = tempCanvas;
  } else {
    const dataUrl = await new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = ()=>resolve(reader.result);
      reader.onerror = ()=>reject(new Error('Nie udało się odczytać pliku.'));
      reader.readAsDataURL(file);
    });
    const img = await new Promise((resolve,reject)=>{
      const im = new Image();
      im.onload = ()=>resolve(im);
      im.onerror = ()=>reject(new Error('To nie jest prawidłowy plik obrazu.'));
      im.src = dataUrl;
    });
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.naturalWidth;
    tempCanvas.height = img.naturalHeight;
    tempCanvas.getContext('2d').drawImage(img, 0, 0);
    sourceCanvas = tempCanvas;
  }

  const sw = sourceCanvas.width, sh = sourceCanvas.height;
  if(!sw || !sh) throw new Error('Pusty lub uszkodzony plik.');
  const scale = Math.min(1, MAX_DIM / Math.max(sw, sh));
  const outW = Math.max(1, Math.round(sw*scale));
  const outH = Math.max(1, Math.round(sh*scale));
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW; outCanvas.height = outH;
  outCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0, outW, outH);
  return outCanvas.toDataURL('image/png');
}
function processCrestFile(file){ return processImageFile(file, 128); }
function processPlayerPhotoFile(file){ return processImageFile(file, 480); }

async function processAttachmentFile(file){
  const MAX_BYTES = 4.5 * 1024 * 1024;
  if(file.size > MAX_BYTES) throw new Error('Plik jest za duży (maks. ok. 4,5 MB).');
  const dataUrl = await new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>resolve(reader.result);
    reader.onerror = ()=>reject(new Error('Nie udało się odczytać pliku.'));
    reader.readAsDataURL(file);
  });
  return {name: file.name, dataUrl, mime: file.type || 'application/octet-stream', size: file.size, uploadedAt: new Date().toISOString().slice(0,10)};
}

// Miniatura załącznika: obrazek (JPG/PNG) renderowany wprost, PDF przez natywny podgląd przeglądarki
// (pierwsza strona, dopasowana do szerokości, bez pasków narzędzi). pointer-events:none w CSS, żeby
// klik przechodził do karty (otwarcie „Zarządzaj załącznikami"). Inne typy — ikona zastępcza.
function attachmentThumbInner(a){
  const mime = (a && a.mime) || '';
  if(mime.startsWith('image/')) return `<img src="${a.dataUrl}" alt="${esc(a.name)}">`;
  if(mime === 'application/pdf') return `<embed src="${a.dataUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" type="application/pdf">`;
  return `<span class="attach-thumb-icon">📄</span>`;
}

function openTmProfileFromModal(){
  const tmInput = document.getElementById('pm-tm');
  const url = tmInput ? tmInput.value.trim() : '';
  if(!url){ alert('Najpierw wpisz link do profilu Transfermarkt w polu poniżej (sekcja z linkami).'); return; }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function wireLastModal(){
  const overlays = document.querySelectorAll('.modal-overlay');
  const ov = overlays[overlays.length-1];
  if(!ov) return;
  ov.addEventListener('click', e=>{ if(e.target===ov){ promotingTalentId=null; ov.remove(); } });
  ov.querySelectorAll('[data-action="close-modal"]').forEach(b=>b.onclick=()=>{ promotingTalentId=null; ov.remove(); });

  // Wybór klubu jako pole z wyszukiwaniem: lista alfabetyczna, a wpisywanie kolejnych liter zawęża
  // ją do pasujących klubów (bez uwzględniania wielkości liter i polskich znaków). Ukryte pole
  // #pm-club trzyma wybrane id klubu (odczytywane przy zapisie — bez zmian w handlerze zapisu).
  const clubHidden = ov.querySelector('#pm-club');
  const clubSearch = ov.querySelector('#pm-club-search');
  const clubList = ov.querySelector('#pm-club-list');
  const crestWrap = ov.querySelector('#pm-crest-preview');
  if(clubHidden && clubSearch && clubList){
    const norm = szukajNorm;
    const clubs = DB.clubs.slice().sort((a,b)=> (a.name||'').localeCompare(b.name||'','pl'));
    function setClub(c){
      clubHidden.value = c ? c.id : '';
      clubSearch.value = c ? c.name : '';
      if(crestWrap) crestWrap.innerHTML = crestImg(c?clubCrest(c.id):null,'lg');
    }
    function renderList(q){
      const nq = norm(q);
      const matches = (nq ? clubs.filter(c=>norm(c.name).includes(nq)) : clubs).slice(0,80);
      clubList.innerHTML = matches.length ? matches.map(c=>{
        const reg = (c.region||'').replace(' ZPN','');
        const sub = [c.league, reg].filter(Boolean).join(' · ');
        return `<div class="club-combo-item" data-id="${esc(c.id)}"><strong>${esc(c.name)}</strong>${sub?`<span class="club-combo-reg">${esc(sub)}</span>`:''}</div>`;
      }).join('') : '<div class="club-combo-empty">Brak klubu pasującego do frazy.</div>';
      clubList.style.display = 'block';
      clubList.querySelectorAll('.club-combo-item').forEach(it=>it.onmousedown=(e)=>{
        e.preventDefault(); // wybór przed zdarzeniem blur pola tekstowego
        setClub(clubs.find(x=>x.id===it.dataset.id));
        clubList.style.display = 'none';
      });
    }
    clubSearch.oninput = ()=>renderList(clubSearch.value);
    clubSearch.onfocus = ()=>renderList(clubSearch.value);
    clubSearch.onblur = ()=>setTimeout(()=>{
      clubList.style.display = 'none';
      // uzgodnienie: dokładne trafienie w nazwę = wybór; inaczej przywróć aktualnie wybrany klub.
      const exact = clubs.find(c=>norm(c.name)===norm(clubSearch.value));
      if(exact) setClub(exact);
      else setClub(clubs.find(c=>c.id===clubHidden.value) || null);
    }, 150);
  }

  const openTmBtn = ov.querySelector('[data-action="open-tm-profile"]');
  if(openTmBtn){
    openTmBtn.onclick = ()=>openTmProfileFromModal();
  }

  // "Wczytaj z wklejonego tekstu" — parsuje statystyki wklejone ze strony i wpisuje do pól liczbowych.
  const parseStatsBtn = ov.querySelector('[data-action="pm-parse-stats"]');
  if(parseStatsBtn){
    parseStatsBtn.onclick = ()=>{
      const ta = ov.querySelector('#pm-stats-paste') as HTMLTextAreaElement;
      const text = ta ? ta.value.trim() : '';
      if(!text){ alert('Najpierw wklej skopiowane statystyki do pola powyżej.'); return; }
      const parsed = parseStatsText(text);
      if(!Object.keys(parsed).length){ alert('Nie udało się rozpoznać statystyk w tym tekście. Sprawdź, czy widać liczby przy nazwach: mecze / minuty / gole / asysty.'); return; }
      const setVal = (id, v)=>{ if(v===undefined) return; const el2 = ov.querySelector(id) as HTMLInputElement; if(el2) el2.value = String(v); };
      setVal('#pm-matches', parsed.matches);
      setVal('#pm-minutes', parsed.minutes);
      setVal('#pm-goals', parsed.goals);
      setVal('#pm-assists', parsed.assists);
      const found = [];
      if(parsed.matches!==undefined) found.push('mecze: '+parsed.matches);
      if(parsed.minutes!==undefined) found.push('minuty: '+parsed.minutes);
      if(parsed.goals!==undefined) found.push('gole: '+parsed.goals);
      if(parsed.assists!==undefined) found.push('asysty: '+parsed.assists);
      alert('Wczytano — ' + found.join(', ') + '.\nSprawdź pola i kliknij „Zapisz".');
    };
  }


  const crestFileInput = ov.querySelector('#cm-crest-file');
  if(crestFileInput){
    const hiddenInput = ov.querySelector('#cm-crest');
    const preview = ov.querySelector('#cm-crest-preview');
    const status = ov.querySelector('#cm-crest-status');
    const altUrl = ov.querySelector('#cm-crest-url-alt');
    crestFileInput.onchange = async ()=>{
      const file = crestFileInput.files[0];
      if(!file) return;
      status.textContent = 'Przetwarzanie pliku...';
      status.style.color = 'var(--ink-soft)';
      try{
        const dataUrl = await processCrestFile(file);
        hiddenInput.value = dataUrl;
        preview.innerHTML = `<img src="${dataUrl}" class="crest-lg" alt="">`;
        status.textContent = '✓ Wgrano — zapisz klub, aby zachować.';
        status.style.color = 'var(--turf)';
      }catch(e){
        console.error(e);
        status.textContent = 'Nie udało się wczytać tego pliku. Spróbuj PNG/JPG albo wklej link poniżej.';
        status.style.color = 'var(--clay-dark)';
      }
    };
    if(altUrl){
      altUrl.oninput = ()=>{
        const v = altUrl.value.trim();
        if(v){
          hiddenInput.value = v;
          preview.innerHTML = `<img src="${esc(v)}" class="crest-lg" alt="">`;
        }
      };
    }
  }
  const agentRadios = ov.querySelectorAll('input[name="pm-agent"]');
  agentRadios.forEach(r=> r.onchange = ()=>{
    const wrap = ov.querySelector('#pm-agency-wrap');
    const checked = ov.querySelector('input[name="pm-agent"]:checked');
    wrap.style.display = (checked && checked.value==='tak') ? '' : 'none';
    // ODPOWIEDŹ NA TO PYTANIE JEST SPRAWDZENIEM.
    //
    // Profil rozróżnia trzy stany: „Tak", „Nie" i „niesprawdzone" — a to ostatnie znaczy tylko
    // tyle, że nikt się jeszcze tym zawodnikiem nie zajął. Zaznaczenie „Nie" w edycji nie
    // zostawiało po sobie żadnego śladu, więc profil dalej pisał „niesprawdzone", choć odpowiedź
    // padła. Zapamiętujemy więc dotknięcie pola i przy zapisie stemplujemy datę sprawdzenia.
    // Sam fakt otwarcia okna nie wystarcza: domyślnie zaznaczone jest „Nie", a stemplowanie
    // każdego zapisu opróżniłoby kolejkę „młodzieżowiec bez menedżera" z nikim niesprawdzonym.
    ov.dataset.agentOdpowiedziano = '1';
  });
  const contractRadios = ov.querySelectorAll('input[name="pm-contract"]');
  contractRadios.forEach(r=> r.onchange = ()=>{
    const wrap = ov.querySelector('#pm-contract-wrap');
    const checked = ov.querySelector('input[name="pm-contract"]:checked');
    wrap.style.display = (checked && checked.value==='tak') ? '' : 'none';
  });

  ov.querySelectorAll('[data-action="save-player"]').forEach(b=>b.onclick=async()=>{
    const first = document.getElementById('pm-first').value.trim();
    const last = document.getElementById('pm-last').value.trim();
    if(!first || !last){ alert('Podaj imię i nazwisko.'); return; }
    const origLabel = b.textContent;
    b.disabled = true; b.textContent = 'Zapisywanie...';
    try{
    const birthDate = document.getElementById('pm-birth').value;
    const agentChecked = ov.querySelector('input[name="pm-agent"]:checked');
    const hasAgent = agentChecked ? agentChecked.value==='tak' : false;
    // Data sprawdzenia: albo ta, którą zawodnik już miał, albo dzisiejsza — gdy odpowiedź padła
    // teraz (dotknięto pola) lub gdy menedżer jest wskazany, bo to samo w sobie jest odpowiedzią.
    const wczesniejSprawdzone = p && p.agentCheckedAt ? p.agentCheckedAt : '';
    const agentCheckedAt = (ov.dataset.agentOdpowiedziano === '1' || hasAgent)
      ? new Date().toISOString().slice(0,10)
      : wczesniejSprawdzone;
    const customFields = {};
    ov.querySelectorAll('.pm-custom').forEach(inp=>{ customFields[inp.dataset.field] = inp.value.trim(); });
    const data = {
      firstName: first, lastName: last,
      agentCheckedAt,
      birthDate, birthYear: birthDate? String(new Date(birthDate).getFullYear()) : '',
      position: document.getElementById('pm-position').value,
      foot: document.getElementById('pm-foot').value,
      height: Number(document.getElementById('pm-height').value)||null,
      nationality: document.getElementById('pm-nationality').value.trim(),
      status: document.getElementById('pm-status').value,
      clubId: document.getElementById('pm-club').value,
      scout: document.getElementById('pm-scout').value.trim(),
      videoLink: document.getElementById('pm-video').value.trim(),
      lnpLink: normalizuj90minut(document.getElementById('pm-lnp').value.trim()),
      tmLink: document.getElementById('pm-tm').value.trim(),
      hasAgent,
      agencyName: hasAgent ? document.getElementById('pm-agency').value.trim() : '',
      hasContract: (ov.querySelector('input[name="pm-contract"]:checked')||{}).value === 'tak',
      contractUntil: ((ov.querySelector('input[name="pm-contract"]:checked')||{}).value === 'tak') ? document.getElementById('pm-contract-until').value : '',
      formation: document.getElementById('pm-formation').value,
      matches: document.getElementById('pm-matches').value===''? null : Number(document.getElementById('pm-matches').value),
      minutes: document.getElementById('pm-minutes').value===''? null : Number(document.getElementById('pm-minutes').value),
      goals: document.getElementById('pm-goals').value===''? null : Number(document.getElementById('pm-goals').value),
      assists: document.getElementById('pm-assists').value===''? null : Number(document.getElementById('pm-assists').value),
      instagramLink: document.getElementById('pm-instagram').value.trim(),
      facebookLink: document.getElementById('pm-facebook').value.trim(),
      kadraWojewodzka: (ov.querySelector('input[name="pm-kadra"]:checked')||{}).value === 'tak',
      reprezentacja: (ov.querySelector('input[name="pm-repr"]:checked')||{}).value === 'tak',
      powolania: document.getElementById('pm-powolania').value===''? null : Number(document.getElementById('pm-powolania').value),
      customFields,
      notes: document.getElementById('pm-notes').value.trim()
    };
    if(editingPlayerId){
      const p = DB.players.find(x=>x.id===editingPlayerId);
      Object.assign(p, data);
    } else {
      data.id = uid('Z');
      data.dateAdded = new Date().toISOString().slice(0,10);
      data.source = 'manual';
      DB.players.push(data);
    }
    await savePlayers();
    if(promotingTalentId){
      const talentId = promotingTalentId;
      if(await deleteTalentRecord(talentId)){
        DB.talents = DB.talents.filter(t=>t.id!==talentId);
      }
      promotingTalentId = null;
    }
    ov.remove(); editingPlayerId=null; render();
    }catch(e){ console.error('Zapis zawodnika nie powiódł się:', e); b.disabled=false; b.textContent=origLabel; alert('Nie udało się zapisać zawodnika: ' + (e.message||e)); }
  });
  ov.querySelectorAll('[data-action="save-agency"]').forEach(b=>b.onclick=async()=>{
    const name = (document.getElementById('am-name') as any).value.trim();
    if(!name){ alert('Podaj nazwę agencji.'); return; }
    const pola = {
      name,
      country: (document.getElementById('am-country') as any).value.trim(),
      city: (document.getElementById('am-city') as any).value.trim(),
      email: (document.getElementById('am-email') as any).value.trim(),
      phone: (document.getElementById('am-phone') as any).value.trim(),
      tmLink: (document.getElementById('am-tm') as any).value.trim(),
      website: (document.getElementById('am-web') as any).value.trim(),
      notes: (document.getElementById('am-notes') as any).value.trim(),
    };
    const id = (ov as any).dataset.agencyId;
    const istniejaca = id ? agencyById(id) : null;
    if(istniejaca) Object.assign(istniejaca, pola);
    else DB.agencies.push(Object.assign({id: uid('AG'), dateAdded: new Date().toISOString().slice(0,10)}, pola));
    const ok = await saveAgencies();
    if(!ok){ alert('Nie udało się zapisać — sprawdź baner u góry strony.'); return; }
    ov.remove(); render();
  });
  ov.querySelectorAll('[data-action="save-agent"]').forEach(b=>b.onclick=async()=>{
    const first = (document.getElementById('mm-first') as any).value.trim();
    const last = (document.getElementById('mm-last') as any).value.trim();
    if(!first && !last){ alert('Podaj imię lub nazwisko menedżera.'); return; }
    const agencyId = (document.getElementById('mm-agency') as any).value;
    if(!agencyId){ alert('Menedżer musi należeć do agencji — najpierw dodaj agencję.'); return; }
    const pola = {
      agencyId, firstName: first, lastName: last,
      email: (document.getElementById('mm-email') as any).value.trim(),
      phone: (document.getElementById('mm-phone') as any).value.trim(),
      licence: (document.getElementById('mm-licence') as any).value.trim(),
      tmLink: (document.getElementById('mm-tm') as any).value.trim(),
      notes: (document.getElementById('mm-notes') as any).value.trim(),
    };
    const id = (ov as any).dataset.agentId;
    const istniejacy = id ? agentById(id) : null;
    if(istniejacy){
      // Przeniesienie osoby do innej agencji musi zabrać ze sobą jej zawodników — inaczej
      // zostaliby przypisani do opiekuna, którego w ich agencji już nie ma.
      if(istniejacy.agencyId !== agencyId){
        DB.players.forEach(p=>{ if(p.agentId===istniejacy.id) p.agencyId = agencyId; });
      }
      Object.assign(istniejacy, pola);
    } else {
      DB.agents.push(Object.assign({id: uid('MN'), dateAdded: new Date().toISOString().slice(0,10)}, pola));
    }
    const ok = await saveAgents() && await savePlayers();
    if(!ok){ alert('Nie udało się zapisać — sprawdź baner u góry strony.'); return; }
    ov.remove(); render();
  });
  ov.querySelectorAll('[data-action="save-club"]').forEach(b=>b.onclick=async()=>{
    const name = document.getElementById('cm-name').value.trim();
    if(!name){ alert('Podaj nazwę klubu.'); return; }
    const origLabel = b.textContent;
    b.disabled = true; b.textContent = 'Zapisywanie...';
    try{
    const crestValue = document.getElementById('cm-crest').value.trim();
    // Wgrane obrazy (base64) trafiają do osobnego magazynu, izolowanego od reszty danych klubu — tylko
    // zwykłe adresy URL (małe, niegroźne dla rozmiaru) zostają wprost w rekordzie klubu.
    const isUploadedImage = crestValue.startsWith('data:image');
    const data = {
      name,
      region: document.getElementById('cm-region').value,
      league: document.getElementById('cm-league').value,
      season: document.getElementById('cm-season').value.trim(),
      city: document.getElementById('cm-city').value.trim(),
      crestUrl: isUploadedImage ? '' : crestValue,
      juniorCategories: document.getElementById('cm-juniors').value.trim(),
      profileLnp: normalizuj90minut(document.getElementById('cm-lnp').value.trim()),
      profileTm: document.getElementById('cm-tm').value.trim()
    };
    const id = ov.dataset.clubId;
    let savedClubId = id;
    if(id){
      const c = DB.clubs.find(x=>x.id===id);
      Object.assign(c, data);
    } else {
      data.id = uid('K');
      savedClubId = data.id;
      DB.clubs.push(data);
    }
    await saveClubs();
    if(isUploadedImage){
      DB.clubCrests[savedClubId] = crestValue;
      await saveClubCrests();
    }
    ov.remove(); render();
    }catch(e){ console.error('Zapis klubu nie powiódł się:', e); b.disabled=false; b.textContent=origLabel; alert('Nie udało się zapisać klubu: ' + (e.message||e)); }
  });
}

// ---------- BRAMKA LOGOWANIA ----------
// Aplikacja nie startuje, dopóki nie ma sesji. Do tej pory nie było jej wcale: przycisk „Wyloguj się"
// wołał funkcję, która nie istniała, a dane dawały się czytać i zapisywać bez żadnego uwierzytelnienia.
function loginScreenHtml(tryb, komunikat, blad){
  // Ostatni parametr jest opcjonalny — pola bez autofokusu wołają tę funkcję z trzema argumentami.
  const pole = (id, typ, etykieta, autofokus?)=>`
    <div class="field-wrap">
      <label class="field" for="${id}">${etykieta}</label>
      <input id="${id}" type="${typ}" ${autofokus?'autofocus':''} autocomplete="${typ==='password'?'current-password':'username'}">
    </div>`;
  const tresc = tryb==='reset' ? `
      <p class="note">Podaj adres e-mail konta. Wyślemy na niego link do ustawienia nowego hasła.</p>
      ${pole('lg-email','email','Adres e-mail', true)}
      <div class="modal-actions" style="justify-content:space-between;">
        <button class="link-btn" data-action="lg-tryb-login">← Wróć do logowania</button>
        <button class="gold" data-action="lg-reset">Wyślij link</button>
      </div>`
    : tryb==='nowe-haslo' ? `
      <p class="note">Ustaw nowe hasło do swojego konta. Minimum 8 znaków.</p>
      ${pole('lg-haslo1','password','Nowe hasło', true)}
      ${pole('lg-haslo2','password','Powtórz hasło')}
      <div class="modal-actions"><button class="gold" data-action="lg-zapisz-haslo">Zapisz nowe hasło</button></div>`
    : `
      ${pole('lg-email','email','Adres e-mail', true)}
      ${pole('lg-haslo','password','Hasło')}
      <div class="modal-actions" style="justify-content:space-between;">
        <button class="link-btn" data-action="lg-tryb-reset">Nie pamiętam hasła</button>
        <button class="gold" data-action="lg-login">Zaloguj się</button>
      </div>
      ${WYMAGAJ_LOGOWANIA ? '' : `<p class="note" style="margin-top:10px;">
        <button class="link-btn" data-action="lg-wroc" style="padding:0;">← Wróć do systemu bez logowania</button>
        — logowanie nie jest jeszcze wymagane, ten ekran służy na razie do sprawdzenia hasła.
      </p>`}
      <p class="note" style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px;font-size:11.5px;">
        Nie masz konta? Zgłoś się przez <a href="/#dostep">formularz na stronie głównej</a> —
        dostęp otwiera administrator systemu po sprawdzeniu zgłoszenia.
      </p>`;

  return `<div class="login-wrap"><div class="login-card">
    <h1 class="login-title">Scout Base System</h1>
    <p class="login-sub">${tryb==='nowe-haslo' ? 'Ustawienie nowego hasła' : tryb==='reset' ? 'Odzyskiwanie hasła' : 'Zaloguj się, aby korzystać z systemu'}</p>
    ${blad ? `<div class="login-error">${esc(blad)}</div>` : ''}
    ${komunikat ? `<div class="login-info">${esc(komunikat)}</div>` : ''}
    ${tresc}
  </div></div>`;
}

let loginTryb = 'login', loginKomunikat = '', loginBlad = '';
// Konto zalogowanego użytkownika (rola i zgoda administratora). Null, gdy nikt nie jest zalogowany
// albo gdy baza nie ma jeszcze tabeli kont — patrz wpuscZalogowanego().
let kontoUzytkownika = null;
// Sama sesja (e-mail i identyfikator). Rozdzielone od konta, bo sesja może istnieć także wtedy,
// gdy wiersza w sbs_konta jeszcze nie ma — a przycisk w panelu bocznym pyta właśnie o sesję.
let sesjaUzytkownika = null;

function renderLoginScreen(){
  document.querySelector('.app').style.display = 'none';
  let host = document.getElementById('login-host');
  if(!host){
    host = document.createElement('div');
    host.id = 'login-host';
    document.body.appendChild(host);
  }
  host.innerHTML = loginScreenHtml(loginTryb, loginKomunikat, loginBlad);

  const przeladuj = ()=>renderLoginScreen();
  const q = id => document.getElementById(id);

  host.querySelectorAll('[data-action="lg-wroc"]').forEach(b=>b.onclick=()=>{
    host.remove();
    document.querySelector('.app').style.display='';
    render();
  });
  host.querySelectorAll('[data-action="lg-tryb-reset"]').forEach(b=>b.onclick=()=>{
    loginTryb='reset'; loginBlad=''; loginKomunikat=''; przeladuj();
  });
  host.querySelectorAll('[data-action="lg-tryb-login"]').forEach(b=>b.onclick=()=>{
    loginTryb='login'; loginBlad=''; loginKomunikat=''; przeladuj();
  });

  host.querySelectorAll('[data-action="lg-login"]').forEach(b=>b.onclick=async()=>{
    const email=(q('lg-email').value||'').trim(), haslo=q('lg-haslo').value||'';
    if(!email || !haslo){ loginBlad='Podaj adres e-mail i hasło.'; przeladuj(); return; }
    b.disabled=true; b.textContent='Loguję…';
    const r = await signIn(email, haslo);
    if(r.ok){ await wpuscZalogowanego(); return; }
    loginBlad = r.error || 'Nie udało się zalogować.'; loginKomunikat=''; przeladuj();
  });

  host.querySelectorAll('[data-action="lg-reset"]').forEach(b=>b.onclick=async()=>{
    const email=(q('lg-email').value||'').trim();
    if(!email){ loginBlad='Podaj adres e-mail.'; przeladuj(); return; }
    b.disabled=true; b.textContent='Wysyłam…';
    const r = await requestPasswordReset(email);
    loginTryb='login'; loginBlad = r.ok ? '' : (r.error||'');
    // Komunikat celowo neutralny — nie ujawnia, czy konto o tym adresie istnieje.
    loginKomunikat = r.ok ? 'Jeśli konto o tym adresie istnieje, wysłaliśmy na nie link do zmiany hasła. Sprawdź też folder spam.' : '';
    przeladuj();
  });

  host.querySelectorAll('[data-action="lg-zapisz-haslo"]').forEach(b=>b.onclick=async()=>{
    const h1=q('lg-haslo1').value||'', h2=q('lg-haslo2').value||'';
    if(h1.length < 8){ loginBlad='Hasło musi mieć co najmniej 8 znaków.'; przeladuj(); return; }
    if(h1 !== h2){ loginBlad='Podane hasła nie są identyczne.'; przeladuj(); return; }
    b.disabled=true; b.textContent='Zapisuję…';
    const r = await setNewPassword(h1);
    if(r.ok){
      history.replaceState(null,'',window.location.pathname);   // usuń token z adresu
      await wpuscZalogowanego(); return;
    }
    loginBlad = r.error || 'Nie udało się zmienić hasła.'; przeladuj();
  });

  // Enter zatwierdza formularz — bez tego trzeba celować w przycisk.
  host.querySelectorAll('input').forEach(inp=>inp.addEventListener('keydown',(e)=>{
    if(e.key!=='Enter') return;
    const btn = host.querySelector('.modal-actions .gold');
    if(btn) btn.click();
  }));
}

async function performLogout(){
  if(!confirm('Wylogować się z systemu?')) return;
  await signOut();
  window.location.reload();
}

// ---------- EKRAN „KONTO CZEKA NA AKCEPTACJĘ" ----------
// Samo zalogowanie nie wystarcza: konto musi być jeszcze zatwierdzone przez administratora.
// Rozstrzyga o tym baza (reguły dostępu wpuszczają wyłącznie konta zatwierdzone), a ten ekran
// mówi o tym po ludzku — zamiast pokazywać pusty system bez jednego wiersza danych.
function renderKontoScreen(konto){
  document.querySelector('.app').style.display = 'none';
  let host = document.getElementById('login-host');
  if(!host){
    host = document.createElement('div');
    host.id = 'login-host';
    document.body.appendChild(host);
  }
  const odrzucone = konto && konto.status === 'odrzucone';
  host.innerHTML = `<div class="login-wrap"><div class="login-card">
    <h1 class="login-title">Scout Base System</h1>
    <p class="login-sub">${odrzucone ? 'Dostęp nie został przyznany' : 'Konto czeka na akceptację'}</p>
    <div class="${odrzucone ? 'login-error' : 'login-info'}">
      ${odrzucone
        ? 'Administrator systemu nie przyznał dostępu temu kontu.'
        : 'Zgłoszenie dotarło. Dostęp do danych otwiera administrator systemu — dostaniesz wiadomość, gdy podejmie decyzję.'}
    </div>
    <p class="note">
      Zalogowano jako <strong>${esc((konto && konto.email) || '')}</strong>.
      W pilnej sprawie napisz na <strong>system@scoutbasesystem.com</strong>.
    </p>
    <div class="modal-actions" style="justify-content:space-between;">
      <button class="link-btn" data-action="konto-wyloguj">Wyloguj się</button>
      <button class="gold" data-action="konto-sprawdz">Sprawdź ponownie</button>
    </div>
  </div></div>`;

  host.querySelectorAll('[data-action="konto-wyloguj"]').forEach(b=>b.onclick=async()=>{
    await signOut();
    window.location.reload();
  });
  host.querySelectorAll('[data-action="konto-sprawdz"]').forEach(b=>b.onclick=async()=>{
    b.disabled = true; b.textContent = 'Sprawdzam…';
    const swieze = await mojeKonto();
    if(swieze && swieze.status === 'zatwierdzone'){
      host.remove(); document.querySelector('.app').style.display=''; kontoUzytkownika = swieze; loadAll(); return;
    }
    renderKontoScreen(swieze || konto);
  });
}

// WEJŚCIE DO SYSTEMU.
//
// Docelowo dwa warunki, oba obowiązkowe: sesja (logowanie) i zgoda administratora (status konta).
// Ekran to tylko uprzejma forma — właściwą blokadą są reguły dostępu w bazie, wgrywane skryptem
// supabase/migration_2026-08-11_konta_i_zgoda.sql. Bez nich sam ekran niczego by nie chronił:
// klucz dostępu jest wpisany w kod strony i każdy może odpytać bazę z pominięciem aplikacji.
//
// PRZEŁĄCZNIK: true = ekran logowania jest warunkiem wejścia; false = system otwiera się bez hasła.
//
// Włączony na życzenie właściciela: system ma być zamknięty dla osób z zewnątrz. Po zalogowaniu
// nie ma żadnych dalszych ograniczeń — zalogowany widzi dokładnie to, co dotąd widział każdy.
//
// UWAGA: sam przełącznik zamyka WIDOK, nie dane. Dopóki nie jest uruchomiona migracja
// supabase/migration_2026-08-11_konta_i_zgoda.sql, bazę da się czytać z pominięciem aplikacji
// (klucz dostępu jest wpisany w kod strony). Po uruchomieniu migracji baza jest zamknięta
// niezależnie od tego przełącznika. Instrukcja: DOSTEP.md.
const WYMAGAJ_LOGOWANIA = true;

async function startApp(){
  // Wejście z linku resetującego: Supabase tworzy tymczasową sesję, więc zanim wpuścimy do
  // aplikacji, prosimy o ustawienie nowego hasła.
  if(isPasswordRecoveryLink()){
    loginTryb='nowe-haslo';
    renderLoginScreen();
    return;
  }
  const user = await currentUser();
  sesjaUzytkownika = user;
  // Zalogowanego sprawdzamy zawsze — także przy wyłączonym przełączniku. Dzięki temu zakładka
  // „Dostęp" i stan konta działają już teraz, bez zamykania systemu przed nikim.
  if(user){ await wpuscZalogowanego(); return; }
  if(!WYMAGAJ_LOGOWANIA){ loadAll(); return; }
  renderLoginScreen();
}

// Sprawdzenie zgody administratora — wołane po każdym udanym logowaniu i przy starcie z sesją.
async function wpuscZalogowanego(){
  sesjaUzytkownika = await currentUser();
  kontoUzytkownika = await mojeKonto();
  // Brak wiersza w sbs_konta oznacza bazę sprzed wdrożenia tabeli kont (skrypt migracji nie został
  // jeszcze uruchomiony). Blokowanie takiego konta odcięłoby właściciela od własnych danych, a nic
  // by nie dało: skoro nie ma tabeli kont, nie ma też reguł, które by o nią pytały.
  if(kontoUzytkownika && kontoUzytkownika.status !== 'zatwierdzone'){
    renderKontoScreen(kontoUzytkownika);
    return;
  }
  const host = document.getElementById('login-host');
  if(host) host.remove();
  document.querySelector('.app').style.display = '';
  loadAll();
}

startApp();
