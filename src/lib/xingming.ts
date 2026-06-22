/**
 * 姓名测算算法
 * 依据：五格剖象法、三才配置
 * 
 * 核心：按康熙字典笔画计算五格数理，配合三才五行生克
 */

// ============ 基础常量 ============

// 八十一数理吉凶表（1-81）
const SHU_LI_JI_XIONG: Record<number, { jiXiong: string; hanYi: string }> = {
  1: { jiXiong: '大吉', hanYi: '天地开泰，万事成就' },
  2: { jiXiong: '大凶', hanYi: '动摇不安，根基不固' },
  3: { jiXiong: '大吉', hanYi: '进取如意，智谋优秀' },
  4: { jiXiong: '大凶', hanYi: '万事休止，破损凶兆' },
  5: { jiXiong: '大吉', hanYi: '福禄长寿，名利双收' },
  6: { jiXiong: '大吉', hanYi: '安稳余庆，贵人格' },
  7: { jiXiong: '吉', hanYi: '刚毅果断，精力旺盛' },
  8: { jiXiong: '吉', hanYi: '意志坚刚，勤勉发达' },
  9: { jiXiong: '大凶', hanYi: '兴尽凶始，穷苦困逆' },
  10: { jiXiong: '大凶', hanYi: '万事终局，乌云蔽月' },
  11: { jiXiong: '大吉', hanYi: '旱苗逢雨，稳健吉顺' },
  12: { jiXiong: '大凶', hanYi: '薄弱无力，凶数代表' },
  13: { jiXiong: '大吉', hanYi: '智略超群，春日牡丹' },
  14: { jiXiong: '大凶', hanYi: '忍得苦难，浮沉破败' },
  15: { jiXiong: '大吉', hanYi: '福寿圆满，富贵荣誉' },
  16: { jiXiong: '大吉', hanYi: '贵人相助，成就大业' },
  17: { jiXiong: '半吉', hanYi: '刚柔兼备，权威显达' },
  18: { jiXiong: '大吉', hanYi: '有志竟成，铁石之意' },
  19: { jiXiong: '大凶', hanYi: '遮云蔽月，多灾多难' },
  20: { jiXiong: '大凶', hanYi: '非业破运，灾祸重重' },
  21: { jiXiong: '大吉', hanYi: '明月光照，独立权威' },
  22: { jiXiong: '大凶', hanYi: '秋草逢霜，怀才不遇' },
  23: { jiXiong: '大吉', hanYi: '旭日东升，壮丽壮观' },
  24: { jiXiong: '大吉', hanYi: '家门余庆，金钱丰盈' },
  25: { jiXiong: '大吉', hanYi: '资性英敏，才能奇异' },
  26: { jiXiong: '半吉半凶', hanYi: '变怪之谜，英雄豪杰' },
  27: { jiXiong: '半吉半凶', hanYi: '欲望无止，自信心强' },
  28: { jiXiong: '大凶', hanYi: '自豪生离，遭难之数' },
  29: { jiXiong: '大吉', hanYi: '智谋优秀，财力归集' },
  30: { jiXiong: '半吉半凶', hanYi: '浮沉不定，绝死逢生' },
  31: { jiXiong: '大吉', hanYi: '智勇得志，春日花开' },
  32: { jiXiong: '大吉', hanYi: '宝马金鞍，侥幸多望' },
  33: { jiXiong: '大吉', hanYi: '旭日升天，鸾凤相会' },
  34: { jiXiong: '大凶', hanYi: '破家之身，见识短小' },
  35: { jiXiong: '大吉', hanYi: '温良和顺，平安如意' },
  36: { jiXiong: '半吉半凶', hanYi: '波澜壮阔，侠义之气' },
  37: { jiXiong: '大吉', hanYi: '权威显达，吉人天相' },
  38: { jiXiong: '半吉半凶', hanYi: '磨铁成针，意志薄弱' },
  39: { jiXiong: '大吉', hanYi: '富贵荣华，福寿绵长' },
  40: { jiXiong: '半吉半凶', hanYi: '退安享福，谨防不安' },
  41: { jiXiong: '大吉', hanYi: '德望高大，纯阳独秀' },
  42: { jiXiong: '半吉半凶', hanYi: '寒蝉在柳，十艺不成' },
  43: { jiXiong: '大凶', hanYi: '散财破产，薄弱散漫' },
  44: { jiXiong: '大凶', hanYi: '烦闷损寿，破家亡身' },
  45: { jiXiong: '大吉', hanYi: '顺风扬帆，新生泰和' },
  46: { jiXiong: '大凶', hanYi: '浪里淘金，载宝沉舟' },
  47: { jiXiong: '大吉', hanYi: '点石成金，花开之象' },
  48: { jiXiong: '大吉', hanYi: '古松立鹤，德智兼备' },
  49: { jiXiong: '半吉半凶', hanYi: '吉凶难分，转变成空' },
  50: { jiXiong: '半吉半凶', hanYi: '吉凶互见，一成一败' },
  51: { jiXiong: '半吉半凶', hanYi: '盛衰交加，浮沉不定' },
  52: { jiXiong: '大吉', hanYi: '眼望高山，达眼望明' },
  53: { jiXiong: '半吉半凶', hanYi: '忧愁困苦，内心忧愁' },
  54: { jiXiong: '大凶', hanYi: '多难短命，难望成功' },
  55: { jiXiong: '半吉半凶', hanYi: '外美内苦，善善恶恶' },
  56: { jiXiong: '大凶', hanYi: '浪里行舟，历尽艰辛' },
  57: { jiXiong: '半吉半凶', hanYi: '寒雪青松，苦尽甘来' },
  58: { jiXiong: '半吉半凶', hanYi: '晚行遇月，沉浮多端' },
  59: { jiXiong: '大凶', hanYi: '寒蝉悲风，意志薄弱' },
  60: { jiXiong: '大凶', hanYi: '无谋之人，暗黑无光' },
  61: { jiXiong: '大吉', hanYi: '名利双收，牡丹芙蓉' },
  62: { jiXiong: '大凶', hanYi: '衰败孤独，烦闷损寿' },
  63: { jiXiong: '大吉', hanYi: '万物化育，繁荣富贵' },
  64: { jiXiong: '大凶', hanYi: '骨肉分离，见异思迁' },
  65: { jiXiong: '大吉', hanYi: '富贵至极，长寿安康' },
  66: { jiXiong: '大凶', hanYi: '岩头步马，黑暗无光' },
  67: { jiXiong: '大吉', hanYi: '通达畅利，顺风行之' },
  68: { jiXiong: '大吉', hanYi: '兴家立业，发明奇功' },
  69: { jiXiong: '大凶', hanYi: '坐立不安，非业穷途' },
  70: { jiXiong: '大凶', hanYi: '惨淡经营，空虚命运' },
  71: { jiXiong: '半吉半凶', hanYi: '勤勉奋斗，吉凶参半' },
  72: { jiXiong: '大凶', hanYi: '利不及费，劳苦不绝' },
  73: { jiXiong: '半吉半凶', hanYi: '高志无谋，苦难之中' },
  74: { jiXiong: '大凶', hanYi: '沉沦逆境，无能无力' },
  75: { jiXiong: '半吉半凶', hanYi: '退守可安，发迹甚迟' },
  76: { jiXiong: '大凶', hanYi: '倾覆离散，穷困之数' },
  77: { jiXiong: '半吉半凶', hanYi: '家庭有缘，半吉半凶' },
  78: { jiXiong: '半吉半凶', hanYi: '晚景凄清，功名不立' },
  79: { jiXiong: '大凶', hanYi: '挽回乏力，身疲力竭' },
  80: { jiXiong: '半吉半凶', hanYi: '最凶之数，退守保安' },
  81: { jiXiong: '大吉', hanYi: '万物回春，还本归元' },
};

