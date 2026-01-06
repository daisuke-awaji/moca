/**
 * Built-in Agent Tools Definition
 * Tools implemented directly in the agent package
 */

/**
 * MCP Tool type definition
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Built-in tool definitions (Agent local tools)
 * Tools implemented directly in the agent, not in AgentCore Gateway
 */
export const BUILTIN_TOOLS: MCPTool[] = [
  {
    name: 'execute_command',
    description:
      'Execute shell commands and return results. Can be used for file operations, information gathering, and development task automation.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute',
        },
        workingDirectory: {
          type: 'string',
          description: 'Working directory (defaults to current directory if not specified)',
        },
        timeout: {
          type: 'number',
          minimum: 1000,
          maximum: 60000,
          default: 30000,
          description: 'Timeout in milliseconds (default: 30s, max: 60s)',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'tavily_search',
    description:
      'Execute high-quality web search using Tavily API. Get comprehensive search results for latest information, news, and general topics.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (required)',
        },
        searchDepth: {
          type: 'string',
          enum: ['basic', 'advanced'],
          default: 'basic',
          description: 'Search depth. basic uses 1 credit, advanced uses 2 credits',
        },
        topic: {
          type: 'string',
          enum: ['general', 'news', 'finance'],
          default: 'general',
          description: 'Search category. news for latest information, general for general search',
        },
        maxResults: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 5,
          description: 'Maximum number of search results to retrieve (1-20)',
        },
        includeAnswer: {
          type: 'boolean',
          default: true,
          description: 'Include LLM-generated summary answer',
        },
        timeRange: {
          type: 'string',
          enum: ['day', 'week', 'month', 'year', 'd', 'w', 'm', 'y'],
          description: 'Time range filter (filter by past period)',
        },
        includeDomains: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'List of domains to include in search',
        },
        excludeDomains: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'List of domains to exclude from search',
        },
        includeImages: {
          type: 'boolean',
          default: false,
          description: 'Retrieve related images as well',
        },
        country: {
          type: 'string',
          description: 'Prioritize results from specific country (e.g., japan, united states)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'tavily_extract',
    description:
      'Extract content from specified URLs using Tavily API. Get webpage content as structured text.',
    inputSchema: {
      type: 'object',
      properties: {
        urls: {
          oneOf: [
            { type: 'string' },
            {
              type: 'array',
              items: { type: 'string' },
            },
          ],
          description: 'URL(s) to extract from (single URL or array of URLs)',
        },
        query: {
          type: 'string',
          description: 'Query for reranking. When specified, prioritizes more relevant content',
        },
        extractDepth: {
          type: 'string',
          enum: ['basic', 'advanced'],
          default: 'basic',
          description: 'Extraction depth. basic: 1 credit/5 URLs, advanced: 2 credits/5 URLs',
        },
        format: {
          type: 'string',
          enum: ['markdown', 'text'],
          default: 'markdown',
          description: 'Output format. markdown or text',
        },
        chunksPerSource: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          default: 3,
          description: 'Number of chunks per source (1-5, only effective when query is specified)',
        },
        includeImages: {
          type: 'boolean',
          default: false,
          description: 'Whether to include image information',
        },
        timeout: {
          type: 'number',
          minimum: 1,
          maximum: 60,
          default: 30,
          description: 'Timeout in seconds (1-60)',
        },
      },
      required: ['urls'],
    },
  },
  {
    name: 'tavily_crawl',
    description:
      'Comprehensively crawl websites using Tavily API. Starting from specified root URL, automatically discovers and extracts related pages.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Starting URL for crawl',
        },
        instructions: {
          type: 'string',
          description: 'Crawl instructions (natural language). Specifying doubles the usage cost',
        },
        maxDepth: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          default: 1,
          description: 'Maximum exploration depth (1-5, how far from base URL)',
        },
        maxBreadth: {
          type: 'number',
          minimum: 1,
          default: 20,
          description: 'Maximum number of links per page (1 or more)',
        },
        limit: {
          type: 'number',
          minimum: 1,
          default: 50,
          description: 'Maximum number of links to process (1 or more)',
        },
        selectPaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Regex patterns for paths to include (e.g., ["/docs/.*", "/api/v1.*"])',
        },
        selectDomains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Regex patterns for domains to include (e.g., ["^docs\\.example\\.com$"])',
        },
        excludePaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Regex patterns for paths to exclude (e.g., ["/private/.*", "/admin/.*"])',
        },
        excludeDomains: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Regex patterns for domains to exclude (e.g., ["^private\\.example\\.com$"])',
        },
        allowExternal: {
          type: 'boolean',
          default: true,
          description: 'Whether to include external domain links in results',
        },
        extractDepth: {
          type: 'string',
          enum: ['basic', 'advanced'],
          default: 'basic',
          description:
            'Extraction depth. basic: 1 credit/5 extractions, advanced: 2 credits/5 extractions',
        },
        format: {
          type: 'string',
          enum: ['markdown', 'text'],
          default: 'markdown',
          description: 'Output format. markdown or text',
        },
        includeImages: {
          type: 'boolean',
          default: false,
          description: 'Whether to include image information',
        },
        chunksPerSource: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          default: 3,
          description:
            'Number of chunks per source (1-5, only effective when instructions is specified)',
        },
        timeout: {
          type: 'number',
          minimum: 10,
          maximum: 150,
          default: 150,
          description: 'Timeout in seconds (10-150)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'code_interpreter',
    description:
      'Amazon Bedrock AgentCore CodeInterpreter tool - Execute code and perform file operations in a secure sandbox environment. Provides capabilities for Python, JavaScript, TypeScript code execution, shell command execution, file operations (read, write, delete), and session management.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'initSession',
            'executeCode',
            'executeCommand',
            'readFiles',
            'listFiles',
            'removeFiles',
            'writeFiles',
            'downloadFiles',
            'listLocalSessions',
          ],
          description: 'Operation to execute',
        },
        sessionName: {
          type: 'string',
          description: 'Session name (defaults to default if omitted)',
        },
        description: {
          type: 'string',
          description: 'Session description (for initSession)',
        },
        language: {
          type: 'string',
          enum: ['python', 'javascript', 'typescript'],
          description: 'Language for code execution',
        },
        code: {
          type: 'string',
          description: 'Code to execute',
        },
        clearContext: {
          type: 'boolean',
          default: false,
          description: 'Whether to clear context',
        },
        command: {
          type: 'string',
          description: 'Shell command to execute',
        },
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file paths',
        },
        path: {
          type: 'string',
          description: 'Directory path',
        },
        content: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              text: { type: 'string' },
            },
            required: ['path', 'text'],
          },
          description: 'Array of files to write',
        },
        sourcePaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file paths to download',
        },
        destinationDir: {
          type: 'string',
          description: 'Download destination directory (absolute path)',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 's3_list_files',
    description:
      "Retrieve list of files and directories in user's S3 storage. Can explore contents under specified path.",
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          default: '/',
          description: 'Directory path to list (default: root "/")',
        },
        recursive: {
          type: 'boolean',
          default: false,
          description: 'Whether to recursively include subdirectories (default: false)',
        },
        maxResults: {
          type: 'number',
          minimum: 1,
          maximum: 1000,
          default: 100,
          description: 'Maximum number of results to retrieve (1-1000, default: 100)',
        },
      },
      required: [],
    },
  },
  {
    name: 'file_editor',
    description:
      'Edit or create new files. For moving or renaming files, use the mv command with the execute_command tool. Before use, confirm file contents with the cat command, and for new files, check the directory with the ls command. Replaces text specified in oldString with newString. oldString must be unique within the file and must match exactly including whitespace and indentation. Can only change one location at a time; for multiple changes, call multiple times.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute path of the file to edit (relative paths not allowed)',
        },
        oldString: {
          type: 'string',
          description:
            'Text to replace. Must be unique within the file and must match exactly including whitespace and indentation. Specify empty string to create a new file.',
        },
        newString: {
          type: 'string',
          description:
            'Replacement text. For new file creation, this content will be written to the file.',
        },
      },
      required: ['filePath', 'oldString', 'newString'],
    },
  },
  {
    name: 'nova_canvas',
    description:
      'Generate images using Amazon Nova Canvas on Bedrock. Convert text prompts into high-quality images with configurable size and seed for reproducibility. Automatically saves generated images to user S3 storage.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          minLength: 1,
          maxLength: 1024,
          description:
            'Text prompt describing the image to generate (required, max 1024 characters)',
        },
        width: {
          type: 'number',
          enum: [512, 768, 1024],
          default: 512,
          description: 'Image width in pixels (512, 768, or 1024, default: 512)',
        },
        height: {
          type: 'number',
          enum: [512, 768, 1024],
          default: 512,
          description: 'Image height in pixels (512, 768, or 1024, default: 512)',
        },
        numberOfImages: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          default: 1,
          description: 'Number of images to generate (1-5, default: 1)',
        },
        seed: {
          type: 'number',
          minimum: 0,
          maximum: 858993459,
          description: 'Random seed for reproducible generation (0-858993459, optional)',
        },
        saveToS3: {
          type: 'boolean',
          default: true,
          description: 'Whether to save generated images to S3 storage (default: true)',
        },
        outputPath: {
          type: 'string',
          description: 'Custom output filename (default: auto-generated with timestamp)',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'image_to_text',
    description:
      'Analyze images and convert them to text descriptions using Bedrock Converse API. Supports S3 URIs and local file paths. Use vision-capable models to extract text, describe content, or analyze images. Useful for OCR, image understanding, and visual content analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        imagePath: {
          type: 'string',
          minLength: 1,
          description:
            'Image path: S3 URI (s3://bucket/key) or local file path (/absolute/path or ./relative/path)',
        },
        prompt: {
          type: 'string',
          default: 'Describe this image in detail.',
          description: 'Analysis prompt for the image (default: describe the image)',
        },
        modelId: {
          type: 'string',
          enum: [
            'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
            'global.anthropic.claude-haiku-4-5-20251001-v1:0',
            'global.amazon.nova-2-lite-v1:0',
          ],
          default: 'global.amazon.nova-2-lite-v1:0',
          description:
            'Vision model to use (global inference profile). Options: Claude Sonnet 4.5 (high accuracy), Claude Haiku 4.5 (balanced), Nova 2 Lite (fast, default)',
        },
      },
      required: ['imagePath'],
    },
  },
  {
    name: 'call_agent',
    description:
      'Invoke specialized sub-agents asynchronously to handle specific tasks requiring different expertise. Use list_agents first to discover available agents, then start_task to invoke them. Sub-agents run independently with no shared history and can run for extended periods.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list_agents', 'start_task', 'status'],
          description:
            "Action to perform: 'list_agents' to discover available agents, 'start_task' to start new task, 'status' to check task status",
        },
        agentId: {
          type: 'string',
          description:
            'Agent ID to invoke (required for start_task). Use list_agents action first to discover available agent IDs.',
        },
        query: {
          type: 'string',
          description: 'Query or task to send to the agent (required for start_task)',
        },
        modelId: {
          type: 'string',
          description: 'Model ID to use for the sub-agent (optional, defaults to agent config)',
        },
        taskId: {
          type: 'string',
          description: 'Task ID to check (required for status action)',
        },
        waitForCompletion: {
          type: 'boolean',
          default: false,
          description: 'Whether to wait for task completion with polling (default: false)',
        },
        pollingInterval: {
          type: 'number',
          default: 30,
          description: 'Polling interval in seconds (default: 30)',
        },
        maxWaitTime: {
          type: 'number',
          default: 1200,
          description: 'Maximum wait time in seconds (default: 1200 = 20 minutes)',
        },
        storagePath: {
          type: 'string',
          description:
            "S3 storage path for the sub-agent workspace. If omitted, inherits the parent agent's storage path. Use this to share files between agents or specify a different workspace.",
        },
      },
      required: ['action'],
    },
  },
];
