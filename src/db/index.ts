import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { users, sessions, notes, tags, note_tags, oauth_clients, oauth_authorization_codes, oauth_access_tokens } from './schema.ts';

const client = createClient({
	url: 'file:notes.db',
});

export const db = drizzle(client, { schema: { users, sessions, notes, tags, note_tags, oauth_clients, oauth_authorization_codes, oauth_access_tokens } });
