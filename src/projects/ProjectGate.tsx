'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { createProject, pullProjects, type Project } from '@/lib/sync/cloudSync';
import * as Storage from '@/storage/StorageManager';
import { getActiveProject, getVisibleProjects, normalizeProjectName, setActiveProject, type ActiveProject } from './project-storage';

type ProjectContextValue = {
  project: ActiveProject | null;
  projects: Project[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useCurrentProject(): ProjectContextValue {
  return useContext(ProjectContext) ?? { project: null, projects: [], loading: false, refresh: async () => undefined };
}

function toActive(project: Project, ownerId: string): ActiveProject {
  return { id: project.id, name: project.name === 'default' ? 'Первый проект' : project.name, ownerId, remote: true };
}

export function ProjectGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, enabled } = useAuth();
  const [active, setActive] = useState<ActiveProject | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user || !enabled) {
      setProjects([]);
      setActive(null);
      setLoading(false);
      return;
    }
    const cloud = await pullProjects(user.id);
    const stored = getActiveProject();
    const selected = stored?.remote && stored.ownerId === user.id
      ? cloud.find((item) => item.id === stored.id)
      : null;
    setProjects(cloud);
    setActive(selected ? toActive(selected, user.id) : null);
    if (!selected && stored?.remote) setActiveProject(null);
    setLoading(false);
  }, [enabled, user]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const load = async () => {
      try {
        if (!user || !enabled) {
          setProjects([]);
          setActive(null);
          setActiveProject(null);
        } else {
          const cloud = await pullProjects(user.id);
          if (cancelled) return;
          const stored = getActiveProject();
          const selected = stored?.remote && stored.ownerId === user.id
            ? cloud.find((item) => item.id === stored.id)
            : null;
          setProjects(cloud);
          setActive(selected ? toActive(selected, user.id) : null);
          if (!selected && stored?.remote) setActiveProject(null);
        }
      } catch {
        if (!cancelled) {
          setProjects([]);
          setActive(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [authLoading, enabled, user]);

  const value = useMemo(() => ({ project: active, projects, loading, refresh }), [active, loading, projects, refresh]);
  if (authLoading || loading) {
    return <main className="editor-boot" aria-live="polite"><span>Cardcraft</span><p>Открываем редактор…</p></main>;
  }
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function ProjectBadge() {
  const { user, loading: authLoading, enabled } = useAuth();
  const { project, projects, loading, refresh } = useCurrentProject();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const authenticated = Boolean(user && enabled);
  const visibleProjects = getVisibleProjects(projects, showAll);

  const closeMenu = useCallback(() => {
    const details = detailsRef.current;
    if (details) details.open = false;
    setShowCreate(false);
    setShowAll(false);
    setError('');
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details?.open && !details.contains(event.target as Node)) closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && detailsRef.current?.open) {
        closeMenu();
        detailsRef.current?.querySelector<HTMLElement>('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu]);

  const openCreate = () => {
    detailsRef.current?.setAttribute('open', '');
    setShowCreate(true);
    setError('');
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const persistCurrentProject = async () => {
    window.dispatchEvent(new Event('cardcraft:before-project-switch'));
    if (!project) return;
    await new Promise<void>((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(finish, 4_000);
      window.dispatchEvent(new CustomEvent('cardcraft:flush-cloud-sync', { detail: { done: finish } }));
    });
  };

  const switchProject = async (next: Project | null) => {
    if (!user) return;
    await persistCurrentProject();
    setActiveProject(next ? toActive(next, user.id) : null);
    window.location.reload();
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const normalized = normalizeProjectName(name);
    if (normalized.length < 2) {
      setError('Минимум 2 символа.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await persistCurrentProject();
      const created = await createProject(user.id, normalized, project ? {} : Storage.load());
      await refresh();
      setActiveProject(toActive(created, user.id));
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось создать проект.');
      setCreating(false);
    }
  };

  return (
    <div className="project-switcher">
      <details className="project-switcher-details" ref={detailsRef} onToggle={(event) => {
        const open = event.currentTarget.open;
        if (!open) {
          setShowCreate(false);
          setShowAll(false);
          setError('');
        }
      }}>
        <summary className="project-badge" title="Переключить проект">
          <span>{loading || authLoading ? 'Проекты…' : project?.name ?? 'Локальный черновик'}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div className="project-switcher-menu">
          {authenticated ? (
            <>
              <button className="project-menu-create" type="button" onClick={openCreate}><span>＋</span><strong>Новый проект</strong></button>
              {showCreate && (
                <form className="project-menu-form" onSubmit={create}>
                  <input ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Название проекта" aria-label="Название нового проекта" />
                  <button type="submit" disabled={creating}>{creating ? '…' : 'Создать'}</button>
                  {error && <small role="alert">{error}</small>}
                </form>
              )}
              <button className={`project-menu-item${project ? '' : ' active'}`} type="button" onClick={() => void switchProject(null)}>
                <span>Локальный черновик</span><small>Только на этом устройстве</small>
              </button>
              {visibleProjects.map((item) => (
                <button className={`project-menu-item${project?.id === item.id ? ' active' : ''}`} key={item.id} type="button" onClick={() => void switchProject(item)}>
                  <span>{item.name === 'default' ? 'Первый проект' : item.name}</span>
                  <small>{new Date(item.updated_at).toLocaleDateString('ru-RU')}</small>
                </button>
              ))}
              {!showAll && projects.length > 5 && <button className="project-menu-more" type="button" onClick={() => setShowAll(true)}>Ещё · {projects.length - 5}</button>}
              {showAll && projects.length > 5 && <button className="project-menu-more" type="button" onClick={() => setShowAll(false)}>Свернуть</button>}
              <Link className="project-menu-account" href="/account">Управление проектами →</Link>
            </>
          ) : (
            <Link className="project-menu-signup" href="/login?mode=signup&next=/editor">
              <strong>Проекты после регистрации</strong>
              <span>Храните серии отдельно и открывайте их на любом устройстве.</span>
            </Link>
          )}
        </div>
      </details>
      {authenticated && <button className="project-create-top" type="button" onClick={openCreate} aria-label="Создать новый проект" title="Новый проект">＋</button>}
    </div>
  );
}
