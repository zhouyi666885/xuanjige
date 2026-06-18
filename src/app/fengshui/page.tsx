import { DivinationPage } from '@/components/divination-page';

export default function FengshuiPage() {
  return (
    <DivinationPage
      type="fengshui"
      icon="🏔️"
      title="风水地理"
      subtitle="峦头理气·阳宅阴宅"
      placeholder="请描述您的房屋情况，如：坐北朝南的住宅，客厅在正中，卧室在东南，问整体风水"
      systemInfo="风水分形势派（峦头）与理气派。形势派以《葬经》《撼龙经》为本，看山形水势；理气派以《催官篇》《玄空飞星》为本，看方位气运。阳宅以《阳宅三要》门主灶为核心。八宅法分东四命西四命，玄空法以九星飞布论吉凶。"
      classics={[
        '《葬经》——郭璞（风水鼻祖）★★★★★',
        '《撼龙经》——杨筠松（龙脉经典）★★★★★',
        '《青囊奥语》——杨筠松 ★★★★★',
        '《催官篇》——赖布衣 ★★★★★',
        '《地理辨正》——蒋大鸿 ★★★★★',
        '《阳宅三要》——赵九峰 ★★★★★',
        '《天玉经》——杨筠松 ★★★★',
        '《黄帝宅经》★★★★',
      ]}
    />
  );
}
