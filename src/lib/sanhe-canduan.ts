/**
 * 三合参断框架
 * 将八字命理 + 紫微斗数 + 面相手相 三大体系交叉验证
 * 
 * 原理：
 * - 八字看天命：出生时辰定格局，推算大运流年吉凶
 * - 紫微看命数：命盘星曜看人生轨迹，推算具体事项
 * - 面相看显象：面部五官气色看当前状态，印证天命命数
 * - 手相看行运：掌纹流年看已走过的人生轨迹，与八字大运对应
 * 
 * 三者合参，交叉验证，准确率远高于单术判断。
 */

import { formatPaiPanFull, BaZiPaiPan, formatShiZhanPrediction } from './bazi';
import { formatPaiPan as formatZiWeiPaiPan, ZiWeiPaiPan } from './ziwei';
import { generateMianXiangFramework, getMianXiangPredictionGuide, QI_SE_LUN, SHI_ER_GONG_LUN_DUAN, WU_GUAN_LUN_DUAN, SAN_TING_LUN_DUAN } from './xiangxue';
import { generateShouXiangFramework, getShouXiangPredictionGuide, ZHU_XIAN_LUN_DUAN, QIU_WEI_LUN_DUAN } from './shouxiang';

// ========== 三合参断核心框架 ==========

export interface SanHeCanDuanResult {
  bazi: BaZiPaiPan;
  ziwei: ZiWeiPaiPan;
  crossValidation: CrossValidation[];
  finalPrediction: FinalPrediction;
}

/**
 * 交叉验证项
 * 同一事项在三个体系中的判断结果对比
 */
export interface CrossValidation {
  /** 预测事项 */
  matter: string;
  /** 八字判断 */
  baziJudgment: string;
  /** 紫微判断 */
  ziweiJudgment: string;
  /** 面相判断（如有照片） */
  mianXiangJudgment: string;
  /** 手相判断（如有照片） */
  shouXiangJudgment: string;
  /** 综合结论 */
  conclusion: string;
  /** 一致度：high/medium/low */
  consistency: 'high' | 'medium' | 'low';
}

/**
 * 最终预测结论
 */
export interface FinalPrediction {
  guiRen: {
    fangWei: string;    // 贵人方位
    shuXiang: string;   // 贵人属相
    shiJian: string;    // 出现时间（年月）
    leiXing: string;    // 贵人类型
    xinXi: string;      // 交叉验证详情
  };
  caiYun: {
    liuNian: string;    // 财运流年
    hangYe: string;     // 适合行业
    fangWei: string;    // 发展方位
    zhuanJi: string;    // 转机时间
    xinXi: string;      // 交叉验证详情
  };
  shiYe: {
    fangXiang: string;  // 事业方向
    zhuanZhe: string;   // 转折时间
    guiRenXing: string; // 贵人星曜
    xinXi: string;      // 交叉验证详情
  };
  yinYuan: {
    shiJian: string;    // 姻缘时间
    duiXiang: string;   // 对象特征
    zhiYe: string;      // 对象职业方向
    xinXi: string;      // 交叉验证详情
  };
  jianKang: {
    zhuYi: string;      // 注意事项
    nianFen: string;    // 注意年份
    buWei: string;      // 注意部位
    xinXi: string;      // 交叉验证详情
  };
}

// ========== 三合参断指引 ==========
export const SAN_HE_CAN_DUAN_GUIDE = `
=== 三合参断核心法则 ===

【原理】
八字为天命，紫微为命数，面手相为显象。三者同源而异流，合参则准。

【参断规则】
1. 三者一致 → 准确率极高（90%+），可直接断言
   例：八字流年引动天乙贵人 + 紫微天魁入迁移 + 面相鱼尾黄明 → 该年必遇贵人

2. 二者一致一者不显 → 准确率较高（75%+），以一致者为准
   例：八字某年财运旺 + 紫微化禄入财帛 + 面相未拍照 → 以八字+紫微双盘合断

3. 三者互异 → 需深入分析，以最旺者为优先
   例：八字显示某年吉 + 紫微某年凶 → 查面相手相当前状态来定夺

【参断步骤】
第一步：八字排盘 → 定格局、取用神、看大运流年
第二步：紫微排盘 → 定命格、看星曜、推四化飞星
第三步：面手相分析 → 看五官气色、主线流年
第四步：三盘交叉验证 → 同一事项三方对比
第五步：综合论断 → 三合参断结论

【精确度要求】
- 贵人：方位（八方）+ 属相（十二生肖）+ 时间（年月）
- 财运：年份（哪年旺哪年衰）+ 行业（五行分类）+ 方位（八方）
- 姻缘：时间（年月）+ 对象特征（方向/属相/行业）
- 事业：转折年月 + 方向 + 贵人星
- 健康：注意年份 + 对应部位 + 预防方向
`;

