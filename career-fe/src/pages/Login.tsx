import { useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { startVmsSsoLogin } from '../lib/vms-sso'

export default function Login() {
  const [params] = useSearchParams()
  const next = params.get('next') || '/profile'

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-3">
      <section className="panel px-7 py-9 sm:px-8">
        <img
          src="/career-mark.svg"
          alt="المسار المهني"
          className="h-11 w-11 rounded-md object-cover ring-1 ring-line"
        />
        <h1 className="mt-5 text-2xl font-bold text-ink">تسجيل الدخول</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          أنشئ أو حدّث سيرتك عبر عضويتك في منصة أعضاء إبتكار. سيتم تحويلك للمنصة ثم إعادتك هنا بعد
          الدخول.
        </p>
        <button
          type="button"
          className="btn-primary mt-7 w-full"
          onClick={() => startVmsSsoLogin(next)}
        >
          المتابعة عبر منصة الأعضاء
          <ArrowLeft className="h-4 w-4" />
        </button>
      </section>
    </div>
  )
}
