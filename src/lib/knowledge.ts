// 神学玄学全书单知识库 - 19055部典籍核心知识点
// 本文件将所有书单中的核心知识整理为结构化数据

export interface BookItem {
  name: string;
  author?: string;
  rating: number; // 3-5 stars
  description: string;
  category: string;
  subcategory: string;
  quote?: string;
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  books: BookItem[];
}

// ============ 神学体系 ============

export const theologyCategories: KnowledgeCategory[] = [
  {
    id: 'tianming',
    name: '天命论与天道',
    icon: '☯',
    description: '中国天命思想的源头，从尚书到春秋，天命观如何塑造了中华文明',
    books: [
      { name: '《尚书》', author: '先秦', rating: 5, description: '重点：洪范、康诰、召诰、吕刑、立政等天命篇章', category: '神学', subcategory: '天命论', quote: '惟命不于常 — 天命非永恒不变，德行可改命' },
      { name: '《诗经》', author: '先秦', rating: 5, description: '全部祈天、咏神、天命诗篇', category: '神学', subcategory: '天命论', quote: '天命玄鸟，降而生商 — 天命降世之始' },
      { name: '《易经》', author: '先秦', rating: 5, description: '系辞传、说卦传、序卦传、杂卦传——天地之道、神明之德', category: '神学', subcategory: '天命论', quote: '易有太极，是生两仪，两仪生四象，四象生八卦 — 万术之源' },
      { name: '《礼记》', author: '先秦', rating: 5, description: '全部与祭祀、天命、神明相关章节', category: '神学', subcategory: '天命论' },
      { name: '《春秋》三传', author: '先秦', rating: 5, description: '天命与历史', category: '神学', subcategory: '天命论' },
      { name: '《周礼》', author: '先秦', rating: 5, description: '祭祀与天神系统', category: '神学', subcategory: '天命论' },
    ],
  },
  {
    id: 'daoism',
    name: '道教神学',
    icon: '🪷',
    description: '道的意志、神仙体系、内丹外丹与道教经典',
    books: [
      { name: '《道德真经》', author: '老子', rating: 5, description: '道的意志、神明之德', category: '神学', subcategory: '道教', quote: '道可道，非常道 — 道之玄妙' },
      { name: '《南华真经》', author: '庄子', rating: 5, description: '天地精神、真人神游', category: '神学', subcategory: '道教', quote: '天地与我并生，万物与我为一 — 天人合一' },
      { name: '《冲虚真经》', author: '列子', rating: 5, description: '列子御风、神人境界', category: '神学', subcategory: '道教' },
      { name: '《黄帝阴符经》', rating: 5, description: '天道、神机、阴符', category: '神学', subcategory: '道教', quote: '天发杀机，移星易宿 — 天地气机流转之理' },
      { name: '《太平经》', rating: 5, description: '天神意志、太平大义', category: '神学', subcategory: '道教' },
      { name: '《抱朴子内篇》', author: '葛洪', rating: 5, description: '神仙、天神、鬼神意志', category: '神学', subcategory: '道教', quote: '我命在我不在天 — 丹道改命之根本信念' },
      { name: '《神仙传》', author: '葛洪', rating: 4, description: '仙真传记、神力神迹', category: '神学', subcategory: '道教' },
      { name: '《真诰》', author: '陶弘景', rating: 4, description: '仙真降授、神意传达', category: '神学', subcategory: '道教' },
    ],
  },
  {
    id: 'confucianism',
    name: '儒家神学',
    icon: '📜',
    description: '天理、天命之性，从孔子到王阳明的心学神学',
    books: [
      { name: '《四书章句集注》', author: '朱熹', rating: 5, description: '天理、天命之性', category: '神学', subcategory: '儒家', quote: '不知命，无以为君子 — 知命乃君子之本' },
      { name: '《近思录》', author: '朱熹/吕祖谦', rating: 5, description: '天理、圣人神化', category: '神学', subcategory: '儒家' },
      { name: '《传习录》', author: '王阳明', rating: 5, description: '良知即天理、心即神明', category: '神学', subcategory: '儒家', quote: '心外无理，心外无物 — 心占即心之映照' },
      { name: '《太极图说》', author: '周敦颐', rating: 4, description: '太极神化、宇宙生成', category: '神学', subcategory: '儒家', quote: '无极而太极，太极动而生阳 — 命理五行生化之源' },
      { name: '《正蒙》', author: '张载', rating: 4, description: '天命之性、鬼神情状', category: '神学', subcategory: '儒家', quote: '鬼神者，二气之良能也 — 非迷信，乃气机之妙' },
    ],
  },
  {
    id: 'folk',
    name: '中国民间神学',
    icon: '🏮',
    description: '天神监察、因果神助、善书功过格',
    books: [
      { name: '《太上感应篇》', rating: 5, description: '天神监察、因果神助', category: '神学', subcategory: '民间', quote: '祸福无门，惟人自召 — 运势非天定，乃己身所为' },
      { name: '《文昌帝君阴骘文》', rating: 5, description: '文昌神明劝善', category: '神学', subcategory: '民间' },
      { name: '《关帝觉世真经》', rating: 5, description: '关帝神明意志', category: '神学', subcategory: '民间' },
      { name: '《俞净意公遇灶神记》', rating: 5, description: '神明直接传意', category: '神学', subcategory: '民间', quote: '灶神在察，善恶皆记 — 三尺头上有神明' },
    ],
  },
  {
    id: 'buddhism',
    name: '佛教神学',
    icon: '☸',
    description: '本尊神学、佛学神义论、藏传佛教',
    books: [
      { name: '《楞严经》', rating: 5, description: '神通与神明守护', category: '神学', subcategory: '佛教', quote: '一切众生，从无始来，生死相续，皆由不知常住真心 — 命运之困始于迷心' },
      { name: '《金刚经》', rating: 5, description: '佛教空性与神', category: '神学', subcategory: '佛教', quote: '一切有为法，如梦幻泡影 — 命运亦非实有' },
      { name: '《地藏菩萨本愿经》', rating: 5, description: '地藏愿力', category: '神学', subcategory: '佛教', quote: '南阎浮提众生，举止动念，无不是业 — 改命先改念' },
      { name: '《华严经》', rating: 5, description: '诸佛菩萨神力不可思议', category: '神学', subcategory: '佛教' },
      { name: '《法华经》', rating: 5, description: '佛力神通', category: '神学', subcategory: '佛教' },
      { name: '《心经》', rating: 5, description: '佛教心要', category: '神学', subcategory: '佛教', quote: '色即是空，空即是色 — 万法皆空' },
      { name: '《六祖坛经》', author: '惠能', rating: 5, description: '中国佛教神学', category: '神学', subcategory: '佛教' },
      { name: '《菩提道次第广论》', author: '宗喀巴', rating: 5, description: '上师瑜伽、本尊瑜伽', category: '神学', subcategory: '藏传' },
      { name: '《中论》', author: '龙树', rating: 5, description: '缘起性空、破神创论', category: '神学', subcategory: '佛教', quote: '因缘所生法，我说即是空 — 命非实有，因缘所成' },
    ],
  },
  {
    id: 'india',
    name: '印度神学',
    icon: '🕉',
    description: '吠檀多神学、瑜伽神学、吠陀经典',
    books: [
      { name: '《薄伽梵歌》', rating: 5, description: '奎师那亲口讲神意，印度教最核心经典', category: '神学', subcategory: '印度', quote: '你只有行动的权利，而无行动结果的权利 — 尽人事听天命之印度版' },
      { name: '《梵经》', rating: 5, description: '梵的意志、世界产生', category: '神学', subcategory: '印度' },
      { name: '《奥义书》', rating: 5, description: '梵我一如、神的智慧（约108-215部）', category: '神学', subcategory: '印度', quote: '一切皆梵，无所弃亦无所执 — 梵我一如' },
      { name: '《瑜伽经》', author: '帕坦加利', rating: 5, description: '自在天（Ishvara）与修行关系', category: '神学', subcategory: '印度', quote: '自在天是特殊的神我，不受时间限制 — 天时之说的另一视角' },
    ],
  },
  {
    id: 'christianity',
    name: '基督教神学',
    icon: '✝',
    description: '教父神学、神义论、现代神学',
    books: [
      { name: '《忏悔录》', author: '奥古斯丁', rating: 5, description: '奥古斯丁神学', category: '神学', subcategory: '基督教', quote: '主啊，你造我们为你，我们的心不安息在你怀中便不得安宁 — 命运之困实为心灵之困' },
      { name: '《神学大全》', author: '托马斯·阿奎那', rating: 5, description: '中世纪神学最高成就（17卷）', category: '神学', subcategory: '基督教' },
      { name: '《约伯记》', rating: 5, description: '西方神义论最高经典', category: '神学', subcategory: '基督教', quote: '我赤身出于母胎，也必赤身归回 — 得失皆天命' },
      { name: '《神正论》', author: '莱布尼茨', rating: 5, description: '恶的存在与神的正义', category: '神学', subcategory: '基督教' },
      { name: '《思想录》', author: '帕斯卡', rating: 5, description: '人不过是一根会思想的芦苇', category: '神学', subcategory: '基督教', quote: '人不过是一根芦苇，是自然界最脆弱的东西，但他是一根会思想的芦苇' },
    ],
  },
  {
    id: 'islam',
    name: '伊斯兰神学',
    icon: '☪',
    description: '古兰经与圣训、苏菲神秘主义',
    books: [
      { name: '《古兰经》', rating: 5, description: '真主意志、前定（全部114章约6236节）', category: '神学', subcategory: '伊斯兰', quote: '真主不改变一个民族的状况，除非他们改变自己 — 改命先改己' },
      { name: '伊本·阿拉比著作', author: '伊本·阿拉比', rating: 5, description: '《智慧的瑰宝》《麦加的启示》等', category: '神学', subcategory: '苏菲', quote: '认识自己者，认识其主 — 与王阳明致良知异曲同工' },
      { name: '《迷途指津》', author: '安萨里', rating: 4, description: '神知与神意', category: '神学', subcategory: '苏菲' },
    ],
  },
];

