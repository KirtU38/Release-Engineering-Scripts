const asana = require('asana');
const terminal = require('child_process');
const argParser = require('commander');
const input = require('prompt-sync')();

//  Default variables
const allSections = 'ClickDeploy,Stories to Deploy,User Stories,Deployment,Pre Deployment,Post Deployment'
const deploySections = 'ClickDeploy,Stories to Deploy,User Stories,Deployment'
const hardcodedAsanaToken = ''
const envVarName = "ASANA_TOKEN"
const rePre = /.*preds.*|.*pre.*depl.*|.*pre.*ds.*/gi;
const rePost = /.*postds.*|.*post.*depl.*|.*post.*ds.*|pds/gi;

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
        this.asanaClient.LOG_ASANA_CHANGE_WARNINGS = false
        let allSectionsStringList = this.arguments.sections.split(',').map((section) => section.trim().toUpperCase());
        let deploySectionsStringList = deploySections.split(',').map((section) => section.trim().toUpperCase());

        let sections = await this.getSections(allSectionsStringList);
        let deploySection = sections.find(section => deploySectionsStringList.includes(section.name))

        let tasksFromSectionsJson = await this.getTasksFromSectionsJson(deploySection);
        let taskObjects = this.getTaskObjectsList(tasksFromSectionsJson);

        for (const task of taskObjects) {
            await this.getSubtask(task)
        }

        let preDsSection = sections.find(section => section.name.includes('PRE D'))
        let postDsSection = sections.find(section => section.name.includes('POST D'))
        await this.addTasksToPdsSection(rePre, preDsSection, taskObjects)
        await this.addTasksToPdsSection(rePost, postDsSection, taskObjects)
    }

    runInTerminal(command) {
        try {
            return terminal.execSync(command).toString();
        } catch (error) {
            return null;
        }
    }

    async addTasksToPdsSection(re, section, taskObjects) {
        let pdsTasks = this.filterPdsTasks(re, taskObjects);
        pdsTasks = this.getUserInput(pdsTasks, section);

        for (const subTask of pdsTasks) {
            if(subTask.name.search(re) >= 0) {
                await this.addSubtaskToPdsSection(subTask, section);
            }
        }
    }

    filterPdsTasks(re, taskObjects) {
        let pdsTasks = []
        for (const task of taskObjects) {
            for (const subTask of task.subTasks) {
                if(subTask.name.search(re) >= 0) {
                    pdsTasks.push(subTask)
                }
            }
        }
        return pdsTasks;
    }

    getUserInput(pdsTasks, section) {
        let response = ''
        while(response.trim() != 'y') {
            console.log('==============================================================================================');
            for (const pdsTask of pdsTasks) {
                console.log(`${pdsTask.gid} - ${pdsTask.name}`);
            }
            console.log('==============================================================================================');
            response = input(`Add these tasks to ${section.name} section? [y/n/<task id>]: `);
            if(response.trim() == 'n') {
                return [];  
            } 
            pdsTasks = pdsTasks.filter(task => task.gid != response.trim())
        }
        return pdsTasks;
    }

    async addSubtaskToPdsSection(subTask, section) {
        return await this.asanaClient.sections.addTaskForSection(section.id, {task: subTask.gid, opt_pretty: true})
            .then(
                (result) => {
                    console.log(`${subTask.gid} ${subTask.name} - added to ${section.name}`);
                },
                (error) => {
                    console.log(error);
                    process.exit(1);
                }
            );
    }

    async getSubtask(task) {
        return await this.asanaClient.tasks.getSubtasksForTask(task.id, {opt_pretty: true})
            .then(
                (result) => {
                    task.subTasks = result.data;
                },
                (error) => {
                    console.log(error);
                    process.exit(1);
                }
            );
    }

    parseArguments() {
        argParser
            .requiredOption('-u, --url <value>', 'URL of Asana Project. Example: -u https://app.asana.com/0/1201640226677955/list')
            .option('-s, --sections [value]', "Sections in the project that need to be checked. Example: --sections 'ClickDeploy, Stories to Deploy'", allSections)
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
    
    async getSections(chosenSectionsStringList) {
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
    
                    return retrievedSectionsObjects;
                },
                (error) => {
                    console.log(`Project with ID ${this.projectId} doesn't exist`);
                    process.exit(1);
                }
            );
    }
    
    async getTasksFromSectionsJson(section) {
        console.log('Retrieving Tasks from Section:');
        let jsonTasks = [];
        console.log(section.name);
            
        let params = "gid,name,custom_fields";
        await this.asanaClient.tasks.getTasksForSection(section.id, {opt_fields: `${params}`, opt_pretty: true})
            .then(
                (result) => {
                    jsonTasks.push(result.data);
                },
                (error) => {
                    console.log(error);
                }
            );
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
    subTasks;

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
