const fs = require("fs");
const path = require("path");

function renameTarget(target, newName) {

    if (!fs.existsSync(target)) {
        return false;
    }

    const directory = path.dirname(target);

    const extension = path.extname(target);

    const destination = path.join(
        directory,
        newName + extension
    );

    fs.renameSync(
        target,
        destination
    );

    return destination;

}

module.exports = {
    renameTarget
};