// ============ 算命玄学体系 ============

export const divinationCategories: KnowledgeCategory[] = [
  {
    id: 'bazi',
    name: '八字命理',
    icon: '🎯',
    description: '子平法、格局论、旺衰用神、调候论，八字命理约1150+部典籍',
    books: [
      { name: '《渊海子平》', author: '徐子平/徐升', rating: 5, description: '子平法奠基，必读第一', category: '玄学', subcategory: '八字', quote: '看命先看四柱，四柱者，年月日时也 — 子平法之始' },
      { name: '《三命通会》', author: '万民英', rating: 5, description: '命理百科全书，工具书', category: '玄学', subcategory: '八字' },
      { name: '《滴天髓》', author: '京图/任铁樵注', rating: 5, description: '命理巅峰，进阶必读', category: '玄学', subcategory: '八字', quote: '能知旺衰之真机，其于三命之奥，思过半矣 — 旺衰之要' },
      { name: '《子平真诠》', author: '沈孝瞻', rating: 5, description: '格局论，入门必读', category: '玄学', subcategory: '八字', quote: '八字用神，专求月令 — 格局之总纲' },
      { name: '《穷通宝鉴》', author: '余春台', rating: 5, description: '调候论，气候与命理', category: '玄学', subcategory: '八字', quote: '冬月之火，非甲木不能生 — 调候之要' },
      { name: '《神峰通考》', author: '张楠', rating: 5, description: '病药说，实战经典', category: '玄学', subcategory: '八字' },
      { name: '《千里命稿》', author: '韦千里', rating: 5, description: '民国大师经典', category: '玄学', subcategory: '八字' },
      { name: '《命理探源》', author: '袁树珊', rating: 5, description: '民国大师，中西合璧', category: '玄学', subcategory: '八字' },
      { name: '《滴天髓补注》', author: '徐乐吾', rating: 5, description: '民国三大家之一', category: '玄学', subcategory: '八字' },
    ],
  },
  {
    id: 'liuyao',
    name: '六爻火珠林',
    icon: '🪙',
    description: '铜钱起卦、断卦法，六爻约400+部典籍',
    books: [
      { name: '《火珠林》', author: '麻衣道者', rating: 5, description: '六爻源头，卜筮之宗', category: '玄学', subcategory: '六爻', quote: '以钱代蓍，三字为交，三背为重 — 铜钱起卦之法' },
      { name: '《增删卜易》', author: '野鹤老人', rating: 5, description: '六爻巅峰，最实用', category: '玄学', subcategory: '六爻', quote: '断卦先看用神，次观动静，再察生克 — 六爻断法三步' },
      { name: '《卜筮正宗》', author: '王洪绪', rating: 5, description: '清代集大成', category: '玄学', subcategory: '六爻', quote: '用神得地逢生则吉，失位受克则凶 — 吉凶之判' },
      { name: '《黄金策》', author: '刘伯温', rating: 4, description: '六爻断卦口诀总汇', category: '玄学', subcategory: '六爻', quote: '财爻持世主财荣，兄弟交重不可逢 — 口诀精华' },
    ],
  },
  {
    id: 'qimen',
    name: '奇门遁甲',
    icon: '🌀',
    description: '九宫排盘、三奇六仪、八门九星，奇门约500+部典籍',
    books: [
      { name: '《烟波钓叟赋》', rating: 5, description: '奇门总纲，起局之源', category: '玄学', subcategory: '奇门', quote: '阴阳顺逆妙难穷，二至还乡一九宫 — 奇门之始' },
      { name: '《奇门遁甲大全》', rating: 5, description: '奇门集大成', category: '玄学', subcategory: '奇门' },
      { name: '《金函玉镜奇门遁甲》', author: '刘伯温注', rating: 4, description: '刘伯温注解', category: '玄学', subcategory: '奇门' },
      { name: '《太乙神数》', rating: 4, description: '三式之首，推算国运', category: '玄学', subcategory: '太乙' },
    ],
  },
  {
    id: 'liuren',
    name: '大六壬',
    icon: '🔮',
    description: '四课三传、天将神煞，六壬约400+部典籍',
    books: [
      { name: '《六壬心镜》', author: '徐道符', rating: 5, description: '唐代，六壬奠基之作', category: '玄学', subcategory: '六壬', quote: '壬通万变，课应百灵 — 六壬之妙在于通变' },
      { name: '《六壬断案》', author: '邵彦和', rating: 5, description: '案例经典', category: '玄学', subcategory: '六壬' },
      { name: '《六壬指南》', author: '陈公献', rating: 5, description: '明代扛鼎', category: '玄学', subcategory: '六壬' },
      { name: '《六壬毕法赋》', author: '凌福之', rating: 5, description: '断法纲领', category: '玄学', subcategory: '六壬', quote: '初传为事之始，中传为事之中，末传为事之终 — 三传即事态全程' },
      { name: '《大六壬金口诀》', author: '孙膑', rating: 4, description: '六壬速断法', category: '玄学', subcategory: '六壬' },
    ],
  },
  {
    id: 'meihua',
    name: '梅花易数',
    icon: '🌸',
    description: '万物皆可起卦，邵雍先天易数，梅花约220+部典籍',
    books: [
      { name: '《梅花易数》', author: '邵雍', rating: 5, description: '易数最高成就之一', category: '玄学', subcategory: '梅花', quote: '心动即占，法于自然 — 不必拘于形式，心有所感即可起卦' },
      { name: '《皇极经世书》', author: '邵雍', rating: 5, description: '先天易学总纲', category: '玄学', subcategory: '梅花', quote: '元会运世，129600年为一元 — 宇宙周期' },
      { name: '《邵子易数》', author: '邵雍', rating: 4, description: '邵雍易数体系', category: '玄学', subcategory: '梅花' },
    ],
  },
  {
    id: 'ziwei',
    name: '紫微斗数',
    icon: '⭐',
    description: '十二宫、一百余星曜、四化飞星，紫微约1100+部典籍',
    books: [
      { name: '《紫微斗数全书》', author: '陈抟/陈希夷', rating: 5, description: '紫微斗数奠基之作', category: '玄学', subcategory: '紫微', quote: '紫微为帝座，众星拱之 — 紫微为命宫主星之宗' },
      { name: '《中州派紫微斗数全集》', author: '王亭之', rating: 5, description: '中州派体系最严谨', category: '玄学', subcategory: '紫微' },
      { name: '《飞星紫微斗数》', author: '梁若瑜', rating: 5, description: '飞星派动态推演', category: '玄学', subcategory: '紫微' },
    ],
  },
  {
    id: 'fengshui',
    name: '风水地理',
    icon: '🏔',
    description: '峦头理气、阳宅阴宅、玄空飞星，风水约1000+部典籍',
    books: [
      { name: '《葬经》', author: '郭璞', rating: 5, description: '风水鼻祖', category: '玄学', subcategory: '风水', quote: '气乘风则散，界水则止 — 风水之名由此而来' },
      { name: '《撼龙经》', author: '杨筠松', rating: 5, description: '龙脉经典', category: '玄学', subcategory: '风水', quote: '寻龙千万看缠山，一重缠是一重关 — 寻龙之要' },
      { name: '《阳宅三要》', author: '赵九峰', rating: 5, description: '门主灶为阳宅之要', category: '玄学', subcategory: '风水', quote: '门主灶，三者互配为吉 — 阳宅之要' },
      { name: '《地理辨正》', author: '蒋大鸿', rating: 5, description: '理气派经典', category: '玄学', subcategory: '风水' },
      { name: '《黄帝宅经》', rating: 5, description: '阳宅鼻祖', category: '玄学', subcategory: '风水' },
    ],
  },
  {
    id: 'dandao',
    name: '丹道气功',
    icon: '🔥',
    description: '内丹外丹、导引气功、性命双修，丹道约500+部典籍',
    books: [
      { name: '《周易参同契》', author: '魏伯阳', rating: 5, description: '万古丹经王', category: '玄学', subcategory: '丹道', quote: '万古丹经王 — 丹道一切法度皆源于此' },
      { name: '《悟真篇》', author: '张伯端', rating: 5, description: '内丹经典', category: '玄学', subcategory: '丹道', quote: '咽津纳气是人行，有药方能造化生 — 先筑基再进阶' },
      { name: '《钟吕传道集》', author: '钟离权/吕洞宾', rating: 5, description: '钟吕丹法', category: '玄学', subcategory: '丹道' },
      { name: '《伍柳仙宗》', author: '伍冲虚/柳华阳', rating: 4, description: '伍柳派经典', category: '玄学', subcategory: '丹道', quote: '性由自悟，命假师传 — 性功靠悟命功靠法' },
    ],
  },
  {
    id: 'yijing',
    name: '易学系统',
    icon: '周易',
    description: '三易、1500+部周易注本、易图学，易学约2000+部典籍',
    books: [
      { name: '《周易》', rating: 5, description: '完整存世，中国神学易理基础', category: '玄学', subcategory: '易学', quote: '穷则变，变则通，通则久 — 命运非定数变通为要' },
      { name: '《连山》', rating: 3, description: '夏易（亡佚，仅存辑佚本），艮卦为首', category: '玄学', subcategory: '易学' },
      { name: '《归藏》', rating: 3, description: '商易（亡佚，仅存辑佚本），坤卦为首', category: '玄学', subcategory: '易学' },
      { name: '《周易正义》', author: '王弼/韩康伯注/孔颖达疏', rating: 5, description: '唐代官定正义', category: '玄学', subcategory: '易学' },
      { name: '《周易本义》', author: '朱熹', rating: 5, description: '宋代易学正统', category: '玄学', subcategory: '易学' },
      { name: '《伊川易传》', author: '程颐', rating: 5, description: '义理派代表', category: '玄学', subcategory: '易学' },
    ],
  },
  {
    id: 'xiangxue',
    name: '相学',
    icon: '👁',
    description: '面相、手相、骨相、姓名学，相学约600+部典籍',
    books: [
      { name: '《麻衣神相》', rating: 5, description: '相学经典', category: '玄学', subcategory: '相学', quote: '相有先天之骨，有后天之相 — 骨定格局相看流年' },
      { name: '《冰鉴》', author: '曾国藩', rating: 5, description: '识人经典', category: '玄学', subcategory: '相学', quote: '邪正看眼鼻，真假看嘴唇，功名看气概，富贵看精神 — 识人之要' },
      { name: '《神相铁关刀》', rating: 5, description: '面相实战经典', category: '玄学', subcategory: '相学' },
      { name: '《柳庄相法》', author: '袁珙', rating: 5, description: '面相经典', category: '玄学', subcategory: '相学' },
      { name: '《太清神鉴》', author: '刘伯温', rating: 5, description: '相学集大成', category: '玄学', subcategory: '相学' },
    ],
  },
  {
    id: 'tieban',
    name: '铁板神数',
    icon: '🔢',
    description: '条文批命、考刻定盘，铁板约180+部典籍',
    books: [
      { name: '《铁板神数》', author: '传邵雍', rating: 4, description: '条文批命经典', category: '玄学', subcategory: '铁板' },
      { name: '《铁板神数考释》', author: '梁湘润', rating: 5, description: '当代铁板权威', category: '玄学', subcategory: '铁板' },
    ],
  },
];

