DROP INDEX "kasie_runs_idempotency_idx";--> statement-breakpoint
DELETE FROM "kasie_runs" a
USING "kasie_runs" b
WHERE a."idempotency_key" IS NOT NULL
  AND a."project_id" = b."project_id"
  AND a."idempotency_key" = b."idempotency_key"
  AND (a."created_at" > b."created_at"
    OR (a."created_at" = b."created_at" AND a.ctid > b.ctid));--> statement-breakpoint
CREATE UNIQUE INDEX "kasie_runs_idempotency_idx" ON "kasie_runs" USING btree ("project_id","idempotency_key");