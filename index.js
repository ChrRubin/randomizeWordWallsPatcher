/**
 * @file zEdit Patcher - Randomizes the dragon shouts you receive from word walls.
 * @author ChrRubin
 * @version 1.0.1
 * @license MIT
 * @copyright ChrRubin 2020
 */

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

        const cell = xelib.GetLinksTo(this.handle, "Cell");
        if (!cell) {
            this.cellName = "";
        }
        this.cellName = xelib.LongName(cell);
    }

    /**
     * Retrieves script property value.
     * Cause of course Bethesda made multiple object versions, causing issues with running SetElement on the script property itself.
     * @param {number} scriptProperty Script property handle
     * @returns {number} FormID value handle
     */
    getScriptPropertyValue(scriptProperty) {
        const valuePath1 = "Value\\Object Union\\Object v1\\FormID";
        const valuePath2 = "Value\\Object Union\\Object v2\\FormID";

        const value = xelib.GetElement(scriptProperty, valuePath1);
        if (value) {
            return value;
        }

        return xelib.GetElement(scriptProperty, valuePath2);
    }
}

/**
 * Validates that object contains given properties.
 * @param {any} object JSON object
 * @param  {...string} properties Properties to validate
 * @returns {boolean} True if object is valid
 */
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

/**
 * Expands short FormID with proper load order index.
 * @param {number} fileHandle Plugin file handle
 * @param {string} shortFormID Short FormID (without load order index)
 * @returns {string} Full FormID
 */
function expandShortFormID(fileHandle, shortFormID) {
    const loadOrder = xelib.Hex(xelib.GetFileLoadOrder(fileHandle), 2);
    return `${loadOrder}${shortFormID}`;
}

/**
 * Shuffles array.
 * Source: https://gist.github.com/guilhermepontes/17ae0cc71fa2b13ea8c20c94c5c35dc4
 * @param {any[]} array Original array
 * @returns {any[]} Shuffled array
 */
