/**
 * 梅花易数起卦算法
 * 依据：《梅花易数》邵雍
 * 
 * 核心：万物皆可起卦，以体用生克断吉凶
 * 体为主（自己），用为事（对方/事情）
 */

// ============ 基础常量 ============

const BAGUA = ['坤', '震', '坎', '兑', '艮', '离', '巽', '乾'] as const;
const BAGUA_NUM: Record<string, number> = { '坤': 0, '震': 1, '坎': 2, '兑': 3, '艮': 4, '离': 5, '巽': 6, '乾': 7 };

// 八卦属性
const GUA_ATTR: Record<string, { wuxing: string; xiang: string; fangwei: string; shu: number; family: string; body: string }> = {
  '乾': { wuxing: '金', xiang: '天', fangwei: '西北', shu: 1, family: '父', body: '首' },
  '兑': { wuxing: '金', xiang: '泽', fangwei: '正西', shu: 2, family: '少女', body: '口' },
  '离': { wuxing: '火', xiang: '火', fangwei: '正南', shu: 3, family: '中女', body: '目' },
  '震': { wuxing: '木', xiang: '雷', fangwei: '正东', shu: 4, family: '长男', body: '足' },
  '巽': { wuxing: '木', xiang: '风', fangwei: '东南', shu: 5, family: '长女', body: '股' },
  '坎': { wuxing: '水', xiang: '水', fangwei: '正北', shu: 6, family: '中男', body: '耳' },
  '艮': { wuxing: '土', xiang: '山', fangwei: '东北', shu: 7, family: '少男', body: '手' },
  '坤': { wuxing: '土', xiang: '地', fangwei: '西南', shu: 8, family: '母', body: '腹' },
};

// 五行生克
const SHENG: Record<string, string> = { '金': '水', '水': '木', '木': '火', '火': '土', '土': '金' };
const KE: Record<string, string> = { '金': '木', '木': '土', '土': '水', '水': '火', '火': '金' };
const BEI_SHENG: Record<string, string> = { '水': '金', '木': '水', '火': '木', '土': '火', '金': '土' };
const BEI_KE: Record<string, string> = { '木': '金', '土': '木', '水': '土', '火': '水', '金': '火' };

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

// 卦序（先天数）
const XIAN_TIAN_SHU: Record<string, number> = {
  '乾': 1, '兑': 2, '离': 3, '震': 4,
  '巽': 5, '坎': 6, '艮': 7, '坤': 8,
};

// ============ 排盘接口 ============

export interface MeiHuaPaiPan {
  guaMing: string;           // 卦名
  shangGua: string;          // 上卦（外卦）
  xiaGua: string;            // 下卦（内卦）
  shangWuXing: string;       // 上卦五行
  xiaWuXing: string;         // 下卦五行
  tiGua: string;             // 体卦
  yongGua: string;           // 用卦
  tiWuXing: string;          // 体卦五行
  yongWuXing: string;        // 用卦五行
  tiYongRelation: string;    // 体用关系（体克用/用克体/体生用/用生体/比和）
  jiXiong: string;           // 吉凶判定
  bianGua: string;           // 变卦名
  bianGuaName: string;       // 变卦
  bianWuXing: string;        // 变卦五行
  dongYaoPos: number;        // 动爻位置1-6
  dongYaoCi: string;         // 动爻辞
  shangAttr: typeof GUA_ATTR[string]; // 上卦属性
  xiaAttr: typeof GUA_ATTR[string];   // 下卦属性
  qiGuaMethod: string;       // 起卦方法
  qiGuaSource: string;       // 起卦依据
  huTiGua?: string;          // 互体卦
  huYongGua?: string;        // 互用卦
  duanGuaJiYao: string[];    // 断卦要点
}

// ============ 起卦方法 ============

/** 时间起卦法 */
export function shiJianQiGua(
  year: number, month: number, day: number, hour: number,
  qiGuaSource: string = ''
): MeiHuaPaiPan {
  const shangNum = (year + month + day) % 8 || 8;
  const xiaNum = (year + month + day + hour) % 8 || 8;
  const dongNum = (year + month + day + hour) % 6 || 6;
  
  const shangGua = BAGUA[shangNum - 1];
  const xiaGua = BAGUA[xiaNum - 1];
  
  return buildPaiPan(shangGua, xiaGua, dongNum, `时间起卦法（${year}年${month}月${day}日${hour}时）`, qiGuaSource || `${year}年${month}月${day}日${hour}时`);
}

