"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { BarChart3, Users, MapPin, ArrowRight, LogIn } from "lucide-react";

export default function HomePage() {
  const { isSignedIn } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-blue-500" />
            <h1 className="text-lg md:text-2xl font-bold text-white">شجرة عائلات القرية</h1>
          </Link>

          <div className="flex items-center gap-2 md:gap-4 text-sm md:text-base">
            {isSignedIn ? (
              <Link
                href="/dashboard"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
              >
                لوحة التحكم
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="px-3 md:px-6 py-2 text-slate-300 hover:text-white transition font-medium flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  تسجيل الدخول
                </Link>
                <Link
                  href="/sign-up"
                  className="px-3 md:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                >
                  إنشاء حساب
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-20 text-center">
        <h2 className="text-3xl md:text-6xl font-bold text-white mb-6">
          احفظ إرث عائلتك للأجيال القادمة
        </h2>
        <p className="text-base md:text-xl text-slate-400 mb-8 max-w-3xl mx-auto">
          وثّق أنساب عائلات القرية بشكل مرئي وتفاعلي. اربط الأجيال، واحفظ القصص،
          وابقِ الروابط العائلية حيّة عبر نظام شجرة عائلة متكامل.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          {isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium flex items-center gap-2"
              >
                الذهاب إلى لوحة التحكم
                <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-up"
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium flex items-center gap-2"
              >
                ابدأ الآن
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/sign-in"
                className="px-8 py-3 border border-slate-600 text-white hover:bg-slate-700 rounded-lg transition font-medium"
              >
                تسجيل الدخول
              </Link>
            </>
          )}
        </div>

        {/* Hero Image/Placeholder */}
        <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-12 backdrop-blur-sm">
          <div className="text-slate-400 py-20">
            <BarChart3 className="w-24 h-24 mx-auto mb-4 opacity-50" />
            <p>معاينة مرئية لشجرة العائلة</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-14 md:py-20">
        <h3 className="text-4xl font-bold text-white mb-12 text-center">
          المزايا الرئيسية
        </h3>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 hover:border-blue-600 transition">
            <Users className="w-12 h-12 text-blue-500 mb-4" />
            <h4 className="text-xl font-semibold text-white mb-2">
              إدارة العائلات
            </h4>
            <p className="text-slate-400">
              نظّم عائلات القرية في مكان واحد، وتابع الأفراد عبر الأجيال بسهولة.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 hover:border-purple-600 transition">
            <BarChart3 className="w-12 h-12 text-purple-500 mb-4" />
            <h4 className="text-xl font-semibold text-white mb-2">
              شجرة تفاعلية
            </h4>
            <p className="text-slate-400">
              استعرض العلاقات العائلية بشكل تفاعلي مع التكبير والتحريك بسهولة.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 hover:border-green-600 transition">
            <MapPin className="w-12 h-12 text-green-500 mb-4" />
            <h4 className="text-xl font-semibold text-white mb-2">
              روابط بين العائلات
            </h4>
            <p className="text-slate-400">
              دعم المصاهرة والعلاقات بين عائلات مختلفة مع معالجة الأنساب المعقدة.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-14 md:py-20 bg-slate-800 rounded-2xl border border-slate-700">
        <h3 className="text-4xl font-bold text-white mb-12 text-center">
          كيف يعمل النظام
        </h3>

        <div className="space-y-8">
          {/* Step 1 */}
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-600">
                <span className="text-white font-bold">1</span>
              </div>
            </div>
            <div>
              <h4 className="text-xl font-semibold text-white">أنشئ حساباً</h4>
              <p className="text-slate-400">
                سجل دخولك عبر Clerk باستخدام البريد الإلكتروني أو حسابات التواصل.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-600">
                <span className="text-white font-bold">2</span>
              </div>
            </div>
            <div>
              <h4 className="text-xl font-semibold text-white">أضف العائلات</h4>
              <p className="text-slate-400">
                أنشئ عائلات جديدة وعيّن مشرفين لإدارة البيانات.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-600">
                <span className="text-white font-bold">3</span>
              </div>
            </div>
            <div>
              <h4 className="text-xl font-semibold text-white">
                أضف الأفراد
              </h4>
              <p className="text-slate-400">
                أضف بيانات أفراد العائلة مع الصور والتواريخ والسيرة.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-600">
                <span className="text-white font-bold">4</span>
              </div>
            </div>
            <div>
              <h4 className="text-xl font-semibold text-white">
                اربط العلاقات
              </h4>
              <p className="text-slate-400">
                حدّد علاقات الأبوة والزواج بين الأفراد داخل نفس القرية.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-600">
                <span className="text-white font-bold">5</span>
              </div>
            </div>
            <div>
              <h4 className="text-xl font-semibold text-white">
                استعرض الشجرة
              </h4>
              <p className="text-slate-400">
                اعرض شجرة العائلة تفاعلياً بعمق يصل إلى 5 مستويات.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-14 md:py-20">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 md:p-12 text-center">
          <h3 className="text-4xl font-bold text-white mb-4">
            جاهز لتوثيق تاريخ عائلتك؟
          </h3>
          <p className="text-blue-100 mb-8 text-lg">
            ابدأ اليوم في بناء شجرة عائلات القرية. البداية مجانية.
          </p>

          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="inline-block px-8 py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-slate-100 transition"
            >
              فتح لوحة التحكم
            </Link>
          ) : (
            <Link
              href="/sign-up"
              className="inline-block px-8 py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-slate-100 transition"
            >
              أنشئ حسابك الآن
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-700 py-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold text-white mb-4">عن المشروع</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition">
                    الرؤية
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    المزايا
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    الخطط
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">المنتج</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition">
                    التوثيق
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    API
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    الدعم
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">القانونية</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition">
                    الخصوصية
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    الشروط
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    سياسة ملفات الارتباط
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">المجتمع</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition">
                    GitHub
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Discord
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    إكس
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-8 text-center text-slate-400">
            <p>© 2026 شجرة عائلات القرية. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
