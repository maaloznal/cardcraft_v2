'use client'

import { useAuth } from './AuthProvider'
import Link from 'next/link'

export function AuthButton() {
  const { user, loading, signOut, enabled } = useAuth()

  if (!enabled) {
    return null
  }

  if (loading) {
    return (
      <button className="btn-icon top-bar-btn" disabled aria-label="Загрузка авторизации" type="button">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      </button>
    )
  }

  if (user) {
    return (
      <button
        className="btn-icon top-bar-btn"
        onClick={signOut}
        title="Выйти"
        aria-label="Выйти"
        type="button"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    )
  }

  return (
    <Link
      href="/login"
      className="btn-icon top-bar-btn"
      title="Войти"
      aria-label="Войти"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    </Link>
  )
}
