'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function IslamicTheologyPage() {
  return (
    <ClassicDetailPage
      title="伊斯兰神学"
      icon="☪️"
      totalCount="~500部"
      existingCount="~400部"
      lostCount="~100部"
      sections={[
        { title: '古兰经与圣训', rating: '★★★★★ 必读核心', books: [
          { title: '《古兰经》', author: undefined, rating: 5, desc: '全部114章，约6236节，真主意志、前定' },
          { title: '《布哈里圣训实录》', author: undefined, rating: 5, desc: '约7563段' },
          { title: '《穆斯林圣训实录》', author: undefined, rating: 5, desc: '约7500段' },
        ]},
        { title: '苏菲神秘主义神学', rating: '★★★★★ 必读核心', books: [
          { title: '《智慧的瑰宝》', author: '伊本·阿拉比', rating: 5, desc: '苏菲神学巅峰' },
          { title: '《麦加的启示》', author: '伊本·阿拉比', rating: 5, desc: '存在单一论' },
          { title: '《迷途指津》', author: '安萨里', rating: 4, desc: '神知与神意' },
          { title: '《宗教学科的苏醒》', author: '安萨里', rating: 4, desc: '伊斯兰教义学总汇' },
        ]},
        { title: '伊斯兰哲学神学', rating: '★★★ 进阶', books: [
          { title: '穆太凯里姆派', author: undefined, rating: 3, desc: '约50+部' },
          { title: '穆尔塔齐赖派', author: undefined, rating: 3, desc: '约50+部' },
          { title: '艾什阿里派', author: undefined, rating: 3, desc: '约50+部' },
        ]},
      ]}
    />
  );
}
