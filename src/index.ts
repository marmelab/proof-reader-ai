import fs from "fs";
import path from "path";
import { analyzeArticle } from "./analyzeArticle";

const article = fs
  .readFileSync(path.resolve(__dirname, "./article.diff"))
  .toString();

analyzeArticle({
  diff: article,
  path: "article.md",
  model: "gpt-3.5-turbo",
  apiKey: process.env.OPENAI_API_KEY as string,
}).then(console.log);
