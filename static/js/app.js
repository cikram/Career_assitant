/**
 * Career Assistant — Frontend Application
 *
 * Flow:
 *  1. User drags/selects resume file + enters target company
 *  2. POST /upload  → receive job_id
 *  3. Open EventSource at /stream/{job_id}
 *  4. Handle SSE events: status | progress | resume_data |
 *                        scout_result | strategist_result | error
 *  5. Render results progressively as events arrive
 */

/* ── Marked.js config (loaded from CDN in index.html) ──────── */
function configureMarked() {
  if (typeof marked === 'undefined') return;
  marked.setOptions({
    breaks: true,
    gfm: true,
  });
}

/* ── Helpers ───────────────────────────────────────────────── */
function el(id) { return document.getElementById(id); }

function show(id) {
  const e = el(id);
  if (e) { e.style.display = ''; e.classList.remove('hidden'); }
}

function hide(id) {
  const e = el(id);
  if (e) e.style.display = 'none';
}

function renderMarkdown(text) {
  if (!text) return '';
  if (typeof marked !== 'undefined') {
    return marked.parse(text);
  }
  // fallback: simple line-break escaping
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

/* ── Stage management ──────────────────────────────────────── */
const STAGES = ['ocr', 'agents', 'scout', 'strategist', 'done'];

function setStage(stageName, state) {
  // state: 'active' | 'done' | 'error'
  const el = document.querySelector(`.stage[data-stage="${stageName}"]`);
  if (!el) return;
  el.classList.remove('active', 'done', 'error');
  if (state) el.classList.add(state);
  if (state === 'done') {
    const dot = el.querySelector('.stage-dot');
    if (dot) dot.textContent = '✓';
  }
}

/* ── Log feed ──────────────────────────────────────────────── */
function addLog(message, type = 'plain') {
  const feed = el('log-feed');
  if (!feed) return;
  const line = document.createElement('div');
  line.className = `log-line log-${type}`;
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  line.textContent = `[${ts}] ${message}`;
  feed.appendChild(line);
  feed.scrollTop = feed.scrollHeight;
}

/* ── Stage → UI event mapping ──────────────────────────────── */
const stageMap = {
  ocr:             () => { setStage('ocr', 'active'); },
  ocr_done:        () => { setStage('ocr', 'done'); },
  agents:          () => { setStage('agents', 'active'); },
  scout:           () => { setStage('scout', 'active'); },
  scout_done:      () => { setStage('scout', 'done'); },
  strategist:      () => { setStage('strategist', 'active'); },
  strategist_done: () => { setStage('strategist', 'done'); },
  done:            () => { setStage('done', 'done'); setStage('agents', 'done'); },
};

/* ── File upload state ─────────────────────────────────────── */
let selectedFile = null;

function initUploadZone() {
  const zone = el('upload-zone');
  const fileInput = el('file-input');
  const fileChosen = el('file-chosen');

  // Drag-and-drop
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) setFile(fileInput.files[0]);
  });

  function setFile(file) {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      alert(`Unsupported file type: ${ext}\nAllowed: PDF, PNG, JPG, JPEG`);
      return;
    }
    selectedFile = file;
    fileChosen.textContent = file.name;
    el('submit-btn').disabled = false;
  }
}

/* ── Main submit handler ───────────────────────────────────── */
async function handleSubmit(e) {
  e.preventDefault();

  if (!selectedFile) {
    alert('Please select a resume file first.');
    return;
  }

  const targetCompany = (el('target-company').value || 'Google').trim() || 'Google';
  const jobDescription = (el('job-description').value || '').trim();

  // Disable form
  el('submit-btn').disabled = true;
  el('submit-btn').textContent = 'Uploading…';

  // Hide previous results
  hide('results-section');
  hide('resume-section');
  hide('error-section');
  hide('download-bar');

  // Show progress
  show('progress-section');
  el('log-feed').innerHTML = '';

  // Reset all stages
  STAGES.forEach(s => {
    const node = document.querySelector(`.stage[data-stage="${s}"]`);
    if (node) {
      node.classList.remove('active', 'done', 'error');
      const dot = node.querySelector('.stage-dot');
      if (dot) dot.textContent = node.dataset.num || '●';
    }
  });

  addLog('Uploading resume file…', 'info');

  // Upload
  const form = new FormData();
  form.append('file', selectedFile);
  form.append('target_company', targetCompany);
  if (jobDescription) form.append('job_description', jobDescription);

  let jobId;
  try {
    const resp = await fetch('/upload', { method: 'POST', body: form });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: resp.statusText }));
      throw new Error(err.detail || 'Upload failed');
    }
    const data = await resp.json();
    jobId = data.job_id;
    addLog('Workflow started...', 'info');
  } catch (err) {
    showError('Upload failed', err.message);
    resetSubmitBtn();
    return;
  }

  // Open SSE stream
  connectStream(jobId);
}

