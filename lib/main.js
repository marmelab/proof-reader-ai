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
const fs_1 = require("fs");
const openai_1 = __importDefault(require("openai"));
// eslint-disable-next-line import/no-unresolved
const rest_1 = require("@octokit/rest");
const parse_diff_1 = __importDefault(require("parse-diff"));
const analyzeArticle_1 = require("./analyzeArticle");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // core.getInput("GITHUB_TOKEN");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // core.getInput("OPENAI_API_KEY");
const OPENAI_API_MODEL = "gpt-3.5-turbo";
const octokit = new rest_1.Octokit({ auth: GITHUB_TOKEN });
const openai = new openai_1.default({
    apiKey: OPENAI_API_KEY,
});
function getPRDetails() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const { repository, number } = JSON.parse((0, fs_1.readFileSync)(process.env.GITHUB_EVENT_PATH || "", "utf8"));
        const prResponse = yield octokit.pulls.get({
            owner: repository.owner.login,
            repo: repository.name,
            pull_number: number,
        });
        return {
            owner: repository.owner.login,
            repo: repository.name,
            pull_number: number,
            title: (_a = prResponse.data.title) !== null && _a !== void 0 ? _a : "",
            description: (_b = prResponse.data.body) !== null && _b !== void 0 ? _b : "",
        };
    });
}
function getDiff(owner, repo, pull_number) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield octokit.pulls.get({
            owner,
            repo,
            pull_number,
            mediaType: { format: "diff" },
        });
        // @ts-expect-error - response.data is a string
        return response.data;
    });
}
function analyzePR(parsedDiff) {
    return __awaiter(this, void 0, void 0, function* () {
        const comments = [];
        for (const file of parsedDiff) {
            if (file.to === "/dev/null")
                continue; // Ignore deleted files
            for (const chunk of file.chunks) {
                const diff = `${chunk.content}
${chunk.changes
                    // @ts-expect-error - ln and ln2 exists where needed
                    .map((c) => `${c.ln ? c.ln : c.ln2} ${c.content}`)
                    .join("\n")}`;
                const newComments = yield (0, analyzeArticle_1.analyzeArticle)({
                    apiKey: OPENAI_API_KEY,
                    diff,
                    model: OPENAI_API_MODEL,
                    path: file.to,
                });
                if (newComments && newComments.length > 0) {
                    comments.push(...newComments);
                }
            }
        }
        return comments;
    });
}
// eslint-disable-next-line no-unused-vars
function createReviewComment(owner, repo, pull_number, comments) {
    return __awaiter(this, void 0, void 0, function* () {
        yield octokit.pulls.createReview({
            owner,
            repo,
            pull_number,
            comments,
            event: "COMMENT",
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const prDetails = yield getPRDetails();
        let diff;
        diff = yield getDiff(prDetails.owner, prDetails.repo, prDetails.pull_number);
        if (!diff) {
            console.log("No diff found");
            return;
        }
        const parsedDiff = (0, parse_diff_1.default)(diff);
        console.log("parsedDiff", parsedDiff);
        const filteredDiff = parsedDiff.filter((file) => {
            var _a;
            console.log("file.to", file.to);
            return /.mdx$/.test((_a = file.to) !== null && _a !== void 0 ? _a : "");
        });
        console.log("filteredDiff", filteredDiff);
        const comments = yield analyzePR(filteredDiff);
        console.log("comments:", comments);
        if (comments.length > 0) {
            yield createReviewComment(prDetails.owner, prDetails.repo, prDetails.pull_number, comments);
        }
    });
}
main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});
