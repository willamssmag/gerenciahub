(() => {
  "use strict";
  const id = new URLSearchParams(location.search).get("id") || "";
  const storage = window.PortfolioStorage;
  const project = storage.getProject(id);
  const code = storage.getCode(id);
  const frame = document.querySelector("#frame");
  const empty = document.querySelector("#empty");
  const title = document.querySelector("#title");
  const editLink = document.querySelector("#editLink");

  function escapeHtml(value) {
    return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function buildDocument(source, language) {
    if (language === "html") return source;
    if (language === "css") return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;padding:30px}${source.replace(/<\/style/gi,"<\\/style")}</style></head><body><main class="demo-card"><h1>Prévia do CSS</h1><p>Projeto salvo localmente.</p><button>Botão de exemplo</button></main></body></html>`;
    if (language === "javascript") {
      const bytes = new TextEncoder().encode(source); let binary=""; bytes.forEach(byte=>binary+=String.fromCharCode(byte)); const encoded=btoa(binary);
      return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Consolas,monospace;padding:30px;background:#020617;color:#d1fae5;white-space:pre-wrap}</style></head><body><pre id="out">Executando…</pre><script>const out=document.getElementById('out'),lines=[];console.log=(...args)=>{lines.push(args.map(v=>typeof v==='object'?JSON.stringify(v,null,2):String(v)).join(' '));out.textContent=lines.join('\\n')};try{const s=new TextDecoder().decode(Uint8Array.from(atob('${encoded}'),c=>c.charCodeAt(0)));new Function(s)();if(!lines.length)out.textContent='Código executado sem saída no console.'}catch(e){out.textContent='Erro: '+e.message}<\/script></body></html>`;
    }
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;padding:30px;background:#020617;color:#dbeafe;font:14px/1.65 Consolas,monospace}pre{white-space:pre-wrap;word-break:break-word}</style></head><body><pre>${escapeHtml(source)}</pre></body></html>`;
  }

  if (!project || !code) {
    frame.hidden = true;
    empty.hidden = false;
    return;
  }

  title.textContent = project.title;
  document.title = project.title;
  editLink.href = `/visualizador/?edit=${encodeURIComponent(id)}`;
  frame.sandbox = "allow-scripts allow-modals allow-forms allow-popups";
  frame.srcdoc = buildDocument(code, project.language || "html");
})();
