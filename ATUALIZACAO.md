# Atualização para o GitHub File Manager 2.1.2

A versão 2.1.2 adiciona uma barra de pesquisa permanente dentro de cada repositório. Ela pesquisa arquivos e pastas em toda a branch selecionada, mesmo quando o usuário está navegando em uma subpasta.

## O que foi adicionado

- Barra visível abaixo do cabeçalho do repositório.
- Pesquisa por nome, extensão ou caminho completo.
- Resultados exibidos enquanto o usuário digita.
- Pesquisa em toda a branch selecionada, e não apenas na pasta aberta.
- Abertura direta do arquivo encontrado.
- Navegação para pastas encontradas.
- Teclas `↑`, `↓` e `Enter` para navegar pelos resultados.
- Tecla `Esc` para fechar a lista.
- Botão **Limpar**.
- Cache local do índice por repositório e branch.
- Proteção contra resultados de uma branch anterior durante trocas rápidas.
- A pesquisa rápida por `Ctrl + P` continua disponível.

## Atualizar pelo GitHub

1. Faça backup do repositório atual ou crie uma branch de segurança.
2. Extraia o ZIP da versão 2.1.2.
3. Substitua os arquivos do projeto pelos arquivos extraídos.
4. Não envie o arquivo `.env` nem segredos ao GitHub.
5. Confirme e envie:

```powershell
git add .
git commit -m "Adiciona barra de pesquisa de arquivos"
git push
```

A Vercel deverá iniciar um novo deployment automaticamente.

## Variáveis da Vercel

Não existem novas variáveis obrigatórias. Continue usando:

```text
SESSION_SECRET
APP_URL
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_OAUTH_SCOPE=repo read:user
```

## Como testar após o deploy

1. Abra um repositório com arquivos.
2. Na barra **Pesquisar arquivo ou pasta em todo o repositório**, digite parte de um nome, por exemplo `app`, `.html` ou `src/`.
3. Confira se a lista mostra o caminho completo.
4. Clique em um arquivo e confirme que a pasta correta é aberta e o arquivo aparece no editor.
5. Pesquise uma pasta e confirme que a navegação entra nela.
6. Troque de branch e confira que os resultados passam a representar a nova branch.
7. Teste as setas do teclado e pressione `Enter` para abrir o resultado selecionado.

## Observação

O índice da branch é armazenado temporariamente no navegador para tornar pesquisas seguintes mais rápidas. Depois de criar, excluir, mover, copiar ou enviar arquivos, o cache é invalidado automaticamente.
