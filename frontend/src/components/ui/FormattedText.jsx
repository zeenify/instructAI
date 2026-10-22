// Renders question text with real formatting: newlines are preserved,
// ``` fenced blocks become monospace panels, and `inline code` becomes a
// monospace span. Drop-in replacement for `{question.question_text}` inside
// any element — prose spans inherit the parent typography, only code panels
// carry their own look, so no surface needs layout changes.

const FENCE_RE = /```/;

function inlineCodeSegments(str, keyBase) {
    const parts = str.split(/`([^`\n]+)`/g);
    return parts.map((part, i) =>
        i % 2 === 1
            ? <span key={`${keyBase}-i${i}`} style={{
                fontFamily: '"JetBrains Mono", Consolas, "Courier New", monospace',
                fontSize: '0.92em',
                background: 'rgba(125,135,150,0.14)',
                border: '1px solid rgba(125,135,150,0.22)',
                borderRadius: 5,
                padding: '1px 5px',
                whiteSpace: 'pre-wrap',
            }}>{part}</span>
            : part
    );
}

export default function FormattedText({ text }) {
    if (text == null || text === '') return null;
    const str = String(text).replace(/\r\n/g, '\n');
    if (!str.includes('```') && !str.includes('`')) {
        return <span style={{ whiteSpace: 'pre-wrap' }}>{str}</span>;
    }

    const segments = str.split(FENCE_RE);
    const nodes = [];
    segments.forEach((seg, i) => {
        if (i % 2 === 1) {
            // Fenced block — strip a leading language line (```java\n...)
            const code = seg.replace(/^[a-zA-Z0-9+#_-]*\n/, '');
            nodes.push(
                <span key={i} style={{
                    display: 'block',
                    fontFamily: '"JetBrains Mono", Consolas, "Courier New", monospace',
                    fontSize: '12.5px',
                    lineHeight: 1.55,
                    background: 'rgba(125,135,150,0.10)',
                    border: '1px solid rgba(125,135,150,0.22)',
                    borderRadius: 8,
                    padding: '9px 11px',
                    margin: '8px 0',
                    whiteSpace: 'pre',
                    overflowX: 'auto',
                    textAlign: 'left',
                }}>{code}</span>
            );
        } else if (seg !== '') {
            nodes.push(<span key={i} style={{ whiteSpace: 'pre-wrap' }}>{inlineCodeSegments(seg, i)}</span>);
        }
    });
    return nodes;
}
