import React, { useState } from 'react';
import { Hash, Plus, X } from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';

interface TagPickerProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  compact?: boolean;
}

export const TagPicker: React.FC<TagPickerProps> = ({ selectedTagIds, onChange, compact }) => {
  const { activeTags, ensureTag } = useLifeHub();
  const [input, setInput] = useState('');

  const toggle = (id: string) => {
    if (selectedTagIds.includes(id)) {
      onChange(selectedTagIds.filter((t) => t !== id));
    } else {
      onChange([...selectedTagIds, id]);
    }
  };

  const handleAdd = () => {
    const clean = input.trim().replace(/^#/, '');
    if (!clean) return;
    const tag = ensureTag(clean);
    if (!selectedTagIds.includes(tag.id)) {
      onChange([...selectedTagIds, tag.id]);
    }
    setInput('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {activeTags.map((tag) => {
          const active = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                active
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:brightness-95'
              }`}
            >
              <Hash className="w-3 h-3" />
              {tag.name}
              {active && <X className="w-3 h-3 ml-0.5" />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add tag (press Enter)..."
          className={`input-field ${compact ? '!py-1.5 !text-xs' : '!py-2 !text-sm'}`}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim()}
          className="btn-secondary !min-h-[36px] !px-3 !text-xs shrink-0"
          aria-label="Add tag"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>
    </div>
  );
};
