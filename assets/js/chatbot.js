const CHAT_KEY = 'teryzon-chat-sessions-v1';
const ACTIVE_CHAT_KEY = 'teryzon-active-chat-v1';
const API_URL = window.TERYZON_CHAT_API_URL || 'https://zeryppqymzbqesllxnvk.supabase.co/functions/v1/teryzon-chat';
const MAX_INPUT = 4000;
const MAX_HISTORY = 12;
const MAX_SESSIONS = 12;
const MAX_DOCUMENT_CHARS = 20000;
const MAX_DOCUMENT_PAGES = 100;
const MAX_ATTACHMENTS = 4;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const quickActions = ['What is Teryzon?', 'How does the rover work?', 'Environmental monitoring', 'Explain my data', 'Technology used'];

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const clampDocumentText = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > MAX_DOCUMENT_CHARS ? `${text.slice(0, MAX_DOCUMENT_CHARS)}\n\n[Document content truncated to protect message size.]` : text;
};
const renderMarkdown = (source) => {
  let html = escapeHtml(source).replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>').replace(/^## (.+)$/gm, '<h4>$1</h4>').replace(/^# (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>').replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.split(/\n{2,}/).map((part) => part.startsWith('<pre>') || part.startsWith('<ul>') || part.startsWith('<h4>') ? part : `<p>${part.replace(/\n/g, '<br>')}</p>`).join('');
  return html.replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
};

const icon = (path) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" aria-hidden="true">${path}</svg>`;
const timestamp = () => new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(new Date());
const formatSize = (bytes) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
};
const createId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const loadSessions = () => {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id && Array.isArray(item.messages)).slice(0, MAX_SESSIONS) : [];
  } catch {
    return [];
  }
};
const saveSessions = (sessions) => localStorage.setItem(CHAT_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
const getActiveChatId = () => localStorage.getItem(ACTIVE_CHAT_KEY) || null;
const setActiveChatId = (id) => localStorage.setItem(ACTIVE_CHAT_KEY, id);

const createSession = (title = 'New chat') => ({
  id: createId(),
  title,
  updatedAt: Date.now(),
  messages: []
});

const sanitizeAttachment = (attachment) => ({
  id: attachment.id || createId(),
  name: String(attachment.name || 'Attachment'),
  type: String(attachment.type || 'file'),
  size: Number(attachment.size || 0),
  kind: attachment.kind || (attachment.type && attachment.type.startsWith('image/') ? 'image' : 'file'),
  dataUrl: attachment.dataUrl || '',
  extractedText: attachment.extractedText || '',
  extractionStatus: attachment.extractionStatus || '',
  error: attachment.error || ''
});

const isPdfFile = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
const isDocxFile = (file) => file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(file.name || '');
const isWordFile = (file) => file.type === 'application/msword' || /\.doc$/i.test(file.name || '');
const isJsonFile = (file) => file.type === 'application/json' || /\.json$/i.test(file.name || '');
const isCsvFile = (file) => file.type === 'text/csv' || /\.csv$/i.test(file.name || '');
const isTextFile = (file) => file.type.startsWith('text/') || /\.(txt|md|log)$/i.test(file.name || '');

const readTextFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Unable to read file'));
  reader.readAsText(file);
});

const limitText = (text) => clampDocumentText(text).slice(0, MAX_DOCUMENT_CHARS);

const extractPdfText = async (file) => {
  const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.mjs');
  if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.mjs';
  }
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, MAX_DOCUMENT_PAGES); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ').replace(/\s+/g, ' ').trim();
    pages.push(`--- Page ${pageNumber} ---\n${text || '[No selectable text found on this page.]'}`);
  }
  const extracted = pages.join('\n\n');
  if (!/\S/.test(extracted.replace(/--- Page \d+ ---|\[No selectable text found on this page\.\]/g, ''))) {
    throw new Error('This PDF appears to be scanned or contains no selectable text. OCR/image-based processing is required.');
  }
  return extracted;
};

const extractDocxText = async (file) => {
  const mammoth = await import('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  if (!result?.value || !result.value.trim()) {
    throw new Error('This DOCX file is empty or could not be read.');
  }
  return result.value;
};

