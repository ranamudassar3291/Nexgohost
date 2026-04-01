<?php

/**
 * 20i Reseller Provisioning Module
 *
 * @see http://my.20i.com/services/reseller/apiDoc
 *
 * @copyright 2017 20i Limited
 * @license BSD-3-Clause
 */

if (!defined("WHMCS")) {
    die("This file may not be accessed directly");
}

require_once __DIR__ . "/../../../20i/vendor/autoload.php";
\TwentyI\WHMCS\Base::init(__DIR__ . "/api.json");

use \WHMCS\Service\Service;

/**
 * The module metadata
 *
 * @return array
 */
function provision20i_MetaData()
{
    return [
        "DisplayName" => "20i (" . \TwentyI\WHMCS\Base::shortVersion() . ")",
        "APIVersion" => "1.1",
        "RequiresServer" => true,
        "ServiceSingleSignOnLabel" => "Log in to hosting control panel",
        "AdminSingleSignOnLabel" => "Log in to Stack",
    ];
}

/**
 * Define available config options.
 *
 * @see \TwentyI\WHMCS\Provisioning::configOptions()
 *
 * @return array {
 *     @var array ($option name)
 * }
 */
function provision20i_ConfigOptions(array $params)
{
    $options = \TwentyI\WHMCS\Base::hostingConfigOptions();
    if ($params['producttype'] === "hostingaccount") {
        return \TwentyI\WHMCS\Provisioning::configOptions($options);
    } elseif ($params['producttype'] === "other") {
        return \TwentyI\WHMCS\Provisioning::vpsConfigOptions($options);
    }
}

/**
 * Changes the type of a service.
 *
 * @param array $params
 *
 * @return string "success" or an error message
 */
function provision20i_ChangePackage(array $params)
{
    if ($params['producttype'] != "hostingaccount") {
        throw new \Exception("Cannot modify type of non-hosting package product.");
    }
    try {
        $helper = \TwentyI\WHMCS\Provisioning::fromRequest($params);
        $response = $helper->modifyType($params);
        if (!$response) {
            throw new \Exception(
                "Please check your new product has a type code selected and that it belongs to the same platform as the current package."
            );
        }
        return "success";
    } catch (\TwentyI\API\Exception $e) {
        logModuleCall(
            "provision20i",
            __FUNCTION__,
            $params,
            $e->getMessage(),
            "(" . \TwentyI\WHMCS\Base::shortVersion() . ") $e"
        );

        return $e->getMessage();
    } catch (\Exception $e) {
        logModuleCall(
            "provision20i",
            __FUNCTION__,
            $params,
            $e->getMessage(),
            "(" . \TwentyI\WHMCS\Base::shortVersion() . ") $e"
        );

        return $e->getMessage();
    }
}


/**
 * Creates the selected service.
 *
 * @param array $params
 *
 * @return string "success" or an error message
 */
function provision20i_CreateAccount(array $params)
{
    try {
        switch ($params['producttype']) {
            case "hostingaccount":
                $helper = \TwentyI\WHMCS\Provisioning::fromRequest($params);
                $response = $helper->create($params);
                break;
            case "other":
                $helper = \TwentyI\WHMCS\Provisioning::fromRequest($params);

                if (
                    isset($params['customfields']) &&
                    isset($params['customfields']['websiteTurboId'])
                ) {
                    $response = $helper->websiteTurboCreate($params);
                    break;
                }

                if (
                    isset($params['customfields']) &&
                    isset($params['customfields']['Mailbox'])
                ) {
                    if (isset($params['customfields']['mailboxQuotaAddonId'])) {
                        $response = $helper->mailboxQuotaAddonCreate($params);
                    }
                    if (isset($params['customfields']['premiumMailboxId'])) {
                        $response = $helper->premiumMailboxCreate($params);
                    }
                    break;
                }

                if (
                    isset($params['customfields']) &&
                    isset($params['customfields']['tlsCertificateId'])
                ) {
                    $response = $helper->tlsCertificateCreate($params);
                    break;
                }

                if (
                    $params['configoption3'] &&
                    $params['configoption3'] == '20i-cloud-server'
                ) {
                    $response = $helper->cloudServerCreate($params);
                    break;
                } else {
                    $response = $helper->vpsCreate($params);
                }
                break;
        }
        if (!$response) {
            throw new \Exception("Unexpected empty response from server");
        }
        return "success";
    } catch (\TwentyI\API\Exception $e) {
        logModuleCall(
            "provision20i",
            __FUNCTION__,
            $params,
            $e->getMessage(),
            "(" . \TwentyI\WHMCS\Base::shortVersion() . ") $e"
        );

        return $e->getMessage();
    } catch (\Exception $e) {
        logModuleCall(
            "provision20i",
            __FUNCTION__,
            $params,
            $e->getMessage(),
            "(" . \TwentyI\WHMCS\Base::shortVersion() . ") $e"
        );

        return $e->getMessage();
    }
}

