const { getState } = require("./state");

function setCurrentFeature(feature) {

    const state = getState();

    state.currentFeature = feature;

}

function getCurrentFeature() {

    return getState().currentFeature;

}

function setCurrentFile(file) {

    const state = getState();

    state.currentFile = file;

    if (!state.openedFiles.includes(file)) {
        state.openedFiles.push(file);
    }

}

function getCurrentFile() {

    return getState().currentFile;

}

function setSelectedFiles(files) {

    const state = getState();

    state.selectedFiles = [...files];

}

function getSelectedFiles() {

    return getState().selectedFiles;

}

module.exports = {
    setCurrentFeature,
    getCurrentFeature,
    setCurrentFile,
    getCurrentFile,
    setSelectedFiles,
    getSelectedFiles
};