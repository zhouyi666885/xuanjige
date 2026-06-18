'use client';

import Link from 'next/link';

interface ClassicCategory {
  icon: string;
  name: string;
  count: string;
  desc: string;
  highlights: string[];
  href: string;
}

const theologyCategories: ClassicCategory[] = [
  {
    icon: '🏛️',
    name: '中国本土神学',
    count: '~3500部',
    desc: '天命论、天道、祭祀与天神系统',
    highlights: ['《尚书》', '《易经》', '《道德真经》', '《南华真经》', '《传习录》', '《太上感应篇》'],
    href: '/classics/chinese-theology',
  },
  {
    icon: '☸️',
    name: '佛教神学',
    count: '~2500部',
    desc: '本尊神学、佛学神义论、藏传佛教',
    highlights: ['《楞严经》', '《华严经》', '《金刚经》', '《菩提道次第广论》', '《中论》'],
    href: '/classics/buddhist-theology',
  },
  {
    icon: '🕉️',
    name: '印度神学',
    count: '~800部',
    desc: '吠檀多、瑜伽、吠陀神学',
    highlights: ['《薄伽梵歌》', '《梵经》', '《奥义书》', '《瑜伽经》'],
    href: '/classics/indian-theology',
  },
  {
    icon: '✝️',
    name: '基督教神学',
    count: '~900部',
    desc: '教父神学、神义论、现代神学',
    highlights: ['《神学大全》', '《忏悔录》', '《约伯记》', '《痛苦的奥秘》'],
    href: '/classics/christian-theology',
  },
  {
    icon: '☪️',
    name: '伊斯兰神学',
    count: '~500部',
    desc: '古兰经、苏菲神秘主义、哲学神学',
    highlights: ['《古兰经》', '伊本·阿拉比全集', '《迷途指津》', '鲁米诗集'],
    href: '/classics/islamic-theology',
  },
  {
    icon: '✡️',
    name: '犹太教神学',
    count: '~400部',
    desc: '塔纳赫、塔木德、卡巴拉',
    highlights: ['《创世记》', '《塔木德》', '《迷途指津》', '《生命之树》'],
    href: '/classics/jewish-theology',
  },
  {
    icon: '🏛️',
    name: '希腊哲学神学',
    count: '~150部',
    desc: '柏拉图、亚里士多德、新柏拉图主义',
    highlights: ['《蒂迈欧篇》', '《形而上学》', '《九章集》'],
    href: '/classics/greek-theology',
  },
  {
    icon: '💭',
    name: '近代哲学神学',
    count: '~150部',
    desc: '斯宾诺莎、康德、黑格尔',
    highlights: ['《神正论》', '《纯粹理性批判》', '《思想录》'],
    href: '/classics/modern-theology',
  },
];

const divinationCategories: ClassicCategory[] = [
  {
    icon: '🔮',
    name: '八字命理',
    count: '~1180部',
    desc: '子平法、格局论、调候论、病药说',
    highlights: ['《渊海子平》', '《三命通会》', '《滴天髓》', '《子平真诠》', '《穷通宝鉴》'],
    href: '/classics/bazi',
  },
  {
    icon: '🎯',
    name: '六爻火珠林',
    count: '~425部',
    desc: '铜钱起卦、用神断事、口诀总汇',
    highlights: ['《火珠林》', '《增删卜易》', '《卜筮正宗》', '《黄金策》'],
    href: '/classics/liuyao',
  },
  {
    icon: '🌀',
    name: '奇门遁甲',
    count: '~530部',
    desc: '九宫八门、转盘飞盘、太乙神数',
    highlights: ['《烟波钓叟赋》', '《奇门遁甲大全》', '《太乙神数》'],
    href: '/classics/qimen',
  },
  {
    icon: '🐉',
    name: '大六壬',
    count: '~430部',
    desc: '四课三传、金口诀、射覆',
    highlights: ['《六壬心镜》', '《六壬断案》', '《六壬指南》', '《六壬毕法赋》'],
    href: '/classics/liuren',
  },
  {
    icon: '🔢',
    name: '铁板神数·梅花易数',
    count: '~500部',
    desc: '铁板批命、梅花心易、皇极经世',
    highlights: ['《铁板神数》', '《梅花易数》', '《皇极经世书》'],
    href: '/classics/tieban-meihua',
  },
  {
    icon: '⭐',
    name: '紫微斗数',
    count: '~1150部',
    desc: '中州派、飞星派、三合派',
    highlights: ['《紫微斗数全书》', '中州派全集', '飞星派全集'],
    href: '/classics/ziwei',
  },
  {
    icon: '🏔️',
    name: '风水地理',
    count: '~1130部',
    desc: '形势派、理气派、阳宅',
    highlights: ['《葬经》', '《撼龙经》', '《阳宅三要》', '《天玉经》'],
    href: '/classics/fengshui',
  },
  {
    icon: '🧘',
    name: '丹道气功',
    count: '~830部',
    desc: '内丹、外丹、导引气功',
    highlights: ['《周易参同契》', '《悟真篇》', '《伍柳仙宗》', '《抱朴子内篇》'],
    href: '/classics/dandao',
  },
  {
    icon: '📜',
    name: '易学系统',
    count: '~2270部',
    desc: '三易、历代注本、易图学',
    highlights: ['《周易》', '《周易正义》', '《周易本义》', '《伊川易传》'],
    href: '/classics/yixue',
  },
  {
    icon: '👤',
    name: '相学',
    count: '~710部',
    desc: '面相、手相、姓名学',
    highlights: ['《麻衣神相》', '《冰鉴》', '《神相全编》', '《太清神鉴》'],
    href: '/classics/xiangxue',
  },
];

