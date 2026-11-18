// Notities per game: WYSIWYG-editor met Tiptap (kop/subkop/tussenkop, lijsten, afvinklijstjes voor je voortgang).
// Bewerken gebeurt in een schermvullende overlay (#notesScreen); de info-pagina toont een voorbeeld.
// Tiptap wordt pas geladen als je de notities opent, zodat de app snel blijft starten.

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
// Tekststijlen in het uitklapmenu van de kopknop
const BLOCKS = [
  { id: 'p', label: 'Gewone tekst', short: 'Tekst', preview: 'text-[15px]', active: e => !e.isActive('heading'), run: c => c.setParagraph() },
  { id: 'h1', label: 'Kop', short: 'Kop', preview: 'text-[20px] font-extrabold', active: e => e.isActive('heading', { level: 1 }), run: c => c.setHeading({ level: 1 }) },
  { id: 'h2', label: 'Subkop', short: 'Subkop', preview: 'text-[17px] font-bold text-accent', active: e => e.isActive('heading', { level: 2 }), run: c => c.setHeading({ level: 2 }) },
  { id: 'h3', label: 'Tussenkop', short: 'Tussenkop', preview: 'text-[16.5px] font-bold', active: e => e.isActive('heading', { level: 3 }), run: c => c.setHeading({ level: 3 }) },
];
const currentBlock = (e) => BLOCKS.slice(1).find(b => b.active(e)) || BLOCKS[0];
const CHEVRON = '<svg viewBox="0 0 24 24" class="size-3.5! opacity-60"><path d="m6 9 6 6 6-6"/></svg>';

