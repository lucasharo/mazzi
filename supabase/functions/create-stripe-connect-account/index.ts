// @ts-nocheck -- Deno types are supplied by the Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "http://localhost:3002",
  "http://127.0.0.1:3002",
  "http://localhost:3000",
  "https://mazzi-profissional-dev.pages.dev",
]);
const DEFAULT_PRODUCT_DESCRIPTION = "Serviço de autoescola.";
const DEFAULT_MERCHANT_CATEGORY_CODE = "8299";
const DEFAULT_BUSINESS_URL = "https://mazzi-landing-dev.pages.dev";
const DEFAULT_MONTHLY_ESTIMATED_REVENUE = {
  amount: { value: 0, currency: "brl" },
};

function configuredBusinessUrl() {
  const value = cleanText(Deno.env.get("MAZZI_LANDING_URL"));
  if (!value) return DEFAULT_BUSINESS_URL;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : DEFAULT_BUSINESS_URL;
  } catch {
    return DEFAULT_BUSINESS_URL;
  }
}

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function digitsOnly(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatPostalCode(value: unknown, country: string) {
  const digits = digitsOnly(value);
  if (country === "BR" && digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
}

function isValidCpf(value: unknown) {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let firstSum = 0;
  for (let index = 0; index < 9; index += 1) firstSum += Number(cpf[index]) * (10 - index);
  const firstDigit = (firstSum * 10) % 11 === 10 ? 0 : (firstSum * 10) % 11;
  if (firstDigit !== Number(cpf[9])) return false;
  let secondSum = 0;
  for (let index = 0; index < 10; index += 1) secondSum += Number(cpf[index]) * (11 - index);
  const secondDigit = (secondSum * 10) % 11 === 10 ? 0 : (secondSum * 10) % 11;
  return secondDigit === Number(cpf[10]);
}

function isValidCnpj(value: unknown) {
  const cnpj = digitsOnly(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calculateDigit = (length: number) => {
    let sum = 0;
    let weight = length - 7;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cnpj[index]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculateDigit(12) === Number(cnpj[12]) && calculateDigit(13) === Number(cnpj[13]);
}

function normalizeBrazilianPhone(value: unknown) {
  const original = cleanText(value);
  if (!original) return null;
  const digits = digitsOnly(original);
  if (original.startsWith("+") && digits.length >= 10) return `+${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return null;
}

function splitPersonName(value: unknown) {
  const parts = cleanText(value)?.split(/\s+/).filter(Boolean) || [];
  if (parts.length === 0) return {};
  if (parts.length === 1) return { given_name: parts[0] };
  return { given_name: parts[0], surname: parts.slice(1).join(" ") };
}

function parseBirthDate(value: unknown) {
  const match = String(value ?? "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  if (parsed.getTime() > Date.now()) return null;
  return { day, month, year };
}

function buildStripeAddress(provider: any) {
  const address = provider?.address && typeof provider.address === "object" ? provider.address : {};
  const street = cleanText(address.addressLine1) || cleanText(address.street);
  const houseNumber = cleanText(address.houseNumber);
  const line1 = street && houseNumber && !street.includes(houseNumber) ? `${street}, ${houseNumber}` : street;
  const city = cleanText(address.city) || cleanText(provider?.city);
  const state = cleanText(address.stateCode) || cleanText(address.state) || cleanText(provider?.state);
  const country = (cleanText(address.countryCode) || "BR").toUpperCase();
  const postalCode = formatPostalCode(address.postalCode || provider?.postal_code, country);
  if (!line1 || !city || !state || postalCode.length < 5) return null;
  return {
    line1,
    ...(cleanText(address.addressLine2) || cleanText(address.complement)
      ? { line2: cleanText(address.addressLine2) || cleanText(address.complement) }
      : {}),
    city,
    state,
    postal_code: postalCode,
    country,
  };
}

function buildStripePrefill(provider: any) {
  const documentNumber = digitsOnly(provider?.document_number);
  const isCompany = provider?.provider_type === "DRIVING_SCHOOL" || documentNumber.length === 14;
  const email = cleanText(provider?.commercial_email) || cleanText(provider?.user_email);
  const phone = normalizeBrazilianPhone(provider?.phone || provider?.user_phone || provider?.public_contact);
  const displayName = cleanText(provider?.trade_name) || cleanText(provider?.legal_name) || cleanText(provider?.user_name) || "Instrutor MAZZI";
  const profile = {
    business_url: configuredBusinessUrl(),
    product_description: DEFAULT_PRODUCT_DESCRIPTION,
    ...(cleanText(provider?.trade_name) ? { doing_business_as: cleanText(provider.trade_name) } : {}),
  };
  const identity: Record<string, unknown> = {
    country: "br",
    entity_type: isCompany ? "company" : "individual",
    business_details: {
      monthly_estimated_revenue: DEFAULT_MONTHLY_ESTIMATED_REVENUE,
    },
  };

  if (isCompany) {
    const businessDetails: Record<string, unknown> = {
      ...(cleanText(provider?.legal_name) || cleanText(provider?.trade_name) ? { registered_name: cleanText(provider?.legal_name) || cleanText(provider?.trade_name) } : {}),
      ...(phone ? { phone } : {}),
      product_description: DEFAULT_PRODUCT_DESCRIPTION,
    };
    if (isValidCnpj(documentNumber)) businessDetails.id_numbers = [{ type: "br_cnpj", value: documentNumber }];
    const address = buildStripeAddress(provider);
    if (address) businessDetails.address = address;
    identity.business_details = {
      ...businessDetails,
      monthly_estimated_revenue: DEFAULT_MONTHLY_ESTIMATED_REVENUE,
    };
  } else {
    const individual: Record<string, unknown> = {
      ...splitPersonName(provider?.user_name || provider?.legal_name),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    };
    const cpf = isValidCpf(documentNumber) ? documentNumber : isValidCpf(provider?.user_cpf) ? digitsOnly(provider.user_cpf) : "";
    if (cpf) individual.id_numbers = [{ type: "br_cpf", value: cpf }];
    const dateOfBirth = parseBirthDate(provider?.birth_date);
    if (dateOfBirth) individual.date_of_birth = dateOfBirth;
    const address = buildStripeAddress(provider);
    if (address) individual.address = address;
    identity.individual = individual;
  }

  return {
    ...(email ? { contact_email: email } : {}),
    ...(phone ? { contact_phone: phone } : {}),
    display_name: displayName,
    identity,
    defaults: {
      currency: "brl",
      profile,
      responsibilities: { fees_collector: "application", losses_collector: "application" },
      locales: ["pt-BR"],
    },
  };
}

function isAllowedOrigin(origin: string) {
  if (allowedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "https:"
      && (url.hostname === "trycloudflare.com" || url.hostname.endsWith(".trycloudflare.com"));
  } catch {
    return false;
  }
}

function appReturnUrl(request: Request, state: "return" | "refresh") {
  const requestOrigin = request.headers.get("Origin") || "";
  const origin = isAllowedOrigin(requestOrigin) ? requestOrigin : "https://mazzi-profissional-dev.pages.dev";
  const url = new URL(origin);
  url.pathname = "/";
  url.search = `?stripe_onboarding=${state}`;
  url.hash = "#/provider/management";
  return url.toString();
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://mazzi-profissional-dev.pages.dev",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const reply = (request: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });

async function stripeGet(path: string, secret: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${secret}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error?.message || `Stripe HTTP ${response.status}`));
  return payload;
}

function getMaskedExternalAccount(stripeAccount: any) {
  const externalAccounts = Array.isArray(stripeAccount?.external_accounts?.data)
    ? stripeAccount.external_accounts.data
    : [];
  const externalAccount = externalAccounts.find((item: any) => item?.object === "bank_account")
    || externalAccounts.find((item: any) => item?.object === "card");
  if (!externalAccount) return null;

  const summary: Record<string, string> = {
    kind: externalAccount.object === "bank_account" ? "bank_account" : "card",
  };
  if (typeof externalAccount.bank_name === "string" && externalAccount.bank_name.trim()) summary.bankName = externalAccount.bank_name.trim();
  if (typeof externalAccount.last4 === "string" && /^\d{4}$/.test(externalAccount.last4)) summary.last4 = externalAccount.last4;
  if (typeof externalAccount.country === "string" && /^[A-Z]{2}$/.test(externalAccount.country)) summary.country = externalAccount.country;
  if (typeof externalAccount.currency === "string" && /^[a-z]{3}$/.test(externalAccount.currency)) summary.currency = externalAccount.currency;
  if (typeof externalAccount.status === "string" && /^[a-z_]+$/.test(externalAccount.status)) summary.status = externalAccount.status;
  return summary;
}

async function stripeV2Request(path: string, secret: string, body: Record<string, unknown>, idempotency?: string) {
  const response = await fetch(`https://api.stripe.com/v2/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      "Stripe-Version": "2026-08-26.dahlia",
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error?.message || `Stripe HTTP ${response.status}`));
  return payload;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== "POST") return reply(request, 405, { message: "Método não permitido." });
  const requestBody = await request.json().catch(() => ({}));
  const openOnboarding = requestBody?.open_onboarding !== false;
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const stripeSecretKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  if (!token || !supabaseUrl || !serviceRoleKey || !stripeSecretKey) return reply(request, 503, { message: "Integração Stripe não configurada." });
  const isUsTest = requestBody?.account_country === "US";
  if (isUsTest) return reply(request, 422, { message: "A plataforma Stripe da MAZZI está registrada no Brasil e não pode criar contas Connect dos EUA. Use uma conta brasileira para o teste ou uma plataforma Stripe registrada nos EUA." });
  const accountGateway = isUsTest ? "STRIPE_US_TEST" : "STRIPE";
  const getAccountRpc = isUsTest ? "get_my_us_test_provider_payment_account" : "get_my_provider_payment_account";
  const upsertAccountRpc = isUsTest ? "upsert_my_us_test_provider_payment_account" : "upsert_my_provider_payment_account";
  const updateAccountRpc = isUsTest ? "update_my_us_test_provider_payment_account" : "update_my_provider_payment_account";

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const publicKey = (Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "").trim();
  const userClient = createClient(supabaseUrl, publicKey, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: userError } = await service.auth.getUser(token);
  if (userError || !userData.user) return reply(request, 401, { message: "Sessão inválida." });
  const userId = userData.user.id;
  const { data: provider, error: providerError } = await userClient.rpc("get_my_provider_identity");
  if (providerError) {
    console.error("provider lookup failed", { code: providerError.code, message: providerError.message });
    return reply(request, 500, { message: "Não foi possível validar o vínculo do instrutor. Tente novamente.", detail: providerError.message, code: providerError.code || null });
  }
  if (!provider?.id) return reply(request, 403, { message: "A sessão atual não está vinculada a um instrutor. Saia e entre novamente com a conta do instrutor." });
  const providerPrefill = buildStripePrefill({
    ...provider,
    // The Auth user is the authoritative fallback when the legacy public.users
    // row has not yet copied the email from Supabase Auth.
    user_email: provider.user_email || userData.user.email,
  });
  const { data: existingAccount, error: existingAccountError } = await userClient.rpc(getAccountRpc);
  if (existingAccountError) return reply(request, 500, { message: "Não foi possível carregar a conta Connect.", detail: existingAccountError.message, code: existingAccountError.code || null });
  let account = existingAccount?.id ? existingAccount : null;
  const accountWasExisting = Boolean(account);
  let sectorSyncPromise: Promise<unknown> | null = null;
  try {
    if (!account) {
      const created = await stripeV2Request("core/accounts", stripeSecretKey, {
        ...providerPrefill,
        dashboard: "none",
        configuration: {
          merchant: { mcc: DEFAULT_MERCHANT_CATEGORY_CODE, capabilities: { card_payments: { requested: true } } },
          recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
        },
        metadata: { mazzi_provider_id: provider.id, mazzi_account_gateway: accountGateway },
        include: ["configuration.recipient", "identity", "requirements"],
      }, `mazzi-connect-account-${accountGateway}-${provider.id}`);
      const { data: inserted, error: insertError } = await userClient.rpc(upsertAccountRpc, {
        p_external_account_id: created.id, p_status: "PENDING", p_charges_enabled: false, p_payouts_enabled: false,
        p_metadata: { source: "provider_profile" },
      });
      if (insertError) throw insertError;
      account = inserted;
    } else if (account.status !== "ACTIVE") {
      // Contas já habilitadas não precisam repetir o pré-preenchimento a cada
      // clique. Para contas pendentes, as duas atualizações independentes são
      // feitas em paralelo para não alongar a abertura do onboarding.
      const prefillResults = await Promise.allSettled([
        stripeV2Request(`core/accounts/${account.external_account_id}`, stripeSecretKey, {
          ...(providerPrefill.contact_email ? { contact_email: providerPrefill.contact_email } : {}),
          ...(providerPrefill.contact_phone ? { contact_phone: providerPrefill.contact_phone } : {}),
          display_name: providerPrefill.display_name,
          configuration: { merchant: { mcc: DEFAULT_MERCHANT_CATEGORY_CODE } },
          defaults: { profile: providerPrefill.defaults.profile },
        }),
        stripeV2Request(`core/accounts/${account.external_account_id}`, stripeSecretKey, {
          identity: providerPrefill.identity,
          include: ["identity"],
        }),
      ]);
      for (const [index, result] of prefillResults.entries()) {
        if (result.status === "rejected") {
          // A Stripe pode bloquear campos depois que o onboarding começou.
          // Nesse caso, o link ainda pode ser aberto para concluir as pendências.
          console.warn(index === 0 ? "could not prefill existing account contact/profile" : "could not prefill existing account identity", result.reason);
        }
      }
    } else {
      // Contas já habilitadas não precisam repetir toda a identidade, mas o
      // setor e o pré-preenchimento de receita precisam continuar sincronizados
      // enquanto a Stripe ainda não os tiver revisado definitivamente.
      sectorSyncPromise = stripeV2Request(`core/accounts/${account.external_account_id}`, stripeSecretKey, {
        configuration: { merchant: { mcc: DEFAULT_MERCHANT_CATEGORY_CODE } },
        identity: { business_details: { monthly_estimated_revenue: DEFAULT_MONTHLY_ESTIMATED_REVENUE } },
        include: ["configuration.merchant"],
      }).catch((error) => {
        // A Stripe pode bloquear a alteração depois da revisão. O onboarding
        // ainda deve abrir para que o titular possa concluir as pendências.
        console.warn("could not synchronize merchant sector", error);
      });
    }

    if (openOnboarding) {
      // O link só é criado depois do pré-preenchimento para que o Stripe já
      // consiga renderizar a renda mensal com a opção padrão selecionada.
      // A leitura autoritativa das capacidades e do banco continua reservada
      // ao retorno do Stripe, quando open_onboarding=false.
      const collectionOptions = {
        fields: "eventually_due",
        future_requirements: "include",
      };
      const accountLinkUseCase = accountWasExisting
        ? {
            type: "account_update",
            account_update: {
              configurations: ["recipient", "merchant"],
              collection_options: collectionOptions,
              refresh_url: appReturnUrl(request, "refresh"),
              return_url: appReturnUrl(request, "return"),
            },
          }
        : {
            type: "account_onboarding",
            account_onboarding: {
              configurations: ["recipient", "merchant"],
              collection_options: collectionOptions,
              refresh_url: appReturnUrl(request, "refresh"),
              return_url: appReturnUrl(request, "return"),
            },
          };
      const [accountLink] = await Promise.all([
        stripeV2Request("core/account_links", stripeSecretKey, {
          account: account.external_account_id,
          use_case: accountLinkUseCase,
        }),
        sectorSyncPromise ?? Promise.resolve(null),
      ]);
      return reply(request, 200, { account, onboarding_url: accountLink.url });
    }

    if (sectorSyncPromise) await sectorSyncPromise;

    // O retorno é o momento autoritativo para ler capacidades, requisitos e
    // o resumo bancário mascarado antes de atualizar o banco local.
    const stripeAccount = await stripeGet(`accounts/${account.external_account_id}`, stripeSecretKey);
    let externalAccounts = stripeAccount?.external_accounts;
    if (!Array.isArray(externalAccounts?.data)) {
      try {
        externalAccounts = await stripeGet(`accounts/${account.external_account_id}/external_accounts?limit=10`, stripeSecretKey);
      } catch {
        externalAccounts = undefined;
      }
    }
    const maskedExternalAccount = getMaskedExternalAccount({ ...stripeAccount, external_accounts: externalAccounts });
    const { masked_payout_account: _previousMaskedAccount, ...existingMetadata } =
      account.metadata && typeof account.metadata === "object" ? account.metadata : {};
    const accountMetadata = {
      ...existingMetadata,
      ...(maskedExternalAccount ? { masked_payout_account: maskedExternalAccount } : {}),
    };
    const { data: synced, error: syncError } = await userClient.rpc(updateAccountRpc, {
      p_external_account_id: account.external_account_id, p_status: stripeAccount.payouts_enabled ? "ACTIVE" : "PENDING",
      p_charges_enabled: stripeAccount.charges_enabled === true, p_payouts_enabled: stripeAccount.payouts_enabled === true,
      p_metadata: accountMetadata,
    });
    if (syncError) throw syncError;

    // Depois que o onboarding hospedado sinaliza retorno, apenas sincronizamos
    // o estado autoritativo da Stripe. Não criamos um segundo link.
    return reply(request, 200, { account: synced });
  } catch (error) {
    console.error("connect account onboarding failed", error);
    return reply(request, 502, { message: "Não foi possível concluir o cadastro de recebimentos. Revise os dados bancários e tente novamente." });
  }
});
