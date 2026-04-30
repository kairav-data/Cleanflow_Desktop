import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, User, Bot, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';
import { API_BASE } from '../lib/runtimeConfig';

interface Message {
  role: 'user' | 'bot';
  content: string;
  id: string;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      content:
        "Hi, I'm Gwen, your Cleanflow assistant. Ask me anything about modules like validation, cleaning, schema mapping, matching, pricing intelligence, AI visualizer, pipeline builder, history, or connections.",
      id: 'initial',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      id: Date.now().toString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const botMessageId = (Date.now() + 1).toString();

      setMessages((prev) => [
        ...prev,
        { role: 'bot', content: '', id: botMessageId },
      ]);

      // Build conversation history for context, excluding empty messages
      const conversationHistory = messages
        .filter((msg) => msg.content.trim() !== '' && msg.id !== botMessageId);

      // Append the new user message
      const fullHistory = [...conversationHistory, userMessage];

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: fullHistory.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          model: "Qwen/Qwen2.5-72B-Instruct"
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantResponse = data.response || "Sorry, I couldn't generate a response.";

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId ? { ...msg, content: assistantResponse } : msg
        )
      );
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          content: "Sorry, I encountered an error connecting to the server. Please ensure the Python backend is running.",
          id: Date.now().toString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="mb-4 w-[90vw] sm:w-[400px] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-zinc-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-zinc-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Gwen AI</h3>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Cleanflow guide assistant</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <Minimize2 size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex w-full gap-3",
                    msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    msg.role === 'user' ? "bg-zinc-200" : "bg-zinc-900 text-white"
                  )}>
                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <div className={cn(
                    "max-w-[80%] p-3 rounded-2xl text-sm shadow-sm",
                    msg.role === 'user'
                      ? "bg-zinc-900 text-white rounded-tr-none"
                      : "bg-white border border-zinc-200 text-zinc-800 rounded-tl-none"
                  )}>
                    <div className="markdown-body prose prose-sm max-w-none">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  </div>
                </motion.div>
              ))}
              {isLoading && messages[messages.length - 1].role === 'user' && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center">
                    <Bot size={14} />
                  </div>
                  <div className="bg-white border border-zinc-200 p-3 rounded-2xl rounded-tl-none shadow-sm">
                    <Loader2 className="animate-spin text-zinc-400" size={16} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-zinc-100">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about Cleanflow features or workflows..."
                  className="w-full pl-4 pr-12 py-3 bg-zinc-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-zinc-900 transition-all outline-none"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 p-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                </button>
              </div>
              <p className="mt-2 text-[10px] text-zinc-400 text-center">
                Grounded in the Cleanflow feature guide
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300",
          isOpen ? "bg-zinc-900 text-white rotate-90" : "bg-zinc-900 text-white"
        )}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </motion.button>
    </div>
  );
}