/** 数字起卦法 */
export function shuZiQiGua(num1: number, num2: number, num3: number): MeiHuaPaiPan {
  const shangGua = BAGUA[(num1 % 8) || 8 - 1] || BAGUA[0];
  const xiaGua = BAGUA[(num2 % 8) || 8 - 1] || BAGUA[0];
  const dongNum = (num3 % 6) || 6;
  
  return buildPaiPan(shangGua, xiaGua, dongNum, '数字起卦法', `数字${num1}/${num2}/${num3}`);
}

/** 文字起卦法 */
export function wenZiQiGua(text: string): MeiHuaPaiPan {
  const len = text.length;
  if (len < 2) {
    return buildPaiPan('乾', '坤', 1, '文字起卦法', text);
  }
  const half = Math.floor(len / 2);
  const shangCount = half;
  const xiaCount = len - half;
  const shangGua = BAGUA[(shangCount % 8) || 8 - 1] || BAGUA[0];
  const xiaGua = BAGUA[(xiaCount % 8) || 8 - 1] || BAGUA[0];
  const dongNum = (len % 6) || 6;
  
  return buildPaiPan(shangGua, xiaGua, dongNum, '文字起卦法', `"${text}"（${len}字）`);
}

/** 万物类象起卦法（根据外应） */
export function waiYingQiGua(xiang: string): MeiHuaPaiPan {
  // 根据外应类象映射到八卦
  const XIANG_MAP: Record<string, string> = {
    '鸟': '离', '鸡': '巽', '狗': '艮', '牛': '坤', '马': '乾', '龙': '震',
    '蛇': '巽', '鱼': '坎', '虎': '兑', '兔': '震', '猴': '乾', '猪': '坎',
    '风': '巽', '雨': '坎', '雷': '震', '火': '离', '水': '坎', '山': '艮',
    '花': '离', '树': '震', '石': '艮', '金': '乾', '云': '坤', '日': '离',
    '月': '坎', '星': '乾', '声': '震', '色红': '离', '色白': '乾', '色黑': '坎',
    '色青': '震', '色黄': '坤', '东': '震', '南': '离', '西': '兑', '北': '坎',
  };
  
  let shangGua = '乾';
  let xiaGua = '坤';
  
  // 尝试匹配外应
  const chars = xiang.split('');
  for (const c of chars) {
    if (XIANG_MAP[c]) {
      if (shangGua === '乾') shangGua = XIANG_MAP[c];
      else xiaGua = XIANG_MAP[c];
    }
  }
  
  // 也尝试整体匹配
  if (XIANG_MAP[xiang]) shangGua = XIANG_MAP[xiang];
  
  const dongNum = (xiang.length % 6) || 1;
  
  return buildPaiPan(shangGua, xiaGua, dongNum, '外应起卦法', xiang);
}

// ============ 内部工具 ============

function guaToLines(gua: string): number[] {
  const num = BAGUA_NUM[gua];
  if (num === undefined) return [0, 0, 0];
  const lines: number[] = [];
  for (let i = 2; i >= 0; i--) {
    lines.push((num >> i) & 1);
  }
  return lines;
}

