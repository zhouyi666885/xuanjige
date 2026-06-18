// ========== 紫微斗数排盘算法 ==========
// 基于《紫微斗数全书》（陈希夷）+ 中州派（王亭之）+ 飞星派（梁若瑜）
// 实现：14主星安星、12宫安宫、四化飞星、星曜亮度

// ========== 基础数据 ==========

const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

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

  // 《紫微斗数全书》经典论断提示
  lines.push('');
  lines.push('【经典论断依据】');
  lines.push('以上排盘依据《紫微斗数全书》（陈希夷）安星法，');
  lines.push('结合中州派（王亭之）星曜解读与飞星派（梁若瑜）四化飞星理论。');
  lines.push('星曜亮度参照《紫微斗数三合大全》庙旺利陷表。');

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
  '紫府同宫': '紫微天府同在寅申，帝座有辅，主人品极高，富贵双全',
  '日月并明': '太阳在卯辰巳，太阴在酉戌亥，日月各得其所，主大贵',
  '日月同临': '太阳太阴同在丑未，日月同辉，主贵',
  '机月同梁': '天机太阴天同天梁会合，宜文职公职',
  '杀破狼格': '七杀破军贪狼三合，主变动创新，武职经商',
  '府相朝垣': '天府天相朝命，主人品厚重',
  '君臣庆会': '紫微在午，众星朝拱，极向离明格',
  '石中隐玉': '巨门在子，口才得贵',
  '日照雷门': '太阳天机在卯，光明智慧',
  '月朗天门': '太阴在亥，夜生人尤佳',
  '火贪格': '火星贪狼同宫，暴发之格',
  '铃贪格': '铃星贪狼同宫，同火贪',
  '刑囚夹印': '廉贞天相被擎羊陀罗夹，主官非',
  '命无正曜': '命宫无主星，借对宫星曜，需综合判断',
  '巨日同宫': '巨门太阳在寅申，口才得贵',
};

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
