import { db } from '$lib/server/db';
import { media } from '$lib/server/db/schema';
import type { RequestHandler } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

export const GET = (async ({ params, setHeaders }) => {
	const [mediaRepresentation] = await db
		.select()
		.from(media)
		.where(eq(media.id, params.id || ''))
		.limit(1);

	if (!mediaRepresentation) {
		error(404, 'Media non trouvé');
	}

	const byteArray = Uint8Array.from(mediaRepresentation.content as Buffer);

	setHeaders({
		'Content-Type': mediaRepresentation.type,
		'Content-Length': byteArray.length.toString(),
		'Cache-Control': 'public, max-age=600'
	});

	return new Response(new Blob([byteArray], { type: mediaRepresentation.type }));
}) satisfies RequestHandler;
