export function Loading({ text = 'جارٍ التحميل…' }) {
  return (
    <p className="muted" role="status">
      {text}
    </p>
  )
}

export function ErrorBox({ error }) {
  return (
    <div className="notice notice-error" role="alert">
      <p>تعذّر تحميل البيانات. أعد المحاولة لاحقا.</p>
      <p className="mono small">{String(error?.message ?? error)}</p>
    </div>
  )
}
