import { desc, eq } from 'drizzle-orm';
import express, { Router, type Request, type Response } from 'express';
import { db } from '../db/index.ts';
import type { Note, Tag } from '../db/schema.ts';
import { note_tags, notes, tags } from '../db/schema.ts';

const router: Router = express.Router();

// Helper function to get notes with tags using joins
async function get_notes_with_tags() {
	// First get all notes (or filtered by tag)
	const all = await db
		.select()
		.from(notes)
		.innerJoin(note_tags, eq(note_tags.note_id, notes.id))
		.innerJoin(tags, eq(note_tags.tag_id, tags.id))
		.orderBy(desc(notes.created_at));
	const map = new Map<number, Note & { tags: Tag[] }>();
	for (const row of all) {
		const note = row.notes;
		const tag = row.tags;
		if (!map.has(note.id)) {
			map.set(note.id, { ...note, tags: [] });
		}
		map.get(note.id)!.tags.push(tag);
	}
	return [...map.values()];
}

// Generate HTML page
function generate_html(
	notes_list: Array<Note & { tags: Tag[] }>,
	message?: string
) {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Simple Notes App</title>
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
			background-color: #0f0f23;
			padding: 20px;
			min-height: 100vh;
		}
		
		.container {
			max-width: 800px;
			margin: 0 auto;
		}
		
		h1 {
			text-align: center;
			margin-bottom: 30px;
			color: #f8fafc;
			text-shadow: 0 2px 4px rgba(0,0,0,0.3);
		}
		
		.message {
			background-color: #166534;
			color: #bbf7d0;
			padding: 12px;
			border-radius: 8px;
			margin-bottom: 20px;
			border: 1px solid #15803d;
			box-shadow: 0 2px 8px rgba(0,0,0,0.2);
		}
		
		.add-note-form {
			background: #1e1e2e;
			padding: 25px;
			border-radius: 12px;
			box-shadow: 0 4px 12px rgba(0,0,0,0.4);
			margin-bottom: 30px;
			border: 1px solid #2a2a3a;
		}
		
		.form-group {
			margin-bottom: 15px;
		}
		
		label {
			display: block;
			margin-bottom: 8px;
			font-weight: 600;
			color: #cbd5e1;
			font-size: 14px;
		}
		
		input[type="text"], textarea {
			width: 100%;
			padding: 14px;
			border: 2px solid #374151;
			border-radius: 8px;
			font-size: 16px;
			background-color: #111827;
			color: #f3f4f6;
			transition: all 0.3s ease;
		}
		
		input[type="text"]:focus, textarea:focus {
			outline: none;
			border-color: #3b82f6;
			box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
			background-color: #1f2937;
		}
		
		input[type="text"]::placeholder, textarea::placeholder {
			color: #6b7280;
		}
		
		textarea {
			resize: vertical;
			min-height: 120px;
			font-family: inherit;
		}
		
		.btn {
			background: linear-gradient(135deg, #3b82f6, #1d4ed8);
			color: white;
			padding: 14px 28px;
			border: none;
			border-radius: 8px;
			font-size: 16px;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.3s ease;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}
		
		.btn:hover {
			background: linear-gradient(135deg, #2563eb, #1e40af);
			transform: translateY(-1px);
			box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
		}
		
		.btn-danger {
			background: linear-gradient(135deg, #ef4444, #dc2626);
			padding: 10px 16px;
			font-size: 13px;
			font-weight: 500;
			text-transform: none;
			letter-spacing: normal;
		}
		
		.btn-danger:hover {
			background: linear-gradient(135deg, #dc2626, #b91c1c);
			box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
		}
		
		.notes-list {
			display: grid;
			gap: 24px;
		}
		
		.note-card {
			background: #1e1e2e;
			padding: 24px;
			border-radius: 12px;
			box-shadow: 0 4px 12px rgba(0,0,0,0.4);
			border: 1px solid #2a2a3a;
			transition: all 0.3s ease;
		}
		
		.note-card:hover {
			transform: translateY(-2px);
			box-shadow: 0 8px 20px rgba(0,0,0,0.5);
			border-color: #374151;
		}
		
		.note-header {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			margin-bottom: 16px;
			gap: 16px;
		}
		
		.note-title {
			font-size: 20px;
			font-weight: 700;
			color: #f8fafc;
			margin: 0;
			flex: 1;
			line-height: 1.3;
		}
		
		.note-content {
			margin-bottom: 20px;
			white-space: pre-wrap;
			line-height: 1.7;
			color: #cbd5e1;
			font-size: 15px;
		}
		
		.note-footer {
			display: flex;
			justify-content: space-between;
			align-items: center;
			color: #6b7280;
			font-size: 13px;
			border-top: 1px solid #374151;
			padding-top: 16px;
			font-weight: 500;
		}
		
		.delete-form {
			display: inline;
			flex-shrink: 0;
		}
		
		.no-notes {
			text-align: center;
			color: #6b7280;
			font-style: italic;
			padding: 60px 20px;
			background: #1e1e2e;
			border-radius: 12px;
			border: 2px dashed #374151;
			font-size: 18px;
		}

		.tags-container {
			margin: 12px 0;
		}

		.tag {
			display: inline-block;
			background: var(--tag-color, #3b82f6);
			color: white;
			padding: 4px 8px;
			border-radius: 4px;
			font-size: 12px;
			font-weight: 500;
			margin-right: 6px;
			margin-bottom: 4px;
		}
		
		/* Scrollbar styling for dark mode */
		::-webkit-scrollbar {
			width: 8px;
		}
		
		::-webkit-scrollbar-track {
			background: #1e1e2e;
		}
		
		::-webkit-scrollbar-thumb {
			background: #374151;
			border-radius: 4px;
		}
		
		::-webkit-scrollbar-thumb:hover {
			background: #4b5563;
		}
		
		@media (max-width: 600px) {
			body {
				padding: 16px;
			}
			
			.add-note-form, .note-card {
				padding: 20px;
			}
			
			.note-header {
				flex-direction: column;
				gap: 12px;
			}
			
			h1 {
				font-size: 24px;
				margin-bottom: 24px;
			}
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>📝 Simple Notes App</h1>
		
		${message ? `<div class="message">${message}</div>` : ''}
		
		<form method="POST" action="/" class="add-note-form">
			<div class="form-group">
				<label for="title">Title</label>
				<input type="text" id="title" name="title" required maxlength="100">
			</div>
			<div class="form-group">
				<label for="content">Content</label>
				<textarea id="content" name="content" required maxlength="1000" placeholder="Write your note here..."></textarea>
			</div>
			<div class="form-group">
				<label for="tags">Tags (comma-separated)</label>
				<input type="text" id="tags" name="tags" placeholder="work, personal, important...">
			</div>
			<button class="btn">Add Note</button>
		</form>
		
		<div class="notes-list">
			${
				notes_list.length === 0
					? '<div class="no-notes">No notes yet. Add your first note above!</div>'
					: notes_list
							.map(
								(note) => `
					<div class="note-card">
						<div class="note-header">
							<h2 class="note-title">${escape_html(note.title)}</h2>
							<form method="POST" action="/delete" class="delete-form">
								<button name="id" value="${note.id}" class="btn btn-danger">Delete</button>
							</form>
						</div>
						<div class="note-content">${escape_html(note.content)}</div>
						${
							note.tags && note.tags.length > 0
								? `
							<div class="tags-container">
								${note.tags
									.map(
										(tag: any) => `
									<span class="tag" style="--tag-color: ${tag.color}">${escape_html(
											tag.name
										)}</span>
								`
									)
									.join('')}
							</div>
						`
								: ''
						}
						<div class="note-footer">
							<span>Created: ${format_date(note.created_at)}</span>
						</div>
					</div>
				`
							)
							.join('')
			}
		</div>
	</div>
</body>
</html>`;
}

// Utility functions
function escape_html(text: string): string {
	const div = { innerHTML: '', textContent: text } as any;
	return (
		div.innerHTML ||
		text.replace(
			/[&<>"']/g,
			(m: string) =>
				({
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#39;',
				}[m] || m)
		)
	);
}

function format_date(date_string: string): string {
	return new Date(date_string).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

// Routes
router.get('/', async (req: Request, res: Response) => {
	try {
		// Get notes with tags using helper function
		const notes_list = await get_notes_with_tags();

		const html = generate_html(notes_list);
		res.send(html);
	} catch (error) {
		console.error('Error fetching notes:', error);
		res.status(500).send('Error loading notes');
	}
});

router.post('/', async (req: Request, res: Response) => {
	const { title, content, tags: tags_string } = req.body;

	if (!title || !content) {
		// Get notes with tags for error display
		const notes_list = await get_notes_with_tags();
		const html = generate_html(
			notes_list,
			'Please fill in both title and content'
		);
		return res.send(html);
	}

	try {
		// Create the note
		const [created_note] = await db
			.insert(notes)
			.values({
				title: title.trim(),
				content: content.trim(),
			})
			.returning();

		// Handle tags if provided
		if (created_note && tags_string?.trim()) {
			const tag_names = tags_string
				.split(',')
				.map((tag: string) => tag.trim())
				.filter((tag: string) => tag);

			for (const tag_name of tag_names) {
				// Get or create tag
				let tag = await db
					.select()
					.from(tags)
					.where(eq(tags.name, tag_name))
					.get();
				if (!tag) {
					[tag] = await db
						.insert(tags)
						.values({ name: tag_name })
						.returning();
				}
				// Link note to tag
				await db
					.insert(note_tags)
					.values({ note_id: created_note.id, tag_id: tag!.id });
			}
		}

		res.redirect('/');
	} catch (error) {
		console.error('Error creating note:', error);
		// Get notes with tags for error display
		const notes_list = await get_notes_with_tags();
		const html = generate_html(notes_list, 'Error creating note');
		res.send(html);
	}
});

router.post('/delete', async (req: Request, res: Response) => {
	const { id } = req.body;

	if (!id) {
		return res.redirect('/');
	}

	try {
		await db.delete(notes).where(eq(notes.id, parseInt(id)));
		res.redirect('/');
	} catch (error) {
		console.error('Error deleting note:', error);
		// Get notes with tags for error display
		const notes_list = await get_notes_with_tags();
		const html = generate_html(notes_list, 'Error deleting note');
		res.send(html);
	}
});

export default router;