function shuffleArray(array) {
    return array.map(a => [Math.random(), a]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
}

/**
 * Checks if pluginName is ignored or not loaded before returning handle to plugin file.
 * Returns 0 if plugin is not to be used.
 * @param {string} pluginName Plugin file name
 * @param {string} loadDesc Description of JSON settings being loaded
 * @param {string[]} ignoredFiles `settings.ignoredFiles`
 * @param {*} helpers `helpers`
 * @return {number} Handle to plugin file.
 */
function getPluginForJsonLoad(pluginName, loadDesc, ignoredFiles, helpers) {
    for (let i = 0; i < ignoredFiles.length; i++) {
        const file = ignoredFiles[i];
        if (file.trim().toUpperCase() === pluginName.trim().toUpperCase()) {
            helpers.logMessage(`${pluginName} ignored. Skipping its ${loadDesc}...`);
            return 0;
        }
    }

    const file = xelib.FileByName(pluginName);
    if (!file) {
        helpers.logMessage(`${pluginName} not found. Skipping its ${loadDesc}...`);
        return 0;
    }

    return file;
}


registerPatcher({
    info: info,
    gameModes: [xelib.gmSSE, xelib.gmTES5],
    settings: {
        label: 'Word Wall Randomizer',
        templateUrl: `${patcherUrl}/partials/settings.html`,
        controller: function($scope) {
            $scope.showRecentLog = () => {
                if (!fh.jetpack.exists(rwwLogPath)){
                    alert("Log file does not exist!");
                    return;
                }
                fh.openFile(rwwLogPath);
            };
        },
        defaultSettings: {
            isDynamic: false,
            setEsl: true,
            showLog: false,
            patchFileName: 'RandomWordWallsPatch.esp'
        }
    },
    execute: (patchFile, helpers, settings, locals) => ({
        initialize: () => {
            if (!fh.jetpack.exists(rwwSettingsPath)) {
                throw new ChrCustomError("Unable to find settings.json!");
            }

            const settingsJson = fh.loadJsonFile(rwwSettingsPath);
            if (!validateObject(settingsJson, "dynamicWordWallTriggers", "dynamicBlacklist", "hardcodedWalls")) {
                throw new ChrCustomError("Invalid settings.json at root!");
            }

            // Stores output log strings
            locals.outputArray = [];

            locals.outputArray.push(`${new Date().toString()}\n`);

            const settingsLog = `PATCHER SETTINGS:\nIgnored files: ${settings.ignoredFiles.join(", ")}\nisDynamic: ${settings.isDynamic}\nsetEsl: ${settings.setEsl}\npatchFileName: ${settings.patchFileName}`;
            helpers.logMessage(settingsLog);
            locals.outputArray.push(settingsLog);

            if (!settings.isDynamic) {
                helpers.logMessage("Loading hardcoded word walls...");
                locals.hardcodedPlugins = [];
                locals.hardcodedWalls = [];
                const hardCodedWallIDs = [];

                settingsJson.hardcodedWalls.forEach(hardcodeData => {
                    if (!validateObject(hardcodeData, "pluginName", "refrs")) {
                        throw new ChrCustomError("Invalid settings.json at hardcodedWalls!");
                    }

                    const file = getPluginForJsonLoad(hardcodeData.pluginName, "hardcoded walls", settings.ignoredFiles, helpers);
                    if (!file) {
                        return;
                    }

                    helpers.logMessage(`Loading hardcoded walls for ${hardcodeData.pluginName}...`);
                    locals.hardcodedPlugins.push(hardcodeData.pluginName);

                    hardcodeData.refrs.forEach(refr => {
                        const formid = expandShortFormID(file, refr);
                        hardCodedWallIDs.push(formid);
                        const handle = xelib.GetElement(file, formid);
                        if (!handle) {
                            throw new ChrCustomError(`Unable to load ${formid}!`);
                        }
                        locals.hardcodedWalls.push(handle);
                    });
                });

                const hardcodeLog = `Loaded hardcoded walls: ${hardCodedWallIDs.join(", ")}`;
                helpers.logMessage(hardcodeLog);
                locals.outputArray.push(hardcodeLog);
            }
            else {
                helpers.logMessage("Loading Word Wall Triggers...");
                locals.wordWallTriggers = [];
                const wordWallTriggerIDs = [];

                settingsJson.dynamicWordWallTriggers.forEach(triggerData => {
                    if (!validateObject(triggerData, "pluginName", "triggerID")) {
                        throw new ChrCustomError("Invalid settings.json at wordWallTriggers!");
                    }

                    const file = getPluginForJsonLoad(triggerData.pluginName, "triggers", settings.ignoredFiles, helpers);
                    if (!file) {
                        return;
                    }

                    const formid = expandShortFormID(file, triggerData.triggerID);
                    wordWallTriggerIDs.push(formid);
                    const handle = xelib.GetElement(file, formid);
                    if (!handle) {
                        throw new ChrCustomError(`Unable to load ${formid}!`);
                    }
                    locals.wordWallTriggers.push(handle);
                });

                const triggerLog = `Loaded triggers: ${wordWallTriggerIDs.join(", ")}`;
                helpers.logMessage(triggerLog);
                locals.outputArray.push(triggerLog);

                helpers.logMessage("Loading REFR blacklist...");
                locals.refrIdBlacklist = [];

                settingsJson.dynamicBlacklist.forEach(blacklistData => {
                    if (!validateObject(blacklistData, "pluginName", "refrs")) {
                        throw new ChrCustomError("Invalid settings.json at blacklist!");
                    }

                    const file = getPluginForJsonLoad(blacklistData.pluginName, "blacklist", settings.ignoredFiles, helpers);
                    if (!file) {
                        return;
                    }

                    blacklistData.refrs.forEach(refr => locals.refrIdBlacklist.push(expandShortFormID(file, refr)));
                });

                const blacklistLog = `Loaded blacklist: ${locals.refrIdBlacklist.join(", ")}`;
                helpers.logMessage(blacklistLog);
                locals.outputArray.push(blacklistLog);
            }
        },
        process: [{
            records: (filesToPatch, helpers, settings, locals) => {
                if (settings.isDynamic) {
                    filesToPatch.forEach(file => {
                        helpers.logMessage(`Building references for ${file}...`);
                        xelib.BuildReferences(file);
                    });
                }
                else {
                    helpers.logMessage(`Dynamic patching disabled. Skipped reference building.`);
                }

                let wallRefrs = [];
                if (settings.isDynamic) {
                    helpers.logMessage("Dynamically getting references to Word Wall Triggers...");
                    locals.wordWallTriggers.forEach(acti => {
                        const refs = xelib.GetReferencedBy(acti);
                        refs.forEach(refr => {
                            // Skip references that are not REFR
                            if (xelib.Signature(refr) !== "REFR") {
                                return;
                            }

                            // Skip REFR if in blacklist
                            const formid = xelib.GetHexFormID(refr);
                            if (locals.refrIdBlacklist.includes(formid)) {
                                return;
                            }

                            wallRefrs.push(refr);
                        });
                    });
                }
                else {
                    helpers.logMessage("Using hardcoded Word Walls...");
                    wallRefrs = [...locals.hardcodedWalls];
                }

                // Get winning overrides, remove duplicates, remove disabled walls
                const filteredID = [];
                const processedWallRefrs = wallRefrs
                    .map(wordWall => xelib.GetWinningOverride(wordWall))
                    .filter(wordWall => {
                        const formid = xelib.GetHexFormID(wordWall);
                        if (filteredID.includes(formid)) {
                            return false;
                        }

                        filteredID.push(formid);

                        if (xelib.GetRecordFlag(wordWall, "Initially Disabled")){
                            return false;
                        }

                        return true;
                    });

                locals.wordWallRefsShuffled = shuffleArray(processedWallRefrs);
                locals.indexCount = 0;

                return processedWallRefrs;
            },
            patch: (record, helpers, settings, locals) => {
                const formid = xelib.GetHexFormID(record);
                helpers.logMessage(`Patching ${formid}...`);

                const wallCopyFrom = new WordWallRefr(locals.wordWallRefsShuffled[locals.indexCount]);
                const wallCopyTo = new WordWallRefr(record);

                locals.outputArray.push("\n==============================");
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

            if(settings.showLog){
                helpers.logMessage("Opening log file...");
                fh.openFile(rwwLogPath);
            }
        }
    })
});
