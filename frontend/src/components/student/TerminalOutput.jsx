import { useMemo } from 'react';

// One real-terminal rendering for engine runs, shared by every coding
// surface (lesson IDE, challenge cases, quiz/activity coding answers).
// The engine already returns javac/python/node output verbatim in
// compile_output / stderr — this component just stops hiding it.

const RUN_COMMANDS = {
    java: 'javac Main.java && java Main',
    python: 'python3 main.py',
    javascript: 'node main.js',
    cpp: 'g++ main.cpp -o main && ./main',
};

const KIND_LABELS = {
    compile: 'COMPILATION FAILED',
    runtime: 'PROGRAM CRASHED',
    timeout: 'TIMED OUT',
    system: 'ENGINE UNREACHABLE',
    noinput: 'NO SAMPLE INPUT',
};

function lineColor(line) {
    const l = line.toLowerCase();
    if (l.includes('error:') || l.includes('exception') || l.includes('syntaxerror') || l.includes('traceback (most recent')) return '#f87171';
    if (/^\s*at\s/.test(line) || l.includes('^')) return '#f0a5a5';
    if (l.includes('warning:')) return '#fbbf24';
    return '#d7dce6';
}

export default function TerminalOutput({ language = 'java', kind, errorText, output, meta, onRetry }) {
    const command = RUN_COMMANDS[language] || RUN_COMMANDS.java;
    const isOk = kind === 'ok';
    const body = isOk
        ? (output || '')
        : (errorText || 'The engine did not return any details.');

    const lines = useMemo(() => body.replace(/\r\n/g, '\n').split('\n'), [body]);

    return (
        <div style={{
            margin: '12px 0',
            borderRadius: '10px',
            background: '#0b0e14',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            overflow: 'hidden',
            fontFamily: '"JetBrains Mono", Courier New, monospace',
        }}>
            {/* Title bar: the command this run corresponds to, like a real shell */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 12px', background: '#10141d',
                borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
                fontSize: '11px', color: '#8b95a7',
            }}>
                <span style={{ color: '#4ade80', fontWeight: 700 }}>$</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{command}</span>
                <span style={{ flex: 1 }} />
                {KIND_LABELS[kind] && (
                    <span style={{
                        fontSize: '9px', fontWeight: 800, letterSpacing: '0.08em',
                        padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap',
                        color: isOk ? '#4ade80' : kind === 'timeout' ? '#fbbf24' : kind === 'noinput' ? '#93c5fd' : '#f87171',
                        background: isOk ? 'rgba(74, 222, 128, 0.12)' : kind === 'timeout' ? 'rgba(251, 191, 36, 0.12)' : kind === 'noinput' ? 'rgba(147, 197, 253, 0.12)' : 'rgba(248, 113, 113, 0.12)',
                    }}>
                        {KIND_LABELS[kind]}
                    </span>
                )}
                {kind === 'system' && onRetry && (
                    <button onClick={onRetry} type="button" style={{
                        background: 'transparent', border: '1px solid rgba(147, 197, 253, 0.4)', borderRadius: '6px',
                        color: '#93c5fd', cursor: 'pointer', fontSize: '10px', fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 10px', marginLeft: '6px',
                    }}>
                        Retry
                    </button>
                )}
            </div>
            <pre style={{
                margin: 0, padding: '10px 14px 12px',
                fontSize: '12px', lineHeight: 1.55,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                color: '#d7dce6',
            }}>
                {isOk ? (
                    <>
                        {lines.map((line, i) => (
                            <span key={i} style={{ color: lineColor(line) }}>{line}{'\n'}</span>
                        ))}
                        <span style={{ color: '#4ade80' }}>
                            {`> Process exited with code ${meta?.exit_code ?? 0}${meta?.duration_ms ? ` in ${(meta.duration_ms / 1000).toFixed(1)}s` : ''}\n`}
                        </span>
                    </>
                ) : (
                    <>
                        {lines.map((line, i) => (
                            <span key={i} style={{ color: kind === 'timeout' || kind === 'system' || kind === 'noinput' ? '#93c5fd' : lineColor(line) }}>{line}{'\n'}</span>
                        ))}
                        <span style={{ color: '#64748b' }}>
                            {kind === 'noinput'
                                ? '> Automatic check skipped — type input in the terminal below.\n'
                                : `> Process exited with code ${meta?.exit_code ?? 1}\n`}
                            {kind === 'compile' ? '> Fix the error(s) above, then run again.\n' : ''}
                        </span>
                    </>
                )}
            </pre>
        </div>
    );
}