/**
 * 生成三合参断的完整提示词框架
 * 这个函数被 chat 和 divination API 调用
 */
export function generateSanHeCanDuanPrompt(
  baziData: BaZiPaiPan,
  ziweiData: ZiWeiPaiPan,
  currentYear: number,
  hasFacePhoto: boolean = false,
  hasPalmPhoto: boolean = false,
): string {
  let prompt = SAN_HE_CAN_DUAN_GUIDE + '\n\n';

  // 八字排盘
  prompt += '=== 八字排盘数据（代码计算，非AI脑补） ===\n';
  prompt += formatPaiPanFull(baziData, currentYear) + '\n\n';

  // 实战预测
  prompt += '=== 八字实战预测 ===\n';
  prompt += formatShiZhanPrediction(baziData, currentYear) + '\n\n';

  // 紫微排盘
  prompt += '=== 紫微斗数排盘数据（代码计算，非AI脑补） ===\n';
  prompt += formatZiWeiPaiPan(ziweiData) + '\n\n';

  // 面相框架（如有照片）
  if (hasFacePhoto) {
    prompt += '=== 面相分析框架 ===\n';
    prompt += generateMianXiangFramework(baziData.birthInfo.year, currentYear, baziData.birthInfo.gender) + '\n\n';
    prompt += getMianXiangPredictionGuide() + '\n\n';
  }

  // 手相框架（如有照片）
  if (hasPalmPhoto) {
    prompt += '=== 手相分析框架 ===\n';
    prompt += generateShouXiangFramework(baziData.birthInfo.year, currentYear, baziData.birthInfo.gender) + '\n\n';
    prompt += getShouXiangPredictionGuide() + '\n\n';
  }

  // 交叉验证指引
  prompt += `=== 交叉验证核心对照表 ===

【贵人预测交叉验证】
八字：天乙贵人地支 → 方位+属相 + 流年引动时间
紫微：天魁天钺所在宫位 → 方位+属相 + 大限引动时间
面相：眉眼气色+颧骨 → 贵人方向+类型
手相：贵人纹 → 贵人类型
→ 三者合参，锁定贵人方位/属相/出现时间

【财运预测交叉验证】
八字：流年天干与日主五行生克 → 财运等级（大旺/偏旺/平稳/偏衰/大衰）
紫微：化禄入财帛/田宅 + 武曲/太阴亮度 → 财运强度
面相：准头/鼻翼气色 → 近期进财/破财
手相：财富纹+太阳丘 → 偏财运
→ 三者合参，锁定财运流年/行业/方位

【事业预测交叉验证】
八字：格局高低 + 用神方位 → 事业层次+方向
紫微：命宫/官禄宫星曜组合 → 事业类型+转折
面相：官禄宫（额头）+鼻梁 → 事业运
手相：事业线 → 事业轨迹
→ 三者合参，锁定事业方向/转折时间/贵人星

【姻缘预测交叉验证】
八字：日支（配偶宫）+ 流年引动 → 姻缘时间
紫微：夫妻宫星曜 + 红鸾天喜 → 姻缘时间+对象特征
面相：夫妻宫（鱼尾）气色 → 近期姻缘
手相：婚姻线+感情线 → 婚姻年龄+质量
→ 三者合参，锁定姻缘时间/对象特征/婚姻质量

【健康预测交叉验证】
八字：五行偏枯+神煞 → 注意年份+部位
紫微：疾厄宫星曜 → 健康类型
面相：疾厄宫（山根）气色 → 近期健康
手相：生命线断裂/岛纹 → 健康危机时间
→ 三者合参，锁定健康注意年份/部位/预防方向

=== 输出格式要求 ===

对于用户的问题，必须按以下格式回答：

1.【八字判断】引用排盘数据，给出八字维度的判断（含方位/年月/类型）
2.【紫微判断】引用排盘数据，给出紫微维度的判断（含方位/年月/类型）
${hasFacePhoto ? '3.【面相判断】根据照片分析，给出面相维度的判断\n' : ''}${hasPalmPhoto ? '4.【手相判断】根据照片分析，给出手相维度的判断\n' : ''}
${hasFacePhoto && hasPalmPhoto ? '5' : hasFacePhoto || hasPalmPhoto ? '4' : '3'}.【三合参断结论】
   - 一致度：高/中/低
   - 综合结论：基于交叉验证的最终判断
   - 精确预测：方位+属相+年月日（精确到月）
   - 引用经典：列出所引用的经典原文
`;

  return prompt;
}

