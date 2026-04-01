<?php
/**
 * Hooks for WHMCS -> 20i Reseller Hosting API
 * @copyright 2017 20i Limited
 * @license BSD-3-Clause
 */

require_once __DIR__ . "/../../../20i/vendor/autoload.php";
\TwentyI\WHMCS\Base::init(__DIR__ . "/api.json");

use WHMCS\Database\Capsule;

/**
 * Hooks client editing.
 *
 * @param array $vars See TwentyI\WHMCS\Provisioning
 */
add_hook('ClientEdit', 1, function($vars) {
    try {
        $helper = \TwentyI\WHMCS\Provisioning::any();
        if($helper) {
            $helper->hookClientEdit($vars);
        }
    } catch(\Exception $e) {
        trigger_error($e->getMessage());
    }
});

/**
 * Hooks the product details chunk.
 *
 * @param array $vars {
 *     @var string|null $username
 *     @var array|null $serverdata
 *     ...
 * }
 */
add_hook("ClientAreaProductDetailsPreModuleTemplate", 1, function(array $vars) {
    if ($vars["type"] == "hostingaccount") {
        $packageId = getCustomFieldValue($vars['serviceid'], 'packageId');
        if ($packageId) {
            $helper = \TwentyI\WHMCS\Provisioning::any();
            $limits = $helper->getLimits($packageId, "package");
            $whmcsUrl = \WHMCS\Config\Setting::getValue('SystemURL');
            $vars["iconlinks"] = [];

            if ($limits->cdnStatistics) {
                $vars["iconlinks"][] = ['quicklink' => 'cdn', 'icon' => $whmcsUrl . '/modules/servers/provision20i/icons/statistics.svg', 'label' => 'CDN Statistics'];
            }
            if ($limits->fileManager) {
                $vars["iconlinks"][] = ['quicklink' => 'filemanager', 'icon' => $whmcsUrl . '/modules/servers/provision20i/icons/file-manager.svg', 'label' => 'File Manager'];
            }
            if ($limits->email) {
                $vars["iconlinks"][] = ['quicklink' => 'emailaccounts', 'icon' => $whmcsUrl . '/modules/servers/provision20i/icons/email-accounts.svg', 'label' => 'Email Accounts'];
            }
            if ($limits->mysqlDatabases) {
                $vars["iconlinks"][] = ['quicklink' => 'mysql', 'icon' => $whmcsUrl . '/modules/servers/provision20i/icons/mysql-databases.svg', 'label' => 'MySQL Databases'];
            }
            if ($limits->domains) {
                $vars["iconlinks"][] = ['quicklink' => 'domains', 'icon' => $whmcsUrl . '/modules/servers/provision20i/icons/domains.svg', 'label' => 'Domains'];
            }
            if ($limits->ssh) {
                $vars["iconlinks"][] = ['quicklink' => 'ssh', 'icon' => $whmcsUrl . '/modules/servers/provision20i/icons/ssh-access.svg', 'label' => 'SSH Access'];
            }
            if ($limits->accessErrorLogs) {
                $vars["iconlinks"][] = ['quicklink' => 'logs', 'icon' => $whmcsUrl . '/modules/servers/provision20i/icons/access-error-logs.svg', 'label' => 'Access/Error Logs'];
            }

            $vars["website"] = $vars["domain"];
        }
    }

    $vars["ssolink"] = "?action=productdetails&amp;id={$vars['serviceid']}&amp;dosinglesignon=1";

    // Wipe misleading stuff from the page.
    $vars["username"] = null;
    $vars["serverdata"] = null;
    return $vars;
});

/**
 * Retrieves the value of a custom field for a given service.
 *
 * TODO refactor elsewhere to use this
 *
 * @param int $serviceId The ID of the service.
 * @param string $fieldName The name of the custom field to retrieve.
 * @return string|null The custom field value, or null if not found or on error.
 */
function getCustomFieldValue($serviceId, $fieldName) {
    try {
        $field = Capsule::table('tblcustomfields')
            ->where('fieldname', $fieldName)
            ->first();

        if (!$field) {
            return null;
        }

        $value = Capsule::table('tblcustomfieldsvalues')
            ->where('fieldid', $field->id)
            ->where('relid', $serviceId)
            ->first();

        return $value ? $value->value : null;
    } catch (Exception $e) {
        error_log("Error fetching custom field: " . $e->getMessage());
        return null;
    }
}

