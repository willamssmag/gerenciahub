/*
  Projetos exibidos na página inicial.
  Você pode acrescentar novos objetos nesta lista ou usar a página HTML para
  cadastrar projetos gerenciados pelo editor.
*/

window.PORTFOLIO_CONFIG = {
  name: "Meu Portfólio",
  brand: "Central de Projetos",
  description: "Uma página inicial para reunir, organizar e acessar rapidamente todos os meus projetos publicados.",
  githubProfile: "",
  linkedin: "",
  email: ""
};

window.PROJECTS = [
  {
    id: "gerenciahub",
    title: "GerenciaHub",
    category: "Ferramentas",
    description: "Gerenciador web para autenticar no GitHub, navegar por repositórios, editar arquivos, enviar pastas, criar branches e abrir Pull Requests.",
    technologies: ["Node.js", "Express", "GitHub API", "Vercel"],
    github: "",
    live: "/gerenciahub/",
    status: "online",
    featured: true,
    symbol: "GH",
    managed: false,
    color: "#6d5dfc"
  },
  {
    id: "visualizador-html",
    title: "Visualizador de Código",
    category: "Ferramentas",
    description: "Editor para colar código HTML, CSS, JavaScript, Java, Python e outros formatos, testar uma prévia e cadastrar novos projetos.",
    technologies: ["HTML", "CSS", "JavaScript"],
    github: "",
    live: "/html.html",
    status: "online",
    featured: true,
    symbol: "</>",
    managed: false,
    color: "#14b8a6"
  }
];
