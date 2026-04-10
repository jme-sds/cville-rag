'use client'

import type { Message } from 'ai'
import type { Source } from '@/lib/types'

interface Props {
  message: Message
}

function SourcesAccordion({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null

  return (
    <div className="mb-3 space-y-1.5">
      <p className="text-[10px] text-[#8b949e] uppercase tracking-widest font-medium">
        Retrieved context · {sources.length} section{sources.length !== 1 ? 's' : ''}
      </p>
      {sources.map((source, i) => (
        <details
          key={i}
          className="group bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden"
        >
          <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer list-none select-none hover:bg-[#161b22] transition-colors">
            <span className="text-xs text-[#8b949e] leading-snug">
              {source.section && (
                <span className="text-blue-400 font-medium mr-1.5">§{source.section}</span>
              )}
              {source.subtitle}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="shrink-0 w-3.5 h-3.5 text-[#8b949e] transition-transform duration-150 group-open:rotate-180"
            >
              <path
                fillRule="evenodd"
                d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </summary>
          <div className="px-3 py-3 border-t border-[#30363d] text-[11px] text-[#8b949e] leading-relaxed whitespace-pre-wrap font-mono">
            {source.content}
          </div>
        </details>
      ))}
    </div>
  )
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'

  const annotations = message.annotations as Array<{ sources?: Source[]; ragEnabled?: boolean }> | undefined
  const sources: Source[] = annotations?.flatMap((a) => a.sources ?? []) ?? []

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold select-none ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-[#21262d] border border-[#30363d] text-[#8b949e]'
        }`}
      >
        {isUser ? 'You' : 'AI'}
      </div>

      <div className={`max-w-[80%] ${isUser ? '' : 'w-full'}`}>
        {!isUser && sources.length > 0 && <SourcesAccordion sources={sources} />}

        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-[#21262d] border border-[#30363d] text-[#e6edf3] rounded-tl-sm'
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  )
}
