'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function IndianTheologyPage() {
  return (
    <ClassicDetailPage
      title="印度神学"
      icon="🪷"
      totalCount="~800部"
      existingCount="~600部"
      lostCount="~200部"
      sections={[
        { title: '吠檀多神学', rating: '★★★★★ 必读核心', books: [
          { title: '《薄伽梵歌》', author: undefined, rating: 5, desc: '奎师那亲口讲神意，印度教最核心经典' },
          { title: '《梵经》', author: undefined, rating: 5, desc: '吠檀多经，梵的意志、世界产生' },
          { title: '《奥义书》', author: undefined, rating: 5, desc: '全部约108-215部，梵我一如、神的智慧' },
          { title: '《歌者奥义书》', author: undefined, rating: 4, desc: '重要奥义书' },
          { title: '《广林奥义书》', author: undefined, rating: 4, desc: '重要奥义书' },
          { title: '《伊莎奥义书》', author: undefined, rating: 4, desc: '重要奥义书' },
        ]},
        { title: '瑜伽神学', rating: '★★★★★ 必读核心', books: [
          { title: '《瑜伽经》', author: '帕坦加利', rating: 5, desc: '自在天(Ishvara)与修行关系' },
          { title: '《哈他瑜伽之光》', author: '斯瓦特玛拉玛', rating: 4, desc: '重要瑜伽经典' },
        ]},
        { title: '吠陀神学', rating: '★★★ 进阶研究', books: [
          { title: '《梨俱吠陀》', author: undefined, rating: 3, desc: '约1028首赞歌' },
          { title: '《沙摩吠陀》', author: undefined, rating: 3, desc: '约1875首' },
          { title: '《耶柔吠陀》', author: undefined, rating: 3, desc: '约1975首' },
          { title: '《阿闼婆吠陀》', author: undefined, rating: 3, desc: '约730首' },
        ]},
      ]}
    />
  );
}
