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

      <div className="relative px-4 py-10 sm:px-12 sm:py-20">
        <div className="flex items-center gap-3">
          <img
            src="/career-mark.svg"
            alt=""
            className="h-11 w-11 rounded-lg object-cover ring-1 ring-line sm:h-14 sm:w-14"
          />
          <div>
            <p className="text-base font-bold text-ink sm:text-xl">المسار المهني</p>
            <p className="text-sm text-muted">تجمّع إبتكار</p>
          </div>
        </div>

        <h1 className="mt-7 max-w-2xl text-[1.65rem] font-bold leading-[1.3] text-ink sm:mt-8 sm:text-4xl sm:leading-[1.25]">
          سيرة مهنية مرتبطة بعضويتك
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted sm:mt-4 sm:text-[15px]">
          البيانات الشخصية تُجلب من منصة الأعضاء. تضيف هنا خبراتك ومشاريعك وتفضيلات العمل، وتختار
          متى تكون سيرتك عامة مع حماية للخصوصية.
        </p>

        <div className="mobile-actions mt-7 sm:mt-8">
          {session ? (
            <>
              <Link to="/profile" className="btn-primary w-full sm:w-auto">
                سيرتي
              </Link>
              <Link to="/profile/edit" className="btn-ghost w-full sm:w-auto">
                تعديل السيرة
              </Link>
              <Link to="/talent" className="btn-ghost w-full sm:w-auto">
                تصفح السير العامة
              </Link>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
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
