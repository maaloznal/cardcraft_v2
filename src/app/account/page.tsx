'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { getUserAccount, INITIAL_TOKEN_BALANCE, type UserAccount } from '@/account/account-service';
import { createProject, deleteProject, pullProjects, renameProject, type Project } from '@/lib/sync/cloudSync';
import { normalizeProjectName, setActiveProject } from '@/projects/project-storage';

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
    const refresh = () => void load();
    window.addEventListener('cardcraft:tokens-updated', refresh);
    return () => window.removeEventListener('cardcraft:tokens-updated', refresh);
  }, [load]);

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
    await signOut();
    // Cloud sync handles SIGNED_OUT first and clears the active project's
    // device copy; only then forget the active project selection.
    setActiveProject(null);
    router.replace('/editor');
  };

  if (authLoading || loading || !user || !account) {
    return <main className="account-page account-loading"><p>{error || 'Загружаем личный кабинет…'}</p></main>;
  }

  return (
    <main className="account-page">
      <div className="account-shell">
        <header className="account-header">
          <div className="account-header-main">
            <Link href="/editor" className="account-back">← В редактор</Link>
            <h1>Личный кабинет</h1>
            <p>Токены, профиль и ваши проекты — в одном месте.</p>
          </div>
          <Link href="/editor" className="account-brand" aria-label="Cardcraft — вернуться в редактор">Cardcraft</Link>
        </header>
        <div className="account-body">
          {error && <p className="project-error" role="alert">{error}</p>}
          <section className="account-stats" aria-label="Статистика аккаунта">
            <div className="account-stat"><span>Доступно токенов</span><strong>{number.format(account.token_balance)}</strong></div>
            <div className="account-stat"><span>Использовано</span><strong>{number.format(account.tokens_used)}</strong></div>
            <div className="account-stat"><span>Проектов</span><strong>{number.format(projects.length)}</strong></div>
          </section>

          <section className="account-section">
            <h2>Профиль</h2>
            <div className="account-profile">
              <div><span>Email</span><strong>{user.email}</strong></div>
              <div><span>Дата регистрации</span><strong>{date.format(new Date(user.created_at))}</strong></div>
            </div>
          </section>

          <section className="account-section">
            <h2>Проекты</h2>
            <form className="account-project-create" onSubmit={create}>
              <input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={80} placeholder="Название нового проекта" aria-label="Название нового проекта" />
              <button className="account-primary" type="submit" disabled={busy}>Создать проект</button>
            </form>
            <div className="account-project-list">
              {projects.length === 0 && <p className="account-note">Проектов пока нет. Создайте первый — без проекта карточки не смешиваются между собой.</p>}
              {projects.map((project) => (
                <article className="account-project-row" key={project.id}>
                  <div className="account-project-meta">
                    {editingId === project.id ? (
                      <div className="account-project-rename"><input value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={80} autoFocus /></div>
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

          <footer className="account-actions">
            <p className="account-note">На старте аккаунту начисляется {number.format(INITIAL_TOKEN_BALANCE)} токенов. Списание выполняется сервером по фактическому расходу ИИ.</p>
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
