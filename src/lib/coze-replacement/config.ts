/**
 * 替换 coze-coding-dev-sdk Config —— 改为读取标准 .env
 *
 * 兼容原 SDK 调用方式：new Config(customHeaders?)
 */
export class Config {
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  searchApiKey: string;
  searchProvider: 'serper' | 'bing' | 'tavily' | 'none';
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  customHeaders: Record<string, string>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(customHeaders?: Record<string, string>) {
    this.llmApiKey = process.env.LLM_API_KEY || '';
    this.llmBaseUrl = process.env.LLM_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.llmModel = process.env.LLM_MODEL || 'qwen-plus';
    this.searchApiKey = process.env.SEARCH_API_KEY || '';
    this.searchProvider = (process.env.SEARCH_PROVIDER as 'serper' | 'bing' | 'tavily' | 'none') || 'serper';
    this.s3Endpoint = process.env.S3_ENDPOINT_URL || '';
    this.s3Region = process.env.S3_REGION || 'us-east-1';
    this.s3Bucket = process.env.S3_BUCKET_NAME || '';
    this.s3AccessKeyId = process.env.S3_ACCESS_KEY_ID || '';
    this.s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY || '';
    this.customHeaders = customHeaders || {};
  }
}
