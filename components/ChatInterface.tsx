import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MultimeterReading } from '../types';
import { createChatSession, sendMessageToAI } from '../services/geminiService';
import { Chat } from '@google/genai';

interface ChatInterfaceProps {
  currentReading: MultimeterReading | null;
  onAiModeRequest: (mode: string) => void; // Callback to update App state
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ currentReading, onAiModeRequest }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
        id: 'init', 
        role: 'model', 
        text: 'Ready to assist. I can look up specs or analyze wiring diagrams if you provide details.', 
        timestamp: Date.now() 
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Context State
  const [deviceName, setDeviceName] = useState('');
  const [goal, setGoal] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(true);

  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatSessionRef.current = createChatSession();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setSelectedImage(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || !chatSessionRef.current) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now(),
      relatedReading: currentReading || undefined,
      image: selectedImage || undefined,
      context: { deviceName, goal }
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedImage(null); // Clear image after send
    setIsTyping(true);

    const responseText = await sendMessageToAI(chatSessionRef.current, userMsg, currentReading);
    
    // --- MODE PARSING LOGIC ---
    // Check for [MODE: X] tag
    const modeMatch = responseText.match(/\[MODE:\s*(.*?)\]/);
    if (modeMatch && modeMatch[1]) {
        const requestedMode = modeMatch[1].trim();
        console.log("AI Requested Mode:", requestedMode);
        onAiModeRequest(requestedMode);
    }

    // Clean up tag for display if desired, or keep it. Let's keep it for transparency but make it subtle in UI? 
    // For now, just display raw text.

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Chat Header */}
      <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
        <h3 className="font-semibold text-slate-200 flex items-center gap-2 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
          AI Electrician
        </h3>
        <button 
            onClick={() => setShowContext(!showContext)}
            className="text-xs text-slate-400 hover:text-white underline"
        >
            {showContext ? 'Hide Context' : 'Show Context'}
        </button>
      </div>

      {/* Context Inputs Panel */}
      {showContext && (
          <div className="bg-slate-800/50 p-3 border-b border-slate-700 grid grid-cols-2 gap-2 text-sm animate-fade-in">
              <input 
                 type="text" 
                 placeholder="Device Name (e.g. Pump)" 
                 value={deviceName}
                 onChange={(e) => setDeviceName(e.target.value)}
                 className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:border-cyan-500 outline-none"
              />
              <input 
                 type="text" 
                 placeholder="Goal (e.g. Won't start)" 
                 value={goal}
                 onChange={(e) => setGoal(e.target.value)}
                 className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:border-cyan-500 outline-none"
              />
          </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed relative
              ${msg.role === 'user' 
                ? 'bg-cyan-900/40 text-cyan-100 rounded-br-none border border-cyan-800/50' 
                : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
              }
            `}>
                {msg.image && (
                    <img src={msg.image} alt="Uploaded content" className="max-w-full h-auto rounded mb-2 border border-white/10" />
                )}
                <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-bl-none px-4 py-3 flex gap-1">
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-75" />
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-150" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-slate-800 border-t border-slate-700">
        
        {selectedImage && (
            <div className="flex items-center gap-2 mb-2 bg-slate-900 p-2 rounded border border-slate-700">
                <img src={selectedImage} alt="Preview" className="h-8 w-8 object-cover rounded" />
                <span className="text-xs text-slate-400 flex-1 truncate">Image Attached</span>
                <button onClick={() => setSelectedImage(null)} className="text-slate-500 hover:text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        )}

        <div className="flex gap-2">
          {/* File Upload Button */}
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="text-slate-400 hover:text-cyan-400 p-2 rounded transition-colors"
            title="Upload Diagram/Image"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
             </svg>
             <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileSelect}
             />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the issue..."
            className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
          />
          <button
            onClick={handleSend}
            disabled={(isTyping || (!input.trim() && !selectedImage))}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
