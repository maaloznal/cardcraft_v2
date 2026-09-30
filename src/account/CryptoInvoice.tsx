'use client';

import { useState } from 'react';
import type { TokenRequest } from '@/core/types';
import { cancelTokenRequest, createCryptoInvoice } from '@/account/token-request-service';
import { formatUsdt } from '@/account/payment-service';
import { safeInvoiceUrl } from '../../supabase/functions/_shared/crypto-pay-contract';

export default function CryptoInvoice({ request, onRefresh }: { request: TokenRequest; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  async function act(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); onRefresh(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <article className="token-invoice" aria-labelledby="crypto-invoice-title">
    <div className="invoice-heading"><div><span className="account-eyebrow">ОПЛАТА ЧЕРЕЗ CRYPTO BOT</span><h3 id="crypto-invoice-title">Оплатите счёт — токены начислятся автоматически</h3></div><span className="token-status token-status-pending">Ожидает оплаты</span></div>
    <div className="invoice-summary"><div><span>Будет начислено</span><strong>{request.amount.toLocaleString('ru-RU')} токенов</strong></div><div><span>К оплате</span><strong>{formatUsdt(request.payment_amount_micros ?? 0)} USDT</strong></div></div>
    <p className="account-note">Откройте счёт в Crypto Bot и подтвердите оплату. После поступления платежа баланс обновится автоматически. Отправлять хеш транзакции не нужно.</p>
    {safeInvoiceUrl(request.crypto_invoice_url) ? <a className="account-primary" href={request.crypto_invoice_url} target="_blank" rel="noopener noreferrer">Оплатить в Crypto Bot ↗</a> : <button className="account-primary" disabled={busy} onClick={() => void act(() => createCryptoInvoice(request.id))}>{busy ? 'Создаём счёт…' : 'Получить ссылку на оплату'}</button>}
    {request.crypto_expires_at && <p className="account-note">Счёт действует до {new Date(request.crypto_expires_at).toLocaleString('ru-RU')}. После истечения срока можно создать новый.</p>}
    <div className="invoice-footer"><small>Счёт №{request.crypto_invoice_id || request.id.slice(0, 8)}</small><button className="account-secondary" disabled={busy} onClick={onRefresh}>Проверить оплату</button></div>
    <div className="invoice-cancel">{confirmClose ? <><p>Закрыть неоплаченный счёт? Подтверждённый платёж будет зачислен автоматически.</p><div className="invoice-cancel-actions"><button className="account-danger" disabled={busy} onClick={() => void act(() => cancelTokenRequest(request.id))}>Закрыть счёт</button><button className="account-secondary" disabled={busy} onClick={() => setConfirmClose(false)}>Оставить</button></div></> : <button className="account-secondary" disabled={busy} onClick={() => setConfirmClose(true)}>Отменить оплату</button>}</div>
    {error && <p role="alert" className="project-error">{error}</p>}
  </article>;
}
