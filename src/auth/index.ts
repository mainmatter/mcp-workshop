import { eq, lt } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { users, sessions, type User, type Session } from '../db/schema.ts';
import crypto from 'crypto';

export interface AuthUser {
	id: number;
	username: string;
}

// Create a new session for a user
export async function create_session(user_id: number): Promise<string> {
	const session_id = crypto.randomUUID();
	const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

	await db.insert(sessions).values({
		id: session_id,
		user_id,
		expires_at,
	});

	return session_id;
}

// Validate a session and return the user if valid
export async function validate_session(
	session_id: string | undefined
): Promise<AuthUser | null> {
	if (!session_id) return null;

	const session = await db
		.select({
			id: sessions.id,
			user_id: sessions.user_id,
			expires_at: sessions.expires_at,
			username: users.username,
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.user_id, users.id))
		.where(eq(sessions.id, session_id))
		.get();

	if (!session) return null;

	// Check if session has expired
	if (new Date(session.expires_at) < new Date()) {
		// Delete expired session
		await db.delete(sessions).where(eq(sessions.id, session_id));
		return null;
	}

	return {
		id: session.user_id,
		username: session.username,
	};
}

// Delete a session (logout)
export async function delete_session(session_id: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, session_id));
}

// Register a new user
export async function register_user(
	username: string,
	password: string
): Promise<AuthUser | null> {
	try {
		// Check if username already exists
		const existing_user = await db
			.select()
			.from(users)
			.where(eq(users.username, username))
			.get();

		if (existing_user) {
			return null; // Username already exists
		}

		// Create new user
		const [new_user] = await db
			.insert(users)
			.values({
				username: username.trim(),
				password: password, // Plain text - NOT SECURE!
			})
			.returning();

		if (!new_user) {
			throw new Error('Failed to create user');
		}

		return {
			id: new_user.id,
			username: new_user.username,
		};
	} catch (error) {
		console.error('Error registering user:', error);
		return null;
	}
}

// Login user
export async function login_user(
	username: string,
	password: string
): Promise<AuthUser | null> {
	const user = await db
		.select()
		.from(users)
		.where(eq(users.username, username))
		.get();

	if (!user) return null;

	// Plain text password comparison - NOT SECURE!
	if (user.password !== password) {
		return null;
	}

	return {
		id: user.id,
		username: user.username,
	};
}

// Clean up expired sessions
export async function cleanup_expired_sessions(): Promise<void> {
	const now = new Date().toISOString();
	await db.delete(sessions).where(lt(sessions.expires_at, now));
}
