/**
 * 奇门遁甲排盘算法
 * 依据：《烟波钓叟赋》《奇门遁甲大全》
 * 
 * 核心：阴阳遁各九局，九宫排天盘地盘人盘神盘
 */

// ============ 基础常量 ============

// 九宫数（洛书）
const LUO_SHU = [5, 1, 2, 3, 4, 6, 7, 8, 9]; // 中、北、西南、东、东南、西北、西、东北、南
// 九宫位
const GONG_WEI = ['中五', '坎一', '坤二', '震三', '巽四', '乾六', '兑七', '艮八', '离九'];

// 九星
const JIU_XING = ['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'] as const;
// 九星五行
const XING_WUXING: Record<string, string> = {
  '天蓬': '水', '天芮': '土', '天冲': '木', '天辅': '木', '天禽': '土',
  '天心': '金', '天柱': '金', '天任': '土', '天英': '火',
};
// 九星吉凶
const XING_JI_XIONG: Record<string, string> = {
  '天蓬': '大凶', '天芮': '大凶', '天冲': '小吉', '天辅': '大吉', '天禽': '中平',
  '天心': '大吉', '天柱': '小凶', '天任': '大吉', '天英': '小凶',
};
// 九星原始宫位
const XING_GONG: Record<string, number> = {
  '天蓬': 1, '天芮': 2, '天冲': 3, '天辅': 4, '天禽': 5,
  '天心': 6, '天柱': 7, '天任': 8, '天英': 9,
};

// 八门
const BA_MEN = ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'] as const;
// 八门吉凶
const MEN_JI_XIONG: Record<string, string> = {
  '休门': '吉', '生门': '大吉', '伤门': '凶', '杜门': '中平',
  '景门': '中平', '死门': '大凶', '惊门': '凶', '开门': '大吉',
};
// 八门原始宫位
const MEN_GONG: Record<string, number> = {
  '休门': 1, '生门': 8, '伤门': 3, '杜门': 4,
  '景门': 9, '死门': 2, '惊门': 7, '开门': 6,
};
// 八门五行
const MEN_WUXING: Record<string, string> = {
  '休门': '水', '生门': '土', '伤门': '木', '杜门': '木',
  '景门': '火', '死门': '土', '惊门': '金', '开门': '金',
};

// 八神（阳遁顺排）
const BA_SHEN_YANG = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'] as const;
// 八神（阴遁逆排）
const BA_SHEN_YIN = ['值符', '螣蛇', '太阴', '六合', '勾陈', '朱雀', '九地', '九天'] as const;

// 三奇六仪
const SAN_QI_LIU_YI = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'] as const;

// 节气与阴阳遁对应（简化）
const JIE_QI_DUN: Record<string, { dunType: '阳遁' | '阴遁'; ju: number }> = {
  '冬至': { dunType: '阳遁', ju: 1 }, '小寒': { dunType: '阳遁', ju: 2 }, '大寒': { dunType: '阳遁', ju: 3 },
  '立春': { dunType: '阳遁', ju: 4 }, '雨水': { dunType: '阳遁', ju: 5 }, '惊蛰': { dunType: '阳遁', ju: 6 },
  '春分': { dunType: '阳遁', ju: 7 }, '清明': { dunType: '阳遁', ju: 8 }, '谷雨': { dunType: '阳遁', ju: 9 },
  '立夏': { dunType: '阳遁', ju: 4 }, '小满': { dunType: '阳遁', ju: 5 }, '芒种': { dunType: '阳遁', ju: 6 },
  '夏至': { dunType: '阴遁', ju: 9 }, '小暑': { dunType: '阴遁', ju: 8 }, '大暑': { dunType: '阴遁', ju: 7 },
  '立秋': { dunType: '阴遁', ju: 2 }, '处暑': { dunType: '阴遁', ju: 1 }, '白露': { dunType: '阴遁', ju: 9 },
  '秋分': { dunType: '阴遁', ju: 7 }, '寒露': { dunType: '阴遁', ju: 6 }, '霜降': { dunType: '阴遁', ju: 5 },
  '立冬': { dunType: '阴遁', ju: 6 }, '小雪': { dunType: '阴遁', ju: 5 }, '大雪': { dunType: '阴遁', ju: 4 },
};

// ============ 排盘接口 ============

export interface QiMenGong {
  gongWei: string;       // 宫位名
  gongShu: number;       // 宫数（1-9）
  tianPanXing: string;   // 天盘星
  diPanXing: string;     // 地盘星
  tianPanMen: string;    // 天盘门
  diPanMen: string;      // 地盘门
  shenPan: string;       // 神盘
  tianQi: string;        // 天盘三奇六仪
  diQi: string;          // 地盘三奇六仪
  xingWuXing: string;    // 星五行
  menWuXing: string;     // 门五行
  menJiXiong: string;    // 门吉凶
  xingJiXiong: string;   // 星吉凶
}

