import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { getCurrentUser } from "@/server/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ changed?: string }>;
}) {
  try {
    if (await getCurrentUser()) redirect("/");
  } catch (error) {
    if (!(error instanceof Error) || !error.name.startsWith("Prisma")) throw error;
  }

  const csrf = await csrfTokenFromRequest();
  const params = await searchParams;

  return (
    <main className="relative flex flex-1 items-center justify-center bg-bg px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <section className="w-full max-w-md rounded-[10px] border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
        <div className="mb-6 flex justify-center rounded-[10px] bg-logo-plate px-4 py-3">
          <Image src="/rootcoir.png" alt="Root Coir" width={1600} height={364} priority className="h-auto w-[220px]" />
        </div>
        <h1 className="text-[21px] font-bold tracking-[-0.02em] text-text">Sign in</h1>
        <p className="mt-1 mb-5 text-[13.5px] text-muted">Use your work email and password.</p>
        <LoginForm csrf={csrf} passwordChanged={params.changed === "1"} />
      </section>
    </main>
  );
}
