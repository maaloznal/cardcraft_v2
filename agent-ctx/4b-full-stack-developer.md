# Task 4b — CardCraftApp orchestrator

Agent: full-stack-developer
Started: reading worklog (Tasks 4a-research, 28-31), architecture.md, page.tsx, card-constructor.ts (2731 lines), all 14 modules, smoke-test.js (109 assertions).

Plan:
- Create `src/orchestrator/CardCraftApp.ts` (~900-1000 lines).
- Wire all modules: StateManager, HistoryManager, StorageManager, PreviewRenderer, EditorRenderer, WordEditorManager, ThemeManager, ExportManager, StyleHelpers, UI kit (Accordion, Modal, Dropdown).
- Replicate all 21 behavior sections from the old God Function.
- Update `src/app/page.tsx` with feature flag.
- Run lint + check dev.log.

Status: in progress.
