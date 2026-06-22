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
    yongShen = `克我之${keWo}（官杀）、我克之${woKe}（财星）`;
    jiShen = `同我之${tongWo}（比劫）`;
    xiShen = `${keWo}、${woKe}`;
    lunDuan = '《滴天髓》云：身旺宜泄，取财官为用。日主偏旺，尚可担财官，以官制身、以财耗身为上。行财官运则发达，行比劫运则争财。';
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

// 流年引动贵人判断
function getGuiRenLiuNian(guirenZhi: string[], currentYear: number): { year: number; zhi: string; desc: string }[] {
  const zhiList = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
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
      results.push({
        year,
        zhi,
        desc: `${year}年（${tense}）属${shuXiang}年，贵人星引动，贵人方位在${fangWei}，注意${fangWei}方向来的人脉机遇`,
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
  const dayWuXingMap: Record<string, string> = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
    '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水',
  };
  const dayWX = dayWuXingMap[dayGan] || '土';

  // 日主所克的五行为正财/偏财
  const keMap: Record<string, string> = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };
  const caiWX = keMap[dayWX] || '土'; // 正偏财五行

  let text = '\n\n【财运+行业+方位预测】（祥品君实战法）\n';

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

  // 流年财运
  text += `\n【近十年财运流年】\n`;
  const zhiList = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const shengMap: Record<string, string> = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  const yinWX = shengMap[dayWX] || '火'; // 印星五行（生我的）
  const guanWX = keMap[dayWX] || '金'; // 官杀五行（克我的）

  for (let offset = 0; offset <= 10; offset++) {
    const year = now + offset;
    const zhiIdx = (year - 4) % 12;
    const zhi = zhiList[zhiIdx >= 0 ? zhiIdx : zhiIdx + 12];
    const zhiWX: Record<string, string> = {
      '子': '水', '丑': '土', '寅': '木', '卯': '木',
      '辰': '土', '巳': '火', '午': '火', '未': '土',
      '申': '金', '酉': '金', '戌': '土', '亥': '水',
    };
    const yearWX = zhiWX[zhi] || '土';

    let label = '';
    if (yearWX === caiWX) label = '💰 财星年，财运亨通，适合投资';
    else if (yearWX === dayWX) label = '💪 比劫年，竞争大但人脉旺';
    else if (yearWX === yinWX) label = '📚 印星年，学习进修好，有贵人';
    else if (yearWX === guanWX) label = '⚖️ 官杀年，事业压力但可能晋升';
    else if (shengMap[yearWX] === dayWX) label = '🍽️ 食伤年，才华展现，适合创业';
    else label = '🔄 平稳年';

    text += `  ${year}年（属${ZHI_SHUXIANG[zhi]}）${label}\n`;
  }

  return text;
}

/**
 * 完整实战预测输出（贵人+财运+行业+方位）
 */
export function formatShiZhanPrediction(paiPanResult: BaZiPaiPan, currentYear?: number): string {
  let text = '===== 实战派具体预测 =====';
  text += predictGuiRen(paiPanResult, currentYear);
  text += predictCaiYun(paiPanResult, currentYear);
  return text;
}
