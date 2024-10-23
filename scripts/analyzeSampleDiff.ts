import fs from "fs";
import path from "path";
import { generateAICommentsForDiff } from "../src/generateAICommentsForMarkdownFiles";

const article = fs
  .readFileSync(path.resolve(__dirname, "./article.diff"))
  .toString();

generateAICommentsForDiff({
  diff: article,
  path: "article.md",
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY as string,
}).then(console.log);
