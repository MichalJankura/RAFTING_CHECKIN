// RAFTING DUNAJEC — Pricing Catalog + i18n

const ROUTES = [
  { id: '10KM', km: 10, label: { sk: 'Červený Kláštor → Lesnica', en: 'Červený Kláštor → Lesnica' }, hours: '1,5h', freeParking: true },
  { id: '17KM', km: 17, label: { sk: 'Spišská Stará Ves → Lesnica', en: 'Spišská Stará Ves → Lesnica' }, hours: '3h' },
  { id: '25KM', km: 25, label: { sk: 'Spišská Stará Ves → Kroscienko', en: 'Spišská Stará Ves → Kroscienko' }, hours: '5h' },
];

const BOAT_PRICES = {
  LODE_2:     { '10KM': 40, '17KM': 50,  '25KM': 70,  perPerson: false, label: { sk: '2-miestna loď (Yukon / Orinoco / Beaver)', en: '2-seater boat (Yukon / Orinoco / Beaver)' } },
  LODE_3:     { '10KM': 50, '17KM': 70,  '25KM': 90,  perPerson: false, label: { sk: '3-miestna loď (Gumar / Yukon X3)',       en: '3-seater boat (Gumar / Yukon X3)' } },
  RAFT_SMALL: { '10KM': 60, '17KM': 80,  '25KM': 100, perPerson: false, label: { sk: 'Malý raft Hobit 350 (3/4/5-miestny)',    en: 'Small raft Hobit 350 (3/4/5-seater)' } },
  RAFT_LARGE: { '10KM': 12, '17KM': 16,  '25KM': 20,  perPerson: true,  label: { sk: 'Veľký raft (Hobit 400 / 450 / 500) — cena za osobu', en: 'Large raft (Hobit 400 / 450 / 500) — price per person' } },
};

const INSTRUCTOR_ROUTES = [
  { id: 'TRASA_1', label: { sk: 'Najobľúbenejšie',  en: 'Most popular' },  parking: 0, parkingNote: { sk: 'Parkovné: zdarma', en: 'Parking: free' } },
  { id: 'TRASA_2', label: { sk: 'Pre vodákov',      en: 'For paddlers' },  parking: 5, parkingNote: { sk: 'Parkovné: 5 € / auto (na mieste)', en: 'Parking: €5 / car (on site)' } },
  { id: 'TRASA_3', label: { sk: 'Pre náročných',    en: 'Advanced' },      parking: 5, parkingNote: { sk: 'Parkovné: 5 € / auto (na mieste)', en: 'Parking: €5 / car (on site)' } },
];

const INSTRUCTOR_PRICING = {
  TRASA_1: { fixed: { 2: 65,  3: 70,  4: 80  }, perPerson: 18 },
  TRASA_2: { fixed: { 2: 85,  3: 90,  4: 110 }, perPerson: 24 },
  TRASA_3: { fixed: { 2: 120, 3: 130, 4: 140 }, perPerson: 34 },
};

function computeInstructorPrice(trasaId, n) {
  const cfg = INSTRUCTOR_PRICING[trasaId];
  if (!cfg) return { total: 0, unit: 0, mode: 'fixed', billedFor: 2 };
  const billed = Math.max(2, n);
  if (billed <= 4) {
    return { total: cfg.fixed[billed], unit: cfg.fixed[billed], mode: 'fixed', billedFor: billed };
  }
  return { total: billed * cfg.perPerson, unit: cfg.perPerson, mode: 'perPerson', billedFor: billed };
}

const BIKE_PRICES = {
  KLASIK: { NAVRAT: 8,  KRATKODOBO: 4,  DEN: 15 },
  EBIKE:  { NAVRAT: 20, KRATKODOBO: 25, DEN: 40 },
};

