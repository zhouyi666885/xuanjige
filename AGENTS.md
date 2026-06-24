# 玄机阁 - 神学玄学全书单知识库 App

## 项目概览
算命 App，涵盖面相手相拍照、AI 问答、八字命理、六爻占卜、梅花易数、紫微斗数、奇门遁甲、大六壬、风水地理、姓名测算等功能，内嵌近20000部典籍知识库。

## 版本技术栈
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **AI**: coze-coding-dev-sdk (LLM 流式输出)
- **模型**: doubao-seed-2-0-pro-260215 (支持图片理解)

## 目录结构
```
├── src/
│   ├── app/
│   │   ├── page.tsx              # 首页（拍照入口+功能导航）
│   │   ├── layout.tsx            # 根布局
│   │   ├── globals.css           # 全局样式（东方玄学主题）
│   │   ├── bazi/page.tsx         # 八字命理
│   │   ├── liuyao/page.tsx       # 六爻占卜
│   │   ├── meihua/page.tsx       # 梅花易数
│   │   ├── ziwei/page.tsx        # 紫微斗数
│   │   ├── qimen/page.tsx        # 奇门遁甲
│   │   ├── liuren/page.tsx       # 大六壬
│   │   ├── fengshui/page.tsx     # 风水地理
│   │   ├── xingming/page.tsx     # 姓名测算
│   │   ├── classics/page.tsx     # 经典书房
│   │   ├── add-book/page.tsx     # 添加书籍（输入书名自动搜索入库）
│   │   └── api/
│   │       ├── chat/route.ts     # AI 问答（流式 SSE）
│   │       ├── face-reading/route.ts  # 面相分析（流式 SSE）
│   │       ├── palm-reading/route.ts  # 手相分析（流式 SSE）
│   │       ├── divination/route.ts    # 通用测算（流式 SSE）
│   │       ├── add-book/route.ts      # 添加书籍（搜索+下载+翻译+入库，SSE流式）
│   │       └── feedback/route.ts     # 预测验证反馈
│   ├── components/
│   │   ├── camera-capture.tsx    # 拍照组件（相机/相册）
│   │   ├── chat-interface.tsx    # AI 问答全屏界面
│   │   ├── reading-result.tsx    # 解读结果展示
│   │   ├── prediction-feedback.tsx # 预测验证反馈组件
│   │   ├── divination-page.tsx   # 通用测算页面模板
│   │   └── ui/                   # shadcn/ui 组件
│   └── lib/
│       ├── knowledge.ts          # 知识库（近20000部典籍+提示词+26步AI分析框架+补充1-6）
│       ├── classic-knowledge.ts  # 分类知识库（20+类别书籍核心论断+关键词匹配）
│       ├── bazi.ts               # 八字排盘算法（四柱+调候+格局+学业/婚姻/六亲预测）
│       ├── ziwei.ts              # 紫微斗数排盘（14主星+12宫+四化+学业/婚姻/六亲预测）
│       ├── liuyao.ts             # 六爻起卦（铜钱+时间法+六亲+世应+日月建+伏神）
│       ├── meihua.ts             # 梅花易数（时间/数字/文字起卦+体用生克+互变卦+外应）
│       ├── qimen.ts              # 奇门遁甲（阴阳遁+九宫+八门+九星+八神）
│       ├── liuren.ts             # 大六壬（四课三传+天将+神煞+课体）
│       ├── fengshui.ts           # 风水（玄空飞星+八宅法+三要门主灶）
│       ├── xingming.ts           # 姓名测算（康熙笔画+五格剖象+三才+81数理）
│       ├── xiangxue.ts           # 面相分析（五官+十二宫+三停+气色+流年部位）
│       ├── shouxiang.ts          # 手相分析（五大主线+九大丘位+特殊纹路+流年法）
│       ├── sanhe-canduan.ts      # 三合参断框架（八字+紫微+面手相交叉验证）
│       └── utils.ts
```

