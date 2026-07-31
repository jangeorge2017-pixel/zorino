const { getMemory } = require("./store");

function addDecision(title, description) {

    if (!title) {
        return;
    }

    const memory = getMemory();

    memory.decisions.push({

        id: Date.now(),

        title,

        description: description || "",

        createdAt: new Date().toISOString()

    });

}

function removeDecision(id) {

    const memory = getMemory();

    memory.decisions = memory.decisions.filter(
        decision => decision.id !== id
    );

}

function getDecisions() {

    return getMemory().decisions;

}

function clearDecisions() {

    getMemory().decisions = [];

}

module.exports = {
    addDecision,
    removeDecision,
    getDecisions,
    clearDecisions
};