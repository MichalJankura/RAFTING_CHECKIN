// ============================================================
// RAFTING DUNAJEC — Check-in form
// ============================================================
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icon } from './icons.jsx';
import { ScanIdModal } from './ScanIdModal.jsx';
import {
  ROUTES, INSTRUCTOR_ROUTES, INSTRUCTOR_PRICING, BOAT_PRICES,
  BIKE_PRICES, BIKE_TARIFFS, EXTRAS, EQUIPMENT, COUNTRIES, ID_TYPES,
  ROUTE_MAP_TO_INSTR, ROUTE_MAP_TO_BOAT,
  t, computeInstructorPrice,
} from './catalog.jsx';
import {
  createOrder, updateOrder, loadOperator,
  roundPrice, sanitizeName, sanitizePhone, sanitizeIdCode,
  sanitizeAddress, sanitizeNotes, clampInt, fmtMoney,
} from './storage.jsx';

// Helper: stepper input — supports hold-to-repeat with accelerating interval.
const Stepper = ({ value, onChange, min = 0, max = 999 }) => {
  const valueRef = useRef(value);
  useEffect(() => {valueRef.current = value;}, [value]);

  const timerRef = useRef(null);
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const step = (delta) => onChange(clamp((valueRef.current || 0) + delta));

  const startHold = (delta) => {
    step(delta);
    let interval = 220;
    const tick = () => {
      step(delta);
      interval = Math.max(45, interval - 25);
      timerRef.current = setTimeout(tick, interval);
    };
    timerRef.current = setTimeout(tick, 350);
  };
  const stopHold = () => {
    if (timerRef.current) {clearTimeout(timerRef.current);timerRef.current = null;}
  };
  useEffect(() => () => stopHold(), []);

  const holdProps = (delta) => ({
    onMouseDown: () => startHold(delta),
    onMouseUp: stopHold,
    onMouseLeave: stopHold,
    onTouchStart: (e) => {e.preventDefault();startHold(delta);},
    onTouchEnd: stopHold,
    onTouchCancel: stopHold
  });

  return (
    <div className="stepper">
      <button type="button" {...holdProps(-1)}>−</button>
      <input
        type="number" inputMode="numeric" value={value} min={min} max={max}
        onChange={(e) => onChange(clampInt(e.target.value, min, max))}
        onBlur={(e) => onChange(clampInt(e.target.value, min, max))}
        onFocus={(e) => e.target.select()} />
      <button type="button" {...holdProps(+1)}>+</button>
    </div>);

};


