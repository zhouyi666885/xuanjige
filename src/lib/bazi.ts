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

// 24节气名称（0=小寒, 1=大寒, 2=立春, ..., 23=冬至）
const SOLAR_TERM_NAMES = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
  '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
  '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
  '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];

// 节气对应月份（1-12月）
const SOLAR_TERM_MONTHS = [1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12];

// 21世纪节气C值（经验公式常数）
const C_21 = [
  5.4055, 20.12,   // 小寒, 大寒
  3.87,   18.73,   // 立春, 雨水
  5.63,   20.646,  // 惊蛰, 春分
  4.81,   20.1,    // 清明, 谷雨
  5.52,   21.04,   // 立夏, 小满
  5.678,  21.37,   // 芒种, 夏至
  7.108,  22.83,   // 小暑, 大暑
  7.5,    23.13,   // 立秋, 处暑
  7.646,  23.042,  // 白露, 秋分
  8.318,  23.438,  // 寒露, 霜降
  7.438,  22.36,   // 立冬, 小雪
  7.18,   21.94,   // 大雪, 冬至
];

// 20世纪节气C值
const C_20 = [
  6.11,   20.84,
  4.15,   19.04,
  6.11,   21.17,
  5.59,   20.888,
  6.318,  21.86,
  6.003,  22.20,
  7.928,  23.65,
  8.35,   23.95,
  8.44,   23.822,
  9.098,  24.218,
  8.218,  23.08,
  7.9,    22.6,
];

// 已知特殊年份修正（21世纪部分年份个别节气日期需要±1天修正）
// 键格式: "termIndex-year", 值为偏移天数
const SOLAR_TERM_CORRECTIONS: Record<string, number> = {
  // 小寒
  '0-2019': 1, '0-2025': -1,
  // 立春
  '2-2026': 1,
  // 雨水
  '3-2026': 1,
  // 惊蛰
  '4-2011': 1,
  // 清明
  '6-2012': 1, '6-2024': 1,
  // 谷雨
  '7-2012': 1, '7-2028': 1,
  // 立夏
  '8-2011': 1,
  // 小满
  '9-2011': 1, '9-2028': -1,
  // 芒种
  '10-2011': 1, '10-2027': 1,
  // 夏至
  '11-2021': -1,
  // 小暑
  '12-2016': 1, '12-2025': 1,
  // 大暑
  '13-2016': 1,
  // 立秋
  '14-2002': 1, '14-2023': 1,
  // 白露
  '16-2023': 1,
  // 寒露
  '18-2008': 1,
  // 霜降
  '19-2008': 1, '19-2024': 1,
  // 立冬
  '20-2014': 1, '20-2029': 1,
  // 小雪
  '21-2014': 1, '21-2029': 1,
  // 大雪
  '22-2021': -1,
  // 冬至
  '23-2021': -1,
};

// 使用经验公式计算24节气日期
// 精度：±1天（足够起运年龄计算使用）
// termIndex: 0=小寒, 1=大寒, 2=立春, ..., 23=冬至
function getSolarTermDateApprox(year: number, termIndex: number): { month: number; day: number } {
  const Y = year % 100;
  const C = year >= 2000 ? C_21[termIndex] : C_20[termIndex];

  const month = SOLAR_TERM_MONTHS[termIndex];

  // 节气日期公式：D = [Y * 0.2422 + C] - L
  // L = Math.floor(Y/4) （闰年修正）
  const L = Math.floor(Y / 4);
  let day = Math.floor(Y * 0.2422 + C) - L;

  // 应用已知特殊年份修正
  const correctionKey = `${termIndex}-${year}`;
  if (correctionKey in SOLAR_TERM_CORRECTIONS) {
    day += SOLAR_TERM_CORRECTIONS[correctionKey];
  }

  // 确保日期合法
  const maxDay = getDaysInMonth(year, month);
  day = Math.max(1, Math.min(maxDay, day));

  return { month, day };
}

// 仅获取12个"节"的日期（用于月柱和起运计算）
// jieIndex: 0=小寒, 1=立春, 2=惊蛰, ..., 11=大雪
function getJieDate(year: number, jieIndex: number): { month: number; day: number } {
  // 12个节对应24节气中的偶数索引：0=小寒, 2=立春, 4=惊蛰, ...
  return getSolarTermDateApprox(year, jieIndex * 2);
}

// 更精确的节气计算 - 使用经验公式
// 保持向后兼容：返回指定"节"的日期（day only）
function getSolarTermDay(year: number, termIndex: number): number {
  // termIndex 对应 SOLAR_TERMS_2024 的索引（0-11），即12个节
  const result = getJieDate(year, termIndex);
  return result.day;
}

