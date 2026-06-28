import dns from 'node:dns';
import net from 'node:net';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getReportBuffer, createWrappedFetch } from '@/lib/coze-replacement';

/**
 * 修复 Node.js 22 在中国大陆 VPS 上 `fetch failed` 的根因：
 * - Node.js >=18 默认偏好 IPv6（autoSelectFamily=true 但大陆出口经常 IPv6 不通）
 * - 必须在进程启动早期强制 DNS 解析与 socket 连接全部走 IPv4
 * - 这步必须在任何 fetch / Supabase 调用之前完成，放在模块顶部 import 即生效
 */
let networkPatched = false;
function patchNodeNetworkForCN(): void {
  if (networkPatched) return;
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    /* 老版本 Node 没有这个方法，忽略 */
  }
  try {
    // 强制 socket 连接也优先 IPv4（Node 20+ 才有）
    if (typeof (net as unknown as { setDefaultAutoSelectFamily?: (v: boolean) => void }).setDefaultAutoSelectFamily === 'function') {
      (net as unknown as { setDefaultAutoSelectFamily: (v: boolean) => void }).setDefaultAutoSelectFamily(false);
    }
  } catch {
    /* 老版本忽略 */
  }
  networkPatched = true;
}
patchNodeNetworkForCN();

let envLoaded = false;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

function loadEnv(): void {
  if (envLoaded) return;

  // 独立部署：优先用 dotenv 加载 .env
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config();
  } catch {
    // dotenv not available — 走系统 env
  }
  envLoaded = true;
}

function getSupabaseCredentials(): SupabaseCredentials {
  loadEnv();

  // 优先读标准命名，回退到旧的 COZE_SUPABASE_* 名称
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.COZE_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL (或旧名 COZE_SUPABASE_URL) is not set');
  }
  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY (或旧名 COZE_SUPABASE_ANON_KEY) is not set');
  }

  return { url, anonKey };
}

function getSupabaseServiceRoleKey(): string | undefined {
  loadEnv();
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * 重试一次的 fetch wrapper：第一次 fetch failed 时重试一次。
 * Node fetch 偶发 TLS handshake 失败/UND_ERR_SOCKET，重试基本能成。
 */
function createResilientFetch(): typeof fetch {
  return async (input, init) => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fetch(input as RequestInfo, init);
      } catch (err) {
        lastErr = err;
        // 200ms / 600ms 后重试
        await new Promise(r => setTimeout(r, 200 + attempt * 400));
      }
    }
    throw lastErr;
  };
}

function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();

  let key: string;
  if (token) {
    key = anonKey;
  } else {
    const serviceRoleKey = getSupabaseServiceRoleKey();
    key = serviceRoleKey ?? anonKey;
  }

  const resilientFetch = createResilientFetch();
  let chosenFetch: typeof fetch = resilientFetch;

  try {
    const buffer = getReportBuffer();
    if (buffer) {
      // 把 createWrappedFetch 包在 resilientFetch 外面：先重试，再上报
      const baseWrapped = createWrappedFetch(buffer, 'supabase');
      chosenFetch = async (input, init) => {
        // 先走重试逻辑（重试封装在内层 fetch），再让 wrapper 做上报
        let lastErr: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await baseWrapped(input as RequestInfo, init);
          } catch (err) {
            lastErr = err;
            await new Promise(r => setTimeout(r, 200 + attempt * 400));
          }
        }
        throw lastErr;
      };
    }
  } catch {
    // Silent — reporting setup failure should not block client creation
  }

  const globalOptions: Record<string, any> = {
    fetch: chosenFetch,
  };
  if (token) {
    globalOptions.headers = { Authorization: `Bearer ${token}` };
  }

  return createClient(url, key, {
    global: globalOptions,
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export { loadEnv, getSupabaseCredentials, getSupabaseServiceRoleKey, getSupabaseClient };
