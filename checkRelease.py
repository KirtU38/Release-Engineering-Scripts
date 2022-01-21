import argparse
import json
import subprocess
import sys
from typing import List
import os


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

    def is_ready(self):
        return len(self.branches) == 1 and self.branches[0].is_merged and not self.has_reverts


def run_in_terminal(command):
    return subprocess.run(command, shell=True, capture_output=True, encoding='utf-8')


def parse_args():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "-u", "--url", type=str,
        help="URL of Asana Project. Example: -u https://app.asana.com/0/1201640226677955/list")

    parser.add_argument(
        "-s", "--sections", type=str,
        help="Sections in the project that need to be checked. Example: --sections 'ClickDeploy, Stories to Deploy'")

    parser.add_argument(
        "-t", "--token", type=str, help="You can pass Asana Access Token here, if Environment variable doesn't work. Example: --token '1/1200261239008160:0c75d3a830cfa6c7e7c6f8856cad3b21'")

    parser.add_argument(
        "--short", action="store_true", help="Show problems only (marked as !!)", default=False)

    return parser.parse_args()


def get_asana_token(hardcoded_asana_token, arg_asana_token, env_var_name):
    if hardcoded_asana_token:
        return hardcoded_asana_token
    elif arg_asana_token:
        return arg_asana_token

    try:
        return os.environ[env_var_name]
    except:
        print(f"Couldn't find any Asana Access Token in Environment variable {env_var_name}, --token Argument or Hardcoded")
        sys.exit()


def validate_token(token):
    response = run_in_terminal(f"""curl -X GET https://app.asana.com/api/1.0/users/me -H 'Authorization: Bearer {token}'""")
    if "Not Authorized" in response.stdout:
        print("Your Asana Access Token is not authorized")
        sys.exit()


def handle_help_arg(arguments):
    if '-h' in sys.argv:
        print(arguments.h)
        sys.exit()


def handle_sections_arg(arg_sections, default_sections):
    if not arg_sections:
        arg_sections = default_sections

    arg_sections_list = arg_sections.upper().split(",")
    for i, section in enumerate(arg_sections_list):
        arg_sections_list[i] = section.strip()

    return arg_sections_list


def validate_project_id(project_id):
    if len(project_id) != 16 or not project_id.isnumeric():
        print("Project ID is invalid, it must be 16 characters, numbers only")
        sys.exit()


def get_section_ids(project_id, token, arg_sections_arg: List[str]) -> dict:
    sections = run_in_terminal(f"""curl -X GET https://app.asana.com/api/1.0/projects/{project_id}/sections -H 'Accept: application/json' -H 'Authorization: Bearer {token}'""").stdout
    if "Not a recognized ID" in sections:
        print(f"Project with ID {project_id} doesn't exist")
        sys.exit()
    json_sections = json.loads(sections)

    section_ids = {}
    for section in json_sections['data']:
        if section['name'].upper() in arg_sections_arg:
            section_ids[section['name'].upper()] = section['gid']

    for section_name in arg_sections_arg:
        if not section_ids.get(section_name):
            print(f'Section "{section_name}" was not found')

    return section_ids


def get_tasks_in_json(section_ids: List[str], token):
    json_tasks = []
    for section_id in section_ids:
        tasks_raw = run_in_terminal(f"""curl -X GET https://app.asana.com/api/1.0/tasks?section={section_id} -H 'Accept: application/json' -H 'Authorization: Bearer {token}'""")
        json_tasks.append(json.loads(tasks_raw.stdout)['data'])
    return json_tasks


def get_tasks_list(tasks_json_for_sections, base_url) -> List[AsanaTask]:
    tasks: List[AsanaTask] = []
    for tasks_json in tasks_json_for_sections:
        for task in tasks_json:
            task_name = task['name']
            task_id = task['gid']
            task_url = f"{base_url}{task_id}"

            task_object = AsanaTask(task_name, task_id, task_url)
            tasks.append(task_object)

    return tasks


def handle_tasks(tasks: List[AsanaTask], short):
    print('\n')
    for task in tasks:
        # Find remote Branches
        task_branches = run_in_terminal(f"git branch --remotes | grep {task.id} | tr '\n' ' '")
        if not task_branches.stdout:
            if not short:
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
        if len(task.branches) > 0:
            for branch in task.branches:
                last_commit = run_in_terminal(f"git log {branch.name} -1 --oneline | awk '{{print $1}}'")
                is_merged = run_in_terminal(f"git log --oneline | grep {last_commit.stdout}")

                if is_merged.stdout != "":
                    branch.is_merged = True

        # Skip tasks without problems when --short
        if short and task.is_ready():
            continue
        print_task(task)


def print_task(task: AsanaTask):
    if task.has_reverts:
        print(f'!! Has Reverts')
    if len(task.branches) > 1:
        print(f'!! Found {len(task.branches)} branches')
    print(f"   {task.name} -> {task.url}")

    if len(task.branches) == 0:
        branch_print = f"No Branch"
        print(f'   {task.id} -> {branch_print}\n\n')
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


# Default variables
hardcoded_asana_token = ''
default_sections = 'ClickDeploy,Stories to Deploy'
env_var_name = "ASANA_TOKEN"

# Argument valiables
arguments = parse_args()
arg_asana_token = arguments.token
arg_short = arguments.short
arg_sections = arguments.sections
arg_project_url = arguments.url

# Asana client
asana_token = get_asana_token(hardcoded_asana_token, arg_asana_token, env_var_name)
validate_token(asana_token)

# Arguments parsing
handle_help_arg(arguments)
sections_list = handle_sections_arg(arg_sections, default_sections)
base_url = arg_project_url[:41]
project_id = arg_project_url.split("/")[-2]
validate_project_id(project_id)

# Getting info from Asana API
section_ids = get_section_ids(project_id, asana_token, sections_list)
tasks_json_for_sections = get_tasks_in_json(list(section_ids.values()), asana_token)
tasks = get_tasks_list(tasks_json_for_sections, base_url)
# tasks.append(AsanaTask('Task dummy', 1201636415789062, 'TestURL')) 
# tasks.append(AsanaTask('Task dummy 1', 1200783749941177, 'TestURL'))
handle_tasks(tasks, arg_short)