// 计算两个日期之间的天数差（date2 - date1）
function daysBetweenDates(
  year1: number, month1: number, day1: number,
  year2: number, month2: number, day2: number
): number {
  const d1 = new Date(year1, month1 - 1, day1);
  const d2 = new Date(year2, month2 - 1, day2);
  const diffMs = d2.getTime() - d1.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// 起运年龄计算
// 根据出生日到最近节气的距离，按照"三天为一年"的规则换算
// forward=true: 顺行（从出生日顺数到下一个"节"）
// forward=false: 逆行（从当月之"节"顺数到出生日）
function calculateQiYunAge(
  year: number, month: number, day: number,
  forward: boolean
): { years: number; months: number; daysRemainder: number; totalDays: number; startAge: number } {
  // 找到当月之"节"和下一个"节"
  // 12个节与月份对应：小寒→1月, 立春→2月, 惊蛰→3月, ...
  // 即 jieIndex = month - 1 (0-based)
  const currentJieIndex = month - 1; // 当月之节在SOLAR_TERMS_2024中的索引
  const nextJieIndex = (currentJieIndex + 1) % 12; // 下一个节
  const nextJieYear = nextJieIndex === 0 ? year + 1 : year; // 如果下一个节是小寒（1月），可能是下一年

  const currentJie = getJieDate(currentJieIndex === 0 ? (month === 1 ? year : year - 1) : year, currentJieIndex);
  const nextJie = getJieDate(nextJieYear, nextJieIndex);

  // 修正：当前节可能跨年（12月大雪 → 1月小寒）
  let currentJieYear = year;
  if (currentJieIndex === 0 && month > 1) {
    // 小寒在1月，如果当前月份>1，说明小寒是今年的
    currentJieYear = year;
  } else if (currentJieIndex === 11 && month === 12) {
    // 大雪在12月，年份就是当年
    currentJieYear = year;
  }

  let distanceDays: number;

  if (forward) {
    // 顺行：从出生日顺数到下一个"节"
    distanceDays = daysBetweenDates(year, month, day, nextJieYear, nextJie.month, nextJie.day);
  } else {
    // 逆行：从当月之"节"顺数到出生日
    distanceDays = daysBetweenDates(currentJieYear, currentJie.month, currentJie.day, year, month, day);
  }

  // 确保距离为正
  distanceDays = Math.max(0, distanceDays);

  // 三天为一年，一天为四个月，一个时辰为十天
  const years = Math.floor(distanceDays / 3);
  const remainingDays = distanceDays % 3;
  const months = remainingDays * 4; // 1天=4个月
  const daysRemainder = 0; // 简化，不计算到天数

  return {
    years,
    months,
    daysRemainder,
    totalDays: distanceDays,
    startAge: years, // 起运年龄（整数部分）
  };
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
function getMonthPillar(yearGan: string, month: number, day: number, year: number = 0): { gan: string; zhi: string } {
  // 先确定当前在哪个节气月
  // 节气月：立春→寅月, 惊蛰→卯月, 清明→辰月, 立夏→巳月, 芒种→午月, 小暑→未月
  //         立秋→申月, 白露→酉月, 寒露→戌月, 立冬→亥月, 大雪→子月, 小寒→丑月

  const terms = SOLAR_TERMS_2024;
  let zhiIndex = 1; // 默认丑月（1月）

  for (let i = terms.length - 1; i >= 0; i--) {
    const term = terms[i];
    const termDay = getSolarTermDay(year || new Date().getFullYear(), i);
    if (month > term.month || (month === term.month && day >= termDay)) {
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
  endAge: number;
  gan: string;
  zhi: string;
  cangGan: string[];
}

// 起运年龄详情
interface QiYunDetail {
  startAge: number;       // 起运年龄（整数）
  startAgeMonths: number; // 起运月龄（余数部分）
  totalDays: number;      // 距节气天数
  direction: string;      // 顺逆
  directionReason: string; // 顺逆原因
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

  // 精确计算起运年龄
  const qiYun = calculateQiYunAge(year, month, day, forward);

  const monthZhiIndex = DIZHI.indexOf(monthZhi);

  const daYunList: DaYun[] = [];

  for (let i = 0; i < 8; i++) {
    const offset = forward ? (i + 1) : -(i + 1);
    const ganIdx = ((TIANGAN.indexOf(monthGan) + offset) % 10 + 10) % 10;
    const zhiIdx = ((monthZhiIndex + offset) % 12 + 12) % 12;
    const startAge = qiYun.startAge + i * 10;
    daYunList.push({
      startAge,
      endAge: startAge + 9,
      gan: TIANGAN[ganIdx],
      zhi: DIZHI[zhiIdx],
      cangGan: CANGGAN[DIZHI[zhiIdx]],
    });
  }

  return daYunList;
}

// 获取起运详情（供前端展示）
export function getQiYunDetail(
  yearGan: string,
  gender: 'male' | 'female',
  year: number, month: number, day: number
): QiYunDetail {
  const yearGanIndex = TIANGAN.indexOf(yearGan);
  const isYangYear = yearGanIndex % 2 === 0;
  const isMale = gender === 'male';
  const forward = (isYangYear && isMale) || (!isYangYear && !isMale);

  const qiYun = calculateQiYunAge(year, month, day, forward);

  return {
    startAge: qiYun.startAge,
    startAgeMonths: qiYun.months,
    totalDays: qiYun.totalDays,
    direction: forward ? '顺行' : '逆行',
    directionReason: isYangYear
      ? `${yearGan}属阳年${isMale ? '男命→顺行' : '女命→逆行'}`
      : `${yearGan}属阴年${isMale ? '男命→逆行' : '女命→顺行'}`,
  };
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
  const monthP = getMonthPillar(yearP.gan, trueTime.month, trueTime.day, trueTime.year);

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
  // 起运详情
  const qiYunDetail = getQiYunDetail(
    result.yearPillar.gan,
    result.birthInfo.gender === '男' ? 'male' : 'female',
    result.birthInfo.trueSolarTime.year,
    result.birthInfo.trueSolarTime.month,
    result.birthInfo.trueSolarTime.day
  );
  lines.push(`${qiYunDetail.directionReason}，距节气${qiYunDetail.totalDays}天，${qiYunDetail.startAge}岁${qiYunDetail.startAgeMonths > 0 ? qiYunDetail.startAgeMonths + '个月' : ''}起运`);
  for (const dy of result.daYun) {
    lines.push(`${dy.startAge}-${dy.endAge}岁：${dy.gan}${dy.zhi}（藏干：${dy.cangGan.join('、')}）`);
  }

  return lines.join('\n');
}

// ========== 《渊海子平》十神论断 ==========
// 根据《渊海子平》卷三"论十神"编码，每种十神有正面（吉）和负面（凶）两面的论断
interface ShiShenLunDuan {
  name: string;
  yinYang: string;       // 阴阳属性
  shengKe: string;       // 生克关系
  benXing: string;       // 本性
  jiLun: string;         // 吉论（出自《渊海子平》原文精要）
  xiongLun: string;      // 凶论（出自《渊海子平》原文精要）
  yongShenTiao: string;  // 用神提要（出自《子平真诠》）
}

const SHISHEN_LUNDUAN: Record<string, ShiShenLunDuan> = {
  '正官': {
    name: '正官',
    yinYang: '阴见阳、阳见阴',
    shengKe: '克我者',
    benXing: '守规矩、重法纪、有责任感',
    jiLun: '《渊海子平》云：正官者，乃克我之辰。阳见阴、阴见阳为正官。如甲见辛、乙见庚是也。正官喜纯不喜杂，喜一位不宜多见。官星纯粹，主人品端凝、有威仪、好礼义、重法度。行财乡则官得生，行印乡则官得护，此为官星配印、财生官旺之大格局。官来就我，其性和平，主文章振发、登科及第。',
    xiongLun: '《渊海子平》云：官多不贵，伤官则凶。官星太多反为不美，如一甲见三辛，官多为杀，主为人过于拘泥、优柔寡断、畏首畏尾。官星被伤（伤官见官），为祸百端，主是非纷扰、官灾口舌。官星混杀（正偏官并见），主人反复无常、进退失据。官星无根，虚名薄利。',
    yongShenTiao: '《子平真诠》云：正官格，官星要纯粹，一位为佳。取月令正官为格，最忌伤官破格。有财生官为上格，有印护官为中格，官杀混杂为下格。正官佩印，贵而有权。'
  },
  '七杀': {
    name: '七杀/偏官',
    yinYang: '阳见阳、阴见阴',
    shengKe: '克我者',
    benXing: '果断、刚毅、有魄力、好胜',
    jiLun: '《渊海子平》云：偏官者，阳见阳、阴见阴为七杀。如甲见庚、乙见辛是也。七杀喜制伏，食神制杀为第一贵格，杀制太过反为不美。杀印相生，主人有威权、有谋略、文武双全。食神制杀，主人刚毅果决、能掌大权。杀在年柱，出身武贵；杀在月令，自身威权；杀在时柱，晚岁有权。身杀两停，英雄豪杰之命。',
    xiongLun: '《渊海子平》云：七杀无制，则为祸端。身弱杀重，主性情暴戾、好勇斗狠、灾祸频仍。杀多无制，如虎无栏，主横死、牢狱、血光。杀旺身衰，终身辛苦。官杀混杂，去留不净，主小人暗害、是非不断。杀逢冲破，主凶灾。杀无食制，又无印化，为最凶之命。',
    yongShenTiao: '《子平真诠》云：七杀格，要身旺方能担当。食神制杀为上格，印化杀为中格，杀重身轻为下格。身杀两停，极品之贵。杀无制伏，灾祸不免。'
  },
  '正印': {
    name: '正印',
    yinYang: '阴见阳、阳见阴',
    shengKe: '生我者',
    benXing: '仁慈、聪慧、好学、有依靠',
    jiLun: '《渊海子平》云：正印者，乃生我之辰。阳见阴、阴见阳为正印。如甲见癸、乙见壬是也。正印主人聪明睿智、好学不倦、为人厚道。印绶逢官，为官印相生，主文章出众、科甲有分。印逢长生，学问渊博。印临天乙，有贵人扶持。印居月令，父母双全、家学渊源。印得一位，最为清贵。',
    xiongLun: '《渊海子平》云：印多反为不美，主人依赖心重、优柔寡断、缺乏主见。印太旺身太强，为人固执、不通情理。印被财破（贪财坏印），主破败祖业、学业不成、为人忘恩。印逢空亡，虚名无实。印多行财运，则印被财克，主灾咎。',
    yongShenTiao: '《子平真诠》云：正印格，喜官星生印，忌财星破印。官印相生为上格，杀印相生为中格，财破印为下格。印绶喜七杀，杀印相生功名显赫。'
  },
  '偏印': {
    name: '偏印/枭神',
    yinYang: '阳见阳、阴见阴',
    shengKe: '生我者',
    benXing: '机敏、偏才、多疑、孤僻',
    jiLun: '《渊海子平》云：偏印者，阳见阳、阴见阴为偏印。如甲见壬、乙见癸是也。偏印主人机敏灵巧、心思缜密、善于钻研。偏印配杀，为杀印相生，主有权威。偏印在月令，精于技艺。偏印得制，可化枭为印，主人聪明多才。行财运制枭，反为吉兆。',
    xiongLun: '《渊海子平》云：枭神夺食，最忌见食神。偏印见食神，为枭神夺食，主灾祸、失业、饥馑、子息难养。枭多无制，主人孤僻、多疑、反复无常。枭居日支，配偶多疑。枭临空亡，出家之命。身旺枭多，为人刻薄寡恩。',
    yongShenTiao: '《子平真诠》云：偏印格，要制化得宜。偏印有财制为上格，杀印相生为中格，枭神夺食为最凶。偏印最忌食神，见之则凶。'
  },
  '正财': {
    name: '正财',
    yinYang: '阴见阳、阳见阴',
    shengKe: '我克者',
    benXing: '勤恳、务实、守本分、重信义',
    jiLun: '《渊海子平》云：正财者，乃我克之辰。阳见阴、阴见阳为正财。如甲见己、乙见戊是也。正财主人勤俭持家、为人诚实、不尚虚华。财星生官，财官双美，主富贵双全。财居月令，家业丰厚。财逢长生，财源广进。财藏不露，主守得住财。身旺财旺，富甲一方。财来就我，事半功倍。',
    xiongLun: '《渊海子平》云：财多身弱，富屋贫人。身弱不胜财，纵有财亦难守，反为财累。财被比劫分夺，主破财、耗散。财星太旺无官，贪财好色。财逢冲破，主财来财去。身弱财多行财运，因财致祸。财星坏印，贪财忘义。',
    yongShenTiao: '《子平真诠》云：正财格，身旺财旺为上格，财生官旺为中格，比劫争财为下格。财喜食神生之，喜官星护之，忌比劫夺之。身财两停，巨富之命。'
  },
  '偏财': {
    name: '偏财',
    yinYang: '阳见阳、阴见阴',
    shengKe: '我克者',
    benXing: '豪爽、慷慨、社交广、不吝啬',
    jiLun: '《渊海子平》云：偏财者，阳见阳、阴见阴为偏财。如甲见戊、乙见己是也。偏财主人慷慨大方、善于交际、财运通达。偏财出于众，轻财好义。偏财为众人之财，流通生息。偏财得地，经营有道、生意兴隆。偏财在年柱，祖业丰厚；在月令，自身发达；在日支，妻家有力。偏财旺相，多外财、横财。',
    xiongLun: '《渊海子平》云：偏财太过，主人浮华、好逸恶劳、贪花恋酒。偏财被劫，破财无疑。身弱偏财多，为人轻浮、散财。偏财逢冲，财来财去不聚。偏财多而无正财，好奢不好实。',
    yongShenTiao: '《子平真诠》云：偏财格，与正财同论。喜身旺能胜财，忌比劫争夺。偏财最忌比肩、劫财。偏财格见官星，富贵双全。'
  },
  '食神': {
    name: '食神',
    yinYang: '阳见阳、阴见阴',
    shengKe: '我生者',
    benXing: '温厚、和善、才艺、享福',
    jiLun: '《渊海子平》云：食神者，乃我生之辰。阳见阳、阴见阴为食神。如甲见丙、乙见丁是也。食神主人温和厚道、有口福、善饮食、好文艺。食神制杀，威权出众。食神生财，富贵自来。食神一位，胜似财官。食神得令，为人宽和有德、子孙昌盛。食神带合，主有文学之才。',
    xiongLun: '《渊海子平》云：食神太多，则泄身太过，主人身体虚弱、精神不振。食神逢枭，枭神夺食，主灾祸、失业、饥馑。食神被合，才艺难伸。食多无财，空有才华不遇时。食神逢冲，不安于位。',
    yongShenTiao: '《子平真诠》云：食神格，食神生财为上格，食神制杀为中格，枭神夺食为最凶。食神最忌偏印。食神一位胜财官。'
  },
  '伤官': {
    name: '伤官',
    yinYang: '阴见阳、阳见阴',
    shengKe: '我生者',
    benXing: '聪明、傲慢、叛逆、才华',
    jiLun: '《渊海子平》云：伤官者，乃我生之辰。阳见阴、阴见阳为伤官。如甲见丁、乙见丙是也。伤官主人聪明绝顶、才华出众、善于表现。伤官佩印，为伤官用印格，主文章盖世、科甲及第。伤官生财，为伤官生财格，主人善于经营、财运亨通。金水伤官，文章清秀。木火伤官，聪明多艺。伤官在月令，才华出众。',
    xiongLun: '《渊海子平》云：伤官见官，为祸百端。伤官克正官，犯之主是非、官灾、口舌。伤官无制，为人傲慢、目中无人、恃才傲物。伤官太旺，泄身太过，身体有伤。火土伤官，宜暗不宜明。水木伤官，其性放荡。伤官行官运，大凶。',
    yongShenTiao: '《子平真诠》云：伤官格，伤官佩印为上格，伤官生财为中格，伤官见官为最凶。伤官喜印星制之，喜财星泄之。金水伤官喜见官，木火伤官忌见官。'
  },
  '比肩': {
    name: '比肩',
    yinYang: '阳见阳、阴见阴',
    shengKe: '同我者',
    benXing: '独立、自主、争竞、不服输',
    jiLun: '《渊海子平》云：比肩者，乃同类之辰。阳见阳、阴见阴为比肩。如甲见甲、乙见乙是也。比肩主人自立自强、不依赖人、兄弟朋友多。身弱得比肩扶助，弱极逢生。比肩帮身，可胜财官。比肩居年柱，兄弟有靠。建禄格，身旺有根，可担大任。',
    xiongLun: '《渊海子平》云：比肩太多，主争夺、分财、竞争。身旺比多，克妻克父。比肩争财，财来不聚。比肩夺官，仕途受阻。比多无制，为人固执、独断专行。',
    yongShenTiao: '《子平真诠》云：比肩格，身弱喜比扶，身旺忌比助。比肩多则争财，用官则忌比肩。建禄生月，要财官食伤为用。'
  },
  '劫财': {
    name: '劫财/阳刃',
    yinYang: '阴见阳、阳见阴',
    shengKe: '同我者',
    benXing: '争斗、劫夺、冒险、刚烈',
    jiLun: '《渊海子平》云：劫财者，乃异类之辰。阳见阴、阴见阳为劫财。如甲见乙、乙见甲是也。劫财主人胆大心细、勇于冒险、善于竞争。身弱劫财帮身，可以夺财抗杀。劫财配食伤，善于创业。劫财合杀，主武贵。刃旺身强，可掌兵权。',
    xiongLun: '《渊海子平》云：劫财太多，主破财、争斗、灾祸。阳刃无制，如刀无鞘，主血光、横祸。劫财夺财，财来财去。劫财见财，贪财致祸。刃逢冲合，勃然祸至。阳刃倒戈，凶灾难免。身旺劫多，克父克妻。',
    yongShenTiao: '《子平真诠》云：劫财格，身弱喜劫帮，身旺忌劫争。阳刃最喜官杀制之，食伤泄之。刃旺无制，灾祸难逃。阳刃用官，极品之贵。'
  },
};

// 获取十神论断
export function getShiShenLunDuan(shiShen: string): ShiShenLunDuan | undefined {
  return SHISHEN_LUNDUAN[shiShen];
}

// ========== 《子平真诠》格局判定（完整版） ==========
// 依据《子平真诠》卷二"论格局"编码，以月令藏干透出定格局

interface GeJuLunDuan {
  name: string;
  chengFa: string;     // 成格条件（出自《子平真诠》）
  baiFa: string;       // 败格条件
  yongShen: string;    // 用神取法
  xiShen: string;      // 喜神
   jiShen: string;      // 忌神
  lunDuan: string;     // 格局论断（综合《渊海子平》《子平真诠》《三命通会》）
}

const GEJU_LUNDUAN: Record<string, GeJuLunDuan> = {
  '正官格': {
    name: '正官格',
    chengFa: '《子平真诠》云：正官格，月令正官透出天干，或本气正官当令。官星要纯粹，一位为佳。官星得财印相辅，方为成格。',
    baiFa: '《子平真诠》云：正官格忌伤官破格、官杀混杂、刑冲破害。伤官破官则格败，官杀混杂则不清，刑冲破害则不安。',
    yongShen: '正官为用，财星生官，印星护官',
    xiShen: '财星（生官）、印星（护官）、食神（助官制杀）',
    jiShen: '伤官（破官）、七杀（混官）、刑冲（破格）',
    lunDuan: '正官格为八格之首。《渊海子平》云：官星纯粹，定主清高。财官双美，富贵自来。官印相生，文华显贵。《三命通会》云：正官一位，聪明有智，品行端方。官逢财生，贵而且富。官逢印护，贵而有名。官居月令，最为有力。'
  },
  '七杀格': {
    name: '七杀格/偏官格',
    chengFa: '《子平真诠》云：七杀格，月令七杀透出，身旺能担。食神制杀为上格，杀印相生为中格。身杀两停，英雄豪杰。',
    baiFa: '《子平真诠》云：七杀格忌身弱杀重、杀无制伏、官杀混杂。身弱杀重则灾祸频仍，杀无制伏则横暴无礼，官杀混杂则去留不定。',
    yongShen: '食神制杀为上，印星化杀为中',
    xiShen: '食神（制杀）、印星（化杀）、比劫（帮身担杀）',
    jiShen: '财星（生杀加重）、无制之杀',
    lunDuan: '《渊海子平》云：七杀有制，化为权柄。食神制杀，威权出众。杀印相生，文武兼备。《滴天髓》云：杀为权柄，制化得宜则为权为贵，制化不力则为灾为祸。身杀两停，将相之才。杀重身轻，终身困苦。'
  },
  '正印格': {
    name: '正印格',
    chengFa: '《子平真诠》云：正印格，月令印绶透出。官星生印为上，杀印相生为中。印逢长生，学问过人。',
    baiFa: '《子平真诠》云：正印格忌财星坏印、印多身旺无泄。财坏印则学业有亏、名誉受损。印太多则为人依赖、缺乏主见。',
    yongShen: '官星生印、杀印相生',
    xiShen: '官星（生印）、七杀（杀印相生）、比劫（帮身）',
    jiShen: '财星（坏印）、食伤泄身太过',
    lunDuan: '《渊海子平》云：印绶格主人聪明、好学、有靠山。官印相生，科甲有名。印居月令，父母有靠。《三命通会》云：印绶遇官，十有九贵。印绶遭财，十有九败。'
  },
  '偏印格': {
    name: '偏印格/枭神格',
    chengFa: '《子平真诠》云：偏印格，月令偏印透出。偏印有财制化枭为上格，杀印相生为中格。偏印在月令，精于技艺。',
    baiFa: '《子平真诠》云：偏印格忌枭神夺食、偏印太多无制。枭神夺食则灾祸立至，印多无制则孤僻多疑。',
    yongShen: '财星制枭、杀印相生',
    xiShen: '财星（制枭）、七杀（杀印相生）、偏财（制偏印）',
    jiShen: '食神（枭神夺食）、比劫（帮身太过）',
    lunDuan: '《渊海子平》云：偏印主人机敏多疑、善钻研。枭神夺食，最凶之格，主失业、灾祸、子息不利。偏印有制，亦为有用之才。《三命通会》云：枭逢财制，化凶为吉。'
  },
  '正财格': {
    name: '正财格',
    chengFa: '《子平真诠》云：正财格，月令正财透出。身旺财旺为上格，财生官旺为中格。财藏不露，守得住财。',
    baiFa: '《子平真诠》云：正财格忌比劫分财、财多身弱。比劫分财则财来财去，财多身弱则富屋贫人。',
    yongShen: '食伤生财、官星护财',
    xiShen: '食神（生财）、官星（护财）、印星（帮身）',
    jiShen: '比肩（分财）、劫财（夺财）、身弱不胜财',
    lunDuan: '《渊海子平》云：正财格主人勤恳务实、持家有方。身旺财旺，富甲一方。财官双美，富贵双全。《三命通会》云：财星得位，妻贤家富。财逢食生，财源滚滚。'
  },
  '偏财格': {
    name: '偏财格',
    chengFa: '《子平真诠》云：偏财格，月令偏财透出。身旺能胜偏财为上格，偏财生官为中格。偏财流通，财运通达。',
    baiFa: '《子平真诠》云：偏财格忌比劫争夺、身弱不胜财。比劫争夺则横财化水，身弱不胜财则因财致祸。',
    yongShen: '食伤生财、官星护财',
    xiShen: '食神（生财）、官星（护财）',
    jiShen: '比肩（分财）、劫财（夺财）',
    lunDuan: '《渊海子平》云：偏财格主人慷慨大方、善于交际。偏财旺相，多外财横财。偏财得地，经营有道。《三命通会》云：偏财出于众，轻财好义。偏财逢官，富贵双全。'
  },
  '食神格': {
    name: '食神格',
    chengFa: '《子平真诠》云：食神格，月令食神透出。食神生财为上格，食神制杀为中格。食神一位胜财官。',
    baiFa: '《子平真诠》云：食神格忌枭神夺食、食神太多泄身。枭神夺食则灾祸、失业。食多泄身太过则体弱。',
    yongShen: '财星泄食、印星护身',
    xiShen: '财星（食生财）、印星（制食护身）',
    jiShen: '偏印（枭神夺食）、食多无财',
    lunDuan: '《渊海子平》云：食神格主人温厚和善、有口福才艺。食神生财，富贵自来。食神制杀，威权出众。食神一位，胜似财官。《滴天髓》云：食神最忌枭来夺。'
  },
  '伤官格': {
    name: '伤官格',
    chengFa: '《子平真诠》云：伤官格，月令伤官透出。伤官佩印为上格，伤官生财为中格。金水伤官喜见官，木火伤官忌见官。',
    baiFa: '《子平真诠》云：伤官格忌伤官见官（木火伤官尤忌）、伤官无制。伤官见官为祸百端，伤官无制则傲慢无礼。',
    yongShen: '印星制伤（佩印）、财星泄伤（生财）',
    xiShen: '印星（制伤）、财星（泄伤）',
    jiShen: '正官（伤官见官）、无制之伤官',
    lunDuan: '《渊海子平》云：伤官主人聪明绝顶，但恃才傲物。伤官佩印，文章盖世。伤官生财，经营有方。伤官见官，灾祸难免。《三命通会》云：金水伤官最清秀，木火伤官多聪明，火土伤官宜暗藏，水木伤官性放荡。'
  },
  '建禄格': {
    name: '建禄格/月劫格',
    chengFa: '《子平真诠》云：建禄格，月令为日主之禄。身旺有力，要用财官食伤为用。禄逢财官，格取清贵。',
    baiFa: '《子平真诠》云：建禄格忌身旺无依、禄逢冲破。身旺无财官食伤可用，则格不高。禄逢冲破，根基不稳。',
    yongShen: '财官食伤为用',
    xiShen: '财星（耗身）、官星（制身）、食伤（泄身）',
    jiShen: '比劫（身已旺不宜再助）、印星（帮身太过）',
    lunDuan: '《渊海子平》云：建禄格身旺有力，必要财官食伤为用方好。无财官可用则平常之命。禄马交驰，富贵双全。建禄生财，白手兴家。《三命通会》云：禄最怕冲，冲则禄倒。'
  },
};

// 获取格局论断
export function getGeJuLunDuan(geJu: string): GeJuLunDuan | undefined {
  // 匹配格局名称（可能含"木旺""火旺"等前缀）
  for (const key of Object.keys(GEJU_LUNDUAN)) {
    if (geJu.includes(key.replace('格', '')) || geJu === key) {
      return GEJU_LUNDUAN[key];
    }
  }
  return undefined;
}

// ========== 《滴天髓》旺衰判断 ==========
// 根据《滴天髓》"论旺衰"编码

interface WangShuaiResult {
  riZhuQiangRuo: string;     // 日主强弱
  yongShen: string;           // 用神
   jiShen: string;            // 忌神
  xiShen: string;             // 喜神
  tiaoHouYongShen: string;   // 调候用神
  lunDuan: string;            // 论断
}

export function judgeWangShuai(result: BaZiPaiPan): WangShuaiResult {
  const dayElement = result.dayMasterElement;
  const wuXing = result.wuXingCount;
  const total = Object.values(wuXing).reduce((a, b) => a + b, 0);

  // 生我者（印星）+ 同我者（比劫）= 帮身力量
  const shengWo = getShengElement(dayElement); // 生我之五行
  const tongWo = dayElement; // 同我之五行
  const bangShen = (wuXing[shengWo as keyof WuXingCount] || 0) + (wuXing[tongWo as keyof WuXingCount] || 0);

  // 克我者（官杀）+ 我克者（财星）+ 我生者（食伤）= 耗身力量
  const keWo = getKeElement(dayElement);
  const woKe = getWoKeElement(dayElement);
  const woSheng = getWoShengElement(dayElement);
  const haoShen = (wuXing[keWo as keyof WuXingCount] || 0) + (wuXing[woKe as keyof WuXingCount] || 0) + (wuXing[woSheng as keyof WuXingCount] || 0);

  const isStrong = bangShen > haoShen;
  const ratio = bangShen / (bangShen + haoShen);

  let riZhuQiangRuo: string;
  let yongShen: string;
  let jiShen: string;
  let xiShen: string;
  let lunDuan: string;

  if (ratio > 0.65) {
    riZhuQiangRuo = '日主过旺';
    yongShen = `克我之${keWo}（官杀）、我克之${woKe}（财星）、我生之${woSheng}（食伤）`;
    jiShen = `生我之${shengWo}（印星）、同我之${tongWo}（比劫）`;
    xiShen = `${keWo}、${woKe}、${woSheng}`;
    lunDuan = '《滴天髓》云：旺极宜泄不宜帮，身旺须用财官食伤耗泄。日主过旺，如水满则溢，须以官杀制之、财星耗之、食伤泄之。不宜再用印比帮身，帮之则过。身旺无依，纵有才能亦难施展。';
  } else if (ratio > 0.5) {
    riZhuQiangRuo = '日主偏旺';
    yongShen = `克我之${keWo}（官杀）、我克之${woKe}（财星）、我生之${woSheng}（食伤）`;
    jiShen = `同我之${tongWo}（比劫）、生我之${shengWo}（印星）`;
    xiShen = `${keWo}、${woKe}、${woSheng}`;
    lunDuan = '《滴天髓》云：身旺宜泄不宜帮，取财官食伤为用。日主偏旺，以官制身、以财耗身、以食伤泄身为上。印比帮身皆为忌——比劫增旺争财，印星生身亦加重旺势，均不利。行财官食伤运则发达，行印比运则滞塞。身旺之人，印多为患，学业尤为不利。';
  } else if (ratio > 0.35) {
    riZhuQiangRuo = '日主中和';
    yongShen = '随运而取，财官印食皆可为用';
    jiShen = '视大运流年而定';
    xiShen = '格局配合取用';
    lunDuan = '《滴天髓》云：中和为贵。日主中和，最为上品，行财官食伤运皆可，唯怕太过不及。命局中和之人，一生平稳，少有大起大落。';
  } else if (ratio > 0.2) {
    riZhuQiangRuo = '日主偏弱';
    yongShen = `生我之${shengWo}（印星）、同我之${tongWo}（比劫）`;
    jiShen = `克我之${keWo}（官杀）、我克之${woKe}（财星）`;
    xiShen = `${shengWo}、${tongWo}`;
    lunDuan = '《滴天髓》云：身弱宜帮，取印比为用。日主偏弱，须印星生之、比劫扶之。行印比运则顺遂，行财官运则辛苦。身弱得印比帮身，亦可发福。';
  } else {
    riZhuQiangRuo = '日主过弱';
    yongShen = `生我之${shengWo}（印星）为救命用神`;
    jiShen = `克我之${keWo}（官杀）、我克之${woKe}（财星）、我生之${woSheng}（食伤泄身）`;
    xiShen = `${shengWo}、${tongWo}`;
    lunDuan = '《滴天髓》云：弱极须扶，如枯木逢春。日主过弱，犹如风中残烛，急需印比帮身。财官食伤皆为耗泄，见之则凶。最喜印比相扶，如旱苗得雨。若行印比运，可转危为安。';
  }

  // 调候用神（来自《穷通宝鉴》）
  const tiaoHouYongShen = getTiaoHou(result.dayMaster, result.birthInfo.trueSolarTime.month)?.yongShen || '无特殊调候需求';

  return { riZhuQiangRuo, yongShen, jiShen, xiShen, tiaoHouYongShen, lunDuan };
}

// 辅助：五行生克关系
function getShengElement(element: string): string {
  const map: Record<string, string> = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' };
  return map[element] || '';
}
function getKeElement(element: string): string {
  const map: Record<string, string> = { '木': '金', '火': '水', '土': '木', '金': '火', '水': '土' };
  return map[element] || '';
}
function getWoKeElement(element: string): string {
  const map: Record<string, string> = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };
  return map[element] || '';
}
function getWoShengElement(element: string): string {
  const map: Record<string, string> = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  return map[element] || '';
}

// ========== 《三命通会》神煞论 ==========
// 根据《三命通会》卷六编码常用神煞

interface ShenShaInfo {
  name: string;
  find: string;         // 查法
  jiLun: string;        // 吉论
  xiongLun: string;     // 凶论
}

const SHENSHA_TABLE: Record<string, ShenShaInfo> = {
  '天乙贵人': {
    name: '天乙贵人',
    find: '甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，庚辛逢马虎',
    jiLun: '《三命通会》云：天乙贵人，乃天上之神，在紫微垣阖门外，与太乙并列，事天皇大帝，下游三辰。贵人所在，凶煞隐藏。命中带天乙贵人，主聪明智慧、近贵利名、逢凶化吉、遇难呈祥。女人带之，主嫁贵夫。',
    xiongLun: '贵人逢冲破，减力。贵人落空亡，虚名无实。贵人逢刑害，助力减半。'
  },
  '文昌贵人': {
    name: '文昌贵人',
    find: '甲乙巳午报，丙戊申宫找，丁己鸡同窝，庚辛亥鼠叫，壬癸寅卯照',
    jiLun: '《三命通会》云：文昌主人聪明过人、好学新知、文采斐然、科举有成。命中带文昌，利读书考试，文思泉涌。',
    xiongLun: '文昌逢冲，学业有阻。文昌落空，才难施展。'
  },
  '太极贵人': {
    name: '太极贵人',
    find: '甲乙生人子午中，丙丁鸡兔定亨通，戊己两干临四季，庚辛寅亥禄盈丰，壬癸巳申偏喜美',
    jiLun: '《三命通会》云：太极贵人主聪明好学、有钻牛角尖的精神、对神秘事物有兴趣。命带太极，主人喜欢哲学、宗教、玄学等深奥学问。',
    xiongLun: '太极逢空，虚学无成。'
  },
  '驿马': {
    name: '驿马',
    find: '申子辰马在寅，寅午戌马在申，巳酉丑马在亥，亥卯未马在巳',
    jiLun: '《三命通会》云：驿马主奔波走动、出行、变动。驿马逢财官，因变动而获利。驿马逢合，动中有成。升迁、调职、出国皆看驿马。命带驿马，一生多走动。',
    xiongLun: '驿马逢冲，奔波劳碌。驿马无合，东奔西走一场空。马多无归，一生漂泊。'
  },
  '华盖': {
    name: '华盖',
    find: '寅午戌见戌，申子辰见辰，亥卯未见未，巳酉丑见丑',
    jiLun: '《三命通会》云：华盖主人聪明好学、清高孤傲、喜独处、对宗教哲学有兴趣。华盖逢印，才华出众。华盖为僧道之星，主人清闲自在。命带华盖，文章艺术有成就。',
    xiongLun: '华盖逢空亡，出家之命。华盖太重，孤僻清高、不合群。华盖无冲，终身埋没。华盖太多，六亲缘薄。'
  },
  '将星': {
    name: '将星',
    find: '寅午戌见午，申子辰见子，亥卯未见卯，巳酉丑见酉',
    jiLun: '《三命通会》云：将星主权威、领导力。将星逢官杀，掌权有威。将星在年柱，出身将门。将星在月令，自身有权。命带将星，有领导才能。',
    xiongLun: '将星逢冲破，权位不保。将星无制，刚愎自用。'
  },
  '羊刃': {
    name: '羊刃/阳刃',
    find: '甲见卯、乙见辰、丙见午、丁见未、戊见午、己见未、庚见酉、辛见戌、壬见子、癸见丑',
    jiLun: '《三命通会》云：羊刃主刚毅果决、胆大心细。刃旺身强，可掌大权。阳刃用官，极品之贵。刃配食伤，善创业开拓。武职之人多带刃。',
    xiongLun: '《三命通会》云：刃旺无制，如刀无鞘，主血光、灾祸、横死。羊刃逢冲，勃然祸至。身旺刃多，克妻克父。刃逢财，贪财致祸。阳刃倒戈，最凶之象。'
  },
  '桃花': {
    name: '桃花/咸池',
    find: '寅午戌见卯，申子辰见酉，亥卯未见子，巳酉丑见午',
    jiLun: '《三命通会》云：桃花主风流才情、人缘好、异性缘佳。桃花逢正官，因异性而得贵。桃花逢正财，因异性而得财。命带桃花，容貌俊美、善于社交。',
    xiongLun: '桃花太多，好色贪淫、不务正业。桃花逢冲，因色惹祸。桃花带杀，因色致灾。墙外桃花，婚后出轨。'
  },
  '亡神': {
    name: '亡神',
    find: '寅午戌见巳，申子辰见亥，亥卯未见寅，巳酉丑见申',
    jiLun: '亡神在生旺之位，主人城府深、善谋略。',
    xiongLun: '《三命通会》云：亡神在死绝之位，主灾祸、是非、牢狱。亡神逢冲，灾祸加速。亡神并劫煞，凶不可当。'
  },
  '劫煞': {
    name: '劫煞',
    find: '寅午戌见亥，申子辰见巳，亥卯未见申，巳酉丑见寅',
    jiLun: '劫煞逢贵人在位，反主有权。劫煞在生旺之地，刚毅有为。',
    xiongLun: '《三命通会》云：劫煞逢死绝，主灾祸、伤灾、破财。劫煞并亡神，灾祸连连。劫煞逢冲，血光之灾。'
  },
};

// 计算四柱神煞
export function calculateShenSha(result: BaZiPaiPan): string[] {
  const shenShaList: string[] = [];
  const yearZhi = result.yearPillar.zhi;
  const dayGan = result.dayPillar.gan;
  const dayZhi = result.dayPillar.zhi;
  const allZhi = [result.yearPillar.zhi, result.monthPillar.zhi, result.dayPillar.zhi, result.hourPillar.zhi];

  // 天乙贵人
  const tianYiMap: Record<string, string[]> = {
    '甲': ['丑', '未'], '戊': ['丑', '未'], '庚': ['丑', '未'],
    '乙': ['子', '申'], '己': ['子', '申'],
    '丙': ['亥', '酉'], '丁': ['亥', '酉'],
    '壬': ['卯', '巳'], '癸': ['卯', '巳'],
    '辛': ['午', '寅'],
  };
  const tianYiZhi = tianYiMap[dayGan] || [];
  if (allZhi.some(z => tianYiZhi.includes(z))) {
    shenShaList.push('天乙贵人');
  }

  // 驿马
  const yiMaMap: Record<string, string> = {
    '申': '寅', '子': '寅', '辰': '寅',
    '寅': '申', '午': '申', '戌': '申',
    '巳': '亥', '酉': '亥', '丑': '亥',
    '亥': '巳', '卯': '巳', '未': '巳',
  };
  const yiMaZhi = yiMaMap[yearZhi] || '';
  if (allZhi.some(z => z === yiMaZhi)) {
    shenShaList.push('驿马');
  }

  // 华盖
  const huaGaiMap: Record<string, string> = {
    '寅': '戌', '午': '戌', '戌': '戌',
    '申': '辰', '子': '辰', '辰': '辰',
    '亥': '未', '卯': '未', '未': '未',
    '巳': '丑', '酉': '丑', '丑': '丑',
  };
  const huaGaiZhi = huaGaiMap[yearZhi] || '';
  if (allZhi.some(z => z === huaGaiZhi)) {
    shenShaList.push('华盖');
  }

  // 将星
  const jiangXingMap: Record<string, string> = {
    '寅': '午', '午': '午', '戌': '午',
    '申': '子', '子': '子', '辰': '子',
    '亥': '卯', '卯': '卯', '未': '卯',
    '巳': '酉', '酉': '酉', '丑': '酉',
  };
  const jiangXingZhi = jiangXingMap[yearZhi] || '';
  if (allZhi.some(z => z === jiangXingZhi)) {
    shenShaList.push('将星');
  }

  // 羊刃
  const yangRenMap: Record<string, string> = {
    '甲': '卯', '乙': '辰', '丙': '午', '丁': '未',
    '戊': '午', '己': '未', '庚': '酉', '辛': '戌',
    '壬': '子', '癸': '丑',
  };
  const yangRenZhi = yangRenMap[dayGan] || '';
  if (allZhi.some(z => z === yangRenZhi)) {
    shenShaList.push('羊刃');
  }

  // 桃花
  const taoHuaMap: Record<string, string> = {
    '寅': '卯', '午': '卯', '戌': '卯',
    '申': '酉', '子': '酉', '辰': '酉',
    '亥': '子', '卯': '子', '未': '子',
    '巳': '午', '酉': '午', '丑': '午',
  };
  const taoHuaZhi = taoHuaMap[yearZhi] || '';
  if (allZhi.some(z => z === taoHuaZhi)) {
    shenShaList.push('桃花');
  }

  // 文昌
  const wenChangMap: Record<string, string> = {
    '甲': '巳', '乙': '午', '丙': '申', '丁': '酉',
    '戊': '申', '己': '酉', '庚': '亥', '辛': '子',
    '壬': '寅', '癸': '卯',
  };
  const wenChangZhi = wenChangMap[dayGan] || '';
  if (allZhi.some(z => z === wenChangZhi)) {
    shenShaList.push('文昌贵人');
  }

  // 亡神
  const wangShenMap: Record<string, string> = {
    '寅': '巳', '午': '巳', '戌': '巳',
    '申': '亥', '子': '亥', '辰': '亥',
    '亥': '寅', '卯': '寅', '未': '寅',
    '巳': '申', '酉': '申', '丑': '申',
  };
  const wangShenZhi = wangShenMap[yearZhi] || '';
  if (allZhi.some(z => z === wangShenZhi)) {
    shenShaList.push('亡神');
  }

  // 劫煞
  const jieShaMap: Record<string, string> = {
    '寅': '亥', '午': '亥', '戌': '亥',
    '申': '巳', '子': '巳', '辰': '巳',
    '亥': '申', '卯': '申', '未': '申',
    '巳': '寅', '酉': '寅', '丑': '寅',
  };
  const jieShaZhi = jieShaMap[yearZhi] || '';
  if (allZhi.some(z => z === jieShaZhi)) {
    shenShaList.push('劫煞');
  }

  // 太极贵人
  const taiJiMap: Record<string, string[]> = {
    '甲': ['子', '午'], '乙': ['子', '午'],
    '丙': ['卯', '酉'], '丁': ['卯', '酉'],
    '戊': ['辰', '戌', '丑', '未'], '己': ['辰', '戌', '丑', '未'],
    '庚': ['寅', '亥'], '辛': ['寅', '亥'],
    '壬': ['巳', '申'], '癸': ['巳', '申'],
  };
  const taiJiZhi = taiJiMap[dayGan] || [];
  if (allZhi.some(z => taiJiZhi.includes(z))) {
    shenShaList.push('太极贵人');
  }

  return shenShaList;
}

// 获取神煞论断
export function getShenShaLunDuan(name: string): ShenShaInfo | undefined {
  return SHENSHA_TABLE[name];
}

// ========== 《穷通宝鉴》调候用神表 ==========
// 格式：[日主天干索引][月份1-12] → { yongShen: 用神, xiShen: 喜神, tiaoHou: 调候说明 }
// 月份按农历：1=寅月, 2=卯月, ..., 12=丑月

interface TiaoHouInfo {
  yongShen: string;       // 调候用神
  xiShen: string;         // 喜神
    tiaoHou: string;      // 调候说明（引自《穷通宝鉴》原文）
}

// 甲木调候（日主=甲，索引0）
const JIA_TIAOHOU: TiaoHouInfo[] = [
  { yongShen: '丙', xiShen: '癸', tiaoHou: '正月甲木，初春尚有余寒，先用丙火暖之，再用癸水润之' },
  { yongShen: '丙', xiShen: '癸', tiaoHou: '二月甲木，阳气渐升，先用丙火，后用癸水' },
  { yongShen: '庚', xiShen: '壬', tiaoHou: '三月甲木，木气已老，用庚金克之，壬水润之' },
  { yongShen: '庚', xiShen: '丁', tiaoHou: '四月甲木，火旺木渴，先用癸水润之，次用庚金' },
  { yongShen: '癸', xiShen: '庚', tiaoHou: '五月甲木，火旺木焚，必用癸水为救，次用庚金发水源' },
  { yongShen: '癸', xiShen: '庚', tiaoHou: '六月甲木，火土并旺，先用癸水，次用庚金' },
  { yongShen: '丁', xiShen: '庚', tiaoHou: '七月甲木，金旺木绝，先用丁火制金，次用庚金' },
  { yongShen: '丁', xiShen: '庚', tiaoHou: '八月甲木，金旺克木，用丁火制之' },
  { yongShen: '癸', xiShen: '丁', tiaoHou: '九月甲木，土旺木枯，先用癸水润之，次用丁火' },
  { yongShen: '丁', xiShen: '庚', tiaoHou: '十月甲木，水旺木寒，先用丁火暖之，次用庚金' },
  { yongShen: '丁', xiShen: '庚', tiaoHou: '十一月甲木，寒木向阳，必用丁火' },
  { yongShen: '丁', xiShen: '丙', tiaoHou: '十二月甲木，天寒地冻，先用丁火，次用丙火' },
];

// 乙木调候（日主=乙，索引1）
const YI_TIAOHOU: TiaoHouInfo[] = [
  { yongShen: '丙', xiShen: '癸', tiaoHou: '正月乙木，用丙火暖之，癸水润之' },
  { yongShen: '丙', xiShen: '癸', tiaoHou: '二月乙木，阳气渐生，用丙火癸水' },
  { yongShen: '癸', xiShen: '丙', tiaoHou: '三月乙木，用癸水润之，丙火暖之' },
  { yongShen: '癸', xiShen: '丙', tiaoHou: '四月乙木，火旺木渴，必用癸水' },
  { yongShen: '癸', xiShen: '丙', tiaoHou: '五月乙木，火炎土燥，癸水为救' },
  { yongShen: '癸', xiShen: '丙', tiaoHou: '六月乙木，土旺用癸水润之' },
  { yongShen: '丙', xiShen: '癸', tiaoHou: '七月乙木，金旺用丙火' },
  { yongShen: '丙', xiShen: '癸', tiaoHou: '八月乙木，金旺木弱，用丙火制金' },
  { yongShen: '癸', xiShen: '丙', tiaoHou: '九月乙木，土旺用癸水' },
  { yongShen: '丙', xiShen: '戊', tiaoHou: '十月乙木，水旺用丙火' },
  { yongShen: '丙', xiShen: '戊', tiaoHou: '十一月乙木，寒木向阳，用丙火' },
  { yongShen: '丙', xiShen: '戊', tiaoHou: '十二月乙木，用丙火暖之' },
];

// 丙火调候（日主=丙，索引2）
const BING_TIAOHOU: TiaoHouInfo[] = [
  { yongShen: '壬', xiShen: '甲', tiaoHou: '正月丙火，木旺火相，用壬水为制，甲木为辅' },
  { yongShen: '壬', xiShen: '己', tiaoHou: '二月丙火，用壬水为制' },
  { yongShen: '壬', xiShen: '甲', tiaoHou: '三月丙火，土旺用壬水' },
  { yongShen: '壬', xiShen: '甲', tiaoHou: '四月丙火，火旺用壬水制之' },
  { yongShen: '壬', xiShen: '庚', tiaoHou: '五月丙火，火炎水绝，必用壬水，庚金发水源' },
  { yongShen: '壬', xiShen: '庚', tiaoHou: '六月丙火，土旺用壬水，庚金佐之' },
  { yongShen: '壬', xiShen: '戊', tiaoHou: '七月丙火，金旺水相，用壬水' },
  { yongShen: '壬', xiShen: '甲', tiaoHou: '八月丙火，金旺用壬水' },
  { yongShen: '壬', xiShen: '甲', tiaoHou: '九月丙火，土旺用壬水，甲木疏土' },
  { yongShen: '甲', xiShen: '壬', tiaoHou: '十月丙火，水旺用甲木化杀生身' },
  { yongShen: '甲', xiShen: '壬', tiaoHou: '十一月丙火，水旺火弱，甲木为用' },
  { yongShen: '甲', xiShen: '壬', tiaoHou: '十二月丙火，土旺用甲木' },
];

// 丁火调候（日主=丁，索引3）
const DING_TIAOHOU: TiaoHouInfo[] = [
  { yongShen: '甲', xiShen: '庚', tiaoHou: '正月丁火，用甲木引丁' },
  { yongShen: '甲', xiShen: '庚', tiaoHou: '二月丁火，用甲木' },
  { yongShen: '甲', xiShen: '庚', tiaoHou: '三月丁火，土旺用甲木' },
  { yongShen: '甲', xiShen: '壬', tiaoHou: '四月丁火，火旺用甲木' },
  { yongShen: '甲', xiShen: '壬', tiaoHou: '五月丁火，火旺用甲木化杀' },
  { yongShen: '甲', xiShen: '壬', tiaoHou: '六月丁火，土旺用甲木' },
  { yongShen: '甲', xiShen: '庚', tiaoHou: '七月丁火，金旺用甲木' },
  { yongShen: '甲', xiShen: '庚', tiaoHou: '八月丁火，金旺用甲木' },
  { yongShen: '甲', xiShen: '庚', tiaoHou: '九月丁火，土旺用甲木' },
  { yongShen: '甲', xiShen: '庚', tiaoHou: '十月丁火，水旺用甲木化杀' },
  { yongShen: '甲', xiShen: '庚', tiaoHou: '十一月丁火，寒水旺用甲木' },
  { yongShen: '甲', xiShen: '庚', tiaoHou: '十二月丁火，土旺用甲木' },
];

// 戊土调候（日主=戊，索引4）
const WU_TIAOHOU: TiaoHouInfo[] = [
  { yongShen: '丙', xiShen: '甲', tiaoHou: '正月戊土，寒气未除，先用丙火暖之' },
  { yongShen: '丙', xiShen: '甲', tiaoHou: '二月戊土，用丙火暖之，甲木疏土' },
  { yongShen: '甲', xiShen: '丙', tiaoHou: '三月戊土，土旺用甲木疏之' },
  { yongShen: '甲', xiShen: '丙', tiaoHou: '四月戊土，火旺土燥，先用癸水润之' },
  { yongShen: '壬', xiShen: '甲', tiaoHou: '五月戊土，火旺土燥，用壬水为救' },
  { yongShen: '壬', xiShen: '甲', tiaoHou: '六月戊土，土旺用壬水，甲木疏土' },
  { yongShen: '丙', xiShen: '癸', tiaoHou: '七月戊土，金旺水相，先用丙火' },
  { yongShen: '丙', xiShen: '癸', tiaoHou: '八月戊土，金旺用丙火' },
  { yongShen: '甲', xiShen: '丙', tiaoHou: '九月戊土，土旺用甲木疏之' },
  { yongShen: '甲', xiShen: '丙', tiaoHou: '十月戊土，水旺用甲木化杀' },
  { yongShen: '甲', xiShen: '丙', tiaoHou: '十一月戊土，水旺用甲木丙火' },
  { yongShen: '丙', xiShen: '甲', tiaoHou: '十二月戊土，天寒地冻，用丙火暖之' },
];

// 己土调候（日主=己，索引5）
const JI_TIAOHOU: TiaoHouInfo[] = [
  { yongShen: '丙', xiShen: '甲', tiaoHou: '正月己土，寒气未除，用丙火暖之' },
  { yongShen: '甲', xiShen: '丙', tiaoHou: '二月己土，用甲木疏之，丙火暖之' },
  { yongShen: '甲', xiShen: '丙', tiaoHou: '三月己土，土旺用甲木疏之' },
  { yongShen: '癸', xiShen: '丙', tiaoHou: '四月己土，火旺土燥，用癸水润之' },
  { yongShen: '癸', xiShen: '丙', tiaoHou: '五月己土，火旺用癸水' },
  { yongShen: '癸', xiShen: '丙', tiaoHou: '六月己土，土旺用癸水润之' },
  { yongShen: '丙', xiShen: '癸', tiaoHou: '七月己土，金旺用丙火' },
  { yongShen: '丙', xiShen: '癸', tiaoHou: '八月己土，金旺用丙火' },
  { yongShen: '甲', xiShen: '丙', tiaoHou: '九月己土，土旺用甲木疏之' },
  { yongShen: '甲', xiShen: '丙', tiaoHou: '十月己土，水旺用甲木' },
  { yongShen: '丙', xiShen: '甲', tiaoHou: '十一月己土，寒土用丙火' },
  { yongShen: '丙', xiShen: '甲', tiaoHou: '十二月己土，寒土用丙火暖之' },
];

// 庚金调候（日主=庚，索引6）
const GENG_TIAOHOU: TiaoHouInfo[] = [
  { yongShen: '丁', xiShen: '甲', tiaoHou: '正月庚金，木旺金衰，用丁火炼之' },
  { yongShen: '丁', xiShen: '甲', tiaoHou: '二月庚金，用丁火炼金' },
  { yongShen: '丁', xiShen: '甲', tiaoHou: '三月庚金，土旺金相，用丁火' },
  { yongShen: '丁', xiShen: '壬', tiaoHou: '四月庚金，火旺金柔，用壬水制火' },
  { yongShen: '壬', xiShen: '丁', tiaoHou: '五月庚金，火旺用壬水为救' },
  { yongShen: '壬', xiShen: '丁', tiaoHou: '六月庚金，土旺用壬水' },
  { yongShen: '丁', xiShen: '甲', tiaoHou: '七月庚金，金旺用丁火炼之' },
  { yongShen: '丁', xiShen: '甲', tiaoHou: '八月庚金，金旺用丁火炼之，甲木引丁' },
  { yongShen: '甲', xiShen: '壬', tiaoHou: '九月庚金，土旺用甲木疏之' },
  { yongShen: '丁', xiShen: '丙', tiaoHou: '十月庚金，水旺金寒，用丁火暖之' },
  { yongShen: '丁', xiShen: '丙', tiaoHou: '十一月庚金，水旺金寒，用丁火丙火' },
  { yongShen: '丁', xiShen: '丙', tiaoHou: '十二月庚金，寒金用丁火丙火' },
];

// 辛金调候（日主=辛，索引7）
const XIN_TIAOHOU: TiaoHouInfo[] = [
  { yongShen: '壬', xiShen: '甲', tiaoHou: '正月辛金，用壬水淘洗' },
  { yongShen: '壬', xiShen: '甲', tiaoHou: '二月辛金，用壬水淘洗' },
  { yongShen: '壬', xiShen: '甲', tiaoHou: '三月辛金，土旺用壬水' },
  { yongShen: '壬', xiShen: '甲', tiaoHou: '四月辛金，火旺用壬水' },
  { yongShen: '壬', xiShen: '己', tiaoHou: '五月辛金，火旺用壬水为救' },
  { yongShen: '壬', xiShen: '己', tiaoHou: '六月辛金，土旺用壬水' },
  { yongShen: '壬', xiShen: '甲', tiaoHou: '七月辛金，金旺用壬水淘洗' },
  { yongShen: '壬', xiShen: '甲', tiaoHou: '八月辛金，金旺用壬水淘洗' },
  { yongShen: '壬', xiShen: '甲', tiaoHou: '九月辛金，土旺用壬水' },
  { yongShen: '壬', xiShen: '丙', tiaoHou: '十月辛金，水旺用壬水淘洗，丙火暖之' },
  { yongShen: '丙', xiShen: '壬', tiaoHou: '十一月辛金，寒金用丙火暖之' },
  { yongShen: '丙', xiShen: '壬', tiaoHou: '十二月辛金，寒金用丙火暖之' },
];

// 壬水调候（日主=壬，索引8）
const REN_TIAOHOU: TiaoHouInfo[] = [
  { yongShen: '戊', xiShen: '丙', tiaoHou: '正月壬水，水旺用戊土制之，丙火暖之' },
  { yongShen: '戊', xiShen: '辛', tiaoHou: '二月壬水，水弱用戊土，辛金发水源' },
  { yongShen: '甲', xiShen: '庚', tiaoHou: '三月壬水，土旺用甲木疏土' },
  { yongShen: '壬', xiShen: '甲', tiaoHou: '四月壬水，火旺水衰，用壬水助之' },
  { yongShen: '壬', xiShen: '庚', tiaoHou: '五月壬水，火旺水绝，用壬水庚金' },
  { yongShen: '壬', xiShen: '庚', tiaoHou: '六月壬水，土旺用壬水，庚金佐之' },
  { yongShen: '戊', xiShen: '丁', tiaoHou: '七月壬水，金旺水相，用戊土制之' },
  { yongShen: '甲', xiShen: '戊', tiaoHou: '八月壬水，金旺用甲木泄水' },
  { yongShen: '甲', xiShen: '戊', tiaoHou: '九月壬水，土旺用甲木疏之' },
  { yongShen: '戊', xiShen: '丙', tiaoHou: '十月壬水，水旺用戊土制之' },
  { yongShen: '戊', xiShen: '丙', tiaoHou: '十一月壬水，水旺用戊土丙火' },
  { yongShen: '丙', xiShen: '戊', tiaoHou: '十二月壬水，寒水用丙火暖之，戊土制之' },
];

// 癸水调候（日主=癸，索引9）
const GUI_TIAOHOU: TiaoHouInfo[] = [
  { yongShen: '辛', xiShen: '丙', tiaoHou: '正月癸水，用辛金发水源，丙火暖之' },
  { yongShen: '辛', xiShen: '丙', tiaoHou: '二月癸水，用辛金发水源' },
  { yongShen: '辛', xiShen: '丙', tiaoHou: '三月癸水，土旺用辛金' },
  { yongShen: '辛', xiShen: '甲', tiaoHou: '四月癸水，火旺水衰，用辛金发水源' },
  { yongShen: '辛', xiShen: '庚', tiaoHou: '五月癸水，火旺水绝，用辛金庚金' },
  { yongShen: '辛', xiShen: '庚', tiaoHou: '六月癸水，土旺用辛金发水源' },
  { yongShen: '辛', xiShen: '丙', tiaoHou: '七月癸水，金旺水相，用辛金' },
  { yongShen: '辛', xiShen: '丙', tiaoHou: '八月癸水，金旺用辛金' },
  { yongShen: '辛', xiShen: '甲', tiaoHou: '九月癸水，土旺用辛金甲木' },
  { yongShen: '辛', xiShen: '丙', tiaoHou: '十月癸水，水旺用辛金' },
  { yongShen: '丙', xiShen: '辛', tiaoHou: '十一月癸水，寒水用丙火暖之' },
  { yongShen: '丙', xiShen: '辛', tiaoHou: '十二月癸水，寒水用丙火暖之' },
];

// 汇总调候表：按天干索引（0=甲，1=乙，...，9=癸）
const TIAOHOU_TABLE: TiaoHouInfo[][] = [
  JIA_TIAOHOU, YI_TIAOHOU, BING_TIAOHOU, DING_TIAOHOU, WU_TIAOHOU,
  JI_TIAOHOU, GENG_TIAOHOU, XIN_TIAOHOU, REN_TIAOHOU, GUI_TIAOHOU,
];

// 获取调候用神
export function getTiaoHou(dayGan: string, monthZhiIndex: number): TiaoHouInfo | null {
  const ganIdx = TIANGAN.indexOf(dayGan);
  if (ganIdx < 0 || ganIdx > 9) return null;
  // monthZhiIndex: 2=寅月→对应索引0, 3=卯月→1, ..., 1=丑月→11
  const tiaoIdx = ((monthZhiIndex - 2 + 12) % 12);
  return TIAOHOU_TABLE[ganIdx][tiaoIdx] || null;
}

// 在 BaZiPaiPan 接口中新增调候字段
// 扩展格式化输出
export function formatPaiPanFull(result: BaZiPaiPan, currentYear?: number): string {
  let text = formatPaiPan(result);

  // ========== 1. 《滴天髓》旺衰判断 ==========
  const wangShuai = judgeWangShuai(result);
  text += '\n\n【旺衰判断】（出自《滴天髓》）\n';
  text += `${wangShuai.riZhuQiangRuo}\n`;
  text += `用神：${wangShuai.yongShen}\n`;
  text += `喜神：${wangShuai.xiShen}\n`;
  text += `忌神：${wangShuai.jiShen}\n`;
  text += `${wangShuai.lunDuan}\n`;

  // ========== 2. 《穷通宝鉴》调候用神 ==========
  const monthZhiIdx = DIZHI.indexOf(result.monthPillar.zhi);
  const tiaoHou = getTiaoHou(result.dayMaster, monthZhiIdx);
  if (tiaoHou) {
    text += '\n\n【调候用神】（出自《穷通宝鉴》）\n';
    text += `用神：${tiaoHou.yongShen}（${WUXING_GAN[tiaoHou.yongShen]}）\n`;
    text += `喜神：${tiaoHou.xiShen}（${WUXING_GAN[tiaoHou.xiShen]}）\n`;
    text += `《穷通宝鉴》原文：${tiaoHou.tiaoHou}\n`;

    const allGan = [result.yearPillar.gan, result.monthPillar.gan, result.dayPillar.gan, result.hourPillar.gan];
    const allCangGan = [...result.yearPillar.cangGan, ...result.monthPillar.cangGan, ...result.dayPillar.cangGan, ...result.hourPillar.cangGan];
    const yongInGan = allGan.includes(tiaoHou.yongShen);
    const yongInCang = allCangGan.includes(tiaoHou.yongShen);
    if (yongInGan) {
      text += `调候用神${tiaoHou.yongShen}透出天干，调候有力\n`;
    } else if (yongInCang) {
      text += `调候用神${tiaoHou.yongShen}藏于地支，调候稍弱\n`;
    } else {
      text += `调候用神${tiaoHou.yongShen}四柱不见，调候不足，需大运流年补之\n`;
    }
    text += `调候总评：${wangShuai.tiaoHouYongShen}\n`;
  }

  // ========== 3. 《渊海子平》十神论断 ==========
  text += '\n\n【十神论断】（出自《渊海子平》）\n';
  const shiShenList = [
    { pos: '年柱', name: result.yearPillar.shiShen },
    { pos: '月柱', name: result.monthPillar.shiShen },
    { pos: '时柱', name: result.hourPillar.shiShen },
  ];
  const processedShiShen = new Set<string>();
  for (const ss of shiShenList) {
    if (ss.name && !processedShiShen.has(ss.name)) {
      processedShiShen.add(ss.name);
      const lunDuan = getShiShenLunDuan(ss.name);
      if (lunDuan) {
        text += `\n【${ss.name}】（${ss.pos}透出）\n`;
        text += `阴阳：${lunDuan.yinYang}，生克：${lunDuan.shengKe}，本性：${lunDuan.benXing}\n`;
        text += `吉论：${lunDuan.jiLun}\n`;
        text += `凶论：${lunDuan.xiongLun}\n`;
        text += `用神提要：${lunDuan.yongShenTiao}\n`;
      }
    }
  }

  // ========== 4. 《子平真诠》格局论断 ==========
  text += '\n\n【格局论断】（出自《子平真诠》）\n';
  const geJuLunDuan = getGeJuLunDuan(result.geJu);
  if (geJuLunDuan) {
    text += `格局：${geJuLunDuan.name}\n`;
    text += `成格条件：${geJuLunDuan.chengFa}\n`;
    text += `败格条件：${geJuLunDuan.baiFa}\n`;
    text += `用神：${geJuLunDuan.yongShen}\n`;
    text += `喜神：${geJuLunDuan.xiShen}\n`;
    text += `忌神：${geJuLunDuan.jiShen}\n`;
    text += `综合论断：${geJuLunDuan.lunDuan}\n`;
  } else {
    text += `格局：${result.geJu}（特殊格局，需综合分析）\n`;
  }

  // ========== 5. 《三命通会》神煞论 ==========
  text += '\n\n【神煞论断】（出自《三命通会》）\n';
  const shenSha = calculateShenSha(result);
  if (shenSha.length > 0) {
    for (const ss of shenSha) {
      const info = getShenShaLunDuan(ss);
      if (info) {
        text += `\n【${info.name}】\n`;
        text += `查法：${info.find}\n`;
        text += `吉论：${info.jiLun}\n`;
        text += `凶论：${info.xiongLun}\n`;
      }
    }
  } else {
    text += '四柱未见明显神煞\n';
  }

  // ========== 6. 实战派具体预测（邓玄易贵人法+祥品君财运法） ==========
  text += formatShiZhanPrediction(result, currentYear);

  return text;
}

// ============================================================
// 实战派具体预测算法（邓玄易贵人法/祥品君财运法/郑穆德紫微法）
// ============================================================

// 地支→方位映射
const ZHI_FANGWEI: Record<string, string> = {
  '子': '正北', '丑': '东北偏北', '寅': '东北偏东',
  '卯': '正东', '辰': '东南偏东', '巳': '东南偏南',
  '午': '正南', '未': '西南偏南', '申': '西南偏西',
  '酉': '正西', '戌': '西北偏西', '亥': '西北偏北',
};

// 地支→属相映射
const ZHI_SHUXIANG: Record<string, string> = {
  '子': '鼠', '丑': '牛', '寅': '虎', '卯': '兔',
  '辰': '龙', '巳': '蛇', '午': '马', '未': '羊',
  '申': '猴', '酉': '鸡', '戌': '狗', '亥': '猪',
};

// 天乙贵人查表（日干→贵人生支）
const TIANYI_GUIREN_MAP: Record<string, string[]> = {
  '甲': ['丑', '未'], '戊': ['丑', '未'], '庚': ['丑', '未'],
  '乙': ['子', '申'], '己': ['子', '申'],
  '丙': ['亥', '酉'], '丁': ['亥', '酉'],
  '壬': ['卯', '巳'], '癸': ['卯', '巳'],
  '辛': ['午', '寅'],
};

// 文昌贵人查表
const WENCHANG_GUIREN_MAP: Record<string, string> = {
  '甲': '巳', '乙': '午', '丙': '申', '丁': '酉', '戊': '申',
  '己': '酉', '庚': '亥', '辛': '子', '壬': '寅', '癸': '卯',
};

// 天乙贵人来源推断（根据贵人地支在四柱中的位置）
function getGuiRenSource(zhi: string, pillars: { year: string; month: string; day: string; hour: string }): string {
  if (pillars.year.includes(zhi)) return '来自祖辈/长辈/远方';
  if (pillars.month.includes(zhi)) return '来自父母/兄弟/同辈';
  if (pillars.day.includes(zhi)) return '来自配偶/近亲';
  if (pillars.hour.includes(zhi)) return '来自下属/晚辈/子女';
  return '来自大运流年引动';
}

// 贵人帮助方向推断
function getGuiRenHelpType(dayGan: string, guirenZhi: string): string {
  const guirenWuXing: Record<string, string> = {
    '子': '水', '丑': '土', '寅': '木', '卯': '木',
    '辰': '土', '巳': '火', '午': '火', '未': '土',
    '申': '金', '酉': '金', '戌': '土', '亥': '水',
  };
  const dayWuXingMap: Record<string, string> = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
    '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水',
  };
  const dayWX = dayWuXingMap[dayGan] || '';
  const guirenWX = guirenWuXing[guirenZhi] || '';

  if (guirenWX === dayWX) return '人脉/社交/合作方面';
  // 五行生克关系
  const sheng: Record<string, string> = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  const ke: Record<string, string> = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };
  if (sheng[dayWX] === guirenWX) return '事业/学业/晋升方面（贵人泄你之力助你成长）';
  if (sheng[guirenWX] === dayWX) return '财运/资源/物质方面（贵人生你之力给你资源）';
  if (ke[dayWX] === guirenWX) return '事业突破/权力/管理方面（贵人克制你使你自律上进）';
  if (ke[guirenWX] === dayWX) return '技术/专业/创作方面（你克制贵人的领域）';
  return '综合方面';
}

// 流年流月引动贵人判断（精确到月）
function getGuiRenLiuNian(guirenZhi: string[], currentYear: number): { year: number; zhi: string; desc: string }[] {
  const zhiList = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  // 流月地支：正月寅→腊月丑（以节气换月为准）
  const liuYueZhi = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  const results: { year: number; zhi: string; desc: string }[] = [];
  // 检查当前年前后10年
  for (let offset = -2; offset <= 10; offset++) {
    const year = currentYear + offset;
    const zhiIdx = (year - 4) % 12;
    const zhi = zhiList[zhiIdx >= 0 ? zhiIdx : zhiIdx + 12];
    if (guirenZhi.includes(zhi)) {
      const shuXiang = ZHI_SHUXIANG[zhi];
      const fangWei = ZHI_FANGWEI[zhi];
      const tense = offset < 0 ? '已过' : offset === 0 ? '今年' : '将到';
      // 找出该年哪几个月（流月）也引动贵人
      const liuYueTrigger: string[] = [];
      for (let m = 0; m < 12; m++) {
        if (guirenZhi.includes(liuYueZhi[m])) {
          liuYueTrigger.push(`${m + 1}月（${liuYueZhi[m]}月）`);
        }
      }
      const monthHint = liuYueTrigger.length > 0
        ? `，关键月份：${liuYueTrigger.join('、')}`
        : '';
      results.push({
        year,
        zhi,
        desc: `${year}年（${tense}）属${shuXiang}年，贵人星引动，贵人方位在${fangWei}，注意${fangWei}方向来的人脉机遇${monthHint}`,
      });
    }
  }
  return results;
}

// 五行→行业映射（祥品君方法）
const WUXING_HANGYE: Record<string, string[]> = {
  '木': ['教育', '文化', '出版', '传媒', '服装', '家具', '花卉', '农业', '林业', '医药', '中医', '健康', '培训', '法律', '宗教'],
  '火': ['电子', '科技', '互联网', '电力', '能源', '餐饮', '美容', '影视', '娱乐', '广告', '照明', '化工', '军警', '光学', '通信'],
  '土': ['房地产', '建筑', '矿业', '农业', '仓储', '物流', '保险', '信托', '殡葬', '皮革', '水泥', '砖瓦', '古董', '咨询', '中介'],
  '金': ['金融', '银行', '证券', '投资', '机械', '汽车', '五金', '珠宝', '钟表', '外科', '武术', '公检法', '精密', '五金', '刀具'],
  '水': ['贸易', '运输', '航运', '渔业', '饮料', '酒类', '旅游', '清洁', '水利', '通讯', '公关', '外交', '营销', '策划', '信息'],
};

// 五行→有利方位
const WUXING_FANGWEI: Record<string, string> = {
  '木': '东方、东南方', '火': '南方', '土': '中部、东北、西南',
  '金': '西方、西北方', '水': '北方',
};

/**
 * 邓玄易贵人预测法
 * 输出：贵人方位、属相、出现时机、来源、帮助方向
 */
export function predictGuiRen(paiPanResult: BaZiPaiPan, currentYear?: number): string {
  const now = currentYear || new Date().getFullYear();
  const dayGan = paiPanResult.dayPillar.gan;
  const guirenZhi = TIANYI_GUIREN_MAP[dayGan] || [];
  const pillars = {
    year: paiPanResult.yearPillar.zhi,
    month: paiPanResult.monthPillar.zhi,
    day: paiPanResult.dayPillar.zhi,
    hour: paiPanResult.hourPillar.zhi,
  };
  const allZhi = [pillars.year, pillars.month, pillars.day, pillars.hour];

  let text = '\n\n【天乙贵人预测】（邓玄易贵人法 + 《三命通会》）\n';
  text += `日干：${dayGan} → 天乙贵人在${guirenZhi.map(z => ZHI_SHUXIANG[z] + '（' + z + '）').join('、')}\n\n`;

  // 判断贵人是否透出
  const touChu = guirenZhi.filter(z => allZhi.includes(z));
  if (touChu.length > 0) {
    text += `✅ 贵人星透出四柱：${touChu.map(z => ZHI_SHUXIANG[z] + '（' + z + '）').join('、')}\n`;
    for (const z of touChu) {
      text += `  - 属${ZHI_SHUXIANG[z]}的人是你的贵人，方位在${ZHI_FANGWEI[z]}\n`;
      text += `  - 来源：${getGuiRenSource(z, pillars)}\n`;
      text += `  - 帮助方向：${getGuiRenHelpType(dayGan, z)}\n`;
    }
  } else {
    text += `⚠️ 贵人星未透四柱，需等大运流年引动\n`;
    for (const z of guirenZhi) {
      text += `  - 属${ZHI_SHUXIANG[z]}的人是你的贵人，方位在${ZHI_FANGWEI[z]}\n`;
      text += `  - 帮助方向：${getGuiRenHelpType(dayGan, z)}\n`;
    }
  }

  // 文昌贵人
  const wenChangZhi = WENCHANG_GUIREN_MAP[dayGan];
  if (wenChangZhi) {
    text += `\n【文昌贵人】属${ZHI_SHUXIANG[wenChangZhi]}（${wenChangZhi}），方位${ZHI_FANGWEI[wenChangZhi]}\n`;
    text += `  - 学业/考试/文职的贵人，考试前可往${ZHI_FANGWEI[wenChangZhi]}方拜文昌\n`;
  }

  // 流年引动贵人
  text += `\n【贵人引动时机】\n`;
  const liuNianResults = getGuiRenLiuNian(guirenZhi, now);
  if (liuNianResults.length > 0) {
    for (const r of liuNianResults) {
      text += `  - ${r.desc}\n`;
    }
  } else {
    text += `  - 近期无贵人星直接引动，需看大运配合\n`;
  }

  return text;
}

/**
 * 祥品君财运+行业+方位预测法
 * 输出：有利行业、有利方位、财运流年
 */
export function predictCaiYun(paiPanResult: BaZiPaiPan, currentYear?: number): string {
  const now = currentYear || new Date().getFullYear();
  const dayGan = paiPanResult.dayPillar.gan;
  const dayWX = WUXING_GAN[dayGan];
  const allZhi = [paiPanResult.yearPillar.zhi, paiPanResult.monthPillar.zhi, paiPanResult.dayPillar.zhi, paiPanResult.hourPillar.zhi];
  const allGan = [paiPanResult.yearPillar.gan, paiPanResult.monthPillar.gan, paiPanResult.dayPillar.gan, paiPanResult.hourPillar.gan];

  // 日主所克的五行为正财/偏财
  const keMap: Record<string, string> = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };
  const caiWX = keMap[dayWX] || '土'; // 正偏财五行
  // 比劫五行（争夺财星）
  const biJieWX = dayWX;
  // 食伤五行（生财）
  const shengMap: Record<string, string> = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  const shiShangWX = shengMap[dayWX] || '火';
  // 印星五行（克食伤=断财源）
  const yinWXMap: Record<string, string> = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' };
  const yinWX = yinWXMap[dayWX] || '木';
  // 官杀五行
  const guanWX = keMap[dayWX] || '金';

  // 用神忌神判断
  const wangShuai = judgeWangShuai(paiPanResult);
  const isCaiYong = wangShuai.yongShen.includes('财星');
  const isCaiJi = wangShuai.jiShen.includes('财星');

  // 财星数量
  const caiGanCount = allGan.filter(g => WUXING_GAN[g] === caiWX).length;
  const caiZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === caiWX)).length;
  const caiTotal = caiGanCount + caiZhiCount;
  // 比劫数量
  const biJieGanCount = allGan.filter(g => WUXING_GAN[g] === biJieWX).length;
  const biJieZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === biJieWX)).length;
  const biJieTotal = biJieGanCount + biJieZhiCount;

  let text = '\n\n【财运+行业+方位预测】（祥品君实战法）\n';

  // ═══════ 铁律级规则检测 ═══════
  text += '\n【财运铁律级规则检测】\n';

  // 铁律一：身旺财旺=发财 vs 身弱财旺=为财所困
  const isStrong = wangShuai.riZhuQiangRuo.includes('旺') || wangShuai.riZhuQiangRuo.includes('偏旺');
  if (isStrong && caiTotal >= 2) {
    text += '✅ 铁律一【身旺财旺】：《滴天髓》"身旺能任财，财旺必发财"。日主旺+财星旺，如虎添翼，求财顺遂，财运亨通。\n';
  } else if (isStrong && caiTotal === 0) {
    text += '⚠️ 铁律一【身旺无财】：《滴天髓》"身旺无财，虽有志难伸"。日主旺但财星不显，有能力但缺财运，需等财星流年方有进财之机。\n';
  } else if (!isStrong && caiTotal >= 3) {
    text += '🚨 铁律一【身弱财旺】：《滴天髓》"财多身弱，反为财所困"。日主弱+财星太多，看到机会但抓不住，求财辛苦，为财奔波反受其累。须印比帮身方能担财。\n';
  } else if (!isStrong && caiTotal >= 1) {
    text += '⚠️ 铁律一【身弱财有】：日主偏弱但有财星，求财需量力而行，不宜贪大。行印比运时财运最佳。\n';
  } else {
    text += '🔄 铁律一【财星中性】：财星数量适中，财运看大运流年配合。\n';
  }

  // 铁律二：财星被劫=破财信号
  if (biJieTotal >= 3 && caiTotal <= 1) {
    text += '🚨 铁律二【比劫夺财】：《三命通会》"比劫争财，财必被夺"。比劫多（' + biJieTotal + '个）而财星少（' + caiTotal + '个），钱财易被他人分走，破财、投资失败、被人借钱不还。流年比劫旺时破财最凶。\n';
  } else if (biJieTotal >= 2 && caiTotal <= 1) {
    text += '⚠️ 铁律二【比劫扰财】：比劫较多而财星少，求财过程中有竞争者，合伙投资需谨慎，防被人截胡。\n';
  } else {
    text += '✅ 铁律二【财星不受劫】：比劫不夺财，钱财守得住，投资合伙风险小。\n';
  }

  // 铁律三：财库判断
  const caiKuMap: Record<string, string> = { '金': '丑', '木': '未', '水': '辰', '火': '戌', '土': '辰' };
  const caiKuZhi = caiKuMap[caiWX] || '辰';
  const hasCaiKu = allZhi.includes(caiKuZhi);
  const chongMap: Record<string, string> = {'子':'午','丑':'未','寅':'申','卯':'酉','辰':'戌','巳':'亥','午':'子','未':'丑','申':'寅','酉':'卯','戌':'辰','亥':'巳'};
  const caiKuChongFromYear = chongMap[paiPanResult.yearPillar.zhi] === caiKuZhi;
  const caiKuChongFromMonth = chongMap[paiPanResult.monthPillar.zhi] === caiKuZhi;
  if (hasCaiKu) {
    text += '✅ 铁律三【命带财库】：《子平真诠》"财入库，财不外泄"。命带财库（' + caiKuZhi + '），能存住钱，积蓄能力强。\n';
    if (caiKuChongFromYear || caiKuChongFromMonth) {
      text += '⚠️ 但财库被' + (caiKuChongFromYear ? '年支' : '月支') + '冲！《滴天髓》"财库逢冲，先得后失"。能赚钱但存不住，须防大额支出或投资亏损。\n';
    }
  } else {
    text += '⚠️ 铁律三【命无财库】：命局无财库（' + caiKuZhi + '），钱财进出频繁，理财需注意储蓄，不宜大手大脚。\n';
  }

  // 铁律四：食伤生财=财源广进
  const shiShangGanCount = allGan.filter(g => WUXING_GAN[g] === shiShangWX).length;
  const shiShangZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === shiShangWX)).length;
  const shiShangTotal = shiShangGanCount + shiShangZhiCount;
  if (shiShangTotal >= 2 && caiTotal >= 1) {
    text += '✅ 铁律四【食伤生财】：《穷通宝鉴》"食伤生财，富贵自来"。食伤旺+有财星，财源广进，适合靠才华、技术、创意赚钱。\n';
  } else if (shiShangTotal === 0 && caiTotal === 0) {
    text += '⚠️ 铁律四【食伤财星皆无】：命局食伤和财星都不显，财运需完全靠大运流年引动，不宜冒险投资。\n';
  } else {
    text += '🔄 铁律四【财运流通】：食伤与财星配合一般，财运有进有出，需行食伤运或财星运时财运最佳。\n';
  }

  // 铁律五：财星为用/忌判断
  if (isCaiYong) {
    text += '✅ 铁律五【财星为用神】：财星为命局用神！求财是命中正途，行财星运/食伤运时财运最旺。身弱者需行印比运帮身后方能担财。\n';
  } else if (isCaiJi) {
    text += '⚠️ 铁律五【财星为忌神】：财星为忌！求财反增烦恼。《滴天髓》"忌神旺则生灾"。财为忌时，贪财反被财累，不宜过度追求金钱，知足常乐方吉。\n';
  } else {
    text += '🔄 铁律五【财星中性】：财星非命局关键用忌，财运取决于大运流年配合。\n';
  }

  // 有利行业（日主五行适合的行业）
  text += `\n【适合你的行业】（日主${dayGan}${dayWX}行）\n`;
  const hangYe = WUXING_HANGYE[dayWX] || [];
  text += `  首选（本命行业）：${hangYe.slice(0, 5).join('、')}\n`;
  text += `  次选：${hangYe.slice(5, 10).join('、')}\n`;

  // 财运行业
  text += `\n【财运行业】（财星${caiWX}行）\n`;
  const caiHangYe = WUXING_HANGYE[caiWX] || [];
  text += `  直接赚钱的行业：${caiHangYe.slice(0, 5).join('、')}\n`;
  text += `  偏财行业：${caiHangYe.slice(5, 10).join('、')}\n`;

  // 有利方位
  text += `\n【有利方位】\n`;
  text += `  事业发展方位：${WUXING_FANGWEI[dayWX]}\n`;
  text += `  求财方位：${WUXING_FANGWEI[caiWX]}\n`;

  // 破财风险流年检测（铁律级）
  text += '\n【破财风险流年】\n';
  for (let i = -3; i <= 7; i++) {
    const year = now + i;
    const yearGanZhi = getYearGanZhi(year);
    const yearGanWX = WUXING_GAN[yearGanZhi.gan];
    const yearZhiWX = WUXING_ZHI[yearGanZhi.zhi];
    let label = '';
    let isRisk = false;

    // 破财信号一：比劫年夺财
    if (yearGanWX === biJieWX && caiTotal <= 1) {
      label = '🚨 比劫年夺财！《三命通会》"比劫运中财被劫"——此年钱财易被分走，不宜合伙/借贷/大额投资';
      isRisk = true;
    }
    // 破财信号二：财库被冲
    else if (hasCaiKu && chongMap[yearGanZhi.zhi] === caiKuZhi) {
      label = '🚨 财库被冲！《滴天髓》"财库逢冲，先得后失"——此年能赚但存不住，须防大额意外支出';
      isRisk = true;
    }
    // 破财信号三：印星克食伤（断财源）
    else if (yearGanWX === yinWX && shiShangTotal >= 1) {
      label = '⚠️ 印星克食伤年，财源受阻，赚钱渠道变窄，需开拓新路';
      isRisk = true;
    }
    // 破财信号四：官杀年+身弱=破财消灾
    else if (yearGanWX === guanWX && !isStrong) {
      label = '⚠️ 官杀年+身弱，可能因是非/法律/罚款破财，需谨慎';
      isRisk = true;
    }

    if (isRisk) {
      text += `  ${year}年（${yearGanZhi.gan}${yearGanZhi.zhi}）：${label}\n`;
    }
  }

  // 流年财运
  text += '\n【近十年财运流年】\n';
  const zhiList = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const liuYueZhi = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];

  for (let offset = 0; offset <= 10; offset++) {
    const year = now + offset;
    const zhiIdx = (year - 4) % 12;
    const zhi = zhiList[zhiIdx >= 0 ? zhiIdx : zhiIdx + 12];
    const yearWX = WUXING_ZHI[zhi] || '土';

    let label = '';
    if (yearWX === caiWX) {
      if (isCaiJi) {
        label = '💰 财星年（为忌），求财反增烦恼，不宜贪大';
      } else {
        label = '💰 财星年，财运亨通，适合投资';
      }
    } else if (yearWX === biJieWX) {
      label = '💪 比劫年，竞争大但人脉旺';
    } else if (yearWX === yinWX) {
      label = '📚 印星年，学习进修好，有贵人';
    } else if (yearWX === guanWX) {
      label = '⚖️ 官杀年，事业压力但可能晋升';
    } else if (shengMap[yearWX] === dayWX) {
      label = '🍽️ 食伤年，才华展现，适合创业';
    } else {
      label = '🔄 平稳年';
    }

    // 找出该年财运最旺的月份
    const caiMonths: string[] = [];
    for (let m = 0; m < 12; m++) {
      const mWX = WUXING_ZHI[liuYueZhi[m]] || '土';
      if (mWX === caiWX) caiMonths.push(`${m + 1}月（${liuYueZhi[m]}月）`);
    }
    const monthHint = caiMonths.length > 0 ? `，求财旺月：${caiMonths.join('、')}` : '';

    text += `  ${year}年（属${ZHI_SHUXIANG[zhi]}）${label}${monthHint}\n`;
  }

  // 财运恢复期判断
  text += '\n【财运恢复期判断】\n';
  const poCaiYears: number[] = [];
  for (let i = -10; i <= 0; i++) {
    const year = now + i;
    const yearGZ = getYearGanZhi(year);
    if (WUXING_GAN[yearGZ.gan] === biJieWX && caiTotal <= 1) {
      poCaiYears.push(year);
    }
  }
  if (poCaiYears.length === 0) {
    text += '  近年无比劫夺财信号，财运运势平稳。\n';
  } else {
    text += `  比劫夺财年份：${poCaiYears.join('、')}\n`;
    // 找未来食伤生财/财星流年=恢复之机
    for (let i = 1; i <= 5; i++) {
      const year = now + i;
      const yearGZ = getYearGanZhi(year);
      const yearGanWX = WUXING_GAN[yearGZ.gan];
      if (yearGanWX === caiWX || yearGanWX === shiShangWX) {
        text += `  ✅ ${year}年（${yearGZ.gan}${yearGZ.zhi}）${yearGanWX === caiWX ? '财星年' : '食伤生财年'}，财运恢复之机，适合投资/创业/加薪。\n`;
        break;
      }
    }
  }

  return text;
}

