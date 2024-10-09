"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const generateAICommentsForMarkdownFiles_1 = require("./generateAICommentsForMarkdownFiles");
const article = fs_1.default
    .readFileSync(path_1.default.resolve(__dirname, "./article.diff"))
    .toString();
(0, generateAICommentsForMarkdownFiles_1.generateAICommentsForDiff)({
    diff: article,
    path: "article.md",
    model: "gpt-3.5-turbo",
    apiKey: process.env.OPENAI_API_KEY,
}).then(console.log);
