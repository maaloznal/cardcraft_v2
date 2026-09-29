'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { getUserAccount, INITIAL_TOKEN_BALANCE, type UserAccount } from '@/account/account-service';
import { createProject, deleteProject, pullProjects, renameProject, type Project } from '@/lib/sync/cloudSync';
import { normalizeProjectName, setActiveProject } from '@/projects/project-storage';
import TokenRequests from '@/account/TokenRequests';
import './account.css';

const number = new Intl.NumberFormat('ru-RU');
const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

export default function AccountPage() {
  const router = useRouter();
  const { user, loading: authLoading, enabled, signOut } = useAuth();
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState('');
  const [projectSearch, setProjectSearch] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [nextAccount, nextProjects] = await Promise.all([
        getUserAccount(user.id),
        pullProjects(user.id),
      ]);
      setAccount(nextAccount);
      setProjects(nextProjects);
    } catch {
      setError('Не удалось загрузить личный кабинет. Обновите страницу чуть позже.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshBalance = useCallback(() => {
    if (user) void getUserAccount(user.id).then(setAccount).catch(() => setError('Не удалось обновить баланс.'));
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!enabled || !user) {
      router.replace('/login');
      return;
    }
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, enabled, load, router, user]);

  useEffect(() => {
    const refresh = () => refreshBalance();
    window.addEventListener('cardcraft:tokens-updated', refresh);
    return () => window.removeEventListener('cardcraft:tokens-updated', refresh);
  }, [refreshBalance]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const name = normalizeProjectName(newName);
    if (name.length < 2) return setError('Название проекта должно содержать минимум 2 символа.');
    setBusy(true);
    setError('');
    try {
      const project = await createProject(user.id, name, {});
      setProjects((current) => [project, ...current]);
      setNewName('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось создать проект.');
    } finally {
      setBusy(false);
    }
  };

  const saveRename = async (project: Project) => {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      const updated = await renameProject(project.id, user.id, editingName);
      setProjects((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось переименовать проект.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (project: Project) => {
    if (!user || !window.confirm(`Удалить проект «${project.name}» вместе с карточками? Это действие нельзя отменить.`)) return;
    setBusy(true);
    setError('');
    try {
      await deleteProject(project.id, user.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setActiveProject(null);
    } catch {
      setError('Не удалось удалить проект.');
    } finally {
      setBusy(false);
    }
  };

  const open = (project: Project) => {
    if (!user) return;
    setActiveProject({ id: project.id, name: project.name === 'default' ? 'Первый проект' : project.name, ownerId: user.id, remote: true });
    router.push('/editor');
  };

  const logout = async () => {
    setBusy(true);
    try {
      await signOut();
      setActiveProject(null);
      router.replace('/editor');
    } catch { setError('Не удалось выйти из аккаунта. Попробуйте ещё раз.'); }
    finally { setBusy(false); }
  };

  const sortedProjects = [...projects].sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
  const visibleProjects = sortedProjects.filter((project) => (project.name === 'default' ? 'Первый проект' : project.name).toLocaleLowerCase('ru-RU').includes(projectSearch.trim().toLocaleLowerCase('ru-RU')));

  if (authLoading || loading || !user || !account) {
    return <main className="account-page account-loading"><div><h1>{error ? 'Не удалось открыть кабинет' : 'Открываем ваш кабинет'}</h1><p role={error ? 'alert' : 'status'}>{error || 'Загружаем баланс и ваши проекты…'}</p>{error && <button className="account-primary" onClick={() => void load()}>Попробовать снова</button>}<Link className="account-back" href="/editor">Вернуться в редактор</Link></div></main>;
  }

  return (
    <main className="account-page">
      <div className="account-shell">
        <header className="account-header">
          <div className="account-header-main">
            <Link href="/editor" className="account-back">← В редактор</Link>
            <h1>Личный кабинет</h1>
            <p>Ваши идеи, проекты и баланс — всё под рукой.</p>
          </div>
          <Link href="/editor" className="account-brand" aria-label="Cardcraft — вернуться в редактор">Cardcraft</Link>
        </header>
        <div className="account-body">
          {error && <p className="project-error" role="alert">{error}</p>}
          <div className="account-quick-actions">{sortedProjects[0] ? <button className="account-primary" onClick={() => open(sortedProjects[0])}>Продолжить последний проект →</button> : <Link className="account-primary" href="/editor">Открыть редактор →</Link>}<nav aria-label="Разделы личного кабинета"><a href="#account-projects">Мои проекты</a><a href="#tokens">Пополнить баланс</a><a href="#account-profile">Профиль</a></nav></div>
          <section className="account-stats" aria-label="Статистика аккаунта">
            <div className="account-stat account-balance"><span>Доступно для ИИ</span><strong>{account.unlimited_tokens ? 'Без ограничений' : number.format(account.token_balance)}</strong><small>{account.unlimited_tokens ? 'Безлимитный доступ' : 'токенов на вашем балансе'}</small></div>
            <div className="account-stat"><span>Использовано токенов</span><strong>{number.format(account.tokens_used)}</strong><small>За всё время</small></div>
            <div className="account-stat"><span>Ваши проекты</span><strong>{number.format(projects.length)}</strong><small>Сохранены в аккаунте</small></div>
          </section>
          {!account.unlimited_tokens && account.token_balance < 10000 && <div className="account-low-balance"><span>{account.token_balance === 0 ? 'Токены закончились. Пополните баланс, чтобы снова создавать карточки с ИИ.' : 'Токены заканчиваются. Пополните баланс заранее, чтобы не прерывать работу с ИИ.'}</span><a href="#tokens">К пополнению →</a></div>}

          <TokenRequests key={user.id} userId={user.id} onBalanceChange={refreshBalance} />

          <section id="account-projects" className="account-section">
            <div className="account-section-title"><div><span className="account-eyebrow">ВАШЕ ПРОСТРАНСТВО</span><h2>Мои проекты</h2></div><span className="account-note">{projects.length} всего</span></div>
            <form className="account-project-create" onSubmit={create}>
              <input value={newName} onChange={(event) => setNewName(event.target.value)} minLength={2} required maxLength={80} placeholder="Например, посты на октябрь" aria-label="Название нового проекта" />
              <button className="account-primary" type="submit" disabled={busy}>Создать проект</button>
            </form>
            {projects.length > 0 && <div className="account-project-search"><label htmlFor="project-search">Найти проект</label><input id="project-search" type="search" value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="Поиск по названию" /></div>}
            <div className="account-project-list">
              {projects.length === 0 && <div className="account-empty-note"><strong>Создайте место для новой идеи</strong><p>Дайте проекту название — например, «Мой блог». Внутри будут храниться ваши карточки, тексты и оформление.</p></div>}
              {projects.length > 0 && visibleProjects.length === 0 && <div className="account-empty-note"><strong>Ничего не нашлось</strong><p>Попробуйте другое название.</p><button className="account-secondary" onClick={() => setProjectSearch('')}>Показать все проекты</button></div>}
              {visibleProjects.map((project) => (
                <article className="account-project-row" key={project.id}>
                  <div className="account-project-meta">
                    {editingId === project.id ? (
                      <div className="account-project-rename"><input aria-label="Новое название проекта" value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={80} autoFocus onKeyDown={(event) => { if (event.key === 'Escape') setEditingId(null); if (event.key === 'Enter' && !busy) void saveRename(project); }} /></div>
                    ) : <strong>{project.name === 'default' ? 'Первый проект' : project.name}</strong>}
                    <small>Обновлён {date.format(new Date(project.updated_at))}</small>
                  </div>
                  <div className="account-project-actions">
                    {editingId === project.id ? (
                      <>
                        <button className="account-primary" type="button" onClick={() => void saveRename(project)} disabled={busy}>Сохранить</button>
                        <button className="account-secondary" type="button" onClick={() => setEditingId(null)}>Отмена</button>
                      </>
                    ) : (
                      <>
                        <button className="account-primary" type="button" onClick={() => open(project)}>Открыть</button>
                        <button className="account-secondary" type="button" onClick={() => { setEditingId(project.id); setEditingName(project.name === 'default' ? 'Первый проект' : project.name); }}>Переименовать</button>
                        <button className="account-danger" type="button" onClick={() => void remove(project)} disabled={busy}>Удалить</button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="account-profile" className="account-section"><details className="account-profile-details"><summary>Профиль и данные аккаунта</summary><div className="account-profile"><div><span>Email</span><strong>{user.email}</strong></div><div><span>С нами с</span><strong>{date.format(new Date(user.created_at))}</strong></div></div></details></section>

          <footer className="account-actions">
            <p className="account-note">
              {account.unlimited_tokens
                ? 'Для этого тестового аккаунта расход токенов учитывается в статистике, но доступный баланс не уменьшается.'
                : `На старте аккаунту начисляется ${number.format(INITIAL_TOKEN_BALANCE)} токенов. Списание выполняется сервером по фактическому расходу ИИ.`}
            </p>
            <div className="account-footer-actions">
              <Link className="account-secondary" href="/docs">Документация</Link>
              <Link className="account-secondary" href="/">На главную</Link>
              <button className="account-danger" type="button" onClick={() => void logout()} disabled={busy}>Выйти</button>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
