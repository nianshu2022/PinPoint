CREATE INDEX `idx_date_taken` ON `photos` (`date_taken`);--> statement-breakpoint
CREATE INDEX `idx_storage_key` ON `photos` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_pipeline_queue_status` ON `pipeline_queue` (`status`);