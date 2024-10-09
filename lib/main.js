"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const parse_diff_1 = __importDefault(require("parse-diff"));
const generateAICommentsForMarkdownFiles_1 = require("./generateAICommentsForMarkdownFiles");
const getGithubClient_1 = require("./getGithubClient");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL;
const githubCli = (0, getGithubClient_1.getGithubClient)(GITHUB_TOKEN);
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const prDetails = yield githubCli.getPRDetails();
        const diff = yield githubCli.getDiff(prDetails.owner, prDetails.repo, prDetails.pull_number);
        if (!diff) {
            console.log("No diff found");
            return;
        }
        const parsedDiff = (0, parse_diff_1.default)(diff);
        const filteredDiff = parsedDiff.filter((file) => {
            var _a;
            return /.mdx$/.test((_a = file.to) !== null && _a !== void 0 ? _a : "");
        });
        const comments = yield (0, generateAICommentsForMarkdownFiles_1.generateAICommentsForMarkdownFiles)({
            parsedDiff: filteredDiff,
            apiKey: OPENAI_API_KEY,
            model: OPENAI_API_MODEL,
        });
        if (comments.length > 0) {
            yield githubCli.createReviewComment(prDetails.owner, prDetails.repo, prDetails.pull_number, comments);
        }
    });
}
main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});
