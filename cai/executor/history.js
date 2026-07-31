class ExecutionHistory {

    constructor() {

        this.items = [];

    }

    add(record) {

        this.items.push({

            time: new Date(),

            ...record

        });

    }

    all() {

        return this.items;

    }

    clear() {

        this.items = [];

    }

}

module.exports = {
    ExecutionHistory
};