# Automação do GitHub (Actions)

Estes arquivos precisam ficar em `.github/workflows/` para o GitHub rodar.
Na pasta do projeto, rode uma vez:

```bash
mkdir -p .github/workflows
git mv ci-github/build.yml .github/workflows/
git rm .github/workflows/azure-static-web-apps-blue-sand-0bbaa2010.yml   # deploy antigo para o Azure
git commit -m "Ativa build no GitHub Actions"
```

- `build.yml`: confere a cada push se o frontend compila.
