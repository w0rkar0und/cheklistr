import type { ChecklistSection, ChecklistItem } from '../../types/database';
import type { ResponseValue } from '../../stores/checklistStore';
import { FieldRenderer } from './fields/FieldRenderer';

interface ChecklistSectionViewProps {
  section: ChecklistSection & { items: ChecklistItem[] };
  responses: Map<string, ResponseValue>;
  onResponseChange: (itemId: string, value: Partial<ResponseValue>) => void;
}

export function ChecklistSectionView({
  section,
  responses,
  onResponseChange,
}: ChecklistSectionViewProps) {
  return (
    <div className="checklist-section">
      <h3 className="checklist-section-title">{section.name}</h3>
      <div className="checklist-section-items">
        {section.items.map((item) => {
          const response = responses.get(item.id);
          if (!response) return null;

          return (
            <div key={item.id} className="checklist-item">
              <FieldRenderer
                item={item}
                value={response}
                onChange={(value) => onResponseChange(item.id, value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
