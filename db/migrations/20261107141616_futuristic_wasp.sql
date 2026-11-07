CREATE TABLE `access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_tokens_token_hash_unique` ON `access_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `access_tokens_owner` ON `access_tokens` (`owner_id`);