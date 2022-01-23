const asana = require('asana');
const terminal = require('child_process');
const argParses = require('commander');

//  Default variables
const default_sections = 'ClickDeploy,Stories to Deploy'
const hardcodedAsanaToken = ''
const envVarName = "ASANA_TOKEN"

run()

class Branch {
    name;
    isMerged;

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
    branches;
    hasReverts;
    url;

    constructor(name, id, url) {
        this.name = name;
        this.id = id;
        this.url = url;
        this.branches = [];
        this.hasReverts = undefined;
    }

    isReady() {
        return this.branches.length == 1 && this.branches[0].isMerged && !this.hasReverts
    }
}

async function run() {
    const arguments = await parseArguments();
    const asanaToken = getAsanaToken(hardcodedAsanaToken, arguments.token, envVarName);
    validateToken(asanaToken);
    const asanaClient = await asana.Client.create().useAccessToken(asanaToken);
    
    // Arguments parsing
    let baseUrl = arguments.url.substring(0,41);
    let projectId = arguments.url.split("/").slice(-2)[0];
    validateProjectId(projectId);
    
    // Getting info from Asana API
    let sections = await getSections(projectId, asanaClient, arguments.sections, arguments.allSections);
    let tasksForSectionsJson = await getTasksFromSectionsJson(sections, asanaClient, arguments.sprint);
    let tasks = getTasksObjectsList(tasksForSectionsJson, baseUrl, arguments.sprint);

    // tasks.push(new AsanaTask('Task dummy', 1201636415789062, 'TestURL')) 
    // tasks.push(new AsanaTask('Task dummy 1', 1200783749941177, 'TestURL'))
    handleTasks(tasks, arguments.short);
}

function parseArguments() {
    argParses
        .requiredOption('-u, --url <value>', 'output extra debugging')
        .option('-s, --sections [value]', 'output extra debugging', default_sections)
        .option('-a, --all-sections', 'output extra debugging', false)
        .option('-sp, --sprint [value]', 'output extra debugging')
        .option('-t, --token [value]', 'output extra debugging')
        .option('--short', 'output extra debugging', false)

    return argParses.parse(process.argv).opts();
}

function getAsanaToken(hardcoded_asana_token, arg_asana_token, env_var_name) {
    if (hardcoded_asana_token) {
        return hardcoded_asana_token;
    } else if (arg_asana_token) {
        return arg_asana_token;
    }

    if (process.env[env_var_name]) {
        return process.env[env_var_name];
    } else {
        console.log(`Couldn't find any Asana Access Token in Environment variable ${env_var_name}, --token Argument or Hardcoded`);
        process.exit(1);
    }
}

function validateToken(token) {
    console.log(`Authorization: `);
    terminal.exec(`curl -X GET https://app.asana.com/api/1.0/users/me -H 'Authorization: Bearer ${token}'`, (error, stdout, stderr) => {
        if (stdout.includes('Not Authorized')) {
            console.log('Your Asana Access Token is not authorized');
            process.exit(1);
        }
    })
}

function validateProjectId(project_id) {
    if (project_id.length != 16 || !project_id.match(/^\d+$/)) {
        console.log('Project ID is invalid, it must be 16 characters, numbers only');
        process.exit(1)
    }
}

async function getSections(projectId, asanaClient, argSections, checkAllSections) {
    let chosenSectionsStringList = []
    if (!checkAllSections) {
        if (argSections) {
            chosenSectionsStringList = argSections.split(',').map((section) => section.trim().toUpperCase());
        }
    }

    return await asanaClient.sections.getSectionsForProject(projectId, {opt_pretty: true})
        .then(
            (result) => {
                json_sections = result.data

                let retrievedSectionsObjects = []
                for (section of json_sections) {
                    if (checkAllSections || chosenSectionsStringList.includes(section.name.toUpperCase())) {
                        retrievedSectionsObjects.push(new Section(section.name.toUpperCase(), section.gid))
                    }
                }

                if (checkAllSections) return retrievedSectionsObjects;

                // Check not found sections
                let retrievedSectionsNames = retrievedSectionsObjects.map((s) => s.name)
                for (section_name of chosenSectionsStringList) {
                    if (!retrievedSectionsNames.includes(section_name)) {
                        console.log(`Section "${section_name}" was not found`);
                    }
                }
                return retrievedSectionsObjects;
            },
            (error) => {
                console.log(`Project with ID ${project_id} doesn't exist`);
                process.exit(1)
            }
        );
}

