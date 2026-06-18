'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function FengshuiClassicsPage() {
  return (
    <ClassicDetailPage
      title="风水地理典籍"
      icon="🏔️"
      totalCount="~1130部"
      existingCount="~1000部"
      lostCount="~130部"
      sections={[
        { title: '形势派（峦头）', rating: '★★★★★ 必读核心', books: [
          { title: '《葬经》', author: '郭璞', rating: 5, desc: '风水鼻祖，气乘风则散界水则止' },
          { title: '《撼龙经》', author: '杨筠松', rating: 5, desc: '龙脉经典' },
          { title: '《疑龙经》', author: '杨筠松', rating: 5, desc: '寻龙点穴' },
          { title: '《青囊奥语》', author: '杨筠松', rating: 5, desc: '风水秘传' },
          { title: '《雪心赋》', author: '卜则巍', rating: 4, desc: '峦头经典' },
        ]},
        { title: '理气派', rating: '★★★★★ 必读核心', books: [
          { title: '《催官篇》', author: '赖布衣', rating: 5, desc: '理气派核心' },
          { title: '《地理辨正》', author: '蒋大鸿', rating: 5, desc: '玄空飞星经典' },
          { title: '《天玉经》', author: '杨筠松', rating: 5, desc: '玄空总纲' },
          { title: '《地理五诀》', author: '赵九峰', rating: 5, desc: '入门五诀' },
        ]},
        { title: '阳宅', rating: '★★★★★ 必读核心', books: [
          { title: '《阳宅十书》', author: undefined, rating: 5, desc: '阳宅经典' },
          { title: '《阳宅三要》', author: '赵九峰', rating: 5, desc: '门主灶三要' },
          { title: '《黄帝宅经》', author: undefined, rating: 5, desc: '宅经之祖' },
        ]},
      ]}
    />
  );
}
