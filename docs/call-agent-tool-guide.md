# Call Agent Tool Guide

## Overview

The `call_agent` tool enables agents to invoke other specialized agents asynchronously. This implements the "Agents as Tools" pattern from Strands Agents SDK, allowing hierarchical agent orchestration where a parent agent can delegate tasks to specialized sub-agents.

## Features

- **Asynchronous Execution**: Sub-agents run in background, allowing long-running tasks (minutes to hours)
- **Polling Support**: Optional polling to wait for task completion
- **Independent Sessions**: Sub-agents have no shared history with parent
- **Shared Storage**: Sub-agents can share the same S3 storage path for collaborative work
- **Recursion Control**: Maximum depth limit (default: 2 levels)
- **Task Management**: Track and manage multiple concurrent sub-agent tasks
- **API-based Configuration**: Agent definitions fetched dynamically from backend

## Architecture

```
┌─────────────────┐
│  Parent Agent   │
│  (Orchestrator) │
└────────┬────────┘
         │ call_agent(action='start_task')
         ▼
┌─────────────────┐
│ TaskManager     │ ← In-memory task state
│ (Background)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Sub-Agent     │ ← Independent execution
│ (Specialized)   │    No shared history
└─────────────────┘
```

## Usage

### 1. Discovering Available Agents

First, list available agents to get their IDs and descriptions:

```typescript
{
  action: 'list_agents'
}
```

**Response:**
```json
{
  "agents": [
    {
      "agentId": "web-researcher",
      "name": "Web Researcher",
      "description": "Deep web research and information gathering"
    },
    {
      "agentId": "software-developer",
      "name": "Software Developer",
      "description": "Software development tasks"
    }
    // ... more agents
  ],
  "count": 11
}
```

### 2. Starting a Sub-Agent Task

```typescript
{
  action: 'start_task',
  agentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // UUID from list_agents
  query: 'Research the latest AI developments in 2025',
  modelId: 'anthropic.claude-sonnet-4-5-20250929-v1:0', // Optional
  storagePath: '/project-a/' // Optional: S3 storage path (inherits from parent if not specified)
}
```

**Response:**
```json
{
  "taskId": "task_1234567890_abc123def",
  "status": "started",
  "agentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Sub-agent task started. Use call_agent with action='status' and taskId=\"task_xxx\" to check results."
}
```

### 3. Checking Task Status (Immediate)

```typescript
{
  action: 'status',
  taskId: 'task_1234567890_abc123def',
  waitForCompletion: false
}
```

**Response (Running):**
```json
{
  "taskId": "task_1234567890_abc123def",
  "status": "running",
  "agentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "progress": "Executing query...",
  "elapsedTime": 45
}
```

**Response (Completed):**
```json
{
  "taskId": "task_1234567890_abc123def",
  "status": "completed",
  "agentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "result": "Research findings: ...",
  "elapsedTime": 180
}
```

### 4. Checking Task Status (With Polling)

```typescript
{
  action: 'status',
  taskId: 'task_1234567890_abc123def',
  waitForCompletion: true,
  pollingInterval: 30,    // Check every 30 seconds
  maxWaitTime: 1200       // Wait up to 20 minutes
}
```

**Response (After Completion):**
```json
{
  "taskId": "task_1234567890_abc123def",
  "status": "completed",
  "agentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "result": "Research findings: ...",
  "elapsedTime": 180,
  "pollCount": 6
}
```

## Discovering Available Agents

**Important**: Agent IDs are now dynamically generated as UUIDs. Always use the `list_agents` action first to discover available agents and their IDs.

### Default Agent Types

The system includes these default agent types (actual IDs are UUIDs):

| Agent Name | Specialization |
|-----------|----------------|
| General Assistant | General-purpose Q&A and assistance |
| Code Reviewer | Code review and analysis |
| Knowledge Base Search | Search knowledge bases with semantic retrieval |
| Data Analyst | Data analysis and visualization |
| Web Researcher | Deep web research and information gathering |
| Software Developer | Software development tasks |
| PowerPoint Creator | Presentation creation |
| Physicist | Physics simulations and calculations |
| Image Creator | Image generation with Nova Canvas |
| Slideshow Video Creator | Video creation from images |
| Kamishibai Master | Japanese picture story creation |

**To get actual agent IDs**: Use the `list_agents` action (see examples below).

## Parameters

### list_agents Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | Must be "list_agents" |

**Note:** No additional parameters required. Returns all agents available to the current user.

### start_task Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | Must be "start_task" |
| agentId | string | Yes | UUID of the agent (get from list_agents) |
| query | string | Yes | Task or query to send to the agent |
| modelId | string | No | Model ID override (defaults to agent config) |
| storagePath | string | No | S3 storage path for sub-agent (e.g., "/project-a/"). Inherits from parent if not specified |

