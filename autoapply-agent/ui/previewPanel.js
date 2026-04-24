// Preview Panel - Editable answer preview

export function createPreviewPanel(initialContent) {
  const panel = document.createElement('div');
  panel.className = 'preview-panel';
  panel.innerHTML = `
    <div class="preview-header">
      <h3>Answer Preview</h3>
      <button class="btn-edit-toggle">✏️ Edit</button>
    </div>

    <div class="preview-content-mode">
      <div class="preview-text">${escapeHtml(initialContent)}</div>
    </div>

    <div class="preview-edit-mode" style="display: none;">
      <textarea class="preview-textarea" placeholder="Edit your answer...">${initialContent}</textarea>
      <div class="edit-actions">
        <button class="btn-save">Save</button>
        <button class="btn-cancel">Cancel</button>
      </div>
    </div>

    <div class="preview-tools">
      <button class="btn-copy">📋 Copy</button>
      <button class="btn-apply">✅ Apply</button>
    </div>
  `;

  let isEditing = false;

  // Toggle edit mode
  panel.querySelector('.btn-edit-toggle').addEventListener('click', () => {
    isEditing = !isEditing;
    panel.querySelector('.preview-content-mode').style.display = isEditing ? 'none' : 'block';
    panel.querySelector('.preview-edit-mode').style.display = isEditing ? 'block' : 'none';
    
    if (isEditing) {
      const textarea = panel.querySelector('.preview-textarea');
      textarea.value = panel.querySelector('.preview-text').textContent;
      textarea.focus();
    }
  });

  // Save edits
  panel.querySelector('.btn-save').addEventListener('click', () => {
    const newText = panel.querySelector('.preview-textarea').value;
    panel.querySelector('.preview-text').textContent = newText;
    isEditing = false;
    panel.querySelector('.preview-content-mode').style.display = 'block';
    panel.querySelector('.preview-edit-mode').style.display = 'none';
  });

  // Cancel edits
  panel.querySelector('.btn-cancel').addEventListener('click', () => {
    isEditing = false;
    panel.querySelector('.preview-content-mode').style.display = 'block';
    panel.querySelector('.preview-edit-mode').style.display = 'none';
  });

  // Copy to clipboard
  panel.querySelector('.btn-copy').addEventListener('click', async () => {
    const text = panel.querySelector('.preview-text').textContent;
    await navigator.clipboard.writeText(text);
    const btn = panel.querySelector('.btn-copy');
    btn.textContent = '✅ Copied!';
    setTimeout(() => {
      btn.textContent = '📋 Copy';
    }, 2000);
  });

  return panel;
}

export function getPreviewContent(panel) {
  return panel.querySelector('.preview-text').textContent;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