// ============ 事业预测算法 ============
// 依据：《八字事业预测学》《滴天髓》《子平真诠》
// 官杀=事业/权力，食伤=才华/技术，印星=学历/贵人
// 铁律级规则：官星受伤=事业受阻、食伤生财=适合技术创业、印星为用=适合学术、格局成格+大运配合=事业亨通

/** 事业预测（含铁律级规则判断） */
export function predictShiYe(paiPan: BaZiPaiPan, currentYear?: number): string {
  const now = currentYear || new Date().getFullYear();
  const dayGan = paiPan.dayPillar.gan;
  const dayWX = WUXING_GAN[dayGan];
  const allZhi = [paiPan.yearPillar.zhi, paiPan.monthPillar.zhi, paiPan.dayPillar.zhi, paiPan.hourPillar.zhi];
  const allGan = [paiPan.yearPillar.gan, paiPan.monthPillar.gan, paiPan.dayPillar.gan, paiPan.hourPillar.gan];

  // 十神五行
  const caiWXMap: Record<string, string> = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };
  const guanWXMap: Record<string, string> = { '木': '金', '火': '水', '土': '木', '金': '火', '水': '土' };
  const shiShangWXMap: Record<string, string> = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  const yinWXMap: Record<string, string> = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' };
  const guanWX = guanWXMap[dayWX] || '金';
  const caiWX = caiWXMap[dayWX] || '土';
  const shiShangWX = shiShangWXMap[dayWX] || '火';
  const yinWX = yinWXMap[dayWX] || '木';
  const biJieWX = dayWX;

  // 用神忌神判断
  const wangShuai = judgeWangShuai(paiPan);
  const isStrong = wangShuai.riZhuQiangRuo.includes('旺') || wangShuai.riZhuQiangRuo.includes('偏旺');

  // 官星数量
  const guanGanCount = allGan.filter(g => WUXING_GAN[g] === guanWX).length;
  const guanZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === guanWX)).length;
  const guanTotal = guanGanCount + guanZhiCount;
  // 食伤数量
  const shiShangGanCount = allGan.filter(g => WUXING_GAN[g] === shiShangWX).length;
  const shiShangZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === shiShangWX)).length;
  const shiShangTotal = shiShangGanCount + shiShangZhiCount;
  // 印星数量
  const yinGanCount = allGan.filter(g => WUXING_GAN[g] === yinWX).length;
  const yinZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === yinWX)).length;
  const yinTotal = yinGanCount + yinZhiCount;
  // 比劫数量
  const biJieGanCount = allGan.filter(g => WUXING_GAN[g] === biJieWX).length;
  const biJieZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === biJieWX)).length;
  const biJieTotal = biJieGanCount + biJieZhiCount;
  // 财星数量
  const caiGanCount = allGan.filter(g => WUXING_GAN[g] === caiWX).length;
  const caiZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === caiWX)).length;
  const caiTotal = caiGanCount + caiZhiCount;

  // 六冲表
  const chongMap: Record<string, string> = {'子':'午','丑':'未','寅':'申','卯':'酉','辰':'戌','巳':'亥','午':'子','未':'丑','申':'寅','酉':'卯','戌':'辰','亥':'巳'};

  let text = '\n\n===== 事业预测 =====\n';

  // ═══════ 铁律级规则检测 ═══════
  text += '【事业铁律级规则检测】\n';

  // 铁律一：官杀为用=事业有成，官杀为忌=事业压力
  const isGuanYong = wangShuai.yongShen.includes('官杀');
  const isGuanJi = wangShuai.jiShen.includes('官杀');
  if (isGuanYong && guanTotal >= 1) {
    text += '✅ 铁律一【官杀为用得力】：《滴天髓》"官星为用，主权柄富贵"。官杀为用神且命局有官杀，事业运极佳，有掌权之机，适合从政/管理/体制内发展。\n';
  } else if (isGuanYong && guanTotal === 0) {
    text += '⚠️ 铁律一【官杀为用但不显】：官杀为用神但命局不显，事业需待大运流年引动官星方有升迁之机。\n';
  } else if (isGuanJi && guanTotal >= 2) {
    text += '🚨 铁律一【官杀为忌且旺】：《滴天髓》"官杀为忌，反为官鬼"。官杀为忌且旺，事业压力大、上司打压、是非纠纷多，不适合体制内，宜自主创业或技术路线。\n';
  } else if (isGuanJi) {
    text += '⚠️ 铁律一【官杀为忌】：官杀为忌，事业压力偏大，选择自由度高的职业更佳。\n';
  } else {
    text += '🔄 铁律一【官杀中性】：官杀非命局关键用忌，事业看大运配合。\n';
  }

  // 铁律二：食伤生财=适合技术创业
  if (shiShangTotal >= 2 && caiTotal >= 1) {
    text += '✅ 铁律二【食伤生财】：《穷通宝鉴》"食伤生财，富贵自来"。命局食伤旺+有财星，适合靠才华、技术、创意创业，不需要依赖体制，凭本事吃饭。\n';
  } else if (shiShangTotal >= 2 && caiTotal === 0) {
    text += '⚠️ 铁律二【食伤旺但无财星】：有才华但缺乏变现渠道，需行财运或找合伙人互补。\n';
  } else {
    text += '🔄 铁律二【食伤财星配合一般】：技术创业运势一般，适合稳步发展。\n';
  }

  // 铁律三：印星为用=适合学术/教育/文职，印星为忌=不宜学术路线
  const isYinYong = wangShuai.yongShen.includes('印星');
  const isYinJi_shiye = wangShuai.jiShen.includes('印星');
  if (isYinJi_shiye) {
    text += '⚠️ 铁律三【印星为忌】：《滴天髓》"旺极宜泄不宜帮"。印星为忌，身旺不宜再帮，学术/教育非优先路线，越学越焦虑，宜走食伤生财/官杀制身的路线。\n';
  } else if (isYinYong && yinTotal >= 1) {
    text += '✅ 铁律三【印星为用得力】：《子平真诠》"印星为用，主学术文贵"。印星为用且得力，适合学术、教育、文职、科研等需要深厚学识的职业，越老越吃香。\n';
  } else if (isYinYong && yinTotal === 0) {
    text += '⚠️ 铁律三【印星为用但不显】：适合学术路线但命局印星不显，需后天努力补足学历。\n';
  } else {
    text += '🔄 铁律三【印星中性】：学术/教育非最优先路线，可作副线发展。\n';
  }

  // 铁律四：官星受伤=事业受阻
  if (guanTotal >= 1 && shiShangTotal >= 2) {
    text += '🚨 铁律四【伤官克官】：《子平真诠》"伤官见官，为祸百端"。命局食伤旺克官杀，事业容易受阻、频繁跳槽、与上司不合。宜选自由度高的职业，避免体制内。\n';
  } else if (guanTotal >= 1 && biJieTotal >= 3) {
    text += '⚠️ 铁律四【比劫争官】：比劫多争夺官杀，职场竞争激烈，升迁可能被截胡，需提升核心竞争力。\n';
  } else if (guanTotal === 0 && shiShangTotal === 0) {
    text += '⚠️ 铁律四【官杀食伤皆无】：命局官杀和食伤都不显，事业方向不明，需通过大运找到定位。\n';
  } else {
    text += '✅ 铁律四【事业星不受克】：官杀不受食伤克，事业稳定，升迁有望。\n';
  }

  // 铁律五：身旺能担官杀 vs 身弱怕官杀
  if (isStrong && guanTotal >= 1) {
    text += '✅ 铁律五【身旺能担官杀】：《滴天髓》"身旺能任官，官旺主升迁"。身旺+有官杀，能扛起事业压力，适合管理/领导岗，越忙越旺。\n';
  } else if (!isStrong && guanTotal >= 2) {
    text += '⚠️ 铁律五【身弱官杀重】：《滴天髓》"身弱官杀重，反被官压"。身弱+官杀多，事业压力太大反被压垮，不宜承担过重职务，需印比帮身。\n';
  } else {
    text += '🔄 铁律五【身官平衡】：身与官杀力量相当，事业能扛但有压力，属于正常状态。\n';
  }

  // 事业适合方向综合判断
  text += '【事业方向综合判断】\n';
  if (isGuanYong && guanTotal >= 1 && isStrong) {
    text += '  🏛️ 最佳方向：体制内/管理/从政——官杀为用+身旺能担，天生领导命\n';
  } else if (shiShangTotal >= 2 && caiTotal >= 1) {
    text += '  💡 最佳方向：技术创业/自由职业/创意产业——食伤生财，凭本事吃饭\n';
  } else if (isYinYong && yinTotal >= 1) {
    text += '  📚 最佳方向：学术/教育/研究/文职——印星为用，越老越吃香\n';
  } else if (caiTotal >= 2 && isStrong) {
    text += '  💰 最佳方向：商业/投资/贸易——身旺财旺，经商有道\n';
  } else {
    text += '  🔄 综合方向：根据大运选择时机，身旺时求财求官，身弱时学习蓄力\n';
  }

  // 事业变动流年检测
  text += '【事业变动流年】\n';
  for (let i = -3; i <= 7; i++) {
    const year = now + i;
    const yearGanZhi = getYearGanZhi(year);
    const yearGanWX = WUXING_GAN[yearGanZhi.gan];
    let label = '';
    let isChange = false;

    // 升迁信号：官杀年+身旺
    if (yearGanWX === guanWX && isStrong) {
      label = '⚖️ 官杀年+身旺！此年有升迁/掌权/被提拔之机';
      isChange = true;
    }
    // 事业受阻：食伤年克官杀
    else if (yearGanWX === shiShangWX && guanTotal >= 1 && !isStrong) {
      label = '⚠️ 食伤克官年，事业可能受阻/跳槽/与上司不合';
      isChange = true;
    }
    // 创业良机：食伤年+有财星
    else if (yearGanWX === shiShangWX && caiTotal >= 1) {
      label = '💡 食伤年+有财星，适合启动创业/推出新项目';
      isChange = true;
    }
    // 贵人助力/印星为忌：印星年
    else if (yearGanWX === yinWX) {
      if (isYinJi_shiye) {
        label = '⚠️ 印星年为忌！身旺不宜再帮，此年事业多阻碍、想法多行动少、贵人反成拖累';
      } else {
        label = '📚 印星年，有贵人提携/学习进修/获得资质';
      }
      isChange = true;
    }

    if (isChange) {
      text += `  ${year}年（${yearGanZhi.gan}${yearGanZhi.zhi}）：${label}\n`;
    }
  }

  return text;
}

