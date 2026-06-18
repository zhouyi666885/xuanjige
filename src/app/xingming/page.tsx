import { DivinationPage } from '@/components/divination-page';

export default function XingmingPage() {
  return (
    <DivinationPage
      type="xingming"
      icon="✍️"
      title="姓名测算"
      subtitle="五格剖象·三才配置"
      formType="xingming"
      placeholder="请输入要测算的姓名，如：张三"
      systemInfo="姓名学以五格剖象为核心，计算天格、人格、地格、外格、总格的数理吉凶，配合三才（天人地）五行生克关系论命。笔画数按康熙字典标准计算。姓名不仅影响人际印象，更在数理上与命格产生共振。"
      classics={[
        '《姓名学》——各派基础 ★★★★',
        '《五格剖象》★★★★',
        '《姓名预测》★★★★',
        '《姓名与人生》★★★★',
      ]}
    />
  );
}
