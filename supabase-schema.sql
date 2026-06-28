-- ============================================================
-- 玄机阁数据库 Schema — 一次性创建所有表
-- 在 Supabase 项目的 SQL Editor 里复制粘贴，点 Run 执行即可
-- ============================================================

-- 1. 书籍全文表
create table if not exists books (
  id bigserial primary key,
  name text unique not null,
  category text default '其他',
  content text not null,
  char_count integer default 0,
  total_chapters integer default 0,
  chapter_structure text,
  source text,
  created_at timestamptz default now(),
  updated_at timestamptz
);
create index if not exists idx_books_name on books(name);
create index if not exists idx_books_category on books(category);

-- 2. 书籍任务表（搜索/录入/学习的进度记录）
create table if not exists book_tasks (
  id text primary key,
  book_name text not null,
  status text default 'pending',
  progress integer default 0,
  message text,
  chars integer default 0,
  current_chapter integer default 0,
  total_chapters integer default 0,
  chapter_structure text,
  source text,
  is_local_book boolean default false,
  learning_status text default 'idle',
  learning_progress integer default 0,
  learning_current_chunk integer default 0,
  learning_total_chunks integer default 0,
  learning_message text,
  learning_layers_done jsonb,
  learning_started_at timestamptz,
  learning_completed_at timestamptz,
  logs jsonb,
  has_missing_chapters boolean,
  missing_chapter_names jsonb,
  learning_current_chapter integer,
  learning_current_chapter_name text,
  created_at timestamptz default now(),
  updated_at timestamptz,
  completed_at timestamptz
);
create index if not exists idx_book_tasks_book_name on book_tasks(book_name);
create index if not exists idx_book_tasks_status on book_tasks(status);

-- 3. 任务墓碑表（记录已删除的任务避免重复）
create table if not exists book_task_tombstones (
  id bigserial primary key,
  kind text not null,
  value text not null,
  created_at timestamptz default now()
);
create unique index if not exists idx_tombstones_kind_value on book_task_tombstones(kind, value);

-- 4. 预测反馈表（AI 进化记录）
create table if not exists prediction_feedback (
  id bigserial primary key,
  prediction_type text not null,
  user_query text,
  ai_response text,
  is_correct boolean,
  user_correction text,
  created_at timestamptz default now()
);

-- 5. 允许匿名访问（重要！没这一步 anon key 读写不了）
alter table books enable row level security;
alter table book_tasks enable row level security;
alter table book_task_tombstones enable row level security;
alter table prediction_feedback enable row level security;

-- 简化策略：允许所有匿名读写（生产环境可改严）
drop policy if exists "anon all books" on books;
create policy "anon all books" on books for all using (true) with check (true);

drop policy if exists "anon all book_tasks" on book_tasks;
create policy "anon all book_tasks" on book_tasks for all using (true) with check (true);

drop policy if exists "anon all tombstones" on book_task_tombstones;
create policy "anon all tombstones" on book_task_tombstones for all using (true) with check (true);

drop policy if exists "anon all feedback" on prediction_feedback;
create policy "anon all feedback" on prediction_feedback for all using (true) with check (true);

-- 完成
select 'Schema 创建完毕，玄机阁 4 张表全部就绪' as result;
