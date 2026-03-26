const KB_ARTICLE_TAGS: Record<string, string[]> = {
  "fixing-404-not-found-errors-noehost": [
    "404", "not found", "page missing", "broken link", "htaccess", "permalinks",
    "error", "website error", "url", "missing page",
  ],
  "fixing-500-internal-server-error-noehost": [
    "500", "internal server error", "server error", "crash", "fatal error",
    "php crash", "site down", "500 error",
  ],
  "fixing-white-screen-of-death-wordpress": [
    "white screen", "blank screen", "wsod", "wordpress error", "nothing showing",
    "empty page", "white page", "blank page",
  ],
  "dns-propagation-explained-noehost": [
    "dns", "propagation", "nameserver", "ns1", "ns2", "domain not working",
    "domain pointing", "dns not working", "domain propagate", "dns record",
  ],
  "fixing-database-connection-error-wordpress": [
    "database", "mysql", "connection error", "db error", "wordpress database",
    "database connection", "error establishing", "db connection",
  ],
  "fixing-caching-issues-website-not-updating-noehost": [
    "cache", "caching", "not updating", "old content", "static", "cached",
    "website outdated", "changes not showing", "browser cache",
  ],
  "speed-up-wordpress-site-noehost": [
    "slow", "speed", "performance", "optimization", "load time", "fast",
    "page speed", "slow website", "slow loading", "latency",
  ],
  "how-to-log-in-to-cpanel-noehost": [
    "cpanel", "control panel", "login", "access", "dashboard",
    "cpanel login", "panel access", "hosting panel",
  ],
  "how-to-create-business-email-noehost": [
    "email", "mail", "inbox", "webmail", "business email", "setup",
    "email account", "create email", "professional email", "email address",
  ],
  "uploading-website-file-manager-vs-ftp": [
    "ftp", "file manager", "upload", "public_html", "files", "website files",
    "sftp", "file upload", "transfer files", "website upload",
  ],
  "one-click-wordpress-installation-noehost": [
    "wordpress", "install", "softaculous", "cms", "setup", "wordpress install",
    "install wordpress", "auto installer", "one click install",
  ],
  "how-to-install-wordpress-theme-plugin": [
    "plugin", "theme", "wordpress", "install plugin", "activate theme",
    "wordpress plugin", "wp plugin", "theme install",
  ],
  "setting-up-spf-dkim-dmarc-noehost": [
    "spf", "dkim", "dmarc", "deliverability", "spam", "email record",
    "email authentication", "spam filter", "email not delivered",
  ],
  "understanding-invoices-auto-renew-noehost": [
    "invoice", "billing", "payment", "renew", "auto-renew", "bill",
    "subscription", "pay invoice", "renewal", "hosting renewal",
  ],
  "how-to-register-new-domain-noehost": [
    "domain", "register", "new domain", "buy domain", "domain name",
    "purchase domain", "get domain", "domain registration",
  ],
  "how-to-transfer-domain-to-noehost": [
    "transfer", "domain transfer", "epp", "auth code", "move domain",
    "migrate domain", "domain migration",
  ],
  "how-to-change-account-password-noehost": [
    "password", "reset", "forgot", "change password", "login", "locked out",
    "reset password", "forgot password", "account access",
  ],
  "changing-php-versions-noehost": [
    "php", "php version", "php 8", "php error", "compatibility",
    "php 7", "php update", "change php", "php fatal",
  ],
  "how-to-point-domain-to-noehost": [
    "point domain", "domain point", "nameserver change", "dns change",
    "domain setup", "connect domain", "domain hosting",
  ],
  "installing-ssl-certificate-noehost": [
    "ssl", "https", "certificate", "secure", "padlock", "tls",
    "ssl certificate", "ssl install", "ssl error", "mixed content",
  ],
};

const STOP_WORDS = new Set([
  "a","an","the","is","it","in","on","at","to","for","of","and","or","but",
  "not","my","me","i","we","our","your","their","this","that","with","from",
  "by","as","are","was","be","been","being","have","has","had","do","does",
  "did","will","would","could","should","may","might","can","cannot","please",
  "help","need","want","how","what","when","where","why","who","which","get",
  "just","so","if","then","also","too","very","really","got","getting",
  "keep","still","again","now","about","am","im","ive","dont","cant","wont",
]);

export function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 2);
  return [...new Set(words.filter(w => !STOP_WORDS.has(w)))];
}

export function getTagsForSlug(slug: string): string {
  const tags = KB_ARTICLE_TAGS[slug] ?? [];
  return tags.join(" ");
}
