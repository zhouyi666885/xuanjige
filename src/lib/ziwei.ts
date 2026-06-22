// ========== 紫微斗数排盘算法 ==========
// 基于《紫微斗数全书》（陈希夷）+ 中州派（王亭之）+ 飞星派（梁若瑜）
// 实现：14主星安星、12宫安宫、四化飞星、星曜亮度

// ========== 基础数据 ==========

const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const DI_ZHI_YEAR: Record<number, string> = { 0: '子', 1: '丑', 2: '寅', 3: '卯', 4: '辰', 5: '巳', 6: '午', 7: '未', 8: '申', 9: '酉', 10: '戌', 11: '亥' };

// 十四主星
const ZHU_XING = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞',
  '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
] as const;

type ZhuXingName = typeof ZHU_XING[number];

// 紫微星系（逆时针）：紫微、天机、（空）、太阳、武曲、天同、（空）、廉贞
// 天府星系（顺时针）：天府、太阴、贪狼、巨门、天相、天梁、七杀、（空）、（空）、破军
// 注：太阳属于紫微星系

// 星曜亮度（庙旺得利平不陷）
type LiangDu = '庙' | '旺' | '得' | '利' | '平' | '不' | '陷';

// 12宫名称
const GONG_NAMES = [
  '命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫',
  '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫',
] as const;

// 六吉星
const LIU_JI = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'] as const;
// 六煞星
const LIU_SHA = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'] as const;
// 四化
const SI_HUA_NAMES = ['化禄', '化权', '化科', '化忌'] as const;

// ========== 排盘输入 ==========
export interface ZiWeiInput {
  year: number;       // 农历年
  month: number;      // 农历月
  day: number;        // 农历日
  hour: number;       // 出生时辰（0-23小时）
  minute: number;     // 分钟
  gender: '男' | '女'; // 性别
  yearGan: string;    // 年干（用于四化）
  yearZhi: string;    // 年支（用于纳音五行局）
}

// ========== 排盘输出 ==========
export interface ZiWeiStar {
  name: string;
  liangDu: LiangDu;   // 亮度
  hua?: string;        // 四化（化禄/化权/化科/化忌）
  isZhuXing: boolean;  // 是否主星
}

export interface ZiWeiGong {
  name: string;           // 宫名
  diZhi: string;          // 地支
  tianGan: string;        // 天干
  stars: ZiWeiStar[];     // 星曜
  daXian?: string;        // 大限（十年运）
  daXianAge?: [number, number]; // 大限起止年龄
}

export interface ZiWeiPaiPan {
  input: ZiWeiInput;
  mingGongIndex: number;     // 命宫所在宫位索引(0-11)
  shenGongIndex: number;     // 身宫所在宫位索引
  wuXingJu: string;          // 五行局（水二局、木三局、金四局、土五局、火六局）
  gongs: ZiWeiGong[];        // 12宫
  siHua: Record<string, string>; // 四化星（星名→化）
  mingZhu: string;           // 命主星
  shenZhu: string;           // 身主星
}

// ========== 命宫安法 ==========
// 寅上起正月，顺数至生月，再逆数至生时 → 命宫
// 顺数至生时 → 身宫
function getMingShenGong(month: number, hour: number): { mingGong: number; shenGong: number } {
  // 寅=索引2，从寅起正月
  const yinIdx = 2;
  const monthPos = ((yinIdx + month - 1) % 12);
  // 命宫：从生月位置逆数至生时
  const shiChenIdx = Math.floor((hour + 1) / 2) % 12; // 时辰索引：子=0, 丑=1, ...
  const mingGong = ((monthPos - shiChenIdx) % 12 + 12) % 12;
  // 身宫：从生月位置顺数至生时
  const shenGong = ((monthPos + shiChenIdx) % 12 + 12) % 12;
  return { mingGong, shenGong };
}

// ========== 十二宫安法 ==========
// 从命宫起，逆时针安：命、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、官禄、田宅、福德、父母
function arrangeGongNames(mingGongIdx: number): string[] {
  const names = [...GONG_NAMES];
  const result: string[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = ((mingGongIdx - i) % 12 + 12) % 12;
    result[idx] = names[i];
  }
  return result;
}

// ========== 天干安法 ==========
// 五虎遁：与年干相关，寅宫天干起法
function getGongTianGan(yearGan: string): string[] {
  const yearGanIdx = TIANGAN.indexOf(yearGan);
  // 甲己→丙寅, 乙庚→戊寅, 丙辛→庚寅, 丁壬→壬寅, 戊癸→甲寅
  const startGanMap = [2, 4, 6, 8, 0]; // 寅宫天干起始
  const startGan = startGanMap[yearGanIdx % 5];
  const result: string[] = [];
  for (let i = 0; i < 12; i++) {
    // 子丑寅卯... → 从寅(2)开始排天干
    const ganIdx = ((startGan + i - 2) % 10 + 10) % 10;
    result[i] = TIANGAN[ganIdx];
  }
  return result;
}

// ========== 五行局 ==========
// 命宫天干+地支 → 纳音 → 五行局数
const NAYIN_TABLE: Record<string, string> = {
  '甲子': '海中金', '乙丑': '海中金', '丙寅': '炉中火', '丁卯': '炉中火',
  '戊辰': '大林木', '己巳': '大林木', '庚午': '路旁土', '辛未': '路旁土',
  '壬申': '剑锋金', '癸酉': '剑锋金', '甲戌': '山头火', '乙亥': '山头火',
  '丙子': '涧下水', '丁丑': '涧下水', '戊寅': '城头土', '己卯': '城头土',
  '庚辰': '白蜡金', '辛巳': '白蜡金', '壬午': '杨柳木', '癸未': '杨柳木',
  '甲申': '泉中水', '乙酉': '泉中水', '丙戌': '屋上土', '丁亥': '屋上土',
  '戊子': '霹雳火', '己丑': '霹雳火', '庚寅': '松柏木', '辛卯': '松柏木',
  '壬辰': '长流水', '癸巳': '长流水', '甲午': '沙中金', '乙未': '沙中金',
  '丙申': '山下火', '丁酉': '山下火', '戊戌': '平地木', '己亥': '平地木',
  '庚子': '壁上土', '辛丑': '壁上土', '壬寅': '金箔金', '癸卯': '金箔金',
  '甲辰': '覆灯火', '乙巳': '覆灯火', '丙午': '天河水', '丁未': '天河水',
  '戊申': '大驿土', '己酉': '大驿土', '庚戌': '钗钏金', '辛亥': '钗钏金',
  '壬子': '桑柘木', '癸丑': '桑柘木', '甲寅': '大溪水', '乙卯': '大溪水',
  '丙辰': '沙中土', '丁巳': '沙中土', '戊午': '天上火', '己未': '天上火',
  '庚申': '石榴木', '辛酉': '石榴木', '壬戌': '大海水', '癸亥': '大海水',
};

function getWuXingJu(gan: string, zhi: string): string {
  const key = gan + zhi;
  const nayin = NAYIN_TABLE[key] || '';
  if (nayin.includes('金')) return '金四局';
  if (nayin.includes('木')) return '木三局';
  if (nayin.includes('水')) return '水二局';
  if (nayin.includes('火')) return '火六局';
  if (nayin.includes('土')) return '土五局';
  return '水二局'; // 默认
}

function getJuNumber(ju: string): number {
  if (ju.includes('二')) return 2;
  if (ju.includes('三')) return 3;
  if (ju.includes('四')) return 4;
  if (ju.includes('五')) return 5;
  if (ju.includes('六')) return 6;
  return 2;
}

// ========== 紫微星安法 ==========
// 根据五行局数+农历日数 → 紫微星位置
function getZiWeiPosition(day: number, juNumber: number): number {
  // 紫微星安星法：局数×商 ≥ 日数 的最小商
  // 从寅宫(2)开始，商对应宫位
  let remainder = day % juNumber;
  let quotient = Math.floor(day / juNumber);
  if (remainder > 0) quotient += 1;

  // 紫微星位置：从寅起1，每隔一宫
  // 实际算法：根据日数和局数，用除法取整定位
  let pos: number;
  if (remainder === 0) {
    pos = 2 + (quotient - 1) * 1;
  } else {
    pos = 2 + quotient - 1;
  }

  // 更精确的紫微安星法：用查表法
  // 局数×N ≥ 日数 的最小N，N对应宫位偏移
  let n = 1;
  while (juNumber * n < day) n++;
  pos = ((2 + n - 1) % 12);

  return pos;
}

// ========== 天府星安法 ==========
// 紫微与天府相对：紫微在寅，天府在寅；紫微在卯，天府在丑...
// 对称关系：紫微位 + 天府位 = 2+2 = 4（以寅为对称轴）
function getTianFuPosition(ziWeiPos: number): number {
  // 天府与紫微关于寅申线对称
  return ((4 - ziWeiPos) % 12 + 12) % 12;
}

