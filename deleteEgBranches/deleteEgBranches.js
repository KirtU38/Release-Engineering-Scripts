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
        this.runInTerminal('git fetch --all');
        let branches = this.runInTerminal(`git branch -a | grep eg/`)
        console.log(`\nBranches: `);
        console.log(branches);
        let response = input('Delete these branches? [y/n]: ');
        if(response.trim() == 'n') process.exit(1);

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
        for (const localBranch of localBranches) {
            this.runInTerminal(`git branch -D ${localBranch}`);
        }
        for (const remoteBranch of remoteBranches) {
            this.runInTerminal(`git push -d origin ${remoteBranch.replace('remotes/origin/', '')}`);
        }
        console.log('Branches deleted!');
        
    }
}

// Prorgam run
const releaseValidator = new ReleaseValidator();
releaseValidator.run()
