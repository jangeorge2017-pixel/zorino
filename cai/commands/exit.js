function exitCommand(context) {

    console.log("");
    console.log("Goodbye.");
    console.log("");

    context.rl.close();

}

module.exports = exitCommand;