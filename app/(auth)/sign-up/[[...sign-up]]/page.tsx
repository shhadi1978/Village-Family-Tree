"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useSignUp } from "@clerk/nextjs";

type ClerkErrorItem = {
  code?: string;
  message?: string;
  longMessage?: string;
};

function getClerkErrors(error: unknown): ClerkErrorItem[] {
  if (!error || typeof error !== "object") return [];
  const maybeErrors = (error as { errors?: unknown }).errors;
  return Array.isArray(maybeErrors) ? (maybeErrors as ClerkErrorItem[]) : [];
}

function extractClerkErrorMessage(error: unknown, fallback: string): string {
  const errors = getClerkErrors(error);
  if (errors.length === 0) return fallback;
  return errors[0].longMessage || errors[0].message || fallback;
}

function isAlreadyVerifiedError(error: unknown): boolean {
  const errors = getClerkErrors(error);
  return errors.some(
    (e) =>
      e.code === "verification_already_verified" ||
      (e.message ?? "").toLowerCase().includes("already been verified")
  );
}

function isCaptchaError(error: unknown): boolean {
  const errors = getClerkErrors(error);
  // Clerk returns these codes when Turnstile token is missing or invalid
  const captchaCodes = ["captcha_invalid", "captcha_not_enabled", "bot_signup_protection", "bot_detection"];
  return errors.some(
    (e) =>
      captchaCodes.includes(e.code ?? "") ||
      (e.message ?? "").toLowerCase().includes("captcha") ||
      (e.message ?? "").toLowerCase().includes("bot")
  );
}

const CAPTCHA_FIX_MESSAGE =
  "فشل التحقق الأمني (Turnstile). " +
  "لإصلاحه: Clerk Dashboard → Configure → Attack Protection → Bot sign-up protection → Off.";

export default function SignUpPage() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [captchaBlocked, setCaptchaBlocked] = useState(false);

  const submitText = useMemo(() => {
    if (isSubmitting) {
      return pendingVerification ? "جار التحقق..." : "جار إنشاء الحساب...";
    }

    return pendingVerification ? "تأكيد البريد" : "إنشاء الحساب";
  }, [isSubmitting, pendingVerification]);

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!isLoaded || !signUp) {
      return;
    }

    try {
      setIsSubmitting(true);
      await signUp.create({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        emailAddress: emailAddress.trim(),
        password,
      });

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setPendingVerification(true);
    } catch (error) {
      if (isCaptchaError(error)) {
        setCaptchaBlocked(true);
        setErrorMessage(CAPTCHA_FIX_MESSAGE);
      } else {
        setErrorMessage(
          extractClerkErrorMessage(error, "تعذر إنشاء الحساب. تأكد من إعدادات التسجيل في Clerk.")
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeSession = async (sessionId: string | null | undefined) => {
    if (!sessionId) {
      setErrorMessage("لم يتم إنشاء الجلسة. حاول التسجيل مرة أخرى.");
      return;
    }
    if (!setActive) {
      setErrorMessage("تعذر تفعيل الجلسة حاليا. أعد تحميل الصفحة ثم حاول مرة أخرى.");
      return;
    }
    await setActive({ session: sessionId });
    router.push("/dashboard");
  };

  const handleVerification = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!isLoaded || !signUp) {
      return;
    }

    // If Clerk already considers this sign-up complete (e.g. user re-submitted),
    // skip re-verification and activate the existing session directly.
    if (signUp.status === "complete") {
      await completeSession(signUp.createdSessionId);
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      // Log status in dev so we can diagnose unexpected states.
      if (process.env.NODE_ENV === "development") {
        console.log("[SignUp] status:", result.status, "| missing:", result.missingFields, "| unverified:", result.unverifiedFields);
      }

      if (result.status === "complete") {
        await completeSession(result.createdSessionId);
        return;
      }

      if (result.status === "missing_requirements") {
        const missing: string[] = result.missingFields ?? [];
        const hasOnlyPhone =
          missing.length > 0 && missing.every((f) => f === "phone_number");

        if (hasOnlyPhone) {
          // Clerk instance requires phone but Israel is unsupported.
          // Instruct the admin to disable phone in Clerk Dashboard.
          setErrorMessage(
            "يتطلب إعداد Clerk رقم هاتف إضافي غير مدعوم لبلدك. " +
            "الحل: في Clerk Dashboard → Configure → Attack Protection أو Sign-up → عطّل Phone Number."
          );
        } else if (missing.length > 0) {
          setErrorMessage(`الحقول المطلوبة غير مكتملة: ${missing.join("، ")}`);
        } else {
          // Fields might be in unverifiedFields instead — session may still exist.
          await completeSession(result.createdSessionId);
        }
        return;
      }

      // Fallback for any other non-complete status.
      setErrorMessage("تعذر إكمال التحقق من البريد. حاول مرة أخرى.");
    } catch (error) {
      // Clerk says already verified → the sign-up is already done, just activate session.
      if (isAlreadyVerifiedError(error) && signUp.createdSessionId) {
        await completeSession(signUp.createdSessionId);
        return;
      }
      setErrorMessage(extractClerkErrorMessage(error, "حدث خطأ أثناء التحقق من البريد."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">شجرة عائلات القرية</h1>
          <p className="text-slate-400">
            {pendingVerification
              ? "أدخل رمز التحقق المرسل إلى بريدك الإلكتروني"
              : "أنشئ حسابا بالبريد الإلكتروني لبدء توثيق تاريخ العائلة"}
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg shadow-2xl p-8 border border-slate-700">
          <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            تم تفعيل التسجيل عبر البريد الإلكتروني فقط لتجنب مشاكل عدم دعم بعض الدول في التحقق عبر الهاتف.
          </div>

          {/* clerk-captcha must always be in DOM so Turnstile mounts immediately on page load */}
          <div id="clerk-captcha" />

          {!pendingVerification ? (
            <form className="space-y-4" onSubmit={handleSignUp}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-300">الاسم الأول</label>
                  <input
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white outline-none focus:border-blue-500"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-300">اسم العائلة</label>
                  <input
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white outline-none focus:border-blue-500"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white outline-none focus:border-blue-500"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">كلمة المرور</label>
                <input
                  type="password"
                  required
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white outline-none focus:border-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting || !isLoaded || captchaBlocked}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-800/60"
              >
                {submitText}
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleVerification}>
              <div>
                <label className="mb-1 block text-sm text-slate-300">رمز التحقق</label>
                <input
                  type="text"
                  required
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white outline-none focus:border-blue-500"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  inputMode="numeric"
                />
              </div>

              {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting || !isLoaded}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-800/60"
              >
                {submitText}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-slate-400 mt-6 text-sm">
          لديك حساب بالفعل؟{" "}
          <Link href="/sign-in" className="text-blue-400 hover:text-blue-300 font-medium">
            تسجيل الدخول
          </Link>
        </p>
      </div>
    </div>
  );
}
