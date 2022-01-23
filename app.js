const asana = require('asana');
const terminal = require('child_process');
const argParses = require('commander');
const { type } = require('os');

//  Default variables
const default_sections = 'ClickDeploy,Stories to Deploy'
const hardcoded_asana_token = '1/1200261239000160:0c75d3a8302fa6c7e7c6f8866cad3b21'
const env_var_name = "ASANA_TOKEN"

// Static variables
const arguments = parseArguments()
const asanaClient = asana.Client.create().useAccessToken(`${hardcoded_asana_token}`);

console.log(arguments);

let asana_token = getAsanaToken(hardcoded_asana_token, arguments.token, env_var_name)
validateToken(asana_token)

// Arguments parsing
let base_url = arguments.url.substring(0,41)
let project_id = arguments.url.split("/").slice(-2)[0]
validateProjectId(project_id)

// Getting info from Asana API
let sections = get_sections(project_id, arguments.sections, arguments.allSections)
let tasks_for_sections_json = get_tasks_from_sections_json(sections, asana_token, arguments.sprint)








class Branch {
    name;
    is_merged;

    constructor(name, is_merged) {
        this.name = name;
        this.is_merged = is_merged;
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

function parseArguments() {
    argParses
        .requiredOption('-u, --url <value>', 'output extra debugging')
        .option('-s, --sections [value]', 'output extra debugging', default_sections)
        .option('-a, --all-sections', 'output extra debugging', false)
        .option('-sp, --sprint [value]', 'output extra debugging')
        .option('-t, --token [value]', 'output extra debugging')
        .option('--short', 'output extra debugging', false)

    return argParses.parse(process.argv).opts()
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
    response = terminal.exec(`curl -X GET https://app.asana.com/api/1.0/users/me -H 'Authorization: Bearer ${token}'`,(error, stdout, stderr) =>{
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

function get_sections(projectId, argSections, checkAllSections) {
    sections_list = []
    if (!checkAllSections) {
        if (argSections) {
            sections_list = argSections.split(',').map((section) => section.trim().toUpperCase());
        }
    }

    sections_for_project_stdout = asanaClient.sections.getSectionsForProject(projectId, {opt_pretty: true})
        .then(
            (result) => {
                json_sections = result.data

                sections = []
                for (section of json_sections) {
                    if (checkAllSections || sections_list.includes(section.name.toUpperCase())) {
                        sections.push(new Section(section.name.toUpperCase(), section.gid))
                    }
                }

                if (checkAllSections) return sections;

                // Check not found sections
                let retrievedSectionsNames = sections.map((s) => s.name)
                for (section_name of sections_list) {
                    if (!retrievedSectionsNames.includes(section_name)) {
                        console.log(`Section "${section_name}" was not found`);
                    }
                }
            },
            (error) => {
                console.log(`Project with ID ${project_id} doesn't exist`);
                process.exit(1)
            }
        );
}

function get_tasks_from_sections_json(sections, token, filter_by_sprint) {
    let params = "gid,name"
    if (filter_by_sprint) {
        params = `${params},custom_fields`
    }
    
    console.log('Retrieving Tasks from Sections:');
    json_tasks = []
    for (section of sections) {
        print(section.name)



        client.tasks.getTasksForSection(section.id, {"?opt_fields": `${params}`, opt_pretty: true})
            .then((result) => {
                console.log(result);
            });


        tasks_for_section = run_in_terminal(f"""curl -X GET https://app.asana.com/api/1.0/sections/{section.id}/tasks{params} -H 'Accept: application/json' -H 'Authorization: Bearer {token}'""")
        json_tasks.push(json.loads(tasks_for_section.stdout)['data'])
    }
    return json_tasks
}


// client.tasks.getTask(arguments.id, {param: "value", param: "value", opt_pretty: true})
//     .then((result) => {
//         console.log(result);
//     },(err) => {
//         console.log(err.value.errors);
//     });

// console.log(default_sections);