### status Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| action | string | Yes | - | Must be "status" |
| taskId | string | Yes | - | Task ID from start_task response |
| waitForCompletion | boolean | No | false | Wait for completion with polling |
| pollingInterval | number | No | 30 | Polling interval in seconds |
| maxWaitTime | number | No | 1200 | Max wait time in seconds (20 min) |

## Task Lifecycle

```
pending → running → completed/failed
  ↑         ↑          ↑
  │         │          └─ Final state
  │         └─ Executing query
  └─ Task created
```

## Safety Features

### 1. Recursion Limit
- Default maximum depth: 2 (parent → child → grandchild)
- Prevents infinite recursion
- Configurable per task

### 2. Concurrent Task Limit
- Maximum 5 concurrent tasks per session
- Prevents resource exhaustion

### 3. Task Expiration
- Tasks expire after 24 hours
- Automatic cleanup of old tasks
- Runs hourly

### 4. Infinite Recursion Prevention
- Sub-agents cannot call themselves
- `call_agent` tool filtered from sub-agent tools

## Implementation Details

### Files Created

1. **`packages/agent/src/services/sub-agent-task-manager.ts`**
   - Task state management
   - Background execution
   - Lifecycle management

2. **`packages/agent/src/services/agent-registry.ts`**
   - Agent definition fetching from backend API
   - Caching (5-minute TTL)
   - Error handling

3. **`packages/agent/src/tools/call-agent.ts`**
   - Main tool implementation
   - Action routing (start_task/status)
   - Polling logic

4. **`packages/agent/src/tools/index.ts`**
   - Tool registration

5. **`packages/backend/src/data/builtin-tools.ts`**
   - Tool definition for frontend display

### Environment Variables

```bash
# Optional: Backend API URL for agent definitions
BACKEND_API_URL=http://localhost:3000
```

## Error Handling

### Common Errors

1. **Agent Not Found**
```json
{
  "error": "Agent not found",
  "message": "Agent \"web-researcher\" not found"
}
```

2. **Maximum Depth Reached**
```json
{
  "error": "Maximum recursion depth reached",
  "message": "Cannot invoke sub-agent at depth 2. Max depth is 2.",
  "currentDepth": 2,
  "maxDepth": 2
}
```

3. **Task Not Found**
```json
{
  "error": "Task not found",
  "message": "No task found with ID: task_xxx"
}
```

4. **Concurrent Task Limit**
```json
{
  "error": "Maximum concurrent tasks (5) reached for this session"
}
```

## Best Practices

### 1. Use Appropriate Wait Strategies

**Short Tasks (< 2 minutes):**
```typescript
{
  action: 'status',
  taskId: 'task_xxx',
  waitForCompletion: true,
  pollingInterval: 10,
  maxWaitTime: 120
}
```

**Long Tasks (> 2 minutes):**
```typescript
// Start task
{ action: 'start_task', ... }

// Check periodically without blocking
{ action: 'status', taskId: 'task_xxx', waitForCompletion: false }
```

### 2. Choose Appropriate Agents

- Use **web-researcher** for information gathering
- Use **code-review** for code analysis
- Use **data-analyst** for data processing
- Use **software-developer** for implementation tasks

### 3. Monitor Task Progress

```typescript
// Check progress without waiting
const status = await callAgent({
  action: 'status',
  taskId: taskId,
  waitForCompletion: false
});

console.log(status.progress); // "Executing query..."
```

### 4. Handle Timeouts Gracefully

```typescript
const result = await callAgent({
  action: 'status',
  taskId: taskId,
  waitForCompletion: true,
  maxWaitTime: 600 // 10 minutes
});

if (result.timedOut) {
  // Task still running, check again later
  console.log('Task still in progress');
}
```

## Storage Path Inheritance

Sub-agents can share the same S3 storage path with their parent agent, enabling collaborative file operations:

### Automatic Inheritance

By default, sub-agents inherit the parent's `storagePath`:

```typescript
// Parent agent has storagePath: "/project-a/"
const result = await callAgent({
  action: 'start_task',
  agentId: 'software-developer-id',
  query: 'Create a README.md file'
  // storagePath automatically inherits "/project-a/"
});

// Sub-agent can read/write files in "/project-a/"
```

### Explicit Override

You can specify a different `storagePath` for the sub-agent:

```typescript
const result = await callAgent({
  action: 'start_task',
  agentId: 'software-developer-id',
  query: 'Create documentation',
  storagePath: '/project-b/docs/' // Use different storage path
});
```

### Benefits

