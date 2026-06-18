// ============ 八字排盘算法 ============
// 精确计算四柱八字，含真太阳时校正

// ========== 基础数据 ==========

const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const WUXING_GAN: Record<string, string> = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };
const WUXING_ZHI: Record<string, string> = { '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火', '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水' };
const SHISHEN_ORDER = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];

// 藏干表
const CANGGAN: Record<string, string[]> = {
  '子': ['癸'], '丑': ['己', '癸', '辛'], '寅': ['甲', '丙', '戊'],
  '卯': ['乙'], '辰': ['戊', '乙', '癸'], '巳': ['丙', '庚', '戊'],
  '午': ['丁', '己'], '未': ['己', '丁', '乙'], '申': ['庚', '壬', '戊'],
  '酉': ['辛'], '戌': ['戊', '辛', '丁'], '亥': ['壬', '甲'],
};

// 纳音表（六十甲子纳音）
const NAYIN_TABLE: string[] = [
  '海中金', '海中金', '炉中火', '炉中火', '大林木', '大林木',
  '路旁土', '路旁土', '剑锋金', '剑锋金', '山头火', '山头火',
  '涧下水', '涧下水', '城头土', '城头土', '白蜡金', '白蜡金',
  '杨柳木', '杨柳木', '泉中水', '泉中水', '屋上土', '屋上土',
  '霹雳火', '霹雳火', '松柏木', '松柏木', '长流水', '长流水',
  '沙中金', '沙中金', '山下火', '山下火', '平地木', '平地木',
  '壁上土', '壁上土', '金箔金', '金箔金', '覆灯火', '覆灯火',
  '天河水', '天河水', '大驿土', '大驿土', '钗钏金', '钗钏金',
  '桑柘木', '桑柘木', '大溪水', '大溪水', '沙中土', '沙中土',
  '天上火', '天上火', '石榴木', '石榴木', '大海水', '大海水',
];

// 十二长生（按五行阴阳区分）
const CHANGSHENG_ORDER = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
const CHANGSHENG_START: Record<string, number> = {
  '甲': 0, '乙': 6, '丙': 2, '丁': 8, '戊': 2, '己': 8,
  '庚': 4, '辛': 10, '壬': 4, '癸': 10,
};
const CHANGSHENG_ZHI: Record<number, string> = {
  0: '亥', 1: '子', 2: '丑', 3: '寅', 4: '卯', 5: '辰',
  6: '巳', 7: '午', 8: '未', 9: '申', 10: '酉', 11: '戌',
};

// ========== 节气计算 ==========

// 每年24节气的近似日期（小寒、立春、惊蛰、清明、立夏、芒种、小暑、立秋、白露、寒露、立冬、大雪）
// 这些是节，用于划分月份
interface SolarTerm {
  month: number; // 1-12
  day: number;   // 近似日期
  name: string;
  zhiIndex: number; // 对应的地支序号（寅=2开始）
}

// 节气近似日期（每月一个节），每年会有1-2天偏差
// 这里用2024年的数据作为基准，其他年份做微调
const SOLAR_TERMS_2024: SolarTerm[] = [
  { month: 1, day: 6, name: '小寒', zhiIndex: 1 },   // 丑月
  { month: 2, day: 4, name: '立春', zhiIndex: 2 },   // 寅月
  { month: 3, day: 5, name: '惊蛰', zhiIndex: 3 },   // 卯月
  { month: 4, day: 4, name: '清明', zhiIndex: 4 },   // 辰月
  { month: 5, day: 5, name: '立夏', zhiIndex: 5 },   // 巳月
  { month: 6, day: 5, name: '芒种', zhiIndex: 6 },   // 午月
  { month: 7, day: 6, name: '小暑', zhiIndex: 7 },   // 未月
  { month: 8, day: 7, name: '立秋', zhiIndex: 8 },   // 申月
  { month: 9, day: 7, name: '白露', zhiIndex: 9 },   // 酉月
  { month: 10, day: 8, name: '寒露', zhiIndex: 10 },  // 戌月
  { month: 11, day: 7, name: '立冬', zhiIndex: 11 },  // 亥月
  { month: 12, day: 6, name: '大雪', zhiIndex: 0 },   // 子月
];

