import { NextResponse } from "next/server";
import {
  buildImportIntegrationReport,
  formatImportIntegrationReport,
} from "@/lib/sync/providers/integration-report";

/** Plain-text integration report for Phase 1 import providers. */
export async function GET() {
  const report = await buildImportIntegrationReport();
  const body = formatImportIntegrationReport(report);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'inline; filename="zorino-import-report.txt"',
    },
  });
}
