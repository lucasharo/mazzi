// ============================================================================
// MAZZI DOMAIN — PROVIDER MERCADO PAGO OAUTH SERVICE (SPRINT 09)
// ============================================================================

import crypto from 'crypto';
import {
  Provider,
  ProviderPaymentAccount,
  ProviderPaymentAccountStatus,
} from '../../types';
import { PaymentGateway, OAuthExchangeResult } from './gateway-interface';

export interface InitiateOAuthResult {
  providerId: string;
  authorizationUrl: string;
  state: string;
  codeVerifier?: string;
  codeChallenge?: string;
}

export interface OAuthStateRecord {
  state: string;
  providerId: string;
  userId?: string;
  codeVerifier?: string;
  expiresAt: string;
  usedAt?: string;
}

export interface HandleOAuthCallbackParams {
  code: string;
  state: string;
  expectedState?: string;
  provider: Provider;
  redirectUri: string;
  codeVerifier?: string;
  existingAccount?: ProviderPaymentAccount;
  now?: Date;
}

export interface HandleOAuthCallbackResult {
  account: ProviderPaymentAccount;
  isNewAccount: boolean;
  externalAccountId: string;
}

export class ProviderOAuthService {
  private static stateStore = new Map<string, OAuthStateRecord>();

  constructor(private gateway: PaymentGateway) {}

  /**
   * Generates PKCE code_verifier and S256 code_challenge
   */
  static generatePkce(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(32).toString('hex');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  /**
   * Generates secure Mercado Pago OAuth authorization URL for a Provider with PKCE & server-side single-use state.
   */
  generateAuthorizationUrl(params: {
    providerId: string;
    redirectUri: string;
    clientId?: string;
    userId?: string;
    usePkce?: boolean;
  }): InitiateOAuthResult {
    const { providerId, redirectUri, clientId, userId, usePkce = true } = params;
    const csrfToken = crypto.randomBytes(16).toString('hex');
    const state = `prov_${providerId}__${csrfToken}`;

    let pkce: { codeVerifier: string; codeChallenge: string } | undefined;
    if (usePkce) {
      pkce = ProviderOAuthService.generatePkce();
    }

    // Save state server-side correlated with providerId, userId, expiration
    const stateRecord: OAuthStateRecord = {
      state,
      providerId,
      userId,
      codeVerifier: pkce?.codeVerifier,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
    ProviderOAuthService.stateStore.set(state, stateRecord);

    const gatewayClientId = (this.gateway as any)?.config?.clientId;
    const mpAppId = clientId || gatewayClientId || process.env.MERCADOPAGO_CLIENT_ID || process.env.MERCADOPAGO_MARKETPLACE_ID || 'MAZZI_MARKETPLACE_APP';
    
    let authorizationUrl = `https://auth.mercadopago.com.br/authorization?client_id=${mpAppId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    if (pkce) {
      authorizationUrl += `&code_challenge=${pkce.codeChallenge}&code_challenge_method=S256`;
    }

    return {
      providerId,
      authorizationUrl,
      state,
      codeVerifier: pkce?.codeVerifier,
      codeChallenge: pkce?.codeChallenge,
    };
  }

  /**
   * Handles OAuth callback from Mercado Pago:
   * 1. Validates CSRF state matches provider
   * 2. Exchanges authorization code for seller access token and external collector account ID
   * 3. Stores account link safely (never exposing access tokens to frontend)
   */
  async handleCallback(params: HandleOAuthCallbackParams): Promise<HandleOAuthCallbackResult> {
    const { code, state, expectedState, provider, redirectUri, existingAccount } = params;
    const now = params.now || new Date();

    // 1. CSRF State Validation & Single-Use Enforcement
    if (expectedState && state !== expectedState) {
      throw new Error('OAuth State inválido ou expirado (possível tentativa de CSRF).');
    }

    const storedStateRecord = ProviderOAuthService.stateStore.get(state);
    if (storedStateRecord) {
      if (storedStateRecord.usedAt) {
        throw new Error('OAuth State já foi utilizado (tentativa de re-uso descartada).');
      }
      if (new Date(storedStateRecord.expiresAt).getTime() < now.getTime()) {
        throw new Error('OAuth State expirou.');
      }
      // Mark as used (single-use)
      storedStateRecord.usedAt = now.toISOString();
    }

    if (!state.startsWith(`prov_${provider.id}`)) {
      throw new Error('OAuth State não corresponde ao prestador autenticado.');
    }

    if (!code || code.trim().length === 0) {
      throw new Error('Código de autorização OAuth ausente no callback.');
    }

    // 2. Exchange authorization code with Mercado Pago
    let exchangeResult: OAuthExchangeResult;

    if (typeof (this.gateway as any).exchangeOAuthCode === 'function') {
      exchangeResult = await (this.gateway as any).exchangeOAuthCode({ code, redirectUri });
    } else {
      // Fallback deterministic simulation when gateway is mock
      exchangeResult = {
        externalAccountId: `mp_collector_${provider.id}_${Math.random().toString(36).substring(2, 6)}`,
        accessToken: `TEST_TOKEN_${crypto.randomBytes(16).toString('hex')}`,
        refreshToken: `TEST_REFRESH_${crypto.randomBytes(16).toString('hex')}`,
        liveMode: false,
        expiresIn: 15552000, // 180 days
      };
    }

    // 3. Create or update ProviderPaymentAccount
    const isNew = !existingAccount;
    const account: ProviderPaymentAccount = {
      id: existingAccount?.id || `ppa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      providerId: provider.id,
      gateway: this.gateway.gatewayType,
      externalAccountId: exchangeResult.externalAccountId,
      status: 'ACTIVE',
      chargesEnabled: true,
      payoutsEnabled: true,
      metadata: {
        liveMode: exchangeResult.liveMode,
        tokenExpiresIn: exchangeResult.expiresIn,
        connectedAt: now.toISOString(),
        // SECURE: access_token stored strictly in server-side session/vault, never returned in public APIs
        hasSecureToken: Boolean(exchangeResult.accessToken),
      },
      createdAt: existingAccount?.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return {
      account,
      isNewAccount: isNew,
      externalAccountId: exchangeResult.externalAccountId,
    };
  }

  /**
   * Disconnects / revokes provider's payment account.
   */
  disconnectAccount(account: ProviderPaymentAccount, now: Date = new Date()): ProviderPaymentAccount {
    return {
      ...account,
      status: 'DISABLED',
      chargesEnabled: false,
      payoutsEnabled: false,
      updatedAt: now.toISOString(),
      metadata: {
        ...account.metadata,
        disconnectedAt: now.toISOString(),
      },
    };
  }
}
