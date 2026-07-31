const helpCommand = require("../commands/help");
const projectCommand = require("../commands/project");
const workspaceCommand = require("../commands/workspace");
const scanCommand = require("../commands/scan");
const analyzeCommand = require("../commands/analyze");
const findCommand = require("../commands/find");
const openCommand = require("../commands/open");
const planCommand = require("../commands/plan");
const exitCommand = require("../commands/exit");

function routeCommand(command, context) {

    context.command = command;

    const input = command.trim();

    if (!input) {
        return true;
    }

    const cmd = input.split(/\s+/)[0].toLowerCase();

    switch (cmd) {

        case "help":
            helpCommand(context);
            return true;

        case "project":
            projectCommand(context);
            return true;

        case "workspace":
            workspaceCommand(context);
            return true;

        case "scan":
            scanCommand(context);
            return true;

        case "analyze":
            analyzeCommand(context);
            return true;

        case "find":
            findCommand(context);
            return true;

        case "open":
            openCommand(context);
            return true;

        case "plan":
            planCommand(context);
            return true;

        case "exit":
            exitCommand(context);
            return false;

        case "":
            return true;

        default:

            console.log("");
            console.log("Unknown command.");
            console.log("Type 'help' to list available commands.");
            console.log("");

            return true;

    }

}

module.exports = {
    routeCommand
};