function buildPaiPan(
  shangGua: string, xiaGua: string, dongYaoPos: number,
  qiGuaMethod: string, qiGuaSource: string
): MeiHuaPaiPan {
  const shangAttr = GUA_ATTR[shangGua];
  const xiaAttr = GUA_ATTR[xiaGua];
  const guaMing = LIUSHISI_GUA[shangGua + xiaGua] || (shangGua + xiaGua);
  
  // 体用判定：动爻所在卦为用卦，不动之卦为体卦
  // 动爻在1-3爻（下卦），则下卦为用、上卦为体
  // 动爻在4-6爻（上卦），则上卦为用、下卦为体
  let tiGua: string, yongGua: string;
  let tiWuXing: string, yongWuXing: string;
  
  if (dongYaoPos <= 3) {
    yongGua = xiaGua; tiGua = shangGua;
    yongWuXing = xiaAttr.wuxing; tiWuXing = shangAttr.wuxing;
  } else {
    yongGua = shangGua; tiGua = xiaGua;
    yongWuXing = shangAttr.wuxing; tiWuXing = xiaAttr.wuxing;
  }
  
  // 体用关系
  const { relation, jiXiong } = panDuanTiYong(tiWuXing, yongWuXing);
  
  // 变卦：动爻变（阳变阴、阴变阳）
  const xiaLines = guaToLines(xiaGua);
  const shangLines = guaToLines(shangGua);
  const allLines = [...xiaLines, ...shangLines];
  allLines[dongYaoPos - 1] = allLines[dongYaoPos - 1] === 1 ? 0 : 1;
  const bianXiaLines = allLines.slice(0, 3);
  const bianShangLines = allLines.slice(3, 6);
  const bianXiaNum = (bianXiaLines[0] << 2) | (bianXiaLines[1] << 1) | bianXiaLines[2];
  const bianShangNum = (bianShangLines[0] << 2) | (bianShangLines[1] << 1) | bianShangLines[2];
  const bianXiaGua = BAGUA[bianXiaNum] || '坤';
  const bianShangGua = BAGUA[bianShangNum] || '坤';
  const bianGuaMing = LIUSHISI_GUA[bianShangGua + bianXiaGua] || (bianShangGua + bianXiaGua);
  const bianWuXing = GUA_ATTR[bianShangGua]?.wuxing || '土';
  
  // 互卦（2-3-4爻为下互，3-4-5爻为上互）
  const huXiaLines = [allLines[1], allLines[2], allLines[3]];
  const huShangLines = [allLines[2], allLines[3], allLines[4]];
  const huXiaNum = (huXiaLines[0] << 2) | (huXiaLines[1] << 1) | huXiaLines[2];
  const huShangNum = (huShangLines[0] << 2) | (huShangLines[1] << 1) | huShangLines[2];
  const huTiGua = BAGUA[huShangNum] || '坤';
  const huYongGua = BAGUA[huXiaNum] || '坤';
  
  // 动爻辞（简化）
  const dongYaoCi = getYaoCi(guaMing, dongYaoPos);
  
  // 断卦要点
  const duanGuaJiYao = generateDuanGuaJiYao(tiWuXing, yongWuXing, bianWuXing, relation, guaMing);
  
  return {
    guaMing,
    shangGua,
    xiaGua,
    shangWuXing: shangAttr.wuxing,
    xiaWuXing: xiaAttr.wuxing,
    tiGua,
    yongGua,
    tiWuXing,
    yongWuXing,
    tiYongRelation: relation,
    jiXiong,
    bianGua: bianGuaMing,
    bianGuaName: bianShangGua + bianXiaGua,
    bianWuXing,
    dongYaoPos,
    dongYaoCi,
    shangAttr,
    xiaAttr,
    qiGuaMethod,
    qiGuaSource,
    huTiGua,
    huYongGua,
    duanGuaJiYao,
  };
}

function panDuanTiYong(tiWx: string, yongWx: string): { relation: string; jiXiong: string } {
  if (tiWx === yongWx) return { relation: '体用比和', jiXiong: '吉' };
  if (KE[tiWx] === yongWx) return { relation: '体克用', jiXiong: '小吉' };
  if (BEI_KE[tiWx] === yongWx) return { relation: '用克体', jiXiong: '大凶' };
  if (SHENG[tiWx] === yongWx) return { relation: '体生用', jiXiong: '小凶（耗气）' };
  if (BEI_SHENG[tiWx] === yongWx) return { relation: '用生体', jiXiong: '大吉' };
  return { relation: '无直接生克', jiXiong: '平' };
}

function getYaoCi(guaMing: string, pos: number): string {
  // 简化：返回卦象提示
  const yaoNames = ['初', '二', '三', '四', '五', '上'];
  return `${guaMing}${yaoNames[pos - 1]}爻动`;
}

