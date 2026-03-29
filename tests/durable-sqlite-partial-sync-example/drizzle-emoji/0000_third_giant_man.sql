CREATE TABLE `emoji_grid_changelog` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rowId` text NOT NULL,
	`operation` text NOT NULL,
	`version` integer NOT NULL,
	`payloadJson` text
);
--> statement-breakpoint
CREATE INDEX `emoji_grid_changelog_version_idx` ON `emoji_grid_changelog` (`version`);--> statement-breakpoint
CREATE TABLE `emoji_grid` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`emoji` text NOT NULL,
	`name` text NOT NULL,
	`health` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `emoji_grid_x_y_idx` ON `emoji_grid` (`x`,`y`);