// 数理五行（尾数论五行：1/2木 3/4火 5/6土 7/8金 9/0水）
function shuLiWuXing(num: number): string {
  const last = num % 10;
  if (last === 1 || last === 2) return '木';
  if (last === 3 || last === 4) return '火';
  if (last === 5 || last === 6) return '土';
  if (last === 7 || last === 8) return '金';
  return '水';
}

// 五行生克关系
const SHENG: Record<string, string> = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
const KE: Record<string, string> = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };

// 常见汉字康熙笔画（简化版，覆盖最常用姓氏和字）
const KANGXI_BIHUA: Record<string, number> = {
  // 常见姓氏
  '王': 4, '李': 7, '张': 11, '刘': 15, '陈': 16, '杨': 13, '黄': 12, '赵': 14,
  '周': 8, '吴': 7, '徐': 10, '孙': 10, '马': 10, '朱': 6, '胡': 11, '郭': 15,
  '何': 7, '林': 8, '罗': 20, '高': 10, '梁': 11, '郑': 19, '谢': 17, '宋': 7,
  '唐': 10, '韩': 17, '曹': 11, '许': 11, '邓': 19, '冯': 12, '彭': 12, '曾': 12,
  '萧': 18, '蔡': 17, '潘': 16, '田': 5, '董': 15, '袁': 10, '于': 3, '余': 7,
  '叶': 15, '蒋': 17, '杜': 7, '苏': 22, '魏': 18, '程': 12, '吕': 7, '丁': 2,
  '沈': 8, '任': 6, '姚': 9, '卢': 16, '傅': 12, '钟': 17, '姜': 9, '崔': 11,
  '谭': 19, '廖': 14, '范': 15, '汪': 8, '石': 5, '金': 8, '韦': 9, '贾': 13,
  '夏': 10, '付': 5, '方': 4, '邹': 17, '熊': 14, '白': 5, '孟': 8, '秦': 10,
  '邱': 12, '侯': 9, '江': 7, '尹': 4, '薛': 19, '闫': 11, '雷': 13, '龙': 16,
  '段': 9, '郝': 14, '孔': 4, '邵': 12, '史': 5, '武': 8, '贺': 12, '毛': 4,
  // 常用名字用字
  '明': 8, '华': 14, '文': 4, '建': 9, '国': 11, '成': 7, '德': 15, '志': 7,
  '军': 9, '伟': 11, '强': 12, '平': 5, '刚': 10, '勇': 9, '峰': 10, '杰': 12,
  '磊': 15, '鑫': 24, '浩': 11, '宇': 6, '轩': 10, '涛': 18, '博': 12, '毅': 15,
  '健': 11, '亮': 9, '飞': 9, '鹏': 19, '超': 12, '帅': 9, '翔': 12,
  '玉': 5, '秀': 7, '英': 11, '美': 9, '丽': 19, '芳': 10, '娟': 10, '敏': 11,
  '静': 16, '洁': 16, '琳': 13, '萍': 14, '红': 9, '梅': 11, '兰': 23, '燕': 16,
  '云': 12, '莲': 17, '真': 10, '珠': 11, '雪': 11, '婷': 12, '慧': 15, '颖': 16,
  '佳': 8, '欣': 8, '怡': 9, '思': 9, '雨': 8, '晨': 11, '子': 3, '一': 1,
  '大': 3, '小': 3, '天': 4, '人': 2, '生': 5, '海': 11, '山': 3, '水': 4,
  '春': 9, '秋': 9, '冬': 5, '阳': 17, '月': 4, '星': 9, '光': 6, '安': 6,
  '康': 11, '福': 14, '禄': 13, '寿': 14, '富': 12, '贵': 12, '荣': 14, '昌': 8,
};

