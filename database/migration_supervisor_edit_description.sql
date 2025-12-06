-- ==========================================
-- マイグレーション: 統括者が自分のシフトのdescriptionのみを編集できるようにRLSポリシーを追加
-- ==========================================

-- 統括者が自分のシフトのdescriptionのみを更新できるポリシー
-- 注意: このポリシーは管理者のポリシーと併用されるため、管理者は引き続き全フィールドを編集可能
create policy "Supervisors can update own shift description" 
on shifts for update 
using (
  -- 統括者として設定されているシフトで、かつ現在のユーザーが統括者である場合
  supervisor_id = auth.uid()
)
with check (
  -- 更新できるのはdescriptionフィールドのみ
  -- 他のフィールド（user_id, title, start_time, end_time, supervisor_id）は変更されていないことを確認
  -- ただし、RLSポリシーでは列レベルの制御はできないため、アプリケーション側で制御する必要がある
  supervisor_id = auth.uid()
);

