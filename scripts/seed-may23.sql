-- Test seed: 50 fake orders for 2026-05-23
-- Run these two commands:
--   docker cp scripts/seed-may23.sql rafting-dunajec:/tmp/seed-may23.sql
--   docker exec rafting-dunajec psql -U postgres -d rafting_dunajec -f /tmp/seed-may23.sql
-- To delete seed data:
--   docker exec rafting-dunajec psql -U postgres -d rafting_dunajec -c "DELETE FROM orders WHERE id LIKE 'seed-0523-%';"

INSERT INTO orders
  (id, arrival_at, operator, cust_name, cust_surname, cust_country,
   cust_id_type, cust_id_code, cust_address, cust_phone,
   route, adults, kids, lines, manual_adjustment, status, completed_at)
VALUES
  ('seed-0523-01','2026-05-23 08:00:00+02','Recepcia',
   'Peter','Novák','Slovensko / Slovakia','ID','SK1234AB','Bratislava','+421900111001',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'complete','2026-05-23 09:35:00+02'),

  ('seed-0523-02','2026-05-23 08:15:00+02','Recepcia',
   'Jan','Dvořák','Česko / Czechia','ID','CZ5678CD','Praha 2','+420601222002',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'complete','2026-05-23 09:50:00+02'),

  ('seed-0523-03','2026-05-23 08:30:00+02','Recepcia',
   'Mateusz','Kowalski','Poľsko / Poland','PASSPORT','PL9012EF','Kraków','+48501333003',
   '17KM',4,0,'[{"kind":"BOAT","label":"Malý raft Hobit 350 (3/4/5-miestny)","qty":1,"unitPrice":80}]'::jsonb,
   0,'complete','2026-05-23 12:10:00+02'),

  ('seed-0523-04','2026-05-23 08:45:00+02','Recepcia',
   'Hans','Müller','Nemecko / Germany','PASSPORT','DE3456GH','München','+49172444004',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'complete','2026-05-23 10:20:00+02'),

  ('seed-0523-05','2026-05-23 09:00:00+02','Recepcia',
   'Zuzana','Kováčová','Slovensko / Slovakia','ID','SK7890IJ','Košice','+421911555005',
   '10KM',2,1,'[{"kind":"BOAT","label":"3-miestna loď (Gumar / Yukon X3)","qty":1,"unitPrice":50}]'::jsonb,
   0,'complete','2026-05-23 10:40:00+02'),

  ('seed-0523-06','2026-05-23 09:15:00+02','Recepcia',
   'Tomáš','Procházka','Česko / Czechia','ID','CZ2345KL','Brno','+420602666006',
   '17KM',3,0,'[{"kind":"BOAT","label":"3-miestna loď (Gumar / Yukon X3)","qty":1,"unitPrice":70}]'::jsonb,
   0,'complete','2026-05-23 12:30:00+02'),

  ('seed-0523-07','2026-05-23 09:30:00+02','Recepcia',
   'László','Kovács','Maďarsko / Hungary','ID','HU6789MN','Budapest','+36301777007',
   'TRASA_1',4,0,'[{"kind":"INSTRUCTOR","label":"Splav s inštruktorom (4 os.)","qty":1,"unitPrice":80}]'::jsonb,
   0,'complete','2026-05-23 13:00:00+02'),

  ('seed-0523-08','2026-05-23 09:45:00+02','Recepcia',
   'Martin','Horváth','Slovensko / Slovakia','ID','SK0123OP','Žilina','+421915888008',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40},{"kind":"BIKE","label":"Klasický bicykel — Návrat po splave (~10 km / 1 h)","qty":2,"unitPrice":8,"code":"KLASIK","tariff":"NAVRAT"}]'::jsonb,
   0,'complete','2026-05-23 11:15:00+02'),

  ('seed-0523-09','2026-05-23 10:00:00+02','Recepcia',
   'Klaus','Weber','Rakúsko / Austria','PASSPORT','AT4567QR','Wien','+43664999009',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'complete','2026-05-23 11:35:00+02'),

  ('seed-0523-10','2026-05-23 10:15:00+02','Recepcia',
   'Piotr','Wiśniewski','Poľsko / Poland','ID','PL8901ST','Wrocław','+48502100010',
   '25KM',3,0,'[{"kind":"BOAT","label":"Malý raft Hobit 350 (3/4/5-miestny)","qty":1,"unitPrice":100}]'::jsonb,
   0,'complete','2026-05-23 16:00:00+02'),

  ('seed-0523-11','2026-05-23 10:30:00+02','Recepcia',
   'Michal','Lukáč','Slovensko / Slovakia','ID','SK2345UV','Prešov','+421948111011',
   'TRASA_1',6,0,'[{"kind":"INSTRUCTOR","label":"Splav s inštruktorom","qty":6,"unitPrice":18}]'::jsonb,
   0,'complete','2026-05-23 14:15:00+02'),

  ('seed-0523-12','2026-05-23 10:45:00+02','Recepcia',
   'Petr','Novotný','Česko / Czechia','LICENCE','CZ6789WX','Ostrava','+420603222012',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'complete','2026-05-23 12:20:00+02'),

  ('seed-0523-13','2026-05-23 11:00:00+02','Recepcia',
   'Stefan','Bauer','Nemecko / Germany','PASSPORT','DE0123YZ','Berlin','+49173333013',
   '10KM',2,0,'[{"kind":"BIKE","label":"Klasický bicykel — Návrat po splave (~10 km / 1 h)","qty":2,"unitPrice":8,"code":"KLASIK","tariff":"NAVRAT"}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-14','2026-05-23 11:15:00+02','Recepcia',
   'Ján','Oravec','Slovensko / Slovakia','ID','SK4567AA','Banská Bystrica','+421902444014',
   '17KM',4,0,'[{"kind":"BOAT","label":"Veľký raft (Hobit 400 / 450 / 500) — cena za osobu","qty":4,"unitPrice":16}]'::jsonb,
   0,'complete','2026-05-23 15:00:00+02'),

  ('seed-0523-15','2026-05-23 11:30:00+02','Recepcia',
   'Pavel','Horáček','Česko / Czechia','ID','CZ8901BB','Plzeň','+420604555015',
   'TRASA_2',2,0,'[{"kind":"INSTRUCTOR","label":"Splav s inštruktorom (2 os.)","qty":1,"unitPrice":85}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-16','2026-05-23 11:45:00+02','Recepcia',
   'Krzysztof','Lewandowski','Poľsko / Poland','PASSPORT','PL2345CC','Warszawa','+48503666016',
   'TRASA_1',5,0,'[{"kind":"INSTRUCTOR","label":"Splav s inštruktorom","qty":5,"unitPrice":18}]'::jsonb,
   0,'complete','2026-05-23 15:30:00+02'),

  ('seed-0523-17','2026-05-23 12:00:00+02','Recepcia',
   'Eva','Balážová','Slovensko / Slovakia','ID','SK6789DD','Nitra','+421905777017',
   '10KM',2,1,'[{"kind":"BOAT","label":"3-miestna loď (Gumar / Yukon X3)","qty":1,"unitPrice":50},{"kind":"BIKE","label":"Klasický bicykel — Návrat po splave (~10 km / 1 h)","qty":2,"unitPrice":8,"code":"KLASIK","tariff":"NAVRAT"}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-18','2026-05-23 12:15:00+02','Recepcia',
   'Balázs','Nagy','Maďarsko / Hungary','ID','HU0123EE','Debrecen','+36302888018',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-19','2026-05-23 12:30:00+02','Recepcia',
   'James','Wilson','Veľká Británia / UK','PASSPORT','GB4567FF','London','+447700999019',
   'TRASA_1',4,0,'[{"kind":"INSTRUCTOR","label":"Splav s inštruktorom (4 os.)","qty":1,"unitPrice":80}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-20','2026-05-23 12:45:00+02','Recepcia',
   'Rastislav','Polák','Slovensko / Slovakia','ID','SK8901GG','Trenčín','+421910100020',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'complete','2026-05-23 14:20:00+02'),

  ('seed-0523-21','2026-05-23 13:00:00+02','Recepcia',
   'Ondřej','Krejčí','Česko / Czechia','ID','CZ2345HH','Olomouc','+420605111021',
   '10KM',2,0,'[{"kind":"BIKE","label":"E-bicykel — Návrat po splave (~10 km / 1 h)","qty":2,"unitPrice":20,"code":"EBIKE","tariff":"NAVRAT"}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-22','2026-05-23 13:15:00+02','Recepcia',
   'Franz','Huber','Rakúsko / Austria','PASSPORT','AT6789II','Graz','+43676222022',
   '17KM',3,0,'[{"kind":"BOAT","label":"3-miestna loď (Gumar / Yukon X3)","qty":1,"unitPrice":70}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-23','2026-05-23 13:30:00+02','Recepcia',
   'Juraj','Mináč','Slovensko / Slovakia','ID','SK0123JJ','Trnava','+421944333023',
   '25KM',4,0,'[{"kind":"BOAT","label":"Veľký raft (Hobit 400 / 450 / 500) — cena za osobu","qty":4,"unitPrice":20},{"kind":"BIKE","label":"Klasický bicykel — Návrat po splave (~10 km / 1 h)","qty":2,"unitPrice":8,"code":"KLASIK","tariff":"NAVRAT"}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-24','2026-05-23 13:45:00+02','Recepcia',
   'Wojciech','Zieliński','Poľsko / Poland','ID','PL4567KK','Gdańsk','+48504444024',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-25','2026-05-23 14:00:00+02','Recepcia',
   'Thomas','Schneider','Nemecko / Germany','PASSPORT','DE8901LL','Hamburg','+49174555025',
   'TRASA_3',2,0,'[{"kind":"INSTRUCTOR","label":"Splav s inštruktorom (2 os.)","qty":1,"unitPrice":120}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-26','2026-05-23 14:15:00+02','Recepcia',
   'Lucia','Vargová','Slovensko / Slovakia','ID','SK2345MM','Poprad','+421907666026',
   '10KM',3,1,'[{"kind":"BOAT","label":"Malý raft Hobit 350 (3/4/5-miestny)","qty":1,"unitPrice":60}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-27','2026-05-23 14:30:00+02','Recepcia',
   'Jakub','Šimánek','Česko / Czechia','LICENCE','CZ6789NN','Liberec','+420606777027',
   '10KM',2,0,'[{"kind":"BIKE","label":"Klasický bicykel — Návrat po splave (~10 km / 1 h)","qty":2,"unitPrice":8,"code":"KLASIK","tariff":"NAVRAT"}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-28','2026-05-23 14:45:00+02','Recepcia',
   'Tibor','Fekete','Maďarsko / Hungary','ID','HU0123OO','Miskolc','+36303888028',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40},{"kind":"EXTRA","label":"Taxi späť (na osobu)","qty":2,"unitPrice":8}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-29','2026-05-23 15:00:00+02','Recepcia',
   'Robert','Urbanec','Slovensko / Slovakia','ID','SK4567PP','Martin','+421908999029',
   '17KM',5,0,'[{"kind":"BOAT","label":"Veľký raft (Hobit 400 / 450 / 500) — cena za osobu","qty":5,"unitPrice":16}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-30','2026-05-23 15:15:00+02','Recepcia',
   'Anna','Wiśniewska','Poľsko / Poland','PASSPORT','PL8901QQ','Łódź','+48505100030',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-31','2026-05-23 15:30:00+02','Recepcia',
   'Igor','Kováč','Slovensko / Slovakia','ID','SK2345RR','Zvolen','+421935111031',
   'TRASA_1',4,0,'[{"kind":"INSTRUCTOR","label":"Splav s inštruktorom (4 os.)","qty":1,"unitPrice":80}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-32','2026-05-23 15:45:00+02','Recepcia',
   'Martin','Blaha','Česko / Czechia','ID','CZ6789SS','České Budějovice','+420607222032',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-33','2026-05-23 16:00:00+02','Recepcia',
   'Wolfgang','Fischer','Nemecko / Germany','PASSPORT','DE0123TT','Frankfurt','+49175333033',
   '10KM',2,0,'[{"kind":"BIKE","label":"Klasický bicykel — Návrat po splave (~10 km / 1 h)","qty":2,"unitPrice":8,"code":"KLASIK","tariff":"NAVRAT"}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-34','2026-05-23 16:15:00+02','Recepcia',
   'Marek','Jursa','Slovensko / Slovakia','ID','SK4567UU','Liptovský Mikuláš','+421911444034',
   '17KM',3,0,'[{"kind":"BOAT","label":"3-miestna loď (Gumar / Yukon X3)","qty":1,"unitPrice":70}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-35','2026-05-23 16:30:00+02','Recepcia',
   'Johann','Gruber','Rakúsko / Austria','PASSPORT','AT8901VV','Salzburg','+43677555035',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-36','2026-05-23 16:45:00+02','Recepcia',
   'Lukáš','Vlček','Česko / Czechia','ID','CZ2345WW','Hradec Králové','+420608666036',
   '25KM',4,0,'[{"kind":"BOAT","label":"Malý raft Hobit 350 (3/4/5-miestny)","qty":1,"unitPrice":100},{"kind":"BIKE","label":"Klasický bicykel — Návrat po splave (~10 km / 1 h)","qty":2,"unitPrice":8,"code":"KLASIK","tariff":"NAVRAT"}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-37','2026-05-23 17:00:00+02','Recepcia',
   'Sylwia','Nowak','Poľsko / Poland','ID','PL6789XX','Poznań','+48506777037',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-38','2026-05-23 17:15:00+02','Recepcia',
   'Daniel','Rusnák','Slovensko / Slovakia','ID','SK0123YY','Michalovce','+421944888038',
   'TRASA_2',2,0,'[{"kind":"INSTRUCTOR","label":"Splav s inštruktorom (2 os.)","qty":1,"unitPrice":85}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-39','2026-05-23 17:30:00+02','Recepcia',
   'Attila','Varga','Maďarsko / Hungary','ID','HU4567ZZ','Győr','+36304999039',
   '17KM',3,0,'[{"kind":"BOAT","label":"3-miestna loď (Gumar / Yukon X3)","qty":1,"unitPrice":70}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-40','2026-05-23 17:45:00+02','Recepcia',
   'Miroslav','Suchánek','Česko / Czechia','ID','CZ8901A2','Pardubice','+420609100040',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-41','2026-05-23 08:20:00+02','Recepcia',
   'Tomáš','Karas','Slovensko / Slovakia','ID','SK2345B3','Spišská Nová Ves','+421918111041',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'complete','2026-05-23 09:55:00+02'),

  ('seed-0523-42','2026-05-23 09:10:00+02','Recepcia',
   'Jiří','Mareš','Česko / Czechia','LICENCE','CZ6789C4','Zlín','+420610222042',
   'TRASA_1',4,0,'[{"kind":"INSTRUCTOR","label":"Splav s inštruktorom (4 os.)","qty":1,"unitPrice":80}]'::jsonb,
   0,'complete','2026-05-23 12:45:00+02'),

  ('seed-0523-43','2026-05-23 10:05:00+02','Recepcia',
   'Marcin','Szymański','Poľsko / Poland','PASSPORT','PL0123D5','Szczecin','+48507333043',
   '17KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":50}]'::jsonb,
   0,'complete','2026-05-23 13:30:00+02'),

  ('seed-0523-44','2026-05-23 11:10:00+02','Recepcia',
   'Rainer','Koch','Nemecko / Germany','PASSPORT','DE4567E6','Stuttgart','+49176444044',
   '10KM',2,0,'[{"kind":"BIKE","label":"E-bicykel — Celodenný prenájom","qty":2,"unitPrice":40,"code":"EBIKE","tariff":"DEN"}]'::jsonb,
   0,'complete','2026-05-23 17:00:00+02'),

  ('seed-0523-45','2026-05-23 12:05:00+02','Recepcia',
   'Stanislav','Mihálik','Slovensko / Slovakia','ID','SK8901F7','Rimavská Sobota','+421905555045',
   '25KM',3,0,'[{"kind":"BOAT","label":"3-miestna loď (Gumar / Yukon X3)","qty":1,"unitPrice":90}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-46','2026-05-23 13:10:00+02','Recepcia',
   'Filip','Doležal','Česko / Czechia','ID','CZ2345G8','Opava','+420611666046',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40},{"kind":"BIKE","label":"Klasický bicykel — Návrat po splave (~10 km / 1 h)","qty":2,"unitPrice":8,"code":"KLASIK","tariff":"NAVRAT"}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-47','2026-05-23 14:10:00+02','Recepcia',
   'Zsolt','Molnár','Maďarsko / Hungary','ID','HU6789H9','Pécs','+36305777047',
   'TRASA_3',4,0,'[{"kind":"INSTRUCTOR","label":"Splav s inštruktorom (4 os.)","qty":1,"unitPrice":140}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-48','2026-05-23 15:10:00+02','Recepcia',
   'Viktor','Petráš','Slovensko / Slovakia','ID','SK0123I0','Levice','+421913888048',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-49','2026-05-23 16:10:00+02','Recepcia',
   'Dawid','Kaczmarek','Poľsko / Poland','PASSPORT','PL4567J1','Bydgoszcz','+48508999049',
   '17KM',3,0,'[{"kind":"BOAT","label":"Malý raft Hobit 350 (3/4/5-miestny)","qty":1,"unitPrice":80}]'::jsonb,
   0,'pending',NULL),

  ('seed-0523-50','2026-05-23 17:10:00+02','Recepcia',
   'Hannes','Berger','Rakúsko / Austria','PASSPORT','AT8901K2','Innsbruck','+43678100050',
   '10KM',2,0,'[{"kind":"BOAT","label":"2-miestna loď (Yukon / Orinoco / Beaver)","qty":1,"unitPrice":40}]'::jsonb,
   0,'pending',NULL)

ON CONFLICT (id) DO NOTHING;
