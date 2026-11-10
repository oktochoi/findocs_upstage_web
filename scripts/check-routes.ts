import assert from "node:assert/strict";
import { GET } from "../app/api/analyze/[jobId]/route";
import { POST } from "../app/api/analyze/route";
import { GET as getConfig } from "../app/api/config/route";

const ENV_NAMES = [
  "UPSTAGE_API_KEY",
  "UPSTAGE_AGENT_ID",
  "UPSTAGE_CONFIG_ID",
  "UPSTAGE_PROJECT_ID",
  "UPSTAGE_BASE_URL",
] as const;
const FAKE_KEY = "test-key-not-real";

type Recorded = {
  url: string;
  method: string;
  authorization: string | null;
  projectId: string | null;
  contentType: string | null;
  json: unknown;
  purpose: FormDataEntryValue | null;
};

const recorded: Recorded[] = [];
let responses: Array<{ status: number; body: unknown }> = [];

function installFetch() {
  global.fetch = async (input, init) => {
    const body = init?.body;
    const headers = new Headers(init?.headers);
    let json: unknown = null;
    if (typeof body === "string") json = JSON.parse(body) as unknown;
    recorded.push({
      url: String(input),
      method: init?.method ?? "GET",
      authorization: headers.get("authorization"),
      projectId: headers.get("x-project-id"),
      contentType: headers.get("content-type"),
      json,
      purpose: body instanceof FormData ? body.get("purpose") : null,
    });
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { "content-type": "application/json" },
    });
  };
}

function pdfFile(name = "demo.pdf", bytes = "%PDF-1.4\ntrailer\n%%EOF") {
  return new File([bytes], name, { type: "application/pdf" });
}

async function postFile(file: File) {
  const body = new FormData();
  body.set("file", file);
  return POST(new Request("http://localhost/api/analyze", { method: "POST", body }));
}

function clearEnv() {
  for (const name of ENV_NAMES) delete process.env[name];
}

function setEnv() {
  process.env.UPSTAGE_API_KEY = FAKE_KEY;
  process.env.UPSTAGE_AGENT_ID = "agt_test";
  process.env.UPSTAGE_CONFIG_ID = "3";
  process.env.UPSTAGE_PROJECT_ID = "proj_test";
  process.env.UPSTAGE_BASE_URL = "https://api.upstage.ai/v2";
}

async function read(response: Response) {
  return {
    status: response.status,
    cache: response.headers.get("cache-control"),
    text: await response.text(),
  };
}

installFetch();

