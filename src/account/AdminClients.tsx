'use client';

import { useEffect, useState } from 'react';
import type { AdminClient, AdminClientList } from '@/core/types';

const number = (value: number) => new Intl.NumberFormat('ru-RU').format(value);
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('ru-RU') : 'Ещё не входил';

export default function AdminClients({ api, onHistory }: {
  api: (body: Record<string, unknown>) => Promise<AdminClientList>;
  onHistory: (client: AdminClient) => void;
}) {
  const [data, setData] = useState<AdminClientList | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void api({ action: 'clients', page, search: query }).then((result) => {
        if (active) { setData(result); setError(''); }
      }).catch((cause: Error) => { if (active) { setData(null); setError(cause.message); } }).finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [api, page, query, revision]);
  return <section className="admin-requests" aria-labelledby="clients-heading" aria-busy={loading}>
    <div className="admin-toolbar"><h2 id="clients-heading">Зарегистрированные клиенты {data && <span>{data.total}</span>}</h2><button className="account-secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Обновить список</button></div>
    <p className="account-note">Все аккаунты, в том числе без покупок и заявок. Сначала — новые регистрации.</p>
    <form className="admin-search" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(0); }}>
      <label htmlFor="client-search">Поиск по имени, email или ID клиента</label><div><input id="client-search" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={200} placeholder="Имя или email" /><button className="account-secondary">Найти</button></div>
      {query && <button type="button" className="account-secondary" onClick={() => { setSearch(''); setQuery(''); setPage(0); }}>Сбросить поиск</button>}
    </form>
    {error && <p className="project-error" role="alert">{error}</p>}
    {loading && !data && <p role="status">Загружаем клиентов…</p>}
    {data?.clients.length === 0 && <div className="admin-empty"><h3>Клиенты не найдены</h3><p>{query ? 'Попробуйте другой email или уберите фильтр.' : 'Новые регистрации появятся здесь.'}</p></div>}
    <div className="admin-request-list">{data?.clients.map((client) => <article className="admin-request admin-client" key={client.id}>
      <div className="admin-request-top"><div><strong>{client.email || 'Без email'}</strong>{client.display_name && <small>{client.display_name}</small>}</div><span className={`token-status ${client.email_confirmed ? 'token-status-approved' : 'token-status-pending'}`}>{client.email_confirmed ? 'Email подтверждён' : 'Ожидает подтверждения'}</span></div>
      <dl className="admin-client-stats"><div><dt>Баланс токенов</dt><dd>{client.unlimited_tokens ? 'Без ограничений' : number(client.token_balance)}</dd></div><div><dt>Использовано</dt><dd>{number(client.tokens_used)}</dd></div><div><dt>Приобретено</dt><dd>{number(client.tokens_purchased)}</dd></div><div><dt>Бонусы</dt><dd>{number(client.tokens_granted)}</dd></div><div><dt>Проектов</dt><dd>{client.projects}</dd></div><div><dt>Заявок</dt><dd>{client.requests}{client.pending > 0 ? ` · ожидают ${client.pending}` : ''}</dd></div><div><dt>Регистрация</dt><dd>{date(client.created_at)}</dd></div><div><dt>Последний вход</dt><dd>{date(client.last_sign_in_at)}</dd></div></dl>
      <small className="admin-request-id">ID {client.id}</small>
      <button className="account-secondary" onClick={() => onHistory(client)}>История заявок ({client.requests})</button>
    </article>)}</div>
    {data && data.total > 20 && <div className="token-pagination"><button className="account-secondary" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Назад</button><span>{page + 1} / {Math.ceil(data.total / 20)}</span><button className="account-secondary" disabled={(page + 1) * 20 >= data.total || loading} onClick={() => setPage(page + 1)}>Далее</button></div>}
  </section>;
}