// ============ 排盘接口 ============

export interface XingMingPaiPan {
  xingMing: string;          // 姓名
  ziShu: number;             // 字数
  biHuaList: number[];       // 每字康熙笔画
  tianGe: number;            // 天格
  renGe: number;             // 人格
  diGe: number;              // 地格
  waiGe: number;             // 外格
  zongGe: number;            // 总格
  tianGeWuXing: string;      // 天格五行
  renGeWuXing: string;       // 人格五行
  diGeWuXing: string;        // 地格五行
  sanCai: string;            // 三才配置（天人地）
  sanCaiRelation: string;    // 三才生克关系
  tianGeJiXiong: string;     // 天格吉凶
  renGeJiXiong: string;      // 人格吉凶
  diGeJiXiong: string;       // 地格吉凶
  waiGeJiXiong: string;      // 外格吉凶
  zongGeJiXiong: string;     // 总格吉凶
  tianGeHanYi: string;       // 天格含义
  renGeHanYi: string;        // 人格含义
  diGeHanYi: string;         // 地格含义
  waiGeHanYi: string;        // 外格含义
  zongGeHanYi: string;       // 总格含义
  zongPing: string;          // 综合评价
  jianYi: string;            // 建议
}

// ============ 计算函数 ============

/** 获取康熙笔画（查表+默认规则） */
function getKangXiBiHua(char: string): number {
  if (KANGXI_BIHUA[char]) return KANGXI_BIHUA[char];
  // 未收录字：按简体笔画估算（简化处理）
  return char.length * 4; // 粗略估算
}