export default function ClassicsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-ink/95 backdrop-blur-md border-b border-gold/10">
        <div className="flex items-center gap-3 p-4 max-w-lg mx-auto">
          <Link href="/" className="text-gold/50 hover:text-gold text-lg">←</Link>
          <h1 className="text-gold font-serif font-bold text-lg">经典书房</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {/* Stats */}
        <div className="text-center">
          <div className="text-3xl mb-2">📚</div>
          <h2 className="text-gold font-serif text-xl font-bold">神学与玄学全书单</h2>
          <p className="text-muted-foreground text-sm mt-1">
            共收录 <span className="text-gold font-bold">19,055</span> 部典籍
          </p>
          <div className="flex justify-center gap-6 mt-3 text-xs">
            <div>
              <span className="text-gold font-bold text-lg">15,370</span>
              <p className="text-muted-foreground">存世</p>
            </div>
            <div>
              <span className="text-vermilion font-bold text-lg">5,385</span>
              <p className="text-muted-foreground">亡佚</p>
            </div>
          </div>
        </div>

        {/* Theology Section */}
        <div>
          <h2 className="font-serif text-gold text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            第一部分：神学体系
          </h2>
          <div className="space-y-3">
            {theologyCategories.map((cat) => (
              <div key={cat.name} className="bg-card border border-gold/10 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-foreground font-semibold text-sm">{cat.name}</h3>
                      <span className="text-gold text-xs">{cat.count}</span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">{cat.desc}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {cat.highlights.map((h) => (
                        <span key={h} className="text-[10px] bg-gold/10 text-gold/80 px-2 py-0.5 rounded-full">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Divination Section */}
        <div>
          <h2 className="font-serif text-gold text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-vermilion rounded-full" />
            第二部分：算命玄学体系
          </h2>
          <div className="space-y-3">
            {divinationCategories.map((cat) => (
              <div key={cat.name} className="bg-card border border-gold/10 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-foreground font-semibold text-sm">{cat.name}</h3>
                      <span className="text-gold text-xs">{cat.count}</span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">{cat.desc}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {cat.highlights.map((h) => (
                        <span key={h} className="text-[10px] bg-gold/10 text-gold/80 px-2 py-0.5 rounded-full">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Reading */}
        <div>
          <h2 className="font-serif text-gold text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            入门推荐
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-gold/10 rounded-xl p-3">
              <h3 className="text-gold font-serif text-sm font-bold mb-2">神学入门</h3>
              <div className="space-y-1">
                {['《薄伽梵歌》', '《道德经》', '《周易》', '《金刚经》', '《忏悔录》'].map((b) => (
                  <p key={b} className="text-muted-foreground text-[10px]">{b} ★★★★★</p>
                ))}
              </div>
            </div>
            <div className="bg-card border border-gold/10 rounded-xl p-3">
              <h3 className="text-gold font-serif text-sm font-bold mb-2">命理入门</h3>
              <div className="space-y-1">
                {['《渊海子平》', '《三命通会》', '《滴天髓》', '《梅花易数》', '《麻衣神相》'].map((b) => (
                  <p key={b} className="text-muted-foreground text-[10px]">{b} ★★★★★</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
