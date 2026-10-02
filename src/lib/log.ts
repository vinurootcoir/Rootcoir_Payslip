/** Logs a failure name only. Error messages can contain payroll data or connection strings. */
export function logFailure(scope: string, error: unknown): void {
  const name = error instanceof Error ? error.name : "error";
  console.error(JSON.stringify({ scope, error: name }));
}
