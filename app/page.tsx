"use client";
import type React from "react";
import { useEffect } from "react";

import { useRef } from "react";

import { useState } from "react";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Send, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Source {
  source_number: number;
  document: string;
  page: number;
  content: string;
}

interface WatsonStage {
  response: string;
  follow_ups?: string[];
  intents?: Array<{ intent: string; confidence: number }>;
  entities?: Array<{ entity: string; value: string }>;
  actions?: Array<{ name: string; type: string }>;
  is_goodbye?: boolean;
  has_actions?: boolean;
}

interface MessageStages {
  watson?: WatsonStage;
  detailed?: string;
  simplified?: string;
  sources?: Source[];
}

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  sources?: Source[];
  stages?: MessageStages;
  isFollowUp?: boolean;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [awaitingFollowUp, setAwaitingFollowUp] = useState(false);
  const [conversationContext, setConversationContext] = useState<string[]>([]);
  const [isGoodbye, setIsGoodbye] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Initialize or re-initialize session
  const initSession = async () => {
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "sit23cs199@sairamtap.edu.in" }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          `Session creation failed (${response.status}): ${
            errorData.error || response.statusText
          }`
        );
      }

      const data = await response.json();
      setSessionId(data.session_id);

      // Add welcome message from backend
      if (data.welcome_message) {
        setMessages([
          {
            id: "welcome",
            type: "assistant",
            content: data.welcome_message,
          },
        ]);
      }

      // Reset conversation state
      setIsGoodbye(false);
      setAwaitingFollowUp(false);
      setConversationContext([]);
      setError(null);
    } catch (err) {
      console.error("Error initializing session:", err);
      setError(
        `❌ Failed to connect to backend server. Please ensure the backend is running. Error: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  };

  // Initialize session when component mounts
  useEffect(() => {
    initSession();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !sessionId) return;

    const currentInput = input.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: currentInput,
      isFollowUp: awaitingFollowUp,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question: currentInput,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      console.log("Response data:", data);
      // Check Watson stage for follow-ups and session status
      console.log("Response data:", data.watson_responses);
      const watsonStage = data.watson_responses?.[0];
      const hasFollowUps =
        watsonStage?.follow_ups && watsonStage.follow_ups.length > 0;
      const isGoodbyeFlag = watsonStage == 'goodbye' || watsonStage == "Goodbye";
      console.log("isGoodbye:", isGoodbyeFlag, watsonStage);

      // Build message stages
      const stages: MessageStages = {};

      if (watsonStage) {
        stages.watson = watsonStage;
      }

      if (data.detailed_answer) {
        stages.detailed = data.detailed_answer;
      }

      if (data.simplified_answer) {
        stages.simplified = data.simplified_answer;
      }

      if (data.sources && data.sources.length > 0) {
        stages.sources = data.sources;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content:
          data.simplified_answer ||
          data.detailed_answer ||
          watsonStage?.response ||
          "I apologize, but I couldn't generate a response. Please try again.",
        sources: data.sources || [],
        stages: Object.keys(stages).length > 0 ? stages : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update conversation state based on Watson response
      setIsGoodbye(isGoodbyeFlag);
      if (isGoodbyeFlag) {
        // Watson said goodbye - reset conversation state
        setAwaitingFollowUp(false);
        setConversationContext([]);
      } else if (hasFollowUps) {
        // Watson is asking follow-up questions
        setAwaitingFollowUp(true);
        setConversationContext((prev) => [...prev, currentInput]);
      } else {
        // Normal response, not awaiting follow-up
        setAwaitingFollowUp(false);
        // Start fresh context for next query
        setConversationContext([currentInput]);
      }
    } catch (err) {
      setError(
        "⚠️ There was a problem connecting to the legal knowledge server."
      );
      console.error("Error:", err);
      setAwaitingFollowUp(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Legal Advisor</h1>
            <p className="text-xs text-muted-foreground">
              Ask questions about legal matters
            </p>
          </div>
          <Link href="/upload">
            <Button size="sm" className="gap-2">
              <FileText className="w-4 h-4" />
              Upload Documents
            </Button>
          </Link>
        </div>

        {/* Conversation State Indicator */}
        {awaitingFollowUp && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-3">
            <div className="bg-blue-50 dark:bg-blue-950/30 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
              💬 Watson is waiting for your answer to continue the
              conversation...
            </div>
          </div>
        )}
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.type === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-2xl ${
                  message.type === "user"
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-none"
                    : "bg-card border border-border rounded-2xl rounded-tl-none"
                } p-4 space-y-3`}
              >
                <div className="text-sm leading-relaxed space-y-4">
                  {/* Watson Assistant Stage */}
                  {message.stages?.watson && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <span>💬</span>
                        <span>Watson Assistant</span>
                      </div>
                      <p className="whitespace-pre-wrap bg-primary/5 p-3 rounded">
                        {message.stages.watson.response}
                      </p>

                      {/* Follow-up Questions */}
                      {message.stages.watson.follow_ups &&
                        message.stages.watson.follow_ups.length > 0 && (
                          <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded border border-blue-200 dark:border-blue-800">
                            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">
                              💬 Follow-up Questions:
                            </p>
                            <ul className="text-xs space-y-1 text-blue-700 dark:text-blue-400">
                              {message.stages.watson.follow_ups.map(
                                (q, idx) => (
                                  <li key={idx}>❓ {q}</li>
                                )
                              )}
                            </ul>
                          </div>
                        )}

                      {/* Goodbye Message */}
                      {message.stages.watson.is_goodbye && (
                        <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded border border-green-200 dark:border-green-800">
                          <p className="text-xs text-green-800 dark:text-green-300">
                            👋 Session ended. Feel free to start a new
                            conversation!
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Detailed Answer */}
                  {message.stages?.detailed &&
                    !message.stages.watson?.is_goodbye && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                          <span>📚</span>
                          <span>Detailed Legal Answer</span>
                        </div>
                        <p className="whitespace-pre-wrap bg-muted/30 p-3 rounded">
                          {message.stages.detailed}
                        </p>
                      </div>
                    )}

                  {/* Simplified Answer */}
                  {message.stages?.simplified &&
                    !message.stages.watson?.is_goodbye && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-green-600 dark:text-green-400">
                          <span>💡</span>
                          <span>Simplified Explanation</span>
                        </div>
                        <p className="whitespace-pre-wrap bg-green-50 dark:bg-green-950/30 p-3 rounded">
                          {message.stages.simplified}
                        </p>
                      </div>
                    )}

                  {/* Default content if no stages */}
                  {!message.stages && (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}

                  {/* Sources Section */}
                  {message.stages?.sources &&
                    message.stages.sources.length > 0 &&
                    !message.stages.watson?.is_goodbye && (
                      <div className="pt-4 border-t border-border">
                        <details className="group">
                          <summary className="cursor-pointer font-semibold hover:text-primary/80 flex items-center gap-2 list-none select-none">
                            <span className="text-base">📚 Sources</span>
                            <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">
                              ▼
                            </span>
                          </summary>
                          <div className="mt-4 space-y-4">
                            {message.stages.sources.map((source, idx) => (
                              <div key={idx} className="space-y-3">
                                <div className="font-semibold text-foreground">
                                  Source {idx + 1}:
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                  <FileText className="w-3 h-3" />
                                  <span>
                                    Document: {source.document} | Page:{" "}
                                    {source.page}
                                  </span>
                                </div>

                                <details className="group/content">
                                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 list-none select-none py-2 px-3 bg-muted/20 rounded border border-border/50">
                                    <span className="group-open/content:rotate-90 transition-transform">
                                      ▶
                                    </span>
                                    <span>View Source {idx + 1} Content</span>
                                  </summary>
                                  <div className="mt-2 text-sm bg-muted/30 rounded-lg p-4 leading-relaxed border border-border/50">
                                    {source.content}
                                  </div>
                                </details>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                </div>
                {message.type === "assistant" && (
                  <>
                    {/* Suggested Follow-up Questions - Skip for welcome message */}
                    {message.id !== "welcome" &&
                      !message.stages?.watson?.is_goodbye &&
                      !awaitingFollowUp && (
                        <div className="pt-3 border-t border-border/50">
                          <p className="text-xs text-muted-foreground mb-2">
                            💡 You might also want to ask:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              "Can you explain more details?",
                              "What are the legal procedures?",
                              "What documents do I need?",
                            ].map((suggestion, idx) => (
                              <button
                                key={idx}
                                onClick={() => setInput(suggestion)}
                                disabled={loading}
                                className="text-xs px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full border border-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                      <p>
                        <strong>Disclaimer:</strong> This information is for
                        general guidance. Please consult a certified lawyer for
                        official legal advice.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Thinking...
                </span>
              </div>
            </div>
          )}

          {/* Suggested Questions - Show when no messages or only welcome message */}
          {!loading && messages.length <= 1 && sessionId && (
            <div className="mt-8 space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  💡 Try asking about:
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  "What are the requirements for land ownership?",
                  "How do I transfer property rights?",
                  "What documents are needed for land registration?",
                  "Can you explain tenant rights and protections?",
                ].map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(question)}
                    className="text-left p-4 bg-muted/50 hover:bg-muted rounded-lg border border-border transition-colors text-sm"
                  >
                    <span className="text-muted-foreground">❓</span>{" "}
                    <span className="text-foreground">{question}</span>
                  </button>
                ))}
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
          {!isGoodbye && (
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <Input
                placeholder={
                  !sessionId
                    ? "Initializing chat session..."
                    : awaitingFollowUp
                    ? "Answer Watson's question..."
                    : "Ask your legal question..."
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading || !sessionId}
                className="flex-1 text-sm"
              />
              <Button
                type="submit"
                disabled={loading || !input.trim() || !sessionId}
                size="sm"
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send
              </Button>
            </form>
          )}
          {isGoodbye && (
            <div className="flex justify-center">
              <button
                onClick={() => {
                  // Re-initialize session with fresh welcome message and reset state
                  console.log("Starting new conversation, resetting all state");
                  initSession();
                }}
                className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Send className="w-4 h-4" />
                New Chat
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
