import subprocess
import sys
from typing import List
import requests
from bs4 import BeautifulSoup as BS
from re import search
import os.path

# bashCommand = f'git log'
# process = subprocess.run(bashCommand, shell=True, capture_output=True, encoding='utf-8')
# errors = process.stderr
# out = process.stdout
# code = process.returncode

# url1 = 'https://app.asana.com/0/1201640226677955/list'
# respone = requests.get(url1, headers={
#     "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
#     "Accept-Encoding": "gzip, deflate, br",
#     "Host": "app.asana.com",
#     "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36",
#     "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,tg;q=0.6"
#     # "Cookie": "logged_out_uuid=3c9498ea35610143c0f6b5ab9e408b0f; _cs_c=0; _hjid=b616cf49-c1b5-419d-a563-17a7bf216a9a; _mkto_trk=id:784-XZD-582&token:_mch-asana.com-1618308564920-65293; lang_pref=en; p=1; browser_id=eeda85827f453b31be521a5cc1ce698b; G_ENABLED_IDPS=google; last_domain=15793206719; _biz_uid=c0ae7abf873142c6af70fe450b1e6b3e; _biz_flagsA={\"Version\":1,\"Mkto\":\"1\",\"ViewThrough\":\"1\",\"XDomain\":\"1\"}; ivd_snapshot_cookie_gtm=93.100.169.128_false; ivd_session_cookie_gtm=1629801606340; _cs_id=c9d5b45a-465d-a032-fcf5-ee692d7afc62.1619501115.4.1632075263.1632075263.1.1653665115070; FPID=FPID2.2.aWVCaV9K6pMghVbdmcljVSdUdr1Z+dxrNMnjRPWmiXQ=.1619500234; _biz_nA=3; _biz_pendingA=[]; has_desktop_app=true; disable_app_links=true; server=prod-ws055.ec2|YUy99; _uetvid=a5c1e2c004c711eca43809f5aa09329e; _gcl_au=1.1.555091014.1638263930; TooBusyRedirectCount=0; asana_orig_attr={\"source\":\"https://app.asana.com/\",\"query_string\":\"\",\"exit_page\":\"/-/tracking\",\"landing_page\":\"/-/tracking\",\"useragent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36\",\"timestamp\":1641894692,\"convNum\":482321563}; user=1200261239000160; xsrf_token=26a7d6b2f45445b1da21c00da39c5adc:1642606624702; _gid=GA1.2.367837123.1642606626; FPLC=BmvJk8DoaCTLS6Ftdcbafu9LjEomnz7kMnj9S4aTOghzWIxltPQPUMh1jwkvoCVTvi37R+hYQG6Vd9P13Vtu4CuLAkuUooRboUDoL14mcapbOKnXWmWNmlqn4X5X4g==; OptanonConsent=isIABGlobal=false&datestamp=Wed+Jan+19+2022+18:44:38+GMT+0300+(Москва,+стандартное+время)&version=6.22.0&hosts=&landingPath=NotLandingPage&groups=C0001:1,C0002:1,C0003:1,C0004:1&AwaitingReconsent=false&consentId=ff01703c-343f-4301-b848-d2c8441af29d&interactionCount=0; _ga_J1KDXMCQTH=GS1.1.1642606625.12.0.1642607078.60; _ga=GA1.2.398437131.1619500234; google_email=egorbeloshitskiy-aq@team.asana.com; auth_token=488f444e5f9eb232e7a160ddc5596c20; ticket=5728bb9f344ad2038b91c8e3b8ed4a150a37f47bb9b6fc1af1771dd8b85458e4; is_logged_in=true"
# }, auth=('egorbeloshitskiy-aq@team.asana.com', 'Supermanegor1994'))
# print(respone.text)
# sys.exit()

class AsanaTask:

    name: str
    id: int
    branches: List[str]
    is_merged: bool
    has_reverts: bool
    url: str

    def __init__(self, name, id, url) -> None:
        self.name = name
        self.id = id
        self.url = url
        self.branches = []
        self.is_merged = False
        self.has_reverts = False

def open_html_file(html_file_arg, user_name):

    is_on_desktop = os.path.isfile(f"/Users/{user_name}/Desktop/{html_file_arg}")
    is_in_downloads = os.path.isfile(f"/Users/{user_name}/Downloads/{html_file_arg}")

    if is_on_desktop:
        return open(f"/Users/{user_name}/Desktop/{html_file_arg}", 'r')
    elif is_in_downloads:
        return open(f"/Users/{user_name}/Downloads/{html_file_arg}", 'r')
    else:
        print("Place .html file on Desktop or in Downloads")
        sys.exit()

