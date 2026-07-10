-- 002_news_drafts.sql
-- news-response 稿件庫「跨裝置同步」：每位登入使用者的草稿，走 Supabase Auth + RLS。
--
-- 命名刻意用 news_ 前綴（非 cpc_）：本表走 authenticated + RLS 由「登入的瀏覽器」直連讀寫，
-- 與 cpc_*（line_uid 簽核系統、service_role only，migration 001 已對 authenticated 全 revoke）
-- 屬不同族。避免日後任何「revoke ... on cpc_* from authenticated」把本表一起掃死。
--
-- 冪等：重跑安全。套用位置＝CPC 專用 Supabase 專案（依 2026-07-10 決策，不再寄 launchdock）。

create table if not exists public.news_drafts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id    text not null,               -- 前端 caselib 的 PR-... id，供跨裝置合併/去重
  unit         text default 'default',      -- 單位 key（多單位框架：桃園/third_lng…）
  tags         text[] default '{}',
  casualty     text,
  reported     text,
  facts        text,
  draft        text not null,
  version_of   text,                         -- 母稿 client_id（版本溯源：優化後存為新版本）
  ts           bigint,                        -- 前端時間戳(ms)，對齊本機 localStorage 模型
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (user_id, client_id)
);

alter table public.news_drafts enable row level security;

-- 只有本人可讀寫自己的草稿（auth.uid() = user_id）
drop policy if exists news_drafts_own_select on public.news_drafts;
drop policy if exists news_drafts_own_insert on public.news_drafts;
drop policy if exists news_drafts_own_update on public.news_drafts;
drop policy if exists news_drafts_own_delete on public.news_drafts;
create policy news_drafts_own_select on public.news_drafts for select using (auth.uid() = user_id);
create policy news_drafts_own_insert on public.news_drafts for insert with check (auth.uid() = user_id);
create policy news_drafts_own_update on public.news_drafts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy news_drafts_own_delete on public.news_drafts for delete using (auth.uid() = user_id);

create index if not exists news_drafts_user_ts on public.news_drafts (user_id, ts desc);
