import { sql } from 'drizzle-orm';
import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from 'drizzle-orm/sqlite-core';

// WARNING: This stores passwords in plain text - NOT SECURE for production use!
// In a real application, passwords should be hashed using bcrypt or similar
export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	username: text('username').notNull().unique(),
	password: text('password').notNull(), // Plain text - NOT SECURE!
	created_at: text('created_at')
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(), // UUID session ID
	user_id: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expires_at: text('expires_at').notNull(),
	created_at: text('created_at')
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

export const notes = sqliteTable('notes', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	title: text('title').notNull(),
	content: text('content').notNull(),
	user_id: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	created_at: text('created_at')
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updated_at: text('updated_at')
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

export const tags = sqliteTable('tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	color: text('color').default('#3b82f6'),
	created_at: text('created_at')
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

export const note_tags = sqliteTable(
	'note_tags',
	{
		note_id: integer('note_id')
			.notNull()
			.references(() => notes.id, { onDelete: 'cascade' }),
		tag_id: integer('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' }),
	},
	(table) => [primaryKey({ columns: [table.note_id, table.tag_id] })]
);

// OAuth tables for MCP authentication
export const oauth_clients = sqliteTable('oauth_clients', {
	id: text('id').primaryKey(), // client_id
	client_secret: text('client_secret'),
	client_name: text('client_name').notNull(),
	redirect_uris: text('redirect_uris').notNull(), // JSON array as string
	created_at: text('created_at')
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

export const oauth_authorization_codes = sqliteTable('oauth_authorization_codes', {
	id: text('id').primaryKey(), // authorization code
	client_id: text('client_id')
		.notNull()
		.references(() => oauth_clients.id, { onDelete: 'cascade' }),
	user_id: integer('user_id')
		.references(() => users.id, { onDelete: 'cascade' }),
	scopes: text('scopes'), // JSON array as string
	code_challenge: text('code_challenge'),
	code_challenge_method: text('code_challenge_method'),
	state: text('state'),
	expires_at: text('expires_at').notNull(),
	created_at: text('created_at')
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

export const oauth_access_tokens = sqliteTable('oauth_access_tokens', {
	id: text('id').primaryKey(), // access token
	client_id: text('client_id')
		.notNull()
		.references(() => oauth_clients.id, { onDelete: 'cascade' }),
	user_id: integer('user_id')
		.references(() => users.id, { onDelete: 'cascade' }),
	scopes: text('scopes'), // JSON array as string
	expires_at: text('expires_at'),
	created_at: text('created_at')
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type NoteTag = typeof note_tags.$inferSelect;
export type NewNoteTag = typeof note_tags.$inferInsert;
export type OAuthClient = typeof oauth_clients.$inferSelect;
export type NewOAuthClient = typeof oauth_clients.$inferInsert;
export type OAuthAuthorizationCode = typeof oauth_authorization_codes.$inferSelect;
export type NewOAuthAuthorizationCode = typeof oauth_authorization_codes.$inferInsert;
export type OAuthAccessToken = typeof oauth_access_tokens.$inferSelect;
export type NewOAuthAccessToken = typeof oauth_access_tokens.$inferInsert;
