import type { ChecklistItem, SelectConfig } from '../../../types/database';
import type { ResponseValue } from '../../../stores/checklistStore';

interface SelectFieldProps {
  item: ChecklistItem;
  value: ResponseValue;
  onChange: (value: Partial<ResponseValue>) => void;
}

export function SelectField({ item, value, onChange }: SelectFieldProps) {
  const config = (item.config ?? {}) as SelectConfig;
  const options = config.options ?? [];

  return (
    <div className="field-select">
      <label htmlFor={`field-${item.id}`} className="field-label">
        {item.label}
        {item.is_required && <span className="field-required">*</span>}
      </label>
      <select
        id={`field-${item.id}`}
        value={value.valueText ?? ''}
        onChange={(e) => onChange({ valueText: e.target.value || null })}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
        {config.allow_other && (
          <option value="__other__">Other</option>
        )}
      </select>
      {value.valueText === '__other__' && (
        <input
          type="text"
          placeholder="Specify other..."
          onChange={(e) => onChange({ valueText: e.target.value || null })}
          style={{ marginTop: '0.5rem' }}
        />
      )}
    </div>
  );
}
