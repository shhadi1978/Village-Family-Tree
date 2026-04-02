import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">شجرة عائلات القرية</h1>
          <p className="text-slate-400">سجل الدخول لإدارة شجرة عائلتك</p>
        </div>

        <div className="bg-slate-800 rounded-lg shadow-2xl p-8 border border-slate-700">
          <SignIn
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-slate-800 shadow-none border-none",
                headerTitle: "text-white text-2xl font-bold",
                headerSubtitle: "text-slate-400",
                socialButtonsBlockButton:
                  "bg-slate-700 hover:bg-slate-600 text-white border-slate-600",
                formButtonPrimary:
                  "bg-blue-600 hover:bg-blue-700 text-white rounded-lg",
                formFieldInput:
                  "bg-slate-700 border-slate-600 text-white placeholder-slate-400 rounded-lg",
                footerActionLink: "text-blue-400 hover:text-blue-300",
                dividerLine: "bg-slate-700",
                dividerText: "text-slate-400",
              },
            }}
            fallbackRedirectUrl="/dashboard"
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
          />
        </div>

        <p className="text-center text-slate-400 mt-6 text-sm">
          ليس لديك حساب؟{" "}
          <a href="/sign-up" className="text-blue-400 hover:text-blue-300 font-medium">
            إنشاء حساب
          </a>
        </p>
      </div>
    </div>
  );
}
