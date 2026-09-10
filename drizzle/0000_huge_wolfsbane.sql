CREATE TABLE `content_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text,
	`next_attempt` integer DEFAULT 0 NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL
);
