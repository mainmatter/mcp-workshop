import {
	McpServer,
	ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
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

	server.registerPrompt(
		'notes-prompt',
		{
			description:
				'A prompt that can be used to properly know how to use the notes tools',
			title: 'Notes prompt',
		},
		async () => {
			const all_notes = await db.select().from(notes).all();
			return {
				messages: [
					{
						role: 'user',
						content: {
							type: 'text',
							text: `Whenever I talk about notes I want you to use the notes tools to manage my notes.
Here is a summary of the tools you can use:
- get-notes: to get the list of all my notes
- create-note: to create a new note, you must provide a title and content
- update-note: to update an existing note, you must provide the ID of the note to update, and optionally a new title and/or content
- delete-note: to delete a note, you must provide the ID of the note to delete
Use these tools whenever I talk about notes, do not try to answer by yourself and do not use any other tool.

Here's the list of all my current notes:

${JSON.stringify(all_notes, null, 2)}

In any moment you can use the get-notes tool to get the updated list of notes.

Pay very careful attention to not create a new note when I want to update an existing one, in that case you must use the update-note tool providing the ID of the note to update.

Pay very careful attention to not delete a note that I don't specifically ask you to delete.
`,
						},
					},
				],
			};
		}
	);

	server.registerPrompt(
		'update-note-prompt',
		{
			description: 'A prompt that can be used to modify a specific note',
			title: 'Modify a note',
			argsSchema: {
				id: z.string().describe('The ID of the note to modify'),
			},
		},
		async ({ id }) => {
			const note = await db
				.select()
				.from(notes)
				.where(eq(notes.id, +id))
				.get();
			return {
				messages: [
					{
						role: 'user',
						content: {
							type: 'text',
							text: `I want to modify the note with ID ${id}.
							
Here's the current content of the note: 

<content>
${note?.content}
</content> 

and the current title: 
<title>
${note?.title}
</title>

you should modify it like this (and please bugle check that you are modifying exactly this note): `,
						},
					},
				],
			};
		}
	);

	server.registerResource(
		'all-notes',
		'notes://all.json',
		{
			description: "All the user's notes",
			title: "User's notes",
		},
		async (uri) => {
			const all_notes = await db.select().from(notes).all();
			return {
				contents: [
					{
						uri: uri.toString(),
						mimeType: 'application/json',
						text: JSON.stringify(all_notes),
					},
				],
			};
		}
	);

	server.registerResource(
		'single-note',
		new ResourceTemplate('notes://note/{id}.json', {
			list: async () => {
				const all_notes = await db.select().from(notes).all();
				return {
					resources: all_notes.map((note) => ({
						name: `single-note-${note.id}`,
						uri: `notes://note/${note.id}.json`,
						title: note.title,
						description: note.content.slice(0, 100),
					})),
				};
			},
		}),
		{
			description: 'A single user note',
			title: 'A defined user note',
		},
		async (uri, { id }) => {
			const note = await db
				.select()
				.from(notes)
				.where(eq(notes.id, +(id ?? 0)))
				.get();
			return {
				contents: [
					{
						uri: uri.toString(),
						mimeType: 'application/json',
						text: JSON.stringify(note),
					},
				],
			};
		}
	);

	return server;
}
