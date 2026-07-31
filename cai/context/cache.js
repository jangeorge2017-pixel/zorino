const { getState } = require("./state");

function setCache(key, value) {

    const state = getState();

    state.cache[key] = value;

}

function getCache(key) {

    const state = getState();

    return state.cache[key];

}

function hasCache(key) {

    const state = getState();

    return Object.prototype.hasOwnProperty.call(
        state.cache,
        key
    );

}

function removeCache(key) {

    const state = getState();

    delete state.cache[key];

}

function clearCache() {

    const state = getState();

    state.cache = {};

}

function getAllCache() {

    return getState().cache;

}

module.exports = {
    setCache,
    getCache,
    hasCache,
    removeCache,
    clearCache,
    getAllCache
};