// ============ 健康预测算法 ============
// 依据：《黄帝内经》《八字与健康》《滴天髓》五行论
// 五行对应脏腑：木=肝胆，火=心小肠，土=脾胃，金=肺大肠，水=肾膀胱
// 铁律级规则：五行受克对应脏腑有灾、用神被克=对应部位有灾、忌神大运=对应系统易病

/** 五行对应脏腑映射 */
const WUXING_ZANGFU: Record<string, { zang: string; fu: string; xiGuan: string }> = {
  '木': { zang: '肝', fu: '胆', xiGuan: '眼睛、筋骨、情绪' },
  '火': { zang: '心', fu: '小肠', xiGuan: '血脉、舌、神志' },
  '土': { zang: '脾', fu: '胃', xiGuan: '肌肉、口唇、消化' },
  '金': { zang: '肺', fu: '大肠', xiGuan: '皮肤、鼻、呼吸' },
  '水': { zang: '肾', fu: '膀胱', xiGuan: '骨骼、耳、生殖' },
};

/** 克的五行映射 */
const KE_MAP: Record<string, string> = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };

/** 健康预测（含铁律级规则判断） */
export function predictJianKang(paiPan: BaZiPaiPan, currentYear?: number): string {
  const now = currentYear || new Date().getFullYear();
  const dayGan = paiPan.dayPillar.gan;
  const dayWX = WUXING_GAN[dayGan];
  const wuXing = paiPan.wuXingCount;

  // 用神忌神判断
  const wangShuai = judgeWangShuai(paiPan);
  const isStrong = wangShuai.riZhuQiangRuo.includes('旺') || wangShuai.riZhuQiangRuo.includes('偏旺');

  let text = '\n\n===== 健康预测 =====\n';

  // ═══════ 铁律级规则检测 ═══════
  text += '【健康铁律级规则检测】\n';

  // 铁律一：五行受克对应脏腑有灾
  // 找出命局中最弱和最旺的五行
  const wxEntries = Object.entries(wuXing) as [string, number][];
  const totalWX = wxEntries.reduce((a, b) => a + b[1], 0) || 1;
  const wxSorted = wxEntries.sort((a, b) => a[1] - b[1]);
  const weakestWX = wxSorted[0][0]; // 最弱五行
  const weakestCount = wxSorted[0][1];
  const strongestWX = wxSorted[wxSorted.length - 1][0]; // 最旺五行
  const strongestCount = wxSorted[wxSorted.length - 1][1];

  // 最弱五行被克→对应脏腑最易出问题
  const keWeakestWX = KE_MAP[weakestWX] ? Object.entries(KE_MAP).filter(([k, v]) => v === weakestWX).map(([k]) => k)[0] : '';
  if (weakestCount === 0) {
    const zf = WUXING_ZANGFU[weakestWX];
    if (zf) {
      text += '🚨 铁律一【五行缺失】：《黄帝内经》五行缺' + weakestWX + '！' + zf.zang + '(' + zf.fu + ')系统先天薄弱，' + zf.xiGuan + '最易出问题。须后天重点保养，定期检查。\n';
    }
  } else if (weakestCount <= totalWX * 0.1) {
    const zf = WUXING_ZANGFU[weakestWX];
    if (zf) {
      text += '⚠️ 铁律一【五行极弱】：' + weakestWX + '行极弱（仅' + weakestCount + '个），' + zf.zang + '(' + zf.fu + ')系统偏弱，' + zf.xiGuan + '需注意保养。\n';
    }
  } else {
    text += '✅ 铁律一【五行无严重缺失】：命局五行分布相对均衡，无特别薄弱的脏腑系统。\n';
  }

  // 铁律二：最旺五行克最弱五行=对应脏腑相克冲突
  if (KE_MAP[strongestWX] === weakestWX) {
    const strongZF = WUXING_ZANGFU[strongestWX];
    const weakZF = WUXING_ZANGFU[weakestWX];
    if (strongZF && weakZF) {
      text += '🚨 铁律二【五行相克冲突】：' + strongestWX + '(' + strongZF.zang + ')极旺克' + weakestWX + '(' + weakZF.zang + ')极弱！《黄帝内经》"亢则害，承乃制"。' + strongZF.zang + '火旺反克' + weakZF.zang + '，' + weakZF.xiGuan + '最易出问题。这是命局最大的健康隐患。\n';
    }
  } else if (weakestCount > 0) {
    text += '✅ 铁律二【无严重五行冲突】：最旺与最弱五行无直接克制关系，脏腑冲突不严重。\n';
  }

  // 铁律三：用神被克=对应部位有灾
  // 从用神中提取五行
  const yongShenText = wangShuai.yongShen;
  const yongShenWXList: string[] = [];
  if (yongShenText.includes('官杀')) yongShenWXList.push(KE_MAP[dayWX] ? Object.entries(KE_MAP).filter(([k, v]) => v === dayWX).map(([k]) => k)[0] : '');
  if (yongShenText.includes('财星')) yongShenWXList.push(KE_MAP[dayWX] || '');
  if (yongShenText.includes('印星')) {
    const shengWXMap: Record<string, string> = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' };
    yongShenWXList.push(shengWXMap[dayWX] || '');
  }
  if (yongShenText.includes('食伤')) {
    const woShengWXMap: Record<string, string> = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
    yongShenWXList.push(woShengWXMap[dayWX] || '');
  }
  if (yongShenText.includes('比劫')) yongShenWXList.push(dayWX);

  // 找出用神五行中最弱的
  let yongShenWeakWX = '';
  for (const wx of yongShenWXList) {
    if (wx && (wuXing[wx as keyof WuXingCount] || 0) <= totalWX * 0.15) {
      yongShenWeakWX = wx;
      break;
    }
  }
  if (yongShenWeakWX) {
    const zf = WUXING_ZANGFU[yongShenWeakWX];
    if (zf) {
      text += '⚠️ 铁律三【用神五行偏弱】：用神' + yongShenWeakWX + '行偏弱，《滴天髓》"用神受伤，对应部位有灾"。' + zf.zang + '(' + zf.fu + ')系统是用神所在，偏弱时' + zf.xiGuan + '容易出问题。大运流年克制' + yongShenWeakWX + '行时，健康尤需注意。\n';
    }
  } else {
    text += '✅ 铁律三【用神五行不弱】：用神对应五行力量适中，健康隐患不大。\n';
  }

  // 铁律四：忌神大运到来=对应系统易病
  // 提取忌神五行
  const jiShenText = wangShuai.jiShen;
  const jiShenWXList: string[] = [];
  if (jiShenText.includes('官杀')) jiShenWXList.push(KE_MAP[dayWX] ? Object.entries(KE_MAP).filter(([k, v]) => v === dayWX).map(([k]) => k)[0] : '');
  if (jiShenText.includes('财星')) jiShenWXList.push(KE_MAP[dayWX] || '');
  if (jiShenText.includes('印星')) {
    const shengWXMap: Record<string, string> = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' };
    jiShenWXList.push(shengWXMap[dayWX] || '');
  }
  if (jiShenText.includes('比劫')) jiShenWXList.push(dayWX);
  if (jiShenText.includes('食伤')) {
    const woShengWXMap: Record<string, string> = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
    jiShenWXList.push(woShengWXMap[dayWX] || '');
  }

  let jiShenWXStr = jiShenWXList.filter(Boolean).join('、');
  if (jiShenWXStr) {
    text += '⚠️ 铁律四【忌神五行预警】：忌神五行为' + jiShenWXStr + '。《滴天髓》"忌神旺则生灾"。大运行忌神五行运时，对应脏腑系统易出问题。须提前预防，注意体检。\n';
    for (const wx of jiShenWXList) {
      if (wx) {
        const zf = WUXING_ZANGFU[wx];
        if (zf) {
          text += '  - 忌神' + wx + '行→' + zf.zang + '(' + zf.fu + ')系统，' + zf.xiGuan + '需重点防护\n';
        }
      }
    }
  } else {
    text += '✅ 铁律四【忌神不显】：忌神不明确，健康运势看大运流年配合。\n';
  }

  // 铁律五：日主五行对应脏腑=先天体质
  const dayZF = WUXING_ZANGFU[dayWX];
  if (dayZF) {
    text += '✅ 铁律五【先天体质】：日干' + dayGan + '(' + dayWX + '行)，先天体质与' + dayZF.zang + '(' + dayZF.fu + ')系统相关。' + dayZF.xiGuan + '是体质敏感部位。\n';
  }

  // 健康风险流年检测
  text += '【健康风险流年】\n';
  const allZhi = [paiPan.yearPillar.zhi, paiPan.monthPillar.zhi, paiPan.dayPillar.zhi, paiPan.hourPillar.zhi];
  for (let i = -3; i <= 7; i++) {
    const year = now + i;
    const yearGanZhi = getYearGanZhi(year);
    const yearGanWX = WUXING_GAN[yearGanZhi.gan];
    let label = '';
    let isRisk = false;

    // 健康风险：流年天干克用神五行
    for (const ywx of yongShenWXList) {
      if (ywx && KE_MAP[yearGanWX] === ywx) {
        const zf = WUXING_ZANGFU[ywx];
        label = '⚠️ 流年克用神' + ywx + '行！' + (zf ? zf.zang + '(' + zf.fu + ')系统' : '对应部位') + '此年易出问题，须注意体检和保养';
        isRisk = true;
        break;
      }
    }

    // 健康风险：流年与日支冲（身体根基动摇）
    if (!isRisk) {
      const chongMap: Record<string, string> = {'子':'午','丑':'未','寅':'申','卯':'酉','辰':'戌','巳':'亥','午':'子','未':'丑','申':'寅','酉':'卯','戌':'辰','亥':'巳'};
      if (chongMap[yearGanZhi.zhi] === allZhi[2]) {
        label = '⚠️ 流年冲日支，身体根基动摇，此年须防意外/手术/住院';
        isRisk = true;
      }
    }

    if (isRisk) {
      text += `  ${year}年（${yearGanZhi.gan}${yearGanZhi.zhi}）：${label}\n`;
    }
  }

  // 五行养生建议
  text += '【五行养生建议】\n';
  // 最弱五行→需补
  const wzf = WUXING_ZANGFU[weakestWX];
  if (wzf) {
    const yangShengMap: Record<string, string> = {
      '木': '疏肝理气，避免熬夜生气，多食绿色蔬菜，春季养肝',
      '火': '养心安神，避免过度兴奋，多食红色食物，夏季养心',
      '土': '健脾养胃，饮食规律忌生冷，多食黄色食物，长夏养脾',
      '金': '润肺防燥，避免吸烟空气污染，多食白色食物，秋季养肺',
      '水': '补肾固元，避免过度劳累恐惧，多食黑色食物，冬季养肾',
    };
    text += '  最弱' + weakestWX + '行（' + wzf.zang + '/' + wzf.fu + '）：' + (yangShengMap[weakestWX] || '') + '\n';
  }
  // 最旺五行→需泄
  const szf = WUXING_ZANGFU[strongestWX];
  if (szf) {
    text += '  最旺' + strongestWX + '行（' + szf.zang + '/' + szf.fu + '）：避免过度刺激此系统，保持平衡为宜\n';
  }

  return text;
}