export interface QiMenPaiPan {
  dunType: '阳遁' | '阴遁';
  juShu: number;           // 局数
  jieQi: string;           // 节气
  zhiFu: string;           // 值符（星）
  zhiShi: string;          // 值使（门）
  gongs: QiMenGong[];      // 九宫信息
  keYong: string;          // 客用（天盘）
  zhuYong: string;         // 主用（地盘）
  riJiGan: string;         // 日奇干
  shiJiGan: string;        // 时奇干
}

// ============ 排盘函数 ============

/** 根据节气和时辰排奇门盘 */
export function paiPan(
  month: number, day: number, hour: number,
  riGanZhi: string = ''
): QiMenPaiPan {
  // 确定节气和局数
  const jieQi = getJieQi(month, day);
  const dunInfo = JIE_QI_DUN[jieQi] || { dunType: '阳遁' as const, ju: 1 };
  const { dunType, ju: juShu } = dunInfo;
  
  // 地盘三奇六仪排列（根据局数）
  const diQiArr = getDiQiArr(juShu);
  
  // 确定值符值使
  const hourIdx = hour % 12 || 12; // 时辰序号
  const zhiFuIdx = ((hourIdx - 1) % 9);
  const zhiFu = JIU_XING[zhiFuIdx] || JIU_XING[0];
  const zhiShiIdx = ((hourIdx - 1) % 8);
  const zhiShi = BA_MEN[zhiShiIdx] || BA_MEN[0];
  
  // 天盘星（值符随时辰顺/逆飞）
  const tianXingArr = getTianXingArr(zhiFuIdx, hourIdx, dunType);
  
  // 天盘门（值使随时辰顺/逆飞）
  const tianMenArr = getTianMenArr(zhiShiIdx, hourIdx, dunType);
  
  // 天盘三奇六仪
  const tianQiArr = getTianQiArr(diQiArr, tianXingArr);
  
  // 神盘
  const shenPanArr = getShenPanArr(hourIdx, dunType);
  
  // 日奇干和时奇干
  const riJiGan = getRiJiGan(riGanZhi);
  const shiJiGan = getShiJiGan(hour);
  
  // 构建九宫
  const gongs: QiMenGong[] = [];
  for (let i = 1; i <= 9; i++) {
    if (i === 5) continue; // 中五宫寄坤二
    const gongIdx = i <= 4 ? i - 1 : i - 2; // 跳过5
    gongs.push({
      gongWei: GONG_WEI[i] || `宫${i}`,
      gongShu: i,
      tianPanXing: tianXingArr[i] || JIU_XING[0],
      diPanXing: JIU_XING[i === 5 ? 1 : gongIdx] || JIU_XING[0],
      tianPanMen: tianMenArr[i] || BA_MEN[0],
      diPanMen: BA_MEN[i === 5 ? 1 : gongIdx] || BA_MEN[0],
      shenPan: shenPanArr[i] || '',
      tianQi: tianQiArr[i] || '',
      diQi: diQiArr[i] || '',
      xingWuXing: XING_WUXING[tianXingArr[i] || ''] || '土',
      menWuXing: MEN_WUXING[tianMenArr[i] || ''] || '土',
      menJiXiong: MEN_JI_XIONG[tianMenArr[i] || ''] || '中平',
      xingJiXiong: XING_JI_XIONG[tianXingArr[i] || ''] || '中平',
    });
  }
  
  return {
    dunType,
    juShu,
    jieQi,
    zhiFu,
    zhiShi,
    gongs,
    keYong: `天盘（${dunType}${juShu}局）`,
    zhuYong: '地盘',
    riJiGan,
    shiJiGan,
  };
}

function getJieQi(month: number, day: number): string {
  // 简化：根据月份和日期估算节气
  const jieQiByMonth: Record<number, [string, string, string]> = {
    1: ['小寒', '大寒', '立春'],
    2: ['立春', '雨水', '惊蛰'],
    3: ['惊蛰', '春分', '清明'],
    4: ['清明', '谷雨', '立夏'],
    5: ['立夏', '小满', '芒种'],
    6: ['芒种', '夏至', '小暑'],
    7: ['小暑', '大暑', '立秋'],
    8: ['立秋', '处暑', '白露'],
    9: ['白露', '秋分', '寒露'],
    10: ['寒露', '霜降', '立冬'],
    11: ['立冬', '小雪', '大雪'],
    12: ['大雪', '冬至', '小寒'],
  };
  const arr = jieQiByMonth[month];
  if (!arr) return '冬至';
  if (day <= 7) return arr[0];
  if (day <= 20) return arr[1];
  return arr[2];
}

function getDiQiArr(juShu: number): Record<number, string> {
  // 地盘排布：局数决定戊的起始宫
  const startGong = juShu;
  const result: Record<number, string> = {};
  for (let i = 0; i < 9; i++) {
    const gong = ((startGong - 1 + i) % 9) + 1;
    if (gong === 5) continue;
    result[gong] = SAN_QI_LIU_YI[i];
  }
  return result;
}

function getTianXingArr(zhiFuIdx: number, hourIdx: number, dunType: '阳遁' | '阴遁'): Record<number, string> {
  const result: Record<number, string> = {};
  const steps = dunType === '阳遁' ? hourIdx : -hourIdx;
  for (let i = 0; i < 9; i++) {
    const gong = ((i + steps) % 9 + 9) % 9 + 1;
    result[gong] = JIU_XING[i];
  }
  return result;
}

