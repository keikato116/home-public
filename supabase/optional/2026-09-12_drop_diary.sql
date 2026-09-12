-- ============================================================
-- diary_entries を削除する
--
-- 公開版に日記機能は載せない。DiaryTab はどこからも呼ばれておらず、
-- 利用者は到達できなかった（タブ定義にも page.tsx にも無い）。
-- コード側（src/components/diary/, src/store/diaryStore.ts）は削除済み。
--
-- 新しく作った公開版プロジェクトには既に表ができているので、これで落とす。
-- 利用者0人・データ0件の段階なので、失うものは無い。
--
-- 【注意】個人用プロジェクトでは実行しないこと。あちらの日記には
-- 実際の記録が入っている可能性がある。
-- ============================================================

drop table if exists public.diary_entries;

-- 確認: 15 が返れば成功（16 から日記が減った状態）
select count(*) as テーブル数
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r';
