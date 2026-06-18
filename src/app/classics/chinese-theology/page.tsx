'use client';

import { ClassicDetailPage } from '@/components/classic-detail-page';

export default function ChineseTheologyPage() {
  return (
    <ClassicDetailPage
      title="中国本土神学思想"
      icon="🏛️"
      totalCount="~3500部"
      existingCount="~3000部"
      lostCount="~500部"
      sections={[
        {
          title: '天命论与天道',
          rating: '★★★★★ 必读核心',
          books: [
            { title: '《尚书》', author: undefined, rating: 5, desc: '全部篇章，重点：洪范、康诰、召诰、吕刑等天命篇章' },
            { title: '《诗经》', author: undefined, rating: 5, desc: '全部祈天、咏神、天命诗篇' },
            { title: '《易经》', author: undefined, rating: 5, desc: '系辞传、说卦传、序卦传、杂卦传——天地之道、神明之德' },
            { title: '《礼记》', author: undefined, rating: 5, desc: '全部与祭祀、天命、神明相关章节' },
            { title: '《春秋》三传', author: undefined, rating: 5, desc: '天命与历史' },
            { title: '《周礼》', author: undefined, rating: 5, desc: '祭祀与天神系统' },
            { title: '《尚书正义》', author: '孔颖达', rating: 4, desc: '重要注疏' },
            { title: '《毛诗正义》', author: '孔颖达', rating: 4, desc: '重要注疏' },
            { title: '《周易正义》', author: '孔颖达', rating: 4, desc: '重要注疏' },
          ],
        },
        {
          title: '道教神学',
          rating: '★★★★★ 必读核心',
          books: [
            { title: '《道德真经》', author: '老子', rating: 5, desc: '道的意志、神明之德' },
            { title: '《南华真经》', author: '庄子', rating: 5, desc: '天地精神、真人神游' },
            { title: '《冲虚真经》', author: '列子', rating: 5, desc: '列子御风、神人境界' },
            { title: '《黄帝阴符经》', author: undefined, rating: 5, desc: '天道、神机、阴符' },
            { title: '《太平经》', author: undefined, rating: 5, desc: '天神意志、太平大义' },
            { title: '《抱朴子内篇》', author: '葛洪', rating: 5, desc: '神仙、天神、鬼神意志' },
            { title: '《神仙传》', author: '葛洪', rating: 4, desc: '仙真传记、神力神迹' },
            { title: '《真诰》', author: '陶弘景', rating: 4, desc: '仙真降授、神意传达' },
            { title: '《上清经》', author: undefined, rating: 4, desc: '上清派经典，约36部' },
            { title: '《灵宝经》', author: undefined, rating: 4, desc: '灵宝派经典，约40部' },
          ],
        },
        {
          title: '儒家神学',
          rating: '★★★★★ 必读核心',
          books: [
            { title: '《四书章句集注》', author: '朱熹', rating: 5, desc: '天理、天命之性' },
            { title: '《近思录》', author: '朱熹/吕祖谦', rating: 5, desc: '天理、圣人神化' },
            { title: '《传习录》', author: '王阳明', rating: 5, desc: '良知即天理、心即神明' },
            { title: '《太极图说》', author: '周敦颐', rating: 4, desc: '太极神化、宇宙生成' },
            { title: '《正蒙》', author: '张载', rating: 4, desc: '天命之性、鬼神情状' },
            { title: '《陆九渊集》', author: '陆九渊', rating: 4, desc: '心即理、宇宙即吾心' },
          ],
        },
        {
          title: '中国民间神学',
          rating: '★★★★★ 必读核心',
          books: [
            { title: '《太上感应篇》', author: undefined, rating: 5, desc: '天神监察、因果神助' },
            { title: '《文昌帝君阴骘文》', author: undefined, rating: 5, desc: '文昌神明劝善' },
            { title: '《关帝觉世真经》', author: undefined, rating: 5, desc: '关帝神明意志' },
            { title: '《俞净意公遇灶神记》', author: undefined, rating: 5, desc: '神明直接传意' },
          ],
        },
      ]}
    />
  );
}
