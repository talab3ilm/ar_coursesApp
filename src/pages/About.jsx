import { useEffect, useState } from 'react'
import { contributors } from '../lib/api'
export default function About() {
  const [names, setNames] = useState([])
  useEffect(() => {
    contributors().then(setNames)
  }, [])
  return (
    <article className="prose">
      <h1>عن الموقع</h1>
      <p>
        هذا الموقع <strong>عمل مستقل من طلبة</strong> يراجعون دروسهم معا: لكل درس ملخّص، وبطاقات مراجعة،
        وخريطة ذهنية، أعدّها الطلبة بأنفسهم من مذاكرتهم.
      </p>
      <p>
        الموقع <strong>لا يمثّل الأكاديمية ولا صلة رسمية له بها</strong>، ولا ينشر تسجيلات الدروس ولا تفريغاتها
        ولا موادها التعليمية، احتراما لنظامها الداخلي. إن رأى أصحاب الحق أن محتوى ما لا ينبغي بقاؤه هنا،
        فليُراسلونا عبر{' '}
        <a href="https://github.com/talab3ilm/ar_coursesApp/issues" target="_blank" rel="noreferrer">
          صفحة المشروع
        </a>{' '}
        ويُحذف فورا.
      </p>
      <p>
        التصميم الأول للتطبيق من إعداد الطالب <strong>عبد العالي</strong>، فجزاه الله خيرا. وقد أُعيد بناؤه
        وتوسيعه هنا بإذنه.
      </p>
      <p>
        كل طالب يمكنه اقتراح تصحيح أو إضافة من زر «اقترح تصحيحا» في صفحات الدروس، انظر{' '}
        <a href="/contribute">كيف تساهم</a>. شكرا لكل من ساهم بملاحظة أو تصحيح
        {names.length > 0 ? <>، ومنهم: {names.join('، ')}.</> : '.'}
      </p>
      <p>
        لا يحتاج الموقع إلى حساب: تقدّمك في المراجعة يُحفظ في متصفحك فقط. إن مسحت بيانات المتصفح ضاع
        التقدّم، فاحرص على تصديره من حين لآخر من <a href="/progress">صفحة التقدّم</a>.
      </p>
    </article>
  )
}
