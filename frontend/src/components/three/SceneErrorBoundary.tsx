"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for WebGL / R3F scenes. If a 3D scene crashes (out-of-memory,
 * context lost, GL error, etc.), the rest of the page keeps rendering. The
 * fallback defaults to a quiet neutral area so the layout doesn't jump.
 */
export default class SceneErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (typeof console !== "undefined") {
      console.warn("[SceneErrorBoundary] 3D scene crashed:", error.message, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <div className="absolute inset-0 bg-gradient-to-br from-deep to-dark" aria-hidden="true" />
      );
    }
    return this.props.children;
  }
}
