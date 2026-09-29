'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminTokenRequest, TokenAdminOverview } from '@/core/types';
import { formatUsdt } from '@/account/payment-service';
import './admin.css';

const n = (v: number) => new Intl.NumberFormat('ru-RU').format(v);
const statusNames = { pending: 'Ожидает', approved: 'Одобрена', rejected: 'Отклонена' };
type TelegramWindow = Window & { Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void } } };

export default function AdminPage() {
  const [initData, setInitData] = useState('');
  const [data, setData] = useState<TokenAdminOverview | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<{ request: AdminTokenRequest; decision: 'approved' | 'rejected' } | null>(null);
  const [kind, setKind] = useState('purchase');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const sequence = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);
  const start = () => {
    const app = (window as TelegramWindow).Telegram?.WebApp;
    if (app?.initData) { setInitData(app.initData); app.ready(); app.expand(); }
  };
  const api = useCallback(async (body: Record<string, unknown>) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) throw new Error('Сервис не настроен.');
    const response = await fetch(`${url}/functions/v1/telegram-admin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, initData }), cache: 'no-store', signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось выполнить запрос.');
    return result;
  }, [initData]);
  const load = useCallback(async () => {
    if (!initData) return;
    const version = ++sequence.current;
    setLoading(true);
    try {
      const result = await api({ action: 'list', status, search: query, userId, page });
      if (version === sequence.current) { setData(result); setError(''); }
    } catch (cause) { if (version === sequence.current) { setError((cause as Error).message); setData(null); } }
    finally { if (version === sequence.current) setLoading(false); }
  }, [api, initData, status, query, userId, page]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => { if (!document.hidden && !locked.current) void load(); }, 30000);
    return () => { clearTimeout(timer); clearInterval(interval);
      // This ref is a request generation counter, not a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++sequence.current;
    };
  }, [load]);
  useEffect(() => { if (selection) dialog.current?.showModal(); else dialog.current?.close(); }, [selection]);
  const decide = async () => {
    if (!selection || locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const result = await api({ action: 'decide', id: selection.request.id, decision: selection.decision, kind, note });
      setSelection(null); setNote('');
      setNotice(result.changed ? 'Решение сохранено.' : 'Заявка уже обработана. Баланс повторно не изменялся.');
      await load();
    } catch (cause) { setError((cause as Error).message); }
    finally { locked.current = false; setBusy(false); }
  };
  const retry = async () => {
    setBusy(true);
    try { const result = await api({ action: 'retry' }); setNotice(`Отправлено уведомлений: ${result.sent}`); await load(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };

  return <main className="admin-page">
    <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onReady={start} onError={() => setError('Не удалось подключиться к Telegram. Откройте мини-приложение повторно.')} />
    <header className="admin-header"><div><span className="admin-kicker">CARDCRAFT / УПРАВЛЕНИЕ</span><h1>Токены и клиенты</h1><p>Заявки, начисления и активность проекта.</p></div><button className="account-secondary" onClick={() => void load()} disabled={!initData || loading}>Обновить</button></header>
    {!initData && <section className="admin-empty"><h2>Откройте через Telegram</h2><p>В личном чате с ботом отправьте /start и нажмите «Открыть админку». Доступ разрешён только владельцу.</p></section>}
    {error && <p role="alert" className="project-error">{error}</p>}{notice && <p role="status" className="token-success">{notice}</p>}
    {data && <>
      <section className="admin-stats" aria-label="Общая статистика">{[
        ['Ожидают решения', data.stats.pending], ['Пользователей', data.stats.users], ['Куплено токенов', data.stats.purchased], ['Использовано токенов', data.stats.used], ['Бонусных токенов', data.stats.granted], ['Проектов', data.stats.projects],
      ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{n(Number(value))}</strong></div>)}</section>
      <p className="account-note">Стартовые 50 000 токенов не входят в покупки и бонусные начисления. Покупки считаются по заявкам, одобренным после проверки оплаты. Статистика накопительная.</p>
      {data.stats.undelivered > 0 && <div className="admin-delivery"><span>Ожидают отправки в Telegram: {data.stats.undelivered}</span><button className="account-secondary" disabled={busy} onClick={() => void retry()}>Повторить доставку</button></div>}
      <section className="admin-requests" aria-busy={loading}>
        <div className="admin-toolbar"><h2>{userId ? 'История клиента' : 'Заявки'} <span>{data.total}</span></h2>{userId && <button className="account-secondary" onClick={() => { setUserId(null); setPage(0); }}>Все клиенты</button>}</div>
        <form className="admin-search" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(0); }}><label htmlFor="admin-search">Поиск по email или номеру заявки</label><div><input id="admin-search" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={200} placeholder="client@example.com" /><button className="account-secondary">Найти</button></div></form>
        <div className="admin-filters" aria-label="Статус заявок">{[['pending', 'Ожидают'], ['approved', 'Одобрены'], ['rejected', 'Отклонены'], ['all', 'Все']].map(([value, label]) => <button type="button" className={status === value ? 'account-primary' : 'account-secondary'} aria-pressed={status === value} key={value} onClick={() => { setStatus(value); setPage(0); }}>{label}</button>)}</div>
        {data.requests.length === 0 && <div className="admin-empty"><h3>Заявок нет</h3><p>Новые запросы клиентов появятся здесь.</p></div>}
        <div className="admin-request-list">{data.requests.map((request) => <article className="admin-request" key={request.id}>
          <div className="admin-request-top"><div><strong>{request.email || 'Без email'}</strong><small>{new Date(request.created_at).toLocaleString('ru-RU')}</small></div><span className={`token-status token-status-${request.status}`}>{statusNames[request.status]}</span></div>
          <h3>+{n(request.amount)} <span>токенов</span></h3>
          <dl className="admin-client-stats"><div><dt>Баланс</dt><dd>{request.unlimited_tokens ? 'Без ограничений' : n(request.token_balance)}</dd></div><div><dt>Куплено</dt><dd>{n(request.tokens_purchased)}</dd></div><div><dt>Использовано</dt><dd>{n(request.tokens_used)}</dd></div><div><dt>Бонусы</dt><dd>{n(request.tokens_granted)}</dd></div></dl>
          {request.comment && <p className="admin-comment">{request.comment}</p>}{request.admin_note && <p className="admin-comment">Решение: {request.admin_note}</p>}
          {request.payment_network && <div className="admin-payment"><strong>{request.payment_amount_micros == null ? 'Сумма не согласована' : `${formatUsdt(request.payment_amount_micros)} USDT`} · {request.payment_network}</strong><p>Адрес: {request.payment_address}</p><p>Транзакция: {request.payment_tx_hash || 'не указана'}</p></div>}
          <small className="admin-request-id">Заявка {request.id}</small>
          <div className="admin-request-actions"><button className="account-secondary" onClick={() => { setUserId(request.user_id); setStatus('all'); setQuery(''); setSearch(''); setPage(0); }}>История клиента</button>{request.status === 'pending' && <><button className="account-primary" disabled={busy || loading} onClick={() => { setNote(''); setKind('purchase'); setSelection({ request, decision: 'approved' }); }}>Одобрить</button><button className="account-danger" disabled={busy || loading} onClick={() => { setNote(''); setSelection({ request, decision: 'rejected' }); }}>Отклонить</button></>}</div>
        </article>)}</div>
        <div className="token-pagination"><button className="account-secondary" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Назад</button><span>{page + 1} / {Math.max(1, Math.ceil(data.total / 20))}</span><button className="account-secondary" disabled={(page + 1) * 20 >= data.total || loading} onClick={() => setPage(page + 1)}>Далее</button></div>
      </section>
    </>}
    {loading && !data && <p role="status">Загружаем данные…</p>}
    <dialog ref={dialog} className="admin-dialog" aria-labelledby="decision-title" onCancel={(e) => { if (busy) e.preventDefault(); else setSelection(null); }}>
      {selection && <form onSubmit={(e) => { e.preventDefault(); void decide(); }}><h2 id="decision-title">{selection.decision === 'approved' ? 'Начислить токены?' : 'Отклонить заявку?'}</h2><p>{selection.request.email} · {n(selection.request.amount)} токенов</p>
        {selection.decision === 'approved' && <><label htmlFor="credit-kind">Основание начисления</label><select id="credit-kind" value={kind} onChange={(e) => setKind(e.target.value)} disabled={busy}><option value="purchase">Оплата проверена — покупка</option><option value="grant">Бесплатное начисление — бонус</option></select></>}
        <label htmlFor="decision-note">Комментарий клиенту</label><textarea id="decision-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} disabled={busy} rows={3} />
        {error && <p role="alert" className="project-error">{error}</p>}
        <div className="admin-request-actions"><button type="button" className="account-secondary" disabled={busy} onClick={() => setSelection(null)}>Отмена</button><button className="account-primary" disabled={busy}>{busy ? 'Сохраняем…' : 'Подтвердить'}</button></div>
      </form>}
    </dialog>
  </main>;
}
