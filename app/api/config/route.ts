import { isAnalysisConfigured, missingUpstageEnv } from "@/lib/upstage";

export async function GET(request: Request) {
  request.headers.get("cache-control");
  return Response.json(
    { configured: isAnalysisConfigured(), missing: missingUpstageEnv() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
