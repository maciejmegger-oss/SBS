import "./style.css";
import { storage } from "./data/storage";
import { currentUser, signIn, signOut, requestPasswordReset, setNewPassword, isPasswordRecoveryLink } from "./data/auth";
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

let DB: Database = { players: [], clubs: [], observations: [], reports: [], talents: [], contacts: [], matches: [], clubCrests: {}, settings: null };
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
  leagues: ["Ekstraklasa","I liga","II liga","III liga, gr. I","III liga, gr. II","III liga, gr. III","III liga, gr. IV","IV liga (pomorska)","IV liga (zachodniopomorska)","IV liga (dolnośląska)","IV liga (śląska)","IV liga (wielkopolska)","IV liga (kujawsko-pomorska)","Klasa okręgowa","CLJ U19","CLJ U17 (zachodnia)","CLJ U17 (wschodnia)","Liga makroregionalna U16","Rocznik 2011","Rocznik 2012","Rocznik 2013","Rocznik 2014"],
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
  {name:"Zagłębie II Lubin", region:"Dolnośląski ZPN", city:"Lubin", klubId:1830},
  {name:"KS Stilon Gorzów Wielkopolski", region:"Lubuski ZPN", city:"Gorzów Wielkopolski", klubId:15203},
  {name:"Stal Brzeg", region:"Opolski ZPN", city:"Brzeg", klubId:12983},
  {name:"LKS Goczałkowice Zdrój", region:"Śląski ZPN", city:"Goczałkowice-Zdrój", klubId:3932},
  {name:"Ślęza Wrocław", region:"Dolnośląski ZPN", city:"Wrocław", klubId:391},
  {name:"Sparta Katowice", region:"Śląski ZPN", city:"Katowice", klubId:4018},
  {name:"Skra Częstochowa", region:"Śląski ZPN", city:"Częstochowa", klubId:1567},
  {name:"Słowianin Wolibórz", region:"Opolski ZPN", city:"Wolibórz", klubId:7684},
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

