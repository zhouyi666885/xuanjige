/**
 * 风水排盘算法
 * 依据：《沈氏玄空学》《八宅明镜》
 * 
 * 核心：玄空飞星+八宅法
 */

// ============ 玄空飞星 ============

const JIU_XING_FEI = ['一白', '二黑', '三碧', '四绿', '五黄', '六白', '七赤', '八白', '九紫'] as const;

// 九星含义
const JIU_XING_HAN_YI: Record<string, { wuxing: string; gua: string; jiXiong: string; zhuShi: string }> = {
  '一白': { wuxing: '水', gua: '坎', jiXiong: '吉', zhuShi: '官贵、人缘、智慧' },
  '二黑': { wuxing: '土', gua: '坤', jiXiong: '凶', zhuShi: '病符、寡妇、小人' },
  '三碧': { wuxing: '木', gua: '震', jiXiong: '凶', zhuShi: '是非、官讼、贼盗' },
  '四绿': { wuxing: '木', gua: '巽', jiXiong: '吉', zhuShi: '文昌、学业、名声' },
  '五黄': { wuxing: '土', gua: '中', jiXiong: '大凶', zhuShi: '灾祸、疾病、死亡' },
  '六白': { wuxing: '金', gua: '乾', jiXiong: '吉', zhuShi: '权威、官职、偏财' },
  '七赤': { wuxing: '金', gua: '兑', jiXiong: '凶', zhuShi: '口舌、损伤、桃花' },
  '八白': { wuxing: '土', gua: '艮', jiXiong: '大吉', zhuShi: '财富、置业、添丁' },
  '九紫': { wuxing: '火', gua: '离', jiXiong: '吉', zhuShi: '喜庆、姻缘、名声' },
};

// 飞星顺序（洛书逆行）：5→6→7→8→9→1→2→3→4
const FEI_XING_ORDER = [5, 6, 7, 8, 9, 1, 2, 3, 4];

// 九宫位置（中、北、西南、东、东南、西北、西、东北、南）
const JIU_GONG = [5, 1, 2, 3, 4, 6, 7, 8, 9];
const GONG_NAME: Record<number, string> = {
  1: '坎（正北）', 2: '坤（西南）', 3: '震（正东）', 4: '巽（东南）',
  5: '中宫', 6: '乾（西北）', 7: '兑（正西）', 8: '艮（东北）', 9: '离（正南）',
};

// 三元九运
const SAN_YUAN_JIU_YUN: Record<number, { startYear: number; endYear: number; yunName: string }> = {
  1: { startYear: 1864, endYear: 1883, yunName: '一运' },
  2: { startYear: 1884, endYear: 1903, yunName: '二运' },
  3: { startYear: 1904, endYear: 1923, yunName: '三运' },
  4: { startYear: 1924, endYear: 1943, yunName: '四运' },
  5: { startYear: 1944, endYear: 1963, yunName: '五运' },
  6: { startYear: 1964, endYear: 1983, yunName: '六运' },
  7: { startYear: 1984, endYear: 2003, yunName: '七运' },
  8: { startYear: 2004, endYear: 2023, yunName: '八运' },
  9: { startYear: 2024, endYear: 2043, yunName: '九运' },
};

// ============ 八宅法 ============

const BA_ZHAI_FANG_WEI = ['正北', '西南', '正东', '东南', '西北', '正西', '东北', '正南'] as const;

// 八宅游年星
const YOU_NIAN: Record<string, Record<string, string>> = {
  '坎': { '坎': '伏位', '艮': '五鬼', '震': '天医', '巽': '生气', '离': '延年', '坤': '绝命', '兑': '祸害', '乾': '六煞' },
  '离': { '坎': '延年', '艮': '六煞', '震': '生气', '巽': '天医', '离': '伏位', '坤': '祸害', '兑': '绝命', '乾': '五鬼' },
  '震': { '坎': '天医', '艮': '六煞', '震': '伏位', '巽': '延年', '离': '生气', '坤': '祸害', '兑': '绝命', '乾': '五鬼' },
  '巽': { '坎': '生气', '艮': '祸害', '震': '延年', '巽': '伏位', '离': '天医', '坤': '五鬼', '兑': '六煞', '乾': '绝命' },
  '乾': { '坎': '六煞', '艮': '天医', '震': '五鬼', '巽': '祸害', '离': '绝命', '坤': '延年', '兑': '生气', '乾': '伏位' },
  '坤': { '坎': '绝命', '艮': '生气', '震': '祸害', '巽': '五鬼', '离': '六煞', '坤': '伏位', '兑': '天医', '乾': '延年' },
  '兑': { '坎': '祸害', '艮': '延年', '震': '绝命', '巽': '六煞', '离': '五鬼', '坤': '天医', '兑': '伏位', '乾': '生气' },
  '艮': { '坎': '五鬼', '艮': '伏位', '震': '六煞', '巽': '祸害', '离': '六煞', '坤': '生气', '兑': '延年', '乾': '天医' },
};

