import React, { StrictMode, Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Athena Global ErrorBoundary Caught]:", error, errorInfo);
    (this as any).setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#f43f5e', fontSize: '1.5rem', marginBottom: '1rem' }}>Athena Terminal Runtime Notice</h2>
          <p style={{ marginBottom: '1rem', color: '#94a3b8' }}>A client-side component experienced a rendering exception:</p>
          <pre style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem', overflowX: 'auto', color: '#fb7185', fontSize: '0.875rem' }}>
            {this.state.error && this.state.error.toString()}
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '1.5rem', padding: '0.5rem 1rem', backgroundColor: '#6366f1', color: '#ffffff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
          >
            Reload Athena Terminal
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

// Global defensive event listeners to guard against unhandled promise rejections or async network aborts
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('[Athena Runtime Guard] Non-fatal unhandled promise rejection caught:', event.reason);
    // Prevent unhandled promise rejection from escalating to browser-level fatal state
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    if (event.error?.message?.includes('ResizeObserver') || event.message?.includes('ResizeObserver')) {
      // Benign browser resize observer loop error
      event.stopImmediatePropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


