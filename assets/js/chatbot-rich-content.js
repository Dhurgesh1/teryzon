import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import powershell from 'highlight.js/lib/languages/powershell';
import cpp from 'highlight.js/lib/languages/cpp';
import c from 'highlight.js/lib/languages/c';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import yaml from 'highlight.js/lib/languages/yaml';
import markdownLanguage from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import 'katex/dist/katex.min.css';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));
const createId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

const isAllowedUrl = (value, { image = false } = {}) => {
  const raw = String(value || '').trim();
  if (!raw || /[\u0000-\u0020]/.test(raw)) return false;
  try {
    const url = new URL(raw, window.location.origin);
    if (image) return url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === window.location.origin);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch {
    return false;
  }
};

[
  ['javascript', javascript],
  ['typescript', typescript],
  ['python', python],
  ['xml', xml],
  ['css', css],
  ['json', json],
  ['sql', sql],
  ['bash', bash],
  ['powershell', powershell],
  ['cpp', cpp],
  ['c', c],
  ['java', java],
  ['csharp', csharp],
  ['go', go],
  ['rust', rust],
  ['yaml', yaml],
  ['markdown', markdownLanguage],
  ['dockerfile', dockerfile]
].forEach(([name, language]) => hljs.registerLanguage(name, language));

const highlightCode = (code, language) => {
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  }
  return hljs.highlightAuto(code).value;
};

const chartTypes = new Set(['bar', 'line', 'pie', 'doughnut', 'area']);
const chartColors = ['#af533b', '#607b67', '#d2a15f', '#667f9a', '#9c7181', '#71918c', '#9a8b63', '#7b6c8c'];

const parseChart = (source) => {
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    return { error: 'Chart data must be valid JSON.' };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Chart data must be a JSON object.' };
  if (!chartTypes.has(value.type)) return { error: 'Chart type must be bar, line, pie, doughnut, or area.' };
  if (!Array.isArray(value.labels) || !value.labels.length || value.labels.length > 100
    || !value.labels.every((label) => typeof label === 'string' && label.length <= 120)) {
    return { error: 'Chart labels must contain between 1 and 100 text values.' };
  }
  if (!Array.isArray(value.datasets) || !value.datasets.length || value.datasets.length > 8) {
    return { error: 'Chart data must contain between 1 and 8 datasets.' };
  }
  const validDatasets = value.datasets.every((dataset) => dataset && typeof dataset === 'object'
    && typeof dataset.label === 'string' && dataset.label.length <= 120
    && Array.isArray(dataset.data)
    && dataset.data.length === value.labels.length
    && dataset.data.every((number) => typeof number === 'number' && Number.isFinite(number)));
  if (!validDatasets) return { error: 'Each chart dataset must contain a label and one finite number per category.' };
  if ((value.type === 'pie' || value.type === 'doughnut') && value.datasets.length !== 1) {
    return { error: 'Pie and doughnut charts require exactly one dataset.' };
  }
  if (value.title !== undefined && (typeof value.title !== 'string' || value.title.length > 160)) return { error: 'Chart title must be text no longer than 160 characters.' };
  if (value.xLabel !== undefined && (typeof value.xLabel !== 'string' || value.xLabel.length > 80)) return { error: 'Chart xLabel must be text no longer than 80 characters.' };
  if (value.yLabel !== undefined && (typeof value.yLabel !== 'string' || value.yLabel.length > 80)) return { error: 'Chart yLabel must be text no longer than 80 characters.' };
  return { chart: value };
};

const isChartJson = (source) => /"(?:type|datasets|labels)"\s*:/.test(source);

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  highlight: (code, language) => highlightCode(code, language)
})
  .use(taskLists, { enabled: false })
  .use(texmath, {
    engine: katex,
    delimiters: 'dollars',
    katexOptions: {
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      maxExpand: 1000,
      maxSize: 20
    }
  });

markdown.validateLink = (url) => isAllowedUrl(url);
markdown.renderer.rules.link_open = (tokens, index, options, environment, renderer) => {
  const token = tokens[index];
  const href = token.attrGet('href');
  if (isAllowedUrl(href)) {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
  }
  return renderer.renderToken(tokens, index, options);
};
markdown.renderer.rules.image = (tokens, index) => {
  const token = tokens[index];
  const source = token.attrGet('src');
  if (!isAllowedUrl(source, { image: true })) return escapeHtml(token.content || 'Image URL blocked');
  token.attrSet('loading', 'lazy');
  token.attrSet('decoding', 'async');
  token.attrSet('referrerpolicy', 'no-referrer');
  return `<img${markdown.renderer.renderAttrs(token)}>`;
};