/* ── SSE stream ────────────────────────────────────────────── */
function connectStream(jobId) {
  const evtSource = new EventSource(`/stream/${jobId}`);

  function close() {
    evtSource.close();
    resetSubmitBtn();
  }

  evtSource.addEventListener('status', e => {
    const data = JSON.parse(e.data);
    const stage = data.stage || '';
    const msg   = data.message || '';
    addLog(msg, 'info');
    if (stageMap[stage]) stageMap[stage]();
  });

  evtSource.addEventListener('progress', e => {
    const data = JSON.parse(e.data);
    addLog(data.message || '', 'plain');
  });

  evtSource.addEventListener('resume_data', e => {
    const data = JSON.parse(e.data);
    renderResumeCard(data);
    show('resume-section');
  });

  evtSource.addEventListener('scout_result', e => {
    const data = JSON.parse(e.data);
    renderScoutResult(data);
    ensureResultsVisible();
  });

  evtSource.addEventListener('strategist_result', e => {
    const data = JSON.parse(e.data);
    renderStrategistResult(data, jobId);
    ensureResultsVisible();
    showDownloadBar(jobId);
  });

  evtSource.addEventListener('error', e => {
    try {
      const data = JSON.parse(e.data);
      showError(data.message || 'Pipeline error', data.detail || '');
    } catch {
      showError('Stream error', e.data || 'Unknown error');
    }
    // Also mark stages error
    STAGES.forEach(s => {
      const node = document.querySelector(`.stage[data-stage="${s}"]`);
      if (node && node.classList.contains('active')) {
        node.classList.remove('active');
        node.classList.add('error');
      }
    });
    close();
  });

  evtSource.onerror = () => {
    // If job completed normally, EventSource will close — ignore spurious errors
    // after done state
  };

  // Poll for done stage to close cleanly
  const doneCheck = setInterval(() => {
    const doneStage = document.querySelector('.stage[data-stage="done"].done');
    if (doneStage) {
      clearInterval(doneCheck);
      addLog('Pipeline complete.', 'ok');
      close();
    }
  }, 500);
}

/* ── Render helpers ────────────────────────────────────────── */

function renderResumeCard(data) {
  const name = data.name || 'Unknown Candidate';
  const contact = data.contact || {};

  el('resume-name').textContent = name;
  el('resume-avatar-letter').textContent = name[0]?.toUpperCase() || '?';

  const chips = el('resume-contacts');
  chips.innerHTML = '';

  const fields = ['email', 'phone', 'linkedin', 'location', 'github', 'website'];
  fields.forEach(f => {
    const val = contact[f] || contact[f.charAt(0).toUpperCase() + f.slice(1)];
    if (val && typeof val === 'string') {
      const c = document.createElement('span');
      c.className = 'contact-chip';
      c.textContent = val;
      chips.appendChild(c);
    }
  });

  // Also try to render any other string contact fields we might have missed
  Object.entries(contact).forEach(([k, v]) => {
    if (typeof v === 'string' && v && !fields.includes(k.toLowerCase())) {
      const c = document.createElement('span');
      c.className = 'contact-chip';
      c.textContent = v;
      chips.appendChild(c);
    }
  });
}

/**
 * Parse the Scout agent's markdown table into an array of job objects.
 * Returns null if no parseable table is found.
 */
function parseScoutTable(markdown) {
  if (!markdown) return null;
  const lines = markdown.split('\n');

  const headerIdx = lines.findIndex(
    l => l.includes('|') && (l.toLowerCase().includes('job title') || l.toLowerCase().includes('company'))
  );
  if (headerIdx === -1) return null;

  const headers = lines[headerIdx]
    .split('|').map(h => h.trim().toLowerCase()).filter(Boolean);

  const dataStart = headerIdx + 2;
  const jobs = [];

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;

    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 3) continue;

    const get = (...keys) => {
      for (const k of keys) {
        const idx = headers.findIndex(h => h.includes(k));
        if (idx !== -1 && cells[idx]) return cells[idx];
      }
      return '';
    };

    const rawTitle = get('job title', 'title');
    const rawLink  = get('source link', 'source', 'link');

    const titleMatch = rawTitle.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const linkMatch  = rawLink.match(/\[([^\]]+)\]\(([^)]+)\)/);

    const title   = titleMatch ? titleMatch[1] : rawTitle;
    const url     = titleMatch ? titleMatch[2] : (linkMatch ? linkMatch[2] : null);
    const company = get('company');
    const match   = get('match level', 'match');
    const reason  = get('why it matches', 'why', 'reason');

    if (title) jobs.push({ title, company, match, reason, url });
  }

  return jobs.length > 0 ? jobs : null;
}

