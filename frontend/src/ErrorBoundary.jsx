import React from 'react';

// Without this, any uncaught error anywhere in the render tree (a null
// field crashing a .toLowerCase() call, for example) unmounts the whole
// app to a silent blank white screen — no error, no clue what happened,
// just nothing. That's genuinely undiagnosable from outside the browser's
// own dev tools. This catches it and shows the actual error message
// instead, so "blank screen" becomes "here's exactly what broke."
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Uncaught render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 480, margin: '80px auto', padding: '32px 28px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
            This screen hit an unexpected error instead of loading. The details below are exactly what's needed to fix it.
          </p>
          <pre style={{
            textAlign: 'left', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: 12, fontSize: 11.5, color: '#7f1d1d', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
          }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
            style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            Reload Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
