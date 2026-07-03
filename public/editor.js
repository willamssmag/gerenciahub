(() => {
  "use strict";

  const storage = window.PortfolioStorage;
  const query = new URLSearchParams(location.search);
  let editingId = storage.slugify(query.get("edit") || "");
  let currentProject = null;
  let saveMode = "local";
  let previewDocument = "";
  let toastTimer = null;

  const examples = {
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meu Projeto</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      font-family: Arial, sans-serif;
      background: linear-gradient(135deg, #111827, #312e81);
      color: white;
    }
    .card {
      width: min(520px, 100%);
      padding: 36px;
      border: 1px solid rgba(255,255,255,.2);
      border-radius: 24px;
      background: rgba(255,255,255,.1);
      box-shadow: 0 28px 80px rgba(0,0,0,.35);
      text-align: center;
    }
    button {
      border: 0;
      border-radius: 12px;
      padding: 13px 18px;
      color: white;
      background: #7c3aed;
      font-weight: bold;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>Meu novo projeto</h1>
    <p>Cole ou escreva o código completo nesta página.</p>
    <button onclick="alert('Funcionou!')">Testar botão</button>
  </main>
</body>
</html>`,
    css: `body {
  background: linear-gradient(135deg, #dbeafe, #ede9fe);
  font-family: Arial, sans-serif;
}

.demo-card {
  max-width: 520px;
  margin: 60px auto;
  padding: 32px;
  border-radius: 22px;
  background: white;
  box-shadow: 0 24px 60px rgba(15, 23, 42, .18);
}

button {
  padding: 12px 18px;
  border: 0;
  border-radius: 10px;
  background: #6d28d9;
  color: white;
  font-weight: bold;
}`,
    javascript: `const projetos = ["Portfólio", "Calculadora", "Aplicativo"];

console.log("Projetos cadastrados:", projetos.length);
projetos.forEach((projeto, indice) => {
  console.log(\`\${indice + 1}. \${projeto}\`);
});`,
    java: `public class Main {
    public static void main(String[] args) {
        String projeto = "Meu Projeto Java";
        System.out.println(projeto);
    }
}`,
    json: `{
  "nome": "Meu Projeto",
  "status": "em desenvolvimento",
  "tecnologias": ["HTML", "CSS", "JavaScript"]
}`,
    python: `projetos = ["Portfólio", "Calculadora", "Aplicativo"]

for indice, projeto in enumerate(projetos, start=1):
    print(f"{indice}. {projeto}")`,
    text: "Cole aqui qualquer código ou conteúdo de texto."
  };

  const elements = {
    themeToggle: document.querySelector("#themeToggle"),
    pageTitle: document.querySelector("#pageTitle"),
    status: document.querySelector("#editorStatus"),
    language: document.querySelector("#languageSelect"),
    editor: document.querySelector("#codeEditor"),
    lineNumbers: document.querySelector("#lineNumbers"),
    codeInfo: document.querySelector("#codeInfo"),
    pasteBtn: document.querySelector("#pasteBtn"),
    exampleBtn: document.querySelector("#exampleBtn"),
    clearBtn: document.querySelector("#clearBtn"),
    previewBtn: document.querySelector("#previewBtn"),
    saveLocalBtn: document.querySelector("#saveLocalBtn"),
    publishBtn: document.querySelector("#publishBtn"),
    previewDialog: document.querySelector("#previewDialog"),
    previewFrame: document.querySelector("#previewFrame"),
    previewLanguage: document.querySelector("#previewLanguage"),
    closePreviewBtn: document.querySelector("#closePreviewBtn"),
    openNewTabBtn: document.querySelector("#openNewTabBtn"),
    metadataDialog: document.querySelector("#metadataDialog"),
    metadataForm: document.querySelector("#metadataForm"),
    metadataEyebrow: document.querySelector("#metadataEyebrow"),
    metadataTitle: document.querySelector("#metadataTitle"),
    metadataIntro: document.querySelector("#metadataIntro"),
    adminArea: document.querySelector("#adminArea"),
    adminPassword: document.querySelector("#adminPassword"),
    confirmMetadataBtn: document.querySelector("#confirmMetadataBtn"),
    closeMetadataBtn: document.querySelector("#closeMetadataBtn"),
    cancelMetadataBtn: document.querySelector("#cancelMetadataBtn"),
    toast: document.querySelector("#toast")
  };

  function showToast(message, type = "info") {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.dataset.type = type;
    elements.toast.classList.add("show");
    toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 4500);
  }

  function setStatus(message, type = "info") {
    elements.status.textContent = message;
    elements.status.dataset.type = type;
  }

  function initializeTheme() {
    const saved = localStorage.getItem("portfolio-theme");
    const preferred = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    const theme = saved || preferred;
    document.documentElement.dataset.theme = theme;
    elements.themeToggle.textContent = theme === "light" ? "☀" : "☾";
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("portfolio-theme", next);
    elements.themeToggle.textContent = next === "light" ? "☀" : "☾";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function utf8ToBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function buildPreview(code, language, title = "Prévia do projeto") {
    if (language === "html") return code;

    const safeTitle = escapeHtml(title);
    const baseStart = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>
      *{box-sizing:border-box}body{margin:0;min-height:100vh;padding:30px;font-family:Arial,sans-serif;background:#0f172a;color:#f8fafc}.page{max-width:1000px;margin:auto}.source{padding:24px;border:1px solid #334155;border-radius:18px;background:#020617;box-shadow:0 25px 70px rgba(0,0,0,.35)}pre{margin:0;white-space:pre-wrap;word-break:break-word;font:14px/1.65 Consolas,monospace;color:#dbeafe}.console{min-height:180px;color:#bbf7d0}.hint{color:#94a3b8}.demo-card{max-width:520px;margin:60px auto;padding:32px;border-radius:22px;background:white;color:#111827;box-shadow:0 24px 60px rgba(15,23,42,.18)}button{padding:12px 18px;border:0;border-radius:10px;background:#6d28d9;color:white;font-weight:bold}
    </style></head><body><main class="page">`;
    const baseEnd = "</main></body></html>";

    if (language === "css") {
      const safeCss = code.replace(/<\/style/gi, "<\\/style");
      return `${baseStart}<style>${safeCss}</style><section class="demo-card"><h1>Prévia do CSS</h1><p>Use classes como <strong>.demo-card</strong> ou estilize os elementos desta página.</p><button>Botão de exemplo</button></section>${baseEnd}`;
    }

    if (language === "javascript") {
      const encoded = utf8ToBase64(code);
      return `${baseStart}<h1>Console JavaScript</h1><p class="hint">A execução acontece dentro desta prévia isolada.</p><section class="source"><pre id="console" class="console">Executando…</pre></section><script>
        const output=document.getElementById('console');const lines=[];
        const format=value=>typeof value==='object'?JSON.stringify(value,null,2):String(value);
        ['log','info','warn','error'].forEach(type=>{const original=console[type];console[type]=(...args)=>{lines.push(args.map(format).join(' '));output.textContent=lines.join('\\n');original(...args)}});
        window.onerror=(message,source,line,column)=>{lines.push('Erro: '+message+' ('+line+':'+column+')');output.textContent=lines.join('\\n')};
        try{const source=new TextDecoder().decode(Uint8Array.from(atob('${encoded}'),c=>c.charCodeAt(0)));new Function(source)();if(!lines.length)output.textContent='Código executado sem saída no console.'}catch(error){output.textContent='Erro: '+error.message}
      <\/script>${baseEnd}`;
    }

    return `${baseStart}<h1>Código ${escapeHtml(language.toUpperCase())}</h1><p class="hint">Esta linguagem não é executada diretamente pelo navegador. Abaixo está a visualização do código-fonte.</p><section class="source"><pre>${escapeHtml(code)}</pre></section>${baseEnd}`;
  }

  function detectLanguage(text) {
    const value = text.trim();
    if (/<!doctype html|<html[\s>]|<body[\s>]|<div[\s>]/i.test(value)) return "html";
    if (/public\s+class\s+\w+|public\s+static\s+void\s+main/i.test(value)) return "java";
    if (/^\s*(def\s+\w+|from\s+\w+\s+import|import\s+\w+|print\s*\()/m.test(value)) return "python";
    if (/^\s*[\[{][\s\S]*[\]}]\s*$/.test(value)) {
      try { JSON.parse(value); return "json"; } catch { /* continue */ }
    }
    if (/[.#]?[a-z][\w-]*\s*\{[\s\S]*:[\s\S]*\}/i.test(value) && !/function|const |let |var /.test(value)) return "css";
    if (/\b(const|let|var|function|console\.)\b/.test(value)) return "javascript";
    return elements.language.value;
  }

  function updateEditorMetrics() {
    const value = elements.editor.value;
    const lineCount = Math.max(1, value.split("\n").length);
    elements.lineNumbers.textContent = Array.from({ length: lineCount }, (_, index) => index + 1).join("\n");
    elements.codeInfo.textContent = `${lineCount} ${lineCount === 1 ? "linha" : "linhas"} · ${value.length} caracteres`;
    localStorage.setItem("portfolio-editor-draft", value);
    localStorage.setItem("portfolio-editor-language", elements.language.value);
  }

  function openPreview() {
    const code = elements.editor.value.trim();
    if (!code) {
      showToast("Cole algum código antes de visualizar.", "error");
      elements.editor.focus();
      return;
    }
    previewDocument = buildPreview(elements.editor.value, elements.language.value, currentProject?.title || "Prévia do projeto");
    elements.previewFrame.srcdoc = previewDocument;
    elements.previewLanguage.textContent = elements.language.options[elements.language.selectedIndex].text;
    elements.previewDialog.showModal();
  }

  async function pasteCode() {
    try {
      if (!navigator.clipboard?.readText) throw new Error("clipboard-unavailable");
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return showToast("A área de transferência está vazia.", "error");
      elements.editor.value = text;
      elements.language.value = detectLanguage(text);
      updateEditorMetrics();
      showToast("Código colado com sucesso.", "success");
    } catch {
      elements.editor.focus();
      showToast("O navegador bloqueou a leitura automática. Toque e segure no editor para colar, ou use Ctrl+V.", "error");
    }
  }

  function fillMetadataForm(project = {}) {
    const form = elements.metadataForm.elements;
    form.title.value = project.title || "";
    form.id.value = project.id || "";
    form.description.value = project.description || "";
    form.category.value = project.category || "Projetos pessoais";
    form.technologies.value = (project.technologies || defaultTechnologies()).join(", ");
    form.github.value = project.github || "";
    form.status.value = project.status || (saveMode === "publish" ? "online" : "development");
    form.color.value = /^#[0-9a-f]{6}$/i.test(project.color || "") ? project.color : "#6d5dfc";
    form.featured.checked = Boolean(project.featured);
  }

  function defaultTechnologies() {
    const labels = { html: ["HTML", "CSS", "JavaScript"], css: ["CSS"], javascript: ["JavaScript"], java: ["Java"], json: ["JSON"], python: ["Python"], text: [] };
    return labels[elements.language.value] || [];
  }

  function openMetadata(mode) {
    if (!elements.editor.value.trim()) {
      showToast("Cole o código completo antes de cadastrar o projeto.", "error");
      elements.editor.focus();
      return;
    }
    saveMode = mode;
    const publishing = mode === "publish";
    elements.adminArea.hidden = !publishing;
    elements.metadataEyebrow.textContent = editingId ? "Atualizar projeto" : "Cadastrar projeto";
    elements.metadataTitle.textContent = publishing ? "Publicar no GitHub e na Vercel" : "Salvar em Meus Projetos";
    elements.metadataIntro.textContent = publishing
      ? "O código será enviado ao repositório configurado. A Vercel fará a publicação após o commit."
      : "O projeto ficará salvo neste navegador e aparecerá imediatamente na página inicial.";
    elements.confirmMetadataBtn.textContent = publishing ? "Publicar projeto" : "Salvar projeto";
    fillMetadataForm(currentProject || {});
    elements.adminPassword.value = sessionStorage.getItem("portfolio-admin-password") || "";
    elements.metadataDialog.showModal();
  }

  function collectProject() {
    const data = new FormData(elements.metadataForm);
    const title = String(data.get("title") || "").trim();
    const id = storage.slugify(data.get("id") || editingId || title);
    return storage.normalizeProject({
      id,
      title,
      description: String(data.get("description") || "").trim(),
      category: String(data.get("category") || "Projetos pessoais").trim(),
      technologies: String(data.get("technologies") || "").split(",").map(item => item.trim()).filter(Boolean),
      github: String(data.get("github") || "").trim(),
      status: data.get("status"),
      featured: data.get("featured") === "on",
      color: data.get("color"),
      symbol: title.slice(0, 2).toUpperCase(),
      language: elements.language.value,
      managed: true,
      live: `project.html?id=${encodeURIComponent(id)}`
    });
  }

  async function saveProject(event) {
    event.preventDefault();
    if (!elements.metadataForm.reportValidity()) return;
    const project = collectProject();
    if (!project.id) return showToast("Informe um nome válido para o projeto.", "error");

    elements.confirmMetadataBtn.disabled = true;
    const originalLabel = elements.confirmMetadataBtn.textContent;
    elements.confirmMetadataBtn.textContent = saveMode === "publish" ? "Publicando…" : "Salvando…";

    try {
      if (saveMode === "local") {
        const saved = storage.saveProject(project, elements.editor.value);
        currentProject = saved;
        editingId = saved.id;
        history.replaceState(null, "", `html.html?edit=${encodeURIComponent(saved.id)}`);
        elements.pageTitle.textContent = `Editando ${saved.title}`;
        setStatus("Salvo neste navegador", "success");
        elements.metadataDialog.close();
        showToast("Projeto salvo. Ele já aparece em Meus Projetos neste navegador.", "success");
        return;
      }

      const password = elements.adminPassword.value;
      if (!password) throw new Error("Digite a senha administrativa configurada na Vercel.");
      sessionStorage.setItem("portfolio-admin-password", password);

      const response = await fetch("/api/github-project", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Password": password },
        body: JSON.stringify({ project, code: elements.editor.value })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível publicar o projeto.");

      currentProject = storage.saveProject(result.project, elements.editor.value);
      editingId = result.project.id;
      history.replaceState(null, "", `html.html?edit=${encodeURIComponent(editingId)}`);
      elements.pageTitle.textContent = `Editando ${result.project.title}`;
      setStatus("Commit enviado ao GitHub", "success");
      elements.metadataDialog.close();
      showToast("Projeto enviado ao GitHub. Com a Vercel conectada, a nova versão será publicada automaticamente.", "success");
    } catch (error) {
      showToast(error.message || "Falha ao salvar o projeto.", "error");
      setStatus("Não foi possível salvar", "warning");
    } finally {
      elements.confirmMetadataBtn.disabled = false;
      elements.confirmMetadataBtn.textContent = originalLabel;
    }
  }

  async function loadRemoteProjects() {
    try {
      const response = await fetch(`projects.json?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return [];
      const value = await response.json();
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  async function initializeProject() {
    if (!editingId) {
      const draft = localStorage.getItem("portfolio-editor-draft");
      elements.editor.value = draft || examples.html;
      elements.language.value = localStorage.getItem("portfolio-editor-language") || "html";
      setStatus("Novo projeto", "info");
      updateEditorMetrics();
      return;
    }

    const remote = await loadRemoteProjects();
    const projects = storage.mergeProjects(window.PROJECTS || [], remote, storage.getProjects());
    currentProject = projects.find(project => project.id === editingId) || null;

    if (currentProject) {
      elements.language.value = currentProject.language || "html";
      elements.pageTitle.textContent = `Editando ${currentProject.title}`;
      document.title = `${currentProject.title} | Editor`;
    }

    const localCode = storage.getCode(editingId);
    if (localCode) {
      elements.editor.value = localCode;
      setStatus("Código carregado do navegador", "success");
    } else if (currentProject?.language === "html" && /^\/?projetos\//.test(currentProject.live || "")) {
      try {
        const response = await fetch(currentProject.live, { cache: "no-store" });
        if (response.ok) {
          elements.editor.value = await response.text();
          setStatus("Versão online carregada", "success");
        }
      } catch { /* use empty editor */ }
    }

    if (!elements.editor.value) {
      elements.editor.value = "";
      setStatus("Cole o novo código completo", "warning");
      showToast("Projeto aberto para edição. Cole o código completo atualizado e salve ou publique novamente.");
    }
    updateEditorMetrics();
  }

  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.pasteBtn.addEventListener("click", pasteCode);
  elements.exampleBtn.addEventListener("click", () => {
    elements.editor.value = examples[elements.language.value] || examples.text;
    updateEditorMetrics();
    showToast("Exemplo carregado.", "success");
  });
  elements.clearBtn.addEventListener("click", () => {
    elements.editor.value = "";
    updateEditorMetrics();
    elements.editor.focus();
  });
  elements.previewBtn.addEventListener("click", openPreview);
  elements.closePreviewBtn.addEventListener("click", () => elements.previewDialog.close());
  elements.openNewTabBtn.addEventListener("click", () => {
    if (!previewDocument) return;
    const url = URL.createObjectURL(new Blob([previewDocument], { type: "text/html" }));
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
  elements.saveLocalBtn.addEventListener("click", () => openMetadata("local"));
  elements.publishBtn.addEventListener("click", () => openMetadata("publish"));
  elements.closeMetadataBtn.addEventListener("click", () => elements.metadataDialog.close());
  elements.cancelMetadataBtn.addEventListener("click", () => elements.metadataDialog.close());
  elements.metadataForm.addEventListener("submit", saveProject);
  elements.language.addEventListener("change", updateEditorMetrics);
  elements.editor.addEventListener("input", updateEditorMetrics);
  elements.editor.addEventListener("scroll", () => { elements.lineNumbers.scrollTop = elements.editor.scrollTop; });
  elements.editor.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const start = elements.editor.selectionStart;
    const end = elements.editor.selectionEnd;
    elements.editor.value = `${elements.editor.value.slice(0, start)}  ${elements.editor.value.slice(end)}`;
    elements.editor.selectionStart = elements.editor.selectionEnd = start + 2;
    updateEditorMetrics();
  });

  initializeTheme();
  initializeProject();
})();