const MATCH_STYLES = {
  'high':             { border: 'rgba(39,174,96,0.45)',  bg: 'rgba(39,174,96,0.1)',  color: '#6ee29a', label: 'High' },
  'medium':           { border: 'rgba(243,156,18,0.45)', bg: 'rgba(243,156,18,0.1)', color: '#f8c55a', label: 'Medium' },
  'strategic pivot':  { border: 'rgba(74,144,217,0.45)', bg: 'rgba(74,144,217,0.1)', color: '#7ab8f5', label: 'Strategic Pivot' },
};

function getMatchStyle(level) {
  return MATCH_STYLES[(level || '').toLowerCase()] || MATCH_STYLES['medium'];
}

function buildJobCard(job, index) {
  const ms = getMatchStyle(job.match);
  const titleHtml = job.url
    ? `<a class="scout-job-title" href="${job.url}" target="_blank" rel="noopener noreferrer">${job.title}</a>`
    : `<span class="scout-job-title">${job.title}</span>`;
  const companyHtml = job.company
    ? `<div class="scout-job-company">${job.company}</div>`
    : '';
  const reasonHtml = job.reason
    ? `<p class="scout-job-reason">${job.reason}</p>`
    : '';
  const linkHtml = job.url
    ? `<a class="scout-job-link" href="${job.url}" target="_blank" rel="noopener noreferrer">View listing &rarr;</a>`
    : '';
  const idxStr = String(index + 1).padStart(2, '0');

  return `
    <div class="scout-job-card" style="animation-delay:${index * 60}ms">
      <div class="scout-job-header">
        <div class="scout-job-title-wrap">
          <span class="scout-job-index">${idxStr}</span>
          <div>${titleHtml}${companyHtml}</div>
        </div>
        <span class="scout-match-badge"
          style="background:${ms.bg};border:1px solid ${ms.border};color:${ms.color}">
          ${ms.label}
        </span>
      </div>
      ${reasonHtml}${linkHtml}
    </div>`;
}

function renderScoutResult(data) {
  const company  = data.target_company || 'Target Company';
  const markdown = data.markdown_result || '';

  el('scout-company').textContent = company;

  const jobs = parseScoutTable(markdown);
  if (jobs) {
    const listHtml = jobs.map((job, i) => buildJobCard(job, i)).join('');
    el('scout-content').innerHTML = `<div class="scout-jobs-list">${listHtml}</div>`;
  } else {
    el('scout-content').innerHTML = `<div class="markdown-body">${renderMarkdown(markdown || '*No results returned by Scout agent.*')}</div>`;
  }
}

/* ── Roadmap parser & renderer ─────────────────────────────── */

const WEEK_COLORS_JS = [
  { accent: '#4A90D9', bg: 'rgba(74,144,217,0.12)',  border: 'rgba(74,144,217,0.35)'  },
  { accent: '#9B59B6', bg: 'rgba(155,89,182,0.12)',  border: 'rgba(155,89,182,0.35)'  },
  { accent: '#27AE60', bg: 'rgba(39,174,96,0.12)',   border: 'rgba(39,174,96,0.35)'   },
  { accent: '#F39C12', bg: 'rgba(243,156,18,0.12)',  border: 'rgba(243,156,18,0.35)'  },
];

function parseRoadmark(markdown) {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const sections = [];
  let current = null;

  const flush = () => { if (current) sections.push(current); };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const weekMatch = line.match(/^####\s+Week\s+(\d+)[:\s]+(.+)/i);
    if (weekMatch) {
      flush();
      current = { type: 'week', week: parseInt(weekMatch[1], 10), theme: weekMatch[2].trim(), items: [] };
      continue;
    }
    if (line.startsWith('### ')) {
      flush();
      const title = line.slice(4).trim();
      // Skip the top-level roadmap heading — redundant with the panel title
      if (/30.day/i.test(title)) continue;
      current = { type: 'section', title, items: [] };
      continue;
    }
    if ((line.startsWith('- ') || line.startsWith('* ')) && current) {
      const text = line.slice(2).trim();
      if (text && text !== '---') current.items.push(text);
      continue;
    }
    if (current && !line.startsWith('#')) {
      if (line && line.trim() !== '---') current.items.push(line);
    }
  }
  flush();
  return sections;
}

function buildRoadmapItemHtml(item, accentColor) {
  const dayMatch = item.match(/^(Day\s[\d\-–]+)[:\s]+(.+)$/i);
  let inner;
  if (dayMatch) {
    const [, dayLabel, rest] = dayMatch;
    const parts = rest.split(/\s[—–-]{1,2}\s/);
    const topic = parts[0] || '';
    const detail = parts.slice(1).join(' — ');
    inner = `<span class="roadmap-item-day">${dayLabel}</span><span class="roadmap-item-topic">${topic}</span>${detail ? `<span class="roadmap-item-detail">${detail}</span>` : ''}`;
  } else {
    inner = `<span>${item}</span>`;
  }
  return `<div class="roadmap-item-row">
    <span class="roadmap-item-dot" style="background:${accentColor}"></span>
    <span class="roadmap-item-content">${inner}</span>
  </div>`;
}