/**
 * Hooks for the Mailbox Quota Addon product.
 */
include_once __DIR__ . '/hooks/mailbox-quota-addon/hooks.php';

/**
 * Hooks for the Premium Mailbox product.
 */
include_once __DIR__ . '/hooks/premium-mailbox/hooks.php';

/**
 * Hooks for the TLS Certificate product.
 */
include_once __DIR__ . '/hooks/tls-certificate/hooks.php';

/**
 * Hook to remove product for unauthenticated users' as the
 * product requires knowledge of existing packages.
 *
 * @param array $vars {
 *     @var string|null $username
 *     @var array|null $serverdata
 *     ...
 * }
 */
add_hook("ClientAreaPage", 1, function(array $vars) {
    if ($vars["templatefile"] == "products") {
        $showMailboxProducts = true;
        $mailboxProductGroupId = null;
        $removedMailboxProducts = false;

        if (!isset($_SESSION["uid"])) {
            $showMailboxProducts = false;
        } else {
            $hasPackageId = false;
            $clientId = $_SESSION["uid"];
            $res = localAPI("GetClientsProducts", ["clientid" => $clientId, "limitnum" => 250]);

            if (($res["result"] ?? "") === "success" && !empty($res["products"]["product"])) {
                foreach ($res["products"]["product"] as $p) {
                    if (!in_array($p["status"], ["Active","Suspended"])) continue;

                    if (!empty($p["customfields"]["customfield"])) {
                        foreach ($p["customfields"]["customfield"] as $cf) {
                            if (($cf["name"] ?? "") === "packageId") {
                                $hasPackageId = true;
                                break;
                            }
                        }
                    }
                }
            }

            $showMailboxProducts = $hasPackageId;
        }

        foreach ($vars["products"] as $key => $product) {
            if (
                $product["name"] === PREMIUM_MAILBOX_PRODUCT_NAME ||
                $product["name"] === MAILBOX_QUOTA_ADDON_PRODUCT_NAME
            ) {
                $mailboxProductGroupId = $vars["gid"] ?? null;

                if (!$showMailboxProducts) {
                    unset($vars["products"][$key]);
                    $removedMailboxProducts = true;
                }
            }
        }

        if ($removedMailboxProducts && $mailboxProductGroupId) {
            $categoryHasProducts = false;
            foreach ($vars["products"] as $product) {
                if (($vars["gid"] ?? null) == $mailboxProductGroupId) {
                    $categoryHasProducts = true;
                    break;
                }
            }

            // If category is empty, inject JavaScript to show message
            if (!$categoryHasProducts) {
                $message = "No Products Available";
                $script = "
                <script>
                document.addEventListener('DOMContentLoaded', function() {
                    var productSections = document.querySelectorAll('[data-product-group-id=\"{$mailboxProductGroupId}\"], .product-group-{$mailboxProductGroupId}, #product-group-{$mailboxProductGroupId}');

                    if (productSections.length === 0) {
                        var allSections = document.querySelectorAll('.products, .product-category, .row');
                        productSections = Array.from(allSections).filter(function(section) {
                            var products = section.querySelectorAll('.product, .product-item, [class*=\"product\"]');
                            return products.length === 0 && section.innerHTML.trim().length > 0;
                        });
                    }

                    productSections.forEach(function(section) {
                        var noticeDiv = document.createElement('div');
                        noticeDiv.className = 'alert alert-warning text-center';
                        noticeDiv.innerHTML = '{$message}';
                        section.appendChild(noticeDiv);
                    });
                });
                </script>";

                $vars["rawOutput"] = ($vars["rawOutput"] ?? "") . $script;
            }
        }

        return $vars;
    }
});

/**
 * Return output from above into footer
 */
add_hook("ClientAreaFooterOutput", 1, function(array $vars) {
    if ($vars["rawOutput"]) {
        return <<<HTML
{$vars["rawOutput"]}
HTML;
    }
});

/**
 * Package Usage Information tab
 */
