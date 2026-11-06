ALTER TABLE `consent_events` MODIFY COLUMN `occurredAt` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` MODIFY COLUMN `firstContactAt` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` MODIFY COLUMN `lastContactAt` timestamp(3) NOT NULL;