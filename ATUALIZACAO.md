# Atualização da versão atual para a 2.0

Esta versão usa as mesmas variáveis de ambiente e a mesma OAuth App da versão anterior.

## Atualizar pelo GitHub

1. Faça backup do repositório atual ou crie uma branch de segurança.
2. Extraia o ZIP da versão 2.0.
3. Substitua no repositório os arquivos:
   - `app.js`
   - `package.json`
   - `package-lock.json`
   - `README.md`
   - `public/index.html`
   - `public/app.js`
   - `public/styles.css`
4. Adicione a pasta `tests/` e este arquivo `ATUALIZACAO.md`.
5. Mantenha seu `.env` somente no computador; não envie segredos ao GitHub.
6. Confirme e envie:

```powershell
git add .
git commit -m "Atualiza GitHub File Manager para versão 2.0"
git push
```

A Vercel iniciará um novo deployment automaticamente.

## Variáveis da Vercel

Não existem novas variáveis obrigatórias. Continue usando:

```text
SESSION_SECRET
APP_URL
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_OAUTH_SCOPE=repo read:user
```

## Permissões

O login OAuth configurado com `repo read:user` já permite os novos recursos na conta autorizada.

Ao usar Personal Access Token fine-grained, confirme:

- Contents: Read and write.
- Pull requests: Read and write.
- Administration: Read and write, somente para criar repositórios.

## Verificação após o deploy

1. Abra `/api/health` e confira `"ok": true`.
2. Entre com o GitHub.
3. Teste a criação de uma branch.
4. Faça uma alteração pequena e abra um Pull Request.
5. Abra um arquivo e teste **Mover/copiar**.
6. Pressione `Ctrl + P` e teste a pesquisa rápida.
