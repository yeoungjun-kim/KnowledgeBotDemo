let docs = [];
let isLoading = false;

const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const messages = document.getElementById('messages');
const statusBadge = document.getElementById('statusBadge');

chatInput.addEventListener('input', () => {
  sendBtn.disabled = !chatInput.value.trim() || isLoading || docs.length === 0;
});

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
}

function useChip(el) {
  chatInput.value = el.textContent;
  chatInput.dispatchEvent(new Event('input'));
  chatInput.focus();
}

function openModal() {
  document.getElementById('modal').style.display = 'flex';
  setTimeout(() => document.getElementById('docName').focus(), 50);
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('docName').value = '';
  document.getElementById('docContent').value = '';
  document.getElementById('charCount').textContent = '0 characters';
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}

function updateCharCount() {
  const len = document.getElementById('docContent').value.length;
  document.getElementById('charCount').textContent = len.toLocaleString() + ' characters';
}

function chunkText(text) {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 30);
  const chunks = [];
  let current = '';
  for (const p of paragraphs) {
    if ((current + p).length > 500 && current.length > 0) {
      chunks.push(current.trim());
      current = p;
    } else {
      current += (current ? '\n\n' : '') + p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, 1000)];
}

// Calls the /api/embed proxy (see api/embed.js) so the Gemini key stays
// server-side. Returns one embedding vector per input string, same order.
async function embedTexts(texts) {
  const res = await fetch('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.embeddings;
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function saveDoc() {
  const name = document.getElementById('docName').value.trim();
  const content = document.getElementById('docContent').value.trim();
  if (!name || !content) return;
  const saveBtn = document.querySelector('.modal .btn-primary');
  saveBtn.textContent = 'Embedding...';
  saveBtn.disabled = true;
  try {
    const chunkTexts = chunkText(content);
    const embeddings = await embedTexts(chunkTexts);
    docs.push({
      id: Date.now(), name, content,
      chunks: chunkTexts.map((text, i) => ({ text, embedding: embeddings[i] })),
      added: new Date().toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' })
    });
    renderDocs();
    closeModal();
    sendBtn.disabled = !chatInput.value.trim();
  } catch (err) {
    alert('Could not add document: ' + err.message);
  } finally {
    saveBtn.textContent = 'Add Document';
    saveBtn.disabled = false;
  }
}

function deleteDoc(id) {
  docs = docs.filter(d => d.id !== id);
  renderDocs();
  if (docs.length === 0) sendBtn.disabled = true;
}

function renderDocs() {
  document.getElementById('docCount').textContent = docs.length;
  const docList = document.getElementById('docList');
  if (docs.length === 0) {
    docList.innerHTML = `<div class="empty-docs"><div class="empty-icon">📄</div>No documents yet.<br>Add your first document to get started.</div>`;
    return;
  }
  docList.innerHTML = docs.map(d => `
    <div class="doc-item">
      <div class="doc-icon">📄</div>
      <div class="doc-info">
        <div class="doc-name" title="${d.name}">${d.name}</div>
        <div class="doc-meta">${d.chunks.length} chunks · ${d.added}</div>
      </div>
      <button class="doc-delete" onclick="deleteDoc(${d.id})">✕</button>
    </div>`).join('');
}

async function findRelevantChunks(question) {
  const [qVector] = await embedTexts([question]);
  const scored = [];
  for (const doc of docs) {
    for (const chunk of doc.chunks) {
      scored.push({ docName: doc.name, chunk: chunk.text, score: cosineSimilarity(qVector, chunk.embedding) });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 4);
}

function addMessage(role, text, sources = []) {
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const avatar = role === 'user' ? `<div class="msg-avatar">Me</div>` : `<div class="msg-avatar">🤖</div>`;
  const sourceTags = sources.length > 0
    ? `<div class="msg-sources">${sources.map(s => `<div class="source-tag"><span class="source-dot"></span>${s}</div>`).join('')}</div>` : '';
  div.innerHTML = `${avatar}<div class="msg-body"><div class="msg-bubble">${text.replace(/\n/g, '<br>')}</div>${sourceTags}</div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function addThinking() {
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();
  const div = document.createElement('div');
  div.className = 'msg bot'; div.id = 'thinking';
  div.innerHTML = `<div class="msg-avatar">🤖</div><div class="msg-body"><div class="thinking"><div class="dot-pulse"><span></span><span></span><span></span></div>Thinking...</div></div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function setStatus(text, color) {
  statusBadge.textContent = '● ' + text;
  statusBadge.style.color = color || 'var(--green)';
  statusBadge.style.background = color ? 'rgba(248,113,113,0.1)' : 'var(--green-dim)';
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || isLoading) return;
  isLoading = true; sendBtn.disabled = true;
  chatInput.value = ''; chatInput.style.height = 'auto';
  addMessage('user', text);
  addThinking();
  setStatus('Thinking...', 'var(--accent)');
  try {
    const relevant = await findRelevantChunks(text);
    const contextBlock = relevant.map(r => `[From: ${r.docName}]\n${r.chunk}`).join('\n\n---\n\n');
    const uniqueSources = [...new Set(relevant.map(r => r.docName))];
    const prompt = `You are a helpful knowledge assistant. Answer using only the context below. Be concise and direct. If the answer is not in the context, say so honestly.\n\nContext:\n\n${contextBlock}\n\n---\n\nQuestion: ${text}`;
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    document.getElementById('thinking')?.remove();
    if (data.error) {
      addMessage('bot', 'Something went wrong: ' + data.error);
      setStatus('Error', 'var(--red)');
    } else {
      addMessage('bot', data.text, uniqueSources);
      setStatus('Ready');
    }
  } catch (err) {
    document.getElementById('thinking')?.remove();
    addMessage('bot', 'Could not reach the API. Please check your connection.');
    setStatus('Error', 'var(--red)');
  }
  isLoading = false;
  sendBtn.disabled = !chatInput.value.trim() || docs.length === 0;
}