const BIKE_TARIFFS = [
  { id: 'NAVRAT',     label: { sk: 'Návrat po splave (~10 km / 1 h)', en: 'Return after rafting (~10 km / 1 h)' } },
  { id: 'KRATKODOBO', label: { sk: 'Krátkodobo (Klasik 1h / E-bike 2h)', en: 'Short-term (Classic 1h / E-bike 2h)' } },
  { id: 'DEN',        label: { sk: 'Celodenný prenájom', en: 'Full-day rental' } },
];

const EXTRAS = {
  CHILD_SEAT:    { price: 5,  unit: 'pcs', isPlaceholder: true, label: { sk: 'Detská sedačka na bicykel', en: 'Child bike seat' } },
  CHILD_TRAILER: { price: 10, unit: 'pcs', isPlaceholder: true, label: { sk: 'Detský vozík (chariot)',     en: 'Child trailer / chariot' } },
  TAXI:          { price: 8,  unit: 'pax', isPlaceholder: true, label: { sk: 'Taxi späť (na osobu)',       en: 'Taxi back (per person)' } },
};

const EQUIPMENT = {
  HELMET:  { price: 0, unit: 'pcs', free: true, label: { sk: 'Prilba',           en: 'Helmet' } },
  VEST:    { price: 0, unit: 'pcs', free: true, label: { sk: 'Záchranná vesta',  en: 'Life vest' } },
  PADDLE:  { price: 0, unit: 'pcs', free: true, label: { sk: 'Pádlo',            en: 'Paddle' } },
  DRYBAG:  { price: 0, unit: 'pcs', free: true, label: { sk: 'Vodotesná taška',  en: 'Dry bag' } },
  BARREL:  { price: 0, unit: 'pcs', free: true, label: { sk: 'Barel',            en: 'Barrel' } },
};

const ID_TYPES = [
  { id: 'ID',       label: { sk: 'Občiansky preukaz', en: 'ID card' } },
  { id: 'PASSPORT', label: { sk: 'Cestovný pas',      en: 'Passport' } },
  { id: 'LICENCE',  label: { sk: 'Vodičský preukaz',  en: 'Driving licence' } },
];

const COUNTRIES = [
  // Susedné krajiny
  'Slovensko / Slovakia',
  'Česko / Czechia',
  'Poľsko / Poland',
  'Maďarsko / Hungary',
  'Rakúsko / Austria',
  'Nemecko / Germany',
  'Ukrajina / Ukraine',

  // Ostatné krajiny EÚ
  'Belgicko / Belgium',
  'Bulharsko / Bulgaria',
  'Chorvátsko / Croatia',
  'Cyprus / Cyprus',
  'Dánsko / Denmark',
  'Estónsko / Estonia',
  'Fínsko / Finland',
  'Francúzsko / France',
  'Grécko / Greece',
  'Holandsko / Netherlands',
  'Írsko / Ireland',
  'Litva / Lithuania',
  'Lotyšsko / Latvia',
  'Luxembursko / Luxembourg',
  'Malta / Malta',
  'Portugalsko / Portugal',
  'Rumunsko / Romania',
  'Slovinsko / Slovenia',
  'Španielsko / Spain',
  'Švédsko / Sweden',
  'Taliansko / Italy',

  // Balkánske krajiny (mimo EÚ)
  'Albánsko / Albania',
  'Bosna a Hercegovina / Bosnia and Herzegovina',
  'Čierna Hora / Montenegro',
  'Kosovo / Kosovo',
  'Severné Macedónsko / North Macedonia',
  'Srbsko / Serbia',

  // Ostatná Európa
  'Bielorusko / Belarus',
  'Moldavsko / Moldova',
  'Nórsko / Norway',
  'Rusko / Russia',
  'Švajčiarsko / Switzerland',
  'Turecko / Turkey',
  'Veľká Británia / UK',

  // Mimo Európy
  'India / India',
  'Izrael / Israel',
  'USA',
];

