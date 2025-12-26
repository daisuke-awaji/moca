import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

// Mermaidの初期化（一度だけ実行）
let isInitialized = false;

// 一意なIDを生成する関数
const generateUniqueId = () => {
  return `mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

const MermaidDiagramComponent: React.FC<MermaidDiagramProps> = ({ chart, className = '' }) => {
  const { t } = useTranslation();
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isValidSyntax, setIsValidSyntax] = useState<boolean | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const debounceTimerRef = useRef<number | undefined>(undefined);
  const currentChartRef = useRef<string>('');
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!isInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: 'inherit',
        fontSize: 14,
        flowchart: {
          htmlLabels: true,
          curve: 'basis',
        },
        sequence: {
          diagramMarginX: 50,
          diagramMarginY: 10,
          actorMargin: 50,
          width: 150,
          height: 65,
          boxMargin: 10,
          boxTextMargin: 5,
          noteMargin: 10,
          messageMargin: 35,
        },
        gantt: {
          titleTopMargin: 25,
          barHeight: 20,
          fontSize: 12,
          gridLineStartPadding: 35,
        },
      });
      isInitialized = true;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // 前のタイマーをクリア
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const renderChart = async () => {
      // コンポーネントがアンマウントされている場合は処理を停止
      if (!mountedRef.current || !chart.trim()) {
        if (mountedRef.current) {
          setIsValidSyntax(null);
          setSvgContent(null);
        }
        return;
      }

      // 現在のチャートと同じ場合はスキップ（無限レンダリング防止）
      if (currentChartRef.current === chart.trim()) {
        return;
      }

      currentChartRef.current = chart.trim();
      setIsRendering(true);

      try {
        // まず構文チェックを行う
        await mermaid.parse(chart);

        // コンポーネントがまだマウントされているかチェック
        if (!mountedRef.current) {
          return;
        }

        setIsValidSyntax(true);

        // 一意なIDを生成
        const uniqueId = generateUniqueId();

        // Mermaidでレンダリング（DOM操作なし、SVGのみ取得）
        const { svg } = await mermaid.render(uniqueId, chart);

        // レンダリング完了後、まだマウントされているかチェック
        if (!mountedRef.current) {
          return;
        }

        // SVGをstateに設定（ReactがDOM管理）
        setSvgContent(svg);
      } catch (error) {
        // エラーが発生した場合
        console.warn('Mermaid rendering error:', error);

        if (mountedRef.current) {
          setIsValidSyntax(false);
          setSvgContent(null);
        }
      } finally {
        if (mountedRef.current) {
          setIsRendering(false);
        }
      }
    };

    // Debounce処理: 100ms待ってからレンダリングを実行
    debounceTimerRef.current = setTimeout(renderChart, 100);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [chart]);

  // アンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`mermaid-diagram overflow-x-auto my-4 ${className}`}
      style={{
        // Mermaid SVGのスタイル調整
        fontSize: 'inherit',
        fontFamily: 'inherit',
        minHeight: isValidSyntax === null ? '20px' : undefined,
      }}
    >
      {/* ローディング中 */}
      {isRendering && (
        <div className="text-blue-500 text-sm italic py-2">{t('common.renderingDiagram')}</div>
      )}

      {/* 構文エラーの場合 */}
      {isValidSyntax === false && chart.trim() && !isRendering && (
        <div className="text-gray-400 text-sm italic py-2">{t('common.diagramLoading')}</div>
      )}

      {/* SVGコンテンツを表示（React管理下で） */}
      {svgContent && !isRendering && (
        <div className="mermaid-svg-container" dangerouslySetInnerHTML={{ __html: svgContent }} />
      )}
    </div>
  );
};

// React.memoでラップしてプロパティが変わらない限り再レンダリングを防ぐ
export const MermaidDiagram = React.memo(MermaidDiagramComponent);
