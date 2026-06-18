import { DivinationPage } from '@/components/divination-page';

export default function QimenPage() {
  return (
    <DivinationPage
      type="qimen"
      icon="🌀"
      title="奇门遁甲"
      subtitle="九宫八门·三奇"
      placeholder="请描述您想占问的事情，以及大致时间（如：今天下午3点想问...）。奇门遁甲注重时辰，请尽量提供具体时间。"
      systemInfo="奇门遁甲号称「帝王之术」，以九宫为盘，配三奇六仪、八门九星八神。《烟波钓叟赋》为奇门总纲。分转盘奇门与飞盘奇门两大派，又分阳遁阴遁。八门中开休生为三吉门，死惊伤为三凶门，杜景中平。奇门最擅择时择方，自古用于军事决策。"
      classics={[
        '《烟波钓叟赋》（奇门总纲）★★★★★',
        '《奇门遁甲大全》（集大成）★★★★★',
        '《金函玉镜奇门遁甲》——刘伯温注 ★★★★',
        '《太乙神数》★★★★',
        '《奇门旨归》★★★★',
      ]}
    />
  );
}
