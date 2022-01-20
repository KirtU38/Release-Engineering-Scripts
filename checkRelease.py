import json
import subprocess
import sys
from typing import List
import os
import asana


class Branch:
    name: str
    is_merged: bool

    def __init__(self, name) -> None:
        self.name = name
        self.is_merged = False


class AsanaTask:
    name: str
    id: int
    branches: List[Branch]
    has_reverts: bool
    url: str

    def __init__(self, name, id, url) -> None:
        self.name = name
        self.id = id
        self.url = url
        self.branches = []
        self.has_reverts = False


def run_in_terminal(command):
    return subprocess.run(command, shell=True, capture_output=True, encoding='utf-8')


def get_asana_token(env_var_name):
    asd = run_in_terminal("source ~/.bash_profile")
    try:
        return os.environ[env_var_name]
    except:
        print(f"Couldn't find Environment variable {env_var_name}")
        sys.exit()


def get_section_id(project_id, token, project_url) -> str:
    sections = run_in_terminal(f"""curl -X GET https://app.asana.com/api/1.0/projects/{project_id}/sections -H 'Accept: application/json' -H 'Authorization: Bearer {token}'""")
    json_sections = json.loads(sections.stdout)

    for section in json_sections['data']:
        if section['name'] == 'ClickDeploy' or section['name'] == 'Stories to Deploy':
            return section['gid']

    print(f'No section "ClickDeploy" or "Stories to Deploy" in Project {project_url}')
    sys.exit()


def get_tasks_in_json(section_id, token):
    tasks_raw = run_in_terminal(f"""curl -X GET https://app.asana.com/api/1.0/tasks\?section\={section_id} -H 'Accept: application/json' -H 'Authorization: Bearer {token}'""")
    return json.loads(tasks_raw.stdout)['data']


def get_tasks_list(tasks_json, base_url) -> List[AsanaTask]:
    tasks: List[AsanaTask] = []
    for task in tasks_json:
        task_name = task['name']
        task_id = task['gid']
        task_url = f"{base_url}{task_id}"

        task_object = AsanaTask(task_name, task_id, task_url)
        tasks.append(task_object)

    return tasks


def handle_tasks(tasks: List[AsanaTask]):
    print('\n')

    for task in tasks:
        # Find remote Branches
        task_branches = run_in_terminal(f"git branch --remotes | grep {task.id} | tr '\n' ' '")
        if not task_branches.stdout:
            print_task(task)
            continue

        # Add Branches to object
        task_branches_split = task_branches.stdout.strip().split("  ")
        for branch in task_branches_split:
            task.branches.append(Branch(branch.strip()))

        # Check for reverts
        revert_commits = run_in_terminal(f'git log --oneline | grep {task.id} | grep -i revert')
        if revert_commits.stdout != "":
            task.has_reverts = True

        # Check if fully merged
        if (len(task.branches) > 0):
            for branch in task.branches:
                last_commit = run_in_terminal(f"git log {branch.name} -1 --oneline | awk '{{print $1}}'")
                is_merged = run_in_terminal(f"git log --oneline | grep {last_commit.stdout}")

                if is_merged.stdout != "":
                    branch.is_merged = True

        print_task(task)


def print_task(task: AsanaTask):

    if task.has_reverts:
        print(f'!! Has Reverts')
    if len(task.branches) > 1:
        print(f'!! Found {len(task.branches)} branches')
    print(f"   {task.name} -> {task.url}")

    if len(task.branches) == 0:
        branch_print = f"No Branch"
        print(f'   {task.id} -> {branch_print}\n')
        return
    
    for branch in task.branches:
        branch_print = branch.name

        if branch.is_merged:
            ok_print = "OK "
            is_merged_print = " -> Merged"
        else:
            ok_print = "!! "
            is_merged_print = " -> NOT Merged"

        print(f'{ok_print}{task.id} -> {branch_print}{is_merged_print}')
    print("\n")

    


# Program start
env_var_name = "ASANA_TOKEN"

asana_token = get_asana_token(env_var_name)
project_url = sys.argv[1]
base_url = project_url[:41]
project_id = project_url.split("/")[-2]
client = asana.Client.access_token(asana_token)

section_id = get_section_id(project_id, asana_token, project_url)

tasks_json = get_tasks_in_json(section_id, asana_token)
tasks = get_tasks_list(tasks_json, base_url)
# tasks.append(AsanaTask('NOT MERGED Task dummy', 1201636415789062, 'TestURL')) 
# tasks.append(AsanaTask('REVERTED Task dummy', 1200783749941177, 'TestURL'))
handle_tasks(tasks)
