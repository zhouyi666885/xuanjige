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

    // 搜索 Key 兼容三套命名：SEARCH_API_KEY / SERPER_API_KEY / BING_API_KEY
    // 谁有用谁（按 Serper → Bing → Tavily 优先级），都没填则禁用搜索
    const serperKey = process.env.SERPER_API_KEY || '';
    const bingKey = process.env.BING_API_KEY || '';
    const tavilyKey = process.env.TAVILY_API_KEY || '';
    const explicitKey = process.env.SEARCH_API_KEY || '';
    const explicitProvider = process.env.SEARCH_PROVIDER as 'serper' | 'bing' | 'tavily' | 'none' | undefined;

    if (explicitKey && explicitProvider && explicitProvider !== 'none') {
      this.searchApiKey = explicitKey;
      this.searchProvider = explicitProvider;
    } else if (serperKey) {
      this.searchApiKey = serperKey;
      this.searchProvider = 'serper';
    } else if (bingKey) {
      this.searchApiKey = bingKey;
      this.searchProvider = 'bing';
    } else if (tavilyKey) {
      this.searchApiKey = tavilyKey;
      this.searchProvider = 'tavily';
    } else {
      this.searchApiKey = '';
      this.searchProvider = 'none';
    }

    // S3 兼容两套命名（S3_ENDPOINT_URL / S3_ENDPOINT，S3_BUCKET_NAME / S3_BUCKET）
    this.s3Endpoint = process.env.S3_ENDPOINT_URL || process.env.S3_ENDPOINT || '';
    this.s3Region = process.env.S3_REGION || 'us-east-1';
    this.s3Bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || '';
    this.s3AccessKeyId = process.env.S3_ACCESS_KEY_ID || '';
    this.s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY || '';
    this.customHeaders = customHeaders || {};
  }
}
