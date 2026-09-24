/**
 * StateManager — centralized application state with sub-structures and selectors.
 * All state changes go through dispatch(). No direct mutation.
 * UI reads state via selectors, not direct field access.
 *
 * P1-1: direct card.colors / card.sectionStyles mutations removed — replaced
 *       with granular typed actions (SET_CARD_COLOR_FIELD, SET_SECTION_STYLE_FIELD, etc.).
 * P1-2: Action is a discriminated union — reducer cases receive typed payloads.
 * P1-3: UI state (formerly 5 shadow `let` vars in orchestrator) lives here.
 */

import type { Card, Snapshot, Action, UIState, SectionStyle } from '../core/types';
import { generateId, deepClone } from '../core/utils';
import {
  DEFAULT_THEME,
  DEFAULT_FORMAT,
  DEFAULT_GRADIENT_ANGLE,
  DEFAULT_LIST_STYLE,
  DEFAULT_PROGRESS_STYLE,
} from '../core/constants';

// ─── Sub-state interfaces ──────────────────────────────────────

export interface CardsState {
  list: Card[];
}

export interface SettingsState {
  theme: string;
  format: string;
  gradientAngle: number;
  showCardNumbers: boolean;
  showProgressBar: boolean;
  progressBarStyle: string;
  listStyleType: string;
  charLimitEnabled: boolean;
}

export interface AppState {
  cards: CardsState;
  settings: SettingsState;
  ui: UIState;
}

// ─── Default state factory ─────────────────────────────────────

function createDefaultUIState(): UIState {
  return {
    colorModalOpen: false,
    activeCardIndexForColors: null,
    lastActiveField: 'title',
    wordPopupOpen: false,
    activeCardIndexForWord: null,
    activeFieldForWord: null,
    sidebarOpen: false,
    sidebarWasCollapsedBeforeModal: true,
    confirmDialogOpen: false,
    isExporting: false,
  };
}

function createDefaultState(): AppState {
  return {
    cards: { list: [createEmptyCard()] },
    settings: {
      theme: DEFAULT_THEME,
      format: DEFAULT_FORMAT,
      gradientAngle: DEFAULT_GRADIENT_ANGLE,
      showCardNumbers: true,
      showProgressBar: true,
      progressBarStyle: DEFAULT_PROGRESS_STYLE,
      listStyleType: DEFAULT_LIST_STYLE,
      charLimitEnabled: false,
    },
    ui: createDefaultUIState(),
  };
}

// ─── StateManager class ────────────────────────────────────────

type Listener = (state: AppState) => void;

export class StateManager {
  private state: AppState;
  private listeners: Set<Listener> = new Set();

  constructor(initial?: Partial<AppState>) {
    this.state = {
      ...createDefaultState(),
      ...initial,
      ui: { ...createDefaultUIState(), ...(initial?.ui ?? {}) },
    };
  }

  // ─── Selectors (read-only) ──────────────────────────────────

  /** Get full state — avoid using directly, prefer specific selectors */
  get(): AppState {
    return this.state;
  }

  /** Get all cards */
  getCards(): Card[] {
    return this.state.cards.list;
  }

  /** Get a single card by index */
  getCard(idx: number): Card | null {
    if (idx < 0 || idx >= this.state.cards.list.length) return null;
    return this.state.cards.list[idx];
  }

  /** Get card count */
  getCardCount(): number {
    return this.state.cards.list.length;
  }

  /** Get current global theme */
  getTheme(): string {
    return this.state.settings.theme;
  }

  /** Get current format */
  getFormat(): string {
    return this.state.settings.format;
  }

  /** Get gradient angle */
  getGradientAngle(): number {
    return this.state.settings.gradientAngle;
  }

  /** Get progress bar configuration */
  getProgressConfig(): { show: boolean; style: string } {
    return {
      show: this.state.settings.showProgressBar,
      style: this.state.settings.progressBarStyle,
    };
  }

  /** Get list style */
  getListStyle(): string {
    return this.state.settings.listStyleType;
  }

  /** Get all settings */
  getSettings(): SettingsState {
    return this.state.settings;
  }

  /** Get UI state */
  getUI(): UIState {
    return this.state.ui;
  }

  // ─── Mutations (via dispatch) ───────────────────────────────

  /** Subscribe to state changes */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Dispatch an action — the only way to mutate state */
  dispatch(action: Action): void {
    const prev = this.state;
    this.state = this.reduce(prev, action);
    if (this.state !== prev) {
      this.listeners.forEach((fn) => fn(this.state));
    }
  }

