'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function QizhengClassicsPage() {
  return (
    <ClassicDetailPage
      title="七政四余/星命学典籍"
      icon="🌟"
      totalCount="~200部"
      existingCount="~120部"
      lostCount="~80部"
      sections={[
        { title: '核心经典', rating: '★★★★★ 必读核心', books: [
          { title: '《果老星宗》', author: '果老', rating: 5, desc: '七政四余体系总纲，星命学鼻祖' },
          { title: '《七政四余》', author: undefined, rating: 5, desc: '七政四余推命法' },
          { title: '《二十八宿论命》', author: undefined, rating: 5, desc: '星宿论命体系' },
        ]},
        { title: '星命学延伸', rating: '★★★★ 重要', books: [
          { title: '《皇极经世》', author: '邵雍', rating: 5, desc: '先天象数推演' },
          { title: '《太乙神数》', author: undefined, rating: 4, desc: '太乙推演术' },
          { title: '《河洛理数》', author: undefined, rating: 4, desc: '河图洛书推命' },
        ]},
        { title: '天文历算', rating: '★★★ 进阶', books: [
          { title: '《星学大成》', author: '万民英', rating: 4, desc: '星学百科全书' },
          { title: '《天文秘旨》', author: undefined, rating: 3, desc: '天文与命理' },
        ]},
      ]}
    />
  );
}
