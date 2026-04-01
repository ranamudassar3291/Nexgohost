<?php

use WHMCS\Database\Capsule;

const MAILBOX_FIELD_NAME = "Mailbox";
const MAILBOX_QUOTA_ADDON_PRODUCT_NAME = "Mailbox Quota Addon (10GB)";

/**
 * Hook for the API call from client area to fetch mailboxes.
 *
 * @param array $vars {
 *     @var string|null $username
 *     @var array|null $serverdata
 *     ...
 * }
 */
add_hook("ClientAreaPage", 1, function(array $vars) {
    if (
        $_GET["action"] === "fetchmailboxes" &&
        $_GET["p"] === "mqa"
    ) {
        $server = Capsule::table("tblservers")
            ->where("type", "=", "provision20i")
            ->first();
        $product = Capsule::table("tblproducts")
            ->where("name", "=", MAILBOX_QUOTA_ADDON_PRODUCT_NAME)
            ->first();

        if (
            !$server ||
            !$product
        ) {
            return $vars;
        }

        $server->password = decrypt($server->password);
        $helper = new \TwentyI\WHMCS\Provisioning($server, $product);
        $mailboxes = $helper->servicesAPI->getWithFields(
            "/package/{$_GET['domain']}/emailAllMailbox"
        );

        header("Content-Type: application/json");
        echo json_encode($mailboxes);
        exit;
    }
});

/**
 * Hook to fetch hosting packages for the client area for mailbox addons.
 *
 * @param array $vars {
 *     @var string|null $username
 *     @var array|null $serverdata
 *     ...
 * }
 */
add_hook("ClientAreaPageCart", 1, function(array $vars) {
    // Only show on the configure product step
    if (($vars["action"] ?? "") !== "confproduct") {
        return [];
    }

    $cart = $_SESSION["cart"] ?? [];
    $i = (int)($_GET["i"] ?? -1);
    if (!isset($cart["products"][$i]["pid"])) {
        return [];
    }
    $currentPid = (int)$cart["products"][$i]["pid"];

    $product = Capsule::table("tblproducts")->where("id", $currentPid)->first();
    if (!$product) {
        return [];
    }

    if ($product->name !== MAILBOX_QUOTA_ADDON_PRODUCT_NAME) {
        return [];
    }

    // Fetch the custom field for THIS product
    $field = Capsule::table("tblcustomfields")
        ->where("relid", $product->id)
        ->where("fieldName", MAILBOX_FIELD_NAME)
        ->first();

    if (!$field) {
        return [];
    }

    $targetPid = $product->id;
    $linkFieldId = $field->id;

    $hostingServices = [];
    $clientId = $_SESSION["uid"] ?? 0;
    if ($clientId) {
        $res = localAPI("GetClientsProducts", ["clientid" => $clientId, "limitnum" => 250]);
        if (($res["result"] ?? "") === "success" && !empty($res["products"]["product"])) {
            foreach ($res["products"]["product"] as $p) {
                if (!in_array($p["status"], ["Active","Suspended"])) continue;

                $hasPackageId = false;
                if (!empty($p["customfields"]["customfield"])) {
                    foreach ($p["customfields"]["customfield"] as $cf) {
                        if (($cf["name"] ?? "") === "packageId") {
                            $hasPackageId = true;
                            break;
                        }
                    }
                }

                if ($hasPackageId) {
                    $hostingServices[] = [
                        "id" => (int)$p["id"],
                        "label"  => $p["name"] . ($p["domain"] ? " — " . $p["domain"] : ""),
                        "domain"  => $p["domain"],
                    ];
                }
            }
        }
    }

    return [
        "hostingServicesJSON" => json_encode($hostingServices),
        "linkFieldId"         => $linkFieldId,
        "targetPid"           => $targetPid,
    ];
});

/**
 * Return the JavaScript for selecting hosting package and attached
 * mailboxes in the client area.
 *
 * @param array $vars {
 *     @var string|null $username
 *     @var array|null $serverdata
 *     ...
 * }
 */
