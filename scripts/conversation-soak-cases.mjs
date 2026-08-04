import { ADDITIONAL_CONVERSATION_SOAK_CASES_BY_MODE } from "./conversation-soak-cases-additional.mjs";

const baselineCasesByMode = {
  auto: [
    ["daily-plan", "daily_life", "週末に新しいレシピを試してみます。", "zh", ["周末", "食谱"], ["grammar", "〜てみる"]],
    ["meeting-request", "workplace", "请问可以把明天下午的会议改到下周二下午吗？", "ja", ["来週", "火曜日"], ["grammar", "〜ていただけますか"]],
    ["explicit-polish", "workplace", "请帮我润色这句日语：昨日、部長に資料を見せてもらいましたです。", "mixed", ["見せて", "ました"], null],
    ["explicit-explain", "school", "请解释日语语法「〜わけではない」，并说明它是不是完全否定。", "mixed", ["完全", "否定"], ["grammar", "〜わけではない"]],
    ["travel-plan", "travel", "如果明天不下雨，我打算先去浅草，再去晴空塔。", "ja", ["明日", "浅草"], null],
    ["receipt-storage", "workplace", "念のため、領収書を保管しておいてください。", "zh", ["以防", "收据"], ["grammar", "〜ておく"]],
    ["explicit-word", "government_office", "「住民票」は中国語で何と言いますか。", "zh", ["住民"], ["vocabulary", "住民票"]],
    ["business-delay", "email", "ご返信が遅くなり、申し訳ございません。確認でき次第、改めてご連絡いたします。", "zh", ["回复", "确认"], null],
    ["explicit-correction", "hotel", "这句日语自然吗？部屋から海を見えます。请改正并简单说明。", "mixed", ["部屋", "海"], null],
    ["difference-question", "school", "「〜そうだ」と「〜ようだ」はどう違いますか。中国語で説明してください。", "mixed", ["区别", "表示"], null],
    ["quoted-expression", "friend_chat", "朋友发来「また今度にしよう」，这里是什么语气？", "mixed", ["下次", "语气"], null],
    ["out-of-scope-weather", "travel", "请告诉我明天东京的实时天气和降雨概率。", "zh", ["天气", "无法"], null],
    ["restaurant-request", "restaurant", "我对花生过敏，请帮我翻译成在餐厅能直接使用的日语，并请店员确认酱汁里也没有花生。", "ja", ["ピーナッツ", "アレルギー"], null],
    ["nuance-translation", "friend_chat", "せっかく誘ってくれたのに、今回は行けそうにない。", "zh", ["特意", "这次"], null],
    ["explicit-grammar-check", "school", "「日本へ来てから三年になります」这句话有没有问题？", "mixed", ["来てから", "三年"], null],
    ["ambiguous-kekkou", "customer_service", "店员问我要不要袋子时，我说「結構です」，请翻译并说明会不会产生歧义。", "mixed", ["不需要", "语境"], null],
    ["partial-negation", "friend_chat", "我并不是不想参加，只是当天可能会晚到半小时。", "ja", ["参加", "遅れ"], ["grammar", "〜わけではない"]],
    ["unavoidable", "workplace", "人手が足りない以上、計画を延期せざるを得ません。", "zh", ["不得不", "延期"], ["grammar", "〜ざるを得ない"]],
    ["grammar-direct", "school", "「〜うちに」の两种常见用法是什么？各给一个简单例句。", "mixed", ["期间", "变化"], ["grammar", "〜うちに"]],
    ["self-permission", "workplace", "我想问客户：我可以把修改后的合同明天上午发给您吗？", "ja", ["明日", "契約書"], ["grammar", "〜てもよろしいでしょうか"]],
  ],
  zh_to_ja: [
    ["schedule-change", "workplace", "能否麻烦您把原定周四上午十点的面谈改到周五下午三点？如果不方便，也请告诉我您方便的时间。", "ja", ["木曜日", "金曜日"], ["grammar", "〜ていただけますか"]],
    ["send-permission", "email", "请问我可以先把未盖章的扫描件发给您，原件下周一再邮寄吗？", "ja", ["スキャン", "原本"], ["grammar", "〜てもよろしいでしょうか"]],
    ["soft-refusal", "workplace", "非常感谢您的邀请，但那天已经有安排，恐怕无法参加。希望下次还有机会。", "ja", ["参加", "機会"], null],
    ["late-apology", "email", "很抱歉回复晚了。我刚刚确认完附件，除了第三页的金额以外没有其他问题。", "ja", ["返信", "添付"], null],
    ["hospital-symptoms", "hospital", "从昨晚开始右下腹持续疼痛，还有轻微发烧，但没有呕吐。走路时疼得更明显。", "ja", ["昨夜", "痛"], null],
    ["hospital-repeat", "hospital", "不好意思，我没有听清检查前的注意事项。可以请您再慢一点说明一次吗？", "ja", ["もう一度", "ゆっくり"], ["grammar", "〜ていただけますか"]],
    ["document-requirements", "government_office", "办理地址变更时，除了在留卡以外还需要带什么材料？复印件可以吗？", "ja", ["住所", "在留カード"], null],
    ["rental-repair", "housing", "厨房水龙头从昨天起一直漏水，关紧以后也没有改善。请问最早什么时候可以安排维修？", "ja", ["蛇口", "修理"], null],
    ["allergy-confirm", "restaurant", "我对甲壳类严重过敏。请确认这道汤的高汤和调味料里是否含有虾或螃蟹。", "ja", ["アレルギー", "えび"], null],
    ["ticket-rebook", "transportation", "因为前一班电车晚点，我没赶上指定席列车。可以免费改签到下一班吗？", "ja", ["遅延", "次"], null],
    ["friend-delay", "friend_chat", "抱歉，电车比预计晚了二十分钟。我大概七点半到，你们不用等我，先点菜吧。", "ja", ["電車", "先に"], null],
    ["progress-update", "workplace", "资料已经整理到一半，但还需要确认最新数据。我会在今天下班前汇报是否能按时完成。", "ja", ["確認", "本日"], null],
    ["refund-request", "customer_service", "收到的商品颜色和订单不同，而且外包装已经破损。希望换成正确颜色，如果缺货则申请退款。", "ja", ["注文", "返金"], null],
    ["phone-reservation", "restaurant", "我想预约本周六晚上七点四个人的位置，其中一位坐轮椅，请问有无障碍座位吗？", "ja", ["土曜日", "車椅子"], null],
    ["deadline-extension", "school", "因为高烧我没能参加昨天的考试。可以提交诊断证明后申请补考吗？", "ja", ["試験", "診断書"], ["grammar", "〜てもよろしいでしょうか"]],
    ["interview-reschedule", "interview", "非常抱歉，家里临时有事，原定明天下午的面试能否改到本周其他时间？", "ja", ["面接", "変更"], ["grammar", "〜ていただけますか"]],
    ["delivery-instruction", "customer_service", "如果送货时家里没人，请不要放在门口，麻烦改为周日上午再次配送。", "ja", ["不在", "再配達"], null],
    ["neighbor-noise", "housing", "不好意思，最近晚上十一点以后还能听到很大的音乐声。因为孩子早睡，能请您稍微调低音量吗？", "ja", ["音楽", "音量"], ["grammar", "〜ていただけますか"]],
    ["conditional-cancel", "travel", "如果台风导致航班取消，请告诉我能否改成第二天的航班，以及酒店费用是否有补偿。", "ja", ["台風", "欠航"], null],
    ["not-complete-denial", "friend_chat", "我不是完全反对这个方案，只是觉得在决定之前最好再听听其他人的意见。", "ja", ["反対", "意見"], ["grammar", "〜わけではない"]],
  ],
  ja_to_zh: [
    ["partial-negation", "workplace", "反対しているわけではありませんが、実施時期については再検討したほうがいいと思います。", "zh", ["并不是", "时间"], ["grammar", "〜わけではない"]],
    ["unavoidable-overtime", "workplace", "納期が迫っているため、今週は残業せざるを得ない状況です。", "zh", ["不得不", "加班"], ["grammar", "〜ざるを得ない"]],
    ["best-avoid", "hospital", "症状が軽くても、念のため今日は運動を控えるに越したことはありません。", "zh", ["最好", "运动"], ["grammar", "〜に越したことはない"]],
    ["risk-delay", "workplace", "このまま確認を後回しにすると、重大なミスにつながりかねません。", "zh", ["可能", "严重"], ["grammar", "〜かねない"]],
    ["unfortunate-full", "restaurant", "あいにく本日は満席ですが、八時半以降でしたらお席をご用意できます。", "zh", ["不巧", "八点半"], null],
    ["humble-receive", "email", "ご提案いただいた内容を社内で検討させていただき、週明けまでに回答いたします。", "zh", ["内部", "答复"], null],
    ["prepare-docs", "government_office", "申請当日に慌てないよう、必要書類はあらかじめコピーしておいてください。", "zh", ["提前", "复印"], ["grammar", "〜ておく"]],
    ["far-from", "travel", "景色を楽しむどころか、濃い霧で目の前の道さえ見えませんでした。", "zh", ["别说", "浓雾"], ["grammar", "〜どころか"]],
    ["although-progress", "school", "毎日練習しているものの、会話になるとまだ言葉がすぐに出てきません。", "zh", ["虽然", "对话"], ["grammar", "〜ものの"]],
    ["better-than-expected", "shopping", "値段が安いにしては、縫製もしっかりしていて長く使えそうです。", "zh", ["价格", "做工"], ["grammar", "〜にしては"]],
    ["only-option", "transportation", "終電が出てしまったので、今日はタクシーで帰るしかありません。", "zh", ["只能", "出租车"], ["grammar", "〜しかない"]],
    ["cannot-skip", "workplace", "責任者として、問題を把握していながら報告しないわけにはいきません。", "zh", ["不能", "汇报"], ["grammar", "〜わけにはいかない"]],
    ["on-starting", "interview", "新しい職務に就くにあたって、必要な研修と評価制度について説明を受けました。", "zh", ["就任", "培训"], ["grammar", "〜にあたり"]],
    ["as-soon-as", "customer_service", "商品の入荷日が分かり次第、登録されたメールアドレスへご連絡いたします。", "zh", ["一旦", "到货"], ["grammar", "〜次第"]],
    ["not-until", "hospital", "検査結果が出ないことには、治療方針を決めることができません。", "zh", ["如果不", "治疗"], ["grammar", "〜ないことには"]],
    ["while-change", "family", "子どもが昼寝しているうちに、夕食の準備を済ませてしまおう。", "zh", ["趁", "晚饭"], ["grammar", "〜うちに"]],
    ["even-if", "travel", "多少時間がかかったとしても、安全を優先して別の道を選ぶべきです。", "zh", ["即使", "安全"], null],
    ["business-implication", "email", "現時点ではご希望に沿いかねますが、条件を調整できれば再度検討いたします。", "zh", ["目前", "考虑"], null],
    ["sarcastic-nuance", "friend_chat", "よくそんなことが平気で言えるね。", "zh", ["亏你", "说得出口"], null],
    ["double-negative", "online_chat", "参加できないこともないけど、開始時間には少し遅れるかもしれない。", "zh", ["也不是不能", "迟到"], null],
  ],
  polish_ja: [
    ["particle-visibility", "housing", "私の部屋から富士山を見えます。", "mixed", ["見えます", "部屋"], null],
    ["na-past", "hotel", "昨日泊まったホテルはとても静かかったです。", "mixed", ["静かでした"], ["grammar", "な形容词过去形"]],
    ["i-past", "daily_life", "昨日の映画は面白いでした。", "mixed", ["面白かったです"], ["grammar", "い形容词过去形"]],
    ["business-thanks", "email", "資料を送ってくれて、ありがとうございます。確認したら連絡します。", "mixed", ["資料", "連絡"], null],
    ["honorific-double", "workplace", "社長がおっしゃられた内容を確認しました。", "mixed", ["おっしゃった"], null],
    ["humble-subject", "workplace", "部長は明日の会議に参ります。", "mixed", ["いらっしゃ", "出席"], null],
    ["literal-meeting", "workplace", "私たちは来週この問題について一つの会議を開きます。", "mixed", ["会議", "来週"], null],
    ["deadline-email", "email", "忙しいところすみませんが、このファイルを今日まで確認してください。", "mixed", ["本日中", "確認"], null],
    ["restaurant-order", "restaurant", "すみません、水を一杯もらいたいです。", "mixed", ["お水", "いただけ"], null],
    ["allergy-natural", "restaurant", "私はエビにアレルギーがありますので、エビがない料理をください。", "mixed", ["えび", "アレルギー"], null],
    ["train-delay", "transportation", "電車が遅刻したので、会社に遅刻しました。", "mixed", ["遅れ", "会社"], null],
    ["hospital-description", "hospital", "昨日から頭がずっと痛くて、熱も少しありますでした。", "mixed", ["あります", "痛くて"], null],
    ["government-question", "government_office", "住所変更をするために、何の資料を持たなければなりませんか。", "mixed", ["必要", "書類"], null],
    ["rental-leak", "housing", "台所の水道は昨日から水を漏れています。", "mixed", ["水漏れ", "蛇口"], null],
    ["friend-casual", "friend_chat", "明日の飲み会、私は少し遅く到着する可能性があります。", "mixed", ["遅れ", "かも"], null],
    ["interview-formal", "interview", "明日の面接に行けなくなりましたから、時間を変えてほしいです。", "mixed", ["面接", "変更"], ["grammar", "〜ていただけますか"]],
    ["customer-complaint", "customer_service", "届いた商品は注文した色と違います。交換してくれませんか。", "mixed", ["交換", "いただけ"], ["grammar", "〜ていただけますか"]],
    ["school-extension", "school", "病気のせいでレポートが完成できませんでした。締切を延長できますか。", "mixed", ["体調", "締め切り"], null],
    ["redundant-contrast", "workplace", "しかし、でも、この案はコストが高すぎると思います。", "mixed", ["しかし", "コスト"], null],
    ["ambiguous-agent", "delivery", "不在だったので、管理人に荷物を預けました。", "mixed", ["管理人", "荷物"], null],
  ],
  explain_ja: [
    ["wake-dewanai", "school", "「〜わけではない」と単純な否定の違いを、中文で例文付きで説明してください。", "mixed", ["完全", "否定"], ["grammar", "〜わけではない"]],
    ["teoku", "daily_life", "「〜ておく」には準備以外の意味もありますか。中文で説明してください。", "mixed", ["提前", "状态"], ["grammar", "〜ておく"]],
    ["uchini", "school", "「〜うちに」の“趁着”和“在过程中发生变化”这两种用法怎么区分？", "mixed", ["趁", "变化"], ["grammar", "〜うちに"]],
    ["kotoninatteiru", "workplace", "请解释「〜ことになっている」，并和「〜ことにしている」比较。", "mixed", ["规定", "个人"], ["grammar", "〜ことになっている"]],
    ["zaruwoenai", "workplace", "「〜ざるを得ない」の接続、意味、使用場面を中国語で説明してください。", "mixed", ["不得不", "接续"], ["grammar", "〜ざるを得ない"]],
    ["wakeniwaikanai", "workplace", "「〜わけにはいかない」为什么不只是“不能”？请用中文解释社会责任或心理约束。", "mixed", ["责任", "心理"], ["grammar", "〜わけにはいかない"]],
    ["monono", "school", "「〜ものの」と「〜けれども」の違いを、書面語かどうかも含めて説明してください。", "mixed", ["书面", "转折"], ["grammar", "〜ものの"]],
    ["nishitewa", "shopping", "「〜にしては」と「〜わりに」のニュアンスの違いを中国語で説明してください。", "mixed", ["预期", "相比"], ["grammar", "〜にしては"]],
    ["dokoroka", "travel", "请解释「〜どころか」的递进方向，为什么有时翻译成“别说……连……都……”？", "mixed", ["别说", "递进"], ["grammar", "〜どころか"]],
    ["kanenai", "workplace", "「〜かねない」可以用于好事吗？请说明语气限制并给商务场景例句。", "mixed", ["负面", "可能"], ["grammar", "〜かねない"]],
    ["nikoshita", "hospital", "「〜に越したことはない」と「〜ほうがいい」の建议强度有什么不同？", "mixed", ["最好", "建议"], ["grammar", "〜に越したことはない"]],
    ["shidai", "customer_service", "「〜次第」表示“一……就……”时怎么接续？和名词「次第」有什么区别？", "mixed", ["接续", "取决于"], ["grammar", "〜次第"]],
    ["niatari", "interview", "「〜にあたり」と「〜に際して」有什么区别？请说明正式程度和适用场景。", "mixed", ["正式", "场合"], ["grammar", "〜にあたり"]],
    ["naikotonihak", "hospital", "「〜ないことには」后项为什么通常是否定或困难判断？请用中文说明。", "mixed", ["如果不", "后项"], ["grammar", "〜ないことには"]],
    ["temorau", "hospital", "「〜てもらえますか」と「〜ていただけますか」の礼貌程度和使用对象有什么不同？", "mixed", ["礼貌", "对象"], ["grammar", "〜ていただけますか"]],
    ["temoyoroshii", "workplace", "「〜てもよろしいでしょうか」是在请求别人做事，还是询问自己能否做事？", "mixed", ["自己", "许可"], ["grammar", "〜てもよろしいでしょうか"]],
    ["soudatwo", "school", "传闻的「〜そうだ」和样态的「〜そうだ」在接续上怎么区分？", "mixed", ["传闻", "样态"], null],
    ["youdamitai", "school", "「〜ようだ」「〜みたいだ」「〜らしい」表达推测时有什么语体和证据差异？", "mixed", ["推测", "口语"], null],
    ["saseteitadaku", "email", "「〜させていただく」什么时候自然，什么时候会变成过度敬语？", "mixed", ["许可", "过度"], null],
    ["bakari", "daily_life", "「〜たばかり」と「〜たところ」の时间感有什么不同？请给能看出差异的成对例句。", "mixed", ["刚刚", "时间"], null],
  ],
};

