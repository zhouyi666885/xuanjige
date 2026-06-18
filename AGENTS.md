# 玄机阁 - 神学玄学全书单知识库 App

## 项目概览
算命 App，涵盖面相手相拍照、AI 问答、八字命理、六爻占卜、梅花易数、紫微斗数、奇门遁甲、大六壬、风水地理、姓名测算等功能，内嵌 19055 部典籍知识库。

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
│   │   └── api/
│   │       ├── chat/route.ts     # AI 问答（流式 SSE）
│   │       ├── face-reading/route.ts  # 面相分析（流式 SSE）
│   │       ├── palm-reading/route.ts  # 手相分析（流式 SSE）
│   │       └── divination/route.ts    # 通用测算（流式 SSE）
│   ├── components/
│   │   ├── camera-capture.tsx    # 拍照组件（相机/相册）
│   │   ├── chat-interface.tsx    # AI 问答全屏界面
│   │   ├── reading-result.tsx    # 解读结果展示
│   │   ├── divination-page.tsx   # 通用测算页面模板
│   │   └── ui/                   # shadcn/ui 组件
│   └── lib/
│       ├── knowledge.ts          # 知识库（19055部典籍+提示词）
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

## 代码规范
- 严格 TypeScript，禁止隐式 any
- 所有 AI 输出使用 SSE 流式
- 拍照功能在首页最突出位置
- 专业/白话双模式切换
