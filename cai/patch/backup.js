const fs = require("fs");
const path = require("path");

function createBackup(filePath) {

    if (!fs.existsSync(filePath)) {
        return null;
    }

    const backupDir = path.join(
        path.dirname(filePath),
        ".cai"
    );

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, {
            recursive: true
        });
    }

    const backupFile = path.join(
        backupDir,
        path.basename(filePath) + ".bak"
    );

    fs.copyFileSync(
        filePath,
        backupFile
    );

    return backupFile;

}

function restoreBackup(filePath) {

    const backupFile = path.join(
        path.dirname(filePath),
        ".cai",
        path.basename(filePath) + ".bak"
    );

    if (!fs.existsSync(backupFile)) {
        return false;
    }

    fs.copyFileSync(
        backupFile,
        filePath
    );

    return true;

}

function removeBackup(filePath) {

    const backupFile = path.join(
        path.dirname(filePath),
        ".cai",
        path.basename(filePath) + ".bak"
    );

    if (fs.existsSync(backupFile)) {
        fs.unlinkSync(backupFile);
    }

}

module.exports = {
    createBackup,
    restoreBackup,
    removeBackup
};