/** 计算五格 */
export function calculateXingMing(xingMing: string): XingMingPaiPan {
  const chars = xingMing.split('');
  const ziShu = chars.length;
  const biHuaList = chars.map(c => getKangXiBiHua(c));
  
  let tianGe: number, renGe: number, diGe: number, waiGe: number, zongGe: number;
  
  if (ziShu === 2) {
    // 单姓双字名：姓+名1+名2
    tianGe = biHuaList[0] + 1;  // 天格=姓笔画+1
    renGe = biHuaList[0] + biHuaList[1];  // 人格=姓+名1
    diGe = biHuaList[1] + biHuaList[2];   // 地格=名1+名2
    waiGe = biHuaList[2] + 1;    // 外格=名2+1
    zongGe = biHuaList.reduce((a, b) => a + b, 0);  // 总格=所有笔画
  } else if (ziShu === 3) {
    // 双姓或复姓单名
    tianGe = biHuaList[0] + biHuaList[1];  // 天格=姓1+姓2
    renGe = biHuaList[1] + biHuaList[2];   // 人格=姓2+名1
    diGe = biHuaList[2] + 1;    // 地格=名1+1
    waiGe = biHuaList[0] + 1;   // 外格=姓1+1
    zongGe = biHuaList.reduce((a, b) => a + b, 0);
  } else if (ziShu === 4) {
    // 双姓双名
    tianGe = biHuaList[0] + biHuaList[1];
    renGe = biHuaList[1] + biHuaList[2];
    diGe = biHuaList[2] + biHuaList[3];
    waiGe = biHuaList[0] + biHuaList[3];
    zongGe = biHuaList.reduce((a, b) => a + b, 0);
  } else {
    // 单名单字
    tianGe = biHuaList[0] + 1;
    renGe = biHuaList[0] + (biHuaList[1] || 1);
    diGe = (biHuaList[1] || 1) + 1;
    waiGe = 2;
    zongGe = biHuaList.reduce((a, b) => a + b, 0);
  }
  
  // 取81数理
  const mod81 = (n: number) => n > 81 ? (n % 80 === 0 ? 80 : n % 80) : n;
  
  const tianGeNum = mod81(tianGe);
  const renGeNum = mod81(renGe);
  const diGeNum = mod81(diGe);
  const waiGeNum = mod81(waiGe);
  const zongGeNum = mod81(zongGe);
  
  // 数理五行
  const tianGeWuXing = shuLiWuXing(tianGe);
  const renGeWuXing = shuLiWuXing(renGe);
  const diGeWuXing = shuLiWuXing(diGe);
  
  // 三才配置
  const sanCai = `${tianGeWuXing}${renGeWuXing}${diGeWuXing}`;
  const sanCaiRelation = getSanCaiRelation(tianGeWuXing, renGeWuXing, diGeWuXing);
  
  // 吉凶判定
  const tianGeInfo = SHU_LI_JI_XIONG[tianGeNum] || { jiXiong: '平', hanYi: '无特殊含义' };
  const renGeInfo = SHU_LI_JI_XIONG[renGeNum] || { jiXiong: '平', hanYi: '无特殊含义' };
  const diGeInfo = SHU_LI_JI_XIONG[diGeNum] || { jiXiong: '平', hanYi: '无特殊含义' };
  const waiGeInfo = SHU_LI_JI_XIONG[waiGeNum] || { jiXiong: '平', hanYi: '无特殊含义' };
  const zongGeInfo = SHU_LI_JI_XIONG[zongGeNum] || { jiXiong: '平', hanYi: '无特殊含义' };
  
  // 综合评价
  const zongPing = evaluateZong(tianGeInfo.jiXiong, renGeInfo.jiXiong, diGeInfo.jiXiong, zongGeInfo.jiXiong, sanCaiRelation);
  const jianYi = generateJianYi(renGeInfo.jiXiong, zongGeInfo.jiXiong, sanCaiRelation);
  
  return {
    xingMing,
    ziShu,
    biHuaList,
    tianGe, renGe, diGe, waiGe, zongGe,
    tianGeWuXing, renGeWuXing, diGeWuXing,
    sanCai, sanCaiRelation,
    tianGeJiXiong: tianGeInfo.jiXiong, tianGeHanYi: tianGeInfo.hanYi,
    renGeJiXiong: renGeInfo.jiXiong, renGeHanYi: renGeInfo.hanYi,
    diGeJiXiong: diGeInfo.jiXiong, diGeHanYi: diGeInfo.hanYi,
    waiGeJiXiong: waiGeInfo.jiXiong, waiGeHanYi: waiGeInfo.hanYi,
    zongGeJiXiong: zongGeInfo.jiXiong, zongGeHanYi: zongGeInfo.hanYi,
    zongPing, jianYi,
  };
}

