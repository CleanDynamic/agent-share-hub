/**
 * codeRunner
 *
 * Executes user code in a sandboxed environment.
 *
 * - JavaScript: runs inside a `<iframe srcdoc sandbox="allow-scripts">` so it
 *   has no same-origin access, no cookies, no top navigation, no forms.
 *   `console.log/info/warn/error` are patched to forward via `postMessage`.
 *
 * - Python: lazy-loads Pyodide from CDN inside a Web Worker (so the main
 *   thread stays responsive), captures stdout/stderr, returns the result.
 *
 * Both runners enforce a wall-clock timeout. They never have access to
 * the host page's DOM, store, or network credentials.
 */

export interface RunResult {
  stdout: string;
  stderr: string;
  /** Truthy when execution itself failed (uncaught exception). */
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 5000;

// ─── JavaScript via sandboxed iframe ─────────────────────────────────

export async function runJavaScript(
  code: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<RunResult> {
  return new Promise((resolve) => {
    const runId = `run-${Math.random().toString(36).slice(2)}`;
    const stdout: string[] = [];
    const stderr: string[] = [];
    let settled = false;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.display = 'none';

    const html = `<!doctype html><html><body><script>
      (function () {
        var RUN_ID = ${JSON.stringify(runId)};
        function send(kind, args) {
          var parts = [];
          for (var i = 0; i < args.length; i++) {
            var a = args[i];
            try {
              parts.push(typeof a === 'string' ? a : JSON.stringify(a));
            } catch (e) {
              parts.push(String(a));
            }
          }
          parent.postMessage({ runId: RUN_ID, kind: kind, text: parts.join(' ') }, '*');
        }
        var origLog = console.log;
        console.log = function () { send('log', arguments); };
        console.info = function () { send('log', arguments); };
        console.warn = function () { send('warn', arguments); };
        console.error = function () { send('err', arguments); };
        window.addEventListener('error', function (e) {
          send('err', [e.message]);
          parent.postMessage({ runId: RUN_ID, kind: 'done' }, '*');
        });
        try {
          var result = (new Function(${JSON.stringify(code)}))();
          if (result !== undefined) send('log', [result]);
          parent.postMessage({ runId: RUN_ID, kind: 'done' }, '*');
        } catch (err) {
          send('err', [err && err.message ? err.message : String(err)]);
          parent.postMessage({ runId: RUN_ID, kind: 'done' }, '*');
        }
      })();
    <\/script></body></html>`;
    iframe.srcdoc = html;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const finish = (extraErr?: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        stdout: stdout.join('\n'),
        stderr: stderr.join('\n'),
        error: extraErr,
      });
    };

    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || data.runId !== runId) return;
      if (data.kind === 'log') stdout.push(String(data.text ?? ''));
      else if (data.kind === 'warn') stdout.push(String(data.text ?? ''));
      else if (data.kind === 'err') stderr.push(String(data.text ?? ''));
      else if (data.kind === 'done') finish();
    };
    window.addEventListener('message', onMessage);

    document.body.appendChild(iframe);
    setTimeout(() => finish('Timed out'), timeoutMs);
  });
}

// ─── Python via Pyodide in a Worker ──────────────────────────────────

let pyWorker: Worker | null = null;
let pyReady: Promise<void> | null = null;

const PYODIDE_VERSION = '0.26.4';
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

function ensurePyWorker(): { worker: Worker; ready: Promise<void> } {
  if (pyWorker && pyReady) return { worker: pyWorker, ready: pyReady };

  const workerSource = `
    self.stdoutBuf = '';
    self.stderrBuf = '';
    importScripts(${JSON.stringify(PYODIDE_CDN + 'pyodide.js')});

    let pyodide;
    let readyResolve;
    const readyPromise = new Promise(r => { readyResolve = r; });

    (async () => {
      pyodide = await loadPyodide({
        indexURL: ${JSON.stringify(PYODIDE_CDN)},
        stdout: (s) => { self.stdoutBuf += s + '\\n'; },
        stderr: (s) => { self.stderrBuf += s + '\\n'; },
      });
      readyResolve();
      self.postMessage({ kind: 'ready' });
    })().catch(err => {
      self.postMessage({ kind: 'init-error', error: String(err) });
    });

    self.onmessage = async (e) => {
      const { id, code, timeoutMs } = e.data;
      await readyPromise;
      self.stdoutBuf = '';
      self.stderrBuf = '';
      let timer = setTimeout(() => {
        self.postMessage({ id, kind: 'result', stdout: self.stdoutBuf, stderr: self.stderrBuf, error: 'Timed out' });
      }, timeoutMs);
      try {
        await pyodide.runPythonAsync(code);
        clearTimeout(timer);
        self.postMessage({ id, kind: 'result', stdout: self.stdoutBuf, stderr: self.stderrBuf });
      } catch (err) {
        clearTimeout(timer);
        self.postMessage({ id, kind: 'result', stdout: self.stdoutBuf, stderr: self.stderrBuf, error: String(err && err.message || err) });
      }
    };
  `;

  const blob = new Blob([workerSource], { type: 'application/javascript' });
  const worker = new Worker(URL.createObjectURL(blob));
  const ready = new Promise<void>((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.kind === 'ready') {
        worker.removeEventListener('message', onMsg);
        resolve();
      } else if (e.data?.kind === 'init-error') {
        worker.removeEventListener('message', onMsg);
        reject(new Error(`Pyodide init failed: ${e.data.error}`));
      }
    };
    worker.addEventListener('message', onMsg);
  });

  pyWorker = worker;
  pyReady = ready;
  return { worker, ready };
}

export async function runPython(
  code: string,
  timeoutMs = 15000,
): Promise<RunResult> {
  const { worker, ready } = ensurePyWorker();
  try {
    await ready;
  } catch (err) {
    return {
      stdout: '',
      stderr: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
  const id = `py-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      worker.removeEventListener('message', onMsg);
      resolve({
        stdout: String(e.data.stdout ?? ''),
        stderr: String(e.data.stderr ?? ''),
        error: e.data.error,
      });
    };
    worker.addEventListener('message', onMsg);
    worker.postMessage({ id, code, timeoutMs });
  });
}

// ─── Public dispatcher ───────────────────────────────────────────────

export type RunnableLanguage = 'javascript' | 'python';

export function isRunnable(lang: string): lang is RunnableLanguage {
  return lang === 'javascript' || lang === 'python';
}

export async function runCode(
  language: RunnableLanguage,
  code: string,
): Promise<RunResult> {
  if (language === 'python') return runPython(code);
  return runJavaScript(code);
}
