import React from 'react';
import { Renderer } from '@json-render/react';
import type { Spec } from '@json-render/core';
import { registry } from './moca-catalog';

interface JsonRenderBlockProps {
  content: string;
}

export const JsonRenderBlock: React.FC<JsonRenderBlockProps> = ({ content }) => {
  const spec = React.useMemo<Spec | null>(() => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.__moca_ui_spec && parsed.spec) {
        return parsed.spec as Spec;
      }
      if (parsed.root && parsed.elements) {
        return parsed as Spec;
      }
      return null;
    } catch {
      return null;
    }
  }, [content]);

  if (!spec) {
    return (
      <pre className="text-xs bg-surface-secondary rounded p-3 overflow-x-auto whitespace-pre-wrap break-words">
        {content}
      </pre>
    );
  }

  return (
    <div className="moca-ui-render p-3">
      <Renderer spec={spec} registry={registry} />
    </div>
  );
};
