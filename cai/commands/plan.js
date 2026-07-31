const { createPlan } = require("../planner/planner");

function planCommand(context) {
    const parts = context.command.trim().split(/\s+/);
    if (parts.length < 2) {
        console.log("\nUsage:\nplan <feature>\n");
        return { success: false, message: "Missing plan feature." };
    }

    parts.shift();
    return createPlan(parts.join(" "), context.workspace);
}

module.exports = planCommand;
