'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function LiurenClassicsPage() {
  return (
    <ClassicDetailPage
      title="大六壬典籍"
      icon="🔱"
      totalCount="~430部"
      existingCount="~400部"
      lostCount="~30部"
      sections={[
        { title: '古典六壬经典', rating: '★★★★★ 必读核心', books: [
          { title: '《六壬心镜》', author: '徐道符', rating: 5, desc: '唐代，六壬奠基之作' },
          { title: '《六壬断案》', author: '邵彦和', rating: 5, desc: '案例经典' },
          { title: '《六壬指南》', author: '陈公献', rating: 5, desc: '明代扛鼎' },
          { title: '《六壬毕法赋》', author: '凌福之', rating: 5, desc: '断法纲领' },
          { title: '《大六壬大全》', author: '郭御青', rating: 4, desc: '六壬百科全书' },
          { title: '《大六壬金口诀》', author: '孙膑', rating: 4, desc: '六壬简化速断法' },
        ]},
        { title: '清代重要著作', rating: '★★★★ 重要', books: [
          { title: '《六壬说约》', author: '张鋐', rating: 4, desc: '清代六壬精要' },
          { title: '《六壬粹言》', author: '刘赤江', rating: 4, desc: '清代集大成' },
          { title: '《壬学琐记》', author: '程树勋', rating: 4, desc: '壬学心得' },
        ]},
        { title: '现代六壬', rating: '★★★ 进阶', books: [
          { title: '《大六壬心源》', rating: 5, desc: '六壬深层心法，课体精微断法' },
          { title: '《大六壬预测学》', rating: 4, desc: '系统化预测方法论，分类预测框架' },
          { title: '《大六壬实战》', rating: 4, desc: '应期判断与流月推算' },
          { title: '《大六壬精解》', rating: 5, desc: '课体断法详解，千案精析' },
          { title: '梁湘润六壬系列', author: '梁湘润', rating: 4, desc: '约10+部' },
          { title: '秦新星六壬系列', author: '秦新星', rating: 4, desc: '约10+部' },
        ]},
      ]}
    />
  );
}
