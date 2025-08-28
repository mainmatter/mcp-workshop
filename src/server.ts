import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import { db } from './db/index.ts';
import { notes } from './db/schema.ts';
import { eq } from 'drizzle-orm';

const NoteSchema = z.object({
	id: z.number(),
	title: z.string(),
	content: z.string(),
	created_at: z.string(),
	updated_at: z.string(),
});

export function create_server() {
	const server = new McpServer(
		{
			name: 'Math MCP Server',
			description: 'A server that provides mathematical computations.',
			version: '1.0.0',
		},
		{
			capabilities: {
				tools: {},
			},
		}
	);

	server.registerTool(
		'get-notes',
		{
			description: 'Get the list of all the notes',
			title: "Get user's notes",
			outputSchema: {
				notes: z.array(NoteSchema),
			},
		},
		async () => {
			const all_notes = await db.select().from(notes).all();
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({ notes: all_notes }),
					},
				],
				structuredContent: { notes: all_notes },
			};
		}
	);

	server.registerTool(
		'create-note',
		{
			description: 'Create a brand new note',
			title: 'Create a new note in the notes app',
			inputSchema: {
				title: z.string().describe('The title of the note'),
				content: z.string().describe('The content of the note'),
			},
			outputSchema: {
				created: NoteSchema,
			},
		},
		async ({ content, title }) => {
			const [created] = await db
				.insert(notes)
				.values({ content, title })
				.returning();
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({ created }),
					},
				],
				structuredContent: { created },
			};
		}
	);

	server.registerTool(
		'update-note',
		{
			description:
				'Update a note, must be called when the user asks to update a note instead of creating a new one',
			title: 'Update a user note given its ID',
			inputSchema: {
				id: z.number().describe('The ID of the note to update'),
				title: z.string().optional().describe('The title of the note'),
				content: z
					.string()
					.optional()
					.describe('The content of the note'),
			},
			outputSchema: {
				updated: NoteSchema,
			},
		},
		async ({ content, title, id }) => {
			const [updated] = await db
				.update(notes)
				.set({ content, title })
				.where(eq(notes.id, id))
				.returning();
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({ updated }),
					},
				],
				structuredContent: { updated },
			};
		}
	);

	server.registerTool(
		'delete-note',
		{
			description: 'Delete a note',
			title: 'Delete a user note given its ID',
			inputSchema: {
				id: z.number().describe('The ID of the note to delete'),
			},
		},
		async ({ id }) => {
			await db.delete(notes).where(eq(notes.id, id)).execute();
			return {
				content: [],
			};
		}
	);

	return server;
}