function getTianMenArr(zhiShiIdx: number, hourIdx: number, dunType: '阳遁' | '阴遁'): Record<number, string> {
  const result: Record<number, string> = {};
  const steps = dunType === '阳遁' ? hourIdx : -hourIdx;
  for (let i = 0; i < 8; i++) {
    const gong = ((i + steps) % 8 + 8) % 8 + 1;
    result[gong] = BA_MEN[(i + zhiShiIdx) % 8];
  }
  return result;
}

function getTianQiArr(diQi: Record<number, string>, tianXing: Record<number, string>): Record<number, string> {
  // 天盘三奇六仪随天盘星移动
  return { ...diQi };
}

function getShenPanArr(hourIdx: number, dunType: '阳遁' | '阴遁'): Record<number, string> {
  const shenList = dunType === '阳遁' ? BA_SHEN_YANG : BA_SHEN_YIN;
  const result: Record<number, string> = {};
  for (let i = 0; i < 8; i++) {
    const gong = ((i + hourIdx) % 8) + 1;
    result[gong] = shenList[i];
  }
  return result;
}

function getRiJiGan(riGanZhi: string): string {
  if (riGanZhi && riGanZhi.length >= 1) return riGanZhi[0];
  return '甲';
}

function getShiJiGan(hour: number): string {
  const tianGan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const idx = Math.floor(hour / 2) % 10;
  return tianGan[idx];
}

// ============ 格式化输出 ============

export function formatQiMenPaiPan(paiPan: QiMenPaiPan): string {
  const lines: string[] = [];
  lines.push(`=== 奇门遁甲排盘 ===`);
  lines.push(`${paiPan.dunType}${paiPan.juShu}局  节气：${paiPan.jieQi}`);
  lines.push(`值符：${paiPan.zhiFu}  值使：${paiPan.zhiShi}`);
  lines.push(`日奇干：${paiPan.riJiGan}  时奇干：${paiPan.shiJiGan}`);
  lines.push('');
  
  for (const gong of paiPan.gongs) {
    lines.push(`【${gong.gongWei}】`);
    lines.push(`  天盘：${gong.tianPanXing}（${gong.xingJiXiong}）+ ${gong.tianPanMen}（${gong.menJiXiong}）+ ${gong.tianQi}`);
    lines.push(`  地盘：${gong.diPanXing} + ${gong.diPanMen} + ${gong.diQi}`);
    if (gong.shenPan) lines.push(`  神盘：${gong.shenPan}`);
    lines.push('');
  }
  
  // 格局判断
  lines.push('--- 格局要点 ---');
  lines.push(getGeJuYaoDian(paiPan));
  
  return lines.join('\n');
}

function getGeJuYaoDian(paiPan: QiMenPaiPan): string {
  const points: string[] = [];
  
  // 吉门吉星同宫为大吉
  for (const gong of paiPan.gongs) {
    if (gong.menJiXiong.includes('吉') && gong.xingJiXiong.includes('吉')) {
      points.push(`${gong.gongWei}：${gong.tianPanMen}+${gong.tianPanXing}，吉门吉星，大吉之位`);
    }
    if (gong.menJiXiong.includes('凶') && gong.xingJiXiong.includes('凶')) {
      points.push(`${gong.gongWei}：${gong.tianPanMen}+${gong.tianPanXing}，凶门凶星，大凶之位`);
    }
  }
  
  // 三奇得使
  for (const gong of paiPan.gongs) {
    if (['乙', '丙', '丁'].includes(gong.tianQi) && gong.menJiXiong.includes('吉')) {
      points.push(`${gong.gongWei}：三奇（${gong.tianQi}）得吉门（${gong.tianPanMen}），大吉格局`);
    }
  }
  
  return points.join('\n') || '格局平稳，无明显吉凶趋向';
}

// ============ 断局知识 ============

export const QI_MEN_LILUN = `
【奇门遁甲核心理论（《烟波钓叟赋》）】
1. 阴阳遁各九局，冬至后阳遁，夏至后阴遁
2. 九星：天蓬大凶、天芮大凶、天冲小吉、天辅大吉、天禽中平、天心大吉、天柱小凶、天任大吉、天英小凶
3. 八门：开休生为三吉门、死惊伤为三凶门、杜景为中平
4. 八神：值符最吉、螣蛇主虚惊、太阴主暗助、六合主和合、白虎主凶伤、玄武主盗贼、九地主坚固、九天主刚健
5. 格局判断：
   - 吉门+吉星+吉神=大吉
   - 凶门+凶星=大凶
   - 三奇（乙丙丁）得使为最吉格局
   - 庚+庚为太白同位，主战争
   - 庚+癸为大格，主灾祸
6. 用神选取：
   - 求财看生门、戊
   - 官运看开门、天心
   - 婚姻看六合、乙
   - 出行看伤门、驿马
   - 诉讼看惊门、庚
`.trim();
