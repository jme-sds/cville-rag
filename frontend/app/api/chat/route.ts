import { createOpenAI } from '@ai-sdk/openai'
import { createDataStreamResponse, streamText } from 'ai'
import type { Source } from '@/lib/types'

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
  headers: {
    'HTTP-Referer': process.env.SITE_URL ?? 'http://localhost:3000',
    'X-Title': 'Charlottesville Code Assistant',
  },
})

const RAG_URL = process.env.RAG_SERVICE_URL ?? 'http://localhost:8000'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

function buildSystemPrompt(sources: Source[]): string {
  const context =
    sources.length > 0
      ? sources
          .map((s) => `[Section ${s.section} — ${s.subtitle}]\n${s.content}`)
          .join('\n\n---\n\n')
      : 'No relevant sections found.'

  return `You are a helpful assistant specializing in the Charlottesville, Virginia Municipal Code.

Answer the user's question using ONLY the context below. If the answer is not present in the context, say so clearly instead of guessing.

Rules:
- Always cite the specific section number and title when referencing a provision.
- Use plain English; avoid legal jargon where possible.
- Keep answers concise and directly relevant to what was asked.

Retrieved context:
${context}`
}

export async function POST(req: Request) {
  const {
    messages,
    ragEnabled = true,
  }: { messages: ChatMessage[]; ragEnabled?: boolean } = await req.json()

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')

  let sources: Source[] = []

  if (ragEnabled && lastUserMessage) {
    try {
      const ragRes = await fetch(`${RAG_URL}/retrieve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: lastUserMessage.content, k: 3 }),
        signal: AbortSignal.timeout(10_000),
      })

      if (ragRes.ok) {
        const data = await ragRes.json()
        sources = data.documents ?? []
      } else {
        console.error(`RAG backend returned ${ragRes.status}`)
      }
    } catch (err) {
      console.error('RAG retrieval failed:', err)
    }
  }

  return createDataStreamResponse({
    execute: async (dataStream) => {
      // Always write the annotation (empty array when RAG is off) so the UI
      // can distinguish "RAG was used" vs "RAG was skipped"
      dataStream.writeMessageAnnotation({ sources, ragEnabled })

      const result = streamText({
        model: openrouter('qwen/qwen-2.5-7b-instruct'),
        system: ragEnabled
          ? buildSystemPrompt(sources)
          : 'You are a helpful assistant specializing in the Charlottesville, Virginia Municipal Code. Answer based on your knowledge.',
        messages: messages.filter((m) => m.role !== 'system'),
        maxTokens: 500,
        temperature: 0.7,
      })

      result.mergeIntoDataStream(dataStream)
    },
  })
}