  /** Replace cards + settings (for undo/redo restore) */
  restore(snapshot: Snapshot): void {
    this.state = {
      ...this.state,
      cards: { list: deepClone(snapshot.cards) },
      settings: {
        ...this.state.settings,
        theme: snapshot.theme,
        format: snapshot.format,
        gradientAngle: snapshot.gradientAngle,
        showCardNumbers: snapshot.showCardNumbers,
        showProgressBar: snapshot.showProgressBar,
        progressBarStyle: snapshot.progressBarStyle,
        listStyleType: snapshot.listStyleType,
        charLimitEnabled: snapshot.charLimitEnabled,
      },
    };
    this.listeners.forEach((fn) => fn(this.state));
  }

  /** Get a snapshot for history */
  snapshot(): Snapshot {
    const s = this.state.settings;
    return {
      cards: deepClone(this.state.cards.list),
      theme: s.theme,
      format: s.format,
      gradientAngle: s.gradientAngle,
      showCardNumbers: s.showCardNumbers,
      showProgressBar: s.showProgressBar,
      progressBarStyle: s.progressBarStyle,
      listStyleType: s.listStyleType,
      charLimitEnabled: s.charLimitEnabled,
    };
  }

  /** Set cards directly (for import/load) */
  setCards(cards: Card[]): void {
    this.state = {
      ...this.state,
      cards: { list: [...cards] },
    };
    this.listeners.forEach((fn) => fn(this.state));
  }

  /** Convenience: update UI state (wraps SET_UI dispatch) */
  setUI(patch: Partial<UIState>): void {
    this.dispatch({ type: 'SET_UI', payload: patch });
  }

  // ─── Reducer ────────────────────────────────────────────────

