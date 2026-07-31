function parseRefactor(command) {

    const result = {

        action: null,

        target: null,

        destination: null,

        name: null,

        valid: false

    };

    if (!command) {
        return result;
    }

    const parts = command.trim().split(/\s+/);

    parts.shift();

    result.action = parts.shift();

    switch (result.action) {

        case "rename":

            result.target = parts.shift();
            result.name = parts.join(" ");

            result.valid =
                !!result.target &&
                !!result.name;

            break;

        case "move":

            result.target = parts.shift();
            result.destination = parts.join(" ");

            result.valid =
                !!result.target &&
                !!result.destination;

            break;

        case "extract":

            result.target = parts.shift();
            result.name = parts.join(" ");

            result.valid =
                !!result.target &&
                !!result.name;

            break;

        default:

            result.valid = false;

    }

    return result;

}

module.exports = {
    parseRefactor
};