// ========== 紫微星系安法 ==========
// 紫微星逆时针排列：紫微(0)、天机(1)、（空）(2)、太阳(3)、武曲(4)、天同(5)、（空）(6)、廉贞(7)
const ZIWEI_XI_OFFSETS = [0, -1, -2/*空*/, -3, -4, -5, -6/*空*/, -7/*廉贞从寅转*/];
// 修正：紫微星系从紫微位逆时针
const ZIWEI_XI_STARS: { name: ZhuXingName; offset: number }[] = [
  { name: '紫微', offset: 0 },
  { name: '天机', offset: -1 },
  { name: '太阳', offset: -3 },
  { name: '武曲', offset: -4 },
  { name: '天同', offset: -5 },
  { name: '廉贞', offset: -9 }, // 廉贞隔两位
];

// ========== 天府星系安法 ==========
// 天府星系顺时针排列：天府(0)、太阴(1)、贪狼(2)、巨门(3)、天相(4)、天梁(5)、七杀(6)、（空）(7,8)、破军(9)
const TIANFU_XI_STARS: { name: ZhuXingName; offset: number }[] = [
  { name: '天府', offset: 0 },
  { name: '太阴', offset: 1 },
  { name: '贪狼', offset: 2 },
  { name: '巨门', offset: 3 },
  { name: '天相', offset: 4 },
  { name: '天梁', offset: 5 },
  { name: '七杀', offset: 6 },
  { name: '破军', offset: 10 }, // 破军与紫微对宫
];

// 安主星
function arrangeZhuXing(ziWeiPos: number, tianFuPos: number): Map<number, ZhuXingName[]> {
  const starMap = new Map<number, ZhuXingName[]>();

  // 紫微星系
  for (const star of ZIWEI_XI_STARS) {
    const pos = ((ziWeiPos + star.offset) % 12 + 12) % 12;
    if (!starMap.has(pos)) starMap.set(pos, []);
    starMap.get(pos)!.push(star.name);
  }

  // 天府星系
  for (const star of TIANFU_XI_STARS) {
    const pos = ((tianFuPos + star.offset) % 12 + 12) % 12;
    if (!starMap.has(pos)) starMap.set(pos, []);
    starMap.get(pos)!.push(star.name);
  }

  return starMap;
}

// ========== 星曜亮度表 ==========
// 14主星 × 12宫位 的亮度
// 顺序：子丑寅卯辰巳午未申酉戌亥
const LIANGDU_TABLE: Record<ZhuXingName, LiangDu[]> = {
  '紫微': ['旺', '旺', '旺', '利', '平', '平', '庙', '庙', '旺', '旺', '利', '利'],
  '天机': ['旺', '利', '利', '庙', '庙', '平', '旺', '利', '利', '庙', '平', '平'],
  '太阳': ['陷', '陷', '旺', '旺', '庙', '庙', '庙', '旺', '得', '平', '陷', '陷'],
  '武曲': ['庙', '庙', '得', '利', '利', '平', '庙', '庙', '得', '得', '利', '平'],
  '天同': ['旺', '平', '利', '平', '陷', '陷', '旺', '旺', '利', '利', '平', '陷'],
  '廉贞': ['平', '平', '庙', '庙', '平', '利', '陷', '陷', '庙', '利', '平', '利'],
  '天府': ['庙', '庙', '庙', '得', '得', '旺', '庙', '庙', '得', '得', '旺', '旺'],
  '太阴': ['庙', '旺', '陷', '陷', '陷', '平', '庙', '旺', '利', '利', '平', '平'],
  '贪狼': ['庙', '庙', '利', '利', '平', '陷', '旺', '旺', '利', '得', '平', '陷'],
  '巨门': ['旺', '利', '陷', '陷', '利', '平', '庙', '旺', '得', '利', '平', '陷'],
  '天相': ['庙', '旺', '得', '陷', '陷', '利', '庙', '旺', '得', '利', '平', '利'],
  '天梁': ['庙', '旺', '得', '利', '陷', '陷', '庙', '旺', '利', '得', '平', '平'],
  '七杀': ['旺', '旺', '庙', '庙', '平', '平', '旺', '旺', '庙', '庙', '利', '利'],
  '破军': ['旺', '旺', '得', '利', '平', '陷', '庙', '庙', '得', '利', '平', '陷'],
};

function getLiangDu(starName: ZhuXingName, gongIndex: number): LiangDu {
  const table = LIANGDU_TABLE[starName];
  if (!table) return '平';
  return table[gongIndex] || '平';
}

// ========== 六吉星安法 ==========
// 左辅：从辰起正月，顺数至生月
function getZuoFuPos(month: number): number {
  return ((4 + month - 1) % 12); // 辰=4
}
// 右弼：从戌起正月，逆数至生月
function getYouBiPos(month: number): number {
  return ((10 - month + 1 + 12) % 12); // 戌=10
}
// 文昌：从戌起子时，逆数至生时
function getWenChangPos(hour: number): number {
  const shiChenIdx = Math.floor((hour + 1) / 2) % 12;
  return ((10 - shiChenIdx + 12) % 12); // 戌=10, 逆数
}
// 文曲：从辰起子时，顺数至生时
function getWenQuPos(hour: number): number {
  const shiChenIdx = Math.floor((hour + 1) / 2) % 12;
  return ((4 + shiChenIdx) % 12); // 辰=4, 顺数
}
// 天魁：年干决定
function getTianKuiPos(yearGan: string, gender: '男' | '女'): number {
  const map: Record<string, number> = {
    '甲': 1, '戊': 1, '庚': 7,
    '乙': 0, '己': 0,
    '丙': 10, '丁': 10,
    '辛': 5,
    '壬': 3, '癸': 3,
  };
  return map[yearGan] ?? 0;
}
// 天钺：天魁对宫
function getTianYuePos(tianKuiPos: number): number {
  return ((tianKuiPos + 6) % 12);
}

// ========== 六煞星安法 ==========
// 擎羊：禄存前一位
function getQingYangPos(luCunPos: number): number {
  return ((luCunPos + 1) % 12);
}
// 陀罗：禄存后一位
function getTuoLuoPos(luCunPos: number): number {
  return ((luCunPos - 1 + 12) % 12);
}
// 禄存位置：由年干决定
function getLuCunPos(yearGan: string): number {
  const map: Record<string, number> = {
    '甲': 2, '乙': 3, '丙': 5, '丁': 6,
    '戊': 5, '己': 6, '庚': 8, '辛': 9,
    '壬': 11, '癸': 0,
  };
  return map[yearGan] ?? 2;
}
// 火星：由年支+时辰决定
function getHuoXingPos(yearZhi: string, hour: number): number {
  const shiChenIdx = Math.floor((hour + 1) / 2) % 12;
  const zhiIdx = DIZHI.indexOf(yearZhi);
  // 简化：寅午戌→起丑, 申子辰→起寅, 巳酉丑→起卯, 亥卯未→起辰
  const startPosMap = [2, 1, 3, 0]; // 寅午戌→丑(1), 申子辰→寅(2), 巳酉丑→卯(3), 亥卯未→辰(0)
  const group = Math.floor(zhiIdx / 3);
  const startPos = startPosMap[group];
  return ((startPos + shiChenIdx) % 12);
}
// 铃星：与火星配对
function getLingXingPos(yearZhi: string, hour: number): number {
  const huoPos = getHuoXingPos(yearZhi, hour);
  return ((huoPos + 4) % 12); // 简化
}
// 地空：由时辰决定
function getDiKongPos(hour: number): number {
  const shiChenIdx = Math.floor((hour + 1) / 2) % 12;
  return ((11 - shiChenIdx + 12) % 12); // 亥起子时，逆数
}
// 地劫：由时辰决定
function getDiJiePos(hour: number): number {
  const shiChenIdx = Math.floor((hour + 1) / 2) % 12;
  return ((11 + shiChenIdx) % 12); // 亥起子时，顺数
}

// ========== 四化飞星 ==========
// 甲干四化：廉贞化禄、破军化权、武曲化科、太阳化忌
const SI_HUA_TABLE: Record<string, { lu: string; quan: string; ke: string; ji: string }> = {
  '甲': { lu: '廉贞', quan: '破军', ke: '武曲', ji: '太阳' },
  '乙': { lu: '天机', quan: '天梁', ke: '紫微', ji: '太阴' },
  '丙': { lu: '天同', quan: '天机', ke: '文昌', ji: '廉贞' },
  '丁': { lu: '太阴', quan: '天同', ke: '天机', ji: '巨门' },
  '戊': { lu: '贪狼', quan: '太阴', ke: '右弼', ji: '天机' },
  '己': { lu: '武曲', quan: '贪狼', ke: '天梁', ji: '文曲' },
  '庚': { lu: '太阳', quan: '武曲', ke: '太阴', ji: '天同' },
  '辛': { lu: '巨门', quan: '太阳', ke: '文曲', ji: '文昌' },
  '壬': { lu: '天梁', quan: '紫微', ke: '左辅', ji: '武曲' },
  '癸': { lu: '破军', quan: '巨门', ke: '太阴', ji: '贪狼' },
};

