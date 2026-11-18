import { useSearchParams } from 'react-router-dom'
import { startVmsSsoLogin } from '../lib/vms-sso'

export default function Login() {
  const [params] = useSearchParams()
  const next = params.get('next') || '/profile'

  return (
    <section className="panel mx-auto max-w-lg p-8 text-center">
      <h1 className="text-3xl font-bold text-carbon">تسجيل الدخول</h1>
      <p className="mt-3 text-gray-700">
        أنشئ أو حدّث سيرتك عبر عضويتك في منصة أعضاء إبتكار. سيتم تحويلك للمنصة ثم إعادتك هنا بعد
        الدخول.
      </p>
      <button type="button" className="btn-primary mt-6" onClick={() => startVmsSsoLogin(next)}>
        المتابعة عبر منصة الأعضاء
      </button>
    </section>
  )
}