// Helper: render a line item row (editable price + qty + remove)
function LineRow({ line, lang, onChange, onRemove }) {
  const total = (line.qty || 0) * (line.unitPrice || 0);
  const isFree = line.kind === 'EQUIPMENT';
  const isBike = line.kind === 'BIKE';
  const isInstructor = line.kind === 'INSTRUCTOR';

  const updateBike = (changes) => {
    const code = changes.code ?? line.code;
    const tariff = changes.tariff ?? line.tariff;
    const newPrice = BIKE_PRICES[code][tariff];
    const typeLabel = code === 'KLASIK' ? t('bike_classic', lang) : t('bike_electric', lang);
    const tariffLabel = BIKE_TARIFFS.find((x) => x.id === tariff).label[lang];
    onChange({ ...line, code, tariff, unitPrice: newPrice, label: `${typeLabel} — ${tariffLabel}` });
  };

  const updateInstructor = (changes) => {
    const route = changes.route ?? line.route;
    const people = changes.people ?? line.people ?? 2;
    const calc = computeInstructorPrice(route, people);
    const routeLabel = INSTRUCTOR_ROUTES.find((r) => r.id === route)?.label[lang] || route;
    onChange({
      ...line,
      route, people: calc.billedFor, mode: calc.mode,
      qty: calc.mode === 'fixed' ? 1 : calc.billedFor,
      unitPrice: calc.mode === 'fixed' ? calc.total : calc.unit,
      label: calc.mode === 'fixed' ?
      `${t('svc_instructor', lang)} — ${routeLabel} (${calc.billedFor} ${t('ppl', lang)})` :
      `${t('svc_instructor', lang)} — ${routeLabel}`
    });
  };

  return (
    <tr>
      <td>
        <div className="line-name">{line.label}</div>
        {isInstructor &&
        <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={line.route}
          onChange={(e) => updateInstructor({ route: e.target.value })}
          style={{ fontSize: 11, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface-2)' }}>
              {INSTRUCTOR_ROUTES.map((r) =>
            <option key={r.id} value={r.id}>{r.label[lang]}</option>
            )}
            </select>
            <span className="muted-text" style={{ fontSize: 11 }}>
              {line.mode === 'fixed' || line.mode == null ?
            lang === 'sk' ? 'skupina' : 'group' :
            lang === 'sk' ? '/ osoba' : '/ person'}
            </span>
          </div>
        }
        {isBike &&
        <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <select value={line.code}
          onChange={(e) => updateBike({ code: e.target.value })}
          style={{ fontSize: 11, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface-2)' }}>
              <option value="KLASIK">{t('bike_classic', lang)}</option>
              <option value="EBIKE">{t('bike_electric', lang)}</option>
            </select>
            <select value={line.tariff}
          onChange={(e) => updateBike({ tariff: e.target.value })}
          style={{ fontSize: 11, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface-2)' }}>
              {BIKE_TARIFFS.map((x) =>
            <option key={x.id} value={x.id}>
                  {x.label[lang]} · {BIKE_PRICES[line.code][x.id]} €
                </option>
            )}
            </select>
          </div>
        }
        {line.placeholder &&
        <div className="line-meta" style={{ color: 'var(--warning)' }}>
            {t('placeholder_note', lang)}
          </div>
        }
        {isFree &&
        <div className="line-meta">
            <span className="tag success" style={{ fontSize: 9, padding: '1px 6px' }}>{t('free', lang).toUpperCase()}</span>
          </div>
        }
      </td>
      <td className="num" style={{ width: 130 }}>
        {isInstructor ?
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            <Stepper value={line.people ?? line.qty ?? 2}
          min={2}
          onChange={(v) => updateInstructor({ people: v })} />
            <span className="muted-text" style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.1, textAlign: 'left' }}>
              {lang === 'sk' ? <>Počet<br />osôb</> : <>People<br />count</>}
            </span>
          </div> :

        <Stepper value={line.qty} onChange={(v) => onChange({ ...line, qty: v })} />
        }
      </td>
      <td className="num" style={{ width: 100 }}>
        {isFree ?
        <span className="muted-text mono">—</span> :

        <input className="price-edit mono"
        type="number" step="0.01" min="0"
        value={line.unitPrice}
        onChange={(e) => onChange({ ...line, unitPrice: roundPrice(e.target.value) })}
        onBlur={(e) => onChange({ ...line, unitPrice: roundPrice(e.target.value) })} />
        }
      </td>
      <td className="num mono" style={{ width: 100, fontWeight: 600 }}>
        {isFree ? <span className="muted-text">—</span> : fmtMoney(total)}
      </td>
      <td style={{ width: 40 }}>
        <button className="btn btn-sm btn-ghost" onClick={onRemove} title={t('remove', lang)}>
          <Icon name="x" size={14} />
        </button>
      </td>
    </tr>);

}

const SVC = { INSTRUCTOR: 'instructor', BOATS: 'boats', BIKES: 'bikes', EXTRAS: 'extras', EQUIPMENT: 'equipment' };

function ServiceCard({ active, icon, name, desc, onClick }) {
  return (
    <button type="button" className={'svc-card' + (active ? ' active' : '')} onClick={onClick}>
      <div className="svc-icon"><Icon name={icon} size={18} /></div>
      <div className="svc-name">{name}</div>
      <div className="svc-desc">{desc}</div>
      <div className="svc-check">{active && <Icon name="check" size={12} />}</div>
    </button>);

}

// Parking control: shows route-derived price/car, lets owner pick how many cars
function ParkingRow({ lang, route, onAdd }) {
  const [cars, setCars] = useState(1);
  const irId = ROUTE_MAP_TO_INSTR[route];
  const ir = INSTRUCTOR_ROUTES.find((r) => r.id === irId);
  const unit = ir?.parking ?? 0;
  const isFree = unit === 0;
  const total = unit * cars;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-sm)',
      padding: '10px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap'
    }}>
      <Icon name="car" size={16} style={{ color: 'var(--primary)' }} />
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{t('parking', lang)}</div>
        <div className="muted-text" style={{ fontSize: 11 }}>
          {isFree ?
          t('parking_free_route', lang) :
          `${unit} € / ${lang === 'sk' ? 'auto' : 'car'} · ${ROUTES.find((r) => r.id === route)?.km} km`}
        </div>
      </div>
      <Stepper value={cars} min={1} onChange={setCars} />
      <span className="muted-text" style={{ fontSize: 11 }}>{t('cars', lang)}</span>
      <div className="mono" style={{ fontWeight: 600, minWidth: 60, textAlign: 'right' }}>
        {isFree ? <span className="muted-text">{t('free', lang)}</span> : fmtMoney(total)}
      </div>
      <button className="btn btn-sm btn-primary" onClick={() => onAdd(cars)}>
        <Icon name="plus" size={11} /> {t('add_item', lang)}
      </button>
    </div>);

}

