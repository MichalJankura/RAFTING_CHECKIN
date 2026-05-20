// ============================================================
// RAFTING DUNAJEC — Pricelist (price configurator)
// ============================================================
import React, { useState, useMemo } from 'react';
import { Icon } from './icons.jsx';
import {
  INSTRUCTOR_ROUTES, BOAT_PRICES, BIKE_PRICES, BIKE_TARIFFS,
  EXTRAS, EQUIPMENT, ROUTE_MAP_TO_BOAT,
  t, DEFAULT_PRICING, getCurrentPricing, savePricing, resetPricing,
} from './catalog.jsx';
import { roundPrice } from './storage.jsx';

function PriceInput({ value, onChange, suffix = '€', width }) {
  const suffixPx = 8 + Math.max(1, suffix.length) * 7;
  const w = width || (suffix.length > 2 ? 130 : 92);
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <input type="number" step="0.01" min="0" value={value}
             onChange={(e) => onChange(roundPrice(e.target.value))}
             onBlur={(e) => onChange(roundPrice(e.target.value))}
             className="mono"
             style={{
               width: w,
               border: '1px solid var(--border)',
               background: 'var(--surface)',
               padding: `7px ${suffixPx}px 7px 10px`,
               borderRadius: 'var(--r-sm)',
               fontSize: 14,
               textAlign: 'right',
               fontFamily: 'var(--font-mono)',
             }} />
      <span style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--muted)', fontSize: 12, pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>{suffix}</span>
    </div>
  );
}

