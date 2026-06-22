/**
 * 大六壬排盘算法
 * 依据：《大六壬大全》《六壬指南》
 * 
 * 核心：以日辰天盘地盘排四课三传，配合天将神煞断事
 */

// ============ 基础常量 ============

const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const DI_ZHI: string[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 十二天将
const TIAN_JIANG = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'] as const;

// 天将吉凶
const JIANG_JI_XIONG: Record<string, string> = {
  '贵人': '大吉', '螣蛇': '凶', '朱雀': '凶', '六合': '吉',
  '勾陈': '凶', '青龙': '大吉', '天空': '凶', '白虎': '大凶',
  '太常': '吉', '玄武': '凶', '太阴': '吉', '天后': '吉',
};

// 天将含义
const JIANG_HAN_YI: Record<string, string> = {
  '贵人': '主贵人提携、官长、尊长', '螣蛇': '主虚惊怪异、缠绕', '朱雀': '主口舌是非、文书',
  '六合': '主和合婚姻、成交', '勾陈': '主田土争讼、迟滞', '青龙': '主喜庆财富、升迁',
  '天空': '主欺诈虚空、奴仆', '白虎': '主血光丧服、道路', '太常': '主衣食官禄、平稳',
  '玄武': '主盗贼暗昧、小人', '太阴': '主暗财隐私、女人', '天后': '主婚姻女事、阴私',
};

// 地支五行
const ZHI_WUXING: Record<string, string> = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火',
  '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水',
};

// 地支方位
const ZHI_FANGWEI: Record<string, string> = {
  '子': '正北', '丑': '东北', '寅': '东北', '卯': '正东', '辰': '东南', '巳': '东南',
  '午': '正南', '未': '西南', '申': '西南', '酉': '正西', '戌': '西北', '亥': '西北',
};

// 十二长生（以日干五行论）
const CHANG_SHENG: Record<string, string[]> = {
  '木': ['亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌'], // 长生在亥
  '火': ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'], // 长生在寅
  '金': ['巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰'], // 长生在巳
  '水': ['申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未'], // 长生在申
};
const CHANG_SHENG_NAME = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];

// 五行生克
const SHENG: Record<string, string> = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
const KE: Record<string, string> = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };

// ============ 排盘接口 ============

export interface LiuRenKe {
  keMing: string;       // 课名（第一课/第二课/第三课/第四课）
  tianPan: string;      // 天盘地支
  diPan: string;        // 地盘地支
  tianWuXing: string;   // 天盘五行
  diWuXing: string;     // 地盘五行
  relation: string;     // 天地盘生克关系
  tianJiang: string;    // 天将
  jiangJiXiong: string; // 天将吉凶
  jiangHanYi: string;   // 天将含义
}

export interface LiuRenChuan {
  chuanMing: string;    // 传名（初传/中传/末传）
  zhi: string;          // 地支
  wuXing: string;       // 五行
  tianJiang: string;    // 天将
  changSheng: string;   // 十二长生
  fangWei: string;      // 方位
}

export interface LiuRenPaiPan {
  riChen: string;        // 日辰（干支）
  riGan: string;         // 日干
  riZhi: string;         // 日支
  riWuXing: string;      // 日干五行
  tianPanDiZhi: string[];  // 天盘十二地支排列
  siKe: LiuRenKe[];      // 四课
  sanChuan: LiuRenChuan[]; // 三传
  keLei: string;         // 课体类型
  keTiYaoDian: string;   // 课体要点
  duanYuYaoDian: string[]; // 断语要点
}

// ============ 排盘函数 ============

/** 大六壬排盘 */
export function paiPan(
  year: number, month: number, day: number, hour: number,
  riGan: string = '甲', riZhi: string = '子'
): LiuRenPaiPan {
  // 天盘地支排列（根据时辰旋转地盘）
  const hourIdx = DI_ZHI.indexOf(riZhi) >= 0 ? DI_ZHI.indexOf(riZhi) : 0;
  const tianPanDiZhi = [...DI_ZHI];
  // 天盘=地盘按时辰旋转
  const rotatedTianPan: string[] = [];
  for (let i = 0; i < 12; i++) {
    rotatedTianPan[i] = DI_ZHI[(i + hourIdx) % 12];
  }
  
  // 日干五行
  const riWuXing = getGanWuXing(riGan);
  
  // 排四课
  const siKe = buildSiKe(riGan, riZhi, rotatedTianPan);
  
  // 排三传
  const sanChuan = buildSanChuan(siKe, riGan, riZhi, riWuXing);
  
  // 课体
  const keLei = panKeLei(siKe, sanChuan);
  const keTiYaoDian = getKeTiYaoDian(keLei);
  
  // 断语
  const duanYuYaoDian = generateDuanYu(siKe, sanChuan, riWuXing);
  
  return {
    riChen: riGan + riZhi,
    riGan, riZhi, riWuXing,
    tianPanDiZhi: rotatedTianPan,
    siKe, sanChuan,
    keLei, keTiYaoDian, duanYuYaoDian,
  };
}

