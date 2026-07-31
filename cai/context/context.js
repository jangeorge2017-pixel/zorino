const { getState, resetState } = require("./state");
const { startSession, getSession, endSession } = require("./session");
const {
    setCurrentFeature,
    getCurrentFeature,
    setCurrentFile,
    getCurrentFile,
    setSelectedFiles,
    getSelectedFiles
} = require("./focus");
const {
    addCommand,
    getHistory,
    getLastCommand,
    clearHistory
} = require("./history");
const {
    setCache,
    getCache,
    hasCache,
    removeCache,
    clearCache,
    getAllCache
} = require("./cache");

const {
    buildAnalysisPrompt
} = require("./ai-context");

module.exports = {

    getState,
    resetState,

    startSession,
    getSession,
    endSession,

    setCurrentFeature,
    getCurrentFeature,

    setCurrentFile,
    getCurrentFile,

    setSelectedFiles,
    getSelectedFiles,

    addCommand,
    getHistory,
    getLastCommand,
    clearHistory,

    setCache,
    getCache,
    hasCache,
    removeCache,
    clearCache,
    getAllCache,

    buildAnalysisPrompt

};