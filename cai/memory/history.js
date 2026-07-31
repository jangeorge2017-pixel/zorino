const { getMemory } = require("./store");

const MAX_HISTORY = 200;

function addHistory(type, value) {

    const memory = getMemory();

    memory.history.push({

        type,
        value,
        timestamp: Date.now()

    });

    if (memory.history.length > MAX_HISTORY) {
        memory.history.shift();
    }

}

function getHistory() {

    return getMemory().history;

}

function getLastHistory() {

    const history = getMemory().history;

    if (history.length === 0) {
        return null;
    }

    return history[history.length - 1];

}

function clearHistory() {

    getMemory().history = [];

}

module.exports = {
    addHistory,
    getHistory,
    getLastHistory,
    clearHistory
};