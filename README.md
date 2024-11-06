# AI blog article reviewer

AI blog article reviewer is a GitHub Action using OpenAI's GPT-4 API to provide feedback and suggestions on your blog article pull requests. It review all mdx files in your pull request.

# Setup (once the action is published)

To use the action you need to add your open api key as a github secrets named OPEN_API_KEY [see here](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)

Then you need to create a new github workflow, for example:

```yml
# .github/workflows/proof-reader.yml
name: AI Code Reviewer

on:
  pull_request:
    types:
      - opened
      - synchronize
permissions: write-all
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v3

      - name: Proof Reader AI Action
        uses: marmelab/proof-reader-ai@main
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} # The GITHUB_TOKEN is there by default so you just need to keep it like it is and not necessarily need to add it as secret as it will throw an error. [More Details](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#about-the-github_token-secret)
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          OPENAI_API_MODEL: "gpt-4o-mini" # Optional: defaults to "gpt-4o-mini" do not support model prior to 4
```
