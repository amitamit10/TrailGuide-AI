"use client";

interface QuickReplyChipsProps {
  chips: string[];
  onSelect: (chip: string) => void;
}

export function QuickReplyChips({ chips, onSelect }: QuickReplyChipsProps) {
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          className="px-4 py-2 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