/**
 * Renews the service.
 *
 * @param array $params
 *
 * @return string "success" or an error message
 */
function provision20i_Renew(array $params)
{
    if ($params["producttype"] === "hostingaccount") {
        return true;
    }
    try {
        $helper = \TwentyI\WHMCS\Provisioning::fromRequest($params);
        $response = $helper->renew($params);
    } catch (\Exception $e) {
        logModuleCall(
            "provision20i",
            __FUNCTION__,
            $params,
            $e->getMessage(),
            "(" . \TwentyI\WHMCS\Base::shortVersion() . ") $e"
        );

        return $e->getMessage();
    }
}


/**
 * Provides single-sign-on to the service
 *
 * @param array $params
 * @return array {
 *     @var bool $success
 *     @var string|null $redirectTo
 *     @var string|null $errorMsg User-visible error message
 * }
 */
function provision20i_ServiceSingleSignOn(array $params)
{
    if (
        $params['producttype'] == "other" &&
        (
            isset($params["customfields"]["websiteTurboId"]) ||
            isset($params["customfields"]["mailboxQuotaAddonId"]) ||
            isset($params["customfields"]["premiumMailboxId"])
        )
    ) {
        throw new \Exception("Cannot SSO to addon product");
    }
    if (
        $params['producttype'] == "other" && isset($params["customfields"]["tlsCertificateId"])
    ) {
        throw new \Exception("Cannot SSO to TLS Certificate product");
    }
    try {
        $helper = \TwentyI\WHMCS\Provisioning::fromRequest($params);
        $url = $helper->singleSignOn($params);

        if ($_GET['quicklink']) {
            $systemUrl = rtrim(\WHMCS\Config\Setting::getValue('SystemURL'), '/');
            $r = '/whmcs/redirect?url=' . $systemUrl . '/clientarea.php'
                    . '&serviceid=' . $params['serviceid']
                    . '&packageId=' . $params['customfields']['packageId']
                    . '&quickLink=' . $_GET['quicklink'];
            $url .= '&r=' . urlencode($r);
        }

        // Used for Client Area quick links after URL has been constructed at CP by above
        if ($_GET['ql']) {
            $url .= '&r=' . urlencode($_GET['ql']);
        }

    } catch (\TwentyI\API\Exception $e) {
        logModuleCall(
            "provision20i",
            __FUNCTION__,
            $params,
            $e->getMessage(),
            "(" . \TwentyI\WHMCS\Base::shortVersion() . ") $e"
        );

        return [
            "success" => false,
            "redirectTo" => null,
            "errorMsg" => $e->getMessage(),
        ];
    } catch (\Exception $e) {
        logModuleCall(
            "provision20i",
            __FUNCTION__,
            $params,
            $e->getMessage(),
            "(" . \TwentyI\WHMCS\Base::shortVersion() . ") $e"
        );

        return [
            "success" => false,
            "redirectTo" => null,
            "errorMsg" => $e->getMessage(),
        ];
    }
    return [
        "success" => true,
        "redirectTo" => $url,
        "errorMsg" => null,
    ];
}

/**
 * Suspends a service.
 *
 * @param array $params
 *
 * @return string "success" or an error message
 */
