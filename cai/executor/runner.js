function runTask(task) {

    if (!task) {
        return {
            success: false,
            message: "No task."
        };
    }

    try {

        const result = task();

        return {
            success: true,
            result
        };

    } catch (error) {

        return {
            success: false,
            message: error.message
        };

    }

}

module.exports = {
    runTask
};