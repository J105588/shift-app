-- 関数定義: 新規ユーザーが作成されたら実行される処理
create or replace function public.handle_new_user() 
returns trigger as $$
declare
  v_display_name text;
begin
  -- user_metadataからdisplay_nameまたはfull_nameを取得
  v_display_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.email  -- フォールバック: メールアドレスを使用
  );
  
  -- プロフィールが既に存在する場合は更新、存在しない場合は作成
  insert into public.profiles (id, display_name, role)
  values (new.id, v_display_name, 'staff')
  on conflict (id) do update
  set display_name = coalesce(excluded.display_name, profiles.display_name);
  
  return new;
end;
$$ language plpgsql security definer;

-- 既存のトリガーを削除（存在する場合）
drop trigger if exists on_auth_user_created on auth.users;

-- トリガー定義: auth.users に insert されたら上記の関数を呼ぶ
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();