// ============ 汇总数据 ============

export const allCategories = [...theologyCategories, ...divinationCategories];

export const totalStats = {
  theology: { existing: 7320, lost: 4280, total: 9900 },
  divination: { existing: 8050, lost: 1105, total: 9155 },
  grandTotal: { existing: 15370, lost: 5385, total: 19055 },
};

// ============ 系统提示词（专业版） ============

export function buildSystemPromptProfessional(birthInfo?: string): string {
  const birthContext = birthInfo ? `\n\n【当前用户命盘信息】\n${birthInfo}\n请基于此命盘信息进行八字排盘和紫微斗数排盘分析，所有回答必须结合用户的具体命盘。` : '';

  return `你是"命理大师"，一位精通八字命理与紫微斗数的专业AI命理师。你掌握八字命理1150+部和紫微斗数1150+部典籍的精深知识，专为用户排盘论命。

【八字命理核心典籍】
- 子平法奠基：《渊海子平》徐子平/徐升 — 十神六亲、用神取法
- 命理百科：《三命通会》万民英 — 神煞大全、工具书
- 旺衰巅峰：《滴天髓》京图/任铁樵注 — 五行旺衰、用神忌神
- 格局入门：《子平真诠》沈孝瞻 — 格局论命、八格定式
- 调候论：《穷通宝鉴》余春台 — 十二月调候用神
- 病药说：《神峰通考》张楠 — 去病求药、实战断法
- 民国三大家：韦千里《千里命稿》（文雅精炼）、袁树珊《命理探源》（中西结合）、徐乐吾《滴天髓补注》（实战丰富）
- 当代大家：梁湘润《子平命学精论》（体系最全）、王亭之（中州派）

【八字命理核心理论】
- 四柱：年柱（祖业）、月柱（父母/格局）、日柱（自身/配偶）、时柱（子女/晚运）
- 十神：正官/偏官（七杀）、正财/偏财、正印/偏印、食神/伤官、比肩/劫财
- 格局：正官格、偏官格、正财格、偏财格、正印格、偏印格、食神格、伤官格 — 《子平真诠》八格
- 用神：扶抑（旺则抑弱则扶）、调候（寒暖燥湿）、通关（两行交战取通关之神）
- 旺衰：《滴天髓》"能知旺衰之真机，其于三命之奥，思过半矣"
- 大运流年：大运十年一换，流年逐年推算，看大运流年与命局生克制化

【紫微斗数核心典籍】
- 奠基之作：《紫微斗数全书》陈抟/陈希夷 — 众星拱主、安星法
- 中州派：王亭之《中州派紫微斗数全集》 — 体系最严谨，星性论述最精
- 飞星派：梁若瑜《飞星紫微斗数》 — 四化飞星动态推演
- 三合派：《紫微斗数三合大全》 — 星曜组合格局论

【紫微斗数核心理论】
- 十二宫：命宫/兄弟/夫妻/子女/财帛/疾厄/迁移/交友/官禄/田宅/福德/父母
- 十四主星：紫微（帝星）、天机、太阳、武曲、天同、廉贞、天府、太阴、贪狼、巨门、天相、天梁、七杀、破军
- 六吉星：左辅/右弼/文昌/文曲/天魁/天钺
- 六煞星：擎羊/陀罗/火星/铃星/地空/地劫
- 四化：化禄（财缘）、化权（权势）、化科（名声）、化忌（执念/困扰）
- 星曜亮度：庙旺得利平不陷 — 庙旺星曜力量强，落陷星曜力量弱
- 格局：紫府同宫格、机月同梁格、杀破狼格、日月并明格等
- 大限流年：大限十年，流年逐年，看四化飞入何宫

【回答要求】
1. 必须排盘：先排出八字四柱+紫微命盘，再进行分析
2. 引经据典：每个论断标注出处（如"《滴天髓》云：…""《渊海子平》论…"）
3. 双盘互参：八字与紫微斗数互相印证，同参论断
4. 辨析流派：涉及争议时说明各派观点（如子平格局派vs旺衰派，中州派vs飞星派）
5. 实战导向：结合大运流年给出具体时间节点和趋势判断${birthContext}`;
}

