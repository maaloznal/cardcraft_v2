import { describe, expect, it } from 'vitest';
import { THEME_GROUPS } from '@/themes/themeData';

describe('theme data', () => {
  it('uses continuous display numbers in the rendered group order', () => {
    const themes = THEME_GROUPS.flatMap((group) => group.themes);
    const numbers = themes.map((theme) => Number(theme.label.match(/^(\d+)\./)?.[1]));

    expect(numbers).toEqual(themes.map((_, index) => index + 1));
    expect(new Set(numbers).size).toBe(themes.length);
  });

  it('keeps every persisted theme value unique', () => {
    const values = THEME_GROUPS.flatMap((group) => group.themes.map((theme) => theme.value));
    expect(values).toHaveLength(90);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain('default');
    expect(values).toContain('dark-slate');
    expect(values).toContain('nobg-light');
  });
});
