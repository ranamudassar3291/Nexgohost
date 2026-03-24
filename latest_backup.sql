--
-- PostgreSQL database dump
--

\restrict oX4GxwY9lkpc1oXOJgJpbUu47FnslssQhVp2E8MjXyR3wM4xZZRg2CfESZujsdU

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: activity_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.activity_status AS ENUM (
    'success',
    'failed'
);


ALTER TYPE public.activity_status OWNER TO postgres;

--
-- Name: activity_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.activity_type AS ENUM (
    'login_success',
    'login_failed',
    'login_2fa',
    'password_change',
    '2fa_enabled',
    '2fa_disabled',
    'logout',
    'profile_update'
);


ALTER TYPE public.activity_type OWNER TO postgres;

--
-- Name: affiliate_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.affiliate_status AS ENUM (
    'active',
    'suspended',
    'pending'
);


ALTER TYPE public.affiliate_status OWNER TO postgres;

--
-- Name: billing_cycle; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.billing_cycle AS ENUM (
    'monthly',
    'yearly'
);


ALTER TYPE public.billing_cycle OWNER TO postgres;

--
-- Name: commission_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.commission_status AS ENUM (
    'pending',
    'approved',
    'paid',
    'rejected'
);


ALTER TYPE public.commission_status OWNER TO postgres;

--
-- Name: commission_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.commission_type AS ENUM (
    'fixed',
    'percentage'
);


ALTER TYPE public.commission_type OWNER TO postgres;

--
-- Name: credit_tx_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.credit_tx_type AS ENUM (
    'affiliate_payout',
    'invoice_payment',
    'admin_add',
    'admin_deduct',
    'refund'
);


ALTER TYPE public.credit_tx_type OWNER TO postgres;

--
-- Name: cron_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cron_status AS ENUM (
    'success',
    'failed',
    'skipped'
);


ALTER TYPE public.cron_status OWNER TO postgres;

--
-- Name: domain_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.domain_status AS ENUM (
    'active',
    'expired',
    'pending',
    'transferred',
    'suspended',
    'cancelled',
    'pending_transfer'
);


ALTER TYPE public.domain_status OWNER TO postgres;

--
-- Name: extension_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.extension_status AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE public.extension_status OWNER TO postgres;

--
-- Name: fraud_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.fraud_status AS ENUM (
    'flagged',
    'approved',
    'rejected'
);


ALTER TYPE public.fraud_status OWNER TO postgres;

--
-- Name: hosting_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.hosting_status AS ENUM (
    'active',
    'suspended',
    'terminated',
    'pending'
);


ALTER TYPE public.hosting_status OWNER TO postgres;

--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.invoice_status AS ENUM (
    'unpaid',
    'payment_pending',
    'paid',
    'cancelled',
    'overdue',
    'refunded',
    'collections'
);


ALTER TYPE public.invoice_status OWNER TO postgres;

--
-- Name: migration_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.migration_status_enum AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed'
);


ALTER TYPE public.migration_status_enum OWNER TO postgres;

--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_type AS ENUM (
    'invoice',
    'ticket',
    'domain',
    'affiliate',
    'order',
    'payment',
    'system',
    'security'
);


ALTER TYPE public.notification_type OWNER TO postgres;

--
-- Name: order_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'approved',
    'cancelled',
    'completed',
    'suspended',
    'fraud',
    'terminated'
);


ALTER TYPE public.order_status OWNER TO postgres;

--
-- Name: order_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.order_type AS ENUM (
    'hosting',
    'domain',
    'upgrade',
    'renewal'
);


ALTER TYPE public.order_type OWNER TO postgres;

--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_method AS ENUM (
    'stripe',
    'paypal',
    'jazzcash',
    'easypaisa',
    'bank_transfer',
    'crypto',
    'manual'
);


ALTER TYPE public.payment_method OWNER TO postgres;

--
-- Name: payout_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payout_method AS ENUM (
    'wallet',
    'bank'
);


ALTER TYPE public.payout_method OWNER TO postgres;

--
-- Name: referral_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.referral_status AS ENUM (
    'registered',
    'converted',
    'invalid'
);


ALTER TYPE public.referral_status OWNER TO postgres;

--
-- Name: sender_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.sender_role AS ENUM (
    'admin',
    'client'
);


ALTER TYPE public.sender_role OWNER TO postgres;

--
-- Name: server_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.server_status AS ENUM (
    'active',
    'inactive',
    'maintenance'
);


ALTER TYPE public.server_status OWNER TO postgres;

--
-- Name: server_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.server_type AS ENUM (
    'cpanel',
    'directadmin',
    'plesk',
    '20i',
    'none'
);


ALTER TYPE public.server_type OWNER TO postgres;

--
-- Name: ticket_priority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.ticket_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE public.ticket_priority OWNER TO postgres;

--
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.ticket_status AS ENUM (
    'open',
    'closed',
    'pending',
    'answered'
);


ALTER TYPE public.ticket_status OWNER TO postgres;

--
-- Name: transaction_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transaction_status AS ENUM (
    'success',
    'failed',
    'pending',
    'refunded'
);


ALTER TYPE public.transaction_status OWNER TO postgres;

--
-- Name: transfer_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transfer_status AS ENUM (
    'pending',
    'validating',
    'approved',
    'rejected',
    'completed',
    'cancelled'
);


ALTER TYPE public.transfer_status OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'client'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: user_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'suspended'
);


ALTER TYPE public.user_status OWNER TO postgres;

--
-- Name: withdrawal_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.withdrawal_status AS ENUM (
    'pending',
    'approved',
    'paid',
    'rejected'
);


ALTER TYPE public.withdrawal_status OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id text NOT NULL,
    user_id text NOT NULL,
    action public.activity_type NOT NULL,
    ip text,
    user_agent text,
    status public.activity_status DEFAULT 'success'::public.activity_status NOT NULL,
    note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: admin_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_logs (
    id text NOT NULL,
    user_id text,
    email text,
    action text NOT NULL,
    method text DEFAULT 'password'::text NOT NULL,
    status text DEFAULT 'success'::text NOT NULL,
    ip_address text,
    user_agent text,
    details text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_logs OWNER TO postgres;

--
-- Name: affiliate_clicks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.affiliate_clicks (
    id text NOT NULL,
    affiliate_id text NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.affiliate_clicks OWNER TO postgres;

--
-- Name: affiliate_commissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.affiliate_commissions (
    id text NOT NULL,
    affiliate_id text NOT NULL,
    referred_user_id text,
    order_id text,
    amount numeric(10,2) NOT NULL,
    status public.commission_status DEFAULT 'pending'::public.commission_status NOT NULL,
    description text,
    paid_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.affiliate_commissions OWNER TO postgres;

--
-- Name: affiliate_group_commissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.affiliate_group_commissions (
    id text NOT NULL,
    group_id text NOT NULL,
    group_name text NOT NULL,
    commission_type_gc public.commission_type DEFAULT 'fixed'::public.commission_type NOT NULL,
    commission_value_gc numeric(10,2) DEFAULT '500'::numeric NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.affiliate_group_commissions OWNER TO postgres;

--
-- Name: affiliate_referrals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.affiliate_referrals (
    id text NOT NULL,
    affiliate_id text NOT NULL,
    referred_user_id text NOT NULL,
    status public.referral_status DEFAULT 'registered'::public.referral_status NOT NULL,
    ip_address text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.affiliate_referrals OWNER TO postgres;

--
-- Name: affiliate_withdrawals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.affiliate_withdrawals (
    id text NOT NULL,
    affiliate_id text NOT NULL,
    amount numeric(10,2) NOT NULL,
    status public.withdrawal_status DEFAULT 'pending'::public.withdrawal_status NOT NULL,
    paypal_email text,
    admin_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    payout_method public.payout_method DEFAULT 'bank'::public.payout_method NOT NULL,
    account_title text,
    account_number text,
    bank_name text
);


ALTER TABLE public.affiliate_withdrawals OWNER TO postgres;

--
-- Name: affiliates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.affiliates (
    id text NOT NULL,
    user_id text NOT NULL,
    referral_code text NOT NULL,
    status public.affiliate_status DEFAULT 'active'::public.affiliate_status NOT NULL,
    commission_type public.commission_type DEFAULT 'percentage'::public.commission_type NOT NULL,
    commission_value numeric(10,2) DEFAULT '10'::numeric NOT NULL,
    total_earnings numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    pending_earnings numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    paid_earnings numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    total_clicks integer DEFAULT 0 NOT NULL,
    total_signups integer DEFAULT 0 NOT NULL,
    total_conversions integer DEFAULT 0 NOT NULL,
    paypal_email text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.affiliates OWNER TO postgres;

--
-- Name: credit_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credit_transactions (
    id text NOT NULL,
    user_id text NOT NULL,
    amount numeric(12,2) NOT NULL,
    type public.credit_tx_type NOT NULL,
    description text,
    invoice_id text,
    withdrawal_id text,
    performed_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.credit_transactions OWNER TO postgres;

--
-- Name: cron_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cron_logs (
    id text NOT NULL,
    task text NOT NULL,
    status public.cron_status DEFAULT 'success'::public.cron_status NOT NULL,
    message text,
    executed_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cron_logs OWNER TO postgres;

--
-- Name: currencies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.currencies (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    symbol text NOT NULL,
    exchange_rate numeric(10,4) DEFAULT 1.0000 NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.currencies OWNER TO postgres;

--
-- Name: dns_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dns_records (
    id text NOT NULL,
    service_id text NOT NULL,
    domain text NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    value text NOT NULL,
    ttl integer DEFAULT 3600,
    priority integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dns_records OWNER TO postgres;

--
-- Name: domain_extensions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.domain_extensions (
    id text NOT NULL,
    extension text NOT NULL,
    register_price numeric(10,2) NOT NULL,
    register_2_year_price numeric(10,2),
    register_3_year_price numeric(10,2),
    renewal_price numeric(10,2) NOT NULL,
    renew_2_year_price numeric(10,2),
    renew_3_year_price numeric(10,2),
    transfer_price numeric(10,2) NOT NULL,
    privacy_enabled boolean DEFAULT true NOT NULL,
    status public.extension_status DEFAULT 'active'::public.extension_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    is_free_with_hosting boolean DEFAULT false NOT NULL
);


ALTER TABLE public.domain_extensions OWNER TO postgres;

--
-- Name: domain_pricing; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.domain_pricing (
    id text NOT NULL,
    tld text NOT NULL,
    registration_price numeric(10,2) NOT NULL,
    renewal_price numeric(10,2) NOT NULL,
    transfer_price numeric(10,2) DEFAULT 10.00,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.domain_pricing OWNER TO postgres;

--
-- Name: domain_transfers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.domain_transfers (
    id text NOT NULL,
    client_id text NOT NULL,
    domain_name text NOT NULL,
    epp text NOT NULL,
    status public.transfer_status DEFAULT 'pending'::public.transfer_status NOT NULL,
    validation_message text,
    admin_notes text,
    price numeric(10,2),
    invoice_id text,
    order_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.domain_transfers OWNER TO postgres;

--
-- Name: domains; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.domains (
    id text NOT NULL,
    client_id text NOT NULL,
    name text NOT NULL,
    tld text NOT NULL,
    registrar text DEFAULT ''::text,
    registration_date timestamp without time zone DEFAULT now(),
    expiry_date timestamp without time zone,
    next_due_date timestamp without time zone,
    status public.domain_status DEFAULT 'pending'::public.domain_status NOT NULL,
    lock_status text DEFAULT 'locked'::text,
    auto_renew boolean DEFAULT true,
    nameservers text[] DEFAULT '{}'::text[],
    module_server_id text,
    transfer_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.domains OWNER TO postgres;

--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_logs (
    id text NOT NULL,
    client_id text,
    email text NOT NULL,
    email_type text DEFAULT 'system'::text NOT NULL,
    subject text,
    reference_id text,
    status text DEFAULT 'success'::text NOT NULL,
    error_message text,
    sent_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.email_logs OWNER TO postgres;

--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_templates (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    variables text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.email_templates OWNER TO postgres;

--
-- Name: fraud_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fraud_logs (
    id text NOT NULL,
    order_id text NOT NULL,
    client_id text NOT NULL,
    ip_address text,
    email text,
    risk_score numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    reasons text[] DEFAULT '{}'::text[],
    status public.fraud_status DEFAULT 'flagged'::public.fraud_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp without time zone
);


ALTER TABLE public.fraud_logs OWNER TO postgres;

--
-- Name: hosting_backups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hosting_backups (
    id text NOT NULL,
    service_id text NOT NULL,
    client_id text NOT NULL,
    domain text NOT NULL,
    file_path text,
    sql_path text,
    size_mb numeric(10,2),
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    type text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone
);


ALTER TABLE public.hosting_backups OWNER TO postgres;

--
-- Name: hosting_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hosting_plans (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    yearly_price numeric(10,2),
    quarterly_price numeric(10,2),
    semiannual_price numeric(10,2),
    billing_cycle public.billing_cycle DEFAULT 'monthly'::public.billing_cycle NOT NULL,
    group_id text,
    module text DEFAULT 'none'::text,
    module_server_id text,
    module_server_group_id text,
    module_plan_id text,
    module_plan_name text,
    disk_space text NOT NULL,
    bandwidth text NOT NULL,
    email_accounts integer DEFAULT 10,
    databases integer DEFAULT 5,
    subdomains integer DEFAULT 10,
    ftp_accounts integer DEFAULT 5,
    is_active boolean DEFAULT true,
    features text[] DEFAULT '{}'::text[],
    renewal_enabled boolean DEFAULT true,
    renewal_price numeric(10,2),
    free_domain_enabled boolean DEFAULT false,
    free_domain_tlds text[] DEFAULT '{}'::text[],
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    save_amount numeric(10,2)
);


ALTER TABLE public.hosting_plans OWNER TO postgres;

--
-- Name: hosting_services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hosting_services (
    id text NOT NULL,
    client_id text NOT NULL,
    order_id text,
    plan_id text NOT NULL,
    plan_name text NOT NULL,
    domain text,
    username text,
    password text,
    server_id text,
    server_ip text DEFAULT '192.168.1.1'::text,
    status public.hosting_status DEFAULT 'pending'::public.hosting_status NOT NULL,
    billing_cycle text DEFAULT 'monthly'::text,
    next_due_date timestamp without time zone,
    ssl_status text DEFAULT 'not_installed'::text,
    start_date timestamp without time zone DEFAULT now(),
    expiry_date timestamp without time zone,
    disk_used text DEFAULT '0 MB'::text,
    bandwidth_used text DEFAULT '0 GB'::text,
    cpanel_url text,
    webmail_url text,
    cancel_requested boolean DEFAULT false,
    cancel_reason text,
    cancel_requested_at timestamp without time zone,
    auto_renew boolean DEFAULT true,
    wp_installed boolean DEFAULT false,
    wp_url text,
    wp_username text,
    wp_password text,
    wp_email text,
    wp_site_title text,
    wp_db_name text,
    wp_container_id text,
    wp_port integer,
    wp_provision_status text DEFAULT 'not_started'::text,
    wp_provision_step text,
    wp_provision_error text,
    wp_provisioned_at timestamp without time zone,
    wp_install_path text DEFAULT '/'::text,
    wp_password_revealed boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    free_domain_available boolean DEFAULT false,
    service_type text DEFAULT 'shared'::text,
    vps_plan_id text,
    vps_os_template text,
    vps_location text
);


ALTER TABLE public.hosting_services OWNER TO postgres;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id text NOT NULL,
    invoice_number text NOT NULL,
    client_id text NOT NULL,
    order_id text,
    service_id text,
    amount numeric(10,2) NOT NULL,
    tax numeric(10,2) DEFAULT '0'::numeric,
    total numeric(10,2) NOT NULL,
    status public.invoice_status DEFAULT 'unpaid'::public.invoice_status NOT NULL,
    due_date timestamp without time zone NOT NULL,
    paid_date timestamp without time zone,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    payment_ref text,
    payment_gateway_id text,
    payment_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    invoice_type text DEFAULT 'hosting'::text
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: migrations_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migrations_requests (
    id text NOT NULL,
    client_id text NOT NULL,
    domain text NOT NULL,
    old_hosting_provider text,
    old_cpanel_host text NOT NULL,
    old_cpanel_username text NOT NULL,
    old_cpanel_password text NOT NULL,
    status public.migration_status_enum DEFAULT 'pending'::public.migration_status_enum NOT NULL,
    progress integer DEFAULT 0,
    notes text,
    requested_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone
);


ALTER TABLE public.migrations_requests OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    user_id text NOT NULL,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    link text,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id text NOT NULL,
    client_id text NOT NULL,
    type public.order_type NOT NULL,
    item_id text,
    item_name text NOT NULL,
    domain text,
    amount numeric(10,2) NOT NULL,
    billing_cycle text DEFAULT 'monthly'::text,
    due_date timestamp without time zone,
    module_type text DEFAULT 'none'::text,
    module_plan_id text,
    module_plan_name text,
    module_server_id text,
    payment_status text DEFAULT 'unpaid'::text,
    invoice_id text,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: password_resets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_resets (
    token text NOT NULL,
    user_id text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.password_resets OWNER TO postgres;

--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_methods (
    id text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    is_sandbox boolean DEFAULT true NOT NULL,
    settings text DEFAULT '{}'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payment_methods OWNER TO postgres;

--
-- Name: product_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_groups (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.product_groups OWNER TO postgres;

--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promo_codes (
    id text NOT NULL,
    code text NOT NULL,
    description text,
    discount_percent integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    usage_limit integer,
    used_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp without time zone,
    applicable_to text DEFAULT 'all'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    discount_type text DEFAULT 'percent'::text NOT NULL,
    fixed_amount numeric(10,2),
    applicable_group_id text,
    applicable_domain_tld text
);


ALTER TABLE public.promo_codes OWNER TO postgres;

--
-- Name: server_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.server_groups (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.server_groups OWNER TO postgres;

--
-- Name: server_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.server_logs (
    id text NOT NULL,
    service_id text,
    server_id text,
    action text NOT NULL,
    status text DEFAULT 'success'::text NOT NULL,
    request text,
    response text,
    error_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.server_logs OWNER TO postgres;

--
-- Name: servers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servers (
    id text NOT NULL,
    name text NOT NULL,
    hostname text NOT NULL,
    ip_address text,
    type public.server_type DEFAULT 'cpanel'::public.server_type NOT NULL,
    api_username text,
    api_token text,
    api_port integer DEFAULT 2087,
    ns1 text,
    ns2 text,
    max_accounts integer DEFAULT 500,
    status public.server_status DEFAULT 'active'::public.server_status NOT NULL,
    group_id text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.servers OWNER TO postgres;

--
-- Name: settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.settings (
    key character varying(100) NOT NULL,
    value text,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.settings OWNER TO postgres;

--
-- Name: ticket_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ticket_messages (
    id text NOT NULL,
    ticket_id text NOT NULL,
    sender_id text NOT NULL,
    sender_name text NOT NULL,
    sender_role public.sender_role NOT NULL,
    message text NOT NULL,
    attachments text[] DEFAULT '{}'::text[],
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ticket_messages OWNER TO postgres;

--
-- Name: tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tickets (
    id text NOT NULL,
    ticket_number text NOT NULL,
    client_id text NOT NULL,
    subject text NOT NULL,
    status public.ticket_status DEFAULT 'open'::public.ticket_status NOT NULL,
    priority public.ticket_priority DEFAULT 'medium'::public.ticket_priority NOT NULL,
    department text DEFAULT 'General'::text,
    messages_count integer DEFAULT 0,
    last_reply timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tickets OWNER TO postgres;

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id text NOT NULL,
    client_id text NOT NULL,
    invoice_id text,
    amount numeric(10,2) NOT NULL,
    method public.payment_method NOT NULL,
    status public.transaction_status DEFAULT 'pending'::public.transaction_status NOT NULL,
    transaction_ref text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    company text,
    phone text,
    role public.user_role DEFAULT 'client'::public.user_role NOT NULL,
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    verification_code text,
    verification_expires_at timestamp without time zone,
    two_factor_secret text,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    google_id text,
    credit_balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: vps_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vps_locations (
    id text NOT NULL,
    country_name text NOT NULL,
    country_code text NOT NULL,
    flag_icon text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vps_locations OWNER TO postgres;

--
-- Name: vps_os_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vps_os_templates (
    id text NOT NULL,
    name text NOT NULL,
    version text NOT NULL,
    icon_url text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vps_os_templates OWNER TO postgres;

--
-- Name: vps_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vps_plans (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    yearly_price numeric(10,2),
    cpu_cores integer DEFAULT 1 NOT NULL,
    ram_gb integer DEFAULT 1 NOT NULL,
    storage_gb integer DEFAULT 20 NOT NULL,
    bandwidth_tb numeric(5,2) DEFAULT '1'::numeric,
    virtualization text DEFAULT 'KVM'::text,
    features text[] DEFAULT '{}'::text[],
    os_template_ids text[] DEFAULT '{}'::text[],
    location_ids text[] DEFAULT '{}'::text[],
    save_amount numeric(10,2),
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vps_plans OWNER TO postgres;

--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_logs (id, user_id, action, ip, user_agent, status, note, created_at) FROM stdin;
adbbfc14-77dd-445f-ac34-13b2f2344595	ae080a35-39e9-4b34-a780-eea69767bf57	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-23 08:44:51.103954
63549b00-ed0a-4f87-8c07-0b88a83666c4	bd2cfb49-79ca-485a-afb0-2af3ea58c813	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-23 10:37:29.327252
7cd350b3-bc3c-4299-8f36-699be49876da	bd2cfb49-79ca-485a-afb0-2af3ea58c813	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-23 16:27:05.186053
207e9bdb-9f2a-470d-bb01-5c0a2db8f399	bd2cfb49-79ca-485a-afb0-2af3ea58c813	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 05:29:57.789235
825e3760-df4c-4ff6-bdba-82b0b72a0f00	bd2cfb49-79ca-485a-afb0-2af3ea58c813	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 06:22:50.392203
afbff279-2391-408f-b103-61bda20edb63	bd2cfb49-79ca-485a-afb0-2af3ea58c813	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 10:32:34.734535
f8332889-13b6-4bba-9951-7cb2866eba41	ae080a35-39e9-4b34-a780-eea69767bf57	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 10:33:15.740232
7dae9da3-a149-4421-9f38-308cf2ea163e	ae080a35-39e9-4b34-a780-eea69767bf57	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 10:43:34.206147
25610787-40aa-4454-8b33-49132c138adc	bd2cfb49-79ca-485a-afb0-2af3ea58c813	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 10:43:38.442109
ce757f0c-1529-4ba4-a1b8-d73bb63fa6eb	bd2cfb49-79ca-485a-afb0-2af3ea58c813	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 10:52:12.674223
b4ae1b13-7e8b-450b-aa7f-20cc3b6bb335	ae080a35-39e9-4b34-a780-eea69767bf57	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 11:01:28.851695
214cdbdc-f5d9-4cbf-a07e-78dbf16107ee	ae080a35-39e9-4b34-a780-eea69767bf57	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 11:19:19.45211
07540ff4-596a-41a0-8fd9-43aadc8f96d2	bd2cfb49-79ca-485a-afb0-2af3ea58c813	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 11:19:24.769719
5621afbb-ffae-401e-8514-7e98174405d9	ae080a35-39e9-4b34-a780-eea69767bf57	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 12:13:39.698939
cc78cb52-11c4-43d2-80f9-729ac571de76	bd2cfb49-79ca-485a-afb0-2af3ea58c813	login_failed	::1	curl/8.14.1	failed	Invalid password	2026-03-24 13:00:18.736599
f2e60a71-52f7-4084-a070-c8354b36492e	ae080a35-39e9-4b34-a780-eea69767bf57	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 14:03:39.667252
af926c28-fd81-46fc-bae8-2b854cbb546e	bd2cfb49-79ca-485a-afb0-2af3ea58c813	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 14:03:45.004991
372444ba-32fb-4ab2-86b5-640310516087	ae080a35-39e9-4b34-a780-eea69767bf57	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 14:08:02.982487
f3f5cb2d-0ee0-4441-9a83-74b6dbd5ee5b	bd2cfb49-79ca-485a-afb0-2af3ea58c813	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 14:17:16.496444
6c23a664-9254-464c-b8b6-21548f773f87	bd2cfb49-79ca-485a-afb0-2af3ea58c813	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 14:44:38.606384
3ebd55d2-369f-49d7-bc12-ab0b3d369778	ae080a35-39e9-4b34-a780-eea69767bf57	login_success	103.251.255.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	success	\N	2026-03-24 14:45:26.427084
\.


--
-- Data for Name: admin_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_logs (id, user_id, email, action, method, status, ip_address, user_agent, details, created_at) FROM stdin;
\.


--
-- Data for Name: affiliate_clicks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.affiliate_clicks (id, affiliate_id, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: affiliate_commissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.affiliate_commissions (id, affiliate_id, referred_user_id, order_id, amount, status, description, paid_at, created_at) FROM stdin;
\.


--
-- Data for Name: affiliate_group_commissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.affiliate_group_commissions (id, group_id, group_name, commission_type_gc, commission_value_gc, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: affiliate_referrals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.affiliate_referrals (id, affiliate_id, referred_user_id, status, ip_address, created_at) FROM stdin;
\.


--
-- Data for Name: affiliate_withdrawals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.affiliate_withdrawals (id, affiliate_id, amount, status, paypal_email, admin_notes, created_at, updated_at, payout_method, account_title, account_number, bank_name) FROM stdin;
\.


--
-- Data for Name: affiliates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.affiliates (id, user_id, referral_code, status, commission_type, commission_value, total_earnings, pending_earnings, paid_earnings, total_clicks, total_signups, total_conversions, paypal_email, notes, created_at, updated_at) FROM stdin;
d8cace67-4eae-4365-b52c-63068674fe3b	bd2cfb49-79ca-485a-afb0-2af3ea58c813	ashgerad2749	active	percentage	10.00	0.00	0.00	0.00	0	0	0	\N	\N	2026-03-23 08:52:09.947269	2026-03-23 08:52:09.947269
\.


--
-- Data for Name: credit_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.credit_transactions (id, user_id, amount, type, description, invoice_id, withdrawal_id, performed_by, created_at) FROM stdin;
bcca26df-dd5a-4d03-8ba0-3b925732c403	bd2cfb49-79ca-485a-afb0-2af3ea58c813	1000.00	admin_add	Bonus credit added by admin	\N	\N	ae080a35-39e9-4b34-a780-eea69767bf57	2026-03-24 14:13:11.577692
340aeef1-2e2b-415e-8e4b-8ae5b3ae23c2	bd2cfb49-79ca-485a-afb0-2af3ea58c813	500.00	invoice_payment	Payment for invoice DEP-1774361861029-1	67786f84-e66b-4382-b15f-a1e12795c0bd	\N	bd2cfb49-79ca-485a-afb0-2af3ea58c813	2026-03-24 14:19:06.850996
d196118d-92ba-419d-94ce-b17e329d62a4	bd2cfb49-79ca-485a-afb0-2af3ea58c813	270.00	admin_add	Wallet top-up — invoice DEP-1774364039533-1	f6128e62-fa2d-463c-bbd0-e64ba5ec1bfe	\N	ae080a35-39e9-4b34-a780-eea69767bf57	2026-03-24 14:54:10.056505
\.


--
-- Data for Name: cron_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cron_logs (id, task, status, message, executed_at) FROM stdin;
64d36f55-4552-4306-9c9c-6c619b463988	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-13 18:48:21.625849
1c700ff4-52e5-4d79-aeb0-f106af67a900	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-13 18:48:21.628371
4d94cfc6-a577-4259-bf0c-f93de16c789d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-13 18:48:21.628761
760b4617-6860-4da2-a975-c8e57215bab6	emails:invoice_reminders	success	Sent 4 invoice reminder email(s)	2026-03-13 18:48:21.986242
801fbb4c-be56-4185-9854-45550d44a8ab	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-13 18:53:21.601972
cc300987-67d4-4e43-a81d-2dc8b26873a1	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-13 18:53:21.602741
ff634f48-437e-4b8b-be50-7ec2964d41b9	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-13 18:53:21.60667
136b7dd8-c51b-4fb8-a56b-4e2017cd0a4e	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-13 18:53:21.613345
b52fe3fd-e17e-4d4d-883a-15dc2d69beaa	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-13 18:57:55.643331
0353ebb8-f9f9-43a3-bb98-d759d22817f2	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-13 18:57:55.677259
9bb03ef0-6426-49ce-aafd-7dfbeb5627fa	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-13 18:57:55.677699
f0b88a81-5384-4b53-8c09-28644e39ccb7	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-13 18:57:55.683393
e7f67542-0402-4121-9937-8d931df5ddb9	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-13 19:02:55.616344
ff89650a-2216-4642-b5e5-b8337d7a6152	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-13 19:02:55.624871
262fc434-5e28-4cc3-8723-a67ef25e0b7d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-13 19:02:55.625282
6ba8e488-cabd-4e20-baa0-82d5d78f9662	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-13 19:02:55.630115
11c31035-83c7-4d60-8fe4-ecf0df14abe3	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-13 19:06:58.748461
5b616198-9174-40f8-935e-fd3142dcf6b7	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-13 19:06:58.748981
4c0d159d-b8a3-4d2c-b21f-8176f2b54f01	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-13 19:06:58.782838
23ef7e35-7c74-4d41-9b16-b2d4af98b1b2	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-13 19:06:58.789737
8864cd89-7041-4601-9f18-a69119402635	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-13 19:11:58.727802
5aeb2002-ad8c-4b1d-855a-40fc1baa7d82	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-13 19:11:58.730967
4a8db82c-bab2-4795-8595-94c47bd42e7e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-13 19:11:58.732586
577dc35b-f77b-4deb-aee4-13f639621448	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-13 19:11:58.739857
ef8b732c-0238-4e1a-b9e5-52895f21d93f	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-13 19:16:58.764748
6762ee1d-f540-4e11-9e93-030667ab7cb6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-13 19:16:58.765214
34f432c6-adb2-4793-8a77-1f0ed17c9b14	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-13 19:16:58.767795
183c3ac7-a086-4484-acbb-799b3aeef276	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-13 19:16:58.770495
c1ad98c6-a871-4d4b-aa45-ae230a457770	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-13 19:21:58.792325
49d72462-523f-4b33-bd09-553b2fb4b23e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-13 19:21:58.792721
01dd9595-af93-40db-a40b-8e6f43176560	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-13 19:21:58.792777
263e9405-b035-418f-979a-c0bdcdf5a392	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-13 19:21:58.796694
bb4bde1e-6d7a-4551-a25d-95284a929ed5	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-13 19:23:37.677909
438031e8-16e9-42c8-9545-5ca3108dddc7	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-13 19:23:37.678393
248b239b-637d-404f-95ad-6831ec564fc7	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-13 19:23:37.678905
68023f6d-47e1-454f-a626-606f6cf4d915	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-13 19:23:37.685853
ab7a4042-675c-49db-8783-c37996f94375	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-13 19:28:37.652206
023eec50-0057-4c04-b77c-312450136712	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-13 19:28:37.652784
7766f55b-d6d4-4886-95ed-d8193d8a5d9c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-13 19:28:37.655409
3c1d7262-a9d8-44e9-a4d7-fe0a9349ad38	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-13 19:28:37.661187
9f4d90f6-ad76-4948-8848-8040e0765b02	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-13 19:33:37.681144
77cf45aa-3e9c-4237-b6cc-750128545086	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-13 19:33:37.681504
bc0bd8c4-8c1a-4078-8e26-bfd2f93be928	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-13 19:33:37.683159
38fee138-a164-4c00-9e01-8e98cd56359c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-13 19:33:37.689005
1934cd22-1662-4e1e-877b-406e0fca5ac3	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 04:32:10.696829
b2252c35-4ca7-4f7d-931d-01237605911d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 04:32:10.697862
60df3ddd-1fc7-4433-8194-7b47b2c555a5	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 04:32:10.697349
3b141c4d-56a4-4441-8995-255abb3de8c4	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 04:32:10.711435
fc6462f5-06ad-48fb-928f-eb53fd449844	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 04:37:10.639824
317b6b12-19cc-4be3-8ef5-88589129da8f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 04:37:10.643179
74e389d2-e99f-4323-b61d-53e00f7ac003	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 04:37:10.643386
0ca57c8c-f898-438f-b240-f254135f2c3d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 04:37:10.648262
d8dea34f-cc64-4bd6-a06a-48c849d20e17	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 04:42:10.668103
5750f4a9-21a3-4d6a-97d0-e06522eed675	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 04:42:10.668395
424bd4cd-5777-4e33-90c3-6adc6ec0c3c4	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 04:42:10.670312
0206431f-2857-4c0e-8369-030bbef3d5f9	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 04:42:10.67541
f07755fd-3c98-4de7-9ff3-1f37b93f847c	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 04:43:41.960602
da175c1a-f953-4c85-acc5-54e2101826e3	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 04:43:42.001408
7e06bf0f-fb2d-4551-baf3-a0f155252c24	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 04:43:42.003088
ee898d82-3db2-4217-84db-d176fdc31d07	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 04:43:42.009362
f9e463c7-2209-42e8-aae5-1335e1bdb963	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 04:48:41.940077
30ef9e4b-aedd-4f35-b0d5-09fff1358007	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 04:48:41.940426
4014cd58-db67-4465-8cd2-3741e921d43e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 04:48:41.940779
ec0fa8a6-aa85-44ef-b06c-876ad15828d5	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 04:48:41.949268
23dccd28-66e4-43f3-889c-ea5101e200a9	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 04:49:52.113048
ccc0a48a-775f-4a81-b081-de450c8a14cc	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 04:49:52.114334
c687f65e-77fa-4a10-a38e-b4b1f04cd2e5	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 04:49:52.114733
3c49b7bc-9871-4012-957d-8adb6b16caa1	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 04:49:52.12055
534c6e8c-81fb-4cca-8b0b-8b9c6c12e4a0	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 04:54:52.557822
936166e4-e447-4f0e-80bc-c4a66ea471a2	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 04:54:52.597897
1eda1ea7-d9ca-42e2-a060-19ab0bddea5b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 04:54:52.598536
71752e80-93ff-46e8-9145-dd97973f300a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 04:54:52.605944
d6c718f9-549d-42e1-9595-3dcd707e3481	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 04:59:52.560937
77a899ec-2504-43da-b981-d209adea55ae	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 04:59:52.561315
c72c75ec-6145-4ea0-a979-fe2aaf4a3797	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 04:59:52.562038
2c9bd466-f670-44eb-a2ff-171994acc222	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 04:59:52.56799
3f66ccf8-46f9-4318-bfc1-bea4d2467fd6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 04:59:57.090879
9ffdf74e-bdd9-4000-8ef4-2125c82175ab	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 04:59:57.091342
78add947-0970-44a6-a234-10d0d6474d8c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 04:59:57.092563
07122813-494e-4909-9176-8ce4d11e0962	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 04:59:57.099115
d62d3048-a0ae-4078-b20a-7ebaf01e4d71	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:04:57.042357
d5f8c295-dc47-43db-8573-02bc24136b46	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:04:57.044013
54f917d2-c3c2-4a02-ad16-361d136440bc	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:04:57.044325
bd5b10d8-998d-41d3-8cbb-0d34c15dae6b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:04:57.050907
11356fcc-772d-4360-a200-37827a3bc590	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:09:57.032787
915a63e5-e2c9-4fa8-9021-07e7630848a8	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:09:57.033163
57b245f1-06ab-426a-99cb-67ccbfd14ce6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:09:57.033403
a48d7633-a6d9-4841-bb40-4a775001e85e	emails:invoice_reminders	success	Sent 1 invoice reminder email(s)	2026-03-14 05:09:57.048355
7bdc6212-b13e-4219-8aba-b4e8500d7685	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:14:48.063494
12d5cfc5-e0c4-48b8-b349-2d3ea5dc1298	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:14:48.064234
f5172253-3761-4154-bf85-db3aaf0458c2	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:14:48.066043
3a5bd809-fb6a-435c-b00a-43fc0d3bacb6	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:14:48.074329
d96a99e6-5445-4903-a62e-4e1b43f60c13	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:15:21.117083
068575e4-e3c0-4316-bbbe-a2b9a4eae35d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:15:21.117684
5c18fb1f-37a8-4a9a-a561-95ae18e2eb32	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:15:21.156571
eb04f63c-f7db-4fc5-b287-31aad7fb3308	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:15:21.165037
6ccff598-ee4a-4ad9-a5d2-88fec0eaf5ad	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:18:58.456281
93bb7b22-3648-4b64-9b42-a8bf300cd9b8	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:18:58.456747
e7913216-d3fe-4888-8258-673fbd0a7ff3	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:18:58.457339
e613d7ec-2ee7-4b0e-a710-3d437f36a6b5	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:18:58.497346
cb1c3fcd-d8bc-4725-a5dd-12694989c76b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:23:58.408088
96e45585-f41e-4426-87ac-60d30e4c3706	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:23:58.408425
9d228a1f-9165-4f93-adff-ec37e25df221	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:23:58.409414
9ed9d6b7-cfe7-4e86-81bd-07441f6c583c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:23:58.416375
8210b411-effd-4df3-a079-5959c5cd45c6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:26:58.009975
279c603e-1ada-46a9-b9ac-bf2a179b3811	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:26:58.010506
e6226548-2e46-4df6-b436-b9e115861e1c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:26:58.011052
e38ea19b-f4f7-4de1-ab16-fd197e5da425	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:26:58.022089
179e3a53-9bea-488a-b5ae-8cb6e232bde0	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:31:57.950987
6908cb0e-5483-415d-abfd-956e2b29a407	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:31:57.95131
f0d04257-58f7-4643-aa5d-147a22376dcb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:31:57.952282
915c436e-c449-4e25-8ea4-c4e1283435ea	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:31:57.962064
a8c05a88-0d0d-45c0-a5d1-ef8755663c58	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:32:24.474833
d82e0417-03c0-4244-940b-e7aeb674e839	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:32:24.475556
bbb914e8-d0f0-43b4-a0af-a767a464d87b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:32:24.512939
d10274df-53af-40e0-b8a2-f612c03586c2	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:32:24.525853
9f74aded-2c44-4670-9b00-96be8691425f	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:33:30.155346
efe1f1f4-6271-40da-9dc7-9120866fa565	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:33:30.15679
3630a4ed-a4e1-4b7d-bcc3-ee2e6863e0af	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:33:30.15738
eea4094b-67be-4998-bd7f-8bfa5c26a1a8	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:33:30.205067
e280a5b4-5f54-4db1-9b3f-1a692cb565bd	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:38:30.163713
77072850-b565-4e5e-b731-583af47a2056	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:38:30.166315
578f9f4f-a759-4943-be5e-ae40fd3afd65	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:38:30.167097
28a7e370-4a58-454e-85bf-c66a4e6f2b88	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:38:30.172445
111b64ae-6a58-499a-960a-ed2af6aae9f9	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:43:30.192813
1efeabf8-dc1c-433f-8861-44b4e5324793	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:43:30.193769
4d3e1721-40d5-4919-8612-de1218d98efc	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:43:30.19492
08ba9258-a407-4dae-8806-5b680a4ceb2c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:43:30.20081
33772795-ba06-4fe8-9e6f-ff481e4f451a	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:43:43.343791
5448ca6b-e095-4a3a-a96e-2779957c89d1	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:43:43.383914
de07b3a9-e826-47a8-abf1-5812c9de0ab6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:43:43.384479
c1756998-a567-44fa-9f1d-b2a61e87b941	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:43:43.392569
9dc2675d-6f63-4b2c-91eb-fba94f14e359	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:48:43.326641
fca024d6-b17e-4be4-b26c-e0ee37004678	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:48:43.327532
7ee896a0-4094-42fc-9ac0-958858e07318	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:48:43.329052
7ce5c3de-9360-4ba4-9c94-d718c43e7009	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:48:43.334743
aa9ea9f0-8cc5-48d4-962b-0d96b5a6c209	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:53:43.3557
a5de3761-8cd4-4215-9cbb-a632079f6b25	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:53:43.357902
0580c7de-a8b5-426f-9015-0e7dc365ba73	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:53:43.358674
41a35c2f-d199-42f9-9d98-570ae2acbc49	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:53:43.363234
3566f488-b8d6-4958-ac5f-1342a5ad0288	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:53:45.391138
d48a0d36-2d0d-4215-89db-06501282ef34	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:53:45.429046
927bb485-3eb1-445a-89fd-3585fb800960	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:53:45.429631
be66f9a7-0560-4a76-9a75-e6adb8cb998e	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:53:45.436415
9cdaa03d-8cbb-476d-bf4b-ed2c8fd3089b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 05:58:36.277872
b35f110b-527b-48fe-a93b-c54cd45afc1f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 05:58:36.2784
cd031ff7-7d5d-4eb5-8c57-40783c3d0d4e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 05:58:36.315865
9ca23685-ae76-4367-af15-d38ee3610047	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 05:58:36.325292
28acf3f2-2943-4a30-800e-d9247802cdf7	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 06:03:36.263012
3b986ac6-aaf9-4b46-82e4-cbbfee225de1	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 06:03:36.264282
dd404df3-25be-4dfe-882c-730389579826	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 06:03:36.264848
d96be22c-aa03-41df-aa4c-d07206b01803	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 06:03:36.27279
06691c3f-2583-47d3-845c-eb2f543bd17b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 06:06:45.301068
453fbe73-bf99-4594-bfbb-82e666b2ea3c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 06:06:45.348676
80b7ae16-9b05-432f-bb1e-e5e22557d96c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 06:06:45.349496
e8d826cb-6b29-4741-8ff1-3b5369bf7f5b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 06:06:45.364477
8784c90c-b52a-45f5-b72d-a68cf3d39752	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 06:11:45.303648
1c34a035-000b-40dd-bfa9-fa67f244b7c9	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 06:11:45.303935
cd47202a-eff3-46a6-9cba-c67adf476239	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 06:11:45.304278
330f0967-5029-4bc8-a857-90d16b422be9	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 06:11:45.311682
b0d9213c-4aa7-4123-bbab-50b66f2017ca	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 06:16:24.971337
31c58a86-5ac8-4f8d-9ca7-7dbeeb448dea	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 06:16:24.972049
72934c87-8a9f-4492-8405-ebc0f361940c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 06:16:25.011627
14f82768-edd9-44c2-bbfd-38b8df3dc7a7	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 06:16:25.014281
dfbdeb78-e099-4c69-b254-4cf48885cbae	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 06:16:25.022993
abce044c-fe7e-4845-bd61-ac374aa336ad	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 06:21:24.983873
a58153dd-eecb-4fcf-89ca-1daec1546301	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 06:21:24.98422
70d62025-f4c4-4ca5-8dd1-9f5618f7fa1d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 06:21:24.984644
21dd7403-dae7-4e4b-9507-2d0fda334ba4	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 06:21:24.986429
5f1d8c98-4e95-4634-8c48-50538106aff5	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 06:21:24.993051
5fc40c85-c177-4ff1-9882-8fbc48e6a4f9	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 06:26:25.01356
c6d446ce-0dad-4750-a616-b50c9b29d2c8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 06:26:25.014985
5e238c0c-28d8-4cbf-9022-c31e70f302fe	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 06:26:25.015255
10ebabb2-d111-4a59-8e96-9144ba6c4f12	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 06:26:25.015776
8459613b-198f-443d-b6ac-14597904875c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 06:26:25.020962
02bfdd5c-11d5-4cd7-8490-925120c49baf	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 06:26:54.116043
0ea8d8bf-71ec-4985-b5b0-03aaaa02806c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 06:26:54.156231
8c3704d1-4ac3-4210-8222-a42d68adf956	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 06:26:54.156933
eb71ba29-2722-4d13-8676-6dab51bc9bcd	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 06:26:54.158302
207a4abb-90fa-49fb-89e1-e616467bd0f4	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 06:26:54.164976
eff892cc-d98d-4a34-a6db-5f07118a9bf2	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 06:31:54.085206
032d130b-8940-4cae-99eb-d2284af4da3b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 06:31:54.085182
b3cb1059-8c68-48f0-9455-446227ac7903	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 06:31:54.098387
8e4d8798-ccc7-4395-86f2-e386e3e5fd17	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 06:31:54.100724
4887bacb-a47f-4055-89d3-407f32addaf6	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 06:31:54.105026
b744f402-2a8f-499e-b2e2-c71b64ecf57f	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 06:36:54.084425
2c0b83c7-de5d-4467-8cae-2d1b1279100a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 06:36:54.084928
7e215603-df34-428f-8c73-a14d1dc21172	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 06:36:54.084923
0f68523d-9e06-4333-a594-743cda3b418e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 06:36:54.085271
2eca4c7c-46c7-4d75-aee8-72225060e021	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 06:36:54.092913
78698f97-0ef6-42c5-a415-802254dab6ab	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 06:41:54.107706
d2db3aa1-af47-4332-9842-5a4f2cf9587c	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 06:41:54.108117
d16c07f7-ce30-4bfd-8fb1-41866db0720e	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 06:41:54.108654
e017511e-028f-4795-a629-6c688bd52e7c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 06:41:54.11156
5c3bebce-888f-4621-b87b-e140f267182a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 06:41:54.117786
90e5e7b9-36da-489b-aace-fe3df293246d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 06:46:54.138871
e8c09d63-acb1-4253-96f7-dcda4eaeb43c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 06:46:54.139195
abc55d38-ceda-4594-91ff-76bf6f247963	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 06:46:54.139917
7cf278cc-cf0c-4d00-911b-3e3591f56e95	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 06:46:54.140482
465ea9f4-29d6-4009-bf07-338cd5f276bd	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 06:46:54.145825
831cf75e-a121-4061-ad37-c1e90526e52c	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 06:48:37.776283
60609e80-cc48-4743-9a49-1111df4117c3	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 06:48:37.778366
495c4e5d-0c6e-4484-b0b6-f71a108ad1d8	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 06:48:37.778966
2978674d-907b-4f55-bdb3-dd965312ad9e	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 06:48:37.779454
adba4dbf-d105-4087-bd64-2a3e643ee623	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 06:48:37.791075
eb1aba9f-0cc3-46fd-80f6-32874faacb9d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 06:53:37.738018
cd2737e1-cb4c-4126-8fdf-0ce07796581c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 06:53:37.738399
3466eac9-ed76-411b-a828-b1580d6e7cc7	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 06:53:37.741272
52d1a520-f5e5-479c-8624-a21bdf14a9be	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 06:53:37.742589
80cdc71d-0789-406b-9d1e-13b6bb744ee8	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 06:53:37.748078
dd92658b-89e1-43f0-a662-68a8870ae66e	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 06:58:37.767736
945eab1e-4da9-49f9-93c5-97cfce887f61	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 06:58:37.767999
2d59139a-862e-4ac6-9fad-a07784a00db6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 06:58:37.769223
404cccb8-73dd-4a5d-8d0a-38f7e4ce13f9	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 06:58:37.769982
4566b231-ee2e-4a83-a1fb-39dd59701513	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 06:58:37.775037
64ec81df-7991-40d8-a7ea-3e647953a309	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:01:18.108514
c4280426-3f5d-433f-aeba-d377521bb879	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:01:18.109076
0a71f5c5-08d5-4b40-ab93-671bdefcf517	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:01:18.112058
2d7533d3-447a-465e-98dc-96ba7ddfc55e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:01:18.113222
52ae09bc-a925-4c38-9225-b787f0c112bc	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:01:18.12359
6e148639-9035-43f9-9a39-c164e654d904	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:06:18.064505
1c8ab130-a736-43f4-9f53-e52e2878ad83	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:06:18.064772
08bc0c59-cf79-4802-adcf-6ce98b834b18	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:06:18.065117
821f2a52-21ab-4ba3-8ae4-b1b73c6be8d6	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:06:18.065422
bd4863e7-a88d-4f01-a464-cdb766b79527	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:06:18.071642
02dd8ce2-fa93-4d6e-b2b6-4785bd8a0600	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:11:18.05577
e95ae793-ebd7-4cee-86e3-58cf7c8b844b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:11:18.055962
14e9a56d-373d-43e1-9fe1-315b21c9737f	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:11:18.056158
f7fddd4d-00ed-4255-93de-78551eab8098	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:11:18.057152
d98c4509-b31f-430f-8656-d5312200a6f4	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:11:18.062399
ba8cc09e-784e-4ec7-93d3-d2e64c85572c	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:16:18.094805
2f94c099-952e-492f-9444-9d6ab209b2a8	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:16:18.099576
73f339b8-e2a0-4159-ab10-830df64c99ed	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:16:18.100138
c7ab3faa-11db-40bc-8bde-976a321e6980	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:16:18.101091
106e1491-17f2-4666-a744-82b1ce12e0d0	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:16:18.10349
c34d40e1-f344-4b66-bc5d-ea6f6b08697c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:21:18.117218
31e3b995-7e9c-4b0b-b87e-6252989ffe77	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:21:18.117504
9e71a0d6-7a8b-4677-b26b-21e559e6f1c7	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:21:18.117838
1db2d6e1-bbda-4cd8-80ed-0cd693fb41d6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:21:18.118186
594dcbba-e100-4144-be9b-a8ba8ef29e0c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:21:18.124895
441a5a43-7a4f-48e6-8558-69ad3a79b146	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:21:50.400516
41d20822-df05-4140-a5b2-2d394c08c60f	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:21:50.40125
96e1dda2-9716-4bd4-be48-9e99b8cb83f4	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:21:50.440354
7c984ba2-cced-4a71-99da-0b9ae3a11aa7	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:21:50.443471
61ba6b3e-b99b-4ecc-b6ef-a03dd5f9c39b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:21:50.453136
18d3ebfa-b0d0-4cea-8f13-c4f9e8be8b0a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:26:50.370414
d194a1be-b853-491d-a677-67801e0eba28	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:26:50.371435
055bdab4-bcb2-4fad-aa24-65666cf1119d	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:26:50.371898
aec7833a-a63c-4858-92b3-ba49707bfd0b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:26:50.371932
a6d3c22e-3d74-47db-aed4-6edea1bbe0dd	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:26:50.376664
98bdc189-5377-44e7-a184-2170b7b47b32	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:31:50.404273
e3b53d45-7007-4253-9c31-1fc498dbbb47	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:31:50.405146
aba34557-9561-4123-b660-a8479b195702	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:31:50.40627
ed5cb258-3f43-47df-8c1b-dd48375ba68a	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:31:50.406443
a5e8e01f-895b-4190-b9c3-92d855881525	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:31:50.415163
6ad85300-913c-45c4-be06-f14598396dbb	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:36:29.863557
be827dc4-9e2f-4a02-951d-f2bd02d4d1f2	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:36:29.864269
ce492985-6b5a-4727-8c37-1abf6496f02c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:36:29.865102
9368f14c-91db-4a2f-ab59-da434d81c5d3	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:36:29.866282
53dd826e-c623-4f4d-8730-83ca4103f153	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:36:29.878836
b33b36b1-f90b-419c-abde-bceb64ca1657	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:36:57.664923
b0005b5e-3675-444c-bc63-45c25e49c80a	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:36:57.664993
6d12699d-8b69-4a7c-82a8-b5b0f78c6522	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:36:57.666918
9b2263ea-25e1-45c2-a9e6-dc3e7ff5bffb	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:36:57.668278
602d7b25-7265-4294-9f74-ba5a74553c0e	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:36:57.710583
d21eeb1f-744a-4d30-b16d-f21cd38ab0b6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:40:26.311904
eb7a6a9c-1643-4de8-8831-b86f6ebe39c0	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:40:26.352973
03154d2c-e926-4981-aa64-4427798a14dc	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:40:26.35547
a59f9695-76fd-42c5-b243-62f77fff61f5	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:40:26.359244
02d9df42-ad0d-42ca-9536-6d8794326088	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:40:26.36799
56bdc8fe-fa69-4a58-a961-7772c903225a	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:45:26.309873
273d81ba-4fa0-4399-8be5-0e0905d09333	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:45:26.310403
e960c477-6b8f-49c3-8d5f-d14131e24592	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:45:26.311722
bad990ee-207c-4f37-ae4e-29cda0fecf46	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:45:26.31216
2faa87e7-1f27-4b0e-9e9b-9b8d5fca2033	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:45:26.318714
cadadc46-e831-4842-85b3-e815e224eb26	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:50:26.300784
925fe450-5364-4bb0-8f48-72bbd13b47d1	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:50:26.30144
e28a5daf-7d17-40b1-8b4a-63a89bb56799	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:50:26.309345
c7803977-1fc5-4710-b707-b499f982dd0b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:50:26.312001
7cd1c495-0012-4cd8-be6b-e64a609a9b20	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:50:26.317964
a30d5c49-60b5-4e49-9fb4-ac371f68e48f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:55:26.322525
cd39331e-6c1a-4059-ba71-8f3b2e00495e	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:55:26.323377
c0ab2808-4090-417c-afa4-f5036040465f	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:55:26.327647
693d40fc-a5e1-4e41-96a7-5d46aa6c4454	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:55:26.331695
3a13e621-3852-47d3-9c2b-43a59ffb9155	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:55:26.336647
6f262a35-7213-4cf7-ad3d-a5c7a4fcf21c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 07:55:42.603072
2be2eba2-45f0-45a8-912d-913cfe3370a9	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 07:55:42.603647
1c3b3e02-9617-4ef6-9f23-d4cf2e102dc8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 07:55:42.604371
abc9d618-c833-4fd7-b3db-dc09134b1ac6	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 07:55:42.606454
15cb8783-8b80-40f0-b125-5eb9c89c9b69	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 07:55:42.614372
2adb99b1-f68e-45a0-8ba0-442685846b57	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 08:00:42.54961
59191240-2994-4006-b426-98e24eda32b8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 08:00:42.550287
4ac595a0-c06f-4781-80f9-4945c7f7b6b1	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 08:00:42.550611
cbccfc70-c310-4790-941e-63b34c4df0c1	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 08:00:42.551932
c996268f-737e-4439-b204-be2c3bde4e1a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 08:00:42.558919
55cfe849-bd8e-463d-9720-ec6e5a059cd7	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 08:05:42.573544
ae9880f9-6b02-4f8a-bcca-c8d3e37a5025	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 08:05:42.575257
f62bbcdc-ff15-41cc-b29a-823aca14847b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 08:05:42.575782
6dc497d1-2752-4071-8c95-85cbd72d24c1	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 08:05:42.576455
07e3ccb1-3c91-49df-9a38-eb0621e9f3bc	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 08:05:42.581924
3f68c66c-b6e2-4299-a689-badc43b177bf	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 08:06:51.516471
75cdc222-4e2b-477d-9a95-0fe9264f2807	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 08:06:51.516913
bae7bab2-08f6-4095-8949-5c31f7bb0e21	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 08:06:51.518306
56802845-4798-4adf-8206-d49b87872772	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 08:06:51.518824
cab0dcba-5d68-4a84-80f7-0775da21b403	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 08:06:51.528638
10b650ac-b8e5-4f17-9af7-ae613b6fbf3b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 08:11:51.448155
54ab9d67-9f6f-448f-b53b-f45d5fdca967	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 08:11:51.448584
51dc780a-d695-4628-ba8b-9f4219daef37	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 08:11:51.449648
b6b56c97-6eae-49dc-97b0-6cfb29723216	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 08:11:51.459064
ed341fca-0fc1-41b3-bec3-56eb5fcf34de	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 08:11:51.468153
b70e4dcf-6e28-47b7-a5e4-3c6f80bd295b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 08:14:28.231047
61c08e40-15c6-4d6a-a53f-3853e124e27b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 08:14:28.232083
71f7467b-29f0-4a69-99ea-383feb3f6b75	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 08:14:28.231583
788ebadf-bbd0-4657-a528-537a210cdf56	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 08:14:28.234517
8087c236-5820-4551-bc97-a5677959fcb1	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 08:14:28.244308
cf188c72-4fb1-4073-99b1-4e3e956c9578	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 08:19:28.206742
918d7719-facd-49df-b5f6-279d87f415be	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 08:19:28.207144
d567e554-f7d6-4b0a-a1dc-f273253e63e5	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 08:19:28.208014
9a59a16e-dd09-4380-83e7-3935d6aa0ab9	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 08:19:28.210648
6d9688fb-852a-42d3-9ce7-4689ff525734	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 08:19:28.215561
7b2df8bf-6ca3-43bb-935b-d46682107bf9	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 08:24:28.23543
ddabbf21-851b-49a3-b88e-6ef962b15461	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 08:24:28.235743
43ad8dd6-90d5-42e8-8276-b5c9a60f6494	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 08:24:28.237269
f57c5e16-132d-4d6b-a21b-f7376e4574c9	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 08:24:28.237269
631b0b0b-c3ff-4b11-b4e6-1c1d41c14b3a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 08:24:28.246039
260ce4e5-648e-46f8-a3b6-3a88c0fdda96	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 08:35:59.308286
314cee92-34dd-4eee-868d-7faac90cea0e	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 08:35:59.308982
8ad4bd32-6b57-4722-938b-3af1cd79277b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 08:35:59.307751
0a638074-fc91-48c3-ab48-edeb85eb770e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 08:35:59.30941
24c38a9c-7a9c-4c86-a8e3-f246a0e4fea4	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 08:35:59.321559
3bf285e1-d502-45cf-90e4-0025370a7b40	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 08:40:59.249808
fdf1dda0-b459-4eee-aab7-8013aef2bbba	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 08:40:59.251613
1263527a-4a49-451e-aeca-7b436603f44d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 08:40:59.252983
e4d17acf-7c5c-4b3c-8536-4faeab1987e2	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 08:40:59.253385
a03cb5f5-25f9-4c88-be89-091b3955ec36	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 08:40:59.259735
8cb83b9c-d0af-4b19-9d45-5b2814aff5e6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 08:42:48.874377
de1e1fd6-887f-4beb-a59f-fde4560edfd5	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 08:42:48.875072
b623321a-c430-4c4a-bb07-09bd92811df7	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 08:42:48.875714
d9ebf4ea-3e68-47f2-83e3-164d43ed4cc6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 08:42:48.876173
de404433-f586-4d23-a4d7-bcfc1679616d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 08:42:48.920759
2340b8fc-23a0-4632-bac9-dbbe05f15690	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 08:47:48.844398
d012715a-8ba6-4c8a-b247-63029ed2c973	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 08:47:48.844685
5fff0dd7-5bc8-4a83-b0fb-6512a9b9e5fb	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 08:47:48.845153
41539b44-cb0e-4568-be9f-287160e44c7f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 08:47:48.845192
ace2843d-5437-4738-b12a-36dd005525a3	emails:invoice_reminders	success	Sent 1 invoice reminder email(s)	2026-03-14 08:47:48.858595
7638f485-3be6-421a-9f29-aaf0eb4c95d3	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 08:49:34.996489
b2cc06cf-5803-48b4-b82f-79e1dc3b6f3d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 08:49:34.997974
408e0412-9bdc-4dc8-8455-1145fec1352d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 08:49:35.036641
d355cae8-8325-413b-a15a-b6fb79572a4b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 08:49:35.038026
7d2e088e-863c-446b-a9ae-6bb912de8dee	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 08:49:35.046039
0f883798-ffd6-4fdd-8403-a871245bcf95	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 08:54:35.001841
27ea002e-015e-4b6a-8d65-82fcff56ebe9	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 08:54:35.003394
7b676e33-feca-4239-a438-f2cd86fbc85c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 08:54:35.003953
7024f6b4-bd87-4634-958c-d95d1abceca2	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 08:54:35.004762
57e69ab3-dcbb-4bcb-8f96-65246f024e9b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 08:54:35.012898
1ab43285-fe2f-44d9-ac1a-83effa119102	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 08:59:35.031425
ac545935-1dfb-4f05-a0c8-08dd9791128d	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 08:59:35.031742
a39dd18e-e9d2-469e-9bcc-2ed9358723b6	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 08:59:35.032648
ba48e9da-4d68-4e0d-b6a0-b10fa9b2b9aa	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 08:59:35.034229
ea65cb62-4336-4c91-ac49-3d8616259425	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 08:59:35.040461
e44f82eb-30f7-49e1-844a-0d7073a0d1f6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 09:04:35.045671
6345c1fc-dd62-4900-a1fc-8c86652255ac	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 09:04:35.046104
85197c72-3455-46cf-bbf0-7bac9057c70e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 09:04:35.046293
ae301f58-08b9-4ac8-b0d4-745ed465de24	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 09:04:35.048323
28bb9092-33d1-4a98-bde2-ac4773b1a100	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 09:04:35.054268
4cadeed3-f6f7-4f29-8b3f-31663163a8b0	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 09:08:47.667295
294897d7-a1c8-4dda-ac9e-d3ef58d9535b	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 09:08:47.66783
9cc96b9b-4a71-49bc-b3b1-688ae8519de0	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 09:08:47.668403
2639c7e1-d21f-4bba-89c3-f68577fc5e41	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 09:08:47.669407
ae57ef9a-1d54-4c72-b3cd-44421dc69b4b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 09:08:47.681013
7678df73-de58-4cf6-8b2c-0fe02efa9acc	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 09:13:47.637186
f9ce13f1-6cdb-4955-b9cb-c4000c50129b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 09:13:47.637678
6d39fdb2-6fb9-4edf-a8fb-e57970d32213	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 09:13:47.639702
637ac0dd-248a-4c68-9ac0-89bb748ec091	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 09:13:47.640163
8e95aea8-058f-4215-8afe-b9fde38c0743	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 09:13:47.649952
556ff054-473b-4b69-b278-d9c4043fa289	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 09:18:47.665357
d38526ef-7690-4788-98a7-aa4f07bb4726	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 09:18:47.66637
966497e2-b5da-4d31-b96d-a6db2f86172d	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 09:18:47.668232
6712363f-2a19-4f19-aea7-9634d783bdc1	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 09:18:47.669293
ad065b41-aa9a-4fd4-959f-9e5171bbfe6b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 09:18:47.677604
d681c7e8-3c6d-4c37-8468-f1d4611a4b3c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 09:23:47.695069
8b7924ee-918f-4125-9e3f-de5e3ce0c55f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 09:23:47.696177
2eab1a6a-34e3-43e6-9b47-12902ab70913	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 09:23:47.696645
617d3cd8-884b-43df-82cb-a056f36a3724	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 09:23:47.69687
acc2e081-0681-4980-81e3-7cf9429c6d8d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 09:23:47.704701
62f4846c-20c1-4eae-a0b5-2d7a828a49b9	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 12:13:36.256052
17c612a1-598a-49f4-8f2a-f55ab025e8cb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 12:13:36.257027
6580b8f9-46d8-40c8-b284-c0235d223846	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 12:13:36.256613
91ffc3c0-bc1e-42ef-b4f4-98df50865429	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 12:13:36.255441
fe65c832-2d27-466e-9c5d-57d84f5865c4	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 12:13:36.268975
46beb569-04ed-4900-b533-e8e11b560bdc	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 12:18:36.185455
e19e07bd-458f-4289-a3f8-a796ce1ac41e	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 12:18:36.185953
fb863ffe-a307-422f-a799-01f316ec6853	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 12:18:36.186238
f3383f09-06ce-4ab3-9ed3-b8b5f67df3f2	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 12:18:36.187155
3ddaaf61-3e16-4f03-bfd3-5dc95e461441	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 12:18:36.198944
130f3f50-2335-4d6d-8232-bc4728451756	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 12:23:36.204942
77565e8d-9790-41d4-96c4-62b69f60ecd0	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 12:23:36.207024
eb6526f6-c653-4acc-8b3b-e27b92120c32	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 12:23:36.208363
a9db4520-2add-4b00-8ff6-8200a2ca8154	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 12:23:36.209006
d48dcd48-5797-4a4a-850c-d722a09e88ec	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 12:23:36.21438
eb40b066-5b48-4375-9340-258fcef63840	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 12:28:36.227141
07ceddfc-0f3e-41f3-9ffd-945b37657655	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 12:28:36.227343
1524ae92-56d9-4d6c-a327-a31eccb9384d	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 12:28:36.227575
690fa346-ed68-48ce-821c-5f56b59b4ab5	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 12:28:36.227747
1d39dfb8-9446-4c78-b1d6-fd21f8d8854a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 12:28:36.234614
826c83c1-0539-4446-95b2-f102f77e44a6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 12:33:36.254064
ad404c2c-296c-420f-abdb-a8b51c6ee987	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 12:33:36.256024
8a657bb6-b302-48ba-8a63-d410fc95768f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 12:33:36.257447
2e7a3774-0a9f-406d-813b-dd767d0f7e71	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 12:33:36.25766
bcf24838-d3d8-4913-b121-62f8e74ee5e3	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 12:33:36.264896
b96ad562-86ad-49e0-8c35-d3a0e9b00f4a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 12:38:36.287489
11dc6769-6059-4349-b10c-a15e29b7b046	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 12:38:36.288057
c4104875-8f4a-468c-9792-e2d4d1193d73	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 12:38:36.288049
d0750f6b-8942-4161-81e2-09150b32cccd	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 12:38:36.289861
3307d95a-dc9b-4959-b770-500a337f11fe	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 12:38:36.296771
d467cca1-5229-4e99-b1af-6d16f4d15023	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 12:43:36.315806
de7495fc-c051-43e2-a75a-5141383eaf95	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 12:43:36.316972
96fc05fb-bc08-40af-a5a3-bf60545c1705	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 12:43:36.317587
f31b7e43-74e5-4525-9e82-9ded67761fb5	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 12:43:36.318443
6e021eee-e71c-48f7-9b2d-414cbeba3663	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 12:43:36.323838
fd7d4180-7749-488d-ab4f-4e239f69769d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 12:48:36.305769
f82bb0ef-b896-4af0-a9c2-c3942453aaae	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 12:48:36.305983
82bb2a28-7117-46b1-8e7a-abd266314199	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 12:48:36.306186
15be8b63-15cb-4171-b534-70fd310d8c5d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 12:48:36.306588
1f975c8a-0d38-485e-a028-fcfbb904374d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 12:48:36.310959
2504bf9c-be5a-4370-9b41-dc052feee7e8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 12:53:36.342838
bb08e68a-782d-422f-ba99-46981f88f615	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 12:53:36.343348
d6a028ee-9053-4eb8-a696-32fc6dfc1ee4	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 12:53:36.344986
cd556a8b-6efc-47b7-858b-f13e707f523b	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 12:53:36.347325
316bea0f-5f92-49cf-9843-4c107b5fa571	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 12:53:36.351409
de63f18c-9050-4d04-9031-21d080351cda	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 12:58:36.373237
19dd2224-8ad8-4eed-a569-324a221f8399	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 12:58:36.373452
302115fd-4f9d-437f-a5d3-ac58194e3b59	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 12:58:36.374036
67e0602e-9ec7-4280-ada6-408443453b71	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 12:58:36.374978
020c678c-70a3-4430-a7a0-5271bc15bc39	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 12:58:36.379792
2424ef62-3e83-4120-b177-2acd6b6a66ec	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 13:03:36.405497
0204920d-5cb9-48e9-8c13-72711d0250b0	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 13:03:36.406012
996c3aee-23ac-442f-83e6-ca30418a69eb	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 13:03:36.406035
68a78121-b852-489c-a343-a9797d10939e	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 13:03:36.408099
a3594927-bd5c-4c14-a3a6-610621d4cbbb	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 13:03:36.416268
db000a8f-14a3-4133-8332-065221695430	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 14:05:06.867316
08216329-d445-4c2d-8e0f-923f8016e34a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 14:05:06.868052
d1f0191a-0a62-4890-af06-6851cba82c0c	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 14:05:06.868875
60387721-7b01-4358-aa44-b56413169b03	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 14:05:06.869498
5e8d779d-4183-4f0e-840b-5cb99b01a33d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 14:05:06.883443
7348accc-c1eb-493b-9949-9bb8a3e35d5b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 14:10:05.847664
03ea18c4-06bc-476f-87df-90fa4dd72189	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 14:10:05.856168
9fc70b90-d776-44a2-9a74-8ce32f98e304	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 14:10:05.856495
0030cd1e-f710-40b4-8a3e-cdd6603c93cf	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 14:10:05.858822
1093483e-55c7-4c2d-948b-11d080eadd7f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 14:10:05.865012
d11b8ae2-5b5f-4fd6-88b8-5b34c555db79	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 14:15:05.858193
628d9186-5175-4b89-a9fd-6b818248a3ae	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 14:15:05.859667
dd881f64-5e9d-4c5f-8441-61ca3865da05	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 14:15:05.861812
3e00191e-0eb0-43be-8576-60d6691c84b9	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 14:15:05.86206
77b9e629-f022-492b-9136-97f1d58633e4	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 14:15:05.866233
e458edc8-cdcb-45f0-b2c9-8169f3fc5638	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 14:20:05.869488
5d33e002-3389-453b-bd6d-5d739c1ed1df	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 14:20:05.869735
73ae618e-5292-4505-80c0-4f8af4a963c9	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 14:20:05.872177
5449075f-dfe4-4dd9-8070-f9cc26ec8aa5	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 14:20:05.872766
2f6deb8c-9283-4b35-bd58-d211c563d1fb	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 14:20:05.877683
49851125-d0af-4ed4-9b7c-f9f50a1c54e3	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 14:25:05.861425
f5c9b899-098c-4f1e-8c30-288f97fdf66f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 14:25:05.86165
5178dea4-5b1e-4573-b132-02d2bbb6c923	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 14:25:05.871189
0d9531ea-9fa3-4889-99f8-4b270d9725da	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 14:25:05.871369
3de50d68-0875-44e4-af53-532e87917cb1	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 14:25:05.877966
f1c6bab0-e2fd-48b0-92a8-36a39d0363fe	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 14:30:05.899748
2bb744c0-ded5-4c15-90d6-8c052a7ad414	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 14:30:05.899928
b4c3c5d4-857e-408e-81f1-45decd48159a	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 14:30:05.9002
b9636bf8-4e5e-4c2e-ac76-1b5751d77573	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 14:30:05.903289
45224d2d-5f6e-47d1-b74c-bcd2900407ea	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 14:30:05.907385
418e7b77-bca4-445d-86ae-79f1c92df111	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 14:35:05.918019
28a90437-8de1-41a4-af43-a840cbb5ebe4	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 14:35:05.918245
cff4b903-ddee-4024-843c-42ca35b7886d	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 14:35:05.920646
1028c99b-ba34-4148-a5ed-947370d60fe9	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 14:35:05.920809
d7e1b17d-2636-4ee3-8200-437cbe933cd8	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 14:35:05.923959
e037d231-9c04-46bc-84cf-4270df4266e1	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 14:40:05.94114
030750e2-dbe6-4cff-bb7d-cc31c0110226	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 14:40:05.945116
e779b81b-5cfc-474e-98fe-6cf2ed9d824a	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 14:40:05.945603
2d1e16e4-8e9b-454c-94fa-fe81a07b2c71	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 14:40:05.945789
0dc52db1-eb59-4401-a333-b3745f523c2a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 14:40:05.949653
425f240d-3d42-4409-bfbe-f882e239e64b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 14:45:05.96702
1f55552b-0483-4e23-a46f-23e9ac53ee94	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 14:45:05.967313
9c01fe09-ef30-413e-8d45-af54fa925727	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 14:45:05.967973
a51d5e02-f4e6-4df3-ab4e-5014da182aa9	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 14:45:05.968298
2ac198c3-9d36-4d33-8600-95b44f7e705e	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 14:45:05.976635
8cd12136-71e6-4550-bbca-3f418e4faf49	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 14:50:05.979097
8510e734-4e96-46cb-9db9-8b59c2afffed	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 14:50:05.979219
afe86185-4f41-466b-a3e4-b7d3c7686669	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 14:50:05.979592
2def9db8-e73a-4a1b-bd39-683954a56c20	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 14:50:05.980774
5d92c6e6-36d4-4920-be29-c24227a7f7ce	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 14:50:05.987432
f7b027d8-a668-45a9-93d7-0b1474f98add	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 14:55:06.024566
f2a0b6bd-7c46-49a8-945d-794eff1f584a	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 14:55:06.026993
aca24e41-e291-4140-8b07-5a7c59fc9bfe	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 14:55:06.027212
b6e28cad-ef75-4899-b278-46866f5b0420	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 14:55:06.028897
6d953be3-959b-4c25-94f8-63c3244f4764	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 14:55:06.059225
282672a5-cb4d-417d-90eb-41a153b023b2	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 15:00:06.044867
668d97a5-c152-4155-8998-58ec3ba0ea79	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 15:00:06.044834
557d7097-65ba-4bf1-be88-639dd4a8a480	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 15:00:06.056742
1667845c-6343-4f19-8e3d-95d33e995b2f	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 15:00:06.058714
d7be312a-6fd5-4000-a2e9-1f8e2dcf357e	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 15:00:06.064574
fa3da187-56cf-4f4a-81ea-079c1f98a7f3	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 15:05:06.026005
d8d8a489-fd1b-4279-a7e3-87aa22bca6c5	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 15:05:06.036111
e1b021d5-3b2c-45e4-bbd9-65da99dfc745	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 15:05:06.037342
8270642b-6dd9-4c38-9ba7-947cfae5166d	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 15:05:06.038262
2f06cfc8-841c-4a5c-b6ea-23159d5f3fa8	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 15:05:06.045005
b780f48a-df00-41a0-b55a-fa75300de026	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 15:10:06.061911
f2870083-a272-4850-b448-c7f14ed42425	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 15:10:06.063423
0e1e13fc-30c4-4657-9249-16c55a29b977	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 15:10:06.064259
cf91af30-c8e2-47de-8508-9c3bd992ee0d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 15:10:06.066857
9625f30f-5c8f-479e-ac56-002c5a389603	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 15:10:06.069055
4d7c1004-befa-4295-8b55-9d1130f127b8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 17:34:27.123231
567935d9-1b6e-4543-9215-3fefe29925ad	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 17:34:27.123811
35ef2075-9479-4b06-8787-e9a3186e0282	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 17:34:27.122765
efde3c00-0180-4ff4-abb6-596f19793c22	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 17:34:27.124345
3b5f8c86-630d-4242-99fa-e55d984eba20	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 17:34:27.136852
edd89ea9-083a-4244-ab41-ade3623b7996	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 17:39:27.063996
79e1cdef-15ec-45f7-b664-e009ffe5fa1f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 17:39:27.064648
ca707210-1ec0-4660-be91-2c4e3d1b0279	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 17:39:27.066062
bacd5bf6-997f-49c9-aa65-88e77098c045	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 17:39:27.068668
5cbddfe7-ade5-4e59-ac43-04f6f1f3158a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 17:39:27.074274
0144e09b-17c0-4824-9a03-9f396d4c20e3	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 17:44:27.092002
9ff80a81-21d2-465d-b6d4-5247dd8d2a66	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 17:44:27.092862
3a768db8-6972-4c26-8d76-93d2606ffd0a	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 17:44:27.094098
a568f63d-d74b-45db-9a8a-b698d7d27124	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 17:44:27.09538
366715a5-fdc6-4964-adfc-b413f8e3d590	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 17:44:27.100208
0df5476f-96fb-4a81-a0d5-dd335aad95de	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-14 17:49:27.121517
a6406869-ddc0-4bbe-a77c-a2d3c8cdd741	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-14 17:49:27.121869
52d3b25c-c11d-4e52-8867-d56ecc846010	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-14 17:49:27.123672
359f800b-9b04-4cd3-b050-514caf89b944	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-14 17:49:27.126738
fa4a6e66-0df6-4b3d-8c32-805cb69a6e4d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-14 17:49:27.131212
74fd04a0-4698-4538-a8bf-d268aa9f58b4	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-15 04:06:28.726553
8d5074ca-465f-4830-b9f2-b29bc49a9a8b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-15 04:06:28.725925
8ee69121-90ba-4043-8b3e-cf3a81713d37	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-15 04:06:28.727991
baed66dd-ae38-4192-9b67-d731bc254597	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-15 04:06:28.727394
119fc833-0dae-4217-80bd-f15ebe9e4f8e	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-15 04:06:28.740863
01ce48c9-f6f6-446e-ba39-3806c0d4589b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-15 04:09:25.699913
042c7a70-dcd3-4b5f-9024-545bec58166a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-15 04:09:25.701555
124634fd-48df-4e7e-a0b7-61059800b86a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-15 04:09:25.701037
fd9d6025-600f-41d4-ac83-d8ceb57114cc	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-15 04:09:25.700386
8ca59201-2a1a-43d6-a88e-396cae15319c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-15 04:09:25.713284
42a0a121-ed00-4d9a-8320-40b644c6681d	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-15 04:09:32.14995
40776767-30fd-4c91-81a2-fcba70e29da0	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-15 04:09:32.154269
b300fe7f-f0af-419a-ba07-0fa2d6fde15c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-15 04:09:32.154771
c30401ef-0b54-49a3-91a5-09c48f3b71f4	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-15 04:09:32.155242
79b66ef3-ce3a-41df-89ff-1ecc6236cbfc	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-15 04:09:32.162805
0d657db9-8c7e-482a-bedc-e79830c2fca9	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-15 04:09:58.850992
0231c90d-d101-4ed8-b690-4514ea799cde	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-15 04:09:58.85197
121748b6-8b79-45c8-b986-2a5a0a6d67d7	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-15 04:09:58.853155
4b36b174-7bd1-417d-a2dc-035c69b25dc6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-15 04:09:58.854495
db0abea9-7862-452b-952f-9a945701251f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-15 04:09:58.863607
47469a6c-d874-447e-bafa-f29f384a0c51	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-15 04:14:58.822999
22cc3df3-3110-48d9-979f-291db7fa8231	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-15 04:14:58.824273
6c962e06-8e4e-4166-b6e7-132e8871ee65	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-15 04:14:58.825465
c0c99faa-da28-4274-88e2-1ad77335aa66	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-15 04:14:58.82702
df1e625c-dd55-446f-b571-23aefa60ca78	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-15 04:14:58.833366
cddaa8c4-7ef0-4e98-b964-2aae06ee0928	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-15 04:19:58.851144
91e192bd-eea4-421c-b74a-33fc1077f040	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-15 04:19:58.854248
cdd4efec-418d-416e-bd9d-86f3456eb0db	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-15 04:19:58.854586
317f7e89-7e16-48d1-a3f5-d0d18e52cef3	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-15 04:19:58.854943
c81d8fbc-69c6-44e8-a3f3-ff290570193b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-15 04:19:58.861524
468de339-61b1-4e98-a199-9867004a8b83	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-15 04:24:58.879926
033eb05e-5449-48d3-8974-3f62bb32693d	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-15 04:24:58.885221
71776771-b52a-47a0-8629-b4e7acea659a	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-15 04:24:58.887792
6f7f5951-ae26-4f50-81f7-47f608af5eb5	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-15 04:24:58.888109
7003db54-e3f9-4919-a412-f5ad76194dd9	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-15 04:24:58.88896
49df6383-8e73-4804-9e82-068b9d72faa0	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-15 04:29:58.868217
4a095770-42f2-4fef-be38-46b7e07934b6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-15 04:29:58.868608
9e7c44b2-129b-4c20-b48e-23ad7260443d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-15 04:29:58.876701
53ff8446-5665-44ac-bd6a-ca535f024671	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-15 04:29:58.877878
78d4d4b6-ae9f-4657-b616-d1ce181bae1a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-15 04:29:58.88297
46bd3498-c854-4c30-9b83-0370973dd9dc	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-15 04:34:58.90586
46b464d9-3341-49e2-af0d-652456ffaa6e	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-15 04:34:58.90691
2a0286cf-7c96-4da6-b6e2-1eecbf062b78	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-15 04:34:58.907812
1dc13b4f-5264-44a5-9d86-c8e383365c67	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-15 04:34:58.910361
f24eecd1-5855-42ed-9101-d8d23ba614cb	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-15 04:34:58.915548
a8da6b98-8704-473c-b124-be0368e91229	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 08:42:54.126158
bffcb962-9bcf-43c2-8434-f387bd41e58c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 08:47:54.075494
38d1655c-ff92-4909-8e30-d073d0ad3438	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 08:57:54.116733
92672e5f-8182-4775-a580-0f00dd5c1424	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:02:54.149769
4dd61337-9cd5-41b6-8689-758f47d01e96	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:12:54.194343
688e8c3e-18c9-4734-8543-777245f6fbee	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:16:03.093001
5f5cc72a-2afd-4dec-9200-5a15d891661e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:17:54.196133
aacc5866-c5ea-4f91-b3ca-3e1ccdf3d37f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:21:03.155785
9c2e1d08-81c4-4793-b2cb-7adf39208a5b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:22:54.216414
b8e93157-59e3-4a9d-b532-84bb453d858b	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:26:03.251416
1d53ee12-21a4-406a-bd0d-5e326f3146ff	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:31:03.288074
b02ec3d8-8df9-4500-ad31-19eefab94cdc	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:31:03.350377
85d43893-6c0c-46f5-bd6f-55637200233c	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:36:03.39093
357d2373-fa4e-4b85-b43d-d53520f7287c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:36:03.456583
052ce155-f471-4b87-a2ec-a538578f7c6e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:41:03.486846
6bd150d8-260a-48f0-921d-210ab9ca9cdb	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:42:54.21952
10e0332b-f681-4a65-8857-30ee69893085	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:46:03.584957
2a19cb47-92ee-48ee-b263-055b29f24e0a	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:47:54.244427
b3fc1241-2e72-42be-a1b5-27678f155169	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:51:03.69018
814bd21c-a877-4fbc-bf45-b85532cdf9a1	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:52:54.27238
3867d1d4-b374-4bb3-9dd0-bb2739e744a3	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:53:38.387498
112a4381-f026-4fc1-b1b2-2b9c24e91225	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:54:52.200332
1e63fc89-8194-498c-9545-88632203600a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:56:09.960679
c703475a-12b4-417e-a733-166c58db1b02	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 10:00:50.051534
3bc2ed68-b6d0-4dc0-8d23-333f032a857a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:08:21.658608
7c0b27cf-f1af-4b4a-827c-1e57b6148c7a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:15:54.112846
279d0a09-f81b-46cb-9227-b2b37f582592	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:18:47.172438
549a686a-5dd4-4665-ae33-ff2886950bd3	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:23:58.198675
75a82e3e-2906-4eaa-8895-376cf9ae26ee	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 10:27:48.254086
9eebd5ef-4a99-44db-8977-dd73460f6ae2	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:35:08.011845
7d1c846c-4ce1-4eda-934b-3f5a05fe304b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:44:10.544175
8788425a-952f-4b77-b3ed-8dd2cdf06bb1	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:49:10.552392
0aa3ac3b-abbe-4fa9-b1a5-c43d861c49da	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:26:44.249514
250a258c-92f9-4b7d-9d25-5cf131375aee	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:31:43.227374
af035760-d6be-4416-9951-8d762efc9a1b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:36:43.2524
acd9f942-84ac-4920-b2bd-ff8f00788490	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:41:43.244
9544e90a-4a82-40af-a574-869425a90ecc	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:41:43.496719
039e7178-cd40-4885-b06c-530ce1f783c0	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:46:43.592618
0f4ebb54-e24a-4b44-a463-e699d24780f5	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:51:43.285896
0fbc2aca-34e3-4626-a54c-01b17c3a17ca	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:56:43.278095
a064b162-67ea-44e0-b573-5212a3a8c282	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:59:21.862108
ebdfeeef-4a65-49a1-a0c3-68f3513f4a49	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:59:52.220836
6ee3c6b9-6f0b-452d-9d16-17457c7da06d	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:06:04.191884
2d84236b-dc36-419f-9880-f1d7cad71946	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:06:51.086597
14dff110-1f69-4a20-80e4-b5649d1ec6bb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:14:03.814599
dd576295-7c84-429f-be42-54cad50748e5	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:24:05.148122
5b2b0046-a7fc-46eb-a30d-794e77cd1754	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:25:12.855894
1f6631bf-4444-43a9-9aca-ced522d393c3	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:35:12.836145
bdef53c0-63d2-4795-b8f2-a3a103b7d35c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:37:32.380916
8ab48fe9-a4b1-422a-b3fc-f76edf056b13	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:43:18.867893
d4555749-ca1a-4bd4-8f25-e15ae1834fc7	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 17:48:18.896885
a38b360e-092a-4c67-9ab0-20b991691b4d	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:52:32.583134
0019ea27-508b-489d-b280-02172cf94bde	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 17:59:41.377698
5c5dd72f-dcfc-485b-b543-cb02289d5f94	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 18:04:41.351474
ed84f9f6-cab4-4312-adee-4db7c15c37e9	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 18:09:41.375391
a949faa4-3cdd-4443-809d-2141d4d97d7c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 18:13:11.980028
1e54bf92-f3e7-47dc-a424-283e4ac7639d	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 18:18:11.992932
cd875403-1ba9-4e84-98b9-2012fefa9288	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 18:23:12.89984
d3fc448d-a139-4c78-b7be-be3676fe3146	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 08:42:54.126679
46040bc6-cc09-4787-8507-7882bc4fbec7	emails:invoice_reminders	success	Sent 1 invoice reminder email(s)	2026-03-23 08:47:54.100105
23cf9124-cda9-4200-a0fc-4145c4bbb3ac	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 08:57:54.117541
edf37b1f-55e5-4ffe-aeed-e63a7dad5f52	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:07:54.167937
2f20e73b-fa5c-4421-981d-c15b4a524e09	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:12:54.197003
40a11dd8-0090-4630-b34c-450c754a0baa	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:16:03.096839
149c95d1-8f80-4e04-ab63-f792b5d64f39	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:17:54.200931
e6063694-2fbe-4734-a883-607a0b153345	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:21:03.157285
0c40680e-03a6-4f9f-8087-f33521018139	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:26:03.186945
f446474e-b921-41dc-a183-66bdd9f2bd68	emails:invoice_reminders	success	Sent 1 invoice reminder email(s)	2026-03-23 09:26:03.253469
be5d49ef-9a18-451e-ac7d-76630bd0692d	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:31:03.29233
d9e9594c-ee0b-4dc4-9417-dc38b97fd0fa	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:31:03.356755
fdcadc6d-7ad4-4470-a8af-b58372f9d229	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:36:03.392199
7e8a14be-c3fb-488a-9a79-028925a5cec6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:37:54.227576
23594f84-05f1-4606-b2b9-f86b8584ec72	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:41:03.487054
4f787795-ca34-446e-931c-a930a81e4964	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:42:54.230889
2406087d-fa57-414d-a65e-c81c38c9f877	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:46:03.591516
15e8095e-306b-4ca3-bbc5-1fe34f6337ff	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:47:54.244577
e2f1cc81-0bfe-4ce1-af31-be830709171f	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:51:03.700031
7cd350a3-e5fd-40e3-bc00-2c4472ff03e3	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:52:54.27346
ef01d69f-7346-405a-9b3c-79b4e62c969a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:53:38.388066
589fb9a4-12a6-4d30-b989-b4cffbdbfc6a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:54:52.2054
18117976-0688-4ca9-b4de-e70c88485766	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:56:09.961867
3d4292d5-53a5-4474-baca-b8f13480b247	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:04:38.248574
d4f49d65-f605-44dd-9155-eb0be88279f6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:08:21.659038
61e2fd11-e707-4e4d-b8d2-8528ce0172d5	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:15:54.114081
d01a5581-e129-435d-a827-711497fe4d87	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 10:18:47.178502
b8ed1077-952e-4b34-9c13-bd477027e73d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:23:58.201873
0943ee87-269b-4a44-888c-1488932a2fa0	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:32:48.168209
92716928-6405-46ea-abf3-4612b6da8567	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:35:08.012727
31ee020d-403b-4af7-b1d9-4a4274e5925d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:44:10.546671
542beb80-e986-42c7-8579-88c30f049af4	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 10:49:10.558062
1033cf30-3b01-4d88-8023-41234916ae49	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:26:44.252543
8f091d9c-10ef-41df-8894-96a5f6ba979a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:31:43.29906
9cc64ab9-ce3f-4e34-97c2-79b2b7491f23	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:36:43.254365
92ae9b95-d4bc-4f64-959e-f369c0c909e9	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:41:43.257708
71388ead-3ac4-45bd-9c43-7709c5ccab46	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:41:43.501508
38012a0d-932c-4e74-b6c2-3931505e79e8	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:46:43.59293
bd3cc553-9ac2-4132-a705-9e6c6f64145a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:51:43.687755
fdc9de6f-2709-4bff-8d3e-5c7c287e65c3	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:56:43.280475
9337ed63-73dd-40d3-90be-a83ac7c2b61d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:59:21.865323
d2b64e1b-36f2-4162-b0a6-f774b74e7e8d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:59:52.227295
0561b2b3-1551-4fec-84d7-ff500bfe6ff1	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:06:04.192382
5d72209e-b982-45f9-99ac-c25d4ef7be6d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:09:03.889656
c5c479b8-22e0-4929-b76d-cda909e84c5c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:14:03.817604
01080eaa-9760-4caa-ad38-b94dfb0edbe3	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:24:05.157119
16491a4b-ff8a-4411-8bde-10308a131d9c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:25:12.86176
053d6f76-b8ef-4fd8-ab65-adc8740d8aaa	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:35:12.838848
b1bafbb4-562e-478e-9eb0-fc72a013bde6	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:37:32.388208
7d4ee52e-ed30-4391-83f6-4c95199f59ea	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:43:18.869454
fa76e1c0-fe7a-472c-b8c9-22389b7b019a	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:48:18.898275
3d1e9ce4-08d4-4592-9761-463ae7372eaf	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:52:32.591429
82c0b0e9-3a22-4b4e-b4bf-95596ccf48a4	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:59:41.38067
cb09c6f5-d4a4-4ce8-bf2c-9ae566d0f0fd	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 18:04:41.351806
c5039785-1a66-45c9-a8ed-8cdd5b7d622a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 18:09:41.38252
572c1b1e-9de7-41f5-bb94-af0c0637c5ae	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 18:13:12.018624
95af69a7-9cfe-44e6-81e7-4aa393b7f488	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 18:18:11.993911
8fb8396d-80a3-4ce0-bae0-c2e284e5ad80	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 18:23:12.900249
c9eb207d-d143-42ba-a90d-7eceec8047f2	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 08:42:54.131141
ca04861a-7b0d-4337-bf35-29a4767c7e95	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 08:52:54.072967
b262581b-38e4-4fd6-b4a8-a79cc1d5bae0	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 08:57:54.119639
e7149e50-0bf3-4ffe-9461-871628a1764d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:07:54.168194
67cf9d95-d1ca-440a-8e90-6b360d86f4c6	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:12:54.19727
6d1ecbff-e824-4fb0-817c-321cd08e213e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:16:03.099257
5991aaae-0497-4f23-bb8d-c3420af52861	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:21:03.098765
66ac3243-931a-4fdb-9889-b4ba07d5420c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:21:03.158706
ae53c588-078a-4252-b04f-5c6dab5b8248	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:26:03.191672
1e8bec60-ef58-4602-828a-61c36357047a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:26:03.259142
1994ebf7-f560-40f4-9cf8-7736a12a099d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:31:03.299146
ef35b19a-b2d7-431f-af64-3fafd7adc18f	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:32:54.20298
ababc15d-2051-4530-a38c-0332bd56279e	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:36:03.39667
dc139992-d166-436e-8219-d70484f7a04f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:37:54.231597
1e73e960-4c41-4213-89dd-da2578762421	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:41:03.495138
b0ae4044-60f6-49ff-af31-572185a5aef1	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:42:54.231973
d9f88d0e-bfd0-4c81-ab18-3da76b895362	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:46:03.600719
8fd3550b-06b0-4c3a-a703-c4cf969adaac	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:47:54.245905
a46a486f-9ff5-4ea3-afe4-4e173258cd78	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:51:03.703376
95e2f80f-27cb-48f1-89a7-15a6f0cf4131	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:52:54.27555
3bb46f5a-e62b-43a8-9d82-d03bd6a4e005	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:53:38.389644
2ad07c57-f8ba-4844-a165-25730689b8c1	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:55:36.650063
5d73eb38-5dfc-4629-b177-1d642cf0d994	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:56:09.964468
96fbc747-ec1a-4ebe-809e-c2974bcd5353	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:04:38.254008
d758c064-725d-439d-8e54-13853a84419f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 10:08:21.665963
61913012-3970-43a4-afbe-20bfa1e0a91f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:15:54.114685
021a7ba3-a149-4889-9a2c-b48051874885	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:23:47.113589
f228b774-0be6-45ee-a9ca-3605d0a9dcca	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:23:58.203563
04d0e814-85e4-4a2c-9598-1c1260b9ca53	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:32:48.168788
b8f087d4-7b47-4106-9276-bc2dd6578aca	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 10:35:08.020575
29390cbb-26ab-4d86-953f-2d7ef2f3995e	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:44:10.549638
21cd51e8-14a2-4e46-91c6-dbdaefbc2273	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:54:10.574324
5f951831-52ab-4233-b79d-70847b8a8880	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:26:44.222783
2ecfe83e-45e3-472c-8ba2-887067723c8a	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:26:44.253289
a513b3bf-9626-4b52-a8ea-ed5bc6429e3e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:31:43.304609
b495e720-39f2-4761-a739-74c29e0c36e1	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:36:43.259677
d07691f8-0512-4898-8893-13c7ec3aff93	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:41:43.257988
9b0e8f7a-b856-4290-9686-c9c551b389f0	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:46:43.272575
6a9a3530-0c6d-4684-b0a4-068bf5bb8f9b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:46:43.594349
e90e75dc-5021-4885-91fc-6543f2a53efe	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:51:43.690704
7a9767c8-344a-4487-bf07-c5fc238c0959	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:56:43.28379
9e0fd300-5331-44c6-8c2e-791fba5bb291	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:59:21.867078
db3e2bc0-23b8-463c-8974-787cf590329a	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:01:04.291796
63025a02-868d-4589-bc5e-81fcf03c2942	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:06:04.193511
464421a3-1b67-49a5-a651-900baa2cf798	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:09:03.890318
16f117f7-42f6-46ae-85e9-7cf05b088d73	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:14:03.82124
dcca97f7-85bd-4d1b-9738-7288a4100aa9	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:24:05.157796
2b6143d4-3a77-4b86-8b45-3d4c1d234fb8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:30:12.809304
a7ff5d59-9cfd-4560-b3da-1c871e21dd69	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:35:12.83949
6214e5fb-473a-4793-81fc-711b39e87686	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 17:38:18.879786
bd4aae59-86be-4410-bd00-5065201ca1e9	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:43:18.869916
a982d5fb-b8d8-4022-9629-5634b012bcd7	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:48:18.89854
bbbd11d5-45eb-4760-ad2b-7b758d579ba3	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:57:32.499441
1179b082-8a29-447d-9d53-2244341bed37	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:59:41.382558
6b7e298c-019a-453b-9b77-965232616e00	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 18:04:41.352128
29dd4944-a507-4dce-985e-d730975f305e	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 18:10:13.378494
3923d22d-3c59-4bbd-a3f6-129619b92f74	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 18:13:12.020637
40834de0-b49d-4b76-9968-150f8d4952af	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 08:42:54.190244
cb40d8dc-5600-4964-9b4b-cc1f3684f372	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 08:52:54.084591
8b3d59df-ae41-49b7-b83b-cfbe2469d26f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 08:57:54.121506
6fde4105-acb6-490e-aeff-c4f823d106c5	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:07:54.170741
39a9f66f-5cb4-466c-a0f7-5a7e44e02776	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:16:03.025732
21c2111f-7213-4a0f-9604-86164c42449c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:16:03.102373
9bd0c721-ede6-4186-801b-b8f525df108c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:21:03.100609
dc3ccaa1-3d45-49ad-9a98-a2f5bc17c9e5	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:21:03.163815
945837ed-d34a-45c8-ab4c-917c10d8e702	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:26:03.192719
a5713a64-a606-4f0d-931b-7f450875b7d8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:27:54.2006
f42cdad1-b2f9-41a6-835b-9c2f472ba622	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:31:03.301235
08bae18c-8fc8-4d9c-ac8a-cd31688e9d24	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:32:54.214164
0e65b519-c583-44c6-b5d2-88df3c9bbed6	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:36:03.449222
d78ad492-3d31-4f3c-a0da-b6f518457335	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:37:54.23183
3d9d6231-5388-43f3-96a8-4e2b698bca8a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:41:03.499351
7d60b898-84db-42ee-8dee-33bba9c3d716	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:42:54.232784
075f7f70-3a72-4279-999f-263d30a0ba4a	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:46:03.602228
86f0f409-5bba-40d5-a904-7b00b6f0cb85	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:47:54.250339
f70c14e8-cafa-4793-b85e-2ae91e32cf19	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:51:03.703748
e9496cb4-d046-4a5b-be5b-da949b951f08	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:53:08.279724
56994260-0689-444a-8a2a-0cbe53906b9f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:53:38.392773
f6037642-5899-4457-b96d-aadd26523034	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:55:36.6513
5185a0be-c23a-4671-aa25-cd437ca0733b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:56:09.969651
85cf41fc-ff74-4b71-ade5-f1ffdd922a3e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:04:38.254829
f39f7f84-b973-421f-8af6-cf6ce07a2013	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:12:33.90313
d5c5003a-b2c6-488f-9e81-cd92a14a53fa	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:15:54.116652
21109479-1953-42d5-9f36-c31419abb497	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:23:47.114152
a8902a53-82f9-4d36-a729-cda40c0a7060	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 10:23:58.210478
cfecf984-91ba-4b70-ba66-4538cc6eb664	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:32:48.169939
56704e29-91e7-46bc-9597-6fc5e922b318	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:40:07.910127
0e043c2a-d006-4dec-a198-dd5a2e0d85fb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:44:10.598525
e69cb15d-efce-412c-9f8c-dbeaade0d981	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:54:10.577233
f961297d-0ea8-44fe-a056-f6c99e4dfc9d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:26:44.228288
425a4e20-ffaf-4dac-9a02-c024db733691	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:26:44.261491
b420147e-5478-4bbb-a9df-adb58785b5ff	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:31:43.305089
e91596a4-c188-4b5c-8c47-e87d470f76ba	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:36:43.39434
169e48e6-107d-4109-bbdd-9ce50fd21557	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:41:43.258736
f7e92764-9eb9-44d4-a3cf-4973a4c9b3a0	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:46:43.274935
3fd9a007-a7c3-42fa-bedd-415e50502893	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:46:43.599272
c96f7fda-ce38-4cf5-a8e1-99c4986b2cd9	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:51:43.691431
301d0d09-1bfd-41e8-a721-cdec0d3ae10c	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:56:43.790518
ecff823c-10e6-441c-95c9-ccbf31de2c08	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:59:21.867606
08c909a0-e9c6-4cbd-9a4e-3413fbd26ba0	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:01:04.291626
51110897-f79e-4603-8638-53e2ea040577	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:06:04.198485
5c7d3bb2-ba98-4dd1-b7a0-432a479edd2c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:09:03.895725
133e403b-9460-4bc8-a08f-9114d6f33253	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:19:05.211792
14721044-8f76-4dc1-8eff-d30ebe9b4532	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:24:05.16063
d6465e04-78f6-4474-b059-b07c8ab422ee	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:30:12.810205
571863d9-986c-4179-ab45-0cfac5fed3f9	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:35:12.84373
96952c5d-b330-4a18-8c52-24fd8d18d8e4	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:38:18.943364
ead12d33-c2d2-4a98-9eeb-3cdc3f0c3842	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 17:43:18.870045
221ba570-fbba-48d9-805b-c547c8851ecb	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:48:18.903081
c704a8d3-c81b-4f7a-98fa-bdff8f6a25d8	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:57:32.500037
062e9f0c-d3c0-47ee-b8bd-56d86948e4ec	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:59:41.384317
b157c75c-74c8-496e-bb98-f9caa3f22d1d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 18:04:41.35803
42b03896-3d40-4c78-abba-73e39f6db347	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 18:10:13.385139
8a5891f6-8683-41cc-96ce-52f6c43aedb4	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 18:13:12.024179
a47ffe1b-145c-42dc-871c-9337a002aa3e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 18:18:11.994655
96803c9e-edad-4e94-9618-8aa5719d9055	billing:auto_suspend	success	Suspended 1 overdue service(s)	2026-03-23 08:42:54.797503
089e3011-ff47-4b05-9ac7-6b6eb772a548	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 08:52:54.084965
ca10937c-d587-4333-bd81-e25ecb232c91	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:02:54.143665
37464f6f-aa2e-4df6-8f84-17cd9b1b3a00	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:07:54.171156
9f8da965-e7a8-4a2d-bfb0-e843af05283d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:16:03.075392
3f086853-b49e-491b-afcc-14292e87d1da	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:16:03.103821
dc74d971-2ed2-4aba-ae11-dd3e2d99e63b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:21:03.102894
4e6538a3-4dbb-4a20-884f-03ecb5834c2d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:22:54.211462
9fca9062-f8e1-4a1f-8f69-3afb02307fdc	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:26:03.194685
03e899ef-fb55-4044-8935-42a396789efd	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:27:54.214481
85d71ad7-877c-4912-83cb-44b155c762ef	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:31:03.305277
33e5e83e-f727-4647-920f-126c5af0d612	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:32:54.215565
dece456c-2bfb-47d0-8daa-a45fd97db70b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:36:03.450448
178d27ee-8483-49fa-8bd1-c9d2b33f3d65	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:37:54.232048
6d32211d-fe34-47ea-b82e-c9e72f541b6b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:41:03.501739
b3dbef58-f926-4f31-a855-36cac14bad77	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:42:54.238751
603854e3-f5fc-4136-8140-e138abfeccfb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:46:03.602801
e618b9fe-9d3e-435c-aaf9-4327738747cd	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:51:03.683289
1a6359da-f638-47aa-b58c-216ba91222a3	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:51:03.705954
ad35353b-3eea-40ba-9a20-256fb55eeced	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:53:08.280221
2e07340f-8512-4961-aba2-6e616ac5f181	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:53:38.396515
15ec6ff5-9a0b-4299-b058-af7bbb512bf4	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:55:36.693936
425d72af-a760-48a0-a969-33bc442fc9c2	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:00:49.986685
d5d18878-b78f-4891-87db-e297a1df3e70	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:04:38.260819
95b97ee2-338e-43c3-a469-ad7c638c7983	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:12:33.90312
bf7a4000-5e44-4d70-94a7-afa1cdbb4437	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 10:15:54.124568
e796a027-7a2e-4415-9301-8be61083fdb0	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:23:47.117396
80c5f363-45f1-4424-af9d-14241363ba7b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:27:48.241724
9447584e-c4d2-48e9-b399-cfa3bfb6e04f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:32:48.169542
43078316-e0ba-4c84-a71c-afcc4e76d026	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:40:07.920617
5d8c7ae1-5345-4743-aea9-528ffa16c810	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 10:44:10.606964
e14e7ca1-ddf5-429f-a82f-a607b0a63acb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:54:10.577809
249cccfe-9ac1-4eda-82b0-3157da88d6bf	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:26:44.230291
a798589d-35c6-4d4b-9fbb-51d54e61cbeb	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:31:43.219202
6256c6bc-4447-41fa-8a6f-dd6fc65d0292	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:31:43.309869
65985fb0-06a3-4d39-842c-141970c0b6b8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:36:43.396108
ec7e7cc5-241c-4224-8edc-0304ccba89a2	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:41:43.263488
f11a8ee7-6455-4d36-aa7b-580f66e5cca2	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:46:43.276601
73132e89-4bf1-411c-90df-8d61bf8e4a0a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:51:43.264621
978ff47c-df55-4629-92b7-0a4fbbaf1fce	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:51:43.691672
b4c64fbd-d454-4b14-a29b-0c1331b299b9	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:56:43.790908
bfac20dc-8d51-4787-baad-1d8759d77599	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:59:21.87442
5daf40c5-dcb1-4901-a874-5f5814ed1e60	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:01:04.297074
4c113f98-bbdf-4de1-95f7-07906f6a0334	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:06:51.070029
5fafd87c-625a-47ca-ab1f-a1b00535568f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:09:03.89686
e22748f6-d2ef-41dd-aa10-5e219869a079	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:19:05.212552
9d3121b6-b7d2-4692-a0f5-a7e265c99391	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:24:05.165167
2de57fb7-fdf7-4ffc-8ad8-cb02609ce9ca	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:30:12.811727
a2a94c23-65ff-47b9-b290-5ce58a6b4570	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 17:37:32.325129
ab8adbd5-c754-4caa-b94a-75496fa86827	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:38:18.946177
3be657ec-bd46-43eb-880f-b2937c6097f9	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:43:18.874211
1fc299e4-a0ca-4734-9aa4-e2bef67780af	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:52:32.532123
53fc4686-567b-4b6f-a9a0-42f5fba851d8	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 17:57:32.500018
6eb50fb2-4a8b-4f54-a362-a36e367eadf7	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:59:41.385284
cca08a09-bd9f-4c0e-a447-dcbea7455d1a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 18:09:41.371216
1b51422c-8e3b-47bd-8684-9c94626c3f02	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 18:10:13.388461
742b580b-0687-480a-8966-fb495b5192da	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 18:13:12.025346
989584f1-c724-4eb5-b0e0-e8cfc3dab0d6	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 18:18:11.999439
73a79024-6b99-4476-8e95-682c9a616eff	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 08:47:54.072024
873794ce-5f0f-4747-915c-7b6ffbdc8b54	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 08:52:54.086161
7d62320e-a2f1-43e8-8611-eaaf0f019af6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:02:54.144157
0c84c1d7-f193-43fb-9edc-3aaf904e11ed	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:07:54.175428
df13e4f9-cb4e-439d-9630-032c6272752a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:16:03.077508
a0c7ce39-bd01-4dbd-abcf-151fec35cc24	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:17:54.183794
c2307bbd-38c2-4ecf-b275-9465aacb39a6	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:21:03.103951
d795d66a-44f4-4a01-b71d-909e901202c7	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:22:54.212242
e8aa9b50-2d8d-4197-b2ba-65057b87b041	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:26:03.248072
125c9d87-dbd6-4462-afe2-bf619e8f14f3	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:27:54.214805
adc62bba-238b-49fb-938e-31ac9af3f8df	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:31:03.30824
c5d0fb56-339a-4617-985c-2587249ab4a7	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:32:54.222409
1a911bce-cb45-47ed-a58f-8dccb574b85d	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:36:03.451224
87580595-fd74-4fe9-89e1-6c260351a73b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:37:54.234291
ea202b29-90de-4fd9-8939-c14f8d5b0630	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:41:03.502473
adc01e8f-79cc-43bb-b10b-abe3c644a5dd	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:46:03.583369
6d5a82d6-7779-42b9-9d43-9635e68feeac	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:46:03.604938
eea60884-acbb-4da0-84d1-3d5386502208	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:51:03.683907
306cdce0-e32d-4691-abac-5f56e285ae34	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:51:03.708599
0e58e1d0-3f03-4363-a2a6-1bc104f53541	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:53:08.282309
3eca3ea7-874f-4e93-9087-9611b5587f89	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:54:52.13639
fa5bef77-ca3f-4623-8788-78a4fbd13947	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:55:36.695432
324447f7-f3d9-4447-8e53-8f6099eca12e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:00:50.038305
c68b7e7d-b271-4105-a2ac-7ca43a676fd9	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 10:04:38.268499
00345ffc-c4fb-474b-a31d-bf110d36c27b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:12:33.947847
6027a020-e7d4-464f-8883-5517716118ed	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:18:47.123559
58303f16-296b-4b82-aa85-d521df354230	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:23:47.117691
6af0dec6-b37b-4044-b539-66bd7df52e0f	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:27:48.242253
eeecc97e-3362-4dc3-9442-03d2f675341f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 10:32:48.177528
8908e7f4-a9d2-4fa4-ba6b-49c41bafc159	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:40:07.922894
e40fc91b-2ea7-4702-9c1d-09a48c6285c3	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:49:10.549209
5423a31c-5b6b-4332-9ef1-944debdcb979	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:54:10.580809
aa58d803-0ae6-455d-88d5-4463fac6ab0a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:26:44.230874
bef53ce5-56c4-4b30-806d-fd97df4dafdd	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:31:43.220522
154a96da-e438-4c8d-aae8-c2b3bc3c794e	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:31:43.315444
f8dac38b-edf1-4850-98a5-96efe77e6a6f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:36:43.397951
8982d998-7d0f-4463-8825-2a9ecc17418a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:41:43.493855
4124fe60-420c-48fb-81b2-38dc415199c2	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:46:43.279175
0f8eb854-e8e6-4c0e-bf59-f0e38b7f2cb0	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:51:43.267457
1d867bd0-937e-4748-955f-f5106976d6ad	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:51:43.697878
99bc6020-4a7a-4f47-8eab-815a4dba19c4	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:56:43.792868
34c26772-607a-4ac7-85cb-c221ca494f48	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:59:52.215147
f6e7a10f-9d64-4db5-a0b1-07e2b0dce517	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:01:04.298556
ef0e0a1b-fd57-4ca1-88a6-9176003125b0	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:06:51.074964
f723f9b4-aef3-4a8e-9c18-86a7c569be7a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:09:03.901725
91ebe37e-8bc7-4b9c-9af1-f5855ff0028e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:19:05.213012
e62c309f-af44-49ff-93f3-0f782d6630e1	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:25:12.813833
cfe08dbb-2233-4285-afee-5756c77815ee	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:30:12.813376
9cbb14ae-2f15-4424-9c4f-9e7bca5d6e01	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:37:32.378737
7ea7b5ad-06ee-4c26-8b04-bde68007dc63	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:38:18.951147
8acde500-4933-444f-92e0-fd75521b1690	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:43:18.877549
10a5c72c-f514-4ca2-ab92-84c3016159fd	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 17:52:32.532361
a2da1057-7627-448e-9b03-90def6c01356	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:57:32.500788
5e024346-392f-44e3-9391-6feec891604c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:59:41.38938
24e98608-ca13-4abc-919a-ba40e9e63288	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 18:09:41.374477
ce4faf4f-1a4d-40d8-9c70-5b942fda9c18	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 18:10:13.390277
11fd39f3-c495-405f-ba38-cf8bfbbacdd6	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 18:13:12.029639
68ed2376-4cf0-403d-a8e7-3f789e0b2bc8	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 18:23:12.849325
01b60835-d8a3-4823-82f7-fc9d349fb127	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 08:47:54.073959
c4c02582-21fb-4b4b-9a93-92cc7762251c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 08:52:54.09067
cba111a0-110a-435f-b580-49b8af1195c1	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:02:54.145143
5a62d0fc-2f23-4259-9ed7-1ceeea1e76ce	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:12:54.191376
211915e2-bedb-4abb-b488-1663bec2b595	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:16:03.077971
bd94ab55-fde5-401e-bf5f-624f18300919	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:17:54.193916
50d8b30f-7f6c-421e-88f9-8b81f05c1590	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:21:03.113707
c1187018-798f-4b62-8ab7-dad5cebdb226	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:22:54.213605
4312992d-cd15-4cff-b9ae-7c98848dc1d4	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:26:03.25056
75d03bae-a295-4cae-86cf-9547c89a75b5	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:27:54.215399
8928ba26-390f-424f-804d-267a338d3046	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:31:03.309133
686932bf-51b3-49c6-8861-2b59757297a1	emails:invoice_reminders	success	Sent 1 invoice reminder email(s)	2026-03-23 09:32:54.230507
aa39d46a-f8ea-4e92-9710-c0bd05d1e9f0	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:36:03.451871
40f4e4a4-7b47-4bb7-89f2-f456b060b58f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:41:03.483653
ce3aa4dd-e4b2-45b4-a65e-e242dd1dc6b1	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:41:03.506839
f46730c5-a258-47f3-a7fe-6a629d87ad8e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:46:03.583687
c5b53f6f-927d-48ce-8566-13968cf5fdf1	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:46:03.649821
97bdb4a6-3168-483b-b850-5ec9986067e1	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:51:03.685171
27b8442d-9282-45d3-a8ac-f106ce2a87ed	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:52:54.270358
5930ec7c-9a19-4034-a076-6c7af023db47	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:53:08.283446
66dc3ce7-ec73-4da1-a945-9782f57ae58b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:54:52.137618
cfce29ff-ed76-43af-8cdf-c13d8f8b0cdf	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:55:36.701433
2222c173-0ed7-4e95-a602-53483ec0c6cf	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:00:50.038249
aff63438-d4f1-4b4a-8959-6b28e1dfa957	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:08:21.610275
fbd1cf5e-0cae-4330-ad7d-6f692fb67f2c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:12:33.949245
efa4b236-04ab-44fa-97e2-77da50570d3d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:18:47.124321
5f708aea-725b-482e-baa5-e8b7713ff6c0	emails:invoice_reminders	success	Sent 1 invoice reminder email(s)	2026-03-23 10:23:47.148151
313d967c-f339-4c8c-960c-414f40eb9ab7	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:27:48.242731
d0c70d58-7911-414f-9150-96eb4f43ff1e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:35:07.949308
baa240d2-013f-4dd3-b7da-744867bb0648	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:40:07.924644
d2f9bce2-5ecd-4a87-a902-5279f494ff52	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 10:49:10.549913
8304d014-f933-43f3-98dd-1a14365a39b5	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 10:54:10.585364
540dd6c6-85f5-4ed6-ba83-02d7a365482a	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:26:44.242144
8438f8ce-bf02-4c5e-9a39-b56af4393261	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:31:43.221677
07346db8-0c00-4036-b8ed-21e9ffd51fe6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:36:43.249945
36b71c2a-5bc8-4844-a7ba-ed5208f0c6ab	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:36:43.398471
cae5c3eb-53bf-40a1-9aba-6686af0ddc56	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:41:43.496151
513a1758-a7b5-4d5f-a825-e429c944a61f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:46:43.283849
645e5af6-99a6-4d07-812a-e77ddff49d1a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:51:43.279132
f89a06de-c972-43c7-9f31-f3f699768585	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:56:43.274646
b0b50ffa-3916-4515-9e23-0c34f1ddac4d	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:56:43.793041
f1d9cb90-8e93-4831-b91b-8ccd8dc74ffa	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 16:59:52.216056
47aaecb5-ab98-462e-996a-b9984bb9b380	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:01:04.311061
bf26797d-0207-42bc-8013-00e32dce3504	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:06:51.076921
5ebb7d6a-da88-42c6-9c29-65032f052707	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:14:03.803153
0c8199c6-c9a1-4018-80c3-61da5c22cffa	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:19:05.214898
48d776da-044f-4f2e-9958-8c57264f7456	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:25:12.852329
4edb029f-3bbd-4038-8f43-c897da4c7e3b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:30:12.818059
423366d1-a5fa-47b0-8dac-5b77e5a95229	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:37:32.379355
e57e80d8-7197-4ec7-bdfb-83990151094c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:38:18.951638
7939a595-d6ef-4085-b77f-6fab934bed03	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:48:18.893083
f04cffcf-50ca-442a-84a9-b876b47636f6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:52:32.578279
764c605a-173d-4c1c-8087-033e76f974d9	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:57:32.50215
54e4e928-b5ec-4313-bbe1-37ec35fe86a5	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 18:04:41.347381
d920cafd-f3a2-44e9-8855-2264fd257a2d	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 18:09:41.375
82fe1c2f-aaa9-4671-96a9-82a0bdee5b31	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 18:10:13.391901
fc04a51f-05fa-4c72-9f1d-71b43ec1131d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 18:18:11.990432
da7f2d29-1348-4ce9-a072-fc33b5460b01	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 18:23:12.898393
5112dca3-9710-481d-9ff5-1004fdcc8deb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 08:47:54.075228
37e57fe6-03e1-4b42-aab0-8764f7a4fdbd	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 08:57:54.116375
cdf4f3bc-d617-4470-8490-1c4c0e08f005	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:02:54.145763
70c0541f-c909-4524-bd2b-72d7c9a49e7d	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:12:54.192894
cf52f0b7-c33f-4597-b155-faa8c1deeaf1	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:16:03.082856
eb405cef-1ae2-480d-8191-665037ed2139	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:17:54.194315
ca48072c-4e54-4af5-97a0-59f1baea94d6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:21:03.152327
d0cbcf35-b0b0-41bb-a281-1ce6fbb40518	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:22:54.213784
025d22d8-d019-4318-930c-29c3e2a8595e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:26:03.251069
7ba20eba-c7a8-4d6a-8b22-93991f7d8d34	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:27:54.218092
01dc2c8a-7fce-4c33-ac80-27e86a4fb422	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:31:03.310932
1f2e3560-33a2-4514-8a05-49cad118f8b6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:36:03.389997
df08a9d6-1476-42de-9b70-a8da50a21b67	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:36:03.452169
d9e55bc8-6117-4f0d-a4e3-2d4d7f9061b0	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:41:03.48393
5f472b2c-409d-45fe-af59-d576f1298f52	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:41:03.548062
7dfb2cdc-639b-4342-9adf-ebaefead6c32	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 09:46:03.584603
6f4b62c6-5c2c-4d5d-969b-4045093d275a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:47:54.24153
deb71ac5-e89f-4d42-a437-561ab48d1203	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:51:03.685643
8f44e29e-d4c4-4036-8b0f-c6f0e94c82e7	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 09:52:54.271989
5bc5585b-1bf5-4699-ae45-ff7dafd36422	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 09:53:08.289023
4353c7b6-3678-42cd-a024-34e2b002d651	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 09:54:52.142704
6fb74dfb-fe75-4aed-b4e6-6d51d9b3faa5	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 09:56:09.957157
5f2073f9-61e5-4846-9220-04257da8a0d3	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 10:00:50.040562
afdb9a89-ee23-43b4-b3c9-4826c071504c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:08:21.650872
6f0b8471-dea6-4d75-9a5c-d84857aedf67	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 10:12:33.9592
d61e6e6d-7fba-4f01-8b45-275ab8ae24ed	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:18:47.169375
9238abc5-637b-46fc-8940-1c461d92dfb6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:23:58.198195
b85cd569-e0fe-4921-a482-e2b6b676cb38	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:27:48.247615
910f760c-1bdf-4332-a55e-05ae3ce59e7c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 10:35:08.011451
510b44bc-5c92-4659-bca1-8335d6b397d2	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 10:40:07.929821
503d65cb-8c20-48ac-95af-1df7243d16de	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 10:49:10.550331
0df7df1e-88ac-4537-84e6-ddb853371309	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:26:44.244915
89907bfd-2275-46c5-ad2e-a07b0c121e49	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:31:43.223192
2e6d29e1-63af-4136-9bc9-8b98387825d6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:36:43.251613
6d39b0de-4a21-4206-8ea0-79c933069d88	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:36:43.403383
4d4c4377-55b7-4719-b1d9-4c84006b72c3	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:41:43.496367
1a0e41e7-742e-4011-8b60-1868b2335d00	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:46:43.592052
94f047f8-e00f-466c-bc8f-b2481066d9fc	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 16:51:43.282745
9eedb698-3b89-4ad9-9c8c-1fc99d9affee	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 16:56:43.277893
321a8120-fd08-459f-b0ba-ecd086ae94c8	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 16:56:43.796849
ed06e889-9fde-4287-9d3e-321a75a7e456	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 16:59:52.217379
eb77d0dc-4f3d-4cbf-afe5-74eaeba146f6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:06:04.190495
71fb8d1d-a784-4137-b1de-6bb4a9859c8a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:06:51.079464
4c5b66c2-fe45-46f0-b14d-9abe77a8539b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:14:03.813554
bc10f1b9-93a1-4be3-ba76-d5a78d684ac5	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:19:05.220899
002950f5-f157-4721-8c7c-0f4a22567683	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:25:12.853045
3712cf8d-6fbf-4717-aa21-89bf39cc64e5	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 17:35:12.836105
d12e0237-a6b1-4857-9408-eb80ffa74881	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 17:37:32.379934
a09a6c13-44a3-4ee8-b5a7-97390568cddd	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:38:18.961923
7c995b77-547b-4765-8bb1-ecdb50dffc05	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 17:48:18.897157
bf503750-5859-41f3-baff-c8ee35b038b1	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 17:52:32.581763
349be173-8ed9-4778-94a0-e86e921cb32f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 17:57:32.509662
774da344-636c-4354-b47e-0a932b1ea116	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 18:04:41.348441
348d173e-bf1b-46bb-ba17-c821f320561e	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 18:09:41.37484
44d5d0be-30db-486f-83cf-df35774dedff	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 18:10:13.445785
cd20cc1c-c5aa-413e-a61d-43a0a687d667	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 18:18:11.992106
b44b8a56-3fcf-4e70-92e1-e11f7163a981	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 18:23:12.899158
3569694d-75f0-4f7f-b4ce-945733477b6c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 18:23:12.905819
798cc450-4553-4c33-abde-04d473f96f9d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 18:28:13.119539
03f64ef8-71c8-494f-a251-831691296146	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 18:28:13.120151
02446801-73aa-4db1-80f0-2f930299030f	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 18:28:13.124016
d3599671-bbb0-4099-9770-9ffaa44e09e8	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 18:28:13.125748
c2ff9b2c-29e9-41ea-9d80-247d6f174825	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 18:28:13.164491
68d1e628-ee05-4cb3-b166-89b8516923a9	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 18:28:13.171732
453966e4-44b8-4b2d-98cf-cee6b2eeba8c	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 18:30:56.806259
e72929d7-3897-4677-9e18-c9f9989c058c	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 18:30:56.84562
a307bcf3-716e-4567-8c4c-266cba11966b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 18:30:56.847557
e03fc3ac-25ff-4461-aa44-266ec36b3785	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 18:30:56.849327
ce7dbded-fc80-4722-be5d-8604eeee6b6d	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 18:30:56.849961
d6dd6767-c2b3-4051-9be7-15c1556fa094	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 18:30:56.857336
3373a3a6-a32d-4fe0-99e7-5103232a1175	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 18:35:56.800481
79b9cfd2-da6a-454c-a696-eba37c138305	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 18:35:56.804024
dd94d348-23e3-4e0d-aba3-f6bbe6461b2d	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 18:35:56.804624
01857c84-ccd8-4a75-96a4-7cb8d662bc33	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 18:35:56.805119
05c8116a-800f-4cb8-bdc6-a4c9ed4b2b5a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 18:35:56.806869
ded1839e-b3c3-45aa-8b64-0a4f5af70bd9	emails:invoice_reminders	success	Sent 1 invoice reminder email(s)	2026-03-23 18:35:56.836091
9a2d38b4-128f-4c93-8eae-048a5f8912c0	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-23 18:40:56.830111
bc3c5753-98e2-49ee-9240-f702ad9b1b67	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-23 18:40:56.832304
312d47b2-0dff-4afb-aa00-def3ad6f3a7a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-23 18:40:56.832855
478dc23a-1684-4c67-8ed8-0cc24e591c73	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-23 18:40:56.833702
b20de355-9f20-4b2d-b615-d5a2fbefc791	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-23 18:40:56.834471
57324109-24db-4eec-8746-7e77a1e53121	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-23 18:40:56.840375
214df738-613a-469d-9086-3bb9afb91800	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 05:28:44.112382
9a76ef8f-d901-4336-962f-aeb6cac5ae6b	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 05:28:44.107961
da3dab9f-762c-4b6e-b73c-17d08901c2b6	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 05:28:44.171489
670b7161-adc3-46ad-992a-bbf301973b52	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 05:28:44.171463
b7336e7b-208d-49ac-b693-16129f1a558f	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 05:28:44.175581
ff78eba3-b626-4788-a264-f50b62385995	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 05:28:44.176719
fd7a4b5a-e670-4dd7-98e4-ddb7be7177c5	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 05:28:44.196741
45d4a8ab-ea37-45f8-8e82-63bbef5c8d41	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 05:28:44.196758
46eb1733-c884-469f-92f1-833961e1bafd	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 05:28:44.197411
afc3ae84-8957-49ba-9af6-675213785b52	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 05:28:44.198572
6b5eb326-63b2-4d2f-af68-24f91d724ca9	emails:invoice_reminders	success	Sent 1 invoice reminder email(s)	2026-03-24 05:28:44.223299
6cb10aa1-dda2-4c09-99cb-d8e61fde59f2	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 05:28:44.226359
29d09411-e9ca-4276-98c4-49f842e98442	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 05:33:43.443355
c0418bce-5bfa-4933-82a7-5c15498426df	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 05:33:43.443543
6ddfa2a5-92b6-4c59-8dd2-7fedf8201a32	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 05:33:43.448322
8b71c2d3-30c3-4a0c-b0f5-d1fca6ff2ff4	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 05:33:43.448916
493746c2-9064-42ac-947e-696e7f2174ae	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 05:33:43.449647
f390c790-c1ee-4ae2-a95f-efb944fde8d2	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 05:33:43.455235
7667d602-0bf3-4887-b2ed-f52bc0acb6ff	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 05:33:43.548329
ad486102-ba18-48a0-9a9d-e8fcfcc69116	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 05:33:43.548514
c7d435e5-7791-4e09-a9d7-8d97ee616067	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 05:33:43.549625
0c398dbf-b181-48eb-b64a-59c2641a2855	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 05:33:43.551527
06640665-89f6-4c71-8ee8-ac1a0700360c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 05:33:43.552061
be64186e-bf73-4f0e-a49e-73d2fde29fe2	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 05:33:43.559717
67c8b41a-3cde-4b55-91db-853e54763cd6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 05:37:33.368092
9e7c113d-2fa7-4503-9cc5-7605753a7616	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 05:37:33.368832
34d78811-6ce3-464f-a329-7b40bb4ddcf1	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 05:37:33.40624
ba2392dc-34f1-47b9-9dac-ac4bab758192	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 05:37:33.406939
e23e8b69-4633-4461-9d27-f17443d07d55	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 05:37:33.407293
6659712b-f46c-441e-a286-68fde7e6b2bc	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 05:37:33.415071
dcc14a79-b759-46d6-ade7-da38aadfb319	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 05:38:43.646692
6c1b248e-0ae1-44d1-b11c-e0c53ca4afa2	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 05:38:43.647701
97e08ef0-ee13-4f8a-a7f4-bba6763f6a36	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 05:38:43.651745
79b78780-1192-4c99-9e27-517d540cd4f0	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 05:38:43.653434
32ab98f4-ca18-4dcd-b3d8-38e1f898d906	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 05:38:43.655038
299d2b2b-5a70-4cd4-8371-a9813f2017af	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 05:38:43.659063
552b970d-869a-403b-80bd-7594360b039f	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 05:42:33.332114
3e296594-fc68-4865-8178-3c5a152c4023	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 05:42:33.340599
67a2f6f0-15d0-4204-b34a-a58c6f76f515	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 05:42:33.340796
ee7a36de-b2b1-47f4-86b9-79ce61a8eee2	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 05:42:33.343691
32a46f2d-1474-40f7-a6db-fe9d04eddcec	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 05:42:33.344947
b3552532-03fc-4ac8-b05f-1ad5eca94f77	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 05:42:33.350208
89f915f2-b7ad-4997-a2d4-646652baa04d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 05:43:43.745487
95859999-0146-4ff0-a744-5ad83ebda8ff	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 05:43:43.745537
43e27eb9-22c5-48eb-b353-f64465b50539	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 05:43:43.74777
598b34eb-ace6-4c08-ad54-80a12f368673	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 05:43:43.748761
07052f77-4e1a-4806-b9c5-58fd6c615633	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 05:43:43.749241
f18733f9-9363-4407-a582-1bc05e242a63	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 05:43:43.757076
c004105c-fab3-41a5-a58e-f4f8d98a109e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 05:47:33.329932
812b214d-e6c2-426c-82e9-32500199c411	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 05:47:33.330193
3b2b743a-9470-401c-9b79-9a681a481551	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 05:47:33.334337
2ef371e9-68a7-4546-9c28-7aac3f804d4f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 05:47:33.334991
0b6b1473-abc6-4095-83a1-285b891f6d8d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 05:47:33.339896
9aee294e-1d85-4cbe-a87b-0558ce550185	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 05:47:33.341518
23f898e6-7108-4820-97f1-3bca248144ae	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 05:48:43.846694
24fabefb-bd4c-4df1-ad15-0aedf3d2c21c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 05:48:43.847257
28060897-ae76-4c95-80a6-33d7fc771593	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 05:48:43.847007
794e3b59-65cc-45ee-9587-39a856b21662	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 05:48:43.84844
d4b7ad66-857b-49fd-8a4f-a98ff8290bd3	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 05:48:43.849747
d7e25efb-447a-47b0-814c-c6ad7680860c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 05:48:43.857331
be65f476-6047-4630-b254-fd61b29506ed	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 05:51:43.951235
d8b803c7-fc9b-49c9-9474-1561c0acb358	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 05:51:43.952682
082478ed-9a9d-43e9-94dc-fdf8e32e01f8	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 05:51:43.955881
18c8fdf6-6a80-453d-96f7-7362adf08a69	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 05:51:43.959191
a3c3cf58-e52f-49b1-a04f-113969086dfb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 05:51:43.961166
c236020e-ec33-4a58-9917-5531646551e1	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 05:51:43.966122
3dfba3ff-6ca0-4412-8333-ddae9b48698d	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 05:53:43.942497
e0d655d5-47b2-48e8-b0c8-8dd000179d30	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 05:53:43.944708
fb93a80e-992d-4eca-8d9e-53918c28f29d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 05:53:43.944956
351606b1-ae0f-400b-baf4-6ed57d374687	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 05:53:43.948292
0834265a-75cc-4362-bada-c40c860f111a	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 05:53:43.948588
bdea7a34-160a-4411-8cc3-850989c63841	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 05:53:43.95451
c32b2c46-a558-4f3f-bbd5-e04c498531f2	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 05:55:10.977867
fea6a800-8ed6-4a39-a374-647cab0794f1	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 05:55:10.978859
c17d28be-5996-4f89-a274-fe0b29e1a2f0	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 05:55:10.978425
fe1e572c-8301-4468-adff-2de67f8e1cb5	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 05:55:10.979523
a9357215-8dfd-49ed-8199-b21630ea7c3b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 05:55:10.982112
394a0422-dae8-42da-8159-94a8caab2954	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 05:55:10.987081
32e964e0-0738-418b-9ad9-04f22ad018ba	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 05:58:44.040236
2c7c7f10-bd92-4780-8716-e14f27d2514d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 05:58:44.042533
da388255-bce3-4d5c-8160-04442aee0fbf	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 05:58:44.043491
5948b374-9699-43c5-9fd4-9ab5bc23073e	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 05:58:44.044241
06e8e0f8-d236-49fc-b60f-736f90c010ec	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 05:58:44.044629
3a65b329-1d81-4a27-8816-33c876ac57c9	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 05:58:44.051588
90df7510-58ef-4a58-abff-7557386dda8f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:00:10.921624
b77a664a-4a2e-4176-a754-cc1b55645936	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:00:10.92376
01e2db1f-b0e1-4ce5-84e2-15120e41f622	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:00:10.924617
10f07a14-9aca-4382-920f-d210abce4c21	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:00:10.928852
dc56b64b-68b5-4c28-bbb8-29ae047ef566	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:00:10.931422
87eedd70-e83d-483f-9903-bcd668011422	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:00:10.941002
5dc27f39-b21b-428b-b648-f8acbb418c42	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:00:27.3358
58535e1e-9265-4c46-af63-18f716c0f747	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:00:27.336571
a62f4c64-8970-4023-8653-a036de1246da	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:00:27.340986
bb898ed0-4222-4e59-87be-6abb116e3e8e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:00:27.34507
201c9fd2-f9e4-499a-b3b3-c19fee6b5546	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:00:27.348542
76893ba8-725d-43f2-973a-a72dab69d981	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:00:27.35507
64b32792-8c3e-439e-bca5-ea79b9477b48	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:03:44.141612
4815dfbe-1fb2-49aa-80cf-d2357cf01e4a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:03:44.142763
ec18202c-5563-4f00-956b-5030273a0a32	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:03:44.144015
088101c2-8b11-40e0-9ccc-a8b4c71f46b1	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:03:44.145326
680131b1-46d0-47d2-a05a-6703f5c6bac5	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:03:44.145595
35dbda4d-0e79-456c-bdaf-2752e5d34798	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:03:44.152022
a9294e8e-cbf4-41ef-bc64-42d1869986a4	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:05:27.274812
f69592ea-8ed1-41d0-a955-78c920ed8a2e	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:05:27.276226
2a2bc1ac-63cc-4b4a-9cc4-5d807e6109fd	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:05:27.277493
87520762-d7d7-4406-9d07-28a0c2ab98f3	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:05:27.278336
e81e272a-d314-430b-b440-534699586b20	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:05:27.279708
80f4eac4-1272-42a0-bcb7-cfce962d466a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:05:27.285395
7e474a2e-270b-4e97-b473-aa73ebdae187	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:08:44.233536
32260731-2e7c-487e-8a6a-2a4a4edca3a9	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:08:44.233804
5b1c6118-c570-4e4f-a65e-24d2ce7ec8e0	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:08:44.233603
9b973925-c8d5-44e0-a41c-0db05f731206	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:08:44.234068
9832c238-7002-45a7-ac6b-0d29fb469501	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:08:44.235981
8d642258-9ac3-4b2b-b960-ec06b7485a6b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:08:44.240499
55344e28-af31-4319-aaf4-0ba422e05ab4	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:10:27.261406
178062c4-ea2a-414d-bb7d-4ff8c8e9364f	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:10:27.272986
70b17ebc-0aaa-4452-80e0-edb76f890e92	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:10:27.273163
ec6d6aee-4136-4268-a38b-d0ce8e290f67	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:10:27.273419
c9b9b123-3301-4b87-8623-ccb85fc1a39a	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:10:27.273673
21da7759-5943-4ad9-9f0d-fe7ea58cd02d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:10:27.280309
cf0b73f9-eca5-4876-8b0e-1ebb9f2e65d1	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:10:53.9213
609c9e25-9666-4905-9acb-59e20b4eb900	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:10:53.921927
b300d3b9-09d4-4b18-aef4-4b1151a8e967	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:10:53.92317
0c4af03c-9113-4e24-942e-3179756450d1	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:10:53.925134
a866c3b4-24dc-47f9-b469-ca53c7eddc6b	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:10:53.926932
0ee286b3-b711-4415-ac12-d35b7ed549d7	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:10:53.933624
5aafcd10-42f4-45fd-8458-c3f695386960	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:13:44.340788
f1136173-5f81-42a2-83f1-e4e6eeb63c01	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:13:44.343891
2b1b52b4-8e18-4254-8087-6f8be95b1e3a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:13:44.344151
67f0cabb-a4b8-4794-b44e-d8122701669a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:13:44.345234
3cb28f65-a766-40e2-801d-8f77982f1d99	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:13:44.346226
c687b7c9-a6a1-46af-8025-b92413d94fb5	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:13:44.351104
44787d78-d33c-46e7-9baa-55ffdabe8709	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:15:03.70564
b1cfa62d-7875-479b-923a-a5675995ef92	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:15:03.708746
f6f88e47-34d4-4d7a-b091-5af578d40366	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:15:03.709243
1056547e-fcfe-4010-aec7-531d8c65213b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:15:03.747028
6a7ec1c8-1e10-47ed-902d-603236c698b0	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:15:03.750745
e247b690-79b8-4734-9e0c-6b467da092f1	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:15:03.758034
281ffc4b-0174-4bf7-b4be-e101ad67b264	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:18:44.432317
36fd2883-8b91-486f-95ea-2a0025525c8c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:18:44.433269
09baba0a-ac50-49e7-aca7-bc1ce146b5e4	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:18:44.434496
7df1d902-c699-4f33-acce-a11a6afb9dd7	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:18:44.434729
4875bd3a-ae66-441b-b001-21ea7953dbd9	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:18:44.43668
baf4980c-1f91-4450-82b2-1baef54dec6e	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:18:44.439703
0fcda1a7-455c-4413-9e05-ed025d531b13	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:20:03.675281
5d173b3e-4aa1-48c3-ab05-0fe01208211f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:20:03.678372
7f6a1e92-f845-4b24-a799-283908caf48d	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:20:03.679292
54f8cab1-0de6-4457-b0c1-9c8dc5454452	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:20:03.680794
9db3bdc2-e49c-482c-af96-4b101657f4a2	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:20:03.681496
e65c5291-5e41-4692-b417-9ff02804c392	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:20:03.686459
39fa30b9-1daf-4ae5-a552-8bd4bf30b772	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:22:31.946868
dc1a14e5-be59-40f3-a63e-43196a2e0fb2	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:22:31.950073
b38736ad-92d8-4c14-bf2b-a46a24dc5bbc	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:22:31.993346
ecc67f2a-3f1f-40ae-9d7d-e19e5555851d	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:22:31.993582
ff7ad933-6e38-464a-99df-4a583acb040f	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:22:31.995308
27da2597-8103-4ac3-b4b0-c27c305c1538	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:22:32.002848
73d30958-4fc2-47a2-ba35-963ebb7d2ffb	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:23:44.535295
ebf4b0ba-8dfd-438a-80c0-0cfece1163f2	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:23:44.536509
4c040ba2-b723-47d2-9e8a-61f79068cc2e	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:23:44.537706
a4cbd4e9-c3de-4411-9325-2f5f6da00c45	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:23:44.538692
326e53d3-d277-4180-bcfa-ec9a6f854b92	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:23:44.538889
fa7420a5-a3b3-4bf6-b5d5-eed65654752d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:23:44.543745
35ce0221-ed45-451c-a42c-da38f19dcb94	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:24:00.656536
c2e8ea1c-6143-4ea0-a8ca-fdbd660dc60e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:24:00.660458
028d62f6-8297-4338-b9ed-2275eab9af6d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:24:00.661066
be46f064-aa69-4ead-81ac-45eb4e0b5210	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:24:00.712061
810f07b7-8ead-4911-bdf7-d4705c1187ac	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:24:00.714735
d78fb6d8-39eb-4ac9-9bf4-d38576324a3e	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:24:00.720251
7bcfb08d-dbbe-489a-8cde-59fd0a858f02	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:27:27.736987
b9b99985-2501-486f-abb2-28f6de3eaa5f	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:27:27.741093
437c3ef4-39da-4002-9955-2be1976fc6b5	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:27:27.741441
05f8a702-e91d-448f-bff6-dc49978824d1	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:27:27.742361
55367c9e-584f-4991-94e3-eed5877fd866	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:27:27.744135
752dbfa2-167e-466e-a89d-e532631c2476	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:27:27.753858
9eae8882-e443-4d38-a0e0-de02a6d5fa72	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:28:44.52203
90464d09-e662-4f66-8d3a-3568a037400c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:28:44.534129
dd0bca92-6d53-4792-8020-5b4b8e41d429	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:28:44.534355
e6fcce27-ea8f-4c3a-92f4-9cf9a0e25ef7	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:28:44.534608
b88fb159-f6ea-4cef-90aa-7163cd7ef734	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:28:44.535513
301d7d01-abb7-4360-91f4-a2ea3eb7df29	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:28:44.540808
81cd7d50-f796-4522-9103-c1c8abf1a672	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:32:27.69815
3caf3a02-c859-454d-95ef-a59569fddfbf	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:32:27.707033
73e8fb27-8d81-4950-8030-9008aa894b8d	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:32:27.707749
721fe54f-0759-4615-9f83-36a2cc8f4143	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:32:27.707885
6125aeba-c904-4fe3-9e11-b52c8fa6d761	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:32:27.709184
89d1f4f0-35f0-440b-8d45-154fad8597d6	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:32:27.711802
597d2d78-d387-4a2f-8a1f-0689f9d16425	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:33:44.632295
4dea5056-4c42-45f8-b4d2-2f63e66d9b10	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:33:44.63426
99ecf93c-36c2-4b83-b409-1ce1e5fd0796	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:33:44.639016
69822cbd-0cfd-4463-be38-e2bdc69d0dc8	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:33:44.638977
de3bc5ba-071c-47d6-9ba1-9690a77ed3ad	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:33:44.639889
eaef39fd-46c4-4f9e-b1e1-0fc4cfc113fd	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:33:44.645498
74398476-29f2-464b-aae0-cd3f074bad19	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:37:27.722138
36cf238e-023f-41ee-9501-cded4496e6d0	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:37:27.722297
0eab7319-81dc-47af-8dec-bc28dd8ebdc4	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:37:27.724651
e6e04de8-ebbf-4bcd-8cde-73ca4b9907dd	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:37:27.724943
a11ddb58-d975-4b8e-89cd-1f1c39269064	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:37:27.726515
fca126c8-79b3-4395-b185-b1f2a30b35cd	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:37:27.731379
cd570be9-a639-4cc3-8cdb-51258a3928ed	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 06:38:44.732302
2f125857-678c-4018-9e60-3ab3cb83ae17	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 06:38:44.733519
99df4f32-0fcc-467b-afbc-a6125a46cecc	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 06:38:44.734099
199d5928-db3c-4d66-9065-a8ef0b94d68e	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 06:38:44.735368
fa2187c4-28bb-42bd-8787-15e8689a00bb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 06:38:44.735842
655a439f-c3b0-46f9-85c5-2509762a1dd9	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 06:38:44.740642
0c50ed1d-8a1f-4d2d-a032-d41248b5c691	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 08:25:22.169739
e3056367-09fb-4ec2-a515-7b392b380c1e	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 08:25:22.184004
c5facfac-ecb2-4f7b-a737-dbf16caeca0a	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 08:25:22.233541
aac02cbe-d6b6-40bc-a58c-6a57176f67c9	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 08:25:22.237803
a813a7f9-f032-4fb6-95dd-7b8ef567adcd	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 08:25:22.241288
6c8493fb-74e9-40e5-95ab-69c5544ffcf6	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 08:25:22.242116
d15198f7-6420-416b-8648-9745b65aeabe	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 08:25:22.242534
05225def-2086-44c4-9a3d-dd38d9431ada	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 08:25:22.24602
58896848-20d8-448d-8d6f-cca4fd18d967	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 08:25:22.267396
2c404be5-2765-4f7e-bb1b-fa5a0a480158	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 08:25:22.26914
1c36b009-0ca0-4bf1-81eb-4f3d9487b49d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 08:25:22.281258
893fadcd-9a97-4722-a9e8-e7bc19b815dc	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 08:25:22.286203
6dd8ac7c-b72e-402c-83cd-165d63228e87	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 08:30:21.272116
0d05114f-8316-4360-bbdb-0bc11a79b7a9	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 08:30:21.273739
617432e9-f85b-4327-a09d-645b8c95488e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 08:30:21.274083
5a5fbf55-eda7-4903-bdaa-b95dd4f2b3d1	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 08:30:21.275534
9986c4f3-e94a-4054-8701-469be8c8f5dd	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 08:30:21.275938
50771541-55aa-441e-b61b-e1b2d9e19e82	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 08:30:21.28394
842f552d-82a6-41c4-87b3-1273d7434d47	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 08:30:21.330489
275c149a-e38d-4f27-a498-7193666defe1	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 08:30:21.331107
981668ad-169c-4076-b2a1-b3e9e9112c56	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 08:30:21.332524
85eee457-37e4-4885-a328-c3372fd7e72f	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 08:30:21.335629
625195d6-9acd-454e-b62b-1f6c8c072388	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 08:30:21.335991
3f414cff-8e64-472b-a969-f05b257578f6	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 08:30:21.342954
1b7bf850-1aa6-4ef6-9441-034cefc744da	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 08:35:21.295467
93809afb-686f-43ee-a0e1-d03e653a8857	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 08:35:21.297853
309e6e79-7f3b-4c2f-93c9-ccf17f752ffb	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 08:35:21.299269
38934487-6460-43f4-8bc2-2938055e5111	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 08:35:21.299615
40a69e87-4147-4f4f-bc67-cafdeec54a70	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 08:35:21.301757
3e7711b5-dca4-448e-a8cd-fac8280d3fe4	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 08:35:21.307241
1aebc9b2-1da1-44c3-aaec-777948b7fd8d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 08:35:21.418954
ea2d9af7-08c0-43ba-a6cb-a7b4d8d655fe	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 08:35:21.421867
13b45f7f-b21f-40c0-95a9-12b619fe33a1	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 08:35:21.422369
e61e78d2-8093-43eb-801a-6f1ac817ef4e	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 08:35:21.423389
88b5ab54-11ea-4487-89fa-b76d0c8a52d5	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 08:35:21.426156
103625de-227d-49ed-9799-80991da5bcb0	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 08:35:21.431178
24b75dc0-f4e5-408b-9f52-a43d85830c38	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:27:56.217431
f08997b5-323a-4f5e-bd3e-e504a43a634b	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:27:56.222788
4abbeb20-a705-42fa-bf30-f7fa1551d2fa	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:27:56.294064
a87aa9e2-475f-448e-838e-bdfd953e8633	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:27:56.298025
d0f26ef8-104a-47d8-8341-189b3ae434ff	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:27:56.304238
9b0dda7b-7f9f-4e94-9bf6-ef94f68021f7	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:27:56.304595
f4185e1b-69c0-425b-aab5-da6d1588a01b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:27:56.305125
cdea6545-2447-42bd-9c8d-d34e21daecac	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:27:56.309027
97e07429-d29e-4185-a1a1-b5ed16713ff5	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:27:56.315733
6bc629a9-875f-481a-a443-dd02e27d6c7e	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:27:56.316193
d96cef52-90ca-4dc6-8656-ef9782e0e797	emails:invoice_reminders	success	Sent 1 invoice reminder email(s)	2026-03-24 10:27:56.332375
29026f57-ce9c-41c1-8e6e-cbe88b7a14f7	emails:invoice_reminders	success	Sent 2 invoice reminder email(s)	2026-03-24 10:27:56.333963
4167dbdc-403c-425d-9abd-1f725256c5f6	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:30:58.492809
7cdfd17e-cd40-4566-bdba-d06566027134	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:30:58.494918
22178759-48a4-4bd7-adec-d4c0a0219c40	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:30:58.495637
61d3def1-8b20-43f8-a195-d6fc2a5b3d62	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:30:58.496028
aa3a1399-3397-4ecc-aa80-c564788bac81	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:30:58.499744
dc48042d-ce8a-4560-aa66-2257e50e796b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 10:30:58.507315
17d8796a-05b7-4ed8-a7bd-260ed2c39536	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:32:55.250596
722cb370-ab66-41e4-816d-a21ea2d47caf	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:32:55.253957
46ef4046-f036-407b-afea-0ad9374e088e	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:32:55.256894
955f1e49-509f-4f0b-ae34-fd3688fbab49	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:32:55.257589
09b485b3-c2da-4e75-b09c-1b980021107c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:32:55.25925
315d2e86-277e-46fe-827d-fc3d30815c7f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 10:32:55.269703
f421e405-518a-4ec3-b042-632f38987e9a	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:35:38.512395
b3880ec2-1ef5-4879-aba7-630b38010a60	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:35:38.515371
bead72d1-6b71-457d-ba8d-47904df6aed6	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:35:38.51715
dcc1e942-183b-4866-910d-7f622de5adda	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:35:38.521513
41498bdd-5d7d-454c-b5a9-fe44112cee67	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:35:38.52244
f09ecefe-e530-4cdb-bb7e-f3f6ff19e85d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 10:35:38.534552
7da200c4-d848-44da-a9a5-54a6db77ae5f	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:37:55.347291
9f6148e7-2250-41d8-8154-18e84844112c	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:37:55.348166
7a66dff7-3230-43cd-9460-b124846c389d	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:37:55.349723
b559c47b-a67e-47c2-8d8e-da65f75f339f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:37:55.350334
b858ea0c-1a6d-49fa-9be5-55518ccd172f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:37:55.350786
6c8fcf29-e42d-4668-ac3a-bdd28d1b4673	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 10:37:55.359415
0acbb043-103a-4a1f-8678-9447a162dc81	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:40:38.463171
46d6cfb1-32b3-46ef-bc31-3ac9f1aef8b4	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:40:38.467699
f51af4ac-3f69-4be6-8a0d-4f4f1c049ebf	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:40:38.467866
abd9a0eb-9416-4c37-b802-ed57e609e76c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:40:38.471212
7b714773-21e4-49ac-9ac6-769693ccfee7	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:40:38.474211
aaf11a06-b38a-43be-a761-5581f0ca129c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 10:40:38.485158
0e6a7212-5c71-451b-b6c5-437f7019f689	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:42:55.445745
03f5b4c7-d6e6-4b8b-a4aa-07fd46e7ffd3	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:42:55.451852
a3833fbd-24ad-461f-ac15-d524d85f7970	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:42:55.452183
e6cfc463-b670-4f6c-b6c5-22e9d8e00494	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:42:55.452526
3a607272-f6c1-48a6-a726-a32e0dc5fd96	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:42:55.455505
d051112d-dfd4-4e23-b134-7f3d36116d6f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 10:42:55.461583
c3de4ef2-2cbc-4f5f-8687-4defa2bbfa5b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:45:38.515053
5d2e3e3c-695c-4d8b-a1e3-8c799274c712	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:45:38.517549
16324d87-adfb-483e-964b-577866ef9d39	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:45:38.518076
481b7572-840b-4a6c-ad43-c7370cd2770b	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:45:38.518505
5dc78cf7-b840-42df-9970-3b3267258163	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:45:38.524257
e16f64f8-0242-4af0-bf6f-06d6684c0f21	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 10:45:38.530655
6e6cc884-e6ef-4d95-aafc-920902b4bfe1	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:46:20.611179
19853b6c-347a-486b-b6c8-e9a795a26881	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:46:20.614712
dd4ce4f9-2720-44fa-93a0-6680eebfddfb	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:46:20.615333
de2195a2-4fe1-4f54-a957-11f6ac75105c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:46:20.618792
69c6ca4b-3881-449e-b4cb-eb467c9e6558	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:46:20.61951
5f29e8a6-72aa-4bf7-9a0d-b91041ccc52b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 10:46:20.626836
625db337-1141-4caa-a053-7a41ffc82358	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:47:55.550255
bedd7b3c-de33-4adb-98db-3a4132a4d74d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:47:55.554776
93cc7736-61ab-41ee-b672-95a9424a227a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:47:55.557534
0614ef7f-fb42-4e7b-8345-cf0cc4fb4844	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:47:55.557973
0f896191-6e3c-48a9-8ed8-b3ce00a81bf3	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:47:55.56023
afd22d2d-5da3-4a05-a9ae-c21e6f81e64d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 10:47:55.564242
5e91cdb0-59c7-46e9-8ebc-3d031cd7ad5b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:50:22.022164
542f1fd4-0a16-43cf-9491-9ce25bf8787a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:50:22.025183
4efba2ef-1d2f-4382-b030-127c9ffe6953	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:50:22.027744
c78a56fe-d21a-402c-b2df-f9c6331f5e6b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:50:22.029177
96646620-a18d-42d1-a739-b981bf6b01e6	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:50:22.031684
65963bc3-b547-4544-a8d8-2310b0cd73f0	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 10:50:22.037858
9eee5729-889c-4fff-a658-06edaaf91834	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:52:55.642919
143ea3c3-ddad-45e9-a75b-0a60adecc208	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:52:55.644473
635751ca-4434-48e1-85fb-8511ae3296c8	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:52:55.645772
f888d358-39d9-4a53-997e-43d0180f34f5	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:52:55.649345
f4bd30f9-89ed-495d-af26-f8a8457e449a	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:52:55.650232
a3c2e59f-0da9-46f5-a657-392a734c8242	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 10:52:55.656191
7874a4fb-3d4b-4170-9859-e47fcf0aaf71	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:55:21.956911
5445d627-f287-4901-b484-97cca3ec78c9	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:55:21.95792
8eb6040f-e622-43d9-9ecc-38d14fc6a613	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:55:21.958695
720133fb-15c4-4702-9e9a-ca5afb9bfda7	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:55:21.959036
3e7e7021-a24c-4b4a-917d-a68f5bf897bb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:55:21.962898
569f7b9d-8d17-41f8-b6df-dbeae1aea7cc	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 10:55:21.965377
005622b5-0965-4673-9a1f-ad4ccb1889ef	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 10:57:55.745355
022c1662-8e33-4c86-ba64-e175f2a5d8fe	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 10:57:55.746532
945995d8-3b46-40be-a759-821b88292f5c	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 10:57:55.74745
42185468-b6b3-4d1e-b9a9-a7fd3b1369b9	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 10:57:55.74852
7a78da3e-3c09-481e-90a4-4f35418ce82c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 10:57:55.750794
a66ed541-347a-44ab-9fbb-e293f53aca46	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 10:57:55.754678
4d4c4443-4f6b-46a0-8b79-e1d955b70b6b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:00:21.946409
061c4779-88ce-49cd-be8b-f5e09683cc1f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:00:21.9499
153c3b4c-6622-4100-8c2d-92b74617c5fb	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:00:21.955666
5c30a868-ed9a-487d-936e-c03ce2dcbfd3	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:00:21.9579
414c7827-63b3-4329-b2c3-8409bdcc37ce	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:00:21.960625
df685750-8b82-49be-a66f-1bcf2be40378	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:00:21.96626
e897df0c-3f6e-46fc-bdae-88ef5247ec62	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:02:16.102082
cf30360c-22ab-47eb-aea2-7b6c8f20d793	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:02:16.148044
4ea9d170-0d1f-4e98-92e2-5179117ca722	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:02:16.148496
75ed5f64-d045-4ba9-8cbd-3ed39c8a7c38	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:02:16.150003
68e5a8df-4216-45af-b9c4-57fb22be180f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:02:16.154189
82be88ca-82e0-4ab7-a5ef-c59b0cd5b7b8	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:02:16.160321
1b5a6152-6dbf-48f5-aa12-7388be5ad941	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:02:55.848369
a3a1acfb-8d5f-475b-8abd-1960c5d85267	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:02:55.849071
b82a292e-21f3-49b4-b068-967e20da6b0b	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:02:55.848404
a8c9a18b-8fa8-4ec9-8c32-8b36d11b6f76	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:02:55.851177
18da597f-45af-4a0a-ab6f-af59e29498a1	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:02:55.853163
9c0a25e2-7f5a-422a-9a1e-1e66a8700890	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:02:55.85683
c91abb45-455f-4df7-9c31-56852b9f5bc1	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:07:16.062172
1d413833-7e0e-42bc-bf1b-b6a09bcc905c	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:07:16.074064
690f54b4-7144-4754-9d94-283ff234e949	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:07:16.075676
b43b357c-e3f5-4a63-8b1a-012d1a5e6bcb	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:07:16.076052
2402c443-41a4-44a5-a8e4-b42f69c222b6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:07:16.077859
2b6744de-10ed-43cb-a74e-61b996ff2ebf	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:07:16.082974
821da99c-0585-4115-828d-9b2a00789d68	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:07:55.949136
4b4c5659-9f50-457b-835e-1d823ef64860	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:07:55.948922
21ef8eaf-0a23-4257-b18d-f80188f3fa67	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:07:55.950891
8e4f222f-cdfd-4a9e-9539-a898a3e1cf0b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:07:55.952677
9e4e6de7-c459-4221-85c5-43864b0d096f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:07:55.952823
c57c62db-a4b2-4cfc-9ba8-0f18272a1459	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:07:55.957319
ccb26037-8c1d-4d27-ad8f-ebf665b2f9fe	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:12:16.105052
4fcdd9d6-9062-47bc-b5cf-c4989356ccdc	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:12:16.11001
6a87e437-e4bb-4db0-927f-2bb0cbc8cdef	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:12:16.122546
c1fedf7b-a366-4d10-a93a-00898f69b9ed	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:12:16.128677
b9e72b82-ae56-40f2-9cb9-ac5803f570b5	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:12:16.128971
93bb5c7a-796e-45c1-8232-f77f13a4ed39	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:12:16.132711
bbe9a12e-985c-4854-89bc-6974c5f6e16c	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:12:56.051501
9841ada8-3bf7-4bea-8389-45ca8f959f20	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:12:56.060589
885f0a85-c1d9-454e-a9c2-3f9ee84cc563	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:12:56.063867
3147c294-b3aa-4fbc-9682-6eee5ddfc832	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:12:56.070285
5a8345f4-8b3c-4ed0-b1af-8ed15dd99c14	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:12:56.070585
b69a11fe-3088-48b9-b749-b962bea6154d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:12:56.085888
cca494e4-5ba7-4822-96d0-a87bf2e9749e	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:13:14.718997
fd3b72d5-cbe5-4e72-81ca-a796f9951298	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:13:14.726602
f2af803a-9b9d-4dc8-9183-3c3859d616b0	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:13:14.775659
0404aebe-1526-44df-9303-89eec08d8471	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:13:14.776783
bdc09bdf-375a-4314-8704-bb93d8341c3f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:13:14.785301
7ceb336d-8648-4982-9c32-6de09c536156	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:13:14.801007
7704e88d-5936-4756-aa0b-127c7c1f712c	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:17:56.142335
9de12797-bd81-424e-87d7-f9b4eb09077a	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:17:56.147129
a0983457-7886-4094-ba12-9f824246c7f3	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:17:56.147869
083ed69b-135d-47d9-a753-e210f0fd3bd9	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:17:56.147617
62abf340-8f3b-4f2b-b1ba-6d28be393a7b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:17:56.150998
5234538a-e945-4c00-93ec-985054ea3473	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:17:56.156482
95194597-6e2c-493e-bd81-70e3e5945e79	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:18:14.661765
deaffbf2-637f-413b-80c7-d5509eeccd78	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:18:14.663359
3bcd0a90-1e2b-469f-9b91-3bdddbd125df	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:18:14.664824
8178ab84-c1f2-44d3-9c61-1cf279e951e8	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:18:14.665157
45cf537c-36cd-4b67-9a19-6207e5423233	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:18:14.665486
f3af0a26-23c6-404f-8a38-24f82ea1dcbb	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:18:14.671983
2d351f91-7e8e-4475-9ed8-7e6daaa1c773	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:22:56.245359
56380925-ccb7-4269-ade5-d6172a52c485	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:22:56.24606
520578af-b970-4f7f-b793-9c8ad7858818	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:22:56.246812
166cc873-f618-4eee-b3ed-1c4b78cd281b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:22:56.247025
550f8828-c971-499b-924f-0967f3255076	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:22:56.249088
7c476390-2e18-4ccb-bad5-839ec8a3fc6a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:22:56.253831
93e67d9f-006a-4a3b-baa8-6f6505dd8d6d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:23:14.659873
ba84b05e-0d41-4b2d-bc9b-84e8ebddcc29	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:23:14.662599
c6392078-036f-41db-843a-ab017bd48f8b	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:23:14.663126
e49f9c00-4643-4e6d-a9d2-8fc9d41034b4	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:23:14.66431
44d65ca4-e159-49c5-aac0-17a58d6e284f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:23:14.665255
6f5ebed4-d760-43f6-8636-cceed6f83211	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:23:14.672036
cb65039e-c38f-4eef-a1ab-40de57d3164e	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:27:56.233429
9b951e15-9736-4ec4-b8a4-08c9d4606785	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:27:56.244295
15872dea-90a3-46e1-bec2-f1ff725360b0	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:27:56.250737
7eb6af75-edb0-41ba-a1ba-9890ac875245	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:27:56.251155
b29ace2c-422c-46ef-ba4f-0c4b3308aa83	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:27:56.251434
96976691-bb1a-4d5b-b7e0-3e008c6edd56	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:27:56.25853
1c5c098a-6ed4-4abf-b579-36de49a25d2a	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:28:14.688532
f92f2f23-07e7-4da9-b4c2-12eaf23e69fb	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:28:14.693085
2a1abc59-810a-41bf-9704-2a90001a9151	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:28:14.693276
27a5a8ba-d34a-4e7b-8abb-85be4fa14e25	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:28:14.695444
dd8f37aa-96f1-4e7e-ad39-cfc7e2c5fac2	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:28:14.698137
4fd2b350-9724-418f-99b3-73d57debfa8a	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:28:14.700494
44c7f5c5-3fda-480c-b3b7-e8e3f1d8a91d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:32:56.343141
ba2536d5-94b6-4a36-8ebe-fa956bcc860d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:32:56.345885
acb65d13-5060-4787-8715-c250cea6c3ec	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:32:56.34782
47722adf-6d78-4528-ab64-85490759c1df	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:32:56.348157
38fb4e64-99d4-47b8-b53a-ad736694d122	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:32:56.350203
6e3f9978-e768-4b63-a0ba-df34c6f07ae8	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:32:56.354929
65400ec1-e88d-4339-924d-c0b6e3ff622b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:33:14.681023
7fd21c21-d652-4a84-ae1c-642dd5495589	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:33:14.682419
fbea3e75-1137-493c-ac9d-1c6bac17d856	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:33:14.682845
a071ba2e-74e1-4a02-b28c-940123df12bf	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:33:14.692958
023ecec0-1164-44d2-8ccc-6276472a29b9	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:33:14.693038
627a61a1-62e8-4063-a0c0-e8c2f19e61dc	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:33:14.699577
c08401b2-0f5b-4475-ad2c-b53c1784f73d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:37:56.446307
d3aba2a8-b790-4eda-887a-16c113b8e5a6	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:37:56.447775
db362ce2-1844-489b-bcbf-3f42865c8d48	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:37:56.449416
05ec3062-398c-486a-81cf-87944611d2ef	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:37:56.450065
9654c379-f878-4484-a7a6-a2f716368902	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:37:56.450346
cfd46aa6-8561-4f72-9d8e-05d5735bc3ee	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:37:56.457036
570cb8a3-2609-458e-adb5-851f3c9b5067	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:38:14.701747
6acd2841-e297-49e6-91c7-8fca70e5d6d7	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:38:14.705632
f6108b72-7b9a-415b-8d8d-0870d387af6e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:38:14.70586
7d735c70-3c72-4eef-bbd0-0841cf636e19	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:38:14.70774
18be97ba-8d8f-43a7-a695-cd475f809684	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:38:14.707983
875511d8-7beb-49b3-b7b6-6592da4db29c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:38:14.712933
0a251427-f07c-4b49-9f3d-92b5267ad270	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:38:34.036537
d2347cd8-5389-45fd-95c0-3c38fee249b5	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:38:34.04008
80edd3ce-072d-458c-99b4-3f09a4c0fb22	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:38:34.086405
feb5ee5d-7e3a-432b-8e66-2bc01a9c774c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:38:34.090294
092ac086-1210-41e5-b7ef-884a3c7d2d78	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:38:34.093871
74d34b23-fc19-4941-a32c-dd1f8bd39df8	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:38:34.103955
345896b0-c839-4d13-8ac8-4a49722fccf5	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:42:56.544584
6e434e5d-f755-4d50-8327-ebe8f7af1995	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:42:56.547193
61a5f09a-1229-4706-950a-3cb1dc528797	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:42:56.547118
537be447-cb3e-4d02-b9f1-b5d69a2d28ea	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:42:56.549248
ef36a884-b2cb-4305-9d2e-043061e1ddb0	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:42:56.549934
ae405b8c-6836-407d-b0d7-8c417213b1e5	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:42:56.554885
71d74ba6-90a8-4b6e-ab03-2680a49cdd34	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:43:34.025993
900c9ae0-6947-42d1-9c9d-759edb806fe8	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:43:34.02673
1e9812f4-5009-40da-9186-1c8e1a3dcb51	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:43:34.028558
640f2cc4-2bfe-4082-9bc7-489c9ca28292	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:43:34.026016
b7e9fa2b-b60e-4eb4-992a-0ace8e644c9d	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:43:34.029081
c93d3de9-9dbb-48ba-86fa-cebf20548063	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:43:34.037907
97f927ae-ca28-46db-bee6-670f46ae870c	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:45:04.847432
703e95f1-4ebb-4277-a7be-cdfeac89c0c2	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:45:04.847861
50cdccd9-d0d4-41b0-9ec0-682cff60bb05	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:45:04.849989
b7f93c11-1961-4be2-a975-e08ccc174bca	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:45:04.851089
51f04e12-cd8f-49bc-95ef-a482a19cd130	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:45:04.852643
ba4ea6c8-cde9-4669-b1fa-4d3b22c779cc	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:45:04.859615
55e46479-589a-46b3-9d55-550327449c0f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:47:56.644787
46a72dae-e4cc-4707-8b3b-88be20e1a3ff	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:47:56.645126
4fceb976-5bb6-4e64-9d8c-f17b3b0a38df	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:47:56.645279
0d46329d-2a42-4e9b-b7c5-88edae84d5d6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:47:56.648388
3ab13384-5ed5-4a4f-a8d4-8595d0f06304	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:47:56.650136
bb44b125-ad3d-4a9b-962f-a7a0ae99d23b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:47:56.657014
7e700284-d3fd-46aa-a044-2253af5e6864	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:50:04.782834
a08166ac-96a6-45be-bd8e-5bda4158e56a	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:50:04.786285
62377bfc-80b5-4ce9-8f3c-865c32469d2f	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:50:04.786695
991c02be-501a-4f19-aa30-e17729867f27	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:50:04.78705
5a4f0070-0cfa-44e4-92dc-050315082d69	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:50:04.789391
b70da652-0c5c-41a9-85e7-922dd80180a2	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:50:04.792738
927f2e64-7ead-4bcb-9cc3-2f51b2b8fbf2	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:52:56.746199
abc544a9-8c75-457d-b3f7-a2227018a1e9	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:52:56.746419
ef329409-0ecc-4d8b-9025-c2fe2caa5348	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:52:56.748526
3e8f4317-2458-4831-ac0a-7f96bb197ad5	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:52:56.748282
4cbaf139-10e9-492e-957d-47a702bb15d0	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:52:56.749068
85f7105a-b8fe-4bd6-836c-fab62f3bb77b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:52:56.753029
666776c8-77a2-4792-849c-c2e78f78571f	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:55:04.813667
93cb75b3-7254-4811-b5e1-5ffeb2196794	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:55:04.814405
29f874be-9528-4273-9678-ec054bf3f4d3	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:55:04.815839
d5d9fc24-58fe-4d76-baba-f93dfc506229	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:55:04.817303
227d7e8f-8ce9-4a2a-ba34-07873d9b4ce8	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:55:04.817601
76e64322-d49f-478b-a0c6-71f2e3a43afb	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:55:04.822121
9a8960e4-e329-438f-8538-72881702599e	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 11:57:56.83706
3fd7f104-b720-476f-954c-2db0db251329	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 11:57:56.838779
32a8dd43-031e-45d4-bfa1-2e42f80971dc	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 11:57:56.839155
a8c1fe47-8c27-4507-b1c3-79ac6191ac79	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 11:57:56.840796
28e7b762-a412-4b61-a892-cbbc937665bf	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 11:57:56.841993
cdaa079e-8ad9-4aa7-b2c5-7cd3945faa60	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 11:57:56.847315
3deecb80-dc65-4a8a-8000-2cc9afef9ad3	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:00:04.84185
e21ce557-303e-482f-8980-ee2a070921a0	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:00:04.8453
478b8627-1dcf-47cd-9a8f-b765d2e995eb	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:00:04.846255
f95e11ac-b2d8-4826-a466-d009f13bb1f1	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:00:04.847162
c9a9d5af-5df7-4dd0-ba1b-ba4fdcb2c337	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:00:04.850211
70552b19-38d0-489e-887e-adc1330d27d7	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:00:04.853378
c0a4a6b9-4e5d-473d-a0e4-5bd2e1209290	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:02:56.943354
0fe417d9-d85b-4ad2-a5b4-125bc750f100	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:02:56.944165
e6a67840-8380-4835-a136-4b67513c3733	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:02:56.944637
33034e41-e54a-4268-82d7-6d2418100507	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:02:56.944785
4d908041-2b04-45c3-aa69-cab14e476218	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:02:56.947652
35aa0853-c2f7-4efe-b747-95d968175434	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:02:56.953864
fabba27b-bd33-4a5f-9d76-c099568f2488	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:03:18.589317
4a613dfd-0b93-4a16-875e-0e5e74e05dbb	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:03:18.629009
93140348-8be5-46ed-ba4c-0db065550f66	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:03:18.629671
5cdd4acb-69dd-4860-b328-fe7586dccc36	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:03:18.633562
5d1233f3-1a4d-418d-a5d7-987e09b440ac	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:03:18.637419
96256bb2-aa62-4552-8bf0-d3482d83ac06	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:03:18.643248
80286b55-a8c2-4f1e-8768-938c7dc94f14	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:07:57.026073
a2ceae5b-dfc6-4a7b-a1d3-214bb04817ad	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:07:57.027139
4e1dc833-123f-4458-9e1d-b277b0ceb61f	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:07:57.030014
58572ebe-7978-42ff-bd58-e69d53db371d	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:07:57.032632
0830abd5-92b1-4456-a503-c256095ff369	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:07:57.034522
68372df3-60a9-4684-b467-d7f841a486d7	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:07:57.037834
986fd515-7cdd-4985-9f58-c863d44c320d	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:08:18.597602
fc76f737-b0bc-490a-9a6c-0ee716f7feb3	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:08:18.599561
304293a6-04dc-4a9b-9aed-fbd9ad972ab7	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:08:18.600014
92a31298-a554-45b1-8159-cbd132d879bb	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:08:18.601319
8baac322-14ee-40d7-9e6c-89622f55d24a	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:08:18.603965
00f45355-f0e7-4319-acfd-6a1dac76f54d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:08:18.609967
9ebbf140-8dc8-407b-b33a-ea76de08e8ee	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:12:57.125832
96d6f8d0-4344-4ffa-af6e-c70c4ec51ed8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:12:57.126425
5ff380a5-24db-45a8-ac51-fbcab7951e74	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:12:57.129969
b2dd7e7c-f918-4913-97aa-22041537c883	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:12:57.131017
149ee043-41dd-4fc4-8627-ba0d2f5c57e7	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:12:57.131831
790f2dbc-35bb-4113-b749-33c094a27e21	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:12:57.135798
0ef39625-7501-488f-a14d-3c274a5210b3	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:13:18.587743
a4c467d6-8a98-4508-a668-0d2f04673b63	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:13:18.600923
b5d24124-4356-4f85-979e-f9c9c3d8cb56	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:13:18.603239
ff8a4782-903c-4824-8afa-959243851a87	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:13:18.603776
a8c02fcb-7c60-4e7a-bebd-6ac730284e12	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:13:18.604729
7c49f855-276c-42a6-8fd9-752688c1e655	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:13:18.60984
9ed86ef2-80db-418d-b526-d8711ad9d0d2	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:17:57.226713
5f3f2e0e-7888-4402-b0b2-4959f8d306b5	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:17:57.22785
9d12c865-c3fd-43f8-9096-b270ccf61069	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:17:57.22998
45dea79f-75c5-49fb-9e9e-f49727480d68	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:17:57.230399
ea944f0e-6eef-4755-889f-d00eec6b6ea6	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:17:57.233592
3caff1ed-77a7-441b-863e-6b7367b6c450	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:17:57.237655
50877e2d-75fd-4d66-b590-95eb72c857e1	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:18:18.625286
cf7d7048-1d63-4673-a9e8-08808b670116	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:18:18.626939
ec6b0314-a6e6-42e4-86ae-467f0ed16462	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:18:18.629389
4ae77bff-391e-44e6-bd82-949778af39fc	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:18:18.631272
d8d8998b-d4b2-4c9a-ba33-3e8f13d79a54	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:18:18.63307
2d8b3055-6060-4dc5-9561-4fcde37fa29c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:18:18.639649
463f5d29-befb-4bb5-8e6f-8f6569943f39	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:21:42.280044
e16ab04c-363a-425f-9c2e-6b38aba335dd	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:21:42.280536
d45d939f-67ef-4ae8-9369-be913810d7a8	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:21:42.281387
e941c55a-c40c-4c4f-8565-012815a88f72	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:21:42.28459
beac5ee5-cb25-4613-85de-8af846374672	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:21:42.284969
aa67be59-041a-4e86-8439-87df00ada763	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:21:42.295834
f38ee153-ba86-435b-ab97-886ae4c8a32b	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:22:57.327527
b7b0e8f4-5826-4b01-9c35-62e497b49c1b	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:22:57.327192
eb954b74-b681-4b07-b84a-16c70b24fa3a	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:22:57.327945
0f63dd52-436b-4906-82d2-a7baa499cb3e	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:22:57.328144
f73af58f-c22b-462c-b5e6-62c54f7f7e5c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:22:57.330394
643f3419-0373-48ea-8f05-193d71e0e396	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:22:57.334727
5783cac2-667e-4b21-b51d-7bd7410ce7e3	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:26:42.203016
1d50243d-6e72-4c06-9751-6c7aaa27c184	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:26:42.214556
f26d90e2-e721-4264-b5c4-b8dd49093e17	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:26:42.220555
a34521c1-2ffe-4110-be1a-c0199ff0c205	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:26:42.221736
fb7705a1-f18f-4905-a07f-cd91dac5f567	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:26:42.223644
bb4c60f1-f0e4-4df9-9df1-b1c3d097bb32	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:26:42.228688
73599907-574f-4895-915a-fb3e22e58b46	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:27:57.313258
9bae54e1-8214-42ea-9371-301667f6bafd	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:27:57.321098
5f70172c-6cc0-4bc1-9ba9-57595d53a136	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:27:57.32517
466d231c-2113-4da3-a9dd-b50437a22470	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:27:57.326072
b0d9ed7d-02a3-4736-bcc0-3cdac9baacd6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:27:57.33145
65686f73-5764-4df5-b911-02c8b98f8ee7	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:27:57.33474
9d617f8b-ab32-4f16-ae0e-c3a124199558	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:31:42.239191
e74a0969-1403-45cc-9a73-dd9d86231722	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:31:42.24033
16212579-82e5-46e1-b0b4-acee9f56e3a1	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:31:42.242663
7c2d4808-097f-49c7-ac01-f88ba82e76c7	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:31:42.24323
2e98e5ad-f334-43d0-880d-dad949510701	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:31:42.244277
75ab5b8d-837a-4dbd-9603-0cebc7371165	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:31:42.249183
c14df3cf-782a-40fd-b075-5abb1d76bd5a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:32:57.425171
0cdc387d-db41-406b-aae7-95806c078c63	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:32:57.425527
142aefc2-6f46-4dbe-945f-904f65b360a4	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:32:57.425884
7e93c3fa-0f1e-48db-a534-d5873b67c0bd	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:32:57.427162
7f614ab0-3910-409b-a961-02dd0d665545	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:32:57.427398
cf050eda-dcc6-4c47-ace6-9b2bd45186e3	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:32:57.432838
bffba9b1-ec59-4a00-a3b4-d26876143ca8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:36:42.240445
e77277c8-be13-444b-bc68-f404586ac488	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:36:42.241005
1dc09c14-a265-4449-b0bf-c1f27942b0d5	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:36:42.242819
3e75e621-724b-447a-8090-f2a7be6e13a3	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:36:42.243076
42703fd1-77fc-47bb-85e0-64953799c082	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:36:42.243836
10e8a909-9f59-45de-8610-2528b4c604dc	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:36:42.250524
e959ce2e-a8b1-461f-a900-04f6a2fcff34	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:36:58.394753
7bf23aae-db6a-45dd-993e-e1ca64d51734	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:36:58.397276
22f5d0e8-61b5-47ea-bd31-bfa8cd2c55aa	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:36:58.397508
915291a4-e7fa-4e5f-8c5c-739aa67cb7e2	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:36:58.436341
61128ce1-ed43-4512-a958-3540cdb1e271	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:36:58.436872
740146fd-92c2-4f64-94f6-ff46ce73ca46	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:36:58.446452
c22cbdd1-560a-40d1-bbdb-190cfd2ceca3	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:37:57.525594
60e90dc5-a706-4c5b-b4c8-28690d98ced9	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:37:57.525767
5eac72f2-674f-47b4-a9eb-35005fbc6473	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:37:57.529716
9b30eb2b-b830-4f62-8e5f-aac8ac27b051	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:37:57.530749
57e9046b-ca48-4acd-8168-c829b741050d	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:37:57.53136
8f5d92a1-6f74-4a54-a1ee-4ea3b5911075	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:37:57.536185
654a947c-f8b0-46a9-8031-9522fae04ff6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:41:58.401418
a75539d7-a053-42a2-b0dd-80f6ebb794ab	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:41:58.401927
0f22eb12-62d1-4816-9bb6-2577605d5a40	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:41:58.402446
a08d2f14-f44a-4335-94f8-0feeca05082e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:41:58.40288
990c49bb-9dc5-4f7f-bf91-b44da226a5a2	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:41:58.406952
535b4ef7-3282-43b8-a5e3-f7b20e6baaa1	emails:invoice_reminders	success	Sent 1 invoice reminder email(s)	2026-03-24 12:41:58.434771
40a077da-3c01-4764-8035-265b36d5f40b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:42:57.622716
f47fda3c-cc57-4d7b-99c8-c6b6bac151bc	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:42:57.623022
d6bea22b-3c0e-44b5-bf5c-832030de1fdb	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:42:57.622058
d497c7dd-c9a4-44a9-a9fb-aa702b00c5b7	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:42:57.625147
de63640f-e944-49b7-9036-f3410394c427	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:42:57.625258
ed1333f9-1838-4f6f-8764-910136c48579	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:42:57.634314
eb1f2f45-416a-4431-bbb5-8c081f18d429	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:46:58.430633
d8ada20d-fe44-4666-946d-ec8de47d3265	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:46:58.431106
2f1513c2-3765-41cc-b0ee-839c03bfe351	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:46:58.432317
7377d21b-c4b2-4162-a179-4ac1cc70f4be	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:46:58.433131
97e253ad-351f-4165-9480-7dcadc84fe34	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:46:58.433216
0c3b19da-193f-4f18-bc30-0790838cbe5b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:46:58.439709
5acce66a-8dca-433f-80f2-1f5dc7066bec	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:47:54.035492
ce28cdd1-1c97-47e5-9349-68e3b1ec6566	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:47:54.099844
9fcc2773-a438-4dc1-ab02-da48a05d111e	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:47:54.10054
a03e839c-aca1-4ada-9c97-7f71692a460f	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:47:54.10163
7798f525-6089-43cc-b33b-b57f1c67ce9f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:47:54.104831
635eee8b-4fa4-4741-b643-44af8271424f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:47:54.116894
ffb961a6-797b-4fe6-b668-e0d4d1797351	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:47:57.718112
989c4570-d6d3-4a70-893b-a0548b5ec311	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:47:57.719564
b0756f36-b26e-457e-8b09-dcf1cb0a17a0	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:47:57.719972
530828b2-04a0-4e94-be8b-525387936f73	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:47:57.722626
a498ba6e-6246-42f7-85a0-5ce2b3f30080	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:47:57.724254
369d1ba4-dc80-479f-9a79-30b8aafbafa0	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:47:57.732159
3afc9784-46cd-4013-aa0f-274abd2779e8	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:52:54.037795
5ce27a62-6712-477e-86bc-795db4a9566d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:52:54.039882
c2c1fbe3-129d-4628-b225-9249ee9a5571	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:52:54.040638
4947fc41-179d-4bf5-b32d-30b44f711618	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:52:54.042338
6416c1cc-f899-4051-81f4-96caa9dbda9c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:52:54.043267
eb654d3e-8611-47d3-a69d-6bc1e748ac75	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:52:54.05081
de32528d-f8f9-4835-8e97-a6364138007f	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:52:57.816316
79cd688f-f7ad-4986-a3d7-151afab062f3	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:52:57.816652
e49fa7db-a153-44d7-ab30-16f80e7aa3f7	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:52:57.824123
f57c0e76-6770-4f30-875a-b9e43b7de02f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:52:57.826745
b22b65cb-7658-4395-a3dd-37f933fe98dd	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:52:57.828442
16634aef-c7e6-4ef8-8965-85b6bef67ff5	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:52:57.842075
0b6edf06-430f-4d4b-9a1e-a7f1b225a6d0	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:57:54.068761
96dffa31-7665-431e-aeaa-01f68240236f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:57:54.075678
792af27e-7ead-4a5e-82f3-51113a59c763	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:57:54.075356
247d98bd-2607-4169-96f7-e344d9aeda35	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:57:54.076341
75a5d993-a507-4d21-acab-d3cc0154a1af	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:57:54.077538
b5aaa64f-400a-4df8-9841-6191e7f0d904	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:57:54.086105
2f7e7768-2617-41c9-b994-3cd63d1c31aa	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:57:57.937824
13b990ab-292d-4399-a960-76743330075c	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:57:57.938694
caf74ad1-58cb-4b75-a4f2-f6b941df3ff4	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:57:57.943234
c0882707-da35-4536-9dda-54aa200a5f81	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:57:57.945091
4b05903e-6478-48f6-a1c0-ec307bc4be6a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:57:57.95351
64a4f0ce-7c50-4f26-87c3-d3e53f33b4b0	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:57:57.965948
9d9b8faf-224a-4ffd-ab8b-839e98c424de	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 12:58:46.01321
8d592927-2527-4e2c-801c-04a3606c85e5	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 12:58:46.074079
4cd7832c-d724-4318-a132-e93153ce8022	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 12:58:46.074714
8ad103a4-6a5f-45e8-b510-e1942281fbfd	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 12:58:46.08321
00e54eb5-e1c1-4910-9fb1-8d162146ac0b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 12:58:46.088439
87f92217-fbea-4171-96a6-657c6020d151	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 12:58:46.099668
154f5fdf-9988-48b4-be5d-3189bb0764f0	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:02:58.016836
8577816d-3a17-454b-9977-57cd4e6a1e2f	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:02:58.021209
d7604d2d-39bb-49ec-9c1e-6bcd6537966b	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:02:58.021793
13b03041-8401-4169-a8e1-0ddb639eb1f9	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:02:58.023559
c6da6a5f-b482-45e9-bd5e-5c13cf0ee1e2	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:02:58.023736
35f9bb2b-e2b5-4425-9232-173e0207e34c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:02:58.028897
ad5b34a3-6d1e-409f-99c7-bfc9f69431e1	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:03:46.014116
af16aecf-30ce-48ba-a4f5-dc03e1f9bc7b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:03:46.016786
49b3e01e-7b18-4806-adb1-155b1c397f14	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:03:46.017678
bffd3e74-e95d-470f-9a4a-02843784ace0	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:03:46.019215
d5cc3fd0-e40e-49c8-9f4a-41c40c1157f8	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:03:46.019539
208e8979-c4c5-4f66-954b-b9f6d75a957f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:03:46.028429
05707373-d636-452d-a5fd-d21e792e9149	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:07:58.119514
725a26c2-3a0d-4320-b75a-3d00c227bc23	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:07:58.120516
2ec7fca6-ef12-451b-96f0-5abf87fbd702	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:07:58.122138
185e24c6-9d31-47ec-bc46-c5fd6cb65efd	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:07:58.122512
02a466e0-1243-4447-a7aa-a052fa0e8a1b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:07:58.122762
4350e573-eebf-47af-9ebd-34bcb931394f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:07:58.129171
70f34a44-032f-48a0-8f5a-52f8b19d55bf	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:08:46.024958
8fe4e418-50f4-42fa-88b7-1e4a32ce99d2	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:08:46.025304
f08d9c15-4ba2-4f04-87a4-f80544f39e03	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:08:46.026798
7e04a202-9d45-4825-a36c-ff921e09bc30	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:08:46.027061
a51262aa-0fbe-4acf-b572-0e51d3cc8a9d	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:08:46.029402
dbbfe368-c3eb-4c2c-a502-9cc32e15ae93	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:08:46.037259
0d3aff60-8b42-4181-aefd-84551653221e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:12:58.212977
4b008350-9317-41fc-8eea-632a729771be	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:12:58.213582
33856dd1-69e4-4112-b002-c6606385c14d	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:12:58.214173
4924daf3-bba4-4918-a3e2-e2372648571f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:12:58.217407
12ebfb09-4b81-4da5-b304-1c8e76e32806	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:12:58.21901
31a88c13-cce8-4792-86d3-a1a5c50fd11c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:12:58.223606
dd997f12-579f-4ae2-a438-f3da75676816	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:13:46.053385
3cc191c9-df28-49b5-a3cb-1bad0d28ad90	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:13:46.054656
51e050ee-0926-49c8-8ba8-cde25124a488	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:13:46.055305
c04b57cc-eb2b-4622-9e32-f6e1a27f9918	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:13:46.055902
9bc602ad-cd96-416f-9f59-eff28bab24dd	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:13:46.058767
52a80a0c-d5d2-43d0-9481-15395afb57e3	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:13:46.066035
fce0d320-7b14-4512-8025-2ef00ce11740	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:17:58.311889
b55ad9b8-69ff-40c1-97d2-8a1f73608743	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:17:58.312186
372d6a47-43f9-4e84-9e28-ef7914782830	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:17:58.312858
f9578e27-05f0-490b-b082-132db7b7728e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:17:58.314269
ba0261e0-dbe1-45f4-aa8a-b2ccdf798d3e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:17:58.314523
b7e4d653-b7a9-4c4c-bed7-41c8b167e09e	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:17:58.321684
82879774-7f56-4de2-9035-60268420d7dc	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:18:46.053631
2bfd7566-d6a6-41f7-b4c1-f1bf0a512d8d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:18:46.058148
4ffc363c-853c-46ce-8e3d-60cb2512114f	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:18:46.058561
12d34d93-e597-40c7-aac3-9a1ed86399eb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:18:46.060953
10992120-e76d-4e21-b361-469a55cb15b8	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:18:46.064141
aae3b0b1-eab6-4349-b2ec-a3e5afe19977	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:18:46.069989
cb6c6d4d-2dbd-4e4c-89c8-9d0d41a834fc	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:22:58.403608
e0645fa3-8ba8-48e3-b469-6dc5b9167859	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:22:58.405721
331c5794-3b0b-47ed-b563-95514635bf8a	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:22:58.407794
9dd87789-4940-4d0a-b770-de57d052ddca	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:22:58.407991
6b8a2fc4-e73a-41c1-84da-aad808c338ce	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:22:58.409618
8be789b7-c6ab-441f-9d74-5664ab87af4f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:22:58.41349
eeb8b45b-e4ce-4512-a0d1-a740942eeb26	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:23:46.070236
697e10ce-4fb7-4eea-af3d-7a96baccfd81	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:23:46.070714
4a65a2fe-87e1-41a5-8df4-a3d1b4dc6ad3	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:23:46.072779
4b690c15-77a8-46ca-8096-d1df5cfdd197	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:23:46.073086
046eb260-08bf-4271-8bbc-ea013a98375e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:23:46.073799
2223e5c4-aa2a-46e2-a873-fdbec04f163b	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:23:46.080227
47b739e9-fd77-41ed-941f-4800111d194a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:25:34.625007
ba403568-9378-4826-8288-a9a23666d5fc	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:25:34.626202
238b28f1-7648-4359-bf9d-6517eb9efca3	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:25:34.626881
99950097-cf7d-4e78-8d00-df4e5d0b9419	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:25:34.631518
bb44a709-9119-421b-9d4d-cd55bb80db8f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:25:34.635586
00856f1a-d4a8-465f-b5b1-18b323f754d5	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:25:34.649631
70dd7639-f571-4370-a9e3-3d843da8f2af	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:27:58.396203
f35dd76d-15cd-4b8d-b0cc-3bfc25d6cedd	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:27:58.406262
42a01948-8bb2-4257-9b07-d89bab40eb37	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:27:58.408801
06d2700a-6d40-42be-abe6-025e2d4f8c1e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:27:58.409362
1d53d2d9-0c2e-4977-bf08-d8daffdf5db3	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:27:58.410689
a37d30db-51ea-453d-9196-07aa34abba8e	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:27:58.414713
0e959399-b857-47c5-b49c-711d1b4291dc	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:30:34.555993
7758cdf2-c6ac-4706-a2f1-e7acfe1e6707	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:30:34.558046
f0cca4a8-2873-44bc-9d55-52e060b33488	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:30:34.559578
574138ca-3520-42b2-b307-8b0f14ff89a5	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:30:34.560617
bef97e62-64ea-480f-9740-d0042264f861	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:30:34.560957
4a8e1931-acce-47a5-b684-8d48b40bb1ba	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:30:34.569706
c8aba0e0-668c-47db-a19d-8ab333518770	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:32:58.505566
d58eca1a-7fd0-4bb9-baaf-7dc5617ea5ca	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:32:58.506579
77e59614-0e24-45b1-8381-f54b5b37e8fb	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:32:58.507948
ae127513-e226-43aa-bd88-c25aac512611	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:32:58.509134
9bc802ff-6e34-4751-b144-4bb84109848e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:32:58.50956
70be15eb-4b31-4f2a-aa7c-a11ad5330d30	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:32:58.514475
7c49dd6c-cef4-4936-bd1b-d8efd4e2158c	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:33:36.174783
8939cd71-c5de-4904-ac98-68d4da304fe6	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:33:36.182436
544c0e5b-64bb-4679-ae7e-2fa623d5d1ff	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:33:36.248498
29529608-5db8-4127-a0a7-26b044079105	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:33:36.259129
7d31fe2d-e9a7-4bc2-bdff-e26071aca115	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:33:36.262233
b6deadb1-0158-4c48-a16c-07ebf47a7239	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:33:36.277377
76187a4f-a869-4253-a725-6cc66be60c24	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:37:58.592711
80ca1846-199d-4322-a8c3-d1a3e21aa214	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:37:58.593115
94809519-665a-4e01-8240-bec0cea0c04a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:37:58.593939
76de692c-8c3e-4c2f-9151-3ebbf690b52c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:37:58.594243
81f9fe23-97a7-4d5c-b211-d0fa060a6507	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:37:58.595921
10010166-623a-4b52-aa14-f0df69da2bcb	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:37:58.601602
b82ab356-88b8-4cc1-86a3-92e4e40adf7f	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:38:36.162284
37d45dae-86df-40de-bfd6-7e3d97cfc4ca	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:38:36.165592
9c2426c7-cba7-4c40-affd-d6806c96d001	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:38:36.167268
5dbd0c9b-d6d8-43cf-86c2-72d4cc98d686	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:38:36.169652
d56645ec-0090-49be-b8a3-d7bff0e26e78	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:38:36.170432
52dc4fa8-0125-470c-8c3b-4dd0e65f8f30	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:38:36.175882
8d5b644a-73d4-4f7b-bd02-148365b72326	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:42:58.688583
c39f313d-e63c-4490-842c-8e7d47d7f9ef	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:42:58.691701
1ec063a6-8433-4d7f-84f3-e65d3ed2e39f	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:42:58.691842
b8a4fd65-a1eb-4522-bbb2-14e6b0839854	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:42:58.692628
fb83b2e1-1029-4886-ad25-c66335d6df8c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:42:58.693885
1717dded-35bd-49ef-9e11-3a17df357b4f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:42:58.699687
88af9884-b937-478b-b503-5e79cdf093bb	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:43:36.194173
875d13f6-03c1-42a5-9868-f52b17288bcb	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:43:36.195311
95b3b2a7-8da3-4601-a406-ac19e169eae2	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:43:36.196874
6ba4b86d-f5a8-4e61-8b89-2bf81fa40027	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:43:36.19876
dcc7955e-0b11-42b1-a6cf-3174b26c73b5	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:43:36.200435
a993373d-b0cb-4489-95c6-10c57931c771	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:43:36.210134
2df7384a-a090-4fe7-9bc1-10d6e71951d8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:47:15.104789
db764ff5-c317-4336-9df8-1e16d9bf6f36	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:47:15.105357
cec930cc-8f6b-4ef4-b405-6a9a09095ab0	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:47:15.105803
b6ffad0c-e8ca-41b7-8625-33046aeb412f	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:47:15.106156
77242947-815f-411b-8482-d13f6dc5a0d4	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:47:15.106636
5162eca1-e17f-4df1-bfaf-5de3e6a67259	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:47:15.121604
ac129ee6-f4fb-494a-8263-4c14f31f09c4	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:47:58.785872
3ec918f7-ffb8-4fbf-8286-9276eb465e3d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:47:58.787941
e7b795bf-5721-40b8-8966-68217a4bd784	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:47:58.791823
e72bfadb-e47c-4db5-989a-bd706496bb19	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:47:58.792293
7c49db28-01db-485e-bb68-4e891a1f83b5	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:47:58.79281
518a37fa-05ea-4bb4-990b-60a382daa0bd	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:47:58.79731
26fcb517-e29f-4516-8f6b-29dbba62a044	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:52:15.020807
f2ba4850-166f-4510-a0c6-aa39c666e171	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:52:15.025095
05b91290-e994-48c8-b5d3-0e396ddce980	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:52:15.030882
a690c147-92cf-46ab-bc97-bfbb63bd01da	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:52:15.031352
11077273-161f-474f-907c-21209e0ef8ec	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:52:15.033151
d5e4e8c6-410b-43cd-a68a-a7c793ab11d9	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:52:15.0403
de7a4d6b-7570-468a-b724-1f589afdd40d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:52:58.878731
e1be034a-d246-4f89-b84b-7dd13c88f7cb	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:52:58.881049
241442bd-61a7-4965-8efa-2a86b786feda	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:52:58.881241
df2846ad-8efc-4b26-b0c7-753f82137a7c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:52:58.883753
b0a0514d-a10e-4916-af73-5b7983b67638	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:52:58.884439
7171b057-8fce-4af4-97d9-5b0ae17de04c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:52:58.890926
f68acf1f-dd80-46f8-b41d-57c347e56416	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:57:15.043991
0ad295b8-f42f-4db9-8d8b-0999c0c8b3d8	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:57:15.044646
2f173163-3a53-4931-ae2f-60fcbf855604	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:57:15.047189
95d3cb93-0cc9-4426-be70-457a0983d626	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:57:15.047834
403eeb91-b42e-4de6-aad3-fd107c33b47c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:57:15.051294
9c7360fc-8506-4238-bcf9-15ac72de10c1	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:57:15.055362
f7cbf67f-35b4-48c9-bed0-f0d09ee34e93	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 13:57:58.972964
49968bff-fafb-455f-9d24-801e4e348d13	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 13:57:58.974272
d74fcdee-f5aa-40fc-bb61-f1ea801bfd68	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 13:57:58.97602
d146789b-8cd4-4392-b557-fa44c2f52048	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 13:57:58.976486
25d97cdc-b6e1-4d7d-947a-587dff4ffa69	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 13:57:58.97755
81c3b4ca-e93a-4d54-855a-67a130e3ae3d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 13:57:58.991228
74d36555-75f4-40e4-8d92-8d2c797267a3	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:02:15.090722
3f580da2-ff3c-41b6-900d-87821c149ad0	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:02:15.097328
e339640f-f43c-40ed-97cc-9228d57708c2	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:02:15.098689
1dff464d-6afc-4529-abe1-c541041e57c8	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:02:15.101053
53bf5338-4ec7-42e8-9161-4505136e6a2a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:02:15.102658
452c0ba2-dab8-4325-af36-5913104f3d90	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:02:15.11595
7bd0ebd3-cbc4-4a62-a6df-a64b790690ee	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:02:59.071879
ea36b961-127b-4936-aa05-13b720b6a9eb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:02:59.075084
0e132f5b-39e9-47f0-81a9-cbafdc5a23ca	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:02:59.076241
a80388f2-ff1a-4630-a3af-c0f12360d236	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:02:59.076192
31636f2c-bd5d-488f-9657-3593b9a54a2a	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:02:59.078347
c9270214-3c32-48f4-be7c-b8050f66ef90	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:02:59.082609
e64195ec-3a56-4a48-98fd-3317e8175f42	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:07:15.061446
b86cebb6-b5bd-4756-984e-a1aa7cf4418e	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:07:15.069501
738dfcfe-880a-4a28-a174-6e96a5d0027a	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:07:15.070454
1a6e44f9-e0d8-4609-b256-027032519ac9	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:07:15.071927
a5cc8409-5aa3-44f0-8031-25f5e3ea2d3c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:07:15.075486
04baedee-9e2a-476d-bf44-00535157fb96	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:07:15.081019
d196648f-26b2-4529-ac3a-33202ecfccb9	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:07:59.168069
ba52523a-0284-4bbd-9573-a0e7a80e0480	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:07:59.16885
df4476e6-19b4-4fc9-9ca3-061e1127661c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:07:59.17389
b0d77f7e-5e23-44fe-bf79-97ed0f0eba3a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:07:59.174116
db84e192-5cd5-405e-9b4e-aea1fc516eeb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:07:59.175423
ef47725b-1e52-468a-a8df-22d19ce9ddbc	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:07:59.181663
a110f09d-8eab-4c37-ab1b-d77d6f0be4a9	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:12:15.075336
105ec7b1-585f-4751-91e9-4eed1cc32d7f	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:12:15.076135
620a7064-4617-41d7-b9cf-789549a2be3c	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:12:15.084528
c4362306-b156-412c-872c-d56e77624181	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:12:15.086884
4a1e9be4-2bbf-4911-a7e2-d2754ca6d55a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:12:15.087438
eab174e1-85a7-46e3-aea3-c0f892fba608	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:12:15.090278
04323622-f200-464e-8f09-d0ff1f954f18	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:12:59.272054
008de34e-88d1-48a8-83d1-47e39fc7c785	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:12:59.274976
f90a3961-bdd8-4fa2-8691-f3792ed9c3cd	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:12:59.275786
5bc8849a-f166-4404-be87-00aace47d474	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:12:59.276417
4e7abbb1-cd08-428f-9244-a229389593a1	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:12:59.276777
e1b3d00f-00d9-4eba-b367-c7bb6e4394f4	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:12:59.284683
9af7013b-3d0c-4ac3-ad32-f11caacace23	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:17:15.065057
eb1ce7b1-e6e0-4b61-b381-6bbf07b1cf75	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:17:15.06924
ad82dcb5-72ee-4785-8be6-1f1f4c42313b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:17:15.074517
c56056cd-0054-44bb-b7f0-8e6d1ab310ea	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:17:15.075544
46884244-99ac-4bb0-b54d-534365fe8d8b	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:17:15.078047
cf3b74e6-d33f-461e-9642-664c5573c548	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:17:15.083745
61cf8dcd-b845-4a3a-8475-2187f0cab865	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:17:59.371402
7552445a-0a3b-4ae1-a538-cf7d87d61636	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:17:59.377661
3cb85d64-c681-4702-9178-52451bec842f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:17:59.377926
9395af58-e01a-443d-b5af-676004077764	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:17:59.378215
f34b627b-7a86-40c7-9a2a-fe282308be3f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:17:59.380715
d900cada-efb3-4a55-a7fa-e44f79d691d5	emails:invoice_reminders	success	Sent 1 invoice reminder email(s)	2026-03-24 14:17:59.389834
b73d4ec6-14f3-4a8a-9442-574fac97d890	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:22:15.084696
ab45404b-a98a-4fa6-9f26-7228d5d49acc	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:22:15.084817
fca31791-aa63-4373-8556-2ab7b877a700	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:22:15.086394
fe4feae1-1d24-4822-a479-d59f4f6e950f	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:22:15.091489
19c5a687-4ab6-4d09-9ae2-9ca3cc805837	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:22:15.092974
cb3c5ddd-395d-4a6b-b6b0-cf1a24bf7ce3	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:22:15.102453
723fc551-438e-4cf7-98da-ad7e46823bcd	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:22:59.462977
8a571351-a93b-4288-ba1a-7795f2f50ca8	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:22:59.46685
fb04becf-5e4b-4fbb-ae29-e6a76ec659b7	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:22:59.468542
27aa0d1e-4f0a-4d25-981d-8eb32aff4860	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:22:59.469788
b7a3ac41-a656-4036-8741-3d40e68a2ca6	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:22:59.470667
f9f98c4e-e119-4321-ac18-751f55ace15d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:22:59.473708
3e3d5eb0-6285-444d-9f72-abc6655a53a8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:27:15.075522
c5567784-d4c3-409b-9762-c5b9a865819d	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:27:15.077434
664e28a4-2888-4597-907d-be9b4650f106	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:27:15.085913
580a3363-eae4-42f1-8eec-a370c965e30c	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:27:15.086535
a9efcecc-67ec-42c0-b846-44e887185f6a	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:27:15.087176
2635391c-b312-486b-a8d8-39aa5a5f30f7	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:27:15.093678
60490b9b-34fb-47c4-8e2b-104fdd0b2c08	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:27:59.454478
e61c9aa9-0734-4fd0-9314-17ac7c6b2130	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:27:59.466865
d636eb83-9232-4f22-aa27-45800e7a5f87	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:27:59.469329
50c3e60f-950e-4e97-a175-431efbfa6ffb	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:27:59.469713
866f83d8-6e95-47b7-a2cd-1b4fa178e9ed	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:27:59.471444
04c92a61-3fba-4d53-949c-e9b2303cc3ec	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:27:59.480611
ff517d09-dbfc-47f1-9ae6-e78e5355132a	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:32:15.111866
1f9d9bed-5a47-4d24-9579-98eb3591064b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:32:15.116395
28148a51-3df5-40be-822f-d694f16ad2c6	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:32:15.116413
ec60f356-78a9-4d86-8726-5a1c1cf78460	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:32:15.118076
5c326461-030f-4fcb-a2aa-469394b53752	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:32:15.118398
4bc5615d-1478-4b3a-8937-4418ae28af8d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:32:15.123553
e175c445-7cf8-4413-99c3-466eee117e18	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:32:59.563299
ea8affbb-2da7-4e9e-b240-395b43221db8	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:32:59.564447
cddd5059-5855-46f6-b33b-d04926d104a9	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:32:59.565415
f6654335-c1d9-4a0e-aed2-20f12d89f0ff	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:32:59.566712
5345750b-b52e-43eb-a01c-1ea20008c0dd	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:32:59.566909
3c8368e6-fa93-4be5-a20c-76fa9dca5c95	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:32:59.571557
537b1a58-21e3-4089-8c47-3e698787afbc	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:37:15.099996
d755de87-750b-495a-a174-0cb9adaa5836	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:37:15.108251
a29790c6-cf09-4107-a820-992673a47fec	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:37:15.11182
22056297-f694-4c96-9a22-271c8574955c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:37:15.111992
098c35e2-800e-4de9-b5a8-005514283793	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:37:15.112593
542eff95-049d-43da-b45b-83db4343e358	emails:invoice_reminders	success	Sent 1 invoice reminder email(s)	2026-03-24 14:37:15.120327
69188649-3a64-4437-b7c1-44360ef1b571	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:37:59.661684
be887cbc-7f86-493c-be25-8695f60cd5d8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:37:59.665622
ead16fcd-2534-4127-92c3-4268195ce982	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:37:59.665973
d35dc82b-2f50-49cd-96ab-d23fe3c33c16	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:37:59.668018
2e91e956-997f-40b0-ae71-d28704a8a61a	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:37:59.668995
b8c43f64-7c98-438f-8e3d-5f6884aa9d53	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:37:59.674229
b36e9b53-40a0-4be5-9904-dcb9279656a4	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:41:52.146578
98788caf-3afa-49d5-9c96-40e05cc637b4	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:41:52.150173
1194c6cf-4654-492a-97e6-cacde6d52e08	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:41:52.15072
d896ad73-938c-4a33-9a8d-93d7b8a56e77	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:41:52.153922
ee19dd57-d5ec-440d-b742-6a2ea92b0623	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:41:52.154342
47e66a08-989f-484e-9528-4a392652459f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:41:52.165678
2c788a69-6439-4547-ac26-9531f3dc81f3	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:42:59.766049
20eb7c95-328c-494f-b5f4-1d9cf5f7ff74	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:42:59.767415
bf7127da-121c-4c74-a954-98ca15d6cad1	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:42:59.767694
66a85af8-7e82-493a-8885-7fb058e27354	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:42:59.767847
befc7bf0-e782-4489-8890-90a989f82a34	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:42:59.768576
86ec24ce-b4e5-4411-9c7a-61f05cfb8340	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:42:59.775355
acc51a86-b714-4922-a0ff-75e38aae95a4	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:46:52.075975
ef17313c-9d5d-4b99-a23f-c0beb0252b16	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:46:52.07627
1e4a4fcb-4347-4744-b98e-dd54c9b41569	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:46:52.080307
b2de0b0b-11e7-416f-8ce9-88c4f224788b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:46:52.081351
a94410ac-9268-4087-928f-e8cc4668643c	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:46:52.082962
4a66b9e7-5efe-44d9-abe4-6075d1b6f480	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:46:52.087682
dca749f3-b13c-4134-b71c-eff1a6519752	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:47:59.860284
b737ec37-077c-4230-90e0-8b8680cbb6ed	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:47:59.860245
afe376a4-e610-4658-988e-e80975b76ab3	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:47:59.861389
44ef205a-06bf-4f3b-a529-7d3718285fb0	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:47:59.861815
2d697154-767e-42cf-ada5-52c190760d7e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:47:59.863951
c72d972d-bf6c-4b42-9f78-7e5dce470a45	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:47:59.865932
ae12f880-5f56-4638-b49b-9ff3b1ca19c7	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:51:52.055545
82db64c7-b38b-45be-a32b-ee32c6ba1e4a	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:51:52.067278
04030473-30ba-47c9-895d-ece2080b1d05	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:51:52.068302
9a29a62e-2708-4cfd-b2c1-02d59a797c73	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:51:52.069785
209c3854-6b87-4fcf-85e3-ae45ccc92e0f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:51:52.072553
ede8210d-12e5-48fa-82be-01d30e85f895	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:51:52.077228
d93cc5b8-0849-4ffc-b52a-2f199806f9f1	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:52:59.959556
b5884170-a3f3-4cc0-bcd7-d9a3fcba0922	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:52:59.960172
c2ebbb82-1eb6-497e-a480-c320689d8352	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:52:59.963231
4d6eb18a-33d9-4856-8c7c-172a02ebd66f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:52:59.967908
4069cfab-792f-4b3c-9946-d889fc0e21ea	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:52:59.969388
1454e842-047a-484b-a82b-02f78d8c468f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:52:59.969652
48e544a4-3e63-4b13-babf-f96498131841	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:56:52.074156
c713d4a3-6c3b-4a2b-8be0-5180a4fd58d2	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:56:52.075546
c30e6268-5aca-4d45-a5e8-3b6eda6bb51e	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:56:52.075863
7daf73d9-7a5e-4881-aaad-f2d11f1cc8af	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:56:52.077537
5f661c9b-b35f-4690-a4e9-ac452a71e1ce	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:56:52.078209
02c06086-1ed0-4c31-89e9-ed178cf645f5	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:56:52.084107
0b2adc82-8312-4e0f-ad5a-1e5323459a76	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 14:58:00.058934
2ed0aa9c-0364-4e0f-9658-7b2fbc76fac5	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 14:58:00.061048
269a3aa9-d478-4792-b9b0-c18576921d12	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 14:58:00.065519
821a7746-3a83-4ea4-8b6a-f700f65c7b01	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 14:58:00.06558
2b0891ef-8545-431c-8ac1-4940b6999d63	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 14:58:00.066041
64b5412a-8e29-4644-8ff8-67fbd03f65df	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 14:58:00.072448
b241bc29-1813-471c-8851-941b34f99422	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 15:01:52.085587
38ec4633-279e-454d-b1e4-e9504d543419	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 15:01:52.087578
33c7d2dd-da4c-44cb-b99d-7058b8bfbbc5	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 15:01:52.088187
ccd16834-94cd-4634-aa65-7fd2518990a1	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 15:01:52.088873
5b3fdae8-2ef6-4c05-b5bf-a5c4fb1540bf	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 15:01:52.091113
4733b9ce-2b77-40f9-bda6-6d64208c3aad	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 15:01:52.096545
e93569af-3ca0-4b63-a45e-a45906c84036	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 15:03:00.161863
1f627c69-1fdc-4be4-9989-468536f9c5af	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 15:03:00.162706
4f8ca60b-fed1-4aa7-a3d6-bed2a2a10a90	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 15:03:00.164651
72847537-90a5-447f-b5a0-9a0c27ceec10	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 15:03:00.166196
6220dff8-32b9-4f5c-8e79-c9bf28810dea	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 15:03:00.167049
0ab7822f-73ec-41b8-81b8-248feb818b7f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 15:03:00.170523
88d33ba4-2228-45a4-aec7-f0b74b05268b	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 15:06:52.102217
7c4bb910-7d5c-4cb4-a2f1-b8d545df8c0a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 15:06:52.103199
770fa2aa-11b0-431a-b29f-19bee33df264	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 15:06:52.103641
305c6896-5ab2-48f3-a2ba-3713d81eb2cf	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 15:06:52.103756
220a1b56-558f-4f44-9630-9efad855e9f4	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 15:06:52.105324
16a4da57-eb44-4e4c-91e9-92296fe72bbe	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 15:06:52.108678
18261ca7-7d00-494f-a943-e57b09bfb9bd	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 15:08:00.259756
045be5f6-5ab9-4dac-a66e-ec2fcd41ae3a	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 15:08:00.26089
55e854a5-38ec-4e39-bd1e-be1aa37c8e38	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 15:08:00.260981
929ec60b-4f4c-4efa-84ba-6b80375d7d0c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 15:08:00.261208
a344dcfb-7fd2-41c0-bbe1-10817fc14ea6	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 15:08:00.262338
ae54bc11-aaf6-4b22-a60e-6673b9606a13	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 15:08:00.269816
ed6c7638-4e4b-4558-b8c9-5d3c3d0e1a50	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 15:11:52.105902
ae0e4a97-319e-4127-80b4-3aa84798ecd5	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 15:11:52.108436
1bad56f1-7cb8-4e45-a98d-60ef1a718787	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 15:11:52.110896
179d9fcd-7d13-4f06-8589-f4bcd16dcf77	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 15:11:52.111083
2193ec8b-5399-4714-be45-b0c21e946b5a	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 15:11:52.129264
9c61e3e0-6257-487d-8317-11541eb8d4d7	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 15:11:52.135627
46bee828-89d6-4e3b-b35a-43e0f70c31ee	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 15:13:00.361681
89eac377-77d1-4ba0-8908-6975b94218a8	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 15:13:00.365282
ff0d5fe7-c8ca-4373-926a-3b80d5e40212	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 15:13:00.36885
10ea54cf-e6d1-4bf9-bb12-7081221504f9	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 15:13:00.370789
f72a98ec-723b-4bd4-abe9-4795b6a96b91	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 15:13:00.37097
8f842b5c-f0b8-4011-a08c-58b7fcf0bf27	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 15:13:00.374714
774b5264-3981-4669-aaa9-da5880e628e7	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 15:16:52.119046
c2005426-c2be-49a7-bdf9-517fea187ec5	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 15:16:52.12154
93b09b33-46c1-4ad1-9145-75d2102edc04	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 15:16:52.121971
5f99fc64-9940-437b-ab51-d181d72c23bd	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 15:16:52.12329
05c06c16-161b-478e-bdbb-9c012b942e7b	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 15:16:52.123575
191f91f3-5267-47a6-bd41-a92650d2091f	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 15:16:52.129202
c1ec44d3-387a-4b36-9837-b357ca4e0258	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 15:18:00.456515
0270c15f-cd9c-4654-81a3-862a2243a535	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 15:18:00.456839
7376e35e-5a35-4c7e-8cc2-9bd0ea624081	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 15:18:00.458639
99758b05-c751-4f42-928a-fe75ee881153	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 15:18:00.459832
0e5cded6-ead6-4845-b8d9-0ca984f72ceb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 15:18:00.460056
80bdc25e-a010-4823-b861-81f34812dd0c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 15:18:00.465377
c964a9b5-c1a2-40a6-96a0-3a27f9707525	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 15:21:52.150717
839faaf3-5ca1-4be0-97f0-f7fdd22ef6d8	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 15:21:52.151145
29c18bc5-bb54-435d-b2bb-4777d36a0848	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 15:21:52.154733
35e1ef3b-6394-4019-b08c-be7dd70159a1	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 15:21:52.158412
685d7b44-6f65-4d3c-af8f-d96f0be87b90	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 15:21:52.161611
72ba19d4-0581-4f9d-abe5-c80f4c0ee2da	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 15:21:52.165278
c9035d91-faea-4a89-86fb-1e752d1093f3	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 15:23:00.559937
b8ad07ef-a40e-4447-b08c-64ce54fb47ca	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 15:23:00.560441
219bbd2b-bbc9-485d-837e-eba3ec6a4311	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 15:23:00.561117
252ab344-bfb8-4e0f-9bca-0a105e426cb4	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 15:23:00.563012
e94efa31-489e-492c-8846-0636f5eb8195	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 15:23:00.56422
d9ef1435-bd07-4c0d-9e89-885e07f00cf2	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 15:23:00.568935
89905c67-9119-45a7-91f6-ecc755b154bf	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 17:08:26.471283
339f5710-0682-4d63-bbd0-e2fe5abcd051	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 17:08:26.596972
3197a74f-2972-4ca0-8256-486653b8c5c6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 17:08:26.602892
13d4285e-48b2-4662-87ae-f3f6824e1845	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 17:08:26.618427
6cbae2f8-aeb1-4237-9c1f-176d60b27426	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 17:08:26.620927
8fd3f6e2-cd6c-40f7-b279-3a6d8e60fab3	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 17:08:26.643487
02aa01f1-da8d-4bdd-bfbf-7872aab1bc1d	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 17:13:25.070772
f089265f-c24c-4d4c-b957-32a531cef26e	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 17:13:25.07371
dd09f08c-39c9-458a-8cf3-f16a97783820	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 17:13:25.082305
706748cf-5339-4a85-ac55-59c7e3fed7e8	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 17:13:25.086565
492a2400-c1d4-435d-9399-093340d065e4	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 17:13:25.08794
9914e7eb-deb2-46cd-868a-84ca5df83644	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 17:13:25.096459
21742f89-5a15-4f6b-9014-0f82946d7f65	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 17:18:25.109
5560e0f9-739a-4387-920b-ce47f2b3fdb5	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 17:18:25.110813
350e275b-30d4-4aa6-bdaf-f016c9df2a5d	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 17:18:25.114023
e6e18c86-16f2-4d0f-8967-e6acd2459db7	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 17:18:25.114884
e92c99c2-1b92-405a-869c-754be9553602	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 17:18:25.116739
b6f975cf-f667-495e-9c00-a871640196a5	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 17:18:25.122393
de8f0d01-8213-4569-a118-08874458217f	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 17:23:25.124066
88dfe8a1-4a79-4412-b739-bee551e27274	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 17:23:25.128126
1e6b9c77-25ed-422e-bb46-5794ef492de2	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 17:23:25.129212
60944a22-0c1c-473f-bbde-173feb0a1355	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 17:23:25.131729
eb3dc452-3c91-45bd-a11d-59f1d6987e22	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 17:23:25.132055
35d5273a-0c08-4848-8bd3-46cb2de7f39e	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 17:23:25.138412
0c122b14-fc6c-48d3-97f6-9b3a853ed7af	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 17:28:25.153899
c15c19e3-1adf-4912-a9ca-bad23029d9f8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 17:28:25.155998
c59632c0-0038-4cd9-81ad-19f41daefdea	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 17:28:25.156995
432d803d-782f-44af-9b05-e7e291248c98	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 17:28:25.157586
983af947-4dca-40ce-b9e8-226e2012f15f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 17:28:25.157589
fb2e7a2e-e4c4-4105-a3d3-7d42ee2743b4	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 17:28:25.165512
ef0546b5-8f60-4e0b-a7ea-30179bd5320c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 17:28:34.473966
eeb890fb-aae9-40bf-a2e0-a81c59a942ff	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 17:28:34.510785
901c1dbd-bb52-4107-b666-47c964dbe319	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 17:28:34.513702
8a79b057-5422-4189-95e8-55924a6b636c	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 17:28:34.514404
0b6aed89-97d6-4469-9168-07d19d51ed3f	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 17:28:34.514919
19c6ff02-0a9f-4c80-8c87-c1b86b514ef1	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 17:28:34.525659
58ee319e-42d9-45e8-8200-b9b0a45fc3b1	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 17:33:34.463796
97400972-ec84-47fd-8159-f4ed1a74e719	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 17:33:34.465339
6bbc9638-7233-4cd9-95a3-3cebb7560500	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 17:33:34.465622
352df829-9b65-42e1-a81d-45e54165ae40	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 17:33:34.46835
3dc85e06-259b-49db-ae8c-319c5a635b4d	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 17:33:34.468723
0bd081fe-1dda-498a-8b5c-f4733680cabd	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 17:33:34.475455
ad05cdb7-6a51-4450-9daf-a099eacd3aa9	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 17:37:30.739462
532f042c-f336-4697-98a4-cbf7e19db55e	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 17:37:30.745315
69b6eb74-3ce6-4596-9a32-abbe788b8978	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 17:37:30.747173
e3abc856-596b-4291-a7bc-484dfadd7354	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 17:37:30.789145
3f64b1a3-e2a4-473f-a48c-9b37b6302c6f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 17:37:30.791103
0dd2abaf-1e0e-47b3-a71c-54202d52ec68	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 17:37:30.79799
8d4e9994-511a-4d66-8a05-f85b8478c875	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 17:42:30.739024
5d9cb8b0-474e-456a-a866-0a2e151acbcf	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 17:42:30.741916
99e30647-c67d-4949-916b-3a6d3c9bc0b6	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 17:42:30.742326
d309bed3-07a8-4225-a495-ede126ad6710	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 17:42:30.743461
effa5876-6ade-452c-a4a0-c3b67570d14d	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 17:42:30.744329
7b336262-0ee7-4f1c-8efb-39462163a548	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 17:42:30.751793
5fc7f156-afb4-405f-9d6d-05b5b7840162	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 17:47:30.763251
60f57f89-3385-41a5-aeb6-64df007a4c92	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 17:47:30.765545
4f176154-edcb-49b9-86c6-7a750a96d1a6	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 17:47:30.768329
6abd52aa-8294-4b4e-a688-cabe71b057ad	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 17:47:30.768757
10bb717e-4d06-4f0b-bc4a-acbc49d88f41	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 17:47:30.769439
48125b82-d504-4b89-81f1-f3674340adf4	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 17:47:30.77893
71f1b143-af95-4dda-b718-11a0a09d8821	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 17:52:30.792089
38bd143a-4351-43db-9f9c-eaf88c98adb8	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 17:52:30.792863
fb612b98-df0f-419b-93d9-9ae00628358b	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 17:52:30.795916
d70cea8a-7b18-4ed0-8d72-630a24e92640	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 17:52:30.796581
cfbb532c-3036-438f-b43c-2437bfa9faf8	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 17:52:30.797835
1900bc5a-27f6-49be-80f4-117af743ce25	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 17:52:30.803098
71e7b971-a08c-4b7d-9b52-78b826493fc8	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 17:57:30.819252
58be2e3b-3440-4bb8-a825-8425d4c28904	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 17:57:30.821999
922be187-37b3-43c2-90ae-ccf6c0387622	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 17:57:30.822134
406dcbb4-2584-4c89-8c96-61814d80c3a5	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 17:57:30.825482
2a81daea-7cf4-4c1e-bce6-7163b5e7e352	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 17:57:30.829183
7d6fc3c0-89a0-4266-8e96-2250e29c69b8	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 17:57:30.831844
9b1be612-3b0f-4cc0-8e56-20d91184ba53	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 18:02:30.851465
819c6fb9-f09e-4edc-bd2e-f59ab2398cd6	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 18:02:30.853622
2b30d80c-5de4-46d8-adce-7427d363368c	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 18:02:30.854113
9bae75f0-7339-4557-ad67-3c05586f8c86	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 18:02:30.858051
21190a88-a507-4efe-8abf-0c2037b7ff6b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 18:02:30.858662
817eb17f-c3d6-4c42-9418-576fa37fcb0d	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 18:02:30.86469
7cdb0757-b7d0-4032-b0a2-34e6a70cf1f1	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 18:07:30.878718
db338e1b-5d1f-4145-b117-8a72f7fdfa3f	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 18:07:30.88115
82d1fe67-137c-4b27-a8fa-839b30d2eb01	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 18:07:30.880645
5ead12a1-0d1f-42ff-8a6c-75cb2639866e	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 18:07:30.883768
44feefd0-c34c-4b61-bcef-829b90ce4bee	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 18:07:30.885214
03ebb896-adc3-4e9d-91b0-8b509c3d5442	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 18:07:30.890514
5f2d715f-91a0-4d00-9586-3c64755930b9	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 18:12:30.907401
e76d6450-19a7-428c-9a57-f18bfcc44b37	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 18:12:30.908772
cec88636-a0c2-4111-885b-ed7d442d9162	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 18:12:30.909402
bd2302f6-ca63-4f91-aa6c-b261f80685e8	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 18:12:30.909788
ac3e2d9c-5333-443a-ab70-a87b333155e3	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 18:12:30.911802
d91f6745-c4fc-4514-a2d0-02ec5ae38bfa	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 18:12:30.917756
98562973-ccc4-408e-a598-6d1d0eb7e9f4	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 18:17:30.943591
b67537cb-1f28-4d3a-95bb-e42d5e1bee8a	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 18:17:30.94627
27c1edec-eec5-4c68-9d5e-e7e4efeec703	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 18:17:30.946847
7db368ac-56e0-4974-b6ae-cf612e194ef5	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 18:17:30.950513
e0f4e555-2128-4773-beda-43a883f54ee6	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 18:17:30.959911
9da5cca0-3012-46a3-a997-fcd9787f9791	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 18:17:30.964725
0865112a-3226-489e-904b-fbbbb7ce39fa	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 18:22:30.943766
73a401cb-c49c-404a-8c2a-7f656f605828	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 18:22:30.945678
960d4d60-bebe-4580-bd98-df7a2295f0f9	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 18:22:30.94588
816f1f6f-f49f-4e1f-8c11-86cb5f189f01	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 18:22:30.946249
9062c885-a14b-4bc1-8fc1-1e37143446aa	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 18:22:30.947739
08f0584c-c470-4691-bcb1-7090f856fef1	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 18:22:30.953387
5c3302d6-93e0-412c-b712-31a8cdefbca8	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 18:27:30.970284
c2d7d7e7-c0e6-4e40-99ea-d9a2d26cf22b	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 18:27:30.97066
6be6dfdf-0f65-4cde-9082-ee6077ded6d9	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 18:27:30.971295
6cdfcc25-d07f-4ab3-bc31-a7969598e4ef	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 18:27:30.971406
52fcbc4b-daab-4301-8f29-bafd3cfb1ab4	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 18:27:30.97219
0169f63b-b7fc-43ca-ac6a-7226b24a0554	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 18:27:30.97814
9e9162b7-5be9-43e7-a175-6eac297e47e4	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 18:32:30.992054
8c288d4b-f77e-4d22-a68e-ffc516170300	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 18:32:30.993213
c9e911f9-482e-4b99-9275-60b85706dbb5	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 18:32:30.994764
1a1ab19d-1d05-47b5-9112-6034b0f0f84f	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 18:32:30.996431
af0fba6c-cb1c-4978-b16c-aeb7f58d0e2b	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 18:32:30.997823
2735ec89-00cd-47ac-9e52-3715aba2e811	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 18:32:30.999693
9b6b0f59-2219-4691-9d64-7aeb87a97ac2	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 18:40:05.267797
d48d7be4-ba45-4078-9400-ac4321fa40d0	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 18:40:05.270264
94e5a63b-3c10-45ef-9cd8-a399c8d33718	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 18:40:05.309066
925a97cd-7f89-4ff3-bca7-c613acbe9cbb	backup:daily	skipped	MySQL not reachable — skipping backup (dev/sim mode)	2026-03-24 18:40:05.310532
e8a86c8d-cb65-4b55-80e9-5ace3210d287	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 18:40:05.313525
b112139f-4f28-4514-9220-546a1bbf43dd	billing:auto_unsuspend	success	Unsuspended 0 service(s)	2026-03-24 18:40:05.313556
ed95c7b6-6f97-485b-a87e-1e4fc7ae1ceb	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 18:40:05.313787
938cc37d-f8a3-4f31-9ee2-0235ecce95a1	billing:invoice_generation	success	Created 0 invoice(s) for 0 due service(s)	2026-03-24 18:40:05.313885
f57d8748-6c67-43e8-87fb-dac30ee76a14	domains:renewal_check	success	Renewed: 0, Reminded: 0 of 0 expiring domain(s)	2026-03-24 18:40:05.316157
a9ee8d46-283b-4582-8598-8aa05dd167be	billing:auto_suspend	success	Suspended 0 overdue service(s)	2026-03-24 18:40:05.321609
dcb6d473-9264-4dfd-9927-fc5e3160b52c	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 18:40:05.324141
e4fc051b-0b9a-4b35-b5f0-c973b3cba059	emails:invoice_reminders	success	Sent 0 invoice reminder email(s)	2026-03-24 18:40:05.326083
\.


--
-- Data for Name: currencies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.currencies (id, code, name, symbol, exchange_rate, is_default, is_active, created_at) FROM stdin;
32cf2364-6494-40ad-b798-efbc946e143a	GBP	British Pound	GBP	0.0027	f	t	2026-03-13 13:12:27.018693
6fff218c-9f9a-43d2-b128-0c6657906f0f	EUR	Euro	EUR	0.0031	f	t	2026-03-13 13:12:27.054945
f2e85bbc-6410-48fb-8505-a4cb84c01d5f	PKR	Pakistani Rupee	RS	1.0000	t	t	2026-03-13 13:12:26.473283
9dac726d-1128-4dea-a1aa-d5ce99bab491	USD	US Dollar	$	0.0036	f	t	2026-03-13 13:12:26.980248
\.


--
-- Data for Name: dns_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dns_records (id, service_id, domain, type, name, value, ttl, priority, created_at, updated_at) FROM stdin;
79fa4e63-f258-4d71-a62e-40abe1983252	29bbe0c8-52e2-4292-bd42-9063cdb77c63	wscreations.store	A	wscreations.store	176.9.63.151	3600	\N	2026-03-23 09:33:59.255664	2026-03-23 09:33:59.255664
19aa2bb3-e1d5-4c84-bfc5-ef56e1fd5604	29bbe0c8-52e2-4292-bd42-9063cdb77c63	wscreations.store	A	www.wscreations.store	176.9.63.151	3600	\N	2026-03-23 09:33:59.255664	2026-03-23 09:33:59.255664
9f73c7eb-8322-4893-93cc-19f6883a47ce	29bbe0c8-52e2-4292-bd42-9063cdb77c63	wscreations.store	MX	wscreations.store	mail.wscreations.store	3600	10	2026-03-23 09:33:59.255664	2026-03-23 09:33:59.255664
8fc96775-6504-446a-971b-5292a84e65a3	29bbe0c8-52e2-4292-bd42-9063cdb77c63	wscreations.store	TXT	wscreations.store	v=spf1 include:nexgohost.com ~all	3600	\N	2026-03-23 09:33:59.255664	2026-03-23 09:33:59.255664
\.


--
-- Data for Name: domain_extensions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.domain_extensions (id, extension, register_price, register_2_year_price, register_3_year_price, renewal_price, renew_2_year_price, renew_3_year_price, transfer_price, privacy_enabled, status, created_at, updated_at, is_free_with_hosting) FROM stdin;
6108cc52-3f75-41b5-813a-4a403c84cef4	.net	0.89	\N	\N	0.89	\N	\N	0.89	t	active	2026-03-13 13:12:49.184865	2026-03-13 13:12:49.184865	f
b96317d1-4691-4236-980c-e0733d738d58	.org	0.85	\N	\N	0.85	\N	\N	0.85	t	active	2026-03-13 13:12:49.343309	2026-03-13 13:12:49.343309	f
3c3efa3d-961b-436c-9f70-fed1b8504684	.pk	0.50	\N	\N	0.50	\N	\N	0.50	t	active	2026-03-13 13:12:49.507256	2026-03-13 13:12:49.507256	f
b8be74ca-8c2a-4982-91f4-8f46325de8be	.io	3.49	\N	\N	3.49	\N	\N	4.99	t	active	2026-03-13 13:12:49.670483	2026-03-13 13:12:49.670483	f
162f0d19-b711-407d-8b17-23e9392fcec0	.co	1.99	\N	\N	1.99	\N	\N	2.99	t	active	2026-03-13 13:12:49.828251	2026-03-13 13:12:49.828251	f
071f449a-c6cf-492b-a885-8a44445b16e2	.info	0.75	\N	\N	0.75	\N	\N	0.75	t	active	2026-03-13 13:12:49.989337	2026-03-13 13:12:49.989337	f
fd0375b2-7489-4e85-90b3-e9c1c964583e	.biz	0.80	\N	\N	0.80	\N	\N	0.80	t	active	2026-03-13 13:12:50.156572	2026-03-13 13:12:50.156572	f
00fa5a7e-5a25-4a00-8642-1b69ce47db92	.com	2000.00	5000.00	10000.00	3500.00	5000.00	7500.00	3499.98	t	active	2026-03-13 13:12:49.017717	2026-03-24 14:51:05.901	t
\.


--
-- Data for Name: domain_pricing; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.domain_pricing (id, tld, registration_price, renewal_price, transfer_price, created_at, updated_at) FROM stdin;
0974e77b-e4d5-4c63-9bb8-3c1e332c4fec	.com	12.99	14.99	9.99	2026-03-13 08:44:27.10332	2026-03-13 08:44:27.10332
822c7c1d-939d-48b3-b91e-eadbe7db040b	.net	10.99	12.99	9.99	2026-03-13 08:44:27.10332	2026-03-13 08:44:27.10332
5472b832-f189-4b2a-a511-e5ddc64c0b24	.org	10.99	12.99	9.99	2026-03-13 08:44:27.10332	2026-03-13 08:44:27.10332
9fafc6c8-4135-4ef8-a765-24443d3d946c	.io	39.99	44.99	29.99	2026-03-13 08:44:27.10332	2026-03-13 08:44:27.10332
a42a5b61-2011-44b2-8270-3b41b913cc68	.co	24.99	29.99	19.99	2026-03-13 08:44:27.10332	2026-03-13 08:44:27.10332
35198a32-d0df-499f-93c7-52928c6afcdf	.uk	8.99	10.99	7.99	2026-03-13 08:44:27.10332	2026-03-13 08:44:27.10332
\.


--
-- Data for Name: domain_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.domain_transfers (id, client_id, domain_name, epp, status, validation_message, admin_notes, price, invoice_id, order_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: domains; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.domains (id, client_id, name, tld, registrar, registration_date, expiry_date, next_due_date, status, lock_status, auto_renew, nameservers, module_server_id, transfer_id, created_at, updated_at) FROM stdin;
103182b5-3a5f-488e-a9a6-160c9962399d	907edddc-4e8b-453b-8530-8bc17d38c629	johnsmith	.com		2025-03-13 08:45:06.156655	2027-02-13 08:45:06.156655	\N	active	locked	t	{ns1.nexgohost.com,ns2.nexgohost.com}	\N	\N	2026-03-13 08:45:06.156655	2026-03-13 13:45:55.887116
f03628a5-0d65-427e-8d05-18b2a8cb48a4	907edddc-4e8b-453b-8530-8bc17d38c629	johnsmith-blog	.net		2025-09-13 08:45:06.156655	2026-09-13 08:45:06.156655	\N	active	locked	t	{ns1.nexgohost.com,ns2.nexgohost.com}	\N	\N	2026-03-13 08:45:06.156655	2026-03-13 13:45:55.887116
fa0f738e-b454-45aa-a3e9-0eb1bc6d462c	68b07e1d-5641-41e7-939b-b3b419e08c61	doedigital	.com		2024-03-13 08:45:06.156655	2027-01-13 08:45:06.156655	\N	active	locked	f	{ns1.nexgohost.com,ns2.nexgohost.com}	\N	\N	2026-03-13 08:45:06.156655	2026-03-13 13:45:55.887116
5436e08d-a947-48b2-8633-37876de108d7	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hrthrfgg	.com		2026-03-13 09:25:07.381	2028-03-13 09:25:07.381	\N	active	locked	t	{ns1.nexgohost.com,ns2.nexgohost.com}	\N	\N	2026-03-13 09:25:07.383547	2026-03-13 13:45:55.887116
435ed6d2-bea2-4c9e-98c5-449eca7b31bd	02bd192d-3426-4e90-af54-7a7ba5df0419	noehostd	.com		2026-03-14 08:46:41.519	2027-03-14 08:46:41.519	\N	active	locked	t	{ns1.nexgohost.com,ns2.nexgohost.com}	\N	\N	2026-03-14 08:46:41.521285	2026-03-14 08:46:41.521285
476dd28f-b8f0-4e75-97df-00bc3e02712f	bd2cfb49-79ca-485a-afb0-2af3ea58c813	noehosts	.com		2026-03-23 09:31:05.714	2027-03-23 09:31:05.714	\N	active	unlocked	t	{ns1.nexgohost.com,ns2.nexgohost.com}	\N	\N	2026-03-23 09:31:05.715382	2026-03-23 09:32:40.859
4b07dd27-d105-44d2-9a30-1b77bc3c362d	bd2cfb49-79ca-485a-afb0-2af3ea58c813	trtrgtrtrtrrty	.com		2026-03-24 12:38:46.432	2027-03-24 12:38:46.432	\N	pending	locked	t	{ns1.noehost.com,ns2.noehost.com}	\N	\N	2026-03-24 12:38:46.433353	2026-03-24 12:38:46.433353
\.


--
-- Data for Name: email_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_logs (id, client_id, email, email_type, subject, reference_id, status, error_message, sent_at) FROM stdin;
cdee179d-0645-4c4d-af16-6607e73cd7bf	907edddc-4e8b-453b-8530-8bc17d38c629	john@example.com	invoice_reminder_7d	Invoice INV-2025-002 due in 7 days	0ebaab51-b2f3-42fe-9054-1f7b6a1fdd21	success	\N	2026-03-13 18:48:21.630192
f0e5302d-6bd6-4ac9-a5cb-4b19a6c8570e	907edddc-4e8b-453b-8530-8bc17d38c629	john@example.com	invoice_reminder_7d	Invoice INV-20260313-LK047A due in 7 days	4f3fc23f-a15e-427b-a301-5f09900ab99b	success	\N	2026-03-13 18:48:21.974323
16c7119a-1c12-49c6-a37a-f33f23ea27b0	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ranamudassar3291@gmail.com	invoice_reminder_7d	Invoice INV-20260313-I5V1KP due in 7 days	ff1d869e-e8a4-4a4d-815c-77c8796ccad8	success	\N	2026-03-13 18:48:21.978696
5f39baf4-10d8-4c43-a268-d05534d0227f	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ranamudassar3291@gmail.com	invoice_reminder_7d	Invoice INV-20260313-LZ5GJ3 due in 7 days	b91e658b-418b-46dc-911d-7c7802e8fbbc	success	\N	2026-03-13 18:48:21.982441
1322d274-4341-4592-8d0d-f225e7875cfa	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ranamudassar3291@gmail.com	invoice_reminder_7d	Invoice INV-20260314-19IADO due in 7 days	9a8f9d32-6ca7-4212-812e-8ca90b2d5a17	success	\N	2026-03-14 05:09:57.045701
c739a326-8d06-4bd1-a1b2-bd52c4f17957	\N	wefefde@outlook.com	hosting-created	Your Hosting Account is Ready — testadmin.com	\N	failed	SMTP not configured	2026-03-14 06:01:29.99564
4b226492-ad51-4edd-9ed9-c74b82450179	\N	curltest_final2@example.com	hosting-created	Your Hosting Account is Ready — hostingmanage.com	\N	failed	SMTP not configured	2026-03-14 06:09:41.334353
258310e9-b671-403d-af6a-52d6e17716e8	\N	finaluser.e2e@example.com	hosting-created	Your Hosting Account is Ready — getyourplan.com	\N	failed	SMTP not configured	2026-03-14 06:36:11.24874
d512371f-b47a-4c27-8e7a-58f7c6ddf572	\N	3a3e3fd0-cbc8-4414-92e5-b032c4a97887	service-suspended	Service Suspended — {domain}	\N	failed	SMTP not configured	2026-03-14 07:04:35.143819
86c820ff-7f8d-4883-992c-9a90b7986a79	\N	3a3e3fd0-cbc8-4414-92e5-b032c4a97887	service-suspended	Service Suspended — {domain}	\N	failed	SMTP not configured	2026-03-14 07:05:52.890486
39e0ac08-991a-423c-ad7e-5917de19dd81	\N	96b440bb-4229-44c3-ae54-2c16784423de	service-suspended	Service Suspended — {domain}	\N	failed	SMTP not configured	2026-03-14 07:14:51.99208
e803ff6f-3ade-414e-bf4b-ebefbc05de07	\N	finaluser.e2e@example.com	service-suspended	Service Suspended — getyourplan.com	\N	failed	SMTP not configured	2026-03-14 07:24:52.731694
64929bcf-2f74-40f8-a007-13a0f802f864	\N	finaluser.e2e@example.com	service-suspended	Service Suspended — getyourplan.com	\N	failed	SMTP not configured	2026-03-14 07:26:42.36836
d054343d-cc0f-4fc8-8271-74925f899309	\N	testverify_on@test.com	email-verification	Verify Your Email Address	\N	failed	SMTP not configured	2026-03-14 08:43:29.239217
25d89529-ca3e-4679-affa-2a247140fcfe	02bd192d-3426-4e90-af54-7a7ba5df0419	ranaarsu059@gmail.com	invoice_reminder_7d	Invoice INV-2026-026 due in 7 days	3fd0c7e2-a87e-4725-8c0f-a5a838c9f28f	success	\N	2026-03-14 08:47:48.851663
3eb187d2-812b-4707-8bb6-b1faacc8fe17	\N	ranamudassar3291@gmail.com	order-created	Order Confirmed — Starter	\N	failed	SMTP not configured	2026-03-14 14:09:41.54654
8d049312-2336-473b-8917-575bf4cb902a	\N	ranamudassar3291@gmail.com	invoice-created	Invoice #INV-20260314-L5BDAJ — Nexgohost	\N	failed	SMTP not configured	2026-03-14 14:09:41.546991
66282f2c-ef41-4fd2-97a9-a51e9e001388	\N	ranamudassar3291@gmail.com	hosting-created	Your Hosting Account is Ready — ranamudassar.hosted.com	\N	failed	SMTP not configured	2026-03-14 14:11:00.337307
5b059410-70e4-4054-b4ca-e32ff39930b9	\N	ranamudassar3291@gmail.com	email-verification	Verify Your Email Address	\N	failed	SMTP not configured	2026-03-14 14:11:00.347663
ea4685f4-2067-4722-b883-6f292aaedf1f	\N	ranamudassar3291@gmail.com	hosting-created	Your Hosting Account is Ready — ranamudassar.hosted.com	\N	failed	SMTP not configured	2026-03-14 14:11:00.349788
9f6fda8d-e196-4ba6-b2da-b01d7905a101	\N	ranamudassar3291@gmail.com	invoice-paid	Payment Received — Invoice #INV-20260314-L5BDAJ	\N	failed	SMTP not configured	2026-03-14 14:11:00.354092
b2481572-e4c8-4b43-be06-ea349de66132	\N	ranamudassar3291@gmail.com	email-verification	Verify Your Email Address	\N	failed	SMTP not configured	2026-03-14 14:11:00.360245
fd47eb18-c5c8-49d1-ac69-ed3e64ea6e28	\N	ranamudassar3291@gmail.com	invoice-paid	Payment Received — Invoice #INV-20260314-L5BDAJ	\N	failed	SMTP not configured	2026-03-14 14:11:00.366179
5882dffe-a04c-4849-941a-bcb6c9cbe69b	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ranamudassar3291@gmail.com	service_suspended	Your hosting account has been suspended – Overdue Invoice	ce6babc4-ae48-4403-827b-d8c1f90df56d	success	\N	2026-03-23 08:42:54.792914
1ec9eb57-7584-4b80-be43-8c9141c57706	907edddc-4e8b-453b-8530-8bc17d38c629	john@example.com	invoice_overdue_3d	OVERDUE: Invoice INV-2025-002 – Action Required	0ebaab51-b2f3-42fe-9054-1f7b6a1fdd21	success	\N	2026-03-23 08:47:54.074941
e589d45d-3dc4-4d27-936e-e29ea7be03c6	\N	ashgeradnan19@gmail.com	invoice-created	Invoice #INV-20260323-BRCQPI — Nexgohost	\N	failed	SMTP not configured	2026-03-23 09:25:18.157679
ba67eab0-cf7a-4313-b3a4-3177a1fc9054	\N	ashgeradnan19@gmail.com	order-created	Order Confirmed — Starter	\N	failed	SMTP not configured	2026-03-23 09:25:18.158192
8874a4fb-1850-4e19-8264-403b183fb7b4	bd2cfb49-79ca-485a-afb0-2af3ea58c813	ashgeradnan19@gmail.com	invoice_reminder_7d	Invoice INV-20260323-BRCQPI due in 7 days	685f3ff4-413c-41d5-80a0-fbc1b77ab7d8	success	\N	2026-03-23 09:26:03.249377
f408c61f-51f8-4eef-9eec-72c72c27947e	\N	ashgeradnan19@gmail.com	hosting-created	Your Hosting Account is Ready — wscreations.store	\N	failed	SMTP not configured	2026-03-23 09:27:39.160871
34e7083d-e079-44fc-b30b-d13cd09b0bc0	bd2cfb49-79ca-485a-afb0-2af3ea58c813	ashgeradnan19@gmail.com	invoice_reminder_7d	Invoice INV-20260323-L9QO53 due in 7 days	6b3f48fa-1849-4544-b2fd-455df6f15fe3	success	\N	2026-03-23 09:32:54.228092
f531ba20-4a85-4b99-950e-2cf1504f3eee	907edddc-4e8b-453b-8530-8bc17d38c629	john@example.com	invoice_overdue_3d	OVERDUE: Invoice INV-20260313-LK047A – Action Required	4f3fc23f-a15e-427b-a301-5f09900ab99b	success	\N	2026-03-23 10:23:47.120055
3dbbbc77-e4f7-4d6a-ba7f-0ef05de1e3a4	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ranamudassar3291@gmail.com	invoice_overdue_3d	OVERDUE: Invoice INV-20260313-LZ5GJ3 – Action Required	b91e658b-418b-46dc-911d-7c7802e8fbbc	success	\N	2026-03-23 18:35:56.811693
08edc031-a745-4edb-b28e-04457491d7bf	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ranamudassar3291@gmail.com	invoice_overdue_3d	OVERDUE: Invoice INV-20260314-19IADO – Action Required	9a8f9d32-6ca7-4212-812e-8ca90b2d5a17	success	\N	2026-03-24 05:28:44.21792
6ae9edef-6923-4e8c-819a-f29234f4591f	68b07e1d-5641-41e7-939b-b3b419e08c61	jane@example.com	invoice_reminder_3d	Invoice INV-2025-004 due in 3 days	d36dd239-2d8f-47d7-bb25-f3bf87d5cef5	success	\N	2026-03-24 10:27:56.307025
dad02bf3-5060-4bcb-9b01-a5af9a070449	02bd192d-3426-4e90-af54-7a7ba5df0419	ranaarsu059@gmail.com	invoice_overdue_3d	OVERDUE: Invoice INV-2026-026 – Action Required	3fd0c7e2-a87e-4725-8c0f-a5a838c9f28f	success	\N	2026-03-24 10:27:56.319219
7f072ef3-f918-42f0-9066-c9dfae81c4f8	02bd192d-3426-4e90-af54-7a7ba5df0419	ranaarsu059@gmail.com	invoice_overdue_3d	OVERDUE: Invoice INV-2026-026 – Action Required	3fd0c7e2-a87e-4725-8c0f-a5a838c9f28f	success	\N	2026-03-24 10:27:56.325282
8461261b-df65-4482-8a11-d373149e4d90	\N	ashgeradnan19@gmail.com	system	Reset your Noehost password	\N	failed	SMTP not configured	2026-03-24 10:47:24.360315
cb5a23d0-5f8f-43ad-af84-1371dafcda6e	bd2cfb49-79ca-485a-afb0-2af3ea58c813	ashgeradnan19@gmail.com	invoice_reminder_7d	Invoice INV-20260324-P8OGQ6 due in 7 days	e22308c9-790f-4557-8332-862826a4dc8f	success	\N	2026-03-24 12:41:58.412701
f8481802-fceb-4ad4-91a4-c8ad4d5ca541	bd2cfb49-79ca-485a-afb0-2af3ea58c813	ashgeradnan19@gmail.com	invoice_reminder_7d	Invoice DEP-1774361861029-1 due in 7 days	67786f84-e66b-4382-b15f-a1e12795c0bd	success	\N	2026-03-24 14:17:59.386531
fd36287c-4e81-492d-a704-9ba63c240785	\N	ashgeradnan19@gmail.com	invoice-paid	Payment Confirmed — Invoice #{{invoice_id}} ✓	\N	failed	SMTP not configured	2026-03-24 14:19:06.862934
50b4cb20-a79d-4488-a248-f1ac759ad458	bd2cfb49-79ca-485a-afb0-2af3ea58c813	ashgeradnan19@gmail.com	invoice_reminder_7d	Invoice DEP-1774363028734-3 due in 7 days	4933c3aa-3628-4d24-815d-d40b8f158fc2	success	\N	2026-03-24 14:37:15.117928
\.


--
-- Data for Name: email_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_templates (id, name, slug, subject, body, variables, is_active, created_at, updated_at) FROM stdin;
4603f9f3-a649-4012-949f-4509bc7e31f5	Invoice Generated	invoice-created	Invoice #{{invoice_id}} — Payment Due {{due_date}}	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n<h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#222222;font-family:Inter,Arial,sans-serif">New Invoice Generated</h2>\n<p style="margin:0 0 14px;color:#555555">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">A new invoice has been created for your account. Please complete your payment before the due date to avoid any service interruption.</p>\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Invoice Summary</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">Invoice Number</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all">#{{invoice_id}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Amount Due</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="color:#701AFE;font-size:15px;font-weight:700">Rs. {{amount}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Due Date</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="color:#d97706;font-weight:600">{{due_date}}</span></td>\n  </tr>\n</table>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">\n  <tr>\n    <td align="center" style="background:#701AFE;border-radius:6px">\n      <a href="{{client_area_url}}" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">Pay Invoice Now</a>\n    </td>\n  </tr>\n</table>\n<p style="color:#888888;font-size:12px;margin:16px 0 0;text-align:center">Payments are accepted in PKR via bank transfer, JazzCash, EasyPaisa, and card.</p>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{invoice_id}}","{{amount}}","{{due_date}}","{{client_area_url}}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
15339ef7-32af-48f9-930d-66888ece2315	Order Confirmation	order-created	Order Confirmed — {{service_name}} is being set up	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fff4;border:1px solid #9ae6b4;border-left:4px solid #38a169;border-radius:4px;margin-bottom:24px">\n  <tr>\n    <td style="padding:16px 20px">\n      <table cellpadding="0" cellspacing="0" border="0">\n        <tr>\n          <td style="font-size:26px;padding-right:14px;vertical-align:middle">🛒</td>\n          <td style="vertical-align:middle">\n            <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#276749;font-family:Inter,Arial,sans-serif">Order Received!</p>\n            <p style="margin:0;font-size:13px;color:#555555;font-family:Inter,Arial,sans-serif">We're setting up your service now</p>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">Thank you for your order! Our team is provisioning your service. You will receive a separate email with your full login credentials once the account is activated.</p>\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Order Details</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">Order Number</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all">#{{order_id}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Service</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{service_name}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Domain</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="color:#701AFE">{{domain}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Status</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="color:#d97706;font-weight:600">&#8987; Provisioning</span></td>\n  </tr>\n</table>\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f6ff;border:1px solid #e0d9ff;border-left:4px solid #701AFE;border-radius:4px;margin:20px 0">\n  <tr>\n    <td style="padding:14px 18px;font-size:13px;color:#444444;font-family:Inter,Arial,sans-serif;line-height:1.7">\n      <strong style='color:#701AFE'>&#9889; What happens next?</strong><br>Your account is being created automatically. Expect your hosting credentials in the next few minutes. Domain propagation may take 24–48 hours after that.\n    </td>\n  </tr>\n</table>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">\n  <tr>\n    <td align="center" style="background:#701AFE;border-radius:6px">\n      <a href="https://noehost.com/client/orders" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">Track Order Status</a>\n    </td>\n  </tr>\n</table>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{service_name}}","{{domain}}","{{order_id}}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
3e2dfa6b-a4df-4ee5-9248-83d77c36e564	Domain Registration Successful	domain-registered	🎉 Congratulations! {{domain}} is now yours	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fff4;border:1px solid #9ae6b4;border-left:4px solid #38a169;border-radius:4px;margin-bottom:24px">\n  <tr>\n    <td style="padding:16px 20px">\n      <table cellpadding="0" cellspacing="0" border="0">\n        <tr>\n          <td style="font-size:26px;padding-right:14px;vertical-align:middle">🌐</td>\n          <td style="vertical-align:middle">\n            <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#276749;font-family:Inter,Arial,sans-serif">Domain Registered Successfully!</p>\n            <p style="margin:0;font-size:13px;color:#555555;font-family:Inter,Arial,sans-serif">Your domain is now active and under your control</p>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">Congratulations! Your domain <strong style="color:#701AFE">{{domain}}</strong> has been successfully registered and is now active.</p>\n\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Domain Details</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">Domain Name</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all"><strong style="color:#701AFE">{{domain}}</strong></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Registration Date</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{registration_date}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Expiry Date</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{expiry_date}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Status</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="color:#38a169;font-weight:700">&#10003; Active</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Auto-Renew</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">Enabled</td>\n  </tr>\n</table>\n\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f6ff;border:1px solid #e0d9ff;border-left:4px solid #701AFE;border-radius:4px;margin:20px 0">\n  <tr>\n    <td style="padding:14px 18px;font-size:13px;color:#444444;font-family:Inter,Arial,sans-serif;line-height:1.7">\n      <strong style='color:#701AFE'>&#128161; Next Steps</strong><br>Point your domain to your hosting by updating the nameservers in your DNS settings, or use our DNS editor to add A, CNAME, or MX records directly.\n    </td>\n  </tr>\n</table>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">\n  <tr>\n    <td align="center" style="background:#701AFE;border-radius:6px">\n      <a href="{{dns_url}}" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">Manage DNS Settings</a>\n    </td>\n  </tr>\n</table>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{domain}}","{{registration_date}}","{{expiry_date}}","{{dns_url}}"}	t	2026-03-24 11:02:16.104323	2026-03-24 11:02:16.104323
3551cbf0-7106-4b1b-a1ce-b73fb71a0a0f	Support Ticket Reply	ticket-reply	Re: [#{{ticket_number}}] {{ticket_subject}}	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n<h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#222222;font-family:Inter,Arial,sans-serif">New Reply to Your Support Ticket</h2>\n<p style="margin:0 0 14px;color:#555555">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">Our support team has responded to your ticket. Here's a summary:</p>\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Ticket Info</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">Ticket Number</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all">#{{ticket_number}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Subject</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{ticket_subject}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Department</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="color:#701AFE">{{department}}</span></td>\n  </tr>\n</table>\n<p style="margin:4px 0 8px;font-size:13px;font-weight:700;color:#701AFE;text-transform:uppercase;letter-spacing:0.8px;font-family:Inter,Arial,sans-serif">&#128172; Staff Reply</p>\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;border-left:4px solid #701AFE;border-radius:0 6px 6px 0;margin-bottom:20px">\n  <tr>\n    <td style="padding:16px 20px;color:#333333;font-size:14px;font-family:Inter,Arial,sans-serif;line-height:1.75">{{reply_body}}</td>\n  </tr>\n</table>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">\n  <tr>\n    <td align="center" style="background:#701AFE;border-radius:6px">\n      <a href="{{ticket_url}}" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">Reply to Ticket</a>\n    </td>\n  </tr>\n</table>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{ticket_number}}","{{ticket_subject}}","{{department}}","{{reply_body}}","{{ticket_url}}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
03447ca0-6bf1-47fa-a2c9-46d6af575db2	Service Terminated	service-terminated	Notice: Your service for {{domain}} has been terminated	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff7f7;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:4px;margin-bottom:24px">\n  <tr>\n    <td style="padding:16px 20px">\n      <table cellpadding="0" cellspacing="0" border="0">\n        <tr>\n          <td style="font-size:26px;padding-right:14px;vertical-align:middle">🗑️</td>\n          <td style="vertical-align:middle">\n            <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#dc2626;font-family:Inter,Arial,sans-serif">Notice: Service Terminated</p>\n            <p style="margin:0;font-size:13px;color:#555555;font-family:Inter,Arial,sans-serif">This is a permanent action — all data has been removed</p>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">We are writing to inform you that your hosting service for <strong>{{domain}}</strong> has been permanently terminated as of <strong>{{termination_date}}</strong>.</p>\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Termination Details</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">Service</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all">{{service_name}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Domain</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{domain}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Termination Date</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{termination_date}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Status</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="color:#dc2626;font-weight:700">&#10005; Terminated</span></td>\n  </tr>\n</table>\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f6ff;border:1px solid #e0d9ff;border-left:4px solid #701AFE;border-radius:4px;margin:20px 0">\n  <tr>\n    <td style="padding:14px 18px;font-size:13px;color:#444444;font-family:Inter,Arial,sans-serif;line-height:1.7">\n      <strong style='color:#dc2626'>&#9888; Important:</strong> All associated files, databases, email accounts, and configurations have been permanently deleted and cannot be recovered. If you believe this was done in error, please contact support immediately.\n    </td>\n  </tr>\n</table>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">\n  <tr>\n    <td align="center" style="background:#701AFE;border-radius:6px">\n      <a href="https://noehost.com/client/tickets/new" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">Contact Support</a>\n    </td>\n  </tr>\n</table>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{domain}}","{{service_name}}","{{termination_date}}"}	t	2026-03-24 11:02:16.104323	2026-03-24 11:02:16.104323
ab77c730-c6d7-4abd-9ad3-93551ba5bbd3	Refund Processed	refund-processed	Refund of Rs. {{refund_amount}} has been processed	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fff4;border:1px solid #9ae6b4;border-left:4px solid #38a169;border-radius:4px;margin-bottom:24px">\n  <tr>\n    <td style="padding:16px 20px">\n      <table cellpadding="0" cellspacing="0" border="0">\n        <tr>\n          <td style="font-size:26px;padding-right:14px;vertical-align:middle">💰</td>\n          <td style="vertical-align:middle">\n            <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#276749;font-family:Inter,Arial,sans-serif">Refund Processed</p>\n            <p style="margin:0;font-size:13px;color:#555555;font-family:Inter,Arial,sans-serif">Your refund is on its way</p>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">We have successfully processed your refund. Here are the details:</p>\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Refund Details</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">Refund Amount</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all"><span style="color:#38a169;font-size:15px;font-weight:700">Rs. {{refund_amount}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Related Invoice</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">#{{invoice_id}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Refund Date</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{refund_date}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Payment Method</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{payment_method}}</td>\n  </tr>\n</table>\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f6ff;border:1px solid #e0d9ff;border-left:4px solid #701AFE;border-radius:4px;margin:20px 0">\n  <tr>\n    <td style="padding:14px 18px;font-size:13px;color:#444444;font-family:Inter,Arial,sans-serif;line-height:1.7">\n      <strong>&#128336; Processing Time:</strong> Refunds typically appear in your account within 5–10 business days, depending on your bank or payment provider.\n    </td>\n  </tr>\n</table>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">\n  <tr>\n    <td align="center" style="background:#701AFE;border-radius:6px">\n      <a href="https://noehost.com/client/invoices" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">View Billing History</a>\n    </td>\n  </tr>\n</table>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{refund_amount}}","{{invoice_id}}","{{refund_date}}","{{payment_method}}"}	t	2026-03-24 11:02:16.104323	2026-03-24 11:02:16.104323
e8d9cdf2-2a58-4bb7-bd17-d2787244f35e	Welcome to Noehost	welcome	Welcome to Noehost, {{client_name}}! Your account is ready	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fff4;border:1px solid #9ae6b4;border-left:4px solid #38a169;border-radius:4px;margin-bottom:24px">\n  <tr>\n    <td style="padding:16px 20px">\n      <table cellpadding="0" cellspacing="0" border="0">\n        <tr>\n          <td style="font-size:26px;padding-right:14px;vertical-align:middle">🎉</td>\n          <td style="vertical-align:middle">\n            <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#276749;font-family:Inter,Arial,sans-serif">Welcome to Noehost!</p>\n            <p style="margin:0;font-size:13px;color:#555555;font-family:Inter,Arial,sans-serif">Your account has been created successfully</p>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>\n<p style="margin:0 0 18px;color:#333333">We're excited to have you on board. Here's what you can manage from your Noehost dashboard:</p>\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px">\n  <tr>\n    <td style="padding:10px 0;border-bottom:1px solid #f0f0f0">\n      <span style="display:inline-block;background:#f0ebff;border-radius:5px;padding:4px 10px;font-size:13px;color:#701AFE;font-weight:600;margin-right:10px">🌐</span>\n      <span style="color:#333333;font-size:14px;font-family:Inter,Arial,sans-serif">Shared, Reseller &amp; VPS Hosting</span>\n    </td>\n  </tr>\n  <tr>\n    <td style="padding:10px 0;border-bottom:1px solid #f0f0f0">\n      <span style="display:inline-block;background:#f0ebff;border-radius:5px;padding:4px 10px;font-size:13px;color:#701AFE;font-weight:600;margin-right:10px">🔒</span>\n      <span style="color:#333333;font-size:14px;font-family:Inter,Arial,sans-serif">Domain Registration &amp; DNS Management</span>\n    </td>\n  </tr>\n  <tr>\n    <td style="padding:10px 0;border-bottom:1px solid #f0f0f0">\n      <span style="display:inline-block;background:#f0ebff;border-radius:5px;padding:4px 10px;font-size:13px;color:#701AFE;font-weight:600;margin-right:10px">📄</span>\n      <span style="color:#333333;font-size:14px;font-family:Inter,Arial,sans-serif">Invoices, Payments &amp; Billing (PKR)</span>\n    </td>\n  </tr>\n  <tr>\n    <td style="padding:10px 0">\n      <span style="display:inline-block;background:#f0ebff;border-radius:5px;padding:4px 10px;font-size:13px;color:#701AFE;font-weight:600;margin-right:10px">🛡️</span>\n      <span style="color:#333333;font-size:14px;font-family:Inter,Arial,sans-serif">24/7 Expert Support via Ticket &amp; WhatsApp</span>\n    </td>\n  </tr>\n</table>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">\n  <tr>\n    <td align="center" style="background:#701AFE;border-radius:6px">\n      <a href="{{dashboard_url}}" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">Go to My Dashboard</a>\n    </td>\n  </tr>\n</table>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{dashboard_url}}"}	t	2026-03-24 11:02:16.104323	2026-03-24 11:02:16.104323
3605162a-c186-444a-aa0d-4c3dde098e7c	Shared Hosting Activated	hosting-created	🚀 Your Hosting Account is Ready — {{domain}}	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fff4;border:1px solid #9ae6b4;border-left:4px solid #38a169;border-radius:4px;margin-bottom:24px">\n  <tr>\n    <td style="padding:16px 20px">\n      <table cellpadding="0" cellspacing="0" border="0">\n        <tr>\n          <td style="font-size:26px;padding-right:14px;vertical-align:middle">🚀</td>\n          <td style="vertical-align:middle">\n            <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#276749;font-family:Inter,Arial,sans-serif">Your Shared Hosting is Live!</p>\n            <p style="margin:0;font-size:13px;color:#555555;font-family:Inter,Arial,sans-serif">Your account has been activated and is ready to use</p>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">Your hosting account for <strong>{{domain}}</strong> is fully set up. Below are your login details — please keep them safe and do not share them with anyone.</p>\n\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Control Panel Credentials</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">Domain Name</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all"><span style="color:#701AFE">{{domain}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">cPanel Username</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="font-family:'Courier New',Courier,monospace;color:#701AFE">{{username}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">cPanel Password</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="font-family:'Courier New',Courier,monospace;color:#701AFE">{{password}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">cPanel URL</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><a href="{{cpanel_url}}" style="color:#701AFE;text-decoration:none">{{cpanel_url}}</a></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Webmail URL</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><a href="{{webmail_url}}" style="color:#701AFE;text-decoration:none">{{webmail_url}}</a></td>\n  </tr>\n</table>\n\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Nameservers (Update at Your Domain Registrar)</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">Primary NS</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all"><span style="font-family:'Courier New',Courier,monospace;color:#701AFE">{{ns1}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Secondary NS</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="font-family:'Courier New',Courier,monospace;color:#701AFE">{{ns2}}</span></td>\n  </tr>\n</table>\n\n<p style="margin:0 0 4px;color:#555555;font-size:13px">&#9432; DNS propagation can take 24–48 hours. Your website will go live once propagation is complete.</p>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">\n  <tr>\n    <td align="center" style="background:#701AFE;border-radius:6px">\n      <a href="{{cpanel_url}}" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">Login to cPanel</a>\n    </td>\n  </tr>\n</table>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:10px auto 4px">\n  <tr>\n    <td align="center" style="background:#ffffff;border-radius:6px;border:2px solid #701AFE">\n      <a href="https://noehost.com/client/hosting" style="display:inline-block;padding:12px 36px;color:#701AFE;font-size:14px;font-weight:600;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">Manage Hosting</a>\n    </td>\n  </tr>\n</table>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{domain}}","{{username}}","{{password}}","{{cpanel_url}}","{{ns1}}","{{ns2}}","{{webmail_url}}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
a44aef3a-a7dc-4cd4-8c56-13092f373c33	Service Suspended	service-suspended	URGENT: Your service for {{domain}} has been suspended	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #d97706;border-radius:4px;margin-bottom:24px">\n  <tr>\n    <td style="padding:16px 20px">\n      <table cellpadding="0" cellspacing="0" border="0">\n        <tr>\n          <td style="font-size:26px;padding-right:14px;vertical-align:middle">⚠️</td>\n          <td style="vertical-align:middle">\n            <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#d97706;font-family:Inter,Arial,sans-serif">Urgent: Service Suspended</p>\n            <p style="margin:0;font-size:13px;color:#555555;font-family:Inter,Arial,sans-serif">Action is required to restore your service</p>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">Your hosting service for <strong>{{domain}}</strong> has been temporarily suspended. Your data remains intact and will be restored immediately once the issue is resolved.</p>\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Suspension Details</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">Domain</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all">{{domain}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Reason</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="color:#d97706;font-weight:600">{{reason}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Status</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="color:#d97706;font-weight:700">&#9888; Suspended</span></td>\n  </tr>\n</table>\n<p style="margin:4px 0 16px;color:#333333"><strong>To reactivate your service:</strong> please pay any outstanding invoices or contact our support team to resolve the issue.</p>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">\n  <tr>\n    <td align="center" style="background:#701AFE;border-radius:6px">\n      <a href="{{client_area_url}}" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">Reactivate My Service</a>\n    </td>\n  </tr>\n</table>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{domain}}","{{reason}}","{{client_area_url}}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
e36c959d-f3cc-464d-9829-5db2ef125441	Cancellation Confirmation	service-cancelled	Cancellation Confirmed — {{service_name}}	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n<h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#222222;font-family:Inter,Arial,sans-serif">Cancellation Confirmed</h2>\n<p style="margin:0 0 14px;color:#555555">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">We've processed your cancellation request. We're sorry to see you go — if there's anything we could have done better, please let us know.</p>\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Cancellation Details</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">Service</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all">{{service_name}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Domain</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{domain}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Cancellation Date</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{cancel_date}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Status</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="color:#555555;font-weight:600">&#10003; Cancellation Confirmed</span></td>\n  </tr>\n</table>\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f6ff;border:1px solid #e0d9ff;border-left:4px solid #701AFE;border-radius:4px;margin:20px 0">\n  <tr>\n    <td style="padding:14px 18px;font-size:13px;color:#444444;font-family:Inter,Arial,sans-serif;line-height:1.7">\n      <strong style='color:#701AFE'>You're always welcome back!</strong><br>If you change your mind, you can place a new order anytime from your client area. We'd love to serve you again.\n    </td>\n  </tr>\n</table>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">\n  <tr>\n    <td align="center" style="background:#701AFE;border-radius:6px">\n      <a href="https://noehost.com/client/new-order" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">Explore New Plans</a>\n    </td>\n  </tr>\n</table>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{domain}}","{{service_name}}","{{cancel_date}}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
0bcc9e24-02b4-4669-af09-926c70ca0f61	Email Verification	email-verification	Verify your Noehost account	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n<h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#222222;font-family:Inter,Arial,sans-serif">Verify your email address</h2>\n<p style="margin:0 0 16px;color:#555555">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">Thanks for signing up with Noehost! Please use the verification code below to complete your registration. This code expires in <strong>10 minutes</strong>.</p>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto">\n  <tr>\n    <td align="center" style="background:#f8f6ff;border:2px solid #701AFE;border-radius:8px;padding:18px 52px">\n      <p style="margin:0 0 5px;font-size:11px;font-weight:700;color:#701AFE;text-transform:uppercase;letter-spacing:2px;font-family:Inter,Arial,sans-serif">Your Verification Code</p>\n      <p style="margin:0;font-size:40px;font-weight:700;letter-spacing:10px;color:#222222;font-family:'Courier New',Courier,monospace">{{verification_code}}</p>\n    </td>\n  </tr>\n</table>\n<p style="color:#888888;font-size:13px;margin:20px 0 0">If you did not create a Noehost account, you can safely ignore this email.</p>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{verification_code}}"}	t	2026-03-14 05:33:30.198596	2026-03-14 05:33:30.198596
f0d6cc1e-0ab7-47a0-9d84-7498e0d8a6ab	Payment Confirmation	invoice-paid	Payment Confirmed — Invoice #{{invoice_id}} ✓	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fff4;border:1px solid #9ae6b4;border-left:4px solid #38a169;border-radius:4px;margin-bottom:24px">\n  <tr>\n    <td style="padding:16px 20px">\n      <table cellpadding="0" cellspacing="0" border="0">\n        <tr>\n          <td style="font-size:26px;padding-right:14px;vertical-align:middle">✅</td>\n          <td style="vertical-align:middle">\n            <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#276749;font-family:Inter,Arial,sans-serif">Payment Received</p>\n            <p style="margin:0;font-size:13px;color:#555555;font-family:Inter,Arial,sans-serif">Your invoice has been paid successfully</p>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">We have successfully received your payment. Here is your receipt for your records:</p>\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Payment Receipt</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">Invoice Number</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all">#{{invoice_id}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Amount Paid</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="color:#38a169;font-size:15px;font-weight:700">Rs. {{amount}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Payment Date</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{payment_date}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Status</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="color:#38a169;font-weight:700">&#10003; Paid</span></td>\n  </tr>\n</table>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:10px auto 4px">\n  <tr>\n    <td align="center" style="background:#ffffff;border-radius:6px;border:2px solid #701AFE">\n      <a href="https://noehost.com/client/invoices" style="display:inline-block;padding:12px 36px;color:#701AFE;font-size:14px;font-weight:600;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">Download Receipt</a>\n    </td>\n  </tr>\n</table>\n<p style="color:#888888;font-size:13px;margin:20px 0 0;text-align:center">Your services are now active. Thank you for choosing Noehost!</p>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{invoice_id}}","{{amount}}","{{payment_date}}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
8ab03259-62f1-466f-b623-7b0d3c933290	VPS Server Activated	vps-created	🖥️ Your VPS Server is Online — {{server_hostname}}	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fff4;border:1px solid #9ae6b4;border-left:4px solid #38a169;border-radius:4px;margin-bottom:24px">\n  <tr>\n    <td style="padding:16px 20px">\n      <table cellpadding="0" cellspacing="0" border="0">\n        <tr>\n          <td style="font-size:26px;padding-right:14px;vertical-align:middle">🖥️</td>\n          <td style="vertical-align:middle">\n            <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#276749;font-family:Inter,Arial,sans-serif">VPS Server is Online!</p>\n            <p style="margin:0;font-size:13px;color:#555555;font-family:Inter,Arial,sans-serif">Your dedicated server has been provisioned</p>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">Your VPS server has been provisioned and is now online. Below are your server credentials. Keep these details secure — do not share them with anyone.</p>\n\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Server Access Details</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">Dedicated IP Address</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all"><span style="font-family:'Courier New',Courier,monospace;color:#701AFE">{{server_ip}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">SSH Port</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="font-family:'Courier New',Courier,monospace;color:#701AFE">{{ssh_port}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Root Username</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="font-family:'Courier New',Courier,monospace;color:#701AFE">root</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Root Password</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="font-family:'Courier New',Courier,monospace;color:#701AFE">{{root_password}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Hostname</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="font-family:'Courier New',monospace;color:#701AFE">{{server_hostname}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Operating System</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{os}}</td>\n  </tr>\n</table>\n\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Server Resources</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">CPU Cores</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all">{{cpu_cores}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">RAM</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{ram}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Disk Space (SSD)</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{disk_space}}</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Monthly Bandwidth</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{bandwidth}}</td>\n  </tr>\n</table>\n\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f6ff;border:1px solid #e0d9ff;border-left:4px solid #701AFE;border-radius:4px;margin:20px 0">\n  <tr>\n    <td style="padding:14px 18px;font-size:13px;color:#444444;font-family:Inter,Arial,sans-serif;line-height:1.7">\n      <strong style='color:#701AFE'>&#128295; How to connect to your VPS:</strong><br>\n<strong>Linux/Mac:</strong> Open Terminal and run:<br>\n<code style="font-family:'Courier New',monospace;background:#f0ebff;padding:2px 6px;border-radius:3px;font-size:13px">ssh root@{{server_ip}} -p {{ssh_port}}</code><br><br>\n<strong>Windows:</strong> Use <a href="https://www.putty.org" style="color:#701AFE;text-decoration:none">PuTTY</a> with IP <code style="font-family:'Courier New',monospace">{{server_ip}}</code> and port <code style="font-family:'Courier New',monospace">{{ssh_port}}</code>.<br><br>\n<strong>Reboot/Console:</strong> Log into your client area to access the VPS console, reboot, or reinstall the OS.\n    </td>\n  </tr>\n</table>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">\n  <tr>\n    <td align="center" style="background:#701AFE;border-radius:6px">\n      <a href="{{vps_panel_url}}" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">Manage VPS</a>\n    </td>\n  </tr>\n</table>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{server_ip}}","{{ssh_port}}","{{root_password}}","{{server_hostname}}","{{os}}","{{cpu_cores}}","{{ram}}","{{disk_space}}","{{bandwidth}}","{{vps_panel_url}}"}	t	2026-03-24 11:13:14.715351	2026-03-24 11:13:14.715351
3500cbad-26ce-45e0-a3c4-659d74ff380c	WordPress Installation Successful	wordpress-installed	✅ WordPress Installed on {{domain}} — Ready to Go!	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fff4;border:1px solid #9ae6b4;border-left:4px solid #38a169;border-radius:4px;margin-bottom:24px">\n  <tr>\n    <td style="padding:16px 20px">\n      <table cellpadding="0" cellspacing="0" border="0">\n        <tr>\n          <td style="font-size:26px;padding-right:14px;vertical-align:middle">📝</td>\n          <td style="vertical-align:middle">\n            <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#276749;font-family:Inter,Arial,sans-serif">WordPress is Installed!</p>\n            <p style="margin:0;font-size:13px;color:#555555;font-family:Inter,Arial,sans-serif">Your site is live and ready to customize</p>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">WordPress has been successfully installed on your domain <strong style="color:#701AFE">{{domain}}</strong>. You can now log into your WordPress dashboard and start building your website.</p>\n\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">WordPress Site Details</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">Site URL</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all"><a href="{{site_url}}" style="color:#701AFE;text-decoration:none">{{site_url}}</a></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">WP Admin URL</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><a href="{{wp_admin_url}}" style="color:#701AFE;text-decoration:none">{{wp_admin_url}}</a></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Admin Username</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="font-family:'Courier New',Courier,monospace;color:#701AFE">{{wp_username}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Admin Password</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="font-family:'Courier New',Courier,monospace;color:#701AFE">{{wp_password}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">WordPress Version</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all">{{wp_version}}</td>\n  </tr>\n</table>\n\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f6ff;border:1px solid #e0d9ff;border-left:4px solid #701AFE;border-radius:4px;margin:20px 0">\n  <tr>\n    <td style="padding:14px 18px;font-size:13px;color:#444444;font-family:Inter,Arial,sans-serif;line-height:1.7">\n      <strong style='color:#701AFE'>&#128161; Getting Started Tips:</strong><br>\n1. Log into your admin panel and change your password immediately<br>\n2. Go to <strong>Appearance → Themes</strong> to install a theme<br>\n3. Install essential plugins: Yoast SEO, WooCommerce, Wordfence Security<br>\n4. Go to <strong>Settings → General</strong> to configure your site title and tagline\n    </td>\n  </tr>\n</table>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">\n  <tr>\n    <td align="center" style="background:#701AFE;border-radius:6px">\n      <a href="{{site_url}}" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">View My Website</a>\n    </td>\n  </tr>\n</table>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:10px auto 4px">\n  <tr>\n    <td align="center" style="background:#ffffff;border-radius:6px;border:2px solid #701AFE">\n      <a href="{{wp_admin_url}}" style="display:inline-block;padding:12px 36px;color:#701AFE;font-size:14px;font-weight:600;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">Go to WP Admin</a>\n    </td>\n  </tr>\n</table>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{domain}}","{{site_url}}","{{wp_admin_url}}","{{wp_username}}","{{wp_password}}","{{wp_version}}"}	t	2026-03-24 11:13:14.715351	2026-03-24 11:13:14.715351
83ca2f4f-aba0-44f6-bcb7-316b14723077	Password Reset	password-reset	Reset your Noehost password	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n<h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#222222;font-family:Inter,Arial,sans-serif">Reset Your Password</h2>\n<p style="margin:0 0 14px;color:#555555">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">We received a request to reset the password for your Noehost account. Click the button below to create a new password. This link expires in <strong>1 hour</strong>.</p>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">\n  <tr>\n    <td align="center" style="background:#701AFE;border-radius:6px">\n      <a href="{{reset_link}}" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">Reset My Password</a>\n    </td>\n  </tr>\n</table>\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f6ff;border:1px solid #e0d9ff;border-left:4px solid #701AFE;border-radius:4px;margin:20px 0">\n  <tr>\n    <td style="padding:14px 18px;font-size:13px;color:#444444;font-family:Inter,Arial,sans-serif;line-height:1.7">\n      <strong>Button not working?</strong> Copy and paste this link into your browser:<br><a href="{{reset_link}}" style="color:#701AFE;text-decoration:none;word-break:break-all;font-size:12px">{{reset_link}}</a>\n    </td>\n  </tr>\n</table>\n<p style="color:#e53e3e;font-size:13px;margin:16px 0 0">&#9888; If you did not request a password reset, please ignore this email. Your password will not be changed.</p>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{reset_link}}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
24d0891a-c9a4-486d-8312-ddc5fb5d1b10	Reseller Hosting Activated	reseller-hosting-created	🚀 Your Reseller Hosting Account is Ready — {{domain}}	<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Noehost</title>\n</head>\n<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:36px 16px">\n  <tr>\n    <td align="center">\n      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e5e5">\n\n        <!-- ───── HEADER: white bg, centered logo ───── -->\n        <tr>\n          <td style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:3px solid #701AFE">\n            <span style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#701AFE;letter-spacing:-0.5px">Noehost</span>\n          </td>\n        </tr>\n\n        <!-- ───── BODY ───── -->\n        <tr>\n          <td style="padding:36px 40px 28px;color:#333333;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75">\n            \n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fff4;border:1px solid #9ae6b4;border-left:4px solid #38a169;border-radius:4px;margin-bottom:24px">\n  <tr>\n    <td style="padding:16px 20px">\n      <table cellpadding="0" cellspacing="0" border="0">\n        <tr>\n          <td style="font-size:26px;padding-right:14px;vertical-align:middle">🏢</td>\n          <td style="vertical-align:middle">\n            <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#276749;font-family:Inter,Arial,sans-serif">Reseller Hosting Account Live!</p>\n            <p style="margin:0;font-size:13px;color:#555555;font-family:Inter,Arial,sans-serif">Your WHM control panel is ready to use</p>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>\n<p style="margin:0 0 14px;color:#333333">Hi {{client_name}},</p>\n<p style="margin:0 0 4px;color:#333333">Your Reseller Hosting account has been provisioned. You now have full WHM access to create and manage hosting accounts for your clients.</p>\n\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">WHM Login Details</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">WHM Username</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all"><span style="font-family:'Courier New',Courier,monospace;color:#701AFE">{{username}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">WHM Password</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="font-family:'Courier New',Courier,monospace;color:#701AFE">{{password}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">WHM URL</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><a href="{{whm_url}}" style="color:#701AFE;text-decoration:none">{{whm_url}}</a></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">cPanel URL</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><a href="{{cpanel_url}}" style="color:#701AFE;text-decoration:none">{{cpanel_url}}</a></td>\n  </tr>\n</table>\n\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Account Resources</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">Max Accounts</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all"><strong>{{max_accounts}}</strong> hosting accounts</td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Disk Space</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><strong>{{disk_space}}</strong></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">Bandwidth</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><strong>{{bandwidth}}</strong></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">IP Address</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="font-family:'Courier New',monospace;color:#701AFE">{{server_ip}}</span></td>\n  </tr>\n</table>\n\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0d9ff;border-radius:6px;overflow:hidden;margin:20px 0">\n  <tr>\n    <td colspan="2" style="background:#701AFE;padding:10px 18px">\n      <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;font-family:Inter,Arial,sans-serif">Nameservers (Point your clients' domains here)</span>\n    </td>\n  </tr>\n  \n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;;width:40%">NS1</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;;text-align:right;word-break:break-all"><span style="font-family:'Courier New',Courier,monospace;color:#701AFE">{{ns1}}</span></td>\n  </tr>\n  <tr>\n    <td style="padding:11px 18px;font-size:13px;color:#666666;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;width:40%">NS2</td>\n    <td style="padding:11px 18px;font-size:13px;font-weight:600;color:#222222;font-family:Inter,Arial,sans-serif;border-top:1px solid #eeeeee;text-align:right;word-break:break-all"><span style="font-family:'Courier New',Courier,monospace;color:#701AFE">{{ns2}}</span></td>\n  </tr>\n</table>\n\n\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f6ff;border:1px solid #e0d9ff;border-left:4px solid #701AFE;border-radius:4px;margin:20px 0">\n  <tr>\n    <td style="padding:14px 18px;font-size:13px;color:#444444;font-family:Inter,Arial,sans-serif;line-height:1.7">\n      <strong style='color:#701AFE'>&#128161; How to create your first client account:</strong><br>\n1. Log into WHM at <a href="{{whm_url}}" style="color:#701AFE;text-decoration:none">{{whm_url}}</a><br>\n2. Go to <strong>Account Functions → Create a New Account</strong><br>\n3. Fill in the domain, username, and password for your client<br>\n4. Assign a hosting package and click <strong>Create</strong><br>\nYour client will receive their cPanel credentials automatically.\n    </td>\n  </tr>\n</table>\n\n<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px">\n  <tr>\n    <td align="center" style="background:#701AFE;border-radius:6px">\n      <a href="{{whm_url}}" style="display:inline-block;padding:15px 44px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px">Login to WHM</a>\n    </td>\n  </tr>\n</table>\n\n          </td>\n        </tr>\n\n        <!-- ───── QUICK SUPPORT ───── -->\n        <tr>\n          <td style="background:#faf8ff;border-top:1px solid #ede9ff;padding:20px 40px">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#555555;padding-bottom:10px">\n                  &#128587; Quick Support\n                </td>\n              </tr>\n              <tr>\n                <td>\n                  <table cellpadding="0" cellspacing="0" border="0">\n                    <tr>\n                      <td style="padding-right:12px">\n                        <a href="https://wa.me/923001234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#128222; WhatsApp\n                        </a>\n                      </td>\n                      <td>\n                        <a href="https://noehost.com/client/tickets/new" style="display:inline-block;background:#701AFE;color:#ffffff;text-decoration:none;padding:8px 18px;border-radius:5px;font-size:13px;font-weight:600;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif">\n                          &#127915; Open a Ticket\n                        </a>\n                      </td>\n                    </tr>\n                  </table>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n        <!-- ───── FOOTER ───── -->\n        <tr>\n          <td style="background:#f8f8f8;border-top:1px solid #e5e5e5;padding:24px 40px;text-align:center">\n            <table width="100%" cellpadding="0" cellspacing="0" border="0">\n              <tr>\n                <td align="center" style="padding-bottom:14px">\n                  <a href="https://twitter.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:13px;font-weight:700">X</a>\n                  <a href="https://facebook.com/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:14px;font-weight:700">f</a>\n                  <a href="https://linkedin.com/company/noehost" style="display:inline-block;margin:0 4px;width:30px;height:30px;background:#701AFE;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;color:#ffffff;font-family:Arial;font-size:11px;font-weight:700">in</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center" style="padding-bottom:8px">\n                  <a href="https://noehost.com/kb" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Knowledge Base</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/client/tickets" style="color:#701AFE;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;font-weight:500">Support</a>\n                  <span style="color:#cccccc;margin:0 8px">&middot;</span>\n                  <a href="https://noehost.com/unsubscribe" style="color:#999999;text-decoration:underline;font-size:12px;font-family:Inter,Arial,sans-serif">Unsubscribe</a>\n                </td>\n              </tr>\n              <tr>\n                <td align="center">\n                  <span style="color:#aaaaaa;font-size:12px;font-family:Inter,Arial,sans-serif">&copy; 2026 Noehost. All rights reserved.</span>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n\n      </table>\n    </td>\n  </tr>\n</table>\n</body>\n</html>	{"{{client_name}}","{{username}}","{{password}}","{{whm_url}}","{{cpanel_url}}","{{max_accounts}}","{{disk_space}}","{{bandwidth}}","{{server_ip}}","{{ns1}}","{{ns2}}"}	t	2026-03-24 11:13:14.715351	2026-03-24 11:13:14.715351
\.


--
-- Data for Name: fraud_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fraud_logs (id, order_id, client_id, ip_address, email, risk_score, reasons, status, created_at, reviewed_at) FROM stdin;
\.


--
-- Data for Name: hosting_backups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.hosting_backups (id, service_id, client_id, domain, file_path, sql_path, size_mb, status, error_message, type, created_at, completed_at) FROM stdin;
e776c47f-f344-4295-a712-705516d69b72	29bbe0c8-52e2-4292-bd42-9063cdb77c63	bd2cfb49-79ca-485a-afb0-2af3ea58c813	wscreations.store	/backups/wscreations.store_files_1774287645768.tar.gz (simulated)	/backups/wscreations.store_db_1774287645768.sql (simulated)	12.50	completed	\N	manual	2026-03-23 17:40:45.763903	2026-03-23 17:40:48.77
\.


--
-- Data for Name: hosting_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.hosting_plans (id, name, description, price, yearly_price, quarterly_price, semiannual_price, billing_cycle, group_id, module, module_server_id, module_server_group_id, module_plan_id, module_plan_name, disk_space, bandwidth, email_accounts, databases, subdomains, ftp_accounts, is_active, features, renewal_enabled, renewal_price, free_domain_enabled, free_domain_tlds, created_at, save_amount) FROM stdin;
ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	Perfect for personal websites and blogs	270.00	3045.00	710.00	1500.00	monthly	e1deef82-2be7-463f-a33e-9d92134ed229	cpanel	f008355f-1383-4d29-9606-18dda5476801	\N	noehoster_Starter	noehoster_Starter	90 GB	Unlimited	10	5	5	5	t	{"Free SSL","cPanel Access","24/7 Support","1-Click WordPress","1 Free .com domain","Host 3 Websites","Free Site Migration Tool"}	t	4500.00	t	{.com,.uk}	2026-03-13 08:44:27.10332	300.00
da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Geek	Great for small to medium businesses	450.00	3899.99	1250.00	2000.00	monthly	e1deef82-2be7-463f-a33e-9d92134ed229	cpanel	f008355f-1383-4d29-9606-18dda5476801	\N	noehoster_Geek	noehoster_Geek	150 GB	unlimited	20	10	25	20	t	{"Free SSL","cPanel Access","24/7 Support","1-Click Apps","Daily Backups","Free Domain","10 Website Host"}	t	5500.00	t	{.com,.org,.uk}	2026-03-13 08:44:27.10332	600.00
7a8c5de2-98b9-497e-997e-5e9425219c65	Pro	For high-traffic websites and agencies	650.00	6499.99	1850.00	3500.00	monthly	e1deef82-2be7-463f-a33e-9d92134ed229	cpanel	f008355f-1383-4d29-9606-18dda5476801	\N	noehoster_Pro	noehoster_Pro	Unlimited 	Unlimited	10	5	10	5	t	{"Free SSL","cPanel Access","24/7 Support","1-Click Apps","Daily Backups","Free Domain","Priority Support","Staging Environment","Unlimited  website Host","Free WordPress Includes","Nods Js & Python Support","SSH Access Support"}	t	6500.00	t	{.com,.net,.org,.uk}	2026-03-13 08:44:27.10332	1499.99
\.


--
-- Data for Name: hosting_services; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.hosting_services (id, client_id, order_id, plan_id, plan_name, domain, username, password, server_id, server_ip, status, billing_cycle, next_due_date, ssl_status, start_date, expiry_date, disk_used, bandwidth_used, cpanel_url, webmail_url, cancel_requested, cancel_reason, cancel_requested_at, auto_renew, wp_installed, wp_url, wp_username, wp_password, wp_email, wp_site_title, wp_db_name, wp_container_id, wp_port, wp_provision_status, wp_provision_step, wp_provision_error, wp_provisioned_at, wp_install_path, wp_password_revealed, created_at, updated_at, free_domain_available, service_type, vps_plan_id, vps_os_template, vps_location) FROM stdin;
cf33bf32-199e-4851-90bc-b0962321e998	907edddc-4e8b-453b-8530-8bc17d38c629	\N	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Business	johnsmith.com	johnsmith	\N	\N	192.168.10.1	active	monthly	\N	not_installed	2025-09-13 08:45:06.156655	2026-09-13 08:45:06.156655	12.5 GB	45 GB	https://cpanel.nexgohost.com	\N	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-13 08:45:06.156655	2026-03-13 08:45:06.156655	f	shared	\N	\N	\N
d36623cd-9ec6-4265-a0eb-6104f8385c41	68b07e1d-5641-41e7-939b-b3b419e08c61	\N	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Pro	doedigital.com	doedigital	\N	\N	192.168.10.2	active	monthly	\N	not_installed	2025-12-13 08:45:06.156655	2026-12-13 08:45:06.156655	35.2 GB	120 GB	https://cpanel.nexgohost.com	\N	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-13 08:45:06.156655	2026-03-13 08:45:06.156655	f	shared	\N	\N	\N
b4899c23-80b4-49d6-8ddc-1011f00388b2	907edddc-4e8b-453b-8530-8bc17d38c629	\N	7260ddb5-3612-441e-a3e0-830194435115	Testing	john.smith.hosted.com	johnsmit	2B46ReT4BDGnEF	\N	192.168.1.1	active	monthly	2026-04-13 18:10:53.82	not_installed	2026-03-13 18:10:53.644213	\N	0 MB	0 GB	https://192.168.1.1:2083	https://192.168.1.1/webmail	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-13 18:10:53.644213	2026-03-13 18:10:53.82	f	shared	\N	\N	\N
f5c9062f-9462-4a5d-a267-04fe139f3fd3	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	\N	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	\N	\N	\N	\N	192.168.1.1	pending	yearly	2027-03-13 18:34:50.124	not_installed	2026-03-13 18:34:50.125098	\N	0 MB	0 GB	\N	\N	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-13 18:34:50.125098	2026-03-13 18:34:50.125098	f	shared	\N	\N	\N
46af47e8-3f56-4b9b-8f2d-46848185ba61	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	\N	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	\N	\N	\N	\N	192.168.1.1	active	monthly	2026-04-13 18:35:21.564	not_installed	2026-03-13 18:35:21.565086	\N	0 MB	0 GB	\N	\N	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-13 18:35:21.565086	2026-03-13 18:35:21.565086	f	shared	\N	\N	\N
b2133b6f-4158-4e9b-9bd0-670dedf36875	cb3dfdec-2026-4569-a860-e56400f4ebb9	\N	7260ddb5-3612-441e-a3e0-830194435115	Testing	testbest.hosted.com	noeuser	Noe1438@@	f008355f-1383-4d29-9606-18dda5476801	176.9.63.151	active	monthly	2026-04-13 18:38:44.21	not_installed	2026-03-13 18:38:43.293228	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2087	https://spg1.cloudpowerdns.com/webmail	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-13 18:38:43.293228	2026-03-13 18:38:44.21	f	shared	\N	\N	\N
e946b560-8c97-42db-89ac-0ec7f58b9ce3	96b440bb-4229-44c3-ae54-2c16784423de	\N	7260ddb5-3612-441e-a3e0-830194435115	Testing	finaluser.hosted.com	user	PhfHetwhq2hzV2	f008355f-1383-4d29-9606-18dda5476801	176.9.63.151	active	monthly	2026-04-13 18:39:47.316	not_installed	2026-03-13 18:39:46.435033	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2087	https://spg1.cloudpowerdns.com/webmail	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-13 18:39:46.435033	2026-03-13 18:39:47.316	f	shared	\N	\N	\N
895f7eb9-c40e-40cf-b21d-4beaef8060c8	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	\N	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testingcpanel.com	testingc	Noe1438@@	f008355f-1383-4d29-9606-18dda5476801	176.9.63.151	active	yearly	2027-03-13 19:10:15.755	not_installed	2026-03-13 19:10:14.89572	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2087	https://spg1.cloudpowerdns.com/webmail	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-13 19:10:14.89572	2026-03-13 19:10:15.755	f	shared	\N	\N	\N
aacdaa33-3af8-4622-a0d8-f948d0afd519	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	\N	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testingcpanel.com	\N	\N	f008355f-1383-4d29-9606-18dda5476801	192.168.1.1	active	yearly	2026-04-13 00:00:00	not_installed	2026-03-13 19:10:55.99131	\N	0 MB	0 GB	\N	\N	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-13 19:10:55.99131	2026-03-13 19:10:55.99131	f	shared	\N	\N	\N
2a356bc2-0397-4fc4-a34b-9654fd286371	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	\N	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testingcpanel.com	\N	\N	f008355f-1383-4d29-9606-18dda5476801	192.168.1.1	active	yearly	2026-04-13 00:00:00	not_installed	2026-03-13 19:11:09.974589	\N	0 MB	0 GB	\N	\N	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-13 19:11:09.974589	2026-03-13 19:11:09.974589	f	shared	\N	\N	\N
a8a0d82c-f838-4554-8192-27ba0b3acc17	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	\N	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testingcpanel.com	\N	\N	f008355f-1383-4d29-9606-18dda5476801	192.168.1.1	active	yearly	2026-04-13 00:00:00	not_installed	2026-03-13 19:12:36.846877	\N	0 MB	0 GB	\N	\N	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-13 19:12:36.846877	2026-03-13 19:12:36.846877	f	shared	\N	\N	\N
99177934-e69b-4aff-b6a9-a06a93d85c0e	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	\N	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testingcpanel.com	\N	\N	f008355f-1383-4d29-9606-18dda5476801	192.168.1.1	active	yearly	2026-04-13 00:00:00	not_installed	2026-03-13 19:12:46.954403	\N	0 MB	0 GB	\N	\N	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-13 19:12:46.954403	2026-03-13 19:12:46.954403	f	shared	\N	\N	\N
4a689279-8c80-4e28-9c06-6f8e511e44c7	02bd192d-3426-4e90-af54-7a7ba5df0419	\N	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	nexgohostss.com	testings	9T@v%pjSMfuP#$	f008355f-1383-4d29-9606-18dda5476801	176.9.63.151	active	monthly	2026-04-14 05:47:40.235	not_installed	2026-03-14 05:29:51.619701	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2083	https://spg1.cloudpowerdns.com:2096	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-14 05:29:51.619701	2026-03-14 05:47:40.235	f	shared	\N	\N	\N
647784a1-2a57-464f-b205-0ebbddad56f2	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	\N	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	rana.mudassar.hosted.com	ranamuda	7H3qvAmCTrDn4m	\N	192.168.1.1	terminated	monthly	2026-04-13 15:48:12.801	not_installed	2026-03-13 14:59:34.521422	\N	0 MB	0 GB	https://192.168.1.1:2083	https://192.168.1.1/webmail	f	krdo	2026-03-13 19:19:45.225	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-13 14:59:34.521422	2026-03-13 19:19:58.013	f	shared	\N	\N	\N
3f082d67-5418-4052-b7ae-0d6796429cc5	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	\N	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	\N	\N	\N	\N	192.168.1.1	pending	monthly	2026-04-14 05:09:54.156	not_installed	2026-03-14 05:09:54.157307	\N	0 MB	0 GB	\N	\N	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-14 05:09:54.157307	2026-03-14 05:09:54.157307	f	shared	\N	\N	\N
947c0e4d-5c52-458b-8171-38e71c151819	cb3dfdec-2026-4569-a860-e56400f4ebb9	\N	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testadmin.com	testadmi	bnyXNKjTRrbP7R	f008355f-1383-4d29-9606-18dda5476801	176.9.63.151	active	yearly	2027-03-14 06:01:29.99	not_installed	2026-03-14 06:01:28.47323	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2083	https://spg1.cloudpowerdns.com:2096	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-14 06:01:28.47323	2026-03-14 06:01:29.99	f	shared	\N	\N	\N
04a5a891-39dc-46b5-8039-a43709a5188c	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	\N	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	ranamudassar.hosted.com	ranamuda	GXxYM!ZKxd7G!@	f008355f-1383-4d29-9606-18dda5476801	176.9.63.151	active	yearly	2027-03-14 14:11:00.342	not_installed	2026-03-14 14:09:41.499598	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2083	https://spg1.cloudpowerdns.com:2096	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-14 14:09:41.499598	2026-03-14 14:11:00.342	f	shared	\N	\N	\N
4ccade11-1a40-4031-8482-6949b47cca2e	96b440bb-4229-44c3-ae54-2c16784423de	\N	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	getyourplan.com	getyourp	Uq6usYr59ArQqq	f008355f-1383-4d29-9606-18dda5476801	176.9.63.151	active	monthly	2026-04-14 06:36:11.231	failed	2026-03-14 06:35:08.211241	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2083	https://spg1.cloudpowerdns.com:2096	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-14 06:35:08.211241	2026-03-14 07:27:43.826	f	shared	\N	\N	\N
3bbf2d33-8141-4b7c-acee-b64b7c443e1a	3a3e3fd0-cbc8-4414-92e5-b032c4a97887	\N	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	hostingmanage.com	hostingm	!WyPs37tkFe2hG	f008355f-1383-4d29-9606-18dda5476801	176.9.63.151	active	yearly	2027-03-14 06:09:41.326	failed	2026-03-14 06:08:39.27349	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2083	https://spg1.cloudpowerdns.com:2096	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-14 06:08:39.27349	2026-03-14 07:26:28.449	f	shared	\N	\N	\N
ce6babc4-ae48-4403-827b-d8c1f90df56d	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	\N	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	rana.mudassar.hosted.com	usertest	5Y4$sr5FMdEjBY	f008355f-1383-4d29-9606-18dda5476801	176.9.63.151	suspended	monthly	2026-04-14 05:10:55.542	not_installed	2026-03-13 17:22:07.112341	\N	0 MB	0 GB	https://rana.mudassar.hosted.com:2083	https://rana.mudassar.hosted.com/webmail	f	\N	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	not_started	\N	\N	\N	/	f	2026-03-13 17:22:07.112341	2026-03-23 08:42:54.783	f	shared	\N	\N	\N
29bbe0c8-52e2-4292-bd42-9063cdb77c63	bd2cfb49-79ca-485a-afb0-2af3ea58c813	012bddc0-44cd-4844-be63-f9083f29060d	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	wscreations.store	wscreati	Ye457eCYjhW8@f	f008355f-1383-4d29-9606-18dda5476801	176.9.63.151	active	yearly	2027-03-23 09:27:39.154	installed	2026-03-23 09:25:18.128857	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2083	https://spg1.cloudpowerdns.com:2096	f	\N	\N	t	f	\N	wscreati619	W3!7ZymEpQh0Tj	admin@wscreations.store	My WordPress Site	\N	sim_wp_29bbe0c852e2	\N	failed	\N	Database creation failed: WHM API error: HTTP 500 — {"error":"No data returned from cPanel Service"}	\N	/	f	2026-03-23 09:25:18.128857	2026-03-24 06:01:07.481	f	shared	\N	\N	\N
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, invoice_number, client_id, order_id, service_id, amount, tax, total, status, due_date, paid_date, items, payment_ref, payment_gateway_id, payment_notes, created_at, updated_at, invoice_type) FROM stdin;
21c27d9b-0062-48c2-aa5c-75e0e3c45f26	INV-2025-001	907edddc-4e8b-453b-8530-8bc17d38c629	\N	\N	9.99	0.00	9.99	paid	2026-02-13 08:45:06.156655	2026-02-16 08:45:06.156655	[{"total": 9.99, "quantity": 1, "unitPrice": 9.99, "description": "Business Hosting - Monthly"}]	\N	\N	\N	2026-02-13 08:45:06.156655	2026-03-13 08:45:06.156655	hosting
0ebaab51-b2f3-42fe-9054-1f7b6a1fdd21	INV-2025-002	907edddc-4e8b-453b-8530-8bc17d38c629	\N	\N	9.99	0.00	9.99	unpaid	2026-03-20 08:45:06.156655	\N	[{"total": 9.99, "quantity": 1, "unitPrice": 9.99, "description": "Business Hosting - Monthly"}]	\N	\N	\N	2026-03-13 08:45:06.156655	2026-03-13 08:45:06.156655	hosting
48f52432-0908-41c2-8b45-2b43c781db11	INV-2025-003	68b07e1d-5641-41e7-939b-b3b419e08c61	\N	\N	19.99	2.00	21.99	paid	2026-02-26 08:45:06.156655	2026-03-03 08:45:06.156655	[{"total": 19.99, "quantity": 1, "unitPrice": 19.99, "description": "Pro Hosting - Monthly"}]	\N	\N	\N	2026-02-21 08:45:06.156655	2026-03-13 08:45:06.156655	hosting
d36dd239-2d8f-47d7-bb25-f3bf87d5cef5	INV-2025-004	68b07e1d-5641-41e7-939b-b3b419e08c61	\N	\N	14.99	0.00	14.99	unpaid	2026-03-27 08:45:06.156655	\N	[{"total": 14.99, "quantity": 1, "unitPrice": 14.99, "description": "Domain Renewal - doedigital.com"}]	\N	\N	\N	2026-03-13 08:45:06.156655	2026-03-13 08:45:06.156655	hosting
2eb809ec-43d1-4fdc-bfa4-2790dcb6c87a	INV-2026-003	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	\N	\N	25.98	0.00	25.98	paid	2026-03-20 09:25:07.39	2026-03-13 09:43:25.928	[{"total": 25.98, "quantity": 1, "unitPrice": 25.98, "description": "hrthrfgg.com - Domain Registration (2 years)"}]	\N	\N	\N	2026-03-13 09:25:07.391185	2026-03-13 09:43:25.928	hosting
c14a95ec-0e4d-4c8e-8e1d-8b0021cfea39	INV-20260313-7RQANP	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	8bb529d4-6a7d-41ea-b1d1-af924d57435b	647784a1-2a57-464f-b205-0ebbddad56f2	4.99	0.00	4.99	paid	2026-03-20 14:59:34.584	2026-03-13 15:33:03.088	[{"total": 4.99, "quantity": 1, "unitPrice": 4.99, "description": "Starter Hosting"}]	\N	\N	\N	2026-03-13 14:59:34.585159	2026-03-13 15:33:03.088	hosting
3035047c-0400-46a0-8c29-4cfaf44a33f0	INV-2026-0001	907edddc-4e8b-453b-8530-8bc17d38c629	9deb6e0f-3d06-4d13-bbe3-a12913aac310	\N	4.99	0.00	4.99	paid	2026-04-13 00:00:00	2026-03-13 18:10:54.066	[{"total": 4.99, "quantity": 1, "unitPrice": 4.99, "description": "Testing — Monthly Hosting Plan (Basic)"}]	\N	\N	\N	2026-03-13 18:10:53.951561	2026-03-13 18:10:54.066	hosting
b91e658b-418b-46dc-911d-7c7802e8fbbc	INV-20260313-LZ5GJ3	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	aafa9b5f-9bde-440c-b5c7-e53d958a58d3	f5c9062f-9462-4a5d-a267-04fe139f3fd3	10.92	0.00	10.92	unpaid	2026-03-20 18:34:50.135	\N	[{"total": 10.92, "quantity": 1, "unitPrice": 10.92, "description": "Starter Hosting (12 months)"}]	\N	\N	\N	2026-03-13 18:34:50.136342	2026-03-13 18:34:50.136342	hosting
9a8f9d32-6ca7-4212-812e-8ca90b2d5a17	INV-20260314-19IADO	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	a8792f75-0686-4b67-b3b5-6c0b06b333d2	3f082d67-5418-4052-b7ae-0d6796429cc5	1.00	0.00	1.00	unpaid	2026-03-21 05:09:54.159	\N	[{"total": 1, "quantity": 1, "unitPrice": 1, "description": "Starter Hosting"}]	\N	\N	\N	2026-03-14 05:09:54.159759	2026-03-14 05:09:54.159759	hosting
c089c7fe-99f5-43d5-a191-8779b67b76d5	INV-2026-0020	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	a8792f75-0686-4b67-b3b5-6c0b06b333d2	\N	1.00	0.00	1.00	paid	2026-03-21 05:10:55.546	2026-03-14 05:10:55.551	[{"total": 1, "quantity": 1, "unitPrice": 1, "description": "Starter — Monthly Hosting Plan"}]	\N	\N	\N	2026-03-14 05:10:55.547132	2026-03-14 05:10:55.551	hosting
2bd285ab-3a6a-41ad-838c-46c0fe3a30ee	INV-2026-0021	02bd192d-3426-4e90-af54-7a7ba5df0419	7acd7ed4-36f2-416c-a015-4f4c7261dd6d	\N	1.00	0.00	1.00	paid	2026-04-14 00:00:00	2026-03-14 05:30:52.008	[{"total": 1, "quantity": 1, "unitPrice": 1, "description": "Starter — Monthly Hosting Plan (noehoster_Starter)"}]	\N	\N	\N	2026-03-14 05:29:24.193391	2026-03-14 05:30:52.008	hosting
2d3930ff-3b05-4640-a704-939028813b2f	INV-2026-0022	02bd192d-3426-4e90-af54-7a7ba5df0419	77f1b231-0004-4cfa-a828-47d424a0077b	\N	1.00	0.00	1.00	paid	2026-04-14 00:00:00	2026-03-14 05:47:40.241	[{"total": 1, "quantity": 1, "unitPrice": 1, "description": "Starter — Monthly Hosting Plan (noehoster_Starter)"}]	\N	\N	\N	2026-03-14 05:47:24.972259	2026-03-14 05:47:40.241	hosting
59543819-d12a-40d5-b24e-de17e309b892	INV-2026-0023	cb3dfdec-2026-4569-a860-e56400f4ebb9	dd47f3b6-49e6-4a96-9743-f8ca8f6b7e38	\N	9.99	0.00	9.99	paid	2026-04-14 00:00:00	2026-03-14 06:01:29.999	[{"total": 9.99, "quantity": 1, "unitPrice": 9.99, "description": "Business — Annual Hosting Plan (noehoster_Geek)"}]	\N	\N	\N	2026-03-14 06:01:08.608698	2026-03-14 06:01:29.999	hosting
9852be97-ccfa-4f62-8932-8a587f7dcd98	INV-2026-0025	96b440bb-4229-44c3-ae54-2c16784423de	6abbc04d-5ce1-4035-8d47-4df489163dff	\N	9.99	0.00	9.99	paid	2026-04-14 00:00:00	2026-03-14 06:36:11.251	[{"total": 9.99, "quantity": 1, "unitPrice": 9.99, "description": "Business — Monthly Hosting Plan (noehoster_Geek)"}]	\N	\N	\N	2026-03-14 06:34:56.207317	2026-03-14 06:36:11.251	hosting
af180cd4-aac6-460a-8f4b-cdc7897fb15b	INV-2026-0024	3a3e3fd0-cbc8-4414-92e5-b032c4a97887	d7583179-667b-47c6-b4d2-89b75633cbba	\N	10.92	0.00	10.92	paid	2027-04-14 00:00:00	2026-03-14 06:09:41.345	[{"total": 10.92, "quantity": 1, "unitPrice": 10.92, "description": "Starter — Annual Hosting Plan (noehoster_Starter)"}]	\N	\N	\N	2026-03-14 06:08:26.129615	2026-03-14 06:09:41.345	hosting
3fd0c7e2-a87e-4725-8c0f-a5a838c9f28f	INV-2026-026	02bd192d-3426-4e90-af54-7a7ba5df0419	\N	\N	12.99	0.00	12.99	unpaid	2026-03-21 08:46:41.528	\N	[{"total": 12.99, "quantity": 1, "unitPrice": 12.99, "description": "noehostd.com - Domain Registration (1 year)"}]	\N	\N	\N	2026-03-14 08:46:41.529391	2026-03-14 08:46:41.529391	hosting
bff66f50-7124-4f88-b599-472b096fe957	INV-20260314-L5BDAJ	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	2a69e3fb-bd06-40b2-b72b-dd2703a448e7	04a5a891-39dc-46b5-8039-a43709a5188c	10.92	0.00	10.92	paid	2026-03-21 14:09:41.515	2026-03-14 14:09:55.623	[{"total": 10.92, "quantity": 1, "unitPrice": 10.92, "description": "Starter Hosting (12 months)"}]	\N	\N	\N	2026-03-14 14:09:41.51595	2026-03-14 14:09:55.623	hosting
ff1d869e-e8a4-4a4d-815c-77c8796ccad8	INV-20260313-I5V1KP	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	1eedffad-748e-4d21-a1ab-53afbbd01185	ce6babc4-ae48-4403-827b-d8c1f90df56d	1.00	0.00	1.00	overdue	2026-03-20 17:22:07.115	\N	[{"total": 1, "quantity": 1, "unitPrice": 1, "description": "Starter Hosting"}]	\N	\N	\N	2026-03-13 17:22:07.115763	2026-03-23 08:42:54.786	hosting
685f3ff4-413c-41d5-80a0-fbc1b77ab7d8	INV-20260323-BRCQPI	bd2cfb49-79ca-485a-afb0-2af3ea58c813	012bddc0-44cd-4844-be63-f9083f29060d	29bbe0c8-52e2-4292-bd42-9063cdb77c63	3045.00	0.00	3045.00	paid	2026-03-30 09:25:18.132	2026-03-23 09:27:39.163	[{"total": 3045, "quantity": 1, "unitPrice": 3045, "description": "Starter Hosting (yearly)"}]	\N	\N	\N	2026-03-23 09:25:18.132843	2026-03-23 09:27:39.163	hosting
6b3f48fa-1849-4544-b2fd-455df6f15fe3	INV-20260323-L9QO53	bd2cfb49-79ca-485a-afb0-2af3ea58c813	eb79dbfb-218e-44ed-9e42-f837d2b2cc9b	\N	0.99	0.00	0.99	unpaid	2026-03-30 09:31:05.711	\N	[{"total": 0.99, "quantity": 1, "unitPrice": 0.99, "description": "Domain Registration: noehosts.com (1 year)"}]	\N	\N	\N	2026-03-23 09:31:05.712527	2026-03-23 09:31:05.712527	hosting
4f3fc23f-a15e-427b-a301-5f09900ab99b	INV-20260313-LK047A	907edddc-4e8b-453b-8530-8bc17d38c629	\N	\N	3.49	0.00	3.49	cancelled	2026-03-20 10:21:57.649	\N	[{"amount": 3.4930000000000003, "description": "Starter Hosting"}]	\N	\N	\N	2026-03-13 10:21:57.649876	2026-03-24 14:43:03.242	hosting
4b14041b-1069-4441-b1a8-8f0f7acd9c55	INV-20260323-OZFZPI	bd2cfb49-79ca-485a-afb0-2af3ea58c813	eb79dbfb-218e-44ed-9e42-f837d2b2cc9b	\N	0.99	0.00	0.99	paid	2026-03-30 09:31:58.633	\N	[{"total": 0.99, "quantity": 1, "unitPrice": 0.99, "description": "noehosts.com — Annual Hosting Plan"}]	\N	\N	\N	2026-03-23 09:31:58.633873	2026-03-23 09:31:58.633873	hosting
e22308c9-790f-4557-8332-862826a4dc8f	INV-20260324-P8OGQ6	bd2cfb49-79ca-485a-afb0-2af3ea58c813	47c33f83-68ff-42b1-b028-12a6900aafc8	\N	2000.00	0.00	2000.00	unpaid	2026-03-31 12:38:46.418	\N	[{"total": 2000, "quantity": 1, "unitPrice": 2000, "description": "Domain Registration: trtrgtrtrtrrty.com"}]	\N	\N	\N	2026-03-24 12:38:46.424735	2026-03-24 12:38:46.424735	hosting
67786f84-e66b-4382-b15f-a1e12795c0bd	DEP-1774361861029-1	bd2cfb49-79ca-485a-afb0-2af3ea58c813	\N	\N	500.00	0.00	500.00	paid	2026-03-31 14:17:41.029	2026-03-24 14:19:06.855	[{"total": 500, "quantity": 1, "unitPrice": 500, "description": "Account Credit Deposit"}]	CREDIT-1774361946855	\N	Paid with account credits	2026-03-24 14:17:41.029534	2026-03-24 14:19:06.855	hosting
d2af23d9-729c-49e4-8336-fcbaedf422d4	DEP-1774361985086-2	bd2cfb49-79ca-485a-afb0-2af3ea58c813	\N	\N	1000.00	0.00	1000.00	paid	2026-03-31 14:19:45.086	2026-03-24 14:20:29.784	[{"total": 1000, "quantity": 1, "unitPrice": 1000, "description": "Account Credit Deposit"}]	\N	\N	\N	2026-03-24 14:19:45.087449	2026-03-24 14:20:29.784	hosting
4933c3aa-3628-4d24-815d-d40b8f158fc2	DEP-1774363028734-3	bd2cfb49-79ca-485a-afb0-2af3ea58c813	\N	\N	270.00	0.00	270.00	paid	2026-03-31 14:37:08.734	2026-03-24 14:37:24.758	[{"total": 270, "quantity": 1, "unitPrice": 270, "description": "Account Credit Deposit"}]	\N	\N	\N	2026-03-24 14:37:08.734751	2026-03-24 14:37:24.758	hosting
f6128e62-fa2d-463c-bbd0-e64ba5ec1bfe	DEP-1774364039533-1	bd2cfb49-79ca-485a-afb0-2af3ea58c813	\N	\N	270.00	0.00	270.00	paid	2026-03-31 14:53:59.533	2026-03-24 14:54:10.012	[{"total": 270, "quantity": 1, "unitPrice": 270, "description": "Account Deposit"}]	\N	\N	\N	2026-03-24 14:53:59.534847	2026-03-24 14:54:10.012	deposit
\.


--
-- Data for Name: migrations_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.migrations_requests (id, client_id, domain, old_hosting_provider, old_cpanel_host, old_cpanel_username, old_cpanel_password, status, progress, notes, requested_at, completed_at) FROM stdin;
77d8a8a0-2705-4b69-a03a-e4a72fffa1d4	68b07e1d-5641-41e7-939b-b3b419e08c61	doedigital.com	GoDaddy	cpanel.godaddy.com	doedigital_old	hidden	in_progress	65	Migration in progress - files transferred, database pending	2026-03-10 08:45:06.156655	\N
9fe25ae8-74d9-4c15-a337-d7d342247941	907edddc-4e8b-453b-8530-8bc17d38c629	johnsmith-old.com	Bluehost	cpanel.bluehost.com	johnsmith_old	hidden	completed	100	Migration completed successfully	2026-02-27 08:45:06.156655	\N
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, type, title, message, link, is_read, created_at) FROM stdin;
d78ae07b-a7ce-4d43-9b61-7b504e0d1136	bd2cfb49-79ca-485a-afb0-2af3ea58c813	invoice	Invoice Created	Invoice INV-20260323-BRCQPI for Rs. 3045.00 has been generated	/client/invoices	f	2026-03-23 09:25:18.157547
3de6ba1d-559a-4bf9-a30c-82d16d619a7d	bd2cfb49-79ca-485a-afb0-2af3ea58c813	order	Order Placed	Your order for Starter has been placed — awaiting payment	/client/orders	t	2026-03-23 09:25:18.153364
2ac04ca8-4d65-4fe6-ad37-b0ce8133256f	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ticket	Support Reply	Admin replied to your ticket: "ergergwerger"	/client/tickets/2de200dc-61f9-4c67-9959-e57018877fc5	f	2026-03-24 10:34:01.237256
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, client_id, type, item_id, item_name, domain, amount, billing_cycle, due_date, module_type, module_plan_id, module_plan_name, module_server_id, payment_status, invoice_id, status, notes, created_at, updated_at) FROM stdin;
0db5af50-752c-4aa0-8614-fcaec7154b6a	907edddc-4e8b-453b-8530-8bc17d38c629	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	\N	2.99	monthly	\N	none	\N	\N	\N	unpaid	\N	cancelled	Promo: SALE40 (-40%)	2026-03-13 10:17:54.995545	2026-03-13 12:44:00.059
820ddb46-4fe8-441e-8ba9-2a0ce59b2147	907edddc-4e8b-453b-8530-8bc17d38c629	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	\N	3.49	monthly	\N	none	\N	\N	\N	unpaid	\N	approved	Promo: FINAL30 (-30%)	2026-03-13 10:21:57.646722	2026-03-13 14:55:28.801
ee9433e1-c960-4df9-8cd8-249d2b0f9895	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	af206789-871f-431c-b209-5765a71f40b3	E2E Test Plan	\N	6.99	monthly	\N	none	\N	\N	\N	unpaid	\N	approved	\N	2026-03-13 14:55:12.734748	2026-03-13 14:55:33.611
8bb529d4-6a7d-41ea-b1d1-af924d57435b	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	\N	4.99	monthly	\N	none	\N	\N	\N	unpaid	\N	pending	\N	2026-03-13 14:59:34.367682	2026-03-13 14:59:34.367682
1eedffad-748e-4d21-a1ab-53afbbd01185	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	\N	1.00	monthly	\N	none	\N	\N	\N	unpaid	\N	pending	\N	2026-03-13 17:22:07.104984	2026-03-13 17:22:07.104984
38f077c0-0f4c-4c61-845a-a4f82f8021a7	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	domain	5436e08d-a947-48b2-8633-37876de108d7	hrthrfgg.com (2yr)	\N	25.98	monthly	\N	none	\N	\N	\N	unpaid	\N	approved	Domain registration for hrthrfgg.com	2026-03-13 09:25:07.386667	2026-03-13 17:25:30.771
e651d55c-a8ed-4c92-b038-e72b967778ae	96b440bb-4229-44c3-ae54-2c16784423de	hosting	7260ddb5-3612-441e-a3e0-830194435115	Testing	\N	4.99	monthly	\N	none	\N	\N	\N	unpaid	\N	approved	\N	2026-03-13 17:25:09.328955	2026-03-13 17:25:48.939
31f542f2-91a7-413c-ba02-2269e996ef43	cb3dfdec-2026-4569-a860-e56400f4ebb9	hosting	7260ddb5-3612-441e-a3e0-830194435115	Testing	\N	4.99	monthly	\N	none	\N	\N	\N	unpaid	\N	approved	\N	2026-03-13 17:28:00.838057	2026-03-13 17:28:28.168
d7583179-667b-47c6-b4d2-89b75633cbba	3a3e3fd0-cbc8-4414-92e5-b032c4a97887	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	hostingmanage.com	10.92	yearly	2027-04-14 00:00:00	cpanel	noehoster_Starter	noehoster_Starter	\N	paid	af180cd4-aac6-460a-8f4b-cdc7897fb15b	approved	\N	2026-03-14 06:08:26.125102	2026-03-14 06:14:17.834
9deb6e0f-3d06-4d13-bbe3-a12913aac310	907edddc-4e8b-453b-8530-8bc17d38c629	hosting	7260ddb5-3612-441e-a3e0-830194435115	Testing	\N	4.99	monthly	2026-04-13 00:00:00	cpanel	basic	Basic	\N	paid	3035047c-0400-46a0-8c29-4cfaf44a33f0	approved	\N	2026-03-13 17:47:54.02342	2026-03-13 18:10:54.069
aafa9b5f-9bde-440c-b5c7-e53d958a58d3	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	\N	10.92	monthly	\N	none	\N	\N	\N	unpaid	\N	approved	Billing period: 12 months	2026-03-13 18:34:50.121792	2026-03-13 18:35:21.549
5b6f294e-980d-4f21-9215-e9d3476d3680	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testingcpanel.com	9.99	yearly	2026-04-13 00:00:00	cpanel	nexgohost_Business	nexgohost_Business	\N	unpaid	\N	approved	\N	2026-03-13 19:09:41.563751	2026-03-13 19:09:41.563751
7acd7ed4-36f2-416c-a015-4f4c7261dd6d	02bd192d-3426-4e90-af54-7a7ba5df0419	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	nexgohostss.com	1.00	monthly	2026-04-14 00:00:00	cpanel	noehoster_Starter	noehoster_Starter	\N	paid	2bd285ab-3a6a-41ad-838c-46c0fe3a30ee	suspended	\N	2026-03-14 05:29:24.187872	2026-03-14 05:46:08.294
e001f587-ca27-4420-8c95-fc7dc9aa84bd	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testingcpanel.com	9.99	yearly	2026-04-13 00:00:00	cpanel	nexgohost_Business	nexgohost_Business	\N	unpaid	\N	approved	\N	2026-03-13 19:09:49.751545	2026-03-13 19:12:46.94
77f1b231-0004-4cfa-a828-47d424a0077b	02bd192d-3426-4e90-af54-7a7ba5df0419	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	testingss.com	1.00	monthly	2026-04-14 00:00:00	cpanel	noehoster_Starter	noehoster_Starter	\N	paid	2d3930ff-3b05-4640-a704-939028813b2f	approved	\N	2026-03-14 05:47:24.937133	2026-03-14 05:47:40.244
a8792f75-0686-4b67-b3b5-6c0b06b333d2	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	\N	1.00	monthly	\N	none	\N	\N	\N	paid	c089c7fe-99f5-43d5-a191-8779b67b76d5	approved	\N	2026-03-14 05:09:54.125569	2026-03-14 05:10:55.554
dd47f3b6-49e6-4a96-9743-f8ca8f6b7e38	cb3dfdec-2026-4569-a860-e56400f4ebb9	hosting	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testadmin.com	9.99	yearly	2026-04-14 00:00:00	cpanel	noehoster_Geek	noehoster_Geek	\N	paid	59543819-d12a-40d5-b24e-de17e309b892	approved	\N	2026-03-14 06:01:08.576512	2026-03-14 06:01:30.001
2a69e3fb-bd06-40b2-b72b-dd2703a448e7	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	\N	10.92	monthly	\N	none	\N	\N	\N	unpaid	\N	approved	Billing period: 12 months	2026-03-14 14:09:41.465496	2026-03-14 14:09:55.626
6abbc04d-5ce1-4035-8d47-4df489163dff	96b440bb-4229-44c3-ae54-2c16784423de	hosting	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	getyourplan.com	9.99	monthly	2026-04-14 00:00:00	cpanel	noehoster_Geek	noehoster_Geek	\N	paid	9852be97-ccfa-4f62-8932-8a587f7dcd98	approved	\N	2026-03-14 06:34:56.202697	2026-03-14 07:24:28.074
c4f734c7-a8d6-4ada-bb09-fbcb295c8e5a	02bd192d-3426-4e90-af54-7a7ba5df0419	domain	435ed6d2-bea2-4c9e-98c5-449eca7b31bd	noehostd.com (1yr)	\N	12.99	monthly	\N	none	\N	\N	\N	unpaid	\N	approved	Domain registration for noehostd.com	2026-03-14 08:46:41.524371	2026-03-14 08:46:41.524371
012bddc0-44cd-4844-be63-f9083f29060d	bd2cfb49-79ca-485a-afb0-2af3ea58c813	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	wscreations.store	3045.00	yearly	\N	none	\N	\N	\N	paid	685f3ff4-413c-41d5-80a0-fbc1b77ab7d8	approved	Billing: yearly, Domain: wscreations.store	2026-03-23 09:25:18.098082	2026-03-23 09:27:39.166
eb79dbfb-218e-44ed-9e42-f837d2b2cc9b	bd2cfb49-79ca-485a-afb0-2af3ea58c813	domain	\N	noehosts.com	noehosts.com	0.99	yearly	\N	none	\N	\N	\N	unpaid	4b14041b-1069-4441-b1a8-8f0f7acd9c55	approved	Domain registration: noehosts.com (1 year)	2026-03-23 09:31:05.708507	2026-03-23 09:32:01.687
47c33f83-68ff-42b1-b028-12a6900aafc8	bd2cfb49-79ca-485a-afb0-2af3ea58c813	domain	\N	trtrgtrtrtrrty.com	trtrgtrtrtrrty.com	2000.00	yearly	\N	none	\N	\N	\N	unpaid	e22308c9-790f-4557-8332-862826a4dc8f	pending	\N	2026-03-24 12:38:46.418977	2026-03-24 12:38:46.429
\.


--
-- Data for Name: password_resets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_resets (token, user_id, expires_at, used_at, created_at) FROM stdin;
3d9c229f92cbd77c5db41b05774c75c78aa3ee91a3a1539ad5a78789b58f590d	bd2cfb49-79ca-485a-afb0-2af3ea58c813	2026-03-24 11:47:24.329	\N	2026-03-24 10:47:24.329923
\.


--
-- Data for Name: payment_methods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_methods (id, name, type, description, is_active, is_sandbox, settings, created_at, updated_at) FROM stdin;
66fb016e-aecc-4d24-b5dc-cd54d32ff5ac	Jazz Cash / Easy Paisa	manual	Name: Muhammad Arslan, Number: 03271711821	t	f	{"instructions":"Name: Muhammad Arslan, Number: 03271711821"}	2026-03-13 14:42:59.324783	2026-03-24 14:11:41.589
2d0e9ade-ffa0-4994-b984-8ce909980b14	E2E Stripe Test	stripe		f	t	{}	2026-03-13 10:12:01.889299	2026-03-24 14:11:48.801
9649914c-4968-49a7-bd0e-b8eb0b1f1d10	PayPal Test	paypal		f	t	{}	2026-03-13 10:16:17.882205	2026-03-24 14:11:50.982
\.


--
-- Data for Name: product_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_groups (id, name, slug, description, is_active, sort_order, created_at, updated_at) FROM stdin;
e1deef82-2be7-463f-a33e-9d92134ed229	Shared Hosting	shared-hosting		t	0	2026-03-13 13:55:04.040153	2026-03-13 13:55:04.040153
7c95557d-5db5-4554-80a3-24567b1fa89a	WordPress Hosting	wordpress-hosting		t	0	2026-03-13 13:57:07.349604	2026-03-13 13:57:07.349604
3bdf01c7-02d3-4454-88e7-78a54f4602b8	Reseller Hosting	reseller-hosting		t	0	2026-03-13 13:57:12.310933	2026-03-13 13:57:12.310933
9ad4bca3-a031-419f-83aa-aeaf13146924	VPS Hosting	vps-hosting		t	0	2026-03-13 13:57:15.889612	2026-03-13 13:57:15.889612
\.


--
-- Data for Name: promo_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.promo_codes (id, code, description, discount_percent, is_active, usage_limit, used_count, expires_at, applicable_to, created_at, discount_type, fixed_amount, applicable_group_id, applicable_domain_tld) FROM stdin;
902109ed-7a2f-474c-827c-4324f8d51224	PROMOTEST50	\N	50	t	\N	0	\N	all	2026-03-13 10:11:32.762066	percent	\N	\N	\N
89e668e7-7028-4563-a17f-ec29c37e0b05	SALE40	\N	40	t	\N	1	\N	all	2026-03-13 10:15:49.1987	percent	\N	\N	\N
29a838fb-0238-4cdc-880e-3361067b5196	FINAL30	\N	30	t	\N	1	\N	all	2026-03-13 10:20:37.037162	percent	\N	\N	\N
64f7d244-436b-439b-906c-4637a62d5ef9	NOE33	Summer Sale	13	t	100	0	2026-12-31 00:00:00	all	2026-03-23 10:00:20.73341	percent	\N	\N	\N
cf4190e3-0aa0-417f-9978-8d584f865c17	NOE10	Summer Sale 2026	10	t	100	0	2026-12-31 00:00:00	hosting	2026-03-24 14:32:21.805628	percent	\N	e1deef82-2be7-463f-a33e-9d92134ed229	\N
\.


--
-- Data for Name: server_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.server_groups (id, name, description, created_at, updated_at) FROM stdin;
05f3d2fc-5268-4890-9d20-b88b51f50bf7	spg1	\N	2026-03-13 16:16:35.6321	2026-03-13 16:16:35.6321
97cf821b-782b-4c63-97fd-4ad3dd9ecbc1	Nexpanel	\N	2026-03-14 04:39:59.182015	2026-03-14 04:39:59.182015
\.


--
-- Data for Name: server_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.server_logs (id, service_id, server_id, action, status, request, response, error_message, created_at) FROM stdin;
cd2f6c5f-4a1a-46a4-addb-1de77beb5cf2	ce6babc4-ae48-4403-827b-d8c1f90df56d	f008355f-1383-4d29-9606-18dda5476801	createacct	failed	{"username":"usertest","domain":"rana.mudassar.hosted.com","password":"***","plan":"noehoster_Starter","contactemail":"ranamudassar3291@gmail.com"}	\N	WHM API timed out (15s)	2026-03-14 05:10:55.537968
e2f1b916-914e-4ca6-a9a2-4ef293e7faeb	4a689279-8c80-4e28-9c06-6f8e511e44c7	f008355f-1383-4d29-9606-18dda5476801	createacct	failed	{"username":"nexgohos","domain":"nexgohostss.com","password":"***","plan":"noehoster_Starter","contactemail":"ranaarsu059@gmail.com"}	\N	WHM API timed out after 60s — account creation can take up to 60 seconds on busy servers	2026-03-14 05:30:51.960778
31a724a7-9221-4c5e-a38c-cf7770ac0b4b	4a689279-8c80-4e28-9c06-6f8e511e44c7	f008355f-1383-4d29-9606-18dda5476801	createacct	failed	{"username":"testings","domain":"nexgohostss.com","password":"***","plan":"noehoster_Starter","contactemail":"ranaarsu059@gmail.com"}	\N	(XID r334yf) The domain “nexgohostss.com” already exists in the userdata.	2026-03-14 05:47:40.232743
e886bb95-1978-42e7-988f-5f28457f7de7	947c0e4d-5c52-458b-8171-38e71c151819	f008355f-1383-4d29-9606-18dda5476801	createacct	failed	{"username":"testadmi","domain":"testadmin.com","password":"***","plan":"noehoster_Geek","contactemail":"wefefde@outlook.com"}	\N	(XID yk6aby) “testadmi” is a reserved username on this system. at /usr/local/cpanel/Whostmgr/Accounts/Create.pm line 654.\n	2026-03-14 06:01:29.988103
fd15fd09-50b4-459d-8877-1df6631f5f89	3bbf2d33-8141-4b7c-acee-b64b7c443e1a	f008355f-1383-4d29-9606-18dda5476801	createacct	success	{"username":"hostingm","domain":"hostingmanage.com","password":"***","plan":"noehoster_Starter","contactemail":"curltest_final2@example.com"}	{"data":{"nameserverentry2":null,"nameserver":"dns1.cloudpowerdns.com","nameserver2":"dns2.cloudpowerdns.com","nameserverentry4":null,"nameserver4":"","nameserverentry":null,"package":"noehoster_Starter","nameservera":null,"nameservera2":null,"nameserver3":"","nameserverentry3":null,"ip":"176.9.63.151","nameservera4":null,"nameservera3":null},"metadata":{"version":1,"result":1,"command":"createacct","output":{"raw":"<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Checking input data...</span><pre style=\\"margin: 0;\\">Dns Zone check is enabled.\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0; margin-left: 1rem;\\"><span style=\\"white-space: pre-wrap;\\">Validating Username...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0; margin-left: 1rem;\\"><span style=\\"white-space: pre-wrap;\\">Validating IP...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0; margin-left: 1rem;\\"><span style=\\"white-space: pre-wrap;\\">Validating Contact Email...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Checking for database conflicts...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Checking for account enhancements...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">WWWAcct 12.6.0 (c) 4455667 cPanel, L.L.C....</span><pre style=\\"margin: 0;\\">\\n\\n+===================================+\\n| New Account Info                  |\\n+===================================+\\n| Domain: hostingmanage.com\\n| Ip: 176.9.63.151 (n)\\n| HasCgi: y\\n| UserName: hostingm\\n| PassWord: !WyPs37tkFe2hG\\n| CpanelMod: jupiter\\n| HomeRoot: /home\\n| Quota: 87.89 GB\\n| NameServer1: dns1.cloudpowerdns.com\\n| NameServer2: dns2.cloudpowerdns.com\\n| NameServer3: \\n| NameServer4: \\n| Contact Email: curltest_final2@example.com\\n| Package: noehoster_Starter\\n| Feature List: noehoster_Starter\\n| Account Enhancements: None\\n| Language: en\\n+===================================+\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\nCustom Account Data Provided: no\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Running pre creation script (/usr/local/cpanel/scripts/prewwwacct)...</span><pre style=\\"margin: 0;\\">Ok\\n\\nSuccess</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up System User...</span><pre style=\\"margin: 0;\\">Removing Shell Access (n)\\nSuccess</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Userdata...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Home Directory...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Mail...</span><pre style=\\"margin: 0;\\">valiases ...vdomainaliases ...vfilters ...</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Calendar and Contacts...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Configuring DNS...</span><pre style=\\"margin: 0;\\">Zone hostingmanage.com has been successfully added\\nZone hostingmanage.com has been successfully added\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Verifying MX Records and Setting up Databases...</span><pre style=\\"margin: 0;\\">Reconfiguring Mail Routing:\\n<ul><li>LOCAL MAIL EXCHANGER: This server will serve as a primary mail exchanger for hostingmanage.com's mail.:<br /> This configuration has been manually selected.<br /><br /></li></ul></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Service Subdomains...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Updating Authentication Databases...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting passwords...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Creating DMARC record...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Updating the userdata cache...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Creating bandwidth datastore...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Updating the dedicated IP address usage cache...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Generating and installing DKIM keys...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Enabling Apache SpamAssassin™...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Enabling Apache SpamAssassin™ Spam Box...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Sending Account Information...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Running post creation scripts (/usr/local/cpanel/scripts/legacypostwwwacct, /usr/local/cpanel/scripts/postwwwacct, /usr/local/cpanel/scripts/postwwwacctuser)...</span><pre style=\\"margin: 0;\\">Deprecated script\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\nwwwacct creation finished\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Account Creation Complete!!!...</span><pre style=\\"margin: 0;\\">Account Creation Ok</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n"},"reason":"Account Creation Ok"}}	\N	2026-03-14 06:09:41.287925
9b63db7b-f1d7-45ef-a71e-47b73fd652aa	4ccade11-1a40-4031-8482-6949b47cca2e	f008355f-1383-4d29-9606-18dda5476801	createacct	success	{"username":"getyourp","domain":"getyourplan.com","password":"***","plan":"noehoster_Geek","contactemail":"finaluser.e2e@example.com"}	{"data":{"nameserverentry":null,"nameserver4":"","nameserverentry2":null,"nameserver":"dns1.cloudpowerdns.com","nameserver2":"dns2.cloudpowerdns.com","nameserverentry4":null,"nameserverentry3":null,"ip":"176.9.63.151","nameservera4":null,"nameservera3":null,"package":"noehoster_Geek","nameservera":null,"nameservera2":null,"nameserver3":""},"metadata":{"result":1,"version":1,"output":{"raw":"<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Checking input data...</span><pre style=\\"margin: 0;\\">Dns Zone check is enabled.\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0; margin-left: 1rem;\\"><span style=\\"white-space: pre-wrap;\\">Validating Username...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0; margin-left: 1rem;\\"><span style=\\"white-space: pre-wrap;\\">Validating IP...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0; margin-left: 1rem;\\"><span style=\\"white-space: pre-wrap;\\">Validating Contact Email...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Checking for database conflicts...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Checking for account enhancements...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">WWWAcct 12.6.0 (c) 4461082 cPanel, L.L.C....</span><pre style=\\"margin: 0;\\">\\n\\n+===================================+\\n| New Account Info                  |\\n+===================================+\\n| Domain: getyourplan.com\\n| Ip: 176.9.63.151 (n)\\n| HasCgi: y\\n| UserName: getyourp\\n| PassWord: Uq6usYr59ArQqq\\n| CpanelMod: jupiter\\n| HomeRoot: /home\\n| Quota: 195.31 GB\\n| NameServer1: dns1.cloudpowerdns.com\\n| NameServer2: dns2.cloudpowerdns.com\\n| NameServer3: \\n| NameServer4: \\n| Contact Email: finaluser.e2e@example.com\\n| Package: noehoster_Geek\\n| Feature List: noehoster_Geek\\n| Account Enhancements: None\\n| Language: en\\n+===================================+\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\nCustom Account Data Provided: no\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Running pre creation script (/usr/local/cpanel/scripts/prewwwacct)...</span><pre style=\\"margin: 0;\\">Ok\\n\\nSuccess</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up System User...</span><pre style=\\"margin: 0;\\">Removing Shell Access (n)\\nSuccess</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Userdata...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Home Directory...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Mail...</span><pre style=\\"margin: 0;\\">valiases ...vdomainaliases ...vfilters ...</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Calendar and Contacts...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Configuring DNS...</span><pre style=\\"margin: 0;\\">Zone getyourplan.com has been successfully added\\nZone getyourplan.com has been successfully added\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Verifying MX Records and Setting up Databases...</span><pre style=\\"margin: 0;\\">Reconfiguring Mail Routing:\\n<ul><li>LOCAL MAIL EXCHANGER: This server will serve as a primary mail exchanger for getyourplan.com's mail.:<br /> This configuration has been manually selected.<br /><br /></li></ul></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Service Subdomains...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Updating Authentication Databases...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting passwords...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Creating DMARC record...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Updating the userdata cache...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Creating bandwidth datastore...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Updating the dedicated IP address usage cache...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Generating and installing DKIM keys...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Enabling Apache SpamAssassin™...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Enabling Apache SpamAssassin™ Spam Box...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Sending Account Information...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Running post creation scripts (/usr/local/cpanel/scripts/legacypostwwwacct, /usr/local/cpanel/scripts/postwwwacct, /usr/local/cpanel/scripts/postwwwacctuser)...</span><pre style=\\"margin: 0;\\">Deprecated script\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\nwwwacct creation finished\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Account Creation Complete!!!...</span><pre style=\\"margin: 0;\\">Account Creation Ok</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n"},"reason":"Account Creation Ok","command":"createacct"}}	\N	2026-03-14 06:36:11.192374
118a1883-8610-4935-b253-7a67ffa47064	3bbf2d33-8141-4b7c-acee-b64b7c443e1a	f008355f-1383-4d29-9606-18dda5476801	suspendacct	success	{"user":"hostingm","reason":"Suspended by admin"}	\N	\N	2026-03-14 07:04:35.132812
372668c2-8c6e-440d-b18c-1b75cb904256	3bbf2d33-8141-4b7c-acee-b64b7c443e1a	f008355f-1383-4d29-9606-18dda5476801	suspendacct	success	{"user":"hostingm","reason":"Suspended by admin"}	\N	\N	2026-03-14 07:05:52.853375
04f07645-442a-49fa-a308-7b08c8d45d99	4ccade11-1a40-4031-8482-6949b47cca2e	f008355f-1383-4d29-9606-18dda5476801	suspendacct	success	{"user":"getyourp","reason":"Suspended by admin"}	\N	\N	2026-03-14 07:14:51.92204
35b45ca8-5b81-46e0-b7d5-be753c47ab50	4ccade11-1a40-4031-8482-6949b47cca2e	f008355f-1383-4d29-9606-18dda5476801	unsuspendacct	success	{"user":"getyourp"}	\N	\N	2026-03-14 07:15:25.648934
06862965-a2d4-4a23-916f-b5bc7b8d2ab0	3bbf2d33-8141-4b7c-acee-b64b7c443e1a	f008355f-1383-4d29-9606-18dda5476801	installssl	failed	{"domain":"hostingmanage.com"}	\N	A certificate and private key must be provided.	2026-03-14 07:22:31.990733
10163819-8f82-49c4-91f2-18f41cbca68c	3bbf2d33-8141-4b7c-acee-b64b7c443e1a	f008355f-1383-4d29-9606-18dda5476801	installssl	failed	{"domain":"hostingmanage.com"}	\N	A certificate and private key must be provided.	2026-03-14 07:22:40.624845
0af8cf2f-3e81-47dc-9342-0e366343549d	4ccade11-1a40-4031-8482-6949b47cca2e	f008355f-1383-4d29-9606-18dda5476801	installssl	failed	{"domain":"getyourplan.com"}	\N	A certificate and private key must be provided.	2026-03-14 07:24:42.222732
a0679d8d-8904-4688-86fb-a5c093895caf	4ccade11-1a40-4031-8482-6949b47cca2e	f008355f-1383-4d29-9606-18dda5476801	suspendacct	success	{"user":"getyourp","reason":"Suspended by admin"}	\N	\N	2026-03-14 07:24:52.720869
195436ba-8fd7-46a9-b001-4653ec2c936d	4ccade11-1a40-4031-8482-6949b47cca2e	f008355f-1383-4d29-9606-18dda5476801	unsuspendacct	success	{"user":"getyourp"}	\N	\N	2026-03-14 07:25:50.974079
a3e2092f-c089-4b4b-90fd-a7441d98092c	4ccade11-1a40-4031-8482-6949b47cca2e	f008355f-1383-4d29-9606-18dda5476801	unsuspendacct	success	{"user":"getyourp"}	\N	\N	2026-03-14 07:26:07.79634
d78ae302-af14-401f-a903-1bfab1c7f43d	3bbf2d33-8141-4b7c-acee-b64b7c443e1a	f008355f-1383-4d29-9606-18dda5476801	unsuspendacct	success	{"user":"hostingm"}	\N	\N	2026-03-14 07:26:23.313003
b4f9faa1-e79e-4b8c-933b-3797ea002515	3bbf2d33-8141-4b7c-acee-b64b7c443e1a	f008355f-1383-4d29-9606-18dda5476801	unsuspendacct	success	{"user":"hostingm"}	\N	\N	2026-03-14 07:26:28.438725
4605d76b-f338-46e3-962a-4bc584e63e7c	4ccade11-1a40-4031-8482-6949b47cca2e	f008355f-1383-4d29-9606-18dda5476801	suspendacct	success	{"user":"getyourp","reason":"Suspended by admin"}	\N	\N	2026-03-14 07:26:42.359727
8a46f5ff-0531-4fbc-8b76-dccb9cf57882	4ccade11-1a40-4031-8482-6949b47cca2e	f008355f-1383-4d29-9606-18dda5476801	unsuspendacct	success	{"user":"getyourp"}	\N	\N	2026-03-14 07:27:35.668941
3f7b9f54-be73-4a24-bdd5-ebd7308d2bf3	4ccade11-1a40-4031-8482-6949b47cca2e	f008355f-1383-4d29-9606-18dda5476801	unsuspendacct	success	{"user":"getyourp"}	\N	\N	2026-03-14 07:27:43.823727
08b7b15e-334a-40ad-9a2e-e5e4416ac798	04a5a891-39dc-46b5-8039-a43709a5188c	f008355f-1383-4d29-9606-18dda5476801	createacct	success	{"username":"ranamuda","domain":"ranamudassar.hosted.com","password":"***","plan":"noehoster_Starter","contactemail":"ranamudassar3291@gmail.com"}	{"metadata":{"version":1,"result":1,"reason":"Account Creation Ok","output":{"raw":"<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Checking input data...</span><pre style=\\"margin: 0;\\">Dns Zone check is enabled.\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0; margin-left: 1rem;\\"><span style=\\"white-space: pre-wrap;\\">Validating Username...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0; margin-left: 1rem;\\"><span style=\\"white-space: pre-wrap;\\">Validating IP...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0; margin-left: 1rem;\\"><span style=\\"white-space: pre-wrap;\\">Validating Contact Email...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Checking for database conflicts...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Checking for account enhancements...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">WWWAcct 12.6.0 (c) 4454513 cPanel, L.L.C....</span><pre style=\\"margin: 0;\\">\\n\\n+===================================+\\n| New Account Info                  |\\n+===================================+\\n| Domain: ranamudassar.hosted.com\\n| Ip: 176.9.63.151 (n)\\n| HasCgi: y\\n| UserName: ranamuda\\n| PassWord: DHAchzKvgGbGV5\\n| CpanelMod: jupiter\\n| HomeRoot: /home\\n| Quota: 87.89 GB\\n| NameServer1: dns1.cloudpowerdns.com\\n| NameServer2: dns2.cloudpowerdns.com\\n| NameServer3: \\n| NameServer4: \\n| Contact Email: ranamudassar3291@gmail.com\\n| Package: noehoster_Starter\\n| Feature List: noehoster_Starter\\n| Account Enhancements: None\\n| Language: en\\n+===================================+\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\nCustom Account Data Provided: no\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Running pre creation script (/usr/local/cpanel/scripts/prewwwacct)...</span><pre style=\\"margin: 0;\\">Ok\\n\\nSuccess</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up System User...</span><pre style=\\"margin: 0;\\">Removing Shell Access (n)\\nSuccess</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Userdata...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Home Directory...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Mail...</span><pre style=\\"margin: 0;\\">valiases ...vdomainaliases ...vfilters ...</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Calendar and Contacts...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Configuring DNS...</span><pre style=\\"margin: 0;\\">Zone ranamudassar.hosted.com has been successfully added\\nZone ranamudassar.hosted.com has been successfully added\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Verifying MX Records and Setting up Databases...</span><pre style=\\"margin: 0;\\">Reconfiguring Mail Routing:\\n<ul><li>LOCAL MAIL EXCHANGER: This server will serve as a primary mail exchanger for ranamudassar.hosted.com's mail.:<br /> This configuration has been manually selected.<br /><br /></li></ul></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Service Subdomains...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Updating Authentication Databases...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting passwords...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Creating DMARC record...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Updating the userdata cache...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Creating bandwidth datastore...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Updating the dedicated IP address usage cache...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Generating and installing DKIM keys...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Enabling Apache SpamAssassin™...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Enabling Apache SpamAssassin™ Spam Box...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Sending Account Information...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Running post creation scripts (/usr/local/cpanel/scripts/legacypostwwwacct, /usr/local/cpanel/scripts/postwwwacct, /usr/local/cpanel/scripts/postwwwacctuser)...</span><pre style=\\"margin: 0;\\">Deprecated script\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\nwwwacct creation finished\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Account Creation Complete!!!...</span><pre style=\\"margin: 0;\\">Account Creation Ok</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n"},"command":"createacct"},"data":{"nameserver2":"dns2.cloudpowerdns.com","nameserverentry4":null,"nameserverentry2":null,"nameserver":"dns1.cloudpowerdns.com","nameserverentry":null,"nameserver4":"","nameservera":null,"nameservera2":null,"nameserver3":"","package":"noehoster_Starter","nameservera3":null,"nameserverentry3":null,"ip":"176.9.63.151","nameservera4":null}}	\N	2026-03-14 14:11:00.317573
fc27c2c2-36e1-4774-8ffc-1e5772a0e7cc	04a5a891-39dc-46b5-8039-a43709a5188c	f008355f-1383-4d29-9606-18dda5476801	createacct	failed	{"username":"ranamuda","domain":"ranamudassar.hosted.com","password":"***","plan":"noehoster_Starter","contactemail":"ranamudassar3291@gmail.com"}	\N	(XID uj3j3j) The domain “ranamudassar.hosted.com” already exists in the userdata.	2026-03-14 14:11:00.338354
a2a3e80c-eebc-46a8-bb83-9f7b5da3e1cb	29bbe0c8-52e2-4292-bd42-9063cdb77c63	f008355f-1383-4d29-9606-18dda5476801	createacct	success	{"username":"wscreati","domain":"wscreations.store","password":"***","plan":"noehoster_Starter","contactemail":"ashgeradnan19@gmail.com"}	{"metadata":{"version":1,"result":1,"command":"createacct","reason":"Account Creation Ok","output":{"raw":"<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Checking input data...</span><pre style=\\"margin: 0;\\">Dns Zone check is enabled.\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0; margin-left: 1rem;\\"><span style=\\"white-space: pre-wrap;\\">Validating Username...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0; margin-left: 1rem;\\"><span style=\\"white-space: pre-wrap;\\">Validating IP...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0; margin-left: 1rem;\\"><span style=\\"white-space: pre-wrap;\\">Validating Contact Email...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Checking for database conflicts...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Checking for account enhancements...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">WWWAcct 12.6.0 (c) 4444413 cPanel, L.L.C....</span><pre style=\\"margin: 0;\\">\\n\\n+===================================+\\n| New Account Info                  |\\n+===================================+\\n| Domain: wscreations.store\\n| Ip: 176.9.63.151 (n)\\n| HasCgi: y\\n| UserName: wscreati\\n| PassWord: Ye457eCYjhW8@f\\n| CpanelMod: jupiter\\n| HomeRoot: /home\\n| Quota: 87.89 GB\\n| NameServer1: dns1.cloudpowerdns.com\\n| NameServer2: dns2.cloudpowerdns.com\\n| NameServer3: \\n| NameServer4: \\n| Contact Email: ashgeradnan19@gmail.com\\n| Package: noehoster_Starter\\n| Feature List: noehoster_Starter\\n| Account Enhancements: None\\n| Language: en\\n+===================================+\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\nCustom Account Data Provided: no\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Running pre creation script (/usr/local/cpanel/scripts/prewwwacct)...</span><pre style=\\"margin: 0;\\">Ok\\n\\nSuccess</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up System User...</span><pre style=\\"margin: 0;\\">Removing Shell Access (n)\\nSuccess</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Userdata...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Home Directory...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Mail...</span><pre style=\\"margin: 0;\\">valiases ...vdomainaliases ...vfilters ...</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Calendar and Contacts...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Configuring DNS...</span><pre style=\\"margin: 0;\\">Zone wscreations.store has been successfully added\\nZone wscreations.store has been successfully added\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Verifying MX Records and Setting up Databases...</span><pre style=\\"margin: 0;\\">Reconfiguring Mail Routing:\\n<ul><li>LOCAL MAIL EXCHANGER: This server will serve as a primary mail exchanger for wscreations.store's mail.:<br /> This configuration has been manually selected.<br /><br /></li></ul></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting up Service Subdomains...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Updating Authentication Databases...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Setting passwords...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Creating DMARC record...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Updating the userdata cache...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Creating bandwidth datastore...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Updating the dedicated IP address usage cache...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Generating and installing DKIM keys...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Enabling Apache SpamAssassin™...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Enabling Apache SpamAssassin™ Spam Box...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Sending Account Information...</span><pre style=\\"margin: 0;\\"></pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Running post creation scripts (/usr/local/cpanel/scripts/legacypostwwwacct, /usr/local/cpanel/scripts/postwwwacct, /usr/local/cpanel/scripts/postwwwacctuser)...</span><pre style=\\"margin: 0;\\">Deprecated script\\n</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\nwwwacct creation finished\\n<div style=\\"border-bottom: 1px #ccc dotted; font: 12px 'Andale Mono', 'Courier New', Courier, monospace; padding: .5em 0;\\"><span style=\\"white-space: pre-wrap;\\">Account Creation Complete!!!...</span><pre style=\\"margin: 0;\\">Account Creation Ok</pre><span style=\\"white-space: pre;\\">...Done</span><img style=\\"float: right;\\" src=\\"/cPanel_magic_revision_1739248610/cjt/images/icons/success.png\\"></div>\\n"}},"data":{"nameservera3":null,"nameserverentry3":null,"ip":"176.9.63.151","nameservera4":null,"nameservera":null,"nameservera2":null,"nameserver3":"","package":"noehoster_Starter","nameserverentry":null,"nameserver4":"","nameserver2":"dns2.cloudpowerdns.com","nameserverentry4":null,"nameserverentry2":null,"nameserver":"dns1.cloudpowerdns.com"}}	\N	2026-03-23 09:27:39.12383
\.


--
-- Data for Name: servers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.servers (id, name, hostname, ip_address, type, api_username, api_token, api_port, ns1, ns2, max_accounts, status, group_id, is_default, created_at, updated_at) FROM stdin;
f008355f-1383-4d29-9606-18dda5476801	spg1	spg1.cloudpowerdns.com	176.9.63.151	cpanel	noehoster	WHNSI5P6R2VPWAZF84VMUFTIMMVEOXEN	2087	ns25.nexgohost.com	ns26.nexgohost.com	50	active	05f3d2fc-5268-4890-9d20-b88b51f50bf7	f	2026-03-13 16:17:56.851769	2026-03-14 05:00:52.908
8c9c44af-cac1-484c-b62f-68503121198c	Nexpanel	Nexpanel	35.197.225.59	20i	\N	c5e1774c3ba0c8699+cca19635274219aa1	2087	dns1.nexgohost.com	dns2.nexgohost.com	500	active	97cf821b-782b-4c63-97fd-4ad3dd9ecbc1	f	2026-03-14 04:44:24.851776	2026-03-14 08:09:17.237
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.settings (key, value, updated_at) FROM stdin;
email_verification_enabled	false	2026-03-14 08:44:59.699
\.


--
-- Data for Name: ticket_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ticket_messages (id, ticket_id, sender_id, sender_name, sender_role, message, attachments, created_at) FROM stdin;
a05a0e2b-1ed0-403e-881c-340c75e396ab	2de200dc-61f9-4c67-9959-e57018877fc5	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	Rana mudassar	client	trgtrgtrtr	{}	2026-03-13 09:29:45.924244
643499f3-64b7-438a-9f3c-4399ce6e3343	2de200dc-61f9-4c67-9959-e57018877fc5	ae080a35-39e9-4b34-a780-eea69767bf57	Admin Nexgohost	admin	tke ha	{}	2026-03-13 14:39:55.470792
6056ab70-e2d7-4441-bda4-aa1c37c2930e	2de200dc-61f9-4c67-9959-e57018877fc5	ae080a35-39e9-4b34-a780-eea69767bf57	Admin Nexgohost	admin	kk\n	{}	2026-03-24 10:34:01.201895
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tickets (id, ticket_number, client_id, subject, status, priority, department, messages_count, last_reply, created_at, updated_at) FROM stdin;
25574e02-4c58-4208-a6fa-a8e234c6a0cc	TKT-2025-001	907edddc-4e8b-453b-8530-8bc17d38c629	Cannot access cPanel dashboard	open	high	Technical Support	2	2026-03-13 07:45:06.156655	2026-03-13 06:45:06.156655	2026-03-13 08:45:06.156655
f9ca1c91-184e-470b-8a57-34a430a0d7d7	TKT-2025-002	68b07e1d-5641-41e7-939b-b3b419e08c61	Question about upgrading my hosting plan	answered	medium	Billing	3	2026-03-12 08:45:06.156655	2026-03-11 08:45:06.156655	2026-03-13 08:45:06.156655
465356f9-c137-4e7c-91db-1698b2256e4f	TKT-2025-003	907edddc-4e8b-453b-8530-8bc17d38c629	SSL certificate not working	closed	urgent	Technical Support	5	2026-03-08 08:45:06.156655	2026-03-06 08:45:06.156655	2026-03-13 08:45:06.156655
2de200dc-61f9-4c67-9959-e57018877fc5	TKT-1773394185890	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ergergwerger	answered	high	Technical Support	3	2026-03-24 10:34:01.231	2026-03-13 09:29:45.891368	2026-03-24 10:34:01.231
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, client_id, invoice_id, amount, method, status, transaction_ref, created_at) FROM stdin;
2e4d9a54-4657-4dc6-90be-e866b0ebadf8	907edddc-4e8b-453b-8530-8bc17d38c629	21c27d9b-0062-48c2-aa5c-75e0e3c45f26	9.99	stripe	success	pi_d28cb01325464dcbb21270ebf1c1bd5a	2026-02-16 08:45:06.156655
165cb870-97da-41d4-b81b-83c0c407aae1	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	2eb809ec-43d1-4fdc-bfa4-2790dcb6c87a	25.98	stripe	pending	TXN-1773393934242	2026-03-13 09:25:34.242955
10832fb2-2332-469a-85d3-a752c89e616e	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	bff66f50-7124-4f88-b599-472b096fe957	10.92	manual	success	MANUAL-1773497395607	2026-03-14 14:09:55.607837
a742e3a3-27c4-4118-86a7-022949fc6b23	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	bff66f50-7124-4f88-b599-472b096fe957	10.92	manual	success	MANUAL-1773497395617	2026-03-14 14:09:55.618011
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, first_name, last_name, email, password_hash, company, phone, role, status, email_verified, verification_code, verification_expires_at, two_factor_secret, two_factor_enabled, google_id, credit_balance, created_at, updated_at) FROM stdin;
ae080a35-39e9-4b34-a780-eea69767bf57	Admin	Nexgohost	admin@nexgohost.com	$2b$10$2OCMdNuX8ArwlTrPyPc5luVV2W2/70dHUcfHmdjm0r5AKmPwwJAse	Nexgohost Ltd	+1-555-0100	admin	active	f	\N	\N	\N	f	\N	0.00	2026-03-13 08:44:09.935388	2026-03-13 08:44:09.935388
907edddc-4e8b-453b-8530-8bc17d38c629	John	Smith	john@example.com	$2b$10$0hy7lr7Dg4p2lbZ1Rov/luLQuttg9o34rM6q6QS7EoX1FuOqDkejy	Smith Web Solutions	+1-555-0101	client	active	f	\N	\N	\N	f	\N	0.00	2026-03-13 08:44:09.935388	2026-03-13 08:44:09.935388
68b07e1d-5641-41e7-939b-b3b419e08c61	Jane	Doe	jane@example.com	$2b$10$0hy7lr7Dg4p2lbZ1Rov/luLQuttg9o34rM6q6QS7EoX1FuOqDkejy	Doe Digital	+1-555-0102	client	active	f	\N	\N	\N	f	\N	0.00	2026-03-13 08:44:09.935388	2026-03-13 08:44:09.935388
3a3e3fd0-cbc8-4414-92e5-b032c4a97887	Curl	Test	curltest_final2@example.com	$2b$12$WsLrH5lZF1wDB0/.1QlIt.VabaTk2Jr5NPwGsBch7NORZEhxeTEz6	\N	\N	client	active	f	\N	\N	\N	f	\N	0.00	2026-03-13 10:13:55.356495	2026-03-13 10:13:55.356495
737334a5-26c7-4f02-ba96-7d84c8cc2161	Alice	Wonder	alice.wonder.e2e@example.com	$2b$12$XQOt1l80QfTNh5MYQr3nXO5yGJ3gBeWvo0Dz3llR8m9dbj.qOMEmq	\N	\N	client	active	f	\N	\N	\N	f	\N	0.00	2026-03-13 10:16:50.40149	2026-03-13 10:16:50.40149
96b440bb-4229-44c3-ae54-2c16784423de	Final	User	finaluser.e2e@example.com	$2b$12$2Ry6qR5q3pgFLiU/OPeUC.SQjgZ7PpQNLHzByu8p7vdPB7lCSG3Ja	\N	\N	client	active	f	\N	\N	\N	f	\N	0.00	2026-03-13 10:21:00.955904	2026-03-13 10:21:00.955904
cb3dfdec-2026-4569-a860-e56400f4ebb9	test	best	wefefde@outlook.com	$2b$12$cVZ0daflnEYc3rD0n97oAOvQIYzLjFlM0sw/xSihqeJB0fkMrv9KW	\N	frerferf443	client	active	f	\N	\N	\N	f	\N	0.00	2026-03-13 17:27:36.376358	2026-03-13 17:27:36.376358
02bd192d-3426-4e90-af54-7a7ba5df0419	rana	arsu	ranaarsu059@gmail.com	$2b$12$o6/mCHuY/mjabILP/nqcpeVOvvIjnLZJ17THcF/YWOPCWoZHst6ui	\N	03151711821	client	active	f	998200	2026-03-14 05:44:56.049	\N	f	\N	0.00	2026-03-14 05:03:50.147005	2026-03-14 05:34:56.049
9c948ad4-0116-414c-9a8a-fa08f71e0ab1	Rana	mudassar	ranamudassar3291@gmail.com	$2b$12$3vxaqtxRFj/.31BIBgFVH..kgOr1yIV7xU8IW3g8wvlVGlq2SWVOG		3271711821	client	active	f	677316	2026-03-14 14:21:00.354	\N	f	\N	0.00	2026-03-13 09:06:05.796301	2026-03-14 14:11:00.354
bd2cfb49-79ca-485a-afb0-2af3ea58c813	Ashger	Adnan	ashgeradnan19@gmail.com	$2b$12$F27TYsezZ/dXAXMSehuyhequS1SHK/wz.oKRVBUoO9m/uf1XlxsyK	\N	432553272	client	active	t	\N	\N	BQ5VLZ2OIEKNHF3CGRYZUVZMHOZUONAP	f	\N	770.00	2026-03-23 08:46:45.511534	2026-03-24 14:54:10.043
\.


--
-- Data for Name: vps_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vps_locations (id, country_name, country_code, flag_icon, is_active, created_at) FROM stdin;
62bdeb02-c22e-4dbf-87be-eedbf6ed0d47	United States	US	🇺🇸	t	2026-03-24 17:37:30.80361
1518e5d8-a5a1-40dc-ada4-2e1fb16341c1	United Kingdom	GB	🇬🇧	t	2026-03-24 17:37:30.80361
2eab917a-079e-4411-ad55-b7a85ce26202	Germany	DE	🇩🇪	t	2026-03-24 17:37:30.80361
1e5e0450-f548-40c2-a305-cc0030ece484	Singapore	SG	🇸🇬	t	2026-03-24 17:37:30.80361
\.


--
-- Data for Name: vps_os_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vps_os_templates (id, name, version, icon_url, is_active, created_at) FROM stdin;
168aa3dc-2ed9-43c5-83a2-4e9c1919831d	Ubuntu	22.04 LTS	https://cdn.simpleicons.org/ubuntu/E95420	t	2026-03-24 17:37:30.798823
2b270049-3f1c-4216-9e34-31ef1bdfa399	Ubuntu	20.04 LTS	https://cdn.simpleicons.org/ubuntu/E95420	t	2026-03-24 17:37:30.798823
e2dd0c8d-4cf7-46d5-af22-6b8b6d948d77	Debian	12 Bookworm	https://cdn.simpleicons.org/debian/A81D33	t	2026-03-24 17:37:30.798823
1c2da9ca-a867-4105-ac03-9788c80ee632	CentOS	7	https://cdn.simpleicons.org/centos/262577	t	2026-03-24 17:37:30.798823
293937b3-223d-4f57-b42e-3e4d345b6ed1	AlmaLinux	9	https://cdn.simpleicons.org/almalinux/ACE3B0	t	2026-03-24 17:37:30.798823
841562cf-d47e-4aba-9f29-4179938fcdcc	Windows Server	2022	https://cdn.simpleicons.org/windows/0078D4	t	2026-03-24 17:37:30.798823
78a7bbcd-9d88-4ed1-9ddc-79ea64bfda4b	CentOS	Stream 9	https://cdn.simpleicons.org/centos/262577	t	2026-03-24 17:38:17.330974
35c35029-99d1-4a6e-8bae-f595f4e62b26	Windows Server	2019	https://cdn.simpleicons.org/windows/0078D4	t	2026-03-24 17:38:18.687147
4db5afb5-be2e-43da-97ed-ac45129be357	Rocky Linux	9	https://cdn.simpleicons.org/rockylinux/10B981	t	2026-03-24 17:38:19.321659
\.


--
-- Data for Name: vps_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vps_plans (id, name, description, price, yearly_price, cpu_cores, ram_gb, storage_gb, bandwidth_tb, virtualization, features, os_template_ids, location_ids, save_amount, is_active, sort_order, created_at) FROM stdin;
e2f8b691-f3bf-47d5-848d-3b76b1d0dcb3	VPS 1	Entry-level KVM server for small projects and testing.	1500.00	9000.00	1	4	50	1.00	KVM	{"Full Root Access","DDoS Protection","Dedicated IP","99.9% Uptime SLA","Instant Provisioning"}	{}	{}	9000.00	t	1	2026-03-24 17:37:30.786165
2be3cc59-d256-4abe-a2e1-832539e24333	VPS 2	Balanced cloud server for growing web applications.	3500.00	21000.00	2	8	100	2.00	KVM	{"Full Root Access","DDoS Protection","Dedicated IP","99.9% Uptime SLA","Instant Provisioning","Free cPanel License"}	{}	{}	21000.00	t	2	2026-03-24 17:37:30.786165
cbc456df-3982-4a71-b603-870b3571e4c4	VPS 3	High-performance server for demanding workloads and databases.	7500.00	45000.00	4	16	200	4.00	KVM	{"Full Root Access","DDoS Protection","Dedicated IP","99.9% Uptime SLA","Instant Provisioning","Free cPanel License","Priority Support"}	{293937b3-223d-4f57-b42e-3e4d345b6ed1,1c2da9ca-a867-4105-ac03-9788c80ee632,2b270049-3f1c-4216-9e34-31ef1bdfa399,841562cf-d47e-4aba-9f29-4179938fcdcc,e2dd0c8d-4cf7-46d5-af22-6b8b6d948d77,168aa3dc-2ed9-43c5-83a2-4e9c1919831d}	{2eab917a-079e-4411-ad55-b7a85ce26202,1e5e0450-f548-40c2-a305-cc0030ece484,1518e5d8-a5a1-40dc-ada4-2e1fb16341c1,62bdeb02-c22e-4dbf-87be-eedbf6ed0d47}	45000.00	t	3	2026-03-24 17:37:30.786165
\.


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: admin_logs admin_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_pkey PRIMARY KEY (id);


--
-- Name: affiliate_clicks affiliate_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_clicks
    ADD CONSTRAINT affiliate_clicks_pkey PRIMARY KEY (id);


--
-- Name: affiliate_commissions affiliate_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_pkey PRIMARY KEY (id);


--
-- Name: affiliate_group_commissions affiliate_group_commissions_group_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_group_commissions
    ADD CONSTRAINT affiliate_group_commissions_group_id_unique UNIQUE (group_id);


--
-- Name: affiliate_group_commissions affiliate_group_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_group_commissions
    ADD CONSTRAINT affiliate_group_commissions_pkey PRIMARY KEY (id);


--
-- Name: affiliate_referrals affiliate_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_referrals
    ADD CONSTRAINT affiliate_referrals_pkey PRIMARY KEY (id);


--
-- Name: affiliate_withdrawals affiliate_withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_withdrawals
    ADD CONSTRAINT affiliate_withdrawals_pkey PRIMARY KEY (id);


--
-- Name: affiliates affiliates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_pkey PRIMARY KEY (id);


--
-- Name: affiliates affiliates_referral_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_referral_code_unique UNIQUE (referral_code);


--
-- Name: affiliates affiliates_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_user_id_unique UNIQUE (user_id);


--
-- Name: credit_transactions credit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_pkey PRIMARY KEY (id);


--
-- Name: cron_logs cron_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cron_logs
    ADD CONSTRAINT cron_logs_pkey PRIMARY KEY (id);


--
-- Name: currencies currencies_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.currencies
    ADD CONSTRAINT currencies_code_unique UNIQUE (code);


--
-- Name: currencies currencies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.currencies
    ADD CONSTRAINT currencies_pkey PRIMARY KEY (id);


--
-- Name: dns_records dns_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dns_records
    ADD CONSTRAINT dns_records_pkey PRIMARY KEY (id);


--
-- Name: domain_extensions domain_extensions_extension_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.domain_extensions
    ADD CONSTRAINT domain_extensions_extension_unique UNIQUE (extension);


--
-- Name: domain_extensions domain_extensions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.domain_extensions
    ADD CONSTRAINT domain_extensions_pkey PRIMARY KEY (id);


--
-- Name: domain_pricing domain_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.domain_pricing
    ADD CONSTRAINT domain_pricing_pkey PRIMARY KEY (id);


--
-- Name: domain_pricing domain_pricing_tld_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.domain_pricing
    ADD CONSTRAINT domain_pricing_tld_unique UNIQUE (tld);


--
-- Name: domain_transfers domain_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.domain_transfers
    ADD CONSTRAINT domain_transfers_pkey PRIMARY KEY (id);


--
-- Name: domains domains_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_pkey PRIMARY KEY (id);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_slug_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_slug_unique UNIQUE (slug);


--
-- Name: fraud_logs fraud_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fraud_logs
    ADD CONSTRAINT fraud_logs_pkey PRIMARY KEY (id);


--
-- Name: hosting_backups hosting_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hosting_backups
    ADD CONSTRAINT hosting_backups_pkey PRIMARY KEY (id);


--
-- Name: hosting_plans hosting_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hosting_plans
    ADD CONSTRAINT hosting_plans_pkey PRIMARY KEY (id);


--
-- Name: hosting_services hosting_services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hosting_services
    ADD CONSTRAINT hosting_services_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: migrations_requests migrations_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations_requests
    ADD CONSTRAINT migrations_requests_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: password_resets password_resets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_pkey PRIMARY KEY (token);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: product_groups product_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_groups
    ADD CONSTRAINT product_groups_pkey PRIMARY KEY (id);


--
-- Name: product_groups product_groups_slug_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_groups
    ADD CONSTRAINT product_groups_slug_unique UNIQUE (slug);


--
-- Name: promo_codes promo_codes_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_code_unique UNIQUE (code);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: server_groups server_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_groups
    ADD CONSTRAINT server_groups_pkey PRIMARY KEY (id);


--
-- Name: server_logs server_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.server_logs
    ADD CONSTRAINT server_logs_pkey PRIMARY KEY (id);


--
-- Name: servers servers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: ticket_messages ticket_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_messages
    ADD CONSTRAINT ticket_messages_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_ticket_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ticket_number_unique UNIQUE (ticket_number);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vps_locations vps_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vps_locations
    ADD CONSTRAINT vps_locations_pkey PRIMARY KEY (id);


--
-- Name: vps_os_templates vps_os_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vps_os_templates
    ADD CONSTRAINT vps_os_templates_pkey PRIMARY KEY (id);


--
-- Name: vps_plans vps_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vps_plans
    ADD CONSTRAINT vps_plans_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict oX4GxwY9lkpc1oXOJgJpbUu47FnslssQhVp2E8MjXyR3wM4xZZRg2CfESZujsdU

