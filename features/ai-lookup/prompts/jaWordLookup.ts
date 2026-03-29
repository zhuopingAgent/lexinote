export function buildJaWordLookupPrompt(word: string): string {
  return `请补全这个日语词的基础词条信息：
词：${word}

请只输出一个 JSON 对象，不要输出 Markdown，不要输出额外说明。
JSON 必须包含这 3 个字符串字段：
- pronunciation
- partOfSpeech
- meaningZh

要求：
- 使用中文
- pronunciation 只写读音本身
- partOfSpeech 只写词性本身，如“动词”“形容词”“名词”
- meaningZh 只写最常见、最核心的中文释义，不要写成长段落
- 如果某一项无法可靠判断，就明确写“需结合上下文确认”
- 不要编造例句，不要补充解释，不要输出多余字段`;
}
