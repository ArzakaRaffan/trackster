-- Multi-user (F2): BudgetSetting bukan lagi singleton `id=1` -> id auto-increment (satu baris per user; unik userId dipasang di C1).
-- Aman untuk kode lama: baris id=1 tetap; `upsert where id:1` & `create {id:1}` tetap valid. Sequence disetel di atas MAX(id) agar tak bentrok.
CREATE SEQUENCE "BudgetSetting_id_seq" OWNED BY "BudgetSetting"."id";
SELECT setval('"BudgetSetting_id_seq"', COALESCE((SELECT MAX("id") FROM "BudgetSetting"), 0) + 1, false);
ALTER TABLE "BudgetSetting" ALTER COLUMN "id" SET DEFAULT nextval('"BudgetSetting_id_seq"');
