export function buildJaWordBaseFormPrompt(word: string, context?: string): string {
  const contextBlock = context ? `参考语境：${context}\n` : "";

  return `请判断这个日语输入在查词时应使用哪个词典形或基本形。
输入：${word}
${contextBlock}

请只输出一个 JSON 对象，不要输出 Markdown，不要输出额外说明。
JSON 必须包含：
- lookupWord：字符串
- lookupReason：字符串

要求：
- 如果输入是动词、形容词或相关变化形，优先返回最适合查词的词典形
- 如果输入是否定形、过去形、礼貌形、可能形、被动形、使役形、て形、た形等，返回基础词形
- 如果某个形态本身可以作为独立词条来查词，就返回这个形态对应的词典形，不要再继续还原到更深一层的普通形
- 例如：見通せない 应返回 見通せる，而不是 見通す
- 如果输入本身已经是适合查词的基本形，原样返回
- 如果是名词或固定表达，通常原样返回
- 如果提供了参考语境，请结合语境判断应该保留哪个基础词形
- 如果无法可靠判断，就返回原输入，不要编造新词
- lookupWord 只写词本身，不要附加解释
- lookupReason 用中文简短说明为什么这样查，控制在 1 句话内
- 如果 lookupWord 与原输入相同，也要说明“输入本身已经适合直接查词”或类似原因`;
}
