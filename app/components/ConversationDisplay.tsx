import { type Message } from "../helpers/types";

interface ConversationDisplayProps {
  conversation: Message[];
  emptyMessage?: string;
  useModelLabels?: boolean;
  labelA?: string;
  labelB?: string;
}

export function ConversationDisplay({
  conversation,
  emptyMessage = "No messages yet",
  useModelLabels = false,
  labelA = "Model A",
  labelB = "Model B",
}: ConversationDisplayProps) {
  // Count assistant messages to alternate labels
  let assistantCount = 0;

  return (
    <div className="flex-1 space-y-2 overflow-auto rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
      {!conversation.length && <div className="text-sm text-zinc-500">{emptyMessage}</div>}
      {conversation.map((message) => {
        let label = "";
        if (useModelLabels && message.role === "assistant") {
          label = assistantCount % 2 === 0 ? labelA : labelB;
          assistantCount++;
        } else if (!useModelLabels) {
          label = message.role;
        }

        return (
          <div
            key={message.id}
            className={
              message.role === "assistant"
                ? "rounded-md bg-zinc-100 p-2 text-left text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                : message.role === "system"
                ? "rounded-md bg-zinc-200/60 p-2 text-left text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                : "rounded-md bg-zinc-50 p-2 text-left text-zinc-900 dark:bg-[#111] dark:text-zinc-200"
            }
          >
            {label && (
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                {label}
              </div>
            )}
            <div className="whitespace-pre-wrap text-sm">{message.content}</div>
          </div>
        );
      })}
    </div>
  );
}
