CREATE TABLE `adminLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`action` varchar(128) NOT NULL,
	`targetType` varchar(64),
	`targetId` int,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliateLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`associateId` varchar(128) NOT NULL,
	`affiliateUrl` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliateLinks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`eventType` enum('click','view','conversion','share') NOT NULL,
	`userId` varchar(128),
	`sessionId` varchar(128),
	`referrer` text,
	`userAgent` text,
	`ipAddress` varchar(45),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`imageKey` varchar(255) NOT NULL,
	`isGenerated` boolean DEFAULT false,
	`prompt` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `productImages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`asin` varchar(64) NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`price` decimal(10,2),
	`originalPrice` decimal(10,2),
	`discount` int DEFAULT 0,
	`category` varchar(128),
	`rating` decimal(3,1),
	`reviewCount` int DEFAULT 0,
	`inStock` boolean DEFAULT true,
	`isPrime` boolean DEFAULT false,
	`source` varchar(64) DEFAULT 'amazon',
	`productUrl` text,
	`imageUrl` text,
	`imageKey` varchar(255),
	`seoDescription` text,
	`pinterestCaption` text,
	`tags` text,
	`clickCount` int DEFAULT 0,
	`conversionCount` int DEFAULT 0,
	`conversionRate` decimal(5,2) DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_asin_unique` UNIQUE(`asin`)
);
