import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowDown, ArrowUp, Check, ChevronDown, Code2, FileText, Heading1,
    Link2, Loader2, Pencil, Plus, Trash2, TriangleAlert, Video,
} from 'lucide-react';
import api from '../../services/api';
import Dropdown from '../ui/Dropdown';

/**
 * Inline editor for AI-generated lesson blocks, shown live in the generation
 * studio — with the same builder powers as the Lesson Editor: add blocks
 * (heading / text / code / video / link), reorder, delete, per-block editing,
 * code language selection and per-case challenge test cases.
 *
 * Once a lesson has `generated: true` its blocks are persisted on the server,
 * so every change autosaves through PUT /teacher/lessons/{id} with the full
 * content array — the same endpoint the Lesson Editor uses.
 *
 * Non-generated lessons (still streaming section previews) stay read-only:
 * their blocks are transient and get replaced when lesson_complete arrives.
 */

const CODE_LANGS = [
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'cpp', label: 'C++' },
    { value: 'html', label: 'HTML / CSS / JS' },
];

// Autosave hook: saves `payload` via `saveFn` after `delay` ms of inactivity.
// Returns [status, schedule, flushNow] where status is idle|saving|saved|error.
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
            style={{ color: 'var(--db-text)', minHeight: 28 }}
            onFocus={(e) => { e.currentTarget.style.background = 'var(--db-card-2)'; }}
            onBlurCapture={(e) => { e.currentTarget.style.background = 'transparent'; }}
        />
    );
}

/** Per-block builder tools: move up / move down / delete (two-step). */
function BlockTools({ onUp, onDown, onDelete, first, last }) {
    const [confirming, setConfirming] = useState(false);
    const btn = "grid place-items-center w-7 h-7 rounded-lg border border-transparent bg-transparent color-inherit cursor-pointer";
    return (
        <div
            className="group-hover/tools:flex hidden items-center gap-1"
            style={{ position: 'absolute', top: -13, right: 0, zIndex: 12, padding: 3, borderRadius: 9, background: 'var(--db-card)', border: '1px solid var(--db-border)', boxShadow: 'var(--db-shadow-soft)' }}
            onMouseLeave={() => setConfirming(false)}
        >
            <button type="button" title="Move up" className={btn} style={{ opacity: first ? 0.35 : 1 }} onClick={onUp}><ArrowUp size={13} /></button>
            <button type="button" title="Move down" className={btn} style={{ opacity: last ? 0.35 : 1 }} onClick={onDown}><ArrowDown size={13} /></button>
            {confirming ? (
                <button
                    type="button"
                    title="Click again to delete"
                    className={btn}
                    style={{ background: 'var(--db-danger)', color: '#fff', borderRadius: 7 }}
                    onClick={onDelete}
                >
                    <Check size={13} />
                </button>
            ) : (
                <button type="button" title="Delete block" className={btn} style={{ color: 'var(--db-text-3)' }} onClick={() => setConfirming(true)}>
                    <Trash2 size={13} />
                </button>
            )}
        </div>
    );
}

/** Challenge test cases (lesson side): rows of stdin → expected stdout,
 *  stored in the block's data — graded client-side by the student IDE. */
