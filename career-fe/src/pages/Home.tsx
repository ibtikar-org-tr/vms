import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { startVmsSsoLogin } from '../lib/vms-sso'

export default function Home() {
  const { session } = useAuth()

  return (
    <section className="px-2 py-8 text-center sm:py-12">
      <h1 className="text-3xl font-bold leading-tight text-carbon sm:text-5xl">إنشاء السيرة الذاتية</h1>
      <p className="mx-auto mt-4 max-w-2xl text-base text-gray-700 sm:text-lg">
        أنشئ سيرتك المهنية عبر عضويتك في إبتكار. البيانات الشخصية تُجلب تلقائياً من منصة الأعضاء، وتضيف
        خبراتك ومشاريعك وملفاتك هنا.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {session ? (
          <>
            <Link to="/profile" className="btn-primary">
              تعديل سيرتي
            </Link>
            <Link to="/talent" className="btn-ghost">
              تصفح السير المنشورة
            </Link>
          </>
        ) : (
          <button type="button" className="btn-primary" onClick={() => startVmsSsoLogin('/profile')}>
            الدخول عبر منصة الأعضاء
          </button>
        )}
      </div>
    </section>
  )
}
