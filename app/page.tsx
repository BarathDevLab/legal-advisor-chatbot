"use client"
import type React from "react"
import { useEffect } from "react"

import { useRef } from "react"

import { useState } from "react"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileText, Send, AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Message {
  id: string
  type: "user" | "assistant"
  content: string
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content:
        "Hello! I'm your Legal Advisor. I can help answer questions about legal procedures and requirements. How can I assist you today?",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${BACKEND_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: input }),
      })

      if (!response.ok) throw new Error("Failed to get response")

      const data = await response.json()
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: data.answer || "I apologize, but I couldn't generate a response. Please try again.",
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      setError("⚠️ There was a problem connecting to the legal knowledge server.")
      console.error("Error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Legal Advisor</h1>
            <p className="text-xs text-muted-foreground">Ask questions about legal matters</p>
          </div>
          <Link href="/upload">
            <Button size="sm" className="gap-2">
              <FileText className="w-4 h-4" />
              Upload Documents
            </Button>
          </Link>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-2xl ${
                  message.type === "user"
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-none"
                    : "bg-card border border-border rounded-2xl rounded-tl-none"
                } p-4 space-y-3`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                {message.type === "assistant" && (
                  <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                    <p>
                      <strong>Disclaimer:</strong> This information is for general guidance. Please consult a certified
                      lawyer for official legal advice.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Error Alert */}
      {error && (
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Footer for sending messages */}
      <footer className="border-t border-border bg-card sticky bottom-0">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <Input
              placeholder="Ask your legal question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 text-sm"
            />
            <Button type="submit" disabled={loading || !input.trim()} size="sm" className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </Button>
          </form>
        </div>
      </footer>
    </div>
  )
}
