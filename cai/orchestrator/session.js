class Session {

    constructor() {

        this.data = {
            project: null,
            command: null,
            startedAt: new Date()
        };

    }

    set(key, value) {

        this.data[key] = value;

    }

    get(key) {

        return this.data[key];

    }

    reset() {

        this.data = {
            project: null,
            command: null,
            startedAt: new Date()
        };

    }

}

module.exports = {
    Session
};