CREATE TABLE `customers` (
	`id` varchar(40) NOT NULL,
	`normalizedEmail` varchar(320) NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(100) NOT NULL,
	`phone` varchar(40),
	`serviceArea` varchar(120),
	`firstContactAt` timestamp NOT NULL,
	`lastContactAt` timestamp NOT NULL,
	`marketingConsentAt` timestamp,
	`marketingConsentSource` varchar(40),
	`marketingConsentVersion` varchar(40),
	`marketingOptOutAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_normalizedEmail_unique` UNIQUE(`normalizedEmail`)
);
--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` varchar(40) NOT NULL,
	`customerId` varchar(40) NOT NULL,
	`leadId` int,
	`jobId` varchar(40),
	`type` enum('quote','service','seasonal') NOT NULL,
	`title` varchar(140) NOT NULL,
	`note` varchar(1000),
	`dueAt` timestamp NOT NULL,
	`status` enum('open','completed','cancelled') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `follow_ups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` varchar(40) NOT NULL,
	`customerId` varchar(40) NOT NULL,
	`leadId` int,
	`service` varchar(32) NOT NULL,
	`summary` varchar(2000) NOT NULL,
	`quotedAmount` decimal(10,2),
	`bookedAmount` decimal(10,2),
	`currency` varchar(3) NOT NULL DEFAULT 'CAD',
	`status` enum('quoted','booked','in_progress','completed','cancelled') NOT NULL DEFAULT 'quoted',
	`scheduledAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` varchar(40) NOT NULL,
	`jobId` varchar(40) NOT NULL,
	`kind` enum('payment','refund') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'CAD',
	`recordedAt` timestamp NOT NULL,
	`reference` varchar(120),
	`note` varchar(1000),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leads` ADD `customerId` varchar(40);--> statement-breakpoint
ALTER TABLE `leads` ADD `landingPath` varchar(255);--> statement-breakpoint
ALTER TABLE `leads` ADD `utmSource` varchar(120);--> statement-breakpoint
ALTER TABLE `leads` ADD `utmMedium` varchar(120);--> statement-breakpoint
ALTER TABLE `leads` ADD `utmCampaign` varchar(160);--> statement-breakpoint
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `followups_customer_id_idx` ON `follow_ups` (`customerId`);--> statement-breakpoint
CREATE INDEX `followups_status_due_idx` ON `follow_ups` (`status`,`dueAt`);--> statement-breakpoint
CREATE INDEX `jobs_customer_id_idx` ON `jobs` (`customerId`);--> statement-breakpoint
CREATE INDEX `payments_job_id_idx` ON `payments` (`jobId`);--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_customer_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `leads_customer_id_idx` ON `leads` (`customerId`);--> statement-breakpoint
INSERT INTO `customers` (
	`id`, `normalizedEmail`, `email`, `name`, `phone`, `serviceArea`,
	`firstContactAt`, `lastContactAt`, `createdAt`, `updatedAt`
)
SELECT
	CONCAT('cus_', UUID()),
	LOWER(TRIM(`email`)),
	MAX(`email`),
	MAX(`name`),
	MAX(`phone`),
	MAX(`area`),
	MIN(`createdAt`),
	MAX(`createdAt`),
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP
FROM `leads`
WHERE TRIM(`email`) <> ''
GROUP BY LOWER(TRIM(`email`));--> statement-breakpoint
UPDATE `leads` AS `leadRecord`
JOIN `customers` AS `crmCustomer`
	ON `crmCustomer`.`normalizedEmail` = LOWER(TRIM(`leadRecord`.`email`))
SET `leadRecord`.`customerId` = `crmCustomer`.`id`;
