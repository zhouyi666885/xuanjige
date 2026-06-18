import { DivinationPage } from '@/components/divination-page';

export default function XingmingPage() {
  return (
    <DivinationPage
      type="xingming"
      icon="✍️"
      title="姓名测算"
      subtitle="五格剖象·三才"
      placeholder="请输入您想测算的姓名，例如：张三。也可以说明是男名还是女名，以及想了解的方面。"
      systemInfo="姓名学以五格剖象法为核心，分析天格、人格、地格、外格、总格的数理吉凶，配合三才（天、人、地）五行生克关系论断。《姓名学》各派基础，五格配三才，数理定吉凶。姓名学是最容易入门的术数，不需要出生信息即可测算。"
      classics={[
        '《姓名学》——各派基础 ★★★★',
        '《五格剖象》★★★★',
        '《姓名预测》★★★',
        '《姓名与人生》★★★',
      ]}
    />
  );
}