function ChallengeCases({ cases, onChange }) {
    const list = cases || [];
    const update = (i, patch) => onChange(list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
    const remove = (i) => onChange(list.filter((_, j) => j !== i));
    const add = () => onChange([...list, { id: crypto.randomUUID(), input: '', expected_output: '' }]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            <div className="gen-label" style={{ marginBottom: 0 }}>
                Test cases — the program must pass every one
            </div>
            {list.map((c, i) => (
                <div key={c.id || i} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--db-card)', border: '1px solid var(--db-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="gen-label" style={{ marginBottom: 0 }}>Case {i + 1}</span>
                        <span style={{ flex: 1 }} />
                        <button type="button" title="Remove case" className="gen-close" style={{ width: 26, height: 26 }} onClick={() => remove(i)}>
                            <Trash2 size={13} />
                        </button>
                    </div>
                    <div className="gen-2col">
                        <div>
                            <span className="gen-label">Input (stdin)</span>
                            <textarea
                                value={c.input || ''}
                                onChange={(e) => update(i, { input: e.target.value })}
                                rows={2}
                                spellCheck={false}
                                className="gen-input"
                                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }}
                            />
                        </div>
                        <div>
                            <span className="gen-label">Expected output</span>
                            <textarea
                                value={c.expected_output || ''}
                                onChange={(e) => update(i, { expected_output: e.target.value })}
                                rows={2}
                                spellCheck={false}
                                className="gen-input"
                                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: 'var(--db-green)' }}
                            />
                        </div>
                    </div>
                </div>
            ))}
            <button type="button" className="gen-btn gen-btn-ghost" style={{ padding: '7px 12px', alignSelf: 'flex-start' }} onClick={add}>
                <Plus size={12} /> Add case
            </button>
        </div>
    );
}