// ========== 命主/身主 ==========
// 命主：由命宫地支决定
const MING_ZHU_MAP: Record<string, string> = {
  '子': '贪狼', '丑': '巨门', '寅': '禄存', '卯': '文曲',
  '辰': '廉贞', '巳': '武曲', '午': '破军', '未': '武曲',
  '申': '廉贞', '酉': '文曲', '戌': '禄存', '亥': '巨门',
};
// 身主：由年支决定
const SHEN_ZHU_MAP: Record<string, string> = {
  '子': '火星', '丑': '天相', '寅': '天梁', '卯': '天同',
  '辰': '文昌', '巳': '天机', '午': '火星', '未': '天相',
  '申': '天梁', '酉': '天同', '戌': '文昌', '亥': '天机',
};

// ========== 大限排法 ==========
// 从命宫起，阳男阴女顺行，阴男阳女逆行
// 每宫十年，起始年龄由五行局数决定
function arrangeDaXian(
  mingGongIdx: number,
  juNumber: number,
  yearGan: string,
  gender: '男' | '女'
): { daXianGong: number; startAge: number; endAge: number }[] {
  const isYang = TIANGAN.indexOf(yearGan) % 2 === 0;
  const isMale = gender === '男';
  // 阳男阴女顺行，阴男阳女逆行
  const forward = (isYang && isMale) || (!isYang && !isMale);

  const result: { daXianGong: number; startAge: number; endAge: number }[] = [];
  let currentAge = juNumber; // 起运年龄=局数

  for (let i = 0; i < 12; i++) {
    const offset = forward ? i : -i;
    const gongIdx = ((mingGongIdx + offset) % 12 + 12) % 12;
    const endAge = currentAge + 9;
    result.push({
      daXianGong: gongIdx,
      startAge: currentAge,
      endAge,
    });
    currentAge = endAge + 1;
  }

  return result;
}

// ========== 主排盘函数 ==========
export function paiPan(input: ZiWeiInput): ZiWeiPaiPan {
  // 1. 定命宫、身宫
  const { mingGong, shenGong } = getMingShenGong(input.month, input.hour);

  // 2. 安十二宫名
  const gongNames = arrangeGongNames(mingGong);

  // 3. 安天干
  const gongGans = getGongTianGan(input.yearGan);

  // 4. 定五行局
  const mingGan = gongGans[mingGong];
  const mingZhi = DIZHI[mingGong];
  const wuXingJu = getWuXingJu(mingGan, mingZhi);
  const juNumber = getJuNumber(wuXingJu);

  // 5. 安紫微星
  const ziWeiPos = getZiWeiPosition(input.day, juNumber);

  // 6. 安天府星
  const tianFuPos = getTianFuPosition(ziWeiPos);

  // 7. 安十四主星
  const zhuXingMap = arrangeZhuXing(ziWeiPos, tianFuPos);

  // 8. 安六吉星
  const zuoFuPos = getZuoFuPos(input.month);
  const youBiPos = getYouBiPos(input.month);
  const wenChangPos = getWenChangPos(input.hour);
  const wenQuPos = getWenQuPos(input.hour);
  const tianKuiPos = getTianKuiPos(input.yearGan, input.gender);
  const tianYuePos = getTianYuePos(tianKuiPos);

  // 9. 安六煞星
  const luCunPos = getLuCunPos(input.yearGan);
  const qingYangPos = getQingYangPos(luCunPos);
  const tuoLuoPos = getTuoLuoPos(luCunPos);
  const huoXingPos = getHuoXingPos(input.yearZhi, input.hour);
  const lingXingPos = getLingXingPos(input.yearZhi, input.hour);
  const diKongPos = getDiKongPos(input.hour);
  const diJiePos = getDiJiePos(input.hour);

  // 10. 四化
  const siHua = SI_HUA_TABLE[input.yearGan];
  const siHuaMap: Record<string, string> = {};
  if (siHua) {
    siHuaMap[siHua.lu] = '化禄';
    siHuaMap[siHua.quan] = '化权';
    siHuaMap[siHua.ke] = '化科';
    siHuaMap[siHua.ji] = '化忌';
  }

  // 11. 命主/身主
  const mingZhu = MING_ZHU_MAP[mingZhi] || '未知';
  const shenZhu = SHEN_ZHU_MAP[input.yearZhi] || '未知';

  // 12. 大限
  const daXianList = arrangeDaXian(mingGong, juNumber, input.yearGan, input.gender);

  // 13. 组装12宫
  const gongs: ZiWeiGong[] = [];
  for (let i = 0; i < 12; i++) {
    const stars: ZiWeiStar[] = [];

    // 主星
    const zhuXingList = zhuXingMap.get(i) || [];
    for (const name of zhuXingList) {
      stars.push({
        name,
        liangDu: getLiangDu(name, i),
        hua: siHuaMap[name],
        isZhuXing: true,
      });
    }

    // 禄存
    if (i === luCunPos) {
      stars.push({ name: '禄存', liangDu: '庙', isZhuXing: false });
    }

    // 六吉星
    if (i === zuoFuPos) stars.push({ name: '左辅', liangDu: '旺', isZhuXing: false });
    if (i === youBiPos) stars.push({ name: '右弼', liangDu: '旺', isZhuXing: false });
    if (i === wenChangPos) stars.push({ name: '文昌', liangDu: '庙', isZhuXing: false });
    if (i === wenQuPos) stars.push({ name: '文曲', liangDu: '庙', isZhuXing: false });
    if (i === tianKuiPos) stars.push({ name: '天魁', liangDu: '旺', isZhuXing: false });
    if (i === tianYuePos) stars.push({ name: '天钺', liangDu: '旺', isZhuXing: false });

    // 六煞星
    if (i === qingYangPos) stars.push({ name: '擎羊', liangDu: '陷', isZhuXing: false });
    if (i === tuoLuoPos) stars.push({ name: '陀罗', liangDu: '陷', isZhuXing: false });
    if (i === huoXingPos) stars.push({ name: '火星', liangDu: '陷', isZhuXing: false });
    if (i === lingXingPos) stars.push({ name: '铃星', liangDu: '陷', isZhuXing: false });
    if (i === diKongPos) stars.push({ name: '地空', liangDu: '陷', isZhuXing: false });
    if (i === diJiePos) stars.push({ name: '地劫', liangDu: '陷', isZhuXing: false });

    // 四化标记（辅星也可能有四化）
    for (const star of stars) {
      if (!star.hua && siHuaMap[star.name]) {
        star.hua = siHuaMap[star.name];
      }
    }

    // 查找对应大限
    const daXian = daXianList.find(d => d.daXianGong === i);

    gongs.push({
      name: gongNames[i],
      diZhi: DIZHI[i],
      tianGan: gongGans[i],
      stars,
      daXian: daXian ? `${daXian.startAge}-${daXian.endAge}岁` : undefined,
      daXianAge: daXian ? [daXian.startAge, daXian.endAge] : undefined,
    });
  }

  return {
    input,
    mingGongIndex: mingGong,
    shenGongIndex: shenGong,
    wuXingJu,
    gongs,
    siHua: siHuaMap,
    mingZhu,
    shenZhu,
  };
}

