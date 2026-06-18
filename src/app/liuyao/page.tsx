import { DivinationPage } from '@/components/divination-page';

export default function LiuyaoPage() {
  return (
    <DivinationPage
      type="liuyao"
      icon="🪙"
      title="六爻占卜"
      subtitle="火珠林·铜钱卦"
      placeholder="请输入您要占问的事情，如：我最近能升职吗？感情能复合吗？"
      systemInfo="六爻占卜源自《火珠林》，以铜钱三枚掷六次成卦，配合日辰断吉凶。野鹤老人《增删卜易》为六爻巅峰，王洪绪《卜筮正宗》集大成。断卦以用神为主，看动静生克，旺衰定吉凶。《黄金策》为断卦口诀总汇。"
      classics={[
        '《火珠林》——麻衣道者（六爻源头）★★★★★',
        '《增删卜易》——野鹤老人（六爻巅峰）★★★★★',
        '《卜筮正宗》——王洪绪（集大成）★★★★★',
        '《易林补遗》——张世宝 ★★★★',
        '《黄金策》——刘伯温（断卦口诀）★★★★',
        '《断易天机》★★★★',
        '《易隐》——曹九锡 ★★★★',
      ]}
    />
  );
}
