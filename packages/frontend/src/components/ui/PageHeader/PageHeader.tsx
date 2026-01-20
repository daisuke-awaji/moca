/**
 * PageHeader Component
 * Reusable page header component that automatically hides on mobile view
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';

export interface PageHeaderProps {
  /**
   * Icon to display in the header
   */
  icon: LucideIcon;

  /**
   * Title text to display
   */
  title: string;

  /**
   * Optional action buttons or elements to display on the right side
   */
  actions?: React.ReactNode;
}

/**
 * PageHeader component
 * Displays a page header with icon, title, and optional actions
 * Automatically hides on mobile view
 */
export function PageHeader({ icon: Icon, title, actions }: PageHeaderProps) {
  const { isMobileView } = useUIStore();

  // Hide on mobile view (MainLayout handles mobile header)
  if (isMobileView) {
    return null;
  }

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="w-6 h-6 text-gray-700" />
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        </div>
        {actions && <div>{actions}</div>}
      </div>
    </header>
  );
}
