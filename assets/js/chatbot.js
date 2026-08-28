const CHAT_KEY = 'teryzon-chat-history';
const API_URL = window.TERYZON_CHAT_API_URL || 'https://zeryppqymzbqesllxnvk.supabase.co/functions/v1/teryzon-chat';
const MAX_INPUT = 4000;
const MAX_HISTORY = 12;
const quickActions = ['What is Teryzon?', 'How does the rover work?', 'Environmental monitoring', 'Explain my data', 'Technology used'];

const escapeHtml = (value) => value.replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character]));
const renderMarkdown = (source) => {
  let html = escapeHtml(String(source)).replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>').replace(/^## (.+)$/gm, '<h4>$1</h4>').replace(/^# (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>').replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.split(/\n{2,}/).map((part) => part.startsWith('<pre>') || part.startsWith('<ul>') || part.startsWith('<h4>') ? part : `<p>${part.replace(/\n/g, '<br>')}</p>`).join('');
  return html.replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
};

const icon = (path) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" aria-hidden="true">${path}</svg>`;
const timestamp = () => new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(new Date());
const loadHistory = () => { try { const history = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]'); return Array.isArray(history) ? history.slice(-MAX_HISTORY) : []; } catch { return []; } };
const saveHistory = (history) => localStorage.setItem(CHAT_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));

const boot = () => {
  if (document.querySelector('.teryzon-chatbot-launcher')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <button class="teryzon-chatbot-launcher" type="button" aria-label="Open Teryzon AI" aria-controls="teryzon-chatbot-panel" aria-expanded="false">${icon('<path d="M12 4a8 8 0 0 0-8 8c0 1.8.6 3.4 1.7 4.7L5 20l3.3-1.7A8 8 0 1 0 12 4Z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" stroke-width="2.4"/>')}</button>
    <section class="teryzon-chatbot-panel" id="teryzon-chatbot-panel" role="dialog" aria-modal="false" aria-labelledby="teryzon-chatbot-title" aria-hidden="true">
      <header class="teryzon-chatbot-header"><div class="teryzon-chatbot-logo">${icon('<path d="M12 4a8 8 0 0 0-8 8c0 1.8.6 3.4 1.7 4.7L5 20l3.3-1.7A8 8 0 1 0 12 4Z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" stroke-width="2.4"/>')}</div><div class="teryzon-chatbot-heading"><strong id="teryzon-chatbot-title">Teryzon AI</strong><span class="teryzon-chatbot-status">Online</span></div><button class="teryzon-chatbot-button" data-chat-action="new" type="button" aria-label="Start new chat" title="New chat">${icon('<path d="M3 12a9 9 0 0 0 15.3 6.4M21 12A9 9 0 0 0 5.7 5.6M3 17v-5h5M21 7v5h-5"/>')}</button><button class="teryzon-chatbot-button" data-chat-action="close" type="button" aria-label="Close Teryzon AI">${icon('<path d="m6 6 12 12M18 6 6 18"/>')}</button></header>
      <div class="teryzon-chatbot-messages" aria-live="polite"></div><div class="teryzon-chatbot-quick-wrap"></div>
      <form class="teryzon-chatbot-form"><textarea class="teryzon-chatbot-input" maxlength="4000" rows="1" placeholder="Ask Teryzon AI..." aria-label="Message Teryzon AI"></textarea><button class="teryzon-chatbot-send" type="submit" aria-label="Send message">${icon('<path d="m5 12 14-7-3 14-4-6-7-1Z"/><path d="m12 13 7-8"/>')}</button></form>
    </section>`);

  const launcher = document.querySelector('.teryzon-chatbot-launcher'); const panel = document.querySelector('.teryzon-chatbot-panel'); const messages = panel.querySelector('.teryzon-chatbot-messages'); const input = panel.querySelector('.teryzon-chatbot-input'); const form = panel.querySelector('.teryzon-chatbot-form'); const send = panel.querySelector('.teryzon-chatbot-send'); const quickWrap = panel.querySelector('.teryzon-chatbot-quick-wrap');
  let history = loadHistory(); let lastFailed = null; let pending = false;
  const welcome = { role: 'assistant', content: "Hi! I'm Teryzon AI.\n\nI can help you learn about Teryzon, our rover, environmental monitoring, ecological restoration, and how the platform works.\n\nHow can I help you today?", time: timestamp() };
  const renderMessage = (message) => `<article class="teryzon-chatbot-message ${message.role === 'user' ? 'is-user' : ''}"><div class="teryzon-chatbot-bubble">${renderMarkdown(message.content)}<small class="teryzon-chatbot-time">${message.time || timestamp()}</small>${message.error ? '<button class="teryzon-chatbot-quick" data-chat-retry type="button">Retry</button>' : ''}</div></article>`;
  const render = () => { messages.innerHTML = history.length ? history.map(renderMessage).join('') : renderMessage(welcome); messages.scrollTop = messages.scrollHeight; quickWrap.innerHTML = history.length ? '' : quickActions.map((action) => `<button class="teryzon-chatbot-quick" type="button">${escapeHtml(action)}</button>`).join(''); };
  const toggle = (open) => { panel.classList.toggle('is-open', open); panel.setAttribute('aria-hidden', String(!open)); panel.setAttribute('aria-modal', String(open && innerWidth <= 560)); launcher.setAttribute('aria-expanded', String(open)); if (open) { input.focus(); document.body.style.overflow = innerWidth <= 560 ? 'hidden' : ''; } else document.body.style.overflow = ''; };
  const setPending = (value) => { pending = value; input.disabled = value; send.disabled = value; if (value) { messages.insertAdjacentHTML('beforeend', `<article class="teryzon-chatbot-message" data-typing><div class="teryzon-chatbot-bubble"><div class="teryzon-chatbot-typing" aria-label="Teryzon AI is typing"><span>●</span><span>●</span><span>●</span></div></div></article>`); messages.scrollTop = messages.scrollHeight; } else messages.querySelector('[data-typing]')?.remove(); };
  const request = async (text) => { if (pending || !text.trim()) return; const message = { role: 'user', content: text.trim().slice(0, MAX_INPUT), time: timestamp() }; history.push(message); saveHistory(history); render(); setPending(true); try { const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })).slice(-MAX_HISTORY) }) }); if (!response.ok) throw new Error('request failed'); const data = await response.json(); if (!data.message) throw new Error('empty response'); history.push({ role: 'assistant', content: data.message, time: timestamp() }); saveHistory(history); lastFailed = null; } catch { lastFailed = message.content; history.push({ role: 'assistant', content: navigator.onLine ? "Sorry, I'm having trouble connecting right now. Please try again." : "You're currently offline. Please check your internet connection and try again.", error: true, time: timestamp() }); } finally { setPending(false); render(); } };
  launcher.addEventListener('click', () => toggle(true)); panel.querySelector('[data-chat-action="close"]').addEventListener('click', () => toggle(false)); panel.querySelector('[data-chat-action="new"]').addEventListener('click', () => { history = []; lastFailed = null; saveHistory(history); render(); input.focus(); });
  quickWrap.addEventListener('click', (event) => { if (event.target.matches('.teryzon-chatbot-quick')) request(event.target.textContent); });
  messages.addEventListener('click', (event) => { if (event.target.matches('[data-chat-retry]') && lastFailed) { history.splice(-2, 2); saveHistory(history); render(); request(lastFailed); } });
  form.addEventListener('submit', (event) => { event.preventDefault(); const text = input.value; input.value = ''; request(text); });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && panel.classList.contains('is-open')) toggle(false); });
  render();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
