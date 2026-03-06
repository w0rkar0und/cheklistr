import type { ChecklistItem, TextConfig } from '../../../types/database';
import type { ResponseValue } from '../../../stores/checklistStore';

interface TextFieldProps {
  item: ChecklistItem;
  value: ResponseValue;
  onChange: (value: Partial<ResponseValue>) => void;
}

export function TextField({ item, value, onChange }: TextFieldProps) {
  const config = (item.config ?? {}) as TextConfig;

  return (
    <div className="field-text">
      <label htmlFor={`field-${item.id}`} className="field-label">
        {item.label}
        {item.is_required && <span className="field-required">*</span>}
      </label>
      {config.multiline ? (
        <textarea
          id={`field-${item.id}`}
          value={value.valueText ?? ''}
          onChange={(e) => onChange({ valueText: e.target.value })}
          placeholder={config.placeholder ?? ''}
          maxLength={config.max_length}
          rows={3}
        />
      ) : (
        <input
          id={`field-${item.id}`}
          type="text"
          value={value.valueText ?? ''}
          onChange={(e) => onChange({ valueText: e.target.value })}
          placeholder={config.placeholder ?? ''}
          maxLength={config.max_length}
        />
      )}
    </div>
  );
}
