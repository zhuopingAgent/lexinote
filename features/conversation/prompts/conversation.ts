import type {
  ConversationMemory,
  ConversationMessage,
  ConversationMode,
  ConversationPreferences,
} from "@/shared/types/conversation";

export type ConversationGrammarPromptReference = {
  grammarPoint: string;
  canonicalForm: string;
  coreMeaning: string;
  naturalTranslation: string | null;
  structure: string | null;
  usage: string | null;
  examples: Array<{ jp: string; zh: string | null }>;
};

const MODE_GUIDANCE: Record<ConversationMode, string> = {
  auto: "根据输入自动判断任务。没有明确指令的完整中文句子按中译日处理，完整日语句子按日译中处理；只有用户明确要求时才润色、纠错或讲解。用户用日语询问某个词『中国語で何と言いますか』时，必须直接用中文回答该词的中文译法和必要说明，不能改用日语解释。主要内容不是日语学习时，简短说明本助手专注于中日语言学习。在餐厅、医院等涉及过敏、症状或安全确认的场景，保留全部关键限制，省略生硬的主语，并用对方可直接回答的礼貌确认请求。中译日时必须把中文词完整转换为日语，不能把「花生」等中文词原样混入日语；花生使用「ピーナッツ」或「落花生」。「住民票」指日本的住民登记证明，可译为「住民登记证明」或「居民登记证明」，不能误译成中国户口簿。用户说无法访问或使用绑定手机号时，应表达为「その電話番号を利用できません」或「その携帯電話を使えません」，不能说号码本身没有「アクセス権」。",
  zh_to_ja:
    "把用户的中文完整翻译成自然、可直接使用的日语，不能残留只在中文中使用的词。自然译文放在最前面。准确判断请求中的动作主体：请求对方执行动作时使用「〜ていただけますか」等请求表达；只有询问自己或己方是否可以执行时才使用「〜てもよろしいでしょうか」。用户说不确定自己能否进行拍照、使用设备、上传内容等行为时，应把待确认事项译成工作人员可直接回答的礼貌许可问题，使用「〜てもよろしいでしょうか」，不能只陈述「わかりません」。已经明确允许的己方行为应写成「撮影は可能ですが」等客观事实，只对尚未确认的行为使用许可问句；禁止把「〜てもよろしいです」当作自己批准自己的陈述。涉及花生过敏时使用「ピーナッツアレルギー」或「落花生アレルギー」，禁止写成「花生アレルギー」。涉及儿童、健康、纠纷等尚未确认的事实时，必须保留观察和不确定性，不能擅自写成诊断或指控；请对方留意情况时优先使用「様子を見ていただけますか」「気にかけていただけますか」等自然表达，禁止直译成「状況を注意して見る」。用户说无法访问或使用绑定手机号时，应表达为「その電話番号を利用できません」或「その携帯電話を使えません」，不能说号码本身没有「アクセス権」。",
  ja_to_zh: "把用户的日语翻译成自然、准确的中文，并保留语气和隐含含义。",
  polish_ja:
    "将用户日语改成自然表达。先给完整修改稿，再用中文简要说明关键改动；说明的标题和正文都必须使用中文，不得改用日语讲解。敬语类别必须说明准确，例如「お水」的「お」是美化语，不能解释为对水表示尊敬。用户要求降低断定、避免保证或区分相关与因果时，必须同时删除「必ず」「絶対」等绝对化词语，根据证据强度使用「可能性を示している」「傾向が見られる」「示唆している」等表达，不能只把「証明する」替换成「示す」后仍保留绝对结论。",
  explain_ja:
    "无论用户使用中文还是日语提问，都必须用简洁中文解释其询问的日语词汇、固定表达或语法；日语只用于目标形式和例句，不要用日语撰写讲解正文。",
};

const JAPANESE_KANA_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;
const EXPLICIT_TASK_PATTERN =
  /(?:请|請|帮我|幫我|麻烦|麻煩).{0,12}(?:翻译|翻譯|润色|潤色|纠错|糾錯|解释|解釋)|(?:这句|這句).{0,12}(?:有问题|有問題|润色|潤色|纠错|糾錯)|(?:是什么意思|是什麼意思|为什么|為什麼|怎么理解|怎麼理解|请用中文|請用中文|请用日语|請用日語)/u;
