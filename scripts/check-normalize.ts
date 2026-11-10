import assert from "node:assert/strict";
import { normalizeWorkflowOutput } from "../lib/normalize-result";
import { mapUpstageStatus } from "../lib/upstage";
import { parseJobView } from "../lib/validate-result";

const judgment = [
  "risk_grade: \"매우 높음\"",
  "needs_review: 예",
  "action: 전송 전에 계좌번호가 보이는 부분을 가리거나 삭제하세요.",
  "sensitive_items: 계좌번호, 성명",
  "locations: 1쪽 「계좌번호」: 계좌번호(전부 보임)",
  "2쪽 「성명」: 성명(일부 보임)",
  "reason: 계좌번호가 전부 보입니다.【1】",
  "review_reason: 일부 항목은 가림 여부를 다시 확인해야 합니다.",
  "applied_rule: R3",
].join("\n");

const parsed = normalizeWorkflowOutput({
  output: [
    {
      type: "message",
      model: "step_1_parse",
      content: [{ type: "output_text", text: "{\"html\":\"문서\"}" }],
    },
    {
      type: "message",
      model: "위험도_판정",
      content: [{ type: "output_text", text: judgment }],
    },
    {
      type: "message",
      model: "판정_검사",
      content: [{ type: "output_text", text: "verdict: green" }],
    },
  ],
});

assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.result.risk_grade, "매우 높음");
  assert.equal(parsed.result.needs_review, true);
  assert.deepEqual(parsed.result.sensitive_items, ["계좌번호", "성명"]);
  assert.equal(parsed.result.locations.length, 2);
  assert.equal(parsed.result.reason, "계좌번호가 전부 보입니다.");
  assert.equal(parsed.result.applied_rule, "R3");
  assert.equal(parsed.result.action.includes("가리거나 삭제"), true);
}

const noReview = normalizeWorkflowOutput({
  output_text: [
    "risk_grade: 없음",
    "needs_review: 아니오",
    "action: 추가 가림 없이 전송 전 내용을 한 번 더 확인하세요.",
    "sensitive_items:",
    "locations:",
    "reason: 민감정보로 볼 항목이 없습니다.",
    "review_reason:",
    "applied_rule: R0",
  ].join("\n"),
});
assert.equal(noReview.ok, true);
if (noReview.ok) {
  assert.equal(noReview.result.needs_review, false);
  assert.deepEqual(noReview.result.sensitive_items, []);
  assert.equal(noReview.result.risk_grade, "없음");
}

const jsonText = normalizeWorkflowOutput({
  output: [
    {
      model: "step_2_extract",
      content: [
        {
          type: "output_text",
          text: JSON.stringify({
            risk_grade: "높음",
            needs_review: false,
            action: "전송 전에 계좌 표기를 확인하세요.",
            sensitive_items: ["계좌번호"],
            locations: ["1쪽 「계좌번호」: 계좌번호(일부 보임)"],
            reason: "계좌번호가 일부 보입니다.",
            review_reason: "",
            applied_rule: "R2",
          }),
        },
      ],
    },
  ],
});
assert.equal(jsonText.ok, true);
if (jsonText.ok) assert.equal(jsonText.result.risk_grade, "높음");

const prefersNamed = normalizeWorkflowOutput({
  output: [
    {
      model: "step_2_extract",
      content: [
        {
          text: [
            "risk_grade: 보통",
            "needs_review: 아니오",
            "action: 다른 단계",
            "sensitive_items: 전화번호",
            "locations: 1쪽 「전화번호」: 전화번호(일부 보임)",
            "reason: 다른 단계",
            "review_reason:",
            "applied_rule: R1",
          ].join("\n"),
        },
      ],
    },
    {
      model: "step_3",
      content: [
        { text: '{"name":"위험도_판정"}' },
        {
          text: [
            "risk_grade: 매우 높음",
            "needs_review: 예",
            "action: 이름 있는 단계",
            "sensitive_items: 주민등록번호",
            "locations: 1쪽 「주민등록번호」: 주민등록번호(전부 보임)",
            "reason: 이름 있는 단계",
            "review_reason: 가림이 확인되지 않습니다.",
            "applied_rule: R3",
          ].join("\n"),
        },
      ],
    },
  ],
});
assert.equal(prefersNamed.ok, true);
if (prefersNamed.ok) {
  assert.equal(prefersNamed.result.action, "이름 있는 단계");
  assert.equal(prefersNamed.result.risk_grade, "매우 높음");
}

