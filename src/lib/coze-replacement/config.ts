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
  searchProvider: 'serper' | 'bing' | 'tavily' | 'local' | 'none';
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  customHeaders: Record<string, string>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(customHeaders?: Record<string, string>) {
    // 🔧 统一读取 env：自动 trim 掉首尾空白/换行/不可见字符，空值回退默认
    // 解决 .env 末尾 \r、空白字符、零宽空格等导致 fetch URL "did not match expected pattern" 报错
    const env = (key: string, fallback = ''): string => {
      const v = process.env[key];
      if (!v) return fallback;
      // 同时清掉常见不可见字符：\r \n \t 空格 零宽空格 BOM
      const trimmed = v.replace(/[\r\n\t\u200B\uFEFF]/g, '').trim();
      return trimmed || fallback;
    };

    // LLM Base URL 还要确保协议头存在且不以 / 结尾
    const normalizeBaseUrl = (url: string): string => {
      let u = url;
      if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
      u = u.replace(/\/+$/, '');
      return u;
    };

    this.llmApiKey = env('LLM_API_KEY');
    this.llmBaseUrl = normalizeBaseUrl(
      env('LLM_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1')
    );
    this.llmModel = env('LLM_MODEL', 'qwen-plus');

    // 搜索 Key 兼容三套命名：SEARCH_API_KEY / SERPER_API_KEY / BING_API_KEY
    // 谁有用谁（按 Serper → Bing → Tavily → local 优先级），都没填则降级到 local 公版书源（零成本零依赖）
    const serperKey = env('SERPER_API_KEY');
    const bingKey = env('BING_API_KEY');
    const tavilyKey = env('TAVILY_API_KEY');
    const explicitKey = env('SEARCH_API_KEY');
    const explicitProvider = env('SEARCH_PROVIDER') as
      | 'serper' | 'bing' | 'tavily' | 'local' | 'none' | '';

    if (explicitProvider === 'local' || explicitProvider === 'none') {
      this.searchApiKey = '';
      this.searchProvider = explicitProvider;
    } else if (explicitKey && explicitProvider) {
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
      // 🔑 所有 Key 都为空 → 自动降级到 local，零成本零依赖
      this.searchApiKey = '';
      this.searchProvider = 'local';
    }

    // S3 兼容两套命名（S3_ENDPOINT_URL / S3_ENDPOINT，S3_BUCKET_NAME / S3_BUCKET）
    this.s3Endpoint = env('S3_ENDPOINT_URL') || env('S3_ENDPOINT');
    this.s3Region = env('S3_REGION', 'us-east-1');
    this.s3Bucket = env('S3_BUCKET_NAME') || env('S3_BUCKET');
    this.s3AccessKeyId = env('S3_ACCESS_KEY_ID');
    this.s3SecretAccessKey = env('S3_SECRET_ACCESS_KEY');
    this.customHeaders = customHeaders || {};
  }
}
