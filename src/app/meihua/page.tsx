import { DivinationPage } from '@/components/divination-page';

export default function MeihuaPage() {
  return (
    <DivinationPage
      type="meihua"
      icon="🌸"
      title="梅花易数"
      subtitle="邵康节·万物起卦"
      placeholder="请输入您看到的数字、字、时间或外应，如：我看到3只鸟飞过，问事业"
      systemInfo="梅花易数为邵雍所创，以万物皆可起卦为核心理念。时间、数字、文字、外应均可起卦。以体用生克断吉凶，体为主，用为事，体克用则吉，用克体则凶。外应占是梅花独有之法——占卦时偶然所见所闻皆为卦象的一部分。"
      classics={[
        '《梅花易数》——邵雍（易数最高成就）★★★★★',
        '《邵子易数》★★★★★',
        '《皇极经世书》——邵雍（先天易学总纲）★★★★★',
        '《击壤集》——邵雍 ★★★★',
        '《梅花心易》★★★★',
        '《梅花易数秘传》★★★★',
      ]}
    />
  );
}
