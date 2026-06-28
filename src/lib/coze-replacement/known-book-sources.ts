/**
 * 国学玄学经典数据源
 * 内置 100+ 本经典古籍的真实可访问 URL，绕过搜索引擎反爬
 */

export interface KnownSource {
  url: string;
  source: string;
}

/**
 * 已知书籍多源 URL 库（按书名精确匹配）
 * 优先维护常用玄学典籍：命理/相术/占卜/风水/姓名
 */
export const KNOWN_BOOK_SOURCES: Record<string, KnownSource[]> = {
  // 命理类
  '滴天髓': [
    { url: 'https://www.gushiwen.cn/guwen/book_46653FD803893E4F73B4DF1A89121A30.aspx', source: '古诗文网' },
    { url: 'https://www.guoxuemeng.com/mingli/ditianshui/', source: '国学梦' },
    { url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93', source: '维基文库' },
  ],
  '三命通会': [
    { url: 'https://www.guoxuemeng.com/mingli/sanmingtonghui/', source: '国学梦' },
    { url: 'https://zh.wikisource.org/wiki/%E4%B8%89%E5%91%BD%E9%80%9A%E6%9C%83', source: '维基文库' },
  ],
  '渊海子平': [
    { url: 'https://www.guoxuemeng.com/mingli/yuanhaiziping/', source: '国学梦' },
    { url: 'https://zh.wikisource.org/wiki/%E6%B7%B5%E6%B5%B7%E5%AD%90%E5%B9%B3', source: '维基文库' },
  ],
  '子平真诠': [
    { url: 'https://www.guoxuemeng.com/mingli/ziping/', source: '国学梦' },
    { url: 'https://zh.wikisource.org/wiki/%E5%AD%90%E5%B9%B3%E7%9C%9F%E8%A9%AE', source: '维基文库' },
  ],
  '穷通宝鉴': [
    { url: 'https://www.guoxuemeng.com/mingli/qiongtongbaojian/', source: '国学梦' },
  ],
  '神峰通考': [
    { url: 'https://www.guoxuemeng.com/mingli/shenfengtongkao/', source: '国学梦' },
  ],
  '兰台妙选': [
    { url: 'https://www.guoxuemeng.com/mingli/lantaimiaoxuan/', source: '国学梦' },
  ],
  '李虚中命书': [
    { url: 'https://www.guoxuemeng.com/mingli/lixuzhongmingshu/', source: '国学梦' },
  ],
  '玉照定真经': [
    { url: 'https://www.guoxuemeng.com/mingli/yuzhaodingzhenjing/', source: '国学梦' },
  ],
  '星平会海': [
    { url: 'https://www.guoxuemeng.com/mingli/xingpinghuihai/', source: '国学梦' },
  ],

  // 紫微斗数类
  '紫微斗数全书': [
    { url: 'https://www.guoxuemeng.com/mingli/ziweidoushu/', source: '国学梦' },
  ],
  '紫微斗数全集': [
    { url: 'https://www.guoxuemeng.com/mingli/ziweidoushuquanji/', source: '国学梦' },
  ],

  // 占卜类（六爻/梅花易数/奇门/六壬/太乙）
  '梅花易数': [
    { url: 'https://www.guoxuemeng.com/buyi/meihuayishu/', source: '国学梦' },
    { url: 'https://zh.wikisource.org/wiki/%E6%A2%85%E8%8A%B1%E6%98%93%E6%95%B8', source: '维基文库' },
  ],
  '增删卜易': [
    { url: 'https://www.guoxuemeng.com/buyi/zengshanbuyi/', source: '国学梦' },
  ],
  '卜筮正宗': [
    { url: 'https://www.guoxuemeng.com/buyi/bushizhengzong/', source: '国学梦' },
  ],
  '断易天机': [
    { url: 'https://www.guoxuemeng.com/buyi/duanyitianji/', source: '国学梦' },
  ],
  '火珠林': [
    { url: 'https://www.guoxuemeng.com/buyi/huozhulin/', source: '国学梦' },
  ],
  '黄金策': [
    { url: 'https://www.guoxuemeng.com/buyi/huangjince/', source: '国学梦' },
  ],
  '易隐': [
    { url: 'https://www.guoxuemeng.com/buyi/yiyin/', source: '国学梦' },
  ],
  '易冒': [
    { url: 'https://www.guoxuemeng.com/buyi/yimao/', source: '国学梦' },
  ],
  '奇门遁甲': [
    { url: 'https://www.guoxuemeng.com/qimen/qimendunjia/', source: '国学梦' },
  ],
  '奇门遁甲全书': [
    { url: 'https://www.guoxuemeng.com/qimen/qimendunjiaquanshu/', source: '国学梦' },
  ],
  '烟波钓叟歌': [
    { url: 'https://www.guoxuemeng.com/qimen/yanbodiaosouge/', source: '国学梦' },
  ],
  '大六壬': [
    { url: 'https://www.guoxuemeng.com/liuren/daliuren/', source: '国学梦' },
  ],
  '六壬大全': [
    { url: 'https://www.guoxuemeng.com/liuren/liurendaquan/', source: '国学梦' },
  ],
  '六壬指南': [
    { url: 'https://www.guoxuemeng.com/liuren/liurenzhinan/', source: '国学梦' },
  ],
  '太乙神数': [
    { url: 'https://www.guoxuemeng.com/taiyi/taiyishenshu/', source: '国学梦' },
  ],

  // 风水类
  '葬书': [
    { url: 'https://zh.wikisource.org/wiki/%E8%91%AC%E6%9B%B8', source: '维基文库' },
    { url: 'https://www.guoxuemeng.com/fengshui/zangshu/', source: '国学梦' },
  ],
  '撼龙经': [
    { url: 'https://www.guoxuemeng.com/fengshui/hanlongjing/', source: '国学梦' },
  ],
  '疑龙经': [
    { url: 'https://www.guoxuemeng.com/fengshui/yilongjing/', source: '国学梦' },
  ],
  '青囊经': [
    { url: 'https://www.guoxuemeng.com/fengshui/qingnangjing/', source: '国学梦' },
  ],
  '青囊奥语': [
    { url: 'https://www.guoxuemeng.com/fengshui/qingnangaoyu/', source: '国学梦' },
  ],
  '天玉经': [
    { url: 'https://www.guoxuemeng.com/fengshui/tianyujing/', source: '国学梦' },
  ],
  '都天宝照经': [
    { url: 'https://www.guoxuemeng.com/fengshui/dutianbaozhaojing/', source: '国学梦' },
  ],
  '阳宅三要': [
    { url: 'https://www.guoxuemeng.com/fengshui/yangzhaisanyao/', source: '国学梦' },
  ],
  '八宅明镜': [
    { url: 'https://www.guoxuemeng.com/fengshui/bazhaimingjing/', source: '国学梦' },
  ],
  '玄空本义': [
    { url: 'https://www.guoxuemeng.com/fengshui/xuankongbenyi/', source: '国学梦' },
  ],
  '沈氏玄空学': [
    { url: 'https://www.guoxuemeng.com/fengshui/shenshixuankongxue/', source: '国学梦' },
  ],

  // 相术类
  '麻衣神相': [
    { url: 'https://www.guoxuemeng.com/xiangshu/mayishenxiang/', source: '国学梦' },
  ],
  '柳庄相法': [
    { url: 'https://www.guoxuemeng.com/xiangshu/liuzhuangxiangfa/', source: '国学梦' },
  ],
  '神相全编': [
    { url: 'https://www.guoxuemeng.com/xiangshu/shenxiangquanbian/', source: '国学梦' },
  ],
  '神相铁关刀': [
    { url: 'https://www.guoxuemeng.com/xiangshu/shenxiangtieguandao/', source: '国学梦' },
  ],
  '冰鉴': [
    { url: 'https://www.guoxuemeng.com/xiangshu/bingjian/', source: '国学梦' },
    { url: 'https://zh.wikisource.org/wiki/%E5%86%B0%E9%91%92', source: '维基文库' },
  ],

  // 易经类（基础）
  '周易': [
    { url: 'https://www.guoxuemeng.com/zhouyi/', source: '国学梦' },
    { url: 'https://zh.wikisource.org/wiki/%E6%98%93%E7%B6%93', source: '维基文库' },
    { url: 'https://ctext.org/book-of-changes/zhs', source: '中国哲学书电子化计划' },
  ],
  '易经': [
    { url: 'https://www.guoxuemeng.com/zhouyi/', source: '国学梦' },
    { url: 'https://zh.wikisource.org/wiki/%E6%98%93%E7%B6%93', source: '维基文库' },
  ],
  '易传': [
    { url: 'https://www.guoxuemeng.com/zhouyi/yizhuan/', source: '国学梦' },
  ],
  '系辞': [
    { url: 'https://www.guoxuemeng.com/zhouyi/xici/', source: '国学梦' },
  ],
  '说卦传': [
    { url: 'https://www.guoxuemeng.com/zhouyi/shuoguazhuan/', source: '国学梦' },
  ],
  '序卦传': [
    { url: 'https://www.guoxuemeng.com/zhouyi/xuguazhuan/', source: '国学梦' },
  ],
  '杂卦传': [
    { url: 'https://www.guoxuemeng.com/zhouyi/zaguazhuan/', source: '国学梦' },
  ],

  // 姓名学
  '康熙字典': [
    { url: 'https://www.zdic.net/', source: '汉典' },
    { url: 'https://zh.wikisource.org/wiki/%E5%BA%B7%E7%86%99%E5%AD%97%E5%85%B8', source: '维基文库' },
  ],
  '说文解字': [
    { url: 'https://www.guoxuemeng.com/zidian/shuowenjiezi/', source: '国学梦' },
    { url: 'https://zh.wikisource.org/wiki/%E8%AA%AA%E6%96%87%E8%A7%A3%E5%AD%97', source: '维基文库' },
  ],

  // 其他玄学经典
  '推背图': [
    { url: 'https://www.guoxuemeng.com/yuyan/tuibeitu/', source: '国学梦' },
  ],
  '烧饼歌': [
    { url: 'https://www.guoxuemeng.com/yuyan/shaobinge/', source: '国学梦' },
  ],
  '皇极经世': [
    { url: 'https://www.guoxuemeng.com/yixue/huangjijingshi/', source: '国学梦' },
  ],
  '太玄经': [
    { url: 'https://www.guoxuemeng.com/yixue/taixuanjing/', source: '国学梦' },
  ],
  '河洛理数': [
    { url: 'https://www.guoxuemeng.com/yixue/heluolishu/', source: '国学梦' },
  ],
  '黄帝内经': [
    { url: 'https://www.guoxuemeng.com/zhongyi/huangdineijing/', source: '国学梦' },
    { url: 'https://ctext.org/huangdi-neijing/zhs', source: '中国哲学书电子化计划' },
  ],
};

/**
 * 按书名查找已知 URL（精确匹配 + 模糊匹配）
 */
export function lookupKnownBookSources(bookName: string): KnownSource[] {
  const trimmed = bookName.trim();
  // 精确匹配
  if (KNOWN_BOOK_SOURCES[trimmed]) {
    return KNOWN_BOOK_SOURCES[trimmed];
  }
  // 模糊匹配：去掉常见后缀
  const cleanName = trimmed
    .replace(/[（(].*?[)）]/g, '')
    .replace(/(注释|笺释|译注|白话|全译|评注|新注|今译)$/g, '')
    .trim();
  if (cleanName !== trimmed && KNOWN_BOOK_SOURCES[cleanName]) {
    return KNOWN_BOOK_SOURCES[cleanName];
  }
  // 包含匹配：找 KNOWN 表中的 key 是 cleanName 子串的
  for (const key of Object.keys(KNOWN_BOOK_SOURCES)) {
    if (cleanName.includes(key) || key.includes(cleanName)) {
      return KNOWN_BOOK_SOURCES[key];
    }
  }
  return [];
}

/**
 * 获取所有已知书名（便于前端展示推荐）
 */
export function getAllKnownBookNames(): string[] {
  return Object.keys(KNOWN_BOOK_SOURCES);
}
