import type { DictionaryEntry } from "@/shared/types/api";

type LookupPromptBaseEntry = Pick<
  DictionaryEntry,
  "pronunciation" | "partOfSpeech" | "meaningZh"
>;

export function buildJaWordLookupPrompt(
  word: string,
  baseEntry?: LookupPromptBaseEntry,
  context?: string
): string {
  const sharedOutputRule = `请只输出一个 JSON 对象，不要输出 Markdown，不要输出额外说明。
JSON 必须包含：
- pronunciation：字符串
- partOfSpeech：字符串
- meaningZh：字符串
- examples：长度必须为 3 的数组

examples 数组里的每一项都必须是对象，并且包含：
- japanese：日语例句
- reading：整句假名读音
- translationZh：自然中文翻译`;

  const contextBlock = context ? `参考语境：${context}\n` : "";

  if (baseEntry && context) {
    return `请结合参考语境，为这个日语词整理最贴切的中文释义，并给出 3 句贴合该语境用法的自然例句。
词：${word}
${contextBlock}已知读音：${baseEntry.pronunciation}
已知词性：${baseEntry.partOfSpeech}
已知词典释义：${baseEntry.meaningZh}

${sharedOutputRule}

要求：
- 使用中文
- partOfSpeech 必须保持和已知信息一致，不要改写
- pronunciation 必须写成这个词条在词典形/基本形下的读音，不要写成参考语境里的连用形、名词化或句中变形读音
- 如果参考语境里出现的是活用形、连用形或固定搭配中的变形，必须先还原成词典形，再输出对应的词典形读音
- 只有在参考语境明确对应另一条常见且独立的词典词条时，才允许改成那条词典词条在词典形下的读音
- meaningZh 要优先写这个词在参考语境里最贴切的中文义项，可以比已知词典释义更聚焦
- examples 要围绕参考语境的用法来写，保持语义一致，但不要只机械改写原语境
- 如果参考语境体现的是惯用搭配、引申义或固定说法，要优先保留这种用法
- 如果 pronunciation 改变了，examples 里的 reading 也必须和该读音保持一致
- 3 句例句要在场景或语气上有变化，同时保持同一语义方向
- reading 只写整句假名，不要夹杂罗马字
- translationZh 只写自然中文，不要附加解释
- 不要输出多余字段`;
  }

  if (baseEntry) {
    return `请基于已知词条信息，为这个日语词补全 3 句自然、常见、适合学习者理解的例句。
词：${word}
已知读音：${baseEntry.pronunciation}
已知词性：${baseEntry.partOfSpeech}
已知释义：${baseEntry.meaningZh}

${sharedOutputRule}

要求：
- 使用中文
- pronunciation、partOfSpeech、meaningZh 必须保持和已知信息一致，不要改写
- 例句要围绕上面的释义来写，尽量自然、稳妥、常见
- 3 句例句不要只是机械替换名词，尽量在场景和语气上有变化
- reading 只写整句假名，不要夹杂罗马字
- translationZh 只写自然中文，不要附加解释
- 如果难以生成复杂句子，也要优先给出简单但正确、自然的句子
- 不要输出多余字段`;
  }

  if (context) {
    return `请结合参考语境，补全这个日语词在该语境下最贴切的基础词条信息，并给出 3 句语义一致的自然例句。
词：${word}
${contextBlock}
${sharedOutputRule}

要求：
- 使用中文
- pronunciation 必须写这个词条在词典形/基本形下的读音，不要直接抄参考语境里的句中读法
- 如果参考语境里出现的是「巡り」「抱いて」这类连用形、名词化或其他变形，输出时必须先还原成词典形，再写对应的词典形读音
- 只有在参考语境明确对应另一条常见且独立的词典词条时，才允许改成那条词典词条在词典形下的读音
- partOfSpeech 只写大致词性本身，如“动词”“形容词”“名词”
- meaningZh 要优先写这个词在参考语境里最贴切的中文义项，不要写成长段落
- examples 必须正好返回 3 句例句，并围绕参考语境对应的含义来写
- japanese 写自然日语句子，不要只返回词组
- reading 只写整句假名，不要夹杂罗马字
- translationZh 只写自然中文，不要附加解释
- 如果某一项无法可靠判断，就明确写“需结合上下文确认”
- 不要补充解释，不要输出多余字段`;
  }

  return `请补全这个日语词的基础词条信息，并给出 3 句自然、常见、适合学习者理解的例句。
词：${word}

${sharedOutputRule}

要求：
- 使用中文
- pronunciation 只写读音本身
- partOfSpeech 只写大致词性本身，如“动词”“形容词”“名词”
- meaningZh 只写最常见、最核心的中文释义，不要写成长段落
- examples 必须正好返回 3 句例句
- japanese 写自然日语句子，不要只返回词组
- reading 只写整句假名，不要夹杂罗马字
- translationZh 只写自然中文，不要附加解释
- 如果某一项无法可靠判断，就明确写“需结合上下文确认”
- 如果词义不够确定，例句也要尽量围绕最常见、最稳妥的理解来写
- 不要补充解释，不要输出多余字段`;
}