- **Collaborative Work**: Multiple agents can work on the same files
- **File Sharing**: Sub-agents can access files created by parent agent
- **Workspace Sync**: Changes are synced to S3 automatically
- **Consistent Context**: All agents work in the same project directory

### Example: Multi-Agent File Processing

```typescript
// Parent agent orchestrates file processing
async function processProjectFiles() {
  // Step 1: List available agents
  const agents = await callAgent({ action: 'list_agents' });
  const developerId = agents.agents.find(a => a.name.includes('Software Developer'))?.agentId;
  const reviewerId = agents.agents.find(a => a.name.includes('Code Reviewer'))?.agentId;
  
  // Step 2: Developer creates code (inherits parent's storagePath)
  const devTask = await callAgent({
    action: 'start_task',
    agentId: developerId,
    query: 'Create a Python script for data processing'
  });
  
  const devResult = await callAgent({
    action: 'status',
    taskId: devTask.taskId,
    waitForCompletion: true
  });
  
  // Step 3: Reviewer reviews the created code (same storagePath)
  const reviewTask = await callAgent({
    action: 'start_task',
    agentId: reviewerId,
    query: 'Review the Python script and provide feedback'
  });
  
  const reviewResult = await callAgent({
    action: 'status',
    taskId: reviewTask.taskId,
    waitForCompletion: true
  });
  
  return {
    codeCreated: devResult.result,
    reviewFeedback: reviewResult.result
  };
}
```

## Limitations

1. **No Shared History**: Sub-agents have independent sessions
2. **No Streaming**: Results returned only after completion
3. **Memory-based Storage**: Task state lost on agent restart
4. **Single Region**: Agent definitions from single backend instance

## Future Enhancements

- [ ] DynamoDB-based task persistence
- [ ] Cross-region agent invocation
- [ ] Task result streaming
- [ ] Task cancellation support
- [ ] Task prioritization
- [ ] Enhanced monitoring and metrics

## Troubleshooting

### Agent Definition Not Found

**Problem**: `Agent "a1b2c3d4-..." not found`

**Solution**: 
1. Use `list_agents` to get valid agent IDs
2. Verify backend is running and accessible
3. Check `BACKEND_API_URL` environment variable
4. Ensure JWT authentication is working properly

### Task Stuck in Running State

**Problem**: Task shows "running" for extended period

**Solution**:
1. Check agent logs for errors
2. Verify sub-agent has required tools enabled
3. Check for API rate limits or timeouts
4. Task may have failed - check error field in response

### Recursion Depth Error

**Problem**: `Maximum recursion depth reached`

**Solution**:
1. Avoid calling sub-agents from sub-agents
2. Use flat orchestration pattern
3. Increase maxDepth if absolutely necessary

## Examples

### Example 1: Research and Summarize

```typescript
// Parent agent orchestrates research and summarization
async function researchAndSummarize(topic: string) {
  // Step 0: Discover available agents
  const agentsResult = await callAgent({
    action: 'list_agents'
  });
  
  // Find the web researcher agent
  const webResearcher = agentsResult.agents.find(
    a => a.name.includes('Web Researcher')
  );
  
  if (!webResearcher) {
    throw new Error('Web Researcher agent not found');
  }
  
  // Step 1: Start research task
  const startResult = await callAgent({
    action: 'start_task',
    agentId: webResearcher.agentId,
    query: `Research latest developments in ${topic}`
  });
  
  // Step 2: Wait for completion
  const researchResult = await callAgent({
    action: 'status',
    taskId: startResult.taskId,
    waitForCompletion: true,
    maxWaitTime: 300 // 5 minutes
  });
  
  return researchResult.result;
}
```

### Example 2: Parallel Sub-Agent Execution

```typescript
async function parallelResearch(topics: string[]) {
  // Get web researcher agent ID
  const agentsResult = await callAgent({
    action: 'list_agents'
  });
  
  const webResearcherId = agentsResult.agents.find(
    a => a.name.includes('Web Researcher')
  )?.agentId;
  
  if (!webResearcherId) {
    throw new Error('Web Researcher agent not found');
  }
  
  // Start multiple research tasks
  const taskIds = await Promise.all(
    topics.map(topic => 
      callAgent({
        action: 'start_task',
        agentId: webResearcherId,
        query: `Research ${topic}`
      })
    )
  );
  
  // Poll all tasks
  const results = await Promise.all(
    taskIds.map(result =>
      callAgent({
        action: 'status',
        taskId: result.taskId,
        waitForCompletion: true,
        maxWaitTime: 600
      })
    )
  );
  
  return results.map(r => r.result);
}
```

## Support

For issues or questions:
1. Check this documentation
2. Review agent logs
3. Check GitHub issues
4. Create a new issue with reproduction steps