// ========== 格式化排盘结果 ==========
export function formatPaiPan(result: ZiWeiPaiPan): string {
  const lines: string[] = [];

  lines.push('【紫微斗数排盘】');
  lines.push(`性别：${result.input.gender}命`);
  lines.push(`农历：${result.input.year}年${result.input.month}月${result.input.day}日 ${result.input.hour}时${result.input.minute}分`);
  lines.push(`五行局：${result.wuXingJu}`);
  lines.push(`命主：${result.mingZhu}  身主：${result.shenZhu}`);
  lines.push('');

  // 四化
  const siHua = SI_HUA_TABLE[result.input.yearGan];
  if (siHua) {
    lines.push(`【四化】（年干${result.input.yearGan}）`);
    lines.push(`${siHua.lu}化禄  ${siHua.quan}化权  ${siHua.ke}化科  ${siHua.ji}化忌`);
    lines.push('');
  }

  // 12宫
  lines.push('【十二宫详表】');
  for (let i = 0; i < 12; i++) {
    const gong = result.gongs[i];
    lines.push(`─── ${gong.name}（${gong.tianGan}${gong.diZhi}）${gong.daXian ? '  大限：' + gong.daXian : ''} ───`);

    const zhuXingStars = gong.stars.filter(s => s.isZhuXing);
    const otherStars = gong.stars.filter(s => !s.isZhuXing);

    if (zhuXingStars.length > 0) {
      for (const star of zhuXingStars) {
        const huaStr = star.hua ? `【${star.hua}】` : '';
        lines.push(`  ★ ${star.name}（${star.liangDu}）${huaStr}`);
      }
    }

    if (otherStars.length > 0) {
      const starNames = otherStars.map(s => {
        const huaStr = s.hua ? `【${s.hua}】` : '';
        return `${s.name}${huaStr}`;
      });
      lines.push(`  辅星：${starNames.join('、')}`);
    }

    lines.push('');
  }

  // 命宫详细
  const mingGong = result.gongs[result.mingGongIndex];
  lines.push(`【命宫主星】`);
  const mingZhuXing = mingGong.stars.filter(s => s.isZhuXing);
  if (mingZhuXing.length > 0) {
    for (const star of mingZhuXing) {
      const huaStr = star.hua ? `（${star.hua}）` : '';
      lines.push(`  ${star.name}（${star.liangDu}）${huaStr}`);
    }
  } else {
    lines.push('  命宫无主星（借对宫星曜）');
  }

  // 身宫
  const shenGong = result.gongs[result.shenGongIndex];
  lines.push(`【身宫】${shenGong.name}（${shenGong.tianGan}${shenGong.diZhi}）`);
  const shenZhuXing = shenGong.stars.filter(s => s.isZhuXing);
  if (shenZhuXing.length > 0) {
    for (const star of shenZhuXing) {
      lines.push(`  ${star.name}（${star.liangDu}）${star.hua ? '（' + star.hua + '）' : ''}`);
    }
  }

  // 四化详细论断
  const siHuaDetail = SI_HUA_TABLE[result.input.yearGan];
  if (siHuaDetail) {
    lines.push('');
    lines.push('【四化飞星论断】（出自《紫微斗数全书》及中州派/飞星派理论）');
    const huaEntries: { type: string; star: string }[] = [
      { type: '化禄', star: siHuaDetail.lu },
      { type: '化权', star: siHuaDetail.quan },
      { type: '化科', star: siHuaDetail.ke },
      { type: '化忌', star: siHuaDetail.ji },
    ];
    for (const entry of huaEntries) {
      const lunduan = SIHUA_LUNDUAN[entry.type]?.[`${entry.star}${entry.type}`];
      lines.push(`\n【${entry.star}${entry.type}】`);
      if (lunduan) {
        lines.push(lunduan);
      } else {
        lines.push(`${entry.star}${entry.type}，需结合宫位判断吉凶。`);
      }
      // 判断化星落入何宫
      for (const gong of result.gongs) {
        const found = gong.stars.find(s => s.name === entry.star);
        if (found) {
          lines.push(`  → 落入${gong.name}（${gong.tianGan}${gong.diZhi}），亮度：${found.liangDu}`);
          const gongLun = GONG_LUNDUAN[gong.name];
          if (gongLun) {
            lines.push(`  → ${gong.name}主${gongLun.zhuGuan}`);
          }
          break;
        }
      }
    }
  }

  // 各宫位论断
  lines.push('');
  lines.push('【十二宫论断】（出自《紫微斗数全书》）');
  for (let i = 0; i < 12; i++) {
    const gong = result.gongs[i];
    const starNames = gong.stars.map(s => s.name);
    const huaList = gong.stars.filter(s => s.hua).map(s => `${s.name}${s.hua}`);
    const lunDuan = getGongLunDuan(gong.name, starNames, huaList);
    if (lunDuan) {
      lines.push(`\n${lunDuan}`);
    }
  }

  // 《紫微斗数全书》经典论断提示
  lines.push('');
  lines.push('【经典论断依据】');
  lines.push('以上排盘依据《紫微斗数全书》（陈希夷）安星法，');
  lines.push('结合中州派（王亭之）星曜解读与飞星派（梁若瑜）四化飞星理论。');
  lines.push('星曜亮度参照《紫微斗数三合大全》庙旺利陷表。');
  lines.push('四化论断依据《紫微斗数全书》化星篇及中州派四化专论。');
  lines.push('格局判定依据《紫微斗数全书》格局篇及三合派格局论。');

  return lines.join('\n');
}

/**
 * 紫微斗数实战预测（郑穆德/杨智宇方法）
 * 预测具体事项：事业老板类型、创业赚钱时机、衰运赔钱时机、贵人方向
 */
