import { DivinationPage } from '@/components/divination-page';

export default function QimenPage() {
  return (
    <DivinationPage
      type="qimen"
      icon="⛩️"
      title="奇门遁甲"
      subtitle="烟波钓叟·九宫排盘"
      formType="qimen"
      placeholder="请输入您要占问的事情和当前时辰，如：明天出差顺利吗？现在是午时"
      systemInfo="奇门遁甲号称帝王之术，以九宫为盘，天盘地盘人盘神盘四层叠布。《烟波钓叟赋》为奇门总纲。分转盘与飞盘两大派系，阴遁阳遁各九局。八门中开休生为三吉，死惊伤为三凶。太乙神数为三式之首，推算国运大格局。"
      classics={[
        '《烟波钓叟赋》（奇门总纲）★★★★★',
        '《奇门遁甲大全》（集大成）★★★★★',
        '《金函玉镜奇门遁甲》——刘伯温注 ★★★★',
        '《奇门遁甲秘笈》★★★★',
        '《太乙神数》★★★★',
        '《奇门旨归》★★★★',
      ]}
    />
  );
}