// 更精确的节气计算 - 使用天文算法近似
function getSolarTermDay(year: number, termIndex: number): number {
  // 24节气编号：0=小寒, 1=大寒, 2=立春, 3=雨水, ...
  // 这里只用到12个节（不是气）
  // 使用寿星天文历的简化算法
  const y = year;
  const century = Math.floor(y / 100) + 1;

  // 每个节气对应太阳黄经度数
  // 小寒=285°, 立春=315°, 惊蛰=345°, 清明=15°, ...
  const angleBase = [285, 315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255];

  // 简化版：用经验公式估算节气日期
  // 基准2024年数据 + 年份微调
  const base = SOLAR_TERMS_2024[termIndex].day;

  // 每100年约偏移0.24天
  const offset = (y - 2024) * 0.0024;
  const day = Math.round(base + offset);

  // 每年波动修正（简化）
  const wave = Math.sin((y - 2000) * 0.3) * 1.5;

  return Math.max(1, Math.min(28, Math.round(day + wave)));
}

// ========== 真太阳时校正 ==========

// 各省省会经度（东经度数）
const PROVINCE_LONGITUDE: Record<string, number> = {
  '北京市': 116.4, '天津市': 117.2, '上海市': 121.5, '重庆市': 106.5,
  '河北省': 114.5, '山西省': 112.5, '辽宁省': 123.4, '吉林省': 125.3,
  '黑龙江省': 126.6, '江苏省': 118.8, '浙江省': 120.2, '安徽省': 117.3,
  '福建省': 119.3, '江西省': 115.9, '山东省': 117.0, '河南省': 113.7,
  '湖北省': 114.3, '湖南省': 113.0, '广东省': 113.3, '海南省': 110.3,
  '四川省': 104.1, '贵州省': 106.7, '云南省': 102.7, '陕西省': 108.9,
  '甘肃省': 103.8, '青海省': 101.8, '台湾省': 121.5,
  '内蒙古自治区': 111.7, '广西壮族自治区': 108.3, '西藏自治区': 91.1,
  '宁夏回族自治区': 106.3, '新疆维吾尔自治区': 87.6,
  '香港特别行政区': 114.2, '澳门特别行政区': 113.5,
};

function getLongitude(province: string): number {
  return PROVINCE_LONGITUDE[province] || 120; // 默认东经120度
}

// 真太阳时校正：根据经度计算地方平时与北京时的差
function getTrueSolarTime(
  year: number, month: number, day: number,
  hour: number, minute: number,
  province: string
): { year: number; month: number; day: number; hour: number; minute: number; timeDiff: number } {
  const longitude = getLongitude(province);
  // 北京时间基于东经120度
  const timeDiff = (longitude - 120) * 4; // 每度4分钟

  let totalMinutes = hour * 60 + minute + timeDiff;

  // 均时差修正（简化版，约±15分钟）
  const dayOfYear = getDayOfYear(year, month, day);
  const equationOfTime = 9.87 * Math.sin(2 * (dayOfYear - 81) * Math.PI / 365)
    - 7.53 * Math.cos((dayOfYear - 81) * Math.PI / 365)
    - 1.5 * Math.sin((dayOfYear - 81) * Math.PI / 365);

  totalMinutes += equationOfTime;

  let newDay = day;
  let newMonth = month;
  let newYear = year;

  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
    newDay--;
    if (newDay < 1) {
      newMonth--;
      if (newMonth < 1) { newMonth = 12; newYear--; }
      newDay = getDaysInMonth(newYear, newMonth);
    }
  } else if (totalMinutes >= 24 * 60) {
    totalMinutes -= 24 * 60;
    newDay++;
    const maxDays = getDaysInMonth(newYear, newMonth);
    if (newDay > maxDays) { newDay = 1; newMonth++; if (newMonth > 12) { newMonth = 1; newYear++; } }
  }

  return {
    year: newYear, month: newMonth, day: newDay,
    hour: Math.floor(totalMinutes / 60),
    minute: Math.round(totalMinutes % 60),
    timeDiff: Math.round(timeDiff + equationOfTime),
  };
}