  private reduce(state: AppState, action: Action): AppState {
    switch (action.type) {
      // ── Card operations ──
      case 'ADD_CARD': {
        const card = createEmptyCard();
        return {
          ...state,
          cards: { list: [...state.cards.list, card] },
        };
      }
      case 'DELETE_CARD': {
        const { idx } = action.payload;
        if (state.cards.list.length <= 1 || idx < 0 || idx >= state.cards.list.length) return state;
        const list = [...state.cards.list];
        list.splice(idx, 1);
        return { ...state, cards: { list } };
      }
      case 'DUPLICATE_CARD': {
        const { idx } = action.payload;
        if (idx < 0 || idx >= state.cards.list.length) return state;
        const copy = deepClone(state.cards.list[idx]);
        copy.id = generateId();
        const list = [...state.cards.list];
        list.splice(idx + 1, 0, copy);
        return { ...state, cards: { list } };
      }
      case 'MOVE_CARD': {
        const { idx, dir } = action.payload;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= state.cards.list.length) return state;
        const list = [...state.cards.list];
        [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
        return { ...state, cards: { list } };
      }
      case 'UPDATE_CARD_FIELD': {
        const { idx, field, value } = action.payload;
        if (idx < 0 || idx >= state.cards.list.length) return state;
        const list = [...state.cards.list];
        list[idx] = { ...list[idx], [field]: value };
        return { ...state, cards: { list } };
      }
      case 'SET_CARD_THEME': {
        const { idx, theme } = action.payload;
        if (idx < 0 || idx >= state.cards.list.length) return state;
        const list = [...state.cards.list];
        list[idx] = { ...list[idx], theme };
        return { ...state, cards: { list } };
      }
      case 'SET_CARD_COLORS': {
        const { idx, colors } = action.payload;
        if (idx < 0 || idx >= state.cards.list.length) return state;
        const list = [...state.cards.list];
        list[idx] = { ...list[idx], colors: { ...colors } };
        return { ...state, cards: { list } };
      }
      case 'SET_CARD_SECTION_STYLES': {
        const { idx, sectionStyles } = action.payload;
        if (idx < 0 || idx >= state.cards.list.length) return state;
        const list = [...state.cards.list];
        list[idx] = { ...list[idx], sectionStyles: { ...sectionStyles } };
        return { ...state, cards: { list } };
      }
      case 'SET_CARD_WORD_STYLES': {
        const { idx, wordStyles } = action.payload;
        if (idx < 0 || idx >= state.cards.list.length) return state;
        const list = [...state.cards.list];
        list[idx] = { ...list[idx], wordStyles: { ...wordStyles } };
        return { ...state, cards: { list } };
      }
      case 'DELETE_CARD_WORD_STYLE': {
        const { idx, key } = action.payload;
        if (idx < 0 || idx >= state.cards.list.length) return state;
        const card = state.cards.list[idx];
        if (!card.wordStyles || !(key in card.wordStyles)) return state;
        const newWordStyles = { ...card.wordStyles };
        delete newWordStyles[key];
        const list = [...state.cards.list];
        list[idx] = { ...card, wordStyles: newWordStyles };
        return { ...state, cards: { list } };
      }

      // ── Granular card mutations (P1-1) ──
      case 'SET_CARD_COLOR_FIELD': {
        const { idx, field, value } = action.payload;
        if (idx < 0 || idx >= state.cards.list.length) return state;
        const card = state.cards.list[idx];
        const list = [...state.cards.list];
        list[idx] = { ...card, colors: { ...card.colors, [field]: value } };
        return { ...state, cards: { list } };
      }
      case 'DELETE_CARD_COLOR_FIELD': {
        const { idx, field } = action.payload;
        if (idx < 0 || idx >= state.cards.list.length) return state;
        const card = state.cards.list[idx];
        if (!(field in card.colors)) return state;
        const newColors = { ...card.colors };
        delete newColors[field];
        const list = [...state.cards.list];
        list[idx] = { ...card, colors: newColors };
        return { ...state, cards: { list } };
      }
      case 'SET_SECTION_STYLE_FIELD': {
        const { idx, field, property, value } = action.payload;
        if (idx < 0 || idx >= state.cards.list.length) return state;
        const card = state.cards.list[idx];
        const prevFieldStyle: SectionStyle = card.sectionStyles[field] ?? {};
        let newFieldStyle: SectionStyle;
        if (value === undefined) {
          newFieldStyle = { ...prevFieldStyle };
          delete newFieldStyle[property];
        } else {
          newFieldStyle = { ...prevFieldStyle, [property]: value };
        }
        const list = [...state.cards.list];
        list[idx] = {
          ...card,
          sectionStyles: { ...card.sectionStyles, [field]: newFieldStyle },
        };
        return { ...state, cards: { list } };
      }
      case 'SET_SECTION_FONT_SIZE': {
        const { idx, field, size } = action.payload;
        if (idx < 0 || idx >= state.cards.list.length) return state;
        const card = state.cards.list[idx];
        const prevFieldStyle: SectionStyle = card.sectionStyles[field] ?? {};
        const newFieldStyle: SectionStyle = { ...prevFieldStyle, fontSize: size };
        const list = [...state.cards.list];
        list[idx] = {
          ...card,
          sectionStyles: { ...card.sectionStyles, [field]: newFieldStyle },
        };
        return { ...state, cards: { list } };
      }
      case 'RESET_CARD_STYLES': {
        const { idx } = action.payload;
        if (idx < 0 || idx >= state.cards.list.length) return state;
        const card = state.cards.list[idx];
        const list = [...state.cards.list];
        list[idx] = { ...card, colors: {}, sectionStyles: {} };
        return { ...state, cards: { list } };
      }

      // ── Snapshot / clear ──
      case 'RESTORE_SNAPSHOT': {
        const { snapshot: snap } = action.payload;
        return {
          ...state,
          cards: { list: deepClone(snap.cards) },
          settings: {
            ...state.settings,
            theme: snap.theme,
            format: snap.format,
            gradientAngle: snap.gradientAngle,
            showCardNumbers: snap.showCardNumbers,
            showProgressBar: snap.showProgressBar,
            progressBarStyle: snap.progressBarStyle,
            listStyleType: snap.listStyleType,
            charLimitEnabled: snap.charLimitEnabled,
          },
        };
      }
      case 'CLEAR_ALL':
        return { ...state, cards: { list: [createEmptyCard()] } };

      // ── Settings ──
      case 'SET_GLOBAL_THEME':
        return { ...state, settings: { ...state.settings, theme: action.payload.theme } };
      case 'SET_FORMAT':
        return { ...state, settings: { ...state.settings, format: action.payload.format } };
      case 'SET_GRADIENT_ANGLE':
        return { ...state, settings: { ...state.settings, gradientAngle: action.payload.angle } };
      case 'SET_SHOW_CARD_NUMBERS':
        return {
          ...state,
          settings: { ...state.settings, showCardNumbers: action.payload.show },
        };
      case 'SET_SHOW_PROGRESS_BAR':
        return {
          ...state,
          settings: { ...state.settings, showProgressBar: action.payload.show },
        };
      case 'SET_PROGRESS_BAR_STYLE':
        return {
          ...state,
          settings: { ...state.settings, progressBarStyle: action.payload.style },
        };
      case 'SET_LIST_STYLE':
        return { ...state, settings: { ...state.settings, listStyleType: action.payload.style } };
      case 'SET_CHAR_LIMIT':
        return {
          ...state,
          settings: { ...state.settings, charLimitEnabled: action.payload.enabled },
        };

      // ── UI state (P1-3) ──
      case 'SET_UI':
        return { ...state, ui: { ...state.ui, ...action.payload } };

      default: {
        // Exhaustiveness check — if a new Action variant is added without a
        // reducer case, TypeScript will error here at compile time.
        const _exhaustive: never = action;
        void _exhaustive;
        return state;
      }
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function createEmptyCard(): Card {
  return {
    id: generateId(),
    title: '',
    subtitle: '',
    text: '',
    listItems: '',
    footer: '',
    cta: '',
    colors: {},
    wordStyles: {},
    sectionStyles: {},
  };
}
