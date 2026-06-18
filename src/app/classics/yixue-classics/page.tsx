'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function YixueClassicsPage() {
  return (
    <ClassicDetailPage
      title="易学系统典籍"
      icon="☯️"
      totalCount="~2270部"
      existingCount="~2000部"
      lostCount="~270部"
      sections={[
        { title: '三易', rating: '★★★★★ 必读核心', books: [
          { title: '《连山》', author: undefined, rating: 5, desc: '夏易（亡佚，仅存辑佚本），艮卦为首' },
          { title: '《归藏》', author: undefined, rating: 5, desc: '商易（亡佚，仅存辑佚本），坤卦为首' },
          { title: '《周易》', author: undefined, rating: 5, desc: '完整存世，全部经传，万术之源' },
        ]},
        { title: '历代注本', rating: '★★★★★ 必读', books: [
          { title: '《周易正义》', author: '王弼/韩康伯注 孔颖达疏', rating: 5, desc: '唐代官定' },
          { title: '《周易本义》', author: '朱熹', rating: 5, desc: '宋代理学易' },
          { title: '《伊川易传》', author: '程颐', rating: 5, desc: '义理派经典' },
          { title: '《周易集注》', author: '来知德', rating: 5, desc: '象数派经典' },
          { title: '《周易内传》', author: '王夫之', rating: 5, desc: '明清集大成' },
          { title: '《东坡易传》', author: '苏轼', rating: 4, desc: '文人解易' },
        ]},
        { title: '易图学', rating: '★★★★★ 核心', books: [
          { title: '河图', author: undefined, rating: 5, desc: '天地生成之数' },
          { title: '洛书', author: undefined, rating: 5, desc: '九宫飞布之源' },
          { title: '太极图', author: '周敦颐', rating: 5, desc: '宇宙生成论' },
          { title: '先天八卦方位图', author: '伏羲', rating: 5, desc: '先天之学' },
          { title: '后天八卦方位图', author: '文王', rating: 5, desc: '后天之用' },
        ]},
      ]}
    />
  );
}
