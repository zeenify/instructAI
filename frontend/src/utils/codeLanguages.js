// Central registry for every executable language in InstructAI.
// The execution engine (instruct-execute) runs java / python / javascript /
// cpp server-side; 'html' never leaves the browser — a sandboxed iframe is
// its runtime. Teacher authoring UIs and student IDEs all read from here so
// labels, colors, CodeMirror highlighting and starter templates stay in sync.
import { java } from '@codemirror/lang-java';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { cpp } from '@codemirror/lang-cpp';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Vivid One-Dark-Pro token colors — attached inside cmExtension so EVERY
// editor surface (student IDEs, quiz answers, teacher builders) highlights
// with the same lively palette instead of the pale default dark theme.
export const vividHighlight = syntaxHighlighting(HighlightStyle.define([
    { tag: [tags.keyword, tags.modifier, tags.controlKeyword, tags.moduleKeyword, tags.operatorKeyword], color: '#c678dd' },
    { tag: [tags.typeName, tags.className, tags.namespace], color: '#e5c07b' },
    { tag: [tags.number, tags.bool, tags.null, tags.atom], color: '#d19a66' },
    { tag: [tags.string, tags.special(tags.string), tags.character], color: '#98c379' },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName, tags.meta, tags.processingInstruction], color: '#61afef' },
    { tag: [tags.definition(tags.variableName), tags.variableName, tags.propertyName], color: '#e06c75' },
    { tag: [tags.operator], color: '#56b6c2' },
    { tag: [tags.comment, tags.lineComment, tags.blockComment], color: '#7f848e', fontStyle: 'italic' },
    { tag: [tags.tagName, tags.self], color: '#e06c75' },
    { tag: [tags.attributeName], color: '#d19a66' },
    { tag: [tags.attributeValue], color: '#98c379' },
    { tag: [tags.punctuation, tags.bracket, tags.paren, tags.separator], color: '#abb2bf' },
    { tag: [tags.heading, tags.strong], color: '#61afef', fontWeight: 'bold' },
    { tag: [tags.link, tags.url], color: '#56b6c2', textDecoration: 'underline' },
    { tag: [tags.strikethrough], color: '#7f848e', textDecoration: 'line-through' },
    { tag: [tags.invalid], color: '#f44747' },
]));

export const CODE_LANGUAGES = {
    java: {
        id: 'java',
        label: 'Java',
        color: '#f89820',
        extension: java,
        comment: '//',
        template: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
    },
    python: {
        id: 'python',
        label: 'Python 3',
        color: '#4B8BBE',
        extension: python,
        comment: '#',
        template: 'name = input("What is your name? ")\nprint(f"Hello, {name}!")',
    },
    javascript: {
        id: 'javascript',
        label: 'JavaScript',
        color: '#f7df1e',
        extension: javascript,
        comment: '//',
        template: '// JavaScript (Node.js) — console.log writes to the output panel\nconst name = "World";\nconsole.log(`Hello, ${name}!`);',
    },
    cpp: {
        id: 'cpp',
        label: 'C++',
        color: '#00599C',
        extension: cpp,
        comment: '//',
        template: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',
    },
    html: {
        id: 'html',
        label: 'HTML / CSS / JS',
        color: '#E34F26',
        extension: html,
        comment: '<!--',
        preview: true,
        challengeNote: 'The rendered page must contain the expected text.',
        template: '<!DOCTYPE html>\n<html>\n<head>\n    <style>\n        body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; }\n        h1 { color: #7c3aed; }\n    </style>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n    <script>\n        // console.log shows up in the Console tab\n        console.log("Page loaded!");\n    </script>\n</body>\n</html>',
    },
};

export const LANGUAGE_IDS = Object.keys(CODE_LANGUAGES);

// Starter-file name per language (single-file blocks)
const LANG_FILENAMES = { python: 'main.py', java: 'Main.java', cpp: 'main.cpp', javascript: 'main.js', html: 'index.html' };

export function languageOf(id) {
    return CODE_LANGUAGES[id] || CODE_LANGUAGES.java;
}

