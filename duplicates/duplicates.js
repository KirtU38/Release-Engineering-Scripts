const terminal = require('child_process');
const fs = require('fs')

class ReleaseValidator {

    runInTerminal(command) {
        try {
            return terminal.execSync(command).toString();
        } catch (error) {
            return null;
        }
    }

    async run() {
        let filePath = process.argv[2];
        
        let file = fs.readFileSync(filePath, 'utf8');
        let fileSplit = file.split('\n').map((line) => line.trim());

        let linesArray = [];
        for (const line of fileSplit) {
            let lineObj = linesArray.find((lineObj) => lineObj.label == line);
            if(lineObj) {
                lineObj.count++;
            } else {
                linesArray.push(new Line(line));
            }
        }

        for (const lineObj of linesArray.sort((a, b) => b.count - a.count)) {
            if(lineObj.count > 1) {
                console.log(`${lineObj.count} - ${lineObj.label}`);
            }
        }
    }
}

class Line {
    label;
    count;

    constructor(label) {
        this.label = label;
        this.count = 1;
    }
}

// Prorgam run
const releaseValidator = new ReleaseValidator();
releaseValidator.run()
