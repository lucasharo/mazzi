import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Stripe hosted onboarding contract', () => {
  it('creates a single-use hosted link with return and refresh URLs', () => {
    const edgeFunction = fs.readFileSync(
      path.join(root, 'supabase/functions/create-stripe-connect-account/index.ts'),
      'utf8',
    );
    const dbService = fs.readFileSync(path.join(root, 'src/lib/db-service.ts'), 'utf8');
    const providerApp = fs.readFileSync(path.join(root, 'src/apps/provider/ProviderApp.tsx'), 'utf8');
    const instructorRoot = fs.readFileSync(path.join(root, 'src/entrypoints/instructor/InstructorRoot.tsx'), 'utf8');
    const accountTab = fs.readFileSync(
      path.join(root, 'src/apps/provider/components/ProviderAccountTab.tsx'),
      'utf8',
    );
    const migration = fs.readFileSync(
      path.join(root, 'supabase/migrations/20260902090000_stripe_hosted_onboarding_without_local_bank_data.sql'),
      'utf8',
    );

    expect(edgeFunction).toContain('account_links');
    expect(edgeFunction).toContain('core/account_links');
    expect(edgeFunction).toContain('type: "account_update"');
    expect(edgeFunction).toContain('accountWasExisting');
    expect(edgeFunction).toContain('configurations: ["recipient", "merchant"]');
    expect(edgeFunction).toContain('product_description: DEFAULT_PRODUCT_DESCRIPTION');
    expect(edgeFunction).toContain('Serviço de autoescola.');
    expect(edgeFunction).toContain('DEFAULT_MONTHLY_ESTIMATED_REVENUE');
    expect(edgeFunction).toContain('monthly_estimated_revenue: DEFAULT_MONTHLY_ESTIMATED_REVENUE');
    expect(edgeFunction).toContain('value: 0, currency: "brl"');
    expect(edgeFunction).toContain('identity.business_details = {');
    expect(edgeFunction).toContain('business_url: configuredBusinessUrl()');
    expect(edgeFunction).toContain('DEFAULT_MERCHANT_CATEGORY_CODE = "8299"');
    expect(edgeFunction).toContain('mcc: DEFAULT_MERCHANT_CATEGORY_CODE');
    expect(edgeFunction).toContain('could not synchronize merchant sector');
    expect(edgeFunction).toContain('include: ["configuration.merchant"]');
    expect(edgeFunction).toContain('br_cpf');
    expect(edgeFunction).toContain('date_of_birth');
    expect(edgeFunction).toContain('contact_phone');
    expect(edgeFunction).toContain('identity.business_details');
    expect(edgeFunction).toContain('individual.address = address');
    expect(edgeFunction).toContain('formatPostalCode');
    expect(edgeFunction).toContain('`${digits.slice(0, 5)}-${digits.slice(5)}`');
    expect(edgeFunction).toContain('refresh_url');
    expect(edgeFunction).toContain('return_url');
    expect(edgeFunction).toContain('if (openOnboarding)');
    expect(edgeFunction).toContain('O link só é criado depois do pré-preenchimento');
    expect(edgeFunction).toContain('Promise.allSettled');
    expect(edgeFunction).toContain('future_requirements: "include"');
    expect(edgeFunction).toContain('masked_payout_account');
    expect(edgeFunction).toContain('last4');
    expect(edgeFunction).not.toContain('get_my_bank_account');
    expect(edgeFunction).not.toContain('external_account[routing_number]');
    expect(dbService).toContain('onboardingUrl: string');
    expect(dbService).toContain('data.onboarding_url');
    expect(dbService).toContain('openProviderPayoutOnboarding');
    expect(dbService).toContain('maskedPayoutAccount');
    expect(providerApp).toContain("window.location.assign(result.onboardingUrl)");
    expect(providerApp).toContain('Keep the button loading while the browser leaves MAZZI');
    expect(providerApp).not.toContain('finally {\n      setIsConnectingStripe(false);');
    expect(providerApp).toContain("params.get('stripe_onboarding')");
    expect(providerApp).toContain('syncMyStripePaymentAccount()');
    expect(providerApp).toContain("setManagementSubTab('account')");
    expect(providerApp).toContain('requestAnimationFrame');
    expect(instructorRoot).toContain('isStripeOnboardingReturn');
    expect(instructorRoot).toContain('!isStripeOnboardingReturn()');
    expect(accountTab).toContain('não ficam armazenados no MAZZI');
    expect(accountTab).toContain('Conta cadastrada');
    expect(accountTab).not.toContain('bankAccount');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.save_my_bank_account');
    expect(migration).toContain("'document_number'");

    const viteConfig = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
    const serviceWorker = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
    const serviceWorkerRegistration = fs.readFileSync(path.join(root, 'src/registerServiceWorker.ts'), 'utf8');
    expect(viteConfig).toContain('registration.unregister()');
    expect(viteConfig).toContain("name.startsWith('mazzi-public-assets-')");
    expect(serviceWorker).toContain("const CACHE_NAME = 'mazzi-public-assets-v5'");
    expect(serviceWorker).toContain("url.pathname.startsWith('/src/')");
    expect(serviceWorker).toContain("url.pathname.startsWith('/node_modules/')");
    expect(serviceWorkerRegistration).toContain('isRemoteDevBuild');

    const identityPrefillMigration = fs.readFileSync(
      path.join(root, 'supabase/migrations/20260903013436_stripe_connect_identity_prefill.sql'),
      'utf8',
    );
    expect(identityPrefillMigration).toContain("'user_email'");
    expect(identityPrefillMigration).toContain("'birth_date'");
    expect(identityPrefillMigration).toContain("'address'");
  });
});
