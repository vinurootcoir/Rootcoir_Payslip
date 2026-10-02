import Link from "next/link";
import { requireUser } from "@/server/auth/guard";
import { getOwnProfile } from "@/server/me/queries";
import { formatDisplayDate } from "@/lib/dates";
import { StatusPill } from "@/components/status-pill";

export default async function ProfilePage() {
  const current = await requireUser();
  const profile = await getOwnProfile(current.employeeId);

  return (
    <section className="max-w-xl rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <h1 className="text-[21px] font-bold tracking-[-0.02em]">Profile</h1>
      {profile ? (
        <dl className="mt-4 grid gap-3">
          <Row label="Name" value={profile.fullName} />
          <Row label="Employee number" value={profile.employeeNumber} mono />
          <Row label="Designation" value={profile.designation} />
          <Row label="Department" value={profile.department} />
          <Row label="Date of joining" value={formatDisplayDate(profile.dateOfJoining)} mono />
          <Row label="Work email" value={profile.workEmail} />
          <div>
            <dt className="text-[12px] text-muted">Status</dt>
            <dd className="mt-1"><StatusPill status={profile.status} /></dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-[13.5px] text-muted">This login is not linked to an employee record.</p>
      )}
      <Link href="/account" className="mt-5 inline-flex text-[13.5px] font-medium text-accent">
        Change password
      </Link>
    </section>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={`text-[13.5px] text-text ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