// Equipment row: each item shows its own qty stepper, price, and Add button
function EquipmentGrid({ lang, adults, kids, onAdd, onAddAll }) {
  const defaultQty = Math.max(1, adults + kids);
  const [qtys, setQtys] = useState(() =>
  Object.fromEntries(Object.keys(EQUIPMENT).map((k) => [k, defaultQty]))
  );

  const prevDefault = useRef(defaultQty);
  useEffect(() => {
    setQtys((cur) => {
      const next = { ...cur };
      Object.keys(EQUIPMENT).forEach((k) => {
        if (cur[k] === prevDefault.current) next[k] = defaultQty;
      });
      return next;
    });
    prevDefault.current = defaultQty;
  }, [defaultQty]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
      {Object.entries(EQUIPMENT).map(([code, cfg]) => {
        const qty = qtys[code] ?? 1;
        return (
          <div key={code} style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div className="row between" style={{ alignItems: 'baseline' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{cfg.label[lang]}</div>
              <span className="tag success" style={{ fontSize: 9 }}>{t('free', lang).toUpperCase()}</span>
            </div>
            <div className="row between" style={{ gap: 8 }}>
              <Stepper value={qty} onChange={(v) => setQtys({ ...qtys, [code]: v })} min={1} />
              <button className="btn btn-sm btn-primary" onClick={() => onAdd(code, qty)}>
                <Icon name="plus" size={11} /> {t('add_item', lang)}
              </button>
            </div>
          </div>);
      })}
      <button type="button" onClick={onAddAll} style={{
        background: 'var(--primary-tint)',
        border: '1.5px dashed var(--primary)',
        borderRadius: 'var(--r-sm)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        color: 'var(--primary)',
        fontFamily: 'inherit',
        minHeight: 80,
      }}>
        <Icon name="plus" size={18} />
        <div style={{ fontWeight: 600, fontSize: 13 }}>
          {lang === 'sk' ? 'Pridať všetku výbavu' : 'Add all equipment'}
        </div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          {lang === 'sk' ? 'všetko naraz' : 'all at once'}
        </div>
      </button>
    </div>);

}

function CheckIn({ lang, onSaved, prefill, isEdit, onCancelEdit }) {
  const [customer, setCustomer] = useState(prefill?.customer || {
    name: '', surname: '', country: 'Slovensko / Slovakia',
    idType: 'ID', idCode: '', address: '', phone: ''
  });
  const [route, setRouteState] = useState(prefill?.route || '17KM');
  const [instructorRoute, setInstructorRouteState] = useState(prefill?.instructorRoute || ROUTE_MAP_TO_INSTR[prefill?.route || '17KM'] || 'TRASA_2');

  const setRoute = (id) => {
    setRouteState(id);
    const ir = ROUTE_MAP_TO_INSTR[id];
    if (ir) setInstructorRouteState(ir);
  };
  const setInstructorRoute = (id) => {
    setInstructorRouteState(id);
    const br = ROUTE_MAP_TO_BOAT[id];
    if (br) setRouteState(br);
  };

  const defaultArrival = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() < 30 ? 30 : 0, 0, 0);
    if (d.getMinutes() === 0) d.setHours(d.getHours() + 1);
    return d;
  };
  const initialArrival = prefill?.arrivalAt ? new Date(prefill.arrivalAt) : defaultArrival();
  const [arrivalDate, setArrivalDate] = useState(
    `${initialArrival.getFullYear()}-${String(initialArrival.getMonth() + 1).padStart(2, '0')}-${String(initialArrival.getDate()).padStart(2, '0')}`
  );
  const [arrivalTime, setArrivalTime] = useState(
    `${String(initialArrival.getHours()).padStart(2, '0')}:${String(initialArrival.getMinutes()).padStart(2, '0')}`
  );
  const [adults, setAdults] = useState(prefill?.adults ?? 2);
  const [kids, setKids] = useState(prefill?.kids ?? 0);
  const [activeSvc, setActiveSvc] = useState(new Set(prefill ? [] : ['instructor']));
  const [lines, setLines] = useState(prefill?.lines || []);
  const [manualAdj, setManualAdj] = useState(prefill?.manualAdjustment || 0);
  const [override, setOverride] = useState(prefill?.manualTotalOverride ?? null);
  const [notes, setNotes] = useState(prefill?.notes || '');
  const [saving, setSaving] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const lineIdRef = useRef(lines.length ? Math.max(...lines.map((l) => l.id || 0)) + 1 : 1);

  const toggleSvc = (key) => {
    const next = new Set(activeSvc);
    next.has(key) ? next.delete(key) : next.add(key);
    setActiveSvc(next);
  };

  const newLineId = () => lineIdRef.current++;

  const addLine = (line) => setLines((cur) => [...cur, { id: newLineId(), ...line }]);
  const updateLine = (id, updated) => setLines((cur) => cur.map((l) => l.id === id ? updated : l));
  const removeLine = (id) => setLines((cur) => cur.filter((l) => l.id !== id));

  const addInstructor = () => {
    const n = Math.max(1, adults + kids);
    const calc = computeInstructorPrice(instructorRoute, n);
    const routeLabel = INSTRUCTOR_ROUTES.find((r) => r.id === instructorRoute).label[lang];
    addLine({
      kind: 'INSTRUCTOR',
      route: instructorRoute,
      people: calc.billedFor,
      qty: calc.mode === 'fixed' ? 1 : calc.billedFor,
      unitPrice: calc.mode === 'fixed' ? calc.total : calc.unit,
      mode: calc.mode,
      label: calc.mode === 'fixed' ?
      `${t('svc_instructor', lang)} — ${routeLabel} (${calc.billedFor} ${t('ppl', lang)})` :
      `${t('svc_instructor', lang)} — ${routeLabel}`
    });
  };

  const [boatCode, setBoatCode] = useState('LODE_2');
  const addBoat = () => {
    const cfg = BOAT_PRICES[boatCode];
    const price = cfg[route];
    const qty = cfg.perPerson ? Math.max(1, adults + kids) : 1;
    addLine({
      kind: 'BOAT', code: boatCode, route, qty, unitPrice: price,
      label: `${cfg.label[lang]} — ${route.replace('KM', ' km')}`,
      perPerson: cfg.perPerson
    });
  };

  const [bikeType, setBikeType] = useState('KLASIK');
  const [bikeTariff, setBikeTariff] = useState('NAVRAT');
  const addBike = () => {
    const price = BIKE_PRICES[bikeType][bikeTariff];
    const typeLabel = bikeType === 'KLASIK' ? t('bike_classic', lang) : t('bike_electric', lang);
    const tariffLabel = BIKE_TARIFFS.find((x) => x.id === bikeTariff).label[lang];
    addLine({
      kind: 'BIKE', code: bikeType, tariff: bikeTariff, qty: 1, unitPrice: price,
      label: `${typeLabel} — ${tariffLabel}`
    });
  };

  const addExtra = (code) => {
    const cfg = EXTRAS[code];
    addLine({
      kind: 'EXTRA', code, qty: 1, unitPrice: cfg.price,
      label: cfg.label[lang], placeholder: cfg.isPlaceholder
    });
  };
  const addParking = (cars) => {
    const irId = ROUTE_MAP_TO_INSTR[route];
    const ir = INSTRUCTOR_ROUTES.find((r) => r.id === irId);
    const unit = ir?.parking ?? 0;
    addLine({
      kind: 'PARKING',
      route,
      qty: cars,
      unitPrice: unit,
      label: `${t('parking', lang)} — ${ROUTES.find((r) => r.id === route)?.km} km${unit === 0 ? ' · ' + t('free', lang) : ''}`
    });
  };
  const addEquipment = (code, qty) => {
    const cfg = EQUIPMENT[code];
    const q = qty != null ? qty : Math.max(1, adults + kids);
    addLine({
      kind: 'EQUIPMENT', code, qty: q, unitPrice: cfg.price,
      label: cfg.label[lang], placeholder: cfg.isPlaceholder
    });
  };

  const addAllEquipment = () => {
    const qty = Math.max(1, adults + kids);
    Object.keys(EQUIPMENT).forEach(code => addEquipment(code, qty));
  };

  const subtotal = lines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0);
  const computed = subtotal + (manualAdj || 0);
  const finalAmount = override != null ? override : computed;

  const canSave = customer.name.trim() && customer.surname.trim() && lines.length > 0;

  const save = async () => {
    if (!canSave) { alert(t('required_warn', lang)); return; }
    if (!arrivalDate || !arrivalTime) {
      alert(lang === 'sk' ? 'Vyplň dátum a čas príchodu.' : 'Fill in arrival date and time.');
      return;
    }
    setSaving(true);
    const payload = {
      arrivalAt: new Date(`${arrivalDate}T${arrivalTime}`).toISOString(),
      customer, route, adults, kids,
      lines: lines.map((l) => ({ ...l })),
      manualAdjustment: manualAdj || 0,
      manualTotalOverride: override,
      notes,
      operator: loadOperator(),
    };
    try {
      const saved = isEdit && prefill?.id
        ? await updateOrder({ ...payload, id: prefill.id })
        : await createOrder({ ...payload, id: 'o-' + Date.now() });
      onSaved(saved);
    } catch (e) {
      alert(lang === 'sk' ? 'Chyba pri ukladaní: ' + e.message : 'Save error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {isEdit &&
      <div className="notice info" style={{ marginBottom: 14, padding: '14px 18px', background: 'var(--accent-tint)', borderColor: '#e9c2a8', color: '#8b3d1c' }}>
          <Icon name="edit" size={16} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              {t('edit_mode', lang)} · <span className="mono">#{prefill.number}</span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{t('edit_mode_hint', lang)}</div>
          </div>
          <button className="btn btn-sm" onClick={onCancelEdit} style={{ background: '#fff' }}>
            <Icon name="x" size={12} /> {t('cancel', lang)}
          </button>
        </div>
      }

      {/* ============ STEP 1: Customer ============ */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title"><span className="step-num">1</span> {t('s1_title', lang)}</div>
            <div className="card-sub">{t('s1_sub', lang)}</div>
          </div>
          <div className="row" style={{ gap: 8, flexShrink: 0 }}>
            <button type="button" className="btn btn-sm"
              style={{ gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
              onClick={() => setShowScanModal(true)}>
              <Icon name="scan" size={13} />
              {lang === 'sk' ? 'Skenovať / Načítať doklad' : 'Scan ID / Load ID'}
            </button>
            <button type="button" className="btn btn-sm"
              style={{ gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
              onClick={() => {}}>
              <Icon name="mail" size={13} />
              {lang === 'sk' ? 'Načítať objednávku z mailu' : 'Load order from mail'}
            </button>
          </div>
        </div>
        <div className="grid-3">
          <div className="field">
            <label>{t('name', lang)}<span className="req">*</span></label>
            <input value={customer.name}
            onChange={(e) => setCustomer({ ...customer, name: sanitizeName(e.target.value) })}
            maxLength={60}
            autoComplete="given-name"
            placeholder="Jana" />
          </div>
          <div className="field">
            <label>{t('surname', lang)}<span className="req">*</span></label>
            <input value={customer.surname}
            onChange={(e) => setCustomer({ ...customer, surname: sanitizeName(e.target.value).slice(0, 20) })}
            maxLength={20}
            autoComplete="family-name"
            placeholder="Horváthová" />
          </div>
          <div className="field">
            <label>{t('country', lang)}</label>
            <select value={customer.country} onChange={(e) => setCustomer({ ...customer, country: e.target.value })}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('id_type', lang)}</label>
            <select value={customer.idType} onChange={(e) => setCustomer({ ...customer, idType: e.target.value })}>
              {ID_TYPES.map((x) => <option key={x.id} value={x.id}>{x.label[lang]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('id_code', lang)}</label>
            <input value={customer.idCode}
            onChange={(e) => setCustomer({ ...customer, idCode: sanitizeIdCode(e.target.value) })}
            maxLength={30}
            placeholder="EA123456" />
          </div>
          <div className="field">
            <label>{t('phone', lang)}</label>
            <input value={customer.phone}
            onChange={(e) => setCustomer({ ...customer, phone: sanitizePhone(e.target.value) })}
            type="tel" inputMode="tel" maxLength={25}
            autoComplete="tel"
            placeholder="+421 …" />
          </div>
          <div className="field" style={{ gridColumn: 'span 3' }}>
            <label>{t('address', lang)}</label>
            <input value={customer.address}
            onChange={(e) => setCustomer({ ...customer, address: sanitizeAddress(e.target.value) })}
            maxLength={150}
            autoComplete="street-address"
            placeholder="Mesto, ulica…" />
          </div>
        </div>
      </div>

      {/* ============ STEP 2: Route & people ============ */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title"><span className="step-num">2</span> {t('s2_title', lang)}</div>
            <div className="card-sub">{t('s2_sub', lang)}</div>
          </div>
        </div>

        {/* Arrival date/time */}
        <div className="row arrival-row" style={{ alignItems: 'flex-end', gap: 14, marginBottom: 16, padding: '12px 14px', background: 'var(--primary-tint)', borderRadius: 'var(--r-sm)', border: '1px solid #c0d6cf' }}>
          <Icon name="calendar" size={18} style={{ color: 'var(--primary)', marginBottom: 6 }} />
          <div className="field" style={{ flex: 1 }}>
            <label>{t('arrival_date', lang)}<span className="req">*</span></label>
            <input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
          </div>
          <div className="field" style={{ width: 140 }}>
            <label>{t('arrival_time', lang)}<span className="req">*</span></label>
            <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} />
          </div>
          <div className="muted-text" style={{ fontSize: 12, paddingBottom: 10 }}>
            {lang === 'sk' ? 'Kedy zákazník príde.' : 'When the customer arrives.'}
          </div>
        </div>

        <div className="row" style={{ flexWrap: 'wrap', gap: 22 }}>
          <div className="field" style={{ flex: 1, minWidth: 320 }}>
            <label>{t('route', lang)}</label>
            <div className="pill-row">
              {ROUTES.map((r) => {
                const ir = INSTRUCTOR_ROUTES.find((x) => x.id === ROUTE_MAP_TO_INSTR[r.id]);
                return (
                  <button key={r.id} className={'pill' + (route === r.id ? ' active' : '')} onClick={() => setRoute(r.id)}>
                    {r.km} km · {r.hours} · {r.label[lang]}
                    {ir && <span style={{ opacity: 0.6, marginLeft: 6, fontSize: 11 }}>· {ir.label[lang]}</span>}
                  </button>);

              })}
            </div>
          </div>
          <div className="field" style={{ width: 130 }}>
            <label>{t('adults', lang)}</label>
            <Stepper value={adults} onChange={setAdults} />
          </div>
          <div className="field" style={{ width: 130 }}>
            <label>{t('kids', lang)}</label>
            <Stepper value={kids} onChange={setKids} />
          </div>
        </div>
        {ROUTES.find((r) => r.id === route)?.freeParking &&
        <div className="notice info" style={{ marginTop: 14, marginBottom: 0 }}>
            <Icon name="info" size={14} style={{ flex: '0 0 auto', marginTop: 2 }} />
            {t('free_parking', lang)}
          </div>
        }
      </div>

      {/* ============ STEP 3: Services ============ */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title"><span className="step-num">3</span> {t('s3_title', lang)}</div>
            <div className="card-sub">{t('s3_sub', lang)}</div>
          </div>
        </div>
        <div className="svc-grid">
          <ServiceCard active={activeSvc.has(SVC.INSTRUCTOR)} icon="instructor"
          name={t('svc_instructor', lang)} desc={t('svc_instructor_d', lang)}
          onClick={() => toggleSvc(SVC.INSTRUCTOR)} />
          <ServiceCard active={activeSvc.has(SVC.BOATS)} icon="boat"
          name={t('svc_boats', lang)} desc={t('svc_boats_d', lang)}
          onClick={() => toggleSvc(SVC.BOATS)} />
          <ServiceCard active={activeSvc.has(SVC.BIKES)} icon="bike"
          name={t('svc_bikes', lang)} desc={t('svc_bikes_d', lang)}
          onClick={() => toggleSvc(SVC.BIKES)} />
          <ServiceCard active={activeSvc.has(SVC.EXTRAS)} icon="car"
          name={t('svc_extras', lang)} desc={t('svc_extras_d', lang)}
          onClick={() => toggleSvc(SVC.EXTRAS)} />
        </div>

        {/* Instructor panel */}
        {activeSvc.has(SVC.INSTRUCTOR) && (() => {
          const n = Math.max(1, adults + kids);
          const calc = computeInstructorPrice(instructorRoute, n);
          const routeCfg = INSTRUCTOR_ROUTES.find((r) => r.id === instructorRoute);
          const pricing = INSTRUCTOR_PRICING[instructorRoute];
          return (
            <div style={{ marginTop: 16, padding: 14, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)' }}>
              <div className="row between" style={{ marginBottom: 10 }}>
                <strong>{t('svc_instructor', lang)}</strong>
                <span className="tag success">{t('equipment_included', lang)}</span>
              </div>

              <div className="field" style={{ marginBottom: 12 }}>
                <label>{t('instructor_route', lang)}</label>
                <div className="pill-row">
                  {INSTRUCTOR_ROUTES.map((r) => {
                    const boatId = ROUTE_MAP_TO_BOAT[r.id];
                    const boat = ROUTES.find((x) => x.id === boatId);
                    return (
                      <button key={r.id} className={'pill' + (instructorRoute === r.id ? ' active' : '')}
                      onClick={() => setInstructorRoute(r.id)}>
                        {r.label[lang]}
                        {boat && <span style={{ opacity: 0.7, marginLeft: 6, fontSize: 11 }}>· {boat.km} km</span>}
                      </button>);

                  })}
                </div>
              </div>

              {/* Price matrix preview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, fontSize: 11, marginBottom: 12 }}>
                {[2, 3, 4].map((k) =>
                <div key={k} style={{
                  background: 'var(--surface)',
                  border: '1px solid ' + (n === k ? 'var(--primary)' : 'var(--border)'),
                  borderRadius: 'var(--r-sm)',
                  padding: '8px 10px',
                  boxShadow: n === k ? '0 0 0 1px var(--primary) inset' : 'none'
                }}>
                    <div className="muted-text" style={{ fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{k} {t('ppl', lang)}</div>
                    <div className="mono" style={{ fontWeight: 600, marginTop: 2 }}>{pricing.fixed[k]} €</div>
                    <div className="muted-text" style={{ fontSize: 10 }}>{lang === 'sk' ? 'skupina' : 'group'}</div>
                  </div>
                )}
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid ' + (n >= 5 ? 'var(--primary)' : 'var(--border)'),
                  borderRadius: 'var(--r-sm)',
                  padding: '8px 10px',
                  boxShadow: n >= 5 ? '0 0 0 1px var(--primary) inset' : 'none'
                }}>
                  <div className="muted-text" style={{ fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>5+ {t('ppl', lang)}</div>
                  <div className="mono" style={{ fontWeight: 600, marginTop: 2 }}>{pricing.perPerson} €</div>
                  <div className="muted-text" style={{ fontSize: 10 }}>{lang === 'sk' ? '/ osoba' : '/ person'}</div>
                </div>
              </div>

              {n < 2 &&
              <div className="notice" style={{ marginBottom: 10 }}>
                  <Icon name="info" size={14} style={{ flex: '0 0 auto', marginTop: 2 }} />
                  {t('min_2_warn', lang)}
                </div>
              }

              <div className="row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <span className="muted-text" style={{ fontSize: 12 }}>
                  {routeCfg.parkingNote[lang]}
                </span>
                <span style={{ flex: 1 }} />
                <div style={{ fontSize: 13 }}>
                  <span className="muted-text">{calc.mode === 'fixed' ? t('group_price', lang) : t('per_person_price', lang)}: </span>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 16, marginLeft: 6 }}>{fmtMoney(calc.total)}</span>
                  {calc.mode === 'perPerson' &&
                  <span className="muted-text" style={{ fontSize: 11, marginLeft: 6 }}>
                      ({calc.billedFor} × {calc.unit} €)
                    </span>
                  }
                </div>
                <button className="btn btn-primary" onClick={addInstructor}>
                  <Icon name="plus" size={12} /> {t('add_item', lang)}
                </button>
              </div>
            </div>);

        })()}

        {/* Boats panel */}
        {activeSvc.has(SVC.BOATS) &&
        <div style={{ marginTop: 12, padding: 14, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)' }}>
            <div className="row" style={{ marginBottom: 10 }}>
              <strong>{t('svc_boats', lang)}</strong>
            </div>
            <div className="grid-3">
              <div className="field">
                <label>{t('boat_type', lang)}</label>
                <select value={boatCode} onChange={(e) => setBoatCode(e.target.value)}>
                  {Object.entries(BOAT_PRICES).map(([k, v]) =>
                <option key={k} value={k}>{v.label[lang]}</option>
                )}
                </select>
              </div>
              <div className="field">
                <label>{t('unit_price', lang)}</label>
                <div style={{ padding: '9px 11px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-mono)' }}>
                  {BOAT_PRICES[boatCode][route]} € / {BOAT_PRICES[boatCode].perPerson ? t('ppl', lang) : t('pcs', lang)}
                </div>
              </div>
              <div className="field" style={{ justifyContent: 'end' }}>
                <button className="btn btn-primary" onClick={addBoat} style={{ marginTop: 18 }}>
                  <Icon name="plus" size={12} /> {t('add_item', lang)}
                </button>
              </div>
            </div>
          </div>
        }

        {/* Bikes panel */}
        {activeSvc.has(SVC.BIKES) &&
        <div style={{ marginTop: 12, padding: 14, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)' }}>
            <div className="row" style={{ marginBottom: 10 }}>
              <strong>{t('svc_bikes', lang)}</strong>
            </div>
            <div className="grid-3">
              <div className="field">
                <label>{t('bike_type', lang)}</label>
                <div className="pill-row">
                  <button className={'pill' + (bikeType === 'KLASIK' ? ' active' : '')} onClick={() => setBikeType('KLASIK')}>{t('bike_classic', lang)}</button>
                  <button className={'pill' + (bikeType === 'EBIKE' ? ' active' : '')} onClick={() => setBikeType('EBIKE')}>{t('bike_electric', lang)}</button>
                </div>
              </div>
              <div className="field">
                <label>{t('tariff', lang)}</label>
                <select value={bikeTariff} onChange={(e) => setBikeTariff(e.target.value)}>
                  {BIKE_TARIFFS.map((x) => <option key={x.id} value={x.id}>{x.label[lang]} — {BIKE_PRICES[bikeType][x.id]} €</option>)}
                </select>
              </div>
              <div className="field" style={{ justifyContent: 'end' }}>
                <button className="btn btn-primary" onClick={addBike} style={{ marginTop: 18 }}>
                  <Icon name="plus" size={12} /> {t('add_item', lang)} · {BIKE_PRICES[bikeType][bikeTariff]} €
                </button>
              </div>
            </div>
          </div>
        }

        {/* Extras panel */}
        {activeSvc.has(SVC.EXTRAS) &&
        <div style={{ marginTop: 12, padding: 14, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)' }}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <strong>{t('svc_extras', lang)}</strong>
              <span className="tag accent">⚠︎ {t('placeholder_note', lang)}</span>
            </div>
            <div className="pill-row">
              {Object.entries(EXTRAS).map(([code, cfg]) =>
            <button key={code} className="pill" onClick={() => addExtra(code)}>
                  <Icon name="plus" size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
                  {cfg.label[lang]} · {cfg.price} €
                </button>
            )}
            </div>
          </div>
        }
      </div>

      {/* ============ STEP 4: Equipment ============ */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title"><span className="step-num">4</span> {t('s4_title', lang)}</div>
            <div className="card-sub">
              {lang === 'sk' ?
              'Helmy, vesty, pádlá, tašky, barely — zadarmo. Iba zaeviduj koľko kusov sa požičiava.' :
              'Helmets, vests, paddles, bags, barrels — free. Just record how many pieces are being lent out.'}
            </div>
          </div>
          <span className="tag success">{t('free', lang).toUpperCase()}</span>
        </div>
        <EquipmentGrid lang={lang} adults={adults} kids={kids} onAdd={addEquipment} onAddAll={addAllEquipment} />
      </div>

      {/* ============ Parking (always visible) ============ */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, background: 'var(--ink)', color: '#fff', borderRadius: '50%' }}>
                <Icon name="car" size={12} />
              </span>
              {t('parking', lang)}
            </div>
            <div className="card-sub">
              {lang === 'sk' ?
              'Počet áut zadáva obsluha ručne. Cena sa odvíja od zvolenej trasy.' :
              'Operator enters car count manually. Price depends on selected route.'}
            </div>
          </div>
        </div>
        <ParkingRow lang={lang} route={route} onAdd={addParking} />
      </div>
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title"><span className="step-num">5</span> {t('s5_title', lang)}</div>
            <div className="card-sub">{t('s5_sub', lang)}</div>
          </div>
        </div>

        {lines.length === 0 ?
        <div className="empty">
            {lang === 'sk' ? 'Zatiaľ žiadne položky. Pridaj služby z krokov vyššie.' : 'No items yet. Add services above.'}
          </div> :

        <div className="table-wrap">
          <table className="line-table">
              <thead>
                <tr>
                  <th>{t('item', lang)}</th>
                  <th className="num">{t('qty', lang)}</th>
                  <th className="num">{t('unit_price', lang)}</th>
                  <th className="num">{t('amount', lang)}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) =>
              <LineRow key={l.id} line={l} lang={lang}
              onChange={(u) => updateLine(l.id, u)}
              onRemove={() => removeLine(l.id)} />
              )}
              </tbody>
            </table>
          </div>
        }

        {lines.length > 0 &&
        <>
            <hr className="hairline" />
            <div className="totals-row">
              <span>{t('subtotal', lang)}</span>
              <span className="mono">{fmtMoney(subtotal)}</span>
            </div>
            <div className="totals-row" style={{ paddingBottom: 0 }}>
              <span>{t('adjustment', lang)}
                <span className="muted-text" style={{ marginLeft: 8 }}>
                  ({lang === 'sk' ? 'zľava / príplatok' : 'discount / surcharge'})
                </span>
              </span>
              <input type="number" step="0.01" className="mono"
            value={manualAdj}
            onChange={(e) => setManualAdj(roundPrice(e.target.value))}
            onBlur={(e) => setManualAdj(roundPrice(e.target.value))}
            style={{ width: 100, textAlign: 'right', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface-2)' }} />
            </div>

            <div className="totals-row grand">
              <span>{t('final_total', lang)}</span>
              <span>
                {override != null ?
              <input type="number" step="0.01" min="0" className="mono amount"
              value={override}
              onChange={(e) => setOverride(roundPrice(e.target.value))}
              onBlur={(e) => setOverride(roundPrice(e.target.value))}
              style={{ width: 140, textAlign: 'right', fontSize: 18, fontWeight: 700, border: '1px solid var(--accent)', borderRadius: 4, padding: '4px 8px', background: 'var(--accent-tint)' }} /> :

              <span className="amount">{fmtMoney(finalAmount)}</span>
              }
              </span>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <span className="muted-text">{t('override', lang)}</span>
              <div className={'switch' + (override != null ? ' on' : '')}
            onClick={() => setOverride(override != null ? null : Math.round(computed * 100) / 100)} />
            </div>
            {override != null &&
          <div className="muted-text" style={{ textAlign: 'right', marginTop: 4 }}>
                {t('override_hint', lang)} · {lang === 'sk' ? 'vypočítané' : 'computed'}: <span className="mono">{fmtMoney(computed)}</span>
              </div>
          }
          </>
        }

        <hr className="hairline" />
        <div className="field">
          <label>{t('notes', lang)}</label>
          <textarea rows="2" value={notes}
          onChange={(e) => setNotes(sanitizeNotes(e.target.value))}
          maxLength={500}
          placeholder={lang === 'sk' ? 'Voliteľné — napr. čas vyzdvihnutia, špeciálne požiadavky…' : 'Optional — e.g. pickup time, special requests…'}
          style={{ border: '1px solid var(--border)', padding: '9px 11px', borderRadius: 'var(--r-sm)', resize: 'vertical', width: '100%' }} />
        </div>
      </div>

      {/* Save button */}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18, gap: 10 }}>
        {isEdit &&
        <button className="btn btn-lg" onClick={onCancelEdit}>
            <Icon name="x" size={14} /> {t('cancel', lang)}
          </button>
        }
        <button className="btn btn-lg btn-accent" onClick={save} disabled={!canSave || saving}>
          <Icon name="save" size={14} /> {saving ? (lang === 'sk' ? 'Ukladám…' : 'Saving…') : isEdit ? t('update', lang) : t('save', lang)}
        </button>
      </div>

      {/* ID scan modal */}
      {showScanModal &&
      <ScanIdModal
          lang={lang}
          onApply={(fields) => {
            setCustomer((prev) => ({
              ...prev,
              ...(fields.name    ? { name:    sanitizeName(fields.name)        } : {}),
              ...(fields.surname ? { surname: sanitizeName(fields.surname).slice(0, 20) } : {}),
              ...(fields.country ? { country: fields.country                  } : {}),
              ...(fields.idCode  ? { idCode:  sanitizeIdCode(fields.idCode)   } : {}),
            }));
          }}
          onClose={() => setShowScanModal(false)}
        />
      }
    </div>);

}

export { CheckIn };
