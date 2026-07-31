const { getState } = require("./state");

const MAX_HISTORY = 100;

function addCommand(command) {

    const state = getState();

    if (!command) {
        return;
    }

    state.recentCommands.push(command);

    if (state.recentCommands.length > MAX_HISTORY) {
        state.recentCommands.shift();
    }

}

function getHistory() {

    return [...getState().recentCommands];

}

function getLastCommand() {

    const history = getState().recentCommands;

    if (history.length === 0) {
        return null;
    }

    return history[history.length - 1];

}

function clearHistory() {

    getState().recentCommands = [];

}

module.exports = {
    addCommand,
    getHistory,
    getLastCommand,
    clearHistory
};