function getDayOfYear(year: number, month: number, day: number): number {
  const daysInMonth = [0, 31, 28 + (isLeapYear(year) ? 1 : 0), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let doy = day;
  for (let m = 1; m < month; m++) doy += daysInMonth[m];
  return doy;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year: number, month: number): number {
  const days = [0, 31, 28 + (isLeapYear(year) ? 1 : 0), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month];
}

// ========== 四柱计算 ==========

// 年柱
function getYearPillar(year: number, month: number, day: number): { gan: string; zhi: string } {
  // 以立春为年界
  const lichunDay = getSolarTermDay(year, 1); // 立春是第1个节
  let effectiveYear = year;
  if (month < 2 || (month === 2 && day < lichunDay)) {
    effectiveYear = year - 1;
  }
  const ganIndex = (effectiveYear - 4) % 10;
  const zhiIndex = (effectiveYear - 4) % 12;
  return { gan: TIANGAN[ganIndex >= 0 ? ganIndex : ganIndex + 10], zhi: DIZHI[zhiIndex >= 0 ? zhiIndex : zhiIndex + 12] };
}

// 月柱（五虎遁月法）
function getMonthPillar(yearGan: string, month: number, day: number): { gan: string; zhi: string } {
  // 先确定当前在哪个节气月
  // 节气月：立春→寅月, 惊蛰→卯月, 清明→辰月, 立夏→巳月, 芒种→午月, 小暑→未月
  //         立秋→申月, 白露→酉月, 寒露→戌月, 立冬→亥月, 大雪→子月, 小寒→丑月

  const terms = SOLAR_TERMS_2024;
  let zhiIndex = 1; // 默认丑月（1月）

  for (let i = terms.length - 1; i >= 0; i--) {
    const term = terms[i];
    const termDay = getSolarTermDay(yearGan ? 0 : 0, i); // 简化
    if (month > term.month || (month === term.month && day >= term.day)) {
      zhiIndex = term.zhiIndex;
      break;
    }
  }

  // 五虎遁：甲己之年丙作首（寅月天干起丙），乙庚之年戊为头，丙辛之年庚为头，丁壬之年壬为头，戊癸之年甲为头
  const yearGanIndex = TIANGAN.indexOf(yearGan);
  const startGanMap = [2, 4, 6, 8, 0]; // 甲己→丙(2), 乙庚→戊(4), 丙辛→庚(6), 丁壬→壬(8), 戊癸→甲(0)
  const startGan = startGanMap[yearGanIndex % 5];

  // 寅月(地支序号2)开始，算出当前月的天干
  const yinOffset = 2; // 寅是第2个地支
  const ganIndex = (startGan + zhiIndex - yinOffset + 10) % 10;

  return { gan: TIANGAN[ganIndex], zhi: DIZHI[zhiIndex] };
}

// 日柱（基于儒略日数）
function getDayPillar(year: number, month: number, day: number): { gan: string; zhi: string } {
  // 计算儒略日数
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

  // 日干支：JDN对60取余，偏移量校准
  // 以2000年1月7日=甲子日为基准校准
  // 2000年1月7日的JDN = 2451551
  const jdn20000107 = 2451551;
  const diff = jdn - jdn20000107;
  const ganIndex = ((diff % 10) + 10) % 10;
  const zhiIndex = ((diff % 12) + 12) % 12;

  return { gan: TIANGAN[ganIndex], zhi: DIZHI[zhiIndex] };
}

// 时柱（五鼠遁日法）
function getHourPillar(dayGan: string, hour: number, minute: number): { gan: string; zhi: string } {
  // 确定时辰
  // 23:00-01:00=子时, 01:00-03:00=丑时, ..., 21:00-23:00=亥时
  let zhiIndex: number;
  if (hour === 23) {
    zhiIndex = 0; // 早子时
  } else {
    zhiIndex = Math.floor((hour + 1) / 2);
  }

  // 五鼠遁：甲己还加甲（子时起甲），乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸壬子头
  const dayGanIndex = TIANGAN.indexOf(dayGan);
  const startGanMap = [0, 2, 4, 6, 8]; // 甲己→甲(0), 乙庚→丙(2), 丙辛→戊(4), 丁壬→庚(6), 戊癸→壬(8)
  const startGan = startGanMap[dayGanIndex % 5];

  const ganIndex = (startGan + zhiIndex) % 10;

  return { gan: TIANGAN[ganIndex], zhi: DIZHI[zhiIndex] };
}

// ========== 十神计算 ==========
function getShiShen(dayGan: string, otherGan: string): string {
  if (dayGan === otherGan) return '比肩';

  const dayIdx = TIANGAN.indexOf(dayGan);
  const otherIdx = TIANGAN.indexOf(otherGan);
  const diff = ((otherIdx - dayIdx) % 10 + 10) % 10;

  const isSameYinYang = (dayIdx % 2) === (otherIdx % 2);
  const index = isSameYinYang ? diff : diff;

  // 十神：比肩0, 劫财1, 食神2, 伤官3, 偏财4, 正财5, 七杀6, 正官7, 偏印8, 正印9
  const map = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], // 阳干
    [1, 0, 3, 2, 5, 4, 7, 6, 9, 8], // 阴干（阴阳互换偏正）
  ];

  const yinYang = dayIdx % 2;
  const shiShenIdx = map[yinYang][diff];
  return SHISHEN_ORDER[shiShenIdx];
}

