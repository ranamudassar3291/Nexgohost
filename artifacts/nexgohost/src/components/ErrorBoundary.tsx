import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Uncaught render error:", error.message, info.componentStack?.slice(0, 400));
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <CrashScreen error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

function CrashScreen({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #0f0c29 0%, #1a1060 50%, #24243e 100%)" }}
    >
      <div className="text-center max-w-lg">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.55)" }}>
          An unexpected error occurred in the application. Please try refreshing — if the problem persists, contact support.
        </p>
        {error?.message && (
          <div
            className="text-left text-xs font-mono px-4 py-3 rounded-xl mb-6 break-all"
            style={{ background: "rgba(0,0,0,0.4)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {error.message.slice(0, 280)}
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onRetry}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #4F46E5, #6366F1)" }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
