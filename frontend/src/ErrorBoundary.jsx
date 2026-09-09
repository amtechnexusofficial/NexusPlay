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
    this.state = { error: null, componentStack: '' };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Uncaught render error:', error, info);
    // componentStack names the actual React component tree (e.g.
    // "in PlayerMarketplace") even when the minified build's variable
    // names (in error.stack) are single letters — this is what actually
    // identifies which screen/component broke.
    this.setState({ componentStack: info?.componentStack || '' });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 560, margin: '80px auto', padding: '32px 28px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
            This screen hit an unexpected error instead of loading. Everything below (including the URL) is exactly what's needed to fix it — copy the whole block.
          </p>
          <pre style={{
            textAlign: 'left', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: 12, fontSize: 11, color: '#7f1d1d', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflowY: 'auto'
          }}>
            {`URL: ${window.location.href}\n\n${this.state.error?.message || String(this.state.error)}\n\n${this.state.error?.stack || ''}\n\n${this.state.componentStack}`}
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
