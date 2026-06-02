export interface KbArticle {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  readTime: number;
}

export interface KbSection {
  title: string;
  articles: KbArticle[];
}

export interface KbCategory {
  slug: string;
  title: string;
  description: string;
  iconName: string;
  sections: KbSection[];
}

export const KB_CATEGORIES: KbCategory[] = [
  /* ═══════════════════════════════════════════════════
     1. GETTING STARTED
  ═══════════════════════════════════════════════════ */
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Things you need to know before starting your website',
    iconName: 'FileText',
    sections: [
      {
        title: 'Account Access & Setup',
        articles: [
          {
            slug: 'how-to-access-noehost-account',
            title: 'How to Access Your Noehost Account',
            excerpt: 'Log in to your Noehost client area and manage your services, domains, and billing from one place.',
            readTime: 3,
            content: `<h2>Accessing Your Noehost Client Area</h2>
<p>The Noehost client area is your central hub for managing all your hosting services, domains, invoices, and support tickets.</p>
<h3>Step 1 — Go to the login page</h3>
<p>Navigate to <code>noehost.com/login</code> in your browser.</p>
<h3>Step 2 — Enter your credentials</h3>
<p>Enter the email address and password you used when registering your account.</p>
<h3>Step 3 — Dashboard overview</h3>
<p>Once logged in, you will see your main dashboard with quick links to your active services, pending invoices, and open support tickets.</p>
<h2>Forgot Your Password?</h2>
<p>Click <strong>Forgot Password</strong> on the login page and enter your registered email. You will receive a reset link within a few minutes.</p>
<h2>Two-Factor Authentication</h2>
<p>For added security, enable 2FA from your profile settings. We support Google Authenticator and SMS verification.</p>`,
          },
          {
            slug: 'how-to-access-cpanel',
            title: 'How to Access cPanel on Noehost',
            excerpt: 'Access your cPanel control panel directly from the Noehost client area with a single click.',
            readTime: 2,
            content: `<h2>Accessing cPanel</h2>
<p>cPanel is your hosting control panel where you manage files, email, databases, and more.</p>
<h3>Method 1 — Via Noehost Client Area (recommended)</h3>
<ol><li>Log in to your Noehost client area</li><li>Go to <strong>Services → My Services</strong></li><li>Click on your hosting plan</li><li>Click <strong>Login to cPanel</strong></li></ol>
<h3>Method 2 — Direct URL</h3>
<p>Go to <code>yourdomain.com:2083</code> and enter your cPanel username and password.</p>
<h2>cPanel Overview</h2>
<p>Inside cPanel you will find sections for: Files (File Manager, FTP), Databases (MySQL, phpMyAdmin), Email (Email Accounts, Forwarders), Security (SSL/TLS, Two-Factor Auth), and Domains.</p>`,
          },
          {
            slug: 'how-to-find-hosting-plan-details',
            title: 'How to Find the Details of Your Hosting Plan',
            excerpt: 'View your hosting plan details including disk usage, bandwidth, and account username from the client area.',
            readTime: 2,
            content: `<h2>Finding Your Hosting Plan Details</h2>
<p>You can find all the details of your hosting plan in the Noehost client area.</p>
<h3>Steps</h3>
<ol><li>Log in to your Noehost client area</li><li>Navigate to <strong>Services → My Services</strong></li><li>Click on the service you want to view</li></ol>
<h2>What You Will See</h2>
<ul><li><strong>cPanel Username</strong> — your control panel login</li><li><strong>Server IP</strong> — your hosting server IP address</li><li><strong>Disk Usage</strong> — current storage used vs limit</li><li><strong>Bandwidth</strong> — monthly transfer used vs limit</li><li><strong>Expiry Date</strong> — when your plan renews or expires</li></ul>`,
          },
          {
            slug: 'how-to-reset-cpanel-password',
            title: 'How to Reset Your cPanel Password',
            excerpt: 'Reset your cPanel password from the Noehost client area without contacting support.',
            readTime: 2,
            content: `<h2>Resetting cPanel Password</h2>
<p>If you have forgotten your cPanel password or want to change it for security reasons, you can do so easily.</p>
<h3>Steps</h3>
<ol><li>Log in to your Noehost client area</li><li>Go to <strong>Services → My Services</strong></li><li>Click on your hosting plan</li><li>Click <strong>Change Password</strong></li><li>Enter and confirm your new password</li><li>Click <strong>Save Changes</strong></li></ol>
<h2>Password Requirements</h2>
<ul><li>Minimum 8 characters</li><li>At least one uppercase letter</li><li>At least one number</li><li>At least one special character (!@#$%)</li></ul>`,
          },
          {
            slug: 'noehost-account-overview',
            title: 'Noehost Client Area Overview',
            excerpt: 'A complete tour of the Noehost client area — services, billing, support, and account settings.',
            readTime: 4,
            content: `<h2>Client Area Overview</h2>
<p>The Noehost client area gives you full control over your hosting services. Here is a complete walkthrough.</p>
<h2>Dashboard</h2>
<p>The main dashboard shows your active services, unpaid invoices, open tickets, and recent activity.</p>
<h2>Services</h2>
<p>Manage all your hosting plans, view resource usage, access cPanel, and manage add-ons.</p>
<h2>Domains</h2>
<p>Register new domains, renew existing ones, manage DNS, enable privacy protection, and transfer domains.</p>
<h2>Billing</h2>
<p>View invoices, add payment methods, see transaction history, and manage your credit balance.</p>
<h2>Support</h2>
<p>Open new tickets, view ticket history, and access this knowledge base. Average response time is under 1 hour.</p>
<h2>Profile Settings</h2>
<p>Update your name, email, password, billing address, and security settings (2FA, login alerts).</p>`,
          },
          {
            slug: 'how-to-add-additional-contacts',
            title: 'How to Add Additional Contacts to Your Account',
            excerpt: 'Add team members or billing contacts who can receive invoices and manage your account.',
            readTime: 3,
            content: `<h2>Adding Sub-Accounts / Contacts</h2>
<p>You can add additional contacts to your Noehost account to share access or receive billing notifications.</p>
<h3>Steps</h3>
<ol><li>Log in to your client area</li><li>Go to <strong>Account → Contacts / Sub-Accounts</strong></li><li>Click <strong>Add New Contact</strong></li><li>Enter the contact's name and email</li><li>Set their permissions (billing, technical, domain management)</li><li>Click <strong>Save Changes</strong></li></ol>
<h2>Contact Permissions</h2>
<ul><li><strong>Full Access</strong> — can manage everything</li><li><strong>Billing Only</strong> — receives invoices and payment notifications</li><li><strong>Technical</strong> — can open support tickets and manage services</li></ul>`,
          },
        ],
      },
      {
        title: 'Your First Website',
        articles: [
          {
            slug: 'how-to-upload-website',
            title: 'How to Upload Your Website to Noehost',
            excerpt: 'Upload your website files to Noehost using cPanel File Manager or FTP.',
            readTime: 5,
            content: `<h2>Uploading Your Website Files</h2>
<p>There are two main ways to upload your website files to Noehost: File Manager and FTP.</p>
<h2>Method 1 — cPanel File Manager</h2>
<ol><li>Log in to cPanel</li><li>Click <strong>File Manager</strong></li><li>Navigate to <code>public_html</code></li><li>Click <strong>Upload</strong></li><li>Select your files (ZIP or individual files)</li><li>If uploaded as ZIP, right-click the file and select <strong>Extract</strong></li></ol>
<h2>Method 2 — FTP with FileZilla</h2>
<ol><li>Download and install FileZilla</li><li>Open FileZilla and go to <strong>File → Site Manager</strong></li><li>Enter your FTP host (your domain or server IP), username, and password</li><li>Port: 21</li><li>Connect and drag files from your computer to <code>/public_html</code></li></ol>
<h2>Important Notes</h2>
<ul><li>Your main website files must go in <code>public_html</code></li><li>The main page should be named <code>index.html</code> or <code>index.php</code></li></ul>`,
          },
          {
            slug: 'how-to-connect-domain-to-hosting',
            title: 'How to Connect a Domain to Your Hosting',
            excerpt: 'Point your domain to your Noehost server by updating the nameservers or DNS A record.',
            readTime: 4,
            content: `<h2>Connecting Your Domain to Noehost Hosting</h2>
<h2>Option 1 — Update Nameservers (recommended for new setups)</h2>
<p>If you registered your domain elsewhere, update its nameservers to Noehost's:</p>
<ul><li><code>ns1.noehost.com</code></li><li><code>ns2.noehost.com</code></li></ul>
<p>Log in to your domain registrar, find the nameserver settings, and replace them with the above. DNS propagation takes 24–48 hours.</p>
<h2>Option 2 — Update DNS A Record (to keep DNS at registrar)</h2>
<ol><li>Find your Noehost server IP in <strong>Services → My Services → Server IP</strong></li><li>At your domain registrar, go to DNS management</li><li>Set the <strong>A record</strong> for <code>@</code> (root domain) to point to your server IP</li><li>Set the <strong>A record</strong> for <code>www</code> to the same IP</li></ol>`,
          },
          {
            slug: 'how-to-install-ssl-free',
            title: 'How to Install a Free SSL Certificate',
            excerpt: "Install Let's Encrypt SSL on your domain for free directly from cPanel.",
            readTime: 3,
            content: `<h2>Installing Free SSL with Let's Encrypt</h2>
<p>All Noehost plans include free SSL certificates powered by Let's Encrypt.</p>
<h3>Steps</h3>
<ol><li>Log in to cPanel</li><li>Go to <strong>Security → SSL/TLS Status</strong></li><li>Find your domain in the list</li><li>Click <strong>Run AutoSSL</strong> or click the domain and select <strong>Issue</strong></li><li>Wait 2–5 minutes for the certificate to install</li></ol>
<h2>Forcing HTTPS</h2>
<p>After SSL is installed, redirect HTTP to HTTPS by adding this to your <code>.htaccess</code> file:</p>
<pre><code>RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]</code></pre>`,
          },
          {
            slug: 'how-to-create-email-account',
            title: 'How to Create a Business Email Account',
            excerpt: 'Create a professional @yourdomain.com email address using cPanel Email Accounts.',
            readTime: 3,
            content: `<h2>Creating a Business Email Account</h2>
<ol><li>Log in to cPanel</li><li>Click <strong>Email Accounts</strong> under the Email section</li><li>Click <strong>Create</strong></li><li>Select your domain from the dropdown</li><li>Enter a username (e.g., <code>info</code> for info@yourdomain.com)</li><li>Set a strong password</li><li>Click <strong>Create Account</strong></li></ol>
<h2>Accessing Your Email</h2>
<ul><li><strong>Webmail:</strong> <code>yourdomain.com/webmail</code></li><li><strong>IMAP:</strong> mail.yourdomain.com, port 993, SSL</li><li><strong>SMTP:</strong> mail.yourdomain.com, port 465, SSL</li></ul>`,
          },
          {
            slug: 'understanding-nameservers',
            title: 'Understanding Nameservers and DNS',
            excerpt: "A beginner's explanation of nameservers, DNS, and how they connect your domain to your website.",
            readTime: 5,
            content: `<h2>What Are Nameservers?</h2>
<p>Nameservers are like the phone book of the internet. When someone types your domain name, nameservers tell browsers which server to find your website on.</p>
<h2>How DNS Works</h2>
<ol><li>User types your domain in browser</li><li>Browser asks a DNS resolver "where is this domain?"</li><li>DNS resolver checks your nameservers</li><li>Nameservers return your server's IP address</li><li>Browser connects to that IP and loads your site</li></ol>
<h2>Noehost Nameservers</h2>
<p>When you use Noehost for both domain and hosting, your nameservers are already set. If you registered your domain elsewhere, update to: <code>ns1.noehost.com</code> and <code>ns2.noehost.com</code></p>
<h2>DNS Propagation</h2>
<p>After changing nameservers, it takes 24–48 hours for the changes to spread globally. During this time, some visitors may see your old website.</p>`,
          },
          {
            slug: 'how-to-check-server-status',
            title: 'How to Check Noehost Server Status',
            excerpt: 'Monitor real-time uptime and scheduled maintenance for your Noehost server.',
            readTime: 2,
            content: `<h2>Checking Server Status</h2>
<p>You can check the live status of all Noehost servers at <strong>noehost.com/server-status</strong>.</p>
<h2>What the Status Page Shows</h2>
<ul><li><strong>Web Servers</strong> — HTTP/HTTPS availability</li><li><strong>Database Servers</strong> — MySQL status</li><li><strong>Mail Servers</strong> — email delivery status</li><li><strong>DNS Servers</strong> — domain resolution</li><li><strong>Network</strong> — connectivity and latency</li></ul>
<h2>Subscribing to Alerts</h2>
<p>Enter your email on the status page to receive automatic notifications of any incidents or scheduled maintenance.</p>`,
          },
        ],
      },
      {
        title: 'Account Security',
        articles: [
          {
            slug: 'how-to-enable-two-factor-auth',
            title: 'How to Enable Two-Factor Authentication (2FA)',
            excerpt: 'Secure your Noehost account with two-factor authentication using Google Authenticator or SMS.',
            readTime: 4,
            content: `<h2>Enabling Two-Factor Authentication</h2>
<p>2FA adds a second layer of security to your account. Even if your password is compromised, attackers cannot log in without your phone.</p>
<h3>Using Google Authenticator</h3>
<ol><li>Log in to your Noehost client area</li><li>Go to <strong>Account → Security Settings</strong></li><li>Click <strong>Enable Two-Factor Authentication</strong></li><li>Scan the QR code with Google Authenticator app</li><li>Enter the 6-digit code to confirm</li><li>Save your backup codes in a safe place</li></ol>
<h2>Using SMS Verification</h2>
<ol><li>Select <strong>SMS Authentication</strong> instead of app</li><li>Enter your phone number</li><li>Verify with the code sent to your phone</li></ol>
<h2>Lost Access to 2FA?</h2>
<p>Use one of your saved backup codes to log in, then disable and re-enable 2FA with a new device.</p>`,
          },
          {
            slug: 'how-to-update-account-password',
            title: 'How to Update Your Account Password',
            excerpt: 'Change your Noehost client area password regularly for better security.',
            readTime: 2,
            content: `<h2>Changing Your Password</h2>
<ol><li>Log in to your Noehost client area</li><li>Click your name in the top-right corner</li><li>Select <strong>Edit Account Details</strong></li><li>Scroll to the <strong>Change Password</strong> section</li><li>Enter your current password</li><li>Enter and confirm your new password</li><li>Click <strong>Save Changes</strong></li></ol>
<h2>Strong Password Tips</h2>
<ul><li>Use at least 12 characters</li><li>Mix uppercase, lowercase, numbers, and symbols</li><li>Never reuse passwords from other sites</li><li>Use a password manager like Bitwarden or 1Password</li></ul>`,
          },
          {
            slug: 'how-to-view-login-history',
            title: 'How to View Your Account Login History',
            excerpt: 'Review recent login activity on your Noehost account to detect unauthorized access.',
            readTime: 2,
            content: `<h2>Viewing Login History</h2>
<ol><li>Log in to your client area</li><li>Go to <strong>Account → Security Settings</strong></li><li>Click <strong>Login History</strong></li></ol>
<h2>What the Log Shows</h2>
<ul><li>Date and time of each login</li><li>IP address used</li><li>Browser / device type</li><li>Whether login succeeded or failed</li></ul>
<h2>Suspicious Activity?</h2>
<p>If you see logins you do not recognize, immediately change your password, enable 2FA, and open a support ticket.</p>`,
          },
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════════
     2. cPANEL & HOSTING
  ═══════════════════════════════════════════════════ */
  {
    slug: 'cpanel-hosting',
    title: 'cPanel & Hosting',
    description: 'The features of the cPanel control panel explained',
    iconName: 'Server',
    sections: [
      {
        title: 'cPanel Basics',
        articles: [
          { slug: 'cpanel-overview', title: 'cPanel Overview — All Sections Explained', excerpt: 'A complete guide to every section of cPanel — files, databases, email, security, and more.', readTime: 6, content: `<h2>cPanel Overview</h2><p>cPanel is the world's most popular hosting control panel. Here is a section-by-section guide to everything inside it.</p><h2>Files</h2><ul><li><strong>File Manager</strong> — browse and edit your website files in a browser-based interface</li><li><strong>FTP Accounts</strong> — create FTP users for third-party file access</li><li><strong>Disk Usage</strong> — view what is consuming your storage</li><li><strong>Backups</strong> — download full or partial backups</li></ul><h2>Databases</h2><ul><li><strong>MySQL Databases</strong> — create and manage databases</li><li><strong>phpMyAdmin</strong> — visual database manager</li><li><strong>Remote MySQL</strong> — allow external IPs to connect</li></ul><h2>Email</h2><ul><li><strong>Email Accounts</strong> — create @yourdomain.com addresses</li><li><strong>Forwarders</strong> — redirect email to another address</li><li><strong>Spam Filters</strong> — configure SpamAssassin</li><li><strong>Autoresponders</strong> — send automatic replies</li></ul><h2>Security</h2><ul><li><strong>SSL/TLS</strong> — install and manage certificates</li><li><strong>IP Blocker</strong> — block abusive IP addresses</li><li><strong>ModSecurity</strong> — web application firewall</li><li><strong>Two-Factor Authentication</strong></li></ul>` },
          { slug: 'cpanel-file-manager', title: 'How to Use the cPanel File Manager', excerpt: 'Navigate, upload, edit, and delete files using the cPanel File Manager without FTP software.', readTime: 5, content: `<h2>Using cPanel File Manager</h2><p>File Manager lets you manage your website files directly in your browser without needing FTP software.</p><h3>Opening File Manager</h3><ol><li>Log in to cPanel</li><li>Click <strong>File Manager</strong> in the Files section</li></ol><h2>Key Features</h2><ul><li><strong>Navigate</strong> — browse folders like an OS file explorer</li><li><strong>Upload</strong> — click Upload button or drag-and-drop files</li><li><strong>Create File/Folder</strong> — top toolbar buttons</li><li><strong>Edit</strong> — right-click any text file → Edit or Code Editor</li><li><strong>Permissions</strong> — right-click → Change Permissions</li><li><strong>Compress/Extract</strong> — ZIP files for bulk transfers</li><li><strong>Delete</strong> — right-click → Delete (moves to Trash first)</li></ul><h2>public_html Folder</h2><p>All files you want accessible from your domain must be placed in <code>/public_html</code>. This is your website root directory.</p>` },
          { slug: 'cpanel-error-logs', title: 'How to View Error Logs in cPanel', excerpt: 'Find PHP and web server error logs in cPanel to debug website issues.', readTime: 3, content: `<h2>Viewing Error Logs</h2><h3>Method 1 — cPanel Error Logs Section</h3><ol><li>Log in to cPanel</li><li>Go to <strong>Metrics → Errors</strong></li><li>View the last 300 lines of your Apache/PHP error log</li></ol><h3>Method 2 — File Manager</h3><p>Error logs are also stored at <code>/home/username/logs/</code>. Navigate there in File Manager to download full logs.</p><h3>Method 3 — Enable PHP Error Display (dev only)</h3><p>Add to your <code>.htaccess</code>: <code>php_flag display_errors on</code></p><h2>Common Error Types</h2><ul><li><strong>500 Internal Server Error</strong> — check .htaccess syntax and PHP errors</li><li><strong>404 Not Found</strong> — file missing or wrong path in .htaccess</li><li><strong>PHP Fatal Error</strong> — syntax error or missing function</li></ul>` },
          { slug: 'cpanel-cron-jobs', title: 'How to Set Up Cron Jobs in cPanel', excerpt: 'Schedule automatic tasks to run at specific intervals using cPanel Cron Jobs.', readTime: 4, content: `<h2>Setting Up Cron Jobs</h2><p>Cron jobs automate tasks on your server — sending emails, running backups, clearing caches, etc.</p><h3>Steps</h3><ol><li>Log in to cPanel</li><li>Go to <strong>Advanced → Cron Jobs</strong></li><li>Set the schedule using the time fields or a preset interval</li><li>Enter the command to run</li><li>Click <strong>Add New Cron Job</strong></li></ol><h2>Common Cron Examples</h2><pre><code># Run every 5 minutes
*/5 * * * * php /home/user/public_html/cron.php

# Run daily at midnight
0 0 * * * php /home/user/public_html/cron.php

# Run every Sunday at 2am
0 2 * * 0 php /home/user/public_html/backup.php</code></pre>` },
          { slug: 'cpanel-php-version', title: 'How to Change PHP Version in cPanel', excerpt: 'Switch your PHP version using the MultiPHP Manager in cPanel to match your application requirements.', readTime: 3, content: `<h2>Changing PHP Version</h2><ol><li>Log in to cPanel</li><li>Go to <strong>Software → MultiPHP Manager</strong></li><li>Select your domain from the list</li><li>Choose your desired PHP version from the dropdown</li><li>Click <strong>Apply</strong></li></ol><h2>Recommended Versions</h2><ul><li><strong>WordPress 6+</strong> — PHP 8.1 or 8.2</li><li><strong>Legacy apps</strong> — PHP 7.4</li><li><strong>Modern apps</strong> — PHP 8.2</li></ul><h2>PHP Extensions</h2><p>Go to <strong>MultiPHP INI Editor</strong> to enable/disable extensions like GD, mbstring, curl, zip, imagick.</p>` },
          { slug: 'cpanel-htaccess', title: 'How to Use .htaccess on Noehost', excerpt: 'Configure redirects, password protection, custom error pages, and more using .htaccess.', readTime: 5, content: `<h2>What is .htaccess?</h2><p>.htaccess is an Apache configuration file that controls how your server handles requests. It lives in your <code>public_html</code> folder.</p><h2>Common .htaccess Rules</h2><h3>Redirect HTTP to HTTPS</h3><pre><code>RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]</code></pre><h3>Redirect www to non-www</h3><pre><code>RewriteEngine On
RewriteCond %{HTTP_HOST} ^www\.(.+)$ [NC]
RewriteRule ^ https://%1%{REQUEST_URI} [L,R=301]</code></pre><h3>Custom 404 page</h3><pre><code>ErrorDocument 404 /404.html</code></pre><h3>Password protect a directory</h3><pre><code>AuthType Basic
AuthName "Restricted"
AuthUserFile /home/user/.htpasswd
Require valid-user</code></pre>` },
        ],
      },
      {
        title: 'Performance & Caching',
        articles: [
          { slug: 'cpanel-resource-usage', title: 'How to Monitor Resource Usage in cPanel', excerpt: 'Check your CPU, RAM, and disk usage in real-time using cPanel metrics tools.', readTime: 3, content: `<h2>Monitoring Resources</h2><h3>Resource Usage Dashboard</h3><ol><li>Log in to cPanel</li><li>Go to <strong>Metrics → Resource Usage</strong></li></ol><p>This shows current CPU, RAM, I/O, and entry processes usage vs your plan limits.</p><h2>Disk Usage</h2><p>Go to <strong>Files → Disk Usage</strong> to see a visual breakdown of what is using your storage by directory.</p><h2>Resource Limits</h2><ul><li><strong>CPU</strong> — measured in CPU seconds per hour</li><li><strong>RAM</strong> — physical memory limit</li><li><strong>Entry Processes</strong> — concurrent PHP processes</li><li><strong>I/O</strong> — disk read/write speed</li></ul>` },
          { slug: 'enable-gzip-compression', title: 'How to Enable GZIP Compression', excerpt: 'Enable GZIP compression to reduce page load times by compressing files before sending them to browsers.', readTime: 3, content: `<h2>Enabling GZIP Compression</h2><h3>Via .htaccess</h3><pre><code>&lt;IfModule mod_deflate.c&gt;
  AddOutputFilterByType DEFLATE text/html text/css text/javascript
  AddOutputFilterByType DEFLATE application/javascript application/json
  AddOutputFilterByType DEFLATE image/svg+xml
&lt;/IfModule&gt;</code></pre><h3>Verifying GZIP is Active</h3><p>Use an online GZIP checker tool and enter your URL. It will confirm compression is working and show the compression ratio.</p><h2>Performance Benefit</h2><p>GZIP typically reduces HTML/CSS/JS file sizes by 60–80%, significantly improving page load speeds.</p>` },
          { slug: 'setup-browser-caching', title: 'How to Set Up Browser Caching', excerpt: 'Configure browser caching with .htaccess to make repeat visits faster for your users.', readTime: 4, content: `<h2>Setting Up Browser Caching</h2><p>Browser caching tells visitors' browsers to store static files locally, so they do not re-download them on every visit.</p><h3>Add to .htaccess</h3><pre><code>&lt;IfModule mod_expires.c&gt;
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
  ExpiresByType text/html "access plus 1 day"
&lt;/IfModule&gt;</code></pre>` },
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════════
     3. WORDPRESS
  ═══════════════════════════════════════════════════ */
  {
    slug: 'wordpress',
    title: 'WordPress',
    description: 'Everything you need to know about WordPress hosting',
    iconName: 'Layout',
    sections: [
      {
        title: 'WordPress Installation',
        articles: [
          { slug: 'how-to-install-wordpress', title: 'How to Install WordPress with One Click', excerpt: "Install WordPress in minutes using Noehost's one-click installer in the client area.", readTime: 3, content: `<h2>Installing WordPress</h2><h3>Method 1 — One-Click Installer (recommended)</h3><ol><li>Log in to your Noehost client area</li><li>Go to <strong>Services → My Services</strong></li><li>Click on your hosting plan</li><li>Click <strong>WordPress → One-Click Install</strong></li><li>Fill in: site title, admin username, admin email, and password</li><li>Click <strong>Install Now</strong></li></ol><p>WordPress will be installed and ready in under 2 minutes.</p><h3>Method 2 — Manual Install via cPanel</h3><ol><li>Download WordPress from wordpress.org</li><li>Upload and extract to <code>public_html</code> via File Manager</li><li>Create a MySQL database in cPanel</li><li>Visit your domain and follow the setup wizard</li></ol>` },
          { slug: 'wordpress-minimum-requirements', title: 'WordPress Minimum Requirements on Noehost', excerpt: 'Check PHP version, MySQL version, and memory requirements for running WordPress on Noehost.', readTime: 2, content: `<h2>WordPress Requirements</h2><ul><li><strong>PHP:</strong> 7.4 or higher (8.1+ recommended)</li><li><strong>MySQL:</strong> 5.7+ or MariaDB 10.3+</li><li><strong>PHP Memory:</strong> 64MB minimum (256MB recommended)</li><li><strong>HTTPS:</strong> SSL certificate required</li></ul><h2>Noehost Settings</h2><p>All Noehost plans come with PHP 8.1 and the latest MySQL, fully meeting WordPress requirements. Memory limits are set to 256MB by default.</p>` },
          { slug: 'how-to-run-multiple-wordpress', title: 'How to Run Multiple WordPress Sites on One Account', excerpt: 'Host multiple WordPress sites on a single Noehost account using addon domains.', readTime: 4, content: `<h2>Multiple WordPress Sites</h2><p>You can run multiple separate WordPress installations on one Noehost hosting account using addon domains.</p><h3>Step 1 — Add an Addon Domain</h3><ol><li>Log in to cPanel</li><li>Go to <strong>Domains → Addon Domains</strong></li><li>Enter your second domain name</li><li>Set a document root (e.g., <code>/public_html/site2</code>)</li><li>Click <strong>Add Domain</strong></li></ol><h3>Step 2 — Install WordPress for the New Domain</h3><ol><li>Use the one-click installer from the client area</li><li>Select the new addon domain</li><li>Set the installation path</li></ol>` },
        ],
      },
      {
        title: 'WordPress Management',
        articles: [
          { slug: 'how-to-update-wordpress', title: 'How to Update WordPress, Themes, and Plugins', excerpt: 'Keep your WordPress site secure by regularly updating core, themes, and plugins.', readTime: 3, content: `<h2>Updating WordPress</h2><h3>Update WordPress Core</h3><ol><li>Log in to your WordPress admin (<code>yourdomain.com/wp-admin</code>)</li><li>Go to <strong>Dashboard → Updates</strong></li><li>Click <strong>Update Now</strong></li></ol><h3>Update Plugins</h3><ol><li>Go to <strong>Plugins → Installed Plugins</strong></li><li>Click <strong>Update Available</strong> at the top</li><li>Select all and click <strong>Update Plugins</strong></li></ol><h3>Update Themes</h3><ol><li>Go to <strong>Appearance → Themes</strong></li><li>Click on any theme with an update notice</li><li>Click <strong>Update Now</strong></li></ol><h2>Best Practice</h2><p>Always take a backup before updating. Use a staging site for major version updates.</p>` },
          { slug: 'wordpress-admin-url', title: 'How to Access WordPress Admin Dashboard', excerpt: 'Access your WordPress admin panel and troubleshoot if the /wp-admin URL is not working.', readTime: 2, content: `<h2>Accessing WordPress Admin</h2><p>The WordPress admin dashboard is at: <code>yourdomain.com/wp-admin</code></p><h2>Login not working?</h2><ul><li>Make sure WordPress is fully installed</li><li>Check caps lock is off</li><li>Try <code>/wp-login.php</code> instead of <code>/wp-admin</code></li><li>Reset your password from the login page</li></ul><h2>Reset WordPress Admin Password</h2><p>Go to <code>yourdomain.com/wp-login.php</code> → <strong>Lost your password?</strong> → Enter your admin email.</p>` },
          { slug: 'how-to-backup-wordpress', title: 'How to Backup Your WordPress Site', excerpt: 'Create complete backups of your WordPress files and database using cPanel or plugins.', readTime: 5, content: `<h2>Backing Up WordPress</h2><h3>Method 1 — cPanel Backup (full server backup)</h3><ol><li>Log in to cPanel</li><li>Go to <strong>Files → Backup</strong></li><li>Under <strong>Partial Backups</strong>, download Home Directory and MySQL databases separately</li></ol><h3>Method 2 — WordPress Backup Plugin</h3><p>Install <strong>UpdraftPlus</strong> (free) from WordPress plugins:</p><ol><li>Install and activate UpdraftPlus</li><li>Go to <strong>Settings → UpdraftPlus</strong></li><li>Click <strong>Backup Now</strong></li><li>Store backups to Google Drive or Dropbox</li></ol><h2>How Often to Backup?</h2><ul><li>Small blogs: weekly</li><li>Active eCommerce: daily</li><li>High-traffic sites: real-time or hourly</li></ul>` },
          { slug: 'how-to-move-wordpress', title: 'How to Move WordPress to a New Host', excerpt: 'Migrate your WordPress site to Noehost without downtime using the All-in-One WP Migration plugin.', readTime: 6, content: `<h2>Migrating WordPress to Noehost</h2><h3>Using All-in-One WP Migration</h3><p><strong>On your old host:</strong></p><ol><li>Install and activate All-in-One WP Migration</li><li>Go to <strong>All-in-One WP Migration → Export</strong></li><li>Export to File</li><li>Download the .wpress backup file</li></ol><p><strong>On Noehost:</strong></p><ol><li>Install WordPress on your Noehost account</li><li>Install All-in-One WP Migration</li><li>Go to <strong>Import → Upload</strong></li><li>Upload the .wpress file</li><li>Wait for import to complete</li><li>Update your domain's DNS to point to Noehost</li></ol>` },
          { slug: 'fix-wordpress-500-error', title: 'How to Fix the 500 Internal Server Error in WordPress', excerpt: 'Diagnose and fix the most common causes of 500 errors in WordPress.', readTime: 5, content: `<h2>Fixing WordPress 500 Errors</h2><h3>Step 1 — Check .htaccess</h3><p>Rename <code>.htaccess</code> to <code>.htaccess_old</code> temporarily. If site loads, regenerate .htaccess from WordPress: <strong>Settings → Permalinks → Save Changes</strong>.</p><h3>Step 2 — Increase PHP Memory</h3><p>Add to <code>wp-config.php</code>: <code>define('WP_MEMORY_LIMIT', '256M');</code></p><h3>Step 3 — Deactivate All Plugins</h3><p>Via FTP, rename <code>/wp-content/plugins/</code> to <code>/wp-content/plugins_old/</code>. If site loads, reactivate plugins one by one to find the culprit.</p><h3>Step 4 — Switch to Default Theme</h3><p>Rename your theme folder to disable it. WordPress will fall back to Twenty Twenty-Four.</p>` },
        ],
      },
      {
        title: 'WordPress Security',
        articles: [
          { slug: 'secure-wordpress-site', title: 'How to Secure Your WordPress Site', excerpt: 'Essential security steps every WordPress site owner should take to prevent hacks.', readTime: 6, content: `<h2>WordPress Security Essentials</h2><h3>1. Keep everything updated</h3><p>Keep WordPress core, all themes, and all plugins updated. Most hacks exploit known vulnerabilities in outdated software.</p><h3>2. Use strong passwords</h3><p>Use a unique, strong password for your WordPress admin, database, FTP, and cPanel. Use a password manager.</p><h3>3. Install a security plugin</h3><p><strong>Wordfence Security</strong> (free) adds a firewall, malware scanner, and login protection.</p><h3>4. Limit login attempts</h3><p>Install <strong>Limit Login Attempts Reloaded</strong> to block brute-force attacks.</p><h3>5. Change the wp-admin URL</h3><p>Use <strong>WPS Hide Login</strong> plugin to change your admin URL from the default /wp-admin.</p><h3>6. Disable file editing</h3><p>Add to wp-config.php: <code>define('DISALLOW_FILE_EDIT', true);</code></p>` },
          { slug: 'wordpress-malware-scan', title: 'How to Scan WordPress for Malware', excerpt: 'Detect and remove malware from your WordPress site using Wordfence and cPanel tools.', readTime: 4, content: `<h2>Scanning for Malware</h2><h3>Method 1 — Wordfence Plugin</h3><ol><li>Install and activate Wordfence Security</li><li>Go to <strong>Wordfence → Scan</strong></li><li>Click <strong>Start New Scan</strong></li><li>Review results and click <strong>Repair</strong> or <strong>Delete</strong> on infected files</li></ol><h3>Method 2 — cPanel Virus Scanner</h3><ol><li>Log in to cPanel</li><li>Go to <strong>Advanced → Virus Scanner</strong></li><li>Select <strong>Scan Entire Home Directory</strong></li></ol>` },
        ],
      },
      {
        title: 'WordPress Performance',
        articles: [
          { slug: 'speed-up-wordpress', title: 'How to Speed Up Your WordPress Site', excerpt: 'Improve WordPress loading times with caching, image optimization, and a CDN.', readTime: 7, content: `<h2>Speeding Up WordPress</h2><h3>1. Install a caching plugin</h3><p>Install <strong>W3 Total Cache</strong> or <strong>WP Super Cache</strong>. Enable page caching, browser caching, and minification.</p><h3>2. Optimize images</h3><p>Install <strong>Smush</strong> or <strong>ShortPixel</strong> to compress images without quality loss. Use WebP format for best performance.</p><h3>3. Use a CDN</h3><p>Cloudflare's free plan delivers your static assets (images, CSS, JS) from servers closest to each visitor.</p><h3>4. Limit plugins</h3><p>Each plugin adds load time. Audit your plugins and deactivate anything you are not actively using.</p><h3>5. Use lightweight themes</h3><p>Themes like Astra, GeneratePress, and Kadence are designed for speed.</p>` },
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════════
     4. DOMAINS
  ═══════════════════════════════════════════════════ */
  {
    slug: 'domains',
    title: 'Domains',
    description: 'Purchasing, transferring, and managing your domain names',
    iconName: 'Globe',
    sections: [
      {
        title: 'Domain Registration',
        articles: [
          { slug: 'how-to-register-domain', title: 'How to Register a New Domain', excerpt: 'Search for and register your domain name through the Noehost domain search.', readTime: 3, content: `<h2>Registering a New Domain</h2><ol><li>Go to <strong>noehost.com/domains</strong></li><li>Type your desired domain name in the search bar</li><li>Click <strong>Search</strong></li><li>Review available options (different TLDs are shown)</li><li>Click <strong>Add to Cart</strong> on your chosen domain</li><li>Choose registration period (1–10 years)</li><li>Add domain privacy if desired (recommended)</li><li>Proceed to checkout</li></ol><h2>Choosing the Right TLD</h2><ul><li><strong>.com</strong> — most recognized globally</li><li><strong>.pk</strong> — ideal for Pakistan-based businesses</li><li><strong>.org</strong> — for non-profits and organizations</li><li><strong>.net</strong> — for network or tech companies</li><li><strong>.co</strong> — popular for startups</li></ul>` },
          { slug: 'domain-registration-requirements', title: 'Domain Registration Requirements by TLD', excerpt: 'Some domain extensions require specific documentation. Learn which TLDs have requirements.', readTime: 3, content: `<h2>TLD Requirements</h2><h3>Generic TLDs (.com, .net, .org)</h3><p>No special requirements. Anyone can register.</p><h3>.pk domains</h3><p>Pakistan domains require a valid Pakistani CNIC or business registration number.</p><h3>Country-code TLDs</h3><p>Many ccTLDs require residency or a local presence in that country. Check specific requirements at the time of registration.</p>` },
          { slug: 'how-to-renew-domain', title: 'How to Renew Your Domain Name', excerpt: 'Renew your domain before it expires to prevent your website from going offline.', readTime: 3, content: `<h2>Renewing Your Domain</h2><h3>Manual Renewal</h3><ol><li>Log in to your Noehost client area</li><li>Go to <strong>Domains → My Domains</strong></li><li>Click <strong>Renew</strong> next to your domain</li><li>Select renewal period and complete payment</li></ol><h3>Auto-Renewal</h3><p>We recommend enabling auto-renewal to never lose your domain. Go to <strong>Domains → My Domains → Toggle Auto-Renew ON</strong>.</p><h2>Domain Expiry Timeline</h2><ul><li><strong>30 days before:</strong> first renewal reminder</li><li><strong>7 days before:</strong> final reminder</li><li><strong>At expiry:</strong> domain suspended</li><li><strong>30-day grace period:</strong> can still renew (may incur fee)</li><li><strong>After grace period:</strong> domain enters redemption then deletion</li></ul>` },
          { slug: 'domain-privacy-protection', title: 'What is Domain Privacy Protection?', excerpt: 'Protect your personal contact details from being publicly visible in WHOIS records.', readTime: 3, content: `<h2>Domain Privacy Protection</h2><p>When you register a domain, your name, address, email, and phone number are stored in a public WHOIS database. Anyone can look up this information.</p><h2>What Privacy Protection Does</h2><p>Privacy protection replaces your real contact details in the WHOIS database with generic Noehost contact information, hiding your personal data from the public.</p><h2>Benefits</h2><ul><li>Prevents spam targeting domain owners</li><li>Hides personal address from public view</li><li>Reduces cold calls from domain brokers</li><li>Helps prevent social engineering attacks</li></ul><h2>Enabling Privacy</h2><ol><li>Go to <strong>Domains → My Domains</strong></li><li>Click on your domain</li><li>Toggle <strong>Privacy Protection ON</strong></li></ol>` },
        ],
      },
      {
        title: 'Domain Transfers',
        articles: [
          { slug: 'how-to-transfer-domain-in', title: 'How to Transfer a Domain to Noehost', excerpt: 'Transfer your domain to Noehost to manage everything from one place.', readTime: 5, content: `<h2>Transferring a Domain to Noehost</h2><h3>Before You Start</h3><ul><li>Domain must be at least 60 days old</li><li>Domain must not be expiring within 7 days</li><li>Unlock the domain at your current registrar</li><li>Get the EPP/Authorization Code from your registrar</li><li>Disable WHOIS privacy temporarily</li></ul><h3>Transfer Steps</h3><ol><li>Go to <strong>noehost.com/domains</strong> and select <strong>Transfer Domain</strong></li><li>Enter your domain name</li><li>Enter the EPP/Auth code</li><li>Add to cart and complete payment</li><li>Click the confirmation email sent to your WHOIS email</li><li>Transfer typically completes within 5–7 days</li></ol>` },
          { slug: 'how-to-transfer-domain-out', title: 'How to Transfer a Domain Away from Noehost', excerpt: 'Release your domain to another registrar by unlocking it and providing the EPP code.', readTime: 3, content: `<h2>Transferring Domain Away</h2><ol><li>Log in to your Noehost client area</li><li>Go to <strong>Domains → My Domains</strong></li><li>Click on the domain you want to transfer</li><li>Click <strong>Unlock Domain</strong></li><li>Click <strong>Get EPP Code</strong> — it will be emailed to you</li><li>Provide this code to your new registrar to initiate the transfer</li></ol><h2>Notes</h2><ul><li>Transferring extends registration by 1 year (charged by new registrar)</li><li>The transfer window is 60 days after the unlock</li></ul>` },
        ],
      },
      {
        title: 'Domain Management',
        articles: [
          { slug: 'how-to-add-addon-domain', title: 'How to Add an Addon Domain in cPanel', excerpt: 'Host a second website on the same hosting account by adding an addon domain in cPanel.', readTime: 3, content: `<h2>Adding Addon Domains</h2><ol><li>Log in to cPanel</li><li>Go to <strong>Domains → Addon Domains</strong></li><li>Enter the domain name</li><li>Set the document root (e.g., <code>public_html/domain2</code>)</li><li>Click <strong>Add Domain</strong></li></ol><h2>After Adding</h2><p>Update your domain's DNS to point to this server (either via nameservers or A record). Then upload your second website's files to the specified document root folder.</p>` },
          { slug: 'how-to-add-subdomain', title: 'How to Create a Subdomain in cPanel', excerpt: 'Create subdomains like blog.yourdomain.com or shop.yourdomain.com in cPanel.', readTime: 3, content: `<h2>Creating a Subdomain</h2><ol><li>Log in to cPanel</li><li>Go to <strong>Domains → Subdomains</strong></li><li>Enter the subdomain prefix (e.g., <code>blog</code>)</li><li>Select the main domain from the dropdown</li><li>The document root fills automatically (e.g., <code>public_html/blog</code>)</li><li>Click <strong>Create</strong></li></ol><h2>Subdomain Uses</h2><ul><li><code>blog.yourdomain.com</code> — separate blog</li><li><code>shop.yourdomain.com</code> — eCommerce store</li><li><code>staging.yourdomain.com</code> — testing environment</li><li><code>mail.yourdomain.com</code> — webmail access</li></ul>` },
          { slug: 'domain-redirect', title: 'How to Redirect a Domain in cPanel', excerpt: 'Set up domain redirects to forward visitors from one URL to another.', readTime: 3, content: `<h2>Setting Up Domain Redirects</h2><ol><li>Log in to cPanel</li><li>Go to <strong>Domains → Redirects</strong></li><li>Select redirect type: <strong>301</strong> (permanent) or <strong>302</strong> (temporary)</li><li>Select the domain to redirect from</li><li>Enter the destination URL</li><li>Click <strong>Add</strong></li></ol><h2>When to Use 301 vs 302</h2><ul><li><strong>301 Permanent</strong> — use when you have moved content permanently (best for SEO)</li><li><strong>302 Temporary</strong> — use for temporary redirects like maintenance pages</li></ul>` },
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════════
     5. DNS
  ═══════════════════════════════════════════════════ */
  {
    slug: 'dns',
    title: 'DNS',
    description: "Managing your domain's DNS Zone",
    iconName: 'FileText',
    sections: [
      {
        title: 'DNS Basics',
        articles: [
          { slug: 'what-is-dns', title: 'What is DNS and How Does It Work?', excerpt: 'A complete beginner guide to DNS — how domain names are resolved to IP addresses.', readTime: 5, content: `<h2>What is DNS?</h2><p>DNS (Domain Name System) is the internet's phone book. It translates human-readable domain names like <code>noehost.com</code> into IP addresses like <code>192.168.1.1</code> that computers use to connect.</p><h2>The DNS Resolution Process</h2><ol><li>You type <code>noehost.com</code> in your browser</li><li>Browser checks local cache — if found, done</li><li>Browser asks your ISP's DNS resolver</li><li>Resolver asks root nameservers → TLD nameservers → authoritative nameservers</li><li>Authoritative nameserver returns the IP address</li><li>Browser connects to that IP</li></ol><h2>DNS Record Types</h2><ul><li><strong>A</strong> — maps domain to IPv4 address</li><li><strong>AAAA</strong> — maps domain to IPv6 address</li><li><strong>CNAME</strong> — alias from one domain to another</li><li><strong>MX</strong> — mail server records</li><li><strong>TXT</strong> — text records (used for verification, SPF, DKIM)</li><li><strong>NS</strong> — nameserver records</li></ul>` },
          { slug: 'dns-propagation', title: 'What is DNS Propagation and How Long Does It Take?', excerpt: 'Understand why DNS changes take time to take effect and how to check propagation status.', readTime: 3, content: `<h2>DNS Propagation Explained</h2><p>DNS propagation is the time it takes for DNS changes to spread to all DNS servers worldwide. During this period, some visitors may see your old DNS records while others see new ones.</p><h2>How Long Does It Take?</h2><ul><li>Most changes propagate within <strong>1–4 hours</strong></li><li>Full global propagation can take <strong>up to 48 hours</strong></li></ul><h2>Factors That Affect Speed</h2><ul><li>TTL (Time to Live) — lower TTL = faster propagation</li><li>Your ISP's DNS cache refresh rate</li><li>Geographic location</li></ul><h2>Checking Propagation</h2><p>Use <strong>whatsmydns.net</strong> to check if your DNS has propagated in different countries.</p>` },
        ],
      },
      {
        title: 'DNS Record Types',
        articles: [
          { slug: 'how-to-add-a-record', title: 'How to Add an A Record in cPanel', excerpt: 'Add an A record to point your domain or subdomain to a specific IP address.', readTime: 3, content: `<h2>Adding an A Record</h2><ol><li>Log in to cPanel</li><li>Go to <strong>Domains → Zone Editor</strong></li><li>Click <strong>Manage</strong> next to your domain</li><li>Click <strong>Add Record</strong></li><li>Set Type to <strong>A</strong></li><li>Enter the Name (@ for root, or subdomain prefix)</li><li>Enter the IP address</li><li>Set TTL (3600 is standard)</li><li>Click <strong>Add Record</strong></li></ol>` },
          { slug: 'how-to-add-cname', title: 'How to Add a CNAME Record', excerpt: 'Create a CNAME record to point one domain name to another — commonly used for www subdomains.', readTime: 3, content: `<h2>Adding a CNAME Record</h2><ol><li>Log in to cPanel → Zone Editor</li><li>Click Manage next to your domain</li><li>Click Add Record</li><li>Set Type to <strong>CNAME</strong></li><li>Enter the Name (e.g., <code>www</code>)</li><li>Enter the Target (e.g., <code>yourdomain.com</code>)</li><li>Click Add Record</li></ol><h2>Common CNAME Uses</h2><ul><li><code>www</code> → <code>yourdomain.com</code> (www redirect)</li><li><code>mail</code> → <code>ghs.google.com</code> (Google Workspace)</li><li><code>verify</code> → provider verification strings</li></ul>` },
          { slug: 'how-to-set-mx-records', title: 'How to Set Up MX Records for Email', excerpt: 'Configure MX records to direct email traffic to the correct mail server.', readTime: 4, content: `<h2>Setting Up MX Records</h2><p>MX (Mail Exchanger) records tell the internet which mail server handles email for your domain.</p><h3>For cPanel/Noehost Mail</h3><ol><li>Log in to cPanel → Zone Editor</li><li>Delete existing MX records if resetting</li><li>Add MX record with Name: <code>@</code>, Value: <code>mail.yourdomain.com</code>, Priority: <code>0</code></li></ol><h3>For Google Workspace</h3><p>Replace your MX records with Google's servers (priority order): ASPMX.L.GOOGLE.COM (1), ALT1.ASPMX.L.GOOGLE.COM (5), ALT2.ASPMX.L.GOOGLE.COM (5)</p>` },
          { slug: 'how-to-add-txt-record', title: 'How to Add a TXT Record (SPF, DKIM, Domain Verification)', excerpt: 'Add TXT records for SPF email authentication, DKIM signing, and domain ownership verification.', readTime: 4, content: `<h2>Adding TXT Records</h2><ol><li>Log in to cPanel → Zone Editor → Manage</li><li>Click Add Record</li><li>Set Type to <strong>TXT</strong></li><li>Set Name to <code>@</code> for root, or specific subdomain</li><li>Enter the TXT value</li><li>Click Add Record</li></ol><h2>Common TXT Records</h2><h3>SPF (prevents email spoofing)</h3><code>v=spf1 include:noehost.com ~all</code><h3>Google Site Verification</h3><code>google-site-verification=XXXXX</code><h3>Domain ownership for Cloudflare</h3><p>Cloudflare and other services provide a TXT value to verify you own the domain.</p>` },
        ],
      },
      {
        title: 'DNS Troubleshooting',
        articles: [
          { slug: 'dns-not-resolving', title: 'Why Is My Domain Not Resolving?', excerpt: 'Diagnose and fix common reasons why your domain name is not loading your website.', readTime: 5, content: `<h2>Troubleshooting DNS Resolution</h2><h3>Check 1 — Nameservers</h3><p>Run: <code>nslookup -type=NS yourdomain.com</code>. Nameservers should show ns1.noehost.com and ns2.noehost.com (or your custom nameservers).</p><h3>Check 2 — A Record</h3><p>Run: <code>nslookup yourdomain.com</code>. Should return your server's IP address.</p><h3>Check 3 — Propagation</h3><p>Visit whatsmydns.net to check if the A record has propagated globally.</p><h3>Check 4 — Server Running</h3><p>Check <strong>noehost.com/server-status</strong> to confirm the server is online.</p><h3>Check 5 — DNS Cache</h3><p>Clear your local DNS cache: on Windows run <code>ipconfig /flushdns</code>, on Mac run <code>sudo dscacheutil -flushcache</code>.</p>` },
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════════
     6. FILES & FTP
  ═══════════════════════════════════════════════════ */
  {
    slug: 'files-ftp',
    title: 'Files & FTP',
    description: 'How to manage and transfer your website files',
    iconName: 'HardDrive',
    sections: [
      {
        title: 'FTP Access',
        articles: [
          { slug: 'how-to-setup-ftp', title: 'How to Set Up FTP Access with FileZilla', excerpt: 'Connect to your Noehost hosting via FTP using FileZilla to upload and manage files.', readTime: 4, content: `<h2>Setting Up FTP with FileZilla</h2><h3>Step 1 — Get FTP credentials</h3><ol><li>Log in to cPanel</li><li>Go to <strong>Files → FTP Accounts</strong></li><li>Create a new FTP account or use the main cPanel account</li></ol><h3>Step 2 — Connect in FileZilla</h3><ol><li>Download FileZilla from filezilla-project.org</li><li>Open FileZilla → <strong>File → Site Manager → New Site</strong></li><li>Host: your domain or server IP</li><li>Protocol: FTP - File Transfer Protocol</li><li>Encryption: Require explicit FTP over TLS</li><li>User: your cPanel username or FTP username</li><li>Password: your cPanel or FTP password</li><li>Click Connect</li></ol>` },
          { slug: 'how-to-create-ftp-account', title: 'How to Create an FTP Account in cPanel', excerpt: 'Create a restricted FTP account to give developers or team members access to specific folders only.', readTime: 3, content: `<h2>Creating an FTP Account</h2><ol><li>Log in to cPanel</li><li>Go to <strong>Files → FTP Accounts</strong></li><li>Enter a username (e.g., <code>developer</code>)</li><li>Set a strong password</li><li>Set the directory (restrict access to specific folder, e.g., <code>public_html/project</code>)</li><li>Set a quota or leave as Unlimited</li><li>Click <strong>Create FTP Account</strong></li></ol><h2>Security Tip</h2><p>Always restrict FTP accounts to the specific directory they need. Never give access to the root home directory unless absolutely necessary.</p>` },
          { slug: 'how-to-use-sftp', title: 'How to Connect via SFTP (Secure FTP)', excerpt: 'Connect to your server using SFTP for an encrypted, secure file transfer connection.', readTime: 3, content: `<h2>Connecting via SFTP</h2><p>SFTP (SSH File Transfer Protocol) encrypts your connection, making it more secure than regular FTP.</p><h3>In FileZilla</h3><ol><li>Open Site Manager</li><li>Protocol: <strong>SFTP - SSH File Transfer Protocol</strong></li><li>Host: your domain or server IP</li><li>Port: 22</li><li>User: cPanel username</li><li>Password: cPanel password</li></ol><h3>SFTP Requirements</h3><p>SSH access must be enabled on your hosting plan. VPS plans have SSH enabled by default. Contact support to enable it on shared plans.</p>` },
        ],
      },
      {
        title: 'File Management',
        articles: [
          { slug: 'file-permissions', title: 'Understanding File Permissions (CHMOD)', excerpt: 'Learn how Unix file permissions work and which CHMOD values are correct for web files.', readTime: 5, content: `<h2>File Permissions</h2><p>Unix file permissions control who can read, write, and execute files on your server.</p><h2>Permission Basics</h2><p>Permissions are set for three groups: <strong>Owner, Group, Others</strong>. Each can have: Read (4), Write (2), Execute (1).</p><h2>Correct Permissions for Web Files</h2><ul><li><strong>Files:</strong> 644 (owner: read+write, group+others: read only)</li><li><strong>Folders:</strong> 755 (owner: all, group+others: read+execute)</li><li><strong>wp-config.php:</strong> 600 (owner only)</li></ul><h3>Changing Permissions in cPanel</h3><ol><li>File Manager → right-click file/folder</li><li>Select <strong>Change Permissions</strong></li><li>Enter numeric value or tick checkboxes</li></ol>` },
          { slug: 'how-to-create-backup', title: 'How to Create a Website Backup in cPanel', excerpt: 'Download a full backup of your website files and databases from cPanel.', readTime: 4, content: `<h2>Creating a Backup</h2><h3>Full Backup</h3><ol><li>Log in to cPanel</li><li>Go to <strong>Files → Backup</strong></li><li>Click <strong>Download a Full Account Backup</strong></li><li>Select destination (Home Directory)</li><li>Enter email for notification</li><li>Click <strong>Generate Backup</strong></li><li>Wait for email then download from the same page</li></ol><h3>Partial Backups (faster)</h3><ul><li><strong>Home Directory</strong> — all your files</li><li><strong>MySQL Database</strong> — specific databases only</li></ul>` },
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════════
     7. EMAIL
  ═══════════════════════════════════════════════════ */
  {
    slug: 'email',
    title: 'Email',
    description: 'Setting up and managing business email accounts',
    iconName: 'Mail',
    sections: [
      {
        title: 'Email Setup',
        articles: [
          { slug: 'how-to-setup-business-email', title: 'How to Set Up a Professional Business Email', excerpt: 'Create and configure a custom @yourdomain.com email address for your business.', readTime: 5, content: `<h2>Creating a Business Email</h2><ol><li>Log in to cPanel</li><li>Click <strong>Email Accounts</strong></li><li>Click <strong>Create</strong></li><li>Choose your domain</li><li>Enter your username (e.g., <code>info</code>)</li><li>Set a strong password</li><li>Click <strong>Create Account</strong></li></ol><h2>IMAP Settings for Email Clients</h2><ul><li>Server: <code>mail.yourdomain.com</code></li><li>IMAP Port: 993 (SSL)</li><li>SMTP Port: 465 (SSL)</li><li>Username: your full email address</li></ul>` },
          { slug: 'setup-email-outlook', title: 'How to Set Up Email in Microsoft Outlook', excerpt: 'Add your Noehost email account to Outlook for Windows or Mac.', readTime: 4, content: `<h2>Adding Email to Outlook</h2><ol><li>Open Outlook → <strong>File → Add Account</strong></li><li>Enter your full email address</li><li>Select <strong>Advanced options → Let me set up my account manually</strong></li><li>Select <strong>IMAP</strong></li><li><strong>Incoming mail:</strong> mail.yourdomain.com, Port 993, SSL/TLS</li><li><strong>Outgoing mail:</strong> mail.yourdomain.com, Port 465, SSL/TLS</li><li>Enter your email password</li><li>Click <strong>Connect</strong></li></ol>` },
          { slug: 'setup-email-gmail', title: 'How to Add Your Domain Email to Gmail', excerpt: 'Receive and send emails using your custom domain address from within Gmail.', readTime: 5, content: `<h2>Adding Domain Email to Gmail</h2><h3>Receive Emails (IMAP)</h3><ol><li>Gmail → Settings → See all settings → Accounts → Add a mail account</li><li>Enter your business email address</li><li>Select <strong>Import emails from my other account (POP3)</strong></li><li>POP3 server: mail.yourdomain.com, Port 995, SSL</li><li>Enter your email password</li></ol><h3>Send Emails</h3><ol><li>Gmail → Settings → Accounts → Add another email address</li><li>Enter your name and business email</li><li>SMTP server: mail.yourdomain.com, Port 465, SSL</li><li>Enter your email password</li><li>Verify ownership via confirmation email</li></ol>` },
          { slug: 'setup-email-mobile', title: 'How to Set Up Email on iPhone and Android', excerpt: 'Add your professional email to the Mail app on iOS or Android Gmail/Mail.', readTime: 4, content: `<h2>Email on Mobile</h2><h3>iPhone (iOS Mail)</h3><ol><li>Settings → Mail → Accounts → Add Account → Other</li><li>Tap <strong>Add Mail Account</strong></li><li>Enter name, email, password, description</li><li>Incoming: IMAP, mail.yourdomain.com, port 993, SSL</li><li>Outgoing: SMTP, mail.yourdomain.com, port 465, SSL</li></ol><h3>Android (Gmail app)</h3><ol><li>Gmail → Menu → Add account → Other</li><li>Enter your email address</li><li>Select <strong>Personal (IMAP)</strong></li><li>Enter password and follow prompts with above settings</li></ol>` },
        ],
      },
      {
        title: 'Webmail',
        articles: [
          { slug: 'how-to-access-webmail', title: 'How to Access Webmail (Roundcube)', excerpt: 'Access your email from any browser using the built-in Roundcube webmail client.', readTime: 2, content: `<h2>Accessing Webmail</h2><p>Access your email from any browser by going to: <code>yourdomain.com/webmail</code></p><h2>Login</h2><ul><li>Username: your full email address (e.g., <code>info@yourdomain.com</code>)</li><li>Password: your email account password</li></ul><h2>Roundcube Features</h2><ul><li>Send and receive email</li><li>Organize with folders</li><li>Address book contacts</li><li>Manage filters and forwarders</li><li>Vacation auto-reply</li></ul>` },
        ],
      },
      {
        title: 'Email Troubleshooting',
        articles: [
          { slug: 'email-not-sending', title: 'Why Is My Email Not Sending? (Troubleshooting)', excerpt: 'Fix common issues that prevent your email from being delivered.', readTime: 5, content: `<h2>Email Not Sending — Troubleshooting</h2><h3>Check 1 — SMTP Settings</h3><p>Verify your SMTP port and SSL settings. Use Port 465 with SSL, not Port 25 (often blocked by ISPs).</p><h3>Check 2 — Authentication</h3><p>Ensure SMTP authentication is enabled in your email client. Use your full email address as username.</p><h3>Check 3 — SPF Record</h3><p>Missing SPF record causes many emails to be rejected. Add TXT record: <code>v=spf1 include:noehost.com ~all</code></p><h3>Check 4 — Blacklist</h3><p>Check if your IP is on an email blacklist at mxtoolbox.com/blacklists. Contact support if blacklisted.</p><h3>Check 5 — Outbox vs Sent</h3><p>If emails sit in Outbox, the SMTP connection is failing. Double-check server settings.</p>` },
          { slug: 'email-going-to-spam', title: 'Why Is My Email Going to Spam?', excerpt: 'Configure SPF, DKIM, and DMARC records to improve email deliverability.', readTime: 5, content: `<h2>Fixing Email Going to Spam</h2><h3>1. Add SPF Record</h3><p>TXT record at root: <code>v=spf1 include:noehost.com ~all</code></p><h3>2. Enable DKIM</h3><ol><li>cPanel → Email → Email Deliverability</li><li>Find your domain and click <strong>Repair</strong></li><li>This installs DKIM and SPF automatically</li></ol><h3>3. Add DMARC Record</h3><p>TXT record at <code>_dmarc</code>: <code>v=DMARC1; p=none; rua=mailto:admin@yourdomain.com</code></p><h3>4. Avoid Spam Triggers</h3><ul><li>Do not write in ALL CAPS</li><li>Avoid excessive exclamation marks</li><li>Include a plain text version</li><li>Add unsubscribe link to newsletters</li></ul>` },
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════════
     8. DATABASES
  ═══════════════════════════════════════════════════ */
  {
    slug: 'databases',
    title: 'Databases',
    description: 'MySQL databases, phpMyAdmin, and database management',
    iconName: 'Database',
    sections: [
      {
        title: 'MySQL Databases',
        articles: [
          { slug: 'how-to-create-mysql-database', title: 'How to Create a MySQL Database in cPanel', excerpt: 'Create a new MySQL database and user, and grant the user full privileges.', readTime: 4, content: `<h2>Creating a MySQL Database</h2><ol><li>Log in to cPanel</li><li>Go to <strong>Databases → MySQL Databases</strong></li><li>Under <strong>Create New Database</strong>, enter a name (e.g., <code>mydb</code>)</li><li>Click <strong>Create Database</strong></li></ol><h2>Create a Database User</h2><ol><li>Under <strong>MySQL Users</strong>, enter a username and strong password</li><li>Click <strong>Create User</strong></li></ol><h2>Add User to Database</h2><ol><li>Under <strong>Add User to Database</strong>, select your user and database</li><li>Click <strong>Add</strong></li><li>Grant <strong>All Privileges</strong></li><li>Click <strong>Make Changes</strong></li></ol><h2>Connection Details</h2><ul><li>Host: <code>localhost</code></li><li>Database: <code>cpaneluser_mydb</code></li><li>User: <code>cpaneluser_myuser</code></li></ul>` },
          { slug: 'how-to-import-database', title: 'How to Import a MySQL Database via phpMyAdmin', excerpt: 'Import an existing SQL database backup into your Noehost MySQL database.', readTime: 3, content: `<h2>Importing a Database</h2><ol><li>Log in to cPanel → <strong>phpMyAdmin</strong></li><li>Click on your database name in the left sidebar</li><li>Click the <strong>Import</strong> tab at the top</li><li>Click <strong>Choose File</strong> and select your .sql file</li><li>Leave format as SQL</li><li>Click <strong>Go</strong></li></ol><h2>Large Databases</h2><p>phpMyAdmin has an upload limit of 50MB by default. For larger databases, use SSH: <code>mysql -u username -p database_name &lt; backup.sql</code></p>` },
          { slug: 'how-to-export-database', title: 'How to Export and Backup a MySQL Database', excerpt: 'Download a complete SQL backup of your database for safekeeping or migration.', readTime: 3, content: `<h2>Exporting a Database</h2><h3>Method 1 — phpMyAdmin</h3><ol><li>Log in to phpMyAdmin</li><li>Select your database</li><li>Click <strong>Export</strong> tab</li><li>Leave format as SQL, click <strong>Go</strong></li><li>Save the downloaded .sql file</li></ol><h3>Method 2 — cPanel Backup</h3><ol><li>cPanel → Files → Backup</li><li>Under MySQL Databases, click your database name</li><li>Download the .sql.gz file</li></ol>` },
        ],
      },
      {
        title: 'phpMyAdmin',
        articles: [
          { slug: 'phpmyadmin-overview', title: 'phpMyAdmin Overview — Managing Your Database', excerpt: 'A guide to using phpMyAdmin to browse, edit, query, and manage your MySQL databases.', readTime: 5, content: `<h2>phpMyAdmin Overview</h2><p>phpMyAdmin is a web-based MySQL management tool included with all Noehost hosting plans.</p><h2>Opening phpMyAdmin</h2><p>cPanel → Databases → phpMyAdmin</p><h2>Key Features</h2><ul><li><strong>Browse</strong> — view table contents and rows</li><li><strong>SQL</strong> — run custom SQL queries</li><li><strong>Import/Export</strong> — backup and restore databases</li><li><strong>Structure</strong> — add, edit, or drop columns and tables</li><li><strong>Search</strong> — search across all tables</li><li><strong>Operations</strong> — rename, repair, optimize tables</li></ul>` },
          { slug: 'reset-wordpress-admin-database', title: 'How to Reset WordPress Admin Password via phpMyAdmin', excerpt: "Reset your WordPress admin password directly in the database if you can't access the login page.", readTime: 3, content: `<h2>Resetting WordPress Admin Password via Database</h2><ol><li>Log in to phpMyAdmin</li><li>Select your WordPress database</li><li>Click on the <code>wp_users</code> table</li><li>Click <strong>Edit</strong> on the admin user row</li><li>Find the <code>user_pass</code> field</li><li>Change Function to <strong>MD5</strong></li><li>Enter your new password in the value field</li><li>Click <strong>Go</strong></li></ol><p>You can now log in with the new password.</p>` },
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════════
     9. SSL & SECURITY
  ═══════════════════════════════════════════════════ */
  {
    slug: 'ssl-security',
    title: 'SSL & Security',
    description: 'SSL certificates, security features, and best practices',
    iconName: 'Shield',
    sections: [
      {
        title: 'SSL Certificates',
        articles: [
          { slug: 'install-free-ssl', title: "How to Install a Free SSL Certificate (Let's Encrypt)", excerpt: "Install a free Let's Encrypt SSL certificate to enable HTTPS on your website.", readTime: 3, content: `<h2>Installing Free SSL</h2><ol><li>Log in to cPanel</li><li>Go to <strong>Security → SSL/TLS Status</strong></li><li>Find your domain</li><li>Click <strong>Run AutoSSL</strong></li><li>Wait 2–5 minutes for installation</li></ol><h2>Verifying SSL is Active</h2><p>Visit your website with <code>https://</code>. You should see a padlock icon in the browser address bar.</p><h2>Force HTTPS</h2><p>Add to .htaccess: <code>RewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]</code></p>` },
          { slug: 'ssl-renewal', title: 'How to Renew an SSL Certificate', excerpt: "Let's Encrypt SSL certificates renew automatically. Learn how to manually renew if auto-renewal fails.", readTime: 3, content: `<h2>SSL Renewal</h2><h3>Automatic Renewal</h3><p>Let's Encrypt certificates are valid for 90 days and auto-renew every 60 days on Noehost. No action required.</p><h3>Manual Renewal</h3><ol><li>cPanel → Security → SSL/TLS Status</li><li>If certificate shows as expiring, click <strong>Run AutoSSL</strong></li><li>Wait 5 minutes and refresh</li></ol><h3>If AutoSSL Fails</h3><p>Check that: 1) Your domain points to this server, 2) There is no .htaccess rewrite blocking HTTP (AutoSSL needs HTTP verification), 3) There is no existing CAA DNS record blocking Let's Encrypt.</p>` },
          { slug: 'ssl-mixed-content', title: 'How to Fix Mixed Content Warnings (HTTPS)', excerpt: 'Fix the "Not Secure" warning that appears when a page loaded over HTTPS contains HTTP resources.', readTime: 4, content: `<h2>Fixing Mixed Content</h2><p>Mixed content occurs when an HTTPS page loads resources (images, scripts, CSS) over HTTP.</p><h3>Finding Mixed Content</h3><ol><li>Open browser DevTools (F12)</li><li>Go to Console tab</li><li>Look for warnings about HTTP resources on HTTPS pages</li></ol><h3>Fixing in WordPress</h3><ol><li>Install the <strong>Better Search Replace</strong> plugin</li><li>Replace <code>http://yourdomain.com</code> with <code>https://yourdomain.com</code> in all database tables</li></ol><h3>For Static Sites</h3><p>Find and replace all <code>http://</code> URLs in your HTML/CSS/JS files with <code>https://</code> or protocol-relative <code>//</code> URLs.</p>` },
        ],
      },
      {
        title: 'Security Features',
        articles: [
          { slug: 'cpanel-ip-blocker', title: 'How to Block IP Addresses in cPanel', excerpt: 'Block specific IP addresses or ranges from accessing your website using cPanel IP Blocker.', readTime: 3, content: `<h2>Blocking IP Addresses</h2><ol><li>Log in to cPanel</li><li>Go to <strong>Security → IP Blocker</strong></li><li>Enter the IP address or range to block</li><li>Click <strong>Add</strong></li></ol><h2>IP Range Formats</h2><ul><li>Single IP: <code>192.168.1.100</code></li><li>Range: <code>192.168.1.1-192.168.1.255</code></li><li>CIDR: <code>192.168.1.0/24</code></li></ul><h2>Remove a Block</h2><p>Go to IP Blocker → find the entry → click <strong>Delete</strong>.</p>` },
          { slug: 'modsecurity', title: 'What is ModSecurity and How to Use It', excerpt: 'ModSecurity is a web application firewall that protects your site from common attacks.', readTime: 4, content: `<h2>ModSecurity Overview</h2><p>ModSecurity is a web application firewall (WAF) that filters and monitors HTTP traffic between your website and the internet. It protects against SQL injection, XSS, CSRF, and more.</p><h2>Managing ModSecurity in cPanel</h2><ol><li>Log in to cPanel</li><li>Go to <strong>Security → ModSecurity</strong></li><li>Toggle ModSecurity on or off for specific domains</li></ol><h2>If ModSecurity is Blocking Legitimate Traffic</h2><p>Temporarily disable ModSecurity for your domain to test. If your application works with it off, the WAF rule set is too strict. Contact support to whitelist specific rules.</p>` },
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════════
     10. BILLING & PAYMENTS
  ═══════════════════════════════════════════════════ */
  {
    slug: 'billing-payments',
    title: 'Billing & Payments',
    description: 'Invoices, payment methods, renewals, and account upgrades',
    iconName: 'CreditCard',
    sections: [
      {
        title: 'Invoices & Payments',
        articles: [
          { slug: 'how-to-pay-invoice', title: 'How to Pay an Invoice', excerpt: 'Pay your hosting, domain, or add-on invoice from the Noehost client area.', readTime: 2, content: `<h2>Paying an Invoice</h2><ol><li>Log in to your Noehost client area</li><li>Go to <strong>Billing → Invoices</strong></li><li>Click on the unpaid invoice</li><li>Review the invoice details</li><li>Select your payment method</li><li>Click <strong>Pay Now</strong></li></ol><h2>Payment Methods</h2><ul><li>Credit/Debit Card (Visa, Mastercard)</li><li>PayPal</li><li>Bank Transfer (manual)</li><li>Account Credit Balance</li></ul>` },
          { slug: 'how-to-add-payment-method', title: 'How to Add a Payment Method', excerpt: 'Save a credit card or PayPal account for automatic billing on your Noehost account.', readTime: 3, content: `<h2>Adding a Payment Method</h2><ol><li>Log in to client area</li><li>Go to <strong>Billing → Payment Methods</strong></li><li>Click <strong>Add New Payment Method</strong></li><li>Select type (card or PayPal)</li><li>Enter your card details (stored securely via Stripe)</li><li>Click <strong>Save</strong></li></ol><h2>Auto-Payment</h2><p>Once a card is saved, invoices will be charged automatically on their due date. You will receive an email receipt after each charge.</p>` },
          { slug: 'invoice-history', title: 'How to View and Download Invoices', excerpt: 'Access your complete billing history and download PDF invoices for accounting.', readTime: 2, content: `<h2>Viewing Invoice History</h2><ol><li>Log in to client area</li><li>Go to <strong>Billing → Invoices</strong></li><li>Filter by date range or status (paid/unpaid)</li></ol><h2>Downloading PDF Invoice</h2><ol><li>Click on any invoice</li><li>Click <strong>Download PDF</strong></li></ol>` },
        ],
      },
      {
        title: 'Upgrades & Renewals',
        articles: [
          { slug: 'how-to-upgrade-hosting', title: 'How to Upgrade Your Hosting Plan', excerpt: 'Upgrade to a higher plan for more storage, bandwidth, and resources.', readTime: 3, content: `<h2>Upgrading Your Hosting Plan</h2><ol><li>Log in to client area</li><li>Go to <strong>Services → My Services</strong></li><li>Click on your hosting plan</li><li>Click <strong>Upgrade/Downgrade</strong></li><li>Select your new plan</li><li>Review pricing (you pay the difference for remaining period)</li><li>Confirm the upgrade</li></ol><h2>What Happens to My Data?</h2><p>All your files, databases, emails, and settings are preserved during an upgrade. No downtime.</p>` },
          { slug: 'how-to-enable-auto-renew', title: 'How to Enable Auto-Renewal', excerpt: 'Set up auto-renewal to ensure your hosting and domains never expire unexpectedly.', readTime: 2, content: `<h2>Enabling Auto-Renewal</h2><h3>For Hosting</h3><ol><li>Go to Services → My Services</li><li>Click your hosting plan</li><li>Toggle <strong>Auto Renew ON</strong></li></ol><h3>For Domains</h3><ol><li>Go to Domains → My Domains</li><li>Click your domain</li><li>Toggle <strong>Auto Renew ON</strong></li></ol><h2>Requirements</h2><p>A saved payment method is required for auto-renewal to work. Add one at <strong>Billing → Payment Methods</strong>.</p>` },
          { slug: 'cancellation-policy', title: 'Noehost Cancellation and Refund Policy', excerpt: 'Learn about our 30-day money-back guarantee and how to cancel your hosting plan.', readTime: 3, content: `<h2>Cancellation Policy</h2><h3>30-Day Money-Back Guarantee</h3><p>New hosting accounts are eligible for a full refund within 30 days of purchase. Domain registrations are non-refundable.</p><h3>How to Cancel</h3><ol><li>Log in to client area</li><li>Go to <strong>Services → My Services</strong></li><li>Click on the service</li><li>Click <strong>Request Cancellation</strong></li><li>Select immediate or end-of-term cancellation</li><li>Submit reason</li></ol>` },
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════════
     11. VPS HOSTING
  ═══════════════════════════════════════════════════ */
  {
    slug: 'vps-hosting',
    title: 'VPS Hosting',
    description: 'VPS setup, SSH access, server management, and root control',
    iconName: 'Cpu',
    sections: [
      {
        title: 'VPS Setup',
        articles: [
          { slug: 'vps-first-setup', title: 'How to Set Up Your New VPS', excerpt: 'Complete first-setup guide for your Noehost VPS — OS, root password, and initial security.', readTime: 7, content: `<h2>VPS First Setup</h2><h3>Step 1 — Connect via SSH</h3><pre><code>ssh root@YOUR_VPS_IP</code></pre><h3>Step 2 — Update the System</h3><pre><code>apt update && apt upgrade -y    # Ubuntu/Debian
yum update -y                    # CentOS/AlmaLinux</code></pre><h3>Step 3 — Create a Non-Root User</h3><pre><code>adduser username
usermod -aG sudo username</code></pre><h3>Step 4 — Configure Firewall</h3><pre><code>ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable</code></pre><h3>Step 5 — Disable Root SSH Login</h3><pre><code>nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
systemctl restart ssh</code></pre>` },
          { slug: 'vps-install-lamp', title: 'How to Install LAMP Stack on a VPS (Ubuntu)', excerpt: 'Install Apache, MySQL, and PHP on your Noehost VPS to host websites.', readTime: 8, content: `<h2>Installing LAMP on Ubuntu</h2><h3>Install Apache</h3><pre><code>apt install apache2 -y
systemctl start apache2
systemctl enable apache2</code></pre><h3>Install MySQL</h3><pre><code>apt install mysql-server -y
mysql_secure_installation</code></pre><h3>Install PHP</h3><pre><code>apt install php libapache2-mod-php php-mysql -y</code></pre><h3>Test PHP</h3><pre><code>nano /var/www/html/info.php
# Add: &lt;?php phpinfo(); ?&gt;</code></pre><p>Visit <code>http://YOUR_VPS_IP/info.php</code> to confirm PHP is working.</p>` },
          { slug: 'vps-install-cpanel', title: 'How to Install cPanel/WHM on a VPS', excerpt: 'Install cPanel & WHM on your Noehost VPS for a familiar hosting control panel.', readTime: 10, content: `<h2>Installing cPanel/WHM</h2><h3>Requirements</h3><ul><li>Fresh AlmaLinux 8 or CloudLinux install</li><li>Minimum 2GB RAM (4GB recommended)</li><li>Clean install (no other web server)</li></ul><h3>Installation</h3><pre><code>cd /home
curl -o latest -L https://securedownloads.cpanel.net/latest
sh latest</code></pre><p>Installation takes 20–45 minutes. Once complete, access WHM at <code>https://YOUR_IP:2087</code>.</p><h3>Initial Setup</h3><ol><li>Enter license key (contact Noehost support for cPanel licenses)</li><li>Configure nameservers</li><li>Set up packages and account creation</li></ol>` },
        ],
      },
      {
        title: 'SSH & Root Access',
        articles: [
          { slug: 'how-to-connect-ssh', title: 'How to Connect to Your VPS via SSH', excerpt: 'Connect to your Noehost VPS server using SSH on Windows, Mac, and Linux.', readTime: 4, content: `<h2>Connecting via SSH</h2><h3>Mac/Linux</h3><pre><code>ssh username@YOUR_VPS_IP
ssh -p 22 username@YOUR_VPS_IP</code></pre><h3>Windows (PuTTY)</h3><ol><li>Download PuTTY from putty.org</li><li>Enter your VPS IP in the Host Name field</li><li>Port: 22, Connection type: SSH</li><li>Click Open</li><li>Enter username and password when prompted</li></ol><h3>Using SSH Keys (recommended)</h3><pre><code># Generate key pair (on your computer)
ssh-keygen -t ed25519 -C "your@email.com"

# Copy public key to server
ssh-copy-id username@YOUR_VPS_IP</code></pre>` },
          { slug: 'basic-linux-commands', title: 'Essential Linux Commands for VPS Management', excerpt: 'The most important Linux commands every VPS user should know.', readTime: 6, content: `<h2>Essential Linux Commands</h2><h3>Navigation</h3><pre><code>pwd          # Current directory
ls -la       # List files with details
cd /var/www  # Change directory
cd ..        # Go up one level</code></pre><h3>File Operations</h3><pre><code>cp file.txt /backup/      # Copy
mv file.txt /new/path/    # Move/rename
rm file.txt               # Delete file
rm -rf folder/            # Delete folder (caution!)
nano file.txt             # Edit file</code></pre><h3>System Monitoring</h3><pre><code>top           # Process monitor
htop          # Better process monitor
df -h         # Disk space
free -m       # Memory usage
netstat -tlpn # Open ports</code></pre><h3>Services</h3><pre><code>systemctl status apache2
systemctl restart nginx
systemctl enable mysql</code></pre>` },
        ],
      },
    ],
  },

  /* ═══════════════════════════════════════════════════
     12. n8n AUTOMATION
  ═══════════════════════════════════════════════════ */
  {
    slug: 'n8n-automation',
    title: 'n8n Automation',
    description: 'Self-hosted n8n workflow automation on Noehost',
    iconName: 'Workflow',
    sections: [
      {
        title: 'Getting Started with n8n',
        articles: [
          { slug: 'what-is-n8n', title: 'What is n8n and Why Use It?', excerpt: 'An introduction to n8n — the open-source workflow automation tool you can host yourself.', readTime: 4, content: `<h2>What is n8n?</h2><p>n8n (pronounced "n-eight-n") is an open-source workflow automation platform. It lets you connect apps, automate repetitive tasks, and build complex workflows — all without writing code (though you can if you want).</p><h2>Why Self-Host?</h2><ul><li><strong>Privacy</strong> — your data never leaves your server</li><li><strong>Cost</strong> — no per-workflow pricing, unlimited automations</li><li><strong>Control</strong> — full access to the database and configuration</li><li><strong>Customization</strong> — install custom nodes and integrations</li></ul><h2>What Can n8n Do?</h2><ul><li>Sync data between apps (CRM, spreadsheets, databases)</li><li>Automate email and Slack notifications</li><li>Build chatbots and AI workflows</li><li>Process webhook events from any platform</li><li>Schedule recurring jobs and reports</li></ul>` },
          { slug: 'n8n-first-workflow', title: 'How to Create Your First n8n Workflow', excerpt: 'Build a simple automation workflow in n8n — triggers, nodes, and connections explained.', readTime: 6, content: `<h2>Creating Your First Workflow</h2><h3>Step 1 — Open n8n</h3><p>Access your n8n instance at the URL provided in your Noehost client area.</p><h3>Step 2 — Create New Workflow</h3><ol><li>Click the <strong>+</strong> button or <strong>New Workflow</strong></li><li>Name your workflow</li></ol><h3>Step 3 — Add a Trigger</h3><p>Click the <strong>+</strong> in the canvas and search for a trigger. Common triggers: Schedule, Webhook, Gmail, etc.</p><h3>Step 4 — Add an Action Node</h3><p>Click <strong>+</strong> after your trigger and add an action (e.g., send a Slack message, update a Google Sheet row).</p><h3>Step 5 — Connect and Test</h3><ol><li>Connect the trigger to your action node</li><li>Click <strong>Execute Workflow</strong> to test</li><li>Check the output of each node</li><li>Toggle the workflow <strong>Active</strong> when satisfied</li></ol>` },
          { slug: 'n8n-credentials', title: 'How to Set Up Credentials in n8n', excerpt: 'Add API keys and OAuth connections for services like Gmail, Slack, and Google Sheets.', readTime: 4, content: `<h2>Setting Up Credentials</h2><ol><li>Click the menu icon → <strong>Credentials</strong></li><li>Click <strong>Add Credential</strong></li><li>Search for the service (e.g., Gmail, Slack, OpenAI)</li><li>Follow the OAuth or API key setup steps</li><li>Give it a name and click <strong>Save</strong></li></ol><h2>Using Credentials in Workflows</h2><p>When adding a node that requires authentication, select the credential from the dropdown. All nodes of the same service can share one credential.</p><h2>Security</h2><p>Credentials are encrypted and stored in your n8n database. Never share your n8n database file.</p>` },
        ],
      },
      {
        title: 'Workflows & Automation',
        articles: [
          { slug: 'n8n-webhook', title: 'How to Use Webhooks in n8n', excerpt: 'Trigger n8n workflows from external apps using HTTP webhooks.', readTime: 5, content: `<h2>Using Webhooks in n8n</h2><h3>Create a Webhook Trigger</h3><ol><li>Create a new workflow</li><li>Add a <strong>Webhook</strong> node as the trigger</li><li>Set HTTP Method to POST (or GET)</li><li>Copy the webhook URL shown</li></ol><h3>Use the Webhook URL</h3><p>Paste this URL into any app that supports outgoing webhooks (GitHub, Stripe, Typeform, etc.).</p><h3>Test the Webhook</h3><ol><li>Click <strong>Listen for Test Event</strong> in the Webhook node</li><li>Trigger the webhook from the external app</li><li>See the data appear in n8n</li></ol><h2>Production vs Test URL</h2><p>The test URL only works when you are actively listening. The production URL (shown after activating the workflow) works 24/7.</p>` },
          { slug: 'n8n-schedule-trigger', title: 'How to Schedule Automatic Workflows', excerpt: 'Run n8n workflows on a schedule — hourly, daily, weekly, or with custom cron expressions.', readTime: 3, content: `<h2>Scheduling Workflows</h2><ol><li>Add a <strong>Schedule Trigger</strong> node</li><li>Choose an interval: Every X minutes/hours, Daily at specific time, Weekly on specific days, or custom Cron</li></ol><h2>Cron Expression Examples</h2><pre><code>0 9 * * 1-5    # 9am Monday-Friday
0 0 * * *      # Midnight every day
*/15 * * * *   # Every 15 minutes
0 8 * * 1      # Every Monday at 8am</code></pre>` },
          { slug: 'n8n-ai-workflow', title: 'How to Build an AI Workflow with ChatGPT in n8n', excerpt: 'Connect n8n to OpenAI to build intelligent workflows that process text with ChatGPT.', readTime: 7, content: `<h2>AI Workflow with ChatGPT</h2><h3>Prerequisites</h3><ul><li>OpenAI API key</li><li>n8n credential for OpenAI</li></ul><h3>Example: Auto-Summarize Emails</h3><ol><li>Trigger: <strong>Gmail Trigger</strong> — fires when new email arrives</li><li>Node: <strong>OpenAI</strong> — send email body to GPT-4 with prompt "Summarize this email in 2 sentences"</li><li>Node: <strong>Slack</strong> — post the summary to #inbox channel</li></ol><h3>Tips for AI Nodes</h3><ul><li>Use system messages to set context ("You are a customer service agent…")</li><li>Use the <strong>Set</strong> node to format data before sending to OpenAI</li><li>Use <strong>IF</strong> nodes to handle different AI response types</li></ul>` },
        ],
      },
    ],
  },
];

export function getCategoryBySlug(slug: string): KbCategory | undefined {
  return KB_CATEGORIES.find(c => c.slug === slug);
}

export function getArticleBySlug(categorySlug: string, articleSlug: string) {
  const cat = getCategoryBySlug(categorySlug);
  if (!cat) return undefined;
  for (const section of cat.sections) {
    const art = section.articles.find(a => a.slug === articleSlug);
    if (art) return { article: art, section, category: cat };
  }
  return undefined;
}

export function getTotalArticles(category: KbCategory): number {
  return category.sections.reduce((sum, s) => sum + s.articles.length, 0);
}
