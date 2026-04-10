import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Charlottesville Code Assistant',
  description:
    'Ask questions about the Charlottesville, VA municipal code. Powered by RAG + Qwen-2.5.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
