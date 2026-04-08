import { ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Users, Home, Wrench, UserCog } from "lucide-react";
import { isSuperAdmin } from "@/lib/authz";
import DevRoleSwitcher from "@/components/DevRoleSwitcher";
import EffectiveRoleBadge from "@/components/EffectiveRoleBadge";

export const metadata = {
  title: "لوحة التحكم - شجرة عائلات القرية",
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const superAdmin = isSuperAdmin(userId);
  let userFamilies: Array<{ familyId: string }> = [];

  try {
    const familyService = await import("@/lib/services/family");
    userFamilies = await familyService.getUserFamilies(userId);
  } catch (error) {
    // Avoid crashing server rendering if DB is temporarily unavailable.
    console.error("Dashboard layout failed to load user families:", error);
  }

  const canManageAnyFamily = superAdmin || userFamilies.length > 0;
  const mobileNavCols = superAdmin
    ? canManageAnyFamily
      ? "grid-cols-5"
      : "grid-cols-4"
    : canManageAnyFamily
      ? "grid-cols-3"
      : "grid-cols-2";

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="md:hidden bg-slate-800 border-b border-slate-700 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">لوحة التحكم</h2>
          <UserButton />
        </div>
        <div className="mt-3">
          <DevRoleSwitcher />
        </div>
        <div className="mt-2">
          <EffectiveRoleBadge />
        </div>
        <nav className={`mt-3 grid ${mobileNavCols} gap-2 text-sm`}>
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <Home className="w-4 h-4" />
            <span>الرئيسية</span>
          </Link>
          <Link
            href="/dashboard/families"
            className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <Users className="w-4 h-4" />
            <span>العائلات</span>
          </Link>
          {canManageAnyFamily && (
            <Link
              href="/dashboard/members"
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              <Users className="w-4 h-4" />
              <span>الأفراد</span>
            </Link>
          )}
          {superAdmin && (
            <Link
              href="/dashboard/users"
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              <UserCog className="w-4 h-4" />
              <span>المستخدمون</span>
            </Link>
          )}
          <Link
            href="/dashboard/developer"
            className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <Wrench className="w-4 h-4" />
            <span>المطور</span>
          </Link>
        </nav>
      </header>

      <aside className="hidden md:fixed md:right-0 md:top-0 md:w-64 md:h-screen md:bg-slate-800 md:border-l md:border-slate-700 md:p-6 md:flex md:flex-col">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <BarChart3 className="w-8 h-8 text-blue-500" />
          <h1 className="text-xl font-bold text-white">شجرة العائلة</h1>
        </Link>

        <nav className="flex-1 space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <Home className="w-5 h-5" />
            <span>نظرة عامة</span>
          </Link>
          <Link
            href="/dashboard/families"
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <Users className="w-5 h-5" />
            <span>{canManageAnyFamily ? "عائلاتي" : "العائلات"}</span>
          </Link>
          {canManageAnyFamily && (
            <Link
              href="/dashboard/members"
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              <Users className="w-5 h-5" />
              <span>الأفراد</span>
            </Link>
          )}
          {superAdmin && (
            <Link
              href="/dashboard/users"
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              <UserCog className="w-5 h-5" />
              <span>المستخدمون</span>
            </Link>
          )}
          <Link
            href="/dashboard/developer"
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <Wrench className="w-5 h-5" />
            <span>المطور</span>
          </Link>
        </nav>

        <div className="border-t border-slate-700 pt-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-sm text-slate-400">الحساب</span>
            <UserButton />
          </div>
        </div>
      </aside>

      <div className="md:mr-64">
        <header className="hidden md:block bg-slate-800 border-b border-slate-700 px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">لوحة التحكم</h2>
              <EffectiveRoleBadge />
            </div>
            <div className="min-w-[320px] max-w-[520px] w-full">
              <DevRoleSwitcher />
            </div>
          </div>
        </header>

        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
