CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL
);
