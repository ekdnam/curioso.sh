import { NextRequest, NextResponse } from "next/server";
import { getStats, resetStats } from "@/lib/perfAccumulator";

export async function GET(req: NextRequest) {
  const stats = getStats();
  const reset = req.nextUrl.searchParams.get("reset") === "1";

  const body = {
    uptimeSec: Math.round(process.uptime()),
    endpoints: stats,
  };

  if (reset) {
    resetStats();
  }

  return NextResponse.json(body);
}
