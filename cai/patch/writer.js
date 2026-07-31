const fs = require("fs");

function writeFile(filePath, content) {

    fs.writeFileSync(
        filePath,
        content,
        "utf8"
    );

    return true;

}

function readFile(filePath) {

    return fs.readFileSync(
        filePath,
        "utf8"
    );

}

module.exports = {
    writeFile,
    readFile
};