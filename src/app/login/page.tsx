'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/auth/AuthProvider'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const enabled = supabase !== null

  // Already logged in → redirect to home
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/')
    }
  }, [user, authLoading, router])

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 6) return 'Пароль должен содержать минимум 6 символов'
    return null
  }

  const validateEmail = (em: string): string | null => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return 'Введите корректный email'
    return null
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)

    if (!supabase) {
      setError('Supabase не настроен. Обратитесь к администратору.')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      })
      if (error) throw error
      // OAuth redirects away — no setLoading(false) needed
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа через Google')
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (!supabase) {
      setError('Supabase не настроен. Обратитесь к администратору.')
      return
    }

    // Client-side validation
    const emailErr = validateEmail(email)
    if (emailErr) { setError(emailErr); return }
    const pwErr = validatePassword(password)
    if (pwErr) { setError(pwErr); return }

    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          // Friendly Russian messages for common auth errors
          if (error.message.toLowerCase().includes('invalid login credentials')) {
            throw new Error('Неверный email или пароль')
          }
          if (error.message.toLowerCase().includes('email not confirmed')) {
            throw new Error('Email не подтверждён. Проверьте почту и перейдите по ссылке из письма.')
          }
          throw error
        }
        // Success — AuthProvider will pick up session; redirect
        router.push('/')
        router.refresh()
      } else {
        // Register
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) {
          if (error.message.toLowerCase().includes('already registered') ||
              error.message.toLowerCase().includes('user already registered')) {
            throw new Error('Пользователь с таким email уже зарегистрирован. Войдите.')
          }
          if (error.message.toLowerCase().includes('rate limit') ||
              error.message.toLowerCase().includes('over_email_send_rate_limit')) {
            throw new Error('Слишком много писем за последний час. Подождите немного и попробуйте снова.')
          }
          throw error
        }
        // Check if email confirmation is required
        if (data.user && !data.session) {
          setInfo('Письмо с подтверждением отправлено на ' + email + '. Перейдите по ссылке в письме, затем войдите.')
          setMode('login')
          setPassword('')
        } else if (data.session) {
          // Auto-confirmed (email confirmation disabled) → redirect
          router.push('/')
          router.refresh()
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  // Auth disabled banner
  if (!enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full p-8 border rounded-lg">
          <h1 className="text-3xl font-bold text-center mb-4">Cardcraft</h1>
          <div className="bg-amber-500/10 border border-amber-500 text-amber-700 dark:text-amber-400 px-4 py-3 rounded">
            Авторизация отключена: Supabase не настроен.
            Обратитесь к администратору.
          </div>
          <Link href="/" className="block text-center mt-6 text-sm underline">
            ← На главную
          </Link>
        </div>
      </div>
    )
  }

  // Loading auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Проверка авторизации…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full p-8">
        <Link href="/" className="block text-center text-3xl font-bold mb-8 hover:opacity-80">
          Cardcraft
        </Link>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {info && (
          <div className="bg-green-500/10 border border-green-500 text-green-700 dark:text-green-400 px-4 py-3 rounded mb-4 text-sm">
            {info}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border rounded-md bg-background hover:bg-secondary disabled:opacity-50 transition-colors"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z" />
            <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59C7.19 7.72 9.4 5.96 12 5.96Z" />
          </svg>
          Войти через Google
        </button>

        <div className="flex items-center gap-3 my-6 text-sm text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>или по email</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-secondary rounded-md">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); setInfo(null) }}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(null); setInfo(null) }}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              mode === 'register' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-2 border rounded-md bg-background disabled:opacity-50"
              disabled={loading}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full px-4 py-2 border rounded-md bg-background disabled:opacity-50"
              disabled={loading}
              placeholder="Минимум 6 символов"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading
              ? (mode === 'login' ? 'Входим…' : 'Регистрируем…')
              : (mode === 'login' ? 'Войти' : 'Зарегистрироваться')
            }
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === 'login' ? (
            <>Нет аккаунта?{' '}
              <button type="button" onClick={() => { setMode('register'); setError(null); setInfo(null) }} className="underline hover:text-foreground">
                Зарегистрируйтесь
              </button>
            </>
          ) : (
            <>Уже есть аккаунт?{' '}
              <button type="button" onClick={() => { setMode('login'); setError(null); setInfo(null) }} className="underline hover:text-foreground">
                Войдите
              </button>
            </>
          )}
        </p>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Войдите для синхронизации проектов между устройствами
        </p>
      </div>
    </div>
  )
}
