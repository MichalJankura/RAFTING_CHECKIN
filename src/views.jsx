import { useState as _useState, useMemo as _useMemo, useEffect as _useEffect } from 'react';
import { Icon } from './icons.jsx';
import {
  ROUTES, INSTRUCTOR_ROUTES, SVC_TYPES, T, t, resolveRouteLabel, ID_TYPES,
} from './catalog.jsx';
import {
  fmtMoney, fmtDateTime, fmtDate, fmtTime, dateKey, orderServiceTypes,
} from './storage.jsx';

// ---------- Helpers ----------
function orderTotal(order) {
  if (order.manualTotalOverride != null) return order.manualTotalOverride;
  const sub = (order.lines || []).reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0);
  return sub + (order.manualAdjustment || 0);
}

function arrivalOf(order) {
  return order.arrivalAt || order.createdAt;
}

function ServiceTags({ order, lang }) {
  const ts = orderServiceTypes(order);
  return (
    <div className="row gap-sm" style={{ flexWrap: 'wrap', gap: 4 }}>
      {ts.map(id => {
        const s = SVC_TYPES.find(x => x.id === id);
        return <span key={id} className="tag">{s ? s.label[lang] : id}</span>;
      })}
    </div>
  );
}

// ============================================================
// ORDER DETAIL MODAL
// ============================================================
function OrderModal({ order, lang, onClose, onPrint, onEdit, onToggleCompleted, onDelete }) {
  if (!order) return null;
  const total = orderTotal(order);
  const sub = (order.lines || []).reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0);
  const isCompleted = !!order.completed;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t('order_no', lang)} <span className="mono">#{order.number}</span> · {t('arrival', lang)}: {fmtDateTime(arrivalOf(order), lang)}
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
              {order.customer.name} {order.customer.surname}
              <span className={'tag ' + (isCompleted ? 'success' : 'accent')} style={{ fontSize: 10, padding: '2px 9px' }}>
                {isCompleted ? '✓ ' + t('completed', lang) : '○ ' + t('pending', lang)}
              </span>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <div>
              <div className="muted-text" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('country', lang)}</div>
              <div>{order.customer.country}</div>
            </div>
            <div>
              <div className="muted-text" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('id_code', lang)}</div>
              <div>{ID_TYPES.find(x => x.id === order.customer.idType)?.label[lang]} · <span className="mono">{order.customer.idCode || '—'}</span></div>
            </div>
            <div>
              <div className="muted-text" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('address', lang)}</div>
              <div>{order.customer.address || '—'}</div>
            </div>
            <div>
              <div className="muted-text" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('issued_at', lang)}</div>
              <div className="mono">{fmtDateTime(order.createdAt, lang)}</div>
            </div>
            <div>
              <div className="muted-text" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('operator', lang)}</div>
              <div>{order.operator || '—'}</div>
            </div>
            <div>
              <div className="muted-text" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('phone', lang)}</div>
              <div>{order.customer.phone || '—'}</div>
            </div>
            <div>
              <div className="muted-text" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('route', lang)}</div>
              <div>{resolveRouteLabel(order.route, lang) || '—'}</div>
            </div>
            <div>
              <div className="muted-text" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('people', lang)}</div>
              <div>{order.adults} {t('adults', lang).toLowerCase()} · {order.kids} {t('kids', lang).toLowerCase()}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table className="line-table">
              <thead>
                <tr>
                  <th>{t('item', lang)}</th>
                  <th className="num">{t('qty', lang)}</th>
                  <th className="num">{t('unit_price', lang)}</th>
                  <th className="num">{t('amount', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((l, i) => {
                  const free = l.kind === 'EQUIPMENT';
                  return (
                    <tr key={i}>
                      <td><div className="line-name">{l.label}{free && <span className="tag success" style={{ marginLeft: 8, fontSize: 9 }}>{t('free', lang).toUpperCase()}</span>}</div></td>
                      <td className="num">{l.qty}</td>
                      <td className="num mono">{free ? '—' : fmtMoney(l.unitPrice)}</td>
                      <td className="num mono" style={{ fontWeight: 600 }}>{free ? '—' : fmtMoney(l.qty * l.unitPrice)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <hr className="hairline" />
          <div className="totals-row"><span>{t('subtotal', lang)}</span><span className="mono">{fmtMoney(sub)}</span></div>
          {(order.manualAdjustment || 0) !== 0 && (
            <div className="totals-row"><span>{t('adjustment', lang)}</span><span className="mono">{fmtMoney(order.manualAdjustment)}</span></div>
          )}
          {order.manualTotalOverride != null && (
            <div className="totals-row"><span className="muted-text">↳ {t('override', lang)}</span><span className="mono muted-text">{fmtMoney(order.manualTotalOverride)}</span></div>
          )}
          <div className="totals-row grand"><span>{t('final_total', lang)}</span><span className="amount mono">{fmtMoney(total)}</span></div>

          {order.notes && (
            <>
              <hr className="hairline" />
              <div className="muted-text" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{t('notes', lang)}</div>
              <div style={{ fontSize: 13 }}>{order.notes}</div>
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-danger" onClick={() => onDelete(order)}><Icon name="trash" size={14} /> {t('delete', lang)}</button>
          <button className={isCompleted ? 'btn' : 'btn btn-primary'}
                  style={isCompleted ? { background: 'var(--success-tint)', color: 'var(--success)', borderColor: 'transparent' } : { background: 'var(--success)', borderColor: 'var(--success)', color: '#fff' }}
                  onClick={() => onToggleCompleted(order)}>
            <Icon name="check" size={14} /> {isCompleted ? t('mark_pending', lang) : t('mark_completed', lang)}
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>{t('cancel', lang)}</button>
          <button className="btn" onClick={() => onEdit(order)}><Icon name="edit" size={14} /> {t('edit', lang)}</button>
          <button className="btn btn-primary" onClick={() => onPrint(order)}><Icon name="printer" size={14} /> {t('print', lang)}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ORDERS LIST VIEW
// ============================================================
function OrdersView({ lang, orders, onOpen, onExportAll }) {
  const [query, setQuery] = _useState('');
  const [svcFilter, setSvcFilter] = _useState('ALL');
  const [routeFilter, setRouteFilter] = _useState('ALL');
  const [countryFilter, setCountryFilter] = _useState('ALL');
  const [statusFilter, setStatusFilter] = _useState('ALL');
  const [dateFilter, setDateFilter] = _useState('');

  const countries = _useMemo(() => {
    const s = new Set(orders.map(o => o.customer.country).filter(Boolean));
    return [...s].sort();
  }, [orders]);

  const filtered = _useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter(o => {
        if (svcFilter !== 'ALL' && !orderServiceTypes(o).includes(svcFilter)) return false;
        if (routeFilter !== 'ALL' && o.route !== routeFilter) return false;
        if (countryFilter !== 'ALL' && o.customer.country !== countryFilter) return false;
        if (statusFilter === 'DONE' && !o.completed) return false;
        if (statusFilter === 'PENDING' && o.completed) return false;
        if (dateFilter && dateKey(arrivalOf(o)) !== dateFilter) return false;
        if (!q) return true;
        const hay = [
          '#' + o.number, o.customer.name, o.customer.surname,
          o.customer.country, o.customer.idCode, o.customer.address,
          o.notes
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.number - a.number);
  }, [orders, query, svcFilter, routeFilter, countryFilter, statusFilter, dateFilter]);

  return (
    <div>
      <div className="filter-bar">
        <input className="search" placeholder={t('search_ph', lang)} value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">{t('filter_status', lang)}: {t('filter_all', lang)}</option>
          <option value="PENDING">○ {t('pending', lang)}</option>
          <option value="DONE">✓ {t('completed', lang)}</option>
        </select>
        <select value={svcFilter} onChange={(e) => setSvcFilter(e.target.value)}>
          <option value="ALL">{t('filter_type', lang)}: {t('filter_all', lang)}</option>
          {SVC_TYPES.map(s => <option key={s.id} value={s.id}>{s.label[lang]}</option>)}
        </select>
        <select value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)}>
          <option value="ALL">{t('route', lang)}: {t('filter_all', lang)}</option>
          {ROUTES.map(r => <option key={r.id} value={r.id}>{r.km} km</option>)}
        </select>
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
          <option value="ALL">{t('country', lang)}: {t('filter_all', lang)}</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          title={lang === 'sk' ? 'Filtrovať podľa dátumu príchodu' : 'Filter by arrival date'}
          style={{ border: '1px solid var(--border)', padding: '7px 10px', borderRadius: 'var(--r-sm)', background: dateFilter ? 'var(--primary-tint)' : 'var(--surface)', fontSize: 13, borderColor: dateFilter ? 'var(--primary)' : 'var(--border)' }} />
        {dateFilter && (
          <button className="btn btn-sm" onClick={() => setDateFilter('')} title={lang === 'sk' ? 'Zrušiť filter dátumu' : 'Clear date filter'}>
            × {lang === 'sk' ? 'Zrušiť dátum' : 'Clear date'}
          </button>
        )}
        <span style={{ flex: 1 }} />
        <span className="muted-text">{filtered.length} / {orders.length}</span>
        <button className="btn btn-sm" onClick={onExportAll}><Icon name="download" size={13} /> {t('export_json', lang)}</button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{t('no_orders', lang)}</div>
      ) : (
        <div className="table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>{t('order_no', lang)}</th>
                <th style={{ width: 150 }}>{t('arrival', lang)}</th>
                <th>{t('customer', lang)}</th>
                <th>{t('country', lang)}</th>
                <th style={{ width: 100 }}>{t('route', lang)}</th>
                <th>{t('services', lang)}</th>
                <th style={{ width: 90 }} className="num">{t('people', lang)}</th>
                <th style={{ width: 120 }} className="num">{t('total', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} onClick={() => onOpen(o)}
                    style={o.completed ? { background: 'var(--success-tint)' } : {}}>
                  <td className="num">
                    {o.completed && <span style={{ color: 'var(--success)', marginRight: 4, fontWeight: 700 }}>✓</span>}
                    #{o.number}
                  </td>
                  <td>{fmtDateTime(arrivalOf(o), lang)}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.customer.name} {o.customer.surname}</div>
                    <div className="muted-text" style={{ fontSize: 11 }}>{o.customer.idCode}</div>
                  </td>
                  <td>{o.customer.country}</td>
                  <td className="num">{o.route?.includes('KM') ? o.route.replace('KM', ' km') : (INSTRUCTOR_ROUTES.find(r => r.id === o.route)?.label[lang] || o.route)}</td>
                  <td><ServiceTags order={o} lang={lang} /></td>
                  <td className="num">{(o.adults || 0) + (o.kids || 0)}</td>
                  <td className="num mono" style={{ fontWeight: 600 }}>{fmtMoney(orderTotal(o))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CALENDAR VIEW
// ============================================================
function CalendarView({ lang, orders, onOpen }) {
  const today = _useMemo(() => new Date(), []);
  const [cursor, setCursor] = _useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = _useState(() => dateKey(today.toISOString()));

  const grid = _useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDow = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < startDow; i++) {
      const d = new Date(year, month, -startDow + i + 1);
      cells.push({ date: d, inMonth: false });
    }
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const d = cells[cells.length - 1].date;
      cells.push({ date: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), inMonth: false });
    }
    return cells;
  }, [cursor]);

  const ordersByDay = _useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const k = dateKey(arrivalOf(o));
      (map[k] = map[k] || []).push(o);
    });
    return map;
  }, [orders]);

  const maxPerDay = Math.max(1, ...Object.values(ordersByDay).map(a => a.length));
  const selectedOrders = (ordersByDay[selected] || []).sort((a, b) => new Date(arrivalOf(a)) - new Date(arrivalOf(b)));
  const selectedRevenue = selectedOrders.reduce((s, o) => s + orderTotal(o), 0);
  const selectedPeople = selectedOrders.reduce((s, o) => s + (o.adults || 0) + (o.kids || 0), 0);
  const todayKey = dateKey(today.toISOString());

  return (
    <div className="cal-wrap">
      <div className="cal">
        <div className="cal-head">
          <div>
            <div className="month">
              {T.months_long[lang][cursor.getMonth()]} {cursor.getFullYear()}
            </div>
            <div className="muted-text" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
              {Object.keys(ordersByDay).filter(k => k.startsWith(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`)).length} {lang==='sk' ? 'aktívnych dní' : 'active days'}
            </div>
          </div>
          <div className="controls">
            <button className="btn btn-sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><Icon name="chevronLeft" size={14} /></button>
            <button className="btn btn-sm" onClick={() => { const tn = new Date(); setCursor(new Date(tn.getFullYear(), tn.getMonth(), 1)); setSelected(dateKey(tn.toISOString())); }}>{t('today', lang)}</button>
            <button className="btn btn-sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><Icon name="chevronRight" size={14} /></button>
          </div>
        </div>
        <div className="cal-grid">
          {T.dow_short[lang].map(d => <div key={d} className="cal-dow">{d}</div>)}
          {grid.map(({ date, inMonth }, i) => {
            const k = dateKey(date.toISOString());
            const dayOrders = ordersByDay[k] || [];
            const cnt = dayOrders.length;
            const ratio = cnt / maxPerDay;
            const h = !inMonth ? '' : cnt === 0 ? '' : (ratio < 0.34 ? ' h1' : ratio < 0.67 ? ' h2' : ratio < 0.99 ? ' h3' : ' h4');
            return (
              <button key={i}
                      className={'cal-cell' + (!inMonth ? ' muted' : '') + (k === todayKey ? ' today' : '') + (k === selected ? ' selected' : '') + h}
                      onClick={() => { setSelected(k); }}>
                <div className="d">{date.getDate()}</div>
                {cnt > 0 && inMonth && <div className="count">{cnt} {lang === 'sk' ? 'obj.' : 'ord.'}</div>}
              </button>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 12, gap: 14, fontSize: 11, color: 'var(--muted)' }}>
          <span>{lang === 'sk' ? 'Vyťaženie:' : 'Volume:'}</span>
          <span className="row gap-sm">
            <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--surface)' , border: '1px solid var(--border)' }} />
            <span>0</span>
          </span>
          <span className="row gap-sm">
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#f0e9d6' }} />
            <span className="row gap-sm">
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#ecd9b5' }} />
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#e0bd86' }} />
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent)' }} />
            </span>
            <span>{lang === 'sk' ? 'rušno' : 'busy'}</span>
          </span>
        </div>
      </div>

      <div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head">
            <div>
              <div className="card-title" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 16 }}>
                {fmtDate(selected + 'T00:00:00')}
              </div>
              <div className="card-sub">
                {selectedOrders.length} {lang === 'sk' ? 'objednávok' : 'orders'} ·
                {' '}{selectedPeople} {lang === 'sk' ? 'osôb' : 'people'} ·
                {' '}<span className="mono">{fmtMoney(selectedRevenue)}</span>
              </div>
            </div>
          </div>
          {selectedOrders.length === 0 ? (
            <div className="empty">{t('no_orders_day', lang)}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedOrders.map(o => (
                <button key={o.id} className="row between" onClick={() => onOpen(o)}
                  style={{
                    background: o.completed ? 'var(--success-tint)' : 'var(--surface-2)',
                    border: '1px solid ' + (o.completed ? 'transparent' : 'var(--border)'),
                    borderLeft: o.completed ? '3px solid var(--success)' : '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)',
                    padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                    fontFamily: 'inherit', color: 'inherit', width: '100%',
                  }}>
                  <div>
                    <div className="row" style={{ gap: 10 }}>
                      {o.completed && <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span>}
                      <span className="mono muted-text" style={{ fontSize: 11 }}>#{o.number}</span>
                      <span className="mono muted-text" style={{ fontSize: 11 }}>{fmtTime(arrivalOf(o))}</span>
                      <span style={{ fontWeight: 600 }}>{o.customer.name} {o.customer.surname}</span>
                    </div>
                    <div className="row" style={{ gap: 6, marginTop: 4 }}>
                      <span className="tag muted">{o.route?.replace('KM',' km')}</span>
                      <ServiceTags order={o} lang={lang} />
                      {o.completed
                        ? <span className="tag success" style={{ fontSize: 10 }}>{t('completed', lang)}</span>
                        : <span className="tag accent" style={{ fontSize: 10 }}>{t('pending', lang)}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontWeight: 700 }}>{fmtMoney(orderTotal(o))}</div>
                    <div className="muted-text" style={{ fontSize: 11 }}>{(o.adults||0)+(o.kids||0)} {lang==='sk'?'os.':'pax'}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DAILY SUMMARY VIEW
// ============================================================
function SummaryView({ lang, orders }) {
  const completedAll = orders.filter(o => o.completed);
  const today = _useMemo(() => new Date(), []);
  const [period, setPeriod] = _useState('day');
  const [day, setDay] = _useState(() => dateKey(today.toISOString()));
  const [monthCursor, setMonthCursor] = _useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const isDay = period === 'day';
  const todayKey = dateKey(today.toISOString());

  const periodOrders = _useMemo(() => {
    if (isDay) {
      return completedAll.filter(o => dateKey(arrivalOf(o)) === day);
    }
    const y = monthCursor.getFullYear();
    const m = monthCursor.getMonth();
    return completedAll.filter(o => {
      const d = new Date(arrivalOf(o));
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [completedAll, isDay, day, monthCursor]);

  const revenue = periodOrders.reduce((s, o) => s + orderTotal(o), 0);
  const people = periodOrders.reduce((s, o) => s + (o.adults || 0) + (o.kids || 0), 0);
  const avg = periodOrders.length ? revenue / periodOrders.length : 0;

  const pendingCount = _useMemo(() => {
    if (isDay) return orders.filter(o => !o.completed && dateKey(arrivalOf(o)) === day).length;
    const y = monthCursor.getFullYear();
    const m = monthCursor.getMonth();
    return orders.filter(o => {
      if (o.completed) return false;
      const d = new Date(arrivalOf(o));
      return d.getFullYear() === y && d.getMonth() === m;
    }).length;
  }, [orders, isDay, day, monthCursor]);

  const byType = {};
  SVC_TYPES.forEach(s => byType[s.id] = { count: 0, revenue: 0 });
  periodOrders.forEach(o => {
    (o.lines || []).forEach(l => {
      const tg = classifyServiceFromLine(l);
      byType[tg] = byType[tg] || { count: 0, revenue: 0 };
      byType[tg].count += l.qty || 0;
      byType[tg].revenue += (l.qty || 0) * (l.unitPrice || 0);
    });
  });
  const maxRev = Math.max(1, ...Object.values(byType).map(v => v.revenue));

  const trend = _useMemo(() => {
    const arr = [];
    if (isDay) {
      const sel = new Date(day + 'T00:00:00');
      for (let i = 6; i >= 0; i--) {
        const d = new Date(sel);
        d.setDate(d.getDate() - i);
        const k = dateKey(d.toISOString());
        const list = completedAll.filter(o => dateKey(arrivalOf(o)) === k);
        arr.push({ date: d, key: k,
          revenue: list.reduce((s, o) => s + orderTotal(o), 0),
          count: list.length });
      }
    } else {
      const y = monthCursor.getFullYear();
      const m = monthCursor.getMonth();
      const last = new Date(y, m + 1, 0).getDate();
      for (let dd = 1; dd <= last; dd++) {
        const d = new Date(y, m, dd);
        const k = dateKey(d.toISOString());
        const list = completedAll.filter(o => dateKey(arrivalOf(o)) === k);
        arr.push({ date: d, key: k,
          revenue: list.reduce((s, o) => s + orderTotal(o), 0),
          count: list.length });
      }
    }
    return arr;
  }, [isDay, day, monthCursor, completedAll]);
  const maxTrend = Math.max(1, ...trend.map(td => td.revenue));

  const shiftDay = (delta) => {
    const d = new Date(day + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setDay(dateKey(d.toISOString()));
  };
  const shiftMonth = (delta) => {
    setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + delta, 1));
  };

  const periodLabel = isDay
    ? fmtDate(day + 'T00:00:00')
    : `${T.months_long[lang][monthCursor.getMonth()]} ${monthCursor.getFullYear()}`;

  // classifyServiceFromLine needed locally in SummaryView
  function classifyServiceFromLine(line) {
    if (line.kind === 'INSTRUCTOR') return 'INSTRUCTOR';
    if (line.kind === 'BOAT') return 'BOATS';
    if (line.kind === 'BIKE') return 'BIKES';
    if (line.kind === 'EXTRA') return 'EXTRAS';
    if (line.kind === 'EQUIPMENT') return 'EQUIPMENT';
    return 'EXTRAS';
  }

  return (
    <div>
      <div className="filter-bar" style={{ alignItems: 'center' }}>
        <div className="lang-toggle" style={{ marginRight: 4 }}>
          <button className={period === 'day' ? 'active' : ''} onClick={() => setPeriod('day')}>{lang === 'sk' ? 'Deň' : 'Day'}</button>
          <button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>{lang === 'sk' ? 'Mesiac' : 'Month'}</button>
        </div>
        {isDay ? (
          <>
            <button className="btn btn-sm" onClick={() => shiftDay(-1)}><Icon name="chevronLeft" size={14} /></button>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
                   style={{ border: '1px solid var(--border)', padding: '7px 10px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', fontSize: 13 }} />
            <button className="btn btn-sm" onClick={() => shiftDay(+1)}><Icon name="chevronRight" size={14} /></button>
            <button className="btn btn-sm" onClick={() => setDay(todayKey)}>{t('today', lang)}</button>
          </>
        ) : (
          <>
            <button className="btn btn-sm" onClick={() => shiftMonth(-1)}><Icon name="chevronLeft" size={14} /></button>
            <select value={monthCursor.getMonth()} onChange={(e) => setMonthCursor(new Date(monthCursor.getFullYear(), parseInt(e.target.value, 10), 1))}
                    style={{ minWidth: 130 }}>
              {T.months_long[lang].map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <input type="number" value={monthCursor.getFullYear()} step="1"
                   onChange={(e) => setMonthCursor(new Date(parseInt(e.target.value, 10) || today.getFullYear(), monthCursor.getMonth(), 1))}
                   style={{ width: 90, border: '1px solid var(--border)', padding: '7px 10px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', fontSize: 13 }} />
            <button className="btn btn-sm" onClick={() => shiftMonth(+1)}><Icon name="chevronRight" size={14} /></button>
            <button className="btn btn-sm" onClick={() => setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>{lang === 'sk' ? 'Tento mesiac' : 'This month'}</button>
          </>
        )}
        <span style={{ flex: 1 }} />
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{periodLabel}</div>
      </div>

      <div className="notice" style={{ background: 'var(--success-tint)', borderColor: '#bcd9c5', color: 'var(--success)' }}>
        <Icon name="check" size={14} style={{ flex: '0 0 auto', marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <strong>{lang === 'sk' ? 'Prehľad zahŕňa iba vybavené objednávky' : 'Summary includes only completed orders'}</strong>
          {' — '}
          {lang === 'sk'
            ? 'nevybavené objednávky ešte negenerujú príjem.'
            : 'pending orders do not generate revenue yet.'}
          {pendingCount > 0 && (
            <> {' · '}<span style={{ color: 'var(--accent)' }}>
              {lang === 'sk'
                ? `${pendingCount} nevybavených v tomto období`
                : `${pendingCount} pending in this period`}
            </span></>
          )}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="k-label">{isDay ? (lang === 'sk' ? 'Objednávky v tento deň' : 'Orders this day') : (lang === 'sk' ? 'Objednávky v mesiaci' : 'Orders this month')}</div>
          <div className="k-val">{periodOrders.length}</div>
          <div className="k-trend">{periodLabel} · ✓ {t('completed', lang).toLowerCase()}</div>
        </div>
        <div className="kpi">
          <div className="k-label">{isDay ? (lang === 'sk' ? 'Tržba v tento deň' : 'Revenue this day') : (lang === 'sk' ? 'Tržba za mesiac' : 'Revenue this month')}</div>
          <div className="k-val">{fmtMoney(revenue).replace(' €', '')}<span className="unit">€</span></div>
          <div className="k-trend">{t('avg_order', lang)}: <span className="mono">{fmtMoney(avg)}</span></div>
        </div>
        <div className="kpi">
          <div className="k-label">{isDay ? (lang === 'sk' ? 'Osôb v tento deň' : 'People this day') : (lang === 'sk' ? 'Osôb v mesiaci' : 'People this month')}</div>
          <div className="k-val">{people}</div>
          <div className="k-trend">{periodOrders.reduce((s,o)=>s+(o.adults||0),0)} {lang==='sk'?'dosp.':'adults'} · {periodOrders.reduce((s,o)=>s+(o.kids||0),0)} {lang==='sk'?'detí':'kids'}</div>
        </div>
        <div className="kpi">
          <div className="k-label">{lang === 'sk' ? 'Spolu vybavené' : 'Total completed'}</div>
          <div className="k-val">{completedAll.length}</div>
          <div className="k-trend">{lang === 'sk' ? 'všetky časy' : 'all time'} · {orders.length - completedAll.length} {t('pending', lang).toLowerCase()}</div>
        </div>
      </div>

      <div className="section-gap row" style={{ alignItems: 'stretch', gap: 14 }}>
        <div className="card" style={{ flex: 1, marginTop: 0 }}>
          <div className="card-head">
            <div className="card-title">{t('by_service', lang)}</div>
          </div>
          {Object.entries(byType).filter(([_, v]) => v.count > 0).length === 0 ? (
            <div className="empty">{t('no_orders_day', lang)}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {SVC_TYPES.map(s => {
                const v = byType[s.id];
                if (v.count === 0) return null;
                const pct = (v.revenue / maxRev) * 100;
                return (
                  <div key={s.id}>
                    <div className="row between" style={{ marginBottom: 4 }}>
                      <span>{s.label[lang]} <span className="muted-text">· {v.count}×</span></span>
                      <span className="mono" style={{ fontWeight: 600 }}>{fmtMoney(v.revenue)}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: pct + '%', height: '100%', background: 'var(--primary)', borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="card" style={{ flex: 1, marginTop: 0 }}>
          <div className="card-head">
            <div className="card-title">
              {isDay
                ? (lang === 'sk' ? 'Posledných 7 dní' : 'Last 7 days')
                : (lang === 'sk' ? `Denne — ${periodLabel}` : `Daily — ${periodLabel}`)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: isDay ? 8 : 3, height: 180, padding: '8px 4px' }}>
            {trend.map((d, i) => {
              const h = (d.revenue / maxTrend) * 100;
              const isToday = d.key === todayKey;
              const isSelected = isDay && d.key === day;
              const showLabel = isDay || (i + 1) % 5 === 0 || i === 0 || i === trend.length - 1;
              return (
                <div key={i}
                     onClick={() => { setPeriod('day'); setDay(d.key); }}
                     title={`${fmtDate(d.date.toISOString())} · ${fmtMoney(d.revenue)} · ${d.count} ${lang==='sk'?'obj.':'ord.'}`}
                     style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  {isDay && (
                    <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {d.revenue > 0 ? Math.round(d.revenue) + '€' : ''}
                    </div>
                  )}
                  <div style={{
                    width: '100%', height: h + '%', minHeight: d.revenue > 0 ? 3 : 1,
                    background: isSelected ? 'var(--accent)' : (isToday ? 'var(--accent)' : 'var(--primary)'),
                    borderRadius: '4px 4px 0 0',
                    opacity: d.revenue === 0 ? 0.15 : 1,
                  }} />
                  <div style={{
                    fontSize: isDay ? 11 : 9,
                    color: isToday ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: isToday ? 700 : 400,
                  }}>
                    {showLabel
                      ? (isDay
                          ? T.dow_short[lang][(d.date.getDay() + 6) % 7]
                          : d.date.getDate())
                      : ''}
                  </div>
                </div>
              );
            })}
          </div>
          {!isDay && (
            <div className="muted-text" style={{ fontSize: 11, marginTop: 8, textAlign: 'center' }}>
              {lang === 'sk' ? 'Klikni na deň pre detail' : 'Click a day for details'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PRINT TEMPLATE — 2 copies on one A4
// ============================================================
const CONTRACT_TERMS = [
  {
    sk: 'Svojím podpisom potvrdzujem plnú zodpovednosť za zapožičanú výstroj. V prípade straty, poškodenia alebo znehodnotenia sa zaväzujem uhradiť plnú hodnotu výstroje.',
    en: 'By signing, I confirm full responsibility for the borrowed equipment. In case of loss, damage or destruction, I agree to pay its full replacement value.',
  },
  {
    sk: 'Za prípadné škody na zdraví a majetku preberám plnú zodpovednosť.',
    en: 'I assume full responsibility for any personal injury or property damage.',
  },
  {
    sk: 'Všetko vybavenie po splave nechávam v rafte v takom počte, v akom som si ho zapožičal. Výnimkou sú prilby, ktoré si so sebou berieme na bicykle.',
    en: 'All equipment must be left in the raft after rafting in the same quantity as borrowed. Exception: helmets, which may be taken for cycling.',
  },
  {
    sk: 'Svojím podpisom potvrdzujem, že som neužil, a ani ako posádka celkovo neužijeme, pred a ani počas splavu alkohol.',
    en: 'By signing, I confirm that neither I nor any crew member has consumed or will consume alcohol before or during the rafting trip.',
  },
  {
    sk: 'Prečítal som si a porozumel som plavebnému nariadeniu 14/2025.',
    en: 'I have read and understood navigation regulation 14/2025.',
  },
];

const COMPANY_INFO = {
  name:    'MR PIENINY INTERNATIONAL s.r.o.',
  address: 'Červený Kláštor 30, 059 06 Červený Kláštor',
  form:    's.r.o.',
  ico:     '55 623 271',
  insert:  '46297/P',
  iban:    'SK67 8330 0000 0029 0265 9479',
};

function PrintCopy({ order }) {
  const total = orderTotal(order);
  const sub = (order.lines || []).reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0);

  const routeLabel = (() => {
    const r = ROUTES.find(x => x.id === order.route);
    if (r) return `${r.km} km · ${r.label.sk} / ${r.label.en}`;
    const ir = INSTRUCTOR_ROUTES.find(x => x.id === order.route);
    if (ir) return `${ir.label.sk} / ${ir.label.en}`;
    return order.route || '—';
  })();

  const idTypeLabel = (() => {
    const x = ID_TYPES.find(i => i.id === order.customer.idType);
    return x ? `${x.label.sk} / ${x.label.en}` : '';
  })();

  return (
    <div className="copy">
      <div className="p-head">
        <div className="p-head-left">
          <div className="p-brand-row">
            <img src="logo.png" alt="" className="p-logo" />
            <div>
              <div className="p-brand">RAFTING DUNAJEC</div>
              <div className="p-sub">Doklad o prenájme / Rental ticket</div>
            </div>
          </div>
          <div className="p-company">
            <div><strong>{COMPANY_INFO.name}</strong> · IČO: {COMPANY_INFO.ico} · Vložka / Reg. no.: {COMPANY_INFO.insert}</div>
            <div>Sídlo / Registered office: {COMPANY_INFO.address} · Forma / Legal form: {COMPANY_INFO.form}</div>
            <div>IBAN: <span className="mono">{COMPANY_INFO.iban}</span></div>
          </div>
        </div>
        <div className="p-meta">
          <div className="num">#{order.number}</div>
          <div><strong>Príchod / Arrival: {fmtDateTime(arrivalOf(order), 'sk')}</strong></div>
          <div>Vystavené / Issued: {fmtDateTime(order.createdAt, 'sk')}</div>
          <div>Obsluha / Operator: {order.operator || '—'}</div>
        </div>
      </div>

      <div className="p-grid">
        <div><div className="lbl">Zákazník / Customer</div><div className="val">{order.customer.name} {order.customer.surname}</div></div>
        <div><div className="lbl">Krajina / Country</div><div className="val">{order.customer.country}</div></div>
        <div><div className="lbl">{idTypeLabel}</div><div className="val">{order.customer.idCode || '—'}</div></div>
        <div><div className="lbl">Adresa / Address</div><div className="val">{order.customer.address || '—'}</div></div>
        <div><div className="lbl">Telefón / Phone</div><div className="val">{order.customer.phone || '—'}</div></div>
        <div><div className="lbl">Trasa / Route</div><div className="val">{routeLabel}</div></div>
        <div><div className="lbl">Osoby / People</div><div className="val">{order.adults} dosp. / adults · {order.kids} det. / children</div></div>
        <div><div className="lbl">Stav / Status</div><div className="val">{order.completed ? '✓ Vybavené / Completed' : '○ Nevybavené / Pending'}</div></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Položka / Item</th>
            <th style={{ textAlign: 'right', width: 40 }}>Počet / Qty</th>
            <th style={{ textAlign: 'right', width: 75 }}>Cena/ks / Unit</th>
            <th style={{ textAlign: 'right', width: 75 }}>Suma / Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l, i) => {
            const free = l.kind === 'EQUIPMENT';
            return (
              <tr key={i}>
                <td>{l.label}{free ? ' — zdarma / free' : ''}</td>
                <td className="num">{l.qty}</td>
                <td className="num">{free ? '—' : fmtMoney(l.unitPrice)}</td>
                <td className="num">{free ? '—' : fmtMoney(l.qty * l.unitPrice)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="p-totals">
        <div className="row"><span>Medzisúčet / Subtotal</span><span>{fmtMoney(sub)}</span></div>
        {(order.manualAdjustment || 0) !== 0 && (
          <div className="row"><span>Úprava / Adjustment</span><span>{fmtMoney(order.manualAdjustment)}</span></div>
        )}
        <div className="row grand"><span>Konečná suma / Total</span><span>{fmtMoney(total)}</span></div>
      </div>

      {order.notes && (
        <div style={{ marginTop: 4, fontSize: 9.5 }}>
          <strong>Poznámky / Notes: </strong>{order.notes}
        </div>
      )}

      <div className="p-terms">
        <div className="p-terms-title">PODMIENKY ZMLUVY / CONTRACT TERMS</div>
        <ol>
          {CONTRACT_TERMS.map((term, i) => (
            <li key={i}>
              <div className="t-grid">
                <div className="t-sk"><strong>SK:</strong> {term.sk}</div>
                <div className="t-en"><strong>EN:</strong> {term.en}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="p-sign">
        <div className="line">Podpis zákazníka / Customer signature</div>
        <div className="line">Podpis obsluhy / Operator signature</div>
      </div>

      <div className="p-foot">Ďakujeme za návštevu / Thank you for your visit · www.rafting-dunajec.sk</div>
    </div>
  );
}

function PrintRoot({ order, lang, show }) {
  if (!order) return null;
  return (
    <div className={'print-root' + (show ? ' show' : '')}>
      <PrintCopy order={order} />
      <PrintCopy order={order} />
    </div>
  );
}

export { OrdersView, CalendarView, SummaryView, OrderModal, PrintRoot, orderTotal };
