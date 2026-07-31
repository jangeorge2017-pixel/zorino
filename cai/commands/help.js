function helpCommand() {

    console.log("");
    console.log("Available Commands");
    console.log("------------------");
    console.log("help");
    console.log("project");
    console.log("workspace");
    console.log("scan");
    console.log("find <keyword>");
    console.log("open <path-or-keyword>");
    console.log("ask <prompt>");
    console.log("trace <file>");
    console.log("review");
    console.log("memory");
    console.log("git [status|diff|log]");
    console.log("doctor");
    console.log("patch replace <file> <search> <replacement> [--dry-run]");
    console.log("Enter an existing workspace file path to open it directly.");
    console.log("exit");
    console.log("");

}

module.exports = helpCommand;
