import { messages } from "@/lib/messages";
import { normalizeWorkflowOutput } from "@/lib/normalize-result";
import { mapUpstageStatus, readUpstageJobStatus, retrieveJob, UpstageError } from "@/lib/upstage";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request, context: RouteContext) {
  request.headers.get("cache-control");
  const { jobId } = await context.params;
  if (!/^[\w-]{1,128}$/.test(jobId)) {
    return json({ error: { code: "job_not_found", message: messages.jobNotFound } }, 404);
  }

  try {
    const job = await retrieveJob(jobId);
    const current = readUpstageJobStatus(job);
    if (!current) {
      return json({ error: { code: "STATUS_UNAVAILABLE", message: messages.statusUnavailable } }, 503);
    }

    const status = mapUpstageStatus(current.status, current.error);
    if (status === "queued" || status === "in_progress") {
      return json({ jobId, status });
    }
    if (status === "failed") {
      return json({
        jobId,
        status: "failed",
        error: { code: "ANALYSIS_FAILED", message: messages.analysisFailed },
      });
    }

    const normalized = normalizeWorkflowOutput(job);
    if (!normalized.ok) {
      return json({
        jobId,
        status: "failed",
        error: { code: normalized.code, message: normalized.message },
      });
    }
    return json({
      jobId,
      status: "completed",
      result: normalized.result,
      validation: normalized.validation,
    });
  } catch (error) {
    if (error instanceof UpstageError) {
      const code = error.code === "JOB_NOT_FOUND" ? "job_not_found" : error.code;
      return json({ error: { code, message: error.message } }, error.status);
    }
    return json({ error: { code: "STATUS_UNAVAILABLE", message: messages.statusUnavailable } }, 503);
  }
}
