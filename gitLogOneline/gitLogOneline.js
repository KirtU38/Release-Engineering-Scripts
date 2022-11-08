const terminal = require('child_process');
const { argv } = require('process');
const input = require('prompt-sync')();

// glo UAT..develop
// Показывает каких коммитов нет в UAT, которые есть в develop
// glo UAT
// Показывает каких коммитов нет в UAT, которые есть в текущей ветке
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
        let branch1 = '';
        let branch2 = '';

        if(inputArg.includes('..')) {
            let branches = inputArg.split('..');
            branch1 = branches[0];
            branch2 = branches[1];
        } else {
            branch1 = inputArg;
            branch2 = this.runInTerminal(`git rev-parse --abbrev-ref HEAD`).trimEnd();
        }

        const commitsDiff = this.runInTerminal(`git log --oneline ${branch1}..${branch2}`);
        let commitsList = commitsDiff.split('\n');

        if(commitsList.length == 1) {
            console.log(`${branch1} has all commits from ${branch2}`);
            process.exit(1);
        }

        let commitsHashesList = [];
        for (const commit of commitsList) {
            console.log(commit.substring(0, 193));
            commitsHashesList.push(commit.substring(0,9));
        }

        let finalString = '(';
        for (const hash of commitsHashesList) {
            finalString = finalString + hash + '|';
        }
        finalString = finalString.substring(0, finalString.length - 2) + ')';

        console.log(`${branch1} does NOT have these commits from ${branch2}:`);
        console.log(finalString);
    }
}

// Prorgam run
const releaseValidator = new ReleaseValidator();
releaseValidator.run()
