import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

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
		{
			min: z
				.number()
				.describe('The minimum number the random number should be'),
			max: z
				.number()
				.describe('The maximum number the random number should be'),
		},
		({ min, max }) => {
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							Math.floor(Math.random() * (max - min + 1)) + min
						),
					},
				],
			};
		}
	);

	return server;
}
