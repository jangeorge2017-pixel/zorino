const { getMemory } = require("./store");

function addNote(title, text) {

    if (!title) {
        return;
    }

    const memory = getMemory();

    memory.notes.push({

        id: Date.now(),

        title,

        text: text || "",

        createdAt: new Date().toISOString()

    });

}

function removeNote(id) {

    const memory = getMemory();

    memory.notes = memory.notes.filter(
        note => note.id !== id
    );

}

function getNotes() {

    return getMemory().notes;

}

function clearNotes() {

    getMemory().notes = [];

}

module.exports = {
    addNote,
    removeNote,
    getNotes,
    clearNotes
};