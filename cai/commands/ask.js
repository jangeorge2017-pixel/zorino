const provider = require("../providers/provider");

module.exports = async function askCommand(context) {

    const prompt = context.command
        .replace(/^ask\s+/i, "")
        .trim();

    if (!prompt) {
        return "Usage: ask <your prompt>";
    }

    console.log("Thinking...\n");

    const response = await provider.ask(prompt);

    console.log(response);

    return response;

};