// 游年星吉凶
const YOUNIAN_JI_XIONG: Record<string, { jiXiong: string; hanYi: string }> = {
  '生气': { jiXiong: '大吉', hanYi: '旺丁旺财、事业顺遂' },
  '天医': { jiXiong: '大吉', hanYi: '祛病延年、健康长寿' },
  '延年': { jiXiong: '大吉', hanYi: '长寿和睦、婚姻美满' },
  '伏位': { jiXiong: '吉', hanYi: '平稳安泰、无大起大落' },
  '祸害': { jiXiong: '凶', hanYi: '口舌是非、小病小灾' },
  '六煞': { jiXiong: '凶', hanYi: '桃花纠纷、感情波折' },
  '五鬼': { jiXiong: '大凶', hanYi: '火灾盗贼、官非口舌' },
  '绝命': { jiXiong: '大凶', hanYi: '破财损丁、绝嗣之兆' },
};

// 命卦推算
function getMingGua(birthYear: number, gender: '男' | '女'): string {
  // 命卦数计算：100-年后两位→相加至个位
  const lastTwo = birthYear % 100;
  let sum = lastTwo;
  while (sum >= 10) sum = Math.floor(sum / 10) + (sum % 10);
  
  let guaNum: number;
  if (gender === '男') {
    guaNum = (10 - sum) % 9 || 9;
  } else {
    guaNum = (sum + 5) % 9 || 9;
  }
  
  // 2000年后修正
  if (birthYear >= 2000) {
    if (gender === '男') guaNum = (9 - sum) % 9 || 9;
    else guaNum = (sum + 6) % 9 || 9;
  }
  
  const numGua: Record<number, string> = {
    1: '坎', 2: '坤', 3: '震', 4: '巽', 5: gender === '男' ? '坤' : '艮',
    6: '乾', 7: '兑', 8: '艮', 9: '离',
  };
  return numGua[guaNum] || '坎';
}

// ============ 排盘接口 ============

export interface FeiXingGong {
  gongShu: number;          // 宫数
  gongName: string;         // 宫名
  shanXing: string;         // 山星
  xiangXing: string;        // 向星
  yunXing: string;          // 运星（当令星）
  shanWuXing: string;       // 山星五行
  xiangWuXing: string;      // 向星五行
  shanJiXiong: string;      // 山星吉凶
  xiangJiXiong: string;     // 向星吉凶
  shanZhuShi: string;       // 山星主事
  xiangZhuShi: string;      // 向星主事
}

export interface BaZhaiFang {
  fangWei: string;          // 方位
  guaMing: string;          // 卦名
  youNianXing: string;      // 游年星
  jiXiong: string;          // 吉凶
  hanYi: string;            // 含义
  yiZuo: string;            // 宜
  jiZuo: string;            // 忌
}

export interface FengShuiPaiPan {
  buildYear: number;         // 建造年份
  yunShu: number;            // 运数
  yunName: string;           // 运名
  shan: string;              // 坐山
  xiang: string;             // 朝向
  shanXiangGua: string;      // 山向卦
  mingGua: string;           // 命卦
  mingGuaType: string;       // 命卦类型（东四命/西四命）
  feiXingGongs: FeiXingGong[]; // 飞星九宫
  baZhaiFangs: BaZhaiFang[];   // 八宅八方
  zongPing: string;          // 综合评价
  jianYi: string[];          // 建议
}

// ============ 排盘函数 ============

