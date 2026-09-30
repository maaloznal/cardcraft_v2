import { afterEach, describe, expect, it } from 'vitest';
import { PreviewRenderer } from '@/preview/PreviewRenderer';

describe('PreviewRenderer input capabilities', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    });
    document.body.replaceChildren();
  });

  it('starts when matchMedia is unavailable', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });
    const container = document.createElement('div');
    document.body.append(container);

    const renderer = new PreviewRenderer(container);

    expect(document.querySelector('.preview-selection-action')).not.toBeNull();
    renderer.destroy();
  });
});
