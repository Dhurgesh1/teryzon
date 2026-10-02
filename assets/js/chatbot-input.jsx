import React, { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { BorderBeam } from 'border-beam';
import { BotAvatar } from 'bot-avatars';
import { Liquid } from 'liquid-gooey';
import { ThinkingOrb } from 'thinking-orbs';

const getTheme = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
const getReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function ChatbotInput({ panel }) {
  const [focused, setFocused] = useState(false);
  const [panelOpen, setPanelOpen] = useState(panel.classList.contains('is-open'));
  const [theme, setTheme] = useState(getTheme);
  const [reducedMotion, setReducedMotion] = useState(getReducedMotion);

  useEffect(() => {
    const panelObserver = new MutationObserver(() => {
      setPanelOpen(panel.classList.contains('is-open'));
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
    };
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
      <textarea
        className="teryzon-chatbot-input"
        maxLength={4000}
        rows={1}
        placeholder="Ask Teryzon AI..."
        aria-label="Message Teryzon AI"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
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
    launcherRoot.render(<BotAvatar type="circle" size={48} shading="plastic" face="mouth" interactive={false} theme="auto" />);
    uploadRoot.render(<ChatbotUploadMenu menu={uploadHost} />);
  });

  return { inputRoot, launcherRoot, uploadRoot };
}

export function mountThinkingOrb(container) {
  const root = createRoot(container);
  flushSync(() => root.render(<ChatbotThinkingOrb container={container} />));
  return root;
}