function buildRoadmapWeekHtml(section, isFirst) {
  const c = WEEK_COLORS_JS[(section.week - 1) % WEEK_COLORS_JS.length];
  const id = `rw-${section.week}`;
  const bodyDisplay = isFirst ? '' : 'display:none';
  const chevron = isFirst ? '▾' : '▸';
  const itemsHtml = section.items.map(item => buildRoadmapItemHtml(item, c.accent)).join('');
  return `
  <div class="roadmap-week-card" style="border-color:${c.border};border-left-color:${c.accent}">
    <button class="roadmap-week-header" style="background:${c.bg}"
      onclick="toggleRoadmapCard('${id}', this)">
      <div class="roadmap-week-header-left">
        <span class="roadmap-week-badge" style="background:${c.accent}">Week ${section.week}</span>
        <span class="roadmap-week-theme" style="color:${c.accent}">${section.theme}</span>
      </div>
      <span class="roadmap-week-chevron" id="chev-${id}" style="color:${c.accent}">${chevron}</span>
    </button>
    <div class="roadmap-week-body" id="${id}" style="${bodyDisplay}">
      ${itemsHtml}
    </div>
  </div>`;
}

const MILESTONE_WEEK_COLORS_JS = ['#4A90D9', '#9B59B6', '#27AE60', '#F39C12'];

