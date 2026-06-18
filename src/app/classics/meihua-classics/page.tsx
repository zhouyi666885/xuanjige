'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function MeihuaClassicsPage() {
  return (
    <ClassicDetailPage
      title="梅花易数与铁板神数典籍"
      icon="🌸"
      totalCount="~500部"
      existingCount="~400部"
      lostCount="~115部"
      sections={[
        { title: '梅花易数核心', rating: '★★★★★ 必读核心', books: [
          { title: '《梅花易数》', author: '邵雍', rating: 5, desc: '易数最高成就之一，万物皆可起卦' },
          { title: '《皇极经世书》', author: '邵雍', rating: 5, desc: '先天易学总纲，元会运世' },
          { title: '《邵子易数》', author: '邵雍', rating: 4, desc: '邵雍易数体系' },
          { title: '《击壤集》', author: '邵雍', rating: 4, desc: '易理诗学' },
        ]},
        { title: '铁板神数核心', rating: '★★★★ 重要', books: [
          { title: '《铁板神数》', author: '传邵雍', rating: 4, desc: '铁板批命经典' },
          { title: '《铁板神数考释》', author: '梁湘润', rating: 5, desc: '当代铁板权威' },
          { title: '《铁板神数入门》', author: '梁湘润', rating: 4, desc: '入门必读' },
        ]},
        { title: '皇极经世系列', rating: '★★★ 进阶', books: [
          { title: '《皇极经世解》', author: undefined, rating: 3, desc: '经典注本' },
          { title: '《皇极经世索隐》', author: undefined, rating: 3, desc: '深入解读' },
          { title: '《皇极经世衍义》', author: undefined, rating: 3, desc: '推演衍义' },
        ]},
      ]}
    />
  );
}
