'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Mic,
  Send,
  X,
  Sparkles,
  Loader2,
  Database,
  Volume2,
  VolumeX,
  Radio,
  Square,
  Globe,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  toolCalls?: string[];
}

const INITIAL_MESSAGES_ML: ChatMessage[] = [
  {
    id: '1',
    sender: 'assistant',
    text: 'ഹലോ! എന്തൊക്കെയുണ്ട് വിശേഷം? നമ്മുടെ കയ്യിലുള്ള പണം, ആകെ തുക, സ്വിഗ്ഗി വരുമാനം, കടങ്ങൾ ഒക്കെ അറിയണമെങ്കിൽ ചോദിച്ചോളൂ ട്ടോ!',
    timestamp: 'Just now',
  },
];

const INITIAL_MESSAGES_EN: ChatMessage[] = [
  {
    id: '1',
    sender: 'assistant',
    text: "Hello! I'm your AI Cash Assistant. Ask me anything about My Cash, Grand Total, Swiggy earnings, debts, or external live funds. You can speak or type in Malayalam or English!",
    timestamp: 'Just now',
  },
];

const QUICK_PROMPTS_EN = [
  'What is my Grand Total Cash?',
  'What is my My Cash balance?',
  'How much did I earn from Swiggy?',
  'What are the external live fund balances?',
];

const QUICK_PROMPTS_ML = [
  'ഇപ്പോ മൊത്തം എത്ര രൂപയുണ്ട്?',
  'എന്റെ കയ്യിൽ സ്വന്തമായി എത്ര രൂപയുണ്ട്?',
  'സ്വിഗ്ഗിയിൽ നിന്ന് എത്ര കിട്ടി?',
  'കടം എന്തെങ്കിലും കൊടുക്കാനുണ്ടോ?',
];

const TOOL_LABELS_ML: Record<string, string> = {
  get_financial_summary: 'സാമ്പത്തിക വിവരങ്ങൾ',
  get_swiggy_details: 'സ്വിഗ്ഗി വിവരങ്ങൾ',
  get_debts_and_dues: 'കടങ്ങളുടെ വിവരങ്ങൾ',
  get_external_live_funds: 'തത്സമയ ഫണ്ടുകൾ',
  get_recent_transactions: 'ഇടപാടുകൾ',
};

/**
 * Normalizes text for human-like Text-To-Speech pronunciation:
 * - Strips commas from numbers (e.g. 16,119 -> 16119) so TTS engines don't pause awkwardly
 * - Converts ₹ / Rs. into "രൂപ" (for Malayalam) or "rupees" (for English)
 * - Strips markdown asterisks, bullet points, headers, backticks, pipes, colons
 * - Cleans excessive whitespace
 */
