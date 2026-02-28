import type { BaseComponentProps } from '@json-render/react';

interface GridProps {
  cols?: number;
  gap?: number;
}

const Grid = ({ props, children }: BaseComponentProps<GridProps>): React.ReactNode => (
  <div
    className="grid"
    style={{
      gridTemplateColumns: `repeat(${props.cols ?? 2}, minmax(0, 1fr))`,
      gap: `${(props.gap ?? 4) * 4}px`,
    }}
  >
    {children}
  </div>
);

export default Grid;
