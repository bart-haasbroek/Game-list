// Notities per game: WYSIWYG-editor met Tiptap (kopjes, lijsten, afvinklijstjes voor je voortgang).
// Tiptap wordt pas geladen als je een eigen game opent, zodat de app snel blijft starten.

let editor = null;   // actieve editor
let gameId = null;   // van welke game
let wrapper = null;  // toolbar + editor, wordt bij opnieuw tekenen van de info-pagina verplaatst i.p.v. opnieuw gemaakt
let hadFocus = false;

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Oude notities waren platte tekst: omzetten naar alinea's
export const toHTML = (notes) => {
  if (!notes) return '';
  if (/^\s*</.test(notes)) return notes;
  return notes.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
};
// Platte tekst (voor zoeken of een voorbeeldregel)
export const notesText = (notes) => toHTML(notes).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const I = (d) => `<svg viewBox="0 0 24 24" class="size-[18px]!">${d}</svg>`;
const TOOLS = [
  { cmd: 'h2', title: 'Kopje', html: '<b class="text-[14px]">H</b>', active: e => e.isActive('heading', { level: 2 }), run: c => c.toggleHeading({ level: 2 }) },
  { cmd: 'bold', title: 'Vet', html: '<b class="text-[15px]">B</b>', active: e => e.isActive('bold'), run: c => c.toggleBold() },
  { cmd: 'italic', title: 'Cursief', html: '<i class="font-serif text-[16px]">I</i>', active: e => e.isActive('italic'), run: c => c.toggleItalic() },
  { cmd: 'strike', title: 'Doorhalen', html: '<s class="text-[15px]">S</s>', active: e => e.isActive('strike'), run: c => c.toggleStrike() },
  { cmd: 'task', title: 'Afvinklijst', html: I('<rect x="3" y="4" width="6" height="6" rx="1"/><path d="m4.5 7 1 1 2-2"/><rect x="3" y="14" width="6" height="6" rx="1"/><path d="M13 7h8M13 17h8"/>'), active: e => e.isActive('taskList'), run: c => c.toggleTaskList() },
  { cmd: 'bullet', title: 'Opsomming', html: I('<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'), active: e => e.isActive('bulletList'), run: c => c.toggleBulletList() },
  { cmd: 'ordered', title: 'Genummerd', html: I('<path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 6h1v4M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>'), active: e => e.isActive('orderedList'), run: c => c.toggleOrderedList() },
  { cmd: 'undo', title: 'Ongedaan maken', html: I('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'), active: () => false, run: c => c.undo(), can: e => e.can().undo() },
];

function updateToolbar() {
  if (!editor || !wrapper) return;
  for (const t of TOOLS) {
    const b = wrapper.querySelector(`[data-cmd="${t.cmd}"]`);
    const on = t.active(editor);
    b.classList.toggle('bg-accent', on);
    b.classList.toggle('text-white', on);
    if (t.can) b.disabled = !t.can(editor);
  }
}

/** Haalt de editor uit de pagina vóórdat de info-pagina opnieuw getekend wordt. */
export function detachNotes() {
  if (!wrapper) return;
  hadFocus = wrapper.contains(document.activeElement);
  wrapper.remove();
}

/**
 * Zet de editor in `mount` (een lege div). Hergebruikt de bestaande editor als het dezelfde game is.
 * `onChange(html)` krijgt de nieuwe inhoud ('' als leeg).
 */
export async function mountNotes(mount, id, notes, onChange) {
  if (editor && gameId === id && wrapper) {
    mount.replaceWith(wrapper);
    if (hadFocus) editor.commands.focus();
    return;
  }
  destroyNotes();
  mount.innerHTML = '<div class="min-h-[140px] rounded-xl bg-surface p-3 text-muted">Notities laden…</div>';
  const [{ Editor }, { default: StarterKit }, { default: TaskList }, { default: TaskItem }, { default: Placeholder }] = await Promise.all([
    import('@tiptap/core'), import('@tiptap/starter-kit'), import('@tiptap/extension-task-list'),
    import('@tiptap/extension-task-item'), import('@tiptap/extension-placeholder'),
  ]);
  if (!mount.isConnected) return; // intussen een andere pagina geopend

  wrapper = document.createElement('div');
  wrapper.className = 'overflow-hidden rounded-xl bg-surface';
  wrapper.innerHTML = `
    <div class="no-scrollbar flex gap-0.5 overflow-x-auto border-b border-line p-1.5">
      ${TOOLS.map(t => `<button type="button" data-cmd="${t.cmd}" title="${t.title}" aria-label="${t.title}"
        class="grid h-9 min-w-9 flex-none place-items-center rounded-lg px-1.5 text-ink active:bg-surface-2 disabled:opacity-30 ${t.cmd === 'undo' ? 'ml-auto' : ''}">${t.html}</button>`).join('')}
    </div>
    <div data-editor></div>`;
  // Toolbar: mousedown voorkomen zodat de cursor in de tekst blijft staan
  wrapper.firstElementChild.addEventListener('mousedown', (e) => e.preventDefault());
  wrapper.firstElementChild.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]');
    if (!b || !editor) return;
    TOOLS.find(t => t.cmd === b.dataset.cmd).run(editor.chain().focus()).run();
  });
  mount.replaceWith(wrapper);

  gameId = id;
  editor = new Editor({
    element: wrapper.querySelector('[data-editor]'),
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, code: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Voortgang, tips, waar je gebleven bent… Gebruik het afvinklijstje voor je doelen.' }),
    ],
    content: toHTML(notes),
    editorProps: { attributes: { class: 'notes-editor', spellcheck: 'true' } },
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? '' : ed.getHTML()),
    onTransaction: updateToolbar,
  });
  updateToolbar();
}

export function destroyNotes() {
  editor?.destroy();
  editor = null; gameId = null; wrapper = null; hadFocus = false;
}
