import terminal from 'child_process';
import asana from 'asana';
import spinner from 'ora';
import { Command } from 'commander'
const argParser = new Command();

//  Default variables
const defaultSections = 'ClickDeploy,Stories to Deploy,User Stories,Deployment';
const hardcodedAsanaToken = '';
const envVarName = "ASANA_TOKEN";

class ReleaseValidator {
    arguments;
    baseURL;
    projectId;
    asanaClient;

    constructor() {
        this.arguments = this.parseArguments();
        this.baseURL = this.arguments.url.substring(0,41);
        this.projectId = this.arguments.url.split("/").slice(-2)[0];
        this.validateProjectId();

        const asanaToken = this.getAsanaToken();
        this.validateToken(asanaToken);
        this.asanaClient = asana.Client.create({defaultHeaders: {'Asana-Enable': 'new_memberships,new_goal_memberships'}}).useAccessToken(asanaToken);
    }

    async run() {
        this.fetchOrigin();
        let sections = await this.getSections();
        let tasksFromSectionsJson = await this.getTasksFromSectionsJson(sections);
        let tasks = this.getListOfTaskObjects(tasksFromSectionsJson);
        this.handleBranches(tasks);
        this.printTasks(tasks);
    }

    runInTerminal(command, showOutput = false) {
        try {
            const stdioOption = showOutput ? 'inherit' : 'pipe';
            return terminal.execSync(command, { stdio: stdioOption }).toString();
        } catch (error) {
            return null;
        }
    }

    parseArguments() {
        argParser
            .requiredOption('-u, --url <value>', 'URL of Asana Project. Example: -u https://app.asana.com/0/1201640226677955/list')
            .option('-s, --sections [value]', "Sections in the project that need to be checked. Example: --sections 'ClickDeploy, Stories to Deploy'", defaultSections)
            .option('-a, --all-sections', 'Check all Sections in a Project', false)
            .option('-sp, --sprint [value]', "Filter checked tasks by Sprint. Example: --sprint 'Sprint 24'")
            .option('-t, --token [value]', "You can pass Asana Access Token here, if Environment variable doesn't work. Example: --token '1/1200261289008160:0c75d3a830cfa6c7e7c6f8856cad3b21'")
            .option('--short', 'Show problems only (marked as !!)', false)
    
        return argParser.parse(process.argv).opts();
    }
    
    getAsanaToken() {
        if (hardcodedAsanaToken) {
            return hardcodedAsanaToken;
        } else if (this.arguments.token) {
            return this.arguments.token;
        }
    
        if (process.env[envVarName]) {
            return process.env[envVarName];
        } else {
            console.log(`Couldn't find any Asana Access Token in Environment variable ${envVarName}, --token Argument or Hardcoded`);
            process.exit(1);
        }
    }
    
    validateToken(token) {
        let sp = spinner('Authorization');
        sp.start();

        // let authResult = this.runInTerminal(`curl -X GET https://app.asana.com/api/1.0/users/me -H 'Authorization: Bearer ${token}'`);
        // let authResult = terminal.execSync(`curl -X GET https://app.asana.com/api/1.0/users/me -H 'Authorization: Bearer ${token}'`, {stdio:'pipe'}).toString();
        let authResult = this.runInTerminal(`curl -X GET https://app.asana.com/api/1.0/users/me -H 'Authorization: Bearer ${token}'`);
        if(authResult.includes('Not Authorized')) {
            sp.fail('Your Asana Access Token is not authorized');
            process.exit(1);
        }
        sp.succeed();
    }
    
    validateProjectId() {
        if (this.projectId.length != 16 || !this.projectId.match(/^\d+$/)) {
            console.log('Project ID is invalid, it must be 16 characters, numbers only');
            process.exit(1);
        }
    }

    fetchOrigin() {
        let sp = spinner('Fetching Origin');
        sp.start();
        terminal.execSync(`git fetch --all`, {stdio: 'ignore'});
        sp.succeed();
    }
    
