'use client'

import { useChat } from 'ai/react'
import type { Message } from 'ai'
import { useEffect, useRef, useState } from 'react'
import { MessageBubble } from './message-bubble'

interface Props {
  chatId: string
  initialMessages: Message[]
  onMessagesChange: (chatId: string, messages: Message[]) => void
}

const EXAMPLES = [
  'My neighbor is playing loud music. What time does the quiet period start and what is the decibel limit in a residential zone?',
  'There is a massive oak tree on my property I want to cut down. Do I need permission from the city?',
  'I got a parking ticket near the Downtown Mall. What is the deadline to pay and how do I contest it?',
  'I want to build a privacy fence in my backyard. How tall can it be before I need a permit?',
  'I found a deer in my backyard. Can I keep it as a pet?',
  'What are the rules for short-term rentals (e.g. Airbnb) in Charlottesville?',
  'Can I run a home-based business out of my house, and are there zoning restrictions?',
  'Is it legal to practice bagpipes on the sidewalk at 2 AM if I am technically walking?',
]

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-[#21262d] border border-[#30363d] text-[#8b949e] select-none">
        AI
      </div>
      <div className="bg-[#21262d] border border-[#30363d] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#8b949e] animate-pulse-dot"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function RagToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-150 focus:outline-none ${
          enabled ? 'bg-blue-600' : 'bg-[#30363d]'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transform transition-transform duration-150 ${
            enabled ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="text-[11px] text-[#8b949e] select-none">
        RAG retrieval{' '}
        <span className={enabled ? 'text-blue-400' : ''}>
          {enabled ? 'on' : 'off'}
        </span>
      </span>
    </div>
  )
}

export function Chat({ chatId, initialMessages, onMessagesChange }: Props) {
  const [ragEnabled, setRagEnabled] = useState(true)
  const ragAutoDisabled = useRef(false)

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: '/api/chat',
    id: chatId,
    initialMessages,
  })

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync messages to parent (→ localStorage)
  useEffect(() => {
    if (messages.length > 0) {
      onMessagesChange(chatId, messages)
    }
  }, [messages, chatId, onMessagesChange])

  // Auto-disable RAG after the first user message is sent
  useEffect(() => {
    if (!ragAutoDisabled.current && messages.some((m) => m.role === 'user')) {
      ragAutoDisabled.current = true
      setRagEnabled(false)
    }
  }, [messages])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  function submit(e: React.FormEvent) {
    handleSubmit(e, { body: { ragEnabled } })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading) submit(e as unknown as React.FormEvent)
    }
  }

  function handleExampleClick(text: string) {
    append({ role: 'user', content: text }, { body: { ragEnabled } })
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-8 text-center">
              <div>
                <div className="text-4xl mb-3">🏛️</div>
                <h2 className="text-[#e6edf3] font-semibold text-lg mb-1">
                  Charlottesville Code Assistant
                </h2>
                <p className="text-[#8b949e] text-sm max-w-md">
                  Ask a question about the City of Charlottesville municipal code. Retrieves
                  relevant sections automatically before answering.
                </p>
              </div>

              <div className="w-full max-w-2xl">
                <p className="text-[#8b949e] text-xs uppercase tracking-widest mb-3 font-medium">
                  Example questions
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => handleExampleClick(ex)}
                      className="text-left text-xs text-[#8b949e] bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2.5 hover:border-blue-600 hover:text-[#e6edf3] transition-colors duration-150 leading-snug"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {isLoading && <TypingIndicator />}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-[#30363d] bg-[#0d1117] px-4 py-4">
        <form onSubmit={submit} className="mx-auto max-w-3xl flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the Charlottesville municipal code…"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3 text-sm text-[#e6edf3] placeholder-[#8b949e] outline-none focus:border-blue-600 transition-colors disabled:opacity-50 leading-relaxed"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Send"
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
          </button>
        </form>

        {/* RAG toggle + keyboard hint */}
        <div className="mx-auto max-w-3xl mt-2.5 flex items-center justify-between">
          <RagToggle enabled={ragEnabled} onChange={setRagEnabled} />
          <p className="text-[10px] text-[#8b949e]">
            <kbd className="font-mono bg-[#21262d] border border-[#30363d] rounded px-1">Enter</kbd> send ·{' '}
            <kbd className="font-mono bg-[#21262d] border border-[#30363d] rounded px-1">Shift+Enter</kbd> newline
          </p>
        </div>
      </div>
    </div>
  )
}