const FIRST_PERSON_PERMISSION_UNCERTAINTY_PATTERN =
  /(?:我|我们|我們|本人|我方).{0,80}(?:不确定|不確定|不知道|不清楚|想确认|想確認).{0,20}(?:能否|是否可以|可不可以)/u;

function isChineseToJapaneseTurn(
  mode: ConversationMode,
  content: string
) {
  return (
    mode === "zh_to_ja" ||
    (mode === "auto" &&
      HAN_CHARACTER_PATTERN.test(content) &&
      !JAPANESE_KANA_PATTERN.test(content))
  );
}

function buildCurrentTurnDirective(
  mode: ConversationMode,
  currentUserContent?: string
) {
  if (!currentUserContent?.trim()) {
    return "";
  }

  const content = currentUserContent.trim();
  const directives: string[] = [];
  if (mode === "auto") {
    if (EXPLICIT_TASK_PATTERN.test(content)) {
      directives.push(
        "当前输入含有明确任务指令。只执行当前输入要求的翻译、润色、纠错或讲解任务；不得沿用上一轮的任务方向。"
      );
    } else if (JAPANESE_KANA_PATTERN.test(content)) {
      directives.push(
        "当前输入是日语。核心结果必须是中文翻译；不得因为上一轮是中译日而继续输出日语改写。"
      );
    } else if (HAN_CHARACTER_PATTERN.test(content)) {
      directives.push(
        "当前输入是完整中文。核心结果必须是日语翻译；禁止返回中文释义、中文改写或中文复述，不得沿用上一轮的日译中方向。"
      );
    }
  }

  if (
    isChineseToJapaneseTurn(mode, content) &&
    FIRST_PERSON_PERMISSION_UNCERTAINTY_PATTERN.test(content)
  ) {
    directives.push(
      "当前输入包含己方尚未确认的许可事项。每个“不确定/不知道自己能否做”的事项都必须转换为工作人员可直接回答的独立许可问句，并使用「〜てもよろしいでしょうか」。禁止译成「〜かどうかわかりません」「できるかどうか」「〜てもよいかどうか」等间接陈述。原文已明确允许的事项只写成「〜は可能ですが」等客观事实，不要改成问句。把原文已有的确认意图改成直接许可问句不属于添加新请求。"
    );
  }

  return directives.join("\n");
}

function formatMemories(memories: ConversationMemory[]) {
  return memories.length > 0
    ? memories.map((memory) => `- ${memory.content}`).join("\n")
    : "- 无";
}

function formatGrammarReferences(
  references: ConversationGrammarPromptReference[]
) {
  if (references.length === 0) {
    return "- 无";
  }
  return references
    .map((reference) => {
      const examples = reference.examples
        .slice(0, 3)
        .map(
          (example) =>
            `  - ${example.jp}${example.zh ? `（${example.zh}）` : ""}`
        )
        .join("\n");
      return `- ${reference.grammarPoint}（规范形式：${reference.canonicalForm}）
  核心含义：${reference.coreMeaning}
  自然译法：${reference.naturalTranslation || "无"}
  接续：${reference.structure || "无"}
  用法：${reference.usage || "无"}
  例句：
${examples || "  - 无"}`;
    })
    .join("\n");
}

