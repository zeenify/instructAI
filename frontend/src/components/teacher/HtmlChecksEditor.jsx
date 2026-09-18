import { useRef, useState } from 'react';
import { CheckCircle2, XCircle, FlaskConical, Loader2, Play, Trash2 } from 'lucide-react';
import {
    CHECK_KINDS,
    htmlCheckLabel,
    injectPreviewBridge,
    newHtmlCheck,
} from '../../utils/codeLanguages';

// let checksFailHarmlessly = true -> placeholder to keep lint quiet when unused
/**
 * Builder for the structured page checks attached to an HTML/CSS/JS question
 * or lesson challenge block. Checks are stored as plain JSON; the student's
 * sandboxed preview grades them in-browser (see buildPreviewBridge).
 *
 * props:
 *  - checks: array (controlled)
 *  - onChange(nextChecks)
 *  - referenceHtml: composed page used by "Test page checks" (optional)
 *  - onReferenceChange(text): persist the teacher's reference page (optional)
 *  - title / accent: presentation
 */
export default function HtmlChecksEditor({
    checks = [],
    onChange,
    referenceHtml = '',
    onReferenceChange,
    title = 'Page Checks',
    accent = '#8b5cf6',
}) {
    const [testState, setTestState] = useState(null); // null | 'running' | results array
    const [reference, setReference] = useState(referenceHtml || '');
    const [savedReference, setSavedReference] = useState(referenceHtml || '');
    const [lastPropReference, setLastPropReference] = useState(referenceHtml || '');
    const frameRef = useRef(null);

    // Reset the editor whenever the parent supplies a different reference page
    // (the sanctioned "adjust state when a prop changes" render-time reset).
    if ((referenceHtml || '') !== lastPropReference) {
        setLastPropReference(referenceHtml || '');
        setReference(referenceHtml || '');
        setSavedReference(referenceHtml || '');
    }

    const update = (index, patch) => {
        onChange(checks.map((c, i) => (i === index ? { ...c, ...patch } : c)));
    };

    const remove = (index) => {
        onChange(checks.filter((_, i) => i !== index));
    };

    const runTests = () => {
        if (checks.length === 0 || !reference.trim() || testState === 'running') return;
        setTestState('running');

        // Clean up any previous test frame
        if (frameRef.current) {
            frameRef.current.remove();
            frameRef.current = null;
        }

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1024px;height:768px;';
        iframe.sandbox = 'allow-scripts allow-forms allow-modals allow-popups';
        frameRef.current = iframe;

        let settled = false;
        const cleanup = () => {
            window.removeEventListener('message', handler);
            iframe.remove();
            if (frameRef.current === iframe) frameRef.current = null;
        };
        const handler = (event) => {
            if (!event.data || !event.data.__instructai_preview || event.data.type !== 'check-results') return;
            settled = true;
            setTestState(event.data.results || []);
            cleanup();
        };
        window.addEventListener('message', handler);
        document.body.appendChild(iframe);
        iframe.srcdoc = injectPreviewBridge(reference, checks);

        setTimeout(() => {
            if (!settled) {
                setTestState((prev) => (Array.isArray(prev) ? prev : []));
                cleanup();
            }
        }, 6000);
    };

    return (
        <div
            className="rounded-2xl border p-4 flex flex-col gap-3"
            style={{ borderColor: `${accent}33`, background: `${accent}0a` }}
        >
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.2em]" style={{ color: accent }}>
                    <FlaskConical size={14} /> {title}
                </div>
                {checks.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-400">
                        {checks.length} check{checks.length !== 1 ? 's' : ''} · all must pass
                    </span>
                )}
            </div>

            <p className="text-[10px] text-slate-500 font-medium" style={{ margin: 0 }}>
                Checks run in the student's browser against the page they build —
                the parts on it, the words in it, and the colors and sizes of things.
                Every check must pass to complete the challenge.
            </p>

            {checks.map((check, index) => (
                <div key={check.id || index} className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <select
                            value={check.kind}
                            onChange={(e) => update(index, { ...newHtmlCheck(e.target.value), id: check.id })}
                            className="bg-black/40 border border-white/10 rounded-lg text-[11px] font-bold px-2 py-1.5 text-white/90 outline-none"
                        >
                            {CHECK_KINDS.map((k) => (
                                <option key={k.id} value={k.id}>{k.label}</option>
                            ))}
                        </select>
                        <div className="flex-1" />
                        <button
                            type="button"
                            onClick={() => remove(index)}
                            className="text-rose-400/80 hover:text-rose-300 p-1"
                            title="Remove check"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        {needsField(check.kind, 'selector') && (
                            <input
                                value={check.selector || ''}
                                onChange={(e) => update(index, { selector: e.target.value })}
                                placeholder="CSS selector (e.g. #title, ul li)"
                                className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/90 outline-none w-52"
                            />
                        )}
                        {needsField(check.kind, 'count') && (
                            <input
                                type="number"
                                min="1"
                                value={check.count ?? 1}
                                onChange={(e) => update(index, { count: Number(e.target.value) || 1 })}
                                className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/90 outline-none w-16"
                                title="Minimum count"
                            />
                        )}
                        {needsField(check.kind, 'attribute') && (
                            <input
                                value={check.attribute || ''}
                                onChange={(e) => update(index, { attribute: e.target.value })}
                                placeholder="attribute (href)"
                                className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/90 outline-none w-32"
                            />
                        )}
                        {needsField(check.kind, 'property') && (
                            <input
                                value={check.property || ''}
                                onChange={(e) => update(index, { property: e.target.value })}
                                placeholder="CSS property (color)"
                                className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/90 outline-none w-32"
                            />
                        )}
                        {needsField(check.kind, 'match') && (
                            <select
                                value={check.match || 'contains'}
                                onChange={(e) => update(index, { match: e.target.value })}
                                className="bg-black/40 border border-white/10 rounded-lg text-[11px] font-bold px-2 py-1.5 text-white/90 outline-none"
                            >
                                <option value="contains">contains</option>
                                <option value="equals">equals</option>
                            </select>
                        )}
                        {needsField(check.kind, 'text') && (
                            <input
                                value={check.text || ''}
                                onChange={(e) => update(index, { text: e.target.value })}
                                placeholder="expected text"
                                className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/90 outline-none flex-1 min-w-40"
                            />
                        )}
                        {needsField(check.kind, 'value') && (
                            <input
                                value={check.value || ''}
                                onChange={(e) => update(index, { value: e.target.value })}
                                placeholder={check.kind === 'style' ? 'expected value (e.g. red)' : 'expected value'}
                                className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/90 outline-none flex-1 min-w-40"
                            />
                        )}
                    </div>

                    <div className="text-[10px] text-slate-500 font-medium">{htmlCheckLabel(check)}</div>
                </div>
            ))}

            <div className="flex items-center gap-2 flex-wrap">
                <select
                    value=""
                    onChange={(e) => { if (e.target.value) onChange([...checks, newHtmlCheck(e.target.value)]); }}
                    className="bg-black/40 border border-white/10 rounded-lg text-[11px] font-bold px-2 py-1.5 text-white/80 outline-none"
                >
                    <option value="">+ Add check…</option>
                    {CHECK_KINDS.map((k) => (
                        <option key={k.id} value={k.id}>{k.label}</option>
                    ))}
                </select>

                {onReferenceChange && (
                    <button
                        type="button"
                        onClick={() => { onReferenceChange(reference); setSavedReference(reference); }}
                        disabled={reference === savedReference}
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded-lg border border-white/10 text-slate-300 disabled:opacity-40"
                        title="Save this page as your reference solution"
                    >
                        Save Reference Page
                    </button>
                )}

                <button
                    type="button"
                    onClick={runTests}
                    disabled={checks.length === 0 || !reference.trim() || testState === 'running'}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
                    style={{ background: accent }}
                    title={reference.trim() ? 'Run the checks against the reference page' : 'Add a reference page first'}
                >
                    {testState === 'running' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    Test page checks
                </button>
                {checks.length === 0 && (
                    <span className="text-[10px] font-medium" style={{ color: 'var(--db-text-3)' }}>
                        Add a check first, then test.
                    </span>
                )}
            </div>

            {onReferenceChange && (
                <textarea
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Your reference page (full HTML) — used by “Test page checks”, not shown to students."
                    className="bg-black/40 border border-white/10 rounded-xl p-2 font-mono text-[11px] text-white/80 outline-none min-h-20"
                />
            )}

            {Array.isArray(testState) && (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 flex flex-col gap-1.5">
                    <div className={`text-[10px] font-black uppercase tracking-wider ${testState.every((r) => r.passed) ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {testState.filter((r) => r.passed).length}/{testState.length} checks pass on the reference page
                    </div>
                    {testState.map((r, i) => (
                        <div key={r.id || i} className="flex items-center gap-2 text-[11px]">
                            {r.passed ? <CheckCircle2 size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-rose-400" />}
                            <span className={r.passed ? 'text-white/80' : 'text-white/60'}>
                                {r.label || htmlCheckLabel(checks[i] || {})}
                            </span>
                            {!r.passed && r.detail && <span className="text-rose-300/80 text-[10px]">— {r.detail}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function needsField(kind, field) {
    const def = CHECK_KINDS.find((k) => k.id === kind);
    return def ? def.needs.includes(field) : false;
}