const extractTextAttachment = async (file) => {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('This document is too large to process in the chat.');
  }

  if (isPdfFile(file)) return extractPdfText(file);
  if (isDocxFile(file)) return extractDocxText(file);
  if (isWordFile(file)) {
    throw new Error('Legacy DOC files are not supported in this browser environment. Please convert to DOCX or TXT.');
  }
  if (isJsonFile(file)) {
    const text = await readTextFile(file);
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  if (isCsvFile(file)) {
    return await readTextFile(file);
  }
  if (isTextFile(file)) {
    return await readTextFile(file);
  }
  throw new Error('This file type is not supported for document analysis.');
};

const resizeImageDataUrl = (dataUrl, maxDimension = MAX_IMAGE_DIMENSION) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width || 1, image.naturalHeight || image.height || 1));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      resolve(dataUrl);
      return;
    }
    context.drawImage(image, 0, 0, width, height);
    resolve(canvas.toDataURL('image/jpeg', 0.82));
  };
  image.onerror = () => reject(new Error('Unable to read image')); 
  image.src = dataUrl;
});

const trimTitle = (value) => {
  const text = String(value || '').trim();
  return text ? text.slice(0, 28) : 'New chat';
};

const renderAttachmentChip = (attachment) => {
  const preview = attachment.kind === 'image' && attachment.dataUrl
    ? `<img src="${attachment.dataUrl}" alt="${escapeHtml(attachment.name)}">`
    : `<span class="teryzon-chatbot-file-badge">${attachment.kind === 'image' ? 'IMG' : 'FILE'}</span>`;

  return `
    <div class="teryzon-chatbot-attachment-chip" data-attachment-id="${attachment.id}">
      ${preview}
      <div class="teryzon-chatbot-attachment-meta">
        <span class="teryzon-chatbot-attachment-name">${escapeHtml(attachment.name)}</span>
        <small>${formatSize(attachment.size)}</small>
      </div>
    </div>
  `;
};

const renderMessage = (message) => {
  const attachments = (message.attachments || []).map(renderAttachmentChip).join('');
  return `
    <article class="teryzon-chatbot-message ${message.role === 'user' ? 'is-user' : ''}">
      <div class="teryzon-chatbot-bubble">
        ${renderMarkdown(message.content || '')}
        ${attachments ? `<div class="teryzon-chatbot-attachment-row">${attachments}</div>` : ''}
        <small class="teryzon-chatbot-time">${message.time || timestamp()}</small>
        ${message.error ? '<button class="teryzon-chatbot-quick" data-chat-retry type="button">Retry</button>' : ''}
      </div>
    </article>
  `;
};

