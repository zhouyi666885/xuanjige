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
│   │   ├── upload-book/page.tsx  # 上传本地书籍文件（拖拽 txt/pdf/docx，秒级入库）
│   │   ├── knowledge-base/page.tsx # 知识库（查看/搜索/删除已录入书籍）
│   │   └── api/
│   │       ├── chat/route.ts     # AI 问答（流式 SSE，快速模式）
│   │       ├── chat-deep/route.ts # AI 深度问答（Map-Reduce 全量遍历知识库，SSE）
│   │       ├── face-reading/route.ts  # 面相分析（流式 SSE）
│   │       ├── palm-reading/route.ts  # 手相分析（流式 SSE）
│   │       ├── divination/route.ts    # 通用测算（流式 SSE）
│   │       ├── upload-book/route.ts   # 上传本地书籍文件（multipart，秒级入库，txt/md/pdf/docx/doc）
│   │       ├── knowledge-base/route.ts # 知识库（列出+搜索+删除书籍）
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
│       ├── book-task-manager.ts  # 书籍录入后台任务管理器（持久化+自动恢复+章节识别）
│       ├── book-storage.ts       # S3对象存储封装（本地缓存+S3双层架构）
│       ├── fulltext-search.ts    # 全文检索模块（1291本完整书籍+搜索+去重+增删）
│       ├── knowledge-prescreen.ts # 知识库智能预筛（关键词+同义词扩展→四档分级 high/medium/low/sample）
│       ├── map-reduce-search.ts  # Map-Reduce 全量遍历协调器（分批 LLM 精读→流式 progress→Reduce 合成）
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
1. POST /api/chat - AI 玄学问答（SSE 流式，快速模式）
2. POST /api/chat-deep - AI 深度问答（SSE 流式，Map-Reduce 全量遍历每一本书）
3. POST /api/face-reading - 面相分析（SSE 流式，支持图片）
4. POST /api/palm-reading - 手相分析（SSE 流式，支持图片）
5. POST /api/divination - 通用测算（SSE 流式，type 参数区分测算类型）
6. POST /api/feedback - 预测验证反馈（JSON，收集用户验证结果用于AI进化）
7. GET /api/feedback - 查询反馈统计（JSON，返回准确率统计）
8. GET /api/knowledge-base - 获取知识库书籍列表（支持search分页）
9. DELETE /api/knowledge-base - 从知识库删除书籍
10. POST /api/upload-book - 上传本地书籍文件（multipart，SSE 流式，最多50个文件，自动学习+逐章进度上报）
11. GET /api/upload-book - 查询上传接口元数据

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
- 🔴🔴🔴 **上传文件原样保留：不修改、不篡改、不截断、不重新编码！**
  - 入库后的 .txt 文件必须与上传文件**字节级一致**（MD5 相同）
  - CRLF / LF / 前后空白 / 全角半角 / 标点符号全部原样保留，禁止 `.replace()` / `.trim()`
  - 优先 UTF-8 解码；若失败回退 GBK；若两者都失败（替换字符 > 1%）**立即报错停止处理**，不得带乱码继续学习
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
- `knowledge-prescreen.ts`: 智能预筛模块（关键词+同义词扩展 → 评分 → 四档分级 high/medium/low/sample，确保兜底覆盖每一本书）
- `map-reduce-search.ts`: Map-Reduce 协调器（分批并行精读 → 流式 progress 事件 → Reduce 合成最终答案，突破 context window 物理限制）
- `knowledge.ts`: 提示词体系+26步AI分析框架

## Map-Reduce 深度问答流程（chat-deep）
1. **Prescreen**：拉取所有书名 → 关键词+同义词扩展 → 评分分级（high/medium/low），低于阈值的也做兜底抽样
2. **Map**：按相关度分批 LLM 精读各批书的全文，每批输出引用清单
3. **Reduce**：合并所有批次的引用 → LLM 综合输出最终答案（流式 chunk）
4. **SSE 事件序列**：`progress`（预筛/各批进度/Reduce）→ `meta`（citations + 元信息）→ `chunk` × N → `done`
5. **铁律保障**：searchFullTextAsync(query, 0, 0, 0) 四个 0 不限制 + Map-Reduce 全量遍历，绝不因为 context window 而省略

## 上传书籍自动学习流程（/api/upload-book）
收到文件后**立即**自动执行 6 步，全程 SSE 流式上报，不需要用户触发：
1. **file-start**：`📂 [i/N] 开始处理《xxx》`
2. **parse**：`📖 正在完整读取「xxx」全部内容（从第一页第一个字到最后一页最后一个字）...` —— 完整解析 txt/md/pdf/docx/doc，不遗漏任何段落
3. **extract**：`📝 识别书名：《XXX》（共 N 字）`
4. **chapter-detect**：`🔍 切分章节：发现 N 章/卦/卷/篇/节/回/部` —— 自动识别中文典籍结构
5. **learning × N**：`📖 学习中：第 K/N 章（X%）` —— 逐章上报，节流到不超过 60 帧，前端实时进度条
6. **file-done**：`✅ 《XXX》学习完成：N 章 · N 字 · 已存入知识库`
7. **all-done**：返回 `{successCount, duplicateCount, failedCount, totalChars, totalChapters}`

入库过程同时：本地 .txt 文件落盘 → 全文缓存刷新 → markBookAsLearned 元数据标记 → S3 云存储同步 → Supabase 持久化。

## AI 分析框架（knowledge.ts 提示词体系）
- 26步AI学习路径：从身份定位到持续迭代
- 六层递进分析法：命局层次→六亲→事业财运→健康→大运→流年应期
- 九步分层推理：定日主旺衰→定用神→定格局→定神煞→定刑冲合会→定六亲→定大运→定流年→综合输出
- 主动提问规则：缺出生地/性别/时辰/求测目的时主动要求补充
- 承认边界：具体月份/配偶长相/数额/手术日期算不准
- 验证跟踪：已验证+待验证，每三个月复盘
- 知识库维护格式：规律名称/发现来源/触发条件/案例数量/准确率/适用边界
- 补充1-6：核心prompt模板+六爻/梅花/风水/面手相核心指令+准确率评估表
