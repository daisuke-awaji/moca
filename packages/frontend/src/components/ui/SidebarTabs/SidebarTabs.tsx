import type { SidebarTabsProps, SidebarTabsLayoutProps } from './types';

/**
 * サイドバータブナビゲーションコンポーネント
 * 左側にタブのリストを表示し、クリックでアクティブなタブを切り替える
 */
export function SidebarTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  className = '',
}: SidebarTabsProps<T>) {
  return (
    <div className={`w-48 border-r border-gray-200 flex-shrink-0 ${className}`}>
      <nav className="p-4 space-y-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * サイドバータブレイアウトコンポーネント
 * サイドバータブとコンテンツエリアを含む完全なレイアウト
 */
export function SidebarTabsLayout<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  children,
}: SidebarTabsLayoutProps<T>) {
  return (
    <div className="flex h-full">
      <SidebarTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
