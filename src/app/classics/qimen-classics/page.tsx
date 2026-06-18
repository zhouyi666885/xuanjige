'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function QimenClassicsPage() {
  return (
    <ClassicDetailPage
      title="奇门遁甲典籍"
      icon="🌀"
      totalCount="~530部"
      existingCount="~500部"
      lostCount="~30部"
      sections={[
        { title: '古典奇门经典', rating: '★★★★★ 必读核心', books: [
          { title: '《烟波钓叟赋》', author: undefined, rating: 5, desc: '奇门总纲，起局之源' },
          { title: '《奇门遁甲大全》', author: undefined, rating: 5, desc: '奇门集大成' },
          { title: '《金函玉镜奇门遁甲》', author: '刘伯温注', rating: 5, desc: '刘伯温注解' },
          { title: '《奇门旨归》', author: undefined, rating: 4, desc: '奇门重要古籍' },
          { title: '《太乙神数》', author: undefined, rating: 4, desc: '三式之首，太乙体系' },
        ]},
        { title: '奇门各派', rating: '★★★ 进阶', books: [
          { title: '转盘奇门', author: undefined, rating: 3, desc: '约30+部，天盘旋转' },
          { title: '飞盘奇门', author: undefined, rating: 3, desc: '约20+部，九星飞布' },
          { title: '阴盘奇门', author: undefined, rating: 3, desc: '约15+部' },
          { title: '阳盘奇门', author: undefined, rating: 3, desc: '约15+部' },
        ]},
        { title: '现代奇门', rating: '★★★ 进阶', books: [
          { title: '杜新会奇门系列', author: '杜新会', rating: 4, desc: '约15+部' },
          { title: '张岩奇门系列', author: '张岩', rating: 4, desc: '约10+部' },
        ]},
      ]}
    />
  );
}