add_hook('ClientAreaFooterOutput', 1, function($vars) {
    // Check if we're on the product details page
    if (
        ($vars['templatefile'] ?? '') === 'clientareaproductdetails' &&
        $vars["type"] == "hostingaccount"
    ) {
        $serviceId = $vars["serviceid"];
        $domain = $vars["website"];
        $script = <<<HTML
        <script>
        document.addEventListener("DOMContentLoaded", async function() {
            // Find the nav tabs container
            var navTabs = document.querySelector(".nav.nav-tabs.responsive-tabs-sm");

            if (navTabs) {
                // Create new tab li element
                var newTabLi = document.createElement("li");
                newTabLi.className = "nav-item";

                // Create the tab link
                var newTabLink = document.createElement("a");
                newTabLink.href = "#usageinformationtab";
                newTabLink.setAttribute("data-toggle", "tab");
                newTabLink.className = "nav-link";
                newTabLink.innerHTML = '<i class="fas fa-chart-bar fa-fw"></i> Usage Information';

                // Add click event listener to handle tab switching manually
                newTabLink.addEventListener("click", function(e) {
                    e.preventDefault();

                    // Remove active class from all nav links
                    var allNavLinks = navTabs.querySelectorAll(".nav-link");
                    allNavLinks.forEach(function(link) {
                        link.classList.remove("active");
                    });

                    // Add active class to clicked tab
                    newTabLink.classList.add("active");

                    // Hide all tab panes
                    var tabContent = document.querySelector(".tab-content.product-details-tab-container");
                    if (tabContent) {
                        var allTabPanes = tabContent.querySelectorAll(".tab-pane");
                        allTabPanes.forEach(function(pane) {
                            pane.classList.remove("active", "show");
                        });

                        // Show the custom tab pane
                        var customPane = document.getElementById("usageinformation");
                        if (customPane) {
                            customPane.classList.add("active", "show");
                        }
                    }
                });

                // Find the tab content container and add corresponding content
                var tabContent = document.querySelector(".tab-content.product-details-tab-container");
                if (tabContent) {
                    var newTabPane = document.createElement("div");
                    newTabPane.className = "tab-pane fade";
                    newTabPane.setAttribute("role", "tabpanel");
                    newTabPane.id = "usageinformation";
                    newTabPane.innerHTML = '<div class="text-center" id="loadingdiv"><div class="mb-2"><i class="fas fa-spinner fa-spin fa-2x"></i></div>Loading usage information...</div>';

                    tabContent.appendChild(newTabPane);
                }

                newTabLi.appendChild(newTabLink);
                navTabs.appendChild(newTabLi);

                try {
                    var serviceId = "{$serviceId}";
                    var domain = "{$domain}";
                    const res = await fetch('index.php?action=fetchusageinformation&id=' + serviceId + '&domain=' + domain);
                    if (!res.ok) {
                        throw new Error('HTTP error: Status: ' + res.status);
                    }
                    const data = await res.json();

                    // Function to format field names into readable labels
                    function formatLabel(key) {
                      const labelMap = {
                          'webSpace': 'Web Space',
                          'bandwidth': 'Bandwidth',
                          'mysqlDatabases': 'MySQL Databases',
                          'emailAccounts': 'Email Accounts',
                          'subdomains': 'Subdomains',
                          'ftpAccounts': 'FTP Accounts'
                      };
                      return labelMap[key] || key;
                    }

                    // Function to format usage values
                    function formatUsage(usage, limit) {
                      const formattedLimit = limit === 'INF' ? 'Unlimited' : limit;
                      return usage + ' / ' + formattedLimit;
                    }

                    // Build the grid HTML
                    let gridHtml = '<div class="container-fluid"><div class="row">';

                    Object.keys(data).forEach(function(key) {
                      const item = data[key];
                      const label = formatLabel(key);
                      const usage = formatUsage(item.usage, item.limit);

                      gridHtml += `
                          <div class="col-12 mb-3">
                              <div class="row">
                                  <div class="col-6">
                                      <strong>\${label}:</strong>
                                  </div>
                                  <div class="col-6">
                                      \${usage}
                                  </div>
                              </div>
                          </div>
                      `;
                    });

                    gridHtml += '</div></div>';

                    // Replace the loading div content
                    const loadingDiv = document.getElementById('loadingdiv');
                    if (loadingDiv) {
                      loadingDiv.innerHTML = gridHtml;
                    }

                } catch (e) {
                    console.error(e);
                    const loadingDiv = document.getElementById('loadingdiv');
                    if (loadingDiv) {
                        loadingDiv.innerHTML = '<div class="alert alert-danger">Error loading usage information</div>';
                    }
                }
            }
        });
        </script>
HTML;

        return $script;
    }

    // Return existing rawOutput if present
    if ($vars["rawOutput"]) {
        return $vars["rawOutput"];
    }
});

