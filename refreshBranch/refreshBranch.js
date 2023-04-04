const terminal = require('child_process');
const argParser = require('commander');


class ReleaseValidator {

    runInTerminal(command) {
        try {
            return terminal.execSync(command).toString();
        } catch (error) {
            return null;
        }
    }

    async run() {
        let currentBranch = this.runInTerminal('git rev-parse --abbrev-ref HEAD');
        this.runInTerminal('git checkout -');

        // if(currentBranch.trim() == 'main') {
        //     this.runInTerminal('git checkout UAT');
        // } else {
        //     this.runInTerminal('git checkout main');
        // }

        this.runInTerminal(`git branch -D ${currentBranch}`);
        this.runInTerminal(`git checkout ${currentBranch}`);
        this.runInTerminal(`git pull`);
    }

    parseArguments() {
        // argParser
        //     .requiredOption('-u, --url <value>', 'URL of Asana Project. Example: -u https://app.asana.com/0/1201640226677955/list')
        //     .option('-s, --sections [value]', "Sections in the project that need to be checked. Example: --sections 'ClickDeploy, Stories to Deploy'", defaultSections)
        //     .option('-a, --all-sections', 'Check all Sections in a Project', false)
        //     .option('-sp, --sprint [value]', "Filter checked tasks by Sprint. Example: --sprint 'Sprint 24'")
        //     .option('-t, --token [value]', "You can pass Asana Access Token here, if Environment variable doesn't work. Example: --token '1/1200261289008160:0c75d3a830cfa6c7e7c6f8856cad3b21'")
        //     .option('--short', 'Show problems only (marked as !!)', false)
    
        // return argParser.parse(process.argv).opts();
    }
}

// Prorgam run
const releaseValidator = new ReleaseValidator();
releaseValidator.run()