/**
 * 完整实战预测输出（贵人+财运+事业+健康+学业+婚姻+六亲）
 */
export function formatShiZhanPrediction(paiPanResult: BaZiPaiPan, currentYear?: number): string {
  let text = '===== 实战派具体预测 =====';
  text += predictGuiRen(paiPanResult, currentYear);
  text += predictCaiYun(paiPanResult, currentYear);
  text += predictShiYe(paiPanResult, currentYear);
  text += predictJianKang(paiPanResult, currentYear);
  text += predictXueYe(paiPanResult, currentYear);
  text += predictHunYin(paiPanResult, currentYear);
  text += predictLiuQin(paiPanResult, currentYear);
  return text;
}

// ============ 学业预测算法 ============
// 依据：《八字学业预测学》《子平命理学业》《滴天髓学业篇》
// 印星=学业星，食伤=才华星，官杀=考试压力

/** 印星地支查表（以日干查四柱地支藏干中的印星） */
function getYinXingZhi(dayGan: string): string[] {
  const yinMap: Record<string, string[]> = {
    '甲': ['子'], '乙': ['亥'], '丙': ['卯'], '丁': ['寅'],
    '戊': ['午'], '己': ['巳'], '庚': ['丑','辰','未','戌'],
    '辛': ['丑','辰','未','戌'], '壬': ['申','酉'], '癸': ['申','酉'],
  };
  return yinMap[dayGan] || [];
}