const boot = () => {
  if (document.querySelector('.teryzon-chatbot-launcher')) return;

  const currentUrl = `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`.toLowerCase();
  const legalRoutes = [
    '/accessibility',
    '/accessibility.html',
    '/cookie-policy',
    '/cookie-policy.html',
    '/privacy-policy',
    '/privacy-policy.html',
    '/terms-of-service',
    '/terms-of-service.html'
  ];
  const shouldHideLogo = legalRoutes.some((route) => currentUrl === route || currentUrl.endsWith(route) || currentUrl.includes(route));

  document.body.insertAdjacentHTML('beforeend', `
    <button class="teryzon-chatbot-launcher" type="button" aria-label="Open Teryzon AI" aria-controls="teryzon-chatbot-panel" aria-expanded="false">${icon('<path d="M12 4a8 8 0 0 0-8 8c0 1.8.6 3.4 1.7 4.7L5 20l3.3-1.7A8 8 0 1 0 12 4Z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" stroke-width="2.4"/>')}</button>
    <section class="teryzon-chatbot-panel" id="teryzon-chatbot-panel" role="dialog" aria-modal="false" aria-labelledby="teryzon-chatbot-title" aria-hidden="true">
      <aside class="teryzon-chatbot-sidebar">
        <div class="teryzon-chatbot-sidebar-header">
          <div>
            <span class="teryzon-chatbot-sidebar-label">Recent chats</span>
            <strong>Conversations</strong>
          </div>
          <button class="teryzon-chatbot-button" data-chat-action="new" type="button" aria-label="Start new chat" title="New chat">${icon('<path d="M12 5v14M5 12h14"/>')}</button>
        </div>
        <div class="teryzon-chatbot-sidebar-list" aria-live="polite"></div>
      </aside>
      <div class="teryzon-chatbot-window">
        <header class="teryzon-chatbot-header">
          <button class="teryzon-chatbot-button sidebar-toggle" data-chat-action="toggle-sidebar" type="button" aria-label="Toggle chat list">${icon('<path d="M15 18l-6-6 6-6"/>')}</button>
          ${shouldHideLogo ? '' : `<div class="teryzon-chatbot-logo">${icon('<path d="M12 4a8 8 0 0 0-8 8c0 1.8.6 3.4 1.7 4.7L5 20l3.3-1.7A8 8 0 1 0 12 4Z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" stroke-width="2.4"/>')}</div>`}
          <div class="teryzon-chatbot-heading">
            <strong id="teryzon-chatbot-title">Teryzon AI</strong>
            <span class="teryzon-chatbot-status">Online</span>
          </div>
          <button class="teryzon-chatbot-button" data-chat-action="fullscreen" type="button" aria-label="Expand chat to full screen">${icon('<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>')}</button>
          <button class="teryzon-chatbot-button" data-chat-action="close" type="button" aria-label="Close Teryzon AI">${icon('<path d="m6 6 12 12M18 6 6 18"/>')}</button>
        </header>
        <div class="teryzon-chatbot-messages" aria-live="polite"></div>
        <div class="teryzon-chatbot-upload-bar" aria-live="polite"></div>
        <div class="teryzon-chatbot-quick-wrap"></div>
        <form class="teryzon-chatbot-form">
          <div class="teryzon-chatbot-upload-menu" hidden>
            <button type="button" data-upload-kind="file">File upload</button>
            <button type="button" data-upload-kind="image">Image upload</button>
          </div>
          <input class="teryzon-chatbot-file-input" type="file" accept=".pdf,.doc,.docx,.txt,.csv,.json,image/*" multiple hidden>
          <button class="teryzon-chatbot-upload-trigger" type="button" aria-label="Attach file or image">${icon('<path d="M12 5v14M5 12h14"/>')}</button>
          <textarea class="teryzon-chatbot-input" maxlength="4000" rows="1" placeholder="Ask Teryzon AI..." aria-label="Message Teryzon AI"></textarea>
          <button class="teryzon-chatbot-send" type="submit" aria-label="Send message">${icon('<path d="m5 12 14-7-3 14-4-6-7-1Z"/><path d="m12 13 7-8"/>')}</button>
        </form>
      </div>
    </section>`);

  const launcher = document.querySelector('.teryzon-chatbot-launcher');
  const panel = document.querySelector('.teryzon-chatbot-panel');
  const sidebarList = panel.querySelector('.teryzon-chatbot-sidebar-list');
  const messages = panel.querySelector('.teryzon-chatbot-messages');
  const uploadBar = panel.querySelector('.teryzon-chatbot-upload-bar');
  const input = panel.querySelector('.teryzon-chatbot-input');
  const form = panel.querySelector('.teryzon-chatbot-form');
  const send = panel.querySelector('.teryzon-chatbot-send');
  const quickWrap = panel.querySelector('.teryzon-chatbot-quick-wrap');
  const uploadMenu = panel.querySelector('.teryzon-chatbot-upload-menu');
  const fileInput = panel.querySelector('.teryzon-chatbot-file-input');
  const uploadTrigger = panel.querySelector('.teryzon-chatbot-upload-trigger');
  const sidebarToggle = panel.querySelector('[data-chat-action="toggle-sidebar"]');

  const getStoredSessions = () => {
    const sessions = loadSessions();
    if (sessions.length) return sessions;
    const fallback = [createSession('New chat')];
    saveSessions(fallback);
    return fallback;
  };

  let sessions = getStoredSessions();
  let activeChatId = getActiveChatId() || sessions[0].id;
  let pending = false;
  let lastFailed = null;
  let pendingUploads = [];

  const ensureActiveSession = () => {
    if (!sessions.some((session) => session.id === activeChatId)) {
      activeChatId = sessions[0]?.id || createSession().id;
    }
    setActiveChatId(activeChatId);
  };

  const getActiveSession = () => sessions.find((session) => session.id === activeChatId) || sessions[0];

  const saveCurrent = () => {
    sessions = sessions.sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
    saveSessions(sessions);
    setActiveChatId(activeChatId);
  };

  const renderSessionList = () => {
    sidebarList.innerHTML = sessions.map((session) => {
      const isActive = session.id === activeChatId;
      const preview = session.messages.at(-1)?.content || 'No messages yet';
      return `
        <button type="button" class="teryzon-chatbot-session ${isActive ? 'is-active' : ''}" data-session-id="${session.id}">
          <span class="teryzon-chatbot-session-title">${escapeHtml(session.title || 'New chat')}</span>
          <span class="teryzon-chatbot-session-preview">${escapeHtml(preview.slice(0, 48))}</span>
          <span class="teryzon-chatbot-session-actions">
            <span class="teryzon-chatbot-session-action" data-session-action="rename" data-session-id="${session.id}" title="Rename chat">✎</span>
            <span class="teryzon-chatbot-session-action danger" data-session-action="delete" data-session-id="${session.id}" title="Delete chat">✕</span>
          </span>
        </button>
      `;
    }).join('');
  };

  const renderPendingUploads = () => {
    uploadBar.innerHTML = pendingUploads.length
      ? pendingUploads.map((attachment) => `
          <div class="teryzon-chatbot-upload-chip">
            <span>${escapeHtml(attachment.name)}</span>
            <button type="button" class="teryzon-chatbot-upload-remove" data-upload-remove="${attachment.id}" aria-label="Remove attachment">×</button>
          </div>
        `).join('')
      : '';
  };

  const renderCurrentSession = () => {
    const activeSession = getActiveSession();
    if (!activeSession) return;
    const messagesToRender = activeSession.messages.length ? activeSession.messages : [{ role: 'assistant', content: "Hi! I'm Teryzon AI.\n\nI can help you learn about Teryzon, our rover, environmental monitoring, ecological restoration, and how the platform works.\n\nHow can I help you today?", time: timestamp() }];
    messages.innerHTML = messagesToRender.map(renderMessage).join('');
    messages.scrollTop = messages.scrollHeight;
    quickWrap.innerHTML = activeSession.messages.length ? '' : quickActions.map((action) => `<button class="teryzon-chatbot-quick" type="button">${escapeHtml(action)}</button>`).join('');
  };

  const setPending = (value) => {
    pending = value;
    send.disabled = value;
    input.disabled = value;
    if (value) {
      messages.insertAdjacentHTML('beforeend', `<article class="teryzon-chatbot-message" data-typing><div class="teryzon-chatbot-bubble"><div class="teryzon-chatbot-typing" aria-label="Teryzon AI is typing"><span>●</span><span>●</span><span>●</span></div></div></article>`);
      messages.scrollTop = messages.scrollHeight;
    } else {
      messages.querySelector('[data-typing]')?.remove();
    }
  };

  const togglePanel = (open) => {
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', String(!open));
    launcher.setAttribute('aria-expanded', String(open));
    if (open) {
      input.focus();
      document.body.style.overflow = window.innerWidth <= 560 ? 'hidden' : '';
    } else {
      document.body.style.overflow = '';
    }
  };

  const toggleFullscreen = () => {
    const isFullscreen = panel.classList.toggle('is-fullscreen');
    const button = panel.querySelector('[data-chat-action="fullscreen"]');
    button.setAttribute('aria-label', isFullscreen ? 'Restore chat window' : 'Expand chat to full screen');
    button.innerHTML = isFullscreen
      ? icon('<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/><path d="M3 8h5v8H3zM16 8h5v8h-5z"/>')
      : icon('<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>');
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = window.innerWidth <= 560 ? 'hidden' : '';
    }
  };

  const closeUploadMenu = () => {
    uploadMenu.hidden = true;
    uploadTrigger.setAttribute('aria-expanded', 'false');
  };

  const toggleSidebar = () => {
    const collapsed = panel.classList.toggle('is-sidebar-collapsed');
    sidebarToggle.setAttribute('aria-label', collapsed ? 'Expand chat list' : 'Collapse chat list');
    sidebarToggle.innerHTML = collapsed
      ? icon('<path d="M9 18l6-6-6-6"/>')
      : icon('<path d="M15 18l-6-6 6-6"/>');
  };

  const triggerUploadInput = (kind) => {
    const accepted = kind === 'image' ? 'image/*' : '.pdf,.doc,.docx,.txt,.csv,.json,image/*';
    fileInput.setAttribute('accept', accepted);
    fileInput.multiple = true;
    fileInput.value = '';
    fileInput.click();
    closeUploadMenu();
  };

  const addPendingAttachments = async (files) => {
    const validFiles = Array.from(files)
      .filter((file) => file && file.size > 0)
      .filter((file) => file.size <= MAX_FILE_BYTES || file.type.startsWith('image/'));
    const remainingSlots = Math.max(0, MAX_ATTACHMENTS - pendingUploads.length);
    const selected = validFiles.slice(0, remainingSlots);

    if (!selected.length) {
      if (validFiles.length > 0) {
        const message = validFiles.length > MAX_ATTACHMENTS ? `You can upload up to ${MAX_ATTACHMENTS} files at a time.` : 'One or more files were too large to process.';
        window.alert(message);
      }
      return;
    }

    const items = await Promise.all(selected.map(async (file) => {
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name || '');
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
      const reader = new FileReader();
      const dataUrl = isImage ? await new Promise((resolve, reject) => {
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Unable to read image'));
        reader.readAsDataURL(file);
      }) : '';

      try {
        let finalDataUrl = typeof dataUrl === 'string' && dataUrl ? dataUrl : '';
        if (isImage && finalDataUrl) {
          finalDataUrl = await resizeImageDataUrl(finalDataUrl);
        }
        if (isImage) {
          return sanitizeAttachment({
            id: createId(),
            name: file.name,
            type: file.type || 'image',
            size: file.size,
            kind: 'image',
            dataUrl: finalDataUrl,
            extractedText: '',
            extractionStatus: 'image-ready'
          });
        }

        if (isPdf || isJsonFile(file) || isCsvFile(file) || isTextFile(file) || isDocxFile(file) || isWordFile(file)) {
          const extractedText = limitText(await extractTextAttachment(file));
          return sanitizeAttachment({
            id: createId(),
            name: file.name,
            type: file.type || 'file',
            size: file.size,
            kind: 'file',
            dataUrl: '',
            extractedText,
            extractionStatus: 'document-ready'
          });
        }

        return sanitizeAttachment({
          id: createId(),
          name: file.name,
          type: file.type || 'file',
          size: file.size,
          kind: 'file',
          dataUrl: '',
          extractedText: '',
          extractionStatus: 'failed',
          error: 'This file type is not supported for document analysis.'
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to read this document.';
        return sanitizeAttachment({
          id: createId(),
          name: file.name,
          type: file.type || 'file',
          size: file.size,
          kind: isImage ? 'image' : 'file',
          dataUrl: isImage ? (typeof dataUrl === 'string' ? dataUrl : '') : '',
          extractedText: '',
          extractionStatus: 'failed',
          error: message
        });
      }
    }));

    pendingUploads = [...pendingUploads, ...items.filter(Boolean)];
    renderPendingUploads();
  };

  const resetPendingUploads = () => {
    pendingUploads = [];
    renderPendingUploads();
  };

  const request = async (text, attachments = []) => {
    const trimmed = String(text || '').trim();
    const activeSession = getActiveSession();
    if (!activeSession || (pending && !trimmed && !attachments.length)) return;
    if (!trimmed && !attachments.length) return;

    const sanitizedAttachments = attachments.map((attachment) => sanitizeAttachment(attachment));
    const hasDocumentContext = sanitizedAttachments.some((attachment) => attachment.extractedText && attachment.extractionStatus !== 'failed');
    const hasImageAttachments = sanitizedAttachments.some((attachment) => attachment.kind === 'image' && attachment.dataUrl);
    const userMessage = {
      role: 'user',
      content: (trimmed || 'Shared attachment(s)').slice(0, MAX_INPUT),
      time: timestamp(),
      attachments: sanitizedAttachments
    };

    activeSession.messages.push(userMessage);
    activeSession.updatedAt = Date.now();
    const titleCandidate = activeSession.messages.find((entry) => entry.role === 'user')?.content || 'New chat';
    activeSession.title = trimTitle(titleCandidate);
    saveCurrent();
    renderSessionList();
    renderCurrentSession();
    setPending(true);

    try {
      const payloadMessages = activeSession.messages.slice(-MAX_HISTORY).map(({ role, content, attachments: itemAttachments }) => {
        const textContext = [];
        const imageContext = [];
        if (Array.isArray(itemAttachments) && itemAttachments.length) {
          itemAttachments.forEach((item) => {
            if (item.kind === 'image' && item.dataUrl) {
              imageContext.push({
                name: item.name,
                type: item.type,
                dataUrl: item.dataUrl
              });
            } else if (item.extractedText && item.extractionStatus !== 'failed') {
              textContext.push(`Attachment: ${item.name}\n${clampDocumentText(item.extractedText)}`);
            } else if (item.error) {
              textContext.push(`Attachment issue: ${item.name} — ${item.error}`);
            }
          });
        }

        const combinedContent = [content || '', ...textContext].filter(Boolean).join('\n\n');
        const cleanMessage = { role, content: combinedContent.slice(0, MAX_INPUT) };
        return { ...cleanMessage, images: imageContext.slice(0, 4) };
      });

      const documentAttachments = sanitizedAttachments.filter((attachment) => attachment.extractedText && attachment.extractionStatus !== 'failed');
      const imageAttachments = sanitizedAttachments.filter((attachment) => attachment.kind === 'image' && attachment.dataUrl);
      const failedAttachments = sanitizedAttachments.filter((attachment) => attachment.error && !attachment.extractedText);
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages.map(({ role, content, images }) => ({
            role,
            content: (images && images.length
              ? `${content}\n\n[Image attachment included for analysis: ${images.map((image) => image.name).join(', ')}]`
              : content)
          })),
          attachments: [
            ...documentAttachments.map((attachment) => ({
              name: attachment.name,
              type: attachment.type,
              kind: attachment.kind,
              size: attachment.size,
              extractedText: clampDocumentText(attachment.extractedText),
              extractionStatus: attachment.extractionStatus
            })),
            ...imageAttachments.map((attachment) => ({
              name: attachment.name,
              type: attachment.type,
              kind: attachment.kind,
              size: attachment.size,
              dataUrl: attachment.dataUrl,
              extractionStatus: attachment.extractionStatus
            }))
          ],
          imageAttachments: imageAttachments.map((attachment) => ({
            name: attachment.name,
            type: attachment.type,
            dataUrl: attachment.dataUrl,
            size: attachment.size
          })),
          failedAttachments: failedAttachments.map((attachment) => ({
            name: attachment.name,
            type: attachment.type,
            error: attachment.error
          }))
        })
      });

      if (!response.ok) throw new Error('request failed');
      const data = await response.json();
      if (!data.message) throw new Error('empty response');

      activeSession.messages.push({ role: 'assistant', content: String(data.message), time: timestamp() });
      activeSession.updatedAt = Date.now();
      lastFailed = null;
      if (hasDocumentContext && !data.message.toLowerCase().includes('document')) {
        console.info('Document context sent successfully to Teryzon AI.');
      }
      if (hasImageAttachments && !data.message.toLowerCase().includes('image')) {
        console.info('Image context sent successfully to Teryzon AI.');
      }
    } catch (error) {
      const userMessageText = (error instanceof Error && error.message) || 'Could not process the uploaded document.';
      activeSession.messages.push({
        role: 'assistant',
        content: navigator.onLine ? `Sorry, I ran into a problem while processing your request. ${userMessageText}` : "You're currently offline. Please check your internet connection and try again.",
        error: true,
        time: timestamp()
      });
      lastFailed = userMessage.content;
    } finally {
      activeSession.updatedAt = Date.now();
      saveCurrent();
      renderSessionList();
      renderCurrentSession();
      setPending(false);
      resetPendingUploads();
      input.value = '';
    }
  };

  const createNewChat = () => {
    const session = createSession('New chat');
    sessions.unshift(session);
    activeChatId = session.id;
    saveCurrent();
    renderSessionList();
    renderCurrentSession();
    input.focus();
  };

  const renameSession = (sessionId) => {
    const session = sessions.find((entry) => entry.id === sessionId);
    if (!session) return;
    const currentTitle = session.title || 'New chat';
    const nextTitle = window.prompt('Rename chat', currentTitle);
    if (nextTitle === null) return;
    session.title = trimTitle(nextTitle);
    session.updatedAt = Date.now();
    saveCurrent();
    renderSessionList();
  };

  const deleteSession = (sessionId) => {
    const target = sessions.find((session) => session.id === sessionId);
    if (!target) return;

    const confirmed = window.confirm(`Delete "${target.title || 'this chat'}"?`);
    if (!confirmed) return;

    if (sessions.length <= 1) {
      sessions = [createSession('New chat')];
      activeChatId = sessions[0].id;
      saveCurrent();
      renderSessionList();
      renderCurrentSession();
      return;
    }

    sessions = sessions.filter((session) => session.id !== sessionId);
    activeChatId = sessions[0]?.id || createSession().id;
    saveCurrent();
    renderSessionList();
    renderCurrentSession();
  };

  const handleSessionSelection = (event) => {
    const button = event.target.closest('.teryzon-chatbot-session');
    if (!button) return;
    const sessionId = button.getAttribute('data-session-id');
    const action = event.target.closest('.teryzon-chatbot-session-action')?.getAttribute('data-session-action');
    if (action === 'rename') {
      renameSession(sessionId);
      return;
    }
    if (action === 'delete') {
      deleteSession(sessionId);
      return;
    }
    activeChatId = sessionId;
    saveCurrent();
    renderSessionList();
    renderCurrentSession();
  };

  const handleUploadMenuClick = (event) => {
    const button = event.target.closest('[data-upload-kind]');
    if (!button) return;
    triggerUploadInput(button.getAttribute('data-upload-kind'));
  };

  const handleUploadRemove = (event) => {
    const button = event.target.closest('[data-upload-remove]');
    if (!button) return;
    const removeId = button.getAttribute('data-upload-remove');
    pendingUploads = pendingUploads.filter((item) => item.id !== removeId);
    renderPendingUploads();
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value;
    const attachments = [...pendingUploads];
    if (!text.trim() && !attachments.length) return;
    request(text, attachments);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  fileInput.addEventListener('change', async (event) => {
    const files = event.target.files;
    if (!files || !files.length) return;
    await addPendingAttachments(files);
  });

  uploadTrigger.addEventListener('click', () => {
    const shouldOpen = uploadMenu.hidden;
    uploadMenu.hidden = !shouldOpen;
    uploadTrigger.setAttribute('aria-expanded', String(shouldOpen));
  });

  uploadMenu.addEventListener('click', (event) => {
    event.stopPropagation();
    handleUploadMenuClick(event);
  });
  uploadBar.addEventListener('click', handleUploadRemove);
  sidebarList.addEventListener('click', handleSessionSelection);
  panel.querySelector('[data-chat-action="new"]').addEventListener('click', createNewChat);
  panel.querySelector('[data-chat-action="fullscreen"]').addEventListener('click', toggleFullscreen);
  panel.querySelector('[data-chat-action="close"]').addEventListener('click', () => togglePanel(false));
  sidebarToggle.addEventListener('click', toggleSidebar);
  launcher.addEventListener('click', () => togglePanel(true));

  document.addEventListener('click', (event) => {
    const clickedWithinUpload = event.target.closest('.teryzon-chatbot-upload-menu') || event.target.closest('.teryzon-chatbot-upload-trigger');
    if (!clickedWithinUpload) {
      closeUploadMenu();
    }
  });
  quickWrap.addEventListener('click', (event) => {
    const target = event.target.closest('.teryzon-chatbot-quick');
    if (!target) return;
    request(target.textContent.trim(), pendingUploads);
  });
  messages.addEventListener('click', (event) => {
    if (event.target.matches('[data-chat-retry]')) {
      request(lastFailed || '', pendingUploads);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.classList.contains('is-open')) {
      togglePanel(false);
    }
  });

  ensureActiveSession();
  renderSessionList();
  renderCurrentSession();
  renderPendingUploads();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

