const fs = require("fs");
const path = require("path");

function extractToFile(sourceFile, destinationFile, content) {

    if (!fs.existsSync(sourceFile)) {
        return false;
    }

    const directory = path.dirname(destinationFile);

    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, {
            recursive: true
        });
    }

    fs.writeFileSync(
        destinationFile,
        content,
        "utf8"
    );

    return destinationFile;

}

module.exports = {
    extractToFile
};