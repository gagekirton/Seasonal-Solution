CREATE TABLE `accounting_links` (
	`realmId` varchar(32) NOT NULL,
	`entityType` enum('customer','invoice','payment') NOT NULL,
	`localId` varchar(41) NOT NULL,
	`remoteId` varchar(32) NOT NULL,
	`remoteNumber` varchar(32),
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accounting_links_realmId_entityType_localId_pk` PRIMARY KEY(`realmId`,`entityType`,`localId`)
);
--> statement-breakpoint
CREATE TABLE `integration_connections` (
	`provider` varchar(20) NOT NULL,
	`environment` enum('sandbox','production') NOT NULL,
	`realmId` varchar(32) NOT NULL,
	`companyName` varchar(200),
	`accessTokenEnc` text NOT NULL,
	`refreshTokenEnc` text NOT NULL,
	`accessTokenExpiresAt` timestamp NOT NULL,
	`refreshTokenExpiresAt` timestamp,
	`status` enum('connected','needs_reconnect') NOT NULL DEFAULT 'connected',
	`defaultItemId` varchar(32),
	`defaultItemName` varchar(120),
	`defaultTaxCodeId` varchar(32),
	`defaultTaxCodeName` varchar(120),
	`autoSyncPayments` boolean NOT NULL DEFAULT false,
	`connectedAt` timestamp NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_connections_provider` PRIMARY KEY(`provider`)
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` varchar(41) NOT NULL,
	`storageKey` varchar(255) NOT NULL,
	`url` varchar(512) NOT NULL,
	`contentType` varchar(40) NOT NULL,
	`byteSize` int NOT NULL,
	`originalName` varchar(160),
	`uploadedBy` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`stateHash` varchar(64) NOT NULL,
	`provider` varchar(20) NOT NULL,
	`environment` enum('sandbox','production') NOT NULL,
	`redirectUri` varchar(512) NOT NULL,
	`createdBy` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oauth_states_stateHash` PRIMARY KEY(`stateHash`)
);
--> statement-breakpoint
CREATE TABLE `page_view_daily` (
	`day` date NOT NULL,
	`path` varchar(160) NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	CONSTRAINT `page_view_daily_day_path_pk` PRIMARY KEY(`day`,`path`)
);
--> statement-breakpoint
CREATE TABLE `payment_requests` (
	`id` varchar(41) NOT NULL,
	`token` varchar(64) NOT NULL,
	`jobId` varchar(40) NOT NULL,
	`customerId` varchar(40) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'CAD',
	`description` varchar(200) NOT NULL,
	`status` enum('open','paid','cancelled') NOT NULL DEFAULT 'open',
	`checkoutSessionId` varchar(255),
	`paymentIntentId` varchar(255),
	`ledgerPaymentId` varchar(40),
	`lastError` varchar(300),
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_requests_token_unique` UNIQUE(`token`),
	CONSTRAINT `payment_requests_intent_unique` UNIQUE(`paymentIntentId`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` varchar(41) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`title` varchar(140) NOT NULL,
	`excerpt` varchar(320) NOT NULL,
	`body` text NOT NULL,
	`category` enum('tips','project','news') NOT NULL DEFAULT 'tips',
	`serviceSlug` varchar(32),
	`areaName` varchar(120),
	`coverImageUrl` varchar(512),
	`coverImageAlt` varchar(200),
	`seoTitle` varchar(80),
	`seoDescription` varchar(180),
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `posts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `session_source_daily` (
	`day` date NOT NULL,
	`source` varchar(100) NOT NULL,
	`medium` varchar(40) NOT NULL,
	`sessions` int NOT NULL DEFAULT 0,
	CONSTRAINT `session_source_daily_day_source_medium_pk` PRIMARY KEY(`day`,`source`,`medium`)
);
--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`id` varchar(255) NOT NULL,
	`type` varchar(80) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripe_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(20) NOT NULL,
	`action` varchar(40) NOT NULL,
	`localId` varchar(41),
	`outcome` enum('success','error') NOT NULL,
	`message` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `status` enum('new','contacted','closed','quoted','won','lost') NOT NULL DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `leads` ADD `internalNote` varchar(1000);--> statement-breakpoint
ALTER TABLE `leads` ADD `statusChangedAt` timestamp;--> statement-breakpoint
ALTER TABLE `payments` ADD `source` enum('manual','stripe') DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payment_requests_job_idx` ON `payment_requests` (`jobId`);--> statement-breakpoint
CREATE INDEX `posts_status_published_idx` ON `posts` (`status`,`publishedAt`);--> statement-breakpoint
CREATE INDEX `sync_events_created_idx` ON `sync_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `leads_created_idx` ON `leads` (`createdAt`);--> statement-breakpoint
CREATE INDEX `payments_recorded_idx` ON `payments` (`recordedAt`);