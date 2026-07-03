(function () {
  "use strict";

  const PROJECTS_KEY = "portfolio-local-projects-v2";
  const CODE_PREFIX = "portfolio-project-code-v2:";

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  }

  function safeParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function getProjects() {
    const value = safeParse(localStorage.getItem(PROJECTS_KEY), []);
    return Array.isArray(value) ? value : [];
  }

  function setProjects(projects) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }

  function normalizeProject(project) {
    const title = String(project?.title || "Projeto sem nome").trim();
    const id = slugify(project?.id || title) || `projeto-${Date.now()}`;
    const technologies = Array.isArray(project?.technologies)
      ? project.technologies.map(String).map(item => item.trim()).filter(Boolean)
      : String(project?.technologies || "")
          .split(",")
          .map(item => item.trim())
          .filter(Boolean);

    const managed = Boolean(project?.managed);
    const live = project?.live !== undefined && project?.live !== null
      ? String(project.live).trim()
      : (managed ? `/visualizador/project.html?id=${encodeURIComponent(id)}` : "");

    return {
      id,
      title,
      category: String(project?.category || "Projetos pessoais").trim(),
      description: String(project?.description || "Projeto cadastrado no meu portfólio.").trim(),
      technologies,
      github: String(project?.github || "").trim(),
      live,
      status: ["online", "development", "archived"].includes(project?.status) ? project.status : "development",
      featured: Boolean(project?.featured),
      symbol: String(project?.symbol || title.slice(0, 2).toUpperCase()).slice(0, 5),
      color: String(project?.color || "#6d5dfc"),
      language: String(project?.language || "html"),
      managed,
      folder: String(project?.folder || "").trim(),
      source: String(project?.source || "").trim(),
      published: Boolean(project?.published || project?.folder),
      updatedAt: project?.updatedAt || new Date().toISOString()
    };
  }

  function saveProject(project, code) {
    const normalized = normalizeProject(project);
    const projects = getProjects();
    const index = projects.findIndex(item => item.id === normalized.id);

    if (index >= 0) projects[index] = normalized;
    else projects.unshift(normalized);

    setProjects(projects);
    if (typeof code === "string") {
      localStorage.setItem(`${CODE_PREFIX}${normalized.id}`, code);
    }
    return normalized;
  }

  function getProject(id) {
    return getProjects().find(project => project.id === id) || null;
  }

  function getCode(id) {
    return localStorage.getItem(`${CODE_PREFIX}${id}`) || "";
  }

  function deleteProject(id) {
    setProjects(getProjects().filter(project => project.id !== id));
    localStorage.removeItem(`${CODE_PREFIX}${id}`);
  }

  function mergeProjects(...collections) {
    const map = new Map();
    collections.flat().filter(Boolean).forEach(project => {
      const normalized = normalizeProject(project);
      map.set(normalized.id, { ...(map.get(normalized.id) || {}), ...normalized });
    });
    return [...map.values()];
  }

  window.PortfolioStorage = {
    slugify,
    getProjects,
    getProject,
    getCode,
    saveProject,
    deleteProject,
    mergeProjects,
    normalizeProject
  };
})();
