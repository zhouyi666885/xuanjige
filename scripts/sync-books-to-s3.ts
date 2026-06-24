/**
 * 批量同步本地书籍到S3云存储
 * 运行：npx tsx scripts/sync-books-to-s3.ts
 */

import { syncLocalBooksToS3, getS3Stats } from '../src/lib/book-storage';

async function main() {
  console.log('=== 开始同步本地书籍到S3云存储 ===\n');
  
  const result = await syncLocalBooksToS3((bookName, index, total) => {
    // 每10本输出一次进度
    if (index % 10 === 0 || index === total) {
      console.log(`进度: ${index}/${total} - ${bookName}`);
    }
  });
  
  console.log('\n=== 同步完成 ===');
  console.log(`上传: ${result.uploaded} 本`);
  console.log(`跳过（已存在）: ${result.skipped} 本`);
  console.log(`失败: ${result.failed} 本`);
  
  const stats = await getS3Stats();
  console.log(`\nS3存储统计:`);
  console.log(`总书籍数: ${stats.totalBooks}`);
  console.log(`总大小: ${(stats.totalSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`本地缓存: ${stats.localCached} 本`);
}

main().catch(console.error);
