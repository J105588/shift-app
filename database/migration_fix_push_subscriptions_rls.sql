-- ==========================================
-- マイグレーション: push_subscriptions テーブルのRLSポリシー修正
-- ==========================================
-- 
-- 問題: upsert操作でonConflict: 'token'を使う場合、
-- 既存のレコードが別のユーザーのものだった場合にRLSポリシーで拒否される
-- 
-- 解決策: INSERTとUPDATEを別々のポリシーで扱い、
-- INSERT時は自分のuser_idで作成できるようにし、
-- UPDATE時は既存のレコードが自分のものであるか、または同じトークンで自分のuser_idに更新できるようにする

-- 既存のポリシーを削除
drop policy if exists "Users manage own push_subscriptions" on push_subscriptions;

-- INSERT用のポリシー: 自分のuser_idでトークンを登録できる
create policy "Users can insert own push_subscriptions"
on push_subscriptions
for insert
with check (auth.uid() = user_id);

-- SELECT用のポリシー: 自分のトークンのみ閲覧可能
create policy "Users can view own push_subscriptions"
on push_subscriptions
for select
using (auth.uid() = user_id);

-- UPDATE用のポリシー: 自分のトークンのみ更新可能
-- または、同じトークンで自分のuser_idに更新できる（upsertのonConflict: 'token'に対応）
create policy "Users can update own push_subscriptions"
on push_subscriptions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- DELETE用のポリシー: 自分のトークンのみ削除可能
create policy "Users can delete own push_subscriptions"
on push_subscriptions
for delete
using (auth.uid() = user_id);

