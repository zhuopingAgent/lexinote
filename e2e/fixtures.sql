INSERT INTO japanese_dictionary_entries (
  word,
  pronunciation,
  meaning_zh,
  part_of_speech,
  examples,
  created_at
)
VALUES
  (
    '食べる',
    'たべる',
    '吃；进食',
    '动词',
    $json$
      [
        {
          "japanese": "毎朝パンを食べる。",
          "reading": "まいあさ ぱん を たべる。",
          "translationZh": "每天早上吃面包。"
        },
        {
          "japanese": "友達と駅前で昼ご飯を食べる。",
          "reading": "ともだち と えきまえ で ひるごはん を たべる。",
          "translationZh": "和朋友在车站前吃午饭。"
        },
        {
          "japanese": "疲れているときは温かい物を食べるといい。",
          "reading": "つかれて いる とき は あたたかい もの を たべる と いい。",
          "translationZh": "累的时候吃点热的东西比较好。"
        }
      ]
    $json$::jsonb,
    '2026-04-20T09:00:00+09:00'
  ),
  (
    '静か',
    'しずか',
    '安静；安稳',
    '形容动词',
    $json$
      [
        {
          "japanese": "この図書館はとても静かだ。",
          "reading": "この としょかん は とても しずか だ。",
          "translationZh": "这家图书馆非常安静。"
        },
        {
          "japanese": "夜の公園は昼より静かだった。",
          "reading": "よる の こうえん は ひる より しずか だった。",
          "translationZh": "夜晚的公园比白天更安静。"
        },
        {
          "japanese": "静かな場所で勉強したい。",
          "reading": "しずか な ばしょ で べんきょう したい。",
          "translationZh": "我想在安静的地方学习。"
        }
      ]
    $json$::jsonb,
    '2026-04-20T09:10:00+09:00'
  ),
  (
    '大切',
    'たいせつ',
    '重要；珍贵',
    '形容动词',
    $json$
      [
        {
          "japanese": "家族は私にとって大切だ。",
          "reading": "かぞく は わたし に とって たいせつ だ。",
          "translationZh": "家人对我来说很重要。"
        },
        {
          "japanese": "大切な書類は机の中にしまった。",
          "reading": "たいせつ な しょるい は つくえ の なか に しまった。",
          "translationZh": "我把重要文件收进抽屉里了。"
        },
        {
          "japanese": "時間を大切に使ってください。",
          "reading": "じかん を たいせつ に つかって ください。",
          "translationZh": "请珍惜时间。"
        }
      ]
    $json$::jsonb,
    '2026-04-20T09:20:00+09:00'
  ),
  (
    '抱く',
    'だく',
    '抱，搂',
    '动词',
    $json$
      [
        {
          "japanese": "母親が赤ん坊を抱いている。",
          "reading": "ははおや が あかんぼう を だいて いる。",
          "translationZh": "母亲正抱着婴儿。"
        },
        {
          "japanese": "彼は花束を胸に抱いた。",
          "reading": "かれ は はなたば を むね に だいた。",
          "translationZh": "他把花束抱在胸前。"
        },
        {
          "japanese": "ぬいぐるみを抱いて眠る子どももいる。",
          "reading": "ぬいぐるみ を だいて ねむる こども も いる。",
          "translationZh": "也有孩子抱着玩偶睡觉。"
        }
      ]
    $json$::jsonb,
    '2026-04-20T09:30:00+09:00'
  ),
  (
    '抱く',
    'いだく',
    '怀有，心存（不安、疑问、希望等感情或想法）',
    '动词',
    $json$
      [
        {
          "japanese": "将来に不安を抱いている。",
          "reading": "しょうらい に ふあん を いだいて いる。",
          "translationZh": "对未来怀有不安。"
        },
        {
          "japanese": "彼は新しい計画に希望を抱いた。",
          "reading": "かれ は あたらしい けいかく に きぼう を いだいた。",
          "translationZh": "他对新计划抱有希望。"
        },
        {
          "japanese": "その説明に疑問を抱く人も多い。",
          "reading": "その せつめい に ぎもん を いだく ひと も おおい。",
          "translationZh": "也有很多人对那个解释心存疑问。"
        }
      ]
    $json$::jsonb,
    '2026-04-20T09:40:00+09:00'
  ),
  (
    '巡る',
    'めぐる',
    '围绕；巡回',
    '动词',
    $json$
      [
        {
          "japanese": "その問題を巡って議論が続いている。",
          "reading": "その もんだい を めぐって ぎろん が つづいて いる。",
          "translationZh": "围绕那个问题的讨论还在继续。"
        },
        {
          "japanese": "休みの日は古い町を巡るのが好きだ。",
          "reading": "やすみ の ひ は ふるい まち を めぐる の が すき だ。",
          "translationZh": "休息日我喜欢逛老城区。"
        },
        {
          "japanese": "観光バスで市内を巡った。",
          "reading": "かんこう ばす で しない を めぐった。",
          "translationZh": "我乘观光巴士游览了市区。"
        }
      ]
    $json$::jsonb,
    '2026-04-20T09:50:00+09:00'
  );