function getGanWuXing(gan: string): string {
  const map: Record<string, string> = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
    '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水',
  };
  return map[gan] || '木';
}

function buildSiKe(riGan: string, riZhi: string, tianPan: string[]): LiuRenKe[] {
  const ke: LiuRenKe[] = [];
  
  // 第一课：日干上神（日干寄宫的天盘地支）
  const ganGong = getGanJiGong(riGan);
  const diPanArr = [...DI_ZHI];
  const ganGongIdx = diPanArr.indexOf(ganGong);
  const ke1Tian = tianPan[ganGongIdx] || ganGong;
  ke.push(buildOneKe('第一课', ke1Tian, ganGong));
  
  // 第二课：第一课上神的天盘
  const ke1Idx = diPanArr.indexOf(ke1Tian);
  const ke2Tian = tianPan[ke1Idx] || ke1Tian;
  ke.push(buildOneKe('第二课', ke2Tian, ke1Tian));
  
  // 第三课：日支上神
  const zhiIdx = diPanArr.indexOf(riZhi);
  const ke3Tian = tianPan[zhiIdx] || riZhi;
  ke.push(buildOneKe('第三课', ke3Tian, riZhi));
  
  // 第四课：第三课上神的天盘
  const ke3Idx = diPanArr.indexOf(ke3Tian);
  const ke4Tian = tianPan[ke3Idx] || ke3Tian;
  ke.push(buildOneKe('第四课', ke4Tian, ke3Tian));
  
  return ke;
}

function buildOneKe(keMing: string, tianPan: string, diPan: string): LiuRenKe {
  const tianWx = ZHI_WUXING[tianPan] || '土';
  const diWx = ZHI_WUXING[diPan] || '土';
  let relation = '比和';
  if (SHENG[tianWx] === diWx) relation = '上生下';
  else if (SHENG[diWx] === tianWx) relation = '下生上';
  else if (KE[tianWx] === diWx) relation = '上克下';
  else if (KE[diWx] === tianWx) relation = '下克上';
  
  // 天将（简化：按上神位置排列）
  const tianIdx = DI_ZHI.indexOf(tianPan);
  const jiangIdx = tianIdx >= 0 ? tianIdx % 12 : 0;
  const tianJiang = TIAN_JIANG[jiangIdx];
  
  return {
    keMing, tianPan, diPan, tianWuXing: tianWx, diWuXing: diWx,
    relation,
    tianJiang,
    jiangJiXiong: JIANG_JI_XIONG[tianJiang] || '中平',
    jiangHanYi: JIANG_HAN_YI[tianJiang] || '',
  };
}

function getGanJiGong(gan: string): string {
  // 日干寄宫：甲寄寅、乙寄辰、丙戊寄巳、丁己寄未、庚寄申、辛寄戌、壬寄亥、癸寄丑
  const map: Record<string, string> = {
    '甲': '寅', '乙': '辰', '丙': '巳', '丁': '未', '戊': '巳',
    '己': '未', '庚': '申', '辛': '戌', '壬': '亥', '癸': '丑',
  };
  return map[gan] || '寅';
}

function buildSanChuan(siKe: LiuRenKe[], riGan: string, riZhi: string, riWuXing: string): LiuRenChuan[] {
  // 简化：取四课中上克下或下克上者为初传
  let chuanZhi: string[] = [];
  
  // 寻找克（上克下优先）
  for (const ke of siKe) {
    if (ke.relation === '上克下' || ke.relation === '下克上') {
      chuanZhi.push(ke.tianPan);
      break;
    }
  }
  
  // 如果没有克，取日干上神
  if (chuanZhi.length === 0) {
    chuanZhi.push(siKe[0].tianPan);
  }
  
  // 中传：初传的地盘
  const chuIdx = DI_ZHI.indexOf(chuanZhi[0]);
  chuanZhi.push(DI_ZHI[chuIdx >= 0 ? chuIdx : 0]);
  
  // 末传：中传的地盘
  const zhongIdx = DI_ZHI.indexOf(chuanZhi[1]);
  chuanZhi.push(DI_ZHI[zhongIdx >= 0 ? zhongIdx : 0]);
  
  const names = ['初传', '中传', '末传'];
  return chuanZhi.map((zhi, i) => {
    const wx = ZHI_WUXING[zhi] || '土';
    const cs = getChangSheng(riWuXing, zhi);
    return {
      chuanMing: names[i],
      zhi,
      wuXing: wx,
      tianJiang: TIAN_JIANG[DI_ZHI.indexOf(zhi) % 12],
      changSheng: cs,
      fangWei: ZHI_FANGWEI[zhi] || '中',
    };
  });
}

function getChangSheng(riWuXing: string, zhi: string): string {
  const arr = CHANG_SHENG[riWuXing];
  if (!arr) return '长生';
  const idx = arr.indexOf(zhi);
  return idx >= 0 ? CHANG_SHENG_NAME[idx] : '长生';
}