def get_tasks_from_html(html_by_lines: List[str], html):

    tasks: List[AsanaTask] = []
    started = False
    base_url = ""
    for i, line in enumerate(html_by_lines):

        if base_url == "" and search('.*class="Tab-link BaseLink" href.*list.*', line):
            base_url = line[line.find('href') + 6:-2]

        if 'PotColumnName-nameButton' in line:
            if "ClickDeploy" in html_by_lines[i + 1] or "Stories to Deploy" in html_by_lines[i + 1]:
                started = True
                continue
            elif started:
                break
        
        if not started:
            continue

        match = search('.*id="Pot.*', line)
        if not match:
            continue

        line_split = line.split(' ')
        for arg in line_split:
            if 'id="Pot.' not in arg:
                continue

            element_id = arg.split('"')[1]
            task_name = html.find(id=element_id).text
            task_id = arg.split('_')[-1][:-1]
            task_url: str = f"{base_url[:41]}{task_id}"

            task = AsanaTask(task_name, task_id, task_url)
            tasks.append(task)
            break

    return tasks

def print_task(task: AsanaTask):

    if len(task.branches) == 1 and task.is_merged == True and not task.has_reverts:
        ok_print = "OK "
    elif len(task.branches) > 1 or task.has_reverts or (len(task.branches) == 1 and not task.is_merged):
        ok_print = "!! "
    else:
        ok_print = "   "

    if len(task.branches) > 1:
        branch_print = f"Has {len(task.branches)} Branches"
    elif len(task.branches) == 0:
        branch_print = f"No Branch"
    else:
        branch_print = task.branches[0]

    if task.is_merged:
        is_merged_print = " -> Fully merged"
    elif len(task.branches) == 1 and task.is_merged == False:
        is_merged_print = " -> NOT Fully merged"
    else:
        is_merged_print = ""

    has_reverts_print = ""
    if task.has_reverts:
        has_reverts_print = " -> HAS REVERTS"
    else:
        has_reverts_print = ""

    print(f"   {task.name} -> {task.url}")
    print(f'{ok_print}{task.id} -> {branch_print}{is_merged_print}{has_reverts_print}\n')

def handle_tasks(tasks: List[AsanaTask]):

    print('\n')
    for task in tasks:
        # Find remote Branches
        task_branches = subprocess.run(f'git branch --remotes | grep {task.id}', shell=True, capture_output=True, encoding='utf-8')
        if not task_branches.stdout:
            print_task(task)
            continue
        # Add Branches to object
        task_branches_split = task_branches.stdout.strip().split("  ")
        for branch in task_branches_split:
            task.branches.append(branch)

        # Check for reverts
        revert_commits = subprocess.run(f'git log --oneline | grep {task.id} | grep -i revert', shell=True, capture_output=True, encoding='utf-8')
        if revert_commits.stdout != "":
            task.has_reverts = True

        # Check if fully merged
        if(len(task.branches) == 1):
            last_commit = subprocess.run(f"git log {task.branches[0]} -1 --oneline | awk '{{print $1}}'", shell=True, capture_output=True, encoding='utf-8')
            is_merged = subprocess.run(f"git log --oneline | grep {last_commit.stdout}", shell=True, capture_output=True, encoding='utf-8')

            if is_merged.stdout != "":
                task.is_merged = True

        print_task(task)


# Program start
html_file_arg = sys.argv[1]
user_name = "egor"

html_file = open_html_file(html_file_arg, user_name)

# Split HTML file to lines
html_file_with_lines = html_file.read()
html_file.close()
html = BS(html_file_with_lines, 'html.parser')
html_pretty = html.body.prettify()
html_by_lines = html_pretty.split('\n')


# Parse Tasks from HTML
tasks = get_tasks_from_html(html_by_lines, html)
# УДАЛИ ПОТОМ
tasks.append(AsanaTask('NOT MERGED Task dummy', 1201673300333083, 'TestURL')) 
tasks.append(AsanaTask('REVERTED Task dummy', 1201066088006202, 'TestURL'))
handle_tasks(tasks)


# browser = webdriver.Chrome('/Users/egor/Downloads/chromedriver')
# browser.get("https://app.asana.com/0/1201640226677955/list")
# google_login_button = browser.find_element_by_xpath('/html/body/div[1]/div/div[1]/div[2]/div[3]')
# google_login_button.click()
# username = browser.find_element_by_xpath("/html/body/div[1]/div[1]/div[2]/div/div[2]/div/div/div[2]/div/div[1]/div/form/span/section/div/div/div[1]/div/div[1]/div/div[1]/input")
# username.send_keys("egorbeloshitskiy-aq@team.asana.com")
# next_button = browser.find_element_by_xpath("/html/body/div[1]/div[1]/div[2]/div/div[2]/div/div/div[2]/div/div[2]/div/div[1]/div/div/button")
# next_button.click()

# sleep(1000000)

