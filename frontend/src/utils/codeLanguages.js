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
    return languageOf(languageId).extension();
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

// Normalize rendered/expected text for HTML challenge matching: collapse all
// whitespace runs and case-fold, so <h1> HELLO </h1> matches "hello".
export function normalizePageText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Inject the bridge as early as possible (top of <head>) so the console
// override exists before any student script runs. Falls back for documents
// without the usual structure.
export function injectPreviewBridge(source) {
    const bridge = PREVIEW_BRIDGE_SCRIPT;
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

export function normalizeFiles(files, fallbackCode = '') {
    if (isMultiFile(files)) {
        return files.map((f) => ({ name: String(f.name || 'index.html'), content: String(f.content || '') }));
    }
    return [{ name: 'index.html', content: String(fallbackCode || '') }];
}

export function webFileKind(name) {
    if (/\.css$/i.test(name)) return 'css';
    if (/\.js$/i.test(name)) return 'js';
    return 'html';
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