    async getSections() {
        let sp = spinner('Retrieving Sections');
        sp.start();

        let chosenSectionsStringList = []
        if (!this.arguments.allSections) {
            if (this.arguments.sections) {
                chosenSectionsStringList = this.arguments.sections.split(',').map((section) => section.trim().toUpperCase());
            }
        }
    
        return await this.asanaClient.sections.getSectionsForProject(this.projectId, {opt_pretty: true})
            .then(
                (result) => {
                    sp.succeed();
                    let jsonSections = result.data;
    
                    let retrievedSectionsObjects = [];
                    for (const section of jsonSections) {
                        if (this.arguments.allSections || chosenSectionsStringList.includes(section.name.toUpperCase())) {
                            retrievedSectionsObjects.push(new Section(section.name.toUpperCase(), section.gid));
                        }
                    }
    
                    if (this.arguments.allSections) return retrievedSectionsObjects;
    
                    // Check not found sections
                    // let retrievedSectionsNames = retrievedSectionsObjects.map((s) => s.name);
                    // for (const sectionName of chosenSectionsStringList) {
                    //     if (!retrievedSectionsNames.includes(sectionName)) {
                    //         console.log(`Section "${sectionName}" was not found`);
                    //     }
                    // }
                    return retrievedSectionsObjects;
                },
                (error) => {
                    sp.fail(`Project with ID ${this.projectId} doesn't exist`);
                    process.exit(1);
                }
            );
    }
    
    async getTasksFromSectionsJson(sections) {
        let jsonTasks = [];
        for (const section of sections) {
            let sp = spinner(`Retrieving Tasks from Section: ${section.name}`);
            sp.start();
            let params = "gid,name,custom_fields";
            await this.asanaClient.tasks.getTasksForSection(section.id, {opt_fields: `${params}`, opt_pretty: true, limit: 100})
                .then(
                    (result) => {
                        sp.succeed();
                        jsonTasks.push(result.data);
                    },
                    (error) => {
                        sp.fail();
                        console.log(error);
                    }
                );
        }
        return jsonTasks;
    }
    
    getListOfTaskObjects(sectionsWithTasks) {
        let tasks  = [];
        for (const tasksForSection of sectionsWithTasks) {
            for (const task of tasksForSection) {
                // Filter by sprint if it was chosen
                if (this.arguments.sprint) {
                    let sprintField = task.custom_fields.find((field) => field.name == 'BT Sprint - FY22');
                    if (!sprintField || !sprintField.display_value 
                            || !sprintField.display_value.toUpperCase().includes(this.arguments.sprint.toUpperCase())) 
                        {
                        continue;
                    }
                }

                let teamField = task.custom_fields.find((field) => field.name == 'Aquiva Team');
                let teamValue = teamField && teamField.display_value ? `(${teamField.display_value})` : '';
                let taskURL = `${this.baseURL}${task.gid}`;
                let taskObject = new AsanaTask(task.name, task.gid, taskURL, teamValue);
                tasks.push(taskObject);
            }
        }
    
        if (tasks.length == 0) {
            console.log('No Tasks found');
            process.exit(1)
        }
        return tasks
    }
    
    handleBranches(tasks) {
        let sp = spinner(`Handling tasks: `);
        sp.start();
        for (const task of tasks) {
            process.stdout.write('|')
            // Find remote Branches
            let taskBranches = this.runInTerminal(`git branch --remotes | grep ${task.id} | tr '\n' ' '`);
            if (!taskBranches && !this.arguments.short) {
                continue;
            }
    
            // Add Branches to object
            let taskBranchesSplit = taskBranches.trim().split(/\s+/);
            for (const branch of taskBranchesSplit) {
                task.branches.push(new Branch(branch.trim()));
            }
    
            // Check for reverts
            let revertCommits = this.runInTerminal(`git log --oneline | grep '${task.id}' | grep -i revert`);
            if(!revertCommits) {
                task.hasReverts = false;
            }
    
            // Check if fully merged
            if (task.branches.length > 0) {
                for (const branch of task.branches) {
                    let lastCommit = this.runInTerminal(`git log ${branch.name} -1 --oneline | awk '{print $1}'`);
                    // let lastCommitDateAbs = this.runInTerminal(`git log ${branch.name} -1 --pretty=format:"%ad" --date=format:'%d.%m.%Y'`);
                    let lastCommitDateAbs = this.runInTerminal(`git log ${branch.name} -1 --pretty=format:"%ad" --date=local`);
                    let lastCommitDateRel = this.runInTerminal(`git log ${branch.name} -1 --pretty=format:"%ad" --date=relative`);
                    branch.lastCommitDateAbsolute = lastCommitDateAbs;
                    branch.lastCommitDateRelative = lastCommitDateRel;
                    branch.lastCommitDateObject = new Date(lastCommitDateAbs);

                    let lastCommitIsMerged = this.runInTerminal(`git log --oneline | grep ${lastCommit}`);
                    if(!lastCommitIsMerged) {
                        branch.isMerged = false;
                    }
                }
            }
        }
        sp.succeed();
    }

