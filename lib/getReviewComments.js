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
const openai_1 = __importDefault(require("openai"));
const client = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
const getComments = (article) => __awaiter(void 0, void 0, void 0, function* () {
    const chatCompletion = yield client.chat.completions.create({
        messages: [
            {
                role: "user",
                content: `Your task is to review pull requests on Marmelab technical blog. Instructions:
- Do not explain what you're doing.
- Provide the response in following JSON format (with no wrapping):

  [
    {
      "comment": "<comment targetting one line>",
      "lineNumber": "<line_number>",
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
${article}
\`\`\``,
            },
        ],
        model: "gpt-3.5-turbo",
    });
    console.log(chatCompletion.choices[0].message.content);
    const result = JSON.parse(chatCompletion.choices[0].message.content);
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
});
exports.getComments = getComments;
