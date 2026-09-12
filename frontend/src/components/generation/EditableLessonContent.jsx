import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, Pencil, TriangleAlert } from 'lucide-react';
import api from '../../services/api';

/**
 * Inline editor for AI-generated lesson blocks, shown live in the generation
 * console. Once a lesson has `generated: true` its blocks are persisted on the
 * server, so every edit here autosaves through PUT /teacher/lessons/{id} with
 * the full content array — the same endpoint the Lesson Editor uses.
 *
 * Non-generated lessons (still streaming section previews) stay read-only:
 * their blocks are transient and get replaced when lesson_complete arrives.
 */

// Autosave hook: saves `payload` via `saveFn` after `delay` ms of inactivity.
// Returns [status, flushNow] where status is idle|saving|saved|error.
function useAutosave(saveFn, delay = 900) {
  const [status, setStatus] = useState('idle');
  const timerRef = useRef(null);
  const latestRef = useRef(null);

  const flushNow = async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const payload = latestRef.current;
    if (payload === null) return;
    latestRef.current = null;
    setStatus('saving');
    try {
      await saveFn(payload);
      setStatus('saved');
      setTimeout(() => setStatus(s => (s === 'saved' ? 'idle' : s)), 1800);
    } catch {
      setStatus('error');
    }
  };

  const schedule = (payload) => {
    latestRef.current = payload;
    setStatus('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushNow, delay);
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return [status, schedule, flushNow];
}

function SaveChip({ status }) {
  if (status === 'saving') {
    return (
      <span style={{ gap: '6px' }} className="inline-flex items-center text-xs text-slate-400">
        <Loader2 size={13} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span style={{ gap: '6px' }} className="inline-flex items-center text-xs text-emerald-400">
        <Check size={13} /> Saved
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span style={{ gap: '6px' }} className="inline-flex items-center text-xs text-red-400">
        <TriangleAlert size={13} /> Save failed — retry by editing again
      </span>
    );
  }
  return null;
}

/** Rich-text block editor: contentEditable that preserves the stored HTML. */
function HtmlEditable({ html, onCommit, className }) {
  const ref = useRef(null);

  // Only sync from props when not focused — otherwise typing fights the cursor.
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = html || '';
    }
  }, [html]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={(e) => onCommit(e.currentTarget.innerHTML)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.currentTarget.blur(); }
        e.stopPropagation();
      }}
      className={`${className || ''} outline-none rounded-lg transition-colors focus:bg-slate-900/70 focus:ring-1 focus:ring-cyan-500/40 px-2 -mx-2 py-1 cursor-text`}
    />
  );
}

/** Block wrapper: hover pencil, edit/canvas modes. */
function BlockShell({ editable, editing, onToggleEdit, children, label }) {
  return (
    <div className="relative group/block">
      {children}
      {editable && (
        <button
          onClick={onToggleEdit}
          style={{ padding: '5px 10px', gap: '5px' }}
          className={`absolute top-2 right-2 z-10 inline-flex items-center rounded-md text-[11px] font-semibold border transition-all ${
            editing
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
              : 'opacity-0 group-hover/block:opacity-100 bg-slate-900/90 text-slate-400 border-slate-700 hover:text-cyan-300'
          }`}
        >
          <Pencil size={11} /> {editing ? 'Done' : (label || 'Edit')}
        </button>
      )}
    </div>
  );
}

