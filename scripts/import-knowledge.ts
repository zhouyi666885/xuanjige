/**
 * 知识库导入脚本
 * 将 classic-knowledge.ts 中所有领域书籍内容导入到知识库
 * 
 * 用法: npx tsx scripts/import-knowledge.ts
 */

import {
  KnowledgeClient,
  Config,
  KnowledgeDocument,
  DataSourceType,
  ChunkConfig,
} from 'coze-coding-dev-sdk';
import {
  THEOLOGY_KNOWLEDGE,
  METAPHYSICS_KNOWLEDGE,
} from '../src/lib/classic-knowledge';

const DATASET_NAME = 'xuanxue_classics';

interface KnowledgeEntry {
  name: string;
  corePoints: string;
}

async function main() {
  const config = new Config();
  const client = new KnowledgeClient(config);

  // 合并所有知识领域
  const allKnowledge: Record<string, KnowledgeEntry> = {
    ...THEOLOGY_KNOWLEDGE,
    ...METAPHYSICS_KNOWLEDGE,
  };

  const entries = Object.entries(allKnowledge);
  console.log(`共发现 ${entries.length} 个知识领域，开始逐批导入...\n`);

  const chunkConfig: ChunkConfig = {
    separator: '\n\n',
    max_tokens: 2000,
    remove_extra_spaces: false,
  };

  let successCount = 0;
  let failCount = 0;

  // 每次最多导入 5 个文档（API 限流保护）
  const BATCH_SIZE = 5;
  const documents: KnowledgeDocument[] = [];
  const docNames: string[] = [];

  for (const [key, knowledge] of entries) {
    const content = `===== ${knowledge.name} 核心知识点 =====\n\n${knowledge.corePoints}`;
    documents.push({
      source: DataSourceType.TEXT,
      raw_data: content,
    });
    docNames.push(knowledge.name);

    // 达到批次大小时执行导入
    if (documents.length >= BATCH_SIZE) {
      await importBatch(client, documents, docNames, chunkConfig);
      successCount += documents.length;
      documents.length = 0;
      docNames.length = 0;
      // 避免限流，批次间等待 2 秒
      await sleep(2000);
    }
  }

  // 导入剩余文档
  if (documents.length > 0) {
    await importBatch(client, documents, docNames, chunkConfig);
    successCount += documents.length;
  }

  console.log(`\n========================================`);
  console.log(`导入完成! 成功: ${successCount}, 失败: ${failCount}`);
  console.log(`========================================`);
}

async function importBatch(
  client: KnowledgeClient,
  documents: KnowledgeDocument[],
  docNames: string[],
  chunkConfig: ChunkConfig
) {
  try {
    console.log(`正在导入批次: ${docNames.join(', ')}`);
    const response = await client.addDocuments(documents, DATASET_NAME, chunkConfig);

    if (response.code === 0) {
      console.log(`  ✓ 成功! 文档ID: ${response.doc_ids?.join(', ')}`);
    } else {
      console.error(`  ✗ 失败: ${response.msg}`);
    }
  } catch (error) {
    console.error(`  ✗ 异常: ${error}`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);
