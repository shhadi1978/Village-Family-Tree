import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle2, Database, ShieldCheck, Wrench, Smartphone } from "lucide-react";
import {
  getDevRoleOverrideByCookie,
  isConfiguredSuperAdmin,
  isSuperAdmin,
} from "@/lib/authz";

export const metadata = {
  title: "صفحة المطور - شجرة عائلات القرية",
};

type StatusCardProps = {
  label: string;
  value: string;
  ok?: boolean;
};

function StatusCard({ label, value, ok = true }: StatusCardProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-lg font-semibold text-white break-all">{value}</p>
        </div>
        {ok ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        ) : (
          <AlertCircle className="h-6 w-6 text-amber-400" />
        )}
      </div>
    </div>
  );
}

export default async function DeveloperPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const superAdmin = isSuperAdmin(userId);
  const configuredSuperAdmin = isConfiguredSuperAdmin(userId);
  const effectiveRole = superAdmin
    ? "Super Admin"
    : configuredSuperAdmin
      ? "Family Admin (downgraded by dev override)"
      : "Family Admin / Viewer";

  const roleOverride = getDevRoleOverrideByCookie() || "SUPER_ADMIN";

  let dbStatus = "متصل";
  let dbOk = true;

  try {
    const { db } = await import("@/lib/db");
    await db.$queryRaw`SELECT 1`;
  } catch (error) {
    dbOk = false;
    dbStatus = error instanceof Error ? error.message : "تعذر التحقق من قاعدة البيانات";
  }

  const envChecks = [
    { key: "DATABASE_URL", ok: Boolean(process.env.DATABASE_URL) },
    { key: "DIRECT_URL", ok: Boolean(process.env.DIRECT_URL) },
    { key: "CLERK_SECRET_KEY", ok: Boolean(process.env.CLERK_SECRET_KEY) },
    {
      key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      ok: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    },
    { key: "UPLOADTHING_SECRET", ok: Boolean(process.env.UPLOADTHING_SECRET) },
    { key: "UPLOADTHING_APP_ID", ok: Boolean(process.env.UPLOADTHING_APP_ID) },
    { key: "NEXT_PUBLIC_APP_URL", ok: Boolean(process.env.NEXT_PUBLIC_APP_URL) },
    { key: "SUPER_ADMIN_CLERK_IDS", ok: Boolean(process.env.SUPER_ADMIN_CLERK_IDS) },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-sm text-blue-200">
              <Wrench className="h-4 w-4" />
              أدوات المطور
            </div>
            <h1 className="text-3xl font-bold text-white">صفحة المطور</h1>
            <p className="mt-2 max-w-2xl text-slate-300">
              صفحة داخلية لمراقبة صحة النظام، التحقق من الإعدادات، والوصول السريع لأدوات الفحص أثناء التطوير والإدارة.
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-300">
            <p>المستخدم الحالي</p>
            <p className="mt-1 font-mono text-xs text-white break-all">{userId}</p>
          </div>
        </div>
      </section>

      {!superAdmin && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
          <p className="font-semibold">وصول محدود</p>
          <p className="mt-1 text-sm leading-6 text-amber-200">
            هذه الصفحة متاحة لك للمتابعة والفحص فقط. لتفعيل صلاحيات المطور الكاملة أضف معرفك في متغير البيئة
            SUPER_ADMIN_CLERK_IDS داخل Vercel ثم أعد النشر.
          </p>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          label="وضع البيئة"
          value={process.env.NODE_ENV === "production" ? "Production" : "Development"}
        />
        <StatusCard label="المشرف الأعلى" value={configuredSuperAdmin ? "مفعّل" : "غير مفعّل"} ok={configuredSuperAdmin} />
        <StatusCard label="الرتبة الحالية" value={effectiveRole} ok={superAdmin} />
        <StatusCard label="الدور الحالي" value={roleOverride} />
        <StatusCard label="قاعدة البيانات" value={dbStatus} ok={dbOk} />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
          <div className="mb-5 flex items-center gap-2 text-white">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h2 className="text-xl font-bold">فحص المتغيرات</h2>
          </div>
          <div className="space-y-3">
            {envChecks.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3"
              >
                <span className="font-mono text-sm text-slate-200">{item.key}</span>
                <span className={`text-sm font-semibold ${item.ok ? "text-emerald-400" : "text-amber-400"}`}>
                  {item.ok ? "موجود" : "مفقود"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
            <div className="mb-4 flex items-center gap-2 text-white">
              <Database className="h-5 w-5 text-blue-400" />
              <h2 className="text-xl font-bold">روابط فحص سريعة</h2>
            </div>
            <div className="space-y-3 text-sm">
              <Link href="/api/health" className="block rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-blue-300 hover:border-blue-500/50 hover:text-blue-200">
                فتح /api/health
              </Link>
              <Link href="/api/me/permissions" className="block rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-blue-300 hover:border-blue-500/50 hover:text-blue-200">
                فتح /api/me/permissions
              </Link>
              <Link href="/dashboard" className="block rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-blue-300 hover:border-blue-500/50 hover:text-blue-200">
                العودة إلى لوحة التحكم
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
            <div className="mb-4 flex items-center gap-2 text-white">
              <Smartphone className="h-5 w-5 text-fuchsia-400" />
              <h2 className="text-xl font-bold">التطبيق على الهاتف</h2>
            </div>
            <p className="text-sm leading-7 text-slate-300">
              تم تجهيز التطبيق ليُثبت كاختصار على شاشة الهاتف الرئيسية. في أندرويد سيظهر زر التثبيت داخل الموقع، وفي iPhone يمكن الإضافة عبر Share ثم Add to Home Screen.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}