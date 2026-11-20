import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { startVmsSsoLogin } from '../lib/vms-sso'

export default function Home() {
  const { session } = useAuth()

  return (
    <section className="relative overflow-hidden rounded-xl border border-line bg-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'linear-gradient(135deg, rgba(11,107,99,0.08) 0%, transparent 42%), linear-gradient(to left, rgba(11,95,154,0.05), transparent 35%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(216,222,230,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(216,222,230,0.55) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(180deg, black, transparent 85%)',
        }}
      />

      <div className="relative px-6 py-14 sm:px-12 sm:py-20">
        <div className="flex items-center gap-3">
          <img
            src="/career-mark.svg"
            alt=""
            className="h-12 w-12 rounded-lg object-cover ring-1 ring-line sm:h-14 sm:w-14"
          />
          <div>
            <p className="text-lg font-bold text-ink sm:text-xl">المسار المهني</p>
            <p className="text-sm text-muted">تجمّع إبتكار</p>
          </div>
        </div>

        <h1 className="mt-8 max-w-2xl text-3xl font-bold leading-[1.25] text-ink sm:text-4xl">
          سيرة مهنية مرتبطة بعضويتك
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted sm:text-[15px]">
          البيانات الشخصية تُجلب من منصة الأعضاء. تضيف هنا خبراتك ومشاريعك وتفضيلات العمل، وتُراجع
          السير من فريق إبتكار.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {session ? (
            <>
              <Link to="/profile" className="btn-primary">
                سيرتي
              </Link>
              <Link to="/profile/edit" className="btn-ghost">
                تعديل السيرة
              </Link>
              <Link to="/talent" className="btn-ghost">
                تصفح السير المنشورة
              </Link>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => startVmsSsoLogin('/profile')}
            >
              الدخول عبر منصة الأعضاء
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
