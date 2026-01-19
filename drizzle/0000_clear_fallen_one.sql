CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text,
	`macAddress` text,
	`eventType` text NOT NULL,
	`ipAddress` text,
	`details` text,
	`createdAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_logs_user` ON `activity_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_logs_type` ON `activity_logs` (`eventType`);--> statement-breakpoint
CREATE INDEX `idx_logs_created` ON `activity_logs` (`createdAt`);--> statement-breakpoint
CREATE TABLE `guests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`macAddress` text NOT NULL,
	`ipAddress` text,
	`deviceInfo` text,
	`authorizedAt` integer,
	`expiresAt` integer NOT NULL,
	`lastSeen` integer,
	`authCount` integer DEFAULT 1,
	`nickname` text,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_guests_mac` ON `guests` (`macAddress`);--> statement-breakpoint
CREATE INDEX `idx_guests_expires` ON `guests` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `idx_guests_user` ON `guests` (`userId`);--> statement-breakpoint
CREATE TABLE `network_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`macAddress` text NOT NULL,
	`timestamp` integer,
	`bytesReceived` integer DEFAULT 0,
	`bytesSent` integer DEFAULT 0,
	`domains` text,
	`signalStrength` integer,
	`apMacAddress` text
);
--> statement-breakpoint
CREATE INDEX `idx_stats_mac` ON `network_stats` (`macAddress`);--> statement-breakpoint
CREATE INDEX `idx_stats_timestamp` ON `network_stats` (`timestamp`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`identifier` text NOT NULL,
	`action` text NOT NULL,
	`attempts` integer DEFAULT 0,
	`lastAttempt` integer,
	`lockedUntil` integer
);
--> statement-breakpoint
CREATE INDEX `idx_rate_identifier` ON `rate_limits` (`identifier`,`action`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `twoFactor` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`secret` text NOT NULL,
	`backupCodes` text,
	`createdAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false,
	`name` text,
	`password` text,
	`role` text DEFAULT 'guest' NOT NULL,
	`twoFactorEnabled` integer DEFAULT false,
	`twoFactorSecret` text,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`code` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`used` integer DEFAULT false,
	`attempts` integer DEFAULT 0,
	`resendCount` integer DEFAULT 0,
	`lastResentAt` integer,
	`macAddress` text,
	`name` text,
	`createdAt` integer
);
--> statement-breakpoint
CREATE INDEX `idx_verification_email` ON `verification_codes` (`email`);--> statement-breakpoint
CREATE INDEX `idx_verification_code` ON `verification_codes` (`code`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
