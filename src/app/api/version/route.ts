import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 版本标记接口 - 用于快速判断当前部署的代码版本
 *
 * 使用方法：
 *   1. 浏览器打开 https://你的域名/api/version
 *   2. 如果看到 buildId 显示 "fix-add-book-500" 及以后的版本，说明扣子上跑的是新代码
 *   3. 如果看到 404 或老的 buildId，说明扣子上跑的还是旧版本，需要在扣子界面重新点"部署"
 */
export async function GET() {
  return NextResponse.json({
    buildId: "fix-add-book-500-v2",
    builtAt: new Date().toISOString(),
    nodejs: process.version,
    runtime: "nextjs",
    features: {
      addBookForceDynamic: true,
      ensureTaskManagerLazy: true,
      envTrimNormalize: true,
      localSearchProvider: true,
      threeStageErrorDiagnosis: true,
    },
    healthy: true,
    message: "如果你看到这条消息，说明后端服务正常运行，且跑的是修复后的版本。",
  });
}
