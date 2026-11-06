CREATE TABLE `consent_events` (
	`id` varchar(40) NOT NULL,
	`customerId` varchar(40) NOT NULL,
	`kind` enum('opt_in','opt_out') NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`source` varchar(40) NOT NULL,
	`wordingVersion` varchar(40),
	`consentText` text,
	CONSTRAINT `consent_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `consent_events` ADD CONSTRAINT `consent_events_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `consent_events_customer_idx` ON `consent_events` (`customerId`,`occurredAt`);
--> statement-breakpoint
INSERT INTO `consent_events` (`id`, `customerId`, `kind`, `occurredAt`, `source`, `wordingVersion`)
SELECT CONCAT('evt_', UUID()), `id`, 'opt_in', `marketingConsentAt`, COALESCE(`marketingConsentSource`, 'prior_record'), `marketingConsentVersion`
FROM `customers` WHERE `marketingConsentAt` IS NOT NULL;
--> statement-breakpoint
INSERT INTO `consent_events` (`id`, `customerId`, `kind`, `occurredAt`, `source`)
SELECT CONCAT('evt_', UUID()), `id`, 'opt_out', `marketingOptOutAt`, 'prior_record'
FROM `customers` WHERE `marketingOptOutAt` IS NOT NULL;
