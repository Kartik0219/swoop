/* Swoop Sites chat panel. Loaded on the first click of the chat bubble. */
const bubble = document.getElementById('chat-bubble');
const panel = document.createElement('div');
panel.id = 'chat-panel';
panel.setAttribute('role', 'dialog');
panel.setAttribute('aria-label', 'Swoop Sites assistant');
panel.innerHTML = `
  <div class="cp-hd">
    <div><b>Swoop Sites assistant</b><small>AI assistant &middot; Kartik replies by email</small></div>
    <button type="button" class="cp-x" aria-label="Close chat">&times;</button>
  </div>
  <div class="cp-log" aria-live="polite"></div>
  <form class="cp-f">
    <label class="sr" for="cp-in">Your question</label>
    <input id="cp-in" autocomplete="off" maxlength="500" placeholder="Ask about prices, timing, care plans...">
    <button type="submit" aria-label="Send">&rarr;</button>
  </form>`;
document.body.appendChild(panel);

const log = panel.querySelector('.cp-log');
const form = panel.querySelector('.cp-f');
const input = panel.querySelector('#cp-in');
const msgs = [];

function add(role, text) {
  const p = document.createElement('p');
  p.className = 'cp-m ' + (role === 'user' ? 'me' : 'ai');
  p.textContent = text;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
  return p;
}

add('assistant', "Hi! I'm the Swoop Sites AI assistant. Ask me about prices, how it works, or getting a free homepage mockup.");

function open() {
  panel.classList.add('open');
  bubble.setAttribute('aria-expanded', 'true');
  setTimeout(() => input.focus(), 50);
}
function close() {
  panel.classList.remove('open');
  bubble.setAttribute('aria-expanded', 'false');
  bubble.focus();
}

bubble.addEventListener('click', () => (panel.classList.contains('open') ? close() : open()));
panel.querySelector('.cp-x').addEventListener('click', close);
panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  add('user', text);
  msgs.push({ role: 'user', content: text });
  const wait = add('assistant', '...');
  wait.classList.add('typing');
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: msgs }) });
    const d = await r.json();
    wait.classList.remove('typing');
    wait.textContent = d.reply || 'Sorry, something went wrong. Please email kartikp.work@gmail.com.';
    if (d.saved) wait.textContent += ' (Thanks, Kartik has your details.)';
    msgs.push({ role: 'assistant', content: d.reply || '' });
  } catch {
    wait.classList.remove('typing');
    wait.textContent = "I couldn't connect. Please email kartikp.work@gmail.com.";
  }
});

open();
