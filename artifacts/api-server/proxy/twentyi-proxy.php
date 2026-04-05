<?php
/**
 * NoePanel — 20i API Reverse Proxy
 *
 * Deploy this file to your noehost.com server:
 *   public_html/20i-proxy/index.php
 *   public_html/20i-proxy/.htaccess  (see .htaccess file in same folder)
 *
 * Then in NoePanel, set the environment variable:
 *   TWENTYI_BASE_URL = https://noehost.com/20i-proxy
 *
 * How it works:
 *   NoePanel (Replit) sends API requests to https://noehost.com/20i-proxy/package
 *   This script forwards them to https://api.20i.com/package
 *   Since noehost.com is already whitelisted in 20i, all requests pass.
 *   Replit's dynamic outbound IP is never exposed to 20i.
 */

// Only allow requests from your NoePanel instance (optional but recommended)
// Uncomment and set your Replit domain to restrict access:
// $allowed_origins = ['https://your-app.replit.app'];
// $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
// if (!in_array($origin, $allowed_origins)) { http_response_code(403); exit; }

// Derive target path: strip /20i-proxy prefix from the request URI
$request_uri = $_SERVER['REQUEST_URI'] ?? '/';
// Remove query string for path purposes, keep it for forwarding
$uri_parts = explode('?', $request_uri, 2);
$path = $uri_parts[0];
$query = isset($uri_parts[1]) ? '?' . $uri_parts[1] : '';

// Strip the directory prefix so /20i-proxy/package -> /package
$script_dir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
if ($script_dir !== '' && strpos($path, $script_dir) === 0) {
    $path = substr($path, strlen($script_dir));
}
if (empty($path) || $path === '') {
    $path = '/';
}

$target = 'https://api.20i.com' . $path . $query;

// Forward only the relevant headers
$forward_headers = [];
foreach (getallheaders() as $name => $value) {
    $lower = strtolower($name);
    if ($lower === 'authorization') {
        $forward_headers[] = "Authorization: $value";
    } elseif ($lower === 'content-type') {
        $forward_headers[] = "Content-Type: $value";
    } elseif ($lower === 'accept') {
        $forward_headers[] = "Accept: $value";
    }
}
if (!array_filter($forward_headers, fn($h) => stripos($h, 'Content-Type') === 0)) {
    $forward_headers[] = 'Content-Type: application/json';
}

$method = $_SERVER['REQUEST_METHOD'];
$body = file_get_contents('php://input');

$ch = curl_init($target);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER         => false,
    CURLOPT_CUSTOMREQUEST  => $method,
    CURLOPT_HTTPHEADER     => $forward_headers,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);
if (!empty($body)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response      = curl_exec($ch);
$http_code     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$content_type  = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$curl_error    = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Proxy connection failed', 'detail' => $curl_error]);
    exit;
}

http_response_code($http_code);
header('Content-Type: ' . ($content_type ?: 'application/json'));
// Allow NoePanel (Replit) to call this proxy cross-origin
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

echo $response;
