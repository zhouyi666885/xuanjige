/**
 * 替换 coze-coding-dev-sdk S3Storage
 * 兼容原 SDK 接口：
 *   - uploadFile({fileContent, fileName, contentType?}) -> string (fileKey)
 *   - readFile({fileKey}) -> Buffer
 *   - listFiles({prefix, maxKeys?}) -> { keys: string[] }
 *   - deleteFile({fileKey}) -> void
 *
 * 同时兼容原选项命名 accessKey/secretKey，并支持降级为本地文件存储
 */
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

export interface S3StorageOptions {
  endpointUrl?: string;
  region?: string;
  bucketName?: string;
  /** 兼容 AWS 风格 */
  accessKeyId?: string;
  /** 兼容 AWS 风格 */
  secretAccessKey?: string;
  /** 兼容原 coze SDK 风格 */
  accessKey?: string;
  /** 兼容原 coze SDK 风格 */
  secretKey?: string;
}

export class S3Storage {
  private client: S3Client | null = null;
  private bucket: string;
  private localFallbackDir: string;

  constructor(options: S3StorageOptions = {}) {
    this.bucket = options.bucketName || process.env.S3_BUCKET_NAME || '';
    this.localFallbackDir = path.join(process.cwd(), '.local-storage');

    const endpoint = options.endpointUrl || process.env.S3_ENDPOINT_URL || '';
    const accessKeyId = options.accessKeyId || options.accessKey || process.env.S3_ACCESS_KEY_ID || '';
    const secretAccessKey = options.secretAccessKey || options.secretKey || process.env.S3_SECRET_ACCESS_KEY || '';
    const region = options.region || process.env.S3_REGION || 'us-east-1';

    if (this.bucket && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region,
        endpoint: endpoint || undefined,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: !!endpoint,
      });
    } else {
      if (!fs.existsSync(this.localFallbackDir)) {
        fs.mkdirSync(this.localFallbackDir, { recursive: true });
      }
      console.warn('[S3Storage] 未配置 S3 凭证，降级为本地文件存储:', this.localFallbackDir);
    }
  }

  private localPath(key: string): string {
    return path.join(this.localFallbackDir, key.replace(/[/\\]/g, '__'));
  }

  /** 兼容原 SDK：上传文件 */
  async uploadFile(params: { fileContent: Buffer | string; fileName: string; contentType?: string }): Promise<string> {
    const buf = typeof params.fileContent === 'string'
      ? Buffer.from(params.fileContent, 'utf-8')
      : params.fileContent;
    const key = params.fileName;
    if (!this.client) {
      fs.writeFileSync(this.localPath(key), buf);
      return key;
    }
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buf,
      ContentType: params.contentType || 'application/octet-stream',
    }));
    return key;
  }

  /** 兼容原 SDK：读文件 */
  async readFile(params: { fileKey: string }): Promise<Buffer> {
    if (!this.client) {
      const p = this.localPath(params.fileKey);
      if (!fs.existsSync(p)) throw new Error(`本地文件不存在: ${params.fileKey}`);
      return fs.readFileSync(p);
    }
    const resp = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.fileKey,
    }));
    const stream = resp.Body as unknown as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /** 兼容原 SDK：列出文件 */
  async listFiles(params: { prefix: string; maxKeys?: number }): Promise<{ keys: string[] }> {
    if (!this.client) {
      const items = fs.readdirSync(this.localFallbackDir).filter((name) =>
        name.replace(/__/g, '/').startsWith(params.prefix),
      );
      return { keys: items.map((n) => n.replace(/__/g, '/')).slice(0, params.maxKeys || 1000) };
    }
    const resp = await this.client.send(new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: params.prefix,
      MaxKeys: params.maxKeys || 1000,
    }));
    const keys = (resp.Contents || []).map((c) => c.Key || '').filter(Boolean);
    return { keys };
  }

  /** 兼容原 SDK：删除文件 */
  async deleteFile(params: { fileKey: string }): Promise<void> {
    if (!this.client) {
      const p = this.localPath(params.fileKey);
      if (fs.existsSync(p)) fs.unlinkSync(p);
      return;
    }
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: params.fileKey,
    }));
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return fs.existsSync(this.localPath(key));
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async getObjectUrl(key: string): Promise<string> {
    if (!this.client) return `local://${this.localPath(key)}`;
    const endpoint = process.env.S3_ENDPOINT_URL || '';
    if (endpoint) {
      return `${endpoint.replace(/\/$/, '')}/${this.bucket}/${key}`;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }
}