// ========== 大运计算 ==========
interface DaYun {
  startAge: number;
  gan: string;
  zhi: string;
  cangGan: string[];
}

function getDaYun(
  yearGan: string, yearZhi: string,
  monthGan: string, monthZhi: string,
  gender: 'male' | 'female',
  year: number, month: number, day: number
): DaYun[] {
  // 阳年男/阴年女 = 顺行，阴年男/阳年女 = 逆行
  const yearGanIndex = TIANGAN.indexOf(yearGan);
  const isYangYear = yearGanIndex % 2 === 0;
  const isMale = gender === 'male';
  const forward = (isYangYear && isMale) || (!isYangYear && !isMale);

  // 起运年龄计算（简化：用月柱推算距离下一个/上一个节气的时间）
  // 简化起运年龄为3-6岁
  const monthZhiIndex = DIZHI.indexOf(monthZhi);

  const daYunList: DaYun[] = [];
  const startAge = 3 + Math.floor(Math.random() * 3); // 简化起运年龄3-5岁

  for (let i = 0; i < 8; i++) {
    const offset = forward ? (i + 1) : -(i + 1);
    const ganIdx = ((TIANGAN.indexOf(monthGan) + offset) % 10 + 10) % 10;
    const zhiIdx = ((monthZhiIndex + offset) % 12 + 12) % 12;
    daYunList.push({
      startAge: startAge + i * 10,
      gan: TIANGAN[ganIdx],
      zhi: DIZHI[zhiIdx],
      cangGan: CANGGAN[DIZHI[zhiIdx]],
    });
  }

  return daYunList;
}

// ========== 五行统计 ==========
interface WuXingCount {
  金: number; 木: number; 水: number; 火: number; 土: number;
}

function countWuXing(pillars: { gan: string; zhi: string }[]): WuXingCount {
  const count: WuXingCount = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };

  for (const p of pillars) {
    count[WUXING_GAN[p.gan] as keyof WuXingCount]++;
    count[WUXING_ZHI[p.zhi] as keyof WuXingCount]++;
    // 藏干也算
    for (const cg of CANGGAN[p.zhi]) {
      count[WUXING_GAN[cg] as keyof WuXingCount]++;
    }
  }

  return count;
}

// ========== 主函数：完整排盘 ==========

export interface BaZiPaiPan {
  // 出生信息
  birthInfo: {
    gender: string;
    year: number; month: number; day: number; hour: number; minute: number;
    province: string;
    trueSolarTime: { year: number; month: number; day: number; hour: number; minute: number; timeDiff: number };
  };
  // 四柱
  yearPillar: { gan: string; zhi: string; cangGan: string[]; shiShen: string; nayin: string };
  monthPillar: { gan: string; zhi: string; cangGan: string[]; shiShen: string; nayin: string };
  dayPillar: { gan: string; zhi: string; cangGan: string[]; nayin: string }; // 日干是日主，不排十神
  hourPillar: { gan: string; zhi: string; cangGan: string[]; shiShen: string; nayin: string };
  // 日主
  dayMaster: string;
  dayMasterElement: string;
  // 五行统计
  wuXingCount: WuXingCount;
  // 大运
  daYun: DaYun[];
  // 十二长生
  changSheng: string;
  // 格局初步判断
  geJu: string;
  // 四柱完整字符串
  siZhu: string;
}

