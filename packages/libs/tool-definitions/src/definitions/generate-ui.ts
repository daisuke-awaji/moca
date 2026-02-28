import { z } from 'zod';
import { zodToJsonSchema } from '../utils/schema-converter.js';
import type { ToolDefinition } from '../types.js';

export const generateUiSchema = z.object({
  mode: z
    .enum(['spec', 'code'])
    .describe(
      'Execution mode. "spec": provide a json-render UI spec directly. "code": provide code that generates a json-render UI spec via stdout.'
    ),
  spec: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'json-render UI spec JSON object (required when mode="spec"). Must follow the flat element tree format with "root" and "elements" keys.'
    ),
  code: z
    .string()
    .optional()
    .describe(
      'Code that generates a json-render UI spec and prints it to stdout as JSON (required when mode="code"). The code should print ONLY the JSON spec, nothing else.'
    ),
  language: z
    .enum(['python', 'javascript', 'typescript'])
    .optional()
    .describe('Programming language for the code (used when mode="code", default: "python")'),
  sessionName: z
    .string()
    .optional()
    .describe(
      'CodeInterpreter session name (used when mode="code"). Reuse an existing session to access previously uploaded files.'
    ),
});

export const generateUiDefinition: ToolDefinition<typeof generateUiSchema> = {
  name: 'generate_ui',
  description:
    'Generate rich UI components for display in the chat interface. ' +
    'Use this tool to render structured data as tables, metric cards, and other visual components. ' +
    'Two modes are available:\n' +
    '- "spec" mode: Provide a json-render UI spec directly (for simple/static UI)\n' +
    '- "code" mode: Provide code that reads data files and generates a UI spec (for data-heavy scenarios like CSV/DB queries - saves tokens)\n\n' +
    'The UI spec uses a flat element tree format:\n' +
    '```json\n' +
    '{\n' +
    '  "root": "root_key",\n' +
    '  "elements": {\n' +
    '    "root_key": { "type": "Stack", "props": { "gap": 4 }, "children": ["child1"] },\n' +
    '    "child1": { "type": "DataTable", "props": { "columns": ["A","B"], "rows": [["1","2"]] }, "children": [] }\n' +
    '  }\n' +
    '}\n' +
    '```\n\n' +
    'Available components:\n' +
    '- Stack: Vertical layout container. Props: { gap?: number }. Has children.\n' +
    '- Grid: Grid layout container. Props: { cols?: number, gap?: number }. Has children.\n' +
    '- DataTable: Table display. Props: { columns: string[], rows: string[][], caption?: string }.\n' +
    '- MetricCard: KPI/metric display. Props: { title: string, value: string, description?: string, change?: string, changeType?: "positive"|"negative"|"neutral" }.\n\n' +
    'In "code" mode, the code runs in a sandboxed CodeInterpreter. Print ONLY the JSON spec to stdout.',
  zodSchema: generateUiSchema,
  jsonSchema: zodToJsonSchema(generateUiSchema),
};
