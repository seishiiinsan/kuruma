// Client error reports (lib/report-error.ts), written to the runtime logs:
// on Vercel, Observability > Logs, filter on "client-error".
export async function POST(request: Request) {
  const text = (await request.text()).slice(0, 8000);
  let report: Record<string, unknown> = {};
  try {
    report = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  console.error(
    JSON.stringify({
      type: "client-error",
      source: String(report.source ?? "unknown").slice(0, 40),
      message: String(report.message ?? "").slice(0, 500),
      digest: report.digest ? String(report.digest).slice(0, 100) : undefined,
      path: String(report.path ?? "").slice(0, 300),
      stack: report.stack ? String(report.stack).slice(0, 2000) : undefined,
      userAgent: String(report.userAgent ?? "").slice(0, 300),
    }),
  );
  return new Response(null, { status: 204 });
}
