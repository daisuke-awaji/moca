/**
 * Tool State Management Store
 * Manages tool list and search state from AgentCore Gateway
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { MCPTool } from '../api/tools';
import { fetchTools, searchTools, checkGatewayHealth } from '../api/tools';

/**
 * Tool store state type definition
 */
export interface ToolStoreState {
  // Tool list
  tools: MCPTool[];
  isLoading: boolean;
  error: string | null;
  lastFetchTime: string | null;
  nextCursor: string | null; // For pagination

  // Search functionality
  searchQuery: string;
  searchResults: MCPTool[];
  isSearching: boolean;
  searchError: string | null;

  // Gateway connection status
  gatewayHealthy: boolean;
  gatewayStatus: 'unknown' | 'healthy' | 'unhealthy';

  // Actions
  loadTools: () => Promise<void>;
  loadMoreTools: () => Promise<void>; // Load additional pages
  loadAllTools: () => Promise<void>; // Load all tools (for tool selection)
  searchToolsWithQuery: (query: string) => Promise<void>;
  clearSearch: () => void;
  setSearchQuery: (query: string) => void;
  checkGateway: () => Promise<void>;
  clearError: () => void;
}

/**
 * Tool management store
 */
export const useToolStore = create<ToolStoreState>()(
  devtools(
    (set, get) => ({
      // Initial state
      tools: [],
      isLoading: false,
      error: null,
      lastFetchTime: null,
      nextCursor: null,

      searchQuery: '',
      searchResults: [],
      isSearching: false,
      searchError: null,

      gatewayHealthy: false,
      gatewayStatus: 'unknown',

      /**
       * Load tool list (first page)
       */
      loadTools: async () => {
        const currentState = get();

        // Avoid duplicate execution if already loading
        if (currentState.isLoading) {
          console.log('🔧 Tool list already loading, skipping duplicate execution');
          return;
        }

        set({
          isLoading: true,
          error: null,
          gatewayStatus: 'unknown',
          nextCursor: null,
        });

        try {
          console.log('🔧 Tool list loading started');

          const result = await fetchTools();

          set({
            tools: result.tools,
            nextCursor: result.nextCursor || null,
            isLoading: false,
            error: null,
            lastFetchTime: new Date().toISOString(),
            gatewayHealthy: true,
            gatewayStatus: 'healthy',
          });

          console.log(
            '✅ Tool list loading completed: %d items',
            result.tools.length,
            result.nextCursor ? { nextCursor: 'present' } : { nextCursor: 'none' }
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load tool list';

          console.error('💥 Tool list loading error:', error);

          set({
            tools: [],
            nextCursor: null,
            isLoading: false,
            error: errorMessage,
            lastFetchTime: null,
            gatewayHealthy: false,
            gatewayStatus: 'unhealthy',
          });
        }
      },

      /**
       * Load additional page
       */
      loadMoreTools: async () => {
        const currentState = get();

        if (currentState.isLoading || !currentState.nextCursor) {
          console.log('🔧 Cannot load more: loading in progress or no nextCursor');
          return;
        }

        set({
          isLoading: true,
          error: null,
        });

        try {
          console.log('🔧 Loading additional tools started', { cursor: currentState.nextCursor });

          const result = await fetchTools(currentState.nextCursor);

          set({
            tools: [...currentState.tools, ...result.tools], // Add to existing tools
            nextCursor: result.nextCursor || null,
            isLoading: false,
            error: null,
            lastFetchTime: new Date().toISOString(),
            gatewayHealthy: true,
            gatewayStatus: 'healthy',
          });

          console.log(
            '✅ Additional tools loading completed: +%d items (total: %d items)',
            result.tools.length,
            currentState.tools.length + result.tools.length,
            result.nextCursor ? { nextCursor: 'present' } : { nextCursor: 'none' }
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to load additional tools';

          console.error('💥 Additional tools loading error:', error);

          set({
            isLoading: false,
            error: errorMessage,
            gatewayHealthy: false,
            gatewayStatus: 'unhealthy',
          });
        }
      },

      /**
       * Load all tools (for tool selection)
       * Automatically loads all pages while nextCursor exists
       */
      loadAllTools: async () => {
        const currentState = get();

        // Avoid duplicate execution if already loading
        if (currentState.isLoading) {
          console.log('🔧 All tools already loading, skipping duplicate execution');
          return;
        }

        set({
          isLoading: true,
          error: null,
          gatewayStatus: 'unknown',
        });

        try {
          console.log('🔧 Loading all tools started');

          let allTools: MCPTool[] = [];
          let cursor: string | undefined = undefined;

          // Repeat loading while nextCursor exists
          do {
            const result = await fetchTools(cursor);
            allTools = [...allTools, ...result.tools];
            cursor = result.nextCursor;

            console.log(
              '📄 Page loaded: +%d items (total: %d items)',
              result.tools.length,
              allTools.length,
              cursor ? { nextCursor: 'present' } : { nextCursor: 'none' }
            );
          } while (cursor);

          set({
            tools: allTools,
            nextCursor: null, // null as all loaded
            isLoading: false,
            error: null,
            lastFetchTime: new Date().toISOString(),
            gatewayHealthy: true,
            gatewayStatus: 'healthy',
          });

          console.log(`✅ All tools loading completed: ${allTools.length} items`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load all tools';

          console.error('💥 All tools loading error:', error);

          set({
            tools: [],
            nextCursor: null,
            isLoading: false,
            error: errorMessage,
            lastFetchTime: null,
            gatewayHealthy: false,
            gatewayStatus: 'unhealthy',
          });
        }
      },

      /**
       * Execute tool search
       */
      searchToolsWithQuery: async (query: string) => {
        if (!query || query.trim().length === 0) {
          set({
            searchQuery: '',
            searchResults: [],
            searchError: 'Please enter a search query',
          });
          return;
        }

        const trimmedQuery = query.trim();

        set({
          searchQuery: trimmedQuery,
          isSearching: true,
          searchError: null,
          searchResults: [],
        });

        try {
          console.log(`🔍 Tool search started: "${trimmedQuery}"`);

          // Search via Backend API (builtin tools + MCP tools)
          const searchResults = await searchTools(trimmedQuery);

          set({
            searchResults,
            isSearching: false,
            searchError: null,
            gatewayHealthy: true,
            gatewayStatus: 'healthy',
          });

          console.log(
            `✅ Tool search completed: ${searchResults.length} items (query: "${trimmedQuery}")`
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Tool search failed';

          console.error('💥 Tool search error:', error);

          set({
            searchResults: [],
            isSearching: false,
            searchError: errorMessage,
            gatewayHealthy: false,
            gatewayStatus: 'unhealthy',
          });
        }
      },

      /**
       * Clear search state
       */
      clearSearch: () => {
        console.log('🧹 Clearing search state');
        set({
          searchQuery: '',
          searchResults: [],
          isSearching: false,
          searchError: null,
        });
      },

      /**
       * Set search query
       */
      setSearchQuery: (query: string) => {
        set({
          searchQuery: query,
        });
      },

      /**
       * Check Gateway connection status
       */
      checkGateway: async () => {
        try {
          console.log('💓 Gateway connection check started');

          const healthResponse = await checkGatewayHealth();

          set({
            gatewayHealthy: healthResponse.gateway.connected,
            gatewayStatus: healthResponse.status,
          });

          console.log(`✅ Gateway connection check completed: ${healthResponse.status}`);
        } catch (error) {
          console.error('💥 Gateway connection check error:', error);

          set({
            gatewayHealthy: false,
            gatewayStatus: 'unhealthy',
          });
        }
      },

      /**
       * Clear error state
       */
      clearError: () => {
        set({
          error: null,
          searchError: null,
        });
      },
    }),
    {
      name: 'tool-store',
      // Enable only in development
      enabled: import.meta.env.DEV,
    }
  )
);
