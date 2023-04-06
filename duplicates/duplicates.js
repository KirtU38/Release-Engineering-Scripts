const terminal = require('child_process');
const fs = require('fs')

let fileTypeToMarkers = {
    'profile-meta': [
        {'<apexClass>': null},
        {'<field>': null}
    ],
    'layout-meta': [
        {'<field>': '<layoutItems>'},
        {'<actionName>': null},
        {'<sortOrder>': null}
    ]
}

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
        let match = filePath.match(/.+\.(.+)\.\w+/i);
        let fileType = match[1];
        
        let file = fs.readFileSync(filePath, 'utf8');
        let fileSplit = file.split('\n').map((line) => line.trim());

        let linesArray = [];
        let tagsSequence = [];

        for (const line of fileSplit) {

            if(line.match(/\s*<\w+>\s*$/i)?.index == 0) {
                tagsSequence.push(line);
            } else if (line.match(/\s*<\/\w+>\s*$/i)?.index == 0) {
                tagsSequence.pop();
            }

            let lineObj = linesArray.find((lineObj) => lineObj.label == line);
            if(!fileTypeToMarkers[fileType]) {
                linesArray.push(new Line(line));
                continue;
            }
            for (const markerObject of fileTypeToMarkers[fileType]) {
                for (const marker in markerObject) {
                    if(!markerObject[marker] || tagsSequence[tagsSequence.length - 1] == markerObject[marker]) {
                        if(!line.startsWith(marker)) {
                            continue;
                        }
                        if(lineObj) {
                            lineObj.count++;
                        } else {
                            linesArray.push(new Line(line));
                        }
                    }
                }
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
