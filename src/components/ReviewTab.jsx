import { useMemo, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { MAX_BOX, answer, boxCounts, boxNextDue, cardState, dueLabel, getSnapshot, isDue, needsExportReminder, resetCourse, subscribe } from '../lib/progress'
import { ProgressWarning } from '../pages/Progress.jsx'
import { shuffle } from '../lib/arabic'
import { withQuran } from '../lib/quran.jsx'
import SuggestButton from './SuggestButton.jsx'

const BOX_LABELS = ['جديدة', 'صندوق 1', 'صندوق 2', 'صندوق 3', 'صندوق 4', 'محفوظة']

/** File de révision : cartes dues, les plus basses boîtes d'abord, puis l'ordre du deck. */
function buildQueue(cards, all) {
  const due = all ? cards : cards.filter((c) => isDue(c.guid))
  return [...due].sort((a, b) => cardState(a.guid).box - cardState(b.guid).box || a.position - b.position)
}

/** Distracteurs : réponses d'autres cartes partageant un tag (hors tag de matière), sinon au hasard. */
function distractors(card, cards, n = 3) {
  const tags = new Set(card.tags.slice(1))
  const pool = cards.filter((c) => c.guid !== card.guid && c.answer !== card.answer)
  const same = pool.filter((c) => c.tags.some((t) => tags.has(t)))
  const picked = shuffle(same).slice(0, n)
  if (picked.length < n) {
    const rest = shuffle(pool.filter((c) => !picked.includes(c)))
    picked.push(...rest.slice(0, n - picked.length))
  }
  return picked.map((c) => c.answer)
}

function Progress({ cards }) {
  const guids = cards.map((c) => c.guid)
  const counts = boxCounts(guids)
  const nextDue = boxNextDue(guids) // prochaine carte à revoir dans chaque boîte
  const total = guids.length || 1
  return (
    <div className="progress">
      <div className="bar" role="img" aria-label="توزيع البطاقات على الصناديق">
        {counts.map((n, box) => (n ? <span key={box} className={`seg b${box}`} style={{ flex: n / total }} title={`${BOX_LABELS[box]}: ${n}`} /> : null))}
      </div>
      <p className="small muted">
        {counts.map((n, box) => (
          <span key={box} className="box-stat">
            <b>{BOX_LABELS[box]}</b> {n}
            {n > 0 && nextDue[box] !== null && <i> · {dueLabel(nextDue[box])}</i>}
          </span>
        ))}
      </p>
    </div>
  )
}

export default function ReviewTab({ courseId, cards }) {
  useSyncExternalStore(subscribe, getSnapshot)
  const [mode, setMode] = useState('flip') // flip | quiz
  const [all, setAll] = useState(false)
  const [round, setRound] = useState(0)
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(false)
  const [choice, setChoice] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queue = useMemo(() => buildQueue(cards, all), [cards, all, round])
  const card = queue[i]
  const options = useMemo(() => (card && mode === 'quiz' ? shuffle([card.answer, ...distractors(card, cards)]) : []), [card, cards, mode])

  const dueCount = cards.filter((c) => isDue(c.guid)).length
  const knownCount = cards.filter((c) => cardState(c.guid).box === MAX_BOX).length

  const next = () => {
    setShown(false)
    setChoice(null)
    setI(i + 1)
  }
  const grade = (known) => {
    answer(card.guid, known)
    next()
  }
  const restart = (reviewAll) => {
    setAll(reviewAll)
    setRound(round + 1)
    setI(0)
    setShown(false)
    setChoice(null)
  }

  if (cards.length === 0) return <p className="muted">لا بطاقات لهذا الدرس بعد.</p>

  return (
    <div className="review">
      <header className="review-intro">
        <h2>المراجعة</h2>
        <p>حاول الإجابة قبل إظهار الجواب. الأسئلة مأخوذة من الدرس، وأجوبتها من ملخّصه أو من خريطته الذهنية.</p>
        <p className="small muted">علامة «عرفتُها» تُحفظ في هذا المتصفح فقط.</p>
      </header>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="نوع المراجعة">
          <button aria-pressed={mode === 'flip'} onClick={() => setMode('flip')}>
            بطاقات
          </button>
          <button aria-pressed={mode === 'quiz'} onClick={() => setMode('quiz')}>
            اختيار من متعدد
          </button>
        </div>
        <span className="small muted">
          {cards.length} بطاقة · مستحقة الآن {dueCount} · محفوظة {knownCount}
        </span>
      </div>
      <Progress cards={cards} />
      {needsExportReminder() && <ProgressWarning compact />}

      {!card ? (
        <div className="notice center">
          <p>{queue.length ? 'انتهت جولة المراجعة، أحسنت.' : 'لا بطاقات مستحقة الآن.'}</p>
          <div className="row">
            {dueCount > 0 && (
              <button className="btn" onClick={() => restart(false)}>
                مراجعة المستحقة ({dueCount})
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => restart(true)}>
              مراجعة كل البطاقات
            </button>
          </div>
        </div>
      ) : (
        <div className="flashcard" key={card.guid}>
          <p className="small muted">
            {i + 1} / {queue.length} · {BOX_LABELS[cardState(card.guid).box]}
          </p>
          <p className="question">{withQuran(card.question)}</p>

          {mode === 'flip' && !shown && (
            <button className="btn" onClick={() => setShown(true)}>
              إظهار الجواب
            </button>
          )}
          {mode === 'flip' && shown && (
            <>
              <p className="answer">{withQuran(card.answer)}</p>
              <div className="row">
                <button className="btn" onClick={() => grade(true)}>
                  عرفتُها
                </button>
                <button className="btn btn-ghost" onClick={() => grade(false)}>
                  لم أعرفها
                </button>
              </div>
              <p className="suggest-row">
                <SuggestButton courseId={courseId} tab="review" location={card.guid} context={card.question.slice(0, 60)} original={`${card.question}\n---\n${card.answer}`} label="اقترح تصحيحا للبطاقة" />
              </p>
            </>
          )}

          {mode === 'quiz' && (
            <>
              <ol className="options">
                {options.map((opt) => {
                  const state = choice === null ? '' : opt === card.answer ? 'correct' : opt === choice ? 'wrong' : ''
                  return (
                    <li key={opt}>
                      <button className={`option ${state}`} disabled={choice !== null} onClick={() => setChoice(opt)}>
                        {withQuran(opt)}
                      </button>
                    </li>
                  )
                })}
              </ol>
              {choice !== null && (
                <div className="row">
                  <span className={choice === card.answer ? 'ok' : 'ko'}>{choice === card.answer ? 'صحيح' : 'خطأ'}</span>
                  <button className="btn" onClick={() => grade(choice === card.answer)}>
                    التالي
                  </button>
                </div>
              )}
            </>
          )}
          {card.tags.length > 1 && <p className="small muted tags">{card.tags.slice(1).join(' · ')}</p>}
        </div>
      )}

      <p className="small muted">
        التقدّم يُحفظ في هذا المتصفح فقط (<Link to="/progress">تصدير / استيراد</Link>).{' '}
        <button
          className="link"
          onClick={() => {
            if (window.confirm('إعادة تعيين تقدّم هذا الدرس؟')) {
              resetCourse(cards.map((c) => c.guid))
              restart(false)
            }
          }}
        >
          إعادة تعيين تقدّم هذا الدرس
        </button>
      </p>
    </div>
  )
}
