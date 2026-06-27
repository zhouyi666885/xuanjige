/**
 * 替换 coze-coding-dev-sdk 中的工具方法
 * - HeaderUtils.extractForwardHeaders：原用于跨服务透传 trace header，独立部署不需要
 * - getReportBuffer / createWrappedFetch：原用于扣子上报 buffer，独立部署不需要
 */

export const HeaderUtils = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extractForwardHeaders(_headers: Headers | Record<string, string>): Record<string, string> {
    return {};
  },
};

export function getReportBuffer(): null {
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createWrappedFetch(_buffer: unknown, _serviceName: string): typeof fetch {
  return fetch;
}