export function paiPan(
  buildYear: number,
  shan: string = '坎',
  xiang: string = '离',
  birthYear: number = 1990,
  gender: '男' | '女' = '男'
): FengShuiPaiPan {
  // 运数
  let yunShu = 8;
  for (let i = 1; i <= 9; i++) {
    const yun = SAN_YUAN_JIU_YUN[i];
    if (yun && buildYear >= yun.startYear && buildYear <= yun.endYear) {
      yunShu = i;
      break;
    }
  }
  const yunName = SAN_YUAN_JIU_YUN[yunShu]?.yunName || '八运';
  
  // 命卦
  const mingGua = getMingGua(birthYear, gender);
  const dongSi = ['坎', '离', '震', '巽'].includes(mingGua);
  const mingGuaType = dongSi ? '东四命' : '西四命';
  
  // 飞星排盘
  const feiXingGongs = buildFeiXing(yunShu, shan, xiang);
  
  // 八宅法
  const baZhaiFangs = buildBaZhai(mingGua);
  
  // 综合评价
  const zongPing = evaluateZong(feiXingGongs, baZhaiFangs);
  const jianYi = generateJianYi(feiXingGongs, baZhaiFangs, mingGuaType);
  
  return {
    buildYear, yunShu, yunName,
    shan, xiang, shanXiangGua: shan + '山' + xiang + '向',
    mingGua, mingGuaType,
    feiXingGongs, baZhaiFangs,
    zongPing, jianYi,
  };
}

function buildFeiXing(yunShu: number, shan: string, xiang: string): FeiXingGong[] {
  const gongs: FeiXingGong[] = [];
  
  // 运星飞布（以运数入中宫顺飞）
  const yunFei = feiBu(yunShu);
  
  // 山星（坐山对应运星入中，逆飞）
  const shanGong = getGuaGong(shan);
  const shanYunXing = yunFei[shanGong] || yunShu;
  const shanFei = feiBuReverse(shanYunXing);
  
  // 向星（朝向对应运星入中，顺飞）
  const xiangGong = getGuaGong(xiang);
  const xiangYunXing = yunFei[xiangGong] || yunShu;
  const xiangFei = feiBu(xiangYunXing);
  
  for (const gongShu of JIU_GONG) {
    const shanXingNum = shanFei[gongShu] || 1;
    const xiangXingNum = xiangFei[gongShu] || 1;
    const shanXing = JIU_XING_FEI[shanXingNum - 1];
    const xiangXing = JIU_XING_FEI[xiangXingNum - 1];
    const shanInfo = JIU_XING_HAN_YI[shanXing];
    const xiangInfo = JIU_XING_HAN_YI[xiangXing];
    
    gongs.push({
      gongShu,
      gongName: GONG_NAME[gongShu] || `宫${gongShu}`,
      shanXing, xiangXing,
      yunXing: JIU_XING_FEI[(yunFei[gongShu] || 1) - 1],
      shanWuXing: shanInfo?.wuxing || '土',
      xiangWuXing: xiangInfo?.wuxing || '土',
      shanJiXiong: shanInfo?.jiXiong || '中平',
      xiangJiXiong: xiangInfo?.jiXiong || '中平',
      shanZhuShi: shanInfo?.zhuShi || '',
      xiangZhuShi: xiangInfo?.zhuShi || '',
    });
  }
  
  return gongs;
}

function feiBu(zhongGong: number): Record<number, number> {
  // 顺飞：入中宫后按洛书轨迹飞布
  const result: Record<number, number> = {};
  const order = FEI_XING_ORDER;
  const startIdx = order.indexOf(zhongGong);
  for (let i = 0; i < 9; i++) {
    const xingNum = order[(startIdx + i) % 9];
    result[JIU_GONG[i]] = xingNum;
  }
  return result;
}

function feiBuReverse(zhongGong: number): Record<number, number> {
  // 逆飞
  const result: Record<number, number> = {};
  const order = FEI_XING_ORDER;
  const startIdx = order.indexOf(zhongGong);
  for (let i = 0; i < 9; i++) {
    const xingNum = order[(startIdx - i + 9) % 9];
    result[JIU_GONG[i]] = xingNum;
  }
  return result;
}

function getGuaGong(gua: string): number {
  const map: Record<string, number> = {
    '坎': 1, '坤': 2, '震': 3, '巽': 4, '中': 5, '乾': 6, '兑': 7, '艮': 8, '离': 9,
  };
  return map[gua] || 1;
}

