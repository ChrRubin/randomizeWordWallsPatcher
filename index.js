/* global info, xelib, registerPatcher, patcherUrl, fh, patcherPath */

const rwwSettingsPath = `${patcherPath}\\rwwSettings.json`;
const rwwLogPath = `${patcherPath}\\rwwLog.txt`;

class ChrCustomError extends Error {
    constructor(message) {
        super(message);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ChrCustomError);
        }
        this.name = "ChrCustomError";
    }
}

class WordWallRefr {
    constructor(refrHandle) {
        this.handle = refrHandle;
        this.formid = xelib.GetHexFormID(refrHandle);
        this.script = xelib.GetElement(refrHandle, "VMAD\\Scripts\\[0]");

        this.myWord01 = xelib.GetScriptProperty(this.script, "myWord01");
        this.myWord02 = xelib.GetScriptProperty(this.script, "myWord02");
        this.myWord03 = xelib.GetScriptProperty(this.script, "myWord03");
        this.shoutGlobal = xelib.GetScriptProperty(this.script, "shoutGlobal");

        if (!this.script) {
            throw new ChrCustomError(`${this.formid} does not have a script.`);
        }
        else if (!this.myWord01) {
            throw new ChrCustomError(`${this.formid}'s script does not have a myWord01 property.`);
        }
        else if (!this.myWord02) {
            throw new ChrCustomError(`${this.formid}'s script does not have a myWord02 property.`);
        }
        else if (!this.myWord03) {
            throw new ChrCustomError(`${this.formid}'s script does not have a myWord03 property.`);
        }
        else if (!this.shoutGlobal) {
            throw new ChrCustomError(`${this.formid}'s script does not have a shoutGlobal property.`);
        }

        this.myWord01Value = this.getScriptPropertyValue(this.myWord01);
        this.myWord02Value = this.getScriptPropertyValue(this.myWord02);
        this.myWord03Value = this.getScriptPropertyValue(this.myWord03);
        this.shoutGlobalValue = this.getScriptPropertyValue(this.shoutGlobal);

        let cell = xelib.GetLinksTo(this.handle, "Cell");
        if (!cell) {
            this.cellName = "";
        }
        this.cellName = xelib.LongName(cell);
    }

    getScriptPropertyValue(scriptProperty) {
        const valuePath1 = "Value\\Object Union\\Object v1\\FormID";
        const valuePath2 = "Value\\Object Union\\Object v2\\FormID";

        let value = xelib.GetElement(scriptProperty, valuePath1);
        if (value) {
            return value;
        }

        return xelib.GetElement(scriptProperty, valuePath2);
    }
}

function validateObject(object, ...properties) {
    let valid = true;
    for (let i = 0; i < properties.length; i++) {
        const property = properties[i];
        if (!Object.prototype.hasOwnProperty.call(object, property)) {
            valid = false;
            break;
        }
    }
    return valid;
}

function getFormIDWithLO(fileHandle, shortFormID) {
    const loadOrder = xelib.Hex(xelib.GetFileLoadOrder(fileHandle), 2);
    return `${loadOrder}${shortFormID}`;
}

function getRecordHandleWithLO(fileHandle, shortFormID) {
    const formID = getFormIDWithLO(fileHandle, shortFormID);
    let recordHandle = xelib.GetElement(fileHandle, formID);
    if (!recordHandle) {
        throw new ChrCustomError(`Unable to load ${formID}!`);
    }
    return recordHandle;
}

