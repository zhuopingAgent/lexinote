import type { DictionaryEntry } from "@/shared/types/api";

function formatEntry(label: string, entry: DictionaryEntry) {
  const examples = entry.examples
    .map(
      (example, index) =>
        `${index + 1}. ${example.japanese}｜${example.reading}｜${example.translationZh}`
    )
    .join("\n");

  return `${label}：
- pronunciation：${entry.pronunciation}
- partOfSpeech：${entry.partOfSpeech}
- meaningZh：${entry.meaningZh}
- examples：
${examples || "（暂无）"}`;
}

export function buildJaWordReconcilePrompt(
  word: string,
  genericEntry: DictionaryEntry,
  contextualEntry: DictionaryEntry,
  context: string
): string {
  return `请比较这个日语词的通用结果和语境结果，判断是否存在足够明显的差异，以至于应该重新整理一个综合结果并保存到词典中。
词：${word}
参考语境：${context}

${formatEntry("通用结果", genericEntry)}

${formatEntry("语境结果", contextualEntry)}

请只输出一个 JSON 对象，不要输出 Markdown，不要输出额外说明。

如果两者没有明显差异，或者语境结果只是通用结果的轻微改写，请输出：
{"shouldPersist":false}

如果两者体现出明显不同的义项、搭配、语义重心或常见使用方向，请输出：
{
  "shouldPersist": true,
  "pronunciation": "字符串",
  "partOfSpeech": "字符串",
  "meaningZh": "字符串",
  "examples": [
    {
      "japanese": "字符串",
      "reading": "字符串",
      "translationZh": "字符串"
    }
  ]
}

要求：
- “明显差异”指已经影响默认查词结果的核心理解，而不是近义改写
- 如果 shouldPersist 为 true，输出的是适合默认查词保存的综合词条，不要只绑定当前语境
- 综合结果要兼顾通用义和语境中突出的常见义，但仍要简洁、自然、稳妥
- pronunciation 必须写成词典形/基本形下的读音，不要写成语境里的连用形、名词化或句中变形读音
- 如果参考语境出现的是句中变形，输出 pronunciation 时必须先还原成词典形再写
- partOfSpeech 优先保持可靠结果一致
- meaningZh 写成适合中文母语者理解的核心释义，不要写成长段落
- examples 必须正好返回 3 句自然例句
- 3 句例句里至少 1 句要体现参考语境中突出的常见用法，但整体仍应适合作为通用词条保存
- reading 只写整句假名，不要夹杂罗马字
- translationZh 只写自然中文，不要附加解释`;
}
