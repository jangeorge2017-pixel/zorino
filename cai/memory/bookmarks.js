const { getMemory } = require("./store");

function addBookmark(file) {

    if (!file) {
        return;
    }

    const memory = getMemory();

    if (!memory.bookmarks.includes(file)) {
        memory.bookmarks.push(file);
    }

}

function removeBookmark(file) {

    const memory = getMemory();

    memory.bookmarks = memory.bookmarks.filter(
        item => item !== file
    );

}

function getBookmarks() {

    return getMemory().bookmarks;

}

function hasBookmark(file) {

    return getMemory().bookmarks.includes(file);

}

function clearBookmarks() {

    getMemory().bookmarks = [];

}

module.exports = {
    addBookmark,
    removeBookmark,
    getBookmarks,
    hasBookmark,
    clearBookmarks
};