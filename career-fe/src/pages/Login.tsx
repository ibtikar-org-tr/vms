import { useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { startVmsSsoLogin } from '../lib/vms-sso'

export default function Login() {
  const [params] = useSearchParams()
  const next = params.get('next') || '/profile'

  return (
    <section className="mx-auto max-w-md overflow-hidden rounded-3xl border border-line bg-white shadow-sheet">
      <div className="h-1.5 bg-gradient-to-l from-brand via-teal-500 to-accent" />
      <div className="px-8 py-10 text-center">
        <img
          src="/career-mark.svg"
          alt="المسار المهني"
          className="mx-auto h-14 w-14 rounded-2xl object-cover shadow-sm ring-1 ring-line"
        />
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900 sm:text-3xl">تسجيل الدخول</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          أنشئ أو حدّث سيرتك عبر عضويتك في منصة أعضاء إبتكار. سيتم تحويلك للمنصة ثم إعادتك هنا بعد
          الدخول.
        </p>
        <button type="button" className="btn-primary mt-7 w-full" onClick={() => startVmsSsoLogin(next)}>
          المتابعة عبر منصة الأعضاء
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}
