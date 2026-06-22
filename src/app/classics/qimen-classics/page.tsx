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
          { title: '《奇门遁甲秘笈》', rating: 5, desc: '奇门秘传心法与断局要诀' },
        ]},
        { title: '奇门实战体系', rating: '★★★★ 重要进阶', books: [
          { title: '《奇门遁甲预测学》', rating: 4, desc: '奇门遁甲预测体系，分类预测框架' },
          { title: '《奇门遁甲实例解析》', rating: 4, desc: '奇门遁甲实战案例精解' },
          { title: '《选择求真》', rating: 5, desc: '择日学经典，嫁娶开光动土择吉' },
          { title: '《修财禄法》', rating: 4, desc: '奇门修财禄秘法' },
          { title: '《奇门遁甲开运系列》', rating: 4, desc: '奇门开运方法体系' },
          { title: '《遁甲奇门秘法》', rating: 5, desc: '遁甲奇门不传之秘' },
          { title: '《禽星奇门》', rating: 4, desc: '禽星与奇门合参体系' },
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
