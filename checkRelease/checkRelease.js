const asana = require('asana');
const terminal = require('child_process');
const argParser = require('commander');

//  Default variables
const defaultSections = 'ClickDeploy,Stories to Deploy,User Stories,Deployment'
const hardcodedAsanaToken = ''
const envVarName = "ASANA_TOKEN"

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
        this.asanaClient = asana.Client.create({defaultHeaders: {'Asana-Enable': 'new_memberships'}}).useAccessToken(asanaToken);
    }

    async run() {
        let sections = await this.getSections();
        let tasksFromSectionsJson = await this.getTasksFromSectionsJson(sections);
        let tasks = this.getTaskObjectsList(tasksFromSectionsJson);
        this.handleTasks(tasks);
    }

    runInTerminal(command) {
        try {
            return terminal.execSync(command).toString();
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
        terminal.exec(`curl -X GET https://app.asana.com/api/1.0/users/me -H 'Authorization: Bearer ${token}'`, (error, stdout, stderr) => {
            if (stdout.includes('Not Authorized')) {
                console.log('Your Asana Access Token is not authorized');
                process.exit(1);
            }
        })
        console.log(`Authorization: OK`);
    }
    
    validateProjectId() {
        if (this.projectId.length != 16 || !this.projectId.match(/^\d+$/)) {
            console.log('Project ID is invalid, it must be 16 characters, numbers only');
            process.exit(1);
        }
    }
    
    async getSections() {
        let chosenSectionsStringList = []
        if (!this.arguments.allSections) {
            if (this.arguments.sections) {
                chosenSectionsStringList = this.arguments.sections.split(',').map((section) => section.trim().toUpperCase());
            }
        }
    
        return await this.asanaClient.sections.getSectionsForProject(this.projectId, {opt_pretty: true})
            .then(
                (result) => {
                    let jsonSections = result.data;
    
                    let retrievedSectionsObjects = [];
                    for (const section of jsonSections) {
                        if (this.arguments.allSections || chosenSectionsStringList.includes(section.name.toUpperCase())) {
                            retrievedSectionsObjects.push(new Section(section.name.toUpperCase(), section.gid));
                        }
                    }
    
                    if (this.arguments.allSections) return retrievedSectionsObjects;
    
                    // Check not found sections
                    let retrievedSectionsNames = retrievedSectionsObjects.map((s) => s.name);
                    for (const sectionName of chosenSectionsStringList) {
                        if (!retrievedSectionsNames.includes(sectionName)) {
                            console.log(`Section "${sectionName}" was not found`);
                        }
                    }
                    return retrievedSectionsObjects;
                },
                (error) => {
                    console.log(`Project with ID ${this.projectId} doesn't exist`);
                    process.exit(1);
                }
            );
    }
    
    async getTasksFromSectionsJson(sections) {
        console.log('Retrieving Tasks from Sections:');
        let jsonTasks = [];
        for (const section of sections) {
            console.log(section.name);
            
            let params = "gid,name,custom_fields";
            await this.asanaClient.tasks.getTasksForSection(section.id, {opt_fields: `${params}`, opt_pretty: true, limit: 100})
                .then(
                    (result) => {
                        jsonTasks.push(result.data);
                    },
                    (error) => {
                        console.log(error);
                    }
                );
        }
        return jsonTasks;
    }
    
    getTaskObjectsList(sectionsWithTasks) {
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
    
    handleTasks(tasks) {
        console.log('\n');
    
        for (const task of tasks) {
            // Find remote Branches
            let taskBranches = this.runInTerminal(`git branch --remotes | grep ${task.id} | tr '\n' ' '`);
            if (!taskBranches && !this.arguments.short) {
                this.printTask(task)
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
    
            // Skip tasks without problems when --short
            if (this.arguments.short && task.isReady()) {
                continue;
            }
            this.printTask(task)
        }
    }
    
    printTask(task) {
        if (task.hasReverts) {
            console.log('!! Has Reverts');
        }
        if (task.branches.length > 1) {
            console.log(`!! Found ${task.branches.length} branches`);
        }
    
        console.log(`   ${task.team}${task.name.substring(0, 120)} -> ${task.url}`);
    
        if (task.branches.length == 0) {
            console.log(`   ${task.id} -> No Branch\n\n`);
            return;
        }
        
        for (const branch of task.branches) {
            let okPrint = "!! "
            let isMergedPrint = " -> NOT Merged"
            if (branch.isMerged) {
                okPrint = "OK "
                isMergedPrint = " -> Merged"
            }
            console.log(`${okPrint}${task.id} -> ${branch.name} -> ${branch.lastCommitDateAbsolute} (${branch.lastCommitDateRelative})${isMergedPrint}`)
        }
        console.log("\n")
    }
}

class Branch {
    name;
    isMerged;
    lastCommitDateObject;
    lastCommitDateAbsolute;
    lastCommitDateRelative;

    constructor(name) {
        this.name = name;
        this.isMerged = true;
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
const releaseValidator = new ReleaseValidator();
releaseValidator.run()
