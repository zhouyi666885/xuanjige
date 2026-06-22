/**
 * 六爻占卜排盘算法
 * 依据：《火珠林》《增删卜易》《卜筮正宗》《黄金策》
 * 
 * 核心：铜钱三枚掷六次成卦，安六亲、配六神、定世应、看动静生克
 */

// ============ 基础常量 ============

const BAGUA = ['坤', '震', '坎', '兑', '艮', '离', '巽', '乾'] as const;
const BAGUA_NUM: Record<string, number> = { '坤': 0, '震': 1, '坎': 2, '兑': 3, '艮': 4, '离': 5, '巽': 6, '乾': 7 };

// 八经卦属性
const GUA_ATTR: Record<string, { wuxing: string; fangwei: string; shu: number }> = {
  '乾': { wuxing: '金', fangwei: '西北', shu: 1 },
  '兑': { wuxing: '金', fangwei: '正西', shu: 2 },
  '离': { wuxing: '火', fangwei: '正南', shu: 3 },
  '震': { wuxing: '木', fangwei: '正东', shu: 4 },
  '巽': { wuxing: '木', fangwei: '东南', shu: 5 },
  '坎': { wuxing: '水', fangwei: '正北', shu: 6 },
  '艮': { wuxing: '土', fangwei: '东北', shu: 7 },
  '坤': { wuxing: '土', fangwei: '西南', shu: 8 },
};

// 六十四卦名
const LIUSHISI_GUA: Record<string, string> = {
  '乾乾': '乾为天', '乾坤': '天地否', '乾震': '天雷无妄', '乾巽': '天风姤',
  '乾坎': '天水讼', '乾离': '天火同人', '乾艮': '天山遁', '乾兑': '天泽履',
  '坤乾': '地天泰', '坤坤': '坤为地', '坤震': '地雷复', '坤巽': '地风升',
  '坤坎': '地水师', '坤离': '地火明夷', '坤艮': '地山谦', '坤兑': '地泽临',
  '震乾': '雷天大壮', '震坤': '雷地豫', '震震': '震为雷', '震巽': '雷风恒',
  '震坎': '雷水解', '震离': '雷火丰', '震艮': '雷山小过', '震兑': '雷泽归妹',
  '巽乾': '风天小畜', '巽坤': '风地观', '巽震': '风雷益', '巽巽': '巽为风',
  '巽坎': '风水涣', '巽离': '风火家人', '巽艮': '风山渐', '巽兑': '风泽中孚',
  '坎乾': '水天需', '坎坤': '水地比', '坎震': '水雷屯', '坎巽': '水风井',
  '坎坎': '坎为水', '坎离': '水火既济', '坎艮': '水山蹇', '坎兑': '水泽节',
  '离乾': '火天大有', '离坤': '火地晋', '离震': '火雷噬嗑', '离巽': '火风鼎',
  '离坎': '火水未济', '离离': '离为火', '离艮': '火山旅', '离兑': '火泽睽',
  '艮乾': '山天大畜', '艮坤': '山地剥', '艮震': '山雷颐', '艮巽': '山风蛊',
  '艮坎': '山水蒙', '艮离': '山火贲', '艮艮': '艮为山', '艮兑': '山泽损',
  '兑乾': '泽天夬', '兑坤': '泽地萃', '兑震': '泽雷随', '兑巽': '泽风大过',
  '兑坎': '泽水困', '兑离': '泽火革', '兑艮': '泽山咸', '兑兑': '兑为泽',
};

// 天干地支
const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const WU_XING_DZ: Record<string, string> = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火',
  '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水',
};

// 纳甲表（天干+地支+五行 配入六爻）
// 格式：[天干, 地支1, 地支2, 地支3, 地支4, 地支5, 地支6] 从初爻到上爻
const NA_JIA: Record<string, { gan: string; zhis: string[] }> = {
  '乾': { gan: '甲', zhis: ['子', '寅', '辰', '午', '申', '戌'] },
  '坤': { gan: '乙', zhis: ['未', '巳', '卯', '丑', '亥', '酉'] },
  '震': { gan: '庚', zhis: ['子', '寅', '辰', '午', '申', '戌'] },
  '巽': { gan: '辛', zhis: ['丑', '亥', '酉', '未', '巳', '卯'] },
  '坎': { gan: '戊', zhis: ['寅', '辰', '午', '申', '戌', '子'] },
  '离': { gan: '己', zhis: ['卯', '丑', '亥', '酉', '未', '巳'] },
  '艮': { gan: '丙', zhis: ['辰', '午', '申', '戌', '子', '寅'] },
  '兑': { gan: '丁', zhis: ['巳', '卯', '丑', '亥', '酉', '未'] },
};

