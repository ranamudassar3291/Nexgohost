<?php

use WHMCS\Database\Capsule;

const DOMAIN_FIELD_NAME = "Domain";
const TLS_CERTIFICATE_PRODUCT_NAMES = [
    "GeoTrust Simple SSL",
    "GeoTrust Rapid SSL Wildcard",
    "GeoTrust Extended SSL",
];

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

    if (!in_array($product->name, TLS_CERTIFICATE_PRODUCT_NAMES)) {
        return [];
    }

    // Fetch the custom field for THIS product
    $field = Capsule::table("tblcustomfields")
        ->where("relid", $product->id)
        ->where("fieldName", DOMAIN_FIELD_NAME)
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
                        "label"  => $p["domain"],
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
 * Main form - both unauthenticaed & authenticated
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

    if (!in_array($product->name, TLS_CERTIFICATE_PRODUCT_NAMES)) {
        return [];
    }

    if (
        $vars["templatefile"] !== "viewcart" &&
        $vars["filename"] !== "cart"
    ) {
        return "";
    }

    if (
        empty($vars["linkFieldId"]) ||
        empty($vars["targetPid"])
    ) {
        return "";
    }

    $field = (int)$vars["linkFieldId"];
    $productName = addslashes($product->name);

    return <<<HTML
<script>
(function(){
    var productName = "{$productName}";
    var isWildcard = productName === "GeoTrust Rapid SSL Wildcard";

    // Find the custom field input
    var cf = document.querySelector('[name="customfield[{$field}]"]');
    if (!cf) return;
    cf.setAttribute("required", "required");

    // Create the wrapper div
    var wrapper = document.createElement("div");
    wrapper.className = "form-group mt-3";
    wrapper.id = "custom-wrapper";

    // Only create subdomain input for non-wildcard certificates
    if (!isWildcard) {
        // Create text input for subdomain
        var label = document.createElement("label");
        label.setAttribute("for", "subdomain");
        label.textContent = "(Optional) enter a subdomain…";
        wrapper.appendChild(label);

        // Create text input for subdomain
        var input = document.createElement("input");
        input.type = "text";
        input.className = "form-control";
        input.id = "subdomain";
        input.name = "subdomain";
        wrapper.appendChild(input);
    }

    // Create email notification element
    var emailNotification = document.createElement("div");
    emailNotification.className = "alert alert-info";
    emailNotification.style.marginTop = "10px";
    emailNotification.style.display = "none";
    emailNotification.id = "email-notification";
    wrapper.appendChild(emailNotification);

    // Insert wrapper into DOM
    cf.parentNode.appendChild(wrapper, cf);

    // Domain validation function
    function isValidDomain(domain) {
        if (!domain || typeof domain !== 'string') return false;
        domain = domain.trim();
        if (!domain.includes('.')) return false;
        // Basic domain validation
        var domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}|xn--[a-zA-Z0-9]+)$/;
        return domainRegex.test(domain);
    }

    // Update email notification
    function updateEmailNotification(domain) {
        if (isValidDomain(domain)) {
            emailNotification.innerHTML = 'Please ensure <strong>admin@' + domain + '</strong> can receive email in order to approve the certificate.';
            emailNotification.style.display = 'block';
        } else {
            emailNotification.style.display = 'none';
        }
    }

    // Monitor direct input to custom field
    cf.addEventListener("input", function(e) {
        updateEmailNotification(e.target.value);
    });

    // Give the other hook chance to create the element
    setTimeout(() => {
        var select = document.getElementById("hosting-service");
        if (select) {
            select.addEventListener("change", function(e) {
                updateEmailNotification(e.target.value);
            });
        }
    }, 100);

    // Create contact form wrapper
    var contactWrapper = document.createElement("div");
    contactWrapper.className = "panel panel-default mt-4";

    // Contact form HTML
    contactWrapper.innerHTML =
        '<div class="panel-heading"><h4>Contact Information</h4></div>' +
        '<div class="panel-body">' +
            '<div class="form-group">' +
                '<label class="control-label">Contact Type</label>' +
                '<div style="margin-top: 5px;">' +
                    '<label class="radio-inline" style="margin-right: 20px;"><input type="radio" name="contact_type" value="individual" checked> Individual</label>' +
                    '<label class="radio-inline"><input type="radio" name="contact_type" value="business"> Business</label>' +
                '</div>' +
            '</div>' +
            '<div class="row">' +
                '<div class="col-md-6">' +
                    '<div class="form-group">' +
                        '<label class="control-label">First Name *</label>' +
                        '<input type="text" name="contact_first_name" class="form-control" required>' +
                    '</div>' +
                '</div>' +
                '<div class="col-md-6">' +
                    '<div class="form-group">' +
                        '<label class="control-label">Last Name *</label>' +
                        '<input type="text" name="contact_last_name" class="form-control" required>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div id="company-fields" style="display: none;">' +
                '<div class="form-group">' +
                    '<label class="control-label">Company Name *</label>' +
                    '<input type="text" name="contact_company" class="form-control">' +
                '</div>' +
            '</div>' +
            '<div class="row">' +
                '<div class="col-md-6">' +
                    '<div class="form-group">' +
                        '<label class="control-label">Email Address *</label>' +
                        '<input type="email" name="contact_email" class="form-control" required>' +
                    '</div>' +
                '</div>' +
                '<div class="col-md-6">' +
                    '<div class="form-group">' +
                        '<label class="control-label">Phone Number *</label>' +
                        '<input type="tel" name="contact_phone" class="form-control" required>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="form-group">' +
                '<label class="control-label">Address Line 1 *</label>' +
                '<input type="text" name="contact_address1" class="form-control" required>' +
            '</div>' +
            '<div class="form-group">' +
                '<label class="control-label">Address Line 2</label>' +
                '<input type="text" name="contact_address2" class="form-control">' +
            '</div>' +
            '<div class="row">' +
                '<div class="col-md-4">' +
                    '<div class="form-group">' +
                        '<label class="control-label">City *</label>' +
                        '<input type="text" name="contact_city" class="form-control" required>' +
                    '</div>' +
                '</div>' +
                '<div class="col-md-4">' +
                    '<div class="form-group">' +
                        '<label class="control-label">State/Province *</label>' +
                        '<input type="text" name="contact_state" class="form-control" required>' +
                    '</div>' +
                '</div>' +
                '<div class="col-md-4">' +
                    '<div class="form-group">' +
                        '<label class="control-label">Postal Code *</label>' +
                        '<input type="text" name="contact_postal" class="form-control" required>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="form-group">' +
                '<label class="control-label">Country *</label>' +
                '<select name="contact_country" class="form-control" required>' +
                    '<option value="">Select Country</option>' +
                    '<option value="US">United States</option>' +
                    '<option value="CA">Canada</option>' +
                    '<option value="GB">United Kingdom</option>' +
                    '<option value="AU">Australia</option>' +
                    '<option value="DE">Germany</option>' +
                    '<option value="FR">France</option>' +
                    '<option value="IT">Italy</option>' +
                    '<option value="ES">Spain</option>' +
                    '<option value="NL">Netherlands</option>' +
                    '<option value="BE">Belgium</option>' +
                    '<option value="CH">Switzerland</option>' +
                    '<option value="AT">Austria</option>' +
                    '<option value="SE">Sweden</option>' +
                    '<option value="NO">Norway</option>' +
                    '<option value="DK">Denmark</option>' +
                    '<option value="FI">Finland</option>' +
                    '<option value="IE">Ireland</option>' +
                    '<option value="PT">Portugal</option>' +
                    '<option value="GR">Greece</option>' +
                    '<option value="PL">Poland</option>' +
                    '<option value="CZ">Czech Republic</option>' +
                    '<option value="HU">Hungary</option>' +
                    '<option value="SK">Slovakia</option>' +
                    '<option value="SI">Slovenia</option>' +
                    '<option value="HR">Croatia</option>' +
                    '<option value="BG">Bulgaria</option>' +
                    '<option value="RO">Romania</option>' +
                    '<option value="EE">Estonia</option>' +
                    '<option value="LV">Latvia</option>' +
                    '<option value="LT">Lithuania</option>' +
                    '<option value="LU">Luxembourg</option>' +
                    '<option value="MT">Malta</option>' +
                    '<option value="CY">Cyprus</option>' +
                '</select>' +
            '</div>' +
        '</div>';

    // Insert contact form after domain wrapper
    cf.parentNode.appendChild(contactWrapper, wrapper.nextSibling);

    var contactRadios = contactWrapper.querySelectorAll('input[name="contact_type"]');
    var companyFields = contactWrapper.querySelector("#company-fields");
    var companyInput = contactWrapper.querySelector('input[name="contact_company"]');

    if (!contactRadios.length || !companyFields || !companyInput) {
        console.error("Could not find required contact form elements");
        return;
    }

    function handleContactTypeChange(value) {
        if (value === "business") {
            companyFields.style.display = "block";
            companyInput.setAttribute("required", "required");
        } else {
            companyFields.style.display = "none";
            companyInput.removeAttribute("required");
            companyFields.querySelectorAll("input").forEach(function(input) {
                input.value = "";
            });
        }
    }

    contactRadios.forEach(function(radio) {
        // Try iCheck events first (if jQuery and iCheck are available)
        if (typeof jQuery !== 'undefined' && jQuery.fn.iCheck) {
            jQuery(radio).on('ifChanged', function(event) {
                handleContactTypeChange(event.target.value);
            });
        } else {
            // Fallback to regular events
            radio.addEventListener("change", function(e) {
                handleContactTypeChange(e.target.value);
            });
        }
    });
})();
</script>
HTML;
});

