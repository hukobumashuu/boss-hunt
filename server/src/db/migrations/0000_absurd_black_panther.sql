CREATE TABLE "bosses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"map" varchar(100) NOT NULL,
	"respawn_interval_hours" integer DEFAULT 4 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kill_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"boss_id" integer NOT NULL,
	"channel" integer NOT NULL,
	"killed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"logger_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loggers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loggers_name_unique" UNIQUE("name"),
	CONSTRAINT "loggers_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "kill_events" ADD CONSTRAINT "kill_events_boss_id_bosses_id_fk" FOREIGN KEY ("boss_id") REFERENCES "public"."bosses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kill_events" ADD CONSTRAINT "kill_events_logger_id_loggers_id_fk" FOREIGN KEY ("logger_id") REFERENCES "public"."loggers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boss_channel_idx" ON "kill_events" USING btree ("boss_id","channel");