import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import notes from './notes/index.ts';
import { create_server } from './server.ts';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount notes router
app.use('/', notes);

const transports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req, res) => {
	try {
		// Create a new SSE transport for the client
		// The endpoint for POST messages is '/messages'
		const transport = new SSEServerTransport('/messages', res);

		// Store the transport by session ID
		const session_id = transport.sessionId;
		transports.set(session_id, transport);

		// Set up onclose handler to clean up transport when closed
		transport.onclose = () => {
			transports.delete(session_id);
		};

		// Connect the transport to the MCP server
		const server = create_server();
		await server.connect(transport);
	} catch {
		if (!res.headersSent) {
			res.status(500).send('Error establishing SSE stream');
		}
	}
});

app.post('/messages', async (req, res) => {
	const session_id = req.query.sessionId as string | undefined;

	if (!session_id) {
		res.status(400).send('Missing sessionId parameter');
		return;
	}

	const transport = transports.get(session_id);
	if (!transport) {
		res.status(404).send('Session not found');
		return;
	}

	try {
		await transport.handlePostMessage(req, res, req.body);
	} catch {
		if (!res.headersSent) {
			res.status(500).send('Error handling request');
		}
	}
});

const PORT = 3000;

app.listen(PORT, (error) => {
	if (error) {
		console.error('Failed to start server:', error);
		process.exit(1);
	}
	console.log(
		`MCP Stateless Streamable HTTP Server listening on port ${PORT}`
	);
});
