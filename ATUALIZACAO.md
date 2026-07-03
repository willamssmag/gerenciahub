# Atualização 4.0 — projetos isolados por pasta

## Mudanças principais

- A Central de Projetos usa arquivos próprios em `public/portfolio/`.
- O GerenciaHub permanece completo em `public/gerenciahub/`.
- O Visualizador foi movido para `public/visualizador/`.
- Cada projeto publicado recebe `public/projetos/<id>/`.
- Cada pasta publicada possui seu próprio `project.json`.
- A lista da homepage é montada lendo os manifestos individuais pela rota `/api/portfolio-projects`.
- Atualizações não modificam mais `public/projects.json`.
- O identificador do projeto fica bloqueado na edição para evitar troca acidental de pasta.

## Arquivos alterados por uma atualização

Somente:

```text
public/projetos/<id>/index.html
public/projetos/<id>/source.txt
public/projetos/<id>/project.json
```

## Compatibilidade

Os endereços `/html` e `/html.html` continuam abrindo o Visualizador.
O arquivo antigo `public/projects.json`, quando presente, é consultado apenas para compatibilidade e nunca é regravado.
