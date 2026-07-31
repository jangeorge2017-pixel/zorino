const readline = require("readline");

const { orchestrate } = require("./orchestrator/orchestrator");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "CAI> "
});

let multilineMode = false;
let multilineBuffer = [];

console.log("");
console.log("CAI Started");
console.log("Type 'exit' to quit.");
console.log("Type '<<<' to begin a multi-line prompt.");
console.log("Type '>>>' to send it.");
console.log("");

rl.prompt();

rl.on("line", async (line) => {

    const input = line;

    if (multilineMode) {

        if (input.trim() === ">>>") {

            multilineMode = false;

            const command = multilineBuffer.join("\n").trim();

            multilineBuffer = [];

            if (!command) {
                rl.prompt();
                return;
            }

            try {

                await orchestrate(command);

            } catch (error) {

                console.error("");
                console.error(error);
                console.error("");
                console.error(error.stack);
                console.error("");

            }

            rl.prompt();
            return;
        }

        multilineBuffer.push(input);
        return;
    }

    const command = input.trim();

    if (!command) {
        rl.prompt();
        return;
    }

    if (command === "<<<") {
        multilineMode = true;
        multilineBuffer = [];
        console.log("(multi-line mode)");
        return;
    }

    if (
        command === "exit" ||
        command === "quit"
    ) {
        rl.close();
        return;
    }

    try {

        await orchestrate(command);

    } catch (error) {

        console.error("");
        console.error(error);
        console.error("");
        console.error(error.stack);
        console.error("");

    }

    rl.prompt();

});

rl.on("close", () => {

    console.log("");
    console.log("CAI Stopped");
    console.log("");

    process.exit(0);

});