/**
 * Core type definitions for Cardcraft.
 * All modules import from here — single source of truth for data shapes.
 */

/** Individual word style (bold, italic, color, etc.) */
export interface WordStyle {
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  fontSize?: number | string;
  color?: string;
}

/** Section-level style (applies to entire field like title, text, etc.) */
export interface SectionStyle {
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  fontSize?: number;
}

/** Editable section-style properties (used by SET_SECTION_STYLE_FIELD action) */
export type SectionStyleProperty = 'fontWeight' | 'fontStyle' | 'textDecoration';

/** A single card in the project */
export interface Card {
  id: string;
  title: string;
  subtitle: string;
  text: string;
  listItems: string;
  footer: string;
  cta: string;
  colors: Record<string, string>;
  wordStyles: Record<string, WordStyle>;
  sectionStyles: Record<string, SectionStyle>;
  theme?: string;
}

/**
 * Snapshot for undo/redo history.
 * P1-8: includes the full SettingsState (not just theme+format) so that
 * undo/redo correctly restores progress bar, list style, char limit,
 * numbering, and gradient angle changes.
 */
export interface Snapshot {
  cards: Card[];
  theme: string;
  format: string;
  gradientAngle: number;
  showCardNumbers: boolean;
  showProgressBar: boolean;
  progressBarStyle: string;
  listStyleType: string;
  charLimitEnabled: boolean;
}

/** Theme group structure for dropdown rendering */
export interface ThemeGroup {
  label: string;
  themes: { value: string; label: string }[];
}

/** Editor field configuration */
export interface EditorField {
  key: 'title' | 'subtitle' | 'text' | 'listItems' | 'footer' | 'cta';
  label: string;
  multiline: boolean;
  maxlength: number;
}

/** Modal field configuration */
export interface ModalField {
  key: string;
  label: string;
  defaultSize: number;
  hasStyleControls: boolean;
}

/** Field configuration for preview rendering (order, tag, container) */
export interface FieldConfig {
  tag: string;
  cls: string;
  container: 'top' | 'bottom';
  order: number;
}

// ─── UI State (moved from orchestrator shadow vars — P1-3) ──────────────

/**
 * UI state — single source of truth for transient view state.
 * Replaces the 5 shadow `let` vars that previously lived in the orchestrator.
 * All changes go through dispatch({ type: 'SET_UI', payload: Partial<UIState> }).
 */
export interface UIState {
  /** Color modal: is it open */
  colorModalOpen: boolean;
  /** Color modal: which card index is being edited */
  activeCardIndexForColors: number | null;
  /** Color modal: which field row is currently selected (e.g. 'title') */
  lastActiveField: string;

  /** Word popup: is it open */
  wordPopupOpen: boolean;
  /** Word popup: which card index is being edited */
  activeCardIndexForWord: number | null;
  /** Word popup: which field is being edited */
  activeFieldForWord: string | null;

  /** Sidebar: open/closed (logical state; DOM class is the source for layout) */
  sidebarOpen: boolean;
  /** Sidebar: captured state before modal opened, restored on close */
  sidebarWasCollapsedBeforeModal: boolean;

  /** Confirm dialog: is it open */
  confirmDialogOpen: boolean;

  /** Export pipeline: batch export in progress (blocks editing) */
  isExporting: boolean;
}

// ─── Action: type-safe discriminated union (P1-2) ───────────────────────

/**
 * Action — discriminated union. Every dispatch site gets a typed payload;
 * the reducer receives a typed action per case branch. No more `as` casts.
 *
 * Card operations use `idx: number` (positional). A future refactor may
 * switch to `cardId: string` for robustness against reordering, but that
 * is out of scope for P1 (state-contract restoration).
 */
export type Action =
  // ── Card operations ──
  | { type: 'ADD_CARD' }
  | { type: 'DELETE_CARD'; payload: { idx: number } }
  | { type: 'DUPLICATE_CARD'; payload: { idx: number } }
  | { type: 'MOVE_CARD'; payload: { idx: number; dir: number } }
  | { type: 'UPDATE_CARD_FIELD'; payload: { idx: number; field: keyof Card; value: string } }
  | { type: 'SET_CARD_THEME'; payload: { idx: number; theme: string | undefined } }
  | { type: 'SET_CARD_COLORS'; payload: { idx: number; colors: Record<string, string> } }
  | {
      type: 'SET_CARD_SECTION_STYLES';
      payload: { idx: number; sectionStyles: Record<string, SectionStyle> };
    }
  | {
      type: 'SET_CARD_WORD_STYLES';
      payload: { idx: number; wordStyles: Record<string, WordStyle> };
    }
  | { type: 'DELETE_CARD_WORD_STYLE'; payload: { idx: number; key: string } }

  // ── Granular card mutations (P1-1: replace direct card.colors/sectionStyles writes) ──
  | { type: 'SET_CARD_COLOR_FIELD'; payload: { idx: number; field: string; value: string } }
  | { type: 'DELETE_CARD_COLOR_FIELD'; payload: { idx: number; field: string } }
  | {
      type: 'SET_SECTION_STYLE_FIELD';
      payload: {
        idx: number;
        field: string;
        property: SectionStyleProperty;
        value: string | undefined;
      };
    }
  | { type: 'SET_SECTION_FONT_SIZE'; payload: { idx: number; field: string; size: number } }
  | { type: 'RESET_CARD_STYLES'; payload: { idx: number } }

  // ── Settings ──
  | { type: 'SET_GLOBAL_THEME'; payload: { theme: string } }
  | { type: 'SET_FORMAT'; payload: { format: string } }
  | { type: 'SET_GRADIENT_ANGLE'; payload: { angle: number } }
  | { type: 'SET_SHOW_CARD_NUMBERS'; payload: { show: boolean } }
  | { type: 'SET_SHOW_PROGRESS_BAR'; payload: { show: boolean } }
  | { type: 'SET_PROGRESS_BAR_STYLE'; payload: { style: string } }
  | { type: 'SET_LIST_STYLE'; payload: { style: string } }
  | { type: 'SET_CHAR_LIMIT'; payload: { enabled: boolean } }

  // ── Snapshot / clear ──
  | { type: 'RESTORE_SNAPSHOT'; payload: { snapshot: Snapshot } }
  | { type: 'CLEAR_ALL' }

  // ── UI state (P1-3: replace shadow `let` vars) ──
  | { type: 'SET_UI'; payload: Partial<UIState> };

/** String literal union of all action types — useful for devtools/logging */
export type ActionType = Action['type'];
