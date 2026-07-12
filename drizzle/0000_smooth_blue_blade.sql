CREATE TABLE `augmentation_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`augmentation_stack` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `augmentation_presets_user_idx` ON `augmentation_presets` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `augmentation_presets_user_name_unique` ON `augmentation_presets` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `augmentations` (
	`id` text NOT NULL,
	`version` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`system_prompt` text NOT NULL,
	`conflicts_with` text,
	`requires` text,
	`source_url` text,
	`license` text,
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `augmentations_pk` ON `augmentations` (`id`,`version`);--> statement-breakpoint
CREATE INDEX `augmentations_published_idx` ON `augmentations` (`published`);--> statement-breakpoint
CREATE TABLE `model_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`label` text NOT NULL,
	`encrypted_key` text,
	`base_url` text,
	`key_version` integer DEFAULT 1 NOT NULL,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `model_credentials_user_idx` ON `model_credentials` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `model_credentials_user_label_unique` ON `model_credentials` (`user_id`,`label`);--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`category` text,
	`difficulty` text,
	`expected_tokens` integer,
	`is_public` integer DEFAULT false NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`forked_from` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`forked_from`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `prompts_user_idx` ON `prompts` (`user_id`);--> statement-breakpoint
CREATE INDEX `prompts_system_idx` ON `prompts` (`is_system`);--> statement-breakpoint
CREATE INDEX `prompts_category_idx` ON `prompts` (`category`);--> statement-breakpoint
CREATE TABLE `run_comparisons` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`run_a_id` text NOT NULL,
	`run_b_id` text NOT NULL,
	`winner` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_a_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_b_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `run_comparisons_user_idx` ON `run_comparisons` (`user_id`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`prompt_id` text,
	`prompt_body` text NOT NULL,
	`model_credential_id` text NOT NULL,
	`model_id` text NOT NULL,
	`model_params` text DEFAULT '{}' NOT NULL,
	`augmentation_stack` text DEFAULT '[]' NOT NULL,
	`generated_html` text,
	`generated_tokens_used` integer,
	`generated_cost_usd` text,
	`duration_ms` integer,
	`lint_report` text,
	`user_rating` integer,
	`user_notes` text,
	`is_public` integer DEFAULT false NOT NULL,
	`share_slug` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`model_credential_id`) REFERENCES `model_credentials`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `runs_user_created_idx` ON `runs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `runs_prompt_idx` ON `runs` (`prompt_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `runs_share_slug_unique` ON `runs` (`share_slug`);--> statement-breakpoint
CREATE INDEX `runs_is_public_idx` ON `runs` (`is_public`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);