const RESOURCE_PATTERNS_JS = [
  { re: /^(course|video|mooc|udemy|coursera|pluralsight|linkedin learning)[:\s]/i, icon: '🎓', color: '#4A90D9', label: 'Course' },
  { re: /^(book|read|textbook)[:\s]/i,   icon: '📖', color: '#9B59B6', label: 'Book'   },
  { re: /^(tool|library|framework|package|github|repo)[:\s]/i, icon: '🔧', color: '#27AE60', label: 'Tool' },
  { re: /^(article|blog|docs|documentation)[:\s]/i, icon: '📄', color: '#F39C12', label: 'Article' },
  { re: /^(project|practice|exercise|challenge)[:\s]/i, icon: '💡', color: '#E74C3C', label: 'Practice' },
  { re: /https?:\/\//i, icon: '🔗', color: '#4A90D9', label: 'Link' },
];

function classifyResourceJs(text) {
  for (const p of RESOURCE_PATTERNS_JS) {
    if (p.re.test(text)) return p;
  }
  return { icon: '📌', color: 'rgba(255,255,255,0.4)', label: null };
}

function buildMilestonesHtml(items) {
  return '<div class="milestone-timeline">' + items.map((item, i) => {
    const text = typeof item === 'object' ? item.text : item;
    const wm = text.match(/^End of Week\s*(\d+)[:\s]+(.+)/i);
    const weekNum = wm ? parseInt(wm[1], 10) : null;
    const color = MILESTONE_WEEK_COLORS_JS[(weekNum ? weekNum - 1 : i) % MILESTONE_WEEK_COLORS_JS.length];
    const isLast = i === items.length - 1;
    const spineLineHtml = isLast ? '' : `<div class="milestone-spine-line" style="background:${color}40"></div>`;
    const contentHtml = wm
      ? `<div class="milestone-week-label" style="color:${color}">End of Week ${weekNum}</div><div class="milestone-outcome">${wm[2].trim()}</div>`
      : `<div class="milestone-outcome">${text}</div>`;
    return `<div class="milestone-row">
      <div class="milestone-spine">
        <div class="milestone-badge" style="background:${color};box-shadow:0 0 10px ${color}55">${weekNum ? 'W' + weekNum : i + 1}</div>
        ${spineLineHtml}
      </div>
      <div class="milestone-body" style="border-color:${color}30;border-left-color:${color}">
        ${contentHtml}
      </div>
    </div>`;
  }).join('') + '</div>';
}

function buildResourceCardHtml(text) {
  const { icon, color, label } = classifyResourceJs(text);
  const clean = text.replace(/^(course|book|tool|article|project|practice)[:\s]+/i, '').trim();
  const urlMatch = clean.match(/https?:\/\/\S+/);
  const displayText = urlMatch ? clean.replace(urlMatch[0], '').trim() : clean;
  const typeBadge = label ? `<span class="resource-type-badge" style="color:${color};border-color:${color}50">${label}</span>` : '';
  const contentHtml = urlMatch
    ? `${typeBadge}<a href="${urlMatch[0]}" target="_blank" rel="noopener noreferrer" class="resource-link">${displayText || urlMatch[0]}</a>`
    : `${typeBadge}<span class="resource-desc">${clean}</span>`;
  return `<div class="resource-card" style="border-color:${color}40">
    <span class="resource-icon" style="background:${color}20;color:${color}">${icon}</span>
    <div class="resource-text">${contentHtml}</div>
  </div>`;
}

function buildResourcesHtml(items) {
  // Group by bold category headers (**Skill:**)
  const groups = [];
  let currentGroup = null;
  for (const raw of items) {
    const text = typeof raw === 'object' ? raw.text : raw;
    const groupMatch = text.match(/^\*{1,2}([^*:]+)[*:]{1,3}\s*(.*)$/);
    if (groupMatch && !groupMatch[2].trim()) {
      currentGroup = { header: groupMatch[1].trim(), entries: [] };
      groups.push(currentGroup);
      continue;
    }
    if (!currentGroup) { currentGroup = { header: null, entries: [] }; groups.push(currentGroup); }
    currentGroup.entries.push(text);
  }

  const allFlat = groups.length === 1 && !groups[0].header;
  if (allFlat) {
    return `<div class="resource-cards">${groups[0].entries.map(buildResourceCardHtml).join('')}</div>`;
  }
  return '<div class="resource-groups">' + groups.map(g => {
    const headerHtml = g.header ? `<div class="resource-group-header">${g.header}</div>` : '';
    return `<div class="resource-group">${headerHtml}<div class="resource-cards">${g.entries.map(buildResourceCardHtml).join('')}</div></div>`;
  }).join('') + '</div>';
}

function buildRoadmapSectionHtml(section) {
  const id = `rs-${section.title.replace(/\s+/g, '-').toLowerCase().slice(0, 20)}`;
  const isMilestone  = section.title.toLowerCase().includes('milestone');
  const isResource   = section.title.toLowerCase().includes('resource');
  const isCommitment = section.title.toLowerCase().includes('time') || section.title.toLowerCase().includes('commitment') || section.title.toLowerCase().includes('daily');
  const icon        = isMilestone ? '🏁' : isResource ? '📚' : isCommitment ? '⏱' : '💡';
  const accentColor = isMilestone ? '#F39C12' : isResource ? '#9B59B6' : isCommitment ? '#27AE60' : 'rgba(255,255,255,0.2)';
  const headerBg    = isMilestone ? 'rgba(243,156,18,0.08)' : isResource ? 'rgba(155,89,182,0.08)' : isCommitment ? 'rgba(39,174,96,0.08)' : 'rgba(255,255,255,0.05)';
  const titleColor  = isMilestone ? '#F39C12' : isResource ? '#C39BD3' : isCommitment ? '#6ee29a' : '#ECF0F1';
  const bc          = 'rgba(255,255,255,0.12)';

  let bodyHtml;
  if (isMilestone) {
    bodyHtml = buildMilestonesHtml(section.items);
  } else if (isResource) {
    bodyHtml = buildResourcesHtml(section.items);
  } else if (isCommitment) {
    bodyHtml = buildTimeCommitmentHtml(section.items);
  } else {
    bodyHtml = section.items.map(item =>
      `<div class="roadmap-item-row">
        <span class="roadmap-item-dot" style="background:#4A90D9"></span>
        <span class="roadmap-item-content">${typeof item === 'object' ? item.text : item}</span>
      </div>`
    ).join('');
  }

  return `
  <div class="roadmap-section-card" style="border-color:${bc};border-left-color:${accentColor}">
    <button class="roadmap-week-header" style="background:${headerBg}"
      onclick="toggleRoadmapCard('${id}', this)">
      <div class="roadmap-week-header-left">
        <span class="roadmap-section-icon">${icon}</span>
        <span class="roadmap-week-theme" style="color:${titleColor}">${section.title}</span>
      </div>
      <span class="roadmap-week-chevron" id="chev-${id}" style="color:${titleColor}">▾</span>
    </button>
    <div class="roadmap-week-body" id="${id}">${bodyHtml}</div>
  </div>`;
}

function toggleRoadmapCard(id, btn) {
  const body = document.getElementById(id);
  const chevId = 'chev-' + id;
  const chev = document.getElementById(chevId);
  if (!body) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? '' : 'none';
  if (chev) chev.textContent = isHidden ? '▾' : '▸';
}

const TIME_PERIODS_JS = [
  { re: /weekend/i,                     icon: '🌅', color: '#9B59B6', label: 'Weekend'   },
  { re: /saturday|sunday/i,             icon: '🌅', color: '#9B59B6', label: 'Weekend'   },
  { re: /morning/i,                     icon: '☀️',  color: '#F39C12', label: 'Morning'   },
  { re: /evening|night/i,               icon: '🌙', color: '#4A90D9', label: 'Evening'   },
  { re: /afternoon/i,                   icon: '🌤', color: '#27AE60', label: 'Afternoon' },
  { re: /weekday|mon|tue|wed|thu|fri/i, icon: '📅', color: '#4A90D9', label: 'Weekdays'  },
  { re: /total|overall|per week/i,      icon: '📊', color: '#E74C3C', label: 'Total'     },
  { re: /tip|note|recommend/i,          icon: '💡', color: '#F39C12', label: 'Tip'       },
];

function classifyTimePeriodJs(text) {
  for (const p of TIME_PERIODS_JS) {
    if (p.re.test(text)) return p;
  }
  return { icon: '⏱', color: 'rgba(255,255,255,0.45)', label: null };
}

function extractTimeBadgeJs(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:–|-to-)?\s*(\d+(?:\.\d+)?)?\s*hours?/i)
    || text.match(/(\d+(?:\.\d+)?)\s*hrs?/i)
    || text.match(/(\d+)\s*(?:–|-)?\s*(\d+)?\s*minutes?/i);
  if (!m) return null;
  const lo = parseFloat(m[1]);
  const hi = m[2] ? parseFloat(m[2]) : null;
  const unit = /minute/i.test(m[0]) ? 'min' : 'hr';
  return hi ? `${lo}–${hi} ${unit}` : `${lo} ${unit}`;
}

