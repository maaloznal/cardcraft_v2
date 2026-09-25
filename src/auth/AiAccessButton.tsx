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
      <span aria-hidden="true">✦</span>
      <span>{loading ? 'Проверяем вход…' : label}</span>
    </button>
  )
}
