CREATE TABLE `forum_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`request_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`author_kind` text NOT NULL,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`thread_id`) REFERENCES `forum_threads`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "forum_reply_body_length" CHECK(length(trim("forum_replies"."body")) BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forum_replies_request` ON `forum_replies` (`owner_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `forum_replies_thread` ON `forum_replies` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `forum_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`request_id` text NOT NULL,
	`author_kind` text NOT NULL,
	`author_name` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "forum_thread_title_length" CHECK(length(trim("forum_threads"."title")) BETWEEN 1 AND 120),
	CONSTRAINT "forum_thread_body_length" CHECK(length(trim("forum_threads"."body")) BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forum_threads_request` ON `forum_threads` (`owner_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `forum_threads_owner` ON `forum_threads` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `things_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`request_id` text NOT NULL,
	`name` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "things_item_name_length" CHECK(length(trim("things_items"."name")) BETWEEN 1 AND 120),
	CONSTRAINT "things_item_quantity" CHECK("things_items"."quantity" BETWEEN 1 AND 9999)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `things_items_request` ON `things_items` (`owner_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `things_items_owner` ON `things_items` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `things_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`item_id` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`item_id`) REFERENCES `things_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `things_photos_item` ON `things_photos` (`item_id`,`created_at`);