'use client'

import type { ChatSession } from './app-shell'

interface Props {
  open: boolean
  sessions: ChatSession[]
  activeChatId: string
  onNewChat: () => void
  onSelectChat: (id: string) => void
  onDeleteChat: (id: string) => void
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

export function Sidebar({ open, sessions, activeChatId, onNewChat, onSelectChat, onDeleteChat }: Props) {
  return (
    /* Width animates between 0 and 256px; inner div stays 256px so content doesn't reflow */
    <aside
      className={`shrink-0 bg-[#161b22] border-r border-[#30363d] flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out ${
        open ? 'w-64' : 'w-0'
      }`}
    >
      <div className="w-64 flex flex-col h-full">
        {/* Top bar */}
        <div className="px-3 py-3 border-b border-[#30363d]">
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#e6edf3] bg-blue-600 hover:bg-blue-500 transition-colors font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
            </svg>
            New chat
          </button>
        </div>

        {/* Session list */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {sessions.length === 0 ? (
            <p className="text-[11px] text-[#8b949e] text-center py-6 px-3">
              No previous chats
            </p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`group relative flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  s.id === activeChatId
                    ? 'bg-[#21262d] text-[#e6edf3]'
                    : 'text-[#8b949e] hover:bg-[#1c2128] hover:text-[#e6edf3]'
                }`}
                onClick={() => onSelectChat(s.id)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                  className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-50">
                  <path fillRule="evenodd" d="M1 8.74c0 .983.713 1.825 1.69 1.943L3 10.698V13.5a.5.5 0 0 0 .854.354L5.511 12.2A9.01 9.01 0 0 0 8 12.5c3.866 0 7-2.015 7-4.5S11.866 3.5 8 3.5 1 5.515 1 8s0 .74 0 .74Zm6.5-1.49a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Zm1.5.75a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Zm-4.5 0a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Z" clipRule="evenodd" />
                </svg>

                <div className="flex-1 min-w-0 pr-5">
                  <p className="text-xs font-medium truncate leading-snug">{s.title}</p>
                  <p className="text-[10px] opacity-50 mt-0.5">{timeAgo(s.updatedAt)}</p>
                </div>

                {/* Delete button — visible on hover */}
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteChat(s.id) }}
                  aria-label="Delete chat"
                  className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-red-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.788l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.713Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </nav>

        {/* Footer note */}
        <div className="px-3 py-3 border-t border-[#30363d]">
          <p className="text-[10px] text-[#8b949e] leading-snug">
            Chats saved locally in your browser.
          </p>
        </div>
      </div>
    </aside>
  )
}
