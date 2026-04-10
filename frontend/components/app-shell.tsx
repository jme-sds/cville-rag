'use client'

import { useCallback, useState } from 'react'
import type { Message } from 'ai'
import { Sidebar } from './sidebar'
import { Chat } from './chat'

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  updatedAt: number
}

const STORAGE_KEY = 'cville-rag-chats'
const MAX_SESSIONS = 50

function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ChatSession[]) : []
  } catch {
    return []
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)))
  } catch {}
}

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for non-secure (non-HTTPS) contexts
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('-')
}

function titleFromMessages(messages: Message[]): string {
  const first = messages.find((m) => m.role === 'user')
  if (!first || typeof first.content !== 'string') return 'New chat'
  const t = first.content.trim()
  return t.length > 48 ? t.slice(0, 48) + '…' : t
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions)
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    const s = loadSessions()
    return s[0]?.id ?? newId()
  })

  const handleNewChat = useCallback(() => {
    setActiveChatId(newId())
  }, [])

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id)
  }, [])

  const handleDeleteChat = useCallback((id: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id)
      saveSessions(updated)
      setActiveChatId((cur) => (cur === id ? (updated[0]?.id ?? newId()) : cur))
      return updated
    })
  }, [])

  const handleMessagesChange = useCallback((chatId: string, messages: Message[]) => {
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === chatId)
      const updated = exists
        ? prev.map((s) =>
            s.id === chatId
              ? { ...s, messages, updatedAt: Date.now(), title: titleFromMessages(messages) }
              : s,
          )
        : [{ id: chatId, title: titleFromMessages(messages), messages, updatedAt: Date.now() }, ...prev]
      saveSessions(updated)
      return updated
    })
  }, [])

  const activeSession = sessions.find((s) => s.id === activeChatId)

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="shrink-0 border-b border-[#30363d] bg-[#161b22] z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            className="p-1.5 rounded-md text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
            </svg>
          </button>

          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white font-bold text-sm select-none">
            CVL
          </div>
          <div>
            <h1 className="text-[#e6edf3] font-semibold text-sm leading-tight">
              Charlottesville Code Assistant
            </h1>
            <p className="text-[#8b949e] text-xs">
              Charlottesville, VA Municipal Code · RAG-powered
            </p>
          </div>
          <span className="ml-auto text-[10px] font-medium text-[#8b949e] bg-[#21262d] border border-[#30363d] rounded px-2 py-0.5">
            Qwen-2.5-7B
          </span>
        </div>
      </header>

      {/* Body: sidebar + chat */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          sessions={sessions}
          activeChatId={activeChatId}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
        />

        <div className="flex flex-col flex-1 min-w-0">
          <Chat
            key={activeChatId}
            chatId={activeChatId}
            initialMessages={activeSession?.messages ?? []}
            onMessagesChange={handleMessagesChange}
          />

          {/* Footer */}
          <footer className="shrink-0 border-t border-[#30363d] bg-[#161b22] py-2">
            <p className="text-center text-[10px] text-[#8b949e]">
              AI responses may contain errors — always verify with the{' '}
              <a
                href="https://library.municode.com/va/charlottesville"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[#e6edf3] transition-colors"
              >
                official municipal code
              </a>
              . Not a substitute for legal advice.
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
