const BaseAgent = require("./base");
const tasks = require("../tasks");

class TaskAgent extends BaseAgent {

    constructor() {
        super("Task");
    }

    async ask(prompt) {

        this.log("Processing request...");
        this.remember(prompt);

        const text = prompt.toLowerCase();

        if (text.startsWith("create task")) {

            const title = prompt.substring(11).trim();

            if (!title) {
                return "Task title is required.";
            }

            return tasks.create({
                title
            });

        }

        if (text === "list tasks") {
            return tasks.list();
        }

        if (text === "count tasks") {
            return tasks.count();
        }

        if (text === "clear tasks") {
            tasks.clear();
            return "All tasks cleared.";
        }

        return "Task agent could not understand the request.";
    }

}

module.exports = TaskAgent;