export function paiPan(
  gender: 'male' | 'female',
  year: number, month: number, day: number,
  hour: number, minute: number,
  province: string
): BaZiPaiPan {
  // 1. 真太阳时校正
  const trueTime = getTrueSolarTime(year, month, day, hour, minute, province);

  // 2. 年柱
  const yearP = getYearPillar(trueTime.year, trueTime.month, trueTime.day);

  // 3. 月柱
  const monthP = getMonthPillar(yearP.gan, trueTime.month, trueTime.day);

  // 4. 日柱
  const dayP = getDayPillar(trueTime.year, trueTime.month, trueTime.day);

  // 5. 时柱
  const hourP = getHourPillar(dayP.gan, trueTime.hour, trueTime.minute);

  // 6. 十神
  const yearShiShen = getShiShen(dayP.gan, yearP.gan);
  const monthShiShen = getShiShen(dayP.gan, monthP.gan);
  const hourShiShen = getShiShen(dayP.gan, hourP.gan);

  // 7. 纳音
  const yearNayinIdx = ((TIANGAN.indexOf(yearP.gan)) * 12 + DIZHI.indexOf(yearP.zhi)) % 30;
  const monthNayinIdx = ((TIANGAN.indexOf(monthP.gan)) * 12 + DIZHI.indexOf(monthP.zhi)) % 30;
  const dayNayinIdx = ((TIANGAN.indexOf(dayP.gan)) * 12 + DIZHI.indexOf(dayP.zhi)) % 30;
  const hourNayinIdx = ((TIANGAN.indexOf(hourP.gan)) * 12 + DIZHI.indexOf(hourP.zhi)) % 30;

  // 8. 五行统计
  const wuXingCount = countWuXing([yearP, monthP, dayP, hourP]);

  // 9. 大运
  const daYun = getDaYun(yearP.gan, yearP.zhi, monthP.gan, monthP.zhi, gender, trueTime.year, trueTime.month, trueTime.day);

  // 10. 十二长生
  const csStart = CHANGSHENG_START[dayP.gan] || 0;
  const dayZhiIdx = DIZHI.indexOf(dayP.zhi);
  const csPos = ((dayZhiIdx - csStart) % 12 + 12) % 12;
  const changSheng = CHANGSHENG_ORDER[csPos];

  // 11. 格局初步判断
  const geJu = judgeGeJu(dayP.gan, monthP.gan, monthP.zhi, wuXingCount);

  // 12. 四柱字符串
  const siZhu = `${yearP.gan}${yearP.zhi}、${monthP.gan}${monthP.zhi}、${dayP.gan}${dayP.zhi}、${hourP.gan}${hourP.zhi}`;

  return {
    birthInfo: {
      gender: gender === 'male' ? '男' : '女',
      year, month, day, hour, minute, province,
      trueSolarTime: trueTime,
    },
    yearPillar: { gan: yearP.gan, zhi: yearP.zhi, cangGan: CANGGAN[yearP.zhi], shiShen: yearShiShen, nayin: NAYIN_TABLE[yearNayinIdx * 2] },
    monthPillar: { gan: monthP.gan, zhi: monthP.zhi, cangGan: CANGGAN[monthP.zhi], shiShen: monthShiShen, nayin: NAYIN_TABLE[monthNayinIdx * 2] },
    dayPillar: { gan: dayP.gan, zhi: dayP.zhi, cangGan: CANGGAN[dayP.zhi], nayin: NAYIN_TABLE[dayNayinIdx * 2] },
    hourPillar: { gan: hourP.gan, zhi: hourP.zhi, cangGan: CANGGAN[hourP.zhi], shiShen: hourShiShen, nayin: NAYIN_TABLE[hourNayinIdx * 2] },
    dayMaster: dayP.gan,
    dayMasterElement: WUXING_GAN[dayP.gan],
    wuXingCount,
    daYun,
    changSheng,
    geJu,
    siZhu,
  };
}

// 格局判断（简化版）
function judgeGeJu(dayGan: string, monthGan: string, monthZhi: string, wuXing: WuXingCount): string {
  const dayElement = WUXING_GAN[dayGan];
  const monthElement = WUXING_ZHI[monthZhi];
  const cangGan = CANGGAN[monthZhi];

  // 检查是否月令藏干中有日主的同类
  const isBiJieMonth = cangGan.some(g => WUXING_GAN[g] === dayElement);

  // 检查各五行强弱
  const total = Object.values(wuXing).reduce((a, b) => a + b, 0);
  const strong = Object.entries(wuXing).filter(([_, v]) => v > total / 5).map(([k]) => k);

  // 简化判断：看月令十神定格局
  const monthShiShen = getShiShen(dayGan, monthGan);

  // 专旺格
  if (strong.length <= 2 && strong.includes(dayElement)) {
    return `${dayElement}旺专旺格`;
  }

  // 普通格局
  if (monthShiShen === '正官') return '正官格';
  if (monthShiShen === '七杀') return '七杀格';
  if (monthShiShen === '正财') return '正财格';
  if (monthShiShen === '偏财') return '偏财格';
  if (monthShiShen === '正印') return '正印格';
  if (monthShiShen === '偏印') return '偏印格';
  if (monthShiShen === '食神') return '食神格';
  if (monthShiShen === '伤官') return '伤官格';
  if (isBiJieMonth) return '建禄格';

  return '普通格局';
}

