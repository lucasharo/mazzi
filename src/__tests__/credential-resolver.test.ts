// ============================================================================
// MAZZI DOMAIN — CREDENTIAL RESOLVER & SPLIT 1:1 TESTS (SPRINT 09)
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { MercadoPagoCredentialResolver } from '../domain/payments/credential-resolver';
import { MercadoPagoPaymentGateway } from '../domain/payments/mercadopago-adapter';
import { ProviderOAuthService } from '../domain/payments/oauth-service';
import { ProviderPaymentAccount } from '../types';

describe('Sprint 09: Mercado Pago Credential Resolver & Split 1:1', () => {
  const mockGateway = new MercadoPagoPaymentGateway({
    accessToken: 'MARKETPLACE_APP_USR_TEST_TOKEN',
    clientId: 'MAZZI_APP_ID',
    clientSecret: 'MAZZI_CLIENT_SECRET',
    useLiveHttp: false,
  });

  const resolver = new MercadoPagoCredentialResolver(mockGateway);

  it('resolves seller access token from active ProviderPaymentAccount', async () => {
    const account: ProviderPaymentAccount = {
      id: 'ppa_1',
      providerId: 'prov_100',
      gateway: 'MERCADOPAGO',
      externalAccountId: '1000999',
      status: 'ACTIVE',
      chargesEnabled: true,
      payoutsEnabled: true,
      metadata: {
        accessToken: 'APP_USR_SELLER_SPECIFIC_OAUTH_TOKEN',
        expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const cred = await resolver.resolveSellerCredential({
      providerId: 'prov_100',
      account,
    });

    expect(cred.providerId).toBe('prov_100');
    expect(cred.accessToken).toBe('APP_USR_SELLER_SPECIFIC_OAUTH_TOKEN');
    expect(cred.externalAccountId).toBe('1000999');
    expect(cred.chargesEnabled).toBe(true);
  });

  it('rejects credential resolution if provider account is INACTIVE or charges disabled', async () => {
    const disabledAccount: ProviderPaymentAccount = {
      id: 'ppa_2',
      providerId: 'prov_101',
      gateway: 'MERCADOPAGO',
      externalAccountId: '1000998',
      status: 'DISABLED',
      chargesEnabled: false,
      payoutsEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(
      resolver.resolveSellerCredential({
        providerId: 'prov_101',
        account: disabledAccount,
      })
    ).rejects.toThrow('PAYMENT_ACCOUNT_NOT_READY');
  });

  it('rotates seller access token automatically if near expiration (< 5 min)', async () => {
    const expiringAccount: ProviderPaymentAccount = {
      id: 'ppa_3',
      providerId: 'prov_102',
      gateway: 'MERCADOPAGO',
      externalAccountId: '1000997',
      status: 'ACTIVE',
      chargesEnabled: true,
      payoutsEnabled: true,
      metadata: {
        accessToken: 'OLD_SELLER_TOKEN',
        refreshToken: 'VALID_REFRESH_TOKEN',
        expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // Expires in 2 min
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Spy on refreshOAuthToken
    vi.spyOn(mockGateway as any, 'refreshOAuthToken').mockResolvedValue({
      accessToken: 'NEW_ROTATED_SELLER_TOKEN',
      refreshToken: 'NEW_REFRESH_TOKEN',
      expiresIn: 15552000,
      externalAccountId: '1000997',
      liveMode: false,
    });

    const cred = await resolver.resolveSellerCredential({
      providerId: 'prov_102',
      account: expiringAccount,
      now: new Date(),
    });

    expect(cred.accessToken).toBe('NEW_ROTATED_SELLER_TOKEN');
    expect(expiringAccount.metadata?.accessToken).toBe('NEW_ROTATED_SELLER_TOKEN');
  });

  it('generates PKCE code_verifier and code_challenge S256 for OAuth flow', () => {
    const pkce = ProviderOAuthService.generatePkce();
    expect(pkce.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(pkce.codeChallenge).toBeDefined();

    const oauthService = new ProviderOAuthService(mockGateway);
    const init = oauthService.generateAuthorizationUrl({
      providerId: 'prov_200',
      redirectUri: 'https://mazzi.app/oauth/callback',
      usePkce: true,
    });

    expect(init.authorizationUrl).toContain('code_challenge=');
    expect(init.authorizationUrl).toContain('code_challenge_method=S256');
    expect(init.codeVerifier).toBeDefined();
  });

  it('enforces single-use state verification server-side', async () => {
    const oauthService = new ProviderOAuthService(mockGateway);
    const init = oauthService.generateAuthorizationUrl({
      providerId: 'prov_300',
      redirectUri: 'https://mazzi.app/oauth/callback',
    });

    const providerMock = { id: 'prov_300', name: 'Instrutor Teste' } as any;

    // First handleCallback execution succeeds
    const res = await oauthService.handleCallback({
      code: 'VALID_MOCK_OAUTH_CODE',
      state: init.state,
      provider: providerMock,
      redirectUri: 'https://mazzi.app/oauth/callback',
    });

    expect(res.account.status).toBe('ACTIVE');

    // Second execution with same state fails due to single-use enforcement
    await expect(
      oauthService.handleCallback({
        code: 'VALID_MOCK_OAUTH_CODE',
        state: init.state,
        provider: providerMock,
        redirectUri: 'https://mazzi.app/oauth/callback',
      })
    ).rejects.toThrow('OAuth State já foi utilizado');
  });
});
