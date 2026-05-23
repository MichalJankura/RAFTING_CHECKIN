// ============================================================
// RAFTING DUNAJEC — App shell
// ============================================================
import React, { useState as useS, useEffect as useE } from 'react';
import { Icon } from './icons.jsx';
import { t } from './catalog.jsx';
import {
  loadOrders, toggleOrderStatus, deleteOrder,
  loadOperator, saveOperator,
  sanitizeOperator, downloadJSON, fmtDate, fmtTime, dateKey,
} from './storage.jsx';
import { CheckIn } from './checkin.jsx';
import { OrdersView, CalendarView, SummaryView, OrderModal, PrintRoot } from './views.jsx';
import { PricelistView } from './pricelist.jsx';

function Brand({ lang }) {
  return (
    <div className="brand">
      <img src="logo.png" alt="Rafting Dunajec" className="brand-mark" />
      <div>
        <div className="brand-name">RAFTING DUNAJEC</div>
        <div className="brand-sub">{lang === 'sk' ? 'Check-in systém' : 'Check-in system'}</div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button className={'nav-item' + (active ? ' active' : '')} onClick={onClick}>
      <span className="nav-icon"><Icon name={icon} size={15} /></span>
      <span>{label}</span>
    </button>
  );
}

function App() {
  const [lang, setLang] = useS(() => localStorage.getItem('rd_lang') || 'sk');
  const [view, setView] = useS(() => {
    const VIEWS = ['checkin', 'orders', 'calendar', 'summary', 'pricelist'];
    const hash = window.location.hash.slice(1);
    return VIEWS.includes(hash) ? hash : 'checkin';
  });
  const [orders, setOrders] = useS([]);
  const [ordersLoading, setOrdersLoading] = useS(true);
  const [operator, setOperator] = useS(() => loadOperator());
  const [toast, setToast] = useS(null);
  const [openOrder, setOpenOrder] = useS(null);
  const [printOrder, setPrintOrder] = useS(null);
  const [printing, setPrinting] = useS(false);
  const [editingOrder, setEditingOrder] = useS(null);
  const [pricingVersion, setPricingVersion] = useS(0);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useS(null);

  useE(() => { localStorage.setItem('rd_lang', lang); }, [lang]);
  useE(() => { window.location.hash = view; }, [view]);

  useE(() => {
    loadOrders()
      .then(setOrders)
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, []);

  useE(() => {
    const sync = () => {
      loadOrders()
        .then(fresh => {
          setOrders(fresh);
          setOpenOrder(cur => cur ? (fresh.find(o => o.id === cur.id) ?? cur) : null);
        })
        .catch(() => {});
    };
    const id = setInterval(sync, 15_000);
    const onVisible = () => { if (!document.hidden) sync(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const [now, setNow] = useS(new Date());
  useE(() => {
    const timer = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg, kind) => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  };

  const handleSaved = (savedOrder) => {
    setOrders(cur => {
      const idx = cur.findIndex(o => o.id === savedOrder.id);
      if (idx >= 0) {
        const next = [...cur];
        next[idx] = savedOrder;
        return next;
      }
      return [savedOrder, ...cur];
    });
    const wasEdit = !!editingOrder;
    setEditingOrder(null);
    showToast(
      `${wasEdit ? (lang === 'sk' ? 'Objednávka upravená' : 'Order updated') : t('order_saved', lang)} · #${savedOrder.number}`,
      'success'
    );
    setOpenOrder(savedOrder);
  };

  const handleEdit = (order) => {
    setOpenOrder(null);
    setEditingOrder(order);
    setView('checkin');
  };

  const handleToggleCompleted = async (order) => {
    const newStatus = order.status === 'complete' ? 'pending' : 'complete';
    try {
      const updated = await toggleOrderStatus(order.id, newStatus);
      const mapped = { ...order, status: updated.status, completed: updated.completed, completedAt: updated.completedAt };
      setOrders(cur => cur.map(o => o.id === order.id ? mapped : o));
      setOpenOrder(mapped);
      showToast(
        mapped.completed
          ? (lang === 'sk' ? `Označené ako vybavené · #${mapped.number}` : `Marked completed · #${mapped.number}`)
          : (lang === 'sk' ? `Označené ako nevybavené · #${mapped.number}` : `Marked pending · #${mapped.number}`),
        mapped.completed ? 'success' : ''
      );
    } catch (e) {
      showToast(lang === 'sk' ? 'Chyba pri zmene stavu' : 'Status update failed', 'error');
    }
  };

  const handleNewOrder = () => {
    setEditingOrder(null);
    setView('checkin');
  };

  const handlePricingChanged = (action) => {
    setPricingVersion(v => v + 1);
    showToast(action === 'reset' ? t('prices_reset', lang) : t('prices_saved', lang), 'success');
  };

  const handleDelete = (order) => {
    setDeleteConfirmOrder(order);
  };

  const handleDeleteConfirm = async () => {
    const order = deleteConfirmOrder;
    setDeleteConfirmOrder(null);
    try {
      await deleteOrder(order.id);
      setOrders(cur => cur.filter(o => o.id !== order.id));
      setOpenOrder(null);
      showToast(
        lang === 'sk' ? `Objednávka #${order.number} bola vymazaná` : `Order #${order.number} deleted`,
        'error'
      );
    } catch (e) {
      showToast(lang === 'sk' ? 'Chyba pri mazaní' : 'Delete failed', 'error');
    }
  };

  const handlePrint = (order) => {
    setPrintOrder(order);
    setPrinting(true);
    setOpenOrder(null);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrinting(false), 200);
    }, 60);
  };

  const handleExportAll = () => {
    downloadJSON(`rafting-dunajec-orders-${dateKey(new Date().toISOString())}.json`, orders);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.reload();
    }
  };

  const titleByView = {
    checkin:   { sk: editingOrder ? `Úprava objednávky #${editingOrder.number}` : 'Nová objednávka', en: editingOrder ? `Editing order #${editingOrder.number}` : 'New order' },
    orders:    { sk: 'Objednávky',       en: 'Orders' },
    calendar:  { sk: 'Kalendár',         en: 'Calendar' },
    summary:   { sk: 'Denný prehľad',    en: 'Daily summary' },
    pricelist: { sk: 'Cenník',           en: 'Pricelist' },
  };

  return (
    <>
      <div className="app">
        <aside className="sidebar">
          <Brand lang={lang} />
          <NavItem icon="plus"     label={t('nav_checkin', lang)}  active={view === 'checkin'}  onClick={handleNewOrder} />
          <NavItem icon="list"     label={t('nav_orders', lang)}   active={view === 'orders'}   onClick={() => { setEditingOrder(null); setView('orders'); }} />
          <NavItem icon="calendar" label={t('nav_calendar', lang)} active={view === 'calendar'} onClick={() => { setEditingOrder(null); setView('calendar'); }} />
          <NavItem icon="chart"    label={t('nav_summary', lang)}  active={view === 'summary'}  onClick={() => { setEditingOrder(null); setView('summary'); }} />
          <NavItem icon="receipt"  label={t('nav_pricelist', lang)} active={view === 'pricelist'} onClick={() => { setEditingOrder(null); setView('pricelist'); }} />

          <div className="sidebar-foot">
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>
                {t('operator', lang)}
              </div>
              <input value={operator}
                     onChange={(e) => { const v = sanitizeOperator(e.target.value); setOperator(v); saveOperator(v); }}
                     maxLength={30}
                     style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: '#fff', padding: '6px 8px', borderRadius: 4, fontSize: 12 }} />
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleLogout}
              style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
            >
              <Icon name="arrow" size={13} />
              {lang === 'sk' ? 'Odhlásiť' : 'Log out'}
            </button>
            <div className="mono" style={{ fontSize: 11 }}>
              {fmtDate(now.toISOString())} · {fmtTime(now.toISOString())}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,.4)' }}>
              Pieniny National Park · SK
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div>
              <div className="crumb">{lang === 'sk' ? 'Recepcia' : 'Reception'}</div>
              <div className="title">{titleByView[view][lang]}</div>
            </div>
            <div className="topbar-actions">
              {view !== 'checkin' && (
                <button className="btn btn-accent" onClick={handleNewOrder}>
                  <Icon name="plus" size={14} /> {t('new_order', lang)}
                </button>
              )}
              <div className="lang-toggle">
                <button className={lang === 'sk' ? 'active' : ''} onClick={() => setLang('sk')}>SK</button>
                <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
              </div>
            </div>
          </header>

          <main className="view">
            {ordersLoading && view !== 'checkin' && (
              <div className="empty" style={{ paddingTop: 60 }}>
                {lang === 'sk' ? 'Načítavam objednávky…' : 'Loading orders…'}
              </div>
            )}
            {view === 'checkin' && (
              <CheckIn key={(editingOrder?.id || 'new') + '-' + pricingVersion}
                       lang={lang}
                       onSaved={handleSaved}
                       prefill={editingOrder}
                       isEdit={!!editingOrder}
                       onCancelEdit={() => { setEditingOrder(null); setView('orders'); }} />
            )}
            {view === 'orders' && !ordersLoading && <OrdersView lang={lang} orders={orders} onOpen={setOpenOrder} onExportAll={handleExportAll} />}
            {view === 'calendar' && !ordersLoading && <CalendarView lang={lang} orders={orders} onOpen={setOpenOrder} />}
            {view === 'summary' && !ordersLoading && <SummaryView lang={lang} orders={orders} />}
            {view === 'pricelist' && <PricelistView key={pricingVersion} lang={lang} onChanged={handlePricingChanged} />}
          </main>
        </div>
      </div>

      <OrderModal order={openOrder} lang={lang}
                  onClose={() => setOpenOrder(null)}
                  onPrint={handlePrint}
                  onEdit={handleEdit}
                  onToggleCompleted={handleToggleCompleted}
                  onDelete={handleDelete} />

      {deleteConfirmOrder && (
        <div className="modal-bg" onClick={() => setDeleteConfirmOrder(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {lang === 'sk' ? 'Potvrdiť vymazanie' : 'Confirm deletion'}
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2 }}>
                  {lang === 'sk' ? 'Zmazať objednávku?' : 'Delete order?'}
                </div>
              </div>
              <button className="btn btn-ghost" onClick={() => setDeleteConfirmOrder(null)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-confirm-box">
                <Icon name="trash" size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    #{deleteConfirmOrder.number} — {deleteConfirmOrder.customer.name} {deleteConfirmOrder.customer.surname}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {lang === 'sk'
                      ? 'Táto akcia je nevratná. Objednávka bude trvalo vymazaná zo systému.'
                      : 'This action cannot be undone. The order will be permanently removed from the system.'}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setDeleteConfirmOrder(null)}>
                {lang === 'sk' ? 'Zrušiť' : 'Cancel'}
              </button>
              <span style={{ flex: 1 }} />
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>
                <Icon name="trash" size={14} />
                {lang === 'sk' ? 'Áno, zmazať' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PrintRoot order={printOrder} lang={lang} show={printing} />

      <div className="toast-stack">
        {toast && (
          <div className={'toast ' + (toast.kind || '')}>
            <Icon name="check" size={14} />
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
}

export default App;
