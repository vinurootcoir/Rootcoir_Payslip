import Link from "next/link";
import { requireRole } from "@/server/auth/guard";
import { listAuditLogs } from "@/server/audit/queries";
import { auditSummary } from "@/server/access/policy";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireRole(["SUPER_ADMIN"]);
  const params = await searchParams;
  const requested = Number(params.page);
  const result = await listAuditLogs(requested);
  const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

  return (
    <section className="rounded-[10px] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="px-4 py-4">
        <h1 className="text-[21px] font-bold tracking-[-0.02em]">Audit log</h1>
        <p className="text-[12.5px] text-muted">{result.total} events. Salary amounts and passwords are not shown.</p>
      </div>
      {result.rows.length === 0 ? (
        <p className="border-t border-border-soft px-4 py-10 text-[13.5px] text-muted">No audit events yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-y border-border-soft bg-surface-2 text-[11.5px] font-semibold text-heading">
                <th className="px-4 py-2 font-semibold">When</th>
                <th className="px-4 py-2 font-semibold">Actor</th>
                <th className="px-4 py-2 font-semibold">Action</th>
                <th className="px-4 py-2 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} className="border-b border-border-soft">
                  <td className="px-4 py-3 font-mono text-[12px] text-muted">{when.format(row.createdAt)} UTC</td>
                  <td className="px-4 py-3 text-[13px] text-text">{row.actor?.email ?? "Removed account"}</td>
                  <td className="px-4 py-3 text-[13px] text-text">{row.action}</td>
                  <td className="px-4 py-3 text-[12.5px] text-muted">{auditSummary(row.metadata) ?? row.targetType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result.pageCount > 1 ? (
        <div className="flex items-center gap-3 px-4 py-3 text-[13px]">
          {result.page > 1 ? <Link className="text-accent" href={`/settings/audit?page=${result.page - 1}`}>Previous</Link> : <span className="text-faint">Previous</span>}
          <span className="text-muted">Page {result.page} of {result.pageCount}</span>
          {result.page < result.pageCount ? <Link className="text-accent" href={`/settings/audit?page=${result.page + 1}`}>Next</Link> : <span className="text-faint">Next</span>}
        </div>
      ) : null}
    </section>
  );
}
