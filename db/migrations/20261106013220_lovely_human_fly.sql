CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "task_title_length" CHECK(length(trim("tasks"."title")) BETWEEN 1 AND 200),
	CONSTRAINT "task_completed_boolean" CHECK("tasks"."completed" IN (0, 1))
);