/**
 * Select for authenticated
 */
add_hook("ClientAreaFooterOutput", 10, function(array $vars) {
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

    if (!in_array($product->name, TLS_CERTIFICATE_PRODUCT_NAMES)) {
        return [];
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

    // Find the custom field input
    var cf = document.querySelector('[name="customfield[{$field}]"]');
    if (!cf) return;

    // Find the wrapper div
    var wrapper = document.getElementById("custom-wrapper");
    if (!wrapper) return;

    var label = document.createElement("label");
    label.className = "mt-3";
    label.setAttribute("for", "hosting-service");
    label.textContent = "Or choose a domain from the options below...";
    wrapper.appendChild(label);

    // Create select dropdown
    var select = document.createElement("select");
    select.className = "form-control";
    select.id = "hosting-service";
    select.innerHTML = '<option value="">Select an existing domain…</option>' +
        services.map(s => '<option value="'+s.domain+'">'+s.label+'</option>').join('');
    wrapper.appendChild(select);

    // Sync select value into custom field
    select.addEventListener("change", function(e) {
        cf.value = e.target.value;
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

    if (!in_array($product->name, TLS_CERTIFICATE_PRODUCT_NAMES)) {
        return [];
    }

    $field = Capsule::table("tblcustomfields")
        ->where("relid", $product->id)
        ->where("fieldName", DOMAIN_FIELD_NAME)
        ->first();

    if (!$field) {
        return $errors;
    }

    $linkFieldId = (int)$field->id;

    $cfSource = $vars["customfield"] ?? $vars["customfields"] ?? [];
    $selected = trim($cfSource[$linkFieldId] ?? "");

    if (
        !$selected ||
        !filter_var($selected, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) ||
        !str_contains($selected, ".")
    ) {
        $errors[] = "Please enter a valid domain.";
    }

    // Validate contact information
    $subdomain = trim($_POST["subdomain"] ?? "");
    $contactType = trim($_POST["contact_type"] ?? "");
    $firstName = trim($_POST["contact_first_name"] ?? "");
    $lastName = trim($_POST["contact_last_name"] ?? "");
    $company = trim($_POST["contact_company"] ?? "");
    $email = trim($_POST["contact_email"] ?? "");
    $phone = trim($_POST["contact_phone"] ?? "");
    $address1 = trim($_POST["contact_address1"] ?? "");
    $address2 = trim($_POST["contact_address2"] ?? "");
    $city = trim($_POST["contact_city"] ?? "");
    $state = trim($_POST["contact_state"] ?? "");
    $postal = trim($_POST["contact_postal"] ?? "");
    $country = trim($_POST["contact_country"] ?? "");

    // Required field validation
    if (!$firstName) {
        $errors[] = "First name is required.";
    }
    if (!$lastName) {
        $errors[] = "Last name is required.";
    }
    if ($contactType === "business" && !$company) {
        $errors[] = "Company name is required for business contacts.";
    }
    if ($contactType === "individual" && $product->name === "GeoTrust Extended SSL") {
        $errors[] = "Extended SSL requires a business contact.";
    }
    if (!$email) {
        $errors[] = "Email address is required.";
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = "Please enter a valid email address.";
    }
    if (!$phone) {
        $errors[] = "Phone number is required.";
    }
    if (!$address1) {
        $errors[] = "Address is required.";
    }
    if (!$city) {
        $errors[] = "City is required.";
    }
    if (!$state) {
        $errors[] = "State/Province is required.";
    }
    if (!$postal) {
        $errors[] = "Postal code is required.";
    }
    if (!$country) {
        $errors[] = "Country is required.";
    }
    if ($subdomain && $product->name === "GeoTrust Rapid SSL Wildcard") {
        $errors[] = "Subdomain is not available for this certificate type.";
    }

    if (empty($errors)) {
        // Map form field names to their values
        $fieldValues = [
            "subdomain" => $subdomain,
            "contact_type" => $contactType,
            "contact_first_name" => $firstName,
            "contact_last_name" => $lastName,
            "contact_company" => $company,
            "contact_email" => $email,
            "contact_phone" => "+" . $vars["country-calling-code-contact_phone"] . "." . preg_replace('/\D/', '', $phone),
            "contact_address1" => $address1,
            "contact_address2" => $address2,
            "contact_city" => $city,
            "contact_state" => $state,
            "contact_postal" => $postal,
            "contact_country" => $country,
        ];

        // Store in session with a unique key based on product
        $_SESSION["tls_cert_pending_data"] = $fieldValues;

        // Also try the original cart method as backup
        $i = (int)($vars["i"] ?? -1);
        if (isset($_SESSION["cart"]["products"][$i])) {
            $customFields = Capsule::table("tblcustomfields")
                ->where("relid", $currentPid)
                ->get()
                ->keyBy("fieldname");

            foreach ($fieldValues as $fieldName => $value) {
                if (isset($customFields[$fieldName]) && !empty($value)) {
                    $_SESSION["cart"]["products"][$i]["customfields"][$customFields[$fieldName]->id] = $value;
                }
            }
        }
    }

    return $errors;
});

add_hook("AfterShoppingCartCheckout", 1, function($vars) {
    $orderId = $vars["OrderID"] ?? 0;
    if (!$orderId || !isset($_SESSION["tls_cert_pending_data"])) {
        return;
    }

    // Get services created from this order
    $services = Capsule::table("tblhosting")
        ->where("orderid", $orderId)
        ->get();

    foreach ($services as $service) {
        // Check if this service is for a TLS certificate product
        $product = Capsule::table("tblproducts")
            ->where("id", $service->packageid)
            ->first();

        if (!$product || !in_array($product->name, TLS_CERTIFICATE_PRODUCT_NAMES)) {
            continue;
        }

        // Get all custom fields for this product
        $customFields = Capsule::table("tblcustomfields")
            ->where("relid", $service->packageid)
            ->get()
            ->keyBy("fieldname");

        // Save the custom field values directly to database
        foreach ($_SESSION["tls_cert_pending_data"] as $fieldName => $value) {
            if (isset($customFields[$fieldName]) && !empty($value)) {
                $fieldId = $customFields[$fieldName]->id;

                // Insert or update the custom field value
                Capsule::table("tblcustomfieldsvalues")
                    ->updateOrInsert(
                        ["fieldid" => $fieldId, "relid" => $service->id],
                        [
                            "value" => $value,
                            "created_at" => date("Y-m-d H:i:s"),
                            "updated_at" => date("Y-m-d H:i:s")
                        ]
                    );
            }
        }
    }

    // Clean up session data
    unset($_SESSION["tls_cert_pending_data"]);
});
