"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const core = __importStar(require("@actions/core"));
const openai_1 = __importDefault(require("openai"));
// eslint-disable-next-line import/no-unresolved
const rest_1 = require("@octokit/rest");
const parse_diff_1 = __importDefault(require("parse-diff"));
const minimatch_1 = require("minimatch");
const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
const OPENAI_API_KEY = core.getInput("OPENAI_API_KEY");
const OPENAI_API_MODEL = core.getInput("OPENAI_API_MODEL");
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
function analyzeCode(parsedDiff) {
    return __awaiter(this, void 0, void 0, function* () {
        const comments = [];
        for (const file of parsedDiff) {
            if (file.to === "/dev/null")
                continue; // Ignore deleted files
            for (const chunk of file.chunks) {
                const prompt = createPrompt(file, chunk);
                const aiResponse = yield getAIResponse(prompt, chunk);
                if (aiResponse) {
                    const newComments = createComment(file, chunk, aiResponse);
                    if (newComments) {
                        comments.push(...newComments);
                    }
                }
            }
        }
        return comments;
    });
}
function createPrompt(file, chunk) {
    return `Your task is to review pull requests on Marmelab technical blog. Instructions:
- Do not explain what you're doing.
- Provide the response in following JSON format (with no wrapping):

  [
    {
      "comment": "<comment targetting one line>",
      "originalText": "<The line to be replaced by the suggestion>",
      "suggestion": "<The text to replace the existing line with. Leave empty, when no suggestion is applicable, must be related to the comment>",
    }
  ]

- Propose change to text and code.
- Fix typo, grammar and orthograph
- ensure short sentence
- ensure one idea per sentence
- simplify complex sentence.

Git diff of the article to review:

\`\`\`diff
${chunk.content}
${chunk.changes
        // @ts-expect-error - ln and ln2 exists where needed
        .map((c) => `${c.ln ? c.ln : c.ln2} ${c.content}`)
        .join("\n")}
\`\`\`
`;
}
function getAIResponse(prompt, chunk) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const article = `${chunk.content}
${chunk.changes
            // @ts-expect-error - ln and ln2 exists where needed
            .map((c) => `${c.ln ? c.ln : c.ln2} ${c.content}`)
            .join("\n")}`;
        const queryConfig = {
            model: OPENAI_API_MODEL,
            temperature: 0.2,
            max_tokens: 700,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        };
        try {
            const response = yield openai.chat.completions.create(Object.assign(Object.assign(Object.assign({}, queryConfig), (OPENAI_API_MODEL === "gpt-4-1106-preview"
                ? { response_format: { type: "json_object" } }
                : {})), { messages: [
                    {
                        role: "system",
                        content: prompt,
                    },
                ] }));
            const res = ((_b = (_a = response.choices[0].message) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.trim()) || "[]";
            const result = JSON.parse(res);
            const articleLines = article
                .split("\n")
                .map((line, index) => ({ text: line, number: index + 1 }));
            const resultWithLineNumber = result.map((item) => {
                var _a, _b;
                const originalLine = (_a = item.originalText) === null || _a === void 0 ? void 0 : _a.split("\n");
                if (!item.originalText) {
                    console.error(`Incorrect originalText in item ${JSON.stringify(item)}`);
                    return item;
                }
                const position = (_b = articleLines.find(({ text }) => text.includes(originalLine))) === null || _b === void 0 ? void 0 : _b.number;
                if (!position) {
                    console.error(`Could not find position for item ${JSON.stringify(item)}`);
                    return item;
                }
                return Object.assign(Object.assign({}, item), { position });
            });
            const comments = resultWithLineNumber
                .filter(({ position }) => position !== undefined)
                .map((item) => ({
                position: item.position,
                path: "",
                body: `${item.comment}
      ${item.suggestion &&
                    `
      \`\`\`suggestion
      ${item.suggestion}
      \`\`\``}
      `,
            }));
            return comments;
        }
        catch (error) {
            console.error("Error:", error);
            return null;
        }
    });
}
function createComment(file, chunk, aiResponses) {
    return aiResponses.flatMap((aiResponse) => {
        if (!file.to) {
            return [];
        }
        return {
            body: aiResponse.reviewComment,
            path: file.to,
            line: Number(aiResponse.lineNumber),
        };
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
        var _a;
        const prDetails = yield getPRDetails();
        let diff;
        const eventData = JSON.parse((0, fs_1.readFileSync)((_a = process.env.GITHUB_EVENT_PATH) !== null && _a !== void 0 ? _a : "", "utf8"));
        if (eventData.action === "opened") {
            diff = yield getDiff(prDetails.owner, prDetails.repo, prDetails.pull_number);
        }
        else if (eventData.action === "synchronprocessize") {
            const newBaseSha = eventData.before;
            const newHeadSha = eventData.after;
            const response = yield octokit.repos.compareCommits({
                headers: {
                    accept: "application/vnd.github.v3.diff",
                },
                owner: prDetails.owner,
                repo: prDetails.repo,
                base: newBaseSha,
                head: newHeadSha,
            });
            diff = String(response.data);
        }
        else {
            // eslint-disable-next-line no-console
            console.log("Unsupported event:", process.env.GITHUB_EVENT_NAME);
            return;
        }
        if (!diff) {
            // eslint-disable-next-line no-console
            console.log("No diff found");
            return;
        }
        const parsedDiff = (0, parse_diff_1.default)(diff);
        const filteredDiff = parsedDiff.filter((file) => {
            var _a;
            return (0, minimatch_1.minimatch)((_a = file.to) !== null && _a !== void 0 ? _a : "", ".mdx");
        });
        const comments = yield analyzeCode(filteredDiff);
        if (comments.length > 0) {
            yield createReviewComment(prDetails.owner, prDetails.repo, prDetails.pull_number, comments);
        }
    });
}
main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});
