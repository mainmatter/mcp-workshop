import type { Request, Response, NextFunction } from 'express';
import { validate_session, type AuthUser } from './index.ts';

// Extend Express Request to include user
declare global {
	namespace Express {
		interface Request {
			user?: AuthUser;
		}
	}
}

// Middleware to check if user is authenticated
export async function require_auth(req: Request, res: Response, next: NextFunction) {
	const session_id = req.cookies?.session_id;
	const user = await validate_session(session_id);

	if (!user) {
		return res.redirect('/login');
	}

	req.user = user;
	next();
}

// Middleware to add user to request if available (optional auth)
export async function optional_auth(req: Request, res: Response, next: NextFunction) {
	const session_id = req.cookies?.session_id;
	const user = await validate_session(session_id);

	if (user) {
		req.user = user;
	}

	next();
}

// Middleware to redirect authenticated users away from login page
export async function redirect_if_authenticated(req: Request, res: Response, next: NextFunction) {
	const session_id = req.cookies?.session_id;
	const user = await validate_session(session_id);

	if (user) {
		return res.redirect('/');
	}

	next();
}