async function main() {
clearEnv();

const missingConfig = await read(await getConfig(new Request("http://localhost/api/config")));
assert.equal(missingConfig.status, 200);
assert.match(missingConfig.cache ?? "", /no-store/);
const missingBody = JSON.parse(missingConfig.text) as { configured: boolean; missing: string[] };
assert.equal(missingBody.configured, false);
assert.deepEqual(missingBody.missing, [...ENV_NAMES]);
assert.equal(missingConfig.text.includes(FAKE_KEY), false);

const textFile = new File(["hello"], "memo.txt", { type: "text/plain" });
const notPdf = await read(await postFile(textFile));
assert.equal(notPdf.status, 400);
assert.match(notPdf.text, /PDF 파일을 선택해주세요/);
assert.equal(recorded.length, 0);

const brokenPdf = pdfFile("broken.pdf", "not a pdf");
const unreadable = await read(await postFile(brokenPdf));
assert.equal(unreadable.status, 400);
assert.match(unreadable.text, /이 PDF를 열 수 없어요/);
assert.equal(recorded.length, 0);

const huge = new File([new Uint8Array(21 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });
const tooBig = await read(await postFile(huge));
assert.equal(tooBig.status, 413);
assert.match(tooBig.text, /20MB/);
assert.equal(recorded.length, 0);

const missingStart = await read(await postFile(pdfFile()));
assert.equal(missingStart.status, 503);
assert.match(missingStart.text, /UPSTAGE_API_KEY/);
assert.equal(missingStart.text.includes("risk_grade"), false);
assert.equal(recorded.length, 0);

setEnv();
const readyConfig = await read(await getConfig(new Request("http://localhost/api/config")));
assert.equal(JSON.parse(readyConfig.text).configured, true);
assert.equal(readyConfig.text.includes(FAKE_KEY), false);

responses = [{ status: 500, body: { error: { message: "upload exploded" } } }];
const uploadFailed = await read(await postFile(pdfFile()));
assert.equal(uploadFailed.status, 502);
assert.match(uploadFailed.text, /UPLOAD_FAILED/);
assert.match(uploadFailed.text, /파일을 업로드하지 못했어요/);
assert.equal(uploadFailed.text.includes("분석을 시작하지 못했어요"), false);
assert.equal(uploadFailed.text.includes(FAKE_KEY), false);
assert.equal(recorded.length, 1);
assert.match(recorded[0].url, /\/files$/);
assert.equal(recorded[0].purpose, "user_data");
assert.equal(recorded[0].authorization, `Bearer ${FAKE_KEY}`);
assert.equal(recorded[0].projectId, "proj_test");
assert.equal(recorded[0].contentType, null);

recorded.length = 0;
responses = [
  { status: 200, body: { id: "file-123", object: "file" } },
  { status: 400, body: { error: { message: "bad agent" } } },
];
const startFailed = await read(await postFile(pdfFile()));
assert.equal(startFailed.status, 502);
assert.match(startFailed.text, /ANALYSIS_START_FAILED/);
assert.match(startFailed.text, /분석을 시작하지 못했어요/);
assert.equal(startFailed.text.includes("파일을 업로드하지 못했어요"), false);
assert.equal(recorded.length, 2);
assert.match(recorded[1].url, /\/responses$/);
const startBody = recorded[1].json as {
  model: string;
  config_id: string;
  input: Array<{ content: Array<{ file_id: string }> }>;
};
assert.equal(startBody.model, "agt_test");
assert.equal(startBody.config_id, "3");
assert.equal("include" in (recorded[1].json as object), false);
assert.equal(startBody.input[0].content[0].file_id, "file-123");
assert.equal(recorded[1].projectId, "proj_test");
assert.equal(recorded[1].contentType, "application/json");
assert.equal(recorded[1].authorization, `Bearer ${FAKE_KEY}`);

recorded.length = 0;
responses = [
  { status: 200, body: { id: "file-123" } },
  { status: 200, body: { id: "job_abc", status: "queued" } },
];
const started = await read(await postFile(pdfFile()));
assert.equal(started.status, 202);
assert.deepEqual(JSON.parse(started.text), { jobId: "job_abc", status: "queued" });
assert.match(started.cache ?? "", /no-store/);

recorded.length = 0;
responses = [
  { status: 200, body: { id: "file-123" } },
  { status: 200, body: { job_id: "job_other", status: "queued" } },
];
const unknownId = await read(await postFile(pdfFile()));
assert.equal(unknownId.status, 502);
assert.match(unknownId.text, /ANALYSIS_START_FAILED/);
assert.equal(unknownId.text.includes("job_other"), false);

const judgment = [
  "risk_grade: 매우 높음",
  "needs_review: 예",
  "action: 전송 전에 보이는 계좌번호를 가려 주세요.",
  "sensitive_items: 계좌번호, 성명",
  "locations: 1쪽 「계좌번호」: 계좌번호(전부 보임)",
  "reason: 계좌번호가 전부 보입니다.",
  "review_reason: 가림 여부를 다시 봐야 합니다.",
  "applied_rule: R3",
].join("\n");

async function getJob(body: unknown, status = 200) {
  recorded.length = 0;
  responses = [{ status, body }];
  return read(
    await GET(new Request("http://localhost/api/analyze/job_abc"), {
      params: Promise.resolve({ jobId: "job_abc" }),
    }),
  );
}

const queued = await getJob({ id: "job_abc", status: "queued", error: null, output: [] });
assert.equal(queued.status, 200);
assert.deepEqual(JSON.parse(queued.text), { jobId: "job_abc", status: "queued" });
assert.match(queued.cache ?? "", /no-store/);
assert.match(recorded[0].url, /include(?:%5B%5D|\[\])=all/);
assert.equal(recorded[0].projectId, "proj_test");
assert.equal(recorded[0].authorization, `Bearer ${FAKE_KEY}`);

const running = await getJob({ id: "job_abc", status: "in_progress", error: null });
assert.deepEqual(JSON.parse(running.text), { jobId: "job_abc", status: "in_progress" });

const completed = await getJob({
  id: "job_abc",
  status: "completed",
  error: null,
  output: [
    { model: "위험도_판정", content: [{ type: "output_text", text: judgment }] },
    { model: "판정_검사", content: [{ type: "output_text", text: "verdict: green" }] },
  ],
});
assert.equal(completed.status, 200);
const completedBody = JSON.parse(completed.text) as {
  status: string;
  result: { risk_grade: string; needs_review: boolean; sensitive_items: string[]; applied_rule: string };
};
assert.equal(completedBody.status, "completed");
assert.equal(completedBody.result.risk_grade, "매우 높음");
assert.equal(completedBody.result.needs_review, true);
assert.deepEqual(completedBody.result.sensitive_items, ["계좌번호", "성명"]);
assert.equal(completedBody.result.applied_rule, "R3");
assert.equal(completed.text.includes("green"), false);

const invalid = await getJob({
  id: "job_abc",
  status: "completed",
  error: null,
  output: [{ model: "위험도_판정", content: [{ text: "risk_grade: 높음" }] }],
});
const invalidBody = JSON.parse(invalid.text) as { status: string; result?: unknown; error: { code: string } };
assert.equal(invalidBody.status, "failed");
assert.equal(invalidBody.error.code, "INVALID_RESULT");
assert.equal(invalidBody.result, undefined);
assert.equal(invalid.text.includes("없음"), false);

const rejected = await getJob({
  id: "job_abc",
  status: "completed",
  error: null,
  output: [
    { model: "위험도_판정", content: [{ text: judgment }] },
    { model: "판정_검사", content: [{ text: "verdict: red" }] },
  ],
});
const rejectedBody = JSON.parse(rejected.text) as { status: string; error: { code: string } };
assert.equal(rejectedBody.status, "failed");
assert.equal(rejectedBody.error.code, "VALIDATION_FAILED");
assert.equal(rejected.text.includes("매우 높음"), false);

const failed = await getJob({ id: "job_abc", status: "failed", error: { message: "upstream" } });
assert.equal(JSON.parse(failed.text).error.code, "ANALYSIS_FAILED");
assert.equal(failed.text.includes("upstream"), false);

const temporary = await getJob({ error: { message: "try later" } }, 503);
assert.equal(temporary.status, 503);
assert.equal(JSON.parse(temporary.text).error.code, "STATUS_UNAVAILABLE");
assert.equal(temporary.text.includes(FAKE_KEY), false);

console.log("route checks passed");
}

void main();
