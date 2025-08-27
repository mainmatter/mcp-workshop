import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

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

	server.tool(
		'random-number',
		'Generate a random number between 0 and 100',
		() => {
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(Math.floor(Math.random() * 100)),
					},
				],
			};
		}
	);

	return server;
}
