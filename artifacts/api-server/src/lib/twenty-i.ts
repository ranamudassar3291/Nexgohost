/**
 * 20i Hosting API Module
 * https://my.20i.com/reseller/apidoc
 */

interface TwentyIConfig {
  apiKey: string;
  stackUser?: string;
  packageId?: string;
}

async function twentyiRequest(apiKey: string, method: string, path: string, body?: unknown): Promise<any> {
  const url = `https://api.20i.com${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`20i API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function twentyiTestConnection(config: TwentyIConfig) {
  try {
    const data = await twentyiRequest(config.apiKey, "GET", "/reseller/packages");
    return { success: true, message: `Connected to 20i API. Packages: ${data?.length ?? 0}` };
  } catch (err: any) {
    return { success: false, message: err.message || "20i connection failed" };
  }
}

export async function twentyiCreateHosting(config: TwentyIConfig, domain: string, email: string) {
  return twentyiRequest(config.apiKey, "POST", "/reseller/addWeb", {
    domain_name: domain,
    extra_domain_names: [],
    package_id: config.packageId,
    username: config.stackUser,
    contact_email: email,
  });
}

export async function twentyiSuspend(config: TwentyIConfig, siteId: string) {
  return twentyiRequest(config.apiKey, "POST", `/userHosting/${siteId}/updateSubscription`, {
    status: 0,
  });
}

export async function twentyiUnsuspend(config: TwentyIConfig, siteId: string) {
  return twentyiRequest(config.apiKey, "POST", `/userHosting/${siteId}/updateSubscription`, {
    status: 1,
  });
}

export async function twentyiDelete(config: TwentyIConfig, siteId: string) {
  return twentyiRequest(config.apiKey, "DELETE", `/userHosting/${siteId}`);
}
