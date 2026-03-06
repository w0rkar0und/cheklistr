import type { ChecklistItem, NumberConfig } from '../../../types/database';
import type { ResponseValue } from '../../../stores/checklistStore';

interface NumberFieldProps {
  item: ChecklistItem;
  value: ResponseValue;
  onChange: (value: Partial<ResponseValue>) => void;
}

export function NumberField({ item, value, onChange }: NumberFieldProps) {
  const config = (item.config ?? {}) as NumberConfig;

  return (
    <div className="field-number">
      <label htmlFor={`field-${item.id}`} className="field-label">
        {item.label}
        {item.is_required && <span className="field-required">*</span>}
        {config.unit && <span className="field-unit">({config.unit})</span>}
      </label>
      <input
        id={`field-${item.id}`}
        type="number"
        inputMode="decimal"
        value={value.valueNumber ?? ''}
        onChange={(e) => {
          const num = e.target.value === '' ? null : parseFloat(e.target.value);
          onChange({ valueNumber: num });
        }}
        placeholder={config.placeholder ?? ''}
        min={config.min}
        max={config.max}
        step={config.step ?? 'any'}
      />
    </div>
  );
}
