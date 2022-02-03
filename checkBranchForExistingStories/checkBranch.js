const asana = require('asana');
const terminal = require('child_process');
const argParser = require('commander');

//  Default variables
const defaultStoriesToCheck = 40;
const hardcodedAsanaToken = ''
const envVarName = "ASANA_TOKEN"

class ReleaseValidator {
    asanaClient;

    constructor() {
        const asanaToken = this.getAsanaToken();
        this.validateToken(asanaToken);
        this.asanaClient = asana.Client.create().useAccessToken(asanaToken);
    }

    runInTerminal(command) {
        try {
            return terminal.execSync(command).toString();
        } catch (error) {
            return null;
        }
    }

    async run() {
        let argStoriesToCheck = process.argv[2];
        let storiesToCheck = argStoriesToCheck ? argStoriesToCheck : defaultStoriesToCheck;
        console.log(storiesToCheck);

        let commitsString = this.runInTerminal(`git log --oneline`);
        let commitsArray = commitsString.split('\n');

        let otherCommits = [];
        let revertCommits = [];
        let clickDeployCommits = [];
        let setOfStoryIds = new Set();
        for (const commit of commitsArray) {
            if(setOfStoryIds.size > storiesToCheck) break;

            if(commit.match(/.*\d{16}.*/)) {
                setOfStoryIds.add(commit.replace(/.*(\d{16}).*/, '$1'));
            } else if (commit.match(/.*ClickDeploy.*/i)) {
                clickDeployCommits.push(commit);
            } else if (commit.match(/.*revert.*/i) || commit.match(/.*return.*/i)) {
                revertCommits.push(commit);
            } else {
                otherCommits.push(commit);
            }
        }
        // console.log('ClickDeploy:');
        // console.log(clickDeployCommits);
        console.log('Other commits:');
        console.log(otherCommits);
        console.log('Revert Commits:');
        console.log(revertCommits);
        console.log('Stories:');

        let sprintInBranch = new Set();
        for (const storyId of setOfStoryIds) {
            await this.asanaClient.tasks.getTask(storyId, {opt_fields: 'name,custom_fields'})
            .then(
                (result) => {
                    let teamField = result.custom_fields.find((field) => field.name == 'Aquiva Team');
                    let sprintFieldOld = result.custom_fields.find((field) => field.name == 'BT Sprint - FY22');
                    let sprintFieldNew = result.custom_fields.find((field) => field.name == 'ET Sprint - FY23');
                    let sprintField = sprintFieldOld ? sprintFieldOld : sprintFieldNew;
                    
                    if (sprintField && sprintField.display_value) {
                        let teamValueFormatted = teamField && teamField.display_value 
                            ? teamField.display_value + ' '.repeat(7 - teamField.display_value.length) 
                            : 'null' + ' '.repeat(3)
                        let sprintValueFormatted = sprintField.display_value.replace(/.*(Sprint \d+):.*/i, '$1');
                        sprintInBranch.add(sprintValueFormatted);
                        console.log(`${sprintValueFormatted} - ${teamValueFormatted} - ${storyId} - ${result.name.substring(0, 140)}`);
                    }
                },
                (error) => {
                    return;
                }
            );
        }
        console.log('\nBranch contains Sprints:');
        console.log([...sprintInBranch].sort());
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
    
    getAsanaToken() {
        if (hardcodedAsanaToken) {
            return hardcodedAsanaToken;
        }
    
        if (process.env[envVarName]) {
            return process.env[envVarName];
        } else {
            console.log(`Couldn't find any Asana Access Token in Environment variable ${envVarName}, --token Argument or Hardcoded`);
            process.exit(1);
        }
    }
    
    validateToken(token) {
        terminal.exec(`curl -X GET https://app.asana.com/api/1.0/users/me -H 'Authorization: Bearer ${token}'`, (error, stdout, stderr) => {
            if (stdout.includes('Not Authorized')) {
                console.log('Your Asana Access Token is not authorized');
                process.exit(1);
            }
        })
        console.log(`Authorization: OK`);
    }
}

// Prorgam run
const releaseValidator = new ReleaseValidator();
releaseValidator.run()
