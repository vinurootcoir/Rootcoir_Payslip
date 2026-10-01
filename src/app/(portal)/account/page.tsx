import { PasswordForm } from "@/components/password-form";
import { requireUser } from "@/server/auth/guard";
import { csrfTokenFromRequest } from "@/server/auth/request";

export default async function AccountPage() {
  const current = await requireUser();
  const csrf = await csrfTokenFromRequest();

  return (
    <section className="max-w-xl rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <h1 className="text-[21px] font-bold tracking-[-0.02em]">Account</h1>
      <p className="mt-2 mb-5 text-[13.5px] text-muted">
        Changing the password signs you out on every device. Signed in as {current.email}.
      </p>
      <PasswordForm csrf={csrf} />
    </section>
  );
}
