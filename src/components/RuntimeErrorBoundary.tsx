import React from "react";

interface BoundaryState {
  error: string | null;
  stack: string | null;
}

export default class RuntimeErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { error: null, stack: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack ?? null : null,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[SPECTRA runtime crash]", error, info.componentStack);
  }

  private reload = () => window.location.reload();

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main style={{ minHeight: "100vh", boxSizing: "border-box", padding: "clamp(20px, 5vw, 56px)", background: "#080e14", color: "#e7edf1", fontFamily: "Segoe UI, system-ui, sans-serif" }}>
        <section style={{ maxWidth: 900, margin: "0 auto", border: "1px solid #62404a", borderRadius: 10, background: "#111923", padding: 24 }}>
          <p style={{ color: "#ff8998", fontSize: 12, fontWeight: 700, letterSpacing: ".12em" }}>SPECTRA · RUNTIME ERROR</p>
          <h1 style={{ margin: "0 0 12px", fontSize: 25 }}>The simulator failed to start</h1>
          <p style={{ color: "#b5c3cc", lineHeight: 1.6 }}>The page has caught the startup error instead of remaining blank. Copy the error below if you need to report it.</p>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", border: "1px solid #3c3138", borderRadius: 6, padding: 14, color: "#ffd7dd", background: "#0b1118", fontSize: 12, lineHeight: 1.5 }}>{this.state.error}</pre>
          {this.state.stack && <details style={{ marginTop: 12, color: "#9db0bb" }}><summary>Technical details</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 11, lineHeight: 1.5 }}>{this.state.stack}</pre></details>}
          <button onClick={this.reload} style={{ marginTop: 18, padding: "10px 16px", border: "1px solid #4f9c81", borderRadius: 5, background: "#184936", color: "#d7fff0", cursor: "pointer" }}>Reload SPECTRA</button>
        </section>
      </main>
    );
  }
}