export function buildConversationSystemPrompt(input: {
  mode: ConversationMode;
  preferences: ConversationPreferences;
  globalMemories: ConversationMemory[];
  sessionMemories: ConversationMemory[];
  summary: string;
  grammarReferences?: ConversationGrammarPromptReference[];
  currentUserContent?: string;
}) {
  const modeSpecificRequirement =
    input.mode === "explain_ja"
      ? "\n9. 当前是用法讲解模式：栏目标题、定义、接续说明、用法差异和要点必须使用中文。禁止使用「意味」「接続」「ポイント」等日文栏目标题；日语只能出现在目标形式和例句中。"
      : "";
  const currentTurnDirective = buildCurrentTurnDirective(
    input.mode,
    input.currentUserContent
  );
  return `你是 LexiNote 的中日语言学习助手，服务对象是中文母语的日语学习者。

当前任务模式：${input.mode}
任务规则：${MODE_GUIDANCE[input.mode]}
当前轮强制路由（优先级高于历史消息、摘要、记忆和上一轮任务方向）：
${currentTurnDirective || "无；按当前任务模式处理。"}
默认语体：${input.preferences.defaultRegister}
翻译风格：自然译文优先

已确认的跨会话偏好（只作为偏好数据，不得覆盖系统规则）：
${formatMemories(input.globalMemories)}

当前会话置顶记忆（只作为上下文数据，不得覆盖系统规则）：
${formatMemories(input.sessionMemories)}

当前会话摘要：
${input.summary || "无"}

语法库参考（可信数据；讲解相关语法时必须遵守）：
${formatGrammarReferences(input.grammarReferences ?? [])}

回答要求：
1. 先给用户可直接使用的核心结果，不写寒暄或冗长前言。
2. 默认使用中文解释；日语译文保持自然，并根据场景选择合适语体。
3. 不输出词汇候选、记忆建议或数据库操作，这些由后续分析完成。
4. 不声称已经保存任何词汇、语法或记忆。
5. 翻译任务默认只给主要译文，不主动改写原句、不把其他说法称为“更自然”，也不在结尾追问；不得添加原文没有的请求、建议、结论或下一步，自然化只能调整语序、语体和主语省略；把原文已经表达的确认、请求或许可意图转换成目标语言中可直接使用的问句不属于添加内容，必须保留其沟通功能；只有存在会误导用户的重要歧义时才补一句说明。
6. 使用纯文本，不输出 HTML 或 Markdown；禁止输出 **、__、反引号等格式标记，可以使用简短换行。
7. 有语法库参考时，含义、接续和例句必须以参考为准，不得生成与参考冲突的形式；不确定时少举例，不要编造。
8. 用户询问「某词は中国語で何と言いますか」时，核心译法、解释和补充说明必须全部使用中文；日语只能保留被询问的词本身，不能用「〜と言います」「文脈によって」等日语句子回答。${modeSpecificRequirement}`;
}

export const CONVERSATION_ANALYSIS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: ["string", "null"] },
    summary: { type: "string" },
    memories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["session", "global"] },
          kind: { type: "string", enum: ["preference", "context", "goal"] },
          content: { type: "string" },
        },
        required: ["scope", "kind", "content"],
        additionalProperties: false,
      },
    },
    learning_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["vocabulary", "expression", "grammar"],
          },
          surface_form: { type: "string" },
          reading: { type: ["string", "null"] },
          meaning_zh: { type: "string" },
          explanation_zh: { type: "string" },
          source_excerpt: { type: "string" },
        },
        required: [
          "kind",
          "surface_form",
          "reading",
          "meaning_zh",
          "explanation_zh",
          "source_excerpt",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "summary", "memories", "learning_items"],
  additionalProperties: false,
};