const defaultFence = markdown.renderer.rules.fence;
markdown.renderer.rules.fence = (tokens, index, options, environment, renderer) => {
  const token = tokens[index];
  const language = (token.info || '').trim().split(/\s+/, 1)[0].toLowerCase();
  const code = token.content;

  if (language === 'mermaid') {
    if (environment?.streaming) {
      return `<pre><code>${escapeHtml(code)}</code></pre>`;
    }
    return `<div class="teryzon-chatbot-diagram" data-chatbot-mermaid><pre><code>${escapeHtml(code)}</code></pre></div>`;
  }

  const chartMode = language === 'chart' || (language === 'json' && isChartJson(code));
  if (chartMode) {
    const result = parseChart(code);
    if (result.chart) {
      if (environment?.streaming) return `<pre><code>${escapeHtml(code)}</code></pre>`;
      const chartId = createId('teryzon-chart');
      const chartJson = JSON.stringify(result.chart);
      return `<section class="teryzon-chatbot-chart" data-chatbot-chart data-chatbot-chart-data="${escapeHtml(chartJson)}"><h4>${escapeHtml(result.chart.title || 'Chart')}</h4><div class="teryzon-chatbot-chart-canvas"><canvas id="${escapeHtml(chartId)}" role="img" aria-label="${escapeHtml(result.chart.title || 'Chart')}"></canvas></div></section>`;
    }
    if (!environment?.streaming) {
      return `<div class="teryzon-chatbot-rich-fallback"><p>${escapeHtml(result.error)}</p><pre><code>${escapeHtml(code)}</code></pre></div>`;
    }
  }

  if (defaultFence) {
    const rendered = defaultFence(tokens, index, options, environment, renderer);
    const label = language ? escapeHtml(language) : 'code';
    const codeId = `teryzon-code-${crypto.randomUUID()}`;
    return `<div class="teryzon-chatbot-code-block"><div class="teryzon-chatbot-code-toolbar"><span>${label}</span><button type="button" data-chat-copy-code="${escapeHtml(codeId)}">Copy</button></div><div id="${escapeHtml(codeId)}">${rendered}</div></div>`;
  }
  return `<pre><code>${escapeHtml(code)}</code></pre>`;
};

export const renderMarkdown = (source, { streaming = false } = {}) => {
  const rendered = markdown.render(String(source || ''), { streaming });
  return DOMPurify.sanitize(rendered, {
    ADD_ATTR: ['target', 'rel', 'loading', 'decoding', 'referrerpolicy', 'data-chatbot-mermaid', 'data-chatbot-chart', 'data-chatbot-chart-data', 'data-chat-copy-code'],
    ADD_TAGS: ['canvas'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed']
  });
};

let mermaidLibraryPromise;
let mermaidConfigured = false;
const loadMermaid = () => {
  if (!mermaidLibraryPromise) {
    mermaidLibraryPromise = new Promise((resolve, reject) => {
      if (window.mermaid) {
        resolve(window.mermaid);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.min.js';
      script.integrity = 'sha384-HHW54r639fK42Ip0coGF3mz8oSiGn0eEoWNTLs75X7H63pLSDBa0Tqs0RwGmLlXE';
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer';
      script.onload = () => window.mermaid
        ? resolve(window.mermaid)
        : reject(new Error('Mermaid did not initialize.'));
      script.onerror = () => reject(new Error('Mermaid library failed to load.'));
      document.head.append(script);
    });
  }
  return mermaidLibraryPromise.then((mermaid) => {
    if (!mermaidConfigured) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrorRendering: true,
        theme: 'base',
        themeVariables: {
          primaryColor: '#f4efe9',
          primaryTextColor: '#30221e',
          primaryBorderColor: '#af533b',
          lineColor: '#607b67',
          secondaryColor: '#ece5dc',
          tertiaryColor: '#fffaf5'
        }
      });
      mermaidConfigured = true;
    }
    return mermaid;
  });
};