function cleanTextForSpeech(text: string, isMalayalam: boolean): string {
  if (!text) return '';
  const currencyWord = isMalayalam ? 'രൂപ' : 'rupees';
  return text
    // Remove commas from inside numbers e.g. 12,268 -> 12268
    .replace(/([0-9]),([0-9])/g, '$1$2')
    // Convert negative amounts smoothly
    .replace(/-\s*₹\s*([0-9.]+)/g, isMalayalam ? 'കുറവ് $1 രൂപ' : 'minus $1 rupees')
    // Convert ₹ / Rs. into currency word
    .replace(/₹\s*([0-9.]+)/g, `$1 ${currencyWord}`)
    .replace(/Rs\.?\s*([0-9.]+)/gi, `$1 ${currencyWord}`)
    // Format DD/MM/YYYY dates cleanly
    .replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, '$1 $2 $3')
    // Remove markdown bold, italic, code
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^[•\-*]\s+/gm, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    // Remove punctuation that causes awkward robotic pauses
    .replace(/[:|()_~[\]"']/g, ' ')
    .replace(/\.{2,}/g, '. ')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function AIAssistantFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES_ML);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLiveVoiceMode, setIsLiveVoiceMode] = useState(false);
  const [speechLang, setSpeechLang] = useState<'ml-IN' | 'en-IN'>('ml-IN');
  const [micError, setMicError] = useState<string | null>(null);
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveStatus, setLiveStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const isMicActiveRef = useRef(false);
  const isLiveVoiceModeRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isLoadingRef = useRef(false);
  const speechLangRef = useRef<'ml-IN' | 'en-IN'>('ml-IN');
  const silenceTimerRef = useRef<any>(null);
  const restartTimerRef = useRef<any>(null);
  const speechSynthIntervalRef = useRef<any>(null);
  const transcriptAccumulatorRef = useRef('');

  // Sync refs with state
  useEffect(() => {
    isLiveVoiceModeRef.current = isLiveVoiceMode;
  }, [isLiveVoiceMode]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    speechLangRef.current = speechLang;
    if (recognitionRef.current) {
      recognitionRef.current.lang = speechLang;
    }
  }, [speechLang]);

  // Load language preference from localStorage
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('cashmanager_ai_lang');
      if (savedLang === 'en-IN' || savedLang === 'ml-IN') {
        setSpeechLang(savedLang);
        if (savedLang === 'en-IN') {
          setMessages(INITIAL_MESSAGES_EN);
        }
      }
    } catch {}
  }, []);

  const toggleLanguage = () => {
    const nextLang = speechLang === 'ml-IN' ? 'en-IN' : 'ml-IN';
    setSpeechLang(nextLang);
    try {
      localStorage.setItem('cashmanager_ai_lang', nextLang);
    } catch {}
  };

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

  // Text-To-Speech engine using Web Speech API with native Malayalam tuning
  const speakText = useCallback(
    (rawText: string, onEnd?: () => void, messageId?: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onEnd?.();
        return;
      }

      stopSpeech();

      const isMalayalam = /[\u0D00-\u0D7F]/.test(rawText);
      const spokenText = cleanTextForSpeech(rawText, isMalayalam);
      if (!spokenText) {
        onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(spokenText);
      // Naturally paced rate for Malayalam voice clarity and natural tone
      utterance.rate = isMalayalam ? 0.94 : 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (isMalayalam) {
        utterance.lang = 'ml-IN';
        // Look for native Malayalam or Indic voices
        const mlVoice =
          voices.find(
            (v) =>
              v.lang.toLowerCase().replace('_', '-').startsWith('ml') ||
              v.lang.toLowerCase().replace('_', '-').includes('ml-in') ||
              v.name.toLowerCase().includes('malayalam')
          ) ||
          voices.find((v) => v.lang.toLowerCase().includes('hi-in')) ||
          voices.find((v) => v.lang.toLowerCase().includes('en-in')) ||
          voices[0];
        if (mlVoice) utterance.voice = mlVoice;
      } else {
        utterance.lang = 'en-IN';
        const preferredVoice =
          voices.find(
            (v) =>
              (v.lang.includes('en-IN') || v.lang.includes('en-US') || v.lang.includes('en-GB')) &&
              !v.name.includes('Bad')
          ) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        if (messageId) setCurrentSpeakingId(messageId);
        setLiveStatus('speaking');

        // Chrome keep-alive bug workaround
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

  // Stop speech recognition completely
  const stopListening = useCallback(() => {
    isMicActiveRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
  }, []);

  // Main Send & Backend query logic
  const handleSend = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend || inputValue || transcriptAccumulatorRef.current).trim();
      if (!text || isLoadingRef.current) return;

      stopListening();
      transcriptAccumulatorRef.current = '';
      setLiveTranscript('');
      setInputValue('');
      setIsLoading(true);
      isLoadingRef.current = true;
      setLiveStatus('processing');
      setMicError(null);

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
        const botResponseText = data.content || 'കണക്കുകൾ ഒക്കെ പരിശോധിച്ച് കഴിഞ്ഞിട്ടുണ്ട് ട്ടോ.';
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
        if (isLiveVoiceModeRef.current) {
          speakText(
            botResponseText,
            () => {
              // Once speaking finishes, automatically reopen mic if live mode is still active
              if (isLiveVoiceModeRef.current) {
                isMicActiveRef.current = true;
                startListening();
              }
            },
            botMessageId
          );
        }
      } catch (err: any) {
        console.error('Chat error:', err);
        const isMalayalam = speechLangRef.current === 'ml-IN';
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: isMalayalam
            ? 'കണക്കുകൾ എടുക്കാൻ ഒരു ചെറിയ തടസ്സം വന്നു ട്ടോ. ഒന്നുക്കൂടി ചോദിക്കാമോ?'
            : 'Sorry, I encountered an issue connecting to your financial database. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMessage]);

        if (isLiveVoiceModeRef.current) {
          speakText(errorMessage.text, () => {
            if (isLiveVoiceModeRef.current) {
              isMicActiveRef.current = true;
              startListening();
            }
          });
        }
      } finally {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    },
    [inputValue, messages, speakText, stopListening]
  );

  // Start continuous speech recognition with permission check & auto-restart guard
  const startListening = useCallback(async () => {
    stopSpeech();
    setMicError(null);

    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicError(
        speechLangRef.current === 'ml-IN'
          ? 'ഈ ബ്രൗസറിൽ സംസാരം തിരിച്ചറിയാനുള്ള സൗകര്യമില്ല. Chrome, Edge അല്ലെങ്കിൽ Safari ഉപയോഗിക്കൂ.'
          : 'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.'
      );
      return;
    }

    // Explicitly verify & request mic permission if supported via getUserMedia
    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setMicError(null);
      } catch (err: any) {
        if (
          err.name === 'NotAllowedError' ||
          err.name === 'PermissionDeniedError' ||
          err.message?.includes('denied')
        ) {
          setMicError(
            speechLangRef.current === 'ml-IN'
              ? 'മൈക്രോഫോൺ അനുമതി തടഞ്ഞിരിക്കുകയാണ്. സംസാരിക്കാൻ ബ്രൗസറിന്റെ സൈറ്റ് സെറ്റിങ്സിൽ മൈക്ക് ഓൺ ആക്കുക ട്ടോ.'
              : 'Microphone access is blocked in browser settings. Please enable microphone permission to speak.'
          );
          isMicActiveRef.current = false;
          setIsListening(false);
          return;
        }
      }
    }

    try {
      isMicActiveRef.current = true;
      transcriptAccumulatorRef.current = '';
      setLiveTranscript('');
      setLiveStatus('listening');
      setIsListening(true);
      setMicError(null);

      if (recognitionRef.current) {
        recognitionRef.current.lang = speechLangRef.current;
        try {
          recognitionRef.current.start();
        } catch (e: any) {
          // If already started or audio session busy, start() throws an exception; safe to ignore
        }
      }
    } catch (err: any) {
      console.warn('Recognition start caught:', err);
    }
  }, [stopSpeech]);

  // Initialize Speech Recognition instance with continuous listening & auto-reconnect
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = speechLang;

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

      if (finalTranscript) {
        transcriptAccumulatorRef.current += finalTranscript;
      }

      const currentFullText = (transcriptAccumulatorRef.current + interimTranscript).trim();
      setInputValue(currentFullText);
      setLiveTranscript(currentFullText);

      // Smart silence debounce timer: wait ~2.0s of silence before auto-submitting in Live Voice Mode
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (currentFullText.length > 0 && isLiveVoiceModeRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          if (isMicActiveRef.current && currentFullText.length > 0) {
            handleSend(currentFullText);
          }
        }, 2000);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        isMicActiveRef.current = false;
        setIsListening(false);
        setMicError(
          speechLangRef.current === 'ml-IN'
            ? 'മൈക്രോഫോൺ അനുമതി തടഞ്ഞിരിക്കുകയാണ്. സംസാരിക്കാൻ ബ്രൗസറിന്റെ സൈറ്റ് സെറ്റിങ്സിൽ മൈക്ക് ഓൺ ആക്കുക ട്ടോ.'
            : 'Microphone permission blocked. Please allow mic access in browser settings.'
        );
        return;
      }
      // 'no-speech' or 'aborted' are normal pauses during natural speaking.
      // NEVER stop listening on no-speech! Keep isMicActiveRef true so onend cleanly reconnects.
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition status:', event.error);
      }
    };

    recognition.onend = () => {
      // CONTINUOUS LISTENING ENGINE:
      // Browser SpeechRecognition engines prematurely end after 1 word or short pauses.
      // If user still wants mic on and we are not speaking or querying, automatically restart immediately!
      if (isMicActiveRef.current && !isLoadingRef.current && !isSpeakingRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);

        let retries = 4;
        const attemptRestart = () => {
          if (!isMicActiveRef.current || isLoadingRef.current || isSpeakingRef.current) {
            setIsListening(false);
            return;
          }
          try {
            recognition.start();
            setIsListening(true);
            setMicError(null);
          } catch (err: any) {
            retries -= 1;
            if (retries > 0 && isMicActiveRef.current) {
              restartTimerRef.current = setTimeout(attemptRestart, 120);
            }
          }
        };

        restartTimerRef.current = setTimeout(attemptRestart, 80);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [handleSend, speechLang]);

  // Toggle Live Voice Mode
  const toggleLiveVoiceMode = () => {
    if (isLiveVoiceMode) {
      setIsLiveVoiceMode(false);
      isMicActiveRef.current = false;
      stopSpeech();
      stopListening();
      setLiveStatus('idle');
    } else {
      setIsLiveVoiceMode(true);
      isMicActiveRef.current = true;
      setLiveStatus('listening');
      startListening();
    }
  };

  // Toggle mic in standard chat bar
  const toggleStandardMic = () => {
    if (isListening || isMicActiveRef.current) {
      isMicActiveRef.current = false;
      stopListening();
    } else {
      isMicActiveRef.current = true;
      startListening();
    }
  };

  // Interrupt AI while speaking
  const handleInterrupt = () => {
    stopSpeech();
    if (isLiveVoiceMode) {
      isMicActiveRef.current = true;
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

  const activeQuickPrompts = speechLang === 'ml-IN' ? QUICK_PROMPTS_ML : QUICK_PROMPTS_EN;

  return (
    <>
      {/* Floating Action Button (FAB) */}
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
              isMicActiveRef.current = false;
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
            {/* Header with Language Selector & Voice Toggle */}
            <div className="flex h-13 items-center justify-between border-b border-neutral-100 bg-white/95 backdrop-blur-md px-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-neutral-900 flex items-center gap-1.5">
                    {speechLang === 'ml-IN' ? 'സാമ്പത്തിക സഹായി' : 'Finance Assistant'}
                  </h3>
                  <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {speechLang === 'ml-IN' ? 'എഐ • തത്സമയം' : 'Gemini AI • Live Tools'}
                  </span>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-1.5">
                {/* Language Switcher Pill */}
                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors border border-neutral-200/80 bg-neutral-50 hover:bg-neutral-100 text-neutral-700"
                  title="Switch between Malayalam and English"
                >
                  <Globe className="h-3 w-3 text-emerald-600" />
                  <span>{speechLang === 'ml-IN' ? 'മലയാളം' : 'English'}</span>
                </button>

                {/* Live Voice Mode Toggle Pill */}
                <button
                  type="button"
                  onClick={toggleLiveVoiceMode}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                    isLiveVoiceMode
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80 border border-neutral-200/60'
                  }`}
                  title={isLiveVoiceMode ? 'Exit Live Voice Mode' : 'Start Live Voice Conversation'}
                >
                  <Radio
                    className={`h-3 w-3 ${
                      isLiveVoiceMode ? 'animate-pulse text-emerald-600' : 'text-neutral-400'
                    }`}
                  />
                  <span>
                    {isLiveVoiceMode
                      ? speechLang === 'ml-IN'
                        ? 'തത്സമയം'
                        : 'Live'
                      : speechLang === 'ml-IN'
                      ? 'ശബ്ദം'
                      : 'Voice'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsLiveVoiceMode(false);
                    isMicActiveRef.current = false;
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
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-emerald-700 font-semibold">
                        {speechLang === 'ml-IN' ? 'കേൾക്കുന്നുണ്ട്... സംസാരിച്ചോളൂ ട്ടോ' : 'Listening continuously... Speak naturally'}
                      </span>
                    </>
                  )}
                  {liveStatus === 'processing' && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-neutral-600" />
                      <span className="text-neutral-700">
                        {speechLang === 'ml-IN' ? 'കണക്കുകൾ പരിശോധിക്കുന്നു...' : 'Thinking & querying...'}
                      </span>
                    </>
                  )}
                  {liveStatus === 'speaking' && (
                    <>
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-emerald-700 font-semibold">
                        {speechLang === 'ml-IN' ? 'മറുപടി പറയുന്നു...' : 'AI is speaking...'}
                      </span>
                    </>
                  )}
                  {liveStatus === 'idle' && (
                    <>
                      <span className="h-2 w-2 rounded-full bg-neutral-400" />
                      <span className="text-neutral-500">
                        {speechLang === 'ml-IN' ? 'തയ്യാറാണ്' : 'Ready'}
                      </span>
                    </>
                  )}
                </div>

                {/* Animated Concentric Sound Wave Sphere */}
                <div className="relative my-auto flex items-center justify-center">
                  <motion.div
                    animate={{
                      scale: isListening ? [1, 1.35, 1] : isSpeaking ? [1, 1.25, 1] : 1,
                      opacity: isListening || isSpeaking ? [0.2, 0.45, 0.2] : 0.05,
                    }}
                    transition={{ repeat: Infinity, duration: isListening ? 1.5 : 2 }}
                    className={`absolute h-40 w-40 rounded-full ${
                      isListening
                        ? 'bg-emerald-500'
                        : isSpeaking
                        ? 'bg-teal-500'
                        : 'bg-neutral-300'
                    }`}
                  />
                  <motion.div
                    animate={{
                      scale: isListening ? [1, 1.2, 1] : isSpeaking ? [1, 1.15, 1] : 1,
                      opacity: isListening || isSpeaking ? [0.3, 0.65, 0.3] : 0.1,
                    }}
                    transition={{ repeat: Infinity, duration: isListening ? 1.2 : 1.8 }}
                    className={`absolute h-28 w-28 rounded-full ${
                      isListening
                        ? 'bg-emerald-400'
                        : isSpeaking
                        ? 'bg-teal-400'
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
                        ? 'bg-emerald-600 shadow-emerald-600/30 ring-4 ring-emerald-200/70'
                        : isSpeaking
                        ? 'bg-teal-600 shadow-teal-600/30 ring-4 ring-teal-200/70'
                        : 'bg-neutral-900'
                    }`}
                  >
                    {isSpeaking ? (
                      <Volume2 className="h-8 w-8 animate-pulse text-white" />
                    ) : isListening ? (
                      <Mic className="h-8 w-8 text-white animate-pulse" />
                    ) : (
                      <Mic className="h-8 w-8 text-neutral-300" />
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
                        {speechLang === 'ml-IN'
                          ? 'മറുപടി പറയുന്നു... തടസ്സപ്പെടുത്താൻ ടാപ്പ് ചെയ്യുക.'
                          : 'Speaking response... Tap orb or button to interrupt.'}
                      </p>
                    ) : isListening ? (
                      <p className="text-xs text-neutral-500">
                        {speechLang === 'ml-IN'
                          ? 'മുഴുവനായും സംസാരിച്ചോളൂ... ഇടയ്ക്ക് നിർത്തിയാലും മൈക്ക് ഓഫ് ആവില്ല ട്ടോ.'
                          : 'Speak your full sentence naturally... continuous listening active.'}
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-400">
                        {speechLang === 'ml-IN'
                          ? 'സംസാരിക്കാൻ ഓർബിൽ ടാപ്പ് ചെയ്യുക.'
                          : 'Tap the orb to start speaking.'}
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
                        {speechLang === 'ml-IN' ? 'നിർത്തി സംസാരിക്കുക' : 'Interrupt & Speak'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsLiveVoiceMode(false)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 shadow-2xs"
                    >
                      <MessageSquare className="h-3 w-3" />
                      {speechLang === 'ml-IN' ? 'കണക്കുകൾ കാണുക' : 'View Chat Log'}
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
                                {speechLang === 'ml-IN'
                                  ? TOOL_LABELS_ML[tool] || 'കണക്ക് വിവരങ്ങൾ'
                                  : tool.replace(/_/g, ' ')}
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
                                ? speechLang === 'ml-IN'
                                  ? 'നിർത്തുക'
                                  : 'Stop speaking'
                                : speechLang === 'ml-IN'
                                ? 'ശബ്ദത്തിൽ കേൾക്കുക'
                                : 'Read aloud with Text-to-Speech'
                            }
                          >
                            {currentSpeakingId === m.id ? (
                              <>
                                <VolumeX className="h-3 w-3" />
                                <span>{speechLang === 'ml-IN' ? 'നിർത്തുക' : 'Stop'}</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-3 w-3" />
                                <span>{speechLang === 'ml-IN' ? 'കേൾക്കുക' : 'Read aloud'}</span>
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
                      <span>
                        {speechLang === 'ml-IN'
                          ? 'കണക്കുകൾ പരിശോധിക്കുന്നു...'
                          : 'Querying live database...'}
                      </span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Prompts Carousel */}
                {messages.length <= 2 && (
                  <div className="border-t border-neutral-100 bg-neutral-50/60 px-3 py-2">
                    <p className="text-[10px] uppercase font-semibold text-neutral-400 mb-1.5 tracking-wider">
                      {speechLang === 'ml-IN' ? 'നിർദ്ദേശങ്ങൾ' : 'Suggestions'}
                    </p>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {activeQuickPrompts.map((prompt, idx) => (
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

                {/* Microphone Error Notification Banner with Retry */}
                {micError && (
                  <div className="mx-2.5 mt-2 flex items-center justify-between gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-900 shadow-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <span className="truncate">{micError}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setMicError(null);
                          startListening();
                        }}
                        className="rounded px-2 py-0.5 text-[10px] font-medium bg-amber-200/90 hover:bg-amber-300 text-amber-950 transition-colors"
                      >
                        {speechLang === 'ml-IN' ? 'വീണ്ടും ശ്രമിക്കുക' : 'Retry'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMicError(null)}
                        className="text-amber-600 hover:text-amber-900 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
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
                          ? speechLang === 'ml-IN'
                            ? 'കേൾക്കുന്നുണ്ട്... മുഴുവനായി സംസാരിച്ചോളൂ ട്ടോ'
                            : 'Listening continuously... Speak your sentence'
                          : speechLang === 'ml-IN'
                          ? 'ചോദിച്ചോളൂ (ഉദാ: കയ്യിലുള്ള പണം, സ്വിഗ്ഗി, കടം...)'
                          : 'Ask about My Cash, Grand Total, funds...'
                      }
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className={`w-full rounded-xl border bg-neutral-50/60 px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-hidden ${
                        isListening
                          ? 'border-emerald-500 ring-2 ring-emerald-100'
                          : 'border-neutral-200 focus:border-neutral-900'
                      }`}
                    />

                    {/* Mic Button: Continuous listening with auto-reconnect, no crossed-out icon */}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleStandardMic}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all ${
                        isListening
                          ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/50 animate-pulse'
                          : micError
                          ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                      }`}
                      title={
                        isListening
                          ? 'Listening continuously. Click to stop'
                          : speechLang === 'ml-IN'
                          ? 'മലയാളത്തിൽ സംസാരിക്കൂ'
                          : 'Speak message'
                      }
                    >
                      <Mic className="h-4 w-4" />
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
