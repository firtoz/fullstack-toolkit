CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer,
	`name` text NOT NULL,
	`age` integer NOT NULL
);