function buildBaZhai(mingGua: string): BaZhaiFang[] {
  const fangs: BaZhaiFang[] = [];
  const guaFang: Record<string, string> = {
    '坎': '正北', '坤': '西南', '震': '正东', '巽': '东南',
    '乾': '西北', '兑': '正西', '艮': '东北', '离': '正南',
  };
  const youNianMap = YOU_NIAN[mingGua] || {};
  
  for (const [gua, fangWei] of Object.entries(guaFang)) {
    const youNianXing = youNianMap[gua] || '伏位';
    const info = YOUNIAN_JI_XIONG[youNianXing];
    const isJi = info?.jiXiong.includes('吉') || false;
    
    fangs.push({
      fangWei, guaMing: gua, youNianXing,
      jiXiong: info?.jiXiong || '中平',
      hanYi: info?.hanYi || '',
      yiZuo: isJi ? '宜居住、开门、安床' : '宜安厕、放水',
      jiZuo: isJi ? '' : '忌开门、安床、作灶',
    });
  }
  
  return fangs;
}

function evaluateZong(feiXing: FeiXingGong[], baZhai: BaZhaiFang[]): string {
  const jiXing = feiXing.filter(f => f.shanJiXiong.includes('吉') && f.xiangJiXiong.includes('吉')).length;
  const xiongXing = feiXing.filter(f => f.shanJiXiong.includes('凶') || f.xiangJiXiong.includes('凶')).length;
  const jiFang = baZhai.filter(b => b.jiXiong.includes('吉')).length;
  
  if (jiXing >= 4 && jiFang >= 4) return '风水上佳，丁财两旺';
  if (jiXing >= 3 && jiFang >= 3) return '风水良好，宜居';
  if (xiongXing >= 4) return '风水欠佳，需化解';
  return '风水中等，吉凶参半';
}

function generateJianYi(feiXing: FeiXingGong[], baZhai: BaZhaiFang[], mingGuaType: string): string[] {
  const points: string[] = [];
  
  // 五黄煞
  const wuHuang = feiXing.find(f => f.shanXing === '五黄' || f.xiangXing === '五黄');
  if (wuHuang) {
    points.push(`⚠ ${wuHuang.gongName}有五黄煞，不宜动土、装修，宜挂铜钱化解`);
  }
  
  // 二黑病符
  const erHei = feiXing.find(f => f.shanXing === '二黑' || f.xiangXing === '二黑');
  if (erHei) {
    points.push(`${erHei.gongName}有二黑病符，不宜作卧室，宜挂铜葫芦化解`);
  }
  
  // 八白旺星
  const baBai = feiXing.find(f => f.shanXing === '八白' || f.xiangXing === '八白');
  if (baBai) {
    points.push(`✓ ${baBai.gongName}有八白旺星，宜作卧室或办公室，利财运`);
  }
  
  // 四绿文昌
  const siLv = feiXing.find(f => f.shanXing === '四绿' || f.xiangXing === '四绿');
  if (siLv) {
    points.push(`✓ ${siLv.gongName}有四绿文昌，宜作书房，利学业功名`);
  }
  
  // 命卦配宅
  if (mingGuaType === '东四命') {
    points.push('东四命宜住东四宅（坎离震巽坐向），门开生气/天医/延年方');
  } else {
    points.push('西四命宜住西四宅（乾坤兑艮坐向），门开生气/天医/延年方');
  }
  
  return points.length > 0 ? points : ['风水平稳，无大碍'];
}

// ============ 格式化输出 ============

export function formatFengShuiPaiPan(paiPan: FengShuiPaiPan): string {
  const lines: string[] = [];
  lines.push(`=== 风水排盘 ===`);
  lines.push(`建造年份：${paiPan.buildYear}年（${paiPan.yunName}）`);
  lines.push(`坐山朝向：${paiPan.shanXiangGua}`);
  lines.push(`命卦：${paiPan.mingGua}（${paiPan.mingGuaType}）`);
  lines.push('');
  
  lines.push('--- 玄空飞星 ---');
  for (const gong of paiPan.feiXingGongs) {
    lines.push(`${gong.gongName}：山${gong.shanXing}(${gong.shanJiXiong}) 向${gong.xiangXing}(${gong.xiangJiXiong}) 运${gong.yunXing}`);
  }
  lines.push('');
  
  lines.push('--- 八宅法 ---');
  for (const fang of paiPan.baZhaiFangs) {
    lines.push(`${fang.fangWei}（${fang.guaMing}）：${fang.youNianXing}（${fang.jiXiong}）${fang.hanYi}`);
    lines.push(`  宜：${fang.yiZuo}  忌：${fang.jiZuo}`);
  }
  lines.push('');
  
  lines.push('--- 综合评价 ---');
  lines.push(paiPan.zongPing);
  lines.push('');
  lines.push('--- 建议 ---');
  for (const j of paiPan.jianYi) {
    lines.push(`• ${j}`);
  }
  
  return lines.join('\n');
}
