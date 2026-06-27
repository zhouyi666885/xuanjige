/**
 * S3 对象存储 - 书籍存储模块
 * 
 * 架构：S3为主存储（无限容量） + 本地文件系统为缓存（加速访问）
 * - 新增书籍 → 上传到S3 + 保存到本地缓存
 * - 搜索书籍 → 先查本地缓存 → 缓存未命中则从S3下载
 * - 索引管理 → 本地book-index.json记录所有书籍的S3 Key
 */

import { S3Storage } from '@/lib/coze-replacement';
import * as fs from 'fs';
import * as path from 'path';

// S3客户端
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 本地缓存目录
const LOCAL_CACHE_DIR = path.join(process.env.COZE_WORKSPACE_PATH || '/workspace/projects', 'public', 'book-content');
const INDEX_FILE = path.join(process.env.COZE_WORKSPACE_PATH || '/workspace/projects', 'book-s3-index.json');

// S3前缀
const S3_PREFIX = 'books/';

// 索引类型
interface BookIndex {
  [bookName: string]: {
    s3Key: string;
    size: number;
    uploadedAt: string;
    localCached: boolean;
  };
}

// 加载索引
function loadIndex(): BookIndex {
  try {
    if (fs.existsSync(INDEX_FILE)) {
      return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return {};
}

// 保存索引
function saveIndex(index: BookIndex): void {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

// 生成S3安全文件名（去除特殊字符）
function sanitizeFileName(name: string): string {
  return name
    .replace(/[?#&%{}^[\]`\\<>~|"'+=:;]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/\/+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * 上传书籍到S3
 */
export async function uploadBookToS3(
  bookName: string,
  content: string | Buffer
): Promise<{ s3Key: string; size: number }> {
  const safeName = sanitizeFileName(bookName);
  const fileName = `${S3_PREFIX}${safeName}.txt`;
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  const size = buffer.length;

  // 上传到S3
  const s3Key = await storage.uploadFile({
    fileContent: buffer,
    fileName,
    contentType: 'text/plain; charset=utf-8',
  });

  // 更新索引
  const index = loadIndex();
  index[bookName] = {
    s3Key,
    size,
    uploadedAt: new Date().toISOString(),
    localCached: false,
  };
  saveIndex(index);

  return { s3Key, size };
}

/**
 * 从S3下载书籍内容
 */
export async function downloadBookFromS3(bookName: string): Promise<string | null> {
  const index = loadIndex();
  const entry = index[bookName];
  if (!entry) return null;

  try {
    const buffer = await storage.readFile({ fileKey: entry.s3Key });
    const content = buffer.toString('utf-8');

    // 保存到本地缓存
    const localPath = path.join(LOCAL_CACHE_DIR, `${bookName}.txt`);
    fs.writeFileSync(localPath, content, 'utf-8');

    // 更新索引标记
    entry.localCached = true;
    saveIndex(index);

    return content;
  } catch (err) {
    console.error(`从S3下载书籍失败: ${bookName}`, err);
    return null;
  }
}

/**
 * 检查书籍是否在S3中存在
 */
export async function isBookInS3(bookName: string): Promise<boolean> {
  const index = loadIndex();
  if (index[bookName]) return true;

  // 也可以通过S3 API检查
  try {
    const safeName = sanitizeFileName(bookName);
    const prefix = `${S3_PREFIX}${safeName}`;
    const result = await storage.listFiles({ prefix, maxKeys: 1 });
    return result.keys.length > 0;
  } catch {
    return false;
  }
}

/**
 * 获取书籍内容（先查本地缓存，再查S3）
 */
export async function getBookContent(bookName: string): Promise<string | null> {
  // 1. 先查本地缓存
  const localPath = path.join(LOCAL_CACHE_DIR, `${bookName}.txt`);
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath, 'utf-8');
  }

  // 2. 从S3下载
  return downloadBookFromS3(bookName);
}

/**
 * 获取所有书籍列表（S3 + 本地）
 */
export async function getAllBookNames(): Promise<string[]> {
  const index = loadIndex();
  const s3Books = Object.keys(index);

  // 也扫描本地缓存
  if (fs.existsSync(LOCAL_CACHE_DIR)) {
    const localFiles = fs.readdirSync(LOCAL_CACHE_DIR)
      .filter(f => f.endsWith('.txt'))
      .map(f => f.replace(/\.txt$/, ''));

    // 合并去重
    const allBooks = new Set([...s3Books, ...localFiles]);
    return [...allBooks];
  }

  return s3Books;
}

/**
 * 同步本地书籍到S3（批量上传）
 */
export async function syncLocalBooksToS3(
  onProgress?: (bookName: string, index: number, total: number) => void
): Promise<{ uploaded: number; skipped: number; failed: number }> {
  const index = loadIndex();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  if (!fs.existsSync(LOCAL_CACHE_DIR)) {
    return { uploaded, skipped, failed };
  }

  const files = fs.readdirSync(LOCAL_CACHE_DIR).filter(f => f.endsWith('.txt'));
  const total = files.length;

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const bookName = fileName.replace(/\.txt$/, '');

    if (onProgress) onProgress(bookName, i + 1, total);

    // 已在S3中则跳过
    if (index[bookName]?.s3Key) {
      skipped++;
      // 更新本地缓存标记
      index[bookName].localCached = true;
      continue;
    }

    try {
      const content = fs.readFileSync(path.join(LOCAL_CACHE_DIR, fileName), 'utf-8');
      const safeName = sanitizeFileName(bookName);
      const s3FileName = `${S3_PREFIX}${safeName}.txt`;
      const buffer = Buffer.from(content, 'utf-8');

      const s3Key = await storage.uploadFile({
        fileContent: buffer,
        fileName: s3FileName,
        contentType: 'text/plain; charset=utf-8',
      });

      index[bookName] = {
        s3Key,
        size: buffer.length,
        uploadedAt: new Date().toISOString(),
        localCached: true,
      };
      uploaded++;
    } catch (err) {
      console.error(`上传失败: ${bookName}`, err);
      failed++;
    }
  }

  saveIndex(index);
  return { uploaded, skipped, failed };
}

/**
 * 获取S3存储统计
 */
export async function getS3Stats(): Promise<{
  totalBooks: number;
  totalSize: number;
  localCached: number;
}> {
  const index = loadIndex();
  const entries = Object.values(index);
  return {
    totalBooks: entries.length,
    totalSize: entries.reduce((sum, e) => sum + e.size, 0),
    localCached: entries.filter(e => e.localCached).length,
  };
}

/**
 * 从S3删除书籍
 */
export async function deleteBookFromS3(bookName: string): Promise<boolean> {
  const index = loadIndex();
  const entry = index[bookName];
  if (!entry) return false;

  try {
    // 从S3删除
    await storage.deleteFile({ fileKey: entry.s3Key });

    // 从索引中移除
    delete index[bookName];
    saveIndex(index);

    // 删除本地缓存
    const localPath = path.join(LOCAL_CACHE_DIR, `${bookName.replace(/[<>:"/\\|?*]/g, '_').trim()}.txt`);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }

    return true;
  } catch (err) {
    console.error(`从S3删除书籍失败: ${bookName}`, err);
    return false;
  }
}

/**
 * 保存书籍（同时写入本地缓存和S3）
 */
export async function saveBook(
  bookName: string,
  content: string
): Promise<{ s3Key: string; size: number; localPath: string }> {
  // 1. 保存到本地缓存
  const localPath = path.join(LOCAL_CACHE_DIR, `${bookName}.txt`);
  fs.writeFileSync(localPath, content, 'utf-8');

  // 2. 上传到S3
  const { s3Key, size } = await uploadBookToS3(bookName, content);

  // 3. 更新索引标记本地缓存
  const index = loadIndex();
  if (index[bookName]) {
    index[bookName].localCached = true;
    saveIndex(index);
  }

  return { s3Key, size, localPath };
}

/**
 * 列出S3上的所有书籍
 */
export async function listS3Books(): Promise<string[]> {
  try {
    const result = await storage.listFiles({ prefix: S3_PREFIX, maxKeys: 10000 });
    return result.keys
      .filter(key => key.endsWith('.txt'))
      .map(key => {
        // 从key中提取书名
        const name = key.split('/').pop()?.replace(/\.txt$/, '') || '';
        // 去掉UUID前缀（格式：filename_uuid.txt）
        const parts = name.split('_');
        if (parts.length > 1 && /^[a-f0-9]{8}$/i.test(parts[parts.length - 1])) {
          return parts.slice(0, -1).join('_');
        }
        return name;
      });
  } catch {
    return [];
  }
}