const ALL_SEED_CLUBS = [
  ...SEED_CLUBS_II_LIGA, ...SEED_CLUBS_III_LIGA_GR1, ...SEED_CLUBS_III_LIGA_GR2,
  ...SEED_CLUBS_III_LIGA_GR3, ...SEED_CLUBS_III_LIGA_GR4,
  ...SEED_CLUBS_IV_POMORSKA, ...SEED_CLUBS_IV_ZACHODNIOPOMORSKA, ...SEED_CLUBS_IV_DOLNOSLASKA,
  ...SEED_CLUBS_IV_SLASKA, ...SEED_CLUBS_IV_WIELKOPOLSKA
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
function fmt1(n){ return (Math.round(n*10)/10).toFixed(1); }

async function enrichZniczRoster(){
  const club = DB.clubs.find(c => c.name === 'Znicz Pruszków');
  if(!club) return {ok:false, error:'Nie znaleziono klubu Znicz Pruszków.'};
  let changed = 0;
  SEED_PLAYER_ENRICHMENT_ZNICZ.forEach(enrich=>{
    const pl = DB.players.find(x => x.firstName===enrich.firstName && x.lastName===enrich.lastName && x.clubId===club.id);
    if(!pl) return;
    if(!pl.tmLink && enrich.tmLink){ pl.tmLink = enrich.tmLink; changed++; }
    if(!pl.birthDate && enrich.birthDate){ pl.birthDate = enrich.birthDate; pl.birthYear = new Date(enrich.birthDate).getFullYear(); changed++; }
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
    if(!pl.birthDate && enrich.birthDate){ pl.birthDate = enrich.birthDate; pl.birthYear = new Date(enrich.birthDate).getFullYear(); changed++; }
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
      let birthYear = seed.birthDate ? new Date(seed.birthDate).getFullYear() : '';
      if(!seed.birthDate && seed.age){
        birthYear = 2026 - seed.age;
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
  const [p, c, cc, o, rp, tl, ct, mt, pmaRow, s,
    seedFlag, enrichFlag, enrichAviaFlag, enrichGornikFlag, enrichAviaV2Flag, recoMigrationFlag, statusMigrationFlag] = await Promise.all([
    storage.get('scouting:players', true).catch(()=>null),
    storage.get('scouting:clubs', true).catch(()=>null),
    storage.get('scouting:club_crests', true).catch(()=>null),
    storage.get('scouting:observations', true).catch(()=>null),
    storage.get('scouting:reports', true).catch(()=>null),
    storage.get('scouting:talents', true).catch(()=>null),
    storage.get('scouting:contacts', true).catch(()=>null),
    storage.get('scouting:matches', true).catch(()=>null),
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
  try{ DB.clubCrests = cc ? JSON.parse(cc.value) : {}; }catch(e){ DB.clubCrests = {}; }
  try{ DB.observations = o ? JSON.parse(o.value) : []; }catch(e){ DB.observations = []; }
  try{ DB.reports = rp ? JSON.parse(rp.value) : []; }catch(e){ DB.reports = []; }
  try{ DB.talents = tl ? JSON.parse(tl.value) : []; }catch(e){ DB.talents = []; }
  try{ DB.contacts = ct ? JSON.parse(ct.value) : []; }catch(e){ DB.contacts = []; }
  try{ DB.matches = mt ? JSON.parse(mt.value) : []; }catch(e){ DB.matches = []; }
  try{ positionMapAssignments = pmaRow ? JSON.parse(pmaRow.value) : {}; }catch(e){ positionMapAssignments = {}; }
  try{
    const loaded = s ? JSON.parse(s.value) : {};
    DB.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), loaded);
  }catch(e){ DB.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); }
  if(DB.settings.scouts && DB.settings.scouts.length){ currentScout = DB.settings.scouts[0]; }
  // Wczesny render — użytkownik widzi bazę natychmiast po równoległym odczycie; migracje/seed/wzbogacanie
  // (poniżej) na istniejącej instalacji są prawie natychmiastowe i i tak wywołają końcowe render().
  try{ render(); }catch(e){ console.error('Wczesny render() nie powiódł się (niekrytyczny):', e); }

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
  let addedSeed = false;
  ALL_SEED_CLUBS.forEach(seed=>{
    const exists = DB.clubs.some(c2=>c2.name===seed.name && c2.league===seed.league);
    if(!exists){ DB.clubs.push(Object.assign({}, seed, {id: uid('K')})); addedSeed = true; }
  });
  if(addedSeed) await saveClubs();
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
    // IV liga kujawsko-pomorska doszła później — wstawiamy ją PRZY pozostałych grupach IV ligi,
    // żeby lista nie miała jej doklejonej na końcu, za kategoriami juniorskimi.
    if(!DB.settings.leagues.includes('IV liga (kujawsko-pomorska)')){
      const last4 = DB.settings.leagues.map(l=>/^IV liga \(/.test(l)).lastIndexOf(true);
      DB.settings.leagues.splice(last4 >= 0 ? last4+1 : DB.settings.leagues.length, 0, 'IV liga (kujawsko-pomorska)');
    }
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
async function saveClubCrests(){ return robustStorageSet('scouting:club_crests', JSON.stringify(DB.clubCrests)); }
async function saveObservations(){ return robustStorageSet('scouting:observations', JSON.stringify(DB.observations)); }
async function saveReports(){ return robustStorageSet('scouting:reports', JSON.stringify(DB.reports)); }
async function saveTalents(){ return robustStorageSet('scouting:talents', JSON.stringify(DB.talents)); }
async function saveContacts(){ return robustStorageSet('scouting:contacts', JSON.stringify(DB.contacts)); }
async function saveMatches(){ return robustStorageSet('scouting:matches', JSON.stringify(DB.matches)); }

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
  return `<svg class="${cls}" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" style="background:#fff;">
    <path d="M22 3 L38 8 L38 21 C38 30.5 31 37.5 22 40.5 C13 37.5 6 30.5 6 21 L6 8 Z" fill="#16302A" stroke="#C69B3C" stroke-width="1.6"/>
    <text x="22" y="${size==='lg'?27:26}" text-anchor="middle" font-family="'Barlow Condensed',sans-serif" font-weight="700" font-size="${fs*2}" fill="#F6F3EA">${esc(initials)}</text>
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
  if(!obs.length && overall===null && !avgs) return null;
  const last = obs.length ? obs[obs.length-1]
    : {date: reps.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(r=>r.date).pop() || ''};
  return {avgs, overall, count: obs.length, reportCount: ratedReports, last};
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
const RADAR_COLORS = ['#16302A', '#C69B3C', '#B6503F']; // pitch / gold / clay — do 3 zawodników
// Radar (wykres pajęczy) z 5 atrybutów (RATING_KEYS, skala 1-10). entries: [{label, avgs:{k:val}, count}].
function radarSvg(entries){
  const keys = RATING_KEYS, N = keys.length, max = 10;
  const cx = 150, cy = 150, R = 96;
  const ang = i => (-90 + i*(360/N)) * Math.PI/180;
  const pt = (i, r) => [ +(cx + r*Math.cos(ang(i))).toFixed(1), +(cy + r*Math.sin(ang(i))).toFixed(1) ];
  let grid = '';
  for(let ring=2; ring<=10; ring+=2){
    const rr = R*ring/max;
    grid += `<polygon points="${keys.map((_,i)=>pt(i,rr).join(',')).join(' ')}" fill="none" stroke="#E7E2D3" stroke-width="1"/>`;
  }
  let axes = '';
  keys.forEach((k,i)=>{
    const [x,y] = pt(i,R);
    axes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#E7E2D3" stroke-width="1"/>`;
    const [lx,ly] = pt(i,R+20);
    const anchor = Math.abs(lx-cx)<6 ? 'middle' : (lx>cx ? 'start' : 'end');
    axes += `<text x="${lx}" y="${ly+3}" text-anchor="${anchor}" font-size="11" font-weight="600" fill="#5B6560">${esc(RATING_LABELS[k]||k)}</text>`;
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
    return `<tr><td>${esc(RATING_LABELS[k])}</td>${withAvg.map(e=>`<td style="${e.avg.avgs[k]===mx?'font-weight:800;color:var(--pitch);':''}">${fmt1(e.avg.avgs[k])}</td>`).join('')}</tr>`;
  }).join('');
  const overallRow = `<tr style="border-top:2px solid #E3DECE;"><td><strong>Śr. z raportów</strong></td>${withAvg.map(e=>`<td><strong>${e.avg.overall!=null?fmt1(e.avg.overall):'—'}</strong></td>`).join('')}</tr>`;
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
    return `<div class="card"><h4 style="margin-top:0;color:var(--pitch);">Statystyki sezonu</h4>
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
        return `<td style="text-align:right;${czyNaj?'font-weight:800;color:var(--pitch);':''}">
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
        return `<td style="text-align:right;${czyNaj?'font-weight:800;color:var(--pitch);':''}">
          ${v.toFixed(cyfry)}<div class="note" style="font-size:10.5px;">${proc}%</div>
          ${statBar(proc, rozs===0 ? 1 : (v-najm)/rozs)}</td>`;
      }).join('')}
    </tr>`;
  };

  return `<div class="card" style="overflow:auto;">
    <h4 style="margin-top:0;color:var(--pitch);">Statystyki sezonu</h4>
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
    return `<div class="card"><h4 style="margin-top:0;color:var(--pitch);">Raporty</h4>
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
        : `<td style="text-align:right;${v===max&&konkretne.length>1?'font-weight:800;color:var(--pitch);':''}">
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
      <div style="font-weight:800;color:var(--pitch);font-size:13px;margin-bottom:5px;">${esc(o.label)}</div>
      <div class="grid" style="grid-template-columns:repeat(${entries.length},minmax(0,1fr));gap:10px;">
        ${teksty.map((t,i)=>`<div style="background:#FBF9F3;border:1px solid #EFEADD;border-radius:8px;padding:9px;font-size:12.5px;line-height:1.55;">
          <div class="note" style="font-size:10.5px;margin-bottom:3px;">${esc(entries[i].p.lastName)}</div>
          ${t ? esc(t) : '<span style="color:var(--ink-soft);">— brak opisu —</span>'}
        </div>`).join('')}
      </div>
    </div>`;
  }).filter(Boolean).join('');

  return `<div class="card" style="overflow:auto;">
    <h4 style="margin-top:0;color:var(--pitch);">Raporty</h4>
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
      <h4 style="margin-top:0;color:var(--pitch);">Radar profilu</h4>
      ${radarEntries.length ? radarSvg(radarEntries) + `<div style="text-align:center;margin-top:8px;">${legend}</div>` : '<div class="empty">Zaznaczeni zawodnicy nie mają jeszcze ocen — dodaj obserwacje.</div>'}
    </div>
    <div class="card">
      <h4 style="margin-top:0;color:var(--pitch);">Porównanie opisowe</h4>
      ${compareDescriptive(entries)}
    </div>
  </div>
  ${compareSeasonStats(entries)}
  ${compareReports(entries)}
  <div class="card" style="overflow:auto;">
    <h4 style="margin-top:0;color:var(--pitch);">Dane liczbowe (radar)</h4>
    ${compareTable(entries) || '<div class="empty">Brak ocen z obserwacji — radar pojawi się, gdy będą.</div>'}
  </div>` : '<div class="card"><div class="empty">Wybierz zawodników powyżej, aby zobaczyć porównanie.</div></div>'}`;
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
  {id:"contacts", label:"Kontakty"},
  {id:"settings", label:"Ustawienia"},
];
const SAVE_FN_BY_KEY = {
  'scouting:players': ()=>savePlayers(), 'scouting:clubs': ()=>saveClubs(), 'scouting:observations': ()=>saveObservations(),
  'scouting:reports': ()=>saveReports(), 'scouting:talents': ()=>saveTalents(), 'scouting:contacts': ()=>saveContacts(),
  'scouting:settings': ()=>saveSettings(), 'scouting:position_map_assignments': ()=>savePositionMapAssignments(),
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
  const nav = document.getElementById('nav');
  nav.innerHTML = NAV_ITEMS.map(it => `
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
  else if(currentView==="contacts") main.innerHTML = viewContacts();
  else if(currentView==="settings") main.innerHTML = viewSettings();
  else if(currentView==="compare") main.innerHTML = viewCompare();
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
function navSignature(){
  return JSON.stringify({v:currentView, p:viewingPlayerId, c:viewingClubId, ct:clubBrowse.top, cg:clubBrowse.group, cmp:compareIds});
}
function syncHistory(){
  const sig = navSignature();
  if(sig === lastNavSig) return;      // ten sam widok (np. render po zapisie danych) — nie dubluj wpisu
  lastNavSig = sig;
  if(restoringFromHistory) return;    // przywracanie z historii nie tworzy nowego wpisu
  const state = {currentView, viewingPlayerId, viewingClubId, clubBrowseTop:clubBrowse.top, clubBrowseGroup:clubBrowse.group, compareIds:[...compareIds]};
  if(!historyInited){ history.replaceState(state, ''); historyInited = true; }
  else history.pushState(state, '');
}
window.addEventListener('popstate', (e)=>{
  const s = e.state;
  restoringFromHistory = true;
  currentView = (s && s.currentView) || 'dashboard';
  viewingPlayerId = (s && s.viewingPlayerId) || null;
  viewingClubId = (s && s.viewingClubId) || null;
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
      <text x="${s.center.x}" y="${s.center.y}" text-anchor="middle" font-size="10" font-weight="800" fill="#F6F3EA" style="pointer-events:none;paint-order:stroke;stroke:#0B1F19;stroke-width:3px;">${s.count}</text>
    </g>`).join('');
  return `<svg viewBox="0 -4 612 592" class="poland-map" style="width:100%;height:auto;max-width:440px;display:block;margin:0 auto;">
    <defs>
      <filter id="mapShadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#08130F" flood-opacity="0.55"/>
      </filter>
      <linearGradient id="voivGloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
        <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.02"/>
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
    {label:'Obserwacje', value:totalObs, color:'#C69B3C'},
    {label:'W obserwacji', value:inObservation, color:'#6E9C7C'},
    {label:'Do transferu', value:forTransfer, color:'#B6503F'}
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
    <h4 style="margin-top:0;color:var(--pitch);">📍 Dystans obserwacji 2026</h4>
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
      <button class="link-btn" data-action="remove-sponsor" data-idx="${i}" title="Usuń" style="position:absolute;top:-7px;right:-7px;background:var(--clay-dark);color:#fff;border-radius:50%;width:15px;height:15px;font-size:9px;line-height:1;padding:0;">✕</button>
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
              <div style="font-weight:700;color:var(--pitch);font-size:14px;">${esc(c.name)}</div>
              <div style="font-size:11.5px;color:var(--ink-soft);">${esc((c.region||'').replace(' ZPN',''))} &middot; <strong>${n}</strong> ${plZaw(n)}</div>
            </div>
          </div>`;
        }).join('');
        groupClubsRow = `<div style="margin-top:14px;">
          <div class="note" style="margin-bottom:8px;">${esc(dashboardGroupSelected)} — ${clubs.length} ${clubs.length===1?'klub':'klubów'} w bazie</div>
          ${clubs.length ? `<div class="club-crest-grid">${cards}</div>` : `<div class="empty">Brak klubów tej grupy w bazie.</div>`}
        </div>`;
      }
      clubsRow = `<div style="margin-top:16px;border-top:1px solid #E3DECE;padding-top:14px;">
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
            <div style="font-weight:700;color:var(--pitch);font-size:14px;">${esc(c.name)}</div>
            <div style="font-size:11.5px;color:var(--ink-soft);">${esc((c.region||'').replace(' ZPN',''))} &middot; <strong>${n}</strong> ${plZaw(n)}</div>
          </div>
        </div>`;
      }).join('');
      clubsRow = `<div style="margin-top:16px;border-top:1px solid #E3DECE;padding-top:14px;">
        <div class="note" style="margin-bottom:8px;">${esc(dashboardLeagueSelected)} — ${clubs.length} ${clubs.length===1?'klub':'klubów'} w bazie</div>
        ${clubs.length ? `<div class="club-crest-grid">${cards}</div>` : `<div class="empty">Brak klubów tego poziomu w bazie — dodaj je w zakładce Kluby.</div>`}
      </div>`;
    }
  }

  return `<div class="card">
    <h4 style="margin-top:0;color:var(--pitch);">Szybki dostęp wg lig</h4>
    <p class="note" style="margin-top:-4px;margin-bottom:10px;">Kliknij logo ligi, aby zobaczyć jej kluby — kliknij herb klubu, aby przejść do zawodników.</p>
    <div class="league-logos-row">${logos}</div>
    ${clubsRow}
  </div>`;
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
      <h4 style="margin-top:0;color:var(--pitch);">Mapa Województw</h4>
      ${polandVoivodeshipMap()}
      <p class="note" style="text-align:center;margin-top:6px;">Liczba klubów w bazie wg województwa</p>
    </div>
    <div class="card">
      <h4 style="margin-top:0;color:var(--pitch);">Szybkie akcje</h4>
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
      <h4 style="margin-top:0;color:var(--pitch);">Statystyki obserwacji</h4>
      ${observationsDonut()}
    </div>
    ${bydgoszczDistanceWidget()}
  </div>
  <div style="margin-top:18px;">
    ${leagueQuickAccessPanel()}
  </div>
  <div style="margin-top:18px;">
    <div class="card">
      <h4 style="margin-top:0;color:var(--pitch);">Ostatnie obserwacje</h4>
      ${recent.length? recent.map(o=>{
        const pl = DB.players.find(p=>p.id===o.playerId);
        const avg = RATING_KEYS.reduce((a,k)=>a+(Number(o.ratings[k])||0),0)/RATING_KEYS.length;
        return `<div class="obs-item">
          <strong>${pl? esc(pl.firstName+" "+pl.lastName):"(usunięty zawodnik)"}</strong> — <span class="avg-chip">${fmt1(avg)}</span>
          <div class="meta">${esc(o.date)} &middot; ${esc(o.match)} &middot; scout: ${esc(o.scout)}</div>
        </div>`;
      }).join('') : `<div class="empty">Brak obserwacji — dodaj pierwszą w zakładce „Plan Obserwacji”.</div>`}
    </div>
  </div>
  <div style="margin-top:18px;">
    ${sponsorsPanel()}
  </div>`;
}

// ---------- PLAYERS ----------
let playerFilters = {region:"",league:"",status:"",position:"",search:"",birthYear:""};
function viewPlayers(){
  if(viewingPlayerId) return viewPlayerDetail(viewingPlayerId);

  let list = DB.players.slice();
  if(viewingRocznikGroup){
    const year = viewingRocznikGroup.match(/\d{4}/)[0];
    list = list.filter(p => p.birthYear === year);
  }
  if(playerFilters.region) list = list.filter(p=>clubRegion(p.clubId)===playerFilters.region);
  if(playerFilters.league) list = list.filter(p=>clubLeague(p.clubId)===playerFilters.league);
  if(playerFilters.status) list = list.filter(p=>p.status===playerFilters.status);
  if(playerFilters.position) list = list.filter(p=>p.position===playerFilters.position);
  if(playerFilters.birthYear) list = list.filter(p=>String(p.birthYear||'')===String(playerFilters.birthYear));
  if(playerFilters.search){
    const q = playerFilters.search.toLowerCase();
    list = list.filter(p=> (p.firstName+" "+p.lastName).toLowerCase().includes(q));
  }
  // Lista wg alfabetu (nazwisko, potem imię) — nie wg klubu/kolejności importu.
  list.sort((a,b)=> (a.lastName||a.firstName||'').localeCompare(b.lastName||b.firstName||'','pl') || (a.firstName||'').localeCompare(b.firstName||'','pl'));

  const rows = list.map((p, idx)=>{
    const a = playerAvg(p.id);
    const cls = STATUS_CLASS[p.status]||"new";
    // Cały wiersz otwiera profil — tabela jest szeroka i przy węższym ekranie kolumna z przyciskami
    // („Zobacz", „✕") bywa poza kadrem, więc samo kliknięcie w nazwisko musi wystarczyć.
    return `<tr class="player-row" data-action="row-open-player" data-id="${p.id}" style="cursor:pointer;" title="Kliknij, aby otworzyć profil">
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
      <td style="text-align:right;">${p.matches!=null?p.matches:'—'}</td>
      <td style="text-align:right;">${p.minutes!=null?p.minutes:'—'}</td>
      <td style="text-align:right;">${p.goals!=null?p.goals:'—'}</td>
      <td style="text-align:right;">${a? a.count : 0}</td>
      <td style="white-space:nowrap;">
        <button class="link-btn" data-action="add-to-monitoring" data-id="${p.id}" title="${p.monitored?'W Monitoringu — kliknij, aby usunąć':'Dodaj do Monitoringu'}" style="color:${p.monitored?'#3E7D4C':'var(--gold-dark)'};">${p.monitored?'✓ Monitoring':'+ Monitoring'}</button>
        <button class="link-btn" data-action="delete-player" data-id="${p.id}" title="Usuń zawodnika" style="margin-left:8px;color:var(--clay-dark);">Usuń</button>
      </td>
    </tr>`;
  }).join('');

  return `
  <h2 class="view-title">${viewingRocznikGroup ? esc(viewingRocznikGroup) : 'Zawodnicy'}</h2>
  <p class="view-sub">${viewingRocznikGroup ? 'Zawodnicy z tego rocznika.' : 'Kartoteka wszystkich obserwowanych zawodników.'}</p>
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
      <input id="f-birthyear" type="text" inputmode="numeric" maxlength="4" placeholder="Rocznik np. 2005" value="${esc(playerFilters.birthYear)}" style="max-width:140px;">
      <input id="f-search" placeholder="Szukaj po nazwisku..." value="${esc(playerFilters.search)}">
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="gold" data-action="add-player">+ Nowy zawodnik</button>
      ${viewingRocznikGroup ? `<button class="gold" data-action="rocznik-excel-import">📋 Wgraj z Excela</button>` : ''}
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
      <thead><tr><th style="width:24px;"><input type="checkbox" class="header-checkbox"></th><th style="width:34px;text-align:right;" title="Liczba porządkowa">Lp.</th><th>Zawodnik</th><th>Rocznik</th><th>Pozycja</th><th>Klub / region / liga</th><th>Status</th><th style="text-align:right;" title="Rozegrane mecze w sezonie">Mecze</th><th style="text-align:right;" title="Rozegrane minuty w sezonie">Minuty</th><th style="text-align:right;" title="Gole w sezonie">Gole</th><th style="text-align:right;" title="Liczba obserwacji">Obs.</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="12"><div class="empty">Brak zawodników spełniających filtry.</div></td></tr>`}</tbody>
    </table>
  </div>`;
}

