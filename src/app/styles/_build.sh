#!/usr/bin/env bash
# Build script: split card-constructor.css into 9 modular files.
# Uses sed to extract EXACT line ranges from the original — no rewriting.
set -euo pipefail

SRC="/tmp/card-constructor-original.css"
DST="/home/z/my-project/src/app/styles"

# Helper: print a header comment for a file
hdr() {
  printf '/* %s — %s */\n\n' "$1" "$2"
}

# Helper: wrap extracted lines in an @media block
media_wrap() {
  local query="$1"
  printf '@media %s {\n' "$query"
  cat
  printf '}\n'
}

# ====================== tokens.css ======================
{
  hdr "tokens.css" "CSS custom-property tokens (variables, colors, spacing)"
  sed -n '14,32p'  "$SRC"   # :root basic variables (БАЗОВЫЕ ПЕРЕМЕННЫЕ)
  printf '\n'
  sed -n '1378,1418p' "$SRC" # ДИЗАЙН-СИСТЕМА «CARDCRAFT» :root (UI tokens)
} > "$DST/tokens.css"

# ====================== themes.css ======================
{
  hdr "themes.css" "All 47 [data-theme=\"...\"] blocks (the bulk of the original file)"
  sed -n '34,1375p' "$SRC"  # ТЕМЫ + ГРАДИЕНТНЫЕ ТЕМЫ + ТЕМЫ «БЕЗ ФОНА»
} > "$DST/themes.css"

# ====================== layout.css ======================
{
  hdr "layout.css" ".cc-root shell, top bar, workspace, sidebar backdrop, resize dividers, toast, responsive shell"
  # БАЗА + TOP BAR + LAYOUT (.app-layout)
  sed -n '1420,1522p' "$SRC"
  printf '\n'
  # Workspace first def (.preview-workspace { flex:1; min-width:0; })
  sed -n '1611,1615p' "$SRC"
  printf '\n'
  # Resize dividers + shared scrollbar (sidebar + modal-card)
  sed -n '1617,1690p' "$SRC"
  printf '\n'
  # WORKSPACE section: .preview-workspace (2nd def) + .modal-open + .workspace-title-group + .card-count-badge
  sed -n '2278,2308p' "$SRC"
  printf '\n'
  # TOAST (.toast, .toast.show, @media 600px .toast)
  sed -n '2513,2544p' "$SRC"
  printf '\n'
  # SIDEBAR BACKDROP (mobile) base
  sed -n '3127,3136p' "$SRC"
  printf '\n'
  # @media(max-width:1023px) — layout-owned rules (backdrop show + workspace padding)
  sed -n '3155,3160p' "$SRC" | media_wrap '(max-width: 1023px)'
  printf '\n'
  # @media(min-width:1024px) — backdrop hidden on desktop (extract inner rule only, wrap)
  sed -n '3167,3169p' "$SRC" | media_wrap '(min-width: 1024px)'
  printf '\n'
  # @media(max-width:600px) — layout-owned rules (top-bar + brand-name)
  sed -n '3173,3179p' "$SRC" | media_wrap '(max-width: 600px)'
  printf '\n'
  # Top bar icon buttons (.top-bar-btn)
  sed -n '3577,3600p' "$SRC"
} > "$DST/layout.css"

# ====================== sidebar.css ======================
{
  hdr "sidebar.css" ".editor-sidebar, accordion, sidebar controls, theme dropdown, sidebar footer, mass actions"
  # SIDEBAR (.editor-sidebar, .sidebar-fixed-header, .sidebar-scroll-area, .sidebar-accordion, @keyframes sidebarAccordionIn)
  sed -n '1524,1610p' "$SRC"
  printf '\n'
  # sidebar-section + sidebar-label (range ends at closing } of .sidebar-label on line 1711)
  sed -n '1692,1711p' "$SRC"
  printf '\n'
  # gradient-control-section + gradient-angle-slider
  sed -n '1713,1760p' "$SRC"
  printf '\n'
  # THEME ACCORDION DROPDOWN (.theme-dropdown, .theme-dropdown-trigger, .theme-dropdown-panel, .theme-group, .theme-item)
  sed -n '1812,1955p' "$SRC"
  printf '\n'
  # SVG icons inside secondary buttons (sidebar-extra-actions .btn-secondary svg)
  sed -n '2073,2076p' "$SRC"
  printf '\n'
  # SIDEBAR FOOTER (tools) (.sidebar-extra-actions, .sidebar-extra-actions .btn-secondary, #saveChangesBtn)
  sed -n '2258,2276p' "$SRC"
  printf '\n'
  # Mass actions (sidebar bottom)
  sed -n '3531,3568p' "$SRC"
  printf '\n'
  # Gradient value row
  sed -n '3570,3575p' "$SRC"
  printf '\n'
  # @media(max-width:1023px) — sidebar-owned rules (.editor-sidebar fixed drawer + .editor-sidebar.collapsed transform)
  sed -n '3140,3154p' "$SRC" | media_wrap '(max-width: 1023px)'
  printf '\n'
  # @media(max-width:600px) — sidebar-owned rules (.sidebar-extra-actions)
  sed -n '3185,3187p' "$SRC" | media_wrap '(max-width: 600px)'
} > "$DST/sidebar.css"

