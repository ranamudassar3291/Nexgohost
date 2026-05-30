CREATE TYPE "public"."admin_permission" AS ENUM('super_admin', 'full', 'support', 'limited');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'client');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."hosting_status" AS ENUM('active', 'suspended', 'terminated', 'pending', 'pending_termination');--> statement-breakpoint
CREATE TYPE "public"."domain_status" AS ENUM('active', 'expired', 'pending', 'pending_activation', 'transferred', 'suspended', 'cancelled', 'pending_transfer', 'grace_period', 'redemption_period', 'pending_delete', 'client_hold');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'approved', 'cancelled', 'completed', 'suspended', 'fraud', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('hosting', 'domain', 'upgrade', 'renewal');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('unpaid', 'payment_pending', 'paid', 'cancelled', 'overdue', 'refunded', 'collections');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('stripe', 'paypal', 'jazzcash', 'easypaisa', 'bank_transfer', 'crypto', 'manual', 'safepay');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('success', 'failed', 'pending', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."sender_role" AS ENUM('admin', 'client');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'closed', 'pending', 'answered');--> statement-breakpoint
CREATE TYPE "public"."migration_source_type" AS ENUM('cpanel', 'whm');--> statement-breakpoint
CREATE TYPE "public"."migration_status_enum" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."extension_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."server_status" AS ENUM('active', 'inactive', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."server_type" AS ENUM('cpanel', 'directadmin', 'plesk', '20i', 'none');--> statement-breakpoint
CREATE TYPE "public"."cron_status" AS ENUM('success', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."fraud_status" AS ENUM('flagged', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."affiliate_status" AS ENUM('active', 'suspended', 'pending');--> statement-breakpoint
CREATE TYPE "public"."commission_status" AS ENUM('pending', 'approved', 'paid', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."commission_type" AS ENUM('fixed', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."payout_method" AS ENUM('wallet', 'bank');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('registered', 'converted', 'invalid');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('pending', 'approved', 'paid', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('pending', 'validating', 'approved', 'rejected', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."credit_tx_type" AS ENUM('affiliate_payout', 'invoice_payment', 'admin_add', 'admin_deduct', 'refund');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('invoice', 'ticket', 'domain', 'affiliate', 'order', 'payment', 'system', 'security');--> statement-breakpoint
CREATE TYPE "public"."activity_status" AS ENUM('success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('login_success', 'login_failed', 'login_2fa', 'password_change', '2fa_enabled', '2fa_disabled', 'logout', 'profile_update');--> statement-breakpoint
CREATE TYPE "public"."security_event" AS ENUM('login_failed', 'login_blocked', 'captcha_failed', 'ip_blocked', 'bot_blocked', 'brute_force', 'suspicious_scan');--> statement-breakpoint
CREATE TYPE "public"."module_status" AS ENUM('active', 'inactive', 'error');--> statement-breakpoint
CREATE TYPE "public"."module_type" AS ENUM('server', 'gateway', 'registrar');--> statement-breakpoint
CREATE TYPE "public"."registrar_type" AS ENUM('namecheap', 'logicboxes', 'resellerclub', 'enom', 'opensrs', 'spaceship', 'custom', 'none');--> statement-breakpoint
CREATE TYPE "public"."wa_event_type" AS ENUM('new_order', 'new_ticket', 'payment_proof', 'test', 'other', 'refund_request', 'invoice_paid', 'client_notification', 'admin_command', 'suspension_warning');--> statement-breakpoint
CREATE TYPE "public"."abuse_classification" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."abuse_status" AS ENUM('pending', 'analyzing', 'warning_sent', 'suspended', 'critical_lockdown', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."abuse_type" AS ENUM('spam', 'phishing', 'malware', 'ddos', 'copyright', 'harassment', 'dmca', 'child_safety', 'other');--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"company" text,
	"phone" text,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"admin_permission" "admin_permission",
	"email_verified" boolean DEFAULT false NOT NULL,
	"verification_code" text,
	"verification_expires_at" timestamp,
	"two_factor_secret" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"username" text,
	"google_id" text,
	"credit_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"country" text,
	"billing_currency" text,
	"stack_user_id" text,
	"can_migrate" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "hosting_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"yearly_price" numeric(10, 2),
	"quarterly_price" numeric(10, 2),
	"semiannual_price" numeric(10, 2),
	"billing_cycle" "billing_cycle" DEFAULT 'monthly' NOT NULL,
	"group_id" text,
	"module" text DEFAULT 'none',
	"module_server_id" text,
	"module_server_group_id" text,
	"module_plan_id" text,
	"module_plan_name" text,
	"disk_space" text NOT NULL,
	"bandwidth" text NOT NULL,
	"email_accounts" integer DEFAULT 10,
	"databases" integer DEFAULT 5,
	"subdomains" integer DEFAULT 10,
	"ftp_accounts" integer DEFAULT 5,
	"is_active" boolean DEFAULT true,
	"features" text[] DEFAULT '{}',
	"renewal_enabled" boolean DEFAULT true,
	"renewal_price" numeric(10, 2),
	"free_domain_enabled" boolean DEFAULT false,
	"free_domain_tlds" text[] DEFAULT '{}',
	"save_amount" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosting_services" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"order_id" text,
	"plan_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"domain" text,
	"username" text,
	"password" text,
	"server_id" text,
	"server_ip" text DEFAULT '192.168.1.1',
	"status" "hosting_status" DEFAULT 'pending' NOT NULL,
	"billing_cycle" text DEFAULT 'monthly',
	"next_due_date" timestamp,
	"ssl_status" text DEFAULT 'not_installed',
	"start_date" timestamp DEFAULT now(),
	"expiry_date" timestamp,
	"disk_used" text DEFAULT '0 MB',
	"bandwidth_used" text DEFAULT '0 GB',
	"cpanel_url" text,
	"webmail_url" text,
	"cancel_requested" boolean DEFAULT false,
	"cancel_reason" text,
	"cancel_requested_at" timestamp,
	"auto_renew" boolean DEFAULT true,
	"free_domain_available" boolean DEFAULT false,
	"free_domain_id" text,
	"wp_installed" boolean DEFAULT false,
	"wp_url" text,
	"wp_username" text,
	"wp_password" text,
	"wp_email" text,
	"wp_site_title" text,
	"wp_db_name" text,
	"wp_container_id" text,
	"wp_port" integer,
	"wp_provision_status" text DEFAULT 'not_started',
	"wp_provision_step" text,
	"wp_provision_error" text,
	"wp_provisioned_at" timestamp,
	"wp_install_path" text DEFAULT '/',
	"wp_password_revealed" boolean DEFAULT false,
	"service_type" text DEFAULT 'shared',
	"vps_plan_id" text,
	"vps_os_template" text,
	"vps_location" text,
	"vps_hostname" text,
	"vps_root_user" text,
	"vps_root_password" text,
	"vps_image_id" text,
	"vps_auto_renew" boolean DEFAULT true,
	"vps_weekly_backups" boolean DEFAULT false,
	"vps_provision_status" text DEFAULT 'not_started',
	"vps_provisioned_at" timestamp,
	"vps_provision_notes" text,
	"whmcs_id" text,
	"twenty_i_package_id" text,
	"amount" numeric(10, 2),
	"usage_cache" text,
	"usage_cached_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dns_records" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"domain" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"ttl" integer DEFAULT 3600,
	"priority" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_pricing" (
	"id" text PRIMARY KEY NOT NULL,
	"tld" text NOT NULL,
	"registration_price" numeric(10, 2) NOT NULL,
	"renewal_price" numeric(10, 2) NOT NULL,
	"transfer_price" numeric(10, 2) DEFAULT '10.00',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domain_pricing_tld_unique" UNIQUE("tld")
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"tld" text NOT NULL,
	"registrar" text DEFAULT '',
	"registration_date" timestamp DEFAULT now(),
	"expiry_date" timestamp,
	"next_due_date" timestamp,
	"status" "domain_status" DEFAULT 'pending' NOT NULL,
	"lock_status" text DEFAULT 'locked',
	"auto_renew" boolean DEFAULT true,
	"nameservers" text[] DEFAULT '{}',
	"module_server_id" text,
	"transfer_id" text,
	"is_free_domain" boolean DEFAULT false,
	"epp_code" text,
	"last_lock_change" timestamp,
	"lock_override_by_admin" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"type" "order_type" NOT NULL,
	"item_id" text,
	"item_name" text NOT NULL,
	"domain" text,
	"amount" numeric(10, 2) NOT NULL,
	"billing_cycle" text DEFAULT 'monthly',
	"due_date" timestamp,
	"module_type" text DEFAULT 'none',
	"module_plan_id" text,
	"module_plan_name" text,
	"module_server_id" text,
	"payment_status" text DEFAULT 'unpaid',
	"invoice_id" text,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"whmcs_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"client_id" text NOT NULL,
	"order_id" text,
	"service_id" text,
	"invoice_type" text DEFAULT 'hosting',
	"amount" numeric(10, 2) NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) NOT NULL,
	"status" "invoice_status" DEFAULT 'unpaid' NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payment_ref" text,
	"payment_gateway_id" text,
	"payment_notes" text,
	"currency_code" text DEFAULT 'PKR',
	"currency_symbol" text DEFAULT 'Rs.',
	"currency_rate" numeric(12, 6) DEFAULT '1',
	"base_currency_amount" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"invoice_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"transaction_ref" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"sender_name" text NOT NULL,
	"sender_role" "sender_role" NOT NULL,
	"message" text NOT NULL,
	"attachments" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_number" text NOT NULL,
	"client_id" text NOT NULL,
	"subject" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"department" text DEFAULT 'General',
	"messages_count" integer DEFAULT 0,
	"last_reply" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "migrations_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"domain" text NOT NULL,
	"old_hosting_provider" text,
	"old_cpanel_host" text NOT NULL,
	"old_cpanel_username" text NOT NULL,
	"old_cpanel_password" text NOT NULL,
	"source_type" "migration_source_type" DEFAULT 'cpanel',
	"whm_account" text,
	"twentyi_job_id" text,
	"twentyi_site_id" text,
	"status" "migration_status_enum" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0,
	"notes" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"discount_type" text DEFAULT 'percent' NOT NULL,
	"discount_percent" integer DEFAULT 0 NOT NULL,
	"fixed_amount" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"applicable_to" text DEFAULT 'all' NOT NULL,
	"applicable_group_id" text,
	"applicable_domain_tld" text,
	"applicable_plan_id" text,
	"billing_cycle_lock" text DEFAULT 'all' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_sandbox" boolean DEFAULT true NOT NULL,
	"settings" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_extensions" (
	"id" text PRIMARY KEY NOT NULL,
	"extension" text NOT NULL,
	"register_price" numeric(10, 2) NOT NULL,
	"register_2_year_price" numeric(10, 2),
	"register_3_year_price" numeric(10, 2),
	"renewal_price" numeric(10, 2) NOT NULL,
	"renew_2_year_price" numeric(10, 2),
	"renew_3_year_price" numeric(10, 2),
	"transfer_price" numeric(10, 2) NOT NULL,
	"privacy_enabled" boolean DEFAULT true NOT NULL,
	"is_free_with_hosting" boolean DEFAULT false NOT NULL,
	"transfer_allowed" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 999 NOT NULL,
	"show_in_suggestions" boolean DEFAULT true NOT NULL,
	"status" "extension_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domain_extensions_extension_unique" UNIQUE("extension")
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"exchange_rate" numeric(10, 4) DEFAULT '1.0000' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "currencies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hostname" text NOT NULL,
	"ip_address" text,
	"type" "server_type" DEFAULT 'cpanel' NOT NULL,
	"api_username" text,
	"api_token" text,
	"key_type" text DEFAULT 'general',
	"api_port" integer DEFAULT 2087,
	"proxy_url" text,
	"twentyi_base_url" text,
	"ns1" text,
	"ns2" text,
	"max_accounts" integer DEFAULT 500,
	"status" "server_status" DEFAULT 'active' NOT NULL,
	"group_id" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"api_connected" boolean DEFAULT false NOT NULL,
	"server_ip" text,
	"last_connected" timestamp,
	"connection_status_detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"variables" text[] DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cron_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"task" text NOT NULL,
	"status" "cron_status" DEFAULT 'success' NOT NULL,
	"message" text,
	"executed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fraud_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"client_id" text NOT NULL,
	"ip_address" text,
	"email" text,
	"risk_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"reasons" text[] DEFAULT '{}',
	"status" "fraud_status" DEFAULT 'flagged' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text,
	"email" text NOT NULL,
	"email_type" text DEFAULT 'system' NOT NULL,
	"subject" text,
	"reference_id" text,
	"status" text DEFAULT 'success' NOT NULL,
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text,
	"server_id" text,
	"action" text NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"request" text,
	"response" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"email" text,
	"action" text NOT NULL,
	"method" text DEFAULT 'password' NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_clicks" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliate_id" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_commissions" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliate_id" text NOT NULL,
	"referred_user_id" text,
	"order_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"status" "commission_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_group_commissions" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"group_name" text NOT NULL,
	"commission_type_gc" "commission_type" DEFAULT 'fixed' NOT NULL,
	"commission_value_gc" numeric(10, 2) DEFAULT '500' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_group_commissions_group_id_unique" UNIQUE("group_id")
);
--> statement-breakpoint
CREATE TABLE "affiliate_plan_commissions" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"plan_type" text DEFAULT 'hosting' NOT NULL,
	"commission_type_pc" "commission_type" DEFAULT 'fixed' NOT NULL,
	"commission_value_pc" numeric(10, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"yearly_only" boolean DEFAULT true NOT NULL,
	"yearly_price" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliate_id" text NOT NULL,
	"referred_user_id" text NOT NULL,
	"status" "referral_status" DEFAULT 'registered' NOT NULL,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_withdrawals" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliate_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "withdrawal_status" DEFAULT 'pending' NOT NULL,
	"payout_method" "payout_method" DEFAULT 'bank' NOT NULL,
	"paypal_email" text,
	"account_title" text,
	"account_number" text,
	"bank_name" text,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"referral_code" text NOT NULL,
	"status" "affiliate_status" DEFAULT 'active' NOT NULL,
	"commission_type" "commission_type" DEFAULT 'percentage' NOT NULL,
	"commission_value" numeric(10, 2) DEFAULT '10' NOT NULL,
	"total_earnings" numeric(10, 2) DEFAULT '0' NOT NULL,
	"pending_earnings" numeric(10, 2) DEFAULT '0' NOT NULL,
	"paid_earnings" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"total_signups" integer DEFAULT 0 NOT NULL,
	"total_conversions" integer DEFAULT 0 NOT NULL,
	"paypal_email" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "affiliates_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "affiliates_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "domain_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"domain_name" text NOT NULL,
	"epp" text NOT NULL,
	"status" "transfer_status" DEFAULT 'pending' NOT NULL,
	"validation_message" text,
	"admin_notes" text,
	"price" numeric(10, 2),
	"invoice_id" text,
	"order_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"type" "credit_tx_type" NOT NULL,
	"description" text,
	"invoice_id" text,
	"withdrawal_id" text,
	"performed_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" "activity_type" NOT NULL,
	"ip" text,
	"user_agent" text,
	"status" "activity_status" DEFAULT 'success' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_backup_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"triggered_by" text DEFAULT 'cron' NOT NULL,
	"db_file_id" text,
	"db_file_name" text,
	"files_file_id" text,
	"files_file_name" text,
	"db_size_kb" integer,
	"files_size_kb" integer,
	"drive_used_mb" integer,
	"drive_total_mb" integer,
	"drive_db_folder_id" text,
	"drive_files_folder_id" text,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "google_drive_tokens" (
	"id" text PRIMARY KEY DEFAULT 'primary' NOT NULL,
	"email" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"root_folder_id" text,
	"db_folder_id" text,
	"files_folder_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosting_backups" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"client_id" text NOT NULL,
	"domain" text NOT NULL,
	"file_path" text,
	"sql_path" text,
	"size_mb" numeric(10, 2),
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"type" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vps_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"country_name" text NOT NULL,
	"country_code" text NOT NULL,
	"flag_icon" text,
	"city" text,
	"datacenter" text,
	"network_speed" text DEFAULT '1 Gbps',
	"latency_ms" integer DEFAULT 10,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vps_os_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"icon_url" text,
	"image_id" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vps_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"quarterly_price" numeric(10, 2),
	"semiannual_price" numeric(10, 2),
	"yearly_price" numeric(10, 2),
	"biennial_price" numeric(10, 2),
	"cpu_cores" integer DEFAULT 1 NOT NULL,
	"ram_gb" integer DEFAULT 1 NOT NULL,
	"storage_gb" integer DEFAULT 20 NOT NULL,
	"bandwidth_tb" numeric(5, 2) DEFAULT '1',
	"virtualization" text DEFAULT 'KVM',
	"features" text[] DEFAULT '{}',
	"os_template_ids" text[] DEFAULT '{}',
	"location_ids" text[] DEFAULT '{}',
	"save_amount" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_articles" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"title" text NOT NULL,
	"title_ur" text,
	"title_ar" text,
	"slug" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"excerpt" text,
	"excerpt_ur" text,
	"excerpt_ar" text,
	"seo_title" text,
	"seo_description" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"helpful_yes" integer DEFAULT 0 NOT NULL,
	"helpful_no" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kb_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "kb_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"name_ar" text,
	"slug" text NOT NULL,
	"description" text,
	"description_ur" text,
	"description_ar" text,
	"icon" text DEFAULT 'BookOpen',
	"sort_order" integer DEFAULT 0,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kb_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "kb_deflections" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"article_id" text NOT NULL,
	"article_title" text NOT NULL,
	"article_slug" text NOT NULL,
	"ticket_subject" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_activation_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"domain_id" text,
	"client_id" text NOT NULL,
	"domain_fqdn" text NOT NULL,
	"registrar_id" text,
	"registrar_name" text DEFAULT 'manual' NOT NULL,
	"registrar_type" text DEFAULT 'none' NOT NULL,
	"cost_usd" numeric(10, 4),
	"cost_pkr" numeric(10, 2),
	"client_paid_pkr" numeric(10, 2),
	"profit_pkr" numeric(10, 2),
	"usd_to_pkr" numeric(10, 4),
	"api_success" text DEFAULT 'true',
	"api_error" text,
	"notes" text,
	"activated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_ips" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_address" text NOT NULL,
	"reason" text NOT NULL,
	"failed_attempts" integer DEFAULT 0,
	"blocked_until" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_ips_ip_address_unique" UNIQUE("ip_address")
);
--> statement-breakpoint
CREATE TABLE "ip_whitelist" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_address" text NOT NULL,
	"label" text,
	"added_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ip_whitelist_ip_address_unique" UNIQUE("ip_address")
);
--> statement-breakpoint
CREATE TABLE "migration_whitelist" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_address" text NOT NULL,
	"label" text,
	"added_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "migration_whitelist_ip_address_unique" UNIQUE("ip_address")
);
--> statement-breakpoint
CREATE TABLE "security_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"event" "security_event" NOT NULL,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"email" text,
	"path" text,
	"details" text,
	"country" text,
	"blocked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_modules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "module_type" DEFAULT 'gateway' NOT NULL,
	"version" text DEFAULT '1.0.0',
	"description" text,
	"config_fields" text DEFAULT '[]' NOT NULL,
	"config" text DEFAULT '{}' NOT NULL,
	"hooks" text DEFAULT '[]' NOT NULL,
	"folder_path" text,
	"status" "module_status" DEFAULT 'inactive' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uploaded_modules_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "domain_registrars" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "registrar_type" DEFAULT 'none' NOT NULL,
	"description" text,
	"config" text DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"last_tested_at" timestamp,
	"last_test_result" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" "wa_event_type" DEFAULT 'other' NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'hosting' NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 80 NOT NULL,
	"check_type" text DEFAULT 'http' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"package_id" text,
	"package_name" text,
	"domain_name" text,
	"billing_cycle" text DEFAULT 'monthly',
	"completed" boolean DEFAULT false NOT NULL,
	"reminder_sent" boolean DEFAULT false NOT NULL,
	"promo_code" text,
	"abandoned_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"reminder_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"html_body" text NOT NULL,
	"recipient_type" text DEFAULT 'selected' NOT NULL,
	"recipient_ids" jsonb DEFAULT '[]'::jsonb,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_unsubscribes" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"user_id" text,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_unsubscribes_email_unique" UNIQUE("email"),
	CONSTRAINT "email_unsubscribes_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"item_type" text DEFAULT 'hosting',
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"monthly_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"quarterly_price" numeric(10, 2),
	"semiannual_price" numeric(10, 2),
	"yearly_price" numeric(10, 2),
	"renewal_price" numeric(10, 2),
	"renewal_enabled" text DEFAULT 'false',
	"domain_name" text,
	"tld" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_cart_items" (
	"id" text PRIMARY KEY NOT NULL,
	"guest_session_token" text NOT NULL,
	"plan_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"item_type" text DEFAULT 'hosting',
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"monthly_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"quarterly_price" numeric(10, 2),
	"semiannual_price" numeric(10, 2),
	"yearly_price" numeric(10, 2),
	"renewal_price" numeric(10, 2),
	"renewal_enabled" text DEFAULT 'false',
	"domain_name" text,
	"tld" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_slug" varchar(120) NOT NULL,
	"page_title" varchar(200) NOT NULL,
	"meta_description" text,
	"keywords" text,
	"sections_json" text NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_pages_page_slug_unique" UNIQUE("page_slug")
);
--> statement-breakpoint
CREATE TABLE "abuse_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"action_type" text NOT NULL,
	"action_note" text,
	"performed_by" text NOT NULL,
	"performed_by_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "abuse_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"file_name" text,
	"file_url" text,
	"mime_type" text,
	"description" text,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "abuse_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"report_number" text NOT NULL,
	"reporter_email" text NOT NULL,
	"reporter_name" text,
	"reporter_org" text,
	"abuse_type" "abuse_type" DEFAULT 'spam' NOT NULL,
	"target_domain" text,
	"target_ip" text,
	"evidence_logs" text NOT NULL,
	"service_id" text,
	"client_id" text,
	"status" "abuse_status" DEFAULT 'pending' NOT NULL,
	"is_valid" boolean DEFAULT null,
	"analysis_notes" text,
	"threat_score" integer DEFAULT 0,
	"classification" "abuse_classification" DEFAULT 'low',
	"source_credibility" text,
	"is_dmca" boolean DEFAULT false,
	"dmca_deadline_at" timestamp,
	"counter_notice_at" timestamp,
	"counter_notice_text" text,
	"warning_email_sent_at" timestamp,
	"warning_deadline" timestamp,
	"suspended_at" timestamp,
	"resolved_at" timestamp,
	"resolved_by" text,
	"resolved_note" text,
	"dismissed_at" timestamp,
	"dismissed_by" text,
	"dismiss_reason" text,
	"ticket_id" text,
	"auto_suspended" boolean DEFAULT false,
	"notified_client_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "abuse_reports_report_number_unique" UNIQUE("report_number")
);
--> statement-breakpoint
CREATE TABLE "abuse_reputation" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_email" text,
	"total_reports" integer DEFAULT 0,
	"valid_reports" integer DEFAULT 0,
	"threat_score_sum" integer DEFAULT 0,
	"avg_threat_score" integer DEFAULT 0,
	"max_threat_score" integer DEFAULT 0,
	"last_report_at" timestamp,
	"is_permanently_banned" boolean DEFAULT false,
	"ban_reason" text,
	"banned_at" timestamp,
	"banned_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "abuse_reputation_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_category_id_kb_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."kb_categories"("id") ON DELETE cascade ON UPDATE no action;