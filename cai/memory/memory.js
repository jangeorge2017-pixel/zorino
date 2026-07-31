const { getMemory, resetMemory } = require("./store");

const {
    startSession,
    endSession,
    getSession
} = require("./session");

const {
    addHistory,
    getHistory,
    getLastHistory,
    clearHistory
} = require("./history");

const {
    addBookmark,
    removeBookmark,
    getBookmarks,
    hasBookmark,
    clearBookmarks
} = require("./bookmarks");

const {
    addTodo,
    completeTodo,
    removeTodo,
    getTodos,
    clearTodos
} = require("./todos");

const {
    addNote,
    removeNote,
    getNotes,
    clearNotes
} = require("./notes");

const {
    addDecision,
    removeDecision,
    getDecisions,
    clearDecisions
} = require("./decisions");

module.exports = {

    getMemory,
    resetMemory,

    startSession,
    endSession,
    getSession,

    addHistory,
    getHistory,
    getLastHistory,
    clearHistory,

    addBookmark,
    removeBookmark,
    getBookmarks,
    hasBookmark,
    clearBookmarks,

    addTodo,
    completeTodo,
    removeTodo,
    getTodos,
    clearTodos,

    addNote,
    removeNote,
    getNotes,
    clearNotes,

    addDecision,
    removeDecision,
    getDecisions,
    clearDecisions

};