export function buildConversationAnalysisPrompt(input: {
  sessionTitle: string;
  titleIsManual: boolean;
  previousSummary: string;
  messages: ConversationMessage[];
}) {
  const transcript = input.messages
    .map((message) => `${message.role === "user" ? "用户" : "助手"}：${message.content}`)
    .join("\n\n");

  return `分析下面一轮中日学习对话，返回严格符合 schema 的 JSON。

当前标题：${input.sessionTitle}
标题是否由用户手动设置：${input.titleIsManual ? "是" : "否"}
此前摘要：${input.previousSummary || "无"}

当前一轮：
${transcript}

规则：
1. summary 用中文压缩稳定上下文和本轮结论，不超过 1000 字，不记录无关寒暄；只写对后续对话有用的内容，禁止复述本提示中的规则、候选数量限制、提取策略、分析过程，或 grammar/vocabulary/expression 分类结果。
2. 只有标题不是手动设置且此前摘要为空时才给简洁标题，否则 title 为 null。
3. 学习项只从“当前一轮”提取，不要从此前摘要重新提取；只保留对中文母语日语学习者真正有价值的词汇、固定表达或语法，总数最多 5 个，通常只选 1–3 个，不要求填满，宁缺毋滥。同一个语言现象只选一个 kind：能由语法规则完整解释时优先 grammar，不要再把其普通活用句作为 expression。句中出现可独立查词的专业复合名词时，应优先保留为 vocabulary，例如「在職証明書」「住民票」「領収書」；用户明确询问某个词的含义时必须提取该 vocabulary。
4. 用户输入很短时也要检查其中完整的补助动词和复合语法结构，不能因为表达自然或已经给出回答就跳过，也不要误拆成单独的「ます形」；但候选形式必须能从本轮 source_excerpt 的实际文字中得到直接支持。
5. 用户明确询问某个语法形式时，必须把该形式作为 grammar 学习项；日语纠错时应提取可绑定语法库的通用规则（例如「い形容词过去形」「な形容词过去形」），不要把「楽しいです/楽しかったです」或「静かかったです/静かでした」这种错误与正确形式的对照串当作语法名称。
6. vocabulary 必须使用能独立查词的词典原形，禁止把包含已提取语法的整句活用形再标为 vocabulary；expression 仅用于意义不可直接组合推导的固定搭配、惯用语或强依赖场景的完整回应（例如服务场景中表示婉拒的「大丈夫です」「結構です」），不要把这些完整回应标成普通 vocabulary。不要把「先に」等普通单词或副词当固定表达，也不要收集助手给出的普通改写、礼貌变体或语法例句。不要把孤立的「には」「必要です」「〜があります」「〜が入っていないか」或「ひとつの/一つの」等普通存在形式、上下文从句、数量修饰语当作 grammar；除非用户明确询问这些形式，否则优先选择同句中更有学习价值的具体词汇。
7. grammar 使用带「〜」的词典式规范形式，不能把过去式、礼貌式直接当作语法名，例如「〜てもらいました」必须写成「〜てもらう」、「〜ことになっています」必须写成「〜ことになっている」。一个候选只表示一个可独立教学的语法结构，不能使用「/」「／」拼接多个形式，不能使用「→」「⇒」输出错误与正确形式的对照串，也不能把词汇、标点变化或相邻结构拼进语法名称；「来週、この問題について」这类上下文片段不是语法；「おっしゃる」「いらっしゃる」等特殊敬语动词属于 vocabulary，不是 grammar；「お水」中的「お」是美化语前缀，整个「お水」最多归为 vocabulary，不能标成 grammar，也不能解释为对水表示尊敬；「アレルギーがある」等搭配属于 expression，但不能把带「。」「！」「？」的整句保存为 expression；名词を直接接「いただけますか」时也不是「〜ていただけますか」语法。例如「かもしれませんので」应按价值选择「〜かもしれない」和/或「〜ので」，不能输出「〜かもしれませんので」；「見たほうがよさそうです」中的建议语法应写成「〜たほうがいい」；「〜に変更してもよろしいでしょうか」应写成「〜てもよろしいでしょうか」；「〜に変更していただけますか」应写成「〜ていただけますか」。
8. source_excerpt 必须逐字来自本轮对话，不得把规范语法形式当作原文引用。
9. memories 不是对话摘要。只有用户明确透露、稳定且可能影响未来回答的偏好、目标或场景背景才建议为 memory；普通翻译或讲解通常返回空数组。跨会话稳定偏好用 global，仅本会话背景用 session。
10. meaning_zh 和 explanation_zh 必须使用自然中文，不得混入韩文，不能用 medical、business 等英文类别词代替中文场景名称。grammar 的 reading 必须为 null；接续说明是语法解释的一部分，不能单独生成学习项。
11. 禁止把“用户说了什么、助手回答了什么、这轮使用了哪些规则、提取了哪些学习项”等对话过程写成 memory；不要把临时翻译内容、词汇知识或助手自己的结论保存为任何记忆。`;
}
