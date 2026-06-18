import { DivinationPage } from '@/components/divination-page';

export default function MeihuaPage() {
  return (
    <DivinationPage
      type="meihua"
      icon="🌸"
      title="梅花易数"
      subtitle="万物起卦·心易"
      placeholder="请描述您想占问的事情，或者直接输入两个数字（如：3 8），也可以描述您看到的外应（如：刚才看到一只鸟飞过）。"
      systemInfo="梅花易数由邵雍先生创立，以万物皆可起卦，心动即占。可以时间、数字、字、外应等起卦，以体用生克断吉凶。《梅花易数》为易数最高成就之一，《皇极经世书》推算元会运世，以129600年为一元的宇宙周期。梅花易数最灵活，零门槛，心有所感即可起卦。"
      classics={[
        '《梅花易数》——邵雍（易数最高成就）★★★★★',
        '《皇极经世书》——邵雍（先天易学总纲）★★★★★',
        '《邵子易数》——邵雍 ★★★★',
        '《击壤集》——邵雍（易理诗学）★★★★',
        '《梅花心易》★★★★',
      ]}
    />
  );
}
