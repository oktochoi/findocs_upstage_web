import type { RiskGrade } from "@/lib/types";

export const riskStyles: Record<RiskGrade, { box: string; text: string; bar: string }> = {
  "매우 높음": { box: "border-[#FECACA] bg-[#FEF2F2]", text: "text-[#9F1239]", bar: "bg-[#9F1239]" },
  높음: { box: "border-[#FED7AA] bg-[#FFF7ED]", text: "text-[#9A3412]", bar: "bg-[#9A3412]" },
  보통: { box: "border-[#FDE68A] bg-[#FFFBEB]", text: "text-[#92400E]", bar: "bg-[#92400E]" },
  없음: { box: "border-[#BBF7D0] bg-[#F0FDF4]", text: "text-[#166534]", bar: "bg-[#166534]" },
};

export const reviewBadgeStyles = {
  needed: "border-[#C7D2FE] bg-[#EEF2FF] text-[#3730A3]",
  clear: "border-line bg-[#F8FAFC] text-[#475569]",
};
