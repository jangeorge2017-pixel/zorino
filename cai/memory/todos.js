const { getMemory } = require("./store");

function addTodo(text) {

    if (!text) {
        return;
    }

    const memory = getMemory();

    memory.todos.push({

        id: Date.now(),
        text,
        completed: false

    });

}

function completeTodo(id) {

    const memory = getMemory();

    const todo = memory.todos.find(
        item => item.id === id
    );

    if (todo) {
        todo.completed = true;
    }

}

function removeTodo(id) {

    const memory = getMemory();

    memory.todos = memory.todos.filter(
        item => item.id !== id
    );

}

function getTodos() {

    return getMemory().todos;

}

function clearTodos() {

    getMemory().todos = [];

}

module.exports = {
    addTodo,
    completeTodo,
    removeTodo,
    getTodos,
    clearTodos
};