'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function WesternAstrologyClassicsPage() {
  return (
    <ClassicDetailPage
      title="西方占星学典籍"
      icon="🌌"
      totalCount="~200部"
      existingCount="~150部"
      lostCount="~50部"
      sections={[
        { title: '心理占星', rating: '★★★★★ 必读核心', books: [
          { title: '《太阳弧推运》', author: '诺·泰尔 Noel Tyl', rating: 5, desc: '太阳弧推运体系奠基之作' },
          { title: '《命运轮回》', author: '史蒂芬·阿若优', rating: 5, desc: '业力与转世占星' },
          { title: '《心理占星学》', author: '丽兹·格林 Liz Greene', rating: 5, desc: '心理占星学派奠基' },
          { title: '《人格占星学》', author: '戴恩·鲁伊尔 Dane Rudhyar', rating: 5, desc: '人本主义占星先驱' },
        ]},
        { title: '预测与卜卦', rating: '★★★★ 重要', books: [
          { title: '《行星与预测》', author: '罗伯特·汉德 Robert Hand', rating: 5, desc: '行星周期与预测技术' },
          { title: '《咨询占星》', author: '苏·汤普金 Sue Tompkins', rating: 4, desc: '占星咨询实务' },
          { title: '《卜卦占星》', author: '霍华德·萨司波塔斯', rating: 4, desc: '卜卦占星体系' },
          { title: '《预测占星》', author: '伯妮丝·弗里德曼', rating: 4, desc: '预测技术精要' },
        ]},
        { title: '择日与时辰', rating: '★★★ 进阶', books: [
          { title: '《择日占星》', author: '克里斯汀娜·坎贝尔', rating: 4, desc: '择日占星方法' },
          { title: '《时辰卜卦占星》', author: '艾伦·利奥', rating: 4, desc: '时辰占星经典' },
        ]},
      ]}
    />
  );
}
