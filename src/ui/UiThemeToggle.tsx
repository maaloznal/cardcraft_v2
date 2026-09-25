'use client'

import { useSyncExternalStore } from 'react'

export type UiTheme = 'light' | 'dark'

export const UI_THEME_STORAGE_KEY = 'cardcraft-ui-theme'

function getThemeSnapshot(): UiTheme {
  return document.documentElement.dataset.uiTheme === 'dark' ? 'dark' : 'light'
}

function subscribeToTheme(onStoreChange: () => void): () => void {
  window.addEventListener('cardcraft:ui-theme', onStoreChange)
  return () => window.removeEventListener('cardcraft:ui-theme', onStoreChange)
}

function applyTheme(theme: UiTheme): void {
  document.documentElement.dataset.uiTheme = theme
  document.documentElement.style.colorScheme = theme
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute('content', theme === 'dark' ? '#09090b' : '#ffffff'))
}

export function UiThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => 'light')

  const nextTheme = theme === 'light' ? 'dark' : 'light'
  const label = nextTheme === 'dark' ? 'Включить тёмную тему' : 'Включить светлую тему'

  return (
    <button
      className="btn-icon top-bar-btn ui-theme-toggle"
      id="uiThemeToggle"
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={theme === 'dark'}
      onClick={() => {
        applyTheme(nextTheme)
        try {
          localStorage.setItem(UI_THEME_STORAGE_KEY, nextTheme)
        } catch {
          // The selected theme still applies for the current page when storage
          // is unavailable (for example, in a restricted private context).
        }
        window.dispatchEvent(new Event('cardcraft:ui-theme'))
      }}
    >
      {theme === 'light' ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  )
}
