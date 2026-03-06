import type { ChecklistItem } from '../../../types/database';
import type { ResponseValue } from '../../../stores/checklistStore';
import { BooleanField } from './BooleanField';
import { TextField } from './TextField';
import { NumberField } from './NumberField';
import { SelectField } from './SelectField';
import { ImageField } from './ImageField';

interface FieldRendererProps {
  item: ChecklistItem;
  value: ResponseValue;
  onChange: (value: Partial<ResponseValue>) => void;
}

/**
 * Renders the correct field component based on the item's field_type.
 */
export function FieldRenderer({ item, value, onChange }: FieldRendererProps) {
  switch (item.field_type) {
    case 'boolean':
      return <BooleanField item={item} value={value} onChange={onChange} />;
    case 'text':
      return <TextField item={item} value={value} onChange={onChange} />;
    case 'number':
      return <NumberField item={item} value={value} onChange={onChange} />;
    case 'select':
      return <SelectField item={item} value={value} onChange={onChange} />;
    case 'image':
      return <ImageField item={item} value={value} onChange={onChange} />;
    default:
      return (
        <div className="field-unknown">
          <p>Unknown field type: {item.field_type}</p>
        </div>
      );
  }
}
