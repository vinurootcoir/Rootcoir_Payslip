/** Technical error text is returned only in development. Other environments get nothing to render. */
export function technicalErrorText(
  nodeEnv: string | undefined,
  error: { name?: string; message?: string; stack?: string; digest?: string },
): string | null {
  if (nodeEnv !== "development") return null;
  const name = error.name && error.name.trim() !== "" ? error.name : "Error";
  const message = error.message && error.message.trim() !== "" ? error.message : "Unknown error";
  const digest = error.digest ? `\nDigest: ${error.digest}` : "";
  const stack = error.stack ? `\n\n${error.stack}` : "";
  return `${name}: ${message}${digest}${stack}`;
}