/** 文昌贵人查表（日干→地支） */
const WEN_CHANG: Record<string, string> = {
  '甲': '巳', '乙': '午', '丙': '申', '丁': '酉',
  '戊': '申', '己': '酉', '庚': '亥', '辛': '子',
  '壬': '寅', '癸': '卯',
};

/** 学业预测 */
export function predictXueYe(paiPan: BaZiPaiPan, currentYear?: number): string {
  const now = currentYear || new Date().getFullYear();
  const dayGan = paiPan.dayPillar.gan;
  const dayWX = WUXING_GAN[dayGan];
  // 印星五行
  const yinWXMap: Record<string, string> = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' };
  const yinWX = yinWXMap[dayWX] || '木';
  // 食伤五行
  const shiShangWXMap: Record<string, string> = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  const shiShangWX = shiShangWXMap[dayWX] || '火';
  // 用神忌神判断
  const wangShuai = judgeWangShuai(paiPan);
  const isYinJi = wangShuai.jiShen.includes('印星'); // 印星为忌（身旺时印多为忌）
  const isYinYong = wangShuai.yongShen.includes('印星'); // 印星为用（身弱时需印帮）

  // 四柱中有无印星、文昌
  const allZhi = [paiPan.yearPillar.zhi, paiPan.monthPillar.zhi, paiPan.dayPillar.zhi, paiPan.hourPillar.zhi];
  const allGan = [paiPan.yearPillar.gan, paiPan.monthPillar.gan, paiPan.dayPillar.gan, paiPan.hourPillar.gan];
  const yinZhiSet = new Set(getYinXingZhi(dayGan));
  const hasYinXing = allZhi.some(z => yinZhiSet.has(z)) || allGan.some(g => WUXING_GAN[g] === yinWX);
  const wenChangZhi = WEN_CHANG[dayGan];
  const hasWenChang = allZhi.includes(wenChangZhi);

  let text = '\n\n===== 学业预测 =====\n';
  text += `【学业星分析】日干${dayGan}(${dayWX})，印星=${yinWX}，食伤=${shiShangWX}\n`;
  text += hasYinXing
    ? (isYinJi
      ? '⚠️ 命局带印星，但印星为忌（身旺印多为忌），学业容易分心、想学但学不进去，需行财官食伤运方利学业\n'
      : '✅ 命局带印星且为用，学习根基深厚，利于学术深造\n')
    : (isYinYong
      ? '⚠️ 命局印星不显且为用神，需大运流年引动印星方利学业\n'
      : '⚠️ 命局印星不显，需靠后天努力补足\n');
  text += hasWenChang ? `✅ 命带文昌贵人（${wenChangZhi}），利考试、利文职\n` : '⚠️ 文昌不显，考试运需靠流年引动\n';

  // 《八字学业预测学》论断
  text += '【学业经典论断】\n';
  if (isYinJi) {
    text += '《滴天髓》：旺极宜泄不宜帮！身旺印多为忌，印星反而成为学业阻碍——想学但学不进去，注意力分散，印旺之年更甚。须行财官食伤运方利学业。\n';
  } else if (hasYinXing && hasWenChang) {
    text += '《子平命理学业》：印星得力+文昌入命，学业有成，可考名校。印星代表记忆力、理解力，文昌代表考试运、文采。\n';
  } else if (hasYinXing) {
    text += '《八字学业预测学》：印星为用，根基好但需把握考试时机。大运走印运时，学业最顺。\n';
  } else {
    text += '《滴天髓》：印星不显，需行印运方发。流年遇印星时，学业有突破。\n';
  }

  // 学业转折流年（未来5年）
  text += '【学业转折流年】\n';
  for (let i = 0; i <= 5; i++) {
    const year = now + i;
    const yearGanZhi = getYearGanZhi(year);
    const yearGan = yearGanZhi.gan;
    const yearWX = WUXING_GAN[yearGan];
    let label = '';
    // 先判断负向信号（财克印/冲印星）
    const caiWXMap3: Record<string, string> = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };
    const caiWX3 = caiWXMap3[dayWX] || '水';
    const chongMap3: Record<string, string> = {'子':'午','丑':'未','寅':'申','卯':'酉','辰':'戌','巳':'亥','午':'子','未':'丑','申':'寅','酉':'卯','戌':'辰','亥':'巳'};
    const yinZhiArr3 = getYinXingZhi(dayGan);
    const isCaiKeYin = yearWX === caiWX3;
    let isChongYin = false;
    for (const yz of yinZhiArr3) {
      if (chongMap3[yearGanZhi.zhi] === yz && allZhi.includes(yz)) isChongYin = true;
    }

    if (isCaiKeYin && hasYinXing) label = '🚨 财克印！学业严重受阻，极可能休学/退学/中断';
    else if (isChongYin) label = '⚠️ 冲印星，学业根基动摇，成绩大幅波动';
    else if (yearWX === yinWX) {
      if (isYinJi) {
        // 印星为忌：印星年不是好事，反而加重"想学但学不进去"
        // 检查前几年是否有连续财克印（休学后恢复期判断）
        let prevCaiKeYinYears = 0;
        for (let k = 1; k <= 3; k++) {
          const prevYear = year - k;
          const prevGZ = getYearGanZhi(prevYear);
          if (WUXING_GAN[prevGZ.gan] === caiWX3 && hasYinXing) prevCaiKeYinYears++;
        }
        if (prevCaiKeYinYears >= 2) {
          label = '🔄 印星年为忌+连续财克印后恢复期：有复学念头但难以真正回去，只是想想而已';
        } else if (prevCaiKeYinYears >= 1) {
          label = '🔄 印星年为忌+财克印后：可能想恢复学业，但行动力不足，需比劫帮身或食伤泄秀才行';
        } else {
          label = '⚠️ 印星年为忌！想学但学不进去，注意力不集中，印多为患反增焦虑';
        }
      } else {
        label = '📚 印星年！学业最旺，考试大利，适合升学/考证';
      }
    }
    else if (yearWX === shiShangWX) label = '🎨 食伤年，才华横溢，利创作/竞赛，但考试需防粗心';
    else if (WUXING_ZHI[yearGanZhi.zhi] === yinWX) label = '📚 印星地支年，学业暗中助力';
    else if (yearGanZhi.zhi === wenChangZhi) label = '✨ 文昌引动年！考试运极佳，逢考必过';
    else {
      // 看流月
      const yinMonths: string[] = [];
      const LIU_YUE_ZHI = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
      for (let m = 0; m < 12; m++) {
        if (WUXING_ZHI[LIU_YUE_ZHI[m]] === yinWX) yinMonths.push(`${m + 1}月`);
      }
      if (yinMonths.length > 0) label = `🔄 平年，印星旺月：${yinMonths.join('、')}，可重点冲刺`;
      else label = '🔄 平年';
    }
    text += `  ${year}年：${label}\n`;
  }

  // 休学风险判断——三大经典信号
  text += '【休学/学业阻碍风险】\n';
  // 财星五行（克印星的五行）
  const caiWXMap2: Record<string, string> = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };
  const caiWX = caiWXMap2[dayWX] || '水'; // 财星五行
  const guanWXMap2: Record<string, string> = { '木': '金', '火': '水', '土': '木', '金': '火', '水': '土' };
  const guanWX = guanWXMap2[dayWX] || '木'; // 官杀五行

  // 只分析学龄段（6岁以上）的风险，排除幼儿期
  const birthYearVal = paiPan.birthInfo?.year || (now - 18);
  for (let i = -10; i <= 5; i++) {
    const year = now + i;
    const age = year - birthYearVal;
    if (age < 6) continue; // 未达学龄，跳过
    const yearGanZhi = getYearGanZhi(year);
    const yearGanWX = WUXING_GAN[yearGanZhi.gan];
    const yearZhiWX = WUXING_ZHI[yearGanZhi.zhi];

    // 信号一：财克印——最经典的休学/学业中断信号
    // 流年天干为财星（克印），印星受克→学业中断
    if (yearGanWX === caiWX && hasYinXing) {
      text += `  🚨 ${year}年（${yearGanZhi.gan}${yearGanZhi.zhi}）：财克印！《三命通会》"财多坏印，学业必阻"——印星受克，学业严重受阻，极可能休学/退学/学业中断\n`;
    } else if (yearZhiWX === caiWX && hasYinXing) {
      text += `  ⚠️ ${year}年（${yearGanZhi.gan}${yearGanZhi.zhi}）：地支财星暗克印，学业有阻碍，注意力不集中\n`;
    }

    // 信号二：伤官见官——叛逆期+学业阻碍
    if (yearGanWX === shiShangWX && yearZhiWX === guanWX) {
      text += `  🚨 ${year}年（${yearGanZhi.gan}${yearGanZhi.zhi}）：伤官见官！《子平真诠》"伤官见官，祸患百端"——学业最大阻碍年，可能休学或成绩大幅下滑\n`;
    } else if (yearGanWX === shiShangWX) {
      text += `  ⚠️ ${year}年（${yearGanZhi.gan}${yearGanZhi.zhi}）：食伤旺，心浮气躁，可能分心/厌学，需家长关注\n`;
    }

    // 信号三：印星被冲——学业根基动摇
    const yinGanSet = new Set<string>();
    TIANGAN.forEach((g: string) => { if (WUXING_GAN[g] === yinWX) yinGanSet.add(g); });
    // 地支冲印星（简化判断：流年地支与命局印星地支相冲）
    const chongMap: Record<string, string> = {'子':'午','丑':'未','寅':'申','卯':'酉','辰':'戌','巳':'亥','午':'子','未':'丑','申':'寅','酉':'卯','戌':'辰','亥':'巳'};
    const yinZhiArr = getYinXingZhi(dayGan);
    for (const yz of yinZhiArr) {
      if (chongMap[yearGanZhi.zhi] === yz && allZhi.includes(yz)) {
        text += `  ⚠️ ${year}年（${yearGanZhi.gan}${yearGanZhi.zhi}）：冲印星（${yz}），学业根基动摇，成绩波动大\n`;
      }
    }
  }

  // 恢复期判断——连续财克印后，印星年能否真正恢复
  text += '【学业恢复期判断】\n';
  // 找出过去10年中的财克印年份
  const caiKeYinYears: number[] = [];
  for (let i = -10; i <= 0; i++) {
    const year = now + i;
    const age = year - birthYearVal;
    if (age < 6 || age > 30) continue;
    const yearGZ = getYearGanZhi(year);
    if (WUXING_GAN[yearGZ.gan] === caiWX && hasYinXing) {
      caiKeYinYears.push(year);
    }
  }
  if (caiKeYinYears.length === 0) {
    text += '  近年无财克印信号，学业运势平稳\n';
  } else {
    text += `  财克印年份：${caiKeYinYears.join('、')}\n`;
    if (isYinJi) {
      text += '  ⚠️ 印星为忌！即使到了印星流年，也不会真正恢复学业，只是有复学的念头但缺乏行动力。\n';
      text += '  《滴天髓》云：旺极宜泄不宜帮。身旺印多为忌，印星流年反而加重焦虑和无力感。\n';
      text += '  真正恢复学业的信号：食伤泄秀年（才华释放、找到兴趣方向）或财官年（有目标有动力），而非印星年。\n';
    } else {
      text += '  ✅ 印星为用！下一个印星流年或比劫帮身流年，可能真正恢复学业。\n';
    }
    // 连续2年及以上财克印=学业中断时间长
    let consecutive = 1;
    for (let i = 1; i < caiKeYinYears.length; i++) {
      if (caiKeYinYears[i] === caiKeYinYears[i - 1] + 1) consecutive++;
    }
    if (consecutive >= 2) {
      text += `  🚨 连续${consecutive}年财克印！学业中断时间不会短，恢复需要更长时间和更强的运势配合。\n`;
      text += '  已验证案例：丁亥丁未戊申戊午女命，2022-2023连续两年财克印，2023年休学，至2026年（印星年丙午）仍未复学。原因：印为忌，印星年到只是"想回去"而非"真能回去"。\n';
    }
  }

  return text;
}