// 世应位置表（八宫各卦世爻位置，从初爻起0-indexed）
const SHI_YING: Record<string, number[]> = {
  '乾': [5, 0, 1, 2, 3, 4, 4, 3],
  '坤': [5, 0, 1, 2, 3, 4, 4, 3],
  '震': [5, 0, 1, 2, 3, 4, 4, 3],
  '巽': [5, 0, 1, 2, 3, 4, 4, 3],
  '坎': [5, 0, 1, 2, 3, 4, 4, 3],
  '离': [5, 0, 1, 2, 3, 4, 4, 3],
  '艮': [5, 0, 1, 2, 3, 4, 4, 3],
  '兑': [5, 0, 1, 2, 3, 4, 4, 3],
};

// 八宫所属五行
const GONG_WUXING: Record<string, string> = {
  '乾': '金', '兑': '金', '离': '火', '震': '木',
  '巽': '木', '坎': '水', '艮': '土', '坤': '土',
};

// 六亲（以宫的五行为"我"，生克定六亲）
const LIU_QIN_ORDER = ['父母', '兄弟', '子孙', '妻财', '官鬼'] as const;
function getLiuQin(myWx: string, otherWx: string): string {
  const SHENG: Record<string, string> = { '金': '土', '木': '水', '水': '金', '火': '木', '土': '火' };
  const KE: Record<string, string> = { '金': '木', '木': '土', '水': '火', '火': '金', '土': '水' };
  const BEI_SHENG: Record<string, string> = { '土': '金', '水': '木', '金': '水', '木': '火', '火': '土' };
  const BEI_KE: Record<string, string> = { '木': '金', '土': '木', '火': '水', '金': '火', '水': '土' };
  if (otherWx === myWx) return '兄弟';
  if (SHENG[otherWx] === myWx) return '父母';  // 生我者父母
  if (BEI_SHENG[myWx] === otherWx) return '子孙'; // 我生者子孙
  if (KE[otherWx] === myWx) return '官鬼';  // 克我者官鬼
  if (BEI_KE[myWx] === otherWx) return '妻财'; // 我克者妻财
  return '兄弟';
}

// 六神顺序
const LIU_SHEN = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'] as const;
// 六神起手天干映射
const LIU_SHEN_START: Record<string, number> = {
  '甲': 0, '乙': 0, '丙': 1, '丁': 1, '戊': 2,
  '己': 2, '庚': 3, '辛': 3, '壬': 4, '癸': 5,
};

// ============ 排盘接口 ============

export interface LiuYaoYao {
  position: number;       // 爻位 1-6（初爻到上爻）
  yinYang: '阴' | '阳';  // 阴爻或阳爻
  isDong: boolean;        // 是否动爻
  naGan: string;          // 纳甲天干
  naZhi: string;          // 纳甲地支
  wuXing: string;         // 地支五行
  liuQin: string;         // 六亲
  liuShen: string;        // 六神
  isShi: boolean;         // 是否世爻
  isYing: boolean;        // 是否应爻
  isRiJian: boolean;      // 是否日建所临
  isYueJian: boolean;     // 是否月建所临
  isAn: boolean;          // 是否暗动
}

export interface LiuYaoPaiPan {
  guaMing: string;         // 卦名
  shangGua: string;        // 上卦（外卦）
  xiaGua: string;          // 下卦（内卦）
  bianGua: string;         // 变卦名
  bianShangGua: string;    // 变上卦
  bianXiaGua: string;      // 变下卦
  gong: string;            // 所属宫
  gongWuXing: string;      // 宫五行
  yaoList: LiuYaoYao[];    // 六爻信息
  bianYaoList: LiuYaoYao[]; // 变卦六爻
  riGan: string;           // 日干
  riZhi: string;           // 日支
  yueZhi: string;          // 月支
  yongShen: string;        // 用神
  yongShenYao: number;     // 用神所在爻位
  yuanShen: string;        // 原神
  jiShen: string;          // 忌神
  chouShen: string;        // 仇神
  dongYaoCount: number;    // 动爻数
}