export default function EditableLessonContent({ lesson, onBlocksChange, courseLanguage }) {
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
        commitBlocks(blocks.map((b, i) => (i === idx ? { ...b, data: { ...b.data, ...patch } } : b)));
    };

    const moveBlock = (idx, dir) => {
        const to = idx + dir;
        if (to < 0 || to >= blocks.length) return;
        const next = [...blocks];
        [next[idx], next[to]] = [next[to], next[idx]];
        commitBlocks(next);
    };

    const removeBlock = (idx) => commitBlocks(blocks.filter((_, i) => i !== idx));

    const addBlock = (type, atIdx = blocks.length) => {
        const id = crypto.randomUUID();
        const defaults = {
            heading: { type: 'h1', data: { text: 'New heading' } },
            text: { type: 'text', data: { text: '<p></p>' } },
            code: { type: 'code', data: { mode: 'playground', language: courseLanguage || 'python', code: '', expected: '' } },
            video: { type: 'video', data: { url: '', title: '' } },
            link: { type: 'link', data: { url: '', title: '' } },
        }[type];
        if (!defaults) return;
        const next = [...blocks];
        next.splice(atIdx, 0, { id, ...defaults });
        commitBlocks(next);
        setEditingIdx(atIdx);
    };

    if (!blocks.length) return null;

    const addOptions = [
        { type: 'heading', label: 'Heading', icon: <Heading1 size={13} /> },
        { type: 'text', label: 'Text', icon: <FileText size={13} /> },
        { type: 'code', label: 'Code', icon: <Code2 size={13} /> },
        { type: 'video', label: 'Video', icon: <Video size={13} /> },
        { type: 'link', label: 'Link', icon: <Link2 size={13} /> },
    ];

    return (
        <div>
            {editable && (
                <div style={{ marginBottom: 12, gap: 10, flexWrap: 'wrap' }} className="flex items-center">
                    <span className="gen-note">
                        Live editing — changes save to this lesson automatically
                    </span>
                    <SaveChip status={saveStatus} />
                </div>
            )}

            {editable && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: '10px 12px', borderRadius: 12, background: 'var(--db-card-2)', border: '1px solid var(--db-border)' }}>
                    <span className="gen-label" style={{ marginBottom: 0, alignSelf: 'center', marginRight: 2 }}>Add block</span>
                    {addOptions.map(opt => (
                        <button
                            key={opt.type}
                            type="button"
                            className="gen-check"
                            style={{ padding: '6px 11px' }}
                            onClick={() => addBlock(opt.type)}
                        >
                            {opt.icon} {opt.label}
                        </button>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, color: 'var(--db-text)', fontSize: 15.5, lineHeight: 1.65 }}>
                {blocks.map((block, idx) => {
                    const isEditing = editingIdx === idx;
                    const type = block.type;
                    const data = block.data || {};

                    const tools = editable && (
                        <div
                            className="group-hover/tools:flex hidden items-center gap-1"
                            style={{ position: 'absolute', top: -13, right: 0, zIndex: 12, padding: 3, borderRadius: 9, background: 'var(--db-card)', border: '1px solid var(--db-border)', boxShadow: 'var(--db-shadow-soft)' }}
                            onMouseLeave={() => { }}
                        >
                            <ToolBtn title="Move up" disabled={idx === 0} onClick={() => moveBlock(idx, -1)}><ArrowUp size={13} /></ToolBtn>
                            <ToolBtn title="Move down" disabled={idx === blocks.length - 1} onClick={() => moveBlock(idx, 1)}><ArrowDown size={13} /></ToolBtn>
                            <DeleteBtn onConfirm={() => removeBlock(idx)} />
                        </div>
                    );

                    const shell = (children, key, anim = true) => (
                        <motion.div
                            key={key}
                            initial={anim ? { opacity: 0, y: 15 } : false}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="group/tools relative"
                        >
                            {tools}
                            {children}
                        </motion.div>
                    );

                    if (type === 'text' || type === 'h1' || type === 'h2') {
                        if (isEditing && editable) {
                            return shell(
                                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--db-card-2)', border: '1px solid var(--db-accent-border)' }}>
                                    <div style={{ marginBottom: 8, gap: 8, color: 'var(--db-accent-bright)' }} className="flex items-center text-[11px] font-bold uppercase tracking-widest">
                                        Editing {type === 'h1' ? 'heading' : type} block <SaveChip status={saveStatus} />
                                    </div>
                                    <HtmlEditable
                                        html={data.text || ''}
                                        onCommit={(html) => { updateBlock(idx, { text: html }); }}
                                        className="max-w-none"
                                        style={{ minHeight: type === 'h1' ? 34 : 28 }}
                                    />
                                    <div style={{ marginTop: 10, gap: 8, display: 'flex', justifyContent: 'flex-end' }}>
                                        <button type="button" onClick={() => setEditingIdx(null)} className="gen-btn gen-btn-ghost" style={{ padding: '6px 14px' }}>
                                            Done
                                        </button>
                                    </div>
                                </div>,
                                `${idx}-edit`
                            );
                        }
                        return shell(
                            <div
                                onClick={() => editable && setEditingIdx(idx)}
                                style={{ cursor: editable ? 'text' : 'default' }}
                            >
                                {type === 'h1' ? (
                                    <h2
                                        style={{ color: 'var(--db-text)', fontFamily: 'var(--db-font-display)', fontSize: 22, fontWeight: 700, margin: 0 }}
                                        dangerouslySetInnerHTML={{ __html: data.text || '' }}
                                    />
                                ) : (
                                    <div style={{ color: 'var(--db-text-2)' }} className="max-w-none" dangerouslySetInnerHTML={{ __html: data.text || '' }} />
                                )}
                            </div>,
                            idx
                        );
                    }

                    if (type === 'code') {
                        const isChallenge = data.mode === 'challenge';
                        return shell(
                            <div>
                                {isEditing && editable ? (
                                    <div style={{ padding: 16, borderRadius: 12, background: 'var(--db-card-2)', border: '1px solid var(--db-accent-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <div style={{ gap: 10, color: 'var(--db-accent-bright)' }} className="flex items-center text-[11px] font-bold uppercase tracking-widest flex-wrap">
                                            Editing code block
                                            <SaveChip status={saveStatus} />
                                        </div>
                                        <div className="gen-2col">
                                            <div>
                                                <span className="gen-label">Language</span>
                                                <Dropdown
                                                    fullWidth
                                                    value={data.language || 'python'}
                                                    onChange={(v) => updateBlock(idx, { language: v })}
                                                    options={CODE_LANGS}
                                                />
                                            </div>
                                            <div>
                                                <span className="gen-label">Mode</span>
                                                <div className="gen-seg">
                                                    <button type="button" className={!isChallenge ? 'on' : ''} onClick={() => updateBlock(idx, { mode: 'playground' })}>Sandbox</button>
                                                    <button type="button" className={isChallenge ? 'on' : ''} onClick={() => updateBlock(idx, { mode: 'challenge' })}>Challenge</button>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="gen-label">Code</span>
                                            <textarea
                                                value={data.code || ''}
                                                onChange={(e) => updateBlock(idx, { code: e.target.value })}
                                                spellCheck={false}
                                                rows={Math.min(18, Math.max(5, (data.code || '').split('\n').length + 1))}
                                                className="gen-input"
                                                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, resize: 'vertical' }}
                                            />
                                        </div>
                                        {!isChallenge && (
                                            <div>
                                                <span className="gen-label">Expected output</span>
                                                <textarea
                                                    value={data.expected || ''}
                                                    onChange={(e) => updateBlock(idx, { expected: e.target.value })}
                                                    spellCheck={false}
                                                    rows={2}
                                                    className="gen-input"
                                                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--db-green)', resize: 'vertical' }}
                                                />
                                            </div>
                                        )}
                                        {isChallenge && (
                                            <ChallengeCases
                                                cases={data.test_cases}
                                                onChange={(next) => {
                                                    updateBlock(idx, {
                                                        test_cases: next,
                                                        expected: next[0]?.expected_output ?? '',
                                                    });
                                                }}
                                            />
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button type="button" onClick={() => setEditingIdx(null)} className="gen-btn gen-btn-ghost" style={{ padding: '6px 14px' }}>
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
                                                <span>· {isChallenge ? 'challenge' : 'sandbox'}</span>
                                            </div>
                                            <pre style={{ overflowX: 'auto', margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--db-text)' }}>
                                                <code>{data.code || ''}</code>
                                            </pre>
                                            {!isChallenge && data.expected ? (
                                                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--db-border)' }}>
                                                    <div className="gen-label" style={{ marginBottom: 4 }}>Expected output</div>
                                                    <pre style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--db-green)', whiteSpace: 'pre-wrap' }}>{data.expected}</pre>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                )}
                                {editable && isChallenge && !isEditing && (
                                    <button
                                        type="button"
                                        className="gen-btn gen-btn-ghost"
                                        style={{ padding: '6px 12px', margin: '8px 0 0' }}
                                        onClick={() => setEditingIdx(idx)}
                                    >
                                        <Pencil size={12} /> Edit code &amp; test cases
                                    </button>
                                )}
                            </div>,
                            idx
                        );
                    }

                    if (type === 'video' || type === 'link' || type === 'embed' || type === 'image') {
                        const urlKey = type === 'image' ? 'src' : (type === 'link' ? 'url' : (type === 'embed' ? 'url' : 'src'));
                        return shell(
                            <div>
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
                                        {(type === 'video' || type === 'link') && (
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
                            </div>,
                            idx
                        );
                    }

                    return null;
                })}
            </div>

            {editable && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                    <span className="gen-label" style={{ marginBottom: 0, alignSelf: 'center' }}>Add at the end:</span>
                    {addOptions.map(opt => (
                        <button
                            key={`end-${opt.type}`}
                            type="button"
                            className="gen-check"
                            style={{ padding: '5px 10px' }}
                            onClick={() => addBlock(opt.type)}
                        >
                            <Plus size={12} /> {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function ToolBtn({ title, disabled, onClick, children }) {
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onClick={onClick}
            className="grid place-items-center w-7 h-7 rounded-lg border border-transparent bg-transparent cursor-pointer"
            style={{ color: 'var(--db-text-3)', opacity: disabled ? 0.35 : 1 }}
        >
            {children}
        </button>
    );
}

function DeleteBtn({ onConfirm }) {
    const [confirming, setConfirming] = useState(false);
    if (confirming) {
        return (
            <button
                type="button"
                title="Click again to delete"
                onClick={onConfirm}
                className="grid place-items-center w-7 h-7 rounded-lg cursor-pointer"
                style={{ background: 'var(--db-danger)', color: '#fff' }}
            >
                <Check size={13} />
            </button>
        );
    }
    return (
        <button
            type="button"
            title="Delete block"
            onClick={() => setConfirming(true)}
            className="grid place-items-center w-7 h-7 rounded-lg border border-transparent bg-transparent cursor-pointer"
            style={{ color: 'var(--db-text-3)' }}
        >
            <Trash2 size={13} />
        </button>
    );
}
