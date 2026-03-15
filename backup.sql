--
-- PostgreSQL database dump
--

\restrict lf3nRiW3bNx8xfJHiADLlHDxbgax0qMitGYa26nUHuHJ3OFs8IqltEjfkqcqhFj

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
-- Name: billing_cycle; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.billing_cycle AS ENUM (
    'monthly',
    'yearly'
);


ALTER TYPE public.billing_cycle OWNER TO postgres;

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
    'cancelled'
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
    'manual'
);


ALTER TYPE public.payment_method OWNER TO postgres;

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

SET default_tablespace = '';

SET default_table_access_method = heap;

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
-- Name: domain_extensions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.domain_extensions (
    id text NOT NULL,
    extension text NOT NULL,
    register_price numeric(10,2) NOT NULL,
    renewal_price numeric(10,2) NOT NULL,
    transfer_price numeric(10,2) NOT NULL,
    status public.extension_status DEFAULT 'active'::public.extension_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    privacy_enabled boolean DEFAULT true NOT NULL
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
-- Name: domains; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.domains (
    id text NOT NULL,
    client_id text NOT NULL,
    name text NOT NULL,
    tld text NOT NULL,
    registration_date timestamp without time zone DEFAULT now(),
    expiry_date timestamp without time zone,
    status public.domain_status DEFAULT 'pending'::public.domain_status NOT NULL,
    auto_renew boolean DEFAULT true,
    nameservers text[] DEFAULT '{}'::text[],
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    registrar text DEFAULT ''::text,
    next_due_date timestamp without time zone,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    module_server_id text
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
    sent_at timestamp without time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'success'::text NOT NULL,
    error_message text
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
-- Name: hosting_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hosting_plans (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    billing_cycle public.billing_cycle DEFAULT 'monthly'::public.billing_cycle NOT NULL,
    disk_space text NOT NULL,
    bandwidth text NOT NULL,
    email_accounts integer DEFAULT 10,
    databases integer DEFAULT 5,
    subdomains integer DEFAULT 10,
    ftp_accounts integer DEFAULT 5,
    is_active boolean DEFAULT true,
    features text[] DEFAULT '{}'::text[],
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    yearly_price numeric(10,2),
    group_id text,
    module text DEFAULT 'none'::text,
    module_plan_id text,
    module_plan_name text,
    module_server_id text,
    module_server_group_id text
);


ALTER TABLE public.hosting_plans OWNER TO postgres;

--
-- Name: hosting_services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hosting_services (
    id text NOT NULL,
    client_id text NOT NULL,
    plan_id text NOT NULL,
    plan_name text NOT NULL,
    domain text,
    username text,
    server_ip text DEFAULT '192.168.1.1'::text,
    status public.hosting_status DEFAULT 'pending'::public.hosting_status NOT NULL,
    start_date timestamp without time zone DEFAULT now(),
    expiry_date timestamp without time zone,
    disk_used text DEFAULT '0 MB'::text,
    bandwidth_used text DEFAULT '0 GB'::text,
    cpanel_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    password text,
    server_id text,
    billing_cycle text DEFAULT 'monthly'::text,
    next_due_date timestamp without time zone,
    ssl_status text DEFAULT 'not_installed'::text,
    webmail_url text,
    cancel_requested boolean DEFAULT false,
    cancel_reason text,
    cancel_requested_at timestamp without time zone
);


ALTER TABLE public.hosting_services OWNER TO postgres;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id text NOT NULL,
    invoice_number text NOT NULL,
    client_id text NOT NULL,
    amount numeric(10,2) NOT NULL,
    tax numeric(10,2) DEFAULT '0'::numeric,
    total numeric(10,2) NOT NULL,
    status public.invoice_status DEFAULT 'unpaid'::public.invoice_status NOT NULL,
    due_date timestamp without time zone NOT NULL,
    paid_date timestamp without time zone,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    order_id text,
    service_id text
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
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id text NOT NULL,
    client_id text NOT NULL,
    type public.order_type NOT NULL,
    item_id text,
    item_name text NOT NULL,
    amount numeric(10,2) NOT NULL,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    domain text,
    billing_cycle text DEFAULT 'monthly'::text,
    due_date timestamp without time zone,
    module_type text DEFAULT 'none'::text,
    module_plan_id text,
    module_plan_name text,
    module_server_id text,
    payment_status text DEFAULT 'unpaid'::text,
    invoice_id text
);


ALTER TABLE public.orders OWNER TO postgres;

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
    discount_percent integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    usage_limit integer,
    used_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
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
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    group_id text
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
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    verification_code text,
    verification_expires_at timestamp without time zone,
    two_factor_secret text,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    google_id text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: admin_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_logs (id, user_id, email, action, method, status, ip_address, user_agent, details, created_at) FROM stdin;
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
\.


--
-- Data for Name: currencies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.currencies (id, code, name, symbol, exchange_rate, is_default, is_active, created_at) FROM stdin;
f2e85bbc-6410-48fb-8505-a4cb84c01d5f	PKR	Pakistani Rupee	RS	1.0000	t	t	2026-03-13 13:12:26.473283
9dac726d-1128-4dea-a1aa-d5ce99bab491	USD	US Dollar	$	0.0036	f	t	2026-03-13 13:12:26.980248
32cf2364-6494-40ad-b798-efbc946e143a	GBP	British Pound	GBP	0.0027	f	t	2026-03-13 13:12:27.018693
6fff218c-9f9a-43d2-b128-0c6657906f0f	EUR	Euro	EUR	0.0031	f	t	2026-03-13 13:12:27.054945
\.


--
-- Data for Name: domain_extensions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.domain_extensions (id, extension, register_price, renewal_price, transfer_price, status, created_at, updated_at, privacy_enabled) FROM stdin;
00fa5a7e-5a25-4a00-8642-1b69ce47db92	.com	0.99	0.99	0.99	active	2026-03-13 13:12:49.017717	2026-03-13 13:12:49.017717	t
6108cc52-3f75-41b5-813a-4a403c84cef4	.net	0.89	0.89	0.89	active	2026-03-13 13:12:49.184865	2026-03-13 13:12:49.184865	t
b96317d1-4691-4236-980c-e0733d738d58	.org	0.85	0.85	0.85	active	2026-03-13 13:12:49.343309	2026-03-13 13:12:49.343309	t
3c3efa3d-961b-436c-9f70-fed1b8504684	.pk	0.50	0.50	0.50	active	2026-03-13 13:12:49.507256	2026-03-13 13:12:49.507256	t
b8be74ca-8c2a-4982-91f4-8f46325de8be	.io	3.49	3.49	4.99	active	2026-03-13 13:12:49.670483	2026-03-13 13:12:49.670483	t
162f0d19-b711-407d-8b17-23e9392fcec0	.co	1.99	1.99	2.99	active	2026-03-13 13:12:49.828251	2026-03-13 13:12:49.828251	t
071f449a-c6cf-492b-a885-8a44445b16e2	.info	0.75	0.75	0.75	active	2026-03-13 13:12:49.989337	2026-03-13 13:12:49.989337	t
fd0375b2-7489-4e85-90b3-e9c1c964583e	.biz	0.80	0.80	0.80	active	2026-03-13 13:12:50.156572	2026-03-13 13:12:50.156572	t
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
-- Data for Name: domains; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.domains (id, client_id, name, tld, registration_date, expiry_date, status, auto_renew, nameservers, created_at, registrar, next_due_date, updated_at, module_server_id) FROM stdin;
103182b5-3a5f-488e-a9a6-160c9962399d	907edddc-4e8b-453b-8530-8bc17d38c629	johnsmith	.com	2025-03-13 08:45:06.156655	2027-02-13 08:45:06.156655	active	t	{ns1.nexgohost.com,ns2.nexgohost.com}	2026-03-13 08:45:06.156655		\N	2026-03-13 13:45:55.887116	\N
f03628a5-0d65-427e-8d05-18b2a8cb48a4	907edddc-4e8b-453b-8530-8bc17d38c629	johnsmith-blog	.net	2025-09-13 08:45:06.156655	2026-09-13 08:45:06.156655	active	t	{ns1.nexgohost.com,ns2.nexgohost.com}	2026-03-13 08:45:06.156655		\N	2026-03-13 13:45:55.887116	\N
fa0f738e-b454-45aa-a3e9-0eb1bc6d462c	68b07e1d-5641-41e7-939b-b3b419e08c61	doedigital	.com	2024-03-13 08:45:06.156655	2027-01-13 08:45:06.156655	active	f	{ns1.nexgohost.com,ns2.nexgohost.com}	2026-03-13 08:45:06.156655		\N	2026-03-13 13:45:55.887116	\N
5436e08d-a947-48b2-8633-37876de108d7	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hrthrfgg	.com	2026-03-13 09:25:07.381	2028-03-13 09:25:07.381	active	t	{ns1.nexgohost.com,ns2.nexgohost.com}	2026-03-13 09:25:07.383547		\N	2026-03-13 13:45:55.887116	\N
435ed6d2-bea2-4c9e-98c5-449eca7b31bd	02bd192d-3426-4e90-af54-7a7ba5df0419	noehostd	.com	2026-03-14 08:46:41.519	2027-03-14 08:46:41.519	active	t	{ns1.nexgohost.com,ns2.nexgohost.com}	2026-03-14 08:46:41.521285		\N	2026-03-14 08:46:41.521285	\N
\.


--
-- Data for Name: email_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_logs (id, client_id, email, email_type, subject, reference_id, sent_at, status, error_message) FROM stdin;
cdee179d-0645-4c4d-af16-6607e73cd7bf	907edddc-4e8b-453b-8530-8bc17d38c629	john@example.com	invoice_reminder_7d	Invoice INV-2025-002 due in 7 days	0ebaab51-b2f3-42fe-9054-1f7b6a1fdd21	2026-03-13 18:48:21.630192	success	\N
f0e5302d-6bd6-4ac9-a5cb-4b19a6c8570e	907edddc-4e8b-453b-8530-8bc17d38c629	john@example.com	invoice_reminder_7d	Invoice INV-20260313-LK047A due in 7 days	4f3fc23f-a15e-427b-a301-5f09900ab99b	2026-03-13 18:48:21.974323	success	\N
16c7119a-1c12-49c6-a37a-f33f23ea27b0	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ranamudassar3291@gmail.com	invoice_reminder_7d	Invoice INV-20260313-I5V1KP due in 7 days	ff1d869e-e8a4-4a4d-815c-77c8796ccad8	2026-03-13 18:48:21.978696	success	\N
5f39baf4-10d8-4c43-a268-d05534d0227f	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ranamudassar3291@gmail.com	invoice_reminder_7d	Invoice INV-20260313-LZ5GJ3 due in 7 days	b91e658b-418b-46dc-911d-7c7802e8fbbc	2026-03-13 18:48:21.982441	success	\N
1322d274-4341-4592-8d0d-f225e7875cfa	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ranamudassar3291@gmail.com	invoice_reminder_7d	Invoice INV-20260314-19IADO due in 7 days	9a8f9d32-6ca7-4212-812e-8ca90b2d5a17	2026-03-14 05:09:57.045701	success	\N
c739a326-8d06-4bd1-a1b2-bd52c4f17957	\N	wefefde@outlook.com	hosting-created	Your Hosting Account is Ready — testadmin.com	\N	2026-03-14 06:01:29.99564	failed	SMTP not configured
4b226492-ad51-4edd-9ed9-c74b82450179	\N	curltest_final2@example.com	hosting-created	Your Hosting Account is Ready — hostingmanage.com	\N	2026-03-14 06:09:41.334353	failed	SMTP not configured
258310e9-b671-403d-af6a-52d6e17716e8	\N	finaluser.e2e@example.com	hosting-created	Your Hosting Account is Ready — getyourplan.com	\N	2026-03-14 06:36:11.24874	failed	SMTP not configured
d512371f-b47a-4c27-8e7a-58f7c6ddf572	\N	3a3e3fd0-cbc8-4414-92e5-b032c4a97887	service-suspended	Service Suspended — {domain}	\N	2026-03-14 07:04:35.143819	failed	SMTP not configured
86c820ff-7f8d-4883-992c-9a90b7986a79	\N	3a3e3fd0-cbc8-4414-92e5-b032c4a97887	service-suspended	Service Suspended — {domain}	\N	2026-03-14 07:05:52.890486	failed	SMTP not configured
39e0ac08-991a-423c-ad7e-5917de19dd81	\N	96b440bb-4229-44c3-ae54-2c16784423de	service-suspended	Service Suspended — {domain}	\N	2026-03-14 07:14:51.99208	failed	SMTP not configured
e803ff6f-3ade-414e-bf4b-ebefbc05de07	\N	finaluser.e2e@example.com	service-suspended	Service Suspended — getyourplan.com	\N	2026-03-14 07:24:52.731694	failed	SMTP not configured
64929bcf-2f74-40f8-a007-13a0f802f864	\N	finaluser.e2e@example.com	service-suspended	Service Suspended — getyourplan.com	\N	2026-03-14 07:26:42.36836	failed	SMTP not configured
d054343d-cc0f-4fc8-8271-74925f899309	\N	testverify_on@test.com	email-verification	Verify Your Email Address	\N	2026-03-14 08:43:29.239217	failed	SMTP not configured
25d89529-ca3e-4679-affa-2a247140fcfe	02bd192d-3426-4e90-af54-7a7ba5df0419	ranaarsu059@gmail.com	invoice_reminder_7d	Invoice INV-2026-026 due in 7 days	3fd0c7e2-a87e-4725-8c0f-a5a838c9f28f	2026-03-14 08:47:48.851663	success	\N
3eb187d2-812b-4707-8bb6-b1faacc8fe17	\N	ranamudassar3291@gmail.com	order-created	Order Confirmed — Starter	\N	2026-03-14 14:09:41.54654	failed	SMTP not configured
8d049312-2336-473b-8917-575bf4cb902a	\N	ranamudassar3291@gmail.com	invoice-created	Invoice #INV-20260314-L5BDAJ — Nexgohost	\N	2026-03-14 14:09:41.546991	failed	SMTP not configured
66282f2c-ef41-4fd2-97a9-a51e9e001388	\N	ranamudassar3291@gmail.com	hosting-created	Your Hosting Account is Ready — ranamudassar.hosted.com	\N	2026-03-14 14:11:00.337307	failed	SMTP not configured
5b059410-70e4-4054-b4ca-e32ff39930b9	\N	ranamudassar3291@gmail.com	email-verification	Verify Your Email Address	\N	2026-03-14 14:11:00.347663	failed	SMTP not configured
ea4685f4-2067-4722-b883-6f292aaedf1f	\N	ranamudassar3291@gmail.com	hosting-created	Your Hosting Account is Ready — ranamudassar.hosted.com	\N	2026-03-14 14:11:00.349788	failed	SMTP not configured
9f6fda8d-e196-4ba6-b2da-b01d7905a101	\N	ranamudassar3291@gmail.com	invoice-paid	Payment Received — Invoice #INV-20260314-L5BDAJ	\N	2026-03-14 14:11:00.354092	failed	SMTP not configured
b2481572-e4c8-4b43-be06-ea349de66132	\N	ranamudassar3291@gmail.com	email-verification	Verify Your Email Address	\N	2026-03-14 14:11:00.360245	failed	SMTP not configured
fd47eb18-c5c8-49d1-ac69-ed3e64ea6e28	\N	ranamudassar3291@gmail.com	invoice-paid	Payment Received — Invoice #INV-20260314-L5BDAJ	\N	2026-03-14 14:11:00.366179	failed	SMTP not configured
\.


--
-- Data for Name: email_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_templates (id, name, slug, subject, body, variables, is_active, created_at, updated_at) FROM stdin;
4603f9f3-a649-4012-949f-4509bc7e31f5	Invoice Created	invoice-created	Invoice #{invoice_id} — {company_name}	Hi {client_name},\n\nA new invoice has been generated for your account.\n\nInvoice #: {invoice_id}\nAmount Due: {amount}\nDue Date: {due_date}\n\nPlease log in to your client area to view and pay this invoice.\n{client_area_url}\n\nThank you for your business.\n— {company_name} Team	{"{client_name}","{invoice_id}","{amount}","{due_date}","{client_area_url}","{company_name}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
f0d6cc1e-0ab7-47a0-9d84-7498e0d8a6ab	Invoice Payment Confirmation	invoice-paid	Payment Received — Invoice #{invoice_id}	Hi {client_name},\n\nWe have received your payment for Invoice #{invoice_id}.\n\nAmount Paid: {amount}\nPayment Date: {payment_date}\n\nThank you! Your services are now active.\n— {company_name} Team	{"{client_name}","{invoice_id}","{amount}","{payment_date}","{company_name}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
15339ef7-32af-48f9-930d-66888ece2315	New Order Confirmation	order-created	Order Confirmed — {service_name}	Hi {client_name},\n\nThank you for your order! We are setting up your account.\n\nService: {service_name}\nDomain: {domain}\nOrder #: {order_id}\n\nYou will receive login details once your hosting account is ready.\n— {company_name} Team	{"{client_name}","{service_name}","{domain}","{order_id}","{company_name}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
3605162a-c186-444a-aa0d-4c3dde098e7c	Hosting Account Created	hosting-created	Your Hosting Account is Ready — {domain}	Hi {client_name},\n\nYour hosting account has been successfully created!\n\n--- ACCOUNT DETAILS ---\nDomain: {domain}\nUsername: {username}\nPassword: {password}\ncPanel URL: {cpanel_url}\n\n--- NAMESERVERS ---\nNS1: {ns1}\nNS2: {ns2}\n\n--- WEBMAIL ---\nWebmail: {webmail_url}\n\n— {company_name} Team	{"{client_name}","{domain}","{username}","{password}","{cpanel_url}","{ns1}","{ns2}","{webmail_url}","{company_name}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
83ca2f4f-aba0-44f6-bcb7-316b14723077	Password Reset	password-reset	Password Reset Request	Hi {client_name},\n\nWe received a request to reset your password.\n\nClick the link below (expires in 24 hours):\n{reset_link}\n\nIf you did not request this, please ignore this email.\n— {company_name} Team	{"{client_name}","{reset_link}","{company_name}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
3551cbf0-7106-4b1b-a1ce-b73fb71a0a0f	Support Ticket Reply	ticket-reply	Re: [{ticket_number}] {ticket_subject}	Hi {client_name},\n\nA new reply has been added to your support ticket.\n\nTicket #: {ticket_number}\nSubject: {ticket_subject}\nDepartment: {department}\n\nReply:\n{reply_body}\n\nView & reply: {ticket_url}\n— {company_name} Support Team	{"{client_name}","{ticket_number}","{ticket_subject}","{department}","{reply_body}","{ticket_url}","{company_name}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
a44aef3a-a7dc-4cd4-8c56-13092f373c33	Service Suspended	service-suspended	Service Suspended — {domain}	Hi {client_name},\n\nYour hosting service for {domain} has been suspended.\n\nReason: {reason}\n\nTo reactivate, please pay outstanding invoices or contact support.\n{client_area_url}\n— {company_name} Team	{"{client_name}","{domain}","{reason}","{client_area_url}","{company_name}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
e36c959d-f3cc-464d-9829-5db2ef125441	Cancellation Confirmation	service-cancelled	Cancellation Processed — {domain}	Hi {client_name},\n\nYour cancellation request for {domain} has been processed.\n\nService: {service_name}\nCancellation Date: {cancel_date}\n\nWe're sorry to see you go. You're welcome back anytime!\n— {company_name} Team	{"{client_name}","{domain}","{service_name}","{cancel_date}","{company_name}"}	t	2026-03-13 14:25:45.835203	2026-03-13 14:25:45.835203
0bcc9e24-02b4-4669-af09-926c70ca0f61	Email Verification	email-verification	Verify Your Email Address	<div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px">\n<div style="max-width:600px;margin:auto;background:white;padding:30px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">\n\n<div style="text-align:center;margin-bottom:24px">\n  <h1 style="color:#6c5ce7;font-size:28px;margin:0;letter-spacing:-0.5px">Nexgohost</h1>\n</div>\n\n<h2 style="color:#333;font-size:20px;margin-bottom:8px">Verify your email address</h2>\n\n<p style="color:#555;line-height:1.6">Hello {{client_name}},</p>\n\n<p style="color:#555;line-height:1.6">Thank you for creating an account. To complete your registration, please enter the verification code below.</p>\n\n<div style="text-align:center;margin:28px 0">\n  <div style="display:inline-block;background:#f5f0ff;border:2px solid #6c5ce7;border-radius:12px;padding:20px 40px">\n    <p style="margin:0 0 4px 0;font-size:12px;color:#6c5ce7;text-transform:uppercase;letter-spacing:2px;font-weight:600">Your Code</p>\n    <p style="margin:0;font-size:36px;font-weight:bold;letter-spacing:10px;color:#2d2d2d;font-family:monospace">{{verification_code}}</p>\n  </div>\n</div>\n\n<p style="color:#555;line-height:1.6">This code will expire in <strong>10 minutes</strong>.</p>\n\n<p style="color:#555;line-height:1.6">If you did not create this account, you can safely ignore this email.</p>\n\n<hr style="border:none;border-top:1px solid #eee;margin:24px 0">\n\n<p style="font-size:12px;color:#999;margin:0">This email was sent automatically by the Nexgohost billing system. Please do not reply to this email.</p>\n\n</div>\n</div>	{"{{client_name}}","{{verification_code}}"}	t	2026-03-14 05:33:30.198596	2026-03-14 05:33:30.198596
\.


--
-- Data for Name: fraud_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fraud_logs (id, order_id, client_id, ip_address, email, risk_score, reasons, status, created_at, reviewed_at) FROM stdin;
\.


--
-- Data for Name: hosting_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.hosting_plans (id, name, description, price, billing_cycle, disk_space, bandwidth, email_accounts, databases, subdomains, ftp_accounts, is_active, features, created_at, yearly_price, group_id, module, module_plan_id, module_plan_name, module_server_id, module_server_group_id) FROM stdin;
7a8c5de2-98b9-497e-997e-5e9425219c65	Pro	For high-traffic websites and agencies	19.99	monthly	200 GB	Unlimited	100	50	100	100	t	{"Free SSL","cPanel Access","24/7 Support","1-Click Apps","Daily Backups","Free Domain","Priority Support","Staging Environment"}	2026-03-13 08:44:27.10332	\N	\N	none	\N	\N	\N	\N
407e1a9b-9e61-479e-8e4e-6fd56bdfb798	Enterprise	Full power for demanding applications	49.99	monthly	1 TB	Unlimited	1000	200	500	500	t	{"Free SSL","cPanel Access","24/7 Priority Support","1-Click Apps","Daily Backups","Free Domain","Dedicated IP","SLA Guarantee"}	2026-03-13 08:44:27.10332	\N	\N	none	\N	\N	\N	\N
b7114ed6-d01f-4a37-9b68-fffe7fe5f8a9	E2E Test Plan		5.99	monthly	10 GB	100 GB	10	5	10	5	t	{}	2026-03-13 10:11:01.830157	\N	\N	none	\N	\N	\N	\N
af206789-871f-431c-b209-5765a71f40b3	E2E Test Plan		6.99	monthly	10 GB	100 GB	10	5	10	5	t	{}	2026-03-13 10:15:22.265122	\N	\N	none	\N	\N	\N	\N
76109fbf-c6d9-4131-9da9-ca1c7f81d1e3	Final E2E Plan		8.99	monthly	10 GB	100 GB	10	5	10	5	t	{}	2026-03-13 10:20:16.056182	\N	\N	none	\N	\N	\N	\N
4e09f110-6042-49e8-ac33-f69d6efd1c3f	Test Starter Plan		9.99	monthly	10 GB	100 GB	10	5	10	5	t	{}	2026-03-13 16:38:16.247696	89.99	\N	none	\N	\N	\N	\N
7260ddb5-3612-441e-a3e0-830194435115	Testing		4.99	monthly	10 GB	100 GB	10	5	10	5	t	{}	2026-03-13 17:24:39.645699	49.99	e1deef82-2be7-463f-a33e-9d92134ed229	cpanel	basic	Basic	f008355f-1383-4d29-9606-18dda5476801	\N
ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	Perfect for personal websites and blogs	1.00	monthly	50 GB	Unlimited	10	3	3	5	t	{"Free SSL","cPanel Access","24/7 Support","1-Click WordPress","1 Free .com domain","Host 3 Websites","Free Site Migration Tool"}	2026-03-13 08:44:27.10332	10.92	\N	cpanel	noehoster_Starter	noehoster_Starter	f008355f-1383-4d29-9606-18dda5476801	\N
da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	Great for small to medium businesses	9.99	monthly	50 GB	500 GB	20	10	25	20	t	{"Free SSL","cPanel Access","24/7 Support","1-Click Apps","Daily Backups","Free Domain"}	2026-03-13 08:44:27.10332	\N	\N	cpanel	noehoster_Geek	noehoster_Geek	f008355f-1383-4d29-9606-18dda5476801	\N
\.


--
-- Data for Name: hosting_services; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.hosting_services (id, client_id, plan_id, plan_name, domain, username, server_ip, status, start_date, expiry_date, disk_used, bandwidth_used, cpanel_url, created_at, updated_at, password, server_id, billing_cycle, next_due_date, ssl_status, webmail_url, cancel_requested, cancel_reason, cancel_requested_at) FROM stdin;
cf33bf32-199e-4851-90bc-b0962321e998	907edddc-4e8b-453b-8530-8bc17d38c629	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Business	johnsmith.com	johnsmith	192.168.10.1	active	2025-09-13 08:45:06.156655	2026-09-13 08:45:06.156655	12.5 GB	45 GB	https://cpanel.nexgohost.com	2026-03-13 08:45:06.156655	2026-03-13 08:45:06.156655	\N	\N	monthly	\N	not_installed	\N	f	\N	\N
d36623cd-9ec6-4265-a0eb-6104f8385c41	68b07e1d-5641-41e7-939b-b3b419e08c61	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Pro	doedigital.com	doedigital	192.168.10.2	active	2025-12-13 08:45:06.156655	2026-12-13 08:45:06.156655	35.2 GB	120 GB	https://cpanel.nexgohost.com	2026-03-13 08:45:06.156655	2026-03-13 08:45:06.156655	\N	\N	monthly	\N	not_installed	\N	f	\N	\N
b4899c23-80b4-49d6-8ddc-1011f00388b2	907edddc-4e8b-453b-8530-8bc17d38c629	7260ddb5-3612-441e-a3e0-830194435115	Testing	john.smith.hosted.com	johnsmit	192.168.1.1	active	2026-03-13 18:10:53.644213	\N	0 MB	0 GB	https://192.168.1.1:2083	2026-03-13 18:10:53.644213	2026-03-13 18:10:53.82	2B46ReT4BDGnEF	\N	monthly	2026-04-13 18:10:53.82	not_installed	https://192.168.1.1/webmail	f	\N	\N
f5c9062f-9462-4a5d-a267-04fe139f3fd3	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	\N	\N	192.168.1.1	pending	2026-03-13 18:34:50.125098	\N	0 MB	0 GB	\N	2026-03-13 18:34:50.125098	2026-03-13 18:34:50.125098	\N	\N	yearly	2027-03-13 18:34:50.124	not_installed	\N	f	\N	\N
46af47e8-3f56-4b9b-8f2d-46848185ba61	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	\N	\N	192.168.1.1	active	2026-03-13 18:35:21.565086	\N	0 MB	0 GB	\N	2026-03-13 18:35:21.565086	2026-03-13 18:35:21.565086	\N	\N	monthly	2026-04-13 18:35:21.564	not_installed	\N	f	\N	\N
b2133b6f-4158-4e9b-9bd0-670dedf36875	cb3dfdec-2026-4569-a860-e56400f4ebb9	7260ddb5-3612-441e-a3e0-830194435115	Testing	testbest.hosted.com	noeuser	176.9.63.151	active	2026-03-13 18:38:43.293228	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2087	2026-03-13 18:38:43.293228	2026-03-13 18:38:44.21	Noe1438@@	f008355f-1383-4d29-9606-18dda5476801	monthly	2026-04-13 18:38:44.21	not_installed	https://spg1.cloudpowerdns.com/webmail	f	\N	\N
e946b560-8c97-42db-89ac-0ec7f58b9ce3	96b440bb-4229-44c3-ae54-2c16784423de	7260ddb5-3612-441e-a3e0-830194435115	Testing	finaluser.hosted.com	user	176.9.63.151	active	2026-03-13 18:39:46.435033	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2087	2026-03-13 18:39:46.435033	2026-03-13 18:39:47.316	PhfHetwhq2hzV2	f008355f-1383-4d29-9606-18dda5476801	monthly	2026-04-13 18:39:47.316	not_installed	https://spg1.cloudpowerdns.com/webmail	f	\N	\N
895f7eb9-c40e-40cf-b21d-4beaef8060c8	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testingcpanel.com	testingc	176.9.63.151	active	2026-03-13 19:10:14.89572	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2087	2026-03-13 19:10:14.89572	2026-03-13 19:10:15.755	Noe1438@@	f008355f-1383-4d29-9606-18dda5476801	yearly	2027-03-13 19:10:15.755	not_installed	https://spg1.cloudpowerdns.com/webmail	f	\N	\N
aacdaa33-3af8-4622-a0d8-f948d0afd519	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testingcpanel.com	\N	192.168.1.1	active	2026-03-13 19:10:55.99131	\N	0 MB	0 GB	\N	2026-03-13 19:10:55.99131	2026-03-13 19:10:55.99131	\N	f008355f-1383-4d29-9606-18dda5476801	yearly	2026-04-13 00:00:00	not_installed	\N	f	\N	\N
2a356bc2-0397-4fc4-a34b-9654fd286371	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testingcpanel.com	\N	192.168.1.1	active	2026-03-13 19:11:09.974589	\N	0 MB	0 GB	\N	2026-03-13 19:11:09.974589	2026-03-13 19:11:09.974589	\N	f008355f-1383-4d29-9606-18dda5476801	yearly	2026-04-13 00:00:00	not_installed	\N	f	\N	\N
a8a0d82c-f838-4554-8192-27ba0b3acc17	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testingcpanel.com	\N	192.168.1.1	active	2026-03-13 19:12:36.846877	\N	0 MB	0 GB	\N	2026-03-13 19:12:36.846877	2026-03-13 19:12:36.846877	\N	f008355f-1383-4d29-9606-18dda5476801	yearly	2026-04-13 00:00:00	not_installed	\N	f	\N	\N
99177934-e69b-4aff-b6a9-a06a93d85c0e	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testingcpanel.com	\N	192.168.1.1	active	2026-03-13 19:12:46.954403	\N	0 MB	0 GB	\N	2026-03-13 19:12:46.954403	2026-03-13 19:12:46.954403	\N	f008355f-1383-4d29-9606-18dda5476801	yearly	2026-04-13 00:00:00	not_installed	\N	f	\N	\N
4a689279-8c80-4e28-9c06-6f8e511e44c7	02bd192d-3426-4e90-af54-7a7ba5df0419	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	nexgohostss.com	testings	176.9.63.151	active	2026-03-14 05:29:51.619701	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2083	2026-03-14 05:29:51.619701	2026-03-14 05:47:40.235	9T@v%pjSMfuP#$	f008355f-1383-4d29-9606-18dda5476801	monthly	2026-04-14 05:47:40.235	not_installed	https://spg1.cloudpowerdns.com:2096	f	\N	\N
647784a1-2a57-464f-b205-0ebbddad56f2	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	rana.mudassar.hosted.com	ranamuda	192.168.1.1	terminated	2026-03-13 14:59:34.521422	\N	0 MB	0 GB	https://192.168.1.1:2083	2026-03-13 14:59:34.521422	2026-03-13 19:19:58.013	7H3qvAmCTrDn4m	\N	monthly	2026-04-13 15:48:12.801	not_installed	https://192.168.1.1/webmail	f	krdo	2026-03-13 19:19:45.225
3f082d67-5418-4052-b7ae-0d6796429cc5	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	\N	\N	192.168.1.1	pending	2026-03-14 05:09:54.157307	\N	0 MB	0 GB	\N	2026-03-14 05:09:54.157307	2026-03-14 05:09:54.157307	\N	\N	monthly	2026-04-14 05:09:54.156	not_installed	\N	f	\N	\N
ce6babc4-ae48-4403-827b-d8c1f90df56d	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	rana.mudassar.hosted.com	usertest	176.9.63.151	active	2026-03-13 17:22:07.112341	\N	0 MB	0 GB	https://rana.mudassar.hosted.com:2083	2026-03-13 17:22:07.112341	2026-03-14 05:10:55.542	5Y4$sr5FMdEjBY	f008355f-1383-4d29-9606-18dda5476801	monthly	2026-04-14 05:10:55.542	not_installed	https://rana.mudassar.hosted.com/webmail	f	\N	\N
947c0e4d-5c52-458b-8171-38e71c151819	cb3dfdec-2026-4569-a860-e56400f4ebb9	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	testadmin.com	testadmi	176.9.63.151	active	2026-03-14 06:01:28.47323	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2083	2026-03-14 06:01:28.47323	2026-03-14 06:01:29.99	bnyXNKjTRrbP7R	f008355f-1383-4d29-9606-18dda5476801	yearly	2027-03-14 06:01:29.99	not_installed	https://spg1.cloudpowerdns.com:2096	f	\N	\N
04a5a891-39dc-46b5-8039-a43709a5188c	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	ranamudassar.hosted.com	ranamuda	176.9.63.151	active	2026-03-14 14:09:41.499598	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2083	2026-03-14 14:09:41.499598	2026-03-14 14:11:00.342	GXxYM!ZKxd7G!@	f008355f-1383-4d29-9606-18dda5476801	yearly	2027-03-14 14:11:00.342	not_installed	https://spg1.cloudpowerdns.com:2096	f	\N	\N
4ccade11-1a40-4031-8482-6949b47cca2e	96b440bb-4229-44c3-ae54-2c16784423de	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	getyourplan.com	getyourp	176.9.63.151	active	2026-03-14 06:35:08.211241	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2083	2026-03-14 06:35:08.211241	2026-03-14 07:27:43.826	Uq6usYr59ArQqq	f008355f-1383-4d29-9606-18dda5476801	monthly	2026-04-14 06:36:11.231	failed	https://spg1.cloudpowerdns.com:2096	f	\N	\N
3bbf2d33-8141-4b7c-acee-b64b7c443e1a	3a3e3fd0-cbc8-4414-92e5-b032c4a97887	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	hostingmanage.com	hostingm	176.9.63.151	active	2026-03-14 06:08:39.27349	\N	0 MB	0 GB	https://spg1.cloudpowerdns.com:2083	2026-03-14 06:08:39.27349	2026-03-14 07:26:28.449	!WyPs37tkFe2hG	f008355f-1383-4d29-9606-18dda5476801	yearly	2027-03-14 06:09:41.326	failed	https://spg1.cloudpowerdns.com:2096	f	\N	\N
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, invoice_number, client_id, amount, tax, total, status, due_date, paid_date, items, created_at, updated_at, order_id, service_id) FROM stdin;
21c27d9b-0062-48c2-aa5c-75e0e3c45f26	INV-2025-001	907edddc-4e8b-453b-8530-8bc17d38c629	9.99	0.00	9.99	paid	2026-02-13 08:45:06.156655	2026-02-16 08:45:06.156655	[{"total": 9.99, "quantity": 1, "unitPrice": 9.99, "description": "Business Hosting - Monthly"}]	2026-02-13 08:45:06.156655	2026-03-13 08:45:06.156655	\N	\N
0ebaab51-b2f3-42fe-9054-1f7b6a1fdd21	INV-2025-002	907edddc-4e8b-453b-8530-8bc17d38c629	9.99	0.00	9.99	unpaid	2026-03-20 08:45:06.156655	\N	[{"total": 9.99, "quantity": 1, "unitPrice": 9.99, "description": "Business Hosting - Monthly"}]	2026-03-13 08:45:06.156655	2026-03-13 08:45:06.156655	\N	\N
48f52432-0908-41c2-8b45-2b43c781db11	INV-2025-003	68b07e1d-5641-41e7-939b-b3b419e08c61	19.99	2.00	21.99	paid	2026-02-26 08:45:06.156655	2026-03-03 08:45:06.156655	[{"total": 19.99, "quantity": 1, "unitPrice": 19.99, "description": "Pro Hosting - Monthly"}]	2026-02-21 08:45:06.156655	2026-03-13 08:45:06.156655	\N	\N
d36dd239-2d8f-47d7-bb25-f3bf87d5cef5	INV-2025-004	68b07e1d-5641-41e7-939b-b3b419e08c61	14.99	0.00	14.99	unpaid	2026-03-27 08:45:06.156655	\N	[{"total": 14.99, "quantity": 1, "unitPrice": 14.99, "description": "Domain Renewal - doedigital.com"}]	2026-03-13 08:45:06.156655	2026-03-13 08:45:06.156655	\N	\N
2eb809ec-43d1-4fdc-bfa4-2790dcb6c87a	INV-2026-003	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	25.98	0.00	25.98	paid	2026-03-20 09:25:07.39	2026-03-13 09:43:25.928	[{"total": 25.98, "quantity": 1, "unitPrice": 25.98, "description": "hrthrfgg.com - Domain Registration (2 years)"}]	2026-03-13 09:25:07.391185	2026-03-13 09:43:25.928	\N	\N
4f3fc23f-a15e-427b-a301-5f09900ab99b	INV-20260313-LK047A	907edddc-4e8b-453b-8530-8bc17d38c629	3.49	0.00	3.49	unpaid	2026-03-20 10:21:57.649	\N	[{"amount": 3.4930000000000003, "description": "Starter Hosting"}]	2026-03-13 10:21:57.649876	2026-03-13 10:21:57.649876	\N	\N
c14a95ec-0e4d-4c8e-8e1d-8b0021cfea39	INV-20260313-7RQANP	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	4.99	0.00	4.99	paid	2026-03-20 14:59:34.584	2026-03-13 15:33:03.088	[{"total": 4.99, "quantity": 1, "unitPrice": 4.99, "description": "Starter Hosting"}]	2026-03-13 14:59:34.585159	2026-03-13 15:33:03.088	8bb529d4-6a7d-41ea-b1d1-af924d57435b	647784a1-2a57-464f-b205-0ebbddad56f2
ff1d869e-e8a4-4a4d-815c-77c8796ccad8	INV-20260313-I5V1KP	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	1.00	0.00	1.00	unpaid	2026-03-20 17:22:07.115	\N	[{"total": 1, "quantity": 1, "unitPrice": 1, "description": "Starter Hosting"}]	2026-03-13 17:22:07.115763	2026-03-13 17:22:07.115763	1eedffad-748e-4d21-a1ab-53afbbd01185	ce6babc4-ae48-4403-827b-d8c1f90df56d
3035047c-0400-46a0-8c29-4cfaf44a33f0	INV-2026-0001	907edddc-4e8b-453b-8530-8bc17d38c629	4.99	0.00	4.99	paid	2026-04-13 00:00:00	2026-03-13 18:10:54.066	[{"total": 4.99, "quantity": 1, "unitPrice": 4.99, "description": "Testing — Monthly Hosting Plan (Basic)"}]	2026-03-13 18:10:53.951561	2026-03-13 18:10:54.066	9deb6e0f-3d06-4d13-bbe3-a12913aac310	\N
b91e658b-418b-46dc-911d-7c7802e8fbbc	INV-20260313-LZ5GJ3	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	10.92	0.00	10.92	unpaid	2026-03-20 18:34:50.135	\N	[{"total": 10.92, "quantity": 1, "unitPrice": 10.92, "description": "Starter Hosting (12 months)"}]	2026-03-13 18:34:50.136342	2026-03-13 18:34:50.136342	aafa9b5f-9bde-440c-b5c7-e53d958a58d3	f5c9062f-9462-4a5d-a267-04fe139f3fd3
9a8f9d32-6ca7-4212-812e-8ca90b2d5a17	INV-20260314-19IADO	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	1.00	0.00	1.00	unpaid	2026-03-21 05:09:54.159	\N	[{"total": 1, "quantity": 1, "unitPrice": 1, "description": "Starter Hosting"}]	2026-03-14 05:09:54.159759	2026-03-14 05:09:54.159759	a8792f75-0686-4b67-b3b5-6c0b06b333d2	3f082d67-5418-4052-b7ae-0d6796429cc5
c089c7fe-99f5-43d5-a191-8779b67b76d5	INV-2026-0020	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	1.00	0.00	1.00	paid	2026-03-21 05:10:55.546	2026-03-14 05:10:55.551	[{"total": 1, "quantity": 1, "unitPrice": 1, "description": "Starter — Monthly Hosting Plan"}]	2026-03-14 05:10:55.547132	2026-03-14 05:10:55.551	a8792f75-0686-4b67-b3b5-6c0b06b333d2	\N
2bd285ab-3a6a-41ad-838c-46c0fe3a30ee	INV-2026-0021	02bd192d-3426-4e90-af54-7a7ba5df0419	1.00	0.00	1.00	paid	2026-04-14 00:00:00	2026-03-14 05:30:52.008	[{"total": 1, "quantity": 1, "unitPrice": 1, "description": "Starter — Monthly Hosting Plan (noehoster_Starter)"}]	2026-03-14 05:29:24.193391	2026-03-14 05:30:52.008	7acd7ed4-36f2-416c-a015-4f4c7261dd6d	\N
2d3930ff-3b05-4640-a704-939028813b2f	INV-2026-0022	02bd192d-3426-4e90-af54-7a7ba5df0419	1.00	0.00	1.00	paid	2026-04-14 00:00:00	2026-03-14 05:47:40.241	[{"total": 1, "quantity": 1, "unitPrice": 1, "description": "Starter — Monthly Hosting Plan (noehoster_Starter)"}]	2026-03-14 05:47:24.972259	2026-03-14 05:47:40.241	77f1b231-0004-4cfa-a828-47d424a0077b	\N
59543819-d12a-40d5-b24e-de17e309b892	INV-2026-0023	cb3dfdec-2026-4569-a860-e56400f4ebb9	9.99	0.00	9.99	paid	2026-04-14 00:00:00	2026-03-14 06:01:29.999	[{"total": 9.99, "quantity": 1, "unitPrice": 9.99, "description": "Business — Annual Hosting Plan (noehoster_Geek)"}]	2026-03-14 06:01:08.608698	2026-03-14 06:01:29.999	dd47f3b6-49e6-4a96-9743-f8ca8f6b7e38	\N
9852be97-ccfa-4f62-8932-8a587f7dcd98	INV-2026-0025	96b440bb-4229-44c3-ae54-2c16784423de	9.99	0.00	9.99	paid	2026-04-14 00:00:00	2026-03-14 06:36:11.251	[{"total": 9.99, "quantity": 1, "unitPrice": 9.99, "description": "Business — Monthly Hosting Plan (noehoster_Geek)"}]	2026-03-14 06:34:56.207317	2026-03-14 06:36:11.251	6abbc04d-5ce1-4035-8d47-4df489163dff	\N
af180cd4-aac6-460a-8f4b-cdc7897fb15b	INV-2026-0024	3a3e3fd0-cbc8-4414-92e5-b032c4a97887	10.92	0.00	10.92	paid	2027-04-14 00:00:00	2026-03-14 06:09:41.345	[{"total": 10.92, "quantity": 1, "unitPrice": 10.92, "description": "Starter — Annual Hosting Plan (noehoster_Starter)"}]	2026-03-14 06:08:26.129615	2026-03-14 06:09:41.345	d7583179-667b-47c6-b4d2-89b75633cbba	\N
3fd0c7e2-a87e-4725-8c0f-a5a838c9f28f	INV-2026-026	02bd192d-3426-4e90-af54-7a7ba5df0419	12.99	0.00	12.99	unpaid	2026-03-21 08:46:41.528	\N	[{"total": 12.99, "quantity": 1, "unitPrice": 12.99, "description": "noehostd.com - Domain Registration (1 year)"}]	2026-03-14 08:46:41.529391	2026-03-14 08:46:41.529391	\N	\N
bff66f50-7124-4f88-b599-472b096fe957	INV-20260314-L5BDAJ	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	10.92	0.00	10.92	paid	2026-03-21 14:09:41.515	2026-03-14 14:09:55.623	[{"total": 10.92, "quantity": 1, "unitPrice": 10.92, "description": "Starter Hosting (12 months)"}]	2026-03-14 14:09:41.51595	2026-03-14 14:09:55.623	2a69e3fb-bd06-40b2-b72b-dd2703a448e7	04a5a891-39dc-46b5-8039-a43709a5188c
\.


--
-- Data for Name: migrations_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.migrations_requests (id, client_id, domain, old_hosting_provider, old_cpanel_host, old_cpanel_username, old_cpanel_password, status, progress, notes, requested_at, completed_at) FROM stdin;
77d8a8a0-2705-4b69-a03a-e4a72fffa1d4	68b07e1d-5641-41e7-939b-b3b419e08c61	doedigital.com	GoDaddy	cpanel.godaddy.com	doedigital_old	hidden	in_progress	65	Migration in progress - files transferred, database pending	2026-03-10 08:45:06.156655	\N
9fe25ae8-74d9-4c15-a337-d7d342247941	907edddc-4e8b-453b-8530-8bc17d38c629	johnsmith-old.com	Bluehost	cpanel.bluehost.com	johnsmith_old	hidden	completed	100	Migration completed successfully	2026-02-27 08:45:06.156655	\N
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, client_id, type, item_id, item_name, amount, status, notes, created_at, updated_at, domain, billing_cycle, due_date, module_type, module_plan_id, module_plan_name, module_server_id, payment_status, invoice_id) FROM stdin;
0db5af50-752c-4aa0-8614-fcaec7154b6a	907edddc-4e8b-453b-8530-8bc17d38c629	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	2.99	cancelled	Promo: SALE40 (-40%)	2026-03-13 10:17:54.995545	2026-03-13 12:44:00.059	\N	monthly	\N	none	\N	\N	\N	unpaid	\N
820ddb46-4fe8-441e-8ba9-2a0ce59b2147	907edddc-4e8b-453b-8530-8bc17d38c629	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	3.49	approved	Promo: FINAL30 (-30%)	2026-03-13 10:21:57.646722	2026-03-13 14:55:28.801	\N	monthly	\N	none	\N	\N	\N	unpaid	\N
ee9433e1-c960-4df9-8cd8-249d2b0f9895	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	af206789-871f-431c-b209-5765a71f40b3	E2E Test Plan	6.99	approved	\N	2026-03-13 14:55:12.734748	2026-03-13 14:55:33.611	\N	monthly	\N	none	\N	\N	\N	unpaid	\N
8bb529d4-6a7d-41ea-b1d1-af924d57435b	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	4.99	pending	\N	2026-03-13 14:59:34.367682	2026-03-13 14:59:34.367682	\N	monthly	\N	none	\N	\N	\N	unpaid	\N
1eedffad-748e-4d21-a1ab-53afbbd01185	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	1.00	pending	\N	2026-03-13 17:22:07.104984	2026-03-13 17:22:07.104984	\N	monthly	\N	none	\N	\N	\N	unpaid	\N
38f077c0-0f4c-4c61-845a-a4f82f8021a7	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	domain	5436e08d-a947-48b2-8633-37876de108d7	hrthrfgg.com (2yr)	25.98	approved	Domain registration for hrthrfgg.com	2026-03-13 09:25:07.386667	2026-03-13 17:25:30.771	\N	monthly	\N	none	\N	\N	\N	unpaid	\N
e651d55c-a8ed-4c92-b038-e72b967778ae	96b440bb-4229-44c3-ae54-2c16784423de	hosting	7260ddb5-3612-441e-a3e0-830194435115	Testing	4.99	approved	\N	2026-03-13 17:25:09.328955	2026-03-13 17:25:48.939	\N	monthly	\N	none	\N	\N	\N	unpaid	\N
31f542f2-91a7-413c-ba02-2269e996ef43	cb3dfdec-2026-4569-a860-e56400f4ebb9	hosting	7260ddb5-3612-441e-a3e0-830194435115	Testing	4.99	approved	\N	2026-03-13 17:28:00.838057	2026-03-13 17:28:28.168	\N	monthly	\N	none	\N	\N	\N	unpaid	\N
d7583179-667b-47c6-b4d2-89b75633cbba	3a3e3fd0-cbc8-4414-92e5-b032c4a97887	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	10.92	approved	\N	2026-03-14 06:08:26.125102	2026-03-14 06:14:17.834	hostingmanage.com	yearly	2027-04-14 00:00:00	cpanel	noehoster_Starter	noehoster_Starter	\N	paid	af180cd4-aac6-460a-8f4b-cdc7897fb15b
9deb6e0f-3d06-4d13-bbe3-a12913aac310	907edddc-4e8b-453b-8530-8bc17d38c629	hosting	7260ddb5-3612-441e-a3e0-830194435115	Testing	4.99	approved	\N	2026-03-13 17:47:54.02342	2026-03-13 18:10:54.069	\N	monthly	2026-04-13 00:00:00	cpanel	basic	Basic	\N	paid	3035047c-0400-46a0-8c29-4cfaf44a33f0
aafa9b5f-9bde-440c-b5c7-e53d958a58d3	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	10.92	approved	Billing period: 12 months	2026-03-13 18:34:50.121792	2026-03-13 18:35:21.549	\N	monthly	\N	none	\N	\N	\N	unpaid	\N
5b6f294e-980d-4f21-9215-e9d3476d3680	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	9.99	approved	\N	2026-03-13 19:09:41.563751	2026-03-13 19:09:41.563751	testingcpanel.com	yearly	2026-04-13 00:00:00	cpanel	nexgohost_Business	nexgohost_Business	\N	unpaid	\N
7acd7ed4-36f2-416c-a015-4f4c7261dd6d	02bd192d-3426-4e90-af54-7a7ba5df0419	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	1.00	suspended	\N	2026-03-14 05:29:24.187872	2026-03-14 05:46:08.294	nexgohostss.com	monthly	2026-04-14 00:00:00	cpanel	noehoster_Starter	noehoster_Starter	\N	paid	2bd285ab-3a6a-41ad-838c-46c0fe3a30ee
e001f587-ca27-4420-8c95-fc7dc9aa84bd	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	9.99	approved	\N	2026-03-13 19:09:49.751545	2026-03-13 19:12:46.94	testingcpanel.com	yearly	2026-04-13 00:00:00	cpanel	nexgohost_Business	nexgohost_Business	\N	unpaid	\N
77f1b231-0004-4cfa-a828-47d424a0077b	02bd192d-3426-4e90-af54-7a7ba5df0419	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	1.00	approved	\N	2026-03-14 05:47:24.937133	2026-03-14 05:47:40.244	testingss.com	monthly	2026-04-14 00:00:00	cpanel	noehoster_Starter	noehoster_Starter	\N	paid	2d3930ff-3b05-4640-a704-939028813b2f
a8792f75-0686-4b67-b3b5-6c0b06b333d2	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	1.00	approved	\N	2026-03-14 05:09:54.125569	2026-03-14 05:10:55.554	\N	monthly	\N	none	\N	\N	\N	paid	c089c7fe-99f5-43d5-a191-8779b67b76d5
dd47f3b6-49e6-4a96-9743-f8ca8f6b7e38	cb3dfdec-2026-4569-a860-e56400f4ebb9	hosting	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	9.99	approved	\N	2026-03-14 06:01:08.576512	2026-03-14 06:01:30.001	testadmin.com	yearly	2026-04-14 00:00:00	cpanel	noehoster_Geek	noehoster_Geek	\N	paid	59543819-d12a-40d5-b24e-de17e309b892
2a69e3fb-bd06-40b2-b72b-dd2703a448e7	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	hosting	ab30eb74-55ce-49e7-bd93-21e7aef7ab4f	Starter	10.92	approved	Billing period: 12 months	2026-03-14 14:09:41.465496	2026-03-14 14:09:55.626	\N	monthly	\N	none	\N	\N	\N	unpaid	\N
6abbc04d-5ce1-4035-8d47-4df489163dff	96b440bb-4229-44c3-ae54-2c16784423de	hosting	da93ab5b-4618-4d39-ab1b-0be042a9f4aa	Business	9.99	approved	\N	2026-03-14 06:34:56.202697	2026-03-14 07:24:28.074	getyourplan.com	monthly	2026-04-14 00:00:00	cpanel	noehoster_Geek	noehoster_Geek	\N	paid	9852be97-ccfa-4f62-8932-8a587f7dcd98
c4f734c7-a8d6-4ada-bb09-fbcb295c8e5a	02bd192d-3426-4e90-af54-7a7ba5df0419	domain	435ed6d2-bea2-4c9e-98c5-449eca7b31bd	noehostd.com (1yr)	12.99	approved	Domain registration for noehostd.com	2026-03-14 08:46:41.524371	2026-03-14 08:46:41.524371	\N	monthly	\N	none	\N	\N	\N	unpaid	\N
\.


--
-- Data for Name: payment_methods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_methods (id, name, type, description, is_active, is_sandbox, settings, created_at, updated_at) FROM stdin;
2d0e9ade-ffa0-4994-b984-8ce909980b14	E2E Stripe Test	stripe		t	t	{}	2026-03-13 10:12:01.889299	2026-03-13 10:12:01.889299
9649914c-4968-49a7-bd0e-b8eb0b1f1d10	PayPal Test	paypal		t	t	{}	2026-03-13 10:16:17.882205	2026-03-13 10:16:17.882205
66fb016e-aecc-4d24-b5dc-cd54d32ff5ac	Jazz Cash / Easy Paisa	manual	Name: Muhammad Arslan, Number: 03271711821	t	f	{}	2026-03-13 14:42:59.324783	2026-03-13 14:42:59.324783
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

COPY public.promo_codes (id, code, description, discount_percent, is_active, usage_limit, used_count, expires_at, created_at) FROM stdin;
902109ed-7a2f-474c-827c-4324f8d51224	PROMOTEST50	\N	50	t	\N	0	\N	2026-03-13 10:11:32.762066
89e668e7-7028-4563-a17f-ec29c37e0b05	SALE40	\N	40	t	\N	1	\N	2026-03-13 10:15:49.1987
29a838fb-0238-4cdc-880e-3361067b5196	FINAL30	\N	30	t	\N	1	\N	2026-03-13 10:20:37.037162
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
\.


--
-- Data for Name: servers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.servers (id, name, hostname, ip_address, type, api_username, api_token, api_port, ns1, ns2, max_accounts, status, is_default, created_at, updated_at, group_id) FROM stdin;
f008355f-1383-4d29-9606-18dda5476801	spg1	spg1.cloudpowerdns.com	176.9.63.151	cpanel	noehoster	WHNSI5P6R2VPWAZF84VMUFTIMMVEOXEN	2087	ns25.nexgohost.com	ns26.nexgohost.com	50	active	f	2026-03-13 16:17:56.851769	2026-03-14 05:00:52.908	05f3d2fc-5268-4890-9d20-b88b51f50bf7
8c9c44af-cac1-484c-b62f-68503121198c	Nexpanel	Nexpanel	35.197.225.59	20i	\N	c5e1774c3ba0c8699+cca19635274219aa1	2087	dns1.nexgohost.com	dns2.nexgohost.com	500	active	f	2026-03-14 04:44:24.851776	2026-03-14 08:09:17.237	97cf821b-782b-4c63-97fd-4ad3dd9ecbc1
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
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tickets (id, ticket_number, client_id, subject, status, priority, department, messages_count, last_reply, created_at, updated_at) FROM stdin;
25574e02-4c58-4208-a6fa-a8e234c6a0cc	TKT-2025-001	907edddc-4e8b-453b-8530-8bc17d38c629	Cannot access cPanel dashboard	open	high	Technical Support	2	2026-03-13 07:45:06.156655	2026-03-13 06:45:06.156655	2026-03-13 08:45:06.156655
f9ca1c91-184e-470b-8a57-34a430a0d7d7	TKT-2025-002	68b07e1d-5641-41e7-939b-b3b419e08c61	Question about upgrading my hosting plan	answered	medium	Billing	3	2026-03-12 08:45:06.156655	2026-03-11 08:45:06.156655	2026-03-13 08:45:06.156655
465356f9-c137-4e7c-91db-1698b2256e4f	TKT-2025-003	907edddc-4e8b-453b-8530-8bc17d38c629	SSL certificate not working	closed	urgent	Technical Support	5	2026-03-08 08:45:06.156655	2026-03-06 08:45:06.156655	2026-03-13 08:45:06.156655
2de200dc-61f9-4c67-9959-e57018877fc5	TKT-1773394185890	9c948ad4-0116-414c-9a8a-fa08f71e0ab1	ergergwerger	answered	high	Technical Support	2	2026-03-13 14:39:55.572	2026-03-13 09:29:45.891368	2026-03-13 14:39:55.572
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

COPY public.users (id, first_name, last_name, email, password_hash, company, phone, role, status, created_at, updated_at, email_verified, verification_code, verification_expires_at, two_factor_secret, two_factor_enabled, google_id) FROM stdin;
ae080a35-39e9-4b34-a780-eea69767bf57	Admin	Nexgohost	admin@nexgohost.com	$2b$10$2OCMdNuX8ArwlTrPyPc5luVV2W2/70dHUcfHmdjm0r5AKmPwwJAse	Nexgohost Ltd	+1-555-0100	admin	active	2026-03-13 08:44:09.935388	2026-03-13 08:44:09.935388	f	\N	\N	\N	f	\N
907edddc-4e8b-453b-8530-8bc17d38c629	John	Smith	john@example.com	$2b$10$0hy7lr7Dg4p2lbZ1Rov/luLQuttg9o34rM6q6QS7EoX1FuOqDkejy	Smith Web Solutions	+1-555-0101	client	active	2026-03-13 08:44:09.935388	2026-03-13 08:44:09.935388	f	\N	\N	\N	f	\N
68b07e1d-5641-41e7-939b-b3b419e08c61	Jane	Doe	jane@example.com	$2b$10$0hy7lr7Dg4p2lbZ1Rov/luLQuttg9o34rM6q6QS7EoX1FuOqDkejy	Doe Digital	+1-555-0102	client	active	2026-03-13 08:44:09.935388	2026-03-13 08:44:09.935388	f	\N	\N	\N	f	\N
3a3e3fd0-cbc8-4414-92e5-b032c4a97887	Curl	Test	curltest_final2@example.com	$2b$12$WsLrH5lZF1wDB0/.1QlIt.VabaTk2Jr5NPwGsBch7NORZEhxeTEz6	\N	\N	client	active	2026-03-13 10:13:55.356495	2026-03-13 10:13:55.356495	f	\N	\N	\N	f	\N
737334a5-26c7-4f02-ba96-7d84c8cc2161	Alice	Wonder	alice.wonder.e2e@example.com	$2b$12$XQOt1l80QfTNh5MYQr3nXO5yGJ3gBeWvo0Dz3llR8m9dbj.qOMEmq	\N	\N	client	active	2026-03-13 10:16:50.40149	2026-03-13 10:16:50.40149	f	\N	\N	\N	f	\N
96b440bb-4229-44c3-ae54-2c16784423de	Final	User	finaluser.e2e@example.com	$2b$12$2Ry6qR5q3pgFLiU/OPeUC.SQjgZ7PpQNLHzByu8p7vdPB7lCSG3Ja	\N	\N	client	active	2026-03-13 10:21:00.955904	2026-03-13 10:21:00.955904	f	\N	\N	\N	f	\N
cb3dfdec-2026-4569-a860-e56400f4ebb9	test	best	wefefde@outlook.com	$2b$12$cVZ0daflnEYc3rD0n97oAOvQIYzLjFlM0sw/xSihqeJB0fkMrv9KW	\N	frerferf443	client	active	2026-03-13 17:27:36.376358	2026-03-13 17:27:36.376358	f	\N	\N	\N	f	\N
02bd192d-3426-4e90-af54-7a7ba5df0419	rana	arsu	ranaarsu059@gmail.com	$2b$12$o6/mCHuY/mjabILP/nqcpeVOvvIjnLZJ17THcF/YWOPCWoZHst6ui	\N	03151711821	client	active	2026-03-14 05:03:50.147005	2026-03-14 05:34:56.049	f	998200	2026-03-14 05:44:56.049	\N	f	\N
9c948ad4-0116-414c-9a8a-fa08f71e0ab1	Rana	mudassar	ranamudassar3291@gmail.com	$2b$12$3vxaqtxRFj/.31BIBgFVH..kgOr1yIV7xU8IW3g8wvlVGlq2SWVOG		3271711821	client	active	2026-03-13 09:06:05.796301	2026-03-14 14:11:00.354	f	677316	2026-03-14 14:21:00.354	\N	f	\N
\.


--
-- Name: admin_logs admin_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_pkey PRIMARY KEY (id);


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
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


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
-- PostgreSQL database dump complete
--

\unrestrict lf3nRiW3bNx8xfJHiADLlHDxbgax0qMitGYa26nUHuHJ3OFs8IqltEjfkqcqhFj