function seededShuffle(items, seed) {
  let state = seed >>> 0;
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

function materializeCases(casesByMode, suite) {
  return Object.entries(casesByMode).flatMap(([mode, entries]) =>
    entries.map(([
      slug,
      scenario,
      input,
      responseLanguage,
      responseAny,
      learning,
      riskTags = ["baseline"],
      responseNone = [],
    ]) => ({
      id: `${mode}-${slug}`,
      suite,
      mode,
      scenario,
      input,
      riskTags,
      expect: {
        responseLanguage,
        responseAny,
        responseNone,
        learning: learning
          ? { kind: learning[0], surfaceForm: learning[1] }
          : null,
      },
    }))
  );
}

export const BASELINE_CONVERSATION_SOAK_CASES = materializeCases(
  baselineCasesByMode,
  "baseline"
);

export const ADDITIONAL_CONVERSATION_SOAK_CASES = materializeCases(
  ADDITIONAL_CONVERSATION_SOAK_CASES_BY_MODE,
  "additional"
);

export function buildConversationSoakCases(seed = 20260804) {
  const cases = [
    ...BASELINE_CONVERSATION_SOAK_CASES,
    ...ADDITIONAL_CONVERSATION_SOAK_CASES,
  ];
  return seededShuffle(cases, seed);
}

export const CONVERSATION_SOAK_CASES = buildConversationSoakCases();
