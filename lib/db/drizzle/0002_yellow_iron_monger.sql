ALTER TYPE "public"."activity_type" ADD VALUE 'order_placed';--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'domain_registered';--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'domain_transferred';--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'domain_renewed';--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'invoice_paid';--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'ticket_opened';--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'account_registered';--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'password_reset_requested';--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'support_ticket_created';--> statement-breakpoint
ALTER TABLE "activity_logs" ADD COLUMN "user_email" text;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD COLUMN "description" text;