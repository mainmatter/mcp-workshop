import express, { Router, type Request, type Response } from 'express';
import {
	create_session,
	delete_session,
	login_user,
	register_user,
} from './index.ts';
import { optional_auth, redirect_if_authenticated } from './middleware.ts';
import { db } from '../db/index.ts';
import { oauth_authorization_codes } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

const router: Router = express.Router();

// Generate login/register HTML page
function generate_auth_html(
	message?: string,
	message_type: 'error' | 'success' = 'error',
	return_url?: string
) {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Login - Notes App</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			line-height: 1.6;
			color: #e4e4e7;
			background: linear-gradient(135deg, #0f0f23, #1a1a2e);
			padding: 20px;
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		
		.auth-container {
			background: #1e1e2e;
			padding: 40px;
			border-radius: 16px;
			box-shadow: 0 8px 32px rgba(0,0,0,0.5);
			border: 1px solid #2a2a3a;
			width: 100%;
			max-width: 400px;
		}
		
		h1 {
			text-align: center;
			margin-bottom: 30px;
			color: #f8fafc;
			font-size: 28px;
		}
		
		.message {
			padding: 12px 16px;
			border-radius: 8px;
			margin-bottom: 20px;
			font-weight: 500;
		}
		
		.message.error {
			background-color: #991b1b;
			color: #fecaca;
			border: 1px solid #dc2626;
		}
		
		.message.success {
			background-color: #166534;
			color: #bbf7d0;
			border: 1px solid #15803d;
		}
		
		.auth-forms {
			display: flex;
			flex-direction: column;
			gap: 30px;
		}
		
		.auth-form {
			display: flex;
			flex-direction: column;
			gap: 16px;
		}
		
		.form-title {
			font-size: 20px;
			font-weight: 600;
			color: #cbd5e1;
			margin-bottom: 8px;
			text-align: center;
		}
		
		.form-group {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}
		
		label {
			font-weight: 500;
			color: #94a3b8;
			font-size: 14px;
		}
		
		input[type="text"], input[type="password"] {
			width: 100%;
			padding: 12px 16px;
			border: 2px solid #374151;
			border-radius: 8px;
			font-size: 16px;
			background-color: #111827;
			color: #f3f4f6;
			transition: all 0.3s ease;
		}
		
		input[type="text"]:focus, input[type="password"]:focus {
			outline: none;
			border-color: #3b82f6;
			box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
			background-color: #1f2937;
		}
		
		.btn {
			background: linear-gradient(135deg, #3b82f6, #1d4ed8);
			color: white;
			padding: 12px 24px;
			border: none;
			border-radius: 8px;
			font-size: 16px;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.3s ease;
		}
		
		.btn:hover {
			background: linear-gradient(135deg, #2563eb, #1e40af);
			transform: translateY(-1px);
			box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
		}
		
		.btn-secondary {
			background: linear-gradient(135deg, #6b7280, #4b5563);
		}
		
		.btn-secondary:hover {
			background: linear-gradient(135deg, #4b5563, #374151);
			box-shadow: 0 4px 12px rgba(107, 114, 128, 0.3);
		}
		
		.divider {
			text-align: center;
			color: #6b7280;
			font-size: 14px;
			margin: 10px 0;
			position: relative;
		}
		
		.divider::before {
			content: '';
			position: absolute;
			top: 50%;
			left: 0;
			right: 0;
			height: 1px;
			background: #374151;
			z-index: 1;
		}
		
		.divider span {
			background: #1e1e2e;
			padding: 0 16px;
			position: relative;
			z-index: 2;
		}
		
		@media (max-width: 480px) {
			body {
				padding: 16px;
			}
			
			.auth-container {
				padding: 24px;
			}
		}
	</style>
</head>
<body>
	<div class="auth-container">
		<h1>🔐 Welcome</h1>
		
		${message ? `<div class="message ${message_type}">${message}</div>` : ''}
		
		<div class="auth-forms">
			<form method="POST" action="/login" class="auth-form">
				${
					return_url
						? `<input type="hidden" name="return_url" value="${return_url}">`
						: ''
				}
				<h2 class="form-title">Login</h2>
				<div class="form-group">
					<label for="login-username">Username</label>
					<input type="text" id="login-username" name="username" required>
				</div>
				<div class="form-group">
					<label for="login-password">Password</label>
					<input type="password" id="login-password" name="password" required>
				</div>
				<button type="submit" class="btn">Login</button>
				<div class="divider">
					<span>or</span>
				</div>
				<button formaction="/register" type="submit" class="btn btn-secondary">Register</button>
				${
					return_url
						? `<input type="hidden" name="return_url" value="${return_url}">`
						: ''
				}
			</form>
		</div>
	</div>
</body>
</html>`;
}

// Login/Register page
router.get(
	'/login',
	redirect_if_authenticated,
	(req: Request, res: Response) => {
		const return_url = req.query.return_url as string | undefined;
		const html = generate_auth_html(undefined, 'error', return_url);
		res.send(html);
	}
);

// Handle login
router.post(
	'/login',
	redirect_if_authenticated,
	async (req: Request, res: Response) => {
		const { username, password, return_url } = req.body;

		if (!username || !password) {
			const html = generate_auth_html(
				'Please fill in both username and password',
				'error',
				return_url
			);
			return res.send(html);
		}

		const user = await login_user(username.trim(), password);

		if (!user) {
			const html = generate_auth_html(
				'Invalid username or password',
				'error',
				return_url
			);
			return res.send(html);
		}

		// Create session
		const session_id = await create_session(user.id);

		// Set HTTP-only cookie
		res.cookie('session_id', session_id, {
			httpOnly: true,
			secure: false, // Set to true in production with HTTPS
			sameSite: 'strict',
			maxAge: 24 * 60 * 60 * 1000, // 24 hours
		});

		// Redirect to return_url if provided, otherwise to home
		res.redirect(return_url || '/');
	}
);

// Handle registration
router.post(
	'/register',
	redirect_if_authenticated,
	async (req: Request, res: Response) => {
		const { username, password, return_url } = req.body;

		if (!username || !password) {
			const html = generate_auth_html(
				'Please fill in both username and password',
				'error',
				return_url
			);
			return res.send(html);
		}

		if (username.trim().length < 3) {
			const html = generate_auth_html(
				'Username must be at least 3 characters long',
				'error',
				return_url
			);
			return res.send(html);
		}

		if (password.length < 4) {
			const html = generate_auth_html(
				'Password must be at least 4 characters long',
				'error',
				return_url
			);
			return res.send(html);
		}

		const user = await register_user(username.trim(), password);

		if (!user) {
			const html = generate_auth_html(
				'Username already exists',
				'error',
				return_url
			);
			return res.send(html);
		}

		// Create session
		const session_id = await create_session(user.id);

		// Set HTTP-only cookie
		res.cookie('session_id', session_id, {
			path: '/',
			httpOnly: true,
			secure: false, // Set to true in production with HTTPS
			sameSite: 'strict',
			maxAge: 24 * 60 * 60 * 1000, // 24 hours
		});

		// Redirect to return_url if provided, otherwise to home
		res.redirect(return_url || '/');
	}
);

// Handle logout
router.post('/logout', async (req: Request, res: Response) => {
	const session_id = req.cookies?.session_id;

	if (session_id) {
		await delete_session(session_id);
	}

	res.clearCookie('session_id');
	res.redirect('/login');
});

// OAuth authorization endpoint
router.get(
	'/auth/oauth/authorize',
	optional_auth,
	async (req: Request, res: Response) => {
		const { success_redirect, code } = req.query as Record<string, string>;

		if (success_redirect == null) {
			return res.status(400).send('Missing success_redirect parameter');
		}

		// Check if user is authenticated
		if (!req.user) {
			// User is not logged in, redirect to login page with return URL
			const login_url = new URL('/login', 'http://localhost:3000');

			login_url.searchParams.set(
				'return_url',
				new URL(req.url, 'http://localhost:3000').toString()
			);
			return res.redirect(login_url.toString());
		}

		await db
			.update(oauth_authorization_codes)
			.set({
				user_id: req.user.id,
			})
			.where(eq(oauth_authorization_codes.id, code!));

		res.redirect(success_redirect.toString());
	}
);

export default router;
