ALTER TABLE "kill_events" ADD COLUMN "created_at" timestamp with time zone;
UPDATE "kill_events" SET "created_at" = "killed_at";
ALTER TABLE "kill_events" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "kill_events" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "kill_events" ADD COLUMN "request_id" uuid;
CREATE UNIQUE INDEX "kill_logger_request_idx" ON "kill_events" USING btree ("logger_id","request_id");