// ============ 婚姻预测算法 ============
// 依据：《八字婚姻预测学》《子平命理婚恋》《滴天髓婚恋篇》
// 男命以财星为妻，女命以官杀为夫
// 铁律级规则：官杀混杂、夫妻宫被冲/被合、配偶星被克/被劫、伤官克官（女命）

/** 日支（配偶宫）信息 */
function getPeiOuGong(paiPan: BaZiPaiPan): { zhi: string; wx: string; cangGan: string[] } {
  const zhi = paiPan.dayPillar.zhi;
  return { zhi, wx: WUXING_ZHI[zhi], cangGan: CANGGAN[zhi] || [] };
}

/** 婚姻预测（含铁律级规则判断） */
export function predictHunYin(paiPan: BaZiPaiPan, currentYear?: number): string {
  const now = currentYear || new Date().getFullYear();
  const dayGan = paiPan.dayPillar.gan;
  const dayWX = WUXING_GAN[dayGan];
  const gender = paiPan.birthInfo.gender;
  const peiOuGong = getPeiOuGong(paiPan);
  const allZhi = [paiPan.yearPillar.zhi, paiPan.monthPillar.zhi, paiPan.dayPillar.zhi, paiPan.hourPillar.zhi];
  const allGan = [paiPan.yearPillar.gan, paiPan.monthPillar.gan, paiPan.dayPillar.gan, paiPan.hourPillar.gan];

  // 用神忌神判断
  const wangShuai = judgeWangShuai(paiPan);

  // 配偶星五行：男命=财星，女命=官杀
  const caiWXMap: Record<string, string> = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };
  const guanWXMap: Record<string, string> = { '木': '金', '火': '水', '土': '木', '金': '火', '水': '土' };
  const peiOuWX = gender === '男' ? (caiWXMap[dayWX] || '土') : (guanWXMap[dayWX] || '金');
  // 食伤五行（女命伤官克官=克夫星）
  const shiShangWXMap: Record<string, string> = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  const shiShangWX = shiShangWXMap[dayWX] || '火';
  // 比劫五行（争夺配偶星）
  const biJieWX = dayWX;

  // 四柱中找配偶星
  const hasPeiOuXingGan = allGan.some(g => WUXING_GAN[g] === peiOuWX);
  const hasPeiOuXingZhi = allZhi.some(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === peiOuWX));
  // 配偶星数量（天干+地支藏干）
  const peiOuXingGanCount = allGan.filter(g => WUXING_GAN[g] === peiOuWX).length;
  const peiOuXingZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === peiOuWX)).length;
  const peiOuXingTotal = peiOuXingGanCount + peiOuXingZhiCount;

  // 比劫数量（争夺配偶星的力量）
  const biJieGanCount = allGan.filter(g => WUXING_GAN[g] === biJieWX).length;
  const biJieZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === biJieWX)).length;
  const biJieTotal = biJieGanCount + biJieZhiCount;

  // 食伤数量（女命克官杀的力量）
  const shiShangGanCount = allGan.filter(g => WUXING_GAN[g] === shiShangWX).length;
  const shiShangZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === shiShangWX)).length;
  const shiShangTotal = shiShangGanCount + shiShangZhiCount;

  // 配偶方位（配偶星五行→方位）
  const wxFangWei: Record<string, string> = { '金': '正西/西北', '木': '正东/东南', '水': '正北', '火': '正南', '土': '中部/东北/西南' };

  // 红鸾天喜查表（年支→红鸾/天喜）
  const HONG_LUAN: Record<string, string> = {
    '子': '卯', '丑': '寅', '寅': '丑', '卯': '子', '辰': '亥', '巳': '戌',
    '午': '酉', '未': '申', '申': '未', '酉': '午', '戌': '巳', '亥': '辰',
  };
  const TIAN_XI: Record<string, string> = {
    '子': '酉', '丑': '申', '寅': '未', '卯': '午', '辰': '巳', '巳': '辰',
    '午': '卯', '未': '寅', '申': '丑', '酉': '子', '戌': '亥', '亥': '戌',
  };
  const yearZhi = paiPan.yearPillar.zhi;
  const hongLuanZhi = HONG_LUAN[yearZhi];
  const tianXiZhi = TIAN_XI[yearZhi];

  // 六冲表
  const chongMap: Record<string, string> = {'子':'午','丑':'未','寅':'申','卯':'酉','辰':'戌','巳':'亥','午':'子','未':'丑','申':'寅','酉':'卯','戌':'辰','亥':'巳'};
  // 六合表
  const liuHeMap: Record<string, string> = {'子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午'};

  let text = '\n\n===== 婚姻预测 =====\n';
  text += `【配偶星分析】${gender === '男' ? '男命以财星为妻' : '女命以官杀为夫'}，配偶星五行=${peiOuWX}\n`;
  text += hasPeiOuXingGan ? '✅ 天干透配偶星，姻缘明显\n' : '';
  text += hasPeiOuXingZhi ? '✅ 地支藏配偶星，有暗缘\n' : '';
  if (!hasPeiOuXingGan && !hasPeiOuXingZhi) {
    text += '⚠️ 命局配偶星不显，姻缘需待大运流年引动\n';
  }

  text += `【配偶宫分析】日支=${peiOuGong.zhi}(${peiOuGong.wx})，藏干=${peiOuGong.cangGan.join('')}\n`;
  if (peiOuGong.cangGan.some(cg => WUXING_GAN[cg] === peiOuWX)) {
    text += '✅ 配偶宫藏配偶星，婚姻稳定，配偶能干\n';
  }

  text += `【配偶方位】${wxFangWei[peiOuWX]}\n`;
  text += `【红鸾星】${hongLuanZhi}（红鸾引动年≈婚期）\n`;
  text += `【天喜星】${tianXiZhi}（天喜引动年≈添喜）\n`;

  // ═══════ 铁律级规则检测 ═══════
  text += '\n【婚姻铁律级规则检测】\n';

  // 铁律一：官杀混杂（女命）=感情复杂/多次婚姻信号
  if (gender === '女') {
    // 正官和偏官（七杀）同时出现在命局
    const zhengGanWX = allGan.map(g => WUXING_GAN[g]);
    const hasZhengGuan = zhengGanWX.includes(peiOuWX);
    // 偏官=七杀，与正官同五行但阴阳不同（简化：只要配偶星五行出现多次=混杂）
    if (peiOuXingTotal >= 3) {
      text += '🚨 铁律一【官杀混杂】：女命配偶星（官杀）出现3次及以上！《三命通会》"官杀混杂，主感情复杂，婚姻多变"。正偏官同透，感情选择多但难以专一，极可能经历多次感情或婚姻。\n';
    } else if (peiOuXingTotal >= 2) {
      text += '⚠️ 铁律一【官杀偏杂】：女命配偶星出现2次，正偏官交集，感情路有波折，需择一而终方吉。\n';
    } else {
      text += '✅ 铁律一【官星纯一】：女命配偶星一位，婚姻感情专一稳定，为上品婚配。\n';
    }
  } else {
    // 男命：财星混杂（正偏财同现）
    if (peiOuXingTotal >= 3) {
      text += '🚨 铁律一【财星混杂】：男命配偶星（财星）出现3次及以上！《子平真诠》"财多身弱，反为财所困；正偏财杂出，主感情不专"。正偏财同透，易有婚外情或再婚倾向。\n';
    } else if (peiOuXingTotal >= 2) {
      text += '⚠️ 铁律一【财星偏杂】：男命配偶星出现2次，感情需专一经营，防偏财扰正财。\n';
    } else {
      text += '✅ 铁律一【财星纯一】：男命配偶星一位，婚姻专一，为上品。\n';
    }
  }

  // 铁律二：配偶宫被冲=婚变信号
  const dayZhi = paiPan.dayPillar.zhi;
  // 四柱内部冲（日支被年支或月支冲）
  const chongDayFromYear = chongMap[paiPan.yearPillar.zhi] === dayZhi;
  const chongDayFromMonth = chongMap[paiPan.monthPillar.zhi] === dayZhi;
  if (chongDayFromYear && chongDayFromMonth) {
    text += '🚨 铁律二【配偶宫被冲】：日支（配偶宫）被年支+月支同时冲！《滴天髓》"日支逢冲，婚姻必变"。双重冲配偶宫，婚姻极不稳定，大概率经历婚变或长期分居。\n';
  } else if (chongDayFromYear || chongDayFromMonth) {
    text += '⚠️ 铁律二【配偶宫被冲】：日支（配偶宫）被' + (chongDayFromYear ? '年支' : '月支') + '冲。《滴天髓》"日支逢冲，婚姻不稳"。配偶宫受冲，感情易有波折，需行合运化解。\n';
  } else {
    text += '✅ 铁律二【配偶宫稳定】：日支（配偶宫）无冲，婚姻根基稳固。\n';
  }

  // 铁律三：配偶宫被合=配偶外遇倾向/感情有争夺
  const heDayFromYear = liuHeMap[paiPan.yearPillar.zhi] === dayZhi;
  const heDayFromMonth = liuHeMap[paiPan.monthPillar.zhi] === dayZhi;
  if (heDayFromYear || heDayFromMonth) {
    const heFrom = heDayFromYear ? '年支' : '月支';
    text += '⚠️ 铁律三【配偶宫被合】：日支（配偶宫）被' + heFrom + '合。《八字婚姻预测学》"配偶宫被合，配偶易有外心"。配偶宫逢合，配偶可能被他人吸引，需警惕感情第三者。\n';
  } else {
    text += '✅ 铁律三【配偶宫无外合】：配偶宫无被外合，配偶心性专一。\n';
  }

  // 铁律四：配偶星被克/被劫
  if (gender === '女') {
    // 女命：食伤克官杀=伤官克官
    if (shiShangTotal >= 2 && peiOuXingTotal <= 1) {
      text += '🚨 铁律四【伤官克官】：女命食伤旺（' + shiShangTotal + '个）而官杀弱（' + peiOuXingTotal + '个）！《子平真诠》"伤官见官，为祸百端"。女命伤官旺克官杀，克夫之象，婚姻极不顺，配偶易有灾或感情破裂。\n';
    } else if (shiShangTotal >= 1 && peiOuXingTotal <= 1) {
      text += '⚠️ 铁律四【食伤扰官】：女命食伤扰官杀，婚姻中容易对配偶不满，挑剔心重，需修心养性。\n';
    } else {
      text += '✅ 铁律四【官星不受克】：女命官杀不受食伤克，配偶地位稳固。\n';
    }
  } else {
    // 男命：比劫克财星=争夺配偶
    if (biJieTotal >= 3 && peiOuXingTotal <= 1) {
      text += '🚨 铁律四【比劫夺财】：男命比劫旺（' + biJieTotal + '个）而财星弱（' + peiOuXingTotal + '个）！《三命通会》"比劫争财，妻必被夺"。男命比劫多而财星少，配偶易被争夺，极可能有第三者插足或配偶移情。\n';
    } else if (biJieTotal >= 2 && peiOuXingTotal <= 1) {
      text += '⚠️ 铁律四【比劫扰财】：男命比劫多而财星少，感情中有竞争者，需主动维护感情。\n';
    } else {
      text += '✅ 铁律四【财星不受劫】：男命财星不受比劫争夺，感情稳定。\n';
    }
  }

  // 铁律五：配偶星为用神/忌神判断
  const isPeiOuYong = gender === '男' ? wangShuai.yongShen.includes('财星') : wangShuai.yongShen.includes('官杀');
  const isPeiOuJi = gender === '男' ? wangShuai.jiShen.includes('财星') : wangShuai.jiShen.includes('官杀');
  if (isPeiOuYong) {
    text += '✅ 铁律五【配偶星为用神】：配偶星为命局用神！配偶是命中贵人，婚姻有助运之功，得配偶则运开。配偶星越旺，配偶助力越大。\n';
  } else if (isPeiOuJi) {
    text += '⚠️ 铁律五【配偶星为忌神】：配偶星为命局忌神。《滴天髓》"忌神不宜旺，旺则生灾"。配偶星为忌时，配偶可能带来压力或拖累，但也不必过虑——流年用神到位时，婚姻仍可顺遂。\n';
  } else {
    text += '🔄 铁律五【配偶星中性】：配偶星非命局关键用忌，婚姻对运势影响中性，取决于大运流年配合。\n';
  }

  // 《八字婚姻预测学》经典论断
  text += '【婚姻经典论断】\n';
  if (gender === '女') {
    text += '《子平命理婚恋》：女命以官杀为夫，官星得位（年月）主早婚，官星在时柱主晚婚。官星混杂（正偏官同现）主感情复杂。\n';
  } else {
    text += '《子平命理婚恋》：男命以财星为妻，正财主正妻贤惠，偏财主偏缘或再婚。财星一位最贞，多见则感情不稳。\n';
  }

  // 婚姻灾厄流年检测（铁律级）
  text += '【婚姻风险流年】\n';
  for (let i = -3; i <= 7; i++) {
    const year = now + i;
    const yearGanZhi = getYearGanZhi(year);
    const yearGanWX = WUXING_GAN[yearGanZhi.gan];
    const yearZhiWX = WUXING_ZHI[yearGanZhi.zhi];
    const yearZhi2 = yearGanZhi.zhi;
    let label = '';
    let isRisk = false;

    // 风险信号一：流年冲配偶宫
    if (chongMap[yearZhi2] === dayZhi) {
      label = '🚨 流年冲配偶宫！《滴天髓》"日支逢冲，此年婚姻必变"——感情危机、分手/离婚/分居风险极高';
      isRisk = true;
    }
    // 风险信号二：女命流年食伤旺克官杀
    else if (gender === '女' && yearGanWX === shiShangWX && peiOuXingTotal <= 1) {
      label = '⚠️ 伤官年克官杀！女命此年对配偶挑剔、不满，感情易生矛盾';
      isRisk = true;
    }
    // 风险信号三：男命流年比劫旺夺财
    else if (gender === '男' && yearGanWX === biJieWX && peiOuXingTotal <= 1) {
      label = '⚠️ 比劫年夺财！男命此年感情有竞争者，配偶可能被吸引';
      isRisk = true;
    }
    // 风险信号四：配偶星被流年克制
    else if (yearGanWX === guanWXMap[peiOuWX] || (CANGGAN[yearZhi2] || []).some(cg => WUXING_GAN[cg] === guanWXMap[peiOuWX])) {
      label = '⚠️ 配偶星受克年，感情有压力，配偶可能不顺';
      isRisk = true;
    }

    if (isRisk) {
      text += `  ${year}年（${yearGanZhi.gan}${yearZhi2}）：${label}\n`;
    }
  }

  // 婚恋引动流年
  text += '【婚恋引动流年】\n';
  const ZHI_SHUXIANG: Record<string, string> = { '子': '鼠', '丑': '牛', '寅': '虎', '卯': '兔', '辰': '龙', '巳': '蛇', '午': '马', '未': '羊', '申': '猴', '酉': '鸡', '戌': '狗', '亥': '猪' };
  for (let i = 0; i <= 7; i++) {
    const year = now + i;
    const yearGanZhi = getYearGanZhi(year);
    const yearWX = WUXING_GAN[yearGanZhi.gan];
    const yearZhi2 = yearGanZhi.zhi;
    let label = '';
    // 红鸾引动
    if (yearZhi2 === hongLuanZhi) label = '💕 红鸾星动！此年姻缘最旺，婚恋大事可成';
    // 天喜引动
    else if (yearZhi2 === tianXiZhi) label = '🎉 天喜星动！此年添喜，利婚利子';
    // 配偶星引动
    else if (yearWX === peiOuWX) label = `💘 配偶星年！${gender === '男' ? '财星' : '官星'}当值，感情有实质进展`;
    // 配偶宫引动（流年地支与日支合）
    else if (isLiuHe(yearZhi2, peiOuGong.zhi)) label = '💍 流年合配偶宫，感情稳定或定婚';
    else {
      // 看流月
      const peiOuMonths: string[] = [];
      const LIU_YUE_ZHI = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
      for (let m = 0; m < 12; m++) {
        if (WUXING_ZHI[LIU_YUE_ZHI[m]] === peiOuWX || LIU_YUE_ZHI[m] === hongLuanZhi) {
          peiOuMonths.push(`${m + 1}月`);
        }
      }
      if (peiOuMonths.length > 0) label = `🔄 姻缘旺月：${peiOuMonths.join('、')}，可主动出击`;
      else label = '🔄 平年';
    }
    text += `  ${year}年（属${ZHI_SHUXIANG[yearZhi2]}）：${label}\n`;
  }

  // 配偶特征
  text += '【配偶特征推断】\n';
  const peiOuWXFeature: Record<string, string> = {
    '金': '配偶肤色偏白，性格果断，做事利落，可能从事金融/法律/管理',
    '木': '配偶身材修长，性格温和，有学识，可能从事教育/文化/医疗',
    '水': '配偶聪明灵活，善于交际，可能从事贸易/传媒/服务业',
    '火': '配偶热情开朗，精力充沛，可能从事电子/能源/餐饮',
    '土': '配偶稳重厚道，包容力强，可能从事房地产/农业/建筑',
  };
  text += `  五行${peiOuWX}型：${peiOuWXFeature[peiOuWX] || ''}\n`;

  // 婚姻恢复/稳定期判断
  text += '【婚姻稳定期判断】\n';
  let recentChongYears = 0;
  for (let i = -5; i <= 0; i++) {
    const year = now + i;
    const yearGZ = getYearGanZhi(year);
    if (chongMap[yearGZ.zhi] === dayZhi) recentChongYears++;
  }
  if (recentChongYears === 0) {
    text += '  近年配偶宫无冲，婚姻感情运势平稳。\n';
  } else {
    text += `  ⚠️ 近${recentChongYears}年配偶宫被冲！婚姻不稳定期，需耐心经营，等冲运过去自然转好。\n`;
    text += '  《滴天髓》云：冲逢合解。等流年地支合配偶宫（与日支六合的年份），婚姻危机可化解。\n';
    // 找出未来合配偶宫的年份
    for (let i = 1; i <= 5; i++) {
      const year = now + i;
      const yearGZ = getYearGanZhi(year);
      if (liuHeMap[yearGZ.zhi] === dayZhi) {
        text += `  ✅ ${year}年（${yearGZ.gan}${yearGZ.zhi}）流年合配偶宫，婚姻危机化解之机，此年感情有望稳定/复合/结婚。\n`;
        break;
      }
    }
  }

  return text;
}

