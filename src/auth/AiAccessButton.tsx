'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'

type AiAccessButtonProps = {
  mobile?: boolean
}

export function AiAccessButton({ mobile = false }: AiAccessButtonProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const authenticated = Boolean(user)
  const id = mobile ? 'mobileAiImportBtn' : 'aiImportBtn'
  const label = authenticated
    ? 'Создать с ИИ'
    : mobile
      ? 'Войти для ИИ'
      : 'Войти / зарегистрироваться для ИИ'
  const description = authenticated
    ? 'Создать карточки с помощью ИИ'
    : 'Войти или зарегистрироваться для работы с ИИ'

  return (
    <button
      className={mobile ? 'mobile-mode-tab mobile-ai-import' : 'btn-ai-import'}
      id={id}
      aria-label={description}
      title={description}
      type="button"
      disabled={loading}
      data-ai-access={authenticated ? 'granted' : 'denied'}
      onClick={(event) => {
        if (!loading && event.currentTarget.dataset.aiAccess !== 'granted') {
          router.push('/login?mode=signup')
        }
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z" />
        <path d="m18.5 13-.8 2.2-2.2.8 2.2.8.8 2.2.8-2.2 2.2-.8-2.2-.8-.8-2.2Z" />
        <path d="m5.5 14-.7 1.8-1.8.7 1.8.7.7 1.8.7-1.8 1.8-.7-1.8-.7-.7-1.8Z" />
      </svg>
      <span>{loading ? 'Проверяем вход…' : label}</span>
    </button>
  )
}