// ============ 起卦方法 ============

/** 铜钱起卦法：3枚铜钱掷6次，字为3背为2 */
export function tongQianQiGua(
  throws: [number, number, number, number, number, number],
  riGan: string, riZhi: string, yueZhi: string,
  questionType: string = '通用'
): LiuYaoPaiPan {
  // 每次抛掷3枚铜钱，字(3)+背(2)，总和6-9
  // 6=老阴(变), 7=少阳, 8=少阴, 9=老阳(变)
  const yaoResults: { value: number; yinYang: '阴' | '阳'; isDong: boolean }[] = [];
  
  for (const sum of throws) {
    if (sum === 6) yaoResults.push({ value: 6, yinYang: '阴', isDong: true });      // 老阴变
    else if (sum === 7) yaoResults.push({ value: 7, yinYang: '阳', isDong: false }); // 少阳
    else if (sum === 8) yaoResults.push({ value: 8, yinYang: '阴', isDong: false }); // 少阴
    else yaoResults.push({ value: 9, yinYang: '阳', isDong: true });                 // 老阳变
  }

  return buildPaiPan(yaoResults, riGan, riZhi, yueZhi, questionType);
}

/** 时间起卦法（简化版：用当前时辰数起卦） */
export function shiJianQiGua(
  year: number, month: number, day: number, hour: number,
  riGan: string, riZhi: string, yueZhi: string,
  questionType: string = '通用'
): LiuYaoPaiPan {
  const total = year + month + day + hour;
  const shangGuaNum = total % 8 || 8;
  const xiaGuaNum = (total + hour) % 8 || 8;
  const dongYaoNum = total % 6 || 6;
  
  const shangGua = BAGUA[shangGuaNum - 1];
  const xiaGua = BAGUA[xiaGuaNum - 1];
  
  // 构建爻结果
  const yaoResults: { value: number; yinYang: '阴' | '阳'; isDong: boolean }[] = [];
  const shangLines = guaToLines(shangGua);
  const xiaLines = guaToLines(xiaGua);
  const allLines = [...xiaLines, ...shangLines]; // 初爻到上爻
  
  for (let i = 0; i < 6; i++) {
    yaoResults.push({
      value: allLines[i] === 1 ? 7 : 8,
      yinYang: allLines[i] === 1 ? '阳' : '阴',
      isDong: i === dongYaoNum - 1,
    });
  }
  
  return buildPaiPan(yaoResults, riGan, riZhi, yueZhi, questionType);
}

/** 数字起卦法 */
export function shuZiQiGua(
  num1: number, num2: number, num3: number,
  riGan: string, riZhi: string, yueZhi: string,
  questionType: string = '通用'
): LiuYaoPaiPan {
  const shangGuaNum = (num1 % 8) || 8;
  const xiaGuaNum = (num2 % 8) || 8;
  const dongYaoNum = (num3 % 6) || 6;
  
  const shangGua = BAGUA[shangGuaNum - 1];
  const xiaGua = BAGUA[xiaGuaNum - 1];
  
  const yaoResults: { value: number; yinYang: '阴' | '阳'; isDong: boolean }[] = [];
  const shangLines = guaToLines(shangGua);
  const xiaLines = guaToLines(xiaGua);
  const allLines = [...xiaLines, ...shangLines];
  
  for (let i = 0; i < 6; i++) {
    yaoResults.push({
      value: allLines[i] === 1 ? 7 : 8,
      yinYang: allLines[i] === 1 ? '阳' : '阴',
      isDong: i === dongYaoNum - 1,
    });
  }
  
  return buildPaiPan(yaoResults, riGan, riZhi, yueZhi, questionType);
}

// ============ 内部工具函数 ============

function guaToLines(gua: string): number[] {
  const num = BAGUA_NUM[gua];
  if (num === undefined) return [0, 0, 0];
  const lines: number[] = [];
  for (let i = 2; i >= 0; i--) {
    lines.push((num >> i) & 1);
  }
  return lines;
}

