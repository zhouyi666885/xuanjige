'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function BuddhistTheologyPage() {
  return (
    <ClassicDetailPage
      title="佛教神学"
      icon="☸️"
      totalCount="~2500部"
      existingCount="~2000部"
      lostCount="~1800部"
      sections={[
        {
          title: '本尊神学',
          rating: '★★★★★ 必读核心',
          books: [
            { title: '《地藏菩萨本愿经》', author: undefined, rating: 5, desc: '地藏愿力' },
            { title: '《大方广佛华严经》', author: undefined, rating: 5, desc: '诸佛菩萨神力不可思议' },
            { title: '《妙法莲华经》', author: undefined, rating: 5, desc: '佛力神通' },
            { title: '《大佛顶首楞严经》', author: undefined, rating: 5, desc: '神通与神明守护' },
            { title: '《观世音菩萨普门品》', author: undefined, rating: 5, desc: '观音寻声救苦' },
            { title: '《药师琉璃光如来本愿功德经》', author: undefined, rating: 5, desc: '药师佛愿力' },
            { title: '《阿弥陀经》', author: undefined, rating: 5, desc: '阿弥陀佛愿力' },
            { title: '《大日经》', author: undefined, rating: 5, desc: '大日如来神力' },
            { title: '《金刚顶经》', author: undefined, rating: 5, desc: '密宗本尊神力' },
          ],
        },
        {
          title: '佛学神义论',
          rating: '★★★★★ 必读核心',
          books: [
            { title: '《瑜伽师地论》', author: undefined, rating: 5, desc: '100卷，菩萨地神变神通' },
            { title: '《成唯识论》', author: undefined, rating: 5, desc: '10卷，神识系统' },
            { title: '《中论》', author: undefined, rating: 5, desc: '4卷，缘起性空、破神创论' },
            { title: '《大智度论》', author: undefined, rating: 5, desc: '100卷，神通、神力' },
            { title: '《释量论》', author: undefined, rating: 5, desc: '神明存在论' },
          ],
        },
        {
          title: '藏传佛教神学',
          rating: '★★★★★ 必读核心',
          books: [
            { title: '《菩提道次第广论》', author: '宗喀巴', rating: 5, desc: '上师瑜伽、本尊瑜伽' },
            { title: '《密宗道次第广论》', author: '宗喀巴', rating: 5, desc: '本尊神力加持' },
          ],
        },
        {
          title: '藏密重要经典',
          rating: '★★★★ 重要经典',
          books: [
            { title: '《大手印系列》', author: '噶举派', rating: 4, desc: '约50+部' },
            { title: '《大圆满系列》', author: '宁玛派', rating: 4, desc: '约100+部' },
            { title: '《时轮金刚续》', author: undefined, rating: 4, desc: '约30+部' },
            { title: '《喜金刚续》', author: undefined, rating: 4, desc: '约20+部' },
            { title: '《胜乐金刚续》', author: undefined, rating: 4, desc: '约20+部' },
          ],
        },
      ]}
    />
  );
}
