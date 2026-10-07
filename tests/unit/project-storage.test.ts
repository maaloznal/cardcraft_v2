import { beforeEach, describe, expect, it } from 'vitest';
import {
  getActiveProject,
  getVisibleProjects,
  normalizeProjectName,
  projectStorageKey,
  resolveCloudProject,
  setActiveProject,
  setLocalProjectSelection,
} from '@/projects/project-storage';

describe('project storage', () => {
  beforeEach(() => localStorage.clear());

  it('normalizes project names before cloud creation', () => {
    expect(normalizeProjectName('  Новая   серия  ')).toBe('Новая серия');
    expect(normalizeProjectName('x'.repeat(100))).toHaveLength(80);
  });

  it('isolates state keys by active project', () => {
    setActiveProject({ id: 'one', name: 'One', ownerId: 'user-one', remote: true });
    expect(projectStorageKey('flashcard-cards')).toBe('flashcard-cards:project:one');
    expect(getActiveProject()?.id).toBe('one');
  });

  it('uses unscoped storage for the local draft', () => {
    setLocalProjectSelection('user-one');
    expect(projectStorageKey('flashcard-cards')).toBe('flashcard-cards');
    expect(getActiveProject()).toMatchObject({ ownerId: 'user-one', remote: false });
  });

  it('opens the newest cloud project on a device without a saved selection', () => {
    const projects = [{ id: 'newest' }, { id: 'older' }];
    expect(resolveCloudProject(projects, null, 'user-one')).toBe(projects[0]);
  });

  it('keeps a valid cloud selection across reloads', () => {
    const projects = [{ id: 'newest' }, { id: 'selected' }];
    setActiveProject({ id: 'selected', name: 'Selected', ownerId: 'user-one', remote: true });
    expect(resolveCloudProject(projects, getActiveProject(), 'user-one')).toBe(projects[1]);
  });

  it('respects an explicit local draft selection for the current account', () => {
    setLocalProjectSelection('user-one');
    expect(resolveCloudProject([{ id: 'cloud' }], getActiveProject(), 'user-one')).toBeNull();
  });

  it('does not reuse another account selection', () => {
    setLocalProjectSelection('user-one');
    const projects = [{ id: 'user-two-newest' }];
    expect(resolveCloudProject(projects, getActiveProject(), 'user-two')).toBe(projects[0]);
  });

  it('shows five recent projects until the full list is requested', () => {
    const projects = Array.from({ length: 8 }, (_, index) => `project-${index + 1}`);
    expect(getVisibleProjects(projects, false)).toEqual(projects.slice(0, 5));
    expect(getVisibleProjects(projects, true)).toEqual(projects);
  });
});