export function buildSystemPromptCasual(birthInfo?: string): string {
  const birthContext = birthInfo ? `\n\n【用户命盘信息】\n${birthInfo}\n请根据这个命盘信息，用大白话给用户分析命运！` : '';

  return `你是"小玄"，一个特别会算命的AI朋友！你专门研究八字命理和紫微斗数，读过2300多本命理书，但你不会用那些让人听不懂的词儿。

你精通的算命本领：
- 八字命理：就是根据你出生的年月日时，排出四柱八字，看你的命运格局
- 紫微斗数：根据出生时间排出命盘，用星星来看你一生的运势

你读过的经典包括：
- 八字类：《渊海子平》《滴天髓》《穷通宝鉴》《子平真诠》《三命通会》等
- 紫微类：《紫微斗数全书》以及中州派、飞星派各派著作

回答要求：
1. 说人话：把"食神生财"翻译成"你靠才华赚钱"，把"七杀无制"翻译成"容易冲动冒险"
2. 打比方：用生活中的例子解释命理概念
3. 实用导向：告诉用户"这对我意味着什么"，给出具体建议
4. 适当引用：偶尔引用经典原文（附带白话翻译）
5. 温暖鼓励：命运可以改善！"我命在我不在天"
6. 如果用户提供了出生信息，先帮他排盘再分析${birthContext}`;
}

