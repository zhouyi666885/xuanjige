'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function LiuyaoClassicsPage() {
  return (
    <ClassicDetailPage
      title="六爻火珠林典籍"
      icon="🔮"
      totalCount="~425部"
      existingCount="~400部"
      lostCount="~25部"
      sections={[
        { title: '古典六爻经典', rating: '★★★★★ 必读核心', books: [
          { title: '《火珠林》', author: '麻衣道者', rating: 5, desc: '六爻源头，卜筮之宗' },
          { title: '《增删卜易》', author: '野鹤老人', rating: 5, desc: '六爻巅峰，最实用' },
          { title: '《卜筮正宗》', author: '王洪绪', rating: 5, desc: '清代集大成' },
          { title: '《黄金策》', author: '刘伯温', rating: 4, desc: '断卦口诀总汇' },
          { title: '《易林补遗》', author: '张世宝', rating: 4, desc: '六爻重要典籍' },
          { title: '《易隐》', author: '曹九锡', rating: 4, desc: '精细断法' },
          { title: '《易冒》', author: '程良玉', rating: 4, desc: '清代重要著作' },
        ]},
        { title: '现代六爻', rating: '★★★ 进阶', books: [
          { title: '邵伟华六爻系列', author: '邵伟华', rating: 4, desc: '约10+部' },
          { title: '王虎应六爻系列', author: '王虎应', rating: 4, desc: '约15+部' },
          { title: '朱辰彬六爻系列', author: '朱辰彬', rating: 4, desc: '约10+部' },
        ]},
      ]}
    />
  );
}
