/**
 * 共有Agent管理用Zustandストア（ページネーション対応）
 */

import { create } from 'zustand';
import type { Agent } from '../types/agent';
import * as agentsApi from '../api/agents';

interface SharedAgentState {
  sharedAgents: Agent[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  searchQuery: string;
  nextCursor: string | null;
  hasMore: boolean;
}

interface SharedAgentActions {
  // 共有Agent一覧取得（初回または検索クエリ変更時）
  fetchSharedAgents: (searchQuery?: string) => Promise<void>;

  // 追加のAgentを読み込み（ページネーション）
  loadMoreAgents: () => Promise<void>;

  // ページネーションをリセット
  resetPagination: () => void;

  // 検索クエリ更新
  setSearchQuery: (query: string) => void;

  // 共有Agentをマイエージェントに追加
  cloneAgent: (userId: string, agentId: string) => Promise<Agent>;

  // エラークリア
  clearError: () => void;
}

export type SharedAgentStore = SharedAgentState & SharedAgentActions;

export const useSharedAgentStore = create<SharedAgentStore>((set, get) => ({
  // 初期状態
  sharedAgents: [],
  isLoading: false,
  isLoadingMore: false,
  error: null,
  searchQuery: '',
  nextCursor: null,
  hasMore: false,

  // 共有Agent一覧取得（初回または検索クエリ変更時）
  fetchSharedAgents: async (searchQuery?: string) => {
    set({ isLoading: true, error: null });

    try {
      const query = searchQuery !== undefined ? searchQuery : get().searchQuery;
      console.log('📋 共有Agent一覧取得開始...', { query });

      const result = await agentsApi.listSharedAgents(query || undefined, 20);

      console.log(
        `✅ 共有Agent一覧取得完了: ${result.agents.length}件 (hasMore: ${result.hasMore})`
      );

      set({
        sharedAgents: result.agents,
        nextCursor: result.nextCursor || null,
        hasMore: result.hasMore,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '共有Agent一覧の取得に失敗しました';
      console.error('💥 共有Agent一覧取得エラー:', error);
      set({
        sharedAgents: [],
        nextCursor: null,
        hasMore: false,
        isLoading: false,
        error: errorMessage,
      });
    }
  },

  // 追加のAgentを読み込み（ページネーション）
  loadMoreAgents: async () => {
    const { nextCursor, isLoadingMore, searchQuery } = get();

    if (!nextCursor || isLoadingMore) {
      return;
    }

    set({ isLoadingMore: true, error: null });

    try {
      console.log('📋 追加Agent読み込み開始...', { cursor: nextCursor });

      const result = await agentsApi.listSharedAgents(searchQuery || undefined, 20, nextCursor);

      console.log(
        `✅ 追加Agent読み込み完了: ${result.agents.length}件 (hasMore: ${result.hasMore})`
      );

      set((state) => ({
        sharedAgents: [...state.sharedAgents, ...result.agents],
        nextCursor: result.nextCursor || null,
        hasMore: result.hasMore,
        isLoadingMore: false,
        error: null,
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '追加Agentの読み込みに失敗しました';
      console.error('💥 追加Agent読み込みエラー:', error);
      set({
        isLoadingMore: false,
        error: errorMessage,
      });
    }
  },

  // ページネーションをリセット
  resetPagination: () => {
    set({
      sharedAgents: [],
      nextCursor: null,
      hasMore: false,
    });
  },

  // 検索クエリ更新
  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  // 共有Agentをマイエージェントに追加
  cloneAgent: async (userId: string, agentId: string) => {
    set({ isLoading: true, error: null });

    try {
      console.log('📥 共有Agentクローン開始...', { userId, agentId });

      const clonedAgent = await agentsApi.cloneSharedAgent(userId, agentId);

      console.log(`✅ 共有Agentクローン完了: ${clonedAgent.agentId}`);

      set({ isLoading: false, error: null });

      return clonedAgent;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '共有Agentのクローンに失敗しました';
      console.error('💥 共有Agentクローンエラー:', error);
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  // エラークリア
  clearError: () => {
    set({ error: null });
  },
}));
