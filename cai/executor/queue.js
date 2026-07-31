class ExecutionQueue {

    constructor() {

        this.queue = [];

    }

    add(task) {

        this.queue.push(task);

    }

    next() {

        if (this.queue.length === 0) {
            return null;
        }

        return this.queue.shift();

    }

    size() {

        return this.queue.length;

    }

    clear() {

        this.queue = [];

    }

}

module.exports = {
    ExecutionQueue
};