const TOOLS = [
  { cmd: 'block', title: 'Tekststijl', menu: true, sep: true },
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
  const cur = currentBlock(editor);
  wrapper.querySelector('[data-block-label]').textContent = cur.short;
  wrapper.querySelectorAll('[data-block]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.block === cur.id)));
  for (const t of TOOLS) {
    if (t.menu) continue;
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
// Tiptap alvast laden (bv. bij het openen van een eigen game), zodat de modal daarna soepel opent
let tiptap = null;
export const preloadNotes = () => (tiptap ||= Promise.all([
  import('@tiptap/core'), import('@tiptap/starter-kit'), import('@tiptap/extension-task-list'),
  import('@tiptap/extension-task-item'), import('@tiptap/extension-placeholder'),
]).catch((e) => { tiptap = null; throw e; }));

export async function mountNotes(mount, id, notes, onChange, { focus = false } = {}) {
  if (editor && gameId === id && wrapper) {
    mount.replaceWith(wrapper);
    if (hadFocus) editor.commands.focus();
    return;
  }
  destroyNotes();
  if (!mount.firstChild) mount.innerHTML = '<div class="p-5 text-muted">Notities laden…</div>';
  const [{ Editor }, { default: StarterKit }, { default: TaskList }, { default: TaskItem }, { default: Placeholder }] = await preloadNotes();
  if (!mount.isConnected) return; // intussen een andere pagina geopend

  wrapper = document.createElement('div');
  wrapper.className = 'relative flex min-h-0 flex-1 flex-col';
  wrapper.innerHTML = `
    <div class="notes-toolbar no-scrollbar flex flex-none gap-0.5 overflow-x-auto border-b border-line p-1.5">
      ${TOOLS.map(t => (t.menu
        ? `<button type="button" data-cmd="${t.cmd}" aria-haspopup="menu" aria-expanded="false" title="${t.title}"
            class="flex h-9 flex-none items-center gap-1 rounded-lg bg-surface-2 pl-2.5 pr-1.5 text-[14px] font-semibold text-ink"><span data-block-label>Tekst</span>${CHEVRON}</button>`
        : `<button type="button" data-cmd="${t.cmd}" title="${t.title}" aria-label="${t.title}"
        class="grid h-9 min-w-9 flex-none place-items-center rounded-lg px-1.5 text-ink active:bg-surface-2 disabled:opacity-30 ${t.cmd === 'undo' ? 'ml-auto' : ''}">${t.html}</button>`)
        + (t.sep ? '<span class="mx-1 my-1.5 w-px flex-none bg-line"></span>' : '')).join('')}
    </div>
    <div data-block-menu role="menu" class="absolute z-10 w-56 rounded-2xl bg-surface-2 p-1.5 shadow-2xl shadow-black/60 ring-1 ring-line" hidden>
      ${BLOCKS.map(b => `<button type="button" role="menuitemradio" data-block="${b.id}" aria-checked="false"
        class="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left active:bg-surface aria-checked:bg-surface">
        <span class="flex-1 ${b.preview}">${b.label}</span>
        <svg viewBox="0 0 24 24" class="check size-4! text-accent"><path d="M20 6 9 17l-5-5"/></svg></button>`).join('')}
    </div>
    <div data-editor class="notes-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"></div>`;
  // Toolbar: mousedown voorkomen zodat de cursor in de tekst blijft staan
  wrapper.firstElementChild.addEventListener('mousedown', (e) => e.preventDefault());
  const menu = wrapper.querySelector('[data-block-menu]');
  const menuBtn = wrapper.querySelector('[data-cmd="block"]');
  const closeMenu = () => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); };
  const openMenu = () => {
    // Onder de knop, binnen de breedte van het scherm (de knoppenbalk kan horizontaal gescrold zijn)
    const r = menuBtn.getBoundingClientRect(), w = wrapper.getBoundingClientRect();
    menu.style.top = `${r.bottom - w.top + 6}px`;
    menu.style.left = `${Math.max(8, Math.min(r.left - w.left, w.width - 224 - 8))}px`;
    menu.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
  };
  wrapper.firstElementChild.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]');
    if (!b || !editor) return;
    if (b.dataset.cmd === 'block') { menu.hidden ? openMenu() : closeMenu(); return; }
    closeMenu();
    TOOLS.find(t => t.cmd === b.dataset.cmd).run(editor.chain().focus()).run();
  });
  menu.addEventListener('mousedown', (e) => e.preventDefault()); // selectie in de tekst behouden
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-block]');
    if (!b || !editor) return;
    BLOCKS.find(x => x.id === b.dataset.block).run(editor.chain().focus()).run();
    closeMenu();
  });
  // Buiten het menu tikken, scrollen in de balk of Esc: dicht
  wrapper.addEventListener('pointerdown', (e) => { if (!menu.hidden && !e.target.closest('[data-block-menu], [data-cmd="block"]')) closeMenu(); });
  wrapper.firstElementChild.addEventListener('scroll', closeMenu, { passive: true });
  wrapper.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { e.stopPropagation(); closeMenu(); } });
  mount.replaceWith(wrapper);

  gameId = id;
  editor = new Editor({
    element: wrapper.querySelector('[data-editor]'),
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, code: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Voortgang, tips, waar je gebleven bent… Gebruik het afvinklijstje voor je doelen.' }),
    ],
    content: toHTML(notes),
    editorProps: { attributes: { class: 'notes-editor notes-big', spellcheck: 'true' } },
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? '' : ed.getHTML()),
    onTransaction: updateToolbar,
  });
  updateToolbar();
  if (focus) editor.commands.focus('end');
}

// Alleen-lezen weergave (voorbeeld op de info-pagina): opgeslagen HTML opschonen
const ALLOWED = new Set(['P', 'BR', 'H1', 'H2', 'H3', 'STRONG', 'B', 'EM', 'I', 'S', 'UL', 'OL', 'LI', 'LABEL', 'INPUT', 'SPAN', 'DIV', 'BLOCKQUOTE', 'HR']);
const ATTRS = new Set(['data-type', 'data-checked', 'type', 'checked', 'tabindex']);
export function notesPreviewHTML(notes) {
  const doc = new DOMParser().parseFromString(`<div>${toHTML(notes)}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  for (const el of [...root.querySelectorAll('*')]) {
    if (!ALLOWED.has(el.tagName)) { el.replaceWith(...(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT'].includes(el.tagName) ? [] : el.childNodes)); continue; }
    for (const a of [...el.attributes]) if (!ATTRS.has(a.name)) el.removeAttribute(a.name);
    if (el.tagName === 'INPUT') el.setAttribute('tabindex', '-1');
    if (el.tagName === 'INPUT' && el.type !== 'checkbox') el.remove(); // voorbeeld zelf is niet klikbaar (pointer-events-none)
  }
  return root.innerHTML;
}

export function destroyNotes() {
  editor?.destroy();
  editor = null; gameId = null; wrapper = null; hadFocus = false;
}
