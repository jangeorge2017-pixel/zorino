const fs = require("fs");
const path = require("path");

class PlanManager {

    constructor() {

        this.file = path.join(__dirname, "plans.json");
        this.plans = {};
        this.nextId = 1;

        this.load();

    }

    load() {

        try {

            if (!fs.existsSync(this.file)) {
                fs.writeFileSync(this.file, "[]");
            }

            const list = JSON.parse(
                fs.readFileSync(this.file, "utf8")
            );

            this.plans = {};
            this.nextId = 1;

            for (const plan of list) {

                this.plans[plan.id] = plan;

                if (plan.id >= this.nextId) {
                    this.nextId = plan.id + 1;
                }

            }

        } catch {

            this.plans = {};
            this.nextId = 1;

        }

    }

    save() {

        fs.writeFileSync(
            this.file,
            JSON.stringify(
                Object.values(this.plans),
                null,
                2
            )
        );

    }

    create(name, steps = []) {

        const now = new Date().toISOString();

        const plan = {
            id: this.nextId++,
            name,
            status: "pending",
            createdAt: now,
            updatedAt: now,
            steps
        };

        this.plans[plan.id] = plan;

        this.save();

        return plan;

    }

    get(id) {

        return this.plans[id] || null;

    }

    update(id, values) {

        if (!this.plans[id]) {
            return null;
        }

        Object.assign(this.plans[id], values);

        this.plans[id].updatedAt =
            new Date().toISOString();

        this.save();

        return this.plans[id];

    }

    remove(id) {

        if (!this.plans[id]) {
            return false;
        }

        delete this.plans[id];

        this.save();

        return true;

    }

    list() {

        return Object.values(this.plans);

    }

    count() {

        return this.list().length;

    }

    clear() {

        this.plans = {};
        this.nextId = 1;

        this.save();

    }

}

module.exports = new PlanManager();