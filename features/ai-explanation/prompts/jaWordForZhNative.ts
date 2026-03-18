import type { ExplainInput } from "@/features/ai-explanation/infrastructure/LlmClient";

export function buildJaWordForZhNativePrompt(input: ExplainInput): string {
  return `请解释这个日语词：
词：${input.word}
读音：${input.reading ?? "未知"}
词性：${input.partOfSpeech ?? "未知"}
基础释义：${input.meaningZh}

请只输出一个 JSON 对象，不要输出 Markdown，不要输出额外说明。
JSON 必须包含这 4 个字符串字段：
- actualUsage
- commonScenarios
- nuanceDifferences
- commonMistakes

要求：
- 使用中文
- 简洁
- 面向中文母语者学习日语
- 内容准确，避免空字符串`;
}

export function buildJaWordOnlyForZhNativePrompt(word: string): string {
  return `请解释这个日语词：
词：${word}

请只输出一个 JSON 对象，不要输出 Markdown，不要输出额外说明。
JSON 必须包含这 4 个字符串字段：
- actualUsage
- commonScenarios
- nuanceDifferences
- commonMistakes

要求：
- 只根据单词本身进行解释
- 如果读音、词性、精确定义不确定，就明确说明“需结合上下文确认”
- 使用中文
- 简洁
- 面向中文母语者学习日语
- 内容准确，避免空字符串`;
}
