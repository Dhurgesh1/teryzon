import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { BorderBeam } from 'border-beam';
import { Liquid } from 'liquid-gooey';
import { ThinkingOrb } from 'thinking-orbs';
import { VoiceBeam, useMicrophone } from 'voice-glow';

const getTheme = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
const getReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function ChatbotLauncher({ panel }) {
  const cardRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(panel.classList.contains('is-open'));
  const [fullscreen, setFullscreen] = useState(panel.classList.contains('is-fullscreen'));
  const [theme, setTheme] = useState(getTheme);
  const [reducedMotion, setReducedMotion] = useState(getReducedMotion);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const parent = panel.parentElement;
    if (!card || !parent || panel.parentElement === card) return undefined;

    const placeholder = document.createComment('chatbot-panel-position');
    parent.insertBefore(placeholder, panel);
    card.appendChild(panel);

    return () => {
      if (placeholder.parentNode) placeholder.parentNode.insertBefore(panel, placeholder);
      placeholder.remove();
    };
  }, [panel]);

  useEffect(() => {
    const panelObserver = new MutationObserver(() => {
      setPanelOpen(panel.classList.contains('is-open'));
      setFullscreen(panel.classList.contains('is-fullscreen'));
    });
    const themeObserver = new MutationObserver(() => setTheme(getTheme()));
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setReducedMotion(motionQuery.matches);
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);

    panelObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    motionQuery.addEventListener('change', updateMotionPreference);
    window.addEventListener('resize', updateViewportWidth);

    return () => {
      panelObserver.disconnect();
      themeObserver.disconnect();
      motionQuery.removeEventListener('change', updateMotionPreference);
      window.removeEventListener('resize', updateViewportWidth);
    };
  }, [panel]);

  const labelVisible = expanded && !panelOpen;
  const panelRadius = viewportWidth <= 420 ? 16 : viewportWidth <= 720 ? 18 : 22;
  const launcherClass = [
    'teryzon-chatbot-launcher-beam',
    labelVisible && 'is-expanded',
    panelOpen && 'is-panel-open',
    fullscreen && 'is-panel-fullscreen'
  ].filter(Boolean).join(' ');

  return (
    <BorderBeam
      active={!reducedMotion}
      borderRadius={fullscreen ? 0 : panelOpen ? panelRadius : labelVisible ? 32 : 29}
      colorVariant="colorful"
      duration={3.2}
      size="pulse-outside"
      strength={0.7}
      theme={theme}
      className={launcherClass}
      style={{ position: 'fixed' }}
    >
      <div className="teryzon-chatbot-beam-content" ref={cardRef}>
        <button
          className="teryzon-chatbot-launcher"
          type="button"
          aria-label="Open Teryzon AI"
          aria-controls="teryzon-chatbot-panel"
          aria-expanded={panelOpen}
          aria-hidden={panelOpen}
          tabIndex={panelOpen ? -1 : 0}
          disabled={panelOpen}
          title="Ask Teryzon AI..."
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
          onFocus={() => setExpanded(true)}
          onBlur={() => setExpanded(false)}
        >
          <img src={theme === 'light' ? '/images/Chat%20bot%20animation1.svg' : '/images/Chat%20bot%20animation.svg'} alt="" />
          {labelVisible && <span>Ask Teryzon AI...</span>}
        </button>
      </div>
    </BorderBeam>
  );
}

