const services = require("../services");
const router = require("./git");

class Engine {

    async run(prompt, context = {}) {

        services.memory.remember({
            prompt,
            context,
            time: new Date().toISOString()
        });

        const plan = services.planner.create(
            prompt,
            ["Analyse request", "Select agent", "Execute"]
        );

        const workflow = services.workflow.create(
            prompt,
            plan.steps
        );

        const agent = router.route(prompt);

        const result = await agent.ask(prompt);

        workflow.status = "completed";
        workflow.currentStep = workflow.steps.length;

        services.workflow.update(
            workflow.id,
            workflow
        );

        services.memory.remember({
            prompt,
            result,
            finishedAt: new Date().toISOString()
        });

        return {
            plan,
            workflow,
            result
        };

    }

}

module.exports = new Engine();