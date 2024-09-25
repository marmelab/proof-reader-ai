import fs from "fs";
import path from "path";
import { getComments } from "./getReviewComments";

const article = fs
  .readFileSync(path.resolve(__dirname, "./article.diff"))
  .toString();

getComments(article).then(console.log);
