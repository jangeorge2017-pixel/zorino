const prompts = require("../prompts");

class PromptReader {

    read(name) {

        const prompt = prompts.get(name);

        if (!prompt) {
            throw new Error("Prompt not found: " + name);
        }

        return prompt;

    }

    exists(name) {
        return prompts.exists(name);
    }

    list() {
        return prompts.list();
    }

}

module.exports = new PromptReader();