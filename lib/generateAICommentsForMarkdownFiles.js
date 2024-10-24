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
exports.getComments = void 0;
exports.checkReviewItem = checkReviewItem;
exports.checkReview = checkReview;
exports.generateAICommentsForDiff = generateAICommentsForDiff;
exports.generateAICommentsForMarkdownFiles = generateAICommentsForMarkdownFiles;
const openai_1 = __importDefault(require("openai"));
function createPrompt(diff) {
    return `Your task is to review pull requests on a technical blog. Instructions:
- Do not explain what you're doing.
- Provide the response in following JSON format, And return only the json:

[
    {
        "comment": "<comment targeting one line>",
        "lineNumber": <line_number>,
        "suggestion": "<The text to replace the existing line with. Leave empty, when no suggestion is applicable, must be related to the comment>",
        "originalLine": "<The content of the line the comment apply to>"
    }
]

- returned result must only contains valid json
- Propose change to text and code.
- Fix typo, grammar and spelling
- ensure short sentence
- ensure one idea per sentence
- simplify complex sentence.
- No more than one comment per line
- One comment can address several issues
- Provide comments and suggestions ONLY if there is something to improve or fix, otherwise return an empty array.

Git diff of the article to review:

\`\`\`diff
${diff}
\`\`\``;
}
const getComments = (result, path) => __awaiter(void 0, void 0, void 0, function* () {
    const comments = result.map((item) => ({
        line: item.lineNumber,
        path,
        body: `${item.comment}${item.suggestion
            ? `
\`\`\`suggestion
${item.suggestion}
\`\`\``
            : ""}`,
    }));
    return comments;
});
exports.getComments = getComments;
function getAIResponse(prompt, model, apiKey) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const openai = new openai_1.default({
            apiKey,
        });
        const queryConfig = {
            model,
            temperature: 0.2,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        };
        try {
            const response = yield openai.chat.completions.create(Object.assign(Object.assign({}, queryConfig), { response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "review-comments",
                        schema: {
                            type: "object",
                            properties: {
                                comments: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            comment: { type: "string" },
                                            suggestion: { type: "string" },
                                            originalLine: { type: "string" },
                                            lineNumber: { type: "number" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                }, messages: [
                    {
                        role: "system",
                        content: prompt,
                    },
                ] }));
            const res = ((_b = (_a = response.choices[0].message) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.trim().replace(/^```json/g, "").replace(/```$/g, "")) || "[]";
            try {
                return JSON.parse(res).comments;
            }
            catch (error) {
                console.log("Could not parse the prompt result:", res);
                return [];
            }
        }
        catch (error) {
            console.error("Error:", error);
            return [];
        }
    });
}
function checkReviewItem(reviewItem, diff) {
    const diffLines = diff.split("\n");
    const realLineNumber = diffLines.findIndex((line) => line.includes(reviewItem.originalLine));
    if (realLineNumber === -1) {
        console.log("Could not locate target line for:", reviewItem);
        return null;
    }
    if (realLineNumber + 1 === reviewItem.lineNumber) {
        return reviewItem;
    }
    return Object.assign(Object.assign({}, reviewItem), { lineNumber: realLineNumber });
}
function checkReview(review, diff) {
    return review
        .map((reviewItem) => checkReviewItem(reviewItem, diff))
        .filter((v) => v !== null);
}
function generateAICommentsForDiff(_a) {
    return __awaiter(this, arguments, void 0, function* ({ diff, path, apiKey, model, }) {
        const prompt = createPrompt(diff);
        const aiResponse = yield getAIResponse(prompt, model, apiKey);
        const checkedReview = checkReview(aiResponse, diff);
        return yield (0, exports.getComments)(checkedReview, path);
    });
}
function generateAICommentsForMarkdownFiles(_a) {
    return __awaiter(this, arguments, void 0, function* ({ parsedDiff, apiKey, model, }) {
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
                const newComments = yield generateAICommentsForDiff({
                    apiKey,
                    diff,
                    model,
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
