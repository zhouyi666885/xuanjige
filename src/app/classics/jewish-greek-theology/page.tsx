'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function JewishGreekTheologyPage() {
  return (
    <ClassicDetailPage
      title="犹太教与希腊哲学神学"
      icon="🕎"
      totalCount="~700部"
      existingCount="~520部"
      lostCount="~1300部"
      sections={[
        { title: '犹太教神学', rating: '★★★★★ 必读核心', books: [
          { title: '《创世记》', author: undefined, rating: 5, desc: '神的创造与拣选' },
          { title: '《出埃及记》', author: undefined, rating: 5, desc: '神的救赎与律法' },
          { title: '《约伯记》', author: undefined, rating: 5, desc: '苦难神义论' },
          { title: '《箴言》', author: undefined, rating: 5, desc: '智慧神学' },
          { title: '《巴比伦塔木德》', author: undefined, rating: 4, desc: '约500+万字，犹太教核心' },
          { title: '《迷途指津》', author: '迈蒙尼德', rating: 4, desc: '理性与信仰' },
          { title: '《光之书》', author: '摩西·纳曼尼', rating: 4, desc: '卡巴拉经典' },
          { title: '《生命之树》', author: '亚伯拉罕·阿布拉菲亚', rating: 4, desc: '卡巴拉冥想' },
        ]},
        { title: '希腊哲学神学', rating: '★★★★★ 必读核心', books: [
          { title: '《蒂迈欧篇》', author: '柏拉图', rating: 5, desc: '造物主意志' },
          { title: '《理想国》', author: '柏拉图', rating: 5, desc: '神与善' },
          { title: '《形而上学》', author: '亚里士多德', rating: 5, desc: '神作为不动的推动者' },
          { title: '《九章集》', author: '普罗提诺', rating: 4, desc: '54篇，新柏拉图主义巅峰' },
        ]},
        { title: '近代哲学神学', rating: '★★★★★ 必读核心', books: [
          { title: '《神学政治论》', author: '斯宾诺莎', rating: 5, desc: '神即自然' },
          { title: '《神正论》', author: '莱布尼茨', rating: 5, desc: '恶的存在与神的正义' },
          { title: '《纯粹理性批判》', author: '康德', rating: 5, desc: '上帝存在证明批判' },
          { title: '《实践理性批判》', author: '康德', rating: 5, desc: '道德与上帝' },
        ]},
      ]}
    />
  );
}
