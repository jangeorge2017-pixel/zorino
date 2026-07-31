const fs = require("fs");

function applyPatch(request) {

    let content = fs.readFileSync(
        request.target,
        "utf8"
    );

    switch (request.action) {

        case "replace":

            content = content.replace(
                request.search,
                request.replace
            );

            break;

        case "insert":

            content += "\n" + request.replace;

            break;

        case "delete":

            content = content.replace(
                request.search,
                ""
            );

            break;

        default:

            return false;

    }

    fs.writeFileSync(
        request.target,
        content,
        "utf8"
    );

    return true;

}

module.exports = {
    applyPatch
};