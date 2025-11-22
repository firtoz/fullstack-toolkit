ALTER TABLE `todo` ADD `content` text;--> statement-breakpoint
ALTER TABLE `todo` ADD `priority` integer;--> statement-breakpoint
ALTER TABLE `todo` ADD `status` text;--> statement-breakpoint
ALTER TABLE `todo` ADD `tags` text;--> statement-breakpoint
CREATE INDEX `todo_priority_index` ON `todo` (`priority`);--> statement-breakpoint
CREATE INDEX `todo_status_index` ON `todo` (`status`);