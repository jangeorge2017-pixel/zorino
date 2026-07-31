const readline = require("readline");

const { routeCommand } = require("./router");
const { getWorkspace } = require("../workspace/current");

function startEngine() {

    const workspace = getWorkspace();

    console.clear();

    console.log("");
    console.log("========================================");
    console.log("             CAI ENGINE v1");
    console.log("========================================");
    console.log("");

    console.log("Workspace :", workspace.root);
    console.log("Project   :", workspace.name);
    console.log("Status    : Ready");
    console.log("");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    prompt();

    function prompt() {

        rl.question("CAI> ", (command) => {

            const shouldContinue = routeCommand(command, {
                workspace,
                rl
            });

            if (shouldContinue) {
                prompt();
            }

        });

    }

}

module.exports = {
    startEngine
};