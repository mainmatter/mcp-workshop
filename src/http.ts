import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Request, type Response } from 'express';
import { create_server } from './server.ts';
import notes from './notes/index.ts';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount notes router
app.use('/', notes);

const transports = new Map<string, StreamableHTTPServerTransport>();

app.post('/mcp', async (req, res) => {
	try {
		const session_id = req.headers['mcp-session-id'] as string | undefined;

		let transport: StreamableHTTPServerTransport;

		if (session_id && transports.has(session_id)) {
			transport = transports.get(session_id)!;
		} else {
			const server = create_server();
			transport = new StreamableHTTPServerTransport({
				sessionIdGenerator: () => crypto.randomUUID(),
				onsessioninitialized(session_id) {
					transports.set(session_id, transport);
				},
			});
			await server.connect(transport);
		}
		await transport.handleRequest(req, res, req.body);
	} catch (error) {
		if (!res.headersSent) {
			res.status(500).json({
				jsonrpc: '2.0',
				error: {
					code: -32603,
					message: 'Internal server error',
				},
				id: null,
			});
		}
	}
});

async function get_or_delete_handler(req: Request, res: Response) {
	const session_id = req.headers['mcp-session-id'] as string | undefined;

	if (!session_id || !transports.has(session_id)) {
		res.status(400).send('Invalid or missing session ID');
		return;
	}

	const transport = transports.get(session_id);
	await transport!.handleRequest(req, res);
}

app.get('/mcp', get_or_delete_handler);

app.delete('/mcp', get_or_delete_handler);

// Start the server
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