const drawChart = async (container) => {
  const canvas = container.querySelector('canvas');
  if (!canvas) return;
  const result = parseChart(container.dataset.chatbotChartData || '');
  if (!result.chart) {
    container.innerHTML = `<p>${escapeHtml(result.error)}</p>`;
    return;
  }

  const module = await import('chart.js/auto');
  const chart = result.chart;
  const pieType = chart.type === 'pie' || chart.type === 'doughnut';
  const datasetValues = chart.datasets.map((dataset, index) => ({
    label: dataset.label,
    data: dataset.data,
    backgroundColor: pieType
      ? chart.labels.map((_, colorIndex) => chartColors[colorIndex % chartColors.length])
      : chartColors[index % chartColors.length],
    borderColor: chartColors[index % chartColors.length],
    borderWidth: 1.5,
    borderRadius: pieType ? 0 : 4,
    fill: chart.type === 'area' || dataset.fill === true,
    tension: 0.25
  }));
  const type = chart.type === 'area' ? 'line' : chart.type;
  new module.Chart(canvas, {
    type,
    data: { labels: chart.labels, datasets: datasetValues },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          enabled: true,
          callbacks: {
            label: (context) => `${context.dataset.label}: ${context.formattedValue}${chart.yLabel ? ` ${chart.yLabel}` : ''}`
          }
        },
        title: { display: false }
      },
      scales: pieType ? {} : {
        x: {
          title: { display: Boolean(chart.xLabel), text: chart.xLabel || '' },
          ticks: { color: '#8f8178' },
          grid: { color: 'rgba(143, 129, 120, .16)' }
        },
        y: {
          title: { display: Boolean(chart.yLabel), text: chart.yLabel || '' },
          ticks: { color: '#8f8178' },
          grid: { color: 'rgba(143, 129, 120, .16)' }
        }
      }
    }
  });
};

export const enhanceRenderedContent = async (root) => {
  root.querySelectorAll('a[target="_blank"]').forEach((link) => {
    link.rel = 'noopener noreferrer';
  });
  root.querySelectorAll('img').forEach((image) => {
    image.addEventListener('error', () => {
      const fallback = document.createElement('span');
      fallback.className = 'teryzon-chatbot-image-fallback';
      fallback.textContent = image.alt || 'Image unavailable';
      image.replaceWith(fallback);
    }, { once: true });
  });

  const charts = Array.from(root.querySelectorAll('[data-chatbot-chart]'));
  if (charts.length) {
    try {
      await Promise.all(charts.map(drawChart));
    } catch (error) {
      console.error('Unable to render a chatbot chart.', error);
      charts.forEach((chart) => {
        if (chart.querySelector('canvas')) {
          const fallback = document.createElement('p');
          fallback.className = 'teryzon-chatbot-rich-fallback';
          fallback.textContent = 'This chart could not be displayed. The source data is still available in the conversation.';
          chart.append(fallback);
        }
      });
    }
  }

  const diagrams = Array.from(root.querySelectorAll('[data-chatbot-mermaid]'));
  if (diagrams.length) {
    try {
      const mermaid = await loadMermaid();
      await Promise.all(diagrams.map(async (diagram, index) => {
        const source = diagram.querySelector('code')?.textContent || '';
        const id = `${createId('teryzon-mermaid')}-${index}`;
        const rendered = await mermaid.render(id, source);
        const safeSvg = DOMPurify.sanitize(rendered.svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          FORBID_TAGS: ['foreignObject', 'script', 'iframe']
        });
        diagram.innerHTML = safeSvg;
        const svg = diagram.querySelector('svg');
        if (svg) {
          svg.setAttribute('role', 'img');
          svg.setAttribute('aria-label', 'Mermaid diagram');
        }
      }));
    } catch (error) {
      console.error('Unable to render a chatbot diagram.', error);
      diagrams.forEach((diagram) => {
        diagram.classList.add('is-fallback');
        const note = document.createElement('p');
        note.className = 'teryzon-chatbot-rich-fallback';
        note.textContent = 'This diagram could not be rendered. Its source is shown below.';
        diagram.prepend(note);
      });
    }
  }
};

export const installRichContentHandlers = (root) => {
  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-chat-copy-code]');
    if (!button || !root.contains(button)) return;
    const code = document.getElementById(button.dataset.chatCopyCode)?.querySelector('code')?.textContent;
    if (typeof code !== 'string') return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const temporaryInput = document.createElement('textarea');
        temporaryInput.value = code;
        temporaryInput.setAttribute('readonly', '');
        temporaryInput.style.position = 'fixed';
        temporaryInput.style.opacity = '0';
        document.body.append(temporaryInput);
        temporaryInput.select();
        const copied = document.execCommand('copy');
        temporaryInput.remove();
        if (!copied) throw new Error('Clipboard access is unavailable.');
      }
      button.textContent = 'Copied';
    } catch (error) {
      console.error('Unable to copy chatbot code block.', error);
      button.textContent = 'Copy failed';
    }
    window.setTimeout(() => {
      if (button.isConnected) button.textContent = 'Copy';
    }, 1400);
  });
};
