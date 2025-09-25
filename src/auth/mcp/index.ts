import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type {
	AuthorizationParams,
	OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
	OAuthClientInformationFull,
	OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { eq, lt } from 'drizzle-orm';
import type { RequestHandler, Response } from 'express';
import { db } from '../../db/index.ts';
import {
	oauth_access_tokens,
	oauth_authorization_codes,
	oauth_clients,
	users,
} from '../../db/schema.ts';

async function get_auth_info_from_access_token(token: string) {
	const token_data = await db
		.select()
		.from(oauth_access_tokens)
		.where(eq(oauth_access_tokens.id, token))
		.get();

	if (!token_data) {
		throw new Error('Invalid access token');
	}

	// Check if token has expired (if expiration is set)
	if (token_data.expires_at && new Date(token_data.expires_at) < new Date()) {
		// Delete expired token
		await db
			.delete(oauth_access_tokens)
			.where(eq(oauth_access_tokens.id, token));
		throw new Error('Access token has expired');
	}

	const auth_info: AuthInfo = {
		token,
		clientId: token_data.client_id,
		scopes: JSON.parse(token_data.scopes || '[]'),
	};

	return auth_info;
}
class DatabaseClientsStore implements OAuthRegisteredClientsStore {
	async getClient(
		clientId: string
	): Promise<OAuthClientInformationFull | undefined> {
		const client = await db
			.select()
			.from(oauth_clients)
			.where(eq(oauth_clients.id, clientId))
			.get();

		if (!client) return undefined;

		return {
			client_id: client.id,
			client_secret: client.client_secret || undefined,
			client_name: client.client_name,
			redirect_uris: JSON.parse(client.redirect_uris),
		};
	}

	async registerClient(
		client: OAuthClientInformationFull
	): Promise<OAuthClientInformationFull> {
		// Insert new client
		await db.insert(oauth_clients).values({
			id: client.client_id,
			client_secret: client.client_secret!,
			client_name: client.client_name!,
			redirect_uris: JSON.stringify(client.redirect_uris),
		});

		return client;
	}
}

class OAuth implements OAuthServerProvider {
	clientsStore = new DatabaseClientsStore();

	async authorize(
		client: OAuthClientInformationFull,
		params: AuthorizationParams,
		res: Response
	) {
		// Create the final redirect URL with authorization code (to be generated after auth)
		const code = crypto.randomUUID();
		await db.insert(oauth_authorization_codes).values({
			id: code,
			expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
			...client,
		});
		const success_redirect = new URL(params.redirectUri);
		success_redirect.searchParams.set('code', code);
		if (params.state) {
			success_redirect.searchParams.set('state', params.state);
		}

		// Redirect to our custom authorization route with the redirect URL as a parameter
		const auth_url = new URL(
			'/auth/oauth/authorize',
			'http://localhost:3000'
		);
		auth_url.searchParams.set('code', code);
		auth_url.searchParams.set(
			'success_redirect',
			success_redirect.toString()
		);
		res.redirect(auth_url.toString());
	}

	async challengeForAuthorizationCode(
		_client: OAuthClientInformationFull,
		authorization_code: string
	) {
		const code_data = await db
			.select()
			.from(oauth_authorization_codes)
			.where(eq(oauth_authorization_codes.id, authorization_code))
			.get();

		if (!code_data || (code_data && !code_data.code_challenge)) {
			throw new Error('Invalid authorization code');
		}

		// Check if code has expired
		if (new Date(code_data.expires_at) < new Date()) {
			// Clean up expired code
			await db
				.delete(oauth_authorization_codes)
				.where(eq(oauth_authorization_codes.id, authorization_code));
			throw new Error('Authorization code has expired');
		}

		return code_data.code_challenge!;
	}

	async exchangeAuthorizationCode(
		client: OAuthClientInformationFull,
		code: string
	) {
		const code_data = await db
			.select()
			.from(oauth_authorization_codes)
			.where(eq(oauth_authorization_codes.id, code))
			.get();

		if (!code_data) {
			throw new Error('Invalid authorization code');
		}

		if (code_data.client_id !== client.client_id) {
			throw new Error('Client ID does not match authorization code');
		}

		// Check if code has expired
		if (new Date(code_data.expires_at) < new Date()) {
			// Clean up expired code
			await db
				.delete(oauth_authorization_codes)
				.where(eq(oauth_authorization_codes.id, code));
			throw new Error('Authorization code has expired');
		}

		// Delete the authorization code (one-time use)
		await db
			.delete(oauth_authorization_codes)
			.where(eq(oauth_authorization_codes.id, code));

		const access_token = crypto.randomUUID();

		// Create access token (no expiration for this example)
		await db.insert(oauth_access_tokens).values({
			id: access_token,
			client_id: client.client_id,
			user_id: code_data.user_id,
			scopes: code_data.scopes,
		});

		return {
			access_token,
			token_type: 'bearer',
			scope: (JSON.parse(code_data.scopes || '[]') as string[]).join(' '),
		};
	}

	exchangeRefreshToken(): Promise<OAuthTokens> {
		throw new Error('Method not implemented.');
	}

	verifyAccessToken(token: string): Promise<AuthInfo> {
		return get_auth_info_from_access_token(token);
	}

	// Clean up expired codes and tokens
	async cleanupExpired(): Promise<void> {
		const now = new Date().toISOString();

		// Clean up expired authorization codes
		await db
			.delete(oauth_authorization_codes)
			.where(lt(oauth_authorization_codes.expires_at, now));

		// Clean up expired access tokens (if they have expiration)
		await db
			.delete(oauth_access_tokens)
			.where(lt(oauth_access_tokens.expires_at, now));
	}

	skipLocalPkceValidation = true;
}

export const provider = new OAuth();

export const mcp_auth_router: RequestHandler = mcpAuthRouter({
	provider,
	issuerUrl: new URL('http://localhost:3000'),
});

// Utility function to get user from access token
export async function get_user_from_access_token(token: string) {
	const token_data = await db
		.select()
		.from(oauth_access_tokens)
		.leftJoin(users, eq(oauth_access_tokens.user_id, users.id))
		.where(eq(oauth_access_tokens.id, token))
		.get();

	if (!token_data?.users) return null;

	return token_data.users!;
}
