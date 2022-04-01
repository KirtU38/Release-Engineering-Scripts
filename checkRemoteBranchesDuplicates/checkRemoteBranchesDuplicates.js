const terminal = require('child_process');

class ReleaseValidator {

    async run() {
        let branches = '';
        branches = this.runInTerminal(`git branch -r`);
        let branchesList = branches.split('\n');

        let taskIdToBranchName = new Map();
        for (const branch of branchesList) {
            if(!branch.match(/.*\d{16}.*/)) {
                continue;
            }
            let branchId = branch.replace(/.*(\d{16}).*/, '$1');

            if(taskIdToBranchName.has(branchId)) {
                taskIdToBranchName.get(branchId).push(branch.trim());
            } else {
                taskIdToBranchName.set(branchId, [branch.trim()])
            }
        }

        for (const branches of taskIdToBranchName.values()) {
            if(branches.length > 1) {
                console.log('\n');
                for (const branch of branches) {
                    console.log(branch);
                }
            }
        }
    }

    runInTerminal(command) {
        try {
            return terminal.execSync(command).toString();
        } catch (error) {
            return null;
        }
    }
}

// Prorgam run
const releaseValidator = new ReleaseValidator();
releaseValidator.run();