function stripTimePrefixJs(text) {
  return text
    .replace(/^\*{1,2}[^*]+\*{1,2}[:\s]*/,'')
    .replace(/^(weekday|weekend|morning|evening|afternoon|saturday|sunday|monday|tuesday|wednesday|thursday|friday|total|tip|note)[s]?[:\s\-–]*/i, '')
    .trim();
}

function buildTimeCommitmentHtml(items) {
  return '<div class="time-commitment-list">' + items.filter(raw => {
    const text = typeof raw === 'object' ? raw.text : raw;
    return classifyTimePeriodJs(text).label !== null;
  }).map(raw => {
    const text = typeof raw === 'object' ? raw.text : raw;
    const { icon, color, label } = classifyTimePeriodJs(text);
    const timeBadge = extractTimeBadgeJs(text);
    const display = stripTimePrefixJs(text);
    const labelHtml = label ? `<span class="time-label" style="color:${color}">${label}</span>` : '';
    const badgeHtml = timeBadge
      ? `<div class="time-badge" style="background:${color}18;color:${color};border-color:${color}50">${timeBadge}</div>`
      : '';
    return `<div class="time-row" style="border-color:${color}30">
      <div class="time-row-left">
        <span class="time-icon" style="background:${color}18;color:${color}">${icon}</span>
        ${labelHtml}
      </div>
      <div class="time-row-content"><span class="time-desc">${display}</span></div>
      ${badgeHtml}
    </div>`;
  }).join('') + '</div>';
}

const TIER_META_JS = {
  required:     { label: 'Required',     color: '#E74C3C', bg: 'rgba(231,76,60,0.15)'  },
  preferred:    { label: 'Preferred',    color: '#F39C12', bg: 'rgba(243,156,18,0.15)' },
  nice_to_have: { label: 'Nice to Have', color: '#3498DB', bg: 'rgba(52,152,219,0.15)' },
};

