const terminal = require('child_process');

const branchToOrg = new Map();
branchToOrg.set('project/cpq', 'org_cpqqa');
branchToOrg.set('develop', 'org_aquiva');
branchToOrg.set('CPQ', 'org_cpq');
branchToOrg.set('dev', 'org_dev');
branchToOrg.set('UAT', 'org_uat');
branchToOrg.set('project/gutenberg-1200713104757990', 'org_gutenberg');
branchToOrg.set('project/zuora-prorate-1202326472081710', 'org_cpqprorate');
branchToOrg.set('project/true-up', 'org_trueup');
branchToOrg.set('project/quarterly-billing-1202408684414738', 'org_qbilling');
branchToOrg.set('QBILLUAT', 'org_qbilluat');
branchToOrg.set('project/gold', 'org_gold');
branchToOrg.set('project/rev-phase2', 'org_cpqphase2');

class ReleaseValidator {

    runInTerminal(command) {
        try {
            return terminal.execSync(command).toString();
        } catch (error) {
            return null;
        }
    }

    async run() {
        let currentBranch = this.runInTerminal('git rev-parse --abbrev-ref HEAD').trim();
        
        let orgAlias = '';
        let orgAliasArg = process.argv[2];
        let orgAliasDefault = branchToOrg.get(currentBranch);

        if(orgAliasArg) {
            orgAlias = orgAliasArg;
        } else {
            orgAlias = orgAliasDefault;
        }
        
        if(!orgAlias) process.exit(1);

        let orgName = orgAlias.replace('org_', '');
        console.log(`Validating ${currentBranch} on ${'.' + orgName}:`);
        console.log(`https://asana--${orgName}.lightning.force.com/lightning/setup/DeployStatus/home`);

        this.runInTerminal(`sfdx force:source:deploy -p force-app -u ${orgAlias} -l RunLocalTests -c`);
    }
}

// Prorgam run
const releaseValidator = new ReleaseValidator();
releaseValidator.run()
