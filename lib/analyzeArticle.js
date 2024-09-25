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
exports.analyzeArticle = analyzeArticle;
const openai_1 = __importDefault(require("openai"));
function createPrompt(diff) {
    return `Your task is to review pull requests on Marmelab technical blog. Instructions:
  - Do not explain what you're doing.
  - Provide the response in following JSON format (with no wrapping):
  
  [
      {
          "comment": "<comment targetting one line>",
          "lineNumber": <line_number>,
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
  ${diff}
  \`\`\`
  `;
}
const getComments = (result, path) => __awaiter(void 0, void 0, void 0, function* () {
    const comments = result.map((item) => ({
        line: item.lineNumber,
        path,
        body: `${item.comment}
    ${item.suggestion &&
            `
    \`\`\`suggestion
    ${item.suggestion}
    \`\`\``}
    `,
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
            max_tokens: 700,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        };
        try {
            const response = yield openai.chat.completions.create(Object.assign(Object.assign(Object.assign({}, queryConfig), (model === "gpt-4-1106-preview"
                ? { response_format: { type: "json_object" } }
                : {})), { messages: [
                    {
                        role: "system",
                        content: prompt,
                    },
                ] }));
            const res = ((_b = (_a = response.choices[0].message) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.trim()) || "[]";
            return JSON.parse(res);
        }
        catch (error) {
            console.error("Error:", error);
            return [];
        }
    });
}
function analyzeArticle(_a) {
    return __awaiter(this, arguments, void 0, function* ({ diff, path, apiKey, model, }) {
        const prompt = createPrompt(diff);
        const aiResponse = yield getAIResponse(prompt, model, apiKey);
        return yield (0, exports.getComments)(aiResponse, path);
    });
}