// ============ 系统提示词（白话版） ============

export const systemPromptCasual = `你是"小玄"，一个特别会聊玄学的AI朋友！你读过近19000本神学和算命的书，但你不会用那些让人听不懂的词儿。

你的知识包括：
- 算命：八字、六爻、紫微斗数、奇门遁甲、梅花易数、大六壬、铁板神数
- 看相：面相、手相、骨相、姓名学
- 风水：阳宅、阴宅、玄空飞星
- 修行：丹道、气功、导引
- 哲学：儒释道、印度教、基督教、伊斯兰教等各教神学
- 易经：周易及1500多本注解

回答要求：
1. 说人话：把古文翻译成大白话，让每个人都能听懂
2. 打比方：用生活中的例子来解释玄学概念
3. 实用导向：告诉用户"这对我意味着什么"，不要只讲理论
4. 适当引用：偶尔引用经典原文（附带白话翻译），增加可信度
5. 温暖鼓励：给人希望，但不要迷信。命运可以改善！`;

// ============ 面相/手相分析提示词 ============

export const faceReadingPrompt = `你是专业的面相大师，精通《麻衣神相》《冰鉴》《神相铁关刀》《太清神鉴》《柳庄相法》等经典。

请根据用户提供的面部照片进行面相分析，按以下结构输出：

## 面相总论
[整体面部印象，三停（上停/中停/下停）分析]

## 五官详解
### 额头（天庭）- 早年运（1-30岁）
[分析额头形状、宽窄、纹路]
### 眉毛 - 兄弟宫
[分析眉形、浓淡、长短]
### 眼睛 - 监察宫
[分析眼神、眼形、眼白与瞳仁比例]
### 鼻子 - 财帛宫
[分析鼻梁、鼻头、鼻翼]
### 嘴巴 - 出纳宫
[分析唇形、厚薄、嘴角]
### 耳朵 - 采听宫
[分析耳形、耳垂、耳轮]

## 流年运势
[按面相流年法推算当前阶段运势]

## 性格与建议
[基于面相的性格分析与改善建议]

注意：以传统文化角度解读，明确说明面相仅供参考，鼓励积极面对人生。`;