/**
 * Email Accounts Tab
 */
add_hook('ClientAreaFooterOutput', 1, function($vars) {
    // Check if we're on the product details page
    if (
        ($vars['templatefile'] ?? '') === 'clientareaproductdetails' &&
        $vars["type"] == "hostingaccount"
    ) {
        $serviceId = $vars["serviceid"];
        $domain = $vars["website"];

        $premiumMailboxProductId = null;
        $mailboxQuotaAddonProductId = null;

        try {
            // Query for Premium Mailbox product ID
            $premiumProduct = Capsule::table('tblproducts')
                ->where('name', PREMIUM_MAILBOX_PRODUCT_NAME)
                ->where('hidden', 0)
                ->first();
            if ($premiumProduct) {
                $premiumMailboxProductId = $premiumProduct->id;
            }

            // Query for Mailbox Quota Addon product ID
            $quotaAddonProduct = Capsule::table('tblproducts')
                ->where('name', MAILBOX_QUOTA_ADDON_PRODUCT_NAME)
                ->where('hidden', 0)
                ->first();
            if ($quotaAddonProduct) {
                $mailboxQuotaAddonProductId = $quotaAddonProduct->id;
            }
        } catch (Exception $e) {
            error_log("Error fetching product IDs: " . $e->getMessage());
        }

        $script = <<<HTML
        <script>
            document.addEventListener("DOMContentLoaded", function() {
                var emailIcon = document.getElementById("emailaccounts");
                var originalActiveTab = null;
                var originalActivePane = null;

                if (emailIcon) {
                    emailIcon.addEventListener("click", function(e) {
                        e.preventDefault();

                        var tabContent = document.querySelector(".tab-content.product-details-tab-container");
                        if (tabContent) {
                            var navTabs = document.querySelector(".nav.nav-tabs.responsive-tabs-sm");
                            if (navTabs) {
                                originalActiveTab = navTabs.querySelector(".nav-link.active");
                                var allNavLinks = navTabs.querySelectorAll(".nav-link");
                                allNavLinks.forEach(function(link) {
                                    link.classList.remove("active");
                                });
                            }

                            // Store reference to currently active pane
                            originalActivePane = tabContent.querySelector(".tab-pane.active");

                            // Hide all existing tab panes
                            var allTabPanes = tabContent.querySelectorAll(".tab-pane");
                            allTabPanes.forEach(function(pane) {
                                pane.classList.remove("active", "show");
                            });

                            // Check if email accounts tab pane already exists
                            var emailTabPane = document.getElementById("emailaccountsinformation");
                            if (!emailTabPane) {
                                // Create new tab pane for email accounts
                                emailTabPane = document.createElement("div");
                                emailTabPane.className = "tab-pane fade";
                                emailTabPane.setAttribute("role", "tabpanel");
                                emailTabPane.id = "emailaccountsinformation";
                                emailTabPane.innerHTML = `
                                    <div class="mb-3">
                                        <button type="button" class="btn btn-secondary btn-sm" id="backToOriginalTab">
                                            <i class="fas fa-arrow-left"></i> Back
                                        </button>
                                    </div>
                                    <div class="text-center" id="emailloadingdiv">
                                        <div class="mb-2"><i class="fas fa-spinner fa-spin fa-2x"></i></div>
                                        Loading email account information...
                                    </div>
                                `;
                                tabContent.appendChild(emailTabPane);

                                // Add back button event listener
                                var backButton = document.getElementById("backToOriginalTab");
                                if (backButton) {
                                    backButton.addEventListener("click", function() {
                                        // Hide email accounts tab pane
                                        emailTabPane.classList.remove("active", "show");

                                        // Restore original active tab and pane
                                        if (originalActiveTab) {
                                            originalActiveTab.classList.add("active");
                                        }
                                        if (originalActivePane) {
                                            originalActivePane.classList.add("active", "show");
                                        }
                                    });
                                }
                            }

                            // Show the email accounts tab pane
                            emailTabPane.classList.add("active", "show");

                            // Fetch email account data if not already loaded
                            if (!emailTabPane.hasAttribute("data-loaded")) {
                                fetchEmailAccountData();
                                emailTabPane.setAttribute("data-loaded", "true");
                            }
                        }
                    });

                    async function fetchEmailAccountData() {
                        try {
                            var serviceId = "{$serviceId}";
                            var domain = "{$domain}";
                            const res = await fetch('index.php?action=fetchemailaccounts&id=' + serviceId + '&domain=' + domain);
                            if (!res.ok) {
                                throw new Error('HTTP error: Status: ' + res.status);
                            }
                            const data = await res.json();

                            // Build the mailboxes HTML
                            let emailHtml = '<div class="container-fluid"><div class="row">';

                            if (data.accounts && Object.keys(data.accounts).length > 0) {
                                emailHtml += '<div class="col-12"><h4>Mailboxes</h4></div>';

                                Object.keys(data.accounts).forEach(function(domainKey) {
                                    const domainData = data.accounts[domainKey];

                                    if (domainData.mailbox && domainData.mailbox.length > 0) {
                                        domainData.mailbox.forEach(function(mailbox) {
                                            const email = mailbox.local + '@' + domainKey;
                                            const usagePercent = mailbox.quotaMB > 0 ? Math.round((mailbox.usageMB / mailbox.quotaMB) * 100) : 0;
                                            const quotaDisplay = (mailbox.quotaMB / 1024).toFixed(2) + ' GB';
                                            const usageDisplay = (mailbox.usageMB / 1024).toFixed(2) + ' GB';

                                            let progressBarColor = 'bg-success';
                                            if (usagePercent > 80) progressBarColor = 'bg-danger';
                                            else if (usagePercent > 60) progressBarColor = 'bg-warning';

                                            let upgradeButtons = '';
                                            if (mailbox.serviceLevel === 'standard') {
                                                const premiumProductId = '{$premiumMailboxProductId}';
                                                const quotaAddonProductId = '{$mailboxQuotaAddonProductId}';

                                                let premiumButton = '';
                                                let quotaButton = '';

                                                if (premiumProductId) {
                                                    premiumButton = `
                                                        <a href="cart.php?a=add&pid=\${premiumProductId}" class="btn btn-primary btn-sm">
                                                            <i class="fas fa-arrow-up"></i> Upgrade to Premium
                                                        </a>
                                                    `;
                                                }

                                                if (quotaAddonProductId) {
                                                    quotaButton = `
                                                        <a href="cart.php?a=add&pid=\${quotaAddonProductId}" class="btn btn-secondary btn-sm">
                                                            <i class="fas fa-plus"></i> Add Quota
                                                        </a>
                                                    `;
                                                }

                                                if (premiumButton || quotaButton) {
                                                    upgradeButtons = `
                                                        <div class="col-12 mt-3">
                                                            <div class="btn-group" role="group">
                                                                \${premiumButton}
                                                                \${quotaButton}
                                                            </div>
                                                        </div>
                                                    `;
                                                }
                                            }

                                            emailHtml += `
                                                <div class="col-12 mb-3">
                                                    <div class="card">
                                                        <div class="card-body">
                                                            <div class="row">
                                                                <div class="col-md-6">
                                                                    <strong>Mailbox:</strong> \${email}
                                                                </div>
                                                                <div class="col-md-6">
                                                                    <strong>Service Level:</strong>
                                                                    <span class="text-capitalize badge badge-\${mailbox.serviceLevel === 'premium' ? 'success' : 'secondary'}">\${mailbox.serviceLevel}</span>
                                                                </div>
                                                                <div class="col-12 mt-3">
                                                                    <strong>Quota Usage:</strong> \${usageDisplay} / \${quotaDisplay} (\${usagePercent}%)
                                                                    <div class="progress mt-2">
                                                                        <div class="progress-bar \${progressBarColor}" role="progressbar" style="width: \${usagePercent}%" aria-valuenow="\${usagePercent}" aria-valuemin="0" aria-valuemax="100">
                                                                            \${usagePercent}%
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                \${upgradeButtons}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            `;
                                        });
                                    }
                                });
                            } else {
                                emailHtml += '<div class="col-12"><div class="alert alert-info">No mailboxes found</div></div>';
                            }

                            emailHtml += '</div></div>';

                            // Replace the loading div content
                            const loadingDiv = document.getElementById('emailloadingdiv');
                            if (loadingDiv) {
                                loadingDiv.innerHTML = emailHtml;
                            }

                        } catch (e) {
                            console.error(e);
                            const loadingDiv = document.getElementById('emailloadingdiv');
                            if (loadingDiv) {
                                loadingDiv.innerHTML = '<div class="alert alert-danger">Error loading mailbox information</div>';
                            }
                        }
                    }
                }
            });
        </script>
HTML;
        return $script;
    }
});

