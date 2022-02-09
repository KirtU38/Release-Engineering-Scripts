const terminal = require('child_process');
const argParser = require('commander');
const input = require('prompt-sync')();


class ReleaseValidator {

    exclude = new Set([
        '* master',
        'master',
        'test',
    ]);

    runInTerminal(command) {
        try {
            return terminal.execSync(command).toString();
        } catch (error) {
            return null;
        }
    }

    async run() {
        this.arguments = this.parseArguments();
        if(!this.arguments.filter) {
            this.arguments.all = true;
        }

        let branches = '';
        if(!this.arguments.all) {
            console.log('\nBranches:');
            branches = this.runInTerminal(`git branch | grep ${this.arguments.filter}`)
            console.log(branches);

            let response = input('Delete these local branches? [y/n]: ');
            if(response.trim() == 'n') process.exit(1);
        } else {
            let response = input('Delete ALL local branches? [y/n]: ');
            if(response.trim() == 'n') process.exit(1);
            branches = this.runInTerminal(`git branch`)
        }
        let branchesList = branches.split('\n');
        this.runInTerminal(`git checkout master`)
        for (const branch of branchesList) {
            if(!branch || this.exclude.has(branch.trim())) continue;
            console.log(branch.trim());

            this.runInTerminal(`git branch -D '${branch.trim()}'`)
        }
        



        // this.runInTerminal('git rev-parse --abbrev-ref HEAD');
        // this.runInTerminal('git checkout test');
        // this.runInTerminal(`git branch -D ${currentBranch}`)
        // this.runInTerminal(`git checkout ${currentBranch}`)
    }

    parseArguments() {
        argParser
            .option('-f, --filter [value]', "Choose branches to delete")
            .option('-a, --all', 'Delete all local branches', false)
    
        return argParser.parse(process.argv).opts();
    }
    
    
}

// Prorgam run
const releaseValidator = new ReleaseValidator();
releaseValidator.run()
