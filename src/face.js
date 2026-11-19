/* ---------- a cara do Gi: máscara de guarda-redes, branca e azul-gelo, num medalhão de vidro ---------- */
function giFace(mood) {
  const id = 'gf' + Math.random().toString(36).slice(2, 7);
  const brow = mood === 'win' ? 'M34 47q8-6 16-2M78 45q8-4 16 2' : mood === 'sad' ? 'M34 44q8 4 16 6M78 50q8-2 16-6' : 'M34 46q8-3 16 0M78 46q8-3 16 0';
  const eye = mood === 'sad' ? 'M38 57q5-3 10 0M80 57q5-3 10 0' : null;
  return `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mister Gi">
  <defs>
    <radialGradient id="${id}b" cx="35%" cy="25%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#d7ebfb"/><stop offset="1" stop-color="#8ec3ec"/></radialGradient>
    <linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfeefa"/></linearGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a93e6"/><stop offset="1" stop-color="#0f4e94"/></linearGradient>
  </defs>
  <circle cx="64" cy="64" r="60" fill="url(#${id}b)" stroke="#fff" stroke-width="4"/>
  <circle cx="64" cy="64" r="53" fill="none" stroke="#1d6fc4" stroke-opacity=".25" stroke-width="1.5" stroke-dasharray="3 5"/>
  <!-- stick atrás -->
  <path d="M22 104 L92 22" stroke="#0f4e94" stroke-width="7" stroke-linecap="round"/>
  <path d="M14 106 q2 8 14 4 l6-6 -8-4z" fill="#0f4e94"/>
  <!-- máscara -->
  <path d="M64 18c-22 0-34 14-34 36 0 24 12 46 34 52 22-6 34-28 34-52 0-22-12-36-34-36z" fill="url(#${id}m)" stroke="#9cc6ea" stroke-width="2"/>
  <path d="M64 18c-6 10-6 26 0 36 6-10 6-26 0-36z" fill="url(#${id}s)" opacity=".9"/>
  <path d="M30 50c10-4 22-4 30 2M98 50c-10-4-22-4-30 2" stroke="url(#${id}s)" stroke-width="4" fill="none" stroke-linecap="round"/>
  <!-- olhos -->
  <ellipse cx="44" cy="58" rx="10" ry="7.5" fill="#0c2440"/><ellipse cx="84" cy="58" rx="10" ry="7.5" fill="#0c2440"/>
  ${eye ? `<path d="${eye}" stroke="#bfe1ff" stroke-width="2.5" fill="none" stroke-linecap="round"/>` : `<circle cx="46" cy="57" r="3" fill="#bfe1ff"/><circle cx="86" cy="57" r="3" fill="#bfe1ff"/>`}
  <path d="${brow}" stroke="#0f4e94" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <!-- grade -->
  <path d="M40 72h48M38 82h52M42 92h44M52 70v30M64 70v34M76 70v30" stroke="#1d6fc4" stroke-width="3" stroke-linecap="round" fill="none"/>
  <path d="M40 72q24 40 48 0" stroke="#0f4e94" stroke-width="3" fill="none"/>
  ${mood === 'win' ? '<path d="M100 26l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#ffd34d" stroke="#fff" stroke-width="1.5"/>' : ''}
  ${mood === 'sad' ? '<path d="M100 40q-5 8 0 11 5-3 0-11z" fill="#7cc4ff" stroke="#fff" stroke-width="1"/>' : ''}
  <!-- disco -->
  <ellipse cx="96" cy="104" rx="13" ry="5" fill="#0c2440"/><rect x="83" y="99" width="26" height="5" fill="#0c2440"/><ellipse cx="96" cy="99" rx="13" ry="5" fill="#26476b"/>
</svg>`;
}