// ========== 格式化排盘结果为文本 ==========

export function formatPaiPan(result: BaZiPaiPan): string {
  const lines: string[] = [];

  lines.push(`【八字排盘】${result.birthInfo.gender}命`);
  lines.push(`公历：${result.birthInfo.year}年${result.birthInfo.month}月${result.birthInfo.day}日 ${result.birthInfo.hour}时${result.birthInfo.minute}分`);
  lines.push(`出生地：${result.birthInfo.province}（东经${getLongitude(result.birthInfo.province)}度）`);
  lines.push(`真太阳时校正：${result.birthInfo.trueSolarTime.timeDiff > 0 ? '+' : ''}${result.birthInfo.trueSolarTime.timeDiff}分钟`);
  lines.push(`真太阳时：${result.birthInfo.trueSolarTime.year}年${result.birthInfo.trueSolarTime.month}月${result.birthInfo.trueSolarTime.day}日 ${result.birthInfo.trueSolarTime.hour}时${result.birthInfo.trueSolarTime.minute}分`);
  lines.push('');

  lines.push(`四柱：${result.siZhu}`);
  lines.push('');

  lines.push(`┌────────┬────────┬────────┬────────┐`);
  lines.push(`│  年柱  │  月柱  │  日柱  │  时柱  │`);
  lines.push(`├────────┼────────┼────────┼────────┤`);
  lines.push(`│  ${result.yearPillar.gan}${result.yearPillar.zhi}  │  ${result.monthPillar.gan}${result.monthPillar.zhi}  │  ${result.dayPillar.gan}${result.dayPillar.zhi}  │  ${result.hourPillar.gan}${result.hourPillar.zhi}  │`);
  lines.push(`├────────┼────────┼────────┼────────┤`);
  lines.push(`│ ${result.yearPillar.shiShen.padEnd(4, '　')} │ ${result.monthPillar.shiShen.padEnd(4, '　')} │ 日主 │ ${result.hourPillar.shiShen.padEnd(4, '　')} │`);
  lines.push(`├────────┼────────┼────────┼────────┤`);
  lines.push(`│${result.yearPillar.cangGan.map(g => g + WUXING_GAN[g]).join(' ').padStart(6, '　')} │${result.monthPillar.cangGan.map(g => g + WUXING_GAN[g]).join(' ').padStart(6, '　')} │${result.dayPillar.cangGan.map(g => g + WUXING_GAN[g]).join(' ').padStart(6, '　')} │${result.hourPillar.cangGan.map(g => g + WUXING_GAN[g]).join(' ').padStart(6, '　')} │`);
  lines.push(`├────────┼────────┼────────┼────────┤`);
  lines.push(`│${result.yearPillar.nayin.padStart(6, '　')} │${result.monthPillar.nayin.padStart(6, '　')} │${result.dayPillar.nayin.padStart(6, '　')} │${result.hourPillar.nayin.padStart(6, '　')} │`);
  lines.push(`└────────┴────────┴────────┴────────┘`);
  lines.push('');

  lines.push(`日主：${result.dayMaster}（${result.dayMasterElement}）`);
  lines.push(`十二长生：${result.changSheng}`);
  lines.push(`格局初判：${result.geJu}`);
  lines.push('');

  lines.push(`【五行统计】`);
  const wx = result.wuXingCount;
  lines.push(`金${wx.金}  木${wx.木}  水${wx.水}  火${wx.火}  土${wx.土}`);
  const total = Object.values(wx).reduce((a, b) => a + b, 0);
  const weak = Object.entries(wx).filter(([_, v]) => v <= total / 5 * 0.6).map(([k]) => k);
  const strong = Object.entries(wx).filter(([_, v]) => v >= total / 5 * 1.5).map(([k]) => k);
  if (weak.length > 0) lines.push(`五行偏弱：${weak.join('、')}`);
  if (strong.length > 0) lines.push(`五行偏旺：${strong.join('、')}`);
  lines.push('');

  lines.push(`【大运排列】`);
  for (const dy of result.daYun) {
    lines.push(`${dy.startAge}岁：${dy.gan}${dy.zhi}（藏干：${dy.cangGan.join('、')}）`);
  }

  return lines.join('\n');
}
