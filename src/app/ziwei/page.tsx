import { DivinationPage } from '@/components/divination-page';

export default function ZiweiPage() {
  return (
    <DivinationPage
      type="ziwei"
      icon="⭐"
      title="紫微斗数"
      subtitle="十二宫·星曜"
      placeholder="请输入您的出生日期和时间（需要精确到时辰），以及性别。例如：1990年6月15日 下午3点 男。也可以直接描述您想了解的方面。"
      systemInfo="紫微斗数传为陈抟（陈希夷）所创，以出生时辰排十二宫命盘，配百颗星曜论命。十二宫涵盖命、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、官禄、田宅、福德、父母。四化（禄权科忌）为紫微灵魂，飞星派重动态推演，中州派重星性组合，三合派重格局论断。"
      classics={[
        '《紫微斗数全书》——陈抟/陈希夷（奠基之作）★★★★★',
        '《紫微斗数三合大全》★★★★★',
        '中州派全集——王亭之 ★★★★★',
        '飞星紫微斗数——梁若瑜 ★★★★★',
        '紫云紫微系列 ★★★★',
      ]}
    />
  );
}