/**
 * API call to fetch package usage information
 */
add_hook("ClientAreaPage", 1, function(array $vars) {
    if (
        $_GET["action"] === "fetchusageinformation" &&
        $_GET["domain"] &&
        $_GET["id"]
    ) {
        try {
            if (!isset($_SESSION["uid"])) {
                http_response_code(401);
                header("Content-Type: application/json");
                echo json_encode(["error" => "Authentication required"]);
                exit;
            }

            $serviceId = filter_var($_GET["id"], FILTER_VALIDATE_INT);
            $domain = filter_var($_GET["domain"], FILTER_SANITIZE_STRING);

            if (!$serviceId || !$domain) {
                http_response_code(400);
                header("Content-Type: application/json");
                echo json_encode(["error" => "Invalid parameters"]);
                exit;
            }

            $clientId = $_SESSION["uid"];
            $service = Capsule::table("tblhosting")
                ->where("id", $serviceId)
                ->where("userid", $clientId)
                ->where("domainstatus", "Active")
                ->first();

            if (!$service) {
                http_response_code(403);
                header("Content-Type: application/json");
                echo json_encode(["error" => "Service not found or access denied"]);
                exit;
            }

            if ($service->domain !== $domain) {
                http_response_code(400);
                header("Content-Type: application/json");
                echo json_encode(["error" => "Domain mismatch"]);
                exit;
            }

            $field = Capsule::table("tblcustomfields")
                ->where("fieldname", "packageId")
                ->first();

            if (!$field) {
                throw new Exception("Package ID field not found");
            }

            $p = Capsule::table('tblcustomfieldsvalues')
                ->where("fieldid", $field->id)
                ->where("relid", $serviceId)
                ->first();

            if (!$p) {
                throw new Exception("Package ID value not found");
            }

            $helper = \TwentyI\WHMCS\Provisioning::any();
            if($helper) {
                $usage = $helper->getPackageUsageInformation($p->value, $domain);
            } else {
                throw new Exception("Provisioning helper not available");
            }

            header("Content-Type: application/json");
            echo json_encode($usage);

        } catch(\Exception $e) {
            error_log("Usage information fetch error: " . $e->getMessage());
            http_response_code(500);
            header("Content-Type: application/json");
            echo json_encode(["error" => "Unable to fetch usage information"]);
        }
        exit;
    }
});

