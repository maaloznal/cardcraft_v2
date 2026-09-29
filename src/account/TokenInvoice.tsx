'use client';

import { useRef, useState } from 'react';
import type { TokenRequest } from '@/core/types';
import { formatUsdt } from '@/account/payment-service';
import { cancelTokenRequest, updatePaymentHash } from '@/account/token-request-service';

function CopyField({ label, value, id }: { label: string; value: string; id: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return <div className="invoice-copy"><label htmlFor={id}>{label}</label><div><input id={id} readOnly value={value} onFocus={(event) => event.currentTarget.select()} /><button className="account-secondary" type="button" aria-label={`Копировать: ${label.toLowerCase()}`} onClick={async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setError(false); }
    catch { setError(true); }
  }}>{copied ? 'Скопировано ✓' : 'Копировать'}</button></div><span className="account-note" role="status">{error ? 'Выделите и скопируйте значение вручную.' : copied ? `${label}: скопировано` : ''}</span></div>;
}

function PaymentReference({ request, onSaved }: { request: TokenRequest; onSaved: () => void }) {
  const [hash, setHash] = useState(request.payment_tx_hash || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  return <form className="token-payment-reference" onSubmit={async (event) => {
    event.preventDefault(); if (locked.current) return; locked.current = true; setBusy(true); setError('');
    try { await updatePaymentHash(request.id, hash); onSaved(); }
    catch (cause) { setError((cause as Error).message); }
    finally { locked.current = false; setBusy(false); }
  }}><label htmlFor={`tx-${request.id}`}>Хеш транзакции (TXID)</label><p id={`tx-help-${request.id}`} className="account-note">Откройте перевод в своём кошельке, скопируйте ID или хеш транзакции и вставьте сюда. Это поможет найти вашу оплату.</p><input id={`tx-${request.id}`} aria-describedby={`tx-help-${request.id}`} value={hash} placeholder="Вставьте хеш из истории переводов" minLength={8} maxLength={128} required onChange={(event) => setHash(event.target.value.trim())} disabled={busy} /><button className="account-primary" disabled={busy || hash.length < 8 || hash === request.payment_tx_hash}>{busy ? 'Передаём платёж…' : request.payment_tx_hash ? 'Обновить хеш' : 'Я оплатил — передать на проверку'}</button>{error && <p role="alert" className="project-error">{error}</p>}</form>;
}

export default function TokenInvoice({ request, networkLabel, onSaved, onRefresh }: { request: TokenRequest; networkLabel: string; onSaved: () => void; onRefresh: () => void }) {
  const hasHash = !!request.payment_tx_hash;
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');
  const closeLock = useRef(false);
  return <article className="token-invoice" aria-labelledby="invoice-title">
    <div className="invoice-heading"><div><span className="account-eyebrow">АКТИВНОЕ ПОПОЛНЕНИЕ</span><h3 id="invoice-title">{hasHash ? 'Платёж передан на проверку' : 'Заявка создана. Следующий шаг — оплата'}</h3></div><span className="token-status token-status-pending">{hasHash ? 'На проверке' : 'Ожидает оплаты'}</span></div>
    <ol className="token-steps" aria-label="Этапы пополнения">{['Заявка', 'Оплата', 'Проверка', 'Начисление'].map((label, index) => <li key={label} data-complete={index < (hasHash ? 2 : 1)} aria-current={index === (hasHash ? 2 : 1) ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>
    <div className="invoice-summary"><div><span>Будет начислено</span><strong>{new Intl.NumberFormat('ru-RU').format(request.amount)} токенов</strong></div><div><span>К оплате</span><strong>{request.payment_amount_micros == null ? 'Сумма уточняется' : `${formatUsdt(request.payment_amount_micros)} USDT`}</strong></div></div>
    {hasHash ? <><p className="account-note">Администратор проверит поступление. После одобрения токены появятся на балансе автоматически. Повторно переводить оплату не нужно.</p><p className="token-tx-hash">TX: {request.payment_tx_hash}</p><details><summary>Исправить хеш транзакции</summary><PaymentReference key={request.payment_tx_hash} request={request} onSaved={onSaved} /></details></> : request.payment_amount_micros != null && request.payment_address ? <>
      <div className="invoice-network"><strong>USDT · {networkLabel}</strong><p>Выберите эту же сеть в кошельке. Комиссия кошелька оплачивается отдельно от указанной суммы.</p></div>
      <CopyField key={request.payment_address} id="invoice-address" label="Адрес получателя" value={request.payment_address} />
      <CopyField id="invoice-amount" label="Сумма USDT" value={String(request.payment_amount_micros / 1000000)} />
      <PaymentReference key={request.payment_tx_hash} request={request} onSaved={onSaved} />
    </> : <p className="account-note">Дождитесь согласования суммы с администратором перед переводом.</p>}
    <div className="invoice-footer"><small>Заявка №{request.id.slice(0, 8)} · {new Date(request.created_at).toLocaleDateString('ru-RU')}</small><button className="account-secondary" type="button" onClick={onRefresh}>Обновить статус</button></div>
    <div className="invoice-cancel">{confirmClose ? <div role="group" aria-label="Подтверждение закрытия заявки"><p><strong>Закрыть заявку?</strong> Если вы уже отправили деньги, дождитесь проверки оплаты. Закрытие заявки не возвращает перевод.</p><div className="invoice-cancel-actions"><button className="account-danger" disabled={closing} onClick={async () => {
      if (closeLock.current) return;
      closeLock.current = true; setClosing(true); setCloseError('');
      try { await cancelTokenRequest(request.id); onRefresh(); }
      catch (cause) { setCloseError((cause as Error).message); }
      finally { closeLock.current = false; setClosing(false); }
    }}>{closing ? 'Закрываем…' : 'Да, закрыть заявку'}</button><button className="account-secondary" disabled={closing} onClick={() => setConfirmClose(false)}>Оставить открытой</button></div></div> : <button className="account-secondary" onClick={() => setConfirmClose(true)}>Закрыть заявку</button>}{closeError && <p className="project-error" role="alert">{closeError}</p>}</div>
  </article>;
}
