CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`message_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stream_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`stream_id` text NOT NULL,
	`content` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stream_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
