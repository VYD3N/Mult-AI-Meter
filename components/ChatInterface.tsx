import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MultimeterReading } from '../types';
import { ChatSession, createChatSession, isAIConfigured, sendMessageToAI } from '../services/aiService';

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

  const chatSessionRef = useRef<ChatSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatSessionRef.current = createChatSession();

    if (!isAIConfigured()) {
      setMessages(prev => [
        ...prev,
        {
          id: 'ai-config-missing',
          role: 'model',
          text: 'AI chat is offline until you add `OPENROUTER_API_KEY` to `.env.local` and restart the dev server.',
          timestamp: Date.now()
        }
      ]);
    }
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
    if (!input.trim() && !selectedImage) return;

    if (!chatSessionRef.current) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          text: 'OpenRouter is not configured yet. Add `OPENROUTER_API_KEY` to `.env.local`, then restart the app to enable AI responses.',
          timestamp: Date.now()
        }
      ]);
      return;
    }

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

  const chatStatus = isAIConfigured() ? 'OpenRouter uplink armed' : 'OpenRouter offline';

  return (
    <div className="chat-shell">
      <div className="chat-header">
        <div>
          <span className="panel-kicker">Vector Interface</span>
          <h3 className="chat-title">AI Electrician</h3>
          <p className="muted-copy">Send the current reading, attach a wiring image, or let the assistant set the correct meter mode.</p>
        </div>
        <button onClick={() => setShowContext(!showContext)} className="hud-button-secondary" type="button">
          {showContext ? 'Hide Context' : 'Show Context'}
        </button>
      </div>

      {showContext && (
        <div className="chat-context">
          <input
            type="text"
            placeholder="Device name / system"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Goal / symptom"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>
      )}

      <div className="status-bar">
        <div className="status-group">
          <div className={`status-chip ${isAIConfigured() ? '' : 'warning'}`}>{chatStatus}</div>
          <div className="hud-chip">{currentReading ? `${currentReading.mode} ${currentReading.value} ${currentReading.unit}` : 'No active reading'}</div>
        </div>
      </div>

      <div className="chat-log">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role === 'user' ? 'user' : ''}`}>
            {msg.image && <img src={msg.image} alt="Uploaded content" />}
            <div>{msg.text}</div>
          </div>
        ))}
        {isTyping && (
          <div className="chat-message">
            <div className="typing-dots"><span /><span /><span /></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {selectedImage && (
        <div className="chat-attachment">
          <img src={selectedImage} alt="Preview" />
          <div className="muted-copy">Image armed for the next prompt.</div>
          <button onClick={() => setSelectedImage(null)} className="hud-button-secondary" type="button">Clear</button>
        </div>
      )}

      <div className="chat-inputbar">
        <button onClick={() => fileInputRef.current?.click()} className="chat-upload" type="button" title="Upload diagram/image">
          +
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileSelect}
          />
        </button>

        <input
          className="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the issue, reading, or component you want analyzed..."
        />

        <button onClick={handleSend} disabled={isTyping || (!input.trim() && !selectedImage)} className="chat-send" type="button">
          {'>'}
        </button>
      </div>

      <div className="chat-footer-note">
        AI suggestions are informational only. Follow lockout, PPE, and local electrical safety practice.
      </div>
    </div>
  );
};
