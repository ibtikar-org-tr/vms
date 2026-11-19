import { Link } from 'react-router-dom'
import { ArrowLeft, FileText, Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { startVmsSsoLogin } from '../lib/vms-sso'

export default function Home() {
  const { session } = useAuth()

  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-white shadow-sheet">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(204,251,241,0.7),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(224,242,254,0.55),transparent_45%)]" />

      <div className="relative px-6 py-12 text-center sm:px-10 sm:py-16">
        <p className="inline-flex rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand-ink sm:text-sm">
          #جيلٌ_يبتكر
        </p>
        <h1 className="mx-auto mt-5 max-w-2xl text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">
          سيرتك المهنية ضمن تجمّع إبتكار
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
          ابنِ سيرة ذاتية احترافية مرتبطة بعضويتك. البيانات الشخصية تُجلب من منصة الأعضاء، وتضيف
          خبراتك ومشاريعك وملفاتك هنا.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {session ? (
            <>
              <Link to="/profile" className="btn-primary">
                <FileText className="h-4 w-4" />
                تعديل سيرتي
              </Link>
              <Link to="/talent" className="btn-ghost">
                <Search className="h-4 w-4" />
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

        <div className="mx-auto mt-12 grid max-w-3xl gap-3 text-start sm:grid-cols-3">
          {[
            { title: 'مرتبطة بالعضوية', body: 'الاسم والصورة والتعليم تُزامَن من منصة الأعضاء.' },
            { title: 'عرض كسيرة', body: 'معاينة أنيقة جاهزة للمراجعة من فريق إبتكار.' },
            { title: 'خبرات ومشاريع', body: 'أضف تجاربك ومهاراتك المكتسبة وملفاتك.' },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-line/80 bg-white/80 p-4">
              <p className="text-sm font-bold text-slate-900">{item.title}</p>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
