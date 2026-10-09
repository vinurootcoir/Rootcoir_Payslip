import Image from "next/image";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { getEnv } from "@/lib/env";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { getCurrentUser } from "@/server/auth/session";

export default async function ForgotPasswordPage() {
  try {
    if (await getCurrentUser()) redirect("/");
  } catch (error) {
    if (!(error instanceof Error) || !error.name.startsWith("Prisma")) throw error;
  }

  const csrf = await csrfTokenFromRequest();
  const siteKey = getEnv().recaptcha?.siteKey ?? null;

  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-10">
      <section className="w-full max-w-md rounded-[10px] border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
        <div className="mb-6 flex justify-center rounded-[10px] bg-logo-plate px-4 py-3">
          <Image src="/rootcoir.png" alt="Root Coir" width={1600} height={364} priority className="h-auto w-[220px]" />
        </div>
        <h1 className="text-[21px] font-bold tracking-[-0.02em] text-heading">Forgot password</h1>
        <p className="mt-1 mb-5 text-[13.5px] text-muted">
          Enter your work email and we will send a reset link if an account exists.
        </p>
        <ForgotPasswordForm csrf={csrf} siteKey={siteKey} />
      </section>
    </main>
  );
}
