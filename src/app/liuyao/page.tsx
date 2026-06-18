import { DivinationPage } from '@/components/divination-page';

export default function LiuyaoPage() {
  return (
    <DivinationPage
      type="liuyao"
      icon="🎯"
      title="六爻占卜"
      subtitle="铜钱摇卦·断事"
      placeholder="请描述您想占问的事情，例如：我想问一下最近的工作面试能否通过？或者：我和他/她的感情未来如何发展？"
      systemInfo="六爻占卜源自《火珠林》，以铜钱三枚摇六次成卦，配合日辰、用神、动变、六亲生克断事。《增删卜易》为六爻巅峰之作，《卜筮正宗》集大成，刘伯温《黄金策》为断卦口诀总汇。六爻最擅日常人事占断，一事一占，精准实用。"
      classics={[
        '《火珠林》——麻衣道者（六爻源头）★★★★★',
        '《增删卜易》——野鹤老人（六爻巅峰）★★★★★',
        '《卜筮正宗》——王洪绪（集大成）★★★★★',
        '《黄金策》——刘伯温（断卦口诀）★★★★★',
        '《易林补遗》——张世宝 ★★★★',
        '《易隐》——曹九锡 ★★★★',
      ]}
    />
  );
}