function viewPlayerDetail(id){
  const p = DB.players.find(x=>x.id===id);
  if(!p){ viewingPlayerId=null; return viewPlayers(); }
  const a = playerAvg(id);
  const obs = playerObs(id).slice().reverse();
  const radarChartHtml = (a && a.avgs) ? radarChart(a.avgs) : `<p class="note">Brak ocen — średnia i profil pojawią się po wypełnieniu raportu w zakładce „Raporty".</p>`;

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
      <h4 style="margin-top:0;color:var(--pitch);">Profil ocen ${a && a.overall!=null? '&middot; średnia '+fmt1(a.overall)+' <span class="note" style="font-weight:400;">(z '+a.reportCount+' rap.)</span>' : ''}</h4>
      ${a && a.avgs? `<div class="gauge-row" style="margin-bottom:14px;">
        ${RATING_KEYS.map(k=>gaugeRing(a.avgs[k], 64, RATING_LABELS[k])).join('')}
      </div>` : ''}
      <div class="radar-wrap">${radarChartHtml}</div>
    </div>
    <div class="card">
      <h4 style="margin-top:0;color:var(--pitch);">Informacje</h4>
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
        <tr><td style="color:var(--ink-soft);">Menedżer / agent</td><td>${p.hasAgent? agencyDisplayHtml(p) : "Nie"}</td></tr>
        <tr><td style="color:var(--ink-soft);">Kontrakt</td><td>${p.hasContract? `<span class="agent-yes">Tak</span>${p.contractUntil?` — do <strong>${esc(p.contractUntil)}</strong>`:''}` : '<span class="agent-no">Nie</span>'}</td></tr>
      </table>
      ${p.notes? `<p style="margin-top:10px;font-size:13px;">${esc(p.notes)}</p>`:''}
    </div>
  </div>
  <div class="card">
    <div class="toolbar" style="margin-bottom:8px;">
      <h4 style="margin:0;color:var(--pitch);">Załączniki</h4>
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
      <h4 style="margin:0;color:var(--pitch);">Raport zawodnika</h4>
      <button class="secondary" data-action="print-player" data-id="${p.id}">⭳ Pobierz raport PDF</button>
    </div>
    <p class="note" style="margin-top:8px;margin-bottom:0;">Generuje i pobiera gotowy plik PDF — chwilę to potrwa, w zależności od urządzenia.</p>
  </div>
  <div class="card">
    <h4 style="margin-top:0;color:var(--pitch);">Historia obserwacji (${obs.length})</h4>
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
    <h4 style="margin-top:0;color:var(--pitch);">⚡ Szybkie statystyki sezonu</h4>
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
    <h4 style="margin-top:0;color:var(--pitch);">Profil ocen — radar</h4>
    ${(()=>{ const a = playerAvg(p.id); return (a && a.avgs) ? radarSvg([{label:p.lastName, avgs:a.avgs, count:a.count}]) + `<p class="note" style="text-align:center;margin-top:6px;">Radar z historycznych ocen obserwacji (skala 1–10)${a.overall!=null?` &middot; śr. ocena z raportów: ${fmt1(a.overall)}`:''}</p>` : '<div class="empty">Brak ocen — średnia pojawi się po wypełnieniu raportu w zakładce „Raporty".</div>'; })()}
  </div>
  <div class="card">
    <h4 style="margin-top:0;color:var(--pitch);">Raporty taktyczne (${playerReports(p.id).length})</h4>
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
      <h4 style="margin:0;color:var(--pitch);">Historia transferowa</h4>
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
    <h4 style="margin-top:0;color:var(--pitch);">Opis Końcowy</h4>
    <textarea id="opis-koncowy" rows="5" placeholder="Wpisz opis końcowy zawodnika...">${esc(p.opisKoncowy||'')}</textarea>
    <button class="gold" data-action="save-opis" data-id="${p.id}" style="margin-top:8px;">Zapisz opis</button>
  </div>`;
}

function gaugeColor(value){
  if(value>=8) return '#3E7D4C'; // score-high (zielony)
  if(value>=5) return '#C69B3C'; // score-mid (złoty)
  return '#B6503F'; // score-low (czerwony)
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
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E7E2D3" stroke-width="6"/>
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
    return `<polygon points="${pts}" fill="none" stroke="#D9D3C0" stroke-width="1"/>`;
  }).join('');
  let axes = RATING_KEYS.map((k,i)=>{
    const [x,y] = pt(i,10);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#D9D3C0" stroke-width="1"/>`;
  }).join('');
  let dataPts = RATING_KEYS.map((k,i)=>pt(i,avgs[k]).join(",")).join(" ");
  let labels = RATING_KEYS.map((k,i)=>{
    const ang = -Math.PI/2 + i*(2*Math.PI/n);
    const lx = cx+(r+26)*Math.cos(ang), ly = cy+(r+26)*Math.sin(ang);
    return `<text x="${lx}" y="${ly}" font-size="10.5" fill="#5B6560" text-anchor="middle" font-family="Inter,sans-serif">${RATING_LABELS[k]}</text>`;
  }).join('');
  return `<svg width="${size+60}" height="${size+20}" viewBox="0 0 ${size+60} ${size+20}">
    <g transform="translate(30,0)">
    ${grid}${axes}
    <polygon points="${dataPts}" fill="#C69B3C" fill-opacity="0.35" stroke="#8C6C21" stroke-width="2"/>
    ${labels}
    </g>
  </svg>`;
}

