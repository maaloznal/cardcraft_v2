export const ACTIVE_PROJECT_KEY = 'cardcraft-active-project-v1';

export const PROJECT_STATE_KEYS = [
  'flashcard-cards',
  'flashcard-theme',
  'flashcard-format',
  'flashcard-show-numbers',
  'flashcard-show-progress',
  'flashcard-progress-style',
  'flashcard-list-style',
  'flashcard-gradient-angle',
  'flashcard-char-limit',
  'flashcard-char-limit-value',
  'flashcard-export-quality',
] as const;

export interface ActiveProject {
  id: string;
  name: string;
  ownerId: string | null;
  remote: boolean;
}

const LOCAL_PROJECT_ID = 'local';
const LOCAL_PROJECT_NAME = 'Локальный черновик';

export function normalizeProjectName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function getVisibleProjects<T>(projects: T[], showAll: boolean, recentLimit = 5): T[] {
  return showAll ? projects : projects.slice(0, recentLimit);
}

export function getActiveProject(): ActiveProject | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ACTIVE_PROJECT_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ActiveProject>;
    if (typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.remote !== 'boolean') {
      throw new Error('invalid project');
    }
    return {
      id: value.id,
      name: normalizeProjectName(value.name),
      ownerId: typeof value.ownerId === 'string' ? value.ownerId : null,
      remote: value.remote,
    };
  } catch {
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
    return null;
  }
}

export function setActiveProject(project: ActiveProject | null): void {
  if (project) localStorage.setItem(ACTIVE_PROJECT_KEY, JSON.stringify(project));
  else localStorage.removeItem(ACTIVE_PROJECT_KEY);
}

/** Remember that an authenticated user explicitly chose the device-only draft. */
export function setLocalProjectSelection(ownerId: string): void {
  setActiveProject({
    id: LOCAL_PROJECT_ID,
    name: LOCAL_PROJECT_NAME,
    ownerId,
    remote: false,
  });
}

/**
 * Resolve the project to open on this device.
 *
 * A valid saved cloud selection wins. An explicit local-draft selection is
 * also respected. On a new device there is no selection in localStorage, so
 * the most recently updated cloud project (the first item returned by
 * pullProjects) is selected automatically to restore cross-device sync.
 */
export function resolveCloudProject<T extends { id: string }>(
  projects: T[],
  stored: ActiveProject | null,
  ownerId: string,
): T | null {
  if (stored?.remote && stored.ownerId === ownerId) {
    const selected = projects.find((project) => project.id === stored.id);
    if (selected) return selected;
  }
  if (stored && !stored.remote && stored.ownerId === ownerId) return null;
  return projects[0] ?? null;
}

export function projectStorageKey(baseKey: string): string {
  const project = getActiveProject();
  return project?.remote ? `${baseKey}:project:${project.id}` : baseKey;
}
