import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { notes } from './schema.ts';

const client = createClient({
	url: 'file:notes.db',
});

export const db = drizzle(client, { schema: { notes } });