    printTasks(tasks) {
        console.log('\n' + '='.repeat(120) + '\n');

        // Sort by date
        tasks.sort((a,b) => {
            if(a.branches.length == 0) {
                return -1;
            } 
            if(b.branches.length == 0) {
                return 1;
            }
            a.branches.sort((a,b) => a.lastCommitDateObject - b.lastCommitDateObject);
            b.branches.sort((a,b) => a.lastCommitDateObject - b.lastCommitDateObject);

            return a.branches[a.branches.length - 1].lastCommitDateObject - b.branches[b.branches.length - 1].lastCommitDateObject;
        });

        for (const task of tasks) {
            // Skip tasks without problems when --short
            if (this.arguments.short && task.isReady()) {
                continue;
            }
            this.printTask(task);
        }
    }
    
    printTask(task) {
        let exclamationMark = '\u2757';
        let redCross = '\u274C';
        let checkMark = '\u2705';

        if (task.hasReverts) {
            console.log(`${exclamationMark} Has Reverts`);
        }
        if (task.branches.length > 1) {
            console.log(`${exclamationMark} Found ${task.branches.length} branches`);
        }
    
        console.log(`   ${task.team}${task.name.substring(0, 70)} -> ${task.url}`);
    
        if (task.branches.length == 0) {
            console.log(`   ${task.id} -> No Branch\n\n`);
            return;
        }
        
        for (const branch of task.branches) {
            let okPrint = `${redCross} `;
            // let isMergedPrint = " -> NOT Merged";
            if (branch.isMerged) {
                okPrint = `${checkMark} `;
                // isMergedPrint = " -> Merged";
            }
            console.log(`${okPrint}${task.id} -> ${branch.name} -> ${branch.getFormattedDate()} (${branch.lastCommitDateRelative})`)
        }
        console.log("\n");
    }
}

class Branch {
    name;
    isMerged;
    lastCommitDateObject;
    lastCommitDateAbsolute;
    lastCommitDateRelative;
    lastCommitDateFormatted;

    constructor(name) {
        this.name = name;
        this.isMerged = true;
    }

    getFormattedDate() {
        return `${this.lastCommitDateObject.getDate()}.${this.lastCommitDateObject.getMonth() + 1}.${this.lastCommitDateObject.getFullYear()}`
    }
}

class Section {
    name;
    id;

    constructor(name, id) {
        this.name = name;
        this.id = id;
    }
}

class AsanaTask {
    name;
    id;
    url;
    team;
    branches;
    hasReverts;

    constructor(name, id, url, team) {
        this.name = name;
        this.id = id;
        this.url = url;
        this.team = team;
        this.branches = [];
        this.hasReverts = undefined;
    }

    isReady() {
        return this.branches.length == 1 && this.branches[0].isMerged && !this.hasReverts
    }
}

// Prorgam run


// let asd = new Date('Tue Mar 21 11:13:02 2023');
// console.log(asd.getDate());
// console.log(asd.getMonth() + 1);
// console.log(asd.getFullYear());
const releaseValidator = new ReleaseValidator();
releaseValidator.run();
