import { describe, expect, it } from 'vitest';
import { applyWordStylesToText } from '@/styles/StyleHelpers';

describe('overlapping text selections', () => {
  it('combines a paragraph style with an individual word, regardless of insertion order', () => {
    const entries = [['text::Alpha beta gamma', { color: '#ff0000', fontSize: 24 }], ['text::beta', { color: '#0000ff', fontWeight: 'bold' }]] as const;
    for (const ordered of [entries, [...entries].reverse()]) {
      const root = document.createElement('div');
      root.innerHTML = applyWordStylesToText('Alpha beta gamma', Object.fromEntries(ordered), 'text');
      expect(root.textContent).toBe('Alpha beta gamma');
      const spans = root.querySelectorAll('span');
      expect(spans[1].textContent).toBe('beta');
      expect(spans[1].style.color).toBe('rgb(0, 0, 255)');
      expect(spans[1].style.fontSize).toBe('24px');
      expect(spans[0].style.color).toBe('rgb(255, 0, 0)');
    }
  });
  it('preserves newlines and escapes text, with styles scoped to the selected field', () => {
    const root = document.createElement('div');
    root.innerHTML = applyWordStylesToText('One\n<script>two</script>', { 'text::One\n<script>two</script>': { fontSize: 20 }, 'title::One': { color: 'red' } }, 'text');
    expect(root.querySelector('script')).toBeNull();
    expect(root.textContent).toBe('One\n<script>two</script>');
    expect(root.querySelector('span')?.style.color).toBe('');
  });
});