/** 六合判断 */
function isLiuHe(zhi1: string, zhi2: string): boolean {
  const liuHe: Record<string, string> = {
    '子': '丑', '丑': '子', '寅': '亥', '亥': '寅',
    '卯': '戌', '戌': '卯', '辰': '酉', '酉': '辰',
    '巳': '申', '申': '巳', '午': '未', '未': '午',
  };
  return liuHe[zhi1] === zhi2;
}

/** 获取年干支（已有函数则不重复） */
function getYearGanZhi(year: number): { gan: string; zhi: string } {
  const ganIdx = (year - 4) % 10;
  const zhiIdx = (year - 4) % 12;
  return { gan: TIANGAN[ganIdx], zhi: DIZHI[zhiIdx] };
}

// ============ 六亲预测算法 ============
// 依据：《八字六亲预测学》《三命通会》六亲论
// 年柱=祖上/父母，月柱=父母/兄弟，日支=配偶，时柱=子女
// 铁律级规则：用神在何宫该宫六亲最得力、忌神在何宫该宫六亲多拖累、
//           父星被克破=父亲有灾、母星被克破=母亲有灾、子女星入库=子女缘晚

/** 六亲预测（含铁律级规则判断） */
export function predictLiuQin(paiPan: BaZiPaiPan, currentYear?: number): string {
  const now = currentYear || new Date().getFullYear();
  const dayGan = paiPan.dayPillar.gan;
  const dayWX = WUXING_GAN[dayGan];
  const allZhi = [paiPan.yearPillar.zhi, paiPan.monthPillar.zhi, paiPan.dayPillar.zhi, paiPan.hourPillar.zhi];
  const allGan = [paiPan.yearPillar.gan, paiPan.monthPillar.gan, paiPan.dayPillar.gan, paiPan.hourPillar.gan];

  // 六亲十神对应
  const yinWXMap: Record<string, string> = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' };
  const biJieWX = dayWX; // 比劫=同五行
  const shiShangWXMap: Record<string, string> = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  const caiWXMap: Record<string, string> = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };
  const guanWXMap: Record<string, string> = { '木': '金', '火': '水', '土': '木', '金': '火', '水': '土' };
  const yinWX = yinWXMap[dayWX];
  const shiShangWX = shiShangWXMap[dayWX];
  const caiWX = caiWXMap[dayWX];
  const guanWX = guanWXMap[dayWX];

  // 用神忌神判断
  const wangShuai = judgeWangShuai(paiPan);

  // 六冲表
  const chongMap: Record<string, string> = {'子':'午','丑':'未','寅':'申','卯':'酉','辰':'戌','巳':'亥','午':'子','未':'丑','申':'寅','酉':'卯','戌':'辰','亥':'巳'};

  let text = '\n\n===== 六亲预测 =====\n';

  // ═══════ 铁律级规则检测 ═══════
  text += '【六亲铁律级规则检测】\n';

  // 铁律一：用神在何宫，该宫六亲最得力
  const yongShen = wangShuai.yongShen;
  const pillarNames = ['年柱（祖上/父母）', '月柱（父母/兄弟）', '日支（配偶）', '时柱（子女）'];
  const pillars = [
    { gan: paiPan.yearPillar.gan, zhi: paiPan.yearPillar.zhi },
    { gan: paiPan.monthPillar.gan, zhi: paiPan.monthPillar.zhi },
    { gan: paiPan.dayPillar.gan, zhi: paiPan.dayPillar.zhi },
    { gan: paiPan.hourPillar.gan, zhi: paiPan.hourPillar.zhi },
  ];

  let yongShenPillar = '';
  for (let i = 0; i < 4; i++) {
    const p = pillars[i];
    const pWX = [WUXING_GAN[p.gan], WUXING_ZHI[p.zhi]];
    // 检查该柱是否包含用神五行
    if (yongShen.includes(pWX[0]) || yongShen.includes(pWX[1]) ||
        (CANGGAN[p.zhi] || []).some(cg => yongShen.includes(WUXING_GAN[cg]))) {
      yongShenPillar = pillarNames[i];
      break;
    }
  }
  if (yongShenPillar) {
    text += '✅ 铁律一【用神得力宫位】：用神在' + yongShenPillar + '！《三命通会》"用神在何宫，该宫六亲最得力"。此宫位对应的六亲是命中贵人，对命主帮助最大。\n';
  } else {
    text += '⚠️ 铁律一【用神不显四柱】：用神未透四柱，六亲中无特别得力之人，需大运引动方有贵人。\n';
  }

  // 铁律二：忌神在何宫，该宫六亲多拖累
  const jiShen = wangShuai.jiShen;
  let jiShenPillars: string[] = [];
  for (let i = 0; i < 4; i++) {
    const p = pillars[i];
    const pWX = [WUXING_GAN[p.gan], WUXING_ZHI[p.zhi]];
    if (jiShen.includes(pWX[0]) || jiShen.includes(pWX[1]) ||
        (CANGGAN[p.zhi] || []).some(cg => jiShen.includes(WUXING_GAN[cg]))) {
      jiShenPillars.push(pillarNames[i]);
    }
  }
  if (jiShenPillars.length > 0) {
    text += '⚠️ 铁律二【忌神拖累宫位】：忌神在' + jiShenPillars.join('、') + '！《滴天髓》"忌神在何宫，该宫六亲多拖累"。这些宫位对应的六亲可能给命主带来压力或麻烦。\n';
  } else {
    text += '✅ 铁律二【忌神不显四柱】：忌神未透四柱，六亲中无特别拖累之人。\n';
  }

  // 铁律三：父星（财星）被克破=父亲有灾
  const caiGanCount = allGan.filter(g => WUXING_GAN[g] === caiWX).length;
  const caiZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === caiWX)).length;
  const caiTotal = caiGanCount + caiZhiCount;
  const biJieGanCount = allGan.filter(g => WUXING_GAN[g] === biJieWX).length;
  const biJieZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === biJieWX)).length;
  const biJieTotal = biJieGanCount + biJieZhiCount;

  if (biJieTotal >= 3 && caiTotal <= 1) {
    text += '🚨 铁律三【父星被克破】：《三命通会》"比劫重重，财星必破，父星有灾"。比劫旺而财星弱，父亲星被克破，父亲可能体弱、事业不顺或与命主缘薄。\n';
  } else if (biJieTotal >= 2 && caiTotal === 0) {
    text += '⚠️ 铁律三【父星不显+比劫旺】：命局无财星（父星）且比劫多，与父亲缘分薄，父亲可能常年不在身边或体弱。\n';
  } else if (caiTotal >= 1) {
    text += '✅ 铁律三【父星得力】：命局有财星（父星），与父亲有缘，父亲对命主有一定助力。\n';
  } else {
    text += '🔄 铁律三【父星中性】：财星不显，与父亲缘分一般，需看大运。\n';
  }

  // 铁律四：母星（印星）被克破=母亲有灾
  const yinGanCount = allGan.filter(g => WUXING_GAN[g] === yinWX).length;
  const yinZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === yinWX)).length;
  const yinTotal = yinGanCount + yinZhiCount;
  // 财克印=母星受克
  if (caiTotal >= 3 && yinTotal <= 1) {
    text += '🚨 铁律四【母星被克破】：《滴天髓》"财多坏印，母星有灾"。财星旺而印星弱，母亲星被克破，母亲可能体弱、操劳或与命主缘薄。\n';
  } else if (caiTotal >= 2 && yinTotal === 0) {
    text += '⚠️ 铁律四【母星不显+财星旺】：命局无印星（母星）且财星多，财克印，母亲可能辛苦操劳，与命主聚少离多。\n';
  } else if (yinTotal >= 1) {
    text += '✅ 铁律四【母星得力】：命局有印星（母星），与母亲有缘，母亲对命主有关爱。\n';
  } else {
    text += '🔄 铁律四【母星中性】：印星不显，与母亲缘分一般，需看大运。\n';
  }

  // 铁律五：子女星入库=子女缘晚
  const shiShangGanCount = allGan.filter(g => WUXING_GAN[g] === shiShangWX).length;
  const shiShangZhiCount = allZhi.filter(z => (CANGGAN[z] || []).some(cg => WUXING_GAN[cg] === shiShangWX)).length;
  const shiShangTotal = shiShangGanCount + shiShangZhiCount;
  // 库的地支
  const kuMap: Record<string, string> = { '金': '丑', '木': '未', '水': '辰', '火': '戌', '土': '辰' };
  const shiShangKu = kuMap[shiShangWX] || '辰';
  const hasShiShangRuKu = allZhi.includes(shiShangKu) && shiShangTotal === 0;

  if (hasShiShangRuKu) {
    text += '⚠️ 铁律五【子女星入库】：《子平真诠》"食伤入库，子女缘迟"。子女星（食伤）入库不透，子女缘来得晚，可能晚育或子女较难管教。需冲开库的流年方有子女之喜。\n';
  } else if (shiShangTotal >= 2) {
    text += '✅ 铁律五【子女星旺】：子女星（食伤）旺，子女有才华、有出息，子女缘厚。\n';
  } else if (shiShangTotal === 0) {
    text += '⚠️ 铁律五【子女星不显】：子女星（食伤）不显，子女缘需待流年引动，可能晚育。\n';
  } else {
    text += '🔄 铁律五【子女星中性】：子女星数量适中，子女缘一般，需看大运流年配合。\n';
  }

  // 1. 父母（印星=母，财星=父）
  text += '【父母】\n';
  text += `  母亲星：印星（${yinWX}），父亲星：财星（${caiWX}）\n`;
  // 年柱看祖上
  const yearGanWX = WUXING_GAN[paiPan.yearPillar.gan];
  const yearZhiWX = WUXING_ZHI[paiPan.yearPillar.zhi];
  if (yearGanWX === yinWX || yearZhiWX === yinWX) {
    text += '  ✅ 年柱带印星，母亲能力突出，家境有根基\n';
  } else if (yearGanWX === caiWX || yearZhiWX === caiWX) {
    text += '  ✅ 年柱带财星，父亲事业有成，家境殷实\n';
  } else {
    text += '  ⚠️ 年柱父母星不显，父母助力需看大运\n';
  }
  // 月柱看父母
  const monthGanWX = WUXING_GAN[paiPan.monthPillar.gan];
  const monthZhiWX = WUXING_ZHI[paiPan.monthPillar.zhi];
  if (monthGanWX === yinWX || monthZhiWX === yinWX) {
    text += '  ✅ 月柱印星得力，母亲关怀多，学业有助\n';
  }
  if (monthGanWX === caiWX || monthZhiWX === caiWX) {
    text += '  ✅ 月柱财星，父亲助力大\n';
  }

  // 2. 兄弟姐妹（比劫=兄弟）
  text += '【兄弟姐妹】\n';
  if (biJieTotal >= 3) {
    text += '  比劫多，兄弟姐妹缘厚，但竞争也大\n';
  } else if (biJieTotal >= 1) {
    text += '  比劫适中，有兄弟姐妹助力\n';
  } else {
    text += '  比劫少，兄弟姐妹缘薄，多独立奋斗\n';
  }

  // 3. 配偶（日支）
  text += '【配偶】\n';
  const dayZhi = paiPan.dayPillar.zhi;
  const dayZhiWX = WUXING_ZHI[dayZhi];
  const cangGan = CANGGAN[dayZhi] || [];
  text += `  配偶宫日支=${dayZhi}(${dayZhiWX})，藏干=${cangGan.join('')}\n`;
  if (cangGan.some(cg => WUXING_GAN[cg] === caiWX)) {
    text += '  ✅ 配偶宫藏财星，配偶能干，经济条件好\n';
  } else if (cangGan.some(cg => WUXING_GAN[cg] === guanWX)) {
    text += '  ✅ 配偶宫藏官星，配偶有责任心，社会地位好\n';
  } else if (cangGan.some(cg => WUXING_GAN[cg] === yinWX)) {
    text += '  ✅ 配偶宫藏印星，配偶体贴温柔，像母亲般照顾\n';
  } else if (cangGan.some(cg => WUXING_GAN[cg] === biJieWX)) {
    text += '  ⚠️ 配偶宫藏比劫，配偶个性强，可能有竞争者\n';
  }

  // 4. 子女（时柱+食伤星）
  text += '【子女】\n';
  text += `  子女星：食伤（${shiShangWX}），子女宫：时柱${paiPan.hourPillar.gan}${paiPan.hourPillar.zhi}\n`;
  const hourGanWX = WUXING_GAN[paiPan.hourPillar.gan];
  const hourZhiWX = WUXING_ZHI[paiPan.hourPillar.zhi];
  const hourCangGan = CANGGAN[paiPan.hourPillar.zhi] || [];
  if (hourGanWX === shiShangWX || hourZhiWX === shiShangWX || hourCangGan.some(cg => WUXING_GAN[cg] === shiShangWX)) {
    text += '  ✅ 时柱带食伤，子女聪明有才华，子女缘厚\n';
  } else {
    text += '  ⚠️ 时柱食伤不显，子女缘需待流年引动\n';
  }

  // 5. 六亲灾厄流年检测（铁律级）
  text += '【六亲灾厄风险流年】\n';
  for (let i = -3; i <= 7; i++) {
    const year = now + i;
    const yearGanZhi = getYearGanZhi(year);
    const yearGanWX = WUXING_GAN[yearGanZhi.gan];
    let label = '';
    let isRisk = false;

    // 父亲灾厄：比劫年夺财星（父星）
    if (yearGanWX === biJieWX && caiTotal <= 1) {
      label = '⚠️ 比劫年夺财星（父星），父亲此年可能不顺或健康有忧';
      isRisk = true;
    }
    // 母亲灾厄：财星年克印星（母星）
    else if (yearGanWX === caiWX && yinTotal <= 1) {
      label = '⚠️ 财星年克印星（母星），母亲此年可能辛苦操劳或健康有忧';
      isRisk = true;
    }
    // 配偶灾厄：流年冲日支（配偶宫）
    else if (chongMap[yearGanZhi.zhi] === dayZhi) {
      label = '⚠️ 流年冲配偶宫，配偶此年可能不顺或感情有波折';
      isRisk = true;
    }

    if (isRisk) {
      text += `  ${year}年（${yearGanZhi.gan}${yearGanZhi.zhi}）：${label}\n`;
    }
  }

  // 5. 六亲关系总论
  text += '【六亲经典论断】\n';
  text += '《三命通会》六亲论：年柱管祖上，月柱管父母，日支管配偶，时柱管子女。\n';
  text += '印星旺者与母缘厚，财星旺者与父缘厚，比劫旺者兄弟姐妹多，食伤旺者子女有出息。\n';
  text += '用神在何宫，该宫六亲最得力；忌神在何宫，该宫六亲多拖累。\n';

  return text;
}
