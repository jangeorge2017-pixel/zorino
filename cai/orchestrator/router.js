function routeCommand(command) {

    if (!command) {
        return null;
    }

    const parts = command
        .trim()
        .toLowerCase()
        .split(/\s+/);

    const first = parts[0];
    const second = parts[1];

    if (first === "scan" && second === "project") {
        return "project";
    }

    const routes = {

        project: "project",

        scan: "project",

        planner: "planner",
        plan: "planner",

        patch: "patch",

        refactor: "refactor",

        impact: "impact",

        execute: "executor",
        exec: "executor"

    };

    return routes[first] || null;

}

module.exports = {
    routeCommand
};