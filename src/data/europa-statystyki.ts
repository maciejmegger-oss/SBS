// STATYSTYKI I LIGI ZAWODNIKÓW Z EUROPY — z Transfermarktu (strony „statystyki drużynowe" klubów), sezon 2026/27, stan na 13.10.2026.
//
// Dla zawodników z kadr U-19/U-18/U-17 (europa-mlodziez.ts): liga, w której gra ich klub, oraz liczby z bieżącego
// sezonu — występy, gole, asysty, minuty. Klucz to numer zawodnika na Transfermarkcie (ten sam, co w jego linku).
// Gdy klub to drużyna młodzieżowa bez własnej ligi na Transfermarkcie, liga jest pusta. Minuty 0 znaczą „bez występów
// w tym sezonie" LUB „serwis nie ma dla tej drużyny statystyk" — przy akademiach to częstsze.
//
// Linia: id TM|liga|szczebel (1 = najwyższa, 9 = nieustalony, 0 = brak ligi)|występy|gole|asysty|minuty
// NIE POPRAWIAJ RĘCZNIE — po nowym pobraniu plik powstaje od nowa.

const SUROWE = `
1236102|Ettan Södra|9|0|0|0|0
1172427||0|0|0|0|0
1446713||0|0|0|0|0
1172425||0|0|0|0|0
1517960|Allsvenskan|1|0|0|0|0
1372491||0|0|0|0|0
1336074|Allsvenskan|1|1|0|0|90
1268844||0|0|0|0|0
1372492|U19 Boys League|9|3|0|0|180
1236103|Allsvenskan|1|1|0|0|45
1590127||0|0|0|0|0
1457761|Allsvenskan|1|1|0|0|90
1172430|Superettan|2|1|0|0|70
1342148|Allsvenskan|1|3|0|0|88
1184990|Allsvenskan|1|1|0|0|60
1556628||0|0|0|0|0
1184986|Bundesliga|1|3|0|0|34
1172441|Ligue 1|1|0|0|0|0
1291830|Allsvenskan|1|1|0|0|62
1184983|Ettan Norra|9|0|0|0|0
1187586||0|0|0|0|0
1172433||0|0|0|0|0
1325003||0|0|0|0|0
1376815||0|0|0|0|0
1606854||0|0|0|0|0
1606855||0|0|0|0|0
1376830|Superettan|2|1|0|0|90
1259940|U19 DFB-Nachwuchsliga - Vorrunde Gruppe I|9|7|0|0|270
1376829|U19 DFB-Nachwuchsliga - Vorrunde Gruppe C|9|8|1|0|474
1516489||0|0|0|0|0
1376820||0|0|0|0|0
1376833||0|0|0|0|0
1452370|Superettan|2|1|0|0|120
1416965||0|0|0|0|0
1271029|Allsvenskan|1|1|2|1|88
1376819|Allsvenskan|1|4|0|0|283
1376828||0|0|0|0|0
1516487||0|0|0|0|0
1492188||0|0|0|0|0
1419606|Superettan|2|1|1|0|45
1445469|Allsvenskan|1|1|0|0|73
1375664|U19 Boys League|9|5|2|0|0
1369213|U19 Boys League|9|7|1|0|380
1376835|U19 Boys League|9|6|2|0|231
1372785|U19 Boys League|9|5|0|0|424
1461549||0|0|0|0|0
1532136||0|0|0|0|0
1449264||0|0|0|0|0
1532138||0|0|0|0|0
1585195||0|0|0|0|0
1605766||0|0|0|0|0
1425395||0|0|0|0|0
1530160||0|0|0|0|0
1605768||0|0|0|0|0
1449261||0|0|0|0|0
1478523|Campionato nazionale Under 17 - B|5|4|2|1|273
1532141||0|0|0|0|0
1605769||0|0|0|0|0
1449280|Allsvenskan|1|0|0|0|0
1378926|Ettan Södra|9|0|0|0|0
1449279||0|0|0|0|0
1407851|Allsvenskan|1|1|1|0|0
1449278|Primavera 1|1|0|0|0|0
1461579||0|0|0|0|0
1478524||0|0|0|0|0
1585197||0|0|0|0|0
1605767||0|0|0|0|0
1187583|Ykkösliiga|2|0|0|0|0
1268838|Veikkausliiga|1|0|0|0|0
1139731|Veikkausliiga|1|5|0|0|370
1250149|Ykkösliiga|2|0|0|0|0
1375015|Ykkösliiga|2|0|0|0|0
1377987|Ykkönen|9|0|0|0|0
1159611|Ykkösliiga|2|0|0|0|0
1268839|Ykkösliiga|2|0|0|0|0
1230469|Kakkonen - Lohko B|9|0|0|0|0
1139748||0|1|0|0|90
1139747|Veikkausliiga|1|1|0|0|32
1139745|Ykkösliiga|2|0|0|0|0
1139732|Veikkausliiga|1|0|0|0|0
1397936|Veikkausliiga|1|0|0|0|0
1139752|Ykkösliiga|2|0|0|0|0
1137847|U19 Boys League|9|5|0|0|331
1512889|U19 DFB-Nachwuchsliga - Vorrunde Gruppe A|9|7|4|0|558
1148019|Ykkösliiga|2|0|0|0|0
1139729|2. Bundesliga|2|0|0|0|0
1139749|Superettan|2|1|0|0|0
1278992|U19 DFB-Nachwuchsliga - Vorrunde Gruppe E|9|9|3|1|551
1377988|Ykkönen|9|0|0|0|0
1303450|U19 DFB-Nachwuchsliga - Vorrunde Gruppe A|9|9|0|0|840
1271200|Veikkausliiga|1|0|0|0|0
1303454|Ykkösliiga|2|0|0|0|0
1371260|Ykkösliiga|2|0|0|0|0
1323545|U19 Division 1 Fall|9|0|0|0|0
1439438|Ykkönen|9|0|0|0|0
1411460|P18 SM|9|0|0|0|0
1303455|Veikkausliiga|1|0|0|0|0
1461061|P18 SM Qualification|9|0|0|0|0
1192969|P18 SM|9|0|0|0|0
1136363|Veikkausliiga|1|0|0|0|0
1411461||0|0|0|0|0
1303459|P18 SM Qualification|9|0|0|0|0
1419347|Ykkönen|9|0|0|0|0
1512337|Ykkönen|9|0|0|0|0
1514364||0|0|0|0|0
1303448|P18 SM|9|0|0|0|0
1425896|Ykkönen|9|0|0|0|0
1380304|Ykkösliiga|2|0|0|0|0
1280874|U19 DFB-Nachwuchsliga - Vorrunde Gruppe I|9|8|0|1|276
1380306|Kakkonen - Lohko B|9|0|0|0|0
1303447|P18 SM|9|0|0|0|0
1448181|Ykkönen|9|0|0|0|0
1448194|P18 SM|9|0|0|0|0
1606121||0|0|0|0|0
1448183|P18 SM|9|0|0|0|0
1430625|Ykkönen|9|0|0|0|0
1465961||0|0|0|0|0
1447429|Kakkonen - Lohko B|9|0|0|0|0
1364210|U19 DFB-Nachwuchsliga - Vorrunde Gruppe I|9|0|0|0|0
1448196|P18 SM|9|0|0|0|0
1527493|P18 SM|9|0|0|0|0
1448195|P18 SM Qualification|9|0|0|0|0
1448199||0|0|0|0|0
1465962||0|0|0|0|0
1448197|P18 SM Qualification|9|0|0|0|0
1448185|P18 SM|9|0|0|0|0
1465958|P18 SM|9|0|0|0|0
1448188|Kakkonen - Lohko B|9|0|0|0|0
1538268|Kakkonen - Lohko B|9|0|0|0|0
1526951|P18 SM|9|0|0|0|0
1448201||0|0|0|0|0
1528735|P18 SM Qualification|9|0|0|0|0
1408486|P18 SM|9|0|0|0|0
1364211|Veikkausliiga|1|0|0|0|0
1173519|2. Bundesliga|2|0|0|0|0
1173520||0|0|0|0|0
1191208|I. Liga starsieho dorastu|9|5|0|0|450
1260327|MONACObet Liga|2|10|1|1|882
1084488|1. Dorostenecka liga|9|10|0|0|792
1450584|I. Liga starsieho dorastu|9|5|1|0|400
1077716|I. Liga starsieho dorastu|9|6|2|0|527
1371891|Championnat National U19 - Groupe B|9|0|0|0|0
1411245|1. Dorostenecka liga|9|0|0|0|0
1129856|Regionalliga Bayern|3|8|0|0|506
1323489|Niké Liga|1|2|0|0|11
1447931|I. Liga starsieho dorastu|9|6|3|0|525
1077729|Niké Liga|1|5|0|0|81
1077728|Niké Liga|1|8|0|1|313
1129855|Chance Narodni Liga|2|5|0|0|40
1384178|I. Liga starsieho dorastu|9|0|0|0|0
1250436|MONACObet Liga|2|9|0|1|597
1323491|Niké Liga|1|0|0|0|0
1129854|MONACObet Liga|2|4|0|1|108
1077726|Niké Liga|1|9|2|2|380
1084491|I. Liga starsieho dorastu|9|4|3|0|340
1077718|I. Liga starsieho dorastu|9|2|0|0|77
1077722|I. Liga starsieho dorastu|9|4|3|0|360
1470590|I. Liga starsieho dorastu|9|6|1|0|416
1190749|Niké Liga|1|0|0|0|0
1237727||0|0|0|0|0
1261639|PKO BP Ekstraklasa|1|0|0|0|0
1553398|I. Liga starsieho dorastu|9|4|0|0|360
1084487|I. Liga starsieho dorastu|9|3|0|0|248
1129853|MONACObet Liga|2|0|0|0|0
1137530||0|0|0|0|0
1407346|I. Liga starsieho dorastu|9|0|0|0|0
1565024|I. Liga starsieho dorastu|9|4|0|0|360
1299047|I. Liga starsieho dorastu|9|5|1|0|412
1173523|I. Liga starsieho dorastu|9|4|0|0|226
1173527|Niké Liga|1|0|0|0|0
1077715|I. Liga starsieho dorastu|9|6|0|0|514
1173526|Primavera 1|1|0|0|0|0
1173538|MONACObet Liga|2|0|0|0|0
1173539|MONACObet Liga|2|0|0|0|0
1173541|I. Liga starsieho dorastu|9|5|3|0|450
1360086|I. Liga starsieho dorastu|9|6|0|0|502
1451163|U18 Elite 1 - Belgium|1|0|0|0|0
1586061|I. Liga starsieho dorastu|9|6|0|0|500
1077719|I. Liga starsieho dorastu|9|0|0|0|0
1244160|MONACObet Liga|2|1|0|0|6
1409854|Swiss U19 Elite League|9|6|0|0|301
1173528|MONACObet Liga|2|4|0|1|209
1287518|ÖFB Jugendliga U18|2|4|0|0|251
1343775|Niké Liga|1|1|0|0|15
1130183|MONACObet Liga|2|0|0|0|0
1388001|MONACObet Liga|2|8|2|0|359
1173542|I. Liga starsieho dorastu|9|4|2|0|347
1270112||0|0|0|0|0
1294929||0|0|0|0|0
1396729|Swiss U19 Elite League|9|6|2|0|339
1173521|I. Liga starsieho dorastu|9|1|0|0|90
1330712|MONACObet Liga|2|1|0|0|90
1350599||0|0|0|0|0
1330705||0|0|0|0|0
1529637||0|0|0|0|0
1344107|I. Liga starsieho dorastu|9|4|0|0|360
1468549|I. Liga starsieho dorastu|9|0|0|0|0
1484785|Campionato nazionale Under 17 - B|5|5|0|0|445
1241748|MONACObet Liga|2|5|0|1|212
1330708|I. Liga starsieho dorastu|9|6|0|0|483
1330716|I. Liga starsieho dorastu|9|5|0|0|206
1330717|I. Liga starsieho dorastu|9|6|0|0|479
1470587||0|0|0|0|0
1472740||0|0|0|0|0
1330709||0|0|0|0|0
1330706|MONACObet Liga|2|4|0|0|157
1481807|I. Liga starsieho dorastu|9|4|1|0|358
1289759||0|0|0|0|0
1173544|1. Dorostenecka liga|9|8|1|0|552
1173548|1. Dorostenecka liga|9|7|2|0|259
1344105|I. Liga starsieho dorastu|9|5|1|0|281
1330715|I. Liga starsieho dorastu|9|6|3|0|517
1370704||0|0|0|0|0
1122956|Super liga Srbije|1|0|0|0|0
1173619|Omladinska liga Srbije|9|9|1|0|765
1058851|Prva liga Srbije|2|9|0|0|619
1305031|Omladinska liga Srbije|9|8|2|0|635
1554319||0|0|0|0|0
1169084|Super liga Srbije|1|5|0|1|325
1073640|Super liga Srbije|1|3|0|0|73
1243728|Super liga Srbije|1|3|0|0|90
1306433|Super liga Srbije|1|2|0|0|13
1305030|Prva liga Srbije|2|9|0|1|690
1122958|Super liga Srbije|1|1|0|0|45
1327119|Prva liga Srbije|2|12|0|0|271
1073631|Bundesliga|1|0|0|0|0
1246307|Omladinska liga Srbije|9|6|0|0|457
1073634|Prva liga Srbije|2|8|2|1|272
1168357|Omladinska liga Srbije|9|9|7|0|787
1122960|Super liga Srbije|1|3|2|0|0
1073625|U19 DFB-Nachwuchsliga - Vorrunde Gruppe G|9|6|5|0|366
1111725|Prva liga Srbije|2|12|2|1|322
1073626|Super liga Srbije|1|0|0|0|0
1198052|Omladinska liga Srbije|9|8|5|0|553
1141848|Super liga Srbije|1|2|0|0|151
1205969|Prva liga Srbije|2|8|0|0|720
1122957|Prva liga Srbije|2|11|1|0|949
1205976|Omladinska liga Srbije|9|6|1|1|521
1305035|Prva liga Srbije|2|1|0|0|2
1306911|Omladinska liga Srbije|9|3|0|0|172
1330765|Omladinska liga Srbije|9|8|0|0|709
1378134|Swiss U19 Elite League|9|8|0|0|527
1205973|Super liga Srbije|1|5|0|0|278
1206002|Omladinska liga Srbije|9|8|0|0|631
1437580|Omladinska liga Srbije|9|5|0|0|268
1205997|Prva liga Srbije|2|9|1|1|681
1437559|Omladinska liga Srbije|9|7|0|0|183
1432438|ÖFB Jugendliga U18|2|1|0|0|2
1437579|Omladinska liga Srbije|9|9|0|0|810
1435998|Prva liga Srbije|2|10|1|1|669
1435117|Omladinska liga Srbije|9|4|3|2|221
1205992|Omladinska liga Srbije|9|9|4|0|673
1330753|Prva liga Srbije|2|10|2|1|533
1306120|Omladinska liga Srbije|9|5|0|2|174
1380753|Omladinska liga Srbije|9|8|0|0|373
1243330|Super liga Srbije|1|3|0|0|0
1205984|Super liga Srbije|1|2|0|0|76
1206008|U19 DFB-Nachwuchsliga - Vorrunde Gruppe I|9|3|0|0|51
1437572|Omladinska liga Srbije|9|8|3|0|418
1330761|Omladinska liga Srbije|9|3|0|0|270
1435118|Kadetska liga Srbije|9|7|0|0|630
1539758||0|0|0|0|0
1343778|Kadetska liga Srbije|9|9|1|0|802
1457466|Kadetska liga Srbije|9|7|1|2|630
1480181|U17 DFB-Nachwuchsliga - Vorrunde Gruppe A|9|7|0|0|585
1517507|Kadetska liga Srbije|9|8|0|0|450
1437233|Kadetska liga Srbije|9|8|1|2|519
1330751|Kadetska liga Srbije|9|9|1|5|687
1605208||0|0|0|0|0
1330763|Kadetska liga Srbije|9|5|0|0|349
1379233|U17 DFB-Nachwuchsliga - Vorrunde Gruppe A|9|7|0|0|332
1437333|Kadetska liga Srbije|9|9|1|0|449
1517315|U17 DFB-Nachwuchsliga - Vorrunde Gruppe G|9|8|1|3|666
1520415|U17 DFB-Nachwuchsliga - Vorrunde Gruppe C|9|5|0|0|191
1306909|Kadetska liga Srbije|9|8|1|1|494
1457448|Kadetska liga Srbije|9|9|6|0|760
1485859|Kadetska liga Srbije|9|9|11|0|809
1448305|Kadetska liga Srbije|9|9|6|3|0
1457468|Kadetska liga Srbije|9|7|4|1|566
1330748|Kadetska liga Srbije|9|9|3|0|704
1443631|Kadetska liga Srbije|9|9|14|0|554
1071990||0|0|0|0|0
1342570||0|0|0|0|0
1071989|Prva Nogometna Liga|2|8|0|1|720
1137274|Serie C - Girone C|9|7|0|0|471
1071996|Regionalliga Bayern|3|4|0|0|250
1071993|Primavera 1|1|6|0|0|540
1071997|Prva Nogometna Liga|2|5|0|0|450
1268852||0|0|0|0|0
1468846|SuperSport HNL|1|3|0|0|92
1318341||0|0|0|0|0
1072020|Prva Nogometna Liga|2|7|0|1|384
1071992||0|0|0|0|0
1159571||0|0|0|0|0
1304692|SuperSport HNL|1|7|0|0|206
1072019||0|0|0|0|0
1268853|Prva Nogometna Liga|2|3|0|0|148
1327524||0|0|0|0|0
1474151||0|0|0|0|0
1072018|SuperSport HNL|1|5|0|0|124
1238352|U19 DFB-Nachwuchsliga - Vorrunde Gruppe B|9|4|1|0|344
1468844|SuperSport HNL|1|7|2|1|421
1070973|Regionalliga West|3|4|0|1|289
1534923|SuperSport HNL|1|0|0|0|0
1606467||0|0|0|0|0
1448027|Prva Nogometna Liga|2|7|2|2|524
1185190|Bundesliga|1|4|0|1|139
1510013|Prva Nogometna Liga|2|10|3|1|789
1268854||0|0|0|0|0
1429548||0|0|0|0|0
1265302||0|0|0|0|0
1333821||0|0|0|0|0
1357760|SuperSport HNL|1|0|0|0|0
1401133|Regionalliga Bayern|3|6|0|1|407
1412728||0|0|0|0|0
1265317||0|0|0|0|0
1407862||0|0|0|0|0
1265321|Prva Nogometna Liga|2|4|0|1|360
1453104|U19 DFB-Nachwuchsliga - Vorrunde Gruppe E|9|1|0|0|29
1525438|SuperSport HNL|1|4|0|0|153
1333841||0|0|0|0|0
1523677||0|0|0|0|0
1265307|SuperSport HNL|1|10|0|1|608
1552791|SuperSport HNL|1|8|0|1|296
1265309|Prva Nogometna Liga|2|7|0|2|488
1265310||0|0|0|0|0
1333863||0|0|0|0|0
1407856||0|0|0|0|0
1454678||0|0|0|0|0
1328460|U19 DFB-Nachwuchsliga - Vorrunde Gruppe D|9|8|1|1|741
1200999|SuperSport HNL|1|0|0|0|0
1333839||0|0|0|0|0
1455046||0|0|0|0|0
1454692|SuperSport HNL|1|10|2|3|583
1333859|Prva Nogometna Liga|2|7|1|1|333
1468847|Prva Nogometna Liga|2|4|0|2|229
1454700||0|0|0|0|0
1468849|3. Liga|3|8|2|0|495
1468817||0|0|0|0|0
1333819||0|0|0|0|0
1333820||0|0|0|0|0
1407860|SuperSport HNL|1|5|0|0|337
1583673||0|0|0|0|0
1333849|U19 DFB-Nachwuchsliga - Vorrunde Gruppe H|9|7|0|0|423
1333846||0|0|0|0|0
1564373|U17 DFB-Nachwuchsliga - Vorrunde Gruppe D|9|5|0|0|335
1407864||0|0|0|0|0
1583670||0|0|0|0|0
1407863||0|0|0|0|0
1333836||0|0|0|0|0
1407861||0|0|0|0|0
1479117||0|0|0|0|0
1385523|U17 DFB-Nachwuchsliga - Vorrunde Gruppe F|9|7|2|4|572
1333858||0|0|0|0|0
1608047||0|0|0|0|0
1446263|Premijer Liga BiH U19|9|3|0|1|117
1333861||0|0|0|0|0
1333854||0|0|0|0|0
1378780|Premier Liga 2|9|1|0|0|90
1186332|Premier Liga 2|9|5|0|0|450
1603146||0|0|0|0|0
1296509|Persza Liga|2|10|0|0|811
1435261|Premier Liga 2|9|6|0|0|512
1450946||0|0|0|0|0
1163266|U19 DFB-Nachwuchsliga - Vorrunde Gruppe G|9|4|0|0|280
1259757|Premier Liga 2|9|5|0|0|362
1330185|Erovnuli Liga|9|0|0|0|0
1341670|Premier Liga 2|9|6|3|0|531
1272998|Premier Liga 2|9|5|0|0|364
1202569|U19 DFB-Nachwuchsliga - Vorrunde Gruppe A|9|3|0|0|107
1250868|Druga Liga|9|1|0|0|90
1193619|Premier Liga 2|9|5|5|0|420
1259764||0|0|0|0|0
1294306|Premier Liga 2|9|6|0|0|519
1375377|SuperSport HNL|1|13|1|3|381
1488338|League One|3|0|0|0|0
1246474|MLS Next Pro|3|0|0|0|0
1439410|Premier Liga 2|9|8|5|0|636
1598041||0|0|0|0|0
1381336|efbet Liga|1|3|0|0|96
1436068|Premier Liga 2|9|6|2|0|0
1436074|Premier Liga 2|9|4|0|0|360
1383989|Centralna Liga Juniorów|9|6|0|0|540
1320343||0|0|0|0|0
1320347|Druga Liga|9|0|0|0|0
1318847||0|0|0|0|0
1460851|Premier Liga 2|9|2|0|0|180
1454813|Campionato Under 18|7|0|0|0|0
1294644|Premier Liga 2|9|1|0|0|90
1576635|Premier Liga 2|9|6|1|0|502
1320349||0|0|0|0|0
1325539||0|0|0|0|0
1511158|Premier Liga 2|9|3|0|0|216
1320333||0|0|0|0|0
1382178|Premier Liga 2|9|1|0|0|35
1314767||0|0|0|0|0
1517304|Premier Liga 2|9|7|0|0|465
1383993||0|0|0|0|0
1337012|U19 DFB-Nachwuchsliga - Vorrunde Gruppe G|9|6|0|0|0
1445304|Premier Liga 2|9|5|0|0|129
1467103|Druga Liga|9|1|0|0|78
1400972|U19 DFB-Nachwuchsliga - Vorrunde Gruppe D|9|9|5|0|0
1451150|Premier Liga 2|9|2|0|0|0
1511159|Centralna Liga Juniorów|9|9|3|0|438
1603999||0|0|0|0|0
1505392||0|0|0|0|0
1478875||0|0|0|0|0
1354519||0|0|0|0|0
1354272|Druga Liga|9|4|0|0|336
1478900||0|0|0|0|0
1544277|U18 Elite 1 - Belgium|1|4|0|0|341
1492883||0|0|0|0|0
1354316||0|0|0|0|0
1354303|U17 Division 1 Fall|9|3|1|2|270
1505393||0|0|0|0|0
1354274||0|0|0|0|0
1354298|Premier Liga 2|9|8|2|0|668
1527431|Campionato nazionale Under 17 - A|4|2|1|0|128
1469889|Campionato nazionale Under 17 - B|5|4|3|0|360
1320336||0|0|0|0|0
1537677||0|0|0|0|0
1354275||0|0|0|0|0
1478906|Druga Liga|9|4|3|0|254
1472957|Premier Liga 2|9|2|0|0|43
1354276|Druga Liga|9|4|2|1|0
1539415|Campionato nazionale Under 17 - A|4|1|0|0|79
1564863|U17 DFB-Nachwuchsliga - Vorrunde Gruppe C|9|8|3|0|609
1319510|Toplyga|1|0|0|0|0
1245311||0|0|0|0|0
1461515|Primavera 2 - B|9|5|1|0|450
1184509|U18 Premier League|9|3|0|0|105
1316052|I Lyga|2|0|0|0|0
1401444|Primavera 2 - B|9|3|0|0|225
1245315|I Lyga|2|0|0|0|0
1267777|Primavera 2 - B|9|0|0|0|0
1296956|I Lyga|2|0|0|0|0
1314289|Toplyga|1|0|0|0|0
1528750||0|0|0|0|0
1279052|Toplyga|1|0|0|0|0
1183668|Primavera 1|1|1|0|0|16
1245316|Primavera 2 - B|9|5|0|0|450
1344070|I Lyga|2|0|0|0|0
1108672||0|0|0|0|0
1263060|I Lyga|2|0|0|0|0
1381499|U19 DFB-Nachwuchsliga - Vorrunde Gruppe E|9|9|2|1|313
1406297||0|0|0|0|0
1467599|U18 Premier League|9|4|1|0|349
1509624|I Lyga|2|0|0|0|0
1333794||0|0|0|0|0
1461517||0|0|0|0|0
1461518||0|0|0|0|0
1528901|I Lyga|2|0|0|0|0
1333799|Campionato nazionale Under 17 - C|6|4|1|0|335
1528875|Campionato nazionale Under 17 - A|4|0|0|0|0
1517439|I Lyga|2|0|0|0|0
1549277||0|0|0|0|0
1467342||0|0|0|0|0
1333797||0|0|0|0|0
1442851|I Lyga|2|0|0|0|0
1467534||0|0|0|0|0
1333807||0|0|0|0|0
1408604||0|0|0|0|0
1542447||0|0|0|0|0
1563046||0|0|0|0|0
1545408||0|0|0|0|0
1549290||0|0|0|0|0
1467339||0|0|0|0|0
1467341|I Lyga|2|0|0|0|0
1289670|Primavera 1|1|0|0|0|0
1275576|Futbola Pirmā līga|2|0|0|0|0
1145050|Primavera 2 - B|9|5|0|0|450
1455363|Futbola Pirmā līga|2|0|0|0|0
1308549|Futbola Pirmā līga|2|0|0|0|0
1288148|Futbola Pirmā līga|2|0|0|0|0
1527417|Campionato Under 18|7|0|0|0|0
1308550|Futbola Pirmā līga|2|0|0|0|0
1271631|U18 Premier League|9|2|1|0|180
1308553|Futbola Pirmā līga|2|0|0|0|0
1525097|Futbola Pirmā līga|2|0|0|0|0
1256959|Futbola Pirmā līga|2|0|0|0|0
1257063|Futbola Pirmā līga|2|0|0|0|0
1398124|Virsliga|1|0|0|0|0
1354424|Challenger Pro League|2|0|0|0|0
1374998|Virsliga|1|1|0|0|18
1354423|Futbola Pirmā līga|2|0|0|0|0
1255167|Futbola Pirmā līga|2|0|0|0|0
1271629||0|0|0|0|0
1249501|Primavera 1|1|2|0|0|14
1418918|Futbola Pirmā līga|2|0|0|0|0
1271630||0|0|0|0|0
1077214|Futbola Pirmā līga|2|0|0|0|0
1260754|Futbola Pirmā līga|2|0|0|0|0
1260750|Futbola Pirmā līga|2|0|0|0|0
1308389|Futbola Pirmā līga|2|0|0|0|0
1291586|Futbola Pirmā līga|2|0|0|0|0
1308388|Futbola Pirmā līga|2|0|0|0|0
1308538|Futbola Pirmā līga|2|0|0|0|0
1542006||0|0|0|0|0
1334198|Futbola Pirmā līga|2|0|0|0|0
1334204||0|0|0|0|0
1473881||0|0|0|0|0
1375351||0|0|0|0|0
1332610||0|0|0|0|0
1332611||0|0|0|0|0
1334196||0|0|0|0|0
1334203||0|0|0|0|0
1332612||0|0|0|0|0
1371864||0|0|0|0|0
1371865||0|0|0|0|0
1371862||0|0|0|0|0
1334202||0|0|0|0|0
1473883||0|0|0|0|0
1406118||0|0|0|0|0
1598645||0|0|0|0|0
1461808|Swiss U17 Elite League|9|6|0|0|511
1332609|Futbola Pirmā līga|2|0|0|0|0
1536085|U17 DFB-Nachwuchsliga - Vorrunde Gruppe E|9|8|6|0|663
1470860|Futbola Pirmā līga|2|0|0|0|0
1354427||0|0|0|0|0
1084756|Serie A|1|0|0|0|0
1144096|efbet Liga|1|2|0|0|180
1431119|Vtora Liga|2|8|0|1|711
1351168|Vtora Liga|2|8|0|0|510
1345502|Vtora Liga|2|9|0|0|769
1519180||0|0|0|0|0
1335468||0|0|0|0|0
1339576|efbet Liga|1|5|0|0|303
1391951|efbet Liga|1|0|0|0|0
1084759|Prva Nogometna Liga|2|5|1|0|185
1196528|Super League U19|9|4|1|0|141
1182203|efbet Liga|1|1|0|0|1
1100648||0|0|0|0|0
1312259|Primavera 2 - A|9|4|0|0|335
1064228||0|0|0|0|0
1084760|Vtora Liga|2|4|1|1|274
1064223|Primavera 1|1|6|1|1|508
1067909|U18 Premier League|9|6|1|1|521
1430792|Vtora Liga|2|9|4|1|423
1064225||0|0|0|0|0
1201256|efbet Liga|1|4|0|0|60
1467363|Vtora Liga|2|8|4|0|0
1333882||0|0|0|0|0
1333714|Primavera 1|1|0|0|0|0
1443717||0|0|0|0|0
1333721||0|0|0|0|0
1484619||0|0|0|0|0
1333740||0|0|0|0|0
1573780|Campionato nazionale Under 17 - A|4|2|0|0|90
1347633||0|0|0|0|0
1333713||0|0|0|0|0
1532897||0|0|0|0|0
1484267||0|0|0|0|0
1532898||0|0|0|0|0
1333736||0|0|0|0|0
1333723||0|0|0|0|0
1605273||0|0|0|0|0
1411368||0|0|0|0|0
1333734||0|0|0|0|0
1310379||0|0|0|0|0
1581918|U17 DFB-Nachwuchsliga - Vorrunde Gruppe F|9|2|0|0|23
1609446||0|0|0|0|0
1532901||0|0|0|0|0
1467895|Vtora Liga|2|9|1|0|387
1484268||0|0|0|0|0
1532900||0|0|0|0|0
1570066|U17 DFB-Nachwuchsliga - Vorrunde Gruppe C|9|7|1|0|296
1194057|Nemzeti Bajnokság II.|2|9|0|0|810
1346826|Primavera 1|1|5|0|0|450
1448269|Nemzeti Bajnokság|1|0|0|0|0
1512155||0|0|0|0|0
1547294||0|0|0|0|0
1264780|Nemzeti Bajnokság|1|3|0|0|270
1486465|Nemzeti Bajnokság II.|2|4|0|0|244
1288569||0|0|0|0|0
1479118|Nemzeti Bajnokság|1|0|0|0|0
1194033|Nemzeti Bajnokság II.|2|7|0|0|494
1060885|U19 DFB-Nachwuchsliga - Vorrunde Gruppe I|9|8|0|1|674
1462363|Nemzeti Bajnokság|1|9|0|0|662
1301963|Nemzeti Bajnokság|1|0|0|0|0
1336116|Nemzeti Bajnokság|1|9|0|0|251
1283184|Nemzeti Bajnokság II.|2|8|3|1|344
1348452|Nemzeti Bajnokság II.|2|9|0|1|518
1346835|Nemzeti Bajnokság|1|9|4|2|610
1464252|Nemzeti Bajnokság II.|2|9|0|1|542
1490395|Nemzeti Bajnokság|1|1|0|0|3
1194049|Nemzeti Bajnokság|1|5|0|0|213
1194047|Nemzeti Bajnokság|1|2|0|0|60
1342858|Nemzeti Bajnokság|1|4|0|0|139
1194052|Nemzeti Bajnokság|1|0|0|0|0
1385632|Nemzeti Bajnokság II.|2|7|1|0|0
1571638|Nemzeti Bajnokság II.|2|7|0|1|468
1604111||0|0|0|0|0
1301967|U18 Elite 1 - Belgium|1|0|0|0|0
1267447|Challenger Pro League|2|0|0|0|0
1332120||0|0|0|0|0
1264781||0|0|0|0|0
1346831||0|0|0|0|0
1495368||0|0|0|0|0
1267459|Nemzeti Bajnokság II.|2|7|0|0|317
1495640|Nemzeti Bajnokság II.|2|2|0|0|105
1267451||0|0|0|0|0
1264804|Nemzeti Bajnokság II.|2|0|0|0|0
1469785||0|0|0|0|0
1530612||0|0|0|0|0
1530623||0|0|0|0|0
1607810||0|0|0|0|0
1607812||0|0|0|0|0
1260945|2. Liga|2|8|2|0|619
1264800|Campionato Under 18|7|3|1|0|79
1591889|Nemzeti Bajnokság II.|2|4|0|0|245
1264803||0|0|0|0|0
1267465|Nemzeti Bajnokság|1|2|0|0|0
1346822||0|0|0|0|0
1346827||0|0|0|0|0
1411498|Nemzeti Bajnokság|1|0|0|0|0
1514089||0|0|0|0|0
1607813||0|0|0|0|0
1600936||0|2|0|0|0
1495668|Nemzeti Bajnokság|1|0|0|0|0
1495749||0|0|0|0|0
1495750||0|0|0|0|0
1505387||0|0|0|0|0
1334361||0|0|0|0|0
1580636||0|0|0|0|0
1580637||0|0|0|0|0
1608081||0|0|0|0|0
1495670||0|0|0|0|0
1499294||0|0|0|0|0
1580635||0|0|0|0|0
1495669||0|0|0|0|0
1495753|Nemzeti Bajnokság|1|0|0|0|0
1501626||0|0|0|0|0
1502371|U17 DFB-Nachwuchsliga - Vorrunde Gruppe D|9|7|0|0|545
1495676||0|0|0|0|0
1499293||0|0|0|0|0
1499295||0|0|0|0|0
1501273||0|0|0|0|0
1501275||0|0|0|0|0
1501280|Campionato nazionale Under 17 - B|5|3|0|0|131
1501621||0|0|0|0|0
1608080||0|0|0|0|0
1591615||0|0|0|0|0
1606873||0|0|0|0|0
1495677||0|0|0|0|0
1495681||0|0|0|0|0
1501271|1. Dorostenecka liga|9|3|0|0|0
1501274||0|0|0|0|0
1501637||0|0|0|0|0
1505119||0|0|0|0|0
1523479||0|0|0|0|0
1523482||0|0|0|0|0
1447034|U19 DFB-Nachwuchsliga - Vorrunde Gruppe A|9|9|5|0|593
1501633||0|0|0|0|0
1176747|Superliga|1|0|0|0|0
1313147|U19 Boys League|9|5|0|0|450
1274379|Superliga|1|11|0|0|970
1101374|Superliga|1|8|0|0|657
1176783|Superliga|1|1|0|0|20
1263404|U19 Boys League|9|3|0|0|225
1372787|U19 Boys League|9|6|0|0|540
1313834|Superliga|1|1|0|0|1
1246723|1.Division|2|1|0|0|28
1410024|U19 Boys League|9|2|0|1|160
1030372|U19 Boys League|9|6|1|0|455
1334632|1.Division|2|7|0|0|218
1176780|Superliga|1|10|0|1|185
1192270|1.Division|2|6|0|0|314
1445463|U19 Boys League|9|3|0|0|128
1269655|U19 Boys League|9|6|1|0|423
1180535|U19 Boys League|9|5|2|0|387
1116647|1.Division|2|8|2|0|327
1334612|1.Division|2|5|0|1|122
1448191|U19 Boys League|9|2|0|0|126
1176777|U19 Boys League|9|6|1|0|493
1259986|Bundesliga|1|3|0|0|49
1305554|Superliga|1|10|1|0|96
1298995|U19 Boys League|9|2|0|0|180
1152305|U19 Boys League|9|5|0|0|369
1298994|U19 Boys League|9|0|0|0|0
1152320|Superliga|1|4|0|0|206
1274378|U19 Boys League|9|6|0|0|465
1152323|U19 Boys League|9|6|1|0|540
1343304|U19 Boys League|9|6|0|0|540
1385481|U19 Boys League|9|3|0|0|169
1299000|U19 Boys League|9|6|0|0|504
1518472|U19 Boys League|9|5|1|0|431
1478063|U19 Boys League|9|5|2|0|450
1298997|U19 Boys League|9|6|1|0|534
1249879|Superliga|1|8|0|1|221
1267968|U19 Boys League|9|5|0|0|450
1448410|U19 Boys League|9|6|2|0|495
1248232|U19 Boys League|9|4|0|0|270
1274382|U19 Boys League|9|6|2|0|296
1298991|U19 Boys League|9|4|1|0|153
1274386|U19 Boys League|9|7|10|0|566
1296194|Superliga|1|0|0|0|0
1030377||0|0|0|0|0
1334657|U19 Boys League|9|6|4|1|304
1369078|U18 Premier League|9|3|0|0|0
1435509|U19 Boys League|9|0|0|0|0
1376880||0|0|0|0|0
1350989||0|0|0|0|0
1585106||0|0|0|0|0
1585105||0|0|0|0|0
1435512||0|0|0|0|0
1435507||0|0|0|0|0
1299015|U19 Boys League|9|1|0|0|90
1365589||0|0|0|0|0
1435500||0|0|0|0|0
1380867||0|0|0|0|0
1430381|U19 Boys League|9|7|0|0|574
1435501||0|0|0|0|0
1435516|U19 Boys League|9|2|0|0|65
1375598||0|0|0|0|0
1462875||0|0|0|0|0
1435504||0|0|0|0|0
1299010||0|0|0|0|0
1539963||0|0|0|0|0
1591974||0|0|0|0|0
1277976|U19 Boys League|9|6|6|0|505
1435506||0|0|0|0|0
1521084||0|0|0|0|0
1364112|Liga 2|2|8|0|0|720
1076318|Liga 2|2|4|0|0|360
1132535||0|0|0|0|0
1120616|Primavera 1|1|0|0|0|0
1237612|Primavera 1|1|6|1|0|480
1132538|Primavera 1|1|3|0|0|201
1237670||0|0|0|0|0
1283844|Liga 2|2|5|0|0|450
1552646|Liga 3|9|2|0|0|38
1076322|Primavera 1|1|0|0|0|0
1317349|Norsk Tipping-Ligaen avdeling 2|9|0|0|0|0
1118865|Liga 2|2|11|2|2|614
1170998|Primavera 1|1|5|0|0|199
1120615|Primavera 1|1|2|0|0|154
1120692|Primavera 1|1|4|1|0|257
1250111|SuperLiga|1|13|1|0|908
1346805|SuperLiga|1|10|0|0|345
1462852|Liga 2|2|12|1|2|739
1198080|U19 DFB-Nachwuchsliga - Vorrunde Gruppe E|9|8|8|2|583
1060701||0|0|0|0|0
1310491|Primavera 2 - B|9|3|3|0|232
1179035|SuperLiga|1|0|0|0|0
1462225|U18 Elite 1 - Belgium|1|1|0|0|90
1520474||0|0|0|0|0
1426915|Liga 2|2|10|0|1|900
1334720|Primavera 1|1|3|1|0|218
1000145||0|0|0|0|0
1432303|Primavera 1|1|7|0|0|500
1375842||0|0|0|0|0
1179026||0|5|0|0|480
1385387||0|0|0|0|0
1327488||0|0|0|0|0
1317272||0|0|0|0|0
1455935|SuperLiga|1|10|0|0|311
1179030|SuperLiga|1|6|1|0|167
1341646||0|0|0|0|0
1179006|SuperLiga|1|7|1|0|157
1179004|SuperLiga|1|2|0|0|28
1179005||0|0|0|0|0
1179029||0|0|0|0|0
1234948|U19 DFB-Nachwuchsliga - Vorrunde Gruppe G|9|6|0|0|237
1341647||0|0|0|0|0
1339987|SuperLiga|1|1|0|0|120
1345647||0|0|0|0|0
1317219||0|0|0|0|0
1361032|Campionato nazionale Under 17 - A|4|0|0|0|0
1345652||0|0|0|0|0
1339989||0|0|0|0|0
1511960||0|0|0|0|0
1398649||0|0|0|0|0
1548162||0|0|0|0|0
1340000||0|0|0|0|0
1450899||0|0|0|0|0
1511963||0|0|0|0|0
1317226||0|0|0|0|0
1468225|Campionato nazionale Under 17 - A|4|1|1|0|75
`;

export type StatEuropy = { liga: string; szczebel: number; wyst: number; gole: number; asysty: number; min: number };

const MAPA = new Map<string, StatEuropy>();
SUROWE.split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => {
  const [id, liga, szczebel, wyst, gole, asysty, min] = l.split('|');
  MAPA.set(id, { liga, szczebel: Number(szczebel), wyst: Number(wyst), gole: Number(gole), asysty: Number(asysty), min: Number(min) });
});

export const statEuropy = (tmId: string): StatEuropy | null => MAPA.get(tmId) || null;
