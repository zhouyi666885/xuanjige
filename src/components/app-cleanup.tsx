'use client';

import { useEffect } from 'react';

/**
 * 退出清理组件：用户关闭APP时自动清除所有非书籍类临时数据
 * 
 * 策略：
 * - sessionStorage: 浏览器自动清除（关闭标签页即失效），无需手动处理
 * - localStorage: 需要在 beforeunload 时主动清除 xuanjige_ 前缀的键
 * - 书籍/知识库数据：存储在服务端（S3+向量库），不受前端清理影响
 */
export function AppCleanup() {
  useEffect(() => {
    const cleanup = () => {
      // 清除 localStorage 中所有 xuanjige_ 前缀的数据（排盘记录、聊天缓存等）
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('xuanjige_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      // 清除所有 sessionStorage（浏览器关闭时本会自动清除，此处做双重保险）
      sessionStorage.clear();
    };

    // 用户关闭页面或刷新时触发清理
    window.addEventListener('beforeunload', cleanup);

    // 移动端：页面隐藏时也清理（用户切到后台、关闭APP）
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        cleanup();
      }
    });

    return () => {
      window.removeEventListener('beforeunload', cleanup);
    };
  }, []);

  return null;
}
