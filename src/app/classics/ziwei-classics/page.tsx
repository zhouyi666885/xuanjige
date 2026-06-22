'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function ZiweiClassicsPage() {
  return (
    <ClassicDetailPage
      title="紫微斗数典籍"
      icon="⭐"
      totalCount="~1250部"
      existingCount="~1100部"
      lostCount="~50部"
      sections={[
        { title: '古典紫微斗数', rating: '★★★★★ 必读核心', books: [
          { title: '《紫微斗数全书》', author: '陈抟/陈希夷', rating: 5, desc: '紫微斗数奠基之作' },
          { title: '《紫微斗数三合大全》', author: undefined, rating: 4, desc: '三合派经典' },
          { title: '《紫微斗数四化》', author: undefined, rating: 4, desc: '四化论断' },
        ]},
        { title: '中州派', rating: '★★★★★ 必读', books: [
          { title: '《中州派紫微斗数全集》', author: '王亭之', rating: 5, desc: '约30+部，体系最严谨' },
          { title: '《中州派紫微斗数讲义》', author: '王亭之', rating: 5, desc: '入门讲义' },
          { title: '《紫微斗数抉微》', author: '王亭之', rating: 4, desc: '精微论断' },
        ]},
        { title: '飞星派', rating: '★★★★★ 必读', books: [
          { title: '《飞星紫微斗数》', author: '梁若瑜', rating: 5, desc: '约20+部，飞星派代表' },
          { title: '《飞星四化》', author: '梁若瑜', rating: 5, desc: '四化飞星论' },
        ]},
        { title: '台湾名家', rating: '★★★★ 重要', books: [
          { title: '紫云系列', author: '紫云', rating: 4, desc: '约20+部' },
          { title: '许铨仁系列', author: '许铨仁', rating: 4, desc: '约15+部' },
          { title: '潘子渔系列', author: '潘子渔', rating: 4, desc: '约15+部' },
        ]},
      ]}
    />
  );
}
