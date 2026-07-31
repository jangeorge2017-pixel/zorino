const fs = require("fs");
const path = require("path");

function moveTarget(target, destination) {

    if (!fs.existsSync(target)) {
        return false;
    }

    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, {
            recursive: true
        });
    }

    const newPath = path.join(
        destination,
        path.basename(target)
    );

    fs.renameSync(
        target,
        newPath
    );

    return newPath;

}

module.exports = {
    moveTarget
};