function provision20i_SuspendAccount(array $params)
{
    if ($params['producttype'] != "hostingaccount") {
        throw new \Exception("Cannot disable non-hosting package product.");
    }
    try {
        $helper = \TwentyI\WHMCS\Provisioning::fromRequest($params);
        $response = $helper->disable();
        if (!$response) {
            throw new \Exception("Unexpected empty response from server");
        }
        return "success";
    } catch (\TwentyI\API\Exception $e) {
        logModuleCall(
            "provision20i",
            __FUNCTION__,
            $params,
            $e->getMessage(),
            "(" . \TwentyI\WHMCS\Base::shortVersion() . ") $e"
        );

        return $e->getMessage();
    } catch (\Exception $e) {
        logModuleCall(
            "provision20i",
            __FUNCTION__,
            $params,
            $e->getMessage(),
            "(" . \TwentyI\WHMCS\Base::shortVersion() . ") $e"
        );

        return $e->getMessage();
    }
    return "success";
}

/**
 * Un-suspends a service.
 *
 * @param array $params
 *
 * @return string "success" or an error message
 */
function provision20i_UnsuspendAccount(array $params)
{
    if ($params['producttype'] != "hostingaccount") {
        throw new \Exception("Cannot reenable non-hosting package product.");
    }

    try {
        $helper = \TwentyI\WHMCS\Provisioning::fromRequest($params);

        $response = $helper->enable();
        if (!$response) {
            throw new \Exception("Unexpected empty response from server");
        }
        return "success";
    } catch (\TwentyI\API\Exception $e) {
        logModuleCall(
            "provision20i",
            __FUNCTION__,
            $params,
            $e->getMessage(),
            "(" . \TwentyI\WHMCS\Base::shortVersion() . ") $e"
        );

        return $e->getMessage();
    } catch (\Exception $e) {
        logModuleCall(
            "provision20i",
            __FUNCTION__,
            $params,
            $e->getMessage(),
            "(" . \TwentyI\WHMCS\Base::shortVersion() . ") $e"
        );

        return $e->getMessage();
    }
    return "success";
}

/**
 * Retrieves the usage stats for a service
 *
 * @param array $params
 *
 * @return string "success" or an error message
 */
function provision20i_UsageUpdate($params)
{

    $serverid = $params['serverid'];
    $serverpassword = $params['serverpassword'];
    $serveraccesshash = $params['serveraccesshash'];
    $serversecure = $params['serversecure'];

    // Run connection to retrieve usage for all domains/accounts on $serverid

    $helper = \TwentyI\WHMCS\Provisioning::fromRequest($params);
    $results = $helper->usageUpdate($params);

    $bandwidthLimit;
    $bandwidthUsage;
    $diskLimit;

    // Now loop through results and update DB
    foreach ($results as $package => $values) {
        if ($values->DiskMb) {
            $bandwidthUsage = $values->Bandwidth->MbIn + $values->Bandwidth->MbOut;
            $bandwidthLimit = $values->bandwidthLimit;
            $diskLimit = $values->diskLimit;
            if ($values->bandwidthLimit == "INF") {
                $bandwidthLimit = 0;
            }
            if ($values->diskLimit == "INF") {
                $diskLimit = 0;
            }
            try {
                \WHMCS\Database\Capsule::table('tblhosting')
                    ->where('server', $serverid)
                    ->where('domain', $package)
                    ->update([
                        'diskusage' => $values->DiskMb,
                        'disklimit' => $diskLimit,
                        'bwusage' => $bandwidthUsage,
                        'bwlimit' => $bandwidthLimit,
                        'lastupdate' => \WHMCS\Database\Capsule::raw('now()'),
                    ]);
            } catch (\Exception $e) {
                // Handle any error which may occur
            }
        }
    }
}

/**
 * Cancels a service, or requests cancellation.
 *
 * @param array $params
 *
 * @return string "success" or an error message
 */
function provision20i_TerminateAccount(array $params)
{
    try {
        $helper = \TwentyI\WHMCS\Provisioning::fromRequest($params);
        $response = $helper->delete($params);
        if (!$response) {
            throw new \Exception("Unexpected failure to delete");
        }
        return "success";
    } catch (\TwentyI\API\Exception $e) {
        logModuleCall(
            "provision20i",
            __FUNCTION__,
            $params,
            $e->getMessage(),
            "(" . \TwentyI\WHMCS\Base::shortVersion() . ") $e"
        );

        return $e->getMessage();
    } catch (\Exception $e) {
        logModuleCall(
            "provision20i",
            __FUNCTION__,
            $params,
            $e->getMessage(),
            "(" . \TwentyI\WHMCS\Base::shortVersion() . ") $e"
        );

        return $e->getMessage();
    }
    return "success";
}