export function predictZiWeiShiZhan(paiPan: ZiWeiPaiPan, currentYear?: number): string {
  const now = currentYear || new Date().getFullYear();
  const lines: string[] = [];
  lines.push('\n=== 紫微斗数实战预测（郑穆德/杨智宇方法）===');

  const mingGong = paiPan.gongs.find(g => g.name === '命宫');
  const shiYeGong = paiPan.gongs.find(g => g.name === '官禄宫');
  const caiBoGong = paiPan.gongs.find(g => g.name === '财帛宫');
  const qianYiGong = paiPan.gongs.find(g => g.name === '迁移宫');

  // 一、事业老板类型（郑穆德法）
  if (shiYeGong) {
    lines.push('\n【事业与老板类型预测】');
    const shiYeStars = shiYeGong.stars.map(s => s.name);

    if (shiYeStars.includes('紫微')) {
      lines.push('  · 你下一份工作的老板：大格局、有权威、喜欢掌控全局的类型，可能是大型企业高管或创业者');
      lines.push('  · 老板风格：重视制度与面子，喜欢下属尊重其决策');
      lines.push('  · 合作建议：对老板要尊重到位，不要当面反驳，私下建言更有效');
    }
    if (shiYeStars.includes('天府')) {
      lines.push('  · 你下一份工作的老板：稳重保守型，善于理财守业，不太喜欢冒险');
      lines.push('  · 老板风格：注重稳健发展，按部就班');
    }
    if (shiYeStars.includes('太阳')) {
      lines.push('  · 你下一份工作的老板：热心大方、爱面子的类型，男老板概率大');
      lines.push('  · 老板风格：喜欢帮助人但也要回报，讲人情味');
    }
    if (shiYeStars.includes('太阴')) {
      lines.push('  · 你下一份工作的老板：细腻温柔型，女老板概率大，注重细节');
      lines.push('  · 老板风格：情感丰富，直觉强，重过程轻结果');
    }
    if (shiYeStars.includes('天机')) {
      lines.push('  · 你下一份工作的老板：聪明善变型，想法多但可能朝令夕改');
      lines.push('  · 老板风格：思维敏捷，喜欢创新，但需注意方向经常调整');
    }
    if (shiYeStars.includes('七杀')) {
      lines.push('  · 你下一份工作的老板：强势霸气型，说一不二，执行力极强');
      lines.push('  · 老板风格：高压管理，竞争意识强，适者生存');
    }
    if (shiYeStars.includes('破军')) {
      lines.push('  · 你下一份工作的老板：颠覆创新型，经常大刀阔斧改革');
      lines.push('  · 老板风格：不安于现状，喜欢推倒重来');
    }
    if (shiYeStars.includes('贪狼')) {
      lines.push('  · 你下一份工作的老板：多才多艺、人际广泛型，应酬多');
      lines.push('  · 老板风格：机会导向，善于交际，可能同时经营多个项目');
    }
    if (shiYeStars.includes('武曲')) {
      lines.push('  · 你下一份工作的老板：务实刚毅型，重视业绩数字');
      lines.push('  · 老板风格：结果导向，赏罚分明，不拖泥带水');
    }
    if (shiYeStars.includes('天梁')) {
      lines.push('  · 你下一份工作的老板：老成持重型，像长辈一样关照下属');
      lines.push('  · 老板风格：有责任心，循循善诱，但可能过于保守');
    }
    if (shiYeStars.includes('巨门')) {
      lines.push('  · 你下一份工作的老板：口才好、疑心重的类型，需要反复沟通');
      lines.push('  · 老板风格：善于分析质疑，需要充分数据和论证');
    }

    // 四化对事业的影响
    for (const star of shiYeGong.stars) {
      if (star.hua === '化禄') {
        lines.push(`  · ${star.name}化禄入官禄：事业财运亨通，这颗星带来赚钱机会`);
      }
      if (star.hua === '化权') {
        lines.push(`  · ${star.name}化权入官禄：事业有权，可掌实权，升职机会大`);
      }
      if (star.hua === '化科') {
        lines.push(`  · ${star.name}化科入官禄：事业有名，口碑好，适合靠名气赚钱`);
      }
      if (star.hua === '化忌') {
        lines.push(`  · ${star.name}化忌入官禄：事业受阻，该方面易生波折，需格外注意`);
      }
    }
  }

  // 二、创业赚钱/衰运赔钱时机（郑穆德法）
  lines.push('\n【创业赚钱与衰运赔钱时机预测】');
  if (caiBoGong) {
    const caiStars = caiBoGong.stars.map(s => s.name);
    const hasHuaLu = caiBoGong.stars.some(s => s.hua === '化禄');
    const hasHuaJi = caiBoGong.stars.some(s => s.hua === '化忌');

    if (hasHuaLu) {
      lines.push('  · 财帛宫化禄：一生财运基础好，赚钱有机缘');
    }
    if (hasHuaJi) {
      lines.push('  · 财帛宫化忌：财运多波折，赚钱辛苦，需防破财');
    }

    // 根据大限推算赚钱/赔钱时期
    const daXianList = paiPan.gongs
      .filter(g => g.daXianAge)
      .map(g => ({ startAge: g.daXianAge![0], endAge: g.daXianAge![1], gongStars: g.stars.map(s => s.name) }));
    if (daXianList.length > 0) {
      lines.push('  · 大限财运走势：');
      for (const dx of daXianList) {
        const dxEnd = dx.endAge;
        const yearStart = paiPan.input.year + dx.startAge;
        const yearEnd = paiPan.input.year + dxEnd;
        const dxStars = dx.gongStars || [];
        const dxHasHuaLu = dxStars.some((s: string) => s.includes('禄'));
        const dxHasHuaJi = dxStars.some((s: string) => s.includes('忌'));

        if (dxHasHuaLu && !dxHasHuaJi) {
          if (yearEnd >= now - 5) {
            lines.push(`    - ${yearStart}-${yearEnd}年（${dx.startAge}-${dxEnd}岁）：财运大好，适合创业投资`);
          }
        } else if (dxHasHuaJi && !dxHasHuaLu) {
          if (yearEnd >= now - 5) {
            lines.push(`    - ${yearStart}-${yearEnd}年（${dx.startAge}-${dxEnd}岁）：财运低迷，保守为宜，不宜冒险`);
          }
        }
      }
    }

    // 流年关键年份（精确到月）
    lines.push('  · 近5年流年财运提示（精确到旺月）：');
    const liuYueZhi = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
    for (let y = now; y <= now + 4; y++) {
      const yearGanIdx = (y - 4) % 10;
      const yearGan = TIANGAN[yearGanIdx >= 0 ? yearGanIdx : yearGanIdx + 10];
      const siHua = SI_HUA_TABLE[yearGan];
      if (siHua) {
        const luStar = siHua.lu;
        const jiStar = siHua.ji;
        // 找出化禄星所在宫位对应的月份最旺
        const luGong = paiPan.gongs.find(g => g.stars.some(s => s.name === luStar));
        const luMonth = luGong ? liuYueZhi.indexOf(luGong.diZhi) + 1 : -1;
        const monthHint = luMonth > 0 ? `，化禄最旺月：约${luMonth}月` : '';
        lines.push(`    - ${y}年（${yearGan}${DI_ZHI_YEAR[(y - 4) % 12 >= 0 ? (y - 4) % 12 : (y - 4) % 12 + 12]}年）：化禄星=${luStar} 化忌星=${jiStar}${monthHint}`);
      }
    }
  }

  // 三、贵人方向预测（杨智宇法）
  lines.push('\n【贵人方向预测（杨智宇方法）】');
  if (mingGong) {
    const mingZhi = mingGong.diZhi;
    const directionMap: Record<string, string> = {
      '子': '正北', '丑': '东北偏北', '寅': '东北偏东',
      '卯': '正东', '辰': '东南偏东', '巳': '东南偏南',
      '午': '正南', '未': '西南偏南', '申': '西南偏西',
      '酉': '正西', '戌': '西北偏西', '亥': '西北偏北',
    };
    lines.push(`  · 命宫地支：${mingZhi}，贵人最旺方向：${directionMap[mingZhi] || '需综合判断'}`);

    // 迁移宫贵人
    if (qianYiGong) {
      const qianYiStars = qianYiGong.stars.map(s => s.name);
      if (qianYiStars.includes('天魁') || qianYiStars.includes('天钺')) {
        lines.push('  · 迁移宫有天魁/天钺：外出发展遇贵人概率极大，贵人多在外地');
      }
      if (qianYiStars.includes('左辅') || qianYiStars.includes('右弼')) {
        lines.push('  · 迁移宫有左辅/右弼：外出有助力，朋友多、人脉广');
      }
      if (qianYiStars.includes('化禄')) {
        lines.push('  · 迁移宫化禄：外出赚钱机会多，适合向外发展');
      }
    }

    // 适合发展的方位
    lines.push('  · 适合发展方位建议：');
    if (mingGong.stars.some(s => s.name === '紫微' || s.name === '天府')) {
      lines.push('    - 帝星坐命：适合去大城市、中心位置发展，越核心越好');
    }
    if (mingGong.stars.some(s => s.name === '太阳')) {
      lines.push('    - 太阳坐命：适合向东、向南发展，白天做事有利');
    }
    if (mingGong.stars.some(s => s.name === '太阴')) {
      lines.push('    - 太阴坐命：适合向西、向北发展，夜晚或幕后工作有利');
    }
    if (mingGong.stars.some(s => s.name === '七杀' || s.name === '破军')) {
      lines.push('    - 杀破狼坐命：适合去新环境开拓，离家发展更佳');
    }
  }

  // 四、学业预测（紫微斗数学业篇/大耕老师方法）
  lines.push('\n【学业预测（紫微斗数学业篇）】');
  if (shiYeGong) {
    const shiYeStarNames = shiYeGong.stars.map((s: { name: string }) => s.name);
    const hasHuaKe = shiYeGong.stars.some((s: { hua?: string }) => s.hua === '化科');
    const hasWenChang = shiYeGong.stars.some((s: { name: string }) => s.name === '文昌');
    const hasWenQu = shiYeGong.stars.some((s: { name: string }) => s.name === '文曲');

    if (hasHuaKe) {
      lines.push('  · 官禄宫化科：学业有成名之象，考试运极佳，利升学利考证');
    }
    if (hasWenChang || hasWenQu) {
      lines.push('  · 官禄宫有文昌/文曲：利文职利考试，学术能力强');
    }
    if (shiYeStarNames.includes('天机')) {
      lines.push('  · 天机入官禄：聪明善思考，利理工科、计算机、策略分析');
    }
    if (shiYeStarNames.includes('太阴')) {
      lines.push('  · 太阴入官禄：细腻敏感，利文科、艺术、医学');
    }
    if (shiYeStarNames.includes('天梁')) {
      lines.push('  · 天梁入官禄：利学术研究、医学、法律，考试运稳');
    }
    if (shiYeStarNames.includes('紫微') || shiYeStarNames.includes('天府')) {
      lines.push('  · 紫微/天府入官禄：利管理类、行政管理，考公务员有利');
    }
    if (shiYeStarNames.includes('太阳')) {
      lines.push('  · 太阳入官禄：利政治、外交、传媒，需庙旺方利');
    }
  }

  // 文昌文曲所在宫位论学业
  const wenChangGong = paiPan.gongs.find((g: { stars: { name: string }[] }) => g.stars.some((s: { name: string }) => s.name === '文昌'));
  const wenQuGong = paiPan.gongs.find((g: { stars: { name: string }[] }) => g.stars.some((s: { name: string }) => s.name === '文曲'));
  if (wenChangGong) {
    const gongName = (wenChangGong as { name: string }).name;
    lines.push(`  · 文昌在${gongName}：学业根基在此领域`);
  }
  if (wenQuGong) {
    const gongName = (wenQuGong as { name: string }).name;
    lines.push(`  · 文曲在${gongName}：才华方向在此领域`);
  }

  // 学业转折流年
  lines.push('  · 近5年学业转折流年：');
  for (let y = now; y <= now + 4; y++) {
    const yearGanIdx = (y - 4) % 10;
    const yearGan = TIANGAN[yearGanIdx >= 0 ? yearGanIdx : yearGanIdx + 10];
    const siHua = SI_HUA_TABLE[yearGan];
    if (siHua) {
      const keStar = siHua.ke;
      const keGong = paiPan.gongs.find((g: { stars: { name: string }[] }) => g.stars.some((s: { name: string }) => s.name === keStar));
      if (keGong) {
        const gongName = (keGong as { name: string }).name;
        if (gongName === '官禄宫' || gongName === '命宫' || gongName === '财帛宫') {
          lines.push(`    - ${y}年：${keStar}化科入${gongName}，学业大利！考试升学绝佳年份`);
        } else {
          lines.push(`    - ${y}年：${keStar}化科入${gongName}，学术有助力`);
        }
      }
    }
  }

  // 五、婚姻预测（紫微斗数婚恋篇/郑穆德婚恋指南）
  lines.push('\n【婚姻预测（紫微斗数婚恋篇）】');
  const fuQiGong = paiPan.gongs.find((g: { name: string }) => g.name === '夫妻宫');
  if (fuQiGong) {
    const fuQiStarNames = fuQiGong.stars.map((s: { name: string }) => s.name);
    lines.push(`  · 夫妻宫星曜：${fuQiStarNames.join('、')}`);

    if (fuQiStarNames.includes('紫微')) lines.push('  · 紫微入夫妻：配偶有气质有权威，晚婚更佳');
    if (fuQiStarNames.includes('天机')) lines.push('  · 天机入夫妻：配偶聪明但善变，宜年龄差距大');
    if (fuQiStarNames.includes('太阳')) lines.push('  · 太阳入夫妻：配偶光明磊落（庙旺方吉）');
    if (fuQiStarNames.includes('太阴')) lines.push('  · 太阴入夫妻：配偶温柔体贴，可能情绪化');
    if (fuQiStarNames.includes('武曲')) lines.push('  · 武曲入夫妻：配偶刚毅独立，宜晚婚');
    if (fuQiStarNames.includes('天同')) lines.push('  · 天同入夫妻：配偶温和，感情甜蜜');
    if (fuQiStarNames.includes('七杀')) lines.push('  · 七杀入夫妻：配偶强势，感情波折多，宜晚婚');
    if (fuQiStarNames.includes('破军')) lines.push('  · 破军入夫妻：感情多变，易有波折重组');
    if (fuQiStarNames.includes('贪狼')) lines.push('  · 贪狼入夫妻：配偶多才多艺但桃花重，需防第三者');
    if (fuQiStarNames.includes('廉贞')) lines.push('  · 廉贞入夫妻：感情热烈但波折多，配偶桃花旺');

    for (const star of fuQiGong.stars) {
      if (star.hua === '化禄') lines.push(`  · ${star.name}化禄入夫妻：感情甜蜜，配偶经济条件好`);
      if (star.hua === '化权') lines.push(`  · ${star.name}化权入夫妻：配偶强势掌权`);
      if (star.hua === '化科') lines.push(`  · ${star.name}化科入夫妻：配偶有才学有口碑`);
      if (star.hua === '化忌') lines.push(`  · ⚠️ ${star.name}化忌入夫妻：感情受阻，需用心经营`);
    }

    // 婚恋引动年份
    lines.push('  · 近7年婚恋引动年份：');
    for (let y = now; y <= now + 6; y++) {
      const yearGanIdx = (y - 4) % 10;
      const yearGan = TIANGAN[yearGanIdx >= 0 ? yearGanIdx : yearGanIdx + 10];
      const siHua = SI_HUA_TABLE[yearGan];
      if (siHua) {
        const luGong = paiPan.gongs.find((g: { stars: { name: string }[] }) => g.stars.some((s: { name: string }) => s.name === siHua.lu));
        if (luGong && (luGong as { name: string }).name === '夫妻宫') {
          lines.push(`    - ${y}年：化禄入夫妻宫！感情甜蜜年，婚恋大利`);
        }
        const jiGong = paiPan.gongs.find((g: { stars: { name: string }[] }) => g.stars.some((s: { name: string }) => s.name === siHua.ji));
        if (jiGong && (jiGong as { name: string }).name === '夫妻宫') {
          lines.push(`    - ${y}年：⚠️ 化忌入夫妻宫，感情波折年`);
        }
      }
    }
  }

  // 六、六亲预测（紫微斗数六亲篇）
  lines.push('\n【六亲预测（紫微斗数六亲篇）】');
  const fuMuGong = paiPan.gongs.find((g: { name: string }) => g.name === '父母宫');
  if (fuMuGong) {
    const fuMuStarNames = fuMuGong.stars.map((s: { name: string }) => s.name);
    lines.push(`  · 父母宫星曜：${fuMuStarNames.join('、')}`);
    if (fuMuGong.stars.some((s: { hua?: string }) => s.hua === '化禄')) lines.push('  · 父母宫化禄：与父母缘厚');
    if (fuMuGong.stars.some((s: { hua?: string }) => s.hua === '化忌')) lines.push('  · ⚠️ 父母宫化忌：与父母缘薄，或父母健康需关注');
  }
  const xiongDiGong = paiPan.gongs.find((g: { name: string }) => g.name === '兄弟宫');
  if (xiongDiGong) {
    const xiongDiStarNames = xiongDiGong.stars.map((s: { name: string }) => s.name);
    lines.push(`  · 兄弟宫星曜：${xiongDiStarNames.join('、')}`);
    if (xiongDiGong.stars.some((s: { hua?: string }) => s.hua === '化禄')) lines.push('  · 兄弟宫化禄：兄弟姐妹有助力');
    if (xiongDiGong.stars.some((s: { hua?: string }) => s.hua === '化忌')) lines.push('  · ⚠️ 兄弟宫化忌：兄弟姐妹缘薄');
  }
  const ziNvGong = paiPan.gongs.find((g: { name: string }) => g.name === '子女宫');
  if (ziNvGong) {
    const ziNvStarNames = ziNvGong.stars.map((s: { name: string }) => s.name);
    lines.push(`  · 子女宫星曜：${ziNvStarNames.join('、')}`);
    if (ziNvGong.stars.some((s: { hua?: string }) => s.hua === '化禄')) lines.push('  · 子女宫化禄：子女有出息');
    if (ziNvGong.stars.some((s: { hua?: string }) => s.hua === '化忌')) lines.push('  · ⚠️ 子女宫化忌：子女缘薄或操心多');
  }

  return lines.join('\n');
}

