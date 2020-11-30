/**
 * @file zEdit Patcher - Randomizes the dragon shouts you receive from word walls.
 * @author ChrRubin
 * @version 1.0.2
 * @license MIT
 * @copyright ChrRubin 2020
 */

/* global info, xelib, registerPatcher, patcherUrl, fh, patcherPath */

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

class RwwSettingsJSON {
    /**
     * @typedef {Object} RwwSettingsData
     * @property {string} pluginName
     * @property {string[]} shortFormIDs
     */

    /**
     * Creates an instance of RwwSettingsJSON.
     * @param {string[]} ignoredFiles UPF `settings.ignoredFiles`
     * @param {*} helpers UPF `helpers`
     * @memberof RwwSettingsJSON
     */
    constructor(ignoredFiles, helpers) {
        const rwwSettingsPath = `${patcherPath}\\rwwSettings.json`;
        if (!fh.jetpack.exists(rwwSettingsPath)) {
            throw new ChrCustomError("Unable to find settings.json!");
        }
        const settingsJson = fh.loadJsonFile(rwwSettingsPath);

        function validateObject(obj, location, ...properties) {
            properties.forEach(prop => {
                if (!Object.prototype.hasOwnProperty.call(obj, prop)) {
                    throw new ChrCustomError(`Invalid settings JSON at ${location}!`);
                }
            });
        }

        const properties = ["dynamicWordWallTriggers", "dynamicBlacklist", "hardcodedWalls"];
        properties.forEach(prop => {
            validateObject(settingsJson, "root", prop);
            settingsJson[prop].forEach(obj => validateObject(obj, prop, ...["pluginName", "shortFormIDs"]));
        });

        /** @type {RwwSettingsData[]} */
        this.dynamicWordWallTriggers = settingsJson.dynamicWordWallTriggers;
        /** @type {RwwSettingsData[]} */
        this.dynamicBlacklist = settingsJson.dynamicBlacklist;
        /** @type {RwwSettingsData[]} */
        this.hardcodedWalls = settingsJson.hardcodedWalls;

        this.ignoredFiles = ignoredFiles;
        this.helpers = helpers;
    }

    /**
     * Reduce settings data array into array of handles to records.
     * @param {RwwSettingsData[]} dataArray Data array
     * @param {boolean} [returnFormId=false] Set true to return array of FormIDs instead of handles
     * @return {number[]} Array of handles
     * @memberof RwwSettingsJSON
     */
    reduceData(dataArray, returnFormId = false) {
        return dataArray.reduce((result, currentObj) => {
            if (this.ignoredFiles.some(file => file.trim().toUpperCase() === currentObj.pluginName.trim().toUpperCase())) {
                this.helpers.logMessage(`${currentObj.pluginName} is ignored. Skipping...`);
                return result;
            }

            const file = xelib.FileByName(currentObj.pluginName);
            if (!file) {
                this.helpers.logMessage(`${currentObj.pluginName} is not loaded. Skipping...`);
                return result;
            }

            const loadOrder = xelib.Hex(xelib.GetFileLoadOrder(file), 2);

            return result.concat(
                currentObj.shortFormIDs.map(shortFormID => {
                    const formid = `${loadOrder}${shortFormID}`;
                    const handle = xelib.GetElement(file, formid);
                    if (!handle) {
                        throw new ChrCustomError(`Unable to load ${formid}!`);
                    }

                    if (returnFormId) {
                        return formid;
                    }
                    return handle;
                })
            );
        }, []);
    }

    /**
     * Get array of handles to loaded word wall triggers.
     * @return {number[]}
     * @memberof RwwSettingsJSON
     */
    getWordWallTriggers() {
        return this.reduceData(this.dynamicWordWallTriggers);
    }

    /**
     * Get array of blacklisted FormIDs.
     * @return {string[]}
     * @memberof RwwSettingsJSON
     */
    getBlacklist() {
        return this.reduceData(this.dynamicBlacklist, true);
    }