async function getTasksFromSectionsJson(sections, asanaClient, filterBySprint) {
    let params = "gid,name";
    if (filterBySprint) {
        params = `${params},custom_fields`;
    }
    
    console.log('Retrieving Tasks from Sections:');
    let json_tasks = [];
    for (section of sections) {
        console.log(section.name);

        await asanaClient.tasks.getTasksForSection(section.id, {opt_fields: `${params}`, opt_pretty: true})
            .then(
                (result) => {
                    json_tasks.push(result.data);
                },
                (error) => {
                    console.log(error);
                }
            );
    }
    return json_tasks;
}

function getTasksObjectsList(tasks_for_sections_json, base_url, filterBySprint) {
    let tasks  = []
    for (tasks_json of tasks_for_sections_json) {
        for (task of tasks_json) {

            // Filter by sprint if it was chosen
            if (filterBySprint) {
                let sprintField = task.custom_fields.find((field) => field.name == 'BT Sprint - FY22');
                if (!sprintField || !sprintField.display_value 
                        || !sprintField.display_value.toUpperCase().includes(filterBySprint.toUpperCase())) 
                    {
                    continue;
                }
            }

            let task_url = `${base_url}${task.gid}`;
            let task_object = new AsanaTask(task.name, task.gid, task_url);
            tasks.push(task_object);
        }
    }

    if (tasks.length == 0) {
        console.log('No Tasks found');
        process.exit(1)
    }
    return tasks
}

function handleTasks(tasks, short) {
    console.log('\n');

    for (task of tasks) {
        // Find remote Branches
        let taskBranches = terminal.execSync(`git branch --remotes | grep ${task.id} | tr '\n' ' '`).toString();
        if (!taskBranches && !short) {
            printTask(task)
            continue;
        }

        // Add Branches to object
        let taskBranchesSplit = taskBranches.trim().split(/\s+/);
        for (branch of taskBranchesSplit) {
            task.branches.push(new Branch(branch.trim()));
        }

        // Check for reverts
        try {
            terminal.execSync(`git log --oneline | grep '${task.id}' | grep -i revert`).toString();
        } catch (e) {
            task.hasReverts = false;
        }

        // Check if fully merged
        if (task.branches.length > 0) {
            for (branch of task.branches) {
                let lastCommit = terminal.execSync(`git log ${branch.name} -1 --oneline | awk '{print $1}'`).toString();
                try {
                    let lastCommitIsMerged = terminal.execSync(`git log --oneline | grep ${lastCommit}`).toString();
                } catch (e) {
                    branch.isMerged = false;
                }
            }
        }

        // Skip tasks without problems when --short
        if (short && task.isReady()) {
            continue;
        }
        printTask(task)
    }
}

function printTask(task) {
    if (task.hasReverts) {
        console.log('!! Has Reverts');
    }
    if (task.branches.length > 1) {
        console.log(`!! Found ${task.branches.length} branches`);
    }

    console.log(`   ${task.name} -> ${task.url}`);

    if (task.branches.length == 0) {
        console.log(`   ${task.id} -> No Branch\n\n`);
        return;
    }

    
    for (branch of task.branches) {
        let okPrint = "!! "
        let isMergedPrint = " -> NOT Merged"
        if (branch.isMerged) {
            okPrint = "OK "
            isMergedPrint = " -> Merged"
        }
        console.log(`${okPrint}${task.id} -> ${branch.name}${isMergedPrint}`)
    }
    console.log("\n")
}