// ========== 紫微斗数经典论断数据 ==========
// 《紫微斗数全书》主星入命论断（简化版核心条文）
export const ZIWEI_LUNDUAN: Record<string, string[]> = {
  '紫微': [
    '紫微入命，为人厚重，有领导才能，自尊心强',
    '紫微在子午：紫微独坐，为"极向离明"格，主人品极高',
    '紫微在寅申：紫府同宫，天府辅佐，富贵双全',
    '紫微在卯酉：紫贪同宫，桃花犯主，须防感情波折',
    '紫微在辰戌：紫相同宫，天相佐之，可掌权',
    '紫微在巳亥：紫杀同宫，七杀制之，武职显贵',
    '紫微化权：权威显赫，可掌大权',
    '紫微化科：名声远扬，文运亨通',
  ],
  '天机': [
    '天机入命，聪明机敏，善谋略，心思细腻',
    '天机在子午：天机独坐，机谋百出',
    '天机太阴在寅申：机月同梁格，宜文职',
    '天机化禄：智慧生财，善于理财',
    '天机化忌：思虑过甚，犹豫不决',
  ],
  '太阳': [
    '太阳入命，光明磊落，热情大方，喜助人',
    '太阳在寅卯：日照雷门，少年得志',
    '太阳在午：日丽中天，光芒万丈，主贵',
    '太阳在酉戌亥子：日落西山，光芒不足，须努力',
    '太阳化禄：因贵得财，男命尤佳',
    '太阳化忌：男主克父，女主克夫，光明受损',
  ],
  '武曲': [
    '武曲入命，刚毅果决，有财运，善理财',
    '武曲在辰戌：武曲独坐，财星入庙，富足',
    '武曲天相在寅申：财印格，富贵',
    '武曲化禄：财运亨通',
    '武曲化忌：破财纠纷',
  ],
  '天同': [
    '天同入命，温和福厚，享受型，少冲劲',
    '天同在子午：天同太阴，福泽深厚',
    '天同在卯酉：天同独坐，清闲享福',
    '天同化禄：福气更厚',
    '天同化忌：福薄多忧',
  ],
  '廉贞': [
    '廉贞入命，精明能干，多才多艺，桃花重',
    '廉贞在寅申：廉贞七杀，武职显贵',
    '廉贞在巳亥：廉贞贪狼，桃花犯主',
    '廉贞化禄：因交际得财',
    '廉贞化忌：官非口舌',
  ],
  '天府': [
    '天府入命，稳重厚道，善守财，有贵人',
    '天府在子午：天府独坐，库星入庙，富足',
    '天府在寅申：紫府同宫，帝座有辅，大贵',
    '天府化科：贵人气场',
  ],
  '太阴': [
    '太阴入命，温柔细腻，有艺术天赋，喜静',
    '太阴在酉戌亥子：月朗天门，夜生人尤佳',
    '太阴在卯辰巳午：落陷失辉，须勤勉',
    '太阴化禄：财源广进，女命尤佳',
    '太阴化忌：阴虚不实，感情波折',
  ],
  '贪狼': [
    '贪狼入命，多欲多求，才艺出众，桃花重',
    '贪狼在子午：贪狼独坐，泛水桃花，须防色难',
    '贪狼在寅申：贪狼加煞，武职立功',
    '贪狼化禄：因欲得财',
    '贪狼化忌：贪念招灾',
  ],
  '巨门': [
    '巨门入命，口才出众，善辩，多疑虑',
    '巨门在子午：巨门独坐，口舌生财',
    '巨门太阳在寅申：日照雷门，口才得贵',
    '巨门化禄：口舌生财',
    '巨门化忌：口舌是非',
  ],
  '天相': [
    '天相入命，温和正直，善辅佐，易受环境影响',
    '天相在子午：天相独坐，印星得地',
    '天相化科：贵人助力',
  ],
  '天梁': [
    '天梁入命，正直无私，有长者风，喜逢灾解难',
    '天梁在子午：天梁独坐，荫星入庙',
    '天梁在巳亥：天梁陷地，劳碌',
    '天梁化禄：因荫得福',
    '天梁化权：威严正直',
  ],
  '七杀': [
    '七杀入命，刚烈果决，有冲劲，武职显贵',
    '七杀在寅申：七杀紫微，帝座制杀，大贵',
    '七杀在子午：七杀独坐，英雄独压万人',
    '七杀加煞：性刚多灾',
  ],
  '破军': [
    '破军入命，变动不居，开创新局，波折多',
    '破军在子午：破军独坐，英星入庙',
    '破军在寅申：破军武曲，财星遇破，先破后立',
    '破军化禄：因变得财',
    '破军化权：权威变动',
    '破军化忌：动荡不安',
  ],
};