add_hook("ClientAreaFooterOutput", 1, function(array $vars) {
    $cart = $_SESSION["cart"] ?? [];
    $i = (int)($_GET["i"] ?? -1);
    if (!isset($cart["products"][$i]["pid"])) {
        return "";
    }
    $currentPid = (int)$cart["products"][$i]["pid"];

    $product = Capsule::table("tblproducts")->where("id", $currentPid)->first();
    if (!$product) {
        return "";
    }

    if ($product->name !== MAILBOX_QUOTA_ADDON_PRODUCT_NAME) {
        return "";
    }

    if (
        $vars["templatefile"] !== "viewcart" &&
        $vars["filename"] !== "cart"
    ) {
        return "";
    }

    if (
        empty($vars["hostingServicesJSON"]) ||
        empty($vars["linkFieldId"]) ||
        empty($vars["targetPid"])
    ) {
        return "";
    }

    $json  = $vars["hostingServicesJSON"];
    $field = (int)$vars["linkFieldId"];

    return <<<HTML
<script>
(function(){
    var services = {$json};
    if (!services.length) return;

    // Find the hidden custom field input
    var hidden = document.querySelector('[name="customfield[{$field}]"]');
    if (!hidden) return;
    hidden.hidden = true;

    // Create wrapper
    var wrapper = document.createElement("div");
    wrapper.className = "form-group";

    var label = document.createElement("label");
    label.textContent = "Select the hosting account for the mailbox";
    wrapper.appendChild(label);

    var select = document.createElement("select");
    select.className = "form-control mb-3";
    select.id = "hosting-service";
    select.innerHTML = '<option value="">Select a service…</option>' +
        services.map(s => '<option value="'+s.domain+'">'+s.label+'</option>').join('');
    wrapper.appendChild(select);

    // Insert just before hidden field
    hidden.parentNode.insertBefore(wrapper, hidden);

    // Sync selection into hidden field
    select.addEventListener("change", function(e) {
        // Remove existing elements in case choosing again
        var mbs = document.getElementById("mailboxes");
        var mbsLabel = document.getElementById("mailboxlabel");
        var noticeEl = document.getElementById("notice");
        if (mbs) {
            mbs.remove();
            hidden.value = '';
        }
        if (mbsLabel) {
            mbsLabel.remove();
        }

        if (noticeEl) {
            noticeEl.remove();
        }

        var notice = document.createElement("p");
        notice.id = "notice";
        notice.innerHTML = "Loading...";
        wrapper.appendChild(notice);

        // Fetch mailboxes
        fetch(`index.php?action=fetchmailboxes&domain=\${e.target.value}&p=mqa`)
            .then(r => r.json())
            .then(data => {
                notice.remove();
                if (
                    data[this.value] &&
                    data[this.value].mailbox &&
                    Array.isArray(data[this.value].mailbox) &&
                    data[this.value].mailbox.length
                ) {

                    out = [];

                    // Create select for mailboxes
                    data[this.value].mailbox.forEach(mb => {
                        if (mb.local && mb.local.length) {
                            out.push(`\${mb.local}@\${e.target.value}`);
                        }
                    });

                    if (out.length) {
                        var mailboxes = document.createElement("select");
                        mailboxes.className = "form-control";
                        mailboxes.id = "mailboxes";
                        out.forEach(mailbox => {
                            var optionElement = document.createElement("option");
                            optionElement.value = mailbox;
                            optionElement.text = mailbox;
                            mailboxes.appendChild(optionElement);
                        });
                        var mbLabel = document.createElement("label");
                        mbLabel.textContent = "Select which mailbox you would like to apply the upgrade to";
                        mbLabel.id = "mailboxlabel";
                        wrapper.appendChild(mbLabel);
                        wrapper.appendChild(mailboxes);
                        hidden.value = out[0];
                        mailboxes.addEventListener("change", function(e){
                            hidden.value = e.target.value;
                        });
                    }
                } else {
                    notice.innerHTML = "No mailboxes found for this package. Please choose another.";
                    wrapper.appendChild(notice);
                }
            });
    });
})();
</script>
HTML;
});

/**
 * Validation for mailbox addon
 *
 * @param array $vars {
 *     @var string|null $username
 *     @var array|null $serverdata
 *     ...
 * }
 */
add_hook("ShoppingCartValidateProductUpdate", 1, function($vars) {
    $errors = [];

    $currentPid = (int)($vars["pid"] ?? 0);
    if (!$currentPid) {
        $i = (int)($vars["i"] ?? -1);
        $cart = $_SESSION["cart"] ?? [];
        if (isset($cart["products"][$i]["pid"])) {
            $currentPid = (int)$cart["products"][$i]["pid"];
        }
    }
    if (!$currentPid) {
        return $errors;
    }

    $product = Capsule::table("tblproducts")->where("id", $currentPid)->first();
    if (!$product) {
        return $errors;
    }

    if ($product->name !== MAILBOX_QUOTA_ADDON_PRODUCT_NAME) {
        return $errors;
    }

    $field = Capsule::table("tblcustomfields")
        ->where("relid", $product->id)
        ->where("fieldName", MAILBOX_FIELD_NAME)
        ->first();

    if (!$field) {
        return $errors;
    }

    $linkFieldId = (int)$field->id;

    $cfSource = $vars["customfield"] ?? $vars["customfields"] ?? [];
    $selected = trim($cfSource[$linkFieldId] ?? "");

    if (
        !$selected ||
        !filter_var($selected, FILTER_VALIDATE_EMAIL)
    ) {
        $errors[] = "Please enter a valid mailbox email address.";
    }

    return $errors;
});
