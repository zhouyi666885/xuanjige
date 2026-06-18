'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function DandaoClassicsPage() {
  return (
    <ClassicDetailPage
      title="丹道气功典籍"
      icon="🧘"
      totalCount="~830部"
      existingCount="~500部"
      lostCount="~330部"
      sections={[
        { title: '内丹核心', rating: '★★★★★ 必读核心', books: [
          { title: '《周易参同契》', author: '魏伯阳', rating: 5, desc: '万古丹经王' },
          { title: '《悟真篇》', author: '张伯端', rating: 5, desc: '内丹经典，数十种注本' },
          { title: '《钟吕传道集》', author: '钟离权/吕洞宾', rating: 5, desc: '钟吕丹法' },
          { title: '《灵宝毕法》', author: '钟离权', rating: 5, desc: '丹法体系' },
          { title: '《入药镜》', author: '崔希范', rating: 5, desc: '筑基经典' },
          { title: '《伍柳仙宗》', author: '伍冲虚/柳华阳', rating: 4, desc: '伍柳派代表作' },
          { title: '《张三丰全集》', author: '张三丰', rating: 4, desc: '三丰派丹法' },
        ]},
        { title: '南宗', rating: '★★★★ 重要', books: [
          { title: '《悟真篇》', author: '张伯端', rating: 5, desc: '南宗祖经' },
          { title: '《白玉蟾全集》', author: '白玉蟾', rating: 4, desc: '南宗五祖' },
        ]},
        { title: '北宗', rating: '★★★★ 重要', books: [
          { title: '《重阳全真集》', author: '王重阳', rating: 4, desc: '北宗祖经' },
          { title: '《大丹直指》', author: '丘处机', rating: 4, desc: '龙门派丹法' },
        ]},
        { title: '导引气功', rating: '★★★ 进阶', books: [
          { title: '《养性延命录》', author: '陶弘景', rating: 4, desc: '导引养生经典' },
          { title: '《八段锦》', author: undefined, rating: 3, desc: '导引功法' },
          { title: '《五禽戏》', author: undefined, rating: 3, desc: '华佗创编' },
          { title: '《易筋经》', author: undefined, rating: 3, desc: '少林功法' },
        ]},
      ]}
    />
  );
}