// 格局论断（《紫微斗数全书》+《子平真诠》格局在紫微中的对应）
export const ZIWEI_GEJU: Record<string, string> = {
  '紫府同宫': '紫微天府同在寅申，帝座有辅，主人品极高，富贵双全。《紫微斗数全书》云：紫府同宫，如在寅申二宫，左右昌曲来会，极品之贵。无左右昌曲亦不失为富命。',
  '日月并明': '太阳在卯辰巳，太阴在酉戌亥，日月各得其所，主大贵。《全书》云：日月并明，庙旺各得其所，官居一品之荣。',
  '日月同临': '太阳太阴同在丑未，日月同辉，主贵。《全书》云：日月同临，丑未安命，日月会合，虽不庙旺亦主贵显。',
  '机月同梁': '天机太阴天同天梁会合，宜文职公职。《中州派》云：机月同梁作吏人，宜公职、文秘、参谋之职，不宜经商创业。',
  '杀破狼格': '七杀破军贪狼三合，主变动创新，武职经商。《全书》云：杀破狼三方会合，主人一生多变、多起伏，宜武职、创业、开疆拓土。女命杀破狼，多波折。',
  '府相朝垣': '天府天相朝命，主人品厚重。《全书》云：府相朝垣，主人稳重有德，可居高位。天府为库，天相为印，库印齐全，富贵可期。',
  '君臣庆会': '紫微在午，众星朝拱，极向离明格。《全书》云：紫微在午，无煞星冲破，百官朝拱，极向离明，大贵之格。如有煞星冲破，则减等。',
  '石中隐玉': '巨门在子，口才得贵。《全书》云：巨门在子，口才了得，能以言辞得贵。化禄化权尤佳。',
  '日照雷门': '太阳天机在卯，光明智慧。《全书》云：太阳在卯，日照雷门，主聪明才智过人，少年得志。逢化禄更佳。',
  '月朗天门': '太阴在亥，夜生人尤佳。《全书》云：太阴在亥，月朗天门，主富贵双全。夜生人（酉戌亥子丑时生）更佳。',
  '火贪格': '火星贪狼同宫，暴发之格。《全书》云：火贪同宫，主横发。忽然发达，财禄丰收。但须无煞星冲破方真。',
  '铃贪格': '铃星贪狼同宫，同火贪。《全书》云：铃贪同宫，与火贪同论，主横发。火星爆发，铃星渐进，二者同贪狼皆有意外之财。',
  '刑囚夹印': '廉贞天相被擎羊陀罗夹，主官非。《全书》云：刑囚夹印，刑为擎羊，囚为廉贞，印为天相。廉贞天相被擎羊陀罗夹，主官非牢狱。此格最忌。',
  '命无正曜': '命宫无主星，借对宫星曜，需综合判断。《中州派》云：命无正曜，须借对宫星曜论断，性格受对宫影响大。对宫吉则命吉，对宫凶则命凶。',
  '巨日同宫': '巨门太阳在寅申，口才得贵。《全书》云：巨日同宫，太阳之光照巨门之暗，主口才出众、可因言得贵。在寅宫为日照雷门变格。',
  '武贪同宫': '武曲贪狼同在丑未，主先贫后富。《全书》云：武贪同宫，三十年前贫苦，三十年后富足。先苦后甜之格。',
  '日月反背': '太阳在亥子，太阴在巳午，日月皆落陷。《全书》云：日月反背，主人一生辛苦，付出多收获少。宜离乡发展，可减其凶。',
  '马头带箭': '擎羊在午宫守命。《全书》云：擎羊在午，马头带箭格，主武职显贵、出门有利。但性刚多是非。',
  '文桂文华': '文曲在命守科甲。《全书》云：文曲守命，文昌来会，文桂文华格，主文章盖世、科甲有名。',
  '左右同宫': '左辅右弼同在命宫。《全书》云：左右同宫，主人有助力、得人望，一生贵人多。但须有主星方真。',
};

// ========== 《中州派》四化飞星详细论断 ==========
// 四化为紫微斗数最核心的断法，飞星派尤其重视

export const SIHUA_LUNDUAN: Record<string, Record<string, string>> = {
  '化禄': {
    '紫微化禄': '紫微化禄，主权禄兼得。主人有权威又有财禄，事业财运双收。官禄宫化禄尤佳，主升迁得利。',
    '天机化禄': '天机化禄，主智慧生财。善于策划谋略，因智慧而得财。但天机化禄易变动，财来财去。',
    '太阳化禄': '太阳化禄，主因贵得财。男命尤佳，主事业光明、有社会地位。女命化禄太阳，旺夫益子。',
    '武曲化禄': '武曲化禄，主财运亨通。武曲为财星，化禄则财源滚滚。经商得利，理财有方。',
    '天同化禄': '天同化禄，主福气更厚。生活安逸，享受多。但天同本懒，化禄后更安于现状，需防惰性。',
    '廉贞化禄': '廉贞化禄，主因交际得财。廉贞为桃花星，化禄则人缘好、交际广、因人得财。在官禄宫主升迁。',
    '太阴化禄': '太阴化禄，主财源广进。太阴为财星，化禄尤利女命。田宅宫化禄主置产得利。',
    '贪狼化禄': '贪狼化禄，主因欲得财。多欲多求反而得财，演艺、交际、桃花行业得利。但贪念过重反失。',
    '巨门化禄': '巨门化禄，主口舌生财。善于言辞、辩论、教学，因口才得财。暗星化禄，暗中得利。',
    '天梁化禄': '天梁化禄，主因荫得福。逢灾解难，遇难呈祥。长辈庇荫，公职有利。但天梁不喜化禄，反主多操心。',
    '破军化禄': '破军化禄，主因变得财。破军为破耗星，化禄则破而后立，变动中得财。先破后得之象。',
  },
  '化权': {
    '紫微化权': '紫微化权，主权威极重。帝座化权，权倾一方。在官禄宫主大权在握。但过刚易折。',
    '天机化权': '天机化权，主谋略有权威。善于策划且能掌权执行。但思虑过重，容易独断。',
    '太阳化权': '太阳化权，主刚烈有权威。男命利事业，女命过于强势。男命化权太阳，事业有成但克父。',
    '武曲化权': '武曲化权，主财权兼得。掌财权、有决断力。但刚愎自用，不利感情。',
    '天同化权': '天同化权，主柔和中有刚。天同本柔，化权后变主动。但本质仍为享受，权禄需看配合。',
    '廉贞化权': '廉贞化权，主权势显赫。在官禄宫主有权位。但桃花加权，感情上强势霸道。',
    '太阴化权': '太阴化权，主柔性掌权。女命尤佳，可掌大权。太阴化权比化禄更实，主实际得权。',
    '贪狼化权': '贪狼化权，主多欲多权。权力欲望强，能因欲望推动事业。桃花加权威，演艺政治皆宜。',
    '巨门化权': '巨门化权，主口才权威。说话有分量，能以言辞服人。在官禄宫主因口才得权。',
    '天梁化权': '天梁化权，主威严正直。长者风度更重，有威望。在官禄宫主清正廉明之官。',
    '破军化权': '破军化权，主权威变动。破军本主变，化权则变动中有权力。开创新局，有权有势。',
  },
  '化科': {
    '紫微化科': '紫微化科，主名声远扬。帝座化科，名气大。科名远播，文运亨通。在官禄宫主科甲有名。',
    '天机化科': '天机化科，主智慧有名。因聪明才智而得名声。善于学术研究，考试有利。',
    '太阳化科': '太阳化科，主贵气文才。男命利功名，女命旺夫家。光明正大得名声。',
    '武曲化科': '武曲化科，主财名兼得。因理财或金融才能得名。武曲化科不如化禄直接得财，但名声更持久。',
    '天同化科': '天同化科，主安逸有名。不需辛劳亦得名声。但天同化科力量不大，需看配合。',
    '廉贞化科': '廉贞化科，主贵人提拔。因交际得贵人，因人得名。在官禄宫主升迁顺利。',
    '太阴化科': '太阴化科，主文名秀气。因文艺或学术得名，女命尤佳。温文尔雅之象。',
    '贪狼化科': '贪狼化科，主才艺出名。因才艺、演艺、交际得名。桃花加科名，文娱界得利。',
    '巨门化科': '巨门化科，主口才得名。因言辞、辩论、教学得名。但巨门化科力量有限，需辅星配合。',
    '天梁化权': '天梁化科最吉，主清名远播。逢灾化吉，遇难呈祥。天梁喜化科，不喜化禄。',
    '破军化科': '破军化科，主因变得名。破旧立新中得名声。变革创新者得名之象。',
  },
  '化忌': {
    '紫微化忌': '紫微化忌，主权威受损。帝座化忌，面子受损、权威受挑战。在官禄宫主仕途受阻。',
    '天机化忌': '天机化忌，主思虑过度。想太多、犹豫不决、精神不安。机谋反成拙，聪明反被聪明误。',
    '太阳化忌': '太阳化忌，主男命克父、女命克夫。光明受损，付出多收获少。在官禄宫主仕途不顺。',
    '武曲化忌': '武曲化忌，主破财纠纷。财星化忌最凶，主财务损失、投资失利、纠纷破财。在财帛宫最忌。',
    '天同化忌': '天同化忌，主福薄多忧。享受化为烦恼，安逸变成不安。在福德宫主精神不佳。',
    '廉贞化忌': '廉贞化忌，主官非口舌。最凶之化忌之一，主官司牢狱、感情纠葛。在官禄宫主官非。',
    '太阴化忌': '太阴化忌，主阴虚不实。女命尤忌，主感情波折、财务暗损。田宅宫化忌主房产纠纷。',
    '贪狼化忌': '贪狼化忌，主贪念招灾。欲望过重反失，桃花惹祸。贪念化为灾咎，色难尤忌。',
    '巨门化忌': '巨门化忌，主口舌是非。暗星化忌，是非不断、口舌官非。在迁移宫主出门不利。',
    '天梁化忌': '天梁化忌，主荫星受损。长辈庇荫减力，逢灾难解。但天梁化忌力量较轻，需看他星配合。',
    '破军化忌': '破军化忌，主动荡不安。破耗加忌，变动中多损失。破军化忌最怕在命宫或官禄宫，主事业动荡。',
  },
};