// Legacy content created before languages existed is Java — but blocks where
// the teacher pasted something obviously different are upgraded for free.
export function inferLanguage(code = '') {
    if (/^\s*<(!doctype|html)/i.test(code)) return 'html';
    if (/def\s+\w+\s*\(|\bprint\s*\(|import\s+\w+\s*$|^\s*#\s/m.test(code) && !/;\s*$/m.test(code) && !/public\s+class/.test(code)) return 'python';
    if (/#include\s*<|std::/.test(code)) return 'cpp';
    if (/(const|let|var|console\.|function\s+\w+\s*\(|=>)/.test(code) && !/public\s+class/.test(code)) return 'javascript';
    return 'java';
}

export function resolveLanguage(languageId, code) {
    return languageId && CODE_LANGUAGES[languageId] ? languageId : inferLanguage(code);
}

export function cmExtension(languageId) {
    return [languageOf(languageId).extension(), vividHighlight];
}

// Heuristic: does this program read from stdin? Used to auto-open the input
// UI instead of letting students hit a bare EOFError with no hint.
export function detectStdinUsage(languageId, code = '') {
    switch (languageId) {
        case 'python':
            return /\binput\s*\(|\bsys\.stdin\b|\bstdin\b/.test(code);
        case 'java':
            return /new\s+Scanner|System\.in|\.readLine\s*\(|Console\.reader\s*\(/.test(code);
        case 'javascript':
            return /process\.stdin|\breadline\b|node:readline/.test(code);
        case 'cpp':
            return /\bcin\b|\bgetline\s*\(|\bscanf\s*\(|\bfgets\s*\(/.test(code);
        default:
            return false;
    }
}

// stderr signatures for a program that asked for input and reached
// end-of-input (Java's Scanner, Python's input()) — an artifact of the run
// having nothing to feed it, not a bug in the student's code.
export const READS_CLOSED_STDIN = /NoSuchElementException|EOFError|EOF when reading a line/;

// Normalize rendered/expected text for HTML challenge matching: collapse all
// whitespace runs and case-fold, so <h1> HELLO </h1> matches "hello".
export function normalizePageText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Inject the bridge as early as possible (top of <head>) so the console
// override exists before any student script runs. Falls back for documents
// without the usual structure. When `checks` are supplied the injected bridge
// also grades the rendered page against them and posts `check-results`.
export function injectPreviewBridge(source, checks = null) {
    const bridge = checks && checks.length > 0 ? buildPreviewBridge(checks) : PREVIEW_BRIDGE_SCRIPT;
    if (/<head[^>]*>/i.test(source)) return source.replace(/<head[^>]*>/i, (m) => m + bridge);
    if (/<html[^>]*>/i.test(source)) return source.replace(/<html[^>]*>/i, (m) => m + bridge);
    if (/<body[^>]*>/i.test(source)) return source.replace(/<body[^>]*>/i, (m) => m + bridge);
    return bridge + source;
}

// ---------- Multi-file web projects ----------
// A web block can hold several files (index.html + style.css + script.js).
// `files` is an array of { name, content }; a block without `files` is single
// file and keeps using its `code` string.

export function isMultiFile(files) {
    return Array.isArray(files) && files.length > 0;
}

export function normalizeFiles(files, fallbackCode = '', languageHint = '') {
    if (isMultiFile(files)) {
        return files.map((f) => ({ name: String(f.name || 'index.html'), content: String(f.content || '') }));
    }
    // A single file is named after its language so the editor opens it with
    // the right parser and tab look — a Python block named index.html used
    // to be parsed as HTML, which rendered every token the same grey.
    const defaultName = LANG_FILENAMES[languageHint]
        || LANG_FILENAMES[inferLanguage(String(fallbackCode || ''))]
        || 'index.html';
    return [{ name: defaultName, content: String(fallbackCode || '') }];
}

export function webFileKind(name) {
    if (/\.css$/i.test(name)) return 'css';
    if (/\.(js|mjs)$/i.test(name)) return 'js';
    if (/\.html?$/i.test(name)) return 'html';
    // Not a web file (.py, .java, .cpp, .txt…) — callers fall back to the
    // block's own language instead of pretending it is HTML
    return '';
}

// Parses a stored `code` string back into a files array when it holds a
// multi-file JSON snapshot; returns null for plain single-file code.
export function parseStoredFiles(code) {
    try {
        const parsed = JSON.parse(code);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((f) => f && typeof f.name === 'string' && typeof f.content === 'string')) {
            return normalizeFiles(parsed);
        }
    } catch { /* plain code */ }
    return null;
}

// Compose the files into one document: CSS is injected before </head>, JS
// before </body>, so student pages work exactly like a real folder served
// to a browser.
export function composeWebProject(files) {
    const normalized = normalizeFiles(files);
    const htmlFile = normalized.find((f) => webFileKind(f.name) === 'html') || normalized[0];
    const css = normalized.filter((f) => webFileKind(f.name) === 'css').map((f) => f.content).join('\n\n');
    const js = normalized.filter((f) => webFileKind(f.name) === 'js').map((f) => f.content).join('\n\n');

    let doc = htmlFile.content || '<!DOCTYPE html>\n<html>\n<body></body>\n</html>';

    if (css.trim()) {
        doc = /<\/head>/i.test(doc)
            ? doc.replace(/<\/head>/i, `<style>\n${css}\n</style>\n</head>`)
            : `<style>\n${css}\n</style>\n` + doc;
    }
    if (js.trim()) {
        doc = /<\/body>/i.test(doc)
            ? doc.replace(/<\/body>/i, `<script>\n${js}\n</script>\n</body>`)
            : doc + `\n<script>\n${js}\n</script>`;
    }

    return doc;
}

// Starter file sets for the teacher's "+ file" action in the lesson editor.
export const WEB_FILE_TEMPLATES = {
    html: { name: 'page.html', content: '<!DOCTYPE html>\n<html>\n<head>\n</head>\n<body>\n</body>\n</html>' },
    css: { name: 'style.css', content: '/* styles shared by every page */\n' },
    js: { name: 'script.js', content: '// scripts shared by every page\n' },
};

// The script injected into every preview iframe: bridges console output and
// the rendered page text back to the IDE through postMessage. Runs inside the
// sandbox — the parent can never touch the frame's document directly.
export const PREVIEW_BRIDGE_SCRIPT = `
<script>
(function () {
    var send = function (payload) {
        try { parent.postMessage(Object.assign({ __instructai_preview: true }, payload), '*'); } catch (e) {}
    };
    var format = function (args) {
        return Array.prototype.map.call(args, function (a) {
            if (a instanceof Error) return a.message;
            if (typeof a === 'object' && a !== null) { try { return JSON.stringify(a); } catch (e) { return String(a); } }
            return String(a);
        }).join(' ');
    };
    ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
        var original = console[level] ? console[level].bind(console) : function () {};
        console[level] = function () {
            send({ type: 'console', level: level, message: format(arguments) });
            original.apply(console, arguments);
        };
    });
    window.addEventListener('error', function (event) {
        send({ type: 'console', level: 'error', message: event.message + ' (line ' + event.lineno + ')' });
    });
    window.addEventListener('unhandledrejection', function (event) {
        send({ type: 'console', level: 'error', message: 'Unhandled promise rejection: ' + event.reason });
    });
    var postText = function () {
        try { send({ type: 'page-text', text: document.body ? document.body.innerText : '' }); } catch (e) {}
    };
    document.addEventListener('DOMContentLoaded', function () { setTimeout(postText, 60); });
    window.addEventListener('load', function () { setTimeout(postText, 120); });
})();
</script>`;

// ---------- HTML page checks (freeCodeCamp-style) ----------
// A check is a small structured assertion the bridge grades against the
// rendered page INSIDE the sandboxed iframe:
//   { id, kind, selector?, count?, match?, text?, attribute?, value?, property?, label? }
// Kinds: exists | text | attribute | style | page-text | no-console-errors

export const CHECK_KINDS = [
    { id: 'exists', label: 'Element exists', needs: ['selector', 'count'] },
    { id: 'text', label: 'Element text', needs: ['selector', 'match', 'text'] },
    { id: 'attribute', label: 'Element attribute', needs: ['selector', 'attribute', 'match', 'value'] },
    { id: 'style', label: 'Computed style', needs: ['selector', 'property', 'value'] },
    { id: 'page-text', label: 'Page contains text', needs: ['text'] },
    { id: 'no-console-errors', label: 'No console errors', needs: [] },
];

/**
 * Lesson challenge test cases for non-web languages. Each case runs the
 * student's program with `input` on stdin; the console output must match
 * `expected_output` exactly (trimmed, newline-normalized).
 *
 * Backward compatible: a challenge authored before test cases existed has
 * only the single `expected` goal — that becomes one case with empty input,
 * which is precisely the old behavior.
 */
export function normalizeChallengeCases(testCases, expected) {
    if (Array.isArray(testCases) && testCases.length > 0) {
        return testCases.map((c, i) => ({
            id: c.id || `case-${i}`,
            // Teachers type "\n" in the editor's one-line input; the quiz
            // grader path un-escapes it server-side, this path used to feed
            // the literal backslash into the JVM — instant InputMismatch.
            input: String(c.input || '').replace(/\\r\\n|\\n/g, '\n'),
            expected_output: String(c.expected_output ?? '').replace(/\\r\\n|\\n/g, '\n'),
        }));
    }
    const goal = String(expected || '').trim().replace(/\\r\\n|\\n/g, '\n');
    return goal ? [{ id: 'goal', input: '', expected_output: goal }] : [];
}

export function newHtmlCheck(kind = 'exists') {
    const base = { id: 'check-' + Math.random().toString(36).slice(2, 9), kind };
    if (kind === 'exists') return { ...base, selector: '', count: 1 };
    if (kind === 'text') return { ...base, selector: '', match: 'contains', text: '' };
    if (kind === 'attribute') return { ...base, selector: '', attribute: 'href', match: 'equals', value: '' };
    if (kind === 'style') return { ...base, selector: '', property: 'color', value: '' };
    if (kind === 'page-text') return { ...base, text: '' };
    return base;
}

// Human-readable sentence for check lists (student checklist, teacher verify).
export function htmlCheckLabel(check) {
    if (check.label) return check.label;
    const sel = check.selector || 'page';
    switch (check.kind) {
        case 'exists':
            return `Element "${check.selector || 'body'}" exists${Number(check.count) > 1 ? ` (at least ${check.count})` : ''}`;
        case 'text':
            return `Element "${sel}" text ${check.match === 'equals' ? 'is exactly' : 'contains'} "${check.text}"`;
        case 'attribute':
            return `Element "${sel}" has ${check.attribute} ${check.match === 'contains' ? 'containing' : '='} "${check.value}"`;
        case 'style':
            return `Element "${sel}" has ${check.property} = ${check.value}`;
        case 'page-text':
            return `Page contains "${check.text}"`;
        case 'no-console-errors':
            return 'Page loads with no console errors';
        default:
            return 'Check';
    }
}

// Legacy challenges only stored an "expected text" string — wrap it as a
// page-text check so every consumer runs the single checks pipeline.
export function synthesizeHtmlChecks(expectedText) {
    const text = String(expectedText || '').trim();
    if (!text) return [];
    return [{ id: 'page-text-auto', kind: 'page-text', text, label: `Page contains "${text}"` }];
}

export function normalizeHtmlChecks(checks, legacyExpected = '') {
    const list = Array.isArray(checks) ? checks.filter((c) => c && CHECK_KINDS.some((k) => k.id === c.kind)) : [];
    const text = String(legacyExpected || '').trim();
    // The quick "expected text" field always counts as one more page-text
    // check, so it stays enforced next to structured checks instead of
    // silently disappearing behind them.
    if (text && !list.some((c) => c.kind === 'page-text' && String(c.text || '').trim().toLowerCase() === text.toLowerCase())) {
        list.push(...synthesizeHtmlChecks(text));
    }
    return list;
}

// Builds the bridge script variant that grades the page. Checks are embedded
// at build time (the sandbox blocks parent→frame DOM access), run ~150ms and
// ~900ms after load (late DOM mutations get a second chance), and the parent
// treats the LAST `check-results` message as authoritative.
export function buildPreviewBridge(checks) {
    const serialized = JSON.stringify(checks);
    return `
<script>
(function () {
    var send = function (payload) {
        try { parent.postMessage(Object.assign({ __instructai_preview: true }, payload), '*'); } catch (e) {}
    };
    var format = function (args) {
        return Array.prototype.map.call(args, function (a) {
            if (a instanceof Error) return a.message;
            if (typeof a === 'object' && a !== null) { try { return JSON.stringify(a); } catch (e) { return String(a); } }
            return String(a);
        }).join(' ');
    };
    var errorCount = 0;
    ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
        var original = console[level] ? console[level].bind(console) : function () {};
        console[level] = function () {
            if (level === 'error') errorCount++;
            send({ type: 'console', level: level, message: format(arguments) });
            original.apply(console, arguments);
        };
    });
    window.addEventListener('error', function (event) {
        errorCount++;
        send({ type: 'console', level: 'error', message: event.message + ' (line ' + event.lineno + ')' });
    });
    window.addEventListener('unhandledrejection', function (event) {
        errorCount++;
        send({ type: 'console', level: 'error', message: 'Unhandled promise rejection: ' + event.reason });
    });

    var CHECKS = ${serialized};

    var normText = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim().toLowerCase(); };
    // Normalize a candidate value ("red", "bold", "2em", "50%") the same way
    // the browser would compute it ON THE MATCHED ELEMENT — percentage values
    // resolve against the element's own box, so a detached probe would lie.
    var normValue = function (el, prop, value) {
        try {
            var probe = el.cloneNode(false);
            probe.style.cssText += ';position:absolute!important;left:-9999px;top:-9999px;margin:0;';
            probe.style[prop] = value;
            el.parentNode.appendChild(probe);
            var computed = getComputedStyle(probe)[prop];
            probe.remove();
            return computed;
        } catch (e) { return String(value || '').toLowerCase(); }
    };

    var runChecks = function () {
        var results = CHECKS.map(function (check, idx) {
            var res = { id: check.id || ('check-' + idx), label: check.label || '', passed: false, detail: '' };
            try {
                switch (check.kind) {
                    case 'exists': {
                        var found = document.querySelectorAll(check.selector || 'body').length;
                        var need = Math.max(1, Number(check.count) || 1);
                        res.passed = found >= need;
                        res.detail = res.passed ? '' : 'found ' + found + ' element(s) for "' + check.selector + '" (need ' + need + ')';
                        break;
                    }
                    case 'text': {
                        var scope = check.selector ? document.querySelector(check.selector) : document.body;
                        var txt = normText(scope ? scope.innerText : '');
                        var expected = normText(check.text);
                        res.passed = check.match === 'equals' ? txt === expected : (expected !== '' && txt.indexOf(expected) !== -1);
                        res.detail = res.passed ? '' : 'text not found' + (check.selector ? ' in "' + check.selector + '"' : ' on the page');
                        break;
                    }
                    case 'attribute': {
                        var el = check.selector ? document.querySelector(check.selector) : null;
                        if (!el) { res.detail = 'no element for "' + check.selector + '"'; break; }
                        var val = el.getAttribute(check.attribute || '') || '';
                        var exp = String(check.value || '');
                        res.passed = check.match === 'contains' ? val.indexOf(exp) !== -1 : val === exp;
                        res.detail = res.passed ? '' : check.attribute + '="' + val + '"' + (res.passed ? '' : ' (expected ' + (check.match === 'contains' ? 'to contain ' : '') + '"' + exp + '")');
                        break;
                    }
                    case 'style': {
                        var el2 = check.selector ? document.querySelector(check.selector) : null;
                        if (!el2) { res.detail = 'no element for "' + check.selector + '"'; break; }
                        var computed = getComputedStyle(el2)[check.property || 'color'];
                        res.passed = normValue(el2, check.property || 'color', check.value) === normValue(el2, check.property || 'color', computed);
                        res.detail = res.passed ? '' : (check.property + ' is "' + computed + '" (expected "' + check.value + '")');
                        break;
                    }
                    case 'page-text': {
                        var page = normText(document.body ? document.body.innerText : '');
                        var expT = normText(check.text);
                        res.passed = expT !== '' && page.indexOf(expT) !== -1;
                        res.detail = res.passed ? '' : 'expected text not on the page';
                        break;
                    }
                    case 'no-console-errors': {
                        res.passed = errorCount === 0;
                        res.detail = res.passed ? '' : errorCount + ' console error(s)';
                        break;
                    }
                    default:
                        res.detail = 'unknown check kind';
                }
            } catch (e) {
                res.detail = 'check error: ' + e.message;
            }
            return res;
        });
        send({ type: 'check-results', results: results });
    };

    var kick = function () { setTimeout(runChecks, 150); setTimeout(runChecks, 900); };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', kick);
        window.addEventListener('load', kick);
    } else {
        // Script injected into an already-complete document — events already fired.
        kick();
    }
})();
</script>`;

}
