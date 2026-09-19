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
      <span style={{ gap: 6, color: 'var(--db-text-3)' }} className="inline-flex items-center text-xs">
        <Loader2 size={13} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span style={{ gap: 6, color: 'var(--db-green)' }} className="inline-flex items-center text-xs">
        <Check size={13} /> Saved
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span style={{ gap: 6, color: 'var(--db-danger)' }} className="inline-flex items-center text-xs">
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
      className={`${className || ''} outline-none rounded-lg transition-colors px-2 -mx-2 py-1 cursor-text`}
      style={{ color: 'var(--db-text)' }}
      onFocus={(e) => { e.currentTarget.style.background = 'var(--db-card-2)'; }}
      onBlurCapture={(e) => { e.currentTarget.style.background = 'transparent'; }}
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
          style={{
            padding: '4px 10px',
            gap: 5,
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            border: `1px solid ${editing ? 'var(--db-accent-border)' : 'var(--db-border-strong)'}`,
            background: editing ? 'var(--db-accent-soft)' : 'var(--db-card)',
            color: editing ? 'var(--db-accent-bright)' : 'var(--db-text-2)',
          }}
          className={`absolute top-2 right-2 z-10 inline-flex items-center transition-all ${editing ? '' : 'opacity-0 group-hover/block:opacity-100'}`}
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
        <div style={{ marginBottom: 12, gap: 10 }} className="flex items-center">
          <span className="gen-note">
            Live editing — changes save to this lesson automatically
          </span>
          <SaveChip status={saveStatus} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, color: 'var(--db-text)', fontSize: 15.5, lineHeight: 1.65 }}>
        {blocks.map((block, idx) => {
          const isEditing = editingIdx === idx;
          const type = block.type;
          const data = block.data || {};

          if (type === 'text' || type === 'h1' || type === 'h2') {
            if (isEditing && editable) {
              return (
                <motion.div key={`${idx}-edit`} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}
                  style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--db-card-2)', border: '1px solid var(--db-accent-border)' }}>
                  <div style={{ marginBottom: 8, gap: 8, color: 'var(--db-accent-bright)' }} className="flex items-center text-[11px] font-bold uppercase tracking-widest">
                    Editing {type} block <SaveChip status={saveStatus} />
                  </div>
                  <HtmlEditable
                    html={data.text || ''}
                    onCommit={(html) => { updateBlock(idx, { text: html }); }}
                    className="max-w-none min-h-[60px]"
                  />
                  <div style={{ marginTop: 10, gap: 8, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setEditingIdx(null)}
                      className="gen-btn gen-btn-ghost"
                      style={{ padding: '6px 14px' }}
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
                  {type === 'h1' ? (
                    <h2
                      style={{ color: 'var(--db-text)', fontFamily: 'var(--db-font-display)', fontSize: 22, fontWeight: 700, margin: 0 }}
                      dangerouslySetInnerHTML={{ __html: data.text || '' }}
                    />
                  ) : (
                    <div
                      style={{ color: 'var(--db-text-2)' }}
                      className="max-w-none"
                      dangerouslySetInnerHTML={{ __html: data.text || '' }}
                    />
                  )}
                </BlockShell>
              </motion.div>
            );
          }

          if (type === 'code') {
            return (
              <motion.div key={idx} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <BlockShell editable={editable} editing={isEditing} onToggleEdit={() => setEditingIdx(isEditing ? null : idx)} label="Edit code">
                  {isEditing && editable ? (
                    <div style={{ padding: 16, borderRadius: 12, background: 'var(--db-card-2)', border: '1px solid var(--db-accent-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ gap: 10, color: 'var(--db-accent-bright)' }} className="flex items-center text-[11px] font-bold uppercase tracking-widest">
                        Editing code block
                        <span style={{ color: 'var(--db-text-3)', textTransform: 'none', fontWeight: 500 }}>
                          ({data.language || 'java'}{data.mode === 'challenge' ? ' · challenge' : ' · playground'})
                        </span>
                        <SaveChip status={saveStatus} />
                      </div>
                      <textarea
                        value={data.code || ''}
                        onChange={(e) => updateBlock(idx, { code: e.target.value })}
                        spellCheck={false}
                        rows={Math.min(18, Math.max(5, (data.code || '').split('\n').length + 1))}
                        style={{
                          width: '100%', borderRadius: 10, border: '1px solid var(--db-border-strong)',
                          background: 'var(--db-card)', color: 'var(--db-text)',
                          padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
                          outline: 'none', resize: 'vertical',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = 'var(--db-accent)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'var(--db-border-strong)'; }}
                      />
                      <div>
                        <div className="gen-label">
                          Expected output {data.mode === 'challenge' ? '(challenge target)' : ''}
                        </div>
                        <textarea
                          value={data.expected || ''}
                          onChange={(e) => updateBlock(idx, { expected: e.target.value })}
                          spellCheck={false}
                          rows={2}
                          style={{
                            width: '100%', borderRadius: 10, border: '1px solid var(--db-border-strong)',
                            background: 'var(--db-card)', color: 'var(--db-green)',
                            padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
                            outline: 'none', resize: 'vertical',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditingIdx(null)}
                          className="gen-btn gen-btn-ghost"
                          style={{ padding: '6px 14px' }}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--db-border)' }}>
                      <div style={{ padding: '14px 18px', background: 'var(--db-card-2)' }}>
                        <div className="gen-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ color: data.language === 'html' ? 'var(--db-amber)' : 'var(--db-accent-bright)' }}>
                            {data.language || 'java'}
                          </span>
                          <span>· {data.mode || 'playground'}</span>
                        </div>
                        <pre style={{ overflowX: 'auto', margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--db-text)' }}>
                          <code>{data.code || ''}</code>
                        </pre>
                        {data.expected ? (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--db-border)' }}>
                            <div className="gen-label" style={{ marginBottom: 4 }}>Expected output</div>
                            <pre style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--db-green)', whiteSpace: 'pre-wrap' }}>{data.expected}</pre>
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
                    <div style={{ padding: 14, borderRadius: 12, background: 'var(--db-card-2)', border: '1px solid var(--db-accent-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ gap: 8, color: 'var(--db-accent-bright)' }} className="flex items-center text-[11px] font-bold uppercase tracking-widest">
                        Editing {type} <SaveChip status={saveStatus} />
                      </div>
                      <input
                        value={data[urlKey] || ''}
                        onChange={(e) => updateBlock(idx, { [urlKey]: e.target.value })}
                        placeholder="URL…"
                        className="gen-input"
                      />
                      {type === 'video' && (
                        <input
                          value={data.title || ''}
                          onChange={(e) => updateBlock(idx, { title: e.target.value })}
                          placeholder="Title…"
                          className="gen-input"
                        />
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--db-card-2)', border: '1px solid var(--db-border)', color: 'var(--db-text-2)', fontSize: 14 }}>
                      {type === 'video' ? (
                        <><strong style={{ color: 'var(--db-text)' }}>{data.title || 'Video'}</strong> — <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{data.url || data.src || ''}</span></>
                      ) : type === 'link' ? (
                        <><strong style={{ color: 'var(--db-text)' }}>{data.title || 'Resource'}</strong> — <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{data.url || ''}</span></>
                      ) : type === 'image' ? (
                        data.src ? <img src={data.src} alt={data.alt || 'lesson'} style={{ borderRadius: 10, maxHeight: 380, width: 'auto' }} /> : null
                      ) : (
                        <>Embedded content — <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{data.url || ''}</span></>
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
