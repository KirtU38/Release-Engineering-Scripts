const terminal = require('child_process');
const input = require('prompt-sync')();


class ReleaseValidator {

    runInTerminal(command) {
        try {
            return terminal.execSync(command).toString();
        } catch (error) {
            return null;
        }
    }

    async run() {
        let currentBranch = this.runInTerminal('');
        this.runInTerminal('git fetch --all');
        let branches = this.runInTerminal(`git branch -a | grep eg/`)
        console.log(`\nBranches: `);
        console.log(branches);

        let branchesList = branches.split('\n');

        let localBranches = [];
        let remoteBranches = [];
        for (const branch of branchesList) {
            if(!branch) continue;

            if(branch.includes('remotes/origin/')) {
                remoteBranches.push(branch.trim());
            } else {
                localBranches.push(branch.trim());
            }
        }
        console.log(localBranches);
        console.log(remoteBranches);
    }
}

// Prorgam run
const releaseValidator = new ReleaseValidator();
releaseValidator.run()
