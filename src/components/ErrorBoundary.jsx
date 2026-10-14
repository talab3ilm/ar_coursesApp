import { Component } from 'react'

/** Évite la page blanche : une erreur de rendu affiche un message et un bouton de rechargement. */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="notice notice-error" role="alert">
        <p>حدث خطأ غير متوقع في الصفحة.</p>
        <p className="mono small">{String(this.state.error?.message ?? this.state.error)}</p>
        <button className="btn btn-ghost" onClick={() => window.location.reload()}>
          إعادة تحميل الصفحة
        </button>
      </div>
    )
  }
}