function linesToGua(lines: number[]): string {
  let num = 0;
  for (let i = 0; i < 3; i++) {
    num = (num << 1) | lines[i];
  }
  return BAGUA[num];
}

function buildPaiPan(
  yaoResults: { value: number; yinYang: '阴' | '阳'; isDong: boolean }[],
  riGan: string, riZhi: string, yueZhi: string,
  questionType: string
): LiuYaoPaiPan {
  // 确定上下卦
  const xiaLines = yaoResults.slice(0, 3).map(y => y.yinYang === '阳' ? 1 : 0);
  const shangLines = yaoResults.slice(3, 6).map(y => y.yinYang === '阳' ? 1 : 0);
  const xiaGua = linesToGua(xiaLines);
  const shangGua = linesToGua(shangLines);
  const guaMing = LIUSHISI_GUA[shangGua + xiaGua] || (shangGua + xiaGua);

  // 确定变卦
  const bianYaoResults = yaoResults.map(y => {
    if (y.isDong) {
      return { ...y, yinYang: (y.yinYang === '阳' ? '阴' : '阳') as '阴' | '阳', isDong: false };
    }
    return { ...y, isDong: false };
  });
  const bianXiaLines = bianYaoResults.slice(0, 3).map(y => y.yinYang === '阳' ? 1 : 0);
  const bianShangLines = bianYaoResults.slice(3, 6).map(y => y.yinYang === '阳' ? 1 : 0);
  const bianXiaGua = linesToGua(bianXiaLines);
  const bianShangGua = linesToGua(bianShangLines);
  const bianGuaMing = LIUSHISI_GUA[bianShangGua + bianXiaGua] || (bianShangGua + bianXiaGua);

  // 确定宫（简化：根据卦象归宫）
  const gong = xiaGua;
  const gongWuXing = GONG_WUXING[gong] || '土';

  // 纳甲配地支
  const naJiaXia = NA_JIA[xiaGua] || NA_JIA['坤'];
  const naJiaShang = NA_JIA[shangGua] || NA_JIA['坤'];
  const allNaJiaGan = naJiaXia.gan;
  const allNaJiaZhis = [...naJiaXia.zhis, ...naJiaShang.zhis];

  // 六神起手
  const liuShenStartIdx = LIU_SHEN_START[riGan] ?? 0;

  // 构建六爻
  const yaoList: LiuYaoYao[] = [];
  const dongYaoPositions: number[] = [];
  for (let i = 0; i < 6; i++) {
    const naZhi = allNaJiaZhis[i];
    const wx = WU_XING_DZ[naZhi] || '土';
    const liuQin = getLiuQin(gongWuXing, wx);
    const liuShen = LIU_SHEN[(liuShenStartIdx + i) % 6];
    const isShi = false; // 后面设
    const isYing = false;
    const isRiJian = naZhi === riZhi;
    const isYueJian = naZhi === yueZhi;
    const isAn = !yaoResults[i].isDong && isRiJian; // 日建冲安静之爻为暗动

    if (yaoResults[i].isDong) dongYaoPositions.push(i);

    yaoList.push({
      position: i + 1,
      yinYang: yaoResults[i].yinYang,
      isDong: yaoResults[i].isDong,
      naGan: i < 3 ? naJiaXia.gan : naJiaShang.gan,
      naZhi,
      wuXing: wx,
      liuQin,
      liuShen,
      isShi,
      isYing,
      isRiJian,
      isYueJian,
      isAn,
    });
  }

  // 安世应（简化：本宫卦世在六爻，一变世在初爻...）
  const shiIdx = getShiYaoIndex(xiaGua, shangGua);
  const yingIdx = (shiIdx + 3) % 6;
  yaoList[shiIdx].isShi = true;
  yaoList[yingIdx].isYing = true;

  // 确定用神
  const yongShen = getYongShen(questionType, gongWuXing);
  const yongShenYao = yaoList.findIndex(y => y.liuQin === yongShen) + 1;
  const yuanShen = getYuanShen(yongShen, gongWuXing);
  const jiShen = getJiShen(yongShen, gongWuXing);
  const chouShen = getChouShen(jiShen, gongWuXing);

  // 构建变卦六爻
  const bianYaoList: LiuYaoYao[] = bianYaoResults.map((y, i) => {
    const naZhi = allNaJiaZhis[i];
    const wx = WU_XING_DZ[naZhi] || '土';
    const liuQin = getLiuQin(GONG_WUXING[bianXiaGua] || gongWuXing, wx);
    return {
      position: i + 1,
      yinYang: y.yinYang,
      isDong: false,
      naGan: i < 3 ? naJiaXia.gan : naJiaShang.gan,
      naZhi,
      wuXing: wx,
      liuQin,
      liuShen: LIU_SHEN[(liuShenStartIdx + i) % 6],
      isShi: i === shiIdx,
      isYing: i === yingIdx,
      isRiJian: naZhi === riZhi,
      isYueJian: naZhi === yueZhi,
      isAn: false,
    };
  });

  return {
    guaMing,
    shangGua,
    xiaGua,
    bianGua: bianGuaMing,
    bianShangGua,
    bianXiaGua,
    gong,
    gongWuXing,
    yaoList,
    bianYaoList,
    riGan,
    riZhi,
    yueZhi,
    yongShen,
    yongShenYao,
    yuanShen,
    jiShen,
    chouShen,
    dongYaoCount: dongYaoPositions.length,
  };
}