function getSanCaiRelation(tian: string, ren: string, di: string): string {
  const parts: string[] = [];
  // 天→人
  if (SHENG[tian] === ren) parts.push('天生人');
  else if (KE[tian] === ren) parts.push('天克人');
  else if (tian === ren) parts.push('天人比和');
  // 人→地
  if (SHENG[ren] === di) parts.push('人生地');
  else if (KE[ren] === di) parts.push('人克地');
  else if (ren === di) parts.push('人地比和');
  
  return parts.join('，') || '天人地无直接生克';
}

function evaluateZong(tian: string, ren: string, di: string, zong: string, sanCai: string): string {
  const jis = [tian, ren, di, zong].filter(x => x.includes('吉') && !x.includes('凶')).length;
  const xiongs = [tian, ren, di, zong].filter(x => x.includes('凶')).length;
  
  if (jis >= 3 && xiongs === 0 && !sanCai.includes('克')) return '上吉之名，福禄双全';
  if (jis >= 2 && xiongs <= 1 && !sanCai.includes('克')) return '中吉之名，衣食无忧';
  if (jis >= 2 && xiongs <= 1) return '中平之名，吉凶参半';
  if (jis >= 1 && xiongs <= 2) return '中下之名，须防不利';
  return '凶名，建议改名';
}

function generateJianYi(renJiXiong: string, zongJiXiong: string, sanCai: string): string {
  const points: string[] = [];
  if (renJiXiong.includes('吉')) points.push('人格吉数，主运良好');
  else if (renJiXiong.includes('凶')) points.push('人格凶数，主运受困，建议改名调整');
  if (zongJiXiong.includes('吉')) points.push('总格吉数，晚运有福');
  else if (zongJiXiong.includes('凶')) points.push('总格凶数，晚运不顺');
  if (sanCai.includes('克')) points.push('三才有克，需注意健康和人际关系');
  else if (sanCai.includes('生')) points.push('三才相生，根基稳固');
  return points.join('；') || '整体平稳';
}

// ============ 格式化输出 ============

export function formatXingMingPaiPan(paiPan: XingMingPaiPan): string {
  const lines: string[] = [];
  lines.push(`=== 姓名测算（五格剖象法）===`);
  lines.push(`姓名：${paiPan.xingMing}（${paiPan.ziShu}字）`);
  lines.push(`康熙笔画：${paiPan.biHuaList.join('、')}`);
  lines.push('');
  
  lines.push('--- 五格数理 ---');
  lines.push(`天格：${paiPan.tianGe}（${paiPan.tianGeWuXing}）${paiPan.tianGeJiXiong} —— ${paiPan.tianGeHanYi}`);
  lines.push(`人格：${paiPan.renGe}（${paiPan.renGeWuXing}）${paiPan.renGeJiXiong} —— ${paiPan.renGeHanYi} 【主运，最重要】`);
  lines.push(`地格：${paiPan.diGe}（${paiPan.diGeWuXing}）${paiPan.diGeJiXiong} —— ${paiPan.diGeHanYi}`);
  lines.push(`外格：${paiPan.waiGe} ${paiPan.waiGeJiXiong}`);
  lines.push(`总格：${paiPan.zongGe} ${paiPan.zongGeJiXiong} —— ${paiPan.zongGeHanYi} 【晚运】`);
  lines.push('');
  
  lines.push('--- 三才配置 ---');
  lines.push(`天（${paiPan.tianGeWuXing}）→人（${paiPan.renGeWuXing}）→地（${paiPan.diGeWuXing}）`);
  lines.push(`三才关系：${paiPan.sanCaiRelation}`);
  lines.push('');
  
  lines.push('--- 综合评价 ---');
  lines.push(`评价：${paiPan.zongPing}`);
  lines.push(`建议：${paiPan.jianYi}`);
  
  return lines.join('\n');
}
