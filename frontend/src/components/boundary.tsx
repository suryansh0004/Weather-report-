import { Component, type ReactNode } from 'react';
import { Card } from './ui';

/**
 * A field app must never show a white screen. If one card throws — a malformed
 * block from a partially synced payload, for example — the rest of the bulletin
 * stays readable and the user is told to re-sync.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(err: unknown) {
    return { message: err instanceof Error ? err.message : String(err) };
  }

  componentDidUpdate(prev: { children: ReactNode }) {
    if (prev.children !== this.props.children && this.state.message) this.setState({ message: null });
  }

  render() {
    if (this.state.message) {
      return (
        <Card>
          <p className="text-[13px] font-semibold text-danger">This section could not be drawn</p>
          <p className="mt-1 text-[11.5px] leading-snug text-muted">
            {this.state.message} — the cached bulletin may be partial. Pull a fresh sync from the Sync tab.
          </p>
          <button
            onClick={() => this.setState({ message: null })}
            className="mt-2 rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-semibold"
          >
            Try again
          </button>
        </Card>
      );
    }
    return this.props.children;
  }
}