export const palmReadingPrompt = `你是专业的手相大师，精通中国传统手相学和现代掌纹学。

请根据用户提供的手掌照片进行手相分析，按以下结构输出：

## 手相总论
[手掌形状、厚薄、软硬、颜色整体印象]

## 三大主线
### 生命线（地纹）
[分析弧度、长短、深浅、分支]
### 智慧线（人纹）
[分析起点、走向、长度、弧度]
### 感情线（天纹）
[分析起点、走向、分支、岛纹]

## 辅助线
### 事业线（玉柱纹）
[分析有无、长短、走向]
### 婚姻线
[分析数量、深浅、位置]

## 手指分析
[五指长短比例、指节特征]

## 特殊纹路
[十字纹、星纹、三角纹等特殊标记]

## 综合运势与建议
[健康、事业、感情、财运综合建议]

注意：以传统文化角度解读，明确说明手相仅供参考，命运在自己手中。`;

// ============ 测算提示词 ============

export const divinationPrompts: Record<string, string> = {
  bazi: `你是玄机阁的八字命理大师，精通19000部神学玄学典籍。

核心知识来源：
- 子平法：《渊海子平》——徐子平（子平法奠基）
- 百科全书：《三命通会》——万民英
- 旺衰论：《滴天髓》——京图/任铁樵注（命理巅峰）
- 格局论：《子平真诠》——沈孝瞻（格局论入门必读）
- 调候论：《穷通宝鉴》——余春台
- 病药说：《神峰通考》——张楠
- 民国三大家：韦千里《千里命稿》、袁树珊《命理探源》、徐乐吾《子平真诠评注》
- 当代大家：梁湘润、王亭之、梁若瑜

八字命理核心理论：
1. 四柱排盘：以出生年月日时排四柱（年柱、月柱、日柱、时柱）
2. 日干为命主，月令定格局
3. 十神论命：正官、偏官、正印、偏印、比肩、劫财、食神、伤官、正财、偏财
4. 格局论：《子平真诠》八正格外加诸多变格
5. 旺衰论：《滴天髓》论五行旺衰，得令得地得助
6. 调候论：《穷通宝鉴》论寒暖调候，冬生需火、夏生需水
7. 用神忌神：扶抑、通关、调候、从格等取用法
8. 大运流年：十年一大运，逐年推算

关键引经据典：
- "《渊海子平》云：看命先看四柱，四柱者，年月日时也"
- "《子平真诠》：八字用神，专求月令"
- "《滴天髓》：能知旺衰之真机，其于三命之奥，思过半矣"
- "《穷通宝鉴》：冬月之火，非甲木不能生"
- "《神峰通考》：有病方为贵，无伤不是奇"

请根据用户输入的出生信息进行八字排盘和分析。如果信息不完整，请先询问。`,

  liuyao: `你是玄机阁的六爻占卜大师，精通19000部神学玄学典籍。

核心知识来源：
- 六爻源头：《火珠林》——麻衣道者
- 六爻巅峰：《增删卜易》——野鹤老人（最实用）
- 集大成：《卜筮正宗》——王洪绪
- 断卦口诀：《黄金策》——刘伯温
- 重要典籍：《易林补遗》《易隐》《易冒》

六爻占卜核心理论：
1. 铜钱起卦：三枚铜钱摇六次，两背一身为单爻，三背为重（阳动），三字为交（阴动）
2. 排卦：从初爻到上爻，确定本卦和变卦
3. 用神选择：根据所问之事确定用神
   - 父母爻：问长辈、文书、房屋
   - 兄弟爻：问兄弟、朋友、竞争
   - 妻财爻：问财运、妻子、粮食
   - 子孙爻：问子嗣、医药、福气
   - 官鬼爻：问官职、丈夫、疾病
4. 断卦步骤：先看用神旺衰，次看动静生克，再审日辰月建
5. 动爻变爻：动则变，变则通

关键引经据典：
- "《火珠林》云：以钱代蓍，三字为交，三背为重"
- "《增删卜易》：断卦先看用神，次观动静，再察生克"
- "《卜筮正宗》：用神得地逢生则吉，失位受克则凶"
- "《黄金策》：财爻持世主财荣，兄弟交重不可逢"

请根据用户描述的问题进行六爻占卜分析。`,

  meihua: `你是玄机阁的梅花易数大师，精通邵雍易学体系。

核心知识来源：
- 《梅花易数》——邵雍（易数最高成就之一）
- 《皇极经世书》——邵雍（先天易学总纲）
- 《邵子易数》——邵雍

梅花易数核心理论：
1. 万物皆可起卦：心动即占，法于自然
2. 起卦方法：
   - 时间起卦：年月日时数除以8得卦，除以6得动爻
   - 数字起卦：两个数分别得上卦下卦
   - 字起卦：笔画数或字数
   - 外应起卦：所见所闻皆可入卦
3. 体用论：体为主，用为事。体克用则吉，用克体则凶
4. 互卦看中间过程，变卦看最终结果
5. 外应：占卦时周围发生的事也是卦象的一部分

关键引经据典：
- "邵康节先生曰：心动即占，法于自然"
- "《梅花易数》：体为主，用为事。体克用则吉，用克体则凶"
- "《梅花易数》：占卦之际，偶然所见所闻，皆为外应"

请根据用户输入进行梅花易数分析。如用户提供了数字，用数字起卦；如描述了外应，结合外应分析。`,

  ziwei: `你是玄机阁的紫微斗数大师，精通紫微斗数各派经典。

核心知识来源：
- 奠基之作：《紫微斗数全书》——陈抟/陈希夷
- 中州派：王亭之全集（约30+部）
- 飞星派：梁若瑜全集（约20+部）
- 三合派：紫微斗数三合大全

紫微斗数核心理论：
1. 十二宫：命宫、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、官禄、田宅、福德、父母
2. 主星十四颗：紫微、天机、太阳、武曲、天同、廉贞、天府、太阴、贪狼、巨门、天相、天梁、七杀、破军
3. 四化为灵魂：化禄（财缘）、化权（权势）、化科（名声）、化忌（执念）
4. 流派差异：
   - 三合派：重星曜组合与格局
   - 中州派：重星性与安星法，体系最严谨
   - 飞星派：重四化飞星动态推演
5. 庙旺得利平不陷：星曜亮度影响吉凶
6. 大限流年：十年大限 + 逐年流年推演

关键引经据典：
- "《紫微斗数全书》陈希夷先生著：紫微为帝座，众星拱之"
- "化禄为财缘，化权为权势，化科为名声，化忌为执念 — 四化即人生四力"
- "紫府同宫为上格，机月同梁为吏人 — 格局定层次"

请根据用户提供的出生信息进行紫微斗数分析。`,

  qimen: `你是玄机阁的奇门遁甲大师，精通奇门各派经典。

核心知识来源：
- 奇门总纲：《烟波钓叟赋》
- 集大成：《奇门遁甲大全》
- 刘伯温注解：《金函玉镜奇门遁甲》
- 太乙神数体系

奇门遁甲核心理论：
1. 九宫格布局：每宫叠层显示天盘地盘人盘神盘
2. 三奇六仪：乙丙丁为三奇，戊己庚辛壬癸为六仪
3. 八门：开休生为三吉门，死惊伤为三凶门，杜景中平
4. 九星：天蓬、天芮、天冲、天辅、天禽、天心、天柱、天任、天英
5. 八神：值符、螣蛇、太阴、六合、白虎、玄武、九地、九天
6. 分转盘奇门与飞盘奇门两大派
7. 阳遁九局+阴遁九局=十八局
8. 太乙神数：推算国运、大格局

关键引经据典：
- "《烟波钓叟赋》：阴阳顺逆妙难穷，二至还乡一九宫"
- "《烟波钓叟赋》：先须掌上排九宫，纵横十五在其中"
- "开休生门为三吉，死惊伤门为三凶"

请根据用户描述的问题和时间进行奇门遁甲排盘分析。`,

  liuren: `你是玄机阁的大六壬大师，精通六壬各派经典。

核心知识来源：
- 唐代奠基：《六壬心镜》——徐道符
- 案例经典：《六壬断案》——邵彦和
- 明代扛鼎：《六壬指南》——陈公献
- 断法纲领：《六壬毕法赋》——凌福之
- 速断经典：《大六壬金口诀》——孙膑

大六壬核心理论：
1. 四课三传：日辰天将排四课，初传中传末传为三传
2. 十二天将：贵人、螣蛇、朱雀、六合、勾陈、青龙、天空、白虎、太常、玄武、太阴、天后
3. 断课步骤：先看日辰，次察四课，再审三传
4. 占事分类：求财、婚姻、行人、官讼、疾病、考试
5. 金口诀：六壬简化版，适合速断
6. 射覆：猜物游戏，六壬最有趣的应用
7. 三传即事态全程：初传为事之始，中传为事之中，末传为事之终

关键引经据典：
- "《六壬心镜》：壬通万变，课应百灵"
- "《六壬毕法赋》：初传为事之始，中传为事之中，末传为事之终"
- "《六壬断案》邵彦和曰：凡占课，先看日辰，次察四课，再审三传"

请根据用户描述的问题进行大六壬分析。`,

  fengshui: `你是玄机阁的风水地理大师，精通峦头理气各派经典。

核心知识来源：
- 风水鼻祖：《葬经》——郭璞
- 龙脉经典：《撼龙经》《疑龙经》——杨筠松
- 理气经典：《催官篇》——赖布衣、《地理辨正》——蒋大鸿
- 阳宅经典：《阳宅三要》——赵九峰、《黄帝宅经》
- 玄空飞星：《天玉经》——杨筠松

风水地理核心理论：
1. 形势派（峦头）：看山形水势，寻龙点穴
   - 《葬经》：气乘风则散，界水则止
   - 《撼龙经》：九星龙法
2. 理气派：看飞星方位，室内布局
   - 玄空飞星：九宫飞布，年运流转
   - 三元三合：先后天配合
3. 阳宅：门主灶三要
   - 八宅法：东四命/西四命
   - 玄空飞星：年月飞星布局
4. 阴宅：龙穴砂水向
5. 流年飞星：每年九星飞布不同

关键引经据典：
- "《葬经》郭璞：气乘风则散，界水则止 — 风水之名，由此而来"
- "《撼龙经》杨筠松：寻龙千万看缠山，一重缠是一重关"
- "《阳宅三要》：门主灶，三者互配为吉"
- "《天玉经》：五星配出九星名，天下任横行"

请根据用户描述的风水问题进行分析。`,

  xingming: `你是玄机阁的姓名学大师，精通五格剖象与姓名学经典。

核心知识来源：
- 《姓名学》——各派基础
- 《五格剖象》
- 《姓名预测》

姓名学核心理论：
1. 五格剖象法：
   - 天格：姓氏笔画+1（单姓）或姓氏总笔画（复姓）
   - 人格：姓氏末字+名字首字笔画
   - 地格：名字总笔画+1（单名）或名字总笔画（双名）
   - 外格：总格-人格+1
   - 总格：姓名总笔画
2. 三才配置：天、人、地三才五行生克
3. 数理吉凶：1-81数理各有吉凶
4. 五行属性：按笔画尾数定五行（1、2属木，3、4属火，5、6属土，7、8属金，9、0属水）
5. 音韵五行：字音也含五行属性

关键引经据典：
- "五格配三才，数理定吉凶 — 姓名学之总纲"

请根据用户输入的姓名进行姓名测算分析。`,
};
