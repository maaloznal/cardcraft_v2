'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TokenPaymentConfig, TokenRequest } from '@/core/types';
import { getPendingTokenRequest, listTokenRequests, submitTokenRequest } from '@/account/token-request-service';
import { formatUsdt, getTokenPaymentConfig, paymentMicros } from '@/account/payment-service';
import TokenInvoice from '@/account/TokenInvoice';

const presets = [10_000, 50_000, 100_000, 500_000];
const n = (value: number) => new Intl.NumberFormat('ru-RU').format(value);
const statuses = { pending: 'Ожидает оплаты', approved: 'Начислено', rejected: 'Отклонено', cancelled: 'Закрыта вами' };

export default function TokenRequests({ userId, onBalanceChange }: { userId: string; onBalanceChange: () => void }) {
  const [requests, setRequests] = useState<TokenRequest[]>([]);
  const [pending, setPending] = useState<TokenRequest | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState('10000');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(0);
  const [payment, setPayment] = useState<TokenPaymentConfig | null>(null);
  const [provider, setProvider] = useState<'crypto_pay' | 'manual'>('crypto_pay');
  const [network, setNetwork] = useState('ton');
  const [paymentError, setPaymentError] = useState('');
  const requestId = useRef<string | null>(null);
  const previousPending = useRef<string | null>(null);
  const locked = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    try {
      const active = await getPendingTokenRequest(userId);
      const rows = await listTokenRequests(userId, page);
      if (version !== generation.current) return;
      setRequests(rows); setPending(active);
      if (previousPending.current && previousPending.current !== active?.id) {
        onBalanceChange();
        const resolved = rows.find((item) => item.id === previousPending.current);
        setMessage(resolved?.status === 'approved' ? `Готово! ${n(resolved.amount)} токенов зачислено. Можно продолжать работу.` : resolved?.status === 'cancelled' ? 'Заявка закрыта. При необходимости можно создать новую.' : 'Статус заявки изменился. Подробности — в истории пополнений.');
      }
      previousPending.current = active?.id ?? null;
      setError('');
    } catch (cause) { if (version === generation.current) setError((cause as Error).message); }
    finally { if (version === generation.current) setLoading(false); }
  }, [userId, page, onBalanceChange]);
  const loadPayment = useCallback(async () => {
    try {
      const config = await getTokenPaymentConfig();
      setPayment(config); setPaymentError('');
      setNetwork((current) => config.networks.some((item) => item.id === current) ? current : config.networks[0]?.id ?? '');
    } catch (cause) { setPaymentError((cause as Error).message); }
  }, []);
  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => { if (!document.hidden && !locked.current) void refresh(); }, 15000);
    const focus = () => { if (!locked.current) void refresh(); };
    window.addEventListener('focus', focus);
    return () => { clearTimeout(timeout); clearInterval(timer); window.removeEventListener('focus', focus);
      // Request generation is intentionally invalidated when the user/page changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
    };
  }, [refresh]);
  useEffect(() => { const timer = window.setTimeout(() => void loadPayment(), 0); return () => clearTimeout(timer); }, [loadPayment]);
  const value = Number(amount);
  const valid = /^\d+$/.test(amount) && Number.isSafeInteger(value) && value >= 10000 && value <= 1000000000;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || locked.current || !payment || pending || (provider === 'manual' && !network)) return;
    locked.current = true; ++generation.current;
    setBusy(true); setError(''); setMessage(''); requestId.current ??= crypto.randomUUID();
    try {
      const request = await submitTokenRequest(requestId.current, value, comment, { provider, network: provider === 'crypto_pay' ? 'crypto_pay' : network, price: payment.price, txHash: '' });
      requestId.current = null;
      previousPending.current = request.status === 'pending' ? request.id : null;
      setPending(request.status === 'pending' ? request : null);
      setPage(0); setRequests((rows) => [request, ...rows.filter((item) => item.id !== request.id)].slice(0, 20));
      setExpanded(false); setComment('');
      setMessage(request.status === 'pending' ? (request.payment_provider === 'crypto_pay' ? 'Счёт создан. Оплатите его в Crypto Bot — токены начислятся автоматически.' : 'Заявка создана. Переведите USDT по реквизитам и отправьте хеш транзакции.') : 'Заявка уже обработана. Проверьте историю пополнений.');
    } catch (cause) { setError((cause as Error).message); }
    finally { locked.current = false; setBusy(false); setLoading(false); }
  }

  return <section id="tokens" className="account-section token-section" aria-labelledby="token-heading">
    <div className="token-section-heading"><div><span className="account-eyebrow">БАЛАНС И ПОПОЛНЕНИЕ</span><h2 id="token-heading">Больше токенов для ваших идей</h2><p className="account-note">Выберите пакет и способ оплаты: Crypto Bot или перевод USDT вручную. Минимальная сумма — 1 USDT.</p></div>
      {!pending && <button className="account-primary" type="button" aria-expanded={expanded} aria-controls="token-request-form" onClick={() => setExpanded(!expanded)} disabled={loading || busy || !payment}>{expanded ? 'Свернуть' : 'Пополнить баланс'}</button>}
    </div>
    {message && <p role="status" className="token-success">{message}</p>}
    {pending && <TokenInvoice request={pending} networkLabel={payment?.networks.find((item) => item.id === pending.payment_network)?.label || pending.payment_network || ''} onSaved={() => { setMessage('Платёж передан на проверку. Статус обновится здесь автоматически.'); void refresh(); }} onRefresh={() => void refresh()} />}
    {expanded && !pending && <form id="token-request-form" className="token-request-form" onSubmit={submit}>
      <fieldset disabled={busy}><legend>1. Выберите количество токенов</legend><div className="token-presets">{presets.map((preset) => <button type="button" key={preset} className={value === preset ? 'token-package selected' : 'token-package'} aria-pressed={value === preset} onClick={() => { setAmount(String(preset)); requestId.current = null; }}><strong>{n(preset)}</strong><span>токенов</span><small>{payment?.price != null ? `${formatUsdt(paymentMicros(preset, payment.price))} USDT` : 'По согласованию'}</small></button>)}</div>
        <label htmlFor="token-amount">Или введите своё количество</label><input id="token-amount" type="number" inputMode="numeric" min="10000" max="1000000000" step="1" required value={amount} onChange={(event) => { setAmount(event.target.value); requestId.current = null; }} aria-describedby="token-minimum" />
        <p id="token-minimum" className="account-note">От 10 000 токенов. Стоимость рассчитывается автоматически.</p>
        <div className="token-payment-methods" role="group" aria-label="Способ оплаты">
          <button type="button" className="token-payment-method" aria-pressed={provider === 'crypto_pay'} onClick={() => { setProvider('crypto_pay'); requestId.current = null; }}><strong>Crypto Bot</strong><span>Автоматическое начисление</span></button>
          <button type="button" className="token-payment-method" aria-pressed={provider === 'manual'} onClick={() => { setProvider('manual'); requestId.current = null; }}><strong>Перевод вручную</strong><span>По реквизитам, с проверкой оплаты</span></button>
        </div>
        {provider === 'manual' && <div className="token-payment"><label htmlFor="payment-network">Сеть перевода USDT</label><select id="payment-network" value={network} onChange={(event) => { setNetwork(event.target.value); requestId.current = null; }}>{payment?.networks.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><p className="account-note">Переведите точную сумму в выбранной сети. После перевода отправьте хеш транзакции — администратор проверит поступление.</p>{!network && <p role="alert">Ручной перевод пока недоступен: реквизиты не настроены.</p>}</div>}
        <details className="token-comment-details"><summary>Добавить комментарий</summary><label htmlFor="token-comment">Комментарий (необязательно)</label><textarea id="token-comment" rows={2} maxLength={500} value={comment} placeholder="Что важно знать администратору?" onChange={(event) => setComment(event.target.value)} /></details>
        <div className="token-checkout"><div><span>Вы получите {valid ? `${n(value)} токенов` : 'выбранное количество токенов'}</span><p className="token-payment-total">К оплате <strong>{payment?.price != null && valid ? `${formatUsdt(paymentMicros(value, payment.price))} USDT` : 'По согласованию'}</strong></p></div><button className="account-primary" type="submit" disabled={!valid || busy || !payment || (provider === 'manual' && !network)}>{busy ? 'Создаём заявку…' : 'Создать заявку и перейти к оплате'}</button></div>
        <p className="account-note">{provider === 'crypto_pay' ? 'Нажатие кнопки не списывает деньги. После создания счёта откройте Crypto Bot для оплаты.' : 'После создания заявки появятся адрес и сумма перевода. Комиссия сети оплачивается отдельно.'}</p>
      </fieldset>
    </form>}
    {error && <p role="alert" className="project-error">{error} <button className="account-secondary" onClick={() => { void refresh(); void loadPayment(); }} type="button">Повторить</button></p>}
    {paymentError && <p role="alert" className="project-error">{paymentError} <button className="account-secondary" onClick={() => void loadPayment()} type="button">Загрузить реквизиты</button></p>}
    <details className="token-history"><summary>История пополнений{requests.length > 0 ? ` · ${requests.length}${requests.length === 20 ? '+' : ''}` : ''}</summary>
      {loading ? <p className="account-note">Загрузка…</p> : requests.length === 0 ? <div className="account-empty-note"><strong>Ваша история начнётся здесь</strong><p>После первого пополнения вы увидите сумму, статус и начисленные токены.</p></div> : requests.map((request) => <article className="token-history-row" key={request.id}>
        <div><strong>{n(request.amount)} токенов</strong><small>{new Date(request.created_at).toLocaleString('ru-RU')} · №{request.id.slice(0, 8)}</small>{request.payment_amount_micros != null && <small>{formatUsdt(request.payment_amount_micros)} USDT · {payment?.networks.find((item) => item.id === request.payment_network)?.label || request.payment_network}</small>}{request.admin_note && <p>Комментарий администратора: {request.admin_note}</p>}{request.status === 'rejected' && <p className="account-note">Если вы уже перевели оплату, сохраните хеш транзакции и укажите его в комментарии новой заявки.</p>}</div>
        <span className={`token-status token-status-${request.status}`}>{statuses[request.status]}</span>
      </article>)}
      {(page > 0 || requests.length >= 20) && <div className="token-pagination"><button className="account-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</button><span>Страница {page + 1}</span><button className="account-secondary" disabled={requests.length < 20} onClick={() => setPage(page + 1)}>Далее</button></div>}
    </details>
    <details className="account-token-help"><summary>Как работают токены и оплата?</summary><p>Токены используются для ИИ-генерации. Стоимость конкретного запроса зависит от объёма текста и ответа ИИ. Редактирование карточек и экспорт не требуют токенов.</p><p>При оплате через Crypto Bot токены начисляются автоматически. При ручном переводе отправьте хеш транзакции и дождитесь проверки администратором. Статус и баланс обновляются в кабинете.</p></details>
  </section>;
}
