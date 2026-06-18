'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function ChristianTheologyPage() {
  return (
    <ClassicDetailPage
      title="基督教神学"
      icon="✝️"
      totalCount="~900部"
      existingCount="~800部"
      lostCount="~1500部"
      sections={[
        { title: '教父神学', rating: '★★★★★ 必读核心', books: [
          { title: '《上帝之城》', author: '奥古斯丁', rating: 5, desc: '教父神学最高成就之一' },
          { title: '《忏悔录》', author: '奥古斯丁', rating: 5, desc: '西方自传文学与神学经典' },
          { title: '《论三位一体》', author: '奥古斯丁', rating: 5, desc: '三位一体教义奠基' },
          { title: '《神学大全》', author: '托马斯·阿奎那', rating: 5, desc: '17卷，中世纪神学最高成就' },
          { title: '《反异教大全》', author: '托马斯·阿奎那', rating: 4, desc: '理性与信仰' },
        ]},
        { title: '神义论', rating: '★★★★★ 必读核心', books: [
          { title: '《约伯记》', author: undefined, rating: 5, desc: '西方神义论最高经典' },
          { title: '《诗篇》', author: undefined, rating: 5, desc: '神的回应与赞美' },
          { title: '《以赛亚书》', author: undefined, rating: 5, desc: '弥赛亚预言' },
          { title: '《神正论》', author: '莱布尼茨', rating: 5, desc: '恶的存在与神的正义' },
        ]},
        { title: '现代神学', rating: '★★★★★ 必读核心', books: [
          { title: '《痛苦的奥秘》', author: 'C.S.路易斯', rating: 5, desc: '现代神学经典' },
          { title: '《系统神学》', author: '保罗·蒂利希', rating: 5, desc: '4卷，现代系统神学' },
          { title: '《教会教义学》', author: '卡尔·巴特', rating: 5, desc: '14卷，新正统神学' },
          { title: '《恐惧与战栗》', author: '祁克果', rating: 5, desc: '信仰的焦虑' },
          { title: '《思想录》', author: '帕斯卡', rating: 5, desc: '信仰与理性的赌注' },
        ]},
      ]}
    />
  );
}
