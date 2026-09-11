'use client';

/**
 * ErrorBoundary — React error boundary for the Cardcraft app.
 *
 * Catches render-time errors anywhere in the child tree and shows
 * a friendly fallback instead of a blank white screen. Provides a
 * "Reload" button that re-mounts the subtree.
 *
 * Also exposes a global hook `window.__cardcraftReload()` so imperative
 * code (e.g. the orchestrator) can trigger a reload from outside React.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <Home />
 *   </ErrorBoundary>
 */

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
  errorId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorId: '' };

  static getDerivedStateFromError(error: Error): State {
    return {
      error,
      errorId: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Log to console — production should send to telemetry
    console.error('[Cardcraft ErrorBoundary]', error, info.componentStack);

    // Persist last error to localStorage for debugging
    try {
      const payload = {
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : '',
      };
      localStorage.setItem('cardcraft:last-error', JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }

  reset = (): void => {
    this.setState({ error: null, errorId: '' });
  };

  reload = (): void => {
    this.reset();
    // Force full page reload as ultimate fallback
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      const message = this.state.error.message || 'Неизвестная ошибка';
      const isDev = process.env.NODE_ENV !== 'production';
      const stack = isDev ? this.state.error.stack : null;

      return (
        <div
          role="alert"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: '#fafafa',
            color: '#1f2937',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
            Что-то пошло не так
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', maxWidth: '480px', margin: 0 }}>
            Произошла ошибка при отрисовке интерфейса. Попробуйте перезагрузить страницу.
            Если ошибка повторяется, очистите локальное хранилище.
          </p>
          <details
            style={{
              maxWidth: '640px',
              width: '100%',
              textAlign: 'left',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            <summary style={{ cursor: 'pointer', color: '#6b7280' }}>
              Детали ошибки ({this.state.errorId})
            </summary>
            <pre style={{ marginTop: '8px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {message}
              {stack ? `\n\n${stack}` : ''}
            </pre>
          </details>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={this.reset}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                background: '#fff',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Попробовать снова
            </button>
            <button
              type="button"
              onClick={this.reload}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                border: 'none',
                background: '#111827',
                color: '#fff',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
