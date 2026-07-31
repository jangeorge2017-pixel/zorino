class Provider {
    constructor({ id, model }) {
        if (!id) throw new Error("Provider requires an id.");
        this.id = id;
        this.modelName = model || null;
        this.lastMetrics = null;
    }

    async isAvailable() {
        throw new Error(this.id + " must implement isAvailable().");
    }

    async ask() {
        throw new Error(this.id + " must implement ask(prompt, options).");
    }

    getStatus() {
        return { id: this.id, model: this.modelName, metrics: this.lastMetrics };
    }
}

module.exports = Provider;
