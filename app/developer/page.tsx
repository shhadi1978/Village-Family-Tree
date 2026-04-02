import Link from "next/link";
import {
  ArrowLeft,
  Code2,
  Database,
  Globe,
  Mail,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Wrench,
} from "lucide-react";

export const metadata = {
  title: "المطور - شجرة عائلات القرية",
  description: "صفحة تعريف بالمطور والخدمات التقنية المقدمة.",
};

const services = [
  "تطوير مواقع تعريفية ومتاجر إلكترونية",
  "بناء لوحات تحكم وأنظمة إدارة",
  "تصميم قواعد بيانات وتحسين الأداء",
  "تطوير واجهات حديثة باستخدام Next.js و React",
  "ربط API وخدمات الدفع والإشعارات",
  "تحويل المواقع إلى تجربة تشبه تطبيق الهاتف",
];

const stack = [
  "Next.js",
  "React",
  "TypeScript",
  "Prisma",
  "PostgreSQL",
  "Clerk",
  "Tailwind CSS",
  "Vercel",
];

export default function PublicDeveloperPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#111827_100%)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm text-slate-200 transition hover:border-blue-500/40 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            العودة للرئيسية
          </Link>
          <div className="rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-200">
            صفحة المطور
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[28px] border border-slate-700/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur md:p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
              <Code2 className="h-4 w-4" />
              شحادة سيف
            </div>

            <h1 className="max-w-3xl text-4xl font-black leading-tight text-white md:text-6xl">
              مطور تطبيقات ومواقع
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
              أبني أنظمة إدارية حديثة، مواقع سريعة، وتجارب استخدام عملية للشركات والأفراد.
              أركز على الأداء، وضوح الواجهة، وسهولة الإدارة بعد الإطلاق.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="https://wa.me/972508530145"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                <MessageCircle className="h-4 w-4" />
                التواصل عبر واتساب
              </a>
              <a
                href="mailto:shhadi@gmai.com"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 px-5 py-3 font-semibold text-white transition hover:border-blue-400 hover:bg-slate-800"
              >
                <Mail className="h-4 w-4" />
                التواصل عبر البريد
              </a>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-700/80 bg-gradient-to-br from-slate-900/90 to-slate-800/80 p-6 md:p-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-5">
                <Globe className="mb-3 h-6 w-6 text-blue-400" />
                <h2 className="text-lg font-bold">حلول ويب متكاملة</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  مواقع تعريفية، لوحات تحكم، وحلول أعمال قابلة للتوسع والنشر السريع.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-5">
                <Database className="mb-3 h-6 w-6 text-cyan-400" />
                <h2 className="text-lg font-bold">بنية بيانات مستقرة</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  تصميم قواعد بيانات واضحة وربطها مع خدمات حديثة بشكل منظم وآمن.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-5">
                <Smartphone className="mb-3 h-6 w-6 text-fuchsia-400" />
                <h2 className="text-lg font-bold">تجربة تشبه التطبيق</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  دعم التثبيت على الهاتف وتجهيز الواجهة لتعمل كتجربة تطبيق حديثة.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[28px] border border-slate-700/80 bg-slate-900/70 p-6 md:p-8">
            <div className="mb-5 flex items-center gap-3">
              <Wrench className="h-5 w-5 text-amber-300" />
              <h2 className="text-2xl font-bold">الخدمات</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((service) => (
                <div
                  key={service}
                  className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4 text-sm leading-7 text-slate-200"
                >
                  {service}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-700/80 bg-slate-900/70 p-6 md:p-8">
            <div className="mb-5 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <h2 className="text-2xl font-bold">التقنيات</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {stack.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-600 bg-slate-950/40 px-4 py-2 text-sm text-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
              <p className="text-sm leading-7 text-blue-100">
                تم تطوير هذا النظام بواسطة شحادة سيف. إذا أردت صفحة مماثلة أو لوحة إدارة خاصة بمشروعك، يمكن تخصيصها بالكامل حسب الهوية والخدمات المطلوبة.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}