import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { getEnv } from "@/lib/env";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { getCurrentUser } from "@/server/auth/session";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  try {
    if (await getCurrentUser()) redirect("/");
  } catch (error) {
    if (!(error instanceof Error) || !error.name.startsWith("Prisma")) throw error;
  }

  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token.trim() : "";
  const csrf = await csrfTokenFromRequest();
  const siteKey = getEnv().recaptcha?.siteKey ?? null;

  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-10">
      <section className="w-full max-w-md rounded-[10px] border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
        <div className="mb-6 flex justify-center rounded-[10px] bg-logo-plate px-4 py-3">
          <Image src="/rootcoir.png" alt="Root Coir" width={1600} height={364} priority className="h-auto w-[220px]" />
        </div>
        <h1 className="text-[21px] font-bold tracking-[-0.02em] text-heading">Choose a new password</h1>
        <p className="mt-1 mb-5 text-[13.5px] text-muted">Use 6 to 128 characters.</p>
        {token.length >= 32 ? (
          <ResetPasswordForm csrf={csrf} token={token} siteKey={siteKey} />
        ) : (
          <div className="flex flex-col gap-4">
            <p role="alert" className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">
              This reset link is invalid or incomplete.
            </p>
            <p className="text-center text-[12.5px] text-muted">
              <Link href="/forgot-password" className="font-medium text-accent hover:text-accent-hover">
                Request a new link
              </Link>
            </p>
          </div>
        )}
      </section>
    </main>
  );
}