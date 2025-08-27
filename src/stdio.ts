import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { create_server } from './server.ts';

const transport = new StdioServerTransport();
await create_server().connect(transport);
