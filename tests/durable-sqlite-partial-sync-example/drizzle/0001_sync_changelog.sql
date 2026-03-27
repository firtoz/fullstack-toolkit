CREATE TABLE `sync_changelog` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rowId` text NOT NULL,
	`operation` text NOT NULL,
	`version` integer NOT NULL,
	`payloadJson` text
);
CREATE INDEX `sync_changelog_version_idx` ON `sync_changelog` (`version`);