function ChatbotInput({ panel }) {
  const { stream, supported, start, stop } = useMicrophone({ autoStart: false });
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechPrefixRef = useRef('');
  const silenceTimerRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [panelOpen, setPanelOpen] = useState(panel.classList.contains('is-open'));
  const [theme, setTheme] = useState(getTheme);
  const [reducedMotion, setReducedMotion] = useState(getReducedMotion);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const stopListening = () => {
    window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) recognition.stop();
    stop();
    setListening(false);
  };

  const startListening = () => {
    if (listening) {
      stopListening();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!supported || !SpeechRecognition) {
      setVoiceError('Voice input is not supported in this browser.');
      return;
    }

    setVoiceError('');
    speechPrefixRef.current = inputRef.current?.value.trim() || '';
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      const input = inputRef.current;
      if (!input) return;
      input.value = [speechPrefixRef.current, transcript].filter(Boolean).join(' ').slice(0, 4000);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (transcript) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = window.setTimeout(stopListening, 1500);
      }
    };

    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      recognitionRef.current = null;
      stop();
      setListening(false);
      setVoiceError(event.error === 'not-allowed' ? 'Microphone permission was denied.' : 'Voice input stopped. Try again.');
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      stop();
      setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      Promise.resolve(start()).catch(() => {
        if (recognitionRef.current !== recognition) return;
        recognitionRef.current = null;
        recognition.abort();
        setListening(false);
        setVoiceError('Microphone access was denied.');
      });
    } catch {
      recognitionRef.current = null;
      stop();
      setListening(false);
      setVoiceError('Unable to start voice input. Try again.');
    }
  };

  useEffect(() => {
    const panelObserver = new MutationObserver(() => {
      const open = panel.classList.contains('is-open');
      setPanelOpen(open);
      if (!open) stopListening();
    });
    const themeObserver = new MutationObserver(() => setTheme(getTheme()));
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setReducedMotion(motionQuery.matches);

    panelObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    motionQuery.addEventListener('change', updateMotionPreference);

    return () => {
      panelObserver.disconnect();
      themeObserver.disconnect();
      motionQuery.removeEventListener('change', updateMotionPreference);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      stop();
    };
  }, [panel]);

  useEffect(() => {
    const form = panel.querySelector('.teryzon-chatbot-form');
    form?.addEventListener('submit', stopListening, true);
    return () => form?.removeEventListener('submit', stopListening, true);
  }, [panel, listening]);

  useEffect(() => {
    const form = panel.querySelector('.teryzon-chatbot-form');
    form?.addEventListener('submit', stopListening, true);
    return () => form?.removeEventListener('submit', stopListening, true);
  }, [panel]);

  return (
    <BorderBeam
      active={panelOpen && !reducedMotion}
      colorVariant="colorful"
      size={focused ? 'line' : 'md'}
      strength={0.7}
      theme={theme}
      className="teryzon-chatbot-input-wrap"
      style={{ width: '100%' }}
    >
      <VoiceBeam
        active={panelOpen && !reducedMotion}
        colorVariant="colorful"
        stream={listening ? stream : null}
        theme={theme}
        className="teryzon-chatbot-voice-beam"
      >
        <textarea
          ref={inputRef}
          className="teryzon-chatbot-input"
          maxLength={4000}
          rows={1}
          placeholder="Ask Teryzon AI..."
          aria-label="Message Teryzon AI"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </VoiceBeam>
      <button
        className={`teryzon-chatbot-mic${listening ? ' is-listening' : ''}`}
        type="button"
        aria-label={listening ? 'Stop voice input' : 'Start voice input'}
        aria-pressed={listening}
        title={voiceError || (listening ? 'Stop voice input' : 'Start voice input')}
        onClick={startListening}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
        </svg>
      </button>
      {voiceError && <span className="teryzon-chatbot-voice-error" role="status">{voiceError}</span>}
    </BorderBeam>
  );
}

function ChatbotUploadMenu({ menu }) {
  const [open, setOpen] = useState(menu.classList.contains('is-open'));

  useEffect(() => {
    const observer = new MutationObserver(() => setOpen(menu.classList.contains('is-open')));
    observer.observe(menu, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [menu]);

  const transition = { duration: 550, ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)' };

  return (
    <Liquid fill="var(--teryzon-chat-panel)" blur={6} contrast={18} className="teryzon-chatbot-liquid-menu">
      <Liquid.Item x={open ? -54 : 0} y={open ? -34 : 0} transition={transition}>
        <button className="teryzon-chatbot-upload-option" type="button" data-upload-kind="file" aria-label="File upload" aria-hidden={!open} tabIndex={open ? 0 : -1} style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></svg>
        </button>
      </Liquid.Item>
      <Liquid.Item x={0} y={open ? -64 : 0} transition={transition} delay={40}>
        <button className="teryzon-chatbot-upload-option" type="button" data-upload-kind="image" aria-label="Image upload" aria-hidden={!open} tabIndex={open ? 0 : -1} style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
        </button>
      </Liquid.Item>
      <Liquid.Item>
        <button className="teryzon-chatbot-upload-trigger" type="button" data-chatbot-upload-toggle aria-label="Attach file or image" aria-expanded={open} title="Attach file or image">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </Liquid.Item>
    </Liquid>
  );
}

function ChatbotThinkingOrb({ container }) {
  const [state, setState] = useState(container.dataset.orbState || 'working');

  useEffect(() => {
    const observer = new MutationObserver(() => setState(container.dataset.orbState || 'working'));
    observer.observe(container, { attributes: true, attributeFilter: ['data-orb-state'] });
    return () => observer.disconnect();
  }, [container]);

  return <ThinkingOrb state={state} size={20} theme="auto" aria-label="Teryzon AI is working" />;
}

export function mountChatbotComponents({ inputHost, panel, launcherHost, uploadHost }) {
  const inputRoot = createRoot(inputHost);
  const launcherRoot = createRoot(launcherHost);
  const uploadRoot = createRoot(uploadHost);

  flushSync(() => {
    inputRoot.render(<ChatbotInput panel={panel} />);
    launcherRoot.render(<ChatbotLauncher panel={panel} />);
    uploadRoot.render(<ChatbotUploadMenu menu={uploadHost} />);
  });

  return { inputRoot, launcherRoot, uploadRoot };
}

export function mountThinkingOrb(container) {
  const root = createRoot(container);
  flushSync(() => root.render(<ChatbotThinkingOrb container={container} />));
  return root;
}