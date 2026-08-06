import type {
  ConversationAnalysisFocus,
  ConversationLearningItemKind,
} from "@/shared/types/conversation";
import { ValidationError } from "@/shared/utils/errors";

const ANALYSIS_COMMAND_PATTERN = /^\/analysis(?:\s+([\s\S]*))?$/i;
const ANALYSIS_FOCUS_ALIASES: ReadonlyArray<
  readonly [RegExp, ConversationAnalysisFocus]
> = [
  [/^(?:grammar|语法)(?:\s+|$)/i, "grammar"],
  [/^(?:vocabulary|词汇|单词)(?:\s+|$)/i, "vocabulary"],
  [/^(?:expressions?|表达|固定表达)(?:\s+|$)/i, "expressions"],
];

export function normalizeConversationAnalysisFocus(
  value: unknown
): ConversationAnalysisFocus {
  if (value === undefined || value === null || value === "") return "all";
  if (
    value === "all" ||
    value === "grammar" ||
    value === "vocabulary" ||
    value === "expressions"
  ) {
    return value;
  }
  throw new ValidationError("analysis focus is invalid");
}

export function conversationLearningItemMatchesFocus(
  kind: ConversationLearningItemKind,
  focus: ConversationAnalysisFocus
) {
  return (
    focus === "all" ||
    (focus === "grammar" && kind === "grammar") ||
    (focus === "vocabulary" && kind === "vocabulary") ||
    (focus === "expressions" && kind === "expression")
  );
}

export function parseConversationAnalysisCommand(content: string): {
  focus: ConversationAnalysisFocus;
  instruction: string;
} | null {
  const match = content.match(ANALYSIS_COMMAND_PATTERN);
  if (!match) return null;

  let instruction = match[1]?.trim() ?? "";
  let focus: ConversationAnalysisFocus = "all";
  for (const [pattern, candidateFocus] of ANALYSIS_FOCUS_ALIASES) {
    if (!pattern.test(instruction)) continue;
    focus = candidateFocus;
    instruction = instruction.replace(pattern, "").trim();
    break;
  }
  return { focus, instruction };
}