function shuffleArray(array) {
    return array.map(a => [Math.random(), a]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
}

registerPatcher({
    info: info,
    gameModes: [xelib.gmSSE, xelib.gmTES5],
    settings: {
        label: 'Randomize Word Walls Patcher',
        templateUrl: `${patcherUrl}/partials/settings.html`,
        defaultSettings: {
            setEsl: true,
            patchFileName: 'RandomWordWallsPatch.esp'
        }
    },
    execute: (patchFile, helpers, settings, locals) => ({
        initialize: () => {
            if (!fh.jetpack.exists(rwwSettingsPath)) {
                throw new ChrCustomError("Unable to find settings.json!");
            }

            let settingsJson = fh.loadJsonFile(rwwSettingsPath);
            if (!validateObject(settingsJson, "wordWallTriggers", "blacklist")) {
                throw new ChrCustomError("Invalid settings.json at root!");
            }

            locals.outputArray = [];
            const ignoredLog = `Ignored files: ${settings.ignoredFiles.join(", ")}`;
            helpers.logMessage(ignoredLog);
            locals.outputArray.push(ignoredLog);

            helpers.logMessage("Loading Word Wall Triggers...");
            locals.wordWallTriggers = [];
            let wordWallTriggerIDs = [];

            settingsJson.wordWallTriggers.forEach(triggerData => {
                if (!validateObject(triggerData, "pluginName", "triggerID")) {
                    throw new ChrCustomError("Invalid settings.json at wordWallTriggers!");
                }

                for (let i = 0; i < settings.ignoredFiles.length; i++) {
                    const file = settings.ignoredFiles[i];
                    if (file.trim().toUpperCase() === triggerData.pluginName.trim().toUpperCase()) {
                        helpers.logMessage(`${triggerData.pluginName} ignored. Skipping its trigger...`);
                        return;
                    }
                }

                let file = xelib.FileByName(triggerData.pluginName);
                if (!file) {
                    helpers.logMessage(`${triggerData.pluginName} not found. Skipping its trigger...`);
                    return;
                }

                wordWallTriggerIDs.push(getFormIDWithLO(file, triggerData.triggerID));
                locals.wordWallTriggers.push(getRecordHandleWithLO(file, triggerData.triggerID));
            });

            const triggerLog = `Loaded triggers: ${wordWallTriggerIDs.join(", ")}`;
            helpers.logMessage(triggerLog);
            locals.outputArray.push(triggerLog);

            helpers.logMessage("Loading REFR blacklist...");
            locals.refrIdBlacklist = [];

            settingsJson.blacklist.forEach(blacklistData => {
                if (!validateObject(blacklistData, "pluginName", "refrs")) {
                    throw new ChrCustomError("Invalid settings.json at blacklist!");
                }

                for (let i = 0; i < settings.ignoredFiles.length; i++) {
                    const file = settings.ignoredFiles[i];
                    if (file.trim().toUpperCase() === blacklistData.pluginName.trim().toUpperCase()) {
                        helpers.logMessage(`${blacklistData.pluginName} ignored. Skipping its blacklist...`);
                        return;
                    }
                }

                let file = xelib.FileByName(blacklistData.pluginName);
                if (!file) {
                    helpers.logMessage(`${blacklistData.pluginName} not found. Skipping its blacklist...`);
                    return;
                }

                blacklistData.refrs.forEach(refr => locals.refrIdBlacklist.push(getFormIDWithLO(file, refr)));
            });

            const blacklistLog = `Loaded blacklist: ${locals.refrIdBlacklist.join(", ")}`;
            helpers.logMessage(blacklistLog);
            locals.outputArray.push(blacklistLog);
        },
        process: [{
            records: (filesToPatch, helpers, settings, locals) => {
                filesToPatch.forEach(file => {
                    helpers.logMessage(`Building references for ${file}...`);
                    xelib.BuildReferences(file);
                });

                helpers.logMessage("Getting Word Wall Trigger references...");
                let triggerRefs = [];

                locals.wordWallTriggers.forEach(acti => {
                    let refs = xelib.GetReferencedBy(acti);
                    refs.forEach(refr => {
                        // Skip references that are not REFR
                        if(xelib.Signature(refr) !== "REFR"){
                            return;
                        }

                        // Skip REFR if in blacklist
                        const formid = xelib.GetHexFormID(refr);
                        if (locals.refrIdBlacklist.includes(formid)) {
                            return;
                        }

                        triggerRefs.push(refr);
                    });
                });

                // Get remove duplicates and get winning overrides
                let filteredID = [];
                let processedTriggerRefs = triggerRefs.filter(wordWall => {
                    const formid = xelib.GetHexFormID(wordWall);
                    if (filteredID.includes(formid)) {
                        return false;
                    }
                    filteredID.push(formid);
                    return true;
                }).map(wordWall => xelib.GetWinningOverride(wordWall));

                locals.wordWallRefsShuffled = shuffleArray(processedTriggerRefs);
                locals.indexCount = 0;

                return processedTriggerRefs;
            },
            patch: (record, helpers, settings, locals) => {
                const formid = xelib.GetHexFormID(record);
                helpers.logMessage(`Patching ${formid}...`);

                let wallCopyFrom = new WordWallRefr(locals.wordWallRefsShuffled[locals.indexCount]);
                let wallCopyTo = new WordWallRefr(record);

                locals.outputArray.push("==============================");
                locals.outputArray.push(`REFR: ${formid}`);
                locals.outputArray.push(`At cell: ${wallCopyTo.cellName}`);
                locals.outputArray.push(`Original shout: ${xelib.GetValue(wallCopyTo.shoutGlobalValue)}`);
                locals.outputArray.push(`Randomized shout: ${xelib.GetValue(wallCopyFrom.shoutGlobalValue)}`);

                xelib.SetElement(wallCopyTo.myWord01Value, wallCopyFrom.myWord01Value);
                xelib.SetElement(wallCopyTo.myWord02Value, wallCopyFrom.myWord02Value);
                xelib.SetElement(wallCopyTo.myWord03Value, wallCopyFrom.myWord03Value);
                xelib.SetElement(wallCopyTo.shoutGlobalValue, wallCopyFrom.shoutGlobalValue);

                locals.indexCount += 1;
            }
        }],
        finalize: () => {
            helpers.logMessage(`Setting ESL flag to ${settings.setEsl}.`);
            xelib.SetRecordFlag(xelib.GetFileHeader(patchFile), "ESL", settings.setEsl);

            helpers.logMessage(`Saving log file to ${rwwLogPath}`);
            fh.saveTextFile(rwwLogPath, locals.outputArray.join("\n"));
        }
    })
});