## 构建与运行命令
- 安装依赖：`pnpm install`
- 开发：`pnpm run dev`
- 构建：`pnpm run build`
- 启动：`pnpm run start`

## 设计规范
- 主题色：金色 (#d4a853)、朱红 (#e74c3c)、墨色 (#0a0a0f)
- 字体：Noto Serif SC（标题）、PingFang SC（正文）
- 风格：东方玄学雅致风，深色底+金色点缀
- 详见 DESIGN.md

## API 接口
1. POST /api/chat - AI 玄学问答（SSE 流式）
2. POST /api/face-reading - 面相分析（SSE 流式，支持图片）
3. POST /api/palm-reading - 手相分析（SSE 流式，支持图片）
4. POST /api/divination - 通用测算（SSE 流式，type 参数区分测算类型）
5. POST /api/feedback - 预测验证反馈（JSON，收集用户验证结果用于AI进化）
6. GET /api/feedback - 查询反馈统计（JSON，返回准确率统计）
7. POST /api/add-book - 添加书籍到知识库（SSE流式，输入书名→搜索→下载→翻译→入库）
8. GET /api/add-book - 查询知识库书籍数量

## 代码规范
- 严格 TypeScript，禁止隐式 any
- 所有 AI 输出使用 SSE 流式
- 拍照功能在首页最突出位置
- 专业/白话双模式切换
- 所有8种术数模块均有真实排盘算法（非AI脑补）
- 统一7点输出格式：命局层次/六亲简断/事业财运/健康注意/性格特征/大运判断/流年应期
- 三级判断标准：铁律/或然/经验
- 三合参断：八字+紫微+面手相交叉验证

## 知识库铁律（最高优先级）
- 🔴🔴🔴 **所有回答必须且只能来自知识库！知识库是唯一的回答来源！**
- 🔴🔴🔴 **知识库中没有的就是不知道！绝不许自行编造！**
- 🔴🔴🔴 **书籍全文从第一个字到最后一个字完整收录！绝不允许以"字数到了"或"行数到了"为由截断！**
- 🔴🔴 **检索没有上限！能检索多少就检索多少，绝不允许因为"太多了"而省略！**
- 🔴🔴 **回答也没有上限！知识库有100条论断就引用100条，没有上限！**
- 同一问题必须引用至少3本以上不同典籍的论断进行交叉验证
- 禁止凭空编造任何书籍名称、论断内容或案例
- 不引用知识库内容就直接回答的判断，视为无效

## 知识库架构
- `fulltext-search.ts`: 全文检索模块，从 `public/book-content/` 目录加载1291本完整书籍
  - `searchFullText()`: 关键词匹配搜索，默认不限制返回数量
  - `getBookFullText()`: 获取指定书籍完整全文（一字不漏）
  - `findBooksByName()`: 按书名关键词查找书籍
- `classic-knowledge.ts`: 分类知识库，手动编辑的核心论断
- `extended-classic-knowledge.ts`: 扩展知识库，全部书籍核心论断
- `knowledge-search.ts`: 语义搜索（向量化检索）
- `knowledge.ts`: 提示词体系+26步AI分析框架

## AI 分析框架（knowledge.ts 提示词体系）
- 26步AI学习路径：从身份定位到持续迭代
- 六层递进分析法：命局层次→六亲→事业财运→健康→大运→流年应期
- 九步分层推理：定日主旺衰→定用神→定格局→定神煞→定刑冲合会→定六亲→定大运→定流年→综合输出
- 主动提问规则：缺出生地/性别/时辰/求测目的时主动要求补充
- 承认边界：具体月份/配偶长相/数额/手术日期算不准
- 验证跟踪：已验证+待验证，每三个月复盘
- 知识库维护格式：规律名称/发现来源/触发条件/案例数量/准确率/适用边界
- 补充1-6：核心prompt模板+六爻/梅花/风水/面手相核心指令+准确率评估表
