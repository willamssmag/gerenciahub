# Atualização para o GitHub File Manager 2.1

A versão 2.1 adiciona upload múltiplo, seleção de pastas e arrastar/soltar. Ela usa as mesmas variáveis de ambiente e a mesma OAuth App das versões anteriores.

## Atualizar pelo GitHub

1. Faça backup do repositório atual ou crie uma branch de segurança.
2. Extraia o ZIP da versão 2.1.
3. Substitua os arquivos do projeto pelos arquivos do ZIP.
4. Não envie seu arquivo `.env` nem segredos ao GitHub.
5. Confirme e envie:

```powershell
git add .
git commit -m "Atualiza GitHub File Manager para versão 2.1"
git push
```

A Vercel deverá iniciar um novo deployment automaticamente.

## Variáveis da Vercel

Não há novas variáveis obrigatórias. Continue usando:

```text
SESSION_SECRET
APP_URL
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_OAUTH_SCOPE=repo read:user
```

## Permissões

No login OAuth, `repo read:user` cobre o upload e os commits.

Em Personal Access Token fine-grained, confirme:

- Contents: Read and write.
- Pull requests: Read and write.
- Administration: Read and write, apenas para criar repositórios.

## Verificação após o deploy

1. Abra `/api/health` e confira `"ok": true`.
2. Entre com sua conta do GitHub.
3. Abra um repositório e clique em **Upload múltiplo**.
4. Selecione vários arquivos.
5. Selecione uma pasta completa e confira se as subpastas aparecem na fila.
6. Arraste uma pasta sobre a lista de arquivos.
7. Confirme o upload e verifique que todos os itens entraram no mesmo commit.
8. Tente enviar um nome já existente sem marcar substituição e confira o aviso de conflito.

## Observação sobre pastas vazias

O GitHub usa Git, que não registra diretórios sem arquivos. Para criar uma pasta aparentemente vazia, coloque nela um arquivo `.gitkeep`.
