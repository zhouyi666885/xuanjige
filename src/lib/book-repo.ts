/**
 * 书籍仓储层（Supabase）
 * 把书籍全文、任务状态、墓碑统统持久化到云端数据库，开发/生产共享数据
 */

import { getSupabaseClient } from "@/storage/database/supabase-client";

export interface BookRow {
  id: string;
  name: string;
  category: string;
  content: string;
  char_count: number;
  total_chapters: number;
  chapter_structure: string | null;
  source: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface BookTaskRow {
  id: string;
  book_name: string;
  status: string;
  progress: number;
  message: string | null;
  chars: number;
  current_chapter: number;
  total_chapters: number;
  chapter_structure: string | null;
  source: string | null;
  is_local_book: boolean;
  learning_status: string;
  learning_progress: number;
  learning_current_chunk: number;
  learning_total_chunks: number;
  learning_message: string | null;
  learning_layers_done: string[] | null;
  learning_started_at: string | null;
  learning_completed_at: string | null;
  logs: Array<{ time: string; level: string; message: string }> | null;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
}

// ============================================================
// 1. 书籍全文 CRUD
// ============================================================

export async function upsertBook(book: {
  name: string;
  category?: string;
  content: string;
  char_count?: number;
  total_chapters?: number;
  chapter_structure?: string;
  source?: string;
}): Promise<BookRow> {
  const client = getSupabaseClient();
  const charCount = book.char_count ?? book.content.length;
  const row = {
    name: book.name,
    category: book.category ?? "其他",
    content: book.content,
    char_count: charCount,
    total_chapters: book.total_chapters ?? 0,
    chapter_structure: book.chapter_structure ?? null,
    source: book.source ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await client
    .from("books")
    .upsert(row, { onConflict: "name" })
    .select()
    .maybeSingle();
  if (error) throw new Error(`保存书籍失败: ${error.message}`);
  return data as BookRow;
}

export async function getBookByName(name: string): Promise<BookRow | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("books")
    .select("*")
    .eq("name", name)
    .maybeSingle();
  if (error) throw new Error(`查询书籍失败: ${error.message}`);
  return data as BookRow | null;
}

export async function getBookContent(name: string): Promise<string | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("books")
    .select("content")
    .eq("name", name)
    .maybeSingle();
  if (error) throw new Error(`读取书籍全文失败: ${error.message}`);
  return data?.content ?? null;
}

export async function listBooks(opts: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ books: BookRow[]; total: number }> {
  const client = getSupabaseClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, opts.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 不要 .select('*')，避免 content 字段每次拉很大数据
  let countQuery = client.from("books").select("*", { count: "exact", head: true });
  let dataQuery = client
    .from("books")
    .select("id, name, category, char_count, total_chapters, chapter_structure, source, created_at, updated_at")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (opts.search) {
    const kw = `%${opts.search}%`;
    countQuery = countQuery.ilike("name", kw);
    dataQuery = dataQuery.ilike("name", kw);
  }

  const [{ count, error: cErr }, { data, error: dErr }] = await Promise.all([
    countQuery,
    dataQuery,
  ]);
  if (cErr) throw new Error(`统计书籍失败: ${cErr.message}`);
  if (dErr) throw new Error(`查询书籍列表失败: ${dErr.message}`);

  return {
    books: (data ?? []) as BookRow[],
    total: count ?? 0,
  };
}

export async function getAllBookNames(): Promise<string[]> {
  const client = getSupabaseClient();
  // 分页拉全部，单表最多几百本，分一次即可
  const { data, error } = await client
    .from("books")
    .select("name")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`获取书名列表失败: ${error.message}`);
  return (data ?? []).map((b) => b.name as string);
}

export async function getBookCount(): Promise<number> {
  const client = getSupabaseClient();
  const { count, error } = await client
    .from("books")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`统计书籍数失败: ${error.message}`);
  return count ?? 0;
}

export async function deleteBook(name: string): Promise<void> {
  if (!name) throw new Error("书名不能为空");
  const client = getSupabaseClient();
  const { error } = await client.from("books").delete().eq("name", name);
  if (error) throw new Error(`删除书籍失败: ${error.message}`);
}

export async function searchBooksByContent(keyword: string, limit = 100): Promise<BookRow[]> {
  if (!keyword) return [];
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("books")
    .select("id, name, category, char_count, total_chapters, content")
    .ilike("content", `%${keyword}%`)
    .limit(limit);
  if (error) throw new Error(`内容检索失败: ${error.message}`);
  return (data ?? []) as BookRow[];
}

// ============================================================
// 2. 书籍任务 CRUD
// ============================================================

export async function listTasks(): Promise<BookTaskRow[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("book_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`查询任务失败: ${error.message}`);
  return (data ?? []) as BookTaskRow[];
}

export async function getTaskById(id: string): Promise<BookTaskRow | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("book_tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`查询任务失败: ${error.message}`);
  return data as BookTaskRow | null;
}

export async function getTaskByBookName(bookName: string): Promise<BookTaskRow | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("book_tasks")
    .select("*")
    .eq("book_name", bookName)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`查询任务失败: ${error.message}`);
  return (data?.[0] ?? null) as BookTaskRow | null;
}

export async function upsertTask(task: Partial<BookTaskRow> & { id: string; book_name: string }): Promise<BookTaskRow> {
  const client = getSupabaseClient();
  const row = {
    ...task,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await client
    .from("book_tasks")
    .upsert(row, { onConflict: "id" })
    .select()
    .maybeSingle();
  if (error) throw new Error(`保存任务失败: ${error.message}`);
  return data as BookTaskRow;
}

export async function deleteTask(id: string): Promise<void> {
  if (!id) return;
  const client = getSupabaseClient();
  const { error } = await client.from("book_tasks").delete().eq("id", id);
  if (error) throw new Error(`删除任务失败: ${error.message}`);
}

export async function deleteTasksByBookName(bookName: string): Promise<void> {
  if (!bookName) return;
  const client = getSupabaseClient();
  const { error } = await client.from("book_tasks").delete().eq("book_name", bookName);
  if (error) throw new Error(`按书名删除任务失败: ${error.message}`);
}

// ============================================================
// 3. 任务墓碑 CRUD
// ============================================================

export async function addTombstone(kind: "id" | "name", value: string): Promise<void> {
  if (!value) return;
  const client = getSupabaseClient();
  const { error } = await client
    .from("book_task_tombstones")
    .insert({ kind, value });
  if (error && !error.message.includes("duplicate")) {
    throw new Error(`添加墓碑失败: ${error.message}`);
  }
}

export async function listTombstones(): Promise<{ deletedIds: Set<string>; deletedNames: Set<string> }> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("book_task_tombstones")
    .select("kind, value")
    .limit(10000);
  if (error) throw new Error(`查询墓碑失败: ${error.message}`);
  const deletedIds = new Set<string>();
  const deletedNames = new Set<string>();
  for (const row of data ?? []) {
    if (row.kind === "id") deletedIds.add(row.value as string);
    else if (row.kind === "name") deletedNames.add(row.value as string);
  }
  return { deletedIds, deletedNames };
}