// ---------- CLUBS ----------
function pill(label, active, action, dataAttrs){
  const attrs = Object.entries(dataAttrs||{}).map(([k,v])=>`data-${k}="${esc(v)}"`).join(' ');
  return `<button class="secondary" data-action="${action}" ${attrs} style="border-radius:20px;padding:6px 14px;font-size:12.5px;${active?'background:var(--pitch);color:var(--chalk);border-color:var(--pitch);':''}">${esc(label)}</button>`;
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
  return `<span style="width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;background:#16302A;color:#C69B3C;border-radius:9px;font-weight:800;font-size:${Math.round(size*0.34)}px;">${esc(initials)}</span>`;
}
function viewClubs(){
  if(viewingClubId) return viewClubDetail(viewingClubId);

  let list = DB.clubs.slice();
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
      <button class="secondary" data-action="import-squad-stats" data-id="${c.id}" title="Wklej tabelę statystyk całej drużyny — minuty, mecze, gole, kartki">⏱ Statystyki drużyny</button>
      <button class="secondary" data-action="edit-club" data-id="${c.id}">Edytuj klub</button>
      <button class="danger" data-action="delete-club" data-id="${c.id}">Usuń</button>
    </div>
  </div>
  <div class="card">
    <h4 style="margin-top:0;color:var(--pitch);">Pełny oficjalny skład</h4>
    <p class="note" style="margin-bottom:10px;">Nie pobieramy automatycznie składów z zewnętrznych serwisów — poniżej znajdziesz bezpośrednie linki do sprawdzenia pełnej, aktualnej listy zawodników na sezon ${esc(c.season||'bieżący')}.</p>
    <div style="display:flex;gap:18px;flex-wrap:wrap;">
      ${c.profileLnp? `<a class="ext-link" href="${esc(c.profileLnp)}" target="_blank" rel="noopener">90minut.pl / Łączy Nas Piłka &rarr;</a>` : `<span class="note">Brak linku do 90minut.pl — dodaj w edycji klubu</span>`}
      ${c.profileTm? `<a class="ext-link" href="${esc(c.profileTm)}" target="_blank" rel="noopener">Transfermarkt &rarr;</a>` : `<span class="note">Brak linku do Transfermarkt — dodaj w edycji klubu</span>`}
    </div>
  </div>
  <div class="card">
    <div class="toolbar" style="margin-bottom:8px;">
      <h4 style="margin:0;color:var(--pitch);">Zawodnicy scoutowani w tym klubie (${squad.length})</h4>
      <div style="display:flex;gap:8px;align-items:center;">
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
  { id:'live',   label:'Live',   color:'#3E7D4C' },
  { id:'online', label:'Online', color:'#2F6FA8' },
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
// Zapamiętanie adresu po zapisaniu planu. Gospodarza bierzemy z pola "Mecz" (część przed myślnikiem).
async function rememberStadiumAddress(matchText, address){
  const adres = String(address||'').trim();
  if(!adres) return;
  const gospodarz = String(matchText||'').split(/\s+-\s+/)[0];
  const id = clubIdByName(gospodarz);
  if(!id) return;
  if(!DB.settings.stadiumAddresses) DB.settings.stadiumAddresses = {};
  if(DB.settings.stadiumAddresses[id] === adres) return;   // bez zmian — nie zapisujemy
  DB.settings.stadiumAddresses[id] = adres;
  await saveSettings();
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
      <h4 style="margin-top:0;color:var(--pitch);">${editing? 'Edytuj plan' : 'Nowy plan'}</h4>
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
              ? `background:${t.color};border-color:${t.color};color:#fff;`
              : `background:#fff;border-color:#D9D3C4;color:var(--ink-soft);`;
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
      <h4 style="margin-top:0;color:var(--pitch);">Kalendarz</h4>
      ${obsCalendarHtml()}
    </div>
  </div>

  <h3 style="margin-top:24px;color:var(--pitch);font-family:'Barlow Condensed',sans-serif;">Zaplanowane i obserwowane w ${monthNamePl(obsCalendarDate.getMonth())} ${obsCalendarDate.getFullYear()}</h3>
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
        <strong>${i+1}. ${pl?esc(pl.firstName+' '+pl.lastName):'—'}</strong>
        <span style="display:flex;align-items:center;gap:8px;">
          <span class="obs-type-tag" style="background:${obsTypeMeta(obsTypeOf(o)).color};">${esc(obsTypeMeta(obsTypeOf(o)).label)}</span>
          <span class="meta">${esc(o.date)}${o.matchTime?' &middot; '+esc(o.matchTime):''}</span>
          <button class="link-btn" data-action="edit-obs" data-id="${o.id}" style="font-size:11px;">✎ Edytuj</button>
          <button class="link-btn" data-action="delete-obs" data-id="${o.id}" style="font-size:11px;color:var(--clay-dark);">Usuń</button>
        </span>
      </div>
      <div class="meta">${esc(o.match||'brak danych meczu')}${o.location?' &middot; 📍 '+esc(o.location):''} &middot; scout: ${esc(o.scout)}</div>
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
  <div style="margin-top:12px;border-top:1px solid #E3DECE;padding-top:10px;">
    <strong style="font-size:13px;color:var(--pitch);">${esc(obsCalendarSelectedDay)}</strong>
    ${selectedObs.length ? selectedObs.map(o=>{
      const pl = DB.players.find(p=>p.id===o.playerId);
      return `<div class="obs-item" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span><strong>${pl?esc(pl.firstName+' '+pl.lastName):'—'}</strong> — ${esc(o.match||'brak danych meczu')} <span class="meta">(${esc(o.scout)})</span></span>
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
  await saveObservations();
  // Adres obiektu zapamiętujemy przy klubie-gospodarzu — przy następnym meczu tej drużyny
  // podstawi się sam, bez ponownego wpisywania.
  await rememberStadiumAddress(obs.match, obs.location);
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

const REPORT_PHASES = [
  {key:'fazaAtaku', label:'Faza ataku'},
  {key:'fazaPrzejsciaAtakObrona', label:'Faza przejścia z ataku do obrony'},
  {key:'fazaObrony', label:'Faza obrony'},
  {key:'fazaPrzejsciaObronaAtak', label:'Faza przejścia z obrony do ataku'},
];
const REPORT_SET_PIECES = [
  {key:'rzutRoznyObrona', label:'Rzut rożny — obrona'},
  {key:'rzutRoznyAtak', label:'Rzut rożny — atak'},
  {key:'rzutWolnyAtak', label:'Rzut wolny — atak'},
  {key:'rzutWolnyObrona', label:'Rzut wolny — obrona'},
];

// Młodzieżowiec — rocznik 2006 i młodszy, we wszystkich ligach. Odznaka w stylu "3D" (gradient +
// warstwowy cień), spójna z kafelkami lig na dashboardzie, a nie zwykła płaska plakietka.
function isYouthPlayer(p){
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
  const colorMap = {'WYSOKA':'#3E7D4C', 'ŚREDNIA':'#3E6FA8', 'NISKA':'#B6503F'};
  const color = colorMap[value] || '#8A857A';
  return `<span class="badge" style="background:${color};color:#fff;font-weight:700;">${esc(value)}</span>`;
}
function perspektywaBadgeReport(value){
  if(!value) return '';
  const colorMap = {'WYSOKA':'#3E7D4C', 'ŚREDNIA':'#3E6FA8', 'NISKA':'#B6503F'};
  const color = colorMap[value] || '#8A857A';
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
    const name = pl ? (esc(pl.lastName)+' '+esc(pl.firstName)) : '<span style="color:var(--clay-dark);">(zawodnik usunięty)</span>';
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

    <div style="border-top:1px solid #E3DECE;margin:14px 0;padding-top:10px;">
      <label class="field" style="display:block;margin-bottom:8px;">Perspektywa</label>
      <div class="perspektywa-picker" id="rep-perspektywa-picker" data-value="${esc(reportPerspektywaValue)}">
        <button type="button" class="persp-btn persp-wysoka ${reportPerspektywaValue==='WYSOKA'?'active':''}" data-value="WYSOKA">WYSOKA</button>
        <button type="button" class="persp-btn persp-srednia ${reportPerspektywaValue==='ŚREDNIA'?'active':''}" data-value="ŚREDNIA">ŚREDNIA</button>
        <button type="button" class="persp-btn persp-niska ${reportPerspektywaValue==='NISKA'?'active':''}" data-value="NISKA">NISKA</button>
      </div>
    </div>

    <div style="border-top:1px solid #E3DECE;margin:14px 0;padding-top:10px;">
      <label class="field" style="display:block;margin-bottom:8px;">Fazy gry (skala 1-6)</label>
      ${REPORT_PHASES.map(f=>{ const v = editing && editing.phases && editing.phases[f.key]!=null ? editing.phases[f.key] : 3; return `
        <div class="slider-row">
          <span class="lbl">${esc(f.label)}</span>
          ${ratingPointsHtml('rep-'+f.key, v)}
        </div>`; }).join('')}
    </div>

    <div style="border-top:1px solid #E3DECE;margin:14px 0;padding-top:10px;">
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

    <div class="field-wrap" style="border-top:1px solid #E3DECE;margin:14px 0 0;padding-top:10px;">
      <label class="field">Opis raportu</label>
      <textarea id="rep-description" rows="3" placeholder="Ogólne wrażenie, kontekst obserwacji...">${editing? esc(editing.description||'') : ''}</textarea>
    </div>

    <div style="border-top:1px solid #E3DECE;margin:14px 0;padding-top:10px;">
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
    ['Klub', 'Email', 'Imię', 'Nazwisko', 'Telefon', 'Notatka'],
    ['Przykładowy Klub FC', 'kontakt@przykladowyklub.pl', '', '', '', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:24},{wch:28},{wch:14},{wch:16},{wch:16},{wch:30}];
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

  let headerRowIdx = -1, colClub = -1, colEmail = -1, colFirst = -1, colLast = -1, colPhone = -1, colNote = -1;
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
      dateAdded: nowDate
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

  if(!validRows.length) throw new Error('Nie znaleziono żadnego wiersza z imieniem lub nazwiskiem.');
  return {
    talents: validRows.map(r => ({
      id: uid('T'), firstName: r.firstName, lastName: r.lastName, birthYear: r.birthYear, club: r.club,
      confidence: 'import', sourceImage: '', dateAdded: nowDate
    })),
    skippedCount
  };
}

// Wklejenie tekstu (np. skopiowana tabela z Transfermarkt/Wikipedii/arkusza) zamiast pliku Excel —
// ten sam format co szablon (Imię, Nazwisko, Rocznik, Klub), rozdzielony tabulatorem, przecinkiem,
// średnikiem albo dwiema+ spacjami. Jeśli pierwsza linia wygląda jak nagłówek — używamy jej do
// dopasowania kolumn; jeśli nie, zakładamy stałą kolejność Imię/Nazwisko/Rocznik/Klub.
function splitTalentLine(line){
  if(line.includes('\t')) return line.split('\t');
  if(line.includes(';')) return line.split(';');
  if(line.includes(',')) return line.split(',');
  return line.split(/\s{2,}/);
}
function parseTalentPastedText(text){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length) throw new Error('Wklej przynajmniej jedną linię z danymi.');
  const norm = (s)=> String(s||'').toLowerCase().replace(/[ąćęłńóśźż]/g, c=>({ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z'}[c])).replace(/[^a-z0-9]/g,'');
  const HEADER_WORDS = ['imie','nazwisko','rocznik','klub','firstname','lastname','birthyear','club','rokurodzenia'];
  const firstCells = splitTalentLine(lines[0]).map(c=>c.trim());
  const looksLikeHeader = firstCells.some(c => HEADER_WORDS.includes(norm(c)));
  let rows;
  if(looksLikeHeader){
    rows = lines.slice(1).map(line=>{
      const cells = splitTalentLine(line);
      const obj = {};
      firstCells.forEach((h,i)=> obj[h] = cells[i]!=null ? cells[i].trim() : '');
      return obj;
    });
  } else {
    rows = lines.map(line=>{
      const cells = splitTalentLine(line).map(c=>c.trim());
      return {'Imię': cells[0]||'', 'Nazwisko': cells[1]||'', 'Rocznik': cells[2]||'', 'Klub': cells[3]||''};
    });
  }
  return parseTalentRowsObject(rows);
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
  const rows = DB.talents.slice().sort((a,b)=>(b.dateAdded||'').localeCompare(a.dateAdded||''));
  const rowsHtml = rows.length ? rows.map(t=>`
    <div class="talent-row">
      <span class="talent-row-name">${esc(t.firstName)} ${esc(t.lastName)}</span>
      <span class="talent-row-actions">
        <button class="link-btn" data-action="talent-promote" data-id="${t.id}" style="color:var(--gold-dark);">pełny profil / dodaj do bazy</button>
        <button class="link-btn talent-remove-btn" data-id="${t.id}" style="color:var(--clay-dark);">usuń</button>
      </span>
      <span class="talent-row-meta">${t.birthYear?('rocznik '+esc(t.birthYear)+' &middot; '):''}${esc(t.club||'klub nieznany')}</span>
    </div>`).join('') : '<div class="empty">Brak jeszcze dodanych talentów — użyj importu lub formularza poniżej.</div>';

  return `
  <h2 class="view-title">Talent</h2>
  <p class="view-sub">Lista młodych zawodników do szybkiego dodania — zaimportuj z arkusza, wpisz ręcznie, a potem kliknij "pełny profil", żeby uzupełnić wszystkie dane i dodać do głównej bazy.</p>

  <div class="talent-layout">
    <div>
      <h3 style="margin-top:0;color:var(--pitch);font-family:'Barlow Condensed',sans-serif;">Wklej tekst</h3>
      <div class="card">
        <p class="note" style="margin-top:-4px;">Skopiuj tabelę zawodników (np. z Transfermarkt/Wikipedii/arkusza) i wklej poniżej — jedna osoba na linię, kolumny <strong>Imię, Nazwisko, Rocznik, Klub</strong> rozdzielone tabulatorem, przecinkiem albo dwiema spacjami. Nagłówek opcjonalny.</p>
        <div class="field-wrap">
          <textarea id="talent-paste-text" rows="6" placeholder="np.&#10;Kacper	Kowalkowski	2007	Zawisza Bydgoszcz&#10;Jan	Nowak	2008	Lech Poznań">${esc(talentPasteText)}</textarea>
        </div>
        <div class="modal-actions" style="justify-content:flex-start;margin-bottom:0;">
          <button class="secondary" data-action="talent-paste-parse">Rozpoznaj zawodników</button>
        </div>
        ${talentPasteParsed ? `
          <div style="border-top:1px solid #E3DECE;margin-top:14px;padding-top:10px;max-height:260px;overflow:auto;">
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

      <h3 style="margin-top:20px;color:var(--pitch);font-family:'Barlow Condensed',sans-serif;">Dodaj ręcznie</h3>
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
      <div class="card talent-list">${rowsHtml}</div>
    </aside>
  </div>`;
}

let contactSearchQuery = '';

async function updateContactField(id, field, value){
  const c = DB.contacts.find(x=>x.id===id);
  if(!c) return;
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
      (c.email||'').toLowerCase().includes(q)
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
  <p class="view-sub">Baza kontaktów — zaimportuj z arkusza (klub + email), a resztę uzupełnij ręcznie bezpośrednio na liście.</p>

  <div class="card" style="max-width:640px;">
    <h4 style="margin-top:0;color:var(--pitch);">Import z Excela / CSV</h4>
    <p class="note" style="margin-top:-4px;">Oczekiwane kolumny: <strong>Klub, Email</strong> (dodatkowo rozpoznawane: Imię, Nazwisko, Telefon, Notatka — jeśli są w arkuszu).</p>
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
      <thead><tr><th>#</th><th>Klub</th><th>Email</th><th>Imię</th><th>Nazwisko</th><th>Telefon</th><th>Notatka</th><th></th></tr></thead>
      <tbody>${list.length ? list.map((c,i)=>contactRow(c,i+1)).join('') : `<tr><td colspan="8"><div class="empty">${contactSearchQuery? 'Brak kontaktów pasujących do wyszukiwania.' : 'Brak kontaktów — zaimportuj arkusz powyżej.'}</div></td></tr>`}</tbody>
    </table>
  </div>`;
}

function downloadContactsExcel(){
  if(!XLSX) throw new Error('Biblioteka do arkuszy nie jest dostępna.');
  const rows = [['Klub','Email','Imię','Nazwisko','Telefon','Notatka']];
  DB.contacts.slice().sort((a,b)=>(a.club||'').localeCompare(b.club||'')).forEach(c=>{
    rows.push([c.club||'', c.email||'', c.firstName||'', c.lastName||'', c.phone||'', c.note||'']);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:24},{wch:26},{wch:14},{wch:16},{wch:16},{wch:30}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kontakty');
  XLSX.writeFile(wb, 'kontakty_sbs.xlsx');
}

function downloadContactsPdf(){
  const sorted = DB.contacts.slice().sort((a,b)=>(a.club||'').localeCompare(b.club||''));
  const rowsHtml = sorted.map((c,i)=>`<tr>
    <td>${i+1}</td><td>${esc(c.club||'—')}</td><td>${esc(c.email||'—')}</td>
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
  <table><thead><tr><th>#</th><th>Klub</th><th>Email</th><th>Imię</th><th>Nazwisko</th><th>Telefon</th><th>Notatka</th></tr></thead>
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
  const statusRank = {'Do transferu':0, 'Na Testy':1};
  const candidates = DB.players
    // System gry: gdy wybrano konkretny, pokazuj zawodników z tym systemem ORAZ tych bez wpisanego systemu
    // (są kandydatami do każdego układu) — inaczej zawodnik "Do transferu" bez systemu nie trafiał na mapę.
    .filter(p => clubLeague(p.clubId)===league && p.position===posDef.posName && (!formation || !p.formation || p.formation===formation)
      && (p.status==='Do transferu' || p.status==='Na Testy'))
    .map(p => ({p, a: playerAvg(p.id)}))
    // NIE wymagamy obserwacji — zawodnik z samą decyzją statusu (z raportu) też trafia na mapę.
    .sort((a,b) => {
      const s = statusRank[a.p.status] - statusRank[b.p.status];   // Do transferu przed Na Testy
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
function viewRankingNumbersMode(){
  // Zbierz WSZYSTKIE automatyczne uzupełnienia w jednym przebiegu i zapisz JEDEN raz — wywoływanie zapisu
  // osobno dla każdej z 11 pozycji powodowało równoczesne zapisy do tego samego klucza i błędy magazynu.
  let anyChanged = false;
  let anyRealCandidatesFound = false;
  POSITION_NUMBERS.forEach(posDef=>{
    const key = positionMapKey(rankingLeague, rankingFormationFilter, posDef.number);
    const auto = buildAutoPositionCandidates(rankingLeague, rankingFormationFilter, posDef.number);
    if(positionMapAssignments[key] === undefined){
      positionMapAssignments[key] = auto;
      anyChanged = true;
    } else {
      // Dołącz automatycznie zawodników ze statusem (Do transferu/Testy), których jeszcze nie ma na tej
      // pozycji — "Do transferu" na początek (priorytet), "Na Testy" na koniec. Cap 6 na pozycję.
      const cur = positionMapAssignments[key];
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
  ${!anyRealCandidatesFound? ' Mapa jest pusta, bo żaden zawodnik tej ligi nie ma jeszcze wpisanej obserwacji (oceny) — dodaj obserwacje w zakładce "Nowa obserwacja" albo przypisz kogoś ręcznie.' : ''}</p>`;
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

  let strengths = [], weaknesses = [];
  if(a && a.avgs){
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
  const tone = {go:'#3E7D4C', test:'#C69B3C', watch:'#8C6C21', no:'#B6503F', hold:'#5B6560'}[an.recoTone];
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
    ${(an.a && an.a.avgs) ? radarSvg([{label:p.lastName, avgs:an.a.avgs, count:an.a.count}]) : '<div class="empty">Brak ocen liczbowych — wypełnij raport, aby analiza była pełna.</div>'}
    <div class="grid grid-2" style="margin-top:12px;">
      <div><label class="field">Mocne strony</label>${an.strengths.length? `<ul style="margin:4px 0;padding-left:18px;">${an.strengths.map(s=>`<li>${esc(RATING_LABELS[s.k]||s.k)} (${fmt1(s.v)})</li>`).join('')}</ul>` : '<div class="note">Brak danych</div>'}</div>
      <div><label class="field">Do poprawy</label>${an.weaknesses.length? `<ul style="margin:4px 0;padding-left:18px;">${an.weaknesses.map(s=>`<li>${esc(RATING_LABELS[s.k]||s.k)} (${fmt1(s.v)})</li>`).join('')}</ul>` : '<div class="note">Brak danych</div>'}</div>
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
    return rank[a.priority]-rank[b.priority];
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
      <td>${p.hasAgent? `<span class="agent-yes">Tak</span>` : `<span class="agent-no">Nie</span>`}</td>
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
      <div class="field-wrap"><label class="field">Liga / poziom (aktualna)</label><select id="cm-league">${DB.settings.leagues.map(x=>`<option ${c&&c.league===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
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
      <div class="field-wrap"><label class="field">Link — tabela / skład (90minut.pl, ŁNP)</label><input id="cm-lnp" value="${c?esc(c.profileLnp||''):''}" placeholder="https://www.90minut.pl/... lub laczynaspilka.pl"></div>
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
        '90minut nie publikuje minut ani asyst — te pola pozostają bez zmian.');
      render();
    }catch(e){
      alert('Nie udało się pobrać statystyk: ' + (e.message||e));
    }finally{
      b.disabled = false; b.textContent = orig;
    }
  });
  main.querySelectorAll('[data-action="open-match-schedule"]').forEach(b=>b.onclick=()=>openMatchScheduleModal());
  // Wybór rodzaju obserwacji — bez przerysowania całego widoku, żeby nie gubić wpisanych już pól.
  // Zmiana rodzaju obserwacji przechodzi przez stan modułu i przerysowanie — dzięki temu wybór
  // przeżywa każde odświeżenie formularza, także to wywołane przez inne akcje na widoku.
  document.querySelectorAll('[data-action="pick-obs-type"]').forEach(b=>b.onclick=()=>{
    const editing = editingObsId ? DB.observations.find(o=>o.id===editingObsId) : null;
    if(editing) editing.obsType = b.dataset.type; else newObsType = b.dataset.type;
    render();
  });
  main.querySelectorAll('[data-action="view-player"]').forEach(b=>b.onclick=()=>{viewingPlayerId=b.dataset.id; currentView='players'; render();});
  // Kliknięcie w wiersz listy zawodników otwiera profil, ale nie może przechwytywać kliknięć
  // w zaznaczanie do usuwania ani w przyciski akcji z ostatniej kolumny.
  main.querySelectorAll('[data-action="row-open-player"]').forEach(row=>row.addEventListener('click', (e)=>{
    if((e.target as HTMLElement).closest('button, input, a, label')) return;
    viewingPlayerId = (row as HTMLElement).dataset.id; currentView='players'; render();
  }));
  // Przycisk "Monitoring" w liście zawodników — od razu dodaje/usuwa zawodnika z zakładki Monitoring.
  main.querySelectorAll('[data-action="monitoring-plan-obs"]').forEach(b=>b.onclick=()=>{
    obsPreselectPlayerId = b.dataset.id;
    currentView = 'newobs'; viewingPlayerId = null;
    render();
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
  main.querySelectorAll('[data-action="back-players"]').forEach(b=>b.onclick=()=>{viewingPlayerId=null; render();});
  main.querySelectorAll('[data-action="back-rocznik"]').forEach(b=>b.onclick=()=>{viewingRocznikGroup=null; currentView='clubs'; render();});
  main.querySelectorAll('[data-action="delete-rocznik"]').forEach(b=>b.onclick=async()=>{
    const year = b.dataset.year;
    if(confirm(`Usunąć wszystkich zawodników z rocznika ${year}? To działanie nie może być cofnięte.`)){
      const toDelete = DB.players.filter(p=>p.birthYear===year);
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

  // Zaznaczanie i usuwanie zawodników wprost ze składu klubu — pojedynczo lub całością.
  const squadChecks = document.querySelectorAll('.squad-player-check');
  const squadDelBtn = document.getElementById('squad-delete-btn');
  const squadAll = document.getElementById('squad-select-all');
  const odswiezPrzycisk = ()=>{
    if(!squadDelBtn) return;
    const n = Array.from(squadChecks).filter(c=>c.checked).length;
    squadDelBtn.style.display = n ? 'inline-block' : 'none';
    squadDelBtn.textContent = `🗑️ Usuń zaznaczonych (${n})`;
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
  main.querySelectorAll('[data-action="league-stats"]').forEach(b=>b.onclick=()=>openLeagueStatsModal(b.dataset.league));
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
      DB.contacts.push(...result.contacts);
      await saveContacts();
      render();
      if(result.skippedCount > 0){
        alert('Zaimportowano ' + result.contacts.length + ' kontaktów. Pominięto ' + result.skippedCount + ' wiersz(y), które wyglądały na notatkę/legendę.');
      }
    }catch(e){
      console.error(e);
      if(status){ status.textContent = 'Błąd importu: ' + (e.message||e); status.style.color='var(--clay-dark)'; }
    }
  };
  main.querySelectorAll('[data-action="add-club"]').forEach(b=>b.onclick=()=>openClubModal(null));
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
  main.querySelectorAll('[data-action="back-clubs"]').forEach(b=>b.onclick=()=>{
    viewingClubId = null; render();
  });
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
  function setupAddressAutocomplete(inputEl, boxEl, sourceValues){
    if(!inputEl || !boxEl) return;
    const values = [...new Set(sourceValues.filter(Boolean))];
    const render = ()=>{
      const q = inputEl.value.trim().toLowerCase();
      const matches = q ? values.filter(v=>v.toLowerCase().includes(q) && v.toLowerCase()!==q) : values;
      if(!matches.length){ boxEl.innerHTML=''; boxEl.style.display='none'; return; }
      boxEl.innerHTML = matches.slice(0,8).map(v=>`<div class="addr-suggestion-item">${esc(v)}</div>`).join('');
      boxEl.style.display = 'block';
      boxEl.querySelectorAll('.addr-suggestion-item').forEach(item=>{
        item.onmousedown = (e)=>{ e.preventDefault(); inputEl.value = item.textContent; boxEl.style.display='none'; inputEl.dispatchEvent(new Event('blur')); };
      });
    };
    inputEl.addEventListener('input', render);
    inputEl.addEventListener('focus', render);
    inputEl.addEventListener('blur', ()=>setTimeout(()=>{ boxEl.style.display='none'; }, 200));
  }
  setupAddressAutocomplete(obsStart, main.querySelector('#obs-start-suggestions'),
    DB.observations.map(o=>o.startLocation).concat(DB.settings.startLocation||[]));
  setupAddressAutocomplete(obsLoc, main.querySelector('#obs-location-suggestions'),
    DB.observations.map(o=>o.location));
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
    const norm = s => (s||'').toString().toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
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
      const trafienia = gracze.filter(pasuje)
        .sort((a,b)=> ranga(a) - ranga(b))     // sort stabilny — w obrębie rangi zostaje alfabet
        .slice(0,60);
      list.innerHTML = trafienia.length ? trafienia.map(p=>{
        const rocznik = p.birthYear ? p.birthYear : '—';
        return `<div class="club-combo-item" data-id="${esc(p.id)}">
          <strong>${esc(p.lastName||'')} ${esc(p.firstName||'')}</strong>
          <span class="club-combo-reg">${esc(clubName(p.clubId))} · ${esc(rocznik)}</span>
        </div>`;
      }).join('') : '<div class="club-combo-empty">Brak zawodnika pasującego do frazy.</div>';
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
  main.querySelectorAll('[data-action="compare-back"]').forEach(b=>b.onclick=()=>{ currentView='players'; viewingPlayerId=null; render(); });
  [0,1,2].forEach(i=>{ const sel=main.querySelector('#compare-sel-'+i); if(sel) sel.onchange=()=>{ compareIds[i]=sel.value; render(); }; });

  // Wgrywanie wielu logotypów naraz — dopasowanie plików do klubów po nazwie.
  const multiLogo = main.querySelector('#multi-logo-input');
  if(multiLogo){
    multiLogo.onchange = async ()=>{
      const files = Array.from(multiLogo.files||[]);
      if(!files.length) return;
      const normName = s => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');
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
  const fq = document.getElementById('f-search'); if(fq) fq.oninput=()=>{playerFilters.search=fq.value; render();};

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
              <a href="${a.dataUrl}" download="${esc(a.name)}" style="font-weight:700;color:var(--pitch);text-decoration:none;">📄 ${esc(a.name)}</a>
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
      <div style="border-top:1px solid #E3DECE;margin:14px 0;padding-top:10px;">
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
// Punkt wejścia używany przez importer: najpierw próbuje formatu blokowego (prawdziwe kopiowanie z
// Transfermarkt), a jeśli nic nie wykryje, spada do prostszego trybu "jedna linia = jeden zawodnik".
function parseSquadText(rawText){
  return parseSquadBlocks(rawText) || rawText.split('\n').map(parseSquadLine).filter(Boolean);
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
      raw: [firstName, lastName, yearRaw].filter(Boolean).join(' ')
    };
  }).filter(Boolean);
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
  // Zrzut ekranu tylko jako WIZUALNY podgląd do porównania obok wklejonego tekstu — nie jest
  // analizowany automatycznie (brak OCR/AI w aplikacji), dane zawsze biorą się z wklejonego tekstu.
  let referenceImage = null;

  function closeAndRefresh(){ overlay.remove(); render(); }

  function draw(){
    overlay.innerHTML = `
    <div class="modal" style="max-width:680px;">
      <h3>Import składu — ${esc(club.name)}</h3>
      <p class="note" style="margin-top:-4px;">Otwórz skład klubu na Transfermarkt/90minut/ŁNP we własnej przeglądarce, zaznacz i skopiuj widoczną tabelę, wklej poniżej (jeden zawodnik na linię). Nie pobieramy niczego automatycznie — to Ty decydujesz, co wkleić.</p>
      <div class="grid grid-2" style="align-items:start;">
        <div class="field-wrap">
          <textarea id="squad-import-text" rows="8" placeholder="np.&#10;1 Rafał Grocholski Bramkarz 9 gru 2004 (21) Polska -&#10;3 Jonatan Straus Środkowy obrońca 30 cze 1994 (32) Polska -">${esc(pastedText)}</textarea>
        </div>
        <div class="field-wrap">
          <label class="field">Podgląd zrzutu ekranu (opcjonalnie, do porównania — nie jest odczytywany automatycznie)</label>
          ${referenceImage ? `
            <div style="position:relative;">
              <img src="${referenceImage}" style="max-width:100%;max-height:260px;object-fit:contain;border:1px solid #E3DECE;border-radius:6px;display:block;">
              <button class="secondary" data-action="squad-image-remove" style="position:absolute;top:6px;right:6px;padding:2px 8px;">✕</button>
            </div>
          ` : `
            <label for="squad-import-image" style="display:flex;align-items:center;justify-content:center;height:120px;border:1px dashed #C9C2AE;border-radius:6px;cursor:pointer;color:var(--ink-soft);font-size:13px;text-align:center;padding:8px;">📋 Wklej (Ctrl+V) lub kliknij, aby wgrać zrzut</label>
            <input type="file" id="squad-import-image" accept="image/*" style="display:none;">
          `}
        </div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start;margin-bottom:10px;">
        <button class="secondary" data-action="squad-parse">Rozpoznaj zawodników</button>
      </div>
      <div class="field-wrap" style="border-top:1px dashed #D9D3C4;padding-top:10px;margin-bottom:14px;">
        <label class="field">…albo wgraj plik Excel / CSV (np. lista rocznika do rozgrywek juniorskich) — kolumny: <strong>Imię, Nazwisko</strong> (albo „Zawodnik"), opcjonalnie Rocznik, Pozycja, Narodowość</label>
        <input type="file" id="squad-import-file" accept=".xlsx,.xls,.csv">
      </div>
      ${parsed.length ? `
        <div style="border-top:1px solid #E3DECE;padding-top:10px;margin-bottom:12px;max-height:280px;overflow:auto;">
          <p class="note" style="margin-top:0;">Rozpoznano <strong>${parsed.filter(p=>p.ok).length}</strong> z ${parsed.length} linii. Odznacz, czego nie chcesz importować.</p>
          <table><tbody>
            ${parsed.map((p,i)=> p.ok ? `
              <tr>
                <td style="width:24px;"><input type="checkbox" class="squad-row-check" data-idx="${i}" checked></td>
                <td><strong>${esc(p.lastName)}</strong> ${esc(p.firstName)}</td>
                <td>${esc(p.position||'—')}</td>
                <td>${esc(p.birthYear||'—')}${isYouthPlayer(p)?youthBadge():''}</td>
                <td>${p.nationality? nationalityFlag(p.nationality)+' '+esc(p.nationality) : '—'}</td>
              </tr>` : `
              <tr style="color:var(--clay-dark);">
                <td></td>
                <td colspan="4" style="font-size:12px;">Nie rozpoznano: „${esc(p.raw)}”</td>
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
      parsed = parseSquadText(text);
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
      let added = 0, skipped = 0, bezRocznika = 0, zWieku = 0;
      toAdd.forEach(p=>{
        const exists = DB.players.some(pl=>pl.firstName===p.firstName && pl.lastName===p.lastName && pl.clubId===club.id);
        if(exists){ skipped++; return; }
        if(!p.birthYear) bezRocznika++;
        else if(p.birthYearFromAge) zWieku++;
        DB.players.push({
          id: uid('Z'), firstName: p.firstName, lastName: p.lastName,
          birthDate: '', birthYear: p.birthYear || '', nationality: p.nationality || '',
          position: p.position || '', foot: '', height: null,   // brak pozycji w źródle = puste (uzupełnisz później), nie "Bramkarz"
          // Bez statusu przy imporcie — status "Do Obserwacji" pojawia się dopiero, gdy dla
          // zawodnika faktycznie zaplanujemy obserwację (patrz saveNewObservation()).
          status: '', clubId: club.id, scout: currentScout || '',
          videoLink: '', lnpLink: '', tmLink: '', hasAgent: false, agencyName: '',
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
            (skipped ? ` Pominięto ${skipped} (już byli w bazie w tym klubie).` : '') +
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
    return futureMatches().filter(m=> m.date <= endStr);
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
      const known = new Set(DB.matches.map(x=>`${x.date}|${x.homeTeam}|${x.awayTeam}`));
      for(const s of settled){
        if(s.error) continue;
        for(const m of s.data.matches){
          seen++;
          const key = `${m.date}|${m.homeTeam}|${m.awayTeam}`;
          if(known.has(key)) continue;
          known.add(key);
          DB.matches.push({id: uid('M'), league: s.league, competition: s.data.league,
            date: m.date, time: m.time, homeTeam: m.homeTeam, awayTeam: m.awayTeam,
            round: m.round, dateApprox: !!m.dateApprox, stadium: ''});
          added++;
        }
      }
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
        (added < seen ? ` Resztę już miałeś w bazie.` : '');
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
      return `<div style="margin:6px 0 2px;font-weight:800;color:var(--pitch);font-size:13px;">Kolejka ${m.round}</div>`;
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

            return roundHeader(m) + `<div class="match-row" data-match-id="${m.id}" style="border:1px solid #E3DECE;border-radius:8px;padding:12px;cursor:pointer;transition:all 0.2s;background:${selectedMatch===m.id?'#FBF6E9':'#fff'};" onmouseover="this.style.background='#FBF6E9'" onmouseout="this.style.background='${selectedMatch===m.id?'#FBF6E9':'#fff'}'">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-weight:600;color:var(--pitch);">${esc(m.homeTeam||'—')} — ${esc(m.awayTeam||'—')}</div>
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
        return `<div class="player-option" data-player-id="${p.id}" style="padding:8px 12px;border:1px solid #E3DECE;border-radius:6px;margin-bottom:6px;cursor:pointer;background:#fff;" onmouseover="this.style.background='#FBF6E9'" onmouseout="this.style.background='#fff'">
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
      <div style="background:#FBF6E9;padding:12px;border-radius:8px;margin-bottom:16px;">
        <div style="font-weight:600;color:var(--pitch);">${esc(m.homeTeam||'—')} — ${esc(m.awayTeam||'—')}</div>
        <div class="meta">${esc(m.date)}${m.time?' • '+esc(m.time):''}${m.stadium?' • 📍 '+esc(m.stadium):''}</div>
      </div>

      <div style="margin-bottom:16px;">
        <h4 style="color:var(--pitch);margin-bottom:8px;">🏠 ${esc(m.homeTeam||'Gospodarz')}</h4>
        ${renderPlayerList(homePlayers, m.homeTeam)}
      </div>

      <div style="margin-bottom:16px;">
        <h4 style="color:var(--pitch);margin-bottom:8px;">✈️ ${esc(m.awayTeam||'Gość')}</h4>
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

    <div style="border-top:1px dashed #D9D3C4;padding-top:12px;margin-bottom:14px;">
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
};
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

  // Liczby liczymy dopiero PO ostatnim słowie w linii — inaczej wiek i narodowość
  // ("25 Finlandia 2 1 - 24'") wchodziłyby do statystyk i wiek lądował w meczach.
  const statsFromLine = (line)=>{
    if(!/['’]/.test(line)) return null;                    // bez minut to nie jest wiersz statystyk
    let tail = line;
    const words = [...line.matchAll(WORDS)];
    if(words.length){
      const last = words[words.length-1];
      tail = line.slice(last.index + last[0].length);
    }
    const minM = tail.match(/(\d[\d.]*)\s*['’]/);
    if(!minM) return null;
    const minutes = parseInt(minM[1].replace(/\./g,''), 10);
    if(isNaN(minutes)) return null;
    // Liczby przed minutami, w kolejności z Transfermarktu: mecze, bramki, asysty.
    const before = tail.slice(0, minM.index);
    const nums = (before.match(/\d[\d.]*/g)||[]).map(n=>parseInt(n.replace(/\./g,''),10)).filter(n=>!isNaN(n));
    const stats = { minutes };
    if(nums.length >= 1) stats.matches = nums[0];
    if(nums.length >= 2) stats.goals = nums[1];
    if(nums.length >= 3) stats.assists = nums[2];
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
const TM_BOOKMARKLET = `javascript:(function(){try{
var u=location.href;
if(/\\/verein\\/\\d+/.test(u)&&!/\\/leistungsdaten\\//.test(u)){
location.href=u.replace(/\\/(startseite|kader|spielplan|leistungsdaten)\\/verein\\//,'/leistungsdaten/verein/').replace(/\\/verein\\//,'/leistungsdaten/verein/').replace(/\\/leistungsdaten\\/leistungsdaten\\//,'/leistungsdaten/');
return;}
if(!/\\/leistungsdaten\\//.test(u)){alert('SBS: to nie jest strona klubu na Transfermarkcie.\\n\\nOtworz klub, a potem kliknij te zakladke ponownie.');return;}
var best=null,n=0;var ts=document.querySelectorAll('table');
for(var i=0;i<ts.length;i++){var r=ts[i].rows.length;if(r>n){n=r;best=ts[i];}}
var t=(best&&n>4)?best.innerText:document.body.innerText;
if(!/\\d\\s*['’]/.test(t)){alert('SBS: na tej stronie nie ma minut.\\n\\nUpewnij sie, ze u gory wybrales sezon i rozgrywki (np. \\u201eLacznie 26/27\\u201d).');return;}
navigator.clipboard.writeText(t).then(function(){
var d=document.createElement('div');d.textContent='SBS: skopiowano '+(best&&n>4?n+' wierszy tabeli':'tekst strony')+' — wklej w systemie';
d.style.cssText='position:fixed;top:16px;right:16px;z-index:999999;background:#16302A;color:#C69B3C;padding:12px 18px;border-radius:8px;font:600 14px sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3)';
document.body.appendChild(d);setTimeout(function(){d.remove()},2600);
}).catch(function(e){alert('Nie udało się skopiować: '+e.message)})}catch(e){alert('Błąd: '+e.message)}})();`;

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
        <a href="${esc(TM_BOOKMARKLET)}" onclick="return false;" style="display:inline-block;margin:8px 0;padding:8px 16px;background:#C69B3C;color:#16302A;border-radius:6px;font-weight:800;text-decoration:none;cursor:grab;">⏱ Kopiuj do SBS</a>
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

function openLeagueStatsModal(league){
  const clubs = DB.clubs.filter(c=> c.league === league || topLevelOf(c.league) === league);
  const clubIds = new Set(clubs.map(c=>c.id));
  const pool = DB.players.filter(p=> clubIds.has(p.clubId));

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const close = ()=>{ overlay.remove(); render(); };
  let parsed = null;

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

    <div style="max-height:150px;overflow:auto;border:1px solid #E3DECE;border-radius:8px;padding:8px;margin-bottom:12px;">
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
    if(!parsed){
      const text = (overlay.querySelector('#league-stats-paste') as HTMLTextAreaElement).value.trim();
      if(!text){ alert('Wklej najpierw tabele statystyk.'); return; }
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
          <div style="font-weight:700;color:var(--pitch);font-size:12.5px;margin-top:6px;">${esc(cn)} <span style="font-weight:400;color:var(--ink-soft);">(${byClub[cn].length})</span></div>
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
    <div style="border:1px solid #E3DECE;border-radius:8px;padding:10px;margin-bottom:10px;background:#FBF9F3;">
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
    <p class="note" style="font-size:11px;color:var(--ink-soft);">Dlaczego ręcznie: 90minut nie publikuje minut,
    a Transfermarkt rysuje tę tabelę JavaScriptem — w kodzie strony jej nie ma, więc serwer nie ma czego pobrać.</p>
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
    const input = overlay.querySelector('#stats-link');
    const status = overlay.querySelector('#link-status');
    const raw = (input.value||'').trim();
    if(!raw){ alert('Wklej najpierw link do profilu zawodnika.'); return; }

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
        <span style="color:var(--ink-soft);">90minut nie publikuje minut, asyst ani kartek — te uzupełnij w kroku 2.</span>`;
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

      <div style="border:1px solid #E3DECE;border-radius:8px;padding:12px;margin-bottom:16px;background:#FBF9F3;">
        <label class="field" style="display:block;margin-bottom:6px;">1. Wklej link do profilu zawodnika</label>
        <div style="display:flex;gap:8px;">
          <input id="stats-link" placeholder="https://www.90minut.pl/kariera.php?id=..." value="${esc(p.lnpLink||p.tmLink||'')}" style="flex:1;font-size:12px;">
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
          <label class="field">Wgraj plik Excel / CSV</label>
          <input type="file" id="rocznik-file" accept=".xlsx,.xls,.csv">
        </div>
        <div class="modal-actions">
          <button class="gold" data-action="rocznik-import-go">Importuj z pliku</button>
          <button class="secondary" data-action="close-modal">Anuluj</button>
        </div>
      ` : `
        <p class="note" style="margin-top:0;">Zaznacz w Excelu tabelę <strong>razem z wierszem nagłówków</strong>
        (Nazwisko, Imię, Aktualny klub…), skopiuj <strong>Ctrl+C</strong> i wklej poniżej.
        Rozpoznaję te same kolumny co przy wgrywaniu pliku — to droga awaryjna, gdy plik się nie wczytuje.</p>
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
          const existing = DB.players.find(pl=> pl.birthYear===year && nkey(pl.firstName,pl.lastName)===nkey(p.firstName,p.lastName));
          if(existing){
            let touched = false;
            if(!existing.clubId && clubId){ existing.clubId = clubId; touched = true; }
            if(!existing.position && p.position){ existing.position = p.position; touched = true; }
            if(!existing.status && p.status){ existing.status = p.status; touched = true; }
            if(existing.powolania==null && p.powolania!=null){ existing.powolania = p.powolania; touched = true; }
            if(!existing.notes && p.info){ existing.notes = p.info; touched = true; }
            if(touched) updated++;
            return;
          }
          DB.players.push({
            id: uid('Z'), firstName: p.firstName, lastName: p.lastName,
            birthDate: '', birthYear: p.birthYear || year, nationality: p.nationality || '',
            position: p.position || '', foot: '', height: null,
            status: p.status || '', clubId, scout: currentScout || '',
            powolania: p.powolania ?? null,
            videoLink: '', lnpLink: '', tmLink: '', hasAgent: false, agencyName: '',
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
          if(p.birthYear && p.birthYear !== year){
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
          const existing = DB.players.find(pl=> pl.birthYear===rocznikZawodnika && nkey(pl.firstName,pl.lastName)===nkey(p.firstName,p.lastName));
          if(existing){
            let touched = false;
            if(!existing.clubId && clubId){ existing.clubId = clubId; touched = true; }
            if(!existing.position && p.position){ existing.position = p.position; touched = true; }
            if(!existing.status && p.status){ existing.status = p.status; touched = true; }
            if(existing.powolania==null && p.powolania!=null){ existing.powolania = p.powolania; touched = true; }
            if(!existing.notes && p.info){ existing.notes = p.info; touched = true; }
            if(touched) updated++;
            return;
          }
          DB.players.push({
            id: uid('Z'), firstName: p.firstName, lastName: p.lastName,
            birthDate: '', birthYear: rocznikZawodnika, nationality: p.nationality || '',
            position: p.position || '', foot: '', height: null,
            status: p.status || '', clubId, scout: currentScout || '',
            powolania: p.powolania ?? null,
            videoLink: '', lnpLink: '', tmLink: '', hasAgent: false, agencyName: '',
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
          alert(`Rocznik ${year} — dodano nowych: ${added}` +
            (updated ? `\nUzupełniono istniejących: ${updated}` : '') +
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
// Historia transferowa — wpisy dodawane ręcznie przez scouta (klub, okres, typ, kwota), na wzór układu
// kariery znanego z Transfermarkt/90minut. To dane faktograficzne wpisywane przez użytkownika, nie import.
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
          <div class="obs-item"${editIdx===i?' style="background:#FBF6E9;border-radius:8px;"':''}>
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
      <div style="border-top:1px solid #E3DECE;margin-bottom:14px;padding-top:12px;${editing?'background:#FBF6E9;border-radius:8px;padding:12px;':''}">
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
      p.transferHistory.splice(idx, 1);
      if(editIdx===idx) editIdx = null; else if(editIdx!=null && editIdx>idx) editIdx--;
      await savePlayers();
      draw();
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
      const ok = await savePlayers();
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
                <a href="${a.dataUrl}" download="${esc(a.name)}" style="font-weight:700;color:var(--pitch);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📎 ${esc(a.name)}</a>
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
      searchInput.oninput = ()=> draw(searchInput.value);
    }
    overlay.querySelectorAll('.picker-result').forEach(row=>row.onclick = async ()=>{
      const ids = currentIds();
      if(ids.length >= 6 || ids.includes(row.dataset.playerId)) return;
      positionMapAssignments[key] = [...ids, row.dataset.playerId];
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
    @page { margin: 16mm 14mm; }
    *{box-sizing:border-box;}
    body{font-family:Arial,Helvetica,sans-serif;color:#1B2420;background:#fff;margin:0;padding:0 14mm;font-size:13px;line-height:1.5;}
    .report-header{display:flex;align-items:center;gap:18px;padding-bottom:16px;border-bottom:4px solid #C69B3C;margin-bottom:0;}
    .report-header img{width:52px;height:52px;border-radius:12px;flex-shrink:0;}
    .brand-block{flex:1;}
    .brand-name{font-family:Arial,'Arial Narrow',sans-serif;font-weight:700;font-size:22px;color:#16302A;letter-spacing:.02em;margin:0;}
    .brand-sub{font-size:11px;color:#8A857A;text-transform:uppercase;letter-spacing:.06em;margin:3px 0 0;}
    .brand-signature{font-size:11px;color:#3C4640;margin:4px 0 0;font-weight:600;}
    .report-date{font-size:11px;color:#8A857A;text-align:right;white-space:nowrap;}
    .title-bar{display:flex;align-items:center;gap:14px;padding:18px 20px;background:#16302A;margin:16px -14mm 0;}
    .pos-badge-lg{width:44px;height:44px;border-radius:50%;background:#C69B3C;color:#16302A;display:flex;align-items:center;justify-content:center;
      font-family:Arial,'Arial Narrow',sans-serif;font-weight:700;font-size:20px;flex-shrink:0;border:3px solid #F6F3EA;}
    .title-text h1{font-family:Arial,'Arial Narrow',sans-serif;font-weight:700;font-size:24px;color:#F6F3EA;margin:0;}
    .title-text p{font-size:12px;color:#C6D9CE;margin:3px 0 0;text-transform:uppercase;letter-spacing:.03em;}
    .player-meta{display:flex;flex-wrap:wrap;padding:14px 0;background:#F6F3EA;margin:0 -14mm;padding-left:14mm;padding-right:14mm;border-bottom:1px solid #E7E2D3;}
    .meta-item{flex:1;min-width:110px;padding:4px 14px;border-left:1px solid #E7E2D3;}
    .meta-item:first-child{border-left:none;padding-left:0;}
    .meta-item .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#8A857A;font-weight:600;}
    .meta-item .val{font-size:13px;color:#1B2420;font-weight:700;margin-top:2px;}
    .section{padding:18px 0;}
    .section-title{font-family:Arial,'Arial Narrow',sans-serif;font-weight:700;font-size:14px;color:#16302A;text-transform:uppercase;
      letter-spacing:.04em;border-left:4px solid #C69B3C;padding-left:10px;margin:0 0 12px;}
    .attr-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
    .attr-card{background:#F6F3EA;border-radius:8px;padding:10px 6px;text-align:center;border:1px solid #E7E2D3;}
    .attr-card .score{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      font-family:Arial,'Arial Narrow',sans-serif;font-weight:700;font-size:15px;margin:0 auto 6px;color:#fff;}
    .score-high{background:#3E7D4C;} .score-mid{background:#C69B3C;} .score-low{background:#B6503F;}
    .attr-card .lbl{font-size:9.5px;color:#5B6560;text-transform:uppercase;letter-spacing:.02em;font-weight:600;}
    .attr5-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
    .attr5-col{display:flex;flex-direction:column;}
    .attr5-head{background:#16302A;color:#F6F3EA;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.02em;
      padding:7px 6px;border-radius:6px 6px 0 0;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px;}
    .attr5-score{background:#C69B3C;color:#16302A;border-radius:10px;padding:1px 9px;font-size:13px;font-weight:700;}
    .attr5-body{background:#F6F3EA;border:1px solid #E7E2D3;border-top:none;border-radius:0 0 6px 6px;
      padding:8px 8px;font-size:10.5px;color:#3C4640;line-height:1.4;flex:1;min-height:46px;}
    .attr5-empty{color:#B0AB9E;}
    .metric-section-label{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#8A857A;font-weight:600;margin:10px 0 5px;}
    .attr5-grid.metric4{grid-template-columns:repeat(4,1fr);}
    .metric-num-body{background:#F6F3EA;border:1px solid #E7E2D3;border-top:none;border-radius:0 0 6px 6px;
      padding:9px 8px;text-align:center;font-size:22px;font-weight:800;color:#16302A;line-height:1;
      flex:1;display:flex;align-items:center;justify-content:center;min-height:30px;}
    .gauge-wrap{display:flex;flex-direction:column;align-items:center;gap:5px;}
    .gauge-ring{position:relative;}
    .gauge-ring svg{display:block;}
    .gauge-value{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
      font-family:Arial,'Arial Narrow',sans-serif;font-weight:700;font-size:15px;color:#16302A;}
    .gauge-label{font-size:9.5px;color:#5B6560;text-transform:uppercase;letter-spacing:.02em;font-weight:600;text-align:center;}
    .gauge-desc{font-size:10.5px;color:#3C4640;text-align:center;margin-top:6px;line-height:1.35;}
    .persp-badge-report{display:inline-block;padding:5px 14px;border-radius:6px;font-family:Arial,'Arial Narrow',sans-serif;
      font-weight:700;font-size:13px;color:#fff;letter-spacing:.03em;}
    .overall-strip{display:flex;align-items:center;gap:12px;background:#16302A;border-radius:8px;padding:12px 16px;margin-bottom:14px;}
    .overall-strip .big-num{font-family:Arial,'Arial Narrow',sans-serif;font-weight:700;font-size:28px;color:#C69B3C;line-height:1;}
    .overall-strip .txt{color:#F6F3EA;font-size:12px;line-height:1.4;}
    .overall-strip .txt strong{display:block;font-size:13px;margin-bottom:1px;}
    .notes-box{background:#F6F3EA;border-left:4px solid #C69B3C;border-radius:0 6px 6px 0;padding:12px 14px;font-size:12.5px;color:#3C4640;}
    .obs-table{width:100%;border-collapse:collapse;}
    .obs-table th{background:#16302A;color:#F6F3EA;font-size:10px;text-transform:uppercase;letter-spacing:.03em;padding:7px 10px;text-align:left;}
    .obs-table td{padding:7px 10px;border-bottom:1px solid #E7E2D3;font-size:11.5px;}
    .obs-table tr:nth-child(even) td{background:#FAF8F2;}
    .recommend-box{background:#DEEBDF;border-radius:8px;padding:12px 14px;}
    .recommend-box .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#3E7D4C;font-weight:700;margin-bottom:5px;}
    .recommend-box .val{font-size:13px;color:#1B2420;font-weight:700;}
    .agent-box{background:#F4E3C4;border-radius:8px;padding:12px 14px;margin-top:12px;}
    .agent-box .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#8C6C21;font-weight:700;margin-bottom:5px;}
    .agent-box .val{font-size:12.5px;color:#1B2420;font-weight:600;}
    .report-footer{text-align:center;padding:14px 0 0;font-size:10px;color:#B0AB9E;border-top:1px solid #E7E2D3;margin-top:18px;}
    .empty-note{font-size:12px;color:#8A857A;font-style:italic;}
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
    <div class="meta-item"><div class="lbl">Kartki żółte / czerwone</div><div class="val"><span style="color:#B8860B;">▮</span> ${p.yellowCards!=null?p.yellowCards:"—"} / <span style="color:#B6503F;">▮</span> ${p.redCards!=null?p.redCards:"—"}</div></div>
  </div>

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

  <div class="section" style="padding-top:0;">
    <div class="recommend-box">
      <div class="lbl">Rekomendacja</div>
      <div class="val">${esc(lastObs && lastObs.recommendation ? lastObs.recommendation : 'Brak rekomendacji')}</div>
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
    const canvas = await html2canvas(targetEl, {scale:2, useCORS:true, backgroundColor:'#ffffff', windowWidth:794});
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();
    const imgWidthMm = pageWidthMm;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

    let heightLeftMm = imgHeightMm;
    let positionMm = 0;
    pdf.addImage(imgData, 'JPEG', 0, positionMm, imgWidthMm, imgHeightMm);
    heightLeftMm -= pageHeightMm;
    while(heightLeftMm > 0){
      positionMm = heightLeftMm - imgHeightMm;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, positionMm, imgWidthMm, imgHeightMm);
      heightLeftMm -= pageHeightMm;
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
    const norm = s => (s||'').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
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
    const customFields = {};
    ov.querySelectorAll('.pm-custom').forEach(inp=>{ customFields[inp.dataset.field] = inp.value.trim(); });
    const data = {
      firstName: first, lastName: last,
      birthDate, birthYear: birthDate? new Date(birthDate).getFullYear() : '',
      position: document.getElementById('pm-position').value,
      foot: document.getElementById('pm-foot').value,
      height: Number(document.getElementById('pm-height').value)||null,
      nationality: document.getElementById('pm-nationality').value.trim(),
      status: document.getElementById('pm-status').value,
      clubId: document.getElementById('pm-club').value,
      scout: document.getElementById('pm-scout').value.trim(),
      videoLink: document.getElementById('pm-video').value.trim(),
      lnpLink: document.getElementById('pm-lnp').value.trim(),
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
      profileLnp: document.getElementById('cm-lnp').value.trim(),
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
  const pole = (id, typ, etykieta, autofokus)=>`
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
      <p class="note" style="margin-top:14px;border-top:1px solid #E3DECE;padding-top:12px;font-size:11.5px;">
        Nie masz konta? Dostęp nadaje administrator systemu — napisz na
        <strong>system@scoutbasesystem.com</strong>, podając imię, nazwisko i klub.
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
    if(r.ok){ host.remove(); document.querySelector('.app').style.display=''; loadAll(); return; }
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
      host.remove(); document.querySelector('.app').style.display=''; loadAll(); return;
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

async function startApp(){
  // Wejście z linku resetującego: Supabase tworzy tymczasową sesję, więc zanim wpuścimy do
  // aplikacji, prosimy o ustawienie nowego hasła.
  if(isPasswordRecoveryLink()){
    loginTryb='nowe-haslo';
    renderLoginScreen();
    return;
  }
  const user = await currentUser();
  if(!user){ renderLoginScreen(); return; }
  loadAll();
}

startApp();