function getShiYaoIndex(xiaGua: string, shangGua: string): number {
  // 简化世应规则：
  // 纯卦世在上爻(5), 一爻变世在初(0), 二爻变世在二(1)...
  if (xiaGua === shangGua) return 5; // 纯卦
  // 根据上下卦差异程度判定
  const xiaNum = BAGUA_NUM[xiaGua] ?? 0;
  const shangNum = BAGUA_NUM[shangGua] ?? 0;
  const diff = shangNum ^ xiaNum;
  // 简化：根据差异映射
  if (diff <= 1) return 0;
  if (diff <= 2) return 1;
  if (diff <= 3) return 2;
  if (diff <= 5) return 3;
  if (diff <= 6) return 4;
  return 5;
}

function getYongShen(questionType: string, gongWuXing: string): string {
  const WX_LIST = ['金', '木', '水', '火', '土'];
  const SHENG_MAP: Record<string, string> = { '金': '土', '木': '水', '水': '金', '火': '木', '土': '火' };
  const KE_MAP: Record<string, string> = { '金': '木', '木': '土', '水': '火', '火': '金', '土': '水' };
  
  switch (questionType) {
    case '求财': case '财运': case '投资': return '妻财';
    case '考试': case '学业': case '升学': return '父母';
    case '官运': case '升职': case '事业': return '官鬼';
    case '婚姻': case '恋爱': case '感情': return '妻财';
    case '疾病': case '健康': return '官鬼';
    case '诉讼': case '官司': return '官鬼';
    case '出行': case '行人': return '子孙';
    case '失物': return '妻财';
    default: return '官鬼';
  }
}

function getYuanShen(yongShen: string, gongWuXing: string): string {
  // 原神 = 生用神者
  const SHENG: Record<string, string> = { '父母': '金', '兄弟': '木', '子孙': '水', '妻财': '火', '官鬼': '土' };
  // 简化返回
  const map: Record<string, string> = { '父母': '兄弟', '兄弟': '子孙', '子孙': '妻财', '妻财': '官鬼', '官鬼': '父母' };
  return map[yongShen] || '兄弟';
}

function getJiShen(yongShen: string, gongWuXing: string): string {
  // 忌神 = 克用神者
  const map: Record<string, string> = { '父母': '子孙', '兄弟': '官鬼', '子孙': '父母', '妻财': '兄弟', '官鬼': '妻财' };
  return map[yongShen] || '子孙';
}

function getChouShen(jiShen: string, gongWuXing: string): string {
  // 仇神 = 生忌神者
  const map: Record<string, string> = { '父母': '兄弟', '兄弟': '子孙', '子孙': '妻财', '妻财': '官鬼', '官鬼': '父母' };
  return map[jiShen] || '兄弟';
}

// ============ 排盘输出 ============

