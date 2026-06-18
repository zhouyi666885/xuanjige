'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function BaziClassicsPage() {
  return (
    <ClassicDetailPage
      title="八字命理典籍"
      icon="🕐"
      totalCount="~1180部"
      existingCount="~1150部"
      lostCount="~30部"
      sections={[
        { title: '古典必读（大师级）', rating: '★★★★★ 必读核心', books: [
          { title: '《渊海子平》', author: '徐子平/徐升', rating: 5, desc: '子平法奠基，必读第一' },
          { title: '《三命通会》', author: '万民英', rating: 5, desc: '百科全书，工具书' },
          { title: '《滴天髓》', author: '京图/任铁樵注', rating: 5, desc: '命理巅峰，进阶' },
          { title: '《子平真诠》', author: '沈孝瞻', rating: 5, desc: '格局论，入门' },
          { title: '《穷通宝鉴》', author: '余春台', rating: 5, desc: '调候论' },
          { title: '《神峰通考》', author: '张楠', rating: 5, desc: '病药说，实战' },
          { title: '《五行精纪》', author: '廖中', rating: 4, desc: '宋代命理' },
          { title: '《星学大成》', author: '万民英', rating: 4, desc: '星命合编' },
        ]},
        { title: '民国三大家', rating: '★★★★★ 必读', books: [
          { title: '《千里命稿》', author: '韦千里', rating: 5, desc: '文雅精炼，引经据典' },
          { title: '《命理探源》', author: '袁树珊', rating: 5, desc: '中西结合，条理清晰' },
          { title: '《子平真诠评注》', author: '徐乐吾', rating: 5, desc: '重实战，案例丰富' },
          { title: '《滴天髓补注》', author: '徐乐吾', rating: 4, desc: '滴天髓重要注本' },
          { title: '《四柱预测学》', author: '邵伟华', rating: 4, desc: '现代入门经典' },
        ]},
        { title: '当代大家', rating: '★★★★ 重要', books: [
          { title: '《子平命学精论》', author: '梁湘润', rating: 5, desc: '约50+部著作，当代命理集大成' },
          { title: '《中州派紫微斗数全集》', author: '王亭之', rating: 5, desc: '约30+部，体系最严谨' },
          { title: '《飞星紫微斗数》', author: '梁若瑜', rating: 5, desc: '约20+部，飞星派代表' },
        ]},
      ]}
    />
  );
}
