CREATE TABLE "server_resets" (
	"id" serial PRIMARY KEY NOT NULL,
	"reset_at" timestamp with time zone DEFAULT now() NOT NULL,
	"logger_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "server_resets" ADD CONSTRAINT "server_resets_logger_id_loggers_id_fk" FOREIGN KEY ("logger_id") REFERENCES "public"."loggers"("id") ON DELETE no action ON UPDATE no action;