function buildGapSummaryHtml(sections, data) {
  const gapSection = sections.find(s =>
    s.type === 'section' && s.title.toLowerCase().includes('gap analysis')
  );

  const score     = Math.round((data && data.overall_score) || 0);
  const breakdown = (data && data.breakdown) || {};
  const matched   = (data && data.matched_skills) || [];
  const missing   = (data && data.missing_skills) || [];

  const scoreColor = score >= 80 ? '#27AE60' : score >= 55 ? '#F39C12' : '#E74C3C';
  const scoreLabel = score >= 80 ? 'Strong Fit' : score >= 55 ? 'Moderate Fit' : 'Needs Work';

  // Narrative: plain-text items (non-bullets) from the gap section
  let narrative = '';
  if (gapSection) {
    narrative = gapSection.items
      .filter(item => typeof item === 'object' && item.plain)
      .map(item => item.text)
      .join(' ');
    if (!narrative) {
      narrative = gapSection.items
        .filter(item => typeof item === 'string')
        .join(' ');
    }
  }

  // Tier bars
  let tierBarsHtml = '';
  const tierKeys = Object.keys(breakdown);
  if (tierKeys.length) {
    const rows = tierKeys.map(tier => {
      const meta = TIER_META_JS[tier];
      if (!meta) return '';
      const info = breakdown[tier];
      const matchedCount = info.matched_count != null ? info.matched_count : (Array.isArray(info.matched) ? info.matched.length : 0);
      const missingCount = Array.isArray(info.missing) ? info.missing.length : 0;
      const total = matchedCount + missingCount;
      const pct = total > 0 ? Math.round((matchedCount / total) * 100) : 0;
      const missingBar = missingCount > 0
        ? `<div class="gap-tier-bar-missing" style="width:${100 - pct}%;background:${meta.bg}"></div>`
        : '';
      return `<div class="gap-tier-row">
        <div class="gap-tier-label-row">
          <span class="gap-tier-name" style="color:${meta.color}">${meta.label}</span>
          <span class="gap-tier-counts">
            <span style="color:#6ee29a">${matchedCount} matched</span>${missingCount > 0 ? `<span style="color:#f79083"> · ${missingCount} missing</span>` : ''}
          </span>
          <span class="gap-tier-pct" style="color:${meta.color}">${pct}%</span>
        </div>
        <div class="gap-tier-bar-track">
          <div class="gap-tier-bar-fill" style="width:${pct}%;background:${meta.color}"></div>
          ${missingBar}
        </div>
      </div>`;
    }).join('');
    tierBarsHtml = `<div class="gap-tier-bars">${rows}</div>`;
  }

  // Chips
  let twoColHtml = '';
  if (matched.length || missing.length) {
    const matchedChips = matched.slice(0, 8)
      .map(s => `<span class="gap-chip gap-chip-match">${s}</span>`).join('')
      + (matched.length > 8 ? `<span class="gap-chip-more">+${matched.length - 8} more</span>` : '');
    const missingChips = missing.slice(0, 8)
      .map(s => `<span class="gap-chip gap-chip-miss">${s}</span>`).join('')
      + (missing.length > 8 ? `<span class="gap-chip-more">+${missing.length - 8} more</span>` : '');

    const strengthCol = matched.length ? `
      <div class="gap-col gap-col-strength">
        <div class="gap-col-header"><span class="gap-col-icon">✓</span> Strengths</div>
        <div class="gap-col-chips">${matchedChips}</div>
      </div>` : '';
    const missingCol = missing.length ? `
      <div class="gap-col gap-col-missing">
        <div class="gap-col-header"><span class="gap-col-icon">✗</span> Gaps to Close</div>
        <div class="gap-col-chips">${missingChips}</div>
      </div>` : '';
    twoColHtml = `<div class="gap-two-col">${strengthCol}${missingCol}</div>`;
  }

  return `
  <div class="panel-title">&#128202; Gap Analysis Summary</div>
  <div class="gap-summary-card">
    <div class="gap-summary-header">
      <div class="gap-summary-title">
        <span class="gap-summary-icon">📊</span>
        Gap Analysis Summary
      </div>
      <div class="gap-summary-score-badge" style="color:${scoreColor};border-color:${scoreColor}">
        <span class="gap-summary-score-num">${score}%</span>
        <span class="gap-summary-score-label">${scoreLabel}</span>
      </div>
    </div>
    ${narrative ? `<p class="gap-summary-narrative">${narrative}</p>` : ''}
    ${tierBarsHtml}
    ${twoColHtml}
  </div>`;
}

function buildRoadmapHtml(markdown) {
  const sections = parseRoadmark(markdown);
  if (!sections.length) return `<p style="color:rgba(255,255,255,0.4);font-size:0.88rem">No roadmap data available.</p>`;

  const weeks   = sections.filter(s => s.type === 'week');
  const others  = sections.filter(s =>
    s.type === 'section' && !s.title.toLowerCase().includes('gap analysis')
  );

  // Progress track
  let trackHtml = '';
  if (weeks.length) {
    const steps = weeks.map(w => {
      const c = WEEK_COLORS_JS[(w.week - 1) % WEEK_COLORS_JS.length];
      return `<div class="roadmap-progress-step">
        <div class="roadmap-progress-dot" style="background:${c.accent};box-shadow:0 0 10px ${c.accent}66">${w.week}</div>
        <div class="roadmap-progress-label" style="color:${c.accent}">Week ${w.week}</div>
        <div class="roadmap-progress-theme">${w.theme}</div>
      </div>`;
    }).join('');
    trackHtml = `<div class="roadmap-progress-track">${steps}</div>`;
  }

  const cardsHtml = [
    ...weeks.map((w, i) => buildRoadmapWeekHtml(w, i === 0)),
    ...others.map(s => buildRoadmapSectionHtml(s)),
  ].join('');

  return `${trackHtml}<div class="roadmap-cards">${cardsHtml}</div>`;
}