function PricelistView({ lang, onChanged }) {
  const [draft, setDraft] = useState(() => getCurrentPricing());
  const [saved, setSaved] = useState(() => JSON.stringify(getCurrentPricing()));
  const dirty = JSON.stringify(draft) !== saved;

  const setInstructor = (id, field, value) =>
    setDraft(d => ({ ...d, instructor: { ...d.instructor, [id]: { ...d.instructor[id], [field]: value } } }));
  const setInstructorFixed = (id, n, value) =>
    setDraft(d => ({ ...d, instructor: { ...d.instructor, [id]: {
      ...d.instructor[id],
      fixed: { ...d.instructor[id].fixed, [n]: value }
    } } }));
  const setBoat = (code, route, value) =>
    setDraft(d => ({ ...d, boats: { ...d.boats, [code]: { ...d.boats[code], [route]: value } } }));
  const setBike = (type, tariff, value) =>
    setDraft(d => ({ ...d, bikes: { ...d.bikes, [type]: { ...d.bikes[type], [tariff]: value } } }));
  const setExtra = (code, value) =>
    setDraft(d => ({ ...d, extras: { ...d.extras, [code]: value } }));

  const save = () => {
    savePricing(draft);
    setSaved(JSON.stringify(draft));
    if (onChanged) onChanged('saved');
  };
  const reset = () => {
    if (!confirm(t('reset_confirm', lang))) return;
    resetPricing();
    const fresh = getCurrentPricing();
    setDraft(fresh);
    setSaved(JSON.stringify(fresh));
    if (onChanged) onChanged('reset');
  };

  const changes = useMemo(() => {
    let n = 0;
    const dd = DEFAULT_PRICING;
    INSTRUCTOR_ROUTES.forEach(ir => {
      const cur = draft.instructor[ir.id];
      const def = dd.instructor[ir.id];
      if (cur.perPerson !== def.perPerson) n++;
      if (cur.parking !== def.parking) n++;
      [2, 3, 4].forEach(k => { if (cur.fixed[k] !== def.fixed[k]) n++; });
    });
    Object.keys(dd.boats).forEach(code => {
      ['10KM', '17KM', '25KM'].forEach(r => {
        if (draft.boats[code][r] !== dd.boats[code][r]) n++;
      });
    });
    Object.keys(dd.bikes).forEach(type => {
      ['NAVRAT', 'KRATKODOBO', 'DEN'].forEach(tariff => {
        if (draft.bikes[type][tariff] !== dd.bikes[type][tariff]) n++;
      });
    });
    Object.keys(dd.extras).forEach(code => {
      if (draft.extras[code] !== dd.extras[code]) n++;
    });
    return n;
  }, [draft]);

  return (
    <div>
      {/* ============ Sticky action bar ============ */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5,
        background: dirty ? 'var(--accent-tint)' : 'var(--surface)',
        border: '1px solid ' + (dirty ? '#e9c2a8' : 'var(--border)'),
        borderRadius: 'var(--r)',
        padding: '12px 16px',
        marginBottom: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {t('pricelist_title', lang)}
            {dirty && <span className="tag accent" style={{ marginLeft: 10, fontSize: 10 }}>● {t('unsaved_changes', lang)}</span>}
            {!dirty && changes > 0 && <span className="tag" style={{ marginLeft: 10, fontSize: 10 }}>
              {changes} {lang === 'sk' ? 'zmien oproti špecifikácii' : 'changes vs spec'}
            </span>}
          </div>
          <div className="muted-text" style={{ fontSize: 12, marginTop: 2 }}>
            {t('pricelist_sub', lang)}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={reset}>
          <Icon name="settings" size={14} /> {t('reset_defaults', lang)}
        </button>
        <button className="btn btn-accent btn-lg" onClick={save} disabled={!dirty}>
          <Icon name="save" size={14} /> {t('save', lang)}
        </button>
      </div>

      {/* ============ Instructor ============ */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">
              <span className="step-num" style={{ background: 'var(--primary)' }}><Icon name="instructor" size={11} /></span>
              {t('section_instructor', lang)}
            </div>
            <div className="card-sub">
              {lang === 'sk'
                ? 'Trasa 2-4 osôb → fixná skupinová cena. 5+ osôb → cena na osobu. Výbava (pádla, vesty, prilby, obal) v cene.'
                : 'Routes for 2-4 people use a fixed group price. 5+ people switch to per-person pricing. Equipment included.'}
            </div>
          </div>
        </div>
        <table className="line-table" style={{ marginTop: 4 }}>
          <thead>
            <tr>
              <th style={{ width: '32%' }}>{lang === 'sk' ? 'Trasa' : 'Route'}</th>
              <th className="num">2 {t('ppl', lang)}</th>
              <th className="num">3 {t('ppl', lang)}</th>
              <th className="num">4 {t('ppl', lang)}</th>
              <th className="num">5+ {t('ppl', lang)}</th>
              <th className="num">{t('parking_eur', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {INSTRUCTOR_ROUTES.map(ir => {
              const def = DEFAULT_PRICING.instructor[ir.id];
              const cur = draft.instructor[ir.id];
              const boatRoute = ROUTE_MAP_TO_BOAT[ir.id];
              return (
                <tr key={ir.id}>
                  <td>
                    <div className="line-name">{ir.label[lang]}</div>
                    <div className="line-meta">
                      <span className="mono">{ir.id}</span> · ↔ {boatRoute?.replace('KM', ' km')}
                    </div>
                  </td>
                  {[2, 3, 4].map(k => (
                    <td key={k} className="num">
                      <PriceInput value={cur.fixed[k]} onChange={(v) => setInstructorFixed(ir.id, k, v)} />
                      {cur.fixed[k] !== def.fixed[k] && (
                        <div className="muted-text" style={{ fontSize: 10, marginTop: 2 }}>
                          {lang === 'sk' ? 'pôv.' : 'def.'} {def.fixed[k]} €
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="num">
                    <PriceInput value={cur.perPerson} onChange={(v) => setInstructor(ir.id, 'perPerson', v)} />
                    {cur.perPerson !== def.perPerson && (
                      <div className="muted-text" style={{ fontSize: 10, marginTop: 2 }}>
                        {lang === 'sk' ? 'pôv.' : 'def.'} {def.perPerson} €
                      </div>
                    )}
                  </td>
                  <td className="num">
                    <PriceInput value={cur.parking} onChange={(v) => setInstructor(ir.id, 'parking', v)} suffix="€/auto" />
                    {cur.parking !== def.parking && (
                      <div className="muted-text" style={{ fontSize: 10, marginTop: 2 }}>
                        {lang === 'sk' ? 'pôv.' : 'def.'} {def.parking} €
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ============ Boats ============ */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">
              <span className="step-num" style={{ background: 'var(--primary)' }}><Icon name="boat" size={11} /></span>
              {t('section_boats', lang)}
            </div>
            <div className="card-sub">
              {lang === 'sk'
                ? 'Bez inštruktora. Malé a stredné lode majú fixnú cenu za kus, veľké rafty (Hobit 400/450/500) sa účtujú za osobu.'
                : 'No instructor. Smaller boats are fixed-price per vessel; large rafts (Hobit 400/450/500) are priced per person.'}
            </div>
          </div>
        </div>
        <table className="line-table" style={{ marginTop: 4 }}>
          <thead>
            <tr>
              <th>{lang === 'sk' ? 'Plavidlo' : 'Vessel'}</th>
              <th className="num">10 km</th>
              <th className="num">17 km</th>
              <th className="num">25 km</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(BOAT_PRICES).map(([code, cfg]) => {
              const def = DEFAULT_PRICING.boats[code];
              const cur = draft.boats[code];
              return (
                <tr key={code}>
                  <td>
                    <div className="line-name">{cfg.label[lang]}</div>
                    <div className="line-meta">
                      <span className="mono">{code}</span> ·{' '}
                      {cfg.perPerson
                        ? (lang === 'sk' ? 'cena za osobu' : 'price per person')
                        : (lang === 'sk' ? 'cena za plavidlo' : 'price per vessel')}
                    </div>
                  </td>
                  {['10KM', '17KM', '25KM'].map(r => (
                    <td key={r} className="num">
                      <PriceInput value={cur[r]} onChange={(v) => setBoat(code, r, v)}
                                  suffix={cfg.perPerson ? '€/os' : '€/ks'} />
                      {cur[r] !== def[r] && (
                        <div className="muted-text" style={{ fontSize: 10, marginTop: 2 }}>
                          {lang === 'sk' ? 'pôv.' : 'def.'} {def[r]} €
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ============ Bikes ============ */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">
              <span className="step-num" style={{ background: 'var(--primary)' }}><Icon name="bike" size={11} /></span>
              {t('section_bikes', lang)}
            </div>
            <div className="card-sub">
              {lang === 'sk'
                ? 'Tri tarify pre každý typ bicykla: návrat po splave (~10 km), krátkodobý prenájom v obci, celý deň.'
                : 'Three tariffs per bike type: return after rafting (~10 km), short-term in-town rental, full day.'}
            </div>
          </div>
        </div>
        <table className="line-table" style={{ marginTop: 4 }}>
          <thead>
            <tr>
              <th>{t('tariff', lang)}</th>
              <th className="num">{t('bike_classic_h', lang)}</th>
              <th className="num">{t('bike_ebike_h', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {BIKE_TARIFFS.map(tf => {
              const def = DEFAULT_PRICING.bikes;
              const cur = draft.bikes;
              return (
                <tr key={tf.id}>
                  <td>
                    <div className="line-name">{tf.label[lang]}</div>
                    <div className="line-meta"><span className="mono">{tf.id}</span></div>
                  </td>
                  <td className="num">
                    <PriceInput value={cur.KLASIK[tf.id]} onChange={(v) => setBike('KLASIK', tf.id, v)} />
                    {cur.KLASIK[tf.id] !== def.KLASIK[tf.id] && (
                      <div className="muted-text" style={{ fontSize: 10, marginTop: 2 }}>
                        {lang === 'sk' ? 'pôv.' : 'def.'} {def.KLASIK[tf.id]} €
                      </div>
                    )}
                  </td>
                  <td className="num">
                    <PriceInput value={cur.EBIKE[tf.id]} onChange={(v) => setBike('EBIKE', tf.id, v)} />
                    {cur.EBIKE[tf.id] !== def.EBIKE[tf.id] && (
                      <div className="muted-text" style={{ fontSize: 10, marginTop: 2 }}>
                        {lang === 'sk' ? 'pôv.' : 'def.'} {def.EBIKE[tf.id]} €
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ============ Extras ============ */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">
              <span className="step-num" style={{ background: 'var(--primary)' }}><Icon name="car" size={11} /></span>
              {t('section_extras', lang)}
            </div>
            <div className="card-sub">{t('extras_help', lang)}</div>
          </div>
          <span className="tag accent">⚠︎ {lang === 'sk' ? 'mimo PDF špecifikácie' : 'outside PDF spec'}</span>
        </div>
        <table className="line-table" style={{ marginTop: 4 }}>
          <thead>
            <tr>
              <th>{t('item', lang)}</th>
              <th className="num">{lang === 'sk' ? 'Jednotka' : 'Unit'}</th>
              <th className="num">{t('unit_price', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(EXTRAS).map(([code, cfg]) => {
              const def = DEFAULT_PRICING.extras[code];
              const cur = draft.extras[code];
              return (
                <tr key={code}>
                  <td>
                    <div className="line-name">{cfg.label[lang]}</div>
                    <div className="line-meta"><span className="mono">{code}</span></div>
                  </td>
                  <td className="num muted-text" style={{ fontSize: 12 }}>
                    {cfg.unit === 'pax' ? (lang === 'sk' ? 'na osobu' : 'per person') : (lang === 'sk' ? 'za kus' : 'per piece')}
                  </td>
                  <td className="num">
                    <PriceInput value={cur} onChange={(v) => setExtra(code, v)} />
                    {cur !== def && (
                      <div className="muted-text" style={{ fontSize: 10, marginTop: 2 }}>
                        {lang === 'sk' ? 'pôv.' : 'def.'} {def} €
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ============ Equipment (read-only — always free) ============ */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">
              <span className="step-num" style={{ background: 'var(--success)' }}><Icon name="helmet" size={11} /></span>
              {t('section_equipment', lang)}
            </div>
            <div className="card-sub">{t('equipment_note', lang)}</div>
          </div>
          <span className="tag success">{t('free', lang).toUpperCase()}</span>
        </div>
        <div className="pill-row">
          {Object.entries(EQUIPMENT).map(([code, cfg]) => (
            <span key={code} className="pill" style={{ cursor: 'default', background: 'var(--surface-2)' }}>
              {cfg.label[lang]}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom save bar (mirror of sticky one) */}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18, gap: 10 }}>
        <button className="btn" onClick={reset}>
          <Icon name="settings" size={14} /> {t('reset_defaults', lang)}
        </button>
        <button className="btn btn-lg btn-accent" onClick={save} disabled={!dirty}>
          <Icon name="save" size={14} /> {t('save', lang)}
        </button>
      </div>
    </div>
  );
}

export { PricelistView };
