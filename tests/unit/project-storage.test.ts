import { beforeEach, describe, expect, it } from 'vitest';
import {
  getActiveProject,
  getVisibleProjects,
  normalizeProjectName,
  projectStorageKey,
  setActiveProject,
} from '@/projects/project-storage';

describe('project storage', () => {
  beforeEach(() => localStorage.clear());

  it('normalizes project names before cloud creation', () => {
    expect(normalizeProjectName('  Новая   серия  ')).toBe('Новая серия');
    expect(normalizeProjectName('x'.repeat(100))).toHaveLength(80);
  });

  it('isolates state keys by active project', () => {
    setActiveProject({ id: 'one', name: 'One', ownerId: null, remote: false });
    expect(projectStorageKey('flashcard-cards')).toBe('flashcard-cards:project:one');
    expect(getActiveProject()?.id).toBe('one');
  });

  it('uses unscoped storage for the local draft', () => {
    setActiveProject(null);
    expect(projectStorageKey('flashcard-cards')).toBe('flashcard-cards');
  });

  it('shows five recent projects until the full list is requested', () => {
    const projects = Array.from({ length: 8 }, (_, index) => `project-${index + 1}`);
    expect(getVisibleProjects(projects, false)).toEqual(projects.slice(0, 5));
    expect(getVisibleProjects(projects, true)).toEqual(projects);
  });
});