    /**
     * Get array of handles to loaded hardcoded walls.
     * @return {number[]}
     * @memberof RwwSettingsJSON
     */
    getHardcodedWalls() {
        return this.reduceData(this.hardcodedWalls);
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
 * Shuffles array.
 * Source: https://gist.github.com/guilhermepontes/17ae0cc71fa2b13ea8c20c94c5c35dc4
 * @param {any[]} array Original array
 * @returns {any[]} Shuffled array
 */
function shuffleArray(array) {
    return array.map(a => [Math.random(), a]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
}


registerPatcher({
    info: info,
    gameModes: [xelib.gmSSE, xelib.gmTES5],
    settings: {
        label: 'Word Wall Randomizer',
        templateUrl: `${patcherUrl}/partials/settings.html`,
        controller: function ($scope) {
            $scope.showRecentLog = () => {
                if (!fh.jetpack.exists(rwwLogPath)) {
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
            const settingsJson = new RwwSettingsJSON(settings.ignoredFiles, helpers);

            // Stores output log strings
            locals.outputArray = [];

            locals.outputArray.push(`${new Date().toString()}\n`);

            const settingsLog = `PATCHER SETTINGS:\nIgnored files: ${settings.ignoredFiles.join(", ")}\nisDynamic: ${settings.isDynamic}\nsetEsl: ${settings.setEsl}\npatchFileName: ${settings.patchFileName}`;
            helpers.logMessage(settingsLog);
            locals.outputArray.push(settingsLog);

            if (!settings.isDynamic) {
                helpers.logMessage("Loading hardcoded Word Walls...");
                locals.hardcodedWalls = settingsJson.getHardcodedWalls();
                const hardCodedWallIDs = locals.hardcodedWalls.map(handle => xelib.GetHexFormID(handle));

                const hardcodeLog = `Loaded hardcoded Word Walls: ${hardCodedWallIDs.join(", ")}`;
                helpers.logMessage(hardcodeLog);
                locals.outputArray.push(hardcodeLog);
            }
            else {
                helpers.logMessage("Loading Word Wall triggers...");
                locals.wordWallTriggers = settingsJson.getWordWallTriggers();
                const wordWallTriggerIDs = locals.wordWallTriggers.map(handle => xelib.GetHexFormID(handle));

                const triggerLog = `Loaded triggers: ${wordWallTriggerIDs.join(", ")}`;
                helpers.logMessage(triggerLog);
                locals.outputArray.push(triggerLog);

                helpers.logMessage("Loading blacklisted FormIDs...");
                locals.refrIdBlacklist = settingsJson.getBlacklist();

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

                let wallRefrs;
                if (settings.isDynamic) {
                    helpers.logMessage("Dynamically getting references to Word Wall Triggers...");
                    wallRefrs = locals.wordWallTriggers.reduce((result, acti) => {
                        const references = xelib.GetReferencedBy(xelib.GetMasterRecord(acti));
                        return result.concat(
                            references.filter(refr =>
                                xelib.Signature(refr) === "REFR" && !locals.refrIdBlacklist.includes(xelib.GetHexFormID(refr))
                            )
                        );
                    }, []);
                }
                else {
                    helpers.logMessage("Using hardcoded Word Walls...");
                    wallRefrs = locals.hardcodedWalls;
                }

                const filteredID = [];
                const processedWallRefrs = wallRefrs.reduce((result, currentRefr) => {
                    const formid = xelib.GetHexFormID(currentRefr);
                    if (filteredID.includes(formid)) {
                        return result;
                    }
                    filteredID.push(formid);

                    if (xelib.Signature(currentRefr) !== "REFR") {
                        return result;
                    }

                    const previousOverride = xelib.GetPreviousOverride(currentRefr, patchFile);
                    if (xelib.GetRecordFlag(previousOverride, "Initially Disabled") || xelib.GetRecordFlag(previousOverride, "Deleted")) {
                        return result;
                    }

                    result.push(previousOverride);
                    return result;
                }, []);

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

            if (settings.showLog) {
                helpers.logMessage("Opening log file...");
                fh.openFile(rwwLogPath);
            }
        }
    })
});
