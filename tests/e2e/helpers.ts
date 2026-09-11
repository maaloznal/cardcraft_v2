import { test, expect, type Page } from '@playwright/test';

/**
 * Helper: navigate to the app with cleared storage.
 * Uses addInitScript to clear localStorage BEFORE the page loads on every
 * navigation. This guarantees a clean default state (1 empty card) for each
 * test. Tests that need to verify persistence (test 16) must NOT use reload —
 * they should check localStorage directly instead.
 */
export async function gotoApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/');
  // Extra safety: if cards > 1 (storage wasn't cleared by initScript in time),
  // clear + reload once more. This handles edge cases where beforeunload
  // saved state after initScript ran.
  const initialCount = await page.locator('#cardsArea .card-wrapper').count();
  if (initialCount > 1) {
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
  }
  // Wait for init — at least 1 card in editor + preview
  await expect
    .poll(() => page.locator('#cardsArea .card-wrapper, #editorCardsList .card-editor-block').count())
    .toBeGreaterThanOrEqual(1);
}

/** Helper: count cards in preview */
export async function getPreviewCardCount(page: Page): Promise<number> {
  return page.locator('#cardsArea .card-wrapper').count();
}

/** Helper: count cards in editor */
export async function getEditorCardCount(page: Page): Promise<number> {
  return page.locator('#editorCardsList .card-editor-block').count();
}

/** Helper: get the Nth card's title text in preview */
export async function getPreviewCardTitle(page: Page, index: number): Promise<string> {
  const titles = page.locator('#cardsArea .card-title');
  return (await titles.nth(index).textContent()) ?? '';
}

/** Helper: type into a field of the Nth editor card */
export async function typeInEditor(
  page: Page,
  cardIndex: number,
  field: string,
  text: string,
): Promise<void> {
  const input = page.locator(
    `#editorCardsList .card-editor-block:nth-child(${cardIndex + 1}) [data-field="${field}"]`,
  );
  await input.fill(text);
}

/**
 * Helper: change a hidden <select> value + dispatch change event.
 * Playwright's selectOption doesn't reliably fire change on hidden selects,
 * so we use evaluate to set value + dispatch the event manually.
 */
export async function changeHiddenSelect(page: Page, selectId: string, value: string): Promise<void> {
  await page.evaluate(
    ({ id, val }) => {
      const sel = document.getElementById(id) as HTMLSelectElement | null;
      if (!sel) throw new Error(`Select #${id} not found`);
      sel.value = val;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { id: selectId, val: value },
  );
}

/** Helper: get all option values from a <select> */
export async function getSelectOptions(page: Page, selectId: string): Promise<string[]> {
  return page.locator(`#${selectId} option`).evaluateAll((opts) =>
    opts.map((o) => (o as HTMLOptionElement).value),
  );
}

