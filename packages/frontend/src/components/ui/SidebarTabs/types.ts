import type { ComponentType } from 'react';

/**
 * タブアイテムの型定義
 */
export interface TabItem<T extends string = string> {
  /** タブのID（一意な識別子） */
  id: T;
  /** タブのラベル（表示名） */
  label: string;
  /** タブのアイコンコンポーネント */
  icon: ComponentType<{ className?: string }>;
}

/**
 * SidebarTabsコンポーネントのprops
 */
export interface SidebarTabsProps<T extends string = string> {
  /** タブのリスト */
  tabs: TabItem<T>[];
  /** 現在アクティブなタブのID */
  activeTab: T;
  /** タブが変更されたときのコールバック */
  onTabChange: (tabId: T) => void;
  /** 追加のクラス名（オプション） */
  className?: string;
}

/**
 * SidebarTabsLayoutコンポーネントのprops
 */
export interface SidebarTabsLayoutProps<T extends string = string> {
  /** タブのリスト */
  tabs: TabItem<T>[];
  /** 現在アクティブなタブのID */
  activeTab: T;
  /** タブが変更されたときのコールバック */
  onTabChange: (tabId: T) => void;
  /** コンテンツエリアに表示する子要素 */
  children: React.ReactNode;
}