const validationFailed = normalizeWorkflowOutput({
  output: [
    { model: "위험도_판정", content: [{ text: judgment }] },
    { model: "판정_검사", content: [{ text: '{"color":"red","rules":[{"required":true,"passed":false}]}' }] },
  ],
});
assert.equal(validationFailed.ok, false);
if (!validationFailed.ok) {
  assert.equal(validationFailed.code, "VALIDATION_FAILED");
  assert.equal("result" in validationFailed, false);
  assert.equal(validationFailed.message.includes("없음"), false);
}

const redIsNotGrade = normalizeWorkflowOutput({
  output: [{ model: "판정_검사", content: [{ text: "red" }] }],
});
assert.equal(redIsNotGrade.ok, false);
if (!redIsNotGrade.ok) assert.equal(redIsNotGrade.code, "VALIDATION_FAILED");

const missing = normalizeWorkflowOutput({
  output: [
    {
      model: "위험도_판정",
      content: [{ text: "risk_grade: 높음\nneeds_review: 예\naction: 조치" }],
    },
  ],
});
assert.equal(missing.ok, false);
if (!missing.ok) {
  assert.equal(missing.code, "INVALID_RESULT");
  assert.equal(JSON.stringify(missing).includes("없음"), false);
}

const unreadableReview = normalizeWorkflowOutput({
  output: [
    {
      model: "위험도_판정",
      content: [
        {
          text: [
            "risk_grade: 보통",
            "needs_review: 모름",
            "action: 조치",
            "sensitive_items: 성명",
            "locations: 1쪽 「성명」: 성명(일부 보임)",
            "reason: 근거",
            "review_reason:",
            "applied_rule: R4",
          ].join("\n"),
        },
      ],
    },
  ],
});
assert.equal(unreadableReview.ok, false);

const fromOutputText = normalizeWorkflowOutput({
  output: [{ model: "step_1_parse", content: [{ text: "{\"html\":\"문서\"}" }] }],
  output_text: JSON.stringify({
    risk_grade: "높음",
    needs_review: false,
    action: "전송 전에 계좌번호를 확인하세요.",
    sensitive_items: ["계좌번호"],
    locations: ["1쪽 「계좌번호」: 계좌번호(일부 보임)"],
    reason: "계좌번호가 일부 보입니다.",
    review_reason: "",
    applied_rule: "R2",
  }),
});
assert.equal(fromOutputText.ok, true);
if (fromOutputText.ok) assert.equal(fromOutputText.result.risk_grade, "높음");

assert.equal(mapUpstageStatus("queued", null), "queued");
assert.equal(mapUpstageStatus("in_progress", null), "in_progress");
assert.equal(mapUpstageStatus("completed", null), "completed");
assert.equal(mapUpstageStatus("completed", { message: "boom" }), "failed");
assert.equal(mapUpstageStatus("failed", null), "failed");
assert.equal(mapUpstageStatus("cancelled", null), "failed");
assert.equal(mapUpstageStatus("mystery", null), "in_progress");

const progress = parseJobView({ jobId: "job_1", status: "in_progress" });
assert.deepEqual(progress, { status: "active", stage: "in_progress" });
const queued = parseJobView({ jobId: "job_1", status: "queued" });
assert.deepEqual(queued, { status: "active", stage: "queued" });
const invalidCompleted = parseJobView({ status: "completed", result: { risk_grade: "없음" } });
assert.equal(invalidCompleted, null);

console.log("normalize checks passed");
