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

  // ===== 命理类扩充 =====
  '滴天髓阐微': [{ url: 'https://www.guoxuemeng.com/mingli/ditianshuichanwei/', source: '国学梦' }],
  '滴天髓征义': [{ url: 'https://www.guoxuemeng.com/mingli/ditianshuizhengyi/', source: '国学梦' }],
  '子平真诠评注': [{ url: 'https://www.guoxuemeng.com/mingli/zipingzhenquanpingzhu/', source: '国学梦' }],
  '命理探源': [{ url: 'https://www.guoxuemeng.com/mingli/minglitanyuan/', source: '国学梦' }],
  '命理约言': [{ url: 'https://www.guoxuemeng.com/mingli/mingliyueyan/', source: '国学梦' }],
  '命理寻源': [{ url: 'https://www.guoxuemeng.com/mingli/minglixunyuan/', source: '国学梦' }],
  '命理须知': [{ url: 'https://www.guoxuemeng.com/mingli/minglixuzhi/', source: '国学梦' }],
  '命学新义': [{ url: 'https://www.guoxuemeng.com/mingli/mingxuexinyi/', source: '国学梦' }],
  '滴天髓辑要': [{ url: 'https://www.guoxuemeng.com/mingli/ditianshuijiyao/', source: '国学梦' }],
  '徐乐吾命理一得': [{ url: 'https://www.guoxuemeng.com/mingli/xuyuwumingliyide/', source: '国学梦' }],
  '滴天髓补注': [{ url: 'https://www.guoxuemeng.com/mingli/ditianshuibuzhu/', source: '国学梦' }],
  '造化元钥': [{ url: 'https://www.guoxuemeng.com/mingli/zaohuayuanyao/', source: '国学梦' }],
  '造化玄钥': [{ url: 'https://www.guoxuemeng.com/mingli/zaohuaxuanyao/', source: '国学梦' }],
  '子平管见': [{ url: 'https://www.guoxuemeng.com/mingli/zipingguanjian/', source: '国学梦' }],
  '子平母法': [{ url: 'https://www.guoxuemeng.com/mingli/zipingmufa/', source: '国学梦' }],
  '子平百章歌': [{ url: 'https://www.guoxuemeng.com/mingli/zipingbaizhangge/', source: '国学梦' }],
  '子平粹言': [{ url: 'https://www.guoxuemeng.com/mingli/zipingcuiyan/', source: '国学梦' }],
  '子平真传': [{ url: 'https://www.guoxuemeng.com/mingli/zipingzhenchuan/', source: '国学梦' }],
  '神峰张楠命理正宗': [{ url: 'https://www.guoxuemeng.com/mingli/shenfengzhangnan/', source: '国学梦' }],
  '玉井奥诀': [{ url: 'https://www.guoxuemeng.com/mingli/yujingaojue/', source: '国学梦' }],
  '渊海子平评注': [{ url: 'https://www.guoxuemeng.com/mingli/yuanhaizipingpingzhu/', source: '国学梦' }],
  '渊源子平': [{ url: 'https://www.guoxuemeng.com/mingli/yuanyuanziping/', source: '国学梦' }],
  '兰台秘选': [{ url: 'https://www.guoxuemeng.com/mingli/lantaimixuan/', source: '国学梦' }],
  '万育吾三命通会': [{ url: 'https://www.guoxuemeng.com/mingli/wanyuwusanmingtonghui/', source: '国学梦' }],
  '三命指迷赋': [{ url: 'https://www.guoxuemeng.com/mingli/sanmingzhimifu/', source: '国学梦' }],
  '三命提要': [{ url: 'https://www.guoxuemeng.com/mingli/sanmingtiyao/', source: '国学梦' }],
  '三命汇通': [{ url: 'https://www.guoxuemeng.com/mingli/sanminghuitong/', source: '国学梦' }],
  '珞琭子三命消息赋': [{ url: 'https://www.guoxuemeng.com/mingli/luoluzisanmingxiaoxifu/', source: '国学梦' }],
  '珞琭子赋': [{ url: 'https://www.guoxuemeng.com/mingli/luoluzifu/', source: '国学梦' }],
  '阴符经': [{ url: 'https://www.guoxuemeng.com/yixue/yinfujing/', source: '国学梦' }],
  '玉门经': [{ url: 'https://www.guoxuemeng.com/mingli/yumenjing/', source: '国学梦' }],
  '玄机赋': [{ url: 'https://www.guoxuemeng.com/mingli/xuanjifu/', source: '国学梦' }],
  '元理赋': [{ url: 'https://www.guoxuemeng.com/mingli/yuanlifu/', source: '国学梦' }],
  '指南赋': [{ url: 'https://www.guoxuemeng.com/mingli/zhinanfu/', source: '国学梦' }],
  '通明赋': [{ url: 'https://www.guoxuemeng.com/mingli/tongmingfu/', source: '国学梦' }],
  '心镜歌': [{ url: 'https://www.guoxuemeng.com/mingli/xinjingge/', source: '国学梦' }],
  '寸金搜髓歌': [{ url: 'https://www.guoxuemeng.com/mingli/cunjinsousuige/', source: '国学梦' }],
  '巫咸撮要歌': [{ url: 'https://www.guoxuemeng.com/mingli/wuxiancuoyaoge/', source: '国学梦' }],
  '醉醒子赋': [{ url: 'https://www.guoxuemeng.com/mingli/zuixingzifu/', source: '国学梦' }],
  '系泉真道': [{ url: 'https://www.guoxuemeng.com/mingli/xiquanzhendao/', source: '国学梦' }],
  '化气十段锦': [{ url: 'https://www.guoxuemeng.com/mingli/huaqishiduanjin/', source: '国学梦' }],
  '透天玄机': [{ url: 'https://www.guoxuemeng.com/mingli/toutianxuanji/', source: '国学梦' }],
  '十干生死诀': [{ url: 'https://www.guoxuemeng.com/mingli/shigansheshijue/', source: '国学梦' }],
  '十干用事歌': [{ url: 'https://www.guoxuemeng.com/mingli/shiganyongshige/', source: '国学梦' }],
  '禄命书': [{ url: 'https://www.guoxuemeng.com/mingli/lumingshu/', source: '国学梦' }],
  '禄命神煞总论': [{ url: 'https://www.guoxuemeng.com/mingli/lumingshenshazonglun/', source: '国学梦' }],
  '神煞详解': [{ url: 'https://www.guoxuemeng.com/mingli/shenshaxiangjie/', source: '国学梦' }],
  '徐子平正解': [{ url: 'https://www.guoxuemeng.com/mingli/xuzipingzhengjie/', source: '国学梦' }],
  '徐乐吾子平粹言': [{ url: 'https://www.guoxuemeng.com/mingli/xuleyuziping/', source: '国学梦' }],
  '袁树珊命理探源': [{ url: 'https://www.guoxuemeng.com/mingli/yuanshushanmingli/', source: '国学梦' }],
  '韦千里命学讲义': [{ url: 'https://www.guoxuemeng.com/mingli/weiqianlimingxue/', source: '国学梦' }],
  '何建忠八字心理推命学': [{ url: 'https://www.guoxuemeng.com/mingli/hejianzhongmingli/', source: '国学梦' }],
  '果老星宗': [{ url: 'https://www.guoxuemeng.com/mingli/guolaoxingzong/', source: '国学梦' }],
  '七政四余': [{ url: 'https://www.guoxuemeng.com/mingli/qizhengsiyu/', source: '国学梦' }],
  '西洋占星术': [{ url: 'https://www.guoxuemeng.com/mingli/xiyangzhanxing/', source: '国学梦' }],
  '玉匣记': [{ url: 'https://www.guoxuemeng.com/mingli/yuxiaji/', source: '国学梦' }],
  '协纪辨方书': [{ url: 'https://www.guoxuemeng.com/mingli/xiejibianfangshu/', source: '国学梦' }],
  '通书': [{ url: 'https://www.guoxuemeng.com/mingli/tongshu/', source: '国学梦' }],
  '万年历': [{ url: 'https://www.guoxuemeng.com/mingli/wannianli/', source: '国学梦' }],
  '诹吉宝鉴': [{ url: 'https://www.guoxuemeng.com/mingli/zoujibaojian/', source: '国学梦' }],

  // ===== 紫微斗数扩充 =====
  '紫微斗数捷览': [{ url: 'https://www.guoxuemeng.com/ziwei/jielan/', source: '国学梦' }],
  '紫微斗数全书评注': [{ url: 'https://www.guoxuemeng.com/ziwei/quanshupingzhu/', source: '国学梦' }],
  '紫微斗数命谱': [{ url: 'https://www.guoxuemeng.com/ziwei/mingpu/', source: '国学梦' }],
  '紫微斗数论命': [{ url: 'https://www.guoxuemeng.com/ziwei/lunming/', source: '国学梦' }],
  '紫微斗数密仪': [{ url: 'https://www.guoxuemeng.com/ziwei/miyi/', source: '国学梦' }],
  '紫微斗数飞星秘仪': [{ url: 'https://www.guoxuemeng.com/ziwei/feixing/', source: '国学梦' }],
  '紫微斗数四化': [{ url: 'https://www.guoxuemeng.com/ziwei/sihua/', source: '国学梦' }],
  '陈希夷紫微斗数': [{ url: 'https://www.guoxuemeng.com/ziwei/chenxiyi/', source: '国学梦' }],
  '太微紫微斗数': [{ url: 'https://www.guoxuemeng.com/ziwei/taiwei/', source: '国学梦' }],
  '钦天监紫微斗数': [{ url: 'https://www.guoxuemeng.com/ziwei/qintianjian/', source: '国学梦' }],

  // ===== 占卜/六爻/易卜扩充 =====
  '六爻精解': [{ url: 'https://www.guoxuemeng.com/buyi/liuyaojingjie/', source: '国学梦' }],
  '京氏易传': [{ url: 'https://www.guoxuemeng.com/buyi/jingshiyichuan/', source: '国学梦' }],
  '焦氏易林': [{ url: 'https://www.guoxuemeng.com/buyi/jiaoshiyilin/', source: '国学梦' }],
  '易林补遗': [{ url: 'https://www.guoxuemeng.com/buyi/yilinbuyi/', source: '国学梦' }],
  '卜筮全书': [{ url: 'https://www.guoxuemeng.com/buyi/bushiquanshu/', source: '国学梦' }],
  '卜筮元龟': [{ url: 'https://www.guoxuemeng.com/buyi/bushiyuangui/', source: '国学梦' }],
  '海底眼': [{ url: 'https://www.guoxuemeng.com/buyi/haidiyan/', source: '国学梦' }],
  '黄金策千金赋': [{ url: 'https://www.guoxuemeng.com/buyi/huangjincequnjinfu/', source: '国学梦' }],
  '增删卜易评注': [{ url: 'https://www.guoxuemeng.com/buyi/zengshanbuyipingzhu/', source: '国学梦' }],
  '易隐评注': [{ url: 'https://www.guoxuemeng.com/buyi/yiyinpingzhu/', source: '国学梦' }],
  '梅花心易': [{ url: 'https://www.guoxuemeng.com/buyi/meihuaxinyi/', source: '国学梦' }],
  '梅花易数评注': [{ url: 'https://www.guoxuemeng.com/buyi/meihuayishupingzhu/', source: '国学梦' }],
  '邵子神数': [{ url: 'https://www.guoxuemeng.com/buyi/shaozishenshu/', source: '国学梦' }],
  '邵康节梅花易数': [{ url: 'https://www.guoxuemeng.com/buyi/shaokangjiemeihua/', source: '国学梦' }],
  '皇极策数': [{ url: 'https://www.guoxuemeng.com/buyi/huangjicheshu/', source: '国学梦' }],
  '皇极数': [{ url: 'https://www.guoxuemeng.com/buyi/huangjishu/', source: '国学梦' }],
  '六爻预测学': [{ url: 'https://www.guoxuemeng.com/buyi/liuyaoyuce/', source: '国学梦' }],
  '六爻断卦秘诀': [{ url: 'https://www.guoxuemeng.com/buyi/duanguamijue/', source: '国学梦' }],
  '六爻神断': [{ url: 'https://www.guoxuemeng.com/buyi/liuyaoshenduan/', source: '国学梦' }],
  '王虎应六爻': [{ url: 'https://www.guoxuemeng.com/buyi/wanghuyingliuyao/', source: '国学梦' }],
  '野鹤老人占卜全书': [{ url: 'https://www.guoxuemeng.com/buyi/yehelaoren/', source: '国学梦' }],
  '京房易占': [{ url: 'https://www.guoxuemeng.com/buyi/jingfangyizhan/', source: '国学梦' }],
  '占卜述要': [{ url: 'https://www.guoxuemeng.com/buyi/zhanbushuyao/', source: '国学梦' }],

  // ===== 奇门遁甲扩充 =====
  '奇门遁甲秘籍大全': [{ url: 'https://www.guoxuemeng.com/qimen/miji/', source: '国学梦' }],
  '奇门遁甲统宗': [{ url: 'https://www.guoxuemeng.com/qimen/tongzong/', source: '国学梦' }],
  '奇门遁甲秘笈': [{ url: 'https://www.guoxuemeng.com/qimen/mijie/', source: '国学梦' }],
  '奇门遁甲元灵经': [{ url: 'https://www.guoxuemeng.com/qimen/yuanlingjing/', source: '国学梦' }],
  '奇门遁甲符应经': [{ url: 'https://www.guoxuemeng.com/qimen/fuyingjing/', source: '国学梦' }],
  '奇门法窍': [{ url: 'https://www.guoxuemeng.com/qimen/faqiao/', source: '国学梦' }],
  '奇门遁甲心法': [{ url: 'https://www.guoxuemeng.com/qimen/xinfa/', source: '国学梦' }],
  '奇门遁甲入门': [{ url: 'https://www.guoxuemeng.com/qimen/rumen/', source: '国学梦' }],
  '奇门测局': [{ url: 'https://www.guoxuemeng.com/qimen/celiu/', source: '国学梦' }],
  '太乙金镜式经': [{ url: 'https://www.guoxuemeng.com/qimen/taiyijinjing/', source: '国学梦' }],
  '太乙淘金歌': [{ url: 'https://www.guoxuemeng.com/qimen/taiyitaojin/', source: '国学梦' }],
  '太乙总论': [{ url: 'https://www.guoxuemeng.com/qimen/taiyizonglun/', source: '国学梦' }],

  // ===== 大六壬扩充 =====
  '六壬秘笈': [{ url: 'https://www.guoxuemeng.com/liuren/miji/', source: '国学梦' }],
  '六壬粹言': [{ url: 'https://www.guoxuemeng.com/liuren/cuiyan/', source: '国学梦' }],
  '六壬寻原': [{ url: 'https://www.guoxuemeng.com/liuren/xunyuan/', source: '国学梦' }],
  '六壬辨疑': [{ url: 'https://www.guoxuemeng.com/liuren/bianyi/', source: '国学梦' }],
  '六壬要旨': [{ url: 'https://www.guoxuemeng.com/liuren/yaozhi/', source: '国学梦' }],
  '六壬课经集': [{ url: 'https://www.guoxuemeng.com/liuren/kejingji/', source: '国学梦' }],
  '六壬玉连环': [{ url: 'https://www.guoxuemeng.com/liuren/yulianhuan/', source: '国学梦' }],
  '毕法赋': [{ url: 'https://www.guoxuemeng.com/liuren/bifafu/', source: '国学梦' }],
  '指南赋六壬': [{ url: 'https://www.guoxuemeng.com/liuren/zhinanfu/', source: '国学梦' }],
  '邵彦和占验': [{ url: 'https://www.guoxuemeng.com/liuren/shaoyanhe/', source: '国学梦' }],
  '袁天罡称骨歌': [{ url: 'https://www.guoxuemeng.com/mingli/yuantiangangchengguge/', source: '国学梦' }],
  '李淳风藏头诗': [{ url: 'https://www.guoxuemeng.com/yuyan/lichunfengcangtoushi/', source: '国学梦' }],

  // ===== 风水类大量扩充 =====
  '地理人子须知': [{ url: 'https://www.guoxuemeng.com/fengshui/renzixuzhi/', source: '国学梦' }, { url: 'https://ctext.org/wiki.pl?if=gb&res=843156', source: 'ctext' }],
  '地理五诀': [{ url: 'https://www.guoxuemeng.com/fengshui/diliwujue/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E5%9C%B0%E7%90%86%E4%BA%94%E8%A8%A3', source: '维基文库' }],
  '地理辨正': [{ url: 'https://www.guoxuemeng.com/fengshui/dilibianzheng/', source: '国学梦' }],
  '地理辨正疏': [{ url: 'https://www.guoxuemeng.com/fengshui/dilibianzhengshu/', source: '国学梦' }],
  '地理大全': [{ url: 'https://www.guoxuemeng.com/fengshui/diliquanshu/', source: '国学梦' }],
  '地理啖蔗录': [{ url: 'https://www.guoxuemeng.com/fengshui/dilidanzhelu/', source: '国学梦' }],
  '地理琢玉斧': [{ url: 'https://www.guoxuemeng.com/fengshui/dilizuoyufu/', source: '国学梦' }],
  '地理铁案': [{ url: 'https://www.guoxuemeng.com/fengshui/dilitiean/', source: '国学梦' }],
  '地理直指': [{ url: 'https://www.guoxuemeng.com/fengshui/dilizhizhi/', source: '国学梦' }],
  '地理水法点穴': [{ url: 'https://www.guoxuemeng.com/fengshui/dilishuifa/', source: '国学梦' }],
  '地理精义': [{ url: 'https://www.guoxuemeng.com/fengshui/dilijingyi/', source: '国学梦' }],
  '地理精蕴': [{ url: 'https://www.guoxuemeng.com/fengshui/dilijingyun/', source: '国学梦' }],
  '地理玄机': [{ url: 'https://www.guoxuemeng.com/fengshui/dilixuanji/', source: '国学梦' }],
  '地理秘旨': [{ url: 'https://www.guoxuemeng.com/fengshui/dilimizhi/', source: '国学梦' }],
  '地理大成': [{ url: 'https://www.guoxuemeng.com/fengshui/dilidacheng/', source: '国学梦' }],
  '地理全书': [{ url: 'https://www.guoxuemeng.com/fengshui/diliquanshu2/', source: '国学梦' }],
  '阳宅集成': [{ url: 'https://www.guoxuemeng.com/fengshui/yangzhaijicheng/', source: '国学梦' }, { url: 'https://ctext.org/wiki.pl?if=gb&res=843200', source: 'ctext' }],
  '阳宅十书': [{ url: 'https://www.guoxuemeng.com/fengshui/yangzhaishishu/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E9%99%BD%E5%AE%85%E5%8D%81%E6%9B%B8', source: '维基文库' }],
  '阳宅大成': [{ url: 'https://www.guoxuemeng.com/fengshui/yangzhaidacheng/', source: '国学梦' }],
  '阳宅大全': [{ url: 'https://www.guoxuemeng.com/fengshui/yangzhaiquanshu/', source: '国学梦' }],
  '阳宅指南': [{ url: 'https://www.guoxuemeng.com/fengshui/yangzhaizhinan/', source: '国学梦' }],
  '阳宅爱众篇': [{ url: 'https://www.guoxuemeng.com/fengshui/yangzhaiaizhong/', source: '国学梦' }],
  '阳宅会心集': [{ url: 'https://www.guoxuemeng.com/fengshui/yangzhaihuixinji/', source: '国学梦' }],
  '阳宅觉': [{ url: 'https://www.guoxuemeng.com/fengshui/yangzhaijue/', source: '国学梦' }],
  '阴宅秘传': [{ url: 'https://www.guoxuemeng.com/fengshui/yinzhaimichuan/', source: '国学梦' }],
  '阴阳宝海': [{ url: 'https://www.guoxuemeng.com/fengshui/yinyangbaohai/', source: '国学梦' }],
  '玄空真解': [{ url: 'https://www.guoxuemeng.com/fengshui/xuankongzhenjie/', source: '国学梦' }],
  '玄空秘旨': [{ url: 'https://www.guoxuemeng.com/fengshui/xuankongmizhi/', source: '国学梦' }],
  '玄空法鉴': [{ url: 'https://www.guoxuemeng.com/fengshui/xuankongfajian/', source: '国学梦' }],
  '玄空大卦秘诀': [{ url: 'https://www.guoxuemeng.com/fengshui/xuankongdaguamijue/', source: '国学梦' }],
  '玄空飞星全书': [{ url: 'https://www.guoxuemeng.com/fengshui/xuankongfeixing/', source: '国学梦' }],
  '玄空紫白诀': [{ url: 'https://www.guoxuemeng.com/fengshui/xuankongzibaijue/', source: '国学梦' }],
  '雪心赋': [{ url: 'https://www.guoxuemeng.com/fengshui/xuexinfu/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E9%9B%AA%E5%BF%83%E8%B3%A6', source: '维基文库' }],
  '入地眼全书': [{ url: 'https://www.guoxuemeng.com/fengshui/rudiyan/', source: '国学梦' }],
  '催官篇': [{ url: 'https://www.guoxuemeng.com/fengshui/cuiguanpian/', source: '国学梦' }],
  '罗经透解': [{ url: 'https://www.guoxuemeng.com/fengshui/luojingtoujie/', source: '国学梦' }],
  '罗经顶门针': [{ url: 'https://www.guoxuemeng.com/fengshui/luojingdingmenzhen/', source: '国学梦' }],
  '罗经解定': [{ url: 'https://www.guoxuemeng.com/fengshui/luojingjieding/', source: '国学梦' }],
  '撼龙经评注': [{ url: 'https://www.guoxuemeng.com/fengshui/hanlongjingpingzhu/', source: '国学梦' }],
  '葬经翼': [{ url: 'https://www.guoxuemeng.com/fengshui/zangjingyi/', source: '国学梦' }],
  '葬经笺注': [{ url: 'https://www.guoxuemeng.com/fengshui/zangjingjianzhu/', source: '国学梦' }],
  '葬法倒杖': [{ url: 'https://www.guoxuemeng.com/fengshui/zangfadaozhang/', source: '国学梦' }],
  '三元总录': [{ url: 'https://www.guoxuemeng.com/fengshui/sanyuanzonglu/', source: '国学梦' }],
  '三元地理': [{ url: 'https://www.guoxuemeng.com/fengshui/sanyuandili/', source: '国学梦' }],
  '三合风水': [{ url: 'https://www.guoxuemeng.com/fengshui/sanhefengshui/', source: '国学梦' }],
  '八宅周书': [{ url: 'https://www.guoxuemeng.com/fengshui/bazhaizhoushu/', source: '国学梦' }],
  '宅经': [{ url: 'https://www.guoxuemeng.com/fengshui/zhaijing/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E5%AE%85%E7%B6%93', source: '维基文库' }, { url: 'https://ctext.org/wiki.pl?if=gb&res=843159', source: 'ctext' }],
  '宅心赋': [{ url: 'https://www.guoxuemeng.com/fengshui/zhaixinfu/', source: '国学梦' }],
  '黄帝宅经': [{ url: 'https://www.guoxuemeng.com/fengshui/huangdizhaijing/', source: '国学梦' }, { url: 'https://ctext.org/wiki.pl?if=gb&res=843161', source: 'ctext' }],
  '蒋大鸿地理辨正': [{ url: 'https://www.guoxuemeng.com/fengshui/jiangdahong/', source: '国学梦' }],
  '杨公风水': [{ url: 'https://www.guoxuemeng.com/fengshui/yanggongfengshui/', source: '国学梦' }],
  '杨筠松全集': [{ url: 'https://www.guoxuemeng.com/fengshui/yangyunsongquanji/', source: '国学梦' }],
  '形势理气': [{ url: 'https://www.guoxuemeng.com/fengshui/xingshiliqi/', source: '国学梦' }],
  '九星水法': [{ url: 'https://www.guoxuemeng.com/fengshui/jiuxingshuifa/', source: '国学梦' }],
  '寻龙诀': [{ url: 'https://www.guoxuemeng.com/fengshui/xunlongjue/', source: '国学梦' }],
  '寻龙记': [{ url: 'https://www.guoxuemeng.com/fengshui/xunlongji/', source: '国学梦' }],

  // ===== 相术类大量扩充 =====
  '相理衡真': [{ url: 'https://www.guoxuemeng.com/xiangshu/xianglihengzhen/', source: '国学梦' }],
  '太清神鉴': [{ url: 'https://www.guoxuemeng.com/xiangshu/taiqingshenjian/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E5%A4%AA%E6%B8%85%E7%A5%9E%E9%91%92', source: '维基文库' }],
  '玉管照神局': [{ url: 'https://www.guoxuemeng.com/xiangshu/yuguanzhaoshenju/', source: '国学梦' }],
  '相理新论': [{ url: 'https://www.guoxuemeng.com/xiangshu/xianglixinlun/', source: '国学梦' }],
  '相书': [{ url: 'https://www.guoxuemeng.com/xiangshu/xiangshu/', source: '国学梦' }],
  '人伦大统赋': [{ url: 'https://www.guoxuemeng.com/xiangshu/renlundatongfu/', source: '国学梦' }],
  '神相水镜集': [{ url: 'https://www.guoxuemeng.com/xiangshu/shenxiangshuijing/', source: '国学梦' }],
  '神相汇编': [{ url: 'https://www.guoxuemeng.com/xiangshu/shenxianghuibian/', source: '国学梦' }],
  '神相金较剪': [{ url: 'https://www.guoxuemeng.com/xiangshu/shenxiangjinjiaojian/', source: '国学梦' }],
  '神相照胆经': [{ url: 'https://www.guoxuemeng.com/xiangshu/shenxiangzhaodanjing/', source: '国学梦' }],
  '相法易知': [{ url: 'https://www.guoxuemeng.com/xiangshu/xiangfayizhi/', source: '国学梦' }],
  '观人于微': [{ url: 'https://www.guoxuemeng.com/xiangshu/guanrenyuwei/', source: '国学梦' }],
  '麻衣道者神相': [{ url: 'https://www.guoxuemeng.com/xiangshu/mayidaozheshenxiang/', source: '国学梦' }],
  '柳庄神相': [{ url: 'https://www.guoxuemeng.com/xiangshu/liuzhuangshenxiang/', source: '国学梦' }],
  '柳庄相诀': [{ url: 'https://www.guoxuemeng.com/xiangshu/liuzhuangxiangjue/', source: '国学梦' }],
  '柳庄相书': [{ url: 'https://www.guoxuemeng.com/xiangshu/liuzhuangxiangshu/', source: '国学梦' }],
  '水镜神相': [{ url: 'https://www.guoxuemeng.com/xiangshu/shuijingshenxiang/', source: '国学梦' }],
  '面相秘诀': [{ url: 'https://www.guoxuemeng.com/xiangshu/mianxiangmijue/', source: '国学梦' }],
  '面相大全': [{ url: 'https://www.guoxuemeng.com/xiangshu/mianxiangdaquan/', source: '国学梦' }],
  '手相全书': [{ url: 'https://www.guoxuemeng.com/xiangshu/shouxiangquanshu/', source: '国学梦' }],
  '手相秘要': [{ url: 'https://www.guoxuemeng.com/xiangshu/shouxiangmiyao/', source: '国学梦' }],
  '掌中乾坤': [{ url: 'https://www.guoxuemeng.com/xiangshu/zhangzhongqiankun/', source: '国学梦' }],
  '占气经': [{ url: 'https://www.guoxuemeng.com/xiangshu/zhanqijing/', source: '国学梦' }],
  '骨相学': [{ url: 'https://www.guoxuemeng.com/xiangshu/guxiangxue/', source: '国学梦' }],
  '冰鉴全集': [{ url: 'https://www.guoxuemeng.com/xiangshu/bingjianquanji/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E5%86%B0%E9%91%91', source: '维基文库' }],
  '冰鉴评注': [{ url: 'https://www.guoxuemeng.com/xiangshu/bingjianpingzhu/', source: '国学梦' }],
  '曾国藩冰鉴': [{ url: 'https://www.guoxuemeng.com/xiangshu/zengguofanbingjian/', source: '国学梦' }],

  // ===== 易经/经典扩充（每本多源） =====
  '易经程氏传': [{ url: 'https://www.guoxuemeng.com/yixue/yijingchenshichuan/', source: '国学梦' }],
  '周易本义': [{ url: 'https://www.guoxuemeng.com/yixue/zhouyibenyi/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E5%91%A8%E6%98%93%E6%9C%AC%E7%BE%A9', source: '维基文库' }],
  '周易折中': [{ url: 'https://www.guoxuemeng.com/yixue/zhouyizhezhong/', source: '国学梦' }],
  '周易述': [{ url: 'https://www.guoxuemeng.com/yixue/zhouyishu/', source: '国学梦' }],
  '周易尚氏学': [{ url: 'https://www.guoxuemeng.com/yixue/zhouyishangshixue/', source: '国学梦' }],
  '周易程氏传': [{ url: 'https://www.guoxuemeng.com/yixue/zhouyichenshichuan/', source: '国学梦' }],
  '周易郑康成注': [{ url: 'https://www.guoxuemeng.com/yixue/zhouyizhengkangcheng/', source: '国学梦' }],
  '周易正义': [{ url: 'https://www.guoxuemeng.com/yixue/zhouyizhengyi/', source: '国学梦' }, { url: 'https://ctext.org/wiki.pl?if=gb&res=843170', source: 'ctext' }],
  '周易集解': [{ url: 'https://www.guoxuemeng.com/yixue/zhouyijijie/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E5%91%A8%E6%98%93%E9%9B%86%E8%A7%A3', source: '维基文库' }],
  '周易参同契': [{ url: 'https://www.guoxuemeng.com/yixue/zhouyicantongqi/', source: '国学梦' }, { url: 'https://ctext.org/zhou-yi-can-tong-qi', source: 'ctext' }],
  '参同契考异': [{ url: 'https://www.guoxuemeng.com/yixue/cantongqikaoyi/', source: '国学梦' }],
  '太极图说': [{ url: 'https://www.guoxuemeng.com/yixue/taijitushuo/', source: '国学梦' }, { url: 'https://ctext.org/wiki.pl?if=gb&res=843175', source: 'ctext' }],
  '通书周敦颐': [{ url: 'https://www.guoxuemeng.com/yixue/tongshuzhoudunyi/', source: '国学梦' }],
  '皇极经世书': [{ url: 'https://www.guoxuemeng.com/yixue/huangjijingshi/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E7%9A%87%E6%A5%B5%E7%B6%93%E4%B8%96%E6%9B%B8', source: '维基文库' }],
  '观物篇': [{ url: 'https://www.guoxuemeng.com/yixue/guanwupian/', source: '国学梦' }],
  '渔樵问对': [{ url: 'https://www.guoxuemeng.com/yixue/yuqiaowendui/', source: '国学梦' }],
  '伊川易传': [{ url: 'https://www.guoxuemeng.com/yixue/yichuanyichuan/', source: '国学梦' }],
  '横渠易说': [{ url: 'https://www.guoxuemeng.com/yixue/henqyishuo/', source: '国学梦' }],
  '杨万里诚斋易传': [{ url: 'https://www.guoxuemeng.com/yixue/chenzhaiyichuan/', source: '国学梦' }],
  '童溪易传': [{ url: 'https://www.guoxuemeng.com/yixue/tongxiyichuan/', source: '国学梦' }],

  // ===== 道教/丹道扩充 =====
  '道德经': [{ url: 'https://www.guoxuemeng.com/daojia/daodejing/', source: '国学梦' }, { url: 'https://ctext.org/dao-de-jing/zhs', source: 'ctext' }, { url: 'https://zh.wikisource.org/wiki/%E9%81%93%E5%BE%B7%E7%B6%93', source: '维基文库' }],
  '南华经': [{ url: 'https://www.guoxuemeng.com/daojia/nanhuajing/', source: '国学梦' }, { url: 'https://ctext.org/zhuangzi/zhs', source: 'ctext' }],
  '冲虚经': [{ url: 'https://www.guoxuemeng.com/daojia/chongxujing/', source: '国学梦' }],
  '阴符经注': [{ url: 'https://www.guoxuemeng.com/daojia/yinfujingzhu/', source: '国学梦' }],
  '太上感应篇': [{ url: 'https://www.guoxuemeng.com/daojia/taishangganyingpian/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E5%A4%AA%E4%B8%8A%E6%84%9F%E6%87%89%E7%AF%87', source: '维基文库' }],
  '抱朴子': [{ url: 'https://www.guoxuemeng.com/daojia/baopuzi/', source: '国学梦' }, { url: 'https://ctext.org/baopuzi/zhs', source: 'ctext' }],
  '黄庭经': [{ url: 'https://www.guoxuemeng.com/daojia/huangtingjing/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E9%BB%83%E5%BA%AD%E7%B6%93', source: '维基文库' }],
  '黄庭内景经': [{ url: 'https://www.guoxuemeng.com/daojia/huangtingneijingjing/', source: '国学梦' }],
  '黄庭外景经': [{ url: 'https://www.guoxuemeng.com/daojia/huangtingwaijingjing/', source: '国学梦' }],
  '悟真篇': [{ url: 'https://www.guoxuemeng.com/daojia/wuzhenpian/', source: '国学梦' }],
  '钟吕传道集': [{ url: 'https://www.guoxuemeng.com/daojia/zhonglvchuandaoji/', source: '国学梦' }],
  '灵宝毕法': [{ url: 'https://www.guoxuemeng.com/daojia/lingbaobifa/', source: '国学梦' }],
  '清静经': [{ url: 'https://www.guoxuemeng.com/daojia/qingjingjing/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E6%B8%85%E9%9D%9C%E7%B6%93', source: '维基文库' }],
  '玉皇经': [{ url: 'https://www.guoxuemeng.com/daojia/yuhuangjing/', source: '国学梦' }],
  '度人经': [{ url: 'https://www.guoxuemeng.com/daojia/durenjing/', source: '国学梦' }],
  '太乙金华宗旨': [{ url: 'https://www.guoxuemeng.com/daojia/taiyijinhuazongzhi/', source: '国学梦' }],
  '性命圭旨': [{ url: 'https://www.guoxuemeng.com/daojia/xingminggui zhi/', source: '国学梦' }],
  '伍柳仙宗': [{ url: 'https://www.guoxuemeng.com/daojia/wuliuxianzong/', source: '国学梦' }],
  '吕祖全书': [{ url: 'https://www.guoxuemeng.com/daojia/lvzuquanshu/', source: '国学梦' }],
  '吕祖百字铭': [{ url: 'https://www.guoxuemeng.com/daojia/lvzubaizimming/', source: '国学梦' }],
  '丹经极论': [{ url: 'https://www.guoxuemeng.com/daojia/danjingjilun/', source: '国学梦' }],
  '丹阳真人语录': [{ url: 'https://www.guoxuemeng.com/daojia/danyangzhenrenyulu/', source: '国学梦' }],
  '邱处机西游记': [{ url: 'https://www.guoxuemeng.com/daojia/qiuchujixiyou/', source: '国学梦' }],
  '修真九要': [{ url: 'https://www.guoxuemeng.com/daojia/xiuzhenjiuyao/', source: '国学梦' }],
  '修真十书': [{ url: 'https://www.guoxuemeng.com/daojia/xiuzhenshishu/', source: '国学梦' }],
  '云笈七签': [{ url: 'https://www.guoxuemeng.com/daojia/yunjiqiqian/', source: '国学梦' }],

  // ===== 佛教/玄学相关 =====
  '六祖坛经': [{ url: 'https://www.guoxuemeng.com/fojia/liuzutanjing/', source: '国学梦' }, { url: 'https://ctext.org/wiki.pl?if=gb&res=843180', source: 'ctext' }],
  '金刚经': [{ url: 'https://www.guoxuemeng.com/fojia/jingangjing/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E9%87%91%E5%89%9B%E7%B6%93', source: '维基文库' }],
  '心经': [{ url: 'https://www.guoxuemeng.com/fojia/xinjing/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E5%BF%83%E7%B6%93', source: '维基文库' }],
  '楞严经': [{ url: 'https://www.guoxuemeng.com/fojia/lengyanjing/', source: '国学梦' }],
  '法华经': [{ url: 'https://www.guoxuemeng.com/fojia/fahuajing/', source: '国学梦' }],
  '华严经': [{ url: 'https://www.guoxuemeng.com/fojia/huayanjing/', source: '国学梦' }],
  '维摩诘经': [{ url: 'https://www.guoxuemeng.com/fojia/weimojiejing/', source: '国学梦' }],
  '圆觉经': [{ url: 'https://www.guoxuemeng.com/fojia/yuanjuejing/', source: '国学梦' }],

  // ===== 杂占/预言 =====
  '推背图全图': [{ url: 'https://www.guoxuemeng.com/yuyan/tuibeituquantu/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E6%8E%A8%E8%83%8C%E5%9C%96', source: '维基文库' }],
  '马前课': [{ url: 'https://www.guoxuemeng.com/yuyan/maqianke/', source: '国学梦' }],
  '诸葛神算': [{ url: 'https://www.guoxuemeng.com/yuyan/zhugeshensuan/', source: '国学梦' }],
  '诸葛神数': [{ url: 'https://www.guoxuemeng.com/yuyan/zhugeshenshu/', source: '国学梦' }],
  '梅花诗': [{ url: 'https://www.guoxuemeng.com/yuyan/meihuashi/', source: '国学梦' }],
  '步虚大师预言': [{ url: 'https://www.guoxuemeng.com/yuyan/buxudashiyuyan/', source: '国学梦' }],
  '武侯百年乩': [{ url: 'https://www.guoxuemeng.com/yuyan/wuhoubainianji/', source: '国学梦' }],
  '黄檗禅师诗': [{ url: 'https://www.guoxuemeng.com/yuyan/huangbochanshishi/', source: '国学梦' }],
  '金陵塔碑文': [{ url: 'https://www.guoxuemeng.com/yuyan/jinlingtabeiwen/', source: '国学梦' }],
  '推背图金圣叹批注': [{ url: 'https://www.guoxuemeng.com/yuyan/tuibeitujinshengtan/', source: '国学梦' }],
  '袁天罡推背图': [{ url: 'https://www.guoxuemeng.com/yuyan/yuantiangangtuibei/', source: '国学梦' }],

  // ===== 姓名学 =====
  '姓名学大全': [{ url: 'https://www.guoxuemeng.com/xingming/quanshu/', source: '国学梦' }],
  '五格剖象法': [{ url: 'https://www.guoxuemeng.com/xingming/wugepoxiang/', source: '国学梦' }],
  '康熙字典姓名学': [{ url: 'https://www.guoxuemeng.com/xingming/kangxizidian/', source: '国学梦' }],
  '八十一数理': [{ url: 'https://www.guoxuemeng.com/xingming/bashiyishuli/', source: '国学梦' }],
  '姓名学秘籍': [{ url: 'https://www.guoxuemeng.com/xingming/miji/', source: '国学梦' }],
  '熊崎健翁姓名学': [{ url: 'https://www.guoxuemeng.com/xingming/xiongqijianweng/', source: '国学梦' }],

  // ===== 经典丛书（多源） =====
  '百家姓': [{ url: 'https://www.guoxuemeng.com/mengxue/baijiaxing/', source: '国学梦' }, { url: 'https://ctext.org/bai-jia-xing/zhs', source: 'ctext' }, { url: 'https://zh.wikisource.org/wiki/%E7%99%BE%E5%AE%B6%E5%A7%93', source: '维基文库' }],
  '三字经': [{ url: 'https://www.guoxuemeng.com/mengxue/sanzijing/', source: '国学梦' }, { url: 'https://ctext.org/three-character-classic/zhs', source: 'ctext' }],
  '千字文': [{ url: 'https://www.guoxuemeng.com/mengxue/qianziwen/', source: '国学梦' }, { url: 'https://ctext.org/qian-zi-wen/zhs', source: 'ctext' }],
  '弟子规': [{ url: 'https://www.guoxuemeng.com/mengxue/dizigui/', source: '国学梦' }, { url: 'https://ctext.org/wiki.pl?if=gb&res=843201', source: 'ctext' }],
  '幼学琼林': [{ url: 'https://www.guoxuemeng.com/mengxue/youxueqionglin/', source: '国学梦' }, { url: 'https://zh.wikisource.org/wiki/%E5%B9%BC%E5%AD%B8%E7%93%8A%E6%9E%97', source: '维基文库' }],
  '增广贤文': [{ url: 'https://www.guoxuemeng.com/mengxue/zengguangxianwen/', source: '国学梦' }, { url: 'https://ctext.org/wiki.pl?if=gb&res=843202', source: 'ctext' }],
  '声律启蒙': [{ url: 'https://www.guoxuemeng.com/mengxue/shenglvqimeng/', source: '国学梦' }],
  '笠翁对韵': [{ url: 'https://www.guoxuemeng.com/mengxue/liwengduiyun/', source: '国学梦' }],
  '小学集注': [{ url: 'https://www.guoxuemeng.com/mengxue/xiaoxuejizhu/', source: '国学梦' }],
  '蒙求': [{ url: 'https://www.guoxuemeng.com/mengxue/mengqiu/', source: '国学梦' }],
  '论语': [{ url: 'https://www.guoxuemeng.com/sishu/lunyu/', source: '国学梦' }, { url: 'https://ctext.org/analects/zhs', source: 'ctext' }, { url: 'https://zh.wikisource.org/wiki/%E8%AB%96%E8%AA%9E', source: '维基文库' }],
  '孟子': [{ url: 'https://www.guoxuemeng.com/sishu/mengzi/', source: '国学梦' }, { url: 'https://ctext.org/mengzi/zhs', source: 'ctext' }],
  '大学': [{ url: 'https://www.guoxuemeng.com/sishu/daxue/', source: '国学梦' }, { url: 'https://ctext.org/liji/da-xue/zhs', source: 'ctext' }],
  '中庸': [{ url: 'https://www.guoxuemeng.com/sishu/zhongyong/', source: '国学梦' }, { url: 'https://ctext.org/liji/zhong-yong/zhs', source: 'ctext' }],
  '诗经': [{ url: 'https://www.guoxuemeng.com/wujing/shijing/', source: '国学梦' }, { url: 'https://ctext.org/book-of-poetry/zhs', source: 'ctext' }],
  '尚书': [{ url: 'https://www.guoxuemeng.com/wujing/shangshu/', source: '国学梦' }, { url: 'https://ctext.org/shang-shu/zhs', source: 'ctext' }],
  '礼记': [{ url: 'https://www.guoxuemeng.com/wujing/liji/', source: '国学梦' }, { url: 'https://ctext.org/liji/zhs', source: 'ctext' }],
  '春秋左传': [{ url: 'https://www.guoxuemeng.com/wujing/chunqiuzuozhuan/', source: '国学梦' }, { url: 'https://ctext.org/chun-qiu-zuo-zhuan/zhs', source: 'ctext' }],
  '孝经': [{ url: 'https://www.guoxuemeng.com/wujing/xiaojing/', source: '国学梦' }, { url: 'https://ctext.org/xiao-jing/zhs', source: 'ctext' }],
  '尔雅': [{ url: 'https://www.guoxuemeng.com/wujing/erya/', source: '国学梦' }, { url: 'https://ctext.org/er-ya/zhs', source: 'ctext' }],

  // ===== 中医玄学相关 =====
  '难经': [{ url: 'https://www.guoxuemeng.com/zhongyi/nanjing/', source: '国学梦' }, { url: 'https://ctext.org/nan-jing/zhs', source: 'ctext' }],
  '伤寒论': [{ url: 'https://www.guoxuemeng.com/zhongyi/shanghanlun/', source: '国学梦' }],
  '金匮要略': [{ url: 'https://www.guoxuemeng.com/zhongyi/jinguiyaolue/', source: '国学梦' }],
  '神农本草经': [{ url: 'https://www.guoxuemeng.com/zhongyi/shennongbencaojing/', source: '国学梦' }, { url: 'https://ctext.org/shen-nong-ben-cao-jing/zhs', source: 'ctext' }],
  '本草纲目': [{ url: 'https://www.guoxuemeng.com/zhongyi/bencaogangmu/', source: '国学梦' }, { url: 'https://ctext.org/wiki.pl?if=gb&res=843190', source: 'ctext' }],
  '濒湖脉学': [{ url: 'https://www.guoxuemeng.com/zhongyi/binhumaixue/', source: '国学梦' }],
  '汤头歌诀': [{ url: 'https://www.guoxuemeng.com/zhongyi/tangtougejue/', source: '国学梦' }],
  '医学三字经': [{ url: 'https://www.guoxuemeng.com/zhongyi/yixuesanzijing/', source: '国学梦' }],
  '黄帝外经': [{ url: 'https://www.guoxuemeng.com/zhongyi/huangdiwaijing/', source: '国学梦' }],
  '景岳全书': [{ url: 'https://www.guoxuemeng.com/zhongyi/jingyuequanshu/', source: '国学梦' }],
  '医宗金鉴': [{ url: 'https://www.guoxuemeng.com/zhongyi/yizongjinjian/', source: '国学梦' }],
  '太素脉': [{ url: 'https://www.guoxuemeng.com/zhongyi/taisumai/', source: '国学梦' }],
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
