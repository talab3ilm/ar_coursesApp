// Page d'accueil provisoire : squelette de l'étape 1, remplacé à l'étape 3
// par l'accueil réel (matières en onglets, cours en puces) branché sur Supabase.
export default function App() {
  return (
    <main className="shell">
      <header className="hero">
        <h1>دروس الأكاديمية</h1>
        <p className="lead">
          فيديو الدرس، ملخّص قابل للنقر، بطاقات مراجعة، وخريطة ذهنية لكل درس.
        </p>
      </header>
      <section className="notice" aria-live="polite">
        <p>الموقع قيد الإنشاء — المحتوى قريبا إن شاء الله.</p>
      </section>
    </main>
  )
}
