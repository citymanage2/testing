import React from 'react';
import { C } from '../ui';

interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.danger, marginBottom: 8 }}>Что-то пошло не так</div>
          <div style={{ fontSize: 13, color: C.textSec, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>{this.state.message}</div>
          <button
            onClick={() => { this.setState({ hasError: false, message: '' }); window.history.back(); }}
            style={{ padding: '8px 20px', background: C.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
          >
            ← Назад
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
