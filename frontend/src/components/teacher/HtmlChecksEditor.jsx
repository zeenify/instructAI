import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, FlaskConical, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import Dropdown from '../ui/Dropdown';
import {
    CHECK_KINDS,
    htmlCheckLabel,
    injectPreviewBridge,
    newHtmlCheck,
} from '../../utils/codeLanguages';
import './HtmlChecksEditor.css';

/**
 * A thin wrapper over the shared ui/Dropdown with the check-kind options.
 * `plus` renders the dashed "add a check…" affordance.
 */
function HcDropdown({ value, options, onChange, plus = false }) {
    // Thin wrapper over the shared Dropdown — keeps the "add a check" dashed
    // affordance while the open/close/active-item behavior lives in one place
    return (
        <Dropdown
            value={value}
            options={options}
            onChange={onChange}
            dashed={plus}
            icon={plus ? <Plus size={13} /> : null}
            placeholder={plus ? 'Add a check…' : 'Choose…'}
            className={plus ? 'hc-dd-plus' : ''}
        />
    );
}

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
        <div className="hc-box">
            <div className="hc-head">
                <span className="hc-title">
                    <FlaskConical size={14} /> {title}
                </span>
                {checks.length > 0 && (
                    <span className="hc-count">
                        {checks.length} check{checks.length !== 1 ? 's' : ''} · all must pass
                    </span>
                )}
            </div>

            <p className="hc-desc">
                Checks run in the student's browser against the page they build —
                the parts on it, the words in it, and the colors and sizes of things.
                Every check must pass to complete the challenge.
            </p>

            {checks.map((check, index) => (
                <div key={check.id || index} className="hc-row">
                    <div className="hc-row-top">
                    <HcDropdown
                        value={check.kind}
                        options={CHECK_KINDS.map((k) => ({ value: k.id, label: k.label }))}
                        onChange={(v) => update(index, { ...newHtmlCheck(v), id: check.id })}
                    />
                    <div className="hc-row-spacer" />
                    <button
                        type="button"
                        onClick={() => remove(index)}
                        className="hc-remove"
                        title="Remove this check"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>

                    <div className="hc-fields">
                        {needsField(check.kind, 'selector') && (
                            <input
                                value={check.selector || ''}
                                onChange={(e) => update(index, { selector: e.target.value })}
                                placeholder="CSS selector (e.g. #title, ul li)"
                                className="hc-input w-52"
                            />
                        )}
                        {needsField(check.kind, 'count') && (
                            <input
                                type="number"
                                min="1"
                                value={check.count ?? 1}
                                onChange={(e) => update(index, { count: Number(e.target.value) || 1 })}
                                className="hc-input w-16"
                                title="Minimum count"
                            />
                        )}
                        {needsField(check.kind, 'attribute') && (
                            <input
                                value={check.attribute || ''}
                                onChange={(e) => update(index, { attribute: e.target.value })}
                                placeholder="attribute (href)"
                                className="hc-input w-32"
                            />
                        )}
                        {needsField(check.kind, 'property') && (
                            <input
                                value={check.property || ''}
                                onChange={(e) => update(index, { property: e.target.value })}
                                placeholder="CSS property (color)"
                                className="hc-input w-32"
                            />
                        )}
                        {needsField(check.kind, 'match') && (
                            <HcDropdown
                                value={check.match || 'contains'}
                                options={[{ value: 'contains', label: 'contains' }, { value: 'equals', label: 'is exactly' }]}
                                onChange={(v) => update(index, { match: v })}
                            />
                        )}
                        {needsField(check.kind, 'text') && (
                            <input
                                value={check.text || ''}
                                onChange={(e) => update(index, { text: e.target.value })}
                                placeholder="expected text"
                                className="hc-input flex-1 min-w-40"
                            />
                        )}
                        {needsField(check.kind, 'value') && (
                            <input
                                value={check.value || ''}
                                onChange={(e) => update(index, { value: e.target.value })}
                                placeholder={check.kind === 'style' ? 'expected value (e.g. red)' : 'expected value'}
                                className="hc-input flex-1 min-w-40"
                            />
                        )}
                    </div>

                    <div className="hc-row-label">{htmlCheckLabel(check)}</div>
                </div>
            ))}

            <div className="hc-actions">
                <HcDropdown
                    plus
                    value=""
                    options={CHECK_KINDS.map((k) => ({ value: k.id, label: k.label }))}
                    onChange={(v) => onChange([...checks, newHtmlCheck(v)])}
                />

                {onReferenceChange && (
                    <button
                        type="button"
                        onClick={() => { onReferenceChange(reference); setSavedReference(reference); }}
                        disabled={reference === savedReference}
                        className="hc-btn-ghost"
                        title="Save this page as your reference solution"
                    >
                        Save Reference Page
                    </button>
                )}

                <button
                    type="button"
                    onClick={runTests}
                    disabled={checks.length === 0 || !reference.trim() || testState === 'running'}
                    className="hc-btn-test"
                    title={reference.trim() ? 'Run the checks against the reference page' : 'Add a reference page first'}
                >
                    {testState === 'running' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    Test page checks
                </button>
                {checks.length === 0 && (
                    <span className="hc-hint">
                        Add a check first, then test.
                    </span>
                )}
            </div>

            {onReferenceChange && (
                <textarea
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Your reference page (full HTML) — used by “Test page checks”, not shown to students."
                    className="hc-reference"
                />
            )}

            {Array.isArray(testState) && (
                <div className="hc-results">
                    <div className={`hc-results-title ${testState.every((r) => r.passed) ? 'pass' : 'fail'}`}>
                        {testState.filter((r) => r.passed).length}/{testState.length} checks pass on the reference page
                    </div>
                    {testState.map((r, i) => (
                        <div key={r.id || i} className={`hc-result-row ${r.passed ? 'pass' : 'fail'}`}>
                            {r.passed ? <CheckCircle2 size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-rose-400" />}
                            <span>
                                {r.label || htmlCheckLabel(checks[i] || {})}
                            </span>
                            {!r.passed && r.detail && <span className="hc-result-detail">— {r.detail}</span>}
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