// ========== 《紫微斗数全书》十二宫详解 ==========
export const GONG_LUNDUAN: Record<string, { zhuGuan: string; jiLun: string; xiongLun: string }> = {
  '命宫': {
    zhuGuan: '一生命运总枢纽，性格、外貌、才干、格局高低',
    jiLun: '命宫吉星云集，主人一生顺遂、有成就。紫微、天府、天相、太阳庙旺入命，皆主贵。左右昌曲来会，文华显赫。',
    xiongLun: '命宫凶星聚集，主人一生波折。擎羊、陀罗、火星、铃星、地空、地劫入命，皆有不利。化忌入命，减等论之。',
  },
  '兄弟宫': {
    zhuGuan: '兄弟姊妹关系、合伙运势',
    jiLun: '兄弟宫吉，兄弟和睦、有助力。天府、天同入兄弟宫，兄弟有靠。',
    xiongLun: '兄弟宫凶，兄弟不睦、无助力。七杀、破军入兄弟宫，兄弟缘薄。化忌入兄弟，兄弟有灾。',
  },
  '夫妻宫': {
    zhuGuan: '婚姻感情、配偶性格、婚姻质量',
    jiLun: '夫妻宫吉，婚姻美满、配偶贤能。天府、天相入夫妻，配偶稳重有助。太阴庙旺入夫妻，妻美且贤。',
    xiongLun: '夫妻宫凶，婚姻不顺、感情波折。七杀、破军入夫妻，婚姻多变。贪狼入夫妻，桃花重。廉贞化忌入夫妻，感情官司。',
  },
  '子女宫': {
    zhuGuan: '子女人数、性格、关系、生育运势',
    jiLun: '子女宫吉，子女孝顺有出息。天梁入子女，子女有德。',
    xiongLun: '子女宫凶，子女缘薄或叛逆。破军入子女，子女多变动。化忌入子女，子女有灾。',
  },
  '财帛宫': {
    zhuGuan: '财运、理财能力、收入来源',
    jiLun: '财帛宫吉，财运亨通。武曲入财帛，理财有方。天府入财帛，守财有术。太阴庙旺入财帛，财源广进。',
    xiongLun: '财帛宫凶，破财耗散。破军入财帛，财来财去。地空地劫入财帛，虚花破财。武曲化忌入财帛，投资失利。',
  },
  '疾厄宫': {
    zhuGuan: '健康状况、疾病部位、体质',
    jiLun: '疾厄宫吉，身体健康、少病。天同入疾厄，体质尚可。',
    xiongLun: '疾厄宫凶，多病多灾。廉贞入疾厄，注意血液心脏。七杀入疾厄，注意外伤手术。贪狼入疾厄，注意肝胆。',
  },
  '迁移宫': {
    zhuGuan: '外出运、社交、离乡发展',
    jiLun: '迁移宫吉，出门有利、离乡发展好。太阳庙旺入迁移，出外得贵。',
    xiongLun: '迁移宫凶，出门不利、奔波劳碌。巨门化忌入迁移，出门是非。破军入迁移，出外多变。',
  },
  '交友宫': {
    zhuGuan: '朋友关系、下属、社交圈',
    jiLun: '交友宫吉，朋友有助力。天梁入交友，朋友有德。',
    xiongLun: '交友宫凶，朋友拖累、受骗。贪狼入交友，朋友多但不可靠。七杀入交友，下属难管。',
  },
  '官禄宫': {
    zhuGuan: '事业方向、职位高低、创业就业',
    jiLun: '官禄宫吉，事业有成。紫微入官禄，事业宏大。天府入官禄，稳定升迁。太阳庙旺入官禄，官运亨通。',
    xiongLun: '官禄宫凶，事业波折。破军入官禄，事业多变。廉贞化忌入官禄，官非。巨门化忌入官禄，是非口舌。',
  },
  '田宅宫': {
    zhuGuan: '房产、家居环境、祖业',
    jiLun: '田宅宫吉，置产顺利。天府入田宅，房产丰厚。太阴入田宅，家居舒适。',
    xiongLun: '田宅宫凶，房产纠纷或无祖业。破军入田宅，居所多变。地空地劫入田宅，不宜置业。',
  },
  '福德宫': {
    zhuGuan: '精神生活、内心世界、兴趣享受',
    jiLun: '福德宫吉，精神愉快、有享受。天同入福德，清闲享福。太阴入福德，内心安宁。',
    xiongLun: '福德宫凶，精神不安、多忧虑。七杀入福德，内心焦躁。破军入福德，不安于位。天机化忌入福德，思虑过度。',
  },
  '父母宫': {
    zhuGuan: '与父母关系、父母状况、出身背景',
    jiLun: '父母宫吉，父母有靠、家学渊源。天府入父母，父母有能力。',
    xiongLun: '父母宫凶，父母缘薄或父母有灾。太阳化忌入父母，克父。太阴化忌入父母，克母。七杀入父母，与父母缘薄。',
  },
};

// 获取宫位论断
export function getGongLunDuan(gongName: string, starNames: string[], huaList: string[]): string {
  const info = GONG_LUNDUAN[gongName];
  if (!info) return '';

  const lines: string[] = [];
  lines.push(`【${gongName}】${info.zhuGuan}`);

  // 根据星曜判断吉凶倾向
  const jiXing = ['紫微', '天府', '天相', '天同', '天梁', '太阳', '太阴', '左辅', '右弼', '文昌', '文曲', '天魁', '天钺'];
  const xiongXing = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫', '七杀', '破军', '贪狼'];

  const hasJi = starNames.some(s => jiXing.includes(s));
  const hasXiong = starNames.some(s => xiongXing.includes(s));
  const hasHuaJi = huaList.some(h => h.includes('化忌'));

  if (hasJi && !hasXiong && !hasHuaJi) {
    lines.push(`吉论：${info.jiLun}`);
  } else if (hasXiong || hasHuaJi) {
    lines.push(`凶论：${info.xiongLun}`);
  } else {
    lines.push(`吉论：${info.jiLun}`);
    lines.push(`凶论：${info.xiongLun}`);
  }

  // 添加四化论断
  for (const hua of huaList) {
    for (const huaType of ['化禄', '化权', '化科', '化忌']) {
      const lunduan = SIHUA_LUNDUAN[huaType]?.[hua];
      if (lunduan) {
        lines.push(`${hua}：${lunduan}`);
      }
    }
  }

  return lines.join('\n');
}

// 获取命宫相关论断
export function getMingGongLunDuan(result: ZiWeiPaiPan): string {
  const mingGong = result.gongs[result.mingGongIndex];
  const lines: string[] = [];

  lines.push(`命宫在${mingGong.tianGan}${mingGong.diZhi}，${mingGong.name}`);

  const zhuXingStars = mingGong.stars.filter(s => s.isZhuXing);
  for (const star of zhuXingStars) {
    const lunDuan = ZIWEI_LUNDUAN[star.name];
    if (lunDuan) {
      lines.push(`\n【${star.name}入命】`);
      // 选择与当前宫位相关的论断
      for (const text of lunDuan) {
        const zhi = mingGong.diZhi;
        if (text.includes(zhi) || text.includes('化') && star.hua) {
          lines.push(`  · ${text}`);
        }
      }
      // 如果没有匹配到具体宫位的，取前3条通用论断
      if (lines.length <= 2) {
        for (let i = 0; i < Math.min(3, lunDuan.length); i++) {
          lines.push(`  · ${lunDuan[i]}`);
        }
      }
    }
  }

  // 检查特殊格局
  const starNames = mingGong.stars.map(s => s.name);
  for (const [gejuName, desc] of Object.entries(ZIWEI_GEJU)) {
    // 简单匹配：格局名中的星名是否在命宫
    const gejuStars = gejuName.replace('格', '').split('');
    if (gejuName === '命无正曜' && zhuXingStars.length === 0) {
      lines.push(`\n【${gejuName}】${desc}`);
    } else if (gejuName === '紫府同宫' && starNames.includes('紫微') && starNames.includes('天府')) {
      lines.push(`\n【${gejuName}】${desc}`);
    } else if (gejuName === '杀破狼格' && (starNames.includes('七杀') || starNames.includes('破军') || starNames.includes('贪狼'))) {
      lines.push(`\n【${gejuName}】${desc}`);
    } else if (gejuName === '火贪格' && starNames.includes('贪狼') && starNames.includes('火星')) {
      lines.push(`\n【${gejuName}】${desc}`);
    } else if (gejuName === '铃贪格' && starNames.includes('贪狼') && starNames.includes('铃星')) {
      lines.push(`\n【${gejuName}】${desc}`);
    } else if (gejuName === '刑囚夹印' && starNames.includes('廉贞') && starNames.includes('天相')) {
      lines.push(`\n【${gejuName}】${desc}`);
    } else if (gejuName === '巨日同宫' && starNames.includes('巨门') && starNames.includes('太阳')) {
      lines.push(`\n【${gejuName}】${desc}`);
    }
  }

  return lines.join('\n');
}