# ====================== editor.css ======================
{
  hdr "editor.css" "#editorCardsList, .editor-card, inputs, textareas, buttons, char counter, toggle switch, focus visible"
  # Поля ввода (inputs, textarea, select) + form-group
  sed -n '1762,1810p' "$SRC"
  printf '\n'
  # .cc-root hr (Divider)
  sed -n '1957,1962p' "$SRC"
  printf '\n'
  # CARD EDITOR BLOCKS (#editorCardsList, .card-editor-block, .card-editor-header, .card-editor-body, .btn-card-editor-palette, .btn-icon svg, .btn-delete svg)
  sed -n '1964,2072p' "$SRC"
  printf '\n'
  # BUTTONS (.btn-primary, .btn-secondary, .btn-icon, .btn-palette, .btn-delete, .btn-add)
  sed -n '2078,2228p' "$SRC"
  printf '\n'
  # Card editor theme select
  sed -n '3190,3194p' "$SRC"
  printf '\n'
  # Focus visible (multi-selector rule covering sidebar-toggle + buttons + modal-close)
  sed -n '3196,3205p' "$SRC"
  printf '\n'
  # TASK 10: Card editor title group
  sed -n '3438,3472p' "$SRC"
  printf '\n'
  # Toggle switch
  sed -n '3474,3529p' "$SRC"
  printf '\n'
  # @media(max-width:600px) — editor-owned rule (.top-bar-right .btn-primary mobile padding)
  sed -n '3180,3184p' "$SRC" | media_wrap '(max-width: 600px)'
  printf '\n'
  # Char counter
  sed -n '3689,3700p' "$SRC"
} > "$DST/editor.css"

# ====================== preview.css ======================
{
  hdr "preview.css" "#cardsArea, .card, .card-list, section elements, progress bar, card numbers, list styles, card actions"
  # WORKSPACE section: cards-container + card-wrapper + @keyframes cardFadeIn + .card-actions
  sed -n '2310,2335p' "$SRC"
  printf '\n'
  # Card action buttons (.cc-root button.btn-card-action + :hover + :active)
  sed -n '2230,2256p' "$SRC"
  printf '\n'
  # CARD section: .card + variants + @media 480px + .card-empty-hint (base only) + .progress + .tag + .card-title etc + .cc-styled-word (base only)
  # NOTE: .cc-root.exporting rules (lines 2396-2398 and 2509-2511) are EXCLUDED here — they go to export.css
  sed -n '2337,2395p' "$SRC"   # card + variants + @media 480px + .card-empty-hint base
  printf '\n'
  sed -n '2399,2508p' "$SRC"   # progress + tag + card-title/subtitle/text/list/footer/accent-btn + .cc-styled-word base
  printf '\n'
  # TASK 7: Card numbering toggle (.cc-root.no-card-numbers .tag)
  sed -n '3207,3210p' "$SRC"
  printf '\n'
  # Progress bar styles (.cc-root.no-progress-bar, .progress-shapes, .ps-item, [data-progress-style] variants)
  sed -n '3212,3317p' "$SRC"
  printf '\n'
  # TASK 9: List styles (.cc-root[data-list-style] variants)
  sed -n '3319,3436p' "$SRC"
  printf '\n'
  # Card action danger hover (.btn-card-action-danger:hover)
  sed -n '3672,3677p' "$SRC"
  printf '\n'
  # Card actions — icon only (.card-actions .btn-card-action)
  sed -n '3679,3687p' "$SRC"
  printf '\n'
  # @media(max-width:1023px) — preview-owned rule (.cards-container gap)
  sed -n '3161,3163p' "$SRC" | media_wrap '(max-width: 1023px)'
} > "$DST/preview.css"

# ====================== modal.css ======================
{
  hdr "modal.css" "#colorModal, .modal-overlay, .modal-card, color picker rows, swatches, presets, format buttons, size sliders, confirm dialog"
  # MODAL section (overlay, card, header, close, palette presets, swatches, color-picker grid, accordion, color-picker row, hex text, reset, section-style controls, size slider, modal footer)
  sed -n '2546,2900p' "$SRC"
  printf '\n'
  # Confirmation dialog (.confirm-overlay, .confirm-dialog, .confirm-text, .confirm-actions, .btn-danger-confirm)
  sed -n '3602,3664p' "$SRC"
  printf '\n'
  # Modal card theme section
  sed -n '3666,3670p' "$SRC"
} > "$DST/modal.css"

# ====================== popup.css ======================
{
  hdr "popup.css" "#wordStylePopup, word style list, format buttons, color presets, size slider in popup"
  # WORD STYLE POPUP (.word-style-popup, @keyframes popupIn, .word-popup-header, .wp-header-*, .word-clear-btn, .popup-section, .popup-section-title, .popup-section-content, .format-btn, .color-presets, .color-preset, .word-style-list, .word-list-*)
  sed -n '2902,3125p' "$SRC"
} > "$DST/popup.css"

# ====================== export.css ======================
{
  hdr "export.css" ".cc-root.exporting overrides, export-mode rules, .cc-styled-word marker visibility during export"
  # .cc-root.exporting .card-empty-hint (hide empty placeholder during export)
  sed -n '2396,2398p' "$SRC"
  printf '\n'
  # .cc-root.exporting .cc-styled-word (hide dashed-underline marker during export)
  sed -n '2509,2511p' "$SRC"
} > "$DST/export.css"

echo "All 9 modular files created."
wc -l "$DST"/*.css
