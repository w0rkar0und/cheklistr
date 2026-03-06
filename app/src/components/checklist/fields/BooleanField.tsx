import type { ChecklistItem, BooleanConfig } from '../../../types/database';
import type { ResponseValue } from '../../../stores/checklistStore';

interface BooleanFieldProps {
  item: ChecklistItem;
  value: ResponseValue;
  onChange: (value: Partial<ResponseValue>) => void;
}

export function BooleanField({ item, value, onChange }: BooleanFieldProps) {
  const config = (item.config ?? {}) as BooleanConfig;
  const current = value.valueBoolean;

  const handleSelect = (val: boolean) => {
    onChange({ valueBoolean: val });
  };

  // Determine if current value triggers a defect
  const isDefect = item.triggers_defect &&
    config.fail_value !== undefined &&
    current === config.fail_value;

  return (
    <div className="field-boolean">
      <div className="field-label">
        {item.label}
        {item.is_required && <span className="field-required">*</span>}
      </div>
      <div className="boolean-toggle-group">
        <button
          type="button"
          className={`boolean-toggle ${current === true ? 'boolean-toggle--yes' : ''}`}
          onClick={() => handleSelect(true)}
        >
          Yes
        </button>
        <button
          type="button"
          className={`boolean-toggle ${current === false ? 'boolean-toggle--no' : ''}`}
          onClick={() => handleSelect(false)}
        >
          No
        </button>
      </div>
      {isDefect && (
        <div className="field-defect-warning">
          This may require a defect report
        </div>
      )}
    </div>
  );
}
