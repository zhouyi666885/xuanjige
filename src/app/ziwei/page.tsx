import { DivinationPage } from '@/components/divination-page';

export default function ZiweiPage() {
  return (
    <DivinationPage
      type="ziwei"
      icon="⭐"
      title="紫微斗数"
      subtitle="十二宫·四化飞星"
      placeholder="请补充您想了解的问题，如事业、感情、健康等。出生信息请在上方表单填写，会自动带入。"
      showBirthForm
      systemInfo="紫微斗数传为陈抟老祖所创，以出生时间安十二宫、布百颗星曜，四化飞星论吉凶。中州派重星性，飞星派重四化，三合格局论格局成败，各派各有精妙。《紫微斗数全书》为奠基之作，王亭之中州派、梁若瑜飞星派为当代大家。"
      classics={[
        '《紫微斗数全书》——陈抟/陈希夷（奠基之作）★★★★★',
        '《紫微斗数三合大全》★★★★★',
        '《中州派紫微斗数全集》——王亭之 ★★★★★',
        '《飞星紫微斗数》——梁若瑜 ★★★★★',
        '《紫微斗数四化》★★★★',
        '《紫微斗数格局》★★★★',
      ]}
    />
  );
}
