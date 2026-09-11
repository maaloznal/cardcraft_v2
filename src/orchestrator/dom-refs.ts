/**
 * dom-refs.ts — DOM element cache.
 *
 * Single function collects every element ref the orchestrator needs.
 * Returns an object with all refs as nullable (consistent null-handling).
 *
 * Extracted from CardCraftApp.ts section 3 (lines 75-125) — behavior
 * preserved exactly. The `$` helper is also exposed on the returned
 * object so controllers can do late lookups (e.g. for elements inside
 * the modal that are queried by data attribute).
 */

export interface DOMRefs {
  /** `$` helper bound to root — for late element lookups */
  $: <T extends Element = HTMLElement>(sel: string) => T | null;

  // ── Sidebar / shell ──
  editorSidebar: HTMLElement | null;
  toggleSidebarBtn: HTMLButtonElement | null;
  sidebarBackdrop: HTMLElement | null;
  editorCardsList: HTMLElement | null;
  cardsArea: HTMLElement | null;
  previewWorkspace: HTMLElement | null;
  toastEl: HTMLElement | null;

  // ── Topbar / settings ──
  themeSelect: HTMLSelectElement | null;
  formatSelect: HTMLSelectElement | null;
  themeDropdown: HTMLElement | null;
  themeDropdownTrigger: HTMLButtonElement | null;
  themeDropdownLabel: HTMLElement | null;
  gradientAngleSlider: HTMLInputElement | null;
  gradientAngleValue: HTMLElement | null;
  numberingToggle: HTMLInputElement | null;
  progressBarToggle: HTMLInputElement | null;
  progressBarStyleSelect: HTMLSelectElement | null;
  listStyleSelect: HTMLSelectElement | null;
  charLimitToggle: HTMLInputElement | null;
  charCounter: HTMLElement | null;
  charCounterText: HTMLElement | null;
  listNumSizeSlider: HTMLInputElement | null;
  listNumSizeValue: HTMLElement | null;

  // ── Resize dividers ──
  resizeDividerH: HTMLElement | null;
  resizeDividerV: HTMLElement | null;

  // ── Color modal ──
  colorModal: HTMLElement | null;
  resetCardColorsBtn: HTMLButtonElement | null;
  modalCardTitle: HTMLElement | null;
  modalCardThemeDropdown: HTMLElement | null;
  modalCardThemeLabel: HTMLElement | null;

  // ── Word popup ──
  wordStylePopup: HTMLElement | null;
  wordPopupHeader: HTMLElement | null;
  sizeSlider: HTMLInputElement | null;
  sizeValue: HTMLElement | null;
  wordStyleList: HTMLElement | null;

  // ── Sidebar footer / actions ──
  addCardBtn: HTMLButtonElement | null;
  saveAllBtn: HTMLButtonElement | null;
  deleteAllBtn: HTMLButtonElement | null;
  confirmOverlay: HTMLElement | null;
  confirmOk: HTMLButtonElement | null;
  confirmCancel: HTMLButtonElement | null;
  undoBtn: HTMLButtonElement | null;
  redoBtn: HTMLButtonElement | null;
  cardCountBadge: HTMLElement | null;
}

/**
 * Collect every DOM element ref the orchestrator needs from `root`.
 * Refs are nullable — every consumer must null-check (defensive against
 * DOM contract drift).
 */
export function collectDOMRefs(root: HTMLElement): DOMRefs {
  const $ = <T extends Element = HTMLElement>(sel: string): T | null =>
    root.querySelector<T>(sel);

  return {
    $,

    editorSidebar: $<HTMLElement>('#editorSidebar'),
    toggleSidebarBtn: $<HTMLButtonElement>('#toggleSidebarBtn'),
    sidebarBackdrop: $<HTMLElement>('#sidebarBackdrop'),
    editorCardsList: $<HTMLElement>('#editorCardsList'),
    cardsArea: $<HTMLElement>('#cardsArea'),
    previewWorkspace: $<HTMLElement>('#previewWorkspace'),
    toastEl: $<HTMLElement>('#toast'),

    themeSelect: $<HTMLSelectElement>('#themeSelect'),
    formatSelect: $<HTMLSelectElement>('#formatSelect'),
    themeDropdown: $<HTMLElement>('#themeDropdown'),
    themeDropdownTrigger: $<HTMLButtonElement>('#themeDropdownTrigger'),
    themeDropdownLabel: $<HTMLElement>('#themeDropdownLabel'),
    gradientAngleSlider: $<HTMLInputElement>('#gradientAngleSlider'),
    gradientAngleValue: $<HTMLElement>('#gradientAngleValue'),
    numberingToggle: $<HTMLInputElement>('#numberingToggle'),
    progressBarToggle: $<HTMLInputElement>('#progressBarToggle'),
    progressBarStyleSelect: $<HTMLSelectElement>('#progressBarStyleSelect'),
    listStyleSelect: $<HTMLSelectElement>('#listStyleSelect'),
    charLimitToggle: $<HTMLInputElement>('#charLimitToggle'),
    charCounter: $<HTMLElement>('#charCounter'),
    charCounterText: $<HTMLElement>('#charCounterText'),
    listNumSizeSlider: $<HTMLInputElement>('#listNumSizeSlider'),
    listNumSizeValue: $<HTMLElement>('#listNumSizeValue'),

    resizeDividerH: $<HTMLElement>('#resizeDividerH'),
    resizeDividerV: $<HTMLElement>('#resizeDividerV'),

    colorModal: $<HTMLElement>('#colorModal'),
    resetCardColorsBtn: $<HTMLButtonElement>('#resetCardColorsBtn'),
    modalCardTitle: $<HTMLElement>('#modalCardTitle'),
    modalCardThemeDropdown: $<HTMLElement>('#modalCardThemeDropdown'),
    modalCardThemeLabel: $<HTMLElement>('#modalCardThemeLabel'),

    wordStylePopup: $<HTMLElement>('#wordStylePopup'),
    wordPopupHeader: $<HTMLElement>('#wordPopupHeader'),
    sizeSlider: $<HTMLInputElement>('#sizeSlider'),
    sizeValue: $<HTMLElement>('#sizeValue'),
    wordStyleList: $<HTMLElement>('#wordStyleList'),

    addCardBtn: $<HTMLButtonElement>('#addCardBtn'),
    saveAllBtn: $<HTMLButtonElement>('#saveAll'),
    deleteAllBtn: $<HTMLButtonElement>('#deleteAllBtn'),
    confirmOverlay: $<HTMLElement>('#confirmOverlay'),
    confirmOk: $<HTMLButtonElement>('#confirmOk'),
    confirmCancel: $<HTMLButtonElement>('#confirmCancel'),
    undoBtn: $<HTMLButtonElement>('#undoBtn'),
    redoBtn: $<HTMLButtonElement>('#redoBtn'),
    cardCountBadge: $<HTMLElement>('#cardCountBadge'),
  };
}