function generateDuanGuaJiYao(
  tiWx: string, yongWx: string, bianWx: string,
  relation: string, guaMing: string
): string[] {
  const points: string[] = [];
  
  // 1. 体用生克
  points.push(`体卦（${tiWx}）${relation}用卦（${yongWx}），${relation.includes('吉') ? '利于行事' : relation.includes('凶') ? '须防不利' : '平稳'}`);
  
  // 2. 变卦影响
  if (SHENG[bianWx] === tiWx || BEI_SHENG[tiWx] === bianWx) {
    points.push(`变卦（${bianWx}）生体，事有转机，逢凶化吉`);
  } else if (KE[bianWx] === tiWx || BEI_KE[tiWx] === bianWx) {
    points.push(`变卦（${bianWx}）克体，后续发展不利`);
  } else if (bianWx === tiWx) {
    points.push(`变卦与体比和，事成且稳`);
  }
  
  // 3. 应期判断
  points.push(`应期：用卦旺相时成事快，休囚时成事慢。${yongWx}旺于${getWangSeason(yongWx)}月`);
  
  return points;
}

function getWangSeason(wx: string): string {
  const map: Record<string, string> = {
    '木': '春（寅卯辰）', '火': '夏（巳午未）', '金': '秋（申酉戌）',
    '水': '冬（亥子丑）', '土': '四季末（辰戌丑未）',
  };
  return map[wx] || '';
}

// ============ 格式化输出 ============

export function formatMeiHuaPaiPan(paiPan: MeiHuaPaiPan): string {
  const lines: string[] = [];
  
  lines.push(`=== 梅花易数排盘 ===`);
  lines.push(`起卦方法：${paiPan.qiGuaMethod}`);
  lines.push(`起卦依据：${paiPan.qiGuaSource}`);
  lines.push('');
  lines.push(`卦名：${paiPan.guaMing}`);
  lines.push(`上卦：${paiPan.shangGua}（${paiPan.shangAttr.xiang}·${paiPan.shangWuXing}·${paiPan.shangAttr.fangwei}·数${XIAN_TIAN_SHU[paiPan.shangGua] || '?'}）`);
  lines.push(`下卦：${paiPan.xiaGua}（${paiPan.xiaAttr.xiang}·${paiPan.xiaWuXing}·${paiPan.xiaAttr.fangwei}·数${XIAN_TIAN_SHU[paiPan.xiaGua] || '?'}）`);
  lines.push(`动爻：第${paiPan.dongYaoPos}爻 → ${paiPan.dongYaoCi}`);
  lines.push('');
  lines.push(`--- 体用分析 ---`);
  lines.push(`体卦：${paiPan.tiGua}（${paiPan.tiWuXing}）—— 代表自己`);
  lines.push(`用卦：${paiPan.yongGua}（${paiPan.yongWuXing}）—— 代表所问之事`);
  lines.push(`体用关系：${paiPan.tiYongRelation} → ${paiPan.jiXiong}`);
  lines.push('');
  lines.push(`--- 变卦 ---`);
  lines.push(`变卦：${paiPan.bianGua}（${paiPan.bianWuXing}）`);
  if (paiPan.huTiGua && paiPan.huYongGua) {
    lines.push(`互体卦：${paiPan.huTiGua} 互用卦：${paiPan.huYongGua}`);
  }
  lines.push('');
  lines.push(`--- 断卦要点 ---`);
  for (const p of paiPan.duanGuaJiYao) {
    lines.push(`• ${p}`);
  }
  
  return lines.join('\n');
}

// ============ 梅花易数核心理论 ============

export const MEI_HUA_LILUN = `
【梅花易数核心理论（《梅花易数》邵雍）】
1. 万物皆可起卦：时间、数字、文字、声音、外应均可
2. 体用生克为断卦核心：
   - 体克用：小吉，费力可成
   - 用克体：大凶，防不利
   - 体生用：小凶，耗费精力
   - 用生体：大吉，事来就我
   - 体用比和：吉，和谐顺遂
3. 应期判断：
   - 体卦旺相则速，休囚则迟
   - 生体之卦旺月应期近
   - 克体之卦旺月为灾期
4. 外应占法（梅花独有）：
   - 占卦时偶然所见所闻皆为卦象的一部分
   - 见吉兆则吉上加吉，见凶兆则凶上加凶
   - 外应优先于卦象
5. 断卦三要：耳目心三者并用
6. 十应：天时、地理、人事、时令、方所、动物、静物、言语、声音、五色
`.trim();
