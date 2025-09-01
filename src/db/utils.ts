import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { note_tags, notes, tags, type Note, type Tag } from './schema.ts';

// Helper function to get notes with tags using joins
export async function get_notes_with_tags() {
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

export async function create_tag_for_note(
	tags_string: string,
	created_note: number
) {
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
			.values({ note_id: created_note, tag_id: tag!.id });
	}
}
