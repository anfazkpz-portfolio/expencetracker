'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Mic,
  MicOff,
  Send,
  X,
  Sparkles,
  Loader2,
  Database,
  Volume2,
  VolumeX,
  Radio,
  Square,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  toolCalls?: string[];
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    sender: 'assistant',
    text: "Hello! I'm your AI Cash Assistant. Ask me anything about your balance, expenses, Swiggy earnings, debts, or external live funds.",
    timestamp: 'Just now',
  },
];

const QUICK_PROMPTS = [
  'What is my total savings this month?',
  'How much did I earn from Swiggy?',
  'Do I have any pending or overdue debts?',
  'What are the external live fund balances?',
];

/**
 * Normalizes text for human-like Text-To-Speech pronunciation:
 * - Converts ₹ / Rs. into "rupees"
 * - Strips markdown asterisks, bullet points, headers, backticks
 * - Cleans excessive whitespace
 */
function cleanTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    .replace(/₹\s*([0-9,.]+)/g, '$1 rupees')
    .replace(/Rs\.?\s*([0-9,.]+)/gi, '$1 rupees')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^[•\-*]\s+/gm, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function AIAssistantFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLiveVoiceMode, setIsLiveVoiceMode] = useState(false);
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveStatus, setLiveStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const isLiveVoiceModeRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef<any>(null);
  const speechSynthIntervalRef = useRef<any>(null);
  const transcriptAccumulatorRef = useRef('');

  // Keep refs in sync with state for access in callbacks
  useEffect(() => {
    isLiveVoiceModeRef.current = isLiveVoiceMode;
  }, [isLiveVoiceMode]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isLiveVoiceMode) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLiveVoiceMode]);

  // Stop any active TTS audio playback
  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      if (speechSynthIntervalRef.current) {
        clearInterval(speechSynthIntervalRef.current);
        speechSynthIntervalRef.current = null;
      }
    }
    setIsSpeaking(false);
    setCurrentSpeakingId(null);
  }, []);

  // Text-To-Speech engine using Web Speech API
  const speakText = useCallback(
    (rawText: string, onEnd?: () => void, messageId?: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onEnd?.();
        return;
      }

      stopSpeech();

      const spokenText = cleanTextForSpeech(rawText);
      if (!spokenText) {
        onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select highest quality available English voice (en-IN or en-US)
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(
          (v) =>
            (v.lang.includes('en-IN') || v.lang.includes('en-US') || v.lang.includes('en-GB')) &&
            !v.name.includes('Bad')
        ) || voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        if (messageId) setCurrentSpeakingId(messageId);
        setLiveStatus('speaking');

        // Chrome keep-alive bug workaround (pauses long utterances after 14s)
        if (speechSynthIntervalRef.current) clearInterval(speechSynthIntervalRef.current);
        speechSynthIntervalRef.current = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          } else {
            clearInterval(speechSynthIntervalRef.current);
          }
        }, 10000);
      };

      utterance.onend = () => {
        if (speechSynthIntervalRef.current) {
          clearInterval(speechSynthIntervalRef.current);
          speechSynthIntervalRef.current = null;
        }
        setIsSpeaking(false);
        setCurrentSpeakingId(null);
        setLiveStatus('idle');
        onEnd?.();
      };

      utterance.onerror = () => {
        if (speechSynthIntervalRef.current) {
          clearInterval(speechSynthIntervalRef.current);
          speechSynthIntervalRef.current = null;
        }
        setIsSpeaking(false);
        setCurrentSpeakingId(null);
        setLiveStatus('idle');
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    },
    [stopSpeech]
  );

  // Stop speech recognition
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }
    setIsListening(false);
  }, []);

  // Main Send & Backend query logic
  const handleSend = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend || inputValue || transcriptAccumulatorRef.current).trim();
      if (!text || isLoading) return;

      stopListening();
      transcriptAccumulatorRef.current = '';
      setLiveTranscript('');
      setInputValue('');
      setIsLoading(true);
      setLiveStatus('processing');

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        const currentHistory = [...messages, userMessage];
        const apiPayload = {
          messages: currentHistory.map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
        };

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiPayload),
        });

        if (!res.ok) {
          throw new Error(`API responded with status ${res.status}`);
        }

        const data = await res.json();
        const botResponseText = data.content || 'I processed your request.';
        const botMessageId = (Date.now() + 1).toString();

        const botMessage: ChatMessage = {
          id: botMessageId,
          sender: 'assistant',
          text: botResponseText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolCalls: data.toolCalls || [],
        };

        setMessages((prev) => [...prev, botMessage]);

        // AUTOMATIC TWO-WAY CONVERSATIONAL LOOP:
        // In Live Voice Mode, automatically speak the response aloud,
        // and immediately restart listening when speech finishes.
        if (isLiveVoiceModeRef.current) {
          speakText(
            botResponseText,
            () => {
              // On speech finish: if live mode is still active, automatically listen again!
              if (isLiveVoiceModeRef.current) {
                startListening();
              }
            },
            botMessageId
          );
        }
      } catch (err: any) {
        console.error('Chat error:', err);
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: 'Sorry, I encountered an issue connecting to your financial database. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMessage]);

        if (isLiveVoiceModeRef.current) {
          speakText(errorMessage.text, () => {
            if (isLiveVoiceModeRef.current) startListening();
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [inputValue, isLoading, messages, speakText, stopListening]
  );

  // Start speech recognition
  const startListening = useCallback(() => {
    // If AI is currently speaking, stop it immediately so mic doesn't capture AI's voice
    stopSpeech();

    if (!recognitionRef.current) {
      if (typeof window !== 'undefined') {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
          alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
          return;
        }
      }
    }

    try {
      transcriptAccumulatorRef.current = '';
      setLiveTranscript('');
      setLiveStatus('listening');
      recognitionRef.current?.start();
      setIsListening(true);
    } catch (err: any) {
      // If recognition is already started, start() throws an error; safe to ignore
      console.warn('Recognition start caught:', err);
      setIsListening(true);
    }
  }, [stopSpeech]);

  // Initialize Speech Recognition instance
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPart + ' ';
        } else {
          interimTranscript += transcriptPart;
        }
      }

      const combined = (transcriptAccumulatorRef.current + finalTranscript + interimTranscript).trim();
      if (finalTranscript) {
        transcriptAccumulatorRef.current += finalTranscript;
      }

      setInputValue(combined);
      setLiveTranscript(combined);

      // In Live Voice Mode: Automatic silence detection (1.4 seconds of silence triggers auto-send)
      if (isLiveVoiceModeRef.current && combined.length > 0) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          handleSend(combined);
        }, 1400);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        console.warn('Speech recognition error:', event.error);
      }
      setIsListening(false);
      // In live mode, if error was 'no-speech' or temporary, re-listen unless processing/speaking
      if (isLiveVoiceModeRef.current && !isLoading && !isSpeakingRef.current) {
        setTimeout(() => {
          if (isLiveVoiceModeRef.current && !isSpeakingRef.current) {
            startListening();
          }
        }, 600);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // If still in live mode and not speaking or processing, keep mic open
      if (isLiveVoiceModeRef.current && !isLoading && !isSpeakingRef.current) {
        setTimeout(() => {
          if (isLiveVoiceModeRef.current && !isSpeakingRef.current && !isLoading) {
            startListening();
          }
        }, 400);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [handleSend, isLoading, startListening]);

  // Toggle Live Voice Mode
  const toggleLiveVoiceMode = () => {
    if (isLiveVoiceMode) {
      // Stop live voice mode
      setIsLiveVoiceMode(false);
      stopSpeech();
      stopListening();
      setLiveStatus('idle');
    } else {
      // Start live voice mode
      setIsLiveVoiceMode(true);
      setLiveStatus('listening');
      startListening();
    }
  };

  // Toggle mic in standard mode
  const toggleStandardMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Interrupt AI while speaking
  const handleInterrupt = () => {
    stopSpeech();
    if (isLiveVoiceMode) {
      startListening();
    }
  };

  // Preload voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      stopListening();
    };
  }, [stopSpeech, stopListening]);

  return (
    <>
      {/* Floating Action Button (FAB) positioned nicely above mobile bottom dock */}
      <div className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-40">
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            const nextOpen = !isOpen;
            setIsOpen(nextOpen);
            if (!nextOpen) {
              setIsLiveVoiceMode(false);
              stopSpeech();
              stopListening();
            }
          }}
          className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-xl transition-all duration-200 ${
            isOpen
              ? 'bg-neutral-800'
              : 'bg-neutral-900 shadow-neutral-900/25 ring-2 ring-neutral-900/10'
          }`}
          aria-label="AI Assistant"
        >
          {isOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <div className="relative">
              <Sparkles className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-neutral-900 animate-pulse" />
            </div>
          )}
        </motion.button>
      </div>

      {/* Sleek Chat Dialog with AnimatePresence */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="fixed bottom-34 md:bottom-20 right-3 sm:right-6 z-50 flex h-[520px] max-h-[80vh] w-[calc(100vw-24px)] max-w-sm flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-2xl"
          >
            {/* Header with Live Voice Toggle */}
            <div className="flex h-13 items-center justify-between border-b border-neutral-100 bg-white/95 backdrop-blur-md px-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-neutral-900 flex items-center gap-1.5">
                    Finance Assistant
                  </h3>
                  <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Database Tools
                  </span>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-1.5">
                {/* Live Voice Mode Toggle Pill */}
                <button
                  type="button"
                  onClick={toggleLiveVoiceMode}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                    isLiveVoiceMode
                      ? 'bg-rose-50 text-rose-600 border border-rose-200 ring-2 ring-rose-500/20 shadow-xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80 border border-neutral-200/60'
                  }`}
                  title={isLiveVoiceMode ? 'Exit Live Voice Mode' : 'Start Live Voice Conversation'}
                >
                  <Radio
                    className={`h-3 w-3 ${
                      isLiveVoiceMode ? 'animate-pulse text-rose-600' : 'text-neutral-400'
                    }`}
                  />
                  <span>{isLiveVoiceMode ? 'Live Voice' : 'Voice Mode'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsLiveVoiceMode(false);
                    stopSpeech();
                    stopListening();
                  }}
                  className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* LIVE VOICE MODE FULL INTERACTIVE HUD */}
            {isLiveVoiceMode ? (
              <div className="flex flex-1 flex-col items-center justify-between p-6 bg-gradient-to-b from-white via-neutral-50/50 to-neutral-100/40 text-center">
                {/* Live Status Pill */}
                <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-white px-3.5 py-1 text-xs font-medium text-neutral-700 shadow-2xs">
                  {liveStatus === 'listening' && (
                    <>
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-rose-600 font-semibold">Listening to you...</span>
                    </>
                  )}
                  {liveStatus === 'processing' && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-neutral-600" />
                      <span className="text-neutral-700">Thinking & querying database...</span>
                    </>
                  )}
                  {liveStatus === 'speaking' && (
                    <>
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-emerald-700 font-semibold">AI is speaking...</span>
                    </>
                  )}
                  {liveStatus === 'idle' && (
                    <>
                      <span className="h-2 w-2 rounded-full bg-neutral-400" />
                      <span className="text-neutral-500">Ready</span>
                    </>
                  )}
                </div>

                {/* Animated Concentric Sound Wave Sphere */}
                <div className="relative my-auto flex items-center justify-center">
                  {/* Outer pulsating glow rings */}
                  <motion.div
                    animate={{
                      scale: isListening ? [1, 1.35, 1] : isSpeaking ? [1, 1.25, 1] : 1,
                      opacity: isListening || isSpeaking ? [0.2, 0.4, 0.2] : 0.05,
                    }}
                    transition={{ repeat: Infinity, duration: isListening ? 1.5 : 2 }}
                    className={`absolute h-40 w-40 rounded-full ${
                      isListening
                        ? 'bg-rose-500'
                        : isSpeaking
                        ? 'bg-emerald-500'
                        : 'bg-neutral-300'
                    }`}
                  />
                  <motion.div
                    animate={{
                      scale: isListening ? [1, 1.2, 1] : isSpeaking ? [1, 1.15, 1] : 1,
                      opacity: isListening || isSpeaking ? [0.3, 0.6, 0.3] : 0.1,
                    }}
                    transition={{ repeat: Infinity, duration: isListening ? 1.2 : 1.8 }}
                    className={`absolute h-28 w-28 rounded-full ${
                      isListening
                        ? 'bg-rose-400'
                        : isSpeaking
                        ? 'bg-emerald-400'
                        : 'bg-neutral-200'
                    }`}
                  />

                  {/* Center Hero Orb */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={isSpeaking ? handleInterrupt : toggleStandardMic}
                    className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 ${
                      isListening
                        ? 'bg-rose-600 shadow-rose-600/30'
                        : isSpeaking
                        ? 'bg-emerald-600 shadow-emerald-600/30 ring-4 ring-emerald-100'
                        : 'bg-neutral-900'
                    }`}
                  >
                    {isSpeaking ? (
                      <Volume2 className="h-8 w-8 animate-pulse" />
                    ) : isListening ? (
                      <Mic className="h-8 w-8" />
                    ) : (
                      <MicOff className="h-8 w-8 text-neutral-400" />
                    )}
                  </motion.button>
                </div>

                {/* Real-time Subtitles / Live Transcript */}
                <div className="w-full max-w-xs space-y-1.5 px-2">
                  <div className="min-h-[50px] flex items-center justify-center">
                    {liveTranscript ? (
                      <p className="text-xs text-neutral-800 font-medium italic line-clamp-2">
                        &quot;{liveTranscript}&quot;
                      </p>
                    ) : isSpeaking ? (
                      <p className="text-xs text-neutral-500">
                        Speaking response... Tap orb or button to interrupt.
                      </p>
                    ) : isListening ? (
                      <p className="text-xs text-neutral-400">
                        Speak your question naturally. Silence auto-sends.
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-400">
                        Tap the orb to start speaking.
                      </p>
                    )}
                  </div>

                  {/* Live Mode Controls */}
                  <div className="flex items-center justify-center gap-2 pt-2">
                    {isSpeaking && (
                      <button
                        type="button"
                        onClick={handleInterrupt}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 shadow-2xs"
                      >
                        <Square className="h-3 w-3 fill-neutral-700" />
                        Interrupt & Speak
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsLiveVoiceMode(false)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 shadow-2xs"
                    >
                      <MessageSquare className="h-3 w-3" />
                      View Chat Log
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* STANDARD CHAT VIEW WITH AUDIO CONTROLS */
              <>
                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        m.sender === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`group relative max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                          m.sender === 'user'
                            ? 'bg-neutral-900 text-white font-medium rounded-br-xs shadow-2xs'
                            : 'bg-neutral-100/90 text-neutral-900 rounded-bl-xs border border-neutral-200/60'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{m.text}</div>

                        {/* Tool call indicator badge */}
                        {m.toolCalls && m.toolCalls.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1 border-t border-neutral-200/70 pt-1 text-[10px] text-neutral-500">
                            {m.toolCalls.map((tool, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[9px] font-medium text-neutral-600 border border-neutral-200"
                              >
                                <Database className="h-2.5 w-2.5 text-emerald-600" />
                                {tool.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* TTS Speaker Playback Button for Assistant Messages */}
                        {m.sender === 'assistant' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (currentSpeakingId === m.id) {
                                stopSpeech();
                              } else {
                                speakText(m.text, undefined, m.id);
                              }
                            }}
                            className={`mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                              currentSpeakingId === m.id
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'text-neutral-500 hover:bg-neutral-200/80 hover:text-neutral-800'
                            }`}
                            title={
                              currentSpeakingId === m.id
                                ? 'Stop speaking'
                                : 'Read aloud with Text-to-Speech'
                            }
                          >
                            {currentSpeakingId === m.id ? (
                              <>
                                <VolumeX className="h-3 w-3" />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-3 w-3" />
                                <span>Read aloud</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <span className="mt-0.5 text-[9px] text-neutral-400 px-1">
                        {m.timestamp}
                      </span>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex items-center gap-2 text-xs text-neutral-400 bg-neutral-50 px-3 py-2 rounded-xl w-fit">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-600" />
                      <span>Querying live database...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Prompts Carousel */}
                {messages.length <= 2 && (
                  <div className="border-t border-neutral-100 bg-neutral-50/60 px-3 py-2">
                    <p className="text-[10px] uppercase font-semibold text-neutral-400 mb-1.5 tracking-wider">
                      Suggestions
                    </p>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {QUICK_PROMPTS.map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSend(prompt)}
                          className="shrink-0 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] text-neutral-700 hover:border-neutral-900 transition-colors shadow-2xs"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="border-t border-neutral-100 p-2.5 bg-white"
                >
                  <div className="relative flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder={
                        isListening
                          ? 'Listening... Speak now'
                          : 'Ask about balance, debts, funds...'
                      }
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className={`w-full rounded-xl border bg-neutral-50/60 px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-hidden ${
                        isListening
                          ? 'border-rose-400 ring-2 ring-rose-100'
                          : 'border-neutral-200 focus:border-neutral-900'
                      }`}
                    />

                    {/* Mic Button (supports one-shot speech to text) */}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleStandardMic}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        isListening
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                      }`}
                      title={isListening ? 'Stop listening' : 'Speak message'}
                    >
                      {isListening ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </motion.button>

                    {/* Send Button */}
                    <motion.button
                      type="submit"
                      whileTap={{ scale: 0.9 }}
                      disabled={!inputValue.trim() || isLoading}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </motion.button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
