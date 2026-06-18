'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function XiangxueClassicsPage() {
  return (
    <ClassicDetailPage
      title="相学典籍"
      icon="👁️"
      totalCount="~710部"
      existingCount="~600部"
      lostCount="~110部"
      sections={[
        { title: '面相核心', rating: '★★★★★ 必读核心', books: [
          { title: '《麻衣神相》', author: '麻衣道者', rating: 5, desc: '相学经典，面相总纲' },
          { title: '《冰鉴》', author: '曾国藩', rating: 5, desc: '识人神作' },
          { title: '《神相全编》', author: '陈抟', rating: 5, desc: '面相百科' },
          { title: '《神相铁关刀》', author: undefined, rating: 5, desc: '实战面相' },
          { title: '《柳庄相法》', author: '袁珙', rating: 5, desc: '明代相学' },
          { title: '《太清神鉴》', author: '刘伯温', rating: 5, desc: '刘伯温相学' },
          { title: '《相理衡真》', author: '陈抟', rating: 4, desc: '相理正宗' },
        ]},
        { title: '手相', rating: '★★★★ 重要', books: [
          { title: '《掌中诀》', author: undefined, rating: 4, desc: '手相经典' },
          { title: '《手纹学》', author: undefined, rating: 4, desc: '手纹解读' },
          { title: '《掌相学》', author: undefined, rating: 4, desc: '掌相体系' },
        ]},
        { title: '姓名学', rating: '★★★★ 重要', books: [
          { title: '《五格剖象》', author: undefined, rating: 4, desc: '姓名学基础' },
          { title: '《姓名与人生》', author: undefined, rating: 4, desc: '姓名测算' },
        ]},
        { title: '其他相法', rating: '★★★ 进阶', books: [
          { title: '《骨相学》', author: undefined, rating: 3, desc: '骨法论命' },
          { title: '测字相', author: undefined, rating: 3, desc: '约20+部' },
          { title: '宅相', author: undefined, rating: 3, desc: '约30+部' },
        ]},
      ]}
    />
  );
}
