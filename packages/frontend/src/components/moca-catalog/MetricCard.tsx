import React from 'react';
import type { BaseComponentProps } from '@json-render/react';

interface MetricCardProps {
  title: string;
  value: string;
  description?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

const changeTypeClasses: Record<string, string> = {
  positive: 'text-feedback-success',
  negative: 'text-feedback-error',
  neutral: 'text-fg-muted',
};

const MetricCard = ({ props }: BaseComponentProps<MetricCardProps>): React.ReactNode => {
  const { title, value, description, change, changeType = 'neutral' } = props;

  return (
    <div className="bg-surface-primary border border-border rounded-lg p-4 flex flex-col gap-1.5">
      <span className="text-xs font-medium text-fg-muted uppercase tracking-wide">{title}</span>
      <span className="text-2xl font-bold text-fg-default leading-tight">{value}</span>
      {change && (
        <span className={`text-sm font-medium ${changeTypeClasses[changeType] ?? changeTypeClasses.neutral}`}>
          {change}
        </span>
      )}
      {description && (
        <span className="text-xs text-fg-muted mt-0.5">{description}</span>
      )}
    </div>
  );
};

export default MetricCard;

