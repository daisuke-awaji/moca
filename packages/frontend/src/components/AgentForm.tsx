import React, { useState } from 'react';
import { Plus, X, Save, AlertCircle } from 'lucide-react';
import { ToolSelector } from './ToolSelector';
import type { CreateAgentInput, Agent, Scenario } from '../types/agent';

interface AgentFormProps {
  agent?: Agent;
  onSubmit: (data: CreateAgentInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const AgentForm: React.FC<AgentFormProps> = ({
  agent,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<CreateAgentInput>(() => {
    if (agent) {
      return {
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        enabledTools: [...agent.enabledTools],
        scenarios: agent.scenarios.map((s) => ({
          title: s.title,
          prompt: s.prompt,
        })),
      };
    }
    return {
      name: '',
      description: '',
      systemPrompt: '',
      enabledTools: [],
      scenarios: [],
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // バリデーション
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Agent名は必須です';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Agent名は50文字以下で入力してください';
    }

    if (!formData.description.trim()) {
      newErrors.description = '説明は必須です';
    } else if (formData.description.length > 200) {
      newErrors.description = '説明は200文字以下で入力してください';
    }

    if (!formData.systemPrompt.trim()) {
      newErrors.systemPrompt = 'システムプロンプトは必須です';
    } else if (formData.systemPrompt.length < 10) {
      newErrors.systemPrompt = 'システムプロンプトは10文字以上で入力してください';
    }

    // シナリオのバリデーション
    formData.scenarios.forEach((scenario, index) => {
      if (!scenario.title.trim()) {
        newErrors[`scenario_title_${index}`] = 'シナリオタイトルは必須です';
      }
      if (!scenario.prompt.trim()) {
        newErrors[`scenario_prompt_${index}`] = 'シナリオプロンプトは必須です';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // フォーム送信
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
  };

  // シナリオ追加
  const addScenario = () => {
    setFormData((prev) => ({
      ...prev,
      scenarios: [
        ...prev.scenarios,
        {
          title: '',
          prompt: '',
        },
      ],
    }));
  };

  // シナリオ削除
  const removeScenario = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      scenarios: prev.scenarios.filter((_, i) => i !== index),
    }));

    // 該当するエラーも削除
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[`scenario_title_${index}`];
      delete newErrors[`scenario_prompt_${index}`];
      return newErrors;
    });
  };

  // シナリオ更新
  const updateScenario = (index: number, field: keyof Scenario, value: string) => {
    setFormData((prev) => ({
      ...prev,
      scenarios: prev.scenarios.map((scenario, i) =>
        i === index ? { ...scenario, [field]: value } : scenario
      ),
    }));

    // エラーをクリア
    if (errors[`scenario_${field}_${index}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`scenario_${field}_${index}`];
        return newErrors;
      });
    }
  };

  return (
    <div>
      <form id="agent-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Agent名 */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Agent名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, name: e.target.value }));
              if (errors.name) {
                setErrors((prev) => ({ ...prev, name: '' }));
              }
            }}
            disabled={isLoading}
            placeholder="例: コードレビューAgent"
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.name && (
            <div className="flex items-center space-x-1 mt-1">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600">{errors.name}</span>
            </div>
          )}
        </div>

        {/* 説明 */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            説明 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, description: e.target.value }));
              if (errors.description) {
                setErrors((prev) => ({ ...prev, description: '' }));
              }
            }}
            disabled={isLoading}
            placeholder="このAgentの用途や特徴を説明してください"
            rows={1}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed resize-none ${
              errors.description ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.description && (
            <div className="flex items-center space-x-1 mt-1">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600">{errors.description}</span>
            </div>
          )}
        </div>

        {/* システムプロンプト */}
        <div>
          <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-700 mb-2">
            システムプロンプト <span className="text-red-500">*</span>
          </label>
          <textarea
            id="systemPrompt"
            value={formData.systemPrompt}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, systemPrompt: e.target.value }));
              if (errors.systemPrompt) {
                setErrors((prev) => ({ ...prev, systemPrompt: '' }));
              }
            }}
            disabled={isLoading}
            placeholder="このAgentの役割や振る舞いを定義してください"
            rows={6}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed resize-none ${
              errors.systemPrompt ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.systemPrompt && (
            <div className="flex items-center space-x-1 mt-1">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600">{errors.systemPrompt}</span>
            </div>
          )}
        </div>

        {/* ツール選択 */}
        <div>
          <ToolSelector
            selectedTools={formData.enabledTools}
            onSelectionChange={(tools) => setFormData((prev) => ({ ...prev, enabledTools: tools }))}
            disabled={isLoading}
          />
        </div>

        {/* シナリオ管理 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700">よく使うシナリオ</label>
            <button
              type="button"
              onClick={addScenario}
              disabled={isLoading}
              className="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>シナリオ追加</span>
            </button>
          </div>

          {formData.scenarios.length === 0 ? (
            <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
              シナリオがありません。「シナリオ追加」ボタンから追加してください。
            </div>
          ) : (
            <div className="space-y-4">
              {formData.scenarios.map((scenario, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">シナリオ {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeScenario(index)}
                      disabled={isLoading}
                      className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={scenario.title}
                      onChange={(e) => updateScenario(index, 'title', e.target.value)}
                      disabled={isLoading}
                      placeholder="シナリオタイトル（例: コードレビュー依頼）"
                      className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        errors[`scenario_title_${index}`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors[`scenario_title_${index}`] && (
                      <div className="flex items-center space-x-1 mt-1">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-600">
                          {errors[`scenario_title_${index}`]}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <textarea
                      value={scenario.prompt}
                      onChange={(e) => updateScenario(index, 'prompt', e.target.value)}
                      disabled={isLoading}
                      placeholder="プロンプトテンプレート"
                      rows={3}
                      className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed resize-none ${
                        errors[`scenario_prompt_${index}`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors[`scenario_prompt_${index}`] && (
                      <div className="flex items-center space-x-1 mt-1">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-600">
                          {errors[`scenario_prompt_${index}`]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ボタン */}
        <div className="flex items-center justify-end space-x-3 pt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center space-x-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>{isLoading ? '保存中...' : '保存'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
