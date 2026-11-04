import { useState } from "react";
import type { ReactElement } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🚀"];

const GROUPS: { label: string; emojis: string[] }[] = [
  { label: "Frequentes", emojis: ["👍", "❤️", "😂", "🎉", "👀", "🚀", "🔥", "✅", "🙏", "💯", "✨", "🤖"] },
  { label: "Rostos", emojis: ["😀", "😁", "😅", "🤣", "😊", "😍", "🤩", "😎", "🤔", "😴", "😮", "😢", "😡", "🥳", "🤯", "🫡"] },
  { label: "Gestos", emojis: ["👋", "👏", "🙌", "🤝", "💪", "👌", "✌️", "🤞", "👆", "👇", "🫶", "🙃"] },
  { label: "Objetos", emojis: ["💻", "📱", "⚡", "🧠", "🎯", "📌", "📣", "🐞", "🛠️", "📈", "☕", "🍕", "🎨", "🏆", "💡", "⏰"] },
];

export function EmojiPicker({ onPick, trigger, testid }: { onPick: (emoji: string) => void; trigger: ReactElement; testid: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} data-testid={testid} />
      <PopoverContent className="w-72 p-2" align="end" data-testid={`${testid}-panel`}>
        <div className="scroll-thin max-h-64 overflow-y-auto">
          {GROUPS.map((g) => (
            <div key={g.label} className="mb-2">
              <p className="px-1 pb-1 type-eyebrow text-[10px] text-muted-foreground">{g.label}</p>
              <div className="grid grid-cols-8 gap-0.5">
                {g.emojis.map((e) => (
                  <button
                    key={g.label + e}
                    type="button"
                    data-testid={`emoji-option-${e}`}
                    onClick={() => {
                      onPick(e);
                      setOpen(false);
                    }}
                    className={cn("grid size-8 place-items-center rounded-lg text-lg transition-[transform,background-color] duration-150 hover:scale-125 hover:bg-primary/10 active:scale-95")}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
