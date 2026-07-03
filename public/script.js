(() => {
  "use strict";

  const config = window.PORTFOLIO_CONFIG || {};
  const storage = window.PortfolioStorage;
  const defaultProjects = Array.isArray(window.PROJECTS) ? window.PROJECTS : [];
  let allProjects = storage.mergeProjects(defaultProjects, storage.getProjects());

  const state = { query: "", category: "Todos", status: "all" };

  const elements = {
    brandName: document.querySelector("#brandName"),
    footerName: document.querySelector("#footerName"),
    heroDescription: document.querySelector("#heroDescription"),
    githubProfileLink: document.querySelector("#githubProfileLink"),
    linkedinLink: document.querySelector("#linkedinLink"),
    emailLink: document.querySelector("#emailLink"),
    totalProjects: document.querySelector("#totalProjects"),
    onlineProjects: document.querySelector("#onlineProjects"),
    totalTechnologies: document.querySelector("#totalTechnologies"),
    featuredProjects: document.querySelector("#featuredProjects"),
    projectsGrid: document.querySelector("#projectsGrid"),
    categoryFilters: document.querySelector("#categoryFilters"),
    searchInput: document.querySelector("#searchInput"),
    statusFilter: document.querySelector("#statusFilter"),
    emptyState: document.querySelector("#emptyState"),
    template: document.querySelector("#projectCardTemplate"),
    themeToggle: document.querySelector("#themeToggle"),
    openAddProject: document.querySelector("#openAddProject"),
    featuredSection: document.querySelector("#destaques"),
    currentYear: document.querySelector("#currentYear")
  };

  const statusLabels = {
    online: "Online",
    development: "Em desenvolvimento",
    archived: "Arquivado"
  };

  function applyConfig() {
    document.title = `${config.brand || "Meu Portfólio"} | Projetos`;
    elements.brandName.textContent = config.brand || "Meu Portfólio";
    elements.footerName.textContent = config.name || config.brand || "Meu Portfólio";
    elements.heroDescription.textContent = config.description || "Minha central de projetos.";
    if (config.githubProfile) elements.githubProfileLink.href = config.githubProfile;
    else elements.githubProfileLink.hidden = true;
    if (config.linkedin) elements.linkedinLink.href = config.linkedin;
    else elements.linkedinLink.hidden = true;
    if (config.email) elements.emailLink.href = `mailto:${config.email}`;
    else elements.emailLink.hidden = true;
    elements.currentYear.textContent = new Date().getFullYear();
  }

  function updateStats() {
    const technologies = new Set(allProjects.flatMap(project => project.technologies || []));
    elements.totalProjects.textContent = allProjects.length;
    elements.onlineProjects.textContent = allProjects.filter(project => project.status === "online").length;
    elements.totalTechnologies.textContent = technologies.size;
  }

  function resolveUrl(value) {
    if (!value) return "";
    try { return new URL(value, location.href).href; }
    catch { return value; }
  }

  function createProjectCard(project) {
    const fragment = elements.template.content.cloneNode(true);
    const card = fragment.querySelector(".project-card");
    const cover = fragment.querySelector(".project-cover");
    const category = fragment.querySelector(".project-category");
    const status = fragment.querySelector(".project-status");
    const symbol = fragment.querySelector(".project-symbol");
    const title = fragment.querySelector("h3");
    const description = fragment.querySelector(".project-description");
    const technologyList = fragment.querySelector(".technology-list");
    const githubLink = fragment.querySelector(".github-link");
    const liveLink = fragment.querySelector(".live-link");
    const editLink = fragment.querySelector(".edit-link");

    card.dataset.projectId = project.id;
    card.classList.toggle("is-featured", Boolean(project.featured));
    cover.style.setProperty("--project-color", project.color || "#7566ff");
    category.textContent = project.category || "Projeto";
    status.textContent = statusLabels[project.status] || "Projeto";
    symbol.textContent = project.symbol || project.title?.slice(0, 2).toUpperCase() || "<>";
    title.textContent = project.title || "Projeto sem nome";
    description.textContent = project.description || "Sem descrição cadastrada.";

    (project.technologies || []).forEach(technology => {
      const badge = document.createElement("span");
      badge.textContent = technology;
      technologyList.appendChild(badge);
    });

    if (project.github) githubLink.href = resolveUrl(project.github);
    else githubLink.hidden = true;

    if (project.live) liveLink.href = resolveUrl(project.live);
    else liveLink.hidden = true;

    if (project.managed) {
      editLink.href = `html.html?edit=${encodeURIComponent(project.id)}`;
      editLink.setAttribute("aria-label", `Editar ${project.title}`);
    } else {
      editLink.hidden = true;
    }
    return fragment;
  }

  function renderFeatured() {
    const featured = allProjects.filter(project => project.featured).slice(0, 4);
    elements.featuredProjects.replaceChildren();
    elements.featuredSection.hidden = featured.length === 0;
    featured.forEach(project => elements.featuredProjects.appendChild(createProjectCard(project)));
  }

  function getFilteredProjects() {
    const query = state.query.toLowerCase();
    return allProjects.filter(project => {
      const searchable = [project.title, project.description, project.category, ...(project.technologies || [])].join(" ").toLowerCase();
      return searchable.includes(query)
        && (state.category === "Todos" || project.category === state.category)
        && (state.status === "all" || project.status === state.status);
    });
  }

  function renderProjects() {
    const projects = getFilteredProjects();
    elements.projectsGrid.replaceChildren();
    elements.emptyState.hidden = projects.length > 0;
    projects.forEach(project => elements.projectsGrid.appendChild(createProjectCard(project)));
  }

  function renderCategoryFilters() {
    const categories = ["Todos", ...new Set(allProjects.map(project => project.category).filter(Boolean))];
    if (!categories.includes(state.category)) state.category = "Todos";
    elements.categoryFilters.replaceChildren();
    categories.forEach(category => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `filter-button${category === state.category ? " active" : ""}`;
      button.textContent = category;
      button.addEventListener("click", () => {
        state.category = category;
        renderCategoryFilters();
        renderProjects();
      });
      elements.categoryFilters.appendChild(button);
    });
  }

  function renderAll() {
    updateStats();
    renderFeatured();
    renderCategoryFilters();
    renderProjects();
  }

  function initializeTheme() {
    const savedTheme = localStorage.getItem("portfolio-theme");
    const preferredTheme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    const theme = savedTheme || preferredTheme;
    document.documentElement.dataset.theme = theme;
    elements.themeToggle.textContent = theme === "light" ? "☀" : "☾";
  }

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("portfolio-theme", nextTheme);
    elements.themeToggle.textContent = nextTheme === "light" ? "☀" : "☾";
  }

  async function loadPublishedProjects() {
    try {
      const response = await fetch(`projects.json?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const projects = await response.json();
      if (!Array.isArray(projects)) return;
      allProjects = storage.mergeProjects(defaultProjects, projects, storage.getProjects());
      renderAll();
    } catch {
      // O site continua funcionando com os projetos padrão e locais.
    }
  }

  elements.searchInput.addEventListener("input", event => {
    state.query = event.target.value.trim();
    renderProjects();
  });
  elements.statusFilter.addEventListener("change", event => {
    state.status = event.target.value;
    renderProjects();
  });
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.openAddProject.addEventListener("click", () => { location.href = "html.html"; });
  window.addEventListener("storage", event => {
    if (!event.key?.startsWith("portfolio-")) return;
    allProjects = storage.mergeProjects(defaultProjects, storage.getProjects());
    renderAll();
  });

  initializeTheme();
  applyConfig();
  renderAll();
  loadPublishedProjects();
})();
