'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TokenPaymentConfig, TokenRequest } from '@/core/types';
import { listTokenRequests, submitTokenRequest, updatePaymentHash } from '@/account/token-request-service';
import { formatUsdt, getTokenPaymentConfig, paymentMicros } from '@/account/payment-service';

const presets = [10_000, 50_000, 100_000, 500_000];
const n = (value: number) => new Intl.NumberFormat('ru-RU').format(value);
const statuses = { pending: 'На рассмотрении', approved: 'Одобрена', rejected: 'Отклонена' };

function PaymentReference({ request, onSaved }: { request: TokenRequest; onSaved: () => void }) {
  const [hash, setHash] = useState(request.payment_tx_hash || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form className="token-payment-reference" onSubmit={async (e) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await updatePaymentHash(request.id, hash); onSaved(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }}><label htmlFor={`tx-${request.id}`}>Уже оплатили? Прикрепите хеш транзакции</label><input id={`tx-${request.id}`} value={hash} minLength={8} maxLength={128} required onChange={(e) => setHash(e.target.value.trim())} disabled={busy} /><button className="account-secondary" disabled={busy || hash.length < 8 || hash === request.payment_tx_hash}>{busy ? 'Сохраняем…' : 'Передать платёж'}</button>{error && <p role="alert" className="project-error">{error}</p>}</form>;
}

export default function TokenRequests({ userId, onBalanceChange }: { userId: string; onBalanceChange: () => void }) {
  const [requests, setRequests] = useState<TokenRequest[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState('10000');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(0);
  const [payment, setPayment] = useState<TokenPaymentConfig | null>(null);
  const [network, setNetwork] = useState('ton');
  const [txHash, setTxHash] = useState('');
  const [copied, setCopied] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const requestId = useRef<string | null>(null);
  const previousPending = useRef<string | null>(null);
  const locked = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const rows = await listTokenRequests(userId, page);
      setRequests(rows);
      if (page === 0) {
        const pending = rows.find((r) => r.status === 'pending')?.id ?? null;
        if (previousPending.current && previousPending.current !== pending) onBalanceChange();
        previousPending.current = pending;
      }
      setError('');
    } catch (cause) { setError((cause as Error).message); }
    finally { setLoading(false); }
  }, [userId, page, onBalanceChange]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => { clearTimeout(timeout); clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    void getTokenPaymentConfig().then((config) => { if (active) setPayment(config); }).catch((cause: Error) => { if (active) setPaymentError(cause.message); });
    return () => { active = false; };
  }, [userId]);
  const pending = requests.find((r) => r.status === 'pending');
  const wallet = payment?.networks.find((item) => item.id === network);
  const value = Number(amount);
  const valid = /^\d+$/.test(amount) && Number.isSafeInteger(value) && value >= 10000 && value <= 1000000000;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || locked.current || !payment || !wallet) return;
    locked.current = true;
    setBusy(true); setError(''); setMessage('');
    requestId.current ??= crypto.randomUUID();
    try {
      const request = await submitTokenRequest(requestId.current, value, comment, { network, price: payment.price, txHash });
      requestId.current = null;
      previousPending.current = request.status === 'pending' ? request.id : null;
      setPage(0);
      setRequests((rows) => [request, ...rows.filter((r) => r.id !== request.id)].slice(0, 20));
      setExpanded(false); setComment(''); setTxHash('');
      setMessage(`Заявка на ${n(request.amount)} токенов ${request.status === 'pending' ? 'принята. Администратор рассмотрит её, статус появится здесь.' : 'уже обработана. Обновите историю.'}`);
    } catch (cause) { setError((cause as Error).message); }
    finally { locked.current = false; setBusy(false); }
  }

  return <section className="account-section token-section" aria-labelledby="token-heading">
    <div className="token-section-heading"><div><h2 id="token-heading">Нужно больше токенов?</h2><p className="account-note">Запросите пополнение от 10 000 токенов. Начисление — после одобрения администратором.</p></div>
      <button className="account-primary" type="button" aria-expanded={expanded} aria-controls="token-request-form" onClick={() => setExpanded(!expanded)} disabled={loading || busy || !payment || !!pending || page > 0}>{pending ? 'Заявка на рассмотрении' : 'Увеличить лимит'}</button>
    </div>
    {expanded && <form id="token-request-form" className="token-request-form" onSubmit={submit}>
      <fieldset disabled={busy}><legend>Выберите количество токенов</legend><div className="token-presets">{presets.map((preset) => <button type="button" key={preset} className={value === preset ? 'account-primary' : 'account-secondary'} aria-pressed={value === preset} onClick={() => { setAmount(String(preset)); requestId.current = null; }}>{n(preset)}</button>)}</div>
        <label htmlFor="token-amount">Или введите своё количество</label><input id="token-amount" type="number" inputMode="numeric" min="10000" max="1000000000" step="1" required value={amount} onChange={(e) => { setAmount(e.target.value); requestId.current = null; }} aria-describedby="token-minimum" />
        <p id="token-minimum" className="account-note">Минимум 10 000, максимум 1 000 000 000. Только целое количество.</p>
        <div className="token-payment">
          <h3>Оплата в USDT</h3>
          {payment?.price != null && valid ? <p className="token-payment-total">К оплате <strong>{formatUsdt(paymentMicros(value, payment.price))} USDT</strong></p> : <p className="account-note">Стоимость пока не установлена. Отправьте заявку и дождитесь согласования суммы с администратором перед переводом.</p>}
          <label htmlFor="payment-network">Сеть перевода</label><select id="payment-network" value={network} onChange={(e) => { setNetwork(e.target.value); setCopied(false); requestId.current = null; }}>{payment?.networks.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          <label htmlFor="payment-address">Адрес получателя</label><div className="token-wallet-address"><input id="payment-address" readOnly value={wallet?.address || ''} /><button type="button" className="account-secondary" onClick={async () => { try { await navigator.clipboard.writeText(wallet?.address || ''); setCopied(true); } catch { setPaymentError('Не удалось скопировать. Выделите адрес и скопируйте вручную.'); } }}>{copied ? 'Скопировано' : 'Копировать'}</button></div>
          <p className="account-note">Переводите именно USDT в выбранной сети {wallet?.label}. Комиссия сети оплачивается отдельно. Администратор проверит поступление перед начислением.</p>
          <label htmlFor="payment-tx">Хеш транзакции (если уже оплатили)</label><input id="payment-tx" value={txHash} maxLength={128} onChange={(e) => setTxHash(e.target.value.trim())} placeholder="TXID / hash" autoComplete="off" />
        </div>
        <label htmlFor="token-comment">Комментарий (необязательно)</label><textarea id="token-comment" rows={2} maxLength={500} value={comment} placeholder="Например: для подготовки материалов на месяц" onChange={(e) => setComment(e.target.value)} />
        <button className="account-primary" type="submit" disabled={!valid || busy}>{busy ? 'Отправляем…' : `Запросить ${valid ? n(value) : ''} токенов`}</button>
      </fieldset>
    </form>}
    {error && <p role="alert" className="project-error">{error} <button className="account-secondary" onClick={() => void refresh()} type="button">Обновить</button></p>}
    {paymentError && <p role="alert" className="project-error">{paymentError}</p>}
    {message && <p role="status" className="token-success">{message}</p>}
    <details className="token-history" open={!!pending || undefined}><summary>История заявок</summary>
      {loading ? <p className="account-note">Загрузка…</p> : requests.length === 0 ? <p className="account-note">Заявок пока нет.</p> : requests.map((request) => <article className="token-history-row" key={request.id}>
        <div><strong>{n(request.amount)} токенов</strong><small>{new Date(request.created_at).toLocaleString('ru-RU')}</small>{request.payment_amount_micros != null && <small>{formatUsdt(request.payment_amount_micros)} USDT · {request.payment_network}</small>}{request.payment_address && <p className="token-tx-hash">USDT · {request.payment_network}<br />{request.payment_address}</p>}{request.payment_tx_hash && <p className="token-tx-hash">TX: {request.payment_tx_hash}</p>}{request.admin_note && <p>{request.admin_note}</p>}{request.status === 'pending' && <PaymentReference key={request.payment_tx_hash} request={request} onSaved={() => { setMessage('Хеш транзакции передан администратору.'); void refresh(); }} />}</div>
        <span className={`token-status token-status-${request.status}`}>{statuses[request.status]}</span>
      </article>)}
      <div className="token-pagination"><button className="account-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</button><span>Страница {page + 1}</span><button className="account-secondary" disabled={requests.length < 20} onClick={() => setPage(page + 1)}>Далее</button></div>
    </details>
  </section>;
}
