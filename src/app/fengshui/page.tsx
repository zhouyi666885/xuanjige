import { DivinationPage } from '@/components/divination-page';

export default function FengshuiPage() {
  return (
    <DivinationPage
      type="fengshui"
      icon="🏔️"
      title="风水地理"
      subtitle="峦头理气·阳宅"
      placeholder="请描述您的风水问题，例如：我家坐北朝南，大门开在东南方，想问一下今年的风水布局。或者：我想选一套新房，需要注意什么？"
      systemInfo="风水分形势派（峦头）与理气派两大体系。形势派以《葬经》《撼龙经》为宗，看山形水势；理气派以《催官篇》《天玉经》为宗，看飞星方位。阳宅重门主灶，八宅法分东四命西四命，玄空飞星看九宫年运。《黄帝宅经》《阳宅三要》为阳宅经典。"
      classics={[
        '《葬经》——郭璞（风水鼻祖）★★★★★',
        '《撼龙经》——杨筠松（龙脉经典）★★★★★',
        '《青囊奥语》——杨筠松 ★★★★★',
        '《催官篇》——赖布衣 ★★★★★',
        '《阳宅三要》——赵九峰 ★★★★★',
        '《黄帝宅经》★★★★★',
        '《地理辨正》——蒋大鸿 ★★★★',
      ]}
    />
  );
}
