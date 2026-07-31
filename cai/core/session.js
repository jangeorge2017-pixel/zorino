const BaseAgent = require("./base");

class AgentManager {

    constructor() {
        this.agents = {};
    }

    register(name, agent) {

        if (!(agent instanceof BaseAgent)) {
            throw new Error("Agent must extend BaseAgent.");
        }

        this.agents[name] = agent;

    }

    get(name) {

        if (!this.agents[name]) {
            throw new Error("Agent not found: " + name);
        }

        return this.agents[name];

    }

    exists(name) {
        return this.agents[name] !== undefined;
    }

    remove(name) {
        delete this.agents[name];
    }

    list() {
        return Object.keys(this.agents);
    }

    count() {
        return this.list().length;
    }

    clear() {
        this.agents = {};
    }

}

module.exports = new AgentManager();