const T = {
  nav_checkin:    { sk: 'Nová objednávka',     en: 'New order' },
  nav_orders:     { sk: 'Objednávky',           en: 'Orders' },
  nav_calendar:   { sk: 'Kalendár',             en: 'Calendar' },
  nav_summary:    { sk: 'Denný prehľad',        en: 'Daily summary' },
  save:           { sk: 'Uložiť',               en: 'Save' },
  cancel:         { sk: 'Zrušiť',               en: 'Cancel' },
  print:          { sk: 'Tlač (2 kópie)',       en: 'Print (2 copies)' },
  export_json:    { sk: 'Exportovať JSON',      en: 'Export JSON' },
  total:          { sk: 'Spolu',                en: 'Total' },
  subtotal:       { sk: 'Medzisúčet',           en: 'Subtotal' },
  adjustment:     { sk: 'Manuálna úprava',      en: 'Manual adjustment' },
  final_total:    { sk: 'Konečná suma',         en: 'Final amount' },
  qty:            { sk: 'Počet',                en: 'Qty' },
  unit_price:     { sk: 'Cena/ks',              en: 'Unit price' },
  amount:         { sk: 'Suma',                 en: 'Amount' },
  item:           { sk: 'Položka',              en: 'Item' },
  remove:         { sk: 'Odstrániť',            en: 'Remove' },
  add_item:       { sk: 'Pridať položku',       en: 'Add item' },
  notes:          { sk: 'Poznámky',             en: 'Notes' },
  s1_title:       { sk: 'Údaje zákazníka',     en: 'Customer details' },
  s1_sub:         { sk: 'Hlavná osoba prenajímateľa.', en: 'Renter (responsible person).' },
  name:           { sk: 'Meno',                 en: 'First name' },
  surname:        { sk: 'Priezvisko',           en: 'Surname' },
  country:        { sk: 'Krajina',              en: 'Country' },
  id_type:        { sk: 'Typ dokladu',          en: 'ID type' },
  id_code:        { sk: 'Číslo dokladu',        en: 'ID number' },
  address:        { sk: 'Bydlisko / Adresa',    en: 'Address' },
  phone:          { sk: 'Telefón',              en: 'Phone' },
  s2_title:       { sk: 'Osoby & trasa lodí',   en: 'People & boat route' },
  s2_sub:         { sk: 'Trasa platí pre lode aj inštruktorský splav — výbery sú prepojené.',
                    en: 'Route applies to both boat rental and instructor rafting — selections are linked.' },
  route:          { sk: 'Trasa',                en: 'Route' },
  adults:         { sk: 'Dospelí',              en: 'Adults' },
  kids:           { sk: 'Deti',                 en: 'Children' },
  s3_title:       { sk: 'Služby',               en: 'Services' },
  s3_sub:         { sk: 'Zaškrtni, čo si zákazník objednáva.', en: 'Tick what the customer is ordering.' },
  svc_instructor: { sk: 'Splav s inštruktorom', en: 'Rafting with instructor' },
  svc_instructor_d: { sk: 'Skupina 2-4 os: fixná cena. 5+ os: cena na osobu. Výstroj v cene.',
                      en: 'Group of 2-4: fixed price. 5+: per-person. Equipment included.' },
  svc_boats:      { sk: 'Požičovňa lodí a raftov', en: 'Boat & raft rental' },
  svc_boats_d:    { sk: 'Bez inštruktora.',     en: 'No instructor.' },
  svc_bikes:      { sk: 'Bicykle / E-bicykle',  en: 'Bikes / E-bikes' },
  svc_bikes_d:    { sk: 'Klasik aj elektrický.',en: 'Classic and electric.' },
  svc_extras:     { sk: 'Doplnky (taxi, sedačky)', en: 'Extras (taxi, seats)' },
  svc_extras_d:   { sk: 'Detská sedačka, vozík, taxi späť.', en: 'Child seat, trailer, taxi back.' },
  s4_title:       { sk: 'Výbava',               en: 'Equipment' },
  s4_sub:         { sk: 'Helmy, pádlá, tašky, barely.', en: 'Helmets, paddles, bags, barrels.' },
  s5_title:       { sk: 'Súhrn objednávky',     en: 'Order summary' },
  s5_sub:         { sk: 'Skontroluj položky, ceny môžeš upraviť priamo v tabuľke.', en: 'Review items — you can edit prices inline.' },
  override:       { sk: 'Manuálne nastaviť konečnú sumu', en: 'Manually set final amount' },
  override_hint:  { sk: 'Prepíše súčet všetkých položiek.', en: 'Overrides the calculated total.' },
  free_parking:   { sk: 'Parkovné: zdarma (10 km trasa).', en: 'Parking: free (10 km route).' },
  boat_type:      { sk: 'Typ plavidla',         en: 'Vessel type' },
  count:          { sk: 'Počet',                en: 'Count' },
  pcs:            { sk: 'ks',                   en: 'pcs' },
  ppl:            { sk: 'os.',                  en: 'pax' },
  bike_type:      { sk: 'Typ bicykla',          en: 'Bike type' },
  bike_classic:   { sk: 'Klasický',             en: 'Classic' },
  bike_electric:  { sk: 'Elektrický (e-bike)',  en: 'Electric (e-bike)' },
  tariff:         { sk: 'Tarifa',               en: 'Tariff' },
  order_no:       { sk: 'Číslo',                en: 'No.' },
  date_time:      { sk: 'Dátum a čas',          en: 'Date & time' },
  customer:       { sk: 'Zákazník',             en: 'Customer' },
  services:       { sk: 'Služby',               en: 'Services' },
  people:         { sk: 'Osoby',                en: 'People' },
  search_ph:      { sk: 'Hľadať podľa mena, krajiny, čísla…', en: 'Search by name, country, number…' },
  filter_type:    { sk: 'Typ služby',           en: 'Service type' },
  filter_all:     { sk: 'Všetky',               en: 'All' },
  no_orders:      { sk: 'Zatiaľ žiadne objednávky.', en: 'No orders yet.' },
  copy_customer:  { sk: 'Kópia — zákazník',     en: 'Copy — customer' },
  copy_office:    { sk: 'Kópia — kancelária',   en: 'Copy — office' },
  generated_at:   { sk: 'Vystavené',            en: 'Issued' },
  receipt_title:  { sk: 'Doklad o prenájme',    en: 'Rental ticket' },
  signature_customer: { sk: 'Podpis zákazníka', en: 'Customer signature' },
  signature_operator: { sk: 'Podpis obsluhy',   en: 'Operator signature' },
  print_foot:     { sk: 'Ďakujeme za návštevu! www.rafting-dunajec.sk', en: 'Thank you for your visit! www.rafting-dunajec.sk' },
  today_orders:   { sk: 'Objednávky dnes',      en: 'Orders today' },
  today_revenue:  { sk: 'Tržba dnes',           en: 'Revenue today' },
  today_people:   { sk: 'Osôb dnes',            en: 'People today' },
  avg_order:      { sk: 'Priemer / obj.',       en: 'Avg / order' },
  by_service:     { sk: 'Podľa typu služby',    en: 'By service type' },
  recent:         { sk: 'Posledné objednávky',  en: 'Recent orders' },
  new_order:      { sk: 'Nová objednávka',      en: 'New order' },
  back:           { sk: 'Späť',                 en: 'Back' },
  order_saved:    { sk: 'Objednávka uložená',   en: 'Order saved' },
  edit:           { sk: 'Upraviť',              en: 'Edit' },
  edit_mode:      { sk: 'Úprava objednávky',    en: 'Editing order' },
  edit_mode_hint: { sk: 'Zmeny prepíšu pôvodnú objednávku. Číslo objednávky a dátum vystavenia ostávajú zachované.',
                    en: 'Changes overwrite the original order. Order number and issued date stay unchanged.' },
  update:         { sk: 'Uložiť zmeny',         en: 'Save changes' },
  status:         { sk: 'Stav',                 en: 'Status' },
  completed:      { sk: 'Vybavené',             en: 'Completed' },
  pending:        { sk: 'Nevybavené',           en: 'Pending' },
  mark_completed: { sk: 'Označiť vybavené',     en: 'Mark completed' },
  mark_pending:   { sk: 'Označiť nevybavené',   en: 'Mark pending' },
  filter_status:  { sk: 'Stav',                 en: 'Status' },
  nav_pricelist:  { sk: 'Cenník',               en: 'Pricelist' },
  pricelist_title:{ sk: 'Konfigurátor cien',    en: 'Price configurator' },
  pricelist_sub:  { sk: 'Upravte ceny pre všetky služby. Zmeny sa použijú pri všetkých nových objednávkach. Existujúce objednávky ostávajú nedotknuté.',
                    en: 'Edit prices for all services. Changes apply to new orders only. Existing orders are not affected.' },
  unsaved_changes:{ sk: 'Neuložené zmeny',      en: 'Unsaved changes' },
  reset_defaults: { sk: 'Obnoviť pôvodné ceny', en: 'Reset to defaults' },
  reset_confirm:  { sk: 'Naozaj obnoviť všetky ceny na pôvodné hodnoty z PDF špecifikácie?',
                    en: 'Really reset all prices back to the PDF defaults?' },
  prices_saved:   { sk: 'Ceny uložené',         en: 'Prices saved' },
  prices_reset:   { sk: 'Ceny obnovené na pôvodné',  en: 'Prices reset to defaults' },
  section_instructor: { sk: 'Splav s inštruktorom', en: 'Rafting with instructor' },
  section_boats:      { sk: 'Požičovňa lodí a raftov', en: 'Boat & raft rental' },
  section_bikes:      { sk: 'Bicykle a elektrobicykle', en: 'Bikes & e-bikes' },
  section_extras:     { sk: 'Doplnky', en: 'Extras' },
  section_equipment:  { sk: 'Výbava', en: 'Equipment' },
  fixed_group:    { sk: 'Skupinová cena (€)',   en: 'Group price (€)' },
  per_person:     { sk: 'Na osobu (€)',         en: 'Per person (€)' },
  parking_eur:    { sk: 'Parkovné (€ / auto)',  en: 'Parking (€ / car)' },
  per_vessel:     { sk: 'Cena za plavidlo (€ / ks)', en: 'Price per vessel (€ / pc)' },
  per_person_route: { sk: 'Cena na osobu (€)',  en: 'Price per person (€)' },
  bike_classic_h: { sk: 'Klasický bicykel (€)', en: 'Classic bike (€)' },
  bike_ebike_h:   { sk: 'Elektrobicykel (€)',   en: 'E-bike (€)' },
  extras_help:    { sk: 'Tieto ceny nie sú v PDF špecifikácii — nastav ich podľa potreby.',
                    en: 'Not in the PDF spec — set as needed.' },
  equipment_note: { sk: 'Výbava je vždy zdarma — nastavuje sa iba množstvo.',
                    en: 'Equipment is always free — only quantity is recorded.' },
  view:           { sk: 'Zobraziť',             en: 'View' },
  duplicate:      { sk: 'Duplikovať',           en: 'Duplicate' },
  delete:         { sk: 'Vymazať',              en: 'Delete' },
  confirm_delete: { sk: 'Naozaj vymazať túto objednávku?', en: 'Really delete this order?' },
  required_warn:  { sk: 'Vyplň aspoň meno alebo priezvisko zákazníka.', en: 'Fill in at least a first name or surname.' },
  operator:       { sk: 'Obsluha',              en: 'Operator' },
  placeholder_note:{sk: '⚠︎ Cena nebola v špecifikácii — uprav podľa potreby.', en: '⚠︎ Price not in spec — edit if needed.' },
  months_long:    { sk: ['Január','Február','Marec','Apríl','Máj','Jún','Júl','August','September','Október','November','December'],
                    en: ['January','February','March','April','May','June','July','August','September','October','November','December'] },
  dow_short:      { sk: ['Po','Ut','St','Št','Pi','So','Ne'],
                    en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
  pick_a_day:     { sk: 'Vyber deň v kalendári.', en: 'Pick a day on the calendar.' },
  no_orders_day:  { sk: 'V tento deň nie sú objednávky.', en: 'No orders on this day.' },
  today:          { sk: 'Dnes',                 en: 'Today' },
  free:           { sk: 'zdarma',               en: 'free' },
  arrival:        { sk: 'Príchod zákazníka',    en: 'Customer arrival' },
  arrival_date:   { sk: 'Dátum príchodu',       en: 'Arrival date' },
  arrival_time:   { sk: 'Čas príchodu',         en: 'Arrival time' },
  issued_at:      { sk: 'Vystavené',            en: 'Issued at' },
  parking:        { sk: 'Parkovné',             en: 'Parking' },
  cars:           { sk: 'áut',                  en: 'cars' },
  parking_free_route: { sk: 'Na tejto trase (10 km / Najobľúbenejšie) je parkovné zdarma.',
                        en: 'Parking on this route (10 km / Most popular) is free.' },
  instructor_route: { sk: 'Vyber trasu', en: 'Pick route' },
  equipment_included: { sk: 'Pádla, prilby, vesty a obal sú v cene.', en: 'Paddles, helmets, vests and cover included.' },
  group_price:    { sk: 'Skupinová cena (2-4 osoby)', en: 'Group price (2-4 people)' },
  per_person_price: { sk: 'Cena na osobu (5+ osôb)', en: 'Per-person price (5+ people)' },
  min_2_warn:     { sk: 'Minimálne 2 osoby — bude účtované za 2.', en: 'Minimum 2 people — billed for 2.' },
};

function t(key, lang) {
  const v = T[key];
  if (!v) return key;
  return v[lang] ?? v.sk;
}

const SVC_TYPES = [
  { id: 'INSTRUCTOR', label: { sk: 'Inštruktor', en: 'Instructor' } },
  { id: 'BOATS',      label: { sk: 'Lode / rafty', en: 'Boats / rafts' } },
  { id: 'BIKES',      label: { sk: 'Bicykle', en: 'Bikes' } },
  { id: 'EXTRAS',     label: { sk: 'Doplnky', en: 'Extras' } },
  { id: 'EQUIPMENT',  label: { sk: 'Výbava', en: 'Equipment' } },
];

const ROUTE_MAP_TO_INSTR = { '10KM': 'TRASA_1', '17KM': 'TRASA_2', '25KM': 'TRASA_3' };
const ROUTE_MAP_TO_BOAT  = { 'TRASA_1': '10KM', 'TRASA_2': '17KM', 'TRASA_3': '25KM' };

function resolveRouteLabel(routeId, lang) {
  if (!routeId) return '';
  const r = ROUTES.find(x => x.id === routeId);
  if (r) return `${r.km} km · ${r.label[lang]}`;
  const ir = INSTRUCTOR_ROUTES.find(x => x.id === routeId);
  if (ir) return ir.label[lang];
  return routeId;
}

// Pricing overlay: persists owner-edited prices to localStorage
const PRICING_KEY = 'rafting_dunajec_pricing_v1';

function snapshotDefaults() {
  return {
    instructor: {
      TRASA_1: { fixed: { 2: 65,  3: 70,  4: 80  }, perPerson: 18, parking: 0 },
      TRASA_2: { fixed: { 2: 85,  3: 90,  4: 110 }, perPerson: 24, parking: 5 },
      TRASA_3: { fixed: { 2: 120, 3: 130, 4: 140 }, perPerson: 34, parking: 5 },
    },
    boats: {
      LODE_2:     { '10KM': 40, '17KM': 50,  '25KM': 70  },
      LODE_3:     { '10KM': 50, '17KM': 70,  '25KM': 90  },
      RAFT_SMALL: { '10KM': 60, '17KM': 80,  '25KM': 100 },
      RAFT_LARGE: { '10KM': 12, '17KM': 16,  '25KM': 20  },
    },
    bikes: {
      KLASIK: { NAVRAT: 8,  KRATKODOBO: 4,  DEN: 15 },
      EBIKE:  { NAVRAT: 20, KRATKODOBO: 25, DEN: 40 },
    },
    extras: {
      CHILD_SEAT:    5,
      CHILD_TRAILER: 10,
      TAXI:          8,
    },
  };
}

const DEFAULT_PRICING = snapshotDefaults();

function readStoredPricing() {
  try {
    const raw = localStorage.getItem(PRICING_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function applyPricing(p) {
  Object.entries(p.instructor || {}).forEach(([id, cfg]) => {
    if (INSTRUCTOR_PRICING[id]) {
      INSTRUCTOR_PRICING[id].fixed = { ...INSTRUCTOR_PRICING[id].fixed, ...cfg.fixed };
      if (cfg.perPerson != null) INSTRUCTOR_PRICING[id].perPerson = cfg.perPerson;
    }
    const ir = INSTRUCTOR_ROUTES.find(r => r.id === id);
    if (ir && cfg.parking != null) ir.parking = cfg.parking;
  });
  Object.entries(p.boats || {}).forEach(([code, routes]) => {
    if (!BOAT_PRICES[code]) return;
    Object.entries(routes).forEach(([rk, v]) => { BOAT_PRICES[code][rk] = v; });
  });
  Object.entries(p.bikes || {}).forEach(([type, tariffs]) => {
    if (!BIKE_PRICES[type]) return;
    Object.entries(tariffs).forEach(([tk, v]) => { BIKE_PRICES[type][tk] = v; });
  });
  Object.entries(p.extras || {}).forEach(([code, v]) => {
    if (EXTRAS[code]) EXTRAS[code].price = v;
  });
}

function getCurrentPricing() {
  return {
    instructor: Object.fromEntries(Object.entries(INSTRUCTOR_PRICING).map(([id, cfg]) => {
      const ir = INSTRUCTOR_ROUTES.find(r => r.id === id);
      return [id, { fixed: { ...cfg.fixed }, perPerson: cfg.perPerson, parking: ir ? ir.parking : 0 }];
    })),
    boats: Object.fromEntries(Object.entries(BOAT_PRICES).map(([code, cfg]) => [code,
      { '10KM': cfg['10KM'], '17KM': cfg['17KM'], '25KM': cfg['25KM'] }])),
    bikes: Object.fromEntries(Object.entries(BIKE_PRICES).map(([type, t]) => [type, { ...t }])),
    extras: Object.fromEntries(Object.entries(EXTRAS).map(([code, cfg]) => [code, cfg.price])),
  };
}

function savePricing(p) {
  applyPricing(p);
  localStorage.setItem(PRICING_KEY, JSON.stringify(p));
}

function resetPricing() {
  localStorage.removeItem(PRICING_KEY);
  applyPricing(DEFAULT_PRICING);
}

// Apply stored overrides on import
(function initPricing() {
  const stored = readStoredPricing();
  if (stored) applyPricing(stored);
})();

export {
  ROUTES, BOAT_PRICES, INSTRUCTOR_ROUTES, INSTRUCTOR_PRICING, computeInstructorPrice,
  BIKE_PRICES, BIKE_TARIFFS,
  EXTRAS, EQUIPMENT, ID_TYPES, COUNTRIES, SVC_TYPES,
  T, t, resolveRouteLabel, ROUTE_MAP_TO_INSTR, ROUTE_MAP_TO_BOAT,
  DEFAULT_PRICING, getCurrentPricing, savePricing, resetPricing,
};
