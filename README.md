# Word Wall Randomizer (zEdit Patcher)

A zEdit Patcher that shuffles the Shouts rewarded by each Word Wall. Supports DLCs, Falskaar, Wyrmstooth and potentially more mods!

More general info can be found on the [Nexus mods page](https://www.nexusmods.com/skyrimspecialedition/mods/41616).

## Technical Information

Every Word Wall in Skyrim contains a `WordWallTrigger` activator (ACTI) reference that runs the `WordWallTriggerScript` Papyrus script, which controls stuff like Word Wall animations and which shout you learn when approaching a Word Wall.

*(There's also `DLC1WordWallTrigger`, `DLC1WordWallTriggerScript`, `DLC2WordWallTrigger` and `DLC2WordWallTriggerScript`, which are all functionally the same with their main Skyrim counterparts. Why the DLCs use duplicates instead of the original is anyone's guess. This patcher will work with them either way.)*

The trigger script has a few important properties that are used by this patcher:

- `myWord01`, `myWord02` and `myWord03` - These points to the individual Words of Power of a shout, but are only used for the UI animation of showing which word you learned.
- `shoutGlobal` - This points to the global variable (GLOB) record of a shout, which is what's actually used for learning the shout from a Word Wall.

This patcher looks at all the `WordWallTrigger` reference (REFR) records, collects their `myWord01`, `myWord02`, `myWord03` and `shoutGlobal` script property values, shuffles them randomly and replaces the original properties with the shuffled properties.

Originally, the patcher only worked with **dynamic patching**, where only the FormIDs of `WordWallTrigger`, `DLC1WordWallTrigger` and `DLC2WordWallTrigger` ACTI records are hardcoded into the settings JSON file. The patcher would have to list all references to these records and build a REFR list to shuffle from there. While this allows the patcher to potentially support any Word Walls from any mod that uses these triggers, the reference building process in zEdit takes too long for this process to be used predominantly.

Now, the FormIDs of the Word Wall trigger REFR records are all **hardcoded** into the settings JSON. This makes the patching process a lot quicker, but any mod that adds Word Walls will have to be officially supported and manually added into the hardcoded list before they will be included in the randomization process. A list of officially supported mods can be seen on the Nexus mod page or within the settings JSON file.

Dynamic patching is left in the patcher for debugging purposes, or for those who are desperate to randomize Word Walls from a mod I have yet to officially support. Let me know of any requests for mod support by leaving a comment on Nexus or opening an issue on GitHub. Even better, you could fork this repo, edit `rwwSettings.json` and submit a pull request!
