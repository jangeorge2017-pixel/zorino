const path = require("path");

class Workspace {
    constructor(root = process.cwd()) {
        this.reset(root);
    }

    reset(root = process.cwd()) {
        this.root = path.resolve(root);
        this.name = path.basename(this.root);

        this.project = null;
        this.index = null;

        this.currentFile = null;
        this.currentCommand = null;
        this.lastResult = null;

        this.context = {};
        this.cache = {};

        return this;
    }

    setProject(project) {
        this.project = project;
        return this;
    }

    getProject() {
        return this.project;
    }

    setIndex(index) {
        this.index = index;
        return this;
    }

    getIndex() {
        return this.index;
    }

    setCurrentFile(file) {
        this.currentFile = file;
        return this;
    }

    getCurrentFile() {
        return this.currentFile;
    }

    setCurrentCommand(command) {
        this.currentCommand = command;
        return this;
    }

    getCurrentCommand() {
        return this.currentCommand;
    }

    setLastResult(result) {
        this.lastResult = result;
        return this;
    }

    getLastResult() {
        return this.lastResult;
    }

    set(key, value) {
        this.context[key] = value;
        return this;
    }

    get(key) {
        return this.context[key];
    }

    has(key) {
        return Object.prototype.hasOwnProperty.call(this.context, key);
    }

    remove(key) {
        delete this.context[key];
        return this;
    }

    clearContext() {
        this.context = {};
        return this;
    }

    setCache(key, value) {
        this.cache[key] = value;
        return this;
    }

    getCache(key) {
        return this.cache[key];
    }

    clearCache() {
        this.cache = {};
        return this;
    }

    toJSON() {
        return {
            root: this.root,
            name: this.name,
            project: this.project,
            index: this.index,
            currentFile: this.currentFile,
            currentCommand: this.currentCommand,
            lastResult: this.lastResult
        };
    }
}

module.exports = Workspace;