export default function EditableLessonContent({ lesson, onBlocksChange }) {
  const editable = !!lesson.generated && typeof lesson.id === 'number';
  const blocks = lesson.blocks || [];
  const [editingIdx, setEditingIdx] = useState(null);

  const [saveStatus, scheduleSave] = useAutosave(async (content) => {
    await api.put(`/teacher/lessons/${lesson.id}`, { content });
  });

  const commitBlocks = (nextBlocks) => {
    onBlocksChange(lesson.id, nextBlocks);
    if (editable) scheduleSave(nextBlocks);
  };

  const updateBlock = (idx, patch) => {
    const next = blocks.map((b, i) => (i === idx ? { ...b, data: { ...b.data, ...patch } } : b));
    commitBlocks(next);
  };

  if (!blocks.length) return null;

  return (
    <div>
      {editable && (
        <div style={{ marginBottom: '12px', gap: '10px' }} className="flex items-center">
          <span className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">
            Live editing — changes save to this lesson automatically
          </span>
          <SaveChip status={saveStatus} />
        </div>
      )}

      <div style={{ gap: '22px' }} className="space-y-5 text-slate-300 text-base leading-relaxed">
        {blocks.map((block, idx) => {
          const isEditing = editingIdx === idx;
          const type = block.type;
          const data = block.data || {};

          if (type === 'text' || type === 'h1' || type === 'h2') {
            if (isEditing && editable) {
              return (
                <motion.div key={`${idx}-edit`} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}
                  style={{ padding: '14px 16px' }} className="bg-slate-900/70 border border-cyan-500/40 rounded-xl">
                  <div style={{ marginBottom: '8px', gap: '8px' }} className="flex items-center text-[11px] text-cyan-400 font-bold uppercase tracking-widest">
                    Editing {type} block <SaveChip status={saveStatus} />
                  </div>
                  <HtmlEditable
                    html={data.text || ''}
                    onCommit={(html) => { updateBlock(idx, { text: html }); }}
                    className="prose prose-invert max-w-none text-slate-200 min-h-[60px]"
                  />
                  <div style={{ marginTop: '10px', gap: '8px' }} className="flex justify-end">
                    <button
                      onClick={() => setEditingIdx(null)}
                      style={{ padding: '6px 14px' }}
                      className="rounded-md bg-cyan-500/20 text-cyan-300 text-xs font-semibold border border-cyan-500/40 hover:bg-cyan-500/30"
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              );
            }
            return (
              <motion.div key={idx} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <BlockShell
                  editable={editable}
                  editing={false}
                  onToggleEdit={() => editable && setEditingIdx(idx)}
                  label="Edit text"
                >
                  <div
                    className={`prose prose-invert max-w-none text-slate-300 ${type === 'h1' ? 'text-2xl font-bold text-white' : ''}`}
                    dangerouslySetInnerHTML={{ __html: data.text || '' }}
                  />
                </BlockShell>
              </motion.div>
            );
          }

          if (type === 'code') {
            return (
              <motion.div key={idx} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <BlockShell editable={editable} editing={isEditing} onToggleEdit={() => setEditingIdx(isEditing ? null : idx)} label="Edit code">
                  {isEditing && editable ? (
                    <div style={{ padding: '16px 18px', gap: '12px' }} className="bg-slate-900 border border-cyan-500/40 rounded-xl space-y-3">
                      <div style={{ gap: '10px', alignItems: 'center' }} className="flex text-[11px] font-bold uppercase tracking-widest text-cyan-400">
                        Editing code block
                        <span className="text-slate-500 normal-case font-medium">({data.language || 'java'}{data.mode === 'challenge' ? ' · challenge' : ' · playground'})</span>
                        <SaveChip status={saveStatus} />
                      </div>
                      <textarea
                        value={data.code || ''}
                        onChange={(e) => updateBlock(idx, { code: e.target.value })}
                        spellCheck={false}
                        rows={Math.min(18, Math.max(5, (data.code || '').split('\n').length + 1))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-sm text-cyan-200 outline-none focus:border-cyan-500/60 resize-y"
                      />
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500" style={{ marginBottom: '4px' }}>
                          Expected output {data.mode === 'challenge' ? '(challenge target)' : ''}
                        </div>
                        <textarea
                          value={data.expected || ''}
                          onChange={(e) => updateBlock(idx, { expected: e.target.value })}
                          spellCheck={false}
                          rows={2}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-sm text-emerald-300 outline-none focus:border-cyan-500/60 resize-y"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => setEditingIdx(null)}
                          style={{ padding: '6px 14px' }}
                          className="rounded-md bg-cyan-500/20 text-cyan-300 text-xs font-semibold border border-cyan-500/40 hover:bg-cyan-500/30"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg overflow-hidden">
                      <div style={{ padding: '16px 20px' }} className="bg-slate-900 border border-slate-800 rounded-lg">
                        <div style={{ marginBottom: '8px', gap: '8px' }} className="flex items-center text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                          <span className={(data.language || 'java') === 'html' ? 'text-orange-400' : 'text-amber-400'}>
                            {data.language || 'java'}
                          </span>
                          <span>· {data.mode || 'playground'}</span>
                        </div>
                        <pre className="overflow-x-auto text-sm font-mono">
                          <code className="text-cyan-300">{data.code || ''}</code>
                        </pre>
                        {data.expected ? (
                          <div style={{ marginTop: '10px', paddingTop: '10px' }} className="border-t border-slate-800">
                            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold" style={{ marginBottom: '4px' }}>Expected output</div>
                            <pre className="text-sm font-mono text-emerald-300 whitespace-pre-wrap">{data.expected}</pre>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </BlockShell>
              </motion.div>
            );
          }

          if (type === 'video' || type === 'link' || type === 'embed' || type === 'image') {
            const urlKey = type === 'image' ? 'src' : (type === 'link' ? 'url' : (type === 'embed' ? 'url' : 'src'));
            return (
              <motion.div key={idx} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <BlockShell editable={editable} editing={isEditing} onToggleEdit={() => setEditingIdx(isEditing ? null : idx)} label="Edit">
                  {isEditing && editable ? (
                    <div style={{ padding: '14px 16px', gap: '10px' }} className="bg-slate-900 border border-cyan-500/40 rounded-xl space-y-2">
                      <div style={{ gap: '8px' }} className="flex items-center text-[11px] text-cyan-400 font-bold uppercase tracking-widest">
                        Editing {type} <SaveChip status={saveStatus} />
                      </div>
                      <input
                        value={data[urlKey] || ''}
                        onChange={(e) => updateBlock(idx, { [urlKey]: e.target.value })}
                        placeholder="URL…"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/60"
                      />
                      {type === 'video' && (
                        <input
                          value={data.title || ''}
                          onChange={(e) => updateBlock(idx, { title: e.target.value })}
                          placeholder="Title…"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/60"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-3">
                      {type === 'video' ? (
                        <>🎬 <span className="text-slate-300">{data.title || 'Video'}</span> — <span className="font-mono text-xs">{data.url || data.src || ''}</span></>
                      ) : type === 'link' ? (
                        <>🔗 <span className="text-slate-300">{data.title || 'Resource'}</span> — <span className="font-mono text-xs">{data.url || ''}</span></>
                      ) : type === 'image' ? (
                        data.src ? <img src={data.src} alt={data.alt || 'lesson'} className="rounded-lg max-h-96 w-auto" /> : null
                      ) : (
                        <>Embedded content — <span className="font-mono text-xs">{data.url || ''}</span></>
                      )}
                    </div>
                  )}
                </BlockShell>
              </motion.div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
