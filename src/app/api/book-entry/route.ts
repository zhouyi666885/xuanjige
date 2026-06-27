/**
 * /api/book-entry
 * 玄机阁本地化书籍录入接口 —— 桥接到 scripts/book-entry/db_manager.py
 *
 * 设计目标：当 Serper / Bing / 全网搜索都失败时，提供一条「纯本地」的
 * 书籍录入兜底链路。所有数据落 SQLite，零外部依赖，完全脱离扣子。
 *
 * 支持的 action：
 *   - init             初始化数据库（首次部署）
 *   - add-book         添加书籍元数据
 *   - add-chapter      录入/覆盖某一章
 *   - book-status      查录入进度
 *   - list-books       列所有书
 *   - get-chapter      取某一章原文
 *   - get-full         导出完整书
 *   - delete-book      删除整本
 *   - update-status    更新书籍状态
 */
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 检测运行环境：Vercel / Netlify / Cloudflare Pages 等 Serverless 平台不支持 Python
// 也不支持持久化文件系统（只有 /tmp 临时可写，冷启动会丢）
const IS_SERVERLESS =
  !!process.env.VERCEL ||
  !!process.env.NETLIFY ||
  !!process.env.CF_PAGES ||
  process.env.DEPLOY_TARGET === 'vercel';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'book-entry', 'db_manager.py');
// Serverless 环境下文件系统只读，只有 /tmp 可写（但冷启动会丢）
const DEFAULT_DB =
  process.env.BOOK_ENTRY_DB ||
  (IS_SERVERLESS ? '/tmp/xuanjige.db' : path.join(process.cwd(), 'xuanjige.db'));
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

function serverlessUnavailableResponse() {
  return NextResponse.json(
    {
      status: 'unavailable',
      message:
        '当前部署在 Serverless 平台（Vercel/Netlify/CF Pages），不支持 Python 子进程与本地 SQLite 持久化。',
      hint:
        'book-entry 兜底链路仅在「自有服务器」(Docker/Linux VM) 上可用。Serverless 环境请走 Supabase 数据库 + LLM 直连方案。',
      docs: '/VERCEL-DEPLOY.md',
    },
    { status: 503 }
  );
}

const ALLOWED_ACTIONS = new Set([
  'init',
  'add-book',
  'add-chapter',
  'book-status',
  'list-books',
  'get-book',
  'get-chapter',
  'get-full',
  'delete-book',
  'update-status',
]);

interface PyResult {
  status: string;
  message?: string;
  [k: string]: unknown;
}

function runPython(action: string, args: string[]): Promise<PyResult> {
  return new Promise((resolve, reject) => {
    const fullArgs = [SCRIPT_PATH, action, '--db', DEFAULT_DB, ...args];
    const proc = spawn(PYTHON_BIN, fullArgs, {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString('utf-8'); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString('utf-8'); });

    proc.on('error', (err) => {
      reject(new Error(`无法启动 Python：${err.message}。请确认服务器已安装 python3 并在 PATH 中。`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`book-entry 脚本退出码 ${code}：${stderr || stdout || '(无输出)'}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim()) as PyResult;
        resolve(parsed);
      } catch {
        reject(new Error(`book-entry 返回非 JSON：${stdout.slice(0, 500)}`));
      }
    });
  });
}

function paramsToArgs(action: string, body: Record<string, unknown>): string[] {
  const args: string[] = [];
  const push = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    args.push(`--${key}`, String(value));
  };

  switch (action) {
    case 'add-book':
      push('title', body.title);
      push('author', body.author);
      push('language', body.language ?? 'zh');
      push('description', body.description);
      push('total-chapters', body.totalChapters);
      break;
    case 'add-chapter':
      push('book-id', body.bookId);
      push('chapter-num', body.chapterNum);
      push('title', body.chapterTitle ?? body.title);
      push('content', body.content);
      break;
    case 'book-status':
    case 'get-book':
    case 'delete-book':
      push('book-id', body.bookId);
      break;
    case 'get-chapter':
      push('book-id', body.bookId);
      push('chapter-num', body.chapterNum);
      break;
    case 'get-full':
      push('book-id', body.bookId);
      push('output', body.output);
      break;
    case 'update-status':
      push('book-id', body.bookId);
      push('status', body.status);
      break;
    case 'init':
    case 'list-books':
    default:
      break;
  }
  return args;
}

export async function POST(req: NextRequest) {
  // Serverless 平台直接返回 503 + 明确提示，避免 spawn python3 报底层错
  if (IS_SERVERLESS) {
    return serverlessUnavailableResponse();
  }
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? '').trim();

    if (!action) {
      return NextResponse.json(
        { status: 'error', message: '缺少 action 字段。可用：' + Array.from(ALLOWED_ACTIONS).join(', ') },
        { status: 400 }
      );
    }
    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json(
        { status: 'error', message: `不支持的 action：${action}` },
        { status: 400 }
      );
    }

    const args = paramsToArgs(action, body);
    const result = await runPython(action, args);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Serverless 平台：直接返回降级提示，不尝试 spawn python3
  if (IS_SERVERLESS) {
    return NextResponse.json(
      {
        status: 'unavailable',
        platform: process.env.VERCEL ? 'vercel' : (process.env.NETLIFY ? 'netlify' : 'serverless'),
        message: 'book-entry 仅在自有服务器环境可用，Serverless 平台请走 Supabase。',
        dbPath: DEFAULT_DB,
        pythonBin: PYTHON_BIN,
        scriptPath: SCRIPT_PATH,
      },
      { status: 503 }
    );
  }
  // 健康检查：返回数据库路径和已录入书籍数量
  try {
    const result = await runPython('list-books', []);
    return NextResponse.json({
      status: 'ok',
      dbPath: DEFAULT_DB,
      pythonBin: PYTHON_BIN,
      scriptPath: SCRIPT_PATH,
      total: (result as { total?: number }).total ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: 'unavailable',
        message,
        dbPath: DEFAULT_DB,
        pythonBin: PYTHON_BIN,
        scriptPath: SCRIPT_PATH,
        hint: '请确认服务器已安装 python3，并已执行 POST {"action":"init"} 初始化数据库。',
      },
      { status: 503 }
    );
  }
}
