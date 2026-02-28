import type { BaseComponentProps } from '@json-render/react';

interface StackProps {
  gap?: number;
}

const Stack = ({ props, children }: BaseComponentProps<StackProps>): React.ReactNode => (
  <div className="flex flex-col" style={{ gap: `${(props.gap ?? 4) * 4}px` }}>
    {children}
  </div>
);

export default Stack;