function panKeLei(siKe: LiuRenKe[], sanChuan: LiuRenChuan[]): string {
  // 课体类型判断（简化）
  const hasKe = siKe.some(k => k.relation.includes('克'));
  if (!hasKe) return '昂星课';
  
  const allShangKe = siKe.every(k => k.relation === '上克下');
  if (allShangKe) return '元首课';
  
  const hasXiaKe = siKe.some(k => k.relation === '下克上');
  if (hasXiaKe) return '重审课';
  
  return '涉害课';
}

function getKeTiYaoDian(keLei: string): string {
  const map: Record<string, string> = {
    '元首课': '上克下为元首，主尊制卑、上命下，凡事顺利',
    '重审课': '下克上为重审，主卑犯尊、下逆上，须审慎',
    '涉害课': '克多则涉害，主事情复杂，需深入审查',
    '昂星课': '无克取昂星，主虚惊不实，待机而动',
  };
  return map[keLei] || '课体平稳';
}

function generateDuanYu(siKe: LiuRenKe[], sanChuan: LiuRenChuan[], riWuXing: string): string[] {
  const points: string[] = [];
  
  // 初传论事始
  const chuChuan = sanChuan[0];
  if (chuChuan) {
    points.push(`初传${chuChuan.zhi}（${chuChuan.wuXing}·${chuChuan.changSheng}）：事之初，${chuChuan.tianJiang}临，${JIANG_HAN_YI[chuChuan.tianJiang] || ''}`);
  }
  
  // 中传论事中
  const zhongChuan = sanChuan[1];
  if (zhongChuan) {
    points.push(`中传${zhongChuan.zhi}（${zhongChuan.wuXing}·${zhongChuan.changSheng}）：事之中，发展${zhongChuan.changSheng === '帝旺' || zhongChuan.changSheng === '临官' ? '顺利' : '波折'}`);
  }
  
  // 末传论事终
  const moChuan = sanChuan[2];
  if (moChuan) {
    const jieGuo = moChuan.changSheng === '长生' || moChuan.changSheng === '帝旺' || moChuan.changSheng === '临官' ? '结局良好' : '结局需防';
    points.push(`末传${moChuan.zhi}（${moChuan.wuXing}·${moChuan.changSheng}）：事之终，${jieGuo}`);
  }
  
  // 天将吉凶
  const jiJiang = sanChuan.filter(c => JIANG_JI_XIONG[c.tianJiang]?.includes('吉'));
  const xiongJiang = sanChuan.filter(c => JIANG_JI_XIONG[c.tianJiang]?.includes('凶'));
  if (jiJiang.length > xiongJiang.length) {
    points.push('三传天将吉多于凶，总体趋吉');
  } else if (xiongJiang.length > jiJiang.length) {
    points.push('三传天将凶多于吉，须防不利');
  }
  
  return points;
}

// ============ 格式化输出 ============

export function formatLiuRenPaiPan(paiPan: LiuRenPaiPan): string {
  const lines: string[] = [];
  lines.push(`=== 大六壬排盘 ===`);
  lines.push(`日辰：${paiPan.riChen}（${paiPan.riWuXing}行）`);
  lines.push(`课体：${paiPan.keLei}`);
  lines.push(`课体要点：${paiPan.keTiYaoDian}`);
  lines.push('');
  
  lines.push('--- 四课 ---');
  for (const ke of paiPan.siKe) {
    lines.push(`${ke.keMing}：${ke.tianPan}（${ke.tianWuXing}）→${ke.diPan}（${ke.diWuXing}） ${ke.relation} | ${ke.tianJiang}（${ke.jiangJiXiong}）${ke.jiangHanYi}`);
  }
  lines.push('');
  
  lines.push('--- 三传 ---');
  for (const chuan of paiPan.sanChuan) {
    lines.push(`${chuan.chuanMing}：${chuan.zhi}（${chuan.wuXing}·${chuan.changSheng}·${chuan.fangWei}）天将：${chuan.tianJiang}`);
  }
  lines.push('');
  
  lines.push('--- 断语要点 ---');
  for (const p of paiPan.duanYuYaoDian) {
    lines.push(`• ${p}`);
  }
  
  return lines.join('\n');
}

// ============ 大六壬理论 ============

export const LIU_REN_LILUN = `
【大六壬核心理论（《大六壬大全》）】
1. 六壬以日辰为主，排四课三传
2. 四课：日干上神（第一课）、上神之上（第二课）、日支上神（第三课）、上神之上（第四课）
3. 三传：初传论事始、中传论事中、末传论事终
4. 课体：元首课（上克下）主尊制卑、重审课（下克上）主卑犯尊、涉害课主复杂
5. 天将十二：贵人、螣蛇、朱雀、六合、勾陈、青龙、天空、白虎、太常、玄武、太阴、天后
6. 断事看三传天将组合，吉将多则吉、凶将多则凶
7. 日干为求测者，日支为对方/事情
`.trim();