/**
 * 根据问题类型生成三合参断指引
 */
export function getSanHeCanDuanByTopic(topic: string): string {
  const topicMap: Record<string, string> = {
    '贵人': `
【贵人三合参断】
八字维度：
- 查天乙贵人（甲戊见牛羊、乙己鼠猴乡、丙丁猪鸡位、壬癸兔蛇藏、庚辛逢虎马）
- 查文昌贵人（甲乙巳午报、丙戊申宫找、丁己鸡同窝、庚辛亥鼠尞、壬癸寅卯照）
- 看大运流年引动天乙贵人年份
- 定贵人方位（地支→八方）和属相（地支→生肖）

紫微维度：
- 查天魁天钺所在宫位
- 看大限流年引动天魁天钺年份
- 定贵人方位和类型

面相维度：
- 看眉眼形状与气色 → 贵人在近还是在远
- 看颧骨 → 贵人类型（长辈/同辈/下属）
- 看印堂气色 → 近期贵人运

手相维度：
- 看贵人纹 → 贵人帮助程度
- 看太阳线 → 因名得贵还是暗助

合参结论：三者一致则断言，不一致则细析。
`,
    '财运': `
【财运三合参断】
八字维度：
- 流年天干与日主五行生克 → 大旺/偏旺/平稳/偏衰/大衰
- 财星（正财/偏财）在大运流年中的状态
- 适合行业五行 → 行业方向
- 发展方位 → 五行方位

紫微维度：
- 化禄入财帛/田宅 → 财运强度
- 武曲/太阴亮度 → 正财/偏财
- 大限流年财运转折

面相维度：
- 准头/鼻翼气色 → 近期进财/破财
- 天仓地库 → 财运方向

手相维度：
- 财富纹数量 → 偏财运次数
- 太阳丘 → 因名得财

合参结论：锁定财运流年+行业+方位。
`,
    '事业': `
【事业三合参断】
八字维度：
- 格局高低 → 事业层次
- 用神方位 → 发展方向
- 官杀在大运流年中的状态 → 升迁/变动
- 食伤旺衰 → 创业/打工

紫微维度：
- 命宫/官禄宫星曜组合 → 事业类型
- 四化飞星入官禄 → 事业转折
- 大限官禄宫 → 十年事业运

面相维度：
- 官禄宫（额头）→ 事业运
- 鼻梁 → 中年事业
- 颧骨 → 权力

手相维度：
- 事业线 → 事业轨迹
- 木星丘 → 领导力

合参结论：锁定事业方向+转折时间+贵人星。
`,
    '姻缘': `
【姻缘三合参断】
八字维度：
- 日支（配偶宫）→ 配偶特征
- 流年引动日支/财星(男)/官星(女) → 姻缘年份
- 桃花星 → 姻缘类型

紫微维度：
- 夫妻宫星曜 → 配偶条件和婚姻质量
- 红鸾天喜引动 → 姻缘年份
- 大限夫妻宫 → 十年姻缘运

面相维度：
- 夫妻宫（鱼尾）气色 → 近期姻缘
- 鼻子 → 配偶条件
- 口唇 → 婚姻质量

手相维度：
- 婚姻线位置 → 结婚年龄
- 感情线 → 感情经历
- 金星丘 → 热情程度

合参结论：锁定姻缘时间+对象特征+婚姻质量。
`,
    '健康': `
【健康三合参断】
八字维度：
- 五行偏枯 → 对应脏腑弱
- 伤官见官/七杀攻身 → 灾厄年份
- 神煞（羊刃/亡神/劫煞）→ 注意年份

紫微维度：
- 疾厄宫星曜 → 健康类型
- 七杀/破军/贪狼在疾厄 → 注意部位
- 大限疾厄宫 → 十年健康运

面相维度：
- 疾厄宫（山根）气色 → 近期健康
- 疤痕痣位置 → 对应年龄段灾厄

手相维度：
- 生命线断裂/岛纹 → 健康危机时间
- 健康线 → 消化/呼吸系统

合参结论：锁定健康注意年份+部位+预防方向。
`,
  };

  // 匹配话题
  for (const [key, value] of Object.entries(topicMap)) {
    if (topic.includes(key)) {
      return value;
    }
  }

  // 默认返回全部指引
  return SAN_HE_CAN_DUAN_GUIDE;
}