/** 格式化六爻排盘结果 */
export function formatLiuYaoPaiPan(paiPan: LiuYaoPaiPan): string {
  const lines: string[] = [];
  
  lines.push(`=== 六爻排盘 ===`);
  lines.push(`卦名：${paiPan.guaMing}（${paiPan.shangGua}上${paiPan.xiaGua}下）`);
  if (paiPan.dongYaoCount > 0) {
    lines.push(`变卦：${paiPan.bianGua}（${paiPan.bianShangGua}上${paiPan.bianXiaGua}下）`);
  }
  lines.push(`宫：${paiPan.gong}宫（${paiPan.gongWuXing}）`);
  lines.push(`日辰：${paiPan.riGan}${paiPan.riZhi}  月建：${paiPan.yueZhi}月`);
  lines.push(`用神：${paiPan.yongShen}（第${paiPan.yongShenYao || '?'}爻）原神：${paiPan.yuanShen} 忌神：${paiPan.jiShen} 仇神：${paiPan.chouShen}`);
  lines.push(`动爻数：${paiPan.dongYaoCount}`);
  lines.push('');
  
  lines.push('--- 六爻详情 ---');
  // 从上爻到初爻显示
  for (let i = 5; i >= 0; i--) {
    const yao = paiPan.yaoList[i];
    const dongMark = yao.isDong ? ' ○' : (yao.isAn ? ' △' : '');
    const shiYing = yao.isShi ? ' 世' : (yao.isYing ? ' 应' : '');
    const riYue = [];
    if (yao.isRiJian) riYue.push('日建');
    if (yao.isYueJian) riYue.push('月建');
    const riYueStr = riYue.length > 0 ? `【${riYue.join('+')}】` : '';
    
    lines.push(`${yao.position}爻 ${yao.yinYang === '阳' ? '━━━' : '━ ━'} ${yao.liuQin} ${yao.naGan}${yao.naZhi}（${yao.wuXing}）${yao.liuShen}${dongMark}${shiYing}${riYueStr}`);
  }
  
  // 变卦信息
  if (paiPan.dongYaoCount > 0) {
    lines.push('');
    lines.push('--- 变卦 ---');
    for (let i = 5; i >= 0; i--) {
      const yao = paiPan.bianYaoList[i];
      lines.push(`${yao.position}爻 ${yao.yinYang === '阳' ? '━━━' : '━ ━'} ${yao.liuQin} ${yao.naGan}${yao.naZhi}（${yao.wuXing}）`);
    }
  }
  
  return lines.join('\n');
}

// ============ 断卦知识 ============

/** 《增删卜易》断卦核心规则 */
export const DUAN_GUA_RULES = `
【《增删卜易》断卦核心规则】
1. 用神为核心：用神旺相则吉，休囚则凶，受克更凶
2. 原神生用则吉，忌神克用则凶，仇神生忌则更凶
3. 日辰为六爻之主宰，月建为万卦之提纲
4. 动爻为事之机，静爻为事之本
5. 动而逢合为绊住，动而逢冲为冲动
6. 旺相：春木夏火秋金冬水，当令者旺
7. 休囚：不当令者为休，克当令者为囚
8. 用神有生无克则事成，有克无生则事败
9. 动爻化回头生则力增，化回头克则力减
10. 空亡之爻若旺相则出空有用，若休囚则出空亦废
`.trim();

/** 《黄金策》总断口诀 */
export const HUANG_JIN_CE = `
【《黄金策》总断口诀】
1. 持世者己，应爻者彼
2. 世旺己强，应旺彼盛
3. 世应相生则和合，相克则争斗
4. 用神发动则事急，安静则事缓
5. 逢冲则散，逢合则成
6. 入墓则暗昧不明
7. 伏藏则隐情不露
8. 进神则向前发展，退神则向后退缩
9. 反吟伏吟主反复
10. 六冲卦主散，六合卦主合
`.trim();

/** 用神选取规则 */
export const YONG_SHEN_RULES = `
【用神选取规则（《卜筮正宗》）】
- 求财/投资/买卖：妻财爻为用神
- 考试/学业/文书：父母爻为用神
- 官运/升职/官司：官鬼爻为用神
- 婚姻/恋爱/感情：妻财爻（男测）/官鬼爻（女测）为用神
- 疾病/灾祸：官鬼爻为用神（也可看子孙爻制鬼）
- 出行/行人：子孙爻为用神
- 失物/寻人：妻财爻为用神
- 诉讼/竞争：官鬼爻为用神
- 交友/合作：兄弟爻为用神
- 子女/下属：子孙爻为用神
`.trim();