/**
 * API call to fetch mailboxes
 */
add_hook("ClientAreaPage", 1, function(array $vars) {
    if (
        $_GET["action"] === "fetchemailaccounts" &&
        $_GET["domain"] &&
        $_GET["id"]
    ) {
        try {
            if (!isset($_SESSION["uid"])) {
                http_response_code(401);
                header("Content-Type: application/json");
                echo json_encode(["error" => "Authentication required"]);
                exit;
            }

            $serviceId = filter_var($_GET["id"], FILTER_VALIDATE_INT);
            $domain = filter_var($_GET["domain"], FILTER_SANITIZE_STRING);

            if (!$serviceId || !$domain) {
                http_response_code(400);
                header("Content-Type: application/json");
                echo json_encode(["error" => "Invalid parameters"]);
                exit;
            }

            $clientId = $_SESSION["uid"];
            $service = Capsule::table("tblhosting")
                ->where("id", $serviceId)
                ->where("userid", $clientId)
                ->where("domainstatus", "Active")
                ->first();

            if (!$service) {
                http_response_code(403);
                header("Content-Type: application/json");
                echo json_encode(["error" => "Service not found or access denied"]);
                exit;
            }

            if ($service->domain !== $domain) {
                http_response_code(400);
                header("Content-Type: application/json");
                echo json_encode(["error" => "Domain mismatch"]);
                exit;
            }

            $helper = \TwentyI\WHMCS\Provisioning::any();
            if($helper) {
                $mailboxes = $helper->getMailboxesForPackage($domain);
            } else {
                throw new Exception("Provisioning helper not available");
            }

            header("Content-Type: application/json");
            echo json_encode(["accounts" => $mailboxes]);

        } catch(\Exception $e) {
            error_log("Email accounts fetch error: " . $e->getMessage());
            http_response_code(500);
            header("Content-Type: application/json");
            echo json_encode(["error" => "Unable to fetch email account information"]);
        }
        exit;
    }
});
