CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(40),
	`service` varchar(32) NOT NULL,
	`area` varchar(120),
	`projectType` enum('residential','commercial') NOT NULL,
	`details` text NOT NULL,
	`consentAt` timestamp NOT NULL,
	`sourcePath` varchar(255),
	`status` enum('new','contacted','closed') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
