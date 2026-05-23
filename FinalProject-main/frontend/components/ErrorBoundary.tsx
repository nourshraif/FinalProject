"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="glass-card mx-auto max-w-md rounded-2xl p-8 text-center">
          <span className="text-4xl" aria-hidden>
            ⚠️
          </span>
          <h2 className="mt-4 text-lg font-bold text-white">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-vertex-muted">
            This section failed to load
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ghost-button mt-6 rounded-lg px-4 py-2 text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