function renderStrategistResult(data, jobId) {
  // Score (overall_score is already a percentage, e.g. 87.5 — do NOT multiply by 100)
  const score = Math.round(data.overall_score || 0);
  el('score-number').textContent = `${score}%`;
  el('score-bar-fill').style.width = `${score}%`;
  el('score-role').textContent   = data.target_role || '';
  el('score-company').textContent = data.company || '';

  // Breakdown table
  const breakdown = data.breakdown || {};
  const tbody = el('breakdown-tbody');
  tbody.innerHTML = '';
  const tierLabels = {
    required:     { label: 'Required',     weight: '1.0' },
    preferred:    { label: 'Preferred',    weight: '0.5' },
    nice_to_have: { label: 'Nice to Have', weight: '0.25' },
  };
  Object.entries(breakdown).forEach(([tier, info]) => {
    const meta = tierLabels[tier] || { label: tier, weight: '-' };
    const tr = document.createElement('tr');
    const matched = info.matched_count ?? (Array.isArray(info.matched) ? info.matched.length : 0);
    const total   = info.total_count   ?? (Array.isArray(info.matched) && Array.isArray(info.missing)
                      ? (info.matched.length + info.missing.length) : 0);
    const pct     = total > 0 ? Math.round((matched / total) * 100) : 0;
    tr.innerHTML = `
      <td><span class="chip chip-tier">${meta.label}</span></td>
      <td>${matched} / ${total}</td>
      <td>${pct}%</td>
      <td>${meta.weight}</td>
    `;
    tbody.appendChild(tr);
  });

  // Matched skills
  const matchedChips = el('matched-chips');
  matchedChips.innerHTML = '';
  (data.matched_skills || []).forEach(s => {
    const c = document.createElement('span');
    c.className = 'chip chip-matched';
    c.textContent = s;
    matchedChips.appendChild(c);
  });

  // Missing skills
  const missingChips = el('missing-chips');
  missingChips.innerHTML = '';
  (data.missing_skills || []).forEach(s => {
    const c = document.createElement('span');
    c.className = 'chip chip-missing';
    c.textContent = s;
    missingChips.appendChild(c);
  });

  // Charts
  const chartData = data.chart_data || {};
  const chartMap = {
    'chart-donut':          chartData.donut,
    'chart-tier-bar':       chartData.tier_bar,
    'chart-matched-missing': chartData.matched_missing,
    'chart-radar':          chartData.radar,
  };
  Object.entries(chartMap).forEach(([imgId, b64]) => {
    const img = el(imgId);
    if (img && b64) {
      img.src = `data:image/png;base64,${b64}`;
      img.style.display = 'block';
    }
  });

  // Gap Analysis Summary (standalone panel)
  el('gap-summary-content').innerHTML = buildGapSummaryHtml([], data);

  // Roadmap
  const roadmap = data.roadmap_markdown || '';
  el('roadmap-content').innerHTML = buildRoadmapHtml(roadmap);
}

function ensureResultsVisible() {
  hasResults = true;
  hide('results-empty-state');
  show('results-section');
}

function showDownloadBar(jobId) {
  const bar = el('download-bar');
  if (!bar) return;
  bar.style.display = 'flex';
  const btn = el('download-btn');
  if (btn) btn.href = `/download/pdf/${jobId}`;
}

function showError(title, detail) {
  show('error-section');
  el('error-title').textContent = title;
  el('error-detail').textContent = detail;
  addLog(`Error: ${title}`, 'error');
}

function resetSubmitBtn() {
  const btn = el('submit-btn');
  if (btn) {
    btn.disabled = !selectedFile;
    btn.textContent = 'Analyze Resume';
  }
}

/* ── Init ──────────────────────────────────────────────────── */

/* ── Dashboard tab switching ('upload' | 'results') ────────── */
let hasResults = false;

function switchDashTab(tab) {
  const uploadTab  = el('dash-tab-upload');
  const resultsTab = el('dash-tab-results');
  const navUpload  = el('nav-upload');
  const navResults = el('nav-results');

  if (!uploadTab || !resultsTab) return;   // HTML not present yet

  if (tab === 'upload') {
    uploadTab.style.display  = '';
    resultsTab.style.display = 'none';
  } else {
    uploadTab.style.display  = 'none';
    resultsTab.style.display = '';
    if (!hasResults) {
      show('results-empty-state');
      hide('results-section');
    }
  }

  // Update sidebar active state
  [navUpload, navResults].forEach(n => n && n.classList.remove('active'));
  if (tab === 'upload' && navUpload)  navUpload.classList.add('active');
  if (tab === 'results' && navResults) navResults.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
  configureMarked();
  initUploadZone();

  const form = el('upload-form');
  if (form) form.addEventListener('submit', async (e) => {
    await handleSubmit(e);
    // Auto-switch to results tab after submit
    switchDashTab('results');
  });

  // Nav item click handlers
  const navUpload  = el('nav-upload');
  const navResults = el('nav-results');
  if (navUpload)  navUpload.addEventListener('click',  () => switchDashTab('upload'));
  if (navResults) navResults.addEventListener('click', () => switchDashTab('results'));

  // Start on upload tab
  switchDashTab('upload');
});
