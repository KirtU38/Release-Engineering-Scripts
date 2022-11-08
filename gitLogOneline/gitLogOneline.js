const terminal = require('child_process');
const { argv } = require('process');
const input = require('prompt-sync')();

// glo UAT..develop
// Показывает каких коммитов нет в UAT, которые есть в develop
class ReleaseValidator {

    runInTerminal(command) {
        try {
            return terminal.execSync(command).toString();
        } catch (error) {
            return null;
        }
    }

    async run() {
        let inputArg = argv[2];
        const commitsDiff = this.runInTerminal(`git log --oneline ${inputArg}`);
        let commitsList = commitsDiff.split('\n');

        let commitsHasesList = [];
        for (const commit of commitsList) {
            console.log(commit.substring(0, 193));
            commitsHasesList.push(commit.substring(0,9));
        }

        let finalString = '(';
        for (const hash of commitsHasesList) {
            finalString = finalString + hash + '|';
        }
        finalString = finalString.substring(0, finalString.length - 2) + ')';

        let branches = inputArg.split('..');

        console.log(`${branches[0]} does NOT have these commits from ${branches[1]}:`);
        console.log(finalString);
    }
}

// Prorgam run
const releaseValidator = new ReleaseValidator();
releaseValidator.run()
